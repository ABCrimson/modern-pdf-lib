/**
 * The structural gate of the limits plumbing: no hidden limit state is left in `src`. Every file
 * of `src` is parsed (oxc-parser, the parser the other source scans of this repository use) and
 * checked for four things:
 *
 * 1. `assertWithinLimit` and `legacyContext`, the helpers that checked against the defaults for
 *    the modules that took no context, are gone: no identifier of either name is left.
 * 2. `DEFAULT_LIMITS` is named only by the two modules that own the limits (`src/limits.ts`
 *    defines it, `src/internal/limits.ts` resolves the option over it), by the registry that roots
 *    the limits of a document (`src/core/pdfObjects.ts`, whose constructor defaults to it) and by
 *    the `export { ... }` lists of the package entries that re-export it; `INTERNAL_LIMITS` only
 *    by `src/internal/limits.ts`. Every other module gets limits through a context.
 * 3. No file that imports from a limits module, a type import included, holds a module-level
 *    `let` or `var`: a limit, a total or a context kept in a module variable would be shared by
 *    every call. A re-export gives a file no limits to keep. The variables of
 *    ALLOWED_MODULE_STATE are not limit state; each carries its reason, and the list may only
 *    shrink: an entry whose variable is gone fails.
 * 4. `assertLimit` and `addToTotal` take a context that is passed down: the first argument is
 *    neither built in the call nor a module-level binding, and no `beginCall` runs outside a
 *    function, where its context and totals would be shared by every call.
 *
 * The scanner is checked on source snippets first, so a clean scan of `src` means the rules can
 * fire, not that they look at nothing.
 */
import { globSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, Visitor } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../../src/', import.meta.url));

/** The helpers that were removed: no identifier of these names may be left in `src`. */
const REMOVED_NAMES: ReadonlySet<string> = new Set(['assertWithinLimit', 'legacyContext']);

/** The modules that may name each constant. */
const HOMES: ReadonlyMap<string, readonly string[]> = new Map([
  ['DEFAULT_LIMITS', ['src/internal/limits.ts', 'src/limits.ts', 'src/core/pdfObjects.ts']],
  ['INTERNAL_LIMITS', ['src/internal/limits.ts']],
]);

/** The limits modules: a file that imports a value from one must keep no module-level state. */
const LIMITS_MODULES: ReadonlySet<string> = new Set(['src/internal/limits.ts', 'src/limits.ts']);

/**
 * The module-level variables of files that import limits and are no limit state, by file and
 * variable name, each with what it holds.
 */
const ALLOWED_MODULE_STATE: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'src/assets/font/fontEmbed.ts',
    new Map([['fontParserWasm', 'the loaded font parser WASM module, set once when it loads']]),
  ],
  [
    'src/assets/image/internal/pngEmbed.ts',
    new Map([['pngWasmInstance', 'the loaded PNG WASM module, set once by initPngWasm']]),
  ],
  [
    'src/assets/image/tiff/tiffDirectEmbed.ts',
    new Map([
      ['_cachedView', 'the DataView over the buffer last read, a memo'],
      ['_cachedBuffer', 'the buffer that DataView was made over'],
    ]),
  ],
  [
    'src/core/pdfObjects.ts',
    new Map([
      [
        'makePdfString',
        'the unchecked PdfString factory, bound once by the static block of PdfString',
      ],
      ['makePdfName', 'the unchecked PdfName factory, bound once by the static block of PdfName'],
    ]),
  ],
]);

/** The checks that take a context as their first argument. */
const CONTEXT_CHECKS: ReadonlySet<string> = new Set(['assertLimit', 'addToTotal']);

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let at = text.indexOf('\n'); at !== -1 && at < offset; at = text.indexOf('\n', at + 1))
    line++;
  return line;
}

/** The module a relative import path names, as a repository path with `.ts`; other paths as written. */
function resolveImport(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return posix.join(posix.dirname(file), specifier).replace(/\.js$/, '.ts');
}

/**
 * The offences of one source file against the four rules, each as `file:line what`.
 *
 * @param file - Repository path with forward slashes, for example `src/core/pdfDocument.ts`.
 * @param text - The source text.
 * @param usedState - Receives each `file:name` of ALLOWED_MODULE_STATE the scan met.
 */
function scanSource(file: string, text: string, usedState?: Set<string>): string[] {
  const { program, errors } = parseSync(file, text, { lang: 'ts', sourceType: 'module' });
  if (errors.length > 0) {
    throw new Error(`${file}: oxc-parser: ${errors.map((e) => e.message).join('; ')}`);
  }
  const found = new Set<string>();
  const report = (offset: number, what: string): void => {
    found.add(`${file}:${lineOf(text, offset)} ${what}`);
  };

  const moduleBindings = new Set<string>();
  const moduleMutables: { offset: number; kind: string; name: string }[] = [];
  let importsLimits = false;
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      if (LIMITS_MODULES.has(resolveImport(file, statement.source.value))) importsLimits = true;
      for (const specifier of statement.specifiers) moduleBindings.add(specifier.local.name);
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      const name = declarator.id.type === 'Identifier' ? declarator.id.name : undefined;
      if (name !== undefined) moduleBindings.add(name);
      if (declaration.kind === 'let' || declaration.kind === 'var') {
        moduleMutables.push({
          offset: declarator.start,
          kind: declaration.kind,
          name: name ?? '(pattern)',
        });
      }
    }
  }
  if (importsLimits) {
    for (const { offset, kind, name } of moduleMutables) {
      if (ALLOWED_MODULE_STATE.get(file)?.has(name) === true) {
        usedState?.add(`${file}:${name}`);
      } else {
        report(offset, `module-level ${kind} ${name} in a file that imports the limits`);
      }
    }
  }

  // The names an `export { ... }` list holds are the re-exports of the package entries.
  const exportListNames = new Set<number>();
  // How many functions enclose the node visited: a `beginCall` at depth 0 runs once per module.
  let functionDepth = 0;
  const enterFunction = (): void => {
    functionDepth++;
  };
  const exitFunction = (): void => {
    functionDepth--;
  };
  new Visitor({
    FunctionDeclaration: enterFunction,
    'FunctionDeclaration:exit': exitFunction,
    FunctionExpression: enterFunction,
    'FunctionExpression:exit': exitFunction,
    ArrowFunctionExpression: enterFunction,
    'ArrowFunctionExpression:exit': exitFunction,
    ExportSpecifier(node) {
      exportListNames.add(node.local.start);
      exportListNames.add(node.exported.start);
    },
    Identifier(node) {
      if (REMOVED_NAMES.has(node.name)) {
        report(node.start, `${node.name} is removed; pass a context`);
        return;
      }
      const homes = HOMES.get(node.name);
      if (homes !== undefined && !homes.includes(file) && !exportListNames.has(node.start)) {
        report(node.start, `${node.name} is named outside its modules; take a context`);
      }
    },
    CallExpression(node) {
      if (node.callee.type !== 'Identifier') return;
      if (node.callee.name === 'beginCall' && functionDepth === 0) {
        report(node.start, 'beginCall runs at module level; its context is shared by every call');
        return;
      }
      if (!CONTEXT_CHECKS.has(node.callee.name)) return;
      const context = node.arguments[0];
      if (
        context?.type === 'CallExpression' ||
        context?.type === 'NewExpression' ||
        context?.type === 'ObjectExpression'
      ) {
        report(node.start, `${node.callee.name} builds its context in the call`);
      } else if (context?.type === 'Identifier' && moduleBindings.has(context.name)) {
        report(node.start, `${node.callee.name} takes the module binding ${context.name}`);
      }
    },
  }).visit(program);
  return [...found];
}

// metrics: synthetic paths start
describe('the scanner', () => {
  it.each([
    ['a removed helper', "import { assertWithinLimit } from '../internal/limits.js';", 'removed'],
    ['a call of a removed helper', 'const ctx = legacyContext();', 'removed'],
    [
      'the defaults named in a module',
      "import { DEFAULT_LIMITS } from '../limits.js';\nconst a = DEFAULT_LIMITS;",
      'named outside',
    ],
    ['the internal defaults named in a module', 'const a = INTERNAL_LIMITS.maxDerDepth;', 'named'],
    [
      'a module-level let next to a value import of the limits',
      "import { beginCall } from '../internal/limits.js';\nlet total = 0;",
      'module-level let total',
    ],
    [
      'a module-level var next to a value import of the limits',
      "import { beginCall } from '../internal/limits.js';\nexport var total = 0;",
      'module-level var total',
    ],
    [
      'a check against a context built in the call',
      "import { assertLimit, beginCall } from '../internal/limits.js';\nassertLimit(beginCall(x), 'maxDerDepth', 1);",
      'builds its context',
    ],
    [
      'a context begun at module level',
      "import { beginCall, resolveLimits } from '../internal/limits.js';\nconst shared = beginCall(resolveLimits(undefined));",
      'beginCall runs at module level',
    ],
    [
      'a module-level let next to a type import of the limits',
      "import { type LimitContext } from '../internal/limits.js';\nlet cached: LimitContext | undefined;",
      'module-level let cached',
    ],
    [
      'a check against a module binding',
      "import { assertLimit, beginCall } from '../internal/limits.js';\nconst shared = beginCall(x);\nexport function f() { assertLimit(shared, 'maxDerDepth', 1); }",
      'module binding shared',
    ],
  ])('flags %s', (_name, text, what) => {
    const found = scanSource('src/some/file.ts', text);
    expect(found.length).toBeGreaterThan(0);
    expect(found.join('\n')).toContain(what);
  });

  it.each([
    [
      'the context of the caller',
      "import { assertLimit, type LimitContext } from '../internal/limits.js';\nexport function f(ctx: LimitContext) { assertLimit(ctx, 'maxDerDepth', 1); }",
    ],
    ['a re-export of the defaults from an entry', "export { DEFAULT_LIMITS } from '../limits.js';"],
    ['a let in a file that imports no limits', 'let cache = 0;\nexport const a = 1;'],
    [
      'a let in a file that only re-exports the limits',
      "export { DEFAULT_LIMITS } from '../limits.js';\nlet cache = 0;",
    ],
  ])('accepts %s', (_name, text) => {
    expect(scanSource('src/some/file.ts', text)).toEqual([]);
  });

  it('lets the two limits modules name their own constants', () => {
    expect(scanSource('src/limits.ts', 'export const DEFAULT_LIMITS = {};')).toEqual([]);
    expect(
      scanSource('src/internal/limits.ts', 'export const INTERNAL_LIMITS = DEFAULT_LIMITS;'),
    ).toEqual([]);
    expect(scanSource('src/limits.ts', 'const a = INTERNAL_LIMITS;')).not.toEqual([]);
  });

  it('lets an allowed module variable stand and reports it as met', () => {
    const used = new Set<string>();
    const text =
      "import { beginCall } from '../../../internal/limits.js';\nlet pngWasmInstance = 1;";
    expect(scanSource('src/assets/image/internal/pngEmbed.ts', text, used)).toEqual([]);
    expect([...used]).toEqual(['src/assets/image/internal/pngEmbed.ts:pngWasmInstance']);
    expect(scanSource('src/assets/image/internal/other.ts', text)).not.toEqual([]);
  });
});
// metrics: synthetic paths end

describe('src', () => {
  // The scan parses every file of `src`; the hosted runners are slower than a laptop, so the
  // limit is the CI limit and not a measured one.
  it('keeps no hidden limit state', { timeout: 60_000 }, () => {
    const files = globSync('**/*.ts', { cwd: SRC_DIR })
      .map((f) => `src/${f.replaceAll('\\', '/')}`)
      .sort();
    expect(files.length).toBeGreaterThan(300);
    const usedState = new Set<string>();
    const found = files.flatMap((file) =>
      scanSource(file, readFileSync(`${SRC_DIR}${file.slice('src/'.length)}`, 'utf8'), usedState),
    );
    for (const [file, names] of ALLOWED_MODULE_STATE) {
      for (const name of names.keys()) {
        if (!usedState.has(`${file}:${name}`)) {
          found.push(
            `${file} no longer holds the allowed module variable ${name}; delete its entry`,
          );
        }
      }
    }
    expect(found).toEqual([]);
  });
});

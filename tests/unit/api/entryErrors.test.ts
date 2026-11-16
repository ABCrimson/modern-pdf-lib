/**
 * Every package entry exports the error classes its own calls can throw, and the parents of each.
 *
 * The root and browser entries export every error class of the library. The narrow entries
 * (create, parse and forms) export the classes the census reaches from them, with their parents.
 *
 * The narrow lists are derived, never written by hand. A class is reached from an entry when
 * `src` throws it in a file the entry loads, or when an allowlist of
 * tests/unit/api/errorCensus.allow still promises it for such a file (the target of a
 * generic-throw row, the `files` of a class row). The import closure is the unit: `loadPdf`
 * builds a `PdfDocument` and so loads most of the library, so the lists of create and parse are
 * long. A narrow entry exports exactly the classes so derived.
 */
import { globSync, readFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, Visitor } from 'oxc-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import { PdfError } from '../../../src/errors.js';
import { runCensus } from '../../helpers/errorCensus.js';
import type { ErrorCensus } from '../../helpers/errorCensus.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ALLOW_DIR = fileURLToPath(new URL('./errorCensus.allow/', import.meta.url));

/** The modules of the entries of package.json and the source file each is built from. */
const ENTRIES = {
  '.': { file: 'src/index.ts', load: () => import('../../../src/index.js') },
  './browser': { file: 'src/browser.ts', load: () => import('../../../src/browser.js') },
  './create': { file: 'src/create.ts', load: () => import('../../../src/create.js') },
  './parse': { file: 'src/parse.ts', load: () => import('../../../src/parse.js') },
  './forms': { file: 'src/forms.ts', load: () => import('../../../src/forms.js') },
} as const;
type EntryName = keyof typeof ENTRIES;

/** The narrow entries: each exports the error classes the census reaches from it. */
const NARROW = ['./create', './parse', './forms'] as const;

/** The classes the library removed: no entry exports them and `src/errors.ts` does not declare them. */
const REMOVED = ['ForeignPageError', 'FieldExistsAsNonTerminalError', 'RichTextFieldReadError'];

type ErrorClass = (abstract new (...args: never[]) => PdfError) & { readonly name: string };

function isErrorClass(value: unknown): value is ErrorClass {
  return value === PdfError || (typeof value === 'function' && value.prototype instanceof PdfError);
}

/** The names a module exports that are PdfError or classes deriving from it. */
function exportedErrorClasses(mod: Record<string, unknown>): Map<string, ErrorClass> {
  return new Map(
    Object.entries(mod).filter((pair): pair is [string, ErrorClass] => isErrorClass(pair[1])),
  );
}

/** The files a module loads: its value imports, `export ... from` and `import()` of a literal. */
function importsOf(file: string): string[] {
  const text = readFileSync(`${ROOT}${file}`, 'utf8');
  const { program, errors } = parseSync(file, text, { lang: 'ts', sourceType: 'module' });
  if (errors.length > 0) throw new Error(`${file}: ${errors.map((e) => e.message).join('; ')}`);
  const sources: string[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'ImportDeclaration' && stmt.importKind !== 'type') {
      sources.push(stmt.source.value);
    } else if (
      (stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportAllDeclaration') &&
      stmt.source !== null &&
      stmt.exportKind !== 'type'
    ) {
      sources.push(stmt.source.value);
    }
  }
  new Visitor({
    ImportExpression(node) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
        sources.push(node.source.value);
      }
    },
  }).visit(program);
  return sources
    .filter((s) => s.startsWith('.'))
    .map((s) => posix.join(dirname(file), s).replace(/\.js$/, '.ts'));
}

/** Every `src` file an entry loads, the entry file included. */
function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...importsOf(file));
  }
  return seen;
}

interface ThrowRow {
  readonly file: string;
  readonly target: string;
}
interface ClassRow {
  readonly name: string;
  readonly decision: string;
  /** The `src` files that will throw the class; absent when a throw row of a kind class covers it. */
  readonly files?: readonly string[];
}

function readRows<Row>(name: string): Row[] {
  return JSON.parse(readFileSync(`${ALLOW_DIR}${name}`, 'utf8')) as Row[];
}

/** The name of the class a class extends; undefined for a class that extends nothing the library names. */
function parentName(cls: ErrorClass): string | undefined {
  const parent: unknown = Object.getPrototypeOf(cls);
  return parent === Error ? undefined : (parent as ErrorClass).name;
}

/** The classes the census can reach from an entry file, with their parents. */
function reachableErrors(
  entryFile: string,
  census: ErrorCensus,
  classes: Map<string, ErrorClass>,
): Set<string> {
  const closure = importClosure(entryFile);
  const reached = new Set<string>();
  for (const [name, files] of census.thrownClasses) {
    if (files.some((f) => closure.has(f))) reached.add(name);
  }
  for (const file of globSync('*.json', { cwd: ALLOW_DIR })) {
    if (file === 'classes.json') continue;
    for (const row of readRows<ThrowRow>(file)) if (closure.has(row.file)) reached.add(row.target);
  }
  for (const row of readRows<ClassRow>('classes.json')) {
    if (row.decision === 'throw' && row.files?.some((f) => closure.has(f))) reached.add(row.name);
  }
  for (const name of [...reached]) {
    for (let cls = classes.get(name); cls !== undefined;) {
      const parent = parentName(cls);
      if (parent === undefined) break;
      reached.add(parent);
      cls = classes.get(parent);
    }
  }
  return reached;
}

describe('error exports of the package entries', () => {
  let census: ErrorCensus;
  const modules = new Map<EntryName, Record<string, unknown>>();
  beforeAll(async () => {
    census = runCensus();
    for (const [entry, { load }] of Object.entries(ENTRIES) as [
      EntryName,
      (typeof ENTRIES)[EntryName],
    ][]) {
      modules.set(entry, (await load()) as Record<string, unknown>);
    }
  });

  const exportedBy = (entry: EntryName): Map<string, ErrorClass> =>
    exportedErrorClasses(modules.get(entry) ?? {});
  const entryNames = Object.keys(ENTRIES) as EntryName[];

  it.each(['.', './browser'] as const)('%s exports every error class of the library', (entry) => {
    const everyClass = new Set(['PdfError', ...census.errorClasses.map((c) => c.name)]);
    const exported = new Set(exportedBy(entry).keys());
    expect({
      missing: [...everyClass].filter((n) => !exported.has(n)).sort(),
      surplus: [...exported].filter((n) => !everyClass.has(n)).sort(),
    }).toEqual({ missing: [], surplus: [] });
  });

  it.each(NARROW)(
    '%s exports the error classes the census reaches from it, with their parents',
    (entry) => {
      const root = exportedBy('.');
      const derived = [...reachableErrors(ENTRIES[entry].file, census, root)]
        .filter((n) => root.has(n))
        .sort();
      expect([...exportedBy(entry).keys()].sort()).toEqual(derived);
    },
  );

  it.each(NARROW)('%s exports no class without its parents', (entry) => {
    const exported = exportedBy(entry);
    const orphans = [...exported]
      .map(([name, cls]) => [name, parentName(cls)] as const)
      .filter(([, parent]) => parent !== undefined && !exported.has(parent))
      .map(([name, parent]) => `${name} extends ${parent}`);
    expect(orphans).toEqual([]);
  });

  it('an entry exports each class under its own name, and the class of `.`', () => {
    const root = exportedBy('.');
    for (const entry of entryNames) {
      for (const [name, cls] of exportedBy(entry)) {
        expect(cls.name, `${entry} ${name}`).toBe(name);
        expect(cls, `${entry} ${name}`).toBe(root.get(name));
      }
    }
  });

  it('no entry exports a class the library removed, and errors.ts does not declare one', () => {
    for (const [entry, mod] of modules) {
      expect(
        REMOVED.filter((name) => name in mod),
        entry,
      ).toEqual([]);
    }
    expect(census.errorClasses.map((c) => c.name).filter((n) => REMOVED.includes(n))).toEqual([]);
  });
});

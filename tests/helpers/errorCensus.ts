/**
 * The error census: an AST walk over every file of `src` (oxc-parser, the way
 * `scripts/dev/api-snapshot.ts` reads declarations) that answers two questions.
 *
 * - Which `throw` statements build a generic native error (`Error`, `TypeError`, `RangeError`,
 *   `SyntaxError`, `ReferenceError`, `EvalError`, `URIError`, `AggregateError`) rather than one of
 *   the library's own classes? A `throw` whose argument is a conditional or a logical
 *   expression counts through each branch (`throw e instanceof Error ? e : new Error(String(e))`).
 *   A rethrow of a caught identifier builds nothing and is not a site.
 * - Which classes does `src` throw? The census records every class a `throw` statement constructs,
 *   and lists the exported error classes (a concrete class with a `super` class) of the files that
 *   declare them, so a test can ask for the ones no `throw` names.
 *
 * A site is keyed by file, constructor and message, never by line. The message is the text of the
 * first argument (the second for `AggregateError`): a string literal as is, a template literal or
 * a `+` chain with every non-literal part written `${}`, any other expression `${}`.
 */
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSync, Visitor } from 'oxc-parser';
import type { Expression, Node, ThrowStatement } from 'oxc-parser';

const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url));

/** The native error constructors: a `throw` that builds one is a generic throw. */
const NATIVE_ERRORS: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'EvalError',
  'URIError',
  'AggregateError',
]);

/** The files whose exported error classes the census lists. */
export const ERROR_CLASS_FILES: readonly string[] = [
  'src/errors.ts',
  'src/parser/parseError.ts',
  'src/runtime/memoryBudget.ts',
];

/** One `throw` statement that builds a native error. */
export interface GenericThrow {
  /** Repository-relative path with forward slashes, for example `src/core/pdfPage.ts`. */
  readonly file: string;
  /** The constructor: `Error`, `RangeError`, ... */
  readonly kind: string;
  /** The message as described in the module comment. */
  readonly message: string;
  /** 1-based line of the `throw` statement (for a failure report only; never a key). */
  readonly line: number;
}

/** An exported error class of one of {@link ERROR_CLASS_FILES}. */
export interface ErrorClassDeclaration {
  readonly name: string;
  readonly file: string;
}

export interface ErrorCensus {
  readonly genericThrows: readonly GenericThrow[];
  readonly errorClasses: readonly ErrorClassDeclaration[];
  /** Class name to the files holding a `throw` that constructs it, sorted. */
  readonly thrownClasses: ReadonlyMap<string, readonly string[]>;
}

/** The expressions a `throw` argument can evaluate to when they are built in place. */
function thrownBranches(node: Expression): Expression[] {
  switch (node.type) {
    case 'ConditionalExpression':
      return [...thrownBranches(node.consequent), ...thrownBranches(node.alternate)];
    case 'LogicalExpression':
      return [...thrownBranches(node.left), ...thrownBranches(node.right)];
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return thrownBranches(node.expression);
    default:
      return [node];
  }
}

/** The message text of a constructor argument (see the module comment). */
function messageOf(node: Node | undefined): string {
  if (node === undefined) return '';
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? node.value : '${}';
    case 'TemplateLiteral':
      return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('${}');
    case 'BinaryExpression':
      return node.operator === '+' ? messageOf(node.left) + messageOf(node.right) : '${}';
    case 'ParenthesizedExpression':
      return messageOf(node.expression);
    default:
      return '${}';
  }
}

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let at = text.indexOf('\n'); at !== -1 && at < offset; at = text.indexOf('\n', at + 1))
    line++;
  return line;
}

/** The `src` files (relative to the repository root) the census reads, sorted. */
export function sourceFiles(): string[] {
  return globSync('**/*.ts', { cwd: SRC_DIR })
    .map((f) => `src/${f.replaceAll('\\', '/')}`)
    .sort();
}

/** Walk every file of `src`. */
export function runCensus(): ErrorCensus {
  const genericThrows: GenericThrow[] = [];
  const errorClasses: ErrorClassDeclaration[] = [];
  const thrown = new Map<string, Set<string>>();

  for (const file of sourceFiles()) {
    const text = readFileSync(`${SRC_DIR}${file.slice('src/'.length)}`, 'utf8');
    const { program, errors } = parseSync(file, text, { lang: 'ts', sourceType: 'module' });
    if (errors.length > 0) {
      throw new Error(`${file}: oxc-parser: ${errors.map((e) => e.message).join('; ')}`);
    }

    if (ERROR_CLASS_FILES.includes(file)) {
      for (const stmt of program.body) {
        if (stmt.type !== 'ExportNamedDeclaration') continue;
        const decl = stmt.declaration;
        if (decl?.type === 'ClassDeclaration' && decl.id !== null) {
          if (decl.superClass !== null && !decl.abstract) {
            errorClasses.push({ name: decl.id.name, file });
          }
        }
      }
    }

    new Visitor({
      ThrowStatement(statement: ThrowStatement) {
        for (const branch of thrownBranches(statement.argument)) {
          if (
            (branch.type !== 'NewExpression' && branch.type !== 'CallExpression') ||
            branch.callee.type !== 'Identifier'
          ) {
            continue;
          }
          const kind = branch.callee.name;
          const files = thrown.get(kind) ?? new Set<string>();
          files.add(file);
          thrown.set(kind, files);
          if (!NATIVE_ERRORS.has(kind)) continue;
          const messageArg = branch.arguments[kind === 'AggregateError' ? 1 : 0];
          genericThrows.push({
            file,
            kind,
            message: messageOf(messageArg),
            line: lineOf(text, statement.start),
          });
        }
      },
    }).visit(program);
  }

  return {
    genericThrows,
    errorClasses,
    thrownClasses: new Map([...thrown].map(([name, files]) => [name, [...files].sort()])),
  };
}

/**
 * Census of the known-defect markers (tests/helpers/known-defect.ts).
 *
 *   node scripts/dev/known-defects.ts --check               exit 1 on any marker problem below
 *   node scripts/dev/known-defects.ts --list                one line per marker:
 *                                                           ids, until, file, title (tab-separated)
 *   node scripts/dev/known-defects.ts --list <report.json>  the same from a Vitest JSON report
 *                                                           (--reporter=json --outputFile=...),
 *                                                           with each marker's status after until;
 *                                                           exit 1 on a marker with malformed ids,
 *                                                           an until that is not x.y.z or not later
 *                                                           than the package.json version, a title
 *                                                           that does not start with its key, a
 *                                                           status other than "passed" (an expected
 *                                                           failure) or "skipped" (the qpdf marker
 *                                                           skips where qpdf is absent), or a "passed"
 *                                                           without meta.knownDefectMatched (it
 *                                                           failed for another reason than its
 *                                                           failsWith, e.g. a soft assertion)
 *   --root <dir>                                            another checkout (default: this repo)
 *
 * --check applies two sets of rules and exits 1 on a problem from either.
 *
 * The runtime rule is the authoritative one. --check collects (without running)
 * every test file of every project of vitest.config.ts through the installed `vitest/node` API
 * (collectAllTests()) and fails on a collection error, a collected test whose `fails` option is
 * set and whose task meta has no `ledger` (however the file wrote it: a computed option key,
 * Reflect.get on a runner, options parsed at run time), a marker whose task meta has no ids or
 * no until, a title that does not start with `<ids> (until <until>): `, and two markers with
 * the same title.
 *
 * Out of scope: the runtime rule trusts meta.ledger as the test wrote it, so a
 * hand-forged marker that sets the helper's own meta itself (a `fails` test whose options carry
 * a well-formed `meta.ledger`, and whose body sets `meta.knownDefectMatched`) is not detected by
 * the census, in --check or in --list. The backstop is the surface gate's ledger-membership rule:
 * `scripts/dev/surface-gate.ts --markers` requires every id in a marker's meta.ledger to be an
 * open entry of audit/open-highs.json, with its until equal to that entry's target.
 *
 * The static rules are an early warning: they run first, from the source text alone, and name
 * the line; a key or a runner built at run time escapes them, and the runtime rule catches it.
 * They read the source of every tests/**\/*.ts file with oxc-parser and fail on:
 *   - a member named `fails` of any receiver, written `.fails` or computed with a string or
 *     template literal (`test['fails']`, `t.fails` on an alias of test, test.fails.each), a
 *     destructured `fails` (`const { fails } = test`), a `fails` option key (also computed,
 *     `{ ['fails']: true }`), or a member with a non-literal computed key (`test['fa' + 'ils']`)
 *     of `test`, `it`, `describe` or `suite`, of a local name one of them is imported as from
 *     'vitest' (`import { test as spec }`), or of a namespace import of 'vitest'
 *     (`import * as v`: v[name], v.test[name]): a known defect is marked only through
 *     knownDefect();
 *   - a knownDefect() call (under any local name it is imported as from the helper) whose key
 *     is an object literal, through parentheses or a type cast: a hand-built key. Every other
 *     key that defectKey() did not make (a spread copy in a variable, Object.assign) fails at
 *     collection time, where knownDefect() throws, and so fails the runtime rule as a
 *     collection error;
 *   - a defectKey() call whose ids or until are not string literals, are malformed, or name an
 *     until that is not later than the package.json version (the helper's own tests, which
 *     pass malformed keys on purpose and register no marker, are exempt from this rule only).
 *
 * Exports: checkSource() (the static rules over one file, tested by
 * tests/unit/helpers/known-defects-census.test.ts), collectAllTests() (every collected test with
 * its file, project, title, `fails` and `meta.ledger`) and collectMarkers() (the runtime rule:
 * the markers and the problems), tested by tests/unit/helpers/known-defects-collect.test.ts and
 * imported by other gate scripts. The command line runs only when node runs this file directly.
 * Node strips the types, so only erasable syntax is used.
 */
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseSync, Visitor } from 'oxc-parser';
import type {
  Argument,
  CallExpression,
  Expression,
  ModuleExportName,
  Program,
  PropertyKey,
} from 'oxc-parser';
import { createVitest } from 'vitest/node';

const HELPER = 'tests/helpers/known-defect.ts';
// The helper's own tests call defectKey() with malformed keys on purpose; they register no marker.
const HELPER_TESTS = 'tests/unit/helpers/known-defect.test.ts';
/** An import source that names the helper (a relative path, with or without an extension). */
const HELPER_SOURCE = /(?:^|\/)helpers\/known-defect(?:\.[jt]s)?$/;
// The same id and version rules as defectKey() in tests/helpers/known-defect.ts.
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[A-Z]?\d{2,}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const RUNNERS = new Set(['test', 'it', 'describe', 'suite']);

/** A marker: a test whose task meta carries `ledger` (knownDefect() registered it). */
export interface Marker {
  readonly ids: readonly string[];
  readonly until: string;
  readonly file: string;
  readonly title: string;
  readonly status?: string;
  /** From a report: the helper set meta.knownDefectMatched (the failure matched failsWith). */
  readonly matched?: boolean;
}

const repoPath = (root: string, file: string): string =>
  relative(root, resolve(root, file)).replaceAll('\\', '/');

/** -1, 0 or 1 as version a sorts before, with or after version b (x.y.z only). */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

const stringValue = (
  node: Argument | Expression | PropertyKey | null | undefined,
): string | undefined =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;

/** The text of a string literal or of a template literal without substitutions. */
function literalText(
  node: Argument | Expression | PropertyKey | null | undefined,
): string | undefined {
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return stringValue(node);
}

/** The name of a member (`fails` in `test.fails` and in `test['fails']`), if it is static. */
const memberName = (
  computed: boolean,
  property: Expression | { type: string; name?: string },
): string | undefined =>
  computed
    ? literalText(property as Expression)
    : property.type === 'Identifier'
      ? property.name
      : undefined;

/** The expression under any parentheses, type casts and non-null assertions. */
function unwrap(node: Argument): Argument {
  let current: Argument = node;
  while (
    current.type === 'ParenthesizedExpression' ||
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSNonNullExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/** The name at the root of a member chain (`test` in `test.fails.each`), if it is an identifier. */
function rootName(node: Expression): string | undefined {
  let current: Expression = node;
  while (current.type === 'MemberExpression' || current.type === 'CallExpression') {
    current = current.type === 'MemberExpression' ? current.object : current.callee;
  }
  return current.type === 'Identifier' ? current.name : undefined;
}

/** The name of the member right after the root of a chain (`test` in `v.test.fails`), if any. */
function secondName(node: Expression): string | undefined {
  let current: Expression = node;
  let next: string | undefined;
  while (current.type === 'MemberExpression' || current.type === 'CallExpression') {
    if (current.type === 'MemberExpression') {
      next = memberName(current.computed, current.property);
      current = current.object;
    } else {
      next = undefined;
      current = current.callee;
    }
  }
  return next;
}

const exportName = (name: ModuleExportName): string =>
  name.type === 'Literal' ? name.value : name.name;

/**
 * The names a file can reach a Vitest runner by (the global RUNNERS plus each local name a
 * runner is imported as from 'vitest'), the local names of namespace imports of 'vitest', and
 * the local names knownDefect is imported as from the helper.
 */
function importedNames(program: Program): {
  runners: Set<string>;
  namespaces: Set<string>;
  markers: Set<string>;
} {
  const runners = new Set(RUNNERS);
  const namespaces = new Set<string>();
  const markers = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const fromVitest = statement.source.value === 'vitest';
    const fromHelper = HELPER_SOURCE.test(statement.source.value);
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        const imported = exportName(specifier.imported);
        if (fromVitest && RUNNERS.has(imported)) runners.add(specifier.local.name);
        if (fromHelper && imported === 'knownDefect') markers.add(specifier.local.name);
      } else if (fromVitest && specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.add(specifier.local.name);
      }
    }
  }
  return { runners, namespaces, markers };
}

/**
 * The static rules over the source text of one test file: one message per problem, and whether
 * the file imports or calls knownDefect() (then --check collects it).
 */
export function checkSource(
  file: string,
  source: string,
  version: string,
): { problems: string[]; marker: boolean } {
  const problems: string[] = [];
  const result = parseSync(file, source);
  const at = (offset: number): string => `${file}:${source.slice(0, offset).split('\n').length}`;
  for (const error of result.errors) problems.push(`${file}: parse error: ${error.message}`);
  const { runners, namespaces, markers } = importedNames(result.program);
  let marker = markers.size > 0;
  /** The runner a member chain starts from (`test`, `v.test`, or the namespace `v`), if any. */
  const runnerOf = (object: Expression): string | undefined => {
    const name = rootName(object);
    if (name === undefined) return undefined;
    if (runners.has(name)) return name;
    if (!namespaces.has(name)) return undefined;
    if (object.type === 'Identifier') return name;
    const second = secondName(object);
    return second !== undefined && RUNNERS.has(second) ? `${name}.${second}` : undefined;
  };
  new Visitor({
    MemberExpression(node) {
      const name = memberName(node.computed, node.property);
      if (name === 'fails') {
        // Any receiver: an alias (`const t = test; t.fails`) reaches the same runner.
        const receiver = runnerOf(node.object) ?? source.slice(node.object.start, node.object.end);
        problems.push(`${at(node.start)}: ${receiver}.fails outside ${HELPER}: use knownDefect()`);
        return;
      }
      if (name !== undefined || !node.computed || node.property.type === 'Literal') return;
      const runner = runnerOf(node.object);
      if (runner !== undefined) {
        problems.push(`${at(node.start)}: a computed member of ${runner}: use knownDefect()`);
      }
    },
    ObjectPattern(node) {
      for (const property of node.properties) {
        if (property.type !== 'Property') continue;
        const key = property.computed
          ? literalText(property.key)
          : property.key.type === 'Identifier'
            ? property.key.name
            : stringValue(property.key);
        if (key === 'fails') {
          problems.push(`${at(property.start)}: a destructured fails: use knownDefect()`);
        }
      }
    },
    ObjectExpression(node) {
      for (const property of node.properties) {
        if (property.type !== 'Property') continue;
        const key = property.computed
          ? literalText(property.key)
          : property.key.type === 'Identifier'
            ? property.key.name
            : stringValue(property.key);
        if (key === 'fails') {
          problems.push(
            `${at(property.start)}: a 'fails' option outside ${HELPER}: use knownDefect()`,
          );
        }
      }
    },
    CallExpression(node: CallExpression) {
      if (node.callee.type !== 'Identifier') return;
      if (node.callee.name === 'knownDefect' || markers.has(node.callee.name)) {
        marker = true;
        const key = node.arguments[0];
        if (key !== undefined && unwrap(key).type === 'ObjectExpression') {
          problems.push(`${at(key.start)}: a hand-built key: use defectKey()`);
        }
        return;
      }
      if (node.callee.name !== 'defectKey' || file === HELPER_TESTS) return;
      const [idArg, untilArg] = node.arguments;
      const ids =
        idArg?.type === 'ArrayExpression'
          ? idArg.elements.map((e) =>
              e === null || e.type === 'SpreadElement' ? undefined : stringValue(e),
            )
          : [stringValue(idArg)];
      const until = stringValue(untilArg);
      const where = at(node.start);
      if (ids.length === 0 || ids.includes(undefined)) {
        problems.push(`${where}: defectKey() without literal ids`);
      }
      for (const id of ids) {
        if (id !== undefined && !ID.test(id))
          problems.push(`${where}: malformed id ${JSON.stringify(id)}`);
      }
      if (until === undefined) problems.push(`${where}: defectKey() without a literal until`);
      else if (!VERSION.test(until))
        problems.push(`${where}: until ${JSON.stringify(until)} is not x.y.z`);
      else if (compareVersions(until, version) <= 0) {
        problems.push(`${where}: until ${until} is not later than package.json version ${version}`);
      }
    },
  }).visit(result.program);
  return { problems, marker };
}

/** checkSource() over every tests/**\/*.ts file but the helper: the static problems. */
function checkSources(root: string, version: string): string[] {
  const problems: string[] = [];
  for (const file of globSync('tests/**/*.ts', { cwd: root })
    .map((f) => repoPath(root, f))
    .sort()) {
    if (file === HELPER) continue;
    problems.push(
      ...checkSource(file, readFileSync(resolve(root, file), 'utf8'), version).problems,
    );
  }
  return problems;
}

/** One test as Vitest collects it (its file, title, `fails` option and task meta), not run. */
export interface CollectedTest {
  /** The test file, relative to the root, with forward slashes. */
  readonly file: string;
  /** The Vitest project the file belongs to. */
  readonly project: string;
  readonly name: string;
  /** The `fails` option as Vitest resolved it, however the test file wrote it. */
  readonly fails: boolean;
  /** `meta.ledger` as the test registered it (undefined on a test that is not a marker). */
  readonly ledger: unknown;
}

/** What collectAllTests() and collectMarkers() collect. */
export interface CollectOptions {
  /** The Vitest config file (default: `<root>/vitest.config.ts`). */
  readonly config?: string;
  /** Only these files, relative to the root (default: every test file of every project). */
  readonly files?: readonly string[];
}

/**
 * Collects (without running) every test file of every project of the Vitest config through the
 * installed `vitest/node` API and returns each test, with a problem per collection error.
 */
export async function collectAllTests(
  root: string,
  options: CollectOptions = {},
): Promise<{ tests: CollectedTest[]; problems: string[] }> {
  const tests: CollectedTest[] = [];
  const problems: string[] = [];
  if (options.files?.length === 0) return { tests, problems };
  const vitest = await createVitest(
    'test',
    {
      root,
      config: options.config ?? resolve(root, 'vitest.config.ts'),
      watch: false,
    },
    {},
    { stdout: process.stderr },
  );
  try {
    // staticParse: false runs each file's collection phase, so titles built at run time
    // (legacy-0.40.3.test.ts builds them per fixture), options built at run time and the task
    // meta are the real ones.
    const { testModules, unhandledErrors } = await vitest.collect(
      options.files === undefined ? undefined : [...options.files],
      { staticParse: false },
    );
    for (const error of unhandledErrors) problems.push(`collection: ${String(error)}`);
    for (const module of testModules) {
      const file = repoPath(root, module.moduleId);
      for (const error of module.errors())
        problems.push(`${file}: collection failed: ${error.message}`);
      for (const test of module.children.allTests()) {
        tests.push({
          file,
          project: module.project.name,
          name: test.name,
          fails: test.options.fails === true,
          ledger: (test.meta() as { ledger?: unknown }).ledger,
        });
      }
    }
  } finally {
    await vitest.close();
  }
  return { tests, problems };
}

/**
 * The runtime marker rule, the authoritative one: collects every test file through
 * collectAllTests() and returns the markers (tests whose meta carries `ledger`), with a problem
 * for each collection error, each test with `fails` set and no `meta.ledger`, each marker without
 * ids or until, and each marker whose title does not start with its key.
 */
export async function collectMarkers(
  root: string,
  options: CollectOptions = {},
): Promise<{ markers: Marker[]; problems: string[] }> {
  const { tests, problems } = await collectAllTests(root, options);
  const markers: Marker[] = [];
  for (const test of tests) {
    const ledger = test.ledger as { ids?: unknown; until?: unknown } | undefined;
    if (ledger === undefined) {
      if (test.fails) {
        problems.push(`${test.file}: "${test.name}" expects a failure without knownDefect()`);
      }
      continue;
    }
    const ids = Array.isArray(ledger.ids)
      ? ledger.ids.filter((id): id is string => typeof id === 'string')
      : [];
    const until = typeof ledger.until === 'string' ? ledger.until : '';
    if (ids.length === 0 || until === '') {
      problems.push(`${test.file}: "${test.name}" is a marker without ids or until`);
      continue;
    }
    if (!test.name.startsWith(`${ids.join(', ')} (until ${until}): `)) {
      problems.push(`${test.file}: "${test.name}" does not start with its key`);
    }
    markers.push({ ids, until, file: test.file, title: test.name });
  }
  return { markers, problems };
}

/** Markers from a Vitest JSON report: every assertion result whose meta carries `ledger`. */
function reportMarkers(root: string, path: string): Marker[] {
  interface JsonAssertion {
    readonly title: string;
    readonly status: string;
    readonly meta?: {
      readonly ledger?: { readonly ids?: readonly string[]; readonly until?: string };
      readonly knownDefectMatched?: boolean;
    };
  }
  const report = JSON.parse(readFileSync(path, 'utf8')) as {
    testResults: { name: string; assertionResults: JsonAssertion[] }[];
  };
  return report.testResults.flatMap((file) =>
    file.assertionResults.flatMap((a) => {
      const ledger = a.meta?.ledger;
      if (ledger === undefined) return [];
      return [
        {
          ids: ledger.ids ?? [],
          until: ledger.until ?? '',
          file: repoPath(root, file.name),
          title: a.title,
          status: a.status,
          matched: a.meta?.knownDefectMatched === true,
        },
      ];
    }),
  );
}

function duplicateTitles(markers: readonly Marker[]): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const m of markers) {
    const first = seen.get(m.title);
    if (first !== undefined) problems.push(`duplicate title "${m.title}" (${first}, ${m.file})`);
    else seen.set(m.title, m.file);
  }
  return problems;
}

const row = (m: Marker): string =>
  [m.ids.join(', '), m.until, ...(m.status === undefined ? [] : [m.status]), m.file, m.title].join(
    '\t',
  );

const byRow = (a: Marker, b: Marker): number => (row(a) < row(b) ? -1 : row(a) > row(b) ? 1 : 0);

/** The command line; returns the exit code. */
async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      check: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
    },
  });
  const root = resolve(values.root);
  const version = (
    JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
  ).version;

  if (values.check) {
    // The static rules first (an early warning that names the line), then the runtime rule.
    const problems = checkSources(root, version);
    const collected = await collectMarkers(root);
    problems.push(...collected.problems, ...duplicateTitles(collected.markers));
    for (const p of problems) console.error(p);
    const ids = new Set(collected.markers.flatMap((m) => m.ids));
    const files = new Set(collected.markers.map((m) => m.file));
    console.log(
      `${collected.markers.length} markers, ${ids.size} ids, ${files.size} marker files, ${problems.length} problems`,
    );
    return problems.length === 0 ? 0 : 1;
  }
  if (values.list) {
    const report = positionals[0];
    let markers: Marker[];
    const problems: string[] = [];
    if (report === undefined) {
      const collected = await collectMarkers(root);
      markers = collected.markers;
      problems.push(...collected.problems);
    } else {
      markers = reportMarkers(root, report);
      for (const m of markers) {
        const where = `${m.file}: "${m.title}"`;
        if (m.ids.length === 0 || !m.ids.every((id) => ID.test(id))) {
          problems.push(`${where}: malformed id(s)`);
        }
        if (!VERSION.test(m.until)) problems.push(`${where}: until is not x.y.z`);
        else if (compareVersions(m.until, version) <= 0) {
          problems.push(
            `${where}: until ${m.until} is not later than package.json version ${version}`,
          );
        }
        if (!m.title.startsWith(`${m.ids.join(', ')} (until ${m.until}): `)) {
          problems.push(`${where}: does not start with its key`);
        }
        // "skipped" stays accepted: the qpdf marker skips where qpdf is absent locally.
        if (m.status !== 'passed' && m.status !== 'skipped') {
          problems.push(`${where}: did not end as an expected failure (status ${m.status})`);
        } else if (m.status === 'passed' && m.matched !== true) {
          problems.push(
            `${where}: passed as an expected failure for another reason than its failsWith`,
          );
        }
      }
    }
    problems.push(...duplicateTitles(markers));
    for (const m of markers.toSorted(byRow)) console.log(row(m));
    for (const p of problems) console.error(p);
    return problems.length === 0 ? 0 : 1;
  }
  console.error('usage: node scripts/dev/known-defects.ts --check | --list [<vitest-report.json>]');
  return 2;
}

if (import.meta.main) process.exit(await main());

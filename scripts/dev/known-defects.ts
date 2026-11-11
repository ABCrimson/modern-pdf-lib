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
 * --check reads the source of every tests/**\/*.ts file with oxc-parser and fails on:
 *   - a `.fails` member of `test`, `it`, `describe` or `suite`, of a local name one of them is
 *     imported as from 'vitest' (`import { test as spec }`: spec.fails), or of one of them on a
 *     namespace import of 'vitest' (`import * as v`: v.test.fails), including chains such as
 *     test.fails.each, or a `fails` option key: a known defect is marked only through
 *     knownDefect();
 *   - a defectKey() call whose ids or until are not string literals, are malformed, or name an
 *     until that is not later than the package.json version (the helper's own tests, which
 *     pass malformed keys on purpose and register no marker, are exempt from this rule only).
 * It then collects (without running) the test files that call knownDefect() through the
 * installed `vitest/node` API, and fails on a marker whose task meta has no ids or no until, a
 * title that does not start with `<ids> (until <until>): `, an expected-failure test without the
 * marker meta, and two markers with the same title.
 *
 * Node strips the types, so only erasable syntax is used.
 */
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseSync, Visitor } from 'oxc-parser';
import type { Argument, CallExpression, Expression, ModuleExportName, Program } from 'oxc-parser';
import { createVitest } from 'vitest/node';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    check: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
  },
});

const ROOT = resolve(values.root);
const HELPER = 'tests/helpers/known-defect.ts';
// The helper's own tests call defectKey() with malformed keys on purpose; they register no marker.
const HELPER_TESTS = 'tests/unit/helpers/known-defect.test.ts';
// The same id and version rules as defectKey() in tests/helpers/known-defect.ts.
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[A-Z]?\d{2,}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const RUNNERS = new Set(['test', 'it', 'describe', 'suite']);

interface Marker {
  readonly ids: readonly string[];
  readonly until: string;
  readonly file: string;
  readonly title: string;
  readonly status?: string;
  /** From a report: the helper set meta.knownDefectMatched (the failure matched failsWith). */
  readonly matched?: boolean;
}

const repoPath = (file: string): string =>
  relative(ROOT, resolve(ROOT, file)).replaceAll('\\', '/');

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

const stringValue = (node: Argument | Expression | null | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;

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
      next = current.computed
        ? stringValue(current.property)
        : current.property.type === 'Identifier'
          ? current.property.name
          : undefined;
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
 * The names a file can reach a Vitest runner by: the global RUNNERS plus each local name a
 * runner is imported as from 'vitest', and the local names of namespace imports of 'vitest'.
 */
function vitestImports(program: Program): { runners: Set<string>; namespaces: Set<string> } {
  const runners = new Set(RUNNERS);
  const namespaces = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'vitest') continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier' && RUNNERS.has(exportName(specifier.imported))) {
        runners.add(specifier.local.name);
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.add(specifier.local.name);
      }
    }
  }
  return { runners, namespaces };
}

/** Static rules over the source text: one message per problem, and the files that call knownDefect(). */
function checkSources(version: string): { problems: string[]; markerFiles: string[] } {
  const problems: string[] = [];
  const markerFiles: string[] = [];
  for (const file of globSync('tests/**/*.ts', { cwd: ROOT }).map(repoPath).sort()) {
    if (file === HELPER) continue;
    const source = readFileSync(resolve(ROOT, file), 'utf8');
    const result = parseSync(file, source);
    const at = (offset: number): string => `${file}:${source.slice(0, offset).split('\n').length}`;
    for (const error of result.errors) problems.push(`${file}: parse error: ${error.message}`);
    let callsKnownDefect = false;
    const { runners, namespaces } = vitestImports(result.program);
    new Visitor({
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') return;
        if (node.property.name !== 'fails') return;
        const name = rootName(node.object);
        if (name === undefined) return;
        const second = namespaces.has(name) ? secondName(node.object) : undefined;
        const runner = runners.has(name)
          ? name
          : second !== undefined && RUNNERS.has(second)
            ? `${name}.${second}`
            : undefined;
        if (runner !== undefined) {
          problems.push(`${at(node.start)}: ${runner}.fails outside ${HELPER}: use knownDefect()`);
        }
      },
      ObjectExpression(node) {
        for (const property of node.properties) {
          if (property.type !== 'Property' || property.computed) continue;
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : stringValue(property.key as Expression);
          if (key === 'fails') {
            problems.push(
              `${at(property.start)}: a 'fails' option outside ${HELPER}: use knownDefect()`,
            );
          }
        }
      },
      CallExpression(node: CallExpression) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name === 'knownDefect') callsKnownDefect = true;
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
          problems.push(
            `${where}: until ${until} is not later than package.json version ${version}`,
          );
        }
      },
    }).visit(result.program);
    if (callsKnownDefect) markerFiles.push(file);
  }
  return { problems, markerFiles };
}

/** Collects (without running) the given files and returns their markers and any problems. */
async function collectMarkers(
  files: readonly string[],
): Promise<{ markers: Marker[]; problems: string[] }> {
  const markers: Marker[] = [];
  const problems: string[] = [];
  if (files.length === 0) return { markers, problems };
  const vitest = await createVitest(
    'test',
    { root: ROOT, config: resolve(ROOT, 'vitest.config.ts'), watch: false },
    {},
    { stdout: process.stderr },
  );
  try {
    // staticParse: false runs each file's collection phase, so titles built at run time
    // (legacy-0.40.3.test.ts builds them per fixture) and the task meta are the real ones.
    const { testModules, unhandledErrors } = await vitest.collect([...files], {
      staticParse: false,
    });
    for (const error of unhandledErrors) problems.push(`collection: ${String(error)}`);
    for (const module of testModules) {
      const file = repoPath(module.moduleId);
      for (const error of module.errors())
        problems.push(`${file}: collection failed: ${error.message}`);
      for (const test of module.children.allTests()) {
        const ledger = (test.meta() as { ledger?: { ids?: unknown; until?: unknown } }).ledger;
        if (ledger === undefined) {
          if (test.options.fails === true) {
            problems.push(`${file}: "${test.name}" expects a failure without knownDefect()`);
          }
          continue;
        }
        const ids = Array.isArray(ledger.ids)
          ? ledger.ids.filter((id) => typeof id === 'string')
          : [];
        const until = typeof ledger.until === 'string' ? ledger.until : '';
        if (ids.length === 0 || until === '') {
          problems.push(`${file}: "${test.name}" is a marker without ids or until`);
          continue;
        }
        if (!test.name.startsWith(`${ids.join(', ')} (until ${until}): `)) {
          problems.push(`${file}: "${test.name}" does not start with its key`);
        }
        markers.push({ ids, until, file, title: test.name });
      }
    }
  } finally {
    await vitest.close();
  }
  return { markers, problems };
}

/** Markers from a Vitest JSON report: every assertion result whose meta carries `ledger`. */
function reportMarkers(path: string): Marker[] {
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
          file: repoPath(file.name),
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

const version = (
  JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string }
).version;

if (values.check) {
  const { problems, markerFiles } = checkSources(version);
  const collected = await collectMarkers(markerFiles);
  problems.push(...collected.problems, ...duplicateTitles(collected.markers));
  for (const p of problems) console.error(p);
  const ids = new Set(collected.markers.flatMap((m) => m.ids));
  console.log(
    `${collected.markers.length} markers, ${ids.size} ids, ${markerFiles.length} files, ${problems.length} problems`,
  );
  process.exit(problems.length === 0 ? 0 : 1);
} else if (values.list) {
  const report = positionals[0];
  let markers: Marker[];
  const problems: string[] = [];
  if (report === undefined) {
    const collected = await collectMarkers(checkSources(version).markerFiles);
    markers = collected.markers;
    problems.push(...collected.problems);
  } else {
    markers = reportMarkers(report);
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
      // "skipped" stays accepted: the qpdf marker skips where qpdf is absent locally (ruling E4).
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
  process.exit(problems.length === 0 ? 0 : 1);
} else {
  console.error('usage: node scripts/dev/known-defects.ts --check | --list [<vitest-report.json>]');
  process.exit(2);
}

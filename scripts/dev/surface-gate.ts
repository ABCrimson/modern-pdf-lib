/**
 * G-SURF: checks the public findings ledger (audit/open-highs.json) and the known-defect markers
 * in the tests against it.
 *
 *   node scripts/dev/surface-gate.ts                   the three checks below
 *   node scripts/dev/surface-gate.ts --paths           the ledger: schema (audit/open-highs.schema.json,
 *                                                      checked by hand: field types and enums, x.y.z
 *                                                      versions, ids unique across open and closed,
 *                                                      counts equal to the recomputed counts) and every
 *                                                      open[].path exists (wiki:<Page>.md is exempt)
 *   node scripts/dev/surface-gate.ts --markers         the markers as Vitest collects them:
 *                                                      known-defects.ts collectMarkers() collects,
 *                                                      without running, every test file of every
 *                                                      project of vitest.config.ts; every id in a
 *                                                      marker's meta.ledger must be an entry of `open`
 *                                                      and its until must equal that entry's target.
 *                                                      A collection problem of the census (a collection
 *                                                      error, a `fails` test without meta.ledger, a
 *                                                      title that does not start with its key) fails
 *                                                      this check too. Prints the census: id, until,
 *                                                      number of marker tests, files
 *   node scripts/dev/surface-gate.ts --surface         every export the snapshot
 *                                                      (tests/oracle/packaging/exports.api.json) adds
 *                                                      since the previous release (api-snapshot.ts
 *                                                      previousReleaseRef(): its tag, else the commit
 *                                                      that set its version; the working-tree file
 *                                                      when that ref has no snapshot) must not reach
 *                                                      the path of an open
 *                                                      ledger entry: esbuild bundles
 *                                                      `export { <name> } from './src/<entry>.ts'`
 *                                                      with tree shaking and the metafile, and every
 *                                                      src input with bytesInOutput > 0 is reached.
 *                                                      Exempt: a docs/capabilities.json row whose
 *                                                      `exports` lists the name, whose grade is
 *                                                      `qualified` and whose `limits` names that
 *                                                      entry's id. Type-only additions carry no code
 *                                                      and are not bundled
 *   node scripts/dev/surface-gate.ts --self-test       runs the --surface code path on a fake addition
 *                                                      (createPdf of `.`): its reached set must hold
 *                                                      src/core/pdfDocument.ts, a fake open entry on
 *                                                      that path must fail it, and a qualified
 *                                                      capability row must exempt it
 *   --ledger <file>   another ledger file (default: audit/open-highs.json)
 *   --root <dir>      another checkout to scan and resolve paths in (default: this repo)
 *
 * Exit 1 on any problem, each printed with the offending item. The static source rules on
 * markers are known-defects.ts --check's early warning, not this gate's. Node strips the types,
 * so only erasable syntax is used.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

const { values } = parseArgs({
  options: {
    paths: { type: 'boolean', default: false },
    markers: { type: 'boolean', default: false },
    surface: { type: 'boolean', default: false },
    'self-test': { type: 'boolean', default: false },
    ledger: { type: 'string' },
    root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
  },
});

const ROOT = resolve(values.root);
const LEDGER = resolve(ROOT, values.ledger ?? 'audit/open-highs.json');
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[A-Z]?\d{2,}$/;
const AREA = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PATH = /^(wiki:[A-Za-z0-9-]+\.md|[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*)$/;
const SEVERITIES = new Set(['high', 'medium']);
const STATUSES = new Set(['confirmed', 'missed', 'unverified']);
const OPEN_KEYS = ['id', 'area', 'severity', 'status', 'path', 'target', 'summary'];
const TOP_KEYS = ['$schema', 'release', 'generated', 'source', 'counts', 'open', 'closed'];

interface OpenEntry {
  readonly id: string;
  readonly area: string;
  readonly severity: string;
  readonly status: string;
  readonly path: string;
  readonly target: string;
  readonly summary: string;
}

const problems: string[] = [];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

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

/** Keys of `object` outside `allowed`, and keys of `required` missing from it. */
function keyProblems(
  where: string,
  object: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) problems.push(`${where}: unknown key ${JSON.stringify(key)}`);
  }
  for (const key of required) {
    if (!(key in object)) problems.push(`${where}: missing key ${JSON.stringify(key)}`);
  }
}

function checkString(where: string, value: unknown, pattern?: RegExp): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    problems.push(`${where}: not a non-empty string`);
    return false;
  }
  if (pattern !== undefined && !pattern.test(value)) {
    problems.push(`${where}: ${JSON.stringify(value)} does not match ${String(pattern)}`);
    return false;
  }
  return true;
}

/** Reads the ledger; with `full`, checks it against the schema rules and the tree. */
function readLedger(full: boolean): OpenEntry[] {
  const name = relative(ROOT, LEDGER).replaceAll('\\', '/');
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch (error) {
    problems.push(
      `${name}: cannot read: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
  if (!isRecord(data) || !Array.isArray(data.open) || !Array.isArray(data.closed)) {
    problems.push(`${name}: not an object with open and closed arrays`);
    return [];
  }
  const open = data.open.filter(isRecord) as unknown as OpenEntry[];
  if (!full) return open;

  keyProblems(name, data, TOP_KEYS, TOP_KEYS);
  if (data.$schema !== './open-highs.schema.json')
    problems.push(`${name}: $schema is not ./open-highs.schema.json`);
  checkString(`${name}: release`, data.release, VERSION);
  checkString(`${name}: generated`, data.generated, DATE);
  checkString(`${name}: source`, data.source);

  const seen = new Set<string>();
  const unique = (where: string, id: string): void => {
    if (seen.has(id)) problems.push(`${where}: id ${id} occurs twice`);
    seen.add(id);
  };
  data.open.forEach((entry: unknown, i: number) => {
    const where = `${name}: open[${i}]`;
    if (!isRecord(entry)) {
      problems.push(`${where}: not an object`);
      return;
    }
    keyProblems(where, entry, OPEN_KEYS, OPEN_KEYS);
    const label = `${where} (${String(entry.id)})`;
    if (checkString(`${label} id`, entry.id, ID)) unique(label, entry.id);
    checkString(`${label} area`, entry.area, AREA);
    if (!SEVERITIES.has(entry.severity as string))
      problems.push(`${label}: severity ${JSON.stringify(entry.severity)}`);
    if (!STATUSES.has(entry.status as string))
      problems.push(`${label}: status ${JSON.stringify(entry.status)}`);
    checkString(`${label} target`, entry.target, VERSION);
    checkString(`${label} summary`, entry.summary);
    if (checkString(`${label} path`, entry.path, PATH) && !entry.path.startsWith('wiki:')) {
      if (!existsSync(resolve(ROOT, entry.path)))
        problems.push(`${label}: path ${entry.path} does not exist`);
    }
  });
  let closedThisRelease = 0;
  data.closed.forEach((entry: unknown, i: number) => {
    const where = `${name}: closed[${i}]`;
    if (!isRecord(entry)) {
      problems.push(`${where}: not an object`);
      return;
    }
    keyProblems(where, entry, ['id', 'fixedIn', 'refuted'], ['id']);
    const label = `${where} (${String(entry.id)})`;
    if (checkString(`${label} id`, entry.id, ID)) unique(label, entry.id);
    const fixed = 'fixedIn' in entry;
    const refuted = 'refuted' in entry;
    if (fixed === refuted) problems.push(`${label}: needs exactly one of fixedIn and refuted`);
    if (
      fixed &&
      checkString(`${label} fixedIn`, entry.fixedIn, VERSION) &&
      entry.fixedIn === data.release
    ) {
      closedThisRelease++;
    }
    if (refuted && entry.refuted !== true) problems.push(`${label}: refuted must be true`);
  });

  // counts must equal what the entries say.
  const counts = data.counts;
  if (!isRecord(counts)) {
    problems.push(`${name}: counts is not an object`);
    return open;
  }
  keyProblems(
    `${name}: counts`,
    counts,
    ['open', 'closedThisRelease', 'byTarget'],
    ['open', 'closedThisRelease', 'byTarget'],
  );
  if (counts.open !== data.open.length)
    problems.push(
      `${name}: counts.open ${String(counts.open)}, but open has ${data.open.length} entries`,
    );
  if (counts.closedThisRelease !== closedThisRelease) {
    problems.push(
      `${name}: counts.closedThisRelease ${String(counts.closedThisRelease)}, but ${closedThisRelease} closed entries have fixedIn ${String(data.release)}`,
    );
  }
  const byTarget = new Map<string, number>();
  for (const entry of open) {
    if (typeof entry.target === 'string')
      byTarget.set(entry.target, (byTarget.get(entry.target) ?? 0) + 1);
  }
  const expected = [...byTarget].toSorted(([a], [b]) => compareVersions(a, b));
  const actual = isRecord(counts.byTarget) ? Object.entries(counts.byTarget) : [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    problems.push(
      `${name}: counts.byTarget is not the open entries per target in ascending version order: expected ${JSON.stringify(Object.fromEntries(expected))}`,
    );
  }
  return open;
}

// ---------------------------------------------------------------------------
// --markers
// ---------------------------------------------------------------------------

/**
 * known-defects.ts, loaded by URL like api-snapshot.ts below: node runs the .ts file itself, while
 * scripts/tsconfig.json (no allowImportingTsExtensions) types it through the `.js` specifier.
 */
type KnownDefectsModule = typeof import('./known-defects.js');

/**
 * The markers of the test suite as Vitest collects them: known-defects.ts
 * collectMarkers() collects every test file of every project without running it, so a key built
 * at run time is seen as the helper registered it. Its collection problems are this gate's too.
 */
async function runtimeMarkers(): Promise<
  Awaited<ReturnType<KnownDefectsModule['collectMarkers']>>['markers']
> {
  const census = (await import(
    new URL('./known-defects.ts', import.meta.url).href
  )) as KnownDefectsModule;
  const { markers, problems: collected } = await census.collectMarkers(ROOT);
  problems.push(...collected);
  return markers;
}

// ---------------------------------------------------------------------------
// --surface
// ---------------------------------------------------------------------------

/**
 * api-snapshot.ts, loaded by URL: node runs the .ts file itself, while scripts/tsconfig.json
 * (no allowImportingTsExtensions) types it through the `.js` specifier.
 */
type ApiSnapshotModule = typeof import('./api-snapshot.js');

/** package.json `exports` key -> its source entry (tsdown.config.ts `entry`). */
const ENTRY_SOURCES: Readonly<Record<string, string>> = {
  '.': 'src/index.ts',
  './create': 'src/create.ts',
  './parse': 'src/parse.ts',
  './forms': 'src/forms.ts',
  './browser': 'src/browser.ts',
};
const RUNTIME_KINDS = new Set(['function', 'class', 'const', 'enum', 'namespace']);

interface Addition {
  readonly entry: string;
  readonly name: string;
  readonly kind: string;
}

interface CapabilityRow {
  readonly id: string;
  readonly grade: string;
  readonly limits: readonly string[];
  readonly exports?: readonly string[];
}

/** The src files whose code a bundle of one export keeps (bytesInOutput > 0), sorted. */
async function reachedSources(entry: string, name: string): Promise<string[]> {
  const source = ENTRY_SOURCES[entry];
  if (source === undefined) throw new Error(`no source entry for ${entry}`);
  const result = await build({
    stdin: {
      contents: `export { ${name} } from './${source}';`,
      resolveDir: ROOT,
      sourcefile: 'surface-gate-entry.ts',
      loader: 'ts',
    },
    absWorkingDir: ROOT,
    bundle: true,
    write: false,
    outfile: 'surface-gate-out.js',
    metafile: true,
    treeShaking: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
    logLevel: 'silent',
  });
  const reached = new Set<string>();
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
      const path = input.replaceAll('\\', '/');
      if (bytesInOutput > 0 && path.startsWith('src/')) reached.add(path);
    }
  }
  return [...reached].sort();
}

/** One problem per (addition, open entry whose path the addition reaches) without an exemption. */
async function surfaceProblems(
  additions: readonly Addition[],
  openEntries: readonly OpenEntry[],
  rows: readonly CapabilityRow[],
): Promise<{ problems: string[]; reached: Map<string, string[]> }> {
  const out: string[] = [];
  const reachedBy = new Map<string, string[]>();
  for (const add of additions) {
    if (!RUNTIME_KINDS.has(add.kind)) continue;
    const files = new Set(await reachedSources(add.entry, add.name));
    reachedBy.set(`${add.entry} ${add.name}`, [...files]);
    for (const entry of openEntries) {
      if (!files.has(entry.path)) continue;
      const exempt = rows.some(
        (r) =>
          r.grade === 'qualified' &&
          r.limits.includes(entry.id) &&
          (r.exports ?? []).includes(add.name),
      );
      if (!exempt) {
        out.push(
          `surface: new export ${add.entry} ${add.name} reaches ${entry.path}, open as ${entry.id}; ` +
            'qualify it in docs/capabilities.json (exports, grade qualified, limits) or fix it first',
        );
      }
    }
  }
  return { problems: out, reached: reachedBy };
}

function readCapabilityRows(): CapabilityRow[] {
  const file = resolve(ROOT, 'docs/capabilities.json');
  if (!existsSync(file)) return [];
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isRecord(data) || !Array.isArray(data.rows)) {
    problems.push('docs/capabilities.json: not an object with a rows array');
    return [];
  }
  return data.rows.filter(isRecord).map((r) => ({
    id: String(r.id),
    grade: String(r.grade),
    limits: Array.isArray(r.limits) ? r.limits.map(String) : [],
    ...(Array.isArray(r.exports) ? { exports: r.exports.map(String) } : {}),
  }));
}

/** Names of the working-tree snapshot that the previous release's snapshot lacks. */
async function snapshotAdditions(): Promise<{ since: string; additions: Addition[] }> {
  const api = (await import(
    new URL('./api-snapshot.ts', import.meta.url).href
  )) as ApiSnapshotModule;
  const ref = api.previousReleaseRef(ROOT);
  const current = api.workingSnapshot(ROOT);
  const baseline = (ref === undefined ? undefined : api.snapshotAtRef(ref, ROOT)) ?? current;
  const additions: Addition[] = [];
  for (const [entry, e] of Object.entries(current.entries)) {
    if (!('names' in e)) continue;
    const before = baseline.entries[entry];
    const known = before !== undefined && 'names' in before ? before.names : {};
    for (const [name, { kind }] of Object.entries(e.names)) {
      if (!Object.hasOwn(known, name)) additions.push({ entry, name, kind });
    }
  }
  const since =
    ref === undefined
      ? 'no previous release'
      : baseline === current
        ? `${ref} (no snapshot at that ref: baseline is the working-tree file)`
        : ref;
  return { since, additions };
}

async function selfTest(): Promise<void> {
  const fake: Addition[] = [{ entry: '.', name: 'createPdf', kind: 'function' }];
  const target = 'src/core/pdfDocument.ts';
  const entry: OpenEntry = {
    id: 'self-test-01',
    area: 'self-test',
    severity: 'high',
    status: 'confirmed',
    path: target,
    target: '9.9.9',
    summary: 'self-test entry',
  };
  const reached = await reachedSources('.', 'createPdf');
  if (!reached.includes(target))
    problems.push(`self-test: createPdf does not reach ${target} (${reached.length} files)`);
  const failing = await surfaceProblems(fake, [entry], []);
  if (failing.problems.length !== 1)
    problems.push(`self-test: an open entry on ${target} gave ${failing.problems.length} problems`);
  const row: CapabilityRow = {
    id: 'cap-self-test',
    grade: 'qualified',
    limits: [entry.id],
    exports: ['createPdf'],
  };
  const exempt = await surfaceProblems(fake, [entry], [row]);
  if (exempt.problems.length !== 0)
    problems.push(`self-test: a qualified capability row did not exempt createPdf`);
  console.log(`self-test: createPdf reaches ${reached.length} src files, ${target} among them`);
}

const all = !values.paths && !values.markers && !values.surface && !values['self-test'];
const open = readLedger(all || values.paths);
let census = '';
if (all || values.markers) {
  const targets = new Map(open.map((e) => [e.id, e.target]));
  const byId = new Map<string, { until: Set<string>; tests: number; files: Set<string> }>();
  const markers = await runtimeMarkers();
  for (const marker of markers) {
    const where = `${marker.file}: "${marker.title}"`;
    for (const id of marker.ids) {
      const target = targets.get(id);
      if (target === undefined)
        problems.push(`${where}: marker id ${id} is not an open entry of the ledger`);
      else if (marker.until !== target)
        problems.push(
          `${where}: marker ${id} has until ${marker.until}, the ledger target is ${target}`,
        );
      const row = byId.get(id) ?? { until: new Set<string>(), tests: 0, files: new Set<string>() };
      row.until.add(marker.until);
      row.tests++;
      row.files.add(marker.file);
      byId.set(id, row);
    }
  }
  const rows = [...byId].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  census = rows
    .map(([id, r]) =>
      [
        id,
        [...r.until].join(','),
        String(r.tests),
        [...r.files].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(' '),
      ].join('\t'),
    )
    .join('\n');
  if (census !== '') console.log(census);
  console.log(
    `markers: ${rows.length} ids, ${markers.length} marker tests (a marker test counts once per id above)`,
  );
}
if (all || values.paths) console.log(`ledger: ${open.length} open entries`);
if (all || values.surface) {
  const { since, additions } = await snapshotAdditions();
  const result = await surfaceProblems(additions, open, readCapabilityRows());
  problems.push(...result.problems);
  for (const [name, files] of result.reached)
    console.log(`${name}: reaches ${files.length} src files`);
  console.log(`surface: ${additions.length} exports added since ${since}`);
}
if (values['self-test']) await selfTest();
for (const p of problems) console.error(p);
console.log(
  problems.length === 0 ? 'surface-gate: ok' : `surface-gate: ${problems.length} problems`,
);
process.exit(problems.length === 0 ? 0 : 1);

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
 *   node scripts/dev/surface-gate.ts --layout          the internal-folder rule of the src layout, as the
 *                                                      exports show it, in both directions: a module that
 *                                                      no package entry exports from lives in an
 *                                                      internal/ folder, and no entry exports from a
 *                                                      module in an internal/ folder, which is flat.
 *                                                      Not checked: which internal/ folder a module sits
 *                                                      in and which modules import it. Placement advice
 *                                                      only: src/<domain>/internal/, or src/internal/
 *                                                      when three or more domains use it. "Exports from":
 *                                                      an export of src/{index,create,parse,forms,
 *                                                      browser}.ts resolves, through `export ... from`,
 *                                                      `export *`, `export * as` and imported bindings
 *                                                      it re-exports (types included), to a declaration
 *                                                      of that module or passes through it. Exempt: the
 *                                                      five entries, folder barrels (index.ts), src/cli
 *                                                      (the bin entry), .d.ts files and the modules of
 *                                                      LAYOUT_EXCEPTIONS (each with its reason and the
 *                                                      end the gate checks: the id of the open ledger
 *                                                      entry whose closing ends it, no src module
 *                                                      importing it, or no other module in its folder; a
 *                                                      listed path that is missing or that an entry
 *                                                      exports from, a listed id that is not open in the
 *                                                      ledger, a src module that imports a module listed
 *                                                      as unimported, and a second module in the folder
 *                                                      of a module listed as alone in it are problems).
 *                                                      Each problem names a move that fixes it
 *   node scripts/dev/surface-gate.ts --self-test       runs the --surface code path on a fake addition
 *                                                      (createPdf of `.`): its reached set must hold
 *                                                      src/core/pdfDocument.ts, a fake open entry on
 *                                                      that path must fail it, and a qualified
 *                                                      capability row must exempt it; and runs the
 *                                                      --layout rules on a synthetic tree, which must
 *                                                      report exactly its nine planted problems
 *   --ledger <file>   another ledger file (default: audit/open-highs.json)
 *   --root <dir>      another checkout to scan and resolve paths in (default: this repo)
 *
 * Exit 1 on any problem, each printed with the offending item. The static source rules on
 * markers are known-defects.ts --check's early warning, not this gate's. Node strips the types,
 * so only erasable syntax is used.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { posix, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { parseSync } from 'oxc-parser';

const { values } = parseArgs({
  options: {
    paths: { type: 'boolean', default: false },
    markers: { type: 'boolean', default: false },
    surface: { type: 'boolean', default: false },
    layout: { type: 'boolean', default: false },
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
  // metrics: synthetic paths start
  const fakeTree = new Map<string, string>([
    [
      'src/index.ts',
      [
        "export { a } from './dom/a.js';",
        "export * from './dom/fwd.js';",
        "import { d } from './dom/d.js';",
        'export { d };',
        "export { leak } from './dom/internal/leak.js';",
        "export * as ns from './dom/ns.js';",
        "export type { T } from './dom/t.js';",
        "export { other } from './dom/solo/other.js';",
      ].join('\n'),
    ],
    ['src/dom/a.ts', 'export const a = 1;'],
    ['src/dom/fwd.ts', "export { b } from './b.js';"],
    ['src/dom/b.ts', 'export const b = 2;'],
    ['src/dom/d.ts', "import { s } from './shaper.js';\nexport const d = s;"],
    ['src/dom/shaper.ts', 'export const s = 3;'],
    ['src/dom/solo/only.ts', 'export const only = 12;'],
    ['src/dom/solo/other.ts', 'export const other = 13;'],
    ['src/dom/lone/one.ts', 'export const one = 14;'],
    ['src/dom/ns.ts', "export { n } from './n.js';"],
    ['src/dom/n.ts', 'export const n = 4;'],
    ['src/dom/t.ts', 'export interface T { readonly x: number }'],
    ['src/dom/internal/leak.ts', 'export const leak = 5;'],
    ['src/dom/internal/helper.ts', 'export const helper = 6;'],
    ['src/dom/internal/deep/x.ts', 'export const x = 7;'],
    ['src/dom/orphan.ts', 'export const orphan = 8;'],
    ['src/dom/kept.ts', 'export const kept = 9;'],
    ['src/dom/held.ts', 'export const held = 10;'],
    ['src/dom/stale.ts', 'export const stale = 11;'],
  ]);
  const fakeExceptions: readonly LayoutException[] = [
    { path: 'src/dom/kept.ts', reason: 'a valid exception', ledger: 'dom-01', unimported: true },
    { path: 'src/dom/gone.ts', reason: 'a missing path' },
    { path: 'src/dom/a.ts', reason: 'a path an entry exports from' },
    { path: 'src/dom/held.ts', reason: 'its ledger entry is closed', ledger: 'dom-02' },
    { path: 'src/dom/stale.ts', reason: 'its ledger id is in neither list', ledger: 'dom-03' },
    { path: 'src/dom/shaper.ts', reason: 'a src module imports it', unimported: true },
    {
      path: 'src/dom/solo/only.ts',
      reason: 'its folder holds another module',
      aloneIn: 'src/dom/solo/',
    },
    { path: 'src/dom/lone/one.ts', reason: 'alone in its folder, valid', aloneIn: 'src/dom/lone/' },
  ];
  const fakeLedger = { open: new Set(['dom-01']), closed: new Set(['dom-02']) };
  const layout = layoutProblems(fakeTree, fakeLedger, fakeExceptions);
  const flagged = layout.map((p) => p.slice(0, p.indexOf(':'))).join(' ');
  const want =
    'src/dom/a.ts src/dom/gone.ts src/dom/held.ts src/dom/internal/deep/x.ts src/dom/internal/leak.ts src/dom/orphan.ts src/dom/shaper.ts src/dom/solo/only.ts src/dom/stale.ts';
  // metrics: synthetic paths end
  if (flagged !== want)
    problems.push(`self-test: --layout flagged "${flagged}", expected "${want}"`);
  console.log(
    `self-test: --layout finds the ${layout.length} planted problems of a synthetic tree`,
  );
}

/** A src module that stays outside an internal/ folder although no package entry exports from it. */
interface LayoutException {
  readonly path: string;
  readonly reason: string;
  /** the id of the open entry of the ledger (audit/open-highs.json) whose closing ends the exception */
  readonly ledger?: string;
  /** the exception ends when a src module imports it (an import, a re-export or a dynamic import of a literal) */
  readonly unimported?: true;
  /** the exception ends when this folder holds another module */
  readonly aloneIn?: string;
}

/**
 * The exceptions of --layout; a listed path that is missing or that an entry exports from is a
 * problem, and so is an end that has come (a closed or unknown ledger id, an importer of an
 * unimported module, a second module in the folder of a module alone in it).
 */
const LAYOUT_EXCEPTIONS: readonly LayoutException[] = [
  {
    path: 'src/assets/font/textShaper.ts',
    reason: 'kept until the WASM shaping tier is either wired into text layout or removed',
    unimported: true,
  },
  {
    path: 'src/assets/image/jpeg/jpegEmbed.ts',
    reason: 'kept until its Adobe APP14 handling moves into the live JPEG embed path',
    ledger: 'images-46',
  },
  {
    path: 'src/codecs/jbig2/jbig2Decode.ts',
    reason: 'the conformant JBIG2 decoder that replaces it lands in this folder',
    aloneIn: 'src/codecs/jbig2/',
  },
];

/** The five package entries (ENTRY_SOURCES). */
const ENTRY_FILES: readonly string[] = Object.values(ENTRY_SOURCES);

/** A module of --layout: its exports by name and the targets of its `export *`. */
interface LayoutModule {
  /** export name -> the module and name it forwards to (`*`: the namespace), or null: declared here */
  readonly named: Map<string, { readonly from: string; readonly name: string } | null>;
  readonly stars: readonly string[];
  /** the src modules it imports or re-exports from, and those it imports dynamically by a literal */
  readonly imports: ReadonlySet<string>;
}

/** A relative specifier of `from` as a module of `files` (.js -> .ts, a folder -> its index.ts). */
function resolveModule(from: string, spec: string, files: ReadonlySet<string>): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = posix.join(posix.dirname(from), spec);
  const stem = base.replace(/\.(js|ts|mjs|mts)$/, '');
  for (const c of [`${stem}.ts`, `${stem}.mts`, `${base}/index.ts`, `${stem}/index.ts`])
    if (files.has(c)) return c;
  return undefined;
}

/** The kind of an oxc-parser name (a const enum in its types, a string at run time). */
const kindOf = (k: unknown): string => String(k);

function layoutModules(
  sources: ReadonlyMap<string, string>,
  out: string[],
): Map<string, LayoutModule> {
  const files = new Set(sources.keys());
  const mods = new Map<string, LayoutModule>();
  for (const [file, text] of sources) {
    const { module, errors } = parseSync(file, text, { lang: 'ts', sourceType: 'module' });
    if (errors.length > 0) out.push(`${file}: parse error: ${errors[0]?.message ?? ''}`);
    const imports = new Map<string, { readonly from: string; readonly name: string }>();
    const deps = new Set<string>();
    for (const dyn of module.dynamicImports) {
      const literal = /^(['"`])([^'"`$]*)\1$/.exec(
        text.slice(dyn.moduleRequest.start, dyn.moduleRequest.end),
      );
      const from = literal === null ? undefined : resolveModule(file, literal[2] ?? '', files);
      if (from !== undefined) deps.add(from);
    }
    for (const imp of module.staticImports) {
      const from = resolveModule(file, imp.moduleRequest.value, files);
      if (from === undefined) continue;
      deps.add(from);
      for (const e of imp.entries) {
        const kind = kindOf(e.importName.kind);
        const name =
          kind === 'Name' ? (e.importName.name ?? 'default') : kind === 'Default' ? 'default' : '*';
        imports.set(e.localName.value, { from, name });
      }
    }
    const named = new Map<string, { readonly from: string; readonly name: string } | null>();
    const stars: string[] = [];
    for (const exp of module.staticExports)
      for (const e of exp.entries) {
        const from =
          e.moduleRequest === null ? undefined : resolveModule(file, e.moduleRequest.value, files);
        if (e.moduleRequest !== null && from === undefined) continue; // a package, not a src module
        if (from !== undefined) deps.add(from);
        const importKind = kindOf(e.importName.kind);
        if (importKind === 'AllButDefault') {
          if (from !== undefined) stars.push(from);
          continue;
        }
        const exportName = kindOf(e.exportName.kind) === 'Default' ? 'default' : e.exportName.name;
        if (exportName === null) continue;
        if (from !== undefined)
          named.set(exportName, {
            from,
            name: importKind === 'All' ? '*' : (e.importName.name ?? 'default'),
          });
        else {
          const local = e.localName.name;
          named.set(exportName, local === null ? null : (imports.get(local) ?? null));
        }
      }
    mods.set(file, { named, stars, imports: deps });
  }
  return mods;
}

/** The internal-folder rule on a set of src modules (path -> source text): one line per problem, with its fix. */
function layoutProblems(
  sources: ReadonlyMap<string, string>,
  ledger: { readonly open: ReadonlySet<string>; readonly closed: ReadonlySet<string> },
  exceptions: readonly LayoutException[] = LAYOUT_EXCEPTIONS,
): string[] {
  const out: string[] = [];
  const mods = layoutModules(sources, out);
  const namesOf = (file: string, seen = new Set<string>()): Set<string> => {
    const names = new Set<string>();
    const m = mods.get(file);
    if (m === undefined || seen.has(file)) return names;
    seen.add(file);
    for (const n of m.named.keys()) names.add(n);
    for (const s of m.stars) for (const n of namesOf(s, seen)) if (n !== 'default') names.add(n);
    return names;
  };
  // every module an export passes through or ends in
  const pathOf = (file: string, name: string, seen: Set<string>): string[] => {
    const key = `${file}#${name}`;
    const m = mods.get(file);
    if (m === undefined || seen.has(key)) return [];
    seen.add(key);
    if (name === '*') return [file, ...[...namesOf(file)].flatMap((n) => pathOf(file, n, seen))];
    if (m.named.has(name)) {
      const origin = m.named.get(name);
      return origin === null || origin === undefined
        ? [file]
        : [file, ...pathOf(origin.from, origin.name, seen)];
    }
    if (name === 'default') return [];
    for (const s of m.stars) {
      const found = pathOf(s, name, seen);
      if (found.length > 0) return [file, ...found];
    }
    return [];
  };
  const reach = new Map<string, Set<string>>();
  for (const entry of ENTRY_FILES)
    for (const name of namesOf(entry))
      for (const file of pathOf(entry, name, new Set())) {
        const by = reach.get(file) ?? new Set<string>();
        by.add(entry);
        reach.set(file, by);
      }
  for (const file of [...mods.keys()].toSorted()) {
    if (
      ENTRY_FILES.includes(file) ||
      file.startsWith('src/cli/') ||
      posix.basename(file) === 'index.ts'
    )
      continue;
    const parts = file.split('/');
    const at = parts.indexOf('internal');
    const by = reach.get(file);
    if (exceptions.some((e) => e.path === file)) continue;
    if (at >= 0) {
      if (at !== parts.length - 2)
        out.push(
          `${file}: internal/ is flat; fix: move it to ${parts.slice(0, at + 1).join('/')}/${parts.at(-1)}`,
        );
      else if (by !== undefined)
        out.push(
          `${file}: ${[...by].toSorted().join(', ')} exports from this internal module; fix: move it to ${[...parts.slice(0, at), parts.at(-1)].join('/')}`,
        );
    } else if (by === undefined) {
      const domain =
        parts.length === 2
          ? 'src'
          : parts[1] === 'assets' && parts.length > 3
            ? parts.slice(0, 3).join('/')
            : parts.slice(0, 2).join('/');
      out.push(
        `${file}: no package entry exports from it; fix: move it into an internal/ folder, such as ${domain}/internal/${parts.at(-1)} (placement advice, not checked: src/internal/ when three or more domains use it)`,
      );
    }
  }
  for (const e of exceptions) {
    const by = reach.get(e.path);
    if (!sources.has(e.path))
      out.push(
        `${e.path}: listed layout exception is missing; fix: remove it from LAYOUT_EXCEPTIONS`,
      );
    else if (by !== undefined)
      out.push(
        `${e.path}: listed layout exception, but ${[...by].toSorted().join(', ')} exports from it; fix: remove it from LAYOUT_EXCEPTIONS`,
      );
    if (e.ledger !== undefined && !ledger.open.has(e.ledger))
      out.push(
        ledger.closed.has(e.ledger)
          ? `${e.path}: listed layout exception ends with ledger entry ${e.ledger}, which is closed; fix: move the module or remove the exception`
          : `${e.path}: listed layout exception names ledger entry ${e.ledger}, which the ledger does not hold; fix: name an open entry or state the condition in words`,
      );
    if (e.unimported === true) {
      const importers = [...mods]
        .filter(([f, m]) => f !== e.path && m.imports.has(e.path))
        .map(([f]) => f)
        .toSorted();
      if (importers.length > 0)
        out.push(
          `${e.path}: listed layout exception ends when a src module imports it, and ${importers.join(', ')} imports it; fix: move the module or remove the exception`,
        );
    }
    if (e.aloneIn !== undefined) {
      const folder = e.aloneIn;
      const others = [...sources.keys()]
        .filter((f) => f.startsWith(folder) && f !== e.path)
        .toSorted();
      if (others.length > 0)
        out.push(
          `${e.path}: listed layout exception ends when ${folder} holds another module, and it holds ${others.join(', ')}; fix: move the module or remove the exception`,
        );
    }
  }
  return out.toSorted();
}

/** --layout on this checkout: the tracked .ts modules of src. */
function checkLayout(): void {
  const files = execFileSync('git', ['ls-files', '-z', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((f) => /\.m?ts$/.test(f) && !f.endsWith('.d.ts'));
  const sources = new Map(files.map((f) => [f, readFileSync(resolve(ROOT, f), 'utf8')]));
  const ledgerFile = JSON.parse(readFileSync(LEDGER, 'utf8')) as {
    readonly open: readonly { readonly id: string }[];
    readonly closed: readonly { readonly id: string }[];
  };
  const ids = (list: readonly { readonly id: string }[]): Set<string> =>
    new Set(list.map((x) => x.id));
  const found = layoutProblems(sources, {
    open: ids(ledgerFile.open),
    closed: ids(ledgerFile.closed),
  });
  problems.push(...found);
  for (const e of LAYOUT_EXCEPTIONS)
    console.log(
      `layout exception: ${e.path} (${e.reason}${e.ledger === undefined ? '' : `; ends with ledger entry ${e.ledger}`}${e.unimported === true ? '; ends when a src module imports it' : ''}${e.aloneIn === undefined ? '' : `; ends when ${e.aloneIn} holds another module`})`,
    );
  console.log(
    `layout: ${sources.size} src modules, ${LAYOUT_EXCEPTIONS.length} listed exceptions, ${found.length} outside the internal-folder rule`,
  );
}

const all =
  !values.paths && !values.markers && !values.surface && !values.layout && !values['self-test'];
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
if (values.layout) checkLayout();
if (values['self-test']) await selfTest();
for (const p of problems) console.error(p);
console.log(
  problems.length === 0 ? 'surface-gate: ok' : `surface-gate: ${problems.length} problems`,
);
process.exit(problems.length === 0 ? 0 : 1);

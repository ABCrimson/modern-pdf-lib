/**
 * The real-world PDF corpus in tests/fixtures/corpus/: manifest validation and admission.
 *
 *   node scripts/dev/corpus.ts --check [--summary <path>] [--ledger <path>] [--manifest <path>]
 *       The G-CORPUS gate. First validates manifest.json against the directory: every listed
 *       file exists, hashes to its sha256 and has its byte count; each file is at most 256 KiB
 *       and the directory at most 3 MiB; ids are unique, sorted and name their file
 *       (`<id>.pdf`); every licence is in the allow-list and has a non-empty text in LICENSES/;
 *       every entry records `contactData` (`"none"`, or `"institutional"` with a
 *       non-empty `contactDataReason`); README.md names every id; no PDF anywhere under the directory (subdirectories included)
 *       is missing from the manifest.
 *       Then, when the manifest is valid (the committed one or `--manifest <other>`), re-runs the
 *       contact-data scan of --contacts on every file and fails when an entry's recorded
 *       `contactData` disagrees with what the scan finds. An entry whose object
 *       strings the scan skipped (an encrypted file without `QPDF`) counts as unconfirmed,
 *       whether it records `"none"` or `"institutional"`; only a run with `QPDF` set confirms it.
 *       Then, when both passed and the manifest is the committed one, runs
 *       tests/oracle/corpus.test.ts (`node node_modules/vitest/vitest.mjs run ... --retry 0
 *       --reporter=json`, offline; QPDF as the test file expects it) and fails when a test
 *       failed, when a knownDefect marker did not fail for its stated reason, when a marker id
 *       is neither an open id of the ledger (`--ledger`, default audit/open-highs.json; its
 *       `open` array, or the `highs` array of an older ledger file of the same shape; see ledgerIds) nor in
 *       the test file's PROVISIONAL_IDS block, or when a real file reached the recovery scan
 *       without a marker. It prints the summary and writes it to `--summary <path>`:
 *       `{ version, files, loads, passAll, keyed: { <id>: <markers that ran> }, unkeyedFallbacks,
 *       qpdfSkipped, perFile: { <id>: { <check>: "pass" | "skip" | "fail" | <ids> } } }`, where
 *       `loads` counts files that load without a marker and `passAll` files whose eight checks
 *       pass without a marker (checks `qpdf` and `qpdfDefault` run qpdf --check on the
 *       `save({ compress: false })` output and on the default `save()` output), and
 *       `qpdfSkipped` counts qpdf checks skipped because qpdf is absent. `keyed` counts only
 *       markers that ran and failed for their stated reason: a skipped check adds nothing to it,
 *       though its marker id is still validated against the ledger. This summary is the
 *       pass rate published per release. With `--manifest <other>` only the manifest part and the
 *       contact scan run (the test file reads the committed manifest). Exit 1 on any problem.
 *
 *   node scripts/dev/corpus.ts --fetch [--manifest <path>]
 *       Provenance check (network; nightly and before a tag, never on pull requests): downloads
 *       every `source.url` into a fresh temp directory and compares it with the manifest's
 *       sha256. A difference or a failed download is a problem, except for an entry with
 *       `fetchStable: false`, which is reported and does not fail the run. Exit 1 on any
 *       problem.
 *
 *   node scripts/dev/corpus.ts --contacts [--manifest <path>]
 *       Contact-data scan (offline): looks for e-mail addresses, IPv4 and IPv6
 *       addresses and telephone numbers in every manifest file: with pdf.js in the text and the
 *       annotations (contents, author, field names and values, alternative text, link URLs) of
 *       every page, the form field values, the embedded file names and descriptions, the Info
 *       dictionary and the XMP metadata; and in every string object outside stream data
 *       (signature dictionaries' /Name, /ContactInfo, /Location, /Reason and the certificates in
 *       their /Contents included), read from qpdf's decrypted, uncompressed QDF form when `QPDF`
 *       is set and from the file's own bytes otherwise (object streams included; an encrypted
 *       file's strings are then skipped and counted). It prints each hit with its place and fails
 *       when an entry with a hit records `contactData: "none"`, or when an entry recorded as
 *       `"institutional"` has no hit although its strings were read. Every other entry whose
 *       strings were skipped is counted and printed as unconfirmed, whether it records `"none"`
 *       or `"institutional"`; only a run with `QPDF` set confirms those entries. Exit 1 on any
 *       problem.
 *
 *   node scripts/dev/corpus.ts --add <url> --id <id> --licence <spdx> --project <name>
 *       --attribution <text> [--password <pw>] [--category damaged] [--features <a,b>]
 *       [--text-sample <text>] [--fetch-unstable]
 *       [--contact-data institutional --contact-reason <text>]
 *       Downloads <url> into a fresh temp directory and admits it: the library loads it
 *       (normal and strict), counts its pages, extracts the text of every page, saves it and
 *       reloads the output, all in a child Node process (run with tsx, since the source uses
 *       TypeScript syntax that type stripping does not accept) with a 512 MiB heap and a 5 s
 *       wall-clock budget measured from the moment the child has imported the library. A
 *       candidate over budget is refused with "over admission budget" and nothing else. The
 *       library's own results are printed, never gated: a defect of this library is keyed in
 *       tests/oracle/corpus.test.ts, it does not keep a file out. The oracle values come from
 *       qpdf (`QPDF`, exit code of `--check`, which must be 0 or 3, and `--show-npages`) and
 *       pdfjs-dist (character count, producer, header version, and the page-1 text that
 *       `--text-sample` must occur in). It runs the contact-data scan of --contacts and prints
 *       each hit; a candidate with a hit is refused unless `--contact-data institutional` with
 *       a `--contact-reason` states that the hits are an institution's own addresses or
 *       telephone lines, a placeholder identity (such as a certificate subject at example.com or
 *       example.org), or strings the patterns match that are not contact data (a named natural
 *       person's contact data is never admitted), and the entry records `contactData` to match.
 *       The file is copied to tests/fixtures/corpus/<id>.pdf
 *       and its entry is inserted into manifest.json in id order (an entry with the same id is
 *       replaced). `--category damaged` requires qpdf to report warnings (exit 3); the category
 *       follows qpdf's verdict on the input, never this library's: damaged when the warnings
 *       are about the cross-reference data, a stream or an object qpdf repairs, real when they
 *       are only about linearization hint tables (tests/fixtures/corpus/README.md).
 *
 * Plain node runs this file (type stripping, so only erasable syntax); `node:` imports and the
 * pdfjs-dist devDependency only.
 */
import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { inflateSync } from 'node:zlib';

const REPO = resolve(import.meta.dirname, '../..');
const CORPUS_DIR = join(REPO, 'tests/fixtures/corpus');
const DEFAULT_MANIFEST = join(CORPUS_DIR, 'manifest.json');
const TEST_FILE = 'tests/oracle/corpus.test.ts';
const DEFAULT_LEDGER = join(REPO, 'audit/open-highs.json');
const VITEST_MS = 600_000;
const FILE_CAP = 256 * 1024;
const DIR_CAP = 3 * 1024 * 1024;
const BUDGET_MS = 5_000;
const STARTUP_MS = 120_000;
const HEAP_MB = 512;
const PRINT_WIDTH = 100;

/** Licences whose files may be committed, mapped to their text in LICENSES/. */
const LICENCE_FILES: Readonly<Record<string, string>> = {
  'Apache-2.0': 'Apache-2.0.txt',
  MIT: 'MIT.txt',
  'CC-BY-4.0': 'CC-BY-4.0.txt',
  'CC0-1.0': 'CC0-1.0.txt',
  'US-PD': 'US-PD.md',
};

interface Oracle {
  qpdfCheck: 0 | 3;
  pages: number;
  pdfjsChars: number;
  textSample?: string;
}

interface Entry {
  id: string;
  file: string;
  sha256: string;
  bytes: number;
  source: { project: string; url: string; retrieved: string; fetchStable?: false };
  licence: string;
  attribution: string;
  /** `none`, or `institutional` with `contactDataReason` saying what the hits are. */
  contactData: 'none' | 'institutional';
  contactDataReason?: string;
  pdfVersion: string | null;
  producer: string | null;
  features: string[];
  category: 'real' | 'damaged';
  password: string | null;
  oracle: Oracle;
}

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    summary: { type: 'string' },
    ledger: { type: 'string' },
    fetch: { type: 'boolean', default: false },
    manifest: { type: 'string' },
    add: { type: 'string' },
    id: { type: 'string' },
    licence: { type: 'string' },
    project: { type: 'string' },
    attribution: { type: 'string' },
    password: { type: 'string' },
    category: { type: 'string', default: 'real' },
    features: { type: 'string' },
    'text-sample': { type: 'string' },
    'fetch-unstable': { type: 'boolean', default: false },
    'contact-data': { type: 'string' },
    'contact-reason': { type: 'string' },
    contacts: { type: 'boolean', default: false },
    'admit-child': { type: 'string' },
  },
});

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();
const repoPath = (path: string): string => relative(REPO, path).split(sep).join('/');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------------------------
// --check: manifest validation
// ---------------------------------------------------------------------------------------------

function entryProblems(raw: unknown, index: number): string[] {
  const at = `entry ${index}`;
  if (!isRecord(raw)) return [`${at}: not an object`];
  const problems: string[] = [];
  const need = (ok: boolean, what: string): void => {
    if (!ok) problems.push(`${at} (${String(raw['id'])}): ${what}`);
  };
  const { id, file, source, oracle } = raw;
  need(typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), 'id is not kebab-case');
  need(file === `${String(id)}.pdf`, 'file is not <id>.pdf');
  need(typeof raw['sha256'] === 'string' && /^[0-9a-f]{64}$/.test(raw['sha256']), 'bad sha256');
  need(Number.isSafeInteger(raw['bytes']), 'bytes is not an integer');
  need(
    isRecord(source) &&
      typeof source['project'] === 'string' &&
      typeof source['url'] === 'string' &&
      source['url'].startsWith('https://') &&
      typeof source['retrieved'] === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(source['retrieved']) &&
      (source['fetchStable'] === undefined || source['fetchStable'] === false),
    'source needs project, an https url, a YYYY-MM-DD retrieved date and fetchStable false or absent',
  );
  need(
    typeof raw['licence'] === 'string' && Object.hasOwn(LICENCE_FILES, raw['licence']),
    `licence ${String(raw['licence'])} is not in the allow-list`,
  );
  need(typeof raw['attribution'] === 'string' && raw['attribution'] !== '', 'no attribution');
  need(
    (raw['contactData'] === 'none' && raw['contactDataReason'] === undefined) ||
      (raw['contactData'] === 'institutional' &&
        typeof raw['contactDataReason'] === 'string' &&
        raw['contactDataReason'].trim() !== ''),
    'contactData must be "none", or "institutional" with a non-empty contactDataReason',
  );
  need(raw['pdfVersion'] === null || typeof raw['pdfVersion'] === 'string', 'bad pdfVersion');
  need(raw['producer'] === null || typeof raw['producer'] === 'string', 'bad producer');
  need(
    Array.isArray(raw['features']) && raw['features'].every((f) => typeof f === 'string'),
    'features is not a string array',
  );
  need(raw['category'] === 'real' || raw['category'] === 'damaged', 'category is not real/damaged');
  need(raw['password'] === null || typeof raw['password'] === 'string', 'bad password');
  if (!isRecord(oracle)) {
    need(false, 'no oracle');
    return problems;
  }
  need(oracle['qpdfCheck'] === 0 || oracle['qpdfCheck'] === 3, 'oracle.qpdfCheck is not 0 or 3');
  need(raw['category'] !== 'damaged' || oracle['qpdfCheck'] === 3, 'damaged without qpdf warnings');
  need(Number.isSafeInteger(oracle['pages']) && Number(oracle['pages']) > 0, 'bad oracle.pages');
  need(Number.isSafeInteger(oracle['pdfjsChars']), 'bad oracle.pdfjsChars');
  need(
    oracle['textSample'] === undefined ||
      (typeof oracle['textSample'] === 'string' && oracle['textSample'].length >= 5),
    'oracle.textSample is shorter than 5 characters',
  );
  return problems;
}

function dirBytes(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const stats = statSync(join(dir, name));
    if (stats.isFile()) total += stats.size;
  }
  return total;
}

function check(manifestPath: string): number {
  if (!existsSync(manifestPath)) {
    console.error(`manifest.json not found: ${repoPath(manifestPath)}`);
    return 1;
  }
  const dir = resolve(manifestPath, '..');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`manifest.json is not JSON: ${(error as Error).message}`);
    return 1;
  }
  if (!Array.isArray(parsed)) {
    console.error('manifest.json is not an array');
    return 1;
  }
  const problems = parsed.flatMap((raw, index) => entryProblems(raw, index));
  const entries = parsed as Entry[];
  const ids = entries.map((entry) => entry.id);
  for (let i = 1; i < ids.length; i++) {
    if (!(String(ids[i - 1]) < String(ids[i])))
      problems.push(`ids not sorted or not unique at ${String(ids[i])}`);
  }
  const readme = existsSync(join(dir, 'README.md'))
    ? readFileSync(join(dir, 'README.md'), 'utf8')
    : '';
  if (readme === '') problems.push('README.md missing');
  const licencesUsed = new Set<string>();
  for (const entry of entries) {
    const path = join(dir, String(entry.file));
    if (!existsSync(path)) {
      problems.push(`${entry.id}: ${entry.file} missing`);
      continue;
    }
    const bytes = new Uint8Array(readFileSync(path));
    if (bytes.length !== entry.bytes)
      problems.push(`${entry.id}: ${bytes.length} bytes, manifest says ${entry.bytes}`);
    if (bytes.length > FILE_CAP)
      problems.push(`${entry.id}: ${bytes.length} bytes is over the ${FILE_CAP}-byte cap`);
    if (sha256(bytes) !== entry.sha256)
      problems.push(`${entry.id}: sha256 differs from the manifest`);
    if (readme !== '' && !readme.includes(`\`${entry.id}\``))
      problems.push(`${entry.id}: not named in README.md`);
    licencesUsed.add(entry.licence);
  }
  for (const licence of licencesUsed) {
    const text = LICENCE_FILES[licence];
    if (text === undefined) continue;
    const path = join(dir, 'LICENSES', text);
    if (!existsSync(path) || statSync(path).size === 0)
      problems.push(`LICENSES/${text} missing or empty for ${licence}`);
  }
  const listed = new Set(entries.map((entry) => entry.file));
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const rel = name.split(sep).join('/');
    if (rel.toLowerCase().endsWith('.pdf') && !listed.has(rel))
      problems.push(`${rel}: not in manifest.json`);
  }
  const total = dirBytes(dir);
  if (total > DIR_CAP)
    problems.push(`directory holds ${total} bytes, over the ${DIR_CAP}-byte cap`);
  for (const problem of problems) console.error(problem);
  console.log(
    `${entries.length} files, ${total} bytes in ${repoPath(dir)}, ${problems.length} problems`,
  );
  return problems.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// --check: the test run and the summary
// ---------------------------------------------------------------------------------------------

interface JsonAssertion {
  readonly ancestorTitles: readonly string[];
  readonly title: string;
  readonly status: string;
  readonly failureMessages: readonly string[];
  readonly meta?: {
    readonly ledger?: { readonly ids?: readonly string[]; readonly until?: string };
    readonly knownDefectMatched?: boolean;
  };
}

interface JsonReport {
  readonly numFailedTests: number;
  readonly numFailedTestSuites: number;
  readonly testResults: readonly {
    readonly message?: string;
    readonly assertionResults: readonly JsonAssertion[];
  }[];
}

/** The checks of tests/oracle/corpus.test.ts, by the end of their title after `<file>`. */
const CHECK_TITLES: readonly (readonly [check: string, suffix: string])[] = [
  ['sha256', ' sha256'],
  ['loads', ' loads'],
  ['fallback', ' loads without the recovery scan, also strictly'],
  ['fallback', ' recovers'],
  ['pages', ' page count'],
  ['text', ' getText'],
  ['save', ' save and reload'],
  ['qpdf', ' qpdf --check of the saved file'],
  ['qpdfDefault', ' qpdf --check of the default save'],
  ['bareSave', ' a bare save() throws UnsupportedEncryptionError'],
  ['plaintext', ' plaintext of the saved file equals the source'],
];
const CHECKS = [
  'sha256',
  'loads',
  'fallback',
  'pages',
  'text',
  'save',
  'qpdf',
  'qpdfDefault',
] as const;
/** The checks that only an encrypted file (a feature starting `encrypted-`) runs, as well. */
const ENCRYPTED_CHECKS = ['bareSave', 'plaintext'] as const;

/**
 * Open ids of the ledger file: its `open` array (audit/open-highs.json, `{ open: [{ id }] }`) or,
 * when that is absent, its `highs` array (an older ledger file,
 * `{ generated, counts, highs: [{ id }] }`). A file with neither array is an error.
 */
function ledgerIds(path: string): Set<string> {
  const ledger = JSON.parse(readFileSync(path, 'utf8')) as {
    open?: readonly { id?: unknown }[];
    highs?: readonly { id?: unknown }[];
  };
  const rows = ledger.open ?? ledger.highs;
  if (rows === undefined) throw new Error(`${path}: no open or highs array`);
  return new Set(rows.flatMap((e) => (typeof e.id === 'string' ? [e.id] : [])));
}

/** The ids of the test file's PROVISIONAL_IDS block that carry a non-empty reason. */
function provisionalIds(): Set<string> {
  const source = readFileSync(join(REPO, TEST_FILE), 'utf8');
  const block = /const PROVISIONAL_IDS\b[^=]*=\s*\{([\s\S]*?)\};/.exec(source)?.[1] ?? '';
  return new Set(
    [...block.matchAll(/'(corpus-P\d{2,})':\s*'([^']+)'/g)].flatMap((m) =>
      m[2]?.trim() ? [String(m[1])] : [],
    ),
  );
}

function runTests(entries: readonly Entry[], summaryPath?: string, ledgerPath?: string): number {
  const problems: string[] = [];
  const ledger = ledgerPath ?? DEFAULT_LEDGER;
  if (!existsSync(ledger)) {
    console.error(`ledger not found: ${ledger}`);
    return 1;
  }
  const known = new Set([...ledgerIds(ledger), ...provisionalIds()]);
  const scratch = mkdtempSync(join(tmpdir(), 'corpus-check-'));
  let report: JsonReport;
  try {
    const out = join(scratch, 'report.json');
    const run = spawnSync(
      process.execPath,
      [
        join(REPO, 'node_modules/vitest/vitest.mjs'),
        'run',
        TEST_FILE,
        '--retry',
        '0',
        '--reporter=json',
        `--outputFile=${out}`,
      ],
      { cwd: REPO, encoding: 'utf8', timeout: VITEST_MS, maxBuffer: 64 * 1024 * 1024 },
    );
    if (!existsSync(out)) {
      console.error(
        `vitest wrote no report (exit ${String(run.status)}): ${run.stderr.slice(-2000)}`,
      );
      return 1;
    }
    report = JSON.parse(readFileSync(out, 'utf8')) as JsonReport;
    if (run.status !== 0) problems.push(`vitest exited ${String(run.status)}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  for (const file of report.testResults) {
    if (file.message) problems.push(`${TEST_FILE}: ${file.message.split('\n')[0]}`);
  }
  const perFile: Record<string, Record<string, string>> = {};
  const keyed: Record<string, number> = {};
  let qpdfSkipped = 0;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const file of report.testResults) {
    for (const a of file.assertionResults) {
      const entry = byId.get(a.ancestorTitles[1] ?? '');
      const ids = a.meta?.ledger?.ids ?? [];
      if (a.status === 'failed') {
        problems.push(`failed: ${a.title}: ${(a.failureMessages[0] ?? '').split('\n')[0]}`);
      } else if (ids.length > 0 && a.status === 'passed' && a.meta?.knownDefectMatched !== true) {
        problems.push(`marker did not fail for its stated reason: ${a.title}`);
      }
      for (const id of ids) {
        // Published counts hold only markers that ran (a skipped qpdf check counts nothing);
        // every marker's id is validated against the ledger either way.
        if (a.status === 'passed') keyed[id] = (keyed[id] ?? 0) + 1;
        if (!known.has(id))
          problems.push(`${id} is neither an open ledger id nor a provisional id: ${a.title}`);
      }
      if (entry === undefined) continue;
      const check = CHECK_TITLES.find(([, suffix]) =>
        a.title.endsWith(`${entry.file}${suffix}`),
      )?.[0];
      if (check === undefined) {
        problems.push(`unrecognised check: ${a.title}`);
        continue;
      }
      if (a.status === 'skipped' && (check === 'qpdf' || check === 'qpdfDefault')) qpdfSkipped++;
      const result =
        a.status === 'skipped'
          ? 'skip'
          : a.status !== 'passed'
            ? 'fail'
            : ids.length > 0
              ? ids.join(', ')
              : 'pass';
      (perFile[entry.id] ??= {})[check] = result;
    }
  }

  let loads = 0;
  let passAll = 0;
  let unkeyedFallbacks = 0;
  for (const entry of entries) {
    const results = perFile[entry.id] ?? {};
    const required: readonly string[] = entry.features.some((f) => f.startsWith('encrypted-'))
      ? [...CHECKS, ...ENCRYPTED_CHECKS]
      : CHECKS;
    const missing = required.filter((c) => results[c] === undefined);
    if (missing.length > 0) problems.push(`${entry.id}: no result for ${missing.join(', ')}`);
    if (results['loads'] === 'pass') loads++;
    if (required.every((c) => results[c] === 'pass')) passAll++;
    if (entry.category === 'real' && results['fallback'] === 'fail') unkeyedFallbacks++;
  }
  if (unkeyedFallbacks > 0) problems.push(`${unkeyedFallbacks} unkeyed fallbacks`);

  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string };
  const sortedKeyed = Object.fromEntries(
    Object.entries(keyed).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const summary = {
    version: pkg.version,
    files: entries.length,
    loads,
    passAll,
    keyed: sortedKeyed,
    unkeyedFallbacks,
    qpdfSkipped,
    perFile,
  };
  if (summaryPath !== undefined) {
    mkdirSync(resolve(summaryPath, '..'), { recursive: true });
    writeFileSync(summaryPath, `${formatJson(summary)}\n`);
  }
  for (const problem of problems) console.error(problem);
  const markers = Object.entries(sortedKeyed)
    .map(([id, n]) => `${id} ${n}`)
    .join(', ');
  console.log(
    `G-CORPUS ${pkg.version}: ${entries.length} files, ${loads} load, ${passAll} pass every check, ` +
      `markers: ${markers || 'none'}; ${unkeyedFallbacks} unkeyed fallbacks, ` +
      `${qpdfSkipped} qpdf checks skipped, ${problems.length} problems`,
  );
  if (qpdfSkipped > 0) console.warn('QPDF is not set: the qpdf checks were skipped');
  return problems.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// --fetch: provenance
// ---------------------------------------------------------------------------------------------

async function fetchAll(manifestPath: string): Promise<number> {
  if (!existsSync(manifestPath)) {
    console.error(`manifest.json not found: ${repoPath(manifestPath)}`);
    return 1;
  }
  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as Entry[];
  const problems: string[] = [];
  let unstable = 0;
  const scratch = mkdtempSync(join(tmpdir(), 'corpus-fetch-'));
  try {
    for (const entry of entries) {
      let why: string | undefined;
      try {
        const response = await fetch(entry.source.url, {
          headers: { 'user-agent': 'corpus-provenance/1.0' },
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          writeFileSync(join(scratch, entry.file), bytes);
          if (sha256(bytes) !== entry.sha256)
            why = `the download (${bytes.length} bytes) differs from the manifest sha256`;
        } else {
          why = `download failed with HTTP ${response.status}`;
        }
      } catch (error) {
        why = `download failed: ${(error as Error).message}`;
      }
      if (why === undefined) continue;
      if (entry.source.fetchStable === false) {
        unstable++;
        console.warn(`${entry.id}: ${why} (fetchStable false: reported, not failed)`);
      } else {
        problems.push(`${entry.id}: ${why}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  for (const problem of problems) console.error(problem);
  console.log(
    `${entries.length} sources fetched, ${problems.length} problems, ${unstable} unstable sources reported`,
  );
  return problems.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// --admit-child: the library's pass over one candidate, inside the budgeted child process
// ---------------------------------------------------------------------------------------------

interface LoadedPage {
  getContentStream(): Uint8Array;
  getOriginalResources(): unknown;
}
interface LoadedDoc {
  getPageCount(): number;
  getPage(index: number): LoadedPage;
  save(options: { compress: boolean }): Promise<Uint8Array>;
}
interface Library {
  loadPdf(bytes: Uint8Array, options?: Record<string, unknown>): Promise<LoadedDoc>;
  extractText(ops: unknown, resources?: unknown): string;
  parseContentStream(bytes: Uint8Array): unknown;
}
interface ScanTarget {
  prototype: Record<string, (...args: unknown[]) => unknown>;
}

async function admitChild(file: string, password: string | undefined): Promise<void> {
  // The specifiers are computed so that tsc -p scripts/tsconfig.json does not pull src/ into
  // this program; the child always runs under tsx, which compiles the .ts sources.
  const lib = (await import(pathToFileURL(join(REPO, 'src/index.ts')).href)) as Library;
  const { XrefParser } = (await import(
    pathToFileURL(join(REPO, 'src/parser/internal/xrefParser.ts')).href
  )) as {
    XrefParser: ScanTarget;
  };
  let scans = 0;
  const original = XrefParser.prototype['rebuildXrefFromScan'];
  if (original === undefined) throw new Error('XrefParser.prototype.rebuildXrefFromScan not found');
  XrefParser.prototype['rebuildXrefFromScan'] = function (this: unknown, ...args: unknown[]) {
    scans++;
    return original.apply(this, args);
  };
  process.stdout.write('ready\n');
  const result: Record<string, unknown> = {};
  const step = async <T>(name: string, run: () => Promise<T> | T): Promise<T | undefined> => {
    try {
      const value = await run();
      result[name] = 'ok';
      return value;
    } catch (error) {
      result[name] = `error: ${String((error as Error)?.message ?? error).split('\n')[0]}`;
      return undefined;
    }
  };
  const bytes = new Uint8Array(readFileSync(file));
  const options = password === undefined ? {} : { password };
  const doc = await step('load', () => lib.loadPdf(bytes, options));
  result['recoveryScans'] = scans;
  await step('strictLoad', () => lib.loadPdf(bytes, { ...options, throwOnInvalidObject: true }));
  if (doc !== undefined) {
    const pages = doc.getPageCount();
    result['pages'] = pages;
    await step('getText', () => {
      for (let i = 0; i < pages; i++) {
        const page = doc.getPage(i);
        lib.extractText(
          lib.parseContentStream(page.getContentStream()),
          page.getOriginalResources(),
        );
      }
    });
    const saved = await step('save', () => doc.save({ compress: false }));
    if (saved !== undefined) {
      const again = await step('reload', () => lib.loadPdf(saved, options));
      if (again !== undefined) result['reloadPages'] = again.getPageCount();
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

/** Runs the child; resolves to its result, or to null when it went over the budget. */
function runAdmissionChild(
  file: string,
  password: string | undefined,
): Promise<Record<string, unknown> | null> {
  const args = [
    '--import',
    'tsx',
    `--max-old-space-size=${HEAP_MB}`,
    fileURLToPath(import.meta.url),
    '--admit-child',
    file,
    ...(password === undefined ? [] : ['--password', password]),
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let ready = false;
    let overBudget = false;
    const startup = setTimeout(() => child.kill('SIGKILL'), STARTUP_MS);
    let budget: ReturnType<typeof setTimeout> | undefined;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      if (!ready && stdout.includes('ready\n')) {
        ready = true;
        clearTimeout(startup);
        budget = setTimeout(() => {
          overBudget = true;
          child.kill('SIGKILL');
        }, BUDGET_MS);
      }
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      clearTimeout(startup);
      clearTimeout(budget);
      if (!ready) {
        reject(
          new Error(
            `admission child did not start (exit ${String(code)}): ${stderr.slice(0, 2000)}`,
          ),
        );
        return;
      }
      const line = stdout.split('\n').find((l) => l.startsWith('{'));
      if (overBudget || code !== 0 || line === undefined) {
        resolvePromise(null);
        return;
      }
      resolvePromise(JSON.parse(line) as Record<string, unknown>);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// --add: admission
// ---------------------------------------------------------------------------------------------

function qpdf(qpdfPath: string, args: string[]): { status: number; stdout: string } {
  const run = spawnSync(qpdfPath, args, { encoding: 'utf8', timeout: 60_000 });
  return { status: run.status ?? -1, stdout: `${run.stdout}${run.stderr}` };
}

/** Structural features read from the raw bytes and from qpdf's decrypted, uncompressed QDF form. */
function detectFeatures(
  qpdfPath: string,
  file: string,
  password: string | undefined,
  scratch: string,
): string[] {
  const raw = readFileSync(file).toString('latin1');
  const pw = password === undefined ? [] : [`--password=${password}`];
  const qdfPath = join(scratch, 'qdf.pdf');
  qpdf(qpdfPath, [...pw, '--qdf', '--object-streams=disable', '--decrypt', file, qdfPath]);
  const qdf = existsSync(qdfPath) ? readFileSync(qdfPath).toString('latin1') : '';
  const features = new Set<string>();
  const linearized = /\/Linearized\b/.test(raw.slice(0, 2048));
  const startxrefs = raw.match(/startxref/g)?.length ?? 0;
  if (/\/Type\s*\/XRef\b/.test(raw)) features.add('xref-stream');
  else features.add('classic-xref');
  if (/\/Type\s*\/ObjStm\b/.test(raw)) features.add('object-streams');
  if (/\/XRefStm\b/.test(raw)) features.add('hybrid-xref');
  if (linearized) features.add('linearized');
  if (startxrefs > (linearized ? 2 : 1)) features.add('incremental');
  const encryption = qpdf(qpdfPath, [...pw, '--show-encryption', file]).stdout;
  const r = /^R = (\d)/m.exec(encryption)?.[1];
  if (r !== undefined) {
    const aes = /AESv2/.test(encryption)
      ? '-aes128'
      : /AESv3/.test(encryption)
        ? '-aes256'
        : '-rc4';
    features.add(`encrypted-r${r}${r === '6' || r === '5' ? '' : aes}`);
  }
  if (/\/AcroForm\b/.test(qdf)) features.add('acroform');
  if (/\/FT\s*\/Sig\b/.test(qdf)) features.add('signature');
  if (/\/StructTreeRoot\b/.test(qdf)) features.add('tagged');
  if (/\/Subtype\s*\/Type0\b/.test(qdf)) features.add('cid-font');
  if (/\/JBIG2Decode\b/.test(qdf)) features.add('jbig2');
  if (/\/JPXDecode\b/.test(qdf)) features.add('jpx');
  if (/\/CCITTFaxDecode\b/.test(qdf)) features.add('ccitt');
  return [...features];
}

interface PdfjsTextItem {
  str?: string;
}

interface PdfjsRead {
  pages: number;
  chars: number;
  page1: string;
  producer: string | null;
  version: string | null;
  /**
   * The text of each page, page 1 first: its items joined without separators, then a newline,
   * then joined with spaces (so a pattern split across items and one next to another item's
   * digits are both seen).
   */
  pageTexts: string[];
  /**
   * The annotation strings of each page, page 1 first, one per line: contents, title (author),
   * field name and value, alternative text, rich text and link URLs.
   */
  annotationTexts: string[];
  /** The values and default values of the AcroForm fields (`getFieldObjects`), one per line. */
  fieldValues: string;
  /** The names, file names and descriptions of the embedded files, one per line. */
  attachments: string;
  /** The document information dictionary as pdf.js reports it, serialised. */
  info: string;
  /** The raw XMP metadata packet, or '' when there is none. */
  xmp: string;
}

/** The strings of a pdf.js annotation, field object or attachment value, nested ones included. */
function stringsOf(value: unknown, depth = 0): string[] {
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (depth > 3 || typeof value !== 'object' || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => stringsOf(item, depth + 1));
  return Object.values(value).flatMap((item) => stringsOf(item, depth + 1));
}

/** The annotation data fields that hold text a person typed or a link target. */
const ANNOTATION_TEXT_FIELDS = [
  'contentsObj',
  'titleObj',
  'richText',
  'fieldName',
  'fieldValue',
  'defaultFieldValue',
  'alternativeText',
  'textContent',
  'url',
  'unsafeUrl',
] as const;

async function pdfjsOracle(bytes: Uint8Array, password: string | undefined): Promise<PdfjsRead> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const root = join(REPO, 'node_modules/pdfjs-dist/');
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    ...(password === undefined ? {} : { password }),
    cMapUrl: join(root, 'cmaps/').replaceAll('\\', '/'),
    cMapPacked: true,
    standardFontDataUrl: join(root, 'standard_fonts/').replaceAll('\\', '/'),
    verbosity: 0,
  }).promise;
  try {
    let chars = 0;
    let page1 = '';
    const pageTexts: string[] = [];
    const annotationTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const items = (await page.getTextContent()).items as PdfjsTextItem[];
      const text = items.map((item) => item.str ?? '').join('');
      const spaced = items.map((item) => item.str ?? '').join(' ');
      chars += text.length;
      pageTexts.push(`${text}\n${spaced}`);
      if (i === 1) page1 = spaced;
      const annotations = (await page.getAnnotations()) as Record<string, unknown>[];
      annotationTexts.push(
        annotations
          .flatMap((data) => ANNOTATION_TEXT_FIELDS.flatMap((field) => stringsOf(data[field])))
          .join('\n'),
      );
    }
    const fields = await doc.getFieldObjects();
    const fieldValues = [...(fields?.values() ?? [])]
      .flat()
      .flatMap((field) => {
        const { value, defaultValue } = field as { value?: unknown; defaultValue?: unknown };
        return [...stringsOf(value), ...stringsOf(defaultValue)];
      })
      .join('\n');
    const attachments = [...((await doc.getAttachments())?.entries() ?? [])]
      .flatMap(([name, file]) => [name, file.filename, file.rawFilename, file.description])
      .filter((text) => typeof text === 'string' && text !== '')
      .join('\n');
    const { info, metadata } = (await doc.getMetadata()) as {
      info: Record<string, unknown>;
      metadata: { getRaw(): unknown } | null;
    };
    const producer =
      typeof info['Producer'] === 'string' && info['Producer'] !== '' ? info['Producer'] : null;
    const version = typeof info['PDFFormatVersion'] === 'string' ? info['PDFFormatVersion'] : null;
    const xmp = metadata?.getRaw();
    return {
      pages: doc.numPages,
      chars,
      page1: normalise(page1),
      producer,
      version,
      pageTexts,
      annotationTexts,
      fieldValues,
      attachments,
      info: JSON.stringify(info),
      xmp: typeof xmp === 'string' ? xmp : '',
    };
  } finally {
    await doc.loadingTask.destroy();
  }
}

// ---------------------------------------------------------------------------------------------
// Contact data: e-mail addresses, IP addresses and telephone numbers in the
// text, the annotations, the form values, the embedded file names, the metadata and the strings
// of every object (signature dictionaries and their certificates included)
// ---------------------------------------------------------------------------------------------

interface ContactHit {
  /**
   * `page <n>` (1-based), `page <n> annotations`, `form values`, `embedded files`, `Info`, `XMP`,
   * or `strings <key>` for a string of an object (the dictionary key it is the value of, such
   * as `/ContactInfo` or `/Contents`; `-` when it has none).
   */
  where: string;
  kind: 'email' | 'ipv4' | 'ipv6' | 'phone';
  value: string;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const IPV4 =
  /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.])/g;
/** Runs of hex digits and colons; isIpv6 keeps the ones that are IPv6 addresses. */
const IPV6_RUN = /(?<![\w:])[0-9A-Fa-f:]{3,39}(?![\w:])/g;
/**
 * Telephone numbers: North American ones (`555-010-0199`, `(555) 010-0199`, `1-800-555-0199`,
 * `+1 555.010.0199`) and international ones written with a leading `+` and two to five groups
 * (`+44 20 7946 0958`).
 */
const PHONE =
  /(?<![\w+-])(?:(?:\+?1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}|\+\d{1,3}(?:[ .-]\(?\d{1,4}\)?){2,5})(?![\w-])/g;

/** Eight groups of 1-4 hex digits, or fewer groups with exactly one `::` and at least two digits groups. */
function isIpv6(run: string): boolean {
  const halves = run.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => (half === '' ? [] : half.split(':')));
  if (!groups.every((group) => /^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
  return halves.length === 1 ? groups.length === 8 : groups.length >= 2 && groups.length <= 7;
}

function contactHitsIn(where: string, text: string): ContactHit[] {
  const hits: ContactHit[] = [];
  for (const m of text.matchAll(EMAIL)) hits.push({ where, kind: 'email', value: m[0] });
  for (const m of text.matchAll(IPV4)) hits.push({ where, kind: 'ipv4', value: m[0] });
  for (const m of text.matchAll(IPV6_RUN))
    if (isIpv6(m[0])) hits.push({ where, kind: 'ipv6', value: m[0] });
  for (const m of text.matchAll(PHONE)) hits.push({ where, kind: 'phone', value: m[0] });
  return hits;
}

/** A PDF string's bytes (one char per byte) as text: UTF-16BE or UTF-8 by its BOM, else latin1. */
function decodePdfString(raw: string): string[] {
  const bytes = Buffer.from(raw, 'latin1');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return [utf16be(bytes.subarray(2))];
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return [bytes.subarray(3).toString('utf8')];
  return [raw];
}

function utf16be(bytes: Uint8Array): string {
  const swapped = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2)));
  return swapped.swap16().toString('utf16le');
}

const LITERAL_ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
};

/**
 * Every string object outside the stream data of a PDF body read as latin1, with the dictionary
 * key it is the value of: literal strings (escapes resolved) and hex strings, each decoded by
 * decodePdfString, a hex string also as UTF-16BE without a BOM (certificate BMPStrings). The data
 * of a /FlateDecode object stream (/Type /ObjStm) is inflated and read the same way; other stream
 * data (content, fonts, images, XMP, embedded files) is skipped.
 */
function pdfStrings(body: string, depth = 0): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const keyBefore = (at: number): string =>
    /\/([^\s/<>()[\]{}%]+)\s*$/.exec(body.slice(Math.max(0, at - 80), at))?.[1] ?? '-';
  let objStart = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '%') {
      const eol = body.slice(i).search(/[\r\n]/);
      i = eol === -1 ? body.length : i + eol;
    } else if (ch === '(') {
      const key = keyBefore(i);
      let depthParens = 1;
      let raw = '';
      i++;
      while (i < body.length && depthParens > 0) {
        const c = body[i] ?? '';
        if (c === '\\') {
          const next = body[i + 1] ?? '';
          const octal = /^[0-7]{1,3}/.exec(body.slice(i + 1, i + 4))?.[0];
          if (octal !== undefined) {
            raw += String.fromCharCode(Number.parseInt(octal, 8) & 0xff);
            i += 1 + octal.length;
          } else {
            if (next === '\r' && body[i + 2] === '\n') i++;
            else if (next !== '\r' && next !== '\n') raw += LITERAL_ESCAPES[next] ?? next;
            i += 2;
          }
          continue;
        }
        if (c === '(') depthParens++;
        if (c === ')') depthParens--;
        if (depthParens > 0) raw += c;
        i++;
      }
      for (const text of decodePdfString(raw)) out.push({ key, text });
    } else if (ch === '<' && body[i + 1] === '<') {
      i += 2;
    } else if (ch === '<') {
      const end = body.indexOf('>', i);
      const hex = body.slice(i + 1, end === -1 ? body.length : end).replace(/[^0-9A-Fa-f]/g, '');
      const raw = Buffer.from(hex.length % 2 === 0 ? hex : `${hex}0`, 'hex').toString('latin1');
      const key = keyBefore(i);
      for (const text of decodePdfString(raw)) out.push({ key, text });
      if (!raw.startsWith('\xfe\xff')) out.push({ key, text: utf16be(Buffer.from(raw, 'latin1')) });
      i = end === -1 ? body.length : end + 1;
    } else if (body.startsWith('obj', i) && /\s/.test(body[i - 1] ?? '')) {
      objStart = i;
      i += 3;
    } else if (
      body.startsWith('stream', i) &&
      /[\s>]/.test(body[i - 1] ?? '') &&
      /[\r\n]/.test(body[i + 6] ?? '')
    ) {
      let start = i + 6;
      if (body[start] === '\r') start++;
      if (body[start] === '\n') start++;
      const end = body.indexOf('endstream', start);
      const dict = body.slice(objStart, i);
      if (depth === 0 && /\/Type\s*\/ObjStm\b/.test(dict)) {
        const data = body.slice(start, end === -1 ? body.length : end);
        if (!/\/Filter\b/.test(dict)) {
          out.push(...pdfStrings(data, depth + 1));
        } else if (/\/Filter\s*\/FlateDecode\b/.test(dict) && !/\/DecodeParms\b/.test(dict)) {
          try {
            out.push(
              ...pdfStrings(inflateSync(Buffer.from(data, 'latin1')).toString('latin1'), depth + 1),
            );
          } catch {
            // An object stream that does not inflate holds nothing this scan can read.
          }
        }
      }
      i = end === -1 ? body.length : end + 'endstream'.length;
    } else {
      i++;
    }
  }
  return out;
}

/** Whether the file has an encryption dictionary (its strings are then ciphertext in the bytes). */
const isEncrypted = (bytes: Uint8Array): boolean =>
  /\/Encrypt\b/.test(Buffer.from(bytes).toString('latin1'));

/**
 * The object strings to scan: from qpdf's decrypted, uncompressed QDF form of the file when
 * `qpdfPath` is set (`--decrypt --qdf --object-streams=disable --stream-data=uncompress`);
 * without qpdf, from the bytes themselves (object streams inflated), or null for an encrypted
 * file, whose strings only qpdf can decrypt here.
 */
function objectStrings(
  bytes: Uint8Array,
  password: string | undefined,
  qpdfPath: string | undefined,
  scratch: string,
): { key: string; text: string }[] | null {
  if (qpdfPath === undefined || qpdfPath === '') {
    if (isEncrypted(bytes)) return null;
    return pdfStrings(Buffer.from(bytes).toString('latin1'));
  }
  const input = join(scratch, 'contacts-in.pdf');
  const output = join(scratch, 'contacts-qdf.pdf');
  writeFileSync(input, bytes);
  rmSync(output, { force: true });
  const pw = password === undefined ? [] : [`--password=${password}`];
  const run = qpdf(qpdfPath, [
    ...pw,
    '--decrypt',
    '--qdf',
    '--object-streams=disable',
    '--stream-data=uncompress',
    input,
    output,
  ]);
  if ((run.status !== 0 && run.status !== 3) || !existsSync(output))
    throw new Error(`qpdf --qdf exit ${run.status}: ${run.stdout.split('\n')[0] ?? ''}`);
  return pdfStrings(readFileSync(output).toString('latin1'));
}

interface ContactScan {
  hits: ContactHit[];
  /** True when the object strings were not read (an encrypted file and no qpdf). */
  stringsSkipped: boolean;
}

/**
 * Every e-mail, IP address and telephone pattern in the pdf.js text and annotations of every
 * page, the form values, the embedded file names, the Info and the XMP, and in the object
 * strings (objectStrings). One hit per place, kind and value.
 */
function contactScan(
  read: PdfjsRead,
  strings: readonly { key: string; text: string }[] | null,
): ContactScan {
  const hits = [
    ...read.pageTexts.flatMap((text, i) => contactHitsIn(`page ${i + 1}`, text)),
    ...read.annotationTexts.flatMap((text, i) => contactHitsIn(`page ${i + 1} annotations`, text)),
    ...contactHitsIn('form values', read.fieldValues),
    ...contactHitsIn('embedded files', read.attachments),
    ...contactHitsIn('Info', read.info),
    ...contactHitsIn('XMP', read.xmp),
    ...(strings ?? []).flatMap(({ key, text }) =>
      contactHitsIn(`strings ${key === '-' ? '-' : `/${key}`}`, text),
    ),
  ];
  const seen = new Set<string>();
  return {
    hits: hits.filter((hit) => {
      const id = `${hit.where}\0${hit.kind}\0${hit.value}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
    stringsSkipped: strings === null,
  };
}

const printHits = (id: string, hits: readonly ContactHit[]): void => {
  for (const hit of hits)
    console.log(`${id}: contact data: ${hit.where}: ${hit.kind} ${hit.value}`);
};

/**
 * The contact-data scan over every manifest file (pdf.js, offline; the object strings through
 * qpdf when `QPDF` is set, see objectStrings). Prints each hit with its place. An entry recorded
 * as `contactData: "none"` with a hit is a problem, and so is one recorded as `"institutional"`
 * whose complete scan finds nothing. Every other entry whose object strings were skipped counts
 * as unconfirmed, whether it records `"none"` or `"institutional"`: only a run with `QPDF` set
 * confirms those entries. Run by --contacts and by --check.
 */
async function scanContacts(manifestPath: string): Promise<number> {
  const dir = resolve(manifestPath, '..');
  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as Entry[];
  const qpdfPath = process.env['QPDF'];
  const problems: string[] = [];
  let withHits = 0;
  let skipped = 0;
  let unconfirmed = 0;
  const scratch = mkdtempSync(join(tmpdir(), 'corpus-contacts-'));
  try {
    for (const entry of entries) {
      const bytes = new Uint8Array(readFileSync(join(dir, entry.file)));
      const password = entry.password ?? undefined;
      let scan: ContactScan;
      try {
        scan = contactScan(
          await pdfjsOracle(bytes, password),
          objectStrings(bytes, password, qpdfPath, scratch),
        );
      } catch (error) {
        problems.push(`${entry.id}: the contact scan cannot read it: ${(error as Error).message}`);
        continue;
      }
      const { hits, stringsSkipped } = scan;
      printHits(entry.id, hits);
      if (stringsSkipped) skipped++;
      if (hits.length > 0) withHits++;
      if (hits.length > 0 && entry.contactData !== 'institutional')
        problems.push(`${entry.id}: ${hits.length} contact-data hits, manifest says "none"`);
      else if (stringsSkipped) {
        unconfirmed++;
        console.log(
          `${entry.id}: contactData "${entry.contactData}" unconfirmed (encrypted, QPDF not set)`,
        );
      } else if (hits.length === 0 && entry.contactData === 'institutional')
        problems.push(`${entry.id}: no contact-data hits, manifest says "institutional"`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  for (const problem of problems) console.error(problem);
  console.log(
    `contact scan: ${entries.length} files scanned, ${withHits} with contact-data hits, ` +
      `object strings ${qpdfPath ? 'read through qpdf' : 'read from the bytes'}, ` +
      `${skipped} files' object strings skipped (encrypted, QPDF not set), ` +
      `${unconfirmed} entries unconfirmed, ${problems.length} problems`,
  );
  return problems.length === 0 ? 0 : 1;
}

/** JSON in the layout oxfmt gives it: objects expanded, primitive arrays inline when they fit. */
function formatJson(value: unknown, indent = '', prefix = 0): string {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (prefix + inline.length + 1 <= PRINT_WIDTH) return inline;
    }
    return `[\n${value.map((item) => `${inner}${formatJson(item, inner, inner.length)}`).join(',\n')}\n${indent}]`;
  }
  if (isRecord(value)) {
    const lines = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => {
        const head = `${inner}${JSON.stringify(key)}: `;
        return `${head}${formatJson(item, inner, head.length)}`;
      });
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

async function add(): Promise<number> {
  const url = values.add ?? '';
  const { id, licence, project, attribution } = values;
  const password = values.password;
  const category = values.category;
  const contactData = values['contact-data'];
  const contactReason = values['contact-reason'];
  const qpdfPath = process.env['QPDF'];
  const usage =
    'usage: node scripts/dev/corpus.ts --add <url> --id <id> --licence <spdx> --project <name> --attribution <text> [--password <pw>] [--category damaged] [--features <a,b>] [--text-sample <text>] [--fetch-unstable] [--contact-data institutional --contact-reason <text>]';
  if (
    id === undefined ||
    licence === undefined ||
    project === undefined ||
    attribution === undefined ||
    (contactData !== undefined && contactData !== 'institutional') ||
    (contactData === 'institutional') !== (contactReason !== undefined && contactReason !== '')
  ) {
    console.error(usage);
    return 2;
  }
  if (!url.startsWith('https://')) return fail(`${id}: the url must be https`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return fail(`${id}: the id must be kebab-case`);
  if (!Object.hasOwn(LICENCE_FILES, licence))
    return fail(`${id}: licence ${licence} is not in the allow-list`);
  if (category !== 'real' && category !== 'damaged')
    return fail(`${id}: category must be real or damaged`);
  if (qpdfPath === undefined || qpdfPath === '')
    return fail('QPDF is not set (path to the qpdf executable)');

  const scratch = mkdtempSync(join(tmpdir(), 'corpus-add-'));
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'corpus-admission/1.0' } });
    if (!response.ok) return fail(`${id}: download failed with HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > FILE_CAP)
      return fail(`${id}: ${bytes.length} bytes is over the ${FILE_CAP}-byte cap`);
    const file = join(scratch, 'candidate.pdf');
    writeFileSync(file, bytes);

    const library = await runAdmissionChild(file, password);
    if (library === null) return fail('over admission budget');
    console.log(`${id}: library ${JSON.stringify(library)}`);

    const pw = password === undefined ? [] : [`--password=${password}`];
    const qpdfCheck = qpdf(qpdfPath, [...pw, '--check', file]).status;
    if (qpdfCheck !== 0 && qpdfCheck !== 3) return fail(`${id}: qpdf --check exits ${qpdfCheck}`);
    if (category === 'damaged' && qpdfCheck !== 3)
      return fail(`${id}: --category damaged needs qpdf warnings (exit 3), got ${qpdfCheck}`);
    const npages = qpdf(qpdfPath, [...pw, '--show-npages', file]);
    const pages = Number.parseInt(npages.stdout, 10);
    if ((npages.status !== 0 && npages.status !== 3) || !(pages > 0))
      return fail(`${id}: qpdf --show-npages failed`);

    let oracle: Awaited<ReturnType<typeof pdfjsOracle>>;
    try {
      oracle = await pdfjsOracle(bytes, password);
    } catch (error) {
      return fail(`${id}: pdf.js cannot open it: ${(error as Error).message}`);
    }
    if (oracle.pages !== pages)
      console.warn(`${id}: pdf.js counts ${oracle.pages} pages, qpdf ${pages}`);
    console.log(`${id}: pdf.js page 1: ${oracle.page1.slice(0, 160)}`);
    const { hits } = contactScan(oracle, objectStrings(bytes, password, qpdfPath, scratch));
    printHits(id, hits);
    if (hits.length > 0 && contactData !== 'institutional')
      return fail(
        `${id}: ${hits.length} contact-data hits; a private person's contact data is not admitted ` +
          "(--contact-data institutional --contact-reason <text> only for an institution's own addresses or a placeholder identity)",
      );
    const sample = values['text-sample'];
    if (sample !== undefined && !oracle.page1.includes(normalise(sample)))
      return fail(`${id}: --text-sample is not in pdf.js's page-1 text`);

    const features = [
      ...detectFeatures(qpdfPath, file, password, scratch),
      ...(values.features?.split(',').filter((f) => f !== '') ?? []),
    ];
    const entry: Entry = {
      id,
      file: `${id}.pdf`,
      sha256: sha256(bytes),
      bytes: bytes.length,
      source: {
        project,
        url,
        retrieved: new Date().toISOString().slice(0, 10),
        ...(values['fetch-unstable'] ? { fetchStable: false as const } : {}),
      },
      licence,
      attribution,
      ...(hits.length > 0 && contactData === 'institutional'
        ? { contactData, contactDataReason: String(contactReason) }
        : { contactData: 'none' as const }),
      pdfVersion: oracle.version,
      producer: oracle.producer,
      features: [...new Set(features)],
      category,
      password: password ?? null,
      oracle: {
        qpdfCheck: qpdfCheck as 0 | 3,
        pages,
        pdfjsChars: oracle.chars,
        ...(sample === undefined ? {} : { textSample: sample }),
      },
    };

    const manifestPath =
      values.manifest === undefined ? DEFAULT_MANIFEST : resolve(values.manifest);
    const entries = existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Entry[]).filter((e) => e.id !== id)
      : [];
    entries.push(entry);
    entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    mkdirSync(resolve(manifestPath, '..'), { recursive: true });
    copyFileSync(file, join(resolve(manifestPath, '..'), entry.file));
    writeFileSync(manifestPath, `${formatJson(entries)}\n`);
    console.log(
      `${id}: admitted, ${entry.bytes} bytes, sha256 ${entry.sha256}, qpdf ${qpdfCheck}, ${pages} pages, ` +
        `features ${entry.features.join(' ')}`,
    );
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function fail(message: string): number {
  console.error(message);
  return 1;
}

// ---------------------------------------------------------------------------------------------

if (values['admit-child'] !== undefined) {
  await admitChild(values['admit-child'], values.password);
} else if (values.add !== undefined) {
  process.exitCode = await add();
} else if (values.check) {
  const manifestPath = values.manifest === undefined ? DEFAULT_MANIFEST : resolve(values.manifest);
  let code = check(manifestPath);
  if (code === 0) code = await scanContacts(manifestPath);
  if (code === 0 && manifestPath === DEFAULT_MANIFEST) {
    const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as Entry[];
    code = runTests(
      entries,
      values.summary === undefined ? undefined : resolve(values.summary),
      values.ledger === undefined ? undefined : resolve(values.ledger),
    );
  } else if (code === 0) {
    console.log(`--manifest names another file: ${TEST_FILE} was not run`);
  }
  process.exitCode = code;
} else if (values.fetch) {
  process.exitCode = await fetchAll(
    values.manifest === undefined ? DEFAULT_MANIFEST : resolve(values.manifest),
  );
} else if (values.contacts) {
  process.exitCode = await scanContacts(
    values.manifest === undefined ? DEFAULT_MANIFEST : resolve(values.manifest),
  );
} else {
  console.error(
    'usage: node scripts/dev/corpus.ts --check [--summary <path>] [--ledger <path>] [--manifest <path>] | --fetch [--manifest <path>] | --contacts [--manifest <path>] | --add <url> --id <id> ... (see the header)',
  );
  process.exitCode = 2;
}

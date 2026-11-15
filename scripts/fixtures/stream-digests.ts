/**
 * Records, and checks, the raw data of every stream object this library reads from the PDFs under
 * tests/fixtures, in tests/fixtures/expected/stream-digests.json.
 *
 *   pnpm exec tsx scripts/fixtures/stream-digests.ts --write-base   record the base section
 *   pnpm exec tsx scripts/fixtures/stream-digests.ts --write        record the section of new fixtures
 *   pnpm exec tsx scripts/fixtures/stream-digests.ts --check        exit 1 on any difference
 *
 * The record has two sections. `base` is what 0.40.8 read from the fixtures that existed then:
 * per file whether it loads, per stream object the data length and the SHA-256 of
 * `PdfStream.data` (the bytes between `stream` and `endstream`, before any filter), and, under
 * `dropped`, the in-use objects that 0.40.8 did not keep (a lenient load skips an object whose
 * parse fails). `added` holds the fixtures that came with this version, recorded from the code
 * that is current when `--write` runs and marked as new. Where qpdf reads an unencrypted file
 * (exit status 0, or 3 for warnings), each stream and dropped object also carries the SHA-256 of
 * qpdf's raw stream data for that object (`qpdf --json=2 --json-stream-data=inline
 * --decode-level=none`); qpdf decrypts an encrypted file, so its digest is not recorded there.
 *
 * Each fixture is loaded with `PdfDocumentParser.parse({ ignoreEncryption: true })`: an
 * unencrypted file loads as `loadPdf` loads it (leniently), and an encrypted one keeps its stream
 * data as stored in the file, so the digests describe how stream data is framed, not how it is
 * decrypted.
 *
 * `STREAM_DIGESTS_ROOT` names the repository root whose `src` and `tests/fixtures` are loaded; it
 * defaults to this repository. `--write-base` is run with it pointing at a checkout of 0.40.8, it
 * replaces the base section and empties `added` (run `--write` afterwards), and it is the only
 * mode that changes the base. `--write` rewrites `added` only, for the fixtures that are not in
 * the base, and refuses to run when the root is not this repository. Both need qpdf 12.4.2:
 * `QPDF` when that variable is set, else `qpdf` on PATH.
 *
 * `--check` fails when a file's load result differs from its record, when a recorded stream is
 * missing or its digest differs, when a stream appears that was neither recorded nor dropped,
 * when an object that the base dropped now loads with data that differs from the qpdf digest
 * recorded for it, and, for a new fixture, when its dropped objects differ. It does not run
 * qpdf.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QPDF = process.env['QPDF'] ?? 'qpdf';
const QPDF_VERSION = 'qpdf version 12.4.2';
const QPDF_MAX_OUTPUT = 512 * 1024 * 1024;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoot =
  process.env['STREAM_DIGESTS_ROOT'] === undefined
    ? repoRoot
    : resolve(process.env['STREAM_DIGESTS_ROOT']);
const fixtureRoot = join(sourceRoot, 'tests/fixtures');
const recordPath = join(repoRoot, 'tests/fixtures/expected/stream-digests.json');

// The two modules come from the tree under `sourceRoot` and are typed as this repository's.
const { PdfStream } = (await import(
  pathToFileURL(join(sourceRoot, 'src/core/pdfObjects.ts')).href
)) as typeof import('../../src/core/pdfObjects.js');
const { PdfDocumentParser } = (await import(
  pathToFileURL(join(sourceRoot, 'src/parser/documentParser.ts')).href
)) as typeof import('../../src/parser/documentParser.js');
type PdfDocumentParserInstance = InstanceType<typeof PdfDocumentParser>;

/** One stream object the load keeps. */
interface StreamRecord {
  readonly length: number;
  readonly sha256: string;
  /** qpdf's raw stream data digest; null where qpdf was not asked or has no stream there. */
  readonly qpdfSha256: string | null;
}

/** One in-use object the load does not keep. */
interface DroppedRecord {
  /** qpdf's raw stream data digest when qpdf reads the object as a stream, else null. */
  readonly qpdfSha256: string | null;
}

interface FileRecord {
  readonly loads: boolean;
  readonly encrypted: boolean;
  /** qpdf's exit status for the JSON read (0 clean, 3 warnings); null where it did not run. */
  readonly qpdfStatus: number | null;
  readonly streams: Record<string, StreamRecord>;
  readonly dropped: Record<string, DroppedRecord>;
}

/** The fixtures of one recording. */
interface Section {
  readonly about: string;
  readonly files: Record<string, FileRecord>;
}

interface DigestFile {
  readonly about: string;
  readonly qpdf: string;
  /** What 0.40.8 read from the fixtures that existed then. */
  readonly base: Section;
  /** Fixtures added by 0.40.9, recorded from the code current at `--write`. */
  readonly added: Section;
}

/** What the load of one file gives: the kept streams' data and the dropped object numbers. */
interface LoadResult {
  readonly loads: boolean;
  readonly error?: string;
  readonly streams: Map<number, Uint8Array>;
  readonly dropped: number[];
}

/** The parser's state after parse() that this script reads; both fields are private there. */
interface ParserState {
  readonly xrefEntries: Map<number, { readonly type: string }>;
  readonly objectCache: Map<number, unknown>;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Every *.pdf under tests/fixtures, as sorted paths relative to it with forward slashes. */
function fixtureFiles(): string[] {
  return readdirSync(fixtureRoot, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => name.replaceAll('\\', '/'))
    .toSorted();
}

function parserState(parser: PdfDocumentParserInstance): ParserState {
  const state = parser as unknown as Partial<ParserState>;
  if (!(state.xrefEntries instanceof Map) || !(state.objectCache instanceof Map)) {
    throw new Error(
      'PdfDocumentParser no longer holds xrefEntries and objectCache maps; ' +
        'update scripts/fixtures/stream-digests.ts to read the loaded objects another way',
    );
  }
  return state as ParserState;
}

async function loadFixture(bytes: Uint8Array): Promise<LoadResult> {
  const parser = new PdfDocumentParser(bytes);
  try {
    await parser.parse({ ignoreEncryption: true });
  } catch (err) {
    return {
      loads: false,
      error: err instanceof Error ? (err.message.split('\n')[0] ?? '') : String(err),
      streams: new Map(),
      dropped: [],
    };
  }
  const { xrefEntries, objectCache } = parserState(parser);
  const streams = new Map<number, Uint8Array>();
  const dropped: number[] = [];
  for (const [objNum, entry] of xrefEntries) {
    if (entry.type !== 'in-use' && entry.type !== 'compressed') continue;
    const object = objectCache.get(objNum);
    if (object === undefined) dropped.push(objNum);
    else if (object instanceof PdfStream) streams.set(objNum, object.data);
  }
  return { loads: true, streams, dropped: dropped.toSorted((a, b) => a - b) };
}

/** `qpdf --is-encrypted` exits 0 for an encrypted file and 2 for an unencrypted one. */
function qpdfIsEncrypted(path: string): boolean {
  const result = spawnSync(QPDF, ['--is-encrypted', path]);
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 && result.status !== 2) {
    throw new Error(`qpdf --is-encrypted exited ${result.status} for ${path}`);
  }
  return result.status === 0;
}

/** qpdf's raw stream data digest per object number, and qpdf's exit status. */
function qpdfStreamDigests(path: string): {
  readonly status: number | null;
  readonly digests: Map<number, string>;
} {
  const result = spawnSync(
    QPDF,
    [
      '--json=2',
      '--json-key=qpdf',
      '--json-stream-data=inline',
      '--decode-level=none',
      '--no-warn',
      path,
    ],
    { encoding: 'utf8', maxBuffer: QPDF_MAX_OUTPUT },
  );
  if (result.error !== undefined) throw result.error;
  const digests = new Map<number, string>();
  if (result.status !== 0 && result.status !== 3) return { status: result.status, digests };
  const json = JSON.parse(result.stdout) as { qpdf: [unknown, Record<string, unknown>] };
  for (const [key, value] of Object.entries(json.qpdf[1])) {
    const match = /^obj:(\d+) \d+ R$/.exec(key);
    const data = (value as { stream?: { data?: string } }).stream?.data;
    if (match === null || data === undefined) continue;
    digests.set(Number(match[1]), sha256(Uint8Array.fromBase64(data)));
  }
  return { status: result.status, digests };
}

function requireQpdf(): string {
  const result = spawnSync(QPDF, ['--version'], { encoding: 'utf8' });
  const version = result.status === 0 ? result.stdout.split(/\r?\n/)[0]?.trim() : undefined;
  if (version !== QPDF_VERSION) {
    throw new Error(`${QPDF_VERSION} is required (set QPDF), found ${version ?? 'none'}`);
  }
  return version;
}

/** The record of `names`, loaded from the tree under `sourceRoot`, with qpdf's digests. */
async function recordFiles(names: readonly string[]): Promise<Record<string, FileRecord>> {
  const files: Record<string, FileRecord> = {};
  let loaded = 0;
  let streamCount = 0;
  let droppedCount = 0;
  let qpdfCompared = 0;
  let qpdfDiffer = 0;
  for (const file of names) {
    const path = join(fixtureRoot, file);
    const bytes = new Uint8Array(readFileSync(path));
    const load = await loadFixture(bytes);
    const encrypted = qpdfIsEncrypted(path);
    const fromQpdf = encrypted ? undefined : qpdfStreamDigests(path);
    const qpdfDigest = (objNum: number): string | null => fromQpdf?.digests.get(objNum) ?? null;
    const streams: Record<string, StreamRecord> = {};
    for (const [objNum, data] of load.streams) {
      const digest = sha256(data);
      const qpdfSha256 = qpdfDigest(objNum);
      if (qpdfSha256 !== null) {
        qpdfCompared++;
        if (qpdfSha256 !== digest) {
          qpdfDiffer++;
          process.stdout.write(`  qpdf differs: ${file} object ${objNum}\n`);
        }
      }
      streams[objNum] = { length: data.length, sha256: digest, qpdfSha256 };
    }
    const dropped: Record<string, DroppedRecord> = {};
    for (const objNum of load.dropped) dropped[objNum] = { qpdfSha256: qpdfDigest(objNum) };
    files[file] = {
      loads: load.loads,
      encrypted,
      qpdfStatus: fromQpdf?.status ?? null,
      streams,
      dropped,
    };
    if (load.loads) loaded++;
    streamCount += load.streams.size;
    droppedCount += load.dropped.length;
    process.stdout.write(
      `${file}: ${load.loads ? `${load.streams.size} streams, ${load.dropped.length} dropped` : `does not load (${load.error})`}\n`,
    );
  }
  process.stdout.write(
    `files ${names.length}; loaded ${loaded}; streams ${streamCount}; dropped ${droppedCount}; ` +
      `qpdf digests compared ${qpdfCompared}, differing ${qpdfDiffer}\n`,
  );
  return files;
}

function readRecord(): DigestFile {
  return JSON.parse(readFileSync(recordPath, 'utf8')) as DigestFile;
}

function saveRecord(record: DigestFile): void {
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`wrote ${relative(repoRoot, recordPath).replaceAll('\\', '/')}\n`);
}

const BASE_ABOUT =
  'What 0.40.8 read from the fixtures that existed then, recorded by running ' +
  'scripts/fixtures/stream-digests.ts --write-base against that version. Only --write-base changes it.';
const ADDED_ABOUT =
  'New in 0.40.9: fixtures that 0.40.8 never read, recorded from the code current at ' +
  'scripts/fixtures/stream-digests.ts --write.';

/** Records the base section from the tree under `STREAM_DIGESTS_ROOT`; empties `added`. */
async function writeBase(): Promise<void> {
  const qpdf = requireQpdf();
  const files = await recordFiles(fixtureFiles());
  saveRecord({
    about:
      'Raw stream data digests of the fixtures as loaded with ignoreEncryption: the base section ' +
      'is what 0.40.8 read, the added section is new in 0.40.9. Written by ' +
      'scripts/fixtures/stream-digests.ts, checked by --check.',
    qpdf,
    base: { about: BASE_ABOUT, files },
    added: { about: ADDED_ABOUT, files: {} },
  });
  process.stdout.write('the added section is empty: run --write next\n');
}

/** Records the fixtures that the base does not hold, from the current code; the base stays. */
async function writeAdded(): Promise<void> {
  if (sourceRoot !== repoRoot) {
    throw new Error(
      '--write records the current code: unset STREAM_DIGESTS_ROOT, or use --write-base',
    );
  }
  const record = readRecord();
  const qpdf = requireQpdf();
  const onDisk = fixtureFiles();
  const gone = Object.keys(record.base.files).filter((file) => !onDisk.includes(file));
  if (gone.length > 0) {
    throw new Error(`base fixtures missing under tests/fixtures: ${gone.join(', ')}`);
  }
  const files = await recordFiles(onDisk.filter((file) => record.base.files[file] === undefined));
  saveRecord({ ...record, qpdf, added: { about: ADDED_ABOUT, files } });
}

/**
 * Compares one file's load with its record and appends the differences to `problems`. Returns how
 * many objects that the base dropped now load as streams.
 */
function compareFile(
  file: string,
  recorded: FileRecord,
  load: LoadResult,
  isBase: boolean,
  problems: string[],
): number {
  let nowLoaded = 0;
  if (load.loads !== recorded.loads) {
    problems.push(`${file}: loads ${load.loads}, recorded ${recorded.loads} (${load.error ?? ''})`);
    return 0;
  }
  for (const [objNum, expected] of Object.entries(recorded.streams)) {
    const data = load.streams.get(Number(objNum));
    if (data === undefined) problems.push(`${file} object ${objNum}: stream no longer loaded`);
    else if (data.length !== expected.length || sha256(data) !== expected.sha256) {
      problems.push(
        `${file} object ${objNum}: ${data.length} bytes, recorded ${expected.length}; digest differs`,
      );
    }
  }
  for (const [objNum, data] of load.streams) {
    if (recorded.streams[objNum] !== undefined) continue;
    const wasDropped = recorded.dropped[objNum];
    if (wasDropped === undefined) {
      problems.push(`${file} object ${objNum}: stream neither recorded nor dropped`);
      continue;
    }
    if (!isBase) {
      problems.push(`${file} object ${objNum}: recorded as dropped, now loads as a stream`);
      continue;
    }
    nowLoaded++;
    if (wasDropped.qpdfSha256 !== null && wasDropped.qpdfSha256 !== sha256(data)) {
      problems.push(`${file} object ${objNum}: now loads, data differs from qpdf's`);
    }
  }
  if (!isBase) {
    const recordedDropped = Object.keys(recorded.dropped).map(Number);
    if (recordedDropped.join() !== load.dropped.join()) {
      problems.push(
        `${file}: dropped objects ${load.dropped.join()}, recorded ${recordedDropped.join()}`,
      );
    }
  }
  return nowLoaded;
}

async function check(): Promise<number> {
  const record = readRecord();
  const problems: string[] = [];
  let nowLoaded = 0;
  const current = fixtureFiles();
  for (const section of [record.base, record.added]) {
    for (const file of Object.keys(section.files)) {
      if (!current.includes(file)) {
        problems.push(`${file}: recorded but no longer under tests/fixtures`);
      }
    }
  }
  for (const file of current) {
    const inBase = record.base.files[file];
    const inAdded = record.added.files[file];
    const recorded = inBase ?? inAdded;
    if (recorded === undefined) {
      problems.push(`${file}: not recorded (run --write after adding a fixture)`);
      continue;
    }
    if (inBase !== undefined && inAdded !== undefined) {
      problems.push(`${file}: recorded in both sections`);
    }
    const load = await loadFixture(new Uint8Array(readFileSync(join(fixtureRoot, file))));
    nowLoaded += compareFile(file, recorded, load, inBase !== undefined, problems);
  }
  const droppedTotal = Object.values(record.base.files).reduce(
    (sum, f) => sum + Object.keys(f.dropped).length,
    0,
  );
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.stdout.write(
    `${problems.length === 0 ? 'stream digests match' : `${problems.length} differences`}; ` +
      `${nowLoaded} of ${droppedTotal} recorded dropped objects now load as streams\n`,
  );
  return problems.length === 0 ? 0 : 1;
}

const mode = process.argv[2];
if (mode === '--write-base') await writeBase();
else if (mode === '--write') await writeAdded();
else if (mode === '--check') process.exitCode = await check();
else {
  process.stderr.write('usage: stream-digests.ts --write-base | --write | --check\n');
  process.exitCode = 2;
}

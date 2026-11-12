/**
 * G-CORPUS: every third-party file of tests/fixtures/corpus/ goes through the public load
 * surface, and both of its re-saves go through qpdf.
 *
 * One `describe(<id>)` per manifest.json entry, eight checks each, in order:
 *   1. sha256: the committed bytes hash to the manifest value (never keyed).
 *   2. loads: `loadPdf(bytes, { password })` resolves.
 *   3. no fallback (category real): that load called `XrefParser#rebuildXrefFromScan` zero times
 *      and a strict load (`throwOnInvalidObject: true`) resolves; recovers (category damaged):
 *      the load resolves.
 *   4. page count: equals `oracle.pages` (qpdf's count at admission).
 *   5. getText: text extraction from every page's content stream does not throw, and page 1
 *      contains `oracle.textSample` when the manifest has one (whitespace-normalised).
 *   6. save and reload: `save({ compress: false })` resolves, the output loads with the same
 *      password, and it has `oracle.pages` pages.
 *   7. qpdf --check of that output (the `compress: false` save) exits 0; exit 3 is accepted only
 *      for the input (manifest `oracle.qpdfCheck`), never for this library's output. Skipped
 *      where qpdf is absent locally; required in CI (tests/helpers/oracle/qpdf.ts).
 *   8. qpdf --check of the default save (`save()`, compress true), with the same rule as check 7.
 *
 * The library work for one file (load, scan count, strict load, text, both saves, reload) runs
 * once in the file's beforeAll and each check asserts on its recorded outcome; a failed step
 * stores its error, and every later step that needs its result rethrows that same error. The
 * saves happen outside the tests, so the oracle setup guard does not see them; checks 7 and 8 are
 * the qpdf passes over those bytes.
 *
 * A check that fails because of a known open defect is a knownDefect marker
 * (tests/helpers/known-defect.ts) keyed in KNOWN below. Cascade rule: when loads is keyed,
 * checks 3-8 carry the same key (they fail with the load error); when loads passes, each later
 * check carries its own key. A marker whose check starts passing fails the run: the release that
 * fixes the id deletes the entry or re-keys it to the next blocking id. pdf.js agreement
 * (manifest `oracle.pdfjsChars`) is report-only and not checked here. `node scripts/dev/corpus.ts
 * --check` runs this file and writes the per-release summary.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import type { TestContext } from 'vitest';
import { extractText, loadPdf, parseContentStream } from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { XrefParser } from '../../src/parser/xrefParser.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import type { DefectKey } from '../helpers/known-defect.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

interface CorpusEntry {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
  readonly category: 'real' | 'damaged';
  readonly password: string | null;
  readonly oracle: {
    readonly qpdfCheck: 0 | 3;
    readonly pages: number;
    readonly pdfjsChars: number;
    readonly textSample?: string;
  };
}

type Check = 'loads' | 'fallback' | 'pages' | 'text' | 'save' | 'qpdf' | 'qpdfDefault';

const DIR = new URL('../fixtures/corpus/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', DIR), 'utf8'),
) as readonly CorpusEntry[];

// ---------------------------------------------------------------------------------------------
// Known open defects: file id -> check -> key and the error the check shows while it is open.
// ---------------------------------------------------------------------------------------------

/**
 * Provisional ids for failures that no audit/open-highs.json entry covers yet, each
 * with a one-line reason. `node scripts/dev/corpus.ts --check` accepts a marker id only when it
 * is in the ledger or in this block. The text-extraction gap (text drawn inside a Form XObject is
 * not extracted) keys nothing in 0.40.6: it is report-only, and every textSample in the manifest
 * comes from page content.
 */
const PROVISIONAL_IDS: Readonly<Record<string, string>> = {
  'corpus-P02':
    'save copies Flate streams it read byte for byte, so qpdf warns on the output about input streams it already warned on',
};

interface Known {
  readonly key: DefectKey;
  readonly failsWith: RegExp;
}

const TEXT_MISSING = /^AssertionError: expected '.*' to contain '/;

// Xref streams and object streams are read as raw DEFLATE: the load falls into the recovery
// scan and then misses /Pages or /Root inside the object streams, or loads only through it.
const RAW_XREF = defectKey('parser-syntax-M01', '0.40.8');
const PAGES_IN_OBJSTM: Known = {
  key: RAW_XREF,
  failsWith: /^PdfParseError: Invalid PDF: \/Pages entry is not a dictionary \(got null\)/,
};
const ROOT_IN_OBJSTM: Known = {
  key: RAW_XREF,
  failsWith: /^PdfParseError: Invalid PDF: recovery scan could not locate the document catalog/,
};
const SCANNED: Known = {
  key: RAW_XREF,
  failsWith: /^AssertionError: recovery scans: expected 1 to be \+0/,
};
/** Every check after sha256 fails with the load error. */
const cascade = (known: Known): Record<Check, Known> => ({
  loads: known,
  fallback: known,
  pages: known,
  text: known,
  save: known,
  qpdf: known,
  qpdfDefault: known,
});

// A stream whose /Length is an indirect object defined later is dropped on load (the strict
// load throws), so the page content it held is empty.
const FORWARD_LENGTH = defectKey('parser-syntax-M03', '0.40.9');
const STRICT_LOAD_THROWS: Known = {
  key: FORWARD_LENGTH,
  failsWith: /^PdfParseError: Failed to parse indirect object \d+ 0 at offset \d+/,
};
const CONTENT_DROPPED: Known = {
  key: FORWARD_LENGTH,
  failsWith: /^AssertionError: expected '' to contain '/,
};
const FORWARD_LENGTH_FILE = { fallback: STRICT_LOAD_THROWS, text: CONTENT_DROPPED };

/** The failsWith patterns that qpdfFindsOnly built. */
const QPDF_PATTERNS = new WeakSet<RegExp>();

/**
 * failsWith for a qpdf --check of a saved file: the QpdfError of that exit code
 * whose WARNING and ERROR lines are each one of `kinds` (each kind matches a whole line, from
 * `WARNING:` or `ERROR:` on), so a new kind of warning or error in the output fails the marker.
 * The lines before the first WARNING or ERROR (`checking in.pdf`, the version, encryption and
 * linearization lines) may be anything else; the last line is qpdf's summary for that exit code.
 */
function qpdfFindsOnly(exit: 2 | 3, ...kinds: readonly RegExp[]): RegExp {
  const kind = kinds.map((k) => `(?:${k.source})`).join('|');
  const summary = exit === 3 ? 'operation succeeded with warnings' : 'errors detected';
  const pattern = new RegExp(
    `^QpdfError: qpdf --check exit ${exit}: (?:(?!WARNING|ERROR)[^|]*\\| )*(?:(?:${kind}) \\| )+qpdf: ${summary}$`,
  );
  QPDF_PATTERNS.add(pattern);
  return pattern;
}

/** qpdf cannot inflate a /FlateDecode stream of the output, for one of `causes`. */
const inflateFails = (causes: RegExp): RegExp =>
  new RegExp(
    `WARNING: in\\.pdf \\(offset \\d+\\): error decoding stream data for object \\d+ 0: stream inflate: inflate: data: (?:${causes.source})`,
  );
const REPROCESSED =
  /WARNING: in\.pdf \(offset \d+\): stream will be re-processed without filtering to avoid data loss/;
const CONTENT_UNDECODABLE =
  /ERROR: page \d+: content stream \(content stream object \d+ 0\): errors while decoding content stream/;

// An encrypted file loads with its streams still encrypted: text extraction cannot inflate them,
// and the re-save writes the ciphertext under /FlateDecode without /Encrypt.
const CIPHERTEXT = defectKey('parser-syntax-01', '0.40.9');
const CIPHERTEXT_SAVED: Known = {
  key: CIPHERTEXT,
  failsWith: qpdfFindsOnly(
    2,
    inflateFails(/incorrect header check|zlib unknown error \(2\)/),
    REPROCESSED,
    CONTENT_UNDECODABLE,
  ),
};
const CIPHERTEXT_FILE = {
  text: { key: CIPHERTEXT, failsWith: /^Error: FlateDecode: failed to decompress data/ },
  qpdf: CIPHERTEXT_SAVED,
  qpdfDefault: CIPHERTEXT_SAVED,
};

// The default save (compress true) writes the loaded content streams as raw DEFLATE under
// /FlateDecode, so qpdf cannot inflate them.
const RAW_DEFLATE_WRITER: Known = {
  key: defectKey('parser-syntax-M02', '0.40.8'),
  failsWith: qpdfFindsOnly(
    2,
    inflateFails(/unknown compression method|incorrect header check/),
    REPROCESSED,
    CONTENT_UNDECODABLE,
  ),
};
const RAW_DEFLATE_FILE = { qpdfDefault: RAW_DEFLATE_WRITER };

// Fonts given as indirect references are skipped, so their ToUnicode maps are not applied.
const INDIRECT_FONTS: Known = {
  key: defectKey('parser-text-01', '0.41.6'),
  failsWith: TEXT_MISSING,
};

// The saved file keeps an input stream that qpdf warns about unchanged (exit 3 is accepted only
// for an input, never for this library's output).
const COPIED_DAMAGED_STREAMS: Known = {
  key: defectKey('corpus-P02', '0.40.9'),
  failsWith: qpdfFindsOnly(
    3,
    /WARNING: in\.pdf \(offset \d+\): input stream is complete but output may still be valid/,
  ),
};

// The re-saved content stream still holds the ciphertext: qpdf parses it as content and warns
// on the tokens it cannot read.
const CIPHERTEXT_CONTENT_PARSED: Known = {
  key: RAW_XREF,
  failsWith: qpdfFindsOnly(
    3,
    /WARNING: page object \d+ 0 stream \d+ 0 \(content, offset \d+\): (?:unexpected >|EOF while reading token)/,
  ),
};

const KNOWN: Readonly<Record<string, Partial<Record<Check, Known>>>> = {
  'irs-fw4': cascade(PAGES_IN_OBJSTM),
  'irs-fw9': cascade(PAGES_IN_OBJSTM),
  'irs-p1-chinese': cascade(PAGES_IN_OBJSTM),
  'pdfjs-cid-truetype': { text: INDIRECT_FONTS },
  'pdfjs-jpx-subsampling': RAW_DEFLATE_FILE,
  // Loaded through the recovery scan, whose trailer has no /Encrypt: the content stays
  // ciphertext, so the text is empty and qpdf warns on both re-saved content streams.
  'pyhanko-aes256': {
    fallback: SCANNED,
    text: { key: RAW_XREF, failsWith: /^AssertionError: expected '' to contain '/ },
    qpdf: CIPHERTEXT_CONTENT_PARSED,
    qpdfDefault: CIPHERTEXT_CONTENT_PARSED,
  },
  'pyhanko-hybrid-msword': RAW_DEFLATE_FILE,
  'pyhanko-rc4': CIPHERTEXT_FILE,
  'pyhanko-signed-twice': RAW_DEFLATE_FILE,
  'pyhanko-ua-and-a': FORWARD_LENGTH_FILE,
  'qpdf-bad-xref': RAW_DEFLATE_FILE,
  'qpdf-damaged-stream': RAW_DEFLATE_FILE,
  // Category damaged (qpdf warns about its streams): no strict-load check, but the dropped
  // content still empties page 1. Both saves keep the three Flate streams qpdf warns about in
  // the input byte for byte, so qpdf warns on them in the output too.
  'qpdf-form-acrobat': {
    text: CONTENT_DROPPED,
    qpdf: COPIED_DAMAGED_STREAMS,
    qpdfDefault: COPIED_DAMAGED_STREAMS,
  },
  'qpdf-form-odt': FORWARD_LENGTH_FILE,
  'qpdf-hybrid-xref': FORWARD_LENGTH_FILE,
  // Category damaged: no strict-load check, but the dropped content still empties page 1.
  'qpdf-labels-damaged': { text: CONTENT_DROPPED },
  'qpdf-linearized': RAW_DEFLATE_FILE,
  'qpdf-objstm-xref': cascade(ROOT_IN_OBJSTM),
  'qpdf-r3-rc4': FORWARD_LENGTH_FILE,
  'qpdf-r4-aes': cascade({
    key: defectKey('crypto-security-M01', '0.40.9'),
    failsWith: /^SyntaxError: Input string must contain hex characters in even length/,
  }),
  'qpdf-r4-rc4': CIPHERTEXT_FILE,
  'qpdf-r6-acrobat-xi': cascade(PAGES_IN_OBJSTM),
  'qpdf-r6-attachments': cascade(PAGES_IN_OBJSTM),
  'qpdf-signed': cascade(PAGES_IN_OBJSTM),
  'vera-ua1-tagged': { fallback: SCANNED },
};

// ---------------------------------------------------------------------------------------------

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

async function attempt<T>(run: () => Promise<T> | T): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Runs `run` on a step's value, or passes the step's failure on unchanged. */
async function after<T, U>(
  outcome: Outcome<T>,
  run: (value: T) => Promise<U> | U,
): Promise<Outcome<U>> {
  return outcome.ok ? attempt(() => run(outcome.value)) : outcome;
}

function unwrap<T>(outcome: Outcome<T>): T {
  if (outcome.ok) return outcome.value;
  throw outcome.error;
}

interface Pass {
  readonly load: Outcome<PdfDocument>;
  /** Calls of the full-file recovery scan during `load`. */
  readonly scans: number;
  readonly strict: Outcome<PdfDocument>;
  readonly pageCount: Outcome<number>;
  readonly text: Outcome<string[]>;
  readonly saved: Outcome<Uint8Array>;
  /** `save()` with its defaults (compress true). */
  readonly savedDefault: Outcome<Uint8Array>;
  readonly reloadedPages: Outcome<number>;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bytesOf = (entry: CorpusEntry): Uint8Array =>
  new Uint8Array(readFileSync(new URL(entry.file, DIR)));
const loadOptions = (entry: CorpusEntry): { password?: string } =>
  entry.password === null ? {} : { password: entry.password };

async function runLibrary(entry: CorpusEntry): Promise<Pass> {
  const bytes = bytesOf(entry);
  const options = loadOptions(entry);
  // rebuildXrefFromScan is private; the cast reaches it without a change to src/.
  const scan = vi.spyOn(
    XrefParser.prototype as unknown as { rebuildXrefFromScan(): unknown },
    'rebuildXrefFromScan',
  );
  let load: Outcome<PdfDocument>;
  let scans: number;
  try {
    load = await attempt(() => loadPdf(bytes, options));
    scans = scan.mock.calls.length;
  } finally {
    scan.mockRestore();
  }
  const strict = await attempt(() => loadPdf(bytes, { ...options, throwOnInvalidObject: true }));
  const pageCount = await after(load, (doc) => doc.getPageCount());
  // Text comes before save: save rewrites the loaded content stream objects.
  const text = await after(load, (doc) =>
    Array.from({ length: doc.getPageCount() }, (_, i) => {
      const page = doc.getPage(i);
      return extractText(parseContentStream(page.getContentStream()), page.getOriginalResources());
    }),
  );
  const saved = await after(load, (doc) => doc.save({ compress: false }));
  const savedDefault = await after(load, (doc) => doc.save());
  const reloadedPages = await after(saved, async (out) =>
    (await loadPdf(out, options)).getPageCount(),
  );
  return { load, scans, strict, pageCount, text, saved, savedDefault, reloadedPages };
}

/**
 * qpdf --check of a saved file: exit 0 only. Exit 3 is accepted for an input (manifest
 * `oracle.qpdfCheck`), never for this library's output, so a save that draws warnings is a marker.
 */
function qpdfCheck(bytes: Uint8Array, entry: CorpusEntry): void {
  expectQpdfClean(bytes, loadOptions(entry));
}

/** A plain `test`, or a knownDefect marker when KNOWN lists the file and check. */
function check(
  entry: CorpusEntry,
  c: Check,
  what: string,
  body: (ctx: TestContext) => Promise<void> | void,
): void {
  const known = KNOWN[entry.id]?.[c];
  const title = `${entry.file} ${what}`;
  if (known === undefined) test(title, body);
  else knownDefect(known.key, title, { failsWith: known.failsWith }, body);
}

describe('corpus', () => {
  test('KNOWN names only manifest files, and every provisional id is used and has a reason', () => {
    const ids = new Set(manifest.map((entry) => entry.id));
    expect(Object.keys(KNOWN).filter((id) => !ids.has(id))).toEqual([]);
    const used = new Set(
      Object.values(KNOWN).flatMap((checks) =>
        Object.values(checks).flatMap((known) => known.key.ids),
      ),
    );
    for (const [id, reason] of Object.entries(PROVISIONAL_IDS)) {
      expect(id).toMatch(/^corpus-P\d{2,}$/);
      expect(used.has(id), `${id} is used by KNOWN`).toBe(true);
      expect(reason.trim(), `${id} reason`).not.toBe('');
    }
  });

  test('every qpdf marker names its warnings, so a new kind of warning fails it', () => {
    for (const [id, checks] of Object.entries(KNOWN)) {
      for (const c of ['qpdf', 'qpdfDefault'] as const) {
        // A cascade marker fails with the load error instead; only a qpdf failure is checked.
        const known = checks[c];
        if (known?.failsWith.source.startsWith('^QpdfError') === true)
          expect(QPDF_PATTERNS.has(known.failsWith), `${id} ${c} uses qpdfFindsOnly`).toBe(true);
      }
    }
    const head = 'QpdfError: qpdf --check exit 3: checking in.pdf | PDF Version: 1.7';
    const named =
      'WARNING: in.pdf (offset 9): input stream is complete but output may still be valid';
    const other = 'WARNING: in.pdf (offset 7): xref not found';
    const tail = 'qpdf: operation succeeded with warnings';
    const pattern = COPIED_DAMAGED_STREAMS.failsWith;
    expect([head, named, named, tail].join(' | ')).toMatch(pattern);
    expect([head, named, other, tail].join(' | ')).not.toMatch(pattern);
    expect([head, other, named, tail].join(' | ')).not.toMatch(pattern);
  });

  for (const entry of manifest) {
    describe(entry.id, () => {
      let pass: Pass;
      beforeAll(async () => {
        pass = await runLibrary(entry);
      });

      test(`${entry.file} sha256`, () => {
        expect(sha256(bytesOf(entry))).toBe(entry.sha256);
      });

      check(entry, 'loads', 'loads', () => {
        unwrap(pass.load);
      });

      if (entry.category === 'real') {
        check(entry, 'fallback', 'loads without the recovery scan, also strictly', () => {
          unwrap(pass.load);
          expect(pass.scans, 'recovery scans').toBe(0);
          unwrap(pass.strict);
        });
      } else {
        check(entry, 'fallback', 'recovers', () => {
          unwrap(pass.load);
        });
      }

      check(entry, 'pages', 'page count', () => {
        expect(unwrap(pass.pageCount)).toBe(entry.oracle.pages);
      });

      check(entry, 'text', 'getText', () => {
        const pages = unwrap(pass.text);
        const sample = entry.oracle.textSample;
        if (sample !== undefined) expect(normalise(pages[0] ?? '')).toContain(normalise(sample));
      });

      check(entry, 'save', 'save and reload', () => {
        unwrap(pass.saved);
        expect(unwrap(pass.reloadedPages)).toBe(entry.oracle.pages);
      });

      check(entry, 'qpdf', 'qpdf --check of the saved file', (ctx) => {
        requireQpdf(ctx);
        qpdfCheck(unwrap(pass.saved), entry);
      });

      check(entry, 'qpdfDefault', 'qpdf --check of the default save', (ctx) => {
        requireQpdf(ctx);
        qpdfCheck(unwrap(pass.savedDefault), entry);
      });
    });
  }
});

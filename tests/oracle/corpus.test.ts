/**
 * G-CORPUS: every third-party file of tests/fixtures/corpus/ goes through the public load
 * surface, and both of its re-saves go through qpdf.
 *
 * One `describe(<id>)` per manifest.json entry, eight checks each (ten for an encrypted file), in
 * order:
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
 * An encrypted file (a manifest feature `encrypted-*`) is decrypted on load, and a document
 * decrypted on load is never saved in clear: a bare `save()` throws UnsupportedEncryptionError
 * (check 9). Its saves of checks 6-8 come after `encrypt()` with new passwords (AES-256), so
 * they reload and pass qpdf with the new user password, and check 10 compares the plaintext of
 * the `compress: false` save (`qpdf --decrypt`, loaded by the library) with the source: the same
 * page count and, page by page, the same extracted text.
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
import {
  extractText,
  loadPdf,
  parseContentStream,
  UnsupportedEncryptionError,
} from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { XrefParser } from '../../src/parser/xrefParser.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import type { DefectKey } from '../helpers/known-defect.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../helpers/oracle/qpdf.js';

interface CorpusEntry {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
  readonly category: 'real' | 'damaged';
  readonly features: readonly string[];
  readonly password: string | null;
  readonly oracle: {
    readonly qpdfCheck: 0 | 3;
    readonly pages: number;
    readonly pdfjsChars: number;
    readonly textSample?: string;
  };
}

type Check =
  | 'loads'
  | 'fallback'
  | 'pages'
  | 'text'
  | 'save'
  | 'qpdf'
  | 'qpdfDefault'
  | 'bareSave'
  | 'plaintext';

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

// Fonts given as indirect references are skipped, so their ToUnicode maps are not applied.
const INDIRECT_FONTS: Known = {
  key: defectKey('parser-text-01', '0.41.6'),
  failsWith: TEXT_MISSING,
};

// The saved file keeps an input stream that qpdf warns about unchanged (exit 3 is accepted only
// for an input, never for this library's output).
const COPIED_DAMAGED_STREAMS: Known = {
  key: defectKey('corpus-P02', '0.41.0'),
  failsWith: qpdfFindsOnly(
    3,
    /WARNING: in\.pdf \(offset \d+\): input stream is complete but output may still be valid/,
  ),
};

// A name that holds a delimiter (the /Subtype /text/plain of an embedded file) is written
// without escaping it, so qpdf ends the dictionary early and warns.
const UNESCAPED_NAME = defectKey('tests-unit-core-b-22', '0.41.0');
const DICTIONARY_ENDED =
  /WARNING: in\.pdf \(object \d+ 0, offset \d+\): dictionary ended prematurely; using null as value for last key/;
const UNESCAPED_NAME_SAVED: Known = {
  key: UNESCAPED_NAME,
  failsWith: qpdfFindsOnly(3, DICTIONARY_ENDED),
};

const KNOWN: Readonly<Record<string, Partial<Record<Check, Known>>>> = {
  'irs-p1-chinese': { text: INDIRECT_FONTS },
  'pdfjs-cid-truetype': { text: INDIRECT_FONTS },
  'pyhanko-ua-and-a': { text: INDIRECT_FONTS },
  // Category damaged (qpdf warns about its streams). Both saves keep the three Flate streams qpdf
  // warns about in the input byte for byte, so qpdf warns on them in the output too.
  'qpdf-form-acrobat': {
    text: INDIRECT_FONTS,
    qpdf: COPIED_DAMAGED_STREAMS,
    qpdfDefault: COPIED_DAMAGED_STREAMS,
  },
  'qpdf-form-odt': { text: INDIRECT_FONTS },
  'qpdf-r6-attachments': {
    qpdf: UNESCAPED_NAME_SAVED,
    qpdfDefault: UNESCAPED_NAME_SAVED,
    plaintext: {
      key: UNESCAPED_NAME,
      failsWith: new RegExp(
        `^QpdfError: qpdf --decrypt exit 3: (?:(?:${DICTIONARY_ENDED.source}) \\| )+qpdf: operation succeeded with warnings; resulting file may have some problems$`,
      ),
    },
  },
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
  /** A bare `save()` of an encrypted file's load, before encrypt() (it must throw). */
  readonly bare: Outcome<Uint8Array>;
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
const isEncrypted = (entry: CorpusEntry): boolean =>
  entry.features.some((f) => f.startsWith('encrypted-'));
/** The new passwords an encrypted file's saves are encrypted with. */
const RESAVE_USER = 'user-resave';
const RESAVE_OWNER = 'owner-resave';
/** The options that open a save of `entry`: the RESAVE user password when it is encrypted. */
const savedOptions = (entry: CorpusEntry): { password?: string } =>
  isEncrypted(entry) ? { password: RESAVE_USER } : loadOptions(entry);

/** The text of every page of `doc`, extracted with each page's resources. */
const pagesText = (doc: PdfDocument): string[] =>
  Array.from({ length: doc.getPageCount() }, (_, i) => {
    const page = doc.getPage(i);
    return extractText(parseContentStream(page.getContentStream()), page.getOriginalResources());
  });

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
  const text = await after(load, pagesText);
  let bare: Outcome<Uint8Array> = { ok: false, error: new Error('not an encrypted file') };
  let ready = load;
  if (isEncrypted(entry)) {
    bare = await after(load, (doc) => doc.save());
    ready = await after(load, async (doc) => {
      await doc.encrypt({
        userPassword: RESAVE_USER,
        ownerPassword: RESAVE_OWNER,
        algorithm: 'aes-256',
      });
      return doc;
    });
  }
  const saved = await after(ready, (doc) => doc.save({ compress: false }));
  const savedDefault = await after(ready, (doc) => doc.save());
  const reloadedPages = await after(saved, async (out) =>
    (await loadPdf(out, savedOptions(entry))).getPageCount(),
  );
  return { load, bare, scans, strict, pageCount, text, saved, savedDefault, reloadedPages };
}

/**
 * qpdf --check of a saved file: exit 0 only. Exit 3 is accepted for an input (manifest
 * `oracle.qpdfCheck`), never for this library's output, so a save that draws warnings is a marker.
 */
function qpdfCheck(bytes: Uint8Array, entry: CorpusEntry): void {
  expectQpdfClean(bytes, savedOptions(entry));
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

      if (isEncrypted(entry)) {
        check(entry, 'bareSave', 'a bare save() throws UnsupportedEncryptionError', () => {
          unwrap(pass.load);
          expect(pass.bare.ok, 'bare save() resolved').toBe(false);
          if (!pass.bare.ok) expect(pass.bare.error).toBeInstanceOf(UnsupportedEncryptionError);
        });

        check(entry, 'plaintext', 'plaintext of the saved file equals the source', async (ctx) => {
          requireQpdf(ctx);
          const plain = await loadPdf(qpdfDecryptQdf(unwrap(pass.saved), RESAVE_USER));
          expect(plain.getPageCount()).toBe(entry.oracle.pages);
          expect(pagesText(plain).map(normalise)).toEqual(unwrap(pass.text).map(normalise));
        });
      }
    });
  }
});

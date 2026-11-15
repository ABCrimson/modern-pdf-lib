/**
 * Read-old gate for the earliest AES-256 (revision 6) writer: the file in
 * tests/fixtures/legacy-0.26.0 was written by the published modern-pdf-lib@0.26.0
 * (scripts/legacy-0.26.0/generate.ts, never this tree), with the key derivation 0.26.0 to 0.40.8
 * wrote, which qpdf and pdf.js refuse.
 *
 * The current reader opens it with its user and with its owner password, reads its Info strings
 * and page text (the expected values come from manifest.json, which the generator writes from the
 * values it built the file with), and emits exactly one MPL_LEGACY_R6_KEY warning per realm.
 * "Write new": a bare save() of the decrypted document throws UnsupportedEncryptionError; after
 * encrypt() with new passwords the save is an AES-256 file that qpdf checks clean and pdf.js reads
 * with the new user password, and whose plaintext (`qpdf --decrypt`, loaded by the library) holds
 * the source's page text and Title. A test that runs qpdf skips with a reason where qpdf is absent
 * locally and fails when `CI` is set.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  extractText,
  loadPdf,
  parseContentStream,
  UnsupportedEncryptionError,
} from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { resetWarningsForTesting } from '../../src/internal/warnings.js';
import { pdfjsText } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../helpers/oracle/qpdf.js';

interface LegacyEntry {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly producer: string;
  readonly expect: {
    readonly pageCount: number;
    readonly info: { readonly Title: string; readonly Author: string };
    readonly pageText: readonly string[];
    readonly encryption: {
      readonly V: number;
      readonly R: number;
      readonly CFM: string;
      readonly userPassword: string;
      readonly ownerPassword: string;
    };
  };
}

const DIR = new URL('../fixtures/legacy-0.26.0/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8')) as LegacyEntry[];
const FILE = 'encrypted-r6.pdf';
const entry = manifest.find((m) => m.file === FILE);
if (entry === undefined) throw new Error(`manifest has no entry for ${FILE}`);
const want = entry.expect;
const bytes = new Uint8Array(readFileSync(new URL(FILE, DIR)));
const NEW_USER = 'user-resave';
const NEW_OWNER = 'owner-resave';

const pageText = (doc: PdfDocument, index: number): string =>
  extractText(parseContentStream(doc.getPage(index).getContentStream()));

/** Asserts the Title, Author, page count and page text the generator wrote. */
function expectSourceValues(doc: PdfDocument): void {
  expect(doc.getPageCount()).toBe(want.pageCount);
  expect(doc.getTitle(), 'Info Title').toBe(want.info.Title);
  expect(doc.getAuthor(), 'Info Author').toBe(want.info.Author);
  want.pageText.forEach((t, i) => {
    expect(pageText(doc, i), `page ${i + 1} text (library)`).toContain(t);
  });
}

let emitWarning: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

/** The calls of process.emitWarning that carry the legacy code. */
const legacyCalls = (): unknown[][] =>
  emitWarning.mock.calls.filter(
    (call: unknown[]) => (call[1] as { code?: string } | undefined)?.code === 'MPL_LEGACY_R6_KEY',
  );

describe('legacy-0.26.0 fixture', () => {
  test('manifest matches the directory and the file hash', () => {
    const onDisk = readdirSync(DIR)
      .filter((n) => n.endsWith('.pdf'))
      .sort();
    expect(manifest.map((m) => m.file)).toEqual([FILE]);
    expect(onDisk).toEqual([FILE]);
    expect(entry.producer).toBe('modern-pdf-lib@0.26.0');
    expect(bytes.length).toBe(entry.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
  });

  test('it carries the encryption the manifest names', () => {
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain(`/V ${want.encryption.V}`);
    expect(text).toContain(`/R ${want.encryption.R}`);
    expect(text).toContain(`/CFM /${want.encryption.CFM}`);
  });

  test('qpdf refuses its user password (the legacy derivation)', (ctx) => {
    requireQpdf(ctx);
    expect(() => {
      expectQpdfClean(bytes, { password: want.encryption.userPassword });
    }).toThrow(/^qpdf --check exit 2: .*invalid password/);
  });

  test('it opens with its user password: Info strings and page text', async () => {
    expectSourceValues(await loadPdf(bytes, { password: want.encryption.userPassword }));
  });

  test('it opens with its owner password: Info strings and page text', async () => {
    expectSourceValues(await loadPdf(bytes, { password: want.encryption.ownerPassword }));
  });

  test('it rejects a wrong password and a missing one, and warns nothing', async () => {
    await expect(loadPdf(bytes, { password: 'wrong' })).rejects.toThrow(/password is incorrect/);
    await expect(loadPdf(bytes)).rejects.toThrow(/requires a password/);
    expect(legacyCalls()).toEqual([]);
  });

  test('opening it emits exactly one MPL_LEGACY_R6_KEY warning per realm', async () => {
    await loadPdf(bytes, { password: want.encryption.userPassword });
    expect(legacyCalls()).toHaveLength(1);
    await loadPdf(bytes, { password: want.encryption.ownerPassword });
    expect(legacyCalls()).toHaveLength(1);
    expect(legacyCalls()[0]?.[1]).toEqual({
      type: 'ModernPdfLibWarning',
      code: 'MPL_LEGACY_R6_KEY',
    });
  });

  test('a bare save() of the decrypted document throws UnsupportedEncryptionError', async () => {
    const doc = await loadPdf(bytes, { password: want.encryption.userPassword });
    await expect(doc.save()).rejects.toThrow(UnsupportedEncryptionError);
  });

  test('encrypt() and save: qpdf and pdf.js open it with the new password, plaintext equal', async (ctx) => {
    requireQpdf(ctx);
    const doc = await loadPdf(bytes, { password: want.encryption.userPassword });
    await doc.encrypt({ userPassword: NEW_USER, ownerPassword: NEW_OWNER, algorithm: 'aes-256' });
    const out = await doc.save({ compress: false });
    const text = new TextDecoder('latin1').decode(out);
    expect(text).toContain('/R 6');
    expectQpdfClean(out, { password: NEW_USER });
    const shown = await pdfjsText(out, { password: NEW_USER });
    expect(shown).toHaveLength(want.pageCount);
    want.pageText.forEach((t, i) => {
      expect(shown[i], `page ${i + 1} text (pdf.js)`).toContain(t);
    });
    expectSourceValues(await loadPdf(qpdfDecryptQdf(out, NEW_USER)));
    // The standard derivation: reopening the output emits no legacy warning.
    resetWarningsForTesting();
    emitWarning.mockClear();
    expectSourceValues(await loadPdf(out, { password: NEW_USER }));
    expect(legacyCalls()).toEqual([]);
  });
});

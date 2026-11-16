/**
 * Shared parts of the text oracle set: text the library writes through its public API, read
 * back by pdf.js 6.5 and qpdf 12.
 *
 * Every test file of tests/oracle/text-set writes one kind of text (document information,
 * annotations, form fields, outline titles, standard-font page text, table cells) and compares
 * what the two readers report with the text it was given. The input texts are the same four for
 * every file: ASCII, text that PDFDocEncoding and WinAnsiEncoding both hold, CJK text that needs
 * UTF-16BE, and a character outside the Basic Multilingual Plane (a surrogate pair).
 *
 * pdf.js page text is read with `disableNormalization` and joined without collapsing
 * whitespace, so a lost or changed space shows (tests/helpers/oracle/pdfjs.ts collapses it).
 * qpdf `--json=2` writes a string it reads as text as "u:" plus the text, and any other string as
 * "b:" plus its bytes in hex: qpdf prints "b:" for PDFDocEncoding bytes above 0x7F, so such a
 * string is compared through `decodeTextString`, which tests/oracle/text-string.test.ts checks
 * against both readers. Page text has no qpdf reading; every saved file still passes
 * `qpdf --check` (the oracle setup enforces it).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PdfDocument } from '../../../src/index.js';
import { decodeTextString } from '../../../src/core/internal/textString.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { expectQpdfClean, QPDF_BIN, QpdfError } from '../../helpers/oracle/qpdf.js';

/** The four input texts of every file of the set. */
export const INPUTS = {
  ascii: 'Plain ASCII (1)',
  latin: 'Café – € “x” Š',
  cjk: '日本語 ✓ Ω',
  astral: '😀 astral',
} as const;

/** Saves `doc` with the default options, passes the bytes through `qpdf --check` and returns them. */
export async function cleanSave(doc: PdfDocument): Promise<Uint8Array> {
  const bytes = await doc.save();
  expectQpdfClean(bytes);
  return bytes;
}

/**
 * The text lines of every page as pdf.js reads them: the `str` of each text item, a line ending
 * where pdf.js marks `hasEOL`; a page without text has no lines.
 */
export function pdfjsLines(bytes: Uint8Array): Promise<string[][]> {
  return withPdfjs(bytes, async (doc) => {
    const pages: string[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const { items } = await (
        await doc.getPage(n)
      ).getTextContent({
        disableNormalization: true,
      });
      const text = items
        .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : ''))
        .join('');
      pages.push(text === '' ? [] : text.replace(/\n$/, '').split('\n'));
    }
    return pages;
  });
}

/** A dictionary as qpdf `--json=2` writes it: each key (with its "/") to its value. */
export type QpdfDict = Readonly<Record<string, unknown>>;

/**
 * qpdf `--json=2` of `bytes`: the dictionary of every object that is a dictionary (a stream's
 * own dictionary included), keyed `obj:<n> <g> R`, and the trailer under `trailer`.
 */
export function qpdfObjects(bytes: Uint8Array): ReadonlyMap<string, QpdfDict> {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-text-set-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(QPDF_BIN, ['--json=2', input], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new QpdfError(`qpdf --json=2 exit ${result.status}: ${result.stderr}`);
    }
    const json = JSON.parse(result.stdout) as {
      qpdf: [unknown, Record<string, { value?: unknown; stream?: { dict?: unknown } }>];
    };
    const objects = new Map<string, QpdfDict>();
    for (const [key, entry] of Object.entries(json.qpdf[1])) {
      const dict = entry.value ?? entry.stream?.dict;
      if (typeof dict === 'object' && dict !== null && !Array.isArray(dict)) {
        objects.set(key, dict as QpdfDict);
      }
    }
    return objects;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The text of a qpdf string value ("u:" text, or "b:" bytes decoded as a PDF text string); else undefined. */
export function qpdfText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.startsWith('u:')) return value.slice(2);
  if (value.startsWith('b:')) return decodeTextString(Uint8Array.fromHex(value.slice(2)));
  return undefined;
}

/**
 * `embedFont(bytes, { subset: false })` embeds the TrueType font program whole.
 *
 * The font is Liberation Sans Regular as pdfjs-dist ships it in standard_fonts/ (tests/fixtures
 * holds no TrueType file). For a page drawn with it and saved with the default options, the
 * /FontFile2 stream inflated by node:zlib `inflateSync` equals the input bytes and its /Length1
 * is their length, no /BaseFont carries the six-letter tag that marks a font subset (ISO 32000-2,
 * "Font subsets"), the file passes `qpdf --check`, and pdf.js reads the drawn text. Without the
 * option the same font is written as a subset, so the stream is shorter than the input; pdf.js
 * does not read that file's text back yet (ledger core-document-11, the /ToUnicode map of the
 * subset path, open for 0.41.6). qpdf comes from `QPDF`, then `PATH`; each test skips with a
 * reason where qpdf is absent locally and fails when `CI` is set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../src/index.js';
import type { EmbedFontOptions } from '../../src/index.js';
import { expectPdfjsText } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

const FONT = new Uint8Array(
  readFileSync(
    join(
      import.meta.dirname,
      '../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
    ),
  ),
);
const TEXT = 'Whole font, not a subset';
const latin1 = new TextDecoder('latin1');

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A one-page document that draws {@link TEXT} with the font embedded under `options`. */
async function save(...embeds: (EmbedFontOptions | undefined)[]): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage();
  let font;
  for (const options of embeds) font = await doc.embedFont(FONT, options);
  page.drawText(TEXT, { x: 50, y: 700, size: 18, font });
  return doc.save();
}

/** The /FontFile2 streams of a file (the streams whose dictionary has /Length1), inflated. */
function fontFiles(bytes: Uint8Array): { readonly length1: number; readonly data: Uint8Array }[] {
  const text = latin1.decode(bytes);
  const found: { length1: number; data: Uint8Array }[] = [];
  for (const m of text.matchAll(/(?<!end)stream\r?\n/g)) {
    const header = text.slice(text.lastIndexOf(' obj', m.index), m.index);
    const length1 = /\/Length1 (\d+)/.exec(header)?.[1];
    if (length1 === undefined) continue;
    expect(header, 'filter of the /FontFile2 stream').toContain('/FlateDecode');
    const length = Number(/\/Length (\d+)/.exec(header)?.[1]);
    const start = m.index + m[0].length;
    found.push({
      length1: Number(length1),
      data: new Uint8Array(inflateSync(bytes.subarray(start, start + length))),
    });
  }
  return found;
}

/** True when `data` holds the bytes of {@link FONT} (compared without printing a diff of them). */
const sameBytes = (data: Uint8Array | undefined): boolean =>
  data !== undefined && data.length === FONT.length && data.every((byte, i) => byte === FONT[i]);

/** Every /BaseFont name of a file. */
const baseFonts = (bytes: Uint8Array): string[] =>
  latin1
    .decode(bytes)
    .matchAll(/\/BaseFont \/([^\s/<>[\]()]+)/g)
    .map((m) => m[1] ?? '')
    .toArray();

describe('embedFont() with subset: false', () => {
  test('writes the font program whole and without a subset tag; qpdf and pdf.js read the file', async () => {
    const bytes = await save({ subset: false });
    const files = fontFiles(bytes);
    expect(files).toHaveLength(1);
    expect(files[0]?.length1, '/Length1').toBe(FONT.length);
    expect(sameBytes(files[0]?.data), 'inflated /FontFile2 equals the input').toBe(true);
    expect(baseFonts(bytes).length).toBeGreaterThan(0);
    for (const name of baseFonts(bytes)) expect(name).not.toMatch(/^[A-Z]{6}\+/);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, [TEXT]);
  });

  test('a second embedFont() of the same font with subset: false embeds it whole', async () => {
    const bytes = await save(undefined, { subset: false });
    const files = fontFiles(bytes);
    expect(files).toHaveLength(1);
    expect(sameBytes(files[0]?.data), 'inflated /FontFile2 equals the input').toBe(true);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, [TEXT]);
  });

  test('without the option the font is written as a subset', async () => {
    const bytes = await save(undefined);
    const files = fontFiles(bytes);
    expect(files).toHaveLength(1);
    expect(files[0]?.data.length).toBeLessThan(FONT.length);
    expect(files[0]?.length1).toBe(files[0]?.data.length);
    expectQpdfClean(bytes);
  });
});

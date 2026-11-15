/**
 * Every /FlateDecode stream the library writes is zlib data (RFC 1950).
 *
 * For each output kind (save() of a text page and of an image page, save() with
 * objectStreamThreshold, saveAsStream(), saveAsBlob(), saveDocumentIncremental(), re-saves of
 * files written by modern-pdf-lib 0.40.3, and the images the library compresses itself), every
 * /FlateDecode stream starts with a valid zlib header and inflates with node:zlib `inflateSync`,
 * which also checks the Adler-32 trailer, and the file passes `qpdf --check`. pdf.js reads the
 * text back. The PNG encoder's IDAT data (encodePngFromPixels, renderPageToImage(),
 * generateThumbnail()) is judged the same way, and its rows, unfiltered in the test, equal the
 * input pixels. Inputs whose decoded samples the test knows by construction (16-bit PNGs, TIFFs
 * with Deflate strips, zlib data with a small output size hint) are compressed by node:zlib.
 * qpdf comes from `QPDF`, then `PATH`; each test skips with a reason where qpdf is absent
 * locally and fails when `CI` is set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateRawSync, deflateSync as zlibDeflateSync, inflateSync } from 'node:zlib';
import { beforeEach, describe, expect, test } from 'vitest';
import { decompress } from '../../src/codecs/internal/deflate.js';
import { decompressSync } from '../../src/codecs/internal/fflateAdapter.js';
import {
  createPdf,
  encodePngFromPixels,
  generateThumbnail,
  loadPdf,
  renderPageToImage,
  saveDocumentIncremental,
} from '../../src/index.js';
import type { PdfDocument, PdfSaveOptions } from '../../src/index.js';
import { expectPdfjsText } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

const IMAGES = join(import.meta.dirname, '../fixtures/images');
const LEGACY = join(import.meta.dirname, '../fixtures/legacy-0.40.3');
const latin1 = new TextDecoder('latin1');
const EPOCH = new Date('2026-01-01T00:00:00Z');
const LINES = Array.from({ length: 20 }, (_, i) => `Zlib line ${i + 1}`);

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** True for a two-byte zlib header: method 8, window at most 32 KiB, FCHECK, no dictionary. */
function zlibHeader(data: Uint8Array): boolean {
  const cmf = data[0] ?? 0;
  const flg = data[1] ?? 0;
  return (cmf & 0x0f) === 8 && cmf >> 4 <= 7 && (cmf * 256 + flg) % 31 === 0 && !(flg & 0x20);
}

interface FlateStream {
  readonly object: string;
  readonly data: Uint8Array;
}

/** Every /FlateDecode stream of a file whose streams carry a direct /Length. */
function flateStreams(bytes: Uint8Array): FlateStream[] {
  const text = latin1.decode(bytes);
  const found: FlateStream[] = [];
  for (const m of text.matchAll(/(?<!end)stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const objAt = text.lastIndexOf(' obj', m.index);
    const header = text.slice(objAt, m.index);
    if (!header.includes('/FlateDecode')) continue;
    const length = /\/Length (\d+)/.exec(header)?.[1];
    if (length === undefined) throw new Error('FlateDecode stream without a direct /Length');
    const object = /(\d+ \d+)$/.exec(text.slice(Math.max(0, objAt - 16), objAt))?.[1] ?? '?';
    found.push({ object, data: bytes.subarray(start, start + Number(length)) });
  }
  return found;
}

/** Asserts that the file has /FlateDecode streams, each zlib data, and that qpdf finds nothing. */
function expectZlibFile(bytes: Uint8Array): void {
  const streams = flateStreams(bytes);
  expect(streams.length, 'number of /FlateDecode streams').toBeGreaterThan(0);
  for (const s of streams) {
    expect(zlibHeader(s.data), `zlib header of object ${s.object}`).toBe(true);
    expect(() => inflateSync(s.data), `node:zlib inflate of object ${s.object}`).not.toThrow();
  }
  expectQpdfClean(bytes);
}

function textDoc(): PdfDocument {
  const doc = createPdf();
  doc.setCreationDate(EPOCH);
  doc.setModDate(EPOCH);
  const page = doc.addPage();
  LINES.forEach((line, i) => page.drawText(line, { x: 50, y: 750 - i * 16, size: 12 }));
  return doc;
}

/** A PNG chunk with its CRC from node:zlib. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set(body, 4);
  view.setUint32(8 + data.length, crc32(body), false);
  return out;
}

/** A non-interlaced PNG from scanlines (each with its filter byte), compressed by node:zlib. */
function pngFromRows(
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  rows: Uint8Array,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr.set([bitDepth, colorType, 0, 0, 0], 8);
  return new Uint8Array([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...pngChunk('IHDR', ihdr),
    ...pngChunk('IDAT', new Uint8Array(zlibDeflateSync(rows))),
    ...pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** The interleaved 8-bit samples of the test TIFFs (3 = RGB, 4 = RGB with alpha). */
const tiffPixels = (width: number, height: number, channels: 3 | 4): Uint8Array =>
  new Uint8Array(width * height * channels).map((_, i) => (i * 37) & 0xff);

/**
 * A little-endian TIFF with 8-bit samples (3 = RGB, 4 = RGB with alpha) in one strip, either
 * uncompressed (Compression 1) or Deflate (Compression 8: zlib data from node:zlib).
 */
function rgbTiff(
  width: number,
  height: number,
  channels: 3 | 4,
  compression: 1 | 8 = 1,
): Uint8Array {
  const samples = tiffPixels(width, height, channels);
  const pixels = compression === 8 ? new Uint8Array(zlibDeflateSync(samples)) : samples;
  const tags: [number, number, number][] = [
    [256, 3, width],
    [257, 3, height],
    [258, 3, 0], // BitsPerSample: offset of the per-sample values, set below
    [259, 3, compression],
    [262, 3, 2],
    [273, 4, 0], // StripOffsets, set below
    [277, 3, channels],
    [278, 4, height],
    [279, 4, pixels.length],
    ...(channels === 4 ? [[338, 3, 2] as [number, number, number]] : []),
  ];
  const bpsOffset = 8 + 2 + tags.length * 12 + 4;
  const dataOffset = bpsOffset + channels * 2;
  const out = new Uint8Array(dataOffset + pixels.length);
  const view = new DataView(out.buffer);
  out.set([0x49, 0x49]);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, tags.length, true);
  tags.forEach(([tag, type, value], i) => {
    const at = 10 + i * 12;
    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, tag === 258 ? channels : 1, true);
    const v = tag === 258 ? bpsOffset : tag === 273 ? dataOffset : value;
    if (type === 3 && tag !== 258) view.setUint16(at + 8, v, true);
    else view.setUint32(at + 8, v, true);
  });
  for (let c = 0; c < channels; c++) view.setUint16(bpsOffset + c * 2, 8, true);
  out.set(pixels, dataOffset);
  return out;
}

const readImage = (name: string): Uint8Array => new Uint8Array(readFileSync(join(IMAGES, name)));

async function imageDoc(): Promise<PdfDocument> {
  const doc = createPdf();
  const page = doc.addPage();
  page.drawText('Images', { x: 50, y: 760, size: 12 });
  const images = [
    await doc.embedPng(readImage('sample-rgba.png')),
    await doc.embedPng(readImage('sample.png')),
    await doc.embedPng(readImage('gradient-8x8.png')),
    doc.embedTiff(rgbTiff(4, 4, 3)),
    doc.embedTiff(rgbTiff(4, 4, 4)),
  ];
  images.forEach((image, i) => {
    page.drawImage(image, { x: 50 + i * 60, y: 600, width: 50, height: 50 });
  });
  return doc;
}

describe('library output: every /FlateDecode stream is zlib data', () => {
  test('save() of a text page', async () => {
    const bytes = await textDoc().save();
    expectZlibFile(bytes);
    await expectPdfjsText(bytes, [LINES.join(' ')]);
  });

  test.each([{}, { compress: false }] satisfies PdfSaveOptions[])(
    'save(%o) of a page with PNG and TIFF images',
    async (options) => {
      const bytes = await (await imageDoc()).save(options);
      expect(flateStreams(bytes).length).toBeGreaterThanOrEqual(7);
      expectZlibFile(bytes);
    },
  );

  test('save() with objectStreamThreshold: 1, and the library reloads it', async () => {
    const bytes = await textDoc().save({ objectStreamThreshold: 1 });
    const text = latin1.decode(bytes);
    expect(text).toContain('/Type /ObjStm');
    expect(text).toContain('/Type /XRef');
    expectZlibFile(bytes);
    await expectPdfjsText(bytes, [LINES.join(' ')]);
    expect((await loadPdf(bytes)).getPageCount()).toBe(1);
  });

  test('saveAsStream()', async () => {
    const bytes = new Uint8Array(await new Response(textDoc().saveAsStream()).arrayBuffer());
    expectZlibFile(bytes);
    await expectPdfjsText(bytes, [LINES.join(' ')]);
  });

  test('saveAsBlob()', async () => {
    const bytes = new Uint8Array(await (await textDoc().saveAsBlob()).arrayBuffer());
    expectZlibFile(bytes);
  });

  test('saveDocumentIncremental()', async () => {
    const base = await textDoc().save();
    expectZlibFile(base);
    const doc = await loadPdf(base);
    doc.addPage().drawText('Appended page', { x: 50, y: 700, size: 12 });
    const { bytes } = await saveDocumentIncremental(base, doc);
    expectZlibFile(bytes);
    await expectPdfjsText(bytes, [LINES.join(' '), 'Appended page']);
  });
});

describe('re-saving files written by modern-pdf-lib 0.40.3', () => {
  const FILES = [
    'raw-deflate.pdf',
    'raw-deflate-objstm.pdf',
    'forms.pdf',
    'linearized.pdf',
    'signed.pdf',
    'utf8-strings.pdf',
  ];
  const cases = FILES.flatMap((file) => [
    { file, options: {} },
    { file, options: { compress: false } },
  ]);

  test.each(cases)('$file with $options writes zlib data', async ({ file, options }) => {
    const doc = await loadPdf(new Uint8Array(readFileSync(join(LEGACY, file))));
    const bytes = await doc.save(options);
    const streams = flateStreams(bytes);
    for (const s of streams) {
      expect(zlibHeader(s.data), `zlib header of object ${s.object}`).toBe(true);
      expect(() => inflateSync(s.data), `node:zlib inflate of object ${s.object}`).not.toThrow();
    }
    expectQpdfClean(bytes);
  });
});

describe('images the library compresses itself', () => {
  test('16-bit RGBA and gray-and-alpha PNGs embed the high byte of each sample', async () => {
    const rgba = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];
    const ga = [0x11, 0x22, 0x33, 0x44];
    const doc = createPdf();
    const page = doc.addPage();
    const rows = (samples: number[]) => new Uint8Array([0, ...samples.flatMap((s) => [s, 0xee])]);
    page.drawImage(await doc.embedPng(pngFromRows(2, 1, 16, 6, rows(rgba))), {
      x: 50,
      y: 600,
      width: 40,
      height: 20,
    });
    page.drawImage(await doc.embedPng(pngFromRows(2, 1, 16, 4, rows(ga))), {
      x: 150,
      y: 600,
      width: 40,
      height: 20,
    });
    const bytes = await doc.save({ compress: false });
    expectZlibFile(bytes);
    const decoded = flateStreams(bytes).map((s) => [...inflateSync(s.data)]);
    expect(decoded).toEqual(
      expect.arrayContaining([
        [0x10, 0x20, 0x30, 0x50, 0x60, 0x70],
        [0x40, 0x80],
        [0x11, 0x33],
        [0x22, 0x44],
      ]),
    );
  });

  test('encodePngFromPixels writes zlib IDAT data with valid chunk CRCs', () => {
    const png = encodePngFromPixels(new Uint8Array(3 * 2 * 4).fill(0x7f), 3, 2, 4);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const idat: number[] = [];
    for (let at = 8; at < png.length;) {
      const length = view.getUint32(at, false);
      const body = png.subarray(at + 4, at + 8 + length);
      expect(view.getUint32(at + 8 + length, false)).toBe(crc32(body));
      if (latin1.decode(body.subarray(0, 4)) === 'IDAT') idat.push(...body.subarray(4));
      at += 12 + length;
    }
    expect(zlibHeader(new Uint8Array(idat))).toBe(true);
    expect(inflateSync(new Uint8Array(idat))).toHaveLength(2 * (1 + 3 * 4));
  });

  test.each([3, 4])(
    'encodePngFromPixels with %i channels: node:zlib inflates the IDAT to the filtered rows of the pixels',
    (channels) => {
      const width = 5;
      const height = 4;
      const pixels = new Uint8Array(width * height * channels).map((_, i) => (i * 29 + 7) & 0xff);
      const png = encodePngFromPixels(pixels, width, height, channels);
      const rows = inflateSync(pngIdat(png));
      expect(rows).toHaveLength(height * (1 + width * channels));
      expect(unfilterRows(rows, width, height, channels)).toEqual(pixels);
    },
  );

  test('renderPageToImage() and generateThumbnail() write PNGs whose IDAT node:zlib inflates', async () => {
    const doc = createPdf();
    doc.addPage([60, 40]).drawText('PNG', { x: 5, y: 15, size: 12 });
    const page = doc.getPage(0);
    for (const { data, width, height } of [
      await renderPageToImage(page),
      await generateThumbnail(page, { maxSize: 30 }),
    ]) {
      const rows = inflateSync(pngIdat(data));
      expect(rows).toHaveLength(height * (1 + width * 4));
      expect(unfilterRows(rows, width, height, 4)).toHaveLength(width * height * 4);
    }
  });

  test.each([3, 4] as const)(
    'embedTiff with a Deflate strip (zlib data from node:zlib), %i channels, embeds the source samples',
    async (channels) => {
      const doc = createPdf();
      const image = doc.embedTiff(rgbTiff(4, 4, channels, 8));
      doc.addPage().drawImage(image, { x: 50, y: 600, width: 40, height: 40 });
      const bytes = await doc.save({ compress: false });
      expectZlibFile(bytes);
      const samples = tiffPixels(4, 4, channels);
      const rgb = samples.filter((_, i) => channels === 3 || i % 4 !== 3);
      const alpha = samples.filter((_, i) => i % 4 === 3);
      const decoded = flateStreams(bytes).map((s) => [...inflateSync(s.data)]);
      expect(decoded).toContainEqual([...rgb]);
      if (channels === 4) expect(decoded).toContainEqual([...alpha]);
    },
  );
});

describe('reading zlib data', () => {
  // A text far longer than the hint, so a reader that stopped at the hint would cut it short.
  const original = new TextEncoder().encode('zlib data read in full, '.repeat(200));
  const zlib = new Uint8Array(zlibDeflateSync(original));
  const raw = new Uint8Array(deflateRawSync(original));

  test('an output size hint smaller than the data gives every byte of node:zlib data', async () => {
    expect(decompressSync(raw, 100), 'raw DEFLATE (legacy data)').toEqual(original);
    expect(decompressSync(zlib, 100)).toEqual(original);
    expect(await decompress(zlib, 100, { preferEngine: 'fflate' })).toEqual(original);
  });
});

/** The concatenated IDAT data of a PNG, checking each chunk's CRC with node:zlib. */
function pngIdat(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const idat: number[] = [];
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at, false);
    const body = png.subarray(at + 4, at + 8 + length);
    expect(view.getUint32(at + 8 + length, false)).toBe(crc32(body));
    if (latin1.decode(body.subarray(0, 4)) === 'IDAT') idat.push(...body.subarray(4));
    at += 12 + length;
  }
  const data = new Uint8Array(idat);
  expect(zlibHeader(data), 'zlib header of the IDAT data').toBe(true);
  return data;
}

/** Undoes the PNG row filters (types 0-4, ISO/IEC 15948 section 9) of 8-bit samples. */
function unfilterRows(rows: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const raw = rows[y * (stride + 1) + 1 + x] ?? 0;
      const a = x >= bpp ? (out[y * stride + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (out[(y - 1) * stride + x - bpp] ?? 0) : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][filter ?? -1];
      if (predictor === undefined) throw new Error(`row ${y}: unknown PNG filter type ${filter}`);
      out[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  return out;
}

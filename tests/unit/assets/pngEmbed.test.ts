/**
 * Tests for PNG and JPEG image embedding.
 *
 * Covers PNG signature validation, IHDR parsing, and JPEG SOF parsing.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crc32, deflateSync as zlibDeflateSync, inflateSync } from 'node:zlib';
import { embedJpeg, isJpeg, getJpegInfo } from '../../../src/assets/image/jpegEmbed.js';
import { embedPng as decodePng } from '../../../src/assets/image/pngEmbed.js';
import { createPdf } from '../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures/images');

// ---------------------------------------------------------------------------
// Helpers — minimal PNG builder
// ---------------------------------------------------------------------------

/** Build a minimal valid PNG file with given dimensions. */
function buildMinimalPng(width: number, height: number): Uint8Array {
  // PNG signature
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: 4 bytes length + 4 bytes type + 13 bytes data + 4 bytes CRC
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = buildPngChunk('IHDR', ihdrData);

  // Minimal IDAT chunk with some dummy compressed data
  // This is a minimal valid zlib stream (just enough to not crash parsers)
  const idatPayload = new Uint8Array([
    0x78,
    0x01, // zlib header (CMF, FLG)
    0x01,
    0x00,
    0x00,
    0xff,
    0xff, // stored block (empty)
    0x00,
    0x00,
    0x00,
    0x01, // adler32
  ]);
  const idatChunk = buildPngChunk('IDAT', idatPayload);

  // IEND chunk
  const iendChunk = buildPngChunk('IEND', new Uint8Array(0));

  // Combine all parts
  const total = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(total);
  let offset = 0;
  result.set(signature, offset);
  offset += signature.length;
  result.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  result.set(idatChunk, offset);
  offset += idatChunk.length;
  result.set(iendChunk, offset);

  return result;
}

/** Build a raw PNG chunk (length + type + data + CRC). */
function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, data.length, false);

  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  // Data
  chunk.set(data, 8);

  // CRC (fake — 0 for test purposes)
  view.setUint32(8 + data.length, 0, false);

  return chunk;
}

// ---------------------------------------------------------------------------
// Helpers — minimal JPEG builder
// ---------------------------------------------------------------------------

/** Build a minimal valid JPEG with SOF0 marker. */
function buildMinimalJpeg(width: number, height: number, components: number = 3): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xff, 0xd8);

  // SOF0 marker
  parts.push(0xff, 0xc0);
  // Segment length = 2 (length) + 1 (precision) + 2 (height) + 2 (width) + 1 (components)
  //                  + components * 3 (each component spec)
  const sofLength = 8 + components * 3;
  parts.push((sofLength >> 8) & 0xff, sofLength & 0xff);
  parts.push(8); // precision (8 bits)
  parts.push((height >> 8) & 0xff, height & 0xff); // height
  parts.push((width >> 8) & 0xff, width & 0xff); // width
  parts.push(components); // number of components

  // Component specifications (3 bytes each)
  for (let i = 0; i < components; i++) {
    parts.push(i + 1); // component ID
    parts.push(0x11); // sampling factors (1x1)
    parts.push(0); // quantization table ID
  }

  // EOI
  parts.push(0xff, 0xd9);

  return new Uint8Array(parts);
}

// ---------------------------------------------------------------------------
// PNG tests
// ---------------------------------------------------------------------------

describe('PNG embedding', () => {
  it('validates PNG signature (first 8 bytes)', () => {
    const validPng = buildMinimalPng(100, 100);

    // Verify the signature bytes
    expect(validPng[0]).toBe(0x89);
    expect(validPng[1]).toBe(0x50); // P
    expect(validPng[2]).toBe(0x4e); // N
    expect(validPng[3]).toBe(0x47); // G
    expect(validPng[4]).toBe(0x0d);
    expect(validPng[5]).toBe(0x0a);
    expect(validPng[6]).toBe(0x1a);
    expect(validPng[7]).toBe(0x0a);
  });

  it('rejects non-PNG data', async () => {
    // The PdfDocument.embedPng calls parsePngDimensions which checks signature
    // We test via the internal validation flow
    const notPng = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

    // We can test this via createPdf().embedPng() which calls parsePngDimensions
    // The parsePngDimensions function throws on bad signature
    const { createPdf } = await import('../../../src/index.js');
    const doc = createPdf();
    await expect(doc.embedPng(notPng)).rejects.toThrow(/[Ii]nvalid PNG|bad signature/);
  });

  it('rejects data that is too short', async () => {
    const { createPdf } = await import('../../../src/index.js');
    const doc = createPdf();
    const tooShort = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await expect(doc.embedPng(tooShort)).rejects.toThrow(/too short|too small|Invalid/);
  });

  it('parses IHDR chunk for dimensions', () => {
    const png = buildMinimalPng(320, 240);

    // Verify dimensions can be extracted from the IHDR.
    // The IHDR data starts after signature (8) + chunk length (4) + chunk type (4) = offset 16.
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const parsedWidth = view.getUint32(16, false);
    const parsedHeight = view.getUint32(20, false);

    expect(parsedWidth).toBe(320);
    expect(parsedHeight).toBe(240);
  });

  it('parses IHDR for various dimensions', () => {
    for (const [w, h] of [
      [1, 1],
      [100, 200],
      [1920, 1080],
      [4096, 4096],
    ]) {
      const png = buildMinimalPng(w!, h!);
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect(view.getUint32(16, false)).toBe(w);
      expect(view.getUint32(20, false)).toBe(h);
    }
  });

  it('decodes 4x4 RGB PNG correctly', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const doc = createPdf();
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.ref).toBeDefined();
  });

  it('decodes 4x4 RGBA PNG with alpha separation', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample-rgba.png'));
    const doc = createPdf();
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    expect(img.width).toBe(4);
    expect(img.height).toBe(4);

    // Save the document to ensure the SMask data is properly generated
    const bytes = await doc.save({ compress: false });
    const text = new TextDecoder().decode(bytes);
    // RGBA images should produce an SMask reference in the image XObject
    expect(text).toContain('/SMask');
  });

  it('decodes 8x8 gradient PNG', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'gradient-8x8.png'));
    const doc = createPdf();
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    expect(img.width).toBe(8);
    expect(img.height).toBe(8);
    expect(img.name).toMatch(/^Im\d+$/);
  });
});

// ---------------------------------------------------------------------------
// JPEG tests
// ---------------------------------------------------------------------------

describe('JPEG embedding', () => {
  it('JPEG embed parses SOF marker correctly', () => {
    const jpeg = buildMinimalJpeg(640, 480, 3);
    const result = embedJpeg(jpeg);

    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.componentCount).toBe(3);
    expect(result.bitsPerComponent).toBe(8);
  });

  it('JPEG embed determines color space from components (RGB)', () => {
    const jpeg = buildMinimalJpeg(100, 100, 3);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceRGB');
    expect(result.isCmyk).toBe(false);
  });

  it('JPEG embed determines color space from components (Grayscale)', () => {
    const jpeg = buildMinimalJpeg(100, 100, 1);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceGray');
    expect(result.isCmyk).toBe(false);
  });

  it('JPEG embed determines color space from components (CMYK)', () => {
    const jpeg = buildMinimalJpeg(100, 100, 4);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceCMYK');
    expect(result.isCmyk).toBe(true);
  });

  it('JPEG embed uses DCTDecode filter', () => {
    const jpeg = buildMinimalJpeg(200, 150);
    const result = embedJpeg(jpeg);
    expect(result.filter).toBe('DCTDecode');
  });

  it('JPEG embed passes through raw JPEG data', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const result = embedJpeg(jpeg);
    // The image data should be the original JPEG bytes
    expect(result.imageData).toBe(jpeg);
  });

  it('rejects non-JPEG data', () => {
    const notJpeg = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => embedJpeg(notJpeg)).toThrow(/Invalid JPEG|SOI/);
  });

  it('isJpeg identifies JPEG data correctly', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    expect(isJpeg(jpeg)).toBe(true);

    const notJpeg = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG signature
    expect(isJpeg(notJpeg)).toBe(false);

    const empty = new Uint8Array(0);
    expect(isJpeg(empty)).toBe(false);
  });

  it('getJpegInfo extracts metadata', () => {
    const jpeg = buildMinimalJpeg(800, 600, 3);
    const info = getJpegInfo(jpeg);

    expect(info.width).toBe(800);
    expect(info.height).toBe(600);
    expect(info.componentCount).toBe(3);
    expect(info.precision).toBe(8);
  });

  it('handles various JPEG dimensions', () => {
    for (const [w, h] of [
      [1, 1],
      [640, 480],
      [1920, 1080],
      [4000, 3000],
    ]) {
      const jpeg = buildMinimalJpeg(w!, h!);
      const result = embedJpeg(jpeg);
      expect(result.width).toBe(w);
      expect(result.height).toBe(h);
    }
  });
});

// ---------------------------------------------------------------------------
// PNG stream data is zlib (RFC 1950); 16-bit samples with alpha
// ---------------------------------------------------------------------------

/** A PNG chunk with its CRC from node:zlib. */
function zlibPngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
  const out = new Uint8Array(8 + data.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set(body, 4);
  view.setUint32(8 + data.length, crc32(body), false);
  return out;
}

/** A non-interlaced PNG whose IDAT holds `rows` (each with its filter byte) compressed by node:zlib. */
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
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...zlibPngChunk('IHDR', ihdr),
    ...zlibPngChunk('IDAT', new Uint8Array(zlibDeflateSync(rows))),
    ...zlibPngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** Every IDAT payload of a PNG file, concatenated. */
function idatOf(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const parts: number[] = [];
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at, false);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === 'IDAT') parts.push(...png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  return new Uint8Array(parts);
}

describe('PNG stream data for /FlateDecode', () => {
  it('compresses sample-rgba.png image and soft mask data as zlib data', async () => {
    const result = decodePng(
      new Uint8Array(await readFile(resolve(fixturesDir, 'sample-rgba.png'))),
    );
    expect(result.smaskData).toBeDefined();
    expect(inflateSync(result.imageData)).toHaveLength(4 * 4 * 3);
    expect(inflateSync(result.smaskData ?? new Uint8Array(0))).toHaveLength(4 * 4);
  });

  it('passes the IDAT data of sample.png through unchanged', async () => {
    const png = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    expect(decodePng(png).imageData).toEqual(idatOf(png));
  });

  it('takes the high byte of each 16-bit sample of an RGBA PNG', () => {
    // 2x1 pixels; every sample has a distinct high byte and the low byte 0xee.
    const samples = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];
    const rows = new Uint8Array([0, ...samples.flatMap((s) => [s, 0xee])]);
    const result = decodePng(pngFromRows(2, 1, 16, 6, rows));
    expect([...inflateSync(result.imageData)]).toEqual([0x10, 0x20, 0x30, 0x50, 0x60, 0x70]);
    expect([...inflateSync(result.smaskData ?? new Uint8Array(0))]).toEqual([0x40, 0x80]);
    expect(result.bitsPerComponent).toBe(8);
  });

  it('takes the high byte of each 16-bit sample of a gray and alpha PNG', () => {
    const samples = [0x11, 0x22, 0x33, 0x44];
    const rows = new Uint8Array([0, ...samples.flatMap((s) => [s, 0xee])]);
    const result = decodePng(pngFromRows(2, 1, 16, 4, rows));
    expect([...inflateSync(result.imageData)]).toEqual([0x11, 0x33]);
    expect([...inflateSync(result.smaskData ?? new Uint8Array(0))]).toEqual([0x22, 0x44]);
  });
});

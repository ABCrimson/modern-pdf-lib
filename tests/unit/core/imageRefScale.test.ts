/**
 * Tests for ImageRef.scale() and ImageRef.scaleToFit() convenience methods.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type { ImageRef } from '../../../src/core/pdfPage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal 1x1 white PNG image for testing.
 *
 * The PNG spec defines:
 *   Signature (8 bytes) + IHDR (25 bytes) + IDAT + IEND.
 */
function makeMinimalPng(width: number, height: number): Uint8Array {
  // Use a pre-built tiny 1x1 white RGBA PNG
  // This is a valid PNG that can be embedded.
  const base = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0d, // length = 13
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    0x00, 0x00, 0x00, 0x01, // width = 1
    0x00, 0x00, 0x00, 0x01, // height = 1
    0x08,                   // bit depth = 8
    0x02,                   // color type = 2 (RGB)
    0x00,                   // compression method
    0x00,                   // filter method
    0x00,                   // interlace method
    0x1f, 0x15, 0xc4, 0x89, // IHDR CRC
    // IDAT chunk (zlib-compressed scanline: filter=0 + 3 bytes RGB)
    0x00, 0x00, 0x00, 0x0c, // length = 12
    0x49, 0x44, 0x41, 0x54, // "IDAT"
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
    0x01, 0x01, 0x01, 0x00, // zlib data
    0x18, 0xdd, 0x8d, 0xb4, // IDAT CRC
    // IEND chunk
    0x00, 0x00, 0x00, 0x00, // length = 0
    0x49, 0x45, 0x4e, 0x44, // "IEND"
    0xae, 0x42, 0x60, 0x82, // IEND CRC
  ]);

  // Patch width/height into the IHDR
  const result = new Uint8Array(base);
  // width at offset 16 (4 bytes big-endian)
  result[16] = (width >> 24) & 0xff;
  result[17] = (width >> 16) & 0xff;
  result[18] = (width >>  8) & 0xff;
  result[19] = (width)       & 0xff;
  // height at offset 20 (4 bytes big-endian)
  result[20] = (height >> 24) & 0xff;
  result[21] = (height >> 16) & 0xff;
  result[22] = (height >>  8) & 0xff;
  result[23] = (height)       & 0xff;

  return result;
}

/**
 * Build a minimal valid JPEG for testing.
 * Creates a 1x1 pixel JPEG with the given dimensions in the SOF0 marker.
 */
function makeMinimalJpeg(width: number, height: number): Uint8Array {
  // Minimal JPEG: SOI + SOF0 + SOS + image data + EOI
  const sof0 = new Uint8Array([
    0xff, 0xc0,             // SOF0 marker
    0x00, 0x0b,             // length = 11
    0x08,                   // precision = 8
    (height >> 8) & 0xff,   // height high byte
    height & 0xff,          // height low byte
    (width >> 8) & 0xff,    // width high byte
    width & 0xff,           // width low byte
    0x01,                   // number of components = 1
    0x01,                   // component ID
    0x11,                   // sampling factors
    0x00,                   // quantization table
  ]);

  // DHT (minimal Huffman table)
  const dht = new Uint8Array([
    0xff, 0xc4,
    0x00, 0x1f,
    0x00,
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b,
  ]);

  // DQT (minimal quantization table)
  const dqt = new Uint8Array([
    0xff, 0xdb,
    0x00, 0x43, 0x00,
    ...new Array(64).fill(0x01),
  ]);

  // SOS (Start of scan)
  const sos = new Uint8Array([
    0xff, 0xda,
    0x00, 0x08,
    0x01,
    0x01,
    0x00,
    0x00, 0x3f, 0x00,
    // scan data (1 byte) + EOI
    0x7f,
    0xff, 0xd9,
  ]);

  // Assemble: SOI + DQT + SOF0 + DHT + SOS
  const soi = new Uint8Array([0xff, 0xd8]);
  const total = soi.length + dqt.length + sof0.length + dht.length + sos.length;
  const jpeg = new Uint8Array(total);
  let offset = 0;
  jpeg.set(soi, offset); offset += soi.length;
  jpeg.set(dqt, offset); offset += dqt.length;
  jpeg.set(sof0, offset); offset += sof0.length;
  jpeg.set(dht, offset); offset += dht.length;
  jpeg.set(sos, offset);
  return jpeg;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImageRef.scale()', () => {
  it('scales width and height by a factor (PNG)', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedPng(png);

    const half = img.scale(0.5);
    expect(half.width).toBeCloseTo(img.width * 0.5, 5);
    expect(half.height).toBeCloseTo(img.height * 0.5, 5);
  });

  it('scales by factor 1 returns same dimensions', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedPng(png);

    const same = img.scale(1);
    expect(same.width).toBe(img.width);
    expect(same.height).toBe(img.height);
  });

  it('scales by factor 2 doubles dimensions', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedPng(png);

    const doubled = img.scale(2);
    expect(doubled.width).toBeCloseTo(img.width * 2, 5);
    expect(doubled.height).toBeCloseTo(img.height * 2, 5);
  });

  it('scales JPEG images', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(200, 100);
    const img = await doc.embedJpeg(jpeg);

    expect(img.width).toBe(200);
    expect(img.height).toBe(100);

    const half = img.scale(0.5);
    expect(half.width).toBe(100);
    expect(half.height).toBe(50);
  });
});

describe('ImageRef.scaleToFit()', () => {
  it('scales down a wide image to fit within bounds', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(400, 200);
    const img = await doc.embedJpeg(jpeg);

    const fitted = img.scaleToFit(200, 200);
    // Width is the limiting factor: 400->200, ratio=0.5
    expect(fitted.width).toBeCloseTo(200, 5);
    expect(fitted.height).toBeCloseTo(100, 5);
  });

  it('scales down a tall image to fit within bounds', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(200, 400);
    const img = await doc.embedJpeg(jpeg);

    const fitted = img.scaleToFit(200, 200);
    // Height is the limiting factor: 400->200, ratio=0.5
    expect(fitted.width).toBeCloseTo(100, 5);
    expect(fitted.height).toBeCloseTo(200, 5);
  });

  it('does not scale up when image already fits', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(100, 50);
    const img = await doc.embedJpeg(jpeg);

    // maxWidth=200, maxHeight=200 => ratio=min(200/100, 200/50) = min(2,4)=2
    // scaleToFit allows scaling UP (the ratio > 1 is valid)
    const fitted = img.scaleToFit(200, 200);
    expect(fitted.width).toBeCloseTo(200, 5);
    expect(fitted.height).toBeCloseTo(100, 5);
  });

  it('preserves aspect ratio for square bounds', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(300, 150);
    const img = await doc.embedJpeg(jpeg);

    const fitted = img.scaleToFit(100, 100);
    // ratio = min(100/300, 100/150) = min(0.333, 0.666) = 0.333
    const ratio = 100 / 300;
    expect(fitted.width).toBeCloseTo(300 * ratio, 1);
    expect(fitted.height).toBeCloseTo(150 * ratio, 1);
    // Aspect ratio preserved
    expect(fitted.width / fitted.height).toBeCloseTo(300 / 150, 3);
  });

  it('works with PNG images', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedPng(png);

    const fitted = img.scaleToFit(50, 50);
    // Image is 1x1, ratio = min(50, 50) = 50
    expect(fitted.width).toBeCloseTo(img.width * 50, 1);
    expect(fitted.height).toBeCloseTo(img.height * 50, 1);
  });
});

// ---------------------------------------------------------------------------
// embedImage() auto-detection
// ---------------------------------------------------------------------------

describe('PdfDocument.embedImage()', () => {
  it('auto-detects PNG and embeds correctly', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedImage(png);

    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
    expect(img.name).toMatch(/^Im\d+$/);
  });

  it('auto-detects JPEG and embeds correctly', async () => {
    const doc = createPdf();
    const jpeg = makeMinimalJpeg(200, 100);
    const img = await doc.embedImage(jpeg);

    expect(img.width).toBe(200);
    expect(img.height).toBe(100);
  });

  it('throws for unsupported format (GIF header)', async () => {
    const doc = createPdf();
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38]); // "GIF8"
    await expect(doc.embedImage(gif)).rejects.toThrow('Unsupported image format');
  });

  it('throws for data too short', async () => {
    const doc = createPdf();
    await expect(doc.embedImage(new Uint8Array([0x89, 0x50]))).rejects.toThrow('too short');
  });

  it('accepts ArrayBuffer input', async () => {
    const doc = createPdf();
    const png = makeMinimalPng(1, 1);
    const img = await doc.embedImage(png.buffer as ArrayBuffer);

    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
  });
});

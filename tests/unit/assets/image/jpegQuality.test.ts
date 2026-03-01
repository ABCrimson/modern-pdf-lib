/**
 * Tests for JPEG quality estimation from DQT markers.
 *
 * Covers estimateJpegQuality() from imageOptimize.ts.
 */

import { describe, it, expect } from 'vitest';
import { estimateJpegQuality } from '../../../../src/assets/image/imageOptimize.js';

// ---------------------------------------------------------------------------
// Helpers — minimal JPEG with DQT builder
// ---------------------------------------------------------------------------

/**
 * Standard JPEG luminance quantization table (quality 50 baseline).
 * This is the reference table that quality factors scale from.
 */
const STANDARD_LUMINANCE_QT = [
  16, 11, 10, 16,  24,  40,  51,  61,
  12, 12, 14, 19,  26,  58,  60,  55,
  14, 13, 16, 24,  40,  57,  69,  56,
  14, 17, 22, 29,  51,  87,  80,  62,
  18, 22, 37, 56,  68, 109, 103,  77,
  24, 35, 55, 64,  81, 104, 113,  92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103,  99,
];

/**
 * Build a minimal JPEG with a DQT segment containing a quantization table
 * scaled for the given quality.
 */
function buildJpegWithQuality(quality: number): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // DQT segment
  parts.push(0xFF, 0xDB);

  // Compute the quantization table for this quality
  let scaleFactor: number;
  if (quality < 50) {
    scaleFactor = 5000 / quality;
  } else {
    scaleFactor = 200 - 2 * quality;
  }

  const table: number[] = [];
  for (let i = 0; i < 64; i++) {
    let val = Math.floor((STANDARD_LUMINANCE_QT[i]! * scaleFactor + 50) / 100);
    if (val < 1) val = 1;
    if (val > 255) val = 255;
    table.push(val);
  }

  // DQT payload: precision/tableId byte + 64 table entries
  const dqtPayload = 1 + 64; // 1 byte header + 64 bytes table
  const segLength = 2 + dqtPayload; // 2 bytes for length field

  parts.push((segLength >> 8) & 0xFF, segLength & 0xFF);
  parts.push(0x00); // precision=0 (8-bit), tableId=0

  for (const val of table) {
    parts.push(val);
  }

  // SOF0 (needed for valid JPEG structure)
  parts.push(0xFF, 0xC0);
  const sofLen = 8 + 3; // 1 component
  parts.push(0x00, sofLen);
  parts.push(8);                // precision
  parts.push(0x00, 0x01);      // height = 1
  parts.push(0x00, 0x01);      // width = 1
  parts.push(1);                // 1 component
  parts.push(1, 0x11, 0);      // component spec

  // SOS (marks end of header scanning)
  parts.push(0xFF, 0xDA);
  parts.push(0x00, 0x03); // length
  parts.push(0x00);       // dummy

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('estimateJpegQuality', () => {
  it('returns undefined for non-JPEG data', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    expect(estimateJpegQuality(png)).toBeUndefined();
  });

  it('returns undefined for empty data', () => {
    expect(estimateJpegQuality(new Uint8Array(0))).toBeUndefined();
  });

  it('returns undefined for too-short data', () => {
    expect(estimateJpegQuality(new Uint8Array([0xFF]))).toBeUndefined();
  });

  it('returns undefined for JPEG without DQT marker', () => {
    // SOI + SOF + SOS + EOI (no DQT)
    const jpeg = new Uint8Array([
      0xFF, 0xD8, // SOI
      0xFF, 0xDA, 0x00, 0x03, 0x00, // SOS
      0xFF, 0xD9, // EOI
    ]);
    expect(estimateJpegQuality(jpeg)).toBeUndefined();
  });

  it('estimates quality 50 correctly', () => {
    const jpeg = buildJpegWithQuality(50);
    const quality = estimateJpegQuality(jpeg);
    expect(quality).toBeDefined();
    expect(quality!).toBeGreaterThanOrEqual(45);
    expect(quality!).toBeLessThanOrEqual(55);
  });

  it('estimates quality 80 correctly', () => {
    const jpeg = buildJpegWithQuality(80);
    const quality = estimateJpegQuality(jpeg);
    expect(quality).toBeDefined();
    expect(quality!).toBeGreaterThanOrEqual(75);
    expect(quality!).toBeLessThanOrEqual(85);
  });

  it('estimates quality 95 correctly', () => {
    const jpeg = buildJpegWithQuality(95);
    const quality = estimateJpegQuality(jpeg);
    expect(quality).toBeDefined();
    expect(quality!).toBeGreaterThanOrEqual(90);
    expect(quality!).toBeLessThanOrEqual(100);
  });

  it('estimates quality 10 (low) correctly', () => {
    const jpeg = buildJpegWithQuality(10);
    const quality = estimateJpegQuality(jpeg);
    expect(quality).toBeDefined();
    expect(quality!).toBeGreaterThanOrEqual(5);
    expect(quality!).toBeLessThanOrEqual(15);
  });

  it('estimates quality 100 correctly', () => {
    const jpeg = buildJpegWithQuality(100);
    const quality = estimateJpegQuality(jpeg);
    expect(quality).toBeDefined();
    // Quality 100 produces scale factor 0, which can round to 99-100
    expect(quality!).toBeGreaterThanOrEqual(98);
    expect(quality!).toBeLessThanOrEqual(100);
  });

  it('quality estimates are ordered correctly', () => {
    const q10 = estimateJpegQuality(buildJpegWithQuality(10))!;
    const q50 = estimateJpegQuality(buildJpegWithQuality(50))!;
    const q80 = estimateJpegQuality(buildJpegWithQuality(80))!;
    const q95 = estimateJpegQuality(buildJpegWithQuality(95))!;

    expect(q10).toBeLessThan(q50);
    expect(q50).toBeLessThan(q80);
    expect(q80).toBeLessThan(q95);
  });

  it('estimates from real JPEG fixture', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const fixturesDir = resolve(__dirname, '../../../fixtures/images');

    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const quality = estimateJpegQuality(jpegBytes);

    // Should return a reasonable quality estimate (1-100)
    expect(quality).toBeDefined();
    expect(quality!).toBeGreaterThanOrEqual(1);
    expect(quality!).toBeLessThanOrEqual(100);
  });
});

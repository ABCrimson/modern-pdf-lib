/**
 * Tests for TIFF direct embedding (strip/tile mapping to PDF).
 *
 * Covers canDirectEmbed() and embedTiffDirect() from
 * the tiffDirectEmbed module.
 */

import { describe, it, expect } from 'vitest';
import {
  canDirectEmbed,
  embedTiffDirect,
} from '../../../../src/assets/image/tiffDirectEmbed.js';

// ---------------------------------------------------------------------------
// Helpers: build minimal TIFF files for testing
// ---------------------------------------------------------------------------

/**
 * Build a minimal uncompressed TIFF file (little-endian).
 *
 * Creates a valid TIFF with:
 * - ImageWidth, ImageLength
 * - BitsPerSample = 8
 * - Compression = 1 (none)
 * - PhotometricInterpretation = 2 (RGB)
 * - SamplesPerPixel = 3
 * - StripOffsets, StripByteCounts
 *
 * The pixel data is a flat RGB buffer.
 */
function buildUncompressedTiff(width: number, height: number, pixelData: Uint8Array): Uint8Array {
  const numTags = 8;
  const ifdOffset = 8; // Right after TIFF header
  const ifdSize = 2 + numTags * 12 + 4; // count + entries + next IFD pointer
  const dataOffset = ifdOffset + ifdSize;

  const totalSize = dataOffset + pixelData.length;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // TIFF header (little-endian)
  buf[0] = 0x49; buf[1] = 0x49; // II
  view.setUint16(2, 42, true);   // Magic number
  view.setUint32(4, ifdOffset, true); // Offset to first IFD

  let pos = ifdOffset;

  // Number of directory entries
  view.setUint16(pos, numTags, true);
  pos += 2;

  // Helper to write an IFD entry
  function writeTag(tag: number, type: number, count: number, value: number): void {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, count, true);
    view.setUint32(pos + 8, value, true);
    pos += 12;
  }

  // Tags (type 3 = SHORT, type 4 = LONG)
  writeTag(256, 3, 1, width);        // ImageWidth
  writeTag(257, 3, 1, height);       // ImageLength
  writeTag(258, 3, 1, 8);            // BitsPerSample
  writeTag(259, 3, 1, 1);            // Compression (none)
  writeTag(262, 3, 1, 2);            // PhotometricInterpretation (RGB)
  writeTag(273, 4, 1, dataOffset);   // StripOffsets
  writeTag(277, 3, 1, 3);            // SamplesPerPixel
  writeTag(279, 4, 1, pixelData.length); // StripByteCounts

  // Next IFD offset (0 = last)
  view.setUint32(pos, 0, true);

  // Pixel data
  buf.set(pixelData, dataOffset);

  return buf;
}

/**
 * Build a minimal TIFF with JPEG compression (single strip).
 */
function buildJpegTiff(width: number, height: number, jpegData: Uint8Array): Uint8Array {
  const numTags = 8;
  const ifdOffset = 8;
  const ifdSize = 2 + numTags * 12 + 4;
  const dataOffset = ifdOffset + ifdSize;

  const totalSize = dataOffset + jpegData.length;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // TIFF header (little-endian)
  buf[0] = 0x49; buf[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  let pos = ifdOffset;
  view.setUint16(pos, numTags, true);
  pos += 2;

  function writeTag(tag: number, type: number, count: number, value: number): void {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, count, true);
    view.setUint32(pos + 8, value, true);
    pos += 12;
  }

  writeTag(256, 3, 1, width);
  writeTag(257, 3, 1, height);
  writeTag(258, 3, 1, 8);
  writeTag(259, 3, 1, 7);            // Compression = JPEG (new-style)
  writeTag(262, 3, 1, 2);            // RGB
  writeTag(273, 4, 1, dataOffset);   // StripOffsets
  writeTag(277, 3, 1, 3);
  writeTag(279, 4, 1, jpegData.length);

  view.setUint32(pos, 0, true);
  buf.set(jpegData, dataOffset);

  return buf;
}

/**
 * Build a minimal TIFF with Deflate compression (single strip).
 */
function buildDeflateTiff(width: number, height: number, deflateData: Uint8Array): Uint8Array {
  const numTags = 8;
  const ifdOffset = 8;
  const ifdSize = 2 + numTags * 12 + 4;
  const dataOffset = ifdOffset + ifdSize;

  const totalSize = dataOffset + deflateData.length;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  buf[0] = 0x49; buf[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  let pos = ifdOffset;
  view.setUint16(pos, numTags, true);
  pos += 2;

  function writeTag(tag: number, type: number, count: number, value: number): void {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, count, true);
    view.setUint32(pos + 8, value, true);
    pos += 12;
  }

  writeTag(256, 3, 1, width);
  writeTag(257, 3, 1, height);
  writeTag(258, 3, 1, 8);
  writeTag(259, 3, 1, 8);            // Compression = Deflate
  writeTag(262, 3, 1, 2);
  writeTag(273, 4, 1, dataOffset);
  writeTag(277, 3, 1, 3);
  writeTag(279, 4, 1, deflateData.length);

  view.setUint32(pos, 0, true);
  buf.set(deflateData, dataOffset);

  return buf;
}

/**
 * Build a minimal big-endian TIFF with uncompressed data.
 */
function buildUncompressedTiffBE(width: number, height: number, pixelData: Uint8Array): Uint8Array {
  const numTags = 8;
  const ifdOffset = 8;
  const ifdSize = 2 + numTags * 12 + 4;
  const dataOffset = ifdOffset + ifdSize;

  const totalSize = dataOffset + pixelData.length;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // TIFF header (big-endian)
  buf[0] = 0x4D; buf[1] = 0x4D;
  view.setUint16(2, 42, false);
  view.setUint32(4, ifdOffset, false);

  let pos = ifdOffset;
  view.setUint16(pos, numTags, false);
  pos += 2;

  function writeTag(tag: number, type: number, count: number, value: number): void {
    view.setUint16(pos, tag, false);
    view.setUint16(pos + 2, type, false);
    view.setUint32(pos + 4, count, false);
    view.setUint32(pos + 8, value, false);
    pos += 12;
  }

  writeTag(256, 3, 1, width);
  writeTag(257, 3, 1, height);
  writeTag(258, 3, 1, 8);
  writeTag(259, 3, 1, 1);
  writeTag(262, 3, 1, 2);
  writeTag(273, 4, 1, dataOffset);
  writeTag(277, 3, 1, 3);
  writeTag(279, 4, 1, pixelData.length);

  view.setUint32(pos, 0, false);
  buf.set(pixelData, dataOffset);

  return buf;
}

// ---------------------------------------------------------------------------
// canDirectEmbed
// ---------------------------------------------------------------------------

describe('canDirectEmbed', () => {
  it('returns true for uncompressed TIFF', () => {
    const pixelData = new Uint8Array(4 * 4 * 3);
    const tiff = buildUncompressedTiff(4, 4, pixelData);
    expect(canDirectEmbed(tiff)).toBe(true);
  });

  it('returns true for JPEG-compressed TIFF', () => {
    // Fake JPEG data (just SOI + EOI markers)
    const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
    const tiff = buildJpegTiff(4, 4, jpegData);
    expect(canDirectEmbed(tiff)).toBe(true);
  });

  it('returns true for Deflate-compressed TIFF', () => {
    const deflateData = new Uint8Array([0x78, 0x9C, 0x63, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]);
    const tiff = buildDeflateTiff(4, 4, deflateData);
    expect(canDirectEmbed(tiff)).toBe(true);
  });

  it('returns false for too-short data', () => {
    expect(canDirectEmbed(new Uint8Array(4))).toBe(false);
  });

  it('returns false for non-TIFF data', () => {
    const notTiff = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(canDirectEmbed(notTiff)).toBe(false);
  });

  it('returns true for big-endian TIFF', () => {
    const pixelData = new Uint8Array(4 * 4 * 3);
    const tiff = buildUncompressedTiffBE(4, 4, pixelData);
    expect(canDirectEmbed(tiff)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// embedTiffDirect
// ---------------------------------------------------------------------------

describe('embedTiffDirect', () => {
  it('embeds uncompressed TIFF with correct dimensions', () => {
    const w = 10, h = 8;
    const pixelData = new Uint8Array(w * h * 3);
    // Fill with red
    for (let i = 0; i < w * h; i++) {
      pixelData[i * 3] = 255;
    }
    const tiff = buildUncompressedTiff(w, h, pixelData);
    const result = embedTiffDirect(tiff);

    expect(result.width).toBe(w);
    expect(result.height).toBe(h);
    expect(result.colorSpace).toBe('DeviceRGB');
    expect(result.bitsPerComponent).toBe(8);
    expect(result.filter).toBeUndefined();
    expect(result.data.length).toBe(pixelData.length);
  });

  it('preserves pixel data for uncompressed TIFF', () => {
    const pixelData = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 128]);
    const tiff = buildUncompressedTiff(2, 2, pixelData);
    const result = embedTiffDirect(tiff);

    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
    expect(result.data[3]).toBe(0);
    expect(result.data[4]).toBe(255);
    expect(result.data[5]).toBe(0);
  });

  it('embeds JPEG-in-TIFF with DCTDecode filter', () => {
    const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0xFF, 0xD9]);
    const tiff = buildJpegTiff(100, 50, fakeJpeg);
    const result = embedTiffDirect(tiff);

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.filter).toBe('DCTDecode');
    expect(result.data[0]).toBe(0xFF); // JPEG SOI
    expect(result.data[1]).toBe(0xD8);
  });

  it('embeds Deflate TIFF with FlateDecode filter', () => {
    const deflateData = new Uint8Array([0x78, 0x9C, 0x63, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]);
    const tiff = buildDeflateTiff(4, 4, deflateData);
    const result = embedTiffDirect(tiff);

    expect(result.filter).toBe('FlateDecode');
    expect(result.data.length).toBe(deflateData.length);
  });

  it('handles big-endian TIFF', () => {
    const pixelData = new Uint8Array(3 * 3 * 3);
    const tiff = buildUncompressedTiffBE(3, 3, pixelData);
    const result = embedTiffDirect(tiff);

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(result.colorSpace).toBe('DeviceRGB');
  });

  it('throws on too-short data', () => {
    expect(() => embedTiffDirect(new Uint8Array(4))).toThrow('too short');
  });

  it('throws on invalid magic number', () => {
    const invalid = new Uint8Array([0x49, 0x49, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00]);
    expect(() => embedTiffDirect(invalid)).toThrow('bad magic');
  });

  it('handles grayscale TIFF (PhotometricInterpretation=1)', () => {
    const numTags = 8;
    const ifdOffset = 8;
    const ifdSize = 2 + numTags * 12 + 4;
    const dataOffset = ifdOffset + ifdSize;
    const pixelData = new Uint8Array(4 * 4); // 4x4 grayscale

    const totalSize = dataOffset + pixelData.length;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);

    buf[0] = 0x49; buf[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, ifdOffset, true);

    let pos = ifdOffset;
    view.setUint16(pos, numTags, true);
    pos += 2;

    function writeTag(tag: number, type: number, count: number, value: number): void {
      view.setUint16(pos, tag, true);
      view.setUint16(pos + 2, type, true);
      view.setUint32(pos + 4, count, true);
      view.setUint32(pos + 8, value, true);
      pos += 12;
    }

    writeTag(256, 3, 1, 4);
    writeTag(257, 3, 1, 4);
    writeTag(258, 3, 1, 8);
    writeTag(259, 3, 1, 1);    // No compression
    writeTag(262, 3, 1, 1);    // BlackIsZero (grayscale)
    writeTag(273, 4, 1, dataOffset);
    writeTag(277, 3, 1, 1);    // 1 sample per pixel
    writeTag(279, 4, 1, pixelData.length);

    view.setUint32(pos, 0, true);
    buf.set(pixelData, dataOffset);

    const result = embedTiffDirect(buf);
    expect(result.colorSpace).toBe('DeviceGray');
    expect(result.bitsPerComponent).toBe(8);
  });

  it('handles CMYK TIFF (PhotometricInterpretation=5)', () => {
    const numTags = 8;
    const ifdOffset = 8;
    const ifdSize = 2 + numTags * 12 + 4;
    const dataOffset = ifdOffset + ifdSize;
    const pixelData = new Uint8Array(4 * 4 * 4); // 4x4 CMYK

    const totalSize = dataOffset + pixelData.length;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);

    buf[0] = 0x49; buf[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, ifdOffset, true);

    let pos = ifdOffset;
    view.setUint16(pos, numTags, true);
    pos += 2;

    function writeTag(tag: number, type: number, count: number, value: number): void {
      view.setUint16(pos, tag, true);
      view.setUint16(pos + 2, type, true);
      view.setUint32(pos + 4, count, true);
      view.setUint32(pos + 8, value, true);
      pos += 12;
    }

    writeTag(256, 3, 1, 4);
    writeTag(257, 3, 1, 4);
    writeTag(258, 3, 1, 8);
    writeTag(259, 3, 1, 1);
    writeTag(262, 3, 1, 5);    // Separated (CMYK)
    writeTag(273, 4, 1, dataOffset);
    writeTag(277, 3, 1, 4);    // 4 samples per pixel
    writeTag(279, 4, 1, pixelData.length);

    view.setUint32(pos, 0, true);
    buf.set(pixelData, dataOffset);

    const result = embedTiffDirect(buf);
    expect(result.colorSpace).toBe('DeviceCMYK');
  });

  it('supports page option for multi-page TIFF (page 0)', () => {
    const pixelData = new Uint8Array(2 * 2 * 3);
    const tiff = buildUncompressedTiff(2, 2, pixelData);
    const result = embedTiffDirect(tiff, { page: 0 });
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it('throws for invalid page index', () => {
    const pixelData = new Uint8Array(2 * 2 * 3);
    const tiff = buildUncompressedTiff(2, 2, pixelData);
    expect(() => embedTiffDirect(tiff, { page: 5 })).toThrow('page 5 not found');
  });
});

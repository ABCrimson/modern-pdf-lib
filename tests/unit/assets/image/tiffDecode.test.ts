/**
 * Tests for TIFF decoding.
 *
 * Covers:
 * - TIFF detection (isTiff)
 * - IFD parsing (parseTiffIfd)
 * - Byte order detection (II / MM)
 * - Uncompressed (compression=1) decoding
 * - PackBits (compression=32773) decompression
 * - LZW (compression=5) decompression
 * - Deflate (compression=8) decompression
 * - BitsPerSample: 1, 4, 8, 16
 * - SamplesPerPixel: 1, 3, 4
 * - PhotometricInterpretation: 0 (WhiteIsZero), 1 (BlackIsZero), 2 (RGB)
 * - Multi-page TIFF support
 * - Error handling
 */

import { describe, it, expect } from 'vitest';
import {
  decodeTiff,
  decodeTiffPage,
  decodeTiffAll,
  getTiffPageCount,
  parseTiffIfd,
  isTiff,
} from '../../../../src/assets/image/tiffDecode.js';
import type { TiffImage, IfdEntry } from '../../../../src/assets/image/tiffDecode.js';
import { deflateSync } from 'fflate';

// ---------------------------------------------------------------------------
// Helpers — minimal valid TIFF construction
// ---------------------------------------------------------------------------

interface TiffTag {
  tag: number;
  type: number; // 3=SHORT, 4=LONG
  values: number[];
}

/**
 * Build a minimal valid TIFF file.
 *
 * @param tags      IFD tags to include.
 * @param imageData Raw pixel data (placed after the IFD).
 * @param littleEndian Whether to use LE byte order.
 * @param nextIfdOffset Offset to next IFD (0 = no next IFD).
 */
function buildTiff(
  tags: TiffTag[],
  imageData: Uint8Array,
  littleEndian: boolean = true,
  nextIfdOffset: number = 0,
): Uint8Array {
  // Layout:
  // [0..1]   Byte order
  // [2..3]   Magic 42
  // [4..7]   Offset to first IFD (= 8)
  // [8..]    IFD entries
  // After IFD: image data

  const ifdOffset = 8;
  const numEntries = tags.length;
  const ifdSize = 2 + numEntries * 12 + 4; // 2 (count) + entries + 4 (next IFD)

  // Values that don't fit in 4 bytes go into an overflow area after the IFD
  const overflowEntries: Array<{ entryIdx: number; data: Uint8Array }> = [];
  let overflowSize = 0;

  const overflowBase = ifdOffset + ifdSize;

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    const typeSize = tag.type === 3 ? 2 : 4;
    const totalSize = typeSize * tag.values.length;
    if (totalSize > 4) {
      const buf = new Uint8Array(totalSize);
      const view = new DataView(buf.buffer);
      for (let j = 0; j < tag.values.length; j++) {
        if (tag.type === 3) {
          view.setUint16(j * 2, tag.values[j]!, littleEndian);
        } else {
          view.setUint32(j * 4, tag.values[j]!, littleEndian);
        }
      }
      overflowEntries.push({ entryIdx: i, data: buf });
      overflowSize += totalSize;
    }
  }

  const imageDataOffset = overflowBase + overflowSize;
  const totalSize = imageDataOffset + imageData.length;
  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer);

  // Header
  if (littleEndian) {
    result[0] = 0x49; result[1] = 0x49; // II
  } else {
    result[0] = 0x4D; result[1] = 0x4D; // MM
  }
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, ifdOffset, littleEndian);

  // IFD
  let pos = ifdOffset;
  view.setUint16(pos, numEntries, littleEndian);
  pos += 2;

  let currentOverflow = overflowBase;

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    view.setUint16(pos, tag.tag, littleEndian);
    view.setUint16(pos + 2, tag.type, littleEndian);
    view.setUint32(pos + 4, tag.values.length, littleEndian);

    const typeSize = tag.type === 3 ? 2 : 4;
    const totalDataSize = typeSize * tag.values.length;

    if (totalDataSize <= 4) {
      // Inline value
      if (tag.type === 3) {
        for (let j = 0; j < tag.values.length; j++) {
          view.setUint16(pos + 8 + j * 2, tag.values[j]!, littleEndian);
        }
      } else {
        for (let j = 0; j < tag.values.length; j++) {
          view.setUint32(pos + 8 + j * 4, tag.values[j]!, littleEndian);
        }
      }
    } else {
      // Pointer to overflow area
      view.setUint32(pos + 8, currentOverflow, littleEndian);
      const oe = overflowEntries.find(e => e.entryIdx === i);
      if (oe) {
        result.set(oe.data, currentOverflow);
        currentOverflow += oe.data.length;
      }
    }

    pos += 12;
  }

  // Next IFD offset
  view.setUint32(pos, nextIfdOffset, littleEndian);

  // Image data
  result.set(imageData, imageDataOffset);

  // Fix strip offsets to point to actual image data location
  // Find the StripOffsets tag and update it
  let tagPos = ifdOffset + 2;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    if (tag.tag === 273) { // StripOffsets
      const typeSize = tag.type === 3 ? 2 : 4;
      const totalDataSize = typeSize * tag.values.length;
      if (totalDataSize <= 4) {
        if (tag.type === 3) {
          view.setUint16(tagPos + 8, imageDataOffset, littleEndian);
        } else {
          view.setUint32(tagPos + 8, imageDataOffset, littleEndian);
        }
      }
    }
    tagPos += 12;
  }

  return result;
}

/** Build a minimal uncompressed grayscale TIFF (8-bit). */
function buildGrayscaleTiff(width: number, height: number, pixelValue: number = 128): Uint8Array {
  const imageData = new Uint8Array(width * height);
  imageData.fill(pixelValue);

  const tags: TiffTag[] = [
    { tag: 256, type: 3, values: [width] },           // ImageWidth
    { tag: 257, type: 3, values: [height] },          // ImageHeight
    { tag: 258, type: 3, values: [8] },               // BitsPerSample
    { tag: 259, type: 3, values: [1] },               // Compression (none)
    { tag: 262, type: 3, values: [1] },               // PhotometricInterpretation (BlackIsZero)
    { tag: 273, type: 4, values: [0] },               // StripOffsets (placeholder)
    { tag: 277, type: 3, values: [1] },               // SamplesPerPixel
    { tag: 278, type: 4, values: [height] },          // RowsPerStrip
    { tag: 279, type: 4, values: [width * height] },  // StripByteCounts
  ];

  return buildTiff(tags, imageData);
}

/** Build a minimal uncompressed RGB TIFF. */
function buildRgbTiff(width: number, height: number, r: number, g: number, b: number): Uint8Array {
  const imageData = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    imageData[i * 3] = r;
    imageData[i * 3 + 1] = g;
    imageData[i * 3 + 2] = b;
  }

  const tags: TiffTag[] = [
    { tag: 256, type: 3, values: [width] },
    { tag: 257, type: 3, values: [height] },
    { tag: 258, type: 3, values: [8] },
    { tag: 259, type: 3, values: [1] },
    { tag: 262, type: 3, values: [2] },               // RGB
    { tag: 273, type: 4, values: [0] },
    { tag: 277, type: 3, values: [3] },
    { tag: 278, type: 4, values: [height] },
    { tag: 279, type: 4, values: [width * height * 3] },
  ];

  return buildTiff(tags, imageData);
}

/** Build PackBits compressed data from raw bytes. */
function packBitsEncode(input: Uint8Array): Uint8Array {
  // Simple PackBits encoder: store as literal runs
  const output: number[] = [];
  let i = 0;
  while (i < input.length) {
    const remaining = input.length - i;
    const runLen = Math.min(remaining, 128);
    output.push(runLen - 1); // n = literal count - 1
    for (let j = 0; j < runLen; j++) {
      output.push(input[i + j]!);
    }
    i += runLen;
  }
  return new Uint8Array(output);
}

// ---------------------------------------------------------------------------
// Tests: isTiff detection
// ---------------------------------------------------------------------------

describe('isTiff', () => {
  it('detects little-endian TIFF', () => {
    const tiff = buildGrayscaleTiff(2, 2);
    expect(isTiff(tiff)).toBe(true);
  });

  it('detects big-endian TIFF', () => {
    const tiff = buildGrayscaleTiff(2, 2);
    // Convert to big-endian
    const be = new Uint8Array(tiff.length);
    be.set(tiff);
    be[0] = 0x4D; be[1] = 0x4D;
    const view = new DataView(be.buffer);
    view.setUint16(2, 42, false); // big-endian magic
    expect(isTiff(be)).toBe(true);
  });

  it('rejects non-TIFF data', () => {
    expect(isTiff(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBe(false); // PNG
    expect(isTiff(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))).toBe(false); // JPEG
    expect(isTiff(new Uint8Array(4))).toBe(false);
  });

  it('rejects data too short', () => {
    expect(isTiff(new Uint8Array(3))).toBe(false);
    expect(isTiff(new Uint8Array(0))).toBe(false);
  });

  it('rejects wrong magic number', () => {
    const data = new Uint8Array(8);
    data[0] = 0x49; data[1] = 0x49;
    const view = new DataView(data.buffer);
    view.setUint16(2, 43, true); // Wrong magic
    expect(isTiff(data)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: IFD parsing
// ---------------------------------------------------------------------------

describe('parseTiffIfd', () => {
  it('parses IFD entries from a simple TIFF', () => {
    const tiff = buildGrayscaleTiff(4, 4);
    const entries = parseTiffIfd(tiff, 8, true);

    expect(entries.length).toBeGreaterThan(0);

    // Find ImageWidth tag
    const widthEntry = entries.find(e => e.tag === 256);
    expect(widthEntry).toBeDefined();
    expect(widthEntry!.values[0]).toBe(4);

    // Find ImageHeight tag
    const heightEntry = entries.find(e => e.tag === 257);
    expect(heightEntry).toBeDefined();
    expect(heightEntry!.values[0]).toBe(4);
  });

  it('parses SHORT type values correctly', () => {
    const tiff = buildGrayscaleTiff(10, 10);
    const entries = parseTiffIfd(tiff, 8, true);

    const bps = entries.find(e => e.tag === 258); // BitsPerSample
    expect(bps).toBeDefined();
    expect(bps!.type).toBe(3); // SHORT
    expect(bps!.values[0]).toBe(8);
  });

  it('parses LONG type values correctly', () => {
    const tiff = buildGrayscaleTiff(10, 10);
    const entries = parseTiffIfd(tiff, 8, true);

    const rps = entries.find(e => e.tag === 278); // RowsPerStrip
    expect(rps).toBeDefined();
    expect(rps!.type).toBe(4); // LONG
    expect(rps!.values[0]).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Tests: Uncompressed decoding
// ---------------------------------------------------------------------------

describe('decodeTiff — uncompressed', () => {
  it('decodes a grayscale 8-bit image', () => {
    const tiff = buildGrayscaleTiff(4, 4, 200);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.channels).toBe(1);
    expect(result.bitsPerSample).toBe(8);
    expect(result.pixels.length).toBe(16);

    // All pixels should be 200
    for (let i = 0; i < 16; i++) {
      expect(result.pixels[i]).toBe(200);
    }
  });

  it('decodes an RGB 8-bit image', () => {
    const tiff = buildRgbTiff(3, 3, 255, 128, 64);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(result.channels).toBe(3);
    expect(result.pixels.length).toBe(27);

    // Check first pixel
    expect(result.pixels[0]).toBe(255); // R
    expect(result.pixels[1]).toBe(128); // G
    expect(result.pixels[2]).toBe(64);  // B
  });

  it('handles WhiteIsZero (photometric=0)', () => {
    const imageData = new Uint8Array(4);
    imageData.fill(0); // 0 in data = white (255 after inversion)

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [0] },  // WhiteIsZero
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [4] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    // Data=0 with WhiteIsZero should be inverted to 255
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(255);
    }
  });

  it('handles BlackIsZero (photometric=1)', () => {
    const tiff = buildGrayscaleTiff(2, 2, 0);
    const result = decodeTiff(tiff);

    // Data=0 with BlackIsZero should remain 0
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: PackBits decompression
// ---------------------------------------------------------------------------

describe('decodeTiff — PackBits compression', () => {
  it('decompresses PackBits-compressed grayscale image', () => {
    const rawPixels = new Uint8Array([100, 100, 100, 100, 200, 200, 200, 200]);
    const compressed = packBitsEncode(rawPixels);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [4] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [32773] },  // PackBits
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [compressed.length] },
    ];

    const tiff = buildTiff(tags, compressed);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(4);
    expect(result.height).toBe(2);
    expect(result.pixels.length).toBe(8);

    // Check pixel values match original
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(100);
    }
    for (let i = 4; i < 8; i++) {
      expect(result.pixels[i]).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: LZW decompression
// ---------------------------------------------------------------------------

describe('decodeTiff — LZW compression', () => {
  it('decompresses a simple LZW-compressed image', () => {
    // Build a minimal LZW bitstream
    // LZW uses variable-length codes starting at 9 bits
    // ClearCode=256, EOI=257

    // For a simple 4-pixel grayscale image [128, 128, 128, 128]:
    // Encode: ClearCode, 128, 128, 128, 128, EOI
    const bits: boolean[] = [];

    function writeBits(val: number, nBits: number): void {
      for (let i = 0; i < nBits; i++) {
        bits.push(((val >> i) & 1) === 1);
      }
    }

    writeBits(256, 9);  // Clear code
    writeBits(128, 9);  // First pixel
    writeBits(128, 9);  // Second pixel
    writeBits(128, 9);  // Third pixel
    writeBits(128, 9);  // Fourth pixel
    writeBits(257, 9);  // EOI

    // Convert bits to bytes
    const byteCount = Math.ceil(bits.length / 8);
    const lzwData = new Uint8Array(byteCount);
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) {
        lzwData[Math.floor(i / 8)] |= 1 << (i % 8);
      }
    }

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [5] },  // LZW
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [lzwData.length] },
    ];

    const tiff = buildTiff(tags, lzwData);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.channels).toBe(1);

    // All pixels should be 128
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(128);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Deflate decompression
// ---------------------------------------------------------------------------

describe('decodeTiff — Deflate compression', () => {
  it('decompresses deflate-compressed grayscale image', () => {
    const rawPixels = new Uint8Array([50, 100, 150, 200]);
    const compressed = deflateSync(rawPixels);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [8] },  // Deflate
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [compressed.length] },
    ];

    const tiff = buildTiff(tags, compressed);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pixels[0]).toBe(50);
    expect(result.pixels[1]).toBe(100);
    expect(result.pixels[2]).toBe(150);
    expect(result.pixels[3]).toBe(200);
  });

  it('decompresses deflate-compressed RGB image', () => {
    const rawPixels = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 128]);
    const compressed = deflateSync(rawPixels);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [8] },
      { tag: 262, type: 3, values: [2] },  // RGB
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [3] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [compressed.length] },
    ];

    const tiff = buildTiff(tags, compressed);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.channels).toBe(3);
    expect(result.pixels[0]).toBe(255); // Red pixel
    expect(result.pixels[1]).toBe(0);
    expect(result.pixels[2]).toBe(0);
    expect(result.pixels[3]).toBe(0);   // Green pixel
    expect(result.pixels[4]).toBe(255);
    expect(result.pixels[5]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Bit depth normalization
// ---------------------------------------------------------------------------

describe('decodeTiff — bit depth normalization', () => {
  it('normalizes 1-bit BlackIsZero', () => {
    // 2x2 image: all bits set to 1 = black
    // In 1-bit: byte = 0b11000000 for first 2 pixels in a row
    const imageData = new Uint8Array([0xC0, 0xC0]); // Two rows, each with bits for 2 pixels

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [1] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },  // BlackIsZero
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [2] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.bitsPerSample).toBe(1);

    // Bit=1 with BlackIsZero means white (255)
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(255);
    }
  });

  it('normalizes 1-bit WhiteIsZero', () => {
    // All bits set to 1 = black when WhiteIsZero
    const imageData = new Uint8Array([0xC0, 0xC0]);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [1] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [0] },  // WhiteIsZero
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [2] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    // Bit=1 with WhiteIsZero means black (0)
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(0);
    }
  });

  it('normalizes 4-bit grayscale', () => {
    // 2x2 image: nibbles [0xF, 0x0, 0x8, 0x4]
    const imageData = new Uint8Array([0xF0, 0x84]);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [4] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },  // BlackIsZero
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [2] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.bitsPerSample).toBe(4);
    expect(result.pixels[0]).toBe(255);   // 0xF -> 255
    expect(result.pixels[1]).toBe(0);     // 0x0 -> 0
  });

  it('normalizes 16-bit grayscale to 8-bit', () => {
    // 2x1 image: two 16-bit values [0x8000, 0xFF00]
    const imageData = new Uint8Array(4);
    const view = new DataView(imageData.buffer);
    view.setUint16(0, 0x8000, true); // LE
    view.setUint16(2, 0xFF00, true);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [1] },
      { tag: 258, type: 3, values: [16] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [1] },
      { tag: 279, type: 4, values: [4] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.bitsPerSample).toBe(16);
    expect(result.pixels[0]).toBe(0x80); // High byte of 0x8000
    expect(result.pixels[1]).toBe(0xFF); // High byte of 0xFF00
  });
});

// ---------------------------------------------------------------------------
// Tests: RGBA (4 samples per pixel)
// ---------------------------------------------------------------------------

describe('decodeTiff — RGBA', () => {
  it('decodes 4-channel RGBA image', () => {
    const imageData = new Uint8Array([
      255, 0, 0, 128,    // Red, alpha=128
      0, 255, 0, 255,    // Green, alpha=255
    ]);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [1] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [2] },  // RGB
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [4] },  // 4 samples
      { tag: 278, type: 4, values: [1] },
      { tag: 279, type: 4, values: [8] },
    ];

    const tiff = buildTiff(tags, imageData);
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.channels).toBe(4);
    expect(result.pixels[0]).toBe(255);  // R
    expect(result.pixels[1]).toBe(0);    // G
    expect(result.pixels[2]).toBe(0);    // B
    expect(result.pixels[3]).toBe(128);  // A
  });
});

// ---------------------------------------------------------------------------
// Tests: Multi-page TIFF
// ---------------------------------------------------------------------------

describe('multi-page TIFF', () => {
  /** Build a 2-page TIFF file. */
  function buildMultiPageTiff(): Uint8Array {
    // Page 1: 2x2 grayscale, value=100
    // Page 2: 3x3 grayscale, value=200
    const page1Data = new Uint8Array(4);
    page1Data.fill(100);

    const page2Data = new Uint8Array(9);
    page2Data.fill(200);

    // Manual layout:
    // [0..7]   Header (8 bytes)
    // [8..]    IFD 1
    // [after IFD 1] overflow + page1 data
    // [after page 1] IFD 2
    // [after IFD 2] overflow + page2 data

    const littleEndian = true;

    // Page 1 tags
    const page1Tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },  // Placeholder
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [4] },
    ];

    // Build page 1 IFD
    const numEntries1 = page1Tags.length;
    const ifd1Offset = 8;
    const ifd1Size = 2 + numEntries1 * 12 + 4;
    const page1DataOffset = ifd1Offset + ifd1Size;
    const ifd2Offset = page1DataOffset + page1Data.length;

    // Page 2 tags
    const page2Tags: TiffTag[] = [
      { tag: 256, type: 3, values: [3] },
      { tag: 257, type: 3, values: [3] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [3] },
      { tag: 279, type: 4, values: [9] },
    ];

    const numEntries2 = page2Tags.length;
    const ifd2Size = 2 + numEntries2 * 12 + 4;
    const page2DataOffset = ifd2Offset + ifd2Size;
    const totalSize = page2DataOffset + page2Data.length;

    const result = new Uint8Array(totalSize);
    const view = new DataView(result.buffer);

    // Header
    result[0] = 0x49; result[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, ifd1Offset, true);

    // IFD 1
    let pos = ifd1Offset;
    view.setUint16(pos, numEntries1, true);
    pos += 2;
    for (const tag of page1Tags) {
      view.setUint16(pos, tag.tag, true);
      view.setUint16(pos + 2, tag.type, true);
      view.setUint32(pos + 4, tag.values.length, true);
      if (tag.tag === 273) {
        view.setUint32(pos + 8, page1DataOffset, true);
      } else if (tag.type === 3) {
        view.setUint16(pos + 8, tag.values[0]!, true);
      } else {
        view.setUint32(pos + 8, tag.values[0]!, true);
      }
      pos += 12;
    }
    // Next IFD = IFD 2
    view.setUint32(pos, ifd2Offset, true);

    // Page 1 data
    result.set(page1Data, page1DataOffset);

    // IFD 2
    pos = ifd2Offset;
    view.setUint16(pos, numEntries2, true);
    pos += 2;
    for (const tag of page2Tags) {
      view.setUint16(pos, tag.tag, true);
      view.setUint16(pos + 2, tag.type, true);
      view.setUint32(pos + 4, tag.values.length, true);
      if (tag.tag === 273) {
        view.setUint32(pos + 8, page2DataOffset, true);
      } else if (tag.type === 3) {
        view.setUint16(pos + 8, tag.values[0]!, true);
      } else {
        view.setUint32(pos + 8, tag.values[0]!, true);
      }
      pos += 12;
    }
    // Next IFD = 0 (last)
    view.setUint32(pos, 0, true);

    // Page 2 data
    result.set(page2Data, page2DataOffset);

    return result;
  }

  it('counts pages correctly', () => {
    const tiff = buildMultiPageTiff();
    expect(getTiffPageCount(tiff)).toBe(2);
  });

  it('counts 1 page for single-page TIFF', () => {
    const tiff = buildGrayscaleTiff(2, 2);
    expect(getTiffPageCount(tiff)).toBe(1);
  });

  it('decodes first page by default', () => {
    const tiff = buildMultiPageTiff();
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    for (let i = 0; i < 4; i++) {
      expect(result.pixels[i]).toBe(100);
    }
  });

  it('decodes specific page by index', () => {
    const tiff = buildMultiPageTiff();
    const result = decodeTiffPage(tiff, 1);

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    for (let i = 0; i < 9; i++) {
      expect(result.pixels[i]).toBe(200);
    }
  });

  it('decodes all pages', () => {
    const tiff = buildMultiPageTiff();
    const pages = decodeTiffAll(tiff);

    expect(pages.length).toBe(2);
    expect(pages[0]!.width).toBe(2);
    expect(pages[1]!.width).toBe(3);
  });

  it('decodeTiff with page option', () => {
    const tiff = buildMultiPageTiff();
    const result = decodeTiff(tiff, { page: 1 });

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
  });

  it('throws on out-of-range page index', () => {
    const tiff = buildMultiPageTiff();
    expect(() => decodeTiffPage(tiff, 5)).toThrow('page index');
  });
});

// ---------------------------------------------------------------------------
// Tests: Byte order
// ---------------------------------------------------------------------------

describe('decodeTiff — big-endian byte order', () => {
  it('decodes big-endian TIFF', () => {
    // Build a simple big-endian TIFF manually
    const width = 2;
    const height = 2;
    const imageData = new Uint8Array([10, 20, 30, 40]);

    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [width] },
      { tag: 257, type: 3, values: [height] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [1] },
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [height] },
      { tag: 279, type: 4, values: [4] },
    ];

    const tiff = buildTiff(tags, imageData, false); // big-endian
    const result = decodeTiff(tiff);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pixels[0]).toBe(10);
    expect(result.pixels[1]).toBe(20);
    expect(result.pixels[2]).toBe(30);
    expect(result.pixels[3]).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Tests: Error handling
// ---------------------------------------------------------------------------

describe('decodeTiff — error handling', () => {
  it('throws on non-TIFF data', () => {
    expect(() => decodeTiff(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toThrow('invalid TIFF header');
  });

  it('throws on missing ImageWidth/ImageHeight', () => {
    // Build a TIFF with only compression tag (no width/height)
    const tags: TiffTag[] = [
      { tag: 259, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
    ];
    const data = buildTiff(tags, new Uint8Array(0));
    expect(() => decodeTiff(data)).toThrow('missing');
  });

  it('throws on unsupported compression', () => {
    const tags: TiffTag[] = [
      { tag: 256, type: 3, values: [2] },
      { tag: 257, type: 3, values: [2] },
      { tag: 258, type: 3, values: [8] },
      { tag: 259, type: 3, values: [99] },  // Unknown compression
      { tag: 262, type: 3, values: [1] },
      { tag: 273, type: 4, values: [0] },
      { tag: 277, type: 3, values: [1] },
      { tag: 278, type: 4, values: [2] },
      { tag: 279, type: 4, values: [4] },
    ];
    const tiff = buildTiff(tags, new Uint8Array(4));
    expect(() => decodeTiff(tiff)).toThrow('unsupported compression');
  });

  it('throws on getTiffPageCount for non-TIFF', () => {
    expect(() => getTiffPageCount(new Uint8Array(10))).toThrow('invalid TIFF');
  });
});

// ---------------------------------------------------------------------------
// Tests: TiffImage interface contract
// ---------------------------------------------------------------------------

describe('TiffImage interface', () => {
  it('has correct shape', () => {
    const tiff = buildGrayscaleTiff(4, 4);
    const result = decodeTiff(tiff);

    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
    expect(result.pixels).toBeInstanceOf(Uint8Array);
    expect([1, 3, 4]).toContain(result.channels);
    expect(typeof result.bitsPerSample).toBe('number');
  });

  it('pixels length matches width * height * channels', () => {
    const tiff = buildRgbTiff(5, 3, 0, 0, 0);
    const result = decodeTiff(tiff);
    expect(result.pixels.length).toBe(result.width * result.height * result.channels);
  });
});

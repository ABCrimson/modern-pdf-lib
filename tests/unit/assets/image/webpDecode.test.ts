/**
 * Tests for WebP decoding.
 *
 * Covers:
 * - RIFF/WebP container parsing
 * - VP8 (lossy) decoding
 * - VP8L (lossless) decoding
 * - ALPH chunk (alpha channel) decoding
 * - Format detection (isWebP, isWebPLossless)
 * - Error handling for invalid/unsupported data
 */

import { describe, it, expect } from 'vitest';
import {
  decodeWebP,
  isWebP,
  isWebPLossless,
} from '../../../../src/assets/image/webpDecode.js';
import type { WebPImage } from '../../../../src/assets/image/webpDecode.js';

// ---------------------------------------------------------------------------
// Helpers — minimal valid WebP construction
// ---------------------------------------------------------------------------

/** Build a RIFF/WebP header. */
function riffHeader(fileSize: number): Uint8Array {
  const h = new Uint8Array(12);
  // RIFF
  h[0] = 0x52; h[1] = 0x49; h[2] = 0x46; h[3] = 0x46;
  // File size (little-endian)
  const view = new DataView(h.buffer);
  view.setUint32(4, fileSize - 8, true);
  // WEBP
  h[8] = 0x57; h[9] = 0x45; h[10] = 0x42; h[11] = 0x50;
  return h;
}

/** Build a chunk header + data. */
function chunk(fourcc: string, data: Uint8Array): Uint8Array {
  const padded = data.length + (data.length & 1); // Pad to even
  const result = new Uint8Array(8 + padded);
  for (let i = 0; i < 4; i++) {
    result[i] = fourcc.charCodeAt(i);
  }
  const view = new DataView(result.buffer);
  view.setUint32(4, data.length, true);
  result.set(data, 8);
  return result;
}

/**
 * Build a minimal VP8 keyframe bitstream.
 * This creates a 1x1 pixel VP8 bitstream for testing.
 */
function buildMinimalVP8(width: number, height: number): Uint8Array {
  // Frame tag: keyframe (bit0=0), version=0, show=1, firstPartSize
  // We'll build a minimal valid VP8 frame
  const headerBytes: number[] = [];

  // Frame tag: 3 bytes, little-endian
  // bit0: 0=keyframe, bits1-3: version=0, bit4: showFrame=1, bits5-23: firstPartSize
  const firstPartSize = 50; // Approximate
  const frameTag = (0) | (0 << 1) | (1 << 4) | (firstPartSize << 5);
  headerBytes.push(frameTag & 0xFF, (frameTag >> 8) & 0xFF, (frameTag >> 16) & 0xFF);

  // Keyframe signature: 0x9D 0x01 0x2A
  headerBytes.push(0x9D, 0x01, 0x2A);

  // Width (LE 16-bit, lower 14 bits = width, upper 2 = scale)
  headerBytes.push(width & 0xFF, (width >> 8) & 0x3F);
  // Height (LE 16-bit)
  headerBytes.push(height & 0xFF, (height >> 8) & 0x3F);

  // Bool decoder data: we need at least enough bytes for the header parsing
  // Fill with neutral bytes (128) for the bool decoder
  const boolData = new Uint8Array(200);
  boolData.fill(128);
  // Set initial value for bool decoder
  boolData[0] = 0x80;
  boolData[1] = 0x00;

  const result = new Uint8Array(headerBytes.length + boolData.length);
  result.set(new Uint8Array(headerBytes), 0);
  result.set(boolData, headerBytes.length);
  return result;
}

/**
 * LSB-first bit writer for constructing VP8L bitstreams.
 */
class BitWriter {
  private buf: number[] = [];
  private curByte = 0;
  private curBit = 0;

  write(val: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.curByte |= ((val >> i) & 1) << this.curBit;
      this.curBit++;
      if (this.curBit === 8) {
        this.buf.push(this.curByte);
        this.curByte = 0;
        this.curBit = 0;
      }
    }
  }

  flush(): Uint8Array {
    if (this.curBit > 0) {
      this.buf.push(this.curByte);
      this.curByte = 0;
      this.curBit = 0;
    }
    return new Uint8Array(this.buf);
  }
}

/**
 * Build a minimal VP8L lossless bitstream for a 1x1 pixel image.
 *
 * The VP8L format for a single pixel is:
 * - Signature 0x2F
 * - 14 bits width-1, 14 bits height-1, 1 bit alpha, 3 bits version
 * - Transform bit = 0 (no transforms)
 * - 5 Huffman code groups using simple codes
 * - Pixel data encoded through the Huffman trees
 */
function buildMinimalVP8L(width: number, height: number, r: number, g: number, b: number, a: number): Uint8Array {
  const header = new Uint8Array(5);
  header[0] = 0x2F; // VP8L signature

  const w = width - 1;
  const h = height - 1;
  const hasAlpha = a < 255 ? 1 : 0;

  let headerBits = 0;
  headerBits |= w & 0x3FFF;
  headerBits |= (h & 0x3FFF) << 14;
  headerBits |= hasAlpha << 28;

  header[1] = headerBits & 0xFF;
  header[2] = (headerBits >> 8) & 0xFF;
  header[3] = (headerBits >> 16) & 0xFF;
  header[4] = (headerBits >> 24) & 0xFF;

  const bw = new BitWriter();

  // No transforms
  bw.write(0, 1);

  // Define 5 Huffman code groups using simple codes.
  // For a single-symbol tree (value X):
  //   - Use numBits=1 format: bit=1 (simple), bit=1 (numBits=1)
  //   - First symbol = X (8 bits)
  //   - Second symbol = X (8 bits) — same symbol, so tree is effectively single
  // When both symbols are the same, readSymbol always returns X.
  const symbols = [g, r, b, a, 0]; // Green, Red, Blue, Alpha, Distance

  for (const sym of symbols) {
    bw.write(1, 1);  // simple code
    bw.write(1, 1);  // numBits = 1 (two 8-bit symbol format)
    bw.write(sym, 8);  // first symbol
    bw.write(sym, 8);  // second symbol (same = single-symbol tree)
  }

  // Now write pixel data: for 1x1, the decoder reads 1 literal pixel.
  // Since all symbols map to the same value, reading from the Huffman tree
  // for each channel will always return the correct value regardless of
  // the bit we read. But we still need to provide a bit for the Huffman
  // read. Write bit=0 for each of the 4 channels (Green, Red, Blue, Alpha).
  // Note: Green is read first as the "green or length" channel.
  // If greenOrLen < 256, it reads Red, Blue, Alpha.
  bw.write(0, 1); // Green Huffman bit
  bw.write(0, 1); // Red Huffman bit
  bw.write(0, 1); // Blue Huffman bit
  bw.write(0, 1); // Alpha Huffman bit

  const encodedData = bw.flush();

  const result = new Uint8Array(5 + encodedData.length);
  result.set(header, 0);
  result.set(encodedData, 5);
  return result;
}

/** Build a complete minimal WebP file with VP8 chunk. */
function buildMinimalWebP_VP8(width: number, height: number): Uint8Array {
  const vp8Data = buildMinimalVP8(width, height);
  const vp8Chunk = chunk('VP8 ', vp8Data);
  const fileSize = 12 + vp8Chunk.length;
  const header = riffHeader(fileSize);

  const result = new Uint8Array(fileSize);
  result.set(header, 0);
  result.set(vp8Chunk, 12);
  return result;
}

/** Build a complete minimal WebP file with VP8L chunk. */
function buildMinimalWebP_VP8L(width: number, height: number, r: number, g: number, b: number, a: number = 255): Uint8Array {
  const vp8lData = buildMinimalVP8L(width, height, r, g, b, a);
  const vp8lChunk = chunk('VP8L', vp8lData);
  const fileSize = 12 + vp8lChunk.length;
  const header = riffHeader(fileSize);

  const result = new Uint8Array(fileSize);
  result.set(header, 0);
  result.set(vp8lChunk, 12);
  return result;
}

/** Build a WebP with VP8 + ALPH chunks. */
function buildWebP_WithAlpha(width: number, height: number): Uint8Array {
  const vp8Data = buildMinimalVP8(width, height);
  const vp8Chunk = chunk('VP8 ', vp8Data);

  // ALPH chunk: header byte + uncompressed alpha data
  const numPixels = width * height;
  const alphPayload = new Uint8Array(1 + numPixels);
  alphPayload[0] = 0x00; // No filtering, no compression
  for (let i = 0; i < numPixels; i++) {
    alphPayload[1 + i] = 200; // Alpha = 200
  }
  const alphChunk = chunk('ALPH', alphPayload);

  const fileSize = 12 + alphChunk.length + vp8Chunk.length;
  const header = riffHeader(fileSize);

  const result = new Uint8Array(fileSize);
  result.set(header, 0);
  result.set(alphChunk, 12);
  result.set(vp8Chunk, 12 + alphChunk.length);
  return result;
}

// ---------------------------------------------------------------------------
// Tests: isWebP detection
// ---------------------------------------------------------------------------

describe('isWebP', () => {
  it('detects valid WebP files', () => {
    const webp = buildMinimalWebP_VP8(2, 2);
    expect(isWebP(webp)).toBe(true);
  });

  it('rejects data too short', () => {
    expect(isWebP(new Uint8Array([0x52, 0x49, 0x46]))).toBe(false);
  });

  it('rejects non-RIFF data', () => {
    expect(isWebP(new Uint8Array(12))).toBe(false);
  });

  it('rejects RIFF file that is not WEBP', () => {
    const data = new Uint8Array(12);
    data[0] = 0x52; data[1] = 0x49; data[2] = 0x46; data[3] = 0x46;
    data[8] = 0x41; data[9] = 0x56; data[10] = 0x49; data[11] = 0x20; // "AVI "
    expect(isWebP(data)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: isWebPLossless
// ---------------------------------------------------------------------------

describe('isWebPLossless', () => {
  it('returns true for VP8L files', () => {
    const webp = buildMinimalWebP_VP8L(1, 1, 255, 0, 0);
    expect(isWebPLossless(webp)).toBe(true);
  });

  it('returns false for VP8 (lossy) files', () => {
    const webp = buildMinimalWebP_VP8(2, 2);
    expect(isWebPLossless(webp)).toBe(false);
  });

  it('returns false for non-WebP data', () => {
    expect(isWebPLossless(new Uint8Array(20))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: VP8 (lossy) decoding
// ---------------------------------------------------------------------------

describe('decodeWebP — VP8 (lossy)', () => {
  it('decodes a minimal VP8 keyframe', () => {
    const webp = buildMinimalWebP_VP8(4, 4);
    const result = decodeWebP(webp);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.channels).toBe(3);
    expect(result.hasAlpha).toBe(false);
    expect(result.pixels.length).toBe(4 * 4 * 3);
  });

  it('decodes a larger VP8 image', () => {
    const webp = buildMinimalWebP_VP8(16, 16);
    const result = decodeWebP(webp);

    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
    expect(result.pixels.length).toBe(16 * 16 * 3);
  });

  it('decodes non-macroblock-aligned dimensions', () => {
    const webp = buildMinimalWebP_VP8(7, 5);
    const result = decodeWebP(webp);

    expect(result.width).toBe(7);
    expect(result.height).toBe(5);
    expect(result.pixels.length).toBe(7 * 5 * 3);
  });

  it('pixel values are valid RGB bytes', () => {
    const webp = buildMinimalWebP_VP8(2, 2);
    const result = decodeWebP(webp);

    for (let i = 0; i < result.pixels.length; i++) {
      expect(result.pixels[i]!).toBeGreaterThanOrEqual(0);
      expect(result.pixels[i]!).toBeLessThanOrEqual(255);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: VP8L (lossless) decoding
// ---------------------------------------------------------------------------

describe('decodeWebP — VP8L (lossless)', () => {
  it('decodes a single-pixel VP8L image', () => {
    const webp = buildMinimalWebP_VP8L(1, 1, 128, 64, 32);
    const result = decodeWebP(webp);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.channels).toBe(3);
    expect(result.hasAlpha).toBe(false);
    expect(result.pixels.length).toBe(3);
    // Verify pixel values (R, G, B)
    expect(result.pixels[0]).toBe(128); // Red
    expect(result.pixels[1]).toBe(64);  // Green
    expect(result.pixels[2]).toBe(32);  // Blue
  });

  it('decodes a VP8L image with alpha', () => {
    const webp = buildMinimalWebP_VP8L(1, 1, 200, 100, 50, 128);
    const result = decodeWebP(webp);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.channels).toBe(4);
    expect(result.hasAlpha).toBe(true);
    expect(result.pixels.length).toBe(4);
    expect(result.pixels[0]).toBe(200); // R
    expect(result.pixels[1]).toBe(100); // G
    expect(result.pixels[2]).toBe(50);  // B
    expect(result.pixels[3]).toBe(128); // A
  });
});

// ---------------------------------------------------------------------------
// Tests: Alpha channel (ALPH chunk)
// ---------------------------------------------------------------------------

describe('decodeWebP — alpha channel', () => {
  it('decodes VP8 with ALPH chunk', () => {
    const webp = buildWebP_WithAlpha(4, 4);
    const result = decodeWebP(webp);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.channels).toBe(4);
    expect(result.hasAlpha).toBe(true);
    expect(result.pixels.length).toBe(4 * 4 * 4);

    // Check alpha values
    for (let i = 0; i < 4 * 4; i++) {
      expect(result.pixels[i * 4 + 3]).toBe(200);
    }
  });

  it('handles uncompressed alpha with no filtering', () => {
    const webp = buildWebP_WithAlpha(2, 2);
    const result = decodeWebP(webp);

    expect(result.hasAlpha).toBe(true);
    // All alpha values should be 200
    for (let i = 0; i < 2 * 2; i++) {
      expect(result.pixels[i * 4 + 3]).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Error handling
// ---------------------------------------------------------------------------

describe('decodeWebP — error handling', () => {
  it('throws on non-RIFF data', () => {
    expect(() => decodeWebP(new Uint8Array(20))).toThrow('RIFF');
  });

  it('throws on RIFF without VP8/VP8L chunk', () => {
    // Build a valid RIFF/WEBP but with unknown chunk
    const unknownChunk = chunk('UNKN', new Uint8Array(4));
    const fileSize = 12 + unknownChunk.length;
    const header = riffHeader(fileSize);
    const data = new Uint8Array(fileSize);
    data.set(header, 0);
    data.set(unknownChunk, 12);

    expect(() => decodeWebP(data)).toThrow('no VP8 or VP8L chunk');
  });

  it('throws on empty data', () => {
    expect(() => decodeWebP(new Uint8Array(0))).toThrow();
  });

  it('throws on VP8 non-keyframe', () => {
    // Build a VP8 with non-keyframe bit set
    const vp8Data = new Uint8Array(20);
    vp8Data[0] = 0x01; // bit0=1 = not a keyframe
    const vp8Chunk = chunk('VP8 ', vp8Data);
    const fileSize = 12 + vp8Chunk.length;
    const header = riffHeader(fileSize);
    const data = new Uint8Array(fileSize);
    data.set(header, 0);
    data.set(vp8Chunk, 12);

    expect(() => decodeWebP(data)).toThrow('keyframe');
  });
});

// ---------------------------------------------------------------------------
// Tests: WebPImage interface contract
// ---------------------------------------------------------------------------

describe('WebPImage interface', () => {
  it('has correct shape for RGB image', () => {
    const webp = buildMinimalWebP_VP8(8, 8);
    const img = decodeWebP(webp);

    expect(typeof img.width).toBe('number');
    expect(typeof img.height).toBe('number');
    expect(img.pixels).toBeInstanceOf(Uint8Array);
    expect(img.channels === 3 || img.channels === 4).toBe(true);
    expect(typeof img.hasAlpha).toBe('boolean');
  });

  it('pixels length matches width * height * channels', () => {
    const webp = buildMinimalWebP_VP8(10, 6);
    const img = decodeWebP(webp);
    expect(img.pixels.length).toBe(img.width * img.height * img.channels);
  });

  it('VP8L pixels length matches dimensions', () => {
    const webp = buildMinimalWebP_VP8L(1, 1, 0, 0, 0);
    const img = decodeWebP(webp);
    expect(img.pixels.length).toBe(img.width * img.height * img.channels);
  });
});

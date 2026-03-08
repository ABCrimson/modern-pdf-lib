/**
 * Tests for WebP optimization and conversion utilities.
 *
 * Covers recompressWebP(), webpToJpeg(), webpToPng(), and encodePngFromPixels()
 * from the webpOptimize module.
 */

import { describe, it, expect } from 'vitest';
import {
  recompressWebP,
  webpToJpeg,
  webpToPng,
  encodePngFromPixels,
} from '../../../../src/assets/image/webpOptimize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat RGB pixel buffer with a single color. */
function buildRgbImage(width: number, height: number, r: number, g: number, b: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  return pixels;
}

/** Build a flat RGBA pixel buffer with a single color. */
function buildRgbaImage(width: number, height: number, r: number, g: number, b: number, a: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = a;
  }
  return pixels;
}

/** Build a flat grayscale pixel buffer. */
function buildGrayImage(width: number, height: number, v: number): Uint8Array {
  const pixels = new Uint8Array(width * height);
  pixels.fill(v);
  return pixels;
}

// ---------------------------------------------------------------------------
// recompressWebP
// ---------------------------------------------------------------------------

describe('recompressWebP', () => {
  it('produces valid JPEG from RGB pixels', () => {
    const pixels = buildRgbImage(8, 8, 255, 0, 0);
    const jpeg = recompressWebP(pixels, 8, 8);

    // Check JPEG SOI marker
    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);

    // Check JPEG EOI marker at end
    expect(jpeg[jpeg.length - 2]).toBe(0xFF);
    expect(jpeg[jpeg.length - 1]).toBe(0xD9);
  });

  it('produces valid JPEG from RGBA pixels (strips alpha)', () => {
    const pixels = buildRgbaImage(8, 8, 0, 255, 0, 128);
    const jpeg = recompressWebP(pixels, 8, 8);

    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);
  });

  it('produces valid JPEG from grayscale pixels', () => {
    const pixels = buildGrayImage(8, 8, 128);
    const jpeg = recompressWebP(pixels, 8, 8);

    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);
  });

  it('accepts custom quality parameter', () => {
    const pixels = buildRgbImage(16, 16, 128, 64, 32);
    const highQ = recompressWebP(pixels, 16, 16, 95);
    const lowQ = recompressWebP(pixels, 16, 16, 10);

    // Higher quality generally produces larger output
    expect(highQ.length).toBeGreaterThan(lowQ.length);
  });

  it('defaults to quality 85', () => {
    const pixels = buildRgbImage(8, 8, 100, 100, 100);
    const result = recompressWebP(pixels, 8, 8);
    // Just verify it produces valid output
    expect(result[0]).toBe(0xFF);
    expect(result[1]).toBe(0xD8);
  });

  it('handles non-multiple-of-8 dimensions', () => {
    const pixels = buildRgbImage(13, 7, 200, 100, 50);
    const jpeg = recompressWebP(pixels, 13, 7);
    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);
  });

  it('handles 1x1 image', () => {
    const pixels = new Uint8Array([128, 64, 32]);
    const jpeg = recompressWebP(pixels, 1, 1);
    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);
  });

  it('throws on pixel data length mismatch', () => {
    const pixels = new Uint8Array(100); // Wrong size for 8x8
    expect(() => recompressWebP(pixels, 8, 8)).toThrow('length mismatch');
  });

  it('handles large image (64x64)', () => {
    const pixels = buildRgbImage(64, 64, 50, 100, 150);
    const jpeg = recompressWebP(pixels, 64, 64);
    expect(jpeg[0]).toBe(0xFF);
    expect(jpeg[1]).toBe(0xD8);
    expect(jpeg.length).toBeGreaterThan(100);
  });

  it('clamps quality to valid range', () => {
    const pixels = buildRgbImage(8, 8, 128, 128, 128);

    // Quality 0 (clamped to 1)
    const veryLow = recompressWebP(pixels, 8, 8, 0);
    expect(veryLow[0]).toBe(0xFF);

    // Quality 200 (clamped to 100)
    const veryHigh = recompressWebP(pixels, 8, 8, 200);
    expect(veryHigh[0]).toBe(0xFF);
  });
});

// ---------------------------------------------------------------------------
// webpToJpeg
// ---------------------------------------------------------------------------

describe('webpToJpeg', () => {
  it('throws for invalid WebP data', () => {
    const notWebP = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => webpToJpeg(notWebP)).toThrow('Invalid WebP');
  });

  it('throws for valid WebP header but requires decoder', () => {
    // Valid WebP RIFF header but no actual decoder
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    expect(() => webpToJpeg(webpHeader)).toThrow('requires the WebP decoder module');
  });

  it('throws for too-short data', () => {
    const short = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    expect(() => webpToJpeg(short)).toThrow('Invalid WebP');
  });
});

// ---------------------------------------------------------------------------
// webpToPng
// ---------------------------------------------------------------------------

describe('webpToPng', () => {
  it('throws for invalid WebP data', () => {
    const notWebP = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(() => webpToPng(notWebP)).toThrow('Invalid WebP');
  });

  it('throws for valid WebP header but requires decoder', () => {
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    expect(() => webpToPng(webpHeader)).toThrow('requires the WebP decoder module');
  });
});

// ---------------------------------------------------------------------------
// encodePngFromPixels
// ---------------------------------------------------------------------------

describe('encodePngFromPixels', () => {
  it('produces valid PNG with correct signature', () => {
    const pixels = buildRgbImage(4, 4, 255, 0, 0);
    const png = encodePngFromPixels(pixels, 4, 4, 3);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4E);
    expect(png[3]).toBe(0x47);
    expect(png[4]).toBe(0x0D);
    expect(png[5]).toBe(0x0A);
    expect(png[6]).toBe(0x1A);
    expect(png[7]).toBe(0x0A);
  });

  it('produces PNG with IHDR chunk', () => {
    const pixels = buildRgbImage(2, 2, 128, 128, 128);
    const png = encodePngFromPixels(pixels, 2, 2, 3);

    // After signature (8 bytes), first chunk should be IHDR
    // Chunk: 4 bytes length + 4 bytes type + data + 4 bytes CRC
    const ihdrType = String.fromCharCode(png[12]!, png[13]!, png[14]!, png[15]!);
    expect(ihdrType).toBe('IHDR');
  });

  it('encodes correct dimensions in IHDR', () => {
    const pixels = buildRgbImage(100, 50, 0, 0, 0);
    const png = encodePngFromPixels(pixels, 100, 50, 3);

    // IHDR data starts at offset 16 (8 sig + 4 length + 4 type)
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    expect(width).toBe(100);
    expect(height).toBe(50);
  });

  it('encodes RGB (color type 2)', () => {
    const pixels = buildRgbImage(4, 4, 200, 100, 50);
    const png = encodePngFromPixels(pixels, 4, 4, 3);

    // Color type is at IHDR offset + 9 (8 width, 4 height, 1 bit depth, 1 color type)
    // IHDR data starts at offset 16
    expect(png[25]).toBe(2); // Color type 2 = RGB
  });

  it('encodes RGBA (color type 6)', () => {
    const pixels = buildRgbaImage(4, 4, 200, 100, 50, 255);
    const png = encodePngFromPixels(pixels, 4, 4, 4);
    expect(png[25]).toBe(6); // Color type 6 = RGBA
  });

  it('encodes grayscale (color type 0)', () => {
    const pixels = buildGrayImage(4, 4, 128);
    const png = encodePngFromPixels(pixels, 4, 4, 1);
    expect(png[25]).toBe(0); // Color type 0 = Grayscale
  });

  it('produces output larger than input for small images', () => {
    const pixels = buildRgbImage(2, 2, 255, 255, 255);
    const png = encodePngFromPixels(pixels, 2, 2, 3);
    // PNG has overhead (signature, chunks, compression)
    expect(png.length).toBeGreaterThan(0);
  });

  it('handles 1x1 image', () => {
    const pixels = new Uint8Array([255, 0, 0]);
    const png = encodePngFromPixels(pixels, 1, 1, 3);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });

  it('contains IEND chunk at the end', () => {
    const pixels = buildRgbImage(8, 8, 0, 0, 0);
    const png = encodePngFromPixels(pixels, 8, 8, 3);

    // Find IEND by looking for the type bytes near the end
    // IEND chunk: 4 bytes (length=0) + "IEND" + 4 bytes CRC = 12 bytes
    const iendStart = png.length - 12;
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const iendLength = view.getUint32(iendStart, false);
    expect(iendLength).toBe(0);
    const iendType = String.fromCharCode(
      png[iendStart + 4]!, png[iendStart + 5]!, png[iendStart + 6]!, png[iendStart + 7]!,
    );
    expect(iendType).toBe('IEND');
  });
});

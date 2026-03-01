/**
 * Tests for grayscale detection and conversion.
 *
 * Covers isGrayscaleImage() and convertToGrayscale() from
 * the grayscaleDetect module.
 */

import { describe, it, expect } from 'vitest';
import {
  isGrayscaleImage,
  convertToGrayscale,
} from '../../../../src/assets/image/grayscaleDetect.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat RGB pixel buffer where all pixels are the same gray. */
function buildGrayRgbImage(
  width: number,
  height: number,
  grayValue: number,
): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = grayValue;
    pixels[i * 3 + 1] = grayValue;
    pixels[i * 3 + 2] = grayValue;
  }
  return pixels;
}

/** Build a flat RGBA pixel buffer where all pixels are the same gray. */
function buildGrayRgbaImage(
  width: number,
  height: number,
  grayValue: number,
  alpha: number = 255,
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = grayValue;
    pixels[i * 4 + 1] = grayValue;
    pixels[i * 4 + 2] = grayValue;
    pixels[i * 4 + 3] = alpha;
  }
  return pixels;
}

/** Build a colorful RGB image (not grayscale). */
function buildColorRgbImage(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = 255;     // R
    pixels[i * 3 + 1] = 0;   // G
    pixels[i * 3 + 2] = 0;   // B
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// isGrayscaleImage
// ---------------------------------------------------------------------------

describe('isGrayscaleImage', () => {
  it('detects uniform gray RGB image', () => {
    const pixels = buildGrayRgbImage(10, 10, 128);
    expect(isGrayscaleImage(pixels, 10, 10, 3)).toBe(true);
  });

  it('detects uniform gray RGBA image', () => {
    const pixels = buildGrayRgbaImage(10, 10, 200);
    expect(isGrayscaleImage(pixels, 10, 10, 4)).toBe(true);
  });

  it('detects black image as grayscale', () => {
    const pixels = buildGrayRgbImage(4, 4, 0);
    expect(isGrayscaleImage(pixels, 4, 4, 3)).toBe(true);
  });

  it('detects white image as grayscale', () => {
    const pixels = buildGrayRgbImage(4, 4, 255);
    expect(isGrayscaleImage(pixels, 4, 4, 3)).toBe(true);
  });

  it('rejects fully colored RGB image', () => {
    const pixels = buildColorRgbImage(10, 10);
    expect(isGrayscaleImage(pixels, 10, 10, 3)).toBe(false);
  });

  it('tolerates near-gray pixels within default tolerance (2)', () => {
    const pixels = new Uint8Array(4 * 4 * 3);
    for (let i = 0; i < 16; i++) {
      pixels[i * 3] = 128;
      pixels[i * 3 + 1] = 129;   // within tolerance of 2
      pixels[i * 3 + 2] = 127;   // within tolerance of 2
    }
    expect(isGrayscaleImage(pixels, 4, 4, 3)).toBe(true);
  });

  it('rejects near-gray pixels outside tolerance', () => {
    const pixels = new Uint8Array(4 * 4 * 3);
    for (let i = 0; i < 16; i++) {
      pixels[i * 3] = 128;
      pixels[i * 3 + 1] = 135;   // difference of 7
      pixels[i * 3 + 2] = 128;
    }
    expect(isGrayscaleImage(pixels, 4, 4, 3)).toBe(false);
  });

  it('allows custom tolerance', () => {
    const pixels = new Uint8Array(4 * 4 * 3);
    for (let i = 0; i < 16; i++) {
      pixels[i * 3] = 100;
      pixels[i * 3 + 1] = 105;
      pixels[i * 3 + 2] = 100;
    }
    // Default tolerance of 2 should reject
    expect(isGrayscaleImage(pixels, 4, 4, 3, 2)).toBe(false);
    // Tolerance of 10 should accept
    expect(isGrayscaleImage(pixels, 4, 4, 3, 10)).toBe(true);
  });

  it('allows up to 1% non-gray pixels', () => {
    const w = 100;
    const h = 100;
    const pixels = buildGrayRgbImage(w, h, 128);

    // Set exactly 1 pixel (1% of 100) to full red — should still pass
    pixels[0] = 255;
    pixels[1] = 0;
    pixels[2] = 0;

    expect(isGrayscaleImage(pixels, w, h, 3)).toBe(true);
  });

  it('rejects when >1% of pixels are colored', () => {
    const w = 10;
    const h = 10;
    const pixels = buildGrayRgbImage(w, h, 128);

    // Set 2 pixels (2% of 100) to red
    pixels[0] = 255;
    pixels[1] = 0;
    pixels[2] = 0;
    pixels[3] = 255;
    pixels[4] = 0;
    pixels[5] = 0;

    expect(isGrayscaleImage(pixels, w, h, 3)).toBe(false);
  });

  it('handles 1x1 image', () => {
    const gray = new Uint8Array([50, 50, 50]);
    expect(isGrayscaleImage(gray, 1, 1, 3)).toBe(true);

    const color = new Uint8Array([255, 0, 0]);
    // 1 pixel image: 1% of 1 = 0.01, max non-gray = floor(0.01) = 0
    // so 1 non-gray pixel exceeds the threshold
    expect(isGrayscaleImage(color, 1, 1, 3)).toBe(false);
  });

  it('handles varying gray levels (gradient)', () => {
    const w = 16;
    const h = 16;
    const pixels = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      const v = i % 256;
      pixels[i * 3] = v;
      pixels[i * 3 + 1] = v;
      pixels[i * 3 + 2] = v;
    }
    expect(isGrayscaleImage(pixels, w, h, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// convertToGrayscale
// ---------------------------------------------------------------------------

describe('convertToGrayscale', () => {
  it('converts pure white RGB to 255 gray', () => {
    const pixels = buildGrayRgbImage(2, 2, 255);
    const gray = convertToGrayscale(pixels, 2, 2, 3);
    expect(gray.length).toBe(4); // 2x2 = 4 pixels, 1 byte each
    for (const v of gray) {
      expect(v).toBe(255);
    }
  });

  it('converts pure black RGB to 0 gray', () => {
    const pixels = buildGrayRgbImage(2, 2, 0);
    const gray = convertToGrayscale(pixels, 2, 2, 3);
    expect(gray.length).toBe(4);
    for (const v of gray) {
      expect(v).toBe(0);
    }
  });

  it('uses BT.601 luma formula', () => {
    // Pure red: gray = 0.299 * 255 + 0.587 * 0 + 0.114 * 0 ≈ 76
    const red = new Uint8Array([255, 0, 0]);
    const grayFromRed = convertToGrayscale(red, 1, 1, 3);
    expect(grayFromRed[0]).toBe(Math.round(0.299 * 255));

    // Pure green: gray = 0.299 * 0 + 0.587 * 255 + 0.114 * 0 ≈ 150
    const green = new Uint8Array([0, 255, 0]);
    const grayFromGreen = convertToGrayscale(green, 1, 1, 3);
    expect(grayFromGreen[0]).toBe(Math.round(0.587 * 255));

    // Pure blue: gray = 0.299 * 0 + 0.587 * 0 + 0.114 * 255 ≈ 29
    const blue = new Uint8Array([0, 0, 255]);
    const grayFromBlue = convertToGrayscale(blue, 1, 1, 3);
    expect(grayFromBlue[0]).toBe(Math.round(0.114 * 255));
  });

  it('converts RGBA image (discards alpha)', () => {
    const pixels = buildGrayRgbaImage(3, 3, 100, 128);
    const gray = convertToGrayscale(pixels, 3, 3, 4);
    expect(gray.length).toBe(9); // 3x3 = 9 pixels
    for (const v of gray) {
      expect(v).toBe(100); // R=G=B=100, so gray = 100
    }
  });

  it('output length is width * height', () => {
    const w = 20;
    const h = 15;
    const pixels = buildGrayRgbImage(w, h, 128);
    const gray = convertToGrayscale(pixels, w, h, 3);
    expect(gray.length).toBe(w * h);
  });
});

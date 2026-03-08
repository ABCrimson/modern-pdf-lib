/**
 * Tests for TIFF CMYK color space handling.
 *
 * Covers convertTiffCmykToRgb(), embedTiffCmyk(), and isCmykTiff()
 * from the tiffCmyk module.
 */

import { describe, it, expect } from 'vitest';
import {
  convertTiffCmykToRgb,
  embedTiffCmyk,
  isCmykTiff,
} from '../../../../src/assets/image/tiffCmyk.js';

// ---------------------------------------------------------------------------
// convertTiffCmykToRgb
// ---------------------------------------------------------------------------

describe('convertTiffCmykToRgb', () => {
  it('converts pure black (K=255) to RGB(0,0,0)', () => {
    // C=0, M=0, Y=0, K=255 → R = 255*(1-0)*(1-1) = 0
    const cmyk = new Uint8Array([0, 0, 0, 255]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    expect(rgb.length).toBe(3);
    expect(rgb[0]).toBe(0);
    expect(rgb[1]).toBe(0);
    expect(rgb[2]).toBe(0);
  });

  it('converts pure white (all zeros) to RGB(255,255,255)', () => {
    // C=0, M=0, Y=0, K=0 → R = 255*(1)*(1) = 255
    const cmyk = new Uint8Array([0, 0, 0, 0]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    expect(rgb.length).toBe(3);
    expect(rgb[0]).toBe(255);
    expect(rgb[1]).toBe(255);
    expect(rgb[2]).toBe(255);
  });

  it('converts pure cyan to RGB(0,255,255)', () => {
    // C=255, M=0, Y=0, K=0 → R = 255*(1-1)*(1) = 0, G = 255, B = 255
    const cmyk = new Uint8Array([255, 0, 0, 0]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    expect(rgb[0]).toBe(0);
    expect(rgb[1]).toBe(255);
    expect(rgb[2]).toBe(255);
  });

  it('converts pure magenta to RGB(255,0,255)', () => {
    // C=0, M=255, Y=0, K=0 → R = 255, G = 0, B = 255
    const cmyk = new Uint8Array([0, 255, 0, 0]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    expect(rgb[0]).toBe(255);
    expect(rgb[1]).toBe(0);
    expect(rgb[2]).toBe(255);
  });

  it('converts pure yellow to RGB(255,255,0)', () => {
    // C=0, M=0, Y=255, K=0 → R = 255, G = 255, B = 0
    const cmyk = new Uint8Array([0, 0, 255, 0]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    expect(rgb[0]).toBe(255);
    expect(rgb[1]).toBe(255);
    expect(rgb[2]).toBe(0);
  });

  it('handles mid-gray (K=128)', () => {
    // C=0, M=0, Y=0, K=128 → R = G = B ≈ 255 * (1 - 128/255) ≈ 127
    const cmyk = new Uint8Array([0, 0, 0, 128]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);
    const expected = Math.round(255 * (1 - 128 / 255));
    expect(rgb[0]).toBe(expected);
    expect(rgb[1]).toBe(expected);
    expect(rgb[2]).toBe(expected);
  });

  it('converts a 2x2 image correctly', () => {
    const cmyk = new Uint8Array([
      // Pixel 0: pure white
      0, 0, 0, 0,
      // Pixel 1: pure black
      0, 0, 0, 255,
      // Pixel 2: pure cyan
      255, 0, 0, 0,
      // Pixel 3: pure magenta
      0, 255, 0, 0,
    ]);
    const rgb = convertTiffCmykToRgb(cmyk, 2, 2);
    expect(rgb.length).toBe(12); // 4 pixels * 3 channels

    // White
    expect(rgb[0]).toBe(255);
    expect(rgb[1]).toBe(255);
    expect(rgb[2]).toBe(255);

    // Black
    expect(rgb[3]).toBe(0);
    expect(rgb[4]).toBe(0);
    expect(rgb[5]).toBe(0);

    // Cyan
    expect(rgb[6]).toBe(0);
    expect(rgb[7]).toBe(255);
    expect(rgb[8]).toBe(255);

    // Magenta
    expect(rgb[9]).toBe(255);
    expect(rgb[10]).toBe(0);
    expect(rgb[11]).toBe(255);
  });

  it('throws on length mismatch', () => {
    const cmyk = new Uint8Array([0, 0, 0, 0, 255]); // 5 bytes, not 4
    expect(() => convertTiffCmykToRgb(cmyk, 1, 1)).toThrow('length mismatch');
  });

  it('throws when dimensions do not match data', () => {
    const cmyk = new Uint8Array(4 * 4); // 4 pixels worth
    expect(() => convertTiffCmykToRgb(cmyk, 3, 3)).toThrow('length mismatch');
  });

  it('handles partial ink coverage', () => {
    // C=100, M=50, Y=25, K=10
    const c = 100, m = 50, y = 25, k = 10;
    const cmyk = new Uint8Array([c, m, y, k]);
    const rgb = convertTiffCmykToRgb(cmyk, 1, 1);

    const oneMinusK = 1 - k / 255;
    expect(rgb[0]).toBe(Math.round(255 * (1 - c / 255) * oneMinusK));
    expect(rgb[1]).toBe(Math.round(255 * (1 - m / 255) * oneMinusK));
    expect(rgb[2]).toBe(Math.round(255 * (1 - y / 255) * oneMinusK));
  });
});

// ---------------------------------------------------------------------------
// embedTiffCmyk
// ---------------------------------------------------------------------------

describe('embedTiffCmyk', () => {
  it('returns DeviceCMYK color space', () => {
    const pixels = new Uint8Array(4); // 1x1 CMYK
    const result = embedTiffCmyk(pixels, 1, 1);
    expect(result.colorSpace).toBe('DeviceCMYK');
  });

  it('returns 8 bits per component', () => {
    const pixels = new Uint8Array(4);
    const result = embedTiffCmyk(pixels, 1, 1);
    expect(result.bitsPerComponent).toBe(8);
  });

  it('returns the original pixel data', () => {
    const pixels = new Uint8Array([10, 20, 30, 40]);
    const result = embedTiffCmyk(pixels, 1, 1);
    expect(result.data).toBe(pixels);
  });

  it('handles a 3x3 image', () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const result = embedTiffCmyk(pixels, 3, 3);
    expect(result.data.length).toBe(36);
    expect(result.colorSpace).toBe('DeviceCMYK');
  });

  it('throws on length mismatch', () => {
    const pixels = new Uint8Array(10);
    expect(() => embedTiffCmyk(pixels, 2, 2)).toThrow('length mismatch');
  });
});

// ---------------------------------------------------------------------------
// isCmykTiff
// ---------------------------------------------------------------------------

describe('isCmykTiff', () => {
  it('returns true for PhotometricInterpretation=5 (CMYK)', () => {
    const entries = [
      { tag: 262, value: 5 }, // PhotometricInterpretation = Separated
    ];
    expect(isCmykTiff(entries)).toBe(true);
  });

  it('returns true for PhotometricInterpretation=5 with InkSet=1', () => {
    const entries = [
      { tag: 262, value: 5 },
      { tag: 332, value: 1 }, // InkSet = CMYK
    ];
    expect(isCmykTiff(entries)).toBe(true);
  });

  it('returns false for PhotometricInterpretation=5 with InkSet=2 (not CMYK)', () => {
    const entries = [
      { tag: 262, value: 5 },
      { tag: 332, value: 2 }, // InkSet = not CMYK
    ];
    expect(isCmykTiff(entries)).toBe(false);
  });

  it('returns false for PhotometricInterpretation=2 (RGB)', () => {
    const entries = [
      { tag: 262, value: 2 },
    ];
    expect(isCmykTiff(entries)).toBe(false);
  });

  it('returns false for PhotometricInterpretation=1 (BlackIsZero)', () => {
    const entries = [
      { tag: 262, value: 1 },
    ];
    expect(isCmykTiff(entries)).toBe(false);
  });

  it('returns false for PhotometricInterpretation=0 (WhiteIsZero)', () => {
    const entries = [
      { tag: 262, value: 0 },
    ];
    expect(isCmykTiff(entries)).toBe(false);
  });

  it('returns false for empty entries', () => {
    expect(isCmykTiff([])).toBe(false);
  });

  it('returns false when PhotometricInterpretation is missing', () => {
    const entries = [
      { tag: 332, value: 1 }, // Only InkSet present
    ];
    expect(isCmykTiff(entries)).toBe(false);
  });

  it('handles entries with other tags mixed in', () => {
    const entries = [
      { tag: 256, value: 100 },   // ImageWidth
      { tag: 257, value: 200 },   // ImageLength
      { tag: 258, value: 8 },     // BitsPerSample
      { tag: 262, value: 5 },     // PhotometricInterpretation = Separated
      { tag: 277, value: 4 },     // SamplesPerPixel
      { tag: 332, value: 1 },     // InkSet = CMYK
    ];
    expect(isCmykTiff(entries)).toBe(true);
  });
});

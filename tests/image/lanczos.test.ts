/**
 * Tests for Lanczos3 as the default resampling algorithm.
 *
 * Covers:
 *  - Default algorithm is now Lanczos (output matches explicit algorithm: 'lanczos')
 *  - Lanczos preserves sharp edges better than bilinear on a checkerboard pattern
 *  - Single-pixel image does not crash
 *  - Image is not enlarged when target >= source dimensions
 *  - Non-integer scale ratios produce correct output dimensions
 *  - 1-channel (grayscale) images work correctly
 *  - 4-channel (RGBA) images work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  downscaleImage,
  type RawImageData,
} from '../../src/assets/image/imageOptimize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a solid-color RGB image of the given dimensions.
 */
function makeRgbImage(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): RawImageData {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  return { pixels, width, height, channels: 3, bitsPerChannel: 8 };
}

/**
 * Create a checkerboard pattern (alternating black and white pixels).
 * Useful for testing edge-preservation quality of resampling algorithms.
 */
function makeCheckerboard(
  width: number,
  height: number,
  channels: 1 | 3 | 4 = 3,
): RawImageData {
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isWhite = (x + y) % 2 === 0;
      const value = isWhite ? 255 : 0;
      const idx = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        // For RGBA, set alpha to 255 always
        if (channels === 4 && c === 3) {
          pixels[idx + c] = 255;
        } else {
          pixels[idx + c] = value;
        }
      }
    }
  }
  return { pixels, width, height, channels, bitsPerChannel: 8 };
}

/**
 * Create a grayscale image (1 channel) with a gradient.
 */
function makeGrayscaleGradient(
  width: number,
  height: number,
): RawImageData {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = Math.round((x / Math.max(1, width - 1)) * 255);
    }
  }
  return { pixels, width, height, channels: 1, bitsPerChannel: 8 };
}

/**
 * Create an RGBA image with a gradient and varying alpha.
 */
function makeRgbaGradient(
  width: number,
  height: number,
): RawImageData {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      pixels[idx] = Math.round((x / Math.max(1, width - 1)) * 255);     // R
      pixels[idx + 1] = Math.round((y / Math.max(1, height - 1)) * 255); // G
      pixels[idx + 2] = 128;                                              // B
      pixels[idx + 3] = 255;                                              // A
    }
  }
  return { pixels, width, height, channels: 4, bitsPerChannel: 8 };
}

/**
 * Compute the mean squared error between two pixel arrays.
 */
function computeMse(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error(`Array length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return sum / a.length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lanczos3 default resampling', () => {
  it('default algorithm produces the same output as explicit algorithm: lanczos', () => {
    const src = makeCheckerboard(100, 100, 3);

    // Downscale with default (should be lanczos now)
    const defaultResult = downscaleImage(src, { maxWidth: 50, maxHeight: 50 });

    // Downscale with explicit lanczos
    const lanczosResult = downscaleImage(src, {
      maxWidth: 50,
      maxHeight: 50,
      algorithm: 'lanczos',
    });

    expect(defaultResult.width).toBe(lanczosResult.width);
    expect(defaultResult.height).toBe(lanczosResult.height);
    expect(defaultResult.channels).toBe(lanczosResult.channels);
    expect(defaultResult.pixels).toEqual(lanczosResult.pixels);
  });

  it('default algorithm differs from explicit bilinear', () => {
    const src = makeCheckerboard(100, 100, 3);

    const defaultResult = downscaleImage(src, { maxWidth: 50, maxHeight: 50 });
    const bilinearResult = downscaleImage(src, {
      maxWidth: 50,
      maxHeight: 50,
      algorithm: 'bilinear',
    });

    // They should have the same dimensions
    expect(defaultResult.width).toBe(bilinearResult.width);
    expect(defaultResult.height).toBe(bilinearResult.height);

    // But the pixel data should differ (Lanczos vs bilinear produce different results)
    expect(defaultResult.pixels).not.toEqual(bilinearResult.pixels);
  });
});

describe('Lanczos3 edge preservation quality', () => {
  it('preserves sharp edges better than bilinear on a step-edge pattern', () => {
    // Create an image with a sharp vertical step edge in the center:
    // left half = black (0), right half = white (255).
    // After downscaling, Lanczos should produce a steeper transition
    // at the edge (fewer intermediate gray pixels) than bilinear.
    const width = 200;
    const height = 100;
    const channels = 1; // Grayscale for simplicity
    const pixels = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels[y * width + x] = x < width / 2 ? 0 : 255;
      }
    }

    const src: RawImageData = {
      pixels,
      width,
      height,
      channels,
      bitsPerChannel: 8,
    };

    // Use a non-integer ratio so the edge doesn't land on exact pixel
    // boundaries — this is where the difference between algorithms
    // becomes apparent.
    const targetW = 73;
    const targetH = 37;

    const bilinearResult = downscaleImage(src, {
      maxWidth: targetW,
      maxHeight: targetH,
      algorithm: 'bilinear',
    });

    const lanczosResult = downscaleImage(src, {
      maxWidth: targetW,
      maxHeight: targetH,
      algorithm: 'lanczos',
    });

    // Measure the transition width: count how many pixels in a
    // horizontal scanline near the edge are "intermediate" (not
    // close to 0 or 255). Lanczos should have fewer transition pixels.
    function countTransitionPixels(img: RawImageData, row: number): number {
      let count = 0;
      for (let x = 0; x < img.width; x++) {
        const v = img.pixels[row * img.width + x]!;
        // Count pixels that are clearly in the transition zone
        if (v > 20 && v < 235) {
          count++;
        }
      }
      return count;
    }

    // Check multiple rows and average
    let bilinearTransition = 0;
    let lanczosTransition = 0;
    const rowCount = Math.min(bilinearResult.height, lanczosResult.height);
    for (let row = 0; row < rowCount; row++) {
      bilinearTransition += countTransitionPixels(bilinearResult, row);
      lanczosTransition += countTransitionPixels(lanczosResult, row);
    }

    // Lanczos should have fewer (or equal) transition pixels,
    // meaning the edge transition is steeper.
    expect(lanczosTransition).toBeLessThanOrEqual(bilinearTransition);
  });
});

describe('Lanczos3 edge cases', () => {
  it('single-pixel image does not crash', () => {
    const src: RawImageData = {
      pixels: new Uint8Array([255, 0, 0]),
      width: 1,
      height: 1,
      channels: 3,
      bitsPerChannel: 8,
    };

    // Downscaling a 1x1 image should return the original unchanged
    // (target is already >= source)
    const result = downscaleImage(src, { maxWidth: 1, maxHeight: 1 });
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.pixels).toEqual(src.pixels);
  });

  it('single-pixel image with lanczos algorithm does not crash', () => {
    // Edge case: forcing a 2x2 -> 1x1 downscale with lanczos
    const src: RawImageData = {
      pixels: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 128]),
      width: 2,
      height: 2,
      channels: 3,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(src, {
      maxWidth: 1,
      maxHeight: 1,
      algorithm: 'lanczos',
    });
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.channels).toBe(3);
    expect(result.pixels.length).toBe(3);
  });

  it('image is not enlarged when target >= source dimensions', () => {
    const src = makeRgbImage(50, 50, 128, 64, 32);

    // Target is larger than source — should return original unchanged
    const result = downscaleImage(src, { maxWidth: 100, maxHeight: 100 });
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.pixels).toBe(src.pixels); // Same reference, not a copy
  });

  it('image is not enlarged when target equals source dimensions', () => {
    const src = makeRgbImage(50, 50, 128, 64, 32);

    const result = downscaleImage(src, { maxWidth: 50, maxHeight: 50 });
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.pixels).toBe(src.pixels);
  });

  it('non-integer scale ratio (100x100 -> 33x33) produces correct dimensions', () => {
    const src = makeRgbImage(100, 100, 200, 100, 50);

    const result = downscaleImage(src, { maxWidth: 33, maxHeight: 33 });
    expect(result.width).toBe(33);
    expect(result.height).toBe(33);
    expect(result.channels).toBe(3);
    expect(result.pixels.length).toBe(33 * 33 * 3);
  });

  it('non-integer scale ratio (100x80 -> 37x30) preserves aspect ratio', () => {
    const src = makeRgbImage(100, 80, 200, 100, 50);

    // maxWidth=37 constrains first: scale = 37/100 = 0.37, height = round(80*0.37) = 30
    const result = downscaleImage(src, { maxWidth: 37 });
    expect(result.width).toBe(37);
    expect(result.height).toBe(30);
    expect(result.pixels.length).toBe(37 * 30 * 3);
  });

  it('asymmetric constraint (only maxWidth) downscales proportionally', () => {
    const src = makeRgbImage(200, 100, 0, 0, 0);

    const result = downscaleImage(src, { maxWidth: 100 });
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it('asymmetric constraint (only maxHeight) downscales proportionally', () => {
    const src = makeRgbImage(200, 100, 0, 0, 0);

    const result = downscaleImage(src, { maxHeight: 50 });
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });
});

describe('Lanczos3 multi-channel support', () => {
  it('1-channel (grayscale) image downscales correctly', () => {
    const src = makeGrayscaleGradient(100, 100);

    const result = downscaleImage(src, {
      maxWidth: 50,
      maxHeight: 50,
      algorithm: 'lanczos',
    });

    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.channels).toBe(1);
    expect(result.pixels.length).toBe(50 * 50);

    // Verify pixel values are in valid range [0, 255]
    for (let i = 0; i < result.pixels.length; i++) {
      expect(result.pixels[i]).toBeGreaterThanOrEqual(0);
      expect(result.pixels[i]).toBeLessThanOrEqual(255);
    }

    // Verify the gradient is roughly preserved (left side darker than right)
    const leftAvg =
      (result.pixels[0]! + result.pixels[50]! + result.pixels[100]!) / 3;
    const rightAvg =
      (result.pixels[49]! + result.pixels[99]! + result.pixels[149]!) / 3;
    expect(rightAvg).toBeGreaterThan(leftAvg);
  });

  it('4-channel (RGBA) image downscales correctly', () => {
    const src = makeRgbaGradient(100, 100);

    const result = downscaleImage(src, {
      maxWidth: 50,
      maxHeight: 50,
      algorithm: 'lanczos',
    });

    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.channels).toBe(4);
    expect(result.pixels.length).toBe(50 * 50 * 4);

    // Verify pixel values are in valid range [0, 255]
    for (let i = 0; i < result.pixels.length; i++) {
      expect(result.pixels[i]).toBeGreaterThanOrEqual(0);
      expect(result.pixels[i]).toBeLessThanOrEqual(255);
    }

    // Verify alpha channel is preserved (all 255 in source)
    for (let i = 0; i < 50 * 50; i++) {
      const alpha = result.pixels[i * 4 + 3]!;
      // Alpha should be close to 255 (may have minor rounding artifacts)
      expect(alpha).toBeGreaterThanOrEqual(250);
    }
  });

  it('1-channel and 3-channel downscale outputs have consistent quality', () => {
    // Create matching grayscale and RGB gradients
    const grayImg = makeGrayscaleGradient(80, 80);
    const rgbImg: RawImageData = {
      pixels: (() => {
        const px = new Uint8Array(80 * 80 * 3);
        for (let i = 0; i < 80 * 80; i++) {
          const v = grayImg.pixels[i]!;
          px[i * 3] = v;
          px[i * 3 + 1] = v;
          px[i * 3 + 2] = v;
        }
        return px;
      })(),
      width: 80,
      height: 80,
      channels: 3,
      bitsPerChannel: 8,
    };

    const grayResult = downscaleImage(grayImg, {
      maxWidth: 40,
      maxHeight: 40,
      algorithm: 'lanczos',
    });
    const rgbResult = downscaleImage(rgbImg, {
      maxWidth: 40,
      maxHeight: 40,
      algorithm: 'lanczos',
    });

    // The R channel of the RGB result should match the grayscale result
    const grayPixels = grayResult.pixels;
    const rgbRedChannel = new Uint8Array(40 * 40);
    for (let i = 0; i < 40 * 40; i++) {
      rgbRedChannel[i] = rgbResult.pixels[i * 3]!;
    }

    // They should be identical because the input data is the same
    expect(rgbRedChannel).toEqual(grayPixels);
  });
});

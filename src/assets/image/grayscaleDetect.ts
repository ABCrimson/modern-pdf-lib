/**
 * @module assets/image/grayscaleDetect
 *
 * Grayscale detection and conversion for image optimization.
 *
 * Detects RGB images where all pixels are effectively grayscale
 * (R ≈ G ≈ B) and converts them to single-channel grayscale,
 * reducing data size by ~66%.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an RGB/RGBA image is effectively grayscale.
 *
 * Scans all pixels and checks if R, G, and B channels are within
 * `tolerance` of each other. If ≥99% of pixels pass, the image
 * is considered grayscale.
 *
 * @param pixels    - Raw pixel data (row-major, channel-interleaved).
 * @param width     - Image width in pixels.
 * @param height    - Image height in pixels.
 * @param channels  - Number of channels: 3 (RGB) or 4 (RGBA).
 * @param tolerance - Maximum allowed difference between R, G, and B
 *                    values for a pixel to be considered gray.
 *                    Default: `2`.
 * @returns `true` if the image is effectively grayscale.
 *
 * @example
 * ```ts
 * import { isGrayscaleImage, convertToGrayscale } from 'modern-pdf-lib';
 *
 * if (isGrayscaleImage(pixels, width, height, 3)) {
 *   const grayPixels = convertToGrayscale(pixels, width, height, 3);
 *   // grayPixels has 1 byte per pixel instead of 3
 * }
 * ```
 */
export function isGrayscaleImage(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  tolerance: number = 2,
): boolean {
  const pixelCount = width * height;

  // Require at least 99% of pixels to be gray
  const maxNonGray = Math.floor(pixelCount * 0.01);
  let nonGrayCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = pixels[i * channels]!;
    const g = pixels[i * channels + 1]!;
    const b = pixels[i * channels + 2]!;

    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);

    if (maxVal - minVal > tolerance) {
      nonGrayCount++;
      if (nonGrayCount > maxNonGray) return false;
    }
  }

  return true;
}

/**
 * Convert an RGB/RGBA image to single-channel grayscale.
 *
 * Uses the ITU-R BT.601 luma formula:
 * ```
 * gray = 0.299 × R + 0.587 × G + 0.114 × B
 * ```
 *
 * The alpha channel (if present) is discarded.
 *
 * @param pixels   - Raw pixel data (row-major, channel-interleaved).
 * @param width    - Image width in pixels.
 * @param height   - Image height in pixels.
 * @param channels - Number of channels: 3 (RGB) or 4 (RGBA).
 * @returns Grayscale pixel data (1 byte per pixel).
 */
export function convertToGrayscale(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
): Uint8Array {
  const pixelCount = width * height;
  const gray = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = pixels[i * channels]!;
    const g = pixels[i * channels + 1]!;
    const b = pixels[i * channels + 2]!;

    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  return gray;
}

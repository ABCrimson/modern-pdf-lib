/**
 * @module assets/image/dpiAnalyze
 *
 * DPI analysis for PDF image XObjects.
 *
 * Computes the effective DPI of an image based on its pixel dimensions
 * and its display size in the PDF (determined by the content stream's
 * current transformation matrix).
 *
 * No Buffer — uses Uint8Array exclusively.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * DPI information for an image.
 */
export interface ImageDpi {
  /** Horizontal DPI. */
  readonly xDpi: number;
  /** Vertical DPI. */
  readonly yDpi: number;
  /** Effective DPI (minimum of xDpi and yDpi). */
  readonly effectiveDpi: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the effective DPI of an image given its pixel dimensions
 * and display dimensions in points.
 *
 * PDF uses 72 points per inch, so:
 * ```
 * DPI = imagePixels / (displayPoints / 72)
 * ```
 *
 * @param imageWidth    - Image width in pixels.
 * @param imageHeight   - Image height in pixels.
 * @param displayWidth  - Display width in PDF points (1/72 inch).
 * @param displayHeight - Display height in PDF points (1/72 inch).
 * @returns DPI information.
 *
 * @example
 * ```ts
 * import { computeImageDpi } from 'modern-pdf-lib';
 *
 * // A 3000×2000 image displayed at 4.17×2.78 inches (300×200 points)
 * const dpi = computeImageDpi(3000, 2000, 300, 200);
 * console.log(dpi.effectiveDpi); // 720
 * ```
 */
export function computeImageDpi(
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
  displayHeight: number,
): ImageDpi {
  // Prevent division by zero
  const xDpi = displayWidth > 0
    ? (imageWidth / displayWidth) * 72
    : Infinity;
  const yDpi = displayHeight > 0
    ? (imageHeight / displayHeight) * 72
    : Infinity;

  return {
    xDpi,
    yDpi,
    effectiveDpi: Math.min(xDpi, yDpi),
  };
}

/**
 * Compute the target pixel dimensions for downscaling an image
 * to a maximum DPI at a given display size.
 *
 * @param imageWidth    - Current image width in pixels.
 * @param imageHeight   - Current image height in pixels.
 * @param displayWidth  - Display width in PDF points.
 * @param displayHeight - Display height in PDF points.
 * @param maxDpi        - Maximum allowed DPI.
 * @returns Target dimensions, or the original dimensions if no
 *          downscaling is needed.
 */
export function computeTargetDimensions(
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
  displayHeight: number,
  maxDpi: number,
): { width: number; height: number; downscaled: boolean } {
  const dpi = computeImageDpi(
    imageWidth,
    imageHeight,
    displayWidth,
    displayHeight,
  );

  if (dpi.effectiveDpi <= maxDpi || !Number.isFinite(dpi.effectiveDpi)) {
    return { width: imageWidth, height: imageHeight, downscaled: false };
  }

  // Scale down proportionally to target DPI
  const scale = maxDpi / dpi.effectiveDpi;
  const targetWidth = Math.max(1, Math.round(imageWidth * scale));
  const targetHeight = Math.max(1, Math.round(imageHeight * scale));

  return { width: targetWidth, height: targetHeight, downscaled: true };
}

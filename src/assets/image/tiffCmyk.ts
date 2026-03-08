/**
 * @module assets/image/tiffCmyk
 *
 * TIFF CMYK color space handling for PDF embedding.
 *
 * Provides:
 * - CMYK-to-RGB conversion for display/rendering
 * - Native CMYK embedding in PDF (no conversion needed)
 * - CMYK TIFF detection via IFD tag inspection
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * An IFD entry from a TIFF file, containing a tag number and its value.
 */
export interface TiffIfdEntry {
  /** The TIFF tag number (e.g. 262 for PhotometricInterpretation). */
  readonly tag: number;
  /** The resolved integer value of the tag. */
  readonly value: number;
}

/**
 * Result of embedding CMYK TIFF data for use in a PDF image XObject.
 */
export interface TiffCmykEmbedResult {
  /** PDF color space — always `'DeviceCMYK'`. */
  readonly colorSpace: string;
  /** The raw CMYK pixel data (4 channels, 8 bits per component). */
  readonly data: Uint8Array;
  /** Bits per component — always `8`. */
  readonly bitsPerComponent: number;
}

// ---------------------------------------------------------------------------
// TIFF tag constants
// ---------------------------------------------------------------------------

/** Tag 262: PhotometricInterpretation. Value 5 = Separated (CMYK). */
const TAG_PHOTOMETRIC_INTERPRETATION = 262;

/** Tag 332: InkSet. Value 1 = CMYK inks. */
const TAG_INK_SET = 332;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert CMYK pixel data to RGB.
 *
 * Uses the standard CMYK-to-RGB formula:
 * ```
 * R = 255 * (1 - C/255) * (1 - K/255)
 * G = 255 * (1 - M/255) * (1 - K/255)
 * B = 255 * (1 - Y/255) * (1 - K/255)
 * ```
 *
 * @param cmykPixels  Flat array of CMYK pixel data (4 bytes per pixel: C, M, Y, K).
 * @param width       Image width in pixels.
 * @param height      Image height in pixels.
 * @returns           Flat array of RGB pixel data (3 bytes per pixel: R, G, B).
 * @throws            If the input array length does not match width * height * 4.
 */
export function convertTiffCmykToRgb(
  cmykPixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixelCount = width * height;
  const expectedLength = pixelCount * 4;

  if (cmykPixels.length !== expectedLength) {
    throw new Error(
      `CMYK pixel data length mismatch: expected ${expectedLength} bytes ` +
      `(${width}x${height}x4), got ${cmykPixels.length}`,
    );
  }

  const rgb = new Uint8Array(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;

    const c = cmykPixels[srcIdx]! / 255;
    const m = cmykPixels[srcIdx + 1]! / 255;
    const y = cmykPixels[srcIdx + 2]! / 255;
    const k = cmykPixels[srcIdx + 3]! / 255;

    const oneMinusK = 1 - k;

    rgb[dstIdx] = Math.round(255 * (1 - c) * oneMinusK);
    rgb[dstIdx + 1] = Math.round(255 * (1 - m) * oneMinusK);
    rgb[dstIdx + 2] = Math.round(255 * (1 - y) * oneMinusK);
  }

  return rgb;
}

/**
 * Prepare CMYK pixel data for native embedding in a PDF using /DeviceCMYK.
 *
 * PDF natively supports CMYK color spaces, so no RGB conversion is
 * needed — the raw CMYK data can be used directly as the image stream.
 *
 * @param pixels  Flat array of CMYK pixel data (4 bytes per pixel: C, M, Y, K).
 * @param width   Image width in pixels.
 * @param height  Image height in pixels.
 * @returns       Embedding result with colorSpace, data, and bitsPerComponent.
 * @throws        If the input array length does not match width * height * 4.
 */
export function embedTiffCmyk(
  pixels: Uint8Array,
  width: number,
  height: number,
): TiffCmykEmbedResult {
  const expectedLength = width * height * 4;

  if (pixels.length !== expectedLength) {
    throw new Error(
      `CMYK pixel data length mismatch: expected ${expectedLength} bytes ` +
      `(${width}x${height}x4), got ${pixels.length}`,
    );
  }

  return {
    colorSpace: 'DeviceCMYK',
    data: pixels,
    bitsPerComponent: 8,
  };
}

/**
 * Detect whether a TIFF image uses CMYK color space by inspecting IFD entries.
 *
 * A TIFF is considered CMYK when:
 * - PhotometricInterpretation (tag 262) has value 5 (Separated), AND
 * - If InkSet (tag 332) is present, its value must be 1 (CMYK inks)
 *
 * If InkSet is not present but PhotometricInterpretation is 5, the image
 * is assumed to be CMYK (per the TIFF specification default).
 *
 * @param ifdEntries  Array of IFD entries with tag and value fields.
 * @returns           `true` if the TIFF uses CMYK color space.
 */
export function isCmykTiff(ifdEntries: Array<{ tag: number; value: number }>): boolean {
  let photometricValue: number | undefined;
  let inkSetValue: number | undefined;

  for (const entry of ifdEntries) {
    if (entry.tag === TAG_PHOTOMETRIC_INTERPRETATION) {
      photometricValue = entry.value;
    }
    if (entry.tag === TAG_INK_SET) {
      inkSetValue = entry.value;
    }
  }

  // Must have PhotometricInterpretation = 5 (Separated)
  if (photometricValue !== 5) {
    return false;
  }

  // If InkSet is present, it must be 1 (CMYK)
  if (inkSetValue !== undefined && inkSetValue !== 1) {
    return false;
  }

  return true;
}

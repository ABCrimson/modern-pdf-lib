/**
 * @module assets/image/formatDetect
 *
 * Image format detection from magic bytes.
 *
 * Detects the following image formats by inspecting the file header:
 * - **PNG**: `89 50 4E 47` (first 4 bytes)
 * - **JPEG**: `FF D8 FF` (first 3 bytes)
 * - **WebP**: `52 49 46 46` (RIFF) at offset 0 + `57 45 42 50` (WEBP) at offset 8
 * - **TIFF LE**: `49 49 2A 00` (II\*\0) — little-endian byte order
 * - **TIFF BE**: `4D 4D 00 2A` (MM\0\*) — big-endian byte order
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Format type
// ---------------------------------------------------------------------------

/**
 * Supported image format identifiers.
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'unknown';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the image format from the raw file bytes by inspecting magic bytes.
 *
 * @param data  Raw image file bytes.
 * @returns     The detected format, or `'unknown'` if unrecognized.
 */
export function detectImageFormat(data: Uint8Array): ImageFormat {
  if (data.length < 4) {
    return 'unknown';
  }

  // PNG: 89 50 4E 47
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4E &&
    data[3] === 0x47
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (
    data[0] === 0xFF &&
    data[1] === 0xD8 &&
    data[2] === 0xFF
  ) {
    return 'jpeg';
  }

  // WebP: bytes 0-3 = RIFF (52 49 46 46), bytes 8-11 = WEBP (57 45 42 50)
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'webp';
  }

  // TIFF LE: 49 49 2A 00 (II*)
  if (
    data[0] === 0x49 &&
    data[1] === 0x49 &&
    data[2] === 0x2A &&
    data[3] === 0x00
  ) {
    return 'tiff';
  }

  // TIFF BE: 4D 4D 00 2A (MM*)
  if (
    data[0] === 0x4D &&
    data[1] === 0x4D &&
    data[2] === 0x00 &&
    data[3] === 0x2A
  ) {
    return 'tiff';
  }

  return 'unknown';
}

/**
 * Get a human-readable name for an image format identifier.
 *
 * @param format  The format identifier string.
 * @returns       A human-readable format name.
 */
export function getImageFormatName(format: string): string {
  switch (format) {
    case 'png':
      return 'PNG (Portable Network Graphics)';
    case 'jpeg':
      return 'JPEG (Joint Photographic Experts Group)';
    case 'webp':
      return 'WebP';
    case 'tiff':
      return 'TIFF (Tagged Image File Format)';
    case 'unknown':
      return 'Unknown';
    default:
      return `Unknown (${format})`;
  }
}

/**
 * Get the list of all supported image formats for embedding.
 *
 * @returns  An array of format identifier strings.
 */
export function getSupportedFormats(): string[] {
  return ['png', 'jpeg', 'webp', 'tiff'];
}

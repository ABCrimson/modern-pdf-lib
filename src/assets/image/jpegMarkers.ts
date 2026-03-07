/**
 * @module assets/image/jpegMarkers
 *
 * JPEG marker analysis for detecting arithmetic coding and other properties.
 *
 * Scans JPEG marker segments without decoding image data to determine
 * the coding method (Huffman vs arithmetic), progressive vs sequential
 * encoding, and basic frame parameters (width, height, components, bpc).
 *
 * This is useful for PDF batch optimization: arithmetic-coded JPEGs
 * (SOF9/SOF10/SOF11) cannot be decoded by most JPEG decoders and must
 * be skipped during recompression.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Result of JPEG marker analysis. */
export interface JpegMarkerInfo {
  /** Whether the JPEG uses arithmetic coding (SOF9, SOF10, or SOF11). */
  readonly isArithmeticCoded: boolean;
  /** Whether the JPEG uses progressive encoding (SOF2 or SOF10). */
  readonly isProgressive: boolean;
  /** The SOF marker type (e.g. 0xC0 for baseline, 0xC2 for progressive). */
  readonly sofType: number;
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Number of color components (1=gray, 3=YCbCr, 4=CMYK). */
  readonly components: number;
  /** Bits per component (typically 8, sometimes 12). */
  readonly bitsPerComponent: number;
}

// ---------------------------------------------------------------------------
// Marker constants
// ---------------------------------------------------------------------------

/**
 * SOF (Start of Frame) markers range from 0xC0 to 0xCF, excluding:
 * - 0xC4 (DHT — Define Huffman Table)
 * - 0xC8 (JPG — reserved extension)
 * - 0xCC (DAC — Define Arithmetic Coding conditioning)
 */
function isSofMarker(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

/** Arithmetic-coded SOF markers: SOF9, SOF10, SOF11. */
function isArithmeticSof(marker: number): boolean {
  return marker === 0xc9 || marker === 0xca || marker === 0xcb;
}

/** Progressive SOF markers: SOF2 (Huffman) and SOF10 (arithmetic). */
function isProgressiveSof(marker: number): boolean {
  return marker === 0xc2 || marker === 0xca;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse JPEG markers to detect arithmetic coding and other properties.
 * Scans marker segments without decoding image data.
 *
 * @param data - Raw JPEG bytes (must start with FF D8).
 * @returns Marker info, or `undefined` if not valid JPEG.
 *
 * @example
 * ```ts
 * import { analyzeJpegMarkers } from 'modern-pdf-lib';
 *
 * const info = analyzeJpegMarkers(jpegBytes);
 * if (info?.isArithmeticCoded) {
 *   console.log('Cannot re-encode: arithmetic-coded JPEG');
 * }
 * ```
 */
export function analyzeJpegMarkers(
  data: Uint8Array,
): JpegMarkerInfo | undefined {
  // Need at least SOI (2 bytes) + one marker (2 bytes)
  if (data.length < 4) return undefined;

  // Verify SOI marker (FF D8)
  if (data[0] !== 0xff || data[1] !== 0xd8) return undefined;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset < data.length - 1) {
    // Expect 0xFF prefix
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    // Skip padding 0xFF bytes
    while (offset < data.length && data[offset] === 0xff) {
      offset++;
    }

    if (offset >= data.length) break;

    const marker = data[offset]!;
    offset++;

    // Byte-stuffed 0x00 after 0xFF — not a marker
    if (marker === 0x00) continue;

    // SOI (0xD8) and EOI (0xD9) have no payload
    if (marker === 0xd8) continue;
    if (marker === 0xd9) break; // End of image

    // RST markers (0xD0–0xD7) have no length field
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    // All other markers have a 2-byte length field
    if (offset + 2 > data.length) break;

    const segmentLength = view.getUint16(offset, false);

    // SOF marker found — extract frame parameters
    if (isSofMarker(marker)) {
      // SOF segment: length(2) + bpc(1) + height(2) + width(2) + components(1) = 8 min
      if (segmentLength >= 8 && offset + segmentLength <= data.length) {
        const bitsPerComponent = data[offset + 2]!;
        const height = view.getUint16(offset + 3, false);
        const width = view.getUint16(offset + 5, false);
        const components = data[offset + 7]!;

        return {
          isArithmeticCoded: isArithmeticSof(marker),
          isProgressive: isProgressiveSof(marker),
          sofType: marker,
          width,
          height,
          components,
          bitsPerComponent,
        };
      }
    }

    // SOS (0xDA) — entropy-coded data follows, stop scanning
    if (marker === 0xda) break;

    // Advance past this marker segment
    offset += segmentLength;
  }

  // No SOF marker found
  return undefined;
}

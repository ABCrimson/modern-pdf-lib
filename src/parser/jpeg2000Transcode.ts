/**
 * @module parser/jpeg2000Transcode
 *
 * JPEG2000 to JPEG transcoding entry points.
 *
 * {@link transcodeJp2ToJpeg} rejects with {@link UnsupportedFilterError}:
 * the JavaScript JPEG 2000 decoder is not used in this release, so there
 * are no pixels to encode. {@link estimateTranscodedSize} reads only the
 * image header and still works.
 *
 * No Buffer — uses Uint8Array exclusively.
 *
 * @packageDocumentation
 */

import { UnsupportedFilterError } from '../errors.js';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for JPEG2000-to-JPEG transcoding.
 */
export interface TranscodeOptions {
  /**
   * JPEG quality (1-100).
   *
   * Higher values produce larger files with better quality.
   * Default: `85`.
   */
  readonly quality?: number;

  /**
   * Encode as progressive JPEG.
   *
   * Progressive JPEGs render in multiple passes and are often slightly
   * smaller than baseline JPEGs.  Requires the JPEG WASM module.
   *
   * Default: `false`.
   */
  readonly progressive?: boolean;

  /**
   * Chroma subsampling mode.
   *
   * - `'4:4:4'`: No subsampling — best color fidelity.
   * - `'4:2:2'`: Horizontal subsampling — good balance.
   * - `'4:2:0'`: Both directions — smallest file (default).
   */
  readonly chromaSubsampling?: '4:4:4' | '4:2:2' | '4:2:0';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transcode JPEG2000 data to JPEG format.
 *
 * Rejects with {@link UnsupportedFilterError} (filter `'JPXDecode'`): the
 * JavaScript JPEG 2000 decoder is not used in this release. Neither
 * argument is read.
 *
 * @param _jp2Data  - JPEG2000-encoded bytes (not read).
 * @param _options  - Transcoding options (not read).
 * @throws {UnsupportedFilterError} Always (as a rejection).
 */
export async function transcodeJp2ToJpeg(
  _jp2Data: Uint8Array,
  _options: TranscodeOptions = {},
): Promise<Uint8Array> {
  throw new UnsupportedFilterError('JPXDecode');
}

/**
 * Estimate the size of the JPEG output without performing a full decode.
 *
 * This provides a rough estimate based on the image dimensions (extracted
 * from the JP2 header or codestream SIZ marker) and the target quality.
 *
 * The estimate uses a simple heuristic:
 * - Base: width * height * channels * quality_factor
 * - Quality factor scales from ~0.05 (quality=1) to ~0.5 (quality=100)
 *
 * @param jp2Data  - JPEG2000-encoded bytes.
 * @param quality  - Target JPEG quality (1-100, default 85).
 * @returns Estimated JPEG file size in bytes.
 *
 * @example
 * ```ts
 * const estimatedSize = estimateTranscodedSize(jp2Bytes, 85);
 * console.log(`Estimated output: ${estimatedSize} bytes`);
 * ```
 */
export function estimateTranscodedSize(jp2Data: Uint8Array, quality: number = 85): number {
  const dims = extractDimensionsFromHeader(jp2Data);
  if (!dims) {
    // Can't determine dimensions — return a rough default
    return Math.round(jp2Data.length * 0.8);
  }

  const { width, height, components } = dims;
  const q = Math.max(1, Math.min(100, quality));

  // Heuristic: JPEG bytes per pixel scales roughly with quality
  // At quality 85, typical JPEG uses ~0.3-0.5 bytes per pixel per channel
  // At quality 1, it's much lower (~0.05)
  const qualityFactor = 0.05 + (q / 100) * 0.45;
  const effectiveComponents = Math.min(components, 3); // Strip alpha

  return Math.round(width * height * effectiveComponents * qualityFactor);
}

// ---------------------------------------------------------------------------
// Internal: dimension extraction
// ---------------------------------------------------------------------------

/**
 * Extract image dimensions from a JPEG2000 file without full decoding.
 *
 * For JP2 containers, reads the `ihdr` box.
 * For raw codestreams, reads the SIZ marker.
 *
 * @internal
 */
function extractDimensionsFromHeader(
  data: Uint8Array,
): { width: number; height: number; components: number } | null {
  // Check for JP2 container
  if (
    data.length >= 12 &&
    data[0] === 0x00 &&
    data[1] === 0x00 &&
    data[2] === 0x00 &&
    data[3] === 0x0c &&
    data[4] === 0x6a &&
    data[5] === 0x50 &&
    data[6] === 0x20 &&
    data[7] === 0x20
  ) {
    return extractDimensionsFromJp2(data);
  }

  // Check for raw codestream (SOC marker FF 4F)
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0x4f) {
    return extractDimensionsFromCodestream(data);
  }

  return null;
}

/**
 * Extract dimensions from a JP2 container by finding the ihdr box.
 * @internal
 */
function extractDimensionsFromJp2(
  data: Uint8Array,
): { width: number; height: number; components: number } | null {
  // Simple box scan looking for ihdr
  let offset = 0;

  while (offset + 8 <= data.length) {
    const view = new DataView(data.buffer, data.byteOffset + offset);
    let boxLength = view.getUint32(0, false);
    const type = String.fromCharCode(
      data[offset + 4]!,
      data[offset + 5]!,
      data[offset + 6]!,
      data[offset + 7]!,
    );

    if (boxLength === 1 && offset + 16 <= data.length) {
      const high = view.getUint32(8, false);
      const low = view.getUint32(12, false);
      boxLength = high > 0 ? data.length - offset : low;
    } else if (boxLength === 0) {
      boxLength = data.length - offset;
    }

    if (type === 'ihdr' && offset + 8 + 14 <= data.length) {
      const ihdrView = new DataView(data.buffer, data.byteOffset + offset + 8);
      return {
        height: ihdrView.getUint32(0, false),
        width: ihdrView.getUint32(4, false),
        components: ihdrView.getUint16(8, false),
      };
    }

    // Search inside jp2h superbox
    if (type === 'jp2h') {
      const innerEnd = offset + boxLength;
      let inner = offset + 8;
      while (inner + 8 <= innerEnd && inner + 8 <= data.length) {
        const innerView = new DataView(data.buffer, data.byteOffset + inner);
        let innerLen = innerView.getUint32(0, false);
        const innerType = String.fromCharCode(
          data[inner + 4]!,
          data[inner + 5]!,
          data[inner + 6]!,
          data[inner + 7]!,
        );

        if (innerLen === 0) innerLen = innerEnd - inner;

        if (innerType === 'ihdr' && inner + 8 + 14 <= data.length) {
          const ihdrV = new DataView(data.buffer, data.byteOffset + inner + 8);
          return {
            height: ihdrV.getUint32(0, false),
            width: ihdrV.getUint32(4, false),
            components: ihdrV.getUint16(8, false),
          };
        }

        if (innerLen <= 0) break;
        inner += innerLen;
      }
    }

    if (boxLength <= 0) break;
    offset += boxLength;
  }

  return null;
}

/**
 * Extract dimensions from a raw J2K codestream by reading the SIZ marker.
 *
 * SIZ marker structure (after FF 51):
 * - 2 bytes: marker segment length
 * - 2 bytes: capabilities (Rsiz)
 * - 4 bytes: reference grid width (Xsiz)
 * - 4 bytes: reference grid height (Ysiz)
 * - 4 bytes: horizontal offset (XOsiz)
 * - 4 bytes: vertical offset (YOsiz)
 * - 4 bytes: tile width (XTsiz)
 * - 4 bytes: tile height (YTsiz)
 * - 4 bytes: tile horizontal offset (XTOsiz)
 * - 4 bytes: tile vertical offset (YTOsiz)
 * - 2 bytes: number of components (Csiz)
 *
 * @internal
 */
function extractDimensionsFromCodestream(
  data: Uint8Array,
): { width: number; height: number; components: number } | null {
  // Look for SIZ marker (FF 51) right after SOC (FF 4F)
  if (data.length < 4) return null;

  // SIZ must follow immediately after SOC
  if (data[2] !== 0xff || data[3] !== 0x51) {
    // Scan for SIZ marker
    for (let i = 2; i < Math.min(data.length - 40, 100); i++) {
      if (data[i] === 0xff && data[i + 1] === 0x51) {
        return parseSizMarker(data, i + 2);
      }
    }
    return null;
  }

  return parseSizMarker(data, 4);
}

/**
 * Parse a SIZ marker segment at the given offset.
 * @internal
 */
function parseSizMarker(
  data: Uint8Array,
  offset: number,
): { width: number; height: number; components: number } | null {
  if (offset + 36 > data.length) return null;

  const view = new DataView(data.buffer, data.byteOffset + offset);

  // Skip Lsiz (2 bytes) and Rsiz (2 bytes)
  const xsiz = view.getUint32(4, false); // Reference grid width
  const ysiz = view.getUint32(8, false); // Reference grid height
  const xosiz = view.getUint32(12, false); // Horizontal offset
  const yosiz = view.getUint32(16, false); // Vertical offset

  // Components count is at offset 36 from marker data start
  if (offset + 38 > data.length) return null;
  const csiz = view.getUint16(36, false);

  return {
    width: xsiz - xosiz,
    height: ysiz - yosiz,
    components: csiz,
  };
}

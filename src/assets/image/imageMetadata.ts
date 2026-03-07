/**
 * @module assets/image/imageMetadata
 *
 * JPEG EXIF metadata extraction and re-injection.
 *
 * When images are recompressed (e.g. via `encodeJpegWasm()`), the encoder
 * produces a minimal JPEG containing only SOI + DQT + SOF + DHT + SOS.
 * All APP markers — including JFIF (APP0) and EXIF (APP1) — are stripped.
 *
 * This module extracts key metadata fields (orientation, DPI, copyright)
 * and the raw APP marker segments from the original JPEG, then re-injects
 * them into the recompressed output so that downstream consumers (PDF
 * viewers, print RIPs, image editors) see correct metadata.
 *
 * APP2 (ICC profile) markers are excluded because ICC profiles are
 * handled separately by `iccProfile.ts`.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Extracted JPEG metadata from APP markers.
 */
export interface JpegMetadata {
  /** EXIF orientation tag (1-8). 1 = normal, 6 = rotated 90 CW, etc. */
  readonly orientation?: number;
  /** Horizontal DPI from EXIF or JFIF. */
  readonly dpiX?: number;
  /** Vertical DPI from EXIF or JFIF. */
  readonly dpiY?: number;
  /** Copyright string from EXIF. */
  readonly copyright?: string;
  /** Raw APP marker segments to preserve (excluding APP2/ICC). */
  readonly appMarkers: readonly Uint8Array[];
}

// ---------------------------------------------------------------------------
// JPEG marker constants
// ---------------------------------------------------------------------------

/** Start of Image marker. */
const MARKER_SOI_0 = 0xff;
const MARKER_SOI_1 = 0xd8;

/** APP0 marker (JFIF). */
const MARKER_APP0 = 0xe0;

/** APP1 marker (EXIF). */
const MARKER_APP1 = 0xe1;

/** APP2 marker (ICC profile) — excluded from collection. */
const MARKER_APP2 = 0xe2;

// ---------------------------------------------------------------------------
// EXIF tag constants
// ---------------------------------------------------------------------------

const TAG_ORIENTATION = 0x0112;
const TAG_X_RESOLUTION = 0x011a;
const TAG_Y_RESOLUTION = 0x011b;
const TAG_COPYRIGHT = 0x8298;

// EXIF type sizes (bytes per component)
const EXIF_TYPE_BYTE = 1;
const EXIF_TYPE_ASCII = 2;
const EXIF_TYPE_SHORT = 3;
const EXIF_TYPE_LONG = 4;
const EXIF_TYPE_RATIONAL = 5;

/** Bytes per component for each EXIF type (index = type ID). */
const EXIF_TYPE_SIZES: Record<number, number> = {
  [EXIF_TYPE_BYTE]: 1,
  [EXIF_TYPE_ASCII]: 1,
  [EXIF_TYPE_SHORT]: 2,
  [EXIF_TYPE_LONG]: 4,
  [EXIF_TYPE_RATIONAL]: 8,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a marker byte is an APP marker (0xE0–0xEF).
 */
function isAppMarker(marker: number): boolean {
  return marker >= 0xe0 && marker <= 0xef;
}

/**
 * Check whether a marker byte is a standalone marker (no length field).
 * RST0-RST7 (0xD0-0xD7), SOI (0xD8), EOI (0xD9), TEM (0x01).
 */
function isStandaloneMarker(marker: number): boolean {
  return (
    marker === 0x00 ||
    marker === 0x01 ||
    (marker >= 0xd0 && marker <= 0xd9)
  );
}

/**
 * Compare a region of a Uint8Array against an ASCII string.
 */
function matchesAscii(
  data: Uint8Array,
  offset: number,
  expected: string,
): boolean {
  if (offset + expected.length > data.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[offset + i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// JFIF parsing
// ---------------------------------------------------------------------------

interface JfifInfo {
  dpiX?: number;
  dpiY?: number;
}

/**
 * Parse JFIF APP0 segment to extract DPI information.
 *
 * JFIF structure (after length field):
 *   - 5 bytes: "JFIF\0"
 *   - 2 bytes: version (major, minor)
 *   - 1 byte:  density units (0=aspect, 1=dpi, 2=dpcm)
 *   - 2 bytes: XDensity (big-endian)
 *   - 2 bytes: YDensity (big-endian)
 *
 * @param segmentData - The APP0 segment data (starting after FF E0 + length).
 */
function parseJfif(segmentData: Uint8Array): JfifInfo {
  // Minimum: "JFIF\0" (5) + version (2) + units (1) + Xdensity (2) + Ydensity (2) = 12
  if (segmentData.length < 12) return {};

  // Check "JFIF\0" identifier
  if (!matchesAscii(segmentData, 0, 'JFIF\0')) return {};

  const units = segmentData[7]!;
  const xDensity = (segmentData[8]! << 8) | segmentData[9]!;
  const yDensity = (segmentData[10]! << 8) | segmentData[11]!;

  if (units === 1) {
    // Dots per inch
    return { dpiX: xDensity, dpiY: yDensity };
  } else if (units === 2) {
    // Dots per centimeter — convert to DPI
    return {
      dpiX: Math.round(xDensity * 2.54),
      dpiY: Math.round(yDensity * 2.54),
    };
  }

  // units === 0 means aspect ratio only, no absolute DPI
  return {};
}

// ---------------------------------------------------------------------------
// EXIF parsing
// ---------------------------------------------------------------------------

interface ExifInfo {
  orientation?: number;
  dpiX?: number;
  dpiY?: number;
  copyright?: string;
}

/**
 * Parse EXIF APP1 segment to extract orientation, DPI, and copyright.
 *
 * EXIF structure (after length field):
 *   - 6 bytes: "Exif\0\0"
 *   - TIFF header:
 *     - 2 bytes: byte order ("II" = little-endian, "MM" = big-endian)
 *     - 2 bytes: magic number (42)
 *     - 4 bytes: offset to first IFD (from start of TIFF header)
 *   - IFD0 entries
 *
 * @param segmentData - The APP1 segment data (starting after FF E1 + length).
 */
function parseExif(segmentData: Uint8Array): ExifInfo {
  // Check "Exif\0\0" identifier
  if (segmentData.length < 14) return {};
  if (!matchesAscii(segmentData, 0, 'Exif\0\0')) return {};

  // TIFF header starts at offset 6
  const tiffStart = 6;
  const tiffData = segmentData.subarray(tiffStart);

  if (tiffData.length < 8) return {};

  // Determine byte order
  const bo0 = tiffData[0]!;
  const bo1 = tiffData[1]!;
  let littleEndian: boolean;

  if (bo0 === 0x49 && bo1 === 0x49) {
    // "II" = Intel = little-endian
    littleEndian = true;
  } else if (bo0 === 0x4d && bo1 === 0x4d) {
    // "MM" = Motorola = big-endian
    littleEndian = false;
  } else {
    return {};
  }

  const view = new DataView(
    tiffData.buffer,
    tiffData.byteOffset,
    tiffData.byteLength,
  );

  // Verify magic number 42
  const magic = view.getUint16(2, littleEndian);
  if (magic !== 42) return {};

  // Offset to first IFD
  const ifdOffset = view.getUint32(4, littleEndian);
  if (ifdOffset + 2 > tiffData.length) return {};

  // Read IFD entry count
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  if (ifdOffset + 2 + entryCount * 12 > tiffData.length) return {};

  const result: ExifInfo = {};

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);

    // Value/offset field is at entryOffset + 8 (4 bytes)
    // If the total data size <= 4 bytes, value is inline; otherwise it's an offset.
    const typeSize = EXIF_TYPE_SIZES[type] ?? 1;
    const totalSize = count * typeSize;
    const valueOffset =
      totalSize <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian);

    switch (tag) {
      case TAG_ORIENTATION:
        if (type === EXIF_TYPE_SHORT && count === 1 && valueOffset + 2 <= tiffData.length) {
          result.orientation = view.getUint16(
            totalSize <= 4 ? entryOffset + 8 : valueOffset,
            littleEndian,
          );
        }
        break;

      case TAG_X_RESOLUTION:
        if (type === EXIF_TYPE_RATIONAL && count === 1 && valueOffset + 8 <= tiffData.length) {
          const numerator = view.getUint32(valueOffset, littleEndian);
          const denominator = view.getUint32(valueOffset + 4, littleEndian);
          if (denominator !== 0) {
            result.dpiX = Math.round(numerator / denominator);
          }
        }
        break;

      case TAG_Y_RESOLUTION:
        if (type === EXIF_TYPE_RATIONAL && count === 1 && valueOffset + 8 <= tiffData.length) {
          const numerator = view.getUint32(valueOffset, littleEndian);
          const denominator = view.getUint32(valueOffset + 4, littleEndian);
          if (denominator !== 0) {
            result.dpiY = Math.round(numerator / denominator);
          }
        }
        break;

      case TAG_COPYRIGHT:
        if (type === EXIF_TYPE_ASCII && count > 0) {
          if (valueOffset + count <= tiffData.length) {
            // Read ASCII string, stopping at null terminator
            const chars: string[] = [];
            for (let j = 0; j < count; j++) {
              const c = tiffData[valueOffset + j]!;
              if (c === 0) break;
              chars.push(String.fromCharCode(c));
            }
            if (chars.length > 0) {
              result.copyright = chars.join('');
            }
          }
        }
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API: extractJpegMetadata
// ---------------------------------------------------------------------------

/**
 * Extract metadata from JPEG APP markers.
 *
 * Scans after the SOI (FF D8) marker for APP markers (FF E0 through FF EF).
 * Extracts key metadata from JFIF (APP0) and EXIF (APP1) segments, and
 * collects all APP marker segments as raw bytes (excluding APP2/ICC, which
 * is handled separately by `iccProfile.ts`).
 *
 * Scanning stops at the first non-APP marker (SOF, DQT, DHT, SOS, etc.).
 *
 * @param jpegBytes - Raw JPEG file bytes.
 * @returns Extracted metadata with collected APP marker segments.
 *
 * @example
 * ```ts
 * import { extractJpegMetadata } from 'modern-pdf-lib';
 *
 * const metadata = extractJpegMetadata(jpegBytes);
 * console.log(`Orientation: ${metadata.orientation}`);
 * console.log(`DPI: ${metadata.dpiX} x ${metadata.dpiY}`);
 * console.log(`Copyright: ${metadata.copyright}`);
 * ```
 */
export function extractJpegMetadata(jpegBytes: Uint8Array): JpegMetadata {
  const emptyResult: JpegMetadata = { appMarkers: [] };

  // Verify SOI marker
  if (
    jpegBytes.length < 4 ||
    jpegBytes[0] !== MARKER_SOI_0 ||
    jpegBytes[1] !== MARKER_SOI_1
  ) {
    return emptyResult;
  }

  let offset = 2;
  const appMarkers: Uint8Array[] = [];
  let orientation: number | undefined;
  let dpiX: number | undefined;
  let dpiY: number | undefined;
  let copyright: string | undefined;

  while (offset < jpegBytes.length - 1) {
    // Expect FF xx marker
    if (jpegBytes[offset] !== 0xff) {
      break;
    }

    // Skip padding 0xFF bytes
    let markerPos = offset;
    while (markerPos < jpegBytes.length && jpegBytes[markerPos] === 0xff) {
      markerPos++;
    }
    if (markerPos >= jpegBytes.length) break;

    const marker = jpegBytes[markerPos]!;
    markerPos++; // now points after the marker byte

    // Standalone markers (should not appear between SOI and first segment,
    // but handle gracefully)
    if (isStandaloneMarker(marker)) {
      offset = markerPos;
      continue;
    }

    // If it's not an APP marker, stop scanning — we've reached
    // the image data headers (DQT, SOF, DHT, SOS, etc.)
    if (!isAppMarker(marker)) {
      break;
    }

    // Read segment length (big-endian, includes the 2 length bytes)
    if (markerPos + 2 > jpegBytes.length) break;
    const segLen = (jpegBytes[markerPos]! << 8) | jpegBytes[markerPos + 1]!;
    if (segLen < 2) break;

    // Ensure the full segment is within bounds
    const segEnd = markerPos + segLen;
    if (segEnd > jpegBytes.length) break;

    // Segment data starts after the 2-byte length field
    const segmentData = jpegBytes.subarray(markerPos + 2, segEnd);

    // Parse known APP markers for metadata
    if (marker === MARKER_APP0) {
      const jfif = parseJfif(segmentData);
      if (jfif.dpiX !== undefined) dpiX ??= jfif.dpiX;
      if (jfif.dpiY !== undefined) dpiY ??= jfif.dpiY;
    } else if (marker === MARKER_APP1) {
      const exif = parseExif(segmentData);
      if (exif.orientation !== undefined) orientation ??= exif.orientation;
      if (exif.dpiX !== undefined) dpiX = exif.dpiX; // EXIF DPI overrides JFIF
      if (exif.dpiY !== undefined) dpiY = exif.dpiY;
      if (exif.copyright !== undefined) copyright ??= exif.copyright;
    }

    // Collect the raw marker segment (marker bytes + length + data),
    // but exclude APP2 (ICC profile)
    if (marker !== MARKER_APP2) {
      // Full segment = FF + marker + length(2) + data(segLen - 2)
      const fullSegment = jpegBytes.slice(offset, segEnd);
      appMarkers.push(fullSegment);
    }

    offset = segEnd;
  }

  return {
    ...(orientation !== undefined && { orientation }),
    ...(dpiX !== undefined && { dpiX }),
    ...(dpiY !== undefined && { dpiY }),
    ...(copyright !== undefined && { copyright }),
    appMarkers,
  };
}

// ---------------------------------------------------------------------------
// Public API: injectJpegMetadata
// ---------------------------------------------------------------------------

/**
 * Inject preserved APP markers into a recompressed JPEG.
 *
 * Inserts the collected APP marker segments after the SOI (FF D8) marker
 * and before any existing content. This restores metadata that was
 * stripped during recompression.
 *
 * @param jpegBytes - The recompressed JPEG bytes (starting with FF D8).
 * @param metadata  - The metadata extracted from the original JPEG.
 * @returns A new Uint8Array with the APP markers injected.
 *
 * @example
 * ```ts
 * import { extractJpegMetadata, injectJpegMetadata } from 'modern-pdf-lib';
 *
 * // Before recompression, extract metadata from original
 * const metadata = extractJpegMetadata(originalJpeg);
 *
 * // After recompression, inject metadata back
 * const recompressed = encodeJpegWasm(pixels, w, h, 3, 85);
 * const withMetadata = injectJpegMetadata(recompressed, metadata);
 * ```
 */
export function injectJpegMetadata(
  jpegBytes: Uint8Array,
  metadata: JpegMetadata,
): Uint8Array {
  // Nothing to inject
  if (!metadata.appMarkers.length) {
    return jpegBytes;
  }

  // Verify SOI marker
  if (
    jpegBytes.length < 2 ||
    jpegBytes[0] !== MARKER_SOI_0 ||
    jpegBytes[1] !== MARKER_SOI_1
  ) {
    return jpegBytes;
  }

  // Calculate total size of injected markers
  let injectedSize = 0;
  for (const marker of metadata.appMarkers) {
    injectedSize += marker.length;
  }

  // Build the output: SOI + injected markers + rest of original
  const result = new Uint8Array(jpegBytes.length + injectedSize);

  // Copy SOI (2 bytes)
  result[0] = MARKER_SOI_0;
  result[1] = MARKER_SOI_1;

  // Insert APP markers
  let pos = 2;
  for (const marker of metadata.appMarkers) {
    result.set(marker, pos);
    pos += marker.length;
  }

  // Copy the rest of the original JPEG (everything after SOI)
  result.set(jpegBytes.subarray(2), pos);

  return result;
}

/**
 * @module assets/image/jpegEmbed
 *
 * JPEG passthrough embedding for PDF image XObjects.
 *
 * JPEG images can be embedded directly in a PDF using the `/DCTDecode`
 * filter — the raw JPEG bytes become the stream content without any
 * re-encoding.  Only the SOF (Start of Frame) marker needs to be
 * parsed to extract width, height, and component count.
 *
 * Supports:
 * - SOF0 (Baseline DCT)
 * - SOF1 (Extended sequential DCT)
 * - SOF2 (Progressive DCT)
 * - SOF3 (Lossless)
 * - SOF5–SOF7, SOF9–SOF11, SOF13–SOF15 (all valid SOF markers)
 *
 * Color space is determined from the component count:
 * - 1 component  → DeviceGray
 * - 3 components → DeviceRGB
 * - 4 components → DeviceCMYK
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * The result of embedding a JPEG image — contains all the data needed
 * to create a PDF image XObject.
 */
export interface JpegEmbedResult {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Bits per component (typically 8). */
  readonly bitsPerComponent: number;
  /**
   * PDF color space:
   * - `'DeviceGray'` for 1-component JPEG
   * - `'DeviceRGB'` for 3-component JPEG
   * - `'DeviceCMYK'` for 4-component JPEG
   */
  readonly colorSpace: string;
  /** Number of color components (1, 3, or 4). */
  readonly componentCount: number;
  /**
   * The raw JPEG bytes — passed directly to the PDF stream.
   * No re-encoding is performed.
   */
  readonly imageData: Uint8Array;
  /**
   * The PDF /Filter value.  Always `'DCTDecode'` for JPEG.
   */
  readonly filter: string;
  /**
   * Whether the JPEG uses CMYK color.  When `true`, the PDF viewer
   * may need special handling (e.g. `/Decode [1 0 1 0 1 0 1 0]` for
   * inverted CMYK).
   */
  readonly isCmyk: boolean;
  /**
   * Whether the JPEG appears to have an Adobe APP14 marker with
   * YCCK color transform, which requires inverted CMYK decode.
   */
  readonly hasAdobeMarker: boolean;
}

// ---------------------------------------------------------------------------
// JPEG marker constants
// ---------------------------------------------------------------------------

/** JPEG Start of Image marker. */
const SOI = 0xD8;

/** JPEG End of Image marker. */
const EOI = 0xD9;

/** Start of Scan marker (payload follows; rest of data is entropy-coded). */
const SOS = 0xDA;

/**
 * SOF (Start of Frame) markers.
 * SOF0=0xC0 through SOF15=0xCF, excluding 0xC4 (DHT), 0xC8 (JPG), 0xCC (DAC).
 */
function isSofMarker(marker: number): boolean {
  return (
    marker >= 0xC0 &&
    marker <= 0xCF &&
    marker !== 0xC4 && // DHT (Define Huffman Table)
    marker !== 0xC8 && // JPG (reserved)
    marker !== 0xCC    // DAC (Define Arithmetic Coding)
  );
}

/**
 * APP14 Adobe marker identifier.
 */
const ADOBE_APP14_TAG = new Uint8Array([0x41, 0x64, 0x6F, 0x62, 0x65]); // "Adobe"

/**
 * JFIF identifier in APP0.
 */
const JFIF_TAG = new Uint8Array([0x4A, 0x46, 0x49, 0x46, 0x00]); // "JFIF\0"

// ---------------------------------------------------------------------------
// Internal: JPEG header parsing
// ---------------------------------------------------------------------------

/**
 * Parsed data from the JPEG SOF marker.
 */
interface JpegSofData {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Bits per sample (usually 8, sometimes 12). */
  readonly precision: number;
  /** Number of components (1=gray, 3=YCbCr/RGB, 4=CMYK/YCCK). */
  readonly componentCount: number;
}

/**
 * Parse the JPEG file to find the first SOF marker and extract
 * image dimensions and component count.
 *
 * @param data - Raw JPEG file bytes.
 * @returns Parsed SOF data.
 * @throws If the data is not a valid JPEG or no SOF marker is found.
 */
function parseJpegSof(data: Uint8Array): JpegSofData {
  if (data.length < 2 || data[0] !== 0xFF || data[1] !== SOI) {
    throw new Error('Invalid JPEG: missing SOI marker (expected 0xFFD8)');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset < data.length - 1) {
    // Find next marker
    if (data[offset] !== 0xFF) {
      // Skip non-marker bytes (can happen after SOS)
      offset++;
      continue;
    }

    // Skip padding 0xFF bytes
    while (offset < data.length && data[offset] === 0xFF) {
      offset++;
    }

    if (offset >= data.length) break;

    const marker = data[offset]!;
    offset++;

    // Markers without a length field
    if (marker === 0x00 || marker === SOI || marker === EOI) {
      continue;
    }

    // RST markers (0xD0–0xD7) — no length field
    if (marker >= 0xD0 && marker <= 0xD7) {
      continue;
    }

    // All other markers have a 2-byte length field
    if (offset + 2 > data.length) break;

    const segmentLength = view.getUint16(offset, false);

    // SOF marker found
    if (isSofMarker(marker)) {
      if (offset + segmentLength < data.length && segmentLength >= 8) {
        const precision = data[offset + 2]!;
        const height = view.getUint16(offset + 3, false);
        const width = view.getUint16(offset + 5, false);
        const componentCount = data[offset + 7]!;

        return { width, height, precision, componentCount };
      }
    }

    // Skip past this marker segment
    offset += segmentLength;
  }

  throw new Error('Invalid JPEG: no SOF marker found');
}

/**
 * Check for an Adobe APP14 marker.
 *
 * The Adobe marker indicates how to interpret the color data:
 * - Color transform 0: no transform (components are as-is)
 * - Color transform 1: YCbCr
 * - Color transform 2: YCCK
 *
 * For 4-component JPEGs with Adobe marker and transform 2 (YCCK),
 * the PDF needs a `/Decode [1 0 1 0 1 0 1 0]` to invert the values.
 *
 * @param data - Raw JPEG file bytes.
 * @returns The Adobe color transform value, or -1 if no Adobe marker.
 */
function findAdobeColorTransform(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }

    while (offset < data.length && data[offset] === 0xFF) {
      offset++;
    }

    if (offset >= data.length) break;

    const marker = data[offset]!;
    offset++;

    if (marker === 0x00 || marker === SOI || marker === EOI) continue;
    if (marker >= 0xD0 && marker <= 0xD7) continue;

    if (offset + 2 > data.length) break;
    const segmentLength = view.getUint16(offset, false);

    // APP14 = 0xEE
    if (marker === 0xEE && segmentLength >= 14) {
      // Check for "Adobe" identifier at offset+2
      let isAdobe = true;
      for (let i = 0; i < ADOBE_APP14_TAG.length; i++) {
        if (data[offset + 2 + i] !== ADOBE_APP14_TAG[i]) {
          isAdobe = false;
          break;
        }
      }

      if (isAdobe) {
        // Color transform byte is at offset + 2 + 11 = offset + 13
        const colorTransform = data[offset + 13];
        return colorTransform ?? -1;
      }
    }

    // SOS marker — stop scanning (entropy-coded data follows)
    if (marker === SOS) break;

    offset += segmentLength;
  }

  return -1;
}

/**
 * Check if the JPEG contains a JFIF APP0 marker.
 *
 * @param data - Raw JPEG file bytes.
 * @returns `true` if a JFIF marker is present.
 */
function hasJfifMarker(data: Uint8Array): boolean {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }

    while (offset < data.length && data[offset] === 0xFF) {
      offset++;
    }

    if (offset >= data.length) break;

    const marker = data[offset]!;
    offset++;

    if (marker === 0x00 || marker === SOI || marker === EOI) continue;
    if (marker >= 0xD0 && marker <= 0xD7) continue;

    if (offset + 2 > data.length) break;
    const segmentLength = view.getUint16(offset, false);

    // APP0 = 0xE0
    if (marker === 0xE0 && segmentLength >= 16) {
      let isJfif = true;
      for (let i = 0; i < JFIF_TAG.length; i++) {
        if (data[offset + 2 + i] !== JFIF_TAG[i]) {
          isJfif = false;
          break;
        }
      }
      if (isJfif) return true;
    }

    if (marker === SOS) break;

    offset += segmentLength;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed a JPEG image for use as a PDF image XObject.
 *
 * JPEG data is passed through directly — the raw bytes become the
 * stream content with `/Filter /DCTDecode`.  Only the header is
 * parsed to extract dimensions and color information.
 *
 * @param jpegData - The raw JPEG file as a Uint8Array.
 * @returns The embedding result.
 *
 * @example
 * ```ts
 * const jpegBytes = await readFile('photo.jpg');
 * const result = embedJpeg(jpegBytes);
 *
 * // Create image XObject with:
 * //   /Width result.width
 * //   /Height result.height
 * //   /ColorSpace /DeviceRGB  (or /DeviceGray, /DeviceCMYK)
 * //   /BitsPerComponent result.bitsPerComponent
 * //   /Filter /DCTDecode
 * //   stream: result.imageData  (the raw JPEG bytes)
 * ```
 */
export function embedJpeg(jpegData: Uint8Array): JpegEmbedResult {
  // 1. Parse SOF marker
  const sof = parseJpegSof(jpegData);

  // 2. Check for Adobe APP14 marker
  const adobeTransform = findAdobeColorTransform(jpegData);
  const hasAdobe = adobeTransform !== -1;

  // 3. Determine color space
  let colorSpace: string;
  const isCmyk = sof.componentCount === 4;

  switch (sof.componentCount) {
    case 1:
      colorSpace = 'DeviceGray';
      break;
    case 3:
      colorSpace = 'DeviceRGB';
      break;
    case 4:
      colorSpace = 'DeviceCMYK';
      break;
    default:
      throw new Error(`Unsupported JPEG component count: ${sof.componentCount}`);
  }

  return {
    width: sof.width,
    height: sof.height,
    bitsPerComponent: sof.precision,
    colorSpace,
    componentCount: sof.componentCount,
    imageData: jpegData,
    filter: 'DCTDecode',
    isCmyk,
    hasAdobeMarker: hasAdobe,
  };
}

/**
 * Check whether a Uint8Array contains JPEG data by examining the
 * first two bytes for the SOI marker.
 *
 * @param data - The data to check.
 * @returns `true` if the data starts with the JPEG SOI marker (0xFFD8).
 */
export function isJpeg(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0xFF && data[1] === SOI;
}

/**
 * Extract basic JPEG metadata without performing a full embed.
 *
 * @param jpegData - The raw JPEG bytes.
 * @returns Width, height, and component count.
 */
export function getJpegInfo(jpegData: Uint8Array): {
  width: number;
  height: number;
  componentCount: number;
  precision: number;
  hasJfif: boolean;
  hasAdobe: boolean;
} {
  const sof = parseJpegSof(jpegData);
  return {
    width: sof.width,
    height: sof.height,
    componentCount: sof.componentCount,
    precision: sof.precision,
    hasJfif: hasJfifMarker(jpegData),
    hasAdobe: findAdobeColorTransform(jpegData) !== -1,
  };
}

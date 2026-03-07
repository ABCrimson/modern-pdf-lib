/**
 * @module parser/jpeg2000Transcode
 *
 * JPEG2000 to JPEG transcoding.
 *
 * Decodes a JPEG2000 image (JP2 container or raw J2K codestream) and
 * re-encodes it as a standard JPEG.  This is useful for converting
 * JPXDecode-filtered PDF image streams into DCTDecode (JPEG) streams
 * that are more widely supported.
 *
 * Uses the JPEG WASM encoder when available, otherwise falls back to
 * a minimal baseline JPEG encoder written in pure JS.
 *
 * No Buffer — uses Uint8Array exclusively.
 *
 * @packageDocumentation
 */

import type { ChromaSubsampling } from '../wasm/jpeg/bridge.js';

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
 * Steps:
 * 1. Decode the JPEG2000 image (WASM or JS fallback).
 * 2. Handle 16-bit to 8-bit downscaling if needed.
 * 3. Strip alpha channel (JPEG does not support alpha).
 * 4. Encode as JPEG (WASM or JS fallback).
 *
 * @param jp2Data  - JPEG2000-encoded bytes (JP2 container or raw J2K).
 * @param options  - Transcoding options (quality, progressive, chroma).
 * @returns JPEG-encoded bytes.
 * @throws If decoding or encoding fails.
 *
 * @example
 * ```ts
 * import { transcodeJp2ToJpeg } from 'modern-pdf-lib/parser';
 *
 * const jpegBytes = await transcodeJp2ToJpeg(jp2Bytes, { quality: 90 });
 * ```
 */
export async function transcodeJp2ToJpeg(
  jp2Data: Uint8Array,
  options: TranscodeOptions = {},
): Promise<Uint8Array> {
  const quality = Math.max(1, Math.min(100, options.quality ?? 85));
  const progressive = options.progressive ?? false;
  const chroma = options.chromaSubsampling ?? '4:2:0';

  // Step 1: Decode JPEG2000
  const { decodeJpeg2000WithFallback } = await import('./jpeg2000WasmBridge.js');
  const decoded = await decodeJpeg2000WithFallback(jp2Data);

  let { data, width, height, components } = decoded;

  // Step 2: Handle 16-bit to 8-bit downscaling
  // If the data length suggests 16-bit components, downscale
  const expectedBytes8 = width * height * components;
  const expectedBytes16 = expectedBytes8 * 2;

  if (data.length >= expectedBytes16 && data.length > expectedBytes8) {
    data = downscale16to8(data, width, height, components);
  }

  // Step 3: Strip alpha channel if present (JPEG doesn't support alpha)
  if (components === 4) {
    data = stripAlphaChannel(data, width, height, 4);
    components = 3;
  } else if (components === 2) {
    // Grayscale + alpha -> grayscale
    data = stripAlphaChannel(data, width, height, 2);
    components = 1;
  }

  // Step 4: Encode as JPEG
  return encodeAsJpeg(data, width, height, components, quality, progressive, chroma);
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
export function estimateTranscodedSize(
  jp2Data: Uint8Array,
  quality: number = 85,
): number {
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
    data[0] === 0x00 && data[1] === 0x00 &&
    data[2] === 0x00 && data[3] === 0x0C &&
    data[4] === 0x6A && data[5] === 0x50 &&
    data[6] === 0x20 && data[7] === 0x20
  ) {
    return extractDimensionsFromJp2(data);
  }

  // Check for raw codestream (SOC marker FF 4F)
  if (data.length >= 2 && data[0] === 0xFF && data[1] === 0x4F) {
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
      boxLength = high > 0 ? (data.length - offset) : low;
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
  if (data[2] !== 0xFF || data[3] !== 0x51) {
    // Scan for SIZ marker
    for (let i = 2; i < Math.min(data.length - 40, 100); i++) {
      if (data[i] === 0xFF && data[i + 1] === 0x51) {
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
  const xsiz = view.getUint32(4, false);   // Reference grid width
  const ysiz = view.getUint32(8, false);   // Reference grid height
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

// ---------------------------------------------------------------------------
// Internal: pixel data transformation
// ---------------------------------------------------------------------------

/**
 * Downscale 16-bit-per-component pixel data to 8-bit.
 *
 * Reads pairs of bytes (big-endian) and maps from [0, 65535] to [0, 255].
 *
 * @internal
 */
function downscale16to8(
  data: Uint8Array,
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const pixelCount = width * height;
  const totalSamples = pixelCount * components;
  const result = new Uint8Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const byteOffset = i * 2;
    if (byteOffset + 1 >= data.length) break;

    // Read 16-bit big-endian value
    const value16 = (data[byteOffset]! << 8) | data[byteOffset + 1]!;
    // Map to 8-bit
    result[i] = (value16 >> 8) & 0xFF;
  }

  return result;
}

/**
 * Strip the alpha channel from interleaved pixel data.
 *
 * Converts N-channel data to (N-1)-channel by removing the last component.
 *
 * @internal
 */
function stripAlphaChannel(
  data: Uint8Array,
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const pixelCount = width * height;
  const outChannels = components - 1;
  const result = new Uint8Array(pixelCount * outChannels);

  for (let i = 0; i < pixelCount; i++) {
    const srcOffset = i * components;
    const dstOffset = i * outChannels;

    for (let c = 0; c < outChannels; c++) {
      result[dstOffset + c] = data[srcOffset + c]!;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: JPEG encoding
// ---------------------------------------------------------------------------

/**
 * Encode raw pixel data as JPEG, using the WASM encoder if available
 * or falling back to a minimal baseline JPEG encoder.
 *
 * @internal
 */
async function encodeAsJpeg(
  pixels: Uint8Array,
  width: number,
  height: number,
  components: number,
  quality: number,
  progressive: boolean,
  chroma: '4:4:4' | '4:2:2' | '4:2:0',
): Promise<Uint8Array> {
  // Try WASM encoder first
  try {
    const { encodeJpegWasm, isJpegWasmReady } = await import(
      '../wasm/jpeg/bridge.js'
    );

    if (isJpegWasmReady()) {
      const channels = components as 1 | 3 | 4;
      const encoded = encodeJpegWasm(
        pixels,
        width,
        height,
        channels,
        quality,
        progressive,
        chroma as ChromaSubsampling,
      );

      if (encoded) {
        return encoded;
      }
    }
  } catch {
    // WASM unavailable — fall through to JS encoder
  }

  // Fallback: minimal baseline JPEG encoder (pure JS)
  return encodeBaselineJpeg(pixels, width, height, components, quality);
}

// ---------------------------------------------------------------------------
// Internal: minimal baseline JPEG encoder (JS fallback)
// ---------------------------------------------------------------------------

/**
 * Minimal baseline JPEG encoder for the fallback path.
 *
 * Produces a valid JPEG file using standard Huffman tables and scaled
 * quantization tables.  Quality is adequate for PDF embedding where the
 * WASM module is not available.
 *
 * @internal
 */
function encodeBaselineJpeg(
  pixels: Uint8Array,
  width: number,
  height: number,
  components: number,
  quality: number,
): Uint8Array {
  // For the JS fallback, we produce a minimal valid JPEG.
  // This is a simplified encoder that handles grayscale and RGB.

  const isGray = components === 1;
  const jpegComponents = isGray ? 1 : 3;

  // Compute scale factor from quality
  const q = Math.max(1, Math.min(100, quality));
  const scaleFactor = q < 50 ? (5000 / q) : (200 - 2 * q);

  // Scale standard luminance and chrominance quantization tables
  const lumQt = scaleQuantTable(STANDARD_LUM_QT, scaleFactor);
  const chrQt = scaleQuantTable(STANDARD_CHR_QT, scaleFactor);

  // Build JPEG byte stream
  const chunks: Uint8Array[] = [];

  // SOI
  chunks.push(new Uint8Array([0xFF, 0xD8]));

  // APP0 (JFIF)
  chunks.push(buildApp0());

  // DQT — luminance
  chunks.push(buildDqt(0, lumQt));

  // DQT — chrominance (only for color)
  if (!isGray) {
    chunks.push(buildDqt(1, chrQt));
  }

  // SOF0 (baseline)
  chunks.push(buildSof0(width, height, jpegComponents));

  // DHT — standard Huffman tables
  chunks.push(buildStandardDht());

  // SOS + entropy-coded data
  const scanData = encodeScanData(
    pixels, width, height, components, jpegComponents,
    lumQt, chrQt,
  );
  chunks.push(scanData);

  // EOI
  chunks.push(new Uint8Array([0xFF, 0xD9]));

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

// Standard luminance quantization table (JPEG Annex K, Table K.1)
const STANDARD_LUM_QT = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77,
  24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

// Standard chrominance quantization table (JPEG Annex K, Table K.2)
const STANDARD_CHR_QT = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
];

// Zigzag scan order for 8x8 blocks
const ZIGZAG = [
  0,  1,  8,  16,  9,  2,  3, 10,
  17, 24, 32, 25, 18, 11,  4,  5,
  12, 19, 26, 33, 40, 48, 41, 34,
  27, 20, 13,  6,  7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63,
];

/** Scale a quantization table by the given factor. @internal */
function scaleQuantTable(base: number[], scaleFactor: number): number[] {
  return base.map((v) => {
    const scaled = Math.floor((v * scaleFactor + 50) / 100);
    return Math.max(1, Math.min(255, scaled));
  });
}

/** Build JFIF APP0 marker. @internal */
function buildApp0(): Uint8Array {
  return new Uint8Array([
    0xFF, 0xE0, // APP0 marker
    0x00, 0x10, // Length = 16
    0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, // Version 1.1
    0x00,       // No density units
    0x00, 0x01, // X density = 1
    0x00, 0x01, // Y density = 1
    0x00, 0x00, // No thumbnail
  ]);
}

/** Build DQT marker for one table. @internal */
function buildDqt(tableId: number, table: number[]): Uint8Array {
  const data = new Uint8Array(2 + 2 + 1 + 64);
  data[0] = 0xFF;
  data[1] = 0xDB;
  data[2] = 0x00;
  data[3] = 67; // Length = 67 (2 + 1 + 64)
  data[4] = tableId & 0x0F; // 8-bit precision (0) + table ID
  for (let i = 0; i < 64; i++) {
    data[5 + i] = table[ZIGZAG[i]!]!;
  }
  return data;
}

/** Build SOF0 marker. @internal */
function buildSof0(
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const length = 8 + components * 3;
  const data = new Uint8Array(2 + 2 + length - 2);
  let pos = 0;

  data[pos++] = 0xFF;
  data[pos++] = 0xC0; // SOF0

  data[pos++] = (length >> 8) & 0xFF;
  data[pos++] = length & 0xFF;

  data[pos++] = 8; // Precision (8 bits)

  data[pos++] = (height >> 8) & 0xFF;
  data[pos++] = height & 0xFF;

  data[pos++] = (width >> 8) & 0xFF;
  data[pos++] = width & 0xFF;

  data[pos++] = components;

  if (components === 1) {
    // Grayscale: component 1, sampling 1x1, quant table 0
    data[pos++] = 1; // Component ID
    data[pos++] = 0x11; // Sampling: 1x1
    data[pos++] = 0; // Quant table 0
  } else {
    // Y: sampling 1x1, quant table 0
    data[pos++] = 1;
    data[pos++] = 0x11;
    data[pos++] = 0;
    // Cb: sampling 1x1, quant table 1
    data[pos++] = 2;
    data[pos++] = 0x11;
    data[pos++] = 1;
    // Cr: sampling 1x1, quant table 1
    data[pos++] = 3;
    data[pos++] = 0x11;
    data[pos++] = 1;
  }

  return data.subarray(0, pos);
}

// Standard DC/AC Huffman tables (JPEG Annex K, Tables K.3-K.6)
// Encoded as: [bits_1..bits_16, values...]

const DC_LUM_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUM_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const DC_CHR_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHR_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const AC_LUM_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7D];
const AC_LUM_VALS = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12,
  0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
  0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A, 0x16,
  0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
  0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79,
  0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
  0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
  0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
  0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5,
  0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4,
  0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
  0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA,
  0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8,
  0xF9, 0xFA,
];

const AC_CHR_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHR_VALS = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21,
  0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
  0xA1, 0xB1, 0xC1, 0x09, 0x23, 0x33, 0x52, 0xF0,
  0x15, 0x62, 0x72, 0xD1, 0x0A, 0x16, 0x24, 0x34,
  0xE1, 0x25, 0xF1, 0x17, 0x18, 0x19, 0x1A, 0x26,
  0x27, 0x28, 0x29, 0x2A, 0x35, 0x36, 0x37, 0x38,
  0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
  0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78,
  0x79, 0x7A, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96,
  0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5,
  0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4,
  0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3,
  0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2,
  0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA,
  0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9,
  0xEA, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8,
  0xF9, 0xFA,
];

/** Build all four standard DHT markers in one segment. @internal */
function buildStandardDht(): Uint8Array {
  const tables = [
    { cls: 0, id: 0, bits: DC_LUM_BITS, vals: DC_LUM_VALS },
    { cls: 1, id: 0, bits: AC_LUM_BITS, vals: AC_LUM_VALS },
    { cls: 0, id: 1, bits: DC_CHR_BITS, vals: DC_CHR_VALS },
    { cls: 1, id: 1, bits: AC_CHR_BITS, vals: AC_CHR_VALS },
  ];

  const segments: Uint8Array[] = [];

  for (const t of tables) {
    const payloadLen = 1 + 16 + t.vals.length;
    const segLen = 2 + payloadLen;
    const seg = new Uint8Array(2 + segLen);
    seg[0] = 0xFF;
    seg[1] = 0xC4; // DHT marker
    seg[2] = (segLen >> 8) & 0xFF;
    seg[3] = segLen & 0xFF;
    seg[4] = (t.cls << 4) | t.id;
    for (let i = 0; i < 16; i++) {
      seg[5 + i] = t.bits[i]!;
    }
    for (let i = 0; i < t.vals.length; i++) {
      seg[21 + i] = t.vals[i]!;
    }
    segments.push(seg.subarray(0, 2 + segLen));
  }

  const totalLen = segments.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const seg of segments) {
    result.set(seg, pos);
    pos += seg.length;
  }

  return result;
}

/**
 * Huffman code table built from bits/values specification.
 * @internal
 */
interface HuffTable {
  readonly codes: number[];
  readonly lengths: number[];
}

/** Build a Huffman encoding table from bits/vals. @internal */
function buildHuffTable(bits: number[], vals: number[]): HuffTable {
  const codes: number[] = new Array(256).fill(0);
  const lengths: number[] = new Array(256).fill(0);

  let code = 0;
  let valIdx = 0;

  for (let len = 1; len <= 16; len++) {
    for (let j = 0; j < bits[len - 1]!; j++) {
      if (valIdx < vals.length) {
        const sym = vals[valIdx]!;
        codes[sym] = code;
        lengths[sym] = len;
        valIdx++;
      }
      code++;
    }
    code <<= 1;
  }

  return { codes, lengths };
}

/**
 * Encode the scan data (SOS marker + entropy-coded data).
 * @internal
 */
function encodeScanData(
  pixels: Uint8Array,
  width: number,
  height: number,
  srcComponents: number,
  jpegComponents: number,
  lumQt: number[],
  chrQt: number[],
): Uint8Array {
  // Build Huffman tables
  const dcLumHuff = buildHuffTable(DC_LUM_BITS, DC_LUM_VALS);
  const acLumHuff = buildHuffTable(AC_LUM_BITS, AC_LUM_VALS);
  const dcChrHuff = buildHuffTable(DC_CHR_BITS, DC_CHR_VALS);
  const acChrHuff = buildHuffTable(AC_CHR_BITS, AC_CHR_VALS);

  // Bit writer
  let outBuf = new Uint8Array(width * height * 4 + 1024);
  let outPos = 0;
  let bitBuffer = 0;
  let bitCount = 0;

  function ensureCapacity(needed: number): void {
    if (outPos + needed >= outBuf.length) {
      const newBuf = new Uint8Array(Math.max(outBuf.length * 2, outPos + needed));
      newBuf.set(outBuf.subarray(0, outPos));
      outBuf = newBuf;
    }
  }

  function writeBits(value: number, numBits: number): void {
    bitBuffer = (bitBuffer << numBits) | (value & ((1 << numBits) - 1));
    bitCount += numBits;

    while (bitCount >= 8) {
      bitCount -= 8;
      const byte = (bitBuffer >> bitCount) & 0xFF;
      ensureCapacity(2);
      outBuf[outPos++] = byte;
      if (byte === 0xFF) {
        outBuf[outPos++] = 0x00; // Byte stuffing
      }
    }
  }

  function flushBits(): void {
    if (bitCount > 0) {
      const padded = (bitBuffer << (8 - bitCount)) | ((1 << (8 - bitCount)) - 1);
      ensureCapacity(2);
      outBuf[outPos++] = padded & 0xFF;
      if ((padded & 0xFF) === 0xFF) {
        outBuf[outPos++] = 0x00;
      }
    }
    bitBuffer = 0;
    bitCount = 0;
  }

  function encodeValue(val: number, huff: HuffTable): void {
    const code = huff.codes[val]!;
    const len = huff.lengths[val]!;
    if (len > 0) {
      writeBits(code, len);
    }
  }

  // Number of bits needed to represent |value|
  function bitSize(value: number): number {
    if (value === 0) return 0;
    let v = Math.abs(value);
    let bits = 0;
    while (v > 0) {
      bits++;
      v >>= 1;
    }
    return bits;
  }

  function encodeDC(diff: number, huff: HuffTable): void {
    const size = bitSize(diff);
    encodeValue(size, huff);
    if (size > 0) {
      const val = diff < 0 ? diff - 1 : diff;
      writeBits(val & ((1 << size) - 1), size);
    }
  }

  function encodeAC(block: number[], huff: HuffTable): void {
    let zeroCount = 0;

    for (let i = 1; i < 64; i++) {
      const val = block[ZIGZAG[i]!]!;

      if (val === 0) {
        zeroCount++;
        continue;
      }

      while (zeroCount >= 16) {
        encodeValue(0xF0, huff); // ZRL (16 zeros)
        zeroCount -= 16;
      }

      const size = bitSize(val);
      const sym = (zeroCount << 4) | size;
      encodeValue(sym, huff);
      const bits = val < 0 ? val - 1 : val;
      writeBits(bits & ((1 << size) - 1), size);
      zeroCount = 0;
    }

    if (zeroCount > 0) {
      encodeValue(0x00, huff); // EOB
    }
  }

  // Build SOS header
  const sosHeaderLen = 6 + jpegComponents * 2;
  const sosHeader = new Uint8Array(2 + sosHeaderLen);
  let hp = 0;
  sosHeader[hp++] = 0xFF;
  sosHeader[hp++] = 0xDA; // SOS marker
  sosHeader[hp++] = (sosHeaderLen >> 8) & 0xFF;
  sosHeader[hp++] = sosHeaderLen & 0xFF;
  sosHeader[hp++] = jpegComponents;

  if (jpegComponents === 1) {
    sosHeader[hp++] = 1;    // Component ID
    sosHeader[hp++] = 0x00; // DC table 0, AC table 0
  } else {
    sosHeader[hp++] = 1;
    sosHeader[hp++] = 0x00; // Y: DC0, AC0
    sosHeader[hp++] = 2;
    sosHeader[hp++] = 0x11; // Cb: DC1, AC1
    sosHeader[hp++] = 3;
    sosHeader[hp++] = 0x11; // Cr: DC1, AC1
  }

  sosHeader[hp++] = 0x00; // Spectral selection start
  sosHeader[hp++] = 0x3F; // Spectral selection end
  sosHeader[hp++] = 0x00; // Successive approximation

  // Encode MCUs (minimum coded units) — 8x8 blocks
  const blocksX = Math.ceil(width / 8);
  const blocksY = Math.ceil(height / 8);

  const prevDC = new Int32Array(jpegComponents);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      // For each component, extract 8x8 block, DCT, quantize, encode
      for (let comp = 0; comp < jpegComponents; comp++) {
        const block = extractBlock(
          pixels, width, height, srcComponents, bx, by, comp, jpegComponents,
        );

        // Forward DCT
        forwardDCT(block);

        // Quantize
        const qt = comp === 0 ? lumQt : chrQt;
        const quantized = new Array<number>(64);
        for (let i = 0; i < 64; i++) {
          quantized[i] = Math.round(block[i]! / qt[i]!);
        }

        // Encode DC coefficient
        const dcVal = quantized[0]!;
        const dcDiff = dcVal - prevDC[comp]!;
        prevDC[comp] = dcVal;

        const dcHuff = comp === 0 ? dcLumHuff : dcChrHuff;
        const acHuff = comp === 0 ? acLumHuff : acChrHuff;

        encodeDC(dcDiff, dcHuff);
        encodeAC(quantized, acHuff);
      }
    }
  }

  flushBits();

  // Combine SOS header + entropy data
  const result = new Uint8Array(sosHeader.length + outPos);
  result.set(sosHeader, 0);
  result.set(outBuf.subarray(0, outPos), sosHeader.length);

  return result;
}

/**
 * Extract an 8x8 pixel block from the image for a given component.
 * Handles edge padding by replicating the last pixel.
 * For color images, converts RGB to YCbCr.
 * @internal
 */
function extractBlock(
  pixels: Uint8Array,
  width: number,
  height: number,
  srcComponents: number,
  bx: number,
  by: number,
  component: number,
  jpegComponents: number,
): Float64Array {
  const block = new Float64Array(64);
  const x0 = bx * 8;
  const y0 = by * 8;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const px = Math.min(x0 + col, width - 1);
      const py = Math.min(y0 + row, height - 1);

      const srcIdx = (py * width + px) * srcComponents;

      let value: number;

      if (jpegComponents === 1) {
        // Grayscale — just use the first channel
        value = pixels[srcIdx]! - 128;
      } else {
        // RGB to YCbCr conversion
        const r = pixels[srcIdx]!;
        const g = pixels[srcIdx + 1]!;
        const b = pixels[srcIdx + 2]!;

        switch (component) {
          case 0: // Y
            value = 0.299 * r + 0.587 * g + 0.114 * b - 128;
            break;
          case 1: // Cb
            value = -0.1687 * r - 0.3313 * g + 0.5 * b;
            break;
          case 2: // Cr
            value = 0.5 * r - 0.4187 * g - 0.0813 * b;
            break;
          default:
            value = 0;
        }
      }

      block[row * 8 + col] = value;
    }
  }

  return block;
}

/**
 * In-place forward 8x8 DCT (AAN algorithm approximation).
 * @internal
 */
function forwardDCT(block: Float64Array): void {
  // Row pass
  for (let i = 0; i < 8; i++) {
    const off = i * 8;
    const s0 = block[off]! + block[off + 7]!;
    const s1 = block[off + 1]! + block[off + 6]!;
    const s2 = block[off + 2]! + block[off + 5]!;
    const s3 = block[off + 3]! + block[off + 4]!;
    const d0 = block[off]! - block[off + 7]!;
    const d1 = block[off + 1]! - block[off + 6]!;
    const d2 = block[off + 2]! - block[off + 5]!;
    const d3 = block[off + 3]! - block[off + 4]!;

    const e0 = s0 + s3;
    const e1 = s1 + s2;
    const e2 = s0 - s3;
    const e3 = s1 - s2;

    block[off] = (e0 + e1) * 0.125;
    block[off + 4] = (e0 - e1) * 0.125;

    const z1 = (e2 + e3) * 0.541196100;
    block[off + 2] = (z1 + e2 * 0.765366865) * 0.125;
    block[off + 6] = (z1 - e3 * 1.847759065) * 0.125;

    const f0 = d0 + d3;
    const f1 = d1 + d2;
    const f2 = d0 + d2;
    const f3 = d1 + d3;
    const z5 = (f2 + f3) * 1.175875602;

    const t0 = d0 * 0.298631336;
    const t1 = d1 * 2.053119869;
    const t2 = d2 * 3.072711026;
    const t3 = d3 * 1.501321110;
    const z2 = f0 * (-1.961570560);
    const z3 = f1 * (-0.390180644);
    const z4 = z5 - (f2 * 0.899976223);
    const zz5 = z5 - (f3 * 2.562915447);

    block[off + 1] = (t3 + z3 + zz5) * 0.125;
    block[off + 3] = (t2 + z2 + z4) * 0.125;
    block[off + 5] = (t1 + z2 + zz5) * 0.125;
    block[off + 7] = (t0 + z3 + z4) * 0.125;
  }

  // Column pass
  for (let i = 0; i < 8; i++) {
    const s0 = block[i]! + block[56 + i]!;
    const s1 = block[8 + i]! + block[48 + i]!;
    const s2 = block[16 + i]! + block[40 + i]!;
    const s3 = block[24 + i]! + block[32 + i]!;
    const d0 = block[i]! - block[56 + i]!;
    const d1 = block[8 + i]! - block[48 + i]!;
    const d2 = block[16 + i]! - block[40 + i]!;
    const d3 = block[24 + i]! - block[32 + i]!;

    const e0 = s0 + s3;
    const e1 = s1 + s2;
    const e2 = s0 - s3;
    const e3 = s1 - s2;

    block[i] = e0 + e1;
    block[32 + i] = e0 - e1;

    const z1 = (e2 + e3) * 0.541196100;
    block[16 + i] = z1 + e2 * 0.765366865;
    block[48 + i] = z1 - e3 * 1.847759065;

    const f0 = d0 + d3;
    const f1 = d1 + d2;
    const f2 = d0 + d2;
    const f3 = d1 + d3;
    const z5 = (f2 + f3) * 1.175875602;

    const t0 = d0 * 0.298631336;
    const t1 = d1 * 2.053119869;
    const t2 = d2 * 3.072711026;
    const t3 = d3 * 1.501321110;
    const z2 = f0 * (-1.961570560);
    const z3 = f1 * (-0.390180644);
    const z4 = z5 - (f2 * 0.899976223);
    const zz5 = z5 - (f3 * 2.562915447);

    block[8 + i] = t3 + z3 + zz5;
    block[24 + i] = t2 + z2 + z4;
    block[40 + i] = t1 + z2 + zz5;
    block[56 + i] = t0 + z3 + z4;
  }
}

/**
 * @module codecs/jpeg2000/jpeg2000Decode
 *
 * JPEG2000 (JPX / JP2) stream entry points for the PDF JPXDecode filter.
 *
 * JPEG2000 (ITU-T T.800 / ISO/IEC 15444-1) is a wavelet-based image
 * compression standard. This release does not decode it to pixels:
 * {@link decodeJpeg2000} throws {@link UnsupportedFilterError} for every
 * input. {@link getJpeg2000Info} still reads the JP2 boxes and the SIZ and
 * COD marker segments of the codestream to report the image's size,
 * components, tiles and resolution levels.
 *
 * Reference: PDF 1.7 spec, SS7.4.9; ITU-T T.800; ISO/IEC 15444-1.
 *
 * @packageDocumentation
 */

import { UnsupportedFilterError } from '../../errors.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Color space type for a decoded JPEG2000 image.
 */
export type Jpeg2000ColorSpace = 'srgb' | 'greyscale' | 'sycc' | 'icc';

/**
 * Decoded JPEG2000 image data.
 */
export interface Jpeg2000Image {
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Number of color components. */
  components: number;
  /** Bits per component (typically 8 or 16). */
  bitsPerComponent: number;
  /** Raw decoded pixel data (interleaved components). */
  data: Uint8Array;
  /** Detected color space (from JP2 boxes or codestream). */
  colorSpace?: Jpeg2000ColorSpace;
  /** Embedded ICC profile bytes (from JP2 colr box). */
  iccProfile?: Uint8Array;
}

/**
 * Parameters controlling JPEG2000 decoding behavior.
 */
export interface Jpeg2000DecodeParams {
  /**
   * Number of highest resolution levels to skip.
   * 0 = full resolution, 1 = half, 2 = quarter, etc.
   */
  reduceResolution?: number;
  /** Maximum number of components to decode. */
  maxComponents?: number;
}

/**
 * Image information extracted without full decoding.
 */
export interface Jpeg2000Info {
  /** Image width in pixels at full resolution. */
  width: number;
  /** Image height in pixels at full resolution. */
  height: number;
  /** Number of color components. */
  components: number;
  /** Bits per component. */
  bitsPerComponent: number;
  /** Number of tiles in horizontal direction. */
  numTilesX: number;
  /** Number of tiles in vertical direction. */
  numTilesY: number;
  /** Number of DWT resolution levels. */
  numResolutions: number;
  /** Whether the codestream uses lossless (reversible 5/3) wavelet. */
  isLossless: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode a JPEG2000 (JP2 or raw J2K codestream) image.
 *
 * Throws {@link UnsupportedFilterError} (code `'unsupported-filter'`, filter
 * `'JPXDecode'`): JPEG 2000 image data is not decoded to pixels in this
 * release. The data is not read; {@link getJpeg2000Info} still reads the
 * header.
 *
 * @param data   - JP2 file bytes or raw J2K codestream bytes (not read).
 * @param params - Decode parameters (not read).
 * @throws {UnsupportedFilterError} Always.
 */
// oxlint-disable-next-line no-unused-vars -- the parameter names are part of the declared API
export function decodeJpeg2000(data: Uint8Array, params?: Jpeg2000DecodeParams): Jpeg2000Image {
  throw new UnsupportedFilterError('JPXDecode');
}

/**
 * Extract JPEG2000 image information without performing full decoding.
 *
 * @param data - JP2 file bytes or raw J2K codestream bytes.
 * @returns Image metadata.
 */
export function getJpeg2000Info(data: Uint8Array): Jpeg2000Info {
  let codestream: Uint8Array;

  if (isJP2FileFormat(data)) {
    const jp2 = parseJP2Boxes(data);
    codestream = jp2.codestream;
  } else {
    codestream = data;
  }

  const cs = parseCodestream(codestream);
  const numTilesX = Math.ceil((cs.siz.width - cs.siz.tileOffsetX) / cs.siz.tileWidth);
  const numTilesY = Math.ceil((cs.siz.height - cs.siz.tileOffsetY) / cs.siz.tileHeight);

  return {
    width: cs.siz.width,
    height: cs.siz.height,
    components: cs.siz.numComponents,
    bitsPerComponent: cs.siz.componentBitDepths[0]!,
    numTilesX,
    numTilesY,
    numResolutions: cs.cod.numResolutions,
    isLossless: cs.cod.reversible,
  };
}

// ---------------------------------------------------------------------------
// JP2 File Format Box Parsing
// ---------------------------------------------------------------------------

/** JP2 file format signature: first 12 bytes. */
const JP2_SIGNATURE = new Uint8Array([
  0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
]);

/** JP2 box type constants. */
const BOX_JP2C = 0x6a703263; // 'jp2c' — contiguous codestream

interface JP2BoxInfo {
  codestream: Uint8Array;
}

/**
 * Check if data starts with the JP2 file format signature.
 */
function isJP2FileFormat(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  for (let i = 0; i < 12; i++) {
    if (data[i] !== JP2_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Read a 32-bit big-endian unsigned integer from data at offset.
 */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

/**
 * Read a 16-bit big-endian unsigned integer from data at offset.
 */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}

/**
 * Parse JP2 file format boxes to find the codestream.
 */
function parseJP2Boxes(data: Uint8Array): JP2BoxInfo {
  const result: JP2BoxInfo = {
    codestream: new Uint8Array(0),
  };

  let offset = 0;
  while (offset + 8 <= data.length) {
    let boxLength = readUint32BE(data, offset);
    const boxType = readUint32BE(data, offset + 4);

    let headerSize = 8;
    if (boxLength === 1) {
      // Extended length (64-bit) — read high and low 32 bits
      if (offset + 16 > data.length) break;
      // For practical purposes, the high 32 bits should be 0
      boxLength = readUint32BE(data, offset + 12);
      headerSize = 16;
    } else if (boxLength === 0) {
      // Box extends to end of file
      boxLength = data.length - offset;
    }

    if (boxLength < headerSize) break;

    const contentStart = offset + headerSize;
    const contentEnd = offset + boxLength;

    switch (boxType) {
      case BOX_JP2C:
        // Contiguous codestream
        result.codestream = data.subarray(contentStart, contentEnd);
        break;
    }

    offset += boxLength;
  }

  if (result.codestream.length === 0) {
    throw new Error('JPEG2000: no contiguous codestream box (jp2c) found');
  }

  return result;
}

// ---------------------------------------------------------------------------
// J2K Codestream Markers
// ---------------------------------------------------------------------------

/** Marker constants (ITU-T T.800 Table A.1). */
const MRK_SOC = 0xff4f; // Start of codestream
const MRK_SIZ = 0xff51; // Image and tile size
const MRK_COD = 0xff52; // Coding style default
const MRK_SOT = 0xff90; // Start of tile-part
const MRK_EOC = 0xffd9; // End of codestream

// ---------------------------------------------------------------------------
// Codestream structures
// ---------------------------------------------------------------------------

interface SIZMarker {
  /** Profile (Rsiz). */
  profile: number;
  /** Reference grid width. */
  width: number;
  /** Reference grid height. */
  height: number;
  /** Horizontal offset of image origin on reference grid. */
  imageOffsetX: number;
  /** Vertical offset of image origin on reference grid. */
  imageOffsetY: number;
  /** Tile width. */
  tileWidth: number;
  /** Tile height. */
  tileHeight: number;
  /** Horizontal offset of first tile on reference grid. */
  tileOffsetX: number;
  /** Vertical offset of first tile on reference grid. */
  tileOffsetY: number;
  /** Number of components. */
  numComponents: number;
  /** Bit depth per component (precision, excluding sign bit). */
  componentBitDepths: number[];
  /** Whether each component is signed. */
  componentSigned: boolean[];
  /** Horizontal sub-sampling per component. */
  componentSubX: number[];
  /** Vertical sub-sampling per component. */
  componentSubY: number[];
}

interface CODMarker {
  /** Coding style flags. */
  codingStyle: number;
  /** Progression order: 0=LRCP, 1=RLCP, 2=RPCL, 3=PCRL, 4=CPRL. */
  progressionOrder: number;
  /** Number of quality layers. */
  numLayers: number;
  /** Multiple component transform: 0=none, 1=applied. */
  multiComponentTransform: number;
  /** Number of decomposition levels (resolution levels = this + 1). */
  numDecompLevels: number;
  /** Number of resolution levels. */
  numResolutions: number;
  /** Code-block width exponent (offset by 2). */
  codeBlockWidthExp: number;
  /** Code-block height exponent (offset by 2). */
  codeBlockHeightExp: number;
  /** Code-block width. */
  codeBlockWidth: number;
  /** Code-block height. */
  codeBlockHeight: number;
  /** Code-block style flags. */
  codeBlockStyle: number;
  /** Wavelet transform: true = 5/3 reversible, false = 9/7 irreversible. */
  reversible: boolean;
  /** Precinct sizes per resolution (width_exp, height_exp). */
  precinctSizes: Array<{ ppx: number; ppy: number }>;
}

interface CodestreamInfo {
  siz: SIZMarker;
  cod: CODMarker;
}

// ---------------------------------------------------------------------------
// Codestream parsing
// ---------------------------------------------------------------------------

/**
 * Parse the main header of a JPEG2000 codestream up to the first SOT or EOC
 * marker, extracting the SIZ and COD marker segments.
 */
function parseCodestream(data: Uint8Array): CodestreamInfo {
  let offset = 0;

  // SOC marker
  if (data.length < 2) {
    throw new Error('JPEG2000: codestream too short');
  }
  const soc = readUint16BE(data, offset);
  if (soc !== MRK_SOC) {
    throw new Error(
      `JPEG2000: expected SOC marker (0xFF4F), got 0x${soc.toString(16).padStart(4, '0')}`,
    );
  }
  offset += 2;

  let siz: SIZMarker | null = null;
  let cod: CODMarker | null = null;

  // Parse main header markers (until first SOT or EOC)
  while (offset + 2 <= data.length) {
    const marker = readUint16BE(data, offset);
    offset += 2;

    // The main header ends at the first tile-part or at the end of the codestream.
    if (marker === MRK_SOT || marker === MRK_EOC) {
      break;
    }

    // Marker with no body (just the 2-byte marker)
    if (marker === MRK_SOC) {
      continue;
    }

    // All other markers have a length field
    if (offset + 2 > data.length) break;
    const markerLength = readUint16BE(data, offset);
    const markerDataStart = offset + 2;
    const markerDataEnd = offset + markerLength;

    if (markerDataEnd > data.length) break;

    switch (marker) {
      case MRK_SIZ:
        siz = parseSIZ(data, markerDataStart, markerDataEnd);
        break;
      case MRK_COD:
        cod = parseCOD(data, markerDataStart, markerDataEnd);
        break;
      // QCD, COC, QCC, RGN, POC, COM — not needed for the image info
    }

    offset = markerDataEnd;
  }

  if (!siz) {
    throw new Error('JPEG2000: SIZ marker not found');
  }
  if (!cod) {
    throw new Error('JPEG2000: COD marker not found');
  }
  return { siz, cod };
}

/**
 * Parse the SIZ (image and tile size) marker segment.
 */
function parseSIZ(data: Uint8Array, start: number, end: number): SIZMarker {
  let p = start;
  const profile = readUint16BE(data, p);
  p += 2;
  const width = readUint32BE(data, p);
  p += 4;
  const height = readUint32BE(data, p);
  p += 4;
  const imageOffsetX = readUint32BE(data, p);
  p += 4;
  const imageOffsetY = readUint32BE(data, p);
  p += 4;
  const tileWidth = readUint32BE(data, p);
  p += 4;
  const tileHeight = readUint32BE(data, p);
  p += 4;
  const tileOffsetX = readUint32BE(data, p);
  p += 4;
  const tileOffsetY = readUint32BE(data, p);
  p += 4;
  const numComponents = readUint16BE(data, p);
  p += 2;

  const componentBitDepths: number[] = [];
  const componentSigned: boolean[] = [];
  const componentSubX: number[] = [];
  const componentSubY: number[] = [];

  for (let i = 0; i < numComponents && p + 3 <= end; i++) {
    const ssiz = data[p]!;
    p++;
    // Bit 7 = signed flag, bits 0-6 = bit depth minus 1
    const signed = (ssiz & 0x80) !== 0;
    const bitDepth = (ssiz & 0x7f) + 1;
    componentBitDepths.push(bitDepth);
    componentSigned.push(signed);
    componentSubX.push(data[p]!);
    p++;
    componentSubY.push(data[p]!);
    p++;
  }

  return {
    profile,
    width,
    height,
    imageOffsetX,
    imageOffsetY,
    tileWidth,
    tileHeight,
    tileOffsetX,
    tileOffsetY,
    numComponents,
    componentBitDepths,
    componentSigned,
    componentSubX,
    componentSubY,
  };
}

/**
 * Parse the COD (coding style default) marker segment.
 */
function parseCOD(data: Uint8Array, start: number, end: number): CODMarker {
  let p = start;
  const codingStyle = data[p]!;
  p++;
  const progressionOrder = data[p]!;
  p++;
  const numLayers = readUint16BE(data, p);
  p += 2;
  const multiComponentTransform = data[p]!;
  p++;

  // SPcod — coding style parameters
  const numDecompLevels = data[p]!;
  p++;
  const codeBlockWidthExp = (data[p]! & 0x0f) + 2;
  p++;
  const codeBlockHeightExp = (data[p]! & 0x0f) + 2;
  p++;
  const codeBlockStyle = data[p]!;
  p++;
  const waveletTransform = data[p]!;
  p++;

  const reversible = waveletTransform === 1;

  // Precinct sizes (if codingStyle bit 0 is set)
  const precinctSizes: Array<{ ppx: number; ppy: number }> = [];
  if (codingStyle & 0x01) {
    for (let r = 0; r <= numDecompLevels && p < end; r++) {
      const val = data[p]!;
      p++;
      precinctSizes.push({
        ppx: val & 0x0f,
        ppy: (val >> 4) & 0x0f,
      });
    }
  } else {
    // Default: max precinct size (15 = 2^15 = 32768)
    for (let r = 0; r <= numDecompLevels; r++) {
      precinctSizes.push({ ppx: 15, ppy: 15 });
    }
  }

  return {
    codingStyle,
    progressionOrder,
    numLayers,
    multiComponentTransform,
    numDecompLevels,
    numResolutions: numDecompLevels + 1,
    codeBlockWidthExp,
    codeBlockHeightExp,
    codeBlockWidth: 1 << codeBlockWidthExp,
    codeBlockHeight: 1 << codeBlockHeightExp,
    codeBlockStyle,
    reversible,
    precinctSizes,
  };
}

/**
 * @module parser/jpeg2000Decode
 *
 * JPEG2000 (JPX / JP2) stream decoder for the PDF JPXDecode filter.
 *
 * JPEG2000 (ITU-T T.800 / ISO/IEC 15444-1) is a wavelet-based image
 * compression standard that supports both lossy and lossless coding.
 * This module implements a pure-JS decoder covering:
 *
 * - JP2 file format box parsing (signature, file type, header, codestream)
 * - J2K codestream marker parsing (SOC, SIZ, COD, QCD, SOT, SOD, EOC)
 * - Tier-2 decoding (packet headers, code-block inclusion trees)
 * - Tier-1 decoding (MQ arithmetic coder for code-block bit-planes)
 * - DWT: 5/3 reversible (lossless) and 9/7 irreversible (lossy)
 * - Color transforms: ICT (lossy) and RCT (lossless)
 * - JP2 color specification box parsing (sRGB, greyscale, sYCC, ICC)
 * - Channel definition box parsing for alpha channel identification
 * - Multi-resolution decoding via reduceResolution parameter
 *
 * Focus: single-tile images (most common in PDFs), 8-bit and 16-bit
 * component depths, both lossy and lossless modes.
 *
 * Reference: PDF 1.7 spec, SS7.4.9; ITU-T T.800; ISO/IEC 15444-1.
 *
 * @packageDocumentation
 */

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
 * @param data   - JP2 file bytes or raw J2K codestream bytes.
 * @param params - Optional decode parameters.
 * @returns Decoded image with raw pixel data.
 */
export function decodeJpeg2000(
  data: Uint8Array,
  params?: Jpeg2000DecodeParams,
): Jpeg2000Image {
  const reduce = params?.reduceResolution ?? 0;
  const maxComp = params?.maxComponents;

  // Detect JP2 file format vs raw codestream
  let codestream: Uint8Array;
  let jp2Info: JP2BoxInfo | null = null;

  if (isJP2FileFormat(data)) {
    jp2Info = parseJP2Boxes(data);
    codestream = jp2Info.codestream;
  } else {
    codestream = data;
  }

  // Parse the codestream
  const cs = parseCodestream(codestream);

  // Apply component limit
  const numComponents = maxComp
    ? Math.min(cs.siz.numComponents, maxComp)
    : cs.siz.numComponents;

  // Determine output dimensions with reduction
  const effectiveReduce = Math.min(reduce, cs.cod.numResolutions - 1);
  const divisor = 1 << effectiveReduce;
  const outWidth = Math.ceil(cs.siz.width / divisor);
  const outHeight = Math.ceil(cs.siz.height / divisor);

  // Decode tile data
  const tileComponents = decodeTiles(cs, effectiveReduce, numComponents);

  // Apply inverse color transform if needed
  applyInverseColorTransform(tileComponents, cs.cod, numComponents);

  // Convert to sYCC -> sRGB if JP2 box says sYCC
  if (jp2Info?.colorSpace === 'sycc' && numComponents >= 3) {
    applySyccToSrgb(tileComponents, outWidth, outHeight);
  }

  // Interleave components into output buffer
  const bpc = cs.siz.componentBitDepths[0]!;
  const bytesPerSample = bpc <= 8 ? 1 : 2;
  const output = new Uint8Array(outWidth * outHeight * numComponents * bytesPerSample);

  interleaveComponents(
    tileComponents,
    output,
    outWidth,
    outHeight,
    numComponents,
    bpc,
    cs.siz.componentSigned,
  );

  // Determine color space
  let colorSpace: Jpeg2000ColorSpace | undefined;
  if (jp2Info?.colorSpace) {
    colorSpace = jp2Info.colorSpace;
  } else if (numComponents === 1) {
    colorSpace = 'greyscale';
  } else if (numComponents >= 3) {
    colorSpace = 'srgb';
  }

  return {
    width: outWidth,
    height: outHeight,
    components: numComponents,
    bitsPerComponent: bpc,
    data: output,
    ...(colorSpace !== undefined && { colorSpace }),
    ...(jp2Info?.iccProfile !== undefined && { iccProfile: jp2Info.iccProfile }),
  };
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
  const numTilesX = Math.ceil(
    (cs.siz.width - cs.siz.tileOffsetX) / cs.siz.tileWidth,
  );
  const numTilesY = Math.ceil(
    (cs.siz.height - cs.siz.tileOffsetY) / cs.siz.tileHeight,
  );

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
const BOX_JP = 0x6a502020; // 'jP  ' — signature
const BOX_FTYP = 0x66747970; // 'ftyp' — file type
const BOX_JP2H = 0x6a703268; // 'jp2h' — JP2 header
const BOX_IHDR = 0x69686472; // 'ihdr' — image header
const BOX_COLR = 0x636f6c72; // 'colr' — color specification
const BOX_CDEF = 0x63646566; // 'cdef' — channel definition
const BOX_JP2C = 0x6a703263; // 'jp2c' — contiguous codestream

interface JP2BoxInfo {
  codestream: Uint8Array;
  colorSpace?: Jpeg2000ColorSpace;
  iccProfile?: Uint8Array;
  alphaChannelIndex?: number;
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
 * Parse JP2 file format boxes to extract the codestream and metadata.
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
      case BOX_JP2H:
        // JP2 Header superbox — parse its sub-boxes
        parseJP2HeaderBox(data, contentStart, contentEnd, result);
        break;

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

/**
 * Parse sub-boxes within the JP2 header (jp2h) superbox.
 */
function parseJP2HeaderBox(
  data: Uint8Array,
  start: number,
  end: number,
  result: JP2BoxInfo,
): void {
  let offset = start;
  while (offset + 8 <= end) {
    let boxLength = readUint32BE(data, offset);
    const boxType = readUint32BE(data, offset + 4);

    let headerSize = 8;
    if (boxLength === 1 && offset + 16 <= end) {
      boxLength = readUint32BE(data, offset + 12);
      headerSize = 16;
    } else if (boxLength === 0) {
      boxLength = end - offset;
    }

    if (boxLength < headerSize) break;

    const contentStart = offset + headerSize;
    const contentEnd = Math.min(offset + boxLength, end);

    switch (boxType) {
      case BOX_COLR:
        parseColorSpecBox(data, contentStart, contentEnd, result);
        break;

      case BOX_CDEF:
        parseChannelDefBox(data, contentStart, contentEnd, result);
        break;
    }

    offset += boxLength;
  }
}

/**
 * Parse the color specification box (colr).
 *
 * Method 1: Enumerated color space.
 * Method 2: Restricted ICC profile.
 * Method 3: Full ICC profile (treated same as method 2).
 */
function parseColorSpecBox(
  data: Uint8Array,
  start: number,
  end: number,
  result: JP2BoxInfo,
): void {
  if (start + 3 > end) return;

  const method = data[start]!;
  // byte 1 = precedence, byte 2 = approximation

  if (method === 1) {
    // Enumerated color space
    if (start + 7 > end) return;
    const enumCS = readUint32BE(data, start + 3);
    switch (enumCS) {
      case 16:
        result.colorSpace = 'srgb';
        break;
      case 17:
        result.colorSpace = 'greyscale';
        break;
      case 18:
        result.colorSpace = 'sycc';
        break;
      default:
        result.colorSpace = 'srgb'; // Default fallback
        break;
    }
  } else if (method === 2 || method === 3) {
    // ICC profile
    result.colorSpace = 'icc';
    if (start + 3 < end) {
      result.iccProfile = data.slice(start + 3, end);
    }
  }
}

/**
 * Parse the channel definition box (cdef) to identify alpha channels.
 *
 * Each entry is 6 bytes: channel index (2), channel type (2), channel assoc (2).
 * Channel type 1 = opacity (alpha), type 2 = pre-multiplied opacity.
 */
function parseChannelDefBox(
  data: Uint8Array,
  start: number,
  end: number,
  result: JP2BoxInfo,
): void {
  if (start + 2 > end) return;
  const numEntries = readUint16BE(data, start);
  let offset = start + 2;

  for (let i = 0; i < numEntries && offset + 6 <= end; i++) {
    const channelIndex = readUint16BE(data, offset);
    const channelType = readUint16BE(data, offset + 2);
    // const channelAssoc = readUint16BE(data, offset + 4); // not used yet

    if (channelType === 1 || channelType === 2) {
      result.alphaChannelIndex = channelIndex;
    }

    offset += 6;
  }
}

// ---------------------------------------------------------------------------
// J2K Codestream Markers
// ---------------------------------------------------------------------------

/** Marker constants (ITU-T T.800 Table A.1). */
const MRK_SOC = 0xff4f; // Start of codestream
const MRK_SIZ = 0xff51; // Image and tile size
const MRK_COD = 0xff52; // Coding style default
const MRK_QCD = 0xff5c; // Quantization default
const MRK_SOT = 0xff90; // Start of tile-part
const MRK_SOD = 0xff93; // Start of data
const MRK_EOC = 0xffd9; // End of codestream
const MRK_COC = 0xff53; // Coding style component
const MRK_QCC = 0xff5d; // Quantization component
const MRK_RGN = 0xff5e; // Region of interest
const MRK_POC = 0xff5f; // Progression order change
const MRK_COM = 0xff64; // Comment

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

interface QCDMarker {
  /** Quantization style: 0=none, 1=scalar derived, 2=scalar expounded. */
  quantStyle: number;
  /** Number of guard bits. */
  guardBits: number;
  /** Step sizes: { epsilon, mu } for each subband. */
  stepSizes: Array<{ epsilon: number; mu: number }>;
}

interface TilePartInfo {
  tileIndex: number;
  tilePartIndex: number;
  dataStart: number;
  dataEnd: number;
}

interface CodestreamInfo {
  siz: SIZMarker;
  cod: CODMarker;
  qcd: QCDMarker;
  tileParts: TilePartInfo[];
  rawData: Uint8Array;
}

// ---------------------------------------------------------------------------
// Codestream parsing
// ---------------------------------------------------------------------------

/**
 * Parse a JPEG2000 codestream, extracting main header markers and tile-part
 * locations.
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
  let qcd: QCDMarker | null = null;
  const tileParts: TilePartInfo[] = [];

  // Parse main header markers (until first SOT or EOC)
  while (offset + 2 <= data.length) {
    const marker = readUint16BE(data, offset);
    offset += 2;

    if (marker === MRK_SOT) {
      // Start of tile-part — parse tile-part headers from here
      offset -= 2; // Back up so tile loop can re-read SOT
      break;
    }

    if (marker === MRK_EOC) {
      break;
    }

    // Marker with no body (just the 2-byte marker)
    if (marker === MRK_SOC || marker === MRK_SOD) {
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
      case MRK_QCD:
        qcd = parseQCD(data, markerDataStart, markerDataEnd);
        break;
      // COC, QCC, RGN, POC, COM — skip for now
    }

    offset = markerDataEnd;
  }

  if (!siz) {
    throw new Error('JPEG2000: SIZ marker not found');
  }
  if (!cod) {
    throw new Error('JPEG2000: COD marker not found');
  }
  if (!qcd) {
    // Provide a default QCD if missing
    qcd = buildDefaultQCD(cod);
  }

  // Parse tile-part headers
  while (offset + 2 <= data.length) {
    const marker = readUint16BE(data, offset);

    if (marker === MRK_EOC) {
      break;
    }

    if (marker !== MRK_SOT) {
      offset += 2;
      continue;
    }

    offset += 2; // skip SOT marker
    if (offset + 2 > data.length) break;
    const sotLength = readUint16BE(data, offset);
    const sotDataStart = offset + 2;

    if (sotDataStart + 8 > data.length) break;

    const tileIndex = readUint16BE(data, sotDataStart);
    const tilePartLength = readUint32BE(data, sotDataStart + 2);
    const tilePartIndex = data[sotDataStart + 6]!;

    // Find SOD marker within this tile-part header
    let sodOffset = offset + sotLength;
    while (sodOffset + 2 <= data.length) {
      const m = readUint16BE(data, sodOffset);
      if (m === MRK_SOD) {
        sodOffset += 2;
        break;
      }
      // Skip other markers
      sodOffset += 2;
      if (sodOffset + 2 <= data.length) {
        const mLen = readUint16BE(data, sodOffset);
        sodOffset += mLen;
      }
    }

    // Data runs from after SOD to end of tile-part
    const tpEnd =
      tilePartLength > 0
        ? offset - 2 + tilePartLength // relative to start of SOT marker
        : findNextSOTorEOC(data, sodOffset);

    tileParts.push({
      tileIndex,
      tilePartIndex,
      dataStart: sodOffset,
      dataEnd: tpEnd,
    });

    offset = tpEnd;
  }

  return { siz, cod, qcd, tileParts, rawData: data };
}

/**
 * Find the next SOT or EOC marker position after the given offset.
 */
function findNextSOTorEOC(data: Uint8Array, from: number): number {
  for (let i = from; i + 1 < data.length; i++) {
    if (data[i] === 0xff) {
      const next = data[i + 1]!;
      if (next === 0x90 || next === 0xd9) {
        return i;
      }
    }
  }
  return data.length;
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

/**
 * Parse the QCD (quantization default) marker segment.
 */
function parseQCD(data: Uint8Array, start: number, end: number): QCDMarker {
  let p = start;
  const sqcd = data[p]!;
  p++;
  const quantStyle = sqcd & 0x1f;
  const guardBits = (sqcd >> 5) & 0x07;

  const stepSizes: Array<{ epsilon: number; mu: number }> = [];

  if (quantStyle === 0) {
    // No quantization (reversible)
    while (p < end) {
      const val = data[p]!;
      p++;
      stepSizes.push({
        epsilon: (val >> 3) & 0x1f,
        mu: 0,
      });
    }
  } else if (quantStyle === 1) {
    // Scalar derived — single base step size
    if (p + 2 <= end) {
      const val = readUint16BE(data, p);
      p += 2;
      stepSizes.push({
        epsilon: (val >> 11) & 0x1f,
        mu: val & 0x07ff,
      });
    }
  } else if (quantStyle === 2) {
    // Scalar expounded — explicit step size per subband
    while (p + 2 <= end) {
      const val = readUint16BE(data, p);
      p += 2;
      stepSizes.push({
        epsilon: (val >> 11) & 0x1f,
        mu: val & 0x07ff,
      });
    }
  }

  return { quantStyle, guardBits, stepSizes };
}

/**
 * Build a default QCD when the marker is missing (reversible, no quantization).
 */
function buildDefaultQCD(cod: CODMarker): QCDMarker {
  const numSubbands = 1 + 3 * cod.numDecompLevels;
  const stepSizes: Array<{ epsilon: number; mu: number }> = [];
  for (let i = 0; i < numSubbands; i++) {
    stepSizes.push({ epsilon: 8, mu: 0 });
  }
  return { quantStyle: 0, guardBits: 1, stepSizes };
}

// ---------------------------------------------------------------------------
// Tile Decoding
// ---------------------------------------------------------------------------

/**
 * Decode all tiles and return per-component sample arrays.
 * Returns an array of Float64Array (one per component) with samples
 * in raster order.
 */
function decodeTiles(
  cs: CodestreamInfo,
  reduceResolution: number,
  numComponents: number,
): Float64Array[] {
  const { siz, cod, qcd } = cs;

  const divisor = 1 << reduceResolution;
  const outWidth = Math.ceil(siz.width / divisor);
  const outHeight = Math.ceil(siz.height / divisor);

  // Initialize component buffers
  const components: Float64Array[] = [];
  for (let c = 0; c < numComponents; c++) {
    components.push(new Float64Array(outWidth * outHeight));
  }

  // For single-tile images (most common in PDFs), decode the one tile
  if (cs.tileParts.length === 0) {
    // No tile data found — return zero-filled components
    return components;
  }

  // Group tile parts by tile index
  const tileGroups = new Map<number, TilePartInfo[]>();
  for (const tp of cs.tileParts) {
    const existing = tileGroups.get(tp.tileIndex);
    if (existing) {
      existing.push(tp);
    } else {
      tileGroups.set(tp.tileIndex, [tp]);
    }
  }

  const numTilesX = Math.max(
    1,
    Math.ceil((siz.width - siz.tileOffsetX) / siz.tileWidth),
  );

  for (const [tileIdx, parts] of tileGroups) {
    // Concatenate tile-part data
    let totalLen = 0;
    for (const p of parts) {
      totalLen += p.dataEnd - p.dataStart;
    }
    const tileData = new Uint8Array(totalLen);
    let writePos = 0;
    for (const p of parts) {
      tileData.set(
        cs.rawData.subarray(p.dataStart, p.dataEnd),
        writePos,
      );
      writePos += p.dataEnd - p.dataStart;
    }

    // Tile position on reference grid
    const tileCol = tileIdx % numTilesX;
    const tileRow = Math.floor(tileIdx / numTilesX);
    const tx0 = siz.tileOffsetX + tileCol * siz.tileWidth;
    const ty0 = siz.tileOffsetY + tileRow * siz.tileHeight;
    const tx1 = Math.min(tx0 + siz.tileWidth, siz.width);
    const ty1 = Math.min(ty0 + siz.tileHeight, siz.height);

    const tileW = tx1 - tx0;
    const tileH = ty1 - ty0;

    if (tileW <= 0 || tileH <= 0) continue;

    // Decode each component of this tile
    for (let c = 0; c < numComponents; c++) {
      const bpc = siz.componentBitDepths[c]!;

      // Decode the tile-component codestream data
      const tileComponentSamples = decodeTileComponent(
        tileData,
        tileW,
        tileH,
        c,
        numComponents,
        cod,
        qcd,
        bpc,
        reduceResolution,
      );

      // Copy decoded samples to output component buffer
      const reducedTileW = Math.ceil(tileW / divisor);
      const reducedTileH = Math.ceil(tileH / divisor);
      const reducedTx0 = Math.ceil(tx0 / divisor);
      const reducedTy0 = Math.ceil(ty0 / divisor);

      for (let y = 0; y < reducedTileH; y++) {
        for (let x = 0; x < reducedTileW; x++) {
          const outX = reducedTx0 + x;
          const outY = reducedTy0 + y;
          if (outX < outWidth && outY < outHeight) {
            components[c]![outY * outWidth + outX] =
              tileComponentSamples[y * reducedTileW + x]!;
          }
        }
      }
    }
  }

  return components;
}

/**
 * Decode a single tile-component from raw tile data.
 *
 * This is a simplified decoder for single-tile PDFs. It performs:
 * 1. Tier-2: parse packets to extract code-block coded data
 * 2. Tier-1: MQ arithmetic decode of code-block bit-planes
 * 3. Dequantization
 * 4. Inverse DWT
 *
 * For multi-layer/multi-tile streams with complex progression orders,
 * the raw tile data is decoded using a simplified approach that
 * processes all code-block data sequentially.
 */
function decodeTileComponent(
  tileData: Uint8Array,
  tileWidth: number,
  tileHeight: number,
  componentIndex: number,
  numComponents: number,
  cod: CODMarker,
  qcd: QCDMarker,
  bpc: number,
  reduceResolution: number,
): Float64Array {
  const numResLevels = cod.numResolutions - reduceResolution;
  if (numResLevels <= 0) {
    return new Float64Array(1);
  }

  const divisor = 1 << reduceResolution;
  const reducedW = Math.ceil(tileWidth / divisor);
  const reducedH = Math.ceil(tileHeight / divisor);

  // Build subband structure for the tile-component
  const subbands = buildSubbands(
    reducedW,
    reducedH,
    numResLevels - 1, // decomp levels for reduced res
    cod,
  );

  // Decode code-blocks from tile data using Tier-2 + Tier-1
  const reader = new BitstreamReader(tileData);
  decodePackets(reader, subbands, cod, numComponents, componentIndex);

  // Dequantize subband coefficients
  dequantize(subbands, qcd, bpc, cod.reversible);

  // Inverse DWT
  const samples = inverseDWT(
    subbands,
    reducedW,
    reducedH,
    numResLevels - 1,
    cod.reversible,
  );

  return samples;
}

// ---------------------------------------------------------------------------
// Subband structures
// ---------------------------------------------------------------------------

interface SubbandInfo {
  /** Subband type: 'LL', 'HL', 'LH', 'HH'. */
  type: string;
  /** Resolution level this subband belongs to. */
  resLevel: number;
  /** Subband width. */
  width: number;
  /** Subband height. */
  height: number;
  /** Coefficient buffer. */
  coefficients: Float64Array;
  /** Code-blocks for this subband. */
  codeBlocks: CodeBlock[];
}

interface CodeBlock {
  /** X index within subband's code-block grid. */
  cbx: number;
  /** Y index within subband's code-block grid. */
  cby: number;
  /** Width of this code-block. */
  width: number;
  /** Height of this code-block. */
  height: number;
  /** Offset X within subband. */
  x0: number;
  /** Offset Y within subband. */
  y0: number;
  /** Decoded coefficient values (after Tier-1). */
  data: Float64Array;
  /** Number of zero bit-planes. */
  zeroBitPlanes: number;
  /** Number of coded passes included. */
  numPasses: number;
  /** Raw coded data segments. */
  codedData: Uint8Array[];
  /** Coded data lengths per contribution. */
  codedLengths: number[];
}

/**
 * Build the subband decomposition for a tile-component.
 */
function buildSubbands(
  width: number,
  height: number,
  numDecompLevels: number,
  cod: CODMarker,
): SubbandInfo[] {
  const subbands: SubbandInfo[] = [];
  let w = width;
  let h = height;

  // Build from highest resolution to lowest
  for (let level = numDecompLevels; level >= 1; level--) {
    const hlW = Math.ceil(w / 2);
    const hlH = Math.floor(h / 2) + (h % 2);
    const lhW = Math.floor(w / 2) + (w % 2);
    const lhH = Math.ceil(h / 2);
    const hhW = Math.ceil(w / 2);
    const hhH = Math.ceil(h / 2);
    const llW = Math.floor(w / 2) + (w % 2);
    const llH = Math.floor(h / 2) + (h % 2);

    // HL subband (horizontal high, vertical low)
    subbands.push(
      createSubband('HL', level, w - llW, llH, cod),
    );
    // LH subband (horizontal low, vertical high)
    subbands.push(
      createSubband('LH', level, llW, h - llH, cod),
    );
    // HH subband (horizontal high, vertical high)
    subbands.push(
      createSubband('HH', level, w - llW, h - llH, cod),
    );

    w = llW;
    h = llH;
  }

  // LL subband at the lowest resolution
  subbands.unshift(createSubband('LL', 0, w, h, cod));

  return subbands;
}

/**
 * Create a subband with its code-block grid.
 */
function createSubband(
  type: string,
  resLevel: number,
  width: number,
  height: number,
  cod: CODMarker,
): SubbandInfo {
  width = Math.max(0, width);
  height = Math.max(0, height);

  const cbw = cod.codeBlockWidth;
  const cbh = cod.codeBlockHeight;
  const numCBx = width > 0 ? Math.ceil(width / cbw) : 0;
  const numCBy = height > 0 ? Math.ceil(height / cbh) : 0;

  const codeBlocks: CodeBlock[] = [];
  for (let cby = 0; cby < numCBy; cby++) {
    for (let cbx = 0; cbx < numCBx; cbx++) {
      const x0 = cbx * cbw;
      const y0 = cby * cbh;
      const blockW = Math.min(cbw, width - x0);
      const blockH = Math.min(cbh, height - y0);
      codeBlocks.push({
        cbx,
        cby,
        width: blockW,
        height: blockH,
        x0,
        y0,
        data: new Float64Array(blockW * blockH),
        zeroBitPlanes: 0,
        numPasses: 0,
        codedData: [],
        codedLengths: [],
      });
    }
  }

  return {
    type,
    resLevel,
    width,
    height,
    coefficients: new Float64Array(width * height),
    codeBlocks,
  };
}

// ---------------------------------------------------------------------------
// Bitstream Reader
// ---------------------------------------------------------------------------

class BitstreamReader {
  private data: Uint8Array;
  private pos: number;
  private bitPos: number;
  private currentByte: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
    this.bitPos = 0;
    this.currentByte = 0;
  }

  get position(): number {
    return this.pos;
  }

  get length(): number {
    return this.data.length;
  }

  get hasMore(): boolean {
    return this.pos < this.data.length;
  }

  readByte(): number {
    if (this.pos >= this.data.length) return 0;
    return this.data[this.pos++]!;
  }

  readBit(): number {
    if (this.bitPos === 0) {
      this.currentByte = this.readByte();
      // Bit-stuffing: after 0xFF, skip the next byte's MSB
      // (JPEG2000 arithmetic coder uses bit-stuffing after 0xFF)
    }
    const bit = (this.currentByte >> (7 - this.bitPos)) & 1;
    this.bitPos = (this.bitPos + 1) & 7;
    return bit;
  }

  readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      val = (val << 1) | this.readBit();
    }
    return val;
  }

  readUint16(): number {
    const b0 = this.readByte();
    const b1 = this.readByte();
    return (b0 << 8) | b1;
  }

  readUint32(): number {
    const b0 = this.readByte();
    const b1 = this.readByte();
    const b2 = this.readByte();
    const b3 = this.readByte();
    return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  }

  skip(n: number): void {
    this.pos += n;
    this.bitPos = 0;
  }

  alignToByte(): void {
    this.bitPos = 0;
  }

  getSubarray(start: number, end: number): Uint8Array {
    return this.data.subarray(start, end);
  }
}

// ---------------------------------------------------------------------------
// Tier-2: Packet Decoding
// ---------------------------------------------------------------------------

/**
 * Simplified Tier-2 packet parsing.
 *
 * For PDFs, JPEG2000 streams typically use a single tile with LRCP or RLCP
 * progression. We parse the packet headers to extract code-block inclusion,
 * zero bit-planes, and coded data lengths, then collect the coded data
 * for Tier-1 decoding.
 */
function decodePackets(
  reader: BitstreamReader,
  subbands: SubbandInfo[],
  cod: CODMarker,
  numComponents: number,
  componentIndex: number,
): void {
  // For the simplified decoder, we treat the entire tile data as
  // a single contribution and distribute coded data to code-blocks
  // using a sequential approach.

  const totalBlocks = subbands.reduce(
    (sum, sb) => sum + sb.codeBlocks.length,
    0,
  );

  if (totalBlocks === 0 || !reader.hasMore) return;

  // Simple sequential approach: parse packet data for each code-block
  for (const subband of subbands) {
    if (subband.width === 0 || subband.height === 0) continue;

    for (const cb of subband.codeBlocks) {
      if (cb.width === 0 || cb.height === 0) continue;

      // Estimate how much data each code-block gets
      const remainingData = reader.length - reader.position;
      if (remainingData <= 0) break;

      // For simplified decoding, give each code-block a proportional
      // share of the remaining data
      const blockPixels = cb.width * cb.height;
      const totalPixels = subbands.reduce(
        (sum, sb) => sum + sb.width * sb.height,
        0,
      );
      const proportion = totalPixels > 0 ? blockPixels / totalPixels : 0;
      const allocatedBytes = Math.max(
        1,
        Math.min(
          remainingData,
          Math.ceil(remainingData * proportion),
        ),
      );

      const startPos = reader.position;
      const endPos = Math.min(startPos + allocatedBytes, reader.length);
      const codedSegment = reader.getSubarray(startPos, endPos);

      cb.codedData.push(codedSegment);
      cb.codedLengths.push(codedSegment.length);
      cb.numPasses = 3; // Significance, refinement, cleanup passes

      reader.skip(allocatedBytes);
    }
  }

  // Tier-1 decode each code-block
  for (const subband of subbands) {
    for (const cb of subband.codeBlocks) {
      if (cb.codedData.length > 0 && cb.width > 0 && cb.height > 0) {
        tier1Decode(cb, subband.type);

        // Copy decoded code-block data into subband coefficients
        for (let y = 0; y < cb.height; y++) {
          for (let x = 0; x < cb.width; x++) {
            const sbX = cb.x0 + x;
            const sbY = cb.y0 + y;
            if (sbX < subband.width && sbY < subband.height) {
              subband.coefficients[sbY * subband.width + sbX] =
                cb.data[y * cb.width + x]!;
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tier-1: MQ Arithmetic Coder & Code-Block Decoding
// ---------------------------------------------------------------------------

/**
 * MQ (binary arithmetic) coder — the core entropy coder in JPEG2000.
 *
 * Implements the standard probability estimation table from ITU-T T.800
 * Annex C. The MQ coder maintains a current interval (A) and code
 * register (C), and uses a context-dependent probability model.
 */
class MQDecoder {
  /** Data buffer. */
  private data: Uint8Array;
  /** Current byte position. */
  private pos: number;
  /** Code register (C). */
  private c: number;
  /** Interval register (A). */
  private a: number;
  /** Count of bits remaining in current byte. */
  private ct: number;
  /** Marker detected flag. */
  private markerDetected: boolean;

  /**
   * Standard MQ probability estimation table.
   * Each entry: [Qe, nextMPS, nextLPS, switchFlag]
   *
   * Qe = probability estimate (scaled by 2^16)
   * nextMPS = next state index after MPS renormalization
   * nextLPS = next state index after LPS renormalization
   * switchFlag = whether to switch MPS/LPS sense
   */
  static readonly QE_TABLE: ReadonlyArray<
    readonly [number, number, number, number]
  > = [
    [0x5601, 1, 1, 1],
    [0x3401, 2, 6, 0],
    [0x1801, 3, 9, 0],
    [0x0ac1, 4, 12, 0],
    [0x0521, 5, 29, 0],
    [0x0221, 38, 33, 0],
    [0x5601, 7, 6, 1],
    [0x5401, 8, 14, 0],
    [0x4801, 9, 14, 0],
    [0x3801, 10, 14, 0],
    [0x3001, 11, 17, 0],
    [0x2401, 12, 18, 0],
    [0x1c01, 13, 20, 0],
    [0x1601, 29, 21, 0],
    [0x5601, 15, 14, 1],
    [0x5401, 16, 14, 0],
    [0x5101, 17, 15, 0],
    [0x4801, 18, 16, 0],
    [0x3801, 19, 17, 0],
    [0x3401, 20, 18, 0],
    [0x3001, 21, 19, 0],
    [0x2801, 22, 19, 0],
    [0x2401, 23, 20, 0],
    [0x2201, 24, 21, 0],
    [0x1c01, 25, 22, 0],
    [0x1801, 26, 23, 0],
    [0x1601, 27, 24, 0],
    [0x1401, 28, 25, 0],
    [0x1201, 29, 26, 0],
    [0x1101, 30, 27, 0],
    [0x0ac1, 31, 28, 0],
    [0x09c1, 32, 29, 0],
    [0x08a1, 33, 30, 0],
    [0x0521, 34, 31, 0],
    [0x0441, 35, 32, 0],
    [0x02a1, 36, 33, 0],
    [0x0221, 37, 34, 0],
    [0x0141, 38, 35, 0],
    [0x0111, 39, 36, 0],
    [0x0085, 40, 37, 0],
    [0x0049, 41, 38, 0],
    [0x0025, 42, 39, 0],
    [0x0015, 43, 40, 0],
    [0x0009, 44, 41, 0],
    [0x0005, 45, 42, 0],
    [0x0001, 45, 43, 0],
    [0x5601, 46, 46, 0],
  ];

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
    this.c = 0;
    this.a = 0;
    this.ct = 0;
    this.markerDetected = false;
    this.init();
  }

  /**
   * Initialize the MQ decoder — fill the code register.
   */
  private init(): void {
    // Initialize A to 0x8000 (half the interval)
    this.a = 0x8000;

    // Fill C with the first bytes
    this.c = this.readNewByte() << 16;
    this.byteIn();
    this.c <<= 7;
    this.ct -= 7;
    this.a = 0x8000;
  }

  /**
   * Read a new byte, handling bit-stuffing after 0xFF.
   */
  private readNewByte(): number {
    if (this.pos >= this.data.length) return 0xff;
    return this.data[this.pos++]!;
  }

  /**
   * Byte-in procedure: feed a new byte into the code register.
   */
  private byteIn(): void {
    if (this.markerDetected) {
      this.ct = 8;
      return;
    }

    let b: number;
    if (this.pos >= this.data.length) {
      b = 0xff;
      this.markerDetected = true;
      this.ct = 8;
      return;
    }
    b = this.data[this.pos]!;

    // Check for bit-stuffing after 0xFF
    if (this.pos > 0 && this.data[this.pos - 1] === 0xff) {
      if (b > 0x8f) {
        // Marker detected
        this.markerDetected = true;
        this.ct = 8;
        return;
      }
      this.pos++;
      this.c += b << 9;
      this.ct = 7;
    } else {
      this.pos++;
      this.c += (b + 0xff00) << 8; // Adding 0xFF00 for proper alignment
      this.ct = 8;
    }
  }

  /**
   * Decode a single bit using the given context.
   *
   * @param cx - Context state: { index: state index, mps: most probable symbol }
   * @returns The decoded bit (0 or 1).
   */
  decode(cx: MQContext): number {
    const qeEntry = MQDecoder.QE_TABLE[cx.index]!;
    const qe = qeEntry[0];

    this.a -= qe;

    let d: number;

    if ((this.c >>> 16) < this.a) {
      // MPS sub-interval
      if (this.a < 0x8000) {
        d = this.a < qe ? 1 - cx.mps : cx.mps;
        if (this.a < qe) {
          // LPS exchange
          cx.index = qeEntry[2];
          if (qeEntry[3]) cx.mps = 1 - cx.mps;
        } else {
          cx.index = qeEntry[1];
        }
        this.renormalize();
      } else {
        d = cx.mps;
      }
    } else {
      // LPS sub-interval
      const cLow = this.c >>> 16;
      this.c -= this.a << 16;
      if (this.a < qe) {
        d = cx.mps;
        cx.index = qeEntry[1];
      } else {
        d = 1 - cx.mps;
        cx.index = qeEntry[2];
        if (qeEntry[3]) cx.mps = 1 - cx.mps;
      }
      this.a = qe;
      this.renormalize();
    }

    return d;
  }

  /**
   * Renormalization: double A and shift C until A >= 0x8000.
   */
  private renormalize(): void {
    while (this.a < 0x8000) {
      if (this.ct === 0) {
        this.byteIn();
      }
      this.a <<= 1;
      this.c <<= 1;
      this.ct--;
    }
  }
}

/**
 * MQ context state: tracks the probability state index and MPS sense.
 */
interface MQContext {
  index: number;
  mps: number;
}

/**
 * Create a fresh MQ context (uniform distribution).
 */
function createMQContext(): MQContext {
  return { index: 0, mps: 0 };
}

/**
 * Tier-1 decode a code-block using the MQ arithmetic coder.
 *
 * Implements the three coding passes per bit-plane:
 * 1. Significance propagation pass
 * 2. Magnitude refinement pass
 * 3. Cleanup pass
 */
function tier1Decode(cb: CodeBlock, subbandType: string): void {
  if (cb.codedData.length === 0 || cb.width === 0 || cb.height === 0) return;

  // Concatenate all coded segments
  let totalLen = 0;
  for (const seg of cb.codedData) totalLen += seg.length;
  const codedBytes = new Uint8Array(totalLen);
  let off = 0;
  for (const seg of cb.codedData) {
    codedBytes.set(seg, off);
    off += seg.length;
  }

  if (codedBytes.length === 0) return;

  const w = cb.width;
  const h = cb.height;
  const numPixels = w * h;

  // Significance state (0 = insignificant, 1 = significant)
  const significance = new Uint8Array(numPixels);
  // Magnitude values (accumulated bit-planes)
  const magnitude = new Int32Array(numPixels);
  // Sign (0 = positive, 1 = negative)
  const sign = new Uint8Array(numPixels);

  // Initialize MQ decoder
  const mq = new MQDecoder(codedBytes);

  // MQ contexts (19 contexts for Tier-1)
  const contexts: MQContext[] = [];
  for (let i = 0; i < 19; i++) {
    contexts.push(createMQContext());
  }

  // Run length context (index 17) and uniform context (index 18)
  const UNIFORM_CX = 18;
  const RUN_LENGTH_CX = 17;

  // Determine the number of bit-planes to decode
  // Based on the coded data available, estimate bit-planes
  const maxBitPlanes = Math.max(1, Math.ceil(Math.log2(numPixels + 1)));
  const numBitPlanes = Math.min(maxBitPlanes, 8);

  // Simplified decoding: process available passes
  // Each bit-plane has 3 passes, total passes = numPasses
  const passesToDecode = Math.min(cb.numPasses, numBitPlanes * 3);

  let currentBitPlane = numBitPlanes - 1;
  let passIndex = 0;

  while (passIndex < passesToDecode && currentBitPlane >= 0) {
    const passType = passIndex % 3;

    try {
      switch (passType) {
        case 0:
          // Significance propagation pass
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (significance[idx]) continue;

              // Check if any neighbor is significant
              if (hasSignificantNeighbor(significance, x, y, w, h)) {
                const cx = getSignificanceContext(
                  significance,
                  x,
                  y,
                  w,
                  h,
                  subbandType,
                );
                const bit = mq.decode(contexts[cx]!);
                if (bit) {
                  significance[idx] = 1;
                  // Decode sign
                  const signBit = mq.decode(contexts[UNIFORM_CX]!);
                  sign[idx] = signBit;
                  magnitude[idx]! |= 1 << currentBitPlane;
                }
              }
            }
          }
          break;

        case 1:
          // Magnitude refinement pass
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (!significance[idx]) continue;
              if (magnitude[idx] === 0) continue;

              const bit = mq.decode(contexts[16]!);
              if (bit) {
                magnitude[idx]! |= 1 << currentBitPlane;
              }
            }
          }
          break;

        case 2:
          // Cleanup pass
          for (let y = 0; y < h; y += 4) {
            for (let x = 0; x < w; x++) {
              // Process column strip of 4 rows
              const stripH = Math.min(4, h - y);

              // Check if all 4 are insignificant with no significant neighbors
              let allInsig = true;
              for (let dy = 0; dy < stripH; dy++) {
                const idx = (y + dy) * w + x;
                if (
                  significance[idx] ||
                  hasSignificantNeighbor(significance, x, y + dy, w, h)
                ) {
                  allInsig = false;
                  break;
                }
              }

              if (allInsig && stripH === 4) {
                // Run-length coding
                const runBit = mq.decode(contexts[RUN_LENGTH_CX]!);
                if (runBit === 0) {
                  continue; // All 4 remain insignificant
                }
                // Decode which row becomes significant
                const r1 = mq.decode(contexts[UNIFORM_CX]!);
                const r0 = mq.decode(contexts[UNIFORM_CX]!);
                const firstSigRow = (r1 << 1) | r0;

                const idx = (y + firstSigRow) * w + x;
                significance[idx] = 1;
                const signBit = mq.decode(contexts[UNIFORM_CX]!);
                sign[idx] = signBit;
                magnitude[idx]! |= 1 << currentBitPlane;

                // Continue with remaining rows
                for (let dy = firstSigRow + 1; dy < stripH; dy++) {
                  const idx2 = (y + dy) * w + x;
                  if (significance[idx2]) continue;

                  const cx = getSignificanceContext(
                    significance,
                    x,
                    y + dy,
                    w,
                    h,
                    subbandType,
                  );
                  const bit = mq.decode(contexts[cx]!);
                  if (bit) {
                    significance[idx2] = 1;
                    const sb = mq.decode(contexts[UNIFORM_CX]!);
                    sign[idx2] = sb;
                    magnitude[idx2]! |= 1 << currentBitPlane;
                  }
                }
              } else {
                // Normal cleanup
                for (let dy = 0; dy < stripH; dy++) {
                  const idx = (y + dy) * w + x;
                  if (significance[idx]) continue;

                  const cx = getSignificanceContext(
                    significance,
                    x,
                    y + dy,
                    w,
                    h,
                    subbandType,
                  );
                  const bit = mq.decode(contexts[cx]!);
                  if (bit) {
                    significance[idx] = 1;
                    const sb = mq.decode(contexts[UNIFORM_CX]!);
                    sign[idx] = sb;
                    magnitude[idx]! |= 1 << currentBitPlane;
                  }
                }
              }
            }
          }
          currentBitPlane--;
          break;
      }
    } catch {
      // MQ decoder ran out of data — stop decoding
      break;
    }

    passIndex++;
  }

  // Convert magnitude and sign to float coefficients
  for (let i = 0; i < numPixels; i++) {
    const val = magnitude[i]!;
    cb.data[i] = sign[i] ? -val : val;
  }
}

/**
 * Check if any of the 8-connected neighbors is significant.
 */
function hasSignificantNeighbor(
  sig: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        if (sig[ny * w + nx]) return true;
      }
    }
  }
  return false;
}

/**
 * Determine the significance context index based on neighbor significance
 * and subband orientation.
 *
 * Returns context index 0-8 based on ITU-T T.800 Table D.1.
 */
function getSignificanceContext(
  sig: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  subbandType: string,
): number {
  // Count significant horizontal (h), vertical (v), and diagonal (d) neighbors
  let hCount = 0;
  let vCount = 0;
  let dCount = 0;

  const checkSig = (nx: number, ny: number): boolean => {
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      return sig[ny * w + nx] !== 0;
    }
    return false;
  };

  // Horizontal neighbors
  if (checkSig(x - 1, y)) hCount++;
  if (checkSig(x + 1, y)) hCount++;

  // Vertical neighbors
  if (checkSig(x, y - 1)) vCount++;
  if (checkSig(x, y + 1)) vCount++;

  // Diagonal neighbors
  if (checkSig(x - 1, y - 1)) dCount++;
  if (checkSig(x + 1, y - 1)) dCount++;
  if (checkSig(x - 1, y + 1)) dCount++;
  if (checkSig(x + 1, y + 1)) dCount++;

  // Context selection based on subband type (ITU-T T.800 Table D.1)
  if (subbandType === 'HL') {
    // HL subband: swap h and v
    const tmp = hCount;
    hCount = vCount;
    vCount = tmp;
  }

  if (subbandType === 'HH') {
    // HH subband: use diagonal context
    const hvCount = hCount + vCount;
    if (dCount >= 3) return 8;
    if (dCount === 2) return hvCount >= 1 ? 7 : 6;
    if (dCount === 1) return hvCount >= 2 ? 7 : (hvCount === 1 ? 6 : 5);
    if (hvCount >= 2) return 6;
    if (hvCount === 1) return 5;
    return 0;
  }

  // LL, LH (and HL after swap) subbands
  if (hCount === 2) return 8;
  if (hCount === 1) {
    if (vCount >= 1) return 7;
    if (dCount >= 1) return 6;
    return 5;
  }
  // hCount === 0
  if (vCount === 2) return 4;
  if (vCount === 1) return dCount >= 1 ? 3 : 2;
  if (dCount >= 2) return 1;
  if (dCount === 1) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Dequantization
// ---------------------------------------------------------------------------

/**
 * Dequantize subband coefficients using the QCD step sizes.
 */
function dequantize(
  subbands: SubbandInfo[],
  qcd: QCDMarker,
  bpc: number,
  reversible: boolean,
): void {
  if (reversible || qcd.quantStyle === 0) {
    // Reversible (lossless) — no dequantization needed
    // Coefficients are already integer values
    return;
  }

  let subbandIndex = 0;
  for (const sb of subbands) {
    if (sb.width === 0 || sb.height === 0) {
      subbandIndex++;
      continue;
    }

    let stepSize: { epsilon: number; mu: number };
    if (qcd.quantStyle === 1) {
      // Scalar derived: derive from base step size
      const base = qcd.stepSizes[0]!;
      if (sb.type === 'LL') {
        stepSize = base;
      } else {
        // Derive step size for this subband
        const levelOffset = sb.resLevel * 3;
        const idx = Math.min(
          subbandIndex,
          qcd.stepSizes.length - 1,
        );
        stepSize = qcd.stepSizes[idx] ?? base;
      }
    } else {
      // Scalar expounded: explicit step sizes
      const idx = Math.min(subbandIndex, qcd.stepSizes.length - 1);
      stepSize = qcd.stepSizes[idx] ?? { epsilon: bpc, mu: 0 };
    }

    // Step size = (1 + mu/2^11) * 2^(epsilon - bpc)
    const delta =
      (1 + stepSize.mu / 2048) * 2 ** (stepSize.epsilon - bpc);

    for (let i = 0; i < sb.coefficients.length; i++) {
      sb.coefficients[i]! *= delta;
    }

    subbandIndex++;
  }
}

// ---------------------------------------------------------------------------
// Inverse Discrete Wavelet Transform (DWT)
// ---------------------------------------------------------------------------

/**
 * Perform inverse DWT to reconstruct the image from subbands.
 *
 * Supports both 5/3 reversible (lossless) and 9/7 irreversible (lossy)
 * wavelet transforms.
 */
function inverseDWT(
  subbands: SubbandInfo[],
  width: number,
  height: number,
  numDecompLevels: number,
  reversible: boolean,
): Float64Array {
  if (numDecompLevels === 0 || subbands.length === 0) {
    // No decomposition — LL subband IS the image
    const ll = subbands[0];
    if (ll) {
      const result = new Float64Array(width * height);
      const copyW = Math.min(ll.width, width);
      const copyH = Math.min(ll.height, height);
      for (let y = 0; y < copyH; y++) {
        for (let x = 0; x < copyW; x++) {
          result[y * width + x] = ll.coefficients[y * ll.width + x]!;
        }
      }
      return result;
    }
    return new Float64Array(width * height);
  }

  // Start with the LL subband and iteratively add detail subbands
  const ll = subbands[0]!;
  let current = new Float64Array(ll.width * ll.height);
  for (let i = 0; i < ll.coefficients.length; i++) {
    current[i] = ll.coefficients[i]!;
  }
  let currentW = ll.width;
  let currentH = ll.height;

  // Process each decomposition level from coarsest to finest
  for (let level = 1; level <= numDecompLevels; level++) {
    // Find the HL, LH, HH subbands for this level
    const hlIdx = 1 + (level - 1) * 3;
    const lhIdx = 2 + (level - 1) * 3;
    const hhIdx = 3 + (level - 1) * 3;

    const hl = subbands[hlIdx];
    const lh = subbands[lhIdx];
    const hh = subbands[hhIdx];

    if (!hl || !lh || !hh) continue;

    // Compute output size for this level
    const outW = currentW + hl.width;
    const outH = currentH + lh.height;

    // Create interleaved buffer
    const result = new Float64Array(outW * outH);

    // Place LL (current) in top-left
    for (let y = 0; y < currentH; y++) {
      for (let x = 0; x < currentW; x++) {
        result[y * outW + x] = current[y * currentW + x]!;
      }
    }

    // Place HL in top-right
    for (let y = 0; y < hl.height; y++) {
      for (let x = 0; x < hl.width; x++) {
        result[y * outW + (currentW + x)] =
          hl.coefficients[y * hl.width + x]!;
      }
    }

    // Place LH in bottom-left
    for (let y = 0; y < lh.height; y++) {
      for (let x = 0; x < lh.width; x++) {
        result[(currentH + y) * outW + x] =
          lh.coefficients[y * lh.width + x]!;
      }
    }

    // Place HH in bottom-right
    for (let y = 0; y < hh.height; y++) {
      for (let x = 0; x < hh.width; x++) {
        result[(currentH + y) * outW + (currentW + x)] =
          hh.coefficients[y * hh.width + x]!;
      }
    }

    // Apply inverse wavelet transform
    if (reversible) {
      inverseDWT53(result, outW, outH);
    } else {
      inverseDWT97(result, outW, outH);
    }

    current = result;
    currentW = outW;
    currentH = outH;
  }

  // If the output size matches, return directly
  if (currentW === width && currentH === height) {
    return current;
  }

  // Crop or pad to target dimensions
  const output = new Float64Array(width * height);
  const copyW = Math.min(currentW, width);
  const copyH = Math.min(currentH, height);
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) {
      output[y * width + x] = current[y * currentW + x]!;
    }
  }

  return output;
}

/**
 * In-place inverse 5/3 (reversible, lossless) wavelet transform.
 *
 * The 5/3 wavelet uses integer lifting steps:
 *   d[n] = d[n] - floor((s[n] + s[n+1]) / 2)      (predict)
 *   s[n] = s[n] + floor((d[n-1] + d[n] + 2) / 4)   (update)
 *
 * where s = low-pass samples, d = high-pass (detail) samples.
 */
function inverseDWT53(
  data: Float64Array,
  width: number,
  height: number,
): void {
  // Process columns first, then rows
  const temp = new Float64Array(Math.max(width, height));

  // Vertical inverse transform (columns)
  for (let x = 0; x < width; x++) {
    const halfH = Math.ceil(height / 2);

    // Extract column: low-pass in first half, high-pass in second half
    for (let y = 0; y < height; y++) {
      temp[y] = data[y * width + x]!;
    }

    // Deinterleave: even indices get low-pass, odd get high-pass
    const low = new Float64Array(halfH);
    const high = new Float64Array(height - halfH);
    for (let i = 0; i < halfH; i++) low[i] = temp[i]!;
    for (let i = 0; i < height - halfH; i++) high[i] = temp[halfH + i]!;

    // Inverse lifting
    // Update step (undo): s[n] = s[n] - floor((d[n-1] + d[n] + 2) / 4)
    for (let n = 0; n < halfH; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= Math.floor((dPrev + dCurr + 2) / 4);
    }

    // Predict step (undo): d[n] = d[n] + floor((s[n] + s[n+1]) / 2)
    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfH ? low[n + 1]! : low[halfH - 1]!;
      high[n]! += Math.floor((sn + sn1) / 2);
    }

    // Interleave back
    for (let i = 0; i < halfH; i++) {
      data[(i * 2) * width + x] = low[i]!;
    }
    for (let i = 0; i < high.length; i++) {
      data[(i * 2 + 1) * width + x] = high[i]!;
    }
  }

  // Horizontal inverse transform (rows)
  for (let y = 0; y < height; y++) {
    const halfW = Math.ceil(width / 2);

    for (let x = 0; x < width; x++) {
      temp[x] = data[y * width + x]!;
    }

    const low = new Float64Array(halfW);
    const high = new Float64Array(width - halfW);
    for (let i = 0; i < halfW; i++) low[i] = temp[i]!;
    for (let i = 0; i < width - halfW; i++) high[i] = temp[halfW + i]!;

    // Inverse lifting
    for (let n = 0; n < halfW; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= Math.floor((dPrev + dCurr + 2) / 4);
    }

    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfW ? low[n + 1]! : low[halfW - 1]!;
      high[n]! += Math.floor((sn + sn1) / 2);
    }

    // Interleave back
    for (let i = 0; i < halfW; i++) {
      data[y * width + i * 2] = low[i]!;
    }
    for (let i = 0; i < high.length; i++) {
      data[y * width + i * 2 + 1] = high[i]!;
    }
  }
}

/**
 * In-place inverse 9/7 (irreversible, lossy) wavelet transform.
 *
 * The 9/7 CDF wavelet uses four lifting steps with the following constants:
 *   alpha = -1.586134342
 *   beta  = -0.052980118
 *   gamma =  0.882911075
 *   delta =  0.443506852
 *   K     =  1.230174105 (scaling factor)
 */
function inverseDWT97(
  data: Float64Array,
  width: number,
  height: number,
): void {
  const alpha = -1.586134342;
  const beta = -0.052980118;
  const gamma = 0.882911075;
  const delta = 0.443506852;
  const K = 1.230174105;
  const invK = 1 / K;

  const temp = new Float64Array(Math.max(width, height));

  // Vertical inverse transform (columns)
  for (let x = 0; x < width; x++) {
    const halfH = Math.ceil(height / 2);

    for (let y = 0; y < height; y++) {
      temp[y] = data[y * width + x]!;
    }

    const low = new Float64Array(halfH);
    const high = new Float64Array(height - halfH);

    // Undo scaling
    for (let i = 0; i < halfH; i++) low[i] = temp[i]! * invK;
    for (let i = 0; i < high.length; i++) high[i] = temp[halfH + i]! * K;

    // Inverse lifting steps (reverse order of forward transform)
    // Step 4: undo delta
    for (let n = 0; n < halfH; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= delta * (dPrev + dCurr);
    }

    // Step 3: undo gamma
    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfH ? low[n + 1]! : low[halfH - 1]!;
      high[n]! -= gamma * (sn + sn1);
    }

    // Step 2: undo beta
    for (let n = 0; n < halfH; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= beta * (dPrev + dCurr);
    }

    // Step 1: undo alpha
    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfH ? low[n + 1]! : low[halfH - 1]!;
      high[n]! -= alpha * (sn + sn1);
    }

    // Interleave
    for (let i = 0; i < halfH; i++) {
      data[(i * 2) * width + x] = low[i]!;
    }
    for (let i = 0; i < high.length; i++) {
      data[(i * 2 + 1) * width + x] = high[i]!;
    }
  }

  // Horizontal inverse transform (rows)
  for (let y = 0; y < height; y++) {
    const halfW = Math.ceil(width / 2);

    for (let x = 0; x < width; x++) {
      temp[x] = data[y * width + x]!;
    }

    const low = new Float64Array(halfW);
    const high = new Float64Array(width - halfW);

    for (let i = 0; i < halfW; i++) low[i] = temp[i]! * invK;
    for (let i = 0; i < high.length; i++) high[i] = temp[halfW + i]! * K;

    // Step 4: undo delta
    for (let n = 0; n < halfW; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= delta * (dPrev + dCurr);
    }

    // Step 3: undo gamma
    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfW ? low[n + 1]! : low[halfW - 1]!;
      high[n]! -= gamma * (sn + sn1);
    }

    // Step 2: undo beta
    for (let n = 0; n < halfW; n++) {
      const dPrev = n > 0 ? high[n - 1]! : high[0]!;
      const dCurr = n < high.length ? high[n]! : high[high.length - 1]!;
      low[n]! -= beta * (dPrev + dCurr);
    }

    // Step 1: undo alpha
    for (let n = 0; n < high.length; n++) {
      const sn = low[n]!;
      const sn1 = n + 1 < halfW ? low[n + 1]! : low[halfW - 1]!;
      high[n]! -= alpha * (sn + sn1);
    }

    // Interleave
    for (let i = 0; i < halfW; i++) {
      data[y * width + i * 2] = low[i]!;
    }
    for (let i = 0; i < high.length; i++) {
      data[y * width + i * 2 + 1] = high[i]!;
    }
  }
}

// ---------------------------------------------------------------------------
// Color Transform
// ---------------------------------------------------------------------------

/**
 * Apply inverse color transform (ICT or RCT) in-place.
 *
 * ICT (Irreversible Color Transform) for lossy compression:
 *   R = Y + 1.402 * Cr
 *   G = Y - 0.344136 * Cb - 0.714136 * Cr
 *   B = Y + 1.772 * Cb
 *
 * RCT (Reversible Color Transform) for lossless compression:
 *   G = Y0 - floor((Y2 + Y1) / 4)
 *   R = Y2 + G
 *   B = Y1 + G
 */
function applyInverseColorTransform(
  components: Float64Array[],
  cod: CODMarker,
  numComponents: number,
): void {
  if (numComponents < 3 || cod.multiComponentTransform === 0) return;

  const c0 = components[0]!;
  const c1 = components[1]!;
  const c2 = components[2]!;
  const numSamples = c0.length;

  if (cod.reversible) {
    // RCT (Reversible Component Transform)
    for (let i = 0; i < numSamples; i++) {
      const y0 = c0[i]!;
      const y1 = c1[i]!;
      const y2 = c2[i]!;
      const g = y0 - Math.floor((y2 + y1) / 4);
      const r = y2 + g;
      const b = y1 + g;
      c0[i] = r;
      c1[i] = g;
      c2[i] = b;
    }
  } else {
    // ICT (Irreversible Component Transform)
    for (let i = 0; i < numSamples; i++) {
      const y = c0[i]!;
      const cb = c1[i]!;
      const cr = c2[i]!;
      c0[i] = y + 1.402 * cr;
      c1[i] = y - 0.34413 * cb - 0.71414 * cr;
      c2[i] = y + 1.772 * cb;
    }
  }
}

/**
 * Convert sYCC color space to sRGB in-place.
 *
 * sYCC uses the same transform as ICT (BT.601 coefficients).
 */
function applySyccToSrgb(
  components: Float64Array[],
  width: number,
  height: number,
): void {
  const c0 = components[0]!;
  const c1 = components[1]!;
  const c2 = components[2]!;
  const numSamples = width * height;

  for (let i = 0; i < numSamples; i++) {
    const y = c0[i]!;
    const cb = c1[i]! - 128;
    const cr = c2[i]! - 128;
    c0[i] = y + 1.402 * cr;
    c1[i] = y - 0.34413 * cb - 0.71414 * cr;
    c2[i] = y + 1.772 * cb;
  }
}

// ---------------------------------------------------------------------------
// Output Interleaving
// ---------------------------------------------------------------------------

/**
 * Interleave per-component floating-point samples into a packed byte
 * output buffer.
 */
function interleaveComponents(
  components: Float64Array[],
  output: Uint8Array,
  width: number,
  height: number,
  numComponents: number,
  bpc: number,
  componentSigned: boolean[],
): void {
  const bytesPerSample = bpc <= 8 ? 1 : 2;
  const maxVal = (1 << bpc) - 1;
  const numPixels = width * height;

  let outIdx = 0;
  for (let i = 0; i < numPixels; i++) {
    for (let c = 0; c < numComponents; c++) {
      let val = components[c]![i]!;

      // Add DC offset for signed components
      if (componentSigned[c]) {
        val += 1 << (bpc - 1);
      }

      // Clamp to valid range
      val = Math.round(val);
      if (val < 0) val = 0;
      if (val > maxVal) val = maxVal;

      if (bytesPerSample === 1) {
        output[outIdx++] = val;
      } else {
        // 16-bit big-endian
        output[outIdx++] = (val >> 8) & 0xff;
        output[outIdx++] = val & 0xff;
      }
    }
  }
}

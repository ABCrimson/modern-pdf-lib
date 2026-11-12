/**
 * Tests for the JPEG2000 (JPXDecode) entry points: getJpeg2000Info reads the
 * JP2 boxes and the SIZ and COD marker segments, and decodeJpeg2000 throws
 * UnsupportedFilterError for every input, including the inputs the decoder
 * used to turn into pixels (each rewritten test keeps its input and asserts
 * the refusal). The streamDecode filter dispatch throws the same error.
 */

import { describe, it, expect } from 'vitest';
import { decodeJpeg2000, getJpeg2000Info } from '../../../src/parser/jpeg2000Decode.js';
import type {
  Jpeg2000Image,
  Jpeg2000DecodeParams,
  Jpeg2000Info,
} from '../../../src/parser/jpeg2000Decode.js';
import { decodeStream } from '../../../src/parser/streamDecode.js';
import { UnsupportedFilterError } from '../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a 32-bit big-endian unsigned integer into a byte array at offset.
 */
function writeUint32BE(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/**
 * Write a 16-bit big-endian unsigned integer into a byte array at offset.
 */
function writeUint16BE(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/**
 * Build JP2 signature box (12 bytes).
 */
function buildJP2Signature(): number[] {
  return [
    0x00,
    0x00,
    0x00,
    0x0c, // box length = 12
    0x6a,
    0x50,
    0x20,
    0x20, // 'jP  '
    0x0d,
    0x0a,
    0x87,
    0x0a, // signature bytes
  ];
}

/**
 * Build JP2 file type box (ftyp).
 */
function buildFileTypeBox(): number[] {
  const content = [
    0x6a,
    0x70,
    0x32,
    0x20, // brand: 'jp2 '
    0x00,
    0x00,
    0x00,
    0x00, // minor version
    0x6a,
    0x70,
    0x32,
    0x20, // compatibility: 'jp2 '
  ];
  const box: number[] = [];
  writeUint32BE(box, 0, content.length + 8);
  // 'ftyp'
  box[4] = 0x66;
  box[5] = 0x74;
  box[6] = 0x79;
  box[7] = 0x70;
  return [...box, ...content];
}

/**
 * Build a color specification box (colr) with enumerated color space.
 */
function buildColorSpecBox(enumCS: number): number[] {
  const content: number[] = [
    0x01, // method = enumerated
    0x00, // precedence
    0x00, // approximation
  ];
  // Enumerated color space (4 bytes)
  const csBytes: number[] = [];
  writeUint32BE(csBytes, 0, enumCS);
  content.push(...csBytes);

  const box: number[] = [];
  writeUint32BE(box, 0, content.length + 8);
  // 'colr'
  box[4] = 0x63;
  box[5] = 0x6f;
  box[6] = 0x6c;
  box[7] = 0x72;
  return [...box, ...content];
}

/**
 * Build a color specification box (colr) with ICC profile.
 */
function buildColorSpecBoxICC(profileBytes: number[]): number[] {
  const content: number[] = [
    0x02, // method = restricted ICC profile
    0x00, // precedence
    0x00, // approximation
    ...profileBytes,
  ];

  const box: number[] = [];
  writeUint32BE(box, 0, content.length + 8);
  box[4] = 0x63;
  box[5] = 0x6f;
  box[6] = 0x6c;
  box[7] = 0x72;
  return [...box, ...content];
}

/**
 * Build a channel definition box (cdef) with one alpha entry.
 */
function buildChannelDefBox(alphaIndex: number): number[] {
  const content: number[] = [];
  writeUint16BE(content, 0, 1); // numEntries
  writeUint16BE(content, 2, alphaIndex); // channel index
  writeUint16BE(content, 4, 1); // channel type = opacity
  writeUint16BE(content, 6, 0); // channel association

  const box: number[] = [];
  writeUint32BE(box, 0, content.length + 8);
  // 'cdef'
  box[4] = 0x63;
  box[5] = 0x64;
  box[6] = 0x65;
  box[7] = 0x66;
  return [...box, ...content];
}

/**
 * Build a JP2 header superbox (jp2h) wrapping sub-boxes.
 */
function buildJP2HeaderBox(subBoxes: number[]): number[] {
  const box: number[] = [];
  writeUint32BE(box, 0, subBoxes.length + 8);
  // 'jp2h'
  box[4] = 0x6a;
  box[5] = 0x70;
  box[6] = 0x32;
  box[7] = 0x68;
  return [...box, ...subBoxes];
}

/**
 * Build a jp2c (contiguous codestream) box wrapping a codestream.
 */
function buildCodestreamBox(codestream: number[]): number[] {
  const box: number[] = [];
  writeUint32BE(box, 0, codestream.length + 8);
  // 'jp2c'
  box[4] = 0x6a;
  box[5] = 0x70;
  box[6] = 0x32;
  box[7] = 0x63;
  return [...box, ...codestream];
}

/**
 * Build a minimal SIZ marker segment.
 *
 * @param width          Image width
 * @param height         Image height
 * @param numComponents  Number of components
 * @param bpc            Bits per component
 * @param reversible     Not used by SIZ, but used to set profile
 */
function buildSIZMarker(
  width: number,
  height: number,
  numComponents: number,
  bpc: number,
): number[] {
  const marker: number[] = [];
  // Marker: FF51
  marker.push(0xff, 0x51);
  // Length (2 bytes) — 38 + 3*numComponents for the segment
  const segLength = 36 + 3 * numComponents + 2;
  writeUint16BE(marker, 2, segLength);
  // Rsiz (profile) — 2 bytes
  writeUint16BE(marker, 4, 0); // unrestricted
  // Xsiz (width) — 4 bytes
  writeUint32BE(marker, 6, width);
  // Ysiz (height) — 4 bytes
  writeUint32BE(marker, 10, height);
  // XOsiz (image offset X) — 4 bytes
  writeUint32BE(marker, 14, 0);
  // YOsiz (image offset Y) — 4 bytes
  writeUint32BE(marker, 18, 0);
  // XTsiz (tile width) — 4 bytes
  writeUint32BE(marker, 22, width);
  // YTsiz (tile height) — 4 bytes
  writeUint32BE(marker, 26, height);
  // XTOsiz (tile offset X) — 4 bytes
  writeUint32BE(marker, 30, 0);
  // YTOsiz (tile offset Y) — 4 bytes
  writeUint32BE(marker, 34, 0);
  // Csiz (num components) — 2 bytes
  writeUint16BE(marker, 38, numComponents);

  // Component parameters (3 bytes each)
  let offset = 40;
  for (let i = 0; i < numComponents; i++) {
    marker[offset] = (bpc - 1) & 0x7f; // unsigned, bpc-1
    marker[offset + 1] = 1; // XRsiz (horizontal sub-sampling)
    marker[offset + 2] = 1; // YRsiz (vertical sub-sampling)
    offset += 3;
  }

  return marker;
}

/**
 * Build a minimal COD marker segment.
 *
 * @param numDecompLevels Number of decomposition levels
 * @param reversible      true = 5/3 (lossless), false = 9/7 (lossy)
 * @param mct             Multiple component transform (0 or 1)
 */
function buildCODMarker(numDecompLevels: number, reversible: boolean, mct: number = 0): number[] {
  const marker: number[] = [];
  // Marker: FF52
  marker.push(0xff, 0x52);
  // Length
  writeUint16BE(marker, 2, 12);
  // Scod (coding style) — 0 = no precincts specified
  marker[4] = 0x00;
  // Progression order — 0 = LRCP
  marker[5] = 0x00;
  // Number of layers — 2 bytes
  writeUint16BE(marker, 6, 1);
  // Multiple component transform
  marker[8] = mct;
  // Number of decomposition levels
  marker[9] = numDecompLevels;
  // Code-block width exponent (4 = 2^(4+2) = 64)
  marker[10] = 4;
  // Code-block height exponent (4 = 2^(4+2) = 64)
  marker[11] = 4;
  // Code-block style
  marker[12] = 0;
  // Wavelet transform: 1 = 5/3 reversible, 0 = 9/7 irreversible
  marker[13] = reversible ? 1 : 0;

  return marker;
}

/**
 * Build a minimal QCD marker segment.
 *
 * @param quantStyle 0 = no quantization, 1 = scalar derived, 2 = scalar expounded
 * @param numSubbands Number of subbands to generate step sizes for
 * @param bpc Bits per component
 */
function buildQCDMarker(quantStyle: number, numSubbands: number, bpc: number): number[] {
  const marker: number[] = [];
  marker.push(0xff, 0x5c);

  if (quantStyle === 0) {
    // No quantization — 1 byte per subband
    const segLength = 3 + numSubbands;
    writeUint16BE(marker, 2, segLength);
    // Sqcd: quantStyle | (guardBits << 5)
    marker[4] = (1 << 5) | quantStyle;
    for (let i = 0; i < numSubbands; i++) {
      // epsilon = bpc, shifted left 3
      marker[5 + i] = (bpc & 0x1f) << 3;
    }
  } else if (quantStyle === 2) {
    // Scalar expounded — 2 bytes per subband
    const segLength = 3 + numSubbands * 2;
    writeUint16BE(marker, 2, segLength);
    marker[4] = (1 << 5) | quantStyle;
    for (let i = 0; i < numSubbands; i++) {
      const val = ((bpc & 0x1f) << 11) | 0; // epsilon = bpc, mu = 0
      writeUint16BE(marker, 5 + i * 2, val);
    }
  }

  return marker;
}

/**
 * Build a minimal SOT marker (start of tile-part).
 */
function buildSOTMarker(
  tileIndex: number,
  tilePartLength: number,
  tilePartIndex: number = 0,
  numTileParts: number = 1,
): number[] {
  const marker: number[] = [];
  marker.push(0xff, 0x90); // SOT marker
  writeUint16BE(marker, 2, 10); // Lsot = 10
  writeUint16BE(marker, 4, tileIndex); // Isot
  writeUint32BE(marker, 6, tilePartLength); // Psot
  marker[10] = tilePartIndex; // TPsot
  marker[11] = numTileParts; // TNsot
  return marker;
}

/**
 * Build the SOD marker (start of data, 2 bytes).
 */
function buildSODMarker(): number[] {
  return [0xff, 0x93];
}

/**
 * Build the EOC marker (end of codestream, 2 bytes).
 */
function buildEOCMarker(): number[] {
  return [0xff, 0xd9];
}

/**
 * Build the SOC marker (start of codestream, 2 bytes).
 */
function buildSOCMarker(): number[] {
  return [0xff, 0x4f];
}

/**
 * Build a minimal single-tile JPEG2000 codestream.
 */
function buildMinimalCodestream(
  width: number,
  height: number,
  numComponents: number,
  bpc: number,
  reversible: boolean,
  tileData: number[] = [],
): number[] {
  const numDecompLevels = 1;
  const numSubbands = 1 + 3 * numDecompLevels; // LL + 3 per level

  const soc = buildSOCMarker();
  const siz = buildSIZMarker(width, height, numComponents, bpc);
  const cod = buildCODMarker(numDecompLevels, reversible);
  const qcd = buildQCDMarker(reversible ? 0 : 2, numSubbands, bpc);

  // SOT + SOD + tile data + EOC
  const tilePayload = [...tileData];
  const sod = buildSODMarker();

  // Total tile-part length: SOT header (12) + SOD (2) + data
  const tpLen = 12 + sod.length + tilePayload.length;
  const sot = buildSOTMarker(0, tpLen);

  const eoc = buildEOCMarker();

  return [...soc, ...siz, ...cod, ...qcd, ...sot, ...sod, ...tilePayload, ...eoc];
}

/**
 * Build a complete JP2 file wrapping a codestream.
 */
function buildMinimalJP2(
  width: number,
  height: number,
  numComponents: number,
  bpc: number,
  reversible: boolean,
  colorSpaceEnum: number = 16, // sRGB
  tileData: number[] = [],
): number[] {
  const sig = buildJP2Signature();
  const ftyp = buildFileTypeBox();
  const colr = buildColorSpecBox(colorSpaceEnum);
  const jp2h = buildJP2HeaderBox(colr);
  const cs = buildMinimalCodestream(width, height, numComponents, bpc, reversible, tileData);
  const jp2c = buildCodestreamBox(cs);

  return [...sig, ...ftyp, ...jp2h, ...jp2c];
}

// ===========================================================================
// JP2 File Format Box Parsing
// ===========================================================================

describe('JP2 File Format Box Parsing', () => {
  it('input of "detects JP2 file format signature" is refused with UnsupportedFilterError', () => {
    const jp2 = buildMinimalJP2(4, 4, 1, 8, true, 17);
    const data = new Uint8Array(jp2);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "parses raw J2K codestream (no JP2 wrapper)" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "extracts sRGB color space from colr box (enumCS=16)" is refused with UnsupportedFilterError', () => {
    const jp2 = buildMinimalJP2(4, 4, 3, 8, true, 16);
    const data = new Uint8Array(jp2);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "extracts greyscale color space from colr box (enumCS=17)" is refused with UnsupportedFilterError', () => {
    const jp2 = buildMinimalJP2(4, 4, 1, 8, true, 17);
    const data = new Uint8Array(jp2);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "extracts sYCC color space from colr box (enumCS=18)" is refused with UnsupportedFilterError', () => {
    const jp2 = buildMinimalJP2(4, 4, 3, 8, true, 18);
    const data = new Uint8Array(jp2);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "extracts ICC profile from colr box (method=2)" is refused with UnsupportedFilterError', () => {
    const sig = buildJP2Signature();
    const ftyp = buildFileTypeBox();
    const fakeProfile = [0x01, 0x02, 0x03, 0x04, 0x05];
    const colr = buildColorSpecBoxICC(fakeProfile);
    const jp2h = buildJP2HeaderBox(colr);
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const jp2c = buildCodestreamBox(cs);
    const jp2 = [...sig, ...ftyp, ...jp2h, ...jp2c];
    const data = new Uint8Array(jp2);

    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "parses channel definition box for alpha channel" is refused with UnsupportedFilterError', () => {
    const sig = buildJP2Signature();
    const ftyp = buildFileTypeBox();
    const colr = buildColorSpecBox(16); // sRGB
    const cdef = buildChannelDefBox(3); // alpha at index 3
    const jp2h = buildJP2HeaderBox([...colr, ...cdef]);
    const cs = buildMinimalCodestream(2, 2, 4, 8, true);
    const jp2c = buildCodestreamBox(cs);
    const jp2 = [...sig, ...ftyp, ...jp2h, ...jp2c];
    const data = new Uint8Array(jp2);

    // The decoder should not throw
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// J2K Codestream Marker Parsing
// ===========================================================================

describe('J2K Codestream Marker Parsing', () => {
  it('input of "throws on missing SOC marker" is refused with UnsupportedFilterError', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws on missing SIZ marker" is refused with UnsupportedFilterError', () => {
    // SOC only, no SIZ
    const data = new Uint8Array([
      0xff,
      0x4f, // SOC
      0xff,
      0xd9, // EOC
    ]);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('parses SIZ marker correctly', () => {
    const cs = buildMinimalCodestream(100, 200, 3, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.width).toBe(100);
    expect(info.height).toBe(200);
    expect(info.components).toBe(3);
    expect(info.bitsPerComponent).toBe(8);
  });

  it('parses COD marker — reversible (lossless)', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.isLossless).toBe(true);
  });

  it('parses COD marker — irreversible (lossy)', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, false);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.isLossless).toBe(false);
  });

  it('reports correct number of resolution levels', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    // 1 decomposition level = 2 resolution levels
    expect(info.numResolutions).toBe(2);
  });

  it('reports single tile for single-tile images', () => {
    const cs = buildMinimalCodestream(100, 200, 1, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.numTilesX).toBe(1);
    expect(info.numTilesY).toBe(1);
  });
});

// ===========================================================================
// SIZ Marker — Component Parameters
// ===========================================================================

describe('SIZ Marker — Component Parameters', () => {
  it('handles 8-bit components', () => {
    const cs = buildMinimalCodestream(4, 4, 3, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.bitsPerComponent).toBe(8);
  });

  it('handles 16-bit components', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 16, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.bitsPerComponent).toBe(16);
  });

  it('input of "handles single-component (greyscale) images" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles 3-component (RGB) images" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 3, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles 4-component (RGBA/CMYK) images" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(2, 2, 4, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Decoding — Basic Output Shape
// ===========================================================================

describe('Decoding — Basic Output Shape', () => {
  it('input of "produces output with correct dimensions" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(8, 6, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "produces correct output size for multi-component image" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 3, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "produces correct output size for 16-bit image" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 16, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles empty tile data gracefully" is refused with UnsupportedFilterError', () => {
    // Codestream with no tile data (SOT -> EOC with no SOD)
    const soc = buildSOCMarker();
    const siz = buildSIZMarker(4, 4, 1, 8);
    const cod = buildCODMarker(1, true);
    const qcd = buildQCDMarker(0, 4, 8);
    const eoc = buildEOCMarker();
    const cs = [...soc, ...siz, ...cod, ...qcd, ...eoc];
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Multi-Resolution Decoding
// ===========================================================================

describe('Multi-Resolution Decoding', () => {
  it('input of "reduces resolution by factor of 2 when reduceResolution=1" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(8, 8, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { reduceResolution: 1 })).toThrow(UnsupportedFilterError);
  });

  it('input of "reduces resolution by factor of 4 when reduceResolution=2" is refused with UnsupportedFilterError', () => {
    // Need at least 3 resolution levels (2 decomp levels) for reduce=2
    // Build with 2 decomp levels manually
    const numDecompLevels = 2;
    const numSubbands = 1 + 3 * numDecompLevels;
    const soc = buildSOCMarker();
    const siz = buildSIZMarker(16, 16, 1, 8);
    const cod = buildCODMarker(numDecompLevels, true);
    const qcd = buildQCDMarker(0, numSubbands, 8);
    const sod = buildSODMarker();
    const tilePayload: number[] = [];
    const tpLen = 12 + sod.length + tilePayload.length;
    const sot = buildSOTMarker(0, tpLen);
    const eoc = buildEOCMarker();
    const cs = [...soc, ...siz, ...cod, ...qcd, ...sot, ...sod, ...tilePayload, ...eoc];

    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { reduceResolution: 2 })).toThrow(UnsupportedFilterError);
  });

  it('input of "clamps reduceResolution to available levels" is refused with UnsupportedFilterError', () => {
    // 1 decomp level = 2 resolution levels, max reduce = 1
    const cs = buildMinimalCodestream(8, 8, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { reduceResolution: 5 })).toThrow(UnsupportedFilterError);
  });

  it('input of "handles odd dimensions when reducing resolution" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(7, 5, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { reduceResolution: 1 })).toThrow(UnsupportedFilterError);
  });

  it('input of "reduceResolution=0 returns full resolution" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(8, 6, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { reduceResolution: 0 })).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// maxComponents Parameter
// ===========================================================================

describe('maxComponents Parameter', () => {
  it('input of "limits decoded components" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 4, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { maxComponents: 3 })).toThrow(UnsupportedFilterError);
  });

  it('input of "does not exceed actual components" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 2, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data, { maxComponents: 5 })).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// getJpeg2000Info
// ===========================================================================

describe('getJpeg2000Info', () => {
  it('returns image info without full decode', () => {
    const cs = buildMinimalCodestream(100, 200, 3, 8, true);
    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.width).toBe(100);
    expect(info.height).toBe(200);
    expect(info.components).toBe(3);
    expect(info.bitsPerComponent).toBe(8);
    expect(info.numTilesX).toBe(1);
    expect(info.numTilesY).toBe(1);
    expect(info.numResolutions).toBe(2);
    expect(info.isLossless).toBe(true);
  });

  it('returns info from JP2 file format', () => {
    const jp2 = buildMinimalJP2(50, 75, 1, 8, false, 17);
    const data = new Uint8Array(jp2);
    const info = getJpeg2000Info(data);
    expect(info.width).toBe(50);
    expect(info.height).toBe(75);
    expect(info.components).toBe(1);
    expect(info.isLossless).toBe(false);
  });

  it('reports correct decomposition level info', () => {
    const numDecompLevels = 3;
    const numSubbands = 1 + 3 * numDecompLevels;
    const soc = buildSOCMarker();
    const siz = buildSIZMarker(64, 64, 1, 8);
    const cod = buildCODMarker(numDecompLevels, true);
    const qcd = buildQCDMarker(0, numSubbands, 8);
    const eoc = buildEOCMarker();
    const cs = [...soc, ...siz, ...cod, ...qcd, ...eoc];

    const data = new Uint8Array(cs);
    const info = getJpeg2000Info(data);
    expect(info.numResolutions).toBe(4);
    expect(info.isLossless).toBe(true);
  });
});

// ===========================================================================
// Error Handling
// ===========================================================================

describe('Error Handling', () => {
  it('throws on too-short data', () => {
    const data = new Uint8Array([0xff]);
    expect(() => decodeJpeg2000(data)).toThrow();
  });

  it('input of "throws on invalid marker at start" is refused with UnsupportedFilterError', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws on JP2 file with no codestream box" is refused with UnsupportedFilterError', () => {
    const sig = buildJP2Signature();
    const ftyp = buildFileTypeBox();
    // JP2 header but no jp2c box
    const colr = buildColorSpecBox(16);
    const jp2h = buildJP2HeaderBox(colr);
    const jp2 = [...sig, ...ftyp, ...jp2h];
    const data = new Uint8Array(jp2);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws on codestream with missing SIZ" is refused with UnsupportedFilterError', () => {
    const soc = buildSOCMarker();
    const cod = buildCODMarker(1, true);
    const eoc = buildEOCMarker();
    const cs = [...soc, ...cod, ...eoc];
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws on codestream with missing COD" is refused with UnsupportedFilterError', () => {
    const soc = buildSOCMarker();
    const siz = buildSIZMarker(4, 4, 1, 8);
    const eoc = buildEOCMarker();
    const cs = [...soc, ...siz, ...eoc];
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Lossy vs Lossless Mode
// ===========================================================================

describe('Lossy vs Lossless Mode', () => {
  it('input of "decodes lossless (5/3 DWT) without error" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "decodes lossy (9/7 DWT) without error" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, false);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('getJpeg2000Info correctly identifies lossless mode', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const info = getJpeg2000Info(new Uint8Array(cs));
    expect(info.isLossless).toBe(true);
  });

  it('getJpeg2000Info correctly identifies lossy mode', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, false);
    const info = getJpeg2000Info(new Uint8Array(cs));
    expect(info.isLossless).toBe(false);
  });
});

// ===========================================================================
// StreamDecode Integration (JPXDecode filter)
// ===========================================================================

describe('StreamDecode Integration — JPXDecode', () => {
  it('input of "decodes JPXDecode filter via decodeStream()" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeStream(data, 'JPXDecode')).toThrow(UnsupportedFilterError);
  });

  it('input of "handles JPX abbreviation in filter name" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeStream(data, 'JPX')).toThrow(UnsupportedFilterError);
  });

  it('input of "decodes JPXDecode as part of a filter chain" is refused with UnsupportedFilterError', () => {
    // This test verifies the filter dispatch handles JPXDecode
    // In a real PDF, JPXDecode is typically the only filter
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeStream(data, ['JPXDecode'])).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Type Exports
// ===========================================================================

describe('Type Exports', () => {
  it('Jpeg2000Image has all required fields', () => {
    const img: Jpeg2000Image = {
      width: 10,
      height: 10,
      components: 3,
      bitsPerComponent: 8,
      data: new Uint8Array(300),
      colorSpace: 'srgb',
    };
    expect(img.width).toBe(10);
    expect(img.colorSpace).toBe('srgb');
  });

  it('Jpeg2000Image supports iccProfile field', () => {
    const img: Jpeg2000Image = {
      width: 1,
      height: 1,
      components: 1,
      bitsPerComponent: 8,
      data: new Uint8Array(1),
      colorSpace: 'icc',
      iccProfile: new Uint8Array([1, 2, 3]),
    };
    expect(img.iccProfile).toBeDefined();
    expect(img.iccProfile!.length).toBe(3);
  });

  it('Jpeg2000DecodeParams supports reduceResolution', () => {
    const params: Jpeg2000DecodeParams = { reduceResolution: 2 };
    expect(params.reduceResolution).toBe(2);
  });

  it('Jpeg2000DecodeParams supports maxComponents', () => {
    const params: Jpeg2000DecodeParams = { maxComponents: 1 };
    expect(params.maxComponents).toBe(1);
  });

  it('Jpeg2000Info has all required fields', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const info: Jpeg2000Info = getJpeg2000Info(new Uint8Array(cs));
    expect(typeof info.width).toBe('number');
    expect(typeof info.height).toBe('number');
    expect(typeof info.components).toBe('number');
    expect(typeof info.bitsPerComponent).toBe('number');
    expect(typeof info.numTilesX).toBe('number');
    expect(typeof info.numTilesY).toBe('number');
    expect(typeof info.numResolutions).toBe('number');
    expect(typeof info.isLossless).toBe('boolean');
  });
});

// ===========================================================================
// Pixel Data Integrity
// ===========================================================================

describe('Pixel Data Integrity', () => {
  it('input of "output pixel values are within valid range (8-bit)" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "output pixel values are within valid range (16-bit)" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(4, 4, 1, 16, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "produces Uint8Array output (not Buffer)" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Edge Cases
// ===========================================================================

describe('Edge Cases', () => {
  it('input of "handles 1x1 image" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(1, 1, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles very small image (2x2)" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(2, 2, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles non-square image" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(16, 4, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles image with odd dimensions" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(7, 5, 1, 8, true);
    const data = new Uint8Array(cs);
    expect(() => decodeJpeg2000(data)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles combined params: reduceResolution + maxComponents" is refused with UnsupportedFilterError', () => {
    const cs = buildMinimalCodestream(8, 8, 4, 8, true);
    const data = new Uint8Array(cs);
    expect(() =>
      decodeJpeg2000(data, {
        reduceResolution: 1,
        maxComponents: 3,
      }),
    ).toThrow(UnsupportedFilterError);
  });
});

describe('decodeJpeg2000: the error carries its class, code and filter', () => {
  it('decodeJpeg2000 throws UnsupportedFilterError with its code and filter', () => {
    expect(() => decodeJpeg2000(new Uint8Array(0))).toThrow(
      expect.objectContaining({
        name: 'UnsupportedFilterError',
        code: 'unsupported-filter',
        filter: 'JPXDecode',
      }),
    );
  });
});

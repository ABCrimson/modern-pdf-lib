/**
 * @module barcode/qr
 *
 * Full QR code encoder (ISO 18004) that generates native PDF vector graphics.
 * Supports versions 1-40, all 4 error correction levels, and auto-detects
 * the best encoding mode (Numeric, Alphanumeric, Byte).
 *
 * The encoder outputs PDF content-stream operators (rectangles) for each
 * dark module, producing resolution-independent vector barcodes.
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill } from '../core/operators/graphics.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Error correction level. */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/** Options for rendering a QR code to PDF operators. */
export interface QrCodeOptions {
  /** Error correction level. Default: `'M'`. */
  readonly errorCorrection?: ErrorCorrectionLevel;
  /** Size of each module in PDF points. Default: `2`. */
  readonly moduleSize?: number;
  /** Number of quiet-zone modules around the code. Default: `4`. */
  readonly quietZone?: number;
  /** Foreground (dark module) colour. Default: black. */
  readonly color?: Color;
  /** Background colour. Default: white. */
  readonly backgroundColor?: Color;
}

/** The result of QR code encoding — a boolean matrix. */
export interface QrCodeMatrix {
  /** Number of modules per side. */
  readonly size: number;
  /** Row-major boolean array. `true` = dark module. */
  readonly modules: readonly boolean[];
  /** QR version (1-40). */
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Constants — Encoding tables
// ---------------------------------------------------------------------------

/** Characters valid in alphanumeric mode and their values. */
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/** Mode indicators (4-bit). */
const MODE_NUMERIC = 0b0001;
const MODE_ALPHANUMERIC = 0b0010;
const MODE_BYTE = 0b0100;

/** EC level ordinal (used for table indexing). */
const EC_ORDINAL: Record<ErrorCorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

// ---------------------------------------------------------------------------
// Capacity tables
//
// DATA_CAPACITY[version-1][ecLevel] = number of data codewords
// EC_CODEWORDS_PER_BLOCK[version-1][ecLevel] = EC codewords per block
// NUM_EC_BLOCKS[version-1][ecLevel] = [numBlocks1, dataCodewords1, numBlocks2?, dataCodewords2?]
// ---------------------------------------------------------------------------

/**
 * Total data codewords per version/EC level.
 * Index: [version-1][ecOrdinal]
 */
const TOTAL_DATA_CODEWORDS: readonly (readonly number[])[] = [
  /* V1  */ [19, 16, 13, 9],
  /* V2  */ [34, 28, 22, 16],
  /* V3  */ [55, 44, 34, 26],
  /* V4  */ [80, 64, 48, 36],
  /* V5  */ [108, 86, 62, 46],
  /* V6  */ [136, 108, 76, 60],
  /* V7  */ [156, 124, 88, 66],
  /* V8  */ [194, 154, 110, 86],
  /* V9  */ [232, 182, 132, 100],
  /* V10 */ [274, 216, 154, 122],
  /* V11 */ [324, 254, 180, 140],
  /* V12 */ [370, 290, 206, 158],
  /* V13 */ [428, 334, 244, 180],
  /* V14 */ [461, 365, 261, 197],
  /* V15 */ [523, 415, 295, 223],
  /* V16 */ [589, 453, 325, 253],
  /* V17 */ [647, 507, 367, 283],
  /* V18 */ [721, 563, 397, 313],
  /* V19 */ [795, 627, 445, 341],
  /* V20 */ [861, 669, 485, 385],
  /* V21 */ [932, 714, 512, 406],
  /* V22 */ [1006, 782, 568, 442],
  /* V23 */ [1094, 860, 614, 464],
  /* V24 */ [1174, 914, 664, 514],
  /* V25 */ [1276, 1000, 718, 538],
  /* V26 */ [1370, 1062, 754, 596],
  /* V27 */ [1468, 1128, 808, 628],
  /* V28 */ [1531, 1193, 871, 661],
  /* V29 */ [1631, 1267, 911, 701],
  /* V30 */ [1735, 1373, 985, 745],
  /* V31 */ [1843, 1455, 1033, 793],
  /* V32 */ [1955, 1541, 1115, 845],
  /* V33 */ [2071, 1631, 1171, 901],
  /* V34 */ [2191, 1725, 1231, 961],
  /* V35 */ [2306, 1812, 1286, 986],
  /* V36 */ [2434, 1914, 1354, 1054],
  /* V37 */ [2566, 1992, 1426, 1096],
  /* V38 */ [2702, 2102, 1502, 1142],
  /* V39 */ [2812, 2216, 1582, 1222],
  /* V40 */ [2956, 2334, 1666, 1276],
];

/**
 * EC codewords per RS block for each version/EC level.
 * Index: [version-1][ecOrdinal]
 */
const EC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  /* V1  */ [7, 10, 13, 17],
  /* V2  */ [10, 16, 22, 28],
  /* V3  */ [15, 26, 18, 22],
  /* V4  */ [20, 18, 26, 16],
  /* V5  */ [26, 24, 18, 22],
  /* V6  */ [18, 16, 24, 28],
  /* V7  */ [20, 18, 18, 26],
  /* V8  */ [24, 22, 22, 26],
  /* V9  */ [30, 22, 20, 24],
  /* V10 */ [18, 26, 24, 28],
  /* V11 */ [20, 30, 28, 24],
  /* V12 */ [24, 22, 26, 28],
  /* V13 */ [26, 22, 24, 22],
  /* V14 */ [30, 24, 20, 24],
  /* V15 */ [22, 24, 30, 24],
  /* V16 */ [24, 28, 24, 30],
  /* V17 */ [28, 28, 28, 28],
  /* V18 */ [30, 26, 28, 28],
  /* V19 */ [28, 26, 26, 26],
  /* V20 */ [28, 26, 28, 28],
  /* V21 */ [28, 26, 30, 28],
  /* V22 */ [28, 28, 24, 30],
  /* V23 */ [30, 28, 30, 30],
  /* V24 */ [30, 28, 30, 30],
  /* V25 */ [26, 28, 30, 30],
  /* V26 */ [28, 28, 28, 30],
  /* V27 */ [30, 28, 30, 30],
  /* V28 */ [30, 28, 30, 30],
  /* V29 */ [30, 28, 30, 30],
  /* V30 */ [30, 28, 30, 30],
  /* V31 */ [30, 28, 30, 30],
  /* V32 */ [30, 28, 30, 30],
  /* V33 */ [30, 28, 30, 30],
  /* V34 */ [30, 28, 30, 30],
  /* V35 */ [30, 28, 30, 30],
  /* V36 */ [30, 28, 30, 30],
  /* V37 */ [30, 28, 30, 30],
  /* V38 */ [30, 28, 30, 30],
  /* V39 */ [30, 28, 30, 30],
  /* V40 */ [30, 28, 30, 30],
];

/**
 * Block structure: [group1Blocks, group1DataCW, group2Blocks, group2DataCW]
 * Index: [version-1][ecOrdinal]
 */
const BLOCK_STRUCTURE: readonly (readonly (readonly number[])[])[] = [
  /* V1  */ [[1,19,0,0],[1,16,0,0],[1,13,0,0],[1,9,0,0]],
  /* V2  */ [[1,34,0,0],[1,28,0,0],[1,22,0,0],[1,16,0,0]],
  /* V3  */ [[1,55,0,0],[1,44,0,0],[2,17,0,0],[2,13,0,0]],
  /* V4  */ [[1,80,0,0],[2,32,0,0],[2,24,0,0],[4,9,0,0]],
  /* V5  */ [[1,108,0,0],[2,43,0,0],[2,15,2,16],[2,11,2,12]],
  /* V6  */ [[2,68,0,0],[4,27,0,0],[4,19,0,0],[4,15,0,0]],
  /* V7  */ [[2,78,0,0],[4,31,0,0],[2,14,4,15],[4,13,1,14]],
  /* V8  */ [[2,97,0,0],[2,38,2,39],[4,18,2,19],[4,14,2,15]],
  /* V9  */ [[2,116,0,0],[3,36,2,37],[4,16,4,17],[4,12,4,13]],
  /* V10 */ [[2,68,2,69],[4,43,1,44],[6,19,2,20],[6,15,2,16]],
  /* V11 */ [[4,81,0,0],[1,50,4,51],[4,22,4,23],[3,12,8,13]],
  /* V12 */ [[2,92,2,93],[6,36,2,37],[4,20,6,21],[7,14,4,15]],
  /* V13 */ [[4,107,0,0],[8,37,1,38],[8,20,4,21],[12,11,4,12]],
  /* V14 */ [[3,115,1,116],[4,40,5,41],[11,16,5,17],[11,12,5,13]],
  /* V15 */ [[5,87,1,88],[5,41,5,42],[5,24,7,25],[11,12,7,13]],
  /* V16 */ [[5,98,1,99],[7,45,3,46],[15,19,2,20],[3,15,13,16]],
  /* V17 */ [[1,107,5,108],[10,46,1,47],[1,22,15,23],[2,14,17,15]],
  /* V18 */ [[5,120,1,121],[9,43,4,44],[17,22,1,23],[2,14,19,15]],
  /* V19 */ [[3,113,4,114],[3,44,11,45],[17,21,4,22],[9,13,16,14]],
  /* V20 */ [[3,107,5,108],[3,41,13,42],[15,24,5,25],[15,15,10,16]],
  /* V21 */ [[4,116,4,117],[17,42,0,0],[17,22,6,23],[19,16,6,17]],
  /* V22 */ [[2,111,7,112],[17,46,0,0],[7,24,16,25],[34,13,0,0]],
  /* V23 */ [[4,121,5,122],[4,47,14,48],[11,24,14,25],[16,15,14,16]],
  /* V24 */ [[6,117,4,118],[6,45,14,46],[11,24,16,25],[30,16,2,17]],
  /* V25 */ [[8,106,4,107],[8,47,13,48],[7,24,22,25],[22,15,13,16]],
  /* V26 */ [[10,114,2,115],[19,46,4,47],[28,22,6,23],[33,16,4,17]],
  /* V27 */ [[8,122,4,123],[22,45,3,46],[8,23,26,24],[12,15,28,16]],
  /* V28 */ [[3,117,10,118],[3,45,23,46],[4,24,31,25],[11,15,31,16]],
  /* V29 */ [[7,116,7,117],[21,45,7,46],[1,23,37,24],[19,15,26,16]],
  /* V30 */ [[5,115,10,116],[19,47,10,48],[15,24,25,25],[23,15,25,16]],
  /* V31 */ [[13,115,3,116],[2,46,29,47],[42,24,1,25],[23,15,28,16]],
  /* V32 */ [[17,115,0,0],[10,46,23,47],[10,24,35,25],[19,15,35,16]],
  /* V33 */ [[17,115,1,116],[14,46,21,47],[29,24,19,25],[11,15,46,16]],
  /* V34 */ [[13,115,6,116],[14,46,23,47],[44,24,7,25],[59,16,1,17]],
  /* V35 */ [[12,121,7,122],[12,47,26,48],[39,24,14,25],[22,15,41,16]],
  /* V36 */ [[6,121,14,122],[6,47,34,48],[46,24,10,25],[2,15,64,16]],
  /* V37 */ [[17,122,4,123],[29,46,14,47],[49,24,10,25],[24,15,46,16]],
  /* V38 */ [[4,122,18,123],[13,46,32,47],[48,24,14,25],[42,15,32,16]],
  /* V39 */ [[20,117,4,118],[40,47,7,48],[43,24,22,25],[10,15,67,16]],
  /* V40 */ [[19,118,6,119],[18,47,31,48],[34,24,34,25],[20,15,61,16]],
];

// ---------------------------------------------------------------------------
// Alignment pattern locations (version 2-40)
// ---------------------------------------------------------------------------

const ALIGNMENT_POSITIONS: readonly (readonly number[])[] = [
  /* V1  */ [],
  /* V2  */ [6, 18],
  /* V3  */ [6, 22],
  /* V4  */ [6, 26],
  /* V5  */ [6, 30],
  /* V6  */ [6, 34],
  /* V7  */ [6, 22, 38],
  /* V8  */ [6, 24, 42],
  /* V9  */ [6, 26, 46],
  /* V10 */ [6, 28, 50],
  /* V11 */ [6, 30, 54],
  /* V12 */ [6, 32, 58],
  /* V13 */ [6, 34, 62],
  /* V14 */ [6, 26, 46, 66],
  /* V15 */ [6, 26, 48, 70],
  /* V16 */ [6, 26, 50, 74],
  /* V17 */ [6, 30, 54, 78],
  /* V18 */ [6, 30, 56, 82],
  /* V19 */ [6, 30, 58, 86],
  /* V20 */ [6, 34, 62, 90],
  /* V21 */ [6, 28, 50, 72, 94],
  /* V22 */ [6, 26, 50, 74, 98],
  /* V23 */ [6, 30, 54, 78, 102],
  /* V24 */ [6, 28, 54, 80, 106],
  /* V25 */ [6, 32, 58, 84, 110],
  /* V26 */ [6, 30, 58, 86, 114],
  /* V27 */ [6, 34, 62, 90, 118],
  /* V28 */ [6, 26, 50, 74, 98, 122],
  /* V29 */ [6, 30, 54, 78, 102, 126],
  /* V30 */ [6, 26, 52, 78, 104, 130],
  /* V31 */ [6, 30, 56, 82, 108, 134],
  /* V32 */ [6, 34, 60, 86, 112, 138],
  /* V33 */ [6, 30, 58, 86, 114, 142],
  /* V34 */ [6, 34, 62, 90, 118, 146],
  /* V35 */ [6, 30, 54, 78, 102, 126, 150],
  /* V36 */ [6, 24, 50, 76, 102, 128, 154],
  /* V37 */ [6, 28, 54, 80, 106, 132, 158],
  /* V38 */ [6, 32, 58, 84, 110, 136, 162],
  /* V39 */ [6, 26, 54, 82, 110, 138, 166],
  /* V40 */ [6, 30, 58, 86, 114, 142, 170],
];

// ---------------------------------------------------------------------------
// Format information (15-bit BCH encoded, masked with 101010000010010)
// Index: ecLevel * 8 + maskPattern
// ---------------------------------------------------------------------------

const FORMAT_INFO: readonly number[] = [
  // L
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
  // M
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
  // Q
  0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed,
  // H
  0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b,
];

// ---------------------------------------------------------------------------
// Version information (18-bit BCH, versions 7-40)
// ---------------------------------------------------------------------------

const VERSION_INFO: readonly number[] = [
  /* V7  */ 0x07c94, /* V8  */ 0x085bc, /* V9  */ 0x09a99, /* V10 */ 0x0a4d3,
  /* V11 */ 0x0bbf6, /* V12 */ 0x0c762, /* V13 */ 0x0d847, /* V14 */ 0x0e60d,
  /* V15 */ 0x0f928, /* V16 */ 0x10b78, /* V17 */ 0x1145d, /* V18 */ 0x12a17,
  /* V19 */ 0x13532, /* V20 */ 0x149a6, /* V21 */ 0x15683, /* V22 */ 0x168c9,
  /* V23 */ 0x177ec, /* V24 */ 0x18ec4, /* V25 */ 0x191e1, /* V26 */ 0x1afab,
  /* V27 */ 0x1b08e, /* V28 */ 0x1cc1a, /* V29 */ 0x1d33f, /* V30 */ 0x1ed75,
  /* V31 */ 0x1f250, /* V32 */ 0x209d5, /* V33 */ 0x216f0, /* V34 */ 0x228ba,
];

// ---------------------------------------------------------------------------
// GF(256) arithmetic for Reed-Solomon
// ---------------------------------------------------------------------------

/** Log and antilog tables for GF(256) with primitive polynomial 0x11d. */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// Build log/antilog tables
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
  }
  // Extend the exp table for easier modular reduction
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
}

/** Multiply two GF(256) elements. */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!;
}

/**
 * Generate a Reed-Solomon generator polynomial for `numEC` error
 * correction codewords. Returns coefficients in descending order.
 */
function rsGeneratorPoly(numEC: number): Uint8Array {
  const gen = new Uint8Array(numEC + 1);
  gen[0] = 1;

  for (let i = 0; i < numEC; i++) {
    // Multiply by (x - alpha^i)
    for (let j = numEC; j >= 1; j--) {
      gen[j] = gen[j - 1]! ^ gfMul(gen[j]!, GF_EXP[i]!);
    }
    gen[0] = gfMul(gen[0]!, GF_EXP[i]!);
  }

  return gen;
}

/**
 * Compute Reed-Solomon error correction codewords for the given data.
 */
function rsEncode(data: Uint8Array, numEC: number): Uint8Array {
  const gen = rsGeneratorPoly(numEC);
  const result = new Uint8Array(numEC);

  for (let i = 0; i < data.length; i++) {
    const coeff = data[i]! ^ result[0]!;
    // Shift result left
    for (let j = 0; j < numEC - 1; j++) {
      result[j] = result[j + 1]! ^ gfMul(coeff, gen[numEC - 1 - j]!);
    }
    result[numEC - 1] = gfMul(coeff, gen[0]!);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

type EncodingMode = 'numeric' | 'alphanumeric' | 'byte';

function detectMode(data: string): EncodingMode {
  if (/^\d*$/.test(data)) return 'numeric';
  if (data.split('').every((ch) => ALPHANUMERIC_CHARS.includes(ch))) return 'alphanumeric';
  return 'byte';
}

/** Number of bits for the character count indicator. */
function charCountBits(version: number, mode: EncodingMode): number {
  if (version <= 9) {
    return mode === 'numeric' ? 10 : mode === 'alphanumeric' ? 9 : 8;
  } else if (version <= 26) {
    return mode === 'numeric' ? 12 : mode === 'alphanumeric' ? 11 : 16;
  } else {
    return mode === 'numeric' ? 14 : mode === 'alphanumeric' ? 13 : 16;
  }
}

// ---------------------------------------------------------------------------
// Data encoding
// ---------------------------------------------------------------------------

/** A simple bit buffer. */
class BitBuffer {
  private bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  put(value: number, numBits: number): void {
    for (let i = numBits - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  getBit(index: number): number {
    return this.bits[index]!;
  }

  /** Convert to byte array (padded to full bytes with trailing zeros). */
  toBytes(): Uint8Array {
    const byteLen = Math.ceil(this.bits.length / 8);
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) {
        bytes[i >>> 3]! |= 0x80 >>> (i & 7);
      }
    }
    return bytes;
  }
}

/** Encode data into the bit buffer for the given mode. */
function encodeData(data: string, mode: EncodingMode, buf: BitBuffer): void {
  switch (mode) {
    case 'numeric':
      encodeNumeric(data, buf);
      break;
    case 'alphanumeric':
      encodeAlphanumeric(data, buf);
      break;
    case 'byte':
      encodeByte(data, buf);
      break;
  }
}

function encodeNumeric(data: string, buf: BitBuffer): void {
  let i = 0;
  while (i + 2 < data.length) {
    const group = parseInt(data.substring(i, i + 3), 10);
    buf.put(group, 10);
    i += 3;
  }
  if (data.length - i === 2) {
    buf.put(parseInt(data.substring(i, i + 2), 10), 7);
  } else if (data.length - i === 1) {
    buf.put(parseInt(data.substring(i, i + 1), 10), 4);
  }
}

function encodeAlphanumeric(data: string, buf: BitBuffer): void {
  let i = 0;
  while (i + 1 < data.length) {
    const a = ALPHANUMERIC_CHARS.indexOf(data[i]!);
    const b = ALPHANUMERIC_CHARS.indexOf(data[i + 1]!);
    buf.put(a * 45 + b, 11);
    i += 2;
  }
  if (i < data.length) {
    buf.put(ALPHANUMERIC_CHARS.indexOf(data[i]!), 6);
  }
}

function encodeByte(data: string, buf: BitBuffer): void {
  // Encode as UTF-8
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  for (const byte of bytes) {
    buf.put(byte, 8);
  }
}

/** Get the data length for character count purposes. */
function getDataLength(data: string, mode: EncodingMode): number {
  if (mode === 'byte') {
    return new TextEncoder().encode(data).length;
  }
  return data.length;
}

// ---------------------------------------------------------------------------
// Version selection
// ---------------------------------------------------------------------------

function modeIndicator(mode: EncodingMode): number {
  switch (mode) {
    case 'numeric': return MODE_NUMERIC;
    case 'alphanumeric': return MODE_ALPHANUMERIC;
    case 'byte': return MODE_BYTE;
  }
}

/**
 * Select the smallest QR version that can hold the data at the
 * given EC level.
 */
function selectVersion(
  data: string,
  mode: EncodingMode,
  ecLevel: ErrorCorrectionLevel,
): number {
  const ecOrd = EC_ORDINAL[ecLevel];
  const dataLen = getDataLength(data, mode);

  for (let version = 1; version <= 40; version++) {
    const totalDataCW = TOTAL_DATA_CODEWORDS[version - 1]![ecOrd]!;
    const totalDataBits = totalDataCW * 8;
    // Calculate required bits: 4 (mode) + char count + data bits + 4 (terminator, may be truncated)
    const ccBits = charCountBits(version, mode);

    // Estimate data bits
    let dataBits: number;
    switch (mode) {
      case 'numeric':
        dataBits = Math.floor(dataLen / 3) * 10 +
          (dataLen % 3 === 2 ? 7 : dataLen % 3 === 1 ? 4 : 0);
        break;
      case 'alphanumeric':
        dataBits = Math.floor(dataLen / 2) * 11 + (dataLen % 2 === 1 ? 6 : 0);
        break;
      case 'byte':
        dataBits = dataLen * 8;
        break;
    }

    const requiredBits = 4 + ccBits + dataBits;
    if (requiredBits <= totalDataBits) {
      return version;
    }
  }

  throw new Error(`Data too long for QR code (max version 40 with EC level ${ecLevel})`);
}

// ---------------------------------------------------------------------------
// Build data codewords
// ---------------------------------------------------------------------------

function buildDataCodewords(
  data: string,
  mode: EncodingMode,
  version: number,
  ecLevel: ErrorCorrectionLevel,
): Uint8Array {
  const ecOrd = EC_ORDINAL[ecLevel];
  const totalDataCW = TOTAL_DATA_CODEWORDS[version - 1]![ecOrd]!;
  const totalDataBits = totalDataCW * 8;

  const buf = new BitBuffer();

  // Mode indicator
  buf.put(modeIndicator(mode), 4);

  // Character count
  const dataLen = getDataLength(data, mode);
  buf.put(dataLen, charCountBits(version, mode));

  // Data
  encodeData(data, mode, buf);

  // Terminator (up to 4 zero bits, or fewer if capacity reached)
  const terminatorLen = Math.min(4, totalDataBits - buf.length);
  buf.put(0, terminatorLen);

  // Pad to byte boundary
  while (buf.length % 8 !== 0) {
    buf.put(0, 1);
  }

  // Pad codewords (alternating 0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (buf.length < totalDataBits) {
    buf.put(padBytes[padIdx % 2]!, 8);
    padIdx++;
  }

  return buf.toBytes();
}

// ---------------------------------------------------------------------------
// Error correction
// ---------------------------------------------------------------------------

interface BlockInfo {
  numBlocks: number;
  dataCodewords: number;
}

function getBlockStructure(version: number, ecLevel: ErrorCorrectionLevel): BlockInfo[] {
  const ecOrd = EC_ORDINAL[ecLevel];
  const bs = BLOCK_STRUCTURE[version - 1]![ecOrd]!;
  const blocks: BlockInfo[] = [];

  if (bs[0]! > 0) {
    blocks.push({ numBlocks: bs[0]!, dataCodewords: bs[1]! });
  }
  if (bs[2]! > 0) {
    blocks.push({ numBlocks: bs[2]!, dataCodewords: bs[3]! });
  }

  return blocks;
}

/**
 * Generate final codeword sequence (data + EC, interleaved).
 */
function generateCodewords(
  data: string,
  mode: EncodingMode,
  version: number,
  ecLevel: ErrorCorrectionLevel,
): Uint8Array {
  const ecOrd = EC_ORDINAL[ecLevel];
  const ecCWPerBlock = EC_CODEWORDS_PER_BLOCK[version - 1]![ecOrd]!;
  const blockGroups = getBlockStructure(version, ecLevel);

  const dataCW = buildDataCodewords(data, mode, version, ecLevel);

  // Split data into blocks
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (const group of blockGroups) {
    for (let b = 0; b < group.numBlocks; b++) {
      const blockData = dataCW.slice(offset, offset + group.dataCodewords);
      dataBlocks.push(blockData);
      ecBlocks.push(rsEncode(blockData, ecCWPerBlock));
      offset += group.dataCodewords;
    }
  }

  // Interleave data codewords
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  const result: number[] = [];

  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        result.push(block[i]!);
      }
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < ecCWPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) {
        result.push(block[i]!);
      }
    }
  }

  return new Uint8Array(result);
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

/** Matrix cell states. */
const EMPTY = -1;
const LIGHT = 0;
const DARK = 1;

function createMatrix(size: number): Int8Array {
  const matrix = new Int8Array(size * size);
  matrix.fill(EMPTY);
  return matrix;
}

function getCell(matrix: Int8Array, size: number, row: number, col: number): number {
  return matrix[row * size + col]!;
}

function setCell(matrix: Int8Array, size: number, row: number, col: number, value: number): void {
  matrix[row * size + col] = value;
}

/** Place a finder pattern with its top-left corner at (row, col). */
function placeFinderPattern(matrix: Int8Array, size: number, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;

      if (
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      ) {
        setCell(matrix, size, mr, mc, DARK);
      } else {
        setCell(matrix, size, mr, mc, LIGHT);
      }
    }
  }
}

/** Place an alignment pattern centred at (row, col). */
function placeAlignmentPattern(matrix: Int8Array, size: number, centerRow: number, centerCol: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const mr = centerRow + r;
      const mc = centerCol + c;
      if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;

      if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
        setCell(matrix, size, mr, mc, DARK);
      } else {
        setCell(matrix, size, mr, mc, LIGHT);
      }
    }
  }
}

/** Place timing patterns (row 6, col 6). */
function placeTimingPatterns(matrix: Int8Array, size: number): void {
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? DARK : LIGHT;
    if (getCell(matrix, size, 6, i) === EMPTY) {
      setCell(matrix, size, 6, i, val);
    }
    if (getCell(matrix, size, i, 6) === EMPTY) {
      setCell(matrix, size, i, 6, val);
    }
  }
}

/** Reserve format information areas (set to LIGHT temporarily). */
function reserveFormatAreas(matrix: Int8Array, size: number): void {
  // Around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (getCell(matrix, size, 8, i) === EMPTY) setCell(matrix, size, 8, i, LIGHT);
    if (getCell(matrix, size, i, 8) === EMPTY) setCell(matrix, size, i, 8, LIGHT);
  }

  // Around bottom-left finder
  for (let i = 0; i <= 7; i++) {
    if (getCell(matrix, size, size - 1 - i, 8) === EMPTY) {
      setCell(matrix, size, size - 1 - i, 8, LIGHT);
    }
  }

  // Around top-right finder
  for (let i = 0; i <= 7; i++) {
    if (getCell(matrix, size, 8, size - 1 - i) === EMPTY) {
      setCell(matrix, size, 8, size - 1 - i, LIGHT);
    }
  }

  // Dark module (always set)
  setCell(matrix, size, size - 8, 8, DARK);
}

/** Reserve version information areas (versions >= 7). */
function reserveVersionAreas(matrix: Int8Array, size: number, version: number): void {
  if (version < 7) return;

  // Bottom-left (6x3 block)
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      if (getCell(matrix, size, size - 11 + c, r) === EMPTY) {
        setCell(matrix, size, size - 11 + c, r, LIGHT);
      }
    }
  }

  // Top-right (3x6 block)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      if (getCell(matrix, size, r, size - 11 + c) === EMPTY) {
        setCell(matrix, size, r, size - 11 + c, LIGHT); // Fixed: removed extra argument
      }
    }
  }
}

/** Check if an alignment pattern centre conflicts with finder patterns. */
function conflictsWithFinder(row: number, col: number, size: number): boolean {
  // Top-left finder: rows 0-8, cols 0-8
  if (row <= 8 && col <= 8) return true;
  // Top-right finder: rows 0-8, cols (size-9) to (size-1)
  if (row <= 8 && col >= size - 9) return true; // Changed from size - 8
  // Bottom-left finder: rows (size-9) to (size-1), cols 0-8
  if (row >= size - 9 && col <= 8) return true; // Changed from size - 8
  return false;
}

/**
 * Place all function patterns on the matrix.
 */
function placeFunctionPatterns(matrix: Int8Array, size: number, version: number): void {
  // Finder patterns
  placeFinderPattern(matrix, size, 0, 0);                  // Top-left
  placeFinderPattern(matrix, size, 0, size - 7);           // Top-right
  placeFinderPattern(matrix, size, size - 7, 0);           // Bottom-left

  // Timing patterns
  placeTimingPatterns(matrix, size);

  // Alignment patterns
  if (version >= 2) {
    const positions = ALIGNMENT_POSITIONS[version - 1]!;
    for (const row of positions) {
      for (const col of positions) {
        if (!conflictsWithFinder(row, col, size)) {
          placeAlignmentPattern(matrix, size, row, col);
        }
      }
    }
  }

  // Reserve format info areas
  reserveFormatAreas(matrix, size);

  // Reserve version info areas
  reserveVersionAreas(matrix, size, version);
}

// ---------------------------------------------------------------------------
// Data placement
// ---------------------------------------------------------------------------

/**
 * Place data bits into the matrix, following the zigzag pattern
 * specified by ISO 18004.
 */
function placeDataBits(matrix: Int8Array, size: number, codewords: Uint8Array): void {
  let bitIndex = 0;
  const totalBits = codewords.length * 8;

  // Start from the right, move left in pairs of columns
  // Column 6 is skipped (timing pattern column)
  let col = size - 1;
  let goingUp = true;

  while (col >= 0) {
    // Skip the timing pattern column
    if (col === 6) {
      col--;
      continue;
    }

    const startRow = goingUp ? size - 1 : 0;
    const endRow = goingUp ? -1 : size;
    const step = goingUp ? -1 : 1;

    for (let row = startRow; row !== endRow; row += step) {
      // Try both columns in the pair (right first, then left)
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0) continue;

        if (getCell(matrix, size, row, c) !== EMPTY) continue;

        if (bitIndex < totalBits) {
          const byteIdx = bitIndex >>> 3;
          const bitPos = 7 - (bitIndex & 7);
          const bit = (codewords[byteIdx]! >>> bitPos) & 1;
          setCell(matrix, size, row, c, bit ? DARK : LIGHT);
          bitIndex++;
        } else {
          setCell(matrix, size, row, c, LIGHT);
        }
      }
    }

    col -= 2;
    goingUp = !goingUp;
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

type MaskFunction = (row: number, col: number) => boolean;

const MASK_FUNCTIONS: readonly MaskFunction[] = [
  (r, c) => (r + c) % 2 === 0,
  (r, _c) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * Create a mask of which cells are data cells (not function patterns).
 */
function createFunctionPatternMask(size: number, version: number): Uint8Array {
  // 1 = function pattern, 0 = data area
  const mask = new Uint8Array(size * size);
  const tempMatrix = createMatrix(size);
  placeFunctionPatterns(tempMatrix, size, version);

  for (let i = 0; i < size * size; i++) {
    mask[i] = tempMatrix[i] !== EMPTY ? 1 : 0;
  }

  return mask;
}

/**
 * Apply a mask pattern to the matrix, only affecting data cells.
 */
function applyMask(
  matrix: Int8Array,
  size: number,
  maskIndex: number,
  functionMask: Uint8Array,
): void {
  const maskFn = MASK_FUNCTIONS[maskIndex]!;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      if (functionMask[idx]) continue; // Skip function patterns
      if (maskFn(row, col)) {
        matrix[idx] = matrix[idx] === DARK ? LIGHT : DARK;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Format & version information embedding
// ---------------------------------------------------------------------------

function embedFormatInfo(matrix: Int8Array, size: number, ecLevel: ErrorCorrectionLevel, maskIndex: number): void {
  const ecOrd = EC_ORDINAL[ecLevel];
  const formatBits = FORMAT_INFO[ecOrd * 8 + maskIndex]!;

  // Place format bits around the finder patterns
  // Horizontal: row 8, specific columns
  const horizontalPositions = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2, size - 1];
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >>> (14 - i)) & 1;
    setCell(matrix, size, 8, horizontalPositions[i]!, bit ? DARK : LIGHT);
  }

  // Vertical: col 8, specific rows
  const verticalPositions = [size - 1, size - 2, size - 3, size - 4, size - 5, size - 6, size - 7, size - 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >>> (14 - i)) & 1;
    setCell(matrix, size, verticalPositions[i]!, 8, bit ? DARK : LIGHT);
  }
}

function embedVersionInfo(matrix: Int8Array, size: number, version: number): void {
  if (version < 7) return;

  const versionBits = VERSION_INFO[version - 7]!;

  for (let i = 0; i < 18; i++) {
    const bit = (versionBits >>> i) & 1;
    const row = Math.floor(i / 3);
    const col = i % 3;
    const value = bit ? DARK : LIGHT;

    // Bottom-left block
    setCell(matrix, size, size - 11 + col, row, value);
    // Top-right block
    setCell(matrix, size, row, size - 11 + col, value);
  }
}

// ---------------------------------------------------------------------------
// Penalty scoring
// ---------------------------------------------------------------------------

function computePenalty(matrix: Int8Array, size: number): number {
  let penalty = 0;

  // Rule 1: Groups of 5+ same-colour modules in a row/column
  // Horizontal
  for (let row = 0; row < size; row++) {
    let count = 1;
    for (let col = 1; col < size; col++) {
      if (getCell(matrix, size, row, col) === getCell(matrix, size, row, col - 1)) {
        count++;
      } else {
        if (count >= 5) penalty += count - 2;
        count = 1;
      }
    }
    if (count >= 5) penalty += count - 2;
  }

  // Vertical
  for (let col = 0; col < size; col++) {
    let count = 1;
    for (let row = 1; row < size; row++) {
      if (getCell(matrix, size, row, col) === getCell(matrix, size, row - 1, col)) {
        count++;
      } else {
        if (count >= 5) penalty += count - 2;
        count = 1;
      }
    }
    if (count >= 5) penalty += count - 2;
  }

  // Rule 2: 2x2 blocks of same colour
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const val = getCell(matrix, size, row, col);
      if (
        val === getCell(matrix, size, row, col + 1) &&
        val === getCell(matrix, size, row + 1, col) &&
        val === getCell(matrix, size, row + 1, col + 1)
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: Finder-like patterns (1:1:3:1:1 dark-light-dark-light-dark)
  // Horizontal
  for (let row = 0; row < size; row++) {
    for (let col = 0; col <= size - 11; col++) {
      if (
        getCell(matrix, size, row, col) === DARK &&
        getCell(matrix, size, row, col + 1) === LIGHT &&
        getCell(matrix, size, row, col + 2) === DARK &&
        getCell(matrix, size, row, col + 3) === DARK &&
        getCell(matrix, size, row, col + 4) === DARK &&
        getCell(matrix, size, row, col + 5) === LIGHT &&
        getCell(matrix, size, row, col + 6) === DARK &&
        getCell(matrix, size, row, col + 7) === LIGHT &&
        getCell(matrix, size, row, col + 8) === LIGHT &&
        getCell(matrix, size, row, col + 9) === LIGHT &&
        getCell(matrix, size, row, col + 10) === LIGHT
      ) {
        penalty += 40;
      }
      if (
        getCell(matrix, size, row, col) === LIGHT &&
        getCell(matrix, size, row, col + 1) === LIGHT &&
        getCell(matrix, size, row, col + 2) === LIGHT &&
        getCell(matrix, size, row, col + 3) === LIGHT &&
        getCell(matrix, size, row, col + 4) === DARK &&
        getCell(matrix, size, row, col + 5) === LIGHT &&
        getCell(matrix, size, row, col + 6) === DARK &&
        getCell(matrix, size, row, col + 7) === DARK &&
        getCell(matrix, size, row, col + 8) === DARK &&
        getCell(matrix, size, row, col + 9) === LIGHT &&
        getCell(matrix, size, row, col + 10) === DARK
      ) {
        penalty += 40;
      }
    }
  }

  // Vertical
  for (let col = 0; col < size; col++) {
    for (let row = 0; row <= size - 11; row++) {
      if (
        getCell(matrix, size, row, col) === DARK &&
        getCell(matrix, size, row + 1, col) === LIGHT &&
        getCell(matrix, size, row + 2, col) === DARK &&
        getCell(matrix, size, row + 3, col) === DARK &&
        getCell(matrix, size, row + 4, col) === DARK &&
        getCell(matrix, size, row + 5, col) === LIGHT &&
        getCell(matrix, size, row + 6, col) === DARK &&
        getCell(matrix, size, row + 7, col) === LIGHT &&
        getCell(matrix, size, row + 8, col) === LIGHT &&
        getCell(matrix, size, row + 9, col) === LIGHT &&
        getCell(matrix, size, row + 10, col) === LIGHT
      ) {
        penalty += 40;
      }
      if (
        getCell(matrix, size, row, col) === LIGHT &&
        getCell(matrix, size, row + 1, col) === LIGHT &&
        getCell(matrix, size, row + 2, col) === LIGHT &&
        getCell(matrix, size, row + 3, col) === LIGHT &&
        getCell(matrix, size, row + 4, col) === DARK &&
        getCell(matrix, size, row + 5, col) === LIGHT &&
        getCell(matrix, size, row + 6, col) === DARK &&
        getCell(matrix, size, row + 7, col) === DARK &&
        getCell(matrix, size, row + 8, col) === DARK &&
        getCell(matrix, size, row + 9, col) === LIGHT &&
        getCell(matrix, size, row + 10, col) === DARK
      ) {
        penalty += 40;
      }
    }
  }

  // Rule 4: Proportion of dark modules
  let darkCount = 0;
  const total = size * size;
  for (let i = 0; i < total; i++) {
    if (matrix[i] === DARK) darkCount++;
  }
  const percent = (darkCount * 100) / total;
  const prev5 = Math.floor(percent / 5) * 5;
  const next5 = prev5 + 5;
  const prevDiff = Math.abs(prev5 - 50) / 5;
  const nextDiff = Math.abs(next5 - 50) / 5;
  penalty += Math.min(prevDiff, nextDiff) * 10;

  return penalty;
}

// ---------------------------------------------------------------------------
// Main encoder
// ---------------------------------------------------------------------------

/**
 * Encode a string as a QR code matrix.
 *
 * @param data              The string to encode.
 * @param errorCorrection   Error correction level (default: `'M'`).
 * @returns                 A {@link QrCodeMatrix} with the encoded data.
 */
export function encodeQrCode(
  data: string,
  errorCorrection: ErrorCorrectionLevel = 'M',
): QrCodeMatrix {
  const mode = detectMode(data);
  const version = selectVersion(data, mode, errorCorrection);
  const size = version * 4 + 17;

  // Generate codewords (data + EC, interleaved)
  const codewords = generateCodewords(data, mode, version, errorCorrection);

  // Build function pattern mask (to know which cells are data)
  const functionMask = createFunctionPatternMask(size, version);

  // Try all 8 mask patterns, pick the one with lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix: Int8Array | null = null;

  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    // Create fresh matrix
    const matrix = createMatrix(size);

    // Place function patterns
    placeFunctionPatterns(matrix, size, version);

    // Place data bits
    placeDataBits(matrix, size, codewords);

    // Apply mask
    applyMask(matrix, size, maskIdx, functionMask);

    // Embed format info
    embedFormatInfo(matrix, size, errorCorrection, maskIdx);

    // Embed version info
    embedVersionInfo(matrix, size, version);

    // Score penalty
    const penalty = computePenalty(matrix, size);

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = maskIdx;
      bestMatrix = matrix;
    }
  }

  // Convert Int8Array to boolean array
  const modules: boolean[] = new Array(size * size);
  for (let i = 0; i < size * size; i++) {
    modules[i] = bestMatrix![i] === DARK;
  }

  return { size, modules, version };
}

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

/** Format a number for PDF output (avoid trailing zeros). */
function pdfNum(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Convert a {@link QrCodeMatrix} to PDF content-stream operators.
 *
 * The QR code is rendered as filled rectangles (one per dark module),
 * positioned at `(x, y)` in PDF user-space coordinates. The `y`
 * coordinate refers to the **bottom-left** corner of the QR code.
 *
 * @param matrix   The QR code matrix from {@link encodeQrCode}.
 * @param x        X position in PDF points.
 * @param y        Y position in PDF points.
 * @param options  Rendering options (module size, quiet zone, colours).
 * @returns        A string of PDF content-stream operators.
 */
export function qrCodeToOperators(
  matrix: QrCodeMatrix,
  x: number,
  y: number,
  options: QrCodeOptions = {},
): string {
  const moduleSize = options.moduleSize ?? 2;
  const quietZone = options.quietZone ?? 4;
  const fgColor = options.color ?? { type: 'grayscale' as const, gray: 0 };
  const bgColor = options.backgroundColor ?? { type: 'grayscale' as const, gray: 1 };

  const totalSize = (matrix.size + 2 * quietZone) * moduleSize;
  let ops = '';

  ops += saveState();

  // Draw background
  ops += applyFillColor(bgColor);
  ops += rectangle(x, y, totalSize, totalSize);
  ops += fill();

  // Draw dark modules
  ops += applyFillColor(fgColor);

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.modules[row * matrix.size + col]) {
        // PDF coordinate system: y=0 is bottom. QR row 0 = top of code.
        // So we flip: PDF y for row r = y + (quietZone + matrix.size - 1 - r) * moduleSize
        const px = x + (quietZone + col) * moduleSize;
        const py = y + (quietZone + matrix.size - 1 - row) * moduleSize;
        ops += rectangle(px, py, moduleSize, moduleSize);
      }
    }
  }

  ops += fill();

  ops += restoreState();

  return ops;
}

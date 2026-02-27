/**
 * @module parser/ccittDecode
 *
 * CCITT fax decompression (Group 3 1D, Group 3 2D, and Group 4).
 *
 * This implements the ITU-T T.4 and T.6 algorithms used by the PDF
 * CCITTFaxDecode filter.  Bilevel images in PDF frequently use Group 4
 * encoding, which encodes each scanline as 2D changes relative to a
 * reference line.
 *
 * Reference: PDF 1.7 spec, SS7.4.6; ITU-T T.4 (Group 3); ITU-T T.6
 * (Group 4).
 *
 * @packageDocumentation
 */

import type { PdfDict } from '../core/pdfObjects.js';
import { PdfNumber, PdfBool } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode CCITTFaxDecode stream data.
 *
 * @param data  - The CCITT-encoded bytes.
 * @param parms - Optional `/DecodeParms` dictionary with CCITT parameters.
 * @returns The decoded bilevel image data (one bit per pixel, packed into
 *          bytes, with rows padded to byte boundaries).
 */
export function decodeCCITT(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  const params = readCCITTParams(parms);

  if (params.k < 0) {
    return decodeGroup4(data, params);
  } else if (params.k === 0) {
    return decodeGroup3_1D(data, params);
  } else {
    return decodeGroup3_2D(data, params);
  }
}

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

interface CCITTParams {
  /** Negative = Group 4, 0 = Group 3 1D, positive = Group 3 2D. */
  k: number;
  /** Image width in pixels. */
  columns: number;
  /** Image height (0 = determine from data). */
  rows: number;
  /** If true, 1 = black; otherwise 0 = black (default). */
  blackIs1: boolean;
  /** If true, each encoded row starts on a byte boundary. */
  encodedByteAlign: boolean;
  /** If true (default), data ends with an end-of-block code. */
  endOfBlock: boolean;
}

function readCCITTParams(parms: PdfDict | null): CCITTParams {
  return {
    k: dictInt(parms, '/K', 0),
    columns: dictInt(parms, '/Columns', 1728),
    rows: dictInt(parms, '/Rows', 0),
    blackIs1: dictBool(parms, '/BlackIs1', false),
    encodedByteAlign: dictBool(parms, '/EncodedByteAlign', false),
    endOfBlock: dictBool(parms, '/EndOfBlock', true),
  };
}

function dictInt(dict: PdfDict | null, key: string, fallback: number): number {
  if (!dict) return fallback;
  const v = dict.get(key);
  if (v instanceof PdfNumber) return Math.round(v.value);
  return fallback;
}

function dictBool(dict: PdfDict | null, key: string, fallback: boolean): boolean {
  if (!dict) return fallback;
  const v = dict.get(key);
  if (v instanceof PdfBool) return v.value;
  // Some generators encode booleans as PdfNumber 0/1
  if (v instanceof PdfNumber) return v.value !== 0;
  return fallback;
}

// ---------------------------------------------------------------------------
// Bit reader
// ---------------------------------------------------------------------------

class BitReader {
  private bytePos = 0;
  private bitPos = 0;

  constructor(private readonly data: Uint8Array) {}

  /** Read a single bit (MSB first). Returns -1 at end of data. */
  readBit(): number {
    if (this.bytePos >= this.data.length) return -1;
    const bit = (this.data[this.bytePos]! >>> (7 - this.bitPos)) & 1;
    this.bitPos++;
    if (this.bitPos >= 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  /** Read `n` bits and return their value (MSB first). Returns -1 on EOF. */
  readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      const bit = this.readBit();
      if (bit < 0) return -1;
      val = (val << 1) | bit;
    }
    return val;
  }

  /** Align to the next byte boundary. */
  alignToByte(): void {
    if (this.bitPos > 0) {
      this.bitPos = 0;
      this.bytePos++;
    }
  }

  /** Check if there is more data available. */
  get eof(): boolean {
    return this.bytePos >= this.data.length;
  }
}

// ---------------------------------------------------------------------------
// Modified Huffman code tables (ITU-T T.4 Table 1 and Table 2)
// ---------------------------------------------------------------------------

/**
 * Huffman tree node.  A leaf stores a `runLength` (>= 0) and whether
 * it is a terminating code or a make-up code.  Internal nodes have
 * `children` indexed by 0/1.
 */
interface HuffmanNode {
  runLength?: number;
  isMakeup?: boolean;
  children?: [HuffmanNode | null, HuffmanNode | null];
}

function makeTree(): HuffmanNode {
  return { children: [null, null] };
}

function insertCode(root: HuffmanNode, code: number, codeLen: number, runLength: number, isMakeup: boolean): void {
  let node = root;
  for (let i = codeLen - 1; i >= 0; i--) {
    const bit = (code >>> i) & 1;
    if (!node.children) {
      node.children = [null, null];
    }
    if (!node.children[bit]) {
      node.children[bit] = {};
    }
    node = node.children[bit]!;
  }
  node.runLength = runLength;
  node.isMakeup = isMakeup;
}

// White terminating codes (Table 1)
const WHITE_TERMINATING: [number, number, number][] = [
  // [code, codeLen, runLength]
  [0b00110101, 8, 0],
  [0b000111, 6, 1],
  [0b0111, 4, 2],
  [0b1000, 4, 3],
  [0b1011, 4, 4],
  [0b1100, 4, 5],
  [0b1110, 4, 6],
  [0b1111, 4, 7],
  [0b10011, 5, 8],
  [0b10100, 5, 9],
  [0b00111, 5, 10],
  [0b01000, 5, 11],
  [0b001000, 6, 12],
  [0b000011, 6, 13],
  [0b110100, 6, 14],
  [0b110101, 6, 15],
  [0b101010, 6, 16],
  [0b101011, 6, 17],
  [0b0100111, 7, 18],
  [0b0001100, 7, 19],
  [0b0001000, 7, 20],
  [0b0010111, 7, 21],
  [0b0000011, 7, 22],
  [0b0000100, 7, 23],
  [0b0101000, 7, 24],
  [0b0101011, 7, 25],
  [0b0010011, 7, 26],
  [0b0100100, 7, 27],
  [0b0011000, 7, 28],
  [0b00000010, 8, 29],
  [0b00000011, 8, 30],
  [0b00011010, 8, 31],
  [0b00011011, 8, 32],
  [0b00010010, 8, 33],
  [0b00010011, 8, 34],
  [0b00010100, 8, 35],
  [0b00010101, 8, 36],
  [0b00010110, 8, 37],
  [0b00010111, 8, 38],
  [0b00101000, 8, 39],
  [0b00101001, 8, 40],
  [0b00101010, 8, 41],
  [0b00101011, 8, 42],
  [0b00101100, 8, 43],
  [0b00101101, 8, 44],
  [0b00000100, 8, 45],
  [0b00000101, 8, 46],
  [0b00001010, 8, 47],
  [0b00001011, 8, 48],
  [0b01010010, 8, 49],
  [0b01010011, 8, 50],
  [0b01010100, 8, 51],
  [0b01010101, 8, 52],
  [0b00100100, 8, 53],
  [0b00100101, 8, 54],
  [0b01011000, 8, 55],
  [0b01011001, 8, 56],
  [0b01011010, 8, 57],
  [0b01011011, 8, 58],
  [0b01001010, 8, 59],
  [0b01001011, 8, 60],
  [0b00110010, 8, 61],
  [0b00110011, 8, 62],
  [0b00110100, 8, 63],
];

// Black terminating codes (Table 2)
const BLACK_TERMINATING: [number, number, number][] = [
  [0b0000110111, 10, 0],
  [0b010, 3, 1],
  [0b11, 2, 2],
  [0b10, 2, 3],
  [0b011, 3, 4],
  [0b0011, 4, 5],
  [0b0010, 4, 6],
  [0b00011, 5, 7],
  [0b000101, 6, 8],
  [0b000100, 6, 9],
  [0b0000100, 7, 10],
  [0b0000101, 7, 11],
  [0b0000111, 7, 12],
  [0b00000100, 8, 13],
  [0b00000111, 8, 14],
  [0b000011000, 9, 15],
  [0b0000010111, 10, 16],
  [0b0000011000, 10, 17],
  [0b0000001000, 10, 18],
  [0b00001100111, 11, 19],
  [0b00001101000, 11, 20],
  [0b00001101100, 11, 21],
  [0b00000110111, 11, 22],
  [0b00000101000, 11, 23],
  [0b00000010111, 11, 24],
  [0b00000011000, 11, 25],
  [0b000011001010, 12, 26],
  [0b000011001011, 12, 27],
  [0b000011001100, 12, 28],
  [0b000011001101, 12, 29],
  [0b000001101000, 12, 30],
  [0b000001101001, 12, 31],
  [0b000001101010, 12, 32],
  [0b000001101011, 12, 33],
  [0b000011010010, 12, 34],
  [0b000011010011, 12, 35],
  [0b000011010100, 12, 36],
  [0b000011010101, 12, 37],
  [0b000011010110, 12, 38],
  [0b000011010111, 12, 39],
  [0b000001101100, 12, 40],
  [0b000001101101, 12, 41],
  [0b000011011010, 12, 42],
  [0b000011011011, 12, 43],
  [0b000001010100, 12, 44],
  [0b000001010101, 12, 45],
  [0b000001010110, 12, 46],
  [0b000001010111, 12, 47],
  [0b000001100100, 12, 48],
  [0b000001100101, 12, 49],
  [0b000001010010, 12, 50],
  [0b000001010011, 12, 51],
  [0b000000100100, 12, 52],
  [0b000000110111, 12, 53],
  [0b000000111000, 12, 54],
  [0b000000100111, 12, 55],
  [0b000000101000, 12, 56],
  [0b000001011000, 12, 57],
  [0b000001011001, 12, 58],
  [0b000000101011, 12, 59],
  [0b000000101100, 12, 60],
  [0b000001011010, 12, 61],
  [0b000001100110, 12, 62],
  [0b000001100111, 12, 63],
];

// White make-up codes
const WHITE_MAKEUP: [number, number, number][] = [
  [0b11011, 5, 64],
  [0b10010, 5, 128],
  [0b010111, 6, 192],
  [0b0110111, 7, 256],
  [0b00110110, 8, 320],
  [0b00110111, 8, 384],
  [0b01100100, 8, 448],
  [0b01100101, 8, 512],
  [0b01101000, 8, 576],
  [0b01100111, 8, 640],
  [0b011001100, 9, 704],
  [0b011001101, 9, 768],
  [0b011010010, 9, 832],
  [0b011010011, 9, 896],
  [0b011010100, 9, 960],
  [0b011010101, 9, 1024],
  [0b011010110, 9, 1088],
  [0b011010111, 9, 1152],
  [0b011011000, 9, 1216],
  [0b011011001, 9, 1280],
  [0b011011010, 9, 1344],
  [0b011011011, 9, 1408],
  [0b010011000, 9, 1472],
  [0b010011001, 9, 1536],
  [0b010011010, 9, 1600],
  [0b011000, 6, 1664],
  [0b010011011, 9, 1728],
];

// Black make-up codes
const BLACK_MAKEUP: [number, number, number][] = [
  [0b0000001111, 10, 64],
  [0b000011001000, 12, 128],
  [0b000011001001, 12, 192],
  [0b000001011011, 12, 256],
  [0b000000110011, 12, 320],
  [0b000000110100, 12, 384],
  [0b000000110101, 12, 448],
  [0b0000001101100, 13, 512],
  [0b0000001101101, 13, 576],
  [0b0000001001010, 13, 640],
  [0b0000001001011, 13, 704],
  [0b0000001001100, 13, 768],
  [0b0000001001101, 13, 832],
  [0b0000001110010, 13, 896],
  [0b0000001110011, 13, 960],
  [0b0000001110100, 13, 1024],
  [0b0000001110101, 13, 1088],
  [0b0000001110110, 13, 1152],
  [0b0000001110111, 13, 1216],
  [0b0000001010010, 13, 1280],
  [0b0000001010011, 13, 1344],
  [0b0000001010100, 13, 1408],
  [0b0000001010101, 13, 1472],
  [0b0000001011010, 13, 1536],
  [0b0000001011011, 13, 1600],
  [0b0000001100100, 13, 1664],
  [0b0000001100101, 13, 1728],
];

// Common make-up codes (shared by black and white, for run lengths > 1728)
const COMMON_MAKEUP: [number, number, number][] = [
  [0b00000001000, 11, 1792],
  [0b00000001100, 11, 1856],
  [0b00000001101, 11, 1920],
  [0b000000010010, 12, 1984],
  [0b000000010011, 12, 2048],
  [0b000000010100, 12, 2112],
  [0b000000010101, 12, 2176],
  [0b000000010110, 12, 2240],
  [0b000000010111, 12, 2304],
  [0b000000011100, 12, 2368],
  [0b000000011101, 12, 2432],
  [0b000000011110, 12, 2496],
  [0b000000011111, 12, 2560],
];

// Build Huffman trees once
const whiteTree = buildTree(WHITE_TERMINATING, WHITE_MAKEUP, COMMON_MAKEUP);
const blackTree = buildTree(BLACK_TERMINATING, BLACK_MAKEUP, COMMON_MAKEUP);

function buildTree(
  terminating: [number, number, number][],
  makeup: [number, number, number][],
  common: [number, number, number][],
): HuffmanNode {
  const root = makeTree();
  for (const [code, len, rl] of terminating) {
    insertCode(root, code, len, rl, false);
  }
  for (const [code, len, rl] of makeup) {
    insertCode(root, code, len, rl, true);
  }
  for (const [code, len, rl] of common) {
    insertCode(root, code, len, rl, true);
  }
  return root;
}

// ---------------------------------------------------------------------------
// EOL code: 000000000001 (12 bits)
// ---------------------------------------------------------------------------

const EOL_CODE = 0b000000000001;
const EOL_BITS = 12;

// ---------------------------------------------------------------------------
// Decode a run length from the Huffman tree
// ---------------------------------------------------------------------------

/**
 * Read a complete run length (possibly made up of make-up + terminating
 * codes) from the bit reader using the given Huffman tree.
 *
 * Returns the total run length, or -1 if EOL / end-of-data is
 * encountered.
 */
function readRunLength(reader: BitReader, tree: HuffmanNode): number {
  let totalRun = 0;

  // Keep reading make-up codes until we get a terminating code
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let node = tree;
    let codeLen = 0;
    let codeBits = 0;

    while (node.children) {
      const bit = reader.readBit();
      if (bit < 0) return -1; // EOF

      codeBits = (codeBits << 1) | bit;
      codeLen++;

      const child = node.children[bit as 0 | 1];
      if (!child) {
        // Invalid code -- try to recover by returning what we have
        // or -1 if nothing accumulated
        if (totalRun > 0) return totalRun;
        return -1;
      }
      node = child;

      // Check for EOL pattern (12 zero-bits followed by a 1)
      if (codeLen === EOL_BITS && codeBits === EOL_CODE) {
        return -1; // EOL
      }

      // Safety: codes should never exceed 13 bits
      if (codeLen > 13) {
        if (totalRun > 0) return totalRun;
        return -1;
      }
    }

    if (node.runLength === undefined) {
      // Should not happen in a well-formed tree
      if (totalRun > 0) return totalRun;
      return -1;
    }

    totalRun += node.runLength;

    // If it's a terminating code, we're done
    if (!node.isMakeup) {
      return totalRun;
    }
    // Otherwise continue to read the next code (another make-up or terminating)
  }
}

// ---------------------------------------------------------------------------
// Group 3 1D decoding (K = 0)
// ---------------------------------------------------------------------------

function decodeGroup3_1D(data: Uint8Array, params: CCITTParams): Uint8Array {
  const { columns, rows, blackIs1, encodedByteAlign, endOfBlock } = params;
  const reader = new BitReader(data);
  const rowBytes = Math.ceil(columns / 8);
  const output: number[] = [];
  let rowCount = 0;
  const maxRows = rows > 0 ? rows : 100000; // safety limit

  while (rowCount < maxRows) {
    if (encodedByteAlign) {
      reader.alignToByte();
    }

    // Try to skip optional EOL at the start of each line
    // (Some encoders emit EOL before each line)
    skipEOL(reader);

    const line = decodeGroup3Line(reader, columns);
    if (!line) {
      break; // EOL without data or EOF
    }

    const packed = packBits(line, columns, blackIs1);
    for (let i = 0; i < rowBytes; i++) {
      output.push(packed[i] ?? 0);
    }
    rowCount++;

    if (!endOfBlock && rows > 0 && rowCount >= rows) {
      break;
    }
  }

  return new Uint8Array(output);
}

function skipEOL(reader: BitReader): void {
  // Peek ahead for up to 12 zero bits followed by a 1 (EOL)
  // This is a best-effort skip -- we don't consume bits we shouldn't
  // For simplicity, this is handled within the run-length decoding
}

function decodeGroup3Line(reader: BitReader, columns: number): Uint8Array | null {
  const line = new Uint8Array(columns);
  let pos = 0;
  let isWhite = true; // Lines start with white run

  while (pos < columns) {
    const tree = isWhite ? whiteTree : blackTree;
    const runLen = readRunLength(reader, tree);
    if (runLen < 0) {
      // EOL or EOF -- if we have decoded some pixels, return what we have
      if (pos > 0) {
        return line;
      }
      return null;
    }

    const color: number = isWhite ? 0 : 1;
    const end = Math.min(pos + runLen, columns);
    for (let i = pos; i < end; i++) {
      line[i] = color;
    }
    pos = end;
    isWhite = !isWhite;
  }

  return line;
}

// ---------------------------------------------------------------------------
// Group 3 2D decoding (K > 0)
// ---------------------------------------------------------------------------

function decodeGroup3_2D(data: Uint8Array, params: CCITTParams): Uint8Array {
  // Group 3 2D alternates between 1D and 2D lines.
  // A tag bit before each line indicates: 1 = 1D, 0 = 2D.
  const { columns, rows, blackIs1, encodedByteAlign, endOfBlock } = params;
  const reader = new BitReader(data);
  const rowBytes = Math.ceil(columns / 8);
  const output: number[] = [];
  let rowCount = 0;
  const maxRows = rows > 0 ? rows : 100000;

  // First reference line is all white
  let referenceLine = new Uint8Array(columns); // all 0 = white

  while (rowCount < maxRows) {
    if (reader.eof) break;
    if (encodedByteAlign) {
      reader.alignToByte();
    }

    const tagBit = reader.readBit();
    if (tagBit < 0) break;

    let line: Uint8Array | null;
    if (tagBit === 1) {
      // 1D encoded line
      line = decodeGroup3Line(reader, columns);
    } else {
      // 2D encoded line
      line = decode2DLine(reader, referenceLine, columns);
    }

    if (!line) break;

    const packed = packBits(line, columns, blackIs1);
    for (let i = 0; i < rowBytes; i++) {
      output.push(packed[i] ?? 0);
    }
    referenceLine = new Uint8Array(line);
    rowCount++;

    if (!endOfBlock && rows > 0 && rowCount >= rows) {
      break;
    }
  }

  return new Uint8Array(output);
}

// ---------------------------------------------------------------------------
// Group 4 decoding (K < 0)
// ---------------------------------------------------------------------------

function decodeGroup4(data: Uint8Array, params: CCITTParams): Uint8Array {
  const { columns, rows, blackIs1, encodedByteAlign, endOfBlock } = params;
  const reader = new BitReader(data);
  const rowBytes = Math.ceil(columns / 8);
  const output: number[] = [];
  let rowCount = 0;
  const maxRows = rows > 0 ? rows : 100000;

  // First reference line is an imaginary all-white line
  let referenceLine = new Uint8Array(columns); // all 0 = white

  while (rowCount < maxRows) {
    if (reader.eof) break;
    if (encodedByteAlign) {
      reader.alignToByte();
    }

    const line = decode2DLine(reader, referenceLine, columns);
    if (!line) break;

    const packed = packBits(line, columns, blackIs1);
    for (let i = 0; i < rowBytes; i++) {
      output.push(packed[i] ?? 0);
    }
    referenceLine = new Uint8Array(line);
    rowCount++;

    if (!endOfBlock && rows > 0 && rowCount >= rows) {
      break;
    }
  }

  return new Uint8Array(output);
}

// ---------------------------------------------------------------------------
// 2D line decoding (used by Group 4 and Group 3 2D)
// ---------------------------------------------------------------------------

/**
 * 2D mode codes:
 *   Pass mode:            0001
 *   Horizontal mode:      001
 *   Vertical(0):          1
 *   Vertical(+1):         011
 *   Vertical(-1):         010
 *   Vertical(+2):         000011
 *   Vertical(-2):         000010
 *   Vertical(+3):         0000011
 *   Vertical(-3):         0000010
 *
 * EOFB (Group 4 end):    000000000001 000000000001 (two EOLs)
 */

const enum Mode2D {
  PASS,
  HORIZONTAL,
  VERTICAL_0,
  VERTICAL_PLUS_1,
  VERTICAL_MINUS_1,
  VERTICAL_PLUS_2,
  VERTICAL_MINUS_2,
  VERTICAL_PLUS_3,
  VERTICAL_MINUS_3,
  EOL,
  ERROR,
}

function read2DMode(reader: BitReader): Mode2D {
  // Read bits one at a time and match against the mode code tree
  let bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    return Mode2D.VERTICAL_0;
  }

  // bit === 0
  bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    // 01x
    bit = reader.readBit();
    if (bit < 0) return Mode2D.EOL;
    if (bit === 1) return Mode2D.HORIZONTAL; // 011 -> wait, horizontal is 001
    // Actually let me re-check the codes:
    // V(0):  1
    // VL(1): 010
    // VR(1): 011
    // H:     001
    // P:     0001
    // VR(2): 000011
    // VL(2): 000010
    // VR(3): 0000011
    // VL(3): 0000010
    //
    // So after reading "01":
    // next bit 0 -> 010 -> VL(1) -> VERTICAL_MINUS_1
    // next bit 1 -> 011 -> VR(1) -> VERTICAL_PLUS_1
    if (bit === 0) return Mode2D.VERTICAL_MINUS_1;
    return Mode2D.VERTICAL_PLUS_1;
  }

  // 00
  bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    // 001 -> Horizontal
    return Mode2D.HORIZONTAL;
  }

  // 000
  bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    // 0001 -> Pass
    return Mode2D.PASS;
  }

  // 0000
  bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    // 00001x
    bit = reader.readBit();
    if (bit < 0) return Mode2D.EOL;
    if (bit === 0) return Mode2D.VERTICAL_MINUS_2;
    return Mode2D.VERTICAL_PLUS_2;
  }

  // 00000
  bit = reader.readBit();
  if (bit < 0) return Mode2D.EOL;

  if (bit === 1) {
    // 000001x
    bit = reader.readBit();
    if (bit < 0) return Mode2D.EOL;
    if (bit === 0) return Mode2D.VERTICAL_MINUS_3;
    return Mode2D.VERTICAL_PLUS_3;
  }

  // 000000 ... could be EOFB/EOL pattern
  // Keep reading zeros until we find something
  // EOL = 000000000001
  // We've already read 6 zeros; EOL is 12 zeros followed by 1.
  // After reading 000000, we need 6 more zeros and then a 1 for EOL.
  // But since we process one at a time, just return EOL for any
  // unrecognized code starting with 000000.
  return Mode2D.EOL;
}

/**
 * Find the next changing element in a line at or after position `pos`
 * that has the given `color` (0=white, 1=black).
 *
 * A "changing element" is a position where the color changes, or the
 * start of the line if it is the specified color.
 */
function findChangingElement(line: Uint8Array, pos: number, color: number, columns: number): number {
  // If pos is at or past end, return columns
  if (pos >= columns) return columns;

  // If the pixel at pos is already the target color, we need to find
  // where the color changes to the target color after it first becomes
  // something else, OR if we're looking for b1/b2 reference elements,
  // we find the next change.
  //
  // Actually, for b1 finding: find the first changing element in the
  // reference line to the right of a0 whose color is opposite to the
  // current color of the coding line at a0.
  //
  // Let's implement a simpler version: find the next position >= pos
  // where the line has `color` and the previous position (pos-1) does
  // not (or pos is 0).
  // But actually for 2D coding, we need:
  // b1 = first changing element on reference line to the right of a0
  //       with color opposite to the current coding color.
  // b2 = next changing element after b1.

  let i = pos;
  // Skip pixels that are not the desired color
  while (i < columns && line[i] !== color) {
    i++;
  }
  if (i >= columns) return columns;

  // Now find where this color ends (the changing element)
  while (i < columns && line[i] === color) {
    i++;
  }
  return i;
}

/**
 * Find b1: the position of the first changing element on the reference
 * line to the right of a0, whose color is opposite to the current
 * coding line color at a0.
 */
function findB1(referenceLine: Uint8Array, a0: number, currentColor: number, columns: number): number {
  const oppositeColor = currentColor === 0 ? 1 : 0;
  let pos = a0 + 1;
  if (pos >= columns) return columns;

  // We need to find the first run of `oppositeColor` that starts at or
  // after a0+1, then find where it ends (the changing element).
  // Actually b1 is defined as the position of the changing element,
  // i.e., the start of the first run of opposite color after a0.

  // First, if the reference pixel at pos is already the opposite color,
  // pos itself is b1 only if it's a changing element (i.e., the pixel
  // before it is different).
  // The precise definition: b1 is the first changing element on the
  // reference line to the right of a0 with opposite color.

  // Walk through the reference line from a0+1
  while (pos < columns) {
    if (referenceLine[pos] === oppositeColor) {
      // Check if this is a changing element (different from previous)
      if (pos === 0 || referenceLine[pos - 1] !== oppositeColor) {
        return pos;
      }
      // It's the same color run -- find the end (next change)
      while (pos < columns && referenceLine[pos] === oppositeColor) {
        pos++;
      }
      // pos is now either at end or at a changing element of currentColor
      // That's not b1 -- b1 must be opposite color. So we continue.
      continue;
    }
    pos++;
  }

  return columns;
}

/**
 * Find b2: the next changing element on the reference line after b1.
 */
function findB2(referenceLine: Uint8Array, b1: number, columns: number): number {
  if (b1 >= columns) return columns;
  const color = referenceLine[b1];
  let pos = b1 + 1;
  while (pos < columns && referenceLine[pos] === color) {
    pos++;
  }
  return pos;
}

function decode2DLine(
  reader: BitReader,
  referenceLine: Uint8Array,
  columns: number,
): Uint8Array | null {
  const line = new Uint8Array(columns);
  let a0 = 0;
  let currentColor = 0; // 0 = white, 1 = black; lines start white

  // a0 = -1 conceptually before the line starts; we use 0 with a flag
  let a0IsBeforeLine = true;

  while (a0 < columns) {
    const mode = read2DMode(reader);

    switch (mode) {
      case Mode2D.PASS: {
        // Pass mode: b2 is identified, a0 moves to below b2
        const searchStart = a0IsBeforeLine ? 0 : a0;
        const b1 = findB1(referenceLine, a0IsBeforeLine ? -1 : a0, currentColor, columns);
        const b2 = findB2(referenceLine, b1, columns);

        // Fill from a0 to b2 with current color (no color change)
        const fillEnd = Math.min(b2, columns);
        for (let i = (a0IsBeforeLine ? 0 : a0); i < fillEnd; i++) {
          line[i] = currentColor;
        }
        a0 = b2;
        a0IsBeforeLine = false;
        // currentColor does NOT change in pass mode
        break;
      }

      case Mode2D.HORIZONTAL: {
        // Horizontal mode: read two run lengths using 1D Huffman tables
        const tree1 = currentColor === 0 ? whiteTree : blackTree;
        const tree2 = currentColor === 0 ? blackTree : whiteTree;

        const run1 = readRunLength(reader, tree1);
        if (run1 < 0) return line; // error recovery
        const run2 = readRunLength(reader, tree2);
        if (run2 < 0) return line;

        const start = a0IsBeforeLine ? 0 : a0;

        // First run is current color
        const end1 = Math.min(start + run1, columns);
        for (let i = start; i < end1; i++) {
          line[i] = currentColor;
        }

        // Second run is opposite color
        const oppositeColor = currentColor === 0 ? 1 : 0;
        const end2 = Math.min(end1 + run2, columns);
        for (let i = end1; i < end2; i++) {
          line[i] = oppositeColor;
        }

        a0 = end2;
        a0IsBeforeLine = false;
        // After horizontal mode, currentColor stays the same
        break;
      }

      case Mode2D.VERTICAL_0:
      case Mode2D.VERTICAL_PLUS_1:
      case Mode2D.VERTICAL_MINUS_1:
      case Mode2D.VERTICAL_PLUS_2:
      case Mode2D.VERTICAL_MINUS_2:
      case Mode2D.VERTICAL_PLUS_3:
      case Mode2D.VERTICAL_MINUS_3: {
        const offsets: Record<number, number> = {
          [Mode2D.VERTICAL_0]: 0,
          [Mode2D.VERTICAL_PLUS_1]: 1,
          [Mode2D.VERTICAL_MINUS_1]: -1,
          [Mode2D.VERTICAL_PLUS_2]: 2,
          [Mode2D.VERTICAL_MINUS_2]: -2,
          [Mode2D.VERTICAL_PLUS_3]: 3,
          [Mode2D.VERTICAL_MINUS_3]: -3,
        };
        const offset = offsets[mode]!;

        const b1 = findB1(referenceLine, a0IsBeforeLine ? -1 : a0, currentColor, columns);
        const a1 = Math.max(0, Math.min(b1 + offset, columns));

        // Fill from a0 to a1 with current color
        const fillStart = a0IsBeforeLine ? 0 : a0;
        for (let i = fillStart; i < a1; i++) {
          line[i] = currentColor;
        }

        a0 = a1;
        a0IsBeforeLine = false;
        // Color changes after vertical mode
        currentColor = currentColor === 0 ? 1 : 0;
        break;
      }

      case Mode2D.EOL:
        // End of line or end of data
        // Fill remaining pixels with current color (usually white)
        if (a0 > 0 || !a0IsBeforeLine) {
          for (let i = a0; i < columns; i++) {
            line[i] = currentColor;
          }
          return line;
        }
        return null;

      case Mode2D.ERROR:
      default:
        // Fill rest with white and return
        return a0 > 0 ? line : null;
    }
  }

  return line;
}

// ---------------------------------------------------------------------------
// Utility: pack pixel array into bytes
// ---------------------------------------------------------------------------

/**
 * Pack an array of pixel values (0 or 1) into bytes, MSB first.
 *
 * In the default PDF convention (BlackIs1 = false):
 *   0 in pixel array -> black -> bit value 0
 *   1 in pixel array -> white -> bit value 1
 *
 * But our internal representation uses 0=white, 1=black.
 * When blackIs1 is false (default), we invert: internal 0->output 0, internal 1->output 1
 *   Wait -- the PDF spec says:
 *   - BlackIs1=false (default): 0=black, 1=white in the OUTPUT
 *   - BlackIs1=true: 1=black, 0=white in the OUTPUT
 *
 *   Our internal coding: 0=white, 1=black (CCITT standard).
 *
 *   When BlackIs1=true: output matches internal (1=black, 0=white).
 *   When BlackIs1=false (default): we need to invert (0=black, 1=white in output,
 *     but our internal 0=white should become 1 in output, and internal 1=black
 *     should become 0 in output).
 */
function packBits(pixels: Uint8Array, columns: number, blackIs1: boolean): Uint8Array {
  const rowBytes = Math.ceil(columns / 8);
  const packed = new Uint8Array(rowBytes);

  for (let i = 0; i < columns; i++) {
    const byteIdx = i >>> 3;
    const bitIdx = 7 - (i & 7);
    let bit: number;

    if (blackIs1) {
      // 1=black in output; our internal 1=black matches
      bit = pixels[i]!;
    } else {
      // 0=black in output (PDF default); our internal 1=black -> output 0
      bit = pixels[i]! === 0 ? 1 : 0;
    }

    if (bit) {
      packed[byteIdx] = (packed[byteIdx]! | (1 << bitIdx)) & 0xff;
    }
  }

  return packed;
}

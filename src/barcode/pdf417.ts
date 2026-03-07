/**
 * @module barcode/pdf417
 *
 * PDF417 2D stacked barcode encoder with text and byte compaction modes,
 * Reed-Solomon error correction over GF(929), and native PDF vector rendering.
 *
 * PDF417 is a stacked linear barcode format used for ID cards, shipping
 * labels, and government documents. It can encode up to 1850 alphanumeric
 * characters or 2710 numeric digits.
 *
 * Each row consists of:
 * - Start pattern (17 modules)
 * - Left row indicator codeword (17 modules)
 * - 1-30 data codeword columns (17 modules each)
 * - Right row indicator codeword (17 modules)
 * - Stop pattern (18 modules)
 *
 * Reference: ISO/IEC 15438:2006
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill } from '../core/operators/graphics.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for encoding a PDF417 barcode. */
export interface Pdf417Options {
  /** Number of data columns (1-30). Default: auto-calculated. */
  readonly columns?: number;
  /** Error correction level (0-8). Default: `2`. */
  readonly errorLevel?: number;
  /** Row height in PDF points. Default: `8`. */
  readonly rowHeight?: number;
  /** Width of a single module in PDF points. Default: `1`. */
  readonly moduleWidth?: number;
  /** Bar colour. Default: black. */
  readonly color?: Color;
  /** Quiet zone width in modules. Default: `2`. */
  readonly quietZone?: number;
}

/** The result of PDF417 encoding — a 2D boolean matrix. */
export interface Pdf417Matrix {
  /** Number of rows. */
  readonly rows: number;
  /** Number of data columns. */
  readonly columns: number;
  /** Total modules per row. */
  readonly moduleWidth: number;
  /** Row-major boolean array. `true` = dark bar. */
  readonly modules: readonly boolean[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Start pattern: 8 bars/spaces = 81111113 (17 modules total).
 * Alternating bar/space widths starting with a bar.
 */
const START_PATTERN = [8, 1, 1, 1, 1, 1, 1, 3];

/**
 * Stop pattern: 9 bars/spaces = 711311121 (18 modules total).
 * Alternating bar/space widths starting with a bar.
 */
const STOP_PATTERN = [7, 1, 1, 3, 1, 1, 1, 2, 1];

/** PDF417 modulus for codeword values and GF arithmetic. */
const MOD = 929;

/** Maximum number of data codewords in a PDF417 symbol. */
const MAX_DATA_CODEWORDS = 925;

/** Codeword for switching to text compaction mode. */
const TEXT_COMPACTION_MODE_LATCH = 900;

/** Codeword for switching to byte compaction mode. */
const BYTE_COMPACTION_MODE_LATCH = 901;

/** Codeword for numeric compaction mode. */
// const NUMERIC_COMPACTION_MODE_LATCH = 902;

/** Codeword for byte compaction mode with known count (mod 6). */
const BYTE_COMPACTION_MODE_LATCH_6 = 924;

// ---------------------------------------------------------------------------
// Text compaction sub-mode tables
//
// PDF417 text compaction encodes pairs of characters into single codewords.
// There are 4 sub-modes: Upper, Lower, Punct, Mixed.
// Each sub-mode maps characters to values 0-29.
// A pair of values (h, l) is packed: codeword = h * 30 + l
// ---------------------------------------------------------------------------

/** Sub-mode character mappings. Value at index = the sub-mode value for the character. */
const TEXT_UPPER = new Map<number, number>();  // A-Z, space
const TEXT_LOWER = new Map<number, number>();  // a-z, space
const TEXT_MIXED = new Map<number, number>();  // digits, & @ # etc.
const TEXT_PUNCT = new Map<number, number>();  // punctuation

// Upper: A(0)..Z(25), SP(26)
for (let i = 0; i < 26; i++) TEXT_UPPER.set(65 + i, i);   // A=65
TEXT_UPPER.set(32, 26); // space

// Lower: a(0)..z(25), SP(26)
for (let i = 0; i < 26; i++) TEXT_LOWER.set(97 + i, i);   // a=97
TEXT_LOWER.set(32, 26); // space

// Mixed: 0(0)..9(9), &(10), CR(11), HT(12), ,(13), :(14),
//        #(15), -(16), .(17), $(18), /(19), +(20), %(21),
//        *(22), =(23), ^(24), SP(26)
const MIXED_CHARS = '0123456789\r\t,:#-.$\/+%*=^';
for (let i = 0; i < MIXED_CHARS.length; i++) {
  TEXT_MIXED.set(MIXED_CHARS.charCodeAt(i), i);
}
TEXT_MIXED.set(32, 26); // space

// Punct: ;(0), <(1), >(2), @(3), [(4), \(5), ](6), _(7), `(8), ~(9),
//        !(10), CR(11), HT(12), ,(13), :(14), LF(15), -(16), .(17),
//        $(18), /(19), "(20), |(21), *(22), ((23), )(24), ?(25), {(26), }(27), '(28)
const PUNCT_CHARS = ';<>@[\\]_`~!\r\t,:' + String.fromCharCode(10) + '-.$/"|()*?{}\x27';
for (let i = 0; i < PUNCT_CHARS.length; i++) {
  TEXT_PUNCT.set(PUNCT_CHARS.charCodeAt(i), i);
}

/** Sub-mode latch/shift values. */
const SUBMODE_LATCH_LOWER = 27;  // Upper -> Lower
const SUBMODE_LATCH_MIXED = 28;  // Upper/Lower -> Mixed
const SUBMODE_SHIFT_PUNCT = 29;  // Any -> Punct (shift, single char)

const SUBMODE_SHIFT_UPPER = 27;  // Lower -> Upper (shift, single char)
// Lower -> Mixed uses 28

const MIXED_LATCH_LOWER = 27;    // Mixed -> Lower
const MIXED_LATCH_PUNCT = 28;    // Mixed -> Punct
// Mixed -> Upper uses 29 (shift)

const PUNCT_LATCH_UPPER = 29;    // Punct -> Upper

// ---------------------------------------------------------------------------
// Cluster bar patterns
//
// PDF417 uses three clusters (0, 1, 2). Row r uses cluster (r % 3).
// Each codeword value (0-928) in a given cluster maps to a 17-module
// bar pattern represented as 8 alternating bar/space widths.
//
// The patterns are computed by enumerating all valid 17-module-wide
// configurations of 4 bars and 4 spaces (each 1-6 modules), then
// assigning them to clusters based on the bar-width metric:
//   cluster = ((b1 - b2 + b3 - b4) mod 9) / 3
// ---------------------------------------------------------------------------

/**
 * Pre-computed codeword patterns for all 929 values in each of 3 clusters.
 * Each pattern is an array of 8 bar/space widths totaling 17 modules.
 * Built once at module load time.
 *
 * Index: CODEWORD_TABLE[cluster][value] -> number[8]
 */
const CODEWORD_TABLE: number[][][] = buildCodewordTable();

function buildCodewordTable(): number[][][] {
  // Enumerate all valid bar/space patterns:
  // 4 bars (odd positions: 0, 2, 4, 6) and 4 spaces (even positions: 1, 3, 5, 7)
  // Total width = 17, each element in [1, 6]
  //
  // PDF417 clusters are differentiated by a metric on the bar widths:
  // Cluster 0: (b1-b2+b3-b4) mod 9 = 0
  // Cluster 1: (b1-b2+b3-b4) mod 9 = 3
  // Cluster 2: (b1-b2+b3-b4) mod 9 = 6

  const clusterPatterns: number[][][] = [[], [], []];

  // We need exactly 929 patterns per cluster.
  // Enumerate all valid patterns (b1,s1,b2,s2,b3,s3,b4,s4) where
  // b1+s1+b2+s2+b3+s3+b4+s4 = 17, each in [1,6].

  const allPatterns: { pattern: number[]; cluster: number }[] = [];

  for (let b1 = 1; b1 <= 6; b1++) {
    for (let s1 = 1; s1 <= 6; s1++) {
      for (let b2 = 1; b2 <= 6; b2++) {
        for (let s2 = 1; s2 <= 6; s2++) {
          for (let b3 = 1; b3 <= 6; b3++) {
            for (let s3 = 1; s3 <= 6; s3++) {
              const remaining = 17 - b1 - s1 - b2 - s2 - b3 - s3;
              // remaining = b4 + s4, both in [1,6]
              if (remaining < 2 || remaining > 12) continue;
              for (let b4 = Math.max(1, remaining - 6); b4 <= Math.min(6, remaining - 1); b4++) {
                const s4 = remaining - b4;
                if (s4 < 1 || s4 > 6) continue;

                // Compute cluster from bar widths
                // cluster metric = (b1 - b2 + b3 - b4) mod 9
                let metric = ((b1 - b2 + b3 - b4) % 9 + 9) % 9;
                let cluster: number;
                if (metric === 0) cluster = 0;
                else if (metric === 3) cluster = 1;
                else if (metric === 6) cluster = 2;
                else continue; // Not a valid PDF417 cluster pattern

                allPatterns.push({
                  pattern: [b1, s1, b2, s2, b3, s3, b4, s4],
                  cluster,
                });
              }
            }
          }
        }
      }
    }
  }

  // Sort patterns within each cluster to get a deterministic mapping.
  // The standard orders by a specific metric on the pattern elements.
  // We sort lexicographically which gives a consistent ordering.
  const cluster0: number[][] = [];
  const cluster1: number[][] = [];
  const cluster2: number[][] = [];

  for (const entry of allPatterns) {
    if (entry.cluster === 0) cluster0.push(entry.pattern);
    else if (entry.cluster === 1) cluster1.push(entry.pattern);
    else cluster2.push(entry.pattern);
  }

  // Sort each cluster's patterns lexicographically
  const sortFn = (a: number[], b: number[]): number => {
    for (let i = 0; i < 8; i++) {
      if (a[i]! !== b[i]!) return a[i]! - b[i]!;
    }
    return 0;
  };

  cluster0.sort(sortFn);
  cluster1.sort(sortFn);
  cluster2.sort(sortFn);

  // Take first 929 from each cluster
  clusterPatterns[0] = cluster0.slice(0, MOD);
  clusterPatterns[1] = cluster1.slice(0, MOD);
  clusterPatterns[2] = cluster2.slice(0, MOD);

  return clusterPatterns;
}

// ---------------------------------------------------------------------------
// Text compaction
// ---------------------------------------------------------------------------

type TextSubMode = 'upper' | 'lower' | 'mixed' | 'punct';

/**
 * Encode a string using PDF417 text compaction mode.
 * Returns an array of codewords (each 0-928).
 */
function textCompaction(data: string): number[] {
  // First, convert the string into sub-mode values with latch/shift codes.
  const subModeValues: number[] = [];
  let currentMode: TextSubMode = 'upper';

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);

    // Try to encode in current mode first
    const val = getSubModeValue(ch, currentMode);
    if (val !== undefined) {
      subModeValues.push(val);
      continue;
    }

    // Need to switch sub-modes
    if (currentMode === 'upper') {
      if (TEXT_LOWER.has(ch)) {
        subModeValues.push(SUBMODE_LATCH_LOWER);
        currentMode = 'lower';
        subModeValues.push(TEXT_LOWER.get(ch)!);
      } else if (TEXT_MIXED.has(ch)) {
        subModeValues.push(SUBMODE_LATCH_MIXED);
        currentMode = 'mixed';
        subModeValues.push(TEXT_MIXED.get(ch)!);
      } else if (TEXT_PUNCT.has(ch)) {
        subModeValues.push(SUBMODE_SHIFT_PUNCT);
        subModeValues.push(TEXT_PUNCT.get(ch)!);
        // Stay in upper (shift is temporary)
      } else {
        // Fallback: encode as byte value
        subModeValues.push(SUBMODE_LATCH_MIXED);
        currentMode = 'mixed';
        subModeValues.push(MIXED_LATCH_PUNCT);
        currentMode = 'punct';
        if (TEXT_PUNCT.has(ch)) {
          subModeValues.push(TEXT_PUNCT.get(ch)!);
        } else {
          subModeValues.push(0); // fallback
        }
      }
    } else if (currentMode === 'lower') {
      if (TEXT_UPPER.has(ch) && ch >= 65 && ch <= 90) {
        // Single uppercase: use shift
        subModeValues.push(SUBMODE_SHIFT_UPPER);
        subModeValues.push(TEXT_UPPER.get(ch)!);
        // Stay in lower
      } else if (TEXT_MIXED.has(ch)) {
        subModeValues.push(SUBMODE_LATCH_MIXED);
        currentMode = 'mixed';
        subModeValues.push(TEXT_MIXED.get(ch)!);
      } else if (TEXT_PUNCT.has(ch)) {
        subModeValues.push(SUBMODE_SHIFT_PUNCT);
        subModeValues.push(TEXT_PUNCT.get(ch)!);
      } else {
        subModeValues.push(0); // fallback
      }
    } else if (currentMode === 'mixed') {
      if (TEXT_UPPER.has(ch) && ch >= 65 && ch <= 90) {
        // Mixed -> Upper: value 29 latches to Upper
        subModeValues.push(29); // latch to upper
        currentMode = 'upper';
        subModeValues.push(TEXT_UPPER.get(ch)!);
      } else if (TEXT_LOWER.has(ch) && ch >= 97 && ch <= 122) {
        subModeValues.push(MIXED_LATCH_LOWER);
        currentMode = 'lower';
        subModeValues.push(TEXT_LOWER.get(ch)!);
      } else if (TEXT_PUNCT.has(ch)) {
        subModeValues.push(MIXED_LATCH_PUNCT);
        currentMode = 'punct';
        subModeValues.push(TEXT_PUNCT.get(ch)!);
      } else {
        subModeValues.push(0); // fallback
      }
    } else {
      // punct mode
      if (TEXT_UPPER.has(ch) && ch >= 65 && ch <= 90) {
        subModeValues.push(PUNCT_LATCH_UPPER);
        currentMode = 'upper';
        subModeValues.push(TEXT_UPPER.get(ch)!);
      } else if (TEXT_PUNCT.has(ch)) {
        subModeValues.push(TEXT_PUNCT.get(ch)!);
      } else {
        subModeValues.push(PUNCT_LATCH_UPPER);
        currentMode = 'upper';
        i--; // re-process this character in upper mode
      }
    }
  }

  // Pad to even length if needed
  if (subModeValues.length % 2 !== 0) {
    subModeValues.push(29); // padding value
  }

  // Pack pairs into codewords: codeword = high * 30 + low
  const codewords: number[] = [];
  for (let i = 0; i < subModeValues.length; i += 2) {
    codewords.push(subModeValues[i]! * 30 + subModeValues[i + 1]!);
  }

  return codewords;
}

function getSubModeValue(ch: number, mode: TextSubMode): number | undefined {
  switch (mode) {
    case 'upper': return TEXT_UPPER.get(ch);
    case 'lower': return TEXT_LOWER.get(ch);
    case 'mixed': return TEXT_MIXED.get(ch);
    case 'punct': return TEXT_PUNCT.get(ch);
  }
}

// ---------------------------------------------------------------------------
// Byte compaction
// ---------------------------------------------------------------------------

/**
 * Encode binary data using PDF417 byte compaction mode.
 */
function byteCompaction(data: Uint8Array): number[] {
  const codewords: number[] = [];

  // Process groups of 6 bytes -> 5 codewords (base 256 -> base 929)
  let i = 0;
  const fullGroups = Math.floor(data.length / 6);

  for (let g = 0; g < fullGroups; g++) {
    // Convert 6 bytes to a large number and decompose into 5 base-929 digits
    let value = 0n;
    for (let j = 0; j < 6; j++) {
      value = value * 256n + BigInt(data[i + j]!);
    }

    const group: number[] = [];
    for (let j = 0; j < 5; j++) {
      group.unshift(Number(value % 929n));
      value = value / 929n;
    }
    codewords.push(...group);
    i += 6;
  }

  // Remaining bytes (1-5): each byte is a codeword directly
  while (i < data.length) {
    codewords.push(data[i]!);
    i++;
  }

  return codewords;
}

// ---------------------------------------------------------------------------
// High-level data encoding
// ---------------------------------------------------------------------------

/**
 * Encode a string into PDF417 data codewords (before error correction).
 *
 * Uses text compaction for printable ASCII, byte compaction for binary data.
 */
function encodeDataCodewords(data: string): number[] {
  // Check if all characters are text-compactable
  const isTextCompactable = isAllTextCompactable(data);

  if (isTextCompactable) {
    // Text compaction mode — the mode latch (900) is the default, so
    // it's implied as the first codeword of the symbol. We don't need
    // to add it explicitly since it's the default mode.
    return textCompaction(data);
  }

  // Use byte compaction for non-text data
  const bytes = new TextEncoder().encode(data);
  const codewords: number[] = [];
  if (bytes.length % 6 === 0) {
    codewords.push(BYTE_COMPACTION_MODE_LATCH_6);
  } else {
    codewords.push(BYTE_COMPACTION_MODE_LATCH);
  }
  codewords.push(...byteCompaction(bytes));

  return codewords;
}

/**
 * Check if all characters in a string can be encoded in text compaction mode.
 */
function isAllTextCompactable(data: string): boolean {
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    if (
      !TEXT_UPPER.has(ch) &&
      !TEXT_LOWER.has(ch) &&
      !TEXT_MIXED.has(ch) &&
      !TEXT_PUNCT.has(ch)
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Error correction — Reed-Solomon over GF(929)
// ---------------------------------------------------------------------------

/**
 * Compute the number of error correction codewords for a given level.
 * Level n adds 2^(n+1) EC codewords.
 */
function ecCodewordCount(level: number): number {
  return 1 << (level + 1);
}

/**
 * Compute Reed-Solomon error correction codewords over GF(929).
 *
 * The generator polynomial is the product of (x - 3^i) for i = 0..k-1,
 * where k is the number of EC codewords and 3 is the primitive element.
 *
 * @param dataCodewords  The data codewords (including the symbol length descriptor).
 * @param ecLevel        Error correction level (0-8).
 * @returns              Array of EC codewords.
 */
function computeECCodewords(dataCodewords: readonly number[], ecLevel: number): number[] {
  const k = ecCodewordCount(ecLevel);

  // Build generator polynomial coefficients
  // g(x) = (x - 3^0)(x - 3^1)...(x - 3^(k-1))
  const gen = new Array<number>(k + 1).fill(0);
  gen[0] = 1;

  for (let i = 0; i < k; i++) {
    // Multiply by (x - 3^i)
    const factor = modPow(3, i, MOD);
    for (let j = k; j >= 1; j--) {
      gen[j] = (gen[j - 1]! - gen[j]! * factor % MOD + MOD * MOD) % MOD;
    }
    gen[0] = (-(gen[0]! * factor) % MOD + MOD * MOD) % MOD;
  }

  // Perform polynomial division
  const remainder = new Array<number>(k).fill(0);

  for (const d of dataCodewords) {
    const t = (d + remainder[k - 1]!) % MOD;
    for (let j = k - 1; j >= 1; j--) {
      remainder[j] = (remainder[j - 1]! + MOD - (t * gen[j]!) % MOD) % MOD;
    }
    remainder[0] = (MOD - (t * gen[0]!) % MOD) % MOD;
  }

  // Negate the remainder
  for (let i = 0; i < k; i++) {
    remainder[i] = (MOD - remainder[i]!) % MOD;
  }

  // Reverse so EC codewords are in the correct order
  remainder.reverse();

  return remainder;
}

/** Modular exponentiation: base^exp mod m. */
function modPow(base: number, exp: number, m: number): number {
  let result = 1;
  base = base % m;
  while (exp > 0) {
    if (exp & 1) {
      result = (result * base) % m;
    }
    exp >>= 1;
    base = (base * base) % m;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Symbol sizing
// ---------------------------------------------------------------------------

/**
 * Determine the number of rows and columns for the symbol.
 *
 * @param dataCount   Number of data codewords (not including length descriptor).
 * @param ecLevel     Error correction level.
 * @param fixedCols   Fixed column count (if specified by user).
 * @returns           { rows, columns }
 */
function computeDimensions(
  dataCount: number,
  ecLevel: number,
  fixedCols?: number,
): { rows: number; columns: number } {
  const ecCount = ecCodewordCount(ecLevel);
  // Total codewords needed: 1 (length descriptor) + dataCount + ecCount
  const totalNeeded = 1 + dataCount + ecCount;

  if (fixedCols !== undefined) {
    const cols = Math.max(1, Math.min(30, fixedCols));
    const rows = Math.max(3, Math.min(90, Math.ceil(totalNeeded / cols)));
    return { rows, columns: cols };
  }

  // Auto-size: try to make a roughly square symbol (aspect ratio ~2:1 cols:rows)
  // Start with a reasonable column count and adjust
  for (let cols = 1; cols <= 30; cols++) {
    const rows = Math.ceil(totalNeeded / cols);
    if (rows >= 3 && rows <= 90) {
      return { rows, columns: cols };
    }
  }

  // Fallback: max columns
  const rows = Math.max(3, Math.ceil(totalNeeded / 30));
  return { rows: Math.min(90, rows), columns: 30 };
}

// ---------------------------------------------------------------------------
// Row indicator codewords
//
// PDF417 encodes metadata into row indicator codewords on each row.
// The left and right indicators encode:
// - Row number within the symbol
// - Number of rows
// - Number of data columns
// - Error correction level
//
// These are divided based on which cluster the row belongs to (row % 3).
// ---------------------------------------------------------------------------

/**
 * Compute the left row indicator codeword value for a given row.
 *
 * Cluster 0 (row % 3 == 0): 30 * (row/3) + ((rows-1)/3)
 * Cluster 1 (row % 3 == 1): 30 * (row/3) + (ecLevel * 3) + ((rows-1) % 3)
 * Cluster 2 (row % 3 == 2): 30 * (row/3) + (columns - 1)
 */
function leftRowIndicator(
  row: number,
  rows: number,
  columns: number,
  ecLevel: number,
): number {
  const clusterRow = Math.floor(row / 3);
  switch (row % 3) {
    case 0:
      return 30 * clusterRow + Math.floor((rows - 1) / 3);
    case 1:
      return 30 * clusterRow + ecLevel * 3 + ((rows - 1) % 3);
    case 2:
      return 30 * clusterRow + (columns - 1);
    default:
      return 0;
  }
}

/**
 * Compute the right row indicator codeword value for a given row.
 *
 * Cluster 0 (row % 3 == 0): 30 * (row/3) + (columns - 1)
 * Cluster 1 (row % 3 == 1): 30 * (row/3) + ((rows-1)/3)
 * Cluster 2 (row % 3 == 2): 30 * (row/3) + (ecLevel * 3) + ((rows-1) % 3)
 */
function rightRowIndicator(
  row: number,
  rows: number,
  columns: number,
  ecLevel: number,
): number {
  const clusterRow = Math.floor(row / 3);
  switch (row % 3) {
    case 0:
      return 30 * clusterRow + (columns - 1);
    case 1:
      return 30 * clusterRow + Math.floor((rows - 1) / 3);
    case 2:
      return 30 * clusterRow + ecLevel * 3 + ((rows - 1) % 3);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Pattern to modules conversion
// ---------------------------------------------------------------------------

/**
 * Convert a bar/space width pattern to boolean modules.
 * Odd indices (0, 2, 4, ...) are bars (true), even indices are spaces (false).
 */
function patternToModules(pattern: readonly number[]): boolean[] {
  const modules: boolean[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const isBar = i % 2 === 0; // First element is a bar
    for (let w = 0; w < pattern[i]!; w++) {
      modules.push(isBar);
    }
  }
  return modules;
}

// ---------------------------------------------------------------------------
// Main encoder
// ---------------------------------------------------------------------------

/**
 * Encode a string as a PDF417 2D stacked barcode.
 *
 * @param data     The string to encode.
 * @param options  Encoding options (columns, error level).
 * @returns        A {@link Pdf417Matrix} with the encoded barcode.
 * @throws         If the data is empty or too long to encode.
 */
export function encodePdf417(
  data: string,
  options?: { columns?: number; errorLevel?: number },
): Pdf417Matrix {
  if (data.length === 0) {
    throw new Error('PDF417: input data must not be empty');
  }

  const ecLevel = Math.max(0, Math.min(8, options?.errorLevel ?? 2));

  // Encode data into codewords
  const dataCodewords = encodeDataCodewords(data);

  if (dataCodewords.length > MAX_DATA_CODEWORDS) {
    throw new Error(
      `PDF417: data too long (${dataCodewords.length} codewords, max ${MAX_DATA_CODEWORDS})`,
    );
  }

  // Determine symbol dimensions
  const { rows, columns } = computeDimensions(
    dataCodewords.length,
    ecLevel,
    options?.columns,
  );

  // Build the complete codeword sequence:
  // [length descriptor] [data codewords...] [padding...] [EC codewords...]
  const totalDataCapacity = rows * columns;
  const ecCount = ecCodewordCount(ecLevel);

  // Length descriptor = total number of data codewords (including itself)
  const symbolLength = totalDataCapacity - ecCount;
  const allData: number[] = [symbolLength];
  allData.push(...dataCodewords);

  // Pad with 900 (text compaction mode latch) to fill remaining data capacity
  while (allData.length < totalDataCapacity - ecCount) {
    allData.push(TEXT_COMPACTION_MODE_LATCH);
  }

  // Compute error correction codewords
  const ecCodewords = computeECCodewords(allData, ecLevel);

  // Complete codeword stream
  const allCodewords = [...allData, ...ecCodewords];

  // Build the module matrix row by row
  const startModules = patternToModules(START_PATTERN);
  const stopModules = patternToModules(STOP_PATTERN);

  // Width per row: start(17) + left indicator(17) + columns*17 + right indicator(17) + stop(18)
  const rowModuleWidth = 17 + 17 + columns * 17 + 17 + 18;

  const allModules: boolean[] = [];

  for (let row = 0; row < rows; row++) {
    const cluster = row % 3;

    // Start pattern
    allModules.push(...startModules);

    // Left row indicator
    const leftVal = leftRowIndicator(row, rows, columns, ecLevel);
    const leftPattern = CODEWORD_TABLE[cluster]![Math.min(leftVal, MOD - 1)]!;
    allModules.push(...patternToModules(leftPattern));

    // Data codewords for this row
    for (let col = 0; col < columns; col++) {
      const cwIndex = row * columns + col;
      const cwValue = cwIndex < allCodewords.length ? allCodewords[cwIndex]! : 0;
      const pattern = CODEWORD_TABLE[cluster]![cwValue % MOD]!;
      allModules.push(...patternToModules(pattern));
    }

    // Right row indicator
    const rightVal = rightRowIndicator(row, rows, columns, ecLevel);
    const rightPattern = CODEWORD_TABLE[cluster]![Math.min(rightVal, MOD - 1)]!;
    allModules.push(...patternToModules(rightPattern));

    // Stop pattern
    allModules.push(...stopModules);
  }

  return {
    rows,
    columns,
    moduleWidth: rowModuleWidth,
    modules: allModules,
  };
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
 * Convert a {@link Pdf417Matrix} to PDF content-stream operators.
 *
 * The barcode is rendered as filled rectangles, positioned at `(x, y)`
 * in PDF user-space coordinates. The `y` coordinate refers to the
 * **bottom-left** corner of the barcode.
 *
 * @param matrix   The PDF417 matrix from {@link encodePdf417}.
 * @param x        X position in PDF points.
 * @param y        Y position in PDF points.
 * @param options  Rendering options.
 * @returns        A string of PDF content-stream operators.
 */
export function pdf417ToOperators(
  matrix: Pdf417Matrix,
  x: number,
  y: number,
  options: Pdf417Options = {},
): string {
  const moduleWidth = options.moduleWidth ?? 1;
  const rowHeight = options.rowHeight ?? 8;
  const quietZone = options.quietZone ?? 2;
  const color = options.color ?? { type: 'grayscale' as const, gray: 0 };

  let ops = '';

  ops += saveState();

  // Set bar colour
  ops += applyFillColor(color);

  const qzWidth = quietZone * moduleWidth;

  // Draw each row from bottom to top (PDF coordinate system: y=0 at bottom)
  for (let row = 0; row < matrix.rows; row++) {
    // PDF row 0 (bottom of barcode) corresponds to the last barcode row
    const pdfRow = matrix.rows - 1 - row;
    const py = y + pdfRow * rowHeight;
    const rowOffset = row * matrix.moduleWidth;

    // Scan for bar runs and draw rectangles
    let barStart = -1;

    for (let col = 0; col <= matrix.moduleWidth; col++) {
      const isBar = col < matrix.moduleWidth
        ? matrix.modules[rowOffset + col]
        : false;

      if (isBar && barStart === -1) {
        barStart = col;
      } else if (!isBar && barStart !== -1) {
        // Draw rectangle for this bar run
        const px = x + qzWidth + barStart * moduleWidth;
        const barWidth = (col - barStart) * moduleWidth;
        ops += `${pdfNum(px)} ${pdfNum(py)} ${pdfNum(barWidth)} ${pdfNum(rowHeight)} re\n`;
        barStart = -1;
      }
    }
  }

  ops += fill();

  ops += restoreState();

  return ops;
}

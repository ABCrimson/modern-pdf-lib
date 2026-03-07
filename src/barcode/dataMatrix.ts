/**
 * @module barcode/dataMatrix
 *
 * Data Matrix ECC200 2D barcode encoder (ISO/IEC 16022).
 *
 * Data Matrix is a 2D matrix barcode widely used for small item marking
 * in electronics, pharmaceuticals, and logistics. ECC200 is the modern
 * variant with Reed-Solomon error correction over GF(256).
 *
 * Structure:
 * - **Finder pattern**: solid bar on left and bottom edges (L-shape)
 * - **Clock pattern**: alternating modules on top and right edges
 * - **Data region**: encoded data + Reed-Solomon error correction
 *
 * This implementation supports ASCII encoding mode (handles most
 * use cases including digits, ASCII printable characters, and extended
 * ASCII), auto-size selection from 10×10 to 132×132, and proper
 * Reed-Solomon error correction.
 *
 * @packageDocumentation
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill } from '../core/operators/graphics.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for rendering a Data Matrix to PDF operators. */
export interface DataMatrixOptions {
  /** Size of each module in PDF points. Default: `2`. */
  readonly moduleSize?: number;
  /** Foreground (dark module) colour. Default: black. */
  readonly color?: Color;
  /** Background colour. Default: white. */
  readonly backgroundColor?: Color;
  /** Number of quiet-zone modules around the code. Default: `1`. */
  readonly quietZone?: number;
}

/** The result of Data Matrix encoding — a boolean matrix. */
export interface DataMatrixResult {
  /** Number of rows in the symbol. */
  readonly rows: number;
  /** Number of columns in the symbol. */
  readonly cols: number;
  /** Row-major boolean array. `true` = dark module. */
  readonly modules: readonly boolean[];
}

// ---------------------------------------------------------------------------
// Symbol size table (ECC200 square sizes)
// ---------------------------------------------------------------------------

/**
 * Each entry: [rows, cols, dataRegionRows, dataRegionCols, dataCodewords, ecCodewords, rsBlockCount, rsBlockDataCW, rsBlockECCW]
 *
 * dataRegionRows/Cols are the size of each data region (excluding
 * finder/clock patterns). For sizes <= 24, there's 1 data region.
 * For larger sizes, the symbol is divided into multiple data regions.
 */
interface SymbolSize {
  readonly rows: number;
  readonly cols: number;
  /** Number of data region rows. */
  readonly mappingRows: number;
  /** Number of data region cols. */
  readonly mappingCols: number;
  /** Number of data codewords. */
  readonly dataCodewords: number;
  /** Number of error correction codewords. */
  readonly ecCodewords: number;
  /** Number of RS blocks. */
  readonly rsBlocks: number;
  /** Number of interleaved regions horizontally. */
  readonly hRegions: number;
  /** Number of interleaved regions vertically. */
  readonly vRegions: number;
}

const SYMBOL_SIZES: readonly SymbolSize[] = [
  // rows, cols, mappingRows, mappingCols, dataCW, ecCW, rsBlocks, hRegions, vRegions
  { rows: 10, cols: 10, mappingRows: 8, mappingCols: 8, dataCodewords: 3, ecCodewords: 5, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 12, cols: 12, mappingRows: 10, mappingCols: 10, dataCodewords: 5, ecCodewords: 7, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 14, cols: 14, mappingRows: 12, mappingCols: 12, dataCodewords: 8, ecCodewords: 10, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 16, cols: 16, mappingRows: 14, mappingCols: 14, dataCodewords: 12, ecCodewords: 12, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 18, cols: 18, mappingRows: 16, mappingCols: 16, dataCodewords: 18, ecCodewords: 14, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 20, cols: 20, mappingRows: 18, mappingCols: 18, dataCodewords: 22, ecCodewords: 18, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 22, cols: 22, mappingRows: 20, mappingCols: 20, dataCodewords: 30, ecCodewords: 20, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 24, cols: 24, mappingRows: 22, mappingCols: 22, dataCodewords: 36, ecCodewords: 24, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  { rows: 26, cols: 26, mappingRows: 24, mappingCols: 24, dataCodewords: 44, ecCodewords: 28, rsBlocks: 1, hRegions: 1, vRegions: 1 },
  // Multi-region sizes (2×2 data regions)
  { rows: 32, cols: 32, mappingRows: 28, mappingCols: 28, dataCodewords: 62, ecCodewords: 36, rsBlocks: 1, hRegions: 2, vRegions: 2 },
  { rows: 36, cols: 36, mappingRows: 32, mappingCols: 32, dataCodewords: 86, ecCodewords: 42, rsBlocks: 1, hRegions: 2, vRegions: 2 },
  { rows: 40, cols: 40, mappingRows: 36, mappingCols: 36, dataCodewords: 114, ecCodewords: 48, rsBlocks: 1, hRegions: 2, vRegions: 2 },
  { rows: 44, cols: 44, mappingRows: 40, mappingCols: 40, dataCodewords: 144, ecCodewords: 56, rsBlocks: 1, hRegions: 2, vRegions: 2 },
  { rows: 48, cols: 48, mappingRows: 44, mappingCols: 44, dataCodewords: 174, ecCodewords: 68, rsBlocks: 1, hRegions: 2, vRegions: 2 },
  // Multi-region sizes (2×2 data regions, multiple RS blocks)
  { rows: 52, cols: 52, mappingRows: 48, mappingCols: 48, dataCodewords: 204, ecCodewords: 84, rsBlocks: 2, hRegions: 2, vRegions: 2 },
  { rows: 64, cols: 64, mappingRows: 56, mappingCols: 56, dataCodewords: 280, ecCodewords: 112, rsBlocks: 2, hRegions: 4, vRegions: 4 },
  { rows: 72, cols: 72, mappingRows: 64, mappingCols: 64, dataCodewords: 368, ecCodewords: 144, rsBlocks: 4, hRegions: 4, vRegions: 4 },
  { rows: 80, cols: 80, mappingRows: 72, mappingCols: 72, dataCodewords: 456, ecCodewords: 192, rsBlocks: 4, hRegions: 4, vRegions: 4 },
  { rows: 88, cols: 88, mappingRows: 80, mappingCols: 80, dataCodewords: 576, ecCodewords: 224, rsBlocks: 4, hRegions: 4, vRegions: 4 },
  { rows: 96, cols: 96, mappingRows: 88, mappingCols: 88, dataCodewords: 696, ecCodewords: 272, rsBlocks: 4, hRegions: 4, vRegions: 4 },
  { rows: 104, cols: 104, mappingRows: 96, mappingCols: 96, dataCodewords: 816, ecCodewords: 336, rsBlocks: 6, hRegions: 4, vRegions: 4 },
  { rows: 120, cols: 120, mappingRows: 108, mappingCols: 108, dataCodewords: 1050, ecCodewords: 408, rsBlocks: 6, hRegions: 6, vRegions: 6 },
  { rows: 132, cols: 132, mappingRows: 120, mappingCols: 120, dataCodewords: 1304, ecCodewords: 496, rsBlocks: 8, hRegions: 6, vRegions: 6 },
  { rows: 144, cols: 144, mappingRows: 132, mappingCols: 132, dataCodewords: 1558, ecCodewords: 620, rsBlocks: 10, hRegions: 6, vRegions: 6 },
];

// ---------------------------------------------------------------------------
// GF(256) arithmetic for Reed-Solomon
// Polynomial: x^8 + x^5 + x^3 + x^2 + 1 (0x12D)
// ---------------------------------------------------------------------------

const DM_GF_EXP = new Uint8Array(510);
const DM_GF_LOG = new Uint8Array(256);

// Build log/antilog tables for Data Matrix GF(256)
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    DM_GF_EXP[i] = x;
    DM_GF_LOG[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x12d; // x^8 + x^5 + x^3 + x^2 + 1
  }
  // Extend for easier modular reduction
  for (let i = 255; i < 510; i++) {
    DM_GF_EXP[i] = DM_GF_EXP[i - 255]!;
  }
}

/** Multiply two GF(256) elements using Data Matrix polynomial. */
function dmGfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return DM_GF_EXP[(DM_GF_LOG[a]! + DM_GF_LOG[b]!) % 255]!;
}

/**
 * Generate a Reed-Solomon generator polynomial for Data Matrix.
 * Generator: prod(x - a^i) for i = 1..numEC, where a is the primitive element.
 * Returns coefficients in descending order [x^n, x^(n-1), ..., x^0].
 */
function dmRsGeneratorPoly(numEC: number): Uint8Array {
  const gen = new Uint8Array(numEC + 1);
  gen[numEC] = 1;

  for (let i = 1; i <= numEC; i++) {
    for (let j = numEC - i; j < numEC; j++) {
      gen[j] = gen[j + 1]! ^ dmGfMul(gen[j]!, DM_GF_EXP[i]!);
    }
    gen[numEC] = dmGfMul(gen[numEC]!, DM_GF_EXP[i]!);
  }

  return gen;
}

/**
 * Compute Reed-Solomon error correction codewords for Data Matrix.
 */
function dmRsEncode(data: Uint8Array, numEC: number): Uint8Array {
  const gen = dmRsGeneratorPoly(numEC);
  const ecc = new Uint8Array(numEC);

  for (let i = 0; i < data.length; i++) {
    const coeff = data[i]! ^ ecc[0]!;
    // Shift ecc left by 1
    for (let j = 0; j < numEC - 1; j++) {
      ecc[j] = ecc[j + 1]! ^ dmGfMul(coeff, gen[j]!);
    }
    ecc[numEC - 1] = dmGfMul(coeff, gen[numEC - 1]!);
  }

  return ecc;
}

// ---------------------------------------------------------------------------
// Data encoding — ASCII mode
// ---------------------------------------------------------------------------

/**
 * Encode a string into Data Matrix codewords using ASCII encoding mode.
 *
 * ASCII mode:
 * - Two digits (00-99): encoded as value + 130 (single codeword for digit pairs)
 * - ASCII 0-127: encoded as value + 1
 * - ASCII 128-255: encoded as 235 followed by (value - 127)
 *
 * Special values:
 * - 129: padding codeword
 */
function encodeAsciiMode(data: string): number[] {
  const codewords: number[] = [];
  let i = 0;

  while (i < data.length) {
    const c = data.charCodeAt(i);

    // Check for digit pair
    if (
      i + 1 < data.length &&
      c >= 0x30 && c <= 0x39 &&
      data.charCodeAt(i + 1) >= 0x30 && data.charCodeAt(i + 1) <= 0x39
    ) {
      // Encode digit pair as (numeric value + 130)
      const num = (c - 0x30) * 10 + (data.charCodeAt(i + 1) - 0x30);
      codewords.push(num + 130);
      i += 2;
    } else if (c >= 0 && c <= 127) {
      // ASCII 0-127: value + 1
      codewords.push(c + 1);
      i++;
    } else if (c >= 128 && c <= 255) {
      // Extended ASCII: Upper Shift + (value - 127)
      codewords.push(235);
      codewords.push(c - 127);
      i++;
    } else {
      // Characters outside 0-255 range — encode as '?'
      codewords.push(0x3f + 1); // '?' = 63, codeword = 64
      i++;
    }
  }

  return codewords;
}

// ---------------------------------------------------------------------------
// Size selection
// ---------------------------------------------------------------------------

/**
 * Select the smallest symbol size that can hold the given number
 * of data codewords.
 */
function selectSymbolSize(dataLength: number): SymbolSize {
  for (const size of SYMBOL_SIZES) {
    if (dataLength <= size.dataCodewords) {
      return size;
    }
  }
  throw new Error(
    `Data too long for Data Matrix: ${dataLength} codewords exceed maximum capacity of ${SYMBOL_SIZES[SYMBOL_SIZES.length - 1]!.dataCodewords}`,
  );
}

// ---------------------------------------------------------------------------
// Padding
// ---------------------------------------------------------------------------

/**
 * Add padding codewords to fill the data capacity.
 * The first pad codeword is always 129.
 * Subsequent pad codewords use the 253-state pseudo-random algorithm.
 */
function padCodewords(codewords: number[], capacity: number): number[] {
  const result = [...codewords];

  if (result.length < capacity) {
    result.push(129); // First pad is always 129
  }

  while (result.length < capacity) {
    // Randomized padding: ((129 * (position + 1)) % 254) + 1
    // where position is the 1-based index of this codeword
    const position = result.length + 1;
    const padValue = ((149 * position) % 253) + 1;
    result.push(padValue);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Module placement — ECC200 standard placement algorithm
// ---------------------------------------------------------------------------

/**
 * The standard "utah" module placement algorithm for Data Matrix ECC200.
 *
 * This places each 8-bit codeword into an L-shaped (utah) pattern
 * across the data region. The algorithm walks through the matrix in a
 * diagonal pattern, handling corner cases for modules that would fall
 * outside the matrix bounds.
 */
function placeModules(
  mappingRows: number,
  mappingCols: number,
  codewords: Uint8Array,
): Int8Array {
  // The placement array: -1 = unset, 0 = light, 1 = dark
  const matrix = new Int8Array(mappingRows * mappingCols);
  matrix.fill(-1);

  /**
   * Place a single bit of a codeword at position (row, col) in the
   * mapping matrix. The bit is extracted from the codeword at the given
   * bit position (7 = MSB, 0 = LSB).
   */
  function placeModule(row: number, col: number, codewordIdx: number, bitMask: number): void {
    // Wrap around if position is outside bounds
    if (row < 0) {
      row += mappingRows;
      col += 4 - ((mappingRows + 4) % 8);
    }
    if (col < 0) {
      col += mappingCols;
      row += 4 - ((mappingCols + 4) % 8);
    }

    // Bounds check after wrapping
    if (row >= 0 && row < mappingRows && col >= 0 && col < mappingCols) {
      if (matrix[row * mappingCols + col] === -1) {
        const bit = codewordIdx < codewords.length
          ? ((codewords[codewordIdx]! & bitMask) !== 0 ? 1 : 0)
          : 0;
        matrix[row * mappingCols + col] = bit;
      }
    }
  }

  /**
   * Place an 8-bit codeword in the standard "utah" pattern.
   * The utah shape places 8 modules in an L-shape relative to
   * the nominal position (row, col) which is the bottom-right corner.
   */
  function placeUtah(row: number, col: number, codewordIdx: number): void {
    placeModule(row - 2, col - 2, codewordIdx, 0x80);
    placeModule(row - 2, col - 1, codewordIdx, 0x40);
    placeModule(row - 1, col - 2, codewordIdx, 0x20);
    placeModule(row - 1, col - 1, codewordIdx, 0x10);
    placeModule(row - 1, col,     codewordIdx, 0x08);
    placeModule(row,     col - 2, codewordIdx, 0x04);
    placeModule(row,     col - 1, codewordIdx, 0x02);
    placeModule(row,     col,     codewordIdx, 0x01);
  }

  // Corner cases — special placement patterns for the 4 corners
  function placeCorner1(codewordIdx: number): void {
    placeModule(mappingRows - 1, 0, codewordIdx, 0x80);
    placeModule(mappingRows - 1, 1, codewordIdx, 0x40);
    placeModule(mappingRows - 1, 2, codewordIdx, 0x20);
    placeModule(0, mappingCols - 2, codewordIdx, 0x10);
    placeModule(0, mappingCols - 1, codewordIdx, 0x08);
    placeModule(1, mappingCols - 1, codewordIdx, 0x04);
    placeModule(2, mappingCols - 1, codewordIdx, 0x02);
    placeModule(3, mappingCols - 1, codewordIdx, 0x01);
  }

  function placeCorner2(codewordIdx: number): void {
    placeModule(mappingRows - 3, 0, codewordIdx, 0x80);
    placeModule(mappingRows - 2, 0, codewordIdx, 0x40);
    placeModule(mappingRows - 1, 0, codewordIdx, 0x20);
    placeModule(0, mappingCols - 4, codewordIdx, 0x10);
    placeModule(0, mappingCols - 3, codewordIdx, 0x08);
    placeModule(0, mappingCols - 2, codewordIdx, 0x04);
    placeModule(0, mappingCols - 1, codewordIdx, 0x02);
    placeModule(1, mappingCols - 1, codewordIdx, 0x01);
  }

  function placeCorner3(codewordIdx: number): void {
    placeModule(mappingRows - 3, 0, codewordIdx, 0x80);
    placeModule(mappingRows - 2, 0, codewordIdx, 0x40);
    placeModule(mappingRows - 1, 0, codewordIdx, 0x20);
    placeModule(0, mappingCols - 2, codewordIdx, 0x10);
    placeModule(0, mappingCols - 1, codewordIdx, 0x08);
    placeModule(1, mappingCols - 1, codewordIdx, 0x04);
    placeModule(2, mappingCols - 1, codewordIdx, 0x02);
    placeModule(3, mappingCols - 1, codewordIdx, 0x01);
  }

  function placeCorner4(codewordIdx: number): void {
    placeModule(mappingRows - 1, 0, codewordIdx, 0x80);
    placeModule(mappingRows - 1, mappingCols - 1, codewordIdx, 0x40);
    placeModule(0, mappingCols - 3, codewordIdx, 0x20);
    placeModule(0, mappingCols - 2, codewordIdx, 0x10);
    placeModule(0, mappingCols - 1, codewordIdx, 0x08);
    placeModule(1, mappingCols - 3, codewordIdx, 0x04);
    placeModule(1, mappingCols - 2, codewordIdx, 0x02);
    placeModule(1, mappingCols - 1, codewordIdx, 0x01);
  }

  // Main placement loop
  let row = 4;
  let col = 0;
  let codewordIdx = 0;

  // Place codewords using the standard diagonal sweep
  do {
    // Corner cases
    if (row === mappingRows && col === 0) {
      placeCorner1(codewordIdx++);
    }
    if (row === mappingRows - 2 && col === 0 && mappingCols % 4 !== 0) {
      placeCorner2(codewordIdx++);
    }
    if (row === mappingRows - 2 && col === 0 && mappingCols % 8 === 4) {
      placeCorner3(codewordIdx++);
    }
    if (row === mappingRows + 4 && col === 2 && mappingCols % 8 === 0) {
      placeCorner4(codewordIdx++);
    }

    // Sweep upward/right
    do {
      if (row < mappingRows && col >= 0 && matrix[row * mappingCols + col] === -1) {
        placeUtah(row, col, codewordIdx++);
      }
      row -= 2;
      col += 2;
    } while (row >= 0 && col < mappingCols);
    row += 1;
    col += 3;

    // Sweep downward/left
    do {
      if (row >= 0 && col < mappingCols && matrix[row * mappingCols + col] === -1) {
        placeUtah(row, col, codewordIdx++);
      }
      row += 2;
      col -= 2;
    } while (row < mappingRows && col >= 0);
    row += 3;
    col += 1;
  } while (row < mappingRows || col < mappingCols);

  // Fill any remaining unset cells with 0
  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i] === -1) {
      matrix[i] = 0;
    }
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// Build the full symbol matrix (with finder/clock patterns)
// ---------------------------------------------------------------------------

/**
 * Build the full Data Matrix symbol including finder pattern (solid L-shape
 * on bottom and left), clock pattern (alternating on top and right), and
 * alignment patterns for multi-region symbols.
 */
function buildSymbol(
  symbolSize: SymbolSize,
  mappingMatrix: Int8Array,
): boolean[] {
  const { rows, cols, mappingRows, mappingCols, hRegions, vRegions } = symbolSize;
  const modules = new Array<boolean>(rows * cols).fill(false);

  const regionWidth = mappingCols / hRegions;   // data cols per region
  const regionHeight = mappingRows / vRegions;  // data rows per region

  // Helper to set a module in the full symbol
  function set(row: number, col: number, dark: boolean): void {
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      modules[row * cols + col] = dark;
    }
  }

  // Draw the finder/clock patterns for each region
  for (let vr = 0; vr < vRegions; vr++) {
    for (let hr = 0; hr < hRegions; hr++) {
      // Each region occupies (regionHeight + 2) rows and (regionWidth + 2) cols
      // in the full symbol (2 extra for finder/clock edges)
      const baseRow = vr * (regionHeight + 2);
      const baseCol = hr * (regionWidth + 2);

      // Bottom edge: solid finder bar (dark)
      // In the symbol, the bottom edge of a region is the row at
      // baseRow + regionHeight + 1
      const bottomRow = baseRow + regionHeight + 1;
      for (let c = 0; c <= regionWidth + 1; c++) {
        set(bottomRow, baseCol + c, true);
      }

      // Left edge: solid finder bar (dark)
      for (let r = 0; r <= regionHeight + 1; r++) {
        set(baseRow + r, baseCol, true);
      }

      // Top edge: alternating clock pattern (dark on even columns)
      for (let c = 0; c <= regionWidth + 1; c++) {
        set(baseRow, baseCol + c, c % 2 === 0);
      }

      // Right edge: alternating clock pattern (dark on even distance from bottom)
      const rightCol = baseCol + regionWidth + 1;
      for (let r = 0; r <= regionHeight + 1; r++) {
        // The right edge alternates: dark when (row distance from bottom) is even
        const fromBottom = bottomRow - (baseRow + r);
        set(baseRow + r, rightCol, fromBottom % 2 === 0);
      }
    }
  }

  // Place data modules from the mapping matrix into the data regions
  for (let vr = 0; vr < vRegions; vr++) {
    for (let hr = 0; hr < hRegions; hr++) {
      const baseRow = vr * (regionHeight + 2);
      const baseCol = hr * (regionWidth + 2);

      for (let r = 0; r < regionHeight; r++) {
        for (let c = 0; c < regionWidth; c++) {
          // Mapping matrix index
          const mappingRow = vr * regionHeight + r;
          const mappingCol = hr * regionWidth + c;
          const dark = mappingMatrix[mappingRow * mappingCols + mappingCol] === 1;

          // Symbol position: inside the region, offset by 1 for the
          // finder/clock patterns (top and left edges)
          // Row is flipped: mapping row 0 = top of data region
          set(baseRow + regionHeight - r, baseCol + c + 1, dark);
        }
      }
    }
  }

  return modules;
}

// ---------------------------------------------------------------------------
// Main encoder
// ---------------------------------------------------------------------------

/**
 * Encode a string as a Data Matrix ECC200 symbol.
 *
 * @param data  The string to encode (ASCII characters supported).
 * @returns     A {@link DataMatrixResult} with the encoded symbol.
 * @throws      If the data exceeds maximum capacity.
 */
export function encodeDataMatrix(data: string): DataMatrixResult {
  // Step 1: Encode data in ASCII mode
  const dataCW = encodeAsciiMode(data);

  // Step 2: Select symbol size
  const symbolSize = selectSymbolSize(dataCW.length);

  // Step 3: Pad to fill data capacity
  const paddedCW = padCodewords(dataCW, symbolSize.dataCodewords);

  // Step 4: Generate Reed-Solomon error correction
  const ecPerBlock = symbolSize.ecCodewords / symbolSize.rsBlocks;
  const dataPerBlock = symbolSize.dataCodewords / symbolSize.rsBlocks;

  // Interleave data across RS blocks and compute ECC for each block
  const allCodewords = new Uint8Array(symbolSize.dataCodewords + symbolSize.ecCodewords);

  // Split data into blocks, compute ECC, then interleave
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  for (let b = 0; b < symbolSize.rsBlocks; b++) {
    // De-interleave: block b gets codewords at positions b, b+rsBlocks, b+2*rsBlocks, ...
    const blockData = new Uint8Array(dataPerBlock);
    for (let i = 0; i < dataPerBlock; i++) {
      blockData[i] = paddedCW[b + i * symbolSize.rsBlocks]!;
    }
    dataBlocks.push(blockData);
    ecBlocks.push(dmRsEncode(blockData, ecPerBlock));
  }

  // Interleave data codewords
  let idx = 0;
  for (let i = 0; i < dataPerBlock; i++) {
    for (let b = 0; b < symbolSize.rsBlocks; b++) {
      allCodewords[idx++] = dataBlocks[b]![i]!;
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < symbolSize.rsBlocks; b++) {
      allCodewords[idx++] = ecBlocks[b]![i]!;
    }
  }

  // Step 5: Place modules using the standard placement algorithm
  const mappingMatrix = placeModules(
    symbolSize.mappingRows,
    symbolSize.mappingCols,
    allCodewords,
  );

  // Step 6: Build the full symbol with finder/clock patterns
  const modules = buildSymbol(symbolSize, mappingMatrix);

  return {
    rows: symbolSize.rows,
    cols: symbolSize.cols,
    modules,
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
 * Convert a {@link DataMatrixResult} to PDF content-stream operators.
 *
 * The Data Matrix is rendered as filled rectangles (one per dark module),
 * positioned at `(x, y)` in PDF user-space coordinates. The `y`
 * coordinate refers to the **bottom-left** corner of the symbol.
 *
 * @param matrix   The Data Matrix from {@link encodeDataMatrix}.
 * @param x        X position in PDF points.
 * @param y        Y position in PDF points.
 * @param options  Rendering options (module size, quiet zone, colours).
 * @returns        A string of PDF content-stream operators.
 */
export function dataMatrixToOperators(
  matrix: DataMatrixResult,
  x: number,
  y: number,
  options: DataMatrixOptions = {},
): string {
  const moduleSize = options.moduleSize ?? 2;
  const quietZone = options.quietZone ?? 1;
  const fgColor = options.color ?? { type: 'grayscale' as const, gray: 0 };
  const bgColor = options.backgroundColor ?? { type: 'grayscale' as const, gray: 1 };

  const totalWidth = (matrix.cols + 2 * quietZone) * moduleSize;
  const totalHeight = (matrix.rows + 2 * quietZone) * moduleSize;
  let ops = '';

  ops += saveState();

  // Draw background
  ops += applyFillColor(bgColor);
  ops += rectangle(x, y, totalWidth, totalHeight);
  ops += fill();

  // Draw dark modules
  ops += applyFillColor(fgColor);

  for (let row = 0; row < matrix.rows; row++) {
    for (let col = 0; col < matrix.cols; col++) {
      if (matrix.modules[row * matrix.cols + col]) {
        // PDF coordinate system: y=0 is bottom.
        // Data Matrix row 0 = top of symbol.
        // So we flip: PDF y for row r = y + (quietZone + rows - 1 - r) * moduleSize
        const px = x + (quietZone + col) * moduleSize;
        const py = y + (quietZone + matrix.rows - 1 - row) * moduleSize;
        ops += rectangle(px, py, moduleSize, moduleSize);
      }
    }
  }

  ops += fill();

  ops += restoreState();

  return ops;
}

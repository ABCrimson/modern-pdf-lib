/**
 * @module barcode/ean
 *
 * EAN-13 and EAN-8 barcode encoding and PDF operator generation.
 *
 * EAN-13 encodes 13 digits (12 data + 1 check).
 * EAN-8  encodes  8 digits ( 7 data + 1 check).
 *
 * Reference: GS1 General Specifications, Section 5.2.
 */

import { rectangle } from '../core/operators/graphics.js';
import { fill } from '../core/operators/graphics.js';
import { saveState, restoreState } from '../core/operators/state.js';
import { applyFillColor } from '../core/operators/color.js';
import type { Color } from '../core/operators/color.js';
import type { BarcodeMatrix, BarcodeOptions } from './types.js';

// Re-export the options type under an EAN-specific alias for convenience.
export type { BarcodeOptions as EanOptions } from './types.js';

// ---------------------------------------------------------------------------
// Encoding tables
// ---------------------------------------------------------------------------

/**
 * L patterns (odd parity) for digits 0-9.
 * Each string is 7 modules: '0' = space, '1' = bar.
 */
const L_PATTERNS: readonly string[] = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011', // 9
];

/**
 * G patterns (even parity, mirror of R) for digits 0-9.
 */
const G_PATTERNS: readonly string[] = [
  '0100111', // 0
  '0110011', // 1
  '0011011', // 2
  '0100001', // 3
  '0011101', // 4
  '0111001', // 5
  '0000101', // 6
  '0010001', // 7
  '0001001', // 8
  '0010111', // 9
];

/**
 * R patterns for digits 0-9.
 */
const R_PATTERNS: readonly string[] = [
  '1110010', // 0
  '1100110', // 1
  '1101100', // 2
  '1000010', // 3
  '1011100', // 4
  '1001110', // 5
  '1010000', // 6
  '1000100', // 7
  '1001000', // 8
  '1110100', // 9
];

/**
 * Parity patterns for the first digit of EAN-13.
 * 'L' = use L pattern, 'G' = use G pattern for the corresponding
 * left-side digit (positions 1-6).
 */
const FIRST_DIGIT_PARITY: readonly string[] = [
  'LLLLLL', // 0
  'LLGLGG', // 1
  'LLGGLG', // 2
  'LLGGGL', // 3
  'LGLLGG', // 4
  'LGGLLG', // 5
  'LGGGLL', // 6
  'LGLGLG', // 7
  'LGLGGL', // 8
  'LGGLGL', // 9
];

/** Start / end guard pattern: bar-space-bar. */
const START_END_GUARD = '101';

/** Centre guard pattern: space-bar-space-bar-space. */
const CENTER_GUARD = '01010';

// ---------------------------------------------------------------------------
// Check-digit calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the EAN / UPC check digit using the Modulo-10 algorithm.
 *
 * Works for both EAN-13 (pass 12 digits) and EAN-8 (pass 7 digits).
 * The algorithm weights digits alternately by 1 and 3 starting from
 * the rightmost position.
 *
 * @param data  Numeric string of 7 or 12 digits (without check digit).
 * @returns     The single check digit (0-9).
 */
export function calculateEanCheckDigit(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const digit = Number(data[i]);
    // Weights: positions counted from the right.  The check digit
    // position itself has weight 1, so the digit immediately to its
    // left has weight 3, the next 1, etc.  Since we iterate left-to-right
    // and the check digit is not yet included, the weight alternates
    // starting with 1 for even-length prefixes (12 digits for EAN-13)
    // and 3 for odd-length prefixes (7 digits for EAN-8).
    const weight = ((data.length - 1 - i) % 2 === 0) ? 3 : 1;
    sum += digit * weight;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// ---------------------------------------------------------------------------
// EAN-13 encoding
// ---------------------------------------------------------------------------

/**
 * Encode an EAN-13 barcode.
 *
 * @param data  12- or 13-digit numeric string.  If 12 digits are given
 *              the check digit is calculated and appended.  If 13 digits
 *              are given the last digit is validated as the correct check.
 * @returns     A {@link BarcodeMatrix} with 95 modules (the standard EAN-13
 *              symbol width without quiet zones).
 * @throws      If the input is not 12 or 13 numeric digits, or if a
 *              provided check digit does not match.
 */
export function encodeEan13(data: string): BarcodeMatrix {
  validateNumeric(data, 'EAN-13');

  if (data.length === 12) {
    data = data + calculateEanCheckDigit(data).toString();
  } else if (data.length === 13) {
    const expected = calculateEanCheckDigit(data.slice(0, 12));
    if (Number(data[12]) !== expected) {
      throw new Error(
        `EAN-13 check digit mismatch: expected ${expected}, got ${data[12]}`,
      );
    }
  } else {
    throw new Error(
      `EAN-13 data must be 12 or 13 digits, got ${data.length}`,
    );
  }

  const firstDigit = Number(data[0]);
  const parity = FIRST_DIGIT_PARITY[firstDigit]!;

  let bits = START_END_GUARD; // 3 modules

  // Left side: digits 1-6 (data[1]..data[6])
  for (let i = 0; i < 6; i++) {
    const digit = Number(data[i + 1]);
    bits += parity[i] === 'L' ? L_PATTERNS[digit]! : G_PATTERNS[digit]!;
  }

  bits += CENTER_GUARD; // 5 modules

  // Right side: digits 7-12 (data[7]..data[12])
  for (let i = 7; i <= 12; i++) {
    const digit = Number(data[i]);
    bits += R_PATTERNS[digit]!;
  }

  bits += START_END_GUARD; // 3 modules

  return bitsToMatrix(bits);
}

// ---------------------------------------------------------------------------
// EAN-8 encoding
// ---------------------------------------------------------------------------

/**
 * Encode an EAN-8 barcode.
 *
 * @param data  7- or 8-digit numeric string.  If 7 digits are given
 *              the check digit is calculated and appended.  If 8 digits
 *              are given the last digit is validated.
 * @returns     A {@link BarcodeMatrix} with 67 modules.
 * @throws      If the input is invalid.
 */
export function encodeEan8(data: string): BarcodeMatrix {
  validateNumeric(data, 'EAN-8');

  if (data.length === 7) {
    data = data + calculateEanCheckDigit(data).toString();
  } else if (data.length === 8) {
    const expected = calculateEanCheckDigit(data.slice(0, 7));
    if (Number(data[7]) !== expected) {
      throw new Error(
        `EAN-8 check digit mismatch: expected ${expected}, got ${data[7]}`,
      );
    }
  } else {
    throw new Error(
      `EAN-8 data must be 7 or 8 digits, got ${data.length}`,
    );
  }

  let bits = START_END_GUARD; // 3 modules

  // Left side: digits 0-3 — always L patterns
  for (let i = 0; i < 4; i++) {
    const digit = Number(data[i]);
    bits += L_PATTERNS[digit]!;
  }

  bits += CENTER_GUARD; // 5 modules

  // Right side: digits 4-7 — always R patterns
  for (let i = 4; i < 8; i++) {
    const digit = Number(data[i]);
    bits += R_PATTERNS[digit]!;
  }

  bits += START_END_GUARD; // 3 modules

  return bitsToMatrix(bits);
}

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

/** Default option values. */
const DEFAULTS = {
  height: 50,
  moduleWidth: 1,
  quietZone: 10,
  fontSize: 10,
} as const;

/**
 * Generate PDF content-stream operators for an EAN-13 barcode.
 *
 * The barcode is rendered as filled rectangles (one per contiguous run
 * of dark modules) inside a `q … Q` graphics-state block.
 *
 * @param matrix   Encoded barcode from {@link encodeEan13}.
 * @param x        Lower-left x coordinate of the barcode (including quiet zone).
 * @param y        Lower-left y coordinate.
 * @param options  Rendering options.
 * @returns        A string of PDF operators ready to be appended to a
 *                 content stream.
 */
export function ean13ToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: BarcodeOptions,
): string {
  return matrixToOperators(matrix, x, y, options);
}

/**
 * Generate PDF content-stream operators for an EAN-8 barcode.
 *
 * @param matrix   Encoded barcode from {@link encodeEan8}.
 * @param x        Lower-left x coordinate (including quiet zone).
 * @param y        Lower-left y coordinate.
 * @param options  Rendering options.
 * @returns        A string of PDF operators.
 */
export function ean8ToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: BarcodeOptions,
): string {
  return matrixToOperators(matrix, x, y, options);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a string consists only of ASCII digits.
 */
function validateNumeric(data: string, label: string): void {
  if (!/^\d+$/.test(data)) {
    throw new Error(`${label} data must contain only digits: "${data}"`);
  }
}

/**
 * Convert a bit string ('0' / '1') into a {@link BarcodeMatrix}.
 */
function bitsToMatrix(bits: string): BarcodeMatrix {
  const modules: boolean[] = [];
  for (let i = 0; i < bits.length; i++) {
    modules.push(bits[i] === '1');
  }
  return { modules, width: modules.length };
}

/**
 * Shared operator generation for EAN-13 / EAN-8 / UPC-A.
 *
 * Renders each contiguous run of dark modules as a single filled
 * rectangle, which is more efficient than one rectangle per module.
 */
export function matrixToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: BarcodeOptions,
): string {
  const h = options?.height ?? DEFAULTS.height;
  const mw = options?.moduleWidth ?? DEFAULTS.moduleWidth;
  const qz = options?.quietZone ?? DEFAULTS.quietZone;
  const color: Color | undefined = options?.color;

  let ops = saveState();

  // Set bar colour if specified
  if (color) {
    ops += applyFillColor(color);
  } else {
    // Default to black
    ops += '0 g\n'; // setFillColorGray(0)
  }

  // Offset by quiet zone
  const startX = x + qz * mw;

  // Walk modules and merge contiguous dark runs
  let runStart = -1;
  for (let i = 0; i <= matrix.width; i++) {
    const dark = i < matrix.width && matrix.modules[i];
    if (dark && runStart < 0) {
      runStart = i;
    } else if (!dark && runStart >= 0) {
      // Emit rectangle for the run
      const rx = startX + runStart * mw;
      const rw = (i - runStart) * mw;
      ops += rectangle(rx, y, rw, h);
      runStart = -1;
    }
  }

  ops += fill();
  ops += restoreState();

  return ops;
}

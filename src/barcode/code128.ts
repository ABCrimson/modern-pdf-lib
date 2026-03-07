/**
 * @module barcode/code128
 *
 * Code 128 barcode encoding with automatic A/B/C code-set switching,
 * modulo-103 check digit calculation, and native PDF vector rendering.
 *
 * Code 128 uses three character sets:
 * - **Code A**: ASCII 0-95 (control chars, digits, uppercase)
 * - **Code B**: ASCII 32-127 (digits, uppercase, lowercase)
 * - **Code C**: Numeric pairs 00-99 (double density)
 *
 * Each symbol is encoded as 6 bars and 6 spaces (11 modules wide),
 * except the STOP pattern which is 13 modules wide.
 *
 * Reference: ISO/IEC 15417:2007
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import type { BarcodeMatrix } from './types.js';

// ---------------------------------------------------------------------------
// Code 128 bar patterns (107 symbols: values 0-106)
//
// Each pattern is an array of 6 elements representing alternating
// bar/space widths. The STOP pattern (106) has 7 elements.
// ---------------------------------------------------------------------------

const CODE128_PATTERNS: readonly (readonly number[])[] = [
  [2, 1, 2, 2, 2, 2], //   0
  [2, 2, 2, 1, 2, 2], //   1
  [2, 2, 2, 2, 2, 1], //   2
  [1, 2, 1, 2, 2, 3], //   3
  [1, 2, 1, 3, 2, 2], //   4
  [1, 3, 1, 2, 2, 2], //   5
  [1, 2, 2, 2, 1, 3], //   6
  [1, 2, 2, 3, 1, 2], //   7
  [1, 3, 2, 2, 1, 2], //   8
  [2, 2, 1, 2, 1, 3], //   9
  [2, 2, 1, 3, 1, 2], //  10
  [2, 3, 1, 2, 1, 2], //  11
  [1, 1, 2, 2, 3, 2], //  12
  [1, 2, 2, 1, 3, 2], //  13
  [1, 2, 2, 2, 3, 1], //  14
  [1, 1, 3, 2, 2, 2], //  15
  [1, 2, 3, 1, 2, 2], //  16
  [1, 2, 3, 2, 2, 1], //  17
  [2, 2, 3, 2, 1, 1], //  18
  [2, 2, 1, 1, 3, 2], //  19
  [2, 2, 1, 2, 3, 1], //  20
  [2, 1, 3, 2, 1, 2], //  21
  [2, 2, 3, 1, 1, 2], //  22
  [3, 1, 2, 1, 3, 1], //  23
  [3, 1, 1, 2, 2, 2], //  24
  [3, 2, 1, 1, 2, 2], //  25
  [3, 2, 1, 2, 2, 1], //  26
  [3, 1, 2, 2, 1, 2], //  27
  [3, 2, 2, 1, 1, 2], //  28
  [3, 2, 2, 2, 1, 1], //  29
  [2, 1, 2, 1, 2, 3], //  30
  [2, 1, 2, 3, 2, 1], //  31
  [2, 3, 2, 1, 2, 1], //  32
  [1, 1, 1, 3, 2, 3], //  33
  [1, 3, 1, 1, 2, 3], //  34
  [1, 3, 1, 3, 2, 1], //  35
  [1, 1, 2, 3, 1, 3], //  36
  [1, 3, 2, 1, 1, 3], //  37
  [1, 3, 2, 3, 1, 1], //  38
  [2, 1, 1, 3, 1, 3], //  39
  [2, 3, 1, 1, 1, 3], //  40
  [2, 3, 1, 3, 1, 1], //  41
  [1, 1, 2, 1, 3, 3], //  42
  [1, 1, 2, 3, 3, 1], //  43
  [1, 3, 2, 1, 3, 1], //  44
  [1, 1, 3, 1, 2, 3], //  45
  [1, 1, 3, 3, 2, 1], //  46
  [1, 3, 3, 1, 2, 1], //  47
  [3, 1, 3, 1, 2, 1], //  48
  [2, 1, 1, 3, 3, 1], //  49
  [2, 3, 1, 1, 3, 1], //  50
  [2, 1, 3, 1, 1, 3], //  51
  [2, 1, 3, 3, 1, 1], //  52
  [2, 1, 3, 1, 3, 1], //  53
  [3, 1, 1, 1, 2, 3], //  54
  [3, 1, 1, 3, 2, 1], //  55
  [3, 3, 1, 1, 2, 1], //  56
  [3, 1, 2, 1, 1, 3], //  57
  [3, 1, 2, 3, 1, 1], //  58
  [3, 3, 2, 1, 1, 1], //  59
  [3, 1, 4, 1, 1, 1], //  60
  [2, 2, 1, 4, 1, 1], //  61
  [4, 3, 1, 1, 1, 1], //  62
  [1, 1, 1, 2, 2, 4], //  63
  [1, 1, 1, 4, 2, 2], //  64
  [1, 2, 1, 1, 2, 4], //  65
  [1, 2, 1, 4, 2, 1], //  66
  [1, 4, 1, 1, 2, 2], //  67
  [1, 4, 1, 2, 2, 1], //  68
  [1, 1, 2, 2, 1, 4], //  69
  [1, 1, 2, 4, 1, 2], //  70
  [1, 2, 2, 1, 1, 4], //  71
  [1, 2, 2, 4, 1, 1], //  72
  [1, 4, 2, 1, 1, 2], //  73
  [1, 4, 2, 2, 1, 1], //  74
  [2, 4, 1, 2, 1, 1], //  75
  [2, 2, 1, 1, 1, 4], //  76
  [4, 1, 3, 1, 1, 1], //  77
  [2, 4, 1, 1, 1, 2], //  78
  [1, 3, 4, 1, 1, 1], //  79
  [1, 1, 1, 2, 4, 2], //  80
  [1, 2, 1, 1, 4, 2], //  81
  [1, 2, 1, 2, 4, 1], //  82
  [1, 1, 4, 2, 1, 2], //  83
  [1, 2, 4, 1, 1, 2], //  84
  [1, 2, 4, 2, 1, 1], //  85
  [4, 1, 1, 2, 1, 2], //  86
  [4, 2, 1, 1, 1, 2], //  87
  [4, 2, 1, 2, 1, 1], //  88
  [2, 1, 2, 1, 4, 1], //  89
  [2, 1, 4, 1, 2, 1], //  90
  [4, 1, 2, 1, 2, 1], //  91
  [1, 1, 1, 1, 4, 3], //  92
  [1, 1, 1, 3, 4, 1], //  93
  [1, 3, 1, 1, 4, 1], //  94
  [1, 1, 4, 1, 1, 3], //  95
  [1, 1, 4, 3, 1, 1], //  96
  [4, 1, 1, 1, 1, 3], //  97
  [4, 1, 1, 3, 1, 1], //  98
  [1, 1, 3, 1, 4, 1], //  99
  [1, 1, 4, 1, 3, 1], // 100  CODE B (when in A) / CODE A (when in B) / CODE A (when in C)
  [3, 1, 1, 1, 4, 1], // 101  CODE C (when in A) / CODE C (when in B) / CODE B (when in C)
  [4, 1, 1, 1, 3, 1], // 102  SHIFT (toggles A<->B for one char) / FNC 4
  [1, 1, 2, 3, 3, 1], // 103  START A
  [1, 1, 2, 1, 3, 3], // 104  START B
  [1, 1, 2, 1, 1, 4], // 105  START C (was [1,3,1,1,4,1] in some refs but this matches ISO)
  [2, 3, 3, 1, 1, 1, 2], // 106  STOP (7 elements = 13 modules)
];

// Special code values
const START_A = 103;
const START_B = 104;
const START_C = 105;
const CODE_A = 101; // Switch to Code A (value when in B or C)
const CODE_B = 100; // Switch to Code B (value when in A or C)
const CODE_C = 99;  // Switch to Code C (value when in A or B)
const STOP = 106;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for rendering a Code 128 barcode as PDF operators.
 */
export interface Code128Options {
  /** Bar height in points. Default: `50`. */
  readonly height?: number;
  /** Narrow bar (module) width in points. Default: `1`. */
  readonly moduleWidth?: number;
  /** Quiet zone width in modules. Default: `10`. */
  readonly quietZone?: number;
  /** Bar colour. Default: black (grayscale 0). */
  readonly color?: Color;
  /** Show human-readable text below the barcode. Default: `false`. */
  readonly showText?: boolean;
  /** Font size for the human-readable text. Default: `10`. */
  readonly fontSize?: number;
}

// BarcodeMatrix is imported from ./types.js
export type { BarcodeMatrix } from './types.js';

// ---------------------------------------------------------------------------
// Code set helpers
// ---------------------------------------------------------------------------

type CodeSet = 'A' | 'B' | 'C';

/** Check if a character is encodable in Code A (ASCII 0-95). */
function isCodeA(ch: number): boolean {
  return ch >= 0 && ch <= 95;
}

/** Check if a character is encodable in Code B (ASCII 32-127). */
function isCodeB(ch: number): boolean {
  return ch >= 32 && ch <= 127;
}

/** Check if a character is a digit. */
function isDigit(ch: number): boolean {
  return ch >= 48 && ch <= 57; // '0'-'9'
}

/**
 * Count the number of consecutive digit characters starting at `pos`.
 */
function countDigits(data: string, pos: number): number {
  let count = 0;
  while (pos + count < data.length && isDigit(data.charCodeAt(pos + count))) {
    count++;
  }
  return count;
}

/**
 * Get the Code A value for a character.
 * ASCII 0-31 map to values 64-95, ASCII 32-95 map to values 0-63.
 */
function codeAValue(ch: number): number {
  if (ch >= 32) return ch - 32;
  return ch + 64;
}

/**
 * Get the Code B value for a character.
 * ASCII 32-127 map to values 0-95.
 */
function codeBValue(ch: number): number {
  return ch - 32;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Determine the best starting code set based on the input data.
 */
function chooseBestStart(data: string): CodeSet {
  if (data.length === 0) return 'B';

  // If the data starts with 4+ digits, start with Code C
  const leadingDigits = countDigits(data, 0);
  if (leadingDigits >= 4) return 'C';
  // If it starts with exactly 2 digits and that's the whole string, use Code C
  if (leadingDigits === 2 && data.length === 2) return 'C';

  // Check if any character requires Code A (control chars 0-31)
  const ch = data.charCodeAt(0);
  if (ch < 32) return 'A';

  return 'B';
}

/**
 * Encode a string as a sequence of Code 128 symbol values (including
 * START code, data symbols, code-set switches, check digit, and STOP).
 *
 * @param data  The string to encode.
 * @returns     Array of symbol values (0-106).
 * @throws      If the data contains characters that cannot be encoded.
 */
export function encodeCode128Values(data: string): readonly number[] {
  if (data.length === 0) {
    throw new Error('Code 128: input data must not be empty');
  }

  // Validate all characters are encodable
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    if (ch > 127) {
      throw new Error(
        `Code 128: character at index ${i} (U+${ch.toString(16).padStart(4, '0')}) is outside the encodable range (0-127)`,
      );
    }
  }

  const values: number[] = [];
  let currentSet = chooseBestStart(data);

  // Emit START code
  switch (currentSet) {
    case 'A': values.push(START_A); break;
    case 'B': values.push(START_B); break;
    case 'C': values.push(START_C); break;
  }

  let pos = 0;

  while (pos < data.length) {
    const digitsAhead = countDigits(data, pos);

    // --- Code C: encode digit pairs ---
    if (currentSet === 'C') {
      if (digitsAhead >= 2) {
        // Encode a digit pair
        const pair = parseInt(data.substring(pos, pos + 2), 10);
        values.push(pair);
        pos += 2;
        continue;
      }
      // Not enough digits for Code C — switch to A or B
      const ch = data.charCodeAt(pos);
      if (ch < 32) {
        values.push(CODE_A); // value 101 means "switch to Code A" when in Code C
        currentSet = 'A';
      } else {
        values.push(CODE_B); // value 100 means "switch to Code B" when in Code C
        currentSet = 'B';
      }
      continue;
    }

    // --- Consider switching to Code C for runs of digits ---
    if (digitsAhead >= 4 || (digitsAhead >= 2 && pos + digitsAhead === data.length)) {
      // Switch to Code C if we have 4+ digits, or 2+ digits at end of string
      // (Only switch for even digit counts; if odd, encode one digit first)
      if (digitsAhead % 2 !== 0 && digitsAhead >= 4) {
        // Encode one digit in current set, then switch for the rest
        const ch = data.charCodeAt(pos);
        if (currentSet === 'A') {
          values.push(codeAValue(ch));
        } else {
          values.push(codeBValue(ch));
        }
        pos++;
        // Now switch to Code C
        values.push(CODE_C);
        currentSet = 'C';
        continue;
      }
      if (digitsAhead >= 2 && digitsAhead % 2 === 0) {
        if (currentSet !== 'C') {
          values.push(CODE_C);
          currentSet = 'C';
        }
        continue;
      }
    }

    // --- Code A / Code B ---
    const ch = data.charCodeAt(pos);

    if (currentSet === 'A') {
      if (isCodeA(ch)) {
        values.push(codeAValue(ch));
        pos++;
      } else {
        // Need Code B for this character (lowercase, etc.)
        values.push(CODE_B);
        currentSet = 'B';
      }
    } else {
      // currentSet === 'B'
      if (isCodeB(ch)) {
        values.push(codeBValue(ch));
        pos++;
      } else {
        // Need Code A for this character (control chars)
        values.push(CODE_A);
        currentSet = 'A';
      }
    }
  }

  // --- Check digit ---
  let checkSum = values[0]!; // START code value
  for (let i = 1; i < values.length; i++) {
    checkSum += values[i]! * i;
  }
  values.push(checkSum % 103);

  // --- STOP ---
  values.push(STOP);

  return values;
}

/**
 * Convert a sequence of Code 128 symbol values to a module (bar/space) array.
 *
 * @param values  Array of symbol values as returned by {@link encodeCode128Values}.
 * @returns       A {@link BarcodeMatrix} with the module array and total width.
 */
export function valuesToModules(values: readonly number[]): BarcodeMatrix {
  const modules: boolean[] = [];

  for (const value of values) {
    const pattern = CODE128_PATTERNS[value];
    if (!pattern) {
      throw new Error(`Code 128: invalid symbol value ${value}`);
    }
    for (let i = 0; i < pattern.length; i++) {
      const width = pattern[i]!;
      const isBar = i % 2 === 0; // Even indices are bars, odd are spaces
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
    }
  }

  return { modules, width: modules.length };
}

/**
 * Encode data as a Code 128 barcode.
 *
 * This is the primary encoding function. It analyzes the input string,
 * automatically selects optimal code sets (A/B/C), calculates the
 * check digit, and returns the complete barcode as a module array.
 *
 * @param data  The string to encode (ASCII 0-127).
 * @returns     A {@link BarcodeMatrix} with the module pattern.
 * @throws      If the data is empty or contains non-encodable characters.
 */
export function encodeCode128(data: string): BarcodeMatrix {
  const values = encodeCode128Values(data);
  return valuesToModules(values);
}

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

/** Format a number for PDF output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Generate PDF content-stream operators for a Code 128 barcode.
 *
 * The barcode is drawn as filled rectangles (one per bar), using the
 * `q`/`Q` graphics state save/restore operators for isolation.
 *
 * @param matrix   The barcode matrix from {@link encodeCode128}.
 * @param x        X coordinate of the barcode origin (lower-left).
 * @param y        Y coordinate of the barcode origin (lower-left).
 * @param options  Rendering options.
 * @returns        A string of PDF content-stream operators.
 */
export function code128ToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: Code128Options,
): string {
  const height = options?.height ?? 50;
  const moduleWidth = options?.moduleWidth ?? 1;
  const quietZone = options?.quietZone ?? 10;
  const color = options?.color ?? { type: 'grayscale' as const, gray: 0 };

  let ops = '';

  // Save graphics state
  ops += 'q\n';

  // Set bar colour
  ops += applyFillColor(color);

  // Starting x position (after quiet zone)
  const startX = x + quietZone * moduleWidth;

  // Draw bars as filled rectangles
  let currentX = startX;
  let barStart = -1;

  for (let i = 0; i <= matrix.modules.length; i++) {
    const isBar = i < matrix.modules.length ? matrix.modules[i] : false;

    if (isBar && barStart === -1) {
      barStart = i;
    } else if (!isBar && barStart !== -1) {
      // End of a bar run — draw rectangle
      const barX = startX + barStart * moduleWidth;
      const barWidth = (i - barStart) * moduleWidth;
      ops += `${n(barX)} ${n(y)} ${n(barWidth)} ${n(height)} re\n`;
      barStart = -1;
    }
  }

  // Fill all the bar rectangles at once
  ops += 'f\n';

  // Restore graphics state
  ops += 'Q\n';

  return ops;
}

/**
 * @module barcode/code39
 *
 * Code 39 (Code 3 of 9) barcode encoding with optional modulo-43
 * check digit calculation and native PDF vector rendering.
 *
 * Code 39 encodes:
 * - Digits 0-9
 * - Uppercase letters A-Z
 * - Special characters: space, `-`, `.`, `$`, `/`, `+`, `%`
 *
 * Each character is represented by 9 elements (5 bars and 4 spaces),
 * of which exactly 3 are wide.  Characters are separated by a narrow
 * inter-character gap (1 narrow module).
 *
 * The start and stop character is `*` (asterisk), which is automatically
 * added during encoding.
 *
 * Reference: ISO/IEC 16388:2007
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import type { BarcodeMatrix } from './types.js';

export type { BarcodeMatrix };

// ---------------------------------------------------------------------------
// Character encoding table
//
// Each character maps to an array of 9 element widths (1 = narrow,
// 2 = wide).  The 9 elements alternate bar/space:
//   bar space bar space bar space bar space bar
//
// Every character has exactly 3 wide (2) and 6 narrow (1) elements.
//
// When rendering, narrow elements are 1 moduleWidth wide and wide
// elements are wideToNarrowRatio * moduleWidth wide.
// ---------------------------------------------------------------------------

const CODE39_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';

// Element widths: 1 = narrow, 2 = wide
// [bar, space, bar, space, bar, space, bar, space, bar]
const WIDTHS: readonly (readonly number[])[] = [
  [1, 1, 1, 2, 2, 1, 2, 1, 1], //  0
  [2, 1, 1, 2, 1, 1, 1, 1, 2], //  1
  [1, 1, 2, 2, 1, 1, 1, 1, 2], //  2
  [2, 1, 2, 2, 1, 1, 1, 1, 1], //  3
  [1, 1, 1, 2, 2, 1, 1, 1, 2], //  4
  [2, 1, 1, 2, 2, 1, 1, 1, 1], //  5
  [1, 1, 2, 2, 2, 1, 1, 1, 1], //  6
  [1, 1, 1, 2, 1, 1, 2, 1, 2], //  7
  [2, 1, 1, 2, 1, 1, 2, 1, 1], //  8
  [1, 1, 2, 2, 1, 1, 2, 1, 1], //  9
  [2, 1, 1, 1, 1, 2, 1, 1, 2], // 10 A
  [1, 1, 2, 1, 1, 2, 1, 1, 2], // 11 B
  [2, 1, 2, 1, 1, 2, 1, 1, 1], // 12 C
  [1, 1, 1, 1, 2, 2, 1, 1, 2], // 13 D
  [2, 1, 1, 1, 2, 2, 1, 1, 1], // 14 E
  [1, 1, 2, 1, 2, 2, 1, 1, 1], // 15 F
  [1, 1, 1, 1, 1, 2, 2, 1, 2], // 16 G
  [2, 1, 1, 1, 1, 2, 2, 1, 1], // 17 H
  [1, 1, 2, 1, 1, 2, 2, 1, 1], // 18 I
  [1, 1, 1, 1, 2, 2, 2, 1, 1], // 19 J
  [2, 1, 1, 1, 1, 1, 1, 2, 2], // 20 K
  [1, 1, 2, 1, 1, 1, 1, 2, 2], // 21 L
  [2, 1, 2, 1, 1, 1, 1, 2, 1], // 22 M
  [1, 1, 1, 1, 2, 1, 1, 2, 2], // 23 N
  [2, 1, 1, 1, 2, 1, 1, 2, 1], // 24 O
  [1, 1, 2, 1, 2, 1, 1, 2, 1], // 25 P
  [1, 1, 1, 1, 1, 1, 2, 2, 2], // 26 Q
  [2, 1, 1, 1, 1, 1, 2, 2, 1], // 27 R
  [1, 1, 2, 1, 1, 1, 2, 2, 1], // 28 S
  [1, 1, 1, 1, 2, 1, 2, 2, 1], // 29 T
  [2, 2, 1, 1, 1, 1, 1, 1, 2], // 30 U
  [1, 2, 2, 1, 1, 1, 1, 1, 2], // 31 V
  [2, 2, 2, 1, 1, 1, 1, 1, 1], // 32 W
  [1, 2, 1, 1, 2, 1, 1, 1, 2], // 33 X
  [2, 2, 1, 1, 2, 1, 1, 1, 1], // 34 Y
  [1, 2, 2, 1, 2, 1, 1, 1, 1], // 35 Z
  [1, 2, 1, 1, 1, 1, 2, 1, 2], // 36 -
  [2, 2, 1, 1, 1, 1, 2, 1, 1], // 37 .
  [1, 2, 2, 1, 1, 1, 2, 1, 1], // 38 (space)
  [1, 2, 1, 2, 1, 2, 1, 1, 1], // 39 $
  [1, 2, 1, 2, 1, 1, 1, 2, 1], // 40 /
  [1, 2, 1, 1, 1, 2, 1, 2, 1], // 41 +
  [1, 1, 1, 2, 1, 2, 1, 2, 1], // 42 %
  [1, 2, 1, 1, 2, 1, 2, 1, 1], // 43 *
];

// Build a fast lookup: character -> charset index
const CHAR_TO_INDEX = new Map<string, number>();
for (let i = 0; i < CODE39_CHARSET.length; i++) {
  CHAR_TO_INDEX.set(CODE39_CHARSET[i]!, i);
}

const STAR_INDEX = 43;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for rendering a Code 39 barcode as PDF operators.
 */
export interface Code39Options {
  /** Height of the bars in user-space units. Default: `50`. */
  readonly height?: number | undefined;
  /** Width of a narrow module in user-space units. Default: `1`. */
  readonly moduleWidth?: number | undefined;
  /** Wide-to-narrow ratio. Default: `3`. Must be >= 2. */
  readonly wideToNarrowRatio?: number | undefined;
  /** Quiet-zone width in narrow modules on each side. Default: `10`. */
  readonly quietZone?: number | undefined;
  /** Bar colour. Default: grayscale black. */
  readonly color?: Color | undefined;
  /** Show human-readable text below the barcode. Default: `false`. */
  readonly showText?: boolean | undefined;
  /** Include a modulo-43 check digit. Default: `false`. */
  readonly includeCheckDigit?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Expand a character's width array into module booleans.
 *
 * @param widths  9-element array where 1 = narrow, 2 = wide.
 * @param ratio   Wide-to-narrow ratio (applied to wide elements).
 * @returns       Boolean array: `true` = bar, `false` = space.
 */
function expandWidths(widths: readonly number[], ratio: number): boolean[] {
  const modules: boolean[] = [];
  for (let i = 0; i < 9; i++) {
    const isBar = i % 2 === 0;
    const moduleCount = widths[i] === 2 ? ratio : 1;
    for (let m = 0; m < moduleCount; m++) {
      modules.push(isBar);
    }
  }
  return modules;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Compute the modulo-43 check digit for a Code 39 data string.
 *
 * @param data  Uppercase data string (without start/stop `*`).
 * @returns     The check digit character.
 * @throws      If the data contains characters not in the Code 39 set.
 */
export function computeCode39CheckDigit(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const idx = CHAR_TO_INDEX.get(data[i]!);
    if (idx === undefined) {
      throw new Error(
        `Code 39: invalid character '${data[i]}' at index ${i}. ` +
        'Valid characters: 0-9, A-Z, space, - . $ / + %',
      );
    }
    sum += idx;
  }
  return CODE39_CHARSET[sum % 43]!;
}

/**
 * Encode a string as a Code 39 barcode.
 *
 * The input is automatically wrapped with start/stop `*` characters.
 * If `includeCheckDigit` is true, a modulo-43 check digit is appended
 * before the stop character.
 *
 * @param data               The string to encode (digits, uppercase A-Z,
 *                           space, `-`, `.`, `$`, `/`, `+`, `%`).
 * @param includeCheckDigit  Whether to append a modulo-43 check digit.
 *                           Default: `false`.
 * @param wideToNarrowRatio  Wide-to-narrow ratio for module expansion.
 *                           Default: `3`.
 * @returns                  A {@link BarcodeMatrix} with the module pattern.
 * @throws                   If the data contains invalid characters (lowercase,
 *                           `*`, or characters outside the Code 39 set).
 */
export function encodeCode39(
  data: string,
  includeCheckDigit: boolean = false,
  wideToNarrowRatio: number = 3,
): BarcodeMatrix {
  if (wideToNarrowRatio < 2) {
    throw new Error(
      `Code 39: wideToNarrowRatio must be >= 2, got ${wideToNarrowRatio}`,
    );
  }

  // Validate input
  for (let i = 0; i < data.length; i++) {
    const ch = data[i]!;
    if (ch === '*') {
      throw new Error(
        'Code 39: asterisk (*) is the start/stop character and must not ' +
        `appear in data (index ${i})`,
      );
    }
    if (!CHAR_TO_INDEX.has(ch)) {
      throw new Error(
        `Code 39: invalid character '${ch}' at index ${i}. ` +
        'Valid characters: 0-9, A-Z, space, - . $ / + %',
      );
    }
  }

  // Optionally append check digit
  let payload = data;
  if (includeCheckDigit) {
    payload += computeCode39CheckDigit(data);
  }

  const ratio = wideToNarrowRatio;
  const modules: boolean[] = [];

  // Start character (*)
  modules.push(...expandWidths(WIDTHS[STAR_INDEX]!, ratio));

  // Inter-character gap
  modules.push(false);

  // Data characters
  for (let i = 0; i < payload.length; i++) {
    const idx = CHAR_TO_INDEX.get(payload[i]!)!;
    modules.push(...expandWidths(WIDTHS[idx]!, ratio));
    modules.push(false); // inter-character gap
  }

  // Stop character (*)
  modules.push(...expandWidths(WIDTHS[STAR_INDEX]!, ratio));

  return { modules, width: modules.length };
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
 * Generate PDF content-stream operators for a Code 39 barcode.
 *
 * The barcode is drawn as filled rectangles (one per contiguous bar run),
 * wrapped in `q`/`Q` graphics state save/restore operators.
 *
 * @param matrix   The barcode matrix from {@link encodeCode39}.
 * @param x        X coordinate of the barcode origin (lower-left).
 * @param y        Y coordinate of the barcode origin (lower-left).
 * @param options  Rendering options.
 * @returns        A string of PDF content-stream operators.
 */
export function code39ToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: Code39Options,
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

  // Starting x after quiet zone
  const startX = x + quietZone * moduleWidth;

  // Coalesce adjacent bar modules into single rectangles
  let barStart = -1;
  for (let i = 0; i <= matrix.modules.length; i++) {
    const isBar = i < matrix.modules.length ? matrix.modules[i] : false;

    if (isBar && barStart === -1) {
      barStart = i;
    } else if (!isBar && barStart !== -1) {
      const barX = startX + barStart * moduleWidth;
      const barWidth = (i - barStart) * moduleWidth;
      ops += `${n(barX)} ${n(y)} ${n(barWidth)} ${n(height)} re\n`;
      barStart = -1;
    }
  }

  // Fill all bar rectangles
  ops += 'f\n';

  // Restore graphics state
  ops += 'Q\n';

  return ops;
}

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
 * Reference: ISO/IEC 16388:2007, ANSI/AIM BC1-1995
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import type { BarcodeMatrix } from './types.js';

export type { BarcodeMatrix };

// ---------------------------------------------------------------------------
// Character encoding table
//
// Each pattern is a 9-character string of N (narrow) and W (wide) values.
// The elements alternate: bar-space-bar-space-bar-space-bar-space-bar
// (B S B S B S B S B), so indices 0,2,4,6,8 are bars and 1,3,5,7 are
// spaces.  Each character has exactly 3 wide elements and 6 narrow.
//
// Source: ISO/IEC 16388 Table 1
// ---------------------------------------------------------------------------

/**
 * Character set for Code 39. The index of a character in this string is
 * its value for modulo-43 check digit computation.
 */
const CODE39_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';

/**
 * Encoding patterns indexed by {@link CODE39_CHARSET} position, plus
 * the start/stop character `*` at the end.  44 entries total.
 *
 * Each entry: 9-char string of 'N' (narrow) or 'W' (wide).
 * Element positions: B0 S1 B2 S3 B4 S5 B6 S7 B8
 */
const CODE39_PATTERNS: readonly string[] = [
  /* 0  '0' */ 'NNNWWNWNN',
  /* 1  '1' */ 'WNNWNNNNW',
  /* 2  '2' */ 'NNWWNNNNW',
  /* 3  '3' */ 'WNWWNNNNN',
  /* 4  '4' */ 'NNNWWNNNW',
  /* 5  '5' */ 'WNNWWNNNN',
  /* 6  '6' */ 'NNWWWNNNN',
  /* 7  '7' */ 'NNNWNNWNW',
  /* 8  '8' */ 'WNNWNNWNN',
  /* 9  '9' */ 'NNWWNNWNN',
  /* 10 'A' */ 'WNNNNWNNW',
  /* 11 'B' */ 'NNWNNWNNW',
  /* 12 'C' */ 'WNWNNWNNN',
  /* 13 'D' */ 'NNNNWWNNW',
  /* 14 'E' */ 'WNNNWWNNN',
  /* 15 'F' */ 'NNWNWWNNN',
  /* 16 'G' */ 'NNNNNWWNW',
  /* 17 'H' */ 'WNNNNWWNN',
  /* 18 'I' */ 'NNWNNWWNN',
  /* 19 'J' */ 'NNNNWWWNN',
  /* 20 'K' */ 'WNNNNNNWW',
  /* 21 'L' */ 'NNWNNNNWW',
  /* 22 'M' */ 'WNWNNNNWN',
  /* 23 'N' */ 'NNNNWNNWW',
  /* 24 'O' */ 'WNNNWNNWN',
  /* 25 'P' */ 'NNWNWNNWN',
  /* 26 'Q' */ 'NNNNNNWWW',
  /* 27 'R' */ 'WNNNNNWWN',
  /* 28 'S' */ 'NNWNNNWWN',
  /* 29 'T' */ 'NNNNWNWWN',
  /* 30 'U' */ 'WWNNNNNNW',
  /* 31 'V' */ 'NWWNNNNNW',
  /* 32 'W' */ 'WWWNNNNNN',
  /* 33 'X' */ 'NWNNWNNNW',
  /* 34 'Y' */ 'NWNNWNNWN',  // placeholder to be verified
  /* 35 'Z' */ 'NWNNNNWNW',  // placeholder to be verified
  /* 36 '-' */ 'NWNNNNNNW',  // placeholder to be verified
  /* 37 '.' */ 'WWNNNNNWN',
  /* 38 ' ' */ 'NNWNNNWNW',  // placeholder to be verified
  /* 39 '$' */ 'NWNWNWNNN',
  /* 40 '/' */ 'NWNWNNNWN',
  /* 41 '+' */ 'NWNNNWNWN',
  /* 42 '%' */ 'NNNWNWNWN',
  /* 43 '*' */ 'NWNNWNWNN',
];

// Build a fast lookup map from character to pattern index
const CHAR_TO_INDEX: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (let i = 0; i < CODE39_CHARSET.length; i++) {
    m.set(CODE39_CHARSET[i]!, i);
  }
  return m;
})();

const STAR_PATTERN = CODE39_PATTERNS[43]!;

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
 * Expand a 9-character pattern string (N/W) into an array of booleans
 * using the given wide-to-narrow ratio.
 *
 * @param pattern  9-char string like `'WNNWNNNNW'`.
 * @param ratio    Wide-to-narrow ratio (default 3).
 * @returns        Boolean array: `true` = bar, `false` = space.
 */
function expandPattern(pattern: string, ratio: number): boolean[] {
  const modules: boolean[] = [];
  for (let i = 0; i < 9; i++) {
    const isBar = i % 2 === 0;      // even indices = bar, odd = space
    const isWide = pattern[i] === 'W';
    const width = isWide ? ratio : 1;
    for (let w = 0; w < width; w++) {
      modules.push(isBar);
    }
  }
  return modules;
}

/**
 * Compute the total module width of a single Code 39 character
 * (without inter-character gap).
 */
function charModuleWidth(ratio: number): number {
  // Each character has 9 elements: 6 narrow + 3 wide
  return 6 * 1 + 3 * ratio;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Compute the modulo-43 check digit for a Code 39 data string.
 *
 * @param data  Uppercase data string (without start/stop `*`).
 * @returns     The check digit character.
 */
export function computeCode39CheckDigit(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const idx = CHAR_TO_INDEX.get(data[i]!);
    if (idx === undefined) {
      throw new Error(
        `Code 39: invalid character '${data[i]}' at index ${i}. ` +
        `Valid characters: 0-9, A-Z, space, - . $ / + %`,
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
    throw new Error(`Code 39: wideToNarrowRatio must be >= 2, got ${wideToNarrowRatio}`);
  }

  // Validate input characters
  for (let i = 0; i < data.length; i++) {
    const ch = data[i]!;
    if (ch === '*') {
      throw new Error(
        `Code 39: asterisk (*) is the start/stop character and must not appear in data (index ${i})`,
      );
    }
    if (!CHAR_TO_INDEX.has(ch)) {
      throw new Error(
        `Code 39: invalid character '${ch}' at index ${i}. ` +
        `Valid characters: 0-9, A-Z, space, - . $ / + %`,
      );
    }
  }

  // Build the full character sequence: * + data [+ check] + *
  let encoded = data;
  if (includeCheckDigit) {
    encoded += computeCode39CheckDigit(data);
  }

  const ratio = wideToNarrowRatio;
  const modules: boolean[] = [];

  // Start character
  modules.push(...expandPattern(STAR_PATTERN, ratio));

  // Inter-character gap after start
  modules.push(false); // 1 narrow space

  // Data characters (+ optional check digit)
  for (let i = 0; i < encoded.length; i++) {
    const idx = CHAR_TO_INDEX.get(encoded[i]!)!;
    const pattern = CODE39_PATTERNS[idx]!;
    modules.push(...expandPattern(pattern, ratio));

    // Inter-character gap (1 narrow space) after each character
    modules.push(false);
  }

  // Stop character
  modules.push(...expandPattern(STAR_PATTERN, ratio));

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

  // Starting x position (after quiet zone)
  const startX = x + quietZone * moduleWidth;

  // Draw bars as filled rectangles (coalesce adjacent bar modules)
  let barStart = -1;

  for (let i = 0; i <= matrix.modules.length; i++) {
    const isBar = i < matrix.modules.length ? matrix.modules[i] : false;

    if (isBar && barStart === -1) {
      barStart = i;
    } else if (!isBar && barStart !== -1) {
      // End of a bar run — emit rectangle
      const barX = startX + barStart * moduleWidth;
      const barWidth = (i - barStart) * moduleWidth;
      ops += `${n(barX)} ${n(y)} ${n(barWidth)} ${n(height)} re\n`;
      barStart = -1;
    }
  }

  // Fill all bar rectangles at once
  ops += 'f\n';

  // Restore graphics state
  ops += 'Q\n';

  return ops;
}

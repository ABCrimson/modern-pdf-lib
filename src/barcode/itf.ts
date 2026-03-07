/**
 * @module barcode/itf
 *
 * ITF (Interleaved 2 of 5) barcode encoding with optional bearer bars
 * and native PDF vector rendering.
 *
 * ITF encodes pairs of digits: the first digit of each pair is encoded
 * in the bars (narrow/wide) and the second digit is encoded in the
 * spaces (narrow/wide).  The total number of digits must be even; if
 * an odd-length string is provided, a leading `0` is prepended.
 *
 * Each digit is represented by 5 elements, of which 2 are wide (hence
 * "2 of 5").  The start pattern is 4 narrow elements (NNNN) and the
 * stop pattern is a wide bar, narrow space, narrow bar (WNN).
 *
 * Reference: ISO/IEC 16390:2007, ANSI/AIM BC2-1995
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor } from '../core/operators/color.js';
import type { BarcodeMatrix } from './types.js';

export type { BarcodeMatrix };

// ---------------------------------------------------------------------------
// Digit encoding table
//
// Each digit (0-9) is encoded as 5 elements where each element is either
// narrow (N) or wide (W).  Exactly 2 of the 5 elements are wide.
//
// When interleaved, the first digit of a pair provides the bar widths
// and the second digit provides the space widths.
// ---------------------------------------------------------------------------

/**
 * Digit patterns: 5-element strings of 'N' (narrow) and 'W' (wide).
 * Index = digit value (0-9).
 */
const DIGIT_PATTERNS: readonly string[] = [
  'NNWWN', // 0
  'WNNNW', // 1
  'NWNNW', // 2
  'WWNNN', // 3
  'NNWNW', // 4
  'WNWNN', // 5
  'NWWNN', // 6
  'NNNWW', // 7
  'WNNWN', // 8
  'NWNWN', // 9
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for rendering an ITF barcode as PDF operators.
 */
export interface ItfOptions {
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
  /**
   * Add horizontal bearer bars at the top and bottom of the barcode.
   * Bearer bars help prevent partial reads. Default: `false`.
   */
  readonly bearerBars?: boolean | undefined;
  /**
   * Width of the bearer bars in user-space units. Only used when
   * `bearerBars` is `true`. Default: `2`.
   */
  readonly bearerBarWidth?: number | undefined;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Encode a numeric string as an ITF barcode.
 *
 * If the input has an odd number of digits, a leading `0` is prepended
 * to make it even.
 *
 * @param data  A string of digits (0-9 only).
 * @returns     A {@link BarcodeMatrix} with the module pattern.
 * @throws      If the data contains non-digit characters.
 */
export function encodeItf(
  data: string,
  wideToNarrowRatio: number = 3,
): BarcodeMatrix {
  // Validate: digits only
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    if (ch < 48 || ch > 57) {
      throw new Error(
        `ITF: invalid character '${data[i]}' at index ${i}. Only digits 0-9 are allowed.`,
      );
    }
  }

  if (data.length === 0) {
    throw new Error('ITF: input data must not be empty');
  }

  if (wideToNarrowRatio < 2) {
    throw new Error(
      `ITF: wideToNarrowRatio must be >= 2, got ${wideToNarrowRatio}`,
    );
  }

  // Prepend 0 if odd length
  let digits = data;
  if (digits.length % 2 !== 0) {
    digits = '0' + digits;
  }

  const ratio = wideToNarrowRatio;
  const modules: boolean[] = [];

  // Start pattern: 4 narrow elements (bar, space, bar, space)
  modules.push(true);   // narrow bar
  modules.push(false);  // narrow space
  modules.push(true);   // narrow bar
  modules.push(false);  // narrow space

  // Interleaved digit pairs
  for (let i = 0; i < digits.length; i += 2) {
    const d1 = parseInt(digits[i]!, 10);     // bars
    const d2 = parseInt(digits[i + 1]!, 10); // spaces
    const barPattern = DIGIT_PATTERNS[d1]!;
    const spacePattern = DIGIT_PATTERNS[d2]!;

    // Interleave: for each of the 5 positions, emit bar then space
    for (let j = 0; j < 5; j++) {
      // Bar element
      const barWidth = barPattern[j] === 'W' ? ratio : 1;
      for (let m = 0; m < barWidth; m++) {
        modules.push(true);
      }

      // Space element
      const spaceWidth = spacePattern[j] === 'W' ? ratio : 1;
      for (let m = 0; m < spaceWidth; m++) {
        modules.push(false);
      }
    }
  }

  // Stop pattern: wide bar, narrow space, narrow bar
  for (let m = 0; m < ratio; m++) {
    modules.push(true);  // wide bar
  }
  modules.push(false);   // narrow space
  modules.push(true);    // narrow bar

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
 * Generate PDF content-stream operators for an ITF barcode.
 *
 * The barcode is drawn as filled rectangles (one per contiguous bar run),
 * wrapped in `q`/`Q` graphics state save/restore operators. If bearer
 * bars are enabled, horizontal bars are drawn at the top and bottom.
 *
 * @param matrix   The barcode matrix from {@link encodeItf}.
 * @param x        X coordinate of the barcode origin (lower-left).
 * @param y        Y coordinate of the barcode origin (lower-left).
 * @param options  Rendering options.
 * @returns        A string of PDF content-stream operators.
 */
export function itfToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: ItfOptions,
): string {
  const height = options?.height ?? 50;
  const moduleWidth = options?.moduleWidth ?? 1;
  const quietZone = options?.quietZone ?? 10;
  const color = options?.color ?? { type: 'grayscale' as const, gray: 0 };
  const bearerBars = options?.bearerBars ?? false;
  const bearerBarWidth = options?.bearerBarWidth ?? 2;

  let ops = '';

  // Save graphics state
  ops += 'q\n';

  // Set bar colour
  ops += applyFillColor(color);

  // Starting x after quiet zone
  const startX = x + quietZone * moduleWidth;
  const totalWidth = matrix.width * moduleWidth;

  // Bearer bars (drawn first, below and above the barcode)
  if (bearerBars) {
    // Bottom bearer bar
    ops += `${n(startX)} ${n(y)} ${n(totalWidth)} ${n(bearerBarWidth)} re\n`;
    // Top bearer bar
    ops += `${n(startX)} ${n(y + height - bearerBarWidth)} ${n(totalWidth)} ${n(bearerBarWidth)} re\n`;
  }

  // Draw bars as filled rectangles (coalesce adjacent bar modules)
  const barY = bearerBars ? y + bearerBarWidth : y;
  const barHeight = bearerBars ? height - 2 * bearerBarWidth : height;
  let barStart = -1;

  for (let i = 0; i <= matrix.modules.length; i++) {
    const isBar = i < matrix.modules.length ? matrix.modules[i] : false;

    if (isBar && barStart === -1) {
      barStart = i;
    } else if (!isBar && barStart !== -1) {
      const barX = startX + barStart * moduleWidth;
      const barW = (i - barStart) * moduleWidth;
      ops += `${n(barX)} ${n(barY)} ${n(barW)} ${n(barHeight)} re\n`;
      barStart = -1;
    }
  }

  // Fill all rectangles
  ops += 'f\n';

  // Restore graphics state
  ops += 'Q\n';

  return ops;
}

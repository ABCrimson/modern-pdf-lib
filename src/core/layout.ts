/**
 * @module core/layout
 *
 * Pure computation helpers for text layout.  These functions measure
 * text using a {@link FontRef} but do not emit any PDF operators —
 * they are side-effect-free and can be used for pre-layout before
 * drawing or for form-field appearance generation.
 *
 * - {@link layoutMultilineText} — break text into measured lines
 * - {@link layoutCombedText}    — position characters in fixed-width cells
 * - {@link computeFontSize}     — find the largest size that fits bounds
 */

import type { FontRef } from './pdfPage.js';
import { wrapText } from './pdfPage.js';

// ---------------------------------------------------------------------------
// layoutMultilineText
// ---------------------------------------------------------------------------

export interface LayoutMultilineOptions {
  font: FontRef;
  fontSize: number;
  maxWidth: number;
  lineHeight?: number | undefined;
  wordBreaks?: string[] | undefined;
}

export interface LayoutMultilineResult {
  lines: Array<{ text: string; width: number }>;
  height: number;
}

/**
 * Break text into lines that fit within `maxWidth`, measuring each line's
 * width.  Explicit newlines (`\n`) are always honoured.
 *
 * The returned `height` is the total vertical extent: one line's ascent
 * plus `(n-1) * lineHeight`.
 */
export function layoutMultilineText(
  text: string,
  options: LayoutMultilineOptions,
): LayoutMultilineResult {
  const { font, fontSize, maxWidth, wordBreaks } = options;
  const lineHeight = options.lineHeight ?? fontSize * 1.2;

  const rawLines = text.split('\n');
  const allLines: Array<{ text: string; width: number }> = [];

  for (const rawLine of rawLines) {
    if (maxWidth > 0) {
      const wrapped = wrapText(rawLine, maxWidth, font, fontSize, wordBreaks);
      for (const line of wrapped) {
        allLines.push({
          text: line,
          width: font.widthOfTextAtSize(line, fontSize),
        });
      }
    } else {
      allLines.push({
        text: rawLine,
        width: font.widthOfTextAtSize(rawLine, fontSize),
      });
    }
  }

  const height =
    allLines.length > 0
      ? font.heightAtSize(fontSize) + (allLines.length - 1) * lineHeight
      : 0;

  return { lines: allLines, height };
}

// ---------------------------------------------------------------------------
// layoutCombedText
// ---------------------------------------------------------------------------

export interface LayoutCombedOptions {
  font: FontRef;
  fontSize: number;
  cellCount: number;
  cellWidth: number;
}

/**
 * Layout text into evenly-spaced cells for combed text fields.
 *
 * Each character is centred within its cell.  Characters beyond
 * `cellCount` are silently truncated.
 */
export function layoutCombedText(
  text: string,
  options: LayoutCombedOptions,
): Array<{ char: string; x: number; width: number }> {
  const { font, fontSize, cellCount, cellWidth } = options;
  const chars = text.slice(0, cellCount).split('');

  return chars.map((char, i) => {
    const charWidth = font.widthOfTextAtSize(char, fontSize);
    const cellCenter = i * cellWidth + cellWidth / 2;
    const x = cellCenter - charWidth / 2;
    return { char, x, width: charWidth };
  });
}

// ---------------------------------------------------------------------------
// computeFontSize
// ---------------------------------------------------------------------------

export interface ComputeFontSizeOptions {
  font: FontRef;
  maxWidth: number;
  maxHeight?: number | undefined;
  lineHeight?: number | undefined;
  minSize?: number | undefined;
  maxSize?: number | undefined;
  wordBreaks?: string[] | undefined;
}

/**
 * Compute the largest font size (in points) at which `text` fits within
 * the given width (and optionally height) constraints.
 *
 * Uses binary search between `minSize` (default 4) and `maxSize`
 * (default 500), converging to within 0.1 pt.
 */
export function computeFontSize(
  text: string,
  options: ComputeFontSizeOptions,
): number {
  const { font, maxWidth, wordBreaks } = options;
  const maxHeight = options.maxHeight ?? Infinity;
  const minSize = options.minSize ?? 4;
  const maxSize = options.maxSize ?? 500;

  let lo = minSize;
  let hi = maxSize;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const layout = layoutMultilineText(text, {
      font,
      fontSize: mid,
      maxWidth,
      lineHeight: options.lineHeight,
      wordBreaks,
    });

    const fits =
      layout.height <= maxHeight &&
      layout.lines.every((line) => line.width <= maxWidth);

    if (fits) {
      lo = mid;
    } else {
      hi = mid;
    }

    if (hi - lo < 0.1) break;
  }

  return Math.floor(lo * 10) / 10;
}

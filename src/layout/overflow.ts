/**
 * @module layout/overflow
 *
 * Text overflow handling utilities for table cells.
 *
 * Provides five overflow modes that control how text is rendered
 * when it exceeds the available width of a cell:
 *
 * - **visible** — render as-is, text may extend beyond the cell
 * - **wrap** — split text into multiple lines that fit within the cell
 * - **truncate** — cut text that exceeds the cell width
 * - **ellipsis** — cut text and append "..." when it exceeds the cell width
 * - **shrink** — reduce font size to fit text within the cell width
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Controls how text that exceeds a cell's available width is handled. */
export type OverflowMode = 'visible' | 'wrap' | 'truncate' | 'ellipsis' | 'shrink';

/** Result of applying an overflow mode to a text string. */
export interface OverflowResult {
  /** The processed line(s) of text. */
  readonly lines: readonly string[];
  /** The font size to use (may differ from input for 'shrink' mode). */
  readonly fontSize: number;
  /** Whether the text was modified (truncated, wrapped, or shrunk). */
  readonly wasModified: boolean;
}

// ---------------------------------------------------------------------------
// Text width estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the width of text using character count * fontSize * avgCharWidth.
 *
 * This is a rough approximation suitable for layout purposes when real
 * font metrics are unavailable. The default `avgCharWidth` of `0.5` is
 * a reasonable average for proportional Latin fonts like Helvetica.
 *
 * @param text          The text to measure.
 * @param fontSize      Font size in points.
 * @param avgCharWidth  Average character width as a fraction of fontSize.
 *                      Default: `0.5`.
 * @returns             Estimated width in points.
 */
export function estimateTextWidth(
  text: string,
  fontSize: number,
  avgCharWidth: number = 0.5,
): number {
  return text.length * fontSize * avgCharWidth;
}

// ---------------------------------------------------------------------------
// Wrap
// ---------------------------------------------------------------------------

/**
 * Split text into lines that fit within `availableWidth`.
 *
 * Word boundaries (spaces) are preferred. If a single word is wider
 * than `availableWidth`, it is broken mid-word to guarantee every
 * returned line fits.
 *
 * @param text            The text to wrap.
 * @param availableWidth  Maximum line width in points.
 * @param fontSize        Font size in points.
 * @param avgCharWidth    Average character width as a fraction of fontSize.
 *                        Default: `0.5`.
 * @returns               Array of lines.
 */
export function wrapText(
  text: string,
  availableWidth: number,
  fontSize: number,
  avgCharWidth: number = 0.5,
): string[] {
  if (text === '') return [''];

  const charWidth = fontSize * avgCharWidth;
  const maxChars = Math.max(1, Math.floor(availableWidth / charWidth));

  // If the entire text fits, return it as a single line
  if (text.length <= maxChars) return [text];

  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    if (word.length > maxChars) {
      // Word itself exceeds the line width — break mid-word
      // First, flush whatever is accumulated on the current line
      if (currentLine !== '') {
        // Try appending part of the word to the current line
        const remaining = maxChars - currentLine.length - 1; // -1 for space
        if (remaining > 0) {
          lines.push(currentLine + ' ' + word.slice(0, remaining));
          let pos = remaining;
          while (pos < word.length) {
            lines.push(word.slice(pos, pos + maxChars));
            pos += maxChars;
          }
        } else {
          lines.push(currentLine);
          let pos = 0;
          while (pos < word.length) {
            lines.push(word.slice(pos, pos + maxChars));
            pos += maxChars;
          }
        }
        currentLine = '';
        // The last pushed line might be a partial word chunk — pop it
        // and use it as the start of the next line if it's under maxChars
        const lastLine = lines[lines.length - 1]!;
        if (lastLine.length < maxChars) {
          currentLine = lines.pop()!;
        }
      } else {
        // No current line content — break the word directly
        let pos = 0;
        while (pos < word.length) {
          const chunk = word.slice(pos, pos + maxChars);
          pos += maxChars;
          if (pos >= word.length && chunk.length < maxChars) {
            // Last partial chunk — keep as current line
            currentLine = chunk;
          } else {
            lines.push(chunk);
          }
        }
      }
    } else if (currentLine === '') {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      // Word doesn't fit on current line — wrap
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Truncate
// ---------------------------------------------------------------------------

/**
 * Truncate text to fit within `availableWidth`.
 *
 * If the text already fits, it is returned unchanged.
 *
 * @param text            The text to truncate.
 * @param availableWidth  Maximum width in points.
 * @param fontSize        Font size in points.
 * @param avgCharWidth    Average character width as a fraction of fontSize.
 *                        Default: `0.5`.
 * @returns               The (possibly truncated) text.
 */
export function truncateText(
  text: string,
  availableWidth: number,
  fontSize: number,
  avgCharWidth: number = 0.5,
): string {
  const charWidth = fontSize * avgCharWidth;
  const maxChars = Math.max(0, Math.floor(availableWidth / charWidth));

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

// ---------------------------------------------------------------------------
// Ellipsis
// ---------------------------------------------------------------------------

/**
 * Truncate text and append an ellipsis string to fit within `availableWidth`.
 *
 * If the text already fits, it is returned unchanged.
 *
 * @param text            The text to truncate.
 * @param availableWidth  Maximum width in points.
 * @param fontSize        Font size in points.
 * @param options         Optional configuration.
 * @param options.avgCharWidth   Average character width fraction. Default: `0.5`.
 * @param options.ellipsisChar   The ellipsis suffix. Default: `'...'`.
 * @returns               The (possibly truncated + ellipsis) text.
 */
export function ellipsisText(
  text: string,
  availableWidth: number,
  fontSize: number,
  options?: { avgCharWidth?: number; ellipsisChar?: string },
): string {
  const avgCharWidth = options?.avgCharWidth ?? 0.5;
  const ellipsis = options?.ellipsisChar ?? '...';
  const charWidth = fontSize * avgCharWidth;
  const maxChars = Math.max(0, Math.floor(availableWidth / charWidth));

  if (text.length <= maxChars) return text;

  const reservedChars = ellipsis.length;
  const textChars = Math.max(0, maxChars - reservedChars);

  return text.slice(0, textChars) + ellipsis;
}

// ---------------------------------------------------------------------------
// Shrink
// ---------------------------------------------------------------------------

/**
 * Calculate the font size needed to fit text within `availableWidth`.
 *
 * If the text already fits at the given `fontSize`, that size is returned.
 * The result is clamped to `minFontSize` so text never becomes illegibly small.
 *
 * @param text            The text to fit.
 * @param availableWidth  Maximum width in points.
 * @param fontSize        Starting font size in points.
 * @param options         Optional configuration.
 * @param options.avgCharWidth  Average character width fraction. Default: `0.5`.
 * @param options.minFontSize   Minimum font size floor. Default: `6`.
 * @returns               The (possibly reduced) font size.
 */
export function shrinkFontSize(
  text: string,
  availableWidth: number,
  fontSize: number,
  options?: { avgCharWidth?: number; minFontSize?: number },
): number {
  const avgCharWidth = options?.avgCharWidth ?? 0.5;
  const minFontSize = options?.minFontSize ?? 6;

  if (text.length === 0) return fontSize;

  const neededWidth = text.length * fontSize * avgCharWidth;
  if (neededWidth <= availableWidth) return fontSize;

  const shrunk = availableWidth / (text.length * avgCharWidth);
  return Math.max(minFontSize, shrunk);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Apply overflow handling to text, returning processed line(s) and
 * an adjusted fontSize.
 *
 * This is the primary entry point — it dispatches to the appropriate
 * strategy function based on the requested `mode`.
 *
 * @param text            The text to process.
 * @param mode            The overflow mode to apply.
 * @param availableWidth  Maximum width in points.
 * @param fontSize        Font size in points.
 * @param options         Optional configuration.
 * @returns               An {@link OverflowResult} with lines, fontSize,
 *                        and a flag indicating whether the text was modified.
 */
export function applyOverflow(
  text: string,
  mode: OverflowMode,
  availableWidth: number,
  fontSize: number,
  options?: {
    avgCharWidth?: number;
    minFontSize?: number;
    ellipsisChar?: string;
  },
): OverflowResult {
  const avgCharWidth = options?.avgCharWidth ?? 0.5;

  switch (mode) {
    case 'visible':
      return { lines: [text], fontSize, wasModified: false };

    case 'wrap': {
      const lines = wrapText(text, availableWidth, fontSize, avgCharWidth);
      const wasModified = lines.length > 1 || lines[0] !== text;
      return { lines, fontSize, wasModified };
    }

    case 'truncate': {
      const result = truncateText(text, availableWidth, fontSize, avgCharWidth);
      return {
        lines: [result],
        fontSize,
        wasModified: result !== text,
      };
    }

    case 'ellipsis': {
      const result = ellipsisText(text, availableWidth, fontSize, {
        avgCharWidth,
        ellipsisChar: options?.ellipsisChar,
      });
      return {
        lines: [result],
        fontSize,
        wasModified: result !== text,
      };
    }

    case 'shrink': {
      const newSize = shrinkFontSize(text, availableWidth, fontSize, {
        avgCharWidth,
        minFontSize: options?.minFontSize,
      });
      return {
        lines: [text],
        fontSize: newSize,
        wasModified: newSize !== fontSize,
      };
    }
  }
}

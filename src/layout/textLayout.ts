/**
 * @module layout/textLayout
 *
 * Advanced text layout engine with paragraph reflow, justified alignment,
 * hyphenation, and multi-column text frames.
 *
 * Produces raw PDF content-stream operators that can be appended directly
 * to a page's operator buffer. All layout is performed in user-space
 * coordinates (PDF's default coordinate system where Y increases upward).
 *
 * Features:
 * - Full paragraph layout with word wrapping and line breaking
 * - Four alignment modes: left, right, center, justify
 * - Knuth-Plass–inspired justified line breaking with word spacing
 * - Automatic hyphenation with configurable locale-aware rules
 * - First-line indent and hanging indent
 * - Paragraph spacing
 * - Widow/orphan control
 * - Multi-column layout with optional column rules and balancing
 * - Multi-frame text flow for cross-page continuation
 * - Rich text spans with per-span font, size, color, and decorations
 */

import { saveState, restoreState } from '../core/operators/state.js';
import {
  beginText,
  endText,
  setFont,
  moveText,
  showText,
  setWordSpacing,
} from '../core/operators/text.js';
import {
  moveTo,
  lineTo,
  stroke,
  setLineWidth,
  setDashPattern,
  rectangle,
  fill,
} from '../core/operators/graphics.js';
import { applyFillColor, applyStrokeColor } from '../core/operators/color.js';
import type { Color } from '../core/operators/color.js';
import type { FontRef } from '../core/pdfPage.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A rectangular region within which text can be laid out. */
export interface TextFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Text alignment mode. */
export type TextAlignment = 'left' | 'right' | 'center' | 'justify';

/** A span of text with optional styling overrides. */
export interface TextSpan {
  text: string;
  font?: FontRef | string;
  fontSize?: number;
  color?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
}

/** Options controlling paragraph layout. */
export interface ParagraphOptions {
  alignment?: TextAlignment;
  lineHeight?: number;          // Multiplier (e.g., 1.2 = 120%)
  paragraphSpacing?: number;    // Points between paragraphs
  firstLineIndent?: number;     // Points
  hangingIndent?: number;       // Points
  hyphenation?: boolean;        // Enable automatic hyphenation
  hyphenChar?: string;          // Default: '-'
  locale?: string;              // For hyphenation rules
  orphanLines?: number;         // Minimum lines at bottom of frame (default: 2)
  widowLines?: number;          // Minimum lines at top of next frame (default: 2)
}

/** Options for multi-column layout. */
export interface MultiColumnOptions {
  columns: number;              // Number of columns
  columnGap?: number;           // Gap between columns in points (default: 18)
  columnRule?: { width: number; color: Color; style: 'solid' | 'dashed' };
  balanceColumns?: boolean;     // Try to equalize column heights (default: true)
}

/** Result of a text layout operation. */
export interface TextLayoutResult {
  /** Content stream operators for the laid-out text. */
  operators: string;
  /** Number of lines rendered. */
  lineCount: number;
  /** Remaining text that didn't fit in the frame(s). */
  overflow: string;
  /** Y position after the last line (for continuation). */
  lastY: number;
  /** Actual height used. */
  usedHeight: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A single word token with measurement metadata. */
interface WordToken {
  text: string;
  width: number;
  fontName: string;
  fontSize: number;
  color?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  /** Whether a trailing space existed after this word in the source. */
  trailingSpace: boolean;
  /** Hyphenation candidate — original word before hyphen insertion. */
  isHyphenPart?: boolean;
  /** Index of the original word this fragment came from, for reconstruction. */
  originalWordIndex?: number;
}

/** A laid-out line of text. */
interface LayoutLine {
  words: WordToken[];
  width: number;
  spaceCount: number;
  isLastOfParagraph: boolean;
  /** Whether this line ends with a hyphenated word fragment. */
  endsWithHyphen: boolean;
}

// ---------------------------------------------------------------------------
// Default measure function
// ---------------------------------------------------------------------------

/**
 * Default text measurement function using character-count heuristic.
 * Average character width is 0.5 * fontSize for proportional Latin fonts.
 */
function defaultMeasure(text: string, _font: string, size: number): number {
  return text.length * size * 0.5;
}

// ---------------------------------------------------------------------------
// Hyphenation
// ---------------------------------------------------------------------------

/**
 * Common English suffix patterns that can be hyphenated.
 * Each entry is [suffix, splitPosition] where splitPosition is
 * the number of characters from the end to insert the hyphen before.
 */
const HYPHEN_SUFFIXES: ReadonlyArray<readonly [string, number]> = [
  ['tion', 4],
  ['sion', 4],
  ['ment', 4],
  ['ness', 4],
  ['able', 4],
  ['ible', 4],
  ['ence', 4],
  ['ance', 4],
  ['ling', 4],
  ['ture', 4],
  ['ious', 4],
  ['eous', 4],
  ['ally', 4],
  ['ful', 3],
  ['ing', 3],
  ['ous', 3],
  ['ive', 3],
  ['ize', 3],
  ['ise', 3],
  ['ory', 3],
  ['ary', 3],
  ['ery', 3],
  ['ist', 3],
  ['ism', 3],
  ['ity', 3],
  ['ess', 3],
  ['dom', 3],
  ['ant', 3],
  ['ent', 3],
  ['ly', 2],
  ['er', 2],
  ['ed', 2],
  ['al', 2],
  ['en', 2],
  ['ty', 2],
];

/** Minimum prefix length before a hyphen. */
const MIN_PREFIX = 2;
/** Minimum suffix length after a hyphen. */
const MIN_SUFFIX = 2;
/** Minimum word length to attempt hyphenation. */
const MIN_HYPHEN_WORD_LEN = MIN_PREFIX + MIN_SUFFIX + 1; // 5

/**
 * Find possible hyphenation points for a word.
 * Returns an array of split positions (character indices where a hyphen
 * could be inserted *before* the character at that index).
 */
export function findHyphenationPoints(word: string, _locale?: string): number[] {
  if (word.length < MIN_HYPHEN_WORD_LEN) return [];

  const points: number[] = [];
  const lower = word.toLowerCase();

  for (const [suffix, suffixLen] of HYPHEN_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      const splitPos = word.length - suffixLen;
      if (splitPos >= MIN_PREFIX && suffixLen >= MIN_SUFFIX) {
        points.push(splitPos);
      }
    }
  }

  // Also try splitting at common prefixes
  const prefixes = ['un', 're', 'in', 'dis', 'mis', 'pre', 'non', 'over', 'under', 'out'];
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix) && word.length - prefix.length >= MIN_SUFFIX) {
      points.push(prefix.length);
    }
  }

  // Deduplicate and sort
  return [...new Set(points)].sort((a, b) => a - b);
}

/**
 * Try to hyphenate a word to fit within the available width.
 * Returns [prefix + hyphenChar, suffix] if successful, or null if not.
 */
function tryHyphenate(
  word: string,
  availableWidth: number,
  measure: (text: string, font: string, size: number) => number,
  fontName: string,
  fontSize: number,
  hyphenChar: string,
  locale?: string,
): [string, string] | null {
  const points = findHyphenationPoints(word, locale);
  if (points.length === 0) return null;

  // Try each hyphenation point from longest prefix to shortest
  for (let i = points.length - 1; i >= 0; i--) {
    const pos = points[i]!;
    const prefix = word.slice(0, pos) + hyphenChar;
    const prefixWidth = measure(prefix, fontName, fontSize);
    if (prefixWidth <= availableWidth) {
      return [prefix, word.slice(pos)];
    }
  }

  // Try from shortest prefix
  for (const pos of points) {
    const prefix = word.slice(0, pos) + hyphenChar;
    const prefixWidth = measure(prefix, fontName, fontSize);
    if (prefixWidth <= availableWidth) {
      return [prefix, word.slice(pos)];
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Normalize input: accept a string or TextSpan array, returning normalized
 * spans. Paragraph boundaries are represented by '\n' in the text.
 */
function normalizeSpans(input: TextSpan[] | string): TextSpan[] {
  if (typeof input === 'string') {
    return [{ text: input }];
  }
  return input;
}

/**
 * Extract the font name string from a FontRef or string.
 */
function fontNameOf(font: FontRef | string | undefined, fallback: string): string {
  if (!font) return fallback;
  if (typeof font === 'string') return font;
  return font.name;
}

/**
 * Tokenize spans into word tokens, splitting on whitespace and preserving
 * paragraph boundaries as empty tokens with special markers.
 */
function tokenize(
  spans: TextSpan[],
  measure: (text: string, font: string, size: number) => number,
  defaultFontName: string,
  defaultFontSize: number,
): WordToken[] {
  const tokens: WordToken[] = [];

  for (const span of spans) {
    const fn = fontNameOf(span.font, defaultFontName);
    const fs = span.fontSize ?? defaultFontSize;

    // Split on newlines first, then on spaces
    const paragraphs = span.text.split('\n');

    for (let pi = 0; pi < paragraphs.length; pi++) {
      // Insert a paragraph break marker (except before the first paragraph)
      if (pi > 0) {
        tokens.push({
          text: '\n',
          width: 0,
          fontName: fn,
          fontSize: fs,
          trailingSpace: false,
          ...(span.color !== undefined && { color: span.color }),
          ...(span.bold !== undefined && { bold: span.bold }),
          ...(span.italic !== undefined && { italic: span.italic }),
          ...(span.underline !== undefined && { underline: span.underline }),
          ...(span.strikethrough !== undefined && { strikethrough: span.strikethrough }),
          ...(span.superscript !== undefined && { superscript: span.superscript }),
          ...(span.subscript !== undefined && { subscript: span.subscript }),
        });
      }

      const para = paragraphs[pi]!;
      if (para === '') continue;

      const words = para.split(/( +)/);

      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi]!;
        if (w === '' || /^ +$/.test(w)) continue;

        const width = measure(w, fn, fs);
        tokens.push({
          text: w,
          width,
          fontName: fn,
          fontSize: fs,
          trailingSpace: wi < words.length - 1,
          ...(span.color !== undefined && { color: span.color }),
          ...(span.bold !== undefined && { bold: span.bold }),
          ...(span.italic !== undefined && { italic: span.italic }),
          ...(span.underline !== undefined && { underline: span.underline }),
          ...(span.strikethrough !== undefined && { strikethrough: span.strikethrough }),
          ...(span.superscript !== undefined && { superscript: span.superscript }),
          ...(span.subscript !== undefined && { subscript: span.subscript }),
        });
      }
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Line breaking (Knuth-Plass inspired, simplified)
// ---------------------------------------------------------------------------

/** Word spacing limits for justified text (as fractions of normal space). */
const MIN_SPACE_FACTOR = 0.5;
const MAX_SPACE_FACTOR = 2.5;
const IDEAL_SPACE_FACTOR = 1.0;

/**
 * Break tokens into lines using a simplified Knuth-Plass approach.
 *
 * This greedy-with-lookahead algorithm considers hyphenation and
 * word-spacing adjustment to produce good line breaks.
 */
function breakIntoLines(
  tokens: WordToken[],
  lineWidth: number,
  options: ParagraphOptions,
  measure: (text: string, font: string, size: number) => number,
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  const hyphenation = options.hyphenation ?? false;
  const hyphenChar = options.hyphenChar ?? '-';
  const firstLineIndent = options.firstLineIndent ?? 0;
  const hangingIndent = options.hangingIndent ?? 0;

  let currentWords: WordToken[] = [];
  let currentWidth = 0;
  let spaceCount = 0;
  let isFirstLineOfPara = true;

  const effectiveWidth = (isFirst: boolean): number => {
    if (isFirst) return lineWidth - firstLineIndent;
    return lineWidth - hangingIndent;
  };

  const flushLine = (isLastOfParagraph: boolean, endsWithHyphen = false): void => {
    if (currentWords.length > 0) {
      lines.push({
        words: currentWords,
        width: currentWidth,
        spaceCount,
        isLastOfParagraph,
        endsWithHyphen,
      });
    }
    currentWords = [];
    currentWidth = 0;
    spaceCount = 0;
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;

    // Paragraph break
    if (token.text === '\n') {
      flushLine(true);
      isFirstLineOfPara = true;
      i++;
      continue;
    }

    const avail = effectiveWidth(isFirstLineOfPara && currentWords.length === 0);

    // Calculate the space width between words
    const spaceWidth = currentWords.length > 0
      ? measure(' ', token.fontName, token.fontSize)
      : 0;

    const candidateWidth = currentWidth + spaceWidth + token.width;

    if (candidateWidth <= avail) {
      // Word fits on the current line
      if (currentWords.length > 0) {
        spaceCount++;
        currentWidth += spaceWidth;
      }
      currentWords.push(token);
      currentWidth += token.width;
      i++;
    } else if (currentWords.length === 0) {
      // Single word exceeds line width — try hyphenation
      if (hyphenation && token.width > avail) {
        const result = tryHyphenate(
          token.text, avail, measure, token.fontName, token.fontSize,
          hyphenChar, options.locale,
        );
        if (result) {
          const [prefix, suffix] = result;
          const prefixToken: WordToken = {
            ...token,
            text: prefix,
            width: measure(prefix, token.fontName, token.fontSize),
            isHyphenPart: true,
          };
          currentWords.push(prefixToken);
          currentWidth = prefixToken.width;
          flushLine(false, true);
          isFirstLineOfPara = false;

          // Replace current token with the suffix and re-process
          tokens[i] = {
            ...token,
            text: suffix,
            width: measure(suffix, token.fontName, token.fontSize),
            isHyphenPart: true,
          };
          continue;
        }
      }
      // Can't hyphenate or hyphenation failed — force the word onto this line
      currentWords.push(token);
      currentWidth += token.width;
      flushLine(false);
      isFirstLineOfPara = false;
      i++;
    } else {
      // Word doesn't fit — try hyphenation before wrapping
      if (hyphenation) {
        const remainingWidth = avail - currentWidth - spaceWidth;
        if (remainingWidth > 0) {
          const result = tryHyphenate(
            token.text, remainingWidth, measure, token.fontName, token.fontSize,
            hyphenChar, options.locale,
          );
          if (result) {
            const [prefix, suffix] = result;
            const prefixToken: WordToken = {
              ...token,
              text: prefix,
              width: measure(prefix, token.fontName, token.fontSize),
              isHyphenPart: true,
            };
            spaceCount++;
            currentWidth += spaceWidth;
            currentWords.push(prefixToken);
            currentWidth += prefixToken.width;
            flushLine(false, true);
            isFirstLineOfPara = false;

            tokens[i] = {
              ...token,
              text: suffix,
              width: measure(suffix, token.fontName, token.fontSize),
              isHyphenPart: true,
            };
            continue;
          }
        }
      }

      // Wrap to next line
      flushLine(false);
      isFirstLineOfPara = false;
      // Don't increment i — reprocess this word on the new line
    }
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    flushLine(true);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Justified spacing calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the extra word spacing needed for justified alignment.
 * Returns 0 for lines that should not be justified (last line, single word).
 */
function calculateJustifySpacing(
  line: LayoutLine,
  availableWidth: number,
  measure: (text: string, font: string, size: number) => number,
): number {
  if (line.isLastOfParagraph || line.spaceCount === 0) return 0;

  const deficit = availableWidth - line.width;
  if (deficit <= 0) return 0;

  // Use the first word's font for space measurement
  const firstWord = line.words[0]!;
  const normalSpaceWidth = measure(' ', firstWord.fontName, firstWord.fontSize);

  const extraPerSpace = deficit / line.spaceCount;
  const totalSpaceWidth = normalSpaceWidth + extraPerSpace;

  // Clamp to reasonable bounds
  const minSpace = normalSpaceWidth * MIN_SPACE_FACTOR;
  const maxSpace = normalSpaceWidth * MAX_SPACE_FACTOR;

  if (totalSpaceWidth < minSpace || totalSpaceWidth > maxSpace) {
    // If clamped, just distribute what we can
    const clampedTotal = Math.max(minSpace, Math.min(maxSpace, totalSpaceWidth));
    return clampedTotal - normalSpaceWidth;
  }

  return extraPerSpace;
}

// ---------------------------------------------------------------------------
// PDF operator emission
// ---------------------------------------------------------------------------

/** Format a number for PDF output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Render a single laid-out line to PDF operators.
 */
function renderLine(
  line: LayoutLine,
  x: number,
  y: number,
  availableWidth: number,
  alignment: TextAlignment,
  measure: (text: string, font: string, size: number) => number,
  defaultFontName: string,
  defaultFontSize: number,
): string {
  let ops = '';

  // Calculate alignment offset
  let startX = x;
  let wordSpacingExtra = 0;

  switch (alignment) {
    case 'right':
      startX = x + availableWidth - line.width;
      break;
    case 'center':
      startX = x + (availableWidth - line.width) / 2;
      break;
    case 'justify':
      wordSpacingExtra = calculateJustifySpacing(line, availableWidth, measure);
      break;
    // 'left' — startX stays at x
  }

  ops += saveState();

  // Set word spacing for justified text
  if (wordSpacingExtra !== 0) {
    ops += setWordSpacing(wordSpacingExtra);
  }

  ops += beginText();

  let currentX = startX;
  let prevFontName = '';
  let prevFontSize = 0;
  let isFirstWord = true;

  for (const word of line.words) {
    const fn = word.fontName || defaultFontName;
    const fs = word.fontSize || defaultFontSize;

    // Set font if changed
    if (fn !== prevFontName || fs !== prevFontSize) {
      ops += setFont(fn, fs);
      prevFontName = fn;
      prevFontSize = fs;
    }

    // Set color if specified
    if (word.color) {
      ops += applyFillColor(word.color);
    }

    // Position the word
    if (isFirstWord) {
      ops += moveText(currentX, y);
      isFirstWord = false;
    } else {
      // Calculate the horizontal offset from the current position
      const spaceWidth = measure(' ', fn, fs) + wordSpacingExtra;
      ops += moveText(spaceWidth, 0);
      currentX += spaceWidth;
    }

    ops += showText(word.text);
    currentX += word.width;

    // Underline decoration
    if (word.underline) {
      ops += endText();
      ops += setLineWidth(fs * 0.05);
      const ulY = y - fs * 0.15;
      ops += moveTo(currentX - word.width, ulY);
      ops += lineTo(currentX, ulY);
      ops += stroke();
      ops += beginText();
      // Re-position after decoration
      ops += moveText(currentX, y);
    }

    // Strikethrough decoration
    if (word.strikethrough) {
      ops += endText();
      ops += setLineWidth(fs * 0.05);
      const stY = y + fs * 0.3;
      ops += moveTo(currentX - word.width, stY);
      ops += lineTo(currentX, stY);
      ops += stroke();
      ops += beginText();
      ops += moveText(currentX, y);
    }
  }

  ops += endText();

  // Reset word spacing
  if (wordSpacingExtra !== 0) {
    ops += setWordSpacing(0);
  }

  ops += restoreState();

  return ops;
}

// ---------------------------------------------------------------------------
// Widow/orphan control
// ---------------------------------------------------------------------------

/**
 * Apply widow/orphan control to laid-out lines that will fill a frame.
 *
 * Returns the number of lines that should be rendered in the current frame.
 * If the remaining lines would create widows/orphans, the count is adjusted.
 */
function applyWidowOrphanControl(
  totalLines: number,
  maxLinesInFrame: number,
  orphanLines: number,
  widowLines: number,
): number {
  if (totalLines <= maxLinesInFrame) return totalLines; // everything fits

  let count = maxLinesInFrame;

  // Orphan control: don't leave fewer than orphanLines at the bottom of this frame
  if (count < orphanLines && count < totalLines) {
    count = 0; // push everything to next frame
  }

  // Widow control: ensure next frame gets at least widowLines
  const remaining = totalLines - count;
  if (remaining > 0 && remaining < widowLines) {
    // Move lines back to ensure next frame has enough
    count = Math.max(0, totalLines - widowLines);
  }

  return count;
}

// ---------------------------------------------------------------------------
// Core layout: layoutParagraph
// ---------------------------------------------------------------------------

/**
 * Lay out a paragraph of text in a frame with full typographic control.
 *
 * Accepts plain text or an array of styled {@link TextSpan} objects.
 * Performs word wrapping, alignment, optional hyphenation, and
 * widow/orphan control.
 *
 * @param spans      The text content, as a plain string or styled spans.
 * @param frame      The rectangular frame to lay text into.
 * @param options    Paragraph layout options (alignment, hyphenation, etc.).
 * @param measureFn  Optional text measurement function. If omitted, a
 *                   character-count heuristic is used.
 * @returns          A {@link TextLayoutResult} with operators and overflow.
 */
export function layoutParagraph(
  spans: TextSpan[] | string,
  frame: TextFrame,
  options?: ParagraphOptions,
  measureFn?: (text: string, font: string, size: number) => number,
): TextLayoutResult {
  const opts = options ?? {};
  const measure = measureFn ?? defaultMeasure;
  const alignment = opts.alignment ?? 'left';
  const lineHeightMultiplier = opts.lineHeight ?? 1.2;
  const paragraphSpacing = opts.paragraphSpacing ?? 0;
  const firstLineIndent = opts.firstLineIndent ?? 0;
  const hangingIndent = opts.hangingIndent ?? 0;
  const orphanMin = opts.orphanLines ?? 2;
  const widowMin = opts.widowLines ?? 2;

  const defaultFontName = 'Helvetica';
  const defaultFontSize = 12;

  const normalizedSpans = normalizeSpans(spans);

  // Handle empty input
  if (normalizedSpans.length === 0 || normalizedSpans.every((s) => s.text === '')) {
    return { operators: '', lineCount: 0, overflow: '', lastY: frame.y, usedHeight: 0 };
  }

  // Handle zero-dimension frame
  if (frame.width <= 0 || frame.height <= 0) {
    const fullText = normalizedSpans.map((s) => s.text).join('');
    return { operators: '', lineCount: 0, overflow: fullText, lastY: frame.y, usedHeight: 0 };
  }

  // Tokenize
  const tokens = tokenize(normalizedSpans, measure, defaultFontName, defaultFontSize);
  if (tokens.length === 0) {
    return { operators: '', lineCount: 0, overflow: '', lastY: frame.y, usedHeight: 0 };
  }

  // Break into lines
  const lines = breakIntoLines(tokens, frame.width, opts, measure);
  if (lines.length === 0) {
    return { operators: '', lineCount: 0, overflow: '', lastY: frame.y, usedHeight: 0 };
  }

  // Calculate how many lines fit in the frame
  const fontSize = tokens[0]!.fontSize || defaultFontSize;
  const lineHeight = fontSize * lineHeightMultiplier;

  let maxLines = 0;
  let totalH = 0;
  for (let li = 0; li < lines.length; li++) {
    const isNewParagraph = li > 0 && lines[li - 1]!.isLastOfParagraph;
    const extraSpacing = isNewParagraph ? paragraphSpacing : 0;
    const neededH = lineHeight + extraSpacing;
    if (totalH + neededH > frame.height + 0.001) break;
    totalH += neededH;
    maxLines++;
  }

  // Apply widow/orphan control
  const renderCount = applyWidowOrphanControl(lines.length, maxLines, orphanMin, widowMin);

  // Render lines
  let ops = '';
  let currentY = frame.y - lineHeight; // First baseline
  let usedHeight = 0;
  let linesRendered = 0;

  for (let li = 0; li < renderCount; li++) {
    const line = lines[li]!;
    const isNewParagraph = li > 0 && lines[li - 1]!.isLastOfParagraph;
    const extraSpacing = isNewParagraph ? paragraphSpacing : 0;

    if (li > 0) {
      currentY -= lineHeight + extraSpacing;
    }

    // Calculate effective X offset for indent
    const isFirstOfParagraph = li === 0 || (li > 0 && lines[li - 1]!.isLastOfParagraph);
    const indent = isFirstOfParagraph ? firstLineIndent : hangingIndent;
    const effectiveX = frame.x + indent;
    const effectiveWidth = frame.width - indent;

    ops += renderLine(
      line, effectiveX, currentY, effectiveWidth,
      alignment, measure, defaultFontName, defaultFontSize,
    );

    linesRendered++;
    usedHeight = frame.y - currentY + lineHeight * 0.2; // approximate descent
  }

  // Build overflow text from unrendered lines
  let overflow = '';
  for (let li = renderCount; li < lines.length; li++) {
    const line = lines[li]!;
    if (li > renderCount) {
      if (lines[li - 1]!.isLastOfParagraph) {
        overflow += '\n';
      } else {
        overflow += ' ';
      }
    }
    for (let wi = 0; wi < line.words.length; wi++) {
      if (wi > 0) overflow += ' ';
      const word = line.words[wi]!;
      overflow += word.text;
    }
  }

  return {
    operators: ops,
    lineCount: linesRendered,
    overflow,
    lastY: currentY,
    usedHeight,
  };
}

// ---------------------------------------------------------------------------
// Multi-column layout: layoutColumns
// ---------------------------------------------------------------------------

/**
 * Lay out text across multiple columns within a frame.
 *
 * Divides the frame into equal-width columns separated by gaps,
 * then flows text sequentially through each column. Optionally
 * draws column rules (vertical lines between columns) and balances
 * column heights.
 *
 * @param spans           The text content.
 * @param frame           The outer frame containing all columns.
 * @param columnOptions   Number of columns, gap, rule, balancing.
 * @param paragraphOptions  Paragraph-level options.
 * @param measureFn       Optional text measurement function.
 * @returns               A combined {@link TextLayoutResult}.
 */
export function layoutColumns(
  spans: TextSpan[] | string,
  frame: TextFrame,
  columnOptions: MultiColumnOptions,
  paragraphOptions?: ParagraphOptions,
  measureFn?: (text: string, font: string, size: number) => number,
): TextLayoutResult {
  const numColumns = Math.max(1, Math.floor(columnOptions.columns));
  const gap = columnOptions.columnGap ?? 18;
  const balance = columnOptions.balanceColumns ?? true;

  const totalGaps = (numColumns - 1) * gap;
  const columnWidth = (frame.width - totalGaps) / numColumns;

  if (columnWidth <= 0) {
    const fullText = typeof spans === 'string' ? spans : spans.map((s) => s.text).join('');
    return { operators: '', lineCount: 0, overflow: fullText, lastY: frame.y, usedHeight: 0 };
  }

  // Build column frames
  const columnFrames: TextFrame[] = [];
  for (let c = 0; c < numColumns; c++) {
    columnFrames.push({
      x: frame.x + c * (columnWidth + gap),
      y: frame.y,
      width: columnWidth,
      height: frame.height,
    });
  }

  // If balancing, do a pre-layout to determine total lines, then
  // distribute evenly across columns by adjusting frame heights.
  let effectiveFrames = columnFrames;

  if (balance && numColumns > 1) {
    // Do a full layout in a single tall frame to count total lines
    const tallFrame: TextFrame = {
      x: frame.x,
      y: frame.y,
      width: columnWidth,
      height: frame.height * numColumns, // plenty of space
    };
    const fullResult = layoutParagraph(spans, tallFrame, paragraphOptions, measureFn);

    if (fullResult.overflow === '' && fullResult.lineCount > 0) {
      // Calculate balanced height: distribute lines evenly
      const measure = measureFn ?? defaultMeasure;
      const normalizedSpans = normalizeSpans(spans);
      const defaultFontSize = normalizedSpans[0]?.fontSize ?? 12;
      const lineHeightMult = paragraphOptions?.lineHeight ?? 1.2;
      const lineH = defaultFontSize * lineHeightMult;

      const linesPerCol = Math.ceil(fullResult.lineCount / numColumns);
      const balancedHeight = Math.min(frame.height, linesPerCol * lineH + lineH * 0.5);

      effectiveFrames = columnFrames.map((cf) => ({
        ...cf,
        height: balancedHeight,
      }));
    }
  }

  // Flow text through columns
  let combinedOps = '';
  let totalLineCount = 0;
  let lastY = frame.y;
  let maxUsedHeight = 0;
  let remainingText: TextSpan[] | string = spans;

  for (let c = 0; c < numColumns; c++) {
    if (typeof remainingText === 'string' && remainingText === '') break;
    if (Array.isArray(remainingText) && remainingText.every((s) => s.text === '')) break;

    const result = layoutParagraph(
      remainingText, effectiveFrames[c]!, paragraphOptions, measureFn,
    );

    combinedOps += result.operators;
    totalLineCount += result.lineCount;
    lastY = result.lastY;
    if (result.usedHeight > maxUsedHeight) maxUsedHeight = result.usedHeight;

    if (result.overflow) {
      remainingText = result.overflow;
    } else {
      remainingText = '';
    }
  }

  // Draw column rules
  if (columnOptions.columnRule && numColumns > 1) {
    const rule = columnOptions.columnRule;
    combinedOps += saveState();
    combinedOps += applyStrokeColor(rule.color);
    combinedOps += setLineWidth(rule.width);

    if (rule.style === 'dashed') {
      combinedOps += setDashPattern([4, 4], 0);
    }

    for (let c = 0; c < numColumns - 1; c++) {
      const ruleX = frame.x + (c + 1) * (columnWidth + gap) - gap / 2;
      const ruleTop = frame.y;
      const ruleBottom = frame.y - maxUsedHeight;

      combinedOps += moveTo(ruleX, ruleTop);
      combinedOps += lineTo(ruleX, ruleBottom);
      combinedOps += stroke();
    }

    combinedOps += restoreState();
  }

  const finalOverflow = typeof remainingText === 'string'
    ? remainingText
    : remainingText.map((s) => s.text).join('');

  return {
    operators: combinedOps,
    lineCount: totalLineCount,
    overflow: finalOverflow,
    lastY,
    usedHeight: maxUsedHeight,
  };
}

// ---------------------------------------------------------------------------
// Multi-frame flow: layoutTextFlow
// ---------------------------------------------------------------------------

/**
 * Lay out text across multiple frames (for multi-page flow).
 *
 * Text flows from one frame to the next, with each frame producing
 * its own {@link TextLayoutResult}. Useful for flowing a long body of
 * text across multiple pages.
 *
 * @param spans      The text content.
 * @param frames     Array of frames to fill in order.
 * @param options    Paragraph-level options.
 * @param measureFn  Optional text measurement function.
 * @returns          An array of results, one per frame used.
 */
export function layoutTextFlow(
  spans: TextSpan[] | string,
  frames: TextFrame[],
  options?: ParagraphOptions,
  measureFn?: (text: string, font: string, size: number) => number,
): TextLayoutResult[] {
  if (frames.length === 0) return [];

  const results: TextLayoutResult[] = [];
  let remainingText: TextSpan[] | string = spans;

  for (const frame of frames) {
    // Check if there's still text to lay out
    const hasText = typeof remainingText === 'string'
      ? remainingText.length > 0
      : remainingText.some((s) => s.text.length > 0);

    if (!hasText) {
      results.push({
        operators: '',
        lineCount: 0,
        overflow: '',
        lastY: frame.y,
        usedHeight: 0,
      });
      continue;
    }

    const result = layoutParagraph(remainingText, frame, options, measureFn);
    results.push(result);

    if (result.overflow) {
      remainingText = result.overflow;
    } else {
      remainingText = '';
    }
  }

  return results;
}

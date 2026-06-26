/**
 * @module parser/textReconstruct
 *
 * Reconstruct words, lines and paragraphs from positioned text items.
 *
 * PDF content streams emit text as a stream of positioned glyph runs with no
 * inherent notion of "line" or "paragraph".  This module groups raw
 * {@link TextItem} records back into human-readable structure:
 *
 * - **Lines** — items that share (approximately) the same baseline `y`, sorted
 *   left-to-right by `x`, joined with spaces where the horizontal gap between
 *   consecutive items is large enough to imply a word break.
 * - **Paragraphs** — consecutive lines grouped together until the vertical gap
 *   between two lines exceeds a multiple of the typical line height.
 *
 * Reference: PDF 1.7 spec, §9 (Text).
 *
 * @packageDocumentation
 */

import type { TextItem } from './textExtractor.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single reconstructed line of text.
 */
export interface Line {
  /** The joined text content of the line, in reading order. */
  readonly text: string;
  /** The representative baseline `y` coordinate of the line. */
  readonly y: number;
  /** The source items that make up this line, sorted left-to-right. */
  readonly items: readonly TextItem[];
}

/**
 * A reconstructed paragraph: a run of vertically-adjacent lines.
 */
export interface Paragraph {
  /** The joined text content of the paragraph (lines joined with `"\n"`). */
  readonly text: string;
  /** The lines that make up this paragraph, in top-to-bottom reading order. */
  readonly lines: readonly Line[];
}

/**
 * Options controlling line and paragraph reconstruction.
 */
export interface ReconstructOptions {
  /**
   * Maximum vertical distance (in user-space units) between two items for
   * them to be considered part of the same line.
   * Default: roughly half the median item height.
   */
  readonly lineTolerance?: number | undefined;
  /**
   * A new paragraph starts when the vertical gap between two consecutive
   * lines exceeds this factor times the typical line height.
   * Default: `1.5`.
   */
  readonly paragraphGapFactor?: number | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute the median of a non-empty list of numbers. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const lo = sorted[mid - 1] ?? 0;
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 0 ? (lo + hi) / 2 : hi;
}

/**
 * Join the items of a single line into a text string, inserting a space when
 * the horizontal gap between consecutive items exceeds a fraction of the font
 * size (so that visually-separated words are not glued together).
 */
function joinLineItems(items: readonly TextItem[]): string {
  let out = '';
  let prev: TextItem | undefined;
  for (const item of items) {
    if (prev !== undefined) {
      const prevRight = prev.x + prev.width;
      const gap = item.x - prevRight;
      const threshold = Math.max(prev.fontSize, item.fontSize) * 0.25;
      const endsWithSpace = out.length > 0 && out.endsWith(' ');
      const startsWithSpace = item.text.startsWith(' ');
      if (gap > threshold && !endsWithSpace && !startsWithSpace) {
        out += ' ';
      }
    }
    out += item.text;
    prev = item;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Group positioned text items into lines.
 *
 * Items are bucketed by baseline `y` (within `lineTolerance`), sorted
 * left-to-right within each line, and returned in top-to-bottom reading order.
 *
 * @param items   The positioned text items (e.g. from `extractText` with
 *                positions enabled).  Order is irrelevant; they are re-sorted.
 * @param options Reconstruction options.
 * @returns The reconstructed lines, in reading order.
 */
export function reconstructLines(
  items: readonly TextItem[],
  options?: ReconstructOptions,
): Line[] {
  if (items.length === 0) return [];

  const heights = items.map((it) => (it.height > 0 ? it.height : it.fontSize));
  const medianHeight = median(heights) || 1;
  const tolerance =
    options?.lineTolerance !== undefined && options.lineTolerance >= 0
      ? options.lineTolerance
      : medianHeight * 0.5;

  // Sort by descending y (top of page first), then ascending x.
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > tolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: Line[] = [];
  let current: TextItem[] = [];
  let lineY = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    const ordered = [...current].sort((a, b) => a.x - b.x);
    lines.push({
      text: joinLineItems(ordered),
      y: lineY,
      items: ordered,
    });
    current = [];
  };

  for (const item of sorted) {
    if (current.length === 0) {
      lineY = item.y;
      current.push(item);
      continue;
    }
    if (Math.abs(item.y - lineY) <= tolerance) {
      current.push(item);
    } else {
      flush();
      lineY = item.y;
      current.push(item);
    }
  }
  flush();

  return lines;
}

/**
 * Group positioned text items into paragraphs.
 *
 * First reconstructs lines (see {@link reconstructLines}), then starts a new
 * paragraph whenever the vertical gap between two consecutive lines exceeds
 * `paragraphGapFactor` times the typical (median) line height.
 *
 * @param items   The positioned text items.
 * @param options Reconstruction options.
 * @returns The reconstructed paragraphs, in reading order.
 */
export function reconstructParagraphs(
  items: readonly TextItem[],
  options?: ReconstructOptions,
): Paragraph[] {
  const lines = reconstructLines(items, options);
  if (lines.length === 0) return [];
  if (lines.length === 1) {
    return [{ text: lines[0]?.text ?? '', lines }];
  }

  const gapFactor =
    options?.paragraphGapFactor !== undefined && options.paragraphGapFactor > 0
      ? options.paragraphGapFactor
      : 1.5;

  // Typical line height: median of the gaps between consecutive baselines,
  // falling back to median item height when only one gap exists.
  const baselineGaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const cur = lines[i];
    if (prev !== undefined && cur !== undefined) {
      baselineGaps.push(Math.abs(prev.y - cur.y));
    }
  }
  const heights = items.map((it) => (it.height > 0 ? it.height : it.fontSize));
  const typicalGap =
    baselineGaps.length > 0 ? median(baselineGaps) : median(heights) || 1;
  const paragraphThreshold = typicalGap * gapFactor;

  const paragraphs: Paragraph[] = [];
  let group: Line[] = [];

  const flush = (): void => {
    if (group.length === 0) return;
    paragraphs.push({
      text: group.map((l) => l.text).join('\n'),
      lines: group,
    });
    group = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (group.length === 0) {
      group.push(line);
      continue;
    }
    const prev = group[group.length - 1];
    const gap = prev !== undefined ? Math.abs(prev.y - line.y) : 0;
    if (gap > paragraphThreshold) {
      flush();
    }
    group.push(line);
  }
  flush();

  return paragraphs;
}

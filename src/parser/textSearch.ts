/**
 * @module parser/textSearch
 *
 * In-page text search with bounding-box hit-rectangles (ISO 32000-2 reading).
 *
 * Operates on the positioned {@link TextItem}s produced by
 * `extractTextWithPositions`, mapping string/RegExp matches back to page
 * coordinates so callers can highlight results or implement find-in-page.
 * Pure TypeScript — no WASM required.
 */

import type { TextItem } from './textExtractor.js';

/** A rectangle in user-space (PDF) coordinates. */
export interface SearchRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A single search match and the page rectangles it covers. */
export interface TextMatch {
  /** The matched substring. */
  readonly text: string;
  /** Character offset of the match within the joined search text. */
  readonly index: number;
  /** One hit-rectangle per text item the match spans. */
  readonly rects: readonly SearchRect[];
}

/** Options for {@link searchTextItems}. */
export interface SearchOptions {
  /** Match case exactly. Default: `false` (case-insensitive). */
  readonly caseSensitive?: boolean | undefined;
  /** Only match whole words (`\b` boundaries). Ignored for RegExp queries. Default: `false`. */
  readonly wholeWord?: boolean | undefined;
}

/** Source of a single character in the joined search text. */
interface CharSource {
  readonly item: number;
  readonly charIndex: number;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegExp(query: string | RegExp, options: SearchOptions | undefined): RegExp {
  if (query instanceof RegExp) {
    // `matchAll` requires the global flag.
    const flags = query.flags.includes('g') ? query.flags : `${query.flags}g`;
    return new RegExp(query.source, flags);
  }
  const body = options?.wholeWord ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
  return new RegExp(body, options?.caseSensitive ? 'g' : 'gi');
}

/** Build one hit-rect per contiguous run of same-item characters in `[start, end)`. */
function rectsForRange(
  items: readonly TextItem[],
  charMap: readonly (CharSource | null)[],
  start: number,
  end: number,
): SearchRect[] {
  const rects: SearchRect[] = [];
  let runItem = -1;
  let runFirst = -1;
  let runLast = -1;

  const flush = (): void => {
    if (runItem < 0) return;
    const item = items[runItem];
    if (item && item.text.length > 0) {
      const perChar = item.width / item.text.length;
      rects.push({
        x: item.x + runFirst * perChar,
        y: item.y,
        width: (runLast - runFirst + 1) * perChar,
        height: item.height,
      });
    }
    runItem = -1;
  };

  for (let k = start; k < end; k++) {
    const src = charMap[k];
    if (!src) {
      flush(); // inserted separator → break the run
      continue;
    }
    if (src.item === runItem) {
      runLast = src.charIndex;
    } else {
      flush();
      runItem = src.item;
      runFirst = src.charIndex;
      runLast = src.charIndex;
    }
  }
  flush();
  return rects;
}

/**
 * Search positioned text items for a string or RegExp, returning each match
 * with its page-coordinate hit-rectangles.
 *
 * Items are joined with a single space (the natural inter-run separator);
 * matches that span items yield one rectangle per item touched.
 *
 * @param items   - Positioned text items from `extractTextWithPositions`.
 * @param query   - A literal string or a `RegExp` to search for.
 * @param options - Case-sensitivity / whole-word options (string queries).
 * @returns The matches in document order.
 */
export function searchTextItems(
  items: readonly TextItem[],
  query: string | RegExp,
  options?: SearchOptions,
): TextMatch[] {
  let joined = '';
  const charMap: (CharSource | null)[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    if (i > 0) {
      joined += ' ';
      charMap.push(null);
    }
    for (let ci = 0; ci < item.text.length; ci++) {
      joined += item.text[ci];
      charMap.push({ item: i, charIndex: ci });
    }
  }

  const regex = buildRegExp(query, options);
  const matches: TextMatch[] = [];
  for (const match of joined.matchAll(regex)) {
    const start = match.index;
    const text = match[0];
    if (text.length === 0) continue; // avoid infinite empty matches
    matches.push({
      text,
      index: start,
      rects: rectsForRange(items, charMap, start, start + text.length),
    });
  }
  return matches;
}

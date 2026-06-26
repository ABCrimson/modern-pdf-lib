/**
 * Tests for in-page text search with bounding-box hit-rectangles
 * (roadmap 0.28.7) — searches the positioned text items produced by
 * `extractTextWithPositions` and maps matches back to page coordinates.
 */

import { describe, it, expect } from 'vitest';
import { searchTextItems } from '../../../src/parser/textSearch.js';
import type { TextItem } from '../../../src/parser/textExtractor.js';

const items: TextItem[] = [
  { text: 'Hello', x: 10, y: 700, width: 50, height: 12, fontSize: 12, fontName: '/F1' },
  { text: 'World', x: 70, y: 700, width: 50, height: 12, fontSize: 12, fontName: '/F1' },
];

describe('searchTextItems', () => {
  it('finds a whole item and returns its hit-rect', () => {
    const matches = searchTextItems(items, 'World');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.text).toBe('World');
    expect(matches[0]!.rects).toHaveLength(1);
    expect(matches[0]!.rects[0]).toMatchObject({ x: 70, y: 700, width: 50, height: 12 });
  });

  it('is case-insensitive by default and case-sensitive on request', () => {
    expect(searchTextItems(items, 'hello')).toHaveLength(1);
    expect(searchTextItems(items, 'hello', { caseSensitive: true })).toHaveLength(0);
  });

  it('supports RegExp queries, returning every match', () => {
    const matches = searchTextItems(items, /[A-Z]\w+/g);
    expect(matches.map((m) => m.text)).toEqual(['Hello', 'World']);
  });

  it('returns a sub-rect for a partial match within one item', () => {
    const m = searchTextItems(items, 'ell'); // chars 1-3 of "Hello" (len 5), x=10 w=50 → 10/char
    expect(m).toHaveLength(1);
    expect(m[0]!.rects).toHaveLength(1);
    expect(m[0]!.rects[0]!.x).toBeCloseTo(20, 5); // 10 + (1/5)*50
    expect(m[0]!.rects[0]!.width).toBeCloseTo(30, 5); // (3/5)*50
  });

  it('spans a match across two items with one rect per item', () => {
    const m = searchTextItems(items, 'o W'); // 'o' in Hello, separator, 'W' in World
    expect(m).toHaveLength(1);
    expect(m[0]!.rects).toHaveLength(2);
  });

  it('respects the wholeWord option', () => {
    const moreItems: TextItem[] = [
      { text: 'cat', x: 0, y: 0, width: 30, height: 10, fontSize: 10, fontName: '/F1' },
      { text: 'category', x: 40, y: 0, width: 80, height: 10, fontSize: 10, fontName: '/F1' },
    ];
    expect(searchTextItems(moreItems, 'cat')).toHaveLength(2); // substring of "category" too
    expect(searchTextItems(moreItems, 'cat', { wholeWord: true })).toHaveLength(1);
  });
});

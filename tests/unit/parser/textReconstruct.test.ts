import { describe, expect, it } from 'vitest';

import type { TextItem } from '../../../src/parser/textExtractor.js';
import {
  reconstructLines,
  reconstructParagraphs,
} from '../../../src/parser/textReconstruct.js';

/** Helper to build a TextItem with sensible defaults. */
function item(
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize = 10,
): TextItem {
  return {
    text,
    x,
    y,
    width,
    height: fontSize,
    fontSize,
    fontName: '/F1',
  };
}

/**
 * Two paragraphs of two lines each.  Font size 10, line spacing 12 within a
 * paragraph, and a large gap (30) between the two paragraphs.
 *
 * Paragraph A:  y=200 "Hello world"   y=188 "second line"
 * Paragraph B:  y=158 "Third here"    y=146 "fourth line"
 */
function twoParagraphs(): TextItem[] {
  return [
    // Paragraph A, line 1 (split into two words, scrambled order).
    item('world', 60, 200, 40),
    item('Hello', 10, 200, 40),
    // Paragraph A, line 2.
    item('second', 10, 188, 50),
    item('line', 70, 188, 25),
    // Paragraph B, line 1.
    item('Third', 10, 158, 40),
    item('here', 60, 158, 30),
    // Paragraph B, line 2.
    item('fourth', 10, 146, 50),
    item('line', 70, 146, 25),
  ];
}

describe('reconstructLines', () => {
  it('returns an empty array for no items', () => {
    expect(reconstructLines([])).toEqual([]);
  });

  it('groups items into 4 lines in reading order', () => {
    const lines = reconstructLines(twoParagraphs());
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l.text)).toEqual([
      'Hello world',
      'second line',
      'Third here',
      'fourth line',
    ]);
  });

  it('sorts items left-to-right within a line', () => {
    const lines = reconstructLines(twoParagraphs());
    const first = lines[0];
    expect(first).toBeDefined();
    expect(first?.items.map((i) => i.text)).toEqual(['Hello', 'world']);
    expect(first?.y).toBe(200);
  });

  it('does not insert a space when items are tightly packed', () => {
    const items: TextItem[] = [
      item('Hel', 10, 100, 18),
      item('lo', 28, 100, 12), // starts exactly where prev ends -> no gap
    ];
    const lines = reconstructLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe('Hello');
  });

  it('inserts a space when the horizontal gap is large', () => {
    const items: TextItem[] = [
      item('foo', 10, 100, 20),
      item('bar', 90, 100, 20), // big gap
    ];
    const lines = reconstructLines(items);
    expect(lines[0]?.text).toBe('foo bar');
  });

  it('respects an explicit lineTolerance', () => {
    // Two baselines 4 apart. With tolerance 1, they are two lines.
    const items: TextItem[] = [
      item('a', 10, 100, 8),
      item('b', 10, 96, 8),
    ];
    const tight = reconstructLines(items, { lineTolerance: 1 });
    expect(tight).toHaveLength(2);
    const loose = reconstructLines(items, { lineTolerance: 10 });
    expect(loose).toHaveLength(1);
  });

  it('does not duplicate spaces when text already contains them', () => {
    const items: TextItem[] = [
      item('foo ', 10, 100, 24),
      item('bar', 90, 100, 20),
    ];
    const lines = reconstructLines(items);
    expect(lines[0]?.text).toBe('foo bar');
  });
});

describe('reconstructParagraphs', () => {
  it('returns an empty array for no items', () => {
    expect(reconstructParagraphs([])).toEqual([]);
  });

  it('groups lines into 2 paragraphs of 2 lines each', () => {
    const paragraphs = reconstructParagraphs(twoParagraphs());
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.lines.length)).toEqual([2, 2]);
  });

  it('joins paragraph text with newlines', () => {
    const paragraphs = reconstructParagraphs(twoParagraphs());
    expect(paragraphs[0]?.text).toBe('Hello world\nsecond line');
    expect(paragraphs[1]?.text).toBe('Third here\nfourth line');
  });

  it('produces a single paragraph when lines are evenly spaced', () => {
    const items: TextItem[] = [
      item('one', 10, 200, 30),
      item('two', 10, 188, 30),
      item('three', 10, 176, 40),
    ];
    const paragraphs = reconstructParagraphs(items);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.lines).toHaveLength(3);
  });

  it('handles a single line', () => {
    const items: TextItem[] = [item('solo', 10, 100, 30)];
    const paragraphs = reconstructParagraphs(items);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.text).toBe('solo');
    expect(paragraphs[0]?.lines).toHaveLength(1);
  });

  it('splits more aggressively with a smaller paragraphGapFactor', () => {
    // Lines spaced 12 apart; with factor 0.5 even normal spacing splits.
    const items: TextItem[] = [
      item('a', 10, 200, 8),
      item('b', 10, 188, 8),
      item('c', 10, 176, 8),
    ];
    const split = reconstructParagraphs(items, { paragraphGapFactor: 0.5 });
    expect(split.length).toBeGreaterThan(1);
  });
});

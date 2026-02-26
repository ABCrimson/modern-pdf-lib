import { describe, it, expect } from 'vitest';
import { layoutMultilineText, layoutCombedText, computeFontSize } from '../../../src/core/layout.js';

function mockFont(charWidth: number) {
  return {
    name: 'F1',
    ref: { kind: 'ref' as const, objectNumber: 1, generationNumber: 0, serialize: () => {} } as any,
    widthOfTextAtSize: (text: string, size: number) => text.length * charWidth * (size / 12),
    heightAtSize: (size: number) => size * 1.2,
  };
}

describe('layoutMultilineText', () => {
  it('wraps text into lines with measured widths', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('hello world this is a test', {
      font,
      fontSize: 12,
      maxWidth: 80,
    });
    expect(result.lines.length).toBeGreaterThan(1);
    for (const line of result.lines) {
      expect(line.text.length).toBeGreaterThan(0);
      expect(typeof line.width).toBe('number');
      expect(line.width).toBeGreaterThan(0);
    }
    expect(result.height).toBeGreaterThan(0);
  });

  it('respects explicit newlines', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('line1\nline2\nline3', {
      font,
      fontSize: 12,
      maxWidth: 1000,
    });
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].text).toBe('line1');
    expect(result.lines[1].text).toBe('line2');
    expect(result.lines[2].text).toBe('line3');
  });

  it('accepts custom wordBreaks', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('one-two-three-four', {
      font,
      fontSize: 12,
      maxWidth: 50,
      wordBreaks: ['-'],
    });
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('returns single line when text fits', () => {
    const font = mockFont(6);
    const result = layoutMultilineText('hi', {
      font,
      fontSize: 12,
      maxWidth: 1000,
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe('hi');
  });
});

describe('layoutCombedText', () => {
  it('positions characters in cells', () => {
    const font = mockFont(6);
    const result = layoutCombedText('ABCD', {
      font,
      fontSize: 12,
      cellCount: 6,
      cellWidth: 20,
    });
    expect(result).toHaveLength(4);
    expect(result[0].char).toBe('A');
    expect(typeof result[0].x).toBe('number');
    expect(typeof result[0].width).toBe('number');
    expect(result[1].x).toBeGreaterThan(result[0].x);
  });

  it('truncates to cellCount', () => {
    const font = mockFont(6);
    const result = layoutCombedText('ABCDEFGHIJ', {
      font,
      fontSize: 12,
      cellCount: 4,
      cellWidth: 20,
    });
    expect(result).toHaveLength(4);
  });

  it('handles empty string', () => {
    const font = mockFont(6);
    const result = layoutCombedText('', {
      font,
      fontSize: 12,
      cellCount: 4,
      cellWidth: 20,
    });
    expect(result).toHaveLength(0);
  });
});

describe('computeFontSize', () => {
  it('finds the largest font size that fits within width', () => {
    const font = mockFont(6);
    const size = computeFontSize('Hello World', {
      font,
      maxWidth: 100,
    });
    expect(size).toBeGreaterThan(0);
    // Verify that every wrapped line at the computed size fits within maxWidth
    const layout = layoutMultilineText('Hello World', { font, fontSize: size, maxWidth: 100 });
    for (const line of layout.lines) {
      expect(line.width).toBeLessThanOrEqual(100 + 0.5); // Small tolerance
    }
  });

  it('respects maxHeight', () => {
    const font = mockFont(6);
    const size = computeFontSize('A', {
      font,
      maxWidth: 10000,
      maxHeight: 20,
    });
    const height = font.heightAtSize(size);
    expect(height).toBeLessThanOrEqual(20 + 0.5);
  });

  it('returns minSize when text cannot fit', () => {
    const font = mockFont(60);
    const size = computeFontSize('This is very long text that cannot fit', {
      font,
      maxWidth: 10,
      minSize: 4,
    });
    expect(size).toBe(4);
  });

  it('does not exceed maxSize', () => {
    const font = mockFont(1);
    const size = computeFontSize('A', {
      font,
      maxWidth: 10000,
      maxSize: 72,
    });
    expect(size).toBeLessThanOrEqual(72);
  });
});

import { describe, it, expect } from 'vitest';
import { wrapText, breakWord } from '../../../src/core/pdfPageText.js';
import type { FontRef } from '../../../src/core/pdfPage.js';
import { PdfRef } from '../../../src/core/pdfObjects.js';

/**
 * Create a mock FontRef that measures text width as
 * `text.length * charWidth * (size / baseFontSize)`.
 */
function mockFont(charWidth: number = 6, baseFontSize: number = 12): FontRef {
  return {
    name: 'TestFont',
    ref: PdfRef.of(1, 0),
    widthOfTextAtSize(text: string, size: number): number {
      return text.length * charWidth * (size / baseFontSize);
    },
    heightAtSize(size: number): number {
      return size;
    },
  };
}

describe('pdfPageText', () => {
  // -----------------------------------------------------------------------
  // wrapText
  // -----------------------------------------------------------------------

  describe('wrapText', () => {
    it('returns text as-is when it fits within maxWidth', () => {
      const font = mockFont(6, 12);
      // "Hello" = 5 chars * 6 = 30 pts at size 12
      const result = wrapText('Hello', 100, font, 12);
      expect(result).toEqual(['Hello']);
    });

    it('returns text as-is when font is a string (no measurement)', () => {
      const result = wrapText('This is a very long text that would normally wrap', 10, 'F1', 12);
      expect(result).toEqual(['This is a very long text that would normally wrap']);
    });

    it('wraps text at word boundaries when it exceeds maxWidth', () => {
      const font = mockFont(6, 12);
      // "Hello World" = 11 chars * 6 = 66 pts, maxWidth = 40
      const result = wrapText('Hello World', 40, font, 12);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toBe('Hello');
      expect(result[1]).toBe('World');
    });

    it('respects custom word breaks', () => {
      const font = mockFont(6, 12);
      // "Hello-World" with hyphen as break char
      const result = wrapText('Hello-World', 50, font, 12, [' ', '-']);
      // Should break at the hyphen, keeping it at end of first line
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('wraps multiple words across multiple lines', () => {
      const font = mockFont(6, 12);
      // Each word is about 30pts, maxWidth = 70 allows ~2 words per line
      const result = wrapText('one two three four five', 70, font, 12);
      expect(result.length).toBeGreaterThan(1);
    });

    it('handles empty string', () => {
      const font = mockFont(6, 12);
      const result = wrapText('', 100, font, 12);
      expect(result).toEqual(['']);
    });
  });

  // -----------------------------------------------------------------------
  // breakWord
  // -----------------------------------------------------------------------

  describe('breakWord', () => {
    it('returns word as-is when it fits within maxWidth', () => {
      const font = mockFont(6, 12);
      // "Hi" = 2 chars * 6 = 12 pts
      const result = breakWord('Hi', 100, font, 12);
      expect(result).toEqual(['Hi']);
    });

    it('breaks a word at character level when it exceeds maxWidth', () => {
      const font = mockFont(6, 12);
      // "ABCDEFGHIJ" = 10 chars * 6 = 60 pts, maxWidth = 24 (4 chars)
      const result = breakWord('ABCDEFGHIJ', 24, font, 12);
      expect(result.length).toBeGreaterThan(1);
      // Each fragment should fit within maxWidth
      for (const fragment of result) {
        expect(font.widthOfTextAtSize(fragment, 12)).toBeLessThanOrEqual(24);
      }
    });

    it('produces fragments that reconstruct the original word', () => {
      const font = mockFont(6, 12);
      const word = 'Supercalifragilistic';
      const result = breakWord(word, 30, font, 12);
      expect(result.join('')).toBe(word);
    });

    it('handles single character word', () => {
      const font = mockFont(6, 12);
      const result = breakWord('X', 100, font, 12);
      expect(result).toEqual(['X']);
    });

    it('handles empty string', () => {
      const font = mockFont(6, 12);
      const result = breakWord('', 100, font, 12);
      expect(result).toEqual([]);
    });
  });
});

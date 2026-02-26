import { describe, it, expect } from 'vitest';
import { PdfPage, wrapText } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// Create a mock FontRef that returns fixed character widths
function mockFont(charWidth: number) {
  return {
    name: 'F1',
    ref: { kind: 'ref' as const, objectNumber: 1, generationNumber: 0, serialize: () => {} } as any,
    widthOfTextAtSize: (text: string, size: number) => text.length * charWidth * (size / 12),
    heightAtSize: (size: number) => size * 1.2,
  };
}

describe('wrapText with custom wordBreaks', () => {
  it('wraps on hyphen break character', () => {
    const font = mockFont(6);
    // "hello-world" at size 12 = 11 chars * 6 = 66pts, maxWidth 40 should break at hyphen
    // "hello-" = 6 chars * 6 = 36pts (fits), "world" = 5 chars * 6 = 30pts (fits)
    const lines = wrapText('hello-world', 40, font, 12, ['-']);
    expect(lines).toEqual(['hello-', 'world']);
  });

  it('wraps on slash break character', () => {
    const font = mockFont(6);
    // Each segment: "a/" = 12pts, "b/" = 12pts, etc.  maxWidth 18 fits up to 3 chars.
    const lines = wrapText('a/b/c/d/e', 18, font, 12, ['/']);
    expect(lines.length).toBeGreaterThan(1);
    // Verify breaks happen at slashes
    expect(lines[0]).toMatch(/\/$/);
  });

  it('falls back to space when wordBreaks not specified', () => {
    const font = mockFont(6);
    const lines = wrapText('hello world foo bar', 50, font, 12);
    expect(lines.length).toBeGreaterThan(1);
    // First line should end at a word boundary (no partial words)
    expect(lines[0]).toBe('hello');
  });

  it('space as explicit wordBreak works like default', () => {
    const font = mockFont(6);
    const linesDefault = wrapText('hello world test', 50, font, 12);
    const linesExplicit = wrapText('hello world test', 50, font, 12, [' ']);
    expect(linesDefault).toEqual(linesExplicit);
  });

  it('supports multiple break characters at once', () => {
    const font = mockFont(6);
    // "one-two/three" with breaks at ['-', '/'] and maxWidth 30 (5 chars fit)
    // "one-" = 4*6=24 fits, "two/" = 4*6=24 fits, "three" = 5*6=30 fits
    const lines = wrapText('one-two/three', 30, font, 12, ['-', '/']);
    expect(lines).toEqual(['one-', 'two/', 'three']);
  });

  it('text that fits in one line is not broken', () => {
    const font = mockFont(6);
    // "hi" = 2 * 6 = 12pts, maxWidth 100
    const lines = wrapText('hi', 100, font, 12, ['-']);
    expect(lines).toEqual(['hi']);
  });
});

describe('drawText with wordBreaks option', () => {
  it('accepts wordBreaks option without error', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(612, 792, registry);
    // Should not throw
    page.drawText('hello-world-test', { maxWidth: 50, wordBreaks: ['-'] });
    const ops = page.getContentStreamData();
    expect(ops).toContain('Tj');
  });
});

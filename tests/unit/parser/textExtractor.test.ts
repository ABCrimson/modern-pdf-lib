/**
 * Tests for text extraction from parsed PDF content streams —
 * extractText(), extractTextWithPositions(), and parseToUnicodeCMap().
 *
 * Covers simple text, TJ arrays with kerning, multi-line text, font
 * selection, text matrix transforms, WinAnsi decoding, ToUnicode CMap
 * parsing, and position tracking.
 */

import { describe, it, expect } from 'vitest';
import {
  extractText,
  extractTextWithPositions,
  parseToUnicodeCMap,
} from '../../../src/parser/textExtractor.js';
import type { TextItem } from '../../../src/parser/textExtractor.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import type { ContentStreamOperator } from '../../../src/parser/contentStreamParser.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Parse a content stream string into operators. */
function ops(str: string): ContentStreamOperator[] {
  return parseContentStream(encoder.encode(str));
}

/**
 * Build a resources dict with a simple font entry.
 * The font uses WinAnsiEncoding by default.
 */
function makeResources(
  fontName: string = '/F1',
  options?: {
    encoding?: string;
    subtype?: string;
    toUnicodeCMap?: string;
  },
): PdfDict {
  const resources = new PdfDict();
  const fonts = new PdfDict();
  const font = new PdfDict();

  if (options?.subtype) {
    font.set('/Subtype', PdfName.of(options.subtype));
  } else {
    font.set('/Subtype', PdfName.of('/Type1'));
  }

  if (options?.encoding) {
    font.set('/Encoding', PdfName.of(options.encoding));
  } else {
    font.set('/Encoding', PdfName.of('/WinAnsiEncoding'));
  }

  if (options?.toUnicodeCMap) {
    const cmapData = encoder.encode(options.toUnicodeCMap);
    const cmapStream = PdfStream.fromBytes(cmapData);
    font.set('/ToUnicode', cmapStream);
  }

  fonts.set(fontName, font);
  resources.set('/Font', fonts);
  return resources;
}

// ===========================================================================
// Simple text extraction
// ===========================================================================

describe('extractText() — simple text', () => {
  it('extracts text from Tj operator', () => {
    const operators = ops('BT /F1 12 Tf (Hello World) Tj ET');
    const text = extractText(operators);
    expect(text).toBe('Hello World');
  });

  it('extracts text from multiple Tj operators', () => {
    const operators = ops('BT /F1 12 Tf (Hello) Tj ( World) Tj ET');
    const text = extractText(operators);
    expect(text).toBe('Hello World');
  });

  it('extracts text from hex string Tj', () => {
    const operators = ops('BT /F1 12 Tf <48656C6C6F> Tj ET');
    const text = extractText(operators);
    expect(text).toBe('Hello');
  });

  it('returns empty string for empty content', () => {
    const operators = ops('');
    const text = extractText(operators);
    expect(text).toBe('');
  });

  it('returns empty string for non-text content', () => {
    const operators = ops('q 1 0 0 1 50 50 cm Q');
    const text = extractText(operators);
    expect(text).toBe('');
  });

  it('handles BT/ET without text-showing operators', () => {
    const operators = ops('BT /F1 12 Tf ET');
    const text = extractText(operators);
    expect(text).toBe('');
  });
});

// ===========================================================================
// TJ array (strings + kerning adjustments)
// ===========================================================================

describe('extractText() — TJ array', () => {
  it('concatenates strings from TJ array', () => {
    const operators = ops('BT /F1 12 Tf [(Hello) (World)] TJ ET');
    const text = extractText(operators);
    expect(text).toContain('Hello');
    expect(text).toContain('World');
  });

  it('handles small kerning adjustments (no space inserted)', () => {
    const operators = ops('BT /F1 12 Tf [(H) -10 (ello)] TJ ET');
    const text = extractText(operators);
    // Small kerning should not insert a space
    expect(text).toContain('Hello');
    expect(text).not.toContain('H ello');
  });

  it('inserts space for large negative displacement', () => {
    const operators = ops('BT /F1 12 Tf [(Hello) -200 (World)] TJ ET');
    const text = extractText(operators);
    // Large negative displacement (>= 100) should insert a space
    expect(text).toContain('Hello World');
  });

  it('does not insert space for positive displacement', () => {
    const operators = ops('BT /F1 12 Tf [(Hello) 50 (World)] TJ ET');
    const text = extractText(operators);
    expect(text).toContain('HelloWorld');
  });

  it('handles empty TJ array', () => {
    const operators = ops('BT /F1 12 Tf [] TJ ET');
    const text = extractText(operators);
    expect(text).toBe('');
  });

  it('handles TJ array with only numbers', () => {
    const operators = ops('BT /F1 12 Tf [-100 50 -200] TJ ET');
    const text = extractText(operators);
    // Only kerning adjustments, no strings
    // A large negative might trigger space insertion in decodeTJArray
    expect(text).toBeTruthy; // Should not crash
  });
});

// ===========================================================================
// Multiple text lines (Td positioning)
// ===========================================================================

describe('extractText() — multiple text lines', () => {
  it('inserts newline for vertical Td movement', () => {
    const operators = ops(
      'BT /F1 12 Tf 72 700 Td (Line 1) Tj 0 -14 Td (Line 2) Tj ET',
    );
    const text = extractText(operators);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
    expect(text).toContain('\n');
  });

  it('inserts newline for T* operator', () => {
    const operators = ops(
      'BT /F1 12 Tf 14 TL 72 700 Td (Line 1) Tj T* (Line 2) Tj ET',
    );
    const text = extractText(operators);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
    expect(text).toContain('\n');
  });

  it('inserts newline for TD operator', () => {
    const operators = ops(
      'BT /F1 12 Tf 72 700 Td (Line 1) Tj 0 -14 TD (Line 2) Tj ET',
    );
    const text = extractText(operators);
    expect(text).toContain('Line 1');
    expect(text).toContain('\n');
    expect(text).toContain('Line 2');
  });

  it('separates BT/ET blocks with space', () => {
    const operators = ops(
      'BT /F1 12 Tf 72 700 Td (Block 1) Tj ET BT /F1 12 Tf 72 680 Td (Block 2) Tj ET',
    );
    const text = extractText(operators);
    expect(text).toContain('Block 1');
    expect(text).toContain('Block 2');
  });

  it("handles ' (quote) operator — next line + show string", () => {
    const operators = ops("BT /F1 12 Tf 14 TL 72 700 Td (Line 1) Tj (Line 2) ' ET");
    const text = extractText(operators);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
  });

  it('handles " (double quote) operator', () => {
    const operators = ops(
      'BT /F1 12 Tf 14 TL 72 700 Td (Line 1) Tj 0 0 (Line 2) " ET',
    );
    const text = extractText(operators);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
  });
});

// ===========================================================================
// WinAnsi encoding
// ===========================================================================

describe('extractText() — WinAnsi encoding', () => {
  it('decodes standard ASCII characters unchanged', () => {
    const operators = ops('BT /F1 12 Tf (Hello) Tj ET');
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    expect(text).toBe('Hello');
  });

  it('decodes WinAnsi special characters', () => {
    // 0x93 (left double quote), 0x94 (right double quote)
    // Build a literal string with these byte values
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(0x93) + 'Hello' + String.fromCharCode(0x94)] },
      { operator: 'ET', operands: [] },
    ];
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    // 0x93 -> U+201C (left double quotation mark)
    // 0x94 -> U+201D (right double quotation mark)
    expect(text).toContain('\u201c');
    expect(text).toContain('Hello');
    expect(text).toContain('\u201d');
  });

  it('decodes Euro sign (0x80 -> U+20AC)', () => {
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(0x80) + '100'] },
      { operator: 'ET', operands: [] },
    ];
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    expect(text).toContain('\u20ac'); // Euro sign
    expect(text).toContain('100');
  });

  it('decodes bullet (0x95 -> U+2022)', () => {
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(0x95) + ' item'] },
      { operator: 'ET', operands: [] },
    ];
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    expect(text).toContain('\u2022');
    expect(text).toContain('item');
  });

  it('decodes em dash (0x97 -> U+2014)', () => {
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: ['word' + String.fromCharCode(0x97) + 'word'] },
      { operator: 'ET', operands: [] },
    ];
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    expect(text).toContain('word\u2014word');
  });

  it('passes through Latin-1 characters (0xA0-0xFF) directly', () => {
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(0xe9)] }, // e-acute
      { operator: 'ET', operands: [] },
    ];
    const resources = makeResources('/F1');
    const text = extractText(operators, resources);
    expect(text).toBe('\u00e9'); // e-acute
  });
});

// ===========================================================================
// ToUnicode CMap parsing
// ===========================================================================

describe('parseToUnicodeCMap()', () => {
  it('parses bfchar mappings', () => {
    const cmapData = encoder.encode(`
      /CIDInit /ProcSet findresource begin
      12 dict begin
      begincmap
      /CIDSystemInfo << /Registry (Test) /Ordering (UCS) /Supplement 0 >> def
      /CMapName /Test def
      1 beginbfchar
      <0041> <0048>
      endbfchar
      endcmap
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.get(0x41)).toBe('H');
  });

  it('parses multiple bfchar entries', () => {
    const cmapData = encoder.encode(`
      3 beginbfchar
      <01> <0041>
      <02> <0042>
      <03> <0043>
      endbfchar
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.get(1)).toBe('A');
    expect(cmap.map.get(2)).toBe('B');
    expect(cmap.map.get(3)).toBe('C');
  });

  it('parses bfrange sequential mappings', () => {
    const cmapData = encoder.encode(`
      1 beginbfrange
      <0041> <0043> <0061>
      endbfrange
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    // 0x41 -> 0x61 ('a'), 0x42 -> 0x62 ('b'), 0x43 -> 0x63 ('c')
    expect(cmap.map.get(0x41)).toBe('a');
    expect(cmap.map.get(0x42)).toBe('b');
    expect(cmap.map.get(0x43)).toBe('c');
  });

  it('parses bfrange array mappings', () => {
    const cmapData = encoder.encode(`
      1 beginbfrange
      <0001> <0003> [<0041> <0042> <0043>]
      endbfrange
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.get(1)).toBe('A');
    expect(cmap.map.get(2)).toBe('B');
    expect(cmap.map.get(3)).toBe('C');
  });

  it('handles 2-byte source codes', () => {
    const cmapData = encoder.encode(`
      1 beginbfchar
      <0100> <4E16>
      endbfchar
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    // 0x100 -> U+4E16 (Chinese character for "world")
    expect(cmap.map.get(0x100)).toBe('\u4e16');
  });

  it('handles multiple bfchar sections', () => {
    const cmapData = encoder.encode(`
      1 beginbfchar
      <01> <0041>
      endbfchar
      1 beginbfchar
      <02> <0042>
      endbfchar
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.get(1)).toBe('A');
    expect(cmap.map.get(2)).toBe('B');
  });

  it('handles mixed bfchar and bfrange sections', () => {
    const cmapData = encoder.encode(`
      1 beginbfchar
      <01> <0058>
      endbfchar
      1 beginbfrange
      <10> <12> <0041>
      endbfrange
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.get(1)).toBe('X');
    expect(cmap.map.get(0x10)).toBe('A');
    expect(cmap.map.get(0x11)).toBe('B');
    expect(cmap.map.get(0x12)).toBe('C');
  });

  it('returns empty map for empty CMap', () => {
    const cmapData = encoder.encode(`
      begincmap
      endcmap
    `);
    const cmap = parseToUnicodeCMap(cmapData);
    expect(cmap.map.size).toBe(0);
  });
});

// ===========================================================================
// Text extraction with ToUnicode CMap
// ===========================================================================

describe('extractText() — with ToUnicode CMap', () => {
  it('uses bfchar mapping to decode text', () => {
    const cmapText = `
      2 beginbfchar
      <01> <0048>
      <02> <0069>
      endbfchar
    `;
    const resources = makeResources('/F1', { toUnicodeCMap: cmapText });
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(1) + String.fromCharCode(2)] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toBe('Hi');
  });

  it('falls back to WinAnsi for unmapped characters', () => {
    const cmapText = `
      1 beginbfchar
      <01> <0048>
      endbfchar
    `;
    const resources = makeResources('/F1', { toUnicodeCMap: cmapText });
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      // Character 0x01 is mapped (H), character 0x65 ('e') is not mapped -> WinAnsi fallback
      { operator: 'Tj', operands: [String.fromCharCode(1) + String.fromCharCode(0x65)] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toBe('He');
  });
});

// ===========================================================================
// CID font with ToUnicode CMap
// ===========================================================================

describe('extractText() — CID font with ToUnicode', () => {
  it('decodes 2-byte CID font text with ToUnicode CMap', () => {
    const cmapText = `
      1 beginbfchar
      <0048> <0048>
      endbfchar
      1 beginbfrange
      <0065> <006F> <0065>
      endbfrange
    `;
    const resources = makeResources('/F1', {
      subtype: '/Type0',
      toUnicodeCMap: cmapText,
    });
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      // CID font: 2 bytes per char => 0x0048 = 'H', 0x0069 = 'i'
      {
        operator: 'Tj',
        operands: [
          String.fromCharCode(0x00) + String.fromCharCode(0x48) +
          String.fromCharCode(0x00) + String.fromCharCode(0x69),
        ],
      },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toContain('H');
    expect(text).toContain('i');
  });
});

// ===========================================================================
// extractTextWithPositions()
// ===========================================================================

describe('extractTextWithPositions()', () => {
  it('returns positioned text items', () => {
    const operators = ops('BT /F1 12 Tf 100 700 Td (Hello) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Hello');
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(700);
  });

  it('tracks font size from Tf', () => {
    const operators = ops('BT /F1 24 Tf 50 600 Td (Big) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.fontSize).toBe(24);
  });

  it('tracks font name from Tf', () => {
    const operators = ops('BT /Helvetica 12 Tf 50 600 Td (Text) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.fontName).toBe('/Helvetica');
  });

  it('reports width > 0 for non-empty text', () => {
    const operators = ops('BT /F1 12 Tf 50 600 Td (Hello) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.width).toBeGreaterThan(0);
  });

  it('reports height equal to fontSize', () => {
    const operators = ops('BT /F1 14 Tf 50 600 Td (Test) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.height).toBe(14);
  });

  it('returns empty array for content with no text', () => {
    const operators = ops('q 1 0 0 1 50 50 cm Q');
    const items = extractTextWithPositions(operators);
    expect(items).toEqual([]);
  });

  it('returns empty array for empty operators', () => {
    const items = extractTextWithPositions([]);
    expect(items).toEqual([]);
  });
});

// ===========================================================================
// Text position tracking with Td
// ===========================================================================

describe('extractTextWithPositions() — Td positioning', () => {
  it('updates position with Td', () => {
    const operators = ops(
      'BT /F1 12 Tf 100 700 Td (Line 1) Tj 0 -14 Td (Line 2) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(2);
    expect(items[0]!.y).toBeCloseTo(700);
    expect(items[1]!.y).toBeCloseTo(686); // 700 - 14
  });

  it('accumulates Td translations', () => {
    const operators = ops(
      'BT /F1 12 Tf 10 20 Td 30 40 Td (Text) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    // First Td: textLineMatrix = identity * translate(10,20) => e=10,f=20
    // Second Td: textLineMatrix = translate(30,40) * prev => e=40, f=60
    expect(items[0]!.x).toBeCloseTo(40);
    expect(items[0]!.y).toBeCloseTo(60);
  });
});

// ===========================================================================
// Text matrix (Tm) transforms
// ===========================================================================

describe('extractTextWithPositions() — Tm transforms', () => {
  it('sets absolute position with Tm', () => {
    const operators = ops('BT 1 0 0 1 200 500 Tm /F1 12 Tf (Hello) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.x).toBeCloseTo(200);
    expect(items[0]!.y).toBeCloseTo(500);
  });

  it('Tm overrides previous Td positioning', () => {
    const operators = ops(
      'BT /F1 12 Tf 100 700 Td 1 0 0 1 200 500 Tm (Hello) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    // Tm sets absolute position, overriding Td
    expect(items[0]!.x).toBeCloseTo(200);
    expect(items[0]!.y).toBeCloseTo(500);
  });

  it('handles scaled text matrix', () => {
    // Matrix: [2, 0, 0, 2, 100, 300] — 2x scale with translation
    const operators = ops('BT 2 0 0 2 100 300 Tm /F1 12 Tf (Hi) Tj ET');
    const items = extractTextWithPositions(operators);
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(300);
  });
});

// ===========================================================================
// TJ with position tracking
// ===========================================================================

describe('extractTextWithPositions() — TJ array', () => {
  it('creates separate items for each string in TJ array', () => {
    const operators = ops('BT /F1 12 Tf 50 600 Td [(Hello) -200 (World)] TJ ET');
    const items = extractTextWithPositions(operators);
    // Should produce two text items: "Hello" and "World"
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.text).toBe('Hello');
    expect(items[1]!.text).toBe('World');
  });

  it('applies displacement between TJ items', () => {
    const operators = ops(
      'BT /F1 12 Tf 50 600 Td [(A) -1000 (B)] TJ ET',
    );
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(2);
    // The x position of 'B' should be different from 'A' due to width of 'A' + displacement
    expect(items[1]!.x).not.toBeCloseTo(items[0]!.x);
  });
});

// ===========================================================================
// Graphics state save/restore with text
// ===========================================================================

describe('extractTextWithPositions() — q/Q state management', () => {
  it('save/restore preserves font state', () => {
    const operators = ops(
      'BT /F1 12 Tf q /F2 24 Tf Q 50 600 Td (Hello) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    // After Q, font should be restored to F1/12
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.fontSize).toBe(12);
  });

  it('nested q/Q restores correctly', () => {
    const operators = ops(
      'BT /F1 10 Tf q /F2 20 Tf q /F3 30 Tf Q Q 50 600 Td (Hello) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    // After both Q's, font should be F1/10
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.fontSize).toBe(10);
  });
});

// ===========================================================================
// CTM (cm) interaction with text position
// ===========================================================================

describe('extractTextWithPositions() — cm operator', () => {
  it('cm translation affects text position', () => {
    const operators = ops(
      'q 1 0 0 1 100 200 cm BT /F1 12 Tf 0 0 Td (Text) Tj ET Q',
    );
    const items = extractTextWithPositions(operators);
    // CTM translates by (100, 200), text at (0,0) in text space
    // Position = textMatrix * CTM => (0,0) * CTM => (100, 200)
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(200);
  });

  it('cm + Td combine correctly', () => {
    const operators = ops(
      'q 1 0 0 1 50 100 cm BT /F1 12 Tf 10 20 Td (Text) Tj ET Q',
    );
    const items = extractTextWithPositions(operators);
    // Text position: Td(10,20) => textMatrix=(1,0,0,1,10,20)
    // Combined: textMatrix * CTM = position at (10+50, 20+100) = (60, 120)
    expect(items[0]!.x).toBeCloseTo(60);
    expect(items[0]!.y).toBeCloseTo(120);
  });
});

// ===========================================================================
// extractText() with withPositions option
// ===========================================================================

describe('extractText() — withPositions option', () => {
  it('returns space-separated text when withPositions=true', () => {
    const operators = ops(
      'BT /F1 12 Tf 100 700 Td (Hello) Tj 0 -14 Td (World) Tj ET',
    );
    const text = extractText(operators, undefined, { withPositions: true });
    expect(text).toContain('Hello');
    expect(text).toContain('World');
  });
});

// ===========================================================================
// BT resets text matrix
// ===========================================================================

describe('extractTextWithPositions() — BT resets text matrix', () => {
  it('resets text matrix at each BT', () => {
    const operators = ops(
      'BT /F1 12 Tf 100 700 Td (First) Tj ET BT /F1 12 Tf 200 500 Td (Second) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(2);
    // Second BT resets, so Td(200,500) applies from identity
    expect(items[1]!.x).toBeCloseTo(200);
    expect(items[1]!.y).toBeCloseTo(500);
  });
});

// ===========================================================================
// T* and TL (leading)
// ===========================================================================

describe('extractTextWithPositions() — T* and TL', () => {
  it('T* moves down by leading amount', () => {
    const operators = ops(
      'BT /F1 12 Tf 14 TL 50 700 Td (Line 1) Tj T* (Line 2) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(2);
    // T* is equivalent to 0 -TL Td => y decreases by 14
    expect(items[0]!.y).toBeCloseTo(700);
    expect(items[1]!.y).toBeCloseTo(686);
  });
});

// ===========================================================================
// TD sets leading
// ===========================================================================

describe('extractTextWithPositions() — TD', () => {
  it('TD sets leading to -ty and moves text', () => {
    const operators = ops(
      'BT /F1 12 Tf 50 700 Td (Line 1) Tj 0 -16 TD (Line 2) Tj T* (Line 3) Tj ET',
    );
    const items = extractTextWithPositions(operators);
    expect(items).toHaveLength(3);
    expect(items[0]!.y).toBeCloseTo(700);
    expect(items[1]!.y).toBeCloseTo(684); // 700 - 16
    // TD sets leading to -(-16) = 16, so T* moves down by 16
    expect(items[2]!.y).toBeCloseTo(668); // 684 - 16
  });
});

// ===========================================================================
// Font name normalization
// ===========================================================================

describe('extractTextWithPositions() — font name normalization', () => {
  it('adds leading slash if font name lacks one', () => {
    // Tf operand could be a string "F1" without slash
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['F1', 12] },
      { operator: 'Td', operands: [50, 600] },
      { operator: 'Tj', operands: ['Hello'] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators);
    expect(items[0]!.fontName).toBe('/F1');
  });

  it('preserves leading slash in font name', () => {
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [50, 600] },
      { operator: 'Tj', operands: ['Hello'] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators);
    expect(items[0]!.fontName).toBe('/F1');
  });
});

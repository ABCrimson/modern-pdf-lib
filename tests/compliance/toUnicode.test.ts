/**
 * Tests for ToUnicode CMap generation for standard 14 fonts.
 *
 * Covers:
 * - WinAnsi CMap structure and correctness
 * - Symbol CMap structure
 * - ZapfDingbats CMap structure
 * - CMap chunking (max 100 entries per bfchar block)
 * - Routing via getToUnicodeCmap for all standard 14 fonts
 * - Specific character mappings (ASCII, Euro, em dash, etc.)
 * - Undefined code exclusion
 */

import { describe, it, expect } from 'vitest';
import {
  generateWinAnsiToUnicodeCmap,
  generateSymbolToUnicodeCmap,
  generateZapfDingbatsToUnicodeCmap,
  getToUnicodeCmap,
} from '../../src/compliance/toUnicodeCmap.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all bfchar blocks from a CMap and return the total entry count. */
function countBfcharEntries(cmap: string): number {
  const blocks = cmap.match(/(\d+) beginbfchar/g);
  if (!blocks) return 0;
  return blocks.reduce((sum, b) => sum + parseInt(b, 10), 0);
}

/** Extract the max block size from bfchar blocks. */
function maxBfcharBlockSize(cmap: string): number {
  const blocks = cmap.match(/(\d+) beginbfchar/g);
  if (!blocks) return 0;
  return Math.max(...blocks.map((b) => parseInt(b, 10)));
}

// ---------------------------------------------------------------------------
// WinAnsi CMap
// ---------------------------------------------------------------------------

describe('generateWinAnsiToUnicodeCmap', () => {
  const cmap = generateWinAnsiToUnicodeCmap();

  it('returns a valid CMap string', () => {
    expect(typeof cmap).toBe('string');
    expect(cmap.length).toBeGreaterThan(100);
    expect(cmap).toContain('begincmap');
    expect(cmap).toContain('endcmap');
  });

  it('contains begincodespacerange/endcodespacerange', () => {
    expect(cmap).toContain('1 begincodespacerange');
    expect(cmap).toContain('<00> <FF>');
    expect(cmap).toContain('endcodespacerange');
  });

  it('contains beginbfchar/endbfchar', () => {
    expect(cmap).toContain('beginbfchar');
    expect(cmap).toContain('endbfchar');
  });

  it('maps ASCII space (0x20) to Unicode 0x0020', () => {
    expect(cmap).toContain('<20> <0020>');
  });

  it('maps Euro sign (0x80) to Unicode 0x20AC', () => {
    expect(cmap).toContain('<80> <20AC>');
  });

  it('maps em dash (0x97) to Unicode 0x2014', () => {
    expect(cmap).toContain('<97> <2014>');
  });

  it('does not include undefined codes (129, 141, 143, 144, 157)', () => {
    expect(cmap).not.toContain('<81> ');
    expect(cmap).not.toContain('<8D> ');
    expect(cmap).not.toContain('<8F> ');
    expect(cmap).not.toContain('<90> ');
    expect(cmap).not.toContain('<9D> ');
  });

  it('chunks entries in blocks of 100 or fewer', () => {
    const maxBlock = maxBfcharBlockSize(cmap);
    expect(maxBlock).toBeLessThanOrEqual(100);
    expect(maxBlock).toBeGreaterThan(0);
  });

  it('maps standard ASCII printable characters to themselves', () => {
    // 'A' = 0x41 → U+0041
    expect(cmap).toContain('<41> <0041>');
    // '~' = 0x7E → U+007E
    expect(cmap).toContain('<7E> <007E>');
    // '0' = 0x30 → U+0030
    expect(cmap).toContain('<30> <0030>');
  });

  it('maps special Windows-1252 characters correctly', () => {
    // Left single quotation mark: 0x91 → U+2018
    expect(cmap).toContain('<91> <2018>');
    // Right double quotation mark: 0x94 → U+201D
    expect(cmap).toContain('<94> <201D>');
    // Bullet: 0x95 → U+2022
    expect(cmap).toContain('<95> <2022>');
    // Trademark: 0x99 → U+2122
    expect(cmap).toContain('<99> <2122>');
  });

  it('includes CIDSystemInfo dictionary', () => {
    expect(cmap).toContain('/CIDSystemInfo');
    expect(cmap).toContain('/Registry (Adobe)');
    expect(cmap).toContain('/Ordering (UCS)');
  });

  it('has the correct number of mapped entries (219)', () => {
    // 32..255 = 224 codes, minus 5 undefined = 219
    const count = countBfcharEntries(cmap);
    expect(count).toBe(219);
  });
});

// ---------------------------------------------------------------------------
// Symbol CMap
// ---------------------------------------------------------------------------

describe('generateSymbolToUnicodeCmap', () => {
  const cmap = generateSymbolToUnicodeCmap();

  it('returns a valid CMap string', () => {
    expect(typeof cmap).toBe('string');
    expect(cmap).toContain('begincmap');
    expect(cmap).toContain('endcmap');
    expect(cmap).toContain('beginbfchar');
    expect(cmap).toContain('endbfchar');
  });

  it('maps Greek alpha (0x61) to Unicode U+03B1', () => {
    expect(cmap).toContain('<61> <03B1>');
  });

  it('maps pi (0x70) to Unicode U+03C0', () => {
    expect(cmap).toContain('<70> <03C0>');
  });

  it('maps infinity (0xA5) to Unicode U+221E', () => {
    expect(cmap).toContain('<A5> <221E>');
  });

  it('chunks entries in blocks of 100 or fewer', () => {
    expect(maxBfcharBlockSize(cmap)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// ZapfDingbats CMap
// ---------------------------------------------------------------------------

describe('generateZapfDingbatsToUnicodeCmap', () => {
  const cmap = generateZapfDingbatsToUnicodeCmap();

  it('returns a valid CMap string', () => {
    expect(typeof cmap).toBe('string');
    expect(cmap).toContain('begincmap');
    expect(cmap).toContain('endcmap');
    expect(cmap).toContain('beginbfchar');
    expect(cmap).toContain('endbfchar');
  });

  it('maps check mark (0x33) to Unicode U+2713', () => {
    expect(cmap).toContain('<33> <2713>');
  });

  it('maps black star (0x48) to Unicode U+2605', () => {
    expect(cmap).toContain('<48> <2605>');
  });

  it('maps black heart (0xA4) to Unicode U+2764', () => {
    expect(cmap).toContain('<A4> <2764>');
  });

  it('chunks entries in blocks of 100 or fewer', () => {
    expect(maxBfcharBlockSize(cmap)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// getToUnicodeCmap routing
// ---------------------------------------------------------------------------

describe('getToUnicodeCmap', () => {
  it('returns Symbol CMap for "Symbol"', () => {
    const cmap = getToUnicodeCmap('Symbol');
    // Symbol CMap should contain Greek alpha mapping
    expect(cmap).toContain('<61> <03B1>');
    // And should NOT contain WinAnsi-specific Euro at 0x80 → 20AC
    // (Symbol has 0xA0 → 20AC instead)
    expect(cmap).toContain('<A0> <20AC>');
  });

  it('returns ZapfDingbats CMap for "ZapfDingbats"', () => {
    const cmap = getToUnicodeCmap('ZapfDingbats');
    expect(cmap).toContain('<33> <2713>'); // check mark
  });

  it('returns WinAnsi CMap for "Helvetica"', () => {
    const cmap = getToUnicodeCmap('Helvetica');
    expect(cmap).toContain('<80> <20AC>'); // Euro sign
    expect(cmap).toContain('<41> <0041>'); // 'A'
  });

  it('returns WinAnsi CMap for all 12 Latin standard fonts', () => {
    const latinFonts = [
      'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
      'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
      'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    ];

    const winAnsiCmap = generateWinAnsiToUnicodeCmap();

    for (const fontName of latinFonts) {
      const cmap = getToUnicodeCmap(fontName);
      expect(cmap).toBe(winAnsiCmap);
    }
  });

  it('works with all 14 standard font names', () => {
    const allFonts = [
      'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
      'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
      'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
      'Symbol', 'ZapfDingbats',
    ];

    for (const fontName of allFonts) {
      const cmap = getToUnicodeCmap(fontName);
      expect(typeof cmap).toBe('string');
      expect(cmap).toContain('begincmap');
      expect(cmap).toContain('endcmap');
      expect(cmap).toContain('beginbfchar');
    }
  });
});

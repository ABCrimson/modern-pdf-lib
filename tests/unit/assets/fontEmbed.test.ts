/**
 * Tests for font embedding — standard font metrics and text measurement.
 *
 * Covers standard font width lookups, height calculation, text measurement,
 * and monospace verification.
 */

import { describe, it, expect } from 'vitest';
import {
  getStandardFont,
  isStandardFont,
  measureStandardText,
  standardFontHeight,
  STANDARD_FONTS,
  STANDARD_FONT_NAMES,
} from '../../../src/assets/font/standardFonts.js';
import type { StandardFontName } from '../../../src/assets/font/standardFonts.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Standard font metrics', () => {
  // -------------------------------------------------------------------------
  // widthOfTextAtSize (via measureStandardText)
  // -------------------------------------------------------------------------

  it('standard font widthOfTextAtSize returns positive number', () => {
    const width = measureStandardText('Hello, World!', 'Helvetica', 12);
    expect(width).toBeGreaterThan(0);
    expect(typeof width).toBe('number');
    expect(Number.isFinite(width)).toBe(true);
  });

  it('all 14 standard fonts return positive width for ASCII text', () => {
    for (const name of STANDARD_FONT_NAMES) {
      const width = measureStandardText('Test', name, 12);
      expect(width).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // heightAtSize (via standardFontHeight)
  // -------------------------------------------------------------------------

  it('standard font heightAtSize returns positive number', () => {
    const height = standardFontHeight('Helvetica', 12);
    expect(height).toBeGreaterThan(0);
    expect(typeof height).toBe('number');
  });

  it('height scales with font size', () => {
    const h12 = standardFontHeight('Helvetica', 12);
    const h24 = standardFontHeight('Helvetica', 24);
    expect(h24).toBeCloseTo(h12 * 2, 5);
  });

  // -------------------------------------------------------------------------
  // Helvetica widths match known values
  // -------------------------------------------------------------------------

  it('Helvetica widths match known values', () => {
    const font = getStandardFont('Helvetica');
    expect(font).toBeDefined();

    // Known Helvetica widths from the AFM (in 1/1000 units):
    // Space (0x20) = 278
    // 'A' (0x41) = 667
    // 'H' (0x48) = 722
    // 'e' (0x65) = 556
    // 'l' (0x6C) = 222
    // 'o' (0x6F) = 556
    expect(font!.widths[0x20]).toBe(278); // space
    expect(font!.widths[0x41]).toBe(667); // A
    expect(font!.widths[0x48]).toBe(722); // H
    expect(font!.widths[0x65]).toBe(556); // e
    expect(font!.widths[0x6C]).toBe(222); // l
    expect(font!.widths[0x6F]).toBe(556); // o
  });

  it('Helvetica "Hello" width at 12pt matches expected value', () => {
    // H=722, e=556, l=222, l=222, o=556 = 2278 in 1000-units
    // At 12pt: 2278 * 12/1000 = 27.336
    const width = measureStandardText('Hello', 'Helvetica', 12);
    expect(width).toBeCloseTo(27.336, 1);
  });

  // -------------------------------------------------------------------------
  // Courier widths are all equal (monospace)
  // -------------------------------------------------------------------------

  it('Courier widths are all equal (monospace)', () => {
    const font = getStandardFont('Courier');
    expect(font).toBeDefined();

    // All printable characters (0x20-0x7E) should have width 600
    for (let code = 0x20; code <= 0x7e; code++) {
      expect(font!.widths[code]).toBe(600);
    }
  });

  it('Courier-Bold is also monospace at 600', () => {
    const font = getStandardFont('Courier-Bold');
    expect(font).toBeDefined();

    for (let code = 0x20; code <= 0x7e; code++) {
      expect(font!.widths[code]).toBe(600);
    }
  });

  it('Courier text width is proportional to string length', () => {
    const width5 = measureStandardText('Hello', 'Courier', 12);
    const width10 = measureStandardText('HelloHello', 'Courier', 12);
    expect(width10).toBeCloseTo(width5 * 2, 5);
  });

  // -------------------------------------------------------------------------
  // Empty string
  // -------------------------------------------------------------------------

  it('empty string has zero width', () => {
    const width = measureStandardText('', 'Helvetica', 12);
    expect(width).toBe(0);
  });

  it('empty string has zero width for all standard fonts', () => {
    for (const name of STANDARD_FONT_NAMES) {
      expect(measureStandardText('', name, 12)).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // Linear scaling
  // -------------------------------------------------------------------------

  it('text measurement scales linearly with font size', () => {
    const text = 'Scaling test';

    const w12 = measureStandardText(text, 'Helvetica', 12);
    const w24 = measureStandardText(text, 'Helvetica', 24);
    const w6 = measureStandardText(text, 'Helvetica', 6);

    expect(w24).toBeCloseTo(w12 * 2, 5);
    expect(w6).toBeCloseTo(w12 / 2, 5);
  });

  it('height scales linearly with font size', () => {
    const h10 = standardFontHeight('Times-Roman', 10);
    const h20 = standardFontHeight('Times-Roman', 20);
    const h30 = standardFontHeight('Times-Roman', 30);

    expect(h20).toBeCloseTo(h10 * 2, 5);
    expect(h30).toBeCloseTo(h10 * 3, 5);
  });

  // -------------------------------------------------------------------------
  // Font lookup
  // -------------------------------------------------------------------------

  it('getStandardFont returns font data for all 14 fonts', () => {
    for (const name of STANDARD_FONT_NAMES) {
      const font = getStandardFont(name);
      expect(font).toBeDefined();
      expect(font!.name).toBe(name);
      expect(font!.widths).toHaveLength(256);
      expect(font!.ascender).toBeGreaterThan(0);
      expect(font!.descender).toBeLessThan(0);
    }
  });

  it('getStandardFont returns undefined for unknown fonts', () => {
    expect(getStandardFont('UnknownFont')).toBeUndefined();
  });

  it('isStandardFont identifies standard fonts', () => {
    expect(isStandardFont('Helvetica')).toBe(true);
    expect(isStandardFont('Courier')).toBe(true);
    expect(isStandardFont('Times-Roman')).toBe(true);
    expect(isStandardFont('NotAFont')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Font metrics integrity
  // -------------------------------------------------------------------------

  it('Helvetica has reasonable ascender and descender', () => {
    const font = getStandardFont('Helvetica')!;
    expect(font.ascender).toBe(718);
    expect(font.descender).toBe(-207);
    expect(font.capHeight).toBe(718);
  });

  it('Times-Roman has reasonable metrics', () => {
    const font = getStandardFont('Times-Roman')!;
    expect(font.ascender).toBe(683);
    expect(font.descender).toBe(-217);
  });

  // -------------------------------------------------------------------------
  // TrueType font embedding (EmbeddedFont class)
  // -------------------------------------------------------------------------

  it('EmbeddedFont can be constructed and tracks glyph usage', async () => {
    // We need the EmbeddedFont class and supporting functions
    const { EmbeddedFont } = await import('../../../src/assets/font/fontEmbed.js');
    const { extractMetrics } = await import('../../../src/assets/font/fontMetrics.js');

    // Build a minimal valid TTF binary that extractMetrics can parse.
    // We need: table directory + head, hhea, hmtx, maxp tables (minimum).
    const ttf = buildMinimalTtf();
    const metrics = extractMetrics(ttf);

    const font = new EmbeddedFont(ttf, metrics);

    // .notdef (glyph 0) is always included
    expect(font.getUsedGlyphs().has(0)).toBe(true);

    // Metrics should be accessible
    expect(font.metrics.unitsPerEm).toBeGreaterThan(0);
    expect(font.metrics.ascender).toBeGreaterThan(0);

    // Mark a glyph as used
    font.markGlyphUsed(42);
    expect(font.getUsedGlyphs().has(42)).toBe(true);

    // Height calculation
    const height = font.heightAtSize(12);
    expect(height).toBeGreaterThan(0);
    expect(typeof height).toBe('number');
  });

  it('font subsetting (fallback) returns a SubsetResult with correct structure', async () => {
    const { subsetFont } = await import('../../../src/assets/font/fontSubset.js');

    // Use a dummy font data (the fallback subsetter returns the whole font)
    const dummyFont = new Uint8Array(256);
    for (let i = 0; i < 256; i++) dummyFont[i] = i;

    const usedGlyphs = new Set([0, 5, 10, 20]);
    const result = subsetFont(dummyFont, usedGlyphs);

    // SubsetResult structure checks
    expect(result).toBeDefined();
    expect(result.fontData).toBeInstanceOf(Uint8Array);
    // Fallback returns full font copy, so same length
    expect(result.fontData.length).toBe(dummyFont.length);
    // fontData should be a copy, not the same reference
    expect(result.fontData).not.toBe(dummyFont);

    // newToOldGid should contain all used glyphs (sorted)
    expect(result.newToOldGid).toBeDefined();
    expect(Array.isArray(result.newToOldGid)).toBe(true);
    expect([...result.newToOldGid]).toEqual([0, 5, 10, 20]);

    // oldToNewGid maps original to new (identity in fallback mode)
    expect(result.oldToNewGid.get(0)).toBe(0);
    expect(result.oldToNewGid.get(5)).toBe(5);
    expect(result.oldToNewGid.get(10)).toBe(10);
    expect(result.oldToNewGid.get(20)).toBe(20);
  });

  it('ToUnicode CMap contains beginbfchar/endbfchar sections', async () => {
    const { subsetFont, buildSubsetCmap } = await import('../../../src/assets/font/fontSubset.js');

    const dummyFont = new Uint8Array(256);
    const usedGlyphs = new Set([0, 65, 66, 67]); // .notdef, then glyphs for A, B, C
    const subsetResult = subsetFont(dummyFont, usedGlyphs);

    // Build a cmap table that maps codepoints to glyph IDs
    // codepoint 0x0041 ('A') -> glyph 65, 0x0042 ('B') -> glyph 66, 0x0043 ('C') -> glyph 67
    const originalCmap = new Map<number, number>([
      [0x0041, 65],
      [0x0042, 66],
      [0x0043, 67],
    ]);

    const cmapResult = buildSubsetCmap(subsetResult, originalCmap);

    // Verify the CMap stream contains required sections
    expect(cmapResult.cmapStream).toContain('beginbfchar');
    expect(cmapResult.cmapStream).toContain('endbfchar');
    expect(cmapResult.cmapStream).toContain('begincmap');
    expect(cmapResult.cmapStream).toContain('endcmap');
    expect(cmapResult.cmapStream).toContain('begincodespacerange');
    expect(cmapResult.cmapStream).toContain('endcodespacerange');
    expect(cmapResult.cmapStream).toContain('<0000> <FFFF>');

    // The CMap should contain hex mappings for our codepoints
    // Glyph 65 maps to Unicode 0x0041
    expect(cmapResult.cmapStream).toContain('0041');

    // cidToUnicode should have entries
    expect(cmapResult.cidToUnicode.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helper: build a minimal valid TTF binary
// ---------------------------------------------------------------------------

/**
 * Construct a minimal valid TrueType font binary with the tables
 * needed by extractMetrics: head, hhea, hmtx, maxp.
 */
function buildMinimalTtf(): Uint8Array {
  // We need: offset table (12 bytes) + 4 table records (16 bytes each)
  // + head (54 bytes) + hhea (36 bytes) + maxp (6 bytes) + hmtx (8 bytes)
  const numTables = 4;
  const headerSize = 12;
  const recordSize = 16;
  const tableRecordsSize = numTables * recordSize;
  const tablesStart = headerSize + tableRecordsSize; // 12 + 64 = 76

  // Table sizes
  const headSize = 54;
  const hheaSize = 36;
  const maxpSize = 6;
  const hmtxSize = 8; // 2 glyphs x 4 bytes (advanceWidth + lsb)

  const totalSize = tablesStart + headSize + hheaSize + maxpSize + hmtxSize;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Offset table (TrueType signature)
  view.setUint32(0, 0x00010000, false); // sfVersion = 1.0
  view.setUint16(4, numTables, false);
  view.setUint16(6, 64, false); // searchRange
  view.setUint16(8, 2, false);  // entrySelector
  view.setUint16(10, 0, false); // rangeShift

  let recordOffset = headerSize;
  let dataOffset = tablesStart;

  // head table record
  writeTag(buf, recordOffset, 'head');
  view.setUint32(recordOffset + 4, 0, false); // checkSum
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, headSize, false);

  // Write head table data
  const headOffset = dataOffset;
  view.setUint32(headOffset, 0x00010000, false); // version
  view.setUint32(headOffset + 4, 0x00010000, false); // fontRevision
  view.setUint32(headOffset + 8, 0, false); // checkSumAdjustment
  view.setUint32(headOffset + 12, 0x5F0F3CF5, false); // magicNumber
  view.setUint16(headOffset + 16, 0x000B, false); // flags
  view.setUint16(headOffset + 18, 1000, false); // unitsPerEm
  // skip created/modified (offsets 20-35)
  view.setInt16(headOffset + 36, 0, false);   // xMin
  view.setInt16(headOffset + 38, -200, false); // yMin
  view.setInt16(headOffset + 40, 1000, false); // xMax
  view.setInt16(headOffset + 42, 800, false);  // yMax
  // skip macStyle, lowestRecPPEM, fontDirectionHint
  view.setInt16(headOffset + 50, 0, false); // indexToLocFormat

  dataOffset += headSize;
  recordOffset += recordSize;

  // hhea table record
  writeTag(buf, recordOffset, 'hhea');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, hheaSize, false);

  const hheaOffset = dataOffset;
  view.setUint32(hheaOffset, 0x00010000, false); // version
  view.setInt16(hheaOffset + 4, 800, false);  // ascent
  view.setInt16(hheaOffset + 6, -200, false); // descent
  view.setInt16(hheaOffset + 8, 0, false);    // lineGap
  view.setUint16(hheaOffset + 10, 600, false); // advanceWidthMax
  // Fill remaining hhea fields with zeros
  view.setUint16(hheaOffset + 34, 2, false); // numberOfHMetrics

  dataOffset += hheaSize;
  recordOffset += recordSize;

  // maxp table record
  writeTag(buf, recordOffset, 'maxp');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, maxpSize, false);

  const maxpOffset = dataOffset;
  view.setUint32(maxpOffset, 0x00010000, false); // version
  view.setUint16(maxpOffset + 4, 2, false); // numGlyphs

  dataOffset += maxpSize;
  recordOffset += recordSize;

  // hmtx table record
  writeTag(buf, recordOffset, 'hmtx');
  view.setUint32(recordOffset + 4, 0, false);
  view.setUint32(recordOffset + 8, dataOffset, false);
  view.setUint32(recordOffset + 12, hmtxSize, false);

  const hmtxOffset = dataOffset;
  // Glyph 0: advance 500, lsb 0
  view.setUint16(hmtxOffset, 500, false);
  view.setInt16(hmtxOffset + 2, 0, false);
  // Glyph 1: advance 600, lsb 50
  view.setUint16(hmtxOffset + 4, 600, false);
  view.setInt16(hmtxOffset + 6, 50, false);

  return buf;
}

function writeTag(buf: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) {
    buf[offset + i] = tag.charCodeAt(i);
  }
}

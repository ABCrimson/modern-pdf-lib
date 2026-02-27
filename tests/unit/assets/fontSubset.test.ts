/**
 * Tests for TrueType font subsetting.
 *
 * Builds a minimal valid TrueType font with glyf/loca tables and
 * verifies that subsetting:
 * 1. Produces a smaller font than the original
 * 2. Preserves glyph data for used glyphs
 * 3. Resolves composite glyph dependencies
 * 4. Produces a valid TrueType table directory
 * 5. Returns the original font unchanged for invalid/non-TTF data
 */

import { describe, it, expect } from 'vitest';
import { subsetTtf } from '../../../src/assets/font/ttfSubset.js';
import { subsetFont, buildSubsetCmap, computeSubsetTag } from '../../../src/assets/font/fontSubset.js';

// ---------------------------------------------------------------------------
// Helper: build a TrueType font with glyf/loca tables
// ---------------------------------------------------------------------------

/**
 * Build a minimal TrueType font with `numGlyphs` simple glyphs,
 * each containing a small amount of glyph data. Optionally, the last
 * glyph can be a composite referencing an earlier glyph.
 */
function buildTtfWithGlyf(opts: {
  numGlyphs: number;
  glyphDataSize?: number;
  compositeGlyphId?: number;
  compositeComponentId?: number;
}): Uint8Array {
  const { numGlyphs, glyphDataSize = 40, compositeGlyphId, compositeComponentId } = opts;

  // Tables we need: head, hhea, maxp, hmtx, loca, glyf, cmap
  const numTables = 7;
  const headerSize = 12;
  const dirSize = numTables * 16;
  const tablesStart = headerSize + dirSize;

  // Table sizes
  const headSize = 54;
  const hheaSize = 36;
  const maxpSize = 6;
  const hmtxSize = numGlyphs * 4;

  // Build glyf data: each simple glyph has 10-byte header + padding
  const glyphEntries: Uint8Array[] = [];
  for (let gid = 0; gid < numGlyphs; gid++) {
    if (compositeGlyphId !== undefined && gid === compositeGlyphId) {
      // Composite glyph referencing compositeComponentId
      const compData = new Uint8Array(20); // header + component
      const compView = new DataView(compData.buffer);
      compView.setInt16(0, -1, false); // numberOfContours = -1 (composite)
      compView.setInt16(2, 0, false); // xMin
      compView.setInt16(4, 0, false); // yMin
      compView.setInt16(6, 100, false); // xMax
      compView.setInt16(8, 100, false); // yMax
      // Component record: flags=0x0002 (ARGS_ARE_XY_VALUES), glyphIndex, dx=0, dy=0
      compView.setUint16(10, 0x0002, false); // flags (no MORE_COMPONENTS, args are bytes)
      compView.setUint16(12, compositeComponentId ?? 0, false); // glyphIndex
      compView.setInt8(14, 0); // dx
      compView.setInt8(15, 0); // dy
      glyphEntries.push(compData);
    } else {
      // Simple glyph with some data
      const gData = new Uint8Array(glyphDataSize);
      const gView = new DataView(gData.buffer);
      gView.setInt16(0, 1, false); // numberOfContours = 1
      gView.setInt16(2, 0, false); // xMin
      gView.setInt16(4, 0, false); // yMin
      gView.setInt16(6, 500, false); // xMax
      gView.setInt16(8, 700, false); // yMax
      // Fill rest with non-zero data to simulate glyph outlines
      for (let i = 10; i < glyphDataSize; i++) {
        gData[i] = (gid * 17 + i) & 0xFF;
      }
      glyphEntries.push(gData);
    }
  }

  // Calculate glyf table size (2-byte aligned entries)
  let glyfSize = 0;
  const glyfAligned: number[] = [];
  for (const entry of glyphEntries) {
    const aligned = (entry.length + 1) & ~1;
    glyfAligned.push(aligned);
    glyfSize += aligned;
  }

  // Loca table: short format (uint16 * (numGlyphs + 1))
  const locaSize = (numGlyphs + 1) * 2;

  // Simple cmap (format 4) for ASCII A-Z mapping to glyphs 1..26
  const cmapHeaderSize = 4 + 8; // cmap header + 1 subtable record
  const segCount = 2; // one segment for A-Z + sentinel
  const fmt4Size = 14 + segCount * 8;
  const cmapSize = cmapHeaderSize + fmt4Size;

  // Calculate total font size
  const tableDataSizes = [headSize, hheaSize, maxpSize, hmtxSize, locaSize, glyfSize, cmapSize];
  let totalSize = tablesStart;
  for (const s of tableDataSizes) {
    totalSize += (s + 3) & ~3;
  }

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Offset table
  view.setUint32(0, 0x00010000, false); // sfVersion
  view.setUint16(4, numTables, false);
  // searchRange, entrySelector, rangeShift
  let sr = 1, es = 0;
  while (sr * 2 <= numTables) { sr *= 2; es++; }
  sr *= 16;
  view.setUint16(6, sr, false);
  view.setUint16(8, es, false);
  view.setUint16(10, numTables * 16 - sr, false);

  let recordOff = headerSize;
  let dataOff = tablesStart;

  function writeTableRecord(tag: string, size: number): number {
    const off = dataOff;
    writeTag(buf, recordOff, tag);
    view.setUint32(recordOff + 4, 0, false); // checksum (skip)
    view.setUint32(recordOff + 8, off, false);
    view.setUint32(recordOff + 12, size, false);
    recordOff += 16;
    dataOff += (size + 3) & ~3;
    return off;
  }

  // head
  const headOff = writeTableRecord('head', headSize);
  view.setUint32(headOff, 0x00010000, false);
  view.setUint32(headOff + 4, 0x00010000, false);
  view.setUint32(headOff + 8, 0, false); // checkSumAdjustment
  view.setUint32(headOff + 12, 0x5F0F3CF5, false);
  view.setUint16(headOff + 16, 0x000B, false);
  view.setUint16(headOff + 18, 1000, false); // unitsPerEm
  view.setInt16(headOff + 36, 0, false);
  view.setInt16(headOff + 38, -200, false);
  view.setInt16(headOff + 40, 1000, false);
  view.setInt16(headOff + 42, 800, false);
  view.setInt16(headOff + 50, 0, false); // indexToLocFormat = short

  // hhea
  const hheaOff = writeTableRecord('hhea', hheaSize);
  view.setUint32(hheaOff, 0x00010000, false);
  view.setInt16(hheaOff + 4, 800, false);
  view.setInt16(hheaOff + 6, -200, false);
  view.setInt16(hheaOff + 8, 0, false);
  view.setUint16(hheaOff + 10, 600, false);
  view.setUint16(hheaOff + 34, numGlyphs, false);

  // maxp
  const maxpOff = writeTableRecord('maxp', maxpSize);
  view.setUint32(maxpOff, 0x00010000, false);
  view.setUint16(maxpOff + 4, numGlyphs, false);

  // hmtx
  const hmtxOff = writeTableRecord('hmtx', hmtxSize);
  for (let gid = 0; gid < numGlyphs; gid++) {
    view.setUint16(hmtxOff + gid * 4, 500 + gid * 10, false);
    view.setInt16(hmtxOff + gid * 4 + 2, 0, false);
  }

  // loca (short format)
  const locaOff = writeTableRecord('loca', locaSize);
  let glyfCursor = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    view.setUint16(locaOff + gid * 2, glyfCursor >>> 1, false);
    glyfCursor += glyfAligned[gid]!;
  }
  view.setUint16(locaOff + numGlyphs * 2, glyfCursor >>> 1, false);

  // glyf
  const glyfOff = writeTableRecord('glyf', glyfSize);
  let glyfWritePos = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    buf.set(glyphEntries[gid]!, glyfOff + glyfWritePos);
    glyfWritePos += glyfAligned[gid]!;
  }

  // cmap (minimal format 4 for ASCII)
  const cmapOff = writeTableRecord('cmap', cmapSize);
  view.setUint16(cmapOff, 0, false); // version
  view.setUint16(cmapOff + 2, 1, false); // numSubtables
  // Subtable record: platform 3, encoding 1
  view.setUint16(cmapOff + 4, 3, false);
  view.setUint16(cmapOff + 6, 1, false);
  view.setUint32(cmapOff + 8, cmapHeaderSize, false);
  // Format 4 subtable
  const fmt4Off = cmapOff + cmapHeaderSize;
  view.setUint16(fmt4Off, 4, false); // format
  view.setUint16(fmt4Off + 2, fmt4Size, false); // length
  view.setUint16(fmt4Off + 4, 0, false); // language
  view.setUint16(fmt4Off + 6, segCount * 2, false); // segCountX2
  view.setUint16(fmt4Off + 8, 4, false); // searchRange
  view.setUint16(fmt4Off + 10, 1, false); // entrySelector
  view.setUint16(fmt4Off + 12, 0, false); // rangeShift
  // endCode array: [0x5A (Z), 0xFFFF]
  const endCodeOff = fmt4Off + 14;
  const maxMappedGlyph = Math.min(numGlyphs - 1, 26);
  view.setUint16(endCodeOff, 0x40 + maxMappedGlyph, false); // endCode for A..Z
  view.setUint16(endCodeOff + 2, 0xFFFF, false); // sentinel
  // reservedPad
  view.setUint16(endCodeOff + 4, 0, false);
  // startCode array: [0x41 (A), 0xFFFF]
  const startCodeOff = endCodeOff + 6;
  view.setUint16(startCodeOff, 0x41, false);
  view.setUint16(startCodeOff + 2, 0xFFFF, false);
  // idDelta array: delta so that 0x41 maps to glyph 1
  const idDeltaOff = startCodeOff + 4;
  view.setInt16(idDeltaOff, -(0x41 - 1), false); // delta = -64
  view.setInt16(idDeltaOff + 2, 1, false);
  // idRangeOffset array: [0, 0]
  const idRangeOff = idDeltaOff + 4;
  view.setUint16(idRangeOff, 0, false);
  view.setUint16(idRangeOff + 2, 0, false);

  return buf;
}

function writeTag(buf: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) {
    buf[offset + i] = tag.charCodeAt(i);
  }
}

/** Read the number of tables from a TrueType font header. */
function readNumTables(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset).getUint16(4, false);
}

/** Find a table in a font and return its raw bytes. */
function findTable(data: Uint8Array, tag: string): Uint8Array | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4, false);
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const t = String.fromCharCode(data[off]!, data[off + 1]!, data[off + 2]!, data[off + 3]!);
    if (t === tag) {
      const offset = view.getUint32(off + 8, false);
      const length = view.getUint32(off + 12, false);
      return data.subarray(offset, offset + length);
    }
  }
  return undefined;
}

/** Parse loca table offsets. */
function readLocaOffsets(
  data: Uint8Array,
  indexToLocFormat: number,
  numGlyphs: number,
): number[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const offsets: number[] = [];
  for (let i = 0; i <= numGlyphs; i++) {
    offsets.push(
      indexToLocFormat === 0
        ? view.getUint16(i * 2, false) * 2
        : view.getUint32(i * 4, false),
    );
  }
  return offsets;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrueType font subsetting (subsetTtf)', () => {
  it('produces a smaller font when only a few glyphs are used', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 50, glyphDataSize: 100 });
    const usedGids = new Set([0, 1, 2, 3]);

    const subset = subsetTtf(original, usedGids);

    // The subset should be significantly smaller
    expect(subset.length).toBeLessThan(original.length);
    // At least 50% smaller (50 glyphs → 4 used)
    expect(subset.length).toBeLessThan(original.length * 0.6);
  });

  it('preserves a valid TrueType table directory', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 20 });
    const subset = subsetTtf(original, new Set([0, 1, 5]));

    // Should start with TrueType signature
    const view = new DataView(subset.buffer, subset.byteOffset);
    expect(view.getUint32(0, false)).toBe(0x00010000);

    // Should have table entries
    const numTables = readNumTables(subset);
    expect(numTables).toBeGreaterThanOrEqual(5); // at least head, hhea, maxp, loca, glyf

    // All required tables should exist
    expect(findTable(subset, 'head')).toBeDefined();
    expect(findTable(subset, 'loca')).toBeDefined();
    expect(findTable(subset, 'glyf')).toBeDefined();
    expect(findTable(subset, 'maxp')).toBeDefined();
  });

  it('preserves glyph data for retained glyphs', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 10, glyphDataSize: 40 });
    const subset = subsetTtf(original, new Set([0, 3, 7]));

    // Parse loca in the subset to check glyph sizes
    const headTable = findTable(subset, 'head')!;
    const headView = new DataView(headTable.buffer, headTable.byteOffset);
    const locFormat = headView.getInt16(50, false);

    const maxpTable = findTable(subset, 'maxp')!;
    const maxpView = new DataView(maxpTable.buffer, maxpTable.byteOffset);
    const numGlyphs = maxpView.getUint16(4, false);
    expect(numGlyphs).toBe(10); // All GID slots preserved

    const locaTable = findTable(subset, 'loca')!;
    const locaOffsets = readLocaOffsets(locaTable, locFormat, numGlyphs);

    // Used glyphs should have non-zero length
    const glyph0Len = locaOffsets[1]! - locaOffsets[0]!;
    const glyph3Len = locaOffsets[4]! - locaOffsets[3]!;
    const glyph7Len = locaOffsets[8]! - locaOffsets[7]!;
    expect(glyph0Len).toBeGreaterThan(0);
    expect(glyph3Len).toBeGreaterThan(0);
    expect(glyph7Len).toBeGreaterThan(0);

    // Unused glyphs should have zero length
    const glyph1Len = locaOffsets[2]! - locaOffsets[1]!;
    const glyph2Len = locaOffsets[3]! - locaOffsets[2]!;
    const glyph5Len = locaOffsets[6]! - locaOffsets[5]!;
    expect(glyph1Len).toBe(0);
    expect(glyph2Len).toBe(0);
    expect(glyph5Len).toBe(0);
  });

  it('resolves composite glyph dependencies', () => {
    // Glyph 5 is a composite referencing glyph 2
    const original = buildTtfWithGlyf({
      numGlyphs: 10,
      glyphDataSize: 40,
      compositeGlyphId: 5,
      compositeComponentId: 2,
    });

    // Only request glyph 5 (composite) — glyph 2 should be auto-included
    const subset = subsetTtf(original, new Set([0, 5]));

    const headTable = findTable(subset, 'head')!;
    const locFormat = new DataView(headTable.buffer, headTable.byteOffset).getInt16(50, false);
    const locaTable = findTable(subset, 'loca')!;
    const locaOffsets = readLocaOffsets(locaTable, locFormat, 10);

    // Glyph 2 (component) should be retained
    const glyph2Len = locaOffsets[3]! - locaOffsets[2]!;
    expect(glyph2Len).toBeGreaterThan(0);

    // Glyph 5 (composite) should be retained
    const glyph5Len = locaOffsets[6]! - locaOffsets[5]!;
    expect(glyph5Len).toBeGreaterThan(0);

    // Glyph 4 (not used, not a dependency) should be empty
    const glyph4Len = locaOffsets[5]! - locaOffsets[4]!;
    expect(glyph4Len).toBe(0);
  });

  it('always includes .notdef (glyph 0)', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 5 });
    const subset = subsetTtf(original, new Set([3])); // don't explicitly include 0

    const headTable = findTable(subset, 'head')!;
    const locFormat = new DataView(headTable.buffer, headTable.byteOffset).getInt16(50, false);
    const locaTable = findTable(subset, 'loca')!;
    const locaOffsets = readLocaOffsets(locaTable, locFormat, 5);

    // Glyph 0 should have data
    expect(locaOffsets[1]! - locaOffsets[0]!).toBeGreaterThan(0);
  });

  it('preserves copied tables (hhea, cmap, hmtx)', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 10 });
    const subset = subsetTtf(original, new Set([0, 1]));

    expect(findTable(subset, 'hhea')).toBeDefined();
    expect(findTable(subset, 'cmap')).toBeDefined();
    expect(findTable(subset, 'hmtx')).toBeDefined();
  });

  it('returns original data unchanged for non-TrueType input', () => {
    const dummy = new Uint8Array(256);
    for (let i = 0; i < 256; i++) dummy[i] = i;

    const result = subsetTtf(dummy, new Set([0, 1, 2]));

    // Should return a copy of the original
    expect(result.length).toBe(dummy.length);
    expect(result).not.toBe(dummy);
  });

  it('returns original data for input smaller than 28 bytes', () => {
    const tiny = new Uint8Array(10);
    const result = subsetTtf(tiny, new Set([0]));
    expect(result.length).toBe(10);
  });

  it('handles empty used glyph set', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 5 });
    const subset = subsetTtf(original, new Set());
    // Should still produce a valid font (with just .notdef if the code adds it,
    // or empty glyphs if not). Should not throw.
    expect(subset.length).toBeLessThanOrEqual(original.length);
  });
});

describe('subsetFont (integration with fontSubset.ts)', () => {
  it('subsetFont returns smaller fontData for real TTF input', () => {
    const original = buildTtfWithGlyf({ numGlyphs: 50, glyphDataSize: 100 });
    const usedGlyphs = new Set([0, 1, 2]);
    const result = subsetFont(original, usedGlyphs);

    expect(result.fontData.length).toBeLessThan(original.length);
    expect(result.newToOldGid).toBeDefined();
    expect(result.oldToNewGid).toBeDefined();
    expect(result.oldToNewGid.get(0)).toBe(0);
    expect(result.oldToNewGid.get(1)).toBe(1);
    expect(result.oldToNewGid.get(2)).toBe(2);
  });

  it('subsetFont still works with non-TTF data (fallback)', () => {
    const dummy = new Uint8Array(256);
    for (let i = 0; i < 256; i++) dummy[i] = i;
    const result = subsetFont(dummy, new Set([0, 5, 10]));

    expect(result.fontData).toBeInstanceOf(Uint8Array);
    expect(result.fontData.length).toBe(256);
  });

  it('computeSubsetTag produces a 6-letter tag', () => {
    const tag = computeSubsetTag(new Set([0, 1, 2, 3]));
    expect(tag).toHaveLength(6);
    expect(tag).toMatch(/^[A-Z]{6}$/);
  });
});

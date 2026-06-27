/**
 * Tests for COLR v0 + CPAL color-font parsing (src/assets/font/colorFont.ts).
 *
 * Two paths are exercised:
 *
 * 1. NON-COLOR FONT: a hand-built minimal sfnt that has *no* COLR table.
 *    Expectation: hasColor === false, numPalettes === 0, and
 *    getColorGlyphLayers(...) === [] for any glyph.
 *
 * 2. COLOR FONT: a hand-built minimal sfnt wrapping exactly two tables —
 *    CPAL (version 0) and COLR (version 0) — constructed byte-by-byte
 *    against the OpenType 1.9.1 spec.
 *
 *    --- Hand-built CPAL v0 fixture (see buildCpalV0) ---
 *    Header (12 bytes), all big-endian:
 *      version            = 0
 *      numPaletteEntries  = 2
 *      numPalettes        = 1
 *      numColorRecords    = 2
 *      colorRecordsArrayOffset = 12   (records start right after the header,
 *                                      since there is exactly one palette so
 *                                      colorRecordIndices occupies 2 bytes...
 *                                      but we lay records after a single u16
 *                                      index at offset 12, see note below)
 *      colorRecordIndices[1] = { 0 }  (palette 0 starts at color record 0)
 *    Color records (BGRA, 4 bytes each) per spec — ColorRecord = blue, green,
 *    red, alpha:
 *      record 0: B=0x33 G=0x22 R=0x11 A=0xFF  -> RGBA (0x11,0x22,0x33,0xFF)
 *      record 1: B=0x66 G=0x55 R=0x44 A=0x80  -> RGBA (0x44,0x55,0x66,0x80)
 *
 *    --- Hand-built COLR v0 fixture (see buildColrV0) ---
 *    Header (14 bytes), all big-endian:
 *      version                = 0
 *      numBaseGlyphRecords    = 1
 *      baseGlyphRecordsOffset = 14            (right after the header)
 *      layerRecordsOffset     = 14 + 6 = 20   (after the 1 base-glyph record)
 *      numLayerRecords        = 2
 *    BaseGlyph record (6 bytes): glyphID=5, firstLayerIndex=0, numLayers=2
 *    Layer records (4 bytes each):
 *      layer 0: glyphID=10, paletteIndex=0  -> resolves to palette 0 entry 0
 *      layer 1: glyphID=11, paletteIndex=1  -> resolves to palette 0 entry 1
 *
 *    So base glyph 5 expands to layers [ {gid 10, color rec 0},
 *    {gid 11, color rec 1} ].
 */

import { describe, it, expect } from 'vitest';
import {
  parseColorFont,
  getColorGlyphLayers,
  type ColorGlyphLayer,
} from '../../../../src/assets/font/colorFont.js';

// ---------------------------------------------------------------------------
// sfnt wrapper helpers
// ---------------------------------------------------------------------------

function writeTag(buf: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) buf[offset + i] = tag.charCodeAt(i);
}

/**
 * Wrap a set of named tables into a minimal valid sfnt container.
 * Builds the 12-byte offset table + 16-byte table-directory records,
 * then appends each table's bytes 4-byte aligned. sfnt version 0x00010000.
 */
function buildSfnt(tables: { tag: string; data: Uint8Array }[]): Uint8Array {
  // Table directory records must be sorted by tag (not required by all
  // parsers, but matches real fonts). Our parser does a linear scan so
  // order does not actually matter — we keep insertion order.
  const numTables = tables.length;
  const headerSize = 12;
  const dirSize = numTables * 16;
  let dataOff = headerSize + dirSize;

  const placed: { tag: string; data: Uint8Array; offset: number }[] = [];
  for (const t of tables) {
    placed.push({ ...t, offset: dataOff });
    dataOff += (t.data.length + 3) & ~3; // 4-byte align
  }
  const total = dataOff;

  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x00010000, false); // sfnt version (TrueType)
  view.setUint16(4, numTables, false);

  // searchRange / entrySelector / rangeShift
  let sr = 1;
  let es = 0;
  while (sr * 2 <= numTables) {
    sr *= 2;
    es++;
  }
  sr *= 16;
  view.setUint16(6, sr, false);
  view.setUint16(8, es, false);
  view.setUint16(10, numTables * 16 - sr, false);

  let recordOff = headerSize;
  for (const p of placed) {
    writeTag(buf, recordOff, p.tag);
    view.setUint32(recordOff + 4, 0, false); // checksum (ignored by parser)
    view.setUint32(recordOff + 8, p.offset, false);
    view.setUint32(recordOff + 12, p.data.length, false);
    recordOff += 16;
    buf.set(p.data, p.offset);
  }

  return buf;
}

// ---------------------------------------------------------------------------
// CPAL v0 fixture builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal CPAL v0 table: 1 palette of 2 entries, 2 color records.
 * Color records are stored BGRA per spec.
 *
 * Layout:
 *   header (12 bytes) + colorRecordIndices[1] (2 bytes) -> color records.
 *   We set colorRecordsArrayOffset to 14 (12-byte header + 2-byte index array).
 */
function buildCpalV0(): Uint8Array {
  const numPalettes = 1;
  const numColorRecords = 2;
  const headerSize = 12;
  const indicesSize = numPalettes * 2;
  const recordsOffset = headerSize + indicesSize; // = 14
  const total = recordsOffset + numColorRecords * 4;

  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0, false); // version 0
  view.setUint16(2, 2, false); // numPaletteEntries
  view.setUint16(4, numPalettes, false); // numPalettes
  view.setUint16(6, numColorRecords, false); // numColorRecords
  view.setUint32(8, recordsOffset, false); // colorRecordsArrayOffset
  view.setUint16(12, 0, false); // colorRecordIndices[0] = 0

  // ColorRecord 0 (BGRA): B=0x33 G=0x22 R=0x11 A=0xFF
  buf[recordsOffset + 0] = 0x33;
  buf[recordsOffset + 1] = 0x22;
  buf[recordsOffset + 2] = 0x11;
  buf[recordsOffset + 3] = 0xff;
  // ColorRecord 1 (BGRA): B=0x66 G=0x55 R=0x44 A=0x80
  buf[recordsOffset + 4] = 0x66;
  buf[recordsOffset + 5] = 0x55;
  buf[recordsOffset + 6] = 0x44;
  buf[recordsOffset + 7] = 0x80;

  return buf;
}

// ---------------------------------------------------------------------------
// COLR v0 fixture builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal COLR v0 table: 1 base glyph (gid 5) -> 2 layers.
 */
function buildColrV0(): Uint8Array {
  const headerSize = 14;
  const baseGlyphRecordsOffset = headerSize; // 14
  const numBaseGlyphRecords = 1;
  const layerRecordsOffset = baseGlyphRecordsOffset + numBaseGlyphRecords * 6; // 20
  const numLayerRecords = 2;
  const total = layerRecordsOffset + numLayerRecords * 4;

  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0, false); // version 0
  view.setUint16(2, numBaseGlyphRecords, false); // numBaseGlyphRecords
  view.setUint32(4, baseGlyphRecordsOffset, false); // baseGlyphRecordsOffset
  view.setUint32(8, layerRecordsOffset, false); // layerRecordsOffset
  view.setUint16(12, numLayerRecords, false); // numLayerRecords

  // BaseGlyph record: glyphID=5, firstLayerIndex=0, numLayers=2
  view.setUint16(baseGlyphRecordsOffset + 0, 5, false);
  view.setUint16(baseGlyphRecordsOffset + 2, 0, false);
  view.setUint16(baseGlyphRecordsOffset + 4, 2, false);

  // Layer 0: glyphID=10, paletteIndex=0
  view.setUint16(layerRecordsOffset + 0, 10, false);
  view.setUint16(layerRecordsOffset + 2, 0, false);
  // Layer 1: glyphID=11, paletteIndex=1
  view.setUint16(layerRecordsOffset + 4, 11, false);
  view.setUint16(layerRecordsOffset + 6, 1, false);

  return buf;
}

/** A minimal sfnt with only CPAL + COLR (enough to parse color data). */
function buildColorFont(): Uint8Array {
  return buildSfnt([
    { tag: 'CPAL', data: buildCpalV0() },
    { tag: 'COLR', data: buildColrV0() },
  ]);
}

/** A minimal non-color sfnt: a single dummy 'cmap'-tagged table, no COLR/CPAL. */
function buildNonColorFont(): Uint8Array {
  const dummy = new Uint8Array(8); // contents irrelevant
  return buildSfnt([
    { tag: 'head', data: dummy },
    { tag: 'maxp', data: dummy },
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseColorFont (CPAL)', () => {
  it('reports a non-color font as having no color', () => {
    const font = buildNonColorFont();
    const info = parseColorFont(font);
    expect(info.hasColor).toBe(false);
    expect(info.numPalettes).toBe(0);
    expect(info.palettes).toEqual([]);
  });

  it('parses CPAL v0 palettes with BGRA -> RGBA conversion', () => {
    const font = buildColorFont();
    const info = parseColorFont(font);
    expect(info.hasColor).toBe(true);
    expect(info.numPalettes).toBe(1);
    expect(info.palettes).toHaveLength(1);

    const pal = info.palettes[0]!;
    expect(pal.colors).toHaveLength(2);
    // BGRA 0x33,0x22,0x11,0xFF -> RGBA 0x11,0x22,0x33,0xFF
    expect(pal.colors[0]).toEqual([0x11, 0x22, 0x33, 0xff]);
    // BGRA 0x66,0x55,0x44,0x80 -> RGBA 0x44,0x55,0x66,0x80
    expect(pal.colors[1]).toEqual([0x44, 0x55, 0x66, 0x80]);
  });
});

describe('getColorGlyphLayers (COLR v0)', () => {
  it('returns [] for a non-color font', () => {
    const font = buildNonColorFont();
    expect(getColorGlyphLayers(font, 5)).toEqual([]);
  });

  it('returns [] for a glyph with no COLR base record', () => {
    const font = buildColorFont();
    // gid 999 is not a base glyph -> drawn as a normal monochrome glyph
    expect(getColorGlyphLayers(font, 999)).toEqual([]);
  });

  it('expands a base glyph into its layers with resolved palette colors', () => {
    const font = buildColorFont();
    const layers: ColorGlyphLayer[] = getColorGlyphLayers(font, 5);
    expect(layers).toHaveLength(2);

    expect(layers[0]!.glyphId).toBe(10);
    expect(layers[0]!.paletteIndex).toBe(0);
    expect(layers[0]!.rgba).toEqual([0x11, 0x22, 0x33, 0xff]);

    expect(layers[1]!.glyphId).toBe(11);
    expect(layers[1]!.paletteIndex).toBe(1);
    expect(layers[1]!.rgba).toEqual([0x44, 0x55, 0x66, 0x80]);
  });

  it('uses palette 0 by default and honours an explicit palette index', () => {
    const font = buildColorFont();
    // Only palette 0 exists; requesting it explicitly must match the default.
    const def = getColorGlyphLayers(font, 5);
    const explicit = getColorGlyphLayers(font, 5, 0);
    expect(explicit).toEqual(def);
  });
});

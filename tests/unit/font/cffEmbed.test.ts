/**
 * Tests for CFF embedding — OpenType table directory parsing via findTable().
 *
 * The cffEmbed module exposes `findTable()` which locates tables by their
 * 4-byte tag in an OpenType font binary. These tests construct minimal
 * font table directories to exercise all code paths.
 */

import { describe, it, expect } from 'vitest';
import { findTable } from '../../../src/assets/font/cffEmbed.js';

// ---------------------------------------------------------------------------
// Helpers — minimal font directory builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal OpenType table directory with the given table entries.
 *
 * Layout:
 *   0..3   — magic bytes (default OTTO for CFF)
 *   4..5   — numTables (big-endian u16)
 *   6..11  — searchRange, entrySelector, rangeShift (unused, zeroed)
 *   12+    — table records (16 bytes each: tag + checkSum + offset + length)
 *
 * @param magic   4-byte magic number (e.g., [0x4F,0x54,0x54,0x4F] for OTTO)
 * @param tables  Array of { tag, offset, length } entries.
 */
function buildTableDirectory(
  magic: number[],
  tables: { tag: string; offset: number; length: number }[],
): Uint8Array {
  const headerSize = 12;
  const recordSize = 16;
  const totalSize = headerSize + tables.length * recordSize;
  const data = new Uint8Array(totalSize);

  // Magic bytes
  data[0] = magic[0]!;
  data[1] = magic[1]!;
  data[2] = magic[2]!;
  data[3] = magic[3]!;

  // numTables (big-endian u16)
  data[4] = (tables.length >> 8) & 0xFF;
  data[5] = tables.length & 0xFF;

  // searchRange, entrySelector, rangeShift = 0 (not used by findTable)

  for (let i = 0; i < tables.length; i++) {
    const rec = headerSize + i * recordSize;
    const entry = tables[i]!;

    // Tag (4 ASCII bytes)
    for (let j = 0; j < 4; j++) {
      data[rec + j] = entry.tag.charCodeAt(j);
    }

    // checkSum (4 bytes) — zeroed, not used by findTable

    // offset (big-endian u32)
    data[rec + 8] = (entry.offset >> 24) & 0xFF;
    data[rec + 9] = (entry.offset >> 16) & 0xFF;
    data[rec + 10] = (entry.offset >> 8) & 0xFF;
    data[rec + 11] = entry.offset & 0xFF;

    // length (big-endian u32)
    data[rec + 12] = (entry.length >> 24) & 0xFF;
    data[rec + 13] = (entry.length >> 16) & 0xFF;
    data[rec + 14] = (entry.length >> 8) & 0xFF;
    data[rec + 15] = entry.length & 0xFF;
  }

  return data;
}

/** OTTO magic bytes for CFF-based OpenType fonts. */
const OTTO_MAGIC = [0x4F, 0x54, 0x54, 0x4F];

/** TrueType magic bytes. */
const TTF_MAGIC = [0x00, 0x01, 0x00, 0x00];

// ---------------------------------------------------------------------------
// Tests: findTable — data too short
// ---------------------------------------------------------------------------

describe('findTable — data too short', () => {
  it('returns undefined for empty data', () => {
    expect(findTable(new Uint8Array(0), 'CFF ')).toBeUndefined();
  });

  it('returns undefined for data shorter than 12 bytes', () => {
    const data = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 0, 0, 0]);
    expect(findTable(data, 'CFF ')).toBeUndefined();
  });

  it('returns undefined for exactly 11 bytes', () => {
    const data = new Uint8Array(11);
    expect(findTable(data, 'head')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — single table
// ---------------------------------------------------------------------------

describe('findTable — single table', () => {
  it('finds a CFF table at a specific offset', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 4096 },
    ]);
    const result = findTable(data, 'CFF ');
    expect(result).toEqual({ offset: 128, length: 4096 });
  });

  it('finds a head table', () => {
    const data = buildTableDirectory(TTF_MAGIC, [
      { tag: 'head', offset: 256, length: 54 },
    ]);
    const result = findTable(data, 'head');
    expect(result).toEqual({ offset: 256, length: 54 });
  });

  it('returns undefined when the requested table is not present', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 4096 },
    ]);
    expect(findTable(data, 'GPOS')).toBeUndefined();
  });

  it('returns undefined for a tag that differs by one character', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 4096 },
    ]);
    expect(findTable(data, 'CFF!')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — multiple tables
// ---------------------------------------------------------------------------

describe('findTable — multiple tables', () => {
  it('finds the correct table among multiple entries', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'head', offset: 100, length: 54 },
      { tag: 'hhea', offset: 200, length: 36 },
      { tag: 'CFF ', offset: 300, length: 8000 },
      { tag: 'maxp', offset: 400, length: 6 },
    ]);

    expect(findTable(data, 'CFF ')).toEqual({ offset: 300, length: 8000 });
    expect(findTable(data, 'head')).toEqual({ offset: 100, length: 54 });
    expect(findTable(data, 'hhea')).toEqual({ offset: 200, length: 36 });
    expect(findTable(data, 'maxp')).toEqual({ offset: 400, length: 6 });
  });

  it('returns undefined for a tag not present among multiple entries', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'head', offset: 100, length: 54 },
      { tag: 'hhea', offset: 200, length: 36 },
    ]);
    expect(findTable(data, 'post')).toBeUndefined();
  });

  it('finds the first table (index 0)', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'name', offset: 50, length: 200 },
      { tag: 'post', offset: 250, length: 100 },
    ]);
    expect(findTable(data, 'name')).toEqual({ offset: 50, length: 200 });
  });

  it('finds the last table', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'head', offset: 100, length: 54 },
      { tag: 'hhea', offset: 200, length: 36 },
      { tag: 'OS/2', offset: 300, length: 96 },
    ]);
    expect(findTable(data, 'OS/2')).toEqual({ offset: 300, length: 96 });
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — offset and length parsing
// ---------------------------------------------------------------------------

describe('findTable — offset and length parsing', () => {
  it('correctly parses large offset values', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 0x00FFFFFF, length: 100 },
    ]);
    const result = findTable(data, 'CFF ');
    expect(result).toEqual({ offset: 0x00FFFFFF, length: 100 });
  });

  it('correctly parses large length values', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 0x00FFFFFF },
    ]);
    const result = findTable(data, 'CFF ');
    expect(result).toEqual({ offset: 128, length: 0x00FFFFFF });
  });

  it('handles offset of 0', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'head', offset: 0, length: 54 },
    ]);
    const result = findTable(data, 'head');
    expect(result).toEqual({ offset: 0, length: 54 });
  });

  it('handles length of 0', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'head', offset: 100, length: 0 },
    ]);
    const result = findTable(data, 'head');
    expect(result).toEqual({ offset: 100, length: 0 });
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — table tag matching
// ---------------------------------------------------------------------------

describe('findTable — table tag matching', () => {
  it('matches tags with trailing space (CFF )', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 4096 },
    ]);
    expect(findTable(data, 'CFF ')).toBeDefined();
  });

  it('distinguishes between similar tags', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'GPOS', offset: 100, length: 500 },
      { tag: 'GSUB', offset: 600, length: 400 },
    ]);
    expect(findTable(data, 'GPOS')).toEqual({ offset: 100, length: 500 });
    expect(findTable(data, 'GSUB')).toEqual({ offset: 600, length: 400 });
  });

  it('handles four-byte tags with all different characters', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'cmap', offset: 200, length: 1024 },
    ]);
    expect(findTable(data, 'cmap')).toEqual({ offset: 200, length: 1024 });
  });

  it('is case-sensitive for tag matching', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'GPOS', offset: 100, length: 500 },
    ]);
    expect(findTable(data, 'gpos')).toBeUndefined();
    expect(findTable(data, 'GPOS')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — truncated table records
// ---------------------------------------------------------------------------

describe('findTable — truncated data', () => {
  it('handles numTables claiming more records than data holds', () => {
    // Header says 3 tables, but data only has space for 1 record
    const data = new Uint8Array(12 + 16); // space for 1 record
    // OTTO magic
    data[0] = 0x4F; data[1] = 0x54; data[2] = 0x54; data[3] = 0x4F;
    // numTables = 3 (but only 1 record fits)
    data[4] = 0; data[5] = 3;

    // Write one valid record for "head"
    const tag = 'head';
    for (let j = 0; j < 4; j++) {
      data[12 + j] = tag.charCodeAt(j);
    }
    // offset = 100, length = 54
    data[20] = 0; data[21] = 0; data[22] = 0; data[23] = 100;
    data[24] = 0; data[25] = 0; data[26] = 0; data[27] = 54;

    // Should find the first table even though numTables is wrong
    expect(findTable(data, 'head')).toEqual({ offset: 100, length: 54 });
    // Tables that don't exist should return undefined without crashing
    expect(findTable(data, 'post')).toBeUndefined();
  });

  it('returns undefined when numTables is 0', () => {
    const data = new Uint8Array(12);
    data[0] = 0x4F; data[1] = 0x54; data[2] = 0x54; data[3] = 0x4F;
    data[4] = 0; data[5] = 0; // numTables = 0

    expect(findTable(data, 'CFF ')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — works with both CFF and TrueType fonts
// ---------------------------------------------------------------------------

describe('findTable — font type independence', () => {
  it('works with OTTO (CFF) magic bytes', () => {
    const data = buildTableDirectory(OTTO_MAGIC, [
      { tag: 'CFF ', offset: 128, length: 4096 },
    ]);
    expect(findTable(data, 'CFF ')).toBeDefined();
  });

  it('works with TrueType magic bytes', () => {
    const data = buildTableDirectory(TTF_MAGIC, [
      { tag: 'glyf', offset: 256, length: 2048 },
    ]);
    expect(findTable(data, 'glyf')).toEqual({ offset: 256, length: 2048 });
  });

  it('works regardless of magic bytes (parsing is magic-agnostic)', () => {
    // findTable only reads numTables and table records — it does not
    // validate the magic bytes, so any 4-byte prefix is fine
    const data = buildTableDirectory([0xAA, 0xBB, 0xCC, 0xDD], [
      { tag: 'hmtx', offset: 64, length: 512 },
    ]);
    expect(findTable(data, 'hmtx')).toEqual({ offset: 64, length: 512 });
  });
});

// ---------------------------------------------------------------------------
// Tests: findTable — standard OpenType table tags
// ---------------------------------------------------------------------------

describe('findTable — common OpenType table tags', () => {
  const commonTables = [
    { tag: 'head', offset: 100, length: 54 },
    { tag: 'hhea', offset: 200, length: 36 },
    { tag: 'maxp', offset: 300, length: 6 },
    { tag: 'OS/2', offset: 400, length: 96 },
    { tag: 'name', offset: 500, length: 256 },
    { tag: 'cmap', offset: 800, length: 1024 },
    { tag: 'post', offset: 1900, length: 128 },
    { tag: 'CFF ', offset: 2100, length: 8000 },
    { tag: 'hmtx', offset: 10100, length: 512 },
    { tag: 'GPOS', offset: 10700, length: 600 },
    { tag: 'GSUB', offset: 11300, length: 400 },
  ];

  const data = buildTableDirectory(OTTO_MAGIC, commonTables);

  for (const table of commonTables) {
    it(`finds "${table.tag}" table`, () => {
      const result = findTable(data, table.tag);
      expect(result).toEqual({ offset: table.offset, length: table.length });
    });
  }

  it('does not find a nonexistent table', () => {
    expect(findTable(data, 'MATH')).toBeUndefined();
    expect(findTable(data, 'kern')).toBeUndefined();
  });
});

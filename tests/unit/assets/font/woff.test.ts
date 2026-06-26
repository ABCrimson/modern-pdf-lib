import { describe, it, expect } from 'vitest';
import { zlibSync } from 'fflate';
import {
  isWoff,
  isWoff2,
  readWoffHeader,
  decodeWoff,
} from '../../../../src/assets/font/woff.js';
import type { WoffInfo } from '../../../../src/assets/font/woff.js';

// ---------------------------------------------------------------------------
// Helpers to build a tiny synthetic WOFF1 container.
// ---------------------------------------------------------------------------

const WOFF_HEADER_SIZE = 44;
const WOFF1_DIR_ENTRY_SIZE = 20;
const SFNT_HEADER_SIZE = 12;
const SFNT_RECORD_SIZE = 16;

/** Encode a four-character tag string into a big-endian uint32. */
function tagToUint32(tag: string): number {
  return (
    ((tag.charCodeAt(0) << 24) |
      (tag.charCodeAt(1) << 16) |
      (tag.charCodeAt(2) << 8) |
      tag.charCodeAt(3)) >>>
    0
  );
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

interface SyntheticTable {
  readonly tag: string;
  readonly data: Uint8Array;
  readonly compress: boolean;
}

/**
 * Build a minimal WOFF1 file with the given tables.
 *
 * @param flavor - The sfnt flavor to embed (e.g. 0x00010000).
 * @param tables - Tables to include.
 */
function buildWoff1(flavor: number, tables: readonly SyntheticTable[]): Uint8Array {
  const numTables = tables.length;

  // Compute the reconstructed sfnt size for the header field.
  let totalSfntSize = SFNT_HEADER_SIZE + numTables * SFNT_RECORD_SIZE;
  for (const t of tables) {
    totalSfntSize += align4(t.data.length);
  }

  // Prepare each table's stored (possibly compressed) bytes.
  const stored = tables.map((t) => {
    if (t.compress) {
      return zlibSync(t.data);
    }
    return t.data;
  });

  // Layout: header, then directory, then table data (in order).
  let bodyOffset = WOFF_HEADER_SIZE + numTables * WOFF1_DIR_ENTRY_SIZE;
  const tableOffsets: number[] = [];
  for (let i = 0; i < numTables; i++) {
    tableOffsets.push(bodyOffset);
    const s = stored[i];
    if (s === undefined) throw new Error('missing stored table');
    bodyOffset += align4(s.length);
  }

  const total = bodyOffset;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // Header.
  view.setUint32(0, tagToUint32('wOFF'), false); // signature
  view.setUint32(4, flavor, false); // flavor
  view.setUint32(8, total, false); // length
  view.setUint16(12, numTables, false); // numTables
  view.setUint16(14, 0, false); // reserved
  view.setUint32(16, totalSfntSize, false); // totalSfntSize
  view.setUint16(20, 1, false); // majorVersion
  view.setUint16(22, 0, false); // minorVersion
  view.setUint32(24, 0, false); // metaOffset
  view.setUint32(28, 0, false); // metaLength
  view.setUint32(32, 0, false); // metaOrigLength
  view.setUint32(36, 0, false); // privOffset
  view.setUint32(40, 0, false); // privLength

  // Directory + data.
  for (let i = 0; i < numTables; i++) {
    const t = tables[i];
    const s = stored[i];
    const off = tableOffsets[i];
    if (t === undefined || s === undefined || off === undefined) {
      throw new Error('missing synthetic table');
    }
    const dirOff = WOFF_HEADER_SIZE + i * WOFF1_DIR_ENTRY_SIZE;
    view.setUint32(dirOff, tagToUint32(t.tag), false); // tag
    view.setUint32(dirOff + 4, off, false); // offset
    view.setUint32(dirOff + 8, s.length, false); // compLength
    view.setUint32(dirOff + 12, t.data.length, false); // origLength
    view.setUint32(dirOff + 16, 0, false); // origChecksum (unused)

    out.set(s, off);
  }

  return out;
}

/** Read a big-endian uint32 from a Uint8Array. */
function readU32(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(offset, false);
}

// A recognisable cmap payload.
const cmapData = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef]);
const TRUETYPE_FLAVOR = 0x00010000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isWoff / isWoff2', () => {
  it('detects a WOFF1 signature', () => {
    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'cmap', data: cmapData, compress: false },
    ]);
    expect(isWoff(woff)).toBe(true);
    expect(isWoff2(woff)).toBe(false);
  });

  it('detects a WOFF2 signature', () => {
    const woff2 = new Uint8Array(WOFF_HEADER_SIZE);
    const view = new DataView(woff2.buffer);
    view.setUint32(0, tagToUint32('wOF2'), false);
    expect(isWoff2(woff2)).toBe(true);
    expect(isWoff(woff2)).toBe(false);
  });

  it('rejects non-WOFF data', () => {
    const ttf = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
    expect(isWoff(ttf)).toBe(false);
    expect(isWoff2(ttf)).toBe(false);
  });

  it('returns false for buffers shorter than four bytes', () => {
    expect(isWoff(new Uint8Array([0x77, 0x4f]))).toBe(false);
    expect(isWoff2(new Uint8Array([]))).toBe(false);
  });
});

describe('readWoffHeader', () => {
  it('parses numTables and flavor for WOFF1', () => {
    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'cmap', data: cmapData, compress: false },
      { tag: 'glyf', data: new Uint8Array([1, 2, 3, 4]), compress: false },
    ]);
    const info: WoffInfo = readWoffHeader(woff);
    expect(info.signature).toBe('wOFF');
    expect(info.flavor).toBe(TRUETYPE_FLAVOR);
    expect(info.numTables).toBe(2);
    expect(info.totalSfntSize).toBeGreaterThan(0);
  });

  it('recognises a WOFF2 header', () => {
    const woff2 = new Uint8Array(WOFF_HEADER_SIZE);
    const view = new DataView(woff2.buffer);
    view.setUint32(0, tagToUint32('wOF2'), false);
    view.setUint32(4, 0x4f54544f, false); // 'OTTO'
    view.setUint16(12, 5, false); // numTables
    view.setUint32(16, 1234, false); // totalSfntSize
    const info: WoffInfo = readWoffHeader(woff2);
    expect(info.signature).toBe('wOF2');
    expect(info.flavor).toBe(0x4f54544f);
    expect(info.numTables).toBe(5);
    expect(info.totalSfntSize).toBe(1234);
  });

  it('throws for data too small for a header', () => {
    expect(() => readWoffHeader(new Uint8Array(10))).toThrow();
  });

  it('throws for an unknown signature', () => {
    expect(() => readWoffHeader(new Uint8Array(WOFF_HEADER_SIZE))).toThrow();
  });
});

describe('decodeWoff (WOFF1)', () => {
  it('reconstructs a valid sfnt whose first 4 bytes are the flavor', () => {
    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'cmap', data: cmapData, compress: false },
    ]);
    const sfnt = decodeWoff(woff);

    // First 4 bytes = sfnt version (the flavor).
    expect(readU32(sfnt, 0)).toBe(TRUETYPE_FLAVOR);
    // numTables in the sfnt offset table.
    const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
    expect(view.getUint16(4, false)).toBe(1);
  });

  it('places the cmap table data into the reconstructed sfnt', () => {
    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'cmap', data: cmapData, compress: false },
    ]);
    const sfnt = decodeWoff(woff);

    // The single table record sits right after the 12-byte header.
    const recordOffset = SFNT_HEADER_SIZE;
    expect(readU32(sfnt, recordOffset)).toBe(tagToUint32('cmap'));
    const dataOffset = readU32(sfnt, recordOffset + 8);
    const dataLength = readU32(sfnt, recordOffset + 12);
    expect(dataLength).toBe(cmapData.length);

    const extracted = sfnt.subarray(dataOffset, dataOffset + dataLength);
    expect(Array.from(extracted)).toEqual(Array.from(cmapData));
  });

  it('inflates a zlib-compressed table', () => {
    // Use a payload large enough that zlib actually shrinks/changes it.
    const big = new Uint8Array(64);
    for (let i = 0; i < big.length; i++) big[i] = i & 0x0f;

    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'cmap', data: big, compress: true },
    ]);
    const sfnt = decodeWoff(woff);

    const recordOffset = SFNT_HEADER_SIZE;
    const dataOffset = readU32(sfnt, recordOffset + 8);
    const dataLength = readU32(sfnt, recordOffset + 12);
    expect(dataLength).toBe(big.length);
    const extracted = sfnt.subarray(dataOffset, dataOffset + dataLength);
    expect(Array.from(extracted)).toEqual(Array.from(big));
  });

  it('sorts table records by tag', () => {
    const woff = buildWoff1(TRUETYPE_FLAVOR, [
      { tag: 'glyf', data: new Uint8Array([9, 9, 9, 9]), compress: false },
      { tag: 'cmap', data: cmapData, compress: false },
    ]);
    const sfnt = decodeWoff(woff);

    // 'cmap' < 'glyf', so cmap must come first.
    expect(readU32(sfnt, SFNT_HEADER_SIZE)).toBe(tagToUint32('cmap'));
    expect(readU32(sfnt, SFNT_HEADER_SIZE + SFNT_RECORD_SIZE)).toBe(
      tagToUint32('glyf'),
    );
  });

  it('throws a clear error for WOFF2 input', () => {
    const woff2 = new Uint8Array(WOFF_HEADER_SIZE);
    const view = new DataView(woff2.buffer);
    view.setUint32(0, tagToUint32('wOF2'), false);
    expect(() => decodeWoff(woff2)).toThrow('WOFF2 decode not yet supported');
  });

  it('throws for non-WOFF input', () => {
    const ttf = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() => decodeWoff(ttf)).toThrow();
  });
});

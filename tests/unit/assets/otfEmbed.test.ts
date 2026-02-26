import { describe, it, expect } from 'vitest';
import { isOpenTypeCFF, isTrueType } from '../../../src/assets/font/otfDetect.js';
import { findTable } from '../../../src/assets/font/cffEmbed.js';

describe('isOpenTypeCFF', () => {
  it('returns true for OTTO magic bytes', () => {
    const data = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 0, 0, 0]);
    expect(isOpenTypeCFF(data)).toBe(true);
  });

  it('returns false for TrueType magic bytes', () => {
    const data = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
    expect(isOpenTypeCFF(data)).toBe(false);
  });

  it('returns false for data too short', () => {
    const data = new Uint8Array([0x4F, 0x54]);
    expect(isOpenTypeCFF(data)).toBe(false);
  });
});

describe('isTrueType', () => {
  it('returns true for standard TrueType magic', () => {
    const data = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
    expect(isTrueType(data)).toBe(true);
  });

  it('returns true for alternate "true" magic', () => {
    const data = new Uint8Array([0x74, 0x72, 0x75, 0x65, 0, 0, 0, 0]);
    expect(isTrueType(data)).toBe(true);
  });

  it('returns false for CFF magic', () => {
    const data = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 0, 0, 0]);
    expect(isTrueType(data)).toBe(false);
  });

  it('returns false for data too short', () => {
    const data = new Uint8Array([0x00]);
    expect(isTrueType(data)).toBe(false);
  });
});

describe('findTable', () => {
  it('returns undefined for data too short', () => {
    const data = new Uint8Array([0, 0, 0, 0]);
    expect(findTable(data, 'CFF ')).toBeUndefined();
  });

  it('finds a table in a valid font header', () => {
    // Build a minimal table directory with one table entry
    // OTTO magic (4 bytes) + numTables=1 (2 bytes) + searchRange (2) + entrySelector (2) + rangeShift (2) = 12 bytes header
    // Then one table record: tag (4) + checkSum (4) + offset (4) + length (4) = 16 bytes
    const data = new Uint8Array(28);
    // OTTO magic
    data[0] = 0x4F; data[1] = 0x54; data[2] = 0x54; data[3] = 0x4F;
    // numTables = 1
    data[4] = 0x00; data[5] = 0x01;
    // searchRange, entrySelector, rangeShift (don't matter for findTable)
    data[6] = 0; data[7] = 0; data[8] = 0; data[9] = 0; data[10] = 0; data[11] = 0;
    // Table record for "CFF "
    data[12] = 0x43; // C
    data[13] = 0x46; // F
    data[14] = 0x46; // F
    data[15] = 0x20; // space
    // checkSum (4 bytes) - don't matter
    data[16] = 0; data[17] = 0; data[18] = 0; data[19] = 0;
    // offset = 28 (0x0000001C)
    data[20] = 0x00; data[21] = 0x00; data[22] = 0x00; data[23] = 0x1C;
    // length = 100 (0x00000064)
    data[24] = 0x00; data[25] = 0x00; data[26] = 0x00; data[27] = 0x64;

    const result = findTable(data, 'CFF ');
    expect(result).toEqual({ offset: 28, length: 100 });
  });

  it('returns undefined for a table not present', () => {
    // Same minimal header but looking for "GPOS" which is not there
    const data = new Uint8Array(28);
    data[0] = 0x4F; data[1] = 0x54; data[2] = 0x54; data[3] = 0x4F;
    data[4] = 0x00; data[5] = 0x01;
    data[12] = 0x43; data[13] = 0x46; data[14] = 0x46; data[15] = 0x20; // "CFF "
    data[20] = 0x00; data[21] = 0x00; data[22] = 0x00; data[23] = 0x1C;
    data[24] = 0x00; data[25] = 0x00; data[26] = 0x00; data[27] = 0x64;

    expect(findTable(data, 'GPOS')).toBeUndefined();
  });
});

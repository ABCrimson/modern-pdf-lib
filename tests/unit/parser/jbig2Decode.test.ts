/**
 * Tests for basic JBIG2 decoding — segment header parsing, page
 * information processing, immediate generic region (MMR mode), and
 * error handling for unsupported segment types.
 */

import { describe, it, expect } from 'vitest';
import { decodeJBIG2 } from '../../../src/parser/jbig2Decode.js';
import {
  PdfDict,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a 32-bit big-endian unsigned integer into a byte array at the
 * given offset.
 */
function writeUint32BE(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/**
 * Write a 16-bit big-endian unsigned integer.
 */
function writeUint16BE(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/**
 * Build a minimal JBIG2 segment header.
 *
 * @param segmentNumber   - 4-byte segment number
 * @param segmentType     - 6-bit segment type (e.g. 48 for Page Info)
 * @param pageAssociation - 1-byte page association
 * @param dataLength      - 4-byte data length
 * @param referredCount   - Number of referred-to segments (0 for simple cases)
 */
function buildSegmentHeader(
  segmentNumber: number,
  segmentType: number,
  pageAssociation: number,
  dataLength: number,
  referredCount: number = 0,
): number[] {
  const header: number[] = [];

  // Segment number (4 bytes)
  writeUint32BE(header, 0, segmentNumber);

  // Flags byte: type in bits 0-5, page association size = small (bit 6 = 0)
  header[4] = segmentType & 0x3f;

  // Referred-to segment count and retention flags
  // For count < 5, it fits in 3 bits of byte 5
  header[5] = (referredCount & 0x07) << 5;

  // Page association (1 byte for small form)
  header[6] = pageAssociation & 0xff;

  // Data length (4 bytes)
  writeUint32BE(header, 7, dataLength);

  return header;
}

/**
 * Build a Page Information segment (type 48) with the given dimensions.
 * The data portion is 19 bytes.
 */
function buildPageInfoData(
  width: number,
  height: number,
  defaultPixel: number = 0,
  combinationOp: number = 0,
): number[] {
  const data: number[] = new Array(19).fill(0);
  writeUint32BE(data, 0, width);   // width
  writeUint32BE(data, 4, height);  // height
  writeUint32BE(data, 8, 72);      // x resolution (72 DPI)
  writeUint32BE(data, 12, 72);     // y resolution (72 DPI)
  // Flags: bits 2 = default pixel, bits 3-4 = combination operator
  data[16] = ((defaultPixel & 1) << 2) | ((combinationOp & 3) << 3);
  // Striping info (2 bytes)
  writeUint16BE(data, 17, 0);
  return data;
}

/**
 * Build an Immediate Generic Region segment header + data for MMR mode.
 *
 * The region information field is 17 bytes, followed by the generic
 * region flags and MMR-encoded bitmap data.
 */
function buildImmediateGenericRegionMMR(
  segmentNumber: number,
  pageAssociation: number,
  width: number,
  height: number,
  x: number,
  y: number,
  mmrData: Uint8Array,
  combinationOp: number = 0,
): { header: number[]; data: number[] } {
  // Region segment information field: 17 bytes
  const regionInfo: number[] = new Array(18).fill(0);
  writeUint32BE(regionInfo, 0, width);
  writeUint32BE(regionInfo, 4, height);
  writeUint32BE(regionInfo, 8, x);
  writeUint32BE(regionInfo, 12, y);
  regionInfo[16] = combinationOp & 0x07; // region flags
  // Generic region flags: bit 0 = MMR (1), bits 1-2 = template (0)
  regionInfo[17] = 0x01; // MMR = true

  const data: number[] = [...regionInfo];
  for (let i = 0; i < mmrData.length; i++) {
    data.push(mmrData[i]!);
  }

  const dataLength = data.length;
  const header = buildSegmentHeader(segmentNumber, 38, pageAssociation, dataLength);

  return { header, data };
}

/**
 * Build an End of Page segment (type 49).
 */
function buildEndOfPageSegment(segmentNumber: number, pageAssociation: number): number[] {
  return buildSegmentHeader(segmentNumber, 49, pageAssociation, 0);
}

/**
 * Pack a bit string into bytes (MSB first).
 */
function packBitString(bits: string): Uint8Array {
  const byteCount = Math.ceil(bits.length / 8);
  const result = new Uint8Array(byteCount);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = 7 - (i % 8);
      result[byteIdx] = (result[byteIdx]! | (1 << bitIdx)) & 0xff;
    }
  }
  return result;
}

// 2D (Group 4) mode codes for building MMR test data
const MODE_V0 = '1';
const MODE_HORIZONTAL = '001';
const EOL = '000000000001';
const EOFB = EOL + EOL;

// White/black Huffman codes for horizontal mode
const WHITE_0 = '00110101';
const WHITE_4 = '1011';
const WHITE_8 = '10011';
const BLACK_0 = '0000110111';
const BLACK_4 = '011';
const BLACK_8 = '000101';

/**
 * Assemble a complete JBIG2 stream from an array of (header, data) pairs.
 */
function assembleStream(segments: { header: number[]; data: number[] }[]): Uint8Array {
  const bytes: number[] = [];
  for (const seg of segments) {
    bytes.push(...seg.header, ...seg.data);
  }
  return new Uint8Array(bytes);
}

// ===========================================================================
// Basic JBIG2 segment parsing
// ===========================================================================

describe('JBIG2Decode segment parsing', () => {
  it('parses and processes a Page Information segment', () => {
    // Build: Page Info segment + End of Page segment
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    // Should not throw -- just parses successfully
    const result = decodeJBIG2(stream, null);
    // Page is 8 pixels wide, 1 pixel tall => 1 byte
    expect(result.length).toBe(1);
  });

  it('handles empty data gracefully', () => {
    const result = decodeJBIG2(new Uint8Array(0), null);
    expect(result.length).toBe(0);
  });

  it('throws a descriptive error for unsupported segment types', () => {
    // Symbol Dictionary segment (type 0)
    const header = buildSegmentHeader(0, 0, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('segment type 0');
    expect(() => decodeJBIG2(stream, null)).toThrow('SymbolDictionary');
  });

  it('throws for Immediate Text Region segment', () => {
    const header = buildSegmentHeader(0, 6, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('segment type 6');
    expect(() => decodeJBIG2(stream, null)).toThrow('ImmediateTextRegion');
  });
});

// ===========================================================================
// MMR (Group 4) generic region decoding
// ===========================================================================

describe('JBIG2Decode MMR generic region', () => {
  it('decodes an all-white 8x1 bitmap', () => {
    // Build Page Info
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Build MMR data for all-white line: V(0) + EOFB
    const mmrBits = MODE_V0 + EOFB;
    const mmrData = packBitString(mmrBits);

    // Build Immediate Generic Region (MMR)
    const region = buildImmediateGenericRegionMMR(1, 1, 8, 1, 0, 0, mmrData, 4); // op=4 (REPLACE)

    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      region,
      { header: eopHeader, data: [] },
    ]);

    const result = decodeJBIG2(stream, null);
    expect(result.length).toBe(1);
    // All white = all bits 0
    expect(result[0]).toBe(0x00);
  });

  it('decodes an all-black 8x1 bitmap using horizontal mode', () => {
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // MMR horizontal mode: white(0) + black(8)
    const mmrBits = MODE_HORIZONTAL + WHITE_0 + BLACK_8 + EOFB;
    const mmrData = packBitString(mmrBits);

    const region = buildImmediateGenericRegionMMR(1, 1, 8, 1, 0, 0, mmrData, 4);
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      region,
      { header: eopHeader, data: [] },
    ]);

    const result = decodeJBIG2(stream, null);
    expect(result.length).toBe(1);
    // All black = all bits 1
    expect(result[0]).toBe(0xff);
  });

  it('decodes a two-row all-white bitmap', () => {
    const pageInfoData = buildPageInfoData(8, 2);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Two rows of V(0) (each all-white) + EOFB
    const mmrBits = MODE_V0 + MODE_V0 + EOFB;
    const mmrData = packBitString(mmrBits);

    const region = buildImmediateGenericRegionMMR(1, 1, 8, 2, 0, 0, mmrData, 4);
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      region,
      { header: eopHeader, data: [] },
    ]);

    const result = decodeJBIG2(stream, null);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0x00);
  });
});

// ===========================================================================
// Page composition
// ===========================================================================

describe('JBIG2Decode page composition', () => {
  it('respects default pixel value (white)', () => {
    // Page with default pixel = 0 (white)
    const pageInfoData = buildPageInfoData(8, 1, 0);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    const result = decodeJBIG2(stream, null);
    expect(result.length).toBe(1);
    // Default pixel 0 = white, so the page should be all zeros
    expect(result[0]).toBe(0x00);
  });

  it('respects default pixel value (black)', () => {
    // Page with default pixel = 1 (black)
    const pageInfoData = buildPageInfoData(8, 1, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    const result = decodeJBIG2(stream, null);
    expect(result.length).toBe(1);
    // Default pixel 1 = black, so the page should be all ones
    expect(result[0]).toBe(0xff);
  });
});

// ===========================================================================
// JBIG2Globals support
// ===========================================================================

describe('JBIG2Decode globals support', () => {
  it('accepts null parms without error', () => {
    // Page Info + End of Page, no globals
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).not.toThrow();
  });

  it('accepts parms without JBIG2Globals', () => {
    const parms = new PdfDict();
    parms.set('/SomeOtherKey', PdfNumber.of(42));

    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, parms)).not.toThrow();
  });
});

// ===========================================================================
// File header detection
// ===========================================================================

describe('JBIG2Decode file header', () => {
  it('skips standalone JBIG2 file header if present', () => {
    // File header: 0x97 4A 42 32 0D 0A 1A 0A + flags(1) + pages(4)
    const fileHeader = [0x97, 0x4a, 0x42, 0x32, 0x0d, 0x0a, 0x1a, 0x0a];
    const flags = 0x00; // bit 0 = 0 means number of pages follows
    const numPages = [0x00, 0x00, 0x00, 0x01]; // 1 page

    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const bodyBytes = [...pageInfoHeader, ...pageInfoData, ...eopHeader];
    const fullStream = new Uint8Array([...fileHeader, flags, ...numPages, ...bodyBytes]);

    const result = decodeJBIG2(fullStream, null);
    expect(result.length).toBe(1);
  });
});

// ===========================================================================
// Error messages for unsupported segments
// ===========================================================================

describe('JBIG2Decode error messages', () => {
  it('includes segment type number in error', () => {
    // Type 22 = ImmediateHalftoneRegion
    const header = buildSegmentHeader(0, 22, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('22');
  });

  it('includes segment type name in error when known', () => {
    // Type 22 = ImmediateHalftoneRegion
    const header = buildSegmentHeader(0, 22, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('ImmediateHalftoneRegion');
  });

  it('handles unknown segment type gracefully in error', () => {
    // Use a non-standard segment type number
    const header = buildSegmentHeader(0, 55, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('55');
    expect(() => decodeJBIG2(stream, null)).toThrow('unknown');
  });

  it('provides JBIG2Decode prefix in error messages', () => {
    const header = buildSegmentHeader(0, 0, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('JBIG2Decode');
  });
});

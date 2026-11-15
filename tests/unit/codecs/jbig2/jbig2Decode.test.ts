/**
 * Tests for the JBIG2 entry point: decodeJBIG2 throws UnsupportedFilterError
 * for every input, including the segment streams the decoder used to turn
 * into bitmaps or into its own errors (each rewritten test keeps its input and
 * asserts the refusal).
 */

import { describe, it, expect } from 'vitest';
import { decodeJBIG2 } from '../../../../src/codecs/jbig2/jbig2Decode.js';
import { PdfDict, PdfNumber } from '../../../../src/core/pdfObjects.js';
import { UnsupportedFilterError } from '../../../../src/errors.js';

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
  writeUint32BE(data, 0, width); // width
  writeUint32BE(data, 4, height); // height
  writeUint32BE(data, 8, 72); // x resolution (72 DPI)
  writeUint32BE(data, 12, 72); // y resolution (72 DPI)
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
  it('input of "parses and processes a Page Information segment" is refused with UnsupportedFilterError', () => {
    // Build: Page Info segment + End of Page segment
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    // A page-information-only stream is refused like any other
    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles empty data gracefully" is refused with UnsupportedFilterError', () => {
    expect(() => decodeJBIG2(new Uint8Array(0), null)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for malformed Symbol Dictionary segment (too short)" is refused with UnsupportedFilterError', () => {
    // Symbol Dictionary segment (type 0) with too-short data
    const header = buildSegmentHeader(0, 0, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for malformed Immediate Text Region segment (too short)" is refused with UnsupportedFilterError', () => {
    const header = buildSegmentHeader(0, 6, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// MMR (Group 4) generic region decoding
// ===========================================================================

describe('JBIG2Decode MMR generic region', () => {
  it('input of "decodes an all-white 8x1 bitmap" is refused with UnsupportedFilterError', () => {
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

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "decodes an all-black 8x1 bitmap using horizontal mode" is refused with UnsupportedFilterError', () => {
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

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "decodes a two-row all-white bitmap" is refused with UnsupportedFilterError', () => {
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

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Page composition
// ===========================================================================

describe('JBIG2Decode page composition', () => {
  it('input of "respects default pixel value (white)" is refused with UnsupportedFilterError', () => {
    // Page with default pixel = 0 (white)
    const pageInfoData = buildPageInfoData(8, 1, 0);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "respects default pixel value (black)" is refused with UnsupportedFilterError', () => {
    // Page with default pixel = 1 (black)
    const pageInfoData = buildPageInfoData(8, 1, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// JBIG2Globals support
// ===========================================================================

describe('JBIG2Decode globals support', () => {
  it('input of "accepts null parms without error" is refused with UnsupportedFilterError', () => {
    // Page Info + End of Page, no globals
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "accepts parms without JBIG2Globals" is refused with UnsupportedFilterError', () => {
    const parms = new PdfDict();
    parms.set('/SomeOtherKey', PdfNumber.of(42));

    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, parms)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// File header detection
// ===========================================================================

describe('JBIG2Decode file header', () => {
  it('input of "skips standalone JBIG2 file header if present" is refused with UnsupportedFilterError', () => {
    // File header: 0x97 4A 42 32 0D 0A 1A 0A + flags(1) + pages(4)
    const fileHeader = [0x97, 0x4a, 0x42, 0x32, 0x0d, 0x0a, 0x1a, 0x0a];
    const flags = 0x00; // bit 0 = 0 means number of pages follows
    const numPages = [0x00, 0x00, 0x00, 0x01]; // 1 page

    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eopHeader = buildEndOfPageSegment(1, 1);

    const bodyBytes = [...pageInfoHeader, ...pageInfoData, ...eopHeader];
    const fullStream = new Uint8Array([...fileHeader, flags, ...numPages, ...bodyBytes]);

    expect(() => decodeJBIG2(fullStream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Error messages for unsupported segments
// ===========================================================================

describe('JBIG2Decode error messages', () => {
  it('input of "includes segment type number in error for truly unsupported types" is refused with UnsupportedFilterError', () => {
    // Type 55 is unknown/not in the standard
    const header = buildSegmentHeader(0, 55, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for malformed halftone region (too short)" is refused with UnsupportedFilterError', () => {
    // Type 22 = ImmediateHalftoneRegion — now supported but data too short
    const header = buildSegmentHeader(0, 22, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles unknown segment type gracefully in error" is refused with UnsupportedFilterError', () => {
    // Use a non-standard segment type number
    const header = buildSegmentHeader(0, 55, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('provides JBIG2Decode prefix in error messages', () => {
    const header = buildSegmentHeader(0, 0, 1, 4);
    const data = [0, 0, 0, 0];
    const stream = assembleStream([{ header, data }]);

    expect(() => decodeJBIG2(stream, null)).toThrow('JBIG2Decode');
  });
});

// ===========================================================================
// Symbol Dictionary + Text Region tests
// ===========================================================================

describe('JBIG2Decode symbol dictionary and text region', () => {
  it('input of "throws for Huffman-coded symbol dictionary" is refused with UnsupportedFilterError', () => {
    // Build Page Info
    const pageInfoData = buildPageInfoData(8, 8);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Symbol Dictionary segment (type 0) with Huffman flag set
    const sdData: number[] = new Array(20).fill(0);
    // SD flags (2 bytes): bit 0 = Huffman (1)
    sdData[0] = 0x00;
    sdData[1] = 0x01; // sdHuff = 1
    // Rest of data: AT pixels, numExported, numNew (all zeros)
    writeUint32BE(sdData, 10, 0); // numExported
    writeUint32BE(sdData, 14, 0); // numNew

    const sdHeader = buildSegmentHeader(1, 0, 1, sdData.length);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: sdHeader, data: sdData },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for Huffman-coded text region" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 8);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Text Region segment (type 6) with Huffman flag set
    const trData: number[] = new Array(24).fill(0);
    // Region info (17 bytes)
    writeUint32BE(trData, 0, 8); // width
    writeUint32BE(trData, 4, 8); // height
    writeUint32BE(trData, 8, 0); // x
    writeUint32BE(trData, 12, 0); // y
    trData[16] = 0x00; // region flags
    // Text region flags (2 bytes, big-endian): bit 0 = Huffman (1)
    trData[17] = 0x00;
    trData[18] = 0x01;
    // numInstances (4 bytes)
    writeUint32BE(trData, 19, 0);

    const trHeader = buildSegmentHeader(1, 6, 1, trData.length);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: trHeader, data: trData },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles text region with no symbols gracefully" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 8);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Text Region segment (type 6) with 0 instances and no referred-to segments
    const trData: number[] = new Array(30).fill(0);
    writeUint32BE(trData, 0, 8); // width
    writeUint32BE(trData, 4, 8); // height
    writeUint32BE(trData, 8, 0); // x
    writeUint32BE(trData, 12, 0); // y
    trData[16] = 0x04; // combination operator = REPLACE
    // Text region flags: all 0 (arithmetic, no refine, etc.)
    trData[17] = 0x00;
    trData[18] = 0x00;
    writeUint32BE(trData, 19, 0); // 0 instances

    const trHeader = buildSegmentHeader(1, 6, 1, trData.length);
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: trHeader, data: trData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Pattern Dictionary tests
// ===========================================================================

describe('JBIG2Decode pattern dictionary', () => {
  it('input of "throws for too-short pattern dictionary" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 8);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    const pdHeader = buildSegmentHeader(1, 16, 1, 4);
    const pdData = [0, 0, 0, 0];

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: pdHeader, data: pdData },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Generic Refinement Region tests
// ===========================================================================

describe('JBIG2Decode generic refinement region', () => {
  it('input of "throws for too-short refinement region" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 8);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    const refHeader = buildSegmentHeader(1, 42, 1, 4);
    const refData = [0, 0, 0, 0];

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: refHeader, data: refData },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

// ===========================================================================
// Segment type coverage
// ===========================================================================

describe('JBIG2Decode segment type coverage', () => {
  it('input of "accepts End of Stripe segment (type 50)" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const eosHeader = buildSegmentHeader(1, 50, 1, 0);
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: eosHeader, data: [] },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "accepts Profiles segment (type 52)" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const profileHeader = buildSegmentHeader(1, 52, 1, 4);
    const profileData = [0, 0, 0, 0];
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: profileHeader, data: profileData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "accepts Extension segment (type 62)" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);
    const extHeader = buildSegmentHeader(1, 62, 1, 4);
    const extData = [0, 0, 0, 0];
    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      { header: extHeader, data: extData },
      { header: eopHeader, data: [] },
    ]);

    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles intermediate generic region (type 36) by storing it" is refused with UnsupportedFilterError', () => {
    const pageInfoData = buildPageInfoData(8, 1);
    const pageInfoHeader = buildSegmentHeader(0, 48, 1, pageInfoData.length);

    // Type 36 = Intermediate Generic Region, stored for later reference
    const mmrBits = MODE_V0 + EOFB;
    const mmrData = packBitString(mmrBits);
    const region = buildImmediateGenericRegionMMR(1, 1, 8, 1, 0, 0, mmrData, 4);
    // Change segment type to 36 (intermediate)
    region.header[4] = 36;

    const eopHeader = buildEndOfPageSegment(2, 1);

    const stream = assembleStream([
      { header: pageInfoHeader, data: pageInfoData },
      region,
      { header: eopHeader, data: [] },
    ]);

    // An intermediate region segment is refused like any other
    expect(() => decodeJBIG2(stream, null)).toThrow(UnsupportedFilterError);
  });
});

describe('decodeJBIG2: the error carries its class, code and filter', () => {
  it('decodeJBIG2 throws UnsupportedFilterError with its code and filter', () => {
    expect(() => decodeJBIG2(new Uint8Array(0), null)).toThrow(
      expect.objectContaining({
        name: 'UnsupportedFilterError',
        code: 'unsupported-filter',
        filter: 'JBIG2Decode',
      }),
    );
  });
});

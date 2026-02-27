/**
 * Tests for CCITT fax decoding — Group 3 (1D and 2D) and Group 4
 * decompression as used by the PDF CCITTFaxDecode filter.
 *
 * Test vectors are constructed by hand-encoding known scanlines using
 * the Modified Huffman code tables from ITU-T T.4 and T.6.
 */

import { describe, it, expect } from 'vitest';
import { decodeStream } from '../../../src/parser/streamDecode.js';
import {
  PdfDict,
  PdfNumber,
  PdfBool,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a PdfDict with CCITT decode parameters. */
function ccittParms(entries: Record<string, number | boolean>): PdfDict {
  const dict = new PdfDict();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === 'boolean') {
      dict.set(key, PdfBool.of(value));
    } else {
      dict.set(key, PdfNumber.of(value));
    }
  }
  return dict;
}

/**
 * Pack a sequence of bits (given as a string of '0' and '1') into a
 * Uint8Array, MSB first, zero-padded at the end.
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

/**
 * Extract a specific bit from a byte array.
 * Returns 0 or 1. MSB first within each byte.
 */
function getBit(data: Uint8Array, bitIndex: number): number {
  const byteIdx = Math.floor(bitIndex / 8);
  const bitIdx = 7 - (bitIndex % 8);
  if (byteIdx >= data.length) return 0;
  return (data[byteIdx]! >>> bitIdx) & 1;
}

// ---------------------------------------------------------------------------
// CCITT code references for building test vectors
// ---------------------------------------------------------------------------

// White terminating codes (run length -> bit pattern string)
const WHITE_CODES: Record<number, string> = {
  0: '00110101',
  1: '000111',
  2: '0111',
  3: '1000',
  4: '1011',
  5: '1100',
  6: '1110',
  7: '1111',
  8: '10011',
  9: '10100',
  10: '00111',
  11: '01000',
  12: '001000',
  13: '000011',
  14: '110100',
  15: '110101',
  16: '101010',
  17: '101011',
  18: '0100111',
  19: '0001100',
  20: '0001000',
  21: '0010111',
  22: '0000011',
  23: '0000100',
  24: '0101000',
  25: '0101011',
  26: '0010011',
  27: '0100100',
  28: '0011000',
  29: '00000010',
  30: '00000011',
  31: '00011010',
  32: '00011011',
  63: '00110100',
};

// White make-up codes
const WHITE_MAKEUP_CODES: Record<number, string> = {
  64: '11011',
  128: '10010',
  192: '010111',
  256: '0110111',
  320: '00110110',
  384: '00110111',
  448: '01100100',
  512: '01100101',
  576: '01101000',
  640: '01100111',
  1728: '010011011',
};

// Black terminating codes
const BLACK_CODES: Record<number, string> = {
  0: '0000110111',
  1: '010',
  2: '11',
  3: '10',
  4: '011',
  5: '0011',
  6: '0010',
  7: '00011',
  8: '000101',
  9: '000100',
  10: '0000100',
  11: '0000101',
  12: '0000111',
  13: '00000100',
  14: '00000111',
  15: '000011000',
  16: '0000010111',
  63: '000001100111',
};

// Black make-up codes
const BLACK_MAKEUP_CODES: Record<number, string> = {
  64: '0000001111',
  128: '000011001000',
  192: '000011001001',
};

// 2D mode codes
const MODE_PASS = '0001';
const MODE_HORIZONTAL = '001';
const MODE_V0 = '1';
const MODE_VR1 = '011';
const MODE_VL1 = '010';
const MODE_VR2 = '000011';
const MODE_VL2 = '000010';
const MODE_VR3 = '0000011';
const MODE_VL3 = '0000010';

// EOL code (12 bits)
const EOL = '000000000001';

// EOFB for Group 4 (two consecutive EOL codes)
const EOFB = EOL + EOL;

/**
 * Encode a single Group 3 1D scanline as a bit string.
 * Takes an array of alternating white/black run lengths.
 * First run is always white.
 */
function encodeGroup3Line(runs: number[]): string {
  let bits = '';
  let isWhite = true;

  for (const run of runs) {
    if (isWhite) {
      bits += encodeWhiteRun(run);
    } else {
      bits += encodeBlackRun(run);
    }
    isWhite = !isWhite;
  }

  return bits;
}

function encodeWhiteRun(run: number): string {
  let bits = '';
  let remaining = run;

  // Make-up codes (multiples of 64)
  while (remaining >= 64) {
    const makeupLen = Math.min(remaining - (remaining % 64), 1728);
    const lookup = remaining - (remaining % 64);
    // Find the largest make-up code <= remaining
    const makeupValues = [1728, 640, 576, 512, 448, 384, 320, 256, 192, 128, 64];
    for (const mv of makeupValues) {
      if (mv <= remaining) {
        const code = WHITE_MAKEUP_CODES[mv];
        if (code) {
          bits += code;
          remaining -= mv;
          break;
        }
      }
    }
    if (remaining >= 64) {
      // Safety: if we didn't find a code, break to avoid infinite loop
      break;
    }
  }

  // Terminating code
  const termCode = WHITE_CODES[remaining];
  if (termCode) {
    bits += termCode;
  } else {
    throw new Error(`No white terminating code for run length ${remaining}`);
  }

  return bits;
}

function encodeBlackRun(run: number): string {
  let bits = '';
  let remaining = run;

  // Make-up codes
  while (remaining >= 64) {
    const makeupValues = [192, 128, 64];
    let found = false;
    for (const mv of makeupValues) {
      if (mv <= remaining) {
        const code = BLACK_MAKEUP_CODES[mv];
        if (code) {
          bits += code;
          remaining -= mv;
          found = true;
          break;
        }
      }
    }
    if (!found) break;
  }

  // Terminating code
  const termCode = BLACK_CODES[remaining];
  if (termCode) {
    bits += termCode;
  } else {
    throw new Error(`No black terminating code for run length ${remaining}`);
  }

  return bits;
}

// ===========================================================================
// CCITTFaxDecode filter integration (via decodeStream)
// ===========================================================================

describe('CCITTFaxDecode filter integration', () => {
  it('is dispatched via the CCF abbreviation', () => {
    // CCF is the standard abbreviation for CCITTFaxDecode
    // Encode a simple 8-pixel all-white line, Group 3 1D
    const bits = encodeGroup3Line([8]); // 8 white pixels
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCF', parms);
    expect(result.length).toBe(1); // 8 pixels = 1 byte
  });
});

// ===========================================================================
// Group 3 1D (K=0)
// ===========================================================================

describe('CCITTFaxDecode Group 3 1D (K=0)', () => {
  it('decodes an all-white scanline (8 pixels)', () => {
    // All-white line: white run of 8, black run of 0
    // White 8 = 10011
    // The line should be: 8 white pixels = 0x00 with BlackIs1=true
    // Or 0xFF with BlackIs1=false (default)
    const bits = encodeGroup3Line([8]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    // BlackIs1=true: white=0, black=1. All white => all bits 0
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x00);
  });

  it('decodes an all-white scanline with BlackIs1=false (default)', () => {
    const bits = encodeGroup3Line([8]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': false,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    // BlackIs1=false: white=1 in output. All white => all bits 1
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xff);
  });

  it('decodes a scanline with white and black runs', () => {
    // 8-pixel line: 3 white, 2 black, 3 white
    // Internal pixel pattern: [0,0,0,1,1,0,0,0]
    // With BlackIs1=true: bits are 0,0,0,1,1,0,0,0 = 0x18
    const bits = encodeGroup3Line([3, 2, 3]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x18); // 00011000
  });

  it('decodes multiple scanlines', () => {
    // Two 8-pixel lines
    // Line 1: all white (8 white)
    // Line 2: all black (0 white, 8 black)
    const line1 = encodeGroup3Line([8]);
    const line2 = encodeGroup3Line([0, 8]);
    const bits = line1 + line2;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 2,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0x00); // all white
    expect(result[1]).toBe(0xff); // all black
  });

  it('decodes a 16-pixel wide scanline', () => {
    // 16 pixels: 4 white, 8 black, 4 white
    // Internal: 0000 11111111 0000
    // BlackIs1=true packed: 0000 1111 1111 0000 = 0x0F 0xF0
    const bits = encodeGroup3Line([4, 8, 4]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 16,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0x0f); // 00001111
    expect(result[1]).toBe(0xf0); // 11110000
  });

  it('decodes all-black scanline', () => {
    // 8-pixel all-black: 0 white, 8 black
    const bits = encodeGroup3Line([0, 8]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xff);
  });

  it('handles a single black pixel in 8 white pixels', () => {
    // 8 pixels: 3 white, 1 black, 4 white
    // Internal: [0,0,0,1,0,0,0,0]
    // BlackIs1=true: 00010000 = 0x10
    const bits = encodeGroup3Line([3, 1, 4]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x10);
  });
});

// ===========================================================================
// Group 4 (K<0)
// ===========================================================================

describe('CCITTFaxDecode Group 4 (K<0)', () => {
  it('decodes an all-white line using vertical mode', () => {
    // Group 4: reference line is all-white.
    // For an all-white coding line, we need to encode that a0 goes
    // from 0 to end-of-line with the same color pattern as reference.
    //
    // With reference line all-white and coding line all-white:
    // b1 = columns (no changing element opposite to white in ref)
    // V(0) mode: a1 = b1 = columns
    // So a single V(0) = "1" should encode the full line.
    //
    // After V(0), a0 = columns, loop ends.
    // Then EOFB to terminate.

    const bits = MODE_V0 + EOFB;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    // All white with BlackIs1=true => 0x00
    expect(result[0]).toBe(0x00);
  });

  it('decodes a line with horizontal mode (white then black)', () => {
    // Group 4: reference line all-white, coding line has some black.
    // Horizontal mode encodes two runs using 1D Huffman codes.
    //
    // Coding line: 4 white, 4 black (8 pixels total)
    // Horizontal mode: 001 + white(4) + black(4)
    // White 4 = 1011, Black 4 = 011
    // Total: 001 1011 011 + EOFB

    const bits = MODE_HORIZONTAL + WHITE_CODES[4]! + BLACK_CODES[4]! + EOFB;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    // 4 white (0) then 4 black (1): 00001111 = 0x0F
    expect(result[0]).toBe(0x0f);
  });

  it('decodes multiple rows in Group 4', () => {
    // Row 1: all white (V(0) against all-white reference)
    // Row 2: all white (V(0) against all-white row 1)
    const bits = MODE_V0 + MODE_V0 + EOFB;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 2,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0x00);
  });

  it('decodes with EndOfBlock=false using Rows to determine count', () => {
    // With EndOfBlock=false, the decoder uses the Rows count
    const bits = MODE_V0;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x00);
  });

  it('handles horizontal mode for all-black line', () => {
    // All-black line: horizontal mode with white(0) + black(8)
    const bits = MODE_HORIZONTAL + WHITE_CODES[0]! + BLACK_CODES[8]! + EOFB;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xff);
  });
});

// ===========================================================================
// Parameter handling
// ===========================================================================

describe('CCITTFaxDecode parameter handling', () => {
  it('uses default Columns=1728 when not specified', () => {
    // Just make sure it doesn't crash with default width
    // Encode a simple V(0) for all-white
    const bits = MODE_V0 + EOFB;
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': -1,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    // 1728 pixels = 216 bytes
    expect(result.length).toBe(216);
  });

  it('works with null parameters (defaults)', () => {
    // With null parms, defaults: K=0 (Group 3 1D), Columns=1728
    // Encode an all-white Group 3 1D line for 1728 columns
    const bits = WHITE_MAKEUP_CODES[1728]! + WHITE_CODES[0]!;
    const encoded = packBitString(bits);

    const result = decodeStream(encoded, 'CCITTFaxDecode', null);
    // Should produce 1728/8 = 216 bytes for 1 row
    expect(result.length).toBe(216);
  });

  it('handles BlackIs1 flag correctly', () => {
    // Same encoded data, different BlackIs1 settings
    const bits = encodeGroup3Line([8]); // all white
    const encoded = packBitString(bits);

    const parmsTrue = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const parmsFalse = ccittParms({
      '/K': 0,
      '/Columns': 8,
      '/Rows': 1,
      '/BlackIs1': false,
      '/EndOfBlock': false,
    });

    const resultTrue = decodeStream(encoded, 'CCITTFaxDecode', parmsTrue);
    const resultFalse = decodeStream(encoded, 'CCITTFaxDecode', parmsFalse);

    // BlackIs1=true: white=0 -> 0x00
    // BlackIs1=false: white=1 -> 0xFF
    expect(resultTrue[0]).toBe(0x00);
    expect(resultFalse[0]).toBe(0xff);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('CCITTFaxDecode edge cases', () => {
  it('handles empty data gracefully', () => {
    const parms = ccittParms({
      '/K': -1,
      '/Columns': 8,
      '/Rows': 0,
      '/BlackIs1': true,
      '/EndOfBlock': true,
    });

    const result = decodeStream(new Uint8Array(0), 'CCITTFaxDecode', parms);
    expect(result.length).toBe(0);
  });

  it('handles 1-pixel wide image', () => {
    // 1 pixel wide, all white
    const bits = encodeGroup3Line([1]);
    const encoded = packBitString(bits);

    const parms = ccittParms({
      '/K': 0,
      '/Columns': 1,
      '/Rows': 1,
      '/BlackIs1': true,
      '/EndOfBlock': false,
    });

    const result = decodeStream(encoded, 'CCITTFaxDecode', parms);
    expect(result.length).toBe(1);
    // Single white pixel, BlackIs1=true => bit 7 = 0
    expect(result[0]! & 0x80).toBe(0x00);
  });
});

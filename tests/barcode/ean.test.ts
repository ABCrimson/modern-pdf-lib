import { describe, it, expect } from 'vitest';
import {
  encodeEan13,
  encodeEan8,
  calculateEanCheckDigit,
  ean13ToOperators,
  ean8ToOperators,
} from '../../src/barcode/ean.js';
import { rgb } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// EAN check-digit calculation
// ---------------------------------------------------------------------------

describe('calculateEanCheckDigit', () => {
  it('calculates EAN-13 check digit for 590123412345', () => {
    // 5901234123457 is a well-known example
    expect(calculateEanCheckDigit('590123412345')).toBe(7);
  });

  it('calculates EAN-13 check digit for 400599987000', () => {
    // 4005999870005: check digit is 5
    expect(calculateEanCheckDigit('400599987000')).toBe(5);
  });

  it('calculates EAN-13 check digit for 000000000000', () => {
    expect(calculateEanCheckDigit('000000000000')).toBe(0);
  });

  it('calculates EAN-8 check digit for 9638507', () => {
    // 96385074 is a known EAN-8
    expect(calculateEanCheckDigit('9638507')).toBe(4);
  });

  it('calculates EAN-8 check digit for 5512345', () => {
    // 55123457 check digit = 7
    expect(calculateEanCheckDigit('5512345')).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// EAN-13 encoding
// ---------------------------------------------------------------------------

describe('encodeEan13', () => {
  it('produces 95 modules', () => {
    const matrix = encodeEan13('590123412345');
    // 3 (start) + 42 (6 left digits * 7) + 5 (center) + 42 (6 right digits * 7) + 3 (end) = 95
    expect(matrix.width).toBe(95);
    expect(matrix.modules.length).toBe(95);
  });

  it('starts with start guard pattern 101', () => {
    const matrix = encodeEan13('590123412345');
    expect(matrix.modules[0]).toBe(true);  // 1
    expect(matrix.modules[1]).toBe(false); // 0
    expect(matrix.modules[2]).toBe(true);  // 1
  });

  it('has correct center guard pattern 01010', () => {
    const matrix = encodeEan13('590123412345');
    // Center guard starts at position: 3 (start) + 42 (left digits) = 45
    expect(matrix.modules[45]).toBe(false); // 0
    expect(matrix.modules[46]).toBe(true);  // 1
    expect(matrix.modules[47]).toBe(false); // 0
    expect(matrix.modules[48]).toBe(true);  // 1
    expect(matrix.modules[49]).toBe(false); // 0
  });

  it('ends with end guard pattern 101', () => {
    const matrix = encodeEan13('590123412345');
    expect(matrix.modules[92]).toBe(true);  // 1
    expect(matrix.modules[93]).toBe(false); // 0
    expect(matrix.modules[94]).toBe(true);  // 1
  });

  it('accepts 13-digit input with valid check digit', () => {
    const matrix = encodeEan13('5901234123457');
    expect(matrix.width).toBe(95);
  });

  it('throws on invalid check digit', () => {
    expect(() => encodeEan13('5901234123450')).toThrow(/check digit mismatch/);
  });

  it('throws on invalid length', () => {
    expect(() => encodeEan13('123')).toThrow(/12 or 13 digits/);
    expect(() => encodeEan13('12345678901234')).toThrow(/12 or 13 digits/);
  });

  it('throws on non-numeric input', () => {
    expect(() => encodeEan13('59012341234a')).toThrow(/only digits/);
  });

  it('correctly encodes known barcode 5901234123457', () => {
    // This is a well-known EAN-13 barcode.  We verify the full module
    // pattern by checking the start, first left digit encoding, and end.
    const matrix = encodeEan13('5901234123457');
    expect(matrix.width).toBe(95);

    // First digit is 5, so parity pattern is LGGLLG.
    // The first encoded digit (left side position 0) is digit 9 with L pattern.
    // L pattern for 9 is: 0001011
    // Start guard (101) + L-9 pattern (0001011):
    const expectedStart = [
      true, false, true,        // start guard
      false, false, false, true, false, true, true, // L pattern for 9
    ];
    for (let i = 0; i < expectedStart.length; i++) {
      expect(matrix.modules[i]).toBe(expectedStart[i]);
    }
  });

  it('auto-calculates check digit when 12 digits given', () => {
    // Both should produce the same encoding
    const m12 = encodeEan13('590123412345');
    const m13 = encodeEan13('5901234123457');
    expect(m12.modules).toEqual(m13.modules);
  });

  it('encodes EAN-13 with first digit 0 (matches UPC-A structure)', () => {
    const matrix = encodeEan13('0036000291452');
    expect(matrix.width).toBe(95);
    // First digit 0 -> parity LLLLLL -> all left digits use L patterns
    // Digit data[1] = 0, L pattern for 0: 0001101
    expect(matrix.modules[3]).toBe(false);  // 0
    expect(matrix.modules[4]).toBe(false);  // 0
    expect(matrix.modules[5]).toBe(false);  // 0
    expect(matrix.modules[6]).toBe(true);   // 1
    expect(matrix.modules[7]).toBe(true);   // 1
    expect(matrix.modules[8]).toBe(false);  // 0
    expect(matrix.modules[9]).toBe(true);   // 1
  });
});

// ---------------------------------------------------------------------------
// EAN-8 encoding
// ---------------------------------------------------------------------------

describe('encodeEan8', () => {
  it('produces 67 modules', () => {
    const matrix = encodeEan8('9638507');
    // 3 (start) + 28 (4 left digits * 7) + 5 (center) + 28 (4 right digits * 7) + 3 (end) = 67
    expect(matrix.width).toBe(67);
    expect(matrix.modules.length).toBe(67);
  });

  it('starts with start guard pattern 101', () => {
    const matrix = encodeEan8('9638507');
    expect(matrix.modules[0]).toBe(true);
    expect(matrix.modules[1]).toBe(false);
    expect(matrix.modules[2]).toBe(true);
  });

  it('has correct center guard pattern 01010', () => {
    const matrix = encodeEan8('9638507');
    // Center guard starts at: 3 (start) + 28 (4 left digits) = 31
    expect(matrix.modules[31]).toBe(false);
    expect(matrix.modules[32]).toBe(true);
    expect(matrix.modules[33]).toBe(false);
    expect(matrix.modules[34]).toBe(true);
    expect(matrix.modules[35]).toBe(false);
  });

  it('ends with end guard pattern 101', () => {
    const matrix = encodeEan8('9638507');
    expect(matrix.modules[64]).toBe(true);
    expect(matrix.modules[65]).toBe(false);
    expect(matrix.modules[66]).toBe(true);
  });

  it('calculates check digit for 7-digit input', () => {
    const matrix = encodeEan8('9638507');
    expect(matrix.width).toBe(67);
  });

  it('validates check digit for 8-digit input', () => {
    const matrix = encodeEan8('96385074');
    expect(matrix.width).toBe(67);
  });

  it('throws on invalid check digit', () => {
    expect(() => encodeEan8('96385070')).toThrow(/check digit mismatch/);
  });

  it('throws on invalid length', () => {
    expect(() => encodeEan8('123')).toThrow(/7 or 8 digits/);
    expect(() => encodeEan8('123456789')).toThrow(/7 or 8 digits/);
  });

  it('throws on non-numeric input', () => {
    expect(() => encodeEan8('963850a')).toThrow(/only digits/);
  });

  it('correctly encodes known barcode 96385074', () => {
    const m7 = encodeEan8('9638507');
    const m8 = encodeEan8('96385074');
    expect(m7.modules).toEqual(m8.modules);
  });

  it('left digits always use L patterns', () => {
    const matrix = encodeEan8('96385074');
    // First left digit is 9, L pattern for 9: 0001011
    expect(matrix.modules[3]).toBe(false);
    expect(matrix.modules[4]).toBe(false);
    expect(matrix.modules[5]).toBe(false);
    expect(matrix.modules[6]).toBe(true);
    expect(matrix.modules[7]).toBe(false);
    expect(matrix.modules[8]).toBe(true);
    expect(matrix.modules[9]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

describe('ean13ToOperators', () => {
  it('generates valid PDF operators with default options', () => {
    const matrix = encodeEan13('590123412345');
    const ops = ean13ToOperators(matrix, 50, 700);
    expect(ops).toContain('q\n');   // saveState
    expect(ops).toContain('Q\n');   // restoreState
    expect(ops).toContain('re\n');  // rectangle
    expect(ops).toContain('f\n');   // fill
    expect(ops).toContain('0 g');   // default black
  });

  it('respects custom color option', () => {
    const matrix = encodeEan13('590123412345');
    const ops = ean13ToOperators(matrix, 50, 700, {
      color: rgb(1, 0, 0),
    });
    expect(ops).toContain('1 0 0 rg');
  });

  it('respects custom height and module width', () => {
    const matrix = encodeEan13('590123412345');
    const ops = ean13ToOperators(matrix, 0, 0, {
      height: 100,
      moduleWidth: 2,
      quietZone: 0,
    });
    // Height of 100 should appear in rectangle operators
    expect(ops).toContain('100 re');
  });
});

describe('ean8ToOperators', () => {
  it('generates valid PDF operators', () => {
    const matrix = encodeEan8('9638507');
    const ops = ean8ToOperators(matrix, 50, 700);
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
    expect(ops).toContain('re\n');
    expect(ops).toContain('f\n');
  });
});

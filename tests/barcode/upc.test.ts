import { describe, it, expect } from 'vitest';
import {
  encodeUpcA,
  calculateUpcCheckDigit,
  upcAToOperators,
} from '../../src/barcode/upc.js';
import { encodeEan13 } from '../../src/barcode/ean.js';
import { rgb } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// UPC-A check-digit calculation
// ---------------------------------------------------------------------------

describe('calculateUpcCheckDigit', () => {
  it('calculates check digit for 03600029145', () => {
    // 036000291452 is a well-known UPC-A barcode
    expect(calculateUpcCheckDigit('03600029145')).toBe(2);
  });

  it('calculates check digit for 01234567890', () => {
    expect(calculateUpcCheckDigit('01234567890')).toBe(5);
  });

  it('throws on non-numeric input', () => {
    expect(() => calculateUpcCheckDigit('0360002914a')).toThrow(/only digits/);
  });

  it('throws on wrong length', () => {
    expect(() => calculateUpcCheckDigit('12345')).toThrow(/11 digits/);
  });
});

// ---------------------------------------------------------------------------
// UPC-A encoding
// ---------------------------------------------------------------------------

describe('encodeUpcA', () => {
  it('produces 95 modules (same as EAN-13)', () => {
    const matrix = encodeUpcA('03600029145');
    expect(matrix.width).toBe(95);
    expect(matrix.modules.length).toBe(95);
  });

  it('validates check digit for 12-digit input', () => {
    const matrix = encodeUpcA('036000291452');
    expect(matrix.width).toBe(95);
  });

  it('throws on invalid check digit', () => {
    expect(() => encodeUpcA('036000291450')).toThrow(/check digit mismatch/);
  });

  it('throws on invalid length', () => {
    expect(() => encodeUpcA('123')).toThrow(/11 or 12 digits/);
    expect(() => encodeUpcA('1234567890123')).toThrow(/11 or 12 digits/);
  });

  it('throws on non-numeric input', () => {
    expect(() => encodeUpcA('0360002914a')).toThrow(/only digits/);
  });

  it('matches EAN-13 with leading 0', () => {
    // UPC-A "03600029145" should produce the same encoding as
    // EAN-13 "0036000291452" (leading 0 + UPC data + check digit)
    const upc = encodeUpcA('03600029145');
    const ean = encodeEan13('003600029145');
    expect(upc.modules).toEqual(ean.modules);
  });

  it('auto-calculates check digit when 11 digits given', () => {
    const m11 = encodeUpcA('03600029145');
    const m12 = encodeUpcA('036000291452');
    expect(m11.modules).toEqual(m12.modules);
  });

  it('encodes known barcode 012345678905', () => {
    // UPC-A 012345678905 is a standard test barcode
    const matrix = encodeUpcA('012345678905');
    expect(matrix.width).toBe(95);

    // Start guard
    expect(matrix.modules[0]).toBe(true);
    expect(matrix.modules[1]).toBe(false);
    expect(matrix.modules[2]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

describe('upcAToOperators', () => {
  it('generates valid PDF operators with default options', () => {
    const matrix = encodeUpcA('03600029145');
    const ops = upcAToOperators(matrix, 50, 700);
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
    expect(ops).toContain('re\n');
    expect(ops).toContain('f\n');
    expect(ops).toContain('0 g');
  });

  it('respects custom color option', () => {
    const matrix = encodeUpcA('03600029145');
    const ops = upcAToOperators(matrix, 50, 700, {
      color: rgb(0, 0, 1),
    });
    expect(ops).toContain('0 0 1 rg');
  });

  it('respects custom height and quiet zone', () => {
    const matrix = encodeUpcA('03600029145');
    const ops = upcAToOperators(matrix, 0, 0, {
      height: 75,
      moduleWidth: 1.5,
      quietZone: 5,
    });
    expect(ops).toContain('75 re');
  });
});

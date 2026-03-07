/**
 * Tests for barcode reader (round-trip verification).
 */

import { describe, it, expect } from 'vitest';
import {
  readCode128,
  readEan13,
  readEan8,
  readCode39,
  readBarcode,
} from '../../src/barcode/reader.js';
import { encodeCode128 } from '../../src/barcode/code128.js';
import { encodeEan13, encodeEan8 } from '../../src/barcode/ean.js';
import { encodeCode39 } from '../../src/barcode/code39.js';

describe('Barcode Reader', () => {
  // -----------------------------------------------------------------------
  // Code 128
  // -----------------------------------------------------------------------

  // 1. readCode128 decodes simple alpha data
  it('readCode128 decodes simple alphanumeric data', () => {
    const matrix = encodeCode128('ABC123');
    const result = readCode128(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('Code 128');
    expect(result.data).toBe('ABC123');
  });

  // 2. readCode128 validates check digit
  it('readCode128 validates check digit', () => {
    const matrix = encodeCode128('Hello');
    const result = readCode128(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.checkDigitValid).toBe(true);
    expect(result.data).toBe('Hello');
  });

  // 3. readCode128 decodes numeric-only data (Code C)
  it('readCode128 decodes numeric-only data via Code C', () => {
    const matrix = encodeCode128('123456');
    const result = readCode128(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.data).toBe('123456');
  });

  // 4. readCode128 returns invalid for corrupted modules
  it('readCode128 returns invalid for corrupted modules', () => {
    const result = readCode128([true, false, true, false, true]);
    expect(result.valid).toBe(false);
  });

  // -----------------------------------------------------------------------
  // EAN-13
  // -----------------------------------------------------------------------

  // 5. readEan13 decodes known barcode
  it('readEan13 decodes known EAN-13 barcode', () => {
    const matrix = encodeEan13('590123412345');
    const result = readEan13(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('EAN-13');
    // encodeEan13 appends the check digit, so the full 13-digit string is returned
    expect(result.data).toHaveLength(13);
    expect(result.data.startsWith('590123412345')).toBe(true);
  });

  // 6. readEan13 validates check digit
  it('readEan13 validates check digit', () => {
    const matrix = encodeEan13('590123412345');
    const result = readEan13(matrix.modules);
    expect(result.checkDigitValid).toBe(true);
  });

  // 7. readEan13 returns invalid for wrong-length modules
  it('readEan13 returns invalid for wrong-length modules', () => {
    const result = readEan13(new Array(90).fill(false));
    expect(result.valid).toBe(false);
  });

  // -----------------------------------------------------------------------
  // EAN-8
  // -----------------------------------------------------------------------

  // 8. readEan8 decodes known barcode
  it('readEan8 decodes known EAN-8 barcode', () => {
    const matrix = encodeEan8('1234567');
    const result = readEan8(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('EAN-8');
    expect(result.data).toHaveLength(8);
    expect(result.data.startsWith('1234567')).toBe(true);
  });

  // 9. readEan8 validates check digit
  it('readEan8 validates check digit', () => {
    const matrix = encodeEan8('1234567');
    const result = readEan8(matrix.modules);
    expect(result.checkDigitValid).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Code 39
  // -----------------------------------------------------------------------

  // 10. readCode39 decodes known data
  it('readCode39 decodes known data', () => {
    const matrix = encodeCode39('HELLO');
    const result = readCode39(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('Code 39');
    expect(result.data).toBe('HELLO');
  });

  // 11. readCode39 decodes alphanumeric data
  it('readCode39 decodes alphanumeric data', () => {
    const matrix = encodeCode39('ABC-123');
    const result = readCode39(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.data).toBe('ABC-123');
  });

  // -----------------------------------------------------------------------
  // Round-trip tests
  // -----------------------------------------------------------------------

  // 12. Round-trip: Code 128
  it('round-trip: encode then read Code 128 produces same data', () => {
    const testStrings = ['Test123', 'ABCDEF', '00112233'];
    for (const input of testStrings) {
      const matrix = encodeCode128(input);
      const result = readCode128(matrix.modules);
      expect(result.valid).toBe(true);
      expect(result.data).toBe(input);
    }
  });

  // 13. Round-trip: EAN-13
  it('round-trip: encode then read EAN-13 produces same data', () => {
    const inputs = ['401234567890', '978020113447'];
    for (const input of inputs) {
      const matrix = encodeEan13(input);
      const result = readEan13(matrix.modules);
      expect(result.valid).toBe(true);
      // The encoded matrix includes the check digit
      expect(result.data.slice(0, 12)).toBe(input);
      expect(result.checkDigitValid).toBe(true);
    }
  });

  // 14. Round-trip: EAN-8
  it('round-trip: encode then read EAN-8 produces same data', () => {
    const inputs = ['4567890', '9638527'];
    for (const input of inputs) {
      const matrix = encodeEan8(input);
      const result = readEan8(matrix.modules);
      expect(result.valid).toBe(true);
      expect(result.data.slice(0, 7)).toBe(input);
      expect(result.checkDigitValid).toBe(true);
    }
  });

  // 15. Round-trip: Code 39
  it('round-trip: encode then read Code 39 produces same data', () => {
    const inputs = ['HELLO WORLD', '12345', 'A.B-C'];
    for (const input of inputs) {
      const matrix = encodeCode39(input);
      const result = readCode39(matrix.modules);
      expect(result.valid).toBe(true);
      expect(result.data).toBe(input);
    }
  });

  // -----------------------------------------------------------------------
  // Auto-detect
  // -----------------------------------------------------------------------

  // 16. readBarcode auto-detects EAN-13
  it('readBarcode auto-detects EAN-13', () => {
    const matrix = encodeEan13('590123412345');
    const result = readBarcode(matrix.modules);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('EAN-13');
    expect(result!.valid).toBe(true);
  });

  // 17. readBarcode auto-detects EAN-8
  it('readBarcode auto-detects EAN-8', () => {
    const matrix = encodeEan8('1234567');
    const result = readBarcode(matrix.modules);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('EAN-8');
    expect(result!.valid).toBe(true);
  });

  // 18. readBarcode auto-detects Code 128
  it('readBarcode auto-detects Code 128', () => {
    const matrix = encodeCode128('AutoDetect');
    const result = readBarcode(matrix.modules);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('Code 128');
    expect(result!.data).toBe('AutoDetect');
  });

  // 19. readBarcode auto-detects Code 39
  it('readBarcode auto-detects Code 39', () => {
    const matrix = encodeCode39('DETECT');
    const result = readBarcode(matrix.modules);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('Code 39');
    expect(result!.data).toBe('DETECT');
  });

  // 20. readBarcode returns null for empty/invalid input
  it('readBarcode returns null for invalid modules', () => {
    const result = readBarcode([false, false, false, false, false]);
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  // 21. readCode128 with single character
  it('readCode128 handles single character', () => {
    const matrix = encodeCode128('A');
    const result = readCode128(matrix.modules);
    expect(result.valid).toBe(true);
    expect(result.data).toBe('A');
  });

  // 22. Empty modules return invalid
  it('returns invalid for empty module array', () => {
    expect(readCode128([]).valid).toBe(false);
    expect(readEan13([]).valid).toBe(false);
    expect(readEan8([]).valid).toBe(false);
    expect(readCode39([]).valid).toBe(false);
    expect(readBarcode([])).toBeNull();
  });
});

/**
 * Tests for Data Matrix ECC200 encoding and PDF operator generation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeDataMatrix,
  dataMatrixToOperators,
} from '../../src/barcode/dataMatrix.js';
import type { DataMatrixOptions, DataMatrixResult } from '../../src/barcode/dataMatrix.js';
import { rgb, grayscale } from '../../src/core/operators/color.js';

describe('Data Matrix ECC200', () => {
  // -----------------------------------------------------------------------
  // 1. encodeDataMatrix returns correct structure
  // -----------------------------------------------------------------------
  it('returns a DataMatrixResult with rows, cols, and modules', () => {
    const result = encodeDataMatrix('ABC');
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('cols');
    expect(result).toHaveProperty('modules');
    expect(result.modules.length).toBe(result.rows * result.cols);
    // All modules are boolean
    for (const mod of result.modules) {
      expect(typeof mod).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 2. Small data uses smallest size (10x10)
  // -----------------------------------------------------------------------
  it('uses smallest size (10x10) for short data', () => {
    // 'A' in ASCII mode = codeword 66, which is 1 codeword.
    // 10x10 holds 3 data codewords, so single char should fit.
    const result = encodeDataMatrix('A');
    expect(result.rows).toBe(10);
    expect(result.cols).toBe(10);
  });

  // -----------------------------------------------------------------------
  // 3. Larger data uses appropriate size
  // -----------------------------------------------------------------------
  it('selects larger sizes for more data', () => {
    const small = encodeDataMatrix('Hi');
    const medium = encodeDataMatrix('Hello, World! This is a test string.');
    expect(medium.rows).toBeGreaterThan(small.rows);
    expect(medium.cols).toBeGreaterThan(small.cols);
  });

  // -----------------------------------------------------------------------
  // 4. Has finder pattern (solid left and bottom edges)
  // -----------------------------------------------------------------------
  it('has solid finder pattern on left and bottom edges', () => {
    const result = encodeDataMatrix('Test');
    const { rows, cols, modules } = result;
    const get = (r: number, c: number) => modules[r * cols + c];

    // Bottom edge (last row) should be all dark
    for (let c = 0; c < cols; c++) {
      expect(get(rows - 1, c)).toBe(true);
    }

    // Left edge (first column) should be all dark
    for (let r = 0; r < rows; r++) {
      expect(get(r, 0)).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 5. Has clock pattern (alternating top and right edges)
  // -----------------------------------------------------------------------
  it('has alternating clock pattern on top and right edges', () => {
    const result = encodeDataMatrix('Test');
    const { rows, cols, modules } = result;
    const get = (r: number, c: number) => modules[r * cols + c];

    // Top edge (first row) should alternate: dark on even columns
    for (let c = 0; c < cols; c++) {
      expect(get(0, c)).toBe(c % 2 === 0);
    }

    // Right edge (last column) should alternate
    // The right edge alternates based on distance from bottom (even = dark)
    for (let r = 0; r < rows; r++) {
      const fromBottom = rows - 1 - r;
      expect(get(r, cols - 1)).toBe(fromBottom % 2 === 0);
    }
  });

  // -----------------------------------------------------------------------
  // 6. Handles alphanumeric data
  // -----------------------------------------------------------------------
  it('handles alphanumeric data', () => {
    const result = encodeDataMatrix('ABC123xyz');
    expect(result.rows).toBeGreaterThanOrEqual(10);
    expect(result.cols).toBeGreaterThanOrEqual(10);
    expect(result.modules.length).toBe(result.rows * result.cols);
  });

  // -----------------------------------------------------------------------
  // 7. Handles numeric-only data (digit pair encoding)
  // -----------------------------------------------------------------------
  it('handles numeric-only data efficiently', () => {
    // Digit pairs are encoded as a single codeword, so "1234" = 2 codewords
    // which should fit in the smallest 10x10 (3 data codewords)
    const result = encodeDataMatrix('1234');
    expect(result.rows).toBe(10);
    expect(result.cols).toBe(10);
  });

  // -----------------------------------------------------------------------
  // 8. Generates valid PDF operators
  // -----------------------------------------------------------------------
  it('generates valid PDF operators', () => {
    const matrix = encodeDataMatrix('PDF');
    const ops = dataMatrixToOperators(matrix, 50, 100);

    expect(ops).toContain('q\n');   // saveState
    expect(ops).toContain('Q\n');   // restoreState
    expect(ops).toContain(' re\n'); // rectangle
    expect(ops).toContain('f\n');   // fill
  });

  // -----------------------------------------------------------------------
  // 9. Operators include saveState/restoreState
  // -----------------------------------------------------------------------
  it('wraps operators in saveState/restoreState', () => {
    const matrix = encodeDataMatrix('X');
    const ops = dataMatrixToOperators(matrix, 0, 0);

    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.trimEnd().endsWith('Q')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 10. Custom module size works
  // -----------------------------------------------------------------------
  it('uses custom module size', () => {
    const matrix = encodeDataMatrix('M');
    const ops3 = dataMatrixToOperators(matrix, 0, 0, { moduleSize: 3 });
    const ops5 = dataMatrixToOperators(matrix, 0, 0, { moduleSize: 5 });

    // Module size 3: rectangles should be "3 3 re"
    expect(ops3).toContain('3 3 re\n');

    // Module size 5: rectangles should be "5 5 re"
    expect(ops5).toContain('5 5 re\n');
  });

  // -----------------------------------------------------------------------
  // 11. Custom colors work
  // -----------------------------------------------------------------------
  it('handles custom colours', () => {
    const matrix = encodeDataMatrix('Color');
    const ops = dataMatrixToOperators(matrix, 0, 0, {
      color: rgb(1, 0, 0),           // red foreground
      backgroundColor: rgb(1, 1, 0), // yellow background
    });

    expect(ops).toContain('1 1 0 rg\n'); // yellow background
    expect(ops).toContain('1 0 0 rg\n'); // red foreground
  });

  // -----------------------------------------------------------------------
  // 12. Empty/single character data
  // -----------------------------------------------------------------------
  it('handles single character data', () => {
    const result = encodeDataMatrix('Z');
    expect(result.rows).toBe(10);
    expect(result.cols).toBe(10);
    expect(result.modules.length).toBe(100);
    // Verify all modules are boolean
    for (const mod of result.modules) {
      expect(typeof mod).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 13. Matrix dimensions are consistent
  // -----------------------------------------------------------------------
  it('produces consistent matrix dimensions', () => {
    // ASCII encoding: each char = 1 codeword (charCode + 1)
    // 10x10 = 3 data CW, 12x12 = 5 data CW, 14x14 = 8 data CW
    const sizes = [
      { data: 'AB', expectedSize: 10 },        // 2 CW -> fits in 10x10 (3)
      { data: 'ABCDE', expectedSize: 12 },      // 5 CW -> fits in 12x12 (5)
      { data: 'ABCDEFGH', expectedSize: 14 },   // 8 CW -> fits in 14x14 (8)
    ];

    for (const { data, expectedSize } of sizes) {
      const result = encodeDataMatrix(data);
      expect(result.rows).toBe(expectedSize);
      expect(result.cols).toBe(expectedSize);
    }
  });

  // -----------------------------------------------------------------------
  // 14. Quiet zone affects rendered size
  // -----------------------------------------------------------------------
  it('quiet zone affects total rendered size', () => {
    const matrix = encodeDataMatrix('QZ');
    const ops1 = dataMatrixToOperators(matrix, 0, 0, { quietZone: 1, moduleSize: 1 });
    const ops0 = dataMatrixToOperators(matrix, 0, 0, { quietZone: 0, moduleSize: 1 });

    // With quiet zone = 1: total width = (cols + 2) * 1
    const totalWith1 = matrix.cols + 2;
    const totalWith0 = matrix.cols;

    // Background rectangle should differ
    expect(ops1).toContain(`${totalWith1} ${matrix.rows + 2} re\n`);
    expect(ops0).toContain(`${totalWith0} ${matrix.rows} re\n`);
  });

  // -----------------------------------------------------------------------
  // 15. Grayscale defaults (black on white)
  // -----------------------------------------------------------------------
  it('uses grayscale defaults (black on white)', () => {
    const matrix = encodeDataMatrix('gs');
    const ops = dataMatrixToOperators(matrix, 10, 20);

    expect(ops).toContain('1 g\n'); // white background
    expect(ops).toContain('0 g\n'); // black foreground
  });

  // -----------------------------------------------------------------------
  // 16. Throws on data too long
  // -----------------------------------------------------------------------
  it('throws on data that exceeds capacity', () => {
    // Create a very long string that exceeds the max capacity
    const longData = 'A'.repeat(2000);
    expect(() => encodeDataMatrix(longData)).toThrow(/too long/i);
  });

  // -----------------------------------------------------------------------
  // 17. Deterministic output
  // -----------------------------------------------------------------------
  it('produces deterministic output for the same input', () => {
    const result1 = encodeDataMatrix('DETERMINISTIC');
    const result2 = encodeDataMatrix('DETERMINISTIC');
    expect(result1.rows).toBe(result2.rows);
    expect(result1.cols).toBe(result2.cols);
    expect(result1.modules).toEqual(result2.modules);
  });

  // -----------------------------------------------------------------------
  // 18. Has both dark and light modules in data region
  // -----------------------------------------------------------------------
  it('has both dark and light modules in the data region', () => {
    const result = encodeDataMatrix('Hello');
    const darkCount = result.modules.filter((m) => m).length;
    const lightCount = result.modules.filter((m) => !m).length;
    // Should have a reasonable mix of dark and light
    expect(darkCount).toBeGreaterThan(0);
    expect(lightCount).toBeGreaterThan(0);
    // Neither should dominate completely (some reasonable fraction)
    expect(darkCount).toBeLessThan(result.modules.length);
    expect(lightCount).toBeLessThan(result.modules.length);
  });
});

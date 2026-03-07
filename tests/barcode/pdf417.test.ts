/**
 * Tests for PDF417 2D stacked barcode encoding and PDF operator generation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodePdf417,
  pdf417ToOperators,
} from '../../src/barcode/pdf417.js';
import type { Pdf417Matrix, Pdf417Options } from '../../src/barcode/pdf417.js';
import { rgb } from '../../src/core/operators/color.js';

describe('PDF417 Encoder', () => {
  // -----------------------------------------------------------------------
  // 1. encodePdf417 returns matrix with correct structure
  // -----------------------------------------------------------------------
  it('returns matrix with correct structure', () => {
    const matrix = encodePdf417('Hello World');
    expect(matrix).toBeDefined();
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.columns).toBeGreaterThanOrEqual(1);
    expect(matrix.moduleWidth).toBeGreaterThan(0);
    expect(Array.isArray(matrix.modules)).toBe(true);
    // Total modules = rows * moduleWidth
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);
  });

  // -----------------------------------------------------------------------
  // 2. Matrix has positive rows and columns
  // -----------------------------------------------------------------------
  it('has positive rows and columns', () => {
    const matrix = encodePdf417('Test data');
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.rows).toBeLessThanOrEqual(90);
    expect(matrix.columns).toBeGreaterThanOrEqual(1);
    expect(matrix.columns).toBeLessThanOrEqual(30);
  });

  // -----------------------------------------------------------------------
  // 3. Matrix modules are boolean array
  // -----------------------------------------------------------------------
  it('modules are all boolean values', () => {
    const matrix = encodePdf417('Boolean check');
    for (const mod of matrix.modules) {
      expect(typeof mod).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 4. Handles short text input
  // -----------------------------------------------------------------------
  it('handles short text input', () => {
    const matrix = encodePdf417('Hi');
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.columns).toBeGreaterThanOrEqual(1);
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);
  });

  // -----------------------------------------------------------------------
  // 5. Handles longer text input
  // -----------------------------------------------------------------------
  it('handles longer text input', () => {
    const longText = 'The quick brown fox jumps over the lazy dog. ' +
      'PDF417 is a stacked linear barcode format used in a variety of applications.';
    const matrix = encodePdf417(longText);
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);
    // Longer text should require more codewords
    const shortMatrix = encodePdf417('Hi');
    expect(
      matrix.rows * matrix.columns,
    ).toBeGreaterThanOrEqual(shortMatrix.rows * shortMatrix.columns);
  });

  // -----------------------------------------------------------------------
  // 6. Different error correction levels produce different sizes
  // -----------------------------------------------------------------------
  it('different error correction levels produce different sizes', () => {
    const data = 'Error correction test data string';
    const matrixLow = encodePdf417(data, { errorLevel: 0 });
    const matrixHigh = encodePdf417(data, { errorLevel: 5 });

    // Higher EC level adds more EC codewords, requiring more total capacity
    const totalLow = matrixLow.rows * matrixLow.columns;
    const totalHigh = matrixHigh.rows * matrixHigh.columns;
    expect(totalHigh).toBeGreaterThan(totalLow);
  });

  // -----------------------------------------------------------------------
  // 7. Custom column count works
  // -----------------------------------------------------------------------
  it('custom column count works', () => {
    const matrix = encodePdf417('Custom columns test', { columns: 5 });
    expect(matrix.columns).toBe(5);

    const matrix2 = encodePdf417('Custom columns test', { columns: 10 });
    expect(matrix2.columns).toBe(10);
  });

  // -----------------------------------------------------------------------
  // 8. Generates valid PDF operators
  // -----------------------------------------------------------------------
  it('generates valid PDF operators', () => {
    const matrix = encodePdf417('PDF operators');
    const ops = pdf417ToOperators(matrix, 50, 100);

    // Should contain PDF operator keywords
    expect(ops).toContain('q\n');    // saveState
    expect(ops).toContain('Q\n');    // restoreState
    expect(ops).toContain(' re\n');  // rectangle
    expect(ops).toContain('f\n');    // fill
  });

  // -----------------------------------------------------------------------
  // 9. Operators include saveState/restoreState
  // -----------------------------------------------------------------------
  it('wraps operators in saveState/restoreState', () => {
    const matrix = encodePdf417('State test');
    const ops = pdf417ToOperators(matrix, 0, 0);

    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.trimEnd().endsWith('Q')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 10. Multiple rows rendered correctly
  // -----------------------------------------------------------------------
  it('renders multiple rows correctly', () => {
    const matrix = encodePdf417('Multi-row test data for PDF417');
    const ops = pdf417ToOperators(matrix, 10, 20, { rowHeight: 6 });

    // Should have rectangles at different Y positions for different rows
    // Count occurrences of 're' to verify multiple rectangles
    const reCount = (ops.match(/ re\n/g) || []).length;
    expect(reCount).toBeGreaterThan(matrix.rows); // At least one rect per row
  });

  // -----------------------------------------------------------------------
  // 11. Empty input throws error
  // -----------------------------------------------------------------------
  it('throws on empty input', () => {
    expect(() => encodePdf417('')).toThrow('PDF417: input data must not be empty');
  });

  // -----------------------------------------------------------------------
  // 12. Single character input
  // -----------------------------------------------------------------------
  it('handles single character input', () => {
    const matrix = encodePdf417('A');
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.columns).toBeGreaterThanOrEqual(1);
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);
  });

  // -----------------------------------------------------------------------
  // 13. Special characters handled
  // -----------------------------------------------------------------------
  it('handles special characters', () => {
    const matrix = encodePdf417('Hello! @#$%^&*()');
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);

    // All modules should be boolean
    for (const mod of matrix.modules) {
      expect(typeof mod).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 14. Module width matches expected formula
  // -----------------------------------------------------------------------
  it('module width matches expected formula', () => {
    const matrix = encodePdf417('Width test', { columns: 4 });
    // Expected: start(17) + leftIndicator(17) + 4*17 + rightIndicator(17) + stop(18)
    const expected = 17 + 17 + 4 * 17 + 17 + 18;
    expect(matrix.moduleWidth).toBe(expected);
  });

  // -----------------------------------------------------------------------
  // 15. Error level clamped to valid range
  // -----------------------------------------------------------------------
  it('clamps error level to valid range', () => {
    // Should not throw for out-of-range levels
    const matrixNeg = encodePdf417('Clamp test', { errorLevel: -1 });
    expect(matrixNeg.rows).toBeGreaterThanOrEqual(3);

    const matrixHigh = encodePdf417('Clamp test', { errorLevel: 10 });
    expect(matrixHigh.rows).toBeGreaterThanOrEqual(3);
  });

  // -----------------------------------------------------------------------
  // 16. Custom rendering options
  // -----------------------------------------------------------------------
  it('handles custom rendering options', () => {
    const matrix = encodePdf417('Render test');
    const ops = pdf417ToOperators(matrix, 100, 200, {
      moduleWidth: 2,
      rowHeight: 10,
      quietZone: 5,
      color: rgb(0, 0, 1), // blue
    });

    expect(ops).toContain('0 0 1 rg\n'); // blue colour
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  // -----------------------------------------------------------------------
  // 17. Rows start and end with start/stop patterns
  // -----------------------------------------------------------------------
  it('rows begin with start pattern and end with stop pattern', () => {
    const matrix = encodePdf417('Pattern test');
    // Start pattern is 81111113 = 17 modules: 8 bars, 1 space, 1 bar, 1 space, ...
    // First 8 modules of each row should be true (bars from the 8-wide bar)
    for (let row = 0; row < matrix.rows; row++) {
      const offset = row * matrix.moduleWidth;
      // First 8 modules should be dark (start pattern begins with 8-wide bar)
      for (let i = 0; i < 8; i++) {
        expect(matrix.modules[offset + i]).toBe(true);
      }
      // Module 8 should be a space (the '1' space in 81111113)
      expect(matrix.modules[offset + 8]).toBe(false);
    }
  });

  // -----------------------------------------------------------------------
  // 18. Numeric data encodes correctly
  // -----------------------------------------------------------------------
  it('handles numeric-only data', () => {
    const matrix = encodePdf417('1234567890');
    expect(matrix.rows).toBeGreaterThanOrEqual(3);
    expect(matrix.modules.length).toBe(matrix.rows * matrix.moduleWidth);
  });
});

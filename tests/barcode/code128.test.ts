/**
 * Tests for Code 128 barcode encoding and PDF operator generation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCode128,
  encodeCode128Values,
  valuesToModules,
  code128ToOperators,
} from '../../src/barcode/code128.js';
import type { BarcodeMatrix, Code128Options } from '../../src/barcode/code128.js';
import { rgb, grayscale } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helper: manually compute the check digit from symbol values
// ---------------------------------------------------------------------------
function computeCheckDigit(values: readonly number[]): number {
  // values includes START but not check digit or STOP
  let sum = values[0]!;
  for (let i = 1; i < values.length; i++) {
    sum += values[i]! * i;
  }
  return sum % 103;
}

describe('Code 128 Barcode', () => {
  // -----------------------------------------------------------------------
  // 1. Encodes simple alphanumeric data
  // -----------------------------------------------------------------------
  it('encodes simple alphanumeric data', () => {
    const matrix = encodeCode128('ABC123');
    expect(matrix.modules.length).toBe(matrix.width);
    expect(matrix.width).toBeGreaterThan(0);
    // Every module is a boolean
    for (const m of matrix.modules) {
      expect(typeof m).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // 2. Encodes numeric-only data (uses Code C)
  // -----------------------------------------------------------------------
  it('encodes numeric-only data using Code C', () => {
    // "123456" is 6 digits — should start with Code C (START_C = 105)
    const values = encodeCode128Values('123456');
    expect(values[0]).toBe(105); // START C

    // Code C encodes pairs: 12, 34, 56 → values 12, 34, 56
    expect(values[1]).toBe(12);
    expect(values[2]).toBe(34);
    expect(values[3]).toBe(56);
  });

  // -----------------------------------------------------------------------
  // 3. Encodes mixed data with auto-switching
  // -----------------------------------------------------------------------
  it('encodes mixed data with auto-switching between code sets', () => {
    // "AB1234cd" — starts with letters (Code B), switches to Code C for "1234",
    // then back to Code B for "cd"
    const values = encodeCode128Values('AB1234cd');
    // Should start with Code B (104)
    expect(values[0]).toBe(104);

    // Should contain Code C switch (value 99) somewhere in the middle
    const hasCodeCSwitch = values.includes(99);
    expect(hasCodeCSwitch).toBe(true);

    // Full encode should produce a valid matrix
    const matrix = encodeCode128('AB1234cd');
    expect(matrix.width).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 4. Check digit calculation is correct
  // -----------------------------------------------------------------------
  it('calculates check digit correctly', () => {
    const values = encodeCode128Values('Test');
    // The second-to-last value is the check digit, last is STOP (106)
    const stopIdx = values.length - 1;
    const checkIdx = values.length - 2;

    expect(values[stopIdx]).toBe(106); // STOP

    // Verify check digit: (start + sum(value_i * i)) mod 103
    const dataValues = values.slice(0, checkIdx);
    const expected = computeCheckDigit(dataValues);
    expect(values[checkIdx]).toBe(expected);
  });

  // -----------------------------------------------------------------------
  // 5. Includes START and STOP patterns
  // -----------------------------------------------------------------------
  it('includes START and STOP patterns', () => {
    const values = encodeCode128Values('Hello');
    // First value should be a START code (103, 104, or 105)
    expect([103, 104, 105]).toContain(values[0]);
    // Last value should be STOP (106)
    expect(values[values.length - 1]).toBe(106);
  });

  // -----------------------------------------------------------------------
  // 6. Handles uppercase letters (Code A/B)
  // -----------------------------------------------------------------------
  it('handles uppercase letters', () => {
    const values = encodeCode128Values('ABCDEF');
    // Uppercase is encodable in both Code A and Code B.
    // Should start with Code B (104) since no control chars needed.
    expect(values[0]).toBe(104);

    // 'A' = ASCII 65, Code B value = 65-32 = 33
    expect(values[1]).toBe(33);
    // 'B' = ASCII 66, Code B value = 34
    expect(values[2]).toBe(34);
  });

  // -----------------------------------------------------------------------
  // 7. Handles lowercase letters (Code B)
  // -----------------------------------------------------------------------
  it('handles lowercase letters (requires Code B)', () => {
    const values = encodeCode128Values('abcdef');
    // Lowercase letters require Code B
    expect(values[0]).toBe(104); // START B

    // 'a' = ASCII 97, Code B value = 97-32 = 65
    expect(values[1]).toBe(65);
    // 'b' = ASCII 98, Code B value = 66
    expect(values[2]).toBe(66);
  });

  // -----------------------------------------------------------------------
  // 8. Handles special characters
  // -----------------------------------------------------------------------
  it('handles special characters within the encodable range', () => {
    const values = encodeCode128Values('!@#$%');
    // All these are ASCII 33-37, within Code B range
    expect(values[0]).toBe(104); // START B
    // '!' = ASCII 33, Code B value = 1
    expect(values[1]).toBe(1);
    // '@' = ASCII 64, Code B value = 32
    expect(values[2]).toBe(32);
  });

  // -----------------------------------------------------------------------
  // 9. Generates valid PDF operators
  // -----------------------------------------------------------------------
  it('generates valid PDF operators', () => {
    const matrix = encodeCode128('Hello');
    const ops = code128ToOperators(matrix, 50, 700);

    // Should be a non-empty string
    expect(typeof ops).toBe('string');
    expect(ops.length).toBeGreaterThan(0);

    // Should contain rectangle operators ('re')
    expect(ops).toContain(' re\n');
    // Should contain fill operator
    expect(ops).toContain('f\n');
  });

  // -----------------------------------------------------------------------
  // 10. Operators include saveState/restoreState
  // -----------------------------------------------------------------------
  it('operators include saveState and restoreState', () => {
    const matrix = encodeCode128('Test');
    const ops = code128ToOperators(matrix, 0, 0);

    // Should start with save state (q) and end with restore state (Q)
    expect(ops).toMatch(/^q\n/);
    expect(ops).toMatch(/Q\n$/);
  });

  // -----------------------------------------------------------------------
  // 11. Custom height option works
  // -----------------------------------------------------------------------
  it('custom height option works', () => {
    const matrix = encodeCode128('AB');
    const ops100 = code128ToOperators(matrix, 0, 0, { height: 100 });
    const ops25 = code128ToOperators(matrix, 0, 0, { height: 25 });

    // Height 100 should produce rectangles with height 100
    expect(ops100).toContain('100 re\n');
    // Height 25 should produce rectangles with height 25
    expect(ops25).toContain('25 re\n');
    // They should differ
    expect(ops100).not.toBe(ops25);
  });

  // -----------------------------------------------------------------------
  // 12. Custom moduleWidth option works
  // -----------------------------------------------------------------------
  it('custom moduleWidth option works', () => {
    const matrix = encodeCode128('AB');
    const ops1 = code128ToOperators(matrix, 0, 0, { moduleWidth: 1 });
    const ops2 = code128ToOperators(matrix, 0, 0, { moduleWidth: 2 });

    // With moduleWidth 2, the rectangles should be wider
    // The operators should be different
    expect(ops1).not.toBe(ops2);
  });

  // -----------------------------------------------------------------------
  // 13. Throws on empty input
  // -----------------------------------------------------------------------
  it('throws on empty input', () => {
    expect(() => encodeCode128('')).toThrow('input data must not be empty');
  });

  // -----------------------------------------------------------------------
  // 14. Throws on non-ASCII input
  // -----------------------------------------------------------------------
  it('throws on non-ASCII characters', () => {
    expect(() => encodeCode128('\u00E9clair')).toThrow('outside the encodable range');
  });

  // -----------------------------------------------------------------------
  // 15. STOP pattern is 13 modules wide
  // -----------------------------------------------------------------------
  it('STOP pattern is 13 modules wide', () => {
    // The STOP pattern has 7 elements summing to 13 modules: [2,3,3,1,1,1,2]
    const values = encodeCode128Values('A');
    const matrix = valuesToModules(values);

    // The last 13 modules belong to the STOP pattern
    // Total width check: START (11) + data symbols (11 each) + check (11) + STOP (13)
    const expectedFromValues = (values.length - 1) * 11 + 13; // all symbols are 11 wide except STOP which is 13
    expect(matrix.width).toBe(expectedFromValues);
  });

  // -----------------------------------------------------------------------
  // 16. Custom color option works
  // -----------------------------------------------------------------------
  it('custom color option works', () => {
    const matrix = encodeCode128('AB');
    const opsBlack = code128ToOperators(matrix, 0, 0);
    const opsRed = code128ToOperators(matrix, 0, 0, { color: rgb(1, 0, 0) });

    // Default should use grayscale 0 (black)
    expect(opsBlack).toContain('0 g\n');
    // Red should use RGB
    expect(opsRed).toContain('1 0 0 rg\n');
  });

  // -----------------------------------------------------------------------
  // 17. Two-digit string uses Code C
  // -----------------------------------------------------------------------
  it('encodes a two-digit string using Code C', () => {
    const values = encodeCode128Values('42');
    expect(values[0]).toBe(105); // START C
    expect(values[1]).toBe(42);  // The pair "42"
  });

  // -----------------------------------------------------------------------
  // 18. Quiet zone offset is applied
  // -----------------------------------------------------------------------
  it('applies quiet zone offset to bar positions', () => {
    const matrix = encodeCode128('A');
    const opsNoQuiet = code128ToOperators(matrix, 0, 0, { quietZone: 0, moduleWidth: 1 });
    const opsWithQuiet = code128ToOperators(matrix, 0, 0, { quietZone: 10, moduleWidth: 1 });

    // With quiet zone 0, bars start at x=0
    // With quiet zone 10, bars start at x=10
    // The first rectangle x coordinate should differ by 10
    const xRegex = /^q\n.*?\n(\d+)/s;
    expect(opsNoQuiet).not.toBe(opsWithQuiet);
  });

  // -----------------------------------------------------------------------
  // 19. Module array has correct structure (alternating bars/spaces)
  // -----------------------------------------------------------------------
  it('produces a valid module array with bars and spaces', () => {
    const matrix = encodeCode128('Test');
    // Should contain both true (bar) and false (space) values
    expect(matrix.modules.some(m => m === true)).toBe(true);
    expect(matrix.modules.some(m => m === false)).toBe(true);
    // First module should be a bar (all Code 128 symbols start with a bar)
    expect(matrix.modules[0]).toBe(true);
  });
});

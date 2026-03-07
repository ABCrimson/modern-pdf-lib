/**
 * Tests for Code 39 barcode encoding and PDF operator generation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCode39,
  computeCode39CheckDigit,
  code39ToOperators,
} from '../../src/barcode/code39.js';
import { rgb } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Encoding tests
// ---------------------------------------------------------------------------

describe('encodeCode39', () => {
  it('encodes digits correctly', () => {
    const matrix = encodeCode39('0');
    expect(matrix.modules.length).toBe(matrix.width);
    expect(matrix.width).toBeGreaterThan(0);
    // With ratio 3, each character is 6*1 + 3*3 = 15 modules.
    // Pattern: * + gap(1) + 0 + gap(1) + * = 15 + 1 + 15 + 1 + 15 = 47
    expect(matrix.width).toBe(47);
  });

  it('encodes uppercase letters', () => {
    const matrix = encodeCode39('ABC');
    expect(matrix.width).toBeGreaterThan(0);
    // * + gap + A + gap + B + gap + C + gap + * = 5 chars * 15 + 4 gaps = 79
    expect(matrix.width).toBe(79);
  });

  it('encodes special characters (-, ., $, /, +, %)', () => {
    // These are all valid Code 39 characters
    expect(() => encodeCode39('-')).not.toThrow();
    expect(() => encodeCode39('.')).not.toThrow();
    expect(() => encodeCode39('$')).not.toThrow();
    expect(() => encodeCode39('/')).not.toThrow();
    expect(() => encodeCode39('+')).not.toThrow();
    expect(() => encodeCode39('%')).not.toThrow();
  });

  it('encodes space character', () => {
    expect(() => encodeCode39(' ')).not.toThrow();
    const matrix = encodeCode39(' ');
    expect(matrix.width).toBe(47); // same as single char
  });

  it('automatically includes start/stop asterisks', () => {
    const matrix = encodeCode39('A');
    // The barcode starts with bars (start *) and ends with bars (stop *)
    expect(matrix.modules[0]).toBe(true);  // first module is a bar
    expect(matrix.modules[matrix.width - 1]).toBe(true); // last module is a bar (from stop *)
  });

  it('throws on lowercase characters', () => {
    expect(() => encodeCode39('abc')).toThrow(/invalid character 'a'/);
  });

  it('throws on asterisk in data', () => {
    expect(() => encodeCode39('A*B')).toThrow(/asterisk/);
  });

  it('throws on non-Code-39 characters', () => {
    expect(() => encodeCode39('!')).toThrow(/invalid character/);
    expect(() => encodeCode39('@')).toThrow(/invalid character/);
    expect(() => encodeCode39('#')).toThrow(/invalid character/);
  });

  it('throws on wideToNarrowRatio < 2', () => {
    expect(() => encodeCode39('A', false, 1)).toThrow(/wideToNarrowRatio must be >= 2/);
  });

  it('handles empty string (no data characters, just start/stop)', () => {
    const matrix = encodeCode39('');
    // * + gap + * = 15 + 1 + 15 = 31
    expect(matrix.width).toBe(31);
  });

  it('respects custom wideToNarrowRatio', () => {
    const ratio2 = encodeCode39('1', false, 2);
    const ratio3 = encodeCode39('1', false, 3);
    const ratio4 = encodeCode39('1', false, 4);

    // Each char at ratio R: 6*1 + 3*R modules
    // '1': * + gap + 1 + gap + * = 3*(6+3R) + 2 gaps
    // ratio 2: 3*12 + 2 = 38
    // ratio 3: 3*15 + 2 = 47
    // ratio 4: 3*18 + 2 = 56
    expect(ratio2.width).toBe(38);
    expect(ratio3.width).toBe(47);
    expect(ratio4.width).toBe(56);
  });

  it('produces correct module pattern for known character "1"', () => {
    // '1' has widths [2,1,1,2,1,1,1,1,2]
    // With ratio 3: W=3, N=1 → bar3, sp1, bar1, sp3, bar1, sp1, bar1, sp1, bar3
    // modules: TTT F T FFF T F T F TTT
    // That is: [true,true,true, false, true, false,false,false, true, false, true, false, true,true,true]
    // Length = 15

    // The full barcode for '1' is: * gap 1 gap *
    // Let's just check the '1' portion which starts after the first character + gap
    // '*' has widths [1,2,1,1,2,1,2,1,1]
    // With ratio 3: bar1, sp3, bar1, sp1, bar3, sp1, bar3, sp1, bar1
    // = T FFF T F TTT F TTT F T = 15 modules
    const matrix = encodeCode39('1');

    // After star (15 modules) + gap (1 module), the '1' starts at index 16
    const oneStart = 16;
    const oneModules = matrix.modules.slice(oneStart, oneStart + 15);

    // '1' widths: [2,1,1,2,1,1,1,1,2] with ratio 3
    // bar(3), space(1), bar(1), space(3), bar(1), space(1), bar(1), space(1), bar(3)
    const expected = [
      true, true, true,     // bar width 3
      false,                 // space width 1
      true,                  // bar width 1
      false, false, false,   // space width 3
      true,                  // bar width 1
      false,                 // space width 1
      true,                  // bar width 1
      false,                 // space width 1
      true, true, true,      // bar width 3
    ];
    expect(Array.from(oneModules)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Check digit tests
// ---------------------------------------------------------------------------

describe('computeCode39CheckDigit', () => {
  it('computes check digit for known values', () => {
    // "CODE39" → C=12, O=24, D=13, E=14, 3=3, 9=9 → sum=75 → 75%43=32 → 'W'
    expect(computeCode39CheckDigit('CODE39')).toBe('W');
  });

  it('computes check digit for single digit', () => {
    // '1' → index 1 → 1 % 43 = 1 → '1'
    expect(computeCode39CheckDigit('1')).toBe('1');
  });

  it('computes check digit for all digits', () => {
    // '0123456789' → 0+1+2+3+4+5+6+7+8+9 = 45 → 45%43 = 2 → '2'
    expect(computeCode39CheckDigit('0123456789')).toBe('2');
  });

  it('throws on invalid characters', () => {
    expect(() => computeCode39CheckDigit('abc')).toThrow(/invalid character/);
  });
});

describe('encodeCode39 with check digit', () => {
  it('appends check digit when includeCheckDigit is true', () => {
    const withCheck = encodeCode39('1', true);
    const without = encodeCode39('1');

    // With check digit, there's one more character (16 extra modules: 15 char + 1 gap)
    expect(withCheck.width).toBe(without.width + 16);
  });

  it('includes correct check digit in encoding', () => {
    const checkDigit = computeCode39CheckDigit('HELLO');
    // 'HELLO' → H=17, E=14, L=21, L=21, O=24 → sum=97 → 97%43=11 → 'B'
    expect(checkDigit).toBe('B');

    // Encoding with check digit should be same as encoding 'HELLOB'
    const withCheck = encodeCode39('HELLO', true);
    const manual = encodeCode39('HELLOB');
    expect(Array.from(withCheck.modules)).toEqual(Array.from(manual.modules));
  });
});

// ---------------------------------------------------------------------------
// PDF operator generation tests
// ---------------------------------------------------------------------------

describe('code39ToOperators', () => {
  it('generates valid PDF operators', () => {
    const matrix = encodeCode39('A');
    const ops = code39ToOperators(matrix, 0, 0);

    expect(ops).toContain('q\n');  // save state
    expect(ops).toContain('Q\n');  // restore state
    expect(ops).toContain('re\n'); // rectangle
    expect(ops).toContain('f\n');  // fill
  });

  it('applies quiet zone offset', () => {
    const matrix = encodeCode39('A');
    const ops = code39ToOperators(matrix, 100, 200, { quietZone: 10, moduleWidth: 2 });

    // First bar should start at x=100 + 10*2 = 120
    expect(ops).toContain('120 200');
  });

  it('uses custom height', () => {
    const matrix = encodeCode39('A');
    const ops = code39ToOperators(matrix, 0, 0, { height: 75 });
    expect(ops).toContain('75 re');
  });

  it('applies custom colour', () => {
    const matrix = encodeCode39('A');
    const color = rgb(1, 0, 0);
    const ops = code39ToOperators(matrix, 0, 0, { color });
    expect(ops).toContain('1 0 0 rg'); // red fill
  });

  it('starts with q and ends with Q', () => {
    const matrix = encodeCode39('TEST');
    const ops = code39ToOperators(matrix, 0, 0);
    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.endsWith('Q\n')).toBe(true);
  });

  it('uses grayscale black by default', () => {
    const matrix = encodeCode39('A');
    const ops = code39ToOperators(matrix, 0, 0);
    expect(ops).toContain('0 g\n'); // grayscale black
  });
});

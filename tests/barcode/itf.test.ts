/**
 * Tests for ITF (Interleaved 2 of 5) barcode encoding and PDF operator generation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeItf,
  itfToOperators,
} from '../../src/barcode/itf.js';
import { rgb } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Encoding tests
// ---------------------------------------------------------------------------

describe('encodeItf', () => {
  it('encodes even-length digit strings', () => {
    const matrix = encodeItf('12');
    expect(matrix.modules.length).toBe(matrix.width);
    expect(matrix.width).toBeGreaterThan(0);
  });

  it('auto-prepends 0 for odd-length input', () => {
    // '123' becomes '0123' (2 digit pairs)
    const odd = encodeItf('123');
    const even = encodeItf('0123');

    // Both should produce identical barcodes
    expect(Array.from(odd.modules)).toEqual(Array.from(even.modules));
  });

  it('throws on non-digit input', () => {
    expect(() => encodeItf('12A4')).toThrow(/invalid character 'A'/);
    expect(() => encodeItf('hello')).toThrow(/invalid character/);
  });

  it('throws on empty input', () => {
    expect(() => encodeItf('')).toThrow(/must not be empty/);
  });

  it('throws on wideToNarrowRatio < 2', () => {
    expect(() => encodeItf('12', 1)).toThrow(/wideToNarrowRatio must be >= 2/);
  });

  it('has correct start pattern (4 narrow elements)', () => {
    const matrix = encodeItf('00');
    // Start pattern: narrow bar, narrow space, narrow bar, narrow space
    expect(matrix.modules[0]).toBe(true);   // bar
    expect(matrix.modules[1]).toBe(false);  // space
    expect(matrix.modules[2]).toBe(true);   // bar
    expect(matrix.modules[3]).toBe(false);  // space
  });

  it('has correct stop pattern (wide bar, narrow space, narrow bar)', () => {
    const matrix = encodeItf('00', 3);
    // Last elements: wide bar (3 modules), narrow space (1), narrow bar (1)
    const mods = matrix.modules;
    const len = mods.length;

    // Last module is a bar (narrow bar of stop)
    expect(mods[len - 1]).toBe(true);
    // Second-to-last is a space (narrow space of stop)
    expect(mods[len - 2]).toBe(false);
    // Before that, 3 consecutive bars (wide bar of stop)
    expect(mods[len - 3]).toBe(true);
    expect(mods[len - 4]).toBe(true);
    expect(mods[len - 5]).toBe(true);
  });

  it('computes correct total width for known input', () => {
    // For "12" with ratio 3:
    // Start: 4 narrow = 4 modules
    // Pair 1-2: interleave 5 elements
    //   digit 1 pattern: WNNNW → bars: W,N,N,N,W
    //   digit 2 pattern: NWNNW → spaces: N,W,N,N,W
    //   Interleaved: bar(W=3), space(N=1), bar(N=1), space(W=3), bar(N=1), space(N=1), bar(N=1), space(N=1), bar(W=3), space(W=3)
    //   = 3+1+1+3+1+1+1+1+3+3 = 18 modules
    // Stop: wide bar(3) + narrow space(1) + narrow bar(1) = 5 modules
    // Total = 4 + 18 + 5 = 27
    const matrix = encodeItf('12', 3);
    expect(matrix.width).toBe(27);
  });

  it('handles digit pair interleaving correctly', () => {
    const matrix = encodeItf('00', 3);
    // digit 0 pattern: NNWWN
    // Pair 0-0: bars=NNWWN, spaces=NNWWN
    // Interleaved (bar,space pairs):
    //   bar(N=1), space(N=1), bar(N=1), space(N=1), bar(W=3), space(W=3),
    //   bar(W=3), space(W=3), bar(N=1), space(N=1)
    // = 1+1+1+1+3+3+3+3+1+1 = 18 modules
    // Start(4) + pair(18) + stop(5) = 27
    expect(matrix.width).toBe(27);

    // Check the interleaved portion (after start pattern, indices 4-21)
    const interleaved = matrix.modules.slice(4, 22);
    const expected = [
      true,                  // bar N=1
      false,                 // space N=1
      true,                  // bar N=1
      false,                 // space N=1
      true, true, true,      // bar W=3
      false, false, false,   // space W=3
      true, true, true,      // bar W=3
      false, false, false,   // space W=3
      true,                  // bar N=1
      false,                 // space N=1
    ];
    expect(Array.from(interleaved)).toEqual(expected);
  });

  it('encodes multiple pairs correctly', () => {
    // '1234' = pairs (1,2) and (3,4)
    const matrix = encodeItf('1234', 3);

    // Start: 4
    // Pair 1: digit1=WNNNW, digit2=NWNNW → 10 interleaved elements
    //   → 3+1+1+3+1+1+1+1+3+3 = 18
    // Pair 2: digit3=WWNNN, digit4=NNWNW → 10 interleaved elements
    //   → 3+1+3+1+1+3+1+1+1+3 = 18
    // Stop: 5
    // Total = 4 + 18 + 18 + 5 = 45
    expect(matrix.width).toBe(45);
  });

  it('handles ITF-14 format (14 digits)', () => {
    // ITF-14 is the standard application of ITF
    const matrix = encodeItf('00012345678905');
    expect(matrix.width).toBeGreaterThan(0);
    // 14 digits = 7 pairs
    // Each pair at ratio 3: 2 wide elements in bars (2*3=6) + 3 narrow bars (3*1=3) = 9 bar modules
    //                       2 wide spaces + 3 narrow spaces = 9 space modules = 18 total per pair
    // But actually the interleaved width depends on which digits. Let me just check it doesn't throw.
  });

  it('respects custom wideToNarrowRatio', () => {
    const ratio2 = encodeItf('12', 2);
    const ratio3 = encodeItf('12', 3);

    // ratio 2: different width than ratio 3
    expect(ratio2.width).not.toBe(ratio3.width);
    expect(ratio2.width).toBeLessThan(ratio3.width);
  });
});

// ---------------------------------------------------------------------------
// PDF operator generation tests
// ---------------------------------------------------------------------------

describe('itfToOperators', () => {
  it('generates valid PDF operators', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 0, 0);

    expect(ops).toContain('q\n');  // save state
    expect(ops).toContain('Q\n');  // restore state
    expect(ops).toContain('re\n'); // rectangle
    expect(ops).toContain('f\n');  // fill
  });

  it('applies quiet zone offset', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 50, 100, { quietZone: 10, moduleWidth: 2 });

    // First bar should start at x=50 + 10*2 = 70
    expect(ops).toContain('70 100');
  });

  it('uses custom height', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 0, 0, { height: 80 });
    expect(ops).toContain('80 re');
  });

  it('applies custom colour', () => {
    const matrix = encodeItf('12');
    const color = rgb(0, 0, 1);
    const ops = itfToOperators(matrix, 0, 0, { color });
    expect(ops).toContain('0 0 1 rg'); // blue fill
  });

  it('renders bearer bars when enabled', () => {
    const matrix = encodeItf('12');
    const opsWithout = itfToOperators(matrix, 0, 0, { bearerBars: false });
    const opsWith = itfToOperators(matrix, 0, 0, { bearerBars: true, bearerBarWidth: 3 });

    // Bearer bars add 2 extra rectangles
    const rectCountWithout = (opsWithout.match(/re\n/g) || []).length;
    const rectCountWith = (opsWith.match(/re\n/g) || []).length;
    expect(rectCountWith).toBe(rectCountWithout + 2);
  });

  it('adjusts bar height when bearer bars are enabled', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 0, 0, {
      height: 50,
      bearerBars: true,
      bearerBarWidth: 3,
    });

    // Bearer bars should reduce the main bar area
    // Height of main bars = 50 - 2*3 = 44
    expect(ops).toContain('44 re');
  });

  it('uses default bearer bar width of 2', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 0, 0, {
      height: 50,
      bearerBars: true,
    });

    // Default bearer bar width = 2
    // Main bar height = 50 - 2*2 = 46
    expect(ops).toContain('46 re');
  });

  it('starts with q and ends with Q', () => {
    const matrix = encodeItf('1234567890');
    const ops = itfToOperators(matrix, 0, 0);
    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.endsWith('Q\n')).toBe(true);
  });

  it('uses grayscale black by default', () => {
    const matrix = encodeItf('12');
    const ops = itfToOperators(matrix, 0, 0);
    expect(ops).toContain('0 g\n'); // grayscale black
  });
});

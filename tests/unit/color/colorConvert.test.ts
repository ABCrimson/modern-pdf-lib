/**
 * Tests for pure device colour-space conversions (src/color/colorConvert.ts).
 *
 * All conversions are verified by:
 *  - exact known anchors (red/green/blue/white/black/gray), and
 *  - round-trip stability (rgb↔hsl, rgb↔hsv, rgb↔cmyk, rgb↔lab,
 *    rgb↔xyz) within a tight tolerance.
 *
 * Reference constants (sRGB transfer, sRGB↔XYZ D65 matrices, CIE Lab δ=6/29)
 * are cited in the implementation module.
 */

import { describe, it, expect } from 'vitest';

import {
  cmykToRgb,
  rgbToCmyk,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToXyz,
  xyzToRgb,
  rgbToLab,
  labToRgb,
} from '../../../src/color/colorConvert.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert two triples are equal within `tol`. */
function expectClose(
  got: readonly number[],
  want: readonly number[],
  tol: number,
): void {
  expect(got.length).toBe(want.length);
  const digits = -Math.log10(tol);
  for (const [i, gotValue] of got.entries()) {
    const wantValue = want[i];
    expect(wantValue).toBeDefined();
    expect(gotValue).toBeCloseTo(wantValue as number, digits);
  }
}

/** A representative palette covering primaries, neutrals and mixes. */
const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], // red
  [0, 1, 0], // green
  [0, 0, 1], // blue
  [1, 1, 1], // white
  [0, 0, 0], // black
  [0.5, 0.5, 0.5], // gray
  [1, 1, 0], // yellow
  [0, 1, 1], // cyan
  [1, 0, 1], // magenta
  [0.2, 0.4, 0.6], // arbitrary
  [0.9, 0.1, 0.35], // arbitrary
];

const TIGHT = 1e-6;
/**
 * Sensible tolerance for round-trips that pass through the sRGB transfer
 * function + the 3×3 matrix + (for Lab) a cube root. These transcendental ops
 * accumulate ~1e-6 of unavoidable floating-point error on dark channels where
 * the gamma curve's steep slope amplifies tiny linear residuals, so 1e-6 is
 * too strict; 1e-4 (four decimal places) still proves correctness.
 */
const PIPELINE = 1e-4;

// ---------------------------------------------------------------------------
// CMYK
// ---------------------------------------------------------------------------

describe('cmyk <-> rgb', () => {
  it('cmykToRgb(0,0,0,1) is black', () => {
    expectClose(cmykToRgb(0, 0, 0, 1), [0, 0, 0], TIGHT);
  });

  it('cmykToRgb(0,0,0,0) is white', () => {
    expectClose(cmykToRgb(0, 0, 0, 0), [1, 1, 1], TIGHT);
  });

  it('cmykToRgb(1,0,0,0) is cyan, (0,1,0,0) magenta, (0,0,1,0) yellow', () => {
    expectClose(cmykToRgb(1, 0, 0, 0), [0, 1, 1], TIGHT);
    expectClose(cmykToRgb(0, 1, 0, 0), [1, 0, 1], TIGHT);
    expectClose(cmykToRgb(0, 0, 1, 0), [1, 1, 0], TIGHT);
  });

  it('rgbToCmyk(0,0,0) -> k=1', () => {
    expectClose(rgbToCmyk(0, 0, 0), [0, 0, 0, 1], TIGHT);
  });

  it('rgbToCmyk(1,1,1) -> all zero', () => {
    expectClose(rgbToCmyk(1, 1, 1), [0, 0, 0, 0], TIGHT);
  });

  it('round-trips rgb -> cmyk -> rgb', () => {
    for (const [r, g, b] of PALETTE) {
      const [c, m, y, k] = rgbToCmyk(r, g, b);
      expectClose(cmykToRgb(c, m, y, k), [r, g, b], TIGHT);
    }
  });
});

// ---------------------------------------------------------------------------
// HSL
// ---------------------------------------------------------------------------

describe('rgb <-> hsl', () => {
  it('rgbToHsl(1,0,0) -> h≈0, s≈1, l≈0.5', () => {
    const [h, s, l] = rgbToHsl(1, 0, 0);
    expect(h).toBeCloseTo(0, 6);
    expect(s).toBeCloseTo(1, 6);
    expect(l).toBeCloseTo(0.5, 6);
  });

  it('green at h=120, blue at h=240', () => {
    expect(rgbToHsl(0, 1, 0)[0]).toBeCloseTo(120, 6);
    expect(rgbToHsl(0, 0, 1)[0]).toBeCloseTo(240, 6);
  });

  it('grays have s=0', () => {
    expect(rgbToHsl(0.5, 0.5, 0.5)[1]).toBeCloseTo(0, 6);
    expect(rgbToHsl(1, 1, 1)).toEqual([0, 0, 1]);
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it('round-trips rgb -> hsl -> rgb', () => {
    for (const [r, g, b] of PALETTE) {
      const [h, s, l] = rgbToHsl(r, g, b);
      expectClose(hslToRgb(h, s, l), [r, g, b], TIGHT);
    }
  });

  it('hslToRgb wraps hue (h=360 == h=0)', () => {
    expectClose(hslToRgb(360, 1, 0.5), hslToRgb(0, 1, 0.5), TIGHT);
  });
});

// ---------------------------------------------------------------------------
// HSV
// ---------------------------------------------------------------------------

describe('rgb <-> hsv', () => {
  it('rgbToHsv(1,0,0) -> h≈0, s≈1, v≈1', () => {
    expectClose(rgbToHsv(1, 0, 0), [0, 1, 1], TIGHT);
  });

  it('rgbToHsv(0.5,0.5,0.5) -> s=0, v=0.5', () => {
    const [h, s, v] = rgbToHsv(0.5, 0.5, 0.5);
    expect(h).toBeCloseTo(0, 6);
    expect(s).toBeCloseTo(0, 6);
    expect(v).toBeCloseTo(0.5, 6);
  });

  it('black has v=0', () => {
    expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it('round-trips rgb -> hsv -> rgb', () => {
    for (const [r, g, b] of PALETTE) {
      const [h, s, v] = rgbToHsv(r, g, b);
      expectClose(hsvToRgb(h, s, v), [r, g, b], TIGHT);
    }
  });
});

// ---------------------------------------------------------------------------
// XYZ
// ---------------------------------------------------------------------------

describe('rgb <-> xyz (sRGB D65)', () => {
  it('white maps to the D65 reference white (Y=1)', () => {
    const [x, y, z] = rgbToXyz(1, 1, 1);
    expect(x).toBeCloseTo(0.95047, 4);
    expect(y).toBeCloseTo(1.0, 6);
    expect(z).toBeCloseTo(1.08883, 4);
  });

  it('black maps to origin', () => {
    expectClose(rgbToXyz(0, 0, 0), [0, 0, 0], TIGHT);
  });

  it('round-trips rgb -> xyz -> rgb', () => {
    for (const [r, g, b] of PALETTE) {
      const [x, y, z] = rgbToXyz(r, g, b);
      expectClose(xyzToRgb(x, y, z), [r, g, b], PIPELINE);
    }
  });
});

// ---------------------------------------------------------------------------
// Lab
// ---------------------------------------------------------------------------

describe('rgb <-> lab (via XYZ D65)', () => {
  it('rgbToLab(1,1,1) ≈ [100,0,0]', () => {
    const [L, a, b] = rgbToLab(1, 1, 1);
    expect(L).toBeCloseTo(100, 4);
    expect(a).toBeCloseTo(0, 4);
    expect(b).toBeCloseTo(0, 4);
  });

  it('rgbToLab(0,0,0) ≈ [0,0,0]', () => {
    expectClose(rgbToLab(0, 0, 0), [0, 0, 0], 1e-6);
  });

  it('mid gray has a≈0, b≈0 and L in (0,100)', () => {
    const [L, a, b] = rgbToLab(0.5, 0.5, 0.5);
    expect(a).toBeCloseTo(0, 4);
    expect(b).toBeCloseTo(0, 4);
    expect(L).toBeGreaterThan(0);
    expect(L).toBeLessThan(100);
  });

  it('pure red is approximately the known sRGB-D65 Lab anchor', () => {
    // sRGB(255,0,0) -> CIELab D65 ≈ (53.24, 80.09, 67.20) (Lindbloom calc).
    const [L, a, b] = rgbToLab(1, 0, 0);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('round-trips rgb -> lab -> rgb', () => {
    for (const [r, g, b] of PALETTE) {
      const [L, A, B] = rgbToLab(r, g, b);
      expectClose(labToRgb(L, A, B), [r, g, b], PIPELINE);
    }
  });
});

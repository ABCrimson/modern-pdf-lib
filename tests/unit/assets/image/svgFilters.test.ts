/**
 * Tests for SVG filter primitive evaluators.
 *
 * Covers src/assets/image/svgFilters.ts — feColorMatrix, feColorMatrixSaturate,
 * feGaussianBlur, feOffset, feFlood, feBlend, feComposite.
 *
 * Math verified against:
 * - SVG 1.1 §15.10 (feColorMatrix, saturate matrix coefficients)
 * - SVG 1.1 §15.17 (feGaussianBlur three-box-blur approximation, d formula)
 * - Porter & Duff, "Compositing Digital Images" (SIGGRAPH 1984) / SVG 1.1 §15.13
 */

import { describe, it, expect } from 'vitest';
import {
  feColorMatrix,
  feColorMatrixSaturate,
  feGaussianBlur,
  feOffset,
  feFlood,
  feBlend,
  feComposite,
  type RasterBuffer,
} from '../../../../src/assets/image/svgFilters.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuffer(width: number, height: number, fill: [number, number, number, number] = [0, 0, 0, 0]): RasterBuffer {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4 + 0] = fill[0];
    rgba[i * 4 + 1] = fill[1];
    rgba[i * 4 + 2] = fill[2];
    rgba[i * 4 + 3] = fill[3];
  }
  return { width, height, rgba };
}

function px(buf: RasterBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buf.width + x) * 4;
  return [buf.rgba[i]!, buf.rgba[i + 1]!, buf.rgba[i + 2]!, buf.rgba[i + 3]!];
}

const IDENTITY: number[] = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

// ---------------------------------------------------------------------------
// feFlood
// ---------------------------------------------------------------------------

describe('feFlood', () => {
  it('fills a 2x2 buffer with solid red', () => {
    const out = feFlood(2, 2, [255, 0, 0, 255]);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(out.rgba.length).toBe(16);
    for (let i = 0; i < 4; i++) {
      expect(px(out, i % 2, Math.floor(i / 2))).toEqual([255, 0, 0, 255]);
    }
  });

  it('fills with a semi-transparent colour', () => {
    const out = feFlood(1, 1, [10, 20, 30, 128]);
    expect(px(out, 0, 0)).toEqual([10, 20, 30, 128]);
  });
});

// ---------------------------------------------------------------------------
// feColorMatrix
// ---------------------------------------------------------------------------

describe('feColorMatrix', () => {
  it('identity matrix is a no-op', () => {
    const src = makeBuffer(2, 1);
    src.rgba.set([11, 22, 33, 44, 200, 100, 50, 255]);
    const out = feColorMatrix(src, IDENTITY);
    expect(px(out, 0, 0)).toEqual([11, 22, 33, 44]);
    expect(px(out, 1, 0)).toEqual([200, 100, 50, 255]);
  });

  it('throws when matrix is not 20 values', () => {
    const src = makeBuffer(1, 1);
    expect(() => feColorMatrix(src, [1, 2, 3])).toThrow();
  });

  it('applies a constant bias via the 5th column (a=1 term)', () => {
    // Row R: all zero except bias 0.5 -> R' = 0.5*255 ~= 128
    const m = [
      0, 0, 0, 0, 0.5,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ];
    const src = makeBuffer(1, 1, [0, 80, 160, 255]);
    const out = feColorMatrix(src, m);
    const [r, g, b, a] = px(out, 0, 0);
    expect(r).toBe(128); // round(0.5*255)
    expect(g).toBe(80);
    expect(b).toBe(160);
    expect(a).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// feColorMatrixSaturate
// ---------------------------------------------------------------------------

describe('feColorMatrixSaturate', () => {
  it('saturate(0) greys an image to its luma (R=G=B)', () => {
    const src = makeBuffer(1, 1, [200, 100, 50, 255]);
    const out = feColorMatrixSaturate(src, 0);
    const [r, g, b, a] = px(out, 0, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(a).toBe(255);
    // luma = 0.213*200 + 0.715*100 + 0.072*50 = 42.6 + 71.5 + 3.6 = 117.7 -> 118
    expect(r).toBe(118);
  });

  it('saturate(1) is a no-op', () => {
    const src = makeBuffer(1, 1, [200, 100, 50, 255]);
    const out = feColorMatrixSaturate(src, 1);
    const [r, g, b] = px(out, 0, 0);
    expect(r).toBeCloseTo(200, 0);
    expect(g).toBeCloseTo(100, 0);
    expect(b).toBeCloseTo(50, 0);
  });
});

// ---------------------------------------------------------------------------
// feOffset
// ---------------------------------------------------------------------------

describe('feOffset', () => {
  it('shifts pixels by (dx,dy) leaving transparent edges', () => {
    const src = makeBuffer(3, 3);
    // put a white pixel at (0,0)
    src.rgba.set([255, 255, 255, 255], 0);
    const out = feOffset(src, 1, 1);
    // white now at (1,1)
    expect(px(out, 1, 1)).toEqual([255, 255, 255, 255]);
    // origin now transparent
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
    // top row / left col transparent
    expect(px(out, 2, 0)).toEqual([0, 0, 0, 0]);
  });

  it('negative offset shifts up-left and drops out-of-bounds', () => {
    const src = makeBuffer(2, 2);
    src.rgba.set([1, 2, 3, 4], (1 * 2 + 1) * 4); // pixel at (1,1)
    const out = feOffset(src, -1, -1);
    expect(px(out, 0, 0)).toEqual([1, 2, 3, 4]);
    expect(px(out, 1, 1)).toEqual([0, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// feGaussianBlur
// ---------------------------------------------------------------------------

describe('feGaussianBlur', () => {
  it('stdDev 0 is a no-op', () => {
    const src = makeBuffer(3, 3);
    src.rgba.set([255, 255, 255, 255], (1 * 3 + 1) * 4);
    const out = feGaussianBlur(src, 0);
    expect(px(out, 1, 1)).toEqual([255, 255, 255, 255]);
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('a positive stdDev spreads a single white pixel (centre brightest, neighbours non-zero)', () => {
    const src = makeBuffer(7, 7);
    src.rgba.set([255, 255, 255, 255], (3 * 7 + 3) * 4); // centre
    const out = feGaussianBlur(src, 1.5);
    const centre = px(out, 3, 3)[3];
    const neighbour = px(out, 2, 3)[3];
    const farNeighbour = px(out, 4, 3)[3];
    expect(centre).toBeGreaterThan(0);
    expect(neighbour).toBeGreaterThan(0);
    expect(farNeighbour).toBeGreaterThan(0);
    // centre should be the brightest
    expect(centre).toBeGreaterThanOrEqual(neighbour);
    // energy spread: centre is no longer fully 255
    expect(centre).toBeLessThan(255);
    // symmetric
    expect(px(out, 2, 3)[3]).toBe(px(out, 4, 3)[3]);
    expect(px(out, 3, 2)[3]).toBe(px(out, 3, 4)[3]);
  });

  it('throws on negative stdDev', () => {
    const src = makeBuffer(2, 2);
    expect(() => feGaussianBlur(src, -1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// feComposite (Porter-Duff)
// ---------------------------------------------------------------------------

describe('feComposite', () => {
  it("'over' of opaque red over opaque blue = red", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 255, 255]);
    const out = feComposite(a, b, 'over');
    expect(px(out, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it("'in' of opaque red in opaque blue = red (clipped to b's alpha)", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 255, 255]);
    const out = feComposite(a, b, 'in');
    expect(px(out, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it("'in' of red in transparent = transparent", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 0, 0]);
    const out = feComposite(a, b, 'in');
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("'out' of red out of transparent = red", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 0, 0]);
    const out = feComposite(a, b, 'out');
    expect(px(out, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it("'out' of red out of opaque = transparent", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 255, 255]);
    const out = feComposite(a, b, 'out');
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("'xor' of two opaque pixels = transparent", () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(1, 1, [0, 0, 255, 255]);
    const out = feComposite(a, b, 'xor');
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('throws on size mismatch', () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(2, 2, [0, 0, 255, 255]);
    expect(() => feComposite(a, b, 'over')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// feBlend
// ---------------------------------------------------------------------------

describe('feBlend', () => {
  it("'normal' of opaque a over opaque b = a", () => {
    const a = feFlood(1, 1, [10, 20, 30, 255]);
    const b = feFlood(1, 1, [200, 100, 50, 255]);
    const out = feBlend(a, b, 'normal');
    expect(px(out, 0, 0)).toEqual([10, 20, 30, 255]);
  });

  it("'multiply' of white x colour = colour", () => {
    const white = feFlood(1, 1, [255, 255, 255, 255]);
    const colour = feFlood(1, 1, [128, 64, 200, 255]);
    const out = feBlend(white, colour, 'multiply');
    const [r, g, b, alpha] = px(out, 0, 0);
    expect(r).toBe(128);
    expect(g).toBe(64);
    expect(b).toBe(200);
    expect(alpha).toBe(255);
  });

  it("'screen' of black x colour = colour", () => {
    const black = feFlood(1, 1, [0, 0, 0, 255]);
    const colour = feFlood(1, 1, [128, 64, 200, 255]);
    const out = feBlend(black, colour, 'screen');
    const [r, g, b] = px(out, 0, 0);
    expect(r).toBe(128);
    expect(g).toBe(64);
    expect(b).toBe(200);
  });

  it("'darken' picks the darker channel for opaque inputs", () => {
    const a = feFlood(1, 1, [200, 50, 100, 255]);
    const b = feFlood(1, 1, [100, 150, 100, 255]);
    const out = feBlend(a, b, 'darken');
    const [r, g, bch] = px(out, 0, 0);
    expect(r).toBe(100);
    expect(g).toBe(50);
    expect(bch).toBe(100);
  });

  it("'lighten' picks the lighter channel for opaque inputs", () => {
    const a = feFlood(1, 1, [200, 50, 100, 255]);
    const b = feFlood(1, 1, [100, 150, 100, 255]);
    const out = feBlend(a, b, 'lighten');
    const [r, g, bch] = px(out, 0, 0);
    expect(r).toBe(200);
    expect(g).toBe(150);
    expect(bch).toBe(100);
  });

  it('throws on size mismatch', () => {
    const a = feFlood(1, 1, [255, 0, 0, 255]);
    const b = feFlood(2, 1, [0, 0, 255, 255]);
    expect(() => feBlend(a, b, 'normal')).toThrow();
  });
});

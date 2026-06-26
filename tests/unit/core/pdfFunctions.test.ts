/**
 * Tests for PDF function objects and the evaluator (ISO 32000-2 §7.10):
 * sampled (type 0), exponential (type 2), stitching (type 3) and PostScript
 * calculator (type 4) functions.
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateFunction,
  type ExponentialFunction,
  type SampledFunction,
  type StitchingFunction,
  type PostScriptFunction,
} from '../../../src/core/pdfFunctions.ts';

/** Assert two numbers are equal within a small tolerance. */
function close(actual: number, expected: number, eps = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

describe('evaluateFunction — type 2 (exponential)', () => {
  it('N=1, C0=[0], C1=[1] at x=0.5 → [0.5]', () => {
    const fn: ExponentialFunction = {
      functionType: 2,
      domain: [0, 1],
      c0: [0],
      c1: [1],
      n: 1,
    };
    const out = evaluateFunction(fn, [0.5]);
    expect(out).toHaveLength(1);
    close(out[0] as number, 0.5);
  });

  it('N=2, C0=[0], C1=[1] at x=0.5 → [0.25]', () => {
    const fn: ExponentialFunction = {
      functionType: 2,
      domain: [0, 1],
      c0: [0],
      c1: [1],
      n: 2,
    };
    close(evaluateFunction(fn, [0.5])[0] as number, 0.25);
  });

  it('defaults C0=[0]/C1=[1] when omitted', () => {
    const fn: ExponentialFunction = { functionType: 2, domain: [0, 1], n: 1 };
    close(evaluateFunction(fn, [0.25])[0] as number, 0.25);
  });

  it('multi-component vectors interpolate componentwise', () => {
    const fn: ExponentialFunction = {
      functionType: 2,
      domain: [0, 1],
      c0: [0, 1, 0.5],
      c1: [1, 0, 0.5],
      n: 1,
    };
    const out = evaluateFunction(fn, [0.5]);
    close(out[0] as number, 0.5);
    close(out[1] as number, 0.5);
    close(out[2] as number, 0.5);
  });

  it('clamps the input to the domain', () => {
    const fn: ExponentialFunction = {
      functionType: 2,
      domain: [0, 1],
      c0: [0],
      c1: [10],
      n: 1,
    };
    close(evaluateFunction(fn, [5])[0] as number, 10); // clamped to x=1
    close(evaluateFunction(fn, [-5])[0] as number, 0); // clamped to x=0
  });

  it('endpoints: x=0 → C0, x=1 → C1', () => {
    const fn: ExponentialFunction = {
      functionType: 2,
      domain: [0, 1],
      c0: [2],
      c1: [7],
      n: 3,
    };
    close(evaluateFunction(fn, [0])[0] as number, 2);
    close(evaluateFunction(fn, [1])[0] as number, 7);
  });
});

describe('evaluateFunction — type 3 (stitching)', () => {
  // Two ramps stitched at x=0.5:
  //   subdomain [0,0.5]   → ramp 0→1
  //   subdomain [0.5,1]   → ramp 1→0
  const r0: ExponentialFunction = {
    functionType: 2,
    domain: [0, 1],
    c0: [0],
    c1: [1],
    n: 1,
  };
  const r1: ExponentialFunction = {
    functionType: 2,
    domain: [0, 1],
    c0: [1],
    c1: [0],
    n: 1,
  };
  const stitch: StitchingFunction = {
    functionType: 3,
    domain: [0, 1],
    functions: [r0, r1],
    bounds: [0.5],
    encode: [0, 1, 0, 1],
  };

  it('left subdomain ramps up', () => {
    close(evaluateFunction(stitch, [0])[0] as number, 0);
    close(evaluateFunction(stitch, [0.25])[0] as number, 0.5);
  });

  it('right subdomain ramps down', () => {
    close(evaluateFunction(stitch, [0.75])[0] as number, 0.5);
    close(evaluateFunction(stitch, [1])[0] as number, 0);
  });

  it('boundary value selects the right subdomain', () => {
    // x === 0.5 belongs to the second subdomain; encoded to its domain start.
    close(evaluateFunction(stitch, [0.5])[0] as number, 1);
  });

  it('three-way stitch with non-trivial encode', () => {
    const flat = (v: number): ExponentialFunction => ({
      functionType: 2,
      domain: [0, 1],
      c0: [v],
      c1: [v],
      n: 1,
    });
    const fn: StitchingFunction = {
      functionType: 3,
      domain: [0, 3],
      functions: [flat(10), flat(20), flat(30)],
      bounds: [1, 2],
      encode: [0, 1, 0, 1, 0, 1],
    };
    close(evaluateFunction(fn, [0.5])[0] as number, 10);
    close(evaluateFunction(fn, [1.5])[0] as number, 20);
    close(evaluateFunction(fn, [2.5])[0] as number, 30);
  });

  it('nested stitching recurses', () => {
    const inner: StitchingFunction = {
      functionType: 3,
      domain: [0, 1],
      functions: [r0, r1],
      bounds: [0.5],
      encode: [0, 1, 0, 1],
    };
    const outer: StitchingFunction = {
      functionType: 3,
      domain: [0, 1],
      functions: [inner],
      bounds: [],
      encode: [0, 1],
    };
    close(evaluateFunction(outer, [0.25])[0] as number, 0.5);
  });
});

describe('evaluateFunction — type 0 (sampled)', () => {
  it('1-D linear ramp, 8-bit, 2 samples', () => {
    // samples 0 and 255 map (via decode to range [0,1]) to 0 and 1.
    const fn: SampledFunction = {
      functionType: 0,
      domain: [0, 1],
      range: [0, 1],
      size: [2],
      bitsPerSample: 8,
      samples: [0, 255],
    };
    close(evaluateFunction(fn, [0])[0] as number, 0);
    close(evaluateFunction(fn, [1])[0] as number, 1);
    close(evaluateFunction(fn, [0.5])[0] as number, 0.5);
    close(evaluateFunction(fn, [0.25])[0] as number, 0.25);
  });

  it('1-D ramp with 3 samples interpolates between cells', () => {
    const fn: SampledFunction = {
      functionType: 0,
      domain: [0, 1],
      range: [0, 1],
      size: [3],
      bitsPerSample: 8,
      samples: [0, 128, 255],
    };
    // midpoint of first cell (x=0.25) → sample 64/255.
    close(evaluateFunction(fn, [0.25])[0] as number, 64 / 255, 1e-9);
    close(evaluateFunction(fn, [0.5])[0] as number, 128 / 255, 1e-9);
  });

  it('multi-output samples are grouped per grid point', () => {
    const fn: SampledFunction = {
      functionType: 0,
      domain: [0, 1],
      range: [0, 1, 0, 1],
      size: [2],
      bitsPerSample: 8,
      samples: [0, 255, 255, 0], // grid pt 0 → (0,1), grid pt 1 → (1,0)
    };
    const out = evaluateFunction(fn, [0.5]);
    expect(out).toHaveLength(2);
    close(out[0] as number, 0.5);
    close(out[1] as number, 0.5);
  });

  it('2-D bilinear interpolation over a 2x2 grid', () => {
    // f(0,0)=0, f(1,0)=1, f(0,1)=1, f(1,1)=2 (scaled to 0..255 over /2).
    const fn: SampledFunction = {
      functionType: 0,
      domain: [0, 1, 0, 1],
      range: [0, 2],
      size: [2, 2],
      bitsPerSample: 8,
      // row-major, first dim fastest:
      // (0,0)=0  (1,0)=128  (0,1)=128  (1,1)=255 → decode 0..255 → 0..2
      samples: [0, 128, 128, 255],
      decode: [0, 2],
    };
    // center should be ~ average of corners.
    const center = evaluateFunction(fn, [0.5, 0.5])[0] as number;
    close(center, ((0 + 128 + 128 + 255) / 4 / 255) * 2, 1e-9);
    close(evaluateFunction(fn, [0, 0])[0] as number, 0);
    close(evaluateFunction(fn, [1, 1])[0] as number, 2);
  });

  it('respects a custom decode array', () => {
    const fn: SampledFunction = {
      functionType: 0,
      domain: [0, 1],
      range: [0, 10],
      size: [2],
      bitsPerSample: 8,
      samples: [0, 255],
      decode: [0, 10],
    };
    close(evaluateFunction(fn, [0.5])[0] as number, 5);
  });
});

describe('evaluateFunction — type 4 (PostScript calculator)', () => {
  const ps = (
    source: string,
    range: readonly number[] = [-1e9, 1e9],
    domain: readonly number[] = [-1e9, 1e9],
  ): PostScriptFunction => ({
    functionType: 4,
    domain: [...domain],
    range: [...range],
    source,
  });

  it("'{ 2 mul }' at [3] → [6]", () => {
    close(evaluateFunction(ps('{ 2 mul }'), [3])[0] as number, 6);
  });

  it("'{ dup mul }' at [4] → [16]", () => {
    close(evaluateFunction(ps('{ dup mul }'), [4])[0] as number, 16);
  });

  it('arithmetic operators', () => {
    close(evaluateFunction(ps('{ 1 add }'), [4])[0] as number, 5);
    close(evaluateFunction(ps('{ 10 sub }'), [4])[0] as number, -6);
    close(evaluateFunction(ps('{ 3 div }'), [9])[0] as number, 3);
    close(evaluateFunction(ps('{ 10 3 idiv }'), [0])[0] as number, 3);
    close(evaluateFunction(ps('{ 10 3 mod }'), [0])[0] as number, 1);
    close(evaluateFunction(ps('{ neg }'), [5])[0] as number, -5);
    close(evaluateFunction(ps('{ abs }'), [-5])[0] as number, 5);
    close(evaluateFunction(ps('{ sqrt }'), [9])[0] as number, 3);
    close(evaluateFunction(ps('{ 3 exp }'), [2])[0] as number, 8);
  });

  it('transcendental operators', () => {
    close(evaluateFunction(ps('{ sin }'), [90])[0] as number, 1, 1e-9);
    close(evaluateFunction(ps('{ cos }'), [0])[0] as number, 1, 1e-9);
    close(evaluateFunction(ps('{ ln }'), [Math.E])[0] as number, 1, 1e-9);
    close(evaluateFunction(ps('{ log }'), [1000])[0] as number, 3, 1e-9);
    close(evaluateFunction(ps('{ 1 atan }'), [1])[0] as number, 45, 1e-9);
  });

  it('conversion operators', () => {
    close(evaluateFunction(ps('{ cvi }'), [3.9])[0] as number, 3);
    close(evaluateFunction(ps('{ cvr }'), [3.5])[0] as number, 3.5);
  });

  it('stack operators dup/pop/exch/copy/index/roll', () => {
    // exch then sub: inputs pushed as a then 7 → 7 exch a → a 7 ... use 2 args
    close(evaluateFunction(ps('{ pop }', [-1e9, 1e9], [-1e9, 1e9, -1e9, 1e9]), [5, 9])[0] as number, 5);
    // 3 4 exch sub → 4 - 3 = 1
    close(evaluateFunction(ps('{ 3 4 exch sub }'), [0])[0] as number, 1);
    // dup + index: 5 → 5 5 → (1 index dups again) 5 5 5 → add → 5 10
    close(
      evaluateFunction(
        ps('{ dup 1 index add }', [-1e9, 1e9, -1e9, 1e9]),
        [5],
      )[1] as number,
      10,
    );
    // index: a=5 ; 5 7 0 index → 5 7 7 ; add add → 19
    close(evaluateFunction(ps('{ 7 0 index add add }'), [5])[0] as number, 19);
    // roll: 1 2 3 3 1 roll → 3 1 2 ; then add add → 6
    close(evaluateFunction(ps('{ 1 2 3 3 1 roll add add add }'), [0])[0] as number, 6);
  });

  it('comparison and boolean operators', () => {
    close(evaluateFunction(ps('{ 3 gt }'), [5])[0] as number, 1);
    close(evaluateFunction(ps('{ 3 lt }'), [5])[0] as number, 0);
    close(evaluateFunction(ps('{ 5 eq }'), [5])[0] as number, 1);
    close(evaluateFunction(ps('{ 5 ne }'), [5])[0] as number, 0);
    close(evaluateFunction(ps('{ 5 ge }'), [5])[0] as number, 1);
    close(evaluateFunction(ps('{ 5 le }'), [5])[0] as number, 1);
    close(evaluateFunction(ps('{ true false and }'), [0])[0] as number, 0);
    close(evaluateFunction(ps('{ true false or }'), [0])[0] as number, 1);
    close(evaluateFunction(ps('{ true not }'), [0])[0] as number, 0);
  });

  it('if executes the block only when the condition holds', () => {
    // x > 0 ? x*10 : x
    const src = '{ dup 0 gt { 10 mul } if }';
    close(evaluateFunction(ps(src), [3])[0] as number, 30);
    close(evaluateFunction(ps(src), [-3])[0] as number, -3);
  });

  it('ifelse chooses the matching branch', () => {
    // x >= 5 ? 100 : 200
    const src = '{ 5 ge { 100 } { 200 } ifelse }';
    close(evaluateFunction(ps(src), [7])[0] as number, 100);
    close(evaluateFunction(ps(src), [2])[0] as number, 200);
  });

  it('clamps outputs to the declared range', () => {
    const fn: PostScriptFunction = {
      functionType: 4,
      domain: [0, 1],
      range: [0, 1],
      source: '{ 10 mul }',
    };
    close(evaluateFunction(fn, [0.5])[0] as number, 1); // 5 clamped to 1
  });

  it('multi-output: duplicates produce two outputs', () => {
    const fn: PostScriptFunction = {
      functionType: 4,
      domain: [0, 10],
      range: [0, 100, 0, 100],
      source: '{ dup 2 mul }',
    };
    const out = evaluateFunction(fn, [3]);
    expect(out).toHaveLength(2);
    close(out[0] as number, 3);
    close(out[1] as number, 6);
  });

  it('handles comments and extra whitespace', () => {
    close(evaluateFunction(ps('{ % double it\n 2 mul }'), [3])[0] as number, 6);
  });

  it('throws on an unknown operator', () => {
    expect(() => evaluateFunction(ps('{ frobnicate }'), [1])).toThrow();
  });
});

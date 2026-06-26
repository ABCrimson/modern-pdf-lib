/**
 * Tests for function-based (type 1) shadings and the unified shading builder.
 *
 * Covers:
 * - buildFunctionShading(): /ShadingType 1, default domain/matrix/colorspace,
 *   custom overrides, and an embedded /Function dict with the right
 *   /FunctionType (type 2 and type 4).
 * - sampleShadingColor(): evaluates an exponential (type 2) function at (x, y).
 */

import { describe, it, expect } from 'vitest';
import {
  buildFunctionShading,
  sampleShadingColor,
  type FunctionShadingOptions,
} from '../../../src/core/shadingFunction.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';
import type {
  ExponentialFunction,
  PostScriptFunction,
} from '../../../src/core/pdfFunctions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const expFn: ExponentialFunction = {
  functionType: 2,
  domain: [0, 1],
  c0: [0, 0, 0],
  c1: [1, 0.5, 0.25],
  n: 1,
};

function numbers(arr: PdfArray): number[] {
  return arr.items.map((item) => {
    expect(item).toBeInstanceOf(PdfNumber);
    return (item as PdfNumber).value;
  });
}

// ---------------------------------------------------------------------------
// buildFunctionShading
// ---------------------------------------------------------------------------

describe('buildFunctionShading', () => {
  it('produces a /ShadingType 1 dictionary', () => {
    const dict = buildFunctionShading({ fn: expFn });
    expect(dict).toBeInstanceOf(PdfDict);
    const type = dict.get('/ShadingType');
    expect(type).toBeInstanceOf(PdfNumber);
    expect((type as PdfNumber).value).toBe(1);
  });

  it('defaults Domain to [0 1 0 1]', () => {
    const dict = buildFunctionShading({ fn: expFn });
    const domain = dict.get('/Domain');
    expect(domain).toBeInstanceOf(PdfArray);
    expect(numbers(domain as PdfArray)).toEqual([0, 1, 0, 1]);
  });

  it('defaults Matrix to the identity transform', () => {
    const dict = buildFunctionShading({ fn: expFn });
    const matrix = dict.get('/Matrix');
    expect(matrix).toBeInstanceOf(PdfArray);
    expect(numbers(matrix as PdfArray)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('defaults ColorSpace to /DeviceRGB', () => {
    const dict = buildFunctionShading({ fn: expFn });
    const cs = dict.get('/ColorSpace');
    expect(cs).toBeInstanceOf(PdfName);
    expect((cs as PdfName).value).toBe('/DeviceRGB');
  });

  it('honours custom domain, matrix and colour space', () => {
    const options: FunctionShadingOptions = {
      fn: expFn,
      domain: [-1, 1, -2, 2],
      matrix: [2, 0, 0, 2, 10, 20],
      colorSpace: 'DeviceCMYK',
    };
    const dict = buildFunctionShading(options);
    expect(numbers(dict.get('/Domain') as PdfArray)).toEqual([-1, 1, -2, 2]);
    expect(numbers(dict.get('/Matrix') as PdfArray)).toEqual([2, 0, 0, 2, 10, 20]);
    expect((dict.get('/ColorSpace') as PdfName).value).toBe('/DeviceCMYK');
  });

  it('embeds a type 2 /Function dict with C0/C1/N', () => {
    const dict = buildFunctionShading({ fn: expFn });
    const fnDict = dict.get('/Function');
    expect(fnDict).toBeInstanceOf(PdfDict);
    const fd = fnDict as PdfDict;
    expect((fd.get('/FunctionType') as PdfNumber).value).toBe(2);
    expect(numbers(fd.get('/Domain') as PdfArray)).toEqual([0, 1]);
    expect(numbers(fd.get('/C0') as PdfArray)).toEqual([0, 0, 0]);
    expect(numbers(fd.get('/C1') as PdfArray)).toEqual([1, 0.5, 0.25]);
    expect((fd.get('/N') as PdfNumber).value).toBe(1);
  });

  it('embeds a stream-less type 4 /Function placeholder', () => {
    const psFn: PostScriptFunction = {
      functionType: 4,
      domain: [0, 1, 0, 1],
      range: [0, 1, 0, 1, 0, 1],
      source: '{ pop pop 0 0 0 }',
    };
    const dict = buildFunctionShading({ fn: psFn });
    const fnDict = dict.get('/Function');
    expect(fnDict).toBeInstanceOf(PdfDict);
    const fd = fnDict as PdfDict;
    expect((fd.get('/FunctionType') as PdfNumber).value).toBe(4);
    expect(numbers(fd.get('/Domain') as PdfArray)).toEqual([0, 1, 0, 1]);
    expect(numbers(fd.get('/Range') as PdfArray)).toEqual([0, 1, 0, 1, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// sampleShadingColor
// ---------------------------------------------------------------------------

describe('sampleShadingColor', () => {
  it('evaluates the exponential function at the given coordinate', () => {
    // n = 1 → linear interpolation in x; at x = 0.5 → midpoint of C0..C1.
    const color = sampleShadingColor({ fn: expFn }, 0.5, 0.25);
    expect(color).toHaveLength(3);
    expect(color[0]).toBeCloseTo(0.5, 10);
    expect(color[1]).toBeCloseTo(0.25, 10);
    expect(color[2]).toBeCloseTo(0.125, 10);
  });

  it('returns C0 at x = 0 and C1 at x = 1', () => {
    expect(sampleShadingColor({ fn: expFn }, 0, 0)).toEqual([0, 0, 0]);
    const top = sampleShadingColor({ fn: expFn }, 1, 1);
    expect(top[0]).toBeCloseTo(1, 10);
    expect(top[1]).toBeCloseTo(0.5, 10);
    expect(top[2]).toBeCloseTo(0.25, 10);
  });
});

/**
 * Tests for gradient fills and tiling patterns.
 *
 * Covers:
 * - linearGradient() factory (2 stops bare, 3+ ColorStop, mixed, grayscale, CMYK, extend, error)
 * - radialGradient() factory (2 stops, multi-stop, radial coords)
 * - tilingPattern() factory (defaults, paintType=2, tilingType=2, tilingType=3)
 * - normalizeStops behaviour (even distribution, explicit offsets, sorting)
 * - buildGradientObjects() PDF object materialisation (2-stop, 3-stop stitching, radial)
 * - buildPatternObjects() PDF object materialisation
 * - PdfPage integration (drawGradient, drawPattern)
 * - Round-trip: create PDF with gradient/pattern, save, verify bytes
 */

import { describe, it, expect } from 'vitest';
import {
  linearGradient,
  radialGradient,
  tilingPattern,
  buildGradientObjects,
  buildPatternObjects,
} from '../../../src/core/patterns.js';
import type {
  GradientFill,
  PatternFill,
} from '../../../src/core/patterns.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfArray,
  PdfNumber,
  PdfName,
  PdfBool,
  PdfRef,
  PdfStream,
} from '../../../src/core/pdfObjects.js';
import { rgb, cmyk, grayscale } from '../../../src/core/operators/color.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(
  width?: number,
  height?: number,
): { page: PdfPage; registry: PdfObjectRegistry } {
  const registry = new PdfObjectRegistry();
  const [w, h] = [width ?? 500, height ?? 500];
  const page = new PdfPage(w, h, registry);
  return { page, registry };
}

/** Convert bytes to a string for simple text assertions. */
function pdfToString(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

// ---------------------------------------------------------------------------
// linearGradient() factory
// ---------------------------------------------------------------------------

describe('linearGradient', () => {
  it('creates a descriptor with 2 bare RGB stops', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    expect(grad.kind).toBe('gradient');
    expect(grad.shadingType).toBe(2);
    expect(grad.coords).toEqual([0, 0, 100, 0]);
    expect(grad.normalizedStops).toHaveLength(2);
    expect(grad.normalizedStops[0]).toEqual({ offset: 0, r: 1, g: 0, b: 0 });
    expect(grad.normalizedStops[1]).toEqual({ offset: 1, r: 0, g: 0, b: 1 });
    expect(grad.extend).toBe(true); // default
  });

  it('creates a descriptor with 3+ explicit ColorStop objects', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 300, y2: 0,
      stops: [
        { offset: 0, color: rgb(1, 0, 0) },
        { offset: 0.25, color: rgb(1, 1, 0) },
        { offset: 0.75, color: rgb(0, 1, 0) },
        { offset: 1, color: rgb(0, 0, 1) },
      ],
    });

    expect(grad.normalizedStops).toHaveLength(4);
    expect(grad.normalizedStops[0]!.offset).toBe(0);
    expect(grad.normalizedStops[1]!.offset).toBe(0.25);
    expect(grad.normalizedStops[2]!.offset).toBe(0.75);
    expect(grad.normalizedStops[3]!.offset).toBe(1);
    // Verify colour values
    expect(grad.normalizedStops[1]).toEqual({ offset: 0.25, r: 1, g: 1, b: 0 });
    expect(grad.normalizedStops[2]).toEqual({ offset: 0.75, r: 0, g: 1, b: 0 });
  });

  it('creates a descriptor with 3 bare color stops (evenly distributed)', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 300, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)],
    });

    expect(grad.normalizedStops).toHaveLength(3);
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(0.5);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(1);
  });

  it('handles mixed bare Color and ColorStop entries', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [
        rgb(1, 0, 0),                          // bare at index 0 -> offset 0
        { offset: 0.3, color: rgb(0, 1, 0) },  // explicit offset 0.3
        rgb(0, 0, 1),                           // bare at index 2 -> offset 1 (2/(3-1))
      ],
    });

    expect(grad.normalizedStops).toHaveLength(3);
    // After normalization and sorting: 0, 0.3, 1
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[0]!.r).toBe(1);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(0.3);
    expect(grad.normalizedStops[1]!.g).toBe(1);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(1);
    expect(grad.normalizedStops[2]!.b).toBe(1);
  });

  it('converts grayscale stops to RGB', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [grayscale(0), grayscale(0.5), grayscale(1)],
    });

    expect(grad.normalizedStops[0]).toEqual({ offset: 0, r: 0, g: 0, b: 0 });
    expect(grad.normalizedStops[1]).toEqual({ offset: 0.5, r: 0.5, g: 0.5, b: 0.5 });
    expect(grad.normalizedStops[2]).toEqual({ offset: 1, r: 1, g: 1, b: 1 });
  });

  it('converts CMYK stops to RGB', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [cmyk(1, 0, 0, 0), cmyk(0, 0, 0, 0)],
    });

    // cyan (1,0,0,0) -> rgb(0,1,1)
    expect(grad.normalizedStops[0]!.r).toBeCloseTo(0);
    expect(grad.normalizedStops[0]!.g).toBeCloseTo(1);
    expect(grad.normalizedStops[0]!.b).toBeCloseTo(1);

    // no ink (0,0,0,0) -> white rgb(1,1,1)
    expect(grad.normalizedStops[1]!.r).toBeCloseTo(1);
    expect(grad.normalizedStops[1]!.g).toBeCloseTo(1);
    expect(grad.normalizedStops[1]!.b).toBeCloseTo(1);
  });

  it('converts CMYK with non-zero black key to RGB correctly', () => {
    // magenta=1, k=0.5 -> r=(1-0)*(1-0.5)=0.5, g=(1-1)*(1-0.5)=0, b=(1-0)*(1-0.5)=0.5
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [cmyk(0, 1, 0, 0.5), cmyk(0, 0, 0, 1)],
    });

    expect(grad.normalizedStops[0]!.r).toBeCloseTo(0.5);
    expect(grad.normalizedStops[0]!.g).toBeCloseTo(0);
    expect(grad.normalizedStops[0]!.b).toBeCloseTo(0.5);

    // full black (k=1) -> rgb(0,0,0)
    expect(grad.normalizedStops[1]!.r).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.g).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.b).toBeCloseTo(0);
  });

  it('respects extend: false', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(0, 0, 0), rgb(1, 1, 1)],
      extend: false,
    });

    expect(grad.extend).toBe(false);
  });

  it('defaults extend to true', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(0, 0, 0), rgb(1, 1, 1)],
    });

    expect(grad.extend).toBe(true);
  });

  it('throws if fewer than 2 stops', () => {
    expect(() =>
      linearGradient({
        x1: 0, y1: 0, x2: 100, y2: 0,
        stops: [rgb(1, 0, 0)],
      }),
    ).toThrow('at least 2');
  });

  it('throws on empty stops array', () => {
    expect(() =>
      linearGradient({
        x1: 0, y1: 0, x2: 100, y2: 0,
        stops: [],
      }),
    ).toThrow('at least 2');
  });

  it('sorts stops by offset when provided out of order', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        { offset: 1, color: rgb(0, 0, 1) },
        { offset: 0, color: rgb(1, 0, 0) },
        { offset: 0.5, color: rgb(0, 1, 0) },
      ],
    });

    expect(grad.normalizedStops[0]!.offset).toBe(0);
    expect(grad.normalizedStops[0]!.r).toBe(1); // red at 0
    expect(grad.normalizedStops[1]!.offset).toBe(0.5);
    expect(grad.normalizedStops[1]!.g).toBe(1); // green at 0.5
    expect(grad.normalizedStops[2]!.offset).toBe(1);
    expect(grad.normalizedStops[2]!.b).toBe(1); // blue at 1
  });

  it('preserves explicit offsets for ColorStop entries', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        { offset: 0, color: rgb(1, 0, 0) },
        { offset: 0.3, color: rgb(0, 1, 0) },
        { offset: 1, color: rgb(0, 0, 1) },
      ],
    });

    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(0.3);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// radialGradient() factory
// ---------------------------------------------------------------------------

describe('radialGradient', () => {
  it('creates a descriptor with 2 stops and correct shadingType', () => {
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 1, 0), rgb(0, 0, 0.5)],
    });

    expect(grad.kind).toBe('gradient');
    expect(grad.shadingType).toBe(3);
    expect(grad.normalizedStops).toHaveLength(2);
    expect(grad.extend).toBe(true);
  });

  it('includes all 6 radial coordinates (x0,y0,r0,x1,y1,r1)', () => {
    const grad = radialGradient({
      x0: 10, y0: 20, r0: 5,
      x1: 100, y1: 200, r1: 150,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0)],
    });

    expect(grad.coords).toEqual([10, 20, 5, 100, 200, 150]);
  });

  it('supports extend: false', () => {
    const grad = radialGradient({
      x0: 0, y0: 0, r0: 10,
      x1: 100, y1: 100, r1: 50,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0)],
      extend: false,
    });

    expect(grad.extend).toBe(false);
  });

  it('supports multi-stop gradients', () => {
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1), rgb(1, 1, 1)],
    });

    expect(grad.normalizedStops).toHaveLength(4);
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(1 / 3);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(2 / 3);
    expect(grad.normalizedStops[3]!.offset).toBeCloseTo(1);
  });

  it('normalizes stop colours to RGB', () => {
    const grad = radialGradient({
      x0: 0, y0: 0, r0: 0,
      x1: 0, y1: 0, r1: 50,
      stops: [grayscale(0), grayscale(1)],
    });

    expect(grad.normalizedStops[0]).toEqual({ offset: 0, r: 0, g: 0, b: 0 });
    expect(grad.normalizedStops[1]).toEqual({ offset: 1, r: 1, g: 1, b: 1 });
  });
});

// ---------------------------------------------------------------------------
// tilingPattern() factory
// ---------------------------------------------------------------------------

describe('tilingPattern', () => {
  it('creates a descriptor with default paintType and tilingType', () => {
    const pat = tilingPattern({
      width: 20,
      height: 20,
      ops: '0 0 20 20 re f\n',
    });

    expect(pat.kind).toBe('pattern');
    expect(pat.width).toBe(20);
    expect(pat.height).toBe(20);
    expect(pat.paintType).toBe(1);
    expect(pat.tilingType).toBe(1);
    expect(pat.ops).toBe('0 0 20 20 re f\n');
  });

  it('supports custom paintType=2 (uncoloured)', () => {
    const pat = tilingPattern({
      width: 15,
      height: 15,
      paintType: 2,
      ops: '0 0 m 15 15 l S\n',
    });

    expect(pat.paintType).toBe(2);
    expect(pat.tilingType).toBe(1); // default
  });

  it('supports custom tilingType=2 (no distortion)', () => {
    const pat = tilingPattern({
      width: 10,
      height: 10,
      tilingType: 2,
      ops: '0 0 10 10 re S\n',
    });

    expect(pat.tilingType).toBe(2);
    expect(pat.paintType).toBe(1); // default
  });

  it('supports custom tilingType=3 (constant spacing and faster tiling)', () => {
    const pat = tilingPattern({
      width: 10,
      height: 10,
      tilingType: 3,
      ops: '0 0 m 10 10 l S\n',
    });

    expect(pat.tilingType).toBe(3);
  });

  it('supports both custom paintType=2 and tilingType=3 together', () => {
    const pat = tilingPattern({
      width: 10,
      height: 10,
      paintType: 2,
      tilingType: 3,
      ops: '0 0 m 10 10 l S\n',
    });

    expect(pat.paintType).toBe(2);
    expect(pat.tilingType).toBe(3);
  });

  it('preserves the ops string exactly as given', () => {
    const ops = '1 0 0 rg\n0 0 m\n5 5 l\n10 0 l\nf\n';
    const pat = tilingPattern({ width: 10, height: 10, ops });

    expect(pat.ops).toBe(ops);
  });
});

// ---------------------------------------------------------------------------
// normalizeStops (tested indirectly through linearGradient)
// ---------------------------------------------------------------------------

describe('normalizeStops', () => {
  it('evenly distributes bare colors across 0..1', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1), rgb(1, 1, 1)],
    });

    // 4 stops -> offsets 0, 1/3, 2/3, 1
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(1 / 3);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(2 / 3);
    expect(grad.normalizedStops[3]!.offset).toBeCloseTo(1);
  });

  it('evenly distributes 5 bare colors', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        rgb(1, 0, 0),
        rgb(0.75, 0.25, 0),
        rgb(0.5, 0.5, 0),
        rgb(0.25, 0.75, 0),
        rgb(0, 1, 0),
      ],
    });

    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(0.25);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(0.5);
    expect(grad.normalizedStops[3]!.offset).toBeCloseTo(0.75);
    expect(grad.normalizedStops[4]!.offset).toBeCloseTo(1);
  });

  it('preserves explicit offsets from ColorStop objects', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        { offset: 0, color: rgb(1, 0, 0) },
        { offset: 0.1, color: rgb(0.5, 0, 0) },
        { offset: 0.9, color: rgb(0, 0, 0.5) },
        { offset: 1, color: rgb(0, 0, 1) },
      ],
    });

    expect(grad.normalizedStops[0]!.offset).toBe(0);
    expect(grad.normalizedStops[1]!.offset).toBe(0.1);
    expect(grad.normalizedStops[2]!.offset).toBe(0.9);
    expect(grad.normalizedStops[3]!.offset).toBe(1);
  });

  it('sorts stops by offset regardless of input order', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        { offset: 0.8, color: rgb(0, 0, 0.8) },
        { offset: 0.2, color: rgb(0.2, 0, 0) },
        { offset: 0, color: rgb(0, 0, 0) },
        { offset: 1, color: rgb(1, 1, 1) },
      ],
    });

    for (let i = 1; i < grad.normalizedStops.length; i++) {
      expect(grad.normalizedStops[i]!.offset).toBeGreaterThanOrEqual(
        grad.normalizedStops[i - 1]!.offset,
      );
    }
    expect(grad.normalizedStops[0]!.offset).toBe(0);
    expect(grad.normalizedStops[1]!.offset).toBe(0.2);
    expect(grad.normalizedStops[2]!.offset).toBe(0.8);
    expect(grad.normalizedStops[3]!.offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildGradientObjects() -- PDF object materialisation
// ---------------------------------------------------------------------------

describe('buildGradientObjects', () => {
  it('creates valid PDF objects for a 2-stop linear gradient', () => {
    const registry = new PdfObjectRegistry();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    const { patternRef, patternName } = buildGradientObjects(grad, registry);

    expect(patternRef).toBeInstanceOf(PdfRef);
    expect(patternName).toMatch(/^Pat\d+$/);

    // Resolve the pattern dict
    const patternObj = registry.resolve(patternRef);
    expect(patternObj).toBeDefined();
    expect(patternObj).toBeInstanceOf(PdfDict);
    const patternDict = patternObj as PdfDict;

    // /Type = /Pattern
    const typeEntry = patternDict.get('/Type') as PdfName;
    expect(typeEntry.value).toBe('/Pattern');

    // /PatternType = 2 (shading pattern)
    const patternType = patternDict.get('/PatternType') as PdfNumber;
    expect(patternType.value).toBe(2);

    // /Shading is an indirect reference
    const shadingRef = patternDict.get('/Shading');
    expect(shadingRef).toBeInstanceOf(PdfRef);

    // Resolve the shading dict
    const shadingObj = registry.resolve(shadingRef as PdfRef);
    expect(shadingObj).toBeDefined();
    expect(shadingObj).toBeInstanceOf(PdfDict);
    const shadingDict = shadingObj as PdfDict;

    // /ShadingType = 2 (axial)
    expect((shadingDict.get('/ShadingType') as PdfNumber).value).toBe(2);

    // /ColorSpace = /DeviceRGB
    expect((shadingDict.get('/ColorSpace') as PdfName).value).toBe('/DeviceRGB');

    // /Coords = [0, 0, 200, 0]
    const coords = shadingDict.get('/Coords') as PdfArray;
    expect(coords.items).toHaveLength(4);
    expect(coords.items.map((n: any) => n.value)).toEqual([0, 0, 200, 0]);

    // /Extend = [true, true]
    const extend = shadingDict.get('/Extend') as PdfArray;
    expect(extend.items).toHaveLength(2);
    expect((extend.items[0] as PdfBool).value).toBe(true);
    expect((extend.items[1] as PdfBool).value).toBe(true);

    // /Function -> Type 2 function for 2-stop
    const fnRef = shadingDict.get('/Function');
    expect(fnRef).toBeInstanceOf(PdfRef);

    const fnObj = registry.resolve(fnRef as PdfRef);
    expect(fnObj).toBeInstanceOf(PdfDict);
    const fnDict = fnObj as PdfDict;
    expect((fnDict.get('/FunctionType') as PdfNumber).value).toBe(2);
    expect((fnDict.get('/N') as PdfNumber).value).toBe(1);

    // /C0 = [1, 0, 0] (red)
    const c0 = fnDict.get('/C0') as PdfArray;
    expect(c0.items.map((n: any) => n.value)).toEqual([1, 0, 0]);

    // /C1 = [0, 0, 1] (blue)
    const c1 = fnDict.get('/C1') as PdfArray;
    expect(c1.items.map((n: any) => n.value)).toEqual([0, 0, 1]);

    // /Domain = [0, 1]
    const domain = fnDict.get('/Domain') as PdfArray;
    expect(domain.items.map((n: any) => n.value)).toEqual([0, 1]);
  });

  it('creates a stitching function (Type 3) for 3-stop linear gradient', () => {
    const registry = new PdfObjectRegistry();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 300, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)],
    });

    const { patternRef } = buildGradientObjects(grad, registry);

    // Navigate to the function
    const patternDict = registry.resolve(patternRef) as PdfDict;
    const shadingRef = patternDict.get('/Shading') as PdfRef;
    const shadingDict = registry.resolve(shadingRef) as PdfDict;
    const fnRef = shadingDict.get('/Function') as PdfRef;
    const fnDict = registry.resolve(fnRef) as PdfDict;

    // Type 3 (stitching)
    expect((fnDict.get('/FunctionType') as PdfNumber).value).toBe(3);

    // Domain = [0, 1]
    const domain = fnDict.get('/Domain') as PdfArray;
    expect(domain.items.map((n: any) => n.value)).toEqual([0, 1]);

    // 2 sub-functions (one per segment: red->green, green->blue)
    const subFunctions = fnDict.get('/Functions') as PdfArray;
    expect(subFunctions.items).toHaveLength(2);

    // Verify each sub-function is a reference to a Type 2 function
    for (const ref of subFunctions.items) {
      expect(ref).toBeInstanceOf(PdfRef);
      const subFn = registry.resolve(ref as PdfRef) as PdfDict;
      expect((subFn.get('/FunctionType') as PdfNumber).value).toBe(2);
    }

    // 1 bound (the midpoint offset)
    const bounds = fnDict.get('/Bounds') as PdfArray;
    expect(bounds.items).toHaveLength(1);
    expect((bounds.items[0] as PdfNumber).value).toBeCloseTo(0.5);

    // Encode array: 4 entries (2 per sub-function: [0,1,0,1])
    const encode = fnDict.get('/Encode') as PdfArray;
    expect(encode.items).toHaveLength(4);
    expect(encode.items.map((n: any) => n.value)).toEqual([0, 1, 0, 1]);
  });

  it('creates correct stitching for 4 stops (3 segments)', () => {
    const registry = new PdfObjectRegistry();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 300, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1), rgb(1, 1, 1)],
    });

    const { patternRef } = buildGradientObjects(grad, registry);

    const patternDict = registry.resolve(patternRef) as PdfDict;
    const shadingRef = patternDict.get('/Shading') as PdfRef;
    const shadingDict = registry.resolve(shadingRef) as PdfDict;
    const fnRef = shadingDict.get('/Function') as PdfRef;
    const fnDict = registry.resolve(fnRef) as PdfDict;

    // Type 3 (stitching)
    expect((fnDict.get('/FunctionType') as PdfNumber).value).toBe(3);

    // 3 sub-functions
    const subFunctions = fnDict.get('/Functions') as PdfArray;
    expect(subFunctions.items).toHaveLength(3);

    // 2 bounds (dividing 3 segments)
    const bounds = fnDict.get('/Bounds') as PdfArray;
    expect(bounds.items).toHaveLength(2);

    // 6 encode entries (2 per sub-function)
    const encode = fnDict.get('/Encode') as PdfArray;
    expect(encode.items).toHaveLength(6);
  });

  it('creates a radial gradient with ShadingType 3', () => {
    const registry = new PdfObjectRegistry();
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    const { patternRef } = buildGradientObjects(grad, registry);

    const patternDict = registry.resolve(patternRef) as PdfDict;
    const shadingRef = patternDict.get('/Shading') as PdfRef;
    const shadingDict = registry.resolve(shadingRef) as PdfDict;

    expect((shadingDict.get('/ShadingType') as PdfNumber).value).toBe(3);

    // Coords should have 6 values: [x0, y0, r0, x1, y1, r1]
    const coords = shadingDict.get('/Coords') as PdfArray;
    expect(coords.items).toHaveLength(6);
    expect(coords.items.map((n: any) => n.value)).toEqual([50, 50, 0, 50, 50, 100]);
  });

  it('respects extend: false in the Extend array', () => {
    const registry = new PdfObjectRegistry();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(0, 0, 0), rgb(1, 1, 1)],
      extend: false,
    });

    const { patternRef } = buildGradientObjects(grad, registry);

    const patternDict = registry.resolve(patternRef) as PdfDict;
    const shadingRef = patternDict.get('/Shading') as PdfRef;
    const shadingDict = registry.resolve(shadingRef) as PdfDict;

    const extend = shadingDict.get('/Extend') as PdfArray;
    expect((extend.items[0] as PdfBool).value).toBe(false);
    expect((extend.items[1] as PdfBool).value).toBe(false);
  });

  it('generates unique pattern names across multiple calls', () => {
    const registry = new PdfObjectRegistry();

    const grad1 = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });
    const grad2 = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [rgb(0, 1, 0), rgb(1, 1, 0)],
    });

    const result1 = buildGradientObjects(grad1, registry);
    const result2 = buildGradientObjects(grad2, registry);

    expect(result1.patternName).not.toBe(result2.patternName);
    expect(result1.patternRef.objectNumber).not.toBe(result2.patternRef.objectNumber);
  });
});

// ---------------------------------------------------------------------------
// buildPatternObjects() -- PDF object materialisation
// ---------------------------------------------------------------------------

describe('buildPatternObjects', () => {
  it('creates a valid tiling pattern stream object', () => {
    const registry = new PdfObjectRegistry();
    const pat = tilingPattern({
      width: 20,
      height: 20,
      ops: '1 0 0 rg\n0 0 10 10 re f\n',
    });

    const { patternRef, patternName } = buildPatternObjects(pat, registry);

    expect(patternRef).toBeInstanceOf(PdfRef);
    expect(patternName).toMatch(/^Pat\d+$/);

    // Resolve -- should be a PdfStream
    const patternObj = registry.resolve(patternRef);
    expect(patternObj).toBeDefined();
    expect(patternObj!.kind).toBe('stream');

    const stream = patternObj as PdfStream;
    const dict = stream.dict;

    // /Type = /Pattern
    expect((dict.get('/Type') as PdfName).value).toBe('/Pattern');

    // /PatternType = 1 (tiling)
    expect((dict.get('/PatternType') as PdfNumber).value).toBe(1);

    // /PaintType = 1 (coloured)
    expect((dict.get('/PaintType') as PdfNumber).value).toBe(1);

    // /TilingType = 1 (constant spacing)
    expect((dict.get('/TilingType') as PdfNumber).value).toBe(1);

    // /BBox = [0, 0, 20, 20]
    const bbox = dict.get('/BBox') as PdfArray;
    expect(bbox.items.map((n: any) => n.value)).toEqual([0, 0, 20, 20]);

    // /XStep and /YStep
    expect((dict.get('/XStep') as PdfNumber).value).toBe(20);
    expect((dict.get('/YStep') as PdfNumber).value).toBe(20);

    // /Resources dict must exist (even if empty)
    const resources = dict.get('/Resources');
    expect(resources).toBeInstanceOf(PdfDict);

    // /Length is set automatically by PdfStream.fromString
    expect(dict.has('/Length')).toBe(true);
  });

  it('uses custom paintType and tilingType in the stream dict', () => {
    const registry = new PdfObjectRegistry();
    const pat = tilingPattern({
      width: 10,
      height: 10,
      paintType: 2,
      tilingType: 3,
      ops: '0 0 m 10 10 l S\n',
    });

    const { patternRef } = buildPatternObjects(pat, registry);
    const stream = registry.resolve(patternRef) as PdfStream;
    const dict = stream.dict;

    expect((dict.get('/PaintType') as PdfNumber).value).toBe(2);
    expect((dict.get('/TilingType') as PdfNumber).value).toBe(3);
  });

  it('encodes the ops string into the stream data', () => {
    const registry = new PdfObjectRegistry();
    const opsString = '1 0.5 0 rg\n0 0 8 8 re f\n';
    const pat = tilingPattern({
      width: 8,
      height: 8,
      ops: opsString,
    });

    const { patternRef } = buildPatternObjects(pat, registry);
    const stream = registry.resolve(patternRef) as PdfStream;

    // Stream data should contain the ops string encoded as UTF-8
    const decoded = new TextDecoder().decode(stream.data);
    expect(decoded).toBe(opsString);
  });

  it('sets BBox dimensions matching width and height', () => {
    const registry = new PdfObjectRegistry();
    const pat = tilingPattern({
      width: 35,
      height: 42,
      ops: '0 0 35 42 re f\n',
    });

    const { patternRef } = buildPatternObjects(pat, registry);
    const stream = registry.resolve(patternRef) as PdfStream;
    const dict = stream.dict;

    const bbox = dict.get('/BBox') as PdfArray;
    expect(bbox.items.map((n: any) => n.value)).toEqual([0, 0, 35, 42]);

    expect((dict.get('/XStep') as PdfNumber).value).toBe(35);
    expect((dict.get('/YStep') as PdfNumber).value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// PdfPage integration -- drawGradient
// ---------------------------------------------------------------------------

describe('PdfPage.drawGradient', () => {
  it('emits correct operators for a linear gradient fill', () => {
    const { page } = makePage();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 50, y: 50, width: 200, height: 100 });

    const ops = page.getContentStreamData();

    // Should wrap in q/Q (save/restore state)
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');

    // Should have a clipping path (rectangle + W + n)
    expect(ops).toContain('50 50 200 100 re');
    expect(ops).toContain('W\n');
    expect(ops).toContain('n\n');

    // Should set Pattern colour space
    expect(ops).toContain('/Pattern cs');

    // Should select the pattern by name
    expect(ops).toMatch(/\/Pat\d+ scn/);

    // Should fill
    expect(ops).toContain('f\n');
  });

  it('registers the pattern in page resources', () => {
    const { page } = makePage();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 0, y: 0, width: 100, height: 100 });

    const resources = page.buildResources();
    const patternDict = resources.get('/Pattern');
    expect(patternDict).toBeInstanceOf(PdfDict);
    expect((patternDict as PdfDict).size).toBeGreaterThan(0);
  });

  it('supports radial gradients via drawGradient', () => {
    const { page } = makePage();
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 1, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 0, y: 0, width: 100, height: 100 });

    const ops = page.getContentStreamData();
    expect(ops).toContain('/Pattern cs');
    expect(ops).toMatch(/\/Pat\d+ scn/);
  });

  it('can draw multiple gradients on the same page', () => {
    const { page } = makePage();

    const grad1 = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });
    const grad2 = radialGradient({
      x0: 250, y0: 250, r0: 0,
      x1: 250, y1: 250, r1: 100,
      stops: [rgb(0, 1, 0), rgb(1, 1, 0)],
    });

    page.drawGradient(grad1, { x: 0, y: 0, width: 100, height: 100 });
    page.drawGradient(grad2, { x: 200, y: 200, width: 100, height: 100 });

    const resources = page.buildResources();
    const patternDict = resources.get('/Pattern') as PdfDict;
    expect(patternDict.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PdfPage integration -- drawPattern
// ---------------------------------------------------------------------------

describe('PdfPage.drawPattern', () => {
  it('emits correct operators for a tiling pattern fill', () => {
    const { page } = makePage();
    const pat = tilingPattern({
      width: 20,
      height: 20,
      ops: '1 0 0 rg\n0 0 10 10 re f\n',
    });

    page.drawPattern(pat, { x: 0, y: 0, width: 200, height: 200 });

    const ops = page.getContentStreamData();

    // Should wrap in q/Q
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');

    // Should have clipping
    expect(ops).toContain('W\n');
    expect(ops).toContain('n\n');

    // Should set Pattern colour space and select the pattern
    expect(ops).toContain('/Pattern cs');
    expect(ops).toMatch(/\/Pat\d+ scn/);
    expect(ops).toContain('f\n');
  });

  it('registers the tiling pattern in page resources', () => {
    const { page } = makePage();
    const pat = tilingPattern({
      width: 20,
      height: 20,
      ops: '0 0 20 20 re f\n',
    });

    page.drawPattern(pat, { x: 0, y: 0, width: 100, height: 100 });

    const resources = page.buildResources();
    const patternDict = resources.get('/Pattern');
    expect(patternDict).toBeInstanceOf(PdfDict);
    expect((patternDict as PdfDict).size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: create PDF with gradient, save, verify bytes
// ---------------------------------------------------------------------------

describe('gradient round-trip', () => {
  it('saved PDF bytes contain /ShadingType for linear gradient', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);

    const grad = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 50, y: 50, width: 200, height: 100 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/ShadingType 2');
    expect(text).toContain('/PatternType 2');
    expect(text).toContain('/ColorSpace /DeviceRGB');
    expect(text).toContain('/FunctionType 2');
    expect(text).toContain('/Pattern');
  });

  it('saved PDF with radial gradient contains /ShadingType 3', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);

    const grad = radialGradient({
      x0: 250, y0: 250, r0: 0,
      x1: 250, y1: 250, r1: 200,
      stops: [rgb(1, 1, 0), rgb(0, 0, 0.5)],
    });

    page.drawGradient(grad, { x: 50, y: 50, width: 400, height: 400 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/ShadingType 3');
  });

  it('saved PDF with multi-stop gradient contains /FunctionType 3 (stitching)', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);

    const grad = linearGradient({
      x1: 0, y1: 0, x2: 400, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 50, y: 200, width: 400, height: 100 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/FunctionType 3');
    expect(text).toContain('/Bounds');
    expect(text).toContain('/Functions');
  });

  it('saved PDF with tiling pattern contains /PatternType 1', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);

    const pat = tilingPattern({
      width: 20,
      height: 20,
      ops: '1 0 0 rg\n0 0 10 10 re f\n',
    });

    page.drawPattern(pat, { x: 50, y: 50, width: 200, height: 200 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/PatternType 1');
    expect(text).toContain('/PaintType 1');
    expect(text).toContain('/TilingType 1');
    expect(text).toContain('/XStep 20');
    expect(text).toContain('/YStep 20');
  });

  it('produces a valid PDF header and footer with gradients', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);

    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(0, 0, 0), rgb(1, 1, 1)],
    });

    page.drawGradient(grad, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const text = pdfToString(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});

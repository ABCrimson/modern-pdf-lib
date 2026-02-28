/**
 * Tests for gradient fills and tiling patterns.
 *
 * Covers:
 * - linearGradient() descriptor creation (2 stops and 3+ stops)
 * - radialGradient() descriptor creation
 * - tilingPattern() descriptor creation
 * - buildGradientObjects() PDF object materialisation
 * - buildPatternObjects() PDF object materialisation
 * - drawGradient() on a PdfPage (operator emission + resource registration)
 * - drawPattern() on a PdfPage (operator emission + resource registration)
 * - Gradient extend option
 * - Round-trip: create PDF with gradient, save, verify bytes contain /ShadingType
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
import { PdfObjectRegistry, PdfDict, PdfArray, PdfNumber, PdfName, PdfBool, PdfRef } from '../../../src/core/pdfObjects.js';
import { rgb, cmyk, grayscale } from '../../../src/core/operators/color.js';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
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
// linearGradient() descriptor
// ---------------------------------------------------------------------------

describe('linearGradient', () => {
  it('creates a descriptor with 2 RGB stops', () => {
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

  it('creates a descriptor with 3+ stops (stitching)', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 300, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)],
    });

    expect(grad.normalizedStops).toHaveLength(3);
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[1]!.offset).toBeCloseTo(0.5);
    expect(grad.normalizedStops[2]!.offset).toBeCloseTo(1);
  });

  it('supports explicit ColorStop offsets', () => {
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

  it('respects extend: false', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [rgb(0, 0, 0), rgb(1, 1, 1)],
      extend: false,
    });

    expect(grad.extend).toBe(false);
  });

  it('converts grayscale stops to RGB', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [grayscale(0), grayscale(1)],
    });

    expect(grad.normalizedStops[0]).toEqual({ offset: 0, r: 0, g: 0, b: 0 });
    expect(grad.normalizedStops[1]).toEqual({ offset: 1, r: 1, g: 1, b: 1 });
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

    // no ink -> white
    expect(grad.normalizedStops[1]!.r).toBeCloseTo(1);
    expect(grad.normalizedStops[1]!.g).toBeCloseTo(1);
    expect(grad.normalizedStops[1]!.b).toBeCloseTo(1);
  });

  it('throws if fewer than 2 stops', () => {
    expect(() =>
      linearGradient({
        x1: 0, y1: 0, x2: 100, y2: 0,
        stops: [rgb(1, 0, 0)],
      }),
    ).toThrow('at least 2');
  });

  it('sorts stops by offset', () => {
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 100, y2: 0,
      stops: [
        { offset: 1, color: rgb(0, 0, 1) },
        { offset: 0, color: rgb(1, 0, 0) },
        { offset: 0.5, color: rgb(0, 1, 0) },
      ],
    });

    expect(grad.normalizedStops[0]!.offset).toBe(0);
    expect(grad.normalizedStops[1]!.offset).toBe(0.5);
    expect(grad.normalizedStops[2]!.offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// radialGradient() descriptor
// ---------------------------------------------------------------------------

describe('radialGradient', () => {
  it('creates a descriptor with correct coords and shadingType', () => {
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 1, 0), rgb(0, 0, 0.5)],
    });

    expect(grad.kind).toBe('gradient');
    expect(grad.shadingType).toBe(3);
    expect(grad.coords).toEqual([50, 50, 0, 50, 50, 100]);
    expect(grad.normalizedStops).toHaveLength(2);
    expect(grad.extend).toBe(true);
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

  it('supports 3+ stops', () => {
    const grad = radialGradient({
      x0: 50, y0: 50, r0: 0,
      x1: 50, y1: 50, r1: 100,
      stops: [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1), rgb(1, 1, 1)],
    });

    expect(grad.normalizedStops).toHaveLength(4);
    expect(grad.normalizedStops[0]!.offset).toBeCloseTo(0);
    expect(grad.normalizedStops[3]!.offset).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// tilingPattern() descriptor
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

  it('respects custom paintType and tilingType', () => {
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
});

// ---------------------------------------------------------------------------
// buildGradientObjects() — PDF object materialisation
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

    // Check PatternType = 2
    const patternType = patternDict.get('/PatternType') as PdfNumber;
    expect(patternType.value).toBe(2);

    // Check /Type = /Pattern
    const typeEntry = patternDict.get('/Type') as PdfName;
    expect(typeEntry.value).toBe('/Pattern');

    // Check it has a Shading reference
    const shadingRef = patternDict.get('/Shading');
    expect(shadingRef).toBeInstanceOf(PdfRef);

    // Resolve the shading dict
    const shadingObj = registry.resolve(shadingRef as PdfRef);
    expect(shadingObj).toBeDefined();
    expect(shadingObj).toBeInstanceOf(PdfDict);
    const shadingDict = shadingObj as PdfDict;

    // ShadingType = 2 (axial)
    const shadingType = shadingDict.get('/ShadingType') as PdfNumber;
    expect(shadingType.value).toBe(2);

    // ColorSpace = DeviceRGB
    const cs = shadingDict.get('/ColorSpace') as PdfName;
    expect(cs.value).toBe('/DeviceRGB');

    // Coords = [0, 0, 200, 0]
    const coords = shadingDict.get('/Coords') as PdfArray;
    expect(coords.items).toHaveLength(4);

    // Extend = [true, true]
    const extend = shadingDict.get('/Extend') as PdfArray;
    expect(extend.items).toHaveLength(2);
    expect((extend.items[0] as PdfBool).value).toBe(true);
    expect((extend.items[1] as PdfBool).value).toBe(true);

    // Function is a reference
    const fnRef = shadingDict.get('/Function');
    expect(fnRef).toBeInstanceOf(PdfRef);

    // Resolve the function dict — should be Type 2 for 2-stop
    const fnObj = registry.resolve(fnRef as PdfRef);
    expect(fnObj).toBeInstanceOf(PdfDict);
    const fnDict = fnObj as PdfDict;
    expect((fnDict.get('/FunctionType') as PdfNumber).value).toBe(2);
    expect((fnDict.get('/N') as PdfNumber).value).toBe(1);
  });

  it('creates a stitching function for 3+ stops', () => {
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

    // Should be Type 3 (stitching)
    expect((fnDict.get('/FunctionType') as PdfNumber).value).toBe(3);

    // Should have 2 sub-functions (one per segment)
    const subFunctions = fnDict.get('/Functions') as PdfArray;
    expect(subFunctions.items).toHaveLength(2);

    // Should have 1 bound (midpoint)
    const bounds = fnDict.get('/Bounds') as PdfArray;
    expect(bounds.items).toHaveLength(1);

    // Encode array should have 4 entries (2 per sub-function)
    const encode = fnDict.get('/Encode') as PdfArray;
    expect(encode.items).toHaveLength(4);
  });

  it('creates a radial gradient (ShadingType 3)', () => {
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

    // Coords = [50, 50, 0, 50, 50, 100]
    const coords = shadingDict.get('/Coords') as PdfArray;
    expect(coords.items).toHaveLength(6);
  });

  it('respects extend: false in Extend array', () => {
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
});

// ---------------------------------------------------------------------------
// buildPatternObjects() — PDF object materialisation
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

    // Resolve — should be a PdfStream
    const patternObj = registry.resolve(patternRef);
    expect(patternObj).toBeDefined();

    // The stream's dict should have all required entries
    // PdfStream wraps a PdfDict, but when registered the object IS the stream
    const stream = patternObj as any;
    expect(stream.kind).toBe('stream');

    const dict = stream.dict as PdfDict;
    expect((dict.get('/PatternType') as PdfNumber).value).toBe(1);
    expect((dict.get('/PaintType') as PdfNumber).value).toBe(1);
    expect((dict.get('/TilingType') as PdfNumber).value).toBe(1);

    const bbox = dict.get('/BBox') as PdfArray;
    expect(bbox.items.map((n: any) => n.value)).toEqual([0, 0, 20, 20]);

    expect((dict.get('/XStep') as PdfNumber).value).toBe(20);
    expect((dict.get('/YStep') as PdfNumber).value).toBe(20);

    // Resources dict should exist (even if empty)
    const resources = dict.get('/Resources');
    expect(resources).toBeInstanceOf(PdfDict);
  });

  it('uses custom paintType and tilingType', () => {
    const registry = new PdfObjectRegistry();
    const pat = tilingPattern({
      width: 10,
      height: 10,
      paintType: 2,
      tilingType: 3,
      ops: '0 0 m 10 10 l S\n',
    });

    const { patternRef } = buildPatternObjects(pat, registry);
    const stream = registry.resolve(patternRef) as any;
    const dict = stream.dict as PdfDict;

    expect((dict.get('/PaintType') as PdfNumber).value).toBe(2);
    expect((dict.get('/TilingType') as PdfNumber).value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// drawGradient() on PdfPage
// ---------------------------------------------------------------------------

describe('PdfPage.drawGradient', () => {
  it('emits correct operators for a gradient fill', () => {
    const { page } = makePage();
    const grad = linearGradient({
      x1: 0, y1: 0, x2: 200, y2: 0,
      stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
    });

    page.drawGradient(grad, { x: 50, y: 50, width: 200, height: 100 });

    const ops = page.getContentStreamData();

    // Should wrap in q/Q
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
});

// ---------------------------------------------------------------------------
// drawPattern() on PdfPage
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
  });
});

// ---------------------------------------------------------------------------
// Round-trip: create PDF with gradient, save, verify bytes
// ---------------------------------------------------------------------------

describe('gradient round-trip', () => {
  it('saved PDF bytes contain /ShadingType', async () => {
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

  it('saved PDF with multi-stop gradient contains /FunctionType 3', async () => {
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

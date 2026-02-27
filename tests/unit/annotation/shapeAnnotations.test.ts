/**
 * Tests for shape annotations: Line, Square, Circle, Polygon, PolyLine.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfLineAnnotation,
  PdfSquareAnnotation,
  PdfCircleAnnotation,
  PdfPolygonAnnotation,
  PdfPolyLineAnnotation,
} from '../../../src/annotation/types/shapeAnnotations.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// PdfLineAnnotation
// ---------------------------------------------------------------------------

describe('PdfLineAnnotation', () => {
  it('creates with line points', () => {
    const annot = PdfLineAnnotation.create({
      rect: [50, 700, 200, 720],
      linePoints: [50, 710, 200, 710],
      color: { r: 0, g: 0, b: 0 },
    });

    expect(annot.getType()).toBe('Line');
    expect(annot.getLinePoints()).toEqual([50, 710, 200, 710]);
  });

  it('sets line ending styles', () => {
    const annot = PdfLineAnnotation.create({
      rect: [0, 0, 200, 200],
      linePoints: [10, 10, 190, 190],
      lineEndingStart: 'ClosedArrow',
      lineEndingEnd: 'OpenArrow',
    });

    expect(annot.getLineEndingStyles()).toEqual(['ClosedArrow', 'OpenArrow']);
  });

  it('defaults to None/None for line endings', () => {
    const annot = PdfLineAnnotation.create({
      rect: [0, 0, 100, 100],
    });
    expect(annot.getLineEndingStyles()).toEqual(['None', 'None']);
  });

  it('generates an appearance stream', () => {
    const annot = PdfLineAnnotation.create({
      rect: [50, 700, 200, 720],
      linePoints: [50, 710, 200, 710],
      color: { r: 0, g: 0, b: 1 },
    });

    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    expect(ap.kind).toBe('stream');
  });

  it('fromDict parses line points', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('Line'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 50]));
    dict.set('/L', PdfArray.fromNumbers([10, 25, 190, 25]));
    dict.set('/LE', PdfArray.of([PdfName.of('Diamond'), PdfName.of('Slash')]));

    const annot = PdfLineAnnotation.fromDict(dict);
    expect(annot.getLinePoints()).toEqual([10, 25, 190, 25]);
    expect(annot.getLineEndingStyles()).toEqual(['Diamond', 'Slash']);
  });

  it('setLinePoints updates line coordinates', () => {
    const annot = PdfLineAnnotation.create({ rect: [0, 0, 100, 100] });
    annot.setLinePoints([5, 5, 95, 95]);
    expect(annot.getLinePoints()).toEqual([5, 5, 95, 95]);
  });

  it('setLineEndingStyles updates endings', () => {
    const annot = PdfLineAnnotation.create({ rect: [0, 0, 100, 100] });
    annot.setLineEndingStyles('Butt', 'RClosedArrow');
    expect(annot.getLineEndingStyles()).toEqual(['Butt', 'RClosedArrow']);
  });
});

// ---------------------------------------------------------------------------
// PdfSquareAnnotation
// ---------------------------------------------------------------------------

describe('PdfSquareAnnotation', () => {
  it('creates a square annotation', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [100, 500, 300, 600],
      color: { r: 1, g: 0, b: 0 },
    });

    expect(annot.getType()).toBe('Square');
    expect(annot.getRect()).toEqual([100, 500, 300, 600]);
  });

  it('supports interior color', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [0, 0, 100, 100],
      interiorColor: { r: 0.9, g: 0.9, b: 0 },
    });

    const ic = annot.getInteriorColor();
    expect(ic).toBeDefined();
    expect(ic!.r).toBeCloseTo(0.9);
    expect(ic!.g).toBeCloseTo(0.9);
    expect(ic!.b).toBeCloseTo(0);
  });

  it('returns undefined when no interior color set', () => {
    const annot = PdfSquareAnnotation.create({ rect: [0, 0, 100, 100] });
    expect(annot.getInteriorColor()).toBeUndefined();
  });

  it('generates an appearance stream', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [0, 0, 100, 100],
      color: { r: 0, g: 0, b: 0 },
    });
    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    expect(ap.kind).toBe('stream');
  });

  it('setInteriorColor updates the fill color', () => {
    const annot = PdfSquareAnnotation.create({ rect: [0, 0, 100, 100] });
    annot.setInteriorColor({ r: 0.5, g: 0.5, b: 0.5 });
    expect(annot.getInteriorColor()).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// PdfCircleAnnotation
// ---------------------------------------------------------------------------

describe('PdfCircleAnnotation', () => {
  it('creates a circle annotation', () => {
    const annot = PdfCircleAnnotation.create({
      rect: [100, 500, 200, 600],
      color: { r: 0, g: 0.5, b: 1 },
    });

    expect(annot.getType()).toBe('Circle');
  });

  it('supports interior color', () => {
    const annot = PdfCircleAnnotation.create({
      rect: [0, 0, 100, 100],
      interiorColor: { r: 0, g: 1, b: 0 },
    });

    expect(annot.getInteriorColor()).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('generates an appearance stream', () => {
    const annot = PdfCircleAnnotation.create({
      rect: [0, 0, 100, 100],
      color: { r: 0, g: 0, b: 0 },
    });
    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    // Verify it contains bezier curve commands
    const decoder = new TextDecoder();
    const content = decoder.decode(ap.data);
    expect(content).toContain(' c\n'); // bezier curve operator
  });

  it('fromDict creates correct instance', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('Circle'));
    dict.set('/Rect', PdfArray.fromNumbers([10, 10, 50, 50]));
    dict.set('/IC', PdfArray.fromNumbers([1, 0, 0]));

    const annot = PdfCircleAnnotation.fromDict(dict);
    expect(annot.getType()).toBe('Circle');
    expect(annot.getInteriorColor()).toEqual({ r: 1, g: 0, b: 0 });
  });
});

// ---------------------------------------------------------------------------
// PdfPolygonAnnotation
// ---------------------------------------------------------------------------

describe('PdfPolygonAnnotation', () => {
  it('creates with vertices', () => {
    const vertices = [100, 100, 200, 100, 150, 200];
    const annot = PdfPolygonAnnotation.create({
      rect: [100, 100, 200, 200],
      vertices,
    });

    expect(annot.getType()).toBe('Polygon');
    expect(annot.getVertices()).toEqual(vertices);
  });

  it('supports interior color', () => {
    const annot = PdfPolygonAnnotation.create({
      rect: [0, 0, 100, 100],
      vertices: [0, 0, 100, 0, 50, 100],
      interiorColor: { r: 0.5, g: 0.5, b: 0.5 },
    });

    expect(annot.getInteriorColor()).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
  });

  it('setVertices updates vertices', () => {
    const annot = PdfPolygonAnnotation.create({ rect: [0, 0, 100, 100] });
    annot.setVertices([10, 10, 90, 10, 50, 90]);
    expect(annot.getVertices()).toEqual([10, 10, 90, 10, 50, 90]);
  });

  it('returns empty array when no vertices set', () => {
    const annot = PdfPolygonAnnotation.create({ rect: [0, 0, 100, 100] });
    expect(annot.getVertices()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PdfPolyLineAnnotation
// ---------------------------------------------------------------------------

describe('PdfPolyLineAnnotation', () => {
  it('creates with vertices', () => {
    const vertices = [10, 10, 50, 50, 90, 10];
    const annot = PdfPolyLineAnnotation.create({
      rect: [10, 10, 90, 50],
      vertices,
    });

    expect(annot.getType()).toBe('PolyLine');
    expect(annot.getVertices()).toEqual(vertices);
  });

  it('setVertices updates vertices', () => {
    const annot = PdfPolyLineAnnotation.create({ rect: [0, 0, 100, 100] });
    annot.setVertices([0, 0, 25, 50, 75, 50, 100, 0]);
    expect(annot.getVertices()).toEqual([0, 0, 25, 50, 75, 50, 100, 0]);
  });

  it('fromDict creates correct instance', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('PolyLine'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 100]));
    dict.set('/Vertices', PdfArray.fromNumbers([10, 10, 50, 90, 90, 10]));

    const annot = PdfPolyLineAnnotation.fromDict(dict);
    expect(annot.getType()).toBe('PolyLine');
    expect(annot.getVertices()).toEqual([10, 10, 50, 90, 90, 10]);
  });
});

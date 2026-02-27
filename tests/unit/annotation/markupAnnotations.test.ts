/**
 * Tests for text markup annotations: Highlight, Underline, Squiggly, StrikeOut.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfHighlightAnnotation,
  PdfUnderlineAnnotation,
  PdfSquigglyAnnotation,
  PdfStrikeOutAnnotation,
} from '../../../src/annotation/types/markupAnnotations.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';

describe('PdfHighlightAnnotation', () => {
  it('creates with auto-generated quad points from rect', () => {
    const annot = PdfHighlightAnnotation.create({
      rect: [50, 700, 200, 720],
      color: { r: 1, g: 1, b: 0 },
    });

    expect(annot.getType()).toBe('Highlight');
    const qp = annot.getQuadPoints();
    expect(qp.length).toBe(8);
    // QuadPoints should span the rect
    expect(qp).toContain(50);
    expect(qp).toContain(200);
  });

  it('creates with explicit quad points', () => {
    const qp = [50, 720, 200, 720, 50, 700, 200, 700];
    const annot = PdfHighlightAnnotation.create({
      rect: [50, 700, 200, 720],
      quadPoints: qp,
    });

    expect(annot.getQuadPoints()).toEqual(qp);
  });

  it('createForRect uses yellow by default', () => {
    const annot = PdfHighlightAnnotation.createForRect([10, 10, 100, 30]);
    expect(annot.getColor()).toEqual({ r: 1, g: 1, b: 0 });
    expect(annot.getQuadPoints().length).toBe(8);
  });

  it('createForRect uses custom color', () => {
    const annot = PdfHighlightAnnotation.createForRect(
      [10, 10, 100, 30],
      { r: 0, g: 1, b: 0 },
    );
    expect(annot.getColor()).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('generates an appearance stream', () => {
    const annot = PdfHighlightAnnotation.create({
      rect: [50, 700, 200, 720],
      color: { r: 1, g: 1, b: 0 },
    });

    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    expect(ap.kind).toBe('stream');
    // Check that it's a Form XObject
    expect(ap.dict.get('/Subtype')).toBeDefined();
  });

  it('fromDict parses quad points', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('Highlight'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
    dict.set('/QuadPoints', PdfArray.fromNumbers([0, 20, 100, 20, 0, 0, 100, 0]));

    const annot = PdfHighlightAnnotation.fromDict(dict);
    expect(annot.getQuadPoints()).toEqual([0, 20, 100, 20, 0, 0, 100, 0]);
  });

  it('setQuadPoints updates the quad points', () => {
    const annot = PdfHighlightAnnotation.create({ rect: [0, 0, 100, 20] });
    annot.setQuadPoints([10, 20, 90, 20, 10, 0, 90, 0]);
    expect(annot.getQuadPoints()).toEqual([10, 20, 90, 20, 10, 0, 90, 0]);
  });
});

describe('PdfUnderlineAnnotation', () => {
  it('creates with correct type', () => {
    const annot = PdfUnderlineAnnotation.create({
      rect: [50, 700, 200, 720],
    });
    expect(annot.getType()).toBe('Underline');
  });

  it('generates an appearance stream', () => {
    const annot = PdfUnderlineAnnotation.create({
      rect: [50, 700, 200, 720],
    });
    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    expect(ap.kind).toBe('stream');
  });

  it('round-trips quad points', () => {
    const qp = [10, 30, 100, 30, 10, 10, 100, 10];
    const annot = PdfUnderlineAnnotation.create({
      rect: [10, 10, 100, 30],
      quadPoints: qp,
    });
    expect(annot.getQuadPoints()).toEqual(qp);
  });
});

describe('PdfSquigglyAnnotation', () => {
  it('creates with correct type', () => {
    const annot = PdfSquigglyAnnotation.create({
      rect: [50, 700, 200, 720],
    });
    expect(annot.getType()).toBe('Squiggly');
  });

  it('generates an appearance stream', () => {
    const annot = PdfSquigglyAnnotation.create({
      rect: [50, 700, 200, 720],
    });
    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
  });
});

describe('PdfStrikeOutAnnotation', () => {
  it('creates with correct type', () => {
    const annot = PdfStrikeOutAnnotation.create({
      rect: [50, 700, 200, 720],
    });
    expect(annot.getType()).toBe('StrikeOut');
  });

  it('generates an appearance stream', () => {
    const annot = PdfStrikeOutAnnotation.create({
      rect: [50, 700, 200, 720],
      color: { r: 1, g: 0, b: 0 },
    });
    const ap = annot.generateAppearance();
    expect(ap).toBeDefined();
    expect(ap.kind).toBe('stream');
  });

  it('fromDict creates correct instance', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('StrikeOut'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

    const annot = PdfStrikeOutAnnotation.fromDict(dict);
    expect(annot.getType()).toBe('StrikeOut');
  });
});

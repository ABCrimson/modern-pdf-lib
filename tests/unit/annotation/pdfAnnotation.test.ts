/**
 * Tests for the base PdfAnnotation class and factory functions.
 *
 * Covers:
 * - createAnnotation factory
 * - annotationFromDict parsing
 * - getters/setters (rect, contents, author, color, opacity)
 * - Flag management (hidden, printable, locked)
 * - toDict serialization
 */

import { describe, it, expect } from 'vitest';
import {
  PdfAnnotation,
  AnnotationFlags,
  createAnnotation,
  annotationFromDict,
  buildAnnotationDict,
} from '../../../src/annotation/pdfAnnotation.js';
import type { AnnotationOptions } from '../../../src/annotation/pdfAnnotation.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// createAnnotation
// ---------------------------------------------------------------------------

describe('createAnnotation', () => {
  it('creates an annotation with required fields', () => {
    const annot = createAnnotation('Text', {
      rect: [10, 20, 100, 200],
    });

    expect(annot.getType()).toBe('Text');
    expect(annot.getRect()).toEqual([10, 20, 100, 200]);
    expect(annot.annotationType).toBe('Text');
  });

  it('creates an annotation with all optional fields', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    const annot = createAnnotation('Square', {
      rect: [0, 0, 50, 50],
      contents: 'A note',
      author: 'Alice',
      modificationDate: date,
      color: { r: 1, g: 0, b: 0 },
      opacity: 0.5,
      flags: AnnotationFlags.Print,
      border: { width: 2, style: 'dashed' },
    });

    expect(annot.getContents()).toBe('A note');
    expect(annot.getAuthor()).toBe('Alice');
    expect(annot.getColor()).toEqual({ r: 1, g: 0, b: 0 });
    expect(annot.getOpacity()).toBe(0.5);
    expect(annot.isPrintable()).toBe(true);
  });

  it('sets correct PDF structure in the dict', () => {
    const annot = createAnnotation('Circle', {
      rect: [10, 20, 110, 120],
      contents: 'hello',
    });

    const dict = annot.getDict();
    const typeObj = dict.get('/Type');
    expect(typeObj).toBeDefined();
    expect(typeObj!.kind).toBe('name');
    expect((typeObj as PdfName).value).toBe('/Annot');

    const subtypeObj = dict.get('/Subtype');
    expect(subtypeObj).toBeDefined();
    expect((subtypeObj as PdfName).value).toBe('/Circle');

    // Should have /NM (unique name)
    const nm = dict.get('/NM');
    expect(nm).toBeDefined();
    expect(nm!.kind).toBe('string');
  });

  it('applies border style correctly', () => {
    const annot = createAnnotation('Square', {
      rect: [0, 0, 100, 100],
      border: { width: 3, style: 'beveled' },
    });

    const dict = annot.getDict();
    const bs = dict.get('/BS') as PdfDict;
    expect(bs).toBeDefined();
    expect((bs.get('/W') as PdfNumber).value).toBe(3);
    expect((bs.get('/S') as PdfName).value).toBe('/B');
  });
});

// ---------------------------------------------------------------------------
// annotationFromDict
// ---------------------------------------------------------------------------

describe('annotationFromDict', () => {
  it('parses subtype from dictionary', () => {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('Annot'));
    dict.set('/Subtype', PdfName.of('Highlight'));
    dict.set('/Rect', PdfArray.fromNumbers([10, 20, 110, 120]));

    const annot = annotationFromDict(dict);
    expect(annot.getType()).toBe('Highlight');
    expect(annot.getRect()).toEqual([10, 20, 110, 120]);
  });

  it('defaults to Text when no subtype', () => {
    const dict = new PdfDict();
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 50, 50]));

    const annot = annotationFromDict(dict);
    expect(annot.getType()).toBe('Text');
  });

  it('reads all standard fields', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('Link'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
    dict.set('/Contents', PdfString.literal('Click here'));
    dict.set('/T', PdfString.literal('Bob'));
    dict.set('/C', PdfArray.fromNumbers([0, 0.5, 1]));
    dict.set('/CA', PdfNumber.of(0.75));
    dict.set('/F', PdfNumber.of(AnnotationFlags.Print | AnnotationFlags.Locked));

    const annot = annotationFromDict(dict);
    expect(annot.getContents()).toBe('Click here');
    expect(annot.getAuthor()).toBe('Bob');
    expect(annot.getColor()).toEqual({ r: 0, g: 0.5, b: 1 });
    expect(annot.getOpacity()).toBe(0.75);
    expect(annot.isPrintable()).toBe(true);
    expect(annot.isLocked()).toBe(true);
    expect(annot.isHidden()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getters/setters
// ---------------------------------------------------------------------------

describe('PdfAnnotation getters/setters', () => {
  it('setRect updates the rectangle', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setRect([10, 20, 200, 300]);
    expect(annot.getRect()).toEqual([10, 20, 200, 300]);
  });

  it('getContents returns undefined when not set', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    expect(annot.getContents()).toBeUndefined();
  });

  it('setContents updates the contents', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setContents('Updated note');
    expect(annot.getContents()).toBe('Updated note');
  });

  it('getAuthor returns undefined when not set', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    expect(annot.getAuthor()).toBeUndefined();
  });

  it('setAuthor updates the author', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setAuthor('Charlie');
    expect(annot.getAuthor()).toBe('Charlie');
  });

  it('getColor returns undefined when not set', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    expect(annot.getColor()).toBeUndefined();
  });

  it('setColor updates the color', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setColor({ r: 0.3, g: 0.6, b: 0.9 });
    const c = annot.getColor();
    expect(c).toBeDefined();
    expect(c!.r).toBeCloseTo(0.3);
    expect(c!.g).toBeCloseTo(0.6);
    expect(c!.b).toBeCloseTo(0.9);
  });

  it('getOpacity defaults to 1', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    expect(annot.getOpacity()).toBe(1);
  });

  it('setOpacity updates opacity', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setOpacity(0.25);
    expect(annot.getOpacity()).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

describe('PdfAnnotation flags', () => {
  it('starts with no flags set', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    expect(annot.isHidden()).toBe(false);
    expect(annot.isPrintable()).toBe(false);
    expect(annot.isLocked()).toBe(false);
  });

  it('setHidden toggles the Hidden flag', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setHidden(true);
    expect(annot.isHidden()).toBe(true);
    annot.setHidden(false);
    expect(annot.isHidden()).toBe(false);
  });

  it('setPrintable toggles the Print flag', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setPrintable(true);
    expect(annot.isPrintable()).toBe(true);
    annot.setPrintable(false);
    expect(annot.isPrintable()).toBe(false);
  });

  it('setLocked toggles the Locked flag', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setLocked(true);
    expect(annot.isLocked()).toBe(true);
    annot.setLocked(false);
    expect(annot.isLocked()).toBe(false);
  });

  it('flags are independent', () => {
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    annot.setHidden(true);
    annot.setPrintable(true);
    annot.setLocked(true);
    expect(annot.isHidden()).toBe(true);
    expect(annot.isPrintable()).toBe(true);
    expect(annot.isLocked()).toBe(true);

    annot.setHidden(false);
    expect(annot.isHidden()).toBe(false);
    expect(annot.isPrintable()).toBe(true);
    expect(annot.isLocked()).toBe(true);
  });

  it('creates with flags from options', () => {
    const annot = createAnnotation('Text', {
      rect: [0, 0, 50, 50],
      flags: AnnotationFlags.Print | AnnotationFlags.ReadOnly,
    });
    expect(annot.isPrintable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toDict
// ---------------------------------------------------------------------------

describe('PdfAnnotation.toDict', () => {
  it('returns the annotation dictionary', () => {
    const annot = createAnnotation('Text', {
      rect: [10, 20, 100, 200],
      contents: 'Hello',
    });
    const registry = new PdfObjectRegistry();
    const dict = annot.toDict(registry);

    expect(dict).toBeInstanceOf(PdfDict);
    expect((dict.get('/Subtype') as PdfName).value).toBe('/Text');
  });

  it('generates appearance and sets /AP for subclasses with appearance', () => {
    // Base class returns undefined for appearance, so /AP should not be set
    const annot = createAnnotation('Text', { rect: [0, 0, 50, 50] });
    const registry = new PdfObjectRegistry();
    const dict = annot.toDict(registry);

    expect(dict.has('/AP')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnnotationFlags constants
// ---------------------------------------------------------------------------

describe('AnnotationFlags', () => {
  it('has correct bit values', () => {
    expect(AnnotationFlags.Invisible).toBe(1);
    expect(AnnotationFlags.Hidden).toBe(2);
    expect(AnnotationFlags.Print).toBe(4);
    expect(AnnotationFlags.NoZoom).toBe(8);
    expect(AnnotationFlags.NoRotate).toBe(16);
    expect(AnnotationFlags.NoView).toBe(32);
    expect(AnnotationFlags.ReadOnly).toBe(64);
    expect(AnnotationFlags.Locked).toBe(128);
    expect(AnnotationFlags.ToggleNoView).toBe(256);
    expect(AnnotationFlags.LockedContents).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// buildAnnotationDict
// ---------------------------------------------------------------------------

describe('buildAnnotationDict', () => {
  it('builds a PdfDict with all required fields', () => {
    const dict = buildAnnotationDict('Link', { rect: [0, 0, 100, 50] });
    expect(dict).toBeInstanceOf(PdfDict);
    expect((dict.get('/Type') as PdfName).value).toBe('/Annot');
    expect((dict.get('/Subtype') as PdfName).value).toBe('/Link');
    expect(dict.has('/Rect')).toBe(true);
    expect(dict.has('/NM')).toBe(true);
  });
});

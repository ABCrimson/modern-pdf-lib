/**
 * Tests for PdfRedactAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfRedactAnnotation } from '../../../src/annotation/types/redactAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
  PdfString,
} from '../../../src/core/pdfObjects.js';

describe('PdfRedactAnnotation', () => {
  describe('create', () => {
    it('creates a redact annotation with defaults', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [100, 200, 300, 220],
      });

      expect(annot.getType()).toBe('Redact');
      expect(annot.getRect()).toEqual([100, 200, 300, 220]);
      expect(annot.getOverlayText()).toBeUndefined();
      expect(annot.getInteriorColor()).toBeUndefined();
      expect(annot.getQuadPoints()).toBeUndefined();
    });

    it('creates with overlay text', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [50, 50, 250, 70],
        overlayText: 'REDACTED',
      });

      expect(annot.getOverlayText()).toBe('REDACTED');
    });

    it('creates with interior color', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [0, 0, 100, 20],
        interiorColor: { r: 0, g: 0, b: 0 },
      });

      expect(annot.getInteriorColor()).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('creates with quad points', () => {
      const points = [10, 20, 100, 20, 100, 10, 10, 10];
      const annot = PdfRedactAnnotation.create({
        rect: [10, 10, 100, 20],
        quadPoints: points,
      });

      expect(annot.getQuadPoints()).toEqual(points);
    });

    it('creates with all options combined', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [50, 100, 400, 120],
        overlayText: '[REMOVED]',
        interiorColor: { r: 1, g: 1, b: 1 },
        quadPoints: [50, 120, 400, 120, 400, 100, 50, 100],
      });

      expect(annot.getOverlayText()).toBe('[REMOVED]');
      expect(annot.getInteriorColor()).toEqual({ r: 1, g: 1, b: 1 });
      expect(annot.getQuadPoints()).toEqual([50, 120, 400, 120, 400, 100, 50, 100]);
    });
  });

  describe('fromDict', () => {
    it('parses a redact annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Redact'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
      dict.set('/OverlayText', PdfString.literal('CONFIDENTIAL'));
      dict.set('/IC', PdfArray.fromNumbers([0.5, 0.5, 0.5]));
      dict.set('/QuadPoints', PdfArray.fromNumbers([0, 30, 200, 30, 200, 0, 0, 0]));

      const annot = PdfRedactAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Redact');
      expect(annot.getOverlayText()).toBe('CONFIDENTIAL');
      expect(annot.getInteriorColor()).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
      expect(annot.getQuadPoints()).toEqual([0, 30, 200, 30, 200, 0, 0, 0]);
    });

    it('returns undefined for missing optional fields', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Redact'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

      const annot = PdfRedactAnnotation.fromDict(dict);
      expect(annot.getOverlayText()).toBeUndefined();
      expect(annot.getInteriorColor()).toBeUndefined();
      expect(annot.getQuadPoints()).toBeUndefined();
    });
  });

  describe('setters', () => {
    it('setOverlayText updates the overlay text', () => {
      const annot = PdfRedactAnnotation.create({ rect: [0, 0, 100, 20] });
      expect(annot.getOverlayText()).toBeUndefined();

      annot.setOverlayText('REDACTED');
      expect(annot.getOverlayText()).toBe('REDACTED');
    });

    it('setInteriorColor updates the fill color', () => {
      const annot = PdfRedactAnnotation.create({ rect: [0, 0, 100, 20] });
      expect(annot.getInteriorColor()).toBeUndefined();

      annot.setInteriorColor({ r: 1, g: 0, b: 0 });
      expect(annot.getInteriorColor()).toEqual({ r: 1, g: 0, b: 0 });
    });

    it('setQuadPoints updates the quad points', () => {
      const annot = PdfRedactAnnotation.create({ rect: [0, 0, 100, 20] });
      expect(annot.getQuadPoints()).toBeUndefined();

      annot.setQuadPoints([0, 20, 100, 20, 100, 0, 0, 0]);
      expect(annot.getQuadPoints()).toEqual([0, 20, 100, 20, 100, 0, 0, 0]);
    });

    it('setInteriorColor can be changed multiple times', () => {
      const annot = PdfRedactAnnotation.create({ rect: [0, 0, 100, 20] });

      annot.setInteriorColor({ r: 1, g: 0, b: 0 });
      expect(annot.getInteriorColor()).toEqual({ r: 1, g: 0, b: 0 });

      annot.setInteriorColor({ r: 0, g: 1, b: 0 });
      expect(annot.getInteriorColor()).toEqual({ r: 0, g: 1, b: 0 });
    });
  });

  describe('inherited base properties', () => {
    it('supports author via base class', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [0, 0, 100, 20],
        author: 'Admin',
      });
      expect(annot.getAuthor()).toBe('Admin');
    });

    it('supports contents via base class', () => {
      const annot = PdfRedactAnnotation.create({
        rect: [0, 0, 100, 20],
        contents: 'Redacted for privacy',
      });
      expect(annot.getContents()).toBe('Redacted for privacy');
    });
  });
});

/**
 * Tests for PdfCaretAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfCaretAnnotation } from '../../../src/annotation/types/caretAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

describe('PdfCaretAnnotation', () => {
  describe('create', () => {
    it('creates a caret annotation with defaults', () => {
      const annot = PdfCaretAnnotation.create({
        rect: [100, 200, 110, 215],
      });

      expect(annot.getType()).toBe('Caret');
      expect(annot.getRect()).toEqual([100, 200, 110, 215]);
      expect(annot.getSymbol()).toBe('None');
      expect(annot.getCaretRect()).toBeUndefined();
    });

    it('creates with paragraph symbol', () => {
      const annot = PdfCaretAnnotation.create({
        rect: [50, 50, 60, 65],
        symbol: 'P',
      });

      expect(annot.getSymbol()).toBe('P');
    });

    it('creates with caret rect (RD)', () => {
      const annot = PdfCaretAnnotation.create({
        rect: [100, 100, 120, 120],
        caretRect: [2, 2, 2, 2],
      });

      expect(annot.getCaretRect()).toEqual([2, 2, 2, 2]);
    });

    it('creates with both symbol and caret rect', () => {
      const annot = PdfCaretAnnotation.create({
        rect: [0, 0, 20, 20],
        symbol: 'P',
        caretRect: [1, 1, 1, 1],
      });

      expect(annot.getSymbol()).toBe('P');
      expect(annot.getCaretRect()).toEqual([1, 1, 1, 1]);
    });
  });

  describe('fromDict', () => {
    it('parses a caret annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Caret'));
      dict.set('/Rect', PdfArray.fromNumbers([10, 20, 20, 35]));
      dict.set('/Sy', PdfName.of('P'));
      dict.set('/RD', PdfArray.fromNumbers([3, 3, 3, 3]));

      const annot = PdfCaretAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Caret');
      expect(annot.getSymbol()).toBe('P');
      expect(annot.getCaretRect()).toEqual([3, 3, 3, 3]);
    });

    it('defaults symbol to None when /Sy is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Caret'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 10, 10]));

      const annot = PdfCaretAnnotation.fromDict(dict);
      expect(annot.getSymbol()).toBe('None');
    });

    it('returns undefined for missing /RD', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Caret'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 10, 10]));

      const annot = PdfCaretAnnotation.fromDict(dict);
      expect(annot.getCaretRect()).toBeUndefined();
    });
  });

  describe('setters', () => {
    it('setSymbol changes the symbol', () => {
      const annot = PdfCaretAnnotation.create({ rect: [0, 0, 10, 10] });
      expect(annot.getSymbol()).toBe('None');

      annot.setSymbol('P');
      expect(annot.getSymbol()).toBe('P');

      annot.setSymbol('None');
      expect(annot.getSymbol()).toBe('None');
    });

    it('setCaretRect updates the RD entry', () => {
      const annot = PdfCaretAnnotation.create({ rect: [0, 0, 20, 20] });
      annot.setCaretRect([5, 5, 5, 5]);
      expect(annot.getCaretRect()).toEqual([5, 5, 5, 5]);
    });
  });
});

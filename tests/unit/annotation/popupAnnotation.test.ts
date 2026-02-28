/**
 * Tests for PdfPopupAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfPopupAnnotation } from '../../../src/annotation/types/popupAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfBool,
  PdfArray,
  PdfNumber,
  PdfRef,
} from '../../../src/core/pdfObjects.js';

describe('PdfPopupAnnotation', () => {
  describe('create', () => {
    it('creates a popup annotation with defaults', () => {
      const annot = PdfPopupAnnotation.create({
        rect: [100, 200, 300, 400],
      });

      expect(annot.getType()).toBe('Popup');
      expect(annot.getRect()).toEqual([100, 200, 300, 400]);
      expect(annot.isOpen()).toBe(false);
    });

    it('creates with open state', () => {
      const annot = PdfPopupAnnotation.create({
        rect: [50, 50, 250, 150],
        open: true,
      });

      expect(annot.isOpen()).toBe(true);
    });

    it('creates with closed state explicitly', () => {
      const annot = PdfPopupAnnotation.create({
        rect: [0, 0, 200, 100],
        open: false,
      });

      expect(annot.isOpen()).toBe(false);
    });
  });

  describe('fromDict', () => {
    it('parses a popup annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Popup'));
      dict.set('/Rect', PdfArray.fromNumbers([10, 20, 210, 120]));
      dict.set('/Open', PdfBool.of(true));

      const annot = PdfPopupAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Popup');
      expect(annot.isOpen()).toBe(true);
    });

    it('defaults to closed when /Open is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Popup'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 100]));

      const annot = PdfPopupAnnotation.fromDict(dict);
      expect(annot.isOpen()).toBe(false);
    });
  });

  describe('setters', () => {
    it('setOpen toggles the open state', () => {
      const annot = PdfPopupAnnotation.create({ rect: [0, 0, 100, 100] });
      expect(annot.isOpen()).toBe(false);

      annot.setOpen(true);
      expect(annot.isOpen()).toBe(true);

      annot.setOpen(false);
      expect(annot.isOpen()).toBe(false);
    });

    it('setParent / getParent round-trips a ref', () => {
      const annot = PdfPopupAnnotation.create({ rect: [0, 0, 100, 100] });
      expect(annot.getParent()).toBeUndefined();

      const ref = PdfRef.of(42, 0);
      annot.setParent(ref);

      const parent = annot.getParent();
      expect(parent).toBeDefined();
      expect(parent!.objectNumber).toBe(42);
    });
  });
});

/**
 * Tests for PdfStampAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfStampAnnotation } from '../../../src/annotation/types/stampAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

describe('PdfStampAnnotation', () => {
  describe('create', () => {
    it('creates a stamp annotation with defaults', () => {
      const annot = PdfStampAnnotation.create({
        rect: [100, 200, 250, 260],
      });

      expect(annot.getType()).toBe('Stamp');
      expect(annot.getRect()).toEqual([100, 200, 250, 260]);
      expect(annot.getStampName()).toBe('Draft');
    });

    it('creates with a custom stamp name', () => {
      const annot = PdfStampAnnotation.create({
        rect: [50, 50, 200, 100],
        stampName: 'Approved',
      });

      expect(annot.getStampName()).toBe('Approved');
    });

    it('creates with all standard stamp names', () => {
      const names = [
        'Approved', 'Experimental', 'NotApproved', 'AsIs',
        'Expired', 'NotForPublicRelease', 'Confidential', 'Final',
        'Sold', 'Departmental', 'ForComment', 'TopSecret',
        'Draft', 'ForPublicRelease',
      ] as const;

      for (const name of names) {
        const annot = PdfStampAnnotation.create({
          rect: [0, 0, 100, 50],
          stampName: name,
        });
        expect(annot.getStampName()).toBe(name);
      }
    });

    it('creates with a custom (non-standard) stamp name', () => {
      const annot = PdfStampAnnotation.create({
        rect: [0, 0, 150, 75],
        stampName: 'CustomCompanyLogo',
      });

      expect(annot.getStampName()).toBe('CustomCompanyLogo');
    });
  });

  describe('fromDict', () => {
    it('parses a stamp annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Stamp'));
      dict.set('/Rect', PdfArray.fromNumbers([10, 20, 200, 80]));
      dict.set('/Name', PdfName.of('Confidential'));

      const annot = PdfStampAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Stamp');
      expect(annot.getStampName()).toBe('Confidential');
    });

    it('defaults stamp name to Draft when /Name is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Stamp'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 50]));

      const annot = PdfStampAnnotation.fromDict(dict);
      expect(annot.getStampName()).toBe('Draft');
    });

    it('parses stamp name with leading slash correctly', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Stamp'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 50]));
      dict.set('/Name', PdfName.of('TopSecret'));

      const annot = PdfStampAnnotation.fromDict(dict);
      expect(annot.getStampName()).toBe('TopSecret');
    });
  });

  describe('setters', () => {
    it('setStampName changes the stamp name', () => {
      const annot = PdfStampAnnotation.create({ rect: [0, 0, 100, 50] });
      expect(annot.getStampName()).toBe('Draft');

      annot.setStampName('Approved');
      expect(annot.getStampName()).toBe('Approved');
    });

    it('setStampName can be called multiple times', () => {
      const annot = PdfStampAnnotation.create({ rect: [0, 0, 100, 50] });

      annot.setStampName('Final');
      expect(annot.getStampName()).toBe('Final');

      annot.setStampName('Expired');
      expect(annot.getStampName()).toBe('Expired');

      annot.setStampName('Draft');
      expect(annot.getStampName()).toBe('Draft');
    });
  });

  describe('inherited base properties', () => {
    it('supports color via base class', () => {
      const annot = PdfStampAnnotation.create({
        rect: [0, 0, 100, 50],
        color: { r: 0, g: 0.5, b: 0 },
      });
      expect(annot.getColor()).toEqual({ r: 0, g: 0.5, b: 0 });
    });

    it('supports opacity via base class', () => {
      const annot = PdfStampAnnotation.create({
        rect: [0, 0, 100, 50],
        opacity: 0.75,
      });
      expect(annot.getOpacity()).toBe(0.75);
    });

    it('supports contents via base class', () => {
      const annot = PdfStampAnnotation.create({
        rect: [0, 0, 100, 50],
        contents: 'This document is approved',
      });
      expect(annot.getContents()).toBe('This document is approved');
    });

    it('supports author via base class', () => {
      const annot = PdfStampAnnotation.create({
        rect: [0, 0, 100, 50],
        author: 'Manager',
      });
      expect(annot.getAuthor()).toBe('Manager');
    });
  });
});

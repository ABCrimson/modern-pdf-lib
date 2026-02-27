/**
 * Tests for PdfLinkAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfLinkAnnotation } from '../../../src/annotation/types/linkAnnotation.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
} from '../../../src/core/pdfObjects.js';

describe('PdfLinkAnnotation', () => {
  describe('create with URL', () => {
    it('creates a URL link', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [50, 700, 200, 720],
        url: 'https://example.com',
      });

      expect(annot.getType()).toBe('Link');
      expect(annot.getUrl()).toBe('https://example.com');
      expect(annot.getDestination()).toBeUndefined();
    });
  });

  describe('create with destination', () => {
    it('creates a page destination link', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [50, 700, 200, 720],
        pageIndex: 3,
        fit: 'FitH',
      });

      const dest = annot.getDestination();
      expect(dest).toBeDefined();
      expect(Array.isArray(dest)).toBe(true);
      expect((dest as number[])[0]).toBe(3);
      expect((dest as [number, string])[1]).toBe('FitH');
    });

    it('defaults to Fit mode', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        pageIndex: 0,
      });

      const dest = annot.getDestination() as [number, string];
      expect(dest[1]).toBe('Fit');
    });
  });

  describe('highlight mode', () => {
    it('defaults to Invert', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        url: 'https://test.com',
      });
      expect(annot.getHighlightMode()).toBe('Invert');
    });

    it('sets highlight mode', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        highlightMode: 'Push',
      });
      expect(annot.getHighlightMode()).toBe('Push');
    });

    it('round-trips all highlight modes', () => {
      const modes = ['None', 'Invert', 'Outline', 'Push'] as const;
      for (const mode of modes) {
        const annot = PdfLinkAnnotation.create({
          rect: [0, 0, 100, 20],
          highlightMode: mode,
        });
        expect(annot.getHighlightMode()).toBe(mode);
      }
    });
  });

  describe('fromDict', () => {
    it('parses a URL link from dict', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

      const action = new PdfDict();
      action.set('/S', PdfName.of('URI'));
      action.set('/URI', PdfString.literal('https://parsed.com'));
      dict.set('/A', action);

      const annot = PdfLinkAnnotation.fromDict(dict);
      expect(annot.getUrl()).toBe('https://parsed.com');
    });

    it('parses a destination link from dict', () => {
      const dict = new PdfDict();
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
      dict.set('/Dest', PdfArray.of([
        PdfNumber.of(5),
        PdfName.of('FitH'),
      ]));

      const annot = PdfLinkAnnotation.fromDict(dict);
      const dest = annot.getDestination() as [number, string];
      expect(dest[0]).toBe(5);
      expect(dest[1]).toBe('FitH');
    });

    it('parses a named destination from dict', () => {
      const dict = new PdfDict();
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
      dict.set('/Dest', PdfString.literal('chapter2'));

      const annot = PdfLinkAnnotation.fromDict(dict);
      expect(annot.getDestination()).toBe('chapter2');
    });
  });

  describe('setters', () => {
    it('setUrl creates a URI action', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setUrl('https://updated.com');
      expect(annot.getUrl()).toBe('https://updated.com');
    });

    it('setDestination updates the dest', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setDestination(7, 'FitV');
      const dest = annot.getDestination() as [number, string];
      expect(dest[0]).toBe(7);
      expect(dest[1]).toBe('FitV');
    });

    it('setHighlightMode updates the mode', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setHighlightMode('None');
      expect(annot.getHighlightMode()).toBe('None');
    });
  });
});

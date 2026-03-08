/**
 * Tests for PdfFreeTextAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfFreeTextAnnotation } from '../../../src/annotation/types/freeTextAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
  PdfString,
} from '../../../src/core/pdfObjects.js';

describe('PdfFreeTextAnnotation', () => {
  describe('create', () => {
    it('creates a free text annotation with defaults', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [100, 200, 300, 250],
      });

      expect(annot.getType()).toBe('FreeText');
      expect(annot.getRect()).toEqual([100, 200, 300, 250]);
      expect(annot.getText()).toBe('');
      expect(annot.getAlignment()).toBe('left');
      expect(annot.getFontSize()).toBe(12);
    });

    it('creates with custom text', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [50, 50, 200, 80],
        text: 'Hello, world!',
      });

      expect(annot.getText()).toBe('Hello, world!');
    });

    it('creates with custom font size', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [0, 0, 100, 30],
        fontSize: 24,
      });

      expect(annot.getFontSize()).toBe(24);
    });

    it('creates with custom alignment', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [0, 0, 200, 50],
        alignment: 'center',
      });

      expect(annot.getAlignment()).toBe('center');
    });

    it('creates with custom default appearance', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [0, 0, 200, 50],
        defaultAppearance: '1 0 0 rg /Cour 18 Tf',
      });

      expect(annot.getDefaultAppearance()).toBe('1 0 0 rg /Cour 18 Tf');
      expect(annot.getFontSize()).toBe(18);
    });

    it('creates with all options combined', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [10, 20, 300, 60],
        text: 'Full options test',
        fontSize: 16,
        alignment: 'right',
      });

      expect(annot.getText()).toBe('Full options test');
      expect(annot.getFontSize()).toBe(16);
      expect(annot.getAlignment()).toBe('right');
    });
  });

  describe('fromDict', () => {
    it('parses a free text annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FreeText'));
      dict.set('/Rect', PdfArray.fromNumbers([10, 20, 200, 50]));
      dict.set('/DA', PdfString.literal('0 0 1 rg /Helv 14 Tf'));
      dict.set('/Q', PdfNumber.of(1));
      dict.set('/Contents', PdfString.literal('Parsed text'));

      const annot = PdfFreeTextAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('FreeText');
      expect(annot.getDefaultAppearance()).toBe('0 0 1 rg /Helv 14 Tf');
      expect(annot.getAlignment()).toBe('center');
      expect(annot.getText()).toBe('Parsed text');
      expect(annot.getFontSize()).toBe(14);
    });

    it('defaults alignment to left when /Q is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FreeText'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

      const annot = PdfFreeTextAnnotation.fromDict(dict);
      expect(annot.getAlignment()).toBe('left');
    });

    it('defaults DA when /DA is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FreeText'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

      const annot = PdfFreeTextAnnotation.fromDict(dict);
      expect(annot.getDefaultAppearance()).toBe('0 0 0 rg /Helv 12 Tf');
    });
  });

  describe('setters', () => {
    it('setText updates the text content', () => {
      const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 100, 30] });
      expect(annot.getText()).toBe('');

      annot.setText('Updated text');
      expect(annot.getText()).toBe('Updated text');
    });

    it('setAlignment changes the alignment', () => {
      const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 100, 30] });
      expect(annot.getAlignment()).toBe('left');

      annot.setAlignment('center');
      expect(annot.getAlignment()).toBe('center');

      annot.setAlignment('right');
      expect(annot.getAlignment()).toBe('right');

      annot.setAlignment('left');
      expect(annot.getAlignment()).toBe('left');
    });

    it('setFontSize updates the font size in the DA string', () => {
      const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 100, 30] });
      expect(annot.getFontSize()).toBe(12);

      annot.setFontSize(20);
      expect(annot.getFontSize()).toBe(20);
    });

    it('setDefaultAppearance replaces the DA string', () => {
      const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 100, 30] });
      annot.setDefaultAppearance('1 0 0 rg /TimesRoman 10 Tf');
      expect(annot.getDefaultAppearance()).toBe('1 0 0 rg /TimesRoman 10 Tf');
      expect(annot.getFontSize()).toBe(10);
    });
  });

  describe('alignment round-trips', () => {
    it('round-trips all alignment values', () => {
      const alignments = ['left', 'center', 'right'] as const;
      for (const align of alignments) {
        const annot = PdfFreeTextAnnotation.create({
          rect: [0, 0, 100, 30],
          alignment: align,
        });
        expect(annot.getAlignment()).toBe(align);
      }
    });
  });

  describe('inherited base properties', () => {
    it('supports color via base class', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [0, 0, 100, 30],
        color: { r: 1, g: 0, b: 0 },
      });
      expect(annot.getColor()).toEqual({ r: 1, g: 0, b: 0 });
    });

    it('supports opacity via base class', () => {
      const annot = PdfFreeTextAnnotation.create({
        rect: [0, 0, 100, 30],
        opacity: 0.5,
      });
      expect(annot.getOpacity()).toBe(0.5);
    });
  });
});

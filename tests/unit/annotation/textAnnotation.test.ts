/**
 * Tests for PdfTextAnnotation (sticky notes).
 */

import { describe, it, expect } from 'vitest';
import { PdfTextAnnotation } from '../../../src/annotation/types/textAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfBool,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

describe('PdfTextAnnotation', () => {
  describe('create', () => {
    it('creates a text annotation with defaults', () => {
      const annot = PdfTextAnnotation.create({
        rect: [100, 200, 120, 220],
      });

      expect(annot.getType()).toBe('Text');
      expect(annot.getRect()).toEqual([100, 200, 120, 220]);
      expect(annot.getIcon()).toBe('Note'); // default icon
      expect(annot.isOpen()).toBe(false);   // default closed
    });

    it('creates with custom icon and open state', () => {
      const annot = PdfTextAnnotation.create({
        rect: [50, 50, 70, 70],
        contents: 'Important',
        icon: 'Comment',
        open: true,
      });

      expect(annot.getIcon()).toBe('Comment');
      expect(annot.isOpen()).toBe(true);
      expect(annot.getContents()).toBe('Important');
    });

    it('creates with all icon types', () => {
      const icons = ['Comment', 'Key', 'Note', 'Help', 'NewParagraph', 'Paragraph', 'Insert'] as const;
      for (const icon of icons) {
        const annot = PdfTextAnnotation.create({
          rect: [0, 0, 20, 20],
          icon,
        });
        expect(annot.getIcon()).toBe(icon);
      }
    });
  });

  describe('fromDict', () => {
    it('parses a text annotation dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Text'));
      dict.set('/Rect', PdfArray.fromNumbers([10, 20, 30, 40]));
      dict.set('/Contents', PdfString.literal('A sticky note'));
      dict.set('/Name', PdfName.of('Help'));
      dict.set('/Open', PdfBool.of(true));

      const annot = PdfTextAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Text');
      expect(annot.getContents()).toBe('A sticky note');
      expect(annot.getIcon()).toBe('Help');
      expect(annot.isOpen()).toBe(true);
    });
  });

  describe('setters', () => {
    it('setIcon changes the icon', () => {
      const annot = PdfTextAnnotation.create({ rect: [0, 0, 20, 20] });
      annot.setIcon('Key');
      expect(annot.getIcon()).toBe('Key');
    });

    it('setOpen toggles the open state', () => {
      const annot = PdfTextAnnotation.create({ rect: [0, 0, 20, 20] });
      annot.setOpen(true);
      expect(annot.isOpen()).toBe(true);
      annot.setOpen(false);
      expect(annot.isOpen()).toBe(false);
    });
  });
});

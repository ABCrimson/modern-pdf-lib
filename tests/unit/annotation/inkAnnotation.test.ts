/**
 * Tests for PdfInkAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfInkAnnotation } from '../../../src/annotation/types/inkAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

describe('PdfInkAnnotation', () => {
  describe('create', () => {
    it('creates an ink annotation with defaults', () => {
      const annot = PdfInkAnnotation.create({
        rect: [50, 50, 300, 200],
      });

      expect(annot.getType()).toBe('Ink');
      expect(annot.getRect()).toEqual([50, 50, 300, 200]);
      expect(annot.getInkLists()).toEqual([]);
    });

    it('creates with a single ink list', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 200, 200],
        inkLists: [[10, 20, 30, 40, 50, 60]],
      });

      const lists = annot.getInkLists();
      expect(lists).toHaveLength(1);
      expect(lists[0]).toEqual([10, 20, 30, 40, 50, 60]);
    });

    it('creates with multiple ink lists', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 400, 400],
        inkLists: [
          [10, 10, 20, 20],
          [100, 100, 150, 150, 200, 200],
          [50, 50, 75, 75],
        ],
      });

      const lists = annot.getInkLists();
      expect(lists).toHaveLength(3);
      expect(lists[0]).toEqual([10, 10, 20, 20]);
      expect(lists[1]).toEqual([100, 100, 150, 150, 200, 200]);
      expect(lists[2]).toEqual([50, 50, 75, 75]);
    });
  });

  describe('fromDict', () => {
    it('parses an ink annotation dictionary with ink lists', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Ink'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 100]));

      const innerList = PdfArray.fromNumbers([5, 10, 15, 20, 25, 30]);
      const inkList = new PdfArray();
      inkList.push(innerList);
      dict.set('/InkList', inkList);

      const annot = PdfInkAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('Ink');
      const lists = annot.getInkLists();
      expect(lists).toHaveLength(1);
      expect(lists[0]).toEqual([5, 10, 15, 20, 25, 30]);
    });

    it('returns empty array when /InkList is absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Ink'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 50, 50]));

      const annot = PdfInkAnnotation.fromDict(dict);
      expect(annot.getInkLists()).toEqual([]);
    });

    it('parses multiple ink list paths', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Ink'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 200]));

      const path1 = PdfArray.fromNumbers([10, 10, 20, 20]);
      const path2 = PdfArray.fromNumbers([30, 30, 40, 40]);
      const inkList = new PdfArray();
      inkList.push(path1);
      inkList.push(path2);
      dict.set('/InkList', inkList);

      const annot = PdfInkAnnotation.fromDict(dict);
      const lists = annot.getInkLists();
      expect(lists).toHaveLength(2);
      expect(lists[0]).toEqual([10, 10, 20, 20]);
      expect(lists[1]).toEqual([30, 30, 40, 40]);
    });
  });

  describe('addInkList', () => {
    it('adds a new ink list to an empty annotation', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
      });
      expect(annot.getInkLists()).toHaveLength(0);

      annot.addInkList([10, 20, 30, 40]);
      expect(annot.getInkLists()).toHaveLength(1);
      expect(annot.getInkLists()[0]).toEqual([10, 20, 30, 40]);
    });

    it('appends additional ink lists', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
        inkLists: [[1, 2, 3, 4]],
      });

      annot.addInkList([5, 6, 7, 8]);
      const lists = annot.getInkLists();
      expect(lists).toHaveLength(2);
      expect(lists[0]).toEqual([1, 2, 3, 4]);
      expect(lists[1]).toEqual([5, 6, 7, 8]);
    });
  });

  describe('clearInkLists', () => {
    it('removes all ink lists', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
        inkLists: [
          [10, 10, 20, 20],
          [30, 30, 40, 40],
        ],
      });
      expect(annot.getInkLists()).toHaveLength(2);

      annot.clearInkLists();
      expect(annot.getInkLists()).toEqual([]);
    });

    it('clear then add works correctly', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
        inkLists: [[1, 2, 3, 4]],
      });

      annot.clearInkLists();
      expect(annot.getInkLists()).toEqual([]);

      annot.addInkList([99, 99, 100, 100]);
      expect(annot.getInkLists()).toHaveLength(1);
      expect(annot.getInkLists()[0]).toEqual([99, 99, 100, 100]);
    });
  });

  describe('inherited base properties', () => {
    it('supports contents via base class', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
        contents: 'A freehand scribble',
      });
      expect(annot.getContents()).toBe('A freehand scribble');
    });

    it('supports color via base class', () => {
      const annot = PdfInkAnnotation.create({
        rect: [0, 0, 100, 100],
        color: { r: 0, g: 0, b: 1 },
      });
      expect(annot.getColor()).toEqual({ r: 0, g: 0, b: 1 });
    });
  });
});

/**
 * Tests for PdfRadioGroup — radio button group operations.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
} from '../../../src/core/pdfObjects.js';
import { PdfRadioGroup } from '../../../src/form/fields/radioGroup.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRadioWidget(optionName: string, rect: [number, number, number, number]): PdfDict {
  const widget = new PdfDict();
  widget.set('/Subtype', PdfName.of('Widget'));
  widget.set('/Rect', PdfArray.fromNumbers(rect));
  widget.set('/AS', PdfName.of('Off'));

  // /AP /N dict with option name and Off
  const nDict = new PdfDict();
  nDict.set(`/${optionName}`, PdfStream.fromString(''));
  nDict.set('/Off', PdfStream.fromString(''));
  const apDict = new PdfDict();
  apDict.set('/N', nDict);
  widget.set('/AP', apDict);

  return widget;
}

function makeRadioGroup(
  name: string,
  options: string[],
  selected?: string,
): PdfRadioGroup {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/Ff', PdfNumber.of(FieldFlags.Radio));
  dict.set('/T', PdfString.literal(name));

  if (selected !== undefined) {
    dict.set('/V', PdfName.of(selected));
  }

  const widgets = options.map((opt, i) =>
    makeRadioWidget(opt, [10, 10 + i * 25, 30, 30 + i * 25]),
  );

  // Set /AS on the selected widget
  if (selected !== undefined) {
    const idx = options.indexOf(selected);
    if (idx >= 0 && widgets[idx] !== undefined) {
      widgets[idx]!.set('/AS', PdfName.of(selected));
    }
  }

  const firstWidget = widgets[0]!;
  dict.set('/Rect', firstWidget.get('/Rect')!);

  return new PdfRadioGroup(name, dict, firstWidget, [], widgets);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfRadioGroup', () => {
  it('has fieldType "radio"', () => {
    const rg = makeRadioGroup('size', ['S', 'M', 'L']);
    expect(rg.fieldType).toBe('radio');
  });

  // -------------------------------------------------------------------------
  // Options
  // -------------------------------------------------------------------------

  describe('getOptions', () => {
    it('returns option names from widgets', () => {
      const rg = makeRadioGroup('size', ['Small', 'Medium', 'Large']);
      expect(rg.getOptions()).toEqual(['Small', 'Medium', 'Large']);
    });

    it('returns empty array for no widgets', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Btn'));
      dict.set('/Ff', PdfNumber.of(FieldFlags.Radio));
      dict.set('/T', PdfString.literal('empty'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));
      const widgetDict = new PdfDict();
      widgetDict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));
      const rg = new PdfRadioGroup('empty', dict, widgetDict, [], [widgetDict]);
      expect(rg.getOptions()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  describe('getSelected', () => {
    it('returns undefined when nothing is selected', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      expect(rg.getSelected()).toBeUndefined();
    });

    it('returns the selected option', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L'], 'M');
      expect(rg.getSelected()).toBe('M');
    });
  });

  describe('select', () => {
    it('selects an option', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      rg.select('L');
      expect(rg.getSelected()).toBe('L');
    });

    it('changes selection from one option to another', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L'], 'S');
      rg.select('M');
      expect(rg.getSelected()).toBe('M');
    });
  });

  // -------------------------------------------------------------------------
  // getValue / setValue
  // -------------------------------------------------------------------------

  describe('getValue / setValue', () => {
    it('getValue returns selected option name or empty string', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      expect(rg.getValue()).toBe('');

      rg.select('S');
      expect(rg.getValue()).toBe('S');
    });

    it('setValue selects the option', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      rg.setValue('L');
      expect(rg.getSelected()).toBe('L');
    });
  });

  // -------------------------------------------------------------------------
  // Widgets
  // -------------------------------------------------------------------------

  describe('getWidgets', () => {
    it('returns widget dictionaries', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      expect(rg.getWidgets()).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Appearance
  // -------------------------------------------------------------------------

  describe('generateAppearance', () => {
    it('returns a PdfStream', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L'], 'S');
      const ap = rg.generateAppearance();
      expect(ap).toBeInstanceOf(PdfStream);
    });

    it('appearance dict has /BBox', () => {
      const rg = makeRadioGroup('size', ['S', 'M', 'L']);
      const ap = rg.generateAppearance();
      expect(ap.dict.get('/BBox')).toBeDefined();
    });
  });
});

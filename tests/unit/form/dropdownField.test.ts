/**
 * Tests for PdfDropdownField — dropdown (combo box) field operations.
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
import { PdfDropdownField } from '../../../src/form/fields/dropdownField.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDropdown(
  name: string,
  options: string[],
  opts: {
    selected?: string;
    editable?: boolean;
    rect?: [number, number, number, number];
  } = {},
): PdfDropdownField {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Ch'));
  let ff = FieldFlags.Combo;
  if (opts.editable) {
    ff |= FieldFlags.Edit;
  }
  dict.set('/Ff', PdfNumber.of(ff));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers(opts.rect ?? [0, 0, 200, 30]));
  dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));

  if (opts.selected !== undefined) {
    dict.set('/V', PdfString.literal(opts.selected));
  }

  return new PdfDropdownField(name, dict, dict);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfDropdownField', () => {
  it('has fieldType "dropdown"', () => {
    const dd = makeDropdown('color', ['Red', 'Blue']);
    expect(dd.fieldType).toBe('dropdown');
  });

  // -------------------------------------------------------------------------
  // Options
  // -------------------------------------------------------------------------

  describe('getOptions', () => {
    it('returns option strings', () => {
      const dd = makeDropdown('color', ['Red', 'Blue', 'Green']);
      expect(dd.getOptions()).toEqual(['Red', 'Blue', 'Green']);
    });

    it('returns empty array when /Opt is missing', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Ch'));
      dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
      dict.set('/T', PdfString.literal('test'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
      const dd = new PdfDropdownField('test', dict, dict);
      expect(dd.getOptions()).toEqual([]);
    });
  });

  describe('setOptions', () => {
    it('replaces the options', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      dd.setOptions(['Yellow', 'Purple', 'Orange']);
      expect(dd.getOptions()).toEqual(['Yellow', 'Purple', 'Orange']);
    });
  });

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  describe('getSelected', () => {
    it('returns empty string when nothing is selected', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      expect(dd.getSelected()).toBe('');
    });

    it('returns the selected value', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], { selected: 'Blue' });
      expect(dd.getSelected()).toBe('Blue');
    });
  });

  describe('select', () => {
    it('updates the selected value', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      dd.select('Red');
      expect(dd.getSelected()).toBe('Red');
    });

    it('changes selection', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], { selected: 'Red' });
      dd.select('Blue');
      expect(dd.getSelected()).toBe('Blue');
    });
  });

  // -------------------------------------------------------------------------
  // getValue / setValue
  // -------------------------------------------------------------------------

  describe('getValue / setValue', () => {
    it('getValue returns selected string', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], { selected: 'Red' });
      expect(dd.getValue()).toBe('Red');
    });

    it('setValue selects the option', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      dd.setValue('Blue');
      expect(dd.getSelected()).toBe('Blue');
    });
  });

  // -------------------------------------------------------------------------
  // Editable
  // -------------------------------------------------------------------------

  describe('isEditable', () => {
    it('returns false by default', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      expect(dd.isEditable()).toBe(false);
    });

    it('returns true when Edit flag is set', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], { editable: true });
      expect(dd.isEditable()).toBe(true);
    });
  });

  describe('setEditable', () => {
    it('enables editable mode', () => {
      const dd = makeDropdown('color', ['Red', 'Blue']);
      dd.setEditable(true);
      expect(dd.isEditable()).toBe(true);
    });

    it('disables editable mode', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], { editable: true });
      dd.setEditable(false);
      expect(dd.isEditable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Appearance
  // -------------------------------------------------------------------------

  describe('generateAppearance', () => {
    it('returns a PdfStream', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], {
        selected: 'Red',
        rect: [0, 0, 200, 30],
      });
      const ap = dd.generateAppearance();
      expect(ap).toBeInstanceOf(PdfStream);
    });

    it('stream contains selected value text', () => {
      const dd = makeDropdown('color', ['Red', 'Blue'], {
        selected: 'Red',
        rect: [0, 0, 200, 30],
      });
      const ap = dd.generateAppearance();
      const content = new TextDecoder().decode(ap.data);
      expect(content).toContain('Red');
    });
  });

  // -------------------------------------------------------------------------
  // Two-element /Opt arrays
  // -------------------------------------------------------------------------

  describe('two-element /Opt arrays', () => {
    it('returns display values from two-element arrays', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Ch'));
      dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
      dict.set('/T', PdfString.literal('test'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));

      // /Opt with two-element arrays [export, display]
      const opt = PdfArray.of([
        PdfArray.of([PdfString.literal('us'), PdfString.literal('United States')]),
        PdfArray.of([PdfString.literal('uk'), PdfString.literal('United Kingdom')]),
      ]);
      dict.set('/Opt', opt);

      const dd = new PdfDropdownField('test', dict, dict);
      expect(dd.getOptions()).toEqual(['United States', 'United Kingdom']);
    });
  });
});

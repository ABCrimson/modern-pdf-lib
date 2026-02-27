/**
 * Tests for PdfCheckboxField — checkbox form field operations.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfArray,
  PdfStream,
} from '../../../src/core/pdfObjects.js';
import { PdfCheckboxField } from '../../../src/form/fields/checkboxField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheckbox(
  name: string,
  options: {
    checked?: boolean;
    onValue?: string;
    rect?: [number, number, number, number];
  } = {},
): PdfCheckboxField {
  const checked = options.checked ?? false;
  const onValue = options.onValue ?? 'Yes';
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers(options.rect ?? [0, 0, 20, 20]));
  dict.set('/V', PdfName.of(checked ? onValue : 'Off'));
  dict.set('/AS', PdfName.of(checked ? onValue : 'Off'));

  // Create /AP /N with onValue and Off keys
  const nDict = new PdfDict();
  nDict.set(`/${onValue}`, PdfStream.fromString(''));
  nDict.set('/Off', PdfStream.fromString(''));
  const apDict = new PdfDict();
  apDict.set('/N', nDict);
  dict.set('/AP', apDict);

  return new PdfCheckboxField(name, dict, dict);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfCheckboxField', () => {
  it('has fieldType "checkbox"', () => {
    const cb = makeCheckbox('test');
    expect(cb.fieldType).toBe('checkbox');
  });

  // -------------------------------------------------------------------------
  // Checked state
  // -------------------------------------------------------------------------

  describe('isChecked', () => {
    it('returns false when unchecked', () => {
      const cb = makeCheckbox('agree', { checked: false });
      expect(cb.isChecked()).toBe(false);
    });

    it('returns true when checked', () => {
      const cb = makeCheckbox('agree', { checked: true });
      expect(cb.isChecked()).toBe(true);
    });
  });

  describe('check / uncheck / toggle', () => {
    it('check sets checked state', () => {
      const cb = makeCheckbox('agree', { checked: false });
      cb.check();
      expect(cb.isChecked()).toBe(true);
    });

    it('uncheck clears checked state', () => {
      const cb = makeCheckbox('agree', { checked: true });
      cb.uncheck();
      expect(cb.isChecked()).toBe(false);
    });

    it('toggle flips from unchecked to checked', () => {
      const cb = makeCheckbox('agree', { checked: false });
      cb.toggle();
      expect(cb.isChecked()).toBe(true);
    });

    it('toggle flips from checked to unchecked', () => {
      const cb = makeCheckbox('agree', { checked: true });
      cb.toggle();
      expect(cb.isChecked()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // On value
  // -------------------------------------------------------------------------

  describe('getOnValue', () => {
    it('returns "Yes" for standard checkboxes', () => {
      const cb = makeCheckbox('agree');
      expect(cb.getOnValue()).toBe('Yes');
    });

    it('returns custom on value from /AP /N', () => {
      const cb = makeCheckbox('agree', { onValue: 'Accepted' });
      expect(cb.getOnValue()).toBe('Accepted');
    });
  });

  // -------------------------------------------------------------------------
  // getValue / setValue
  // -------------------------------------------------------------------------

  describe('getValue / setValue', () => {
    it('getValue returns boolean', () => {
      const cbUnchecked = makeCheckbox('a', { checked: false });
      expect(cbUnchecked.getValue()).toBe(false);

      const cbChecked = makeCheckbox('b', { checked: true });
      expect(cbChecked.getValue()).toBe(true);
    });

    it('setValue(true) checks the box', () => {
      const cb = makeCheckbox('a', { checked: false });
      cb.setValue(true);
      expect(cb.isChecked()).toBe(true);
    });

    it('setValue(false) unchecks the box', () => {
      const cb = makeCheckbox('a', { checked: true });
      cb.setValue(false);
      expect(cb.isChecked()).toBe(false);
    });

    it('setValue("Off") unchecks', () => {
      const cb = makeCheckbox('a', { checked: true });
      cb.setValue('Off');
      expect(cb.isChecked()).toBe(false);
    });

    it('setValue("Yes") checks', () => {
      const cb = makeCheckbox('a', { checked: false });
      cb.setValue('Yes');
      expect(cb.isChecked()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Appearance generation
  // -------------------------------------------------------------------------

  describe('generateAppearance', () => {
    it('generates a PdfStream for checked state', () => {
      const cb = makeCheckbox('test', { checked: true, rect: [0, 0, 20, 20] });
      const ap = cb.generateAppearance();
      expect(ap).toBeInstanceOf(PdfStream);
      const content = new TextDecoder().decode(ap.data);
      // Checked should have path operators (checkmark)
      expect(content).toContain('S'); // stroke
    });

    it('generates a PdfStream for unchecked state', () => {
      const cb = makeCheckbox('test', { checked: false, rect: [0, 0, 20, 20] });
      const ap = cb.generateAppearance();
      expect(ap).toBeInstanceOf(PdfStream);
    });

    it('appearance dict has /BBox', () => {
      const cb = makeCheckbox('test', { rect: [0, 0, 20, 20] });
      const ap = cb.generateAppearance();
      expect(ap.dict.get('/BBox')).toBeDefined();
    });
  });
});

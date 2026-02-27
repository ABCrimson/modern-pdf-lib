/**
 * Tests for PdfTextField — text form field operations.
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
import { PdfTextField } from '../../../src/form/fields/textField.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextField(
  name: string,
  options: {
    value?: string;
    da?: string;
    q?: number;
    ff?: number;
    maxLen?: number;
    rect?: [number, number, number, number];
  } = {},
): PdfTextField {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers(options.rect ?? [0, 0, 200, 30]));

  if (options.value !== undefined) {
    dict.set('/V', PdfString.literal(options.value));
  }
  if (options.da !== undefined) {
    dict.set('/DA', PdfString.literal(options.da));
  }
  if (options.q !== undefined) {
    dict.set('/Q', PdfNumber.of(options.q));
  }
  if (options.ff !== undefined) {
    dict.set('/Ff', PdfNumber.of(options.ff));
  }
  if (options.maxLen !== undefined) {
    dict.set('/MaxLen', PdfNumber.of(options.maxLen));
  }

  return new PdfTextField(name, dict, dict);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfTextField', () => {
  it('has fieldType "text"', () => {
    const tf = makeTextField('test');
    expect(tf.fieldType).toBe('text');
  });

  // -------------------------------------------------------------------------
  // Value
  // -------------------------------------------------------------------------

  describe('getText / setText', () => {
    it('returns empty string when no value set', () => {
      const tf = makeTextField('name');
      expect(tf.getText()).toBe('');
    });

    it('returns the value when set', () => {
      const tf = makeTextField('name', { value: 'John Doe' });
      expect(tf.getText()).toBe('John Doe');
    });

    it('setText updates the value', () => {
      const tf = makeTextField('name');
      tf.setText('Alice');
      expect(tf.getText()).toBe('Alice');
    });

    it('getValue is alias for getText', () => {
      const tf = makeTextField('name', { value: 'Bob' });
      expect(tf.getValue()).toBe('Bob');
    });

    it('setValue is alias for setText', () => {
      const tf = makeTextField('name');
      tf.setValue('Carol');
      expect(tf.getText()).toBe('Carol');
    });

    it('setValue converts boolean to string', () => {
      const tf = makeTextField('flag');
      tf.setValue(true);
      expect(tf.getText()).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // Font properties
  // -------------------------------------------------------------------------

  describe('font size', () => {
    it('returns 0 when no /DA is set', () => {
      const tf = makeTextField('test');
      expect(tf.getFontSize()).toBe(0);
    });

    it('parses font size from /DA string', () => {
      const tf = makeTextField('test', { da: '/Helv 12 Tf 0 g' });
      expect(tf.getFontSize()).toBe(12);
    });

    it('setFontSize updates the /DA string', () => {
      const tf = makeTextField('test');
      tf.setFontSize(14);
      expect(tf.getFontSize()).toBe(14);
    });
  });

  describe('font name', () => {
    it('returns "Helv" by default', () => {
      const tf = makeTextField('test');
      expect(tf.getFontName()).toBe('Helv');
    });

    it('parses font name from /DA', () => {
      const tf = makeTextField('test', { da: '/TimesNewRoman 10 Tf 0 g' });
      expect(tf.getFontName()).toBe('TimesNewRoman');
    });
  });

  // -------------------------------------------------------------------------
  // Alignment
  // -------------------------------------------------------------------------

  describe('alignment', () => {
    it('defaults to "left" when /Q is not set', () => {
      const tf = makeTextField('test');
      expect(tf.getAlignment()).toBe('left');
    });

    it('returns "center" for /Q 1', () => {
      const tf = makeTextField('test', { q: 1 });
      expect(tf.getAlignment()).toBe('center');
    });

    it('returns "right" for /Q 2', () => {
      const tf = makeTextField('test', { q: 2 });
      expect(tf.getAlignment()).toBe('right');
    });

    it('setAlignment updates /Q', () => {
      const tf = makeTextField('test');
      tf.setAlignment('center');
      expect(tf.getAlignment()).toBe('center');

      tf.setAlignment('right');
      expect(tf.getAlignment()).toBe('right');

      tf.setAlignment('left');
      expect(tf.getAlignment()).toBe('left');
    });
  });

  // -------------------------------------------------------------------------
  // Field flags
  // -------------------------------------------------------------------------

  describe('multiline', () => {
    it('returns false by default', () => {
      const tf = makeTextField('test');
      expect(tf.isMultiline()).toBe(false);
    });

    it('returns true when Multiline flag is set', () => {
      const tf = makeTextField('test', { ff: FieldFlags.Multiline });
      expect(tf.isMultiline()).toBe(true);
    });

    it('setMultiline toggles the flag', () => {
      const tf = makeTextField('test');
      tf.setMultiline(true);
      expect(tf.isMultiline()).toBe(true);
      tf.setMultiline(false);
      expect(tf.isMultiline()).toBe(false);
    });
  });

  describe('password', () => {
    it('returns false by default', () => {
      const tf = makeTextField('test');
      expect(tf.isPassword()).toBe(false);
    });

    it('returns true when Password flag is set', () => {
      const tf = makeTextField('test', { ff: FieldFlags.Password });
      expect(tf.isPassword()).toBe(true);
    });
  });

  describe('readOnly', () => {
    it('returns false by default', () => {
      const tf = makeTextField('test');
      expect(tf.isReadOnly()).toBe(false);
    });

    it('setReadOnly toggles the flag', () => {
      const tf = makeTextField('test');
      tf.setReadOnly(true);
      expect(tf.isReadOnly()).toBe(true);
      tf.setReadOnly(false);
      expect(tf.isReadOnly()).toBe(false);
    });
  });

  describe('required', () => {
    it('returns false by default', () => {
      const tf = makeTextField('test');
      expect(tf.isRequired()).toBe(false);
    });

    it('setRequired toggles the flag', () => {
      const tf = makeTextField('test');
      tf.setRequired(true);
      expect(tf.isRequired()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Max length
  // -------------------------------------------------------------------------

  describe('maxLength', () => {
    it('returns undefined when /MaxLen is not set', () => {
      const tf = makeTextField('test');
      expect(tf.getMaxLength()).toBeUndefined();
    });

    it('returns the max length when set', () => {
      const tf = makeTextField('test', { maxLen: 50 });
      expect(tf.getMaxLength()).toBe(50);
    });

    it('setMaxLength updates /MaxLen', () => {
      const tf = makeTextField('test');
      tf.setMaxLength(100);
      expect(tf.getMaxLength()).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Full name
  // -------------------------------------------------------------------------

  describe('fullName', () => {
    it('returns name when no parents', () => {
      const tf = makeTextField('email');
      expect(tf.getFullName()).toBe('email');
    });

    it('returns dotted name with parents', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Tx'));
      dict.set('/T', PdfString.literal('first'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
      const tf = new PdfTextField('first', dict, dict, ['person', 'name']);
      expect(tf.getFullName()).toBe('person.name.first');
    });
  });

  // -------------------------------------------------------------------------
  // Appearance generation
  // -------------------------------------------------------------------------

  describe('generateAppearance', () => {
    it('returns a PdfStream', () => {
      const tf = makeTextField('test', { value: 'Hello', rect: [0, 0, 200, 30] });
      const ap = tf.generateAppearance();
      expect(ap).toBeInstanceOf(PdfStream);
    });

    it('stream contains text operators', () => {
      const tf = makeTextField('test', { value: 'Hello', rect: [0, 0, 200, 30] });
      const ap = tf.generateAppearance();
      const content = new TextDecoder().decode(ap.data);
      expect(content).toContain('BT');
      expect(content).toContain('Tf');
      expect(content).toContain('Hello');
      expect(content).toContain('Tj');
      expect(content).toContain('ET');
    });

    it('stream dict has /Type /XObject /Subtype /Form', () => {
      const tf = makeTextField('test', { value: 'X', rect: [0, 0, 100, 20] });
      const ap = tf.generateAppearance();
      const dict = ap.dict;
      expect(dict.get('/Type')).toBeDefined();
      expect(dict.get('/Subtype')).toBeDefined();
      expect(dict.get('/BBox')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Widget rect
  // -------------------------------------------------------------------------

  describe('getRect', () => {
    it('returns the rect array', () => {
      const tf = makeTextField('test', { rect: [10, 20, 210, 50] });
      expect(tf.getRect()).toEqual([10, 20, 210, 50]);
    });

    it('returns [0,0,0,0] when no /Rect', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Tx'));
      dict.set('/T', PdfString.literal('test'));
      const tf = new PdfTextField('test', dict, dict);
      expect(tf.getRect()).toEqual([0, 0, 0, 0]);
    });
  });
});

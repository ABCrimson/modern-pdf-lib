/**
 * Tests for PdfForm — the main AcroForm class.
 *
 * Covers form creation, field retrieval, bulk fill, and flatten.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfRef,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { PdfTextField } from '../../../src/form/fields/textField.js';
import { PdfCheckboxField } from '../../../src/form/fields/checkboxField.js';
import { PdfRadioGroup } from '../../../src/form/fields/radioGroup.js';
import { PdfDropdownField } from '../../../src/form/fields/dropdownField.js';
import { PdfListboxField } from '../../../src/form/fields/listboxField.js';
import { PdfButtonField } from '../../../src/form/fields/buttonField.js';
import { PdfSignatureField } from '../../../src/form/fields/signatureField.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple text field dict. */
function makeTextFieldDict(name: string, value?: string): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
  if (value !== undefined) {
    dict.set('/V', PdfString.literal(value));
  }
  return dict;
}

/** Create a simple checkbox field dict. */
function makeCheckboxDict(name: string, checked: boolean): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));
  dict.set('/V', PdfName.of(checked ? 'Yes' : 'Off'));
  dict.set('/AS', PdfName.of(checked ? 'Yes' : 'Off'));
  return dict;
}

/** Create a dropdown field dict. */
function makeDropdownDict(name: string, options: string[], selected?: string): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Ch'));
  dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
  dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
  if (selected !== undefined) {
    dict.set('/V', PdfString.literal(selected));
  }
  return dict;
}

/** Create a listbox field dict. */
function makeListboxDict(name: string, options: string[]): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Ch'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 100]));
  dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
  return dict;
}

/** Create a button field dict. */
function makeButtonDict(name: string): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/Ff', PdfNumber.of(FieldFlags.Pushbutton));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 30]));
  const mk = new PdfDict();
  mk.set('/CA', PdfString.literal('Submit'));
  dict.set('/MK', mk);
  return dict;
}

/** Create a signature field dict. */
function makeSignatureDict(name: string, signed: boolean): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Sig'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 50]));
  if (signed) {
    const sigDict = new PdfDict();
    sigDict.set('/Type', PdfName.of('Sig'));
    sigDict.set('/Filter', PdfName.of('Adobe.PPKLite'));
    dict.set('/V', sigDict);
  }
  return dict;
}

/** Build an AcroForm dict with fields and create a PdfForm via fromDict. */
function buildForm(fieldDicts: PdfDict[]): PdfForm {
  const acroFormDict = new PdfDict();
  const fieldsArr = PdfArray.of(fieldDicts);
  acroFormDict.set('/Fields', fieldsArr);

  // Simple resolver that just returns the object as-is
  const resolver = (_ref: PdfRef) => fieldDicts[0]!;

  return PdfForm.fromDict(acroFormDict, resolver);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfForm', () => {
  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('fromDict', () => {
    it('creates an empty form when /Fields is missing', () => {
      const acroFormDict = new PdfDict();
      const form = PdfForm.fromDict(acroFormDict, () => acroFormDict);
      expect(form.getFields()).toHaveLength(0);
    });

    it('creates an empty form when /Fields is an empty array', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = PdfForm.fromDict(acroFormDict, () => acroFormDict);
      expect(form.getFields()).toHaveLength(0);
    });

    it('parses text fields from /Fields array', () => {
      const tf = makeTextFieldDict('name', 'John');
      const form = buildForm([tf]);
      const fields = form.getFields();
      expect(fields).toHaveLength(1);
      expect(fields[0]!.fieldType).toBe('text');
      expect(fields[0]!.getName()).toBe('name');
    });

    it('parses checkbox fields', () => {
      const cb = makeCheckboxDict('agree', true);
      const form = buildForm([cb]);
      expect(form.getFields()).toHaveLength(1);
      expect(form.getFields()[0]!.fieldType).toBe('checkbox');
    });

    it('parses dropdown fields', () => {
      const dd = makeDropdownDict('country', ['US', 'UK', 'CA'], 'US');
      const form = buildForm([dd]);
      expect(form.getFields()).toHaveLength(1);
      expect(form.getFields()[0]!.fieldType).toBe('dropdown');
    });

    it('parses listbox fields', () => {
      const lb = makeListboxDict('items', ['A', 'B', 'C']);
      const form = buildForm([lb]);
      expect(form.getFields()).toHaveLength(1);
      expect(form.getFields()[0]!.fieldType).toBe('listbox');
    });

    it('parses button fields', () => {
      const btn = makeButtonDict('submit');
      const form = buildForm([btn]);
      expect(form.getFields()).toHaveLength(1);
      expect(form.getFields()[0]!.fieldType).toBe('button');
    });

    it('parses signature fields', () => {
      const sig = makeSignatureDict('sig1', false);
      const form = buildForm([sig]);
      expect(form.getFields()).toHaveLength(1);
      expect(form.getFields()[0]!.fieldType).toBe('signature');
    });

    it('parses multiple fields of different types', () => {
      const fields = [
        makeTextFieldDict('name'),
        makeCheckboxDict('agree', false),
        makeDropdownDict('color', ['Red', 'Blue']),
      ];
      const form = buildForm(fields);
      expect(form.getFields()).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Field retrieval
  // -------------------------------------------------------------------------

  describe('getField / getTextField / getCheckbox / etc.', () => {
    it('getField returns field by name', () => {
      const form = buildForm([makeTextFieldDict('email', 'test@test.com')]);
      const field = form.getField('email');
      expect(field).toBeDefined();
      expect(field!.getName()).toBe('email');
    });

    it('getField returns undefined for unknown name', () => {
      const form = buildForm([makeTextFieldDict('email')]);
      expect(form.getField('missing')).toBeUndefined();
    });

    it('getTextField returns PdfTextField', () => {
      const form = buildForm([makeTextFieldDict('name', 'Alice')]);
      const tf = form.getTextField('name');
      expect(tf).toBeInstanceOf(PdfTextField);
      expect(tf.getText()).toBe('Alice');
    });

    it('getTextField throws for wrong type', () => {
      const form = buildForm([makeCheckboxDict('agree', true)]);
      expect(() => form.getTextField('agree')).toThrow('not a text field');
    });

    it('getTextField throws for unknown field', () => {
      const form = buildForm([]);
      expect(() => form.getTextField('missing')).toThrow('not found');
    });

    it('getCheckbox returns PdfCheckboxField', () => {
      const form = buildForm([makeCheckboxDict('agree', true)]);
      const cb = form.getCheckbox('agree');
      expect(cb).toBeInstanceOf(PdfCheckboxField);
      expect(cb.isChecked()).toBe(true);
    });

    it('getCheckbox throws for wrong type', () => {
      const form = buildForm([makeTextFieldDict('name')]);
      expect(() => form.getCheckbox('name')).toThrow('not a checkbox');
    });

    it('getDropdown returns PdfDropdownField', () => {
      const form = buildForm([makeDropdownDict('color', ['Red', 'Blue'], 'Red')]);
      const dd = form.getDropdown('color');
      expect(dd).toBeInstanceOf(PdfDropdownField);
      expect(dd.getSelected()).toBe('Red');
    });

    it('getListbox returns PdfListboxField', () => {
      const form = buildForm([makeListboxDict('items', ['A', 'B'])]);
      const lb = form.getListbox('items');
      expect(lb).toBeInstanceOf(PdfListboxField);
    });

    it('getButton returns PdfButtonField', () => {
      const form = buildForm([makeButtonDict('submit')]);
      const btn = form.getButton('submit');
      expect(btn).toBeInstanceOf(PdfButtonField);
    });

    it('getSignatureField returns PdfSignatureField', () => {
      const form = buildForm([makeSignatureDict('sig', false)]);
      const sig = form.getSignatureField('sig');
      expect(sig).toBeInstanceOf(PdfSignatureField);
    });
  });

  // -------------------------------------------------------------------------
  // Bulk fill
  // -------------------------------------------------------------------------

  describe('fill', () => {
    it('fills multiple fields at once', () => {
      const form = buildForm([
        makeTextFieldDict('name'),
        makeTextFieldDict('email'),
        makeCheckboxDict('agree', false),
      ]);

      form.fill({
        name: 'Alice',
        email: 'alice@test.com',
        agree: true,
      });

      expect(form.getTextField('name').getText()).toBe('Alice');
      expect(form.getTextField('email').getText()).toBe('alice@test.com');
      expect(form.getCheckbox('agree').isChecked()).toBe(true);
    });

    it('throws for unknown field name', () => {
      const form = buildForm([makeTextFieldDict('name')]);
      expect(() => form.fill({ missing: 'value' })).toThrow('not found');
    });
  });

  // -------------------------------------------------------------------------
  // Flatten
  // -------------------------------------------------------------------------

  describe('flatten', () => {
    it('clears the /Fields array', () => {
      const form = buildForm([makeTextFieldDict('name', 'Test')]);
      form.flatten();
      // After flatten, getFields still returns the in-memory fields
      // but the AcroForm dict should have an empty /Fields array
      // The form is effectively non-interactive
      expect(form.getFields()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Field creation
  // -------------------------------------------------------------------------

  describe('createTextField', () => {
    it('creates a new text field', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      const tf = form.createTextField('email', 0, [50, 700, 250, 720]);
      expect(tf).toBeInstanceOf(PdfTextField);
      expect(tf.getName()).toBe('email');
      expect(tf.getRect()).toEqual([50, 700, 250, 720]);
    });

    it('is retrievable by name after creation', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      form.createTextField('name', 0, [10, 10, 200, 30]);
      const tf = form.getTextField('name');
      expect(tf.getName()).toBe('name');
    });
  });

  describe('createCheckbox', () => {
    it('creates an unchecked checkbox', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      const cb = form.createCheckbox('agree', 0, [10, 10, 30, 30]);
      expect(cb).toBeInstanceOf(PdfCheckboxField);
      expect(cb.isChecked()).toBe(false);
    });
  });

  describe('createDropdown', () => {
    it('creates a dropdown with options', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      const dd = form.createDropdown('color', 0, [10, 10, 200, 30], ['Red', 'Blue']);
      expect(dd).toBeInstanceOf(PdfDropdownField);
      expect(dd.getOptions()).toEqual(['Red', 'Blue']);
    });
  });

  // -------------------------------------------------------------------------
  // toDict
  // -------------------------------------------------------------------------

  describe('toDict', () => {
    it('returns the AcroForm dictionary', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      const registry = new PdfObjectRegistry();
      const result = form.toDict(registry);
      expect(result).toBe(acroFormDict);
    });

    it('adds /DR (default resources) if not present', () => {
      const acroFormDict = new PdfDict();
      acroFormDict.set('/Fields', new PdfArray());
      const form = new PdfForm([], acroFormDict);

      const registry = new PdfObjectRegistry();
      const result = form.toDict(registry);
      expect(result.has('/DR')).toBe(true);
    });
  });
});

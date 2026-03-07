/**
 * Tests for fieldReferences — cross-field reference resolution and proxy API.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfNumber,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import { PdfTextField } from '../../../src/form/fields/textField.js';
import { PdfCheckboxField } from '../../../src/form/fields/checkboxField.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import {
  resolveFieldReference,
  getFieldValue,
  setFieldValue,
  createFieldProxy,
} from '../../../src/form/fieldReferences.js';
import type { FieldRef } from '../../../src/form/fieldReferences.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Annotation flags */
const HIDDEN = 1 << 1;
const PRINT = 1 << 2;
const NOVIEW = 1 << 5;

function makeTextField(
  name: string,
  value?: string,
  parentNames?: string[],
): PdfTextField {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
  if (value !== undefined) {
    dict.set('/V', PdfString.literal(value));
  }
  return new PdfTextField(name, dict, dict, parentNames);
}

function makeCheckbox(name: string, checked: boolean): PdfCheckboxField {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));
  dict.set('/V', PdfName.of(checked ? 'Yes' : 'Off'));
  dict.set('/AS', PdfName.of(checked ? 'Yes' : 'Off'));
  return new PdfCheckboxField(name, dict, dict);
}

function makeForm(fields: (PdfTextField | PdfCheckboxField)[]): PdfForm {
  const acroDict = new PdfDict();
  const fieldsArr = new PdfArray();
  for (const f of fields) {
    fieldsArr.push(f.getDict());
  }
  acroDict.set('/Fields', fieldsArr);
  return new PdfForm(fields, acroDict);
}

function getAnnotFlags(field: PdfTextField | PdfCheckboxField): number {
  const fObj = field.getWidgetDict().get('/F');
  if (fObj !== undefined && fObj.kind === 'number') {
    return (fObj as PdfNumber).value;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// resolveFieldReference
// ---------------------------------------------------------------------------

describe('resolveFieldReference', () => {
  it('resolves a field by name', () => {
    const f1 = makeTextField('firstName', 'John');
    const form = makeForm([f1]);

    const result = resolveFieldReference(form, 'firstName');
    expect(result).not.toBeNull();
    expect(result!.getName()).toBe('firstName');
  });

  it('resolves a field by fully-qualified name', () => {
    const f1 = makeTextField('first', 'John', ['person', 'name']);
    const form = makeForm([f1]);

    const result = resolveFieldReference(form, 'person.name.first');
    expect(result).not.toBeNull();
    expect(result!.getFullName()).toBe('person.name.first');
  });

  it('returns null for non-existent field', () => {
    const form = makeForm([]);
    expect(resolveFieldReference(form, 'missing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getFieldValue
// ---------------------------------------------------------------------------

describe('getFieldValue', () => {
  it('returns the text value', () => {
    const f1 = makeTextField('email', 'user@example.com');
    const form = makeForm([f1]);

    expect(getFieldValue(form, 'email')).toBe('user@example.com');
  });

  it('returns empty string for text field without value', () => {
    const f1 = makeTextField('empty');
    const form = makeForm([f1]);

    expect(getFieldValue(form, 'empty')).toBe('');
  });

  it('returns null for non-existent field', () => {
    const form = makeForm([]);
    expect(getFieldValue(form, 'missing')).toBeNull();
  });

  it('converts boolean to string for checkbox', () => {
    const cb = makeCheckbox('agree', true);
    const form = makeForm([cb]);

    const val = getFieldValue(form, 'agree');
    // Checkbox getValue returns a boolean or string depending on impl
    expect(val).toBeDefined();
    expect(typeof val).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// setFieldValue
// ---------------------------------------------------------------------------

describe('setFieldValue', () => {
  it('sets a text field value', () => {
    const f1 = makeTextField('name');
    const form = makeForm([f1]);

    const result = setFieldValue(form, 'name', 'Alice');
    expect(result).toBe(true);
    expect(f1.getText()).toBe('Alice');
  });

  it('returns false for non-existent field', () => {
    const form = makeForm([]);
    expect(setFieldValue(form, 'missing', 'value')).toBe(false);
  });

  it('updates value that can be read back', () => {
    const f1 = makeTextField('city');
    const form = makeForm([f1]);

    setFieldValue(form, 'city', 'New York');
    expect(getFieldValue(form, 'city')).toBe('New York');
  });
});

// ---------------------------------------------------------------------------
// createFieldProxy
// ---------------------------------------------------------------------------

describe('createFieldProxy', () => {
  it('returns a proxy with getField method', () => {
    const f1 = makeTextField('name', 'Bob');
    const form = makeForm([f1]);
    const proxy = createFieldProxy(form);

    expect(proxy.getField).toBeDefined();
    expect(typeof proxy.getField).toBe('function');
  });

  it('getField returns null for non-existent field', () => {
    const form = makeForm([]);
    const proxy = createFieldProxy(form);

    expect(proxy.getField('missing')).toBeNull();
  });

  describe('FieldRef properties', () => {
    it('.name returns the fully-qualified name', () => {
      const f1 = makeTextField('first', 'John', ['person']);
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('person.first');
      expect(ref).not.toBeNull();
      expect(ref!.name).toBe('person.first');
    });

    it('.value gets the field value', () => {
      const f1 = makeTextField('email', 'test@test.com');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('email');
      expect(ref!.value).toBe('test@test.com');
    });

    it('.value can be set', () => {
      const f1 = makeTextField('email');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('email')!;
      ref.value = 'new@email.com';
      expect(f1.getText()).toBe('new@email.com');
    });

    it('.valueAsString returns string representation', () => {
      const f1 = makeTextField('amount', '42');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('amount')!;
      expect(ref.valueAsString).toBe('42');
    });

    it('.readonly gets the read-only flag', () => {
      const f1 = makeTextField('locked');
      f1.setReadOnly(true);
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('locked')!;
      expect(ref.readonly).toBe(true);
    });

    it('.readonly can be set', () => {
      const f1 = makeTextField('editable');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('editable')!;
      ref.readonly = true;
      expect(f1.isReadOnly()).toBe(true);
    });

    it('.required gets the required flag', () => {
      const f1 = makeTextField('mandatory');
      f1.setRequired(true);
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('mandatory')!;
      expect(ref.required).toBe(true);
    });

    it('.required can be set', () => {
      const f1 = makeTextField('optional');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('optional')!;
      ref.required = true;
      expect(f1.isRequired()).toBe(true);
    });

    it('.hidden gets visibility status', () => {
      const f1 = makeTextField('visible');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('visible')!;
      expect(ref.hidden).toBe(false);
    });

    it('.hidden can be set to hide a field', () => {
      const f1 = makeTextField('toHide');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('toHide')!;
      ref.hidden = true;
      expect(getAnnotFlags(f1) & HIDDEN).toBe(HIDDEN);
    });

    it('.hidden can be set to show a field', () => {
      const f1 = makeTextField('hidden', undefined);
      f1.getWidgetDict().set('/F', PdfNumber.of(HIDDEN));
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('hidden')!;
      ref.hidden = false;
      expect(getAnnotFlags(f1) & HIDDEN).toBe(0);
    });

    it('.type returns the field type', () => {
      const f1 = makeTextField('text');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('text')!;
      expect(ref.type).toBe('text');
    });

    it('.display returns 0 for visible', () => {
      const f1 = makeTextField('vis');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('vis')!;
      expect(ref.display).toBe(0);
    });

    it('.display returns 1 for hidden', () => {
      const f1 = makeTextField('hid');
      f1.getWidgetDict().set('/F', PdfNumber.of(HIDDEN));
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('hid')!;
      expect(ref.display).toBe(1);
    });

    it('.display returns 2 for noView', () => {
      const f1 = makeTextField('nv');
      f1.getWidgetDict().set('/F', PdfNumber.of(NOVIEW));
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('nv')!;
      expect(ref.display).toBe(2);
    });

    it('.display returns 3 for hiddenButPrintable', () => {
      const f1 = makeTextField('nvp');
      f1.getWidgetDict().set('/F', PdfNumber.of(NOVIEW | PRINT));
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('nvp')!;
      expect(ref.display).toBe(3);
    });

    it('.display can be set to 0 (visible)', () => {
      const f1 = makeTextField('f');
      f1.getWidgetDict().set('/F', PdfNumber.of(HIDDEN));
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('f')!;
      ref.display = 0;
      const flags = getAnnotFlags(f1);
      expect(flags & HIDDEN).toBe(0);
      expect(flags & NOVIEW).toBe(0);
      expect(flags & PRINT).toBe(PRINT);
    });

    it('.display can be set to 1 (hidden)', () => {
      const f1 = makeTextField('f');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('f')!;
      ref.display = 1;
      expect(getAnnotFlags(f1) & HIDDEN).toBe(HIDDEN);
    });

    it('.display can be set to 2 (noView)', () => {
      const f1 = makeTextField('f');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('f')!;
      ref.display = 2;
      const flags = getAnnotFlags(f1);
      expect(flags & NOVIEW).toBe(NOVIEW);
      expect(flags & HIDDEN).toBe(0);
    });

    it('.display can be set to 3 (hiddenButPrintable)', () => {
      const f1 = makeTextField('f');
      const form = makeForm([f1]);
      const proxy = createFieldProxy(form);

      const ref = proxy.getField('f')!;
      ref.display = 3;
      const flags = getAnnotFlags(f1);
      expect(flags & NOVIEW).toBe(NOVIEW);
      expect(flags & PRINT).toBe(PRINT);
    });
  });
});

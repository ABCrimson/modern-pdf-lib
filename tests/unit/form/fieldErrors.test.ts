/**
 * The typed errors of the form API: each throw names its class and code, and a refused call
 * leaves the form as it was.
 */

import { describe, expect, it } from 'vitest';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfObjectRegistry,
  PdfStream,
  PdfString,
} from '../../../src/core/pdfObjects.js';
import {
  CombedTextLayoutError,
  ExceededMaxLengthError,
  FieldAlreadyExistsError,
  InvalidArgumentError,
  InvalidFieldNamePartError,
  MalformedInputError,
  MissingOnValueCheckError,
  NoSuchFieldError,
  UnexpectedFieldTypeError,
} from '../../../src/errors.js';
import { PdfCheckboxField } from '../../../src/form/fields/checkboxField.js';
import { flattenField, flattenFields } from '../../../src/form/formFlatten.js';
import { setCalculationOrder } from '../../../src/form/internal/calculationOrder.js';
import { PdfForm } from '../../../src/form/pdfForm.js';

function emptyForm(): PdfForm {
  const acroFormDict = new PdfDict();
  acroFormDict.set('/Fields', new PdfArray());
  return new PdfForm([], acroFormDict);
}

/** The number of entries of the `/Fields` array of `form`. */
function writtenFields(form: PdfForm): number {
  return (form.toDict(new PdfObjectRegistry()).get('/Fields') as PdfArray).items.length;
}

const RECT: [number, number, number, number] = [0, 0, 100, 20];
const BOX = { x: 0, y: 0, width: 100, height: 20 };

/** A form with one field of each type that has a create method. */
function formOfEachType(): PdfForm {
  const form = emptyForm();
  form.createTextField('text', 0, RECT);
  form.createCheckbox('checkbox', 0, RECT);
  form.createRadioGroup('radio', null, [BOX]);
  form.createDropdown('dropdown', 0, RECT, ['a']);
  form.createListbox('listbox', null, BOX, ['a']);
  form.createButton('button', null, BOX);
  return form;
}

/** The error `call` throws; fails the test when it returns. */
function thrown(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}

describe('a name that is not a field throws NoSuchFieldError', () => {
  const calls: ReadonlyArray<[string, (form: PdfForm) => unknown]> = [
    ['getTextField', (f) => f.getTextField('nope')],
    ['getCheckbox', (f) => f.getCheckbox('nope')],
    ['getRadioGroup', (f) => f.getRadioGroup('nope')],
    ['getDropdown', (f) => f.getDropdown('nope')],
    ['getListbox', (f) => f.getListbox('nope')],
    ['getButton', (f) => f.getButton('nope')],
    ['getSignatureField', (f) => f.getSignatureField('nope')],
    ['fill', (f) => f.fill({ text: 'x', nope: 'y' })],
    ['removeField', (f) => f.removeField('nope')],
    ['flattenField', (f) => flattenField(f, 'nope')],
    ['flattenFields', (f) => flattenFields(f, ['text', 'nope'])],
    ['setCalculationOrder', (f) => setCalculationOrder(f, ['text', 'nope'])],
  ];
  it.each(calls)('%s', (_, call) => {
    const error = thrown(() => call(formOfEachType()));
    expect(error).toBeInstanceOf(NoSuchFieldError);
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({
      code: 'no-such-field',
      name: 'NoSuchFieldError',
      message: 'No form field named "nope" exists in this document.',
    });
  });
});

describe('a typed getter on a field of another type throws UnexpectedFieldTypeError', () => {
  const calls: ReadonlyArray<[string, string, string, (form: PdfForm) => unknown]> = [
    ['getTextField', 'checkbox', 'text', (f) => f.getTextField('checkbox')],
    ['getCheckbox', 'text', 'checkbox', (f) => f.getCheckbox('text')],
    ['getRadioGroup', 'checkbox', 'radio', (f) => f.getRadioGroup('checkbox')],
    ['getDropdown', 'listbox', 'dropdown', (f) => f.getDropdown('listbox')],
    ['getListbox', 'dropdown', 'listbox', (f) => f.getListbox('dropdown')],
    ['getButton', 'radio', 'button', (f) => f.getButton('radio')],
    ['getSignatureField', 'button', 'signature', (f) => f.getSignatureField('button')],
  ];
  it.each(calls)('%s on the %s field', (_, actual, expected, call) => {
    const error = thrown(() => call(formOfEachType()));
    expect(error).toBeInstanceOf(UnexpectedFieldTypeError);
    expect(error).toMatchObject({
      code: 'unexpected-field-type',
      message: `Expected field "${actual}" to be of type "${expected}", but it is of type "${actual}".`,
    });
  });
});

describe('the create methods refuse a name in use or a name that is not one name part', () => {
  const creates: ReadonlyArray<[string, (form: PdfForm, name: string) => unknown]> = [
    ['createTextField', (f, n) => f.createTextField(n, 0, RECT)],
    ['createCheckbox', (f, n) => f.createCheckbox(n, 0, RECT)],
    ['createDropdown', (f, n) => f.createDropdown(n, 0, RECT, ['a'])],
    ['createRadioGroup', (f, n) => f.createRadioGroup(n, null, [BOX])],
    ['createButton', (f, n) => f.createButton(n, null, BOX)],
    ['createListbox', (f, n) => f.createListbox(n, null, BOX, ['a'])],
  ];

  it.each(creates)('%s throws FieldAlreadyExistsError for a name in use', (_, create) => {
    const form = formOfEachType();
    const before = form.getFields();
    const writtenBefore = writtenFields(form);
    const error = thrown(() => create(form, 'checkbox'));
    expect(error).toBeInstanceOf(FieldAlreadyExistsError);
    expect(error).toMatchObject({
      code: 'field-already-exists',
      message: 'A form field named "checkbox" already exists.',
    });
    expect(form.getFields()).toEqual(before);
    expect(form.getField('checkbox')).toBe(before[1]);
    expect(writtenFields(form)).toBe(writtenBefore);
  });

  it.each(creates)('%s throws InvalidFieldNamePartError for an empty name', (_, create) => {
    const form = emptyForm();
    const error = thrown(() => create(form, ''));
    expect(error).toBeInstanceOf(InvalidFieldNamePartError);
    expect(error).toMatchObject({
      code: 'invalid-field-name-part',
      message: 'Invalid field name part: "".',
    });
    expect(form.getFields()).toEqual([]);
  });

  it.each(creates)('%s throws InvalidFieldNamePartError for a name with a period', (_, create) => {
    const form = emptyForm();
    const error = thrown(() => create(form, 'address.city'));
    expect(error).toBeInstanceOf(InvalidFieldNamePartError);
    expect(error).toMatchObject({ message: 'Invalid field name part: "address.city".' });
    expect(form.getFields()).toEqual([]);
    expect(writtenFields(form)).toBe(0);
  });

  it('a name that differs from one in use only by case is a new name', () => {
    const form = formOfEachType();
    expect(form.createTextField('Text', 0, RECT).getName()).toBe('Text');
  });
});

describe('setText refuses a value longer than /MaxLen', () => {
  function textField(maxLength: number, comb = false) {
    const field = emptyForm().createTextField('code', 0, RECT);
    field.setMaxLength(maxLength);
    if (comb) field.getDict().set('/Ff', PdfNumber.of(1 << 24));
    field.setText('kept');
    return field;
  }

  it('throws ExceededMaxLengthError and keeps the value', () => {
    const field = textField(4);
    const error = thrown(() => field.setText('12345'));
    expect(error).toBeInstanceOf(ExceededMaxLengthError);
    expect(error).toMatchObject({
      code: 'exceeded-max-length',
      message: 'The value for field "code" is 5 characters long, but the maximum length is 4.',
    });
    expect(field.getText()).toBe('kept');
  });

  it('setValue throws the same', () => {
    expect(() => textField(4).setValue('12345')).toThrow(ExceededMaxLengthError);
  });

  it('accepts a value of exactly /MaxLen code points, counting a surrogate pair once', () => {
    const field = textField(4);
    field.setText('1234');
    expect(field.getText()).toBe('1234');
    field.setText('a😀b😀');
    expect(field.getText()).toBe('a😀b😀');
    expect(() => field.setText('a😀b😀c')).toThrow(ExceededMaxLengthError);
  });

  it('throws CombedTextLayoutError on a comb field and keeps the value', () => {
    const field = textField(4, true);
    const error = thrown(() => field.setText('12345'));
    expect(error).toBeInstanceOf(CombedTextLayoutError);
    expect(error).toMatchObject({
      code: 'combed-text-layout',
      message: 'Combed text has 5 characters but the field only allows a maximum of 4.',
    });
    expect(field.getText()).toBe('kept');
    field.setText('1234');
    expect(field.getText()).toBe('1234');
  });

  it('sets any length on a field without /MaxLen', () => {
    const field = emptyForm().createTextField('free', 0, RECT);
    field.setText('x'.repeat(10_000));
    expect(field.getText()).toHaveLength(10_000);
  });
});

describe('check() of a check box whose appearance has no on state', () => {
  /** A check box with `/AP /N` holding `keys` (none: no `/AP`) and `/V` set to `value`. */
  function checkbox(keys: readonly string[] | undefined, value?: string): PdfCheckboxField {
    const dict = new PdfDict();
    dict.set('/FT', PdfName.of('Btn'));
    dict.set('/T', PdfString.fromText('agree'));
    dict.set('/Rect', PdfArray.fromNumbers(RECT));
    if (value !== undefined) dict.set('/V', PdfName.of(value));
    if (keys !== undefined) {
      const normal = new PdfDict();
      for (const key of keys) normal.set(`/${key}`, PdfStream.fromString(''));
      const ap = new PdfDict();
      ap.set('/N', normal);
      dict.set('/AP', ap);
    }
    return new PdfCheckboxField('agree', dict, dict);
  }

  it.each([
    ['no /V', undefined],
    ['/V /Off', 'Off'],
  ])('throws MissingOnValueCheckError when only /Off has an appearance and %s', (_, value) => {
    const field = checkbox(['Off'], value);
    const error = thrown(() => field.check());
    expect(error).toBeInstanceOf(MissingOnValueCheckError);
    expect(error).toBeInstanceOf(MalformedInputError);
    expect(error).toMatchObject({ code: 'missing-on-value', format: 'pdf' });
    expect((error as Error).message).toContain('"agree"');
    expect(field.isChecked()).toBe(false);
    expect(field.getDict().get('/AS')).toBeUndefined();
  });

  it('throws as well for an empty /AP /N dictionary', () => {
    expect(() => checkbox([]).check()).toThrow(MissingOnValueCheckError);
  });

  it('uses a /V other than /Off when only /Off has an appearance', () => {
    const field = checkbox(['Off'], 'On');
    field.check();
    expect(field.getDict().get('/AS')).toEqual(PdfName.of('On'));
    expect(field.isChecked()).toBe(true);
  });

  it('keeps the /Yes default for a check box without /AP', () => {
    const field = checkbox(undefined);
    field.check();
    expect(field.getDict().get('/V')).toEqual(PdfName.of('Yes'));
  });

  it('uses the on state of the appearance', () => {
    const field = checkbox(['Off', 'Ja']);
    field.check();
    expect(field.getDict().get('/V')).toEqual(PdfName.of('Ja'));
  });
});

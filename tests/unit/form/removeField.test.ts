/**
 * Tests for PdfForm.removeField() — removing fields from the form.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyForm(): PdfForm {
  const acroFormDict = new PdfDict();
  acroFormDict.set('/Fields', new PdfArray());
  return new PdfForm([], acroFormDict);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfForm.removeField', () => {
  it('removes a text field by name', () => {
    const form = emptyForm();
    form.createTextField('email', 0, [10, 10, 200, 30]);

    expect(form.getFields()).toHaveLength(1);
    form.removeField('email');
    expect(form.getFields()).toHaveLength(0);
    expect(form.getField('email')).toBeUndefined();
  });

  it('removes a checkbox by name', () => {
    const form = emptyForm();
    form.createCheckbox('agree', 0, [10, 10, 30, 30]);

    form.removeField('agree');
    expect(form.getFields()).toHaveLength(0);
  });

  it('removes a dropdown by name', () => {
    const form = emptyForm();
    form.createDropdown('country', 0, [10, 10, 200, 30], ['US', 'UK']);

    form.removeField('country');
    expect(form.getFields()).toHaveLength(0);
  });

  it('removes a button by name', () => {
    const form = emptyForm();
    form.createButton('submit', null, {
      x: 10, y: 10, width: 80, height: 25,
    }, 'Submit');

    form.removeField('submit');
    expect(form.getFields()).toHaveLength(0);
  });

  it('removes a listbox by name', () => {
    const form = emptyForm();
    form.createListbox('items', null, {
      x: 10, y: 10, width: 100, height: 60,
    }, ['A', 'B']);

    form.removeField('items');
    expect(form.getFields()).toHaveLength(0);
  });

  it('removes a radio group by name', () => {
    const form = emptyForm();
    form.createRadioGroup('choice', null, [
      { x: 0, y: 0, width: 15, height: 15 },
      { x: 0, y: 20, width: 15, height: 15 },
    ], ['Yes', 'No']);

    form.removeField('choice');
    expect(form.getFields()).toHaveLength(0);
  });

  it('throws when removing a non-existent field', () => {
    const form = emptyForm();
    expect(() => form.removeField('nonexistent')).toThrow('not found');
  });

  it('does not affect other fields when removing one', () => {
    const form = emptyForm();
    form.createTextField('first', 0, [10, 10, 200, 30]);
    form.createTextField('second', 0, [10, 50, 200, 70]);
    form.createTextField('third', 0, [10, 90, 200, 110]);

    expect(form.getFields()).toHaveLength(3);

    form.removeField('second');

    expect(form.getFields()).toHaveLength(2);
    expect(form.getField('first')).toBeDefined();
    expect(form.getField('second')).toBeUndefined();
    expect(form.getField('third')).toBeDefined();
  });

  it('field is no longer retrievable by typed getter after removal', () => {
    const form = emptyForm();
    form.createTextField('name', 0, [10, 10, 200, 30]);

    form.removeField('name');
    expect(() => form.getTextField('name')).toThrow('not found');
  });
});

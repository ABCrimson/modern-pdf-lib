/**
 * Tests for PdfForm.createListbox() — creating listbox fields.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { PdfListboxField } from '../../../src/form/fields/listboxField.js';

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

describe('PdfForm.createListbox', () => {
  it('creates a listbox field with the given name', () => {
    const form = emptyForm();
    const lb = form.createListbox('fruits', null, {
      x: 50, y: 500, width: 150, height: 100,
    }, ['Apple', 'Banana', 'Cherry']);

    expect(lb).toBeInstanceOf(PdfListboxField);
    expect(lb.getName()).toBe('fruits');
  });

  it('is retrievable by name after creation', () => {
    const form = emptyForm();
    form.createListbox('items', null, {
      x: 10, y: 10, width: 200, height: 80,
    }, ['A', 'B', 'C']);

    const lb = form.getListbox('items');
    expect(lb).toBeInstanceOf(PdfListboxField);
    expect(lb.getName()).toBe('items');
  });

  it('has the correct widget rectangle', () => {
    const form = emptyForm();
    const lb = form.createListbox('list', null, {
      x: 20, y: 30, width: 100, height: 60,
    }, ['X']);

    expect(lb.getRect()).toEqual([20, 30, 120, 90]);
  });

  it('contains the correct options', () => {
    const form = emptyForm();
    const lb = form.createListbox('colors', null, {
      x: 0, y: 0, width: 100, height: 80,
    }, ['Red', 'Green', 'Blue', 'Yellow']);

    expect(lb.getOptions()).toEqual(['Red', 'Green', 'Blue', 'Yellow']);
  });

  it('starts with no selection', () => {
    const form = emptyForm();
    const lb = form.createListbox('choices', null, {
      x: 0, y: 0, width: 100, height: 80,
    }, ['One', 'Two', 'Three']);

    expect(lb.getSelected()).toEqual([]);
  });

  it('allows selecting a value after creation', () => {
    const form = emptyForm();
    const lb = form.createListbox('pick', null, {
      x: 0, y: 0, width: 100, height: 80,
    }, ['Alpha', 'Beta', 'Gamma']);

    lb.select(['Beta']);
    expect(lb.getSelected()).toEqual(['Beta']);
  });

  it('allows updating options after creation', () => {
    const form = emptyForm();
    const lb = form.createListbox('dynamic', null, {
      x: 0, y: 0, width: 100, height: 80,
    }, ['Old1', 'Old2']);

    lb.setOptions(['New1', 'New2', 'New3']);
    expect(lb.getOptions()).toEqual(['New1', 'New2', 'New3']);
  });

  it('appears in getFields() after creation', () => {
    const form = emptyForm();
    form.createListbox('lb1', null, {
      x: 0, y: 0, width: 100, height: 80,
    }, ['A']);

    const fields = form.getFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.fieldType).toBe('listbox');
  });
});

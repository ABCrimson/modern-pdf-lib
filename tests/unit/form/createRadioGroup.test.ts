/**
 * Tests for PdfForm.createRadioGroup() — creating radio button groups.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { PdfRadioGroup } from '../../../src/form/fields/radioGroup.js';

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

describe('PdfForm.createRadioGroup', () => {
  it('creates a radio group with the given name', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup('gender', null, [
      { x: 10, y: 700, width: 20, height: 20 },
      { x: 10, y: 670, width: 20, height: 20 },
    ]);

    expect(rg).toBeInstanceOf(PdfRadioGroup);
    expect(rg.getName()).toBe('gender');
  });

  it('is retrievable by name after creation', () => {
    const form = emptyForm();
    form.createRadioGroup('choice', null, [
      { x: 0, y: 0, width: 15, height: 15 },
      { x: 0, y: 20, width: 15, height: 15 },
    ]);

    const rg = form.getRadioGroup('choice');
    expect(rg).toBeInstanceOf(PdfRadioGroup);
    expect(rg.getName()).toBe('choice');
  });

  it('has the correct number of widgets', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup('size', null, [
      { x: 10, y: 100, width: 20, height: 20 },
      { x: 10, y: 130, width: 20, height: 20 },
      { x: 10, y: 160, width: 20, height: 20 },
    ]);

    expect(rg.getWidgets()).toHaveLength(3);
  });

  it('assigns default option names when none are provided', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup('pref', null, [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 20, width: 10, height: 10 },
    ]);

    const options = rg.getOptions();
    expect(options).toEqual(['Option0', 'Option1']);
  });

  it('assigns custom option names when provided', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup(
      'color',
      null,
      [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 0, y: 20, width: 10, height: 10 },
        { x: 0, y: 40, width: 10, height: 10 },
      ],
      ['Red', 'Green', 'Blue'],
    );

    const options = rg.getOptions();
    expect(options).toEqual(['Red', 'Green', 'Blue']);
  });

  it('starts with no option selected', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup('q1', null, [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 20, width: 10, height: 10 },
    ]);

    expect(rg.getSelected()).toBeUndefined();
  });

  it('allows selecting an option after creation', () => {
    const form = emptyForm();
    const rg = form.createRadioGroup(
      'answer',
      null,
      [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 0, y: 20, width: 10, height: 10 },
      ],
      ['Yes', 'No'],
    );

    rg.select('Yes');
    expect(rg.getSelected()).toBe('Yes');
  });

  it('appears in getFields() after creation', () => {
    const form = emptyForm();
    form.createRadioGroup('rg1', null, [
      { x: 0, y: 0, width: 10, height: 10 },
    ]);

    const fields = form.getFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.fieldType).toBe('radio');
  });
});

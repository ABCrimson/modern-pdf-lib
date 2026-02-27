/**
 * Tests for PdfForm.createButton() — creating push button fields.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { PdfButtonField } from '../../../src/form/fields/buttonField.js';

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

describe('PdfForm.createButton', () => {
  it('creates a button field with the given name', () => {
    const form = emptyForm();
    const btn = form.createButton('submit', null, {
      x: 50, y: 50, width: 100, height: 30,
    });

    expect(btn).toBeInstanceOf(PdfButtonField);
    expect(btn.getName()).toBe('submit');
  });

  it('is retrievable by name after creation', () => {
    const form = emptyForm();
    form.createButton('reset', null, {
      x: 10, y: 10, width: 80, height: 25,
    });

    const btn = form.getButton('reset');
    expect(btn).toBeInstanceOf(PdfButtonField);
    expect(btn.getName()).toBe('reset');
  });

  it('has the correct widget rectangle', () => {
    const form = emptyForm();
    const btn = form.createButton('ok', null, {
      x: 100, y: 200, width: 60, height: 20,
    });

    // Internal rect format: [x1, y1, x2, y2]
    expect(btn.getRect()).toEqual([100, 200, 160, 220]);
  });

  it('sets the caption when a label is provided', () => {
    const form = emptyForm();
    const btn = form.createButton('go', null, {
      x: 0, y: 0, width: 50, height: 20,
    }, 'Go!');

    expect(btn.getCaption()).toBe('Go!');
  });

  it('has no caption when label is omitted', () => {
    const form = emptyForm();
    const btn = form.createButton('nolabel', null, {
      x: 0, y: 0, width: 50, height: 20,
    });

    expect(btn.getCaption()).toBeUndefined();
  });

  it('has empty string as value (pushbuttons have no value)', () => {
    const form = emptyForm();
    const btn = form.createButton('btn', null, {
      x: 0, y: 0, width: 50, height: 20,
    });

    expect(btn.getValue()).toBe('');
  });

  it('appears in getFields() after creation', () => {
    const form = emptyForm();
    form.createButton('action', null, {
      x: 0, y: 0, width: 40, height: 20,
    });

    const fields = form.getFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.fieldType).toBe('button');
  });

  it('allows updating caption after creation', () => {
    const form = emptyForm();
    const btn = form.createButton('btn', null, {
      x: 0, y: 0, width: 50, height: 20,
    }, 'Old');

    btn.setCaption('New');
    expect(btn.getCaption()).toBe('New');
  });
});

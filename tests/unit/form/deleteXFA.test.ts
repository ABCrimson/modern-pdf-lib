/**
 * Tests for PdfForm.deleteXFA() — removing XFA data from the AcroForm.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfArray,
  PdfBool,
  PdfStream,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a PdfForm backed by the given AcroForm dictionary. */
function formWith(acroFormDict: PdfDict): PdfForm {
  acroFormDict.set('/Fields', acroFormDict.get('/Fields') ?? new PdfArray());
  return new PdfForm([], acroFormDict);
}

/** Build an AcroForm dict that contains an /XFA entry. */
function acroFormWithXFA(): PdfDict {
  const dict = new PdfDict();
  dict.set('/Fields', new PdfArray());
  // /XFA can be a stream or an array; use a stream for realism.
  const xfaStream = new PdfStream(new PdfDict(), new Uint8Array([60, 120, 102, 97, 62]));
  dict.set('/XFA', xfaStream);
  return dict;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfForm.deleteXFA', () => {
  it('removes /XFA key from form dict', () => {
    const acroForm = acroFormWithXFA();
    expect(acroForm.has('/XFA')).toBe(true);

    const form = formWith(acroForm);
    form.deleteXFA();

    expect(acroForm.has('/XFA')).toBe(false);
  });

  it('is a no-op when no /XFA exists (no error thrown)', () => {
    const acroForm = new PdfDict();
    acroForm.set('/Fields', new PdfArray());
    expect(acroForm.has('/XFA')).toBe(false);

    const form = formWith(acroForm);

    // Should not throw
    expect(() => form.deleteXFA()).not.toThrow();

    // Dict remains unchanged (no /NeedAppearances added either)
    expect(acroForm.has('/XFA')).toBe(false);
    expect(acroForm.has('/NeedAppearances')).toBe(false);
  });

  it('sets /NeedAppearances to true after removing XFA', () => {
    const acroForm = acroFormWithXFA();
    const form = formWith(acroForm);

    form.deleteXFA();

    expect(acroForm.has('/NeedAppearances')).toBe(true);
    const na = acroForm.get('/NeedAppearances');
    expect(na).toBe(PdfBool.TRUE);
  });

  it('form fields still work after deleteXFA', () => {
    const acroForm = acroFormWithXFA();
    const form = formWith(acroForm);

    // Create some fields before deleting XFA
    const tf = form.createTextField('name', 0, [10, 10, 200, 30]);
    tf.setValue('Alice');
    const cb = form.createCheckbox('agree', 0, [10, 40, 30, 60]);
    cb.setValue(true);

    // Delete XFA
    form.deleteXFA();

    // Fields should still be accessible and retain their values
    expect(form.getFields()).toHaveLength(2);
    expect(form.getTextField('name').getText()).toBe('Alice');
    expect(form.getCheckbox('agree').isChecked()).toBe(true);

    // Fields should still be mutable after XFA removal
    form.getTextField('name').setValue('Bob');
    expect(form.getTextField('name').getText()).toBe('Bob');
  });

  it('does not set /NeedAppearances when no /XFA was present', () => {
    const acroForm = new PdfDict();
    acroForm.set('/Fields', new PdfArray());
    const form = formWith(acroForm);

    form.deleteXFA();

    // /NeedAppearances should not be set since there was nothing to remove
    expect(acroForm.has('/NeedAppearances')).toBe(false);
  });

  it('can be called multiple times safely', () => {
    const acroForm = acroFormWithXFA();
    const form = formWith(acroForm);

    form.deleteXFA();
    expect(acroForm.has('/XFA')).toBe(false);

    // Second call should be a no-op
    expect(() => form.deleteXFA()).not.toThrow();
    expect(acroForm.has('/XFA')).toBe(false);
    // /NeedAppearances should still be true from the first call
    expect(acroForm.get('/NeedAppearances')).toBe(PdfBool.TRUE);
  });
});

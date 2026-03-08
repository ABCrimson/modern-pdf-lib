/**
 * Tests for formFlatten — flatten interactive form fields into static page content.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
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
import {
  flattenForm,
  flattenField,
  flattenFields,
  _resetFlattenCounter,
} from '../../../src/form/formFlatten.js';
import type { FlattenFormResult } from '../../../src/form/formFlatten.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a text field dictionary. */
function makeTextFieldDict(name: string, value?: string, readOnly = false): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 700, 250, 720]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  if (value !== undefined) {
    dict.set('/V', PdfString.literal(value));
  }
  if (readOnly) {
    dict.set('/Ff', PdfNumber.of(FieldFlags.ReadOnly));
  }
  // Add a default appearance for text rendering
  dict.set('/DA', PdfString.literal('/Helv 12 Tf 0 g'));
  return dict;
}

/** Create a checkbox field dictionary. */
function makeCheckboxDict(name: string, checked: boolean): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 680, 70, 700]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  dict.set('/V', PdfName.of(checked ? 'Yes' : 'Off'));
  dict.set('/AS', PdfName.of(checked ? 'Yes' : 'Off'));
  return dict;
}

/** Create a dropdown field dictionary. */
function makeDropdownDict(name: string, options: string[], selected?: string): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Ch'));
  dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 650, 250, 670]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
  dict.set('/DA', PdfString.literal('/Helv 12 Tf 0 g'));
  if (selected !== undefined) {
    dict.set('/V', PdfString.literal(selected));
  }
  return dict;
}

/** Create a button field dictionary. */
function makeButtonDict(name: string): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Btn'));
  dict.set('/Ff', PdfNumber.of(FieldFlags.Pushbutton));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 620, 150, 640]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  const mk = new PdfDict();
  mk.set('/CA', PdfString.literal('Submit'));
  dict.set('/MK', mk);
  return dict;
}

/** Create a signature field dictionary. */
function makeSignatureDict(name: string, signed: boolean): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Sig'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 590, 250, 640]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  if (signed) {
    const sigDict = new PdfDict();
    sigDict.set('/Type', PdfName.of('Sig'));
    sigDict.set('/Filter', PdfName.of('Adobe.PPKLite'));
    dict.set('/V', sigDict);
  }
  return dict;
}

/** Create a listbox field dictionary. */
function makeListboxDict(name: string, options: string[]): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Ch'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([50, 550, 250, 620]));
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
  dict.set('/DA', PdfString.literal('/Helv 10 Tf 0 g'));
  return dict;
}

/** Create a text field with an existing appearance stream. */
function makeTextFieldWithAppearance(name: string, value: string): PdfDict {
  const dict = makeTextFieldDict(name, value);

  // Build an appearance stream
  const apStreamDict = new PdfDict();
  apStreamDict.set('/Type', PdfName.of('XObject'));
  apStreamDict.set('/Subtype', PdfName.of('Form'));
  apStreamDict.set('/BBox', PdfArray.fromNumbers([0, 0, 200, 20]));
  const apStream = PdfStream.fromString(`BT /Helv 12 Tf (${value}) Tj ET`, apStreamDict);

  const apWrapper = new PdfDict();
  apWrapper.set('/N', apStream);
  dict.set('/AP', apWrapper);

  return dict;
}

/** Build a PdfForm from field dicts using fromDict. */
function buildForm(fieldDicts: PdfDict[]): PdfForm {
  const acroFormDict = new PdfDict();
  const fieldsArr = PdfArray.of(fieldDicts);
  acroFormDict.set('/Fields', fieldsArr);

  const resolver = (_ref: any) => fieldDicts[0]!;
  return PdfForm.fromDict(acroFormDict, resolver);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formFlatten', () => {
  beforeEach(() => {
    _resetFlattenCounter();
  });

  // -----------------------------------------------------------------------
  // flattenForm — flatten all fields
  // -----------------------------------------------------------------------

  describe('flattenForm', () => {
    it('flattens a text field and produces content operators', () => {
      const dict = makeTextFieldDict('name', 'John Doe');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('name');
      expect(result.contentOps).toContain('Do');
      expect(result.contentOps).toContain('q');
      expect(result.contentOps).toContain('Q');
      expect(result.xObjects.length).toBeGreaterThan(0);
    });

    it('flattens a checkbox and merges its appearance', () => {
      const dict = makeCheckboxDict('agree', true);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('agree');
      expect(result.contentOps).toContain('Do');
      expect(result.xObjects.length).toBe(1);
      // The XObject should be a Form type
      const xobj = result.xObjects[0]!;
      expect(xobj.stream.dict.get('/Subtype')).toBeDefined();
    });

    it('flattens all fields and marks AcroForm as removed', () => {
      const tf = makeTextFieldDict('name', 'Alice');
      const cb = makeCheckboxDict('agree', true);
      const dd = makeDropdownDict('color', ['Red', 'Blue'], 'Red');
      const form = buildForm([tf, cb, dd]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toHaveLength(3);
      expect(result.flattenedFields).toContain('name');
      expect(result.flattenedFields).toContain('agree');
      expect(result.flattenedFields).toContain('color');
      expect(result.acroFormRemoved).toBe(true);
      expect(result.xObjects).toHaveLength(3);
    });

    it('handles empty form (no fields) as a no-op', () => {
      const form = buildForm([]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toHaveLength(0);
      expect(result.contentOps).toBe('');
      expect(result.xObjects).toHaveLength(0);
      expect(result.acroFormRemoved).toBe(true);
    });

    it('preserves read-only fields when preserveReadOnly is true', () => {
      const roField = makeTextFieldDict('readonly_name', 'Protected', true);
      const editField = makeTextFieldDict('editable_name', 'Editable');
      const form = buildForm([roField, editField]);

      const result = flattenForm(form, { preserveReadOnly: true });

      expect(result.flattenedFields).toContain('editable_name');
      expect(result.skippedFields).toContain('readonly_name');
      expect(result.flattenedFields).not.toContain('readonly_name');
      // AcroForm should NOT be removed because read-only field remains
      expect(result.acroFormRemoved).toBe(false);
    });

    it('flattens read-only fields when preserveReadOnly is false', () => {
      const roField = makeTextFieldDict('readonly_name', 'Protected', true);
      const form = buildForm([roField]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('readonly_name');
      expect(result.skippedFields).toHaveLength(0);
      expect(result.acroFormRemoved).toBe(true);
    });

    it('generates unique XObject names for each field', () => {
      const f1 = makeTextFieldDict('field1', 'Value1');
      const f2 = makeTextFieldDict('field2', 'Value2');
      const form = buildForm([f1, f2]);

      const result = flattenForm(form);

      const names = result.xObjects.map((x) => x.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names[0]).toMatch(/^FlatField\d+$/);
      expect(names[1]).toMatch(/^FlatField\d+$/);
      expect(names[0]).not.toBe(names[1]);
    });

    it('uses existing appearance stream when available', () => {
      const dict = makeTextFieldWithAppearance('name', 'PreRendered');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('name');
      expect(result.xObjects).toHaveLength(1);
      // The XObject stream should contain the pre-rendered content
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('PreRendered');
    });

    it('flattens a button field', () => {
      const dict = makeButtonDict('submit');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('submit');
      expect(result.contentOps).toContain('Do');
    });

    it('flattens a signature field', () => {
      const dict = makeSignatureDict('sig1', false);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('sig1');
      expect(result.xObjects).toHaveLength(1);
    });

    it('flattens a listbox field', () => {
      const dict = makeListboxDict('items', ['Alpha', 'Beta', 'Gamma']);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('items');
      expect(result.contentOps).toContain('Do');
    });

    it('flattens a dropdown field', () => {
      const dict = makeDropdownDict('color', ['Red', 'Blue'], 'Blue');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('color');
      expect(result.xObjects).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // flattenField — flatten a single field
  // -----------------------------------------------------------------------

  describe('flattenField', () => {
    it('flattens a single field by name while leaving others', () => {
      const tf1 = makeTextFieldDict('first_name', 'Alice');
      const tf2 = makeTextFieldDict('last_name', 'Smith');
      const form = buildForm([tf1, tf2]);

      const result = flattenField(form, 'first_name');

      expect(result.flattenedFields).toEqual(['first_name']);
      expect(result.acroFormRemoved).toBe(false);
      // The other field should still be in the form
      expect(form.getField('last_name')).toBeDefined();
    });

    it('throws when field is not found', () => {
      const form = buildForm([makeTextFieldDict('name', 'Test')]);

      expect(() => flattenField(form, 'nonexistent')).toThrow(
        'Form field "nonexistent" not found',
      );
    });

    it('respects preserveReadOnly option', () => {
      const roField = makeTextFieldDict('ro_field', 'ReadOnly', true);
      const form = buildForm([roField]);

      const result = flattenField(form, 'ro_field', { preserveReadOnly: true });

      expect(result.skippedFields).toContain('ro_field');
      expect(result.flattenedFields).toHaveLength(0);
    });

    it('produces correct transformation matrix in content ops', () => {
      const dict = makeTextFieldDict('positioned', 'Hello');
      const form = buildForm([dict]);

      const result = flattenField(form, 'positioned');

      // The rect is [50, 700, 250, 720], so we expect translation to (50, 700)
      expect(result.contentOps).toContain('50');
      expect(result.contentOps).toContain('700');
      expect(result.contentOps).toContain('cm');
    });
  });

  // -----------------------------------------------------------------------
  // flattenFields — flatten specific fields
  // -----------------------------------------------------------------------

  describe('flattenFields', () => {
    it('flattens multiple specified fields', () => {
      const f1 = makeTextFieldDict('field_a', 'A');
      const f2 = makeTextFieldDict('field_b', 'B');
      const f3 = makeTextFieldDict('field_c', 'C');
      const form = buildForm([f1, f2, f3]);

      const result = flattenFields(form, ['field_a', 'field_c']);

      expect(result.flattenedFields).toHaveLength(2);
      expect(result.flattenedFields).toContain('field_a');
      expect(result.flattenedFields).toContain('field_c');
      // field_b should remain
      expect(form.getField('field_b')).toBeDefined();
      expect(result.acroFormRemoved).toBe(false);
    });

    it('throws when any field name is not found', () => {
      const form = buildForm([makeTextFieldDict('existing', 'val')]);

      expect(() => flattenFields(form, ['existing', 'missing'])).toThrow(
        'Form field "missing" not found',
      );
    });

    it('handles an empty field names array', () => {
      const form = buildForm([makeTextFieldDict('field', 'val')]);

      const result = flattenFields(form, []);

      expect(result.flattenedFields).toHaveLength(0);
      expect(result.contentOps).toBe('');
    });

    it('flattens a mix of field types', () => {
      const tf = makeTextFieldDict('name', 'Test');
      const cb = makeCheckboxDict('agree', true);
      const form = buildForm([tf, cb]);

      const result = flattenFields(form, ['name', 'agree']);

      expect(result.flattenedFields).toHaveLength(2);
      expect(result.xObjects).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles a field with zero-size rectangle gracefully', () => {
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Tx'));
      dict.set('/T', PdfString.literal('zero_rect'));
      dict.set('/Rect', PdfArray.fromNumbers([100, 100, 100, 100])); // zero area
      dict.set('/DA', PdfString.literal('/Helv 12 Tf 0 g'));
      const form = buildForm([dict]);

      const result = flattenForm(form);

      // Field is "flattened" but produces no content ops (zero area)
      expect(result.flattenedFields).toContain('zero_rect');
      expect(result.xObjects).toHaveLength(0);
    });

    it('XObject entries have Form subtype and BBox', () => {
      const dict = makeTextFieldDict('check_meta', 'Hello');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const xobj = result.xObjects[0]!;
      const subtypeObj = xobj.stream.dict.get('/Subtype');
      expect(subtypeObj).toBeDefined();
      expect((subtypeObj as PdfName).value).toBe('/Form');

      const bboxObj = xobj.stream.dict.get('/BBox');
      expect(bboxObj).toBeDefined();
      expect(bboxObj!.kind).toBe('array');
    });

    it('content ops wrap each field in q/Q save-restore pair', () => {
      const dict = makeTextFieldDict('safe', 'Test');
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const ops = result.contentOps;
      const qCount = (ops.match(/^q$/gm) ?? []).length;
      const QCount = (ops.match(/^Q$/gm) ?? []).length;
      expect(qCount).toBe(QCount);
      expect(qCount).toBeGreaterThanOrEqual(1);
    });

    it('handles checkbox with /AP /N state dictionary', () => {
      const dict = makeCheckboxDict('styled_cb', true);

      // Add an /AP /N dict with "Yes" and "Off" streams
      const yesStream = PdfStream.fromString('q 1 0 0 rg 0 0 20 20 re f Q');
      const offStream = PdfStream.fromString('');
      const nDict = new PdfDict();
      nDict.set('/Yes', yesStream);
      nDict.set('/Off', offStream);
      const apDict = new PdfDict();
      apDict.set('/N', nDict);
      dict.set('/AP', apDict);

      const form = buildForm([dict]);
      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('styled_cb');
      // Should have used the "Yes" stream since /AS is "Yes"
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('rg');
    });

    it('handles field with no appearance gracefully (generates one)', () => {
      // Create a simple text field with no /AP at all
      const dict = new PdfDict();
      dict.set('/FT', PdfName.of('Tx'));
      dict.set('/T', PdfString.literal('no_ap'));
      dict.set('/V', PdfString.literal('Some text'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
      dict.set('/DA', PdfString.literal('/Helv 12 Tf 0 g'));

      const form = buildForm([dict]);
      const result = flattenForm(form);

      // Should still flatten — generateAppearance() is called
      expect(result.flattenedFields).toContain('no_ap');
      expect(result.xObjects).toHaveLength(1);
    });

    it('only all read-only with preserveReadOnly results in no acroFormRemoved', () => {
      const f1 = makeTextFieldDict('ro1', 'Val1', true);
      const f2 = makeTextFieldDict('ro2', 'Val2', true);
      const form = buildForm([f1, f2]);

      const result = flattenForm(form, { preserveReadOnly: true });

      expect(result.flattenedFields).toHaveLength(0);
      expect(result.skippedFields).toHaveLength(2);
      expect(result.acroFormRemoved).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Rich text (/RV) handling
  // -----------------------------------------------------------------------

  describe('rich text (/RV) handling', () => {
    /** Create a text field with /RV (rich text value). */
    function makeRichTextFieldDict(
      name: string,
      plainValue: string,
      richValue: string,
      options?: { readOnly?: boolean; multiline?: boolean },
    ): PdfDict {
      const dict = makeTextFieldDict(name, plainValue, options?.readOnly);
      dict.set('/RV', PdfString.literal(richValue));
      if (options?.multiline) {
        const ff = (dict.get('/Ff') as PdfNumber | undefined)?.value ?? 0;
        dict.set('/Ff', PdfNumber.of(ff | FieldFlags.Multiline));
      }
      return dict;
    }

    it('uses /RV with bold text for appearance generation', () => {
      const rv = '<body><p><b>Bold Text</b></p></body>';
      const dict = makeRichTextFieldDict('bold_field', 'Bold Text', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('bold_field');
      expect(result.xObjects).toHaveLength(1);
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should use a bold font variant (HeBo = Helvetica-Bold)
      expect(content).toContain('/HeBo');
      expect(content).toContain('Bold Text');
    });

    it('uses /RV with mixed bold and italic text', () => {
      const rv = '<body><p><b>Bold</b> and <i>Italic</i></p></body>';
      const dict = makeRichTextFieldDict('mixed_field', 'Bold and Italic', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('mixed_field');
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should contain both bold and italic font names
      expect(content).toContain('/HeBo');
      expect(content).toContain('/HeIt');
      expect(content).toContain('Bold');
      expect(content).toContain('Italic');
    });

    it('uses /RV with font-size and color styling', () => {
      const rv = '<body><p><span style="font-size: 16pt; color: rgb(255, 0, 0);">Red Large</span></p></body>';
      const dict = makeRichTextFieldDict('styled_field', 'Red Large', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('styled_field');
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should use 16pt font size
      expect(content).toContain('16 Tf');
      // Should have red color (1 0 0 rg)
      expect(content).toContain('1 0 0 rg');
      expect(content).toContain('Red Large');
    });

    it('prefers /RV over /V when both are present', () => {
      const rv = '<body><p><b>Rich Version</b></p></body>';
      const dict = makeRichTextFieldDict('prefer_rv', 'Plain Version', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should contain the rich text content, not the plain text
      expect(content).toContain('Rich Version');
      // Should use bold font
      expect(content).toContain('/HeBo');
    });

    it('falls back to /V when /RV contains invalid XHTML', () => {
      // Use content that only has unclosed/invalid tags and no text nodes
      // inside a <p>, causing the parser to produce empty paragraphs
      const rv = '<html><body><p></p></body></html>';
      const dict = makeRichTextFieldDict('invalid_rv', 'Fallback Value', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('invalid_rv');
      expect(result.xObjects).toHaveLength(1);
      // Should have fallen back to /V — the appearance is from
      // generateAppearance() or existing /AP, not from /RV
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should contain the plain text value
      expect(content).toContain('Fallback Value');
    });

    it('uses /V when preserveRichText is false, ignoring /RV', () => {
      const rv = '<body><p><b>Rich Version</b></p></body>';
      const dict = makeRichTextFieldDict('no_rich', 'Plain Version', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form, { preserveRichText: false });

      expect(result.flattenedFields).toContain('no_rich');
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should contain the plain text value, not the rich text
      expect(content).toContain('Plain Version');
      // Should NOT contain bold font (since rich text was ignored)
      expect(content).not.toContain('/HeBo');
    });

    it('handles multi-line rich text field', () => {
      const rv = '<body><p>First paragraph</p><p>Second paragraph</p></body>';
      const dict = makeRichTextFieldDict('multiline_rv', 'First\nSecond', rv, { multiline: true });
      // Give the field a taller rect so both paragraphs fit
      dict.set('/Rect', PdfArray.fromNumbers([50, 600, 250, 700]));
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('multiline_rv');
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('First paragraph');
      expect(content).toContain('Second paragraph');
    });

    it('handles /RV with <span> font-family mapping', () => {
      const rv = '<body><p><span style="font-family: Courier;">Code</span></p></body>';
      const dict = makeRichTextFieldDict('font_family', 'Code', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should use Courier font
      expect(content).toContain('/Cour');
    });

    it('handles /RV with text-align center on paragraph', () => {
      const rv = '<body><p style="text-align: center;">Centered</p></body>';
      const dict = makeRichTextFieldDict('centered_rv', 'Centered', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('Centered');
    });

    it('handles /RV with <br/> line break', () => {
      const rv = '<body><p>Line 1<br/>Line 2</p></body>';
      const dict = makeRichTextFieldDict('br_field', 'Line 1\nLine 2', rv, { multiline: true });
      // Give the field a taller rect so both lines fit
      dict.set('/Rect', PdfArray.fromNumbers([50, 600, 250, 700]));
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('Line 1');
      expect(content).toContain('Line 2');
    });

    it('handles /RV with hex color #ff0000', () => {
      const rv = '<body><p><span style="color: #ff0000;">Red</span></p></body>';
      const dict = makeRichTextFieldDict('hex_color', 'Red', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('1 0 0 rg');
    });

    it('handles /RV with bold+italic combined', () => {
      const rv = '<body><p><b><i>BoldItalic</i></b></p></body>';
      const dict = makeRichTextFieldDict('bold_italic', 'BoldItalic', rv);
      const form = buildForm([dict]);

      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      // Should use Helvetica-BoldOblique (HeBI)
      expect(content).toContain('/HeBI');
      expect(content).toContain('BoldItalic');
    });

    it('defaults preserveRichText to true (uses /RV by default)', () => {
      const rv = '<body><p><b>DefaultRich</b></p></body>';
      const dict = makeRichTextFieldDict('default_rv', 'Plain', rv);
      const form = buildForm([dict]);

      // No options passed — should default to preserveRichText: true
      const result = flattenForm(form);

      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('DefaultRich');
      expect(content).toContain('/HeBo');
    });

    it('handles empty /RV string by falling back to /V', () => {
      const dict = makeTextFieldDict('empty_rv', 'Fallback');
      dict.set('/RV', PdfString.literal(''));
      const form = buildForm([dict]);

      const result = flattenForm(form);

      expect(result.flattenedFields).toContain('empty_rv');
      const decoder = new TextDecoder();
      const content = decoder.decode(result.xObjects[0]!.stream.data);
      expect(content).toContain('Fallback');
    });
  });
});

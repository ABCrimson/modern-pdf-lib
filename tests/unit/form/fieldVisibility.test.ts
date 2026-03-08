/**
 * Tests for fieldVisibility — show/hide form fields via annotation flags.
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
import { PdfForm } from '../../../src/form/pdfForm.js';
import {
  setFieldVisibility,
  isFieldVisible,
  toggleFieldGroup,
  addVisibilityAction,
} from '../../../src/form/fieldVisibility.js';
import type { VisibilityCondition } from '../../../src/form/fieldVisibility.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Annotation flags */
const HIDDEN = 1 << 1;
const PRINT = 1 << 2;
const NOVIEW = 1 << 5;

function makeTextField(name: string, flags?: number): PdfTextField {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
  if (flags !== undefined) {
    dict.set('/F', PdfNumber.of(flags));
  }
  return new PdfTextField(name, dict, dict);
}

function makeForm(fields: PdfTextField[]): PdfForm {
  const acroDict = new PdfDict();
  const fieldsArr = new PdfArray();
  for (const f of fields) {
    fieldsArr.push(f.getDict());
  }
  acroDict.set('/Fields', fieldsArr);
  return new PdfForm(fields, acroDict);
}

function getAnnotFlags(field: PdfTextField): number {
  const fObj = field.getWidgetDict().get('/F');
  if (fObj !== undefined && fObj.kind === 'number') {
    return (fObj as PdfNumber).value;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// setFieldVisibility
// ---------------------------------------------------------------------------

describe('setFieldVisibility', () => {
  it('hides a field by setting the Hidden flag', () => {
    const field = makeTextField('name');
    setFieldVisibility(field, false);
    expect(getAnnotFlags(field) & HIDDEN).toBe(HIDDEN);
  });

  it('shows a hidden field by clearing Hidden and NoView flags', () => {
    const field = makeTextField('name', HIDDEN);
    setFieldVisibility(field, true);
    expect(getAnnotFlags(field) & HIDDEN).toBe(0);
    expect(getAnnotFlags(field) & NOVIEW).toBe(0);
  });

  it('clears NoView when making visible', () => {
    const field = makeTextField('name', NOVIEW);
    setFieldVisibility(field, true);
    expect(getAnnotFlags(field) & NOVIEW).toBe(0);
  });

  it('preserves other flags when hiding', () => {
    const field = makeTextField('name', PRINT);
    setFieldVisibility(field, false);
    expect(getAnnotFlags(field) & PRINT).toBe(PRINT);
    expect(getAnnotFlags(field) & HIDDEN).toBe(HIDDEN);
  });

  it('clears NoView when hiding (Hidden takes precedence)', () => {
    const field = makeTextField('name', NOVIEW);
    setFieldVisibility(field, false);
    expect(getAnnotFlags(field) & HIDDEN).toBe(HIDDEN);
    expect(getAnnotFlags(field) & NOVIEW).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isFieldVisible
// ---------------------------------------------------------------------------

describe('isFieldVisible', () => {
  it('returns true when no flags are set', () => {
    const field = makeTextField('name');
    expect(isFieldVisible(field)).toBe(true);
  });

  it('returns false when Hidden flag is set', () => {
    const field = makeTextField('name', HIDDEN);
    expect(isFieldVisible(field)).toBe(false);
  });

  it('returns false when NoView flag is set', () => {
    const field = makeTextField('name', NOVIEW);
    expect(isFieldVisible(field)).toBe(false);
  });

  it('returns true when only Print flag is set', () => {
    const field = makeTextField('name', PRINT);
    expect(isFieldVisible(field)).toBe(true);
  });

  it('returns false when both Hidden and NoView are set', () => {
    const field = makeTextField('name', HIDDEN | NOVIEW);
    expect(isFieldVisible(field)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleFieldGroup
// ---------------------------------------------------------------------------

describe('toggleFieldGroup', () => {
  it('hides multiple fields at once', () => {
    const f1 = makeTextField('field1');
    const f2 = makeTextField('field2');
    const f3 = makeTextField('field3');
    const form = makeForm([f1, f2, f3]);

    toggleFieldGroup(form, ['field1', 'field3'], false);

    expect(isFieldVisible(f1)).toBe(false);
    expect(isFieldVisible(f2)).toBe(true);
    expect(isFieldVisible(f3)).toBe(false);
  });

  it('shows multiple fields at once', () => {
    const f1 = makeTextField('field1', HIDDEN);
    const f2 = makeTextField('field2', HIDDEN);
    const form = makeForm([f1, f2]);

    toggleFieldGroup(form, ['field1', 'field2'], true);

    expect(isFieldVisible(f1)).toBe(true);
    expect(isFieldVisible(f2)).toBe(true);
  });

  it('silently skips non-existent fields', () => {
    const f1 = makeTextField('field1');
    const form = makeForm([f1]);

    // Should not throw
    toggleFieldGroup(form, ['field1', 'nonexistent'], false);

    expect(isFieldVisible(f1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addVisibilityAction
// ---------------------------------------------------------------------------

describe('addVisibilityAction', () => {
  it('adds a JavaScript action to the widget dict', () => {
    const field = makeTextField('target');
    const condition: VisibilityCondition = {
      operator: 'equals',
      value: 'yes',
    };

    addVisibilityAction(field, 'triggerField', condition);

    const widgetDict = field.getWidgetDict();
    const aa = widgetDict.get('/AA');
    expect(aa).toBeDefined();
    expect(aa!.kind).toBe('dict');

    const aaDict = aa as PdfDict;
    const vAction = aaDict.get('/V');
    expect(vAction).toBeDefined();
    expect(vAction!.kind).toBe('dict');

    const vDict = vAction as PdfDict;
    const s = vDict.get('/S');
    expect(s).toBeDefined();
    expect((s as PdfName).value).toBe('/JavaScript');

    const js = vDict.get('/JS');
    expect(js).toBeDefined();
    expect((js as PdfString).value).toContain('triggerField');
    expect((js as PdfString).value).toContain('yes');
  });

  it('generates correct script for "equals" condition', () => {
    const field = makeTextField('target');
    addVisibilityAction(field, 'status', { operator: 'equals', value: 'active' });

    const js = ((field.getWidgetDict().get('/AA') as PdfDict).get('/V') as PdfDict).get('/JS') as PdfString;
    expect(js.value).toContain('.value == "active"');
  });

  it('generates correct script for "notEquals" condition', () => {
    const field = makeTextField('target');
    addVisibilityAction(field, 'status', { operator: 'notEquals', value: 'inactive' });

    const js = ((field.getWidgetDict().get('/AA') as PdfDict).get('/V') as PdfDict).get('/JS') as PdfString;
    expect(js.value).toContain('.value != "inactive"');
  });

  it('generates correct script for "contains" condition', () => {
    const field = makeTextField('target');
    addVisibilityAction(field, 'status', { operator: 'contains', value: 'yes' });

    const js = ((field.getWidgetDict().get('/AA') as PdfDict).get('/V') as PdfDict).get('/JS') as PdfString;
    expect(js.value).toContain('.includes("yes")');
  });

  it('generates correct script for "empty" condition', () => {
    const field = makeTextField('target');
    addVisibilityAction(field, 'status', { operator: 'empty' });

    const js = ((field.getWidgetDict().get('/AA') as PdfDict).get('/V') as PdfDict).get('/JS') as PdfString;
    expect(js.value).toContain('.value == ""');
  });

  it('generates correct script for "notEmpty" condition', () => {
    const field = makeTextField('target');
    addVisibilityAction(field, 'status', { operator: 'notEmpty' });

    const js = ((field.getWidgetDict().get('/AA') as PdfDict).get('/V') as PdfDict).get('/JS') as PdfString;
    expect(js.value).toContain('.value != ""');
  });

  it('preserves existing /AA entries', () => {
    const field = makeTextField('target');
    const widgetDict = field.getWidgetDict();

    // Pre-populate /AA with another action
    const existingAA = new PdfDict();
    const existingAction = new PdfDict();
    existingAction.set('/S', PdfName.of('JavaScript'));
    existingAction.set('/JS', PdfString.literal('app.alert("hello");'));
    existingAA.set('/K', existingAction);
    widgetDict.set('/AA', existingAA);

    addVisibilityAction(field, 'trigger', { operator: 'equals', value: 'x' });

    const aa = widgetDict.get('/AA') as PdfDict;
    // Original /K action should still be there
    expect(aa.get('/K')).toBeDefined();
    // New /V action should be added
    expect(aa.get('/V')).toBeDefined();
  });
});

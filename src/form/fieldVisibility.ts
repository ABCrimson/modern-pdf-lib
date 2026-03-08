/**
 * @module form/fieldVisibility
 *
 * Show/hide form fields by manipulating annotation flags.
 *
 * PDF annotation flags (PDF 1.7, Table 165):
 * - Bit 1 (value 2): Hidden — the annotation is hidden and does not
 *   appear on screen or in print.
 * - Bit 5 (value 32): NoView — the annotation is not displayed on screen
 *   but may be printed.
 *
 * This module provides convenience functions for toggling field visibility,
 * including bulk operations and conditional visibility via JavaScript actions.
 *
 * Reference: PDF 1.7 spec, SS12.5.3 (Annotation Flags).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
} from '../core/pdfObjects.js';
import type { PdfField } from './pdfField.js';
import { numVal } from './pdfField.js';
import type { PdfForm } from './pdfForm.js';

// ---------------------------------------------------------------------------
// Annotation flag constants (subset relevant to visibility)
// ---------------------------------------------------------------------------

/** Annotation flag: Hidden (bit 1, value 2). Not displayed or printed. */
const ANNOT_FLAG_HIDDEN = 1 << 1;

/** Annotation flag: NoView (bit 5, value 32). Not displayed but may print. */
const ANNOT_FLAG_NOVIEW = 1 << 5;

/** Annotation flag: Print (bit 2, value 4). Printed when present. */
const ANNOT_FLAG_PRINT = 1 << 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A condition that determines whether a field should be visible,
 * based on another field's value.
 *
 * @property operator - The comparison operator.
 * @property value    - The comparison value (not used for 'empty'/'notEmpty').
 */
export interface VisibilityCondition {
  operator: 'equals' | 'notEquals' | 'contains' | 'empty' | 'notEmpty';
  value?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the raw /F (annotation flags) integer from a field's widget dict.
 */
function getAnnotFlags(field: PdfField): number {
  const widgetDict = field.getWidgetDict();
  return numVal(widgetDict.get('/F')) ?? 0;
}

/**
 * Set the raw /F (annotation flags) integer on a field's widget dict.
 */
function setAnnotFlags(field: PdfField, flags: number): void {
  const widgetDict = field.getWidgetDict();
  widgetDict.set('/F', PdfNumber.of(flags));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the visibility of a form field.
 *
 * When `visible` is `true`, the Hidden and NoView flags are cleared.
 * When `visible` is `false`, the Hidden flag is set (the field is
 * completely hidden — not displayed and not printed).
 *
 * @param field   - The field to show or hide.
 * @param visible - Whether the field should be visible.
 */
export function setFieldVisibility(field: PdfField, visible: boolean): void {
  let flags = getAnnotFlags(field);

  if (visible) {
    // Clear Hidden and NoView flags
    flags &= ~ANNOT_FLAG_HIDDEN;
    flags &= ~ANNOT_FLAG_NOVIEW;
  } else {
    // Set Hidden flag
    flags |= ANNOT_FLAG_HIDDEN;
    // Clear NoView (Hidden takes precedence)
    flags &= ~ANNOT_FLAG_NOVIEW;
  }

  setAnnotFlags(field, flags);
}

/**
 * Check whether a form field is currently visible.
 *
 * A field is considered visible if neither the Hidden nor NoView flag
 * is set on its widget annotation.
 *
 * @param field - The field to check.
 * @returns `true` if the field is visible.
 */
export function isFieldVisible(field: PdfField): boolean {
  const flags = getAnnotFlags(field);
  return (flags & ANNOT_FLAG_HIDDEN) === 0 && (flags & ANNOT_FLAG_NOVIEW) === 0;
}

/**
 * Show or hide multiple fields at once by name.
 *
 * Fields that are not found in the form are silently skipped.
 *
 * @param form       - The form containing the fields.
 * @param fieldNames - Array of field names (partial or fully-qualified).
 * @param visible    - Whether the fields should be visible.
 */
export function toggleFieldGroup(
  form: PdfForm,
  fieldNames: string[],
  visible: boolean,
): void {
  for (const name of fieldNames) {
    const field = form.getField(name);
    if (field !== undefined) {
      setFieldVisibility(field, visible);
    }
  }
}

/**
 * Add a JavaScript action to a field that toggles the visibility of
 * another field based on a condition.
 *
 * This creates an `/AA` (additional actions) entry with a `/V`
 * (value-changed) trigger containing a JavaScript action. The script
 * reads the trigger field's value and shows/hides the target field
 * according to the given condition.
 *
 * Note: The generated JavaScript uses Acrobat's `getField()` API and
 * `display` property. It will only execute in viewers that support
 * JavaScript (e.g., Adobe Acrobat, Foxit).
 *
 * @param field          - The field to attach the action to (trigger).
 * @param triggerField   - The name of the field whose value is checked.
 * @param condition      - The condition to evaluate.
 */
export function addVisibilityAction(
  field: PdfField,
  triggerField: string,
  condition: VisibilityCondition,
): void {
  const script = buildVisibilityScript(triggerField, condition);

  const jsDict = new PdfDict();
  jsDict.set('/S', PdfName.of('JavaScript'));
  jsDict.set('/JS', PdfString.literal(script));

  const widgetDict = field.getWidgetDict();
  let aaDict = widgetDict.get('/AA');
  if (aaDict === undefined || aaDict.kind !== 'dict') {
    aaDict = new PdfDict();
    widgetDict.set('/AA', aaDict);
  }
  (aaDict as PdfDict).set('/V', jsDict);
}

/**
 * Build a JavaScript snippet for conditional visibility.
 */
function buildVisibilityScript(
  triggerField: string,
  condition: VisibilityCondition,
): string {
  const escaped = triggerField.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const fieldRef = `this.getField("${escaped}")`;
  let condExpr: string;

  switch (condition.operator) {
    case 'equals':
      condExpr = `${fieldRef}.value == "${escapeJS(condition.value ?? '')}"`;
      break;
    case 'notEquals':
      condExpr = `${fieldRef}.value != "${escapeJS(condition.value ?? '')}"`;
      break;
    case 'contains':
      condExpr = `${fieldRef}.value.includes("${escapeJS(condition.value ?? '')}")`;
      break;
    case 'empty':
      condExpr = `${fieldRef}.value == ""`;
      break;
    case 'notEmpty':
      condExpr = `${fieldRef}.value != ""`;
      break;
  }

  // display: 0 = visible, 1 = hidden
  return `if (${condExpr}) { event.target.display = display.visible; } else { event.target.display = display.hidden; }`;
}

/**
 * Escape a string for safe embedding in JavaScript.
 */
function escapeJS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

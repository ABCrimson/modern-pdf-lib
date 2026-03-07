/**
 * @module form/fieldReferences
 *
 * Cross-field reference resolution for PDF forms.
 *
 * Provides a proxy API that mimics Acrobat's `this.getField()` method
 * and field object properties, enabling programmatic access to field
 * values, visibility, and flags by name.
 *
 * Reference: Acrobat JavaScript Scripting Reference, Chapter 7 (Field).
 */

import { PdfNumber } from '../core/pdfObjects.js';
import type { PdfField } from './pdfField.js';
import { numVal } from './pdfField.js';
import type { PdfForm } from './pdfForm.js';
import { setFieldVisibility, isFieldVisible } from './fieldVisibility.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A reference to a field that mimics Acrobat's field object API.
 *
 * Supports the most commonly used properties from Acrobat JavaScript:
 * - `value` — get/set the field's value as a string
 * - `valueAsString` — read-only string representation of the value
 * - `readonly` — get/set the read-only flag
 * - `required` — get/set the required flag
 * - `hidden` — get/set the hidden flag (via annotation flags)
 * - `display` — get/set display mode (0=visible, 1=hidden, 2=noView, 3=hiddenButPrintable)
 * - `type` — read-only field type string
 * - `name` — read-only fully-qualified field name
 */
export interface FieldRef {
  name: string;
  value: string;
  readonly valueAsString: string;
  readonly: boolean;
  required: boolean;
  hidden: boolean;
  display: number;
  readonly type: string;
}

/**
 * A proxy object that provides Acrobat's `getField()` API for
 * looking up fields by name.
 */
export interface FieldProxy {
  /**
   * Get a field reference by name, similar to Acrobat's `this.getField()`.
   *
   * @param name - The field name (partial or fully-qualified).
   * @returns A {@link FieldRef} if found, or `null`.
   */
  getField(name: string): FieldRef | null;
}

// ---------------------------------------------------------------------------
// Annotation flag constants (for display property)
// ---------------------------------------------------------------------------

const ANNOT_FLAG_HIDDEN = 1 << 1;
const ANNOT_FLAG_PRINT = 1 << 2;
const ANNOT_FLAG_NOVIEW = 1 << 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a field name to a PdfField instance.
 *
 * Handles hierarchical names (e.g., `"form.section.field"`) by looking
 * up the fully-qualified name in the form's field index.
 *
 * @param form      - The PdfForm to search.
 * @param fieldName - The field name (partial or fully-qualified).
 * @returns The PdfField if found, or `null`.
 */
export function resolveFieldReference(
  form: PdfForm,
  fieldName: string,
): PdfField | null {
  return form.getField(fieldName) ?? null;
}

/**
 * Get a field's value by name.
 *
 * Convenience function that resolves the field and returns its string value.
 *
 * @param form      - The PdfForm to search.
 * @param fieldName - The field name.
 * @returns The field's value as a string, or `null` if the field is not found.
 */
export function getFieldValue(
  form: PdfForm,
  fieldName: string,
): string | null {
  const field = form.getField(fieldName);
  if (field === undefined) return null;

  const val = field.getValue();
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

/**
 * Set a field's value by name.
 *
 * Convenience function that resolves the field and sets its value.
 *
 * @param form      - The PdfForm to search.
 * @param fieldName - The field name.
 * @param value     - The value to set.
 * @returns `true` if the field was found and the value was set, `false` otherwise.
 */
export function setFieldValue(
  form: PdfForm,
  fieldName: string,
  value: string,
): boolean {
  const field = form.getField(fieldName);
  if (field === undefined) return false;

  field.setValue(value);
  return true;
}

/**
 * Create a proxy object that mimics Acrobat's `this.getField()` API.
 *
 * The returned proxy provides a `getField(name)` method that returns
 * a live {@link FieldRef} object with get/set properties for value,
 * readonly, required, hidden, and display.
 *
 * @param form - The PdfForm to wrap.
 * @returns A {@link FieldProxy} instance.
 */
export function createFieldProxy(form: PdfForm): FieldProxy {
  return {
    getField(name: string): FieldRef | null {
      const field = form.getField(name);
      if (field === undefined) return null;

      return createFieldRef(field);
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: FieldRef factory
// ---------------------------------------------------------------------------

/**
 * Create a live FieldRef from a PdfField.
 *
 * The returned object has getter/setter properties that read from and
 * write to the underlying PdfField and its widget dictionary.
 */
function createFieldRef(field: PdfField): FieldRef {
  const ref: FieldRef = {
    get name(): string {
      return field.getFullName();
    },

    get value(): string {
      const val = field.getValue();
      if (typeof val === 'string') return val;
      if (typeof val === 'boolean') return String(val);
      if (Array.isArray(val)) return val.join(', ');
      return String(val);
    },

    set value(v: string) {
      field.setValue(v);
    },

    get valueAsString(): string {
      return ref.value;
    },

    get readonly(): boolean {
      return field.isReadOnly();
    },

    set readonly(v: boolean) {
      field.setReadOnly(v);
    },

    get required(): boolean {
      return field.isRequired();
    },

    set required(v: boolean) {
      field.setRequired(v);
    },

    get hidden(): boolean {
      return !isFieldVisible(field);
    },

    set hidden(v: boolean) {
      setFieldVisibility(field, !v);
    },

    get display(): number {
      const widgetDict = field.getWidgetDict();
      const flags = numVal(widgetDict.get('/F')) ?? 0;

      const isHidden = (flags & ANNOT_FLAG_HIDDEN) !== 0;
      const isNoView = (flags & ANNOT_FLAG_NOVIEW) !== 0;
      const isPrint = (flags & ANNOT_FLAG_PRINT) !== 0;

      if (isHidden) return 1; // hidden
      if (isNoView && isPrint) return 3; // hiddenButPrintable (noPrint visible, noView + print)
      if (isNoView) return 2; // noView
      return 0; // visible
    },

    set display(v: number) {
      const widgetDict = field.getWidgetDict();
      let flags = numVal(widgetDict.get('/F')) ?? 0;

      // Clear all visibility-related flags first
      flags &= ~ANNOT_FLAG_HIDDEN;
      flags &= ~ANNOT_FLAG_NOVIEW;
      flags &= ~ANNOT_FLAG_PRINT;

      switch (v) {
        case 0: // visible
          flags |= ANNOT_FLAG_PRINT;
          break;
        case 1: // hidden
          flags |= ANNOT_FLAG_HIDDEN;
          break;
        case 2: // noView (not displayed, not printed)
          flags |= ANNOT_FLAG_NOVIEW;
          break;
        case 3: // hiddenButPrintable (not displayed but printed)
          flags |= ANNOT_FLAG_NOVIEW;
          flags |= ANNOT_FLAG_PRINT;
          break;
      }

      widgetDict.set('/F', PdfNumber.of(flags));
    },

    get type(): string {
      return field.fieldType;
    },
  };

  return ref;
}

/**
 * @module form/pdfField
 *
 * Base class for all PDF form fields (AcroForm fields).
 *
 * Each concrete field type extends this class and implements
 * `getValue()`, `setValue()`, and `generateAppearance()`.
 *
 * Reference: PDF 1.7 spec, SS12.7 (Interactive Forms).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
  PdfRef,
} from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Minimal page interface (avoids circular dependency with PdfPage)
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a PDF page that can receive widget annotations.
 * Used by {@link PdfField.addToPage} to avoid importing PdfPage directly.
 */
export interface WidgetAnnotationHost {
  /** Add a raw widget annotation dictionary to this page. */
  addWidgetAnnotation(widgetDict: PdfDict): void;
}

// ---------------------------------------------------------------------------
// Field type discriminator
// ---------------------------------------------------------------------------

/** Discriminated union tag for PDF form field types. */
export type FieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'listbox'
  | 'button'
  | 'signature';

// ---------------------------------------------------------------------------
// Field flag constants (PDF 1.7 spec, Table 221 and field-specific tables)
// ---------------------------------------------------------------------------

/** Common field flags (/Ff) — bit positions (0-indexed). */
export const FieldFlags = {
  /** Bit 0: The user may not change the value of the field. */
  ReadOnly: 1 << 0,
  /** Bit 1: The field must have a value at export time. */
  Required: 1 << 1,
  /** Bit 2: The field shall not be exported. */
  NoExport: 1 << 2,

  // Text field flags (Table 228)
  /** Bit 12: The field may contain multiple lines. */
  Multiline: 1 << 12,
  /** Bit 13: The field is intended for entering a password. */
  Password: 1 << 13,
  /** Bit 20: The field shall not scroll. */
  DoNotScroll: 1 << 20,
  /** Bit 23: The value is a rich text string. */
  RichText: 1 << 25,

  // Button field flags (Table 226)
  /** Bit 14: No toggle to off (for radio buttons). */
  NoToggleToOff: 1 << 14,
  /** Bit 15: The field is a set of radio buttons. */
  Radio: 1 << 15,
  /** Bit 16: The field is a pushbutton. */
  Pushbutton: 1 << 16,
  /** Bit 25: If set, exactly one radio button shall be selected. */
  RadiosInUnison: 1 << 25,

  // Choice field flags (Table 230)
  /** Bit 17: The field is a combo box (dropdown). */
  Combo: 1 << 17,
  /** Bit 18: The combo box includes an editable text field. */
  Edit: 1 << 18,
  /** Bit 19: Options shall be sorted alphabetically. */
  Sort: 1 << 19,
  /** Bit 21: More than one item may be selected. */
  MultiSelect: 1 << 21,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an object that may be a PdfRef using a resolver function.
 * If it is not a ref, return as-is.
 */
export function resolveIfRef(
  obj: PdfObject | undefined,
  resolver: (ref: PdfRef) => PdfObject,
): PdfObject | undefined {
  if (obj === undefined) return undefined;
  if (obj.kind === 'ref') return resolver(obj as PdfRef);
  return obj;
}

/**
 * Extract a numeric value from a PdfObject.
 */
export function numVal(obj: PdfObject | undefined): number | undefined {
  if (obj !== undefined && obj.kind === 'number') {
    return (obj as PdfNumber).value;
  }
  return undefined;
}

/**
 * Extract a string value from a PdfObject.
 */
export function strVal(obj: PdfObject | undefined): string | undefined {
  if (obj !== undefined && obj.kind === 'string') {
    return (obj as PdfString).value;
  }
  return undefined;
}

/**
 * Extract a name value (without leading `/`) from a PdfObject.
 */
export function nameVal(obj: PdfObject | undefined): string | undefined {
  if (obj !== undefined && obj.kind === 'name') {
    const val = (obj as PdfName).value;
    return val.startsWith('/') ? val.slice(1) : val;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// PdfField (abstract base)
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all AcroForm field types.
 *
 * Each field holds a reference to the underlying field dictionary
 * (which may be a merged field+widget dictionary in simple forms)
 * and an optional separate widget annotation dictionary.
 */
export abstract class PdfField {
  /** Discriminator for the concrete field type. */
  abstract readonly fieldType: FieldType;

  /** The fully-qualified field name. */
  readonly name: string;

  /**
   * The underlying field dictionary (may contain both field and widget
   * entries for simple one-widget fields).
   */
  protected readonly dict: PdfDict;

  /**
   * The widget annotation dictionary. For merged field+widget dicts,
   * this is the same object as `dict`.
   */
  protected readonly widgetDict: PdfDict;

  /** Parent field dictionary chain for building full names. */
  protected readonly parentNames: string[];

  constructor(
    name: string,
    dict: PdfDict,
    widgetDict: PdfDict,
    parentNames: string[] = [],
  ) {
    this.name = name;
    this.dict = dict;
    this.widgetDict = widgetDict;
    this.parentNames = parentNames;
  }

  // -----------------------------------------------------------------------
  // Name access
  // -----------------------------------------------------------------------

  /** Get the partial field name (/T entry). */
  getName(): string {
    return this.name;
  }

  /**
   * Get the fully qualified field name (Parent.Child.Name format).
   * Per PDF spec SS12.7.3.2, the full name is formed by concatenating
   * ancestor /T values with periods.
   */
  getFullName(): string {
    if (this.parentNames.length === 0) return this.name;
    return [...this.parentNames, this.name].join('.');
  }

  // -----------------------------------------------------------------------
  // Field flags
  // -----------------------------------------------------------------------

  /** Get the raw /Ff (field flags) integer value. */
  protected getFieldFlags(): number {
    return numVal(this.dict.get('/Ff')) ?? 0;
  }

  /** Set the raw /Ff (field flags) integer value. */
  protected setFieldFlags(flags: number): void {
    this.dict.set('/Ff', PdfNumber.of(flags));
  }

  /** Check if a specific flag bit is set. */
  protected hasFlag(flag: number): boolean {
    return (this.getFieldFlags() & flag) !== 0;
  }

  /** Set or clear a specific flag bit. */
  protected setFlag(flag: number, on: boolean): void {
    const current = this.getFieldFlags();
    if (on) {
      this.setFieldFlags(current | flag);
    } else {
      this.setFieldFlags(current & ~flag);
    }
  }

  /** Whether the field is read-only. */
  isReadOnly(): boolean {
    return this.hasFlag(FieldFlags.ReadOnly);
  }

  /** Set the read-only flag. */
  setReadOnly(readOnly: boolean): void {
    this.setFlag(FieldFlags.ReadOnly, readOnly);
  }

  /** Whether the field is required. */
  isRequired(): boolean {
    return this.hasFlag(FieldFlags.Required);
  }

  /** Set the required flag. */
  setRequired(required: boolean): void {
    this.setFlag(FieldFlags.Required, required);
  }

  /** Whether the field should not be exported. */
  isNoExport(): boolean {
    return this.hasFlag(FieldFlags.NoExport);
  }

  /** Whether the field is exported (inverse of NoExport flag). */
  isExported(): boolean {
    return !this.hasFlag(FieldFlags.NoExport);
  }

  /** Enable exporting this field (clear the NoExport flag). */
  enableExporting(): void {
    this.setFlag(FieldFlags.NoExport, false);
  }

  /** Disable exporting this field (set the NoExport flag). */
  disableExporting(): void {
    this.setFlag(FieldFlags.NoExport, true);
  }

  // -----------------------------------------------------------------------
  // Widget rectangle
  // -----------------------------------------------------------------------

  /**
   * Get the field's widget rectangle as `[x1, y1, x2, y2]`.
   * The /Rect entry comes from the widget annotation dictionary.
   */
  getRect(): [number, number, number, number] {
    const rectObj = this.widgetDict.get('/Rect');
    if (rectObj !== undefined && rectObj.kind === 'array') {
      const arr = rectObj as PdfArray;
      const x1 = numVal(arr.items[0]) ?? 0;
      const y1 = numVal(arr.items[1]) ?? 0;
      const x2 = numVal(arr.items[2]) ?? 0;
      const y2 = numVal(arr.items[3]) ?? 0;
      return [x1, y1, x2, y2];
    }
    return [0, 0, 0, 0];
  }

  // -----------------------------------------------------------------------
  // Add to page
  // -----------------------------------------------------------------------

  /**
   * Add this field's widget annotation to a page.
   *
   * Ensures the widget dict has `/Type /Annot` and `/Subtype /Widget`,
   * then adds it to the page's annotation list so it appears in the
   * rendered PDF.
   *
   * @param page  A page that implements {@link WidgetAnnotationHost}.
   */
  addToPage(page: WidgetAnnotationHost): void {
    // Ensure widget dict has /Type /Annot and /Subtype /Widget
    if (!this.widgetDict.has('/Type')) {
      this.widgetDict.set('/Type', PdfName.of('Annot'));
    }
    if (!this.widgetDict.has('/Subtype')) {
      this.widgetDict.set('/Subtype', PdfName.of('Widget'));
    }
    page.addWidgetAnnotation(this.widgetDict);
  }

  /**
   * Get the underlying widget annotation dictionary.
   * @internal
   */
  getWidgetDict(): PdfDict {
    return this.widgetDict;
  }

  // -----------------------------------------------------------------------
  // Abstract methods
  // -----------------------------------------------------------------------

  /** Get the current value of this field. */
  abstract getValue(): string | boolean | string[];

  /** Set the value of this field. */
  abstract setValue(value: string | boolean | string[]): void;

  /**
   * Generate the /AP (appearance) stream for this field's current value.
   * Returns a PdfStream suitable for the /N (normal) appearance.
   */
  abstract generateAppearance(): PdfStream;
}

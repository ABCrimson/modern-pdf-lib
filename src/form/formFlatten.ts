/**
 * @module form/formFlatten
 *
 * Flatten interactive form fields into static page content.
 *
 * Form flattening converts interactive AcroForm fields into non-editable
 * page content by merging each field's appearance stream into the page's
 * content stream as a Form XObject, then removing the interactive form
 * structure (widget annotations and the AcroForm dictionary).
 *
 * This is a common enterprise requirement for producing final,
 * non-editable PDFs (e.g. invoices, contracts, government forms).
 *
 * Reference: PDF 1.7 spec, SS12.5.5 (Appearance Streams),
 *            SS12.7 (Interactive Forms).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfField } from './pdfField.js';
import { FieldFlags, numVal } from './pdfField.js';
import type { PdfForm } from './pdfForm.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for form flattening operations.
 */
export interface FlattenOptions {
  /**
   * If `true`, read-only fields are skipped and left interactive.
   * All other fields are flattened normally.
   *
   * Default: `false` (all fields are flattened, including read-only ones).
   */
  preserveReadOnly?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Format a number for PDF content stream output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Get the normal (/N) appearance stream from a field's widget dictionary.
 *
 * Checks the /AP dictionary for a /N entry that is a PdfStream.
 * If /AP is absent or /N is not a stream, returns `undefined`.
 */
function getAppearanceStream(widgetDict: PdfDict): PdfStream | undefined {
  const ap = widgetDict.get('/AP');
  if (ap === undefined || ap.kind !== 'dict') return undefined;

  const apDict = ap as PdfDict;
  const nObj = apDict.get('/N');

  // /N can be a stream directly (most fields) or a dict of streams
  // (checkboxes/radio buttons — keyed by state name).
  if (nObj === undefined) return undefined;

  if (nObj.kind === 'stream') {
    return nObj as PdfStream;
  }

  // For checkbox/radio: /N is a dict mapping state names to streams.
  // Pick the stream matching the current /AS (appearance state).
  if (nObj.kind === 'dict') {
    const nDict = nObj as PdfDict;
    const asObj = widgetDict.get('/AS');
    if (asObj !== undefined && asObj.kind === 'name') {
      const stateName = (asObj as PdfName).value;
      const stateStream = nDict.get(stateName);
      if (stateStream !== undefined && stateStream.kind === 'stream') {
        return stateStream as PdfStream;
      }
    }
    // Fallback: try to find any non-Off stream
    for (const [key, value] of nDict) {
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      if (cleanKey !== 'Off' && value.kind === 'stream') {
        return value as PdfStream;
      }
    }
  }

  return undefined;
}

/**
 * Extract the widget rectangle as `[x1, y1, x2, y2]`.
 */
function getWidgetRect(widgetDict: PdfDict): [number, number, number, number] {
  const rectObj = widgetDict.get('/Rect');
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

/**
 * Build the content stream operators that paint a Form XObject
 * at the position and size defined by the widget rectangle.
 *
 * Uses the XObject's BBox to determine scaling. If no BBox is found,
 * the widget dimensions are used as a 1:1 mapping.
 */
function buildFlattenOps(
  xObjectName: string,
  rect: [number, number, number, number],
  appearance: PdfStream,
): string {
  const [x1, y1, x2, y2] = rect;
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  if (width <= 0 || height <= 0) return '';

  // Determine the appearance stream's native size from BBox
  let bboxWidth = width;
  let bboxHeight = height;

  const bboxObj = appearance.dict.get('/BBox');
  if (bboxObj !== undefined && bboxObj.kind === 'array') {
    const bboxArr = bboxObj as PdfArray;
    const bx1 = numVal(bboxArr.items[0]) ?? 0;
    const by1 = numVal(bboxArr.items[1]) ?? 0;
    const bx2 = numVal(bboxArr.items[2]) ?? width;
    const by2 = numVal(bboxArr.items[3]) ?? height;
    bboxWidth = Math.abs(bx2 - bx1);
    bboxHeight = Math.abs(by2 - by1);
  }

  // Scale factors to map the XObject's coordinate space to the widget rect
  const sx = bboxWidth > 0 ? width / bboxWidth : 1;
  const sy = bboxHeight > 0 ? height / bboxHeight : 1;

  let ops = '';
  ops += 'q\n';
  // Position at the widget's lower-left corner, scaled to widget size
  ops += `${n(sx)} 0 0 ${n(sy)} ${n(Math.min(x1, x2))} ${n(Math.min(y1, y2))} cm\n`;
  ops += `/${xObjectName} Do\n`;
  ops += 'Q\n';

  return ops;
}

/**
 * Check whether a field should be skipped based on flatten options.
 */
function shouldSkipField(field: PdfField, options: FlattenOptions): boolean {
  if (options.preserveReadOnly && field.isReadOnly()) {
    return true;
  }
  return false;
}

/**
 * Result of flattening a single field, containing the operators and
 * XObject entries to merge into the page.
 */
interface FlattenResult {
  /** Content stream operators to append to the page. */
  ops: string;
  /** XObject name-to-stream pairs to add to page resources. */
  xObjects: Array<{ name: string; stream: PdfStream }>;
}

/** Monotonically increasing counter for unique XObject names. */
let flattenXObjectCounter = 0;

/**
 * Reset the XObject name counter (for testing determinism).
 * @internal
 */
export function _resetFlattenCounter(): void {
  flattenXObjectCounter = 0;
}

/**
 * Flatten a single field: extract its appearance, build operators,
 * and return the result without mutating any form/page state.
 */
function flattenSingleField(field: PdfField): FlattenResult {
  const result: FlattenResult = { ops: '', xObjects: [] };

  // Ensure appearance is generated
  const generatedAppearance = field.generateAppearance();

  // Try to get an existing appearance stream from the widget dict first
  const widgetDict = field.getWidgetDict();
  const existingAppearance = getAppearanceStream(widgetDict);
  const appearance = existingAppearance ?? generatedAppearance;

  const rect = getWidgetRect(widgetDict);

  // Skip zero-area fields
  const w = Math.abs(rect[2] - rect[0]);
  const h = Math.abs(rect[3] - rect[1]);
  if (w <= 0 || h <= 0) return result;

  // Ensure the appearance stream has Form XObject metadata
  if (!appearance.dict.has('/Type')) {
    appearance.dict.set('/Type', PdfName.of('XObject'));
  }
  if (!appearance.dict.has('/Subtype')) {
    appearance.dict.set('/Subtype', PdfName.of('Form'));
  }
  if (!appearance.dict.has('/BBox')) {
    appearance.dict.set('/BBox', PdfArray.fromNumbers([0, 0, w, h]));
  }

  const xObjName = `FlatField${flattenXObjectCounter++}`;
  const ops = buildFlattenOps(xObjName, rect, appearance);

  if (ops.length > 0) {
    result.ops = ops;
    result.xObjects.push({ name: xObjName, stream: appearance });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten ALL form fields into static page content.
 *
 * For each field in the document's AcroForm:
 * 1. Generate / retrieve the field's appearance stream
 * 2. Embed the appearance as a Form XObject in the page's content stream
 * 3. Remove the widget annotation from the page
 * 4. Remove the field from the AcroForm
 *
 * After all fields are processed, the /AcroForm dictionary is cleared.
 *
 * @param form     The document's PdfForm.
 * @param options  Optional flatten options.
 * @returns An object describing the flatten operations performed, suitable
 *          for the caller to apply to page content streams and resources.
 */
export function flattenForm(
  form: PdfForm,
  options: FlattenOptions = {},
): FlattenFormResult {
  const fields = form.getFields();
  return flattenFieldList(form, fields, options, true);
}

/**
 * Flatten a SINGLE field by name.
 *
 * Locates the field in the form, merges its appearance into the page
 * content, removes the widget annotation, and removes the field from
 * the AcroForm's /Fields array. Other fields remain interactive.
 *
 * @param form       The document's PdfForm.
 * @param fieldName  The name of the field to flatten (partial or fully-qualified).
 * @param options    Optional flatten options.
 * @returns An object describing the flatten operations performed.
 * @throws If the field is not found.
 */
export function flattenField(
  form: PdfForm,
  fieldName: string,
  options: FlattenOptions = {},
): FlattenFormResult {
  const field = form.getField(fieldName);
  if (field === undefined) {
    throw new Error(`Form field "${fieldName}" not found.`);
  }
  return flattenFieldList(form, [field], options, false);
}

/**
 * Flatten specific fields by name.
 *
 * @param form        The document's PdfForm.
 * @param fieldNames  Array of field names to flatten.
 * @param options     Optional flatten options.
 * @returns An object describing the flatten operations performed.
 * @throws If any field name is not found.
 */
export function flattenFields(
  form: PdfForm,
  fieldNames: string[],
  options: FlattenOptions = {},
): FlattenFormResult {
  const fields: PdfField[] = [];
  for (const name of fieldNames) {
    const field = form.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    fields.push(field);
  }
  return flattenFieldList(form, fields, options, false);
}

/**
 * Result of a form flatten operation.
 *
 * Contains the content stream operators and XObject resources that
 * must be applied to the page(s) to complete the flattening.
 */
export interface FlattenFormResult {
  /** Content stream operators to append to the page. */
  contentOps: string;
  /** XObject name-to-stream pairs to add to page resources. */
  xObjects: Array<{ name: string; stream: PdfStream }>;
  /** Names of fields that were flattened. */
  flattenedFields: string[];
  /** Names of fields that were skipped (e.g. read-only with preserveReadOnly). */
  skippedFields: string[];
  /** Whether the AcroForm was fully removed (all fields flattened). */
  acroFormRemoved: boolean;
}

/**
 * Internal workhorse: flatten a list of fields and optionally
 * clear the AcroForm entirely.
 */
function flattenFieldList(
  form: PdfForm,
  fields: PdfField[],
  options: FlattenOptions,
  removeAcroForm: boolean,
): FlattenFormResult {
  const result: FlattenFormResult = {
    contentOps: '',
    xObjects: [],
    flattenedFields: [],
    skippedFields: [],
    acroFormRemoved: false,
  };

  for (const field of fields) {
    if (shouldSkipField(field, options)) {
      result.skippedFields.push(field.getFullName());
      continue;
    }

    const fieldResult = flattenSingleField(field);
    result.contentOps += fieldResult.ops;
    result.xObjects.push(...fieldResult.xObjects);
    result.flattenedFields.push(field.getFullName());

    // Remove the field from the form
    try {
      form.removeField(field.getFullName());
    } catch {
      // Field may already have been removed (e.g. child of radio group)
      // or may not be found by full name; try partial name
      try {
        form.removeField(field.getName());
      } catch {
        // Silently continue — the field will be orphaned
      }
    }
  }

  // If all fields were flattened (removeAcroForm flag), clear the AcroForm.
  // The AcroForm is only fully removed when no fields remain at all —
  // skipped fields (e.g. preserved read-only) keep the AcroForm alive.
  if (removeAcroForm) {
    const remainingFields = form.getFields();
    if (remainingFields.length === 0 && result.skippedFields.length === 0) {
      result.acroFormRemoved = true;
    }
  }

  return result;
}

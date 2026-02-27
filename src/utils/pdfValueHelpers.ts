/**
 * @module utils/pdfValueHelpers
 *
 * Convenience helpers for converting between JS values and PDF object types.
 * These match the pdf-lib helper API surface.
 */

import { PdfName, PdfNumber } from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';

/**
 * Create a {@link PdfName} from a string.
 *
 * @param value  The name value (with or without leading `/`).
 */
export function asPDFName(value: string): PdfName {
  return PdfName.of(value);
}

/**
 * Create a {@link PdfNumber} from a numeric value.
 *
 * @param value  The number.
 */
export function asPDFNumber(value: number): PdfNumber {
  return PdfNumber.of(value);
}

/**
 * Extract a numeric value from a {@link PdfObject}.
 *
 * Returns `undefined` if the object is not a PdfNumber.
 *
 * @param obj  The PDF object to inspect.
 */
export function asNumber(obj: PdfObject): number | undefined {
  if (obj.kind === 'number') return (obj as PdfNumber).value;
  return undefined;
}

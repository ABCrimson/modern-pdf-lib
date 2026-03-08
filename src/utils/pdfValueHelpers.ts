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
 * @returns      A new {@link PdfName} instance.
 *
 * @example
 * ```ts
 * const name = asPdfName('Type');
 * ```
 */
export function asPdfName(value: string): PdfName {
  return PdfName.of(value);
}

/**
 * Create a {@link PdfNumber} from a numeric value.
 *
 * @param value  The number.
 * @returns      A new {@link PdfNumber} instance.
 *
 * @example
 * ```ts
 * const num = asPdfNumber(42);
 * ```
 */
export function asPdfNumber(value: number): PdfNumber {
  return PdfNumber.of(value);
}

/**
 * Create a {@link PdfName} from a string.
 *
 * @deprecated Use {@link asPdfName} instead. This alias uses inconsistent
 *             PascalCase `PDF` while the rest of the codebase uses `Pdf`.
 *             Will be removed in v2.0.
 * @param value  The name value (with or without leading `/`).
 * @returns      A new {@link PdfName} instance.
 */
export function asPDFName(value: string): PdfName {
  return asPdfName(value);
}

/**
 * Create a {@link PdfNumber} from a numeric value.
 *
 * @deprecated Use {@link asPdfNumber} instead. This alias uses inconsistent
 *             PascalCase `PDF` while the rest of the codebase uses `Pdf`.
 *             Will be removed in v2.0.
 * @param value  The number.
 * @returns      A new {@link PdfNumber} instance.
 */
export function asPDFNumber(value: number): PdfNumber {
  return asPdfNumber(value);
}

/**
 * Extract a numeric value from a {@link PdfObject}.
 *
 * Returns `undefined` if the object is not a PdfNumber.
 *
 * @param obj  The PDF object to inspect.
 * @returns    The numeric value, or `undefined` if not a PdfNumber.
 *
 * @example
 * ```ts
 * const val = asNumber(someObj); // number | undefined
 * ```
 */
export function asNumber(obj: PdfObject): number | undefined {
  if (obj.kind === 'number') return (obj as PdfNumber).value;
  return undefined;
}

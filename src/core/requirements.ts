/**
 * @module core/requirements
 *
 * Document requirements handling (ISO 32000-2 §7.12.7).
 *
 * The optional `/Requirements` entry in the document catalog lists the
 * features a conforming reader must support in order to fully process the
 * document.  Each entry is a *requirement dictionary* with `/Type /Reqs`
 * and an `/S` name identifying the required feature.  A reader that cannot
 * satisfy a listed requirement should warn the user (or refuse to open the
 * document) rather than silently degrading.
 *
 * Usage:
 * ```ts
 * import { buildRequirements } from 'modern-pdf-lib';
 *
 * const reqs = buildRequirements(['EnableJavaScripts', 'AcroForm']);
 * catalog.set('/Requirements', reqs);
 * ```
 *
 * Reference: ISO 32000-2:2020, §7.12.7 (Requirements dictionaries).
 */

import { PdfArray, PdfDict, PdfName } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A standard requirement type, used as the `/S` (subtype) value of a
 * requirement dictionary.  Each value names a feature the reader must
 * support to fully process the document.
 *
 * | Value                 | Meaning                                            |
 * |-----------------------|----------------------------------------------------|
 * | `EnableJavaScripts`   | Document-level JavaScript must be executable.      |
 * | `Attachment`          | Embedded file attachments must be supported.       |
 * | `AcroForm`            | Interactive (AcroForm) form fields are present.    |
 * | `Navigation`          | Presentation / navigation nodes must be supported. |
 * | `Markup`              | Markup annotations must be supported.              |
 * | `Encryption`          | The encryption scheme must be supported.           |
 * | `DigSigValidation`    | Digital signatures must be validatable.            |
 */
export type RequirementType =
  | 'EnableJavaScripts'
  | 'Attachment'
  | 'AcroForm'
  | 'Navigation'
  | 'Markup'
  | 'Encryption'
  | 'DigSigValidation';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build a single requirement dictionary for the given requirement type.
 *
 * The returned dictionary has the form:
 * ```
 * << /Type /Reqs /S /<type> >>
 * ```
 *
 * @param type - The requirement type used as the `/S` name.
 * @returns A {@link PdfDict} representing one requirement dictionary.
 */
export function buildRequirement(type: RequirementType): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Reqs'));
  dict.set('/S', PdfName.of(type));
  return dict;
}

/**
 * Build the document catalog `/Requirements` array from a list of
 * requirement types.
 *
 * Each element of the returned array is a requirement dictionary
 * (see {@link buildRequirement}).  Duplicate types are preserved in the
 * order supplied; callers that want a de-duplicated set should filter the
 * input first.
 *
 * @param types - The requirement types, in the desired order.
 * @returns A {@link PdfArray} suitable for the catalog `/Requirements` key.
 */
export function buildRequirements(types: readonly RequirementType[]): PdfArray {
  return new PdfArray(types.map((type) => buildRequirement(type)));
}

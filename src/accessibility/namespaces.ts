/**
 * @module accessibility/namespaces
 *
 * PDF 2.0 structure namespaces (ISO 32000-2, §14.7.4).
 *
 * PDF 2.0 introduces *structure namespaces* so that a tagged PDF can mix
 * standard structure types with types drawn from external vocabularies
 * (e.g. MathML) without ambiguity.  Each namespace is described by a
 * `/Namespace` dictionary that carries:
 *
 * - `/NS`        — the namespace identifier, a string (typically a URI).
 * - `/Schema`    — an optional reference / string locating a schema that
 *                  defines the namespace's vocabulary.
 * - `/RoleMapNS` — an optional dictionary mapping namespace-specific
 *                  structure types onto standard structure types (or onto
 *                  types in another namespace).
 *
 * The collection of all namespaces used by a document is stored in the
 * `/Namespaces` array of the `/StructTreeRoot` dictionary.
 *
 * This module is purely additive: it builds the relevant PDF dictionaries
 * and arrays from {@link NamespaceDef} descriptors and does not depend on,
 * or modify, the existing structure-tree implementation.
 *
 * Reference: PDF 2.0 spec (ISO 32000-2), §14.7.4 (Namespaces).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfString,
} from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Common namespace identifiers
// ---------------------------------------------------------------------------

/**
 * The standard structure namespace introduced by PDF 2.0
 * (ISO 32000-2). Structure elements with no explicit namespace are
 * considered to belong to this namespace.
 */
export const PDF2_NAMESPACE: string = 'http://iso.org/pdf2/ssn';

/** The MathML namespace identifier (W3C MathML vocabulary). */
export const MATHML_NAMESPACE: string = 'http://www.w3.org/1998/Math/MathML';

// ---------------------------------------------------------------------------
// Namespace descriptor
// ---------------------------------------------------------------------------

/**
 * A plain, serializable description of a single PDF 2.0 structure
 * namespace.
 */
export interface NamespaceDef {
  /** The namespace identifier (`/NS`) — typically a URI. */
  readonly ns: string;
  /**
   * Optional schema locator (`/Schema`).  Serialized as a PDF string;
   * usually a URI or file name pointing at the namespace's schema.
   */
  readonly schema?: string | undefined;
  /**
   * Optional role map (`/RoleMapNS`).  Maps namespace-specific structure
   * type names onto standard (or other-namespace) structure type names.
   */
  readonly roleMap?: Readonly<Record<string, string>> | undefined;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build a `/Namespace` dictionary from a {@link NamespaceDef}.
 *
 * The result always carries `/Type /Namespace` and `/NS` (a PDF string).
 * `/Schema` and `/RoleMapNS` are added only when supplied.
 *
 * @param def - the namespace descriptor.
 * @returns a freshly allocated {@link PdfDict} for the namespace.
 */
export function buildNamespace(def: NamespaceDef): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Namespace'));
  dict.set('/NS', PdfString.literal(def.ns));

  if (def.schema !== undefined) {
    dict.set('/Schema', PdfString.literal(def.schema));
  }

  const roleMap = def.roleMap;
  if (roleMap !== undefined) {
    const entries = Object.entries(roleMap);
    if (entries.length > 0) {
      const roleMapDict = new PdfDict();
      for (const [from, to] of entries) {
        roleMapDict.set(`/${from}`, PdfName.of(to));
      }
      dict.set('/RoleMapNS', roleMapDict);
    }
  }

  return dict;
}

/**
 * Build the `/Namespaces` array (as found in `/StructTreeRoot`) from a
 * list of {@link NamespaceDef} descriptors.
 *
 * @param defs - the namespace descriptors, in order.
 * @returns a {@link PdfArray} of `/Namespace` dictionaries.
 */
export function buildNamespacesArray(defs: readonly NamespaceDef[]): PdfArray {
  const array = new PdfArray();
  for (const def of defs) {
    array.push(buildNamespace(def));
  }
  return array;
}

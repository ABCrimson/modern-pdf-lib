/**
 * @module accessibility/pdfUa2
 *
 * PDF/UA-2 (ISO 14289-2) validation and XMP identification.
 *
 * PDF/UA-2 is the conformance standard for accessible PDF that is built on
 * top of **PDF 2.0** (ISO 32000-2), whereas PDF/UA-1 (ISO 14289-1) targets
 * PDF 1.7.  The two share a large body of tagging, language, and metadata
 * requirements; PDF/UA-2 adds requirements that depend on PDF 2.0 features —
 * most notably the use of **structure namespaces** (ISO 32000-2, §14.7.4).
 *
 * This module is intentionally *layered* on the existing PDF/UA-1 validator
 * ({@link validatePdfUa}) rather than re-implementing the shared checks:
 *
 * 1. Run {@link validatePdfUa} and fold its errors into the UA-2 result
 *    (re-mapped to ISO 14289-2 clause references).
 * 2. Add the PDF 2.0 / UA-2-specific requirements:
 *    - a structure tree must exist (tagged PDF);
 *    - the structure tree must declare structure `/Namespaces`
 *      (PDF/UA-2 builds on PDF 2.0 namespaces);
 *    - the document must declare a natural language (`/Lang`);
 *    - figures must carry alternative text.
 *
 * It also provides {@link buildPdfUa2Xmp}, which serializes the XMP packet
 * that *identifies* a document as PDF/UA-2 via the AIIM `pdfuaid` schema
 * (`pdfuaid:part = 2`).
 *
 * Reference: ISO 14289-2 (PDF/UA-2), ISO 32000-2 §14.7.4 (Namespaces),
 *   AIIM PDF/UA identification schema (http://www.aiim.org/pdfua/ns/id/).
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import type { PdfStructureTree } from './structureTree.js';
import { validatePdfUa } from './pdfUaValidator.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single PDF/UA-2 conformance issue.
 *
 * Every issue carries a machine-readable {@link code}, a human-readable
 * {@link message}, and the ISO 14289-2 {@link clause} the requirement is
 * drawn from.
 */
export interface PdfUa2Issue {
  /** Machine-readable issue code (e.g. `"UA2-STRUCT-001"`). */
  code: string;
  /** Human-readable description of the violation. */
  message: string;
  /** The ISO 14289-2 clause reference for the requirement. */
  clause: string;
}

/**
 * Result of a {@link validatePdfUa2} check.
 *
 * `conformant` is `true` only when there are no issues.
 */
export interface PdfUa2Result {
  /** Whether the document satisfies all PDF/UA-2 requirements checked. */
  conformant: boolean;
  /** The list of conformance issues (empty when conformant). */
  issues: PdfUa2Issue[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The AIIM PDF/UA identification namespace URI (used in the XMP packet). */
const PDFUA_ID_NS: string = 'http://www.aiim.org/pdfua/ns/id/';

/** The PDF/UA part identified by this module's XMP. */
const PDFUA2_PART: number = 2;

/**
 * The PDF/UA-2 revision year.  ISO 14289-2 was published in 2024, which the
 * AIIM `pdfuaid:rev` field records as a four-digit year.
 */
const PDFUA2_REV: number = 2024;

/** Illustration types that require alternative text under PDF/UA-2. */
const ILLUSTRATION_TYPES: ReadonlySet<string> = new Set<string>([
  'Figure',
  'Formula',
  'Form',
]);

// ---------------------------------------------------------------------------
// validatePdfUa2
// ---------------------------------------------------------------------------

/**
 * Validate a PDF document against PDF/UA-2 (ISO 14289-2) requirements.
 *
 * The check reuses {@link validatePdfUa} for the shared tagging, language,
 * MarkInfo, and metadata requirements, then layers the PDF 2.0 / UA-2
 * specific requirements on top:
 *
 * - **UA2-STRUCT-001** — a structure tree must exist (tagged PDF).
 * - **UA2-NS-001** — the structure tree must declare structure
 *   `/Namespaces` (PDF/UA-2 builds on PDF 2.0 namespaces).
 * - **UA2-LANG-001** — the document must declare a natural language
 *   (`/Lang`).
 * - **UA2-FIG-001** — every figure must carry alternative text.
 *
 * Each failure is mapped to an ISO 14289-2 clause string.  The returned
 * result is `conformant` only when there are no issues.
 *
 * @param doc  The PDF document to validate.
 * @returns    A {@link PdfUa2Result} describing conformance and issues.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { validatePdfUa2 } from 'modern-pdf-lib/accessibility';
 *
 * const doc = createPdf();
 * const result = validatePdfUa2(doc);
 * if (!result.conformant) {
 *   for (const issue of result.issues) {
 *     console.error(`[${issue.code}] ${issue.message} (§${issue.clause})`);
 *   }
 * }
 * ```
 */
export function validatePdfUa2(doc: PdfDocument): PdfUa2Result {
  const issues: PdfUa2Issue[] = [];

  const tree = doc.getStructureTree();

  // --- 1. Structure tree must exist (tagged PDF) --------------------------
  // ISO 14289-2 §8 — Tagged PDF / logical structure is mandatory.
  if (!tree) {
    issues.push({
      code: 'UA2-STRUCT-001',
      message:
        'Document has no structure tree (/StructTreeRoot). ' +
        'PDF/UA-2 requires a fully tagged PDF 2.0 document with logical ' +
        'structure.',
      clause: '8.2',
    });
  }

  // --- 2. Structure /Namespaces must be declared --------------------------
  // ISO 14289-2 §8.2.2 — PDF/UA-2 builds on PDF 2.0 structure namespaces
  // (ISO 32000-2 §14.7.4); the StructTreeRoot must carry /Namespaces.
  if (!hasDeclaredNamespaces(tree)) {
    issues.push({
      code: 'UA2-NS-001',
      message:
        'Structure tree does not declare structure /Namespaces. ' +
        'PDF/UA-2 builds on PDF 2.0 structure namespaces (ISO 32000-2 ' +
        '§14.7.4); the StructTreeRoot must declare its namespaces.',
      clause: '8.2.2',
    });
  }

  // --- 3. Document language --------------------------------------------------
  // ISO 14289-2 §7.2 — the document must specify a default natural language.
  const lang = doc.getLanguage();
  if (lang === undefined || lang.trim().length === 0) {
    issues.push({
      code: 'UA2-LANG-001',
      message:
        'Document has no natural language (/Lang). ' +
        'PDF/UA-2 requires the document catalog to specify a default ' +
        'natural language.',
      clause: '7.2',
    });
  }

  // --- 4. Figures must have alternative text -------------------------------
  // ISO 14289-2 §7.3 — non-decorative illustrations require /Alt or
  // /ActualText.
  if (tree) {
    for (const elem of tree.getAllElements()) {
      if (!ILLUSTRATION_TYPES.has(elem.type)) continue;
      if (elem.options.artifact) continue;

      const alt = elem.options.altText;
      const actual = elem.options.actualText;
      const hasAlt = alt !== undefined && alt.trim().length > 0;
      const hasActual = actual !== undefined && actual.trim().length > 0;

      if (!hasAlt && !hasActual) {
        issues.push({
          code: 'UA2-FIG-001',
          message:
            `${elem.type} element has no /Alt or /ActualText. ` +
            'PDF/UA-2 requires alternative text for all non-decorative ' +
            'illustration elements.',
          clause: '7.3',
        });
      }
    }
  }

  // --- 5. Fold in shared PDF/UA-1 errors, re-mapped to UA-2 ----------------
  // The PDF/UA-1 validator covers a broad set of shared requirements
  // (title, DisplayDocTitle, heading hierarchy, tables, lists, fonts, …).
  // We surface those that are not already represented above so a UA-2
  // result is a strict superset of the shared baseline, without producing
  // duplicate structure-tree / language issues.
  const ua1 = validatePdfUa(doc);
  for (const err of ua1.errors) {
    if (isCoveredByUa2(err.code)) continue;
    issues.push({
      code: `UA2-${err.code}`,
      message: err.message,
      clause: mapUa1Clause(err.clause),
    });
  }

  return {
    conformant: issues.length === 0,
    issues,
  };
}

// ---------------------------------------------------------------------------
// buildPdfUa2Xmp
// ---------------------------------------------------------------------------

/**
 * Build an XMP packet (RDF/XML) that identifies a document as PDF/UA-2.
 *
 * The packet declares the AIIM PDF/UA identification schema
 * (`pdfuaid`, namespace `http://www.aiim.org/pdfua/ns/id/`) with:
 *
 * - `pdfuaid:part` = `2` — the PDF/UA part (ISO 14289-2);
 * - `pdfuaid:rev`  = the revision year of the standard.
 *
 * The result is a serialized, packet-wrapped XMP string suitable for
 * embedding as the document's `/Metadata` stream.
 *
 * @returns  The serialized PDF/UA-2 identification XMP packet.
 *
 * @example
 * ```ts
 * import { buildPdfUa2Xmp } from 'modern-pdf-lib/accessibility';
 *
 * doc.setXmpMetadata(buildPdfUa2Xmp());
 * ```
 */
export function buildPdfUa2Xmp(): string {
  // A standalone XMP packet: packet header, x:xmpmeta wrapper, an rdf:RDF
  // document carrying a single rdf:Description for the pdfuaid schema, and
  // the packet trailer.
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    `    <rdf:Description rdf:about=""`,
    `        xmlns:pdfuaid="${PDFUA_ID_NS}">`,
    `      <pdfuaid:part>${PDFUA2_PART}</pdfuaid:part>`,
    `      <pdfuaid:rev>${PDFUA2_REV}</pdfuaid:rev>`,
    '    </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a structure tree declares one or more structure
 * namespaces.
 *
 * The in-memory {@link PdfStructureTree} model does not yet carry a
 * first-class namespaces field, so callers declare namespaces by attaching
 * a `namespaces` array (of namespace URI strings, or namespace descriptor
 * objects) to the tree.  This helper reads that field defensively and also
 * recognizes a per-element `namespace` option as evidence of namespace use.
 *
 * @internal
 */
function hasDeclaredNamespaces(
  tree: PdfStructureTree | undefined,
): boolean {
  if (!tree) return false;

  const declared = (tree as unknown as { namespaces?: unknown }).namespaces;
  if (Array.isArray(declared) && declared.length > 0) {
    return true;
  }

  // Fallback: any element that opts into a namespace counts as a
  // namespace-aware structure tree.
  for (const elem of tree.getAllElements()) {
    const ns = (elem.options as { namespace?: unknown }).namespace;
    if (typeof ns === 'string' && ns.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Whether a PDF/UA-1 error code is already represented by a dedicated
 * UA-2 issue produced above (to avoid duplicate structure-tree / language
 * findings).
 *
 * @internal
 */
function isCoveredByUa2(ua1Code: string): boolean {
  // UA-STRUCT-001 / UA-STRUCT-002 — structure tree / MarkInfo
  //   (covered by UA2-STRUCT-001).
  // UA-META-001 / UA-META-002 / UA-META-003 — /Lang
  //   (covered by UA2-LANG-001).
  return (
    ua1Code === 'UA-STRUCT-001' ||
    ua1Code === 'UA-STRUCT-002' ||
    ua1Code === 'UA-META-001' ||
    ua1Code === 'UA-META-002' ||
    ua1Code === 'UA-META-003'
  );
}

/**
 * Map a PDF/UA-1 (ISO 14289-1) clause reference onto the corresponding
 * PDF/UA-2 (ISO 14289-2) clause.  The two standards share most clause
 * numbering; when a UA-1 clause is absent we fall back to the general
 * UA-2 conformance clause.
 *
 * @internal
 */
function mapUa1Clause(ua1Clause: string | undefined): string {
  if (ua1Clause === undefined || ua1Clause.length === 0) {
    return '5';
  }
  return ua1Clause;
}

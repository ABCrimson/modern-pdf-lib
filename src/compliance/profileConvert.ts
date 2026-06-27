/**
 * @module compliance/profileConvert
 *
 * PDF/A profile conversion and pre-save preflight reporting.
 *
 * Two capabilities are exposed:
 *
 * 1. {@link preflightPdfA} — a *pre-save* preflight that inspects an in-memory
 *    {@link PdfDocument} and reports {@link PreflightIssue}s describing why the
 *    document does not yet satisfy PDF/A. Each issue is classified as `fixable`
 *    when a downstream enforcement step (XMP injection, `/OutputIntent`,
 *    `/Lang`, document title) can resolve it automatically. The function never
 *    throws and returns `[]` for a document that already declares everything
 *    this pre-save check can verify.
 *
 * 2. {@link convertPdfAConformanceXmp} — a pure string transform that up- or
 *    down-grades the `pdfaid:part` (and optionally `pdfaid:conformance`) value
 *    inside an existing XMP packet, preserving everything else.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT — scope & limitations of {@link preflightPdfA}
 * ---------------------------------------------------------------------------
 * The canonical byte-level validator in this library, `validatePdfA`
 * (see `./pdfA.js`), operates on **serialized PDF bytes**. Serializing a
 * {@link PdfDocument} (`doc.save()`) is asynchronous, whereas this preflight is
 * a synchronous accessor-level check. It therefore deliberately does **not**
 * round-trip through `validatePdfA`; instead it inspects the document's public,
 * pre-save surface (`getTitle()`, `getLanguage()`, `getXmpMetadata()`,
 * `getPageCount()`) and reports the subset of PDF/A requirements that can be
 * verified before serialization. The issue `code`s are aligned with the
 * `PDFA-0xx` vocabulary used by `validatePdfA` so the two can be cross-read.
 *
 * What this preflight does NOT check (because it is unknowable pre-save or
 * requires deep content inspection): font embedding, transparency, encryption,
 * embedded-file restrictions, ToUnicode coverage, and structure-tree presence.
 * For a full conformance pass, serialize the document and run `validatePdfA`
 * (or `enforcePdfAFull`) on the resulting bytes.
 *
 * Reference: ISO 19005-1/2/3/4; PDF/A identification schema
 * (`http://www.aiim.org/pdfa/ns/id/`).
 */

import type { PdfDocument } from '../core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single preflight finding produced by {@link preflightPdfA}.
 *
 * `code` mirrors the `PDFA-0xx` vocabulary of the byte-level `validatePdfA`
 * validator. `fixable` indicates whether a downstream enforcement step can
 * resolve the issue automatically. `clause` is an optional ISO clause hint.
 */
export interface PreflightIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly fixable: boolean;
  readonly clause?: string | undefined;
}

// ---------------------------------------------------------------------------
// PDF/A identification namespace
// ---------------------------------------------------------------------------

/** Canonical PDF/A identification namespace URI (`pdfaid`). */
const PDFAID_NS = 'http://www.aiim.org/pdfa/ns/id/';

// ---------------------------------------------------------------------------
// preflightPdfA
// ---------------------------------------------------------------------------

/**
 * Run a synchronous, pre-save PDF/A preflight over an in-memory document.
 *
 * See the module documentation for the (intentional) scope and limitations of
 * this check relative to the byte-level `validatePdfA` validator.
 *
 * @param doc   - The in-memory document to inspect. Never mutated.
 * @param level - Optional target level (e.g. `'2b'`, `'3u'`, `'PDF/A-4'`).
 *                Only used to refine messages; all checks here are
 *                level-agnostic prerequisites common to every PDF/A part.
 * @returns A (possibly empty) list of preflight issues. Never throws.
 */
export function preflightPdfA(
  doc: PdfDocument,
  level?: string,
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const target = level !== undefined && level.length > 0 ? ` (${level})` : '';

  // --- XMP metadata with PDF/A identification ---------------------------
  // PDF/A mandates an XMP metadata stream carrying pdfaid:part. Pre-save we
  // can only see XMP the caller has explicitly attached.
  let xmp: string | undefined;
  try {
    xmp = doc.getXmpMetadata();
  } catch {
    xmp = undefined;
  }
  if (xmp === undefined || xmp.length === 0) {
    issues.push({
      code: 'PDFA-001',
      message: `XMP metadata stream is required but not set on the document${target}.`,
      severity: 'error',
      fixable: true,
      clause: 'ISO 19005 (XMP metadata)',
    });
  } else if (!xmp.includes('pdfaid:part')) {
    issues.push({
      code: 'PDFA-002',
      message:
        'XMP metadata does not declare PDF/A identification (pdfaid:part).',
      severity: 'error',
      fixable: true,
      clause: 'ISO 19005 (PDF/A identification schema)',
    });
  }

  // --- Output intent ----------------------------------------------------
  // A freshly built document has no /OutputIntents; PDF/A requires one for
  // device-dependent colour. The document API has no pre-save output-intent
  // accessor, so this is always reported for an in-memory document and is
  // fixable by attaching an sRGB (or CMYK) output intent before save.
  if (!documentHasOutputIntent(doc)) {
    issues.push({
      code: 'PDFA-012',
      message:
        'A PDF/A output intent (/OutputIntents) with an ICC destination ' +
        'profile is required (none detected on the in-memory document).',
      severity: 'error',
      fixable: true,
      clause: 'ISO 19005 (OutputIntents)',
    });
  }

  // --- Document language ------------------------------------------------
  let lang: string | undefined;
  try {
    lang = doc.getLanguage();
  } catch {
    lang = undefined;
  }
  if (lang === undefined || lang.length === 0) {
    issues.push({
      code: 'PDFA-011',
      message:
        'The document language (/Lang) is not set; PDF/A recommends a ' +
        'BCP 47 language tag.',
      severity: 'warning',
      fixable: true,
      clause: 'ISO 19005 (document language)',
    });
  }

  // --- Document title ---------------------------------------------------
  // A descriptive title is required by PDF/A's metadata/accessibility
  // expectations and is trivially fixable via setTitle().
  let title: string | undefined;
  try {
    title = doc.getTitle();
  } catch {
    title = undefined;
  }
  if (title === undefined || title.length === 0) {
    issues.push({
      code: 'PDFA-014',
      message: 'The document title is not set; PDF/A requires a dc:title.',
      severity: 'warning',
      fixable: true,
      clause: 'ISO 19005 (descriptive metadata)',
    });
  }

  // --- Pages present ----------------------------------------------------
  // Not a fixable metadata issue: a zero-page document cannot be made
  // conformant by adding metadata.
  let pageCount = 0;
  try {
    pageCount = doc.getPageCount();
  } catch {
    pageCount = 0;
  }
  if (pageCount === 0) {
    issues.push({
      code: 'PDFA-015',
      message: 'The document has no pages; a PDF/A file must contain at least one page.',
      severity: 'error',
      fixable: false,
      clause: 'ISO 32000 (page tree)',
    });
  }

  return issues;
}

/**
 * Best-effort, pre-save detection of an output intent on a document.
 *
 * The public {@link PdfDocument} surface exposes no output-intent accessor, so
 * this currently always returns `false` for an in-memory document. It is
 * factored out so a future output-intent API can be wired in without touching
 * the issue-mapping logic.
 */
function documentHasOutputIntent(_doc: PdfDocument): boolean {
  return false;
}

// ---------------------------------------------------------------------------
// convertPdfAConformanceXmp
// ---------------------------------------------------------------------------

/** Map a numeric part to its decimal string. */
function partString(part: 1 | 2 | 3 | 4): string {
  return String(part);
}

/** Map a conformance letter to the upper-case form stored in XMP. */
function conformanceString(conformance: 'a' | 'b' | 'u'): string {
  return conformance.toUpperCase();
}

/**
 * Remap the PDF/A identification (`pdfaid:part`, and optionally
 * `pdfaid:conformance`) inside an existing XMP packet.
 *
 * Both the **attribute** form (`pdfaid:part="3"`) and the **element** form
 * (`<pdfaid:part>3</pdfaid:part>`) are handled. When no `pdfaid:part` is
 * present, identification is injected into the first `rdf:Description` element
 * (declaring the `pdfaid` namespace on it if necessary). All other content of
 * the packet is preserved verbatim.
 *
 * This is a pure string transform; it does not parse or re-serialize the XML.
 *
 * @param xmp           - The source XMP packet string.
 * @param toPart        - Target PDF/A part (1, 2, 3 or 4).
 * @param toConformance - Optional target conformance level (`a`/`b`/`u`). When
 *                        omitted, any existing conformance is left untouched.
 * @returns The transformed XMP packet string.
 */
export function convertPdfAConformanceXmp(
  xmp: string,
  toPart: 1 | 2 | 3 | 4,
  toConformance?: 'a' | 'b' | 'u',
): string {
  const partVal = partString(toPart);
  let result = xmp;

  // --- pdfaid:part ------------------------------------------------------
  // Quote-agnostic: match either "..." or '...' via a capture-group
  // backreference, then normalize the emitted replacement to double quotes.
  const partAttr = /pdfaid:part\s*=\s*(["'])[^"']*\1/;
  const partElem = /<pdfaid:part>[^<]*<\/pdfaid:part>/;

  if (partAttr.test(result)) {
    result = result.replace(partAttr, `pdfaid:part="${partVal}"`);
  } else if (partElem.test(result)) {
    result = result.replace(partElem, `<pdfaid:part>${partVal}</pdfaid:part>`);
  } else {
    result = injectIdentification(result, partVal, toConformance);
    // injectIdentification handles conformance too; nothing more to do.
    return result;
  }

  // --- pdfaid:conformance (only when explicitly requested) --------------
  if (toConformance !== undefined) {
    const confVal = conformanceString(toConformance);
    // Quote-agnostic (see pdfaid:part above); replacement normalizes to "...".
    const confAttr = /pdfaid:conformance\s*=\s*(["'])[^"']*\1/;
    const confElem = /<pdfaid:conformance>[^<]*<\/pdfaid:conformance>/;

    if (confAttr.test(result)) {
      result = result.replace(confAttr, `pdfaid:conformance="${confVal}"`);
    } else if (confElem.test(result)) {
      result = result.replace(
        confElem,
        `<pdfaid:conformance>${confVal}</pdfaid:conformance>`,
      );
    } else {
      // No existing conformance — add it adjacent to the part we just set,
      // matching whichever form the part uses.
      result = addConformanceBesidePart(result, confVal);
    }
  }

  return result;
}

/**
 * Inject a fresh `pdfaid` identification block into the first `rdf:Description`
 * element. Used when the source packet has no `pdfaid:part` at all.
 */
function injectIdentification(
  xmp: string,
  partVal: string,
  toConformance: 'a' | 'b' | 'u' | undefined,
): string {
  const nsDecl = `xmlns:pdfaid="${PDFAID_NS}"`;
  const hasNs = xmp.includes(PDFAID_NS);

  // Build the element-form identification fragment.
  let frag = `<pdfaid:part>${partVal}</pdfaid:part>`;
  if (toConformance !== undefined) {
    frag += `<pdfaid:conformance>${conformanceString(toConformance)}</pdfaid:conformance>`;
  }

  // Prefer to inject into an existing rdf:Description.
  // Case 1: self-closing description, e.g. <rdf:Description .../>
  const selfClosing = /<rdf:Description\b([^>]*?)\/>/;
  const scMatch = selfClosing.exec(xmp);
  if (scMatch) {
    const attrs = scMatch[1] ?? '';
    const ns = hasNs ? '' : ` ${nsDecl}`;
    const replacement = `<rdf:Description${attrs}${ns}>${frag}</rdf:Description>`;
    return xmp.replace(selfClosing, replacement);
  }

  // Case 2: open/close description, e.g. <rdf:Description ...> ... </rdf:Description>
  const open = /<rdf:Description\b([^>]*)>/;
  const openMatch = open.exec(xmp);
  if (openMatch) {
    const attrs = openMatch[1] ?? '';
    const ns = hasNs ? '' : ` ${nsDecl}`;
    const replacement = `<rdf:Description${attrs}${ns}>${frag}`;
    return xmp.replace(open, replacement);
  }

  // No rdf:Description to anchor to — return unchanged rather than emit
  // malformed XMP (honest failure: nothing to inject into).
  return xmp;
}

/**
 * Add a `pdfaid:conformance` next to an already-present `pdfaid:part`,
 * mirroring the part's representation (attribute vs element form).
 */
function addConformanceBesidePart(xmp: string, confVal: string): string {
  // Element-form part: append a sibling element.
  const partElem = /(<pdfaid:part>[^<]*<\/pdfaid:part>)/;
  if (partElem.test(xmp)) {
    return xmp.replace(
      partElem,
      `$1<pdfaid:conformance>${confVal}</pdfaid:conformance>`,
    );
  }

  // Attribute-form part: append a sibling attribute. Quote-agnostic — the
  // outer group ($1) preserves the part verbatim (whatever quotes it used);
  // the inner backreference (\2) only ties the open/close quote together.
  const partAttr = /(pdfaid:part\s*=\s*(["'])[^"']*\2)/;
  if (partAttr.test(xmp)) {
    return xmp.replace(partAttr, `$1 pdfaid:conformance="${confVal}"`);
  }

  return xmp;
}

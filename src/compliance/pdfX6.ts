/**
 * @module compliance/pdfX6
 *
 * PDF/X-6 print-production conformance helpers (ISO 15930-9).
 *
 * PDF/X-6 is the print-production exchange standard built on PDF 2.0. It
 * mandates a registered output intent identifying the characterized printing
 * condition, declares its conformance through a `GTS_PDFXVersion` entry in the
 * document Info dictionary, and requires well-defined page geometry boxes
 * (a TrimBox or ArtBox nested within the MediaBox).
 *
 * This module provides additive, pure builders that produce the relevant PDF
 * objects and a geometry validator. It does not mutate any document state.
 *
 * Variants:
 * - `PDF/X-6`  — base variant (ICC-based output intent, mixed colour).
 * - `PDF/X-6p` — uses an externally-referenced print condition (named profile).
 * - `PDF/X-6n` — n-colorant / extended-gamut (DeviceN / spot) output intent.
 *
 * Reference: ISO 15930-9:2017 (PDF/X-6), PDF 2.0 (ISO 32000-2) §14.11.5
 * (Output intents) and §14.11.2 (Page boundaries).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
} from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The supported PDF/X-6 conformance variants. */
export type PdfX6Variant = 'PDF/X-6' | 'PDF/X-6p' | 'PDF/X-6n';

/** Options describing the PDF/X-6 output intent and conformance. */
export interface PdfX6Options {
  /** Conformance variant. Defaults to `'PDF/X-6'`. */
  readonly variant?: PdfX6Variant | undefined;
  /**
   * Output condition identifier — a registered name (e.g. a registry
   * reference such as `'FOGRA51'`) or `'Custom'` for an embedded profile.
   */
  readonly outputConditionIdentifier: string;
  /** Human-readable description of the intended printing condition. */
  readonly outputCondition?: string | undefined;
  /** Name of the registry the identifier belongs to (e.g. a URL). */
  readonly registryName?: string | undefined;
}

/** A rectangle expressed as `[llx, lly, urx, ury]` in default user space. */
export type PdfRect = readonly [number, number, number, number];

/** Page-geometry boxes relevant to PDF/X conformance. */
export interface BoxGeometry {
  /** The media box — the physical medium bounds. Required. */
  readonly mediaBox: PdfRect;
  /** The trim box — the intended finished page bounds. */
  readonly trimBox?: PdfRect | undefined;
  /** The bleed box — the region painted then trimmed away. */
  readonly bleedBox?: PdfRect | undefined;
}

// ---------------------------------------------------------------------------
// Output intent
// ---------------------------------------------------------------------------

/**
 * Build a PDF/X-6 output-intent dictionary.
 *
 * The returned dictionary uses the `/GTS_PDFX` output-intent subtype required
 * by all PDF/X families. The caller is responsible for attaching an embedded
 * ICC profile stream under `/DestOutputProfile` (for `PDF/X-6` / `PDF/X-6n`)
 * and adding the dictionary to the catalog `/OutputIntents` array.
 *
 * @param options - Output-intent identification.
 * @returns A freshly-built `/Type /OutputIntent` dictionary.
 */
export function buildPdfX6OutputIntent(options: PdfX6Options): PdfDict {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('/OutputIntent'));
  dict.set('/S', PdfName.of('/GTS_PDFX'));
  dict.set(
    '/OutputConditionIdentifier',
    PdfString.literal(options.outputConditionIdentifier),
  );
  if (options.outputCondition !== undefined) {
    dict.set('/OutputCondition', PdfString.literal(options.outputCondition));
  }
  if (options.registryName !== undefined) {
    dict.set('/RegistryName', PdfString.literal(options.registryName));
  }
  return dict;
}

/**
 * Return the `GTS_PDFXVersion` Info-dictionary value for a variant.
 *
 * @param variant - The conformance variant. Defaults to `'PDF/X-6'`.
 * @returns The string to store under the Info-dict `/GTS_PDFXVersion` key.
 */
export function buildGtsPdfxVersion(variant?: PdfX6Variant): string {
  return variant ?? 'PDF/X-6';
}

// ---------------------------------------------------------------------------
// Box geometry validation
// ---------------------------------------------------------------------------

/** Tolerance (in user-space units) used for box-containment comparisons. */
const BOX_EPSILON = 1e-6;

/** True when `rect` is a finite, positive-area rectangle. */
function isValidRect(rect: PdfRect): boolean {
  for (const v of rect) {
    if (!Number.isFinite(v)) return false;
  }
  const [llx, lly, urx, ury] = rect;
  return urx - llx > BOX_EPSILON && ury - lly > BOX_EPSILON;
}

/** True when `inner` is contained within `outer` (within tolerance). */
function isWithin(inner: PdfRect, outer: PdfRect): boolean {
  const [ilx, ily, iux, iuy] = inner;
  const [olx, oly, oux, ouy] = outer;
  return (
    ilx >= olx - BOX_EPSILON &&
    ily >= oly - BOX_EPSILON &&
    iux <= oux + BOX_EPSILON &&
    iuy <= ouy + BOX_EPSILON
  );
}

/**
 * Validate page-geometry boxes against PDF/X-6 requirements.
 *
 * Rules enforced (ISO 15930-9, PDF 2.0 §14.11.2):
 * - A valid MediaBox with positive area is required.
 * - A TrimBox (or ArtBox; this helper models the TrimBox path) is required.
 * - The TrimBox must lie within the MediaBox.
 * - If present, the BleedBox must lie within the MediaBox, and the TrimBox
 *   must lie within the BleedBox.
 *
 * @param box - The geometry to validate.
 * @returns An array of human-readable error messages; empty when valid.
 */
export function validateBoxGeometry(box: BoxGeometry): string[] {
  const errors: string[] = [];

  if (!isValidRect(box.mediaBox)) {
    errors.push('MediaBox is required and must be a positive-area rectangle.');
    // Without a usable MediaBox, containment checks are meaningless.
    return errors;
  }

  if (box.trimBox === undefined) {
    errors.push('TrimBox is required for PDF/X-6 conformance.');
  } else if (!isValidRect(box.trimBox)) {
    errors.push('TrimBox must be a positive-area rectangle.');
  } else if (!isWithin(box.trimBox, box.mediaBox)) {
    errors.push('TrimBox must be within the MediaBox.');
  }

  if (box.bleedBox !== undefined) {
    if (!isValidRect(box.bleedBox)) {
      errors.push('BleedBox must be a positive-area rectangle.');
    } else {
      if (!isWithin(box.bleedBox, box.mediaBox)) {
        errors.push('BleedBox must be within the MediaBox.');
      }
      if (
        box.trimBox !== undefined &&
        isValidRect(box.trimBox) &&
        !isWithin(box.trimBox, box.bleedBox)
      ) {
        errors.push('TrimBox must be within the BleedBox.');
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Box-dictionary helper
// ---------------------------------------------------------------------------

/**
 * Build the page-box entries (`/MediaBox`, `/TrimBox`, `/BleedBox`) as a
 * dictionary fragment that can be merged into a page dictionary.
 *
 * @param box - The geometry to encode.
 * @returns A dictionary holding the box arrays.
 */
export function buildBoxDict(box: BoxGeometry): PdfDict {
  const dict = new PdfDict();
  dict.set('/MediaBox', rectToArray(box.mediaBox));
  if (box.trimBox !== undefined) {
    dict.set('/TrimBox', rectToArray(box.trimBox));
  }
  if (box.bleedBox !== undefined) {
    dict.set('/BleedBox', rectToArray(box.bleedBox));
  }
  return dict;
}

/** Convert a rectangle to a PDF array of four numbers. */
function rectToArray(rect: PdfRect): PdfArray {
  const arr = new PdfArray();
  for (const v of rect) {
    arr.push(PdfNumber.of(v));
  }
  return arr;
}

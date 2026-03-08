/**
 * @module core/pageLabels
 *
 * Page label management for PDF documents.
 *
 * Page labels control how page numbers are displayed in the PDF viewer's
 * navigation controls and thumbnail panel.  They allow Roman numerals for
 * front matter, prefixed numbering for appendices, and more.
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { setPageLabels, getPageLabels, removePageLabels } from 'modern-pdf-lib';
 *
 * const doc = createPdf();
 * // Pages 0-3 use lowercase Roman numerals (i, ii, iii, iv)
 * // Pages 4+ use decimal starting at 1
 * setPageLabels(doc, [
 *   { startPage: 0, style: 'roman' },
 *   { startPage: 4, style: 'decimal', start: 1 },
 * ]);
 * ```
 *
 * Reference: PDF 1.7 spec, §12.4.2 (Page Labels).
 */

import type { PdfDocument } from './pdfDocument.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Numbering style for page labels.
 *
 * | Value      | PDF /S | Description                  | Example        |
 * |------------|--------|------------------------------|----------------|
 * | `decimal`  | `/D`   | Arabic numerals              | 1, 2, 3, …     |
 * | `roman`    | `/r`   | Lowercase Roman numerals     | i, ii, iii, …   |
 * | `Roman`    | `/R`   | Uppercase Roman numerals     | I, II, III, …   |
 * | `alpha`    | `/a`   | Lowercase alphabetic         | a, b, c, …      |
 * | `Alpha`    | `/A`   | Uppercase alphabetic         | A, B, C, …      |
 */
export type PageLabelStyle = 'decimal' | 'roman' | 'Roman' | 'alpha' | 'Alpha';

/**
 * Defines a contiguous range of pages that share a labelling scheme.
 *
 * Each range starts at `startPage` (zero-based page index) and extends
 * to the next range's `startPage` (or the end of the document).
 */
export interface PageLabelRange {
  /**
   * Zero-based index of the first page this label range applies to.
   */
  startPage: number;

  /**
   * The numbering style for this range.
   */
  style: PageLabelStyle;

  /**
   * An optional prefix string prepended to each page label.
   * For example, `"A-"` produces labels like "A-1", "A-2", etc.
   */
  prefix?: string | undefined;

  /**
   * The numeric value of the first page label in this range.
   * Defaults to `1`.
   *
   * For example, `{ startPage: 4, style: 'decimal', start: 5 }` means
   * page index 4 is labelled "5", page index 5 is labelled "6", etc.
   */
  start?: number | undefined;
}

// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------

/** Map from user-facing style names to PDF /S name values. */
const styleToPdfName: Record<PageLabelStyle, string> = {
  decimal: 'D',
  roman: 'r',
  Roman: 'R',
  alpha: 'a',
  Alpha: 'A',
};

/** Reverse mapping from PDF /S name values to user-facing style names. */
const pdfNameToStyle: Record<string, PageLabelStyle> = {
  D: 'decimal',
  r: 'roman',
  R: 'Roman',
  a: 'alpha',
  A: 'Alpha',
};

// ---------------------------------------------------------------------------
// Internal storage key
// ---------------------------------------------------------------------------

/**
 * Symbol used to store page labels on the PdfDocument instance.
 * This avoids modifying the PdfDocument class while keeping state
 * associated with the document.
 */
const PAGE_LABELS_KEY = Symbol.for('modern-pdf-lib:pageLabels');

/**
 * Augment PdfDocument to carry page label state.
 * @internal
 */
interface PageLabelStore {
  [PAGE_LABELS_KEY]?: PageLabelRange[] | undefined;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Set the page label ranges for the document.
 *
 * Each entry in the `labels` array defines a contiguous range of pages
 * that share a numbering style.  Ranges must be sorted by `startPage`
 * in ascending order.
 *
 * @param doc     The document to set page labels on.
 * @param labels  An array of label range definitions.
 * @throws        If `labels` is empty or ranges are not sorted.
 */
export function setPageLabels(
  doc: PdfDocument,
  labels: readonly PageLabelRange[],
): void {
  if (labels.length === 0) {
    throw new Error('Page labels array must not be empty');
  }

  // Validate sorting
  for (let i = 1; i < labels.length; i++) {
    if (labels[i]!.startPage <= labels[i - 1]!.startPage) {
      throw new Error(
        `Page label ranges must be sorted by startPage in ascending order. ` +
        `Got startPage ${labels[i]!.startPage} after ${labels[i - 1]!.startPage}.`,
      );
    }
  }

  // Store a defensive copy
  const store = doc as unknown as PageLabelStore;
  store[PAGE_LABELS_KEY] = labels.map((r) => ({ ...r }));
}

/**
 * Get the current page label ranges for the document.
 *
 * Returns `undefined` if no page labels have been set.
 *
 * @param doc  The document to read page labels from.
 * @returns    The page label ranges, or `undefined`.
 */
export function getPageLabels(
  doc: PdfDocument,
): readonly PageLabelRange[] | undefined {
  const store = doc as unknown as PageLabelStore;
  const labels = store[PAGE_LABELS_KEY];
  if (labels === undefined) return undefined;
  // Return defensive copies
  return labels.map((r) => ({ ...r }));
}

/**
 * Remove all page labels from the document.
 *
 * @param doc  The document to clear page labels from.
 */
export function removePageLabels(doc: PdfDocument): void {
  const store = doc as unknown as PageLabelStore;
  store[PAGE_LABELS_KEY] = undefined;
}

// ---------------------------------------------------------------------------
// Catalog integration
// ---------------------------------------------------------------------------

/**
 * Build the `/PageLabels` number tree dictionary for inclusion in the
 * document catalog.
 *
 * This is called during document serialization (by the save pipeline)
 * to produce the PDF objects that represent the page label scheme.
 *
 * The number tree format (PDF 1.7 §7.9.7) uses a `/Nums` array of
 * alternating page-index / label-dict pairs:
 *
 * ```
 * /PageLabels << /Nums [
 *   0 << /S /r >>
 *   4 << /S /D /St 1 >>
 * ] >>
 * ```
 *
 * @param doc  The document to read page label state from.
 * @returns    The number tree entries as `[pageIndex, labelDict]` pairs,
 *             or `undefined` if no labels are set.
 *
 * @internal
 */
export function getPageLabelEntries(
  doc: PdfDocument,
): readonly PageLabelRange[] | undefined {
  const store = doc as unknown as PageLabelStore;
  return store[PAGE_LABELS_KEY];
}

/**
 * Map a {@link PageLabelStyle} to its PDF `/S` name value.
 *
 * @param style  The user-facing style name.
 * @returns      The PDF name value (without the leading `/`).
 *
 * @internal
 */
export function styleToPdf(style: PageLabelStyle): string {
  return styleToPdfName[style];
}

/**
 * Map a PDF `/S` name value back to a {@link PageLabelStyle}.
 *
 * @param name  The PDF name value (without the leading `/`).
 * @returns     The user-facing style name, or `undefined` if unknown.
 *
 * @internal
 */
export function pdfToStyle(name: string): PageLabelStyle | undefined {
  return pdfNameToStyle[name];
}

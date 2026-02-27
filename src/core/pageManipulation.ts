/**
 * @module core/pageManipulation
 *
 * Page manipulation operations for PdfDocument — insert, remove, move,
 * rotate, and crop pages.
 *
 * These functions operate on the internal pages array and object registry
 * of a PdfDocument via the `@internal` accessors exposed by the document.
 *
 * @packageDocumentation
 */

import type { PageSize } from './pdfPage.js';
import { PdfPage, PageSizes } from './pdfPage.js';
import type { PdfDocument } from './pdfDocument.js';
import {
  PdfArray,
  PdfName,
  PdfNumber,
} from './pdfObjects.js';
import type { PdfObjectRegistry } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Size resolution helper
// ---------------------------------------------------------------------------

/**
 * Resolve a PageSize input to a `[width, height]` tuple.
 *
 * @param size  Page size as a tuple, object, or undefined (defaults to A4).
 * @returns     A `[width, height]` tuple in PDF points.
 */
function resolveSize(size: PageSize | undefined): [number, number] {
  const resolved = size ?? PageSizes.A4;
  if (Array.isArray(resolved)) {
    return [resolved[0], resolved[1]];
  }
  return [
    (resolved as { readonly width: number; readonly height: number }).width,
    (resolved as { readonly width: number; readonly height: number }).height,
  ];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a page index is within bounds.
 *
 * @param index      The index to validate.
 * @param pageCount  The total number of pages.
 * @param operation  A description of the operation for error messages.
 * @throws RangeError if the index is out of bounds.
 */
function validateIndex(
  index: number,
  pageCount: number,
  operation: string,
): void {
  if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
    throw new RangeError(
      `${operation}: index ${index} out of range [0, ${pageCount - 1}]`,
    );
  }
}

/**
 * Validate that a page index is valid for insertion (0 to pageCount inclusive).
 *
 * @param index      The index to validate.
 * @param pageCount  The total number of pages.
 * @param operation  A description of the operation for error messages.
 * @throws RangeError if the index is out of bounds.
 */
function validateInsertIndex(
  index: number,
  pageCount: number,
  operation: string,
): void {
  if (!Number.isInteger(index) || index < 0 || index > pageCount) {
    throw new RangeError(
      `${operation}: index ${index} out of range [0, ${pageCount}]`,
    );
  }
}

/**
 * Validate that a rotation angle is a multiple of 90.
 *
 * @param angle  The rotation angle in degrees.
 * @throws Error if the angle is not a valid rotation.
 */
function validateRotation(angle: number): void {
  if (angle % 90 !== 0) {
    throw new Error(
      `rotatePage: angle must be a multiple of 90, got ${angle}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Crop box type
// ---------------------------------------------------------------------------

/**
 * A rectangular crop box defined by its coordinates.
 *
 * All values are in PDF points (1/72 of an inch).
 */
export interface CropBox {
  /** Lower-left x coordinate. */
  readonly x: number;
  /** Lower-left y coordinate. */
  readonly y: number;
  /** Width of the crop box. */
  readonly width: number;
  /** Height of the crop box. */
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Page manipulation functions
// ---------------------------------------------------------------------------

/**
 * Insert a new blank page into the document at the specified position.
 *
 * All existing pages at `index` and beyond are shifted to make room.
 *
 * @param doc    The PdfDocument to modify.
 * @param index  Zero-based position at which to insert the page.
 *               Must be in the range `[0, pageCount]`.
 * @param size   Optional page size. Defaults to A4.
 * @returns      The newly created PdfPage.
 *
 * @example
 * ```ts
 * import { createPdf, insertPage, PageSizes } from 'modern-pdf';
 *
 * const doc = createPdf();
 * doc.addPage();
 * const newPage = insertPage(doc, 0, PageSizes.Letter); // insert at front
 * ```
 */
export function insertPage(
  doc: PdfDocument,
  index: number,
  size?: PageSize,
): PdfPage {
  const pages = doc.getInternalPages();
  const registry = doc.getRegistry();

  validateInsertIndex(index, pages.length, 'insertPage');

  const [w, h] = resolveSize(size);
  const page = new PdfPage(w, h, registry);

  // Register existing fonts on the new page
  doc.registerFontsOnPage(page);

  // Insert at position
  pages.splice(index, 0, page);

  return page;
}

/**
 * Remove a page from the document by its zero-based index.
 *
 * @param doc    The PdfDocument to modify.
 * @param index  Zero-based index of the page to remove.
 * @throws       RangeError if the index is out of bounds.
 *
 * @example
 * ```ts
 * removePage(doc, 0); // Remove the first page
 * ```
 */
export function removePage(doc: PdfDocument, index: number): void {
  const pages = doc.getInternalPages();
  validateIndex(index, pages.length, 'removePage');
  pages.splice(index, 1);
}

/**
 * Move a page from one position to another within the document.
 *
 * The page at `fromIndex` is removed and then inserted at `toIndex`
 * (computed after the removal).
 *
 * @param doc        The PdfDocument to modify.
 * @param fromIndex  Current zero-based index of the page to move.
 * @param toIndex    Target zero-based index. Must be in range
 *                   `[0, pageCount - 1]` after removal.
 * @throws           RangeError if either index is out of bounds.
 *
 * @example
 * ```ts
 * movePage(doc, 2, 0); // Move page 2 to the front
 * ```
 */
export function movePage(
  doc: PdfDocument,
  fromIndex: number,
  toIndex: number,
): void {
  const pages = doc.getInternalPages();
  validateIndex(fromIndex, pages.length, 'movePage (fromIndex)');

  // Remove the page
  const [page] = pages.splice(fromIndex, 1);

  // Validate target index after removal
  if (toIndex < 0 || toIndex > pages.length) {
    // Re-insert the page to restore state before throwing
    pages.splice(fromIndex, 0, page!);
    throw new RangeError(
      `movePage (toIndex): index ${toIndex} out of range [0, ${pages.length}]`,
    );
  }

  // Insert at new position
  pages.splice(toIndex, 0, page!);
}

/**
 * Rotate a page by the specified angle.
 *
 * The angle is cumulative with any existing rotation set on the page.
 * The page's `/Rotate` entry in the page dictionary will be set when
 * the document is saved.
 *
 * @param doc    The PdfDocument to modify.
 * @param index  Zero-based index of the page to rotate.
 * @param angle  Rotation angle in degrees. Must be a multiple of 90.
 *               Common values: 90, 180, 270, -90.
 * @throws       RangeError if the index is out of bounds.
 * @throws       Error if the angle is not a multiple of 90.
 *
 * @example
 * ```ts
 * rotatePage(doc, 0, 90); // Rotate first page 90 degrees clockwise
 * ```
 */
export function rotatePage(
  doc: PdfDocument,
  index: number,
  angle: number,
): void {
  const pages = doc.getInternalPages();
  validateIndex(index, pages.length, 'rotatePage');
  validateRotation(angle);

  const page = pages[index]!;

  // Normalize the angle to 0, 90, 180, 270
  const currentRotation = page.getRotation?.() ?? 0;
  const newRotation = ((currentRotation + angle) % 360 + 360) % 360;

  page.setRotation(newRotation);
}

/**
 * Set a crop box on a page.
 *
 * The crop box defines the visible region of the page when displayed
 * or printed. It defaults to the media box if not set.
 *
 * @param doc      The PdfDocument to modify.
 * @param index    Zero-based index of the page.
 * @param cropBox  The crop box rectangle.
 * @throws         RangeError if the index is out of bounds.
 *
 * @example
 * ```ts
 * cropPage(doc, 0, { x: 50, y: 50, width: 495, height: 742 });
 * ```
 */
export function cropPage(
  doc: PdfDocument,
  index: number,
  cropBox: CropBox,
): void {
  const pages = doc.getInternalPages();
  validateIndex(index, pages.length, 'cropPage');

  const page = pages[index]!;
  page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
}

// ---------------------------------------------------------------------------
// Page size helpers
// ---------------------------------------------------------------------------

/**
 * Get the size of a page.
 *
 * @param doc    The PdfDocument.
 * @param index  Zero-based page index.
 * @returns      A `{ width, height }` object in PDF points.
 */
export function getPageSize(
  doc: PdfDocument,
  index: number,
): { width: number; height: number } {
  const pages = doc.getInternalPages();
  validateIndex(index, pages.length, 'getPageSize');
  const page = pages[index]!;
  return { width: page.width, height: page.height };
}

/**
 * Resize a page by setting its media box.
 *
 * Note: This changes the page dimensions but does not scale existing
 * content. Content that was drawn at coordinates beyond the new
 * dimensions may be clipped.
 *
 * @param doc    The PdfDocument to modify.
 * @param index  Zero-based page index.
 * @param size   New page size.
 */
export function resizePage(
  doc: PdfDocument,
  index: number,
  size: PageSize,
): void {
  const pages = doc.getInternalPages();
  validateIndex(index, pages.length, 'resizePage');

  const [w, h] = resolveSize(size);
  const page = pages[index]!;
  page.setMediaBox(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/**
 * Reverse the page order of the entire document.
 *
 * @param doc  The PdfDocument to modify.
 */
export function reversePages(doc: PdfDocument): void {
  const pages = doc.getInternalPages();
  pages.reverse();
}

/**
 * Remove multiple pages at once, given their zero-based indices.
 *
 * Indices are processed in descending order to avoid shifting issues.
 *
 * @param doc      The PdfDocument to modify.
 * @param indices  Array of zero-based page indices to remove.
 * @throws         RangeError if any index is out of bounds.
 */
export function removePages(doc: PdfDocument, indices: number[]): void {
  const pages = doc.getInternalPages();

  // Validate all indices first
  for (const index of indices) {
    validateIndex(index, pages.length, 'removePages');
  }

  // Deduplicate and sort descending to avoid index shifting during removal
  const sorted = new Set(indices).values().toArray().sort((a, b) => b - a);
  for (const index of sorted) {
    pages.splice(index, 1);
  }
}

/**
 * Rotate all pages in the document by the specified angle.
 *
 * @param doc    The PdfDocument to modify.
 * @param angle  Rotation angle in degrees (must be a multiple of 90).
 */
export function rotateAllPages(doc: PdfDocument, angle: number): void {
  validateRotation(angle);
  const pages = doc.getInternalPages();
  for (const page of pages) {
    const current = page.getRotation?.() ?? 0;
    const newRotation = ((current + angle) % 360 + 360) % 360;
    page.setRotation(newRotation);
  }
}

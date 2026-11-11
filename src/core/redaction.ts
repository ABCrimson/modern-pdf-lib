/**
 * @module core/redaction
 *
 * Content redaction marks for PDF documents.
 *
 * Marking records the regions on a page: {@link markForRedaction} stores a
 * mark and {@link getRedactionMarks} reads the marks back.  Applying the marks
 * is not available in this release: {@link applyRedactions} throws
 * {@link RedactionIncompleteError} with reason `'redaction-unavailable'` and
 * changes nothing, so the marks and the page content stay as they were.  A
 * later release adds redaction by removal.
 *
 * Reference: PDF 1.7 spec, §12.5.6.23 (Redact Annotations).
 */

import { RedactionIncompleteError } from '../errors.js';
import type { PdfDocument } from './pdfDocument.js';
import type { PdfPage } from './pdfPage.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Horizontal alignment for overlay text. */
export type OverlayAlignment = 'left' | 'center' | 'right';

/** Options for marking a region for redaction. */
export interface RedactionOptions {
  /** The rectangle to redact: [x, y, width, height]. */
  rect: [number, number, number, number];
  /** Optional text to overlay on the redacted area. */
  overlayText?: string | undefined;
  /** Colour for the redaction rectangle (default: black). */
  color?: { r: number; g: number; b: number } | undefined;
  /** Custom font name for overlay text (default: 'Helvetica'). */
  overlayFont?: string | undefined;
  /** Custom font size for overlay text, stored with the mark (no overlay is drawn in this release). */
  overlayFontSize?: number | undefined;
  /** Horizontal alignment for overlay text (default: 'left'). */
  overlayAlignment?: OverlayAlignment | undefined;
  /** Border width for the redaction rectangle outline (default: 0 — no border). */
  borderWidth?: number | undefined;
  /** Border colour (default: same as fill colour). */
  borderColor?: { r: number; g: number; b: number } | undefined;
  /** Opacity for the redaction overlay, 0–1 (default: 1 — fully opaque), stored with the mark. */
  opacity?: number | undefined;
}

/** Redaction mark stored on a page. */
export interface RedactionMark {
  rect: [number, number, number, number];
  overlayText?: string | undefined;
  color: { r: number; g: number; b: number };
  overlayFont: string;
  overlayFontSize?: number | undefined;
  overlayAlignment: OverlayAlignment;
  borderWidth: number;
  borderColor: { r: number; g: number; b: number };
  opacity: number;
}

// ---------------------------------------------------------------------------
// Storage — use a WeakMap keyed by PdfPage to store redaction marks
// ---------------------------------------------------------------------------

const pageRedactions = new WeakMap<PdfPage, RedactionMark[]>();

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Mark a rectangular region on a page for redaction.
 *
 * The mark is recorded and nothing else changes: the page content is
 * untouched.  {@link applyRedactions} does not apply marks in this release.
 *
 * @param page     The page to mark.
 * @param options  The redaction options.
 */
export function markForRedaction(page: PdfPage, options: RedactionOptions): void {
  const marks = pageRedactions.get(page) ?? [];
  const fillColor = options.color ?? { r: 0, g: 0, b: 0 };
  marks.push({
    rect: options.rect,
    overlayText: options.overlayText,
    color: fillColor,
    overlayFont: options.overlayFont ?? 'Helvetica',
    overlayFontSize: options.overlayFontSize,
    overlayAlignment: options.overlayAlignment ?? 'left',
    borderWidth: options.borderWidth ?? 0,
    borderColor: options.borderColor ?? fillColor,
    opacity: options.opacity ?? 1,
  });
  pageRedactions.set(page, marks);
}

/**
 * Apply all pending redactions across all pages in a document.  Not available
 * in this release: the call always throws.
 *
 * Nothing is drawn, removed or cleared, so the marks and the page content stay
 * as they were.
 *
 * @param _doc  The PDF document (left unchanged).
 * @throws {RedactionIncompleteError} Always, with reason
 *   `'redaction-unavailable'` and `pageIndex` `undefined`.
 */
export function applyRedactions(_doc: PdfDocument): void {
  throw new RedactionIncompleteError('redaction-unavailable');
}

/**
 * Get the pending redaction marks for a page.
 *
 * @param page  The page to query.
 * @returns     An array of redaction marks, or an empty array.
 */
export function getRedactionMarks(page: PdfPage): readonly RedactionMark[] {
  return pageRedactions.get(page) ?? [];
}

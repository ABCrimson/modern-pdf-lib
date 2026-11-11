/**
 * @module annotation/applyRedactions
 *
 * Applying pending redaction annotations (/Redact) is not available in this
 * release.
 *
 * Two entry points, both of which throw
 * {@link RedactionIncompleteError} with reason `'redaction-unavailable'` as
 * their first statement:
 * - `applyRedactions(doc)` — would apply ALL /Redact annotations across
 *   every page.
 * - `applyRedaction(doc, pageIndex, annotIndex)` — would apply a single
 *   /Redact annotation.
 *
 * Nothing is drawn, removed or cleared: the /Redact annotations and the page
 * content stay exactly as they were.  A later release adds redaction by
 * removal.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.23 (Redaction Annotations).
 */

import { RedactionIncompleteError } from '../errors.js';
import type { PdfDocument } from '../core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape of a successful redaction result; this release never returns one. */
export interface RedactionResult {
  /** Total number of redaction annotations that were applied. */
  appliedCount: number;
  /** Zero-based indices of pages that had redactions applied. */
  pages: number[];
}

/** Horizontal alignment for overlay text. */
export type OverlayAlignment = 'left' | 'center' | 'right';

/** Extended options describing a redaction overlay. */
export interface RedactionOperatorOptions {
  /** Font name for overlay text (default: 'Helvetica'). */
  overlayFont?: string | undefined;
  /** Font size for overlay text (no overlay is drawn in this release). */
  overlayFontSize?: number | undefined;
  /** Horizontal alignment for overlay text (default: 'left'). */
  overlayAlignment?: OverlayAlignment | undefined;
  /** Border width for the redaction rectangle outline (default: 0). */
  borderWidth?: number | undefined;
  /** Border colour (default: same as fill colour). */
  borderColor?: { r: number; g: number; b: number } | undefined;
  /** Opacity for the redaction overlay, 0–1 (default: 1). */
  opacity?: number | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply ALL redaction annotations across every page in the document.  Not
 * available in this release: the call always throws.
 *
 * Nothing is drawn, removed or cleared, so every /Redact annotation and the
 * page content stay as they were.
 *
 * @param _doc  The PDF document (left unchanged).
 * @throws {RedactionIncompleteError} Always, with reason
 *   `'redaction-unavailable'` and `pageIndex` `undefined`.
 */
export function applyRedactions(_doc: PdfDocument): RedactionResult {
  throw new RedactionIncompleteError('redaction-unavailable');
}

/**
 * Apply a single redaction annotation identified by page and annotation
 * index.  Not available in this release: the call always throws, before it
 * checks either index.
 *
 * Nothing is drawn, removed or cleared, so the annotation and the page
 * content stay as they were.
 *
 * @param _doc         The PDF document (left unchanged).
 * @param _pageIndex   Zero-based page index.
 * @param _annotIndex  Zero-based annotation index within the page.
 * @throws {RedactionIncompleteError} Always, with reason
 *   `'redaction-unavailable'` and `pageIndex` `undefined`.
 */
export function applyRedaction(
  _doc: PdfDocument,
  _pageIndex: number,
  _annotIndex: number,
): RedactionResult {
  throw new RedactionIncompleteError('redaction-unavailable');
}

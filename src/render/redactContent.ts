/**
 * @module render/redactContent
 *
 * Redaction by removal is not available in this release.
 *
 * {@link redactRegions} throws {@link RedactionIncompleteError} with reason
 * `'redaction-unavailable'` as its first statement.  It draws nothing,
 * removes nothing and clears nothing: the page content stays exactly as it
 * was.  A later release adds redaction by removal.
 *
 * The {@link RedactRect} and {@link RedactResult} types stay exported so code
 * that names them keeps compiling.
 *
 * @packageDocumentation
 */

import { RedactionIncompleteError } from '../errors.js';
import type { PdfPage } from '../core/pdfPage.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A rectangular region to redact, in page space (PDF points, y-up, lower-left origin). */
export interface RedactRect {
  /** X coordinate of the lower-left corner. */
  x: number;
  /** Y coordinate of the lower-left corner. */
  y: number;
  /** Width of the region (must be > 0 to match anything). */
  width: number;
  /** Height of the region (must be > 0 to match anything). */
  height: number;
}

/** The shape of a successful {@link redactRegions} result; this release never returns one. */
export interface RedactResult {
  /** Number of text-showing operators removed. */
  removedText: number;
  /** Number of image (`Do`) placements removed. */
  removedImages: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Redact regions of a page by removing the content under them.  Not available
 * in this release: the call always throws.
 *
 * Nothing is drawn, removed or cleared, so the page content is unchanged.
 *
 * @param _page   The page that would be redacted (left unchanged).
 * @param _rects  Redaction regions in page space (PDF points, y-up).
 * @throws {RedactionIncompleteError} Always, with reason
 *   `'redaction-unavailable'` and `pageIndex` `undefined`.
 */
export function redactRegions(_page: PdfPage, _rects: RedactRect[]): RedactResult {
  throw new RedactionIncompleteError('redaction-unavailable');
}

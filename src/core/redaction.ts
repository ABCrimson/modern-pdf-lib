/**
 * @module core/redaction
 *
 * Content redaction for PDF documents.
 *
 * Redaction is a two-step process:
 * 1. **Mark** areas for redaction — this records the regions but does
 *    not remove content yet.
 * 2. **Apply** redactions — this draws opaque rectangles over the
 *    marked areas and (in a full implementation) removes the
 *    underlying content stream operators.
 *
 * Note: This implementation draws redaction rectangles but does not
 * remove the actual content-stream operators underneath. For secure
 * redaction, the content stream should be parsed and modified to
 * remove text/graphics within the redacted regions.  This is a visual
 * redaction that covers content for viewing/printing purposes.
 *
 * Reference: PDF 1.7 spec, §12.5.6.23 (Redact Annotations).
 */

import type { PdfDocument } from './pdfDocument.js';
import type { PdfPage } from './pdfPage.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for marking a region for redaction. */
export interface RedactionOptions {
  /** The rectangle to redact: [x, y, width, height]. */
  rect: [number, number, number, number];
  /** Optional text to overlay on the redacted area. */
  overlayText?: string | undefined;
  /** Colour for the redaction rectangle (default: black). */
  color?: { r: number; g: number; b: number } | undefined;
}

/** Internal redaction mark stored on a page. */
interface RedactionMark {
  rect: [number, number, number, number];
  overlayText?: string | undefined;
  color: { r: number; g: number; b: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
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
 * This does not immediately modify the page.  Call
 * {@link applyRedactions} to draw the redaction rectangles.
 *
 * @param page     The page to mark.
 * @param options  The redaction options.
 */
export function markForRedaction(
  page: PdfPage,
  options: RedactionOptions,
): void {
  const marks = pageRedactions.get(page) ?? [];
  marks.push({
    rect: options.rect,
    overlayText: options.overlayText,
    color: options.color ?? { r: 0, g: 0, b: 0 },
  });
  pageRedactions.set(page, marks);
}

/**
 * Apply all pending redactions across all pages in a document.
 *
 * For each redaction mark, this draws an opaque filled rectangle
 * over the marked region.  If overlay text is specified, it is
 * drawn on top of the rectangle in a contrasting colour.
 *
 * @param doc  The PDF document.
 */
export function applyRedactions(doc: PdfDocument): void {
  const pages = doc.getPages();

  for (const page of pages) {
    const marks = pageRedactions.get(page);
    if (!marks || marks.length === 0) continue;

    let ops = '';

    for (const mark of marks) {
      const [x, y, w, h] = mark.rect;
      const { r, g, b } = mark.color;

      // Draw filled rectangle
      ops += 'q\n';
      ops += `${n(r)} ${n(g)} ${n(b)} rg\n`;
      ops += `${n(x)} ${n(y)} ${n(w)} ${n(h)} re\n`;
      ops += 'f\n';

      // Draw overlay text if provided
      if (mark.overlayText) {
        // Use a contrasting colour (white if dark background, black if light)
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        const textR = brightness > 0.5 ? 0 : 1;
        const textG = brightness > 0.5 ? 0 : 1;
        const textB = brightness > 0.5 ? 0 : 1;

        const fontSize = Math.min(h * 0.6, 10);
        const textX = x + 2;
        const textY = y + h / 2 - fontSize / 3;

        ops += `${n(textR)} ${n(textG)} ${n(textB)} rg\n`;
        ops += 'BT\n';
        ops += `/Helvetica ${n(fontSize)} Tf\n`;
        ops += `${n(textX)} ${n(textY)} Td\n`;

        const escaped = mark.overlayText
          .replace(/\\/g, '\\\\')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)');

        ops += `(${escaped}) Tj\n`;
        ops += 'ET\n';
      }

      ops += 'Q\n';
    }

    page.pushOperators(ops);

    // Clear applied marks
    pageRedactions.delete(page);
  }
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

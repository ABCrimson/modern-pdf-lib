/**
 * @module annotation/applyRedactions
 *
 * Applies pending redaction annotations (/Redact) on a PDF document.
 *
 * Two entry points:
 * - `applyRedactions(doc)` — apply ALL /Redact annotations across
 *   every page. Returns a {@link RedactionResult} summary.
 * - `applyRedaction(doc, pageIndex, annotIndex)` — apply a single
 *   redaction annotation on the specified page.
 *
 * When a redaction is applied the following happens:
 * 1. The rectangular area in the content stream is clipped out by
 *    drawing an opaque rectangle in the interior colour (default black).
 * 2. If overlay text is specified it is rendered on top.
 * 3. The redaction annotation itself is removed from the page.
 *
 * Reference: PDF 1.7 spec, Section 12.5.6.23 (Redaction Annotations).
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import type { PdfPage } from '../core/pdfPage.js';
import type { PdfAnnotation } from './pdfAnnotation.js';
import type { PdfRedactAnnotation } from './types/redactAnnotation.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** Result of applying redactions to a document. */
export interface RedactionResult {
  /** Total number of redaction annotations that were applied. */
  appliedCount: number;
  /** Zero-based indices of pages that had redactions applied. */
  pages: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number for PDF operator output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Check whether an annotation is a /Redact subtype.
 */
function isRedactAnnotation(annot: PdfAnnotation): annot is PdfRedactAnnotation {
  return annot.getType() === 'Redact';
}

/** Horizontal alignment for overlay text. */
export type OverlayAlignment = 'left' | 'center' | 'right';

/** Extended options for building redaction operators. */
export interface RedactionOperatorOptions {
  /** Font name for overlay text (default: 'Helvetica'). */
  overlayFont?: string | undefined;
  /** Font size for overlay text. When omitted, auto-calculated from rect height. */
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

/**
 * Build the PDF operator string that renders the redaction overlay.
 *
 * The operators draw a filled rectangle in the interior colour
 * and optionally render overlay text on top.
 */
function buildRedactionOperators(
  rect: [number, number, number, number],
  interiorColor: { r: number; g: number; b: number } | undefined,
  overlayText: string | undefined,
  options: RedactionOperatorOptions = {},
): string {
  // Annotation rect is [x1, y1, x2, y2] in default user space
  const [x1, y1, x2, y2] = rect;
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  const { r, g, b } = interiorColor ?? { r: 0, g: 0, b: 0 };
  const font = options.overlayFont ?? 'Helvetica';
  const alignment = options.overlayAlignment ?? 'left';
  const borderWidth = options.borderWidth ?? 0;
  const borderColor = options.borderColor ?? { r, g, b };
  const opacity = options.opacity ?? 1;

  let ops = '';

  // Save graphics state
  ops += 'q\n';

  // Apply opacity if not fully opaque
  if (opacity < 1) {
    ops += `/GS_R gs\n`;
    ops += `${n(opacity)} ca\n`;
  }

  // Draw filled rectangle
  ops += `${n(r)} ${n(g)} ${n(b)} rg\n`;
  ops += `${n(x)} ${n(y)} ${n(w)} ${n(h)} re\n`;
  ops += 'f\n';

  // Draw border if borderWidth > 0
  if (borderWidth > 0) {
    const { r: br, g: bg, b: bb } = borderColor;
    ops += `${n(br)} ${n(bg)} ${n(bb)} RG\n`;
    ops += `${n(borderWidth)} w\n`;
    ops += `${n(x)} ${n(y)} ${n(w)} ${n(h)} re\n`;
    ops += 'S\n';
  }

  // Overlay text
  if (overlayText) {
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    const textColor = brightness > 0.5 ? 0 : 1;

    const fontSize = options.overlayFontSize ?? Math.min(h * 0.6, 10);

    // Estimate text width (~0.5 * fontSize per character for Helvetica)
    const estimatedTextWidth = overlayText.length * fontSize * 0.5;

    let textX: number;
    if (alignment === 'center') {
      textX = x + (w - estimatedTextWidth) / 2;
    } else if (alignment === 'right') {
      textX = x + w - estimatedTextWidth - 2;
    } else {
      textX = x + 2;
    }

    const textY = y + h / 2 - fontSize / 3;

    ops += `${n(textColor)} ${n(textColor)} ${n(textColor)} rg\n`;
    ops += 'BT\n';
    ops += `/${font} ${n(fontSize)} Tf\n`;
    ops += `${n(textX)} ${n(textY)} Td\n`;

    const escaped = overlayText
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');

    ops += `(${escaped}) Tj\n`;
    ops += 'ET\n';
  }

  // Restore graphics state
  ops += 'Q\n';

  return ops;
}

/**
 * Apply a single redaction annotation on a page.
 *
 * Draws the redaction overlay and removes the annotation from the page.
 *
 * @returns `true` if the annotation was a redaction and was applied.
 */
function applyOneRedaction(
  page: PdfPage,
  annot: PdfAnnotation,
): boolean {
  if (!isRedactAnnotation(annot)) return false;

  const rect = annot.getRect();
  const interiorColor = annot.getInteriorColor();
  const overlayText = annot.getOverlayText();

  const ops = buildRedactionOperators(rect, interiorColor, overlayText);
  page.pushOperators(ops);

  // Remove the redaction annotation
  page.removeAnnotation(annot);
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply ALL redaction annotations across every page in the document.
 *
 * For each /Redact annotation found:
 * 1. Draws an opaque filled rectangle over the annotation rect.
 * 2. Renders overlay text if specified.
 * 3. Removes the redaction annotation from the page.
 *
 * @param doc  The PDF document.
 * @returns    A {@link RedactionResult} with the count and affected pages.
 */
export function applyRedactions(doc: PdfDocument): RedactionResult {
  const pages = doc.getPages();
  let appliedCount = 0;
  const affectedPages: number[] = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx]!;
    const annotations = page.getAnnotations();

    // Collect redaction annotations (iterate in reverse so removal is safe)
    const redactions: PdfAnnotation[] = [];
    for (const annot of annotations) {
      if (isRedactAnnotation(annot)) {
        redactions.push(annot);
      }
    }

    if (redactions.length === 0) continue;

    for (const annot of redactions) {
      applyOneRedaction(page, annot);
    }

    appliedCount += redactions.length;
    affectedPages.push(pageIdx);
  }

  return { appliedCount, pages: affectedPages };
}

/**
 * Apply a single redaction annotation identified by page and annotation
 * index.
 *
 * @param doc         The PDF document.
 * @param pageIndex   Zero-based page index.
 * @param annotIndex  Zero-based annotation index within the page.
 * @returns           A {@link RedactionResult} (appliedCount 0 or 1).
 * @throws            RangeError if pageIndex or annotIndex is out of bounds.
 * @throws            TypeError if the annotation at annotIndex is not a
 *                    /Redact annotation.
 */
export function applyRedaction(
  doc: PdfDocument,
  pageIndex: number,
  annotIndex: number,
): RedactionResult {
  const pages = doc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new RangeError(
      `applyRedaction: pageIndex ${pageIndex} out of range [0, ${pages.length - 1}]`,
    );
  }

  const page = pages[pageIndex]!;
  const annotations = page.getAnnotations();

  if (annotIndex < 0 || annotIndex >= annotations.length) {
    throw new RangeError(
      `applyRedaction: annotIndex ${annotIndex} out of range [0, ${annotations.length - 1}]`,
    );
  }

  const annot = annotations[annotIndex]!;

  if (!isRedactAnnotation(annot)) {
    throw new TypeError(
      `applyRedaction: annotation at index ${annotIndex} is type '${annot.getType()}', not 'Redact'`,
    );
  }

  applyOneRedaction(page, annot);

  return { appliedCount: 1, pages: [pageIndex] };
}

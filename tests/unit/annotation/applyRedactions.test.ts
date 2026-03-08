/**
 * Tests for annotation-based redaction application.
 *
 * Covers:
 * - Applying a single redaction annotation
 * - Applying multiple redactions across pages
 * - Redaction with overlay text
 * - Redaction with interior colour
 * - No redactions — no-op
 * - Redaction removes annotation from page
 * - Error cases (out of range, wrong type)
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { PdfRedactAnnotation } from '../../../src/annotation/types/redactAnnotation.js';
import {
  applyRedactions,
  applyRedaction,
} from '../../../src/annotation/applyRedactions.js';
import type { RedactionResult } from '../../../src/annotation/applyRedactions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple one-page doc with optional redaction annotations. */
function createDocWithRedactions(
  redactions: Array<{
    rect: [number, number, number, number];
    overlayText?: string;
    interiorColor?: { r: number; g: number; b: number };
  }> = [],
) {
  const doc = createPdf();
  const page = doc.addPage([612, 792]);
  page.drawText('Confidential content', { x: 50, y: 700, size: 12 });

  for (const opts of redactions) {
    const annot = PdfRedactAnnotation.create({
      rect: opts.rect,
      overlayText: opts.overlayText,
      interiorColor: opts.interiorColor,
    });
    page.addExistingAnnotation(annot);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// applyRedactions (bulk)
// ---------------------------------------------------------------------------

describe('applyRedactions', () => {
  it('returns zero count when no redactions exist', () => {
    const doc = createPdf();
    doc.addPage([612, 792]);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(0);
    expect(result.pages).toEqual([]);
  });

  it('applies a single redaction annotation', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
    ]);

    const page = doc.getPage(0);
    expect(page.getAnnotations()).toHaveLength(1);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(1);
    expect(result.pages).toEqual([0]);
    // Annotation should be removed
    expect(page.getAnnotations()).toHaveLength(0);
  });

  it('applies multiple redactions on one page', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
      { rect: [40, 650, 250, 680] },
      { rect: [40, 610, 250, 640] },
    ]);

    const page = doc.getPage(0);
    expect(page.getAnnotations()).toHaveLength(3);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(3);
    expect(result.pages).toEqual([0]);
    expect(page.getAnnotations()).toHaveLength(0);
  });

  it('applies redactions across multiple pages', () => {
    const doc = createPdf();
    const page0 = doc.addPage([612, 792]);
    const page1 = doc.addPage([612, 792]);
    const page2 = doc.addPage([612, 792]);

    // Page 0: 1 redaction
    page0.addExistingAnnotation(
      PdfRedactAnnotation.create({ rect: [10, 10, 200, 30] }),
    );
    // Page 1: no redactions
    // Page 2: 2 redactions
    page2.addExistingAnnotation(
      PdfRedactAnnotation.create({ rect: [10, 10, 200, 30] }),
    );
    page2.addExistingAnnotation(
      PdfRedactAnnotation.create({ rect: [10, 40, 200, 60] }),
    );

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(3);
    expect(result.pages).toEqual([0, 2]);
    expect(page0.getAnnotations()).toHaveLength(0);
    expect(page1.getAnnotations()).toHaveLength(0);
    expect(page2.getAnnotations()).toHaveLength(0);
  });

  it('preserves non-redact annotations', () => {
    const doc = createPdf();
    const page = doc.addPage([612, 792]);

    // Add a text annotation
    page.addAnnotation('Text', { rect: [10, 10, 30, 30], contents: 'Note' });
    // Add a redaction
    page.addExistingAnnotation(
      PdfRedactAnnotation.create({ rect: [50, 50, 200, 70] }),
    );

    expect(page.getAnnotations()).toHaveLength(2);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(1);
    // Text annotation still present
    expect(page.getAnnotations()).toHaveLength(1);
    expect(page.getAnnotations()[0]!.getType()).toBe('Text');
  });

  it('handles redaction with overlay text', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720], overlayText: 'REDACTED' },
    ]);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(1);
    // Verify operators were pushed (contains overlay text rendering)
    const ops = doc.getPage(0).getContentStreamData();
    expect(ops).toContain('(REDACTED) Tj');
    expect(ops).toContain('BT');
    expect(ops).toContain('ET');
  });

  it('handles redaction with interior colour', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720], interiorColor: { r: 1, g: 0, b: 0 } },
    ]);

    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(1);
    const ops = doc.getPage(0).getContentStreamData();
    // Red fill colour
    expect(ops).toContain('1 0 0 rg');
  });

  it('uses black fill by default when no interior colour is set', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
    ]);

    applyRedactions(doc);

    const ops = doc.getPage(0).getContentStreamData();
    expect(ops).toContain('0 0 0 rg');
  });

  it('handles overlay text with special characters', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720], overlayText: 'Re(da)ct\\ed' },
    ]);

    applyRedactions(doc);

    const ops = doc.getPage(0).getContentStreamData();
    expect(ops).toContain('Re\\(da\\)ct\\\\ed');
  });

  it('handles document with no pages gracefully', () => {
    const doc = createPdf();
    const result = applyRedactions(doc);

    expect(result.appliedCount).toBe(0);
    expect(result.pages).toEqual([]);
  });

  it('uses contrasting text colour for light backgrounds', () => {
    const doc = createDocWithRedactions([
      {
        rect: [40, 690, 250, 720],
        overlayText: 'REMOVED',
        interiorColor: { r: 1, g: 1, b: 1 }, // white background
      },
    ]);

    applyRedactions(doc);

    const ops = doc.getPage(0).getContentStreamData();
    // White background => dark (black) text
    expect(ops).toContain('0 0 0 rg');
  });

  it('uses contrasting text colour for dark backgrounds', () => {
    const doc = createDocWithRedactions([
      {
        rect: [40, 690, 250, 720],
        overlayText: 'REMOVED',
        interiorColor: { r: 0, g: 0, b: 0 }, // black background
      },
    ]);

    applyRedactions(doc);

    const ops = doc.getPage(0).getContentStreamData();
    // Black background => white text
    expect(ops).toContain('1 1 1 rg');
  });
});

// ---------------------------------------------------------------------------
// applyRedaction (single)
// ---------------------------------------------------------------------------

describe('applyRedaction', () => {
  it('applies a single redaction by index', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
    ]);

    const result = applyRedaction(doc, 0, 0);

    expect(result.appliedCount).toBe(1);
    expect(result.pages).toEqual([0]);
    expect(doc.getPage(0).getAnnotations()).toHaveLength(0);
  });

  it('throws RangeError for invalid page index', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
    ]);

    expect(() => applyRedaction(doc, 5, 0)).toThrow(RangeError);
    expect(() => applyRedaction(doc, -1, 0)).toThrow(RangeError);
  });

  it('throws RangeError for invalid annotation index', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
    ]);

    expect(() => applyRedaction(doc, 0, 5)).toThrow(RangeError);
    expect(() => applyRedaction(doc, 0, -1)).toThrow(RangeError);
  });

  it('throws TypeError when annotation is not a Redact type', () => {
    const doc = createPdf();
    const page = doc.addPage([612, 792]);
    page.addAnnotation('Text', { rect: [10, 10, 30, 30] });

    expect(() => applyRedaction(doc, 0, 0)).toThrow(TypeError);
    expect(() => applyRedaction(doc, 0, 0)).toThrow(/not 'Redact'/);
  });

  it('applies only the targeted redaction, leaving others', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720] },
      { rect: [40, 650, 250, 680] },
    ]);

    const page = doc.getPage(0);
    expect(page.getAnnotations()).toHaveLength(2);

    // Apply only the first redaction
    applyRedaction(doc, 0, 0);

    // One redaction removed, one remains
    expect(page.getAnnotations()).toHaveLength(1);
  });
});

/**
 * Tests for annotation-based redaction application.
 *
 * Both entry points throw RedactionIncompleteError (redaction by removal is
 * not available in this release).  The tests check the error, and that the
 * page content and the /Redact annotations stay exactly as they were.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { RedactionIncompleteError } from '../../../src/errors.js';
import { PdfRedactAnnotation } from '../../../src/annotation/types/redactAnnotation.js';
import { applyRedactions, applyRedaction } from '../../../src/annotation/applyRedactions.js';

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

function expectUnavailable(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(RedactionIncompleteError);
  const error = caught as RedactionIncompleteError;
  expect(error.code).toBe('redaction-incomplete');
  expect(error.reason).toBe('redaction-unavailable');
  expect(error.pageIndex).toBeUndefined();
}

describe('applyRedactions', () => {
  it('throws redaction-unavailable', () => {
    const doc = createDocWithRedactions([{ rect: [40, 690, 250, 720] }]);
    expectUnavailable(() => applyRedactions(doc));
  });

  it('throws when the document has no redaction annotations', () => {
    const doc = createPdf();
    doc.addPage([612, 792]);
    expectUnavailable(() => applyRedactions(doc));
  });

  it('keeps every annotation and the page content', () => {
    const doc = createDocWithRedactions([
      { rect: [40, 690, 250, 720], overlayText: 'REDACTED' },
      { rect: [40, 600, 250, 630], interiorColor: { r: 1, g: 0, b: 0 } },
    ]);
    const page = doc.getPage(0);
    const contentBefore = page.getContentStreamData();
    const annotationsBefore = [...page.getAnnotations()];

    expectUnavailable(() => applyRedactions(doc));

    expect(page.getContentStreamData()).toBe(contentBefore);
    expect(page.getAnnotations()).toHaveLength(2);
    expect(page.getAnnotations()).toEqual(annotationsBefore);
    expect(page.getContentStreamData()).not.toContain(' re\n');
  });

  it('keeps the annotations of every page', () => {
    const doc = createDocWithRedactions([{ rect: [40, 690, 250, 720] }]);
    const second = doc.addPage([612, 792]);
    second.addExistingAnnotation(PdfRedactAnnotation.create({ rect: [10, 10, 100, 40] }));

    expectUnavailable(() => applyRedactions(doc));

    expect(doc.getPage(0).getAnnotations()).toHaveLength(1);
    expect(doc.getPage(1).getAnnotations()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applyRedaction (single)
// ---------------------------------------------------------------------------

describe('applyRedaction', () => {
  it('throws redaction-unavailable and keeps the annotation', () => {
    const doc = createDocWithRedactions([{ rect: [40, 690, 250, 720] }]);
    const page = doc.getPage(0);
    const contentBefore = page.getContentStreamData();

    expectUnavailable(() => applyRedaction(doc, 0, 0));

    expect(page.getAnnotations()).toHaveLength(1);
    expect(page.getContentStreamData()).toBe(contentBefore);
  });

  it('throws redaction-unavailable before it checks the indices', () => {
    const doc = createDocWithRedactions([{ rect: [40, 690, 250, 720] }]);
    expectUnavailable(() => applyRedaction(doc, 5, 0));
    expectUnavailable(() => applyRedaction(doc, 0, 9));
  });
});

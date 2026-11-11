/**
 * Tests for content redaction.
 *
 * Covers:
 * - markForRedaction: recording redaction marks on a page
 * - getRedactionMarks: retrieving pending marks
 * - applyRedactions: throws RedactionIncompleteError (redaction by removal is
 *   not available in this release) and leaves the page and its marks alone
 */

import { describe, it, expect } from 'vitest';
import {
  markForRedaction,
  applyRedactions,
  getRedactionMarks,
} from '../../../src/core/redaction.js';

import { RedactionIncompleteError } from '../../../src/errors.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(): PdfPage {
  const registry = new PdfObjectRegistry();
  return new PdfPage(595, 842, registry);
}

// ---------------------------------------------------------------------------
// markForRedaction
// ---------------------------------------------------------------------------

describe('markForRedaction', () => {
  it('should record a mark on the page', () => {
    const page = makePage();
    markForRedaction(page, { rect: [50, 700, 200, 20] });
    const marks = getRedactionMarks(page);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.rect).toEqual([50, 700, 200, 20]);
  });

  it('should use default black colour', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    const marks = getRedactionMarks(page);
    expect(marks[0]!.color).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should accept custom colour', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], color: { r: 1, g: 1, b: 1 } });
    const marks = getRedactionMarks(page);
    expect(marks[0]!.color).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('should accept overlay text', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], overlayText: 'REDACTED' });
    const marks = getRedactionMarks(page);
    expect(marks[0]!.overlayText).toBe('REDACTED');
  });

  it('should allow multiple marks on the same page', () => {
    const page = makePage();
    markForRedaction(page, { rect: [10, 10, 50, 10] });
    markForRedaction(page, { rect: [10, 30, 50, 10] });
    markForRedaction(page, { rect: [10, 50, 50, 10] });
    expect(getRedactionMarks(page)).toHaveLength(3);
  });

  it('should use default Helvetica font', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)[0]!.overlayFont).toBe('Helvetica');
  });

  it('should accept custom overlay font', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], overlayFont: 'Courier' });
    expect(getRedactionMarks(page)[0]!.overlayFont).toBe('Courier');
  });

  it('should accept custom overlay font size', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], overlayFontSize: 14 });
    expect(getRedactionMarks(page)[0]!.overlayFontSize).toBe(14);
  });

  it('should default overlayFontSize to undefined (auto-calculated)', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)[0]!.overlayFontSize).toBeUndefined();
  });

  it('should default overlay alignment to left', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)[0]!.overlayAlignment).toBe('left');
  });

  it('should accept custom overlay alignment', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], overlayAlignment: 'center' });
    expect(getRedactionMarks(page)[0]!.overlayAlignment).toBe('center');
  });

  it('should default border width to 0', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)[0]!.borderWidth).toBe(0);
  });

  it('should accept custom border width', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], borderWidth: 2 });
    expect(getRedactionMarks(page)[0]!.borderWidth).toBe(2);
  });

  it('should default border colour to fill colour', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], color: { r: 1, g: 0, b: 0 } });
    expect(getRedactionMarks(page)[0]!.borderColor).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('should accept custom border colour', () => {
    const page = makePage();
    markForRedaction(page, {
      rect: [0, 0, 100, 100],
      borderColor: { r: 0, g: 0, b: 1 },
    });
    expect(getRedactionMarks(page)[0]!.borderColor).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('should default opacity to 1', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)[0]!.opacity).toBe(1);
  });

  it('should accept custom opacity', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 100, 100], opacity: 0.5 });
    expect(getRedactionMarks(page)[0]!.opacity).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// getRedactionMarks
// ---------------------------------------------------------------------------

describe('getRedactionMarks', () => {
  it('should return empty array for a fresh page', () => {
    const page = makePage();
    expect(getRedactionMarks(page)).toHaveLength(0);
  });

  it('should return marks in order', () => {
    const page = makePage();
    markForRedaction(page, { rect: [0, 0, 10, 10] });
    markForRedaction(page, { rect: [20, 20, 30, 30] });
    const marks = getRedactionMarks(page);
    expect(marks[0]!.rect).toEqual([0, 0, 10, 10]);
    expect(marks[1]!.rect).toEqual([20, 20, 30, 30]);
  });
});

// ---------------------------------------------------------------------------
// applyRedactions
// ---------------------------------------------------------------------------

describe('applyRedactions', () => {
  it('throws RedactionIncompleteError with reason redaction-unavailable', () => {
    const doc = createPdf();
    const page = doc.addPage();
    markForRedaction(page, { rect: [50, 700, 200, 20] });

    let caught: unknown;
    try {
      applyRedactions(doc);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RedactionIncompleteError);
    const error = caught as RedactionIncompleteError;
    expect(error.code).toBe('redaction-incomplete');
    expect(error.reason).toBe('redaction-unavailable');
    expect(error.pageIndex).toBeUndefined();
  });

  it('throws when no marks exist', () => {
    const doc = createPdf();
    doc.addPage();
    expect(() => applyRedactions(doc)).toThrow(RedactionIncompleteError);
  });

  it('leaves page content and marks unchanged', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.drawText('Secret', { x: 50, y: 700, size: 12 });
    markForRedaction(page, { rect: [50, 700, 200, 20], overlayText: 'X' });
    markForRedaction(page, { rect: [0, 0, 10, 10], color: { r: 1, g: 0, b: 0 } });

    const contentBefore = page.getContentStreamData();
    const marksBefore = [...getRedactionMarks(page)];

    expect(() => applyRedactions(doc)).toThrow(RedactionIncompleteError);

    expect(page.getContentStreamData()).toBe(contentBefore);
    expect(getRedactionMarks(page)).toEqual(marksBefore);
    expect(getRedactionMarks(page)).toHaveLength(2);
    expect(page.getContentStreamData()).not.toContain(' re\n');
  });

  it('throws for a document whose pages are all marked', () => {
    const doc = createPdf();
    const first = doc.addPage();
    const second = doc.addPage();
    markForRedaction(first, { rect: [0, 0, 10, 10] });
    markForRedaction(second, { rect: [0, 0, 10, 10] });
    expect(() => applyRedactions(doc)).toThrow(/not available in this release/);
    expect(getRedactionMarks(first)).toHaveLength(1);
    expect(getRedactionMarks(second)).toHaveLength(1);
  });

  it('is what PdfDocument.applyRedactions() calls', () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.markForRedaction([0, 0, 10, 10]);
    expect(() => doc.applyRedactions()).toThrow(RedactionIncompleteError);
    expect(getRedactionMarks(page)).toHaveLength(1);
  });
});

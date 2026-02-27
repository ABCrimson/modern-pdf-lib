/**
 * Tests for content redaction.
 *
 * Covers:
 * - markForRedaction: recording redaction marks on a page
 * - getRedactionMarks: retrieving pending marks
 * - applyRedactions: drawing redaction rectangles
 * - Overlay text rendering
 * - Default colour (black) and custom colours
 * - Multiple redaction marks on a single page
 * - Clearing marks after apply
 */

import { describe, it, expect } from 'vitest';
import {
  markForRedaction,
  applyRedactions,
  getRedactionMarks,
} from '../../../src/core/redaction.js';
import type { RedactionOptions } from '../../../src/core/redaction.js';
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
  it('should draw filled rectangles on the page', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [50, 700, 200, 20] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('q\n');
    expect(content).toContain('re\n');
    expect(content).toContain('f\n');
    expect(content).toContain('Q\n');
  });

  it('should use the specified colour', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 100, 100], color: { r: 1, g: 0, b: 0 } });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('1 0 0 rg\n');
  });

  it('should use default black when no colour specified', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 100, 100] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('0 0 0 rg\n');
  });

  it('should include rectangle coordinates', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [10, 20, 300, 50] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('10 20 300 50 re\n');
  });

  it('should render overlay text when provided', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 200, 30], overlayText: 'REDACTED' });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('BT\n');
    expect(content).toContain('(REDACTED) Tj\n');
    expect(content).toContain('ET\n');
  });

  it('should use white text on dark background', () => {
    const doc = createPdf();
    const page = doc.addPage();

    // Black background = dark -> white text
    markForRedaction(page, { rect: [0, 0, 200, 30], overlayText: 'SECRET', color: { r: 0, g: 0, b: 0 } });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    // White text (1 1 1 rg) for contrasting on dark background
    expect(content).toContain('1 1 1 rg\n');
  });

  it('should use black text on light background', () => {
    const doc = createPdf();
    const page = doc.addPage();

    // White background = light -> black text
    markForRedaction(page, { rect: [0, 0, 200, 30], overlayText: 'SECRET', color: { r: 1, g: 1, b: 1 } });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    // Black text (0 0 0 rg) for contrasting on light background
    expect(content).toContain('0 0 0 rg\n');
  });

  it('should clear marks after application', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 100, 100] });
    expect(getRedactionMarks(page)).toHaveLength(1);

    applyRedactions(doc);
    expect(getRedactionMarks(page)).toHaveLength(0);
  });

  it('should handle multiple marks on one page', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [10, 10, 50, 10] });
    markForRedaction(page, { rect: [10, 30, 50, 10] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    // Should have two re operators
    const reCount = (content.match(/re\n/g) ?? []).length;
    expect(reCount).toBe(2);
  });

  it('should handle multiple pages', () => {
    const doc = createPdf();
    const page1 = doc.addPage();
    const page2 = doc.addPage();

    markForRedaction(page1, { rect: [0, 0, 100, 100] });
    markForRedaction(page2, { rect: [50, 50, 200, 200] });
    applyRedactions(doc);

    expect(page1.getContentStreamData()).toContain('re\n');
    expect(page2.getContentStreamData()).toContain('re\n');
  });

  it('should do nothing when no marks exist', () => {
    const doc = createPdf();
    const page = doc.addPage();
    const contentBefore = page.getContentStreamData();

    applyRedactions(doc);

    expect(page.getContentStreamData()).toBe(contentBefore);
  });

  it('should escape special characters in overlay text', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 200, 30], overlayText: 'Text (with) parens' });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('Text \\(with\\) parens');
  });
});

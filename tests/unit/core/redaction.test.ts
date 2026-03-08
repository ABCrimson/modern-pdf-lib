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
 * - Custom overlay font, font size, alignment
 * - Border width and colour
 * - Opacity for preview/draft mode
 * - String escaping for special characters
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

  it('should escape backslashes in overlay text', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [0, 0, 200, 30], overlayText: 'path\\to\\file' });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('path\\\\to\\\\file');
  });

  it('should use custom font name in overlay text', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [0, 0, 200, 30],
      overlayText: 'REDACTED',
      overlayFont: 'Courier',
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('/Courier');
    expect(content).not.toContain('/Helvetica');
  });

  it('should use custom font size for overlay text', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [0, 0, 200, 30],
      overlayText: 'REDACTED',
      overlayFontSize: 8,
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('/Helvetica 8 Tf');
  });

  it('should center-align overlay text when overlayAlignment is center', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [0, 0, 200, 30],
      overlayText: 'CENTERED',
      overlayAlignment: 'center',
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    // The text X position should NOT be x+2 (left-aligned default)
    // For center: textX = x + (w - estimatedWidth) / 2
    expect(content).toContain('BT\n');
    expect(content).toContain('(CENTERED) Tj\n');
  });

  it('should right-align overlay text when overlayAlignment is right', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [0, 0, 200, 30],
      overlayText: 'RIGHT',
      overlayAlignment: 'right',
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('BT\n');
    expect(content).toContain('(RIGHT) Tj\n');
  });

  it('should draw border when borderWidth is set', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [10, 20, 300, 50],
      borderWidth: 2,
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    // Stroke operator
    expect(content).toContain('S\n');
    // Line width
    expect(content).toContain('2 w\n');
    // Stroke colour (RG operator — uppercase for stroke)
    expect(content).toContain('RG\n');
  });

  it('should use custom border colour', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [10, 20, 300, 50],
      borderWidth: 1,
      borderColor: { r: 1, g: 0, b: 0 },
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('1 0 0 RG\n');
  });

  it('should not draw border when borderWidth is 0', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [10, 20, 300, 50] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).not.toContain('S\n');
    expect(content).not.toContain(' w\n');
  });

  it('should apply opacity when set', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [10, 20, 300, 50],
      opacity: 0.5,
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('0.5 ca\n');
    expect(content).toContain('/GS_R gs\n');
  });

  it('should not emit opacity operators when opacity is 1', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, { rect: [10, 20, 300, 50] });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).not.toContain('ca\n');
    expect(content).not.toContain('/GS_R gs\n');
  });

  it('should handle multiple redactions with different options on same page', () => {
    const doc = createPdf();
    const page = doc.addPage();

    markForRedaction(page, {
      rect: [10, 10, 50, 10],
      overlayText: 'First',
      color: { r: 1, g: 0, b: 0 },
      overlayFont: 'Courier',
      borderWidth: 1,
    });
    markForRedaction(page, {
      rect: [10, 30, 50, 10],
      overlayText: 'Second',
      color: { r: 0, g: 0, b: 1 },
      overlayAlignment: 'center',
      opacity: 0.7,
    });
    applyRedactions(doc);

    const content = page.getContentStreamData();
    expect(content).toContain('(First) Tj\n');
    expect(content).toContain('(Second) Tj\n');
    expect(content).toContain('/Courier');
    expect(content).toContain('1 0 0 rg\n');
    expect(content).toContain('0 0 1 rg\n');
    expect(content).toContain('S\n');
    expect(content).toContain('0.7 ca\n');
  });
});

/**
 * Tests for the header/footer layout engine.
 *
 * Covers template variable replacement, page numbering (Arabic, Roman,
 * alphabetic), date formatting, skip-first-page, page ranges, separator
 * lines, three-column layout, and custom font/color usage.
 */

import { describe, it, expect } from 'vitest';
import {
  applyHeaderFooter,
  applyHeaderFooterToPage,
  toRoman,
  toAlpha,
  formatDate,
  replaceTemplateVariables,
} from '../../../src/layout/headerFooter.js';
import type {
  HeaderFooterOptions,
  HeaderFooterContent,
} from '../../../src/layout/headerFooter.js';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
import { PdfDocument, createPdf } from '../../../src/core/pdfDocument.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import type { Color } from '../../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(): PdfPage {
  const registry = new PdfObjectRegistry();
  return new PdfPage(PageSizes.A4[0], PageSizes.A4[1], registry);
}

function makeDoc(pageCount: number): PdfDocument {
  const doc = createPdf();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage(PageSizes.A4);
  }
  return doc;
}

/** Read back the raw ops string from a page for inspection. */
function getOps(page: PdfPage): string {
  return (page as unknown as { ops: string }).ops;
}

// ---------------------------------------------------------------------------
// toRoman
// ---------------------------------------------------------------------------

describe('toRoman', () => {
  it('converts basic numbers correctly', () => {
    expect(toRoman(1)).toBe('i');
    expect(toRoman(4)).toBe('iv');
    expect(toRoman(9)).toBe('ix');
    expect(toRoman(14)).toBe('xiv');
    expect(toRoman(42)).toBe('xlii');
    expect(toRoman(99)).toBe('xcix');
    expect(toRoman(2024)).toBe('mmxxiv');
  });

  it('returns string representation for zero or negative', () => {
    expect(toRoman(0)).toBe('0');
    expect(toRoman(-1)).toBe('-1');
  });
});

// ---------------------------------------------------------------------------
// toAlpha
// ---------------------------------------------------------------------------

describe('toAlpha', () => {
  it('converts single-letter numbers', () => {
    expect(toAlpha(1)).toBe('a');
    expect(toAlpha(2)).toBe('b');
    expect(toAlpha(26)).toBe('z');
  });

  it('converts multi-letter numbers', () => {
    expect(toAlpha(27)).toBe('aa');
    expect(toAlpha(28)).toBe('ab');
    expect(toAlpha(52)).toBe('az');
    expect(toAlpha(53)).toBe('ba');
  });

  it('returns string representation for zero or negative', () => {
    expect(toAlpha(0)).toBe('0');
    expect(toAlpha(-1)).toBe('-1');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats YYYY-MM-DD', () => {
    const d = new Date(2026, 2, 8); // March 8, 2026
    expect(formatDate(d, 'YYYY-MM-DD')).toBe('2026-03-08');
  });

  it('formats with time components', () => {
    const d = new Date(2026, 0, 15, 9, 5, 3);
    expect(formatDate(d, 'YYYY/MM/DD HH:mm:ss')).toBe('2026/01/15 09:05:03');
  });

  it('handles custom separator', () => {
    const d = new Date(2026, 11, 25);
    expect(formatDate(d, 'DD.MM.YYYY')).toBe('25.12.2026');
  });
});

// ---------------------------------------------------------------------------
// replaceTemplateVariables
// ---------------------------------------------------------------------------

describe('replaceTemplateVariables', () => {
  const date = new Date(2026, 2, 8);

  it('replaces {page} and {pages}', () => {
    const result = replaceTemplateVariables('Page {page} of {pages}', 3, 10, date, 'YYYY-MM-DD', '');
    expect(result).toBe('Page 3 of 10');
  });

  it('replaces {date}', () => {
    const result = replaceTemplateVariables('Date: {date}', 1, 1, date, 'YYYY-MM-DD', '');
    expect(result).toBe('Date: 2026-03-08');
  });

  it('replaces {title}', () => {
    const result = replaceTemplateVariables('{title}', 1, 1, date, 'YYYY-MM-DD', 'My Report');
    expect(result).toBe('My Report');
  });

  it('replaces {page:roman}', () => {
    const result = replaceTemplateVariables('{page:roman}', 4, 10, date, 'YYYY-MM-DD', '');
    expect(result).toBe('iv');
  });

  it('replaces {page:alpha}', () => {
    const result = replaceTemplateVariables('{page:alpha}', 3, 10, date, 'YYYY-MM-DD', '');
    expect(result).toBe('c');
  });

  it('replaces multiple variables in one string', () => {
    const result = replaceTemplateVariables(
      '{title} | Page {page} of {pages} | {date}',
      2, 5, date, 'YYYY-MM-DD', 'Report',
    );
    expect(result).toBe('Report | Page 2 of 5 | 2026-03-08');
  });

  it('leaves text without variables unchanged', () => {
    const result = replaceTemplateVariables('Just text', 1, 1, date, 'YYYY-MM-DD', '');
    expect(result).toBe('Just text');
  });
});

// ---------------------------------------------------------------------------
// applyHeaderFooterToPage — simple page number footer
// ---------------------------------------------------------------------------

describe('applyHeaderFooterToPage', () => {
  it('draws simple page number footer', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      footer: [
        { text: 'Page {page}', position: 'center' },
      ],
    };
    applyHeaderFooterToPage(page, options, 3, 10);
    const ops = getOps(page);
    expect(ops).toContain('Page 3');
  });

  it('draws header with title and date', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      header: [
        { text: '{title}', position: 'left' },
        { text: '{date}', position: 'right' },
      ],
    };
    applyHeaderFooterToPage(page, options, 1, 5, 'Annual Report');
    const ops = getOps(page);
    expect(ops).toContain('Annual Report');
    // The date should contain today's year
    expect(ops).toContain(String(new Date().getFullYear()));
  });

  it('renders three-column layout', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      footer: [
        { text: 'Left', position: 'left' },
        { text: 'Center', position: 'center' },
        { text: 'Right', position: 'right' },
      ],
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    expect(ops).toContain('Left');
    expect(ops).toContain('Center');
    expect(ops).toContain('Right');
  });

  it('replaces Roman numeral page numbers', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      footer: [
        { text: '{page:roman}', position: 'center' },
      ],
    };
    applyHeaderFooterToPage(page, options, 4, 10);
    const ops = getOps(page);
    expect(ops).toContain('iv');
  });

  it('uses custom font size and color', () => {
    const page = makePage();
    const customColor: Color = { type: 'rgb', r: 1, g: 0, b: 0 };
    const options: HeaderFooterOptions = {
      footer: [
        { text: 'Red footer', position: 'center', fontSize: 14, color: customColor },
      ],
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    expect(ops).toContain('Red footer');
    // Font size 14 should appear in Tf operator
    expect(ops).toContain('14');
    // RGB red: 1 0 0 rg
    expect(ops).toContain('1 0 0 rg');
  });

  it('draws separator line for header', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      header: [
        { text: 'Header', position: 'center' },
      ],
      separatorLine: { width: 1 },
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    // Should contain line-drawing operators
    expect(ops).toContain('Header');
    // Line width: 1 w
    expect(ops).toContain('1 w');
    // Stroke operator
    expect(ops).toContain('S\n');
  });

  it('draws separator line for footer', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      footer: [
        { text: 'Footer', position: 'center' },
      ],
      separatorLine: { width: 0.5 },
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    expect(ops).toContain('Footer');
    expect(ops).toContain('0.5 w');
    expect(ops).toContain('S\n');
  });

  it('draws separator with dash pattern', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      header: [
        { text: 'Dashed', position: 'center' },
      ],
      separatorLine: { width: 1, dashPattern: [3, 2] },
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    expect(ops).toContain('[3 2] 0 d');
  });

  it('uses custom margins', () => {
    const page = makePage();
    const options: HeaderFooterOptions = {
      footer: [
        { text: 'Custom margins', position: 'left' },
      ],
      margins: { left: 100, bottom: 60 },
    };
    applyHeaderFooterToPage(page, options, 1, 1);
    const ops = getOps(page);
    expect(ops).toContain('Custom margins');
    // The x position should be at margin left = 100
    // Footer y should be at margin bottom = 60
    // Check that Td operator uses these coordinates
    expect(ops).toMatch(/100\s+60\s+Td/);
  });
});

// ---------------------------------------------------------------------------
// applyHeaderFooter — document-level
// ---------------------------------------------------------------------------

describe('applyHeaderFooter', () => {
  it('applies footer to all pages', () => {
    const doc = makeDoc(3);
    applyHeaderFooter(doc, {
      footer: [{ text: 'Page {page} of {pages}', position: 'center' }],
    });
    const pages = doc.getPages();
    expect(getOps(pages[0]!)).toContain('Page 1 of 3');
    expect(getOps(pages[1]!)).toContain('Page 2 of 3');
    expect(getOps(pages[2]!)).toContain('Page 3 of 3');
  });

  it('skips first page when skipFirstPage is true', () => {
    const doc = makeDoc(3);
    applyHeaderFooter(doc, {
      footer: [{ text: 'Page {page}', position: 'center' }],
      skipFirstPage: true,
    });
    const pages = doc.getPages();
    expect(getOps(pages[0]!)).not.toContain('Page 1');
    expect(getOps(pages[1]!)).toContain('Page 2');
    expect(getOps(pages[2]!)).toContain('Page 3');
  });

  it('limits to page range', () => {
    const doc = makeDoc(5);
    applyHeaderFooter(doc, {
      footer: [{ text: 'P{page}', position: 'center' }],
      pageRange: { start: 2, end: 4 },
    });
    const pages = doc.getPages();
    expect(getOps(pages[0]!)).not.toContain('P1');
    expect(getOps(pages[1]!)).toContain('P2');
    expect(getOps(pages[2]!)).toContain('P3');
    expect(getOps(pages[3]!)).toContain('P4');
    expect(getOps(pages[4]!)).not.toContain('P5');
  });

  it('uses document title for {title} variable', () => {
    const doc = makeDoc(1);
    doc.setTitle('My Document');
    applyHeaderFooter(doc, {
      header: [{ text: '{title}', position: 'center' }],
    });
    const ops = getOps(doc.getPages()[0]!);
    expect(ops).toContain('My Document');
  });

  it('combines skipFirstPage with pageRange', () => {
    const doc = makeDoc(5);
    applyHeaderFooter(doc, {
      footer: [{ text: 'P{page}', position: 'center' }],
      skipFirstPage: true,
      pageRange: { start: 1, end: 3 },
    });
    const pages = doc.getPages();
    // Page 1 skipped (skipFirstPage), pages 4-5 outside range
    expect(getOps(pages[0]!)).not.toContain('P1');
    expect(getOps(pages[1]!)).toContain('P2');
    expect(getOps(pages[2]!)).toContain('P3');
    expect(getOps(pages[3]!)).not.toContain('P4');
    expect(getOps(pages[4]!)).not.toContain('P5');
  });

  it('handles both header and footer simultaneously', () => {
    const doc = makeDoc(2);
    applyHeaderFooter(doc, {
      header: [{ text: 'Header {page}', position: 'center' }],
      footer: [{ text: 'Footer {page}', position: 'center' }],
    });
    const ops1 = getOps(doc.getPages()[0]!);
    const ops2 = getOps(doc.getPages()[1]!);
    expect(ops1).toContain('Header 1');
    expect(ops1).toContain('Footer 1');
    expect(ops2).toContain('Header 2');
    expect(ops2).toContain('Footer 2');
  });

  it('handles empty header/footer arrays gracefully', () => {
    const doc = makeDoc(1);
    // Should not throw
    applyHeaderFooter(doc, { header: [], footer: [] });
    const ops = getOps(doc.getPages()[0]!);
    // Page should have minimal ops (just the initial empty string)
    expect(typeof ops).toBe('string');
  });

  it('handles document with no title using empty string for {title}', () => {
    const doc = makeDoc(1);
    // No title set
    applyHeaderFooter(doc, {
      header: [{ text: 'Title: {title}', position: 'center' }],
    });
    const ops = getOps(doc.getPages()[0]!);
    expect(ops).toContain('Title: ');
  });
});

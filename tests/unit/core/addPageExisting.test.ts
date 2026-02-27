/**
 * Tests for addPage(existingPage) — adding a pre-existing PdfPage instance
 * to a document rather than creating a new blank page.
 */

import { describe, it, expect } from 'vitest';
import { createPdf, PdfDocument, PageSizes } from '../../../src/index.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('addPage(existingPage)', () => {
  it('accepts a PdfPage instance and adds it to the document', () => {
    const doc = createPdf();
    const registry = doc.getRegistry();
    const page = new PdfPage(400, 600, registry);

    const returned = doc.addPage(page);

    expect(returned).toBe(page);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPages()[0]).toBe(page);
  });

  it('existing page appears in getPages() at the correct position', () => {
    const doc = createPdf();
    const registry = doc.getRegistry();

    const p1 = doc.addPage(PageSizes.A4);
    const existingPage = new PdfPage(300, 500, registry);
    const p3 = doc.addPage(existingPage);
    const p4 = doc.addPage(PageSizes.Letter);

    const pages = doc.getPages();
    expect(pages).toHaveLength(3);
    expect(pages[0]).toBe(p1);
    expect(pages[1]).toBe(existingPage);
    expect(pages[2]).toBe(p4);
  });

  it('existing page dimensions are preserved', () => {
    const doc = createPdf();
    const registry = doc.getRegistry();
    const page = new PdfPage(123, 456, registry);

    doc.addPage(page);

    expect(doc.getPage(0).width).toBe(123);
    expect(doc.getPage(0).height).toBe(456);
  });

  it('still works with PageSize arguments after adding an existing page', () => {
    const doc = createPdf();
    const registry = doc.getRegistry();

    doc.addPage(new PdfPage(100, 200, registry));
    const normalPage = doc.addPage(PageSizes.Letter);

    expect(doc.getPageCount()).toBe(2);
    expect(normalPage.width).toBe(612);
    expect(normalPage.height).toBe(792);
  });

  it('still defaults to A4 when called with no arguments', () => {
    const doc = createPdf();
    const page = doc.addPage();

    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
  });
});

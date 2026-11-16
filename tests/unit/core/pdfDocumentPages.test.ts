/**
 * Tests for the page methods of `PdfDocument`: `insertPage`, `removePage` and `movePage`.
 * The free functions of the same names live in `src/core/pageManipulation.ts` and are tested in
 * `pageManipulation.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { createPdf, InvalidArgumentError, PageSizes, PdfDocument } from '../../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDocWithPages(count: number): PdfDocument {
  const doc = createPdf();
  for (let i = 0; i < count; i++) {
    doc.addPage([100 * (i + 1), 200 * (i + 1)]);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// PdfDocument.insertPage (method)
// ---------------------------------------------------------------------------

describe('PdfDocument.insertPage', () => {
  it('inserts a page at a specific index', () => {
    const doc = createDocWithPages(3);
    const page = doc.insertPage(1, PageSizes.Letter);

    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPage(1)).toBe(page);
    expect(page.width).toBe(612);
  });

  it('throws on out-of-range index', () => {
    const doc = createDocWithPages(2);
    expect(() => doc.insertPage(-1)).toThrow(InvalidArgumentError);
    expect(() => doc.insertPage(3)).toThrow(InvalidArgumentError);
  });
});

// ---------------------------------------------------------------------------
// PdfDocument.removePage (method)
// ---------------------------------------------------------------------------

describe('PdfDocument.removePage', () => {
  it('removes a page by index', () => {
    const doc = createDocWithPages(3);
    doc.removePage(0);
    expect(doc.getPageCount()).toBe(2);
  });

  it('throws on out-of-range index', () => {
    const doc = createDocWithPages(2);
    expect(() => doc.removePage(-1)).toThrow(InvalidArgumentError);
    expect(() => doc.removePage(2)).toThrow(InvalidArgumentError);
  });
});

// ---------------------------------------------------------------------------
// PdfDocument.movePage (method)
// ---------------------------------------------------------------------------

describe('PdfDocument.movePage', () => {
  it('moves a page within the document', () => {
    const doc = createDocWithPages(3);
    const last = doc.getPage(2);
    doc.movePage(2, 0);

    expect(doc.getPage(0)).toBe(last);
  });

  it('throws on invalid fromIndex', () => {
    const doc = createDocWithPages(2);
    expect(() => doc.movePage(-1, 0)).toThrow(InvalidArgumentError);
    expect(() => doc.movePage(2, 0)).toThrow(InvalidArgumentError);
  });
});

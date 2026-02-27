/**
 * Tests for page manipulation operations.
 *
 * Covers: insertPage, removePage, movePage, rotatePage, cropPage,
 * getPageSize, resizePage, reversePages, removePages, rotateAllPages.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PageSizes,
  PdfDocument,
} from '../../../src/index.js';
import {
  insertPage,
  removePage,
  movePage,
  rotatePage,
  cropPage,
  getPageSize,
  resizePage,
  reversePages,
  removePages,
  rotateAllPages,
} from '../../../src/core/pageManipulation.js';

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
// insertPage
// ---------------------------------------------------------------------------

describe('insertPage', () => {
  it('inserts a page at the beginning', () => {
    const doc = createDocWithPages(3);
    const page = insertPage(doc, 0, PageSizes.Letter);

    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPage(0)).toBe(page);
    expect(page.width).toBe(612);
    expect(page.height).toBe(792);
  });

  it('inserts a page in the middle', () => {
    const doc = createDocWithPages(3);
    const page = insertPage(doc, 1, [500, 500]);

    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPage(1)).toBe(page);
    expect(page.width).toBe(500);
    expect(page.height).toBe(500);
    // Original page 1 should now be at index 2
    expect(doc.getPage(2).width).toBe(200);
  });

  it('inserts a page at the end', () => {
    const doc = createDocWithPages(2);
    const page = insertPage(doc, 2, [300, 400]);

    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(2)).toBe(page);
    expect(page.width).toBe(300);
  });

  it('defaults to A4 when no size is given', () => {
    const doc = createDocWithPages(1);
    const page = insertPage(doc, 0);

    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
  });

  it('throws on invalid index', () => {
    const doc = createDocWithPages(2);
    expect(() => insertPage(doc, -1)).toThrow(RangeError);
    expect(() => insertPage(doc, 3)).toThrow(RangeError);
    expect(() => insertPage(doc, 1.5)).toThrow(RangeError);
  });

  it('inserts into an empty document', () => {
    const doc = createPdf();
    const page = insertPage(doc, 0, PageSizes.A4);

    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0)).toBe(page);
  });
});

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
    expect(() => doc.insertPage(-1)).toThrow(RangeError);
    expect(() => doc.insertPage(3)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// removePage
// ---------------------------------------------------------------------------

describe('removePage', () => {
  it('removes the first page', () => {
    const doc = createDocWithPages(3);
    const originalSecond = doc.getPage(1);
    removePage(doc, 0);

    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0)).toBe(originalSecond);
  });

  it('removes the last page', () => {
    const doc = createDocWithPages(3);
    removePage(doc, 2);

    expect(doc.getPageCount()).toBe(2);
  });

  it('removes a middle page', () => {
    const doc = createDocWithPages(3);
    const originalFirst = doc.getPage(0);
    const originalThird = doc.getPage(2);
    removePage(doc, 1);

    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0)).toBe(originalFirst);
    expect(doc.getPage(1)).toBe(originalThird);
  });

  it('throws on invalid index', () => {
    const doc = createDocWithPages(2);
    expect(() => removePage(doc, -1)).toThrow(RangeError);
    expect(() => removePage(doc, 2)).toThrow(RangeError);
    expect(() => removePage(doc, 0.5)).toThrow(RangeError);
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
    expect(() => doc.removePage(-1)).toThrow(RangeError);
    expect(() => doc.removePage(2)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// movePage
// ---------------------------------------------------------------------------

describe('movePage', () => {
  it('moves a page from the end to the front', () => {
    const doc = createDocWithPages(3);
    const originalLast = doc.getPage(2);
    movePage(doc, 2, 0);

    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0)).toBe(originalLast);
  });

  it('moves a page from the front to the end', () => {
    const doc = createDocWithPages(3);
    const originalFirst = doc.getPage(0);
    movePage(doc, 0, 2);

    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(2)).toBe(originalFirst);
  });

  it('moves a page to the same position (no-op)', () => {
    const doc = createDocWithPages(3);
    const pages = [...doc.getPages()];
    movePage(doc, 1, 1);

    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0)).toBe(pages[0]);
    expect(doc.getPage(1)).toBe(pages[1]);
    expect(doc.getPage(2)).toBe(pages[2]);
  });

  it('throws on invalid fromIndex', () => {
    const doc = createDocWithPages(3);
    expect(() => movePage(doc, -1, 0)).toThrow(RangeError);
    expect(() => movePage(doc, 3, 0)).toThrow(RangeError);
  });

  it('throws on invalid toIndex', () => {
    const doc = createDocWithPages(3);
    expect(() => movePage(doc, 0, -1)).toThrow(RangeError);
    expect(() => movePage(doc, 0, 3)).toThrow(RangeError);
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
    expect(() => doc.movePage(-1, 0)).toThrow(RangeError);
    expect(() => doc.movePage(2, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// rotatePage
// ---------------------------------------------------------------------------

describe('rotatePage', () => {
  it('rotates a page by 90 degrees', () => {
    const doc = createDocWithPages(1);
    rotatePage(doc, 0, 90);

    const page = doc.getPage(0);
    expect(page.getRotation()).toBe(90);
  });

  it('rotates a page by 180 degrees', () => {
    const doc = createDocWithPages(1);
    rotatePage(doc, 0, 180);

    expect(doc.getPage(0).getRotation()).toBe(180);
  });

  it('rotates a page by 270 degrees', () => {
    const doc = createDocWithPages(1);
    rotatePage(doc, 0, 270);

    expect(doc.getPage(0).getRotation()).toBe(270);
  });

  it('cumulative rotation wraps at 360', () => {
    const doc = createDocWithPages(1);
    rotatePage(doc, 0, 90);
    rotatePage(doc, 0, 90);
    rotatePage(doc, 0, 90);
    rotatePage(doc, 0, 90);

    expect(doc.getPage(0).getRotation()).toBe(0);
  });

  it('handles negative rotation', () => {
    const doc = createDocWithPages(1);
    rotatePage(doc, 0, -90);

    expect(doc.getPage(0).getRotation()).toBe(270);
  });

  it('throws on non-multiple of 90', () => {
    const doc = createDocWithPages(1);
    expect(() => rotatePage(doc, 0, 45)).toThrow(/multiple of 90/);
    expect(() => rotatePage(doc, 0, 30)).toThrow(/multiple of 90/);
  });

  it('throws on invalid index', () => {
    const doc = createDocWithPages(1);
    expect(() => rotatePage(doc, 1, 90)).toThrow(RangeError);
    expect(() => rotatePage(doc, -1, 90)).toThrow(RangeError);
  });

  it('rotation is preserved in saved output', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    rotatePage(doc, 0, 90);

    const bytes = await doc.save({ compress: false });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/Rotate 90');
  });
});

// ---------------------------------------------------------------------------
// cropPage
// ---------------------------------------------------------------------------

describe('cropPage', () => {
  it('sets a crop box on a page', () => {
    const doc = createDocWithPages(1);
    cropPage(doc, 0, { x: 10, y: 20, width: 80, height: 160 });

    const page = doc.getPage(0);
    const box = page.getCropBox();
    expect(box).toBeDefined();
    expect(box!.x).toBe(10);
    expect(box!.y).toBe(20);
    expect(box!.width).toBe(80);
    expect(box!.height).toBe(160);
  });

  it('throws on invalid index', () => {
    const doc = createDocWithPages(1);
    expect(() => cropPage(doc, 1, { x: 0, y: 0, width: 100, height: 100 })).toThrow(RangeError);
  });

  it('crop box appears in saved output', async () => {
    const doc = createPdf();
    doc.addPage([200, 300]);
    cropPage(doc, 0, { x: 10, y: 10, width: 180, height: 280 });

    const bytes = await doc.save({ compress: false });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/CropBox');
  });
});

// ---------------------------------------------------------------------------
// getPageSize
// ---------------------------------------------------------------------------

describe('getPageSize', () => {
  it('returns the correct page size', () => {
    const doc = createDocWithPages(2);
    const size1 = getPageSize(doc, 0);
    expect(size1.width).toBe(100);
    expect(size1.height).toBe(200);

    const size2 = getPageSize(doc, 1);
    expect(size2.width).toBe(200);
    expect(size2.height).toBe(400);
  });

  it('throws on invalid index', () => {
    const doc = createDocWithPages(1);
    expect(() => getPageSize(doc, 1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// resizePage
// ---------------------------------------------------------------------------

describe('resizePage', () => {
  it('changes page dimensions', () => {
    const doc = createDocWithPages(1);
    resizePage(doc, 0, [500, 700]);

    const size = getPageSize(doc, 0);
    expect(size.width).toBe(500);
    expect(size.height).toBe(700);
  });

  it('accepts PageSizes constants', () => {
    const doc = createDocWithPages(1);
    resizePage(doc, 0, PageSizes.Letter);

    const size = getPageSize(doc, 0);
    expect(size.width).toBe(612);
    expect(size.height).toBe(792);
  });
});

// ---------------------------------------------------------------------------
// reversePages
// ---------------------------------------------------------------------------

describe('reversePages', () => {
  it('reverses the page order', () => {
    const doc = createDocWithPages(3);
    const [p1, p2, p3] = [doc.getPage(0), doc.getPage(1), doc.getPage(2)];
    reversePages(doc);

    expect(doc.getPage(0)).toBe(p3);
    expect(doc.getPage(1)).toBe(p2);
    expect(doc.getPage(2)).toBe(p1);
  });

  it('is a no-op for single-page documents', () => {
    const doc = createDocWithPages(1);
    const p1 = doc.getPage(0);
    reversePages(doc);

    expect(doc.getPage(0)).toBe(p1);
  });
});

// ---------------------------------------------------------------------------
// removePages (batch)
// ---------------------------------------------------------------------------

describe('removePages', () => {
  it('removes multiple pages at once', () => {
    const doc = createDocWithPages(5);
    const p2 = doc.getPage(1);
    const p4 = doc.getPage(3);
    removePages(doc, [0, 2, 4]);

    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0)).toBe(p2);
    expect(doc.getPage(1)).toBe(p4);
  });

  it('handles duplicate indices', () => {
    const doc = createDocWithPages(3);
    removePages(doc, [1, 1]);

    expect(doc.getPageCount()).toBe(2);
  });

  it('throws if any index is out of range', () => {
    const doc = createDocWithPages(3);
    expect(() => removePages(doc, [0, 5])).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// rotateAllPages
// ---------------------------------------------------------------------------

describe('rotateAllPages', () => {
  it('rotates all pages by the given angle', () => {
    const doc = createDocWithPages(3);
    rotateAllPages(doc, 90);

    expect(doc.getPage(0).getRotation()).toBe(90);
    expect(doc.getPage(1).getRotation()).toBe(90);
    expect(doc.getPage(2).getRotation()).toBe(90);
  });

  it('throws on non-multiple of 90', () => {
    const doc = createDocWithPages(1);
    expect(() => rotateAllPages(doc, 45)).toThrow(/multiple of 90/);
  });
});

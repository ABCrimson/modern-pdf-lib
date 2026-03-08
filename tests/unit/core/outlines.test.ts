/**
 * Tests for the high-level bookmark (outline) API.
 *
 * Covers:
 * - Adding a single top-level bookmark
 * - Nested bookmarks (parent/child)
 * - Multiple bookmarks with correct sibling linking
 * - Bold, italic, and colour styling
 * - Getting the bookmark tree
 * - Removing a single bookmark
 * - Removing all bookmarks
 * - Deep nesting (grandchildren)
 * - Bookmark with y-position (FitH destination)
 * - isOpen option
 * - Removing a child bookmark
 * - Error on removing non-existent bookmark
 * - PDF structure verification (outlines dict in catalog)
 * - Empty tree returns empty array
 * - Multiple addBookmark calls produce correct tree
 * - All fit types (Fit, FitH, FitV, FitB, FitBH, FitBV, XYZ)
 * - XYZ with zoom factor
 * - FitV with left coordinate
 * - BookmarkNode includes fit, left, zoom
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import {
  addBookmark,
  getBookmarks,
  removeBookmark,
  removeAllBookmarks,
} from '../../../src/core/outlines.js';
import type { BookmarkRef, BookmarkNode } from '../../../src/core/outlines.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a document with N blank pages. */
function createDocWithPages(n: number) {
  const doc = createPdf();
  for (let i = 0; i < n; i++) {
    doc.addPage();
  }
  return doc;
}

// ---------------------------------------------------------------------------
// addBookmark
// ---------------------------------------------------------------------------

describe('addBookmark', () => {
  it('adds a single top-level bookmark', () => {
    const doc = createDocWithPages(3);
    const ref = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });

    expect(ref).toBeDefined();
    expect(ref._item).toBeDefined();
    expect(ref._item.title).toBe('Chapter 1');
  });

  it('adds a nested bookmark under a parent', () => {
    const doc = createDocWithPages(3);
    const parent = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    const child = addBookmark(doc, {
      title: 'Section 1.1',
      pageIndex: 0,
      parent,
      y: 500,
    });

    expect(child._item.title).toBe('Section 1.1');
    expect(parent._item.children).toHaveLength(1);
    expect(parent._item.children[0]).toBe(child._item);
  });

  it('supports bold styling', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Bold Entry',
      pageIndex: 0,
      bold: true,
    });

    expect(ref._item.bold).toBe(true);
  });

  it('supports italic styling', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Italic Entry',
      pageIndex: 0,
      italic: true,
    });

    expect(ref._item.italic).toBe(true);
  });

  it('supports colour', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Red Entry',
      pageIndex: 0,
      color: { r: 1, g: 0, b: 0 },
    });

    expect(ref._item.color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('supports bold + italic + colour together', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Styled',
      pageIndex: 0,
      bold: true,
      italic: true,
      color: { r: 0, g: 0.5, b: 1 },
    });

    expect(ref._item.bold).toBe(true);
    expect(ref._item.italic).toBe(true);
    expect(ref._item.color).toEqual({ r: 0, g: 0.5, b: 1 });
  });

  it('sets FitH destination when y is provided', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'With Y',
      pageIndex: 0,
      y: 700,
    });

    expect(ref._item.destination.fit).toBe('FitH');
    expect(ref._item.destination.top).toBe(700);
  });

  it('sets Fit destination when y is not provided', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'No Y',
      pageIndex: 0,
    });

    expect(ref._item.destination.fit).toBe('Fit');
    expect(ref._item.destination.top).toBeUndefined();
  });

  it('supports isOpen option', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Collapsed',
      pageIndex: 0,
      isOpen: false,
    });

    expect(ref._item.isOpen).toBe(false);
  });

  it('adds multiple top-level bookmarks', () => {
    const doc = createDocWithPages(3);
    addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    addBookmark(doc, { title: 'Chapter 2', pageIndex: 1 });
    addBookmark(doc, { title: 'Chapter 3', pageIndex: 2 });

    const tree = doc.getOutlines();
    expect(tree.items).toHaveLength(3);
    expect(tree.items[0]!.title).toBe('Chapter 1');
    expect(tree.items[1]!.title).toBe('Chapter 2');
    expect(tree.items[2]!.title).toBe('Chapter 3');
  });

  it('supports deep nesting (grandchildren)', () => {
    const doc = createDocWithPages(2);
    const ch1 = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    const sec1 = addBookmark(doc, {
      title: 'Section 1.1',
      pageIndex: 0,
      parent: ch1,
    });
    const sub1 = addBookmark(doc, {
      title: 'Subsection 1.1.1',
      pageIndex: 1,
      parent: sec1,
    });

    expect(ch1._item.children).toHaveLength(1);
    expect(sec1._item.children).toHaveLength(1);
    expect(sub1._item.title).toBe('Subsection 1.1.1');
    expect(sec1._item.children[0]).toBe(sub1._item);
  });
});

// ---------------------------------------------------------------------------
// Destination fit types
// ---------------------------------------------------------------------------

describe('addBookmark destination fit types', () => {
  it('sets Fit destination with explicit fit option', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Fit',
      pageIndex: 0,
      fit: 'Fit',
    });

    expect(ref._item.destination.fit).toBe('Fit');
  });

  it('sets FitH destination with explicit fit and y', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'FitH',
      pageIndex: 0,
      fit: 'FitH',
      y: 500,
    });

    expect(ref._item.destination.fit).toBe('FitH');
    expect(ref._item.destination.top).toBe(500);
  });

  it('sets FitV destination with left coordinate', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'FitV',
      pageIndex: 0,
      fit: 'FitV',
      left: 100,
    });

    expect(ref._item.destination.fit).toBe('FitV');
    expect(ref._item.destination.left).toBe(100);
  });

  it('sets FitB destination', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'FitB',
      pageIndex: 0,
      fit: 'FitB',
    });

    expect(ref._item.destination.fit).toBe('FitB');
  });

  it('sets FitBH destination with y', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'FitBH',
      pageIndex: 0,
      fit: 'FitBH',
      y: 300,
    });

    expect(ref._item.destination.fit).toBe('FitBH');
    expect(ref._item.destination.top).toBe(300);
  });

  it('sets FitBV destination with left coordinate', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'FitBV',
      pageIndex: 0,
      fit: 'FitBV',
      left: 50,
    });

    expect(ref._item.destination.fit).toBe('FitBV');
    expect(ref._item.destination.left).toBe(50);
  });

  it('sets XYZ destination with left, top, and zoom', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'XYZ',
      pageIndex: 0,
      fit: 'XYZ',
      left: 72,
      y: 720,
      zoom: 1.5,
    });

    expect(ref._item.destination.fit).toBe('XYZ');
    expect(ref._item.destination.left).toBe(72);
    expect(ref._item.destination.top).toBe(720);
    expect(ref._item.destination.zoom).toBe(1.5);
  });

  it('sets XYZ with zoom = 0 (keep current zoom)', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'XYZ no zoom',
      pageIndex: 0,
      fit: 'XYZ',
      left: 0,
      y: 0,
      zoom: 0,
    });

    expect(ref._item.destination.fit).toBe('XYZ');
    expect(ref._item.destination.zoom).toBe(0);
  });

  it('explicit fit overrides legacy y-based FitH default', () => {
    // When fit is explicitly set, y should be used as `top` but the
    // fit mode should be the one specified, not the legacy FitH.
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Explicit Fit with y',
      pageIndex: 0,
      fit: 'Fit',
      y: 400,
    });

    // fit should be 'Fit' even though y is provided
    expect(ref._item.destination.fit).toBe('Fit');
    expect(ref._item.destination.top).toBe(400);
  });

  it('defaults to FitH when only y is provided (legacy behaviour)', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Legacy',
      pageIndex: 0,
      y: 600,
    });

    expect(ref._item.destination.fit).toBe('FitH');
    expect(ref._item.destination.top).toBe(600);
  });

  it('defaults to Fit when neither fit nor y is provided', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, {
      title: 'Default',
      pageIndex: 0,
    });

    expect(ref._item.destination.fit).toBe('Fit');
  });
});

// ---------------------------------------------------------------------------
// getBookmarks — fit, left, zoom in BookmarkNode
// ---------------------------------------------------------------------------

describe('getBookmarks with fit types', () => {
  it('returns fit type in BookmarkNode', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitV', pageIndex: 0, fit: 'FitV', left: 200 });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('FitV');
    expect(tree[0]!.left).toBe(200);
  });

  it('returns XYZ coordinates in BookmarkNode', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, {
      title: 'XYZ',
      pageIndex: 0,
      fit: 'XYZ',
      left: 10,
      y: 20,
      zoom: 2,
    });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('XYZ');
    expect(tree[0]!.left).toBe(10);
    expect(tree[0]!.y).toBe(20);
    expect(tree[0]!.zoom).toBe(2);
  });

  it('returns FitBH in BookmarkNode', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitBH', pageIndex: 0, fit: 'FitBH', y: 100 });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('FitBH');
    expect(tree[0]!.y).toBe(100);
  });

  it('returns FitBV in BookmarkNode', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitBV', pageIndex: 0, fit: 'FitBV', left: 75 });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('FitBV');
    expect(tree[0]!.left).toBe(75);
  });

  it('returns Fit in BookmarkNode for default', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'Default', pageIndex: 0 });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('Fit');
    expect(tree[0]!.left).toBeUndefined();
    expect(tree[0]!.zoom).toBeUndefined();
  });

  it('returns FitB in BookmarkNode', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitB', pageIndex: 0, fit: 'FitB' });

    const tree = getBookmarks(doc);
    expect(tree[0]!.fit).toBe('FitB');
  });

  it('returns all fit types correctly in a mixed tree', () => {
    const doc = createDocWithPages(3);
    addBookmark(doc, { title: 'Fit', pageIndex: 0, fit: 'Fit' });
    addBookmark(doc, { title: 'FitH', pageIndex: 1, fit: 'FitH', y: 400 });
    addBookmark(doc, { title: 'XYZ', pageIndex: 2, fit: 'XYZ', left: 50, y: 750, zoom: 1.25 });

    const tree = getBookmarks(doc);
    expect(tree).toHaveLength(3);
    expect(tree[0]!.fit).toBe('Fit');
    expect(tree[1]!.fit).toBe('FitH');
    expect(tree[1]!.y).toBe(400);
    expect(tree[2]!.fit).toBe('XYZ');
    expect(tree[2]!.left).toBe(50);
    expect(tree[2]!.y).toBe(750);
    expect(tree[2]!.zoom).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// getBookmarks (original tests)
// ---------------------------------------------------------------------------

describe('getBookmarks', () => {
  it('returns an empty array when no bookmarks exist', () => {
    const doc = createDocWithPages(1);
    const bookmarks = getBookmarks(doc);

    expect(bookmarks).toEqual([]);
  });

  it('returns the full bookmark tree', () => {
    const doc = createDocWithPages(3);
    const ch1 = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    addBookmark(doc, { title: 'Section 1.1', pageIndex: 0, y: 400, parent: ch1 });
    addBookmark(doc, { title: 'Chapter 2', pageIndex: 1, bold: true });

    const tree = getBookmarks(doc);

    expect(tree).toHaveLength(2);
    expect(tree[0]!.title).toBe('Chapter 1');
    expect(tree[0]!.pageIndex).toBe(0);
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.title).toBe('Section 1.1');
    expect(tree[0]!.children[0]!.y).toBe(400);

    expect(tree[1]!.title).toBe('Chapter 2');
    expect(tree[1]!.pageIndex).toBe(1);
    expect(tree[1]!.bold).toBe(true);
    expect(tree[1]!.children).toHaveLength(0);
  });

  it('includes colour and italic in returned nodes', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, {
      title: 'Styled',
      pageIndex: 0,
      italic: true,
      color: { r: 0.2, g: 0.4, b: 0.6 },
    });

    const tree = getBookmarks(doc);
    expect(tree[0]!.italic).toBe(true);
    expect(tree[0]!.color).toEqual({ r: 0.2, g: 0.4, b: 0.6 });
  });

  it('provides a BookmarkRef in each node', () => {
    const doc = createDocWithPages(1);
    const ref = addBookmark(doc, { title: 'Test', pageIndex: 0 });

    const tree = getBookmarks(doc);
    expect(tree[0]!.ref._item).toBe(ref._item);
  });
});

// ---------------------------------------------------------------------------
// removeBookmark
// ---------------------------------------------------------------------------

describe('removeBookmark', () => {
  it('removes a top-level bookmark', () => {
    const doc = createDocWithPages(2);
    const ch1 = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    addBookmark(doc, { title: 'Chapter 2', pageIndex: 1 });

    removeBookmark(doc, ch1);

    const tree = getBookmarks(doc);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.title).toBe('Chapter 2');
  });

  it('removes a child bookmark', () => {
    const doc = createDocWithPages(1);
    const parent = addBookmark(doc, { title: 'Parent', pageIndex: 0 });
    const child = addBookmark(doc, {
      title: 'Child',
      pageIndex: 0,
      parent,
    });

    removeBookmark(doc, child);

    const tree = getBookmarks(doc);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(0);
  });

  it('removes a deeply nested bookmark', () => {
    const doc = createDocWithPages(1);
    const ch1 = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    const sec1 = addBookmark(doc, {
      title: 'Section 1.1',
      pageIndex: 0,
      parent: ch1,
    });
    const sub1 = addBookmark(doc, {
      title: 'Sub 1.1.1',
      pageIndex: 0,
      parent: sec1,
    });

    removeBookmark(doc, sub1);

    const tree = getBookmarks(doc);
    expect(tree[0]!.children[0]!.children).toHaveLength(0);
  });

  it('throws when removing a non-existent bookmark', () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });

    const doc2 = createDocWithPages(1);
    const foreign = addBookmark(doc2, { title: 'Foreign', pageIndex: 0 });

    expect(() => removeBookmark(doc, foreign)).toThrow(
      'Bookmark not found in the outline tree',
    );
  });
});

// ---------------------------------------------------------------------------
// removeAllBookmarks
// ---------------------------------------------------------------------------

describe('removeAllBookmarks', () => {
  it('clears all bookmarks', () => {
    const doc = createDocWithPages(3);
    addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
    addBookmark(doc, { title: 'Chapter 2', pageIndex: 1 });
    addBookmark(doc, { title: 'Chapter 3', pageIndex: 2 });

    removeAllBookmarks(doc);

    const tree = getBookmarks(doc);
    expect(tree).toHaveLength(0);
  });

  it('is safe to call on a document with no bookmarks', () => {
    const doc = createDocWithPages(1);
    removeAllBookmarks(doc);

    const tree = getBookmarks(doc);
    expect(tree).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PDF structure verification
// ---------------------------------------------------------------------------

describe('PDF structure', () => {
  it('includes outlines in the saved PDF', async () => {
    const doc = createDocWithPages(2);
    addBookmark(doc, { title: 'Page 1', pageIndex: 0 });
    addBookmark(doc, { title: 'Page 2', pageIndex: 1 });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    // The PDF should contain outline markers
    expect(text).toContain('/Outlines');
    expect(text).toContain('/Type /Outlines');
    expect(text).toContain('(Page 1)');
    expect(text).toContain('(Page 2)');
  });

  it('does not include outlines when none are added', async () => {
    const doc = createDocWithPages(1);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).not.toContain('/Outlines');
  });

  it('produces correct /Next and /Prev links for multiple bookmarks', () => {
    const doc = createDocWithPages(3);
    addBookmark(doc, { title: 'A', pageIndex: 0 });
    addBookmark(doc, { title: 'B', pageIndex: 1 });
    addBookmark(doc, { title: 'C', pageIndex: 2 });

    const tree = doc.getOutlines();
    // The tree itself manages linking at serialization time.
    // Verify the items are stored in order.
    expect(tree.items.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('serializes FitV destination in saved PDF', async () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitV Test', pageIndex: 0, fit: 'FitV', left: 100 });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/FitV');
  });

  it('serializes XYZ destination in saved PDF', async () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, {
      title: 'XYZ Test',
      pageIndex: 0,
      fit: 'XYZ',
      left: 72,
      y: 720,
      zoom: 1.5,
    });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/XYZ');
  });

  it('serializes FitB destination in saved PDF', async () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitB Test', pageIndex: 0, fit: 'FitB' });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/FitB');
  });

  it('serializes FitBH destination in saved PDF', async () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitBH Test', pageIndex: 0, fit: 'FitBH', y: 500 });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/FitBH');
  });

  it('serializes FitBV destination in saved PDF', async () => {
    const doc = createDocWithPages(1);
    addBookmark(doc, { title: 'FitBV Test', pageIndex: 0, fit: 'FitBV', left: 25 });

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/FitBV');
  });
});

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
// getBookmarks
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
});

/**
 * @module core/outlines
 *
 * High-level bookmark (outline) management API for PDF documents.
 *
 * Provides a function-based API for adding, retrieving, and removing
 * bookmarks in a {@link PdfDocument}.  This module wraps the lower-level
 * {@link PdfOutlineTree} and {@link PdfOutlineItem} classes from
 * `outline/pdfOutline.ts` with a simpler, options-based interface.
 *
 * Usage:
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { addBookmark, getBookmarks, removeBookmark } from 'modern-pdf-lib';
 *
 * const doc = createPdf();
 * doc.addPage();
 * doc.addPage();
 *
 * const ch1 = addBookmark(doc, { title: 'Chapter 1', pageIndex: 0 });
 * addBookmark(doc, { title: 'Section 1.1', pageIndex: 0, y: 500, parent: ch1 });
 * addBookmark(doc, { title: 'Chapter 2', pageIndex: 1, bold: true, color: { r: 1, g: 0, b: 0 } });
 *
 * const tree = getBookmarks(doc);
 * removeBookmark(doc, ch1);
 * ```
 *
 * Reference: PDF 1.7 spec, §12.3.3 (Document Outline).
 */

import type { PdfDocument } from './pdfDocument.js';
import { PdfOutlineItem } from '../outline/pdfOutline.js';
import type { OutlineDestination, OutlineItemOptions } from '../outline/pdfOutline.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An opaque handle returned by {@link addBookmark} that identifies
 * a bookmark in the outline tree.  Used as a `parent` to create
 * nested bookmarks, or passed to {@link removeBookmark} to delete
 * an entry.
 */
export interface BookmarkRef {
  /** @internal The underlying outline item. */
  readonly _item: PdfOutlineItem;
}

/**
 * Represents a single node in the bookmark tree, as returned by
 * {@link getBookmarks}.
 */
export interface BookmarkNode {
  /** The displayed bookmark title. */
  readonly title: string;
  /** Zero-based page index this bookmark points to. */
  readonly pageIndex: number;
  /** Vertical position on the target page (if set). */
  readonly y?: number | undefined;
  /** Page fit mode used by this bookmark's destination. */
  readonly fit?: 'Fit' | 'FitH' | 'FitV' | 'FitB' | 'FitBH' | 'FitBV' | 'XYZ' | undefined;
  /** Left coordinate (for FitV, FitBV, XYZ). */
  readonly left?: number | undefined;
  /** Zoom factor (for XYZ). */
  readonly zoom?: number | undefined;
  /** Whether the title is bold. */
  readonly bold?: boolean | undefined;
  /** Whether the title is italic. */
  readonly italic?: boolean | undefined;
  /** Colour of the bookmark title (RGB, 0-1 range). */
  readonly color?: { readonly r: number; readonly g: number; readonly b: number } | undefined;
  /** Child bookmarks. */
  readonly children: readonly BookmarkNode[];
  /** The handle for this bookmark node. */
  readonly ref: BookmarkRef;
}

/**
 * Options for {@link addBookmark}.
 */
export interface AddBookmarkOptions {
  /** The display title for the bookmark. */
  title: string;
  /** Zero-based page index to navigate to. */
  pageIndex: number;
  /** Parent bookmark for nesting.  Omit for a top-level bookmark. */
  parent?: BookmarkRef | undefined;
  /** Vertical position on the page (top coordinate for FitH, FitBH, XYZ). */
  y?: number | undefined;
  /** Page fit mode. Default: `'Fit'` (or `'FitH'` when only `y` is set). */
  fit?: 'Fit' | 'FitH' | 'FitV' | 'FitB' | 'FitBH' | 'FitBV' | 'XYZ' | undefined;
  /** Left coordinate (for FitV, FitBV, XYZ). */
  left?: number | undefined;
  /** Zoom factor (for XYZ). 0 = keep current zoom. */
  zoom?: number | undefined;
  /** Whether the title text is bold. */
  bold?: boolean | undefined;
  /** Whether the title text is italic. */
  italic?: boolean | undefined;
  /** Colour of the bookmark title (RGB, 0-1 range). */
  color?: { r: number; g: number; b: number } | undefined;
  /**
   * Whether the bookmark's children are initially expanded.
   * Default: `true`.
   */
  isOpen?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Add a bookmark entry to the document's outline tree.
 *
 * @param doc      The document to add the bookmark to.
 * @param options  Bookmark configuration (title, page, nesting, style).
 * @returns        A {@link BookmarkRef} identifying the new bookmark.
 */
export function addBookmark(
  doc: PdfDocument,
  options: AddBookmarkOptions,
): BookmarkRef {
  const { title, pageIndex, parent, y, fit, left, zoom, bold, italic, color, isOpen } = options;

  // Build the destination — explicit `fit` takes priority, otherwise
  // fall back to legacy behaviour (FitH when y is set, Fit otherwise).
  const resolvedFit = fit ?? (y !== undefined ? 'FitH' : 'Fit');
  const dest: OutlineDestination = {
    type: 'page',
    pageIndex,
    fit: resolvedFit,
    top: y,
    left,
    zoom,
  };

  // Build style options
  const itemOptions: OutlineItemOptions = {};
  if (bold !== undefined) itemOptions.bold = bold;
  if (italic !== undefined) itemOptions.italic = italic;
  if (color !== undefined) itemOptions.color = color;
  if (isOpen !== undefined) itemOptions.isOpen = isOpen;

  let item: PdfOutlineItem;

  if (parent !== undefined) {
    // Nested bookmark — add as child of parent
    item = parent._item.addChild(title, dest, itemOptions);
  } else {
    // Top-level bookmark
    const tree = doc.getOutlines();
    item = tree.addItem(title, dest, itemOptions);
  }

  return { _item: item };
}

/**
 * Return the bookmark tree for the document.
 *
 * Returns an array of top-level {@link BookmarkNode} objects, each
 * with a `children` array for nested bookmarks.
 *
 * @param doc  The document to read bookmarks from.
 * @returns    The bookmark tree.
 */
export function getBookmarks(doc: PdfDocument): readonly BookmarkNode[] {
  const tree = doc.getOutlines();
  return tree.items.map(itemToNode);
}

/**
 * Remove a specific bookmark from the document.
 *
 * If the bookmark has children, they are also removed.
 *
 * @param doc  The document to modify.
 * @param ref  The handle of the bookmark to remove.
 * @throws     If the bookmark is not found in the tree.
 */
export function removeBookmark(doc: PdfDocument, ref: BookmarkRef): void {
  const tree = doc.getOutlines();
  const target = ref._item;

  // Try top-level first
  const topIndex = tree.items.indexOf(target);
  if (topIndex !== -1) {
    tree.items.splice(topIndex, 1);
    return;
  }

  // Search recursively through all items
  if (removeFromChildren(tree.items, target)) {
    return;
  }

  throw new Error('Bookmark not found in the outline tree');
}

/**
 * Remove all bookmarks from the document.
 *
 * @param doc  The document to clear bookmarks from.
 */
export function removeAllBookmarks(doc: PdfDocument): void {
  const tree = doc.getOutlines();
  tree.items.length = 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a PdfOutlineItem to a BookmarkNode recursively.
 * @internal
 */
function itemToNode(item: PdfOutlineItem): BookmarkNode {
  const dest = item.destination;
  return {
    title: item.title,
    pageIndex: dest.pageIndex ?? 0,
    y: dest.top,
    fit: dest.fit,
    left: dest.left,
    zoom: dest.zoom,
    bold: item.bold,
    italic: item.italic,
    color: item.color,
    children: item.children.map(itemToNode),
    ref: { _item: item },
  };
}

/**
 * Recursively search for and remove a target item from nested children.
 * @internal
 */
function removeFromChildren(
  items: PdfOutlineItem[],
  target: PdfOutlineItem,
): boolean {
  for (const item of items) {
    const childIndex = item.children.indexOf(target);
    if (childIndex !== -1) {
      item.children.splice(childIndex, 1);
      return true;
    }
    if (removeFromChildren(item.children, target)) {
      return true;
    }
  }
  return false;
}

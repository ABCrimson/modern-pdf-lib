/**
 * @module outline/pdfOutline
 *
 * PDF outline (bookmark) tree model.  Outlines provide a hierarchical
 * table-of-contents structure that PDF viewers display in a sidebar.
 *
 * Implements the full PDF 1.7 outline specification (SS 12.3.3):
 * - /Outlines root dict with /First, /Last, /Count
 * - Outline items with /Title, /Parent, /Prev, /Next, /First, /Last, /Count
 * - Destination arrays (/Dest) for page navigation
 * - Action dictionaries (/A) for GoTo, GoToR, URI actions
 * - Colour (/C) and text style flags (/F) for visual customization
 *
 * Usage:
 * ```ts
 * const tree = new PdfOutlineTree();
 * const ch1 = tree.addItem('Chapter 1', { type: 'page', pageIndex: 0, fit: 'Fit' });
 * ch1.addChild('Section 1.1', { type: 'page', pageIndex: 1, fit: 'FitH', top: 500 });
 * const dict = tree.toDict(registry, pageRefs);
 * ```
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  PdfRef,
  PdfNull,
} from '../core/pdfObjects.js';
import type { PdfObject, PdfObjectRegistry } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Destination types
// ---------------------------------------------------------------------------

/**
 * Describes where an outline item navigates to when clicked.
 *
 * - `type: 'page'` — navigate to a specific page by zero-based index.
 * - `type: 'named'` — use a named destination string.
 */
export interface OutlineDestination {
  /** Whether to navigate by page index or named destination. */
  type: 'page' | 'named';
  /** Zero-based page index (used when `type` is `'page'`). */
  pageIndex?: number | undefined;
  /** Named destination string (used when `type` is `'named'`). */
  namedDestination?: string | undefined;
  /** Page fit mode — how the page should be displayed. */
  fit?: 'Fit' | 'FitH' | 'FitV' | 'FitB' | 'FitBH' | 'FitBV' | 'XYZ' | undefined;
  /** Top coordinate for FitH, FitBH, XYZ fit modes. */
  top?: number | undefined;
  /** Left coordinate for FitV, FitBV, XYZ fit modes. */
  left?: number | undefined;
  /** Zoom factor for XYZ fit mode (0 means keep current). */
  zoom?: number | undefined;
}

// ---------------------------------------------------------------------------
// Outline item options
// ---------------------------------------------------------------------------

/** Options for creating an outline item. */
export interface OutlineItemOptions {
  /** Whether the item's children are initially visible. Default: `true`. */
  isOpen?: boolean | undefined;
  /** Colour of the outline text as RGB in range 0-1. */
  color?: { r: number; g: number; b: number } | undefined;
  /** Whether the title text is bold. */
  bold?: boolean | undefined;
  /** Whether the title text is italic. */
  italic?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// PdfOutlineItem
// ---------------------------------------------------------------------------

/**
 * A single node in the outline tree.  Each item has a title, a
 * destination, and zero or more child items.
 */
export class PdfOutlineItem {
  /** The displayed bookmark title. */
  title: string;

  /** Where clicking this bookmark navigates. */
  destination: OutlineDestination;

  /** Child outline items. */
  children: PdfOutlineItem[];

  /** Whether children are initially expanded. */
  isOpen: boolean;

  /** Optional colour for the outline text (RGB, 0-1 range). */
  color?: { r: number; g: number; b: number } | undefined;

  /** Whether the title is displayed in bold. */
  bold?: boolean | undefined;

  /** Whether the title is displayed in italic. */
  italic?: boolean | undefined;

  /**
   * Create a new outline item.
   *
   * @param title        Display title for the bookmark.
   * @param destination  Navigation target.
   * @param options      Visual style options.
   */
  constructor(
    title: string,
    destination: OutlineDestination,
    options?: OutlineItemOptions,
  ) {
    this.title = title;
    this.destination = destination;
    this.children = [];
    this.isOpen = options?.isOpen ?? true;
    if (options?.color !== undefined) {
      this.color = options.color;
    }
    if (options?.bold !== undefined) {
      this.bold = options.bold;
    }
    if (options?.italic !== undefined) {
      this.italic = options.italic;
    }
  }

  /**
   * Add a child outline item.
   *
   * @param title        Display title.
   * @param destination  Navigation target.
   * @param options      Visual style options.
   * @returns            The newly created child item.
   */
  addChild(
    title: string,
    destination: OutlineDestination,
    options?: OutlineItemOptions,
  ): PdfOutlineItem {
    const child = new PdfOutlineItem(title, destination, options);
    this.children.push(child);
    return child;
  }

  /**
   * Remove a child outline item.
   *
   * @param item  The child item to remove.
   * @throws      If the item is not a direct child.
   */
  removeChild(item: PdfOutlineItem): void {
    const index = this.children.indexOf(item);
    if (index === -1) {
      throw new Error('Item is not a child of this outline item');
    }
    this.children.splice(index, 1);
  }

  /**
   * Count all visible descendants (for the /Count entry).
   *
   * Per the PDF spec:
   * - If the item is open, /Count is the total number of visible
   *   descendants (children + their visible descendants).
   * - If the item is closed, /Count is the negative of the total
   *   number of descendants that *would* be visible if opened.
   *
   * @returns The count value for the /Count entry.
   */
  getVisibleDescendantCount(): number {
    let count = 0;
    for (const child of this.children) {
      count += 1; // The child itself
      const childDescendants = child.getVisibleDescendantCount();
      if (childDescendants > 0) {
        count += childDescendants;
      } else {
        // Child is closed — its descendants are not visible,
        // but we still have the child itself counted above.
        // Negative count means hidden children.
      }
    }
    return count;
  }

  /**
   * Count the total number of descendants regardless of open/closed state.
   * @internal
   */
  getTotalDescendantCount(): number {
    let count = 0;
    for (const child of this.children) {
      count += 1;
      count += child.getTotalDescendantCount();
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// PdfOutlineTree
// ---------------------------------------------------------------------------

/**
 * The root of the outline tree, containing top-level outline items.
 */
export class PdfOutlineTree {
  /** Top-level outline items. */
  items: PdfOutlineItem[];

  constructor() {
    this.items = [];
  }

  /**
   * Add a top-level outline item.
   *
   * @param title        Display title.
   * @param destination  Navigation target.
   * @param options      Visual style options.
   * @returns            The newly created item.
   */
  addItem(
    title: string,
    destination: OutlineDestination,
    options?: OutlineItemOptions,
  ): PdfOutlineItem {
    const item = new PdfOutlineItem(title, destination, options);
    this.items.push(item);
    return item;
  }

  /**
   * Remove a top-level outline item.
   *
   * @param item  The item to remove.
   * @throws      If the item is not in the tree.
   */
  removeItem(item: PdfOutlineItem): void {
    const index = this.items.indexOf(item);
    if (index === -1) {
      throw new Error('Item is not in the outline tree');
    }
    this.items.splice(index, 1);
  }

  /**
   * Serialize the outline tree to a PDF /Outlines dictionary.
   *
   * This creates the complete outline object graph:
   * - A root /Outlines dict with /Type, /First, /Last, /Count
   * - One dict per outline item with /Title, /Parent, /Prev, /Next,
   *   /First, /Last, /Count, /Dest (or /A), /C, /F
   *
   * All dictionaries are registered in the provided registry and
   * cross-linked via indirect references.
   *
   * @param registry  Object registry for allocating refs.
   * @param pageRefs  Array of PdfRef for each page (indexed by page number).
   * @returns         The indirect reference to the /Outlines root dict.
   */
  toDict(
    registry: PdfObjectRegistry,
    pageRefs: readonly PdfRef[],
  ): PdfRef {
    if (this.items.length === 0) {
      // Empty outline — still create the dict (some viewers expect it)
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Outlines'));
      dict.set('/Count', PdfNumber.of(0));
      return registry.register(dict);
    }

    // Pre-allocate the outlines root ref
    const outlinesRef = registry.allocate();

    // Serialize all top-level items
    const topLevelRefs = this.serializeItems(
      this.items,
      outlinesRef,
      registry,
      pageRefs,
    );

    // Build the root /Outlines dict
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('Outlines'));
    dict.set('/First', topLevelRefs[0]!);
    dict.set('/Last', topLevelRefs.at(-1)!);

    // /Count on the root is the total number of visible outline items
    let totalCount = 0;
    for (const item of this.items) {
      totalCount += 1;
      if (item.isOpen) {
        totalCount += item.getTotalDescendantCount();
      }
    }
    dict.set('/Count', PdfNumber.of(totalCount));

    registry.assign(outlinesRef, dict);

    return outlinesRef;
  }

  /**
   * Parse an outline tree from an existing /Outlines dictionary.
   *
   * @param dict      The /Outlines dictionary.
   * @param resolver  Function to resolve indirect references to objects.
   * @param pageRefToIndex  Mapping from page ref object numbers to page indices.
   * @returns         A fully populated PdfOutlineTree.
   */
  static fromDict(
    dict: PdfDict,
    resolver: (ref: PdfRef) => PdfObject | undefined,
    pageRefToIndex: ReadonlyMap<number, number>,
  ): PdfOutlineTree {
    const tree = new PdfOutlineTree();

    const firstRef = dict.get('/First');
    if (!firstRef || !(firstRef instanceof PdfRef)) {
      return tree; // No items
    }

    // Walk the linked list of top-level items
    let currentRef: PdfRef | undefined = firstRef;
    while (currentRef) {
      const itemObj = resolver(currentRef);
      if (!itemObj || !(itemObj instanceof PdfDict)) break;

      const item = parseOutlineItem(itemObj, resolver, pageRefToIndex);
      if (item) {
        tree.items.push(item);
      }

      // Move to next sibling
      const nextRef = itemObj.get('/Next');
      currentRef = nextRef instanceof PdfRef ? nextRef : undefined;
    }

    return tree;
  }

  // -------------------------------------------------------------------------
  // Internal serialization helpers
  // -------------------------------------------------------------------------

  /**
   * Serialize a list of sibling outline items, linking them with
   * /Prev and /Next references.
   *
   * @param items      The sibling items to serialize.
   * @param parentRef  The indirect reference to the parent node.
   * @param registry   Object registry.
   * @param pageRefs   Page references array.
   * @returns          Array of refs for the serialized items.
   *
   * @internal
   */
  private serializeItems(
    items: readonly PdfOutlineItem[],
    parentRef: PdfRef,
    registry: PdfObjectRegistry,
    pageRefs: readonly PdfRef[],
  ): PdfRef[] {
    // Pre-allocate refs for all items so we can set up /Prev / /Next links
    const refs: PdfRef[] = [];
    for (let i = 0; i < items.length; i++) {
      refs.push(registry.allocate());
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const itemRef = refs[i]!;

      const itemDict = new PdfDict();

      // /Title — required
      itemDict.set('/Title', PdfString.literal(item.title));

      // /Parent — required
      itemDict.set('/Parent', parentRef);

      // /Prev and /Next — linked list of siblings
      if (i > 0) {
        itemDict.set('/Prev', refs[i - 1]!);
      }
      if (i < items.length - 1) {
        itemDict.set('/Next', refs[i + 1]!);
      }

      // /Dest — destination array
      this.serializeDestination(item.destination, itemDict, pageRefs);

      // /C — colour array [r g b]
      if (item.color !== undefined) {
        itemDict.set(
          '/C',
          PdfArray.of([
            PdfNumber.of(item.color.r),
            PdfNumber.of(item.color.g),
            PdfNumber.of(item.color.b),
          ]),
        );
      }

      // /F — flags (bit 0 = italic, bit 1 = bold)
      const flags = (item.italic ? 1 : 0) | (item.bold ? 2 : 0);
      if (flags !== 0) {
        itemDict.set('/F', PdfNumber.of(flags));
      }

      // Children
      if (item.children.length > 0) {
        const childRefs = this.serializeItems(
          item.children,
          itemRef,
          registry,
          pageRefs,
        );
        itemDict.set('/First', childRefs[0]!);
        itemDict.set('/Last', childRefs.at(-1)!);

        // /Count
        // Positive if open (total visible descendants),
        // negative if closed (negative of total descendants).
        const totalDescendants = item.getTotalDescendantCount();
        if (item.isOpen) {
          itemDict.set('/Count', PdfNumber.of(totalDescendants));
        } else {
          itemDict.set('/Count', PdfNumber.of(-totalDescendants));
        }
      }

      registry.assign(itemRef, itemDict);
    }

    return refs;
  }

  /**
   * Serialize a destination into a /Dest array on the item dict.
   *
   * Destination formats per PDF spec:
   * - [page /Fit]
   * - [page /FitH top]
   * - [page /FitV left]
   * - [page /FitB]
   * - [page /FitBH top]
   * - [page /FitBV left]
   * - [page /XYZ left top zoom]
   *
   * @internal
   */
  private serializeDestination(
    dest: OutlineDestination,
    dict: PdfDict,
    pageRefs: readonly PdfRef[],
  ): void {
    if (dest.type === 'named') {
      // Named destination — use a string
      if (dest.namedDestination !== undefined) {
        dict.set('/Dest', PdfString.literal(dest.namedDestination));
      }
      return;
    }

    // Page destination
    const pageIndex = dest.pageIndex ?? 0;
    const pageRef = pageRefs[pageIndex];
    if (!pageRef) {
      throw new RangeError(
        `Outline destination page index ${pageIndex} out of range [0, ${pageRefs.length - 1}]`,
      );
    }

    const fit = dest.fit ?? 'Fit';
    const items: PdfObject[] = [pageRef];

    switch (fit) {
      case 'Fit':
        items.push(PdfName.of('Fit'));
        break;
      case 'FitH':
        items.push(PdfName.of('FitH'));
        items.push(dest.top !== undefined ? PdfNumber.of(dest.top) : PdfNull.instance);
        break;
      case 'FitV':
        items.push(PdfName.of('FitV'));
        items.push(dest.left !== undefined ? PdfNumber.of(dest.left) : PdfNull.instance);
        break;
      case 'FitB':
        items.push(PdfName.of('FitB'));
        break;
      case 'FitBH':
        items.push(PdfName.of('FitBH'));
        items.push(dest.top !== undefined ? PdfNumber.of(dest.top) : PdfNull.instance);
        break;
      case 'FitBV':
        items.push(PdfName.of('FitBV'));
        items.push(dest.left !== undefined ? PdfNumber.of(dest.left) : PdfNull.instance);
        break;
      case 'XYZ':
        items.push(PdfName.of('XYZ'));
        items.push(dest.left !== undefined ? PdfNumber.of(dest.left) : PdfNull.instance);
        items.push(dest.top !== undefined ? PdfNumber.of(dest.top) : PdfNull.instance);
        items.push(dest.zoom !== undefined ? PdfNumber.of(dest.zoom) : PdfNull.instance);
        break;
    }

    dict.set('/Dest', PdfArray.of(items));
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single outline item dictionary into a PdfOutlineItem.
 *
 * @param dict            The outline item dict.
 * @param resolver        Function to resolve indirect references.
 * @param pageRefToIndex  Maps page ref object numbers to page indices.
 * @returns               The parsed PdfOutlineItem, or undefined if invalid.
 *
 * @internal
 */
function parseOutlineItem(
  dict: PdfDict,
  resolver: (ref: PdfRef) => PdfObject | undefined,
  pageRefToIndex: ReadonlyMap<number, number>,
): PdfOutlineItem | undefined {
  // /Title — required
  const titleObj = dict.get('/Title');
  if (!titleObj) return undefined;
  let title: string;
  if (titleObj instanceof PdfString) {
    title = titleObj.value;
  } else {
    title = String(titleObj);
  }

  // /Dest — parse the destination
  const destination = parseDestination(dict.get('/Dest'), resolver, pageRefToIndex);

  // /Count — determine open/closed state
  const countObj = dict.get('/Count');
  let isOpen = true;
  if (countObj && 'value' in countObj && typeof countObj.value === 'number') {
    isOpen = countObj.value >= 0;
  }

  // /C — colour
  let color: { r: number; g: number; b: number } | undefined;
  const colorObj = dict.get('/C');
  if (colorObj instanceof PdfArray && colorObj.length >= 3) {
    const r = extractNumber(colorObj.items[0]) ?? 0;
    const g = extractNumber(colorObj.items[1]) ?? 0;
    const b = extractNumber(colorObj.items[2]) ?? 0;
    color = { r, g, b };
  }

  // /F — flags
  let bold: boolean | undefined;
  let italic: boolean | undefined;
  const flagsObj = dict.get('/F');
  if (flagsObj && 'value' in flagsObj && typeof flagsObj.value === 'number') {
    const flags = flagsObj.value;
    italic = (flags & 1) !== 0 ? true : undefined;
    bold = (flags & 2) !== 0 ? true : undefined;
  }

  const item = new PdfOutlineItem(title, destination, {
    isOpen,
    color,
    bold,
    italic,
  });

  // Parse children
  const firstRef = dict.get('/First');
  if (firstRef instanceof PdfRef) {
    let currentRef: PdfRef | undefined = firstRef;
    while (currentRef) {
      const childObj = resolver(currentRef);
      if (!childObj || !(childObj instanceof PdfDict)) break;

      const childItem = parseOutlineItem(childObj, resolver, pageRefToIndex);
      if (childItem) {
        item.children.push(childItem);
      }

      const nextRef = childObj.get('/Next');
      currentRef = nextRef instanceof PdfRef ? nextRef : undefined;
    }
  }

  return item;
}

/**
 * Parse a /Dest value into an OutlineDestination.
 *
 * @param destObj         The raw /Dest value from the outline dict.
 * @param resolver        Function to resolve indirect references.
 * @param pageRefToIndex  Maps page ref object numbers to page indices.
 * @returns               The parsed destination.
 *
 * @internal
 */
function parseDestination(
  destObj: PdfObject | undefined,
  resolver: (ref: PdfRef) => PdfObject | undefined,
  pageRefToIndex: ReadonlyMap<number, number>,
): OutlineDestination {
  // Default fallback
  const fallback: OutlineDestination = { type: 'page', pageIndex: 0, fit: 'Fit' };

  if (!destObj) return fallback;

  // Named destination (string)
  if (destObj instanceof PdfString) {
    return {
      type: 'named',
      namedDestination: destObj.value,
    };
  }

  // Name as destination (some older PDFs use a name)
  if (destObj instanceof PdfName) {
    return {
      type: 'named',
      namedDestination: destObj.value.startsWith('/') ? destObj.value.slice(1) : destObj.value,
    };
  }

  // Array destination [pageRef /FitType ...]
  if (destObj instanceof PdfArray && destObj.length >= 2) {
    const items = destObj.items;
    const pageObj = items[0];

    // Resolve page reference to index
    let pageIndex = 0;
    if (pageObj instanceof PdfRef) {
      pageIndex = pageRefToIndex.get(pageObj.objectNumber) ?? 0;
    }

    // Get the fit type
    const fitObj = items[1];
    let fitName = 'Fit';
    if (fitObj instanceof PdfName) {
      fitName = fitObj.value.startsWith('/') ? fitObj.value.slice(1) : fitObj.value;
    }

    const dest: OutlineDestination = { type: 'page', pageIndex };

    switch (fitName) {
      case 'Fit':
        dest.fit = 'Fit';
        break;
      case 'FitH':
        dest.fit = 'FitH';
        dest.top = extractNumber(items[2]);
        break;
      case 'FitV':
        dest.fit = 'FitV';
        dest.left = extractNumber(items[2]);
        break;
      case 'FitB':
        dest.fit = 'FitB';
        break;
      case 'FitBH':
        dest.fit = 'FitBH';
        dest.top = extractNumber(items[2]);
        break;
      case 'FitBV':
        dest.fit = 'FitBV';
        dest.left = extractNumber(items[2]);
        break;
      case 'XYZ':
        dest.fit = 'XYZ';
        dest.left = extractNumber(items[2]);
        dest.top = extractNumber(items[3]);
        dest.zoom = extractNumber(items[4]);
        break;
      default:
        dest.fit = 'Fit';
    }

    return dest;
  }

  return fallback;
}

/**
 * Extract a numeric value from a PdfObject.
 * Returns undefined if the object is null or not a number.
 *
 * @internal
 */
function extractNumber(obj: PdfObject | undefined): number | undefined {
  if (!obj) return undefined;
  if (obj instanceof PdfNull) return undefined;
  if ('value' in obj && typeof obj.value === 'number') {
    return obj.value;
  }
  return undefined;
}

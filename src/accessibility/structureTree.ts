/**
 * @module accessibility/structureTree
 *
 * Structure tree model for tagged PDF.  A tagged PDF contains a
 * `/StructTreeRoot` dictionary in the document catalog that describes
 * the logical structure of the document content.  Each node in the
 * tree is a structure element with a type (e.g. `Document`, `P`, `H1`,
 * `Table`, `Figure`, etc.) and optional attributes such as alt text,
 * language, or actual text replacement.
 *
 * This module provides:
 * - {@link PdfStructureElement} — a single node in the structure tree.
 * - {@link PdfStructureTree} — the root container that manages the tree,
 *   assigns marked-content IDs (MCIDs), and serializes / deserializes
 *   the tree to/from PDF dictionaries.
 *
 * Reference: PDF 1.7 spec, SS14.7 (Logical Structure).
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfString,
} from '../core/pdfObjects.js';
import type { PdfObject, PdfObjectRegistry } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Structure type
// ---------------------------------------------------------------------------

/**
 * Standard structure types defined by the PDF specification (ISO 32000-1,
 * Table 333 through Table 340), plus a `string` catch-all for custom
 * structure types.
 *
 * Groups:
 * - **Grouping**: Document, Part, Art, Sect, Div, BlockQuote, Caption,
 *   TOC, TOCI, Index, NonStruct, Private
 * - **Block-level**: P, H, H1..H6
 * - **List**: L, LI, Lbl, LBody
 * - **Table**: Table, TR, TH, TD, THead, TBody, TFoot
 * - **Inline-level**: Span, Quote, Note, Reference, BibEntry, Code,
 *   Link, Annot
 * - **Ruby / Warichu**: Ruby, RB, RT, RP, Warichu, WT, WP
 * - **Illustration**: Figure, Formula, Form
 */
export type StructureType =
  // Grouping elements
  | 'Document' | 'Part' | 'Art' | 'Sect' | 'Div' | 'BlockQuote'
  | 'Caption' | 'TOC' | 'TOCI' | 'Index' | 'NonStruct' | 'Private'
  // Block-level elements
  | 'P' | 'H' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'
  // List elements
  | 'L' | 'LI' | 'Lbl' | 'LBody'
  // Table elements
  | 'Table' | 'TR' | 'TH' | 'TD' | 'THead' | 'TBody' | 'TFoot'
  // Inline-level elements
  | 'Span' | 'Quote' | 'Note' | 'Reference' | 'BibEntry' | 'Code'
  | 'Link' | 'Annot'
  // Ruby / Warichu
  | 'Ruby' | 'RB' | 'RT' | 'RP' | 'Warichu' | 'WT' | 'WP'
  // Illustration elements
  | 'Figure' | 'Formula' | 'Form'
  // Allow custom structure types
  | (string & {});

// ---------------------------------------------------------------------------
// Structure element options
// ---------------------------------------------------------------------------

/**
 * Optional attributes for a structure element.
 */
export interface StructureElementOptions {
  /** The element title (a human-readable label). */
  title?: string | undefined;
  /** Alternative text for the element (required for images by PDF/UA). */
  altText?: string | undefined;
  /** Replacement text that may be used instead of the element's content. */
  actualText?: string | undefined;
  /** The natural language for this element (BCP 47, e.g. `"en-US"`). */
  language?: string | undefined;
  /** An optional unique identifier for the element. */
  id?: string | undefined;
}

// ---------------------------------------------------------------------------
// Accessibility issue (used by validate and the checker)
// ---------------------------------------------------------------------------

/**
 * Describes a single accessibility issue found during validation.
 */
export interface AccessibilityIssue {
  /** Severity of the issue. */
  severity: 'error' | 'warning' | 'info';
  /** Machine-readable issue code. */
  code: string;
  /** Human-readable description of the issue. */
  message: string;
  /** The structure element related to the issue, if any. */
  element?: PdfStructureElement | undefined;
  /** The zero-based page index related to the issue, if any. */
  pageIndex?: number | undefined;
}

// ---------------------------------------------------------------------------
// Standard structure type sets (for validation)
// ---------------------------------------------------------------------------

/** Block-level grouping elements. */
const GROUPING_TYPES = new Set<string>([
  'Document', 'Part', 'Art', 'Sect', 'Div', 'BlockQuote',
  'Caption', 'TOC', 'TOCI', 'Index', 'NonStruct', 'Private',
]);

/** Heading elements for hierarchy validation. */
const HEADING_TYPES = new Set<string>(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** Heading level map for hierarchy validation. */
const HEADING_LEVEL: Record<string, number> = {
  H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6,
};

/** Table cell types. */
const TABLE_CELL_TYPES = new Set<string>(['TH', 'TD']);

/** Table row section types. */
const TABLE_SECTION_TYPES = new Set<string>(['THead', 'TBody', 'TFoot']);

/** All table-related types. */
const TABLE_TYPES = new Set<string>([
  'Table', 'TR', 'TH', 'TD', 'THead', 'TBody', 'TFoot',
]);

/** Illustration types that need alt text. */
const ILLUSTRATION_TYPES = new Set<string>(['Figure', 'Formula', 'Form']);

/** List structure types. */
const LIST_TYPES = new Set<string>(['L', 'LI', 'Lbl', 'LBody']);

// ---------------------------------------------------------------------------
// PdfStructureElement
// ---------------------------------------------------------------------------

/**
 * A single node in the structure tree.
 *
 * Structure elements form a tree that mirrors the logical reading order
 * of the document.  Each element has a type (e.g. `"P"`, `"H1"`,
 * `"Table"`), optional attributes, and may contain child elements or
 * marked-content references (MCIDs) that link to the actual page
 * content.
 */
export class PdfStructureElement {
  /** The structure type of this element. */
  readonly type: StructureType;

  /** Child structure elements. */
  readonly children: PdfStructureElement[] = [];

  /** Optional attributes (alt text, language, title, etc.). */
  readonly options: StructureElementOptions;

  /** Marked content ID linking this element to page content. */
  mcid?: number | undefined;

  /** Zero-based page index this element's content appears on. */
  pageIndex?: number | undefined;

  /** The parent element (undefined for the root). */
  parent?: PdfStructureElement | undefined;

  /**
   * @param type     The structure type (e.g. `"P"`, `"H1"`, `"Figure"`).
   * @param options  Optional attributes for the element.
   */
  constructor(type: StructureType, options: StructureElementOptions = {}) {
    this.type = type;
    this.options = { ...options };
  }

  /**
   * Add a child element to this node.
   *
   * @param type     The child's structure type.
   * @param options  Optional attributes for the child.
   * @returns        The newly created child element.
   */
  addChild(
    type: StructureType,
    options?: StructureElementOptions,
  ): PdfStructureElement {
    const child = new PdfStructureElement(type, options);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  /**
   * Remove a direct child element.
   *
   * @param element  The child to remove.
   * @throws         If the element is not a direct child.
   */
  removeChild(element: PdfStructureElement): void {
    const index = this.children.indexOf(element);
    if (index === -1) {
      throw new Error('Element is not a direct child of this node');
    }
    this.children.splice(index, 1);
    element.parent = undefined;
  }

  /**
   * Recursively collect all elements in the subtree (depth-first,
   * including this element).
   */
  walk(): PdfStructureElement[] {
    const result: PdfStructureElement[] = [this];
    for (const child of this.children) {
      result.push(...child.walk());
    }
    return result;
  }

  /**
   * Find the first descendant (or self) matching the given type.
   */
  find(type: StructureType): PdfStructureElement | undefined {
    if (this.type === type) return this;
    for (const child of this.children) {
      const found = child.find(type);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Find all descendants (and self) matching the given type.
   */
  findAll(type: StructureType): PdfStructureElement[] {
    const result: PdfStructureElement[] = [];
    if (this.type === type) result.push(this);
    for (const child of this.children) {
      result.push(...child.findAll(type));
    }
    return result;
  }

  /**
   * Return the depth of this element in the tree (root = 0).
   */
  depth(): number {
    let d = 0;
    let current: PdfStructureElement | undefined = this.parent;
    while (current) {
      d++;
      current = current.parent;
    }
    return d;
  }

  /**
   * Serialize this element to a PDF dictionary.
   *
   * @param registry   Object registry for allocating indirect references.
   * @param parentRef  Reference to the parent element (or StructTreeRoot).
   * @param pageRefs   Array of page references indexed by page number.
   * @returns          An object containing the element's dict and its ref.
   */
  toDict(
    registry: PdfObjectRegistry,
    parentRef: PdfRef,
    pageRefs: readonly PdfRef[],
  ): { ref: PdfRef; dict: PdfDict } {
    const ref = registry.allocate();
    const dict = new PdfDict();

    // /Type /StructElem
    dict.set('/Type', PdfName.of('StructElem'));

    // /S — structure type
    dict.set('/S', PdfName.of(this.type));

    // /P — parent
    dict.set('/P', parentRef);

    // /Pg — page reference
    if (this.pageIndex !== undefined && pageRefs[this.pageIndex]) {
      dict.set('/Pg', pageRefs[this.pageIndex]!);
    }

    // /T — title
    if (this.options.title !== undefined) {
      dict.set('/T', PdfString.literal(this.options.title));
    }

    // /Alt — alt text
    if (this.options.altText !== undefined) {
      dict.set('/Alt', PdfString.literal(this.options.altText));
    }

    // /ActualText — actual text
    if (this.options.actualText !== undefined) {
      dict.set('/ActualText', PdfString.literal(this.options.actualText));
    }

    // /Lang — language
    if (this.options.language !== undefined) {
      dict.set('/Lang', PdfString.literal(this.options.language));
    }

    // /ID — unique identifier
    if (this.options.id !== undefined) {
      dict.set('/ID', PdfString.literal(this.options.id));
    }

    // /K — kids: can be integer (MCID), dict (child), or array of mixed
    if (this.children.length === 0 && this.mcid !== undefined) {
      // Leaf with MCID
      dict.set('/K', PdfNumber.of(this.mcid));
    } else if (this.children.length > 0) {
      const kidsArray = new PdfArray();

      // If this element also has an MCID, include it
      if (this.mcid !== undefined) {
        // MCID reference as dict with /Type /MCR
        const mcrDict = new PdfDict();
        mcrDict.set('/Type', PdfName.of('MCR'));
        mcrDict.set('/MCID', PdfNumber.of(this.mcid));
        if (this.pageIndex !== undefined && pageRefs[this.pageIndex]) {
          mcrDict.set('/Pg', pageRefs[this.pageIndex]!);
        }
        kidsArray.push(mcrDict);
      }

      // Recurse into children
      for (const child of this.children) {
        const childResult = child.toDict(registry, ref, pageRefs);
        registry.assign(childResult.ref, childResult.dict);
        kidsArray.push(childResult.ref);
      }

      dict.set('/K', kidsArray);
    } else if (this.mcid !== undefined) {
      dict.set('/K', PdfNumber.of(this.mcid));
    }

    registry.assign(ref, dict);
    return { ref, dict };
  }
}

// ---------------------------------------------------------------------------
// PdfStructureTree
// ---------------------------------------------------------------------------

/**
 * The structure tree for a tagged PDF document.
 *
 * Manages the root `Document` element, assigns marked-content IDs
 * (MCIDs), and provides serialization to/from PDF dictionaries.
 *
 * Usage:
 * ```ts
 * const tree = doc.createStructureTree();
 * const heading = tree.addElement(null, 'H1', { altText: 'Main heading' });
 * tree.assignMcid(heading, 0);
 *
 * const para = tree.addElement(null, 'P');
 * tree.assignMcid(para, 0);
 * ```
 */
export class PdfStructureTree {
  /** The root `Document` structure element. */
  readonly root: PdfStructureElement;

  /** Next available marked-content ID. */
  private nextMcid: number = 0;

  constructor() {
    this.root = new PdfStructureElement('Document');
  }

  /**
   * Add an element to the structure tree.
   *
   * @param parent   The parent element, or `null` to add directly under
   *                 the root `Document` element.
   * @param type     The structure type of the new element.
   * @param options  Optional attributes for the element.
   * @returns        The newly created element.
   */
  addElement(
    parent: PdfStructureElement | null,
    type: StructureType,
    options?: StructureElementOptions,
  ): PdfStructureElement {
    const target = parent ?? this.root;
    return target.addChild(type, options);
  }

  /**
   * Remove an element from the tree.
   *
   * @param element  The element to remove (must not be the root).
   * @throws         If the element is the root or has no parent.
   */
  removeElement(element: PdfStructureElement): void {
    if (element === this.root) {
      throw new Error('Cannot remove the root element');
    }
    if (!element.parent) {
      throw new Error('Element has no parent — cannot remove');
    }
    element.parent.removeChild(element);
  }

  /**
   * Assign a marked-content ID to an element and associate it with a
   * page.  The MCID links the structure element to the actual content
   * on the page (via BMC/BDC operators in the content stream).
   *
   * @param element    The element to assign an MCID to.
   * @param pageIndex  The zero-based page index the content appears on.
   * @returns          The assigned MCID.
   */
  assignMcid(element: PdfStructureElement, pageIndex: number): number {
    const mcid = this.nextMcid++;
    element.mcid = mcid;
    element.pageIndex = pageIndex;
    return mcid;
  }

  /**
   * Return all elements in the tree (depth-first traversal from root).
   */
  getAllElements(): PdfStructureElement[] {
    return this.root.walk();
  }

  /**
   * Return the current MCID counter value (useful for testing).
   */
  getNextMcid(): number {
    return this.nextMcid;
  }

  /**
   * Serialize the structure tree to a `/StructTreeRoot` dictionary.
   *
   * The resulting dict is suitable for embedding in the PDF catalog
   * as `/StructTreeRoot`.
   *
   * @param registry  Object registry for allocating indirect references.
   * @param pageRefs  Array of page references indexed by page number.
   * @returns         An object containing the StructTreeRoot ref and dict.
   */
  toDict(
    registry: PdfObjectRegistry,
    pageRefs: readonly PdfRef[],
  ): { ref: PdfRef; dict: PdfDict } {
    const rootRef = registry.allocate();
    const rootDict = new PdfDict();

    // /Type /StructTreeRoot
    rootDict.set('/Type', PdfName.of('StructTreeRoot'));

    // Build /K — the kids of the StructTreeRoot
    // The root Document element's children become direct kids
    const kidsArray = new PdfArray();

    for (const child of this.root.children) {
      const childResult = child.toDict(registry, rootRef, pageRefs);
      kidsArray.push(childResult.ref);
    }

    if (kidsArray.length === 1) {
      rootDict.set('/K', kidsArray.items[0]!);
    } else if (kidsArray.length > 1) {
      rootDict.set('/K', kidsArray);
    }

    // Build /ParentTree — a number tree mapping MCIDs to their
    // structure element references
    const parentTreeResult = this.buildParentTree(registry, pageRefs);
    if (parentTreeResult) {
      rootDict.set('/ParentTree', parentTreeResult.ref);
    }

    // Build /IDTree if any elements have IDs
    const idTreeResult = this.buildIdTree(registry, pageRefs);
    if (idTreeResult) {
      rootDict.set('/IDTree', idTreeResult.ref);
    }

    registry.assign(rootRef, rootDict);
    return { ref: rootRef, dict: rootDict };
  }

  /**
   * Build the /ParentTree number tree.
   *
   * The parent tree maps each MCID to the structure element that
   * "owns" it.  This is implemented as a number tree (a sorted
   * array of [key, value] pairs stored in /Nums).
   *
   * @internal
   */
  private buildParentTree(
    registry: PdfObjectRegistry,
    pageRefs: readonly PdfRef[],
  ): { ref: PdfRef; dict: PdfDict } | undefined {
    const allElements = this.root.walk();
    const elementsWithMcid = allElements.filter(
      (e) => e.mcid !== undefined,
    );

    if (elementsWithMcid.length === 0) return undefined;

    // Sort by MCID
    elementsWithMcid.sort((a, b) => a.mcid! - b.mcid!);

    // Build /Nums array: [mcid1, ref1, mcid2, ref2, ...]
    const numsArray = new PdfArray();
    for (const elem of elementsWithMcid) {
      numsArray.push(PdfNumber.of(elem.mcid!));
      // Create a simple structure element reference
      const elemRef = registry.allocate();
      const elemDict = new PdfDict();
      elemDict.set('/Type', PdfName.of('StructElem'));
      elemDict.set('/S', PdfName.of(elem.type));
      if (elem.options.altText !== undefined) {
        elemDict.set('/Alt', PdfString.literal(elem.options.altText));
      }
      if (elem.pageIndex !== undefined && pageRefs[elem.pageIndex]) {
        elemDict.set('/Pg', pageRefs[elem.pageIndex]!);
      }
      registry.assign(elemRef, elemDict);
      numsArray.push(elemRef);
    }

    const parentTreeDict = new PdfDict();
    parentTreeDict.set('/Nums', numsArray);

    const parentTreeRef = registry.register(parentTreeDict);
    return { ref: parentTreeRef, dict: parentTreeDict };
  }

  /**
   * Build the /IDTree name tree.
   *
   * Maps element IDs (strings) to their structure element references.
   *
   * @internal
   */
  private buildIdTree(
    registry: PdfObjectRegistry,
    _pageRefs: readonly PdfRef[],
  ): { ref: PdfRef; dict: PdfDict } | undefined {
    const allElements = this.root.walk();
    const elementsWithId = allElements.filter(
      (e) => e.options.id !== undefined,
    );

    if (elementsWithId.length === 0) return undefined;

    // Sort by ID
    elementsWithId.sort((a, b) =>
      (a.options.id ?? '').localeCompare(b.options.id ?? ''),
    );

    // Build /Names array: [name1, ref1, name2, ref2, ...]
    const namesArray = new PdfArray();
    for (const elem of elementsWithId) {
      namesArray.push(PdfString.literal(elem.options.id!));
      const elemRef = registry.allocate();
      const elemDict = new PdfDict();
      elemDict.set('/Type', PdfName.of('StructElem'));
      elemDict.set('/S', PdfName.of(elem.type));
      if (elem.options.id !== undefined) {
        elemDict.set('/ID', PdfString.literal(elem.options.id));
      }
      registry.assign(elemRef, elemDict);
      namesArray.push(elemRef);
    }

    const idTreeDict = new PdfDict();
    idTreeDict.set('/Names', namesArray);

    const idTreeRef = registry.register(idTreeDict);
    return { ref: idTreeRef, dict: idTreeDict };
  }

  /**
   * Reconstruct a structure tree from a `/StructTreeRoot` dictionary.
   *
   * @param dict      The `/StructTreeRoot` dictionary.
   * @param resolver  A function that resolves indirect references to
   *                  their underlying PDF objects.
   * @returns         A new {@link PdfStructureTree}.
   */
  static fromDict(
    dict: PdfDict,
    resolver: (ref: PdfRef) => PdfObject | undefined,
  ): PdfStructureTree {
    const tree = new PdfStructureTree();

    // Parse /K (kids of the root)
    const kids = dict.get('/K');
    if (!kids) return tree;

    const parseElement = (
      obj: PdfObject,
      parent: PdfStructureElement,
    ): void => {
      // Resolve indirect reference
      let resolved: PdfObject | undefined = obj;
      if (resolved.kind === 'ref') {
        resolved = resolver(resolved);
        if (!resolved) return;
      }

      if (resolved.kind === 'number') {
        // An integer MCID
        parent.mcid = resolved.value;
        if (resolved.value >= tree.nextMcid) {
          tree.nextMcid = resolved.value + 1;
        }
        return;
      }

      if (resolved.kind === 'dict') {
        // Check if this is a marked content reference (/Type /MCR)
        const typeObj = resolved.get('/Type');
        if (typeObj && typeObj.kind === 'name' && typeObj.value === '/MCR') {
          const mcidObj = resolved.get('/MCID');
          if (mcidObj && mcidObj.kind === 'number') {
            parent.mcid = mcidObj.value;
            if (mcidObj.value >= tree.nextMcid) {
              tree.nextMcid = mcidObj.value + 1;
            }
          }
          return;
        }

        // Otherwise it's a structure element dict
        const sObj = resolved.get('/S');
        if (!sObj || sObj.kind !== 'name') return;

        // Extract the type name (strip leading '/')
        const typeName = sObj.value.startsWith('/')
          ? sObj.value.slice(1)
          : sObj.value;

        const elemOptions: StructureElementOptions = {};

        // /T — title
        const titleObj = resolved.get('/T');
        if (titleObj && titleObj.kind === 'string') {
          elemOptions.title = titleObj.value;
        }

        // /Alt — alt text
        const altObj = resolved.get('/Alt');
        if (altObj && altObj.kind === 'string') {
          elemOptions.altText = altObj.value;
        }

        // /ActualText
        const actualObj = resolved.get('/ActualText');
        if (actualObj && actualObj.kind === 'string') {
          elemOptions.actualText = actualObj.value;
        }

        // /Lang — language
        const langObj = resolved.get('/Lang');
        if (langObj && langObj.kind === 'string') {
          elemOptions.language = langObj.value;
        }

        // /ID
        const idObj = resolved.get('/ID');
        if (idObj && idObj.kind === 'string') {
          elemOptions.id = idObj.value;
        }

        const child = parent.addChild(typeName, elemOptions);

        // Parse /K of the child
        const childKids = resolved.get('/K');
        if (childKids) {
          if (childKids.kind === 'array') {
            for (const item of childKids.items) {
              parseElement(item, child);
            }
          } else {
            parseElement(childKids, child);
          }
        }
      }

      if (resolved.kind === 'array') {
        for (const item of resolved.items) {
          parseElement(item, parent);
        }
      }
    };

    if (kids.kind === 'array') {
      for (const item of kids.items) {
        parseElement(item, tree.root);
      }
    } else {
      parseElement(kids, tree.root);
    }

    return tree;
  }

  /**
   * Validate the structure tree for common accessibility issues.
   *
   * Checks:
   * - Heading hierarchy (no skipped levels)
   * - Table structure completeness
   * - Illustration elements have alt text
   * - List structure completeness
   *
   * @returns  An array of {@link AccessibilityIssue} objects.
   */
  validate(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const allElements = this.root.walk();

    // 1. Check heading hierarchy
    this.validateHeadingHierarchy(allElements, issues);

    // 2. Check table structure
    this.validateTableStructure(allElements, issues);

    // 3. Check illustration alt text
    this.validateIllustrationAltText(allElements, issues);

    // 4. Check list structure
    this.validateListStructure(allElements, issues);

    // 5. Check that all non-root elements have valid types
    for (const elem of allElements) {
      if (elem === this.root) continue;
      if (elem.type.length === 0) {
        issues.push({
          severity: 'error',
          code: 'EMPTY_TYPE',
          message: 'Structure element has an empty type string',
          element: elem,
          pageIndex: elem.pageIndex,
        });
      }
    }

    return issues;
  }

  /**
   * Validate heading hierarchy: headings should not skip levels
   * (e.g. H1 then H3 without H2).
   *
   * @internal
   */
  private validateHeadingHierarchy(
    elements: PdfStructureElement[],
    issues: AccessibilityIssue[],
  ): void {
    const headings = elements.filter((e) => HEADING_TYPES.has(e.type));
    if (headings.length === 0) return;

    let lastLevel = 0;
    for (const h of headings) {
      const level = HEADING_LEVEL[h.type];
      if (level === undefined) continue;

      if (level > lastLevel + 1 && lastLevel > 0) {
        issues.push({
          severity: 'warning',
          code: 'HEADING_SKIP',
          message: `Heading level skipped: ${h.type} follows H${lastLevel} (expected H${lastLevel + 1})`,
          element: h,
          pageIndex: h.pageIndex,
        });
      }
      lastLevel = level;
    }

    // First heading should be H1
    const firstHeading = headings[0];
    if (firstHeading && firstHeading.type !== 'H1') {
      issues.push({
        severity: 'warning',
        code: 'HEADING_START',
        message: `First heading should be H1, found ${firstHeading.type}`,
        element: firstHeading,
        pageIndex: firstHeading.pageIndex,
      });
    }
  }

  /**
   * Validate table structure: Table should contain TR, TR should
   * contain TH or TD.
   *
   * @internal
   */
  private validateTableStructure(
    elements: PdfStructureElement[],
    issues: AccessibilityIssue[],
  ): void {
    const tables = elements.filter((e) => e.type === 'Table');

    for (const table of tables) {
      // Check that table has rows
      const hasRows = table.children.some(
        (c) => c.type === 'TR' || TABLE_SECTION_TYPES.has(c.type),
      );
      if (!hasRows) {
        issues.push({
          severity: 'error',
          code: 'TABLE_NO_ROWS',
          message: 'Table element has no TR children',
          element: table,
          pageIndex: table.pageIndex,
        });
      }

      // Check that table has at least one TH (header cell)
      const allCells = table.findAll('TH');
      if (allCells.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_NO_HEADERS',
          message: 'Table has no TH (header) cells',
          element: table,
          pageIndex: table.pageIndex,
        });
      }
    }

    // Check that TR elements contain TH or TD
    const rows = elements.filter((e) => e.type === 'TR');
    for (const row of rows) {
      const hasCells = row.children.some((c) => TABLE_CELL_TYPES.has(c.type));
      if (!hasCells) {
        issues.push({
          severity: 'error',
          code: 'TR_NO_CELLS',
          message: 'TR element has no TH or TD children',
          element: row,
          pageIndex: row.pageIndex,
        });
      }
    }

    // Check that TH/TD are inside TR
    const cells = elements.filter((e) => TABLE_CELL_TYPES.has(e.type));
    for (const cell of cells) {
      if (!cell.parent || cell.parent.type !== 'TR') {
        issues.push({
          severity: 'error',
          code: 'CELL_NOT_IN_TR',
          message: `${cell.type} element is not a direct child of TR`,
          element: cell,
          pageIndex: cell.pageIndex,
        });
      }
    }
  }

  /**
   * Validate that illustration elements (Figure, Formula, Form) have
   * alt text.
   *
   * @internal
   */
  private validateIllustrationAltText(
    elements: PdfStructureElement[],
    issues: AccessibilityIssue[],
  ): void {
    for (const elem of elements) {
      if (ILLUSTRATION_TYPES.has(elem.type)) {
        if (
          elem.options.altText === undefined &&
          elem.options.actualText === undefined
        ) {
          issues.push({
            severity: 'error',
            code: 'FIGURE_NO_ALT',
            message: `${elem.type} element has no alt text or actual text`,
            element: elem,
            pageIndex: elem.pageIndex,
          });
        }
      }
    }
  }

  /**
   * Validate list structure: L should contain LI, LI should contain
   * Lbl and/or LBody.
   *
   * @internal
   */
  private validateListStructure(
    elements: PdfStructureElement[],
    issues: AccessibilityIssue[],
  ): void {
    const lists = elements.filter((e) => e.type === 'L');

    for (const list of lists) {
      const hasItems = list.children.some((c) => c.type === 'LI');
      if (!hasItems) {
        issues.push({
          severity: 'error',
          code: 'LIST_NO_ITEMS',
          message: 'L (list) element has no LI children',
          element: list,
          pageIndex: list.pageIndex,
        });
      }
    }

    const items = elements.filter((e) => e.type === 'LI');
    for (const item of items) {
      const hasBody = item.children.some((c) => c.type === 'LBody');
      if (!hasBody) {
        issues.push({
          severity: 'warning',
          code: 'LI_NO_BODY',
          message: 'LI element has no LBody child',
          element: item,
          pageIndex: item.pageIndex,
        });
      }
    }
  }
}

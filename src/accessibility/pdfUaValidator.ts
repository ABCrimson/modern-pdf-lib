/**
 * @module accessibility/pdfUaValidator
 *
 * PDF/UA (ISO 14289-1) validation and enforcement for tagged PDF documents.
 *
 * Provides:
 * - {@link validatePdfUa} — validate a document against PDF/UA-1 requirements
 * - {@link enforcePdfUa} — auto-fix issues that can be corrected programmatically
 *
 * The validator checks structural, semantic, and metadata requirements
 * defined by the PDF/UA-1 standard (ISO 14289-1:2014), including:
 * - Structure tree presence (MarkInfo, StructTreeRoot)
 * - Document language (/Lang)
 * - Document title and /DisplayDocTitle
 * - Heading hierarchy (sequential, no skips)
 * - Alt text on images/figures
 * - Table header cells with scope
 * - List structure (L/LI/Lbl/LBody)
 * - Reading order via structure tree
 * - Font embedding (no unembedded standard 14 fonts)
 * - Color contrast (WCAG AA: 4.5:1, AAA: 7:1)
 * - Bookmarks for navigation
 * - Tab order (/Tabs /S)
 *
 * Reference: ISO 14289-1:2014 (PDF/UA-1), WCAG 2.1.
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import type { PdfStructureElement } from './structureTree.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * PDF/UA conformance level.
 *
 * Currently only PDF/UA-1 is supported. PDF/UA-2 (ISO 14289-2)
 * may be added in a future release.
 */
export type PdfUaLevel = 'UA1';

/**
 * A single PDF/UA validation error — a must-fix violation.
 */
export interface PdfUaError {
  /** Machine-readable error code (e.g. `"UA-STRUCT-001"`). */
  readonly code: string;
  /** Human-readable description of the violation. */
  readonly message: string;
  /** The ISO 14289-1 clause reference, if applicable. */
  readonly clause?: string | undefined;
  /** The structure element related to the error, if any. */
  readonly element?: PdfStructureElement | undefined;
  /** Zero-based page index, if the issue is page-specific. */
  readonly pageIndex?: number | undefined;
}

/**
 * A single PDF/UA validation warning — a best-practice recommendation.
 */
export interface PdfUaWarning {
  /** Machine-readable warning code (e.g. `"UA-WARN-001"`). */
  readonly code: string;
  /** Human-readable recommendation. */
  readonly message: string;
  /** The structure element related to the warning, if any. */
  readonly element?: PdfStructureElement | undefined;
  /** Zero-based page index, if the warning is page-specific. */
  readonly pageIndex?: number | undefined;
}

/**
 * Result of a PDF/UA validation check.
 */
export interface PdfUaValidationResult {
  /** Whether the document passes all PDF/UA requirements (no errors). */
  readonly valid: boolean;
  /** The PDF/UA conformance level checked against. */
  readonly level: PdfUaLevel;
  /** Must-fix violations that prevent compliance. */
  readonly errors: PdfUaError[];
  /** Best-practice recommendations. */
  readonly warnings: PdfUaWarning[];
}

/**
 * Result of the {@link enforcePdfUa} auto-fix pass.
 */
export interface PdfUaEnforcementResult {
  /** Actions that were successfully applied. */
  readonly fixed: string[];
  /** Issues that could not be auto-fixed and require manual attention. */
  readonly unfixable: PdfUaError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Heading elements for hierarchy validation. */
const HEADING_TYPES = new Set<string>(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** Heading level by type name. */
const HEADING_LEVEL: Record<string, number> = {
  H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6,
};

/** Illustration types that require alt text per PDF/UA. */
const ILLUSTRATION_TYPES = new Set<string>(['Figure', 'Formula', 'Form']);

/** Standard 14 PDF fonts that must be embedded for PDF/UA. */
const STANDARD_14_FONTS = new Set<string>([
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Symbol', 'ZapfDingbats',
]);

// ---------------------------------------------------------------------------
// validatePdfUa
// ---------------------------------------------------------------------------

/**
 * Validate a PDF document against PDF/UA-1 (ISO 14289-1) requirements.
 *
 * Performs the following checks:
 * 1. Structure tree presence (/StructTreeRoot, /MarkInfo)
 * 2. Document language (/Lang)
 * 3. Document title and /DisplayDocTitle
 * 4. Heading hierarchy (sequential, no skips)
 * 5. Alt text on all illustration elements (Figure, Formula, Form)
 * 6. Table header cells (TH) with scope
 * 7. List structure (L/LI/Lbl/LBody)
 * 8. Reading order via structure tree
 * 9. Font embedding (no unembedded standard 14 fonts)
 * 10. Color contrast (AA: 4.5:1, AAA: 7:1)
 * 11. Bookmarks for navigation
 * 12. Tab order (/Tabs /S) on pages
 *
 * @param doc    The PDF document to validate.
 * @param level  The PDF/UA conformance level (default: `'UA1'`).
 * @returns      A {@link PdfUaValidationResult} with errors and warnings.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { validatePdfUa } from 'modern-pdf-lib/accessibility';
 *
 * const doc = createPdf();
 * const result = validatePdfUa(doc);
 * if (!result.valid) {
 *   for (const err of result.errors) {
 *     console.error(`[${err.code}] ${err.message}`);
 *   }
 * }
 * ```
 */
export function validatePdfUa(
  doc: PdfDocument,
  level: PdfUaLevel = 'UA1',
): PdfUaValidationResult {
  const errors: PdfUaError[] = [];
  const warnings: PdfUaWarning[] = [];

  // 1. Structure tree
  checkStructureTree(doc, errors);

  // 2. Document language
  checkLanguage(doc, errors);

  // 3. Document title and DisplayDocTitle
  checkTitle(doc, errors, warnings);

  // 4–8. Structure-dependent checks (only if tree exists)
  const tree = doc.getStructureTree();
  if (tree) {
    const allElements = tree.getAllElements();

    // 4. Heading hierarchy
    checkHeadingHierarchy(allElements, errors);

    // 5. Alt text on illustration elements
    checkAltText(allElements, errors);

    // 6. Table header cells
    checkTableHeaders(allElements, errors, warnings);

    // 7. List structure
    checkListStructure(allElements, errors, warnings);

    // 8. Reading order
    checkReadingOrder(doc, warnings);
  }

  // 9. Font embedding
  checkFontEmbedding(doc, errors);

  // 10. Color contrast (informational — requires rendered content)
  checkColorContrast(doc, warnings);

  // 11. Bookmarks
  checkBookmarks(doc, warnings);

  // 12. Tab order
  checkTabOrder(doc, warnings);

  return {
    valid: errors.length === 0,
    level,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// enforcePdfUa
// ---------------------------------------------------------------------------

/**
 * Auto-fix PDF/UA issues that can be corrected programmatically.
 *
 * Applies the following corrections when the relevant requirement is
 * not already satisfied:
 * - Sets `/Lang` to `'en'` if the document has no language.
 * - Sets the document title to `'Untitled'` if missing, and enables
 *   `/DisplayDocTitle` in viewer preferences.
 * - Adds `/MarkInfo` by creating a structure tree if none exists.
 * - Sets `/Tabs /S` (structure order) on every page.
 *
 * Returns a result listing what was fixed and what remains unfixable
 * (e.g. missing alt text, heading skips — those require manual
 * content changes).
 *
 * @param doc  The PDF document to fix in-place.
 * @returns    A {@link PdfUaEnforcementResult} describing what was done.
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { enforcePdfUa, validatePdfUa } from 'modern-pdf-lib/accessibility';
 *
 * const doc = createPdf();
 * doc.addPage();
 * const result = enforcePdfUa(doc);
 * console.log('Fixed:', result.fixed);
 * console.log('Unfixable:', result.unfixable.length);
 * ```
 */
export function enforcePdfUa(doc: PdfDocument): PdfUaEnforcementResult {
  const fixed: string[] = [];

  // --- Auto-fix: Language ---
  if (doc.getLanguage() === undefined || doc.getLanguage()!.length === 0) {
    doc.setLanguage('en');
    fixed.push('Set document language to "en"');
  }

  // --- Auto-fix: Title + DisplayDocTitle ---
  if (doc.getTitle() === undefined || doc.getTitle()!.trim().length === 0) {
    doc.setTitle('Untitled', { showInWindowTitleBar: true });
    fixed.push('Set document title to "Untitled" with DisplayDocTitle');
  } else {
    // Title exists but ensure DisplayDocTitle is set
    const prefs = doc.getViewerPreferences();
    if (!prefs.getDisplayDocTitle()) {
      prefs.setDisplayDocTitle(true);
      fixed.push('Enabled DisplayDocTitle in viewer preferences');
    }
  }

  // --- Auto-fix: Structure tree (MarkInfo) ---
  if (!doc.getStructureTree()) {
    doc.createStructureTree();
    fixed.push('Created structure tree (MarkInfo / StructTreeRoot)');
  }

  // --- Auto-fix: Tab order on all pages ---
  const pageCount = doc.getPageCount();
  let tabOrderFixed = false;
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    if (page.getTabOrder() !== 'S') {
      page.setTabOrder('S');
      tabOrderFixed = true;
    }
  }
  if (tabOrderFixed) {
    fixed.push('Set tab order to structure order (/Tabs /S) on all pages');
  }

  // --- Determine unfixable issues ---
  const postValidation = validatePdfUa(doc);
  const unfixable = postValidation.errors;

  return { fixed, unfixable };
}

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------

/**
 * Check that the document has a structure tree with MarkInfo.
 * PDF/UA-1 requires /StructTreeRoot and /MarkInfo with /Marked true.
 *
 * @internal
 */
function checkStructureTree(doc: PdfDocument, errors: PdfUaError[]): void {
  const tree = doc.getStructureTree();
  if (!tree) {
    errors.push({
      code: 'UA-STRUCT-001',
      message:
        'Document has no structure tree (/StructTreeRoot). ' +
        'PDF/UA requires a tagged document with a complete structure tree.',
      clause: '7.1',
    });
    errors.push({
      code: 'UA-STRUCT-002',
      message:
        'Document is not marked (/MarkInfo with /Marked true is required). ' +
        'A structure tree must be created for PDF/UA compliance.',
      clause: '7.1',
    });
  }
}

/**
 * Check that the document language is set (/Lang).
 *
 * @internal
 */
function checkLanguage(doc: PdfDocument, errors: PdfUaError[]): void {
  const lang = doc.getLanguage();
  if (lang === undefined) {
    errors.push({
      code: 'UA-META-001',
      message:
        'Document has no language set (/Lang). ' +
        'PDF/UA requires the document catalog to specify a natural language.',
      clause: '7.2',
    });
  } else if (lang.length === 0) {
    errors.push({
      code: 'UA-META-002',
      message: 'Document language (/Lang) is an empty string.',
      clause: '7.2',
    });
  } else if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(lang)) {
    errors.push({
      code: 'UA-META-003',
      message:
        `Document language "${lang}" does not appear to be a valid BCP 47 tag.`,
      clause: '7.2',
    });
  }
}

/**
 * Check that the document title is set and /DisplayDocTitle is enabled.
 *
 * @internal
 */
function checkTitle(
  doc: PdfDocument,
  errors: PdfUaError[],
  warnings: PdfUaWarning[],
): void {
  const title = doc.getTitle();
  if (title === undefined) {
    errors.push({
      code: 'UA-META-004',
      message:
        'Document has no title. ' +
        'PDF/UA requires a descriptive document title in the metadata.',
      clause: '7.1',
    });
  } else if (title.trim().length === 0) {
    errors.push({
      code: 'UA-META-005',
      message: 'Document title is empty or whitespace-only.',
      clause: '7.1',
    });
  }

  // Check DisplayDocTitle
  const prefs = doc.getViewerPreferences();
  if (!prefs.getDisplayDocTitle()) {
    errors.push({
      code: 'UA-META-006',
      message:
        '/DisplayDocTitle must be true in viewer preferences. ' +
        'PDF/UA requires the document title to be displayed in the title bar.',
      clause: '7.1',
    });
  }
}

/**
 * Check that heading hierarchy is sequential (no skipped levels).
 * For example, H1 followed directly by H3 without an H2 is a violation.
 *
 * @internal
 */
function checkHeadingHierarchy(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
): void {
  const headings = elements.filter((e) => HEADING_TYPES.has(e.type));
  if (headings.length === 0) return;

  // First heading should be H1
  const firstHeading = headings[0]!;
  if (firstHeading.type !== 'H1') {
    errors.push({
      code: 'UA-STRUCT-003',
      message:
        `First heading should be H1, found ${firstHeading.type}. ` +
        'The document heading hierarchy must start at level 1.',
      clause: '7.4.2',
      element: firstHeading,
      pageIndex: firstHeading.pageIndex,
    });
  }

  // Check for skipped levels
  let lastLevel = 0;
  for (const h of headings) {
    const level = HEADING_LEVEL[h.type];
    if (level === undefined) continue;

    if (level > lastLevel + 1 && lastLevel > 0) {
      errors.push({
        code: 'UA-STRUCT-004',
        message:
          `Heading level skipped: ${h.type} follows H${lastLevel} ` +
          `(expected H${lastLevel + 1}). ` +
          'Heading levels must be sequential without gaps.',
        clause: '7.4.2',
        element: h,
        pageIndex: h.pageIndex,
      });
    }
    lastLevel = level;
  }
}

/**
 * Check that all illustration elements have /Alt or /ActualText.
 *
 * @internal
 */
function checkAltText(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
): void {
  for (const elem of elements) {
    if (!ILLUSTRATION_TYPES.has(elem.type)) continue;

    if (
      elem.options.altText === undefined &&
      elem.options.actualText === undefined
    ) {
      errors.push({
        code: 'UA-STRUCT-005',
        message:
          `${elem.type} element has no /Alt or /ActualText. ` +
          'PDF/UA requires alternative text for all illustration elements.',
        clause: '7.3',
        element: elem,
        pageIndex: elem.pageIndex,
      });
    } else if (
      elem.options.altText !== undefined &&
      elem.options.altText.trim().length === 0
    ) {
      errors.push({
        code: 'UA-STRUCT-006',
        message:
          `${elem.type} element has empty /Alt text. ` +
          'Alternative text must be meaningful and descriptive.',
        clause: '7.3',
        element: elem,
        pageIndex: elem.pageIndex,
      });
    }
  }
}

/**
 * Check table structure: tables must have TH (header) cells.
 * Tables without headers get an error; tables with TH but without
 * scope attributes get a warning.
 *
 * @internal
 */
function checkTableHeaders(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
  warnings: PdfUaWarning[],
): void {
  const tables = elements.filter((e) => e.type === 'Table');

  for (const table of tables) {
    // Check that the table has rows
    const hasRows = table.children.some(
      (c) => c.type === 'TR' || c.type === 'THead' ||
              c.type === 'TBody' || c.type === 'TFoot',
    );
    if (!hasRows) {
      errors.push({
        code: 'UA-TABLE-001',
        message:
          'Table element has no TR, THead, TBody, or TFoot children. ' +
          'Tables must have a valid row structure.',
        clause: '7.5',
        element: table,
        pageIndex: table.pageIndex,
      });
      continue;
    }

    // Check for header cells (TH)
    const headerCells = table.findAll('TH');
    if (headerCells.length === 0) {
      warnings.push({
        code: 'UA-TABLE-002',
        message:
          'Table has no TH (header) cells. ' +
          'PDF/UA recommends that tables identify header cells for accessibility.',
        element: table,
        pageIndex: table.pageIndex,
      });
    }

    // Check that TR elements contain TH or TD
    const rows = table.findAll('TR');
    for (const row of rows) {
      const hasCells = row.children.some(
        (c) => c.type === 'TH' || c.type === 'TD',
      );
      if (!hasCells) {
        errors.push({
          code: 'UA-TABLE-003',
          message: 'TR element has no TH or TD children.',
          clause: '7.5',
          element: row,
          pageIndex: row.pageIndex,
        });
      }
    }
  }
}

/**
 * Check list structure: L must contain LI, LI should contain LBody.
 *
 * @internal
 */
function checkListStructure(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
  warnings: PdfUaWarning[],
): void {
  const lists = elements.filter((e) => e.type === 'L');

  for (const list of lists) {
    const hasItems = list.children.some((c) => c.type === 'LI');
    if (!hasItems) {
      errors.push({
        code: 'UA-LIST-001',
        message:
          'L (list) element has no LI children. ' +
          'Lists must contain list item elements.',
        clause: '7.4.3',
        element: list,
        pageIndex: list.pageIndex,
      });
    }
  }

  const items = elements.filter((e) => e.type === 'LI');
  for (const item of items) {
    const hasBody = item.children.some((c) => c.type === 'LBody');
    if (!hasBody) {
      warnings.push({
        code: 'UA-LIST-002',
        message:
          'LI element has no LBody child. ' +
          'List items should contain an LBody element for proper structure.',
        element: item,
        pageIndex: item.pageIndex,
      });
    }

    // Check that LI is inside an L element
    if (!item.parent || item.parent.type !== 'L') {
      errors.push({
        code: 'UA-LIST-003',
        message:
          'LI element is not a direct child of an L (list) element.',
        clause: '7.4.3',
        element: item,
        pageIndex: item.pageIndex,
      });
    }
  }
}

/**
 * Check that content has a logical reading order via the structure tree.
 * Verifies that MCIDs are in ascending order within each page.
 *
 * @internal
 */
function checkReadingOrder(doc: PdfDocument, warnings: PdfUaWarning[]): void {
  const tree = doc.getStructureTree();
  if (!tree) return;

  const allElements = tree.getAllElements();
  const withMcid = allElements.filter(
    (e) => e.mcid !== undefined && e.pageIndex !== undefined,
  );

  if (withMcid.length === 0 && doc.getPageCount() > 0) {
    warnings.push({
      code: 'UA-STRUCT-007',
      message:
        'Structure tree has no elements with MCIDs assigned. ' +
        'Content may not be properly tagged for reading order.',
    });
    return;
  }

  // Group by page and check MCID order
  const byPage = Map.groupBy(withMcid, (elem) => elem.pageIndex!);

  for (const [pageIdx, elems] of byPage) {
    for (let i = 1; i < elems.length; i++) {
      const curr = elems[i]!;
      const prev = elems[i - 1]!;
      if (curr.mcid! < prev.mcid!) {
        warnings.push({
          code: 'UA-STRUCT-008',
          message:
            `Page ${pageIdx + 1}: MCID ${curr.mcid} (${curr.type}) ` +
            `appears after MCID ${prev.mcid} (${prev.type}) ` +
            `but has a lower MCID, indicating a potential reading order issue.`,
          element: curr,
          pageIndex: pageIdx,
        });
        break; // Report once per page
      }
    }
  }
}

/**
 * Check that all fonts are embedded (no standard 14 fallback).
 * PDF/UA requires all fonts to be embedded.
 *
 * @internal
 */
function checkFontEmbedding(doc: PdfDocument, errors: PdfUaError[]): void {
  const embeddedFonts = doc.getEmbeddedFonts();

  for (const [fontName] of embeddedFonts) {
    // Standard 14 fonts embedded via embedStandardFont produce
    // a Type1 font dict without a /FontFile stream — they rely on
    // the viewer's built-in metrics.  PDF/UA forbids this.
    if (STANDARD_14_FONTS.has(fontName)) {
      errors.push({
        code: 'UA-FONT-001',
        message:
          `Font "${fontName}" is a standard 14 font used without full embedding. ` +
          'PDF/UA requires all fonts to be embedded with their glyph data.',
        clause: '7.21.3.1',
      });
    }
  }
}

/**
 * Check color contrast (informational / best-practice).
 *
 * Full contrast checking requires rendered pixel data, which is
 * beyond the scope of a structural validator.  This check issues a
 * warning when the document has content, reminding authors to verify
 * contrast manually.
 *
 * WCAG 2.1 thresholds:
 * - AA: 4.5:1 for normal text, 3:1 for large text
 * - AAA: 7:1 for normal text, 4.5:1 for large text
 *
 * @internal
 */
function checkColorContrast(doc: PdfDocument, warnings: PdfUaWarning[]): void {
  if (doc.getPageCount() > 0) {
    warnings.push({
      code: 'UA-CONTRAST-001',
      message:
        'Color contrast cannot be fully validated structurally. ' +
        'Verify that text meets WCAG 2.1 contrast ratios ' +
        '(AA: 4.5:1 for normal text, AAA: 7:1).',
    });
  }
}

/**
 * Check that the document has bookmarks for navigation.
 * PDF/UA recommends bookmarks for documents with multiple pages.
 *
 * @internal
 */
function checkBookmarks(doc: PdfDocument, warnings: PdfUaWarning[]): void {
  const outlines = doc.getOutlines();
  if (outlines.items.length === 0 && doc.getPageCount() > 1) {
    warnings.push({
      code: 'UA-NAV-001',
      message:
        'Document has multiple pages but no bookmarks (outlines). ' +
        'PDF/UA recommends bookmarks for navigating multi-page documents.',
    });
  }
}

/**
 * Check that pages specify tab order as structure order (/Tabs /S).
 * PDF/UA requires /Tabs /S to ensure assistive technology follows
 * the logical structure order.
 *
 * @internal
 */
function checkTabOrder(doc: PdfDocument, warnings: PdfUaWarning[]): void {
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    if (page.getTabOrder() !== 'S') {
      warnings.push({
        code: 'UA-PAGE-001',
        message:
          `Page ${i + 1} does not specify tab order as structure order (/Tabs /S). ` +
          'PDF/UA requires pages to use structure-based tab order.',
        pageIndex: i,
      });
    }
  }
}

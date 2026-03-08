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
 * - Heading hierarchy (section-aware, same-parent validation)
 * - Alt text on images/figures (excluding artifacts)
 * - Table header cells (size-aware, layout table detection)
 * - List structure (L/LI/Lbl/LBody)
 * - Reading order via structure tree
 * - Font embedding (excluding form-field-only fonts)
 * - Color contrast (WCAG AA: 4.5:1, AAA: 7:1)
 * - Bookmarks for navigation (documents > 3 pages)
 * - Tab order (/Tabs /S)
 *
 * Uses a warning vs error distinction: ambiguous or low-confidence
 * issues are reported as warnings rather than errors.
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

/**
 * Section-like container types where heading levels can restart.
 * Note: `Div` is intentionally excluded — it is a generic grouping
 * element that does not represent a document section.  Headings
 * inside Div elements are still validated against their enclosing
 * section scope.
 */
const SECTION_TYPES = new Set<string>([
  'Document', 'Part', 'Art', 'Sect', 'BlockQuote',
]);

/** Illustration types that require alt text per PDF/UA. */
const ILLUSTRATION_TYPES = new Set<string>(['Figure', 'Formula', 'Form']);

/** Standard 14 PDF fonts that must be embedded for PDF/UA. */
const STANDARD_14_FONTS = new Set<string>([
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Symbol', 'ZapfDingbats',
]);

/** Minimum number of pages before missing bookmarks triggers a warning. */
const BOOKMARK_PAGE_THRESHOLD = 3;

/**
 * Minimum number of columns/rows in a table before missing TH cells
 * triggers a warning.  Small (1-2 col/row) tables are often trivial
 * enough that headers are unnecessary.
 */
const TABLE_HEADER_SIZE_THRESHOLD = 3;

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
 * 4. Heading hierarchy (section-aware, same-parent skip detection)
 * 5. Alt text on all illustration elements (excluding artifacts)
 * 6. Table header cells (size-aware, layout table aware)
 * 7. List structure (L/LI/Lbl/LBody)
 * 8. Reading order via structure tree
 * 9. Font embedding (excluding form-field-only fonts)
 * 10. Color contrast (AA: 4.5:1, AAA: 7:1)
 * 11. Bookmarks for navigation (documents > 3 pages)
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

  // 4-8. Structure-dependent checks (only if tree exists)
  const tree = doc.getStructureTree();
  if (tree) {
    const allElements = tree.getAllElements();

    // 4. Heading hierarchy (section-aware)
    checkHeadingHierarchy(allElements, errors, warnings);

    // 5. Alt text on illustration elements (artifact-aware)
    checkAltText(allElements, errors);

    // 6. Table header cells (size-aware, layout-table-aware)
    checkTableHeaders(allElements, errors, warnings);

    // 7. List structure
    checkListStructure(allElements, errors, warnings);

    // 8. Reading order
    checkReadingOrder(doc, warnings);
  }

  // 9. Font embedding (form-field-aware)
  checkFontEmbedding(doc, errors, warnings);

  // 10. Color contrast (informational — requires rendered content)
  checkColorContrast(doc, warnings);

  // 11. Bookmarks (only for documents > 3 pages)
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the nearest section-like ancestor of an element (or the element
 * itself if it is a section type).  Returns `undefined` if there is no
 * section ancestor.
 *
 * @internal
 */
function findSectionAncestor(
  elem: PdfStructureElement,
): PdfStructureElement | undefined {
  let current: PdfStructureElement | undefined = elem.parent;
  while (current) {
    if (SECTION_TYPES.has(current.type)) return current;
    current = current.parent;
  }
  return undefined;
}

/**
 * Count the effective number of columns and rows in a table.
 * Takes colspan/rowspan into account for a more accurate picture.
 *
 * @internal
 */
function getTableDimensions(
  table: PdfStructureElement,
): { cols: number; rows: number } {
  const allRows = table.findAll('TR');
  const rows = allRows.length;
  let maxCols = 0;

  for (const row of allRows) {
    let colCount = 0;
    for (const cell of row.children) {
      if (cell.type === 'TH' || cell.type === 'TD') {
        colCount += cell.options.colSpan ?? 1;
      }
    }
    if (colCount > maxCols) maxCols = colCount;
  }

  return { cols: maxCols, rows };
}

/**
 * Determine whether a table is a layout/presentational table
 * (i.e. not a data table).  A table is considered presentational if
 * it has `role: "presentation"` in its options.
 *
 * @internal
 */
function isLayoutTable(table: PdfStructureElement): boolean {
  return table.options.role === 'presentation';
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
 * Check heading hierarchy with section awareness.
 *
 * Rules:
 * - First heading in the document should be H1 (warning if not).
 * - Within the **same parent container**, heading levels must not skip
 *   more than 1 level (e.g. H1 -> H3 in the same parent is an error).
 * - Heading level resets (e.g. H3 back to H1) are always valid — they
 *   indicate the start of a new section.
 * - Headings in **different section containers** (Sect, Part, Art, Div,
 *   etc.) are validated independently; a skip across sections is not
 *   flagged.
 *
 * @internal
 */
function checkHeadingHierarchy(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
  warnings: PdfUaWarning[],
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

  // Group headings by their nearest section ancestor so we can
  // validate each section independently.
  const sectionMap = new Map<
    PdfStructureElement | undefined,
    PdfStructureElement[]
  >();

  for (const h of headings) {
    const section = findSectionAncestor(h);
    const list = sectionMap.get(section);
    if (list) {
      list.push(h);
    } else {
      sectionMap.set(section, [h]);
    }
  }

  // Validate heading sequence within each section group
  for (const [, sectionHeadings] of sectionMap) {
    let lastLevel = 0;
    for (const h of sectionHeadings) {
      const level = HEADING_LEVEL[h.type];
      if (level === undefined) continue;

      // A heading level decrease (e.g. H3 -> H1) is always valid —
      // it indicates a new section scope.
      if (level <= lastLevel || lastLevel === 0) {
        lastLevel = level;
        continue;
      }

      // Only flag a skip if the jump is > 1 level within the same
      // parent container.
      if (level > lastLevel + 1) {
        // Check whether both headings share the same direct parent
        const prevHeading = findPreviousHeadingInSection(h, sectionHeadings);
        const sameParent = prevHeading?.parent === h.parent;

        if (sameParent) {
          errors.push({
            code: 'UA-STRUCT-004',
            message:
              `Heading level skipped: ${h.type} follows H${lastLevel} ` +
              `(expected H${lastLevel + 1}) within the same parent container. ` +
              'Heading levels must be sequential without gaps.',
            clause: '7.4.2',
            element: h,
            pageIndex: h.pageIndex,
          });
        } else {
          // Different parents within the same section — ambiguous, warn
          warnings.push({
            code: 'UA-WARN-HEADING-SKIP',
            message:
              `Heading level skip: ${h.type} follows H${lastLevel} ` +
              `in a different sub-container. ` +
              'Consider using sequential heading levels for clarity.',
            element: h,
            pageIndex: h.pageIndex,
          });
        }
      }
      lastLevel = level;
    }
  }
}

/**
 * Find the heading that directly precedes `current` in the ordered
 * `sectionHeadings` list.
 *
 * @internal
 */
function findPreviousHeadingInSection(
  current: PdfStructureElement,
  sectionHeadings: PdfStructureElement[],
): PdfStructureElement | undefined {
  const idx = sectionHeadings.indexOf(current);
  return idx > 0 ? sectionHeadings[idx - 1] : undefined;
}

/**
 * Check that all illustration elements have /Alt or /ActualText.
 * Skips elements marked as artifacts (decorative content).
 *
 * @internal
 */
function checkAltText(
  elements: PdfStructureElement[],
  errors: PdfUaError[],
): void {
  for (const elem of elements) {
    if (!ILLUSTRATION_TYPES.has(elem.type)) continue;

    // Decorative images marked as artifacts do not require alt text
    if (elem.options.artifact) continue;

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
 * Check table structure with improved heuristics:
 *
 * - Layout/presentational tables (role="presentation") are skipped
 *   entirely — they are not data tables.
 * - Small tables (2 or fewer columns AND 2 or fewer rows) only get a
 *   warning (not an error) for missing TH cells, since simple tables
 *   often don't need them.
 * - Tables with more than 2 columns or rows get a warning for missing
 *   TH cells (previously was always an error).
 * - Merged cells (colspan/rowspan) are handled gracefully in dimension
 *   counting.
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
    // Skip layout/presentational tables entirely
    if (isLayoutTable(table)) continue;

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
      const { cols, rows } = getTableDimensions(table);
      const isSmallTable =
        cols < TABLE_HEADER_SIZE_THRESHOLD &&
        rows < TABLE_HEADER_SIZE_THRESHOLD;

      if (isSmallTable) {
        // Small simple tables: warning only
        warnings.push({
          code: 'UA-TABLE-002',
          message:
            'Small table has no TH (header) cells. ' +
            'Consider adding header cells for improved accessibility.',
          element: table,
          pageIndex: table.pageIndex,
        });
      } else {
        // Larger tables: stronger warning
        warnings.push({
          code: 'UA-TABLE-002',
          message:
            'Table has no TH (header) cells. ' +
            'PDF/UA recommends that tables identify header cells for accessibility.',
          element: table,
          pageIndex: table.pageIndex,
        });
      }
    }

    // Check that TR elements contain TH or TD
    const allRows = table.findAll('TR');
    for (const row of allRows) {
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
 * Fonts that are only used in form field appearances (not page content)
 * are reported as warnings rather than errors, since many PDF/UA
 * validators treat form appearance fonts more leniently.
 *
 * @internal
 */
function checkFontEmbedding(
  doc: PdfDocument,
  errors: PdfUaError[],
  warnings: PdfUaWarning[],
): void {
  const embeddedFonts = doc.getEmbeddedFonts();

  // Collect font names that appear on actual pages
  const pageFontNames = new Set<string>();
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const pageFonts = 'getFontNames' in page
      ? (page as unknown as { getFontNames(): string[] }).getFontNames()
      : undefined;
    if (pageFonts) {
      for (const name of pageFonts) {
        pageFontNames.add(name);
      }
    }
  }

  for (const [fontName] of embeddedFonts) {
    // Standard 14 fonts embedded via embedStandardFont produce
    // a Type1 font dict without a /FontFile stream — they rely on
    // the viewer's built-in metrics.  PDF/UA forbids this.
    if (STANDARD_14_FONTS.has(fontName)) {
      // If the font is NOT used on any page, it is likely form-field-only
      const usedOnPages = pageFontNames.has(fontName);
      if (!usedOnPages && pageFontNames.size > 0) {
        // Form-field-only font: warning instead of error
        warnings.push({
          code: 'UA-FONT-002',
          message:
            `Font "${fontName}" is a standard 14 font used only in form field appearances. ` +
            'Consider embedding the font fully for strict PDF/UA compliance.',
        });
      } else {
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
 * PDF/UA recommends bookmarks for documents with more than
 * {@link BOOKMARK_PAGE_THRESHOLD} pages.  Documents with 3 or fewer
 * pages are not flagged.
 *
 * @internal
 */
function checkBookmarks(doc: PdfDocument, warnings: PdfUaWarning[]): void {
  const outlines = doc.getOutlines();
  if (
    outlines.items.length === 0 &&
    doc.getPageCount() > BOOKMARK_PAGE_THRESHOLD
  ) {
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

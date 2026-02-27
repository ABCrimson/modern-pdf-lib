/**
 * @module accessibility/accessibilityChecker
 *
 * PDF/UA validation for tagged PDF documents.
 *
 * This module provides the {@link checkAccessibility} function, which
 * performs a series of checks against a PDF document and reports any
 * accessibility issues found.  The checks are based on the PDF/UA
 * (ISO 14289-1) standard and general accessibility best practices.
 *
 * Checks performed:
 * 1. Document has a structure tree (`/StructTreeRoot`)
 * 2. Document has a language (`/Lang`)
 * 3. Structure tree validation (heading hierarchy, table structure, etc.)
 * 4. All illustration elements (Figure, Formula, Form) have alt text
 * 5. Document title is set
 * 6. Tab order is set to structure order
 * 7. Content is tagged (document has structure elements with MCIDs)
 *
 * Reference: PDF/UA-1 (ISO 14289-1), WCAG 2.1.
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import type { AccessibilityIssue } from './structureTree.js';

// ---------------------------------------------------------------------------
// Accessibility check result
// ---------------------------------------------------------------------------

/**
 * Re-export the AccessibilityIssue type for convenience.
 */
export type { AccessibilityIssue } from './structureTree.js';

// ---------------------------------------------------------------------------
// Main check function
// ---------------------------------------------------------------------------

/**
 * Check a PDF document for accessibility issues.
 *
 * This function examines the document's structure tree, metadata, and
 * page content to identify potential accessibility problems.  It returns
 * an array of {@link AccessibilityIssue} objects, each describing a
 * specific issue with its severity, code, and human-readable message.
 *
 * @param doc  The PDF document to check.
 * @returns    An array of accessibility issues (empty if no issues found).
 *
 * @example
 * ```ts
 * import { createPdf } from 'modern-pdf-lib';
 * import { checkAccessibility } from 'modern-pdf-lib/accessibility';
 *
 * const doc = createPdf();
 * const issues = checkAccessibility(doc);
 * for (const issue of issues) {
 *   console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
 * }
 * ```
 */
export function checkAccessibility(doc: PdfDocument): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // 1. Check for structure tree
  checkStructureTree(doc, issues);

  // 2. Check for document language
  checkDocumentLanguage(doc, issues);

  // 3. Check document title
  checkDocumentTitle(doc, issues);

  // 4. If structure tree exists, validate it
  const tree = doc.getStructureTree();
  if (tree) {
    // Structure tree validation
    const treeIssues = tree.validate();
    issues.push(...treeIssues);

    // 5. Check that content is tagged (has MCIDs)
    checkContentIsTagged(doc, issues);

    // 6. Check reading order
    checkReadingOrder(doc, issues);
  }

  // 7. Check page count — empty documents are suspicious
  checkPageCount(doc, issues);

  return issues;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Check that the document has a `/StructTreeRoot` (required by PDF/UA).
 *
 * @internal
 */
function checkStructureTree(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  const tree = doc.getStructureTree();
  if (!tree) {
    issues.push({
      severity: 'error',
      code: 'NO_STRUCT_TREE',
      message:
        'Document has no structure tree (/StructTreeRoot). ' +
        'Tagged PDF requires a structure tree for accessibility.',
    });
  }
}

/**
 * Check that the document has a `/Lang` entry (required by PDF/UA).
 *
 * @internal
 */
function checkDocumentLanguage(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  const lang = doc.getLanguage();
  if (lang === undefined) {
    issues.push({
      severity: 'error',
      code: 'NO_LANG',
      message:
        'Document has no language set (/Lang). ' +
        'PDF/UA requires a document language for screen readers.',
    });
  } else if (lang.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_LANG',
      message: 'Document language is an empty string.',
    });
  } else if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(lang)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_LANG',
      message:
        `Document language "${lang}" does not appear to be a valid BCP 47 tag.`,
    });
  }
}

/**
 * Check that the document title is set (recommended by PDF/UA).
 *
 * @internal
 */
function checkDocumentTitle(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  const title = doc.getTitle();
  if (title === undefined) {
    issues.push({
      severity: 'warning',
      code: 'NO_TITLE',
      message:
        'Document has no title. Setting a descriptive title improves accessibility.',
    });
  } else if (title.trim().length === 0) {
    issues.push({
      severity: 'warning',
      code: 'EMPTY_TITLE',
      message: 'Document title is empty or whitespace-only.',
    });
  }
}

/**
 * Check that the document has tagged content (structure elements with
 * MCIDs assigned).
 *
 * @internal
 */
function checkContentIsTagged(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  const tree = doc.getStructureTree();
  if (!tree) return;

  const allElements = tree.getAllElements();
  const elementsWithMcid = allElements.filter((e) => e.mcid !== undefined);

  if (doc.getPageCount() > 0 && elementsWithMcid.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'NO_TAGGED_CONTENT',
      message:
        'Document has a structure tree but no elements have MCIDs assigned. ' +
        'Content may not be properly tagged.',
    });
  }

  // Check that all pages with content have at least one tagged element
  const pageCount = doc.getPageCount();
  const taggedPages = new Set<number>();
  for (const elem of elementsWithMcid) {
    if (elem.pageIndex !== undefined) {
      taggedPages.add(elem.pageIndex);
    }
  }

  for (let i = 0; i < pageCount; i++) {
    if (!taggedPages.has(i) && elementsWithMcid.length > 0) {
      issues.push({
        severity: 'info',
        code: 'UNTAGGED_PAGE',
        message: `Page ${i + 1} has no tagged content.`,
        pageIndex: i,
      });
    }
  }
}

/**
 * Check that the reading order appears logical.
 *
 * This is a basic check that ensures structure elements with MCIDs
 * are in ascending MCID order within each page (which typically
 * corresponds to reading order).
 *
 * @internal
 */
function checkReadingOrder(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  const tree = doc.getStructureTree();
  if (!tree) return;

  const allElements = tree.getAllElements();
  const elementsWithMcid = allElements.filter((e) => e.mcid !== undefined);

  // Group by page
  const withPage = elementsWithMcid.filter((e) => e.pageIndex !== undefined);
  const byPage = Map.groupBy(withPage, (elem) => elem.pageIndex!);

  // For each page, check that MCIDs are in ascending order
  for (const [pageIdx, elems] of byPage) {
    for (let i = 1; i < elems.length; i++) {
      const curr = elems[i]!;
      const prev = elems[i - 1]!;
      if (curr.mcid! < prev.mcid!) {
        issues.push({
          severity: 'info',
          code: 'READING_ORDER',
          message:
            `Page ${pageIdx + 1}: MCID ${curr.mcid} (${curr.type}) ` +
            `appears after MCID ${prev.mcid} (${prev.type}) ` +
            `but has a lower MCID, which may indicate reading order issues.`,
          pageIndex: pageIdx,
        });
        break; // Only report once per page
      }
    }
  }
}

/**
 * Check that the document has at least one page.
 *
 * @internal
 */
function checkPageCount(
  doc: PdfDocument,
  issues: AccessibilityIssue[],
): void {
  if (doc.getPageCount() === 0) {
    issues.push({
      severity: 'info',
      code: 'NO_PAGES',
      message: 'Document has no pages.',
    });
  }
}

// ---------------------------------------------------------------------------
// Summary helper
// ---------------------------------------------------------------------------

/**
 * Generate a summary of accessibility issues by severity.
 *
 * @param issues  The issues to summarize.
 * @returns       An object with counts per severity level.
 */
export function summarizeIssues(issues: readonly AccessibilityIssue[]): {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
} {
  const grouped = Object.groupBy(issues, (issue) => issue.severity);

  return {
    errors: grouped['error']?.length ?? 0,
    warnings: grouped['warning']?.length ?? 0,
    infos: grouped['info']?.length ?? 0,
    total: issues.length,
  };
}

/**
 * Check whether a set of issues contains any errors (severity = "error").
 *
 * @param issues  The issues to check.
 * @returns       `true` if there are no errors.
 */
export function isAccessible(issues: readonly AccessibilityIssue[]): boolean {
  return !issues.some((i) => i.severity === 'error');
}

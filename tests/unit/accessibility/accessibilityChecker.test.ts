/**
 * Tests for the accessibility checker.
 */

import { describe, it, expect } from 'vitest';
import {
  checkAccessibility,
  summarizeIssues,
  isAccessible,
} from '../../../src/accessibility/accessibilityChecker.js';
import type { AccessibilityIssue } from '../../../src/accessibility/structureTree.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// checkAccessibility
// ---------------------------------------------------------------------------

describe('checkAccessibility', () => {
  it('reports no structure tree on a blank document', () => {
    const doc = createPdf();
    const issues = checkAccessibility(doc);

    const noTree = issues.find((i) => i.code === 'NO_STRUCT_TREE');
    expect(noTree).toBeDefined();
    expect(noTree!.severity).toBe('error');
  });

  it('reports no language on a blank document', () => {
    const doc = createPdf();
    const issues = checkAccessibility(doc);

    const noLang = issues.find((i) => i.code === 'NO_LANG');
    expect(noLang).toBeDefined();
    expect(noLang!.severity).toBe('error');
  });

  it('reports no title', () => {
    const doc = createPdf();
    const issues = checkAccessibility(doc);

    const noTitle = issues.find((i) => i.code === 'NO_TITLE');
    expect(noTitle).toBeDefined();
    expect(noTitle!.severity).toBe('warning');
  });

  it('does not report missing title when title is set', () => {
    const doc = createPdf();
    doc.setTitle('My Document');
    const issues = checkAccessibility(doc);

    const noTitle = issues.find((i) => i.code === 'NO_TITLE');
    expect(noTitle).toBeUndefined();
  });

  it('reports empty title', () => {
    const doc = createPdf();
    doc.setTitle('   ');
    const issues = checkAccessibility(doc);

    const emptyTitle = issues.find((i) => i.code === 'EMPTY_TITLE');
    expect(emptyTitle).toBeDefined();
  });

  it('does not report missing language when language is set', () => {
    const doc = createPdf();
    doc.setLanguage('en-US');
    const issues = checkAccessibility(doc);

    const noLang = issues.find((i) => i.code === 'NO_LANG');
    expect(noLang).toBeUndefined();
  });

  it('reports empty language', () => {
    const doc = createPdf();
    doc.setLanguage('');
    const issues = checkAccessibility(doc);

    const emptyLang = issues.find((i) => i.code === 'EMPTY_LANG');
    expect(emptyLang).toBeDefined();
  });

  it('reports invalid language tag', () => {
    const doc = createPdf();
    doc.setLanguage('123');
    const issues = checkAccessibility(doc);

    const invalidLang = issues.find((i) => i.code === 'INVALID_LANG');
    expect(invalidLang).toBeDefined();
    expect(invalidLang!.severity).toBe('warning');
  });

  it('does not report missing structure tree when tree is created', () => {
    const doc = createPdf();
    doc.createStructureTree();
    const issues = checkAccessibility(doc);

    const noTree = issues.find((i) => i.code === 'NO_STRUCT_TREE');
    expect(noTree).toBeUndefined();
  });

  it('reports no tagged content when tree exists but has no MCIDs', () => {
    const doc = createPdf();
    doc.addPage();
    const tree = doc.createStructureTree();
    tree.addElement(null, 'P');
    // No MCIDs assigned

    const issues = checkAccessibility(doc);
    const noTagged = issues.find((i) => i.code === 'NO_TAGGED_CONTENT');
    expect(noTagged).toBeDefined();
  });

  it('does not report no tagged content when MCIDs are assigned', () => {
    const doc = createPdf();
    doc.addPage();
    const tree = doc.createStructureTree();
    const elem = tree.addElement(null, 'P');
    tree.assignMcid(elem, 0);

    const issues = checkAccessibility(doc);
    const noTagged = issues.find((i) => i.code === 'NO_TAGGED_CONTENT');
    expect(noTagged).toBeUndefined();
  });

  it('reports untagged pages', () => {
    const doc = createPdf();
    doc.addPage(); // page 0
    doc.addPage(); // page 1
    const tree = doc.createStructureTree();
    const elem = tree.addElement(null, 'P');
    tree.assignMcid(elem, 0); // only page 0 is tagged

    const issues = checkAccessibility(doc);
    const untaggedPage = issues.find((i) => i.code === 'UNTAGGED_PAGE');
    expect(untaggedPage).toBeDefined();
    expect(untaggedPage!.pageIndex).toBe(1);
  });

  it('reports no pages', () => {
    const doc = createPdf();
    const issues = checkAccessibility(doc);

    const noPages = issues.find((i) => i.code === 'NO_PAGES');
    expect(noPages).toBeDefined();
    expect(noPages!.severity).toBe('info');
  });

  it('structure tree validation issues are included', () => {
    const doc = createPdf();
    doc.addPage();
    const tree = doc.createStructureTree();
    // Add heading hierarchy issue: H1 then H3
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H3');

    const issues = checkAccessibility(doc);
    const headingSkip = issues.find((i) => i.code === 'HEADING_SKIP');
    expect(headingSkip).toBeDefined();
  });

  it('doc.checkAccessibility() delegates correctly', () => {
    const doc = createPdf();
    const issues = doc.checkAccessibility();

    // Should have at least the missing structure tree and language errors
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.code === 'NO_STRUCT_TREE')).toBe(true);
    expect(issues.some((i) => i.code === 'NO_LANG')).toBe(true);
  });

  it('fully accessible document has minimal issues', () => {
    const doc = createPdf();
    doc.setTitle('Accessible Document');
    doc.setLanguage('en');
    doc.addPage();

    const tree = doc.createStructureTree();
    const h1 = tree.addElement(null, 'H1');
    tree.assignMcid(h1, 0);
    const p = tree.addElement(null, 'P');
    tree.assignMcid(p, 0);

    const issues = doc.checkAccessibility();

    // Should have no errors
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// summarizeIssues
// ---------------------------------------------------------------------------

describe('summarizeIssues', () => {
  it('counts issues by severity', () => {
    const issues: AccessibilityIssue[] = [
      { severity: 'error', code: 'A', message: 'Error 1' },
      { severity: 'error', code: 'B', message: 'Error 2' },
      { severity: 'warning', code: 'C', message: 'Warning 1' },
      { severity: 'info', code: 'D', message: 'Info 1' },
    ];

    const summary = summarizeIssues(issues);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.infos).toBe(1);
    expect(summary.total).toBe(4);
  });

  it('handles empty issues array', () => {
    const summary = summarizeIssues([]);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.infos).toBe(0);
    expect(summary.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isAccessible
// ---------------------------------------------------------------------------

describe('isAccessible', () => {
  it('returns true when there are no errors', () => {
    const issues: AccessibilityIssue[] = [
      { severity: 'warning', code: 'W', message: 'Warning' },
      { severity: 'info', code: 'I', message: 'Info' },
    ];

    expect(isAccessible(issues)).toBe(true);
  });

  it('returns false when there are errors', () => {
    const issues: AccessibilityIssue[] = [
      { severity: 'error', code: 'E', message: 'Error' },
    ];

    expect(isAccessible(issues)).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(isAccessible([])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PdfDocument integration
// ---------------------------------------------------------------------------

describe('PdfDocument accessibility integration', () => {
  it('getStructureTree returns undefined initially', () => {
    const doc = createPdf();
    expect(doc.getStructureTree()).toBeUndefined();
  });

  it('createStructureTree creates and returns a tree', () => {
    const doc = createPdf();
    const tree = doc.createStructureTree();
    expect(tree).toBeDefined();
    expect(tree.root.type).toBe('Document');
  });

  it('createStructureTree is idempotent', () => {
    const doc = createPdf();
    const tree1 = doc.createStructureTree();
    const tree2 = doc.createStructureTree();
    expect(tree1).toBe(tree2);
  });

  it('getStructureTree returns the tree after creation', () => {
    const doc = createPdf();
    doc.createStructureTree();
    expect(doc.getStructureTree()).toBeDefined();
  });

  it('setLanguage and getLanguage work', () => {
    const doc = createPdf();
    expect(doc.getLanguage()).toBeUndefined();

    doc.setLanguage('en-US');
    expect(doc.getLanguage()).toBe('en-US');

    doc.setLanguage('de');
    expect(doc.getLanguage()).toBe('de');
  });
});

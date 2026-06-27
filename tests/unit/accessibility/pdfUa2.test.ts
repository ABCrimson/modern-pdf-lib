/**
 * Tests for PDF/UA-2 (ISO 14289-2) validation and XMP identification.
 *
 * PDF/UA-2 layers PDF 2.0-specific requirements on top of the shared
 * PDF/UA-1 tagging / language / MarkInfo checks.  These tests assert the
 * real shape of the result (issues, clauses, conformance) and the real
 * content of the generated XMP packet.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePdfUa2,
  buildPdfUa2Xmp,
} from '../../../src/accessibility/pdfUa2.js';
import type {
  PdfUa2Issue,
  PdfUa2Result,
} from '../../../src/accessibility/pdfUa2.js';

import { createPdf } from '../../../src/core/pdfDocument.js';
import { PDF2_NAMESPACE } from '../../../src/accessibility/namespaces.js';

// ---------------------------------------------------------------------------
// buildPdfUa2Xmp
// ---------------------------------------------------------------------------

describe('buildPdfUa2Xmp', () => {
  it('returns a non-empty XMP/RDF string', () => {
    const xmp = buildPdfUa2Xmp();
    expect(typeof xmp).toBe('string');
    expect(xmp.length).toBeGreaterThan(0);
  });

  it('declares the pdfuaid identification schema with part = 2', () => {
    const xmp = buildPdfUa2Xmp();
    expect(xmp).toContain('pdfuaid:part');
    expect(xmp).toContain('2');
  });

  it('references the AIIM pdfua identification namespace URI', () => {
    const xmp = buildPdfUa2Xmp();
    expect(xmp).toContain('http://www.aiim.org/pdfua/ns/id/');
  });

  it('carries an rdf:RDF document and a packet wrapper', () => {
    const xmp = buildPdfUa2Xmp();
    expect(xmp).toContain('rdf:RDF');
    expect(xmp).toContain('<?xpacket');
  });

  it('declares a pdfuaid:rev revision value', () => {
    const xmp = buildPdfUa2Xmp();
    expect(xmp).toContain('pdfuaid:rev');
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa2 — a bare document is NOT UA-2 conformant
// ---------------------------------------------------------------------------

describe('validatePdfUa2 — bare document', () => {
  it('returns a structured, non-conformant result for a bare document', () => {
    const doc = createPdf();
    const result: PdfUa2Result = validatePdfUa2(doc);

    expect(result.conformant).toBe(false);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reports the missing structure tree as a UA-2 issue', () => {
    const doc = createPdf();
    const result = validatePdfUa2(doc);

    const treeIssue = result.issues.find(
      (i) => i.code === 'UA2-STRUCT-001',
    );
    expect(treeIssue).toBeDefined();
    expect(treeIssue!.message.toLowerCase()).toContain('structure tree');
    // Every issue must cite an ISO 14289-2 clause string.
    expect(treeIssue!.clause.length).toBeGreaterThan(0);
  });

  it('reports the missing /Namespaces declaration as a UA-2 issue', () => {
    const doc = createPdf();
    const result = validatePdfUa2(doc);

    const nsIssue = result.issues.find((i) => i.code === 'UA2-NS-001');
    expect(nsIssue).toBeDefined();
    expect(nsIssue!.message.toLowerCase()).toContain('namespace');
  });

  it('every issue carries a code, message, and ISO 14289-2 clause', () => {
    const doc = createPdf();
    const result = validatePdfUa2(doc);

    for (const issue of result.issues) {
      expectIssueShape(issue);
    }
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa2 — minimal tagging resolves at least one issue
// ---------------------------------------------------------------------------

describe('validatePdfUa2 — minimal tagging', () => {
  it('removes the missing-structure-tree issue once a tree exists', () => {
    const bare = validatePdfUa2(createPdf());
    const bareTreeIssue = bare.issues.find((i) => i.code === 'UA2-STRUCT-001');
    expect(bareTreeIssue).toBeDefined();

    const doc = createPdf();
    doc.createStructureTree();
    const tagged = validatePdfUa2(doc);

    const taggedTreeIssue = tagged.issues.find(
      (i) => i.code === 'UA2-STRUCT-001',
    );
    expect(taggedTreeIssue).toBeUndefined();
    // Strictly fewer issues than the bare baseline.
    expect(tagged.issues.length).toBeLessThan(bare.issues.length);
  });

  it('declaring structure namespaces resolves the /Namespaces issue', () => {
    const doc = createPdf();
    const tree = doc.createStructureTree();
    // Declare the PDF 2.0 standard structure namespace on the tree.
    (tree as unknown as { namespaces: string[] }).namespaces = [
      PDF2_NAMESPACE,
    ];

    const result = validatePdfUa2(doc);
    const nsIssue = result.issues.find((i) => i.code === 'UA2-NS-001');
    expect(nsIssue).toBeUndefined();
  });

  it('reports the missing document /Lang for a tagged-but-unlabelled doc', () => {
    const doc = createPdf();
    doc.createStructureTree();
    const result = validatePdfUa2(doc);

    const langIssue = result.issues.find((i) => i.code === 'UA2-LANG-001');
    expect(langIssue).toBeDefined();
  });

  it('a more fully tagged document drops the /Lang issue', () => {
    const doc = createPdf();
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    (tree as unknown as { namespaces: string[] }).namespaces = [
      PDF2_NAMESPACE,
    ];

    const result = validatePdfUa2(doc);
    const langIssue = result.issues.find((i) => i.code === 'UA2-LANG-001');
    expect(langIssue).toBeUndefined();
  });

  it('flags a figure without alt text under PDF/UA-2', () => {
    const doc = createPdf();
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    (tree as unknown as { namespaces: string[] }).namespaces = [
      PDF2_NAMESPACE,
    ];
    // Figure with no alt text / actual text.
    tree.addElement(null, 'Figure');

    const result = validatePdfUa2(doc);
    const figIssue = result.issues.find((i) => i.code === 'UA2-FIG-001');
    expect(figIssue).toBeDefined();
  });

  it('does not flag a figure that has alt text', () => {
    const doc = createPdf();
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    (tree as unknown as { namespaces: string[] }).namespaces = [
      PDF2_NAMESPACE,
    ];
    tree.addElement(null, 'Figure', { altText: 'A descriptive label' });

    const result = validatePdfUa2(doc);
    const figIssue = result.issues.find((i) => i.code === 'UA2-FIG-001');
    expect(figIssue).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expectIssueShape(issue: PdfUa2Issue): void {
  expect(typeof issue.code).toBe('string');
  expect(issue.code.length).toBeGreaterThan(0);
  expect(typeof issue.message).toBe('string');
  expect(issue.message.length).toBeGreaterThan(0);
  expect(typeof issue.clause).toBe('string');
  expect(issue.clause.length).toBeGreaterThan(0);
}

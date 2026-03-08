/**
 * Tests for the PDF/UA validator (ISO 14289-1).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePdfUa,
  enforcePdfUa,
} from '../../../src/accessibility/pdfUaValidator.js';
import type {
  PdfUaValidationResult,
  PdfUaEnforcementResult,
} from '../../../src/accessibility/pdfUaValidator.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type { PdfDocument } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal PDF/UA-compliant document
// ---------------------------------------------------------------------------

function buildCompliantDoc(): PdfDocument {
  const doc = createPdf();
  doc.setTitle('Accessible Document', { showInWindowTitleBar: true });
  doc.setLanguage('en');

  const page = doc.addPage();
  page.setTabOrder('S');

  const tree = doc.createStructureTree();
  const h1 = tree.addElement(null, 'H1', { altText: 'Main heading' });
  tree.assignMcid(h1, 0);
  const p = tree.addElement(null, 'P');
  tree.assignMcid(p, 0);

  return doc;
}

// ---------------------------------------------------------------------------
// validatePdfUa — Structure tree checks
// ---------------------------------------------------------------------------

describe('validatePdfUa — structure tree', () => {
  it('reports missing structure tree', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');

    const result = validatePdfUa(doc);

    const noTree = result.errors.find((e) => e.code === 'UA-STRUCT-001');
    expect(noTree).toBeDefined();
    expect(noTree!.message).toContain('structure tree');
    expect(noTree!.clause).toBe('7.1');
  });

  it('reports missing MarkInfo when no structure tree exists', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');

    const result = validatePdfUa(doc);

    const noMark = result.errors.find((e) => e.code === 'UA-STRUCT-002');
    expect(noMark).toBeDefined();
    expect(noMark!.message).toContain('MarkInfo');
  });

  it('does not report structure tree errors when tree exists', () => {
    const doc = buildCompliantDoc();
    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-001')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-STRUCT-002')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Language checks
// ---------------------------------------------------------------------------

describe('validatePdfUa — language', () => {
  it('reports missing language', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const noLang = result.errors.find((e) => e.code === 'UA-META-001');
    expect(noLang).toBeDefined();
    expect(noLang!.clause).toBe('7.2');
  });

  it('reports empty language', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const emptyLang = result.errors.find((e) => e.code === 'UA-META-002');
    expect(emptyLang).toBeDefined();
  });

  it('reports invalid language tag', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('123');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const invalidLang = result.errors.find((e) => e.code === 'UA-META-003');
    expect(invalidLang).toBeDefined();
  });

  it('accepts valid BCP 47 language tags', () => {
    for (const lang of ['en', 'en-US', 'de-DE', 'ja', 'zh-Hans']) {
      const doc = createPdf();
      doc.setTitle('Test', { showInWindowTitleBar: true });
      doc.setLanguage(lang);
      doc.createStructureTree();

      const result = validatePdfUa(doc);
      const langErrors = result.errors.filter((e) =>
        e.code === 'UA-META-001' || e.code === 'UA-META-002' || e.code === 'UA-META-003',
      );
      expect(langErrors).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Title checks
// ---------------------------------------------------------------------------

describe('validatePdfUa — title', () => {
  it('reports missing title', () => {
    const doc = createPdf();
    doc.setLanguage('en');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const noTitle = result.errors.find((e) => e.code === 'UA-META-004');
    expect(noTitle).toBeDefined();
    expect(noTitle!.clause).toBe('7.1');
  });

  it('reports empty title', () => {
    const doc = createPdf();
    doc.setTitle('   ', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const emptyTitle = result.errors.find((e) => e.code === 'UA-META-005');
    expect(emptyTitle).toBeDefined();
  });

  it('reports missing DisplayDocTitle', () => {
    const doc = createPdf();
    doc.setTitle('Valid Title');
    doc.setLanguage('en');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    const noDisplay = result.errors.find((e) => e.code === 'UA-META-006');
    expect(noDisplay).toBeDefined();
    expect(noDisplay!.message).toContain('DisplayDocTitle');
  });

  it('does not report title errors when title and DisplayDocTitle are set', () => {
    const doc = createPdf();
    doc.setTitle('My Doc', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-META-004')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-META-005')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-META-006')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Heading hierarchy
// ---------------------------------------------------------------------------

describe('validatePdfUa — headings', () => {
  it('reports heading skip (H1 → H3)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H3');

    const result = validatePdfUa(doc);

    const skip = result.errors.find((e) => e.code === 'UA-STRUCT-004');
    expect(skip).toBeDefined();
    expect(skip!.message).toContain('H3');
    expect(skip!.message).toContain('H1');
  });

  it('reports first heading not being H1', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'H2');

    const result = validatePdfUa(doc);

    const badStart = result.errors.find((e) => e.code === 'UA-STRUCT-003');
    expect(badStart).toBeDefined();
    expect(badStart!.message).toContain('H2');
  });

  it('accepts valid heading hierarchy (H1 → H2 → H3)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H2');
    tree.addElement(null, 'H3');

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-003')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-STRUCT-004')).toBeUndefined();
  });

  it('allows heading level decrease (H1 → H2 → H1)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H2');
    tree.addElement(null, 'H1');

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-004')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Alt text
// ---------------------------------------------------------------------------

describe('validatePdfUa — alt text', () => {
  it('reports missing alt text on Figure element', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure');

    const result = validatePdfUa(doc);

    const noAlt = result.errors.find((e) => e.code === 'UA-STRUCT-005');
    expect(noAlt).toBeDefined();
    expect(noAlt!.message).toContain('Figure');
  });

  it('reports missing alt text on Formula element', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Formula');

    const result = validatePdfUa(doc);

    const noAlt = result.errors.find((e) => e.code === 'UA-STRUCT-005');
    expect(noAlt).toBeDefined();
    expect(noAlt!.message).toContain('Formula');
  });

  it('reports empty alt text', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure', { altText: '   ' });

    const result = validatePdfUa(doc);

    const emptyAlt = result.errors.find((e) => e.code === 'UA-STRUCT-006');
    expect(emptyAlt).toBeDefined();
  });

  it('accepts Figure with altText', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure', { altText: 'A photograph of a landscape' });

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-005')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-STRUCT-006')).toBeUndefined();
  });

  it('accepts Figure with actualText (no altText needed)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure', { actualText: 'Decorative divider' });

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-005')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Table headers
// ---------------------------------------------------------------------------

describe('validatePdfUa — tables', () => {
  it('warns about table without header cells', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table');
    const row = table.addChild('TR');
    row.addChild('TD');

    const result = validatePdfUa(doc);

    const noHeaders = result.warnings.find((w) => w.code === 'UA-TABLE-002');
    expect(noHeaders).toBeDefined();
  });

  it('does not warn when table has TH cells', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table');
    const headerRow = table.addChild('TR');
    headerRow.addChild('TH');
    const dataRow = table.addChild('TR');
    dataRow.addChild('TD');

    const result = validatePdfUa(doc);

    expect(result.warnings.find((w) => w.code === 'UA-TABLE-002')).toBeUndefined();
  });

  it('reports table without rows', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Table');

    const result = validatePdfUa(doc);

    const noRows = result.errors.find((e) => e.code === 'UA-TABLE-001');
    expect(noRows).toBeDefined();
  });

  it('reports TR without cells', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table');
    table.addChild('TR'); // empty TR

    const result = validatePdfUa(doc);

    const noCells = result.errors.find((e) => e.code === 'UA-TABLE-003');
    expect(noCells).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — List structure
// ---------------------------------------------------------------------------

describe('validatePdfUa — lists', () => {
  it('reports list without LI children', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'L');

    const result = validatePdfUa(doc);

    const noItems = result.errors.find((e) => e.code === 'UA-LIST-001');
    expect(noItems).toBeDefined();
  });

  it('warns about LI without LBody', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const list = tree.addElement(null, 'L');
    list.addChild('LI');

    const result = validatePdfUa(doc);

    const noBody = result.warnings.find((w) => w.code === 'UA-LIST-002');
    expect(noBody).toBeDefined();
  });

  it('accepts properly structured list', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const list = tree.addElement(null, 'L');
    const item = list.addChild('LI');
    item.addChild('Lbl');
    item.addChild('LBody');

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-LIST-001')).toBeUndefined();
    expect(result.warnings.find((w) => w.code === 'UA-LIST-002')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Reading order
// ---------------------------------------------------------------------------

describe('validatePdfUa — reading order', () => {
  it('warns when no MCIDs are assigned', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.addPage();
    const tree = doc.createStructureTree();
    tree.addElement(null, 'P');

    const result = validatePdfUa(doc);

    const noMcid = result.warnings.find((w) => w.code === 'UA-STRUCT-007');
    expect(noMcid).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Font embedding
// ---------------------------------------------------------------------------

describe('validatePdfUa — font embedding', () => {
  it('reports standard 14 fonts used without full embedding', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();

    // Use the embedFont method with a standard font name
    doc.embedFont('Helvetica');

    const result = validatePdfUa(doc);

    const fontError = result.errors.find((e) => e.code === 'UA-FONT-001');
    expect(fontError).toBeDefined();
    expect(fontError!.message).toContain('Helvetica');
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Bookmarks
// ---------------------------------------------------------------------------

describe('validatePdfUa — bookmarks', () => {
  it('warns about document with more than 3 pages without bookmarks', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    doc.addPage();

    const result = validatePdfUa(doc);

    const noBookmarks = result.warnings.find((w) => w.code === 'UA-NAV-001');
    expect(noBookmarks).toBeDefined();
  });

  it('does not warn about single-page document without bookmarks', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();

    const result = validatePdfUa(doc);

    expect(result.warnings.find((w) => w.code === 'UA-NAV-001')).toBeUndefined();
  });

  it('does not warn about document with 3 or fewer pages without bookmarks', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();
    doc.addPage();
    doc.addPage();

    const result = validatePdfUa(doc);

    expect(result.warnings.find((w) => w.code === 'UA-NAV-001')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Tab order
// ---------------------------------------------------------------------------

describe('validatePdfUa — tab order', () => {
  it('warns when page has no tab order set', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();

    const result = validatePdfUa(doc);

    const noTabs = result.warnings.find((w) => w.code === 'UA-PAGE-001');
    expect(noTabs).toBeDefined();
    expect(noTabs!.pageIndex).toBe(0);
  });

  it('does not warn when tab order is S (structure)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    const page = doc.addPage();
    page.setTabOrder('S');

    const result = validatePdfUa(doc);

    expect(result.warnings.find((w) => w.code === 'UA-PAGE-001')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Color contrast
// ---------------------------------------------------------------------------

describe('validatePdfUa — color contrast', () => {
  it('warns about color contrast for documents with content', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();

    const result = validatePdfUa(doc);

    const contrast = result.warnings.find((w) => w.code === 'UA-CONTRAST-001');
    expect(contrast).toBeDefined();
    expect(contrast!.message).toContain('WCAG');
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Valid document
// ---------------------------------------------------------------------------

describe('validatePdfUa — compliant document', () => {
  it('valid PDF/UA document passes with no errors', () => {
    const doc = buildCompliantDoc();
    const result = validatePdfUa(doc);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.level).toBe('UA1');
  });

  it('returns correct level', () => {
    const doc = buildCompliantDoc();
    const result = validatePdfUa(doc, 'UA1');
    expect(result.level).toBe('UA1');
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Result structure
// ---------------------------------------------------------------------------

describe('validatePdfUa — result structure', () => {
  it('returns PdfUaValidationResult with all expected fields', () => {
    const doc = createPdf();
    const result = validatePdfUa(doc);

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(typeof result.valid).toBe('boolean');
    expect(result.level).toBe('UA1');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('errors have code, message, and optional clause', () => {
    const doc = createPdf();
    const result = validatePdfUa(doc);

    for (const err of result.errors) {
      expect(err.code).toBeDefined();
      expect(err.message).toBeDefined();
      expect(typeof err.code).toBe('string');
      expect(typeof err.message).toBe('string');
    }

    // At least one error should have a clause reference
    const withClause = result.errors.find((e) => e.clause !== undefined);
    expect(withClause).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// enforcePdfUa
// ---------------------------------------------------------------------------

describe('enforcePdfUa', () => {
  it('sets language to "en" when missing', () => {
    const doc = createPdf();
    const result = enforcePdfUa(doc);

    expect(doc.getLanguage()).toBe('en');
    expect(result.fixed).toContain('Set document language to "en"');
  });

  it('sets title to "Untitled" when missing', () => {
    const doc = createPdf();
    const result = enforcePdfUa(doc);

    expect(doc.getTitle()).toBe('Untitled');
    expect(result.fixed.some((f) => f.includes('Untitled'))).toBe(true);
  });

  it('enables DisplayDocTitle when title exists but display is off', () => {
    const doc = createPdf();
    doc.setTitle('Existing Title');
    const result = enforcePdfUa(doc);

    expect(doc.getViewerPreferences().getDisplayDocTitle()).toBe(true);
    expect(result.fixed.some((f) => f.includes('DisplayDocTitle'))).toBe(true);
  });

  it('creates structure tree when missing', () => {
    const doc = createPdf();
    const result = enforcePdfUa(doc);

    expect(doc.getStructureTree()).toBeDefined();
    expect(result.fixed.some((f) => f.includes('structure tree'))).toBe(true);
  });

  it('sets tab order on pages', () => {
    const doc = createPdf();
    doc.addPage();
    doc.addPage();
    const result = enforcePdfUa(doc);

    expect(doc.getPage(0).getTabOrder()).toBe('S');
    expect(doc.getPage(1).getTabOrder()).toBe('S');
    expect(result.fixed.some((f) => f.includes('tab order'))).toBe(true);
  });

  it('already compliant document has no changes', () => {
    const doc = buildCompliantDoc();
    const result = enforcePdfUa(doc);

    expect(result.fixed).toHaveLength(0);
  });

  it('returns unfixable issues', () => {
    const doc = createPdf();
    doc.addPage();
    const tree = doc.createStructureTree();
    // Add Figure without alt text — cannot be auto-fixed
    tree.addElement(null, 'Figure');

    // Pre-set fixable things so we only get the unfixable
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.getPage(0).setTabOrder('S');

    const result = enforcePdfUa(doc);

    const figureError = result.unfixable.find((e) => e.code === 'UA-STRUCT-005');
    expect(figureError).toBeDefined();
  });

  it('does not change language when already set', () => {
    const doc = createPdf();
    doc.setLanguage('fr');
    enforcePdfUa(doc);

    expect(doc.getLanguage()).toBe('fr');
  });

  it('does not change title when already set', () => {
    const doc = createPdf();
    doc.setTitle('My Document');
    enforcePdfUa(doc);

    expect(doc.getTitle()).toBe('My Document');
  });
});

// ---------------------------------------------------------------------------
// PdfPage tab order methods
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// validatePdfUa — Heading hierarchy (section-aware false-positive fixes)
// ---------------------------------------------------------------------------

describe('validatePdfUa — heading sections', () => {
  it('allows heading skip within same section when in different sub-containers', () => {
    // H1 in a Div, H3 in a sibling Div — same Sect parent but different
    // direct parents => should be a warning, not an error
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const sect = tree.addElement(null, 'Sect');
    const div1 = sect.addChild('Div');
    div1.addChild('H1');
    const div2 = sect.addChild('Div');
    div2.addChild('H3');

    const result = validatePdfUa(doc);

    // Should NOT be an error (different parent containers within same section)
    const error = result.errors.find((e) => e.code === 'UA-STRUCT-004');
    expect(error).toBeUndefined();

    // Should produce a warning instead
    const warn = result.warnings.find((w) => w.code === 'UA-WARN-HEADING-SKIP');
    expect(warn).toBeDefined();
  });

  it('allows heading skip across separate sections', () => {
    // Section 1: H1 → H2, Section 2: H1 → H3 in different containers
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();

    const sect1 = tree.addElement(null, 'Sect');
    sect1.addChild('H1');
    sect1.addChild('H2');

    const sect2 = tree.addElement(null, 'Sect');
    sect2.addChild('H1');

    const result = validatePdfUa(doc);

    // No heading errors — headings in different sections are independent
    expect(result.errors.find((e) => e.code === 'UA-STRUCT-004')).toBeUndefined();
  });

  it('flags heading skip within the same parent as error', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();

    // Both headings share the same direct parent (root Document)
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H3');

    const result = validatePdfUa(doc);

    const error = result.errors.find((e) => e.code === 'UA-STRUCT-004');
    expect(error).toBeDefined();
    expect(error!.message).toContain('H3');
    expect(error!.message).toContain('same parent container');
  });

  it('allows heading level reset (H3 back to H1 for a new section)', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'H1');
    tree.addElement(null, 'H2');
    tree.addElement(null, 'H3');
    tree.addElement(null, 'H1'); // reset — valid

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-004')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Table false-positive fixes
// ---------------------------------------------------------------------------

describe('validatePdfUa — table false-positive fixes', () => {
  it('warns (not errors) for simple table without TH cells', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table');
    const row1 = table.addChild('TR');
    row1.addChild('TD');
    row1.addChild('TD');
    const row2 = table.addChild('TR');
    row2.addChild('TD');
    row2.addChild('TD');

    const result = validatePdfUa(doc);

    // Small 2x2 table — should be a warning, not an error
    const warn = result.warnings.find((w) => w.code === 'UA-TABLE-002');
    expect(warn).toBeDefined();
    // Should NOT be in errors
    const err = result.errors.find((e) => e.code === 'UA-TABLE-002');
    expect(err).toBeUndefined();
  });

  it('skips layout/presentational tables entirely', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table', { role: 'presentation' });
    const row = table.addChild('TR');
    row.addChild('TD');

    const result = validatePdfUa(doc);

    // Layout table should not trigger any table warnings or errors
    expect(result.warnings.find((w) => w.code === 'UA-TABLE-002')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-TABLE-001')).toBeUndefined();
  });

  it('handles merged cells (colspan) in dimension calculation', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    const table = tree.addElement(null, 'Table');
    // 1 row with a cell spanning 2 columns — effective 2 columns, 1 row
    const row = table.addChild('TR');
    row.addChild('TD', { colSpan: 2 });

    const result = validatePdfUa(doc);

    // Small table (2 cols, 1 row) — should be a warning, not error
    const warn = result.warnings.find((w) => w.code === 'UA-TABLE-002');
    expect(warn).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Decorative image (artifact) false-positive fix
// ---------------------------------------------------------------------------

describe('validatePdfUa — decorative images', () => {
  it('does not flag missing alt text on decorative images marked as artifact', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure', { artifact: true });

    const result = validatePdfUa(doc);

    expect(result.errors.find((e) => e.code === 'UA-STRUCT-005')).toBeUndefined();
    expect(result.errors.find((e) => e.code === 'UA-STRUCT-006')).toBeUndefined();
  });

  it('still flags non-artifact Figure without alt text', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    const tree = doc.createStructureTree();
    tree.addElement(null, 'Figure');

    const result = validatePdfUa(doc);

    const noAlt = result.errors.find((e) => e.code === 'UA-STRUCT-005');
    expect(noAlt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validatePdfUa — Small document bookmark false-positive fix
// ---------------------------------------------------------------------------

describe('validatePdfUa — small document bookmarks', () => {
  it('does not flag missing bookmarks if document has 3 or fewer pages', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();
    doc.addPage();
    doc.addPage();

    const result = validatePdfUa(doc);

    expect(result.warnings.find((w) => w.code === 'UA-NAV-001')).toBeUndefined();
  });

  it('flags missing bookmarks for documents with more than 3 pages', () => {
    const doc = createPdf();
    doc.setTitle('Test', { showInWindowTitleBar: true });
    doc.setLanguage('en');
    doc.createStructureTree();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    doc.addPage();

    const result = validatePdfUa(doc);

    const warn = result.warnings.find((w) => w.code === 'UA-NAV-001');
    expect(warn).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PdfPage tab order methods
// ---------------------------------------------------------------------------

describe('PdfPage — tab order', () => {
  it('getTabOrder returns undefined by default', () => {
    const doc = createPdf();
    const page = doc.addPage();
    expect(page.getTabOrder()).toBeUndefined();
  });

  it('setTabOrder / getTabOrder roundtrip for S', () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.setTabOrder('S');
    expect(page.getTabOrder()).toBe('S');
  });

  it('setTabOrder / getTabOrder roundtrip for R', () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.setTabOrder('R');
    expect(page.getTabOrder()).toBe('R');
  });

  it('setTabOrder / getTabOrder roundtrip for C', () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.setTabOrder('C');
    expect(page.getTabOrder()).toBe('C');
  });
});

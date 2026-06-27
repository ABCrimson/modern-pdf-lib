/**
 * Tests for the high-level tagging helpers in
 * src/accessibility/taggingHelpers.ts.
 *
 * These helpers wrap PdfStructureTree.addElement with ergonomic,
 * type-safe functions for building common tagged-PDF structures
 * (headings, paragraphs, figures, links, lists, tables).
 *
 * Tests assert the *real* structure: returned element types,
 * parent/child relationships, and recorded options/attributes.
 */

import { describe, it, expect } from 'vitest';
import { PdfStructureTree } from '../../../src/accessibility/structureTree.js';
import {
  tagHeading,
  tagParagraph,
  tagFigure,
  tagLink,
  tagList,
  tagListItem,
  tagTable,
  tagTableRow,
  tagTableHeaderCell,
  tagTableDataCell,
  LIST_NUMBERING_KEY,
} from '../../../src/accessibility/taggingHelpers.js';
import type { ListNumbering } from '../../../src/accessibility/taggingHelpers.js';

// ---------------------------------------------------------------------------
// tagHeading
// ---------------------------------------------------------------------------

describe('tagHeading', () => {
  it('creates an H1 element at the root when parent is null', () => {
    const tree = new PdfStructureTree();
    const h = tagHeading(tree, null, 1);
    expect(h.type).toBe('H1');
    expect(h.parent).toBe(tree.root);
    expect(tree.root.children).toContain(h);
  });

  it('creates H2..H6 elements for the corresponding level', () => {
    const tree = new PdfStructureTree();
    expect(tagHeading(tree, null, 2).type).toBe('H2');
    expect(tagHeading(tree, null, 3).type).toBe('H3');
    expect(tagHeading(tree, null, 4).type).toBe('H4');
    expect(tagHeading(tree, null, 5).type).toBe('H5');
    expect(tagHeading(tree, null, 6).type).toBe('H6');
  });

  it('nests the heading under a provided parent', () => {
    const tree = new PdfStructureTree();
    const sect = tree.addElement(null, 'Sect');
    const h = tagHeading(tree, sect, 2);
    expect(h.type).toBe('H2');
    expect(h.parent).toBe(sect);
    expect(sect.children).toContain(h);
  });

  it('forwards options (title, language) to the element', () => {
    const tree = new PdfStructureTree();
    const h = tagHeading(tree, null, 1, {
      title: 'Introduction',
      language: 'en-US',
    });
    expect(h.options.title).toBe('Introduction');
    expect(h.options.language).toBe('en-US');
  });
});

// ---------------------------------------------------------------------------
// tagParagraph
// ---------------------------------------------------------------------------

describe('tagParagraph', () => {
  it('creates a P element', () => {
    const tree = new PdfStructureTree();
    const p = tagParagraph(tree, null);
    expect(p.type).toBe('P');
    expect(p.parent).toBe(tree.root);
  });

  it('nests under a parent and forwards options', () => {
    const tree = new PdfStructureTree();
    const sect = tree.addElement(null, 'Sect');
    const p = tagParagraph(tree, sect, { language: 'fr' });
    expect(p.parent).toBe(sect);
    expect(p.options.language).toBe('fr');
  });
});

// ---------------------------------------------------------------------------
// tagFigure
// ---------------------------------------------------------------------------

describe('tagFigure', () => {
  it('creates a Figure element with alt text', () => {
    const tree = new PdfStructureTree();
    const fig = tagFigure(tree, null, 'A bar chart of sales');
    expect(fig.type).toBe('Figure');
    expect(fig.options.altText).toBe('A bar chart of sales');
  });

  it('merges alt text with additional options', () => {
    const tree = new PdfStructureTree();
    const fig = tagFigure(tree, null, 'A cat', {
      title: 'Photo',
      actualText: 'cat',
    });
    expect(fig.options.altText).toBe('A cat');
    expect(fig.options.title).toBe('Photo');
    expect(fig.options.actualText).toBe('cat');
  });

  it('lets an explicit altText option win over the positional argument', () => {
    const tree = new PdfStructureTree();
    const fig = tagFigure(tree, null, 'positional', {
      altText: 'explicit',
    });
    expect(fig.options.altText).toBe('explicit');
  });

  it('produces a Figure that passes alt-text validation', () => {
    const tree = new PdfStructureTree();
    tagFigure(tree, null, 'A meaningful description');
    const issues = tree.validate();
    expect(issues.some((i) => i.code === 'FIGURE_NO_ALT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tagLink
// ---------------------------------------------------------------------------

describe('tagLink', () => {
  it('creates a Link element', () => {
    const tree = new PdfStructureTree();
    const link = tagLink(tree, null);
    expect(link.type).toBe('Link');
    expect(link.parent).toBe(tree.root);
  });

  it('forwards options', () => {
    const tree = new PdfStructureTree();
    const p = tagParagraph(tree, null);
    const link = tagLink(tree, p, { actualText: 'Visit example.com' });
    expect(link.parent).toBe(p);
    expect(link.options.actualText).toBe('Visit example.com');
  });
});

// ---------------------------------------------------------------------------
// tagList / tagListItem
// ---------------------------------------------------------------------------

describe('tagList', () => {
  it('creates an L element', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null);
    expect(list.type).toBe('L');
    expect(list.parent).toBe(tree.root);
  });

  it('records the list numbering on the element options', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null, 'Decimal');
    const numbering = (list.options as Record<string, unknown>)[
      LIST_NUMBERING_KEY
    ] as ListNumbering | undefined;
    expect(numbering).toBe('Decimal');
  });

  it('defaults numbering to None when not specified', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null);
    const numbering = (list.options as Record<string, unknown>)[
      LIST_NUMBERING_KEY
    ] as ListNumbering | undefined;
    expect(numbering).toBe('None');
  });

  it('supports all ListNumbering values', () => {
    const tree = new PdfStructureTree();
    const values: ListNumbering[] = [
      'None', 'Disc', 'Circle', 'Square',
      'Decimal', 'UpperRoman', 'LowerRoman',
      'UpperAlpha', 'LowerAlpha',
    ];
    for (const v of values) {
      const list = tagList(tree, null, v);
      const numbering = (list.options as Record<string, unknown>)[
        LIST_NUMBERING_KEY
      ] as ListNumbering | undefined;
      expect(numbering).toBe(v);
    }
  });
});

describe('tagListItem', () => {
  it('builds L > LI > (Lbl, LBody)', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null, 'Disc');
    const { item, label, body } = tagListItem(tree, list);

    // LI is a child of L
    expect(item.type).toBe('LI');
    expect(item.parent).toBe(list);
    expect(list.children).toContain(item);

    // Lbl and LBody are children of LI
    expect(label.type).toBe('Lbl');
    expect(body.type).toBe('LBody');
    expect(label.parent).toBe(item);
    expect(body.parent).toBe(item);
    expect(item.children).toContain(label);
    expect(item.children).toContain(body);

    // Lbl comes before LBody
    expect(item.children.indexOf(label)).toBeLessThan(
      item.children.indexOf(body),
    );
  });

  it('forwards options to the LI element', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null);
    const { item } = tagListItem(tree, list, { language: 'de' });
    expect(item.options.language).toBe('de');
  });

  it('produces a list structure that passes list validation', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null, 'Decimal');
    tagListItem(tree, list);
    tagListItem(tree, list);
    const issues = tree.validate();
    expect(issues.some((i) => i.code === 'LIST_NO_ITEMS')).toBe(false);
    expect(issues.some((i) => i.code === 'LI_NO_BODY')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tagTable / tagTableRow / tagTableHeaderCell / tagTableDataCell
// ---------------------------------------------------------------------------

describe('tagTable', () => {
  it('creates a Table element', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    expect(table.type).toBe('Table');
    expect(table.parent).toBe(tree.root);
  });
});

describe('tagTableRow', () => {
  it('creates a TR as a child of the table', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    expect(row.type).toBe('TR');
    expect(row.parent).toBe(table);
    expect(table.children).toContain(row);
  });
});

describe('tagTableHeaderCell', () => {
  it('creates a TH with Column scope', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const th = tagTableHeaderCell(tree, row, 'Column');
    expect(th.type).toBe('TH');
    expect(th.parent).toBe(row);
    expect(th.options.scope).toBe('Column');
  });

  it('creates a TH with Row scope', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const th = tagTableHeaderCell(tree, row, 'Row');
    expect(th.options.scope).toBe('Row');
  });

  it('defaults scope to Column when omitted', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const th = tagTableHeaderCell(tree, row);
    expect(th.options.scope).toBe('Column');
  });

  it('forwards additional options', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const th = tagTableHeaderCell(tree, row, 'Both', { colSpan: 2 });
    expect(th.options.scope).toBe('Both');
    expect(th.options.colSpan).toBe(2);
  });
});

describe('tagTableDataCell', () => {
  it('creates a TD as a child of the row', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const td = tagTableDataCell(tree, row);
    expect(td.type).toBe('TD');
    expect(td.parent).toBe(row);
    expect(row.children).toContain(td);
  });

  it('forwards options (rowSpan)', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);
    const row = tagTableRow(tree, table);
    const td = tagTableDataCell(tree, row, { rowSpan: 3 });
    expect(td.options.rowSpan).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: build a complete table and inspect the tree
// ---------------------------------------------------------------------------

describe('end-to-end table construction', () => {
  it('builds Table > TR > (TH, TD) and reflects the real tree', () => {
    const tree = new PdfStructureTree();
    const table = tagTable(tree, null);

    const headerRow = tagTableRow(tree, table);
    const th1 = tagTableHeaderCell(tree, headerRow, 'Column');
    const th2 = tagTableHeaderCell(tree, headerRow, 'Column');

    const dataRow = tagTableRow(tree, table);
    const td1 = tagTableDataCell(tree, dataRow);
    const td2 = tagTableDataCell(tree, dataRow);

    // Real tree shape
    expect(table.children).toEqual([headerRow, dataRow]);
    expect(headerRow.children).toEqual([th1, th2]);
    expect(dataRow.children).toEqual([td1, td2]);

    // Scopes recorded
    expect(th1.options.scope).toBe('Column');
    expect(th2.options.scope).toBe('Column');

    // findAll on the tree resolves the cells
    expect(table.findAll('TH')).toHaveLength(2);
    expect(table.findAll('TD')).toHaveLength(2);
    expect(table.findAll('TR')).toHaveLength(2);
  });

  it('builds a list and inspects the full L > LI > Lbl/LBody tree', () => {
    const tree = new PdfStructureTree();
    const list = tagList(tree, null, 'UpperRoman');
    const li1 = tagListItem(tree, list);
    const li2 = tagListItem(tree, list);

    expect(list.findAll('LI')).toHaveLength(2);
    expect(list.findAll('Lbl')).toHaveLength(2);
    expect(list.findAll('LBody')).toHaveLength(2);

    expect(li1.item.children.map((c) => c.type)).toEqual(['Lbl', 'LBody']);
    expect(li2.item.children.map((c) => c.type)).toEqual(['Lbl', 'LBody']);
  });
});

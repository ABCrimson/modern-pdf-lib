/**
 * Tests for the table layout engine.
 *
 * Covers renderTable(), column/row sizing, cell rendering, borders,
 * text alignment, backgrounds, padding, and the PdfPage.drawTable()
 * integration.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
  TableRow,
  TableRenderResult,
  NestedTableContent,
} from '../../src/layout/table.js';
import { PdfPage, PageSizes } from '../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../src/core/pdfObjects.js';
import type { Color } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(): PdfPage {
  const registry = new PdfObjectRegistry();
  return new PdfPage(PageSizes.A4[0], PageSizes.A4[1], registry);
}

function simpleTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [
      { cells: ['A', 'B', 'C'] },
      { cells: ['D', 'E', 'F'] },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderTable', () => {
  // 1
  it('returns ops string and result', () => {
    const { ops, result } = renderTable(simpleTable());
    expect(typeof ops).toBe('string');
    expect(ops.length).toBeGreaterThan(0);
    expect(result).toBeDefined();
  });

  // 2
  it('result has correct width', () => {
    const { result } = renderTable(simpleTable({ width: 400 }));
    expect(result.width).toBe(400);
  });

  // 3
  it('result has rowHeights array matching row count', () => {
    const { result } = renderTable(simpleTable());
    expect(result.rowHeights).toHaveLength(2);
    for (const h of result.rowHeights) {
      expect(h).toBeGreaterThan(0);
    }
  });

  // 4
  it('result has equal columnWidths by default', () => {
    const { result } = renderTable(simpleTable({ width: 300 }));
    expect(result.columnWidths).toHaveLength(3);
    expect(result.columnWidths[0]).toBeCloseTo(100, 5);
    expect(result.columnWidths[1]).toBeCloseTo(100, 5);
    expect(result.columnWidths[2]).toBeCloseTo(100, 5);
  });

  // 5
  it('custom column widths work', () => {
    const { result } = renderTable(
      simpleTable({
        width: 500,
        columns: [{ width: 100 }, { width: 200 }, { width: 200 }],
      }),
    );
    expect(result.columnWidths[0]).toBe(100);
    expect(result.columnWidths[1]).toBe(200);
    expect(result.columnWidths[2]).toBe(200);
  });

  // 6
  it('fixed + flex column widths distribute remaining space', () => {
    const { result } = renderTable(
      simpleTable({
        width: 500,
        columns: [{ width: 100 }, {}, {}],
      }),
    );
    expect(result.columnWidths[0]).toBe(100);
    // remaining 400 split between 2 flex columns = 200 each
    expect(result.columnWidths[1]).toBeCloseTo(200, 5);
    expect(result.columnWidths[2]).toBeCloseTo(200, 5);
  });

  // 7
  it('row backgrounds render fill operators', () => {
    const bg: Color = { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: ['A', 'B', 'C'], backgroundColor: bg },
          { cells: ['D', 'E', 'F'] },
        ],
      }),
    );
    // Should contain an RGB fill color operator for the row background
    expect(ops).toContain('0.9 0.9 0.9 rg');
    // Should contain a fill (f) operator
    expect(ops).toContain('f\n');
  });

  // 8
  it('cell backgrounds render fill operators', () => {
    const bg: Color = { type: 'rgb', r: 1, g: 0, b: 0 };
    const cell: TableCell = { content: 'Red', backgroundColor: bg };
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: [cell, 'B', 'C'] }],
      }),
    );
    expect(ops).toContain('1 0 0 rg');
  });

  // 9
  it('cell text renders with BT/ET and Tj', () => {
    const { ops } = renderTable(simpleTable());
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
  });

  // 10
  it('border rendering emits stroke operators', () => {
    const { ops } = renderTable(simpleTable({ borderWidth: 1 }));
    // Should set line width
    expect(ops).toContain('1 w\n');
    // Should contain stroke operator
    expect(ops).toContain('S\n');
    // Should contain rectangle operator for borders
    expect(ops).toContain('re\n');
  });

  // 11
  it('custom font size is used in text operators', () => {
    const { ops } = renderTable(simpleTable({ fontSize: 18 }));
    // Should contain Tf operator with size 18
    expect(ops).toContain('18 Tf\n');
  });

  // 12
  it('custom border width is set', () => {
    const { ops } = renderTable(simpleTable({ borderWidth: 2 }));
    expect(ops).toContain('2 w\n');
  });

  // 13
  it('custom padding affects row height', () => {
    const { result: r1 } = renderTable(simpleTable({ padding: 4 }));
    const { result: r2 } = renderTable(simpleTable({ padding: 20 }));
    // Larger padding => taller rows
    expect(r2.rowHeights[0]!).toBeGreaterThan(r1.rowHeights[0]!);
  });

  // 14
  it('string cells normalize correctly', () => {
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: ['Hello', 'World'] }],
      }),
    );
    expect(ops).toContain('(Hello) Tj');
    expect(ops).toContain('(World) Tj');
  });

  // 15
  it('empty cells handle gracefully', () => {
    const { ops, result } = renderTable(
      simpleTable({
        rows: [{ cells: ['', '', ''] }],
      }),
    );
    // Should still render without errors
    expect(typeof ops).toBe('string');
    expect(result.rowHeights).toHaveLength(1);
    // Empty string content should NOT produce any Tj operator
    expect(ops).not.toContain('Tj');
  });

  // 16
  it('single row / single column table works', () => {
    const { ops, result } = renderTable({
      x: 0,
      y: 100,
      width: 200,
      rows: [{ cells: ['Only'] }],
    });
    expect(result.rowHeights).toHaveLength(1);
    expect(result.columnWidths).toHaveLength(1);
    expect(result.columnWidths[0]).toBe(200);
    expect(ops).toContain('(Only) Tj');
  });

  // 17
  it('multi-row table has correct total height', () => {
    const { result } = renderTable(
      simpleTable({
        rows: [
          { cells: ['A'], height: 30 },
          { cells: ['B'], height: 40 },
          { cells: ['C'], height: 50 },
        ],
      }),
    );
    expect(result.height).toBe(120); // 30 + 40 + 50
  });

  // 18
  it('zero border width emits no stroke', () => {
    const { ops } = renderTable(simpleTable({ borderWidth: 0 }));
    // No stroke operator for borders
    expect(ops).not.toContain('S\n');
  });

  // 19
  it('grayscale border color works', () => {
    const { ops } = renderTable(
      simpleTable({
        borderColor: { type: 'grayscale', gray: 0.5 },
      }),
    );
    expect(ops).toContain('0.5 G\n');
  });

  // 20
  it('cmyk text color works', () => {
    const cell: TableCell = {
      content: 'CMYK',
      textColor: { type: 'cmyk', c: 1, m: 0, y: 0, k: 0 },
    };
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: [cell] }],
      }),
    );
    expect(ops).toContain('1 0 0 0 k\n');
  });

  // 21
  it('center alignment adjusts text x position', () => {
    const cell: TableCell = { content: 'Hi', align: 'center' };
    const { ops: centeredOps } = renderTable(
      simpleTable({
        rows: [{ cells: [cell] }],
      }),
    );
    const { ops: leftOps } = renderTable(
      simpleTable({
        rows: [{ cells: ['Hi'] }],
      }),
    );
    // The text position should differ between centered and left-aligned
    // Extract Td coordinates
    const tdPattern = /(\S+) (\S+) Td/g;
    const centeredMatch = tdPattern.exec(centeredOps);
    tdPattern.lastIndex = 0;
    const leftMatch = tdPattern.exec(leftOps);
    expect(centeredMatch).not.toBeNull();
    expect(leftMatch).not.toBeNull();
    // Centered X should differ from left-aligned X
    expect(centeredMatch![1]).not.toBe(leftMatch![1]);
  });

  // 22
  it('right alignment adjusts text x position', () => {
    const cell: TableCell = { content: 'Hi', align: 'right' };
    const { ops: rightOps } = renderTable(
      simpleTable({
        rows: [{ cells: [cell] }],
      }),
    );
    const { ops: leftOps } = renderTable(
      simpleTable({
        rows: [{ cells: ['Hi'] }],
      }),
    );
    const tdPattern = /(\S+) (\S+) Td/g;
    const rightMatch = tdPattern.exec(rightOps);
    tdPattern.lastIndex = 0;
    const leftMatch = tdPattern.exec(leftOps);
    expect(rightMatch).not.toBeNull();
    expect(leftMatch).not.toBeNull();
    expect(rightMatch![1]).not.toBe(leftMatch![1]);
  });

  // 23
  it('custom font name is used', () => {
    const { ops } = renderTable(simpleTable({ fontName: 'Courier' }));
    expect(ops).toContain('/Courier');
  });

  // 24
  it('per-cell font size overrides table default', () => {
    const cell: TableCell = { content: 'Big', fontSize: 24 };
    const { ops } = renderTable(
      simpleTable({
        fontSize: 12,
        rows: [{ cells: [cell, 'Normal'] }],
      }),
    );
    expect(ops).toContain('24 Tf\n');
    expect(ops).toContain('12 Tf\n');
  });

  // 25
  it('ops are wrapped in save/restore state', () => {
    const { ops } = renderTable(simpleTable());
    expect(ops.startsWith('q\n')).toBe(true);
    expect(ops.endsWith('Q\n')).toBe(true);
  });

  // 26
  it('pagesUsed is always 1 for basic rendering', () => {
    const { result } = renderTable(simpleTable());
    expect(result.pagesUsed).toBe(1);
  });

  // 27
  it('per-cell padding overrides table default', () => {
    const cell: TableCell = {
      content: 'Padded',
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
    };
    const { result } = renderTable(
      simpleTable({
        padding: 4,
        rows: [{ cells: [cell] }],
      }),
    );
    // Row height with 20 padding should be larger than default
    expect(result.rowHeights[0]!).toBeGreaterThanOrEqual(20 + 20 + 12);
  });

  // 28
  it('explicit row height is used', () => {
    const { result } = renderTable(
      simpleTable({
        rows: [
          { cells: ['A', 'B', 'C'], height: 50 },
          { cells: ['D', 'E', 'F'], height: 80 },
        ],
      }),
    );
    expect(result.rowHeights[0]).toBe(50);
    expect(result.rowHeights[1]).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Task 46 — Row/Column Spanning
// ---------------------------------------------------------------------------

describe('renderTable – colspan / rowspan', () => {
  // 31
  it('colSpan cell gets combined width of spanned columns', () => {
    const cell: TableCell = { content: 'Wide', colSpan: 2 };
    const { ops } = renderTable({
      x: 0,
      y: 100,
      width: 300,
      rows: [{ cells: [cell, 'C'] }],
      columns: [{ width: 100 }, { width: 100 }, { width: 100 }],
    });
    // The "Wide" cell should span 200pt (columns 0+1).
    // Its border rectangle should be 200pt wide: "0 <y> 200 <h> re"
    expect(ops).toContain('200 ');
    expect(ops).toContain('(Wide) Tj');
  });

  // 32
  it('rowSpan cell gets combined height of spanned rows', () => {
    const cell: TableCell = { content: 'Tall', rowSpan: 2 };
    const { ops, result } = renderTable({
      x: 0,
      y: 100,
      width: 200,
      rows: [
        { cells: [cell, 'B'], height: 25 },
        { cells: ['D'], height: 25 },
      ],
    });
    // "Tall" spans 2 rows of 25pt each = 50pt total height.
    // Its border rectangle should contain height 50.
    expect(ops).toContain(' 50 re');
    expect(ops).toContain('(Tall) Tj');
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(D) Tj');
    expect(result.height).toBe(50);
  });

  // 33
  it('mixed colspan + rowspan in same table', () => {
    // Layout (3 cols x 3 rows):
    //   [A (cs=2)      ] [B]
    //   [C (rs=2)] [D]   [E]
    //              [F]   [G]
    const cellA: TableCell = { content: 'A', colSpan: 2 };
    const cellC: TableCell = { content: 'C', rowSpan: 2 };
    const { ops, result } = renderTable({
      x: 0,
      y: 300,
      width: 300,
      rows: [
        { cells: [cellA, 'B'] },
        { cells: [cellC, 'D', 'E'] },
        { cells: ['F', 'G'] },
      ],
    });
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(C) Tj');
    expect(ops).toContain('(D) Tj');
    expect(ops).toContain('(E) Tj');
    expect(ops).toContain('(F) Tj');
    expect(ops).toContain('(G) Tj');
    expect(result.rowHeights).toHaveLength(3);
  });

  // 34
  it('rowSpan cell is rendered only once (at origin row)', () => {
    const cell: TableCell = { content: 'Once', rowSpan: 2 };
    const { ops } = renderTable({
      x: 0,
      y: 100,
      width: 200,
      rows: [
        { cells: [cell, 'R0C1'], height: 20 },
        { cells: ['R1C1'], height: 20 },
      ],
    });
    // "Once" should appear exactly once in the ops
    const matches = ops.match(/\(Once\) Tj/g);
    expect(matches).toHaveLength(1);
  });

  // 35
  it('colSpan cell border covers full spanned width', () => {
    const cell: TableCell = { content: 'Span3', colSpan: 3 };
    const { ops } = renderTable({
      x: 10,
      y: 100,
      width: 300,
      rows: [{ cells: [cell] }],
      borderWidth: 1,
    });
    // Cell spans entire 300pt width; border rect should be "10 <y> 300 <h> re"
    expect(ops).toContain('300 ');
    expect(ops).toContain('(Span3) Tj');
  });
});

// ---------------------------------------------------------------------------
// Task 48 — Cell Backgrounds and Stripes
// ---------------------------------------------------------------------------

describe('renderTable – alternating row colors & header styling', () => {
  // 36
  it('alternateRowColors applies even/odd backgrounds to data rows', () => {
    const even: Color = { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 };
    const odd: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [
        { cells: ['R0'] },
        { cells: ['R1'] },
        { cells: ['R2'] },
        { cells: ['R3'] },
      ],
      alternateRowColors: [even, odd],
    });
    // Even rows (0, 2) get 0.9 0.9 0.9 rg, odd rows (1, 3) get 1 1 1 rg
    expect(ops).toContain('0.9 0.9 0.9 rg');
    expect(ops).toContain('1 1 1 rg');
  });

  // 37
  it('headerBackgroundColor overrides alternateRowColors for header rows', () => {
    const even: Color = { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 };
    const odd: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
    const headerBg: Color = { type: 'rgb', r: 0, g: 0, b: 0.5 };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [
        { cells: ['Header'] },
        { cells: ['Data1'] },
        { cells: ['Data2'] },
      ],
      headerRows: 1,
      alternateRowColors: [even, odd],
      headerBackgroundColor: headerBg,
    });
    // Header should use 0 0 0.5 rg, NOT the alternating colors
    expect(ops).toContain('0 0 0.5 rg');
    // Data rows should still get alternating colors
    expect(ops).toContain('0.9 0.9 0.9 rg');
    expect(ops).toContain('1 1 1 rg');
  });

  // 38
  it('headerTextColor is applied to header row text', () => {
    const headerTextCol: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [
        { cells: ['Header'] },
        { cells: ['Data'] },
      ],
      headerRows: 1,
      headerTextColor: headerTextCol,
    });
    // The header text should use 1 1 1 rg (white)
    expect(ops).toContain('1 1 1 rg');
    // Data row text should use default black (0 g)
    expect(ops).toContain('0 g');
  });

  // 39
  it('explicit row backgroundColor overrides alternateRowColors', () => {
    const even: Color = { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 };
    const odd: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
    const rowBg: Color = { type: 'rgb', r: 1, g: 0, b: 0 };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [
        { cells: ['A'], backgroundColor: rowBg },
        { cells: ['B'] },
      ],
      alternateRowColors: [even, odd],
    });
    // Row 0 explicit bg (red) should appear
    expect(ops).toContain('1 0 0 rg');
    // Row 1 should get the odd alternating color
    expect(ops).toContain('1 1 1 rg');
  });

  // 40
  it('cell-level backgroundColor overrides row-level background', () => {
    const rowBg: Color = { type: 'rgb', r: 0.5, g: 0.5, b: 0.5 };
    const cellBg: Color = { type: 'rgb', r: 0, g: 1, b: 0 };
    const cell: TableCell = { content: 'Green', backgroundColor: cellBg };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [{ cells: [cell, 'Normal'], backgroundColor: rowBg }],
    });
    // Row background (gray) should be rendered
    expect(ops).toContain('0.5 0.5 0.5 rg');
    // Cell background (green) should also be rendered on top
    expect(ops).toContain('0 1 0 rg');
  });

  // 41
  it('alternateRowColors with headerRows counts data rows from 0', () => {
    const even: Color = { type: 'rgb', r: 0.8, g: 0.8, b: 0.8 };
    const odd: Color = { type: 'rgb', r: 0.95, g: 0.95, b: 0.95 };
    const { ops } = renderTable({
      x: 0,
      y: 300,
      width: 200,
      rows: [
        { cells: ['H1'] },
        { cells: ['H2'] },
        { cells: ['D0'] }, // data row 0 → even
        { cells: ['D1'] }, // data row 1 → odd
        { cells: ['D2'] }, // data row 2 → even
      ],
      headerRows: 2,
      alternateRowColors: [even, odd],
    });
    // Data rows should have both even and odd colors
    expect(ops).toContain('0.8 0.8 0.8 rg');
    expect(ops).toContain('0.95 0.95 0.95 rg');
  });
});

// ---------------------------------------------------------------------------
// Task 49 — Nested Tables
// ---------------------------------------------------------------------------

describe('renderTable – nested tables', () => {
  // 42
  it('nested table renders inside a cell', () => {
    const nested: NestedTableContent = {
      type: 'table',
      table: {
        width: 100,
        rows: [{ cells: ['Inner1', 'Inner2'] }],
      },
    };
    const cell: TableCell = { content: nested };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [{ cells: [cell, 'Outer'] }],
    });
    // The nested table's text should appear in the output
    expect(ops).toContain('(Inner1) Tj');
    expect(ops).toContain('(Inner2) Tj');
    // The outer cell text should also appear
    expect(ops).toContain('(Outer) Tj');
  });

  // 43
  it('nested table affects row height', () => {
    const nested: NestedTableContent = {
      type: 'table',
      table: {
        width: 100,
        rows: [
          { cells: ['R1'], height: 30 },
          { cells: ['R2'], height: 30 },
          { cells: ['R3'], height: 30 },
        ],
      },
    };
    const cell: TableCell = { content: nested };
    const { result: withNested } = renderTable({
      x: 0,
      y: 300,
      width: 200,
      rows: [{ cells: [cell, 'Short'] }],
    });
    const { result: withoutNested } = renderTable({
      x: 0,
      y: 300,
      width: 200,
      rows: [{ cells: ['Plain', 'Short'] }],
    });
    // Row with nested table (90pt inner + padding) should be taller
    expect(withNested.rowHeights[0]!).toBeGreaterThan(withoutNested.rowHeights[0]!);
  });

  // 44
  it('nested table has its own borders and text', () => {
    const nested: NestedTableContent = {
      type: 'table',
      table: {
        width: 80,
        rows: [{ cells: ['N1'] }, { cells: ['N2'] }],
        borderWidth: 2,
        fontName: 'Courier',
      },
    };
    const cell: TableCell = { content: nested };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 300,
      rows: [{ cells: [cell, 'OuterText'] }],
      borderWidth: 1,
      fontName: 'Helvetica',
    });
    // Both the outer and inner table operators should be present
    expect(ops).toContain('/Courier');
    expect(ops).toContain('/Helvetica');
    expect(ops).toContain('2 w');
    expect(ops).toContain('1 w');
    expect(ops).toContain('(N1) Tj');
    expect(ops).toContain('(N2) Tj');
    expect(ops).toContain('(OuterText) Tj');
  });

  // 45
  it('deeply nested table renders correctly', () => {
    const innerNested: NestedTableContent = {
      type: 'table',
      table: {
        width: 50,
        rows: [{ cells: ['Deep'] }],
      },
    };
    const outerNested: NestedTableContent = {
      type: 'table',
      table: {
        width: 80,
        rows: [{ cells: [{ content: innerNested } as TableCell] }],
      },
    };
    const cell: TableCell = { content: outerNested };
    const { ops } = renderTable({
      x: 0,
      y: 200,
      width: 200,
      rows: [{ cells: [cell] }],
    });
    expect(ops).toContain('(Deep) Tj');
  });
});

// ---------------------------------------------------------------------------
// PdfPage.drawTable integration
// ---------------------------------------------------------------------------

describe('PdfPage.drawTable', () => {
  // 29
  it('appends table ops to the page and returns result', () => {
    const page = makePage();
    const result = page.drawTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [
        { cells: ['Name', 'Age'] },
        { cells: ['Alice', '30'] },
      ],
    });

    expect(result).toBeDefined();
    expect(result.width).toBe(500);
    expect(result.rowHeights).toHaveLength(2);
    expect(result.columnWidths).toHaveLength(2);

    // The page's content stream should contain table operators
    const content = page.getContentStreamData();
    expect(content).toContain('(Name) Tj');
    expect(content).toContain('(Alice) Tj');
    expect(content).toContain('re\n');
  });

  // 30
  it('multiple drawTable calls append sequentially', () => {
    const page = makePage();
    page.drawTable({
      x: 50,
      y: 700,
      width: 200,
      rows: [{ cells: ['First'] }],
    });
    page.drawTable({
      x: 50,
      y: 600,
      width: 200,
      rows: [{ cells: ['Second'] }],
    });

    const content = page.getContentStreamData();
    expect(content).toContain('(First) Tj');
    expect(content).toContain('(Second) Tj');
  });
});

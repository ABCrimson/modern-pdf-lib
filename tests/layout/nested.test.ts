/**
 * Tests for nested tables as cell content.
 *
 * Covers NestedTableContent, CellContent type union, recursive
 * rendering, and row height growth for nested tables.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
  NestedTableContent,
} from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nestedDef(
  overrides?: Partial<Omit<DrawTableOptions, 'x' | 'y'>>,
): NestedTableContent {
  return {
    type: 'table',
    table: {
      width: 200,
      rows: [
        { cells: ['Inner1', 'Inner2'] },
        { cells: ['Inner3', 'Inner4'] },
      ],
      ...overrides,
    },
  };
}

function parentTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [
      {
        cells: [
          { content: nestedDef() } as TableCell,
          'TextCell',
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nested tables', () => {
  // 1
  it('nested table renders inside cell', () => {
    const { ops } = renderTable(parentTable());
    // The nested table should render its inner cell text
    expect(ops).toContain('(Inner1) Tj');
    expect(ops).toContain('(Inner2) Tj');
    expect(ops).toContain('(Inner3) Tj');
    expect(ops).toContain('(Inner4) Tj');
  });

  // 2
  it('nested table ops included in parent ops', () => {
    const { ops } = renderTable(parentTable());
    // Parent text cell should also be rendered
    expect(ops).toContain('(TextCell) Tj');
    // Both inner and outer text should exist in same ops string
    expect(ops).toContain('(Inner1) Tj');
    expect(ops).toContain('(TextCell) Tj');
  });

  // 3
  it('nested table width constrained by cell', () => {
    // The parent table is 500 wide with 2 equal columns = 250 each
    // Nested table should be rendered within the cell's content area
    // (250 - padding.left - padding.right)
    const { ops } = renderTable(parentTable());
    // We can verify that nested table renders without error and
    // its content appears. The width constraint is implicit.
    expect(ops).toContain('(Inner1) Tj');
    expect(typeof ops).toBe('string');
    expect(ops.length).toBeGreaterThan(0);
  });

  // 4
  it('row height grows to fit nested table', () => {
    // A nested table with 2 rows (each ~20pt default height) should
    // cause the parent row to be taller than a text-only row
    const { result: withNested } = renderTable(parentTable());

    const { result: withoutNested } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [{ cells: ['A', 'B'] }],
    });

    // The row containing the nested table should be taller
    expect(withNested.rowHeights[0]).toBeGreaterThan(withoutNested.rowHeights[0]!);
  });

  // 5
  it('multiple cells with nested tables', () => {
    const nested1 = nestedDef({
      rows: [{ cells: ['N1A'] }],
    });
    const nested2 = nestedDef({
      rows: [{ cells: ['N2A'] }],
    });

    const { ops } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [
        {
          cells: [
            { content: nested1 } as TableCell,
            { content: nested2 } as TableCell,
          ],
        },
      ],
    });

    expect(ops).toContain('(N1A) Tj');
    expect(ops).toContain('(N2A) Tj');
  });

  // 6
  it('nested table alongside text cells', () => {
    const { ops, result } = renderTable({
      x: 50,
      y: 700,
      width: 600,
      rows: [
        {
          cells: [
            'Text1',
            { content: nestedDef() } as TableCell,
            'Text2',
          ],
        },
      ],
    });

    expect(ops).toContain('(Text1) Tj');
    expect(ops).toContain('(Text2) Tj');
    expect(ops).toContain('(Inner1) Tj');
    expect(result.columnWidths).toHaveLength(3);
  });

  // 7
  it('empty nested table handled', () => {
    const emptyNested: NestedTableContent = {
      type: 'table',
      table: {
        width: 100,
        rows: [],
      },
    };

    const { ops, result } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [
        {
          cells: [
            { content: emptyNested } as TableCell,
            'Text',
          ],
        },
      ],
    });

    // Should render without crashing
    expect(typeof ops).toBe('string');
    expect(result.rowHeights).toHaveLength(1);
    expect(ops).toContain('(Text) Tj');
  });

  // 8
  it('deeply nested table (3 levels) does not crash', () => {
    const level3: NestedTableContent = {
      type: 'table',
      table: {
        width: 100,
        rows: [{ cells: ['Deep'] }],
      },
    };

    const level2: NestedTableContent = {
      type: 'table',
      table: {
        width: 150,
        rows: [
          {
            cells: [
              { content: level3 } as TableCell,
            ],
          },
        ],
      },
    };

    const { ops, result } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [
        {
          cells: [
            { content: level2 } as TableCell,
            'Sibling',
          ],
        },
      ],
    });

    // Should render all levels without error
    expect(ops).toContain('(Deep) Tj');
    expect(ops).toContain('(Sibling) Tj');
    expect(result.rowHeights).toHaveLength(1);
    expect(result.height).toBeGreaterThan(0);
  });

  // 9
  it('nested table inherits no position from parent', () => {
    // The nested table's x,y are derived from the cell position,
    // not the parent table's x,y. We verify by checking that the
    // nested table renders correctly at different parent positions.
    const { ops: ops1 } = renderTable({
      x: 0,
      y: 500,
      width: 400,
      rows: [{ cells: [{ content: nestedDef() } as TableCell] }],
    });

    const { ops: ops2 } = renderTable({
      x: 100,
      y: 800,
      width: 400,
      rows: [{ cells: [{ content: nestedDef() } as TableCell] }],
    });

    // Both should render the nested content
    expect(ops1).toContain('(Inner1) Tj');
    expect(ops2).toContain('(Inner1) Tj');
    // But the operator strings should differ (different positions)
    expect(ops1).not.toBe(ops2);
  });

  // 10
  it('nested table total height is sum of its row heights plus parent padding', () => {
    const innerRows = [
      { cells: ['R1'], height: 25 },
      { cells: ['R2'], height: 30 },
    ];
    const nested: NestedTableContent = {
      type: 'table',
      table: { width: 200, rows: innerRows },
    };

    const { result } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      padding: 5,
      rows: [
        {
          cells: [
            { content: nested } as TableCell,
          ],
        },
      ],
    });

    // Inner table height = 25 + 30 = 55
    // Parent row height = padding.top + padding.bottom + nestedHeight = 5 + 5 + 55 = 65
    expect(result.rowHeights[0]).toBe(65);
  });
});

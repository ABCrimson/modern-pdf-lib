/**
 * Tests for alternating row colors (stripes) and header styling.
 *
 * Covers alternateRowColors, headerBackgroundColor, and headerTextColor
 * options in DrawTableOptions.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type { DrawTableOptions, TableCell } from '../../src/layout/table.js';
import type { Color } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const white: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
const lightGray: Color = { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 };
const darkGray: Color = { type: 'rgb', r: 0.3, g: 0.3, b: 0.3 };
const blue: Color = { type: 'rgb', r: 0, g: 0, b: 0.8 };
const red: Color = { type: 'rgb', r: 1, g: 0, b: 0 };

function stripedTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [
      { cells: ['A', 'B'] },
      { cells: ['C', 'D'] },
      { cells: ['E', 'F'] },
      { cells: ['G', 'H'] },
    ],
    alternateRowColors: [white, lightGray],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('alternating row colors and header styling', () => {
  // 1
  it('alternateRowColors applies even/odd colors', () => {
    const { ops } = renderTable(stripedTable());
    // Even rows (index 0, 2) should use white (1 1 1 rg)
    // Odd rows (index 1, 3) should use lightGray (0.9 0.9 0.9 rg)
    expect(ops).toContain('1 1 1 rg');
    expect(ops).toContain('0.9 0.9 0.9 rg');
  });

  // 2
  it('first row (index 0) uses even color', () => {
    const { ops } = renderTable(
      stripedTable({
        rows: [{ cells: ['Only'] }],
      }),
    );
    // Single row at data index 0 -> even color (white)
    expect(ops).toContain('1 1 1 rg');
    // Should NOT contain odd color
    expect(ops).not.toContain('0.9 0.9 0.9 rg');
  });

  // 3
  it('second row (index 1) uses odd color', () => {
    const { ops } = renderTable(stripedTable());
    // Count occurrences of the odd color
    const oddMatches = ops.match(/0\.9 0\.9 0\.9 rg/g);
    // At least 2 rows should have odd color (rows 1 and 3)
    expect(oddMatches).not.toBeNull();
    expect(oddMatches!.length).toBeGreaterThanOrEqual(2);
  });

  // 4
  it('explicit row backgroundColor overrides alternateRowColors', () => {
    const { ops } = renderTable(
      stripedTable({
        rows: [
          { cells: ['A', 'B'], backgroundColor: red },
          { cells: ['C', 'D'] },
        ],
      }),
    );
    // Row 0 has explicit red background — should appear
    expect(ops).toContain('1 0 0 rg');
    // Row 1 is odd data row -> lightGray should appear
    expect(ops).toContain('0.9 0.9 0.9 rg');
  });

  // 5
  it('headerBackgroundColor applies to header rows', () => {
    const { ops } = renderTable(
      stripedTable({
        headerRows: 1,
        headerBackgroundColor: blue,
        rows: [
          { cells: ['Header1', 'Header2'] },
          { cells: ['A', 'B'] },
          { cells: ['C', 'D'] },
        ],
      }),
    );
    // Header should use blue (0 0 0.8 rg)
    expect(ops).toContain('0 0 0.8 rg');
  });

  // 6
  it('headerTextColor applies to header row text', () => {
    const { ops } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      headerRows: 1,
      headerTextColor: white,
      rows: [
        { cells: ['Header'] },
        { cells: ['Data'] },
      ],
    });
    // The header text should use white fill color (1 1 1 rg)
    // followed by BT and then the header text
    expect(ops).toContain('1 1 1 rg');
    expect(ops).toContain('(Header) Tj');
  });

  // 7
  it('alternateRowColors skips header rows for index calculation', () => {
    const { ops } = renderTable(
      stripedTable({
        headerRows: 1,
        headerBackgroundColor: blue,
        rows: [
          { cells: ['H1', 'H2'] },     // header row (blue bg)
          { cells: ['A', 'B'] },        // data row 0 -> even (white)
          { cells: ['C', 'D'] },        // data row 1 -> odd (lightGray)
          { cells: ['E', 'F'] },        // data row 2 -> even (white)
        ],
      }),
    );
    // Header gets blue
    expect(ops).toContain('0 0 0.8 rg');
    // Data row 0 and 2 get white
    expect(ops).toContain('1 1 1 rg');
    // Data row 1 gets lightGray
    expect(ops).toContain('0.9 0.9 0.9 rg');
  });

  // 8
  it('no alternateRowColors by default', () => {
    const { ops } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      rows: [
        { cells: ['A', 'B'] },
        { cells: ['C', 'D'] },
      ],
    });
    // Without alternateRowColors and no explicit row bg, there should
    // be no row-level fill color. The only fill colors should come
    // from text (black by default). No rgb fill should appear.
    expect(ops).not.toContain('rg\n');
  });

  // 9
  it('works with single row', () => {
    const { ops, result } = renderTable(
      stripedTable({
        rows: [{ cells: ['Solo'] }],
      }),
    );
    expect(result.rowHeights).toHaveLength(1);
    // Even color for single row
    expect(ops).toContain('1 1 1 rg');
    expect(ops).toContain('(Solo) Tj');
  });

  // 10
  it('works with many rows', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      cells: [`Row${i}`],
    }));
    const { ops, result } = renderTable(stripedTable({ rows }));
    expect(result.rowHeights).toHaveLength(20);
    // Both colors should appear
    expect(ops).toContain('1 1 1 rg');
    expect(ops).toContain('0.9 0.9 0.9 rg');
    // Verify all row text is present
    for (let i = 0; i < 20; i++) {
      expect(ops).toContain(`(Row${i}) Tj`);
    }
  });

  // 11
  it('headerTextColor does not affect data rows', () => {
    const headerWhite: Color = { type: 'rgb', r: 1, g: 1, b: 1 };
    const { ops } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      headerRows: 1,
      headerTextColor: headerWhite,
      textColor: { type: 'grayscale', gray: 0 },
      rows: [
        { cells: ['Header'] },
        { cells: ['Data'] },
      ],
    });
    // Header text uses white
    // Data text uses default black (0 g)
    // Both should be present
    expect(ops).toContain('1 1 1 rg');
    expect(ops).toContain('0 g');
  });

  // 12
  it('cell textColor overrides headerTextColor', () => {
    const cell: TableCell = { content: 'Custom', textColor: red };
    const { ops } = renderTable({
      x: 50,
      y: 700,
      width: 500,
      headerRows: 1,
      headerTextColor: white,
      rows: [
        { cells: [cell] },
        { cells: ['Data'] },
      ],
    });
    // Cell's own textColor (red) should override headerTextColor
    expect(ops).toContain('1 0 0 rg');
  });
});

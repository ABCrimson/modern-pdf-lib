/**
 * Tests for colspan and rowspan support in the table layout engine.
 *
 * Validates the 2D occupation grid, spanning cell rendering,
 * combined widths/heights, and correct skip logic.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
  TableRow,
} from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 0,
    y: 200,
    width: 300,
    borderWidth: 0,
    ...overrides,
  };
}

/**
 * Count occurrences of a substring in a string.
 */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('colspan support', () => {
  // 1 — colspan: 2 spans two columns
  it('colspan 2 spans two column widths', () => {
    const spanCell: TableCell = { content: 'Span2', colSpan: 2 };
    const { ops, result } = renderTable(
      simpleTable({
        rows: [
          { cells: [spanCell, 'C'] },
          { cells: ['D', 'E', 'F'] },
        ],
      }),
    );

    // Should have 3 columns (determined by the widest row)
    expect(result.columnWidths).toHaveLength(3);

    // The span cell text should appear exactly once
    expect(countOccurrences(ops, '(Span2) Tj')).toBe(1);

    // All regular cells should still appear
    expect(ops).toContain('(C) Tj');
    expect(ops).toContain('(D) Tj');
    expect(ops).toContain('(E) Tj');
    expect(ops).toContain('(F) Tj');
  });

  // 2 — colspan: 3 spans three columns
  it('colspan 3 spans three column widths', () => {
    const spanCell: TableCell = { content: 'Wide', colSpan: 3 };
    const { ops, result } = renderTable(
      simpleTable({
        rows: [
          { cells: [spanCell] },
          { cells: ['A', 'B', 'C'] },
        ],
      }),
    );

    expect(result.columnWidths).toHaveLength(3);
    expect(countOccurrences(ops, '(Wide) Tj')).toBe(1);
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(C) Tj');
  });

  // 3 — colspan with different column widths uses combined width
  it('colspan uses combined width of spanned columns', () => {
    const spanCell: TableCell = {
      content: 'X',
      colSpan: 2,
      backgroundColor: { type: 'rgb', r: 1, g: 0, b: 0 },
    };
    const { ops } = renderTable(
      simpleTable({
        width: 300,
        columns: [{ width: 100 }, { width: 80 }, { width: 120 }],
        rows: [
          { cells: [spanCell, 'Z'] },
          { cells: ['A', 'B', 'C'] },
        ],
        borderWidth: 1,
      }),
    );

    // The span cell covers columns 0 + 1 = 100 + 80 = 180 pts.
    // Check that a rectangle with width 180 is drawn (for background).
    expect(ops).toContain('180');
    expect(ops).toContain('(X) Tj');
    expect(ops).toContain('(Z) Tj');
  });

  // 4 — single cell with colSpan = total columns (full width)
  it('colSpan equal to total columns produces full-width cell', () => {
    const spanCell: TableCell = {
      content: 'Full',
      colSpan: 4,
      backgroundColor: { type: 'grayscale', gray: 0.5 },
    };
    const { ops } = renderTable(
      simpleTable({
        width: 400,
        rows: [
          { cells: [spanCell] },
          { cells: ['A', 'B', 'C', 'D'] },
        ],
        borderWidth: 1,
      }),
    );

    // The full-width span should produce a rectangle with width 400
    expect(ops).toContain('400');
    expect(countOccurrences(ops, '(Full) Tj')).toBe(1);
  });

  // 5 — normal cells adjacent to spanning cells
  it('normal cells adjacent to colspan cells render correctly', () => {
    const span: TableCell = { content: 'AB', colSpan: 2 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: [span, 'C', 'D'] },
          { cells: ['W', 'X', 'Y', 'Z'] },
        ],
      }),
    );

    // All cells should appear
    expect(ops).toContain('(AB) Tj');
    expect(ops).toContain('(C) Tj');
    expect(ops).toContain('(D) Tj');
    expect(ops).toContain('(W) Tj');
    expect(ops).toContain('(X) Tj');
    expect(ops).toContain('(Y) Tj');
    expect(ops).toContain('(Z) Tj');
  });
});

describe('rowspan support', () => {
  // 6 — rowspan: 2 spans two rows
  it('rowspan 2 spans two row heights', () => {
    const spanCell: TableCell = { content: 'Tall', rowSpan: 2 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: [spanCell, 'B'] },
          { cells: ['D'] }, // Only 1 cell — column 0 is occupied by rowspan
        ],
      }),
    );

    // "Tall" should appear exactly once
    expect(countOccurrences(ops, '(Tall) Tj')).toBe(1);
    // The second row's cell 'D' should map to column 1 (skipping column 0)
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(D) Tj');
  });

  // 7 — rowspan with different row heights
  it('rowspan cell height equals sum of spanned row heights', () => {
    const spanCell: TableCell = {
      content: 'RS',
      rowSpan: 2,
      backgroundColor: { type: 'rgb', r: 0, g: 1, b: 0 },
    };
    const { result } = renderTable(
      simpleTable({
        rows: [
          { cells: [spanCell, 'B'], height: 30 },
          { cells: ['D'], height: 50 },
        ],
      }),
    );

    // Total table height should be 30 + 50 = 80
    expect(result.height).toBe(80);
    expect(result.rowHeights[0]).toBe(30);
    expect(result.rowHeights[1]).toBe(50);
  });

  // 8 — spanning cells skip occupied positions
  it('occupied positions are skipped by subsequent row cells', () => {
    // 3-column table:
    // Row 0: [rowSpan=2, A, B]
    // Row 1: [C, D]  — col 0 is occupied, so C goes to col 1, D to col 2
    const span: TableCell = { content: 'RS', rowSpan: 2 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: [span, 'A', 'B'] },
          { cells: ['C', 'D'] },
        ],
      }),
    );

    expect(countOccurrences(ops, '(RS) Tj')).toBe(1);
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(C) Tj');
    expect(ops).toContain('(D) Tj');
  });
});

describe('mixed colspan and rowspan', () => {
  // 9 — combined colspan + rowspan
  it('cell with both colSpan and rowSpan renders once with combined area', () => {
    const bigCell: TableCell = {
      content: 'Big',
      colSpan: 2,
      rowSpan: 2,
      backgroundColor: { type: 'rgb', r: 0, g: 0, b: 1 },
    };
    const { ops, result } = renderTable(
      simpleTable({
        width: 300,
        rows: [
          { cells: [bigCell, 'C'] },
          { cells: ['F'] }, // Only col 2 — cols 0,1 occupied by bigCell
          { cells: ['G', 'H', 'I'] },
        ],
      }),
    );

    expect(result.columnWidths).toHaveLength(3);
    expect(countOccurrences(ops, '(Big) Tj')).toBe(1);
    expect(ops).toContain('(C) Tj');
    expect(ops).toContain('(F) Tj');
    expect(ops).toContain('(G) Tj');
    expect(ops).toContain('(H) Tj');
    expect(ops).toContain('(I) Tj');
  });

  // 10 — empty grid positions handled gracefully
  it('handles table where not all grid positions are filled', () => {
    // A 3-col table where row 0 only has 2 cells (no cell for col 2)
    const { ops, result } = renderTable(
      simpleTable({
        rows: [
          { cells: ['A', 'B'] },
          { cells: ['D', 'E', 'F'] },
        ],
      }),
    );

    expect(result.columnWidths).toHaveLength(3);
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
    // Column 2 in row 0 is simply empty — no crash
    expect(ops).toContain('(D) Tj');
    expect(ops).toContain('(E) Tj');
    expect(ops).toContain('(F) Tj');
  });

  // 11 — Multiple rowspans in the same row
  it('multiple rowspan cells in the same row', () => {
    const rs1: TableCell = { content: 'R1', rowSpan: 2 };
    const rs2: TableCell = { content: 'R2', rowSpan: 2 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: [rs1, 'Mid', rs2] },
          { cells: ['X'] }, // Only col 1 is free
        ],
      }),
    );

    expect(countOccurrences(ops, '(R1) Tj')).toBe(1);
    expect(countOccurrences(ops, '(R2) Tj')).toBe(1);
    expect(ops).toContain('(Mid) Tj');
    expect(ops).toContain('(X) Tj');
  });

  // 12 — colspan in a row below a rowspan
  it('colspan works correctly below a rowspan', () => {
    const tall: TableCell = { content: 'Tall', rowSpan: 2 };
    const wide: TableCell = { content: 'Wide', colSpan: 2 };
    const { ops } = renderTable(
      simpleTable({
        rows: [
          { cells: [tall, 'B', 'C'] },
          { cells: [wide] }, // col 0 occupied, so Wide goes to cols 1-2
        ],
      }),
    );

    expect(countOccurrences(ops, '(Tall) Tj')).toBe(1);
    expect(countOccurrences(ops, '(Wide) Tj')).toBe(1);
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(C) Tj');
  });
});

/**
 * Tests for automatic page breaks with header row repetition
 * in the multi-page table renderer.
 *
 * Covers single-page tables, page breaks, header repetition,
 * multiple breaks, page count, operator validity, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { renderMultiPageTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableRow,
} from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a table with `n` data rows, each 30pt tall, plus optional
 * header rows.
 */
function makeTable(
  rowCount: number,
  overrides?: Partial<DrawTableOptions>,
): DrawTableOptions {
  const rows: TableRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({ cells: [`R${i}C0`, `R${i}C1`], height: 30 });
  }
  return {
    x: 50,
    y: 700,
    width: 400,
    rows,
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

describe('renderMultiPageTable', () => {
  // 1 — single page when content fits
  it('returns a single page when all rows fit', () => {
    // 3 rows * 30pt = 90pt. Starting at y=700 with bottomMargin=40
    // gives 660pt of space — plenty of room.
    const opts = makeTable(3);
    const { pages, result } = renderMultiPageTable(opts, 40);

    expect(pages).toHaveLength(1);
    expect(result.pagesUsed).toBe(1);
    expect(pages[0]!.pageIndex).toBe(0);
    expect(pages[0]!.ops).toContain('(R0C0) Tj');
    expect(pages[0]!.ops).toContain('(R2C1) Tj');
  });

  // 2 — page break when content exceeds bottomMargin
  it('breaks to a new page when rows exceed available space', () => {
    // y=200, bottomMargin=40 => 160pt usable space
    // 30pt rows => 5 rows fit on first page, row 6 triggers break
    const opts = makeTable(8, { y: 200 });
    const { pages, result } = renderMultiPageTable(opts, 40);

    expect(pages.length).toBeGreaterThan(1);
    expect(result.pagesUsed).toBe(pages.length);

    // First page should contain early rows
    expect(pages[0]!.ops).toContain('(R0C0) Tj');

    // Last page should contain late rows
    const lastPage = pages[pages.length - 1]!;
    expect(lastPage.ops).toContain('(R7C0) Tj');
  });

  // 3 — header rows repeated on new pages
  it('repeats header rows on each new page', () => {
    // Header = row 0, data = rows 1..9 (10 total)
    const rows: TableRow[] = [
      { cells: ['Name', 'Value'], height: 30 },
    ];
    for (let i = 1; i < 10; i++) {
      rows.push({ cells: [`Item${i}`, `${i * 10}`], height: 30 });
    }

    const opts: DrawTableOptions = {
      x: 50,
      y: 200, // 160pt usable
      width: 400,
      rows,
      headerRows: 1,
    };

    const { pages } = renderMultiPageTable(opts, 40);

    // With 160pt usable and 30pt rows, first page fits ~5 rows
    // (header + 4 data rows). Subsequent pages repeat the header.
    expect(pages.length).toBeGreaterThan(1);

    // Header text should appear on every page
    for (const page of pages) {
      expect(page.ops).toContain('(Name) Tj');
    }
  });

  // 4 — multiple page breaks
  it('handles multiple page breaks correctly', () => {
    // y=100, bottomMargin=40 => 60pt usable
    // 30pt rows => 2 rows per page
    // 10 rows => 5 pages
    const opts = makeTable(10, { y: 100 });
    const { pages, result } = renderMultiPageTable(opts, 40);

    expect(result.pagesUsed).toBe(5);
    expect(pages).toHaveLength(5);
  });

  // 5 — pagesUsed count correct
  it('pagesUsed matches the number of pages returned', () => {
    const opts = makeTable(20, { y: 200 });
    const { pages, result } = renderMultiPageTable(opts, 40);

    expect(result.pagesUsed).toBe(pages.length);
    // Verify pageIndex is sequential
    for (let i = 0; i < pages.length; i++) {
      expect(pages[i]!.pageIndex).toBe(i);
    }
  });

  // 6 — each page has valid operators (starts with q, ends with Q)
  it('each page has valid save/restore state operators', () => {
    const opts = makeTable(10, { y: 100 });
    const { pages } = renderMultiPageTable(opts, 40);

    for (const page of pages) {
      expect(page.ops.startsWith('q\n')).toBe(true);
      expect(page.ops.endsWith('Q\n')).toBe(true);
    }
  });

  // 7 — row not split across pages
  it('does not split a single row across pages', () => {
    // y=100, bottomMargin=40 => 60pt usable
    // 30pt rows => 2 rows fit per page
    const opts = makeTable(5, { y: 100 });
    const { pages } = renderMultiPageTable(opts, 40);

    // Each row's text should appear on exactly one page
    for (let r = 0; r < 5; r++) {
      const needle = `(R${r}C0) Tj`;
      let found = 0;
      for (const page of pages) {
        if (page.ops.includes(needle)) found++;
      }
      expect(found).toBe(1);
    }
  });

  // 8 — no header repetition when headerRows = 0
  it('does not repeat headers when headerRows is 0', () => {
    const opts = makeTable(10, { y: 100, headerRows: 0 });
    const { pages } = renderMultiPageTable(opts, 40);

    // Row 0 text should appear on only one page (the first)
    const r0Count = pages.filter((p) => p.ops.includes('(R0C0) Tj')).length;
    expect(r0Count).toBe(1);
  });

  // 9 — header rows with multiple header rows
  it('repeats multiple header rows on each page', () => {
    const rows: TableRow[] = [
      { cells: ['H1A', 'H1B'], height: 20 },
      { cells: ['H2A', 'H2B'], height: 20 },
    ];
    for (let i = 0; i < 12; i++) {
      rows.push({ cells: [`D${i}A`, `D${i}B`], height: 20 });
    }

    // y=150, bottomMargin=40 => 110pt usable
    // 20pt rows => 5 rows per page (2 header + 3 data on pages 2+)
    const opts: DrawTableOptions = {
      x: 50,
      y: 150,
      width: 400,
      rows,
      headerRows: 2,
    };

    const { pages } = renderMultiPageTable(opts, 40);
    expect(pages.length).toBeGreaterThan(1);

    // Both header rows should appear on every page after the first
    for (let p = 1; p < pages.length; p++) {
      expect(pages[p]!.ops).toContain('(H1A) Tj');
      expect(pages[p]!.ops).toContain('(H2A) Tj');
    }
  });

  // 10 — result dimensions are correct
  it('returns correct total height and column widths', () => {
    const opts = makeTable(6, { y: 200 });
    const { result } = renderMultiPageTable(opts, 40);

    // Total height = 6 * 30 = 180
    expect(result.height).toBe(180);
    expect(result.columnWidths).toHaveLength(2);
    expect(result.width).toBe(400);
    expect(result.rowHeights).toHaveLength(6);
  });
});

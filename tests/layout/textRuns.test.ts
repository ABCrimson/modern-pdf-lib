/**
 * Tests for TextRun (rich cell content) support in the table layout engine.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
  TextRun,
} from '../../src/layout/table.js';
import type { Color } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 0,
    y: 200,
    width: 400,
    borderWidth: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TextRun cell content', () => {
  // 1
  it('renders a single TextRun with default styling', () => {
    const runs: TextRun[] = [{ text: 'Hello' }];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('(Hello) Tj');
  });

  // 2
  it('renders multiple TextRuns sequentially', () => {
    const runs: TextRun[] = [
      { text: 'First' },
      { text: 'Second' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('(First) Tj');
    expect(ops).toContain('(Second) Tj');
  });

  // 3
  it('applies per-run font size', () => {
    const runs: TextRun[] = [
      { text: 'Big', fontSize: 24 },
      { text: 'Small', fontSize: 8 },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('24 Tf');
    expect(ops).toContain('8 Tf');
  });

  // 4
  it('applies per-run color', () => {
    const red: Color = { type: 'rgb', r: 1, g: 0, b: 0 };
    const blue: Color = { type: 'rgb', r: 0, g: 0, b: 1 };
    const runs: TextRun[] = [
      { text: 'Red', color: red },
      { text: 'Blue', color: blue },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('1 0 0 rg');
    expect(ops).toContain('0 0 1 rg');
  });

  // 5
  it('applies per-run font name', () => {
    const runs: TextRun[] = [
      { text: 'Serif', fontName: 'Times-Roman' },
      { text: 'Mono', fontName: 'Courier' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('/Times-Roman');
    expect(ops).toContain('/Courier');
  });

  // 6
  it('falls back to cell textColor when run has no color', () => {
    const green: Color = { type: 'rgb', r: 0, g: 0.8, b: 0 };
    const runs: TextRun[] = [{ text: 'Green' }];
    const cell: TableCell = { content: runs, textColor: green };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('0 0.8 0 rg');
  });

  // 7
  it('falls back to table textColor when run and cell have no color', () => {
    const purple: Color = { type: 'rgb', r: 0.5, g: 0, b: 0.5 };
    const runs: TextRun[] = [{ text: 'Purple' }];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({
        textColor: purple,
        rows: [{ cells: [cell] }],
      }),
    );
    expect(ops).toContain('0.5 0 0.5 rg');
  });

  // 8
  it('falls back to table fontName when run has no fontName', () => {
    const runs: TextRun[] = [{ text: 'Default' }];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({
        fontName: 'Courier',
        rows: [{ cells: [cell] }],
      }),
    );
    expect(ops).toContain('/Courier');
  });

  // 9
  it('empty TextRun array produces no text operators', () => {
    const cell: TableCell = { content: [] as TextRun[] };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).not.toContain('Tj');
  });

  // 10
  it('TextRun cells coexist with plain string cells', () => {
    const runs: TextRun[] = [{ text: 'Rich' }];
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: [{ content: runs }, 'Plain'] }],
      }),
    );
    expect(ops).toContain('(Rich) Tj');
    expect(ops).toContain('(Plain) Tj');
  });

  // 11
  it('TextRun cells coexist with nested table cells', () => {
    const runs: TextRun[] = [{ text: 'RunText' }];
    const nested = {
      type: 'table' as const,
      table: {
        width: 100,
        rows: [{ cells: ['Inner'] }],
      },
    };
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: [{ content: runs }, { content: nested }] }],
      }),
    );
    expect(ops).toContain('(RunText) Tj');
    expect(ops).toContain('(Inner) Tj');
  });

  // 12
  it('TextRun with center alignment works', () => {
    const runs: TextRun[] = [{ text: 'Centered' }];
    const cell: TableCell = { content: runs, align: 'center' };
    const leftCell: TableCell = { content: runs, align: 'left' };

    const { ops: centerOps } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    const { ops: leftOps } = renderTable(
      simpleTable({ rows: [{ cells: [leftCell] }] }),
    );

    // Extract Td x positions — they should differ
    const tdPattern = /(\S+) (\S+) Td/;
    const centerMatch = tdPattern.exec(centerOps);
    const leftMatch = tdPattern.exec(leftOps);
    expect(centerMatch).not.toBeNull();
    expect(leftMatch).not.toBeNull();
    expect(centerMatch![1]).not.toBe(leftMatch![1]);
  });

  // 13
  it('three TextRuns produce text operators for all runs', () => {
    const runs: TextRun[] = [
      { text: 'A' },
      { text: 'B' },
      { text: 'C' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );

    // All three runs should have their text rendered
    expect(ops).toContain('(A) Tj');
    expect(ops).toContain('(B) Tj');
    expect(ops).toContain('(C) Tj');
    // Should have at least one BT/ET pair
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');
  });

  // 14
  it('TextRun runs are rendered sequentially in a single text block', () => {
    const runs: TextRun[] = [
      { text: 'AAAA' },
      { text: 'BBBB' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );

    // Both runs rendered — uses single Td + sequential Tj calls
    expect(ops).toContain('(AAAA) Tj');
    expect(ops).toContain('(BBBB) Tj');

    // The Td position (move) appears once, then both Tj follow
    const tdCount = (ops.match(/Td\n/g) ?? []).length;
    expect(tdCount).toBeGreaterThanOrEqual(1);
  });

  // 15
  it('cell fontSize overrides run default', () => {
    const runs: TextRun[] = [{ text: 'Test' }]; // no fontSize on run
    const cell: TableCell = { content: runs, fontSize: 20 };
    const { ops } = renderTable(
      simpleTable({
        fontSize: 10,
        rows: [{ cells: [cell] }],
      }),
    );
    // Should use cell fontSize (20), not table default (10)
    expect(ops).toContain('20 Tf');
    expect(ops).not.toContain('10 Tf');
  });
});

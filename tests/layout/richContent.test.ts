/**
 * Tests for rich cell content (TextRun arrays) in the table engine.
 */

import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
  TextRun,
} from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [{ cells: ['A', 'B'] }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rich cell content (TextRun[])', () => {
  // 1
  it('TextRun array renders multiple styled segments', () => {
    const runs: TextRun[] = [
      { text: 'Hello' },
      { text: ' World' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('(Hello) Tj');
    expect(ops).toContain('( World) Tj');
  });

  // 2
  it('TextRun with custom font size', () => {
    const runs: TextRun[] = [
      { text: 'Big', fontSize: 24 },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('24 Tf');
    expect(ops).toContain('(Big) Tj');
  });

  // 3
  it('TextRun with custom color', () => {
    const runs: TextRun[] = [
      { text: 'Red', color: { type: 'rgb', r: 1, g: 0, b: 0 } },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('1 0 0 rg');
    expect(ops).toContain('(Red) Tj');
  });

  // 4
  it('TextRun with custom font name', () => {
    const runs: TextRun[] = [
      { text: 'Mono', fontName: 'Courier' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('/Courier');
    expect(ops).toContain('(Mono) Tj');
  });

  // 5
  it('mixed string and TextRun cells in same row', () => {
    const runs: TextRun[] = [
      { text: 'Styled' },
    ];
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: ['Plain', { content: runs }] }],
      }),
    );
    expect(ops).toContain('(Plain) Tj');
    expect(ops).toContain('(Styled) Tj');
  });

  // 6
  it('empty TextRun array handled gracefully', () => {
    const cell: TableCell = { content: [] as TextRun[] };
    const { ops, result } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    // Should not contain any Tj for this cell
    expect(ops).not.toContain('Tj');
    // Should still produce a valid result
    expect(result.rowHeights).toHaveLength(1);
  });

  // 7
  it('single TextRun renders correctly', () => {
    const runs: TextRun[] = [{ text: 'Solo' }];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('(Solo) Tj');
    // Should be within BT/ET
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');
  });

  // 8
  it('TextRun inherits defaults from table options', () => {
    const runs: TextRun[] = [
      { text: 'Default' },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({
        fontName: 'TimesRoman',
        fontSize: 16,
        rows: [{ cells: [cell] }],
      }),
    );
    // Should use the table-level defaults since no run-level overrides
    expect(ops).toContain('/TimesRoman');
    expect(ops).toContain('16 Tf');
    expect(ops).toContain('(Default) Tj');
  });

  // 9
  it('multiple TextRuns with different styles in one cell', () => {
    const runs: TextRun[] = [
      { text: 'Normal', fontSize: 12 },
      { text: 'Bold', fontSize: 18, fontName: 'Helvetica-Bold' },
      { text: 'Colored', color: { type: 'grayscale', gray: 0.5 } },
    ];
    const cell: TableCell = { content: runs };
    const { ops } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    expect(ops).toContain('(Normal) Tj');
    expect(ops).toContain('(Bold) Tj');
    expect(ops).toContain('(Colored) Tj');
    expect(ops).toContain('/Helvetica-Bold');
    expect(ops).toContain('18 Tf');
    expect(ops).toContain('0.5 g');
  });
});

/**
 * Tests for cell padding and alignment features.
 *
 * Covers horizontal alignment (left, center, right), vertical alignment
 * (top, middle, bottom), per-cell padding (number and object), mixed
 * alignments, and column-level alignment inheritance.
 */

import { describe, it, expect } from 'vitest';
import { renderTable, resolvePadding } from '../../src/layout/table.js';
import type {
  DrawTableOptions,
  TableCell,
} from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleTable(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [
      { cells: ['A', 'B', 'C'] },
    ],
    ...overrides,
  };
}

/** Extract all Td (moveText) coordinates from ops string. */
function extractTdCoords(ops: string): Array<{ x: number; y: number }> {
  const results: Array<{ x: number; y: number }> = [];
  const pattern = /([\d.e+-]+) ([\d.e+-]+) Td/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(ops)) !== null) {
    results.push({ x: parseFloat(m[1]!), y: parseFloat(m[2]!) });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('horizontal alignment', () => {
  // 1
  it('left alignment places text at padding.left', () => {
    const cell: TableCell = { content: 'Hello', align: 'left' };
    const { ops } = renderTable(
      simpleTable({
        padding: 4,
        rows: [{ cells: [cell] }],
      }),
    );
    const coords = extractTdCoords(ops);
    expect(coords).toHaveLength(1);
    // x = table.x(50) + padding.left(4) = 54
    expect(coords[0]!.x).toBeCloseTo(54, 5);
  });

  // 2
  it('center alignment centers text within padded area', () => {
    const cell: TableCell = { content: 'Hi', align: 'center' };
    const leftCell: TableCell = { content: 'Hi', align: 'left' };

    const { ops: centerOps } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    const { ops: leftOps } = renderTable(
      simpleTable({ rows: [{ cells: [leftCell] }] }),
    );

    const centerCoords = extractTdCoords(centerOps);
    const leftCoords = extractTdCoords(leftOps);

    // Center X should be greater than left X (centered text shifts right)
    expect(centerCoords[0]!.x).toBeGreaterThan(leftCoords[0]!.x);
  });

  // 3
  it('right alignment places text at right edge minus padding', () => {
    const cell: TableCell = { content: 'Hi', align: 'right' };
    const leftCell: TableCell = { content: 'Hi', align: 'left' };

    const { ops: rightOps } = renderTable(
      simpleTable({ rows: [{ cells: [cell] }] }),
    );
    const { ops: leftOps } = renderTable(
      simpleTable({ rows: [{ cells: [leftCell] }] }),
    );

    const rightCoords = extractTdCoords(rightOps);
    const leftCoords = extractTdCoords(leftOps);

    // Right-aligned X should be greater than left-aligned X
    expect(rightCoords[0]!.x).toBeGreaterThan(leftCoords[0]!.x);
  });
});

describe('cell padding', () => {
  // 4
  it('numeric padding applies uniformly', () => {
    const p = resolvePadding(10, 4);
    expect(p).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  // 5
  it('object padding applies per side with defaults', () => {
    const p = resolvePadding({ top: 20, left: 15 }, 4);
    expect(p.top).toBe(20);
    expect(p.left).toBe(15);
    // right and bottom fall back to default
    expect(p.right).toBe(4);
    expect(p.bottom).toBe(4);
  });

  // 6
  it('undefined padding uses default', () => {
    const p = resolvePadding(undefined, 8);
    expect(p).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  // 7
  it('cell padding affects text X position', () => {
    const smallPad: TableCell = { content: 'Test', padding: 2 };
    const largePad: TableCell = { content: 'Test', padding: 40 };

    const { ops: smallOps } = renderTable(
      simpleTable({ rows: [{ cells: [smallPad] }] }),
    );
    const { ops: largeOps } = renderTable(
      simpleTable({ rows: [{ cells: [largePad] }] }),
    );

    const smallCoords = extractTdCoords(smallOps);
    const largeCoords = extractTdCoords(largeOps);

    // Larger left padding shifts text X further right
    expect(largeCoords[0]!.x).toBeGreaterThan(smallCoords[0]!.x);
  });
});

describe('vertical alignment', () => {
  // 8
  it('top alignment (default) positions text near top', () => {
    const cell: TableCell = { content: 'Top', verticalAlign: 'top' };
    const { ops } = renderTable(
      simpleTable({
        rows: [{ cells: [cell], height: 60 }],
      }),
    );
    const coords = extractTdCoords(ops);
    expect(coords).toHaveLength(1);
    // Y = 700 - padding(4) - fontSize(12) = 684
    expect(coords[0]!.y).toBeCloseTo(684, 5);
  });

  // 9
  it('middle alignment positions text at vertical center', () => {
    const topCell: TableCell = { content: 'A', verticalAlign: 'top' };
    const midCell: TableCell = { content: 'A', verticalAlign: 'middle' };

    const { ops: topOps } = renderTable(
      simpleTable({ rows: [{ cells: [topCell], height: 60 }] }),
    );
    const { ops: midOps } = renderTable(
      simpleTable({ rows: [{ cells: [midCell], height: 60 }] }),
    );

    const topY = extractTdCoords(topOps)[0]!.y;
    const midY = extractTdCoords(midOps)[0]!.y;

    // Middle should be lower than top (smaller Y in PDF coords)
    expect(midY).toBeLessThan(topY);
  });

  // 10
  it('bottom alignment positions text near bottom', () => {
    const topCell: TableCell = { content: 'A', verticalAlign: 'top' };
    const botCell: TableCell = { content: 'A', verticalAlign: 'bottom' };

    const { ops: topOps } = renderTable(
      simpleTable({ rows: [{ cells: [topCell], height: 60 }] }),
    );
    const { ops: botOps } = renderTable(
      simpleTable({ rows: [{ cells: [botCell], height: 60 }] }),
    );

    const topY = extractTdCoords(topOps)[0]!.y;
    const botY = extractTdCoords(botOps)[0]!.y;

    // Bottom should be lower than top
    expect(botY).toBeLessThan(topY);
  });
});

describe('mixed and inherited alignment', () => {
  // 11
  it('mixed alignments in same row produce different X positions', () => {
    const leftCell: TableCell = { content: 'Left', align: 'left' };
    const centerCell: TableCell = { content: 'Center', align: 'center' };
    const rightCell: TableCell = { content: 'Right', align: 'right' };

    const { ops } = renderTable(
      simpleTable({
        width: 600,
        columns: [{ width: 200 }, { width: 200 }, { width: 200 }],
        rows: [{ cells: [leftCell, centerCell, rightCell] }],
      }),
    );

    const coords = extractTdCoords(ops);
    expect(coords).toHaveLength(3);

    // Left cell starts at x=50+padding
    // Center cell should be offset from col start (250)
    // Right cell should be near col end (450+200-padding-textWidth)
    // All three should have distinct X values relative to their columns
    expect(coords[0]!.x).not.toBe(coords[1]!.x);
    expect(coords[1]!.x).not.toBe(coords[2]!.x);
  });

  // 12
  it('column-level alignment is inherited by cells', () => {
    // Column has align: 'right', cell does not specify align
    const { ops: inheritedOps } = renderTable(
      simpleTable({
        columns: [{ width: 500, align: 'right' }],
        rows: [{ cells: ['Test'] }],
      }),
    );

    // Explicit cell align: 'right'
    const rightCell: TableCell = { content: 'Test', align: 'right' };
    const { ops: explicitOps } = renderTable(
      simpleTable({
        columns: [{ width: 500 }],
        rows: [{ cells: [rightCell] }],
      }),
    );

    const inheritedCoords = extractTdCoords(inheritedOps);
    const explicitCoords = extractTdCoords(explicitOps);

    // Both should produce the same X position
    expect(inheritedCoords[0]!.x).toBeCloseTo(explicitCoords[0]!.x, 5);
  });

  // 13
  it('cell-level alignment overrides column-level', () => {
    // Column says 'right', cell says 'left'
    const leftCell: TableCell = { content: 'Override', align: 'left' };
    const { ops: overrideOps } = renderTable(
      simpleTable({
        columns: [{ width: 500, align: 'right' }],
        rows: [{ cells: [leftCell] }],
      }),
    );

    // Column says 'right', cell uses default (inherits)
    const { ops: inheritOps } = renderTable(
      simpleTable({
        columns: [{ width: 500, align: 'right' }],
        rows: [{ cells: ['Override'] }],
      }),
    );

    const overrideCoords = extractTdCoords(overrideOps);
    const inheritCoords = extractTdCoords(inheritOps);

    // Left-aligned should be at a different X than right-aligned
    expect(overrideCoords[0]!.x).not.toBeCloseTo(inheritCoords[0]!.x, 1);
  });
});

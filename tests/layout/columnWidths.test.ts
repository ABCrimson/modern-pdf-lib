/**
 * Tests for column width modes: fixed, percentage, flex, auto-fit.
 *
 * Covers resolveColumnWidths() with all width mode combinations,
 * minWidth/maxWidth constraints, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { resolveColumnWidths } from '../../src/layout/table.js';
import type { DrawTableOptions } from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 0,
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

describe('resolveColumnWidths', () => {
  // 1
  it('fixed width columns use exact values', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        columns: [{ width: 100 }, { width: 200 }, { width: 200 }],
      }),
    );
    expect(widths).toEqual([100, 200, 200]);
  });

  // 2
  it('percentage width columns compute from table width', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        columns: [{ percentage: '50%' }, { percentage: '30%' }, { percentage: '20%' }],
      }),
    );
    expect(widths[0]).toBeCloseTo(250, 5);
    expect(widths[1]).toBeCloseTo(150, 5);
    expect(widths[2]).toBeCloseTo(100, 5);
  });

  // 3
  it('flex columns distribute remaining space equally by default', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 600,
        columns: [{}, {}, {}],
      }),
    );
    expect(widths[0]).toBeCloseTo(200, 5);
    expect(widths[1]).toBeCloseTo(200, 5);
    expect(widths[2]).toBeCloseTo(200, 5);
  });

  // 4
  it('mixed fixed + flex columns distribute remaining space', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        columns: [{ width: 100 }, {}, {}],
      }),
    );
    expect(widths[0]).toBe(100);
    // Remaining 400 split between 2 flex columns
    expect(widths[1]).toBeCloseTo(200, 5);
    expect(widths[2]).toBeCloseTo(200, 5);
  });

  // 5
  it('mixed fixed + percentage columns', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        columns: [{ width: 150 }, { percentage: '40%' }, { percentage: '30%' }],
      }),
    );
    expect(widths[0]).toBe(150);
    expect(widths[1]).toBeCloseTo(200, 5); // 40% of 500
    expect(widths[2]).toBeCloseTo(150, 5); // 30% of 500
  });

  // 6
  it('auto-fit estimates width from content', () => {
    // Content "Hello" = 5 chars, fontSize 12 => 5 * 12 * 0.5 = 30 + padding(4+4) = 38
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        fontSize: 12,
        padding: 4,
        rows: [{ cells: ['Hello', 'B', 'C'] }],
        columns: [{ autoFit: true }, {}, {}],
      }),
    );
    // Auto-fit column should be approximately 38
    expect(widths[0]).toBeCloseTo(38, 1);
    // Remaining space goes to flex columns
    const remaining = 500 - widths[0]!;
    expect(widths[1]).toBeCloseTo(remaining / 2, 1);
    expect(widths[2]).toBeCloseTo(remaining / 2, 1);
  });

  // 7
  it('minWidth constraint is applied', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        columns: [{ width: 450 }, { minWidth: 80 }, {}],
      }),
    );
    // Column 1 would get (500-450)/2 = 25, but minWidth is 80
    expect(widths[1]).toBe(80);
  });

  // 8
  it('maxWidth constraint is applied', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 600,
        columns: [{}, {}, { maxWidth: 50 }],
      }),
    );
    // Without constraint each flex col = 200, but col 2 is capped at 50
    expect(widths[2]).toBe(50);
  });

  // 9
  it('all flex columns equal distribution', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 900,
        columns: [{}, {}, {}],
      }),
    );
    expect(widths[0]).toBeCloseTo(300, 5);
    expect(widths[1]).toBeCloseTo(300, 5);
    expect(widths[2]).toBeCloseTo(300, 5);
  });

  // 10
  it('weighted flex (flex: 2 gets double flex: 1)', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 600,
        columns: [{ flex: 1 }, { flex: 2 }, { flex: 1 }],
      }),
    );
    // Total flex weight = 4, column 0 = 1/4 * 600 = 150, etc.
    expect(widths[0]).toBeCloseTo(150, 5);
    expect(widths[1]).toBeCloseTo(300, 5);
    expect(widths[2]).toBeCloseTo(150, 5);
  });

  // 11
  it('single column takes full width', () => {
    const widths = resolveColumnWidths({
      x: 0,
      y: 700,
      width: 400,
      rows: [{ cells: ['Only'] }],
      columns: [{}],
    });
    expect(widths).toHaveLength(1);
    expect(widths[0]).toBeCloseTo(400, 5);
  });

  // 12
  it('invalid percentage is treated as flex', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 600,
        columns: [{ percentage: 'abc' }, { percentage: '50%' }, {}],
      }),
    );
    // 'abc' is invalid => treated as flex
    // '50%' => 300
    // remaining: 600 - 300 = 300, split between two flex columns (weight 1 each)
    expect(widths[1]).toBeCloseTo(300, 5);
    expect(widths[0]).toBeCloseTo(150, 5);
    expect(widths[2]).toBeCloseTo(150, 5);
  });

  // 13
  it('no column definitions produce equal widths', () => {
    const widths = resolveColumnWidths(
      makeOptions({ width: 300 }),
    );
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBeCloseTo(100, 5);
    expect(widths[1]).toBeCloseTo(100, 5);
    expect(widths[2]).toBeCloseTo(100, 5);
  });

  // 14
  it('mixed fixed + percentage + flex columns', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 1000,
        columns: [{ width: 200 }, { percentage: '30%' }, {}],
      }),
    );
    expect(widths[0]).toBe(200);         // fixed
    expect(widths[1]).toBeCloseTo(300, 5); // 30% of 1000
    expect(widths[2]).toBeCloseTo(500, 5); // remaining flex
  });

  // 15
  it('auto-fit picks widest content across rows', () => {
    const widths = resolveColumnWidths(
      makeOptions({
        width: 500,
        fontSize: 10,
        padding: 5,
        rows: [
          { cells: ['AB', 'X', 'Y'] },         // col0: 2*10*0.5 + 10 = 20
          { cells: ['ABCDEFGH', 'X', 'Y'] },   // col0: 8*10*0.5 + 10 = 50
        ],
        columns: [{ autoFit: true }, {}, {}],
      }),
    );
    // Should use the widest: 8 * 10 * 0.5 + 5 + 5 = 50
    expect(widths[0]).toBeCloseTo(50, 1);
  });
});

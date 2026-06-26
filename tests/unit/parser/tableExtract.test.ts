/**
 * Tests for parser/tableExtract — whitespace-based table extraction from
 * positioned text items.
 *
 * Coverage:
 * - A synthetic 2-row x 3-col grid (header + one data row) reconstructs to a
 *   single ExtractedTable with the right shape and cell values.
 * - Column/row clustering tolerates small positional jitter.
 * - Items in the same row+column concatenate with a space.
 * - Missing cells become the empty string.
 * - tableToCsv quotes fields containing commas, quotes and newlines (RFC 4180).
 * - tableToJson maps the header row to keys for each data row.
 * - Edge cases: empty input, single-row input, custom tolerances.
 */

import { describe, it, expect } from 'vitest';
import {
  extractTables,
  tableToCsv,
  tableToJson,
} from '../../../src/parser/tableExtract.js';
import type {
  ExtractedTable,
  TableExtractOptions,
} from '../../../src/parser/tableExtract.js';
import type { TextItem } from '../../../src/parser/textExtractor.js';

/** Build a TextItem with sensible defaults for the geometric fields. */
function item(text: string, x: number, y: number, overrides: Partial<TextItem> = {}): TextItem {
  return {
    text,
    x,
    y,
    width: overrides.width ?? text.length * 5,
    height: overrides.height ?? 10,
    fontSize: overrides.fontSize ?? 10,
    fontName: overrides.fontName ?? '/F1',
  };
}

/**
 * A 2-row x 3-col grid.
 *
 *   Name    | Age | City
 *   --------+-----+----------
 *   Alice   | 30  | Wonderland
 *
 * Column x-anchors: 50, 150, 250.  Rows at y = 700 (header) and y = 680.
 */
function gridItems(): TextItem[] {
  return [
    item('Name', 50, 700),
    item('Age', 150, 700),
    item('City', 250, 700),
    item('Alice', 50, 680),
    item('30', 150, 680),
    item('Wonderland', 250, 680),
  ];
}

describe('extractTables', () => {
  it('reconstructs a 2x3 grid into a single table', () => {
    const tables = extractTables(gridItems());
    expect(tables).toHaveLength(1);

    const table = tables[0];
    expect(table).toBeDefined();
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]).toEqual(['Name', 'Age', 'City']);
    expect(table?.rows[1]).toEqual(['Alice', '30', 'Wonderland']);
  });

  it('every row has the same number of columns as the column buckets', () => {
    const [table] = extractTables(gridItems());
    const widths = new Set(table?.rows.map((r) => r.length));
    expect(widths.size).toBe(1);
    expect([...widths][0]).toBe(3);
  });

  it('tolerates small positional jitter within tolerance', () => {
    const jittered: TextItem[] = [
      item('Name', 50, 700.4),
      item('Age', 151, 699.6),
      item('City', 249, 700.2),
      item('Alice', 49, 680.3),
      item('30', 150, 679.8),
      item('Wonderland', 251, 680.1),
    ];
    const [table] = extractTables(jittered);
    expect(table?.rows).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'Wonderland'],
    ]);
  });

  it('concatenates multiple items in the same row+column with a space', () => {
    const items: TextItem[] = [
      item('First', 50, 700),
      item('Name', 52, 700), // same column bucket as First
      item('Age', 150, 700),
      item('John', 50, 680),
      item('Doe', 51, 680),
      item('40', 150, 680),
    ];
    const [table] = extractTables(items, { colTolerance: 5 });
    expect(table?.rows[0]?.[0]).toBe('First Name');
    expect(table?.rows[1]?.[0]).toBe('John Doe');
  });

  it('fills missing cells with the empty string', () => {
    const items: TextItem[] = [
      item('A', 50, 700),
      item('B', 150, 700),
      item('C', 250, 700),
      item('X', 50, 680),
      // no middle cell at x≈150
      item('Z', 250, 680),
    ];
    const [table] = extractTables(items);
    expect(table?.rows[1]).toEqual(['X', '', 'Z']);
  });

  it('returns an empty array for empty input', () => {
    expect(extractTables([])).toEqual([]);
  });

  it('does not emit a table for a single content row', () => {
    const items: TextItem[] = [
      item('Only', 50, 700),
      item('One', 150, 700),
      item('Row', 250, 700),
    ];
    expect(extractTables(items)).toEqual([]);
  });

  it('respects an explicit rowTolerance option', () => {
    // Two visually distinct rows only 4 units apart; a tight tolerance keeps
    // them separate, a loose one would merge them.
    const items: TextItem[] = [
      item('H1', 50, 704),
      item('H2', 150, 704),
      item('D1', 50, 700),
      item('D2', 150, 700),
    ];
    const opts: TableExtractOptions = { rowTolerance: 1 };
    const [table] = extractTables(items, opts);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]).toEqual(['H1', 'H2']);
    expect(table?.rows[1]).toEqual(['D1', 'D2']);
  });
});

describe('tableToCsv', () => {
  it('produces plain CSV for simple fields', () => {
    const [table] = extractTables(gridItems());
    expect(table).toBeDefined();
    const csv = tableToCsv(table as ExtractedTable);
    expect(csv).toBe('Name,Age,City\r\nAlice,30,Wonderland');
  });

  it('quotes fields containing a comma (RFC 4180)', () => {
    const table: ExtractedTable = {
      rows: [
        ['Name', 'Note'],
        ['Bob', 'Likes apples, oranges'],
      ],
    };
    const csv = tableToCsv(table);
    expect(csv).toBe('Name,Note\r\nBob,"Likes apples, oranges"');
  });

  it('doubles embedded quotes and wraps the field', () => {
    const table: ExtractedTable = {
      rows: [
        ['Quote'],
        ['She said "hi"'],
      ],
    };
    const csv = tableToCsv(table);
    expect(csv).toBe('Quote\r\n"She said ""hi"""');
  });

  it('quotes fields containing newlines', () => {
    const table: ExtractedTable = {
      rows: [
        ['Multi'],
        ['line1\nline2'],
      ],
    };
    const csv = tableToCsv(table);
    expect(csv).toBe('Multi\r\n"line1\nline2"');
  });
});

describe('tableToJson', () => {
  it('maps the header row to keys for each data row', () => {
    const [table] = extractTables(gridItems());
    expect(table).toBeDefined();
    const json = tableToJson(table as ExtractedTable);
    expect(json).toEqual([
      { Name: 'Alice', Age: '30', City: 'Wonderland' },
    ]);
  });

  it('handles multiple data rows', () => {
    const table: ExtractedTable = {
      rows: [
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ],
    };
    expect(tableToJson(table)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('returns an empty array when there are no data rows', () => {
    const table: ExtractedTable = { rows: [['only', 'header']] };
    expect(tableToJson(table)).toEqual([]);
  });

  it('returns an empty array for an empty table', () => {
    expect(tableToJson({ rows: [] })).toEqual([]);
  });
});

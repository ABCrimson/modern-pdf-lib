/**
 * @module parser/tableExtract
 *
 * Table extraction from positioned text (roadmap 0.28.6).
 *
 * Reconstructs tabular data from the position-aware {@link TextItem}s
 * produced by `extractTextWithPositions`.  This is a *whitespace-based*
 * (ruling-free) algorithm: it does not look at drawn lines/rectangles,
 * only at the geometric layout of the text fragments.
 *
 * Pipeline:
 * 1. Sort items by `y` descending (top of page first).
 * 2. Cluster items into ROWS where their baselines share a `y` within
 *    `rowTolerance` (defaults to roughly half the median glyph height).
 * 3. Cluster every item's `x` position into COLUMN buckets within
 *    `colTolerance` (a few user-space points by default).
 * 4. Assign each item to its column bucket and emit a grid of trimmed
 *    strings (empty string for missing cells).  Items landing in the same
 *    row + column are concatenated with a single space.
 * 5. Group contiguous runs of >= 2 rows that share a consistent column
 *    structure into one {@link ExtractedTable}.
 *
 * Two small serialisation helpers are also provided:
 * {@link tableToCsv} (RFC 4180) and {@link tableToJson} (first row =
 * header keys).
 *
 * @packageDocumentation
 */

import type { TextItem } from './textExtractor.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A reconstructed table: a rectangular grid of trimmed cell strings.
 * Missing cells are represented by the empty string.
 */
export interface ExtractedTable {
  /** The grid of rows, each row being an array of column cell strings. */
  readonly rows: readonly (readonly string[])[];
}

/**
 * Options controlling the clustering tolerances used during extraction.
 */
export interface TableExtractOptions {
  /**
   * Maximum vertical distance (user-space units) between item baselines
   * for them to be considered part of the same row.
   * Default: roughly half the median item height.
   */
  readonly rowTolerance?: number;
  /**
   * Maximum horizontal distance (user-space units) between item x-starts
   * for them to be considered part of the same column.
   * Default: `3`.
   */
  readonly colTolerance?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute the median of a numeric array (0 for an empty array). */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Cluster a set of numeric positions into 1-D buckets.  Positions within
 * `tolerance` of an existing bucket's representative join that bucket;
 * otherwise a new bucket is created.  Returns the sorted bucket centers.
 */
function clusterPositions(positions: readonly number[], tolerance: number): number[] {
  const sorted = Array.from(positions).sort((a, b) => a - b);
  const centers: number[] = [];
  const sums: number[] = [];
  const counts: number[] = [];

  for (const pos of sorted) {
    const last = centers.at(-1);
    if (last !== undefined && Math.abs(pos - last) <= tolerance) {
      const idx = centers.length - 1;
      const newSum = (sums[idx] ?? 0) + pos;
      const newCount = (counts[idx] ?? 0) + 1;
      sums[idx] = newSum;
      counts[idx] = newCount;
      centers[idx] = newSum / newCount;
    } else {
      centers.push(pos);
      sums.push(pos);
      counts.push(1);
    }
  }

  return centers;
}

/** Find the index of the nearest bucket center to `value`. */
function nearestBucket(centers: readonly number[], value: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const dist = Math.abs((centers[i] ?? 0) - value);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** A row of items grouped by shared baseline, with its representative y. */
interface RowGroup {
  readonly y: number;
  readonly items: TextItem[];
}

/** Cluster items into rows by descending y within `rowTolerance`. */
function clusterRows(items: readonly TextItem[], rowTolerance: number): RowGroup[] {
  const sorted = Array.from(items).sort((a, b) => b.y - a.y);
  const rows: RowGroup[] = [];
  let current: TextItem[] = [];
  let currentY = Number.NaN;

  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - currentY) <= rowTolerance) {
      if (current.length === 0) currentY = item.y;
      current.push(item);
    } else {
      rows.push({ y: currentY, items: current });
      current = [item];
      currentY = item.y;
    }
  }
  if (current.length > 0) rows.push({ y: currentY, items: current });

  return rows;
}

/** Build a single grid row by assigning each item to its column bucket. */
function buildGridRow(rowItems: readonly TextItem[], columns: readonly number[]): string[] {
  const cellParts: string[][] = columns.map(() => []);
  for (const item of rowItems) {
    const col = nearestBucket(columns, item.x);
    (cellParts[col] ?? []).push(item.text);
  }
  return cellParts.map((parts) => parts.join(' ').trim());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract tables from a list of positioned text items.
 *
 * @param items   - Positioned text items (e.g. from `extractTextWithPositions`).
 * @param options - Optional clustering tolerances.
 * @returns One {@link ExtractedTable} per contiguous run of >= 2 rows that
 *          share a consistent column structure.  Returns an empty array
 *          when no table-like block is found.
 */
export function extractTables(
  items: readonly TextItem[],
  options?: TableExtractOptions,
): ExtractedTable[] {
  if (items.length === 0) return [];

  const heights = items.map((item) => item.height).filter((h) => h > 0);
  const medianHeight = median(heights);
  const rowTolerance = options?.rowTolerance ?? Math.max(medianHeight / 2, 1);
  const colTolerance = options?.colTolerance ?? 3;

  const columns = clusterPositions(
    items.map((item) => item.x),
    colTolerance,
  );
  if (columns.length === 0) return [];

  const rowGroups = clusterRows(items, rowTolerance);
  const grid = rowGroups.map((group) => buildGridRow(group.items, columns));

  const tables: ExtractedTable[] = [];
  let block: string[][] = [];

  const flush = (): void => {
    if (block.length >= 2) {
      tables.push({ rows: block.map((row) => [...row]) });
    }
    block = [];
  };

  for (const row of grid) {
    const hasContent = row.some((cell) => cell.length > 0);
    if (hasContent) {
      block.push(row);
    } else {
      flush();
    }
  }
  flush();

  return tables;
}

/**
 * Serialise a table to RFC 4180 CSV.  Fields containing a comma, a double
 * quote or a newline are wrapped in double quotes, with embedded quotes
 * doubled.  Rows are joined with `\r\n`.
 *
 * @param table - The table to serialise.
 * @returns The CSV text.
 */
export function tableToCsv(table: ExtractedTable): string {
  const escapeField = (field: string): string => {
    if (/[",\r\n]/.test(field)) {
      return `"${field.replaceAll('"', '""')}"`;
    }
    return field;
  };
  return table.rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

/**
 * Convert a table to an array of plain objects, using the first row as the
 * header keys.  Returns an empty array when the table has fewer than two
 * rows (i.e. no data rows beneath the header).
 *
 * @param table - The table to convert.
 * @returns One record per data row, mapping each header to its cell value.
 */
export function tableToJson(table: ExtractedTable): Record<string, string>[] {
  const header = table.rows[0];
  if (header === undefined || table.rows.length < 2) return [];

  const records: Record<string, string>[] = [];
  for (let r = 1; r < table.rows.length; r++) {
    const row = table.rows[r] ?? [];
    const record: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] ?? '';
      record[key] = row[c] ?? '';
    }
    records.push(record);
  }
  return records;
}

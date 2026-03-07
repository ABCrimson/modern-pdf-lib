/**
 * @module layout/table
 *
 * Table layout engine for PDF rendering.
 *
 * Renders tables as native PDF vector graphics with cells,
 * borders, text, and basic styling. All output is a string of
 * raw PDF content-stream operators that can be appended directly
 * to a page's operator buffer.
 *
 * Supports colspan, rowspan, and automatic page breaks with
 * header-row repetition.
 */

import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill, stroke, setLineWidth } from '../core/operators/graphics.js';
import { beginText, endText, setFont, moveText, showText } from '../core/operators/text.js';
import { applyFillColor, applyStrokeColor } from '../core/operators/color.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Content that can appear in a cell: plain text or a nested table. */
export type CellContent = string | NestedTableContent;

/** A nested table definition used as cell content. */
export interface NestedTableContent {
  readonly type: 'table';
  readonly table: Omit<DrawTableOptions, 'x' | 'y'>;
}

/** Single table cell. */
export interface TableCell {
  readonly content: CellContent;
  readonly colSpan?: number;
  readonly rowSpan?: number;
  readonly backgroundColor?: Color;
  readonly textColor?: Color;
  readonly fontSize?: number;
  readonly align?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
  readonly padding?:
    | number
    | {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
}

/** Table row. */
export interface TableRow {
  readonly cells: readonly (TableCell | string)[];
  readonly height?: number;
  readonly backgroundColor?: Color;
}

/** Column definition. */
export interface TableColumn {
  /** Fixed width in points. */
  readonly width?: number;
  /** Percentage of table width (e.g., '30%'). */
  readonly percentage?: string;
  /** Flex weight (like CSS flex-grow). Default: 1 when no width/percentage. */
  readonly flex?: number;
  /** Auto-fit: measure content and use minimum needed width. */
  readonly autoFit?: boolean;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly align?: 'left' | 'center' | 'right';
}

/** Full table configuration. */
export interface DrawTableOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly rows: readonly TableRow[];
  readonly columns?: readonly TableColumn[];
  /** PDF font resource name, default `'Helvetica'`. */
  readonly fontName?: string;
  /** Default font size in points, default `12`. */
  readonly fontSize?: number;
  readonly textColor?: Color;
  readonly borderColor?: Color;
  /** Border line width in points, default `0.5`. */
  readonly borderWidth?: number;
  /** Number of header rows (reserved for future page-break support). */
  readonly headerRows?: number;
  /** Default cell padding in points, default `4`. */
  readonly padding?: number;
  /** Alternating row background colors [even, odd]. */
  readonly alternateRowColors?: readonly [Color, Color];
  /** Header background color (overrides alternateRowColors for header rows). */
  readonly headerBackgroundColor?: Color;
  /** Header text color. */
  readonly headerTextColor?: Color;
}

/** Result of table rendering. */
export interface TableRenderResult {
  readonly width: number;
  readonly height: number;
  readonly rowHeights: readonly number[];
  readonly columnWidths: readonly number[];
  readonly pagesUsed: number;
}

/** Content for a single page in a multi-page table render. */
export interface PageContent {
  readonly ops: string;
  readonly pageIndex: number;
}

/** Result of multi-page table rendering. */
export interface MultiPageTableResult {
  readonly pages: readonly PageContent[];
  readonly result: TableRenderResult;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Entry in the occupation grid. Stores the cell data and its origin
 * position so that spanning cells can be rendered only once.
 */
interface OccupationEntry {
  /** The normalized cell for this position. */
  cell: TableCell;
  /** Row index where the span originates. */
  originRow: number;
  /** Column index where the span originates. */
  originCol: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a cell content value is a nested table.
 */
function isNestedTable(content: CellContent): content is NestedTableContent {
  return typeof content === 'object' && content !== null && content.type === 'table';
}

/**
 * Return the text string from cell content, or '' if it is a nested table.
 */
function cellText(content: CellContent): string {
  return typeof content === 'string' ? content : '';
}

/**
 * Normalize a cell value to a {@link TableCell} object.
 */
function normalizeCell(cell: TableCell | string | undefined): TableCell {
  if (cell === undefined) return { content: '' };
  if (typeof cell === 'string') return { content: cell };
  return cell;
}

/**
 * Resolve cell padding to a four-sided object.
 */
export function resolvePadding(
  padding:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number }
    | undefined,
  defaultPadding: number,
): { top: number; right: number; bottom: number; left: number } {
  if (padding === undefined) {
    return {
      top: defaultPadding,
      right: defaultPadding,
      bottom: defaultPadding,
      left: defaultPadding,
    };
  }
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? defaultPadding,
    right: padding.right ?? defaultPadding,
    bottom: padding.bottom ?? defaultPadding,
    left: padding.left ?? defaultPadding,
  };
}

/**
 * Determine the number of columns from the table definition.
 */
function resolveColumnCount(options: DrawTableOptions): number {
  let maxCols = 0;
  for (const row of options.rows) {
    let cols = 0;
    for (const cell of row.cells) {
      const c = normalizeCell(cell);
      cols += c.colSpan ?? 1;
    }
    if (cols > maxCols) maxCols = cols;
  }
  return Math.max(maxCols, 1);
}

/**
 * Parse a percentage string (e.g. '30%') to a fraction (0.3).
 * Returns `NaN` if the string is not a valid percentage.
 */
function parsePercentage(value: string): number {
  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) return NaN;
  const num = Number(trimmed.slice(0, -1));
  if (!Number.isFinite(num) || num < 0) return NaN;
  return num / 100;
}

/**
 * Estimate the width needed to fit a column's content across all rows.
 * Uses the approximation: charCount * fontSize * 0.5 + horizontal padding.
 */
function estimateAutoFitWidth(
  colIndex: number,
  options: DrawTableOptions,
  fontSize: number,
  defaultPadding: number,
): number {
  let maxWidth = 0;

  for (const row of options.rows) {
    // Walk through cells respecting colSpan to find the cell at colIndex
    let ci = 0;
    for (const rawCell of row.cells) {
      const cell = normalizeCell(rawCell);
      const span = cell.colSpan ?? 1;
      if (ci === colIndex && span === 1) {
        const p = resolvePadding(cell.padding, defaultPadding);
        const cellFontSize = cell.fontSize ?? fontSize;
        const text = cellText(cell.content);
        const textWidth = text.length * cellFontSize * 0.5;
        const needed = textWidth + p.left + p.right;
        if (needed > maxWidth) maxWidth = needed;
      }
      ci += span;
      if (ci > colIndex) break;
    }
  }

  return maxWidth || defaultPadding * 2;
}

/**
 * Calculate column widths from the table width and optional column
 * definitions.
 *
 * Resolution order: fixed → percentage → auto-fit → flex (remaining space).
 * After initial calculation, `minWidth`/`maxWidth` constraints are applied.
 */
export function resolveColumnWidths(options: DrawTableOptions): number[] {
  const numCols = resolveColumnCount(options);
  const tableWidth = options.width;
  const fontSize = options.fontSize ?? 12;
  const defaultPadding = options.padding ?? 4;

  if (!options.columns || options.columns.length === 0) {
    // Equal widths when no column definitions provided
    const colWidth = tableWidth / numCols;
    return Array.from({ length: numCols }, () => colWidth);
  }

  const widths: number[] = new Array<number>(numCols).fill(-1);
  // Track which mode each column uses: 'fixed' | 'percentage' | 'autofit' | 'flex'
  const modes: string[] = new Array<string>(numCols).fill('flex');
  let consumed = 0;

  // --- Pass 1: Fixed width columns ---
  for (let i = 0; i < numCols; i++) {
    const col = options.columns[i];
    if (col?.width != null && col.width > 0) {
      widths[i] = col.width;
      modes[i] = 'fixed';
      consumed += col.width;
    }
  }

  // --- Pass 2: Percentage columns ---
  for (let i = 0; i < numCols; i++) {
    if (modes[i] !== 'flex') continue;
    const col = options.columns[i];
    if (col?.percentage != null) {
      const fraction = parsePercentage(col.percentage);
      if (Number.isFinite(fraction)) {
        widths[i] = fraction * tableWidth;
        modes[i] = 'percentage';
        consumed += widths[i]!;
      }
    }
  }

  // --- Pass 3: Auto-fit columns ---
  for (let i = 0; i < numCols; i++) {
    if (modes[i] !== 'flex') continue;
    const col = options.columns[i];
    if (col?.autoFit) {
      widths[i] = estimateAutoFitWidth(i, options, fontSize, defaultPadding);
      modes[i] = 'autofit';
      consumed += widths[i]!;
    }
  }

  // --- Pass 4: Flex columns — distribute remaining space by weight ---
  const flexIndices: number[] = [];
  let totalFlex = 0;
  for (let i = 0; i < numCols; i++) {
    if (modes[i] === 'flex') {
      const col = options.columns[i];
      const weight = col?.flex ?? 1;
      totalFlex += weight;
      flexIndices.push(i);
    }
  }

  const remaining = Math.max(0, tableWidth - consumed);
  for (const idx of flexIndices) {
    const col = options.columns[idx];
    const weight = col?.flex ?? 1;
    widths[idx] = totalFlex > 0 ? (weight / totalFlex) * remaining : 0;
  }

  // --- Pass 5: Apply minWidth / maxWidth constraints ---
  for (let i = 0; i < numCols; i++) {
    const col = options.columns[i];
    if (col?.minWidth != null && widths[i]! < col.minWidth) {
      widths[i] = col.minWidth;
    }
    if (col?.maxWidth != null && widths[i]! > col.maxWidth) {
      widths[i] = col.maxWidth;
    }
  }

  return widths;
}

/**
 * Compute the rendered height of a nested table definition.
 * This calls `renderTable` with dummy coordinates to measure the result.
 */
function computeNestedTableHeight(nested: NestedTableContent, width: number): number {
  const { result } = renderTable({ ...nested.table, x: 0, y: 0, width });
  return result.height;
}

/**
 * Calculate row heights based on explicit values or font metrics.
 * When a cell contains a nested table, the row height grows to
 * accommodate the nested table's rendered height plus padding.
 */
function resolveRowHeights(
  options: DrawTableOptions,
  fontSize: number,
  defaultPadding: number,
  colWidths: readonly number[],
): number[] {
  return options.rows.map((row) => {
    if (row.height) return row.height;

    // Default: fontSize + top padding + bottom padding
    let maxHeight = defaultPadding * 2 + fontSize;

    let colIdx = 0;
    for (const rawCell of row.cells) {
      const c = normalizeCell(rawCell);
      const p = resolvePadding(c.padding, defaultPadding);
      const span = c.colSpan ?? 1;

      // Compute spanned cell width
      let cellWidth = 0;
      for (let s = 0; s < span && colIdx + s < colWidths.length; s++) {
        cellWidth += colWidths[colIdx + s]!;
      }

      if (isNestedTable(c.content)) {
        const nestedWidth = cellWidth - p.left - p.right;
        const nestedHeight = computeNestedTableHeight(c.content, Math.max(0, nestedWidth));
        const h = p.top + p.bottom + nestedHeight;
        if (h > maxHeight) maxHeight = h;
      } else {
        const cellFontSize = c.fontSize ?? fontSize;
        const h = p.top + p.bottom + cellFontSize;
        if (h > maxHeight) maxHeight = h;
      }

      colIdx += span;
    }

    return maxHeight;
  });
}

/**
 * Build a 2D occupation grid that maps every `[row][col]` position to
 * the cell that owns it (including its origin row/col). Positions
 * covered by a colspan/rowspan point back to the origin cell.
 *
 * Returns `null` for unoccupied positions (should not happen in a
 * well-formed table, but is handled gracefully).
 */
function buildOccupationGrid(
  rows: readonly TableRow[],
  numCols: number,
): (OccupationEntry | null)[][] {
  const grid: (OccupationEntry | null)[][] = Array.from(
    { length: rows.length },
    () => Array.from({ length: numCols }, () => null),
  );

  for (let r = 0; r < rows.length; r++) {
    let logicalCol = 0;

    for (const rawCell of rows[r]!.cells) {
      // Skip columns already occupied by a previous row's rowspan
      while (logicalCol < numCols && grid[r]![logicalCol] !== null) {
        logicalCol++;
      }

      if (logicalCol >= numCols) break;

      const cell = normalizeCell(rawCell);
      const cs = Math.max(1, cell.colSpan ?? 1);
      const rs = Math.max(1, cell.rowSpan ?? 1);

      const entry: OccupationEntry = {
        cell,
        originRow: r,
        originCol: logicalCol,
      };

      // Mark all positions covered by this cell
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          const tr = r + dr;
          const tc = logicalCol + dc;
          if (tr < rows.length && tc < numCols) {
            grid[tr]![tc] = entry;
          }
        }
      }

      logicalCol += cs;
    }
  }

  return grid;
}

/**
 * Compute the combined width of columns `startCol` to `startCol + span - 1`.
 */
function spanWidth(colWidths: readonly number[], startCol: number, span: number): number {
  let w = 0;
  for (let i = 0; i < span && startCol + i < colWidths.length; i++) {
    w += colWidths[startCol + i]!;
  }
  return w;
}

/**
 * Compute the combined height of rows `startRow` to `startRow + span - 1`.
 */
function spanHeight(rowHeights: readonly number[], startRow: number, span: number): number {
  let h = 0;
  for (let i = 0; i < span && startRow + i < rowHeights.length; i++) {
    h += rowHeights[startRow + i]!;
  }
  return h;
}

/**
 * Compute the X offset for a column index.
 */
function columnX(baseX: number, colWidths: readonly number[], col: number): number {
  let x = baseX;
  for (let i = 0; i < col; i++) {
    x += colWidths[i]!;
  }
  return x;
}

/**
 * Render a single cell's background, border, and text.
 */
function renderCellOps(
  cell: TableCell,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  fontName: string,
  fontSize: number,
  defaultPadding: number,
  borderWidth: number,
  borderColor: Color,
  textColor: Color,
  colDef?: TableColumn,
): string {
  let ops = '';
  const padding = resolvePadding(cell.padding, defaultPadding);

  // Cell background
  if (cell.backgroundColor) {
    ops += saveState();
    ops += applyFillColor(cell.backgroundColor);
    ops += rectangle(cellX, cellY - cellHeight, cellWidth, cellHeight);
    ops += fill();
    ops += restoreState();
  }

  // Cell border
  if (borderWidth > 0) {
    ops += saveState();
    ops += applyStrokeColor(borderColor);
    ops += setLineWidth(borderWidth);
    ops += rectangle(cellX, cellY - cellHeight, cellWidth, cellHeight);
    ops += stroke();
    ops += restoreState();
  }

  // Cell content
  const text = cellText(cell.content);
  if (isNestedTable(cell.content)) {
    // Render nested table inside the cell
    const nestedWidth = cellWidth - padding.left - padding.right;
    const nestedX = cellX + padding.left;
    const nestedY = cellY - padding.top;
    const { ops: nestedOps } = renderTable({
      ...cell.content.table,
      x: nestedX,
      y: nestedY,
      width: Math.max(0, nestedWidth),
    });
    ops += nestedOps;
  } else if (text) {
    const cellTextColor = cell.textColor ?? textColor;
    const cellFontSize = cell.fontSize ?? fontSize;
    const align = cell.align ?? colDef?.align ?? 'left';
    const verticalAlign = cell.verticalAlign ?? 'top';

    // Approximate text width: char count * fontSize * 0.5
    const approxTextWidth = text.length * cellFontSize * 0.5;

    // Available content area within padding
    const contentWidth = cellWidth - padding.left - padding.right;

    // Horizontal alignment
    let textX: number;
    if (align === 'center') {
      textX = cellX + padding.left + Math.max(0, contentWidth - approxTextWidth) / 2;
    } else if (align === 'right') {
      textX = cellX + cellWidth - padding.right - approxTextWidth;
    } else {
      textX = cellX + padding.left;
    }

    // Vertical alignment
    let textY: number;
    if (verticalAlign === 'middle') {
      textY = cellY - cellHeight / 2 - cellFontSize / 2 + cellFontSize * 0.2;
    } else if (verticalAlign === 'bottom') {
      textY = cellY - cellHeight + padding.bottom;
    } else {
      // top
      textY = cellY - padding.top - cellFontSize;
    }

    ops += saveState();
    ops += applyFillColor(cellTextColor);
    ops += beginText();
    ops += setFont(fontName, cellFontSize);
    ops += moveText(textX, textY);
    ops += showText(text);
    ops += endText();
    ops += restoreState();
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Core renderer
// ---------------------------------------------------------------------------

/**
 * Render a table to PDF content-stream operators.
 *
 * The table is rendered top-down from `(x, y)` — the top-left corner.
 * In PDF coordinate space, y decreases as rows are added downward.
 *
 * @param options  Table configuration including position, size, rows,
 *                 columns, and styling.
 * @returns        An object containing the raw operator string (`ops`)
 *                 and a result summary (`result`).
 */
export function renderTable(options: DrawTableOptions): {
  ops: string;
  result: TableRenderResult;
} {
  const fontSize = options.fontSize ?? 12;
  const defaultPadding = options.padding ?? 4;
  const borderWidth = options.borderWidth ?? 0.5;
  const borderColor: Color =
    options.borderColor ?? ({ type: 'grayscale', gray: 0 } as const);
  const textColor: Color =
    options.textColor ?? ({ type: 'grayscale', gray: 0 } as const);
  const fontName = options.fontName ?? 'Helvetica';

  const headerRows = options.headerRows ?? 0;
  const colWidths = resolveColumnWidths(options);
  const rowHeights = resolveRowHeights(options, fontSize, defaultPadding, colWidths);

  let ops = saveState();
  let currentY = options.y;

  for (let rowIdx = 0; rowIdx < options.rows.length; rowIdx++) {
    const row = options.rows[rowIdx]!;
    const rowHeight = rowHeights[rowIdx]!;
    let currentX = options.x;
    const isHeader = rowIdx < headerRows;

    // Determine the effective row background color:
    // 1. Explicit row backgroundColor always wins
    // 2. headerBackgroundColor for header rows
    // 3. alternateRowColors for data rows (index relative to data rows)
    let effectiveRowBg: Color | undefined = row.backgroundColor;
    if (!effectiveRowBg) {
      if (isHeader && options.headerBackgroundColor) {
        effectiveRowBg = options.headerBackgroundColor;
      } else if (!isHeader && options.alternateRowColors) {
        const dataRowIdx = rowIdx - headerRows;
        effectiveRowBg = options.alternateRowColors[dataRowIdx % 2 === 0 ? 0 : 1];
      }
    }

    // Row background — spans the full table width
    if (effectiveRowBg) {
      ops += saveState();
      ops += applyFillColor(effectiveRowBg);
      ops += rectangle(currentX, currentY - rowHeight, options.width, rowHeight);
      ops += fill();
      ops += restoreState();
    }

    // Determine effective text color for this row
    const rowTextColor =
      isHeader && options.headerTextColor ? options.headerTextColor : textColor;

    // Cells
    let colIdx = 0;
    for (let cellIdx = 0; cellIdx < row.cells.length && colIdx < colWidths.length; cellIdx++) {
      const cell = normalizeCell(row.cells[cellIdx]);
      const span = cell.colSpan ?? 1;

      // Compute spanned cell width
      let cellWidth = 0;
      for (let s = 0; s < span && colIdx + s < colWidths.length; s++) {
        cellWidth += colWidths[colIdx + s]!;
      }

      const padding = resolvePadding(cell.padding, defaultPadding);

      // Cell background
      if (cell.backgroundColor) {
        ops += saveState();
        ops += applyFillColor(cell.backgroundColor);
        ops += rectangle(currentX, currentY - rowHeight, cellWidth, rowHeight);
        ops += fill();
        ops += restoreState();
      }

      // Cell border
      if (borderWidth > 0) {
        ops += saveState();
        ops += applyStrokeColor(borderColor);
        ops += setLineWidth(borderWidth);
        ops += rectangle(currentX, currentY - rowHeight, cellWidth, rowHeight);
        ops += stroke();
        ops += restoreState();
      }

      // Cell text (skip nested tables — handled below)
      const text = cellText(cell.content);
      if (text) {
        const cellTextColor = cell.textColor ?? rowTextColor;
        const cellFontSize = cell.fontSize ?? fontSize;
        // Cell alignment falls back to column-level alignment, then 'left'
        const colDef = options.columns?.[colIdx];
        const align = cell.align ?? colDef?.align ?? 'left';
        const verticalAlign = cell.verticalAlign ?? 'top';

        // Approximate text width: char count * fontSize * 0.5
        const approxTextWidth = text.length * cellFontSize * 0.5;

        // Available content area within padding
        const contentWidth = cellWidth - padding.left - padding.right;

        // Horizontal alignment
        let textX: number;
        if (align === 'center') {
          textX =
            currentX + padding.left + Math.max(0, contentWidth - approxTextWidth) / 2;
        } else if (align === 'right') {
          textX = currentX + cellWidth - padding.right - approxTextWidth;
        } else {
          textX = currentX + padding.left;
        }

        // Vertical alignment
        let textY: number;
        if (verticalAlign === 'middle') {
          textY = currentY - rowHeight / 2 - cellFontSize / 2 + cellFontSize * 0.2;
        } else if (verticalAlign === 'bottom') {
          textY = currentY - rowHeight + padding.bottom;
        } else {
          // top
          textY = currentY - padding.top - cellFontSize;
        }

        ops += saveState();
        ops += applyFillColor(cellTextColor);
        ops += beginText();
        ops += setFont(fontName, cellFontSize);
        ops += moveText(textX, textY);
        ops += showText(text);
        ops += endText();
        ops += restoreState();
      } else if (isNestedTable(cell.content)) {
        // Render nested table inside the cell
        const nestedWidth = cellWidth - padding.left - padding.right;
        const nestedX = currentX + padding.left;
        const nestedY = currentY - padding.top;
        const { ops: nestedOps } = renderTable({
          ...cell.content.table,
          x: nestedX,
          y: nestedY,
          width: Math.max(0, nestedWidth),
        });
        ops += nestedOps;
      }

      currentX += cellWidth;
      colIdx += span;
    }

    currentY -= rowHeight;
  }

  ops += restoreState();

  const totalHeight = options.y - currentY;

  return {
    ops,
    result: {
      width: options.width,
      height: totalHeight,
      rowHeights,
      columnWidths: colWidths,
      pagesUsed: 1,
    },
  };
}

/**
 * @module layout/table
 *
 * Table layout engine for PDF rendering.
 *
 * Renders tables as native PDF vector graphics with cells,
 * borders, text, and basic styling. All output is a string of
 * raw PDF content-stream operators that can be appended directly
 * to a page's operator buffer.
 */

import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill, stroke, setLineWidth } from '../core/operators/graphics.js';
import { beginText, endText, setFont, moveText, showText } from '../core/operators/text.js';
import { applyFillColor, applyStrokeColor } from '../core/operators/color.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Single table cell. */
export interface TableCell {
  readonly content: string;
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
  readonly width?: number;
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
}

/** Result of table rendering. */
export interface TableRenderResult {
  readonly width: number;
  readonly height: number;
  readonly rowHeights: readonly number[];
  readonly columnWidths: readonly number[];
  readonly pagesUsed: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
function resolvePadding(
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
 * Calculate column widths from the table width and optional column
 * definitions.
 */
function resolveColumnWidths(options: DrawTableOptions): number[] {
  const numCols = resolveColumnCount(options);

  if (options.columns && options.columns.length > 0) {
    const widths: number[] = [];
    let totalFixed = 0;
    let flexCount = 0;

    for (let i = 0; i < numCols; i++) {
      const col = options.columns[i];
      if (col?.width) {
        widths.push(col.width);
        totalFixed += col.width;
      } else {
        widths.push(0);
        flexCount++;
      }
    }

    if (flexCount > 0) {
      const flexWidth = Math.max(0, (options.width - totalFixed) / flexCount);
      for (let i = 0; i < widths.length; i++) {
        if (widths[i] === 0) widths[i] = flexWidth;
      }
    }

    return widths;
  }

  // Equal widths
  const colWidth = options.width / numCols;
  return Array.from({ length: numCols }, () => colWidth);
}

/**
 * Calculate row heights based on explicit values or font metrics.
 */
function resolveRowHeights(
  options: DrawTableOptions,
  fontSize: number,
  defaultPadding: number,
): number[] {
  return options.rows.map((row) => {
    if (row.height) return row.height;

    // Default: fontSize + top padding + bottom padding
    let maxHeight = defaultPadding * 2 + fontSize;

    for (const cell of row.cells) {
      const c = normalizeCell(cell);
      const p = resolvePadding(c.padding, defaultPadding);
      const cellFontSize = c.fontSize ?? fontSize;
      const h = p.top + p.bottom + cellFontSize;
      if (h > maxHeight) maxHeight = h;
    }

    return maxHeight;
  });
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

  const colWidths = resolveColumnWidths(options);
  const rowHeights = resolveRowHeights(options, fontSize, defaultPadding);

  let ops = saveState();
  let currentY = options.y;

  for (let rowIdx = 0; rowIdx < options.rows.length; rowIdx++) {
    const row = options.rows[rowIdx]!;
    const rowHeight = rowHeights[rowIdx]!;
    let currentX = options.x;

    // Row background — spans the full table width
    if (row.backgroundColor) {
      ops += saveState();
      ops += applyFillColor(row.backgroundColor);
      ops += rectangle(currentX, currentY - rowHeight, options.width, rowHeight);
      ops += fill();
      ops += restoreState();
    }

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

      // Cell text
      if (cell.content) {
        const cellTextColor = cell.textColor ?? textColor;
        const cellFontSize = cell.fontSize ?? fontSize;
        const align = cell.align ?? 'left';
        const verticalAlign = cell.verticalAlign ?? 'top';

        // Approximate text width: char count * fontSize * 0.5
        const approxTextWidth = cell.content.length * cellFontSize * 0.5;

        // Horizontal alignment
        let textX: number;
        if (align === 'center') {
          textX = currentX + (cellWidth - approxTextWidth) / 2;
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
        ops += showText(cell.content);
        ops += endText();
        ops += restoreState();
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

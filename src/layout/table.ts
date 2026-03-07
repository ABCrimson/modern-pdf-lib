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
 * Supports colspan, rowspan, rich cell content (styled text runs),
 * text overflow modes (wrap, truncate, ellipsis, shrink), and
 * automatic page breaks with header-row repetition.
 */

import { saveState, restoreState } from '../core/operators/state.js';
import {
  rectangle,
  fill,
  stroke,
  setLineWidth,
  clip,
  endPath,
} from '../core/operators/graphics.js';
import {
  beginText,
  endText,
  setFont,
  moveText,
  showText,
} from '../core/operators/text.js';
import { applyFillColor, applyStrokeColor } from '../core/operators/color.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A styled text run within a cell -- allows inline style variation. */
export interface TextRun {
  readonly text: string;
  readonly fontSize?: number;
  readonly color?: Color;
  readonly fontName?: string;
}

/** Content that can appear in a cell: plain text, styled text runs, or a nested table. */
export type CellContent = string | TextRun[] | NestedTableContent;

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
  /** Text overflow mode. Default: 'truncate'. */
  readonly overflow?: 'wrap' | 'truncate' | 'ellipsis' | 'shrink';
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
  /** PDF font resource name, default 'Helvetica'. */
  readonly fontName?: string;
  /** Default font size in points, default 12. */
  readonly fontSize?: number;
  readonly textColor?: Color;
  readonly borderColor?: Color;
  /** Border line width in points, default 0.5. */
  readonly borderWidth?: number;
  /** Number of header rows (reserved for future page-break support). */
  readonly headerRows?: number;
  /** Default cell padding in points, default 4. */
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

interface OccupationEntry {
  cell: TableCell;
  originRow: number;
  originCol: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isNestedTable(content: CellContent): content is NestedTableContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    !Array.isArray(content) &&
    (content as NestedTableContent).type === 'table'
  );
}

function isTextRunArray(content: CellContent): content is TextRun[] {
  return Array.isArray(content);
}

function cellText(content: CellContent): string {
  if (typeof content === 'string') return content;
  if (isTextRunArray(content)) {
    return content.map((r) => r.text).join('');
  }
  return '';
}

function estimateContentWidth(content: CellContent, defaultFontSize: number): number {
  if (typeof content === 'string') {
    return content.length * defaultFontSize * 0.5;
  }
  if (isTextRunArray(content)) {
    let total = 0;
    for (const run of content) {
      total += run.text.length * (run.fontSize ?? defaultFontSize) * 0.5;
    }
    return total;
  }
  return 0;
}

function normalizeCell(cell: TableCell | string | undefined): TableCell {
  if (cell === undefined) return { content: '' };
  if (typeof cell === 'string') return { content: cell };
  return cell;
}

export function resolvePadding(
  padding:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number }
    | undefined,
  defaultPadding: number,
): { top: number; right: number; bottom: number; left: number } {
  if (padding === undefined) {
    return { top: defaultPadding, right: defaultPadding, bottom: defaultPadding, left: defaultPadding };
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

function parsePercentage(value: string): number {
  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) return NaN;
  const num = Number(trimmed.slice(0, -1));
  if (!Number.isFinite(num) || num < 0) return NaN;
  return num / 100;
}

function estimateAutoFitWidth(
  colIndex: number,
  options: DrawTableOptions,
  fontSize: number,
  defaultPadding: number,
): number {
  let maxWidth = 0;
  for (const row of options.rows) {
    let ci = 0;
    for (const rawCell of row.cells) {
      const cell = normalizeCell(rawCell);
      const span = cell.colSpan ?? 1;
      if (ci === colIndex && span === 1) {
        const p = resolvePadding(cell.padding, defaultPadding);
        const cellFontSize = cell.fontSize ?? fontSize;
        const textWidth = estimateContentWidth(cell.content, cellFontSize);
        const needed = textWidth + p.left + p.right;
        if (needed > maxWidth) maxWidth = needed;
      }
      ci += span;
      if (ci > colIndex) break;
    }
  }
  return maxWidth || defaultPadding * 2;
}

export function resolveColumnWidths(options: DrawTableOptions): number[] {
  const numCols = resolveColumnCount(options);
  const tableWidth = options.width;
  const fontSize = options.fontSize ?? 12;
  const defaultPadding = options.padding ?? 4;

  if (!options.columns || options.columns.length === 0) {
    const colWidth = tableWidth / numCols;
    return Array.from({ length: numCols }, () => colWidth);
  }

  const widths: number[] = new Array<number>(numCols).fill(-1);
  const modes: string[] = new Array<string>(numCols).fill('flex');
  let consumed = 0;

  for (let i = 0; i < numCols; i++) {
    const col = options.columns[i];
    if (col?.width != null && col.width > 0) {
      widths[i] = col.width;
      modes[i] = 'fixed';
      consumed += col.width;
    }
  }

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

  for (let i = 0; i < numCols; i++) {
    if (modes[i] !== 'flex') continue;
    const col = options.columns[i];
    if (col?.autoFit) {
      widths[i] = estimateAutoFitWidth(i, options, fontSize, defaultPadding);
      modes[i] = 'autofit';
      consumed += widths[i]!;
    }
  }

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

function computeNestedTableHeight(nested: NestedTableContent, width: number): number {
  const { result } = renderTable({ ...nested.table, x: 0, y: 0, width });
  return result.height;
}

// ---------------------------------------------------------------------------
// Text overflow helpers
// ---------------------------------------------------------------------------

function wrapTextInternal(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.5;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? currentLine + ' ' + word : word;
    if (candidate.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

function truncateWithEllipsis(text: string, maxWidth: number, fontSize: number): string {
  const charWidth = fontSize * 0.5;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  if (text.length <= maxChars) return text;
  const cutoff = Math.max(0, maxChars - 3);
  return text.slice(0, cutoff) + '...';
}

function shrinkFontSize(text: string, maxWidth: number, fontSize: number): number {
  const textWidth = text.length * fontSize * 0.5;
  if (textWidth <= maxWidth || text.length === 0) return fontSize;
  const needed = maxWidth / (text.length * 0.5);
  return Math.max(4, Math.min(fontSize, needed));
}

function resolveRowHeights(
  options: DrawTableOptions,
  fontSize: number,
  defaultPadding: number,
  colWidths: readonly number[],
): number[] {
  return options.rows.map((row) => {
    if (row.height) return row.height;
    let maxHeight = defaultPadding * 2 + fontSize;

    let colIdx = 0;
    for (const rawCell of row.cells) {
      const c = normalizeCell(rawCell);
      const p = resolvePadding(c.padding, defaultPadding);
      const span = c.colSpan ?? 1;

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
        const contentText = cellText(c.content);

        if (c.overflow === 'wrap' && contentText) {
          const contentWidth = cellWidth - p.left - p.right;
          const lines = wrapTextInternal(contentText, contentWidth, cellFontSize);
          const lineHeight = cellFontSize * 1.2;
          const h = p.top + p.bottom + lines.length * lineHeight;
          if (h > maxHeight) maxHeight = h;
        } else {
          const h = p.top + p.bottom + cellFontSize;
          if (h > maxHeight) maxHeight = h;
        }
      }

      colIdx += span;
    }

    return maxHeight;
  });
}

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
      while (logicalCol < numCols && grid[r]![logicalCol] !== null) {
        logicalCol++;
      }
      if (logicalCol >= numCols) break;
      const cell = normalizeCell(rawCell);
      const cs = Math.max(1, cell.colSpan ?? 1);
      const rs = Math.max(1, cell.rowSpan ?? 1);
      const entry: OccupationEntry = { cell, originRow: r, originCol: logicalCol };
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

function spanWidth(colWidths: readonly number[], startCol: number, span: number): number {
  let w = 0;
  for (let i = 0; i < span && startCol + i < colWidths.length; i++) {
    w += colWidths[startCol + i]!;
  }
  return w;
}

function spanHeight(rowHeights: readonly number[], startRow: number, span: number): number {
  let h = 0;
  for (let i = 0; i < span && startRow + i < rowHeights.length; i++) {
    h += rowHeights[startRow + i]!;
  }
  return h;
}

function columnX(baseX: number, colWidths: readonly number[], col: number): number {
  let x = baseX;
  for (let i = 0; i < col; i++) {
    x += colWidths[i]!;
  }
  return x;
}

function renderPlainTextOps(
  cell: TableCell,
  text: string,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  fontName: string,
  fontSize: number,
  padding: { top: number; right: number; bottom: number; left: number },
  textColor: Color,
  colDef?: TableColumn,
): string {
  let ops = '';
  const cellTextColor = cell.textColor ?? textColor;
  let cellFontSize = cell.fontSize ?? fontSize;
  const align = cell.align ?? colDef?.align ?? 'left';
  const verticalAlign = cell.verticalAlign ?? 'top';
  const contentWidth = cellWidth - padding.left - padding.right;
  const overflow = cell.overflow ?? 'truncate';

  if (overflow === 'wrap') {
    const lines = wrapTextInternal(text, contentWidth, cellFontSize);
    const lineHeight = cellFontSize * 1.2;

    let startY: number;
    if (verticalAlign === 'middle') {
      const totalTextHeight = lines.length * lineHeight;
      startY = cellY - cellHeight / 2 + totalTextHeight / 2 - cellFontSize;
    } else if (verticalAlign === 'bottom') {
      startY = cellY - cellHeight + padding.bottom + (lines.length - 1) * lineHeight;
    } else {
      startY = cellY - padding.top - cellFontSize;
    }

    ops += saveState();
    ops += applyFillColor(cellTextColor);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      const approxLineWidth = line.length * cellFontSize * 0.5;
      let textX: number;
      if (align === 'center') {
        textX = cellX + padding.left + Math.max(0, contentWidth - approxLineWidth) / 2;
      } else if (align === 'right') {
        textX = cellX + cellWidth - padding.right - approxLineWidth;
      } else {
        textX = cellX + padding.left;
      }
      const textY = startY - li * lineHeight;
      ops += beginText();
      ops += setFont(fontName, cellFontSize);
      ops += moveText(textX, textY);
      ops += showText(line);
      ops += endText();
    }
    ops += restoreState();
  } else {
    let displayText = text;

    if (overflow === 'ellipsis') {
      displayText = truncateWithEllipsis(text, contentWidth, cellFontSize);
    } else if (overflow === 'shrink') {
      cellFontSize = shrinkFontSize(text, contentWidth, cellFontSize);
    }

    const approxTextWidth = displayText.length * cellFontSize * 0.5;

    let textX: number;
    if (align === 'center') {
      textX = cellX + padding.left + Math.max(0, contentWidth - approxTextWidth) / 2;
    } else if (align === 'right') {
      textX = cellX + cellWidth - padding.right - approxTextWidth;
    } else {
      textX = cellX + padding.left;
    }

    let textY: number;
    if (verticalAlign === 'middle') {
      textY = cellY - cellHeight / 2 - cellFontSize / 2 + cellFontSize * 0.2;
    } else if (verticalAlign === 'bottom') {
      textY = cellY - cellHeight + padding.bottom;
    } else {
      textY = cellY - padding.top - cellFontSize;
    }

    ops += saveState();

    if (overflow === 'truncate') {
      ops += rectangle(cellX, cellY - cellHeight, cellWidth, cellHeight);
      ops += clip();
      ops += endPath();
    }

    ops += applyFillColor(cellTextColor);
    ops += beginText();
    ops += setFont(fontName, cellFontSize);
    ops += moveText(textX, textY);
    ops += showText(displayText);
    ops += endText();
    ops += restoreState();
  }

  return ops;
}

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

  if (cell.backgroundColor) {
    ops += saveState();
    ops += applyFillColor(cell.backgroundColor);
    ops += rectangle(cellX, cellY - cellHeight, cellWidth, cellHeight);
    ops += fill();
    ops += restoreState();
  }

  if (borderWidth > 0) {
    ops += saveState();
    ops += applyStrokeColor(borderColor);
    ops += setLineWidth(borderWidth);
    ops += rectangle(cellX, cellY - cellHeight, cellWidth, cellHeight);
    ops += stroke();
    ops += restoreState();
  }

  const content = cell.content;
  if (isNestedTable(content)) {
    const nestedWidth = cellWidth - padding.left - padding.right;
    const nestedX = cellX + padding.left;
    const nestedY = cellY - padding.top;
    const { ops: nestedOps } = renderTable({
      ...content.table,
      x: nestedX,
      y: nestedY,
      width: Math.max(0, nestedWidth),
    });
    ops += nestedOps;
  } else if (isTextRunArray(content)) {
    if (content.length > 0) {
      const cellTextColor = cell.textColor ?? textColor;
      const cellFontSize = cell.fontSize ?? fontSize;
      const align = cell.align ?? colDef?.align ?? 'left';
      const verticalAlign = cell.verticalAlign ?? 'top';
      const approxTextWidth = estimateContentWidth(content, cellFontSize);
      const contentWidth = cellWidth - padding.left - padding.right;

      let textXPos: number;
      if (align === 'center') {
        textXPos = cellX + padding.left + Math.max(0, contentWidth - approxTextWidth) / 2;
      } else if (align === 'right') {
        textXPos = cellX + cellWidth - padding.right - approxTextWidth;
      } else {
        textXPos = cellX + padding.left;
      }

      let textYPos: number;
      if (verticalAlign === 'middle') {
        textYPos = cellY - cellHeight / 2 - cellFontSize / 2 + cellFontSize * 0.2;
      } else if (verticalAlign === 'bottom') {
        textYPos = cellY - cellHeight + padding.bottom;
      } else {
        textYPos = cellY - padding.top - cellFontSize;
      }

      ops += saveState();
      ops += beginText();
      ops += moveText(textXPos, textYPos);
      for (const run of content) {
        ops += applyFillColor(run.color ?? cellTextColor);
        ops += setFont(run.fontName ?? fontName, run.fontSize ?? cellFontSize);
        ops += showText(run.text);
      }
      ops += endText();
      ops += restoreState();
    }
  } else {
    const text = typeof content === 'string' ? content : '';
    if (text) {
      ops += renderPlainTextOps(
        cell, text, cellX, cellY, cellWidth, cellHeight,
        fontName, fontSize, padding, textColor, colDef,
      );
    }
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Core renderer
// ---------------------------------------------------------------------------

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
  const numCols = colWidths.length;
  const rowHeights = resolveRowHeights(options, fontSize, defaultPadding, colWidths);
  const grid = buildOccupationGrid(options.rows, numCols);

  let ops = saveState();
  let currentY = options.y;

  for (let rowIdx = 0; rowIdx < options.rows.length; rowIdx++) {
    const row = options.rows[rowIdx]!;
    const rowHeight = rowHeights[rowIdx]!;
    const isHeader = rowIdx < headerRows;

    // Determine the effective row background color:
    // 1. Explicit row backgroundColor always wins
    // 2. headerBackgroundColor for header rows
    // 3. alternateRowColors for data rows
    let effectiveRowBg: Color | undefined = row.backgroundColor;
    if (!effectiveRowBg) {
      if (isHeader && options.headerBackgroundColor) {
        effectiveRowBg = options.headerBackgroundColor;
      } else if (!isHeader && options.alternateRowColors) {
        const dataRowIdx = rowIdx - headerRows;
        effectiveRowBg = options.alternateRowColors[dataRowIdx % 2 === 0 ? 0 : 1];
      }
    }

    if (effectiveRowBg) {
      ops += saveState();
      ops += applyFillColor(effectiveRowBg);
      ops += rectangle(options.x, currentY - rowHeight, options.width, rowHeight);
      ops += fill();
      ops += restoreState();
    }

    const rowTextColor =
      isHeader && options.headerTextColor ? options.headerTextColor : textColor;

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const entry = grid[rowIdx]![colIdx];
      if (!entry) continue;
      if (entry.originRow !== rowIdx || entry.originCol !== colIdx) continue;

      const cell = entry.cell;
      const cs = Math.max(1, cell.colSpan ?? 1);
      const rs = Math.max(1, cell.rowSpan ?? 1);

      const cellX = columnX(options.x, colWidths, colIdx);
      const cellWidth = spanWidth(colWidths, colIdx, cs);
      const cellHeight = spanHeight(rowHeights, rowIdx, rs);
      const colDef = options.columns?.[colIdx];

      ops += renderCellOps(
        cell, cellX, currentY, cellWidth, cellHeight,
        fontName, fontSize, defaultPadding, borderWidth, borderColor, rowTextColor, colDef,
      );
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

// ---------------------------------------------------------------------------
// Multi-page renderer
// ---------------------------------------------------------------------------

/**
 * Render a table across multiple pages, breaking rows when content
 * would exceed the available vertical space.
 *
 * Header rows (specified by `options.headerRows`) are repeated at the
 * top of each new page. Rows are never split across pages.
 */
export function renderMultiPageTable(
  options: DrawTableOptions,
  bottomMargin: number = 40,
): MultiPageTableResult {
  const fontSize = options.fontSize ?? 12;
  const defaultPadding = options.padding ?? 4;
  const borderWidth = options.borderWidth ?? 0.5;
  const borderColor: Color =
    options.borderColor ?? ({ type: 'grayscale', gray: 0 } as const);
  const textColor: Color =
    options.textColor ?? ({ type: 'grayscale', gray: 0 } as const);
  const fontName = options.fontName ?? 'Helvetica';
  const headerRowCount = options.headerRows ?? 0;

  const colWidths = resolveColumnWidths(options);
  const numCols = colWidths.length;
  const rowHeights = resolveRowHeights(options, fontSize, defaultPadding, colWidths);
  const grid = buildOccupationGrid(options.rows, numCols);

  const pages: PageContent[] = [];
  let currentPageOps = saveState();
  let currentY = options.y;
  let totalHeight = 0;

  function renderHeaders(): void {
    for (let hIdx = 0; hIdx < headerRowCount && hIdx < options.rows.length; hIdx++) {
      const hRow = options.rows[hIdx]!;
      const hRowHeight = rowHeights[hIdx]!;

      if (hRow.backgroundColor) {
        currentPageOps += saveState();
        currentPageOps += applyFillColor(hRow.backgroundColor);
        currentPageOps += rectangle(
          options.x, currentY - hRowHeight, options.width, hRowHeight,
        );
        currentPageOps += fill();
        currentPageOps += restoreState();
      }

      for (let colIdx = 0; colIdx < numCols; colIdx++) {
        const entry = grid[hIdx]![colIdx];
        if (!entry) continue;
        if (entry.originRow !== hIdx || entry.originCol !== colIdx) continue;

        const cell = entry.cell;
        const cs = Math.max(1, cell.colSpan ?? 1);
        const rs = Math.min(Math.max(1, cell.rowSpan ?? 1), headerRowCount - hIdx);

        const cellX = columnX(options.x, colWidths, colIdx);
        const cellWidth = spanWidth(colWidths, colIdx, cs);
        const cellHeight = spanHeight(rowHeights, hIdx, rs);
        const colDef = options.columns?.[colIdx];

        currentPageOps += renderCellOps(
          cell, cellX, currentY, cellWidth, cellHeight,
          fontName, fontSize, defaultPadding, borderWidth, borderColor, textColor, colDef,
        );
      }

      currentY -= hRowHeight;
    }
  }

  function startNewPage(): void {
    currentPageOps += restoreState();
    pages.push({ ops: currentPageOps, pageIndex: pages.length });

    currentPageOps = saveState();
    currentY = options.y;

    renderHeaders();
  }

  for (let rowIdx = 0; rowIdx < options.rows.length; rowIdx++) {
    const row = options.rows[rowIdx]!;
    const rowHeight = rowHeights[rowIdx]!;

    if (currentY - rowHeight < bottomMargin && rowIdx > 0) {
      startNewPage();
      if (rowIdx < headerRowCount) continue;
    }

    if (row.backgroundColor) {
      currentPageOps += saveState();
      currentPageOps += applyFillColor(row.backgroundColor);
      currentPageOps += rectangle(
        options.x, currentY - rowHeight, options.width, rowHeight,
      );
      currentPageOps += fill();
      currentPageOps += restoreState();
    }

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const entry = grid[rowIdx]![colIdx];
      if (!entry) continue;
      if (entry.originRow !== rowIdx || entry.originCol !== colIdx) continue;

      const cell = entry.cell;
      const cs = Math.max(1, cell.colSpan ?? 1);
      const rs = Math.max(1, cell.rowSpan ?? 1);

      const cellX = columnX(options.x, colWidths, colIdx);
      const cellWidth = spanWidth(colWidths, colIdx, cs);
      const cellHeight = spanHeight(rowHeights, rowIdx, rs);
      const colDef = options.columns?.[colIdx];

      currentPageOps += renderCellOps(
        cell, cellX, currentY, cellWidth, cellHeight,
        fontName, fontSize, defaultPadding, borderWidth, borderColor, textColor, colDef,
      );
    }

    currentY -= rowHeight;
    totalHeight += rowHeight;
  }

  currentPageOps += restoreState();
  pages.push({ ops: currentPageOps, pageIndex: pages.length });

  return {
    pages,
    result: {
      width: options.width,
      height: totalHeight,
      rowHeights,
      columnWidths: colWidths,
      pagesUsed: pages.length,
    },
  };
}

/**
 * @module layout
 *
 * High-level layout primitives for PDF rendering.
 *
 * @packageDocumentation
 */

export { renderTable, resolveColumnWidths, resolvePadding } from './table.js';
export type {
  CellContent,
  NestedTableContent,
  TableCell,
  TableRow,
  TableColumn,
  DrawTableOptions,
  TableRenderResult,
} from './table.js';

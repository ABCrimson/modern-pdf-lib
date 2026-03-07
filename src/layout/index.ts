/**
 * @module layout
 *
 * High-level layout primitives for PDF rendering.
 *
 * @packageDocumentation
 */

export { renderTable, renderMultiPageTable, resolveColumnWidths, resolvePadding } from './table.js';
export type {
  CellContent,
  NestedTableContent,
  TableCell,
  TableRow,
  TableColumn,
  DrawTableOptions,
  TableRenderResult,
  PageContent,
  MultiPageTableResult,
} from './table.js';

export {
  minimalPreset,
  stripedPreset,
  borderedPreset,
  professionalPreset,
  applyPreset,
} from './presets.js';
export type { TablePreset } from './presets.js';

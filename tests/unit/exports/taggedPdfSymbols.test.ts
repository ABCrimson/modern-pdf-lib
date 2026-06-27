import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.31.x Tagged-PDF/accessibility symbol must be reachable from the root. */
const SYMBOLS = [
  'tagHeading',
  'tagParagraph',
  'tagFigure',
  'tagLink',
  'tagList',
  'tagListItem',
  'tagTable',
  'tagTableRow',
  'tagTableHeaderCell',
  'tagTableDataCell',
  'LIST_NUMBERING_KEY',
  'validatePdfUa2',
  'buildPdfUa2Xmp',
  'autoTagPage',
] as const;

test.each(SYMBOLS)("package root re-exports tagged-PDF symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

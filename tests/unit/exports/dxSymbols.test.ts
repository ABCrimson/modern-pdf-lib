import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.40.x DX / framework-integration symbol must be reachable from the root. */
const SYMBOLS = [
  'jsx',
  'jsxs',
  'Fragment',
  'renderJsxToPdf',
  'buildFormFromJsonSchema',
  'pdfHeaders',
  'pdfResponse',
  'sendPdfToNodeResponse',
] as const;

test.each(SYMBOLS)("package root re-exports DX symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.32.x standards/validation symbol must be reachable from the root. */
const SYMBOLS = [
  'preflightPdfA',
  'convertPdfAConformanceXmp',
  'buildWtpdfIdentificationXmp',
  'buildPdfRIdentificationXmp',
] as const;

test.each(SYMBOLS)("package root re-exports standards symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

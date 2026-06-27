import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.35.x security & redaction symbol must be reachable from the root. */
const SYMBOLS = [
  'scanPdfThreats',
  'sanitizePdf',
  'verifyRedactions',
  'inspectEncryption',
] as const;

test.each(SYMBOLS)("package root re-exports security symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

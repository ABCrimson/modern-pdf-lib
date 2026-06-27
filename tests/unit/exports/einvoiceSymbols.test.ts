import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.33.x e-invoicing / document-assembly symbol must be reachable from the root. */
const SYMBOLS = [
  'assembleFacturX',
  'buildFacturXXmp',
  'validateEn16931',
  'parseCiiXml',
  'detectFacturXProfile',
] as const;

test.each(SYMBOLS)("package root re-exports e-invoicing symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

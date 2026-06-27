import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.38.x next-gen image / SVG-filter symbol must be reachable from the root. */
const SYMBOLS = [
  'detectNextGenFormat',
  'probeNextGenImage',
  'registerImageDecoder',
  'decodeRegisteredImage',
  'feGaussianBlur',
  'feColorMatrix',
  'feComposite',
] as const;

test.each(SYMBOLS)("package root re-exports image-format symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

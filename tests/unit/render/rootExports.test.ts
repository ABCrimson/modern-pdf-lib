import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.29.x rendering symbol must be reachable from the package root. */
const RENDER_EXPORTS = [
  'interpretContentStream',
  'interpretPage',
  'rasterize',
  'renderPageToImage',
  'renderPageToCanvas',
  'renderDisplayListToCanvas',
  'generateThumbnail',
  'extractPageImages',
  'extractFonts',
  'compareImages',
  'comparePages',
  'applyOcr',
  'redactRegions',
  'computeTileGrid',
  'renderPageTile',
  'RenderCache',
] as const;

test.each(RENDER_EXPORTS)("package root re-exports render symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

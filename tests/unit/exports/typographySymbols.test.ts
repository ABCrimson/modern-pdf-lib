import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.36.x typography symbol must be reachable from the root. */
const SYMBOLS = [
  'resolveBidi', // UAX #9
  'reorderVisual',
  'parseVariableFont', // fvar/avar
  'normalizeAxisCoordinate',
  'parseColorFont', // COLR/CPAL
  'getColorGlyphLayers',
] as const;

test.each(SYMBOLS)("package root re-exports typography symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

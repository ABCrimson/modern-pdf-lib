import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.37.x color-science symbol must be reachable from the root. */
const SYMBOLS = [
  // mesh shadings (ShadingType 4–7)
  'buildFreeFormGouraudShading',
  'buildLatticeFormGouraudShading',
  'buildCoonsPatchShading',
  'buildTensorPatchShading',
  // ICC matrix/TRC transform
  'parseIccTransform',
  'deviceRgbToXyz',
  'xyzToLab',
  // device color conversions
  'cmykToRgb',
  'rgbToHsl',
  'rgbToLab',
] as const;

test.each(SYMBOLS)("package root re-exports color symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

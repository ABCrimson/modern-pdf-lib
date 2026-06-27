import { test, expect } from 'vitest';
import * as lib from '../../../src/index.js';

/** Every 0.39.x performance & concurrency symbol must be reachable from the root. */
const SYMBOLS = [
  'isSharedMemoryAvailable',
  'SharedCounter',
  'SharedRingBuffer',
  'MemoryBudget',
  'createMemoryBudget',
  'detectRuntimeCapabilities',
  'isWasmSimdSupported',
  'SIMD_NOTE',
] as const;

test.each(SYMBOLS)("package root re-exports perf symbol '%s'", (name) => {
  expect((lib as Record<string, unknown>)[name], `${name} must be exported from 'modern-pdf-lib'`).toBeDefined();
});

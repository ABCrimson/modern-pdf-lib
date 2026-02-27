/**
 * Benchmarks for compression performance.
 *
 * Measures fflate compress/decompress at various levels and data sizes.
 */

import { describe, bench } from 'vitest';
import {
  compressSync,
  decompressSync,
} from '../../src/compression/fflateAdapter.js';

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Generate compressible text data of approximately `size` bytes. */
function makeTextData(size: number): Uint8Array {
  const line = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
  const repeated = line.repeat(Math.ceil(size / line.length));
  return encoder.encode(repeated.slice(0, size));
}

/** Generate pseudo-random data (less compressible). */
function makeRandomData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  // Simple PRNG (not crypto-random, but sufficient for benchmarks)
  let seed = 42;
  for (let i = 0; i < size; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = seed & 0xff;
  }
  return data;
}

/** Generate highly compressible data (all zeros). */
function makeZeroData(size: number): Uint8Array {
  return new Uint8Array(size);
}

// Pre-generate test data
const text1KB = makeTextData(1024);
const text10KB = makeTextData(10240);
const text100KB = makeTextData(102400);
const random10KB = makeRandomData(10240);
const zeros10KB = makeZeroData(10240);

// Pre-compress for decompression benchmarks
const compressed1KB = compressSync(text1KB, 6);
const compressed10KB = compressSync(text10KB, 6);
const compressed100KB = compressSync(text100KB, 6);

// ---------------------------------------------------------------------------
// Compression benchmarks
// ---------------------------------------------------------------------------

describe('fflate compress', () => {
  bench('1KB text, level 1', () => {
    compressSync(text1KB, 1);
  });

  bench('1KB text, level 6', () => {
    compressSync(text1KB, 6);
  });

  bench('1KB text, level 9', () => {
    compressSync(text1KB, 9);
  });

  bench('10KB text, level 1', () => {
    compressSync(text10KB, 1);
  });

  bench('10KB text, level 6', () => {
    compressSync(text10KB, 6);
  });

  bench('10KB text, level 9', () => {
    compressSync(text10KB, 9);
  });

  bench('100KB text, level 6', () => {
    compressSync(text100KB, 6);
  });

  bench('10KB random data, level 6', () => {
    compressSync(random10KB, 6);
  });

  bench('10KB zeros (best case), level 6', () => {
    compressSync(zeros10KB, 6);
  });
});

// ---------------------------------------------------------------------------
// Decompression benchmarks
// ---------------------------------------------------------------------------

describe('fflate decompress', () => {
  bench('1KB text', () => {
    decompressSync(compressed1KB);
  });

  bench('10KB text', () => {
    decompressSync(compressed10KB);
  });

  bench('100KB text', () => {
    decompressSync(compressed100KB);
  });

  bench('10KB text with size hint', () => {
    decompressSync(compressed10KB, 10240);
  });
});

// ---------------------------------------------------------------------------
// Compressed size comparison
// ---------------------------------------------------------------------------

describe('compression ratio comparison', () => {
  bench('measure: text 10KB compressed size at level 1', () => {
    const c = compressSync(text10KB, 1);
    // Prevent dead code elimination
    if (c.length === 0) throw new Error('unexpected');
  });

  bench('measure: text 10KB compressed size at level 6', () => {
    const c = compressSync(text10KB, 6);
    if (c.length === 0) throw new Error('unexpected');
  });

  bench('measure: text 10KB compressed size at level 9', () => {
    const c = compressSync(text10KB, 9);
    if (c.length === 0) throw new Error('unexpected');
  });
});

// ---------------------------------------------------------------------------
// libdeflate WASM benchmarks (skip if WASM not available)
// ---------------------------------------------------------------------------

import { LibdeflateWasm } from '../../src/compression/libdeflateWasm.js';

// Check if WASM is available by trying to create the engine.
// If not initialized, the constructor or methods will throw.
let wasmEngine: InstanceType<typeof LibdeflateWasm> | null = null;
let wasmDeflateReady = false;
try {
  wasmEngine = new LibdeflateWasm();
  // Test that it actually works (throws if WASM not initialized)
  wasmEngine.compressSync(new Uint8Array([0]), 1);
  wasmDeflateReady = true;
} catch {
  wasmDeflateReady = false;
  wasmEngine = null;
}

describe.skipIf(!wasmDeflateReady)('libdeflate WASM compress', () => {
  bench('1KB text, level 6', () => {
    wasmEngine!.compressSync(text1KB, 6);
  });

  bench('10KB text, level 6', () => {
    wasmEngine!.compressSync(text10KB, 6);
  });

  bench('10KB text, level 12', () => {
    wasmEngine!.compressSync(text10KB, 12);
  });

  bench('100KB text, level 6', () => {
    wasmEngine!.compressSync(text100KB, 6);
  });

  bench('10KB random data, level 6', () => {
    wasmEngine!.compressSync(random10KB, 6);
  });
});

describe.skipIf(!wasmDeflateReady)('libdeflate WASM decompress', () => {
  bench('1KB text', () => {
    wasmEngine!.decompressSync(compressed1KB, text1KB.length);
  });

  bench('10KB text', () => {
    wasmEngine!.decompressSync(compressed10KB, text10KB.length);
  });

  bench('100KB text', () => {
    wasmEngine!.decompressSync(compressed100KB, text100KB.length);
  });
});

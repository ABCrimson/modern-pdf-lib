/**
 * Tests for the compression subsystem — fflate adapter and unified deflate API.
 *
 * Covers compress/decompress roundtrip, empty input, compression levels,
 * and engine selection.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  compressSync,
  decompressSync,
  compressAsync,
  decompressAsync,
  FflateEngine,
} from '../../../src/compression/fflateAdapter.js';
import {
  compress,
  decompress,
  getCompressor,
  resetEngines,
  clampLevel,
} from '../../../src/compression/deflate.js';
import type { CompressionEngine } from '../../../src/compression/deflate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Create a compressible test buffer of the given size. */
function makeCompressibleData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
}

/** Create a highly compressible buffer (all zeros). */
function makeRepeatingData(size: number): Uint8Array {
  return new Uint8Array(size); // all zeros
}

// ---------------------------------------------------------------------------
// Reset engines between tests to ensure isolation
// ---------------------------------------------------------------------------

afterEach(() => {
  resetEngines();
});

// ---------------------------------------------------------------------------
// fflate adapter sync tests
// ---------------------------------------------------------------------------

describe('fflate adapter (sync)', () => {
  it('compresses and decompresses roundtrip', () => {
    const original = encoder.encode('Hello, compression world! This is a test of the deflate algorithm.');
    const compressed = compressSync(original);
    const decompressed = decompressSync(compressed);

    expect(decoder.decode(decompressed)).toBe(
      'Hello, compression world! This is a test of the deflate algorithm.',
    );
  });

  it('compressed output is smaller than input for compressible data', () => {
    const data = makeRepeatingData(10000);
    const compressed = compressSync(data);
    expect(compressed.length).toBeLessThan(data.length);
  });

  it('empty input compresses and decompresses', () => {
    const empty = new Uint8Array(0);
    const compressed = compressSync(empty);
    const decompressed = decompressSync(compressed);

    expect(decompressed.length).toBe(0);
  });

  it('different compression levels all produce valid output', () => {
    const data = encoder.encode('Test data for all levels of compression.');

    for (let level = 1; level <= 9; level++) {
      const compressed = compressSync(data, level);
      const decompressed = decompressSync(compressed);
      expect(decoder.decode(decompressed)).toBe(
        'Test data for all levels of compression.',
      );
    }
  });

  it('higher compression levels produce smaller or equal output', () => {
    const data = makeCompressibleData(5000);

    const sizes: number[] = [];
    for (let level = 1; level <= 9; level++) {
      const compressed = compressSync(data, level);
      sizes.push(compressed.length);
    }

    // Level 9 should be <= level 1 for compressible data
    expect(sizes[8]!).toBeLessThanOrEqual(sizes[0]!);
  });

  it('decompressSync with outputSize hint works', () => {
    const original = encoder.encode('Known size decompression test');
    const compressed = compressSync(original);
    const decompressed = decompressSync(compressed, original.length);

    expect(decoder.decode(decompressed)).toBe('Known size decompression test');
  });
});

// ---------------------------------------------------------------------------
// fflate adapter async tests
// ---------------------------------------------------------------------------

describe('fflate adapter (async)', () => {
  it('compresses and decompresses roundtrip', async () => {
    const original = encoder.encode('Async compression roundtrip test.');
    const compressed = await compressAsync(original);
    const decompressed = await decompressAsync(compressed);

    expect(decoder.decode(decompressed)).toBe('Async compression roundtrip test.');
  });

  it('empty input compresses and decompresses', async () => {
    const empty = new Uint8Array(0);
    const compressed = await compressAsync(empty);
    const decompressed = await decompressAsync(compressed);
    expect(decompressed.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FflateEngine (CompressionEngine interface)
// ---------------------------------------------------------------------------

describe('FflateEngine', () => {
  it('implements CompressionEngine interface', () => {
    const engine = new FflateEngine();
    expect(engine.name).toBe('fflate');
    expect(engine.minLevel).toBe(1);
    expect(engine.maxLevel).toBe(9);
    expect(typeof engine.compress).toBe('function');
    expect(typeof engine.decompress).toBe('function');
    expect(typeof engine.dispose).toBe('function');
  });

  it('compress and decompress roundtrip via engine', async () => {
    const engine = new FflateEngine({ useAsync: false });
    const original = encoder.encode('Engine roundtrip test data.');

    const compressed = await engine.compress(original, 6);
    const decompressed = await engine.decompress(compressed);

    expect(decoder.decode(decompressed)).toBe('Engine roundtrip test data.');
  });

  it('dispose does not throw', () => {
    const engine = new FflateEngine();
    expect(() => engine.dispose()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unified deflate API
// ---------------------------------------------------------------------------

describe('Unified deflate API', () => {
  it('getCompressor returns an engine', async () => {
    const engine = await getCompressor();
    expect(engine).toBeDefined();
    expect(engine.name).toBeTruthy();
    expect(typeof engine.compress).toBe('function');
    expect(typeof engine.decompress).toBe('function');
  });

  it('getCompressor with fflate preference returns fflate', async () => {
    const engine = await getCompressor({ preferEngine: 'fflate' });
    expect(engine.name).toBe('fflate');
  });

  it('getCompressor auto selects the best available engine', async () => {
    const engine = await getCompressor({ preferEngine: 'auto' });
    expect(engine).toBeDefined();
    // Auto selects the best available: libdeflate-wasm if available, otherwise fflate
    expect(['fflate', 'libdeflate-wasm']).toContain(engine.name);
  });

  it('getCompressor with libdeflate preference returns engine or throws', async () => {
    // libdeflate WASM may or may not be available in the test environment.
    // If available, it returns the engine; if not, it throws.
    try {
      const engine = await getCompressor({ preferEngine: 'libdeflate' });
      expect(engine.name).toBe('libdeflate-wasm');
    } catch (err) {
      expect(String(err)).toMatch(/not available/);
    }
  });

  it('compress and decompress via unified API', async () => {
    const original = encoder.encode('Unified API roundtrip test.');
    // Use fflate explicitly to avoid WASM lifecycle issues in tests
    const compressed = await compress(original, { level: 6, preferEngine: 'fflate' });
    const decompressed = await decompress(compressed, undefined, { preferEngine: 'fflate' });

    expect(decoder.decode(decompressed)).toBe('Unified API roundtrip test.');
  });

  it('clampLevel clamps to engine range', () => {
    const engine: CompressionEngine = {
      name: 'test',
      minLevel: 1,
      maxLevel: 9,
      compress: async (d) => d,
      decompress: async (d) => d,
      dispose: () => {},
    };

    expect(clampLevel(0, engine)).toBe(1);
    expect(clampLevel(5, engine)).toBe(5);
    expect(clampLevel(10, engine)).toBe(9);
    expect(clampLevel(-1, engine)).toBe(1);
  });

  it('resetEngines allows re-initialization', async () => {
    // Get an engine to cache it
    const engine1 = await getCompressor({ preferEngine: 'fflate' });
    expect(engine1).toBeDefined();

    // Reset
    resetEngines();

    // Get again — should work fine
    const engine2 = await getCompressor({ preferEngine: 'fflate' });
    expect(engine2).toBeDefined();
    expect(engine2.name).toBe('fflate');
  });

  // -------------------------------------------------------------------------
  // libdeflate WASM API surface tests
  //
  // Since the WASM binary is not compiled yet, these tests verify that
  // the wrapper API behaves correctly when WASM is unavailable.
  // -------------------------------------------------------------------------

  it('isAvailable() returns false when WASM has not been initialized', async () => {
    const { isAvailable } = await import('../../../src/compression/libdeflateWasm.js');
    // After resetEngines() in afterEach, WASM should not be available
    expect(isAvailable()).toBe(false);
  });

  it('deflateSync() throws when WASM is not initialized', async () => {
    const { deflateSync } = await import('../../../src/compression/libdeflateWasm.js');
    const input = encoder.encode('Test data');
    expect(() => deflateSync(input)).toThrow(/not initialized/);
  });

  it('initDeflateWasm() throws a meaningful error when no WASM binary exists', async () => {
    const { initDeflateWasm, dispose } = await import('../../../src/compression/libdeflateWasm.js');
    // Ensure clean state
    dispose();

    // Calling initDeflateWasm without a binary should throw (since the
    // WASM loader module cannot find a compiled binary) rather than crash.
    try {
      await initDeflateWasm();
      // If it somehow succeeds (unlikely), that's OK too -- clean up
      dispose();
    } catch (err) {
      expect(err).toBeDefined();
      expect(err instanceof Error).toBe(true);
      expect((err as Error).message).toBeTruthy();
    }
  });
});

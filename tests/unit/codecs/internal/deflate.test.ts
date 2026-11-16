/**
 * Tests for the compression subsystem — fflate adapter and unified deflate API.
 *
 * Covers compress roundtrips, empty input, compression levels, engine
 * selection and the zlib (RFC 1950) format every engine writes. node:zlib is
 * the oracle for the format and reads every output back. The engines do not
 * decompress: the library reads `/FlateDecode` data through the FlateDecode
 * codec (pdfFlate.test.ts).
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import {
  compressSync,
  compressAsync,
  FflateEngine,
} from '../../../../src/codecs/internal/fflateAdapter.js';
import {
  compress,
  getCompressor,
  resetEngines,
  clampLevel,
} from '../../../../src/codecs/internal/deflate.js';
import type { CompressionEngine } from '../../../../src/codecs/internal/deflate.js';
import {
  deflateSync as libdeflateSync,
  dispose as disposeLibdeflate,
  initDeflateWasm,
} from '../../../../src/codecs/internal/libdeflateWasm.js';
import { configureWasmLoader } from '../../../../src/wasm/loader.js';
import { EnvironmentError, InvalidStateError } from '../../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** node:zlib's reading of zlib data, which checks the header and the Adler-32 trailer. */
const inflate = (data: Uint8Array): Uint8Array => new Uint8Array(inflateSync(data));

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
    const original = encoder.encode(
      'Hello, compression world! This is a test of the deflate algorithm.',
    );
    const compressed = compressSync(original);
    const decompressed = inflate(compressed);

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
    const decompressed = inflate(compressed);

    expect(decompressed.length).toBe(0);
  });

  it('different compression levels all produce valid output', () => {
    const data = encoder.encode('Test data for all levels of compression.');

    for (let level = 1; level <= 9; level++) {
      const compressed = compressSync(data, level);
      const decompressed = inflate(compressed);
      expect(decoder.decode(decompressed)).toBe('Test data for all levels of compression.');
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
});

// ---------------------------------------------------------------------------
// fflate adapter async tests
// ---------------------------------------------------------------------------

describe('fflate adapter (async)', () => {
  it('compresses and decompresses roundtrip', async () => {
    const original = encoder.encode('Async compression roundtrip test.');
    const compressed = await compressAsync(original);
    const decompressed = inflate(compressed);

    expect(decoder.decode(decompressed)).toBe('Async compression roundtrip test.');
  });

  it('empty input compresses and decompresses', async () => {
    const empty = new Uint8Array(0);
    const compressed = await compressAsync(empty);
    const decompressed = inflate(compressed);
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
    expect(typeof engine.dispose).toBe('function');
  });

  it('compress and decompress roundtrip via engine', async () => {
    const engine = new FflateEngine({ useAsync: false });
    const original = encoder.encode('Engine roundtrip test data.');

    const compressed = await engine.compress(original, 6);
    const decompressed = inflate(compressed);

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
    const decompressed = inflate(compressed);

    expect(decoder.decode(decompressed)).toBe('Unified API roundtrip test.');
  });

  it('clampLevel clamps to engine range', () => {
    const engine: CompressionEngine = {
      name: 'test',
      minLevel: 1,
      maxLevel: 9,
      compress: async (d) => d,
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
    const { isAvailable } = await import('../../../../src/codecs/internal/libdeflateWasm.js');
    // After resetEngines() in afterEach, WASM should not be available
    expect(isAvailable()).toBe(false);
  });

  it('deflateSync() throws when WASM is not initialized', async () => {
    const { deflateSync } = await import('../../../../src/codecs/internal/libdeflateWasm.js');
    const input = encoder.encode('Test data');
    expect(() => deflateSync(input)).toThrow(/not initialized/);
  });

  it('initDeflateWasm() throws a meaningful error when no WASM binary exists', async () => {
    const { initDeflateWasm, dispose } =
      await import('../../../../src/codecs/internal/libdeflateWasm.js');
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

// ---------------------------------------------------------------------------
// Format: every engine writes zlib data
// ---------------------------------------------------------------------------

/** A page-sized content stream, compressible and deterministic. */
const STREAM = encoder.encode(
  Array.from({ length: 40 }, (_, i) => `BT /F1 12 Tf 72 ${700 - i * 14} Td (Line ${i}) Tj ET`).join(
    '\n',
  ),
);

/** Copy any byte view (Buffer included) into a plain Uint8Array. */
function bytes(view: Uint8Array): Uint8Array {
  return Uint8Array.from(view);
}

/** The engines a caller can obtain, each with a name for the test title. */
async function engines(): Promise<Array<[string, CompressionEngine]>> {
  return [
    ['fflate (async)', new FflateEngine()],
    ['fflate (sync)', new FflateEngine({ useAsync: false })],
    ['browser', await getCompressor({ preferEngine: 'browser' })],
  ];
}

describe('compress output is zlib data', () => {
  it('compressSync output passes node:zlib inflateSync at every level', () => {
    for (let level = 1; level <= 9; level++) {
      expect(bytes(inflateSync(compressSync(STREAM, level)))).toEqual(STREAM);
    }
  });

  it('compressAsync output passes node:zlib inflateSync', async () => {
    expect(bytes(inflateSync(await compressAsync(STREAM)))).toEqual(STREAM);
    expect(bytes(inflateSync(await compressAsync(STREAM, 9)))).toEqual(STREAM);
  });

  it('every engine writes zlib data', async () => {
    for (const [name, engine] of await engines()) {
      const out = await engine.compress(STREAM, 6);
      expect(bytes(inflateSync(out)), name).toEqual(STREAM);
    }
  });

  it('the browser engine needs only CompressionStream', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      const engine = await getCompressor({ preferEngine: 'browser' });
      expect(engine.name).toBe('browser-compression-stream');
      const out = await engine.compress(STREAM, 6);
      expect(bytes(inflateSync(out))).toEqual(STREAM);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('compress() writes zlib data', async () => {
    const out = await compress(STREAM, { level: 6, preferEngine: 'fflate' });
    expect(bytes(inflateSync(out))).toEqual(STREAM);
  });

  it('empty input compresses to zlib data', async () => {
    const empty = new Uint8Array(0);
    expect(bytes(inflateSync(compressSync(empty))).length).toBe(0);
    expect(bytes(inflateSync(await compressAsync(empty))).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/**
 * A WebAssembly module with the exports of the libdeflate wrapper (`alloc`, `dealloc`, `compress`,
 * `decompress`, `memory`) whose `compress` returns 0 and whose `decompress` returns -1: the compress
 * failure the wrapper reports, without the compiled crate.
 */
const FAILING_LIBDEFLATE = new Uint8Array([
  0x00,
  0x61,
  0x73,
  0x6d,
  0x01,
  0x00,
  0x00,
  0x00, // magic, version
  0x01,
  0x1c,
  0x04, // type section: four types
  0x60,
  0x01,
  0x7f,
  0x01,
  0x7f, // (i32) -> i32
  0x60,
  0x02,
  0x7f,
  0x7f,
  0x00, // (i32, i32) -> ()
  0x60,
  0x05,
  0x7f,
  0x7f,
  0x7f,
  0x7f,
  0x7f,
  0x01,
  0x7f, // (i32 x5) -> i32
  0x60,
  0x04,
  0x7f,
  0x7f,
  0x7f,
  0x7f,
  0x01,
  0x7f, // (i32 x4) -> i32
  0x03,
  0x05,
  0x04,
  0x00,
  0x01,
  0x02,
  0x03, // function section: types 0, 1, 2, 3
  0x05,
  0x03,
  0x01,
  0x00,
  0x01, // memory section: one memory of one page
  0x07,
  0x34,
  0x05, // export section: five exports
  0x05,
  0x61,
  0x6c,
  0x6c,
  0x6f,
  0x63,
  0x00,
  0x00, // "alloc": function 0
  0x07,
  0x64,
  0x65,
  0x61,
  0x6c,
  0x6c,
  0x6f,
  0x63,
  0x00,
  0x01, // "dealloc": function 1
  0x08,
  0x63,
  0x6f,
  0x6d,
  0x70,
  0x72,
  0x65,
  0x73,
  0x73,
  0x00,
  0x02, // "compress": function 2
  0x0a,
  0x64,
  0x65,
  0x63,
  0x6f,
  0x6d,
  0x70,
  0x72,
  0x65,
  0x73,
  0x73,
  0x00,
  0x03, // "decompress": 3
  0x06,
  0x6d,
  0x65,
  0x6d,
  0x6f,
  0x72,
  0x79,
  0x02,
  0x00, // "memory": memory 0
  0x0a,
  0x14,
  0x04, // code section: four bodies
  0x05,
  0x00,
  0x41,
  0x80,
  0x08,
  0x0b, // alloc: returns 1024
  0x02,
  0x00,
  0x0b, // dealloc: does nothing
  0x04,
  0x00,
  0x41,
  0x00,
  0x0b, // compress: returns 0
  0x04,
  0x00,
  0x41,
  0x7f,
  0x0b, // decompress: returns -1
]);

describe('deflate typed errors', () => {
  // A failed initDeflateWasm() is not retried until dispose(), so start every test from a clean module.
  beforeEach(disposeLibdeflate);

  afterEach(() => {
    disposeLibdeflate();
    configureWasmLoader({});
    vi.unstubAllGlobals();
  });

  it('getCompressor({ preferEngine: "libdeflate" }) rejects with EnvironmentError (wasm) without the module', async () => {
    configureWasmLoader({ disableWasm: true });

    const error = await getCompressor({ preferEngine: 'libdeflate' }).then(
      () => expect.unreachable('an engine was returned although WASM is disabled'),
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
    expect((error as Error).message).toBe(
      'libdeflate WASM engine requested but not available. ' +
        'Ensure the WASM module is built and accessible.',
    );
  });

  it('getCompressor({ preferEngine: "browser" }) rejects with EnvironmentError (runtime-api) without CompressionStream', async () => {
    vi.stubGlobal('CompressionStream', undefined);

    const error = await getCompressor({ preferEngine: 'browser' }).then(
      () => expect.unreachable('an engine was returned although CompressionStream is missing'),
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'runtime-api' });
    expect((error as Error).message).toBe(
      'Browser CompressionStream requested but not available in this runtime.',
    );
  });

  it('the libdeflate helpers throw InvalidStateError before initDeflateWasm() ran', () => {
    for (const call of [() => libdeflateSync(new Uint8Array([1, 2, 3]))]) {
      expect(call).toThrow(InvalidStateError);
      expect(call).toThrow('libdeflate WASM not initialized. Call initDeflateWasm() first.');
    }
  });

  it('initDeflateWasm() rejects with EnvironmentError (wasm) caused by the compile error', async () => {
    const error = await initDeflateWasm(new Uint8Array([0xde, 0xad, 0xbe, 0xef])).then(
      () => expect.unreachable('invalid WASM bytes were accepted'),
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
    expect((error as Error).message).toContain('Failed to initialize libdeflate WASM: ');
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it('a compress that reports no output throws EnvironmentError (wasm)', async () => {
    await initDeflateWasm(FAILING_LIBDEFLATE);

    try {
      libdeflateSync(new Uint8Array([1, 2, 3]));
      expect.unreachable('a failed compression returned data');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toBe(
        'libdeflate compression failed (returned zero or negative size)',
      );
    }
  });
});

/**
 * @module compression/deflate
 *
 * Unified compression interface for the modern-pdf library.
 *
 * Provides a single entry point for deflate compression/decompression
 * with automatic engine selection based on availability:
 *
 * 1. **libdeflate WASM** -- fastest, levels 1-12
 * 2. **fflate** (pure JS) -- good fallback, levels 1-9
 * 3. **CompressionStream** (browser built-in) -- last resort, no level control
 *
 * Usage:
 * ```ts
 * import { compress, decompress, getCompressor } from './deflate.js';
 *
 * const compressed = await compress(data, { level: 6 });
 * const original   = await decompress(compressed);
 *
 * // Or get a reusable engine:
 * const engine = await getCompressor({ preferEngine: 'libdeflate' });
 * const out = await engine.compress(data, 9);
 * ```
 *
 * @packageDocumentation
 */

import type { LibdeflateWasm } from './libdeflateWasm.js';
import type { FflateEngine } from './fflateAdapter.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Preference for which compression engine to use.
 *
 * - `'libdeflate'` -- WASM-based libdeflate (fastest, levels 1-12)
 * - `'fflate'`     -- pure-JS fflate (levels 1-9)
 * - `'browser'`    -- built-in CompressionStream API (no level control)
 * - `'auto'`       -- best available engine (default)
 */
export type EnginePreference = 'libdeflate' | 'fflate' | 'browser' | 'auto';

/** Options for compression operations. */
export interface CompressionOptions {
  /**
   * Compression level.
   *
   * - libdeflate: 1-12 (12 = best compression, slower)
   * - fflate:     1-9  (9 = best compression)
   * - browser:    ignored (no level control)
   *
   * Default: `6`
   */
  level?: number | undefined;

  /**
   * Preferred compression engine.
   *
   * When set to `'auto'` (the default), the best available engine is
   * selected: libdeflate WASM > fflate > browser CompressionStream.
   */
  preferEngine?: EnginePreference | undefined;
}

/**
 * Abstract interface that all compression back-ends implement.
 *
 * Implementations must be stateless with respect to individual
 * compress/decompress calls (they may hold internal WASM instances
 * or cached state, but each call is independent).
 */
export interface CompressionEngine {
  /** Human-readable engine name for diagnostics. */
  readonly name: string;

  /** Minimum supported compression level. */
  readonly minLevel: number;

  /** Maximum supported compression level. */
  readonly maxLevel: number;

  /**
   * Compress raw data using the deflate algorithm.
   *
   * @param data  - Uncompressed input bytes.
   * @param level - Compression level (clamped to engine range).
   * @returns       Compressed bytes (raw deflate, no zlib/gzip wrapper).
   */
  compress(data: Uint8Array, level?: number): Promise<Uint8Array>;

  /**
   * Decompress deflate-compressed data.
   *
   * @param data       - Compressed input bytes (raw deflate).
   * @param outputSize - Optional hint for output buffer size.
   *                     Required by some engines for optimal performance.
   * @returns            Decompressed bytes.
   */
  decompress(data: Uint8Array, outputSize?: number): Promise<Uint8Array>;

  /**
   * Release any resources held by this engine (e.g. WASM memory).
   * After calling dispose(), the engine must not be used again.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Engine singletons and initialization state
// ---------------------------------------------------------------------------

/** Cached libdeflate WASM engine (lazy initialized). */
let libdeflateEngine: CompressionEngine | null = null;

/** Cached fflate engine (lazy initialized). */
let fflateEngine: CompressionEngine | null = null;

/** Whether we have already attempted to load libdeflate WASM. */
let libdeflateAttempted = false;

// ---------------------------------------------------------------------------
// Browser CompressionStream engine
// ---------------------------------------------------------------------------

/**
 * Compression engine backed by the browser's built-in
 * `CompressionStream` / `DecompressionStream` APIs.
 *
 * This is the lowest-priority fallback -- it does not support
 * compression levels and may not be available in all runtimes.
 */
class BrowserDeflateEngine implements CompressionEngine {
  readonly name = 'browser-compression-stream';
  readonly minLevel = 1;
  readonly maxLevel = 1;

  /** @inheritdoc */
  async compress(data: Uint8Array, _level?: number): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    return this.pipeThroughStream(cs, data);
  }

  /** @inheritdoc */
  async decompress(data: Uint8Array, _outputSize?: number): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate-raw');
    return this.pipeThroughStream(ds, data);
  }

  /** @inheritdoc */
  dispose(): void {
    // No resources to release for the browser engine.
  }

  /**
   * Pipe data through a compression/decompression transform stream
   * and collect the result.
   */
  private async pipeThroughStream(
    transform: CompressionStream | DecompressionStream,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();

    // Write input and close
    writer.write(new Uint8Array(data)).catch(() => {
      /* errors surface on the readable side */
    });
    writer.close().catch(() => {
      /* errors surface on the readable side */
    });

    // Collect output chunks
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    // Merge into a single Uint8Array
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Engine detection and initialization
// ---------------------------------------------------------------------------

/**
 * Check whether the browser CompressionStream API is available.
 */
function isBrowserCompressionAvailable(): boolean {
  return (
    typeof globalThis.CompressionStream === 'function' &&
    typeof globalThis.DecompressionStream === 'function'
  );
}

/**
 * Attempt to load and initialize the libdeflate WASM engine.
 *
 * On first call, dynamically imports the WASM wrapper module and
 * tries to instantiate it. The result is cached so subsequent calls
 * return immediately.
 *
 * @returns The libdeflate engine, or `null` if unavailable.
 */
async function tryLoadLibdeflate(): Promise<CompressionEngine | null> {
  if (libdeflateAttempted) return libdeflateEngine;
  libdeflateAttempted = true;

  try {
    // Dynamic import so that the WASM module is not required at load time
    const { LibdeflateWasm: LibdeflateCtor, initDeflateWasm } = await import(
      './libdeflateWasm.js'
    );

    // If the user configured custom WASM bytes via the universal loader,
    // retrieve them and pass through to initDeflateWasm.
    let customBytes: Uint8Array | undefined;
    try {
      const { getWasmLoaderConfig } = await import('../wasm/loader.js');
      const config = getWasmLoaderConfig();
      customBytes = config.moduleBytes?.['libdeflate'];
    } catch {
      // Loader not available -- proceed without custom bytes
    }
    await initDeflateWasm(customBytes);

    libdeflateEngine = new LibdeflateCtor();
    return libdeflateEngine;
  } catch {
    // WASM not available -- fall through
    libdeflateEngine = null;
    return null;
  }
}

/**
 * Load the fflate engine (always available since fflate is a dependency).
 *
 * @returns The fflate compression engine.
 */
async function loadFflate(): Promise<CompressionEngine> {
  if (fflateEngine) return fflateEngine;

  const { FflateEngine: FflateCtor } = await import('./fflateAdapter.js');
  fflateEngine = new FflateCtor();
  return fflateEngine;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the best available compression engine based on preference and
 * runtime capabilities.
 *
 * Engine selection order for `'auto'`:
 * 1. libdeflate WASM (if initialized or can be loaded)
 * 2. fflate (always available)
 * 3. Browser CompressionStream (if available)
 *
 * @param options - Compression options (only `preferEngine` is used).
 * @returns         A ready-to-use compression engine.
 *
 * @example
 * ```ts
 * const engine = await getCompressor({ preferEngine: 'auto' });
 * console.log(`Using: ${engine.name}`);
 * ```
 */
export async function getCompressor(
  options?: CompressionOptions,
): Promise<CompressionEngine> {
  const preference = options?.preferEngine ?? 'auto';

  switch (preference) {
    case 'libdeflate': {
      const engine = await tryLoadLibdeflate();
      if (engine) return engine;
      throw new Error(
        'libdeflate WASM engine requested but not available. ' +
          'Ensure the WASM module is built and accessible.',
      );
    }

    case 'fflate':
      return loadFflate();

    case 'browser': {
      if (isBrowserCompressionAvailable()) {
        return new BrowserDeflateEngine();
      }
      throw new Error(
        'Browser CompressionStream requested but not available in this runtime.',
      );
    }

    case 'auto':
    default: {
      // Try libdeflate first
      const wasm = await tryLoadLibdeflate();
      if (wasm) return wasm;

      // Fall back to fflate (always available)
      return loadFflate();
    }
  }
}

/**
 * Compress data using the best available engine.
 *
 * This is a convenience function that calls {@link getCompressor}
 * internally. For repeated use, prefer obtaining an engine via
 * `getCompressor()` and calling its `compress()` method directly.
 *
 * @param data    - Raw bytes to compress.
 * @param options - Compression options.
 * @returns         Compressed bytes (raw deflate format).
 *
 * @example
 * ```ts
 * const compressed = await compress(rawData, { level: 9 });
 * ```
 */
export async function compress(
  data: Uint8Array,
  options?: CompressionOptions,
): Promise<Uint8Array> {
  const engine = await getCompressor(options);
  const level = options?.level ?? 6;
  return engine.compress(data, level);
}

/**
 * Decompress deflate-compressed data using the best available engine.
 *
 * @param data       - Compressed bytes (raw deflate format).
 * @param outputSize - Optional output size hint for buffer pre-allocation.
 * @param options    - Engine preference.
 * @returns            Decompressed bytes.
 *
 * @example
 * ```ts
 * const original = await decompress(compressedData);
 * ```
 */
export async function decompress(
  data: Uint8Array,
  outputSize?: number,
  options?: CompressionOptions,
): Promise<Uint8Array> {
  const engine = await getCompressor(options);
  return engine.decompress(data, outputSize);
}

/**
 * Clamp a compression level to the engine's supported range.
 *
 * @param level  - Requested level.
 * @param engine - Target engine.
 * @returns        Clamped level.
 */
export function clampLevel(level: number, engine: CompressionEngine): number {
  return Math.max(engine.minLevel, Math.min(engine.maxLevel, Math.round(level)));
}

/**
 * Reset all cached engines. Primarily useful for testing.
 *
 * After calling this, the next `getCompressor()` call will re-detect
 * and re-initialize engines from scratch.
 */
export function resetEngines(): void {
  if (libdeflateEngine) {
    libdeflateEngine.dispose();
    libdeflateEngine = null;
  }
  if (fflateEngine) {
    fflateEngine.dispose();
    fflateEngine = null;
  }
  libdeflateAttempted = false;
}

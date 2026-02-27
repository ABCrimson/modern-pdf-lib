/**
 * @module compression/fflateAdapter
 *
 * Compression engine adapter for the `fflate` npm package.
 *
 * `fflate` is a pure-JavaScript deflate implementation that serves as the
 * primary fallback when the libdeflate WASM module is unavailable. It
 * supports compression levels 1-9 and provides both synchronous and
 * asynchronous variants.
 *
 * This adapter implements the {@link CompressionEngine} interface from
 * `./deflate.ts`, making it interchangeable with the WASM and browser
 * engines.
 *
 * @packageDocumentation
 */

import {
  deflateSync,
  inflateSync,
  deflate as deflateAsync,
  inflate as inflateAsync,
} from 'fflate';
import type { CompressionEngine } from './deflate.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid fflate compression levels. */
type FflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a compression level to fflate's valid range (1-9).
 *
 * Level 0 (no compression) is intentionally excluded -- if you want
 * no compression, skip the engine entirely.
 *
 * @param level - Requested level.
 * @returns       Clamped level in range [1, 9].
 */
function clampFflateLevel(level: number): FflateLevel {
  return Math.max(1, Math.min(9, Math.round(level))) as FflateLevel;
}

/**
 * Wrap fflate's callback-based async API in a Promise.
 *
 * @param fn   - The fflate async function (deflate or inflate).
 * @param data - Input bytes.
 * @param opts - Options to pass to the fflate function.
 * @returns      A Promise that resolves with the result bytes.
 */
function promisify(
  fn: (
    data: Uint8Array,
    opts: Record<string, unknown>,
    cb: (err: Error | null, result: Uint8Array) => void,
  ) => void,
  data: Uint8Array,
  opts: Record<string, unknown>,
): Promise<Uint8Array> {
  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  fn(data, opts, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
  return promise;
}

// ---------------------------------------------------------------------------
// Sync API
// ---------------------------------------------------------------------------

/**
 * Synchronously compress data using fflate's deflateSync.
 *
 * @param data  - Uncompressed input bytes.
 * @param level - Compression level 1-9. Default: `6`.
 * @returns       Compressed bytes (raw deflate, no zlib/gzip wrapper).
 *
 * @example
 * ```ts
 * const compressed = compressSync(myData, 6);
 * ```
 */
export function compressSync(data: Uint8Array, level: number = 6): Uint8Array {
  return deflateSync(data, { level: clampFflateLevel(level) });
}

/**
 * Synchronously decompress raw deflate data using fflate's inflateSync.
 *
 * @param data       - Compressed bytes (raw deflate).
 * @param outputSize - Optional output buffer size hint. When provided,
 *                     fflate pre-allocates the buffer for better performance.
 * @returns            Decompressed bytes.
 *
 * @example
 * ```ts
 * const original = decompressSync(compressed);
 * ```
 */
export function decompressSync(data: Uint8Array, outputSize?: number): Uint8Array {
  if (outputSize !== undefined && outputSize > 0) {
    // Pre-allocate output buffer for fflate
    const out = new Uint8Array(outputSize);
    return inflateSync(data, { out });
  }
  return inflateSync(data);
}

// ---------------------------------------------------------------------------
// Async API
// ---------------------------------------------------------------------------

/**
 * Asynchronously compress data using fflate's Web Worker-backed deflate.
 *
 * In environments that support Workers, fflate offloads compression
 * to a background thread. In other environments, it falls back to
 * synchronous compression wrapped in a microtask.
 *
 * @param data  - Uncompressed input bytes.
 * @param level - Compression level 1-9. Default: `6`.
 * @returns       A Promise resolving to compressed bytes.
 *
 * @example
 * ```ts
 * const compressed = await compressAsync(myData, 9);
 * ```
 */
export async function compressAsync(data: Uint8Array, level: number = 6): Promise<Uint8Array> {
  return promisify(
    deflateAsync as unknown as (
      data: Uint8Array,
      opts: Record<string, unknown>,
      cb: (err: Error | null, result: Uint8Array) => void,
    ) => void,
    data,
    { level: clampFflateLevel(level) },
  );
}

/**
 * Asynchronously decompress raw deflate data.
 *
 * @param data       - Compressed bytes (raw deflate).
 * @param outputSize - Optional output buffer size hint.
 * @returns            A Promise resolving to decompressed bytes.
 */
export async function decompressAsync(
  data: Uint8Array,
  outputSize?: number,
): Promise<Uint8Array> {
  const opts: Record<string, unknown> = {};
  if (outputSize !== undefined && outputSize > 0) {
    opts['out'] = new Uint8Array(outputSize);
  }

  return promisify(
    inflateAsync as unknown as (
      data: Uint8Array,
      opts: Record<string, unknown>,
      cb: (err: Error | null, result: Uint8Array) => void,
    ) => void,
    data,
    opts,
  );
}

// ---------------------------------------------------------------------------
// CompressionEngine implementation
// ---------------------------------------------------------------------------

/**
 * A {@link CompressionEngine} backed by the `fflate` npm package.
 *
 * This is the primary fallback engine when WASM is not available.
 * Supports compression levels 1-9 and provides both synchronous
 * (internally) and async (via Workers if available) compression.
 *
 * @example
 * ```ts
 * const engine = new FflateEngine();
 * const compressed = await engine.compress(data, 6);
 * const original = await engine.decompress(compressed);
 * ```
 */
export class FflateEngine implements CompressionEngine {
  readonly name = 'fflate';
  readonly minLevel = 1;
  readonly maxLevel = 9;

  /**
   * Whether to use the async (Worker-based) API when available.
   * Default: `true`.
   */
  private readonly useAsync: boolean;

  /**
   * @param options - Engine configuration.
   * @param options.useAsync - When `true` (default), uses fflate's
   *   async API which offloads work to a Web Worker. Set to `false`
   *   to force synchronous compression (useful in Worker contexts
   *   where nested Workers are not supported).
   */
  constructor(options?: { useAsync?: boolean | undefined }) {
    this.useAsync = options?.useAsync ?? true;
  }

  /**
   * Compress data using fflate.
   *
   * Uses the async (Worker-based) API by default for better
   * responsiveness, falling back to synchronous if async fails.
   *
   * @param data  - Uncompressed input bytes.
   * @param level - Compression level 1-9 (clamped). Default: `6`.
   * @returns       Compressed bytes (raw deflate).
   */
  async compress(data: Uint8Array, level: number = 6): Promise<Uint8Array> {
    if (this.useAsync) {
      try {
        return await compressAsync(data, level);
      } catch {
        // Async failed (e.g. Workers not available), fall back to sync
        return compressSync(data, level);
      }
    }
    return compressSync(data, level);
  }

  /**
   * Decompress raw deflate data using fflate.
   *
   * @param data       - Compressed bytes (raw deflate).
   * @param outputSize - Optional output buffer size hint.
   * @returns            Decompressed bytes.
   */
  async decompress(data: Uint8Array, outputSize?: number): Promise<Uint8Array> {
    if (this.useAsync) {
      try {
        return await decompressAsync(data, outputSize);
      } catch {
        // Async failed, fall back to sync
        return decompressSync(data, outputSize);
      }
    }
    return decompressSync(data, outputSize);
  }

  /**
   * Release engine resources.
   *
   * fflate does not hold persistent resources, so this is a no-op.
   * It exists to satisfy the {@link CompressionEngine} interface.
   */
  dispose(): void {
    // fflate is stateless -- nothing to dispose.
  }
}

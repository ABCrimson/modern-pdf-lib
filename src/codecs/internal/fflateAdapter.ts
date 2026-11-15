/**
 * @module codecs/internal/fflateAdapter
 *
 * Compression engine adapter for the `fflate` npm package.
 *
 * `fflate` is a pure-JavaScript deflate implementation that serves as the
 * primary fallback when the libdeflate WASM module is unavailable. It
 * supports compression levels 1-9 and provides both synchronous and
 * asynchronous variants.
 *
 * Compression writes zlib data (RFC 1950), the format `/FlateDecode`
 * requires. Decompression goes through the FlateDecode codec
 * (`./pdfFlate.ts`): it reads zlib data and, as a fallback, raw DEFLATE.
 *
 * This adapter implements the {@link CompressionEngine} interface from
 * `./deflate.ts`, making it interchangeable with the WASM and browser
 * engines.
 *
 * @packageDocumentation
 */

import { zlib as zlibAsync } from 'fflate';
import type { CompressionEngine } from './deflate.js';
import { clampFlateLevel, flateEncode, inflateFlate } from './pdfFlate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap fflate's callback-based async API in a Promise.
 *
 * @param fn   - The fflate async function.
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
 * Synchronously compress data as zlib data (fflate's `zlibSync`).
 *
 * @param data  - Uncompressed input bytes.
 * @param level - Compression level, rounded and clamped to 1-9. Default: `6`.
 * @returns       Compressed bytes: zlib data (RFC 1950).
 *
 * @example
 * ```ts
 * const compressed = compressSync(myData, 6);
 * ```
 */
export function compressSync(data: Uint8Array, level: number = 6): Uint8Array {
  return flateEncode(data, level);
}

/**
 * Synchronously decompress zlib data, or raw DEFLATE as a fallback.
 *
 * The data goes through the FlateDecode codec (`inflateFlate` in
 * `./pdfFlate.ts`), which reads zlib data (RFC 1950) and falls back to raw
 * DEFLATE, the data modern-pdf-lib 0.40.6 and earlier wrote.
 *
 * @param data        - Compressed bytes: zlib data or raw DEFLATE.
 * @param _outputSize - Ignored. Kept for signature compatibility: the
 *                      result always holds every decompressed byte, however
 *                      small the hint.
 * @returns             Decompressed bytes.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   inflates neither as zlib nor as raw DEFLATE.
 *
 * @example
 * ```ts
 * const original = decompressSync(compressed);
 * ```
 */
export function decompressSync(data: Uint8Array, _outputSize?: number): Uint8Array {
  return inflateFlate(data);
}

// ---------------------------------------------------------------------------
// Async API
// ---------------------------------------------------------------------------

/**
 * Asynchronously compress data as zlib data using fflate's Worker-backed
 * `zlib`.
 *
 * In environments that support Workers, fflate offloads compression
 * to a background thread. In other environments, it falls back to
 * synchronous compression wrapped in a microtask.
 *
 * @param data  - Uncompressed input bytes.
 * @param level - Compression level, rounded and clamped to 1-9. Default: `6`.
 * @returns       A Promise resolving to zlib data (RFC 1950).
 *
 * @example
 * ```ts
 * const compressed = await compressAsync(myData, 9);
 * ```
 */
export async function compressAsync(data: Uint8Array, level: number = 6): Promise<Uint8Array> {
  return promisify(
    zlibAsync as unknown as (
      data: Uint8Array,
      opts: Record<string, unknown>,
      cb: (err: Error | null, result: Uint8Array) => void,
    ) => void,
    data,
    { level: clampFlateLevel(level) },
  );
}

/**
 * Decompress zlib data, or raw DEFLATE as a fallback, behind a Promise.
 *
 * The work runs on the calling thread through the same FlateDecode codec
 * as {@link decompressSync}, so both functions accept and reject the same
 * data.
 *
 * @param data        - Compressed bytes: zlib data or raw DEFLATE.
 * @param _outputSize - Ignored. Kept for signature compatibility: the
 *                      result always holds every decompressed byte.
 * @returns             A Promise resolving to decompressed bytes; it rejects
 *   with `FlateDecode: failed to decompress data` when the data inflates
 *   neither as zlib nor as raw DEFLATE.
 */
export async function decompressAsync(data: Uint8Array, _outputSize?: number): Promise<Uint8Array> {
  return inflateFlate(data);
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
   * Whether to compress with the async (Worker-based) API when available.
   * Default: `true`.
   */
  private readonly useAsync: boolean;

  /**
   * @param options - Engine configuration.
   * @param options.useAsync - When `true` (default), compresses with
   *   fflate's async API, which offloads work to a Web Worker. Set to `false`
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
   * @returns       Compressed bytes: zlib data (RFC 1950).
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
   * Decompress zlib data, or raw DEFLATE as a fallback, through the
   * FlateDecode codec ({@link decompressSync}). The `useAsync` option does
   * not apply here: decompression always runs on the calling thread.
   *
   * @param data        - Compressed bytes: zlib data or raw DEFLATE.
   * @param _outputSize - Ignored; the result always holds every byte.
   * @returns             Decompressed bytes.
   */
  async decompress(data: Uint8Array, _outputSize?: number): Promise<Uint8Array> {
    return decompressSync(data);
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

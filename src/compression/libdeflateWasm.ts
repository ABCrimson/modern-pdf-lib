/**
 * @module compression/libdeflateWasm
 *
 * WASM-backed compression engine using a Rust-compiled libdeflate module.
 *
 * This is the highest-performance compression option, supporting
 * levels 1-12 (libdeflate's native range). The WASM module must be
 * loaded before this engine can be used -- call {@link initDeflateWasm}
 * once at startup.
 *
 * The engine manages a shared memory region for data transfers between
 * JS and WASM, minimizing allocations on the hot path.
 *
 * @packageDocumentation
 */

import type { CompressionEngine } from './deflate.js';

// ---------------------------------------------------------------------------
// WASM module interface
// ---------------------------------------------------------------------------

/**
 * Shape of the exports from the compiled Rust WASM module
 * (`modern-pdf-deflate`).
 *
 * These are the raw `wasm-bindgen` exports -- the TypeScript wrapper
 * in this file provides the idiomatic API.
 */
interface DeflateWasmExports {
  /** Allocate `size` bytes in WASM linear memory. Returns pointer. */
  alloc(size: number): number;

  /** Free a previously allocated region. */
  dealloc(ptr: number, size: number): void;

  /**
   * Compress `inputLen` bytes at `inputPtr` with the given `level`.
   * Writes output starting at `outputPtr`. Returns actual output length.
   */
  compress(inputPtr: number, inputLen: number, outputPtr: number, outputLen: number, level: number): number;

  /**
   * Decompress `inputLen` bytes at `inputPtr`.
   * Writes output starting at `outputPtr` (must be at least `maxOutputSize` bytes).
   * Returns actual decompressed length.
   */
  decompress(inputPtr: number, inputLen: number, outputPtr: number, maxOutputSize: number): number;

  /** WASM linear memory. */
  memory: WebAssembly.Memory;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** The instantiated WASM module exports, or `null` if not yet loaded. */
let wasmExports: DeflateWasmExports | null = null;

/** Whether initialization has been attempted. */
let initAttempted = false;

/** Whether the WASM module is ready for use. */
let available = false;

// ---------------------------------------------------------------------------
// WASM memory helpers
// ---------------------------------------------------------------------------

/**
 * Get a view of the WASM linear memory.
 *
 * This must be called fresh each time because growing the WASM memory
 * invalidates prior `Uint8Array` views.
 */
function wasmMemory(): Uint8Array {
  if (!wasmExports) throw new Error('libdeflate WASM not initialized');
  return new Uint8Array(wasmExports.memory.buffer);
}

/**
 * Copy data into WASM linear memory at the given pointer.
 *
 * @param ptr  - Target pointer in WASM memory.
 * @param data - Source bytes to copy.
 */
function copyToWasm(ptr: number, data: Uint8Array): void {
  wasmMemory().set(data, ptr);
}

/**
 * Copy data out of WASM linear memory.
 *
 * @param ptr - Source pointer in WASM memory.
 * @param len - Number of bytes to copy.
 * @returns     A new Uint8Array with the copied data.
 */
function copyFromWasm(ptr: number, len: number): Uint8Array {
  const copy = new Uint8Array(len);
  copy.set(wasmMemory().subarray(ptr, ptr + len));
  return copy;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the libdeflate WASM module.
 *
 * This must be called before using {@link LibdeflateWasm} or the
 * synchronous helpers. It is safe to call multiple times -- subsequent
 * calls are no-ops.
 *
 * @param wasmBytes - Optional pre-loaded WASM binary. When omitted,
 *                    the module is loaded via the universal WASM loader
 *                    (see `src/wasm/loader.ts`).
 * @throws If the WASM module cannot be loaded or instantiated.
 *
 * @example
 * ```ts
 * // Auto-load from default location
 * await initDeflateWasm();
 *
 * // Or provide bytes directly (e.g. bundled)
 * await initDeflateWasm(myWasmBytes);
 * ```
 */
export async function initDeflateWasm(wasmBytes?: Uint8Array): Promise<void> {
  if (available) return; // Already initialized
  if (initAttempted) return; // Failed previously, don't retry
  initAttempted = true;

  try {
    let bytes: Uint8Array;

    if (wasmBytes) {
      bytes = wasmBytes;
    } else {
      // Load WASM bytes via the universal loader
      const { loadWasmModule } = await import('../wasm/loader.js');
      bytes = await loadWasmModule('libdeflate');
    }

    // Compile and instantiate the WASM module
    const compiled = await WebAssembly.compile(new Uint8Array(bytes));
    const instance = await WebAssembly.instantiate(compiled, {});

    wasmExports = instance.exports as unknown as DeflateWasmExports;
    available = true;
  } catch (err) {
    wasmExports = null;
    available = false;
    throw new Error(
      `Failed to initialize libdeflate WASM: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Sync helpers (for use when WASM is already initialized)
// ---------------------------------------------------------------------------

/**
 * Synchronously compress data using libdeflate WASM.
 *
 * The WASM module must already be initialized via {@link initDeflateWasm}.
 *
 * @param input - Uncompressed bytes.
 * @param level - Compression level 1-12. Default: `6`.
 * @returns       Compressed bytes (raw deflate).
 * @throws If WASM is not initialized.
 *
 * @example
 * ```ts
 * await initDeflateWasm(bytes);
 * const compressed = deflateSync(myData, 9);
 * ```
 */
export function deflateSync(input: Uint8Array, level: number = 6): Uint8Array {
  if (!wasmExports) {
    throw new Error('libdeflate WASM not initialized. Call initDeflateWasm() first.');
  }

  // Clamp level to valid range
  const clampedLevel = Math.max(1, Math.min(12, Math.round(level)));

  // Worst-case output size: input size + overhead.
  // libdeflate guarantees compressed size <= input size + input size / 16 + 64 + 3
  const maxOutputSize = input.length + Math.ceil(input.length / 16) + 64 + 3;

  // Allocate WASM memory for input and output
  const inputPtr = wasmExports.alloc(input.length);
  const outputPtr = wasmExports.alloc(maxOutputSize);

  try {
    // Copy input data into WASM memory
    copyToWasm(inputPtr, input);

    // Perform compression
    const actualSize = wasmExports.compress(
      inputPtr,
      input.length,
      outputPtr,
      maxOutputSize,
      clampedLevel,
    );

    if (actualSize <= 0) {
      throw new Error('libdeflate compression failed (returned zero or negative size)');
    }

    // Copy result out of WASM memory
    return copyFromWasm(outputPtr, actualSize);
  } finally {
    // Always free WASM memory
    wasmExports.dealloc(inputPtr, input.length);
    wasmExports.dealloc(outputPtr, maxOutputSize);
  }
}

/**
 * Synchronously decompress raw deflate data using libdeflate WASM.
 *
 * @param input      - Compressed bytes (raw deflate).
 * @param outputSize - Maximum expected output size. Must be >= actual
 *                     decompressed size. Default: `input.length * 4`.
 * @returns            Decompressed bytes.
 * @throws If WASM is not initialized or decompression fails.
 *
 * @example
 * ```ts
 * const original = inflateSync(compressed, knownOriginalSize);
 * ```
 */
export function inflateSync(
  input: Uint8Array,
  outputSize: number = input.length * 4,
): Uint8Array {
  if (!wasmExports) {
    throw new Error('libdeflate WASM not initialized. Call initDeflateWasm() first.');
  }

  const maxOutput = Math.max(outputSize, input.length * 2);

  const inputPtr = wasmExports.alloc(input.length);
  const outputPtr = wasmExports.alloc(maxOutput);

  try {
    copyToWasm(inputPtr, input);

    const actualSize = wasmExports.decompress(
      inputPtr,
      input.length,
      outputPtr,
      maxOutput,
    );

    if (actualSize < 0) {
      throw new Error(
        'libdeflate decompression failed. The input may be corrupt or ' +
          'the output buffer may be too small.',
      );
    }

    return copyFromWasm(outputPtr, actualSize);
  } finally {
    wasmExports.dealloc(inputPtr, input.length);
    wasmExports.dealloc(outputPtr, maxOutput);
  }
}

/**
 * Check whether the libdeflate WASM module is initialized and available.
 *
 * @returns `true` if WASM is ready for use.
 */
export function isAvailable(): boolean {
  return available;
}

/**
 * Release the WASM module and free associated resources.
 *
 * After calling this, the module must be re-initialized with
 * {@link initDeflateWasm} before further use.
 */
export function dispose(): void {
  wasmExports = null;
  available = false;
  initAttempted = false;
}

// ---------------------------------------------------------------------------
// CompressionEngine implementation
// ---------------------------------------------------------------------------

/**
 * A {@link CompressionEngine} backed by libdeflate compiled to WASM.
 *
 * This provides the fastest compression available in the library,
 * with support for levels 1-12 (libdeflate's native range).
 *
 * The WASM module must be initialized before constructing this class.
 * Use {@link initDeflateWasm} to load the module.
 *
 * @example
 * ```ts
 * await initDeflateWasm(wasmBytes);
 * const engine = new LibdeflateWasm();
 * const compressed = await engine.compress(data, 6);
 * ```
 */
export class LibdeflateWasm implements CompressionEngine {
  readonly name = 'libdeflate-wasm';
  readonly minLevel = 1;
  readonly maxLevel = 12;

  /**
   * Compress data using libdeflate WASM.
   *
   * @param data  - Uncompressed input bytes.
   * @param level - Compression level 1-12 (clamped). Default: `6`.
   * @returns       Compressed bytes (raw deflate).
   */
  async compress(data: Uint8Array, level: number = 6): Promise<Uint8Array> {
    // The underlying implementation is synchronous, but we wrap it in
    // a Promise to conform to the CompressionEngine interface.
    return deflateSync(data, level);
  }

  /**
   * Decompress raw deflate data using libdeflate WASM.
   *
   * @param data       - Compressed bytes (raw deflate).
   * @param outputSize - Expected output size hint. Default: `data.length * 4`.
   * @returns            Decompressed bytes.
   */
  async decompress(data: Uint8Array, outputSize?: number): Promise<Uint8Array> {
    return inflateSync(data, outputSize);
  }

  /**
   * Release the WASM module resources.
   */
  dispose(): void {
    dispose();
  }
}

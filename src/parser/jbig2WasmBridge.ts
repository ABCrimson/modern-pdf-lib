/**
 * @module parser/jbig2WasmBridge
 *
 * WASM-backed JBIG2 decoder using a Rust-compiled module.
 *
 * This provides optional high-performance JBIG2 decoding via a WASM
 * module compiled from Rust.  When WASM is not available or fails to
 * load, the caller falls back to the pure-JS decoder in
 * {@link jbig2Decode}.
 *
 * The WASM module uses `wasm-bindgen` and returns structured results
 * (width, height, bitmap data) rather than raw memory pointers.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// WASM module interface
// ---------------------------------------------------------------------------

/**
 * Shape of the exports from the compiled Rust WASM module
 * (`modern-pdf-jbig2`).
 *
 * These are the `wasm-bindgen`-generated exports.  The module exposes
 * high-level functions that accept `Uint8Array` and return structured
 * results, so we don't need manual alloc/dealloc.
 */
interface Jbig2WasmExports {
  /**
   * Decode JBIG2 data without global segments.
   *
   * @param data - JBIG2-encoded stream bytes.
   * @returns A `Jbig2DecodeResult` object with width, height, and bitmap_data.
   */
  decode_jbig2(data: Uint8Array): Jbig2DecodeResultWasm;

  /**
   * Decode JBIG2 data with global segments.
   *
   * @param data    - JBIG2-encoded stream bytes.
   * @param globals - Global segment data from `/JBIG2Globals`.
   * @returns A `Jbig2DecodeResult` object.
   */
  decode_jbig2_with_globals(data: Uint8Array, globals: Uint8Array): Jbig2DecodeResultWasm;

  /** WASM linear memory (available but not directly used). */
  memory: WebAssembly.Memory;
}

/**
 * The wasm-bindgen result struct returned by the WASM module.
 */
interface Jbig2DecodeResultWasm {
  readonly width: number;
  readonly height: number;
  readonly bitmap_data: Uint8Array;
  free(): void;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** The instantiated WASM module exports, or `null` if not yet loaded. */
let wasmExports: Jbig2WasmExports | null = null;

/** Whether initialization has been attempted. */
let initAttempted = false;

/** Whether the WASM module is ready for use. */
let available = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the JBIG2 WASM module.
 *
 * This must be called before using {@link decodeJBIG2Wasm}.  It is safe
 * to call multiple times -- subsequent calls are no-ops.
 *
 * @param wasmBytes - Optional pre-loaded WASM binary.  When omitted,
 *                    the module is loaded via the universal WASM loader.
 * @throws If the WASM module cannot be loaded or instantiated.
 *
 * @example
 * ```ts
 * // Auto-load from default location
 * await initJBIG2Wasm();
 *
 * // Or provide bytes directly (e.g. bundled)
 * await initJBIG2Wasm(myWasmBytes);
 * ```
 */
export async function initJBIG2Wasm(wasmBytes?: Uint8Array): Promise<void> {
  if (available) return;
  if (initAttempted) return;
  initAttempted = true;

  try {
    let bytes: Uint8Array;

    if (wasmBytes) {
      bytes = wasmBytes;
    } else {
      const { loadWasmModule } = await import('../wasm/loader.js');
      bytes = await loadWasmModule('jbig2');
    }

    const compiled = await WebAssembly.compile(new Uint8Array(bytes));
    const instance = await WebAssembly.instantiate(compiled, {});

    wasmExports = instance.exports as unknown as Jbig2WasmExports;
    available = true;
  } catch (err) {
    wasmExports = null;
    available = false;
    throw new Error(
      `Failed to initialize JBIG2 WASM: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Decode functions
// ---------------------------------------------------------------------------

/**
 * Decode JBIG2 data using the WASM module.
 *
 * The WASM module must already be initialized via {@link initJBIG2Wasm}.
 *
 * @param data    - JBIG2-encoded stream bytes.
 * @param globals - Optional global segment data from `/JBIG2Globals`.
 * @returns The decoded bilevel bitmap data.
 * @throws If WASM is not initialized or decoding fails.
 */
export function decodeJBIG2Wasm(
  data: Uint8Array,
  globals?: Uint8Array | null,
): { width: number; height: number; bitmapData: Uint8Array } {
  if (!wasmExports) {
    throw new Error('JBIG2 WASM not initialized. Call initJBIG2Wasm() first.');
  }

  let result: Jbig2DecodeResultWasm;

  try {
    if (globals && globals.length > 0) {
      result = wasmExports.decode_jbig2_with_globals(data, globals);
    } else {
      result = wasmExports.decode_jbig2(data);
    }

    const output = {
      width: result.width,
      height: result.height,
      bitmapData: new Uint8Array(result.bitmap_data),
    };

    // Free the WASM-side struct
    result.free();

    return output;
  } catch (err) {
    throw new Error(
      `JBIG2 WASM decode failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Availability & lifecycle
// ---------------------------------------------------------------------------

/**
 * Check whether the JBIG2 WASM module is initialized and available.
 *
 * @returns `true` if WASM is ready for use.
 */
export function isJBIG2WasmAvailable(): boolean {
  return available;
}

/**
 * Release the WASM module and free associated resources.
 *
 * After calling this, the module must be re-initialized with
 * {@link initJBIG2Wasm} before further use.
 */
export function disposeJBIG2Wasm(): void {
  wasmExports = null;
  available = false;
  initAttempted = false;
}

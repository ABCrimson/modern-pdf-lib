/**
 * @module parser/jpeg2000WasmBridge
 *
 * WASM-backed JPEG2000 decoder using a Rust-compiled module.
 *
 * This provides optional high-performance JPEG2000 decoding via a WASM
 * module compiled from Rust.  When WASM is not available or fails to
 * load, the caller falls back to the pure-JS decoder in
 * {@link jpeg2000Decode}.
 *
 * The WASM module uses `wasm-bindgen` and returns structured results
 * (width, height, pixel data, component count) rather than raw memory
 * pointers.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// WASM module interface
// ---------------------------------------------------------------------------

/**
 * Shape of the exports from the compiled Rust WASM module
 * (`modern-pdf-jpeg2000`).
 *
 * These are the `wasm-bindgen`-generated exports.  The module exposes
 * high-level functions that accept `Uint8Array` and return structured
 * results, so we don't need manual alloc/dealloc.
 */
export interface Jpeg2000WasmExports {
  /**
   * Decode JPEG2000 data (JP2 container or raw codestream).
   *
   * @param data - JPEG2000-encoded bytes.
   * @returns A `Jpeg2000DecodeResultWasm` object with width, height,
   *          pixel data, and component count.
   */
  decode_jpeg2000(data: Uint8Array): Jpeg2000DecodeResultWasm;

  /** WASM linear memory (available but not directly used). */
  memory: WebAssembly.Memory;
}

/**
 * The wasm-bindgen result struct returned by the WASM module.
 */
interface Jpeg2000DecodeResultWasm {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly components: number;
  free(): void;
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

/**
 * Result of decoding a JPEG2000 image.
 */
export interface Jpeg2000DecodeResult {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Raw pixel data (row-major, channel-interleaved). */
  readonly data: Uint8Array;
  /** Number of components (1=gray, 3=RGB, 4=RGBA/CMYK). */
  readonly components: number;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** The instantiated WASM module exports, or `null` if not yet loaded. */
let wasmExports: Jpeg2000WasmExports | null = null;

/** Whether initialization has been attempted. */
let initAttempted = false;

/** Whether the WASM module is ready for use. */
let available = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the JPEG2000 WASM module.
 *
 * This must be called before using {@link decodeJpeg2000Wasm}.  It is safe
 * to call multiple times -- subsequent calls are no-ops.
 *
 * @param wasmBytes - Optional pre-loaded WASM binary.  When omitted,
 *                    the module is loaded via the universal WASM loader.
 * @throws If the WASM module cannot be loaded or instantiated.
 *
 * @example
 * ```ts
 * // Auto-load from default location
 * await initJpeg2000Wasm();
 *
 * // Or provide bytes directly (e.g. bundled)
 * await initJpeg2000Wasm(myWasmBytes);
 * ```
 */
export async function initJpeg2000Wasm(wasmBytes?: Uint8Array): Promise<void> {
  if (available) return;
  if (initAttempted) return;
  initAttempted = true;

  try {
    let bytes: Uint8Array;

    if (wasmBytes) {
      bytes = wasmBytes;
    } else {
      const { loadWasmModule } = await import('../wasm/loader.js');
      bytes = await loadWasmModule('jpeg2000');
    }

    const compiled = await WebAssembly.compile(new Uint8Array(bytes));
    const instance = await WebAssembly.instantiate(compiled, {});

    wasmExports = instance.exports as unknown as Jpeg2000WasmExports;
    available = true;
  } catch (err) {
    wasmExports = null;
    available = false;
    throw new Error(
      `Failed to initialize JPEG2000 WASM: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Decode functions
// ---------------------------------------------------------------------------

/**
 * Decode JPEG2000 data using the WASM module.
 *
 * The WASM module must already be initialized via {@link initJpeg2000Wasm}.
 *
 * @param data - JPEG2000-encoded bytes (JP2 container or raw J2K codestream).
 * @returns The decoded pixel data with metadata.
 * @throws If WASM is not initialized or decoding fails.
 */
export function decodeJpeg2000Wasm(data: Uint8Array): Jpeg2000DecodeResult {
  if (!wasmExports) {
    throw new Error('JPEG2000 WASM not initialized. Call initJpeg2000Wasm() first.');
  }

  try {
    const result = wasmExports.decode_jpeg2000(data);

    const output: Jpeg2000DecodeResult = {
      width: result.width,
      height: result.height,
      data: new Uint8Array(result.data),
      components: result.components,
    };

    // Free the WASM-side struct
    result.free();

    return output;
  } catch (err) {
    throw new Error(
      `JPEG2000 WASM decode failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Decode JPEG2000 data with automatic WASM-to-JS fallback.
 *
 * If the WASM module is initialized, it is used for decoding.  Otherwise,
 * the pure-JS decoder from `jpeg2000Decode.ts` is used as a fallback.
 *
 * @param data - JPEG2000-encoded bytes (JP2 container or raw J2K codestream).
 * @returns The decoded pixel data with metadata.
 * @throws If both WASM and JS decoding fail.
 */
export async function decodeJpeg2000WithFallback(
  data: Uint8Array,
): Promise<Jpeg2000DecodeResult> {
  // Try WASM first
  if (available && wasmExports) {
    try {
      return decodeJpeg2000Wasm(data);
    } catch {
      // WASM failed — fall through to JS
    }
  }

  // Fall back to the pure-JS decoder
  const { decodeJpeg2000 } = await import('./jpeg2000Decode.js');
  return decodeJpeg2000(data);
}

// ---------------------------------------------------------------------------
// Availability & lifecycle
// ---------------------------------------------------------------------------

/**
 * Check whether the JPEG2000 WASM module is initialized and available.
 *
 * @returns `true` if WASM is ready for use.
 */
export function isJpeg2000WasmReady(): boolean {
  return available;
}

/**
 * Release the WASM module and free associated resources.
 *
 * After calling this, the module must be re-initialized with
 * {@link initJpeg2000Wasm} before further use.
 */
export function disposeJpeg2000Wasm(): void {
  wasmExports = null;
  available = false;
  initAttempted = false;
}

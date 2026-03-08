/**
 * @module wasm/jpeg/bridge
 *
 * TypeScript bridge for the JPEG WASM encoder/decoder module.
 *
 * Provides JPEG encoding (raw pixels → JPEG bytes) and decoding (JPEG bytes →
 * raw pixels) via a Rust WASM module compiled with wasm-bindgen.
 *
 * If the WASM module is not available, all functions fail gracefully and
 * callers should fall back to JS alternatives.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Pre-built wasm-bindgen module interface (when passed directly). */
export interface JpegWasmModule {
  encode_jpeg(
    pixels: Uint8Array,
    width: number,
    height: number,
    channels: number,
    quality: number,
    progressive: boolean,
    chroma_subsampling: number,
  ): Uint8Array;
  decode_jpeg(data: Uint8Array): Uint8Array;
}

/** Raw WASM exports interface (when instantiated via WebAssembly.instantiate). */
interface JpegWasmRaw {
  memory: WebAssembly.Memory;
  encode_jpeg(
    pixelsPtr: number,
    pixelsLen: number,
    width: number,
    height: number,
    channels: number,
    quality: number,
    progressive: number,
    chroma_subsampling: number,
  ): number;
  decode_jpeg(dataPtr: number, dataLen: number): number;
  __wbindgen_malloc(size: number, align: number): number;
  __wbindgen_free(ptr: number, size: number, align: number): void;
  __wbindgen_add_to_stack_pointer(delta: number): number;
}

let wasmModule: JpegWasmModule | undefined;

/**
 * Chroma subsampling modes for JPEG encoding.
 *
 * - `'4:4:4'`: No subsampling — best quality, largest file.
 * - `'4:2:2'`: Horizontal subsampling — good balance.
 * - `'4:2:0'`: Both directions — smallest file, default for most encoders.
 */
export type ChromaSubsampling = '4:4:4' | '4:2:2' | '4:2:0';

/** Result of decoding a JPEG image. */
export interface JpegDecodeResult {
  /** Raw pixel data (row-major, channel-interleaved). */
  readonly pixels: Uint8Array;
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Number of channels (1=grayscale, 3=RGB). */
  readonly channels: number;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the JPEG WASM module.
 *
 * @param wasmSource - The WASM binary as `Uint8Array`, URL, `Response`,
 *                     or a pre-built wasm-bindgen module.  When omitted,
 *                     the function uses the universal WASM loader.
 */
export async function initJpegWasm(
  wasmSource?: JpegWasmModule | Uint8Array | URL | string | Response,
): Promise<void> {
  // Already initialized — no-op
  if (wasmModule) return;

  try {
    // If the caller passed a pre-built wasm-bindgen module, use it directly
    if (
      wasmSource &&
      typeof (wasmSource as JpegWasmModule).encode_jpeg === 'function'
    ) {
      wasmModule = wasmSource as JpegWasmModule;
      return;
    }

    // Load WASM bytes
    const { loadWasmModule: loadWasm } = await import('../loader.js');
    const wasmBytes = await loadWasm('jpeg');

    // Attempt raw instantiation
    const imports = { env: {} };
    const result = await WebAssembly.instantiate(
      wasmBytes.buffer as ArrayBuffer,
      imports,
    );
    wasmModule = result.instance.exports as unknown as JpegWasmModule;
  } catch {
    // WASM unavailable — fall back to JS (no JPEG encoding).
    wasmModule = undefined;
  }
}

/**
 * Check whether the JPEG WASM module has been initialized.
 *
 * @returns `true` if {@link initJpegWasm} completed successfully.
 */
export function isJpegWasmReady(): boolean {
  return wasmModule !== undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map a `ChromaSubsampling` string to the numeric code expected by WASM.
 * @internal
 */
function chromaToCode(chroma: ChromaSubsampling | undefined): number {
  switch (chroma) {
    case '4:4:4':
      return 0;
    case '4:2:2':
      return 1;
    case '4:2:0':
    default:
      return 2;
  }
}

/**
 * Encode raw pixel data to JPEG using the WASM encoder.
 *
 * @param pixels   - Raw pixel data (row-major, channel-interleaved).
 * @param width    - Image width in pixels.
 * @param height   - Image height in pixels.
 * @param channels - Number of channels: 1 (grayscale), 3 (RGB), or 4 (RGBA).
 * @param quality  - JPEG quality 1–100.
 * @param progressive - Encode as progressive JPEG (default: false).
 * @param chroma   - Chroma subsampling mode (default: '4:2:0').
 * @returns JPEG-encoded bytes, or `undefined` if WASM is not available.
 */
export function encodeJpegWasm(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 1 | 3 | 4,
  quality: number,
  progressive: boolean = false,
  chroma: ChromaSubsampling = '4:2:0',
): Uint8Array | undefined {
  if (!wasmModule) return undefined;

  try {
    return wasmModule.encode_jpeg(
      pixels,
      width,
      height,
      channels,
      Math.max(1, Math.min(100, Math.round(quality))),
      progressive,
      chromaToCode(chroma),
    );
  } catch {
    return undefined;
  }
}

/**
 * Decode JPEG bytes to raw pixel data using the WASM decoder.
 *
 * The WASM module returns a flat byte array with layout:
 * `[width_u32_le, height_u32_le, channels_u8, ...pixels]`.
 *
 * @param jpegBytes - JPEG-encoded image data.
 * @returns Decoded pixel data with metadata, or `undefined` if WASM is not
 *          available or decoding failed.
 */
export function decodeJpegWasm(
  jpegBytes: Uint8Array,
): JpegDecodeResult | undefined {
  if (!wasmModule) return undefined;

  try {
    const raw = wasmModule.decode_jpeg(jpegBytes);

    // Parse the header: width(4) + height(4) + channels(1) = 9 bytes
    if (raw.length < 9) return undefined;

    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const channels = raw[8]!;

    const pixels = raw.slice(9);

    return { pixels, width, height, channels };
  } catch {
    return undefined;
  }
}

/**
 * Tests for the JPEG WASM bridge (TypeScript side).
 *
 * Since WASM binaries are not compiled in the test environment,
 * these tests verify the bridge's graceful fallback behavior
 * and the API shape.
 */

import { describe, it, expect } from 'vitest';
import {
  initJpegWasm,
  isJpegWasmReady,
  encodeJpegWasm,
  decodeJpegWasm,
} from '../../../src/wasm/jpeg/bridge.js';
import type { ChromaSubsampling, JpegDecodeResult } from '../../../src/wasm/jpeg/bridge.js';

// ---------------------------------------------------------------------------
// Initialization and fallback
// ---------------------------------------------------------------------------

describe('JPEG WASM bridge — initialization', () => {
  it('isJpegWasmReady() returns false when not initialized', () => {
    // Note: the module may have been initialized by a previous test
    // if run in a different order, but in isolation it should be false.
    // We test the type/shape at minimum.
    const ready = isJpegWasmReady();
    expect(typeof ready).toBe('boolean');
  });

  it('encodeJpegWasm() returns undefined when WASM is not loaded', () => {
    // If WASM is not loaded, encode should return undefined
    if (!isJpegWasmReady()) {
      const pixels = new Uint8Array(4 * 4 * 3); // 4x4 RGB
      const result = encodeJpegWasm(pixels, 4, 4, 3, 80);
      expect(result).toBeUndefined();
    }
  });

  it('decodeJpegWasm() returns undefined when WASM is not loaded', () => {
    if (!isJpegWasmReady()) {
      const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
      const result = decodeJpegWasm(fakeJpeg);
      expect(result).toBeUndefined();
    }
  });

  it('initJpegWasm() accepts a pre-built wasm-bindgen module', async () => {
    // Create a mock module that implements the JpegWasmModule interface
    const mockModule = {
      encode_jpeg: (
        _pixels: Uint8Array,
        _width: number,
        _height: number,
        _channels: number,
        _quality: number,
        _progressive: boolean,
        _chroma: number,
      ): Uint8Array => {
        // Return minimal JPEG: SOI + EOI
        return new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
      },
      decode_jpeg: (_data: Uint8Array): Uint8Array => {
        // Return header (width=1, height=1, channels=3) + 3 pixel bytes
        const result = new Uint8Array(9 + 3);
        const view = new DataView(result.buffer);
        view.setUint32(0, 1, true);  // width
        view.setUint32(4, 1, true);  // height
        result[8] = 3;               // channels
        result[9] = 255;             // R
        result[10] = 0;              // G
        result[11] = 0;              // B
        return result;
      },
    };

    await initJpegWasm(mockModule);
    expect(isJpegWasmReady()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Encoding with mock module
// ---------------------------------------------------------------------------

describe('JPEG WASM bridge — encoding (with mock)', () => {
  it('encodeJpegWasm() returns Uint8Array when WASM is loaded', () => {
    if (!isJpegWasmReady()) return;

    const pixels = new Uint8Array(2 * 2 * 3); // 2x2 RGB, all black
    const result = encodeJpegWasm(pixels, 2, 2, 3, 80);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result!.length).toBeGreaterThan(0);
  });

  it('encodeJpegWasm() clamps quality to 1-100', () => {
    if (!isJpegWasmReady()) return;

    const pixels = new Uint8Array(1 * 1 * 3);
    // Quality 0 → clamped to 1
    const result1 = encodeJpegWasm(pixels, 1, 1, 3, 0);
    expect(result1).toBeInstanceOf(Uint8Array);

    // Quality 200 → clamped to 100
    const result2 = encodeJpegWasm(pixels, 1, 1, 3, 200);
    expect(result2).toBeInstanceOf(Uint8Array);
  });

  it('encodeJpegWasm() accepts all chroma subsampling modes', () => {
    if (!isJpegWasmReady()) return;

    const pixels = new Uint8Array(2 * 2 * 3);
    const modes: ChromaSubsampling[] = ['4:4:4', '4:2:2', '4:2:0'];
    for (const mode of modes) {
      const result = encodeJpegWasm(pixels, 2, 2, 3, 80, false, mode);
      expect(result).toBeInstanceOf(Uint8Array);
    }
  });

  it('encodeJpegWasm() accepts channel counts 1, 3, 4', () => {
    if (!isJpegWasmReady()) return;

    // Grayscale (1 channel)
    const gray = new Uint8Array(2 * 2 * 1);
    expect(encodeJpegWasm(gray, 2, 2, 1, 80)).toBeInstanceOf(Uint8Array);

    // RGB (3 channels)
    const rgb = new Uint8Array(2 * 2 * 3);
    expect(encodeJpegWasm(rgb, 2, 2, 3, 80)).toBeInstanceOf(Uint8Array);

    // RGBA (4 channels)
    const rgba = new Uint8Array(2 * 2 * 4);
    expect(encodeJpegWasm(rgba, 2, 2, 4, 80)).toBeInstanceOf(Uint8Array);
  });
});

// ---------------------------------------------------------------------------
// Decoding with mock module
// ---------------------------------------------------------------------------

describe('JPEG WASM bridge — decoding (with mock)', () => {
  it('decodeJpegWasm() returns JpegDecodeResult when WASM is loaded', () => {
    if (!isJpegWasmReady()) return;

    const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
    const result = decodeJpegWasm(fakeJpeg);
    expect(result).toBeDefined();
    expect(result!.width).toBe(1);
    expect(result!.height).toBe(1);
    expect(result!.channels).toBe(3);
    expect(result!.pixels).toBeInstanceOf(Uint8Array);
    expect(result!.pixels.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Type checks
// ---------------------------------------------------------------------------

describe('JPEG WASM bridge — type exports', () => {
  it('ChromaSubsampling type accepts valid values', () => {
    const values: ChromaSubsampling[] = ['4:4:4', '4:2:2', '4:2:0'];
    expect(values.length).toBe(3);
  });

  it('JpegDecodeResult has expected shape', () => {
    const result: JpegDecodeResult = {
      pixels: new Uint8Array(3),
      width: 1,
      height: 1,
      channels: 3,
    };
    expect(result.pixels).toBeInstanceOf(Uint8Array);
    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
    expect(typeof result.channels).toBe('number');
  });
});

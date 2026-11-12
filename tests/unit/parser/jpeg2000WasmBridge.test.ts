/**
 * Tests for the JPEG2000 WASM bridge — initialization, availability checks,
 * graceful fallback behavior.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  initJpeg2000Wasm,
  isJpeg2000WasmReady,
  disposeJpeg2000Wasm,
  decodeJpeg2000Wasm,
  decodeJpeg2000WithFallback,
} from '../../../src/parser/jpeg2000WasmBridge.js';
import { UnsupportedFilterError } from '../../../src/errors.js';

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  disposeJpeg2000Wasm();
});

// ---------------------------------------------------------------------------
// Availability checks
// ---------------------------------------------------------------------------

describe('JPEG2000 WASM bridge — availability', () => {
  it('isJpeg2000WasmReady() returns false before initialization', () => {
    expect(isJpeg2000WasmReady()).toBe(false);
  });

  it('isJpeg2000WasmReady() returns false after dispose', async () => {
    // Try to init (may fail without WASM binary, that is OK)
    try {
      await initJpeg2000Wasm();
    } catch {
      // Expected — WASM binary not available in test environment
    }

    disposeJpeg2000Wasm();
    expect(isJpeg2000WasmReady()).toBe(false);
  });

  it('initJpeg2000Wasm() throws when WASM binary is not available', async () => {
    // Without providing bytes or having the binary on disk, init should fail
    await expect(initJpeg2000Wasm()).rejects.toThrow();
    expect(isJpeg2000WasmReady()).toBe(false);
  });

  it('initJpeg2000Wasm() throws for invalid WASM bytes', async () => {
    const invalidBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    await expect(initJpeg2000Wasm(invalidBytes)).rejects.toThrow();
    expect(isJpeg2000WasmReady()).toBe(false);
  });

  it('initJpeg2000Wasm() is idempotent after first attempt', async () => {
    // First attempt fails
    try {
      await initJpeg2000Wasm();
    } catch {
      // Expected
    }

    // Second attempt should be a no-op (does not throw again)
    await initJpeg2000Wasm();
    expect(isJpeg2000WasmReady()).toBe(false);
  });

  it('dispose allows re-initialization', async () => {
    // First attempt
    try {
      await initJpeg2000Wasm();
    } catch {
      // Expected
    }

    // Dispose resets the state
    disposeJpeg2000Wasm();

    // New attempt should try again (and fail again)
    try {
      await initJpeg2000Wasm();
    } catch {
      // Expected
    }
    expect(isJpeg2000WasmReady()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Decode without initialization
// ---------------------------------------------------------------------------

describe('JPEG2000 WASM bridge — decode without init', () => {
  it('decodeJpeg2000Wasm throws when WASM is not initialized', () => {
    const data = new Uint8Array([0xff, 0x4f, 0xff, 0x51]);
    expect(() => decodeJpeg2000Wasm(data)).toThrow('JPEG2000 WASM not initialized');
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('JPEG2000 WASM bridge — module exports', () => {
  it('exports initJpeg2000Wasm function', () => {
    expect(typeof initJpeg2000Wasm).toBe('function');
  });

  it('exports isJpeg2000WasmReady function', () => {
    expect(typeof isJpeg2000WasmReady).toBe('function');
  });

  it('exports disposeJpeg2000Wasm function', () => {
    expect(typeof disposeJpeg2000Wasm).toBe('function');
  });

  it('exports decodeJpeg2000Wasm function', () => {
    expect(typeof decodeJpeg2000Wasm).toBe('function');
  });
});

describe('JPEG2000 WASM bridge — fallback', () => {
  it('decodeJpeg2000WithFallback rejects with UnsupportedFilterError without an initialised module', async () => {
    await expect(
      decodeJpeg2000WithFallback(new Uint8Array([0xff, 0x4f, 0xff, 0xd9])),
    ).rejects.toMatchObject({
      name: 'UnsupportedFilterError',
      code: 'unsupported-filter',
      filter: 'JPXDecode',
    });
    await expect(decodeJpeg2000WithFallback(new Uint8Array([]))).rejects.toBeInstanceOf(
      UnsupportedFilterError,
    );
  });
});

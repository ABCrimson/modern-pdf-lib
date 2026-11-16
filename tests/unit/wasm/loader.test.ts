/**
 * @module tests/unit/wasm/loader
 *
 * The WASM loader rejects a module name it does not know before it looks for a file, and every way
 * it fails to bring a module in is a typed error: a refused name is an InvalidArgumentError, a
 * module the runtime cannot provide an EnvironmentError.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureWasmLoader,
  instantiateWasmModuleStreaming,
  loadWasmModule,
  loadWasmModuleStreaming,
} from '../../../src/wasm/loader.js';
import { EnvironmentError, InvalidArgumentError } from '../../../src/errors.js';

/** The reason `promise` rejects with; fails the test when it resolves. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.unreachable('the promise did not reject'),
    (reason: unknown) => reason,
  );
}

afterEach(() => {
  configureWasmLoader({});
  vi.unstubAllGlobals();
});

describe('loadWasmModule', () => {
  it('rejects a module name it does not know', async () => {
    await expect(loadWasmModule('no-such-crate')).rejects.toThrow(
      'Unknown WASM module: "no-such-crate"',
    );
  });

  it('rejects a module name it does not know with an InvalidArgumentError naming the name', async () => {
    const error = await rejectionOf(loadWasmModule('no-such-crate'));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'name' });
    expect((error as Error).message).toBe(
      'Unknown WASM module: "no-such-crate". Known modules: libdeflate, png, ttf, shaping, jbig2, jpeg',
    );
  });

  it('rejects every load with an EnvironmentError (wasm) when WASM is disabled', async () => {
    configureWasmLoader({ disableWasm: true });
    for (const load of [
      () => loadWasmModule('libdeflate'),
      () => loadWasmModuleStreaming('libdeflate'),
      () => instantiateWasmModuleStreaming('libdeflate'),
    ]) {
      const error = await rejectionOf(load());
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toBe(
        'WASM loading is disabled via configureWasmLoader({ disableWasm: true }). Using pure-JS fallbacks.',
      );
    }
  });

  it('rejects with an EnvironmentError (network) when the fetch of a module answers an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })),
    );
    configureWasmLoader({ modulePaths: { libdeflate: 'https://example.invalid/deflate.wasm' } });

    const error = await rejectionOf(loadWasmModule('libdeflate'));
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'network' });
    expect((error as Error).message).toBe(
      'Failed to fetch WASM module: 404 Not Found (https://example.invalid/deflate.wasm)',
    );
  });

  it('rejects with an EnvironmentError (wasm) caused by the read error when the file is missing', async () => {
    configureWasmLoader({ modulePaths: { libdeflate: 'no-such-dir/no-such-file.wasm' } });

    const error = await rejectionOf(loadWasmModule('libdeflate'));
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
    expect((error as Error).message).toContain(
      'Failed to load WASM module from filesystem: no-such-dir/no-such-file.wasm -- ',
    );
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  describe('in a Workers runtime', () => {
    /**
     * Calls `load` while the globals that `detectRuntime()` reads describe Cloudflare Workers. The
     * loader reads them before its first await, so the globals are put back before this returns.
     */
    function inWorkers<T>(load: () => Promise<T>): Promise<T> {
      const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
      vi.stubGlobal('caches', {});
      vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
      Reflect.deleteProperty(globalThis, 'process');
      try {
        return load();
      } finally {
        if (processDescriptor !== undefined) {
          Object.defineProperty(globalThis, 'process', processDescriptor);
        }
        vi.unstubAllGlobals();
      }
    }

    it('rejects a module with no configured bytes or path with an EnvironmentError (wasm)', async () => {
      const error = await rejectionOf(inWorkers(() => loadWasmModule('libdeflate')));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toContain(
        'Cannot auto-resolve WASM path in Workers/Edge runtime.',
      );
    });

    it('rejects a module that only has a path with an EnvironmentError (wasm)', async () => {
      configureWasmLoader({ modulePaths: { libdeflate: '/assets/deflate.wasm' } });

      const error = await rejectionOf(inWorkers(() => loadWasmModule('libdeflate')));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toBe(
        'WASM module "libdeflate" cannot be auto-loaded in Workers/Edge. ' +
          'Provide bytes via configureWasmLoader().',
      );
    });
  });
});

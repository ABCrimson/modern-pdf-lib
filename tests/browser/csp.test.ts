import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureWasmLoader,
  getWasmLoaderConfig,
  isWasmDisabled,
  loadWasmModule,
  resetWasmLoader,
} from '../../src/wasm/loader.js';

describe('CSP compatibility — WASM disable flag', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  it('isWasmDisabled returns false by default', () => {
    expect(isWasmDisabled()).toBe(false);
  });

  it('isWasmDisabled returns true after configureWasmLoader({ disableWasm: true })', () => {
    configureWasmLoader({ disableWasm: true });
    expect(isWasmDisabled()).toBe(true);
  });

  it('isWasmDisabled returns false when disableWasm is explicitly false', () => {
    configureWasmLoader({ disableWasm: false });
    expect(isWasmDisabled()).toBe(false);
  });

  it('loadWasmModule throws when WASM is disabled', async () => {
    configureWasmLoader({ disableWasm: true });
    await expect(loadWasmModule('libdeflate')).rejects.toThrow(
      'WASM loading is disabled via configureWasmLoader({ disableWasm: true })',
    );
  });

  it('loadWasmModule throws for any module name when disabled', async () => {
    configureWasmLoader({ disableWasm: true });
    await expect(loadWasmModule('png')).rejects.toThrow('WASM loading is disabled');
    await expect(loadWasmModule('ttf')).rejects.toThrow('WASM loading is disabled');
    await expect(loadWasmModule('shaping')).rejects.toThrow('WASM loading is disabled');
  });

  it('disableWasm option is stored in the config', () => {
    configureWasmLoader({ disableWasm: true });
    const config = getWasmLoaderConfig();
    expect(config.disableWasm).toBe(true);
  });

  it('resetWasmLoader clears the disableWasm flag', () => {
    configureWasmLoader({ disableWasm: true });
    expect(isWasmDisabled()).toBe(true);
    resetWasmLoader();
    expect(isWasmDisabled()).toBe(false);
  });

  it('disableWasm can be combined with other config options', () => {
    configureWasmLoader({
      basePath: '/assets/wasm/',
      disableWasm: true,
    });
    const config = getWasmLoaderConfig();
    expect(config.basePath).toBe('/assets/wasm/');
    expect(config.disableWasm).toBe(true);
    expect(isWasmDisabled()).toBe(true);
  });

  it('re-configuring without disableWasm re-enables WASM', () => {
    configureWasmLoader({ disableWasm: true });
    expect(isWasmDisabled()).toBe(true);
    configureWasmLoader({ basePath: '/wasm/' });
    expect(isWasmDisabled()).toBe(false);
  });
});

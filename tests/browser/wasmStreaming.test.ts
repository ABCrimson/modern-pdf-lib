import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadWasmModuleStreaming,
  instantiateWasmModuleStreaming,
  configureWasmLoader,
  provideWasmBytes,
  resetWasmLoader,
} from '../../src/wasm/loader.js';

// ---------------------------------------------------------------------------
// Minimal valid WASM binary (empty module)
// ---------------------------------------------------------------------------

// This is the smallest valid WASM module: magic bytes + version + no sections.
const MINIMAL_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic: \0asm
  0x01, 0x00, 0x00, 0x00, // version: 1
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fake WebAssembly.Module object for mocking purposes.
 * In Node.js test environment we can compile the minimal WASM to get a real one.
 */
async function createRealModule(): Promise<WebAssembly.Module> {
  return WebAssembly.compile(MINIMAL_WASM);
}

async function createRealInstance(): Promise<WebAssembly.Instance> {
  const mod = await createRealModule();
  return new WebAssembly.Instance(mod, {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadWasmModuleStreaming', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
    vi.restoreAllMocks();
  });

  it('returns a WebAssembly.Module when pre-provided bytes are available', async () => {
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const mod = await loadWasmModuleStreaming('libdeflate');
    expect(mod).toBeInstanceOf(WebAssembly.Module);
  });

  it('compiles from pre-provided bytes via WebAssembly.compile', async () => {
    const compileSpy = vi.spyOn(WebAssembly, 'compile');
    configureWasmLoader({
      moduleBytes: { png: MINIMAL_WASM },
    });

    const mod = await loadWasmModuleStreaming('png');
    expect(mod).toBeInstanceOf(WebAssembly.Module);
    expect(compileSpy).toHaveBeenCalledWith(MINIMAL_WASM);
  });

  it('compiles from cached bytes when module was previously provided', async () => {
    provideWasmBytes('ttf', MINIMAL_WASM);

    const compileSpy = vi.spyOn(WebAssembly, 'compile');
    const mod = await loadWasmModuleStreaming('ttf');
    expect(mod).toBeInstanceOf(WebAssembly.Module);
    expect(compileSpy).toHaveBeenCalledWith(MINIMAL_WASM);
  });

  it('falls back to compile when compileStreaming is not available (Node.js)', async () => {
    // In Node.js, detectRuntime() returns 'node', so compileStreaming is not used.
    // We provide bytes to avoid filesystem access.
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const compileSpy = vi.spyOn(WebAssembly, 'compile');

    const mod = await loadWasmModuleStreaming('libdeflate');
    expect(mod).toBeInstanceOf(WebAssembly.Module);
    expect(compileSpy).toHaveBeenCalled();
  });

  it('returns distinct Module instances for different modules', async () => {
    configureWasmLoader({
      moduleBytes: {
        libdeflate: MINIMAL_WASM,
        png: MINIMAL_WASM,
      },
    });

    const mod1 = await loadWasmModuleStreaming('libdeflate');
    const mod2 = await loadWasmModuleStreaming('png');

    expect(mod1).toBeInstanceOf(WebAssembly.Module);
    expect(mod2).toBeInstanceOf(WebAssembly.Module);
    // They should be separate compiled modules
    expect(mod1).not.toBe(mod2);
  });
});

describe('instantiateWasmModuleStreaming', () => {
  beforeEach(() => {
    resetWasmLoader();
  });

  afterEach(() => {
    resetWasmLoader();
    vi.restoreAllMocks();
  });

  it('returns a WebAssembly.Instance when pre-provided bytes are available', async () => {
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const instance = await instantiateWasmModuleStreaming('libdeflate');
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
  });

  it('instantiates from pre-provided bytes via WebAssembly.instantiate', async () => {
    const instantiateSpy = vi.spyOn(WebAssembly, 'instantiate');
    configureWasmLoader({
      moduleBytes: { png: MINIMAL_WASM },
    });

    const instance = await instantiateWasmModuleStreaming('png');
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
    expect(instantiateSpy).toHaveBeenCalled();
  });

  it('instantiates from cached bytes when module was previously provided', async () => {
    provideWasmBytes('ttf', MINIMAL_WASM);

    const instantiateSpy = vi.spyOn(WebAssembly, 'instantiate');
    const instance = await instantiateWasmModuleStreaming('ttf');
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
    expect(instantiateSpy).toHaveBeenCalled();
  });

  it('falls back to instantiate when instantiateStreaming is not available (Node.js)', async () => {
    // In Node.js, detectRuntime() returns 'node', so instantiateStreaming is not used.
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const instantiateSpy = vi.spyOn(WebAssembly, 'instantiate');

    const instance = await instantiateWasmModuleStreaming('libdeflate');
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
    expect(instantiateSpy).toHaveBeenCalled();
  });

  it('passes import object through to WebAssembly.instantiate', async () => {
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const imports: WebAssembly.Imports = {};
    const instantiateSpy = vi.spyOn(WebAssembly, 'instantiate');

    const instance = await instantiateWasmModuleStreaming('libdeflate', imports);
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
    expect(instantiateSpy).toHaveBeenCalledWith(MINIMAL_WASM, imports);
  });

  it('uses empty imports object by default', async () => {
    configureWasmLoader({
      moduleBytes: { libdeflate: MINIMAL_WASM },
    });

    const instantiateSpy = vi.spyOn(WebAssembly, 'instantiate');

    await instantiateWasmModuleStreaming('libdeflate');
    // Second argument should be an empty object (default)
    expect(instantiateSpy).toHaveBeenCalledWith(MINIMAL_WASM, {});
  });

  it('returns distinct instances for different modules', async () => {
    configureWasmLoader({
      moduleBytes: {
        libdeflate: MINIMAL_WASM,
        png: MINIMAL_WASM,
      },
    });

    const inst1 = await instantiateWasmModuleStreaming('libdeflate');
    const inst2 = await instantiateWasmModuleStreaming('png');

    expect(inst1).toBeInstanceOf(WebAssembly.Instance);
    expect(inst2).toBeInstanceOf(WebAssembly.Instance);
    expect(inst1).not.toBe(inst2);
  });
});

describe('streaming functions are exported from main index', () => {
  it('loadWasmModuleStreaming is exported', async () => {
    const mod = await import('../../src/index.js');
    expect(typeof mod.loadWasmModuleStreaming).toBe('function');
  });

  it('instantiateWasmModuleStreaming is exported', async () => {
    const mod = await import('../../src/index.js');
    expect(typeof mod.instantiateWasmModuleStreaming).toBe('function');
  });
});

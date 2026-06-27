/**
 * Tests for honest runtime capability detection.
 *
 * These run inside Node 26, which is known to support WebAssembly,
 * WebAssembly SIMD, SharedArrayBuffer, Atomics, and BigInt64Array.
 * Where the host guarantees a capability (Node 26) we assert the exact
 * value; everywhere a capability is host-dependent we only assert the
 * field is a boolean so the suite stays resilient across runtimes.
 *
 * Nothing here (or in the module under test) claims that SIMD/threads are
 * actually *accelerating* any code path — detection only reports what the
 * host *could* run. See {@link SIMD_NOTE}.
 */

import { describe, it, expect } from 'vitest';
import {
  detectRuntimeCapabilities,
  isWasmSimdSupported,
  SIMD_NOTE,
  type RuntimeCapabilities,
} from '../../../src/runtime/runtimeCapabilities.js';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('detectRuntimeCapabilities — shape', () => {
  it('returns an object with every documented field of the right type', () => {
    const caps: RuntimeCapabilities = detectRuntimeCapabilities();

    expect(typeof caps.wasm).toBe('boolean');
    expect(typeof caps.wasmSimd).toBe('boolean');
    expect(typeof caps.wasmThreads).toBe('boolean');
    expect(typeof caps.wasmBulkMemory).toBe('boolean');
    expect(typeof caps.sharedArrayBuffer).toBe('boolean');
    expect(typeof caps.atomics).toBe('boolean');
    expect(typeof caps.bigInt64Array).toBe('boolean');
    expect(typeof caps.crossOriginIsolated).toBe('boolean');
    expect(typeof caps.hardwareConcurrency).toBe('number');
  });

  it('reports a positive integer hardwareConcurrency', () => {
    const caps = detectRuntimeCapabilities();
    expect(Number.isInteger(caps.hardwareConcurrency)).toBe(true);
    expect(caps.hardwareConcurrency).toBeGreaterThan(0);
  });

  it('does not throw when called repeatedly', () => {
    expect(() => {
      detectRuntimeCapabilities();
      detectRuntimeCapabilities();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Capabilities guaranteed by Node 26 (the test host)
// ---------------------------------------------------------------------------

describe('detectRuntimeCapabilities — Node 26 guarantees', () => {
  it('detects WebAssembly support', () => {
    expect(detectRuntimeCapabilities().wasm).toBe(true);
  });

  it('detects SharedArrayBuffer, Atomics, and BigInt64Array', () => {
    const caps = detectRuntimeCapabilities();
    expect(caps.sharedArrayBuffer).toBe(true);
    expect(caps.atomics).toBe(true);
    expect(caps.bigInt64Array).toBe(true);
  });

  it('detects wasm SIMD (Node 26 supports the SIMD MVP)', () => {
    expect(detectRuntimeCapabilities().wasmSimd).toBe(true);
  });

  it('detects wasm bulk-memory (Node 26 supports it)', () => {
    expect(detectRuntimeCapabilities().wasmBulkMemory).toBe(true);
  });

  it('detects wasm threads (Node 26 has SharedArrayBuffer + atomics in wasm)', () => {
    expect(detectRuntimeCapabilities().wasmThreads).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isWasmSimdSupported convenience
// ---------------------------------------------------------------------------

describe('isWasmSimdSupported', () => {
  it('returns a boolean', () => {
    expect(typeof isWasmSimdSupported()).toBe('boolean');
  });

  it('agrees with detectRuntimeCapabilities().wasmSimd', () => {
    expect(isWasmSimdSupported()).toBe(detectRuntimeCapabilities().wasmSimd);
  });

  it('is true under Node 26', () => {
    expect(isWasmSimdSupported()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Host-dependent fields stay resilient
// ---------------------------------------------------------------------------

describe('detectRuntimeCapabilities — host-dependent fields', () => {
  it('crossOriginIsolated is a boolean (false when the global is absent)', () => {
    // Node 26 does not set globalThis.crossOriginIsolated, so this is false,
    // but we assert only the type to remain resilient on browsers/Workers.
    expect(typeof detectRuntimeCapabilities().crossOriginIsolated).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Honesty: SIMD_NOTE must disclaim, not over-promise
// ---------------------------------------------------------------------------

describe('SIMD_NOTE', () => {
  it('is a non-empty string mentioning SIMD', () => {
    expect(typeof SIMD_NOTE).toBe('string');
    expect(SIMD_NOTE.length).toBeGreaterThan(0);
    expect(SIMD_NOTE.toLowerCase()).toContain('simd');
  });
});

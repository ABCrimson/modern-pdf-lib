/**
 * Tests for the runtime detection module.
 *
 * Covers runtime kind detection (Node, Deno, Bun, browser, Cloudflare
 * Workers), caching behaviour, reset, and adapter factory creation.
 *
 * Because the tests run inside Node, some detections require mocking
 * globals on `globalThis`.  Every test cleans up after itself via
 * `resetDetection()` and restoring the original globals.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectRuntime,
  createRuntimeAdapter,
  resetDetection,
} from '../../../src/runtime/detect.js';

// ---------------------------------------------------------------------------
// Helpers — save / restore globals we may mutate
// ---------------------------------------------------------------------------

/**
 * Snapshot of globals that the detection logic inspects.
 * We save them before each test and restore them afterwards so
 * tests do not leak state.
 */
interface GlobalSnapshot {
  Deno: unknown;
  Bun: unknown;
  hasDeno: boolean;
  hasBun: boolean;
}

function saveGlobals(): GlobalSnapshot {
  const g = globalThis as Record<string, unknown>;
  return {
    Deno: g['Deno'],
    Bun: g['Bun'],
    hasDeno: 'Deno' in g,
    hasBun: 'Bun' in g,
  };
}

function restoreGlobals(snapshot: GlobalSnapshot): void {
  const g = globalThis as Record<string, unknown>;
  if (snapshot.hasDeno) {
    g['Deno'] = snapshot.Deno;
  } else {
    delete g['Deno'];
  }
  if (snapshot.hasBun) {
    g['Bun'] = snapshot.Bun;
  } else {
    delete g['Bun'];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectRuntime', () => {
  let saved: GlobalSnapshot;

  beforeEach(() => {
    saved = saveGlobals();
    resetDetection();
  });

  afterEach(() => {
    restoreGlobals(saved);
    resetDetection();
  });

  // -------------------------------------------------------------------------
  // Node.js detection (default in vitest)
  // -------------------------------------------------------------------------

  it('detects Node.js runtime by default in vitest', () => {
    // In vitest (running on Node), process.versions.node is set and
    // neither Deno nor Bun globals are defined.
    const g = globalThis as Record<string, unknown>;
    delete g['Deno'];
    delete g['Bun'];

    const kind = detectRuntime();
    expect(kind).toBe('node');
  });

  // -------------------------------------------------------------------------
  // Deno detection
  // -------------------------------------------------------------------------

  it('detects Deno when globalThis.Deno is defined', () => {
    const g = globalThis as Record<string, unknown>;
    g['Deno'] = { version: { deno: '1.40.0' } };
    delete g['Bun'];

    const kind = detectRuntime();
    expect(kind).toBe('deno');
  });

  // -------------------------------------------------------------------------
  // Bun detection
  // -------------------------------------------------------------------------

  it('detects Bun when globalThis.Bun is defined', () => {
    const g = globalThis as Record<string, unknown>;
    delete g['Deno'];
    g['Bun'] = { version: '1.0.0' };

    const kind = detectRuntime();
    expect(kind).toBe('bun');
  });

  // -------------------------------------------------------------------------
  // Priority: Deno wins over Bun
  // -------------------------------------------------------------------------

  it('prefers Deno over Bun when both are defined', () => {
    const g = globalThis as Record<string, unknown>;
    g['Deno'] = {};
    g['Bun'] = {};

    const kind = detectRuntime();
    expect(kind).toBe('deno');
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  it('caches the result across repeated calls', () => {
    const first = detectRuntime();
    const second = detectRuntime();
    expect(first).toBe(second);
  });

  // -------------------------------------------------------------------------
  // RuntimeKind is a string union
  // -------------------------------------------------------------------------

  it('returns a valid RuntimeKind string', () => {
    const validKinds = new Set(['browser', 'node', 'worker', 'deno', 'bun']);
    expect(validKinds.has(detectRuntime())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetDetection
// ---------------------------------------------------------------------------

describe('resetDetection', () => {
  let saved: GlobalSnapshot;

  beforeEach(() => {
    saved = saveGlobals();
  });

  afterEach(() => {
    restoreGlobals(saved);
    resetDetection();
  });

  it('clears the cached runtime so the next call re-detects', () => {
    const g = globalThis as Record<string, unknown>;
    delete g['Deno'];
    delete g['Bun'];

    // First detection: should be 'node'.
    const first = detectRuntime();
    expect(first).toBe('node');

    // Reset + inject Deno global
    resetDetection();
    g['Deno'] = {};

    const second = detectRuntime();
    expect(second).toBe('deno');
  });

  it('clears the cached adapter as well', () => {
    const adapter1 = createRuntimeAdapter();
    resetDetection();
    const adapter2 = createRuntimeAdapter();

    // After reset, a new adapter instance should be created.
    expect(adapter1).not.toBe(adapter2);
  });
});

// ---------------------------------------------------------------------------
// createRuntimeAdapter
// ---------------------------------------------------------------------------

describe('createRuntimeAdapter', () => {
  let saved: GlobalSnapshot;

  beforeEach(() => {
    saved = saveGlobals();
    resetDetection();
  });

  afterEach(() => {
    restoreGlobals(saved);
    resetDetection();
  });

  it('returns a RuntimeAdapter with expected methods', () => {
    const adapter = createRuntimeAdapter();
    expect(typeof adapter.readFile).toBe('function');
    expect(typeof adapter.writeFile).toBe('function');
    expect(typeof adapter.createWorker).toBe('function');
    expect(typeof adapter.randomBytes).toBe('function');
    expect(typeof adapter.performance.now).toBe('function');
    expect(typeof adapter.createReadableStream).toBe('function');
    expect(typeof adapter.fetchBytes).toBe('function');
  });

  it('caches the adapter across repeated calls', () => {
    const first = createRuntimeAdapter();
    const second = createRuntimeAdapter();
    expect(first).toBe(second);
  });

  it('creates a NodeRuntimeAdapter when runtime is node', () => {
    const g = globalThis as Record<string, unknown>;
    delete g['Deno'];
    delete g['Bun'];

    const adapter = createRuntimeAdapter();
    // NodeRuntimeAdapter has a `preload` method
    expect('preload' in adapter).toBe(true);
  });

  it('creates a DenoRuntimeAdapter when runtime is deno', () => {
    const g = globalThis as Record<string, unknown>;
    g['Deno'] = { readFile: () => {}, writeFile: () => {} };
    delete g['Bun'];

    const adapter = createRuntimeAdapter();
    // Verify it is the Deno adapter by checking constructor name
    expect(adapter.constructor.name).toBe('DenoRuntimeAdapter');
  });

  it('creates a NodeRuntimeAdapter for bun (node-compatible)', () => {
    const g = globalThis as Record<string, unknown>;
    delete g['Deno'];
    g['Bun'] = {};

    const adapter = createRuntimeAdapter();
    // Bun uses NodeRuntimeAdapter per the source code
    expect(adapter.constructor.name).toBe('NodeRuntimeAdapter');
  });

  it('adapter.randomBytes returns Uint8Array of requested length', () => {
    const adapter = createRuntimeAdapter();
    const bytes = adapter.randomBytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it('adapter.performance.now() returns a number', () => {
    const adapter = createRuntimeAdapter();
    const now = adapter.performance.now();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThanOrEqual(0);
  });

  it('adapter.createReadableStream() returns readable and writable', () => {
    const adapter = createRuntimeAdapter();
    const pair = adapter.createReadableStream<Uint8Array>();
    expect(pair.readable).toBeInstanceOf(ReadableStream);
    expect(pair.writable).toBeInstanceOf(WritableStream);
  });
});

/**
 * Worker runtime adapter tests.
 *
 * Tests the WorkerRuntimeAdapter directly without miniflare,
 * plus runtime detection and adapter factory functions.
 */

import { describe, it, expect } from 'vitest';
import { WorkerRuntimeAdapter } from '../../src/runtime/worker.js';
import { detectRuntime, createRuntimeAdapter, resetDetection } from '../../src/runtime/detect.js';
import type { RuntimeKind } from '../../src/runtime/detect.js';

// ---------------------------------------------------------------------------
// WorkerRuntimeAdapter direct tests
// ---------------------------------------------------------------------------

describe('WorkerRuntimeAdapter', () => {
  it('can be imported and instantiated', () => {
    const adapter = new WorkerRuntimeAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.readFile).toBe('function');
    expect(typeof adapter.writeFile).toBe('function');
    expect(typeof adapter.createWorker).toBe('function');
    expect(typeof adapter.randomBytes).toBe('function');
    expect(typeof adapter.fetchBytes).toBe('function');
    expect(typeof adapter.createReadableStream).toBe('function');
    expect(adapter.performance).toBeDefined();
    expect(typeof adapter.performance.now).toBe('function');
  });

  it('randomBytes() produces cryptographically random bytes', () => {
    const adapter = new WorkerRuntimeAdapter();

    const bytes16 = adapter.randomBytes(16);
    expect(bytes16).toBeInstanceOf(Uint8Array);
    expect(bytes16.length).toBe(16);

    // Two calls should produce different bytes (with overwhelming probability)
    const bytes16b = adapter.randomBytes(16);
    expect(bytes16b.length).toBe(16);

    // At least one byte should differ
    let allSame = true;
    for (let i = 0; i < 16; i++) {
      if (bytes16[i] !== bytes16b[i]) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it('randomBytes() handles sizes larger than 65536', () => {
    const adapter = new WorkerRuntimeAdapter();

    // This exercises the chunking logic in the adapter
    const bytes = adapter.randomBytes(65537);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65537);
  });

  it('randomBytes() returns empty array for zero length', () => {
    const adapter = new WorkerRuntimeAdapter();
    const bytes = adapter.randomBytes(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(0);
  });

  it('readFile() throws with a helpful message', async () => {
    const adapter = new WorkerRuntimeAdapter();
    await expect(adapter.readFile('/some/path.txt')).rejects.toThrow(
      /filesystem access is not available/,
    );
    await expect(adapter.readFile('/some/path.txt')).rejects.toThrow(
      /WorkerRuntimeAdapter\.readFile/,
    );
  });

  it('writeFile() throws with a helpful message', async () => {
    const adapter = new WorkerRuntimeAdapter();
    const data = new Uint8Array([1, 2, 3]);
    await expect(adapter.writeFile('/some/path.txt', data)).rejects.toThrow(
      /filesystem access is not available/,
    );
    await expect(adapter.writeFile('/some/path.txt', data)).rejects.toThrow(
      /WorkerRuntimeAdapter\.writeFile/,
    );
  });

  it('createWorker() throws with a helpful message', () => {
    const adapter = new WorkerRuntimeAdapter();
    expect(() => adapter.createWorker('test-script.js')).toThrow(
      /sub-workers are not supported/,
    );
    expect(() => adapter.createWorker('test-script.js')).toThrow(
      /WorkerRuntimeAdapter\.createWorker/,
    );
  });

  it('createReadableStream() returns a TransformStream-backed readable', () => {
    const adapter = new WorkerRuntimeAdapter();
    const { readable, writable } = adapter.createReadableStream<Uint8Array>();

    expect(readable).toBeInstanceOf(ReadableStream);
    expect(writable).toBeInstanceOf(WritableStream);
  });

  it('createReadableStream() returns distinct readable and writable instances', () => {
    const adapter = new WorkerRuntimeAdapter();
    const pair1 = adapter.createReadableStream<Uint8Array>();
    const pair2 = adapter.createReadableStream<Uint8Array>();

    // Each call should return new stream instances
    expect(pair1.readable).not.toBe(pair2.readable);
    expect(pair1.writable).not.toBe(pair2.writable);
  });

  it('performance.now() returns a number', () => {
    const adapter = new WorkerRuntimeAdapter();
    const t = adapter.performance.now();
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Runtime detection tests
// ---------------------------------------------------------------------------

describe('detectRuntime()', () => {
  it('returns a valid runtime string', () => {
    // Reset to force fresh detection
    resetDetection();
    const runtime = detectRuntime();
    const validRuntimes: RuntimeKind[] = ['browser', 'node', 'worker', 'deno', 'bun'];
    expect(validRuntimes).toContain(runtime);
  });

  it('returns the same value on repeated calls (caching)', () => {
    resetDetection();
    const first = detectRuntime();
    const second = detectRuntime();
    expect(first).toBe(second);
  });

  it('returns "node" when running in Node.js', () => {
    // In the vitest test environment, we are running in Node.js
    resetDetection();
    const runtime = detectRuntime();
    // Under vitest on Node, this should be 'node'
    expect(runtime).toBe('node');
  });
});

// ---------------------------------------------------------------------------
// createRuntimeAdapter tests
// ---------------------------------------------------------------------------

describe('createRuntimeAdapter()', () => {
  it('creates an adapter for the current runtime', () => {
    resetDetection();
    const adapter = createRuntimeAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.readFile).toBe('function');
    expect(typeof adapter.writeFile).toBe('function');
    expect(typeof adapter.randomBytes).toBe('function');
    expect(typeof adapter.fetchBytes).toBe('function');
    expect(typeof adapter.createReadableStream).toBe('function');
    expect(typeof adapter.createWorker).toBe('function');
  });

  it('returns the same cached adapter on repeated calls', () => {
    resetDetection();
    const adapter1 = createRuntimeAdapter();
    const adapter2 = createRuntimeAdapter();
    expect(adapter1).toBe(adapter2);
  });

  it('the adapter randomBytes works correctly', () => {
    resetDetection();
    const adapter = createRuntimeAdapter();
    const bytes = adapter.randomBytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });
});

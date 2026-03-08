/**
 * Tests for ObjectPool, ByteArrayPool, and DataViewPool utilities.
 *
 * Covers:
 * - ObjectPool: factory creation, acquire/release cycle, maxSize cap,
 *   reset callback, drain, size tracking
 * - ByteArrayPool: bucket selection, capacity matching, oversized
 *   allocation, release to correct bucket, drain, size tracking
 * - DataViewPool: acquire creates DataView, reuse on same buffer,
 *   new view for different buffer, release is no-op, drain
 */

import { describe, it, expect } from 'vitest';
import {
  ObjectPool,
  ByteArrayPool,
  DataViewPool,
} from '../../../src/utils/objectPool.js';

// ---------------------------------------------------------------------------
// ObjectPool
// ---------------------------------------------------------------------------

describe('ObjectPool', () => {
  it('creates a new instance from factory when pool is empty', () => {
    let created = 0;
    const pool = new ObjectPool(() => {
      created++;
      return { id: created };
    });
    const item = pool.acquire();
    expect(item.id).toBe(1);
    expect(created).toBe(1);
  });

  it('returns recycled instance after release', () => {
    const pool = new ObjectPool(() => ({ value: Math.random() }));
    const item = pool.acquire();
    pool.release(item);
    const reused = pool.acquire();
    expect(reused).toBe(item);
  });

  it('size reflects number of idle items', () => {
    const pool = new ObjectPool(() => ({}));
    expect(pool.size).toBe(0);
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    expect(pool.size).toBe(1);
    pool.release(b);
    expect(pool.size).toBe(2);
  });

  it('respects maxSize — discards excess releases', () => {
    const pool = new ObjectPool(() => ({}), { maxSize: 2 });
    const items = [pool.acquire(), pool.acquire(), pool.acquire()];
    for (const item of items) pool.release(item);
    expect(pool.size).toBe(2);
  });

  it('calls reset function on recycled items', () => {
    const pool = new ObjectPool(
      () => ({ count: 0 }),
      { reset: (item) => { item.count = 0; } },
    );
    const item = pool.acquire();
    item.count = 42;
    pool.release(item);
    const reused = pool.acquire();
    expect(reused.count).toBe(0);
  });

  it('does not call reset on freshly created items', () => {
    let resetCalls = 0;
    const pool = new ObjectPool(
      () => ({ v: 0 }),
      { reset: () => { resetCalls++; } },
    );
    pool.acquire(); // fresh, no reset
    expect(resetCalls).toBe(0);
  });

  it('drain() empties the pool', () => {
    const pool = new ObjectPool(() => ({}));
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(b);
    expect(pool.size).toBe(2);
    pool.drain();
    expect(pool.size).toBe(0);
  });

  it('uses default maxSize of 64', () => {
    const pool = new ObjectPool(() => ({}));
    for (let i = 0; i < 100; i++) {
      pool.release(pool.acquire());
    }
    // After releasing 100 items one-at-a-time, pool should grow
    // up to maxSize; releasing 100 in series means at most 1 in pool
    // at a time. Let's release many at once:
    const items: object[] = [];
    for (let i = 0; i < 100; i++) items.push(pool.acquire());
    for (const item of items) pool.release(item);
    expect(pool.size).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// ByteArrayPool
// ---------------------------------------------------------------------------

describe('ByteArrayPool', () => {
  it('returns an array with capacity >= requested size', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(100);
    expect(buf.length).toBeGreaterThanOrEqual(100);
    expect(buf).toBeInstanceOf(Uint8Array);
  });

  it('returns 256-byte array for small requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(10);
    expect(buf.length).toBe(256);
  });

  it('returns 1024-byte array for 257-byte requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(257);
    expect(buf.length).toBe(1024);
  });

  it('returns 4096-byte array for 1025-byte requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(1025);
    expect(buf.length).toBe(4096);
  });

  it('returns 16384-byte array for 4097-byte requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(4097);
    expect(buf.length).toBe(16384);
  });

  it('returns 65536-byte array for 16385-byte requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(16385);
    expect(buf.length).toBe(65536);
  });

  it('returns exact-size array for oversized requests', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(100_000);
    expect(buf.length).toBe(100_000);
  });

  it('reuses released arrays from correct bucket', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(100); // 256 bucket
    pool.release(buf);
    expect(pool.size).toBe(1);
    const reused = pool.acquire(50); // also fits in 256 bucket
    expect(reused).toBe(buf);
  });

  it('does not reuse oversized arrays (no matching bucket)', () => {
    const pool = new ByteArrayPool();
    const buf = pool.acquire(100_000);
    pool.release(buf);
    // Oversized array has no bucket, should be silently discarded
    expect(pool.size).toBe(0);
  });

  it('drain() empties all buckets', () => {
    const pool = new ByteArrayPool();
    pool.release(pool.acquire(10));    // 256 bucket
    pool.release(pool.acquire(500));   // 1024 bucket
    pool.release(pool.acquire(2000));  // 4096 bucket
    expect(pool.size).toBe(3);
    pool.drain();
    expect(pool.size).toBe(0);
  });

  it('size counts arrays across all buckets', () => {
    const pool = new ByteArrayPool();
    pool.release(pool.acquire(10));
    pool.release(pool.acquire(500));
    expect(pool.size).toBe(2);
  });

  it('limits each bucket to 16 arrays', () => {
    const pool = new ByteArrayPool();
    for (let i = 0; i < 20; i++) {
      pool.release(new Uint8Array(256));
    }
    // Only 16 should be retained in the 256 bucket
    expect(pool.size).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// DataViewPool
// ---------------------------------------------------------------------------

describe('DataViewPool', () => {
  it('returns a DataView for a Uint8Array', () => {
    const pool = new DataViewPool();
    const data = new Uint8Array(16);
    const view = pool.acquire(data);
    expect(view).toBeInstanceOf(DataView);
    expect(view.byteLength).toBe(16);
  });

  it('reuses DataView for the same underlying ArrayBuffer', () => {
    const pool = new DataViewPool();
    const data = new Uint8Array(32);
    const v1 = pool.acquire(data);
    const v2 = pool.acquire(data);
    expect(v1).toBe(v2);
  });

  it('creates new DataView for different buffer', () => {
    const pool = new DataViewPool();
    const a = new Uint8Array(16);
    const b = new Uint8Array(16);
    const va = pool.acquire(a);
    const vb = pool.acquire(b);
    expect(va).not.toBe(vb);
  });

  it('creates new DataView when offset/length changes', () => {
    const pool = new DataViewPool();
    const buf = new ArrayBuffer(64);
    const a = new Uint8Array(buf, 0, 32);
    const b = new Uint8Array(buf, 32, 32);
    const va = pool.acquire(a);
    const vb = pool.acquire(b);
    // Same buffer but different offset, so should create new view
    expect(va.byteOffset).toBe(0);
    expect(vb.byteOffset).toBe(32);
  });

  it('release is a no-op (does not throw)', () => {
    const pool = new DataViewPool();
    const data = new Uint8Array(16);
    const view = pool.acquire(data);
    expect(() => pool.release(view)).not.toThrow();
  });

  it('drain clears internal cache', () => {
    const pool = new DataViewPool();
    const data = new Uint8Array(16);
    const v1 = pool.acquire(data);
    pool.drain();
    const v2 = pool.acquire(data);
    // After drain, a new DataView should be created
    expect(v2).not.toBe(v1);
  });
});

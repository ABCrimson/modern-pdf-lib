/**
 * Tests for the SharedArrayBuffer + Atomics concurrency primitives.
 *
 * Atomics work correctly in a single thread, so every primitive is
 * exercised here without spawning a real worker. We deliberately avoid
 * `Atomics.wait` on this (the test runner's main) thread — it throws on
 * the main thread in browsers and blocks the event loop everywhere — and
 * instead test `SharedFlag` via its non-blocking `isSet`/`notify` surface.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isSharedMemoryAvailable,
  SharedCounter,
  SharedFlag,
  SharedRingBuffer,
} from '../../../src/runtime/sharedConcurrency.js';
import { InvalidArgumentError } from '../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a popped frame is non-null and return it as a plain number array. */
function asArray(frame: Uint8Array | null): number[] {
  expect(frame).not.toBeNull();
  return Array.from(frame ?? new Uint8Array(0));
}

// ---------------------------------------------------------------------------
// isSharedMemoryAvailable
// ---------------------------------------------------------------------------

describe('isSharedMemoryAvailable', () => {
  it('returns a boolean', () => {
    expect(typeof isSharedMemoryAvailable()).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// SharedCounter
// ---------------------------------------------------------------------------

describe('SharedCounter', () => {
  it('add returns the pre-add value and updates value (Atomics.add semantics)', () => {
    const c = new SharedCounter();
    expect(c.value).toBe(0);
    // Atomics.add returns the value that was at the slot BEFORE the add.
    expect(c.add(5)).toBe(0);
    expect(c.value).toBe(5);
    expect(c.add(3)).toBe(5);
    expect(c.value).toBe(8);
  });

  it('increment returns the pre-increment value', () => {
    const c = new SharedCounter();
    expect(c.increment()).toBe(0);
    expect(c.increment()).toBe(1);
    expect(c.value).toBe(2);
  });

  it('compareExchange swaps only when expected matches', () => {
    const c = new SharedCounter();
    c.add(10);
    // expected matches -> swap happens, returns previous value (10)
    expect(c.compareExchange(10, 42)).toBe(10);
    expect(c.value).toBe(42);
    // expected does NOT match -> no swap, returns current value (42)
    expect(c.compareExchange(0, 99)).toBe(42);
    expect(c.value).toBe(42);
  });

  it('two views over the SAME buffer see each other writes', () => {
    const a = new SharedCounter();
    const b = new SharedCounter(a.buffer, 0);
    a.add(7);
    expect(b.value).toBe(7);
    b.increment();
    expect(a.value).toBe(8);
  });

  it('honours a custom slot index', () => {
    const buffer = new SharedArrayBuffer(16);
    const a = new SharedCounter(buffer, 0);
    const b = new SharedCounter(buffer, 1);
    a.add(3);
    b.add(9);
    // distinct slots do not collide
    expect(a.value).toBe(3);
    expect(b.value).toBe(9);
  });

  it('exposes its backing buffer as a SharedArrayBuffer', () => {
    const c = new SharedCounter();
    expect(c.buffer).toBeInstanceOf(SharedArrayBuffer);
  });
});

// ---------------------------------------------------------------------------
// SharedFlag
// ---------------------------------------------------------------------------

describe('SharedFlag', () => {
  it('set / clear / isSet round-trip', () => {
    const f = new SharedFlag();
    expect(f.isSet()).toBe(false);
    f.set();
    expect(f.isSet()).toBe(true);
    f.clear();
    expect(f.isSet()).toBe(false);
  });

  it('notify returns the number of woken waiters (0 with none)', () => {
    const f = new SharedFlag();
    f.set();
    // No threads are blocked in Atomics.wait on this slot.
    expect(f.notify()).toBe(0);
  });

  it('exposes its backing buffer as a SharedArrayBuffer', () => {
    const f = new SharedFlag();
    expect(f.buffer).toBeInstanceOf(SharedArrayBuffer);
  });

  it('a second view over the same buffer observes the flag', () => {
    const a = new SharedFlag();
    const b = new SharedFlag(a.buffer);
    a.set();
    expect(b.isSet()).toBe(true);
    b.clear();
    expect(a.isSet()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SharedRingBuffer
// ---------------------------------------------------------------------------

describe('SharedRingBuffer', () => {
  it('push/pop round-trips bytes in FIFO order', () => {
    const ring = new SharedRingBuffer(64);
    expect(ring.push(Uint8Array.of(1, 2, 3))).toBe(true);
    expect(ring.push(Uint8Array.of(4, 5))).toBe(true);

    expect(asArray(ring.pop(16))).toEqual([1, 2, 3]);
    expect(asArray(ring.pop(16))).toEqual([4, 5]);
  });

  it('pop returns null when empty', () => {
    const ring = new SharedRingBuffer(32);
    expect(ring.pop(8)).toBeNull();
  });

  it('push returns false when full', () => {
    // Small capacity: only a few bytes of usable space.
    const ring = new SharedRingBuffer(8);
    // Each push writes a length header + payload; fill it up.
    let pushed = 0;
    while (ring.push(Uint8Array.of(0xff))) {
      pushed += 1;
      if (pushed > 1000) break; // safety net
    }
    expect(pushed).toBeGreaterThan(0);
    // Now it is full.
    expect(ring.push(Uint8Array.of(0xff))).toBe(false);
  });

  it('an empty push is accepted and pops back as an empty array', () => {
    const ring = new SharedRingBuffer(32);
    expect(ring.push(new Uint8Array(0))).toBe(true);
    expect(asArray(ring.pop(16))).toEqual([]);
  });

  it('pop respecting maxBytes leaves an oversized frame intact', () => {
    const ring = new SharedRingBuffer(64);
    ring.push(Uint8Array.of(10, 20, 30, 40));
    // Ask for fewer bytes than the frame contains -> refuse, return null.
    expect(ring.pop(2)).toBeNull();
    // The frame is still there and pops fully when allowed.
    expect(asArray(ring.pop(16))).toEqual([10, 20, 30, 40]);
  });

  it('fromBuffer view sees data pushed by the original', () => {
    const ring = new SharedRingBuffer(64);
    ring.push(Uint8Array.of(7, 8, 9));
    const mirror = SharedRingBuffer.fromBuffer(ring.buffer);
    expect(asArray(mirror.pop(16))).toEqual([7, 8, 9]);
  });

  it('wraps around the ring correctly under repeated push/pop', () => {
    const ring = new SharedRingBuffer(32);
    const seen: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const payload = Uint8Array.of(i & 0xff, (i * 2) & 0xff);
      expect(ring.push(payload)).toBe(true);
      const out = asArray(ring.pop(16));
      seen.push(out[0] ?? -1, out[1] ?? -1);
    }
    // Reconstruct what we expect to have observed, in FIFO order.
    const expected: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      expected.push(i & 0xff, (i * 2) & 0xff);
    }
    expect(seen).toEqual(expected);
  });

  it('exposes its backing buffer as a SharedArrayBuffer', () => {
    const ring = new SharedRingBuffer(32);
    expect(ring.buffer).toBeInstanceOf(SharedArrayBuffer);
  });
});

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

describe('sharedConcurrency typed errors', () => {
  /** The error `fn` throws; fails the test when it does not throw. */
  function thrownBy(fn: () => unknown): unknown {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return expect.unreachable('the call did not throw');
  }

  it('SharedCounter throws InvalidArgumentError naming index', () => {
    for (const index of [-1, 1.5]) {
      const error = thrownBy(() => new SharedCounter(undefined, index));
      expect(error, String(index)).toBeInstanceOf(InvalidArgumentError);
      expect(error).toMatchObject({ code: 'invalid-argument', argument: 'index' });
      expect((error as Error).message).toBe(
        `SharedCounter: index must be a non-negative integer, received ${index}`,
      );
    }
    const outOfRange = thrownBy(() => new SharedCounter(new SharedArrayBuffer(4), 1));
    expect(outOfRange).toBeInstanceOf(InvalidArgumentError);
    expect(outOfRange).toMatchObject({ code: 'invalid-argument', argument: 'index' });
    expect((outOfRange as Error).message).toBe(
      'SharedCounter: index 1 is out of range for a 4-byte buffer',
    );
  });

  it('SharedFlag throws InvalidArgumentError naming buffer for a buffer under 4 bytes', () => {
    const error = thrownBy(() => new SharedFlag(new SharedArrayBuffer(2)));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'buffer' });
    expect((error as Error).message).toBe('SharedFlag: buffer must be at least 4 bytes, got 2');
  });

  it('SharedRingBuffer throws InvalidArgumentError naming capacityBytes', () => {
    for (const capacityBytes of [0, -8, 2.5]) {
      const error = thrownBy(() => new SharedRingBuffer(capacityBytes));
      expect(error, String(capacityBytes)).toBeInstanceOf(InvalidArgumentError);
      expect(error).toMatchObject({ code: 'invalid-argument', argument: 'capacityBytes' });
      expect((error as Error).message).toBe(
        `SharedRingBuffer: capacityBytes must be a positive integer, received ${capacityBytes}`,
      );
    }
  });

  it('SharedRingBuffer.fromBuffer throws InvalidArgumentError naming buffer when it is too small', () => {
    const error = thrownBy(() => SharedRingBuffer.fromBuffer(new SharedArrayBuffer(8)));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'buffer' });
    expect((error as Error).message).toBe(
      'SharedRingBuffer.fromBuffer: buffer too small (8 bytes)',
    );
  });

  it('allocating without SharedArrayBuffer throws EnvironmentError (runtime-api)', async () => {
    // The constructor is captured when the module loads, so load a fresh copy of the module (and of
    // the error classes it throws) while the global is hidden.
    vi.resetModules();
    vi.stubGlobal('SharedArrayBuffer', undefined);
    try {
      const fresh = await import('../../../src/runtime/sharedConcurrency.js');
      const { EnvironmentError: FreshEnvironmentError } = await import('../../../src/errors.js');
      expect(fresh.isSharedMemoryAvailable()).toBe(false);
      for (const construct of [
        () => new fresh.SharedCounter(),
        () => new fresh.SharedFlag(),
        () => new fresh.SharedRingBuffer(16),
      ]) {
        const error = thrownBy(construct);
        expect(error).toBeInstanceOf(FreshEnvironmentError);
        expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'runtime-api' });
        expect((error as Error).message).toContain('SharedArrayBuffer is not available');
      }
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

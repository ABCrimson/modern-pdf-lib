/**
 * Tests for the bounded-concurrency worker pool.
 *
 * No real `Worker` is ever spawned: the unit of work is injected as a
 * plain async {@link TaskRunner}, with controllable deferred promises so a
 * test can assert exactly how many tasks are in flight at once.
 */

import { describe, it, expect } from 'vitest';
import {
  createWorkerPool,
  type TaskRunner,
} from '../../../src/runtime/workerPool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A promise paired with its externally callable settlement functions. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Yield to the microtask queue a few times so the pool can pump. */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Concurrency bounding
// ---------------------------------------------------------------------------

describe('createWorkerPool concurrency', () => {
  it('never exceeds the limit and returns results in input order', async () => {
    const inputs = [0, 1, 2, 3, 4, 5] as const;
    const deferreds = inputs.map(() => defer<number>());

    let inFlight = 0;
    let maxInFlight = 0;

    const runner: TaskRunner<number, string> = async (input) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const deferred = deferreds[input];
      if (deferred === undefined) {
        throw new Error(`no deferred for input ${input}`);
      }
      try {
        const value = await deferred.promise;
        return `r${value}`;
      } finally {
        inFlight -= 1;
      }
    };

    const pool = createWorkerPool(runner, { concurrency: 2 });
    const resultPromise = pool.runAll([...inputs]);

    // Drain the deferreds one at a time, confirming the in-flight count
    // is held at the concurrency limit while work remains.
    for (let i = 0; i < inputs.length; i += 1) {
      await flush();
      expect(inFlight).toBeLessThanOrEqual(2);
      expect(pool.activeCount).toBeLessThanOrEqual(2);
      const deferred = deferreds[i];
      if (deferred === undefined) throw new Error(`missing deferred ${i}`);
      deferred.resolve(i);
    }

    const results = await resultPromise;

    expect(maxInFlight).toBe(2);
    expect(results).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
    expect(pool.activeCount).toBe(0);
  });

  it('queues tasks beyond the limit before starting them', async () => {
    const started: number[] = [];
    const deferreds = [defer<void>(), defer<void>(), defer<void>()];

    const runner: TaskRunner<number, number> = async (input) => {
      started.push(input);
      const deferred = deferreds[input];
      if (deferred === undefined) throw new Error(`no deferred ${input}`);
      await deferred.promise;
      return input;
    };

    const pool = createWorkerPool(runner, { concurrency: 1 });
    const all = pool.runAll([0, 1, 2]);

    await flush();
    expect(started).toEqual([0]);
    expect(pool.activeCount).toBe(1);

    const d0 = deferreds[0];
    if (d0 === undefined) throw new Error('missing d0');
    d0.resolve();
    await flush();
    expect(started).toEqual([0, 1]);

    const d1 = deferreds[1];
    if (d1 === undefined) throw new Error('missing d1');
    d1.resolve();
    const d2 = deferreds[2];
    if (d2 === undefined) throw new Error('missing d2');
    d2.resolve();

    expect(await all).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Error isolation
// ---------------------------------------------------------------------------

describe('createWorkerPool error handling', () => {
  it('a rejecting task surfaces its error while siblings resolve', async () => {
    const runner: TaskRunner<number, string> = async (input) => {
      await Promise.resolve();
      if (input === 1) throw new Error('boom on 1');
      return `ok${input}`;
    };

    const pool = createWorkerPool(runner, { concurrency: 2 });

    const p0 = pool.run(0);
    const p1 = pool.run(1);
    const p2 = pool.run(2);

    await expect(p1).rejects.toThrow(/boom on 1/);
    expect(await p0).toBe('ok0');
    expect(await p2).toBe('ok2');
    expect(pool.activeCount).toBe(0);
  });

  it('runAll rejects but the pool stays usable afterwards', async () => {
    const runner: TaskRunner<number, number> = async (input) => {
      await Promise.resolve();
      if (input < 0) throw new Error('negative');
      return input * 2;
    };

    const pool = createWorkerPool(runner, { concurrency: 3 });

    await expect(pool.runAll([1, -1, 2])).rejects.toThrow(/negative/);

    // Pool is not poisoned: a fresh batch completes normally.
    expect(await pool.runAll([3, 4, 5])).toEqual([6, 8, 10]);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('createWorkerPool options', () => {
  it('defaults concurrency when none is supplied', async () => {
    const runner: TaskRunner<number, number> = (input) =>
      Promise.resolve(input);
    const pool = createWorkerPool(runner);
    expect(await pool.runAll([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('rejects a non-positive concurrency', () => {
    const runner: TaskRunner<number, number> = (input) =>
      Promise.resolve(input);
    expect(() => createWorkerPool(runner, { concurrency: 0 })).toThrow(
      /positive integer/,
    );
    expect(() => createWorkerPool(runner, { concurrency: -2 })).toThrow(
      /positive integer/,
    );
  });

  it('runAll over an empty input list resolves to an empty array', async () => {
    const runner: TaskRunner<number, number> = (input) =>
      Promise.resolve(input);
    const pool = createWorkerPool(runner, { concurrency: 2 });
    expect(await pool.runAll([])).toEqual([]);
  });
});

/**
 * @module runtime/memoryBudget
 *
 * A memory budget / cap used to bound the processing of *untrusted* PDFs as a
 * defence against decompression bombs and out-of-memory (OOM) attacks.
 *
 * ## What this is — and what it is NOT
 *
 * {@link MemoryBudget} is a **pure accounting guard**. It is a plain integer
 * counter with a ceiling. It does **NOT** measure real process memory (RSS),
 * heap usage, `performance.memory`, or anything reported by the host. It makes
 * **no** claim of measuring actual memory and performs **no** acceleration of
 * any kind — there are no workers, SIMD, threads, `Atomics`, or
 * `SharedArrayBuffer` involved.
 *
 * The intended usage pattern is *predictive*: before a caller allocates a
 * large buffer (for example, the expected output length of an inflated /
 * decoded stream, which a malicious PDF can declare as enormous), it reports
 * that size to the budget via {@link MemoryBudget.allocate} (or
 * {@link MemoryBudget.tryAllocate}). If the reported size would push total
 * tracked usage past the configured limit, the allocation is rejected
 * **before** the real memory is ever requested — so a bomb is stopped early
 * instead of being materialised and crashing the runtime.
 *
 * Because it is pure accounting, its accuracy is exactly as good as the sizes
 * callers report. It is a budget, not a profiler.
 *
 * ## Runtime
 *
 * This module uses only ECMAScript primitives (numbers, classes, closures).
 * It assumes no Node-only globals and runs unchanged on Node, Deno, Bun,
 * Cloudflare Workers, and browsers.
 */

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link MemoryBudget.allocate} (and {@link MemoryBudget.withAllocation})
 * when a requested allocation would exceed the configured limit.
 *
 * Carries the numbers involved so callers can surface a precise diagnostic:
 *
 * - {@link requested} — the size that was being allocated.
 * - {@link used} — the tracked usage *before* the rejected allocation.
 * - {@link limit} — the configured ceiling.
 */
export class MemoryBudgetExceededError extends Error {
  /** The allocation size, in bytes, that was rejected. */
  readonly requested: number;
  /** The configured budget ceiling, in bytes. */
  readonly limit: number;
  /** The tracked usage, in bytes, at the moment of rejection. */
  readonly used: number;

  /**
   * @param requested - The size, in bytes, that was being allocated.
   * @param used      - The tracked usage, in bytes, before the allocation.
   * @param limit     - The configured ceiling, in bytes.
   */
  constructor(requested: number, used: number, limit: number) {
    super(
      `Memory budget exceeded: requested ${requested} byte(s) with ${used} ` +
        `of ${limit} byte(s) already in use (would total ${used + requested}).`,
    );
    this.name = 'MemoryBudgetExceededError';
    this.requested = requested;
    this.used = used;
    this.limit = limit;
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for the {@link MemoryBudget} constructor.
 */
export interface MemoryBudgetOptions {
  /**
   * The ceiling, in bytes, that tracked usage may not exceed. Must be a
   * finite number greater than `0`. `NaN`, negative values, and `Infinity`
   * are all rejected with a {@link TypeError} (see {@link createMemoryBudget}).
   */
  limitBytes: number;
  /**
   * Optional callback invoked **before** a {@link MemoryBudgetExceededError} is
   * thrown by {@link MemoryBudget.allocate}. It receives the same numbers the
   * error will carry. It is *not* invoked by {@link MemoryBudget.tryAllocate},
   * which never throws.
   *
   * Per `exactOptionalPropertyTypes`, declared as `| undefined`.
   */
  onExceed?:
    | ((info: { requested: number; used: number; limit: number }) => void)
    | undefined;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a configured limit. The limit must be a finite number strictly
 * greater than zero; `NaN`, negative values, and `Infinity` are rejected.
 *
 * @throws {TypeError} If the limit is not a finite number `> 0`.
 */
function assertValidLimit(limitBytes: number): void {
  if (typeof limitBytes !== 'number' || !Number.isFinite(limitBytes) || limitBytes <= 0) {
    throw new TypeError(
      `MemoryBudget: limitBytes must be a finite number greater than 0, ` +
        `received ${String(limitBytes)}.`,
    );
  }
}

/**
 * Validate a size passed to {@link MemoryBudget.allocate},
 * {@link MemoryBudget.tryAllocate}, {@link MemoryBudget.release}, or
 * {@link MemoryBudget.withAllocation}. The size must be a finite,
 * non-negative number; `NaN`, negative values, and `Infinity` are rejected.
 *
 * @throws {TypeError} If the size is not a finite number `>= 0`.
 */
function assertValidSize(bytes: number, method: string): void {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    throw new TypeError(
      `MemoryBudget.${method}: bytes must be a finite, non-negative number, ` +
        `received ${String(bytes)}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// MemoryBudget
// ---------------------------------------------------------------------------

/**
 * A bounded memory accounting guard. See the {@link module:runtime/memoryBudget module documentation}
 * for the precise semantics — in particular, that this tracks *reported*
 * sizes and does not measure real RSS.
 */
export class MemoryBudget {
  /** The configured ceiling, in bytes. */
  readonly #limit: number;
  /** The optional pre-throw notification callback. */
  readonly #onExceed:
    | ((info: { requested: number; used: number; limit: number }) => void)
    | undefined;
  /** Currently tracked usage, in bytes. Always `0 <= used <= limit`. */
  #used = 0;

  /**
   * @param options - The {@link MemoryBudgetOptions}. `limitBytes` must be a
   *                  finite number greater than `0`.
   * @throws {TypeError} If `limitBytes` is not a finite number `> 0`.
   */
  constructor(options: MemoryBudgetOptions) {
    assertValidLimit(options.limitBytes);
    this.#limit = options.limitBytes;
    this.#onExceed = options.onExceed;
  }

  /** Currently tracked usage, in bytes. */
  get used(): number {
    return this.#used;
  }

  /** The configured ceiling, in bytes. */
  get limit(): number {
    return this.#limit;
  }

  /** Bytes still available before the limit is reached (never negative). */
  get remaining(): number {
    return this.#limit - this.#used;
  }

  /**
   * Reserve `bytes` against the budget.
   *
   * If `used + bytes` would exceed the limit, {@link onExceed} (if supplied)
   * is invoked first and then a {@link MemoryBudgetExceededError} is thrown;
   * tracked usage is left unchanged in that case.
   *
   * @param bytes - The size to reserve. Must be a finite number `>= 0`.
   * @throws {TypeError} If `bytes` is negative, `NaN`, or `Infinity`.
   * @throws {MemoryBudgetExceededError} If the allocation would exceed the limit.
   */
  allocate(bytes: number): void {
    assertValidSize(bytes, 'allocate');
    if (this.#used + bytes > this.#limit) {
      this.#onExceed?.({ requested: bytes, used: this.#used, limit: this.#limit });
      throw new MemoryBudgetExceededError(bytes, this.#used, this.#limit);
    }
    this.#used += bytes;
  }

  /**
   * Non-throwing variant of {@link allocate}. Reserves `bytes` and returns
   * `true` on success, or returns `false` (leaving usage unchanged) if the
   * allocation would exceed the limit. {@link onExceed} is **not** invoked.
   *
   * @param bytes - The size to reserve. Must be a finite number `>= 0`.
   * @returns `true` if reserved, `false` if it would exceed the limit.
   * @throws {TypeError} If `bytes` is negative, `NaN`, or `Infinity`.
   */
  tryAllocate(bytes: number): boolean {
    assertValidSize(bytes, 'tryAllocate');
    if (this.#used + bytes > this.#limit) {
      return false;
    }
    this.#used += bytes;
    return true;
  }

  /**
   * Return `bytes` to the budget. Usage is clamped at `0`, so over-releasing
   * (or releasing more than was reserved) never produces a negative value.
   *
   * @param bytes - The size to release. Must be a finite number `>= 0`.
   * @throws {TypeError} If `bytes` is negative, `NaN`, or `Infinity`.
   */
  release(bytes: number): void {
    assertValidSize(bytes, 'release');
    this.#used = Math.max(0, this.#used - bytes);
  }

  /** Reset tracked usage to zero. The limit is unchanged. */
  reset(): void {
    this.#used = 0;
  }

  /**
   * Reserve `bytes`, run `fn`, and release `bytes` in a `finally` block so the
   * reservation is returned even if `fn` throws.
   *
   * If the reservation itself would exceed the limit, `fn` is never invoked
   * and a {@link MemoryBudgetExceededError} is thrown (nothing to release).
   *
   * @typeParam T - The return type of `fn`.
   * @param bytes - The size to reserve for the duration of `fn`.
   * @param fn    - The work to run while the reservation is held.
   * @returns Whatever `fn` returns.
   * @throws {TypeError} If `bytes` is negative, `NaN`, or `Infinity`.
   * @throws {MemoryBudgetExceededError} If the reservation would exceed the limit.
   */
  withAllocation<T>(bytes: number, fn: () => T): T {
    this.allocate(bytes);
    try {
      return fn();
    } finally {
      this.release(bytes);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link MemoryBudget} with the given ceiling.
 *
 * The limit must be a finite number strictly greater than `0`; `NaN`,
 * negative values, and `Infinity` are all rejected with a {@link TypeError}.
 * (An infinite budget is intentionally disallowed: the whole point is to cap
 * untrusted input, and `Infinity` would silently disable the guard.)
 *
 * @param limitBytes - The ceiling, in bytes. Must be finite and `> 0`.
 * @returns A new {@link MemoryBudget}.
 * @throws {TypeError} If `limitBytes` is not a finite number `> 0`.
 */
export function createMemoryBudget(limitBytes: number): MemoryBudget {
  return new MemoryBudget({ limitBytes });
}

/**
 * Tests for the memory budget / cap used to bound processing of untrusted
 * PDFs (a decompression-bomb / OOM defence).
 *
 * The budget is a *pure accounting guard*: it never measures real RSS. A
 * caller reports the size it is about to allocate (e.g. an inflated stream's
 * expected length) so a bomb is rejected BEFORE the allocation happens.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MemoryBudget,
  MemoryBudgetExceededError,
  createMemoryBudget,
} from '../../../src/runtime/memoryBudget.js';

// ---------------------------------------------------------------------------
// createMemoryBudget — construction & validation
// ---------------------------------------------------------------------------

describe('createMemoryBudget', () => {
  it('creates a budget with the given limit and zero usage', () => {
    const budget = createMemoryBudget(1000);
    expect(budget).toBeInstanceOf(MemoryBudget);
    expect(budget.limit).toBe(1000);
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(1000);
  });

  it('throws a TypeError for a zero limit', () => {
    expect(() => createMemoryBudget(0)).toThrow(TypeError);
  });

  it('throws a TypeError for a negative limit', () => {
    expect(() => createMemoryBudget(-5)).toThrow(TypeError);
  });

  it('throws a TypeError for a NaN limit', () => {
    expect(() => createMemoryBudget(Number.NaN)).toThrow(TypeError);
  });

  it('throws a TypeError for an Infinity limit', () => {
    expect(() => createMemoryBudget(Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
  });
});

// ---------------------------------------------------------------------------
// allocate
// ---------------------------------------------------------------------------

describe('MemoryBudget#allocate', () => {
  it('tracks usage and remaining for a successful allocation', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    expect(budget.used).toBe(600);
    expect(budget.remaining).toBe(400);
  });

  it('allows allocating exactly up to the limit', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(1000);
    expect(budget.used).toBe(1000);
    expect(budget.remaining).toBe(0);
  });

  it('allows a zero-byte allocation', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(0);
    expect(budget.used).toBe(0);
  });

  it('throws MemoryBudgetExceededError when an allocation would exceed the limit', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    expect(() => budget.allocate(500)).toThrow(MemoryBudgetExceededError);
  });

  it('populates requested/used/limit on the thrown error', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    let caught: MemoryBudgetExceededError | undefined;
    try {
      budget.allocate(500);
    } catch (err) {
      caught = err as MemoryBudgetExceededError;
    }
    expect(caught).toBeInstanceOf(MemoryBudgetExceededError);
    expect(caught?.requested).toBe(500);
    expect(caught?.used).toBe(600);
    expect(caught?.limit).toBe(1000);
  });

  it('does NOT change usage when an allocation is rejected', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    expect(() => budget.allocate(500)).toThrow(MemoryBudgetExceededError);
    expect(budget.used).toBe(600);
    expect(budget.remaining).toBe(400);
  });

  it('calls onExceed before throwing', () => {
    const onExceed = vi.fn();
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    expect(() => budget.allocate(500)).toThrow(MemoryBudgetExceededError);
    expect(onExceed).not.toHaveBeenCalled();

    const budget2 = new MemoryBudget({ limitBytes: 1000, onExceed });
    budget2.allocate(600);
    expect(() => budget2.allocate(500)).toThrow(MemoryBudgetExceededError);
    expect(onExceed).toHaveBeenCalledTimes(1);
    expect(onExceed).toHaveBeenCalledWith({
      requested: 500,
      used: 600,
      limit: 1000,
    });
  });

  it('throws a TypeError for a negative allocation size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.allocate(-1)).toThrow(TypeError);
  });

  it('throws a TypeError for a NaN allocation size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.allocate(Number.NaN)).toThrow(TypeError);
  });

  it('throws a TypeError for an Infinity allocation size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.allocate(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// tryAllocate
// ---------------------------------------------------------------------------

describe('MemoryBudget#tryAllocate', () => {
  it('returns true and records usage when within budget', () => {
    const budget = createMemoryBudget(1000);
    expect(budget.tryAllocate(600)).toBe(true);
    expect(budget.used).toBe(600);
  });

  it('returns false and does NOT change usage when it would exceed', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    expect(budget.tryAllocate(500)).toBe(false);
    expect(budget.used).toBe(600);
  });

  it('does not call onExceed (non-throwing variant)', () => {
    const onExceed = vi.fn();
    const budget = new MemoryBudget({ limitBytes: 1000, onExceed });
    budget.allocate(600);
    expect(budget.tryAllocate(500)).toBe(false);
    expect(onExceed).not.toHaveBeenCalled();
  });

  it('throws a TypeError for a negative size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.tryAllocate(-1)).toThrow(TypeError);
  });

  it('throws a TypeError for a NaN size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.tryAllocate(Number.NaN)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// release / reset
// ---------------------------------------------------------------------------

describe('MemoryBudget#release', () => {
  it('frees previously allocated bytes', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    budget.release(600);
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(1000);
  });

  it('clamps usage at zero (never negative) when releasing beyond used', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(200);
    budget.release(600);
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(1000);
  });

  it('throws a TypeError for a negative release size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.release(-1)).toThrow(TypeError);
  });

  it('throws a TypeError for a NaN release size', () => {
    const budget = createMemoryBudget(1000);
    expect(() => budget.release(Number.NaN)).toThrow(TypeError);
  });
});

describe('MemoryBudget#reset', () => {
  it('returns usage to zero', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(750);
    budget.reset();
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// withAllocation
// ---------------------------------------------------------------------------

describe('MemoryBudget#withAllocation', () => {
  it('allocates, runs the function, and releases afterwards', () => {
    const budget = createMemoryBudget(1000);
    const result = budget.withAllocation(600, () => {
      expect(budget.used).toBe(600);
      return 42;
    });
    expect(result).toBe(42);
    expect(budget.used).toBe(0);
  });

  it('releases the allocation even when the function throws', () => {
    const budget = createMemoryBudget(1000);
    expect(() =>
      budget.withAllocation(600, () => {
        expect(budget.used).toBe(600);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(budget.used).toBe(0);
  });

  it('throws MemoryBudgetExceededError without running fn when over budget', () => {
    const budget = createMemoryBudget(1000);
    budget.allocate(600);
    const fn = vi.fn(() => 1);
    expect(() => budget.withAllocation(500, fn)).toThrow(
      MemoryBudgetExceededError,
    );
    expect(fn).not.toHaveBeenCalled();
    expect(budget.used).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// MemoryBudgetExceededError
// ---------------------------------------------------------------------------

describe('MemoryBudgetExceededError', () => {
  it('is an Error subclass with a stable name', () => {
    const err = new MemoryBudgetExceededError(500, 600, 1000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('MemoryBudgetExceededError');
    expect(err.requested).toBe(500);
    expect(err.used).toBe(600);
    expect(err.limit).toBe(1000);
  });
});

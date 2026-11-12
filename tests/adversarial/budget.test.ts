/**
 * Self-test of the budgeted runner (tests/helpers/budget.ts) with the harmless bodies of
 * budget.bodies.ts: every outcome the runner reports, reached on purpose.
 *
 * The memory cases run with a 128 MiB budget instead of the default 512 MiB, so each ends after a
 * few hundred milliseconds of allocation; the time case and the untouched-allocation case run with
 * the default budget (2000 ms, 512 MiB).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, runWithinBudget } from '../helpers/budget.js';
import type { Budget, BudgetTask } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/budget.bodies.ts';
const SMALL: Budget = { ms: DEFAULT_BUDGET.ms, mib: 128 };
// Start-up (child process, worker, tsx import of the body module) comes before the budget clock.
const TIMEOUT = 30_000;

const task = (entry: string, input: string | Uint8Array = new Uint8Array(0)): BudgetTask => ({
  module: BODIES,
  entry,
  input,
});

describe('budgeted runner', () => {
  it('has a default budget of 2000 ms and 512 MiB', () => {
    expect(DEFAULT_BUDGET).toEqual({ ms: 2000, mib: 512 });
  });

  it(
    'reports a body that returns as completed, with its result',
    async () => {
      const outcome = await runWithinBudget({
        ...task('returns', new Uint8Array([1, 2, 3])),
        args: { mode: 'plain' },
      });
      expect(outcome).toMatchObject({
        kind: 'completed',
        result: { bytes: 3, args: { mode: 'plain' } },
      });
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'reports a thrown ResourceLimitError with its name, code and limit',
    async () => {
      const outcome = await runWithinBudget(task('throwsLimit'));
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        code: 'resource-limit-exceeded',
        limit: 'maxImagePixels',
        message: 'Input exceeds the internal limit maxImagePixels (268435456 pixels).',
      });
    },
    TIMEOUT,
  );

  it(
    'kills a body that runs past the time budget',
    async () => {
      const outcome = await runWithinBudget(task('spins'));
      expect(outcome).toMatchObject({ kind: 'killed', reason: 'time' });
      expect(outcome.ms).toBeGreaterThanOrEqual(DEFAULT_BUDGET.ms);
      // The parent's timer fires at 2000 ms and the child ends a few milliseconds later; the rest
      // is margin for a loaded CI runner.
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms + 400);
    },
    TIMEOUT,
  );

  it(
    'kills a body that prints protocol-shaped lines for time, never reading them as its outcome',
    async () => {
      const outcome = await runWithinBudget(task('printsProtocolLines'));
      expect(outcome).toMatchObject({ kind: 'killed', reason: 'time' });
      expect(outcome.ms).toBeGreaterThanOrEqual(DEFAULT_BUDGET.ms);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms + 400);
    },
    TIMEOUT,
  );

  it.each([
    ['small objects', 'growsSmallObjects'],
    ['large arrays', 'growsLargeArrays'],
    ['filled typed arrays', 'growsTypedArrays'],
  ])(
    'kills a body whose memory grows past the memory budget (%s)',
    async (_pattern, entry) => {
      const outcome = await runWithinBudget(task(entry), SMALL);
      expect(outcome.kind).toBe('killed');
      if (outcome.kind !== 'killed') return;
      expect(['memory', 'crash']).toContain(outcome.reason);
      expect(outcome.ms).toBeLessThan(SMALL.ms);
    },
    TIMEOUT,
  );

  it(
    'completes a body that allocates 1 GiB it never touches',
    async () => {
      const outcome = await runWithinBudget(task('allocatesUntouched'));
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 2 ** 30 } });
      expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'reads the input from a file path',
    async () => {
      const outcome = await runWithinBudget(task('returns', BODIES));
      expect(outcome.kind).toBe('completed');
      if (outcome.kind !== 'completed') return;
      expect(outcome.result).toMatchObject({ bytes: expect.any(Number) });
      expect((outcome.result as { bytes: number }).bytes).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

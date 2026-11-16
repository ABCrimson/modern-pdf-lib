/**
 * Self-test of the budgeted runner (tests/helpers/budget.ts) with the harmless bodies of
 * budget.bodies.ts: every outcome the runner reports, reached on purpose.
 *
 * The memory cases run with a 128 MiB budget instead of the default 512 MiB, so each ends after a
 * few hundred milliseconds of allocation; the time case and the untouched-allocation case run with
 * the default budget (2000 ms, 512 MiB). Every time comparison is against the scaled limit
 * (timeLimitMs), so the file passes under any MPL_BUDGET_TIME_SCALE; the scale itself is proved
 * by passing one to runWithinBudget explicitly, since the environment is read once at import.
 */
import { describe, expect, it } from 'vitest';
import {
  BUDGET_TIME_SCALE,
  DEFAULT_BUDGET,
  parseBudgetTimeScale,
  runWithinBudget,
  timeLimitMs,
} from '../helpers/budget.js';
import type { Budget, BudgetTask } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/budget.bodies.ts';
const SMALL: Budget = { ms: DEFAULT_BUDGET.ms, mib: 128 };
// Start-up (child process, worker, tsx import of the body module) comes before the budget clock.
const TIMEOUT = 30_000;
// The parent's timer fires at the limit and the child ends a few milliseconds later; the rest is
// margin for a loaded runner, which the time scale stretches like the limit.
const KILL_MARGIN_MS = timeLimitMs({ ms: 400, mib: 0 });

const task = (entry: string, input: string | Uint8Array = new Uint8Array(0)): BudgetTask => ({
  module: BODIES,
  entry,
  input,
});

describe('budgeted runner', () => {
  it('has a default budget of 2000 ms and 512 MiB', () => {
    expect(DEFAULT_BUDGET).toEqual({ ms: 2000, mib: 512 });
  });

  it('reads the time scale from MPL_BUDGET_TIME_SCALE and multiplies only the time by it', () => {
    expect(BUDGET_TIME_SCALE).toBe(parseBudgetTimeScale(process.env.MPL_BUDGET_TIME_SCALE));
    expect(parseBudgetTimeScale(undefined)).toBe(1);
    expect(parseBudgetTimeScale('1')).toBe(1);
    expect(parseBudgetTimeScale('4')).toBe(4);
    expect(parseBudgetTimeScale('2.5')).toBe(2.5);
    for (const bad of ['', ' ', 'abc', '4x', '0', '0.5', '-4', 'NaN', 'Infinity']) {
      expect(() => parseBudgetTimeScale(bad), bad).toThrow(
        /^MPL_BUDGET_TIME_SCALE must be a finite number of at least 1/,
      );
    }
    expect(timeLimitMs(DEFAULT_BUDGET, 1)).toBe(2000);
    expect(timeLimitMs(DEFAULT_BUDGET, 4)).toBe(8000);
    expect(timeLimitMs({ ms: 5000, mib: 1536 }, 1.5)).toBe(7500);
    expect(timeLimitMs(DEFAULT_BUDGET)).toBe(DEFAULT_BUDGET.ms * BUDGET_TIME_SCALE);
  });

  it(
    'ends a run after the budget times the scale, and never earlier',
    async () => {
      // Waits 1000 ms on a timer: past a 500 ms budget, inside 4 times it.
      const wait: BudgetTask = { ...task('waits'), args: { ms: 1000 } };
      const budget: Budget = { ms: 500, mib: DEFAULT_BUDGET.mib };
      const unscaled = await runWithinBudget(wait, budget, 1);
      expect(unscaled).toMatchObject({ kind: 'killed', reason: 'time', limitMs: 500 });
      if (unscaled.kind === 'killed') {
        expect(unscaled.detail).toBe(
          'ended by the runner after 500 ms (a budget of 500 ms times the time scale 1)',
        );
      }
      const scaled = await runWithinBudget(wait, budget, 4);
      expect(scaled).toMatchObject({ kind: 'completed', limitMs: 2000, result: { waited: 1000 } });
      expect(scaled.ms).toBeGreaterThanOrEqual(1000);
      expect(scaled.ms).toBeLessThan(2000);
    },
    TIMEOUT,
  );

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
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
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
        message: 'Input exceeds the limit maxImagePixels (268435456 pixels).',
      });
    },
    TIMEOUT,
  );

  it(
    'kills a body that runs past the time budget',
    async () => {
      const outcome = await runWithinBudget(task('spins'));
      const limitMs = timeLimitMs(DEFAULT_BUDGET);
      expect(outcome).toMatchObject({ kind: 'killed', reason: 'time', limitMs });
      expect(outcome.ms).toBeGreaterThanOrEqual(limitMs);
      expect(outcome.ms).toBeLessThan(limitMs + KILL_MARGIN_MS);
    },
    TIMEOUT,
  );

  it(
    'kills a body that prints protocol-shaped lines for time, never reading them as its outcome',
    async () => {
      const outcome = await runWithinBudget(task('printsProtocolLines'));
      const limitMs = timeLimitMs(DEFAULT_BUDGET);
      expect(outcome).toMatchObject({ kind: 'killed', reason: 'time', limitMs });
      expect(outcome.ms).toBeGreaterThanOrEqual(limitMs);
      expect(outcome.ms).toBeLessThan(limitMs + KILL_MARGIN_MS);
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
      expect(outcome.ms).toBeLessThan(timeLimitMs(SMALL));
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

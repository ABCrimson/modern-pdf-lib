/**
 * Structure limits under the budgeted runner (2 s, 512 MiB): outline and structure-tree reading,
 * the growable buffer's capacity and SVG path data. Every input is built in code by
 * structure-limits.bodies.ts and must end in a result or a typed error, never in the runner's kill.
 */
import { describe, expect, it } from 'vitest';
import { runWithinBudget } from '../helpers/budget.js';
import type { BudgetOutcome, JsonValue } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/structure-limits.bodies.ts';
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 30_000;

const run = (entry: string, args?: JsonValue): Promise<BudgetOutcome> =>
  runWithinBudget({
    module: BODIES,
    entry,
    input: new Uint8Array(0),
    ...(args === undefined ? {} : { args }),
  });

describe('structure limits', () => {
  it(
    'reads each outline item once',
    async () => {
      expect(await run('outlineNextLoop')).toMatchObject({ kind: 'completed', result: [2] });
      expect(await run('outlineFirstLoop')).toMatchObject({ kind: 'completed', result: [1] });
    },
    TIMEOUT,
  );

  it(
    'reads each structure element once',
    async () => {
      expect(await run('structureSelfLoop')).toMatchObject({ kind: 'completed', result: [1] });
      expect(await run('structureMutualLoop')).toMatchObject({
        kind: 'completed',
        result: [1, 1],
      });
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError above the tree depth limit',
    async () => {
      for (const entry of ['outlineChain', 'structureChain']) {
        expect(await run(entry, 257)).toMatchObject({
          kind: 'threw',
          name: 'ResourceLimitError',
          code: 'resource-limit-exceeded',
          limit: 'maxTreeDepth',
        });
        const atLimit = await run(entry, 256);
        expect(atLimit).toMatchObject({ kind: 'completed' });
      }
    },
    TIMEOUT,
  );

  it(
    'refuses a non-finite initial capacity',
    async () => {
      for (const value of ['NaN', 'Infinity', '-Infinity']) {
        expect(await run('growableNonFinite', value)).toMatchObject({
          kind: 'threw',
          name: 'RangeError',
          message: 'GrowableBuffer: initial capacity must be a finite number',
        });
      }
    },
    TIMEOUT,
  );

  it(
    'ends path data at a number after closepath',
    async () => {
      expect(await run('svgNumberAfterClose')).toMatchObject({
        kind: 'completed',
        result: ['moveTo', 'lineTo', 'closePath'],
      });
    },
    TIMEOUT,
  );
});

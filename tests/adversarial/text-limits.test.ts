/**
 * Text limits under the budget of the runner (2000 ms, 512 MiB): ToUnicode CMaps and font cmap
 * subtables that name more mappings than the internal limits allow end in ResourceLimitError, and
 * ordinary ones complete with the right size. Every input is built in code
 * (text-limits.bodies.ts).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, runWithinBudget, timeLimitMs } from '../helpers/budget.js';
import type { BudgetOutcome, JsonValue } from '../helpers/budget.js';
import { INTERNAL_LIMITS } from '../../src/core/limits.js';
import {
  bfcharCMap,
  bfrangeCMap,
  unterminatedBfchar,
  unterminatedBfranges,
} from './text-limits.bodies.js';
import type { CmapFontSpec, CmapRange } from './text-limits.bodies.js';

const BODIES = 'tests/adversarial/text-limits.bodies.ts';
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 30_000;
const MAX_CMAP = INTERNAL_LIMITS.maxCMapMappings;
const MAX_FONT = INTERNAL_LIMITS.maxFontCmapMappings;

const run = (entry: string, input: Uint8Array, args: JsonValue = null): Promise<BudgetOutcome> =>
  runWithinBudget({ module: BODIES, entry, input, args });

const font = (spec: CmapFontSpec): Promise<BudgetOutcome> =>
  run('fontCmap', new Uint8Array(0), spec as unknown as JsonValue);

function expectLimit(outcome: BudgetOutcome, limit: string, max: number, unit: string): void {
  expect(outcome).toMatchObject({
    kind: 'threw',
    name: 'ResourceLimitError',
    code: 'resource-limit-exceeded',
    limit,
    message: `Input exceeds the internal limit ${limit} (${max} ${unit}).`,
  });
  expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
  expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
}

function expectCompleted(outcome: BudgetOutcome, result: JsonValue): void {
  expect(outcome).toMatchObject({ kind: 'completed', result });
  expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
  expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
}

describe('text limits', () => {
  describe('ToUnicode CMap', () => {
    it(
      'throws ResourceLimitError above the CMap mapping limit (64 ranges of the whole code space)',
      async () => {
        const spans = Array.from({ length: 64 }, () => [0, 0x10ffff] as const);
        expectLimit(
          await run('toUnicode', bfrangeCMap(spans)),
          'maxCMapMappings',
          MAX_CMAP,
          'mappings',
        );
      },
      TIMEOUT,
    );

    it(
      'throws ResourceLimitError after writing the limit and one more mapping',
      async () => {
        const outcome = await run(
          'toUnicode',
          bfrangeCMap([
            [0, MAX_CMAP - 1],
            [MAX_CMAP, MAX_CMAP],
          ]),
        );
        expectLimit(outcome, 'maxCMapMappings', MAX_CMAP, 'mappings');
      },
      TIMEOUT,
    );

    it(
      'throws ResourceLimitError above the CMap mapping limit (bfchar entries)',
      async () => {
        expectLimit(
          await run('toUnicode', bfcharCMap(MAX_CMAP + 1)),
          'maxCMapMappings',
          MAX_CMAP,
          'mappings',
        );
      },
      TIMEOUT,
    );

    it(
      'completes a CMap that writes exactly the mapping limit',
      async () => {
        expectCompleted(await run('toUnicode', bfrangeCMap([[0, MAX_CMAP - 1]])), MAX_CMAP);
      },
      TIMEOUT,
    );

    it(
      'completes an ordinary CMap with the right size',
      async () => {
        expectCompleted(await run('toUnicode', bfcharCMap(526)), 526);
      },
      TIMEOUT,
    );
  });

  describe('ToUnicode CMap sections without an end marker', () => {
    it(
      'completes a bfchar section that never ends (6,000 spaces) with no mapping',
      async () => {
        expectCompleted(await run('toUnicode', unterminatedBfchar(6000)), 0);
      },
      TIMEOUT,
    );

    it(
      'completes 40,000 bfrange sections that never end with no mapping',
      async () => {
        expectCompleted(await run('toUnicode', unterminatedBfranges(40_000)), 0);
      },
      TIMEOUT,
    );
  });

  describe('font cmap', () => {
    it(
      'throws ResourceLimitError for two format 12 groups of 2^24 codes',
      async () => {
        const wide: CmapRange = [0, 2 ** 24 - 1, 1];
        expectLimit(
          await font({ format: 12, numGlyphs: 0xffff, ranges: [wide, wide] }),
          'maxFontCmapMappings',
          MAX_FONT,
          'entries',
        );
      },
      TIMEOUT,
    );

    it(
      'throws ResourceLimitError for format 4 segments that name more codes than the limit',
      async () => {
        const segments: CmapRange[] = Array.from({ length: 18 }, () => [1, 0xfffe, 1]);
        expectLimit(
          await font({ format: 4, numGlyphs: 0xffff, ranges: segments }),
          'maxFontCmapMappings',
          MAX_FONT,
          'entries',
        );
      },
      TIMEOUT,
    );

    it(
      'completes a conformant format 12 subtable with the right size',
      async () => {
        expectCompleted(await font({ format: 12, numGlyphs: 600, ranges: [[0x20, 0x7e, 1]] }), 95);
      },
      TIMEOUT,
    );

    it(
      'completes a conformant format 4 subtable with the right size',
      async () => {
        expectCompleted(await font({ format: 4, numGlyphs: 600, ranges: [[0x20, 0x7e, 1]] }), 95);
      },
      TIMEOUT,
    );
  });
});

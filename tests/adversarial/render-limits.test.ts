/**
 * Adversarial pair of the page interpreter: Form XObjects that call themselves, each other or a
 * long chain of distinct forms end inside the budget (2 s, 512 MiB of resident-memory growth).
 * A form on the current invocation path is not entered again; the operators run inside forms
 * are budgeted (each operator counts one, plus its operand elements), and passing the budget
 * throws ResourceLimitError, also while one huge form is still being parsed. A form whose data
 * cannot be decoded is decoded once per call. Images above the size limits are skipped.
 */
import { describe, expect, it } from 'vitest';
import {
  AT_LIMIT_BUDGET,
  DEFAULT_BUDGET,
  runWithinBudget,
  timeLimitMs,
} from '../helpers/budget.js';
import { INTERNAL_LIMITS } from '../../src/internal/limits.js';

const BODIES = 'tests/adversarial/render-limits.bodies.ts';
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 60_000;

describe('page interpretation under the budget', () => {
  it.each([2, 4, 10])(
    'interprets a form that calls itself %i times once per recursion path',
    async (calls) => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'selfInvoking',
        input: new Uint8Array(0),
        args: { calls },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { items: 1 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'interprets two forms that call each other once per recursion path (the caller is skipped)',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'mutuallyInvoking',
        input: new Uint8Array(0),
        args: { calls: 10 },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { items: 11 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError above the form operator limit for 12 distinct forms of 10 calls each',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'distinctChain',
        input: new Uint8Array(0),
        args: { depth: 12, calls: 10 },
      });
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        code: 'resource-limit-exceeded',
        limit: 'maxFormOperators',
        message: `Input exceeds the internal limit maxFormOperators (${INTERNAL_LIMITS.maxFormOperators} operators).`,
      });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'interprets a chain of distinct forms that stays under the form operator limit',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'distinctChain',
        input: new Uint8Array(0),
        args: { depth: 6, calls: 10 },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { items: 100_000 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'extractFonts throws ResourceLimitError raised while decoding a font file',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'fontFileUnreadable',
        input: new Uint8Array(0),
        args: { limit: true },
      });
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        limit: 'maxDecodedStreamBytes',
      });
    },
    TIMEOUT,
  );

  it(
    'extractFonts skips a font file that cannot be decoded for another reason',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'fontFileUnreadable',
        input: new Uint8Array(0),
        args: { limit: false },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { fonts: 0 } });
    },
    TIMEOUT,
  );

  it.each(['limit', 'unsupported', 'other'])(
    'extractImages skips an image whose decoding fails with a %s error',
    async (kind) => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'imageUnreadable',
        input: new Uint8Array(0),
        args: { kind },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { images: 0 } });
    },
    TIMEOUT,
  );

  it.each([
    ['tjFanout', 'tjFanout', { depth: 7, calls: 8, n: 50 }],
    ['longTj', 'longTj', { depth: 7, calls: 8, n: 100_000 }],
    ['hugeOnce', 'hugeOnce', { ops: 16 * 1024 * 1024 }],
    ['empty arrays then an operator', 'operandForm', { shape: 'arraysThenOperator' }],
    ['empty arrays and no operator', 'operandForm', { shape: 'arraysOnly' }],
    ['one array of empty arrays', 'operandForm', { shape: 'oneArray' }],
    ['numbers and no operator', 'operandForm', { shape: 'numbersOnly' }],
  ])(
    'throws ResourceLimitError for the form input %s before it leaves the budget',
    async (_label, entry, args) => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry,
        input: new Uint8Array(0),
        args,
      });
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        limit: 'maxFormOperators',
      });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'interprets a form just under the operator limit within the at-limit budget',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'hugeOnce',
          input: new Uint8Array(0),
          args: { ops: INTERNAL_LIMITS.maxFormOperators - 16 },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { items: 0 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(AT_LIMIT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(AT_LIMIT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'decodes a form that cannot be decoded once for 40 calls',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'failingRepeat',
        input: new Uint8Array(0),
        args: { mib: 32, k: 40 },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { items: 0 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'extractImages skips an Indexed image above the size limit that has one byte of data',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'indexedImage',
        input: new Uint8Array(0),
        args: { w: 16_384, data: 1 },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { images: 0 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'extractImages decodes an Indexed image well under the size limit',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'indexedImage',
        input: new Uint8Array(0),
        args: { w: 64, data: 64 * 64 },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { images: 1 } });
    },
    TIMEOUT,
  );

  it(
    'extractImages decodes a DeviceGray image exactly at the pixel and byte limits within the at-limit budget',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'grayImage',
          input: new Uint8Array(0),
          args: { w: Math.sqrt(INTERNAL_LIMITS.maxImagePixels) },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { images: 1 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(AT_LIMIT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(AT_LIMIT_BUDGET.mib);
    },
    TIMEOUT,
  );
});

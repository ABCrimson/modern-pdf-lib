/**
 * Load-path limits under the budgeted runner: a limit error from the load is not swallowed by the
 * encryption inspector, the threat scanner or auto-tagging; a page's content streams are bounded in
 * total; an object stream's header is read lazily; the page tree has a depth limit. Inputs above a
 * limit end in their error within DEFAULT_BUDGET (2 s, 512 MiB), except the page whose content
 * streams pass the limit together: the streams before the one that crosses it are decoded and held
 * first, so that case and the controls at the limit run within AT_LIMIT_BUDGET (5 s, 1536 MiB).
 * Every input is built in code by load-limits.bodies.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { AT_LIMIT_BUDGET, DEFAULT_BUDGET, runWithinBudget } from '../helpers/budget.js';
import type { Budget, BudgetOutcome } from '../helpers/budget.js';
import {
  encryptedFileWithXrefStream,
  objectStreamWithLongHeader,
  openActionFileWithSecondObjectStream,
  pageTreeChain,
  pageWithFormChain,
  pageWithRepeatedContent,
  zlibOf,
} from './load-limits.bodies.js';

const BODIES = 'tests/adversarial/load-limits.bodies.ts';
const MIB = 1024 * 1024;
// Building the inputs and the runner's start-up come before the budget clock.
const TIMEOUT = 120_000;

const run = (
  entry: string,
  input: Uint8Array,
  budget: Budget = DEFAULT_BUDGET,
): Promise<BudgetOutcome> => runWithinBudget({ module: BODIES, entry, input }, budget);

const LIMIT = (limit: string) =>
  ({ kind: 'threw', name: 'ResourceLimitError', code: 'resource-limit-exceeded', limit }) as const;

let bomb: Uint8Array;
let small: Uint8Array;

beforeAll(async () => {
  // 257 MiB of zero bytes (above maxDecodedStreamBytes) and 1 KiB of them.
  bomb = await zlibOf(new Uint8Array(0), 257, 0);
  small = await zlibOf(new Uint8Array(1024), 0, 0);
}, TIMEOUT);

describe('limit errors on the load path are not swallowed', () => {
  it(
    'inspectEncryption throws when the cross-reference stream decodes above the limit',
    async () => {
      const file = encryptedFileWithXrefStream(bomb);
      expect(file.length).toBeLessThan(2 * MIB);
      expect(await run('inspectEntry', file)).toMatchObject(LIMIT('maxDecodedStreamBytes'));
      expect(await run('inspectEntry', encryptedFileWithXrefStream(small))).toMatchObject({
        kind: 'completed',
        result: { encrypted: true },
      });
    },
    TIMEOUT,
  );

  it(
    'scanPdfThreats throws when an object stream decodes above the limit',
    async () => {
      const file = openActionFileWithSecondObjectStream(bomb);
      expect(file.length).toBeLessThan(2 * MIB);
      expect(await run('scanEntry', file)).toMatchObject(LIMIT('maxDecodedStreamBytes'));
      const ordinary = await run('scanEntry', openActionFileWithSecondObjectStream(small));
      expect(ordinary).toMatchObject({ kind: 'completed', result: { riskLevel: 'medium' } });
    },
    TIMEOUT,
  );

  it(
    'autoTagPage throws when the page interpretation passes the form operator limit',
    async () => {
      expect(await run('autoTagEntry', pageWithFormChain(12, 4))).toMatchObject(
        LIMIT('maxFormOperators'),
      );
      expect(await run('autoTagEntry', pageWithFormChain(0, 0))).toMatchObject({
        kind: 'completed',
        result: { paragraphs: 1, elements: 1 },
      });
    },
    TIMEOUT,
  );
});

describe('page content streams are bounded in total', () => {
  it(
    'throws when the content streams of a page decode above the limit together',
    async () => {
      const stream = await zlibOf(new Uint8Array(0), 32, 0x20);
      const file = pageWithRepeatedContent(stream, 9);
      expect(file.length).toBeLessThan(2 * MIB);
      // The error comes after the streams before it have been decoded: the cost of reaching the
      // limit is an at-limit cost (about 580 MiB here), so the at-limit budget applies.
      expect(await run('contentLengthEntry', file, AT_LIMIT_BUDGET)).toMatchObject(
        LIMIT('maxDecodedStreamBytes'),
      );
    },
    TIMEOUT,
  );

  it(
    'completes for content streams that together stay below the limit',
    async () => {
      const stream = await zlibOf(new Uint8Array(0), 63, 0x20);
      const outcome = await run(
        'contentLengthEntry',
        pageWithRepeatedContent(stream, 4),
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 4 * (63 * MIB + 1) } });
    },
    TIMEOUT,
  );

  it(
    'completes for one content stream that decodes to exactly the limit',
    async () => {
      const stream = await zlibOf(new Uint8Array(0), 256, 0x20);
      const outcome = await run(
        'contentLengthEntry',
        pageWithRepeatedContent(stream, 1),
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 256 * MIB + 1 } });
    },
    TIMEOUT,
  );
});

describe('an object stream header is read lazily', () => {
  it(
    'loads a file whose /N is 3 and whose header is 64 MiB long',
    async () => {
      const file = await objectStreamWithLongHeader(64 * MIB);
      expect(file.length).toBeLessThan(MIB);
      expect(await run('pageCountEntry', file)).toMatchObject({
        kind: 'completed',
        result: { pages: 1 },
      });
    },
    TIMEOUT,
  );
});

describe('the page tree has a depth limit', () => {
  it(
    'throws above 256 levels and loads at 256 levels',
    async () => {
      expect(await run('pageCountEntry', pageTreeChain(257))).toMatchObject(LIMIT('maxTreeDepth'));
      expect(await run('pageCountEntry', pageTreeChain(256))).toMatchObject({
        kind: 'completed',
        result: { pages: 1 },
      });
    },
    TIMEOUT,
  );

  it(
    'ends in a typed error for a tree 50,000 levels deep, not a stack overflow',
    async () => {
      expect(await run('pageCountEntry', pageTreeChain(50_000))).toMatchObject(
        LIMIT('maxTreeDepth'),
      );
    },
    TIMEOUT,
  );
});

/**
 * Stream /Length recovery under the budgeted runner. Recovery searches for `endstream` and
 * `endobj`; the search is linear in the file, so no input ends in more than DEFAULT_BUDGET
 * (2 s, 512 MiB): 50,000 streams with a wrong /Length and no terminating keyword (direct and
 * indirect /Length), 64 MiB of `endstream` lines behind one damaged stream, and a /Length chain
 * through nested object streams. A /Length held in an object stream that decodes above
 * maxDecodedStreamBytes ends the load in ResourceLimitError. Every input is built in code by
 * stream-length.bodies.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, runWithinBudget } from '../helpers/budget.js';
import type { BudgetOutcome } from '../helpers/budget.js';
import {
  damagedStreamBeforeManyKeywords,
  lengthInFlateObjectStream,
  nestedObjectStreamLengths,
  streamsSharingABrokenLength,
  unterminatedStreams,
  zlibOf,
} from './stream-length.bodies.js';

const BODIES = 'tests/adversarial/stream-length.bodies.ts';
const MIB = 1024 * 1024;
// Building the inputs and the runner's start-up come before the budget clock.
const TIMEOUT = 120_000;

const load = (input: Uint8Array): Promise<BudgetOutcome> =>
  runWithinBudget({ module: BODIES, entry: 'loadEntry', input }, DEFAULT_BUDGET);

/** The load ends by itself: a result, or an error that is not a budget kill. */
function expectEnded(outcome: BudgetOutcome): void {
  expect(outcome.kind).not.toBe('killed');
  if (outcome.kind === 'threw') expect(outcome.name).toBe('PdfParseError');
}

describe('wrong /Length: the search is linear in the file', () => {
  it(
    '50,000 streams with a direct /Length and no endstream or endobj',
    async () => {
      expectEnded(await load(unterminatedStreams(50_000, false)));
    },
    TIMEOUT,
  );

  it(
    '50,000 streams whose /Length is a reference to the next stream',
    async () => {
      expectEnded(await load(unterminatedStreams(50_000, true)));
    },
    TIMEOUT,
  );

  it(
    '2,000 streams whose /Length is one 500 KB dictionary that never closes',
    async () => {
      // Object 4 does not parse; trying it once per stream would cost 2,000 times its length.
      expectEnded(await load(streamsSharingABrokenLength(2000, 500_000)));
    },
    TIMEOUT,
  );

  it(
    '64 MiB of endstream lines behind one damaged stream recovers the page',
    async () => {
      const outcome = await load(damagedStreamBeforeManyKeywords(64 * MIB));
      expect(outcome).toMatchObject({ kind: 'completed', result: { pages: 1 } });
    },
    TIMEOUT,
  );

  it(
    'a /Length chain through 500 nested object streams ends without a stack error',
    async () => {
      const outcome = await load(nestedObjectStreamLengths(500));
      expect(outcome).toMatchObject({ kind: 'completed', result: { pages: 1 } });
    },
    TIMEOUT,
  );
});

describe('a limit error while resolving /Length is not swallowed', () => {
  let bomb: Uint8Array;
  let small: Uint8Array;

  beforeAll(async () => {
    // "6 0 43" then 257 MiB of zero bytes (above maxDecodedStreamBytes), and 1 KiB of them.
    const head = Uint8Array.from('6 0 43', (c) => c.charCodeAt(0));
    bomb = await zlibOf(head, 257, 0);
    small = await zlibOf(head, 0, 0);
  }, TIMEOUT);

  it(
    'raises the limit error while resolving the /Length of the stream, and loads the small twin',
    async () => {
      // The load also reads object 6 for itself and would end in the same error, so the error
      // must come from the /Length path: that is where the entry looks.
      expect(
        await runWithinBudget(
          { module: BODIES, entry: 'loadLimitEntry', input: lengthInFlateObjectStream(bomb) },
          DEFAULT_BUDGET,
        ),
      ).toMatchObject({
        kind: 'completed',
        result: { limit: 'maxDecodedStreamBytes', inLengthPath: true },
      });
      expect(await load(lengthInFlateObjectStream(small))).toMatchObject({
        kind: 'completed',
        result: { pages: 1 },
      });
    },
    TIMEOUT,
  );
});

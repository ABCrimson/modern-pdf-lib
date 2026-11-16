/**
 * Adversarial pair of the stream filters: output past the decoded-size limit ends in
 * `ResourceLimitError`, predictor parameters outside the accepted range end in the predictor's
 * parse error, and ordinary large output completes. Each case runs under the budgeted runner:
 * input above a limit and malformed input end in their error within DEFAULT_BUDGET (2 s, 512 MiB
 * of resident-memory growth), and input at or just under a limit completes within AT_LIMIT_BUDGET
 * (5 s, 1536 MiB). Inputs larger than a few hundred KiB are built here and handed to the entry as
 * its bytes.
 */
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { INTERNAL_LIMITS } from '../../src/internal/limits.js';
import {
  AT_LIMIT_BUDGET,
  DEFAULT_BUDGET,
  runWithinBudget,
  timeLimitMs,
} from '../helpers/budget.js';
import type { BudgetOutcome, JsonValue } from '../helpers/budget.js';
import { lzwEncode } from './filter-limits.bodies.js';

const BODIES = 'tests/adversarial/filter-limits.bodies.ts';
const MIB = 1024 * 1024;
const LIMIT = INTERNAL_LIMITS.maxDecodedStreamBytes;
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 60_000;

const run = (
  entry: string,
  args: JsonValue,
  input: Uint8Array = new Uint8Array(0),
): Promise<BudgetOutcome> => runWithinBudget({ module: BODIES, entry, input, args });

const expectInBudget = (outcome: BudgetOutcome): void => {
  expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
  expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
};

const LIMIT_ERROR = {
  kind: 'threw',
  name: 'ResourceLimitError',
  code: 'resource-limit-exceeded',
  limit: 'maxDecodedStreamBytes',
  message: `Input exceeds the limit maxDecodedStreamBytes (${LIMIT} bytes).`,
} as const;

/** zlib data of `n` zero bytes. */
function zlibOfZeros(n: number): Uint8Array {
  return deflateSync(new Uint8Array(n), { level: 9 });
}

/** The LZW code stream of 8 MiB of zeros (the table is full after the first 7.4 MB), then `tail` more codes of 3839 bytes. */
function lzwOfZeros(tail: number): Uint8Array {
  return lzwEncode(new Uint8Array(8 * MIB), { tail: { code: 4095, count: tail } });
}

describe('LZWDecode under the budget', () => {
  it(
    'decodes 8 MiB of zeros from a stream that never clears its full table',
    async () => {
      const outcome = await run('decodeOne', { filter: 'LZWDecode' }, lzwOfZeros(0));
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 8 * MIB } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError when the output passes the decoded-size limit',
    async () => {
      const outcome = await run('decodeOne', { filter: 'LZWDecode' }, lzwOfZeros(75_000));
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );
});

describe('RunLengthDecode under the budget', () => {
  const PAIRS_AT_LIMIT = LIMIT / 128;

  it(
    'decodes output of exactly the decoded-size limit',
    async () => {
      const outcome = await run('runLengthRuns', { pairs: PAIRS_AT_LIMIT });
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: LIMIT } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError for one run more than the limit',
    async () => {
      const outcome = await run('runLengthRuns', { pairs: PAIRS_AT_LIMIT + 1 });
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );
});

describe('ASCII filters under the budget', () => {
  it(
    'decodes 64 MiB of ASCIIHex to 32 MiB',
    async () => {
      const outcome = await run('asciiHexPairs', { pairs: 32 * MIB });
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 32 * MIB } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'decodes ASCII85 output of exactly the decoded-size limit',
    async () => {
      const outcome = await run('ascii85Zeros', { groups: LIMIT / 4 });
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: LIMIT } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError for ASCII85 output one group past the limit',
    async () => {
      const outcome = await run('ascii85Zeros', { groups: LIMIT / 4 + 1 });
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );
});

describe('chains under the budget', () => {
  it(
    'throws ResourceLimitError when the second FlateDecode of a chain passes the limit',
    async () => {
      // 300 MiB of zeros inside two zlib layers: the first stage gives about 300 KiB, the second
      // would give 300 MiB. This case also needs the cap in inflateFlate (src/codecs/internal/pdfFlate.ts).
      const twice = deflateSync(zlibOfZeros(300 * MIB), { level: 9 });
      const outcome = await run('decodeChain', { filters: ['FlateDecode', 'FlateDecode'] }, twice);
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );
});

describe('predictor parameters under the budget', () => {
  const MESSAGE = (c: number, k: number, b: number): string =>
    `Predictor: unsupported decode parameters (/Columns ${c}, /Colors ${k}, /BitsPerComponent ${b})`;
  const CASES: readonly (readonly [string, Record<string, number>, string])[] = [
    ['/Columns 0 with /Predictor 2', { '/Predictor': 2, '/Columns': 0 }, MESSAGE(0, 1, 8)],
    [
      '/Colors 0 with /Predictor 2',
      { '/Predictor': 2, '/Columns': 4, '/Colors': 0 },
      MESSAGE(4, 0, 8),
    ],
    [
      '/BitsPerComponent 0 with /Predictor 2',
      { '/Predictor': 2, '/Columns': 4, '/BitsPerComponent': 0 },
      MESSAGE(4, 1, 0),
    ],
    ['/Columns 0 with /Predictor 12', { '/Predictor': 12, '/Columns': 0 }, MESSAGE(0, 1, 8)],
  ];

  for (const path of ['stream', 'flateOnly'] as const) {
    for (const [title, parms, message] of CASES) {
      it(
        `throws the predictor error for ${title} (${path})`,
        async () => {
          const outcome = await run('predictorOnZeros', { path, ...parms });
          expect(outcome).toMatchObject({
            kind: 'threw',
            name: 'UnsupportedFeatureError',
            code: 'unsupported-feature',
            message,
          });
          expectInBudget(outcome);
        },
        TIMEOUT,
      );
    }
  }

  it(
    'throws ResourceLimitError for a PNG row longer than the decoded-size limit',
    async () => {
      const outcome = await run('predictorOnZeros', {
        path: 'stream',
        '/Predictor': 12,
        '/Columns': 2_147_483_647,
      });
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'decodes a PNG row of exactly the limit from too little data to hold one row, without allocating it',
    async () => {
      const outcome = await run('predictorOnZeros', {
        path: 'stream',
        '/Predictor': 12,
        '/Columns': LIMIT,
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 0 } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );
});

/** The check of {@link expectInBudget} against AT_LIMIT_BUDGET, for an input at or just under a limit. */
const expectInAtLimitBudget = (outcome: BudgetOutcome): void => {
  expect(outcome.ms).toBeLessThan(timeLimitMs(AT_LIMIT_BUDGET));
  expect(outcome.mib).toBeLessThanOrEqual(AT_LIMIT_BUDGET.mib);
};

/** LZW codes that decode to as many bytes as fit under the limit: 8 MiB of zeros, then full-table codes. */
function lzwNearLimit(): Uint8Array {
  return lzwOfZeros(Math.floor((LIMIT - 8 * MIB) / 3839));
}

/** Growth of an at-limit LZW decode whose predictor works in place: about 300 MiB measured; a copy of the decoded buffer for the predictor adds 256 MiB. */
const IN_PLACE_MIB = 416;

describe('PNG predictors on large output', () => {
  const PNG_ONE_COLUMN = [{ '/Predictor': 12, '/Columns': 1 }];

  it(
    'undoes /Predictor 12 with /Columns 1 over 128 MiB (64 Mi rows) inside the budget',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'decodeWithParms',
          input: zlibOfZeros(128 * MIB),
          args: { filters: ['FlateDecode'], parms: PNG_ONE_COLUMN },
        },
        DEFAULT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 64 * MIB } });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'undoes /Predictor 15 with /Columns 1000 over 128 MiB inside the budget',
    async () => {
      const outcome = await run(
        'decodeWithParms',
        { filters: ['FlateDecode'], parms: [{ '/Predictor': 15, '/Columns': 1000 }] },
        zlibOfZeros(128 * MIB),
      );
      expect(outcome).toMatchObject({ kind: 'completed' });
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'at the limit: undoes /Predictor 12 with /Columns 1 over exactly 256 MiB of zeros',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'decodeWithParms',
          input: zlibOfZeros(LIMIT),
          args: { filters: ['FlateDecode'], parms: PNG_ONE_COLUMN },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: LIMIT / 2 } });
      expectInAtLimitBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'at the limit: undoes /Predictor 12 with /Columns 1 after an LZW decode near the limit',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'decodeWithParms',
          input: lzwNearLimit(),
          args: { filters: ['LZWDecode'], parms: PNG_ONE_COLUMN },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed' });
      expectInAtLimitBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'at the limit: undoes /Predictor 15 with /Columns 1000 after an LZW decode near the limit',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'decodeWithParms',
          input: lzwNearLimit(),
          args: { filters: ['LZWDecode'], parms: [{ '/Predictor': 15, '/Columns': 1000 }] },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed' });
      expectInAtLimitBudget(outcome);
      expect(outcome.mib).toBeLessThan(IN_PLACE_MIB);
    },
    TIMEOUT,
  );
});

describe('TIFF predictor on large output', () => {
  const SAMPLE_LIMIT = INTERNAL_LIMITS.maxPredictorSamples;
  const SAMPLES_ERROR = {
    kind: 'threw',
    name: 'ResourceLimitError',
    code: 'resource-limit-exceeded',
    limit: 'maxPredictorSamples',
    message: `Input exceeds the limit maxPredictorSamples (${SAMPLE_LIMIT} samples).`,
  } as const;

  it(
    'throws ResourceLimitError for 1-bit samples past the sample limit (64 MiB at /Columns 1000)',
    async () => {
      const outcome = await run(
        'decodeWithParms',
        {
          filters: ['FlateDecode'],
          parms: [{ '/Predictor': 2, '/Columns': 1000, '/BitsPerComponent': 1 }],
        },
        zlibOfZeros(64 * MIB),
      );
      expect(outcome).toMatchObject(SAMPLES_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError for 4-bit samples past the sample limit (136 MiB at /Columns 1000)',
    async () => {
      const outcome = await run(
        'decodeWithParms',
        {
          filters: ['FlateDecode'],
          parms: [{ '/Predictor': 2, '/Columns': 1000, '/BitsPerComponent': 4 }],
        },
        zlibOfZeros(136 * MIB),
      );
      expect(outcome).toMatchObject(SAMPLES_ERROR);
      expectInBudget(outcome);
    },
    TIMEOUT,
  );

  for (const [bpc, mib] of [
    [1, 32],
    [2, 64],
  ] as const) {
    it(
      `at the limit: undoes ${bpc}-bit samples just under the sample limit (${mib} MiB at /Columns 1000)`,
      async () => {
        const outcome = await runWithinBudget(
          {
            module: BODIES,
            entry: 'decodeWithParms',
            input: zlibOfZeros(mib * MIB),
            args: {
              filters: ['FlateDecode'],
              parms: [{ '/Predictor': 2, '/Columns': 1000, '/BitsPerComponent': bpc }],
            },
          },
          AT_LIMIT_BUDGET,
        );
        expect(outcome).toMatchObject({ kind: 'completed', result: { length: mib * MIB } });
        expectInAtLimitBudget(outcome);
      },
      TIMEOUT,
    );
  }

  it(
    'at the limit: undoes /Predictor 2 with /Columns 1 after an LZW decode near the limit',
    async () => {
      const outcome = await runWithinBudget(
        {
          module: BODIES,
          entry: 'decodeWithParms',
          input: lzwNearLimit(),
          args: { filters: ['LZWDecode'], parms: [{ '/Predictor': 2, '/Columns': 1 }] },
        },
        AT_LIMIT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed' });
      expectInAtLimitBudget(outcome);
      expect(outcome.mib).toBeLessThan(IN_PLACE_MIB);
    },
    TIMEOUT,
  );
});

/**
 * Adversarial pair of the streaming parser: ordinary large input fed in small chunks costs time
 * linear in its size, and input past `maxBufferSize` is refused. Each case runs under the budgeted
 * runner (2 s, 512 MiB of resident-memory growth).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, runWithinBudget, timeLimitMs } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/streaming-limits.bodies.ts';
const MIB = 1024 * 1024;
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 60_000;

describe('streaming parser under the budget', () => {
  it(
    'buffers 64 MiB fed in 4 KiB chunks within the default budget',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'feedFiller',
        input: new Uint8Array(0),
        args: { mib: 64, chunk: 4096, maxBufferSize: 64 * MIB },
      });
      expect(outcome).toMatchObject({ kind: 'completed', result: { read: 64 * MIB } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
    },
    TIMEOUT,
  );

  it(
    'refuses the chunk that passes maxBufferSize with its parse error, in time',
    async () => {
      const outcome = await runWithinBudget({
        module: BODIES,
        entry: 'feedPastCap',
        input: new Uint8Array(0),
        args: { mib: 16, chunk: 4096 },
      });
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'PdfParseError',
        message: expect.stringContaining(`maximum size of ${16 * MIB} bytes`),
      });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
    },
    TIMEOUT,
  );
});

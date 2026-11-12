/**
 * Decoded-size limit of the Flate paths, under the budgeted runner. Every input is built here with
 * node:zlib. An input above the limit ends in ResourceLimitError (`maxDecodedStreamBytes`,
 * 256 MiB) within DEFAULT_BUDGET (2 s, 512 MiB of resident memory growth). The two controls
 * exactly at the limit decode to the right length within AT_LIMIT_BUDGET (5 s, 1536 MiB); the
 * control with no final block just under the limit ends by itself within AT_LIMIT_BUDGET. The
 * 8 MiB control and the input with a 1 MiB tail decode to the right length within
 * DEFAULT_BUDGET, the tail input below 384 MiB.
 */
import { constants, createDeflate, deflateSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { AT_LIMIT_BUDGET, DEFAULT_BUDGET, runWithinBudget } from '../helpers/budget.js';
import type { BudgetOutcome } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/flate-limits.bodies.ts';
const MIB = 1024 * 1024;
// Building a 1 GiB input and the runner's start-up come before the budget clock.
const TIMEOUT = 60_000;

/** zlib data (level 1) of `mib` MiB of zero bytes, written to a deflate stream one MiB at a time. */
async function zlibOfZeros(mib: number): Promise<Uint8Array> {
  const deflater = createDeflate({ level: 1 });
  const parts: Uint8Array[] = [];
  deflater.on('data', (part: Uint8Array) => parts.push(part));
  const ended = new Promise<void>((done) => deflater.on('end', done));
  const zeros = new Uint8Array(MIB);
  for (let i = 0; i < mib; i++) {
    if (!deflater.write(zeros)) await new Promise((done) => deflater.once('drain', done));
  }
  deflater.end();
  await ended;
  return concat(...parts);
}

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/** A one-page PDF with a classic cross-reference table whose content stream holds `stream`. */
function pdfWithContentStream(stream: Uint8Array): Uint8Array {
  const pieces: Uint8Array[] = [latin1('%PDF-1.7\n')];
  const offsets: number[] = [];
  let pos = pieces[0]!.length;
  const add = (piece: Uint8Array): void => {
    pieces.push(piece);
    pos += piece.length;
  };
  const object = (text: string): void => {
    offsets.push(pos);
    add(latin1(text));
  };
  object('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  object('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  object(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n',
  );
  offsets.push(pos);
  add(latin1(`4 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`));
  add(stream);
  add(latin1('\nendstream\nendobj\n'));
  const xref = pos;
  let table = `xref\n0 5\n0000000000 65535 f \n`;
  for (const offset of offsets) table += `${String(offset).padStart(10, '0')} 00000 n \n`;
  add(latin1(`${table}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const piece of pieces) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

const LIMIT_ERROR = {
  kind: 'threw',
  name: 'ResourceLimitError',
  code: 'resource-limit-exceeded',
  limit: 'maxDecodedStreamBytes',
  message: 'Input exceeds the internal limit maxDecodedStreamBytes (268435456 bytes).',
} as const;

const run = (entry: string, input: Uint8Array, budget = DEFAULT_BUDGET): Promise<BudgetOutcome> =>
  runWithinBudget({ module: BODIES, entry, input }, budget);

const LIMIT = 256 * MIB;

/** The concatenation of `parts`. */
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

describe('flate limits', () => {
  let big: Uint8Array;
  let nested: Uint8Array;
  let small: Uint8Array;

  beforeAll(async () => {
    big = await zlibOfZeros(1024);
    nested = new Uint8Array(deflateSync(big, { level: 9 }));
    small = await zlibOfZeros(8);
  }, TIMEOUT);

  it(
    'decodes 8 MiB through inflateFlate',
    async () => {
      expect(await run('inflateFlateEntry', small)).toMatchObject({
        kind: 'completed',
        result: { length: 8 * MIB },
      });
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError from inflateFlate above the decoded-size limit',
    async () => {
      const outcome = await run('inflateFlateEntry', big);
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError from inflateRaw above the decoded-size limit',
    async () => {
      const outcome = await run('inflateRawEntry', big);
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError from decodeFlateOnly above the decoded-size limit',
    async () => {
      const outcome = await run('decodeFlateOnlyEntry', big);
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'applies the limit to the second filter of a chain',
    async () => {
      const outcome = await run('decodeChainEntry', nested);
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError when a loaded page stream decodes above the limit',
    async () => {
      const outcome = await run('loadedPageStreamEntry', pdfWithContentStream(big));
      expect(outcome).toMatchObject(LIMIT_ERROR);
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
    },
    TIMEOUT,
  );

  it(
    'decodes zlib data followed by a 1 MiB tail without reading the data twice',
    async () => {
      const outcome = await run(
        'inflateFlateEntry',
        concat(await zlibOfZeros(100), new Uint8Array(MIB).fill(0xab)),
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 100 * MIB } });
      expect(outcome.mib).toBeLessThan(384);
    },
    TIMEOUT,
  );

  describe('at the limit', () => {
    it(
      'decodes exactly 256 MiB through inflateFlate',
      async () => {
        const outcome = await run('inflateFlateEntry', await zlibOfZeros(256), AT_LIMIT_BUDGET);
        expect(outcome).toMatchObject({ kind: 'completed', result: { length: LIMIT } });
        expect(outcome.ms).toBeLessThan(AT_LIMIT_BUDGET.ms);
        expect(outcome.mib).toBeLessThan(AT_LIMIT_BUDGET.mib);
      },
      TIMEOUT,
    );

    it(
      'decodes a loaded page stream of exactly 256 MiB',
      async () => {
        const outcome = await run(
          'loadedPageStreamEntry',
          pdfWithContentStream(await zlibOfZeros(256)),
          AT_LIMIT_BUDGET,
        );
        // getContentStream ends each content stream with a newline.
        expect(outcome).toMatchObject({ kind: 'completed', result: { length: LIMIT + 1 } });
        expect(outcome.ms).toBeLessThan(AT_LIMIT_BUDGET.ms);
        expect(outcome.mib).toBeLessThan(AT_LIMIT_BUDGET.mib);
      },
      TIMEOUT,
    );

    it(
      'ends within the budget for data with no final block after 255 MiB and a tail of empty stored blocks',
      async () => {
        // The sync flush ends the data with an empty stored block that is not final; the tail adds
        // 144 KiB more of them, and no block ever carries the final bit.
        const open = new Uint8Array(
          deflateSync(new Uint8Array(255 * MIB), {
            level: 1,
            finishFlush: constants.Z_SYNC_FLUSH,
          }),
        );
        const tail = new Uint8Array(Math.floor((144 * 1024) / 5) * 5);
        for (let at = 3; at < tail.length; at += 5) tail.set([0xff, 0xff], at);
        const outcome = await run('inflateFlateEntry', concat(open, tail), AT_LIMIT_BUDGET);
        // The zlib read is refused for the missing final block; the read of the same bytes as raw
        // DEFLATE then ends in whatever those bytes happen to decode to. The control asserts that
        // the call ends by itself, not what it returns.
        expect(['completed', 'threw']).toContain(outcome.kind);
        expect(outcome.ms).toBeLessThan(AT_LIMIT_BUDGET.ms);
        expect(outcome.mib).toBeLessThan(AT_LIMIT_BUDGET.mib);
      },
      TIMEOUT,
    );
  });
});

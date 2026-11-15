/**
 * Adversarial pair of the formats this release does not decode (JPEG 2000, JBIG2, lossy WebP).
 * Every input is built here; each ends in UnsupportedFilterError at once, inside the budget (2 s,
 * 512 MiB of resident-memory growth), because the entry throws before it reads a header field.
 * A lossless WebP whose header asks for more than the internal image limits allow ends in
 * ResourceLimitError (`maxImageBytes`) before any buffer is sized from it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, runWithinBudget, timeLimitMs } from '../helpers/budget.js';
import type { BudgetOutcome, JsonValue } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/unsupported-filters.bodies.ts';
// Start-up (child process, worker, tsx import) comes before the budget clock.
const TIMEOUT = 60_000;

const u16 = (v: number): number[] => [(v >>> 8) & 0xff, v & 0xff];
const u32 = (v: number): number[] => [
  (v >>> 24) & 0xff,
  (v >>> 16) & 0xff,
  (v >>> 8) & 0xff,
  v & 0xff,
];
const latin1 = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));

/** SOC and a SIZ marker segment for `width` x `height`, `csiz` components in the field, `listed` Ssiz triples. */
function codestream(width: number, height: number, csiz: number, listed: number): Uint8Array {
  const lsiz = 38 + 3 * listed;
  return Uint8Array.from([
    0xff,
    0x4f,
    0xff,
    0x51,
    ...u16(lsiz),
    ...u16(0),
    ...u32(width),
    ...u32(height),
    ...u32(0),
    ...u32(0),
    ...u32(width),
    ...u32(height),
    ...u32(0),
    ...u32(0),
    ...u16(csiz),
    ...Array.from({ length: listed }, () => [7, 1, 1]).flat(),
    0xff,
    0xd9,
  ]);
}

/** One JBIG2 segment (embedded organisation) of `type` with `data`. */
function segment(type: number, data: number[]): number[] {
  return [...u32(0), type, 0, 1, ...u32(data.length), ...data];
}

/** Region segment information: width, height, x, y, combination operator. */
const regionInfo = (width: number, height: number): number[] => [
  ...u32(width),
  ...u32(height),
  ...u32(0),
  ...u32(0),
  0,
];

const pageInfo = (width: number, height: number): number[] =>
  segment(48, [...u32(width), ...u32(height), ...u32(0), ...u32(0), 0x04, ...u16(0)]);

const jbig2 = (...segments: number[][]): Uint8Array => Uint8Array.from(segments.flat());

const u32le = (v: number): number[] => [
  v & 0xff,
  (v >>> 8) & 0xff,
  (v >>> 16) & 0xff,
  (v >>> 24) & 0xff,
];

/** A RIFF/WEBP file with one chunk. */
function webp(fourcc: string, body: number[]): Uint8Array {
  const padded = body.length % 2 === 0 ? body : [...body, 0];
  const chunk = [...latin1(fourcc), ...u32le(body.length), ...padded];
  return Uint8Array.from([
    ...latin1('RIFF'),
    ...u32le(4 + chunk.length),
    ...latin1('WEBP'),
    ...chunk,
  ]);
}

/** A VP8 key frame header for `width` x `height` followed by `pad` zero bytes. */
function vp8(width: number, height: number, pad: number): Uint8Array {
  return webp('VP8 ', [
    0x10,
    0x00,
    0x00,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    width >> 8,
    height & 0xff,
    height >> 8,
    ...new Array<number>(pad).fill(0),
  ]);
}

/** A VP8L header for `width` x `height` (each 1 to 16384) followed by `pad` zero bytes. */
function vp8l(width: number, height: number, pad: number): Uint8Array {
  const bits = (width - 1) | ((height - 1) * 2 ** 14);
  const header = [0, 0, 0, 0].map((_, i) => Math.floor(bits / 2 ** (8 * i)) & 0xff);
  // 14 + 14 bits of size, then alpha and version bits (zero)
  return webp('VP8L', [0x2f, ...header, 0, ...new Array<number>(pad).fill(0)]);
}

const run = (entry: string, input: Uint8Array, args?: JsonValue): Promise<BudgetOutcome> =>
  runWithinBudget({ module: BODIES, entry, input, ...(args === undefined ? {} : { args }) });

const UNSUPPORTED = (filter: string): Record<string, unknown> => ({
  kind: 'threw',
  name: 'UnsupportedFilterError',
  code: 'unsupported-filter',
  message: expect.stringContaining(filter),
});

function expectInBudget(outcome: BudgetOutcome): void {
  expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
  expect(outcome.mib).toBeLessThanOrEqual(DEFAULT_BUDGET.mib);
}

describe('formats that are not decoded end at once', () => {
  describe('JPEG 2000', () => {
    const inputs: Record<string, Uint8Array> = {
      'a 12000 x 12000 image with three components': codestream(12000, 12000, 3, 3),
      'a Csiz of 65535 with the Ssiz entries of one component': codestream(128, 128, 65535, 1),
      'an empty input': new Uint8Array(0),
    };
    for (const [name, input] of Object.entries(inputs)) {
      for (const entry of [
        'decodeJpeg2000Entry',
        'decodeTileEntry',
        'decodeTileRegionEntry',
        'transcodeEntry',
      ]) {
        it(
          `${entry} refuses ${name}`,
          async () => {
            const outcome = await run(entry, input);
            expect(outcome).toMatchObject(UNSUPPORTED('JPEG 2000'));
            expectInBudget(outcome);
          },
          TIMEOUT,
        );
      }
      it(
        `decodeStream with JPXDecode refuses ${name}`,
        async () => {
          const outcome = await run('decodeStreamEntry', input, 'JPXDecode');
          expect(outcome).toMatchObject(UNSUPPORTED('JPEG 2000'));
          expectInBudget(outcome);
        },
        TIMEOUT,
      );
    }

    it(
      'assembleTiles refuses the grid of a 65535 x 65535 image',
      async () => {
        const outcome = await run('assembleTilesEntry', new Uint8Array(0));
        expect(outcome).toMatchObject(UNSUPPORTED('JPEG 2000'));
        expectInBudget(outcome);
      },
      TIMEOUT,
    );
  });

  describe('JBIG2', () => {
    const inputs: Record<string, Uint8Array> = {
      'a page of 131072 x 131072 pixels': jbig2(pageInfo(0x20000, 0x20000)),
      'a generic region of 40000 x 40000 pixels': jbig2(
        pageInfo(64, 64),
        segment(38, [...regionInfo(40000, 40000), 0, 3, 0xff, 0xfd, 0xff, 2, 0xfe, 0xfe, 0xfe]),
      ),
      'a pattern dictionary of 0x00FFFFFF patterns': jbig2(
        pageInfo(64, 64),
        segment(16, [0, 4, 4, ...u32(0x00ffffff)]),
      ),
      'a halftone region of 40000 x 40000 grid cells': jbig2(
        pageInfo(64, 64),
        segment(22, [
          ...regionInfo(64, 64),
          0,
          ...u32(40000),
          ...u32(40000),
          ...u32(0),
          ...u32(0),
          ...u16(1),
          ...u16(0),
        ]),
      ),
      'an empty input': new Uint8Array(0),
    };
    for (const [name, input] of Object.entries(inputs)) {
      for (const entry of ['decodeJbig2Entry', 'decodeJbig2ParmsEntry', 'decodeJbig2AsyncEntry']) {
        it(
          `${entry} refuses ${name}`,
          async () => {
            const outcome = await run(entry, input);
            expect(outcome).toMatchObject(UNSUPPORTED('JBIG2'));
            expectInBudget(outcome);
          },
          TIMEOUT,
        );
      }
      it(
        `decodeStream with JBIG2Decode refuses ${name}`,
        async () => {
          const outcome = await run('decodeStreamEntry', input, 'JBIG2Decode');
          expect(outcome).toMatchObject(UNSUPPORTED('JBIG2'));
          expectInBudget(outcome);
        },
        TIMEOUT,
      );
    }
  });

  describe('WebP', () => {
    it(
      'refuses a lossy image of 16383 x 16383 pixels',
      async () => {
        const outcome = await run('decodeWebPEntry', vp8(16383, 16383, 200));
        expect(outcome).toMatchObject({
          ...UNSUPPORTED('VP8'),
          message: expect.stringContaining('Lossy WebP (VP8)'),
        });
        expectInBudget(outcome);
      },
      TIMEOUT,
    );

    it(
      'refuses a lossy image whose frame header is cut short',
      async () => {
        expect(await run('decodeWebPEntry', webp('VP8 ', [0x01]))).toMatchObject(
          UNSUPPORTED('VP8'),
        );
      },
      TIMEOUT,
    );

    it(
      'refuses a lossless image of 16384 x 16384 pixels with ResourceLimitError before sizing a buffer',
      async () => {
        const outcome = await run('decodeWebPEntry', vp8l(16384, 16384, 64));
        expect(outcome).toMatchObject({
          kind: 'threw',
          name: 'ResourceLimitError',
          code: 'resource-limit-exceeded',
          limit: 'maxImageBytes',
        });
        expectInBudget(outcome);
      },
      TIMEOUT,
    );
  });
});

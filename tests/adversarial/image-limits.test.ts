/**
 * Size and count limits of the image and font decoders under the budgeted runner (2 s, 512 MiB of
 * resident memory growth): CCITT /Columns and /Rows, the TIFF IFD chain, TIFF tags, strips, tiles
 * and sizes, PNG sizes and inflate, WOFF table sizes and overlap. Every input is built here or in
 * image-limits.bodies.ts; each case ends in ResourceLimitError (the limit named), in the asserted
 * parse error, or, for the controls, in the right result. The cases at a limit (CCITT, TIFF and
 * PNG) complete under AT_LIMIT_BUDGET (5 s, 1536 MiB), the cases above a limit under the default.
 */
import { createDeflate } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AT_LIMIT_BUDGET, DEFAULT_BUDGET, runWithinBudget } from '../helpers/budget.js';
import type { Budget, BudgetOutcome } from '../helpers/budget.js';
import {
  buildPng,
  buildTiff,
  buildTiffChain,
  buildTiffImage,
  buildTiffStripped,
  buildWoff,
  buildWoffSharedBlob,
  zlibOfZeroBytes,
} from './image-limits.bodies.js';

const BODIES = 'tests/adversarial/image-limits.bodies.ts';
const MIB = 1024 * 1024;
// Building a 400 MiB bomb and the runner's start-up come before the budget clock.
const TIMEOUT = 60_000;

const run = (
  entry: string,
  input: Uint8Array,
  args?: Parameters<typeof runWithinBudget>[0]['args'],
  budget: Budget = DEFAULT_BUDGET,
): Promise<BudgetOutcome> =>
  runWithinBudget(
    { module: BODIES, entry, input, ...(args === undefined ? {} : { args }) },
    budget,
  );

/** The outcome is a completed run with `result`, inside `budget`. */
function expectCompleted(
  outcome: BudgetOutcome,
  result: Record<string, number | boolean>,
  budget: Budget = DEFAULT_BUDGET,
): void {
  expect(outcome).toMatchObject({ kind: 'completed', result });
  expect(outcome.ms).toBeLessThan(budget.ms);
  expect(outcome.mib).toBeLessThan(budget.mib);
}

/** The outcome is a ResourceLimitError for `limit`, inside the budget. */
function expectLimit(outcome: BudgetOutcome, limit: string, max: number): void {
  expect(outcome).toMatchObject({
    kind: 'threw',
    name: 'ResourceLimitError',
    code: 'resource-limit-exceeded',
    limit,
  });
  expect((outcome as { message: string }).message).toContain(`(${max} `);
  expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
  expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
}

function expectError(outcome: BudgetOutcome, message: string): void {
  expect(outcome).toMatchObject({ kind: 'threw', name: 'Error', message });
  expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
  expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
}

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
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const ones = (length: number): Uint8Array => new Uint8Array(length).fill(0xff);

describe('image and font decoders stay within the internal limits', () => {
  it(
    'CCITTFaxDecode checks /Columns and /Rows first',
    async () => {
      const group4 = (columns: number, rows?: number) => ({
        k: -1,
        columns,
        ...(rows === undefined ? {} : { rows }),
      });
      expectLimit(
        await run('ccittEntry', ones(64), group4(2 ** 30, 4)),
        'maxImageDimension',
        65536,
      );
      expectLimit(
        await run('ccittEntry', ones(64), group4(8, 2 ** 30)),
        'maxImageDimension',
        65536,
      );
      expectLimit(
        await run('ccittEntry', ones(64), group4(65536, 4097)),
        'maxImagePixels',
        2 ** 28,
      );
      expect(await run('ccittEntry', ones(64), { k: 0, columns: 0 })).toMatchObject({
        kind: 'threw',
        name: 'RangeError',
        message: 'CCITTFaxDecode: /Columns must be an integer of at least 1',
      });
      // No /Rows: one coded bit per white row, so 4096 bytes would decode 32768 rows of 65536 pixels.
      const outcome = await run('ccittEntry', ones(4096), group4(65536));
      expectLimit(outcome, 'maxImagePixels', 2 ** 28);
    },
    TIMEOUT,
  );

  it(
    'CCITTFaxDecode at the pixel limit completes within the at-limit budget',
    async () => {
      const outcome = await run(
        'ccittEntry',
        ones(512),
        { k: -1, columns: 65536, rows: 4096 },
        AT_LIMIT_BUDGET,
      );
      expectCompleted(outcome, { length: 4096 * 8192 }, AT_LIMIT_BUDGET);
    },
    TIMEOUT,
  );

  it(
    'TIFF page count reads each IFD once',
    async () => {
      for (const entry of ['tiffPageCountEntry', 'tiffAllEntry']) {
        expectError(await run(entry, buildTiffChain(1, 8)), 'TIFF: the IFD chain repeats offset 8');
        expectLimit(await run(entry, buildTiffChain(4097)), 'maxImageFrames', 4096);
      }
      expect(await run('tiffPageCountEntry', buildTiffChain(4096))).toMatchObject({
        kind: 'completed',
        result: { pages: 4096 },
      });
    },
    TIMEOUT,
  );

  it(
    'TIFF decode checks the image size first',
    async () => {
      expectLimit(
        await run('tiffDecodeEntry', buildTiffImage(20000, 20000, 3)),
        'maxImagePixels',
        2 ** 28,
      );
      expectLimit(
        await run('tiffEmbedEntry', buildTiffImage(20000, 20000, 3)),
        'maxImagePixels',
        2 ** 28,
      );
      expectLimit(
        await run('tiffDecodeEntry', buildTiffImage(65537, 1, 1)),
        'maxImageDimension',
        65536,
      );
    },
    TIMEOUT,
  );

  it(
    'TIFF decode at the pixel and byte limit completes within the at-limit budget',
    async () => {
      // Exactly maxImagePixels and maxImageBytes: accepted.
      const outcome = await run(
        'tiffDecodeEntry',
        buildTiffImage(16384, 16384, 1),
        undefined,
        AT_LIMIT_BUDGET,
      );
      expectCompleted(outcome, { width: 16384, height: 16384, length: 2 ** 28 }, AT_LIMIT_BUDGET);
    },
    TIMEOUT,
  );

  it(
    'TIFF decode reads an entry of type 0 and a count of 2^32 - 1 up to the end of the file',
    async () => {
      const tiff = buildTiffImage(2, 2, 1, new Uint8Array(4), [[300, 0, 0xffffffff, 0]]);
      expectCompleted(await run('tiffDecodeEntry', tiff), { width: 2, height: 2, length: 4 });
      expectCompleted(await run('tiffEmbedEntry', tiff), { embedded: true });
    },
    TIMEOUT,
  );

  it(
    'TIFF decode refuses entries that together hold more values than twice the file length',
    async () => {
      for (const type of [1, 0]) {
        const tiff = buildTiffImage(
          2,
          2,
          1,
          new Uint8Array(4),
          Array.from(
            { length: 5000 },
            (_, i) => [300 + i, type, 0xffffffff, 0] as [number, number, number, number],
          ),
        );
        expectError(await run('tiffDecodeEntry', tiff), 'TIFF: tag data overlaps');
        expectError(await run('tiffEmbedEntry', tiff), 'TIFF: tag data overlaps');
      }
    },
    TIMEOUT,
  );

  it(
    'TIFF decode inflates a Deflate strip only up to the size the strip implies',
    async () => {
      // A 1 x 1 image whose one strip inflates to 250 MiB: the first byte is read, the rest is not.
      const bomb = await zlibOfZeros(250);
      const single = buildTiffStripped({
        width: 1,
        height: 1,
        compression: 8,
        count: 1,
        strips: (at) => [[at, bomb.length]],
        tail: bomb,
      });
      expectCompleted(await run('tiffDecodeEntry', single), { width: 1, height: 1, length: 1 });
      expectCompleted(await run('tiffEmbedEntry', single), { embedded: true });
    },
    TIMEOUT,
  );

  it(
    'TIFF decode refuses Deflate strips that share their data past the length of the file',
    async () => {
      // 64 one-row strips that all point at one blob that inflates to 32 MiB.
      const bomb = await zlibOfZeros(32);
      const shared = buildTiffStripped({
        width: 1,
        height: 64,
        compression: 8,
        rowsPerStrip: 1,
        count: 64,
        strips: (at) => Array.from({ length: 64 }, () => [at, bomb.length] as const),
        tail: bomb,
      });
      expectError(await run('tiffDecodeEntry', shared), 'TIFF: strip data overlaps');
    },
    TIMEOUT,
  );

  it(
    'TIFF direct embed checks strip sizes against the file',
    async () => {
      /** A 2 x 2 gray strip image; StripOffsets and StripByteCounts as (count, value or offset) pairs. */
      const strips = (
        offsets: readonly [count: number, at: number],
        counts: readonly [count: number, at: number],
        tail: Uint8Array,
      ): Uint8Array =>
        buildTiff(
          [
            [256, 4, 1, 2],
            [257, 4, 1, 2],
            [258, 3, 1, 8],
            [262, 3, 1, 1],
            [273, 4, offsets[0], offsets[1]],
            [277, 3, 1, 1],
            [279, 4, counts[0], counts[1]],
          ],
          tail,
        );
      const head = 8 + 2 + 7 * 12 + 4;

      // A strip count past the end of the file, and arrays of values past the end of the file.
      expectError(
        await run('tiffDirectEntry', strips([1, 0], [1, 2 ** 31], new Uint8Array(64))),
        'TIFF: strip data out of bounds',
      );
      expectError(
        await run('tiffDirectEntry', strips([2 ** 28, head], [1, 4], new Uint8Array(64))),
        'TIFF: tag data out of bounds',
      );
      expectError(
        await run('tiffDirectEntry', strips([1, 0], [2 ** 28, head], new Uint8Array(64))),
        'TIFF: tag data out of bounds',
      );

      // 300 strips that each cover the whole 1 MiB file: every strip is inside the file, the sum is 300 MiB.
      const count = 300;
      const body = new Uint8Array(MIB - head);
      const view = new DataView(body.buffer);
      for (let i = 0; i < count; i++) view.setUint32(count * 4 + i * 4, MIB, true);
      const overlapping = strips([count, head], [count, head + count * 4], body);
      expect(overlapping.length).toBe(MIB);
      expectLimit(await run('tiffDirectEntry', overlapping), 'maxImageBytes', 2 ** 28);
    },
    TIMEOUT,
  );

  it(
    'TIFF direct embed refuses JPEG strips that each cover the whole file',
    async () => {
      // 16000 strips of the file's whole length (about 132 KB): the sum is 2 GB.
      const count = 16_000;
      const tiff = buildTiffStripped({
        width: 2,
        height: 2,
        compression: 7,
        count,
        strips: (_at, fileLength) => Array.from({ length: count }, () => [0, fileLength] as const),
        tail: new Uint8Array(0),
      });
      expectLimit(await run('tiffDirectEntry', tiff), 'maxImageBytes', 2 ** 28);
    },
    TIMEOUT,
  );

  it(
    'TIFF direct embed checks the image size and the tile sides first',
    async () => {
      const tiled = (
        height: number,
        tile: readonly [number, number],
        tiles: number,
      ): Uint8Array => {
        // Offsets and byte counts of the tiles follow the IFD; every tile is the 16 bytes at offset 0.
        const ifdEnd = 8 + 2 + 9 * 12 + 4;
        const arrays = new Uint8Array(8 * tiles);
        const view = new DataView(arrays.buffer);
        for (let i = 0; i < tiles; i++) {
          view.setUint32(4 * i, 0, true);
          view.setUint32(4 * tiles + 4 * i, 16, true);
        }
        return buildTiff(
          [
            [256, 4, 1, 16],
            [257, 4, 1, height],
            [258, 3, 1, 8],
            [262, 3, 1, 1],
            [277, 3, 1, 1],
            [322, 4, 1, tile[0]],
            [323, 4, 1, tile[1]],
            [324, 4, tiles, ifdEnd],
            [325, 4, tiles, ifdEnd + 4 * tiles],
          ],
          arrays,
        );
      };
      const sides = 'TIFF: tile width and length must be positive multiples of 16';
      expectError(await run('tiffDirectEntry', tiled(65536, [0, 65536], 1000)), sides);
      expectError(await run('tiffDirectEntry', tiled(65536, [1, 65536], 1000)), sides);
      expectLimit(
        await run('tiffDirectEntry', tiled(2 ** 24, [0, 2 ** 24], 64)),
        'maxImageDimension',
        65536,
      );
    },
    TIMEOUT,
  );

  it(
    'PNG embed checks the IHDR size first',
    async () => {
      const idat = zlibOfZeroBytes(64);
      expectLimit(await run('pngEntry', buildPng(16384, 16384, 6, idat)), 'maxImageBytes', 2 ** 28);
      expectLimit(
        await run('pngEntry', buildPng(20000, 20000, 2, idat)),
        'maxImagePixels',
        2 ** 28,
      );
      expectLimit(await run('pngEntry', buildPng(65537, 1, 2, idat)), 'maxImageDimension', 65536);
    },
    TIMEOUT,
  );

  it(
    'PNG embed of an RGBA image just under maxImageBytes completes within the at-limit budget',
    async () => {
      // 8190 x 8190 RGBA: 268,304,400 decoded bytes (below 2^28) and 268,312,590 filtered bytes,
      // inflated from 256 MiB of zeros.
      const png = buildPng(8190, 8190, 6, await zlibOfZeros(256));
      const outcome = await run('pngEntry', png, undefined, AT_LIMIT_BUDGET);
      expectCompleted(outcome, { width: 8190, height: 8190 }, AT_LIMIT_BUDGET);
    },
    TIMEOUT,
  );

  it(
    'PNG embed inflates only the size the IHDR implies and ignores the rest',
    async () => {
      // A 16 x 16 RGBA image needs 1040 bytes; this IDAT inflates to 400 MiB. The data past the
      // 1040 bytes is ignored and never inflated: the image is embedded, inside the budget.
      const outcome = await run('pngEntry', buildPng(16, 16, 6, await zlibOfZeros(400)));
      expect(outcome).toMatchObject({ kind: 'completed', result: { width: 16, height: 16 } });
      expect(outcome.ms).toBeLessThan(DEFAULT_BUDGET.ms);
      expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
      // The same image with exactly the data it needs decodes.
      expect(await run('pngEntry', buildPng(16, 16, 6, zlibOfZeroBytes(1040)))).toMatchObject({
        kind: 'completed',
        result: { width: 16, height: 16 },
      });
    },
    TIMEOUT,
  );

  it(
    'WOFF decode inflates each table only up to its stated length',
    async () => {
      const bomb = buildWoff([{ tag: 'glyf', stored: await zlibOfZeros(400), origLength: 4096 }]);
      expectError(await run('woffEntry', bomb), 'WOFF1: inflated table size mismatch');
      const control = buildWoff([{ tag: 'glyf', stored: zlibOfZeroBytes(4096), origLength: 4096 }]);
      expect(await run('woffEntry', control)).toMatchObject({
        kind: 'completed',
        result: { length: 12 + 16 + 4096 },
      });
    },
    TIMEOUT,
  );

  it(
    'WOFF decode refuses tables that share their data',
    async () => {
      // zlib data of one byte followed by 256 KiB of junk, shared by 6000 tables.
      const head = zlibOfZeroBytes(1);
      const blob = new Uint8Array(head.length + 256 * 1024).fill(0x5a);
      blob.set(head);
      expectError(
        await run('woffEntry', buildWoffSharedBlob(6000, blob, 1)),
        'WOFF1: table data overlaps',
      );
    },
    TIMEOUT,
  );

  it(
    'WOFF decode checks the total font size first',
    async () => {
      const table = (tag: string, origLength: number) => ({
        tag,
        stored: zlibOfZeroBytes(8),
        origLength,
      });
      const third = Math.floor(2 ** 27 / 3) + 1;
      const sum = buildWoff([table('aaaa', third), table('bbbb', third), table('cccc', third)], 12);
      expectLimit(await run('woffEntry', sum), 'maxFontBytes', 2 ** 27);
      const total = buildWoff([table('aaaa', 8)], 2 ** 27 + 1);
      expectLimit(await run('woffEntry', total), 'maxFontBytes', 2 ** 27);
    },
    TIMEOUT,
  );
});

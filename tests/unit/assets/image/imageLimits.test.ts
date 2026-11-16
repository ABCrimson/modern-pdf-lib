/**
 * Size and count limits of the image and font decoders: CCITT /Columns and /Rows, the TIFF IFD
 * chain, TIFF sizes (decode and direct embed), PNG sizes and inflate, WOFF table sizes. Every
 * input is built in code (tests/adversarial/image-limits.bodies.ts); each refusal happens before
 * the allocation it guards, so these tests allocate nothing large. The last blocks run each
 * standalone decoder under the `limits` option of the call: the TIFF decoders, the direct TIFF
 * embed, WOFF and the font metrics here, WebP in tests/unit/assets/image/webp/webpDecode.test.ts.
 */
import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeWoff } from '../../../../src/assets/font/woff.js';
import { embedPng } from '../../../../src/assets/image/internal/pngEmbed.js';
import {
  decodeTiff,
  decodeTiffAll,
  decodeTiffPage,
  getTiffPageCount,
  parseTiffIfd,
} from '../../../../src/assets/image/tiff/tiffDecode.js';
import { embedTiffDirect } from '../../../../src/assets/image/tiff/tiffDirectEmbed.js';
import { extractMetrics } from '../../../../src/assets/font/fontMetrics.js';
import {
  INTERNAL_LIMITS,
  beginCall,
  resolveLimits,
  type LimitContext,
} from '../../../../src/internal/limits.js';
import { DEFAULT_LIMITS, type LimitName, type PdfLimits } from '../../../../src/limits.js';
import { PdfDict, PdfNumber } from '../../../../src/core/pdfObjects.js';
import { MalformedInputError, ResourceLimitError } from '../../../../src/errors.js';
import { decodeCCITT } from '../../../../src/codecs/internal/ccittDecode.js';
import {
  buildPng,
  buildTiff,
  buildTiffChain,
  buildTiffImage,
  buildTiffStripped,
  buildWoff,
  buildWoffSharedBlob,
  zlibOfZeroBytes,
} from '../../../adversarial/image-limits.bodies.js';
import { buildCmapFont } from '../../../adversarial/text-limits.bodies.js';

/** The error `fn` throws, so a test can inspect its fields. */
function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to throw');
}

function expectLimit(
  fn: () => unknown,
  limit: keyof typeof INTERNAL_LIMITS,
  actual?: number,
): void {
  const err = thrown(fn);
  expect(err).toBeInstanceOf(ResourceLimitError);
  expect(err).toMatchObject({
    code: 'resource-limit-exceeded',
    limit,
    max: INTERNAL_LIMITS[limit],
  });
  if (actual !== undefined) expect((err as ResourceLimitError).actual).toBe(actual);
}

function ccitt(k: number, columns: number, rows?: number): Uint8Array {
  const parms = new PdfDict();
  parms.set('/K', PdfNumber.of(k));
  parms.set('/Columns', PdfNumber.of(columns));
  if (rows !== undefined) parms.set('/Rows', PdfNumber.of(rows));
  return decodeCCITT(new Uint8Array(64).fill(0xff), parms, beginCall(DEFAULT_LIMITS));
}

describe('CCITTFaxDecode checks /Columns and /Rows first', () => {
  it('rejects /Columns below 1 with a MalformedInputError', () => {
    for (const columns of [0, -1]) {
      for (const k of [-1, 0, 1]) {
        const err = thrown(() => ccitt(k, columns));
        expect(err).toBeInstanceOf(MalformedInputError);
        expect(err).toMatchObject({ code: 'malformed-input', format: 'other' });
        expect((err as MalformedInputError).message).toBe(
          'CCITTFaxDecode: /Columns must be an integer of at least 1',
        );
      }
    }
  });

  it('refuses /Columns and /Rows above maxImageDimension', () => {
    const above = INTERNAL_LIMITS.maxImageDimension + 1;
    for (const k of [-1, 0, 1]) {
      expectLimit(() => ccitt(k, above), 'maxImageDimension', above);
      expectLimit(() => ccitt(k, 8, above), 'maxImageDimension', above);
    }
    expectLimit(() => ccitt(-1, 2 ** 30, 4), 'maxImageDimension', 2 ** 30);
  });

  it('refuses /Columns x /Rows above maxImagePixels before decoding', () => {
    const columns = INTERNAL_LIMITS.maxImageDimension;
    const rows = INTERNAL_LIMITS.maxImagePixels / columns + 1;
    expectLimit(() => ccitt(-1, columns, rows), 'maxImagePixels', columns * rows);
  });

  it('accepts a dimension equal to the ceiling', () => {
    expect(ccitt(-1, INTERNAL_LIMITS.maxImageDimension, 1).length).toBe(
      INTERNAL_LIMITS.maxImageDimension / 8,
    );
  });
});

describe('TIFF page count reads each IFD once', () => {
  it('ends on an IFD offset seen before', () => {
    const cycle = buildTiffChain(1, 8);
    for (const fn of [
      () => getTiffPageCount(cycle),
      () => decodeTiffAll(cycle),
      () => decodeTiffPage(cycle, 5),
    ]) {
      expect(thrown(fn)).toMatchObject({
        name: 'MalformedInputError',
        code: 'malformed-input',
        format: 'tiff',
        message: 'TIFF: the IFD chain repeats offset 8',
      });
    }
    expect((thrown(() => getTiffPageCount(buildTiffChain(3, 14))) as Error).message).toBe(
      'TIFF: the IFD chain repeats offset 14',
    );
  });

  it('counts a chain of maxImageFrames IFDs and refuses one more', () => {
    expect(getTiffPageCount(buildTiffChain(INTERNAL_LIMITS.maxImageFrames))).toBe(
      INTERNAL_LIMITS.maxImageFrames,
    );
    expectLimit(
      () => getTiffPageCount(buildTiffChain(INTERNAL_LIMITS.maxImageFrames + 1)),
      'maxImageFrames',
      INTERNAL_LIMITS.maxImageFrames + 1,
    );
    expectLimit(
      () => decodeTiffPage(buildTiffChain(INTERNAL_LIMITS.maxImageFrames + 1), 4096),
      'maxImageFrames',
      INTERNAL_LIMITS.maxImageFrames + 1,
    );
  });

  it('keeps counting an ordinary chain', () => {
    expect(getTiffPageCount(buildTiffChain(3))).toBe(3);
    expect(getTiffPageCount(buildTiffImage(2, 2, 3))).toBe(1);
  });
});

describe('TIFF decode checks the image size first', () => {
  it('refuses a width or height above maxImageDimension', () => {
    const above = INTERNAL_LIMITS.maxImageDimension + 1;
    expectLimit(() => decodeTiff(buildTiffImage(above, 1, 1)), 'maxImageDimension', above);
    expectLimit(() => decodeTiff(buildTiffImage(1, above, 1)), 'maxImageDimension', above);
  });

  it('refuses width x height above maxImagePixels', () => {
    expectLimit(() => decodeTiff(buildTiffImage(20000, 20000, 3)), 'maxImagePixels', 4e8);
  });

  it('refuses decoded bytes above maxImageBytes', () => {
    // 16384 x 16384 is exactly maxImagePixels; three samples make the bytes 3 x 2^28.
    expectLimit(() => decodeTiff(buildTiffImage(16384, 16384, 3)), 'maxImageBytes', 3 * 2 ** 28);
  });

  it('decodes an ordinary image', () => {
    const image = decodeTiff(buildTiffImage(2, 2, 3, new Uint8Array(12).fill(7)));
    expect(image).toMatchObject({ width: 2, height: 2, channels: 3 });
    expect(Array.from(image.pixels)).toEqual(new Array(12).fill(7));
  });
});

describe('TIFF direct embed checks strip sizes against the file', () => {
  const stripTags = (
    offsets: { count: number; at: number },
    counts: { count: number; at: number },
  ): ReturnType<typeof buildTiff> =>
    buildTiff(
      [
        [256, 4, 1, 2],
        [257, 4, 1, 2],
        [258, 3, 1, 8],
        [262, 3, 1, 1],
        [273, 4, offsets.count, offsets.at],
        [277, 3, 1, 1],
        [279, 4, counts.count, counts.at],
      ],
      new Uint8Array(64),
    );

  it('refuses a strip that runs past the end of the file', () => {
    const tiff = stripTags({ count: 1, at: 0 }, { count: 1, at: 0x7fffffff });
    expect(thrown(() => embedTiffDirect(tiff))).toMatchObject({
      name: 'MalformedInputError',
      code: 'malformed-input',
      format: 'tiff',
      message: 'TIFF: strip data out of bounds',
    });
  });

  it('refuses an offset or count array that runs past the end of the file', () => {
    for (const tiff of [
      stripTags({ count: 0x10000000, at: 100 }, { count: 1, at: 4 }),
      stripTags({ count: 1, at: 100 }, { count: 0x10000000, at: 100 }),
    ]) {
      expect(thrown(() => embedTiffDirect(tiff))).toMatchObject({
        name: 'MalformedInputError',
        code: 'malformed-input',
        format: 'tiff',
        message: 'TIFF: tag data out of bounds',
      });
    }
  });

  it('refuses a tile buffer above maxImageBytes', () => {
    const tiff = buildTiff(
      [
        [256, 4, 1, 16384],
        [257, 4, 1, 16384],
        [258, 3, 1, 8],
        [262, 3, 1, 2],
        [277, 3, 1, 3],
        [322, 4, 1, 16],
        [323, 4, 1, 16],
        [324, 4, 1, 0],
        [325, 4, 1, 16],
      ],
      new Uint8Array(64),
    );
    // 16384 x 16384 is exactly maxImagePixels; three samples make the bytes 3 x 2^28.
    expectLimit(() => embedTiffDirect(tiff), 'maxImageBytes', 3 * 2 ** 28);
  });

  it('embeds an ordinary strip image', () => {
    const tiff = stripTags({ count: 1, at: 8 + 2 + 7 * 12 + 4 }, { count: 1, at: 4 });
    expect(embedTiffDirect(tiff)).toMatchObject({ width: 2, height: 2 });
  });
});

describe('TIFF entries of type 0', () => {
  it('reads the values of a type-0 entry like those of any unknown type: at most to the end of the file', () => {
    const tiff = buildTiffImage(2, 2, 1, new Uint8Array(4), [[300, 0, 0xffffffff, 0]]);
    const entry = parseTiffIfd(tiff, 8, true).find((e) => e.tag === 300);
    expect(entry?.count).toBe(0xffffffff);
    expect(entry?.values.length).toBeLessThanOrEqual(tiff.length);
    expect(decodeTiff(tiff)).toMatchObject({ width: 2, height: 2 });
  });
});

describe('TIFF entries read at most twice as many values as the file has bytes', () => {
  const manyEntries = (type: number) =>
    buildTiffImage(
      2,
      2,
      1,
      new Uint8Array(4),
      Array.from(
        { length: 5000 },
        (_, i) => [300 + i, type, 0xffffffff, 0] as [number, number, number, number],
      ),
    );

  it.each([1, 0])(
    'refuses entries of type %i that together hold more values than twice the file length',
    (type) => {
      expect(thrown(() => decodeTiff(manyEntries(type)))).toMatchObject({
        name: 'MalformedInputError',
        code: 'malformed-input',
        format: 'tiff',
        message: 'TIFF: tag data overlaps',
      });
    },
  );
});

describe('TIFF direct embed checks the image and tile sizes', () => {
  const tiled = (
    width: number,
    height: number,
    tile: readonly [width: number, length: number],
  ): Uint8Array =>
    buildTiff(
      [
        [256, 4, 1, width],
        [257, 4, 1, height],
        [258, 3, 1, 8],
        [262, 3, 1, 1],
        [277, 3, 1, 1],
        [322, 4, 1, tile[0]],
        [323, 4, 1, tile[1]],
        [324, 4, 1, 0],
        [325, 4, 1, 16],
      ],
      new Uint8Array(1024),
    );

  it('refuses a tile width or length that is not a positive multiple of 16', () => {
    for (const tile of [
      [0, 16],
      [16, 0],
      [0, 0],
      [1, 16],
      [16, 8],
      [17, 16],
      [16, 100],
    ] as const) {
      expect(thrown(() => embedTiffDirect(tiled(64, 64, tile)))).toMatchObject({
        name: 'MalformedInputError',
        code: 'malformed-input',
        format: 'tiff',
        message: 'TIFF: tile width and length must be positive multiples of 16',
      });
    }
  });

  it('embeds tiles whose sides are multiples of 16', () => {
    expect(embedTiffDirect(tiled(40, 40, [16, 32]))).toMatchObject({ width: 40, height: 40 });
  });

  it('refuses a width or height above maxImageDimension', () => {
    const above = INTERNAL_LIMITS.maxImageDimension + 1;
    expectLimit(() => embedTiffDirect(buildTiffImage(above, 1, 1)), 'maxImageDimension', above);
    expectLimit(() => embedTiffDirect(buildTiffImage(1, above, 1)), 'maxImageDimension', above);
    expectLimit(() => embedTiffDirect(tiled(1, 2 ** 24, [16, 16])), 'maxImageDimension', 2 ** 24);
  });

  it('refuses width x height above maxImagePixels', () => {
    expectLimit(() => embedTiffDirect(buildTiffImage(20000, 20000, 1)), 'maxImagePixels', 4e8);
  });
});

describe('TIFF direct embed of JPEG strips checks the strips against the file', () => {
  const jpegStrips = (
    count: number,
    strips: (tailAt: number, fileLength: number) => Array<readonly [number, number]>,
    tail: Uint8Array,
  ): Uint8Array => buildTiffStripped({ width: 2, height: 2, compression: 7, count, strips, tail });

  it('refuses strips that each cover the whole file once their sum is above maxImageBytes', () => {
    const count = 300;
    const tiff = jpegStrips(
      count,
      (_at, fileLength) => Array.from({ length: count }, () => [0, fileLength] as const),
      new Uint8Array(2 ** 20),
    );
    expectLimit(() => embedTiffDirect(tiff), 'maxImageBytes');
  });

  it('refuses a strip that runs past the end of the file', () => {
    const tiff = jpegStrips(
      2,
      (at) => [
        [at, 8],
        [at, 2 ** 30],
      ],
      new Uint8Array(64),
    );
    expect(thrown(() => embedTiffDirect(tiff))).toMatchObject({
      name: 'MalformedInputError',
      code: 'malformed-input',
      format: 'tiff',
      message: 'TIFF: strip data out of bounds',
    });
  });

  it('joins the strips of an ordinary file', () => {
    const tail = Uint8Array.from({ length: 32 }, (_, i) => i);
    const tiff = jpegStrips(
      2,
      (at) => [
        [at, 8],
        [at + 8, 24],
      ],
      tail,
    );
    const result = embedTiffDirect(tiff);
    expect(result.filter).toBe('DCTDecode');
    expect(result.data).toEqual(tail);
  });
});

describe('TIFF decode of Deflate strips', () => {
  const deflate = (
    height: number,
    count: number,
    strips: (tailAt: number, fileLength: number) => Array<readonly [number, number]>,
    tail: Uint8Array,
  ): Uint8Array =>
    buildTiffStripped({ width: 4, height, compression: 8, rowsPerStrip: 1, count, strips, tail });
  const rowOf = (value: number): Uint8Array => zlibSync(new Uint8Array(4).fill(value));

  it('decodes strips that are inside the file', () => {
    const [a, b] = [rowOf(10), rowOf(20)];
    const tail = new Uint8Array(a.length + b.length);
    tail.set(a);
    tail.set(b, a.length);
    const tiff = deflate(
      2,
      2,
      (at) => [
        [at, a.length],
        [at + a.length, b.length],
      ],
      tail,
    );
    expect(Array.from(decodeTiff(tiff).pixels)).toEqual([10, 10, 10, 10, 20, 20, 20, 20]);
  });

  it('ignores strip data past the size the strip implies', () => {
    const tail = zlibSync(new Uint8Array(64).fill(9));
    const tiff = deflate(1, 1, (at) => [[at, tail.length]], tail);
    expect(Array.from(decodeTiff(tiff).pixels)).toEqual([9, 9, 9, 9]);
  });

  it('does not read strips past the rows of the image', () => {
    // Strips 2 to 4 start after the image's two rows and hold bytes that are not Deflate data.
    const [a, b] = [rowOf(1), rowOf(2)];
    const junk = new Uint8Array(8).fill(0xff);
    const tail = new Uint8Array(a.length + b.length + junk.length);
    tail.set(a);
    tail.set(b, a.length);
    tail.set(junk, a.length + b.length);
    const tiff = deflate(
      2,
      5,
      (at) => [
        [at, a.length],
        [at + a.length, b.length],
        [at + a.length + b.length, junk.length],
        [at + a.length + b.length, junk.length],
        [at + a.length + b.length, junk.length],
      ],
      tail,
    );
    expect(Array.from(decodeTiff(tiff).pixels)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('refuses Deflate strips that together are longer than the file', () => {
    // 128 strips of one blob: together longer than the file.
    const blob = rowOf(5);
    const tiff = deflate(
      128,
      128,
      (at) => Array.from({ length: 128 }, () => [at, blob.length] as const),
      blob,
    );
    expect(thrown(() => decodeTiff(tiff))).toMatchObject({
      name: 'MalformedInputError',
      code: 'malformed-input',
      format: 'tiff',
      message: 'TIFF: strip data overlaps',
    });
  });
});

describe('PNG embed checks the IHDR size first', () => {
  const idat = zlibOfZeroBytes(16);

  it('refuses a width or height above maxImageDimension', () => {
    const above = INTERNAL_LIMITS.maxImageDimension + 1;
    expectLimit(() => embedPng(buildPng(above, 1, 6, idat)), 'maxImageDimension', above);
    expectLimit(() => embedPng(buildPng(1, above, 6, idat)), 'maxImageDimension', above);
  });

  it('refuses width x height above maxImagePixels', () => {
    expectLimit(() => embedPng(buildPng(20000, 20000, 2, idat)), 'maxImagePixels', 4e8);
  });

  it('refuses decoded bytes above maxImageBytes', () => {
    expectLimit(() => embedPng(buildPng(16384, 16384, 6, idat)), 'maxImageBytes', 2 ** 30);
  });
});

describe('PNG embed inflates only the size the IHDR implies', () => {
  /** Scanlines of a 16 x 16 RGBA image: filter byte 0, then 64 patterned bytes per row. */
  const SCANLINES = 16 * (1 + 16 * 4);
  const pixels = (): Uint8Array => {
    const data = new Uint8Array(SCANLINES);
    for (let i = 0; i < data.length; i++) data[i] = i % 65 === 0 ? 0 : (i * 31) & 0xff;
    return data;
  };
  const withTrailing = (extra: number): Uint8Array => {
    const data = new Uint8Array(SCANLINES + extra).fill(0x5a);
    data.set(pixels());
    return data;
  };

  it('decodes data of exactly the implied size', () => {
    const image = embedPng(buildPng(16, 16, 6, zlibSync(pixels())));
    expect(image).toMatchObject({ width: 16, height: 16, colorSpace: 'DeviceRGB' });
  });

  it('ignores data past the implied size: the pixels are those of a PNG without it', () => {
    const control = embedPng(buildPng(16, 16, 6, zlibSync(pixels())));
    for (const extra of [1, 1040, 100_000]) {
      const image = embedPng(buildPng(16, 16, 6, zlibSync(withTrailing(extra))));
      expect(image.imageData).toEqual(control.imageData);
      expect(image.smaskData).toEqual(control.smaskData);
    }
  });

  it('ignores data past the implied size on the transparency path', () => {
    const control = embedPng(buildPng(16, 16, 6, zlibSync(pixels())));
    expect(embedPng(buildPng(16, 16, 6, zlibSync(withTrailing(5000)))).imageData).toEqual(
      control.imageData,
    );
  });

  it('passes the data of an RGB image without transparency through without inflating it', () => {
    const idat = zlibOfZeroBytes(10_000);
    expect(embedPng(buildPng(8, 8, 2, idat)).imageData).toEqual(idat);
  });
});

describe('WOFF decode inflates each table only up to its stated length', () => {
  it('refuses a table that inflates past its stated length', () => {
    const woff = buildWoff([{ tag: 'glyf', stored: zlibOfZeroBytes(4097), origLength: 4096 }]);
    expect(thrown(() => decodeWoff(woff))).toMatchObject({
      name: 'MalformedInputError',
      code: 'malformed-input',
      format: 'woff',
      message: 'WOFF1: inflated table size mismatch',
    });
  });

  it('keeps the mismatch error for a table shorter than stated', () => {
    const woff = buildWoff([{ tag: 'glyf', stored: zlibOfZeroBytes(100), origLength: 4096 }]);
    expect((thrown(() => decodeWoff(woff)) as Error).message).toBe(
      'WOFF1: inflated table size mismatch',
    );
  });

  it('decodes a table of exactly its stated length', () => {
    const woff = buildWoff([{ tag: 'glyf', stored: zlibOfZeroBytes(4096), origLength: 4096 }]);
    expect(decodeWoff(woff).length).toBe(12 + 16 + 4096);
  });
});

describe('WOFF decode refuses table data that overlaps', () => {
  it('refuses tables that point at the same data', () => {
    const woff = buildWoffSharedBlob(3, zlibOfZeroBytes(1), 1);
    expect(thrown(() => decodeWoff(woff))).toMatchObject({
      name: 'MalformedInputError',
      code: 'malformed-input',
      format: 'woff',
      message: 'WOFF1: table data overlaps',
    });
  });

  it('decodes tables that follow one another, and a table of length 0 inside another', () => {
    const tables = ['aaaa', 'bbbb', 'cccc'].map((tag) => ({
      tag,
      stored: zlibOfZeroBytes(64),
      origLength: 64,
    }));
    expect(decodeWoff(buildWoff(tables)).length).toBe(12 + 3 * 16 + 3 * 64);
    const empty = buildWoff([
      { tag: 'aaaa', stored: zlibOfZeroBytes(64), origLength: 64 },
      { tag: 'bbbb', stored: new Uint8Array(0), origLength: 0 },
    ]);
    // Point the empty table into the middle of the first one.
    new DataView(empty.buffer).setUint32(44 + 20 + 4, 44 + 40 + 4, false);
    expect(decodeWoff(empty).length).toBe(12 + 2 * 16 + 64);
  });
});

describe('WOFF decode checks the total font size first', () => {
  it('refuses original lengths that sum above maxFontBytes', () => {
    const third = Math.floor(INTERNAL_LIMITS.maxFontBytes / 3) + 1;
    const woff = buildWoff(
      ['aaaa', 'bbbb', 'cccc'].map((tag) => ({
        tag,
        stored: zlibOfZeroBytes(8),
        origLength: third,
      })),
      12,
    );
    expectLimit(() => decodeWoff(woff), 'maxFontBytes', 3 * third);
  });

  it('refuses a totalSfntSize above maxFontBytes', () => {
    const woff = buildWoff(
      [{ tag: 'glyf', stored: zlibOfZeroBytes(8), origLength: 8 }],
      INTERNAL_LIMITS.maxFontBytes + 1,
    );
    expectLimit(() => decodeWoff(woff), 'maxFontBytes', INTERNAL_LIMITS.maxFontBytes + 1);
  });
});

describe('TIFF negative sizes', () => {
  /** One strip of one 8-bit gray row; `widthType` 9 stores the width as SLONG. */
  function tiffWithWidth(widthType: number, width: number, height: number): Uint8Array {
    const entries: [number, number, number][] = [
      [256, widthType, width >>> 0],
      [257, 4, height >>> 0],
      [258, 3, 8],
      [259, 3, 1],
      [262, 3, 1],
      [273, 4, 200],
      [277, 3, 1],
      [278, 4, 1],
      [279, 4, 16],
    ];
    const bytes = new Uint8Array(256);
    const view = new DataView(bytes.buffer);
    bytes.set([0x49, 0x49, 42, 0]);
    view.setUint32(4, 8, true);
    view.setUint16(8, entries.length, true);
    entries.forEach(([tag, type, value], i) => {
      const at = 10 + i * 12;
      view.setUint16(at, tag, true);
      view.setUint16(at + 2, type, true);
      view.setUint32(at + 4, 1, true);
      if (type === 3) view.setUint16(at + 8, value, true);
      else view.setUint32(at + 8, value, true);
    });
    return bytes;
  }

  it('decodes an ordinary LONG width', () => {
    expect(decodeTiff(tiffWithWidth(4, 4, 1)).width).toBe(4);
  });

  it.each([
    ['one', -1, 1],
    ['a large one', -65_536, 4096],
  ])('throws the TIFF error for a negative SLONG width (%s)', (_name, width, height) => {
    const error = thrown(() => decodeTiff(tiffWithWidth(9, width, height))) as Error;
    expect(error).not.toBeInstanceOf(ResourceLimitError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('TIFF: negative ImageWidth, ImageLength or sample size');
  });
});

// ---------------------------------------------------------------------------
// The limits option of the standalone decoders
// ---------------------------------------------------------------------------

/** What a refusal under a limit the caller set carries: the limit, the value it was set to, and `source` "option". */
function expectOptionLimit(fn: () => unknown, limit: LimitName, max: number, actual: number): void {
  expect(thrown(fn)).toMatchObject({
    name: 'ResourceLimitError',
    code: 'resource-limit-exceeded',
    limit,
    max,
    actual,
    source: 'option',
  });
}

/** A context over the limits `overrides` set, as the public decoders start one. */
const under = (overrides: PdfLimits): LimitContext => beginCall(resolveLimits(overrides));

/** A 10 x 10 gray TIFF, one strip of 100 bytes. */
const gray10 = (): Uint8Array => buildTiffImage(10, 10, 1, new Uint8Array(100).fill(7));

/** A little-endian 8-bit gray TIFF of `frames` frames of 10 x 10, frame i filled with the byte i + 1. */
function buildGrayFrames(frames: number): Uint8Array {
  const entries = 7;
  const ifdSize = 2 + entries * 12 + 4;
  const frameSize = ifdSize + 100;
  const out = new Uint8Array(8 + frames * frameSize);
  const view = new DataView(out.buffer);
  out.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  for (let i = 0; i < frames; i++) {
    const at = 8 + i * frameSize;
    view.setUint16(at, entries, true);
    const tags: ReadonlyArray<readonly [tag: number, type: number, value: number]> = [
      [256, 4, 10],
      [257, 4, 10],
      [258, 3, 8],
      [262, 3, 1],
      [273, 4, at + ifdSize],
      [277, 3, 1],
      [279, 4, 100],
    ];
    tags.forEach(([tag, type, value], t) => {
      const entry = at + 2 + t * 12;
      view.setUint16(entry, tag, true);
      view.setUint16(entry + 2, type, true);
      view.setUint32(entry + 4, 1, true);
      view.setUint32(entry + 8, value, true);
    });
    view.setUint32(at + 2 + entries * 12, i === frames - 1 ? 0 : at + frameSize, true);
    out.fill(i + 1, at + ifdSize, at + frameSize);
  }
  return out;
}

describe('TIFF decode runs under the limits of the call', () => {
  it('refuses 10 x 10 at maxImagePixels 99 and decodes it at 100', () => {
    expectOptionLimit(
      () => decodeTiff(gray10(), { limits: { maxImagePixels: 99 } }),
      'maxImagePixels',
      99,
      100,
    );
    const image = decodeTiff(gray10(), { limits: { maxImagePixels: 100 } });
    expect(image).toMatchObject({ width: 10, height: 10, channels: 1 });
    expect(image.pixels.length).toBe(100);
  });

  it('applies the option with a page index, and to maxImageDimension and maxImageBytes', () => {
    const tiff = buildGrayFrames(2);
    expect(decodeTiff(tiff, { page: 1, limits: { maxImagePixels: 100 } }).pixels[0]).toBe(2);
    expectOptionLimit(
      () => decodeTiff(tiff, { page: 1, limits: { maxImagePixels: 99 } }),
      'maxImagePixels',
      99,
      100,
    );
    expectOptionLimit(
      () => decodeTiff(gray10(), { limits: { maxImageDimension: 9 } }),
      'maxImageDimension',
      9,
      10,
    );
    expect(decodeTiff(gray10(), { limits: { maxImageDimension: 10 } }).width).toBe(10);
    expectOptionLimit(
      () => decodeTiff(gray10(), { limits: { maxImageBytes: 99 } }),
      'maxImageBytes',
      99,
      100,
    );
    expect(decodeTiff(gray10(), { limits: { maxImageBytes: 100 } }).pixels.length).toBe(100);
  });

  it('refuses the IFD walk to the page at maxImageFrames', () => {
    const tiff = buildGrayFrames(3);
    expectOptionLimit(
      () => decodeTiff(tiff, { page: 2, limits: { maxImageFrames: 2 } }),
      'maxImageFrames',
      2,
      3,
    );
    expect(decodeTiff(tiff, { page: 2, limits: { maxImageFrames: 3 } }).pixels[0]).toBe(3);
  });

  it('counts the bytes of the image toward maxTotalImageBytes', () => {
    expectOptionLimit(
      () => decodeTiff(gray10(), { limits: { maxTotalImageBytes: 99 } }),
      'maxTotalImageBytes',
      99,
      100,
    );
    expect(decodeTiff(gray10(), { limits: { maxTotalImageBytes: 100 } }).pixels.length).toBe(100);
  });

  it('keeps the defaults when the option sets nothing, and checks the option first', () => {
    expect(decodeTiff(gray10(), { limits: {} }).width).toBe(10);
    expect(thrown(() => decodeTiff(gray10(), { limits: { maxImagePixels: 0 } }))).toMatchObject({
      name: 'InvalidArgumentError',
      argument: 'limits.maxImagePixels',
    });
    expect(
      thrown(() => decodeTiff(new Uint8Array(8), { limits: { nope: 1 } as PdfLimits })),
    ).toMatchObject({ name: 'InvalidArgumentError', argument: 'limits.nope' });
  });

  it('does not carry a limit from one call to the next', () => {
    expect(() => decodeTiff(gray10(), { limits: { maxImagePixels: 99 } })).toThrow(
      ResourceLimitError,
    );
    expect(decodeTiff(gray10()).width).toBe(10);
  });
});

describe('decodeTiffPage and decodeTiffAll run under the limits of the call', () => {
  it('decodeTiffPage refuses 10 x 10 at maxImagePixels 99 and decodes it at 100', () => {
    const tiff = buildGrayFrames(2);
    expectOptionLimit(
      () => decodeTiffPage(tiff, 1, { limits: { maxImagePixels: 99 } }),
      'maxImagePixels',
      99,
      100,
    );
    expect(decodeTiffPage(tiff, 1, { limits: { maxImagePixels: 100 } }).pixels[0]).toBe(2);
  });

  it('decodeTiffAll refuses when the frames together are above maxTotalImageBytes', () => {
    const tiff = buildGrayFrames(3);
    // Each frame is 100 bytes, within maxImageBytes; the three together are 300.
    expectOptionLimit(
      () => decodeTiffAll(tiff, { limits: { maxTotalImageBytes: 299 } }),
      'maxTotalImageBytes',
      299,
      300,
    );
    const images = decodeTiffAll(tiff, { limits: { maxTotalImageBytes: 300 } });
    expect(images.map((image) => image.pixels[0])).toEqual([1, 2, 3]);
  });

  it('decodeTiffAll keeps the total of one call apart from the total of another', () => {
    const tiff = buildGrayFrames(3);
    const limits = { maxTotalImageBytes: 300 };
    expect(decodeTiffAll(tiff, { limits })).toHaveLength(3);
    expect(decodeTiffAll(tiff, { limits })).toHaveLength(3);
  });

  it('decodeTiffAll applies the per-image limits and the frame limit', () => {
    const tiff = buildGrayFrames(3);
    expectOptionLimit(
      () => decodeTiffAll(tiff, { limits: { maxImagePixels: 99 } }),
      'maxImagePixels',
      99,
      100,
    );
    expectOptionLimit(
      () => decodeTiffAll(tiff, { limits: { maxImageFrames: 2 } }),
      'maxImageFrames',
      2,
      3,
    );
    expect(decodeTiffAll(tiff, { limits: { maxImageFrames: 3 } })).toHaveLength(3);
  });

  it('check the option before reading the file', () => {
    for (const fn of [
      () => decodeTiffAll(new Uint8Array(0), { limits: { maxImageFrames: 1.5 } }),
      () => decodeTiffPage(new Uint8Array(0), 0, { limits: { maxImageFrames: 1.5 } }),
    ]) {
      expect(thrown(fn)).toMatchObject({
        name: 'InvalidArgumentError',
        argument: 'limits.maxImageFrames',
      });
    }
  });
});

describe('TIFF direct embed runs under the limits of the call', () => {
  it('refuses 10 x 10 at maxImagePixels 99 and embeds it at 100', () => {
    expectOptionLimit(
      () => embedTiffDirect(gray10(), { limits: { maxImagePixels: 99 } }),
      'maxImagePixels',
      99,
      100,
    );
    expect(embedTiffDirect(gray10(), { limits: { maxImagePixels: 100 } })).toMatchObject({
      width: 10,
      height: 10,
    });
  });

  it('applies the option with a page index, and to maxImageDimension', () => {
    expect(
      embedTiffDirect(buildGrayFrames(2), { page: 1, limits: { maxImagePixels: 100 } }).data[0],
    ).toBe(2);
    expectOptionLimit(
      () => embedTiffDirect(gray10(), { limits: { maxImageDimension: 9 } }),
      'maxImageDimension',
      9,
      10,
    );
  });

  it('refuses strips above maxImageBytes and tiles above it', () => {
    expectOptionLimit(
      () => embedTiffDirect(gray10(), { limits: { maxImageBytes: 99 } }),
      'maxImageBytes',
      99,
      100,
    );
    expect(embedTiffDirect(gray10(), { limits: { maxImageBytes: 100 } }).data.length).toBe(100);
    const tiled = buildTiff(
      [
        [256, 4, 1, 32],
        [257, 4, 1, 32],
        [258, 3, 1, 8],
        [262, 3, 1, 1],
        [277, 3, 1, 1],
        [322, 4, 1, 16],
        [323, 4, 1, 16],
        [324, 4, 1, 0],
        [325, 4, 1, 16],
      ],
      new Uint8Array(1024),
    );
    // 32 x 32 samples of one byte: 1,024 bytes.
    expectOptionLimit(
      () => embedTiffDirect(tiled, { limits: { maxImageBytes: 1023 } }),
      'maxImageBytes',
      1023,
      1024,
    );
    expect(embedTiffDirect(tiled, { limits: { maxImageBytes: 1024 } })).toMatchObject({
      width: 32,
    });
  });

  it('checks the option before reading the file', () => {
    expect(
      thrown(() => embedTiffDirect(new Uint8Array(0), { limits: { maxImagePixels: -1 } })),
    ).toMatchObject({ name: 'InvalidArgumentError', argument: 'limits.maxImagePixels' });
  });
});

describe('PNG embed runs under the limits of its context', () => {
  /** A 10 x 10 RGB PNG: 300 decoded sample bytes, passed through as stored. */
  const rgb10 = (): Uint8Array => buildPng(10, 10, 2, zlibOfZeroBytes(310));

  it('refuses 10 x 10 at maxImagePixels 99 and embeds it at 100', () => {
    expectOptionLimit(
      () => embedPng(rgb10(), under({ maxImagePixels: 99 })),
      'maxImagePixels',
      99,
      100,
    );
    expect(embedPng(rgb10(), under({ maxImagePixels: 100 }))).toMatchObject({
      width: 10,
      height: 10,
    });
  });

  it('applies maxImageDimension, maxImageBytes and maxTotalImageBytes', () => {
    expectOptionLimit(
      () => embedPng(rgb10(), under({ maxImageDimension: 9 })),
      'maxImageDimension',
      9,
      10,
    );
    expectOptionLimit(
      () => embedPng(rgb10(), under({ maxImageBytes: 299 })),
      'maxImageBytes',
      299,
      300,
    );
    expect(embedPng(rgb10(), under({ maxImageBytes: 300 })).width).toBe(10);
    expectOptionLimit(
      () => embedPng(rgb10(), under({ maxTotalImageBytes: 299 })),
      'maxTotalImageBytes',
      299,
      300,
    );
    expect(embedPng(rgb10(), under({ maxTotalImageBytes: 300 })).width).toBe(10);
  });

  it('keeps the default limits without a context', () => {
    expect(embedPng(rgb10()).width).toBe(10);
  });
});

describe('WOFF decode runs under the limits of the call', () => {
  const table = (origLength: number) => [
    { tag: 'glyf', stored: zlibOfZeroBytes(origLength), origLength },
  ];

  it('refuses table lengths above maxFontBytes and accepts them at it', () => {
    // One table of 64 bytes; the sfnt is 12 + 16 + 64 = 92 bytes.
    expectOptionLimit(
      () => decodeWoff(buildWoff(table(64)), { limits: { maxFontBytes: 63 } }),
      'maxFontBytes',
      63,
      64,
    );
    expectOptionLimit(
      () => decodeWoff(buildWoff(table(64)), { limits: { maxFontBytes: 91 } }),
      'maxFontBytes',
      91,
      92,
    );
    expect(decodeWoff(buildWoff(table(64)), { limits: { maxFontBytes: 92 } }).length).toBe(92);
  });

  it('refuses a table above maxDecodedStreamBytes before inflating it', () => {
    expectOptionLimit(
      () => decodeWoff(buildWoff(table(64)), { limits: { maxDecodedStreamBytes: 63 } }),
      'maxDecodedStreamBytes',
      63,
      64,
    );
    expect(decodeWoff(buildWoff(table(64)), { limits: { maxDecodedStreamBytes: 64 } }).length).toBe(
      92,
    );
  });

  it('checks the option first and keeps the defaults without one', () => {
    expect(
      thrown(() => decodeWoff(new Uint8Array(0), { limits: { maxFontBytes: 0 } })),
    ).toMatchObject({ name: 'InvalidArgumentError', argument: 'limits.maxFontBytes' });
    expect(decodeWoff(buildWoff(table(64))).length).toBe(92);
  });
});

describe('extractMetrics runs under the limits of the call', () => {
  it.each([4, 12] as const)(
    'refuses a format %i cmap of 95 codes at maxFontCmapMappings 94 and reads it at 95',
    (format) => {
      const font = buildCmapFont({ format, numGlyphs: 600, ranges: [[0x20, 0x7e, 1]] });
      expectOptionLimit(
        () => extractMetrics(font, { limits: { maxFontCmapMappings: 94 } }),
        'maxFontCmapMappings',
        94,
        95,
      );
      expect(extractMetrics(font, { limits: { maxFontCmapMappings: 95 } }).cmapTable.size).toBe(95);
    },
  );

  it('checks the option first and keeps the defaults without one', () => {
    expect(
      thrown(() =>
        extractMetrics(new Uint8Array(0), { limits: { maxFontCmapMappings: 0x110001 } }),
      ),
    ).toMatchObject({ name: 'InvalidArgumentError', argument: 'limits.maxFontCmapMappings' });
    const font = buildCmapFont({ format: 12, numGlyphs: 600, ranges: [[0x20, 0x7e, 1]] });
    expect(extractMetrics(font).cmapTable.size).toBe(95);
  });
});

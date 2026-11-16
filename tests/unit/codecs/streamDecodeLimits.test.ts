/**
 * Tests for the limits of the stream filters: ordinary streams decode to the same bytes (SHA-256
 * controls), the decoded-size ceiling applies to each filter's output, the LZW table stops at 4096
 * entries, predictor parameters are validated, and every decoder of the codec path checks the
 * limits of the call (a `limits` option, or a context) at the limit and one above it.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deflateSync, zlibSync } from 'fflate';
import { INTERNAL_LIMITS, beginCall, resolveLimits } from '../../../src/internal/limits.js';
import type { LimitContext } from '../../../src/internal/limits.js';
import type { PdfLimits } from '../../../src/limits.js';
import { PdfArray, PdfDict, PdfName, PdfNumber, PdfStream } from '../../../src/core/pdfObjects.js';
import { ResourceLimitError, UnsupportedFeatureError } from '../../../src/errors.js';
import {
  decodeFlateOnly,
  decodeStream,
  decodeStreamData,
} from '../../../src/codecs/streamDecode.js';
import {
  inflateFlate,
  inflateFlateUpTo,
  inflateRaw,
} from '../../../src/codecs/internal/pdfFlate.js';
import { decodeCCITT } from '../../../src/codecs/internal/ccittDecode.js';
import {
  controlStreams,
  lzwEncode,
  pseudoRandomBytes,
} from '../../adversarial/filter-limits.bodies.js';

const LIMIT = INTERNAL_LIMITS.maxDecodedStreamBytes;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function makeParms(entries: Record<string, number>): PdfDict {
  const dict = new PdfDict();
  for (const [key, value] of Object.entries(entries)) dict.set(key, PdfNumber.of(value));
  return dict;
}

/** A stream with `/Filter [/FlateDecode]` and the given decode parameters. */
function flateStream(data: Uint8Array, parms: Record<string, number>): PdfStream {
  const dict = new PdfDict().set('/Filter', PdfArray.of([PdfName.of('FlateDecode')]));
  dict.set('/DecodeParms', makeParms(parms));
  return new PdfStream(dict, data);
}

/** The SHA-256 of each control stream's decoded bytes (the same before the limits were added). */
const CONTROL_HASHES: Readonly<Record<string, string>> = {
  'lzw-clears': '54a19b88a8a4537459b042d58d5cd39e517323c9987a970618069c6e4c6c4bd3',
  'lzw-full-table': '341149d6249936c742ed2e26737519251fb132bae9ad2aa25343c53de2e89797',
  'run-length': 'f5c637deb5bec2ae42c460bcc437cc656bfcd7c97717255cc19f0ac1c3cc92f5',
  'ascii-hex': '0aa770a907aa1f1a6733d347e1b263a80045972c98a46cdeaef145b2923db9ea',
  ascii85: '7198ac53c3699c9fdd7cccbc933b7e45f9e765b0cd0ad5f86d66e80719d62076',
  'predictor-12-5-1-8': '5ce64680ddefc2b49a95518a376b9f576053bba2db69f7fb716151db55de0776',
  'predictor-15-17-3-8': 'a20c2b7dd12534935e3a908b8eadea4ec92ec96506d12541d0d3e44f61f6494d',
  'predictor-11-33-1-1': '7fda1f74582a5f2f925eb2e6b5ac0392ddc83f9589df52f43ac6cf1c65ca682c',
  'predictor-13-9-3-4': 'a01e52afddc54126ee56a1019c1708f1e02b3564c26e51b78b9f068f0e53d18a',
  'predictor-14-6-2-16': '1b139f3347881a4b9b93659f8aec6236597dc5e01d44773308d5cd2dc0506f31',
  'predictor-10-7-4-2': '770bc7a77f16d7b8142d3a747f5da42d7beb9a51b7487be2fa7d027260669fe6',
  'predictor-2-5-1-8': '09be6a90d937ea6e98dee03e6b947904ef46baa5ab7caecbc269c5c46309ba21',
  'predictor-2-7-3-8': '982e36d0388c5a02330574df52c400021b9b29a6e0ef0c485a1156949e9ffa34',
  'predictor-2-6-2-16': 'ab1f8788a1aff1661ca25b5db2d11e8b9b1315bb55df3239d78ab72c3ee65462',
  'predictor-2-10-3-4': 'f17e6e6c04a1a4266d63fbf259d6f773d391cc00ee2bf223ab764fcd2c9fc347',
  'predictor-2-13-1-1': '8f4a66b9499a28de511e0a22a3e3ab28498f9df7eeaeb2a74cfa1026b50634cf',
  'predictor-2-11-2-2': '9b677df48aa4be33c6de528f64c94a9c4bebc6a226dbffb2a2b3634e0250e530',
};

describe('ordinary streams decode to the same bytes', () => {
  const controls = controlStreams();

  it('covers every golden hash and nothing else', () => {
    expect(controls.map((c) => c.name).toSorted()).toEqual(Object.keys(CONTROL_HASHES).toSorted());
  });

  for (const control of controls) {
    it(`decodes the ${control.name} control stream`, () => {
      const out = decodeStream(control.data, control.filters, control.parms);
      expect(sha256(out)).toBe(CONTROL_HASHES[control.name]);
      if (control.source) expect(sha256(control.source)).toBe(sha256(out));
    });
  }
});

describe('LZWDecode table', () => {
  it('decodes a stream that fills the table and never clears it', () => {
    const src = pseudoRandomBytes(11, 150_000, 8);
    const out = decodeStream(lzwEncode(src), 'LZWDecode');
    expect(sha256(out)).toBe(sha256(src));
  });

  it('decodes a stream that clears the table every 4094 entries', () => {
    const src = pseudoRandomBytes(12, 150_000, 8);
    const out = decodeStream(lzwEncode(src, { clearAt: 4094 }), 'LZWDecode');
    expect(sha256(out)).toBe(sha256(src));
  });
});

describe('the decoded-size limit', () => {
  it('accepts a filter output of exactly the limit', () => {
    const data = new Uint8Array(LIMIT);
    expect(decodeStream(data, 'DCTDecode')).toHaveLength(LIMIT);
    expect(decodeStream(data, ['Crypt', 'DCTDecode'])).toHaveLength(LIMIT);
  });

  it('throws ResourceLimitError above the decoded-size limit', () => {
    const data = new Uint8Array(LIMIT + 1);
    const call = (): Uint8Array => decodeStream(data, 'DCTDecode');
    expect(call).toThrow(ResourceLimitError);
    try {
      call();
    } catch (err) {
      expect(err).toMatchObject({
        code: 'resource-limit-exceeded',
        limit: 'maxDecodedStreamBytes',
        max: LIMIT,
        actual: LIMIT + 1,
      });
    }
  });

  // Decodes 256 MiB of hex: under v8 coverage that takes far longer than the default 5 s.
  it('applies the limit to each filter of a chain', { timeout: 300_000 }, () => {
    const data = new Uint8Array(LIMIT + 1);
    expect(() => decodeStream(data, ['DCTDecode', 'ASCIIHexDecode'])).toThrow(ResourceLimitError);
    // The limit is on a filter's output: here the hex filter outputs nothing from zero bytes.
    expect(() => decodeStream(data, ['ASCIIHexDecode', 'DCTDecode'])).not.toThrow();
  });

  it('refuses a predictor row longer than the limit', () => {
    const data = zlibSync(new Uint8Array(10));
    for (const predictor of [2, 12]) {
      const parms = makeParms({ '/Predictor': predictor, '/Columns': LIMIT + 1 });
      expect(() => decodeStream(data, 'FlateDecode', parms)).toThrow(ResourceLimitError);
    }
    const wide = makeParms({ '/Predictor': 2, '/Columns': 2 ** 40, '/Colors': 32 });
    expect(() => decodeStream(data, 'FlateDecode', wide)).toThrow(ResourceLimitError);
    const stream = flateStream(data, { '/Predictor': 20, '/Columns': 2_147_483_647 });
    expect(() => decodeFlateOnly(stream)).toThrow(ResourceLimitError);
  });

  it('accepts a predictor row of exactly the limit when the data holds no full row', () => {
    const data = zlibSync(new Uint8Array(10));
    const parms = makeParms({ '/Predictor': 12, '/Columns': LIMIT });
    expect(decodeStream(data, 'FlateDecode', parms)).toHaveLength(0);
  });
});

describe('predictor parameters', () => {
  const data = zlibSync(new Uint8Array(40));
  const message = (c: number, k: number, b: number): string =>
    `Predictor: unsupported decode parameters (/Columns ${c}, /Colors ${k}, /BitsPerComponent ${b})`;
  const REFUSED: readonly (readonly [string, Record<string, number>, string])[] = [
    ['/Columns 0', { '/Columns': 0 }, message(0, 1, 8)],
    ['a negative /Columns', { '/Columns': -3 }, message(-3, 1, 8)],
    ['/Colors 0', { '/Columns': 4, '/Colors': 0 }, message(4, 0, 8)],
    ['/Colors 33', { '/Columns': 4, '/Colors': 33 }, message(4, 33, 8)],
    ['/BitsPerComponent 0', { '/Columns': 4, '/BitsPerComponent': 0 }, message(4, 1, 0)],
    ['/BitsPerComponent 3', { '/Columns': 4, '/BitsPerComponent': 3 }, message(4, 1, 3)],
    ['/BitsPerComponent 32', { '/Columns': 4, '/BitsPerComponent': 32 }, message(4, 1, 32)],
    ['a /Columns that rounds to 0', { '/Columns': 0.4 }, message(0, 1, 8)],
  ];

  describe('refuses parameters outside the accepted range', () => {
    for (const predictor of [2, 10, 12, 15]) {
      for (const [title, extra, expected] of REFUSED) {
        it(`${title} with /Predictor ${predictor}`, () => {
          const parms = makeParms({ '/Predictor': predictor, ...extra });
          expect(() => decodeStream(data, 'FlateDecode', parms)).toThrow(
            new UnsupportedFeatureError(expected),
          );
          const stream = flateStream(data, { '/Predictor': predictor, ...extra });
          expect(() => decodeFlateOnly(stream)).toThrow(new UnsupportedFeatureError(expected));
        });
      }
    }

    it('with a /Predictor above 15 in a stream read with decodeFlateOnly', () => {
      const stream = flateStream(data, { '/Predictor': 20, '/Columns': 0 });
      expect(() => decodeFlateOnly(stream)).toThrow(new UnsupportedFeatureError(message(0, 1, 8)));
    });

    it('in an LZWDecode stream', () => {
      const lzw = lzwEncode(new Uint8Array(40));
      const parms = makeParms({ '/Predictor': 2, '/Columns': 0 });
      expect(() => decodeStream(lzw, 'LZWDecode', parms)).toThrow(
        new UnsupportedFeatureError(message(0, 1, 8)),
      );
    });
  });

  it('leaves the data unchanged for /Predictor 1 and the values 3 to 9, whatever the other parameters', () => {
    const plain = decodeStream(data, 'FlateDecode');
    for (const predictor of [1, 3, 5, 9]) {
      const parms = makeParms({ '/Predictor': predictor, '/Columns': 0, '/Colors': 0 });
      expect(decodeStream(data, 'FlateDecode', parms)).toEqual(plain);
    }
  });

  it('accepts /Colors 1 to 32 and /BitsPerComponent 1, 2, 4, 8 and 16', () => {
    for (const colors of [1, 3, 32]) {
      for (const bpc of [1, 2, 4, 8, 16]) {
        const parms = makeParms({
          '/Predictor': 2,
          '/Columns': 3,
          '/Colors': colors,
          '/BitsPerComponent': bpc,
        });
        expect(decodeStream(data, 'FlateDecode', parms)).toHaveLength(40);
      }
    }
  });

  it('reads a fractional /Columns rounded to an integer', () => {
    const parms = makeParms({ '/Predictor': 2, '/Columns': 2.6 });
    expect(decodeStream(data, 'FlateDecode', parms)).toHaveLength(40);
  });
});

describe("predictors work in place on the decoder's own buffer", () => {
  it("leave the caller's encoded bytes unchanged for every predictor and filter", () => {
    const built = [2, 10, 11, 12, 13, 14, 15].flatMap((predictor) => {
      const parms = { '/Predictor': predictor, '/Columns': 7, '/Colors': 3 };
      const raw = pseudoRandomBytes(predictor, 20 * 22);
      return [
        ['FlateDecode', zlibSync(raw), parms] as const,
        ['LZWDecode', lzwEncode(raw), parms] as const,
      ];
    });
    for (const [filter, encoded, parms] of built) {
      const before = sha256(encoded);
      const first = decodeStream(encoded, filter, makeParms(parms));
      expect(sha256(encoded)).toBe(before);
      expect(decodeStream(encoded, filter, makeParms(parms))).toEqual(first);
    }
  });

  it('leave the bytes of a stream read with decodeFlateOnly unchanged', () => {
    const encoded = zlibSync(pseudoRandomBytes(3, 20 * 22));
    const stream = flateStream(encoded, { '/Predictor': 15, '/Columns': 7, '/Colors': 3 });
    const before = sha256(stream.data);
    const first = decodeFlateOnly(stream);
    expect(sha256(stream.data)).toBe(before);
    expect(decodeFlateOnly(stream)).toEqual(first);
  });

  it('returns exactly the rows of a PNG-predicted stream that ends in a partial row', () => {
    const rowBytes = 5;
    const raw = new Uint8Array(3 * (rowBytes + 1) + 2).fill(1);
    for (let r = 0; r < 3; r++) raw[r * (rowBytes + 1)] = 0;
    const out = decodeStream(
      zlibSync(raw),
      'FlateDecode',
      makeParms({ '/Predictor': 15, '/Columns': 5 }),
    );
    expect(out).toHaveLength(3 * rowBytes);
    expect([...out].every((byte) => byte === 1)).toBe(true);
  });
});

describe('the sample limit of the sub-byte TIFF predictor', () => {
  const SAMPLES = INTERNAL_LIMITS.maxPredictorSamples;

  it('refuses more samples than the limit before reading one', () => {
    // 10,000 rows of 4,000 bytes (32 colours x 1,000 columns of 1 bit): 320,000,000 samples.
    const zeros = zlibSync(new Uint8Array(40_000_000));
    const parms = makeParms({
      '/Predictor': 2,
      '/Columns': 1000,
      '/Colors': 32,
      '/BitsPerComponent': 1,
    });
    const call = (): Uint8Array => decodeStream(zeros, 'FlateDecode', parms);
    expect(call).toThrow(ResourceLimitError);
    try {
      call();
    } catch (err) {
      expect(err).toMatchObject({
        code: 'resource-limit-exceeded',
        limit: 'maxPredictorSamples',
        max: SAMPLES,
        actual: 320_000_000,
      });
    }
    const stream = flateStream(zeros, {
      '/Predictor': 2,
      '/Columns': 1000,
      '/Colors': 32,
      '/BitsPerComponent': 1,
    });
    expect(() => decodeFlateOnly(stream)).toThrow(ResourceLimitError);
  });

  it('does not apply to 8-bit and 16-bit samples, whose loop is per byte', () => {
    const zeros = zlibSync(new Uint8Array(40_000_000));
    for (const bpc of [8, 16]) {
      const parms = makeParms({
        '/Predictor': 2,
        '/Columns': 1000,
        '/Colors': 32,
        '/BitsPerComponent': bpc,
      });
      expect(decodeStream(zeros, 'FlateDecode', parms)).toHaveLength(
        40_000_000 - (40_000_000 % (1000 * 32 * (bpc / 8))),
      );
    }
  });
});

/** The context of a call made with the `limits` option `limits`. */
const contextOf = (limits: PdfLimits): LimitContext => beginCall(resolveLimits(limits));

/** The error `call` throws; fails the test when it returns. */
function thrown(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to throw');
}

/** Expects `call` to throw the ResourceLimitError of a limit an option set. */
function expectOptionLimit(call: () => unknown, limit: string, max: number, actual: number): void {
  const err = thrown(call);
  expect(err).toBeInstanceOf(ResourceLimitError);
  expect(err).toMatchObject({
    code: 'resource-limit-exceeded',
    limit,
    max,
    actual,
    source: 'option',
  });
}

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);

/** RunLengthDecode data of `n` zero bytes: runs of 128, then one literal run for the rest. */
function runLengthZeros(n: number): Uint8Array {
  const out: number[] = [];
  for (let left = n; left > 0;) {
    if (left >= 128) {
      out.push(129, 0);
      left -= 128;
    } else {
      out.push(left - 1, ...new Array<number>(left).fill(0));
      left = 0;
    }
  }
  out.push(128);
  return Uint8Array.from(out);
}

describe('the limits option of decodeStream', () => {
  const at = { limits: { maxDecodedStreamBytes: 1024 } } as const;
  const ENCODERS: readonly (readonly [string, (n: number) => Uint8Array])[] = [
    ['FlateDecode', (n) => zlibSync(new Uint8Array(n))],
    ['ASCIIHexDecode', (n) => ascii('00'.repeat(n))],
    ['ASCII85Decode', (n) => ascii('z'.repeat(n >> 2) + ['', '!!', '!!!', '!!!!'][n & 3]!)],
    ['LZWDecode', (n) => lzwEncode(new Uint8Array(n))],
    ['RunLengthDecode', runLengthZeros],
    ['DCTDecode', (n) => new Uint8Array(n)],
  ];

  for (const [filter, encode] of ENCODERS) {
    it(`decodes ${filter} data of 1,024 bytes under maxDecodedStreamBytes 1024 and refuses 1,025`, () => {
      expect(decodeStream(encode(1024), filter, null, at)).toEqual(new Uint8Array(1024));
      const err = thrown(() => decodeStream(encode(1025), filter, null, at));
      expect(err).toBeInstanceOf(ResourceLimitError);
      expect(err).toMatchObject({ limit: 'maxDecodedStreamBytes', max: 1024, source: 'option' });
    });
  }

  it('reports the bytes decoded when the limit is passed, and source "default" without the option', () => {
    expectOptionLimit(
      () => decodeStream(new Uint8Array(1025), 'DCTDecode', null, at),
      'maxDecodedStreamBytes',
      1024,
      1025,
    );
    const over = new Uint8Array(INTERNAL_LIMITS.maxDecodedStreamBytes + 1);
    expect(thrown(() => decodeStream(over, 'DCTDecode'))).toMatchObject({
      limit: 'maxDecodedStreamBytes',
      source: 'default',
    });
  });

  it('checks a predictor row against the option', () => {
    const data = zlibSync(new Uint8Array(10));
    const row = (columns: number): PdfDict => makeParms({ '/Predictor': 12, '/Columns': columns });
    expect(decodeStream(data, 'FlateDecode', row(1024), at)).toHaveLength(0);
    expectOptionLimit(
      () => decodeStream(data, 'FlateDecode', row(1025), at),
      'maxDecodedStreamBytes',
      1024,
      1025,
    );
  });

  it('checks the samples of the sub-byte TIFF predictor against the option', () => {
    // Rows of one byte: 8 columns of 1 bit. 8 rows are 64 samples, 9 rows 72.
    const parms = makeParms({ '/Predictor': 2, '/Columns': 8, '/BitsPerComponent': 1 });
    const options = { limits: { maxPredictorSamples: 64 } };
    expect(decodeStream(zlibSync(new Uint8Array(8)), 'FlateDecode', parms, options)).toHaveLength(
      8,
    );
    expectOptionLimit(
      () => decodeStream(zlibSync(new Uint8Array(9)), 'FlateDecode', parms, options),
      'maxPredictorSamples',
      64,
      72,
    );
  });

  it('checks the CCITTFaxDecode dimensions against the option', () => {
    const parms = (columns: number): PdfDict =>
      makeParms({ '/K': -1, '/Columns': columns, '/Rows': 1 });
    const data = new Uint8Array(64).fill(0xff);
    for (const limit of ['maxImagePixels', 'maxImageDimension'] as const) {
      const options = { limits: { [limit]: 64 } };
      expect(decodeStream(data, 'CCITTFaxDecode', parms(64), options)).toHaveLength(8);
      expectOptionLimit(
        () => decodeStream(data, 'CCITTFaxDecode', parms(65), options),
        limit,
        64,
        65,
      );
    }
  });

  it('checks the rows of a CCITTFaxDecode image without /Rows against the option', () => {
    const parms = makeParms({ '/K': -1, '/Columns': 8 });
    expectOptionLimit(
      () =>
        decodeStream(new Uint8Array(64).fill(0xff), 'CCITTFaxDecode', parms, {
          limits: { maxImagePixels: 64 },
        }),
      'maxImagePixels',
      64,
      72,
    );
  });

  it('refuses a limits option that resolveLimits refuses, before decoding', () => {
    const options = { limits: { maxDecodedStreamBytes: 0 } };
    expect(thrown(() => decodeStream(new Uint8Array(1), 'DCTDecode', null, options))).toMatchObject(
      {
        name: 'InvalidArgumentError',
        argument: 'limits.maxDecodedStreamBytes',
      },
    );
  });
});

describe('the decoded total of one call', () => {
  // 400 bytes of hex digits, then two filters that pass the data on: 3 outputs of 400 bytes.
  const data = ascii('00'.repeat(400));
  const chain = ['ASCIIHexDecode', 'Crypt', 'DCTDecode'];

  it('accepts a 3-stage chain whose outputs sum to maxTotalDecodedBytes', () => {
    const options = { limits: { maxTotalDecodedBytes: 1200 } };
    expect(decodeStream(data, chain, null, options)).toHaveLength(400);
  });

  it('refuses a 3-stage chain whose stages each fit but whose outputs sum to one more', () => {
    const options = { limits: { maxTotalDecodedBytes: 1199 } };
    expectOptionLimit(
      () => decodeStream(data, chain, null, options),
      'maxTotalDecodedBytes',
      1199,
      1200,
    );
  });

  it('refuses a chain whose last filter takes the total one past the limit', () => {
    // The hex stage outputs 1,000 of 1,024 bytes; the Flate stage may then decode 24, not 25.
    const flate = zlibSync(new Uint8Array(25));
    const digits = [...flate].map((b) => b.toString(16).padStart(2, '0')).join('');
    const hex = ascii(digits + '00'.repeat(1000 - flate.length));
    const options = { limits: { maxTotalDecodedBytes: 1024 } };
    const ok = { limits: { maxTotalDecodedBytes: 1025 } };
    expect(decodeStream(hex, ['ASCIIHexDecode', 'FlateDecode'], null, ok)).toHaveLength(25);
    expect(
      thrown(() => decodeStream(hex, ['ASCIIHexDecode', 'FlateDecode'], null, options)),
    ).toMatchObject({ limit: 'maxTotalDecodedBytes', max: 1024, source: 'option' });
  });

  it('stops reading Flate input at the part of the decoded total the call has left', () => {
    // Stored (level 0) zlib data: each 16 KiB step of input decodes to about 16 KiB.
    const data = zlibSync(new Uint8Array(1 << 20), { level: 0 });
    const ctx = contextOf({ maxTotalDecodedBytes: 1024 });
    ctx.totals.decodedBytes = 1000;
    const err = thrown(() => inflateFlate(data, ctx));
    expect(err).toMatchObject({ limit: 'maxTotalDecodedBytes', max: 1024, source: 'option' });
    // Decoding the whole 1 MiB first would report 1000 + 1,048,576.
    expect((err as ResourceLimitError).actual).toBeLessThan(1000 + 64 * 1024);
  });

  it('sums the streams decoded under one context', () => {
    const ctx = contextOf({ maxTotalDecodedBytes: 2048 });
    const dict = new PdfDict().set('/Filter', PdfName.of('FlateDecode'));
    const stream = new PdfStream(dict, zlibSync(new Uint8Array(1024)));
    expect(decodeStreamData(stream, ctx)).toHaveLength(1024);
    expect(decodeFlateOnly(stream, ctx)).toHaveLength(1024);
    expect(ctx.totals.decodedBytes).toBe(2048);
    expect(thrown(() => decodeStreamData(stream, ctx))).toMatchObject({
      limit: 'maxTotalDecodedBytes',
      max: 2048,
      source: 'option',
    });
  });
});

describe('the Flate decoders take the context of the call', () => {
  const ctx = (): LimitContext => contextOf({ maxDecodedStreamBytes: 1024 });

  it('inflateFlate decodes 1,024 bytes and refuses 1,025', () => {
    expect(inflateFlate(zlibSync(new Uint8Array(1024)), ctx())).toHaveLength(1024);
    expectOptionLimit(
      () => inflateFlate(zlibSync(new Uint8Array(1025)), ctx()),
      'maxDecodedStreamBytes',
      1024,
      1025,
    );
  });

  it('inflateRaw decodes 1,024 bytes and refuses 1,025', () => {
    expect(inflateRaw(deflateSync(new Uint8Array(1024)), ctx())).toHaveLength(1024);
    expectOptionLimit(
      () => inflateRaw(deflateSync(new Uint8Array(1025)), ctx()),
      'maxDecodedStreamBytes',
      1024,
      1025,
    );
  });

  it('inflateFlateUpTo takes a bound of 1,024 bytes and refuses 1,025', () => {
    const data = zlibSync(new Uint8Array(4096));
    const read = inflateFlateUpTo(data, 1024, ctx());
    expect(read.truncated).toBe(true);
    expect(read.data).toHaveLength(1024);
    expectOptionLimit(
      () => inflateFlateUpTo(data, 1025, ctx()),
      'maxDecodedStreamBytes',
      1024,
      1025,
    );
  });

  it('decodeFlateOnly decodes 1,024 bytes and refuses 1,025, as the only and as the first filter', () => {
    const only = (n: number): PdfStream =>
      new PdfStream(
        new PdfDict().set('/Filter', PdfName.of('FlateDecode')),
        zlibSync(new Uint8Array(n)),
      );
    const first = (n: number): PdfStream =>
      new PdfStream(
        new PdfDict().set(
          '/Filter',
          PdfArray.of([PdfName.of('FlateDecode'), PdfName.of('DCTDecode')]),
        ),
        deflateSync(new Uint8Array(n)),
      );
    for (const make of [only, first]) {
      expect(decodeFlateOnly(make(1024), ctx())).toHaveLength(1024);
      expect(thrown(() => decodeFlateOnly(make(1025), ctx()))).toMatchObject({
        limit: 'maxDecodedStreamBytes',
        max: 1024,
        source: 'option',
      });
    }
  });

  it('decodeCCITT checks /Columns x /Rows against the context', () => {
    const parms = (rows: number): PdfDict => makeParms({ '/K': -1, '/Columns': 8, '/Rows': rows });
    const data = new Uint8Array(64).fill(0xff);
    const pixels = (): LimitContext => contextOf({ maxImagePixels: 64 });
    expect(() => decodeCCITT(data, parms(8), pixels())).not.toThrow();
    expectOptionLimit(() => decodeCCITT(data, parms(9), pixels()), 'maxImagePixels', 64, 72);
  });
});

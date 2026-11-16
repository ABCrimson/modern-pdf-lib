/**
 * The limits core (src/internal/limits.ts): DEFAULT_LIMITS, resolveLimits and the checks it makes on a
 * `limits` option, the per-call LimitContext and its totals, assertLimit and the assertWithinLimit
 * wrapper, the entries that export the public part, and the two error classes the root entry exports
 * for refused input: ResourceLimitError and UnsupportedFilterError.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as root from '../../../src/index.js';
import * as createEntry from '../../../src/create.js';
import * as parseEntry from '../../../src/parse.js';
import type * as RootTypes from '../../../src/index.js';
import type * as CreateTypes from '../../../src/create.js';
import type * as ParseTypes from '../../../src/parse.js';
import {
  DEFAULT_LIMITS,
  INTERNAL_LIMITS,
  LIMIT_UNITS,
  addToTotal,
  assertLimit,
  assertWithinLimit,
  beginCall,
  legacyContext,
  resolveLimits,
} from '../../../src/internal/limits.js';
import type {
  LimitContext,
  LimitName,
  PdfLimits,
  ResolvedLimits,
} from '../../../src/internal/limits.js';
import {
  InvalidArgumentError,
  ResourceLimitError,
  UnsupportedFilterError,
} from '../../../src/errors.js';

const names = Object.keys(DEFAULT_LIMITS) as LimitName[];

/** The error `run` throws, checked to be a ResourceLimitError, or undefined when it returns. */
function limitErrorOf(run: () => void): ResourceLimitError | undefined {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(ResourceLimitError);
    return err as ResourceLimitError;
  }
  return undefined;
}

/** The InvalidArgumentError resolveLimits throws for `overrides`. */
function refusal(overrides: unknown): InvalidArgumentError {
  try {
    resolveLimits(overrides as PdfLimits);
  } catch (err) {
    expect(err).toBeInstanceOf(InvalidArgumentError);
    return err as InvalidArgumentError;
  }
  throw new Error(`resolveLimits accepted ${String(overrides)}`);
}

describe('DEFAULT_LIMITS', () => {
  it('is a frozen object with the 12 per-stream limits and the 4 totals', () => {
    expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
    expect(names.toSorted()).toEqual(
      [
        'maxCMapMappings',
        'maxDecodedStreamBytes',
        'maxDerDepth',
        'maxFontBytes',
        'maxFontCmapMappings',
        'maxFormOperators',
        'maxImageBytes',
        'maxImageDimension',
        'maxImageFrames',
        'maxImagePixels',
        'maxPredictorSamples',
        'maxTreeDepth',
        'maxTotalDecodedBytes',
        'maxTotalCMapMappings',
        'maxTotalImageBytes',
        'maxPageOperators',
      ].toSorted(),
    );
  });

  it('keeps the values of 0.40.8 and sets the totals', () => {
    expect({ ...DEFAULT_LIMITS }).toEqual({
      maxDecodedStreamBytes: 2 ** 28,
      maxCMapMappings: 2 ** 20,
      maxFontCmapMappings: 0x110000,
      maxDerDepth: 128,
      maxTreeDepth: 256,
      maxFormOperators: 2 ** 20,
      maxPredictorSamples: 2 ** 28,
      maxImageDimension: 65_536,
      maxImagePixels: 2 ** 28,
      maxImageBytes: 2 ** 28,
      maxImageFrames: 4_096,
      maxFontBytes: 2 ** 27,
      maxTotalDecodedBytes: 2 ** 30,
      maxTotalCMapMappings: 2 ** 22,
      maxTotalImageBytes: 2 ** 30,
      maxPageOperators: 2 ** 24,
    });
  });

  it('has a unit for every limit, in a frozen table', () => {
    expect(Object.isFrozen(LIMIT_UNITS)).toBe(true);
    expect(Object.keys(LIMIT_UNITS).toSorted()).toEqual(names.toSorted());
    for (const name of names) expect(LIMIT_UNITS[name].length, name).toBeGreaterThan(0);
  });

  it('leaves the save-time re-wrap bound internal, at 64 MiB', () => {
    expect(Object.isFrozen(INTERNAL_LIMITS)).toBe(true);
    expect(INTERNAL_LIMITS.maxRewrapDecodedBytes).toBe(64 * 1024 * 1024);
    expect(names).not.toContain('maxRewrapDecodedBytes');
    for (const [name, value] of Object.entries(INTERNAL_LIMITS)) {
      if (name !== 'maxRewrapDecodedBytes') {
        expect(value, name).toBe(DEFAULT_LIMITS[name as LimitName]);
      }
    }
    expect(Object.keys(INTERNAL_LIMITS)).toHaveLength(13);
  });
});

describe('resolveLimits', () => {
  it('returns DEFAULT_LIMITS itself when there is nothing to apply', () => {
    expect(resolveLimits(undefined)).toBe(DEFAULT_LIMITS);
    expect(resolveLimits({})).toBe(DEFAULT_LIMITS);
    expect(resolveLimits({ maxImagePixels: undefined })).toBe(DEFAULT_LIMITS);
  });

  it('returns the base itself when there is nothing to apply over it', () => {
    const base = resolveLimits({ maxImagePixels: 99 });
    expect(resolveLimits(undefined, base)).toBe(base);
    expect(resolveLimits({}, base)).toBe(base);
  });

  it('applies the overrides over the defaults, in a new frozen object', () => {
    const limits = resolveLimits({ maxImagePixels: 99, maxDecodedStreamBytes: 2 ** 40 });
    expect(Object.isFrozen(limits)).toBe(true);
    expect(limits).toEqual({
      ...DEFAULT_LIMITS,
      maxImagePixels: 99,
      maxDecodedStreamBytes: 2 ** 40,
    });
    expect(DEFAULT_LIMITS.maxImagePixels).toBe(2 ** 28);
  });

  it('applies the overrides over a base', () => {
    const base = resolveLimits({ maxImagePixels: 99 });
    expect(resolveLimits({ maxDerDepth: 4 }, base)).toEqual({
      ...DEFAULT_LIMITS,
      maxImagePixels: 99,
      maxDerDepth: 4,
    });
  });

  it('accepts 1, the depth ceilings, the Unicode code space and the largest safe integer', () => {
    expect(resolveLimits({ maxImageFrames: 1 }).maxImageFrames).toBe(1);
    expect(resolveLimits({ maxDerDepth: 128 }).maxDerDepth).toBe(128);
    expect(resolveLimits({ maxTreeDepth: 256 }).maxTreeDepth).toBe(256);
    expect(resolveLimits({ maxFontCmapMappings: 0x110000 }).maxFontCmapMappings).toBe(0x110000);
    expect(
      resolveLimits({ maxTotalDecodedBytes: Number.MAX_SAFE_INTEGER }).maxTotalDecodedBytes,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    ['an unknown key', { maxImagePixel: 1 }, 'limits.maxImagePixel'],
    ['the internal re-wrap bound', { maxRewrapDecodedBytes: 1 }, 'limits.maxRewrapDecodedBytes'],
    ['0', { maxImagePixels: 0 }, 'limits.maxImagePixels'],
    ['-1', { maxImagePixels: -1 }, 'limits.maxImagePixels'],
    ['1.5', { maxImagePixels: 1.5 }, 'limits.maxImagePixels'],
    ['NaN', { maxImagePixels: Number.NaN }, 'limits.maxImagePixels'],
    ['Infinity', { maxImagePixels: Number.POSITIVE_INFINITY }, 'limits.maxImagePixels'],
    ['2^53', { maxTotalDecodedBytes: 2 ** 53 }, 'limits.maxTotalDecodedBytes'],
    ['a string', { maxImagePixels: '99' }, 'limits.maxImagePixels'],
    ['maxDerDepth 129', { maxDerDepth: 129 }, 'limits.maxDerDepth'],
    ['maxTreeDepth 257', { maxTreeDepth: 257 }, 'limits.maxTreeDepth'],
    [
      'maxFontCmapMappings 0x110001',
      { maxFontCmapMappings: 0x110001 },
      'limits.maxFontCmapMappings',
    ],
    ['null', null, 'limits'],
    ['a number', 5, 'limits'],
  ])('refuses %s with InvalidArgumentError naming the argument', (_title, overrides, argument) => {
    const err = refusal(overrides);
    expect(err.code).toBe('invalid-argument');
    expect(err.argument).toBe(argument);
    expect(err.message.startsWith(argument)).toBe(true);
  });

  it('states the range a value must lie in', () => {
    expect(refusal({ maxDerDepth: 129 }).message).toBe(
      'limits.maxDerDepth must be a whole number from 1 to 128, got 129',
    );
    expect(refusal({ maxImagePixels: 0 }).message).toBe(
      `limits.maxImagePixels must be a whole number from 1 to ${Number.MAX_SAFE_INTEGER}, got 0`,
    );
  });
});

describe('LimitContext', () => {
  it('starts every total at zero over the limits it is given', () => {
    const limits = resolveLimits({ maxImagePixels: 99 });
    const ctx: LimitContext = beginCall(limits);
    expect(ctx.limits).toBe(limits);
    expect(ctx.totals).toEqual({
      decodedBytes: 0,
      cmapMappings: 0,
      imageBytes: 0,
      pageOperators: 0,
    });
  });

  it('keeps the totals of two contexts apart', () => {
    const a = beginCall(DEFAULT_LIMITS);
    const b = beginCall(DEFAULT_LIMITS);
    addToTotal(a, 'maxTotalDecodedBytes', 10);
    addToTotal(a, 'maxTotalDecodedBytes', 5);
    addToTotal(b, 'maxPageOperators', 7);
    expect(a.totals).toEqual({
      decodedBytes: 15,
      cmapMappings: 0,
      imageBytes: 0,
      pageOperators: 0,
    });
    expect(b.totals).toEqual({ decodedBytes: 0, cmapMappings: 0, imageBytes: 0, pageOperators: 7 });
  });

  it.each([
    ['maxTotalDecodedBytes', 'decodedBytes', 'bytes'],
    ['maxTotalCMapMappings', 'cmapMappings', 'mappings'],
    ['maxTotalImageBytes', 'imageBytes', 'bytes'],
    ['maxPageOperators', 'pageOperators', 'operators'],
  ] as const)(
    'accepts %s up to its limit and refuses the first unit above it',
    (total, field, unit) => {
      const ctx = beginCall(resolveLimits({ [total]: 100 }));
      addToTotal(ctx, total, 60);
      addToTotal(ctx, total, 40);
      expect(ctx.totals[field]).toBe(100);
      const err = limitErrorOf(() => addToTotal(ctx, total, 1));
      expect(err).toMatchObject({
        code: 'resource-limit-exceeded',
        limit: total,
        max: 100,
        actual: 101,
        source: 'option',
        message: `Input exceeds the limit ${total} (100 ${unit}).`,
      });
    },
  );

  it('refuses a total that is not a finite number, with actual undefined', () => {
    const ctx = beginCall(DEFAULT_LIMITS);
    const err = limitErrorOf(() => addToTotal(ctx, 'maxTotalImageBytes', Number.NaN));
    expect(err).toMatchObject({
      limit: 'maxTotalImageBytes',
      actual: undefined,
      source: 'default',
    });
  });
});

describe('assertLimit', () => {
  const ctx = beginCall(DEFAULT_LIMITS);

  it('accepts a value at the limit, below it, and zero', () => {
    for (const name of names) {
      const max = DEFAULT_LIMITS[name];
      expect(
        limitErrorOf(() => assertLimit(ctx, name, max)),
        name,
      ).toBeUndefined();
      expect(
        limitErrorOf(() => assertLimit(ctx, name, max - 1)),
        name,
      ).toBeUndefined();
      expect(
        limitErrorOf(() => assertLimit(ctx, name, 0)),
        name,
      ).toBeUndefined();
    }
  });

  it('throws ResourceLimitError above a default, with the limit, max, actual, source and message', () => {
    for (const name of names) {
      const max = DEFAULT_LIMITS[name];
      const err = limitErrorOf(() => assertLimit(ctx, name, max + 1));
      expect(err, name).toMatchObject({
        name: 'ResourceLimitError',
        code: 'resource-limit-exceeded',
        limit: name,
        max,
        actual: max + 1,
        source: 'default',
        message: `Input exceeds the limit ${name} (${max} ${LIMIT_UNITS[name]}).`,
      });
    }
  });

  it('names the option as the source of a limit the caller set', () => {
    const lowered = beginCall(resolveLimits({ maxImagePixels: 99 }));
    expect(limitErrorOf(() => assertLimit(lowered, 'maxImagePixels', 99))).toBeUndefined();
    expect(limitErrorOf(() => assertLimit(lowered, 'maxImagePixels', 100))).toMatchObject({
      limit: 'maxImagePixels',
      max: 99,
      actual: 100,
      source: 'option',
      message: 'Input exceeds the limit maxImagePixels (99 pixels).',
    });
    expect(limitErrorOf(() => assertLimit(lowered, 'maxDerDepth', 129))).toMatchObject({
      max: 128,
      source: 'default',
    });
  });

  it('throws ResourceLimitError for NaN, Infinity and -Infinity, with actual undefined', () => {
    for (const actual of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        limitErrorOf(() => assertLimit(ctx, 'maxImagePixels', actual)),
        String(actual),
      ).toMatchObject({
        limit: 'maxImagePixels',
        max: DEFAULT_LIMITS.maxImagePixels,
        actual: undefined,
        message: `Input exceeds the limit maxImagePixels (${DEFAULT_LIMITS.maxImagePixels} pixels).`,
      });
    }
  });
});

describe('assertWithinLimit and legacyContext', () => {
  it('gives a fresh context over the defaults on every call', () => {
    const a = legacyContext();
    const b = legacyContext();
    expect(a).not.toBe(b);
    expect(a.limits).toBe(DEFAULT_LIMITS);
    expect(a.totals).toEqual({ decodedBytes: 0, cmapMappings: 0, imageBytes: 0, pageOperators: 0 });
  });

  it('checks against the defaults, as assertLimit does', () => {
    expect(limitErrorOf(() => assertWithinLimit('maxPredictorSamples', 2 ** 28))).toBeUndefined();
    expect(limitErrorOf(() => assertWithinLimit('maxPredictorSamples', 2 ** 28 + 1))).toMatchObject(
      {
        code: 'resource-limit-exceeded',
        limit: 'maxPredictorSamples',
        max: 2 ** 28,
        actual: 2 ** 28 + 1,
        source: 'default',
        message: 'Input exceeds the limit maxPredictorSamples (268435456 samples).',
      },
    );
  });
});

describe('the package entries', () => {
  it('export DEFAULT_LIMITS from ".", "./parse" and "./create"', () => {
    expect(root.DEFAULT_LIMITS).toBe(DEFAULT_LIMITS);
    expect(parseEntry.DEFAULT_LIMITS).toBe(DEFAULT_LIMITS);
    expect(createEntry.DEFAULT_LIMITS).toBe(DEFAULT_LIMITS);
  });

  it('export the types LimitName, PdfLimits and ResolvedLimits from the same entries', () => {
    expectTypeOf<RootTypes.LimitName>().toEqualTypeOf<LimitName>();
    expectTypeOf<ParseTypes.LimitName>().toEqualTypeOf<LimitName>();
    expectTypeOf<CreateTypes.LimitName>().toEqualTypeOf<LimitName>();
    expectTypeOf<RootTypes.PdfLimits>().toEqualTypeOf<PdfLimits>();
    expectTypeOf<ParseTypes.PdfLimits>().toEqualTypeOf<PdfLimits>();
    expectTypeOf<CreateTypes.PdfLimits>().toEqualTypeOf<PdfLimits>();
    expectTypeOf<RootTypes.ResolvedLimits>().toEqualTypeOf<ResolvedLimits>();
    expectTypeOf<ParseTypes.ResolvedLimits>().toEqualTypeOf<ResolvedLimits>();
    expectTypeOf<CreateTypes.ResolvedLimits>().toEqualTypeOf<ResolvedLimits>();
  });

  it('keep the internal helpers out of the root entry', () => {
    for (const name of [
      'INTERNAL_LIMITS',
      'LIMIT_UNITS',
      'resolveLimits',
      'beginCall',
      'assertLimit',
      'addToTotal',
      'assertWithinLimit',
      'legacyContext',
    ]) {
      expect(Object.keys(root), name).not.toContain(name);
    }
  });
});

describe('ResourceLimitError', () => {
  it('is exported from the root entry', () => {
    expect(root.ResourceLimitError).toBe(ResourceLimitError);
  });

  it('carries its fields, the message and the cause', () => {
    const cause = new Error('root');
    const err = new ResourceLimitError('maxDerDepth', 64, 'levels', 65, { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ResourceLimitError');
    expect(err.code).toBe('resource-limit-exceeded');
    expect(err.limit).toBe('maxDerDepth');
    expect(err.max).toBe(64);
    expect(err.actual).toBe(65);
    expect(err.source).toBe('default');
    expect(err.message).toBe('Input exceeds the limit maxDerDepth (64 levels).');
    expect(err.cause).toBe(cause);
  });

  it('carries the source it is given', () => {
    const err = new ResourceLimitError('maxImagePixels', 99, 'pixels', 100, { source: 'option' });
    expect(err.source).toBe('option');
    expect(err.message).toBe('Input exceeds the limit maxImagePixels (99 pixels).');
  });

  it('leaves actual undefined when no value is given', () => {
    expect(new ResourceLimitError('maxTreeDepth', 256, 'levels').actual).toBeUndefined();
  });

  it('types the limit as a LimitName', () => {
    expectTypeOf<ResourceLimitError['limit']>().toEqualTypeOf<LimitName>();
    expectTypeOf<ResourceLimitError['source']>().toEqualTypeOf<'default' | 'option'>();
  });
});

describe('UnsupportedFilterError', () => {
  const defaults = [
    ['JPXDecode', 'JPEG 2000 (JPXDecode) image data is not decoded in this release.'],
    ['JBIG2Decode', 'JBIG2 (JBIG2Decode) image data is not decoded in this release.'],
    [
      'VP8',
      'Lossy WebP (VP8) images are not decoded in this release; lossless WebP (VP8L) is supported. Convert the image to PNG or JPEG first.',
    ],
  ] as const;

  it('is exported from the root entry', () => {
    expect(root.UnsupportedFilterError).toBe(UnsupportedFilterError);
  });

  it.each(defaults)('has the name, code, filter and default message for %s', (filter, message) => {
    const err = new UnsupportedFilterError(filter);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnsupportedFilterError');
    expect(err.code).toBe('unsupported-filter');
    expect(err.filter).toBe(filter);
    expect(err.message).toBe(message);
  });

  it('keeps a custom message and the cause', () => {
    const cause = new Error('root');
    const err = new UnsupportedFilterError('JPXDecode', 'custom', { cause });
    expect(err.message).toBe('custom');
    expect(err.cause).toBe(cause);
  });
});

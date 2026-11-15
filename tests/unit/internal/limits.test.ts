/**
 * The internal limits object (src/internal/limits.ts), its assertWithinLimit helper, and the two error
 * classes the root entry exports for refused input: ResourceLimitError and UnsupportedFilterError.
 */
import { describe, expect, it } from 'vitest';
import * as root from '../../../src/index.js';
import { INTERNAL_LIMITS, LIMIT_UNITS, assertWithinLimit } from '../../../src/internal/limits.js';
import type { ResourceLimitName } from '../../../src/internal/limits.js';
import { ResourceLimitError, UnsupportedFilterError } from '../../../src/errors.js';

const names = Object.keys(INTERNAL_LIMITS) as ResourceLimitName[];

/** The error assertWithinLimit throws, or undefined when it returns. */
function thrownBy(limit: ResourceLimitName, actual: number): ResourceLimitError | undefined {
  try {
    assertWithinLimit(limit, actual);
  } catch (err) {
    expect(err).toBeInstanceOf(ResourceLimitError);
    return err as ResourceLimitError;
  }
  return undefined;
}

describe('internal limits', () => {
  it('is a frozen object with the fields of this release', () => {
    expect(Object.isFrozen(INTERNAL_LIMITS)).toBe(true);
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
        'maxRewrapDecodedBytes',
        'maxTreeDepth',
      ].toSorted(),
    );
  });

  it('holds a positive safe integer in every field', () => {
    for (const name of names) {
      const max = INTERNAL_LIMITS[name];
      expect(Number.isSafeInteger(max), name).toBe(true);
      expect(max, name).toBeGreaterThan(0);
    }
  });

  it('has a unit for every field, in a frozen table', () => {
    expect(Object.isFrozen(LIMIT_UNITS)).toBe(true);
    expect(Object.keys(LIMIT_UNITS).toSorted()).toEqual(names.toSorted());
    for (const name of names) expect(LIMIT_UNITS[name].length, name).toBeGreaterThan(0);
  });

  it('keeps the save-time re-wrap limit at 64 MiB and the decoded-stream limit at 256 MiB', () => {
    expect(INTERNAL_LIMITS.maxRewrapDecodedBytes).toBe(64 * 1024 * 1024);
    expect(INTERNAL_LIMITS.maxDecodedStreamBytes).toBe(256 * 1024 * 1024);
  });

  it('keeps the Form XObject operator budget at 2^20', () => {
    expect(INTERNAL_LIMITS.maxFormOperators).toBe(2 ** 20);
  });

  it('keeps the DER depth limit at 128 and the sub-byte predictor limit at 2^28 samples', () => {
    expect(INTERNAL_LIMITS.maxDerDepth).toBe(128);
    expect(INTERNAL_LIMITS.maxPredictorSamples).toBe(2 ** 28);
    expect(LIMIT_UNITS.maxPredictorSamples).toBe('samples');
    expect(thrownBy('maxPredictorSamples', 2 ** 28 + 1)?.message).toBe(
      'Input exceeds the internal limit maxPredictorSamples (268435456 samples).',
    );
  });

  it('accepts a value at the limit, below it, and zero', () => {
    for (const name of names) {
      const max = INTERNAL_LIMITS[name];
      expect(thrownBy(name, max), name).toBeUndefined();
      expect(thrownBy(name, max - 1), name).toBeUndefined();
      expect(thrownBy(name, 0), name).toBeUndefined();
    }
  });

  it('throws ResourceLimitError above the limit, with the limit, max, actual and message', () => {
    for (const name of names) {
      const max = INTERNAL_LIMITS[name];
      const err = thrownBy(name, max + 1);
      expect(err, name).toBeDefined();
      expect(err?.name).toBe('ResourceLimitError');
      expect(err?.code).toBe('resource-limit-exceeded');
      expect(err?.limit).toBe(name);
      expect(err?.max).toBe(max);
      expect(err?.actual).toBe(max + 1);
      expect(err?.message).toBe(
        `Input exceeds the internal limit ${name} (${max} ${LIMIT_UNITS[name]}).`,
      );
    }
  });

  it('states the decoded-stream limit in bytes', () => {
    expect(thrownBy('maxDecodedStreamBytes', 2 ** 30)?.message).toBe(
      'Input exceeds the internal limit maxDecodedStreamBytes (268435456 bytes).',
    );
  });

  it('throws ResourceLimitError for NaN, Infinity and -Infinity, with actual undefined', () => {
    for (const actual of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const err = thrownBy('maxImagePixels', actual);
      expect(err, String(actual)).toBeDefined();
      expect(err?.limit).toBe('maxImagePixels');
      expect(err?.max).toBe(INTERNAL_LIMITS.maxImagePixels);
      expect(err?.actual).toBeUndefined();
      expect(err?.message).toBe(
        `Input exceeds the internal limit maxImagePixels (${INTERNAL_LIMITS.maxImagePixels} pixels).`,
      );
    }
  });

  it('is not exported from the root entry', () => {
    expect(Object.keys(root)).not.toContain('INTERNAL_LIMITS');
    expect(Object.keys(root)).not.toContain('assertWithinLimit');
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
    expect(err.message).toBe('Input exceeds the internal limit maxDerDepth (64 levels).');
    expect(err.cause).toBe(cause);
  });

  it('leaves actual undefined when no value is given', () => {
    expect(new ResourceLimitError('maxTreeDepth', 256, 'levels').actual).toBeUndefined();
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

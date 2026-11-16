/**
 * `optimizeAllImages` no longer has a `maxDpi` option: it never downscaled an image, so the option
 * was removed in 0.41.0. A caller that still passes it (a JavaScript caller, a spread object or a
 * cast) gets an `UnsupportedOptionError` that names the call and the option, never the value. The
 * error is thrown on every call, before any image is read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf } from '../../../../src/index.js';
import { optimizeAllImages } from '../../../../src/assets/image/optimize/batchOptimize.js';
import type { BatchOptimizeOptions } from '../../../../src/assets/image/optimize/batchOptimize.js';
import { UnsupportedOptionError } from '../../../../src/errors.js';
import { UNSUPPORTED_OPTIONS } from '../../../../src/internal/options.js';

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The options of a caller that still passes the removed `maxDpi`; the type no longer has it. */
function withMaxDpi(value: unknown): BatchOptimizeOptions {
  return { maxDpi: value } as BatchOptimizeOptions;
}

/** The error `optimizeAllImages` rejects with for `options`; fails the test when it resolves. */
async function rejectionOf(options: BatchOptimizeOptions): Promise<UnsupportedOptionError> {
  try {
    await optimizeAllImages(createPdf(), options);
  } catch (err) {
    expect(err).toBeInstanceOf(UnsupportedOptionError);
    return err as UnsupportedOptionError;
  }
  throw new Error('expected optimizeAllImages to reject');
}

describe('optimizeAllImages option maxDpi', () => {
  it('rejects with an UnsupportedOptionError that says the option was removed', async () => {
    const error = await rejectionOf(withMaxDpi(4747));
    expect(error.code).toBe('unsupported-option');
    expect(error.entry).toBe('optimizeAllImages()');
    expect(error.option).toBe('maxDpi');
    expect(error.plannedFor).toBeUndefined();
    expect(error.message).toBe('`optimizeAllImages()`: the option `maxDpi` was removed in 0.41.0.');
  });

  it('rejects with the row of the option table', async () => {
    const row = UNSUPPORTED_OPTIONS.find(
      (rule) => rule.entry === 'optimizeAllImages()' && rule.option === 'maxDpi',
    );
    const error = await rejectionOf(withMaxDpi(72));
    expect(row).toBeDefined();
    expect([error.entry, error.option, error.plannedFor]).toEqual([
      row?.entry,
      row?.option,
      row?.plannedFor,
    ]);
  });

  it('rejects on every call, not once per process', async () => {
    await rejectionOf(withMaxDpi(72));
    await rejectionOf(withMaxDpi(72));
  });

  it('rejects for any value that is not undefined', async () => {
    for (const value of [0, 72, Number.NaN, null, '150', {}]) {
      await rejectionOf(withMaxDpi(value));
    }
  });

  it('names no caller value in the message', async () => {
    const error = await rejectionOf(withMaxDpi(4747));
    expect(error.message).not.toContain('4747');
  });

  it('does not reject when the option is absent or undefined', async () => {
    await expect(optimizeAllImages(createPdf())).resolves.toBeDefined();
    await expect(optimizeAllImages(createPdf(), {})).resolves.toBeDefined();
    await expect(optimizeAllImages(createPdf(), withMaxDpi(undefined))).resolves.toBeDefined();
  });

  it('emits no process warning', async () => {
    await rejectionOf(withMaxDpi(72));
    expect(emit).not.toHaveBeenCalled();
  });
});

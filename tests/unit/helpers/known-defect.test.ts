/**
 * Tests of the known-defect marker helper (tests/helpers/known-defect.ts).
 *
 * A marker registers a Vitest `test` with `fails: true`. Vitest reports such a test as an
 * expected failure when its function throws and as failed ("Expect test to fail") when its
 * function returns. These tests call the marker's wrapped function directly with a stand-in
 * context, so they show which of the two each kind of body produces without registering a
 * marker with a made-up ledger id.
 */
import type { TestContext } from 'vitest';
import { describe, expect, it } from 'vitest';
import {
  defectKey,
  knownDefect,
  markerOptions,
  runKnownDefect,
} from '../../helpers/known-defect.js';

interface Annotation {
  readonly message: string;
  readonly type: string | undefined;
}

/** An error as Vitest records it in `task.result.errors` (a serialized copy, not an `Error`). */
interface RecordedError {
  readonly name?: string;
  readonly message?: string;
}

/**
 * A stand-in for the parts of the test context the marker uses: `task.timeout`, `task.meta`,
 * `task.result.errors` (where Vitest records soft-assertion errors while the test runs) and
 * `annotate`.
 */
function fakeContext(timeout = 5_000): { ctx: TestContext; annotations: Annotation[] } {
  const annotations: Annotation[] = [];
  const errors: RecordedError[] = [];
  const ctx = {
    task: { timeout, meta: {}, result: { state: 'run', errors } },
    annotate: async (message: string, type?: string) => {
      annotations.push({ message, type });
      return { message, type: type ?? 'notice' };
    },
  } as unknown as TestContext;
  return { ctx, annotations };
}

const KEY = defectKey('core-document-08', '0.41.2');

describe('defectKey', () => {
  it('formats the title prefix from the ids and the release that fixes them', () => {
    expect(KEY).toEqual({
      ids: ['core-document-08'],
      until: '0.41.2',
      prefix: 'core-document-08 (until 0.41.2)',
    });
    expect(defectKey(['crypto-security-01', 'crypto-security-02'], '0.40.9').prefix).toBe(
      'crypto-security-01, crypto-security-02 (until 0.40.9)',
    );
    expect(defectKey('tests-integration-e2e-bench-fixtures-M01', '0.41.2').prefix).toBe(
      'tests-integration-e2e-bench-fixtures-M01 (until 0.41.2)',
    );
  });

  it.for([
    ['an empty id list', [], '0.41.2'],
    ['an id without a number', ['core-document'], '0.41.2'],
    ['an id in upper case', ['Core-Document-08'], '0.41.2'],
    ['an id with a space', ['core document-08'], '0.41.2'],
    ['the same id twice', ['forms-34', 'forms-34'], '0.41.5'],
    ['an until that is not x.y.z', ['forms-34'], '0.41'],
    ['an until with a prefix', ['forms-34'], 'v0.41.5'],
  ] as const)('rejects %s', ([, ids, until]) => {
    expect(() => defectKey(ids, until)).toThrow(/known-defect key/);
  });

  it('returns a frozen key, so a test cannot move its until', () => {
    expect(Object.isFrozen(KEY)).toBe(true);
    expect(Object.isFrozen(KEY.ids)).toBe(true);
  });
});

describe('knownDefect', () => {
  it.for([
    ['a spread copy of a key', () => ({ ...KEY, until: '0.40.1' })],
    ['an Object.assign copy', () => Object.assign({}, KEY)],
  ] as const)('throws at collection time for a key defectKey() did not make: %s', ([, make]) => {
    expect(() => knownDefect(make(), 'never registered', { failsWith: /x/ }, () => {})).toThrow(
      /was not made by defectKey\(\)/,
    );
  });
});

describe('markerOptions', () => {
  it('marks the test as an expected failure and puts the key in the task meta', () => {
    const options = markerOptions(KEY, undefined);
    expect(options).toHaveProperty('fails', true);
    expect(options.meta).toEqual({ ledger: { ids: ['core-document-08'], until: '0.41.2' } });
    expect(Object.keys(options).sort()).toEqual(['fails', 'meta']);
    expect(markerOptions(KEY, 30_000).timeout).toBe(30_000);
  });
});

describe('runKnownDefect', () => {
  it('rethrows an error that matches failsWith, so test.fails reports an expected failure', async () => {
    const { ctx, annotations } = fakeContext();
    const symptom = new Error('expected 7 to be 8');
    await expect(
      runKnownDefect(KEY, /expected \d+ to be \d+/, () => Promise.reject(symptom), ctx),
    ).rejects.toBe(symptom);
    expect(annotations).toEqual([]);
  });

  it('matches failsWith against the error name too', async () => {
    const { ctx } = fakeContext();
    class PasswordException extends Error {
      override readonly name = 'PasswordException';
    }
    await expect(
      runKnownDefect(
        KEY,
        /^PasswordException:/,
        () => {
          throw new PasswordException('No password given');
        },
        ctx,
      ),
    ).rejects.toThrow('No password given');
  });

  it('returns when the body passes, so test.fails reports a failure', async () => {
    const { ctx, annotations } = fakeContext();
    await expect(runKnownDefect(KEY, /anything/, () => undefined, ctx)).resolves.toBeUndefined();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.type).toBe('error');
    expect(annotations[0]?.message).toMatch(
      /^core-document-08 \(until 0\.41\.2\): the body passed/,
    );
  });

  it('returns when the body throws an unrelated error, so test.fails reports a failure', async () => {
    const { ctx, annotations } = fakeContext();
    const run = runKnownDefect(
      KEY,
      /expected \d+ to be \d+/,
      () => {
        throw new TypeError('form.getTextField is not a function');
      },
      ctx,
    );
    await expect(run).resolves.toBeUndefined();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.type).toBe('error');
    expect(annotations[0]?.message).toContain('TypeError: form.getTextField is not a function');
    expect(annotations[0]?.message).toContain('/expected \\d+ to be \\d+/');
  });

  it('returns when the body throws a value that is not an Error', async () => {
    const { ctx, annotations } = fakeContext();
    await expect(
      runKnownDefect(
        KEY,
        /expected \d+ to be \d+/,
        () => {
          throw 'not an error object';
        },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect(annotations.map((a) => a.message).join('\n')).toContain('not an error object');
  });

  it('rethrows the error ctx.skip() throws, so the test is reported skipped', async () => {
    const { ctx, annotations } = fakeContext();
    const skip = Object.assign(new Error('test is skipped; abort execution'), {
      code: 'VITEST_PENDING',
    });
    await expect(runKnownDefect(KEY, /never/, () => Promise.reject(skip), ctx)).rejects.toBe(skip);
    expect(annotations).toEqual([]);
  });

  it('sets meta.knownDefectMatched when the body throws an error that matches failsWith', async () => {
    const { ctx } = fakeContext();
    await expect(
      runKnownDefect(KEY, /^Error: boom$/, () => Promise.reject(new Error('boom')), ctx),
    ).rejects.toThrow('boom');
    expect(ctx.task.meta.knownDefectMatched).toBe(true);
  });

  it('leaves meta.knownDefectMatched unset and annotates when the body records an unrelated error', async () => {
    const { ctx, annotations } = fakeContext();
    const recorded = (ctx.task.result?.errors ?? []) as RecordedError[];
    // A matching error from an earlier attempt (a retry) is not this attempt's failure.
    recorded.push({ name: 'Error', message: 'boom' });
    await expect(
      runKnownDefect(
        KEY,
        /^Error: boom$/,
        () => {
          // What expect.soft does: the error is recorded on the task and the body goes on.
          recorded.push({ name: 'AssertionError', message: 'expected 1 to be 3' });
        },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect(ctx.task.meta.knownDefectMatched).toBeUndefined();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.type).toBe('error');
    expect(annotations[0]?.message).toBe(
      'core-document-08 (until 0.41.2): failed for another reason than /^Error: boom$/: AssertionError: expected 1 to be 3',
    );
  });

  it('sets meta.knownDefectMatched when the body records an error that matches failsWith', async () => {
    const { ctx, annotations } = fakeContext();
    const recorded = (ctx.task.result?.errors ?? []) as RecordedError[];
    await expect(
      runKnownDefect(
        KEY,
        /expected \d+ to be \d+/,
        () => {
          recorded.push({ name: 'AssertionError', message: 'expected 7 to be 8' });
        },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect(ctx.task.meta.knownDefectMatched).toBe(true);
    expect(annotations).toEqual([]);
  });

  it('leaves meta.knownDefectMatched unset when the body passes', async () => {
    const { ctx } = fakeContext();
    await runKnownDefect(KEY, /anything/, () => undefined, ctx);
    expect(ctx.task.meta.knownDefectMatched).toBeUndefined();
  });

  it('returns before the test timeout when the body never settles', async () => {
    const { ctx, annotations } = fakeContext(200);
    const started = performance.now();
    await expect(
      runKnownDefect(KEY, /anything/, () => new Promise<void>(() => {}), ctx),
    ).resolves.toBeUndefined();
    expect(performance.now() - started).toBeLessThan(200);
    expect(annotations[0]?.message).toMatch(/did not settle within \d+ ms/);
  });
});

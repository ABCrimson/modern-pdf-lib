/**
 * The one way a test marks a known open defect.
 *
 *   knownDefect(defectKey('core-document-08', '0.41.2'), 'two doc.save() calls ... give identical bytes',
 *     { failsWith: /expected .* to deeply equal/ }, async () => { ... });
 *
 * - `defectKey(id | ids, until)` names the ledger id(s) and the release that fixes them. Write
 *   both as string literals at the call, so `node scripts/dev/known-defects.ts --check` can read
 *   them from the source text. The key it returns is frozen, and knownDefect() takes no other:
 *   a hand-built or copied key throws at collection time.
 * - `knownDefect(key, title, { failsWith, timeout? }, body)` registers a Vitest `test` with
 *   `fails: true`. Its title is `<id>[, <id>...] (until <x.y.z>): <title>`, and its task meta
 *   holds `ledger: { ids, until }`, which the JSON reporter writes per test and the census reads.
 * - Right reason: Vitest counts a marker as an expected failure on any failure of the test,
 *   including a soft assertion (`expect.soft`), `expect.assertions`/`expect.hasAssertions` and
 *   an error in a hook (`afterEach`, `onTestFinished`), all of which fail the test outside this
 *   wrapper. So the wrapper sets `meta.knownDefectMatched` only when the body's failure (an
 *   error it throws, or one Vitest records on the task while it runs) has a
 *   `<name>: <message>` that matches `failsWith`, and
 *   `node scripts/dev/known-defects.ts --list <report.json>` rejects a marker that passed
 *   without it. If the body passes, throws or records anything else, or has not settled
 *   shortly before the test timeout, the marker returns normally, which Vitest reports as a
 *   failed `test.fails` ("Expect test to fail") unless something outside the body fails the
 *   test, and an `error` annotation says why. A `ctx.skip()` inside the body still skips the
 *   test.
 *
 * When the defect is fixed the marker fails; the fixing commit replaces it with a plain test.
 */
import type { TestContext } from 'vitest';
import { test } from 'vitest';

declare module 'vitest' {
  interface TaskMeta {
    /** Set by {@link knownDefect}: the ledger ids this expected failure is keyed to. */
    ledger?: LedgerMeta;
    /** Set by knownDefect when the failure matched failsWith. */
    knownDefectMatched?: true;
    /** Ids of the docs/capabilities.json rows a test is evidence for. */
    capability?: readonly string[];
  }
}

/** The task meta a marker carries. */
export interface LedgerMeta {
  readonly ids: readonly string[];
  readonly until: string;
}

/** Ledger ids, the release that fixes them, and the title prefix they give a marker. */
export interface DefectKey extends LedgerMeta {
  /** `<id>[, <id>...] (until <x.y.z>)` */
  readonly prefix: string;
}

/** The body of a marker: the oracle's success condition, which fails while the defect is open. */
export type DefectBody = (ctx: TestContext) => Promise<void> | void;

/** Lower-case words joined by hyphens, then a number with an optional one-letter series. */
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[A-Z]?\d{2,}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
/** The share of the test timeout after which a body that has not settled counts as unrelated. */
const DEADLINE_SHARE = 0.9;
/** The `code` of the error `ctx.skip()` throws (PendingError in the installed Vitest runner). */
const SKIP_CODE = 'VITEST_PENDING';
/** Every key defectKey() returned; knownDefect() accepts no other. */
const ISSUED = new WeakSet<DefectKey>();
// Kept at import time, before any test can install fake timers.
const { setTimeout: realSetTimeout, clearTimeout: realClearTimeout } = globalThis;

/** A key for {@link knownDefect}; throws at collection time when an id or `until` is malformed. */
export function defectKey(id: string | readonly string[], until: string): DefectKey {
  const ids: readonly string[] = typeof id === 'string' ? [id] : id;
  const bad = (why: string): Error =>
    new Error(`known-defect key ${JSON.stringify({ ids, until })}: ${why}`);
  if (ids.length === 0) throw bad('no id');
  for (const one of ids) if (!ID.test(one)) throw bad(`malformed id ${JSON.stringify(one)}`);
  if (new Set(ids).size !== ids.length) throw bad('an id is listed twice');
  if (!VERSION.test(until)) throw bad('until must be a version x.y.z');
  const key: DefectKey = Object.freeze({
    ids: Object.freeze([...ids]),
    until,
    prefix: `${ids.join(', ')} (until ${until})`,
  });
  ISSUED.add(key);
  return key;
}

/** The Vitest options of a marker: an expected failure with the key in the task meta. */
export function markerOptions(
  key: DefectKey,
  timeout: number | undefined,
): { fails: true; meta: { ledger: LedgerMeta }; timeout?: number } {
  const options = { fails: true as const, meta: { ledger: { ids: key.ids, until: key.until } } };
  return timeout === undefined ? options : { ...options, timeout };
}

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const isSkip = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === SKIP_CODE;

/** `<name>: <message>` of an error as Vitest records it on the task (a serialized copy). */
const describeRecorded = (e: { name?: string; message?: string }): string =>
  `${e.name ?? 'Error'}: ${e.message ?? ''}`;

/**
 * Runs a marker body. Rethrows the body's error when it matches `failsWith` (setting
 * `meta.knownDefectMatched`) or is the skip signal, and returns with `meta.knownDefectMatched`
 * set when an error Vitest recorded while the body ran matches. Otherwise annotates the test
 * and returns, so the `test.fails` it runs in fails unless something outside the body fails it.
 */
export async function runKnownDefect(
  key: DefectKey,
  failsWith: RegExp,
  body: DefectBody,
  ctx: TestContext,
): Promise<void> {
  // Errors already recorded belong to an earlier attempt (a retry), not to this body.
  const errorsBefore = ctx.task.result?.errors?.length ?? 0;
  const budget = ctx.task.timeout;
  const deadline = budget > 0 && Number.isFinite(budget) ? Math.floor(budget * DEADLINE_SHARE) : 0;
  let timer: ReturnType<typeof realSetTimeout> | undefined;
  let outcome: 'settled' | 'late';
  try {
    const run = Promise.resolve()
      .then(() => body(ctx))
      .then(() => 'settled' as const);
    // A body that settles after the deadline must not surface as an unhandled rejection.
    run.catch(() => undefined);
    outcome =
      deadline === 0
        ? await run
        : await Promise.race([
            run,
            new Promise<'late'>((resolve) => {
              timer = realSetTimeout(() => resolve('late'), deadline);
            }),
          ]);
  } catch (error) {
    if (isSkip(error)) throw error;
    if (failsWith.test(describeError(error))) {
      ctx.task.meta.knownDefectMatched = true;
      throw error;
    }
    await ctx.annotate(
      `${key.prefix}: failed for another reason than ${String(failsWith)}: ${describeError(error)}`,
      'error',
    );
    return;
  } finally {
    if (timer !== undefined) realClearTimeout(timer);
  }
  if (outcome === 'settled') {
    // A soft assertion records its error on the task and lets the body go on to settle.
    const recorded = ctx.task.result?.errors?.slice(errorsBefore) ?? [];
    if (recorded.some((e) => failsWith.test(describeRecorded(e)))) {
      ctx.task.meta.knownDefectMatched = true;
      return;
    }
    if (recorded.length > 0) {
      await ctx.annotate(
        `${key.prefix}: failed for another reason than ${String(failsWith)}: ${recorded.map(describeRecorded).join('; ')}`,
        'error',
      );
      return;
    }
  }
  await ctx.annotate(
    outcome === 'late'
      ? `${key.prefix}: the body did not settle within ${deadline} ms (the test timeout is ${budget} ms)`
      : `${key.prefix}: the body passed; if the defect is fixed, replace this marker with a plain test`,
    'error',
  );
}

/**
 * Registers a known-defect marker: a `test.fails` titled `<key.prefix>: <title>` meant to pass
 * only while `body` fails with an error matching `failsWith`. Throws when `key` is not one
 * defectKey() returned. Its task meta says whether the
 * failure matched (`knownDefectMatched`), which `known-defects.ts --list <report.json>` checks.
 */
export function knownDefect(
  key: DefectKey,
  title: string,
  options: { readonly failsWith: RegExp; readonly timeout?: number },
  body: DefectBody,
): void {
  if (!ISSUED.has(key)) {
    throw new Error(
      `known-defect key ${JSON.stringify({ ids: key.ids, until: key.until })} was not made by defectKey()`,
    );
  }
  test(`${key.prefix}: ${title}`, markerOptions(key, options.timeout), (ctx) =>
    runKnownDefect(key, options.failsWith, body, ctx),
  );
}

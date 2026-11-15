/**
 * Group helper for the Vitest benchmark files (`pnpm run test:bench`).
 *
 * Vitest 5 has no `bench` export: a benchmark is created from the `bench`
 * fixture of a test context, and `bench.compare()` runs several registrations
 * and prints one comparison table when the test finishes. `describe` here keeps
 * the familiar grouping — each group becomes one test whose body registers
 * every `bench()` call made inside it and compares them together.
 *
 * Only files named `*.bench.ts` under the `benchmark.include` globs in
 * `vitest.config.ts` are collected by `vitest bench`; this helper is not one.
 */

import { test } from 'vitest';

/** A benchmarked function, sync or async. */
type BenchFn = () => unknown;

interface Case {
  readonly name: string;
  readonly fn: BenchFn;
}

/** The group being collected by the running `describe` body. */
let collecting: Case[] | undefined;

/** Register one benchmark in the enclosing {@link describe} group. */
export function bench(name: string, fn: BenchFn): void {
  if (collecting === undefined) {
    throw new Error(`bench("${name}") must be called inside describe()`);
  }
  collecting.push({ name, fn });
}

function register(name: string, body: () => void, skip: boolean): void {
  const cases: Case[] = [];
  collecting = cases;
  try {
    body();
  } finally {
    collecting = undefined;
  }
  // Each case runs for tinybench's default measuring time, so a group needs
  // more than Vitest's default test timeout; 0 disables the per-test limit.
  test.skipIf(skip)(name, { timeout: 0 }, async ({ bench: createBench }) => {
    const [only, ...rest] = cases;
    // compare() needs at least two benchmarks; a lone case runs by itself.
    if (only !== undefined && rest.length === 0) {
      await createBench(only.name, only.fn).run();
      return;
    }
    await createBench.compare(...cases.map((c) => createBench(c.name, c.fn)));
  });
}

/** Define a benchmark group; the `bench()` calls in `body` run as one comparison. */
export function describe(name: string, body: () => void): void {
  register(name, body, false);
}

/** Like {@link describe}, but the group is skipped when `condition` is true. */
describe.skipIf = (condition: boolean) => (name: string, body: () => void) => {
  register(name, body, condition);
};

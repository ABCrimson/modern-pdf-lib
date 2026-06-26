/**
 * Minimal benchmark harness backed by tinybench.
 *
 * Provides `describe`/`bench`/`beforeAll` with the same shape the benchmark
 * files already use, so they run standalone via `tsx` — decoupled from
 * Vitest's experimental (and, in v5, currently-removed) `bench` export.
 *
 * Run via `tests/benchmarks/run.ts`.
 */

import { Bench } from 'tinybench';

type BenchFn = () => unknown;

interface BenchGroup {
  readonly name: string;
  readonly benches: { name: string; fn: BenchFn }[];
}

const groups: BenchGroup[] = [];
const globalSetup: BenchFn[] = [];
let current: BenchGroup | undefined;

/** Register a group of benchmarks. */
export function describe(name: string, fn: () => void): void {
  current = { name, benches: [] };
  fn();
  groups.push(current);
  current = undefined;
}

/** Register a single benchmark within the current group. */
export function bench(name: string, fn: BenchFn): void {
  (current ?? (current = { name: '(ungrouped)', benches: [] })).benches.push({
    name,
    fn,
  });
}

/** Register a one-time setup hook, run before any benchmark executes. */
export function beforeAll(fn: BenchFn): void {
  globalSetup.push(fn);
}

/** tinybench exposes throughput under different shapes across versions. */
function opsPerSecond(result: unknown): number {
  const r = result as
    | { throughput?: { mean?: number }; hz?: number }
    | undefined;
  return r?.throughput?.mean ?? r?.hz ?? 0;
}

/** Run every registered group, printing per-group results + a speedup summary. */
export async function runRegisteredBenchmarks(): Promise<void> {
  for (const setup of globalSetup) await setup();

  const summary: { group: string; ratio: number }[] = [];

  for (const group of groups) {
    const bench = new Bench({ time: 400, warmupTime: 100, warmupIterations: 5 });
    for (const item of group.benches) bench.add(item.name, item.fn);
    await bench.run();

    console.log(`\n=== ${group.name} ===`);
    let modernHz = 0;
    let pdflibHz = 0;
    for (const task of bench.tasks) {
      const hz = opsPerSecond(task.result);
      console.log(`  ${hz.toFixed(1).padStart(14)} ops/s   ${task.name}`);
      if (/modern-pdf-lib/i.test(task.name)) modernHz = hz;
      else if (/pdf-lib/i.test(task.name)) pdflibHz = hz;
    }
    if (modernHz > 0 && pdflibHz > 0) {
      const ratio = modernHz / pdflibHz;
      const label =
        ratio >= 1 ? `${ratio.toFixed(2)}x FASTER` : `${(1 / ratio).toFixed(2)}x slower`;
      console.log(`  → modern-pdf-lib is ${label} than pdf-lib`);
      summary.push({ group: group.name, ratio });
    }
  }

  console.log('\n\n===== SUMMARY — modern-pdf-lib vs pdf-lib =====');
  let wins = 0;
  for (const { group, ratio } of summary) {
    if (ratio >= 1) wins++;
    const label =
      ratio >= 1 ? `${ratio.toFixed(1)}x faster` : `${(1 / ratio).toFixed(1)}x SLOWER`;
    console.log(`  ${label.padStart(14)}   ${group}`);
  }
  console.log(`\n  modern-pdf-lib wins ${wins} / ${summary.length} head-to-head benchmarks.`);
}

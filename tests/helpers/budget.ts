/**
 * Runs one entry point on one input in a child process under a time and memory budget and reports
 * completed, threw (error name, code and limit) or killed (time, memory or crash). The child runs
 * the entry in a worker and samples its own resident memory every 10 ms from the worker's `ready`
 * message (after the module import and the input read); the parent kills the child when the time
 * budget runs out. A worker alone is not used:
 * its heap limit does not cover array buffers.
 *
 * The task's module is loaded in the worker through tsx, so it may import the library's sources.
 * Its entry is a named export `(bytes: Uint8Array, args: JsonValue) => JsonValue |
 * Promise<JsonValue>`; the runner calls it once. Both clocks start at the worker's `ready` message,
 * after the module import and the input read: `ms` is the time from `ready` to the outcome, and
 * `mib` the peak growth of the child's resident memory over its size at `ready`, sampled every
 * 10 ms (after a time kill, the last peak the child reported, which is at most 1 MiB below the
 * sampled peak). A memory kill comes from the child itself (it writes a `memory` line, then SIGKILLs
 * itself); a time kill from the parent's SIGKILL. The outcome is read from the first outcome line
 * the child writes, never from its exit code; a stdout line that is not one of the child's protocol
 * lines is kept with stderr, and a second `ready` is ignored. A module that cannot be loaded, or a worker not ready after
 * 30 s, rejects the promise: that is a fault of the test, not an outcome of the input.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A value that survives JSON and structured clone unchanged. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** One entry point and one input. */
export interface BudgetTask {
  /** Repo-relative path of the module that exports `entry`. */
  readonly module: string;
  /** Name of the export to call: `(bytes: Uint8Array, args: JsonValue) => JsonValue | Promise<JsonValue>`. */
  readonly entry: string;
  /** The input: a repo-relative or absolute file path, or the bytes themselves. */
  readonly input: string | Uint8Array;
  /** Passed to the entry as its second argument; `null` when absent. */
  readonly args?: JsonValue;
}

/** Time in milliseconds and resident-memory growth in MiB, both counted from `ready`. */
export interface Budget {
  readonly ms: number;
  readonly mib: number;
}

/** How the run ended. `ms` and `mib` are measured as in {@link Budget}. */
export type BudgetOutcome =
  | {
      readonly kind: 'completed';
      readonly ms: number;
      readonly mib: number;
      readonly result: JsonValue;
    }
  | {
      readonly kind: 'threw';
      readonly ms: number;
      readonly mib: number;
      readonly name: string;
      readonly code?: string;
      readonly limit?: string;
      readonly message: string;
    }
  | {
      readonly kind: 'killed';
      readonly reason: 'time' | 'memory' | 'crash';
      readonly ms: number;
      readonly mib: number;
      readonly detail: string;
    };

/** The gate's budget: 2000 ms and 512 MiB of resident-memory growth. */
export const DEFAULT_BUDGET: Budget = Object.freeze({ ms: 2000, mib: 512 });

/**
 * The budget for inputs at or just under a limit: they complete under it, while inputs above a
 * limit end in their error under {@link DEFAULT_BUDGET}, except a page whose content streams pass
 * the limit only together, which is held to this budget because the streams before the crossing
 * one are decoded first.
 */
export const AT_LIMIT_BUDGET: Budget = Object.freeze({ ms: 5000, mib: 1536 });

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHILD = fileURLToPath(new URL('./budget-child.ts', import.meta.url));
const STARTUP_MS = 30_000;

/** The `t` of every line the child writes (see budget-child.ts). */
const KINDS: ReadonlySet<string> = new Set([
  'ready',
  'peak',
  'completed',
  'threw',
  'memory',
  'crash',
  'setup',
]);

/** One line of the child's stdout (see budget-child.ts). */
interface ChildLine {
  readonly t: 'ready' | 'peak' | 'completed' | 'threw' | 'memory' | 'crash' | 'setup';
  readonly mib?: number;
  readonly result?: JsonValue;
  readonly name?: string;
  readonly code?: string;
  readonly limit?: string;
  readonly message?: string;
  readonly detail?: string;
}

/**
 * Runs `task` once under `budget` (default {@link DEFAULT_BUDGET}).
 *
 * @returns The outcome; rejects only when the module cannot be loaded or the child cannot start.
 */
export async function runWithinBudget(
  task: BudgetTask,
  budget: Budget = DEFAULT_BUDGET,
): Promise<BudgetOutcome> {
  if (typeof task.input === 'string') return runChild(task, resolve(ROOT, task.input), budget);
  const dir = await mkdtemp(join(tmpdir(), 'mpdf-budget-'));
  try {
    const inputPath = join(dir, 'input.bin');
    await writeFile(inputPath, task.input);
    return await runChild(task, inputPath, budget);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runChild(task: BudgetTask, inputPath: string, budget: Budget): Promise<BudgetOutcome> {
  const config = {
    moduleUrl: pathToFileURL(resolve(ROOT, task.module)).href,
    entry: task.entry,
    inputPath,
    args: task.args ?? null,
    mib: budget.mib,
  };
  return new Promise((settle, reject) => {
    const child = spawn(process.execPath, [CHILD, JSON.stringify(config)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let readyAt: number | undefined;
    let outcome: { line: ChildLine; ms: number } | undefined;
    let peakMib = 0;
    let timedOut = false;
    let stdout = '';
    let stderr = '';
    const elapsed = (): number =>
      readyAt === undefined ? 0 : Math.round(performance.now() - readyAt);
    let timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, STARTUP_MS);

    const onLine = (text: string): void => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('t' in parsed) ||
        typeof parsed.t !== 'string' ||
        !KINDS.has(parsed.t)
      ) {
        stderr += `${text}\n`;
        return;
      }
      const line = parsed as ChildLine;
      if (line.t === 'ready') {
        if (readyAt !== undefined) return;
        readyAt = performance.now();
        clearTimeout(timer);
        timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, budget.ms);
      } else if (line.t === 'peak') {
        peakMib = Math.max(peakMib, line.mib ?? 0);
      } else if (outcome === undefined) {
        outcome = { line, ms: elapsed() };
      }
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      for (let at = stdout.indexOf('\n'); at >= 0; at = stdout.indexOf('\n')) {
        onLine(stdout.slice(0, at).trim());
        stdout = stdout.slice(at + 1);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const ended = elapsed();
      const exit = `exit ${code ?? signal}`;
      const tail = stderr.trim().split('\n').slice(-3).join(' | ');
      if (outcome?.line.t === 'setup') {
        reject(
          new Error(`budget runner: ${task.module} could not be loaded: ${outcome.line.detail}`),
        );
        return;
      }
      if (readyAt === undefined) {
        reject(
          new Error(`budget runner: the child ended before the worker was ready (${exit}) ${tail}`),
        );
        return;
      }
      settle(classify(outcome, { timedOut, ended, peakMib, exit, tail, budget }));
    });
  });
}

function classify(
  outcome: { line: ChildLine; ms: number } | undefined,
  run: {
    timedOut: boolean;
    ended: number;
    peakMib: number;
    exit: string;
    tail: string;
    budget: Budget;
  },
): BudgetOutcome {
  if (outcome === undefined) {
    return run.timedOut
      ? {
          kind: 'killed',
          reason: 'time',
          ms: run.ended,
          mib: run.peakMib,
          detail: `ended by the runner after ${run.budget.ms} ms`,
        }
      : {
          kind: 'killed',
          reason: 'crash',
          ms: run.ended,
          mib: run.peakMib,
          detail: `the child ended without an outcome (${run.exit}) ${run.tail}`.trim(),
        };
  }
  const { line, ms } = outcome;
  const mib = line.mib ?? run.peakMib;
  switch (line.t) {
    case 'completed':
      return { kind: 'completed', ms, mib, result: line.result ?? null };
    case 'threw':
      return {
        kind: 'threw',
        ms,
        mib,
        name: line.name ?? 'unknown',
        ...(line.code === undefined ? {} : { code: line.code }),
        ...(line.limit === undefined ? {} : { limit: line.limit }),
        message: line.message ?? '',
      };
    case 'memory':
      return {
        kind: 'killed',
        reason: 'memory',
        ms,
        mib,
        detail: `resident memory grew by ${mib} MiB, above the budget of ${run.budget.mib} MiB`,
      };
    default:
      return { kind: 'killed', reason: 'crash', ms, mib, detail: line.detail ?? run.exit };
  }
}

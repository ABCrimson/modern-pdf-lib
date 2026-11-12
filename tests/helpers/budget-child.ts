/**
 * Child process of the budgeted runner. Kills itself when resident memory grows past the budget.
 *
 * Started by tests/helpers/budget.ts with one argument, the JSON of a ChildConfig. Runs
 * budget-worker.ts in a Worker whose heap is capped at the memory budget, and from the worker's
 * `ready` message on samples `process.memoryUsage.rss()` every 10 ms against the RSS at `ready`
 * (so the module import is not charged). Writes one JSON object per line to stdout:
 *
 * - `{ "t": "ready" }` once the worker has loaded the module and read the input;
 * - `{ "t": "peak", "mib": n }` each time the peak growth has risen by 1 MiB;
 * - one outcome: `completed` (with `result`), `threw` (with `name`, `code`, `limit`, `message`),
 *   `crash` (the worker ran out of heap or exited without an outcome; with `detail`), or
 *   `memory`, after which the child kills itself with SIGKILL; every outcome carries `mib`;
 * - `{ "t": "setup", "detail": text }` when the worker fails before `ready`.
 *
 * The worker's stdout and stderr go to the child's stderr, so a line the body prints is never read
 * as a protocol line.
 *
 * The parent classifies by the outcome line, never by exit code: a self-kill exits with
 * code 1 on Windows and by signal elsewhere. Plain node runs this file, so it uses erasable syntax
 * only.
 */
import { Worker } from 'node:worker_threads';

/** The argument budget.ts passes, as JSON. */
interface ChildConfig {
  readonly moduleUrl: string;
  readonly entry: string;
  readonly inputPath: string;
  readonly args: unknown;
  readonly mib: number;
}

const MIB = 2 ** 20;
const PEAK_STEP = MIB;
const config = JSON.parse(process.argv[2] ?? '') as ChildConfig;
const limit = config.mib * MIB;

let base = -1;
let peak = 0;
let reportedPeak = 0;
let done = false;
let sampler: ReturnType<typeof setInterval> | undefined;

const mibOf = (bytes: number): number => Math.round((bytes / MIB) * 10) / 10;

function say(line: object, then?: () => void): void {
  process.stdout.write(`${JSON.stringify(line)}\n`, then);
}

/** RSS growth since `ready`; raises the peak. */
function sample(): number {
  const growth = process.memoryUsage.rss() - base;
  if (growth > peak) peak = growth;
  return growth;
}

/** Writes the one outcome line and exits. */
function finish(line: object): void {
  if (done) return;
  done = true;
  clearInterval(sampler);
  if (base >= 0) sample();
  say({ ...line, mib: mibOf(peak) }, () => process.exit(0));
}

function tick(): void {
  if (done) return;
  const growth = sample();
  if (growth > limit) {
    done = true;
    clearInterval(sampler);
    say({ t: 'memory', mib: mibOf(growth) }, () => process.kill(process.pid, 'SIGKILL'));
    return;
  }
  if (peak - reportedPeak >= PEAK_STEP) {
    reportedPeak = peak;
    say({ t: 'peak', mib: mibOf(peak) });
  }
}

function setupFailed(detail: string): void {
  if (done) return;
  done = true;
  say({ t: 'setup', detail }, () => process.exit(0));
}

const worker = new Worker(new URL('./budget-worker.ts', import.meta.url), {
  workerData: {
    moduleUrl: config.moduleUrl,
    entry: config.entry,
    inputPath: config.inputPath,
    args: config.args,
  },
  resourceLimits: { maxOldGenerationSizeMb: config.mib },
  stdout: true,
  stderr: true,
});
worker.stdout.pipe(process.stderr);
worker.stderr.pipe(process.stderr);

worker.on('message', (message: { t: string }) => {
  if (message.t === 'ready') {
    base = process.memoryUsage.rss();
    say({ t: 'ready' });
    sampler = setInterval(tick, 10);
    return;
  }
  finish(message);
});

worker.on('error', (err: Error & { code?: string }) => {
  const detail = `${err.code ?? err.name}: ${err.message}`;
  if (base < 0) setupFailed(err.stack ?? detail);
  else finish({ t: 'crash', detail });
});

worker.on('exit', (code: number) => {
  if (base < 0) setupFailed(`the worker exited with code ${code} before it was ready`);
  else finish({ t: 'crash', detail: `the worker exited with code ${code} without an outcome` });
});

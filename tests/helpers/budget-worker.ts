/**
 * Worker of the budgeted runner (tests/helpers/budget.ts), started by budget-child.ts. Loads the
 * task's module through tsx (the library's sources import `.js` specifiers that Node's type
 * stripping does not map to `.ts` files), reads the input file, posts `ready`, runs the entry once
 * and posts `completed` with its result or `threw` with the error's name, code, limit and message.
 * Plain node runs this file, so it uses erasable syntax only.
 */
import { readFileSync } from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { tsImport } from 'tsx/esm/api';

/** What budget-child.ts passes as workerData. */
interface WorkerTask {
  readonly moduleUrl: string;
  readonly entry: string;
  readonly inputPath: string;
  readonly args: unknown;
}

/** The error fields the runner reports; `code` and `limit` only when they are strings. */
function describeError(err: unknown): {
  name: string;
  code?: string;
  limit?: string;
  message: string;
} {
  if (!(err instanceof Error)) return { name: typeof err, message: String(err) };
  const { code, limit } = err as Error & { code?: unknown; limit?: unknown };
  return {
    name: err.name,
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof limit === 'string' ? { limit } : {}),
    message: err.message,
  };
}

const port = parentPort;
if (port === null) throw new Error('budget-worker.ts runs only as a worker of budget-child.ts');
const task = workerData as WorkerTask;
const mod = (await tsImport(task.moduleUrl, import.meta.url)) as Record<string, unknown>;
const entry = mod[task.entry];
if (typeof entry !== 'function') {
  throw new Error(`${task.moduleUrl} has no function export named ${task.entry}`);
}
const bytes = new Uint8Array(readFileSync(task.inputPath));

port.postMessage({ t: 'ready' });
try {
  const result: unknown = await (entry as (input: Uint8Array, args: unknown) => unknown)(
    bytes,
    task.args,
  );
  port.postMessage({ t: 'completed', result });
} catch (err) {
  port.postMessage({ t: 'threw', ...describeError(err) });
}

/**
 * Harmless bodies for the budgeted runner's self-test (budget.test.ts). The runner loads this
 * module in a worker and calls one named export with the input bytes and the task's args. None of
 * them reads the library's decoders: each one returns, waits, throws, prints, spins or allocates.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import type { JsonValue } from '../helpers/budget.js';
import { assertWithinLimit } from '../../src/core/limits.js';

/** Returns the input length and the args it was given. */
export function returns(bytes: Uint8Array, args: JsonValue): JsonValue {
  return { bytes: bytes.length, args };
}

/** Waits `args.ms` milliseconds on a timer, without using the CPU, then returns `{ waited }`. */
export async function waits(_bytes: Uint8Array, args: JsonValue): Promise<JsonValue> {
  const ms = (args as { ms: number }).ms;
  await sleep(ms);
  return { waited: ms };
}

/** Throws ResourceLimitError: asks for one pixel more than the image pixel limit allows. */
export function throwsLimit(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  assertWithinLimit('maxImagePixels', 2 ** 28 + 1);
  return null;
}

/** Never returns and allocates nothing. */
export function spins(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  for (;;) {
    // Busy loop: only the runner's time budget ends it.
  }
}

/**
 * Prints lines shaped like the runner's own (a `completed` line, a bare number, then a `ready` line
 * every 500 ms) and never returns: only the runner's time budget ends it.
 */
export function printsProtocolLines(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  process.stdout.write(`${JSON.stringify({ t: 'completed', result: 'printed' })}\n7\n`);
  let last = performance.now();
  for (;;) {
    if (performance.now() - last >= 500) {
      process.stdout.write(`${JSON.stringify({ t: 'ready' })}\n`);
      last = performance.now();
    }
  }
}

/** Keeps small objects alive until the runner ends it. */
export function growsSmallObjects(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  const kept: { i: number; s: string }[] = [];
  for (let i = 0; ; i++) kept.push({ i, s: `x${i}` });
}

/** Keeps arrays of 1000 numbers alive until the runner ends it. */
export function growsLargeArrays(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  const kept: { x: number[] }[] = [];
  for (;;) kept.push({ x: new Array<number>(1000).fill(1) });
}

/** Keeps 64 MiB typed arrays, each filled, alive until the runner ends it. */
export function growsTypedArrays(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  const kept: Uint8Array[] = [];
  for (;;) {
    const chunk = new Uint8Array(64 * 1024 * 1024);
    chunk.fill(1);
    kept.push(chunk);
  }
}

/** Allocates a 1 GiB typed array, touches none of its pages, and returns its length. */
export function allocatesUntouched(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: new Uint8Array(2 ** 30).length };
}

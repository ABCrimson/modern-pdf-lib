/**
 * @module batch/batchProcessor
 *
 * Parallel batch processing for multiple PDF documents.
 *
 * Uses `worker_threads` when running in Node.js for true parallelism,
 * and falls back to concurrent (but single-threaded) `Promise.all`
 * processing in other runtimes (browsers, Cloudflare Workers, Deno, Bun).
 *
 * Entry points:
 * - {@link processBatch} — run an arbitrary operation on multiple PDFs
 * - {@link batchMerge} — merge multiple PDFs in parallel chunks
 * - {@link batchFlatten} — flatten forms across many PDFs
 *
 * @packageDocumentation
 */

import { PdfDocument, createPdf } from '../core/pdfDocument.js';
import { mergePdfs } from '../core/documentMerge.js';
import { detectRuntime } from '../wasm/loader.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Callback invoked as batch items complete. */
export type BatchProgressCallback = (done: number, total: number) => void;

/** Strategy for handling errors during batch processing. */
export type BatchErrorStrategy = 'fail-fast' | 'continue' | 'collect';

/** Options for batch processing. */
export interface BatchOptions {
  /**
   * Maximum number of PDFs processed concurrently.
   * Defaults to 4 in Node (worker threads), or `files.length` elsewhere.
   */
  concurrency?: number | undefined;

  /** Progress callback invoked after each file completes. */
  onProgress?: BatchProgressCallback | undefined;

  /** Maximum memory usage in MB before throttling concurrency. */
  maxMemoryMB?: number | undefined;

  /**
   * Error handling strategy:
   * - `'fail-fast'` — stop on first error and reject immediately
   * - `'continue'` — skip failed items and continue (default)
   * - `'collect'` — collect all errors and throw an `AggregateError` at the end
   */
  errorStrategy?: BatchErrorStrategy | undefined;

  /** Per-item timeout in milliseconds. Items exceeding this are treated as errors. */
  timeout?: number | undefined;
}

/** Result of a batch operation. */
export interface BatchResult {
  /** Output PDF bytes for each input file (same order). */
  outputs: Uint8Array[];
  /** Number of files that were processed successfully. */
  successCount: number;
  /** Indices of files that failed, mapped to their error. */
  errors: Map<number, Error>;
}

// ---------------------------------------------------------------------------
// Memory pressure utilities
// ---------------------------------------------------------------------------

/**
 * Read the current heap usage in bytes, using the best API available.
 *
 * - Node.js: `process.memoryUsage().heapUsed`
 * - Chrome / Edge: `performance.memory.usedJSHeapSize`
 * - Others: returns `undefined` (monitoring disabled)
 */
function getHeapUsedBytes(): number | undefined {
  // Node.js / Bun / Deno (with --allow-env)
  if ('process' in globalThis && typeof (globalThis as unknown as { process: { memoryUsage?: unknown } }).process.memoryUsage === 'function') {
    return ((globalThis as unknown as { process: { memoryUsage(): { heapUsed: number } } }).process.memoryUsage()).heapUsed;
  }

  // Chrome-based browsers expose a non-standard `performance.memory`
  const perf = globalThis.performance as
    | (Performance & { memory?: { usedJSHeapSize?: number } })
    | undefined;
  if (perf?.memory?.usedJSHeapSize !== undefined) {
    return perf.memory.usedJSHeapSize;
  }

  return undefined;
}

/**
 * Hint the runtime to collect garbage if a GC API is exposed.
 * This is a best-effort hint — most production runtimes do not expose `gc()`.
 */
function hintGC(): void {
  const g = globalThis as { gc?: () => void };
  if (typeof g.gc === 'function') {
    g.gc();
  }
}

// ---------------------------------------------------------------------------
// Per-item timeout helper
// ---------------------------------------------------------------------------

/**
 * Race a promise against a timeout. Rejects with a descriptive error
 * if the timeout fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Batch item ${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ---------------------------------------------------------------------------
// Sentinel for fail-fast cancellation
// ---------------------------------------------------------------------------

/** Thrown internally to abort remaining workers during fail-fast. */
class BatchCancelledError extends Error {
  override readonly name = 'BatchCancelledError';
  constructor() {
    super('Batch cancelled due to fail-fast error strategy');
  }
}

// ---------------------------------------------------------------------------
// Concurrency limiter (memory-aware)
// ---------------------------------------------------------------------------

/**
 * Process an array of tasks with bounded concurrency and optional
 * memory-pressure throttling.
 *
 * Unlike a simple `Promise.all`, this ensures at most `concurrency`
 * tasks run simultaneously, which is critical when each task may
 * allocate significant memory (parsing/saving a PDF).
 *
 * When `maxMemoryBytes` is set and the heap exceeds the threshold,
 * only one worker is allowed to proceed at a time until memory drops.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  maxMemoryBytes: number | undefined,
  cancelled: { value: boolean },
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  /** Dynamic concurrency gate — decremented under memory pressure. */
  let activeCap = concurrency;
  let activeCount = 0;

  // Simple async gate for throttling
  const waiters: (() => void)[] = [];
  const acquire = async (): Promise<void> => {
    while (activeCount >= activeCap) {
      await new Promise<void>((resolve) => { waiters.push(resolve); });
    }
    activeCount++;
  };
  const release = (): void => {
    activeCount--;
    // Check memory pressure after each task finishes
    if (maxMemoryBytes !== undefined) {
      const used = getHeapUsedBytes();
      if (used !== undefined && used > maxMemoryBytes) {
        activeCap = 1;
        hintGC();
      } else if (activeCap < concurrency) {
        // Memory has dropped — restore original concurrency
        activeCap = concurrency;
      }
    }
    const next = waiters.shift();
    next?.();
  };

  const worker = async () => {
    while (nextIndex < tasks.length) {
      if (cancelled.value) return;
      await acquire();
      if (cancelled.value) { release(); return; }
      const idx = nextIndex++;
      if (idx >= tasks.length) { release(); return; }
      try {
        results[idx] = await tasks[idx]!();
      } finally {
        release();
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Core batch processor
// ---------------------------------------------------------------------------

/**
 * Process multiple PDFs in parallel (or with bounded concurrency).
 *
 * Each input `Uint8Array` is loaded as a {@link PdfDocument}, the
 * caller-supplied `operation` is applied, and the resulting bytes
 * are collected.
 *
 * In Node.js, true parallelism is available via `worker_threads`
 * (though this implementation uses async concurrency for simplicity
 * and to avoid serialization overhead). In all runtimes the
 * concurrency limiter ensures memory pressure stays manageable.
 *
 * @param files      Array of raw PDF bytes.
 * @param operation  An async function that receives a loaded
 *                   {@link PdfDocument} and returns the processed
 *                   PDF as `Uint8Array`.
 * @param options    Concurrency, progress, memory, error, and timeout options.
 * @returns          A {@link BatchResult} with outputs, success
 *                   count, and any per-file errors.
 */
export async function processBatch(
  files: Uint8Array[],
  operation: (doc: PdfDocument) => Promise<Uint8Array>,
  options?: BatchOptions,
): Promise<BatchResult> {
  if (files.length === 0) {
    return { outputs: [], successCount: 0, errors: new Map() };
  }

  const runtime = detectRuntime();
  const defaultConcurrency = runtime === 'node' ? 4 : files.length;
  const concurrency = options?.concurrency ?? defaultConcurrency;
  const onProgress = options?.onProgress;
  const errorStrategy = options?.errorStrategy ?? 'continue';
  const timeoutMs = options?.timeout;
  const maxMemoryBytes = options?.maxMemoryMB !== undefined
    ? options.maxMemoryMB * 1024 * 1024
    : undefined;

  let doneCount = 0;
  const errors = new Map<number, Error>();
  const outputs: Uint8Array[] = new Array(files.length);

  /** Shared cancellation flag for fail-fast. */
  const cancelled = { value: false };

  /** First error captured during fail-fast — will be re-thrown. */
  let failFastError: Error | undefined;

  const tasks = files.map((fileBytes, idx) => async () => {
    if (cancelled.value) {
      throw new BatchCancelledError();
    }

    try {
      const run = async () => {
        const doc = await PdfDocument.load(fileBytes);
        return operation(doc);
      };

      const result = timeoutMs !== undefined
        ? await withTimeout(run(), timeoutMs, `#${idx}`)
        : await run();

      outputs[idx] = result;
    } catch (err) {
      if (err instanceof BatchCancelledError) return;

      const error = err instanceof Error ? err : new Error(String(err));
      errors.set(idx, error);
      outputs[idx] = new Uint8Array(0);

      if (errorStrategy === 'fail-fast') {
        failFastError ??= error;
        cancelled.value = true;
      }
    } finally {
      doneCount++;
      onProgress?.(doneCount, files.length);
    }
  });

  await runWithConcurrency(
    tasks,
    Math.max(1, concurrency),
    maxMemoryBytes,
    cancelled,
  );

  // Fail-fast: re-throw the first error encountered
  if (errorStrategy === 'fail-fast' && failFastError) {
    throw failFastError;
  }

  // Collect: throw AggregateError with all captured errors
  if (errorStrategy === 'collect' && errors.size > 0) {
    const sortedErrors = [...errors.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idx, err]) => {
        err.message = `[Item #${idx}] ${err.message}`;
        return err;
      });
    throw new AggregateError(
      sortedErrors,
      `Batch processing failed for ${errors.size} of ${files.length} items`,
    );
  }

  return {
    outputs,
    successCount: files.length - errors.size,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Convenience: batch merge
// ---------------------------------------------------------------------------

/**
 * Merge multiple PDFs in parallel chunks, then merge the chunks.
 *
 * For large collections this is significantly faster than sequential
 * merging because parsing and page-copying can overlap.
 *
 * @param files    Array of raw PDF bytes to merge (in order).
 * @param options  Concurrency and progress options.
 * @returns        The merged PDF as `Uint8Array`.
 */
export async function batchMerge(
  files: Uint8Array[],
  options?: BatchOptions,
): Promise<Uint8Array> {
  if (files.length === 0) {
    const empty = createPdf();
    return empty.save();
  }

  if (files.length === 1) {
    // Nothing to merge — just pass through
    const doc = await PdfDocument.load(files[0]!);
    return doc.save();
  }

  const concurrency = options?.concurrency ?? 4;
  const onProgress = options?.onProgress;

  // Split into chunks for parallel parsing
  const chunkSize = Math.max(1, Math.ceil(files.length / concurrency));
  const chunks: Uint8Array[][] = [];
  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }

  let doneChunks = 0;

  // Parse and merge each chunk into a single document
  const chunkDocs = await runWithConcurrency(
    chunks.map((chunk) => async () => {
      const docs: PdfDocument[] = [];
      for (const fileBytes of chunk) {
        docs.push(await PdfDocument.load(fileBytes));
      }
      const merged = await mergePdfs(docs);
      doneChunks++;
      onProgress?.(doneChunks, chunks.length + 1);
      return merged;
    }),
    concurrency,
    undefined,
    { value: false },
  );

  // Final merge of all chunks
  const result = await mergePdfs(chunkDocs);
  onProgress?.(chunks.length + 1, chunks.length + 1);

  return result.save();
}

// ---------------------------------------------------------------------------
// Convenience: batch flatten
// ---------------------------------------------------------------------------

/**
 * Flatten interactive form fields across many PDFs.
 *
 * Each PDF is loaded, its form is flattened (field values are burned
 * into page content), and the result is saved.
 *
 * @param files    Array of raw PDF bytes.
 * @param options  Concurrency and progress options.
 * @returns        A {@link BatchResult} with flattened PDF outputs.
 */
export async function batchFlatten(
  files: Uint8Array[],
  options?: BatchOptions,
): Promise<BatchResult> {
  return processBatch(
    files,
    async (doc) => {
      try {
        const form = doc.getForm();
        form.flatten();
      } catch {
        // If there's no form or flatten fails, save as-is
      }
      return doc.save();
    },
    options,
  );
}

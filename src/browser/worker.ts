/**
 * Web Worker wrapper for offloading PDF generation off the main thread.
 *
 * In browser applications, generating large PDFs can block the main
 * thread and cause UI jank. This module provides a {@link PdfWorker}
 * class that runs PDF generation inside a Web Worker, keeping the
 * main thread responsive.
 *
 * Usage:
 * ```ts
 * import { PdfWorker } from 'modern-pdf-lib/browser';
 *
 * const worker = new PdfWorker();
 * const bytes = await worker.generate(async (pdf) => {
 *   const doc = pdf.createPdf();
 *   const page = doc.addPage(pdf.PageSizes.A4);
 *   page.drawText('Hello from Worker!', { x: 50, y: 750, size: 24 });
 *   return doc.save();
 * });
 * worker.terminate();
 * ```
 *
 * @module browser/worker
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a {@link PdfWorker}. */
export interface PdfWorkerOptions {
  /**
   * URL to a custom worker script. If not provided, an inline worker
   * is created via `Blob` + `URL.createObjectURL`.
   *
   * The custom script must import `modern-pdf-lib` and expose the
   * same message-handling protocol (receive `{ id, taskCode }`,
   * respond with `{ id, result }` or `{ id, error }`).
   */
  readonly workerUrl?: string | URL;
}

/** Message sent from the main thread to the worker. */
interface WorkerRequest {
  readonly id: number;
  readonly taskCode: string;
}

/** Message received from the worker. */
interface WorkerResponse {
  readonly id: number;
  readonly result?: Uint8Array;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// PdfWorker
// ---------------------------------------------------------------------------

/**
 * Manages a Web Worker for PDF generation tasks.
 *
 * Each call to {@link generate} serializes the task function as a
 * string, sends it to the worker, and returns the resulting PDF bytes.
 * The worker is created lazily on the first `generate()` call.
 *
 * **Important:** The task function is serialized via `.toString()` and
 * reconstructed with `new Function()` inside the worker. This means:
 *
 * - The function **cannot** close over variables from the calling scope.
 * - It receives the full `modern-pdf-lib` module as its sole argument.
 * - It must return a `Promise<Uint8Array>` (typically from `doc.save()`).
 */
export class PdfWorker {
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, {
    resolve: (bytes: Uint8Array) => void;
    reject: (error: Error) => void;
  }>();
  private readonly options: PdfWorkerOptions;

  constructor(options: PdfWorkerOptions = {}) {
    this.options = options;
  }

  /**
   * Generate a PDF in the worker thread.
   *
   * @param taskFn - A function that receives the `modern-pdf-lib`
   *                 module and returns PDF bytes. This function is
   *                 serialized to a string and executed in the worker,
   *                 so it **must not** reference any outer-scope
   *                 variables.
   * @returns The generated PDF as a `Uint8Array`.
   *
   * @example
   * ```ts
   * const bytes = await worker.generate(async (pdf) => {
   *   const doc = pdf.createPdf();
   *   const page = doc.addPage(pdf.PageSizes.A4);
   *   page.drawText('Generated in a worker', { x: 50, y: 750, size: 18 });
   *   return doc.save();
   * });
   * ```
   */
  async generate(
    taskFn: (pdf: typeof import('../index.js')) => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const worker = this.getOrCreateWorker();
    const id = this.nextId++;
    const taskCode = taskFn.toString();

    return new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, taskCode } satisfies WorkerRequest);
    });
  }

  /** Terminate the worker and reject all pending tasks. */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const { reject } of this.pending.values()) {
      reject(new Error('PdfWorker terminated'));
    }
    this.pending.clear();
  }

  /** Whether the worker is currently active (has been created and not yet terminated). */
  get isActive(): boolean {
    return this.worker !== null;
  }

  /** Number of in-flight tasks awaiting a response. */
  get pendingCount(): number {
    return this.pending.size;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private getOrCreateWorker(): Worker {
    if (this.worker) return this.worker;

    if (this.options.workerUrl) {
      this.worker = new Worker(
        this.options.workerUrl,
        { type: 'module' },
      );
    } else {
      const blob = new Blob([INLINE_WORKER_SCRIPT], {
        type: 'text/javascript',
      });
      this.worker = new Worker(URL.createObjectURL(blob), {
        type: 'module',
      });
    }

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, result, error } = e.data;
      const handler = this.pending.get(id);
      if (!handler) return;
      this.pending.delete(id);

      if (error) {
        handler.reject(new Error(error));
      } else if (result) {
        handler.resolve(result);
      } else {
        handler.reject(new Error('Worker returned no result'));
      }
    };

    this.worker.onerror = (e: ErrorEvent) => {
      // Reject all pending tasks on unhandled worker error
      const err = new Error(e.message || 'Worker error');
      for (const { reject } of this.pending.values()) {
        reject(err);
      }
      this.pending.clear();
    };

    return this.worker;
  }
}

// ---------------------------------------------------------------------------
// Inline worker script
// ---------------------------------------------------------------------------

/**
 * Self-contained worker script that is embedded as a Blob when no
 * custom `workerUrl` is provided.
 *
 * The script imports `modern-pdf-lib`, listens for task messages,
 * executes the serialized function, and posts back the result.
 * The `Uint8Array` is transferred (zero-copy) via the `transfer`
 * list in `postMessage`.
 */
const INLINE_WORKER_SCRIPT = `
import * as pdf from 'modern-pdf-lib';

self.onmessage = async (e) => {
  const { id, taskCode } = e.data;
  try {
    const taskFn = new Function('return ' + taskCode)();
    const result = await taskFn(pdf);
    if (result instanceof Uint8Array) {
      self.postMessage({ id, result }, [result.buffer]);
    } else {
      self.postMessage({ id, error: 'Task must return a Uint8Array' });
    }
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
`;

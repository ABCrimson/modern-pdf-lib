/**
 * @module runtime/deno
 *
 * Deno implementation of {@link RuntimeAdapter}.
 *
 * This adapter uses native Deno APIs for optimal integration:
 *
 * - `Deno.readFile` / `Deno.writeFile` for filesystem access.
 * - `crypto.getRandomValues` for random bytes.
 * - `fetch` for network requests.
 * - `Worker` (with `type: 'module'`) for off-thread work.
 * - `TransformStream` for readable/writable stream pairs.
 *
 * All Deno-specific APIs are accessed via `globalThis.Deno` to avoid
 * crashes when this module is imported in non-Deno environments.
 * Structural typing is used instead of `@types/deno` so the module
 * compiles without Deno-specific type declarations.
 */

import type { RuntimeAdapter, WorkerLike } from './adapter.js';

// ---------------------------------------------------------------------------
// Structural types for Deno APIs (avoids dependency on @types/deno)
// ---------------------------------------------------------------------------

/**
 * Minimal shape of the `Deno` global we consume.
 */
interface DenoGlobal {
  readFile(path: string | URL): Promise<Uint8Array>;
  writeFile(path: string | URL, data: Uint8Array): Promise<void>;
}

/**
 * Get the `Deno` global, or `undefined` if not available.
 */
function getDenoGlobal(): DenoGlobal | undefined {
  try {
    const d = (globalThis as Record<string, unknown>)['Deno'];
    if (d != null) {
      return d as DenoGlobal;
    }
  } catch {
    // Ignore — accessing Deno may throw in restricted contexts.
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// DenoRuntimeAdapter
// ---------------------------------------------------------------------------

/**
 * {@link RuntimeAdapter} for the Deno runtime.
 *
 * Uses native Deno APIs for file I/O and workers.  All other
 * capabilities use web-standard APIs that Deno provides natively.
 *
 * Instantiation is cheap — the class carries no mutable state.
 * Typically a single instance is cached by the detection layer.
 */
export class DenoRuntimeAdapter implements RuntimeAdapter {
  // -----------------------------------------------------------------------
  // File system
  // -----------------------------------------------------------------------

  /**
   * Read a file from disk via `Deno.readFile`.
   *
   * Requires `--allow-read` permission.
   *
   * @param path  File path (absolute or relative to `Deno.cwd()`).
   * @returns     The file contents as a `Uint8Array`.
   */
  async readFile(path: string): Promise<Uint8Array> {
    const deno = getDenoGlobal();
    if (!deno) {
      throw new Error(
        'DenoRuntimeAdapter.readFile: Deno global is not available.',
      );
    }
    return deno.readFile(path);
  }

  /**
   * Write bytes to a file via `Deno.writeFile`.
   *
   * Requires `--allow-write` permission.
   *
   * @param path  Destination file path.
   * @param data  Bytes to write.
   */
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const deno = getDenoGlobal();
    if (!deno) {
      throw new Error(
        'DenoRuntimeAdapter.writeFile: Deno global is not available.',
      );
    }
    await deno.writeFile(path, data);
  }

  // -----------------------------------------------------------------------
  // Workers
  // -----------------------------------------------------------------------

  /**
   * Create a Web Worker from a script URL.
   *
   * Uses `new Worker(url, { type: 'module' })` which is natively
   * supported by Deno.
   *
   * @param script  URL or path to the worker script.
   * @returns       A {@link WorkerLike} handle.
   */
  createWorker(script: string | URL): WorkerLike {
    const workerUrl = script instanceof URL ? script : new URL(script, 'file:///');
    const worker = new Worker(workerUrl.href, { type: 'module' });

    const handle: WorkerLike = {
      postMessage(message: unknown, transfer?: Transferable[]) {
        if (transfer) {
          worker.postMessage(message, transfer);
        } else {
          worker.postMessage(message);
        }
      },
      onmessage: null,
      onerror: null,
      terminate() {
        worker.terminate();
      },
    };

    worker.onmessage = (event: MessageEvent) => {
      handle.onmessage?.(event);
    };
    worker.onerror = (event: ErrorEvent) => {
      handle.onerror?.(event);
    };

    return handle;
  }

  // -----------------------------------------------------------------------
  // Cryptography
  // -----------------------------------------------------------------------

  /**
   * Generate cryptographically secure random bytes via the Web Crypto
   * API (available natively in Deno).
   *
   * @param length  Number of bytes.
   * @returns       A `Uint8Array` of `length` random bytes.
   */
  randomBytes(length: number): Uint8Array {
    const buf = new Uint8Array(length);
    if (length <= 65_536) {
      crypto.getRandomValues(buf);
    } else {
      for (let offset = 0; offset < length; offset += 65_536) {
        const chunk = Math.min(65_536, length - offset);
        crypto.getRandomValues(buf.subarray(offset, offset + chunk));
      }
    }
    return buf;
  }

  // -----------------------------------------------------------------------
  // Performance
  // -----------------------------------------------------------------------

  /** High-resolution timer via `performance.now()`. */
  readonly performance = {
    now(): number {
      return globalThis.performance.now();
    },
  };

  // -----------------------------------------------------------------------
  // Streams
  // -----------------------------------------------------------------------

  /**
   * Create a paired readable/writable stream using `TransformStream`.
   *
   * `TransformStream` is available natively in Deno.
   *
   * @typeParam T  Chunk type.
   */
  createReadableStream<T>(): {
    readable: ReadableStream<T>;
    writable: WritableStream<T>;
  } {
    const ts = new TransformStream<T, T>();
    return { readable: ts.readable, writable: ts.writable };
  }

  // -----------------------------------------------------------------------
  // Network
  // -----------------------------------------------------------------------

  /**
   * Fetch a URL and return the response body as a `Uint8Array`.
   *
   * Uses the native `fetch` API available in Deno.
   * Requires `--allow-net` permission for remote URLs.
   *
   * @param url  The URL to fetch.
   * @returns    Response body bytes.
   * @throws     If the response is not OK (status outside 200-299).
   */
  async fetchBytes(url: string | URL): Promise<Uint8Array> {
    const response = await fetch(typeof url === 'string' ? url : url.href);
    if (!response.ok) {
      throw new Error(
        `DenoRuntimeAdapter.fetchBytes: HTTP ${response.status} ${response.statusText} for ${String(url)}`,
      );
    }
    const ab = await response.arrayBuffer();
    return new Uint8Array(ab);
  }
}

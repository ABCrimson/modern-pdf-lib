/**
 * @module runtime/browser
 *
 * Browser implementation of {@link RuntimeAdapter}.
 *
 * This adapter is designed to run in modern browsers (Chrome, Firefox,
 * Safari, Edge).  It uses standard Web APIs:
 *
 * - `crypto.getRandomValues` for random bytes.
 * - `fetch` for network requests.
 * - `URL.createObjectURL` + `Worker` for off-thread work.
 * - `TransformStream` for readable/writable stream pairs.
 *
 * File-system operations (`readFile`, `writeFile`) are not available
 * in browsers and always throw.
 */

import type { RuntimeAdapter, WorkerLike } from './adapter.js';

// ---------------------------------------------------------------------------
// BrowserRuntimeAdapter
// ---------------------------------------------------------------------------

/**
 * {@link RuntimeAdapter} for browser environments.
 *
 * Instantiation is cheap — the class carries no mutable state.
 * Typically a single instance is cached by the detection layer.
 */
export class BrowserRuntimeAdapter implements RuntimeAdapter {
  // -----------------------------------------------------------------------
  // File system — not available
  // -----------------------------------------------------------------------

  /**
   * Always throws — the browser has no general filesystem API.
   *
   * If you need to load a file, use `fetchBytes` with a URL
   * or accept a `Uint8Array` directly from the caller.
   */
  readFile(_path: string): Promise<Uint8Array> {
    return Promise.reject(
      new Error(
        'BrowserRuntimeAdapter.readFile: filesystem access is not available in the browser. ' +
        'Use fetchBytes() with a URL, or pass a Uint8Array directly.',
      ),
    );
  }

  /**
   * Always throws — the browser has no general filesystem API.
   *
   * To trigger a file download use the `Blob` / `<a download>` pattern
   * in application code.
   */
  writeFile(_path: string, _data: Uint8Array): Promise<void> {
    return Promise.reject(
      new Error(
        'BrowserRuntimeAdapter.writeFile: filesystem access is not available in the browser. ' +
        'To save a file, create a Blob URL and trigger a download via an <a> element.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Workers
  // -----------------------------------------------------------------------

  /**
   * Create a Web Worker from a script URL.
   *
   * If `script` is a string containing source code rather than a URL,
   * it is wrapped in a `Blob` and loaded via `URL.createObjectURL`.
   *
   * @param script  URL or inline source for the worker.
   * @returns       A {@link WorkerLike} handle.
   */
  createWorker(script: string | URL): WorkerLike {
    let workerUrl: URL | string;

    if (script instanceof URL) {
      workerUrl = script;
    } else if (isUrl(script)) {
      workerUrl = script;
    } else {
      // Treat `script` as inline source code.
      const blob = new Blob([script], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
    }

    const worker = new Worker(workerUrl, { type: 'module' });

    // Wrap in the WorkerLike interface
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
        // Revoke the blob URL if we created one
        if (typeof workerUrl === 'string' && workerUrl.startsWith('blob:')) {
          URL.revokeObjectURL(workerUrl);
        }
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
   * API.
   *
   * @param length  Number of bytes.
   * @returns       A `Uint8Array` of `length` random bytes.
   */
  randomBytes(length: number): Uint8Array {
    const buf = new Uint8Array(length);
    // crypto.getRandomValues has a 65536-byte limit per call
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
   * Create a paired readable/writable stream using
   * `TransformStream`.
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
   * Uses the global `fetch` API available in all modern browsers.
   *
   * @param url  The URL to fetch.
   * @returns    Response body bytes.
   * @throws     If the response is not OK (status outside 200-299).
   */
  async fetchBytes(url: string | URL): Promise<Uint8Array> {
    const response = await fetch(typeof url === 'string' ? url : url.href);
    if (!response.ok) {
      throw new Error(
        `BrowserRuntimeAdapter.fetchBytes: HTTP ${response.status} ${response.statusText} for ${String(url)}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Quick heuristic to decide if a string looks like a URL rather than
 * inline source code.
 */
function isUrl(s: string): boolean {
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('blob:') ||
    s.startsWith('data:') ||
    s.startsWith('/')
  );
}

/**
 * @module runtime/worker
 *
 * Cloudflare Workers adapter for {@link RuntimeAdapter}.
 *
 * Cloudflare Workers provide:
 * - `crypto.getRandomValues` (Web Crypto API)
 * - `fetch` (the core primitive of the Workers runtime)
 * - `TransformStream`
 * - `performance.now()` (though clamped for security)
 *
 * They do **not** provide:
 * - A general filesystem
 * - Sub-worker spawning (only Service Bindings / Durable Objects)
 *
 * This adapter is intentionally minimal so that it can be tree-shaken
 * to almost nothing if the user is not targeting Workers.
 */

import type { RuntimeAdapter, WorkerLike } from './adapter.js';

// ---------------------------------------------------------------------------
// WorkerRuntimeAdapter
// ---------------------------------------------------------------------------

/**
 * {@link RuntimeAdapter} for Cloudflare Workers (and compatible
 * serverless edge runtimes such as Vercel Edge Functions).
 *
 * The adapter is stateless and can be shared across requests.
 */
export class WorkerRuntimeAdapter implements RuntimeAdapter {
  // -----------------------------------------------------------------------
  // File system — not available
  // -----------------------------------------------------------------------

  /**
   * Always throws — Workers have no filesystem.
   *
   * Use `fetchBytes` with an R2 or KV binding URL, or accept bytes
   * directly from the caller.
   */
  readFile(_path: string): Promise<Uint8Array> {
    return Promise.reject(
      new Error(
        'WorkerRuntimeAdapter.readFile: filesystem access is not available in Cloudflare Workers. ' +
        'Use fetchBytes() or pass a Uint8Array from an R2/KV binding instead.',
      ),
    );
  }

  /**
   * Always throws — Workers have no filesystem.
   *
   * Write to R2 or KV directly in your handler code.
   */
  writeFile(_path: string, _data: Uint8Array): Promise<void> {
    return Promise.reject(
      new Error(
        'WorkerRuntimeAdapter.writeFile: filesystem access is not available in Cloudflare Workers. ' +
        'Write to R2 or KV directly from your handler code.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Workers — not available
  // -----------------------------------------------------------------------

  /**
   * Always throws — Cloudflare Workers cannot spawn sub-workers.
   *
   * For parallelism, use Service Bindings or Durable Objects.
   */
  createWorker(_script: string | URL): WorkerLike {
    throw new Error(
      'WorkerRuntimeAdapter.createWorker: sub-workers are not supported in Cloudflare Workers. ' +
      'Use Service Bindings or Durable Objects for inter-worker communication.',
    );
  }

  // -----------------------------------------------------------------------
  // Cryptography
  // -----------------------------------------------------------------------

  /**
   * Generate cryptographically secure random bytes.
   *
   * Uses the Web Crypto API provided by the Workers runtime.
   *
   * @param length  Number of bytes.
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

  /**
   * High-resolution timer.
   *
   * Note: in Cloudflare Workers `performance.now()` may be
   * quantized for security reasons (Spectre mitigations).
   */
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
   * `TransformStream` is available natively in the Workers runtime.
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
   * Fetch a URL and return the body as a `Uint8Array`.
   *
   * Uses the Workers-native `fetch` which supports sub-requests
   * within the request context.
   *
   * @param url  The URL to fetch.
   */
  async fetchBytes(url: string | URL): Promise<Uint8Array> {
    const response = await fetch(typeof url === 'string' ? url : url.href);
    if (!response.ok) {
      throw new Error(
        `WorkerRuntimeAdapter.fetchBytes: HTTP ${response.status} ${response.statusText} for ${String(url)}`,
      );
    }
    const ab = await response.arrayBuffer();
    return new Uint8Array(ab);
  }
}

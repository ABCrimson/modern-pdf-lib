/**
 * @module runtime/node
 *
 * Node.js 22+ implementation of {@link RuntimeAdapter}.
 *
 * All Node-specific APIs are accessed via **dynamic `import()`** to
 * avoid static dependencies that would break bundlers targeting
 * browsers.  This means the module can be safely *imported* in any
 * environment — it only fails at runtime if a Node-only method is
 * actually called outside Node.
 *
 * The types from `@types/node` are intentionally not referenced so
 * that the project compiles with `"types": []` in tsconfig.  All
 * Node module shapes are modelled with inline structural types.
 *
 * Requirements:
 * - Node >= 22 (built-in `fetch`, `crypto.webcrypto`,
 *   `ReadableStream` / `WritableStream`, `worker_threads`).
 */

import type { RuntimeAdapter, WorkerLike } from './adapter.js';

// ---------------------------------------------------------------------------
// Dynamic import helper
// ---------------------------------------------------------------------------

/**
 * Dynamic import wrapper that prevents TypeScript from resolving the
 * module specifier at compile time.  This is necessary because the
 * tsconfig has `"types": []` which excludes `@types/node`, and TS
 * would error on `import('node:fs/promises')` etc.
 *
 * At runtime the string is passed straight through to the host's
 * module loader.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as
  (specifier: string) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Structural types for dynamically-imported Node modules
// ---------------------------------------------------------------------------

/** Minimal shape of the `node:fs/promises` module we consume. */
interface NodeFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

/**
 * Minimal shape of a `node:worker_threads` Worker instance.
 *
 * We only use `postMessage`, `on`, and `terminate`.
 */
interface NodeWorkerInstance {
  postMessage(value: unknown, transferList?: ArrayBuffer[]): void;
  on(event: 'message', listener: (value: unknown) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  terminate(): Promise<number>;
}

/** Minimal shape of the `node:worker_threads` module. */
interface NodeWorkerThreads {
  Worker: new (filename: string | URL) => NodeWorkerInstance;
}

// ---------------------------------------------------------------------------
// Lazy module cache
// ---------------------------------------------------------------------------

/**
 * Cache for dynamically imported Node built-in modules.
 *
 * Each entry starts as `undefined` and is populated on first use.
 */
const cache: {
  fs?: NodeFs;
  workerThreads?: NodeWorkerThreads;
} = {};

/**
 * Lazily load `node:fs/promises`.
 */
async function getFs(): Promise<NodeFs> {
  if (cache.fs === undefined) {
    cache.fs = (await dynamicImport('node:fs/promises')) as NodeFs;
  }
  return cache.fs;
}

/**
 * Lazily load `node:worker_threads`.
 */
async function getWorkerThreads(): Promise<NodeWorkerThreads> {
  if (cache.workerThreads === undefined) {
    cache.workerThreads = (await dynamicImport('node:worker_threads')) as NodeWorkerThreads;
  }
  return cache.workerThreads;
}

// ---------------------------------------------------------------------------
// NodeRuntimeAdapter
// ---------------------------------------------------------------------------

/**
 * {@link RuntimeAdapter} for Node.js 22+.
 *
 * Every Node built-in is accessed via dynamic `import()` so that this
 * module can be parsed and tree-shaken by bundlers without pulling in
 * Node-specific globals.
 */
export class NodeRuntimeAdapter implements RuntimeAdapter {
  // -----------------------------------------------------------------------
  // File system
  // -----------------------------------------------------------------------

  /**
   * Read a file from disk via `node:fs/promises`.
   *
   * @param path  File path (absolute or relative to `process.cwd()`).
   * @returns     The file contents.
   */
  async readFile(path: string): Promise<Uint8Array> {
    const fs = await getFs();
    // fs.readFile returns a Node Buffer which is a Uint8Array subclass.
    // We wrap it in a plain Uint8Array to keep the contract clean.
    const buf = await fs.readFile(path);
    return new Uint8Array(
      (buf as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }).buffer,
      (buf as unknown as { byteOffset: number }).byteOffset,
      (buf as unknown as { byteLength: number }).byteLength,
    );
  }

  /**
   * Write bytes to a file via `node:fs/promises`.
   *
   * @param path  Destination file path.
   * @param data  Bytes to write.
   */
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const fs = await getFs();
    await fs.writeFile(path, data);
  }

  // -----------------------------------------------------------------------
  // Workers
  // -----------------------------------------------------------------------

  /**
   * Create a worker thread via `node:worker_threads`.
   *
   * The returned {@link WorkerLike} wraps a Node `Worker` and adapts
   * its event model to the Web Worker-like interface expected by the
   * rest of the codebase.
   *
   * **Important:** call `await adapter.preload()` before invoking
   * this method so that the `node:worker_threads` module is
   * synchronously available.
   *
   * @param script  Path or URL to the worker script.
   */
  createWorker(script: string | URL): WorkerLike {
    if (cache.workerThreads === undefined) {
      throw new Error(
        'NodeRuntimeAdapter.createWorker: node:worker_threads has not been loaded yet. ' +
        'Call `await nodeAdapter.preload()` before using createWorker.',
      );
    }

    const { Worker } = cache.workerThreads;
    const scriptArg = script instanceof URL ? script : new URL(script, 'file:///');
    const nodeWorker = new Worker(scriptArg);

    const handle: WorkerLike = {
      postMessage(message: unknown, transfer?: Transferable[]) {
        nodeWorker.postMessage(message, transfer as ArrayBuffer[] | undefined);
      },
      onmessage: null,
      onerror: null,
      terminate() {
        void nodeWorker.terminate();
      },
    };

    nodeWorker.on('message', (data: unknown) => {
      handle.onmessage?.({ data } as MessageEvent);
    });
    nodeWorker.on('error', (err: Error) => {
      handle.onerror?.({ message: err.message, error: err } as unknown as ErrorEvent);
    });

    return handle;
  }

  // -----------------------------------------------------------------------
  // Cryptography
  // -----------------------------------------------------------------------

  /**
   * Generate cryptographically secure random bytes.
   *
   * Uses `globalThis.crypto.getRandomValues` which is available in
   * Node 19+ and is backed by OpenSSL.
   *
   * @param length  Number of bytes.
   */
  randomBytes(length: number): Uint8Array {
    const buf = new Uint8Array(length);
    // Node 22 exposes the Web Crypto API on globalThis.crypto
    if (length <= 65_536) {
      globalThis.crypto.getRandomValues(buf);
    } else {
      for (let offset = 0; offset < length; offset += 65_536) {
        const chunk = Math.min(65_536, length - offset);
        globalThis.crypto.getRandomValues(buf.subarray(offset, offset + chunk));
      }
    }
    return buf;
  }

  // -----------------------------------------------------------------------
  // Performance
  // -----------------------------------------------------------------------

  /** High-resolution timer via `performance.now()` (available in Node 16+). */
  readonly performance = {
    now(): number {
      return globalThis.performance.now();
    },
  };

  // -----------------------------------------------------------------------
  // Streams
  // -----------------------------------------------------------------------

  /**
   * Create a paired readable/writable stream using the web-standard
   * `TransformStream` (available in Node 18+).
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
   * Uses the built-in `globalThis.fetch` available in Node 22+.
   *
   * @param url  The URL to fetch.
   */
  async fetchBytes(url: string | URL): Promise<Uint8Array> {
    const response = await globalThis.fetch(url);
    if (!response.ok) {
      throw new Error(
        `NodeRuntimeAdapter.fetchBytes: HTTP ${response.status} ${response.statusText} for ${String(url)}`,
      );
    }
    const ab = await response.arrayBuffer();
    return new Uint8Array(ab);
  }

  // -----------------------------------------------------------------------
  // Pre-loading
  // -----------------------------------------------------------------------

  /**
   * Pre-load all dynamically imported Node modules so that
   * synchronous methods like `createWorker` can work immediately.
   *
   * Call this once during application startup:
   *
   * ```ts
   * const adapter = new NodeRuntimeAdapter();
   * await adapter.preload();
   * setRuntime(adapter);
   * ```
   */
  async preload(): Promise<void> {
    await Promise.all([getFs(), getWorkerThreads()]);
  }
}

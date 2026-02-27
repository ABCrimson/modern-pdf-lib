/**
 * @module runtime/adapter
 *
 * Runtime abstraction interface.
 *
 * modern-pdf must work on Node 22+, Deno, Bun, Cloudflare Workers,
 * and browsers — each with its own set of available APIs.  The
 * {@link RuntimeAdapter} interface provides a uniform surface that the
 * rest of the codebase programs against, and the concrete
 * implementations in `browser.ts`, `node.ts`, and `worker.ts` fill
 * in the platform-specific details.
 *
 * ```ts
 * import { getRuntime } from './adapter.js';
 *
 * const rt = getRuntime();
 * const bytes = await rt.fetchBytes('https://example.com/font.ttf');
 * ```
 */

// ---------------------------------------------------------------------------
// Worker-like interface (subset of the Web Worker API)
// ---------------------------------------------------------------------------

/**
 * Minimal worker interface returned by
 * {@link RuntimeAdapter.createWorker}.
 *
 * This is intentionally a small subset of the full `Worker` API so
 * that it can be backed by either a Web Worker or a Node
 * `worker_threads.Worker`.
 */
export interface WorkerLike {
  /** Post a message to the worker thread. */
  postMessage(message: unknown, transfer?: Transferable[]): void;
  /** Register a message handler. */
  onmessage: ((event: MessageEvent) => void) | null;
  /** Register an error handler. */
  onerror: ((event: ErrorEvent) => void) | null;
  /** Terminate the worker. */
  terminate(): void;
}

// ---------------------------------------------------------------------------
// RuntimeAdapter interface
// ---------------------------------------------------------------------------

/**
 * Abstraction over host-specific APIs.
 *
 * Each method corresponds to a capability that varies across
 * runtimes.  Implementations are expected to throw a
 * {@link ModernPdfError} with code `INVALID_INPUT` when an operation
 * is not available on the current platform (e.g. `readFile` in a
 * browser).
 */
export interface RuntimeAdapter {
  /**
   * Read a file from the filesystem.
   *
   * Not available in browsers or Cloudflare Workers — those adapters
   * throw.
   *
   * @param path  Absolute or relative file path.
   * @returns     The file contents as a `Uint8Array`.
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Write a file to the filesystem.
   *
   * Not available in browsers or Cloudflare Workers.
   *
   * @param path  Destination file path.
   * @param data  The bytes to write.
   */
  writeFile(path: string, data: Uint8Array): Promise<void>;

  /**
   * Create a worker thread from a script URL or source.
   *
   * @param script  URL to the worker script, or a `URL` object.
   * @returns       A {@link WorkerLike} handle.
   */
  createWorker(script: string | URL): WorkerLike;

  /**
   * Generate cryptographically secure random bytes.
   *
   * @param length  Number of random bytes to produce.
   * @returns       A `Uint8Array` of `length` random bytes.
   */
  randomBytes(length: number): Uint8Array;

  /**
   * High-resolution timer.
   */
  performance: {
    /** Returns a high-resolution timestamp in milliseconds. */
    now(): number;
  };

  /**
   * Create a paired readable/writable stream (a "transform-stream
   * pair").
   *
   * @typeParam T  The chunk type.
   * @returns      An object with `readable` and `writable` properties.
   */
  createReadableStream<T>(): {
    readable: ReadableStream<T>;
    writable: WritableStream<T>;
  };

  /**
   * Fetch a URL and return the response body as a `Uint8Array`.
   *
   * @param url  The URL to fetch.
   * @returns    The response body bytes.
   */
  fetchBytes(url: string | URL): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** The currently active adapter (lazily initialised). */
let currentAdapter: RuntimeAdapter | undefined;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the current {@link RuntimeAdapter}.
 *
 * On the first call the adapter is auto-detected via
 * `createRuntimeAdapter()` from `./detect.js`.  Subsequent calls
 * return the cached instance unless {@link setRuntime} is used to
 * override it.
 *
 * @returns The active runtime adapter.
 */
export function getRuntime(): RuntimeAdapter {
  if (currentAdapter === undefined) {
    // Lazy import to break circular dependency with detect.ts
    // The detect module imports the concrete adapters, and they
    // import this interface file — so we lazily resolve only when
    // actually called.
    //
    // At this point we *cannot* use dynamic `import()` because
    // `getRuntime` is synchronous.  Instead, `detect.ts` is expected
    // to register itself on first load via `setRuntime`.
    //
    // If nobody has called `setRuntime` yet, we do a best-effort
    // inline detection.
    currentAdapter = inlineDetect();
  }
  return currentAdapter;
}

/**
 * Override the auto-detected adapter.
 *
 * Call this before any other modern-pdf API if you want to force a
 * specific runtime (useful for testing or unusual environments).
 *
 * @param adapter  The adapter instance to use.
 */
export function setRuntime(adapter: RuntimeAdapter): void {
  currentAdapter = adapter;
}

// ---------------------------------------------------------------------------
// Inline fallback detection
// ---------------------------------------------------------------------------

/**
 * Minimal inline detection that returns a placeholder adapter.
 *
 * This is only used if `getRuntime()` is called before `detect.ts`
 * has had a chance to initialise.  A real application should import
 * `./detect.js` (or one of the concrete adapter modules) first.
 */
function inlineDetect(): RuntimeAdapter {
  // We attempt a synchronous best-guess.  The concrete adapters
  // are designed to be tree-shakable, so we avoid importing them
  // statically here.  Instead we return a "universal" adapter that
  // relies only on APIs available everywhere (globalThis.fetch,
  // crypto.getRandomValues, etc.) and throws for FS operations.
  return {
    readFile: () =>
      Promise.reject(new Error('readFile is not available in this runtime. Import a concrete adapter.')),

    writeFile: () =>
      Promise.reject(new Error('writeFile is not available in this runtime. Import a concrete adapter.')),

    createWorker: () => {
      throw new Error('createWorker is not available in this runtime. Import a concrete adapter.');
    },

    randomBytes(length: number): Uint8Array {
      const buf = new Uint8Array(length);
      globalThis.crypto.getRandomValues(buf);
      return buf;
    },

    performance: {
      now: () => globalThis.performance.now(),
    },

    createReadableStream<T>() {
      const ts = new TransformStream<T, T>();
      return { readable: ts.readable, writable: ts.writable };
    },

    async fetchBytes(url: string | URL): Promise<Uint8Array> {
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(`fetchBytes: HTTP ${response.status} for ${String(url)}`);
      }
      const ab = await response.arrayBuffer();
      return new Uint8Array(ab);
    },
  };
}

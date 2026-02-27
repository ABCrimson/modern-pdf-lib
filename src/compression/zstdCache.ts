/**
 * @module compression/zstdCache
 *
 * Zstandard (Zstd) compression for internal caching only.
 *
 * **Important:** This module is NOT used for PDF output streams.
 * Zstd is not part of the PDF specification. It is used exclusively
 * for internal purposes such as:
 *
 * - Caching intermediate compilation results (font subsetting, image
 *   processing) in memory or on disk
 * - Compressing large temporary buffers during document assembly
 * - Optional persistent cache storage for repeated operations
 *
 * The implementation uses a WASM-compiled Zstd codec. Since Zstd
 * support is optional and future-facing, all methods are currently
 * TODO stubs.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the Zstd cache. */
export interface ZstdCacheOptions {
  /**
   * Zstd compression level.
   *
   * Zstd supports levels 1-22 (default: 3). Higher levels provide
   * better compression at the cost of speed. Negative levels (-1 to
   * -7) enable fast mode.
   *
   * Default: `3`
   */
  level?: number | undefined;

  /**
   * Maximum cache entry size in bytes.
   *
   * Entries larger than this are not compressed (stored raw).
   * Default: `64 * 1024 * 1024` (64 MiB)
   */
  maxEntrySize?: number | undefined;

  /**
   * Maximum total cache size in bytes.
   *
   * When the cache exceeds this size, the least recently used entries
   * are evicted. Default: `256 * 1024 * 1024` (256 MiB)
   */
  maxTotalSize?: number | undefined;

  /**
   * Optional pre-trained Zstd dictionary for better compression of
   * small, similar data (e.g. font tables).
   */
  dictionary?: Uint8Array | undefined;
}

/** A single cache entry. */
interface CacheEntry {
  /** The compressed (or raw) data. */
  data: Uint8Array;

  /** Original uncompressed size. */
  originalSize: number;

  /** Whether the data is Zstd-compressed. */
  compressed: boolean;

  /** Last access timestamp (for LRU eviction). */
  lastAccess: number;
}

// ---------------------------------------------------------------------------
// WASM Zstd module interface
// ---------------------------------------------------------------------------

/**
 * Shape of the exports from a hypothetical Zstd WASM module.
 *
 * This will be filled in when a Zstd WASM build is added to the
 * project.
 */
interface ZstdWasmExports {
  /** Compress data. Returns compressed bytes. */
  compress(inputPtr: number, inputLen: number, outputPtr: number, outputLen: number, level: number): number;

  /** Decompress data. Returns decompressed bytes. */
  decompress(inputPtr: number, inputLen: number, outputPtr: number, maxOutputLen: number): number;

  /** Get the decompressed size from a compressed frame (if available). */
  getFrameContentSize(inputPtr: number, inputLen: number): number;

  /** Allocate memory in WASM. */
  alloc(size: number): number;

  /** Free WASM memory. */
  dealloc(ptr: number, size: number): void;

  /** WASM linear memory. */
  memory: WebAssembly.Memory;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** The Zstd WASM module, or null if not loaded. */
let _zstdWasm: ZstdWasmExports | null = null;

// ---------------------------------------------------------------------------
// ZstdCache class
// ---------------------------------------------------------------------------

/**
 * An in-memory cache that uses Zstd compression to reduce memory
 * footprint for intermediate data.
 *
 * **Not for PDF output.** Zstd is not a PDF-standard compression
 * filter. This cache is for internal use only -- e.g., caching
 * processed font data or image buffers between operations.
 *
 * @example
 * ```ts
 * const cache = new ZstdCache({ level: 3 });
 * await cache.init();
 *
 * cache.set('font:subset:abc123', subsetData);
 * const data = cache.get('font:subset:abc123');
 * ```
 */
export class ZstdCache {
  private readonly level: number;
  private readonly maxEntrySize: number;
  private readonly maxTotalSize: number;
  private readonly dictionary: Uint8Array | undefined;
  private readonly entries = new Map<string, CacheEntry>();
  private totalSize = 0;
  private initialized = false;

  constructor(options?: ZstdCacheOptions) {
    this.level = options?.level ?? 3;
    this.maxEntrySize = options?.maxEntrySize ?? 64 * 1024 * 1024;
    this.maxTotalSize = options?.maxTotalSize ?? 256 * 1024 * 1024;
    this.dictionary = options?.dictionary;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Initialize the Zstd WASM module.
   *
   * Must be called before using compress/decompress operations.
   * If WASM is not available, the cache will store data uncompressed.
   *
   * @param wasmBytes - Optional pre-loaded Zstd WASM binary.
   */
  async init(wasmBytes?: Uint8Array): Promise<void> {
    if (this.initialized) return;

    // TODO: Load and instantiate the Zstd WASM module
    // 1. If wasmBytes provided, use them directly
    // 2. Otherwise, try loading via the universal WASM loader
    // 3. Instantiate the module
    // 4. If dictionary provided, initialize the dictionary context
    // 5. Set _zstdWasm and mark as initialized

    void wasmBytes;
    void _zstdWasm;
    void this.dictionary;

    this.initialized = true;
  }

  /**
   * Whether the Zstd WASM module is loaded and compression is available.
   */
  get isCompressed(): boolean {
    return _zstdWasm !== null;
  }

  // -----------------------------------------------------------------------
  // Cache operations
  // -----------------------------------------------------------------------

  /**
   * Store data in the cache under the given key.
   *
   * If Zstd is available, the data is compressed before storage.
   * If the data exceeds `maxEntrySize`, it is stored uncompressed.
   *
   * @param key  - Cache key (arbitrary string).
   * @param data - Data to cache.
   */
  set(key: string, data: Uint8Array): void {
    // Remove existing entry if present
    this.delete(key);

    // TODO: Compress data with Zstd if available
    // 1. If _zstdWasm is available and data.length <= maxEntrySize:
    //    a. Allocate input/output buffers in WASM memory
    //    b. Copy data in
    //    c. Call _zstdWasm.compress()
    //    d. Copy compressed data out
    //    e. Free WASM buffers
    //    f. Store as compressed entry
    // 2. Otherwise, store raw

    const entry: CacheEntry = {
      data: data.slice(), // Defensive copy
      originalSize: data.length,
      compressed: false, // TODO: Set to true when Zstd compression is implemented
      lastAccess: Date.now(),
    };

    this.entries.set(key, entry);
    this.totalSize += entry.data.length;

    // Evict old entries if over budget
    this.evictIfNeeded();
  }

  /**
   * Retrieve data from the cache.
   *
   * @param key - Cache key.
   * @returns     The cached data, or `undefined` if not found.
   */
  get(key: string): Uint8Array | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    // Update LRU timestamp
    entry.lastAccess = Date.now();

    if (!entry.compressed) {
      return entry.data.slice(); // Defensive copy
    }

    // TODO: Decompress with Zstd
    // 1. Allocate input/output buffers in WASM memory
    // 2. Copy compressed data in
    // 3. Call _zstdWasm.decompress()
    // 4. Copy decompressed data out
    // 5. Free WASM buffers
    // 6. Return decompressed data

    return entry.data.slice(); // Fallback: return raw data
  }

  /**
   * Check whether a key exists in the cache.
   *
   * @param key - Cache key.
   * @returns     `true` if the key is present.
   */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Remove an entry from the cache.
   *
   * @param key - Cache key to remove.
   * @returns     `true` if the entry was removed, `false` if not found.
   */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.totalSize -= entry.data.length;
    return this.entries.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.entries.clear();
    this.totalSize = 0;
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get the total memory used by cached data (compressed sizes).
   */
  get memoryUsage(): number {
    return this.totalSize;
  }

  /**
   * Dispose of the cache and release all resources.
   *
   * After calling this, the cache must not be used.
   */
  dispose(): void {
    this.clear();
    this.initialized = false;

    // TODO: Release Zstd WASM dictionary context if one was created
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Evict least-recently-used entries until total size is within budget.
   */
  private evictIfNeeded(): void {
    if (this.totalSize <= this.maxTotalSize) return;

    // Sort entries by last access time (oldest first)
    const sorted = this.entries.entries().toArray().sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess,
    );

    for (const [key, entry] of sorted) {
      if (this.totalSize <= this.maxTotalSize) break;
      this.totalSize -= entry.data.length;
      this.entries.delete(key);
    }
  }
}

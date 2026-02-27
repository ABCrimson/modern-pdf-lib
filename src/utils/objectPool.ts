/**
 * @module utils/objectPool
 *
 * Memory pools for hot-path allocations.
 *
 * PDF serialization and binary manipulation create many short-lived
 * `Uint8Array` and `DataView` objects.  Pooling them reduces GC
 * pressure and can measurably improve throughput on large documents.
 *
 * ## Usage
 *
 * ```ts
 * const pool = new ByteArrayPool();
 * const buf = pool.acquire(4096);   // >= 4096 bytes
 * // ... use buf ...
 * pool.release(buf);                // return to pool
 * ```
 */

// ---------------------------------------------------------------------------
// Generic ObjectPool<T>
// ---------------------------------------------------------------------------

/**
 * A simple object pool that maintains a free-list of reusable
 * instances.
 *
 * @typeParam T  The type of object managed by the pool.
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly maxSize: number;
  private readonly factory: () => T;
  private readonly reset?: ((item: T) => void) | undefined;

  /**
   * @param factory   Function that creates a new instance when the pool
   *                  is empty.
   * @param options   Optional configuration.
   * @param options.maxSize  Maximum number of idle items to retain
   *                         (default: `64`).
   * @param options.reset    Optional function called on an item before
   *                         it is returned by {@link acquire} to
   *                         ensure a clean state.
   */
  constructor(
    factory: () => T,
    options?: {
      maxSize?: number | undefined;
      reset?: ((item: T) => void) | undefined;
    },
  ) {
    this.factory = factory;
    this.maxSize = options?.maxSize ?? 64;
    this.reset = options?.reset;
  }

  /** Number of idle items currently in the pool. */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Acquire an item from the pool.
   *
   * If the pool is empty, a new instance is created via the factory.
   * If a reset function was provided, it is called on recycled items.
   *
   * @returns A ready-to-use instance.
   */
  acquire(): T {
    const item = this.pool.pop();
    if (item !== undefined) {
      this.reset?.(item);
      return item;
    }
    return this.factory();
  }

  /**
   * Return an item to the pool for later reuse.
   *
   * If the pool has reached `maxSize`, the item is silently discarded
   * (it becomes eligible for GC).
   *
   * @param item  The item to return.
   */
  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(item);
    }
  }

  /**
   * Discard all pooled items, freeing the memory.
   */
  drain(): void {
    this.pool.length = 0;
  }
}

// ---------------------------------------------------------------------------
// ByteArrayPool — specialized pool for Uint8Array
// ---------------------------------------------------------------------------

/**
 * Standard bucket sizes (bytes) for the byte-array pool.
 *
 * Each bucket holds arrays of exactly that capacity.  When a caller
 * requests `minSize` bytes, we return the smallest bucket that fits.
 */
const BUCKET_SIZES = [256, 1024, 4096, 16_384, 65_536] as const;

/** Maximum idle arrays per bucket. */
const MAX_PER_BUCKET = 16;

/** A single size-specific bucket of byte arrays. */
interface Bucket {
  readonly capacity: number;
  readonly arrays: Uint8Array[];
}

/**
 * Specialized pool for `Uint8Array` allocations.
 *
 * Maintains separate buckets for common sizes (256, 1K, 4K, 16K, 64K).
 * Arrays are returned with their *full* capacity — callers track the
 * logical length separately.
 *
 * ```ts
 * const pool = new ByteArrayPool();
 * const buf = pool.acquire(3000);  // returns a 4096-byte array
 * // ... fill buf[0..2999] ...
 * pool.release(buf);               // returns to the 4096 bucket
 * ```
 */
export class ByteArrayPool {
  private readonly buckets: Bucket[];

  constructor() {
    this.buckets = BUCKET_SIZES.map((capacity) => ({
      capacity,
      arrays: [],
    }));
  }

  /**
   * Acquire a `Uint8Array` with at least `minSize` bytes of capacity.
   *
   * The returned array's `length` property reflects the bucket
   * capacity, which may be larger than `minSize`.  If no bucket is
   * large enough, a fresh allocation of exactly `minSize` bytes is
   * returned.
   *
   * @param minSize  Minimum number of bytes needed.
   * @returns        A `Uint8Array` with `length >= minSize`.
   */
  acquire(minSize: number): Uint8Array {
    // Find the smallest bucket that satisfies the request
    for (const bucket of this.buckets) {
      if (bucket.capacity >= minSize) {
        const cached = bucket.arrays.pop();
        if (cached !== undefined) {
          return cached;
        }
        return new Uint8Array(bucket.capacity);
      }
    }

    // Larger than any bucket — allocate exactly
    return new Uint8Array(minSize);
  }

  /**
   * Return a `Uint8Array` to the pool.
   *
   * The array is placed into the bucket matching its `length`.  If no
   * bucket matches (e.g. the array was a non-standard size or the
   * bucket is full), it is silently discarded.
   *
   * @param buffer  The array to return.
   */
  release(buffer: Uint8Array): void {
    for (const bucket of this.buckets) {
      if (buffer.length === bucket.capacity) {
        if (bucket.arrays.length < MAX_PER_BUCKET) {
          bucket.arrays.push(buffer);
        }
        return;
      }
    }
    // Non-standard size — let GC handle it
  }

  /**
   * Discard all pooled arrays across every bucket.
   */
  drain(): void {
    for (const bucket of this.buckets) {
      bucket.arrays.length = 0;
    }
  }

  /**
   * Total number of idle arrays across all buckets.
   */
  get size(): number {
    let total = 0;
    for (const bucket of this.buckets) {
      total += bucket.arrays.length;
    }
    return total;
  }
}

// ---------------------------------------------------------------------------
// DataViewPool — reuse DataView wrappers
// ---------------------------------------------------------------------------

/**
 * Pool for `DataView` instances that wrap `Uint8Array` buffers.
 *
 * Creating a `DataView` is cheap, but in tight loops the allocation
 * overhead can add up.  This pool recycles `DataView` objects by
 * re-pointing them at new buffers.
 *
 * Since `DataView` cannot be re-bound to a different `ArrayBuffer`
 * after construction, the pool stores DataView instances keyed by
 * their underlying buffer identity.  In practice this is most useful
 * when repeatedly wrapping the *same* buffer.
 *
 * For hot-path usage, prefer creating a single DataView for a buffer
 * and reusing it manually.  This class exists as a convenience when
 * the buffer identity varies.
 */
export class DataViewPool {
  private cache = new WeakMap<ArrayBuffer, DataView>();

  /**
   * Get or create a `DataView` for the given `Uint8Array`.
   *
   * If a DataView for the same underlying `ArrayBuffer` was
   * previously returned and has not been garbage collected, it is
   * reused.
   *
   * @param data  The byte array to wrap.
   * @returns     A `DataView` covering `data`'s byte range.
   */
  acquire(data: Uint8Array): DataView {
    const buffer = data.buffer as ArrayBuffer;
    let view = this.cache.get(buffer);
    if (
      view !== undefined &&
      view.byteOffset === data.byteOffset &&
      view.byteLength === data.byteLength
    ) {
      return view;
    }
    view = new DataView(buffer, data.byteOffset, data.byteLength);
    this.cache.set(buffer, view);
    return view;
  }

  /**
   * Releasing is a no-op — the WeakMap handles cleanup
   * automatically when the underlying ArrayBuffer is GC'd.
   */
  release(_view: DataView): void {
    // Intentional no-op.  The WeakMap entry is collected when the
    // ArrayBuffer is no longer referenced.
  }

  /**
   * Clear the internal cache.
   *
   * Not strictly necessary (the WeakMap collects itself), but useful
   * for deterministic cleanup in tests.
   */
  drain(): void {
    // WeakMap does not have a `clear()` method, so we replace it.
    this.cache = new WeakMap<ArrayBuffer, DataView>();
  }
}

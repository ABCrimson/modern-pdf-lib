/**
 * @module runtime/sharedConcurrency
 *
 * `SharedArrayBuffer` + `Atomics` concurrency primitives for coordinating
 * work across Web Workers / `worker_threads`. These are thin, correctness
 * focused wrappers around the standard atomic operations — they add no
 * acceleration of their own and make no use of SIMD or any other hardware
 * feature. They simply expose race-free counters, flags, and a byte ring
 * so multiple agents can share state through a single `SharedArrayBuffer`.
 *
 * Availability caveats (feature-detected, never assumed):
 *
 * - `SharedArrayBuffer` and `Atomics` must both exist. In browsers, shared
 *   memory additionally requires the page to be *cross-origin isolated*
 *   (COOP+COEP headers); we treat `crossOriginIsolated === false` as
 *   "unavailable". See {@link isSharedMemoryAvailable}.
 * - `Atomics.wait` is only permitted on a non-main agent (it throws on the
 *   main browser thread and would deadlock the event loop everywhere). The
 *   {@link SharedFlag} `wait` method feature-detects this and degrades to a
 *   non-blocking poll rather than throwing — see its docs.
 *
 * All references below are to the ECMA-262 `Atomics` semantics and MDN:
 *
 * - `Atomics.add(ta, i, v)` atomically adds `v` and returns the **previous**
 *   value at index `i` (the value before the addition).
 * - `Atomics.compareExchange(ta, i, expected, replacement)` writes
 *   `replacement` iff the current value equals `expected`, and returns the
 *   value that was at index `i` **before** the call (so success is detected
 *   by `result === expected`).
 * - `Atomics.notify(ta, i, count)` wakes up to `count` agents blocked in
 *   `Atomics.wait` on index `i` and returns the number actually woken (0 if
 *   none are waiting). It is safe to call from any thread, including the
 *   main thread.
 * - `Atomics.wait(ta, i, value, timeout)` blocks while the slot equals
 *   `value`, returning `'ok'`, `'timed-out'`, or `'not-equal'`.
 */

// ---------------------------------------------------------------------------
// Internal helpers (not exported — no isolatedDeclarations annotation needed)
// ---------------------------------------------------------------------------

/**
 * Bytes per `Int32Array` element. Atomics operate on 32-bit integer views.
 */
const INT32_BYTES = 4;

/**
 * Reference to the global `SharedArrayBuffer` constructor, or `undefined`
 * when the runtime does not provide one. Captured via `globalThis` so the
 * module loads without a `ReferenceError` on platforms that omit it.
 */
const SharedArrayBufferCtor: typeof SharedArrayBuffer | undefined = (
  globalThis as { SharedArrayBuffer?: typeof SharedArrayBuffer }
).SharedArrayBuffer;

/**
 * Allocate a fresh zero-initialised `SharedArrayBuffer` of `byteLength`
 * bytes, throwing a clear error if shared memory is not available.
 */
function allocShared(byteLength: number): SharedArrayBuffer {
  if (SharedArrayBufferCtor === undefined) {
    throw new Error(
      'sharedConcurrency: SharedArrayBuffer is not available in this runtime. ' +
        'Call isSharedMemoryAvailable() before constructing these primitives.',
    );
  }
  return new SharedArrayBufferCtor(byteLength);
}

// ---------------------------------------------------------------------------
// Availability detection
// ---------------------------------------------------------------------------

/**
 * Report whether shared-memory concurrency is usable in this runtime.
 *
 * Returns `true` only when **both** `SharedArrayBuffer` and `Atomics`
 * exist, and — in a browser context that exposes `crossOriginIsolated` —
 * that flag is not `false`. The check is fully defensive: it performs only
 * `typeof` probes and never throws, so it is safe to call as a guard before
 * touching any other export here.
 *
 * Note: `crossOriginIsolated` is only consulted when it is a boolean. On
 * Node / Deno / Bun / Workers (where it is typically `undefined`) we do not
 * treat its absence as a failure, since those runtimes allow shared memory
 * without the browser's COOP/COEP isolation requirement.
 *
 * @returns `true` iff shared-memory primitives can be constructed and used.
 */
export function isSharedMemoryAvailable(): boolean {
  try {
    if (typeof SharedArrayBuffer === 'undefined') return false;
    if (typeof Atomics === 'undefined') return false;

    // Browser cross-origin isolation: when the host exposes the flag and it
    // is explicitly `false`, shared memory is disabled even though the
    // constructor exists. `undefined` (non-browser) is treated as "fine".
    const coi = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated;
    if (coi === false) return false;

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SharedCounter
// ---------------------------------------------------------------------------

/**
 * An atomic 32-bit integer counter backed by a single slot of an
 * `Int32Array` view over a `SharedArrayBuffer`. Multiple `SharedCounter`
 * instances constructed over the **same** buffer and index observe each
 * other's writes, so the counter can be shared across workers by passing
 * its {@link SharedCounter.buffer} through `postMessage`.
 *
 * All mutations use `Atomics`, so increments from concurrent agents never
 * lose updates.
 */
export class SharedCounter {
  /** Int32 view over the backing buffer. */
  readonly #view: Int32Array;

  /** Element index of this counter's slot within {@link #view}. */
  readonly #index: number;

  /** The `SharedArrayBuffer` backing this counter. */
  public readonly buffer: SharedArrayBuffer;

  /**
   * @param buffer - Existing shared buffer to attach to. When omitted, a
   *                 fresh single-slot (`4`-byte) `SharedArrayBuffer` is
   *                 allocated and zero-initialised.
   * @param index  - Element index (in `Int32` units) of the counter slot.
   *                 Defaults to `0`. Must be a non-negative integer that
   *                 fits within `buffer`.
   * @throws If shared memory is unavailable (when allocating), or if
   *         `index` is out of range for the supplied `buffer`.
   */
  public constructor(buffer?: SharedArrayBuffer, index?: number) {
    const slot = index ?? 0;
    if (!Number.isInteger(slot) || slot < 0) {
      throw new Error(
        `SharedCounter: index must be a non-negative integer, received ${slot}`,
      );
    }

    const buf = buffer ?? allocShared(INT32_BYTES);
    if ((slot + 1) * INT32_BYTES > buf.byteLength) {
      throw new Error(
        `SharedCounter: index ${slot} is out of range for a ${buf.byteLength}-byte buffer`,
      );
    }

    this.buffer = buf;
    this.#view = new Int32Array(buf);
    this.#index = slot;
  }

  /**
   * The current counter value, read atomically via `Atomics.load`.
   */
  public get value(): number {
    return Atomics.load(this.#view, this.#index);
  }

  /**
   * Atomically add `n` to the counter.
   *
   * Per `Atomics.add` semantics this returns the **previous** value — the
   * value the slot held *before* `n` was added — not the new total. Read
   * {@link SharedCounter.value} afterwards for the updated total.
   *
   * @param n - Integer addend (may be negative to subtract).
   * @returns The value that was stored before the addition.
   */
  public add(n: number): number {
    return Atomics.add(this.#view, this.#index, n | 0);
  }

  /**
   * Atomically increment the counter by one.
   *
   * As with {@link SharedCounter.add}, the returned number is the
   * **pre-increment** value.
   *
   * @returns The value that was stored before incrementing.
   */
  public increment(): number {
    return Atomics.add(this.#view, this.#index, 1);
  }

  /**
   * Atomically set the counter to `next` iff it currently equals
   * `expected`, via `Atomics.compareExchange`.
   *
   * @param expected - The value the swap is conditional on.
   * @param next     - The value to store when `expected` matches.
   * @returns The value that was at the slot **before** the call. The swap
   *          succeeded iff this equals `expected`.
   */
  public compareExchange(expected: number, next: number): number {
    return Atomics.compareExchange(this.#view, this.#index, expected | 0, next | 0);
  }
}

// ---------------------------------------------------------------------------
// SharedFlag
// ---------------------------------------------------------------------------

/** Slot value meaning "flag is clear / unset". */
const FLAG_UNSET = 0;
/** Slot value meaning "flag is set". */
const FLAG_SET = 1;

/**
 * The result of a blocking {@link SharedFlag.wait}, mirroring the return
 * values of `Atomics.wait`.
 */
export type SharedFlagWaitResult = 'ok' | 'timed-out' | 'not-equal';

/**
 * A one-bit synchronisation gate over a single `Int32Array` slot
 * (`0` = unset, `1` = set), supporting `Atomics.wait` / `Atomics.notify`.
 *
 * Producers call {@link SharedFlag.set} then {@link SharedFlag.notify} to
 * release agents blocked in {@link SharedFlag.wait}.
 *
 * IMPORTANT — `Atomics.wait` may only block on a *non-main* agent. On the
 * main browser thread it throws `TypeError`, and on any main thread it
 * would freeze the event loop. {@link SharedFlag.wait} feature-detects
 * blocking support and, when blocking is not permitted, degrades to a
 * single non-blocking check (returning `'ok'` if already set, otherwise
 * `'not-equal'`) instead of throwing. {@link SharedFlag.notify} is always
 * safe to call from any thread.
 */
export class SharedFlag {
  /** Int32 view over the backing buffer; the flag lives at index 0. */
  readonly #view: Int32Array;

  /** The `SharedArrayBuffer` backing this flag. */
  public readonly buffer: SharedArrayBuffer;

  /**
   * @param buffer - Existing shared buffer to attach to (its first `Int32`
   *                 slot is used). When omitted, a fresh `4`-byte
   *                 `SharedArrayBuffer` is allocated, starting cleared.
   * @throws If shared memory is unavailable when allocating, or `buffer`
   *         is too small to hold one `Int32`.
   */
  public constructor(buffer?: SharedArrayBuffer) {
    const buf = buffer ?? allocShared(INT32_BYTES);
    if (buf.byteLength < INT32_BYTES) {
      throw new Error(
        `SharedFlag: buffer must be at least ${INT32_BYTES} bytes, got ${buf.byteLength}`,
      );
    }
    this.buffer = buf;
    this.#view = new Int32Array(buf);
  }

  /**
   * Atomically set the flag. Does not itself wake waiters — call
   * {@link SharedFlag.notify} afterwards to release any blocked agents.
   */
  public set(): void {
    Atomics.store(this.#view, 0, FLAG_SET);
  }

  /**
   * Atomically clear the flag back to its unset state.
   */
  public clear(): void {
    Atomics.store(this.#view, 0, FLAG_UNSET);
  }

  /**
   * @returns `true` iff the flag is currently set, read via `Atomics.load`.
   */
  public isSet(): boolean {
    return Atomics.load(this.#view, 0) === FLAG_SET;
  }

  /**
   * Block until the flag becomes set, or until `timeoutMs` elapses.
   *
   * Implemented with `Atomics.wait` on the unset value: while the slot
   * still reads `0` (unset) the agent sleeps; a {@link SharedFlag.set} +
   * {@link SharedFlag.notify} from another agent wakes it.
   *
   * Blocking is only legal off the main thread. When `Atomics.wait` is not
   * allowed here (e.g. the main browser thread), this method does **not**
   * throw: it performs a single non-blocking check and returns `'ok'` if
   * the flag is already set, or `'not-equal'` otherwise. Callers that need
   * to truly block must run on a dedicated worker.
   *
   * @param timeoutMs - Optional timeout in milliseconds. Omit (or pass
   *                    `Infinity`) to wait indefinitely.
   * @returns `'ok'` when woken with the flag still unset at entry,
   *          `'timed-out'` if the timeout expired, or `'not-equal'` if the
   *          flag was already set on entry (nothing to wait for).
   */
  public wait(timeoutMs?: number): SharedFlagWaitResult {
    // If already set there is nothing to wait for: `Atomics.wait` would
    // immediately return 'not-equal' because the slot != FLAG_UNSET.
    if (Atomics.load(this.#view, 0) === FLAG_SET) {
      return 'not-equal';
    }

    // `Atomics.wait` only blocks when permitted on this agent. If the engine
    // omits it entirely, degrade to a single non-blocking poll.
    if (typeof Atomics.wait !== 'function') {
      return Atomics.load(this.#view, 0) === FLAG_SET ? 'ok' : 'not-equal';
    }

    try {
      const timeout = timeoutMs ?? Infinity;
      // Throws `TypeError` on a thread where blocking is disallowed (notably
      // the main browser thread); the catch below handles that case.
      return Atomics.wait(this.#view, 0, FLAG_UNSET, timeout);
    } catch {
      // Blocking not permitted here — fall back to a non-blocking observation
      // rather than propagating the TypeError.
      return Atomics.load(this.#view, 0) === FLAG_SET ? 'ok' : 'not-equal';
    }
  }

  /**
   * Wake up to `count` agents blocked in {@link SharedFlag.wait} on this
   * flag, via `Atomics.notify`. Safe to call from any thread.
   *
   * @param count - Maximum number of waiters to wake. Defaults to
   *                `Infinity` (wake all).
   * @returns The number of agents actually woken — `0` when none were
   *          waiting.
   */
  public notify(count?: number): number {
    return Atomics.notify(this.#view, 0, count ?? Infinity);
  }
}

// ---------------------------------------------------------------------------
// SharedRingBuffer
// ---------------------------------------------------------------------------

/**
 * Control-region layout, in `Int32` slots, preceding the data region:
 *
 * - slot 0 (`HEAD_SLOT`): read cursor — byte offset into the data region of
 *   the next frame to be popped by the (single) consumer.
 * - slot 1 (`TAIL_SLOT`): write cursor — byte offset into the data region
 *   at which the next frame will be pushed by the (single) producer.
 *
 * Both cursors range over `[0, dataBytes)` and wrap modulo the data size.
 * The buffer is empty when `head === tail` and considered full when the
 * next write would catch up to `head` (one frame slot is kept free to
 * disambiguate the full/empty states).
 */
const HEAD_SLOT = 0;
const TAIL_SLOT = 1;
/** Number of Int32 control slots ([head, tail]) ahead of the data region. */
const CONTROL_SLOTS = 2;
/** Byte size of the control region. */
const CONTROL_BYTES = CONTROL_SLOTS * INT32_BYTES;
/** Bytes used by each frame's little-endian `uint32` length header. */
const LENGTH_HEADER_BYTES = 4;

/**
 * A lock-free **single-producer / single-consumer** (SPSC) byte ring buffer
 * over a `SharedArrayBuffer`, suitable for streaming chunks between exactly
 * one producing worker and one consuming worker.
 *
 * ## Contract
 *
 * - **SPSC only.** Correctness relies on there being at most one concurrent
 *   {@link SharedRingBuffer.push} caller (the producer) and at most one
 *   concurrent {@link SharedRingBuffer.pop} caller (the consumer). Multiple
 *   producers or multiple consumers are **not** supported and will corrupt
 *   the cursors. (The producer and consumer may be different agents.)
 * - {@link SharedRingBuffer.push} returns `false` (writing nothing) when the
 *   frame would not fit in the currently free space.
 * - {@link SharedRingBuffer.pop} returns `null` when the ring is empty, or
 *   when the next frame is larger than the caller's `maxBytes` budget (the
 *   frame is left intact for a later, larger pop).
 *
 * ## SAB layout
 *
 * `[ head:int32 | tail:int32 | ...dataBytes ]`
 *
 * The `head`/`tail` cursors are published with `Atomics.store` and read with
 * `Atomics.load`, which establishes the happens-before edge that makes the
 * non-atomic byte writes into the data region visible to the consumer. Each
 * frame is encoded as a 4-byte little-endian length header followed by that
 * many payload bytes; both header and payload wrap around the data region.
 */
export class SharedRingBuffer {
  /** Int32 view over the control slots (head/tail). */
  readonly #control: Int32Array;

  /** Byte view over the data region (excludes the control slots). */
  readonly #data: Uint8Array;

  /** Size, in bytes, of the data region. */
  readonly #size: number;

  /** The `SharedArrayBuffer` backing this ring. */
  public readonly buffer: SharedArrayBuffer;

  /**
   * Allocate a new ring whose data region holds `capacityBytes` bytes
   * (the backing `SharedArrayBuffer` is `capacityBytes` + control overhead).
   *
   * @param capacityBytes - Size of the data region in bytes. Must be a
   *                        positive integer.
   * @param existingBuffer - Internal: when supplied, the ring attaches to
   *                        this already-allocated buffer instead of creating
   *                        a fresh one (used by {@link SharedRingBuffer.fromBuffer}).
   *                        Its data region must equal `capacityBytes`.
   * @throws If `capacityBytes` is not a positive integer, or shared memory
   *         is unavailable.
   */
  public constructor(capacityBytes: number, existingBuffer?: SharedArrayBuffer) {
    if (!Number.isInteger(capacityBytes) || capacityBytes <= 0) {
      throw new Error(
        `SharedRingBuffer: capacityBytes must be a positive integer, received ${capacityBytes}`,
      );
    }
    const buf = existingBuffer ?? allocShared(CONTROL_BYTES + capacityBytes);
    this.buffer = buf;
    this.#control = new Int32Array(buf, 0, CONTROL_SLOTS);
    this.#data = new Uint8Array(buf, CONTROL_BYTES, capacityBytes);
    this.#size = capacityBytes;
  }

  /**
   * Attach a second `SharedRingBuffer` view to an existing buffer — e.g.
   * the consumer side wrapping a buffer received from the producer via
   * `postMessage`. No cursors are reset; the view observes whatever the
   * other side has already published.
   *
   * @param buffer - A `SharedArrayBuffer` previously created by a
   *                 `SharedRingBuffer` constructor.
   * @returns A `SharedRingBuffer` sharing `buffer`'s cursors and data.
   * @throws If `buffer` is too small to contain the control region.
   */
  public static fromBuffer(buffer: SharedArrayBuffer): SharedRingBuffer {
    if (buffer.byteLength <= CONTROL_BYTES) {
      throw new Error(
        `SharedRingBuffer.fromBuffer: buffer too small (${buffer.byteLength} bytes)`,
      );
    }
    const dataBytes = buffer.byteLength - CONTROL_BYTES;
    return new SharedRingBuffer(dataBytes, buffer);
  }

  /** @internal Free bytes available for a new frame's payload + header. */
  #freeBytes(head: number, tail: number): number {
    // One byte kept free to distinguish full from empty.
    if (tail >= head) {
      return this.#size - (tail - head) - 1;
    }
    return head - tail - 1;
  }

  /**
   * Push a single byte frame onto the ring (producer side).
   *
   * The frame is stored as a length-prefixed record. Returns `false`
   * without modifying the ring if there is not enough free space for the
   * header plus payload.
   *
   * @param bytes - Payload to enqueue (may be empty).
   * @returns `true` if enqueued, `false` if the ring was too full.
   */
  public push(bytes: Uint8Array): boolean {
    const head = Atomics.load(this.#control, HEAD_SLOT);
    const tail = Atomics.load(this.#control, TAIL_SLOT);

    const needed = LENGTH_HEADER_BYTES + bytes.length;
    if (needed > this.#freeBytes(head, tail)) {
      return false;
    }

    // Write the 4-byte little-endian length header, wrapping as needed.
    let cursor = tail;
    const len = bytes.length;
    cursor = this.#writeByte(cursor, len & 0xff);
    cursor = this.#writeByte(cursor, (len >>> 8) & 0xff);
    cursor = this.#writeByte(cursor, (len >>> 16) & 0xff);
    cursor = this.#writeByte(cursor, (len >>> 24) & 0xff);

    // Write the payload bytes, wrapping as needed. `bytes[i]` is always
    // in range for `i < len`; the `?? 0` only satisfies
    // noUncheckedIndexedAccess and is never actually reached.
    for (let i = 0; i < len; i += 1) {
      cursor = this.#writeByte(cursor, bytes[i] ?? 0);
    }

    // Publish the new tail. The release store pairs with the consumer's
    // acquire load of TAIL_SLOT, making the byte writes above visible.
    Atomics.store(this.#control, TAIL_SLOT, cursor);
    return true;
  }

  /**
   * Pop the next byte frame from the ring (consumer side).
   *
   * @param maxBytes - Maximum payload size the caller is willing to receive.
   *                   If the next frame's payload exceeds this, the frame is
   *                   left in place and `null` is returned.
   * @returns The dequeued payload as a fresh `Uint8Array`, or `null` when
   *          the ring is empty or the next frame exceeds `maxBytes`.
   */
  public pop(maxBytes: number): Uint8Array | null {
    const head = Atomics.load(this.#control, HEAD_SLOT);
    const tail = Atomics.load(this.#control, TAIL_SLOT);

    if (head === tail) {
      return null; // empty
    }

    // Read the 4-byte little-endian length header (each read is in range;
    // `#readByte` returns 0 for the impossible out-of-range case).
    let cursor = head;
    const b0 = this.#readByte(cursor);
    cursor = (cursor + 1) % this.#size;
    const b1 = this.#readByte(cursor);
    cursor = (cursor + 1) % this.#size;
    const b2 = this.#readByte(cursor);
    cursor = (cursor + 1) % this.#size;
    const b3 = this.#readByte(cursor);
    cursor = (cursor + 1) % this.#size;
    const len = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;

    if (len > maxBytes) {
      // Caller's budget is too small; leave the frame intact.
      return null;
    }

    const out = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      out[i] = this.#readByte(cursor);
      cursor = (cursor + 1) % this.#size;
    }

    // Publish the advanced head, freeing the consumed space for the producer.
    Atomics.store(this.#control, HEAD_SLOT, cursor);
    return out;
  }

  /**
   * Write one byte at `cursor` (already within `[0, size)`) and return the
   * next cursor position, wrapping around the data region.
   */
  #writeByte(cursor: number, value: number): number {
    this.#data[cursor] = value;
    return (cursor + 1) % this.#size;
  }

  /**
   * Read one byte at `cursor` (already within `[0, size)`). The `?? 0` only
   * satisfies `noUncheckedIndexedAccess`; `cursor` is always in range.
   */
  #readByte(cursor: number): number {
    return this.#data[cursor] ?? 0;
  }
}

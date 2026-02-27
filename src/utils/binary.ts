/**
 * @module utils/binary
 *
 * Low-level Uint8Array helpers and DataView wrappers.
 *
 * **No Buffer.**  Every function operates exclusively on `Uint8Array`
 * and `DataView` so the code works identically in Node, Deno, Bun,
 * Cloudflare Workers, and browsers.
 */

// ---------------------------------------------------------------------------
// Shared codec instances (lazily created once)
// ---------------------------------------------------------------------------

let _encoder: TextEncoder | undefined;
let _decoder: TextDecoder | undefined;

function encoder(): TextEncoder {
  return (_encoder ??= new TextEncoder());
}

function decoder(): TextDecoder {
  return (_decoder ??= new TextDecoder());
}

// ---------------------------------------------------------------------------
// Concatenation
// ---------------------------------------------------------------------------

/**
 * Concatenate one or more `Uint8Array` buffers into a single contiguous
 * array.
 *
 * @param arrays  The arrays to concatenate (in order).
 * @returns       A new `Uint8Array` containing all bytes.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  if (arrays.length === 0) return new Uint8Array(0);
  if (arrays.length === 1) return arrays[0]!;

  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Big-endian write helpers
// ---------------------------------------------------------------------------

/**
 * Write a 32-bit unsigned integer in big-endian byte order.
 *
 * @param value  An integer in the range `[0, 0xFFFFFFFF]`.
 * @returns      A 4-byte `Uint8Array`.
 */
export function writeUint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint32(0, value, false);
  return buf;
}

/**
 * Write a 16-bit unsigned integer in big-endian byte order.
 *
 * @param value  An integer in the range `[0, 0xFFFF]`.
 * @returns      A 2-byte `Uint8Array`.
 */
export function writeUint16BE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint16(0, value, false);
  return buf;
}

// ---------------------------------------------------------------------------
// Big-endian read helpers
// ---------------------------------------------------------------------------

/**
 * Read a 32-bit unsigned integer in big-endian byte order.
 *
 * @param data    Source buffer.
 * @param offset  Byte offset to start reading from.
 */
export function readUint32BE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(offset, false);
}

/**
 * Read a 16-bit unsigned integer in big-endian byte order.
 *
 * @param data    Source buffer.
 * @param offset  Byte offset to start reading from.
 */
export function readUint16BE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint16(offset, false);
}

/**
 * Read a 16-bit **signed** integer in big-endian byte order.
 *
 * @param data    Source buffer.
 * @param offset  Byte offset to start reading from.
 */
export function readInt16BE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getInt16(offset, false);
}

// ---------------------------------------------------------------------------
// Text <-> bytes
// ---------------------------------------------------------------------------

/**
 * Convert a JavaScript string to UTF-8 bytes.
 *
 * @param text  The string to encode.
 */
export function textToBytes(text: string): Uint8Array {
  return encoder().encode(text);
}

/**
 * Decode a UTF-8 `Uint8Array` back to a JavaScript string.
 *
 * @param data  The bytes to decode.
 */
export function bytesToText(data: Uint8Array): string {
  return decoder().decode(data);
}

// ---------------------------------------------------------------------------
// Hex conversions (native Uint8Array.toHex / fromHex)
// ---------------------------------------------------------------------------

/**
 * Convert bytes to a lowercase hexadecimal string.
 *
 * @param data  Source bytes.
 * @returns     Hex string (e.g. `"48656c6c6f"`).
 */
export function bytesToHex(data: Uint8Array): string {
  return data.toHex();
}

/**
 * Parse a hexadecimal string into bytes.
 *
 * The input must have an even number of hex characters (0-9, a-f,
 * A-F).  Whitespace is **not** stripped.
 *
 * @param hex  Hex string.
 * @returns    Decoded bytes.
 * @throws     If the string length is odd or contains non-hex chars.
 */
export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.fromHex(hex);
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

/**
 * Compare two `Uint8Array`s for byte-level equality.
 *
 * @param a  First buffer.
 * @param b  Second buffer.
 * @returns  `true` if `a` and `b` have the same length and identical
 *           byte values.
 */
export function areEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GrowableBuffer
// ---------------------------------------------------------------------------

/** Default initial capacity in bytes. */
const DEFAULT_INITIAL_CAPACITY = 1024;

/**
 * A growable byte buffer backed by a single `Uint8Array` that doubles
 * in capacity when needed.
 *
 * This is the hot-path allocation helper used by the PDF serializer.
 *
 * ```ts
 * const buf = createGrowableBuffer(4096);
 * buf.writeString('%PDF-1.7\n');
 * buf.write(someBytes);
 * const result = buf.toUint8Array();
 * ```
 */
export class GrowableBuffer {
  private _buf: Uint8Array;
  private _length = 0;

  /**
   * @param initialCapacity  Starting capacity in bytes (default:
   *                         `1024`).
   */
  constructor(initialCapacity: number = DEFAULT_INITIAL_CAPACITY) {
    this._buf = new Uint8Array(Math.max(1, initialCapacity));
  }

  /** Number of bytes currently written. */
  get length(): number {
    return this._length;
  }

  /** Current allocated capacity. */
  get capacity(): number {
    return this._buf.length;
  }

  /**
   * Ensure the buffer has room for at least `additionalBytes` more
   * bytes, growing geometrically if necessary.
   */
  private ensureCapacity(additionalBytes: number): void {
    const required = this._length + additionalBytes;
    if (required <= this._buf.length) return;

    let newCapacity = this._buf.length;
    while (newCapacity < required) {
      newCapacity *= 2;
    }
    const newBuf = new Uint8Array(newCapacity);
    newBuf.set(this._buf.subarray(0, this._length));
    this._buf = newBuf;
  }

  /**
   * Append raw bytes.
   *
   * @param data  The bytes to append.
   */
  write(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    this._buf.set(data, this._length);
    this._length += data.length;
  }

  /**
   * Append a single byte.
   *
   * @param b  Byte value `[0, 255]`.
   */
  writeByte(b: number): void {
    this.ensureCapacity(1);
    this._buf[this._length++] = b;
  }

  /**
   * Encode a string as UTF-8 and append the resulting bytes.
   *
   * @param s  The string to encode and append.
   */
  writeString(s: string): void {
    const bytes = encoder().encode(s);
    this.write(bytes);
  }

  /**
   * Return the written portion as a new contiguous `Uint8Array`.
   *
   * The returned array is a **copy**; further writes do not affect it.
   */
  toUint8Array(): Uint8Array {
    return this._buf.slice(0, this._length);
  }

  /**
   * Reset the write position to zero without de-allocating.
   *
   * The existing capacity is retained for reuse.
   */
  reset(): void {
    this._length = 0;
  }
}

/**
 * Factory function that creates a {@link GrowableBuffer}.
 *
 * @param initial  Optional initial capacity in bytes.
 */
export function createGrowableBuffer(initial?: number): GrowableBuffer {
  return new GrowableBuffer(initial);
}

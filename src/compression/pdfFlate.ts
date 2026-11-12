/**
 * @module compression/pdfFlate
 *
 * The FlateDecode codec: one place that writes and reads the data a PDF
 * stream carries under `/FlateDecode`.
 *
 * ISO 32000 defines `/FlateDecode` data as zlib (RFC 1950): a two-byte
 * header, a DEFLATE (RFC 1951) payload and a big-endian Adler-32 trailer.
 *
 * - {@link flateEncode} writes zlib data with fflate's `zlibSync`.
 * - {@link inflateFlate} reads zlib data and, as a fallback, raw DEFLATE
 *   data without the wrapper, which modern-pdf-lib 0.40.6 and earlier
 *   wrote under `/FlateDecode`. It never reads gzip.
 * - {@link inflateRaw} reads raw DEFLATE data only.
 * - {@link inflateRawBounded} reads raw DEFLATE data step by step and
 *   stops once the decoded size passes a given bound, or once 128 KiB of
 *   input in a row decode to no bytes.
 * - {@link isZlibHeader} is the RFC 1950 header test both halves share.
 * - {@link wrapRawDeflate} turns the output of a raw DEFLATE engine into
 *   zlib data.
 *
 * This module is internal: no package entry exports it.
 *
 * @packageDocumentation
 */

import { Inflate, inflateSync, zlibSync } from 'fflate';

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/** A compression level fflate accepts and this codec writes (1-9). */
export type FlateLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Round a compression level and clamp it to 1-9.
 *
 * Level 0 (stored blocks, no compression) is excluded: a caller that
 * wants no compression writes the stream without a filter.
 *
 * @param level - Requested level.
 * @returns       The level rounded to an integer in the range [1, 9].
 */
export function clampFlateLevel(level: number): FlateLevel {
  return Math.max(1, Math.min(9, Math.round(level))) as FlateLevel;
}

// ---------------------------------------------------------------------------
// RFC 1950 helpers
// ---------------------------------------------------------------------------

/** Largest number of bytes the Adler-32 sums can take before `b` must be reduced. */
const ADLER_NMAX = 5552;

/** The Adler-32 modulus (largest prime below 2^16). */
const ADLER_BASE = 65521;

/**
 * Compute the Adler-32 checksum of `data` (RFC 1950, section 8.2).
 *
 * @param data - The uncompressed bytes.
 * @returns      The checksum as an unsigned 32-bit integer (1 for empty input).
 */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  let i = 0;
  const length = data.length;
  while (i < length) {
    const end = Math.min(i + ADLER_NMAX, length);
    for (; i < end; i++) {
      a += data[i] ?? 0;
      b += a;
    }
    a %= ADLER_BASE;
    b %= ADLER_BASE;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Test whether `data` starts with a zlib header (RFC 1950, section 2.2).
 *
 * True when the first two bytes say: compression method 8 (DEFLATE), a
 * window size (CINFO) of at most 7, a check value (FCHECK) that makes
 * `CMF * 256 + FLG` a multiple of 31, and no preset dictionary (FDICT
 * clear). PDF never uses a preset dictionary, so a set FDICT bit makes the
 * header invalid here.
 *
 * @param data - The stream data, or at least its first two bytes.
 * @returns      `true` if the first two bytes form such a header.
 */
export function isZlibHeader(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  const cmf = data[0] ?? 0;
  const flg = data[1] ?? 0;
  return (cmf & 0x0f) === 8 && cmf >> 4 <= 7 && ((cmf << 8) | flg) % 31 === 0 && (flg & 0x20) === 0;
}

/**
 * Wrap raw DEFLATE data (RFC 1951) as zlib data (RFC 1950).
 *
 * The result is the header `78 9c`, the DEFLATE payload unchanged, and the
 * big-endian Adler-32 of `plain`. The header's FLEVEL field is only
 * informational; `78 9c` is the header fflate writes at levels 6-8.
 *
 * @param raw   - Raw DEFLATE data whose decompressed content is `plain`.
 * @param plain - The uncompressed bytes, for the Adler-32 trailer.
 * @returns       Zlib data that holds the same DEFLATE payload.
 */
export function wrapRawDeflate(raw: Uint8Array, plain: Uint8Array): Uint8Array {
  const out = new Uint8Array(raw.length + 6);
  out[0] = 0x78;
  out[1] = 0x9c;
  out.set(raw, 2);
  new DataView(out.buffer).setUint32(raw.length + 2, adler32(plain), false);
  return out;
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * Compress `data` as zlib data (RFC 1950), the format `/FlateDecode` requires.
 *
 * @param data  - The uncompressed bytes.
 * @param level - Compression level, rounded and clamped to 1-9. Default: `6`.
 * @returns       Zlib data: header, DEFLATE payload and Adler-32 trailer.
 */
export function flateEncode(data: Uint8Array, level: number = 6): Uint8Array {
  return zlibSync(data, { level: clampFlateLevel(level) });
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/** The message every Flate read failure carries. */
const FLATE_FAILURE = 'FlateDecode: failed to decompress data';

/**
 * Decompress `/FlateDecode` data.
 *
 * When the data starts with a zlib header ({@link isZlibHeader}), the
 * DEFLATE payload after the header is inflated. The Adler-32 trailer is
 * not checked, so zlib data whose trailer is missing, cut short or wrong
 * decompresses, and bytes after the final DEFLATE block are ignored.
 *
 * Data without a zlib header, or whose payload does not inflate, is read
 * once more as raw DEFLATE: modern-pdf-lib 0.40.6 and earlier wrote raw
 * DEFLATE under `/FlateDecode`, and those files keep loading.
 *
 * Raw DEFLATE whose first two bytes also form a valid zlib header is read
 * as zlib data. That happens only when its first block is a stored block
 * with non-zero padding bits, which DEFLATE encoders do not write.
 *
 * Gzip data is never accepted. Empty input gives empty output.
 *
 * @param data - The stream data.
 * @returns      The decompressed bytes.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   inflates neither as zlib nor as raw DEFLATE.
 */
export function inflateFlate(data: Uint8Array): Uint8Array {
  if (isZlibHeader(data)) {
    try {
      return inflateSync(data.subarray(2));
    } catch {
      // Not a valid zlib payload: read it as raw DEFLATE below.
    }
  }
  try {
    return inflateSync(data);
  } catch {
    throw new Error(FLATE_FAILURE);
  }
}

/**
 * Inflate raw DEFLATE data (RFC 1951) only; data with a zlib wrapper is not read as zlib.
 *
 * @param data - Raw DEFLATE data.
 * @returns The decoded bytes.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data is not raw DEFLATE.
 */
export function inflateRaw(data: Uint8Array): Uint8Array {
  try {
    return inflateSync(data);
  } catch {
    throw new Error(FLATE_FAILURE);
  }
}

/** Input bytes {@link inflateRawBounded} hands to the inflater per step. */
const INFLATE_STEP = 16 * 1024;

/** Input steps in a row that may decode to no bytes before {@link inflateRawBounded} stops reading. */
const INFLATE_IDLE_STEPS = 8;

/**
 * Inflate raw DEFLATE data (RFC 1951) step by step, up to a decoded size.
 *
 * The input goes to fflate's streaming `Inflate` in steps of 16 KiB. After
 * each step the decoded size is checked: once it is larger than `maxSize`,
 * no further input is read and the result is `undefined`. The decoded
 * chunks kept therefore never exceed `maxSize` bytes plus the output of
 * one step; when the whole input is read, they are joined into the result.
 *
 * When 8 steps in a row (128 KiB of input) decode to no bytes before the
 * end of the input, no further input is read: the input read so far is
 * inflated whole with `inflateSync`, which ignores bytes after the final
 * DEFLATE block, and the result is `undefined` when that input does not
 * end with the final block. Empty input gives empty output.
 *
 * @param data    - Raw DEFLATE data, without a zlib header.
 * @param maxSize - The largest decoded size returned.
 * @returns         The decoded bytes, or `undefined` when they are more
 *   than `maxSize`, or when the input read does not end with the final
 *   block after 8 steps that decode to no bytes.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   is not raw DEFLATE or ends before its final block, unless the decoded
 *   size passes `maxSize` first or 8 steps in a row decode to no bytes
 *   before the end of the input.
 */
export function inflateRawBounded(data: Uint8Array, maxSize: number): Uint8Array | undefined {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const inflater = new Inflate((chunk) => {
    size += chunk.length;
    chunks.push(chunk);
  });
  try {
    let at = 0;
    let idleSteps = 0;
    do {
      const end = Math.min(at + INFLATE_STEP, data.length);
      const before = size;
      inflater.push(data.subarray(at, end), end === data.length);
      if (size > maxSize) return undefined;
      at = end;
      idleSteps = size === before ? idleSteps + 1 : 0;
      if (idleSteps === INFLATE_IDLE_STEPS && at < data.length) {
        // The rest of the input is not read: the data read so far must end with the final block
        try {
          const read = inflateSync(data.subarray(0, at));
          return read.length > maxSize ? undefined : read;
        } catch {
          return undefined;
        }
      }
    } while (at < data.length);
  } catch {
    throw new Error(FLATE_FAILURE);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

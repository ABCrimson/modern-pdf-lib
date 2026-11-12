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
 *
 *   Both throw `ResourceLimitError` (`maxDecodedStreamBytes`, 256 MiB) once
 *   the output is larger than that, reading no further input.
 * - {@link inflateFlateUpTo} reads as {@link inflateFlate} does but keeps at
 *   most a size the caller chooses, and says whether the data held more.
 * - {@link inflateRawBounded} reads raw DEFLATE data step by step and
 *   stops once the decoded size passes a given bound, or once 128 KiB of
 *   input in a row decode to no bytes.
 *
 * All four read through one loop that hands fflate's `Inflate` steps of
 * 16 KiB of input and uses its public API only.
 * - {@link isZlibHeader} is the RFC 1950 header test both halves share.
 * - {@link wrapRawDeflate} turns the output of a raw DEFLATE engine into
 *   zlib data.
 *
 * This module is internal: no package entry exports it.
 *
 * @packageDocumentation
 */

import { Inflate, zlibSync } from 'fflate';
import { INTERNAL_LIMITS, assertWithinLimit } from '../core/limits.js';

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

/** Input bytes {@link inflateSteps} hands to the inflater per step; one step decodes to at most about 1032 times its size. */
const INFLATE_STEP = 16 * 1024;

/** Input steps in a row that may decode to no bytes before {@link inflateSteps} stops reading. */
const INFLATE_IDLE_STEPS = 8;

/** What {@link inflateSteps} decoded. */
interface StepRead {
  /** The decoded chunks, in order. */
  readonly chunks: readonly Uint8Array[];
  /** The decoded bytes the chunks hold in all. */
  readonly size: number;
  /** `true` when `size` is larger than the bound and reading stopped for that reason. */
  readonly over: boolean;
}

/**
 * Inflate raw DEFLATE data (RFC 1951) in steps of 16 KiB of input: the one
 * loop every read in this module goes through.
 *
 * The input goes to fflate's streaming `Inflate` through its public `push`
 * method. After each step the decoded size is checked: once it is larger
 * than `bound`, no further input is read and the result is flagged `over`.
 * The chunks kept therefore never exceed `bound` bytes plus the output of
 * one step.
 *
 * Bytes after the final DEFLATE block decode to nothing, and the inflater
 * does not say it has reached the final block. The loop therefore stops on
 * an idle-step rule: when 8 steps in a row (128 KiB of input) decode to no
 * bytes before the end of the input, the rest of the input is not read: one more
 * byte is read as the end of the input; the read is refused unless the data
 * has reached its final block, and the result is `undefined` then. The
 * decoded chunks are not decoded a second time. Empty input gives empty
 * output.
 *
 * @param data  - Raw DEFLATE data, without a zlib header.
 * @param bound - The decoded size after which no further input is read.
 * @returns       The chunks read, or `undefined` when 8 steps in a row
 *   decoded to no bytes before the end of the input and the data has not
 *   reached its final block.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data is
 *   not raw DEFLATE or ends before its final block, unless the decoded size
 *   passes `bound` first or the idle rule ends the read first.
 */
function inflateSteps(data: Uint8Array, bound: number): StepRead | undefined {
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
      if (size > bound) return { chunks, size, over: true };
      at = end;
      idleSteps = size === before ? idleSteps + 1 : 0;
      if (idleSteps === INFLATE_IDLE_STEPS && at < data.length) {
        // The rest of the input is not read. One more byte ends the input: an inflater past its
        // final block ignores it, and one that is not throws on the cut-short input.
        try {
          inflater.push(data.subarray(at, at + 1), true);
        } catch {
          return undefined;
        }
        return { chunks, size, over: size > bound };
      }
    } while (at < data.length);
  } catch {
    throw new Error(FLATE_FAILURE);
  }
  return { chunks, size, over: false };
}

/**
 * Inflate `/FlateDecode` data through {@link inflateSteps}: the payload
 * after a zlib header ({@link isZlibHeader}) first, and, when that does
 * not inflate, the data as raw DEFLATE. A payload that decodes to more than
 * `bound` bytes is returned at once, flagged `over`, and is not read again
 * as raw DEFLATE.
 *
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   inflates neither as zlib nor as raw DEFLATE.
 */
function inflateZlibOrRaw(data: Uint8Array, bound: number): StepRead {
  if (isZlibHeader(data)) {
    try {
      const read = inflateSteps(data.subarray(2), bound);
      if (read !== undefined) return read;
    } catch {
      // Not a valid zlib payload: read it as raw DEFLATE below.
    }
  }
  const read = inflateSteps(data, bound);
  if (read === undefined) throw new Error(FLATE_FAILURE);
  return read;
}

/**
 * Join the chunks of a read into one array of `take` bytes, the first
 * `take` bytes of the chunks in order.
 */
function joinChunks(chunks: readonly Uint8Array[], take: number): Uint8Array {
  const [only] = chunks;
  if (chunks.length === 1 && only !== undefined && only.length === take) return only;
  const out = new Uint8Array(take);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= take) break;
    const part = offset + chunk.length > take ? chunk.subarray(0, take - offset) : chunk;
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** The read joined into the result, or the limit error when it went over `maxDecodedStreamBytes`. */
function finishWithinLimit(read: StepRead): Uint8Array {
  if (read.over) assertWithinLimit('maxDecodedStreamBytes', read.size);
  return joinChunks(read.chunks, read.size);
}

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
 * DEFLATE under `/FlateDecode`, and those files keep loading. A payload
 * that decodes to more than the `maxDecodedStreamBytes` limit is refused at
 * once and is not read again as raw DEFLATE.
 *
 * Raw DEFLATE whose first two bytes also form a valid zlib header is read
 * as zlib data. That happens only when its first block is a stored block
 * with non-zero padding bits, which DEFLATE encoders do not write.
 *
 * The input is read in steps of 16 KiB. When 8 steps in a row (128 KiB)
 * decode to no bytes before the end of the input, the rest of the input is not read: one more byte is read as the end of the input, and that read is refused unless the data has reached its final DEFLATE block. A refused zlib read is read once more as raw DEFLATE, as above.
 *
 * Gzip data is never accepted. Empty input gives empty output.
 *
 * @param data - The stream data.
 * @returns      The decompressed bytes.
 * @throws {ResourceLimitError} `maxDecodedStreamBytes` (256 MiB) when the
 *   output is larger than that; no more input is read once it is.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   inflates neither as zlib nor as raw DEFLATE.
 */
export function inflateFlate(data: Uint8Array): Uint8Array {
  return finishWithinLimit(inflateZlibOrRaw(data, INTERNAL_LIMITS.maxDecodedStreamBytes));
}

/**
 * Inflate raw DEFLATE data (RFC 1951) only; data with a zlib wrapper is not
 * read as zlib. Bytes after the final block are ignored, and the input is
 * read as {@link inflateFlate} reads it.
 *
 * @param data - Raw DEFLATE data.
 * @returns The decoded bytes.
 * @throws {ResourceLimitError} `maxDecodedStreamBytes` (256 MiB) when the
 *   output is larger than that; no more input is read once it is.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data is
 *   not raw DEFLATE or ends before its final block.
 */
export function inflateRaw(data: Uint8Array): Uint8Array {
  const read = inflateSteps(data, INTERNAL_LIMITS.maxDecodedStreamBytes);
  if (read === undefined) throw new Error(FLATE_FAILURE);
  return finishWithinLimit(read);
}

/** The result of {@link inflateFlateUpTo}. */
export interface InflatedPrefix {
  /** The decoded bytes: all of them, or the first `maxBytes` when `truncated`. */
  readonly data: Uint8Array;
  /** `true` when the data decodes to more than `maxBytes` bytes and the rest was not kept. */
  readonly truncated: boolean;
}

/**
 * Decompress `/FlateDecode` data, keeping at most `maxBytes` decoded bytes.
 *
 * The data is read as {@link inflateFlate} reads it: zlib data, or raw
 * DEFLATE as a fallback, the Adler-32 trailer unchecked, bytes after the
 * final block ignored. A size the data states itself (the implied size of a
 * PNG image, the original length of a WOFF table) is not an internal limit;
 * a caller that knows such a size reads that many bytes and learns whether
 * there were more. Once a step of the read has decoded more than
 * `maxBytes` bytes, no further input is read, the first `maxBytes` bytes
 * are returned and `truncated` is `true`. The output held never exceeds
 * `maxBytes` plus the output of one 16 KiB step of input.
 *
 * @param data     - The stream data.
 * @param maxBytes - The most decoded bytes to return; at most
 *   `maxDecodedStreamBytes` (256 MiB). A fraction is rounded down.
 * @returns          The decoded bytes and whether the data held more.
 * @throws {ResourceLimitError} `maxDecodedStreamBytes` when `maxBytes` is
 *   above 256 MiB or is not a finite number.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   inflates neither as zlib nor as raw DEFLATE, or ends before its final
 *   block while the decoded size is at most `maxBytes`.
 */
export function inflateFlateUpTo(data: Uint8Array, maxBytes: number): InflatedPrefix {
  assertWithinLimit('maxDecodedStreamBytes', maxBytes);
  const bound = Math.max(0, Math.floor(maxBytes));
  const read = inflateZlibOrRaw(data, bound);
  return { data: joinChunks(read.chunks, Math.min(read.size, bound)), truncated: read.over };
}

/**
 * Inflate raw DEFLATE data (RFC 1951) step by step, up to a decoded size.
 *
 * The input goes to the inflater in steps of 16 KiB. After each step the
 * decoded size is checked: once it is larger than `maxSize`, no further
 * input is read and the result is `undefined`. The decoded chunks kept
 * therefore never exceed `maxSize` bytes plus the output of one step; when
 * the whole input is read, they are joined into the result.
 *
 * When 8 steps in a row (128 KiB of input) decode to no bytes before the
 * end of the input, the rest of the input is not read: one more byte is read as the
 * end of the input, and the read is refused unless the data has reached its
 * final block. Empty input gives empty output.
 *
 * @param data    - Raw DEFLATE data, without a zlib header.
 * @param maxSize - The largest decoded size returned.
 * @returns         The decoded bytes, or `undefined` when they are more
 *   than `maxSize`, or when the data has not reached its final block after
 *   8 steps that decode to no bytes.
 * @throws {Error} `FlateDecode: failed to decompress data` when the data
 *   is not raw DEFLATE or ends before its final block, unless the decoded
 *   size passes `maxSize` first or 8 steps in a row decode to no bytes
 *   before the end of the input.
 */
export function inflateRawBounded(data: Uint8Array, maxSize: number): Uint8Array | undefined {
  const read = inflateSteps(data, maxSize);
  if (read === undefined || read.over) return undefined;
  return joinChunks(read.chunks, read.size);
}

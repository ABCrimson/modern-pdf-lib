/**
 * @module core/flateStream
 *
 * The `/FlateDecode` stream handling shared by the PDF writers
 * (`PdfWriter` for `save()`, `PdfStreamWriter` for `saveAsStream()`,
 * and the incremental writer), so every writer emits the
 * same bytes for the same stream.
 *
 * - {@link compressPdfStream} compresses an unfiltered stream as zlib data
 *   (RFC 1950), the format ISO 32000 defines for `/FlateDecode`.
 * - {@link rewrapLegacyStream} writes a loaded `/FlateDecode` stream that
 *   holds raw DEFLATE data (as modern-pdf-lib 0.40.6 and earlier wrote it)
 *   back as zlib data: the data is inflated and compressed again at level 6,
 *   so the decoded bytes do not change. A stream whose decoded data is
 *   larger than {@link INTERNAL_LIMITS}.maxRewrapDecodedBytes (64 MiB) is copied
 *   as loaded.
 * - A document loaded from a file whose trailer has `/Encrypt` is never
 *   re-wrapped: its stream data can still be encrypted, and encrypted data
 *   can inflate as raw DEFLATE by chance. The loader records such a
 *   document's registry with {@link markLoadedFromEncryptedFile}, and the
 *   writers skip {@link rewrapLegacyStream} when
 *   {@link isLoadedFromEncryptedFile} says so. A document that was created,
 *   or loaded from a file without `/Encrypt`, is re-wrapped as usual, also
 *   when `encrypt()` is called on it.
 *
 * @packageDocumentation
 */

import {
  flateEncode,
  inflateRawBounded,
  isZlibHeader,
  wrapRawDeflate,
} from '../compression/pdfFlate.js';
import {
  isAvailable as isWasmDeflateAvailable,
  deflateSync as wasmDeflateSync,
} from '../compression/libdeflateWasm.js';
import { INTERNAL_LIMITS } from './limits.js';
import { PdfName } from './pdfObjects.js';
import type { PdfObjectRegistry, PdfStream } from './pdfObjects.js';

/** Registries of documents loaded from a file whose trailer has `/Encrypt`. */
const encryptedSources = new WeakSet<PdfObjectRegistry>();

/**
 * Record that a registry holds the objects of a file whose trailer has
 * `/Encrypt`, whether or not the loader decrypted them. The writers then
 * do not re-wrap its `/FlateDecode` stream data (see
 * {@link rewrapLegacyStream}).
 *
 * @param registry - The registry the loader filled.
 */
export function markLoadedFromEncryptedFile(registry: PdfObjectRegistry): void {
  encryptedSources.add(registry);
}

/**
 * True when the registry was recorded with
 * {@link markLoadedFromEncryptedFile}.
 *
 * @param registry - The registry a writer serializes from.
 */
export function isLoadedFromEncryptedFile(registry: PdfObjectRegistry): boolean {
  return encryptedSources.has(registry);
}

/**
 * Compress a stream's data with FlateDecode if it has no filter yet.
 *
 * A stream that already has a `/Filter` entry, or holds no data, is left
 * as it is. Otherwise the data is compressed as zlib data: with fflate, or,
 * when `useWasm` is set and the WASM deflate module has been initialized,
 * with that module's raw DEFLATE output wrapped as zlib. The compressed
 * bytes (zlib header and Adler-32 trailer included) replace the data, with
 * `/Filter /FlateDecode` and an updated `/Length`, only when they are
 * shorter than the data; otherwise the stream stays unfiltered.
 *
 * @param stream  - The stream to compress in place.
 * @param level   - Compression level, rounded and clamped to 1-9.
 * @param useWasm - Use the WASM deflate module when it is initialized.
 */
export function compressPdfStream(stream: PdfStream, level: number, useWasm = false): void {
  if (stream.dict.has('/Filter')) return;
  if (stream.data.length === 0) return;

  const encoded =
    useWasm && isWasmDeflateAvailable()
      ? wrapRawDeflate(wasmDeflateSync(stream.data, level), stream.data)
      : flateEncode(stream.data, level);

  if (encoded.length < stream.data.length) {
    stream.dict.set('/Filter', PdfName.of('FlateDecode'));
    stream.data = encoded;
    stream.syncLength();
  }
}

/** True when the stream's first decode filter is `/FlateDecode`. */
function firstFilterIsFlate(stream: PdfStream): boolean {
  const filter = stream.dict.get('/Filter');
  const first = filter?.kind === 'array' ? filter.items[0] : filter;
  return first?.kind === 'name' && first.value === '/FlateDecode';
}

/**
 * Write a raw DEFLATE `/FlateDecode` stream back as zlib data.
 *
 * Applies when the stream's `/Filter` is `/FlateDecode`, or an array whose
 * first entry is `/FlateDecode`, and its data does not start with a zlib
 * header. Such data is inflated as raw DEFLATE, step by step
 * (`inflateRawBounded`); when that succeeds with at most
 * {@link INTERNAL_LIMITS}.maxRewrapDecodedBytes (64 MiB) decoded bytes, they
 * are compressed again as zlib data at level 6 and replace the data, and
 * `/Length` is updated.
 * Bytes after the final DEFLATE block (such as an end-of-line counted in
 * `/Length`) are not carried over. `/DecodeParms` stays as it is, since the
 * decoded bytes do not change.
 *
 * Data that starts with a zlib header is taken as zlib data and left
 * alone: raw DEFLATE can start with such a header only when its first
 * block is a stored block whose padding bits are not zero, which DEFLATE
 * encoders do not write. Data that does not inflate as raw DEFLATE, and
 * data that decodes to more than {@link INTERNAL_LIMITS}.maxRewrapDecodedBytes
 * bytes, and data in which 128 KiB of input in a row before its final block
 * decode to no bytes, is left alone too (inflating stops once the decoded
 * size passes it), and no error is thrown.
 *
 * The writers never call this for a document loaded from a file whose
 * trailer has `/Encrypt` ({@link isLoadedFromEncryptedFile}): the stream
 * data of such a document can still be encrypted, and encrypted data can
 * inflate as raw DEFLATE by chance, which would replace it for good.
 *
 * @param stream - The stream to update in place.
 */
export function rewrapLegacyStream(stream: PdfStream): void {
  if (stream.data.length === 0 || !firstFilterIsFlate(stream)) return;
  if (isZlibHeader(stream.data)) return;

  let plain: Uint8Array | undefined;
  try {
    plain = inflateRawBounded(stream.data, INTERNAL_LIMITS.maxRewrapDecodedBytes);
  } catch {
    return;
  }
  if (plain === undefined) return;
  stream.data = flateEncode(plain, 6);
  stream.syncLength();
}

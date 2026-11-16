/**
 * @module core/internal/flateStream
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
 *   larger than the re-wrap bound ({@link rewrapBound}: 64 MiB, or the
 *   `maxDecodedStreamBytes` of the call's limit context when that is smaller)
 *   is copied as loaded.
 * - {@link rewriteSyncFlushedStream} writes a loaded `/FlateDecode` stream
 *   whose zlib data ends at a sync flush, with no final DEFLATE block, back
 *   as complete zlib data of the bytes decoded so far, under the same bound.
 * - A document loaded with `ignoreEncryption: true` from a file whose
 *   trailer has `/Encrypt` is never re-wrapped or rewritten: its stream data
 *   is still encrypted, and encrypted data can inflate as raw DEFLATE by
 *   chance. The loader records such a document's registry with
 *   {@link markLoadedFromEncryptedFile}, and the writers skip
 *   {@link rewrapLegacyStream} and {@link rewriteSyncFlushedStream} when
 *   {@link isLoadedFromEncryptedFile} says so. A document whose objects the
 *   loader decrypted holds plaintext and is re-wrapped and rewritten like any other, as is a
 *   document that was created or loaded from a file without `/Encrypt`, also
 *   when `encrypt()` is called on it.
 * - A document whose objects were decrypted on load is recorded with
 *   {@link markDecryptedFromEncryptedFile}; so is a document that pages,
 *   embedded pages, metadata or a copy of such a document were brought into
 *   ({@link carryDecryptedFromEncryptedFile}). `PdfWriter` (and with it
 *   `serializePdf()` and every save) refuses to write such a registry unless
 *   it is given an encryption handler (`encrypt()` was called), and
 *   `PdfStreamWriter`, which never encrypts, refuses it always
 *   ({@link assertSavableDecryptedContent}); so do `saveIncremental()` and
 *   `saveDocumentIncremental()`, which never encrypt, and `save()`,
 *   `saveAsStream()`, `saveAsBlob()` and `saveAsBase64()`, which check before they change
 *   the document or run a plugin hook.
 * - The strings and streams themselves that the decrypt pass produced are
 *   recorded too ({@link recordDecryptedObject}), and so are the copies the
 *   library's object copiers make of them ({@link recordCloneOfDecrypted}).
 *   Whatever registry such an object sits in, `PdfWriter`, `PdfStreamWriter`
 *   and `saveIncremental()` refuse to write, without an encryption handler,
 *   an object body that holds one ({@link assertNoDecryptedObject}); the
 *   writer `copy()` makes is the one exempt. Both records are shared by the
 *   ESM, CJS and IIFE builds loaded into one realm.
 *
 * @packageDocumentation
 */

import {
  flateEncode,
  inflateRawBounded,
  inflateSyncFlushedZlib,
  isZlibHeader,
  wrapRawDeflate,
} from '../../codecs/internal/pdfFlate.js';
import {
  isAvailable as isWasmDeflateAvailable,
  deflateSync as wasmDeflateSync,
} from '../../codecs/internal/libdeflateWasm.js';
import { rewrapBound, type LimitContext } from '../../internal/limits.js';
import { UnsupportedEncryptionError } from '../../errors.js';
import { PdfName } from '../pdfObjects.js';
import type { PdfObject, PdfObjectRegistry, PdfStream, PdfString } from '../pdfObjects.js';

/** Registries of documents loaded, not decrypted, from a file whose trailer has `/Encrypt`. */
const encryptedSources = new WeakSet<PdfObjectRegistry>();

/**
 * The set stored on `globalThis` under `Symbol.for(name)`, created there on first use, so the
 * ESM, CJS and IIFE builds loaded into one realm share it, as in internal/warnings. Where
 * `globalThis` is frozen or not extensible, the set this call creates stays this module's own.
 */
function sharedWeakSet<T extends object>(name: string): WeakSet<T> {
  const realm = globalThis as Record<symbol, unknown>;
  const key = Symbol.for(name);
  const existing = realm[key];
  if (existing instanceof WeakSet) return existing as WeakSet<T>;
  const created = new WeakSet<T>();
  // Reflect.set returns false instead of throwing on a frozen or non-extensible globalThis.
  Reflect.set(realm, key, created);
  return created;
}

/**
 * Registries that hold content decrypted from a file whose trailer has `/Encrypt`. Shared by
 * the ESM, CJS and IIFE builds through `globalThis`, as in internal/warnings ({@link sharedWeakSet}).
 */
const decryptedSources = sharedWeakSet<PdfObjectRegistry>('modern-pdf-lib.decryptedSources');

/**
 * The strings and streams the decrypt pass of a load produced, and the copies the library's
 * object copiers made of them. Shared like {@link decryptedSources}.
 */
const decryptedObjects = sharedWeakSet<PdfString | PdfStream>('modern-pdf-lib.decryptedObjects');

/**
 * Record that a registry holds the objects of a file whose trailer has
 * `/Encrypt`, as stored, without decryption (`ignoreEncryption: true`). The
 * writers then do not re-wrap or rewrite its `/FlateDecode` stream data (see
 * {@link rewrapLegacyStream} and {@link rewriteSyncFlushedStream}).
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
 * Record that a registry holds content the loader decrypted from a file
 * whose trailer has `/Encrypt`.
 *
 * @param registry - The registry the loader filled.
 */
export function markDecryptedFromEncryptedFile(registry: PdfObjectRegistry): void {
  decryptedSources.add(registry);
}

/**
 * True when the registry was recorded with
 * {@link markDecryptedFromEncryptedFile} or
 * {@link carryDecryptedFromEncryptedFile}.
 *
 * @param registry - A document's registry.
 */
export function isDecryptedFromEncryptedFile(registry: PdfObjectRegistry): boolean {
  return decryptedSources.has(registry);
}

/**
 * Record `target` as holding decrypted content when `source` does: called
 * when pages, embedded pages, metadata or a copy of a document are brought
 * into another document.
 *
 * @param source - The registry content is copied from.
 * @param target - The registry content is copied into.
 */
export function carryDecryptedFromEncryptedFile(
  source: PdfObjectRegistry,
  target: PdfObjectRegistry,
): void {
  if (decryptedSources.has(source)) decryptedSources.add(target);
}

/**
 * Refuse to write a document that holds content decrypted from an encrypted
 * file without encryption: the check of `PdfWriter.write()`, the
 * `PdfStreamWriter` constructor, `saveIncremental()`, `saveDocumentIncremental()` and the
 * first statement of `save()` and `saveAsStream()`.
 *
 * @param registry  - The registry the writer serializes from.
 * @param encrypted - Whether the writer was given an encryption handler.
 * @param caller    - The writer's name for the message, such as `'PdfWriter'`.
 * @throws {UnsupportedEncryptionError} When the registry holds decrypted
 *         content ({@link isDecryptedFromEncryptedFile}) and `encrypted` is
 *         false.
 */
export function assertSavableDecryptedContent(
  registry: PdfObjectRegistry,
  encrypted: boolean,
  caller: string,
): void {
  if (encrypted || !decryptedSources.has(registry)) return;
  throw new UnsupportedEncryptionError(
    `${caller} would write content decrypted from an encrypted PDF without encryption; ` +
      'call encrypt() on this document before saving it.',
  );
}

/**
 * Record a string or stream that the decrypt pass of a load produced. The record follows the
 * object into whatever registry it is put in: a writer that emits it without encryption throws
 * ({@link assertNoDecryptedObject}).
 *
 * @param object - The decrypted string, or the stream whose data was decrypted.
 */
export function recordDecryptedObject(object: PdfString | PdfStream): void {
  decryptedObjects.add(object);
}

/**
 * Record every string and stream `object` is or holds, in its entries and in the dictionaries,
 * arrays and stream dictionaries nested in it (references are not followed): the members of an
 * object stream the decrypt pass decrypted, and the objects of the copy `copy()` loads from the
 * bytes of a document that holds recorded objects.
 *
 * @param object - The object to walk.
 */
export function recordDecryptedContent(object: PdfObject): void {
  switch (object.kind) {
    case 'string':
      decryptedObjects.add(object);
      return;
    case 'stream':
      decryptedObjects.add(object);
      recordDecryptedContent(object.dict);
      return;
    case 'dict':
      for (const [, value] of object) recordDecryptedContent(value);
      return;
    case 'array':
      for (const item of object.items) recordDecryptedContent(item);
      return;
    default:
      return;
  }
}

/**
 * Record `clone` when `source` is a recorded string or stream: called by the object copiers that
 * `copyPages()`, `mergePdfs()`, `splitPdf()` and the embed calls use, for every string and stream
 * they copy.
 *
 * @param source - The object copied.
 * @param clone  - Its copy.
 */
export function recordCloneOfDecrypted(source: PdfObject, clone: PdfString | PdfStream): void {
  if ((source.kind === 'string' || source.kind === 'stream') && decryptedObjects.has(source)) {
    decryptedObjects.add(clone);
  }
}

/**
 * True when `object` is or holds a recorded string or stream, in its entries and in the
 * dictionaries, arrays and stream dictionaries nested in it (references are not followed). One
 * set lookup per string and stream.
 *
 * @param object - The object to walk.
 */
export function holdsDecryptedObject(object: PdfObject): boolean {
  switch (object.kind) {
    case 'string':
      return decryptedObjects.has(object);
    case 'stream':
      return decryptedObjects.has(object) || holdsDecryptedObject(object.dict);
    case 'dict':
      for (const [, value] of object) if (holdsDecryptedObject(value)) return true;
      return false;
    case 'array':
      for (const item of object.items) if (holdsDecryptedObject(item)) return true;
      return false;
    default:
      return false;
  }
}

/**
 * Refuse to emit, without encryption, an object body that is or holds a string or stream the
 * decrypt pass of a load produced ({@link recordDecryptedObject}), whatever registry it now sits
 * in: the check `PdfWriter`, `PdfStreamWriter` and `saveIncremental()` make for each object body
 * they write without an encryption handler. The one writer exempt is the one `copy()` makes.
 *
 * @param object - The object whose body is about to be written.
 * @param caller - The writer's name for the message, such as `'PdfWriter'`.
 * @throws {UnsupportedEncryptionError} When `object` holds a recorded string or stream.
 */
export function assertNoDecryptedObject(object: PdfObject, caller: string): void {
  if (!holdsDecryptedObject(object)) return;
  throw new UnsupportedEncryptionError(
    `${caller} would write a string or stream decrypted from an encrypted PDF without ` +
      'encryption; call encrypt() on the document that holds it before saving it.',
  );
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
 * {@link rewrapBound} decoded bytes (64 MiB under the default limits), they
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
 * data that decodes to more than {@link rewrapBound} bytes, and data in which
 * 128 KiB of input in a row before its final block decode to no bytes, is
 * left alone too (inflating stops once the decoded size passes it), and no
 * error is thrown.
 *
 * The writers never call this for a document loaded without decryption
 * from a file whose trailer has `/Encrypt` ({@link isLoadedFromEncryptedFile}):
 * the stream data of such a document is still encrypted, and encrypted data
 * can inflate as raw DEFLATE by chance, which would replace it for good.
 *
 * @param stream - The stream to update in place.
 * @param ctx    - The limit context of the save.
 */
export function rewrapLegacyStream(stream: PdfStream, ctx: LimitContext): void {
  if (stream.data.length === 0 || !firstFilterIsFlate(stream)) return;
  if (isZlibHeader(stream.data)) return;

  let plain: Uint8Array | undefined;
  try {
    plain = inflateRawBounded(stream.data, rewrapBound(ctx));
  } catch {
    return;
  }
  if (plain === undefined) return;
  stream.data = flateEncode(plain, 6);
  stream.syncLength();
}

/**
 * Write a `/FlateDecode` stream whose zlib data ends at a sync flush, with no
 * final DEFLATE block, back as complete zlib data.
 *
 * Applies when the stream's `/Filter` is `/FlateDecode`, or an array whose
 * first entry is `/FlateDecode`, and its data starts with a zlib header and
 * ends with `00 00 ff ff` (`inflateSyncFlushedZlib`). When the data has not
 * reached its final block, ends at a block boundary and inflates to at most
 * {@link rewrapBound} bytes (64 MiB under the default limits), the bytes
 * decoded up to the sync flush, which a reader decodes from the data as
 * loaded, are compressed again as zlib data at level 6 and replace the data,
 * and `/Length` is updated. `/DecodeParms` stays as it is.
 *
 * Complete zlib data is never rewritten. Data that does not inflate, data cut
 * short inside a block, data that decodes to more than {@link rewrapBound}
 * bytes (inflating stops once the decoded size passes it), and data in which
 * 128 KiB of input in a row decode to no bytes are left alone, and no error is
 * thrown.
 *
 * The writers call this next to {@link rewrapLegacyStream}, under the same
 * guard: never for a document loaded without decryption from a file whose
 * trailer has `/Encrypt` ({@link isLoadedFromEncryptedFile}), whose stream
 * data is still encrypted.
 *
 * @param stream - The stream to update in place.
 * @param ctx    - The limit context of the save.
 */
export function rewriteSyncFlushedStream(stream: PdfStream, ctx: LimitContext): void {
  if (!firstFilterIsFlate(stream)) return;
  const plain = inflateSyncFlushedZlib(stream.data, rewrapBound(ctx));
  if (plain === undefined) return;
  stream.data = flateEncode(plain, 6);
  stream.syncLength();
}

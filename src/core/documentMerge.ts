/**
 * @module core/documentMerge
 *
 * Cross-document operations: copy pages between documents, merge
 * multiple documents into one, and split a document by page ranges.
 *
 * Key complexity: When copying pages, all referenced resources (fonts,
 * images, ExtGState, etc.) must be deeply cloned and re-registered in
 * the target document's object registry. Within one copy call, a stream
 * reuses an earlier copy only when its bytes and dictionary compare equal
 * to that copy's source; otherwise it is copied again.
 *
 * @packageDocumentation
 */

import {
  PdfDict,
  PdfArray,
  PdfStream,
  PdfRef,
  PdfName,
  PdfNumber,
  PdfString,
  PdfBool,
  PdfNull,
} from './pdfObjects.js';
import type { PdfObject, PdfObjectRegistry } from './pdfObjects.js';
import { PdfPage } from './pdfPage.js';
import { PdfDocument, createPdf } from './pdfDocument.js';
import { carryDecryptedFromEncryptedFile, recordCloneOfDecrypted } from './internal/flateStream.js';
import { InvalidArgumentError } from '../errors.js';

// ---------------------------------------------------------------------------
// Bucket hashing for stream deduplication
// ---------------------------------------------------------------------------

/**
 * Compute a simple hash of a Uint8Array for use as a bucket key.
 *
 * Uses FNV-1a (32-bit), which is fast but NOT cryptographic and not
 * collision resistant. It is used only as a bucket key: two streams are
 * treated as identical only after their bytes and dictionaries compare
 * equal (see {@link remapRef}).
 *
 * @param data  The bytes to hash.
 * @returns     A hex string hash.
 */
function hashBytes(data: Uint8Array): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // Convert to unsigned 32-bit and then hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Reference remapping context
// ---------------------------------------------------------------------------

/**
 * Tracks the mapping of source object references to target references
 * during a cross-document copy operation.
 *
 * Also remembers copied streams so that a later stream of the same source
 * whose bytes and dictionary compare equal can reuse the earlier copy. A context is
 * bound to one source registry: refs inside compared dictionaries are
 * matched by object number, so a context must never be shared across
 * source documents.
 */
class CopyContext {
  /** Maps source object number -> target PdfRef. */
  readonly refMap = new Map<number, PdfRef>();

  /**
   * Streams already copied, bucketed by `length:hash` of their raw data.
   * A bucket entry is reused only when the bytes and the dictionary of the
   * source stream are equal (see {@link remapRef}); the hash only narrows
   * the search.
   */
  readonly streamBuckets = new Map<
    string,
    { readonly ref: PdfRef; readonly source: PdfStream }[]
  >();

  constructor(
    readonly sourceRegistry: PdfObjectRegistry,
    readonly targetRegistry: PdfObjectRegistry,
  ) {}
}

/** Byte-wise equality of two buffers. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Most candidate streams kept per bucket. Once a bucket is full, a later
 * stream with the same key is still compared against the kept candidates
 * but is not added to them, so a lookup compares at most this many streams;
 * the only cost is a missed deduplication.
 */
const MAX_BUCKET_CANDIDATES = 16;

/** Deepest nesting compared before two values are treated as unequal. */
const MAX_COMPARE_DEPTH = 32;

/**
 * Structural equality of two source-document values. Dict key order is
 * ignored; refs compare by object and generation number without being
 * resolved. Anything uncertain compares unequal, which only costs a
 * missed deduplication.
 */
function pdfValuesEqual(a: PdfObject, b: PdfObject, depth: number): boolean {
  if (depth > MAX_COMPARE_DEPTH || a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'null':
      return true;
    case 'bool':
    case 'number':
      return a.value === (b as typeof a).value;
    case 'name':
      return a.value === (b as PdfName).value;
    case 'string':
      return a.equals(b as PdfString) && a.hex === (b as PdfString).hex;
    case 'ref':
      return (
        a.objectNumber === (b as PdfRef).objectNumber &&
        a.generationNumber === (b as PdfRef).generationNumber
      );
    case 'array': {
      const items = (b as PdfArray).items;
      return (
        a.items.length === items.length &&
        a.items.every((item, i) => {
          const other = items[i];
          return other !== undefined && pdfValuesEqual(item, other, depth + 1);
        })
      );
    }
    case 'dict':
      return dictsEqual(a, b as PdfDict, depth, false);
    default:
      // A direct stream is never valid PDF; never treat it as equal.
      return false;
  }
}

/** Equality of two dictionaries, optionally ignoring the top-level `/Length`. */
function dictsEqual(a: PdfDict, b: PdfDict, depth: number, skipLength: boolean): boolean {
  const sizeA = skipLength && a.has('/Length') ? a.size - 1 : a.size;
  const sizeB = skipLength && b.has('/Length') ? b.size - 1 : b.size;
  if (sizeA !== sizeB) return false;
  for (const [key, value] of a) {
    if (skipLength && key === '/Length') continue;
    const other = b.get(key);
    if (other === undefined || !pdfValuesEqual(value, other, depth + 1)) return false;
  }
  return true;
}

/** Equality of two stream dictionaries, ignoring the derived `/Length`. */
function streamDictsEqual(a: PdfDict, b: PdfDict): boolean {
  return dictsEqual(a, b, 0, true);
}

// ---------------------------------------------------------------------------
// Deep clone with reference remapping
// ---------------------------------------------------------------------------

/**
 * Deep-clone a PdfObject, remapping all PdfRef references from the source
 * document to the target document.
 *
 * For PdfStream objects, the stream data is also cloned. The copy of a string
 * or stream decrypted on load is recorded as decrypted too
 * (`recordCloneOfDecrypted` in core/internal/flateStream). A stream reached
 * through an indirect reference reuses an earlier copy (in remapRef) only
 * when its bytes and dictionary compare equal to that copy's source.
 *
 * @param obj      The source PdfObject to clone.
 * @param context  The copy context with reference mappings.
 * @returns        The cloned object registered in the target registry.
 */
function deepClone(obj: PdfObject, context: CopyContext): PdfObject {
  switch (obj.kind) {
    case 'null':
      return PdfNull.instance;

    case 'bool':
      return PdfBool.of((obj as PdfBool).value);

    case 'number':
      return PdfNumber.of((obj as PdfNumber).value);

    case 'string': {
      const s = obj as PdfString;
      const clonedString = PdfString.fromBytes(s.toBytes(), s.hex ? 'hex' : 'literal');
      recordCloneOfDecrypted(s, clonedString);
      return clonedString;
    }

    case 'name':
      return PdfName.of((obj as PdfName).value);

    case 'array': {
      const arr = obj as PdfArray;
      const items: PdfObject[] = [];
      for (const item of arr.items) {
        items.push(deepClone(item, context));
      }
      return new PdfArray(items);
    }

    case 'dict': {
      const dict = obj as PdfDict;
      const cloned = new PdfDict();
      for (const [key, value] of dict) {
        cloned.set(key, deepClone(value, context));
      }
      return cloned;
    }

    case 'stream': {
      const stream = obj as PdfStream;
      const clonedDict = new PdfDict();
      for (const [key, value] of stream.dict) {
        clonedDict.set(key, deepClone(value, context));
      }
      // Clone the data
      const clonedData = new Uint8Array(stream.data);
      const clonedStream = new PdfStream(clonedDict, clonedData);
      clonedStream.syncLength();
      recordCloneOfDecrypted(stream, clonedStream);
      return clonedStream;
    }

    case 'ref': {
      const ref = obj as PdfRef;
      return remapRef(ref, context);
    }

    default:
      return obj;
  }
}

/**
 * Remap a PdfRef from the source document to the target document.
 *
 * If the referenced object has already been copied, return the existing
 * target reference. Otherwise, resolve the source object, deep-clone it,
 * register it in the target, and record the mapping.
 *
 * @param sourceRef  The source reference to remap.
 * @param context    The copy context.
 * @returns          The target reference.
 */
function remapRef(sourceRef: PdfRef, context: CopyContext): PdfRef {
  // Check if already mapped
  const existing = context.refMap.get(sourceRef.objectNumber);
  if (existing) return existing;

  // Resolve the source object
  const sourceObj = context.sourceRegistry.resolve(sourceRef);
  if (!sourceObj) {
    // Object not found in source — return a null-ish ref
    // Allocate a placeholder
    const placeholderRef = context.targetRegistry.register(PdfNull.instance);
    context.refMap.set(sourceRef.objectNumber, placeholderRef);
    return placeholderRef;
  }

  // For streams, reuse an earlier copy only when bytes and dictionary match
  let bucket: { readonly ref: PdfRef; readonly source: PdfStream }[] | undefined;
  if (sourceObj.kind === 'stream') {
    const key = `${sourceObj.data.length}:${hashBytes(sourceObj.data)}`;
    bucket = context.streamBuckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      context.streamBuckets.set(key, bucket);
    }
    const match = bucket.find(
      (c) =>
        streamDictsEqual(c.source.dict, sourceObj.dict) &&
        bytesEqual(c.source.data, sourceObj.data),
    );
    if (match) {
      context.refMap.set(sourceRef.objectNumber, match.ref);
      return match.ref;
    }
  }

  // Allocate a target reference first (to handle circular references)
  const targetRef = context.targetRegistry.allocate();
  context.refMap.set(sourceRef.objectNumber, targetRef);

  // Deep-clone the object
  const clonedObj = deepClone(sourceObj, context);

  // Register in the target
  context.targetRegistry.assign(targetRef, clonedObj);

  // Remember this stream as a candidate for later identical streams
  if (bucket !== undefined && bucket.length < MAX_BUCKET_CANDIDATES) {
    bucket.push({ ref: targetRef, source: sourceObj as PdfStream });
  }

  return targetRef;
}

// ---------------------------------------------------------------------------
// Copy pages between documents
// ---------------------------------------------------------------------------

/**
 * Copy pages from a source document to a target document.
 *
 * This is the core implementation used by `copyPages()`,
 * `PdfDocument.copyPages()`, `mergePdfs()` and `splitPdf()`. It deeply
 * clones all page content and referenced resources; a stream reuses an
 * earlier copy only when its bytes and dictionary compare equal to that
 * copy's source.
 *
 * @param sourceDoc   The source document.
 * @param targetDoc   The target document.
 * @param indices     Zero-based page indices to copy from the source.
 * @returns           Array of new PdfPage objects added to the target.
 * @throws {InvalidArgumentError} If an index is outside the source document.
 *
 * @internal
 */
export function copyPagesToTarget(
  sourceDoc: PdfDocument,
  targetDoc: PdfDocument,
  indices: number[],
): PdfPage[] {
  const sourcePages = sourceDoc.getInternalPages();
  const targetRegistry = targetDoc.getRegistry();
  const sourceRegistry = sourceDoc.getRegistry();

  // Validate indices
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= sourcePages.length) {
      throw new InvalidArgumentError(
        `copyPages: index ${index} out of range [0, ${sourcePages.length - 1}]`,
        { argument: 'indices' },
      );
    }
  }

  // Decrypted content copied into the target makes its save refuse until encrypt() is called.
  carryDecryptedFromEncryptedFile(sourceRegistry, targetRegistry);
  const context = new CopyContext(sourceRegistry, targetRegistry);
  const newPages: PdfPage[] = [];

  for (const index of indices) {
    const sourcePage = sourcePages[index]!;
    const newPage = targetDoc.addPage([sourcePage.width, sourcePage.height]);

    // Copy rotation
    const rotation = sourcePage.getRotation();
    if (rotation !== 0) {
      newPage.setRotation(rotation);
    }

    // Copy crop box
    const cropBox = sourcePage.getCropBox();
    if (cropBox) {
      newPage.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
    }

    // Copy bleed box
    const bleedBox = sourcePage.getBleedBox();
    if (bleedBox) {
      newPage.setBleedBox(bleedBox.x, bleedBox.y, bleedBox.width, bleedBox.height);
    }

    // Copy art box
    const artBox = sourcePage.getArtBox();
    if (artBox) {
      newPage.setArtBox(artBox.x, artBox.y, artBox.width, artBox.height);
    }

    // Copy trim box
    const trimBox = sourcePage.getTrimBox();
    if (trimBox) {
      newPage.setTrimBox(trimBox.x, trimBox.y, trimBox.width, trimBox.height);
    }

    // Copy content stream operators
    const ops = sourcePage.getContentStreamData();
    if (ops) {
      newPage.pushOperators(ops);
    }

    // Copy font resources — clone any font refs from the source page
    // and register them on the new page
    const sourceResources = sourcePage.buildResources();
    const fontDict = sourceResources.get('/Font');
    if (fontDict && fontDict.kind === 'dict') {
      for (const [fontName, fontRef] of fontDict as PdfDict) {
        if (fontRef.kind === 'ref') {
          const mappedRef = remapRef(fontRef as PdfRef, context);
          newPage.registerFont(fontName.startsWith('/') ? fontName.slice(1) : fontName, mappedRef);
        }
      }
    }

    // Copy XObject resources (images)
    const xObjDict = sourceResources.get('/XObject');
    if (xObjDict && xObjDict.kind === 'dict') {
      for (const [xObjName, xObjRef] of xObjDict as PdfDict) {
        if (xObjRef.kind === 'ref') {
          const mappedRef = remapRef(xObjRef as PdfRef, context);
          newPage.registerXObject(
            xObjName.startsWith('/') ? xObjName.slice(1) : xObjName,
            mappedRef,
          );
        }
      }
    }

    // Copy ExtGState resources
    const gsDict = sourceResources.get('/ExtGState');
    if (gsDict && gsDict.kind === 'dict') {
      for (const [gsName, gsRef] of gsDict as PdfDict) {
        if (gsRef.kind === 'ref') {
          const mappedRef = remapRef(gsRef as PdfRef, context);
          newPage.registerExtGState(gsName.startsWith('/') ? gsName.slice(1) : gsName, mappedRef);
        }
      }
    }

    newPages.push(newPage);
  }

  return newPages;
}

// ---------------------------------------------------------------------------
// Copy pages (standalone function)
// ---------------------------------------------------------------------------

/**
 * Copy pages from a source document to a target document.
 *
 * @param sourceDoc   The source document.
 * @param targetDoc   The target document.
 * @param indices     Zero-based page indices to copy from the source.
 * @returns           Array of new PdfPage objects added to the target.
 */
export function copyPages(
  sourceDoc: PdfDocument,
  targetDoc: PdfDocument,
  indices: number[],
): PdfPage[] {
  return copyPagesToTarget(sourceDoc, targetDoc, indices);
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merge multiple PDF documents into a single document.
 *
 * Pages from each source document are appended in order. Within each
 * source document, a stream reuses an earlier copy only when its bytes and
 * dictionary compare equal to that copy's source; streams are not shared
 * between source documents.
 *
 * @param documents  Array of PdfDocument objects to merge.
 * @returns          A new PdfDocument containing all pages.
 *
 * @example
 * ```ts
 * import { PdfDocument, mergePdfs } from 'modern-pdf-lib';
 *
 * const doc1 = await PdfDocument.load(bytes1);
 * const doc2 = await PdfDocument.load(bytes2);
 * const merged = await mergePdfs([doc1, doc2]);
 * const mergedBytes = await merged.save();
 * ```
 */
export async function mergePdfs(documents: PdfDocument[]): Promise<PdfDocument> {
  if (documents.length === 0) {
    return createPdf();
  }

  if (documents.length === 1) {
    // Single document — still copy to a fresh doc to avoid aliasing
    const result = createPdf();
    const source = documents[0]!;
    const indices = Array.from({ length: source.getPageCount() }, (_, i) => i);
    copyPagesToTarget(source, result, indices);
    return result;
  }

  const result = createPdf();

  // Copy metadata from the first document
  const first = documents[0]!;
  const title = first.getTitle();
  if (title !== undefined) result.setTitle(title);
  const author = first.getAuthor();
  if (author !== undefined) result.setAuthor(author);
  const subject = first.getSubject();
  if (subject !== undefined) result.setSubject(subject);
  const keywords = first.getKeywords();
  if (keywords !== undefined) result.setKeywords(keywords);
  const creator = first.getCreator();
  if (creator !== undefined) result.setCreator(creator);

  // Copy pages from each source document
  for (const doc of documents) {
    // Also a source without pages: the result's metadata may be its decrypted metadata.
    carryDecryptedFromEncryptedFile(doc.getRegistry(), result.getRegistry());
    const pageCount = doc.getPageCount();
    if (pageCount === 0) continue;
    const indices = Array.from({ length: pageCount }, (_, i) => i);
    copyPagesToTarget(doc, result, indices);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/**
 * A page range for splitting, specified as `[startIndex, endIndex]`.
 * Both indices are zero-based and inclusive.
 *
 * For example, `[0, 2]` means pages 0, 1, and 2.
 */
export type PageRange = [start: number, end: number];

/**
 * Split a PDF document into multiple documents by page ranges.
 *
 * Each range produces a new PdfDocument containing only the pages
 * in that range. Pages can appear in multiple ranges (they are
 * independently copied).
 *
 * @param document  The source document to split.
 * @param ranges    Array of `[start, end]` ranges (zero-based, inclusive).
 * @returns         Array of new PdfDocument objects, one per range.
 * @throws {InvalidArgumentError} If a range starts or ends outside the document, or ends before it starts.
 *
 * @example
 * ```ts
 * import { PdfDocument, splitPdf } from 'modern-pdf-lib';
 *
 * const doc = await PdfDocument.load(bytes);
 * // Split into first 3 pages and remaining pages
 * const [part1, part2] = await splitPdf(doc, [[0, 2], [3, doc.getPageCount() - 1]]);
 * ```
 */
export async function splitPdf(document: PdfDocument, ranges: PageRange[]): Promise<PdfDocument[]> {
  const pageCount = document.getPageCount();

  // Validate ranges
  for (const [start, end] of ranges) {
    if (!Number.isInteger(start) || start < 0 || start >= pageCount) {
      throw new InvalidArgumentError(
        `splitPdf: start index ${start} out of range [0, ${pageCount - 1}]`,
        { argument: 'ranges' },
      );
    }
    if (!Number.isInteger(end) || end < start || end >= pageCount) {
      throw new InvalidArgumentError(
        `splitPdf: end index ${end} out of range [${start}, ${pageCount - 1}]`,
        { argument: 'ranges' },
      );
    }
  }

  const results: PdfDocument[] = [];

  for (const [start, end] of ranges) {
    const result = createPdf();

    // Copy metadata
    const title = document.getTitle();
    if (title !== undefined) result.setTitle(title);
    const author = document.getAuthor();
    if (author !== undefined) result.setAuthor(author);

    // Build indices array for this range
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    copyPagesToTarget(document, result, indices);
    results.push(result);
  }

  return results;
}

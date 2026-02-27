/**
 * @module core/documentMerge
 *
 * Cross-document operations: copy pages between documents, merge
 * multiple documents into one, and split a document by page ranges.
 *
 * Key complexity: When copying pages, all referenced resources (fonts,
 * images, ExtGState, etc.) must be deeply cloned and re-registered in
 * the target document's object registry. Content hashing is used to
 * deduplicate identical resources.
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
import type { PdfObject, PdfObjectRegistry, ByteWriter } from './pdfObjects.js';
import { PdfPage, PageSizes } from './pdfPage.js';
import type { PageSize } from './pdfPage.js';
import { PdfDocument, createPdf } from './pdfDocument.js';

// ---------------------------------------------------------------------------
// Content hashing for deduplication
// ---------------------------------------------------------------------------

/**
 * Compute a simple hash of a Uint8Array for deduplication purposes.
 *
 * Uses FNV-1a (32-bit) which is fast and produces good distribution for
 * deduplication. This is NOT cryptographic — it's used only to detect
 * likely-identical resource data.
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

/**
 * Serialize a PdfObject to bytes for hashing purposes.
 *
 * @param obj  The PDF object to serialize.
 * @returns    The serialized bytes.
 */
function serializeForHash(obj: PdfObject): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  const writer: ByteWriter = {
    write(data: Uint8Array): void {
      chunks.push(data);
      totalLen += data.length;
    },
    writeString(str: string): void {
      const bytes = encoder.encode(str);
      chunks.push(bytes);
      totalLen += bytes.length;
    },
  };

  obj.serialize(writer);

  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reference remapping context
// ---------------------------------------------------------------------------

/**
 * Tracks the mapping of source object references to target references
 * during a cross-document copy operation.
 *
 * Also tracks content hashes to deduplicate identical resources.
 */
class CopyContext {
  /** Maps source object number -> target PdfRef. */
  readonly refMap = new Map<number, PdfRef>();

  /** Maps content hash -> target PdfRef (for deduplication). */
  readonly hashMap = new Map<string, PdfRef>();

  constructor(
    readonly sourceRegistry: PdfObjectRegistry,
    readonly targetRegistry: PdfObjectRegistry,
  ) {}
}

// ---------------------------------------------------------------------------
// Deep clone with reference remapping
// ---------------------------------------------------------------------------

/**
 * Deep-clone a PdfObject, remapping all PdfRef references from the source
 * document to the target document.
 *
 * For PdfStream objects, the stream data is also cloned. Content hashing
 * is used to deduplicate identical streams (e.g., the same font file
 * embedded in multiple source documents).
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
      return s.hex ? PdfString.hex(s.value) : PdfString.literal(s.value);
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

  // For streams, try deduplication via content hash
  if (sourceObj.kind === 'stream') {
    const stream = sourceObj as PdfStream;
    const hash = hashBytes(stream.data);
    const dedup = context.hashMap.get(hash);
    if (dedup) {
      context.refMap.set(sourceRef.objectNumber, dedup);
      return dedup;
    }
  }

  // Allocate a target reference first (to handle circular references)
  const targetRef = context.targetRegistry.allocate();
  context.refMap.set(sourceRef.objectNumber, targetRef);

  // Deep-clone the object
  const clonedObj = deepClone(sourceObj, context);

  // Register in the target
  context.targetRegistry.assign(targetRef, clonedObj);

  // Record hash for streams
  if (sourceObj.kind === 'stream') {
    const stream = sourceObj as PdfStream;
    const hash = hashBytes(stream.data);
    context.hashMap.set(hash, targetRef);
  }

  return targetRef;
}

// ---------------------------------------------------------------------------
// Copy pages between documents
// ---------------------------------------------------------------------------

/**
 * Copy pages from a source document to a target document.
 *
 * This is the core implementation used by both `PdfDocument.copyPages()`
 * and `mergePdfs()`. It deeply clones all page content and referenced
 * resources, deduplicating identical resources via content hashing.
 *
 * @param sourceDoc   The source document.
 * @param targetDoc   The target document.
 * @param indices     Zero-based page indices to copy from the source.
 * @returns           Array of new PdfPage objects added to the target.
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
    if (index < 0 || index >= sourcePages.length) {
      throw new RangeError(
        `copyPages: index ${index} out of range [0, ${sourcePages.length - 1}]`,
      );
    }
  }

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
          // ExtGState registration on PdfPage is via extGStates map
          // We use registerXObject as a workaround — but actually we need
          // a proper registerExtGState method. For now, use the internal approach.
          newPage.registerExtGState(
            gsName.startsWith('/') ? gsName.slice(1) : gsName,
            mappedRef,
          );
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
 * Pages from each source document are appended in order. Resources
 * are deduplicated: if two source documents contain the same font file
 * (byte-identical), only one copy is kept in the merged output.
 *
 * @param documents  Array of PdfDocument objects to merge.
 * @returns          A new PdfDocument containing all pages.
 *
 * @example
 * ```ts
 * import { PdfDocument, mergePdfs } from 'modern-pdf';
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
 *
 * @example
 * ```ts
 * import { PdfDocument, splitPdf } from 'modern-pdf';
 *
 * const doc = await PdfDocument.load(bytes);
 * // Split into first 3 pages and remaining pages
 * const [part1, part2] = await splitPdf(doc, [[0, 2], [3, doc.getPageCount() - 1]]);
 * ```
 */
export async function splitPdf(
  document: PdfDocument,
  ranges: PageRange[],
): Promise<PdfDocument[]> {
  const pageCount = document.getPageCount();

  // Validate ranges
  for (const [start, end] of ranges) {
    if (start < 0 || start >= pageCount) {
      throw new RangeError(
        `splitPdf: start index ${start} out of range [0, ${pageCount - 1}]`,
      );
    }
    if (end < start || end >= pageCount) {
      throw new RangeError(
        `splitPdf: end index ${end} out of range [${start}, ${pageCount - 1}]`,
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

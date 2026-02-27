/**
 * @module core/incrementalWriter
 *
 * Incremental save support for PDF documents.
 *
 * An incremental save appends new/modified objects to the end of the
 * original PDF file, followed by a new cross-reference section and
 * trailer that references the original xref via the `/Prev` key.
 *
 * This is critical for:
 * 1. **Signature preservation** — Digital signatures are invalidated by
 *    full rewrites. Incremental saves preserve the original bytes
 *    exactly, so signatures remain valid.
 * 2. **Performance on large files** — Only modified objects are written,
 *    so saving a small change to a 100MB PDF takes milliseconds.
 * 3. **Undo history** — Each incremental save is a layer that can be
 *    peeled back to restore the previous state.
 *
 * Reference: PDF 1.7 spec, SS7.5.6 (Incremental Updates).
 *
 * @packageDocumentation
 */

import { deflateSync as fflateDeflateSync } from 'fflate';
import type { PdfObject, PdfRef, ByteWriter, RegistryEntry } from './pdfObjects.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfArray,
} from './pdfObjects.js';
import type { DocumentStructure } from './pdfCatalog.js';
import type { PdfSaveOptions } from './pdfWriter.js';
import type { PdfDocument } from './pdfDocument.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Result of an incremental save operation.
 */
export interface IncrementalSaveResult {
  /** The complete PDF file bytes (original + appended data). */
  readonly bytes: Uint8Array;

  /** Byte offset of the new xref section in the output. */
  readonly newXrefOffset: number;
}

// ---------------------------------------------------------------------------
// Change tracker
// ---------------------------------------------------------------------------

/**
 * Tracks which objects have been added or modified since the document
 * was loaded. Only these objects are written during an incremental save.
 */
export class ChangeTracker {
  /** Set of object numbers that are new (not in the original file). */
  private readonly newObjects = new Set<number>();

  /** Set of object numbers that existed but have been modified. */
  private readonly modifiedObjects = new Set<number>();

  /** The highest object number from the original file. */
  private readonly originalMaxObjNum: number;

  constructor(originalMaxObjNum: number) {
    this.originalMaxObjNum = originalMaxObjNum;
  }

  /**
   * Mark an object as new (did not exist in the original file).
   */
  markNew(objectNumber: number): void {
    this.newObjects.add(objectNumber);
  }

  /**
   * Mark an object as modified (existed in the original file).
   */
  markModified(objectNumber: number): void {
    if (objectNumber <= this.originalMaxObjNum) {
      this.modifiedObjects.add(objectNumber);
    } else {
      this.newObjects.add(objectNumber);
    }
  }

  /**
   * Check if an object is new or modified.
   */
  isChanged(objectNumber: number): boolean {
    return this.newObjects.has(objectNumber) || this.modifiedObjects.has(objectNumber);
  }

  /**
   * Get all changed object numbers (new + modified).
   */
  getChangedObjects(): Set<number> {
    return this.newObjects.union(this.modifiedObjects);
  }

  /**
   * Get the count of changed objects.
   */
  get changedCount(): number {
    return this.newObjects.union(this.modifiedObjects).size;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Growable byte buffer for building the incremental appendix.
 */
class ByteBuffer {
  private chunks: Uint8Array[] = [];
  private _offset = 0;

  get offset(): number {
    return this._offset;
  }

  write(data: Uint8Array): void {
    this.chunks.push(data);
    this._offset += data.length;
  }

  writeString(str: string): void {
    this.write(encoder.encode(str));
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this._offset);
    let pos = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Finding the original xref offset
// ---------------------------------------------------------------------------

/**
 * Find the `startxref` offset in the original PDF bytes.
 *
 * Scans backward from the end of the file looking for the `startxref`
 * keyword, then parses the numeric offset on the following line.
 *
 * @param data  The original PDF bytes.
 * @returns     The byte offset of the original cross-reference section.
 * @throws      Error if `startxref` is not found.
 */
function findOriginalXrefOffset(data: Uint8Array): number {
  const decoder = new TextDecoder('latin1');

  // Search the last 1024 bytes for "startxref"
  const searchStart = Math.max(0, data.length - 1024);
  const tail = decoder.decode(data.subarray(searchStart));
  const idx = tail.lastIndexOf('startxref');

  if (idx === -1) {
    throw new Error(
      'Incremental save: could not find "startxref" in the original PDF. ' +
      'The file may be corrupted.',
    );
  }

  // Extract the offset number after "startxref"
  const afterStartxref = tail.substring(idx + 'startxref'.length).trim();
  const match = afterStartxref.match(/^(\d+)/);

  if (!match) {
    throw new Error(
      'Incremental save: could not parse xref offset after "startxref".',
    );
  }

  return parseInt(match[1]!, 10);
}

/**
 * Find the /Size value from the original trailer.
 *
 * @param data  The original PDF bytes.
 * @returns     The /Size value from the trailer.
 */
function findOriginalTrailerSize(data: Uint8Array): number {
  const decoder = new TextDecoder('latin1');
  const searchStart = Math.max(0, data.length - 2048);
  const tail = decoder.decode(data.subarray(searchStart));

  // Look for /Size in the trailer
  const sizeMatch = tail.match(/\/Size\s+(\d+)/);
  if (sizeMatch) {
    return parseInt(sizeMatch[1]!, 10);
  }

  // Default — could not find
  throw new Error(
    'Incremental save: could not find /Size in the original trailer.',
  );
}

// ---------------------------------------------------------------------------
// Incremental save
// ---------------------------------------------------------------------------

/**
 * Perform an incremental save of a PDF document.
 *
 * Takes the original file bytes and a registry of objects (some new,
 * some modified), and appends only the changed objects plus a new xref
 * section and trailer.
 *
 * The resulting bytes form a valid PDF file that preserves the original
 * content byte-for-byte and appends the modifications.
 *
 * @param originalBytes  The original PDF file bytes (unmodified).
 * @param registry       The object registry containing all objects
 *                       (original + new/modified).
 * @param structure      Document structure references (catalog, info, pages).
 * @param changedObjects Set of object numbers that are new or modified.
 * @param options        Optional save options (compression, etc.).
 * @returns              The complete incremental save result.
 *
 * @example
 * ```ts
 * const result = saveIncremental(originalBytes, registry, structure, changedObjects);
 * await writeFile('output.pdf', result.bytes);
 * ```
 */
export function saveIncremental(
  originalBytes: Uint8Array,
  registry: PdfObjectRegistry,
  structure: DocumentStructure,
  changedObjects: Set<number>,
  options?: PdfSaveOptions,
): IncrementalSaveResult {
  const compress = options?.compress ?? true;
  const compressionLevel = options?.compressionLevel ?? 6;

  // Find the original xref offset (for the /Prev pointer)
  const prevXrefOffset = findOriginalXrefOffset(originalBytes);

  // Find the original /Size
  let originalSize: number;
  try {
    originalSize = findOriginalTrailerSize(originalBytes);
  } catch {
    // Fallback: use the registry's next number
    originalSize = registry.nextNumber;
  }

  // Build the appendix
  const buf = new ByteBuffer();

  // Start with a newline separator after the original content
  buf.writeString('\n');

  // Xref entries for changed objects: maps obj number -> byte offset
  const xrefOffsets = new Map<number, number>();

  // Write each changed object
  for (const entry of registry) {
    if (!changedObjects.has(entry.ref.objectNumber)) {
      continue;
    }

    // Optionally compress streams
    if (compress && entry.object.kind === 'stream') {
      compressStream(entry.object as PdfStream, compressionLevel);
    }

    // Record the byte offset (relative to the start of the appendix,
    // which starts at originalBytes.length)
    const offset = originalBytes.length + buf.offset;
    xrefOffsets.set(entry.ref.objectNumber, offset);

    // Write the indirect object
    buf.writeString(`${entry.ref.toObjectHeader()}\n`);
    entry.object.serialize(buf);
    buf.writeString(`\n${entry.ref.toObjectFooter()}\n`);
  }

  // Compute the new /Size (max obj number + 1)
  let newSize = originalSize;
  for (const objNum of changedObjects) {
    if (objNum + 1 > newSize) {
      newSize = objNum + 1;
    }
  }
  // Also consider the registry's next number
  if (registry.nextNumber > newSize) {
    newSize = registry.nextNumber;
  }

  // Write the xref section
  const xrefOffset = originalBytes.length + buf.offset;

  // Build xref subsections
  // Group consecutive object numbers into subsections for efficiency
  const sortedObjNums = xrefOffsets.keys().toArray().sort((a, b) => a - b);
  const subsections = buildXrefSubsections(sortedObjNums, xrefOffsets);

  buf.writeString('xref\n');

  for (const subsection of subsections) {
    buf.writeString(`${subsection.startObjNum} ${subsection.entries.length}\n`);
    for (const entry of subsection.entries) {
      buf.writeString(
        `${entry.offset.toString().padStart(10, '0')} ${entry.generation.toString().padStart(5, '0')} ${entry.type} \n`,
      );
    }
  }

  // Write the trailer
  buf.writeString('trailer\n');
  buf.writeString('<<\n');
  buf.writeString(`/Size ${newSize}\n`);
  buf.writeString(
    `/Root ${structure.catalogRef.objectNumber} ${structure.catalogRef.generationNumber} R\n`,
  );
  buf.writeString(
    `/Info ${structure.infoRef.objectNumber} ${structure.infoRef.generationNumber} R\n`,
  );
  buf.writeString(`/Prev ${prevXrefOffset}\n`);
  buf.writeString('>>\n');
  buf.writeString('startxref\n');
  buf.writeString(`${xrefOffset}\n`);
  buf.writeString('%%EOF\n');

  // Combine original bytes + appendix
  const appendix = buf.toUint8Array();
  const result = new Uint8Array(originalBytes.length + appendix.length);
  result.set(originalBytes, 0);
  result.set(appendix, originalBytes.length);

  return {
    bytes: result,
    newXrefOffset: xrefOffset,
  };
}

// ---------------------------------------------------------------------------
// Xref subsection building
// ---------------------------------------------------------------------------

interface XrefEntry {
  offset: number;
  generation: number;
  type: 'n' | 'f';
}

interface XrefSubsection {
  startObjNum: number;
  entries: XrefEntry[];
}

/**
 * Group consecutive object numbers into xref subsections.
 *
 * For example, objects [3, 4, 5, 10, 11] become two subsections:
 * - `3 3` (objects 3, 4, 5)
 * - `10 2` (objects 10, 11)
 */
function buildXrefSubsections(
  sortedObjNums: number[],
  offsets: Map<number, number>,
): XrefSubsection[] {
  if (sortedObjNums.length === 0) return [];

  const subsections: XrefSubsection[] = [];
  let currentStart = sortedObjNums[0]!;
  let currentEntries: XrefEntry[] = [
    {
      offset: offsets.get(currentStart)!,
      generation: 0,
      type: 'n',
    },
  ];

  for (let i = 1; i < sortedObjNums.length; i++) {
    const objNum = sortedObjNums[i]!;
    const prev = sortedObjNums[i - 1]!;

    if (objNum === prev + 1) {
      // Consecutive — add to current subsection
      currentEntries.push({
        offset: offsets.get(objNum)!,
        generation: 0,
        type: 'n',
      });
    } else {
      // Gap — start a new subsection
      subsections.push({
        startObjNum: currentStart,
        entries: currentEntries,
      });
      currentStart = objNum;
      currentEntries = [
        {
          offset: offsets.get(objNum)!,
          generation: 0,
          type: 'n',
        },
      ];
    }
  }

  // Push the final subsection
  subsections.push({
    startObjNum: currentStart,
    entries: currentEntries,
  });

  return subsections;
}

// ---------------------------------------------------------------------------
// Stream compression helper
// ---------------------------------------------------------------------------

/**
 * Apply FlateDecode compression to a stream if it's not already compressed.
 */
function compressStream(stream: PdfStream, level: number): void {
  if (stream.dict.has('/Filter')) return;
  if (stream.data.length === 0) return;

  const compressed = fflateDeflateSync(stream.data, {
    level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  });

  if (compressed.length < stream.data.length) {
    stream.dict.set('/Filter', PdfName.of('FlateDecode'));
    stream.data = compressed;
    stream.syncLength();
  }
}

// ---------------------------------------------------------------------------
// Simplified incremental save (from document)
// ---------------------------------------------------------------------------

/**
 * Perform an incremental save given the original bytes and a PdfDocument.
 *
 * This is a convenience wrapper that builds the document structure,
 * determines which objects have changed, and calls `saveIncremental`.
 *
 * @param originalBytes  The original PDF file bytes.
 * @param doc            The modified PdfDocument.
 * @param options        Optional save options.
 * @returns              The incremental save result.
 */
export async function saveDocumentIncremental(
  originalBytes: Uint8Array,
  doc: PdfDocument,
  options?: PdfSaveOptions,
): Promise<IncrementalSaveResult> {
  // Import buildDocumentStructure to get the structure
  const { buildDocumentStructure } = await import('./pdfCatalog.js');
  const { PdfPage: _PdfPage } = await import('./pdfPage.js');

  const registry = doc.getRegistry();
  const pages = doc.getInternalPages();

  // Finalize all pages
  const pageEntries = pages.map((p) => p.finalize());

  // Build document structure
  const structure = buildDocumentStructure(pageEntries, {
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate(),
    modDate: doc.getModDate() ?? new Date(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
  }, registry);

  // Determine which objects are changed
  // For simplicity, we consider ALL objects in the registry as potentially changed
  // A more sophisticated approach would track individual modifications
  const originalSize = findOriginalTrailerSize(originalBytes);
  const changedObjects = new Set<number>();
  for (const entry of registry) {
    if (entry.ref.objectNumber >= originalSize) {
      changedObjects.add(entry.ref.objectNumber);
    }
  }

  // Also mark catalog, info, and pages as changed (since we rebuilt them)
  changedObjects.add(structure.catalogRef.objectNumber);
  changedObjects.add(structure.infoRef.objectNumber);
  changedObjects.add(structure.pagesRef.objectNumber);

  return saveIncremental(
    originalBytes,
    registry,
    structure,
    changedObjects,
    options,
  );
}

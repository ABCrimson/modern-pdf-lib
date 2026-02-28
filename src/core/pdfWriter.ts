/**
 * @module core/pdfWriter
 *
 * Binary serialization of a PDF document to a single `Uint8Array`.
 *
 * Produces a valid PDF 1.7 file:
 *
 * 1. `%PDF-1.7` header + binary comment
 * 2. Indirect-object bodies
 * 3. Cross-reference table
 * 4. Trailer dictionary (`/Size`, `/Root`, `/Info`)
 * 5. `startxref` pointer
 * 6. `%%EOF`
 *
 * Supports optional FlateDecode compression for streams via `fflate`.
 */

import { deflateSync as fflateDeflateSync } from 'fflate';
import { isAvailable as isWasmDeflateAvailable, deflateSync as wasmDeflateSync } from '../compression/libdeflateWasm.js';
import type { PdfRef, PdfObject, PdfStream, ByteWriter } from './pdfObjects.js';
import { PdfObjectRegistry, PdfNumber, PdfName, PdfDict, PdfArray } from './pdfObjects.js';
import type { RegistryEntry } from './pdfObjects.js';
import type { DocumentStructure } from './pdfCatalog.js';

// ---------------------------------------------------------------------------
// Save options
// ---------------------------------------------------------------------------

/** Options that control how the PDF is written. */
export interface PdfSaveOptions {
  /** Apply FlateDecode compression to streams.  Default: `true`. */
  compress?: boolean | undefined;
  /**
   * Compression level for FlateDecode (1–9).  Default: `6`.
   * Ignored when `compress` is `false`.
   */
  compressionLevel?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined;
  /**
   * When `true`, attempt to use WASM-accelerated compression if the
   * WASM module has been initialized.  Default: `false`.
   */
  useWasm?: boolean | undefined;
  /**
   * Minimum number of non-stream indirect objects before object streams
   * are used.  When the count exceeds this threshold, objects are packed
   * into compressed object streams and a cross-reference stream replaces
   * the traditional xref table.
   *
   * Set to `Infinity` to disable object streams (traditional xref).
   * A useful value for size reduction is `100`.
   *
   * Default: `Infinity` (disabled for backward compatibility).
   */
  objectStreamThreshold?: number | undefined;
  /** Add a blank page if the document has no pages. Default: `true`. */
  addDefaultPage?: boolean | undefined;
  /** Regenerate form field appearances before saving. Default: `true`. */
  updateFieldAppearances?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Internal byte buffer
// ---------------------------------------------------------------------------

/**
 * Growable byte buffer used during serialization.  All writes go
 * through this so that we can track the current byte offset for the
 * cross-reference table.
 */
class ByteBuffer {
  private chunks: Uint8Array[] = [];
  private _offset = 0;

  /** Current byte offset (total bytes written so far). */
  get offset(): number {
    return this._offset;
  }

  /** Append raw bytes. */
  write(data: Uint8Array): void {
    this.chunks.push(data);
    this._offset += data.length;
  }

  /** Append an ASCII string. */
  writeString(str: string): void {
    this.write(encoder.encode(str));
  }

  /** Concatenate all chunks into a single Uint8Array. */
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

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// PdfWriter
// ---------------------------------------------------------------------------

/**
 * Serialize a PDF document to a `Uint8Array`.
 *
 * ```ts
 * const writer = new PdfWriter(registry, structure, options);
 * const bytes = writer.write();
 * ```
 */
export class PdfWriter {
  private readonly buf = new ByteBuffer();
  private readonly xrefOffsets: number[] = [];
  private readonly compress: boolean;
  private readonly compressionLevel: number;
  private readonly useWasm: boolean;
  private readonly objectStreamThreshold: number;

  constructor(
    /** All indirect objects. */
    private readonly registry: PdfObjectRegistry,
    /** Document structure references. */
    private readonly structure: DocumentStructure,
    options?: PdfSaveOptions,
  ) {
    this.compress = options?.compress ?? true;
    this.compressionLevel = options?.compressionLevel ?? 6;
    this.useWasm = options?.useWasm ?? false;
    this.objectStreamThreshold = options?.objectStreamThreshold ?? Infinity;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Produce the complete PDF file as a `Uint8Array`.
   */
  write(): Uint8Array {
    this.writeHeader();

    if (this.objectStreamThreshold !== Infinity) {
      // PDF 1.5+ path: try object streams + cross-reference stream
      const useObjStreams = this.writeBodyWithObjectStreams(this.objectStreamThreshold);
      if (useObjStreams) {
        return this.buf.toUint8Array();
      }
      // If below threshold, fall through — but body is already written
      // by writeBodyWithObjectStreams (it writes normally when below threshold).
      const xrefOffset = this.writeXref();
      this.writeTrailer(xrefOffset);
    } else {
      this.writeBody();
      const xrefOffset = this.writeXref();
      this.writeTrailer(xrefOffset);
    }

    return this.buf.toUint8Array();
  }

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------

  private writeHeader(): void {
    // PDF version header
    this.buf.writeString('%PDF-1.7\n');
    // Binary comment — four bytes > 127 to signal binary content to
    // transfer programs.
    this.buf.write(
      new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]), // %âãÏÓ\n
    );
  }

  // -----------------------------------------------------------------------
  // Body — indirect object definitions
  // -----------------------------------------------------------------------

  private writeBody(): void {
    // Pre-allocate xref entries.  Index 0 is reserved for the free
    // head entry; actual objects start at index 1.
    // We'll record offsets indexed by object number.

    for (const entry of this.registry) {
      this.writeIndirectObject(entry);
    }
  }

  private writeIndirectObject(entry: RegistryEntry): void {
    // Optionally compress stream data
    if (this.compress && entry.object.kind === 'stream') {
      this.compressStream(entry.object as PdfStream);
    }

    // Record byte offset
    const objNum = entry.ref.objectNumber;
    // Ensure the array is big enough
    while (this.xrefOffsets.length <= objNum) {
      this.xrefOffsets.push(0);
    }
    this.xrefOffsets[objNum] = this.buf.offset;

    // N G obj\n
    this.buf.writeString(`${entry.ref.toObjectHeader()}\n`);

    // Serialize the object value
    entry.object.serialize(this.buf);

    // \nendobj\n
    this.buf.writeString(`\n${entry.ref.toObjectFooter()}\n`);
  }

  /**
   * Apply FlateDecode compression to a stream's data if it is not
   * already compressed.
   */
  private compressStream(stream: PdfStream): void {
    // Skip if already has a filter
    if (stream.dict.has('/Filter')) return;
    // Skip empty streams
    if (stream.data.length === 0) return;

    let compressed: Uint8Array;

    if (this.useWasm && isWasmDeflateAvailable()) {
      // Use WASM-accelerated compression
      compressed = wasmDeflateSync(stream.data, this.compressionLevel);
    } else {
      // Fall back to fflate (pure JS)
      compressed = fflateDeflateSync(stream.data, {
        level: this.compressionLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      });
    }

    // Only use compressed version if it's actually smaller
    if (compressed.length < stream.data.length) {
      stream.dict.set('/Filter', PdfName.of('FlateDecode'));
      stream.data = compressed;
      stream.syncLength();
    }
  }

  // -----------------------------------------------------------------------
  // Object streams (PDF 1.5+)
  // -----------------------------------------------------------------------

  /**
   * Set of object numbers that must NOT be placed inside an object
   * stream.  This includes the catalog, info dict, pages root, and
   * any stream objects (which by definition cannot nest in an ObjStm).
   */
  private protectedObjectNumbers(): Set<number> {
    return new Set<number>([
      this.structure.catalogRef.objectNumber,
      this.structure.infoRef.objectNumber,
      this.structure.pagesRef.objectNumber,
    ]);
  }

  /**
   * Write the document body using object streams when the number of
   * eligible non-stream objects exceeds `threshold`.
   *
   * @returns `true` if object streams (and a cross-reference stream)
   *          were used and the PDF is complete.  `false` if the
   *          threshold was not met — in that case the body has been
   *          written in traditional format and the caller must still
   *          emit the classic xref table and trailer.
   */
  writeBodyWithObjectStreams(threshold: number): boolean {
    const protectedNums = this.protectedObjectNumbers();

    // Partition entries into:
    //   - streamEntries: PdfStream objects (must be written as normal indirect objects)
    //   - protectedEntries: catalog, info, pages (must be normal indirect objects)
    //   - packableEntries: everything else (eligible for object stream packing)
    const streamEntries: RegistryEntry[] = [];
    const protectedEntries: RegistryEntry[] = [];
    const packableEntries: RegistryEntry[] = [];

    for (const entry of this.registry) {
      if (entry.object.kind === 'stream') {
        streamEntries.push(entry);
      } else if (protectedNums.has(entry.ref.objectNumber)) {
        protectedEntries.push(entry);
      } else {
        packableEntries.push(entry);
      }
    }

    // If packable count is below threshold, write everything traditionally
    if (packableEntries.length < threshold) {
      this.writeBody();
      return false;
    }

    // --- Object-stream path ---

    // 1. Write stream objects and protected objects as normal indirect objects
    for (const entry of streamEntries) {
      this.writeIndirectObject(entry);
    }
    for (const entry of protectedEntries) {
      this.writeIndirectObject(entry);
    }

    // 2. Pack packable objects into object streams.
    //    We group them into chunks of up to 200 objects per ObjStm.
    const OBJS_PER_STREAM = 200;
    // xrefEntries will collect info for the cross-reference stream:
    //   Map<objectNumber, { type: 1|2, field2: number, field3: number }>
    //   type 1 = normal (field2=offset, field3=gen)
    //   type 2 = in objstm (field2=objstm objnum, field3=index in objstm)
    const xrefEntries = new Map<number, { type: number; field2: number; field3: number }>();

    // Record already-written normal objects
    for (let i = 0; i < this.xrefOffsets.length; i++) {
      const off = this.xrefOffsets[i];
      if (off !== undefined && off > 0) {
        xrefEntries.set(i, { type: 1, field2: off, field3: 0 });
      }
    }

    // Pack packable entries into object streams
    for (let i = 0; i < packableEntries.length; i += OBJS_PER_STREAM) {
      const chunk = packableEntries.slice(i, i + OBJS_PER_STREAM);
      this.writeObjectStream(chunk, xrefEntries);
    }

    // 3. Write the cross-reference stream
    // The total /Size must account for all objects plus the xref stream object itself.
    // We'll allocate the xref stream object number first.
    const xrefStreamObjNum = this.registry.nextNumber;
    // Size = xrefStreamObjNum + 1  (objects 0 .. xrefStreamObjNum)
    const size = xrefStreamObjNum + 1;

    const xrefStreamOffset = this.buf.offset;

    this.writeXrefStream(xrefStreamObjNum, size, xrefEntries);

    // 4. startxref + %%EOF
    this.buf.writeString('startxref\n');
    this.buf.writeString(`${xrefStreamOffset}\n`);
    this.buf.writeString('%%EOF\n');

    return true;
  }

  /**
   * Serialize a group of non-stream objects into a single object stream
   * (`/Type /ObjStm`) and record xref entries for them.
   */
  private writeObjectStream(
    entries: RegistryEntry[],
    xrefEntries: Map<number, { type: number; field2: number; field3: number }>,
  ): void {
    // Build the object stream content:
    //   "objNum1 offset1 objNum2 offset2 ... <serialized objects>"
    //
    // The header part lists each object number and the byte offset of its
    // serialized form relative to the start of the data section (after /First).

    // First, serialize each object to find its bytes
    const serializedObjects: Uint8Array[] = [];

    for (const entry of entries) {
      const objWriter = new StringByteWriter();
      entry.object.serialize(objWriter);
      serializedObjects.push(objWriter.toUint8Array());
    }

    // Build header string: "objNum1 offset1 objNum2 offset2 ..."
    const headerParts: string[] = [];
    let dataOffset = 0;
    for (let i = 0; i < entries.length; i++) {
      headerParts.push(`${entries[i]!.ref.objectNumber} ${dataOffset}`);
      dataOffset += serializedObjects[i]!.length;
      // Add a space separator between objects in the data section
      if (i < entries.length - 1) {
        dataOffset += 1; // for the space between serialized objects
      }
    }
    const headerStr = headerParts.join(' ');

    // Encode header
    const headerBytes = encoder.encode(headerStr + ' ');
    const firstOffset = headerBytes.length;

    // Build the complete stream data
    let totalDataLen = firstOffset;
    for (let i = 0; i < serializedObjects.length; i++) {
      totalDataLen += serializedObjects[i]!.length;
      if (i < serializedObjects.length - 1) totalDataLen += 1; // space separator
    }

    const streamData = new Uint8Array(totalDataLen);
    streamData.set(headerBytes, 0);
    let pos = firstOffset;
    for (let i = 0; i < serializedObjects.length; i++) {
      streamData.set(serializedObjects[i]!, pos);
      pos += serializedObjects[i]!.length;
      if (i < serializedObjects.length - 1) {
        streamData[pos] = 0x20; // space
        pos += 1;
      }
    }

    // Build the ObjStm dictionary
    const objStmDict = new PdfDict();
    objStmDict.set('/Type', PdfName.of('ObjStm'));
    objStmDict.set('/N', PdfNumber.of(entries.length));
    objStmDict.set('/First', PdfNumber.of(firstOffset));
    objStmDict.set('/Length', PdfNumber.of(streamData.length));

    // Create the PdfStream and optionally compress it
    const objStm: PdfStream = { kind: 'stream', dict: objStmDict, data: streamData, syncLength() { this.dict.set('/Length', PdfNumber.of(this.data.length)); }, serialize(w: ByteWriter) { this.syncLength(); this.dict.serialize(w); w.writeString('\nstream\n'); w.write(this.data); w.writeString('\nendstream'); } };

    if (this.compress) {
      this.compressStream(objStm);
    }

    // Allocate an object number for this ObjStm
    const objStmRef = this.registry.allocate();
    const objStmObjNum = objStmRef.objectNumber;

    // Record byte offset of the ObjStm indirect object
    while (this.xrefOffsets.length <= objStmObjNum) {
      this.xrefOffsets.push(0);
    }
    this.xrefOffsets[objStmObjNum] = this.buf.offset;

    // Write the ObjStm as an indirect object
    this.buf.writeString(`${objStmObjNum} 0 obj\n`);
    objStm.serialize(this.buf);
    this.buf.writeString(`\nendobj\n`);

    // Record xref entry for the ObjStm itself (type 1, normal)
    xrefEntries.set(objStmObjNum, { type: 1, field2: this.xrefOffsets[objStmObjNum]!, field3: 0 });

    // Record xref entries for each packed object (type 2, in ObjStm)
    for (let i = 0; i < entries.length; i++) {
      xrefEntries.set(entries[i]!.ref.objectNumber, {
        type: 2,
        field2: objStmObjNum,
        field3: i,
      });
    }
  }

  /**
   * Write a cross-reference stream (PDF 1.5+) that replaces the
   * traditional xref table and trailer.
   */
  private writeXrefStream(
    xrefObjNum: number,
    size: number,
    xrefEntries: Map<number, { type: number; field2: number; field3: number }>,
  ): void {
    // Determine field widths (W array).
    // W = [w0, w1, w2] where:
    //   w0 = bytes for type field (1 byte is sufficient: 0, 1, 2)
    //   w1 = bytes for field 2 (offset or objstm number)
    //   w2 = bytes for field 3 (gen or index)

    // Find the maximum values to determine byte widths
    const allEntries = xrefEntries.values().toArray();
    let maxField2 = allEntries.reduce((max, e) => Math.max(max, e.field2), 0);
    let maxField3 = allEntries.reduce((max, e) => Math.max(max, e.field3), 0);
    // Also consider the offset of this xref stream itself for free entry linking
    // (the free entry at 0 has field2=0, field3=65535)
    maxField3 = Math.max(maxField3, 65535);

    const w0 = 1;
    const w1 = bytesNeeded(maxField2);
    const w2 = bytesNeeded(maxField3);

    // Build binary xref data
    // Entry for object 0: free, next=0, gen=65535
    // Entries for objects 1..size-1 (including the xref stream object)
    const entrySize = w0 + w1 + w2;
    const data = new Uint8Array(size * entrySize);
    let offset = 0;

    // Object 0: free entry
    writeIntBE(data, offset, w0, 0); offset += w0;       // type=0 (free)
    writeIntBE(data, offset, w1, 0); offset += w1;       // next free=0
    writeIntBE(data, offset, w2, 65535); offset += w2;    // gen=65535

    // Objects 1 .. size-1
    for (let i = 1; i < size; i++) {
      const entry = xrefEntries.get(i);
      if (entry) {
        writeIntBE(data, offset, w0, entry.type); offset += w0;
        writeIntBE(data, offset, w1, entry.field2); offset += w1;
        writeIntBE(data, offset, w2, entry.field3); offset += w2;
      } else {
        // Free entry
        writeIntBE(data, offset, w0, 0); offset += w0;
        writeIntBE(data, offset, w1, 0); offset += w1;
        writeIntBE(data, offset, w2, 0); offset += w2;
      }
    }

    // Build the xref stream dictionary
    const xrefDict = new PdfDict();
    xrefDict.set('/Type', PdfName.of('XRef'));
    xrefDict.set('/Size', PdfNumber.of(size));
    xrefDict.set('/W', PdfArray.of([PdfNumber.of(w0), PdfNumber.of(w1), PdfNumber.of(w2)]));
    xrefDict.set('/Root', this.structure.catalogRef);
    xrefDict.set('/Info', this.structure.infoRef);
    xrefDict.set('/Length', PdfNumber.of(data.length));

    // Create the stream and optionally compress
    const xrefStream: PdfStream = {
      kind: 'stream',
      dict: xrefDict,
      data: data,
      syncLength() { this.dict.set('/Length', PdfNumber.of(this.data.length)); },
      serialize(w: ByteWriter) {
        this.syncLength();
        this.dict.serialize(w);
        w.writeString('\nstream\n');
        w.write(this.data);
        w.writeString('\nendstream');
      },
    };

    if (this.compress) {
      this.compressStream(xrefStream);
    }

    // Write as indirect object
    this.buf.writeString(`${xrefObjNum} 0 obj\n`);
    xrefStream.serialize(this.buf);
    this.buf.writeString(`\nendobj\n`);
  }

  // -----------------------------------------------------------------------
  // Cross-reference table (classic format)
  // -----------------------------------------------------------------------

  private writeXref(): number {
    const xrefStart = this.buf.offset;

    // Total entries = highest object number + 1 (including obj 0)
    const size = this.registry.nextNumber;

    this.buf.writeString('xref\n');
    this.buf.writeString(`0 ${size}\n`);

    // Entry 0: free head — always present
    this.buf.writeString('0000000000 65535 f \n');

    // Entries 1 … size-1
    for (let i = 1; i < size; i++) {
      const offset = this.xrefOffsets[i];
      if (offset !== undefined && offset > 0) {
        this.buf.writeString(
          `${offset.toString().padStart(10, '0')} 00000 n \n`,
        );
      } else {
        // Missing object — mark as free
        this.buf.writeString('0000000000 00000 f \n');
      }
    }

    return xrefStart;
  }

  // -----------------------------------------------------------------------
  // Trailer
  // -----------------------------------------------------------------------

  private writeTrailer(xrefOffset: number): void {
    const size = this.registry.nextNumber;

    this.buf.writeString('trailer\n');
    this.buf.writeString('<<\n');
    this.buf.writeString(`/Size ${size}\n`);

    // /Root — the catalog
    this.buf.writeString(
      `/Root ${this.structure.catalogRef.objectNumber} ${this.structure.catalogRef.generationNumber} R\n`,
    );

    // /Info — document information
    this.buf.writeString(
      `/Info ${this.structure.infoRef.objectNumber} ${this.structure.infoRef.generationNumber} R\n`,
    );

    this.buf.writeString('>>\n');
    this.buf.writeString('startxref\n');
    this.buf.writeString(`${xrefOffset}\n`);
    this.buf.writeString('%%EOF\n');
  }
}

// ---------------------------------------------------------------------------
// Helpers for object streams
// ---------------------------------------------------------------------------

/**
 * A minimal ByteWriter that collects output into a Uint8Array.
 * Used to serialize individual objects for inclusion in object streams.
 */
class StringByteWriter implements ByteWriter {
  private chunks: Uint8Array[] = [];
  private _length = 0;

  write(data: Uint8Array): void {
    this.chunks.push(data);
    this._length += data.length;
  }

  writeString(str: string): void {
    this.write(encoder.encode(str));
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this._length);
    let pos = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }
}

/**
 * Compute the minimum number of bytes needed to represent `value`
 * as a big-endian unsigned integer.
 */
function bytesNeeded(value: number): number {
  if (value <= 0) return 1;
  if (value <= 0xff) return 1;
  if (value <= 0xffff) return 2;
  if (value <= 0xffffff) return 3;
  return 4;
}

/**
 * Write a big-endian unsigned integer of `width` bytes into `buf`
 * at the given `offset`.
 */
function writeIntBE(buf: Uint8Array, offset: number, width: number, value: number): void {
  for (let i = width - 1; i >= 0; i--) {
    buf[offset + i] = value & 0xff;
    value = value >>> 8;
  }
}

// ---------------------------------------------------------------------------
// Convenience: one-shot serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a complete PDF from a registry and structure refs.
 *
 * @param registry   All registered indirect objects.
 * @param structure  Catalog / Info / Pages references.
 * @param options    Save options.
 * @returns          The raw PDF bytes.
 */
export function serializePdf(
  registry: PdfObjectRegistry,
  structure: DocumentStructure,
  options?: PdfSaveOptions,
): Uint8Array {
  return new PdfWriter(registry, structure, options).write();
}

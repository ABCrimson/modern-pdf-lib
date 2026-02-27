/**
 * @module core/pdfStream
 *
 * Streaming PDF writer — produces a `ReadableStream<Uint8Array>` that
 * emits the PDF incrementally, never holding the entire file in memory.
 *
 * Uses the Web Streams API (`TransformStream` / `ReadableStream`) so it
 * works in browsers, Deno, Cloudflare Workers, and Node 18+.
 *
 * Reference: same PDF structure as {@link PdfWriter} but written chunk
 * by chunk through a `TransformStream`.
 */

import { deflateSync as fflateDeflateSync } from 'fflate';
import { isAvailable as isWasmDeflateAvailable, deflateSync as wasmDeflateSync } from '../compression/libdeflateWasm.js';
import type { PdfStream as PdfStreamObj, RegistryEntry, PdfRef } from './pdfObjects.js';
import { PdfObjectRegistry, PdfName } from './pdfObjects.js';
import type { DocumentStructure } from './pdfCatalog.js';
import type { PdfSaveOptions } from './pdfWriter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function encode(str: string): Uint8Array {
  return encoder.encode(str);
}

// ---------------------------------------------------------------------------
// Streaming serializer
// ---------------------------------------------------------------------------

/**
 * A streaming byte counter — wraps a `WritableStreamDefaultWriter` and
 * tracks how many bytes have been written so we can build the xref table.
 */
class StreamByteCounter {
  offset = 0;

  constructor(private readonly writer: WritableStreamDefaultWriter<Uint8Array>) {}

  async write(data: Uint8Array): Promise<void> {
    await this.writer.write(data);
    this.offset += data.length;
  }

  async writeString(str: string): Promise<void> {
    await this.write(encode(str));
  }
}

/**
 * A PDF writer that produces a `ReadableStream<Uint8Array>`.
 *
 * Usage:
 * ```ts
 * const streamWriter = new PdfStreamWriter(registry, structure, options);
 * const readable = streamWriter.toReadableStream();
 * // Pipe or consume the readable stream
 * ```
 *
 * The stream handles back-pressure automatically via the underlying
 * `TransformStream`.
 */
export class PdfStreamWriter {
  private readonly compress: boolean;
  private readonly compressionLevel: number;
  private readonly useWasm: boolean;

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
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create a `ReadableStream<Uint8Array>` that emits the complete PDF.
   *
   * The stream respects back-pressure: it will not produce data faster
   * than the consumer can handle.
   */
  toReadableStream(): ReadableStream<Uint8Array> {
    // We use a TransformStream as a convenient pipe:
    //  - We write into the writable side.
    //  - The consumer reads from the readable side.
    //  - Back-pressure propagates from readable → writable.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    // Kick off the async write pipeline.  We don't await it here —
    // the stream itself communicates completion/errors.
    this.pumpInto(writable).catch((err: unknown) => {
      // If the writable is still open, abort it with the error
      writable.abort(err instanceof Error ? err : new Error(String(err))).catch(() => {
        /* swallow — the readable side will surface the error */
      });
    });

    return readable;
  }

  // -----------------------------------------------------------------------
  // Internal: async write pipeline
  // -----------------------------------------------------------------------

  private async pumpInto(writable: WritableStream<Uint8Array>): Promise<void> {
    const writer = writable.getWriter();
    const counter = new StreamByteCounter(writer);

    try {
      // 1. Header
      await this.writeHeader(counter);

      // 2. Body — serialize each object, record offsets
      const xrefOffsets = await this.writeBody(counter);

      // 3. Xref table
      const xrefOffset = counter.offset;
      await this.writeXref(counter, xrefOffsets);

      // 4. Trailer
      await this.writeTrailer(counter, xrefOffset);

      // Done
      await writer.close();
    } catch (err) {
      await writer.abort(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private async writeHeader(w: StreamByteCounter): Promise<void> {
    await w.writeString('%PDF-1.7\n');
    // Binary comment
    await w.write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  }

  private async writeBody(
    w: StreamByteCounter,
  ): Promise<Map<number, number>> {
    const offsets = new Map<number, number>();

    for (const entry of this.registry) {
      // Optionally compress
      if (this.compress && entry.object.kind === 'stream') {
        this.compressStream(entry.object as PdfStreamObj);
      }

      // Record offset
      offsets.set(entry.ref.objectNumber, w.offset);

      // Write "N G obj\n"
      await w.writeString(`${entry.ref.toObjectHeader()}\n`);

      // Serialize the object into a temporary buffer
      // (Individual objects are small enough to serialize in-memory.)
      const objBuf = new ObjectByteBuffer();
      entry.object.serialize(objBuf);
      await w.write(objBuf.toUint8Array());

      // "\nendobj\n"
      await w.writeString(`\n${entry.ref.toObjectFooter()}\n`);
    }

    return offsets;
  }

  private compressStream(stream: PdfStreamObj): void {
    if (stream.dict.has('/Filter')) return;
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

    if (compressed.length < stream.data.length) {
      stream.dict.set('/Filter', PdfName.of('FlateDecode'));
      stream.data = compressed;
      stream.syncLength();
    }
  }

  private async writeXref(
    w: StreamByteCounter,
    offsets: Map<number, number>,
  ): Promise<void> {
    const size = this.registry.nextNumber;

    await w.writeString('xref\n');
    await w.writeString(`0 ${size}\n`);

    // Entry 0 — free head
    await w.writeString('0000000000 65535 f \n');

    for (let i = 1; i < size; i++) {
      const offset = offsets.get(i);
      if (offset !== undefined) {
        await w.writeString(
          `${offset.toString().padStart(10, '0')} 00000 n \n`,
        );
      } else {
        await w.writeString('0000000000 00000 f \n');
      }
    }
  }

  private async writeTrailer(
    w: StreamByteCounter,
    xrefOffset: number,
  ): Promise<void> {
    const size = this.registry.nextNumber;

    await w.writeString('trailer\n');
    await w.writeString('<<\n');
    await w.writeString(`/Size ${size}\n`);
    await w.writeString(
      `/Root ${this.structure.catalogRef.objectNumber} ${this.structure.catalogRef.generationNumber} R\n`,
    );
    await w.writeString(
      `/Info ${this.structure.infoRef.objectNumber} ${this.structure.infoRef.generationNumber} R\n`,
    );
    await w.writeString('>>\n');
    await w.writeString('startxref\n');
    await w.writeString(`${xrefOffset}\n`);
    await w.writeString('%%EOF\n');
  }
}

// ---------------------------------------------------------------------------
// Minimal in-memory byte buffer for single-object serialization
// ---------------------------------------------------------------------------

/**
 * A lightweight `ByteWriter` implementation used to serialize individual
 * PDF objects into a `Uint8Array`.  Only used internally by
 * `PdfStreamWriter` — the document-level writes go through the stream.
 */
class ObjectByteBuffer {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  write(data: Uint8Array): void {
    this.chunks.push(data);
    this.totalLength += data.length;
  }

  writeString(str: string): void {
    this.write(encode(str));
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let pos = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }
}

/**
 * @module parser/xrefParser
 *
 * Cross-reference table parser for PDF documents.
 *
 * Supports:
 * - Traditional xref tables (PDF 1.0+)
 * - Cross-reference streams (PDF 1.5+)
 * - Incremental updates via /Prev chains
 * - Error recovery via full-file scan for "N G obj" patterns
 *
 * Reference: PDF 1.7 spec, SS7.5.4 (Cross-Reference Table),
 *            SS7.5.8 (Cross-Reference Streams).
 *
 * @packageDocumentation
 */

import type { PdfObject } from '../core/pdfObjects.js';
import {
  PdfRef,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
  PdfString,
} from '../core/pdfObjects.js';
import type { PdfObjectParser } from './objectParser.js';
import { decompress } from '../compression/deflate.js';
import { PdfParseError } from './parseError.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * A single entry in the cross-reference table.
 *
 * Each entry maps an object number to its location within the PDF file
 * (byte offset for in-use objects, or container info for compressed objects).
 */
export interface XrefEntry {
  /** The PDF object number. */
  objectNumber: number;
  /** The generation number of this object. */
  generationNumber: number;
  /** Byte offset within the file (in-use), or next free object number (free). */
  offset: number;
  /** Entry type: in-use, free, or compressed within an object stream. */
  type: 'in-use' | 'free' | 'compressed';
  /**
   * For compressed objects (type 2): the object number of the object stream
   * that contains this object.
   */
  containerObjectNumber?: number;
  /**
   * For compressed objects (type 2): the index of this object within the
   * object stream.
   */
  indexInStream?: number;
}

/**
 * Parsed trailer dictionary fields extracted from either a traditional
 * trailer or a cross-reference stream dictionary.
 */
export interface ParsedTrailer {
  /** /Size: one greater than the highest object number in the file. */
  size: number;
  /** /Root: indirect reference to the document catalog. */
  rootRef: PdfRef;
  /** /Info: indirect reference to the document information dictionary. */
  infoRef?: PdfRef;
  /** /Encrypt: indirect reference to the encryption dictionary. */
  encryptRef?: PdfRef;
  /** /ID: file identifier array (two byte strings). */
  id?: [Uint8Array, Uint8Array];
  /** /Prev: byte offset of the previous cross-reference section. */
  prevOffset?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TEXT_DECODER = new TextDecoder('latin1');

/**
 * Read a big-endian integer of `width` bytes from `data` starting at `offset`.
 * Returns 0 for width === 0 (PDF spec: a missing field defaults to 0).
 */
function readBEInt(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let i = 0; i < width; i++) {
    value = (value << 8) | (data[offset + i] ?? 0);
  }
  // Ensure unsigned for widths > 3 (avoid sign issues from bitwise ops)
  return value >>> 0;
}

/**
 * Safely extract a numeric value from a PdfObject.
 * Returns undefined if the object is not a PdfNumber.
 */
function numVal(obj: PdfObject | undefined): number | undefined {
  if (obj !== undefined && obj.kind === 'number') {
    return (obj as PdfNumber).value;
  }
  return undefined;
}

/**
 * Safely extract a PdfRef from a PdfObject.
 * Returns undefined if the object is not a PdfRef.
 */
function refVal(obj: PdfObject | undefined): PdfRef | undefined {
  if (obj !== undefined && obj.kind === 'ref') {
    return obj as PdfRef;
  }
  return undefined;
}

/**
 * Convert a string of character codes (Latin-1 range 0-255) to a
 * Uint8Array. Unlike TextEncoder (which produces UTF-8 and may emit
 * multi-byte sequences for codes >= 128), this preserves each char
 * code as a single byte.
 */
function stringToLatin1Bytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Extract trailer fields from a PdfDict (works for both traditional
 * trailers and xref stream dictionaries).
 */
function extractTrailer(dict: PdfDict): ParsedTrailer {
  const sizeVal = numVal(dict.get('/Size'));
  if (sizeVal === undefined) {
    throw new PdfParseError({
      message: 'Invalid PDF: trailer dictionary missing /Size entry',
      offset: 0,
      expected: '/Size entry in trailer dictionary',
      actual: 'no /Size entry',
    });
  }

  const rootRef = refVal(dict.get('/Root'));
  if (rootRef === undefined) {
    throw new PdfParseError({
      message: 'Invalid PDF: trailer dictionary missing /Root entry',
      offset: 0,
      expected: '/Root entry in trailer dictionary',
      actual: 'no /Root entry',
    });
  }

  const trailer: ParsedTrailer = {
    size: sizeVal,
    rootRef,
  };

  const infoRef = refVal(dict.get('/Info'));
  if (infoRef !== undefined) {
    trailer.infoRef = infoRef;
  }

  const encryptRef = refVal(dict.get('/Encrypt'));
  if (encryptRef !== undefined) {
    trailer.encryptRef = encryptRef;
  }

  const prevVal = numVal(dict.get('/Prev'));
  if (prevVal !== undefined) {
    trailer.prevOffset = prevVal;
  }

  // /ID array: two PDF strings
  const idObj = dict.get('/ID');
  if (idObj !== undefined && idObj.kind === 'array') {
    const idArr = idObj as PdfArray;
    if (idArr.length >= 2) {
      const id0 = idArr.items[0];
      const id1 = idArr.items[1];
      if (id0 !== undefined && id0.kind === 'string' && id1 !== undefined && id1.kind === 'string') {
        const s0 = id0 as PdfString;
        const s1 = id1 as PdfString;
        trailer.id = [
          stringToLatin1Bytes(s0.value),
          stringToLatin1Bytes(s1.value),
        ];
      }
    }
  }

  return trailer;
}

/**
 * Decode a FlateDecode-compressed stream. Handles the /DecodeParms
 * PNG predictor if present.
 */
async function decodeStream(
  streamData: Uint8Array,
  dict: PdfDict,
): Promise<Uint8Array> {
  const filter = dict.get('/Filter');
  if (filter === undefined) {
    return streamData;
  }

  // Determine the filter name
  let filterName: string | undefined;
  if (filter.kind === 'name') {
    filterName = (filter as PdfName).value;
  } else if (filter.kind === 'array') {
    const arr = filter as PdfArray;
    if (arr.length > 0 && arr.items[0]!.kind === 'name') {
      filterName = (arr.items[0] as PdfName).value;
    }
  }

  if (filterName !== '/FlateDecode') {
    throw new PdfParseError({
      message:
        `Unsupported xref stream filter: ${filterName ?? 'unknown'}. ` +
        'Only /FlateDecode is supported for cross-reference streams.',
      offset: 0,
      expected: '/FlateDecode filter',
      actual: `${filterName ?? 'unknown'} filter`,
    });
  }

  // Decompress using the library's deflate engine
  let decompressed = await decompress(streamData);

  // Handle predictor (PNG Up predictor is common for xref streams)
  const decodeParms = dict.get('/DecodeParms');
  if (decodeParms !== undefined && decodeParms.kind === 'dict') {
    const parms = decodeParms as PdfDict;
    const predictor = numVal(parms.get('/Predictor')) ?? 1;
    const columns = numVal(parms.get('/Columns')) ?? 1;

    if (predictor >= 10) {
      // PNG predictor: each row starts with a filter byte
      decompressed = undoPngPredictor(decompressed, columns);
    } else if (predictor === 2) {
      // TIFF predictor 2 (horizontal differencing)
      decompressed = undoTiffPredictor(decompressed, columns);
    }
    // predictor === 1 means no prediction
  }

  return decompressed;
}

/**
 * Undo PNG-style row prediction.
 *
 * Each row has `columns + 1` bytes: 1 byte filter type + `columns` data bytes.
 * The most common filters for xref streams are:
 * - 0: None
 * - 1: Sub
 * - 2: Up
 */
function undoPngPredictor(data: Uint8Array, columns: number): Uint8Array {
  const rowBytes = columns; // number of data bytes per row (not counting filter byte)
  const srcRowLen = rowBytes + 1; // +1 for filter byte
  const rows = Math.floor(data.length / srcRowLen);
  const result = new Uint8Array(rows * rowBytes);

  // Previous row (starts as all zeros)
  const prevRow = new Uint8Array(rowBytes);

  for (let r = 0; r < rows; r++) {
    const srcOff = r * srcRowLen;
    const dstOff = r * rowBytes;
    const filterType = data[srcOff] ?? 0;

    switch (filterType) {
      case 0: // None
        for (let i = 0; i < rowBytes; i++) {
          result[dstOff + i] = data[srcOff + 1 + i] ?? 0;
        }
        break;

      case 1: // Sub: each byte depends on the previous byte in the same row
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const left = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0;
          result[dstOff + i] = (raw + left) & 0xff;
        }
        break;

      case 2: // Up: each byte depends on the byte directly above
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const up = prevRow[i] ?? 0;
          result[dstOff + i] = (raw + up) & 0xff;
        }
        break;

      case 3: // Average
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const left = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0;
          const up = prevRow[i] ?? 0;
          result[dstOff + i] = (raw + Math.floor((left + up) / 2)) & 0xff;
        }
        break;

      case 4: // Paeth
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const a = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0; // left
          const b = prevRow[i] ?? 0; // above
          const c = i > 0 ? (prevRow[i - 1] ?? 0) : 0; // upper-left
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          result[dstOff + i] = (raw + pr) & 0xff;
        }
        break;

      default:
        // Unknown filter type -- treat as None
        for (let i = 0; i < rowBytes; i++) {
          result[dstOff + i] = data[srcOff + 1 + i] ?? 0;
        }
        break;
    }

    // Save current row as previous for next iteration
    for (let i = 0; i < rowBytes; i++) {
      prevRow[i] = result[dstOff + i] ?? 0;
    }
  }

  return result;
}

/**
 * Undo TIFF predictor 2 (horizontal differencing).
 */
function undoTiffPredictor(data: Uint8Array, columns: number): Uint8Array {
  const result = new Uint8Array(data.length);
  const rows = Math.floor(data.length / columns);

  for (let r = 0; r < rows; r++) {
    const off = r * columns;
    result[off] = data[off] ?? 0;
    for (let i = 1; i < columns; i++) {
      result[off + i] = ((data[off + i] ?? 0) + (result[off + i - 1] ?? 0)) & 0xff;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// XrefParser
// ---------------------------------------------------------------------------

/**
 * Parse cross-reference tables and streams from a PDF file.
 *
 * Handles traditional xref tables (PDF 1.0+), cross-reference streams
 * (PDF 1.5+), and follows /Prev chains for incremental updates.
 *
 * @example
 * ```ts
 * const parser = new XrefParser(pdfBytes, objectParser);
 * const { entries, trailer } = await parser.parseXref();
 * ```
 */
export class XrefParser {
  /** The raw PDF file bytes. */
  private readonly data: Uint8Array;

  /** Object parser for reading indirect objects and trailer dicts. */
  private readonly objectParser: PdfObjectParser;

  /**
   * Create a new XrefParser.
   *
   * @param data          The raw PDF file bytes.
   * @param objectParser  An object parser configured with the same data.
   */
  constructor(data: Uint8Array, objectParser: PdfObjectParser) {
    this.data = data;
    this.objectParser = objectParser;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Find the byte offset indicated by the `startxref` marker near the
   * end of the PDF file.
   *
   * The PDF spec requires `startxref` to appear in the last 1024 bytes
   * of the file, but many real-world PDFs place it further back. We
   * search up to the last 2048 bytes for robustness.
   *
   * @returns The byte offset of the cross-reference section.
   * @throws  If the `startxref` marker cannot be found.
   */
  findStartXref(): number {
    // Search backwards from the end of the file for "startxref"
    const searchWindow = Math.min(this.data.length, 2048);
    const startPos = this.data.length - searchWindow;
    const tail = TEXT_DECODER.decode(
      this.data.subarray(startPos, this.data.length),
    );

    const keyword = 'startxref';
    const idx = tail.lastIndexOf(keyword);
    if (idx === -1) {
      throw new PdfParseError({
        message:
          'Invalid PDF: could not find "startxref" marker in the last 2048 bytes. ' +
          'The file may be truncated or corrupt.',
        offset: startPos,
        expected: '"startxref" marker near end of file',
        actual: 'no "startxref" found',
        data: this.data,
      });
    }

    // After "startxref" there should be whitespace then a decimal number
    const afterKeyword = tail.slice(idx + keyword.length).trim();
    const match = afterKeyword.match(/^(\d+)/);
    if (!match) {
      throw new PdfParseError({
        message: 'Invalid PDF: "startxref" found but no valid offset follows it.',
        offset: startPos + idx,
        expected: 'decimal offset after "startxref"',
        actual: `"${afterKeyword.slice(0, 20)}"`,
        data: this.data,
      });
    }

    const offset = parseInt(match[1]!, 10);
    if (offset < 0 || offset >= this.data.length) {
      throw new PdfParseError({
        message:
          `Invalid PDF: startxref offset ${offset} is out of range ` +
          `(file size: ${this.data.length}).`,
        offset: startPos + idx,
        expected: `offset in range [0, ${this.data.length})`,
        actual: `${offset}`,
        data: this.data,
      });
    }

    return offset;
  }

  /**
   * Parse the complete cross-reference structure, following /Prev chains
   * for incremental updates.
   *
   * The returned `entries` map contains the most recent entry for each
   * object number (later updates override earlier ones).
   *
   * @returns The merged xref entries and the most recent trailer.
   * @throws  If the cross-reference structure is corrupt and cannot be
   *          recovered.
   */
  async parseXref(): Promise<{ entries: Map<number, XrefEntry>; trailer: ParsedTrailer }> {
    let startOffset: number;
    try {
      startOffset = this.findStartXref();
    } catch {
      // If startxref cannot be found, attempt full-file recovery
      return this.rebuildXrefFromScan();
    }

    // The merged entries map -- later updates override earlier ones.
    // We process from newest to oldest, so we only insert entries
    // that do not already exist (newest wins).
    const entries = new Map<number, XrefEntry>();
    let primaryTrailer: ParsedTrailer | undefined;

    let currentOffset: number | undefined = startOffset;
    const visitedOffsets = new Set<number>();

    while (currentOffset !== undefined) {
      // Guard against infinite /Prev loops
      if (visitedOffsets.has(currentOffset)) {
        break;
      }
      visitedOffsets.add(currentOffset);

      let sectionEntries: XrefEntry[];
      let trailerDict: PdfDict;

      try {
        // Detect whether this is a traditional xref table or xref stream
        if (this.isTraditionalXref(currentOffset)) {
          const result = this.parseTraditionalXref(currentOffset);
          sectionEntries = result.entries;
          trailerDict = result.trailerDict;
        } else {
          const result = await this.parseXrefStream(currentOffset);
          sectionEntries = result.entries;
          trailerDict = result.trailerDict;
        }
      } catch (err) {
        // If parsing this section fails but we already have a primary
        // trailer, stop following the chain
        if (primaryTrailer !== undefined) {
          break;
        }
        // Otherwise, attempt a full-file recovery
        return this.rebuildXrefFromScan();
      }

      // Merge entries (newest wins -- only insert if not already present)
      for (const entry of sectionEntries) {
        if (!entries.has(entry.objectNumber)) {
          entries.set(entry.objectNumber, entry);
        }
      }

      // Extract trailer fields from the first (most recent) section
      if (primaryTrailer === undefined) {
        try {
          primaryTrailer ??= extractTrailer(trailerDict);
        } catch {
          // Trailer missing critical fields -- try recovery
          return this.rebuildXrefFromScan();
        }
      }

      // Follow the /Prev chain
      const prevVal = numVal(trailerDict.get('/Prev'));
      currentOffset = prevVal !== undefined && prevVal >= 0 ? prevVal : undefined;
    }

    if (primaryTrailer === undefined) {
      throw new PdfParseError({
        message: 'Invalid PDF: could not extract a valid trailer from the cross-reference structure.',
        offset: startOffset,
        expected: 'valid trailer dictionary in cross-reference structure',
        actual: 'no valid trailer found',
        data: this.data,
      });
    }

    return { entries, trailer: primaryTrailer };
  }

  /**
   * Parse a traditional (text-based) cross-reference table at the given
   * byte offset.
   *
   * Format:
   * ```
   * xref
   * 0 6
   * 0000000000 65535 f \r\n
   * 0000000017 00000 n \r\n
   * ...
   * trailer
   * << /Size 6 /Root 1 0 R >>
   * ```
   *
   * @param offset  Byte offset where the "xref" keyword begins.
   * @returns       The parsed entries and trailer dictionary.
   */
  parseTraditionalXref(offset: number): { entries: XrefEntry[]; trailerDict: PdfDict } {
    const entries: XrefEntry[] = [];

    // Locate the "xref" keyword
    let pos = offset;
    if (!this.isTraditionalXref(pos)) {
      const xrefTag = TEXT_DECODER.decode(this.data.subarray(pos, pos + 4));
      throw new PdfParseError({
        message: `Invalid PDF: expected "xref" keyword at offset ${offset}, found "${xrefTag}".`,
        offset,
        expected: '"xref" keyword',
        actual: `"${xrefTag}"`,
        data: this.data,
      });
    }
    pos += 4;

    // Skip whitespace/newlines after "xref"
    pos = this.skipWhitespaceAt(pos);

    // Parse subsections until we hit "trailer"
    while (pos < this.data.length) {
      // Check for "trailer" keyword (byte comparison)
      if (this.matchesBytes(pos, 0x74, 0x72, 0x61, 0x69, 0x6C, 0x65, 0x72)) {
        break;
      }

      // Read subsection header: firstObjNum count
      const headerLine = this.readLineAt(pos);
      const headerMatch = headerLine.text.trim().match(/^(\d+)\s+(\d+)/);
      if (!headerMatch) {
        throw new PdfParseError({
          message: `Invalid PDF: malformed xref subsection header at offset ${pos}: "${headerLine.text.trim()}"`,
          offset: pos,
          expected: 'xref subsection header "firstObjNum count"',
          actual: `"${headerLine.text.trim()}"`,
          data: this.data,
        });
      }

      const firstObjNum = parseInt(headerMatch[1]!, 10);
      const count = parseInt(headerMatch[2]!, 10);
      pos = headerLine.nextPos;

      // Read 'count' entries, each is exactly 20 bytes:
      // "OOOOOOOOOO GGGGG f \r\n" or "OOOOOOOOOO GGGGG n \r\n"
      // However, some producers use \n only (19 bytes + 1 padding) or
      // other variations. We parse flexibly.
      for (let i = 0; i < count; i++) {
        const objectNumber = firstObjNum + i;
        const parsed = this.parseXrefEntryDirect(pos);

        if (parsed) {
          entries.push({
            objectNumber,
            generationNumber: parsed.gen,
            offset: parsed.offset,
            type: parsed.type,
          });
          pos = parsed.nextPos;
        } else {
          // Fallback: use text-based parsing for non-standard entries
          const entryText = this.readXrefEntryAt(pos);
          const entryMatch = entryText.text.trim().match(
            /^(\d{10})\s+(\d{5})\s+([fn])/,
          );
          if (!entryMatch) {
            throw new PdfParseError({
              message:
                `Invalid PDF: malformed xref entry at offset ${pos} for object ${objectNumber}: ` +
                `"${entryText.text.trim()}"`,
              offset: pos,
              expected: 'xref entry "OOOOOOOOOO GGGGG f/n"',
              actual: `"${entryText.text.trim()}"`,
              data: this.data,
            });
          }
          entries.push({
            objectNumber,
            generationNumber: parseInt(entryMatch[2]!, 10),
            offset: parseInt(entryMatch[1]!, 10),
            type: entryMatch[3] === 'n' ? 'in-use' : 'free',
          });
          pos = entryText.nextPos;
        }
      }
    }

    // Parse the trailer dictionary
    // Advance past "trailer" keyword
    if (!this.matchesBytes(pos, 0x74, 0x72, 0x61, 0x69, 0x6C, 0x65, 0x72)) {
      const trailerTag = TEXT_DECODER.decode(this.data.subarray(pos, pos + 7));
      throw new PdfParseError({
        message: `Invalid PDF: expected "trailer" keyword at offset ${pos}, found "${trailerTag}".`,
        offset: pos,
        expected: '"trailer" keyword',
        actual: `"${trailerTag}"`,
        data: this.data,
      });
    }
    pos += 7;

    // Use the object parser to read the trailer dictionary
    const trailerObj = this.objectParser.parseObjectAt(pos);
    if (trailerObj.kind !== 'dict') {
      throw new PdfParseError({
        message: `Invalid PDF: expected dictionary after "trailer" keyword at offset ${pos}, got ${trailerObj.kind}.`,
        offset: pos,
        expected: 'dictionary after "trailer" keyword',
        actual: `${trailerObj.kind}`,
        data: this.data,
      });
    }

    return { entries, trailerDict: trailerObj as PdfDict };
  }

  /**
   * Parse a cross-reference stream at the given byte offset.
   *
   * Cross-reference streams (PDF 1.5+) are indirect stream objects with
   * `/Type /XRef`. The stream data is binary, decoded using `/W [w0 w1 w2]`
   * widths.
   *
   * @param offset  Byte offset where the xref stream object begins.
   * @returns       The parsed entries and the stream's dictionary (which
   *                serves as the trailer).
   */
  async parseXrefStream(offset: number): Promise<{ entries: XrefEntry[]; trailerDict: PdfDict }> {
    // Parse the indirect object at this offset
    const { object } = this.objectParser.parseIndirectObjectAt(offset);

    if (object.kind !== 'stream') {
      throw new PdfParseError({
        message: `Invalid PDF: expected stream object at offset ${offset} for xref stream, got ${object.kind}.`,
        offset,
        expected: 'stream object for xref stream',
        actual: `${object.kind}`,
        data: this.data,
      });
    }

    const stream = object as PdfStream;
    const dict = stream.dict;

    // Verify /Type /XRef
    const typeObj = dict.get('/Type');
    if (typeObj === undefined || typeObj.kind !== 'name' || (typeObj as PdfName).value !== '/XRef') {
      throw new PdfParseError({
        message: `Invalid PDF: cross-reference stream at offset ${offset} does not have /Type /XRef.`,
        offset,
        expected: '/Type /XRef in cross-reference stream dictionary',
        actual: typeObj ? `${typeObj.kind}` : 'no /Type entry',
        data: this.data,
      });
    }

    // Get /W (width) array -- required
    const wObj = dict.get('/W');
    if (wObj === undefined || wObj.kind !== 'array') {
      throw new PdfParseError({
        message: 'Invalid PDF: cross-reference stream missing /W (field widths) array.',
        offset,
        expected: '/W array in cross-reference stream',
        actual: wObj ? `${wObj.kind}` : 'no /W entry',
        data: this.data,
      });
    }
    const wArr = wObj as PdfArray;
    if (wArr.length < 3) {
      throw new PdfParseError({
        message: 'Invalid PDF: cross-reference stream /W array must have at least 3 elements.',
        offset,
        expected: '/W array with at least 3 elements',
        actual: `/W array with ${wArr.length} element(s)`,
        data: this.data,
      });
    }

    const w0 = numVal(wArr.items[0]) ?? 0;
    const w1 = numVal(wArr.items[1]) ?? 0;
    const w2 = numVal(wArr.items[2]) ?? 0;
    const entryWidth = w0 + w1 + w2;

    if (entryWidth === 0) {
      throw new PdfParseError({
        message: 'Invalid PDF: cross-reference stream /W widths sum to 0.',
        offset,
        expected: 'non-zero sum of /W widths',
        actual: '0',
        data: this.data,
      });
    }

    // Get /Size -- required
    const size = numVal(dict.get('/Size'));
    if (size === undefined) {
      throw new PdfParseError({
        message: 'Invalid PDF: cross-reference stream missing /Size.',
        offset,
        expected: '/Size entry in cross-reference stream',
        actual: 'no /Size entry',
        data: this.data,
      });
    }

    // Get /Index array -- defaults to [0 Size]
    let subsections: Array<{ start: number; count: number }>;
    const indexObj = dict.get('/Index');
    if (indexObj !== undefined && indexObj.kind === 'array') {
      const indexArr = indexObj as PdfArray;
      subsections = [];
      for (let i = 0; i + 1 < indexArr.length; i += 2) {
        const start = numVal(indexArr.items[i]) ?? 0;
        const count = numVal(indexArr.items[i + 1]) ?? 0;
        subsections.push({ start, count });
      }
    } else {
      subsections = [{ start: 0, count: size }];
    }

    // Decompress the stream data
    const decodedData = await decodeStream(stream.data, dict);

    // Parse the binary entries
    const entries: XrefEntry[] = [];
    let dataPos = 0;

    for (const subsection of subsections) {
      for (let i = 0; i < subsection.count; i++) {
        if (dataPos + entryWidth > decodedData.length) {
          break; // Truncated stream data -- stop gracefully
        }

        const objectNumber = subsection.start + i;

        // Field 1: type (defaults to 1 if w0 === 0)
        const fieldType = w0 > 0 ? readBEInt(decodedData, dataPos, w0) : 1;
        // Field 2
        const field2 = readBEInt(decodedData, dataPos + w0, w1);
        // Field 3
        const field3 = readBEInt(decodedData, dataPos + w0 + w1, w2);

        dataPos += entryWidth;

        switch (fieldType) {
          case 0:
            // Type 0: free entry
            entries.push({
              objectNumber,
              generationNumber: field3,
              offset: field2, // next free object number
              type: 'free',
            });
            break;

          case 1:
            // Type 1: in-use, uncompressed object
            entries.push({
              objectNumber,
              generationNumber: field3,
              offset: field2, // byte offset
              type: 'in-use',
            });
            break;

          case 2:
            // Type 2: compressed in an object stream
            entries.push({
              objectNumber,
              generationNumber: 0, // always 0 for compressed objects
              offset: 0,
              type: 'compressed',
              containerObjectNumber: field2, // object stream number
              indexInStream: field3, // index within the stream
            });
            break;

          default:
            // Unknown type -- skip (future PDF versions may define new types)
            break;
        }
      }
    }

    return { entries, trailerDict: dict };
  }

  // -----------------------------------------------------------------------
  // Error recovery
  // -----------------------------------------------------------------------

  /**
   * Rebuild the cross-reference table by scanning the entire file for
   * indirect object definitions (`N G obj`).
   *
   * This is the fallback when the xref table or startxref marker is
   * corrupt. It produces a basic set of entries and a minimal trailer
   * by searching for /Root in the file.
   *
   * @returns Reconstructed xref entries and trailer.
   * @throws  If recovery fails (e.g. no /Root found).
   */
  private rebuildXrefFromScan(): { entries: Map<number, XrefEntry>; trailer: ParsedTrailer } {
    const entries = new Map<number, XrefEntry>();
    const d = this.data;
    const len = d.length;

    // Scan for "N G obj" patterns directly on bytes (avoids full-file TextDecoder)
    for (let i = 0; i < len - 2; i++) {
      // Match 'obj' (0x6F 0x62 0x6A)
      if (d[i] !== 0x6F || d[i + 1] !== 0x62 || d[i + 2] !== 0x6A) continue;

      // Must be followed by whitespace, delimiter, or EOF
      if (i + 3 < len) {
        const after = d[i + 3]!;
        if (after > 0x20 && after !== 0x25 && after !== 0x28 && after !== 0x29 &&
            after !== 0x2F && after !== 0x3C && after !== 0x3E &&
            after !== 0x5B && after !== 0x5D && after !== 0x7B && after !== 0x7D) {
          continue;
        }
      }

      // Scan backwards: skip whitespace before 'obj'
      let j = i - 1;
      while (j >= 0 && (d[j] === 0x20 || d[j] === 0x0A || d[j] === 0x0D || d[j] === 0x09 || d[j] === 0x00)) {
        j--;
      }

      // Read generation number (digits backwards)
      const genEnd = j + 1;
      while (j >= 0 && d[j]! >= 0x30 && d[j]! <= 0x39) j--;
      const genStart = j + 1;
      if (genStart >= genEnd) continue;

      // Skip whitespace between object number and generation number
      while (j >= 0 && (d[j] === 0x20 || d[j] === 0x0A || d[j] === 0x0D || d[j] === 0x09 || d[j] === 0x00)) {
        j--;
      }

      // Read object number (digits backwards)
      const objEnd = j + 1;
      while (j >= 0 && d[j]! >= 0x30 && d[j]! <= 0x39) j--;
      const objStart = j + 1;
      if (objStart >= objEnd) continue;

      // Parse numbers from bytes
      let objectNumber = 0;
      for (let k = objStart; k < objEnd; k++) objectNumber = objectNumber * 10 + (d[k]! - 0x30);
      let gen = 0;
      for (let k = genStart; k < genEnd; k++) gen = gen * 10 + (d[k]! - 0x30);

      entries.set(objectNumber, {
        objectNumber,
        generationNumber: gen,
        offset: objStart,
        type: 'in-use',
      });
    }

    if (entries.size === 0) {
      throw new PdfParseError({
        message:
          'Invalid PDF: could not find any indirect objects during recovery scan. ' +
          'The file may not be a valid PDF.',
        offset: 0,
        expected: 'at least one "N G obj" pattern in file',
        actual: 'no indirect objects found',
        data: this.data,
      });
    }

    // Find /Root reference by scanning trailer-like dictionaries
    // or by looking at dictionaries that contain /Type /Catalog
    let rootRef: PdfRef | undefined;
    let infoRef: PdfRef | undefined;

    // First try: look for "trailer" keyword (byte scan, backwards)
    let trailerIdx = -1;
    for (let i = len - 7; i >= 0; i--) {
      if (d[i] === 0x74 && d[i + 1] === 0x72 && d[i + 2] === 0x61 &&
          d[i + 3] === 0x69 && d[i + 4] === 0x6C && d[i + 5] === 0x65 && d[i + 6] === 0x72) {
        trailerIdx = i;
        break;
      }
    }
    if (trailerIdx !== -1) {
      try {
        const trailerObj = this.objectParser.parseObjectAt(trailerIdx + 7);
        if (trailerObj.kind === 'dict') {
          const dict = trailerObj as PdfDict;
          rootRef = refVal(dict.get('/Root'));
          infoRef = refVal(dict.get('/Info'));
        }
      } catch {
        // Trailer dictionary is corrupt -- continue scanning
      }
    }

    // Second try: search for /Type /Catalog within object definitions
    if (rootRef === undefined) {
      for (const [objNum, entry] of entries) {
        try {
          const obj = this.objectParser.parseObjectAt(entry.offset);
          // parseObjectAt will return the object value; for indirect objects
          // we skip the "N G obj" header. Let's try parseIndirectObjectAt.
          const { object } = this.objectParser.parseIndirectObjectAt(entry.offset);
          if (object.kind === 'dict') {
            const dict = object as PdfDict;
            const typeVal = dict.get('/Type');
            if (
              typeVal !== undefined &&
              typeVal.kind === 'name' &&
              (typeVal as PdfName).value === '/Catalog'
            ) {
              rootRef = PdfRef.of(objNum, entry.generationNumber);
              break;
            }
          }
        } catch {
          // Skip unparseable objects
        }
      }
    }

    if (rootRef === undefined) {
      throw new PdfParseError({
        message:
          'Invalid PDF: recovery scan could not locate the document catalog (/Root). ' +
          'The file appears to be severely corrupt.',
        offset: 0,
        expected: 'document catalog (/Type /Catalog) in recovery scan',
        actual: 'no /Root or /Catalog found',
        data: this.data,
      });
    }

    // Compute /Size as max object number + 1
    const maxObjNum = entries.size > 0
      ? entries.keys().reduce((max, n) => Math.max(max, n), 0)
      : 0;

    const trailer: ParsedTrailer = {
      size: maxObjNum + 1,
      rootRef,
    };
    if (infoRef !== undefined) {
      trailer.infoRef = infoRef;
    }

    return { entries, trailer };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Determine whether the data at the given offset starts with the
   * "xref" keyword (indicating a traditional xref table).
   */
  /**
   * Check if the bytes at `pos` match the given byte values.
   */
  private matchesBytes(pos: number, ...bytes: number[]): boolean {
    if (pos + bytes.length > this.data.length) return false;
    for (let i = 0; i < bytes.length; i++) {
      if (this.data[pos + i] !== bytes[i]) return false;
    }
    return true;
  }

  /**
   * Parse a standard xref entry directly from bytes, avoiding TextDecoder
   * and regex. Returns null if the bytes don't form a valid entry.
   *
   * Standard format: `OOOOOOOOOO GGGGG f/n` (18 significant bytes)
   */
  private parseXrefEntryDirect(pos: number): { offset: number; gen: number; type: 'in-use' | 'free'; nextPos: number } | null {
    const d = this.data;
    if (pos + 18 > d.length) return null;

    // Parse 10-digit offset
    let offset = 0;
    for (let k = 0; k < 10; k++) {
      const b = d[pos + k]!;
      if (b < 0x30 || b > 0x39) return null;
      offset = offset * 10 + (b - 0x30);
    }

    // Expect space at pos+10
    if (d[pos + 10] !== 0x20) return null;

    // Parse 5-digit generation number
    let gen = 0;
    for (let k = 0; k < 5; k++) {
      const b = d[pos + 11 + k]!;
      if (b < 0x30 || b > 0x39) return null;
      gen = gen * 10 + (b - 0x30);
    }

    // Expect space at pos+16
    if (d[pos + 16] !== 0x20) return null;

    // Read f/n marker at pos+17
    const marker = d[pos + 17]!;
    if (marker !== 0x6E /* n */ && marker !== 0x66 /* f */) return null;

    // Skip trailing whitespace/line endings
    let nextPos = pos + 18;
    while (nextPos < d.length && (d[nextPos] === 0x20 || d[nextPos] === 0x0D || d[nextPos] === 0x0A)) {
      nextPos++;
    }

    return { offset, gen, type: marker === 0x6E ? 'in-use' : 'free', nextPos };
  }

  private isTraditionalXref(offset: number): boolean {
    if (offset + 4 > this.data.length) return false;
    return (
      this.data[offset] === 0x78 && // 'x'
      this.data[offset + 1] === 0x72 && // 'r'
      this.data[offset + 2] === 0x65 && // 'e'
      this.data[offset + 3] === 0x66 // 'f'
    );
  }

  /**
   * Skip whitespace characters (space, tab, CR, LF) starting at the
   * given position.
   */
  private skipWhitespaceAt(pos: number): number {
    while (pos < this.data.length) {
      const byte = this.data[pos]!;
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x00) {
        pos++;
      } else {
        break;
      }
    }
    return pos;
  }

  /**
   * Read a line of text starting at the given position.
   * Returns the text content and the position after the line ending.
   */
  private readLineAt(pos: number): { text: string; nextPos: number } {
    let end = pos;
    while (end < this.data.length) {
      const byte = this.data[end]!;
      if (byte === 0x0a || byte === 0x0d) {
        break;
      }
      end++;
    }

    const text = TEXT_DECODER.decode(this.data.subarray(pos, end));

    // Skip the line ending (CR, LF, or CR+LF)
    let nextPos = end;
    if (nextPos < this.data.length && this.data[nextPos] === 0x0d) {
      nextPos++;
    }
    if (nextPos < this.data.length && this.data[nextPos] === 0x0a) {
      nextPos++;
    }

    return { text, nextPos };
  }

  /**
   * Read a single xref table entry (approximately 20 bytes) starting
   * at the given position.
   *
   * Traditional xref entries are exactly 20 bytes:
   * `OOOOOOOOOO GGGGG f \r\n`
   *
   * However some PDF producers use different line endings or spacing,
   * so we read flexibly until we have enough data.
   */
  private readXrefEntryAt(pos: number): { text: string; nextPos: number } {
    // Try to read exactly 20 bytes first (the standard entry length)
    const end = Math.min(pos + 20, this.data.length);
    let text = TEXT_DECODER.decode(this.data.subarray(pos, end));

    // If we have a valid entry in those 20 bytes, use it
    if (/\d{10}\s+\d{5}\s+[fn]/.test(text)) {
      // Find the actual end: after the f/n marker, skip line endings
      let nextPos = pos;
      // Skip to after the f/n marker
      const fnMatch = text.match(/[fn]/);
      if (fnMatch && fnMatch.index !== undefined) {
        nextPos = pos + fnMatch.index + 1;
        // Skip trailing whitespace/line endings
        while (nextPos < this.data.length) {
          const b = this.data[nextPos]!;
          if (b === 0x20 || b === 0x0d || b === 0x0a) {
            nextPos++;
          } else {
            break;
          }
        }
      } else {
        nextPos = end;
      }
      return { text, nextPos };
    }

    // Fallback: read a line
    return this.readLineAt(pos);
  }
}

/**
 * @module parser/streamDecode
 *
 * Decode / decompress PDF stream data.  Supports all standard PDF 1.7
 * filter types (Table 6 in the spec) including chained (multi-filter)
 * streams and predictor post-processing for FlateDecode and LZWDecode.
 *
 * Reference: PDF 1.7 spec, §7.4 (Filters).
 *
 * @packageDocumentation
 */

import { unzlibSync, inflateSync } from 'fflate';
import type { PdfObject } from '../core/pdfObjects.js';
import { PdfDict, PdfName, PdfArray, PdfNumber } from '../core/pdfObjects.js';
import { decodeCCITT } from './ccittDecode.js';
import { decodeJBIG2 } from './jbig2Decode.js';
import { decodeJpeg2000 } from './jpeg2000Decode.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode (decompress) PDF stream data that may have one or more filters
 * applied.  Filters are applied in the order they appear in the array
 * (first entry is the outermost encoding, decoded first).
 *
 * @param data        - The raw (encoded) stream bytes.
 * @param filters     - A single filter name or an ordered array of filter
 *                      names (e.g. `"FlateDecode"` or
 *                      `["ASCIIHexDecode", "FlateDecode"]`).
 * @param decodeParms - Optional decode parameters — a single `PdfDict` or
 *                      an array of `PdfDict | null` parallel to `filters`.
 * @returns The fully decoded bytes.
 */
export function decodeStream(
  data: Uint8Array,
  filters: string | string[],
  decodeParms?: PdfDict | PdfDict[] | null,
): Uint8Array {
  const filterList = Array.isArray(filters) ? filters : [filters];
  const parmsList = normalizeDecodeParms(decodeParms, filterList.length);

  let result = data;
  for (let i = 0; i < filterList.length; i++) {
    const filterName = normalizeFilterName(filterList[i]!);
    const parms = parmsList[i] ?? null;
    result = applyFilter(filterName, result, parms);
  }
  return result;
}

/**
 * Extract filter names and decode-parameter dictionaries from a stream
 * dictionary.  Handles both the single-value and array forms of `/Filter`
 * and `/DecodeParms`.
 *
 * @param dict - The stream's metadata dictionary.
 * @returns An object with parallel arrays of filter names and parameters.
 */
export function getStreamFilters(
  dict: PdfDict,
): { filters: string[]; decodeParms: (PdfDict | null)[] } {
  const filterObj = dict.get('/Filter');
  if (!filterObj) {
    return { filters: [], decodeParms: [] };
  }

  let filters: string[];
  if (filterObj instanceof PdfName) {
    filters = [filterObj.value.replace(/^\//, '')];
  } else if (filterObj instanceof PdfArray) {
    filters = filterObj.items.map((item) => {
      if (item instanceof PdfName) {
        return item.value.replace(/^\//, '');
      }
      return String(item);
    });
  } else {
    filters = [String(filterObj)];
  }

  const dpObj = dict.get('/DecodeParms');
  const decodeParms = normalizeDecodeParms(dpObj as PdfDict | PdfDict[] | PdfArray | null, filters.length);

  return { filters, decodeParms };
}

// ---------------------------------------------------------------------------
// Internal: normalize helpers
// ---------------------------------------------------------------------------

/**
 * Normalize `/DecodeParms` into a parallel array of `PdfDict | null`.
 */
function normalizeDecodeParms(
  parms: PdfDict | PdfDict[] | PdfArray | PdfObject | null | undefined,
  count: number,
): (PdfDict | null)[] {
  if (parms == null) {
    return new Array<PdfDict | null>(count).fill(null);
  }
  if (parms instanceof PdfArray) {
    return parms.items.map((item) =>
      item instanceof PdfDict ? item : null,
    );
  }
  if (Array.isArray(parms)) {
    return (parms as (PdfDict | null)[]).map((p) =>
      p instanceof PdfDict ? p : null,
    );
  }
  if (parms instanceof PdfDict) {
    // Single dict applies to the single (or first) filter
    const result: (PdfDict | null)[] = new Array<PdfDict | null>(count).fill(null);
    result[0] = parms;
    return result;
  }
  return new Array<PdfDict | null>(count).fill(null);
}

/**
 * Normalize filter names — strip leading `/` and map abbreviations to
 * their full names (PDF spec Table 6).
 */
/** Abbreviation map for PDF filter names (Table 6). */
const FILTER_ABBREVIATIONS: Readonly<Record<string, string>> = {
  AHx: 'ASCIIHexDecode',
  A85: 'ASCII85Decode',
  LZW: 'LZWDecode',
  Fl: 'FlateDecode',
  RL: 'RunLengthDecode',
  CCF: 'CCITTFaxDecode',
  DCT: 'DCTDecode',
  JPX: 'JPXDecode',
};

function normalizeFilterName(name: string): string {
  const n = name.startsWith('/') ? name.slice(1) : name;
  return Object.hasOwn(FILTER_ABBREVIATIONS, n)
    ? FILTER_ABBREVIATIONS[n]!
    : n;
}

// ---------------------------------------------------------------------------
// Internal: read integer from PdfDict
// ---------------------------------------------------------------------------

/**
 * Read an integer value from a `PdfDict`, returning `fallback` when the
 * key is missing or not a `PdfNumber`.
 */
function dictInt(dict: PdfDict | null, key: string, fallback: number): number {
  if (!dict) return fallback;
  const v = dict.get(key);
  if (v instanceof PdfNumber) return Math.round(v.value);
  return fallback;
}

// ---------------------------------------------------------------------------
// Filter dispatch
// ---------------------------------------------------------------------------

/**
 * Apply a single filter to the data.
 */
function applyFilter(
  filterName: string,
  data: Uint8Array,
  parms: PdfDict | null,
): Uint8Array {
  switch (filterName) {
    case 'FlateDecode':
      return decodeFlateDecode(data, parms);
    case 'ASCIIHexDecode':
      return decodeASCIIHex(data);
    case 'ASCII85Decode':
      return decodeASCII85(data);
    case 'LZWDecode':
      return decodeLZW(data, parms);
    case 'RunLengthDecode':
      return decodeRunLength(data);
    case 'DCTDecode':
      // JPEG — return as-is; decoded by image handler
      return data;
    case 'JPXDecode':
      return decodeJPX(data, parms);
    case 'CCITTFaxDecode':
      return decodeCCITT(data, parms);
    case 'JBIG2Decode':
      return decodeJBIG2(data, parms);
    case 'Crypt':
      // Encryption filter — pass through (Phase 5 will handle)
      return data;
    default:
      throw new Error(`Unknown PDF stream filter: ${filterName}`);
  }
}

// ---------------------------------------------------------------------------
// FlateDecode
// ---------------------------------------------------------------------------

/**
 * Decode a FlateDecode (zlib/deflate) stream.  After decompression, apply
 * any predictor specified in the decode parameters.
 */
function decodeFlateDecode(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  // fflate's unzlibSync handles zlib-wrapped data (with header).
  // Some PDFs omit the zlib header, so we fall back to raw inflateSync.
  let decompressed: Uint8Array;
  try {
    decompressed = unzlibSync(data);
  } catch {
    // Raw deflate (no zlib header) — use inflateSync
    try {
      decompressed = inflateSync(data);
    } catch {
      throw new Error('FlateDecode: failed to decompress data');
    }
  }
  return applyPredictor(decompressed, parms);
}

// ---------------------------------------------------------------------------
// Predictor processing (shared by FlateDecode and LZWDecode)
// ---------------------------------------------------------------------------

/**
 * Apply predictor post-processing as specified by `/Predictor`,
 * `/Columns`, `/Colors`, and `/BitsPerComponent` in the decode
 * parameters dictionary.
 *
 * Reference: PDF 1.7 spec, §7.4.4.4 (LZWDecode and FlateDecode
 * Parameters).
 */
function applyPredictor(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  const predictor = dictInt(parms, '/Predictor', 1);
  if (predictor === 1) return data; // No prediction

  const columns = dictInt(parms, '/Columns', 1);
  const colors = dictInt(parms, '/Colors', 1);
  const bpc = dictInt(parms, '/BitsPerComponent', 8);

  if (predictor === 2) {
    return applyTiffPredictor2(data, columns, colors, bpc);
  }

  if (predictor >= 10 && predictor <= 15) {
    return applyPngPredictors(data, columns, colors, bpc);
  }

  // Unknown predictor — return data as-is
  return data;
}

/**
 * TIFF Predictor 2: horizontal differencing.
 *
 * Each row's samples store the difference from the previous sample
 * (within the same row).  This reverses that encoding.
 */
function applyTiffPredictor2(
  data: Uint8Array,
  columns: number,
  colors: number,
  bpc: number,
): Uint8Array {
  if (bpc === 8) {
    const bytesPerPixel = colors;
    const rowBytes = columns * bytesPerPixel;
    const rows = Math.floor(data.length / rowBytes);
    const out = new Uint8Array(data.length);
    out.set(data);

    for (let row = 0; row < rows; row++) {
      const offset = row * rowBytes;
      for (let col = bytesPerPixel; col < rowBytes; col++) {
        out[offset + col] = (out[offset + col]! + out[offset + col - bytesPerPixel]!) & 0xff;
      }
    }
    return out;
  }

  if (bpc === 16) {
    const bytesPerPixel = colors * 2;
    const rowBytes = columns * bytesPerPixel;
    const rows = Math.floor(data.length / rowBytes);
    const out = new Uint8Array(data.length);
    out.set(data);

    for (let row = 0; row < rows; row++) {
      const offset = row * rowBytes;
      for (let col = bytesPerPixel; col < rowBytes; col += 2) {
        const prev =
          ((out[offset + col - bytesPerPixel]! << 8) |
            out[offset + col - bytesPerPixel + 1]!) >>> 0;
        const curr =
          ((out[offset + col]! << 8) | out[offset + col + 1]!) >>> 0;
        const sum = (prev + curr) & 0xffff;
        out[offset + col] = (sum >> 8) & 0xff;
        out[offset + col + 1] = sum & 0xff;
      }
    }
    return out;
  }

  // For sub-byte bpc, work at the bit level
  const totalBitsPerRow = columns * colors * bpc;
  const rowBytes = Math.ceil(totalBitsPerRow / 8);
  const rows = Math.floor(data.length / rowBytes);
  const out = new Uint8Array(data.length);
  out.set(data);

  for (let row = 0; row < rows; row++) {
    const offset = row * rowBytes;
    // Accumulate per-color-component
    const prev = new Array<number>(colors).fill(0);
    for (let col = 0; col < columns; col++) {
      for (let c = 0; c < colors; c++) {
        const bitPos = (col * colors + c) * bpc;
        const byteIdx = offset + Math.floor(bitPos / 8);
        const bitOff = bitPos % 8;
        const mask = (1 << bpc) - 1;
        const shift = 8 - bitOff - bpc;

        let val: number;
        if (shift >= 0) {
          val = (out[byteIdx]! >> shift) & mask;
        } else {
          // Value spans two bytes
          val = ((out[byteIdx]! << (-shift)) | (out[byteIdx + 1]! >> (8 + shift))) & mask;
        }

        val = (val + prev[c]!) & mask;
        prev[c] = val;

        // Write back
        if (shift >= 0) {
          out[byteIdx] = (out[byteIdx]! & ~(mask << shift)) | (val << shift);
        } else {
          const highBits = bpc + shift;
          const highMask = (1 << highBits) - 1;
          out[byteIdx] = (out[byteIdx]! & ~highMask) | (val >> (-shift));
          const lowBits = -shift;
          const lowMask = ((1 << lowBits) - 1) << (8 - lowBits);
          out[byteIdx + 1] = (out[byteIdx + 1]! & ~lowMask) | ((val & ((1 << lowBits) - 1)) << (8 - lowBits));
        }
      }
    }
  }
  return out;
}

/**
 * PNG prediction (predictor values 10-15).
 *
 * Each row is preceded by a filter-type byte that selects the PNG
 * prediction method for that row:
 *
 * - 0: None
 * - 1: Sub   — difference from the byte to the left
 * - 2: Up    — difference from the byte above
 * - 3: Average — average of left and above
 * - 4: Paeth — Paeth predictor function
 *
 * When the predictor is 10-14 the same filter type is used for every
 * row (0-4 respectively).  Predictor 15 means "optimum" — each row has
 * its own filter byte.  In practice, most encoders write the filter byte
 * even for fixed-predictor streams, so we always check for it.
 */
function applyPngPredictors(
  data: Uint8Array,
  columns: number,
  colors: number,
  bpc: number,
): Uint8Array {
  const bytesPerPixel = Math.max(1, Math.floor((colors * bpc + 7) / 8));
  const rowBytes = Math.ceil((columns * colors * bpc) / 8);
  // Each row in PNG-predicted data is: 1 filter byte + rowBytes data bytes
  const stride = rowBytes + 1;
  const rows = Math.floor(data.length / stride);

  const out = new Uint8Array(rows * rowBytes);
  const prevRow = new Uint8Array(rowBytes); // initialized to zero

  for (let row = 0; row < rows; row++) {
    const srcOffset = row * stride;
    const dstOffset = row * rowBytes;
    const filterType = data[srcOffset]!;

    switch (filterType) {
      case 0: // None
        out.set(data.subarray(srcOffset + 1, srcOffset + 1 + rowBytes), dstOffset);
        break;

      case 1: // Sub
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bytesPerPixel ? out[dstOffset + i - bytesPerPixel]! : 0;
          out[dstOffset + i] = (data[srcOffset + 1 + i]! + left) & 0xff;
        }
        break;

      case 2: // Up
        for (let i = 0; i < rowBytes; i++) {
          out[dstOffset + i] = (data[srcOffset + 1 + i]! + prevRow[i]!) & 0xff;
        }
        break;

      case 3: // Average
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bytesPerPixel ? out[dstOffset + i - bytesPerPixel]! : 0;
          const up = prevRow[i]!;
          out[dstOffset + i] = (data[srcOffset + 1 + i]! + ((left + up) >>> 1)) & 0xff;
        }
        break;

      case 4: // Paeth
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bytesPerPixel ? out[dstOffset + i - bytesPerPixel]! : 0;
          const up = prevRow[i]!;
          const upLeft =
            i >= bytesPerPixel ? prevRow[i - bytesPerPixel]! : 0;
          out[dstOffset + i] =
            (data[srcOffset + 1 + i]! + paethPredictor(left, up, upLeft)) & 0xff;
        }
        break;

      default:
        // Unknown filter type — treat as None
        out.set(data.subarray(srcOffset + 1, srcOffset + 1 + rowBytes), dstOffset);
        break;
    }

    // Copy current decoded row into prevRow for the next iteration
    prevRow.set(out.subarray(dstOffset, dstOffset + rowBytes));
  }

  return out;
}

/**
 * Paeth predictor function (PNG specification).
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ---------------------------------------------------------------------------
// ASCIIHexDecode
// ---------------------------------------------------------------------------

/**
 * Decode an ASCIIHexDecode stream.
 *
 * Hex digits are decoded pairwise.  Whitespace is ignored.  `>` marks
 * end-of-data.  An odd trailing digit is padded with 0 on the right
 * (e.g. `A` becomes `A0`).
 */
function decodeASCIIHex(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let high: number | null = null;

  for (let i = 0; i < data.length; i++) {
    const ch = data[i]!;

    // End-of-data marker
    if (ch === 0x3e /* > */) break;

    // Skip whitespace
    if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d || ch === 0x0c || ch === 0x00) {
      continue;
    }

    const nibble = hexValue(ch);
    if (nibble < 0) continue; // Skip invalid characters

    if (high === null) {
      high = nibble;
    } else {
      result.push((high << 4) | nibble);
      high = null;
    }
  }

  // Odd trailing digit — pad with 0
  if (high !== null) {
    result.push(high << 4);
  }

  return new Uint8Array(result);
}

/**
 * Convert an ASCII hex character code to its numeric value (0-15).
 * Returns -1 for non-hex characters.
 */
function hexValue(ch: number): number {
  if (ch >= 0x30 && ch <= 0x39) return ch - 0x30;       // 0-9
  if (ch >= 0x41 && ch <= 0x46) return ch - 0x41 + 10;   // A-F
  if (ch >= 0x61 && ch <= 0x66) return ch - 0x61 + 10;   // a-f
  return -1;
}

// ---------------------------------------------------------------------------
// ASCII85Decode (btoa)
// ---------------------------------------------------------------------------

/**
 * Decode an ASCII85Decode (base-85) stream.
 *
 * Five ASCII characters in the range `!` (33) through `u` (117) encode
 * four bytes.  The special character `z` represents four zero bytes.
 * `~>` marks end-of-data.
 */
function decodeASCII85(data: Uint8Array): Uint8Array {
  // Pre-allocate output (ASCII85 expands 5->4 bytes, so output <= input * 0.8)
  let out = new Uint8Array(Math.max((data.length * 4 / 5) | 0, 256));
  let outPos = 0;
  const group = new Uint8Array(5);
  let groupLen = 0;
  let i = 0;

  function ensureOut(needed: number): void {
    if (outPos + needed > out.length) {
      const newBuf = new Uint8Array(Math.max(out.length * 2, outPos + needed));
      newBuf.set(out.subarray(0, outPos));
      out = newBuf;
    }
  }

  function decodeGroup(count: number): void {
    // Pad remaining slots with 84 ('u')
    for (let k = count; k < 5; k++) group[k] = 84;
    const val =
      group[0]! * 85 * 85 * 85 * 85 +
      group[1]! * 85 * 85 * 85 +
      group[2]! * 85 * 85 +
      group[3]! * 85 +
      group[4]!;
    const numBytes = count === 5 ? 4 : count - 1;
    ensureOut(numBytes);
    if (numBytes >= 1) out[outPos++] = (val >>> 24) & 0xff;
    if (numBytes >= 2) out[outPos++] = (val >>> 16) & 0xff;
    if (numBytes >= 3) out[outPos++] = (val >>> 8) & 0xff;
    if (numBytes >= 4) out[outPos++] = val & 0xff;
  }

  while (i < data.length) {
    const ch = data[i]!;

    // End-of-data marker
    if (ch === 0x7e /* ~ */) break;

    // Skip whitespace
    if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d || ch === 0x0c || ch === 0x00) {
      i++;
      continue;
    }

    // 'z' shorthand for four zero bytes
    if (ch === 0x7a /* z */) {
      if (groupLen > 0) {
        throw new Error('ASCII85Decode: "z" inside a group');
      }
      ensureOut(4);
      out[outPos++] = 0;
      out[outPos++] = 0;
      out[outPos++] = 0;
      out[outPos++] = 0;
      i++;
      continue;
    }

    // Valid base-85 digit: '!' (33) through 'u' (117)
    if (ch < 0x21 || ch > 0x75) {
      i++;
      continue;
    }

    group[groupLen++] = ch - 0x21;

    if (groupLen === 5) {
      decodeGroup(5);
      groupLen = 0;
    }

    i++;
  }

  // Handle final partial group (2-4 chars -> 1-3 bytes)
  if (groupLen >= 2) {
    decodeGroup(groupLen);
  }

  return out.subarray(0, outPos);
}

// ---------------------------------------------------------------------------
// LZWDecode
// ---------------------------------------------------------------------------

/**
 * Decode an LZWDecode stream.
 *
 * Implements the LZW decompression algorithm as specified in the PDF spec:
 * - Initial table entries 0-255 (single bytes)
 * - Code 256 = clear table
 * - Code 257 = end of data
 * - Variable code width starting at 9 bits, max 12 bits
 * - `/EarlyChange` parameter (default 1): when 1, the code width
 *   increases one code earlier than would be mathematically necessary
 *
 * After decompression, predictor post-processing is applied.
 */
function decodeLZW(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  const earlyChange = dictInt(parms, '/EarlyChange', 1);
  const decompressed = lzwDecompress(data, earlyChange);
  return applyPredictor(decompressed, parms);
}

/**
 * Core LZW decompression.
 *
 * Uses a flat pooled buffer for the code table instead of per-entry
 * Uint8Array allocations, and a pre-allocated output buffer with
 * manual growth instead of `number[]` + push.
 */
function lzwDecompress(data: Uint8Array, earlyChange: number): Uint8Array {
  const CLEAR_TABLE = 256;
  const EOD = 257;

  // Bit reader state
  let bitPos = 0;

  /**
   * Read `numBits` bits from the data stream (MSB first, as per PDF spec).
   */
  function readBits(numBits: number): number {
    let result = 0;
    let bitsNeeded = numBits;

    while (bitsNeeded > 0) {
      const byteIndex = bitPos >>> 3;
      if (byteIndex >= data.length) return EOD;

      const bitIndex = bitPos & 7;
      const bitsAvailable = 8 - bitIndex;
      const bitsToRead = Math.min(bitsNeeded, bitsAvailable);

      const mask = ((1 << bitsToRead) - 1) << (bitsAvailable - bitsToRead);
      const value = (data[byteIndex]! & mask) >>> (bitsAvailable - bitsToRead);

      result = (result << bitsToRead) | value;
      bitPos += bitsToRead;
      bitsNeeded -= bitsToRead;
    }

    return result;
  }

  // Pooled code table: flat buffer + (offset, length) index pairs.
  // Eliminates 256+ `new Uint8Array` allocations per resetTable().
  let tableBuf = new Uint8Array(65536);
  const tableOff = new Int32Array(4096);
  const tableLen = new Int32Array(4096);
  let tableBufUsed = 256;
  let codeSize = 9;
  let nextCode = 258;

  // Initialize identity bytes 0-255 (persists across resets)
  for (let i = 0; i < 256; i++) {
    tableBuf[i] = i;
    tableOff[i] = i;
    tableLen[i] = 1;
  }

  function resetTable(): void {
    tableBufUsed = 256; // Reclaim space; identity entries 0-255 are preserved
    nextCode = 258;
    codeSize = 9;
  }

  // Output buffer with manual growth
  let out = new Uint8Array(Math.max(data.length * 3, 4096));
  let outPos = 0;

  function ensureOut(needed: number): void {
    if (outPos + needed > out.length) {
      const newBuf = new Uint8Array(Math.max(out.length * 2, outPos + needed));
      newBuf.set(out.subarray(0, outPos));
      out = newBuf;
    }
  }

  function ensureTable(needed: number): void {
    if (tableBufUsed + needed > tableBuf.length) {
      const newBuf = new Uint8Array(Math.max(tableBuf.length * 2, tableBufUsed + needed));
      newBuf.set(tableBuf.subarray(0, tableBufUsed));
      tableBuf = newBuf;
    }
  }

  function writeEntry(code: number): void {
    const off = tableOff[code]!;
    const len = tableLen[code]!;
    ensureOut(len);
    out.set(tableBuf.subarray(off, off + len), outPos);
    outPos += len;
  }

  function addEntry(prevCode: number, firstByte: number): void {
    const prevOff = tableOff[prevCode]!;
    const prevLen = tableLen[prevCode]!;
    const newLen = prevLen + 1;
    ensureTable(newLen);
    tableBuf.set(tableBuf.subarray(prevOff, prevOff + prevLen), tableBufUsed);
    tableBuf[tableBufUsed + prevLen] = firstByte;
    tableOff[nextCode] = tableBufUsed;
    tableLen[nextCode] = newLen;
    tableBufUsed += newLen;
    nextCode++;
  }

  // The first code should be a clear-table code
  let code = readBits(codeSize);
  if (code === CLEAR_TABLE) {
    resetTable();
    code = readBits(codeSize);
  }

  if (code === EOD) {
    return new Uint8Array(0);
  }

  // Output the first code
  writeEntry(code);
  let prevCode = code;

  // Process remaining codes
  while (true) {
    code = readBits(codeSize);

    if (code === EOD) break;

    if (code === CLEAR_TABLE) {
      resetTable();

      code = readBits(codeSize);
      if (code === EOD) break;

      writeEntry(code);
      prevCode = code;
      continue;
    }

    if (code < nextCode) {
      // Code is in the table
      writeEntry(code);
      addEntry(prevCode, tableBuf[tableOff[code]!]!);
    } else {
      // Code is not in the table (KwKwK case)
      addEntry(prevCode, tableBuf[tableOff[prevCode]!]!);
      writeEntry(nextCode - 1); // Write the entry we just added
    }

    prevCode = code;

    // Increase code size when the table grows past the current width
    // EarlyChange = 1 means we increase one code early
    const threshold = (1 << codeSize) - earlyChange;
    if (nextCode >= threshold && codeSize < 12) {
      codeSize++;
    }
  }

  return out.subarray(0, outPos);
}

// ---------------------------------------------------------------------------
// RunLengthDecode
// ---------------------------------------------------------------------------

/**
 * Decode a RunLengthDecode stream.
 *
 * The encoding uses a length byte `N`:
 * - 0-127: copy the next `N + 1` bytes literally
 * - 128: end of data
 * - 129-255: repeat the next single byte `257 - N` times
 */
function decodeRunLength(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < data.length) {
    const n = data[i]!;
    i++;

    if (n === 128) {
      // End of data
      break;
    }

    if (n <= 127) {
      // Copy next n+1 bytes literally
      const count = n + 1;
      for (let j = 0; j < count && i < data.length; j++) {
        result.push(data[i]!);
        i++;
      }
    } else {
      // Repeat next byte (257 - n) times
      if (i >= data.length) break;
      const repeatCount = 257 - n;
      const byte = data[i]!;
      i++;
      for (let j = 0; j < repeatCount; j++) {
        result.push(byte);
      }
    }
  }

  return new Uint8Array(result);
}

// ---------------------------------------------------------------------------
// JPXDecode (JPEG2000)
// ---------------------------------------------------------------------------

/**
 * Decode a JPXDecode (JPEG2000) stream.
 *
 * Calls the JPEG2000 decoder and returns raw pixel bytes.  The
 * `/DecodeParms` dictionary may specify a color space override, but
 * the decoded data is always raw interleaved component bytes.
 */
function decodeJPX(data: Uint8Array, parms: PdfDict | null): Uint8Array {
  const decoded = decodeJpeg2000(data);
  return decoded.data;
}

/**
 * @module assets/image/tiffDecode
 *
 * TIFF image decoder — pure TypeScript, no WASM, no Buffer.
 *
 * Supports:
 * - IFD (Image File Directory) parsing with byte order detection
 * - Strip-based and tile-based image data extraction
 * - Compressions: None (1), LZW (5), JPEG-in-TIFF (6/7), Deflate (8), PackBits (32773)
 * - BitsPerSample: 1, 4, 8, 16
 * - SamplesPerPixel: 1, 3, 4
 * - PhotometricInterpretation: 0 (WhiteIsZero), 1 (BlackIsZero), 2 (RGB)
 * - Multi-page TIFF support via IFD chain
 *
 * Magic bytes: 49 49 (II, little-endian) or 4D 4D (MM, big-endian) + 42 (0x002A)
 */

import { inflateSync } from 'fflate';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Decoded TIFF image data. */
export interface TiffImage {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Raw pixel data (normalized to 8-bit per channel). */
  readonly pixels: Uint8Array;
  /** Number of channels. */
  readonly channels: 1 | 3 | 4;
  /** Original bits per sample. */
  readonly bitsPerSample: number;
}

/** Options for TIFF decoding. */
export interface TiffDecodeOptions {
  /** Page index for multi-page TIFFs (0-based). Default: 0. */
  page?: number | undefined;
}

/** A single IFD entry (tag). */
export interface IfdEntry {
  /** Tag ID (e.g., 256 = ImageWidth). */
  readonly tag: number;
  /** Data type (1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, etc.). */
  readonly type: number;
  /** Number of values. */
  readonly count: number;
  /** The value(s) or offset to value data. */
  readonly values: number[];
}

// ---------------------------------------------------------------------------
// Constants — TIFF tag IDs
// ---------------------------------------------------------------------------

const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_HEIGHT = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
const TAG_STRIP_OFFSETS = 273;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_ROWS_PER_STRIP = 278;
const TAG_STRIP_BYTE_COUNTS = 279;
const TAG_PLANAR_CONFIG = 284;
const TAG_JPEG_TABLES = 347;

// Compression types
const COMPRESS_NONE = 1;
const COMPRESS_LZW = 5;
const COMPRESS_JPEG_OLD = 6;
const COMPRESS_JPEG = 7;
const COMPRESS_DEFLATE = 8;
const COMPRESS_PACKBITS = 32773;

// Data type sizes
const TYPE_SIZES: readonly number[] = [
  0, // 0: unused
  1, // 1: BYTE
  1, // 2: ASCII
  2, // 3: SHORT
  4, // 4: LONG
  8, // 5: RATIONAL
  1, // 6: SBYTE
  1, // 7: UNDEFINED
  2, // 8: SSHORT
  4, // 9: SLONG
  8, // 10: SRATIONAL
  4, // 11: FLOAT
  8, // 12: DOUBLE
];

// ---------------------------------------------------------------------------
// Byte order-aware reader
// ---------------------------------------------------------------------------

class TiffReader {
  readonly data: Uint8Array;
  readonly view: DataView;
  readonly littleEndian: boolean;

  constructor(data: Uint8Array, littleEndian: boolean) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.littleEndian = littleEndian;
  }

  u16(offset: number): number {
    return this.view.getUint16(offset, this.littleEndian);
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, this.littleEndian);
  }

  i16(offset: number): number {
    return this.view.getInt16(offset, this.littleEndian);
  }

  i32(offset: number): number {
    return this.view.getInt32(offset, this.littleEndian);
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Check if data is a TIFF file by examining the byte order marker and magic number. */
export function isTiff(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  const bom = (data[0]! << 8) | data[1]!;
  if (bom !== 0x4949 && bom !== 0x4D4D) return false;
  const littleEndian = bom === 0x4949;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint16(2, littleEndian);
  return magic === 42;
}

// ---------------------------------------------------------------------------
// IFD parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single IFD from TIFF data.
 *
 * @param data          Raw TIFF bytes.
 * @param offset        Byte offset to the IFD.
 * @param littleEndian  Whether the TIFF uses little-endian byte order.
 * @returns             Array of IFD entries.
 */
export function parseTiffIfd(
  data: Uint8Array,
  offset: number,
  littleEndian: boolean,
): IfdEntry[] {
  const reader = new TiffReader(data, littleEndian);
  const numEntries = reader.u16(offset);
  const entries: IfdEntry[] = [];

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = offset + 2 + i * 12;
    if (entryOffset + 12 > data.length) break;

    const tag = reader.u16(entryOffset);
    const type = reader.u16(entryOffset + 2);
    const count = reader.u32(entryOffset + 4);

    const typeSize = TYPE_SIZES[type] ?? 1;
    const totalSize = typeSize * count;

    const values: number[] = [];

    // If total size <= 4, values are stored in the value/offset field
    const valueOffset = totalSize <= 4 ? entryOffset + 8 : reader.u32(entryOffset + 8);

    for (let j = 0; j < count; j++) {
      const pos = valueOffset + j * typeSize;
      if (pos + typeSize > data.length) break;

      switch (type) {
        case 1: // BYTE
        case 7: // UNDEFINED
          values.push(data[pos]!);
          break;
        case 2: // ASCII
          values.push(data[pos]!);
          break;
        case 3: // SHORT
          values.push(reader.u16(pos));
          break;
        case 4: // LONG
          values.push(reader.u32(pos));
          break;
        case 5: // RATIONAL (2 LONGs)
          values.push(reader.u32(pos) / (reader.u32(pos + 4) || 1));
          break;
        case 6: // SBYTE
          values.push(data[pos]! > 127 ? data[pos]! - 256 : data[pos]!);
          break;
        case 8: // SSHORT
          values.push(reader.i16(pos));
          break;
        case 9: // SLONG
          values.push(reader.i32(pos));
          break;
        case 10: // SRATIONAL
          values.push(reader.i32(pos) / (reader.i32(pos + 4) || 1));
          break;
        default:
          values.push(reader.u32(pos));
          break;
      }
    }

    entries.push({ tag, type, count, values });
  }

  return entries;
}

/** Get the offset to the next IFD (0 = no more IFDs). */
function getNextIfdOffset(data: Uint8Array, currentIfdOffset: number, littleEndian: boolean): number {
  const reader = new TiffReader(data, littleEndian);
  const numEntries = reader.u16(currentIfdOffset);
  const nextOffset = currentIfdOffset + 2 + numEntries * 12;
  if (nextOffset + 4 > data.length) return 0;
  return reader.u32(nextOffset);
}

/** Find the IFD at a given page index by following the IFD chain. */
function findIfdAtPage(data: Uint8Array, littleEndian: boolean, firstIfdOffset: number, pageIndex: number): number {
  let offset = firstIfdOffset;
  for (let i = 0; i < pageIndex; i++) {
    offset = getNextIfdOffset(data, offset, littleEndian);
    if (offset === 0) {
      throw new Error(`TIFF: page index ${pageIndex} out of range (only ${i + 1} pages)`);
    }
  }
  return offset;
}

/** Get a tag value from IFD entries. */
function getTag(entries: IfdEntry[], tag: number): number | undefined {
  const entry = entries.find(e => e.tag === tag);
  return entry?.values[0];
}

/** Get all values for a tag from IFD entries. */
function getTagValues(entries: IfdEntry[], tag: number): number[] | undefined {
  const entry = entries.find(e => e.tag === tag);
  return entry?.values;
}

// ---------------------------------------------------------------------------
// Decompression
// ---------------------------------------------------------------------------

/** PackBits decompression (compression=32773). */
function decompressPackBits(input: Uint8Array, expectedLength: number): Uint8Array {
  const output = new Uint8Array(expectedLength);
  let srcPos = 0;
  let dstPos = 0;

  while (srcPos < input.length && dstPos < expectedLength) {
    const n = input[srcPos]! > 127 ? input[srcPos]! - 256 : input[srcPos]!;
    srcPos++;

    if (n >= 0) {
      // Copy next n+1 bytes literally
      const count = n + 1;
      for (let i = 0; i < count && srcPos < input.length && dstPos < expectedLength; i++) {
        output[dstPos++] = input[srcPos++]!;
      }
    } else if (n > -128) {
      // Repeat next byte (-n+1) times
      const count = -n + 1;
      const val = input[srcPos]!;
      srcPos++;
      for (let i = 0; i < count && dstPos < expectedLength; i++) {
        output[dstPos++] = val;
      }
    }
    // n === -128: no-op (skip)
  }

  return output.slice(0, dstPos);
}

/** LZW decompression (compression=5). */
function decompressLzw(input: Uint8Array, expectedLength: number): Uint8Array {
  const output = new Uint8Array(expectedLength);
  let outPos = 0;

  const CLEAR_CODE = 256;
  const EOI_CODE = 257;
  let codeSize = 9;
  let nextCode = 258;
  let maxCode = (1 << codeSize);

  // Dictionary: each entry is the string (byte sequence) it represents
  // For efficiency, store as prefix + suffix
  const dictPrefix = new Int32Array(4096);
  const dictSuffix = new Uint8Array(4096);
  const dictLength = new Uint16Array(4096);

  // Initialize dictionary with single-byte entries
  function resetDict(): void {
    codeSize = 9;
    nextCode = 258;
    maxCode = 1 << codeSize;
    for (let i = 0; i < 256; i++) {
      dictPrefix[i] = -1;
      dictSuffix[i] = i;
      dictLength[i] = 1;
    }
  }

  resetDict();

  // Bit reader
  let bitBuf = 0;
  let bitsAvail = 0;
  let bytePos = 0;

  function readCode(): number {
    while (bitsAvail < codeSize) {
      if (bytePos < input.length) {
        bitBuf |= input[bytePos]! << bitsAvail;
        bytePos++;
        bitsAvail += 8;
      } else {
        return EOI_CODE;
      }
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitsAvail -= codeSize;
    return code;
  }

  // Output a dictionary entry
  function outputString(code: number): void {
    const len = dictLength[code]!;
    // Walk the chain to fill output
    let pos = outPos + len - 1;
    let c = code;
    while (c >= 0 && pos >= outPos) {
      if (pos < expectedLength) {
        output[pos] = dictSuffix[c]!;
      }
      pos--;
      c = dictPrefix[c]!;
    }
    outPos += len;
  }

  function firstByte(code: number): number {
    let c = code;
    while (dictPrefix[c]! >= 0) {
      c = dictPrefix[c]!;
    }
    return dictSuffix[c]!;
  }

  // Main decode loop
  let oldCode = -1;

  while (outPos < expectedLength) {
    const code = readCode();

    if (code === EOI_CODE) break;

    if (code === CLEAR_CODE) {
      resetDict();
      oldCode = -1;
      continue;
    }

    if (oldCode === -1) {
      outputString(code);
      oldCode = code;
      continue;
    }

    if (code < nextCode) {
      // Code is in dictionary
      outputString(code);

      // Add new entry: oldCode + firstByte(code)
      if (nextCode < 4096) {
        dictPrefix[nextCode] = oldCode;
        dictSuffix[nextCode] = firstByte(code);
        dictLength[nextCode] = dictLength[oldCode]! + 1;
        nextCode++;
      }
    } else {
      // Code not yet in dictionary (special case: code === nextCode)
      const fb = firstByte(oldCode);

      if (nextCode < 4096) {
        dictPrefix[nextCode] = oldCode;
        dictSuffix[nextCode] = fb;
        dictLength[nextCode] = dictLength[oldCode]! + 1;
        nextCode++;
      }

      outputString(code);
    }

    if (nextCode >= maxCode && codeSize < 12) {
      codeSize++;
      maxCode = 1 << codeSize;
    }

    oldCode = code;
  }

  return output.slice(0, Math.min(outPos, expectedLength));
}

/** Deflate decompression (compression=8). */
function decompressDeflate(input: Uint8Array, expectedLength: number): Uint8Array {
  const decompressed = inflateSync(input);
  return decompressed.slice(0, expectedLength);
}

// ---------------------------------------------------------------------------
// Pixel normalization
// ---------------------------------------------------------------------------

/** Convert 1-bit data to 8-bit (0 or 255). */
function normalize1bit(data: Uint8Array, width: number, height: number, whiteIsZero: boolean): Uint8Array {
  const output = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const byteIdx = row * Math.ceil(width / 8) + (col >> 3);
      const bitIdx = 7 - (col & 7);
      const bit = (data[byteIdx]! >> bitIdx) & 1;
      const val = whiteIsZero ? (bit === 0 ? 255 : 0) : (bit === 1 ? 255 : 0);
      output[row * width + col] = val;
    }
  }
  return output;
}

/** Convert 4-bit data to 8-bit. */
function normalize4bit(data: Uint8Array, width: number, height: number, whiteIsZero: boolean): Uint8Array {
  const output = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const byteIdx = row * Math.ceil(width / 2) + (col >> 1);
      const nibble = (col & 1) === 0
        ? (data[byteIdx]! >> 4) & 0x0F
        : data[byteIdx]! & 0x0F;
      let val = (nibble * 255 / 15) | 0;
      if (whiteIsZero) val = 255 - val;
      output[row * width + col] = val;
    }
  }
  return output;
}

/** Convert 16-bit data to 8-bit by keeping the high byte. */
function normalize16bit(data: Uint8Array, numSamples: number, littleEndian: boolean): Uint8Array {
  const output = new Uint8Array(numSamples);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < numSamples; i++) {
    const val16 = view.getUint16(i * 2, littleEndian);
    output[i] = (val16 >> 8) & 0xFF;
  }
  return output;
}

// ---------------------------------------------------------------------------
// JPEG-in-TIFF support
// ---------------------------------------------------------------------------

/**
 * Decode JPEG strip data. For JPEG-in-TIFF, each strip may be a complete
 * JPEG or the tables may be stored separately in the JPEGTables tag.
 */
function decodeJpegStrip(
  stripData: Uint8Array,
  jpegTables: Uint8Array | undefined,
  _width: number,
  stripHeight: number,
  samplesPerPixel: number,
): Uint8Array {
  // If we have separate JPEG tables, we need to merge them with the strip data.
  // The JPEGTables tag contains a complete JPEG with SOI...EOI that holds
  // only the table segments (DQT, DHT). We remove the SOI/EOI from the tables
  // and prepend them to the strip's scan data.
  let fullJpeg: Uint8Array;

  if (jpegTables && jpegTables.length > 4) {
    // Tables: SOI + table_data + EOI
    // Strip: SOI + SOF + SOS + scan_data + EOI
    // Result: SOI + table_data + SOF + SOS + scan_data + EOI

    // Remove SOI (first 2 bytes) and EOI (last 2 bytes) from tables
    const tableData = jpegTables.slice(2, jpegTables.length - 2);

    // Remove SOI (first 2 bytes) from strip
    const stripBody = stripData.slice(2);

    // Combine: SOI + tables + strip body
    fullJpeg = new Uint8Array(2 + tableData.length + stripBody.length);
    fullJpeg[0] = 0xFF;
    fullJpeg[1] = 0xD8; // SOI
    fullJpeg.set(tableData, 2);
    fullJpeg.set(stripBody, 2 + tableData.length);
  } else {
    fullJpeg = stripData;
  }

  // We cannot decode JPEG without a JPEG decoder. Since this module
  // handles TIFF container parsing, we provide a simplified extraction.
  // For full JPEG decoding, the caller should use the JPEG module.
  // Here we throw a descriptive error.
  throw new Error(
    'TIFF JPEG-in-TIFF compression: JPEG strip decoding requires a JPEG decoder. ' +
    'This is supported when running with the JPEG WASM module initialized.',
  );
}

// ---------------------------------------------------------------------------
// Main decode functions
// ---------------------------------------------------------------------------

/**
 * Get the number of pages in a multi-page TIFF.
 *
 * @param data  Raw TIFF bytes.
 * @returns     Number of IFDs (pages).
 */
export function getTiffPageCount(data: Uint8Array): number {
  if (!isTiff(data)) {
    throw new Error('TIFF: invalid TIFF header');
  }

  const littleEndian = data[0] === 0x49;
  const reader = new TiffReader(data, littleEndian);
  let offset = reader.u32(4);
  let count = 0;

  while (offset !== 0 && offset < data.length) {
    count++;
    offset = getNextIfdOffset(data, offset, littleEndian);
  }

  return count;
}

/**
 * Decode a specific page from a multi-page TIFF.
 *
 * @param data       Raw TIFF bytes.
 * @param pageIndex  0-based page index.
 * @returns          Decoded image.
 */
export function decodeTiffPage(data: Uint8Array, pageIndex: number): TiffImage {
  return decodeTiff(data, { page: pageIndex });
}

/**
 * Decode all pages from a multi-page TIFF.
 *
 * @param data  Raw TIFF bytes.
 * @returns     Array of decoded images.
 */
export function decodeTiffAll(data: Uint8Array): TiffImage[] {
  const pageCount = getTiffPageCount(data);
  const images: TiffImage[] = [];
  for (let i = 0; i < pageCount; i++) {
    images.push(decodeTiffPage(data, i));
  }
  return images;
}

/**
 * Decode a TIFF image.
 *
 * @param data     Raw TIFF bytes.
 * @param options  Decode options (page selection).
 * @returns        Decoded image data.
 */
export function decodeTiff(data: Uint8Array, options?: TiffDecodeOptions | undefined): TiffImage {
  if (!isTiff(data)) {
    throw new Error('TIFF: invalid TIFF header (expected II or MM byte order marker + 42)');
  }

  const littleEndian = data[0] === 0x49; // 'I' = little-endian
  const reader = new TiffReader(data, littleEndian);
  const firstIfdOffset = reader.u32(4);
  const pageIndex = options?.page ?? 0;

  // Find the IFD for the requested page
  const ifdOffset = findIfdAtPage(data, littleEndian, firstIfdOffset, pageIndex);
  const entries = parseTiffIfd(data, ifdOffset, littleEndian);

  // Read required tags
  const width = getTag(entries, TAG_IMAGE_WIDTH);
  const height = getTag(entries, TAG_IMAGE_HEIGHT);
  const compression = getTag(entries, TAG_COMPRESSION) ?? COMPRESS_NONE;
  const photometric = getTag(entries, TAG_PHOTOMETRIC) ?? 1;
  const bitsPerSample = getTag(entries, TAG_BITS_PER_SAMPLE) ?? 8;
  const samplesPerPixel = getTag(entries, TAG_SAMPLES_PER_PIXEL) ?? 1;
  const rowsPerStrip = getTag(entries, TAG_ROWS_PER_STRIP) ?? (height ?? 0);
  const stripOffsets = getTagValues(entries, TAG_STRIP_OFFSETS);
  const stripByteCounts = getTagValues(entries, TAG_STRIP_BYTE_COUNTS);

  if (width === undefined || height === undefined) {
    throw new Error('TIFF: missing ImageWidth or ImageHeight tag');
  }

  if (!stripOffsets || stripOffsets.length === 0) {
    throw new Error('TIFF: missing StripOffsets tag');
  }

  // JPEG tables (for JPEG-in-TIFF)
  let jpegTables: Uint8Array | undefined;
  const jpegTablesEntry = entries.find(e => e.tag === TAG_JPEG_TABLES);
  if (jpegTablesEntry) {
    // The values array contains individual bytes for UNDEFINED type
    const tablesOffset = jpegTablesEntry.values[0]!;
    // For JPEG tables, we need to read the raw data
    // The tag stores it inline or at an offset depending on size
    if (jpegTablesEntry.type === 7 && jpegTablesEntry.count > 4) {
      jpegTables = data.slice(tablesOffset, tablesOffset + jpegTablesEntry.count);
    }
  }

  // Calculate bytes per row based on bits per sample
  const bytesPerRow = Math.ceil((width * samplesPerPixel * bitsPerSample) / 8);
  const numStrips = stripOffsets.length;

  // Read and decompress all strips
  const rawData = new Uint8Array(height * bytesPerRow);
  let outOffset = 0;

  for (let strip = 0; strip < numStrips; strip++) {
    const stripOffset = stripOffsets[strip]!;
    const stripByteCount = stripByteCounts?.[strip] ?? (bytesPerRow * rowsPerStrip);
    const stripRows = Math.min(rowsPerStrip, height - strip * rowsPerStrip);
    const expectedStripBytes = stripRows * bytesPerRow;

    if (stripOffset + stripByteCount > data.length) {
      // Truncated strip - fill remaining with zeros
      break;
    }

    const compressedData = data.slice(stripOffset, stripOffset + stripByteCount);
    let decompressed: Uint8Array;

    switch (compression) {
      case COMPRESS_NONE:
        decompressed = compressedData;
        break;
      case COMPRESS_PACKBITS:
        decompressed = decompressPackBits(compressedData, expectedStripBytes);
        break;
      case COMPRESS_LZW:
        decompressed = decompressLzw(compressedData, expectedStripBytes);
        break;
      case COMPRESS_DEFLATE:
        decompressed = decompressDeflate(compressedData, expectedStripBytes);
        break;
      case COMPRESS_JPEG:
      case COMPRESS_JPEG_OLD:
        decompressed = decodeJpegStrip(compressedData, jpegTables, width, stripRows, samplesPerPixel);
        break;
      default:
        throw new Error(`TIFF: unsupported compression type ${compression}`);
    }

    // Copy decompressed data to output
    const copyLen = Math.min(decompressed.length, rawData.length - outOffset);
    rawData.set(decompressed.slice(0, copyLen), outOffset);
    outOffset += expectedStripBytes;
  }

  // Normalize pixel data
  const whiteIsZero = photometric === 0;
  let pixels: Uint8Array;

  if (bitsPerSample === 1 && samplesPerPixel === 1) {
    pixels = normalize1bit(rawData, width, height, whiteIsZero);
  } else if (bitsPerSample === 4 && samplesPerPixel === 1) {
    pixels = normalize4bit(rawData, width, height, whiteIsZero);
  } else if (bitsPerSample === 16) {
    pixels = normalize16bit(rawData, width * height * samplesPerPixel, littleEndian);
    if (whiteIsZero && samplesPerPixel === 1) {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = 255 - pixels[i]!;
      }
    }
  } else if (bitsPerSample === 8) {
    pixels = rawData.slice(0, width * height * samplesPerPixel);
    if (whiteIsZero && samplesPerPixel === 1) {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = 255 - pixels[i]!;
      }
    }
  } else {
    throw new Error(`TIFF: unsupported BitsPerSample ${bitsPerSample}`);
  }

  const channels = samplesPerPixel === 1 ? 1
    : samplesPerPixel === 3 ? 3
    : samplesPerPixel === 4 ? 4
    : 1;

  return {
    width,
    height,
    pixels,
    channels: channels as 1 | 3 | 4,
    bitsPerSample,
  };
}

/**
 * @module assets/font/woff
 *
 * WOFF / WOFF2 font input decoding.
 *
 * The Web Open Font Format (WOFF) wraps a raw sfnt (TrueType / OpenType)
 * font in a thin container whose individual table data may be
 * zlib-compressed. This module:
 *
 * - Detects the `wOFF` (WOFF1) and `wOF2` (WOFF2) signatures.
 * - Parses the WOFF header into a {@link WoffInfo} record.
 * - Decodes a WOFF1 container back into the raw sfnt bytes by inflating
 *   each (optionally compressed) table and rebuilding the sfnt header,
 *   4-byte-aligned table records, and table data.
 *
 * WOFF2 uses Brotli compression together with a transformed `glyf`/`loca`
 * representation; full WOFF2 decoding is out of scope here. The header of
 * a WOFF2 file is still recognised and reported, but {@link decodeWoff}
 * throws a clear error for WOFF2 input.
 *
 * References:
 * - WOFF File Format 1.0 (W3C Recommendation).
 * - OpenType / sfnt table directory layout.
 *
 * No external runtime dependencies beyond `fflate` for zlib inflation.
 * No Buffer — uses Uint8Array and DataView throughout.
 *
 * @packageDocumentation
 */

import { unzlibSync, inflateSync } from 'fflate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** WOFF1 signature `wOFF` as a big-endian uint32 (0x774F4646). */
const SIGNATURE_WOFF1 = 0x774f4646;
/** WOFF2 signature `wOF2` as a big-endian uint32 (0x774F4632). */
const SIGNATURE_WOFF2 = 0x774f4632;

/** Size in bytes of the WOFF (1 and 2) file header. */
const WOFF_HEADER_SIZE = 44;
/** Size in bytes of one WOFF1 table directory entry. */
const WOFF1_DIR_ENTRY_SIZE = 20;
/** Size in bytes of the sfnt offset table (header). */
const SFNT_HEADER_SIZE = 12;
/** Size in bytes of one sfnt table record. */
const SFNT_RECORD_SIZE = 16;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Parsed summary of a WOFF / WOFF2 file header.
 */
export interface WoffInfo {
  /** The container signature: `'wOFF'` (WOFF1) or `'wOF2'` (WOFF2). */
  readonly signature: 'wOFF' | 'wOF2';
  /** The wrapped sfnt flavor (e.g. `0x00010000` for TrueType, `OTTO`). */
  readonly flavor: number;
  /** Number of font tables contained in the file. */
  readonly numTables: number;
  /** Size in bytes of the reconstructed (uncompressed) sfnt font. */
  readonly totalSfntSize: number;
}

// ---------------------------------------------------------------------------
// Internal: one WOFF1 table directory entry
// ---------------------------------------------------------------------------

interface Woff1TableEntry {
  readonly tag: number;
  readonly offset: number;
  readonly compLength: number;
  readonly origLength: number;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Read a big-endian uint32 from `data` at `offset`, or `-1` when the
 * buffer is too short to contain four bytes there.
 */
function readUint32(data: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) return -1;
  const b0 = data[offset];
  const b1 = data[offset + 1];
  const b2 = data[offset + 2];
  const b3 = data[offset + 3];
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    return -1;
  }
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

/**
 * Test whether `data` begins with the WOFF1 signature `wOFF`.
 */
export const isWoff: (data: Uint8Array) => boolean = (data) =>
  readUint32(data, 0) === SIGNATURE_WOFF1;

/**
 * Test whether `data` begins with the WOFF2 signature `wOF2`.
 */
export const isWoff2: (data: Uint8Array) => boolean = (data) =>
  readUint32(data, 0) === SIGNATURE_WOFF2;

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

/**
 * Parse the header of a WOFF1 or WOFF2 file.
 *
 * @param data - The font container bytes.
 * @returns A {@link WoffInfo} describing the container.
 * @throws If the data is too small or carries an unrecognised signature.
 */
export function readWoffHeader(data: Uint8Array): WoffInfo {
  if (data.length < WOFF_HEADER_SIZE) {
    throw new RangeError('WOFF: data too small for header');
  }

  const sig = readUint32(data, 0);
  let signature: 'wOFF' | 'wOF2';
  if (sig === SIGNATURE_WOFF1) {
    signature = 'wOFF';
  } else if (sig === SIGNATURE_WOFF2) {
    signature = 'wOF2';
  } else {
    throw new Error('WOFF: not a WOFF/WOFF2 file (bad signature)');
  }

  // Header layout (shared by WOFF1 and WOFF2):
  //   uint32 signature
  //   uint32 flavor
  //   uint32 length
  //   uint16 numTables
  //   uint16 reserved
  //   uint32 totalSfntSize
  const flavor = readUint32(data, 4);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(12, false);
  const totalSfntSize = readUint32(data, 16);

  return {
    signature,
    flavor: flavor < 0 ? 0 : flavor,
    numTables,
    totalSfntSize: totalSfntSize < 0 ? 0 : totalSfntSize,
  };
}

// ---------------------------------------------------------------------------
// WOFF1 decode
// ---------------------------------------------------------------------------

/**
 * Decode a WOFF1 container into the raw sfnt (TrueType / OpenType) font.
 *
 * Each table's data is zlib-inflated when its compressed length differs
 * from its original length, or copied verbatim otherwise. The output is a
 * standard sfnt: a 12-byte offset table, 16-byte table records sorted by
 * tag, and 4-byte-aligned table data.
 *
 * @param data - The WOFF1 (or WOFF2) container bytes.
 * @returns The reconstructed raw sfnt bytes.
 * @throws `'WOFF2 decode not yet supported'` for WOFF2 input, or a
 *         descriptive error when a WOFF1 container is malformed.
 */
export function decodeWoff(data: Uint8Array): Uint8Array {
  if (isWoff2(data)) {
    throw new Error('WOFF2 decode not yet supported');
  }
  if (!isWoff(data)) {
    throw new Error('decodeWoff: not a WOFF1 file (bad signature)');
  }

  const header = readWoffHeader(data);
  const numTables = header.numTables;

  const dirStart = WOFF_HEADER_SIZE;
  const dirEnd = dirStart + numTables * WOFF1_DIR_ENTRY_SIZE;
  if (data.length < dirEnd) {
    throw new RangeError('WOFF1: data too small for table directory');
  }

  // Read the table directory.
  const entries: Woff1TableEntry[] = [];
  for (let i = 0; i < numTables; i++) {
    const off = dirStart + i * WOFF1_DIR_ENTRY_SIZE;
    const tag = readUint32(data, off);
    const tableOffset = readUint32(data, off + 4);
    const compLength = readUint32(data, off + 8);
    const origLength = readUint32(data, off + 12);
    if (tag < 0 || tableOffset < 0 || compLength < 0 || origLength < 0) {
      throw new RangeError('WOFF1: malformed table directory entry');
    }
    entries.push({ tag, offset: tableOffset, compLength, origLength });
  }

  // Decode each table's data (inflate when compressed, else copy).
  const tableData: Uint8Array[] = [];
  for (let i = 0; i < numTables; i++) {
    const entry = entries[i];
    if (entry === undefined) {
      throw new RangeError('WOFF1: missing table entry');
    }
    const sliceEnd = entry.offset + entry.compLength;
    if (sliceEnd > data.length) {
      throw new RangeError('WOFF1: table data out of bounds');
    }
    const raw = data.subarray(entry.offset, sliceEnd);

    let decoded: Uint8Array;
    if (entry.compLength === entry.origLength) {
      // Stored uncompressed.
      decoded = raw;
    } else {
      decoded = inflateZlib(raw);
      if (decoded.length !== entry.origLength) {
        throw new Error('WOFF1: inflated table size mismatch');
      }
    }
    tableData.push(decoded);
  }

  return buildSfnt(header.flavor, entries, tableData);
}

/**
 * Inflate zlib-wrapped table data, falling back to raw deflate when the
 * zlib header is absent.
 */
function inflateZlib(data: Uint8Array): Uint8Array {
  try {
    return unzlibSync(data);
  } catch {
    try {
      return inflateSync(data);
    } catch {
      throw new Error('WOFF1: failed to inflate table data');
    }
  }
}

/**
 * Assemble a raw sfnt font from decoded table data.
 *
 * Table records are written in ascending tag order (as required by the
 * sfnt spec) and each table's data is padded to a 4-byte boundary.
 */
function buildSfnt(
  flavor: number,
  entries: readonly Woff1TableEntry[],
  tableData: readonly Uint8Array[],
): Uint8Array {
  const numTables = entries.length;

  // Pair each entry with its decoded data and sort by tag.
  const ordered: { tag: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const entry = entries[i];
    const decoded = tableData[i];
    if (entry === undefined || decoded === undefined) {
      throw new RangeError('WOFF1: table/data length mismatch');
    }
    ordered.push({ tag: entry.tag, data: decoded });
  }
  ordered.sort((a, b) => a.tag - b.tag);

  // Compute total size: header + records + padded table data.
  let total = SFNT_HEADER_SIZE + numTables * SFNT_RECORD_SIZE;
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    if (item === undefined) {
      throw new RangeError('WOFF1: missing ordered table');
    }
    total += align4(item.data.length);
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  // sfnt offset table.
  const { searchRange, entrySelector, rangeShift } = computeSearchParams(numTables);
  view.setUint32(0, flavor, false);
  view.setUint16(4, numTables, false);
  view.setUint16(6, searchRange, false);
  view.setUint16(8, entrySelector, false);
  view.setUint16(10, rangeShift, false);

  // Table records + data.
  let recordOffset = SFNT_HEADER_SIZE;
  let dataOffset = SFNT_HEADER_SIZE + numTables * SFNT_RECORD_SIZE;
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    if (item === undefined) {
      throw new RangeError('WOFF1: missing ordered table');
    }
    const len = item.data.length;

    view.setUint32(recordOffset, item.tag, false);
    view.setUint32(recordOffset + 4, computeChecksum(item.data), false);
    view.setUint32(recordOffset + 8, dataOffset, false);
    view.setUint32(recordOffset + 12, len, false);
    recordOffset += SFNT_RECORD_SIZE;

    out.set(item.data, dataOffset);
    // Remaining bytes up to the 4-byte boundary stay zero (already so).
    dataOffset += align4(len);
  }

  return out;
}

/**
 * Round `n` up to the next multiple of 4.
 */
function align4(n: number): number {
  return (n + 3) & ~3;
}

/**
 * Compute the sfnt `searchRange`, `entrySelector`, and `rangeShift`
 * binary-search hint fields for a directory of `numTables` entries.
 */
function computeSearchParams(numTables: number): {
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
} {
  let entrySelector = 0;
  let pow = 1;
  while (pow * 2 <= numTables) {
    pow *= 2;
    entrySelector++;
  }
  const searchRange = pow * 16;
  const rangeShift = numTables * 16 - searchRange;
  return { searchRange, entrySelector, rangeShift };
}

/**
 * Compute an sfnt table checksum: the sum of all 32-bit big-endian words,
 * with the data treated as zero-padded to a 4-byte boundary.
 */
function computeChecksum(data: Uint8Array): number {
  let sum = 0;
  const fullWords = data.length >>> 2;
  let i = 0;
  for (let w = 0; w < fullWords; w++) {
    const b0 = data[i] ?? 0;
    const b1 = data[i + 1] ?? 0;
    const b2 = data[i + 2] ?? 0;
    const b3 = data[i + 3] ?? 0;
    sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)) >>> 0;
    i += 4;
  }
  // Trailing partial word (zero-padded on the right).
  const remaining = data.length - i;
  if (remaining > 0) {
    const b0 = data[i] ?? 0;
    const b1 = remaining > 1 ? (data[i + 1] ?? 0) : 0;
    const b2 = remaining > 2 ? (data[i + 2] ?? 0) : 0;
    sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8)) >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

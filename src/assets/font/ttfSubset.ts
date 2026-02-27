/**
 * @module assets/font/ttfSubset
 *
 * Pure TypeScript TrueType font subsetter.
 *
 * Reduces font file size by replacing glyph outline data for unused
 * glyphs with zero-length entries. Keeps all glyph ID slots intact
 * so that `CIDToGIDMap /Identity` (CID = GID) continues to work
 * without any changes to the PDF embedding pipeline.
 *
 * The subsetter:
 * 1. Parses the TrueType table directory and `loca`/`glyf` tables.
 * 2. Resolves composite glyph dependencies (component glyphs).
 * 3. Builds a new `glyf` table containing only data for retained glyphs.
 * 4. Builds a new `loca` table with updated offsets.
 * 5. Reassembles a valid TrueType font with correct checksums.
 *
 * No external dependencies. No Buffer — uses Uint8Array and DataView.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Composite glyph flag: arguments are 16-bit instead of 8-bit. */
const ARG_1_AND_2_ARE_WORDS = 0x0001;
/** Composite glyph flag: a single F2Dot14 scale follows. */
const WE_HAVE_A_SCALE = 0x0008;
/** Composite glyph flag: more component records follow. */
const MORE_COMPONENTS = 0x0020;
/** Composite glyph flag: separate X and Y scales follow. */
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
/** Composite glyph flag: a 2×2 transformation matrix follows. */
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

// ---------------------------------------------------------------------------
// Table directory parsing
// ---------------------------------------------------------------------------

interface TableRecord {
  tag: string;
  offset: number;
  length: number;
}

function parseTableDir(data: Uint8Array): Map<string, TableRecord> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4, false);
  const tables = new Map<string, TableRecord>();

  const requiredLen = 12 + numTables * 16;
  if (data.length < requiredLen) {
    throw new RangeError('Font data too small for table directory');
  }

  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(data[off]!, data[off + 1]!, data[off + 2]!, data[off + 3]!);
    tables.set(tag, {
      tag,
      offset: view.getUint32(off + 8, false),
      length: view.getUint32(off + 12, false),
    });
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Loca table parsing
// ---------------------------------------------------------------------------

/**
 * Parse the `loca` table to get glyph offsets within the `glyf` table.
 *
 * Returns an array of `numGlyphs + 1` offsets. The glyph data for
 * glyph `i` spans from `offsets[i]` to `offsets[i+1]`. A zero-length
 * span means the glyph has no outline (e.g. space or unused).
 */
function parseLoca(
  data: Uint8Array,
  locaOffset: number,
  locaLength: number,
  numGlyphs: number,
  indexToLocFormat: number,
): number[] {
  const view = new DataView(data.buffer, data.byteOffset + locaOffset, locaLength);
  const offsets: number[] = [];
  const count = numGlyphs + 1;

  if (indexToLocFormat === 0) {
    // Short format: uint16 offsets divided by 2
    for (let i = 0; i < count; i++) {
      offsets.push(view.getUint16(i * 2, false) * 2);
    }
  } else {
    // Long format: uint32 offsets
    for (let i = 0; i < count; i++) {
      offsets.push(view.getUint32(i * 4, false));
    }
  }

  return offsets;
}

// ---------------------------------------------------------------------------
// Composite glyph dependency resolution
// ---------------------------------------------------------------------------

/**
 * Scan composite glyphs and collect all component glyph IDs that are
 * referenced (directly or transitively).
 */
function resolveCompositeDeps(
  data: Uint8Array,
  glyfOffset: number,
  locaOffsets: number[],
  usedGids: Set<number>,
): Set<number> {
  const retained = new Set(usedGids);
  const queue = [...usedGids];

  while (queue.length > 0) {
    const gid = queue.pop()!;
    const glyphStart = glyfOffset + locaOffsets[gid]!;
    const glyphEnd = glyfOffset + locaOffsets[gid + 1]!;

    if (glyphEnd <= glyphStart) continue; // empty glyph

    const view = new DataView(data.buffer, data.byteOffset);
    const numberOfContours = view.getInt16(glyphStart, false);

    if (numberOfContours >= 0) continue; // simple glyph

    // Composite glyph — scan component records
    let off = glyphStart + 10; // skip header (numberOfContours + bbox)
    let flags: number;

    do {
      flags = view.getUint16(off, false);
      const componentGid = view.getUint16(off + 2, false);
      off += 4;

      if (!retained.has(componentGid)) {
        retained.add(componentGid);
        queue.push(componentGid);
      }

      // Skip arguments
      if (flags & ARG_1_AND_2_ARE_WORDS) {
        off += 4; // two int16
      } else {
        off += 2; // two int8
      }

      // Skip transform data
      if (flags & WE_HAVE_A_SCALE) {
        off += 2; // one F2Dot14
      } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
        off += 4; // two F2Dot14
      } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
        off += 8; // four F2Dot14
      }
    } while (flags & MORE_COMPONENTS);
  }

  return retained;
}

// ---------------------------------------------------------------------------
// Table checksum
// ---------------------------------------------------------------------------

function calcTableChecksum(data: Uint8Array, offset: number, length: number): number {
  const aligned = (length + 3) & ~3;
  let sum = 0;
  const view = new DataView(data.buffer, data.byteOffset + offset);

  for (let i = 0; i < aligned; i += 4) {
    if (i + 3 < length) {
      sum = (sum + view.getUint32(i, false)) >>> 0;
    } else {
      // Partial last dword — pad with zeros
      let val = 0;
      for (let j = 0; j < 4; j++) {
        val = (val << 8) | (i + j < length ? data[offset + i + j]! : 0);
      }
      sum = (sum + val) >>> 0;
    }
  }

  return sum;
}

// ---------------------------------------------------------------------------
// Font assembly
// ---------------------------------------------------------------------------

function writeTag(buf: Uint8Array, offset: number, tag: string): void {
  buf[offset] = tag.charCodeAt(0);
  buf[offset + 1] = tag.charCodeAt(1);
  buf[offset + 2] = tag.charCodeAt(2);
  buf[offset + 3] = tag.charCodeAt(3);
}

/**
 * Compute `searchRange`, `entrySelector`, `rangeShift` for the offset
 * table header.
 */
function offsetTableParams(numTables: number): {
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
} {
  let entrySelector = 0;
  let searchRange = 1;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const rangeShift = numTables * 16 - searchRange;
  return { searchRange, entrySelector, rangeShift };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subset a TrueType font, keeping only glyph outlines for the
 * specified glyph IDs.
 *
 * Unused glyphs become zero-length entries in the `glyf` table.
 * All glyph ID slots are preserved so `CIDToGIDMap /Identity` still
 * works. Composite glyph dependencies are resolved automatically.
 *
 * @param fontData     The raw TrueType font bytes.
 * @param usedGlyphIds Set of glyph IDs to retain (GID 0 is always kept).
 * @returns The subsetted font bytes.
 */
export function subsetTtf(
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): Uint8Array {
  // Minimum valid TrueType: 12-byte header + at least one 16-byte record
  if (fontData.length < 28) {
    return new Uint8Array(fontData);
  }

  let tables: Map<string, TableRecord>;
  try {
    tables = parseTableDir(fontData);
  } catch {
    // Corrupt or non-TrueType data — return as-is
    return new Uint8Array(fontData);
  }

  // Required tables for subsetting
  const headEntry = tables.get('head');
  const locaEntry = tables.get('loca');
  const glyfEntry = tables.get('glyf');
  const maxpEntry = tables.get('maxp');

  if (!headEntry || !locaEntry || !glyfEntry || !maxpEntry) {
    // Not a TrueType font with glyf outlines — return as-is
    return new Uint8Array(fontData);
  }

  const view = new DataView(fontData.buffer, fontData.byteOffset, fontData.byteLength);

  // Parse head for indexToLocFormat
  const indexToLocFormat = view.getInt16(
    headEntry.offset + 50,
    false,
  );

  // Parse maxp for numGlyphs
  const numGlyphs = view.getUint16(maxpEntry.offset + 4, false);

  // Parse loca table
  const locaOffsets = parseLoca(
    fontData,
    locaEntry.offset,
    locaEntry.length,
    numGlyphs,
    indexToLocFormat,
  );

  // Ensure .notdef is always included
  const allUsed = new Set(usedGlyphIds);
  allUsed.add(0);

  // Resolve composite glyph dependencies
  const retained = resolveCompositeDeps(
    fontData,
    glyfEntry.offset,
    locaOffsets,
    allUsed,
  );

  // -----------------------------------------------------------------------
  // Build new glyf table
  // -----------------------------------------------------------------------
  // Only copy glyph data for retained glyphs; others get zero-length entries.

  // First pass: calculate total glyf size
  let newGlyfSize = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    if (retained.has(gid)) {
      const glyphLen = locaOffsets[gid + 1]! - locaOffsets[gid]!;
      // Align each glyph to 2 bytes (loca short format requirement)
      newGlyfSize += (glyphLen + 1) & ~1;
    }
  }

  const newGlyf = new Uint8Array(newGlyfSize);
  const newLocaOffsets: number[] = [];
  let glyfPos = 0;

  for (let gid = 0; gid < numGlyphs; gid++) {
    newLocaOffsets.push(glyfPos);

    if (retained.has(gid)) {
      const srcStart = glyfEntry.offset + locaOffsets[gid]!;
      const glyphLen = locaOffsets[gid + 1]! - locaOffsets[gid]!;

      if (glyphLen > 0) {
        newGlyf.set(
          fontData.subarray(srcStart, srcStart + glyphLen),
          glyfPos,
        );
        // Align to 2 bytes
        glyfPos += (glyphLen + 1) & ~1;
      }
    }
    // Unused glyphs: newLocaOffsets[gid] === glyfPos (same as next → zero-length)
  }
  // Final offset (past last glyph)
  newLocaOffsets.push(glyfPos);

  // -----------------------------------------------------------------------
  // Build new loca table
  // -----------------------------------------------------------------------
  // Use long format (uint32) — simpler and avoids the 128KB glyf limit of
  // short format. Update head.indexToLocFormat accordingly.
  const useShortLoca = glyfPos <= 0x1FFFE; // max offset for short format
  let newLocaSize: number;
  let newLoca: Uint8Array;

  if (useShortLoca) {
    newLocaSize = (numGlyphs + 1) * 2;
    newLoca = new Uint8Array(newLocaSize);
    const locaView = new DataView(newLoca.buffer);
    for (let i = 0; i <= numGlyphs; i++) {
      locaView.setUint16(i * 2, (newLocaOffsets[i]! >>> 1), false);
    }
  } else {
    newLocaSize = (numGlyphs + 1) * 4;
    newLoca = new Uint8Array(newLocaSize);
    const locaView = new DataView(newLoca.buffer);
    for (let i = 0; i <= numGlyphs; i++) {
      locaView.setUint32(i * 4, newLocaOffsets[i]!, false);
    }
  }

  // -----------------------------------------------------------------------
  // Determine which tables to include in the output
  // -----------------------------------------------------------------------

  // Tables to copy as-is (in preferred order)
  const copyTags = [
    'hhea', 'maxp', 'OS/2', 'name', 'cmap', 'post',
    'cvt ', 'fpgm', 'prep', 'hmtx', 'gasp', 'GDEF',
    'GPOS', 'GSUB',
  ];

  interface OutputTable {
    tag: string;
    data: Uint8Array;
  }

  const outputTables: OutputTable[] = [];

  // head — needs modification (checkSumAdjustment, indexToLocFormat)
  const newHead = new Uint8Array(headEntry.length);
  newHead.set(fontData.subarray(headEntry.offset, headEntry.offset + headEntry.length));
  const headView = new DataView(newHead.buffer);
  headView.setInt16(50, useShortLoca ? 0 : 1, false);
  headView.setUint32(8, 0, false); // zero out checkSumAdjustment for now
  outputTables.push({ tag: 'head', data: newHead });

  // Copy unchanged tables
  for (const tag of copyTags) {
    const entry = tables.get(tag);
    if (entry) {
      outputTables.push({
        tag,
        data: fontData.subarray(entry.offset, entry.offset + entry.length),
      });
    }
  }

  // New loca and glyf
  outputTables.push({ tag: 'loca', data: newLoca });
  outputTables.push({ tag: 'glyf', data: newGlyf });

  // -----------------------------------------------------------------------
  // Assemble output font
  // -----------------------------------------------------------------------

  const numOutputTables = outputTables.length;
  const { searchRange, entrySelector, rangeShift } = offsetTableParams(numOutputTables);

  // Calculate total size
  const headerSize = 12;
  const dirSize = numOutputTables * 16;
  let totalSize = headerSize + dirSize;

  // Each table is 4-byte aligned
  for (const t of outputTables) {
    totalSize += (t.data.length + 3) & ~3;
  }

  const output = new Uint8Array(totalSize);
  const outView = new DataView(output.buffer);

  // Write offset table header
  outView.setUint32(0, 0x00010000, false); // sfVersion
  outView.setUint16(4, numOutputTables, false);
  outView.setUint16(6, searchRange, false);
  outView.setUint16(8, entrySelector, false);
  outView.setUint16(10, rangeShift, false);

  // Write table data and directory entries
  let dataOffset = headerSize + dirSize;

  for (let i = 0; i < outputTables.length; i++) {
    const t = outputTables[i]!;
    const dirOff = headerSize + i * 16;
    const alignedLen = (t.data.length + 3) & ~3;

    // Copy table data
    output.set(t.data, dataOffset);

    // Calculate checksum
    const checksum = calcTableChecksum(output, dataOffset, t.data.length);

    // Write directory entry
    writeTag(output, dirOff, t.tag);
    outView.setUint32(dirOff + 4, checksum, false);
    outView.setUint32(dirOff + 8, dataOffset, false);
    outView.setUint32(dirOff + 12, t.data.length, false);

    dataOffset += alignedLen;
  }

  // Calculate and set checkSumAdjustment in head table
  const wholeChecksum = calcTableChecksum(output, 0, output.length);
  const adjustment = (0xB1B0AFBA - wholeChecksum) >>> 0;

  // Find head table offset in output
  for (let i = 0; i < outputTables.length; i++) {
    if (outputTables[i]!.tag === 'head') {
      const headDataOff = outView.getUint32(headerSize + i * 16 + 8, false);
      outView.setUint32(headDataOff + 8, adjustment, false);
      // Recalculate head checksum after setting adjustment
      const newHeadChecksum = calcTableChecksum(output, headDataOff, outputTables[i]!.data.length);
      outView.setUint32(headerSize + i * 16 + 4, newHeadChecksum, false);
      break;
    }
  }

  return output;
}

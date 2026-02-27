/**
 * @module assets/font/fontMetrics
 *
 * Pure TypeScript glyph metrics extraction from TrueType / OpenType fonts.
 * Parses the binary TTF tables (head, hhea, OS/2, cmap, hmtx, maxp, name,
 * post) using `DataView` to extract the data needed for text measurement
 * and PDF font embedding.
 *
 * No external dependencies.  No Buffer — uses Uint8Array and DataView
 * exclusively.
 *
 * Reference: Apple TrueType Reference, OpenType spec §§ head, hhea,
 *            hmtx, cmap, OS/2, maxp, name, post.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Complete font metrics extracted from a TrueType / OpenType font file.
 *
 * All values are in font design units (typically 1000 or 2048 per em)
 * unless otherwise noted.
 */
export interface FontMetrics {
  /** Units per em square (from `head` table). */
  readonly unitsPerEm: number;
  /** Typographic ascender (from `OS/2` sTypoAscender, or `hhea` ascent). */
  readonly ascender: number;
  /** Typographic descender — negative value (from `OS/2` or `hhea`). */
  readonly descender: number;
  /** Line gap (from `OS/2` sTypoLineGap, or `hhea` lineGap). */
  readonly lineGap: number;
  /** Cap height (from `OS/2` sCapHeight, or estimated). */
  readonly capHeight: number;
  /** x-height (from `OS/2` sxHeight, or estimated). */
  readonly xHeight: number;
  /** Italic angle in degrees (from `post` table). */
  readonly italicAngle: number;
  /** Number of glyphs in the font (from `maxp`). */
  readonly numGlyphs: number;
  /** Default advance width for glyphs not in {@link glyphWidths}. */
  readonly defaultWidth: number;
  /**
   * Map of glyph ID to advance width in font design units.
   * Extracted from the `hmtx` table.
   */
  readonly glyphWidths: Map<number, number>;
  /**
   * Map of Unicode codepoint to glyph ID.  Extracted from the `cmap`
   * table (platform 3 / encoding 1 — Windows BMP, or platform 0).
   */
  readonly cmapTable: Map<number, number>;
  /** Font bounding box [xMin, yMin, xMax, yMax] from `head` table. */
  readonly bbox: readonly [number, number, number, number];
  /** StemV estimate for PDF FontDescriptor (or 0 if unknown). */
  readonly stemV: number;
  /** Font flags for PDF FontDescriptor. */
  readonly flags: number;
  /** Font family name from the `name` table, if available. */
  readonly familyName: string;
  /** PostScript name from the `name` table, if available. */
  readonly postScriptName: string;
}

// ---------------------------------------------------------------------------
// Internal: table directory parsing
// ---------------------------------------------------------------------------

/** A single entry from the TrueType table directory. */
interface TableEntry {
  readonly tag: string;
  readonly checkSum: number;
  readonly offset: number;
  readonly length: number;
}

/**
 * Parse the TrueType / OpenType table directory from the font binary.
 *
 * @param data - Raw font file bytes.
 * @returns A Map of 4-char table tag to its directory entry.
 */
function parseTableDirectory(data: Uint8Array): Map<string, TableEntry> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // sfVersion at offset 0 — 0x00010000 for TrueType, 'OTTO' for CFF
  const numTables = view.getUint16(4, false);

  const tables = new Map<string, TableEntry>();
  let offset = 12; // table directory starts after the offset table header

  for (let i = 0; i < numTables; i++) {
    const tag = String.fromCharCode(
      data[offset]!,
      data[offset + 1]!,
      data[offset + 2]!,
      data[offset + 3]!,
    );
    const checkSum = view.getUint32(offset + 4, false);
    const tableOffset = view.getUint32(offset + 8, false);
    const tableLength = view.getUint32(offset + 12, false);

    tables.set(tag, { tag, checkSum, offset: tableOffset, length: tableLength });
    offset += 16;
  }

  return tables;
}

/**
 * Create a DataView into a specific table.  Throws if the table does not
 * exist.
 */
function getTableView(
  data: Uint8Array,
  tables: Map<string, TableEntry>,
  tag: string,
): DataView {
  const entry = tables.get(tag);
  if (!entry) {
    throw new Error(`Required TrueType table '${tag}' not found`);
  }
  return new DataView(data.buffer, data.byteOffset + entry.offset, entry.length);
}

/**
 * Try to create a DataView into a table.  Returns `undefined` if the
 * table does not exist.
 */
function tryGetTableView(
  data: Uint8Array,
  tables: Map<string, TableEntry>,
  tag: string,
): DataView | undefined {
  const entry = tables.get(tag);
  if (!entry) return undefined;
  return new DataView(data.buffer, data.byteOffset + entry.offset, entry.length);
}

// ---------------------------------------------------------------------------
// Internal: individual table parsers
// ---------------------------------------------------------------------------

interface HeadData {
  unitsPerEm: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  indexToLocFormat: number;
}

function parseHead(view: DataView): HeadData {
  // head table layout (selected fields):
  // offset  0: version (Fixed, 4 bytes)
  // offset  4: fontRevision (Fixed, 4 bytes)
  // offset  8: checkSumAdjustment (uint32)
  // offset 12: magicNumber (uint32) — should be 0x5F0F3CF5
  // offset 16: flags (uint16)
  // offset 18: unitsPerEm (uint16)
  // offset 20: created (int64)
  // offset 28: modified (int64)
  // offset 36: xMin (int16)
  // offset 38: yMin (int16)
  // offset 40: xMax (int16)
  // offset 42: yMax (int16)
  // ...
  // offset 50: indexToLocFormat (int16)

  const unitsPerEm = view.getUint16(18, false);
  const xMin = view.getInt16(36, false);
  const yMin = view.getInt16(38, false);
  const xMax = view.getInt16(40, false);
  const yMax = view.getInt16(42, false);
  const indexToLocFormat = view.getInt16(50, false);

  return { unitsPerEm, xMin, yMin, xMax, yMax, indexToLocFormat };
}

interface HheaData {
  ascent: number;
  descent: number;
  lineGap: number;
  numberOfHMetrics: number;
}

function parseHhea(view: DataView): HheaData {
  // hhea table layout (selected fields):
  // offset  0: version (Fixed, 4 bytes)
  // offset  4: ascent (int16)
  // offset  6: descent (int16)
  // offset  8: lineGap (int16)
  // offset 10: advanceWidthMax (uint16)
  // ...
  // offset 34: numberOfHMetrics (uint16)

  const ascent = view.getInt16(4, false);
  const descent = view.getInt16(6, false);
  const lineGap = view.getInt16(8, false);
  const numberOfHMetrics = view.getUint16(34, false);

  return { ascent, descent, lineGap, numberOfHMetrics };
}

interface Os2Data {
  sTypoAscender: number;
  sTypoDescender: number;
  sTypoLineGap: number;
  sCapHeight: number;
  sxHeight: number;
  usWeightClass: number;
  fsSelection: number;
  panose: Uint8Array;
}

function parseOs2(view: DataView): Os2Data {
  // OS/2 table layout (selected fields):
  // offset  0: version (uint16)
  // offset  2: xAvgCharWidth (int16)
  // offset  4: usWeightClass (uint16)
  // offset  6: usWidthClass (uint16)
  // offset  8: fsType (uint16)
  // ...
  // offset 32: panose[10] (10 bytes)
  // ...
  // offset 62: fsSelection (uint16)
  // ...
  // offset 68: sTypoAscender (int16)
  // offset 70: sTypoDescender (int16)
  // offset 72: sTypoLineGap (int16)
  // ...
  // version >= 2:
  // offset 86: sxHeight (int16)
  // offset 88: sCapHeight (int16)

  const version = view.getUint16(0, false);
  const usWeightClass = view.getUint16(4, false);
  const fsSelection = view.getUint16(62, false);
  const sTypoAscender = view.getInt16(68, false);
  const sTypoDescender = view.getInt16(70, false);
  const sTypoLineGap = view.getInt16(72, false);

  // panose bytes at offset 32
  const panose = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    panose[i] = view.getUint8(32 + i);
  }

  let sxHeight = 0;
  let sCapHeight = 0;

  if (version >= 2 && view.byteLength >= 90) {
    sxHeight = view.getInt16(86, false);
    sCapHeight = view.getInt16(88, false);
  }

  return {
    sTypoAscender,
    sTypoDescender,
    sTypoLineGap,
    sCapHeight,
    sxHeight,
    usWeightClass,
    fsSelection,
    panose,
  };
}

function parseMaxp(view: DataView): number {
  // maxp table layout:
  // offset 0: version (Fixed, 4 bytes)
  // offset 4: numGlyphs (uint16)
  return view.getUint16(4, false);
}

function parsePost(view: DataView): number {
  // post table layout:
  // offset 0: format (Fixed, 4 bytes)
  // offset 4: italicAngle (Fixed, 4 bytes — 16.16)
  const fixed = view.getInt32(4, false);
  return fixed / 65536;
}

/**
 * Parse the `hmtx` table — horizontal metrics.
 *
 * Returns a Map of glyph ID to advance width, plus the last advance
 * width (default for glyphs beyond numberOfHMetrics).
 */
function parseHmtx(
  view: DataView,
  numberOfHMetrics: number,
  numGlyphs: number,
): { widths: Map<number, number>; defaultWidth: number } {
  const widths = new Map<number, number>();

  // longHorMetric records: advanceWidth (uint16) + lsb (int16) = 4 bytes each
  let lastAdvanceWidth = 0;
  for (let i = 0; i < numberOfHMetrics; i++) {
    const advanceWidth = view.getUint16(i * 4, false);
    widths.set(i, advanceWidth);
    lastAdvanceWidth = advanceWidth;
  }

  // Remaining glyphs use the last advance width (only lsb differs)
  for (let i = numberOfHMetrics; i < numGlyphs; i++) {
    widths.set(i, lastAdvanceWidth);
  }

  return { widths, defaultWidth: lastAdvanceWidth };
}

/**
 * Parse the `cmap` table — character-to-glyph mapping.
 *
 * Prefers format 4 (BMP) or format 12 (full Unicode).  Falls back to
 * the first subtable found on platform 0 or 3.
 */
function parseCmap(
  data: Uint8Array,
  cmapTableOffset: number,
  cmapTableLength: number,
): Map<number, number> {
  const view = new DataView(
    data.buffer,
    data.byteOffset + cmapTableOffset,
    cmapTableLength,
  );

  const numSubtables = view.getUint16(2, false);

  // Collect subtable offsets, prioritizing platform 3 encoding 1 (Windows BMP)
  // and platform 3 encoding 10 (Windows full Unicode / format 12)
  let format4Offset = -1;
  let format12Offset = -1;
  let fallbackOffset = -1;

  for (let i = 0; i < numSubtables; i++) {
    const base = 4 + i * 8;
    const platformId = view.getUint16(base, false);
    const encodingId = view.getUint16(base + 2, false);
    const subtableOffset = view.getUint32(base + 4, false);

    if (platformId === 3 && encodingId === 10) {
      // Windows full-repertoire — likely format 12
      format12Offset = subtableOffset;
    } else if (platformId === 3 && encodingId === 1) {
      // Windows BMP — likely format 4
      format4Offset = subtableOffset;
    } else if (platformId === 0) {
      // Unicode platform
      if (encodingId >= 3) {
        format12Offset = format12Offset === -1 ? subtableOffset : format12Offset;
      } else {
        fallbackOffset = fallbackOffset === -1 ? subtableOffset : fallbackOffset;
      }
    }
  }

  // Try format 12 first (full Unicode coverage)
  if (format12Offset !== -1) {
    const fmt = view.getUint16(format12Offset, false);
    if (fmt === 12) {
      return parseCmapFormat12(view, format12Offset);
    }
  }

  // Then format 4 (BMP)
  if (format4Offset !== -1) {
    const fmt = view.getUint16(format4Offset, false);
    if (fmt === 4) {
      return parseCmapFormat4(view, format4Offset);
    }
  }

  // Fallback
  if (fallbackOffset !== -1) {
    const fmt = view.getUint16(fallbackOffset, false);
    if (fmt === 4) {
      return parseCmapFormat4(view, fallbackOffset);
    }
    if (fmt === 12) {
      return parseCmapFormat12(view, fallbackOffset);
    }
  }

  // Return empty map if nothing was found
  return new Map();
}

/**
 * Parse cmap format 4 — segment mapping to delta values.
 *
 * This handles the BMP (codepoints 0x0000–0xFFFF).
 */
function parseCmapFormat4(view: DataView, offset: number): Map<number, number> {
  const map = new Map<number, number>();

  const segCountX2 = view.getUint16(offset + 6, false);
  const segCount = segCountX2 >> 1;

  // Arrays within the format 4 subtable
  const endCodeOffset = offset + 14;
  // +2 for reservedPad
  const startCodeOffset = endCodeOffset + segCountX2 + 2;
  const idDeltaOffset = startCodeOffset + segCountX2;
  const idRangeOffsetOffset = idDeltaOffset + segCountX2;

  for (let seg = 0; seg < segCount; seg++) {
    const endCode = view.getUint16(endCodeOffset + seg * 2, false);
    const startCode = view.getUint16(startCodeOffset + seg * 2, false);
    const idDelta = view.getInt16(idDeltaOffset + seg * 2, false);
    const idRangeOffset = view.getUint16(idRangeOffsetOffset + seg * 2, false);

    if (startCode === 0xFFFF) break;

    for (let code = startCode; code <= endCode; code++) {
      let glyphId: number;

      if (idRangeOffset === 0) {
        glyphId = (code + idDelta) & 0xFFFF;
      } else {
        // Index into glyphIdArray
        const glyphIdArrayOffset =
          idRangeOffsetOffset +
          seg * 2 +
          idRangeOffset +
          (code - startCode) * 2;

        if (glyphIdArrayOffset + 1 < view.byteLength) {
          glyphId = view.getUint16(glyphIdArrayOffset, false);
          if (glyphId !== 0) {
            glyphId = (glyphId + idDelta) & 0xFFFF;
          }
        } else {
          glyphId = 0;
        }
      }

      if (glyphId !== 0) {
        map.set(code, glyphId);
      }
    }
  }

  return map;
}

/**
 * Parse cmap format 12 — segmented coverage (full 32-bit codepoints).
 */
function parseCmapFormat12(view: DataView, offset: number): Map<number, number> {
  const map = new Map<number, number>();

  // format 12 layout:
  // offset+0:  format (uint16)  — 12
  // offset+2:  reserved (uint16)
  // offset+4:  length (uint32)
  // offset+8:  language (uint32)
  // offset+12: numGroups (uint32)
  // offset+16: groups[numGroups] — each 12 bytes:
  //   startCharCode (uint32), endCharCode (uint32), startGlyphID (uint32)

  const numGroups = view.getUint32(offset + 12, false);
  let groupOffset = offset + 16;

  for (let i = 0; i < numGroups; i++) {
    const startCharCode = view.getUint32(groupOffset, false);
    const endCharCode = view.getUint32(groupOffset + 4, false);
    const startGlyphId = view.getUint32(groupOffset + 8, false);

    for (let code = startCharCode; code <= endCharCode; code++) {
      const glyphId = startGlyphId + (code - startCharCode);
      map.set(code, glyphId);
    }

    groupOffset += 12;
  }

  return map;
}

/**
 * Parse selected strings from the `name` table.
 *
 * @returns An object with `familyName` (nameID 1) and `postScriptName`
 *          (nameID 6).
 */
function parseNameTable(
  data: Uint8Array,
  nameTableOffset: number,
  nameTableLength: number,
): { familyName: string; postScriptName: string } {
  const view = new DataView(
    data.buffer,
    data.byteOffset + nameTableOffset,
    nameTableLength,
  );

  const count = view.getUint16(2, false);
  const stringOffset = view.getUint16(4, false);

  let familyName = '';
  let postScriptName = '';

  for (let i = 0; i < count; i++) {
    const recordBase = 6 + i * 12;
    const platformId = view.getUint16(recordBase, false);
    const encodingId = view.getUint16(recordBase + 2, false);
    // const languageId = view.getUint16(recordBase + 4, false);
    const nameId = view.getUint16(recordBase + 6, false);
    const length = view.getUint16(recordBase + 8, false);
    const offset = view.getUint16(recordBase + 10, false);

    // Only interested in nameID 1 (family) and 6 (postscript)
    if (nameId !== 1 && nameId !== 6) continue;

    // Prefer Windows platform (3,1) with UTF-16BE encoding
    const absOffset = nameTableOffset + stringOffset + offset;
    let decoded = '';

    if (platformId === 3 && encodingId === 1) {
      // UTF-16BE
      const nameView = new DataView(
        data.buffer,
        data.byteOffset + absOffset,
        length,
      );
      for (let j = 0; j < length; j += 2) {
        decoded += String.fromCharCode(nameView.getUint16(j, false));
      }
    } else if (platformId === 1 && encodingId === 0) {
      // Mac Roman — treat as Latin-1
      for (let j = 0; j < length; j++) {
        decoded += String.fromCharCode(data[absOffset + j]!);
      }
    } else {
      continue;
    }

    if (nameId === 1 && !familyName) {
      familyName = decoded;
    } else if (nameId === 6 && !postScriptName) {
      postScriptName = decoded;
    }

    if (familyName && postScriptName) break;
  }

  return { familyName, postScriptName };
}

// ---------------------------------------------------------------------------
// PDF font flags computation
// ---------------------------------------------------------------------------

/**
 * Compute the /Flags value for a PDF FontDescriptor.
 *
 * Reference: PDF spec §9.8.2, Table 123.
 */
function computeFontFlags(
  os2: Os2Data,
  italicAngle: number,
  isSymbolic: boolean,
): number {
  let flags = 0;

  // Bit 1 (value 1): FixedPitch — check panose[3]
  if (os2.panose[3] === 9) {
    flags |= 1;
  }

  // Bit 2 (value 2): Serif — check panose[1]
  if (os2.panose[1]! >= 2 && os2.panose[1]! <= 10) {
    flags |= 2;
  }

  // Bit 3 (value 4): Symbolic
  if (isSymbolic) {
    flags |= 4;
  }

  // Bit 4 (value 8): Script — check panose[1]
  if (os2.panose[1] === 3) {
    flags |= 8;
  }

  // Bit 6 (value 32): Nonsymbolic — mutually exclusive with Symbolic
  if (!isSymbolic) {
    flags |= 32;
  }

  // Bit 7 (value 64): Italic
  if (italicAngle !== 0 || (os2.fsSelection & 1) !== 0) {
    flags |= 64;
  }

  return flags;
}

/**
 * Estimate StemV from the weight class.
 *
 * StemV is the dominant stem width in font design units.  The PDF spec
 * does not provide a formula; this uses a commonly-used heuristic.
 */
function estimateStemV(usWeightClass: number): number {
  // Rough mapping: weight 400 → ~80, weight 700 → ~140
  return Math.round(10 + 220 * ((usWeightClass / 1000) ** 2));
}

// ---------------------------------------------------------------------------
// Public API: extractMetrics
// ---------------------------------------------------------------------------

/**
 * Extract font metrics from raw TrueType / OpenType font bytes.
 *
 * Parses the `head`, `hhea`, `hmtx`, `cmap`, `maxp`, `OS/2`, `name`,
 * and `post` tables to produce a complete {@link FontMetrics} object.
 *
 * @param fontData - The raw TTF or OTF file as a Uint8Array.
 * @returns Parsed font metrics.
 * @throws If required tables are missing or the data is corrupt.
 */
export function extractMetrics(fontData: Uint8Array): FontMetrics {
  const tables = parseTableDirectory(fontData);

  // Required tables
  const headView = getTableView(fontData, tables, 'head');
  const hheaView = getTableView(fontData, tables, 'hhea');
  const hmtxView = getTableView(fontData, tables, 'hmtx');
  const maxpView = getTableView(fontData, tables, 'maxp');

  // Optional tables
  const os2View = tryGetTableView(fontData, tables, 'OS/2');
  const postView = tryGetTableView(fontData, tables, 'post');

  // Parse required tables
  const head = parseHead(headView);
  const hhea = parseHhea(hheaView);
  const numGlyphs = parseMaxp(maxpView);
  const italicAngle = postView ? parsePost(postView) : 0;

  // Parse hmtx
  const { widths: glyphWidths, defaultWidth } = parseHmtx(
    hmtxView,
    hhea.numberOfHMetrics,
    numGlyphs,
  );

  // Parse OS/2 if present
  let os2: Os2Data | undefined;
  if (os2View && os2View.byteLength >= 78) {
    os2 = parseOs2(os2View);
  }

  // Parse cmap
  const cmapEntry = tables.get('cmap');
  const cmapTable = cmapEntry
    ? parseCmap(fontData, cmapEntry.offset, cmapEntry.length)
    : new Map<number, number>();

  // Parse name table
  const nameEntry = tables.get('name');
  const { familyName, postScriptName } = nameEntry
    ? parseNameTable(fontData, nameEntry.offset, nameEntry.length)
    : { familyName: '', postScriptName: '' };

  // Determine metrics values, preferring OS/2 over hhea
  const ascender = os2 ? os2.sTypoAscender : hhea.ascent;
  const descender = os2 ? os2.sTypoDescender : hhea.descent;
  const lineGap = os2 ? os2.sTypoLineGap : hhea.lineGap;
  const capHeight = os2?.sCapHeight || Math.round(head.unitsPerEm * 0.7);
  const xHeight = os2?.sxHeight || Math.round(head.unitsPerEm * 0.5);

  // Font flags and stemV
  const stemV = os2 ? estimateStemV(os2.usWeightClass) : 80;
  const flags = os2 ? computeFontFlags(os2, italicAngle, false) : 32;

  return {
    unitsPerEm: head.unitsPerEm,
    ascender,
    descender,
    lineGap,
    capHeight,
    xHeight,
    italicAngle,
    numGlyphs,
    defaultWidth,
    glyphWidths,
    cmapTable,
    bbox: [head.xMin, head.yMin, head.xMax, head.yMax] as const,
    stemV,
    flags,
    familyName,
    postScriptName,
  };
}

// ---------------------------------------------------------------------------
// Public API: glyph-level lookups
// ---------------------------------------------------------------------------

/**
 * Map a Unicode codepoint to a glyph ID using the cmap table.
 *
 * @param codepoint - Unicode codepoint (e.g. `0x0041` for 'A').
 * @param cmap      - The cmap lookup table from {@link FontMetrics.cmapTable}.
 * @returns The glyph ID, or 0 (.notdef) if the codepoint is unmapped.
 */
export function getGlyphId(codepoint: number, cmap: Map<number, number>): number {
  return cmap.get(codepoint) ?? 0;
}

/**
 * Get the advance width of a glyph in font design units.
 *
 * @param glyphId      - The glyph ID.
 * @param glyphWidths  - The width map from {@link FontMetrics.glyphWidths}.
 * @param defaultWidth - Default width for missing glyph IDs.
 * @returns The advance width in font design units.
 */
export function getGlyphWidth(
  glyphId: number,
  glyphWidths: Map<number, number>,
  defaultWidth: number,
): number {
  return glyphWidths.get(glyphId) ?? defaultWidth;
}

// ---------------------------------------------------------------------------
// Public API: text measurement
// ---------------------------------------------------------------------------

/**
 * Measure the width of a string at a given font size.
 *
 * Iterates over each Unicode codepoint in the string, looks up the glyph
 * ID via the cmap, retrieves the advance width from the hmtx data, and
 * sums the results.  The total is scaled from font design units to the
 * target font size.
 *
 * @param text     - The text string to measure.
 * @param fontSize - The font size in points.
 * @param metrics  - The font metrics (from {@link extractMetrics}).
 * @returns The total advance width of the string in points.
 */
export function measureText(
  text: string,
  fontSize: number,
  metrics: FontMetrics,
): number {
  const scale = fontSize / metrics.unitsPerEm;
  let totalWidth = 0;

  for (const char of text) {
    const codepoint = char.codePointAt(0)!;
    const glyphId = getGlyphId(codepoint, metrics.cmapTable);
    const advanceWidth = getGlyphWidth(glyphId, metrics.glyphWidths, metrics.defaultWidth);
    totalWidth += advanceWidth;
  }

  return totalWidth * scale;
}

/**
 * Compute the height of the ascender at a given font size.
 *
 * @param fontSize - The font size in points.
 * @param metrics  - The font metrics (from {@link extractMetrics}).
 * @returns The ascender height in points.
 */
export function ascentAtSize(fontSize: number, metrics: FontMetrics): number {
  return (metrics.ascender / metrics.unitsPerEm) * fontSize;
}

/**
 * Compute the descender depth at a given font size (typically negative).
 *
 * @param fontSize - The font size in points.
 * @param metrics  - The font metrics (from {@link extractMetrics}).
 * @returns The descender depth in points (negative value).
 */
export function descentAtSize(fontSize: number, metrics: FontMetrics): number {
  return (metrics.descender / metrics.unitsPerEm) * fontSize;
}

/**
 * Compute the total line height (ascender - descender + lineGap) at a
 * given font size.
 *
 * @param fontSize - The font size in points.
 * @param metrics  - The font metrics (from {@link extractMetrics}).
 * @returns The line height in points.
 */
export function lineHeightAtSize(fontSize: number, metrics: FontMetrics): number {
  const scale = fontSize / metrics.unitsPerEm;
  return (metrics.ascender - metrics.descender + metrics.lineGap) * scale;
}

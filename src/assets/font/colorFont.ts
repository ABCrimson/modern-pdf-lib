/**
 * @module assets/font/colorFont
 *
 * COLR v0 + CPAL color-font parsing (layered color glyphs).
 *
 * This module reads the two OpenType tables that together describe simple,
 * layered color glyphs:
 *
 * - **CPAL** (Color Palette Table): one or more palettes, each a list of
 *   sRGB colors. Color records are stored on disk as **BGRA** bytes and are
 *   exposed here as **RGBA** (0..255 per channel).
 * - **COLR** v0 (Color Table, version 0): maps a *base* glyph to an ordered
 *   list of *layers*. Each layer is another glyph (a monochrome outline) plus
 *   a CPAL palette-entry index giving its color.
 *
 * A renderer paints a color glyph by drawing each layer's outline glyph filled
 * with that layer's resolved palette color, bottom layer first.
 *
 * ## Verified against the OpenType 1.9.1 specification
 *
 * - CPAL header v0 / v1 and the BGRA ColorRecord byte order:
 *   https://learn.microsoft.com/en-us/typography/opentype/spec/cpal
 *   - CPAL v0 header (big-endian): version(u16)\@0, numPaletteEntries(u16)\@2,
 *     numPalettes(u16)\@4, numColorRecords(u16)\@6,
 *     colorRecordsArrayOffset(Offset32)\@8, colorRecordIndices[numPalettes]
 *     (u16 each)\@12.
 *   - "Each color record specifies a color ... using 8-bit BGRA (blue, green,
 *     red, alpha) representation." ColorRecord = blue(u8), green(u8), red(u8),
 *     alpha(u8).
 *   - "colorRecordIndex = colorRecordIndices[paletteIndex] + paletteEntryIndex".
 * - COLR v0 header and records:
 *   https://learn.microsoft.com/en-us/typography/opentype/spec/colr
 *   - COLR v0 header (big-endian): version(u16)\@0, numBaseGlyphRecords(u16)\@2,
 *     baseGlyphRecordsOffset(Offset32)\@4, layerRecordsOffset(Offset32)\@8,
 *     numLayerRecords(u16)\@12.
 *   - BaseGlyph record (6 bytes): glyphID(u16), firstLayerIndex(u16),
 *     numLayers(u16). "The BaseGlyph records must be sorted in increasing
 *     glyphID order ... a binary search can be used" — we binary-search them.
 *   - Layer record (4 bytes): glyphID(u16), paletteIndex(u16).
 *
 * ## Scope
 *
 * - Only **COLR version 0** (flat layered glyphs) is parsed. **COLR version 1**
 *   (PaintColrLayers, gradients, affine transforms, compositing) is OUT OF
 *   SCOPE and intentionally not parsed here.
 * - The CPAL `paletteIndex` special value `0xFFFF` ("use the current text
 *   foreground color") is preserved on each layer via `paletteIndex` but cannot
 *   be resolved to an RGBA value here (there is no palette entry for it); such a
 *   layer is reported with `rgba = [0, 0, 0, 255]` as a neutral fallback. A
 *   renderer should substitute the active foreground color when it sees
 *   `paletteIndex === 0xFFFF`.
 * - This module exposes the *layer + palette model only*. Actually RENDERING or
 *   EMBEDDING color glyphs into a PDF (e.g. as a Type3 font) is OUT OF SCOPE and
 *   left to a consuming renderer.
 *
 * No external dependencies. No Buffer — uses Uint8Array and DataView.
 */

/** The CPAL special palette index meaning "use the text foreground color". */
const FOREGROUND_PALETTE_INDEX = 0xffff;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single COLR layer expressed in its rawest form: the layer's outline glyph
 * id plus the CPAL palette-entry index used to color it.
 */
export interface ColorStop {
  /** The glyph id of the outline drawn for this layer. */
  gid: number;
  /** The CPAL palette-entry index used to color this layer. */
  paletteIndex: number;
}

/**
 * A resolved COLR layer: the outline glyph id, the CPAL palette-entry index,
 * and the RGBA color (0..255 per channel) that index resolves to in the
 * selected palette.
 */
export interface ColorGlyphLayer {
  /** The glyph id of the outline drawn for this layer. */
  glyphId: number;
  /** The CPAL palette-entry index used to color this layer. */
  paletteIndex: number;
  /** Resolved color as [r, g, b, a], each 0..255. */
  rgba: [number, number, number, number];
}

/** A single CPAL palette: an ordered list of RGBA colors (0..255 per channel). */
export interface CpalPalette {
  /** Palette entries as [r, g, b, a], each 0..255. */
  colors: [number, number, number, number][];
}

/** Summary of a font's color capability and its CPAL palettes. */
export interface ColorFontInfo {
  /** True if the font contains a 'COLR' table (i.e. has color glyphs). */
  hasColor: boolean;
  /** Number of palettes in the 'CPAL' table (0 if no CPAL table). */
  numPalettes: number;
  /** The parsed CPAL palettes (empty if no CPAL table). */
  palettes: CpalPalette[];
}

// ---------------------------------------------------------------------------
// sfnt table directory parsing (minimal, big-endian)
// ---------------------------------------------------------------------------

interface TableRecord {
  /** Offset of the table from the start of the font file. */
  offset: number;
  /** Length of the table in bytes. */
  length: number;
}

/**
 * Read the sfnt table directory. The directory is at offset 12 as a sequence
 * of 16-byte records: { tag[4], checksum[4], offset[4], length[4] }, all
 * big-endian. Supports sfnt version 0x00010000 (TrueType) and 'OTTO' (CFF);
 * the actual sfnt version value is not needed beyond reaching the directory.
 *
 * @returns A map from 4-char table tag to its offset/length, or `undefined`
 *   if the data is too small to contain a valid directory.
 */
function readTableDirectory(data: Uint8Array): Map<string, TableRecord> | undefined {
  if (data.length < 12) return undefined;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numTables = view.getUint16(4, false);
  const requiredLen = 12 + numTables * 16;
  if (data.length < requiredLen) return undefined;

  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(
      data[off]!,
      data[off + 1]!,
      data[off + 2]!,
      data[off + 3]!,
    );
    const offset = view.getUint32(off + 8, false);
    const length = view.getUint32(off + 12, false);
    tables.set(tag, { offset, length });
  }
  return tables;
}

/**
 * Return a `DataView` bounded to a single table, or `undefined` if the table
 * is absent or its declared extent falls outside the font data.
 */
function tableView(
  data: Uint8Array,
  tables: Map<string, TableRecord>,
  tag: string,
): DataView | undefined {
  const rec = tables.get(tag);
  if (rec === undefined) return undefined;
  if (rec.offset + rec.length > data.length) return undefined;
  return new DataView(data.buffer, data.byteOffset + rec.offset, rec.length);
}

// ---------------------------------------------------------------------------
// CPAL parsing
// ---------------------------------------------------------------------------

/**
 * Parse the CPAL table into palettes of RGBA colors.
 *
 * Handles CPAL versions 0 and 1 (the v1 trailing offset arrays are ignored —
 * they only carry optional UI labels and palette-type flags). Color records
 * are read as BGRA bytes and converted to RGBA.
 *
 * @returns The parsed palettes, or `undefined` if the table is malformed.
 */
function parseCpal(view: DataView): CpalPalette[] | undefined {
  if (view.byteLength < 12) return undefined;

  // Header (shared by v0 and v1).
  // version\@0 is read but only validated as <= 1; layout up to colorRecord-
  // Indices is identical for both versions.
  const numPaletteEntries = view.getUint16(2, false);
  const numPalettes = view.getUint16(4, false);
  const numColorRecords = view.getUint16(6, false);
  const colorRecordsArrayOffset = view.getUint32(8, false);

  // colorRecordIndices[numPalettes] starts at offset 12 (u16 each).
  const indicesStart = 12;
  if (indicesStart + numPalettes * 2 > view.byteLength) return undefined;

  // Bounds-check the color records array.
  if (colorRecordsArrayOffset + numColorRecords * 4 > view.byteLength) {
    return undefined;
  }

  const colorRecordIndices: number[] = [];
  for (let i = 0; i < numPalettes; i++) {
    colorRecordIndices.push(view.getUint16(indicesStart + i * 2, false));
  }

  const palettes: CpalPalette[] = [];
  for (let p = 0; p < numPalettes; p++) {
    const firstRecord = colorRecordIndices[p]!;
    const colors: [number, number, number, number][] = [];
    for (let e = 0; e < numPaletteEntries; e++) {
      // colorRecordIndex = colorRecordIndices[paletteIndex] + paletteEntryIndex
      const recIndex = firstRecord + e;
      if (recIndex >= numColorRecords) {
        // Spec requires numColorRecords >= max(index) + numPaletteEntries;
        // if a font violates this, stop filling this palette rather than read
        // out of bounds.
        break;
      }
      const recOff = colorRecordsArrayOffset + recIndex * 4;
      // ColorRecord on disk is BGRA: blue\@0, green\@1, red\@2, alpha\@3.
      const blue = view.getUint8(recOff + 0);
      const green = view.getUint8(recOff + 1);
      const red = view.getUint8(recOff + 2);
      const alpha = view.getUint8(recOff + 3);
      colors.push([red, green, blue, alpha]);
    }
    palettes.push({ colors });
  }

  return palettes;
}

// ---------------------------------------------------------------------------
// COLR v0 parsing
// ---------------------------------------------------------------------------

interface ColrV0 {
  /** baseGlyphRecordsOffset from the COLR header (relative to COLR start). */
  baseGlyphRecordsOffset: number;
  /** Number of base-glyph records. */
  numBaseGlyphRecords: number;
  /** layerRecordsOffset from the COLR header (relative to COLR start). */
  layerRecordsOffset: number;
  /** Number of layer records. */
  numLayerRecords: number;
  /** The COLR table's bounded view. */
  view: DataView;
}

/**
 * Read the COLR v0 header. Returns `undefined` if the table is too small or
 * its declared offsets/counts fall outside the table.
 */
function readColrV0(view: DataView): ColrV0 | undefined {
  if (view.byteLength < 14) return undefined;

  // version\@0 — we only handle v0's flat layer model. v1 tables advertise
  // version 1 here and add fields after offset 14; we deliberately read only
  // the v0 base/layer record arrays, which v1 retains for backward compat.
  const numBaseGlyphRecords = view.getUint16(2, false);
  const baseGlyphRecordsOffset = view.getUint32(4, false);
  const layerRecordsOffset = view.getUint32(8, false);
  const numLayerRecords = view.getUint16(12, false);

  if (
    baseGlyphRecordsOffset + numBaseGlyphRecords * 6 > view.byteLength ||
    layerRecordsOffset + numLayerRecords * 4 > view.byteLength
  ) {
    return undefined;
  }

  return {
    baseGlyphRecordsOffset,
    numBaseGlyphRecords,
    layerRecordsOffset,
    numLayerRecords,
    view,
  };
}

/**
 * Binary-search the base-glyph records (sorted by glyphID, per spec) for the
 * record matching `glyphId`.
 *
 * @returns `{ firstLayerIndex, numLayers }` or `undefined` if not a base glyph.
 */
function findBaseGlyph(
  colr: ColrV0,
  glyphId: number,
): { firstLayerIndex: number; numLayers: number } | undefined {
  const { view, baseGlyphRecordsOffset } = colr;
  let lo = 0;
  let hi = colr.numBaseGlyphRecords - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const recOff = baseGlyphRecordsOffset + mid * 6;
    const gid = view.getUint16(recOff, false);
    if (gid === glyphId) {
      return {
        firstLayerIndex: view.getUint16(recOff + 2, false),
        numLayers: view.getUint16(recOff + 4, false),
      };
    }
    if (gid < glyphId) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a font's color capability and CPAL palettes.
 *
 * `hasColor` is true iff the font contains a 'COLR' table. The palettes come
 * from the 'CPAL' table (which is required whenever 'COLR' is present, per the
 * OpenType spec). Color records are returned as RGBA (converted from the on-disk
 * BGRA layout).
 *
 * @param fontData - Raw sfnt font bytes (TrueType 0x00010000 or 'OTTO').
 * @returns Color info; `{ hasColor: false, numPalettes: 0, palettes: [] }` if
 *   the font has no COLR/CPAL tables or cannot be parsed.
 */
export function parseColorFont(fontData: Uint8Array): ColorFontInfo {
  const empty: ColorFontInfo = { hasColor: false, numPalettes: 0, palettes: [] };

  const tables = readTableDirectory(fontData);
  if (tables === undefined) return empty;

  const hasColor = tables.has('COLR');

  const cpalView = tableView(fontData, tables, 'CPAL');
  if (cpalView === undefined) {
    return { hasColor, numPalettes: 0, palettes: [] };
  }

  const palettes = parseCpal(cpalView);
  if (palettes === undefined) {
    return { hasColor, numPalettes: 0, palettes: [] };
  }

  return { hasColor, numPalettes: palettes.length, palettes };
}

/**
 * Resolve the COLR v0 layers of a base glyph into colored layers.
 *
 * For each layer of the requested base glyph, the layer's outline glyph id is
 * returned together with its CPAL palette-entry index and the RGBA color that
 * index resolves to in the selected palette.
 *
 * A glyph that is **not** a COLR base glyph (or a font with no COLR/CPAL table)
 * returns `[]` — such a glyph is drawn as a normal monochrome glyph.
 *
 * The special palette index `0xFFFF` ("foreground color") is preserved on the
 * layer's `paletteIndex` but, having no palette entry, resolves to the neutral
 * fallback `[0, 0, 0, 255]`; a renderer should substitute the active text color.
 *
 * @param fontData - Raw sfnt font bytes.
 * @param glyphId - The base glyph id to expand.
 * @param paletteIndex - Which CPAL palette to resolve colors from. Defaults to
 *   palette 0 (the default palette). Out-of-range values fall back to palette 0.
 * @returns The ordered (bottom-first) list of colored layers, or `[]`.
 */
export function getColorGlyphLayers(
  fontData: Uint8Array,
  glyphId: number,
  paletteIndex: number = 0,
): ColorGlyphLayer[] {
  const tables = readTableDirectory(fontData);
  if (tables === undefined) return [];

  const colrView = tableView(fontData, tables, 'COLR');
  if (colrView === undefined) return [];

  const colr = readColrV0(colrView);
  if (colr === undefined) return [];

  const base = findBaseGlyph(colr, glyphId);
  if (base === undefined) return [];

  // Resolve palettes for color lookup (may be empty if CPAL is missing/bad).
  const cpalView = tableView(fontData, tables, 'CPAL');
  const palettes = cpalView !== undefined ? parseCpal(cpalView) : undefined;
  const selectedPalette =
    palettes !== undefined && palettes.length > 0
      ? (palettes[paletteIndex] ?? palettes[0]!)
      : undefined;

  const layers: ColorGlyphLayer[] = [];
  const { view, layerRecordsOffset, numLayerRecords } = colr;
  for (let i = 0; i < base.numLayers; i++) {
    const layerIndex = base.firstLayerIndex + i;
    if (layerIndex >= numLayerRecords) break; // malformed font guard
    const recOff = layerRecordsOffset + layerIndex * 4;
    const layerGid = view.getUint16(recOff, false);
    const layerPaletteIndex = view.getUint16(recOff + 2, false);

    let rgba: [number, number, number, number] = [0, 0, 0, 255];
    if (
      layerPaletteIndex !== FOREGROUND_PALETTE_INDEX &&
      selectedPalette !== undefined &&
      layerPaletteIndex < selectedPalette.colors.length
    ) {
      const c = selectedPalette.colors[layerPaletteIndex]!;
      rgba = [c[0], c[1], c[2], c[3]];
    }

    layers.push({
      glyphId: layerGid,
      paletteIndex: layerPaletteIndex,
      rgba,
    });
  }

  return layers;
}

/**
 * @module assets/font/fontEmbed
 *
 * Font embedding pipeline — takes raw TTF/OTF font bytes and produces
 * the complete set of PDF objects needed to embed a TrueType (CIDFont
 * Type 2) font in a PDF document.
 *
 * The pipeline:
 * 1. Extract metrics from the font binary (cmap, hmtx, head, hhea, OS/2)
 * 2. Track glyphs as text is drawn
 * 3. At save time: subset the font (if WASM available), build CID font
 *    dictionaries, ToUnicode CMap, and FontDescriptor
 *
 * Produces PDF objects conforming to:
 * - /Font (Type0) — top-level composite font dictionary
 * - /DescendantFonts — CIDFont Type 2 dictionary
 * - /FontDescriptor — font metrics for the PDF viewer
 * - /CIDSystemInfo — character collection info
 * - /ToUnicode — CMap for text extraction
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

import type { FontMetrics } from './fontMetrics.js';
import { extractMetrics, measureText, getGlyphId, getGlyphWidth } from './fontMetrics.js';
import { subsetFont, buildSubsetCmap, computeSubsetTag } from './fontSubset.js';
import type { SubsetResult, SubsetCmap } from './fontSubset.js';

// ---------------------------------------------------------------------------
// WASM font parser state (optional acceleration for metric extraction)
// ---------------------------------------------------------------------------

/**
 * Interface for the wasm-bindgen FontInfo result from the TTF WASM module.
 *
 * Matches the `FontInfo` struct exported by `src/wasm/ttf/src/lib.rs`.
 * Getters return LE byte arrays for glyph widths and cmap entries.
 *
 * @internal
 */
interface FontInfoWasm {
  readonly units_per_em: number;
  readonly ascender: number;
  readonly descender: number;
  readonly line_gap: number;
  readonly glyph_count: number;
  /** Flat LE u16 bytes — 2 bytes per glyph. */
  readonly glyph_widths: Uint8Array;
  /** Packed [codepoint_u32_le, glyph_id_u16_le, ...] — 6 bytes per entry. */
  readonly cmap_entries: Uint8Array;
  readonly family_name: string;
  readonly subfamily_name: string;
  readonly postscript_name: string;
  readonly is_cff: boolean;
  free(): void;
}

/**
 * Interface for the TTF WASM module (wasm-bindgen exports).
 * @internal
 */
interface FontParserWasmModule {
  parse_font(data: Uint8Array): FontInfoWasm;
}

/** The loaded font parser WASM module, or undefined if not available. */
let fontParserWasm: FontParserWasmModule | undefined;

/**
 * Initialize the WASM-accelerated font parser.
 *
 * When loaded, `embedFont()` uses the WASM module for metric extraction
 * instead of the pure JS parser. This is faster for large fonts but
 * produces identical results.
 *
 * @param wasmSource - A pre-built wasm-bindgen module, or omit to auto-locate.
 */
export async function initFontParserWasm(
  wasmSource?: FontParserWasmModule,
): Promise<void> {
  if (fontParserWasm) return;

  try {
    if (wasmSource && typeof wasmSource.parse_font === 'function') {
      fontParserWasm = wasmSource;
      return;
    }

    const { loadWasmModule } = await import('../../wasm/loader.js');
    const wasmBytes = await loadWasmModule('ttf');
    const imports = { env: {} };
    const result = await WebAssembly.instantiate(
      wasmBytes.buffer as ArrayBuffer,
      imports,
    );
    fontParserWasm = result.instance.exports as unknown as FontParserWasmModule;
  } catch {
    fontParserWasm = undefined;
  }
}

/**
 * Check whether the WASM font parser has been initialized.
 */
export function isFontParserWasmReady(): boolean {
  return fontParserWasm !== undefined;
}

/**
 * Extract metrics using the WASM font parser.
 *
 * Converts the wasm-bindgen `FontInfo` result into a `FontMetrics`
 * object compatible with the rest of the embedding pipeline.
 *
 * @internal
 */
function extractMetricsWasm(fontData: Uint8Array): FontMetrics {
  const info = fontParserWasm!.parse_font(fontData);

  // Parse glyph widths from LE u16 bytes
  const glyphWidths = new Map<number, number>();
  const widthBytes = info.glyph_widths;
  const widthView = new DataView(widthBytes.buffer, widthBytes.byteOffset, widthBytes.byteLength);
  const numGlyphs = info.glyph_count;
  let defaultWidth = 0;

  for (let i = 0; i < numGlyphs; i++) {
    const w = widthView.getUint16(i * 2, true); // LE u16
    glyphWidths.set(i, w);
    defaultWidth = w; // last width becomes default
  }

  // Parse cmap from packed 6-byte entries
  const cmapTable = new Map<number, number>();
  const cmapBytes = info.cmap_entries;
  const cmapView = new DataView(cmapBytes.buffer, cmapBytes.byteOffset, cmapBytes.byteLength);
  const cmapCount = cmapBytes.byteLength / 6;

  for (let i = 0; i < cmapCount; i++) {
    const codepoint = cmapView.getUint32(i * 6, true);     // LE u32
    const glyphId = cmapView.getUint16(i * 6 + 4, true);   // LE u16
    cmapTable.set(codepoint, glyphId);
  }

  const metrics: FontMetrics = {
    unitsPerEm: info.units_per_em,
    ascender: info.ascender,
    descender: info.descender,
    lineGap: info.line_gap,
    capHeight: Math.round(info.units_per_em * 0.7), // estimate
    xHeight: Math.round(info.units_per_em * 0.5),   // estimate
    italicAngle: 0,
    numGlyphs,
    defaultWidth,
    glyphWidths,
    cmapTable,
    bbox: [0, info.descender, info.units_per_em, info.ascender],
    stemV: 80,
    flags: 32, // Nonsymbolic
    familyName: info.family_name,
    postScriptName: info.postscript_name,
  };

  info.free();
  return metrics;
}

// ---------------------------------------------------------------------------
// EmbeddedFont class
// ---------------------------------------------------------------------------

/**
 * Represents a TrueType / OpenType font that has been loaded for
 * embedding in a PDF document.
 *
 * Tracks which glyphs have been used so that subsetting can be
 * performed at save time, and provides text measurement methods.
 *
 * Create via `PdfDocument.embedFont()`.
 */
export class EmbeddedFont {
  /** The raw font file bytes. */
  readonly fontData: Uint8Array;

  /** Extracted font metrics. */
  readonly metrics: FontMetrics;

  /** Set of glyph IDs that have been used (for subsetting). */
  private readonly usedGlyphs = new Set<number>();

  /** @internal */
  constructor(fontData: Uint8Array, metrics: FontMetrics) {
    this.fontData = fontData;
    this.metrics = metrics;

    // Always include .notdef
    this.usedGlyphs.add(0);
  }

  // -----------------------------------------------------------------------
  // Text measurement
  // -----------------------------------------------------------------------

  /**
   * Compute the width of a text string at the given font size.
   *
   * This also records all glyph IDs used by the text for subsetting.
   *
   * @param text     - The text string to measure.
   * @param fontSize - The font size in points.
   * @returns The total advance width in points.
   */
  widthOfTextAtSize(text: string, fontSize: number): number {
    const scale = fontSize / this.metrics.unitsPerEm;
    let totalWidth = 0;

    for (const char of text) {
      const codepoint = char.codePointAt(0)!;
      const glyphId = getGlyphId(codepoint, this.metrics.cmapTable);
      const advance = getGlyphWidth(
        glyphId,
        this.metrics.glyphWidths,
        this.metrics.defaultWidth,
      );

      this.usedGlyphs.add(glyphId);
      totalWidth += advance;
    }

    return totalWidth * scale;
  }

  /**
   * Compute the height of the font at the given size.
   *
   * Returns the distance from the descender to the ascender line,
   * which is the "em height" scaled to the font size.
   *
   * @param fontSize - The font size in points.
   * @returns The font height in points.
   */
  heightAtSize(fontSize: number): number {
    const { ascender, descender, unitsPerEm } = this.metrics;
    return ((ascender - descender) / unitsPerEm) * fontSize;
  }

  /**
   * Compute the ascender height at the given font size.
   *
   * @param fontSize - The font size in points.
   * @returns The ascender height in points (positive).
   */
  ascentAtSize(fontSize: number): number {
    return (this.metrics.ascender / this.metrics.unitsPerEm) * fontSize;
  }

  /**
   * Compute the descender depth at the given font size.
   *
   * @param fontSize - The font size in points.
   * @returns The descender depth in points (negative).
   */
  descentAtSize(fontSize: number): number {
    return (this.metrics.descender / this.metrics.unitsPerEm) * fontSize;
  }

  /**
   * Compute the cap height at the given font size.
   *
   * @param fontSize - The font size in points.
   * @returns The cap height in points.
   */
  capHeightAtSize(fontSize: number): number {
    return (this.metrics.capHeight / this.metrics.unitsPerEm) * fontSize;
  }

  /**
   * Compute the line height (ascent - descent + lineGap) at size.
   *
   * @param fontSize - The font size in points.
   * @returns The default line height in points.
   */
  lineHeightAtSize(fontSize: number): number {
    const { ascender, descender, lineGap, unitsPerEm } = this.metrics;
    return ((ascender - descender + lineGap) / unitsPerEm) * fontSize;
  }

  // -----------------------------------------------------------------------
  // Glyph tracking
  // -----------------------------------------------------------------------

  /**
   * Mark a Unicode codepoint as used (records its glyph ID for subsetting).
   *
   * @param codepoint - The Unicode codepoint.
   */
  markCodepointUsed(codepoint: number): void {
    const glyphId = getGlyphId(codepoint, this.metrics.cmapTable);
    this.usedGlyphs.add(glyphId);
  }

  /**
   * Mark a glyph ID as used directly.
   *
   * @param glyphId - The glyph ID.
   */
  markGlyphUsed(glyphId: number): void {
    this.usedGlyphs.add(glyphId);
  }

  /**
   * Mark all codepoints in a text string as used.
   *
   * @param text - The text string.
   */
  markTextUsed(text: string): void {
    for (const char of text) {
      const codepoint = char.codePointAt(0)!;
      const glyphId = getGlyphId(codepoint, this.metrics.cmapTable);
      this.usedGlyphs.add(glyphId);
    }
  }

  /**
   * Get the set of all glyph IDs that have been used.
   */
  getUsedGlyphs(): ReadonlySet<number> {
    return this.usedGlyphs;
  }

  // -----------------------------------------------------------------------
  // Encoding: codepoint → CID bytes for content streams
  // -----------------------------------------------------------------------

  /**
   * Encode a text string as hex-encoded CID bytes for use in PDF
   * content stream `Tj` / `TJ` operators.
   *
   * For a CIDFont Type 2 with Identity-H encoding, each character is
   * mapped to its glyph ID and encoded as a 2-byte big-endian value.
   *
   * @param text - The text to encode.
   * @returns Hex string (e.g. `"00480065006C006C006F"` for "Hello").
   */
  encodeText(text: string): string {
    const bytes: number[] = [];

    for (const char of text) {
      const codepoint = char.codePointAt(0)!;
      const glyphId = getGlyphId(codepoint, this.metrics.cmapTable);

      this.usedGlyphs.add(glyphId);

      // 2-byte big-endian
      bytes.push((glyphId >> 8) & 0xFF, glyphId & 0xFF);
    }

    return new Uint8Array(bytes).toHex();
  }

  // -----------------------------------------------------------------------
  // PDF object generation
  // -----------------------------------------------------------------------

  /**
   * Build the complete set of PDF dictionary data needed to embed this
   * font.  This performs subsetting (if WASM is available) and generates
   * all required dictionaries.
   *
   * Call this at document save time, after all text has been drawn.
   *
   * @returns The embedding result containing all PDF object data.
   */
  buildEmbedding(): FontEmbeddingResult {
    // 1. Subset the font
    const subsetResult = subsetFont(this.fontData, this.usedGlyphs);

    // 2. Build the ToUnicode CMap
    const cmapResult = buildSubsetCmap(subsetResult, this.metrics.cmapTable);

    // 3. Compute the subset tag
    const subsetTag = computeSubsetTag(this.usedGlyphs);
    const baseFontName = this.metrics.postScriptName || this.metrics.familyName || 'Font';
    const subsetFontName = `${subsetTag}+${baseFontName}`;

    // 4. Build CIDFont width array (W array)
    const wArray = buildWidthArray(subsetResult, this.metrics);

    // 5. Build the font descriptor data
    const { unitsPerEm, ascender, descender, capHeight, italicAngle, bbox, stemV, flags } =
      this.metrics;

    const fontDescriptor: FontDescriptorData = {
      fontName: subsetFontName,
      flags,
      bbox: [
        Math.round((bbox[0] * 1000) / unitsPerEm),
        Math.round((bbox[1] * 1000) / unitsPerEm),
        Math.round((bbox[2] * 1000) / unitsPerEm),
        Math.round((bbox[3] * 1000) / unitsPerEm),
      ],
      italicAngle,
      ascent: Math.round((ascender * 1000) / unitsPerEm),
      descent: Math.round((descender * 1000) / unitsPerEm),
      capHeight: Math.round((capHeight * 1000) / unitsPerEm),
      stemV,
    };

    // 6. Build the CIDSystemInfo
    const cidSystemInfo: CIDSystemInfoData = {
      registry: 'Adobe',
      ordering: 'Identity',
      supplement: 0,
    };

    // 7. Build the CIDFont (DescendantFont) data
    const cidFont: CIDFontData = {
      subtype: 'CIDFontType2',
      baseFont: subsetFontName,
      cidSystemInfo,
      wArray,
      defaultWidth: Math.round((this.metrics.defaultWidth * 1000) / unitsPerEm),
    };

    // 8. Build the top-level Type 0 font data
    const type0Font: Type0FontData = {
      baseFont: subsetFontName,
      encoding: 'Identity-H',
    };

    return {
      type0Font,
      cidFont,
      fontDescriptor,
      toUnicodeCmap: cmapResult.cmapStream,
      fontProgram: subsetResult.fontData,
      subsetResult,
      cmapResult,
    };
  }
}

// ---------------------------------------------------------------------------
// Embedding result types
// ---------------------------------------------------------------------------

/**
 * Data for the `/CIDSystemInfo` dictionary.
 */
export interface CIDSystemInfoData {
  readonly registry: string;
  readonly ordering: string;
  readonly supplement: number;
}

/**
 * Data for the `/FontDescriptor` dictionary.
 */
export interface FontDescriptorData {
  readonly fontName: string;
  readonly flags: number;
  readonly bbox: readonly [number, number, number, number];
  readonly italicAngle: number;
  readonly ascent: number;
  readonly descent: number;
  readonly capHeight: number;
  readonly stemV: number;
}

/**
 * Data for the CIDFont (DescendantFont) dictionary.
 */
export interface CIDFontData {
  readonly subtype: 'CIDFontType2';
  readonly baseFont: string;
  readonly cidSystemInfo: CIDSystemInfoData;
  /**
   * The /W (widths) array entries.  Each entry is either:
   * - `[cid, [w1, w2, ...]]` — individual widths starting at `cid`
   * - `[cidFirst, cidLast, width]` — range with uniform width
   */
  readonly wArray: readonly WidthEntry[];
  readonly defaultWidth: number;
}

/**
 * An entry in the CIDFont /W array.
 *
 * Format 1: `{ start, widths }` — individual widths for consecutive CIDs.
 * Format 2: `{ first, last, width }` — range with uniform width.
 */
export type WidthEntry =
  | { readonly kind: 'individual'; readonly start: number; readonly widths: readonly number[] }
  | { readonly kind: 'range'; readonly first: number; readonly last: number; readonly width: number };

/**
 * Data for the top-level /Font (Type 0) dictionary.
 */
export interface Type0FontData {
  readonly baseFont: string;
  readonly encoding: string;
}

/**
 * The complete result of building a font embedding.
 */
export interface FontEmbeddingResult {
  /** Top-level Type 0 font dictionary data. */
  readonly type0Font: Type0FontData;
  /** CIDFont (DescendantFont) dictionary data. */
  readonly cidFont: CIDFontData;
  /** FontDescriptor dictionary data. */
  readonly fontDescriptor: FontDescriptorData;
  /** ToUnicode CMap stream body. */
  readonly toUnicodeCmap: string;
  /** Subsetted (or full) font program bytes. */
  readonly fontProgram: Uint8Array;
  /** Raw subset result for advanced use. */
  readonly subsetResult: SubsetResult;
  /** Raw CMap result for advanced use. */
  readonly cmapResult: SubsetCmap;
}

// ---------------------------------------------------------------------------
// Width array builder
// ---------------------------------------------------------------------------

/**
 * Build the /W array for the CIDFont dictionary.
 *
 * The /W array maps CIDs (new glyph IDs) to widths in thousandths of
 * a unit of text space.  We group consecutive CIDs with the same width
 * into ranges, and others into individual-width arrays.
 *
 * @internal
 */
function buildWidthArray(
  subsetResult: SubsetResult,
  metrics: FontMetrics,
): WidthEntry[] {
  const entries: WidthEntry[] = [];
  const scale = 1000 / metrics.unitsPerEm;

  // Collect (newGid, scaledWidth) pairs
  const widthPairs: { cid: number; width: number }[] = [];
  for (let newGid = 0; newGid < subsetResult.newToOldGid.length; newGid++) {
    const oldGid = subsetResult.newToOldGid[newGid]!;
    const rawWidth = getGlyphWidth(oldGid, metrics.glyphWidths, metrics.defaultWidth);
    const scaledWidth = Math.round(rawWidth * scale);
    widthPairs.push({ cid: newGid, width: scaledWidth });
  }

  // Group into consecutive runs
  let runStart = 0;
  while (runStart < widthPairs.length) {
    // Find the end of a consecutive CID sequence
    let runEnd = runStart;
    while (
      runEnd + 1 < widthPairs.length &&
      widthPairs[runEnd + 1]!.cid === widthPairs[runEnd]!.cid + 1
    ) {
      runEnd++;
    }

    // Check if all widths in this run are the same
    const firstWidth = widthPairs[runStart]!.width;
    let allSame = true;
    for (let i = runStart + 1; i <= runEnd; i++) {
      if (widthPairs[i]!.width !== firstWidth) {
        allSame = false;
        break;
      }
    }

    if (allSame && runEnd - runStart >= 2) {
      // Range entry
      entries.push({
        kind: 'range',
        first: widthPairs[runStart]!.cid,
        last: widthPairs[runEnd]!.cid,
        width: firstWidth,
      });
    } else {
      // Individual widths entry
      const widths: number[] = [];
      for (let i = runStart; i <= runEnd; i++) {
        widths.push(widthPairs[i]!.width);
      }
      entries.push({
        kind: 'individual',
        start: widthPairs[runStart]!.cid,
        widths,
      });
    }

    runStart = runEnd + 1;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Serialization helpers (for PdfObjectRegistry integration)
// ---------------------------------------------------------------------------

/**
 * Serialize a /W array to the PDF array syntax string.
 *
 * @param wEntries - The width entries from {@link CIDFontData.wArray}.
 * @returns A string like `[0 [278 556 722] 10 20 500]`.
 */
export function serializeWidthArray(wEntries: readonly WidthEntry[]): string {
  const parts: string[] = [];

  for (const entry of wEntries) {
    if (entry.kind === 'individual') {
      parts.push(`${entry.start} [${entry.widths.join(' ')}]`);
    } else {
      parts.push(`${entry.first} ${entry.last} ${entry.width}`);
    }
  }

  return `[${parts.join(' ')}]`;
}

/**
 * Generate the /ToUnicode CMap stream for text extraction.
 *
 * This is a convenience wrapper that calls {@link buildSubsetCmap}
 * and returns just the stream string.
 *
 * @param subsetResult      - The subset result.
 * @param originalCmapTable - The original cmap table.
 * @returns The CMap stream content string.
 */
export function generateToUnicodeCmap(
  subsetResult: SubsetResult,
  originalCmapTable: ReadonlyMap<number, number>,
): string {
  const result = buildSubsetCmap(subsetResult, originalCmapTable);
  return result.cmapStream;
}

// ---------------------------------------------------------------------------
// Public API: embedFont
// ---------------------------------------------------------------------------

/**
 * Load and prepare a TrueType / OpenType font for embedding in a PDF.
 *
 * Parses the font binary to extract metrics, and returns an
 * {@link EmbeddedFont} that tracks glyph usage for subsetting.
 *
 * @param fontBytes - The raw TTF or OTF file as a Uint8Array.
 * @returns A promise resolving to an EmbeddedFont instance.
 *
 * @example
 * ```ts
 * const fontData = await readFile('Roboto-Regular.ttf');
 * const font = await embedFont(fontData);
 *
 * const width = font.widthOfTextAtSize('Hello, world!', 12);
 * const height = font.heightAtSize(12);
 *
 * // At save time:
 * const embedding = font.buildEmbedding();
 * ```
 */
export async function embedFont(fontBytes: Uint8Array): Promise<EmbeddedFont> {
  // Validate minimum size
  if (fontBytes.length < 12) {
    throw new Error('Font data too small — expected at least 12 bytes for the table directory');
  }

  // Use WASM-accelerated parsing when available, pure JS otherwise
  const metrics = fontParserWasm
    ? extractMetricsWasm(fontBytes)
    : extractMetrics(fontBytes);

  return new EmbeddedFont(fontBytes, metrics);
}

/**
 * Synchronous version of {@link embedFont}.
 *
 * Use this when the async overhead is unnecessary (the current
 * implementation is fully synchronous anyway, but the async version
 * is preferred for forward-compatibility with WASM-based parsing).
 *
 * @param fontBytes - The raw TTF or OTF file as a Uint8Array.
 * @returns An EmbeddedFont instance.
 */
export function embedFontSync(fontBytes: Uint8Array): EmbeddedFont {
  if (fontBytes.length < 12) {
    throw new Error('Font data too small — expected at least 12 bytes for the table directory');
  }

  const metrics = extractMetrics(fontBytes);
  return new EmbeddedFont(fontBytes, metrics);
}

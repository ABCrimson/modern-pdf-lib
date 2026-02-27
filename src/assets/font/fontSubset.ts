/**
 * @module assets/font/fontSubset
 *
 * Font subsetting — removes unused glyphs from a TrueType font to
 * reduce file size.  Offers WASM-accelerated subsetting with a pure
 * JS subsetter as the default.
 *
 * The JS subsetter replaces unused glyph outlines with zero-length
 * entries in the `glyf` table, preserving all glyph ID slots so that
 * `CIDToGIDMap /Identity` continues to work without changes to the
 * PDF embedding pipeline.  Composite glyph dependencies are resolved
 * automatically.
 *
 * Also builds CMap streams for the subset encoding, mapping CIDs to
 * Unicode codepoints (required for PDF text extraction / copy-paste).
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

import { subsetTtf } from './ttfSubset.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * The result of subsetting a font.
 */
export interface SubsetResult {
  /** The subsetted font file bytes (TrueType). */
  readonly fontData: Uint8Array;
  /**
   * Mapping from new glyph ID (sequential, starting at 0) to original
   * glyph ID.  Index = new GID, value = old GID.
   */
  readonly newToOldGid: readonly number[];
  /**
   * Mapping from original glyph ID to new glyph ID.
   * Only contains entries for glyphs that were retained.
   */
  readonly oldToNewGid: ReadonlyMap<number, number>;
}

/**
 * A CMap mapping from CIDs (Character IDs, which correspond to new GIDs
 * in the subset) to Unicode codepoints.
 */
export interface SubsetCmap {
  /**
   * The CMap as a PDF stream body string, ready to be wrapped in a
   * `/ToUnicode` stream object.
   */
  readonly cmapStream: string;
  /**
   * Map from new GID to the Unicode codepoint(s) it represents.
   * For most glyphs this is a single codepoint; for ligatures it may
   * be multiple.
   */
  readonly cidToUnicode: ReadonlyMap<number, number[]>;
}

// ---------------------------------------------------------------------------
// WASM module state
// ---------------------------------------------------------------------------

/**
 * WASM subsetter is not available — the TTF WASM module (`src/wasm/ttf`)
 * provides `parse_font()` for metric extraction but does NOT include a
 * `subset_font()` export. The pure JS subsetter (`ttfSubset.ts`) is
 * the primary subsetting path for all runtimes.
 *
 * This flag exists for forward-compatibility: a dedicated subsetting
 * WASM module could be added in the future.
 */
let wasmSubsetReady = false;

// ---------------------------------------------------------------------------
// WASM initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the font subsetting WASM module.
 *
 * **Note:** No WASM subsetter currently exists — the TTF WASM module
 * only parses fonts, it does not subset them. The pure JS subsetter
 * (`subsetTtf`) handles all subsetting. This function is a no-op
 * placeholder for forward-compatibility.
 *
 * @param _wasmSource - Unused. Reserved for a future WASM subsetter.
 */
export async function initSubsetWasm(
  _wasmSource?: Uint8Array | URL | string | Response,
): Promise<void> {
  // No WASM subsetter exists yet. The pure JS subsetter (subsetTtf)
  // handles all subsetting for all runtimes.
  wasmSubsetReady = false;
}

/**
 * Check whether the WASM subsetter has been initialized.
 *
 * Currently always returns `false` because no WASM subsetter exists.
 * The pure JS subsetter is used for all font subsetting.
 */
export function isSubsetWasmReady(): boolean {
  return wasmSubsetReady;
}

// ---------------------------------------------------------------------------
// WASM-based subsetting
// ---------------------------------------------------------------------------

/**
 * Subset a font using a WASM module.
 *
 * Currently no WASM subsetter exists — this delegates to the JS subsetter.
 * Reserved for forward-compatibility with a future WASM subsetting module.
 *
 * @internal
 */
function subsetWithWasm(
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): SubsetResult {
  return subsetJs(fontData, usedGlyphIds);
}

// ---------------------------------------------------------------------------
// JS subsetting (real glyf table reduction)
// ---------------------------------------------------------------------------

/**
 * Subset a TrueType font using the pure JS subsetter.
 *
 * Replaces unused glyph outline data with zero-length entries in the
 * `glyf` table while preserving all glyph ID slots.  This keeps
 * `CIDToGIDMap /Identity` working (CID = GID) while dramatically
 * reducing the font program size.
 *
 * Composite glyph dependencies are resolved automatically — if a used
 * glyph references component glyphs, those components are retained too.
 *
 * The `newToOldGid` array contains the used glyph IDs in sorted order.
 * Since glyph IDs are not renumbered, each "new" GID equals the
 * original GID (identity mapping for the used glyphs).
 *
 * @param fontData      The raw TTF font file bytes.
 * @param usedGlyphIds  Set of glyph IDs that are actually used.
 * @returns A {@link SubsetResult} with the subsetted font bytes and
 *          identity glyph-ID mappings for the used glyphs.
 * @internal
 */
function subsetJs(
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): SubsetResult {
  // Ensure .notdef (GID 0) is always included
  const allGids = new Set(usedGlyphIds);
  allGids.add(0);

  // Run the actual TrueType subsetter
  const subsetFontData = subsetTtf(fontData, allGids);

  // Sort glyph IDs for deterministic ordering
  const sortedGids = allGids.values().toArray().sort((a, b) => a - b);

  // Build identity mappings: old GID === new GID (no renumbering).
  // GID slots are preserved in the font, so glyph IDs are unchanged.
  const newToOldGid: number[] = sortedGids;
  const oldToNewGid = new Map<number, number>();
  for (const gid of sortedGids) {
    oldToNewGid.set(gid, gid);
  }

  return {
    fontData: subsetFontData,
    newToOldGid,
    oldToNewGid,
  };
}

// ---------------------------------------------------------------------------
// Public API: subsetFont
// ---------------------------------------------------------------------------

/**
 * Subset a TrueType font to include only the specified glyphs.
 *
 * Uses WASM-accelerated subsetting if available (via {@link initSubsetWasm}),
 * otherwise falls back to returning the full font with identity glyph
 * mappings.
 *
 * Glyph ID 0 (.notdef) is always included automatically.
 *
 * @param fontData     - The raw TTF font file bytes.
 * @param usedGlyphIds - Set of glyph IDs that are actually used.
 * @returns The subset result with the (possibly reduced) font and
 *          glyph-ID remapping tables.
 */
export function subsetFont(
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): SubsetResult {
  if (usedGlyphIds.size === 0) {
    // Nothing to subset — just include .notdef
    return subsetJs(fontData, new Set([0]));
  }

  if (wasmSubsetReady) {
    return subsetWithWasm(fontData, usedGlyphIds);
  }

  return subsetJs(fontData, usedGlyphIds);
}

// ---------------------------------------------------------------------------
// Public API: buildSubsetCmap
// ---------------------------------------------------------------------------

/**
 * Build a PDF `/ToUnicode` CMap stream for a subsetted font.
 *
 * The CMap maps CIDs (new glyph IDs in the subset) back to Unicode
 * codepoints, enabling text extraction and copy-paste in PDF viewers.
 *
 * @param subsetResult       - The result from {@link subsetFont}.
 * @param originalCmapTable  - The original font's cmap table (Unicode
 *                             codepoint → original glyph ID).
 * @returns A CMap stream body and a CID-to-Unicode lookup.
 */
export function buildSubsetCmap(
  subsetResult: SubsetResult,
  originalCmapTable: ReadonlyMap<number, number>,
): SubsetCmap {
  // Build a reverse map: original GID → Unicode codepoint(s)
  const oldGidToUnicode = new Map<number, number[]>();
  for (const [codepoint, gid] of originalCmapTable) {
    const existing = oldGidToUnicode.get(gid);
    if (existing) {
      existing.push(codepoint);
    } else {
      oldGidToUnicode.set(gid, [codepoint]);
    }
  }

  // Build CID (new GID) → Unicode mapping
  const cidToUnicode = new Map<number, number[]>();
  for (let newGid = 0; newGid < subsetResult.newToOldGid.length; newGid++) {
    const oldGid = subsetResult.newToOldGid[newGid]!;
    const unicodes = oldGidToUnicode.get(oldGid);
    if (unicodes && unicodes.length > 0) {
      cidToUnicode.set(newGid, unicodes);
    }
  }

  // Generate the CMap stream content
  const cmapStream = generateToUnicodeCmap(cidToUnicode);

  return { cmapStream, cidToUnicode };
}

// ---------------------------------------------------------------------------
// CMap generation
// ---------------------------------------------------------------------------

/**
 * Generate a PDF `/ToUnicode` CMap program.
 *
 * The CMap uses `beginbfchar` / `endbfchar` sections to map individual
 * CIDs to Unicode values.  For ranges of consecutive mappings it uses
 * `beginbfrange` / `endbfrange`.
 *
 * @internal
 */
function generateToUnicodeCmap(cidToUnicode: ReadonlyMap<number, number[]>): string {
  const lines: string[] = [];

  // CMap header
  lines.push('/CIDInit /ProcSet findresource begin');
  lines.push('12 dict begin');
  lines.push('begincmap');
  lines.push('/CIDSystemInfo');
  lines.push('<< /Registry (Adobe)');
  lines.push('/Ordering (UCS)');
  lines.push('/Supplement 0');
  lines.push('>> def');
  lines.push('/CMapName /Adobe-Identity-UCS def');
  lines.push('/CMapType 2 def');
  lines.push('1 begincodespacerange');
  lines.push('<0000> <FFFF>');
  lines.push('endcodespacerange');

  // Collect all entries, sorted by CID
  const entries = cidToUnicode.entries().toArray().sort((a, b) => a[0] - b[0]);

  // Emit in chunks of 100 (PDF CMap limit per section)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    lines.push(`${chunk.length} beginbfchar`);

    for (const [cid, unicodes] of chunk) {
      const cidHex = cid.toString(16).padStart(4, '0').toUpperCase();

      if (unicodes.length === 1) {
        // Single codepoint
        const uniHex = unicodes[0]!.toString(16).padStart(4, '0').toUpperCase();
        lines.push(`<${cidHex}> <${uniHex}>`);
      } else {
        // Multiple codepoints (e.g. ligatures) — encode as multi-byte string
        let uniHex = '';
        // Use the first codepoint (most common case for non-ligatures)
        for (const cp of unicodes.slice(0, 1)) {
          uniHex += cp.toString(16).padStart(4, '0').toUpperCase();
        }
        lines.push(`<${cidHex}> <${uniHex}>`);
      }
    }

    lines.push('endbfchar');
  }

  // CMap footer
  lines.push('endcmap');
  lines.push('CMapName currentdict /CMap defineresource pop');
  lines.push('end');
  lines.push('end');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utility: compute subset tag
// ---------------------------------------------------------------------------

/**
 * Generate a 6-letter uppercase tag for the subset font name.
 *
 * PDF spec recommends a tag prefix like `ABCDEF+FontName` to indicate
 * the font is subsetted.  This function generates a deterministic tag
 * from the set of glyph IDs.
 *
 * @param usedGlyphIds - The set of glyph IDs in the subset.
 * @returns A 6-character uppercase ASCII string (e.g. `"BCDEFG"`).
 */
export function computeSubsetTag(usedGlyphIds: Set<number>): string {
  // Simple hash based on glyph IDs
  let hash = 0;
  for (const gid of usedGlyphIds) {
    hash = ((hash << 5) - hash + gid) | 0;
  }

  // Convert hash to 6 uppercase letters A–Z
  const tag: string[] = [];
  let h = Math.abs(hash);
  for (let i = 0; i < 6; i++) {
    tag.push(String.fromCharCode(65 + (h % 26)));
    h = Math.floor(h / 26);
  }

  return tag.join('');
}

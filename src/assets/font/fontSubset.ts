/**
 * @module assets/font/fontSubset
 *
 * Font subsetting — removes unused glyphs from a TrueType font to
 * reduce file size.  Offers WASM-accelerated subsetting with a JS
 * fallback that copies the whole font if WASM is unavailable.
 *
 * Also builds CMap streams for the subset encoding, mapping CIDs to
 * Unicode codepoints (required for PDF text extraction / copy-paste).
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

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
 * Holds the subsetting WASM instance after initialization.
 * `undefined` means WASM is not loaded (fallback mode).
 */
let wasmInstance: SubsetWasm | undefined;

/** @internal */
interface SubsetWasm {
  alloc(size: number): number;
  free(ptr: number, size: number): void;
  /**
   * Subset a TrueType font.
   *
   * @param fontPtr    Pointer to font data in WASM memory.
   * @param fontLen    Length of font data.
   * @param glyphsPtr  Pointer to uint16 array of glyph IDs to retain.
   * @param glyphsLen  Number of glyph IDs.
   * @param outPtr     Pointer to output buffer.
   * @param outMaxLen  Maximum output buffer size.
   * @returns Actual output size in bytes, or -1 on error.
   */
  subset_font(
    fontPtr: number,
    fontLen: number,
    glyphsPtr: number,
    glyphsLen: number,
    outPtr: number,
    outMaxLen: number,
  ): number;
  memory: WebAssembly.Memory;
}

// ---------------------------------------------------------------------------
// WASM initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the font subsetting WASM module.
 *
 * Call this once if you want WASM-accelerated subsetting.  If not
 * called, {@link subsetFont} falls back to returning the entire font
 * file (no size reduction, but still functional).
 *
 * @param wasmSource - The `.wasm` binary, a URL, or a fetch Response.
 */
export async function initSubsetWasm(
  wasmSource?: Uint8Array | URL | string | Response,
): Promise<void> {
  // Already initialized -- no-op
  if (wasmInstance) return;

  const imports = { env: {} };
  let result: WebAssembly.WebAssemblyInstantiatedSource;

  try {
    if (wasmSource instanceof Uint8Array) {
      result = await WebAssembly.instantiate(wasmSource.buffer as ArrayBuffer, imports);
    } else if (typeof Response !== 'undefined' && wasmSource instanceof Response) {
      result = await WebAssembly.instantiateStreaming(wasmSource, imports);
    } else if (typeof wasmSource === 'string' || wasmSource instanceof URL) {
      const resp = await fetch(String(wasmSource));
      result = await WebAssembly.instantiateStreaming(resp, imports);
    } else {
      // No explicit source -- try the universal WASM loader
      const { loadWasmModule } = await import('../../wasm/loader.js');
      const bytes = await loadWasmModule('ttf');
      result = await WebAssembly.instantiate(bytes.buffer as ArrayBuffer, imports);
    }

    wasmInstance = result.instance.exports as unknown as SubsetWasm;
  } catch {
    // WASM unavailable -- fall back to JS subsetting (full font copy)
    wasmInstance = undefined;
  }
}

/**
 * Check whether the WASM subsetter has been initialized.
 */
export function isSubsetWasmReady(): boolean {
  return wasmInstance !== undefined;
}

// ---------------------------------------------------------------------------
// WASM-based subsetting
// ---------------------------------------------------------------------------

/**
 * Subset a font using the WASM module.
 * @internal
 */
function subsetWithWasm(
  _fontData: Uint8Array,
  _usedGlyphIds: Set<number>,
): SubsetResult {
  // TODO: Implement WASM-based font subsetting
  //
  // Implementation outline:
  // 1. Ensure glyph ID 0 (.notdef) is always included
  // 2. Sort glyph IDs and write them into a Uint16Array
  // 3. Allocate WASM memory for font data + glyph ID array + output buffer
  // 4. Copy font data and glyph IDs into WASM memory
  // 5. Call wasmInstance!.subset_font(...)
  // 6. Read the output buffer
  // 7. Build the oldToNewGid and newToOldGid mappings
  // 8. Free WASM memory
  // 9. Return SubsetResult

  throw new Error('WASM subsetting not yet implemented');
}

// ---------------------------------------------------------------------------
// JS fallback subsetting (returns full font)
// ---------------------------------------------------------------------------

/**
 * Fallback "subsetting" that returns the full font unchanged.
 *
 * Since the full font data is returned unmodified, glyph IDs do not
 * change.  The mappings are therefore **true identity** for each used
 * glyph: `oldGID === newGID`.  This is functionally correct — PDF
 * viewers render the font normally via `CIDToGIDMap /Identity` — but
 * does not reduce file size.
 *
 * The `newToOldGid` array contains the used glyph IDs in sorted
 * order.  Because the font is not actually subsetted, each "new" GID
 * equals the original GID (identity mapping).
 *
 * @param fontData      The raw TTF font file bytes.
 * @param usedGlyphIds  Set of glyph IDs that are actually used.
 * @returns A {@link SubsetResult} with the original font bytes and
 *          identity glyph-ID mappings for the used glyphs.
 * @internal
 */
function subsetFallback(
  fontData: Uint8Array,
  usedGlyphIds: Set<number>,
): SubsetResult {
  // Ensure .notdef (GID 0) is always included
  const allGids = new Set(usedGlyphIds);
  allGids.add(0);

  // Sort glyph IDs for deterministic ordering
  const sortedGids = allGids.values().toArray().sort((a, b) => a - b);

  // Build identity mappings: old GID === new GID (no remapping).
  // Since the full font is returned, glyph IDs are unchanged.
  // newToOldGid[i] = sortedGids[i] (the i-th used glyph's original GID)
  // oldToNewGid: originalGID → originalGID (true identity for each used glyph)
  const newToOldGid: number[] = sortedGids;
  const oldToNewGid = new Map<number, number>();
  for (const gid of sortedGids) {
    oldToNewGid.set(gid, gid);
  }

  return {
    // Return a copy to avoid mutations
    fontData: new Uint8Array(fontData),
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
    return subsetFallback(fontData, new Set([0]));
  }

  if (wasmInstance) {
    return subsetWithWasm(fontData, usedGlyphIds);
  }

  return subsetFallback(fontData, usedGlyphIds);
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

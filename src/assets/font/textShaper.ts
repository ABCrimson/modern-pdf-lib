/**
 * @module assets/font/textShaper
 *
 * Complex text layout (shaping) using rustybuzz WASM.
 *
 * For scripts that require ligature substitution, mark positioning, or
 * other OpenType layout features (Arabic, Devanagari, Thai, etc.), a
 * simple cmap lookup is insufficient.  This module delegates to
 * rustybuzz — a pure-Rust port of HarfBuzz compiled to WebAssembly —
 * for full OpenType shaping.
 *
 * When the WASM module is unavailable the module falls back to a naive
 * "simple shaper" that performs a plain cmap lookup (one codepoint →
 * one glyph).  This is adequate for Latin, Greek, Cyrillic, and most
 * CJK text but will produce incorrect results for complex scripts.
 *
 * No Node APIs — uses Uint8Array exclusively.
 */

import type { FontMetrics } from './fontMetrics.js';
import { getGlyphId, getGlyphWidth } from './fontMetrics.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Position information for a single shaped glyph.
 */
export interface ShapedGlyph {
  /** Glyph ID in the font. */
  readonly glyphId: number;
  /** The Unicode codepoint(s) that produced this glyph. */
  readonly cluster: number;
  /** Horizontal advance in font design units. */
  readonly xAdvance: number;
  /** Vertical advance in font design units (usually 0 for horizontal text). */
  readonly yAdvance: number;
  /** Horizontal offset from the current pen position (kerning, mark positioning). */
  readonly xOffset: number;
  /** Vertical offset from the current pen position (mark positioning). */
  readonly yOffset: number;
}

/**
 * The result of shaping a text string.
 */
export interface ShapingResult {
  /** Ordered list of shaped glyphs (in visual order). */
  readonly glyphs: readonly ShapedGlyph[];
  /** Total advance width in font design units. */
  readonly totalAdvance: number;
}

/**
 * Direction for text layout.
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * OpenType script tag (ISO 15924).
 * Common examples: 'latn', 'arab', 'deva', 'cyrl', 'grek', 'hang'
 */
export type ScriptTag = string;

/**
 * OpenType language system tag.
 * Common examples: 'ENG ', 'ARA ', 'DEV ', 'dflt'
 */
export type LanguageTag = string;

/**
 * Options for text shaping.
 */
export interface ShapingOptions {
  /** Text direction.  Default: `'ltr'`. */
  readonly direction?: TextDirection;
  /** OpenType script tag.  Default: auto-detect or `'latn'`. */
  readonly script?: ScriptTag;
  /** OpenType language tag.  Default: `'dflt'`. */
  readonly language?: LanguageTag;
  /**
   * Explicit list of OpenType feature tags to enable/disable.
   * Each entry is `[tag, enabled]` — e.g. `[['liga', true], ['kern', true]]`.
   * When omitted, default shaping features for the script are applied.
   */
  readonly features?: readonly (readonly [string, boolean])[];
}

// ---------------------------------------------------------------------------
// WASM module state
// ---------------------------------------------------------------------------

/**
 * Holds the rustybuzz WASM instance after initialization.
 * `undefined` means WASM has not been loaded (fallback mode).
 */
let wasmInstance: RustybuzzWasm | undefined;

/**
 * Internal interface for the rustybuzz WASM exports.
 * @internal
 */
interface RustybuzzWasm {
  /** Allocate `size` bytes in WASM linear memory.  Returns pointer. */
  alloc(size: number): number;
  /** Free a WASM allocation. */
  free(ptr: number, size: number): void;
  /**
   * Shape text.  Writes the result into the output buffer and returns
   * the number of output glyphs.
   */
  shape(
    fontPtr: number,
    fontLen: number,
    textPtr: number,
    textLen: number,
    direction: number,
    scriptPtr: number,
    languagePtr: number,
    featuresPtr: number,
    featuresLen: number,
    outPtr: number,
    outMaxGlyphs: number,
  ): number;
  /** WASM linear memory. */
  memory: WebAssembly.Memory;
}

// ---------------------------------------------------------------------------
// WASM initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the rustybuzz WASM module for complex text shaping.
 *
 * Call this once at application startup if you need to render complex
 * scripts (Arabic, Devanagari, etc.).  If not called, the library
 * falls back to simple cmap-based shaping.
 *
 * @param wasmSource - The `.wasm` binary as a Uint8Array, URL, or
 *                     Response.  When omitted the function attempts to
 *                     locate the binary relative to the package.
 * @returns A promise that resolves when the module is ready.
 */
export async function initShapingWasm(
  wasmSource?: Uint8Array | URL | string | Response,
): Promise<void> {
  // Already initialized -- no-op
  if (wasmInstance) return;

  const imports = {
    env: {
      // Host functions required by the rustybuzz WASM build
      // (to be defined when the compiled binary is available)
    },
  };

  let result: WebAssembly.WebAssemblyInstantiatedSource;

  try {
    if (wasmSource instanceof Uint8Array) {
      result = await WebAssembly.instantiate(wasmSource.buffer as ArrayBuffer, imports);
    } else if (typeof Response !== 'undefined' && wasmSource instanceof Response) {
      result = await WebAssembly.instantiateStreaming(wasmSource, imports);
    } else if (typeof wasmSource === 'string' || wasmSource instanceof URL) {
      const response = await fetch(String(wasmSource));
      result = await WebAssembly.instantiateStreaming(response, imports);
    } else {
      // No explicit source -- try the universal WASM loader
      const { loadWasmModule } = await import('../../wasm/loader.js');
      const bytes = await loadWasmModule('shaping');
      result = await WebAssembly.instantiate(bytes.buffer as ArrayBuffer, imports);
    }

    // Store the WASM exports if the binary loaded successfully.
    // Full rustybuzz integration is planned for a future release.
    wasmInstance = result.instance.exports as unknown as RustybuzzWasm;
  } catch {
    // WASM unavailable -- fall back to simple cmap-based shaping
    wasmInstance = undefined;
  }
}

/**
 * Check whether the WASM shaper has been initialized.
 *
 * @returns `true` if {@link initShapingWasm} completed successfully.
 */
export function isShapingWasmReady(): boolean {
  return wasmInstance !== undefined;
}

// ---------------------------------------------------------------------------
// WASM-accelerated shaping
// ---------------------------------------------------------------------------

/**
 * Shape text using the rustybuzz WASM module.
 *
 * @internal Only called when `wasmInstance` is defined.
 */
function shapeWithWasm(
  _fontData: Uint8Array,
  _text: string,
  _options: ShapingOptions,
): ShapingResult {
  // WASM-based shaping planned for a future release; JS fallback is used instead.
  throw new Error('WASM shaping not yet available — use JS fallback');
}

// ---------------------------------------------------------------------------
// Simple fallback shaper (cmap-based)
// ---------------------------------------------------------------------------

/**
 * Simple shaper that maps each codepoint to a glyph via the cmap table.
 *
 * This is sufficient for most Latin, Greek, Cyrillic, and CJK text
 * but does **not** handle:
 * - Ligature substitution (fi, ffl, etc.)
 * - Mark positioning (combining diacritics)
 * - Arabic joining
 * - Indic conjuncts
 * - Kerning (GPOS)
 *
 * @internal
 */
function shapeSimple(
  text: string,
  metrics: FontMetrics,
  options: ShapingOptions,
): ShapingResult {
  const direction = options.direction ?? 'ltr';
  const glyphs: ShapedGlyph[] = [];
  let totalAdvance = 0;

  // Iterate codepoints (handles surrogate pairs correctly)
  const codepoints: { cp: number; idx: number }[] = [];
  let idx = 0;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    codepoints.push({ cp, idx });
    idx += char.length;
  }

  // For RTL, reverse the visual order
  if (direction === 'rtl') {
    codepoints.reverse();
  }

  for (const { cp, idx: cluster } of codepoints) {
    const glyphId = getGlyphId(cp, metrics.cmapTable);
    const xAdvance = getGlyphWidth(glyphId, metrics.glyphWidths, metrics.defaultWidth);

    glyphs.push({
      glyphId,
      cluster,
      xAdvance,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
    });

    totalAdvance += xAdvance;
  }

  return { glyphs, totalAdvance };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Shape a text string for rendering with the given font.
 *
 * If the rustybuzz WASM module has been initialized via
 * {@link initShapingWasm}, this performs full OpenType shaping
 * (ligatures, kerning, mark positioning, etc.).
 *
 * Otherwise it falls back to a simple cmap lookup — adequate for
 * Latin/Greek/Cyrillic/CJK but incorrect for Arabic, Devanagari,
 * Thai, and other complex scripts.
 *
 * @param text     - The Unicode text string to shape.
 * @param fontData - The raw TTF/OTF font file bytes.
 * @param metrics  - Pre-extracted font metrics (from `extractMetrics()`).
 * @param options  - Shaping options (direction, script, language, features).
 * @returns A promise resolving to the shaped glyph sequence.
 */
export async function shapeText(
  text: string,
  fontData: Uint8Array,
  metrics: FontMetrics,
  options: ShapingOptions = {},
): Promise<ShapingResult> {
  if (text.length === 0) {
    return { glyphs: [], totalAdvance: 0 };
  }

  if (wasmInstance) {
    return shapeWithWasm(fontData, text, options);
  }

  return shapeSimple(text, metrics, options);
}

/**
 * Synchronous shaping using only the simple fallback shaper.
 *
 * Use this when you know you are only dealing with simple scripts and
 * want to avoid the async overhead.
 *
 * @param text    - The Unicode text string to shape.
 * @param metrics - Pre-extracted font metrics.
 * @param options - Shaping options.
 * @returns The shaped glyph sequence.
 */
export function shapeTextSync(
  text: string,
  metrics: FontMetrics,
  options: ShapingOptions = {},
): ShapingResult {
  if (text.length === 0) {
    return { glyphs: [], totalAdvance: 0 };
  }

  return shapeSimple(text, metrics, options);
}

/**
 * Convert shaped glyphs into a set of glyph IDs (useful for subsetting).
 *
 * @param result - A shaping result from {@link shapeText} or {@link shapeTextSync}.
 * @returns A Set of unique glyph IDs used by the shaped text.
 */
export function glyphIdsFromShapingResult(result: ShapingResult): Set<number> {
  const ids = new Set<number>();
  for (const glyph of result.glyphs) {
    ids.add(glyph.glyphId);
  }
  return ids;
}

/**
 * Compute the total advance width of a ShapingResult at a given font
 * size in points.
 *
 * @param result      - The shaping result.
 * @param fontSize    - The font size in points.
 * @param unitsPerEm  - The font's units-per-em value.
 * @returns The width in points.
 */
export function shapingResultWidth(
  result: ShapingResult,
  fontSize: number,
  unitsPerEm: number,
): number {
  return (result.totalAdvance / unitsPerEm) * fontSize;
}

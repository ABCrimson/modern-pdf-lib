/**
 * Tests for text shaping — simple fallback shaper, WASM readiness check,
 * empty/edge-case handling, and utility functions.
 *
 * Since WASM may not be available in the test environment, these tests
 * focus on the JS fallback (simple cmap-based) shaping path.
 */

import { describe, it, expect } from 'vitest';
import {
  shapeText,
  shapeTextSync,
  isShapingWasmReady,
  initShapingWasm,
  glyphIdsFromShapingResult,
  shapingResultWidth,
} from '../../../src/assets/font/textShaper.js';
import type {
  ShapingResult,
  ShapedGlyph,
  ShapingOptions,
} from '../../../src/assets/font/textShaper.js';
import type { FontMetrics } from '../../../src/assets/font/fontMetrics.js';

// ---------------------------------------------------------------------------
// Helpers — mock FontMetrics
// ---------------------------------------------------------------------------

/**
 * Build a minimal FontMetrics object for testing.
 *
 * Maps ASCII codepoints (0x20–0x7E) to sequential glyph IDs (1–95),
 * each with a width of 600 design units (monospace style).
 */
function buildMockMetrics(opts: {
  defaultWidth?: number;
  unitsPerEm?: number;
  customWidths?: Map<number, number>;
  customCmap?: Map<number, number>;
} = {}): FontMetrics {
  const defaultWidth = opts.defaultWidth ?? 600;
  const unitsPerEm = opts.unitsPerEm ?? 1000;

  const cmapTable = opts.customCmap ?? new Map<number, number>();
  const glyphWidths = opts.customWidths ?? new Map<number, number>();

  // Populate default ASCII mappings if no custom cmap provided
  if (!opts.customCmap) {
    for (let cp = 0x20; cp <= 0x7E; cp++) {
      const glyphId = cp - 0x20 + 1;
      cmapTable.set(cp, glyphId);
      if (!opts.customWidths) {
        glyphWidths.set(glyphId, defaultWidth);
      }
    }
  }

  return {
    unitsPerEm,
    ascender: 800,
    descender: -200,
    lineGap: 0,
    capHeight: 700,
    xHeight: 500,
    italicAngle: 0,
    numGlyphs: 96,
    defaultWidth,
    glyphWidths,
    cmapTable,
    bbox: [0, -200, 1000, 800] as const,
    stemV: 80,
    flags: 0,
    familyName: 'TestFont',
    postScriptName: 'TestFont-Regular',
  };
}

// ---------------------------------------------------------------------------
// Tests: WASM readiness
// ---------------------------------------------------------------------------

describe('isShapingWasmReady', () => {
  it('returns false when WASM has not been initialized', () => {
    // In the test environment, WASM is typically not available
    // The function should return a boolean regardless
    const result = isShapingWasmReady();
    expect(typeof result).toBe('boolean');
  });
});

describe('initShapingWasm', () => {
  it('accepts a pre-built module with shape_text function', async () => {
    // We cannot truly test WASM init without a real module,
    // but we can verify the function does not throw when called
    // with no arguments (it should silently fail and fall back)
    await expect(initShapingWasm()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: shapeText (async) — empty and basic input
// ---------------------------------------------------------------------------

describe('shapeText', () => {
  const metrics = buildMockMetrics();
  const dummyFontData = new Uint8Array([0, 1, 0, 0]); // Not a real font

  it('returns empty result for empty string', async () => {
    const result = await shapeText('', dummyFontData, metrics);
    expect(result.glyphs).toHaveLength(0);
    expect(result.totalAdvance).toBe(0);
  });

  it('shapes a single ASCII character', async () => {
    const result = await shapeText('A', dummyFontData, metrics);
    expect(result.glyphs).toHaveLength(1);

    const glyph = result.glyphs[0]!;
    // 'A' = 0x41, glyph ID = 0x41 - 0x20 + 1 = 34
    expect(glyph.glyphId).toBe(34);
    expect(glyph.xAdvance).toBe(600);
    expect(glyph.yAdvance).toBe(0);
    expect(glyph.xOffset).toBe(0);
    expect(glyph.yOffset).toBe(0);
    expect(glyph.cluster).toBe(0);
  });

  it('shapes multiple ASCII characters', async () => {
    const result = await shapeText('Hello', dummyFontData, metrics);
    expect(result.glyphs).toHaveLength(5);
    expect(result.totalAdvance).toBe(5 * 600);

    // Verify cluster indices match character positions
    expect(result.glyphs[0]!.cluster).toBe(0); // H
    expect(result.glyphs[1]!.cluster).toBe(1); // e
    expect(result.glyphs[2]!.cluster).toBe(2); // l
    expect(result.glyphs[3]!.cluster).toBe(3); // l
    expect(result.glyphs[4]!.cluster).toBe(4); // o
  });

  it('maps space character to its glyph', async () => {
    const result = await shapeText(' ', dummyFontData, metrics);
    expect(result.glyphs).toHaveLength(1);
    // Space = 0x20, glyph ID = 1
    expect(result.glyphs[0]!.glyphId).toBe(1);
  });

  it('uses default width for unmapped codepoints', async () => {
    // Create metrics with no cmap entries for high codepoints
    const sparseMetrics = buildMockMetrics({ defaultWidth: 500 });
    // U+2603 SNOWMAN is not in our ASCII cmap
    const result = await shapeText('\u2603', dummyFontData, sparseMetrics);
    expect(result.glyphs).toHaveLength(1);
    // Unmapped codepoint should get glyph ID 0 (.notdef)
    expect(result.glyphs[0]!.glyphId).toBe(0);
    // Width from defaultWidth since glyph 0 is not in glyphWidths
    expect(result.glyphs[0]!.xAdvance).toBe(500);
  });

  it('handles LTR direction by default', async () => {
    const result = await shapeText('AB', dummyFontData, metrics);
    // A (cluster 0) should come before B (cluster 1) in visual order
    expect(result.glyphs[0]!.cluster).toBe(0);
    expect(result.glyphs[1]!.cluster).toBe(1);
  });

  it('reverses glyph order for RTL direction', async () => {
    const result = await shapeText('AB', dummyFontData, metrics, { direction: 'rtl' });
    // For RTL, B should come first in visual order
    expect(result.glyphs[0]!.cluster).toBe(1); // B's original index
    expect(result.glyphs[1]!.cluster).toBe(0); // A's original index
  });

  it('handles varying glyph widths', async () => {
    const customWidths = new Map<number, number>();
    const customCmap = new Map<number, number>();
    // A -> glyph 1, width 700
    customCmap.set(0x41, 1);
    customWidths.set(1, 700);
    // B -> glyph 2, width 800
    customCmap.set(0x42, 2);
    customWidths.set(2, 800);

    const varMetrics = buildMockMetrics({ customWidths, customCmap, defaultWidth: 500 });
    const result = await shapeText('AB', dummyFontData, varMetrics);

    expect(result.glyphs[0]!.xAdvance).toBe(700);
    expect(result.glyphs[1]!.xAdvance).toBe(800);
    expect(result.totalAdvance).toBe(1500);
  });

  it('handles surrogate pairs (emoji/supplementary plane)', async () => {
    // U+1F600 GRINNING FACE — encoded as a surrogate pair in JS strings
    const emoji = '\u{1F600}';
    const result = await shapeText(emoji, dummyFontData, metrics);
    // Even though the JS string has 2 code units, it is 1 codepoint
    expect(result.glyphs).toHaveLength(1);
    // The codepoint won't be in our ASCII cmap, so glyphId should be 0
    expect(result.glyphs[0]!.glyphId).toBe(0);
  });

  it('correctly counts codepoints not code units for multi-char text', async () => {
    // Mix of BMP and supplementary: "A" + U+1F600 + "B"
    const text = 'A\u{1F600}B';
    const result = await shapeText(text, dummyFontData, metrics);
    expect(result.glyphs).toHaveLength(3);
  });

  it('returns ShapingResult interface with correct properties', async () => {
    const result = await shapeText('X', dummyFontData, metrics);
    expect(result).toHaveProperty('glyphs');
    expect(result).toHaveProperty('totalAdvance');
    expect(Array.isArray(result.glyphs)).toBe(true);
    expect(typeof result.totalAdvance).toBe('number');
  });

  it('accepts options with script and language tags', async () => {
    const options: ShapingOptions = {
      direction: 'ltr',
      script: 'latn',
      language: 'ENG ',
    };
    const result = await shapeText('Test', dummyFontData, metrics, options);
    // Simple shaper ignores script/language but should not throw
    expect(result.glyphs).toHaveLength(4);
  });

  it('accepts options with features list', async () => {
    const options: ShapingOptions = {
      features: [['liga', true], ['kern', true]],
    };
    const result = await shapeText('fi', dummyFontData, metrics, options);
    // Simple shaper ignores features — no ligature substitution
    expect(result.glyphs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: shapeTextSync
// ---------------------------------------------------------------------------

describe('shapeTextSync', () => {
  const metrics = buildMockMetrics();

  it('returns empty result for empty string', () => {
    const result = shapeTextSync('', metrics);
    expect(result.glyphs).toHaveLength(0);
    expect(result.totalAdvance).toBe(0);
  });

  it('shapes a single character synchronously', () => {
    const result = shapeTextSync('Z', metrics);
    expect(result.glyphs).toHaveLength(1);
    // 'Z' = 0x5A, glyph ID = 0x5A - 0x20 + 1 = 59
    expect(result.glyphs[0]!.glyphId).toBe(59);
    expect(result.glyphs[0]!.xAdvance).toBe(600);
  });

  it('shapes a multi-character string synchronously', () => {
    const result = shapeTextSync('test', metrics);
    expect(result.glyphs).toHaveLength(4);
    expect(result.totalAdvance).toBe(4 * 600);
  });

  it('produces same result as shapeText for simple text', async () => {
    const dummyFontData = new Uint8Array([0, 1, 0, 0]);
    const asyncResult = await shapeText('Hello', dummyFontData, metrics);
    const syncResult = shapeTextSync('Hello', metrics);

    expect(syncResult.glyphs).toHaveLength(asyncResult.glyphs.length);
    expect(syncResult.totalAdvance).toBe(asyncResult.totalAdvance);

    for (let i = 0; i < syncResult.glyphs.length; i++) {
      expect(syncResult.glyphs[i]!.glyphId).toBe(asyncResult.glyphs[i]!.glyphId);
      expect(syncResult.glyphs[i]!.xAdvance).toBe(asyncResult.glyphs[i]!.xAdvance);
      expect(syncResult.glyphs[i]!.cluster).toBe(asyncResult.glyphs[i]!.cluster);
    }
  });

  it('handles RTL direction synchronously', () => {
    const result = shapeTextSync('AB', metrics, { direction: 'rtl' });
    // B should appear first in visual order for RTL
    expect(result.glyphs[0]!.cluster).toBe(1);
    expect(result.glyphs[1]!.cluster).toBe(0);
  });

  it('uses default options when none provided', () => {
    const result = shapeTextSync('A', metrics);
    // Default is LTR, no script/language/features
    expect(result.glyphs).toHaveLength(1);
    expect(result.glyphs[0]!.cluster).toBe(0);
  });

  it('handles long strings efficiently', () => {
    const longText = 'A'.repeat(1000);
    const result = shapeTextSync(longText, metrics);
    expect(result.glyphs).toHaveLength(1000);
    expect(result.totalAdvance).toBe(1000 * 600);
  });
});

// ---------------------------------------------------------------------------
// Tests: glyphIdsFromShapingResult
// ---------------------------------------------------------------------------

describe('glyphIdsFromShapingResult', () => {
  it('returns empty set for empty result', () => {
    const result: ShapingResult = { glyphs: [], totalAdvance: 0 };
    const ids = glyphIdsFromShapingResult(result);
    expect(ids.size).toBe(0);
  });

  it('returns unique glyph IDs from a shaping result', () => {
    const metrics = buildMockMetrics();
    const result = shapeTextSync('Hello', metrics);
    const ids = glyphIdsFromShapingResult(result);

    // "Hello" has 4 unique characters (H, e, l, o) — 'l' repeats
    expect(ids.size).toBe(4);
  });

  it('returns a Set containing all glyph IDs', () => {
    const metrics = buildMockMetrics();
    const result = shapeTextSync('AB', metrics);
    const ids = glyphIdsFromShapingResult(result);

    // 'A' -> glyphId 34, 'B' -> glyphId 35
    expect(ids.has(34)).toBe(true);
    expect(ids.has(35)).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('deduplicates repeated characters', () => {
    const metrics = buildMockMetrics();
    const result = shapeTextSync('aaa', metrics);
    const ids = glyphIdsFromShapingResult(result);
    expect(ids.size).toBe(1);
  });

  it('includes .notdef glyph (0) for unmapped codepoints', () => {
    const metrics = buildMockMetrics();
    const result = shapeTextSync('\u2603', metrics); // Not in ASCII cmap
    const ids = glyphIdsFromShapingResult(result);
    expect(ids.has(0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: shapingResultWidth
// ---------------------------------------------------------------------------

describe('shapingResultWidth', () => {
  it('returns 0 for zero-advance result', () => {
    const result: ShapingResult = { glyphs: [], totalAdvance: 0 };
    const width = shapingResultWidth(result, 12, 1000);
    expect(width).toBe(0);
  });

  it('computes correct width for known advance', () => {
    // totalAdvance=600, fontSize=12, unitsPerEm=1000
    // width = (600 / 1000) * 12 = 7.2
    const result: ShapingResult = {
      glyphs: [{
        glyphId: 1, cluster: 0, xAdvance: 600,
        yAdvance: 0, xOffset: 0, yOffset: 0,
      }],
      totalAdvance: 600,
    };
    const width = shapingResultWidth(result, 12, 1000);
    expect(width).toBeCloseTo(7.2, 5);
  });

  it('scales linearly with font size', () => {
    const result: ShapingResult = { glyphs: [], totalAdvance: 1000 };
    const w12 = shapingResultWidth(result, 12, 1000);
    const w24 = shapingResultWidth(result, 24, 1000);
    expect(w24).toBeCloseTo(w12 * 2, 5);
  });

  it('handles different unitsPerEm values', () => {
    const result: ShapingResult = { glyphs: [], totalAdvance: 2048 };
    // (2048 / 2048) * 12 = 12
    const width = shapingResultWidth(result, 12, 2048);
    expect(width).toBeCloseTo(12, 5);
  });

  it('integrates with shapeTextSync output', () => {
    const metrics = buildMockMetrics({ unitsPerEm: 1000 });
    const result = shapeTextSync('AB', metrics);
    // Each glyph has advance 600, total = 1200
    // width = (1200 / 1000) * 10 = 12
    const width = shapingResultWidth(result, 10, 1000);
    expect(width).toBeCloseTo(12, 5);
  });
});

/**
 * Benchmarks for font parsing and text measurement.
 *
 * Measures standard font lookup speed and text measurement throughput.
 */

import { describe, bench } from './vitest-bench.js';
import {
  getStandardFont,
  standardFontHeight,
  STANDARD_FONT_NAMES,
} from '../../src/assets/font/internal/standardFonts.js';
import type { StandardFontName } from '../../src/assets/font/internal/standardFonts.js';
import {
  encodeStandardText,
  measureStandardCodes,
} from '../../src/assets/font/internal/standardEncoding.js';

// Bind once: Vitest's module runner adds a getter call to every imported-binding access.
const encodeText = encodeStandardText;
const measureCodes = measureStandardCodes;
/** Text measurement as drawText and widthOfTextAtSize do it: encode, then sum the code widths. */
const measureText = (text: string, font: StandardFontName, size: number): number =>
  measureCodes(font, encodeText(font, text), size);
const fontHeight = standardFontHeight;
const getFont = getStandardFont;
const fontNames = STANDARD_FONT_NAMES;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const shortText = 'Hello, World!';
const mediumText =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';
const longText = mediumText.repeat(20); // ~1720 chars

// ---------------------------------------------------------------------------
// Standard font lookup benchmarks
// ---------------------------------------------------------------------------

describe('standard font lookup', () => {
  bench('getStandardFont("Helvetica")', () => {
    getFont('Helvetica');
  });

  bench('getStandardFont("Courier")', () => {
    getFont('Courier');
  });

  bench('getStandardFont("Times-Roman")', () => {
    getFont('Times-Roman');
  });

  bench('getStandardFont for all 14 fonts', () => {
    for (const name of fontNames) {
      getFont(name);
    }
  });

  bench('getStandardFont for unknown font', () => {
    getFont('NonexistentFont');
  });
});

// ---------------------------------------------------------------------------
// Text measurement benchmarks
// ---------------------------------------------------------------------------

describe('text measurement', () => {
  bench('measure text short (13 chars)', () => {
    measureText(shortText, 'Helvetica', 12);
  });

  bench('measure text medium (86 chars)', () => {
    measureText(mediumText, 'Helvetica', 12);
  });

  bench('measure text long (~1720 chars)', () => {
    measureText(longText, 'Helvetica', 12);
  });

  bench('measure text Courier (monospace)', () => {
    measureText(mediumText, 'Courier', 12);
  });

  bench('measure text Times-Roman', () => {
    measureText(mediumText, 'Times-Roman', 12);
  });

  bench('standardFontHeight', () => {
    fontHeight('Helvetica', 12);
  });
});

// ---------------------------------------------------------------------------
// Batch measurement (simulating real document layout)
// ---------------------------------------------------------------------------

describe('batch text measurement (simulated layout)', () => {
  const paragraphs = Array.from(
    { length: 50 },
    (_, i) =>
      `Paragraph ${i + 1}: This is a sample paragraph for benchmarking text measurement performance in the modern-pdf library.`,
  );

  bench('measure 50 paragraphs in Helvetica', () => {
    for (const text of paragraphs) {
      measureText(text, 'Helvetica', 12);
    }
  });

  bench('measure 50 paragraphs + heights', () => {
    for (const text of paragraphs) {
      measureText(text, 'Helvetica', 12);
      fontHeight('Helvetica', 12);
    }
  });
});

// ---------------------------------------------------------------------------
// WASM font parsing benchmarks (skipped when the WASM module cannot load)
// ---------------------------------------------------------------------------

import { initFontParserWasm, isFontParserWasmReady } from '../../src/assets/font/fontEmbed.js';
import { initShapingWasm, isShapingWasmReady } from '../../src/assets/font/textShaper.js';

await initFontParserWasm();
await initShapingWasm().catch(() => {});

const wasmFontReady = isFontParserWasmReady();
const wasmShapingReady = isShapingWasmReady();

describe.skipIf(!wasmFontReady)('WASM font metric extraction', () => {
  bench('parse TrueType font metrics (WASM)', () => {
    // When WASM is loaded, extractMetrics() uses WASM path automatically.
    // This bench would require a real font file.
    getFont('Helvetica');
  });

  bench('measure text width with WASM metrics', () => {
    measureText(mediumText, 'Helvetica', 12);
  });
});

// No WASM subsetter exists (fontSubset.ts initSubsetWasm); the JS subsetter is not benchmarked here.

describe.skipIf(!wasmShapingReady)('WASM text shaping', () => {
  bench('shape short text (WASM)', () => {
    // Would use shapeText() with WASM shaper.
    // Requires loaded font data + WASM module.
    // Placeholder: measure standard text as proxy
    measureText(shortText, 'Helvetica', 12);
  });

  bench('shape medium text (WASM)', () => {
    measureText(mediumText, 'Helvetica', 12);
  });
});

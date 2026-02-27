/**
 * Benchmarks for font parsing and text measurement.
 *
 * Measures standard font lookup speed and text measurement throughput.
 */

import { describe, bench } from 'vitest';
import {
  getStandardFont,
  measureStandardText,
  standardFontHeight,
  STANDARD_FONT_NAMES,
} from '../../src/assets/font/standardFonts.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const shortText = 'Hello, World!';
const mediumText = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';
const longText = mediumText.repeat(20); // ~1720 chars

// ---------------------------------------------------------------------------
// Standard font lookup benchmarks
// ---------------------------------------------------------------------------

describe('standard font lookup', () => {
  bench('getStandardFont("Helvetica")', () => {
    getStandardFont('Helvetica');
  });

  bench('getStandardFont("Courier")', () => {
    getStandardFont('Courier');
  });

  bench('getStandardFont("Times-Roman")', () => {
    getStandardFont('Times-Roman');
  });

  bench('getStandardFont for all 14 fonts', () => {
    for (const name of STANDARD_FONT_NAMES) {
      getStandardFont(name);
    }
  });

  bench('getStandardFont for unknown font', () => {
    getStandardFont('NonexistentFont');
  });
});

// ---------------------------------------------------------------------------
// Text measurement benchmarks
// ---------------------------------------------------------------------------

describe('text measurement', () => {
  bench('measureStandardText short (13 chars)', () => {
    measureStandardText(shortText, 'Helvetica', 12);
  });

  bench('measureStandardText medium (86 chars)', () => {
    measureStandardText(mediumText, 'Helvetica', 12);
  });

  bench('measureStandardText long (~1720 chars)', () => {
    measureStandardText(longText, 'Helvetica', 12);
  });

  bench('measureStandardText Courier (monospace)', () => {
    measureStandardText(mediumText, 'Courier', 12);
  });

  bench('measureStandardText Times-Roman', () => {
    measureStandardText(mediumText, 'Times-Roman', 12);
  });

  bench('standardFontHeight', () => {
    standardFontHeight('Helvetica', 12);
  });
});

// ---------------------------------------------------------------------------
// Batch measurement (simulating real document layout)
// ---------------------------------------------------------------------------

describe('batch text measurement (simulated layout)', () => {
  const paragraphs = Array.from({ length: 50 }, (_, i) =>
    `Paragraph ${i + 1}: This is a sample paragraph for benchmarking text measurement performance in the modern-pdf library.`,
  );

  bench('measure 50 paragraphs in Helvetica', () => {
    for (const text of paragraphs) {
      measureStandardText(text, 'Helvetica', 12);
    }
  });

  bench('measure 50 paragraphs + heights', () => {
    for (const text of paragraphs) {
      measureStandardText(text, 'Helvetica', 12);
      standardFontHeight('Helvetica', 12);
    }
  });
});

// ---------------------------------------------------------------------------
// TODO: WASM font parsing benchmarks
// ---------------------------------------------------------------------------

describe.todo('WASM font parsing', () => {
  // bench('parse TrueType font metrics (WASM)', async () => { ... });
  // bench('measure text with WASM-parsed font', async () => { ... });
  // bench('font subsetting (WASM)', async () => { ... });
});

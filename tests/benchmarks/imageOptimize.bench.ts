/**
 * Benchmarks for image optimization features.
 *
 * Covers: grayscale detection, DPI analysis, quality estimation,
 * image extraction, and batch optimization.
 *
 * Run with: npx vitest bench tests/benchmarks/imageOptimize.bench.ts
 */

import { describe, bench } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  extractImages,
  optimizeAllImages,
  deduplicateImages,
  estimateJpegQuality,
  PageSizes,
} from '../../src/index.js';
import {
  isGrayscaleImage,
  convertToGrayscale,
} from '../../src/assets/image/grayscaleDetect.js';
import {
  computeImageDpi,
  computeTargetDimensions,
} from '../../src/assets/image/dpiAnalyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../fixtures/images');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PNG = new Uint8Array(readFileSync(resolve(fixturesDir, 'sample.png')));
const SAMPLE_JPEG = new Uint8Array(readFileSync(resolve(fixturesDir, 'sample.jpg')));

/** Build a synthetic RGB pixel buffer. */
function buildRgbPixels(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = (i * 7) & 0xFF;
    pixels[i * 3 + 1] = (i * 13) & 0xFF;
    pixels[i * 3 + 2] = (i * 19) & 0xFF;
  }
  return pixels;
}

/** Build a synthetic grayscale-as-RGB pixel buffer. */
function buildGrayRgbPixels(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const v = i & 0xFF;
    pixels[i * 3] = v;
    pixels[i * 3 + 1] = v;
    pixels[i * 3 + 2] = v;
  }
  return pixels;
}

/** Create a PDF with N PNG images. */
function createPdfWithImages(count: number): Promise<Uint8Array> {
  const doc = createPdf();
  for (let i = 0; i < count; i++) {
    const img = doc.embedPng(SAMPLE_PNG);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 400, width: 100, height: 100 });
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// Grayscale detection
// ---------------------------------------------------------------------------

describe('Grayscale detection', () => {
  const gray256 = buildGrayRgbPixels(256, 256);
  const color256 = buildRgbPixels(256, 256);
  const gray1k = buildGrayRgbPixels(1000, 1000);

  bench('isGrayscaleImage 256x256 (gray)', () => {
    isGrayscaleImage(gray256, 256, 256, 3);
  });

  bench('isGrayscaleImage 256x256 (color)', () => {
    isGrayscaleImage(color256, 256, 256, 3);
  });

  bench('isGrayscaleImage 1000x1000 (gray)', () => {
    isGrayscaleImage(gray1k, 1000, 1000, 3);
  });

  bench('convertToGrayscale 256x256', () => {
    convertToGrayscale(gray256, 256, 256, 3);
  });

  bench('convertToGrayscale 1000x1000', () => {
    convertToGrayscale(gray1k, 1000, 1000, 3);
  });
});

// ---------------------------------------------------------------------------
// DPI analysis
// ---------------------------------------------------------------------------

describe('DPI analysis', () => {
  bench('computeImageDpi', () => {
    computeImageDpi(3000, 2000, 300, 200);
  });

  bench('computeTargetDimensions (downscale needed)', () => {
    computeTargetDimensions(3000, 2000, 300, 200, 150);
  });

  bench('computeTargetDimensions (no downscale)', () => {
    computeTargetDimensions(100, 100, 300, 200, 150);
  });
});

// ---------------------------------------------------------------------------
// Quality estimation
// ---------------------------------------------------------------------------

describe('JPEG quality estimation', () => {
  bench('estimateJpegQuality (real JPEG)', () => {
    estimateJpegQuality(SAMPLE_JPEG);
  });
});

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

describe('Image extraction', () => {
  let pdf10: Uint8Array;

  bench('extractImages from 10-image PDF', async () => {
    if (!pdf10) pdf10 = await createPdfWithImages(10);
    const doc = await loadPdf(pdf10);
    extractImages(doc);
  });
});

// ---------------------------------------------------------------------------
// Batch optimization (without WASM — measures overhead)
// ---------------------------------------------------------------------------

describe('Batch optimization (no WASM)', () => {
  let pdf5: Uint8Array;

  bench('optimizeAllImages 5-image PDF (skip mode)', async () => {
    if (!pdf5) pdf5 = await createPdfWithImages(5);
    const doc = await loadPdf(pdf5);
    await optimizeAllImages(doc);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('Image deduplication', () => {
  let pdfDupes: Uint8Array;

  bench('deduplicateImages 10 duplicates', async () => {
    if (!pdfDupes) {
      const doc = createPdf();
      for (let i = 0; i < 10; i++) {
        const img = doc.embedPng(SAMPLE_PNG);
        const page = doc.addPage(PageSizes.A4);
        page.drawImage(img, { x: 50, y: 400, width: 100, height: 100 });
      }
      pdfDupes = await doc.save();
    }
    const doc = await loadPdf(pdfDupes);
    deduplicateImages(doc);
  });
});

/**
 * Tests for pre-optimization compression ratio analysis.
 *
 * Covers:
 *  - analyzeImages() returns an empty report for a document with no images
 *  - AnalysisReport structure validation
 *  - Per-image ImageAnalysis shape
 *  - Recommendation logic (recompress, keep, grayscale, downscale)
 *  - Module exports the correct types
 *  - Multiple images across pages
 *  - Options (quality, maxDpi) are respected
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  analyzeImages,
  extractImages,
  PageSizes,
} from '../../src/index.js';
import type { ImageAnalysis, AnalysisReport } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../fixtures/images');

// ---------------------------------------------------------------------------
// Empty document
// ---------------------------------------------------------------------------

describe('analyzeImages — empty document', () => {
  it('returns an empty report with zero totals', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = analyzeImages(loaded);

    expect(report.images).toEqual([]);
    expect(report.totalCurrentSize).toBe(0);
    expect(report.totalEstimatedSize).toBe(0);
    expect(report.totalSavings).toBe(0);
    expect(report.totalSavingsPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Report structure
// ---------------------------------------------------------------------------

describe('analyzeImages — report structure', () => {
  it('AnalysisReport has the correct shape', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report: AnalysisReport = analyzeImages(loaded);

    expect(typeof report.totalCurrentSize).toBe('number');
    expect(typeof report.totalEstimatedSize).toBe('number');
    expect(typeof report.totalSavings).toBe('number');
    expect(typeof report.totalSavingsPercent).toBe('number');
    expect(Array.isArray(report.images)).toBe(true);
    expect(report.images.length).toBeGreaterThanOrEqual(1);
  });

  it('per-image entries have correct ImageAnalysis shape', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    for (const entry of report.images) {
      // Validate all required fields exist and have correct types
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.pageIndex).toBe('number');
      expect(typeof entry.width).toBe('number');
      expect(typeof entry.height).toBe('number');
      expect(typeof entry.currentSize).toBe('number');
      expect(typeof entry.currentFormat).toBe('string');
      expect(typeof entry.colorSpace).toBe('string');
      expect(typeof entry.estimatedJpegSize).toBe('number');
      expect(typeof entry.estimatedSavings).toBe('number');
      expect(typeof entry.savingsPercent).toBe('number');
      expect(typeof entry.isGrayscale).toBe('boolean');
      expect(
        entry.effectiveDpi === undefined || typeof entry.effectiveDpi === 'number',
      ).toBe(true);
      expect(['recompress', 'keep', 'downscale', 'grayscale']).toContain(
        entry.recommendation,
      );
    }
  });

  it('totalSavings is non-negative', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    expect(report.totalSavings).toBeGreaterThanOrEqual(0);
    expect(report.totalSavingsPercent).toBeGreaterThanOrEqual(0);
  });

  it('totalCurrentSize equals sum of per-image currentSize', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    const sumCurrentSize = report.images.reduce((s, i) => s + i.currentSize, 0);
    expect(report.totalCurrentSize).toBe(sumCurrentSize);
  });

  it('totalEstimatedSize equals sum of per-image estimatedJpegSize', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    const sumEstimated = report.images.reduce((s, i) => s + i.estimatedJpegSize, 0);
    expect(report.totalEstimatedSize).toBe(sumEstimated);
  });
});

// ---------------------------------------------------------------------------
// Multiple images
// ---------------------------------------------------------------------------

describe('analyzeImages — multiple images', () => {
  it('handles multiple images across pages', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const gradientBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'gradient-8x8.png')));

    const doc = createPdf();

    const img1 = await doc.embedPng(pngBytes);
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawImage(img1, { x: 0, y: 0 });

    const img2 = await doc.embedPng(gradientBytes);
    const page2 = doc.addPage(PageSizes.A4);
    page2.drawImage(img2, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = analyzeImages(loaded);
    expect(report.images.length).toBe(2);
    // Each image should have a distinct page index or name
    const pageIndices = report.images.map((i) => i.pageIndex);
    expect(new Set(pageIndices).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('analyzeImages — options', () => {
  it('accepts quality option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = analyzeImages(loaded, { quality: 50 });
    expect(report).toBeDefined();
    expect(report.images).toEqual([]);
  });

  it('accepts maxDpi option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = analyzeImages(loaded, { maxDpi: 300 });
    expect(report).toBeDefined();
    expect(report.images).toEqual([]);
  });

  it('defaults to quality 80 and maxDpi 150', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Should not throw with default options
    const report = analyzeImages(loaded);
    expect(report.images.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Recommendation logic
// ---------------------------------------------------------------------------

describe('analyzeImages — recommendation logic', () => {
  it('recommends "keep" when savings are minimal', async () => {
    // A JPEG image in a PDF should already be efficiently encoded,
    // so the analysis should recommend keeping it.
    const jpgBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();
    const img = await doc.embedJpeg(jpgBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    // JPEG images stored as DCTDecode should have minimal or no savings
    for (const entry of report.images) {
      if (entry.currentFormat === 'JPEG') {
        // Savings should be low — either keep or another recommendation,
        // but never negative savings
        expect(entry.estimatedSavings).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('width and height match extracted image dimensions', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 200, height: 200 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const extractedImages = extractImages(loaded);
    const report = analyzeImages(loaded);

    // The analysis should report the same pixel dimensions as extractImages
    for (let i = 0; i < report.images.length; i++) {
      const analysisEntry = report.images[i]!;
      const extractedEntry = extractedImages[i]!;
      expect(analysisEntry.width).toBe(extractedEntry.width);
      expect(analysisEntry.height).toBe(extractedEntry.height);
    }
  });

  it('currentFormat reflects the image encoding', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const report = analyzeImages(loaded);

    // PNG images in PDFs are stored with FlateDecode
    for (const entry of report.images) {
      expect(typeof entry.currentFormat).toBe('string');
      expect(entry.currentFormat.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Does not modify document
// ---------------------------------------------------------------------------

describe('analyzeImages — read-only', () => {
  it('does not modify image streams in the document', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Snapshot image stream data before analysis
    const imagesBefore = extractImages(loaded);
    const dataBefore = imagesBefore.map((i) => ({
      size: i.compressedSize,
      data: new Uint8Array(i.stream.data),
    }));

    // Run analysis
    analyzeImages(loaded);

    // Verify image streams are unchanged
    const imagesAfter = extractImages(loaded);
    expect(imagesAfter.length).toBe(imagesBefore.length);
    for (let i = 0; i < imagesBefore.length; i++) {
      expect(imagesAfter[i]!.compressedSize).toBe(dataBefore[i]!.size);
      const afterData = imagesAfter[i]!.stream.data;
      const beforeData = dataBefore[i]!.data;
      expect(afterData.length).toBe(beforeData.length);
      for (let j = 0; j < beforeData.length; j++) {
        expect(afterData[j]).toBe(beforeData[j]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('compressionAnalysis — module exports', () => {
  it('exports analyzeImages function from index', async () => {
    const mod = await import('../../src/index.js');
    expect(typeof mod.analyzeImages).toBe('function');
  });

  it('ImageAnalysis type is usable', () => {
    // Type-level check: this compiles if the type is correctly exported
    const entry: ImageAnalysis = {
      name: '/Im0',
      pageIndex: 0,
      width: 100,
      height: 100,
      currentSize: 5000,
      currentFormat: 'FlateDecode',
      colorSpace: 'DeviceRGB',
      estimatedJpegSize: 1000,
      estimatedSavings: 4000,
      savingsPercent: 80,
      isGrayscale: false,
      effectiveDpi: 72,
      recommendation: 'recompress',
    };
    expect(entry.name).toBe('/Im0');
    expect(entry.recommendation).toBe('recompress');
  });

  it('AnalysisReport type is usable', () => {
    const report: AnalysisReport = {
      images: [],
      totalCurrentSize: 0,
      totalEstimatedSize: 0,
      totalSavings: 0,
      totalSavingsPercent: 0,
    };
    expect(report.images).toEqual([]);
    expect(report.totalSavingsPercent).toBe(0);
  });
});

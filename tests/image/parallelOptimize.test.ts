/**
 * Tests for parallel image optimization with configurable concurrency.
 *
 * Covers:
 *  - Default concurrency is 1 (sequential)
 *  - Concurrency of 1 produces same results as no concurrency option
 *  - Concurrency > number of images works correctly (no errors)
 *  - Concurrency of 0 treated as 1
 *  - Results are in correct order regardless of concurrency
 *  - Report totals are identical for sequential vs concurrent processing
 *  - Test with a document containing multiple images
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  optimizeAllImages,
  extractImages,
  PageSizes,
} from '../../src/index.js';
import type {
  BatchOptimizeOptions,
  OptimizationReport,
} from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../fixtures/images');

// ---------------------------------------------------------------------------
// Helper: create a multi-page PDF with one image per page
// ---------------------------------------------------------------------------

async function createMultiImagePdf(pageCount: number): Promise<Uint8Array> {
  const pngBytes = new Uint8Array(
    await readFile(resolve(fixturesDir, 'sample.png')),
  );
  const doc = createPdf();

  for (let i = 0; i < pageCount; i++) {
    const img = doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });
  }

  return doc.save();
}

/**
 * Helper to strip reason strings for comparison, since reasons may
 * include floating-point differences in savings percentages.
 */
function stripReasons(report: OptimizationReport): OptimizationReport {
  return {
    ...report,
    perImage: report.perImage.map((e) => ({ ...e, reason: undefined })),
  };
}

// ---------------------------------------------------------------------------
// Default concurrency
// ---------------------------------------------------------------------------

describe('parallel optimization — default concurrency', () => {
  it('defaults to sequential processing (concurrency = 1)', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);

    // No concurrency option = default (1, sequential)
    const report = await optimizeAllImages(doc);

    // All images should be present in the report
    expect(report.totalImages).toBe(3);
    expect(report.perImage.length).toBe(3);
  });

  it('concurrency of 1 produces same results as no concurrency option', async () => {
    const bytes = await createMultiImagePdf(3);

    // Run with no concurrency option
    const doc1 = await loadPdf(bytes);
    const report1 = await optimizeAllImages(doc1);

    // Run with explicit concurrency: 1
    const doc2 = await loadPdf(bytes);
    const report2 = await optimizeAllImages(doc2, { concurrency: 1 });

    // Reports should be identical (modulo the report objects themselves)
    const stripped1 = stripReasons(report1);
    const stripped2 = stripReasons(report2);

    expect(stripped2.totalImages).toBe(stripped1.totalImages);
    expect(stripped2.optimizedImages).toBe(stripped1.optimizedImages);
    expect(stripped2.skippedByFilter).toBe(stripped1.skippedByFilter);
    expect(stripped2.originalTotalBytes).toBe(stripped1.originalTotalBytes);
    expect(stripped2.optimizedTotalBytes).toBe(stripped1.optimizedTotalBytes);
    expect(stripped2.savings).toBe(stripped1.savings);
    expect(stripped2.perImage.length).toBe(stripped1.perImage.length);

    for (let i = 0; i < stripped1.perImage.length; i++) {
      expect(stripped2.perImage[i]!.name).toBe(stripped1.perImage[i]!.name);
      expect(stripped2.perImage[i]!.pageIndex).toBe(stripped1.perImage[i]!.pageIndex);
      expect(stripped2.perImage[i]!.originalSize).toBe(stripped1.perImage[i]!.originalSize);
      expect(stripped2.perImage[i]!.newSize).toBe(stripped1.perImage[i]!.newSize);
      expect(stripped2.perImage[i]!.skipped).toBe(stripped1.perImage[i]!.skipped);
      expect(stripped2.perImage[i]!.skippedByFilter).toBe(stripped1.perImage[i]!.skippedByFilter);
    }
  });
});

// ---------------------------------------------------------------------------
// Concurrency edge cases
// ---------------------------------------------------------------------------

describe('parallel optimization — edge cases', () => {
  it('concurrency of 0 is treated as 1 (no errors)', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, { concurrency: 0 });

    expect(report.totalImages).toBe(2);
    expect(report.perImage.length).toBe(2);
  });

  it('negative concurrency is treated as 1 (no errors)', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, { concurrency: -5 });

    expect(report.totalImages).toBe(2);
    expect(report.perImage.length).toBe(2);
  });

  it('concurrency > number of images works correctly', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // concurrency = 100 but only 2 images
    const report = await optimizeAllImages(doc, { concurrency: 100 });

    expect(report.totalImages).toBe(2);
    expect(report.perImage.length).toBe(2);
  });

  it('handles single-image document with concurrency', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, { concurrency: 4 });

    expect(report.totalImages).toBe(1);
    expect(report.perImage.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Result ordering
// ---------------------------------------------------------------------------

describe('parallel optimization — result ordering', () => {
  it('results are in correct input order regardless of concurrency', async () => {
    const bytes = await createMultiImagePdf(5);

    // Run sequentially
    const doc1 = await loadPdf(bytes);
    const sequential = await optimizeAllImages(doc1, { concurrency: 1 });

    // Run with high concurrency
    const doc2 = await loadPdf(bytes);
    const concurrent = await optimizeAllImages(doc2, { concurrency: 4 });

    // The perImage arrays should be in the same order
    expect(concurrent.perImage.length).toBe(sequential.perImage.length);

    for (let i = 0; i < sequential.perImage.length; i++) {
      expect(concurrent.perImage[i]!.name).toBe(sequential.perImage[i]!.name);
      expect(concurrent.perImage[i]!.pageIndex).toBe(sequential.perImage[i]!.pageIndex);
    }
  });

  it('page indices in perImage match the original image order', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, { concurrency: 3 });

    // Page indices should be 0, 1, 2, 3 in order
    const pageIndices = report.perImage.map((e) => e.pageIndex);
    expect(pageIndices).toEqual([0, 1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Report totals match
// ---------------------------------------------------------------------------

describe('parallel optimization — report totals', () => {
  it('report totals are identical for sequential vs concurrent processing', async () => {
    const bytes = await createMultiImagePdf(4);

    const doc1 = await loadPdf(bytes);
    const report1 = await optimizeAllImages(doc1, { concurrency: 1 });

    const doc2 = await loadPdf(bytes);
    const report2 = await optimizeAllImages(doc2, { concurrency: 4 });

    expect(report2.totalImages).toBe(report1.totalImages);
    expect(report2.optimizedImages).toBe(report1.optimizedImages);
    expect(report2.skippedByFilter).toBe(report1.skippedByFilter);
    expect(report2.originalTotalBytes).toBe(report1.originalTotalBytes);
    expect(report2.optimizedTotalBytes).toBe(report1.optimizedTotalBytes);
    expect(report2.savings).toBe(report1.savings);
  });

  it('per-image sizes are identical regardless of concurrency', async () => {
    const bytes = await createMultiImagePdf(3);

    const doc1 = await loadPdf(bytes);
    const report1 = await optimizeAllImages(doc1, { concurrency: 1 });

    const doc2 = await loadPdf(bytes);
    const report2 = await optimizeAllImages(doc2, { concurrency: 3 });

    for (let i = 0; i < report1.perImage.length; i++) {
      expect(report2.perImage[i]!.originalSize).toBe(report1.perImage[i]!.originalSize);
      expect(report2.perImage[i]!.newSize).toBe(report1.perImage[i]!.newSize);
    }
  });
});

// ---------------------------------------------------------------------------
// Concurrency with filters
// ---------------------------------------------------------------------------

describe('parallel optimization — with filters', () => {
  it('filters work correctly with concurrency > 1', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      concurrency: 3,
      pageRange: { start: 1, end: 2 },
    });

    // Pages 0 and 3 should be skipped by filter
    const filtered = report.perImage.filter((e) => e.skippedByFilter);
    expect(filtered.length).toBe(2);
    expect(report.skippedByFilter).toBe(2);

    // Filtered pages should be 0 and 3
    const filteredPages = filtered.map((e) => e.pageIndex).sort();
    expect(filteredPages).toEqual([0, 3]);
  });

  it('filter + concurrency produces same results as filter + sequential', async () => {
    const bytes = await createMultiImagePdf(5);

    const doc1 = await loadPdf(bytes);
    const report1 = await optimizeAllImages(doc1, {
      concurrency: 1,
      pageRange: { start: 1, end: 3 },
    });

    const doc2 = await loadPdf(bytes);
    const report2 = await optimizeAllImages(doc2, {
      concurrency: 4,
      pageRange: { start: 1, end: 3 },
    });

    expect(report2.totalImages).toBe(report1.totalImages);
    expect(report2.optimizedImages).toBe(report1.optimizedImages);
    expect(report2.skippedByFilter).toBe(report1.skippedByFilter);
    expect(report2.originalTotalBytes).toBe(report1.originalTotalBytes);
    expect(report2.optimizedTotalBytes).toBe(report1.optimizedTotalBytes);

    for (let i = 0; i < report1.perImage.length; i++) {
      expect(report2.perImage[i]!.name).toBe(report1.perImage[i]!.name);
      expect(report2.perImage[i]!.pageIndex).toBe(report1.perImage[i]!.pageIndex);
      expect(report2.perImage[i]!.skippedByFilter).toBe(report1.perImage[i]!.skippedByFilter);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple images in a single document
// ---------------------------------------------------------------------------

describe('parallel optimization — multi-image document', () => {
  it('handles a document with many images concurrently', async () => {
    const bytes = await createMultiImagePdf(8);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, { concurrency: 4 });

    expect(report.totalImages).toBe(8);
    expect(report.perImage.length).toBe(8);

    // Every image should have a valid entry
    for (const entry of report.perImage) {
      expect(entry.originalSize).toBeGreaterThan(0);
      expect(entry.newSize).toBeGreaterThan(0);
      expect(typeof entry.skipped).toBe('boolean');
      expect(typeof entry.skippedByFilter).toBe('boolean');
    }
  });
});

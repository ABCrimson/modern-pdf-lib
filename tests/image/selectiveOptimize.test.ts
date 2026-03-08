/**
 * Tests for selective optimization filters in optimizeAllImages().
 *
 * Covers:
 *  - pageRange filter skips images outside range
 *  - minImageSize filter skips small images
 *  - colorSpaces filter only processes matching color spaces
 *  - namePattern filter matches/rejects correctly
 *  - Multiple filters combine with AND logic
 *  - Empty/no filters = process all (no change in behavior)
 *  - Report includes skippedByFilter count
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
  ImageOptimizeEntry,
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
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });
  }

  return doc.save();
}

// ---------------------------------------------------------------------------
// pageRange filter
// ---------------------------------------------------------------------------

describe('selective filters — pageRange', () => {
  it('skips images outside the page range', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 1, end: 2 },
    });

    // Pages 0 and 3 should be skipped by filter
    const filtered = report.perImage.filter((e) => e.skippedByFilter);
    const notFiltered = report.perImage.filter((e) => !e.skippedByFilter);

    expect(filtered.length).toBe(2);
    expect(notFiltered.length).toBe(2);

    // Filtered entries should be on pages 0 and 3
    const filteredPages = filtered.map((e) => e.pageIndex).sort();
    expect(filteredPages).toEqual([0, 3]);

    // Non-filtered entries should be on pages 1 and 2
    const nonFilteredPages = notFiltered.map((e) => e.pageIndex).sort();
    expect(nonFilteredPages).toEqual([1, 2]);

    // Report-level count
    expect(report.skippedByFilter).toBe(2);
  });

  it('includes all images when pageRange covers all pages', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 2 },
    });

    expect(report.skippedByFilter).toBe(0);
    expect(report.perImage.every((e) => !e.skippedByFilter)).toBe(true);
  });

  it('skips all images when pageRange is empty set', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);

    // start > end means no page matches
    const report = await optimizeAllImages(doc, {
      pageRange: { start: 10, end: 20 },
    });

    expect(report.skippedByFilter).toBe(3);
    expect(report.perImage.every((e) => e.skippedByFilter)).toBe(true);
  });

  it('filtered entries have descriptive reason', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 0 },
    });

    const filteredEntry = report.perImage.find((e) => e.skippedByFilter);
    expect(filteredEntry).toBeDefined();
    expect(filteredEntry!.reason).toContain('outside range');
  });
});

// ---------------------------------------------------------------------------
// minImageSize filter
// ---------------------------------------------------------------------------

describe('selective filters — minImageSize', () => {
  it('skips images below the minimum size', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Extract images to find their actual sizes
    const images = extractImages(doc);
    const maxSize = Math.max(...images.map((i) => i.compressedSize));

    // Set threshold above all image sizes so everything gets filtered
    const report = await optimizeAllImages(doc, {
      minImageSize: maxSize + 1,
    });

    expect(report.skippedByFilter).toBe(2);
    expect(report.perImage.every((e) => e.skippedByFilter)).toBe(true);
  });

  it('processes images at or above the minimum size', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Set threshold to 0 — nothing should be filtered
    const report = await optimizeAllImages(doc, {
      minImageSize: 0,
    });

    expect(report.skippedByFilter).toBe(0);
  });

  it('processes images when minImageSize equals compressed size', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    const images = extractImages(doc);
    const exactSize = images[0]!.compressedSize;

    // minImageSize uses < (not <=), so exact match should NOT be filtered
    const report = await optimizeAllImages(doc, {
      minImageSize: exactSize,
    });

    expect(report.skippedByFilter).toBe(0);
  });

  it('filtered entries mention the size threshold', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      minImageSize: 999_999_999,
    });

    const entry = report.perImage[0]!;
    expect(entry.skippedByFilter).toBe(true);
    expect(entry.reason).toContain('below minimum');
  });
});

// ---------------------------------------------------------------------------
// colorSpaces filter
// ---------------------------------------------------------------------------

describe('selective filters — colorSpaces', () => {
  it('skips images not matching allowed color spaces', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Use a color space that won't match PNG images (which are DeviceRGB)
    const report = await optimizeAllImages(doc, {
      colorSpaces: ['DeviceCMYK'],
    });

    expect(report.skippedByFilter).toBe(2);
    expect(
      report.perImage.every(
        (e) => e.skippedByFilter && e.reason!.includes('not in allowed list'),
      ),
    ).toBe(true);
  });

  it('processes images matching allowed color spaces', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // PNG images in a PDF are DeviceRGB
    const report = await optimizeAllImages(doc, {
      colorSpaces: ['DeviceRGB'],
    });

    expect(report.skippedByFilter).toBe(0);
    expect(report.perImage.every((e) => !e.skippedByFilter)).toBe(true);
  });

  it('accepts multiple color spaces', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      colorSpaces: ['DeviceCMYK', 'DeviceRGB', 'ICCBased'],
    });

    // DeviceRGB is in the list, so the image passes through
    expect(report.skippedByFilter).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// namePattern filter
// ---------------------------------------------------------------------------

describe('selective filters — namePattern', () => {
  it('skips images whose name does not match the pattern', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Use a pattern that matches nothing
    const report = await optimizeAllImages(doc, {
      namePattern: /^NONEXISTENT$/,
    });

    expect(report.skippedByFilter).toBe(2);
    expect(
      report.perImage.every(
        (e) => e.skippedByFilter && e.reason!.includes('does not match pattern'),
      ),
    ).toBe(true);
  });

  it('processes images whose name matches the pattern', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Image resource names typically look like /Im0, /Im1, etc.
    const report = await optimizeAllImages(doc, {
      namePattern: /Im/,
    });

    // All images should pass the filter (names contain "Im")
    expect(report.skippedByFilter).toBe(0);
  });

  it('partial match works with regex', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const images = extractImages(doc);

    // Only match the exact first image name
    const firstName = images[0]!.name;
    const escapedName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedName}$`);

    const report = await optimizeAllImages(doc, {
      namePattern: pattern,
    });

    // Only one image should pass (the first one)
    const passedFilter = report.perImage.filter((e) => !e.skippedByFilter);
    expect(passedFilter.length).toBe(1);
    expect(passedFilter[0]!.name).toBe(firstName);

    // The rest should be filtered
    expect(report.skippedByFilter).toBe(images.length - 1);
  });
});

// ---------------------------------------------------------------------------
// Combined filters (AND logic)
// ---------------------------------------------------------------------------

describe('selective filters — combined (AND logic)', () => {
  it('applies all filters as AND conditions', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);

    // pageRange allows pages 0-1, namePattern allows /Im/
    // So pages 2-3 are filtered by pageRange, and pages 0-1 must also
    // match the namePattern
    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 1 },
      namePattern: /Im/,
      colorSpaces: ['DeviceRGB'],
    });

    // Pages 2 and 3 are filtered by pageRange
    const pageRangeFiltered = report.perImage.filter(
      (e) => e.skippedByFilter && e.reason!.includes('outside range'),
    );
    expect(pageRangeFiltered.length).toBe(2);

    // Pages 0 and 1 pass all filters (DeviceRGB matches, name contains Im)
    const passedFilter = report.perImage.filter((e) => !e.skippedByFilter);
    expect(passedFilter.length).toBe(2);
  });

  it('second filter can reject what first filter accepted', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // pageRange allows all pages, but colorSpaces rejects DeviceRGB
    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 10 },
      colorSpaces: ['DeviceCMYK'],
    });

    // All images should be filtered by the colorSpaces filter
    expect(report.skippedByFilter).toBe(2);
    expect(
      report.perImage.every(
        (e) => e.skippedByFilter && e.reason!.includes('not in allowed list'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No filters = process all
// ---------------------------------------------------------------------------

describe('selective filters — no filters', () => {
  it('processes all images when no filter options are set', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc);

    // No images should be skippedByFilter
    expect(report.skippedByFilter).toBe(0);
    expect(report.perImage.every((e) => !e.skippedByFilter)).toBe(true);

    // All images are still in the report (skipped for other reasons is fine)
    expect(report.totalImages).toBe(3);
  });

  it('empty options object does not filter anything', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {});

    expect(report.skippedByFilter).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Report structure
// ---------------------------------------------------------------------------

describe('selective filters — report structure', () => {
  it('skippedByFilter count matches per-image entries', async () => {
    const bytes = await createMultiImagePdf(5);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 1, end: 3 },
    });

    const perImageFilteredCount = report.perImage.filter(
      (e) => e.skippedByFilter,
    ).length;
    expect(report.skippedByFilter).toBe(perImageFilteredCount);
  });

  it('filtered images have skipped=true and skippedByFilter=true', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 0 },
    });

    const filtered = report.perImage.filter((e) => e.skippedByFilter);
    expect(filtered.length).toBe(1);
    for (const entry of filtered) {
      expect(entry.skipped).toBe(true);
      expect(entry.skippedByFilter).toBe(true);
      expect(entry.reason).toBeDefined();
    }
  });

  it('non-filter skips have skippedByFilter=false', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    // No selective filters — image will be skipped for WASM not being ready
    const report = await optimizeAllImages(doc);

    for (const entry of report.perImage) {
      expect(entry.skippedByFilter).toBe(false);
    }
  });

  it('totalImages includes filtered images in the count', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 0, end: 0 },
    });

    // All 4 images should be counted in totalImages
    expect(report.totalImages).toBe(4);
    // But 3 should be filtered
    expect(report.skippedByFilter).toBe(3);
  });

  it('filtered images preserve originalSize = newSize', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      pageRange: { start: 5, end: 10 },
    });

    for (const entry of report.perImage) {
      expect(entry.originalSize).toBe(entry.newSize);
      expect(entry.originalSize).toBeGreaterThan(0);
    }
  });
});

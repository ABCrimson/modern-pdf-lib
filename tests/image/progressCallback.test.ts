/**
 * Tests for the onProgress callback in optimizeAllImages().
 *
 * Covers:
 *  - onProgress is called for each image (verify call count)
 *  - onProgress receives correct current/total values
 *  - onProgress receives correct imageName
 *  - totalSavedBytes accumulates correctly
 *  - skipped flag is true for filtered images
 *  - Not providing onProgress doesn't break anything
 */

import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  optimizeAllImages,
  PageSizes,
} from '../../src/index.js';
import type { ProgressInfo } from '../../src/index.js';

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
// onProgress call count
// ---------------------------------------------------------------------------

describe('onProgress callback — call count', () => {
  it('is called once per image', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls.length).toBe(4);
  });

  it('is called for a single-image PDF', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// current / total values
// ---------------------------------------------------------------------------

describe('onProgress callback — current/total', () => {
  it('receives correct 1-based current and total values', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls.length).toBe(3);

    for (let i = 0; i < progressCalls.length; i++) {
      expect(progressCalls[i]!.current).toBe(i + 1);
      expect(progressCalls[i]!.total).toBe(3);
    }
  });

  it('last call has current === total', async () => {
    const bytes = await createMultiImagePdf(5);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    const last = progressCalls[progressCalls.length - 1]!;
    expect(last.current).toBe(last.total);
  });
});

// ---------------------------------------------------------------------------
// imageName
// ---------------------------------------------------------------------------

describe('onProgress callback — imageName', () => {
  it('receives a non-empty imageName for each call', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    for (const call of progressCalls) {
      expect(call.imageName).toBeTruthy();
      expect(typeof call.imageName).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// totalSavedBytes accumulation
// ---------------------------------------------------------------------------

describe('onProgress callback — totalSavedBytes', () => {
  it('accumulates correctly across calls', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    // Verify accumulation: each totalSavedBytes should equal
    // sum of savedBytes from calls 1..current
    let running = 0;
    for (const call of progressCalls) {
      running += call.savedBytes;
      expect(call.totalSavedBytes).toBe(running);
    }
  });

  it('first call totalSavedBytes equals first savedBytes', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls[0]!.totalSavedBytes).toBe(
      progressCalls[0]!.savedBytes,
    );
  });
});

// ---------------------------------------------------------------------------
// skipped flag for filtered images
// ---------------------------------------------------------------------------

describe('onProgress callback — skipped flag', () => {
  it('skipped is true for images filtered by pageRange', async () => {
    const bytes = await createMultiImagePdf(4);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      pageRange: { start: 1, end: 2 },
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls.length).toBe(4);

    // Pages 0 and 3 should have skipped=true
    const skippedCalls = progressCalls.filter((c) => c.skipped);
    expect(skippedCalls.length).toBeGreaterThanOrEqual(2);

    // The filtered ones on pages 0 and 3 should have skipped=true
    const page0 = progressCalls.find((c) => c.pageIndex === 0);
    const page3 = progressCalls.find((c) => c.pageIndex === 3);
    expect(page0?.skipped).toBe(true);
    expect(page3?.skipped).toBe(true);
  });

  it('skipped is true for images filtered by namePattern', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    // Use a pattern that matches nothing
    await optimizeAllImages(doc, {
      namePattern: /^NONEXISTENT$/,
      onProgress: (info) => progressCalls.push(info),
    });

    expect(progressCalls.length).toBe(2);
    expect(progressCalls.every((c) => c.skipped)).toBe(true);
  });

  it('savedBytes is 0 for skipped images', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    // Filter all images out
    await optimizeAllImages(doc, {
      pageRange: { start: 99, end: 100 },
      onProgress: (info) => progressCalls.push(info),
    });

    for (const call of progressCalls) {
      expect(call.skipped).toBe(true);
      expect(call.savedBytes).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// No onProgress provided
// ---------------------------------------------------------------------------

describe('onProgress callback — not provided', () => {
  it('does not break when onProgress is not set', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    // Should not throw
    const report = await optimizeAllImages(doc);
    expect(report.totalImages).toBe(2);
  });

  it('does not break with empty options object', async () => {
    const bytes = await createMultiImagePdf(2);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {});
    expect(report.totalImages).toBe(2);
  });

  it('does not break with onProgress set to undefined', async () => {
    const bytes = await createMultiImagePdf(1);
    const doc = await loadPdf(bytes);

    const report = await optimizeAllImages(doc, {
      onProgress: undefined,
    });
    expect(report.totalImages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// pageIndex correctness
// ---------------------------------------------------------------------------

describe('onProgress callback — pageIndex', () => {
  it('receives correct 0-based page indices', async () => {
    const bytes = await createMultiImagePdf(3);
    const doc = await loadPdf(bytes);
    const progressCalls: ProgressInfo[] = [];

    await optimizeAllImages(doc, {
      onProgress: (info) => progressCalls.push(info),
    });

    const pageIndices = progressCalls.map((c) => c.pageIndex).sort();
    expect(pageIndices).toEqual([0, 1, 2]);
  });
});

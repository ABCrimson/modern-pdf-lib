/**
 * Tests for batch image optimization in PDF documents.
 *
 * Covers optimizeAllImages() from batchOptimize.ts.
 *
 * Note: Without the JPEG WASM module compiled and initialized,
 * images will be skipped with "JPEG WASM encoder not initialized".
 * These tests verify the API shape, report structure, and skip behavior.
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
} from '../../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../../fixtures/images');

// ---------------------------------------------------------------------------
// optimizeAllImages
// ---------------------------------------------------------------------------

describe('optimizeAllImages', () => {
  it('returns empty report for PDF with no images', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded);
    expect(report.totalImages).toBe(0);
    expect(report.optimizedImages).toBe(0);
    expect(report.originalTotalBytes).toBe(0);
    expect(report.optimizedTotalBytes).toBe(0);
    expect(report.savings).toBe(0);
    expect(report.perImage).toEqual([]);
  });

  it('report has correct structure', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded);

    // Report structure checks
    expect(typeof report.totalImages).toBe('number');
    expect(typeof report.optimizedImages).toBe('number');
    expect(typeof report.originalTotalBytes).toBe('number');
    expect(typeof report.optimizedTotalBytes).toBe('number');
    expect(typeof report.savings).toBe('number');
    expect(Array.isArray(report.perImage)).toBe(true);

    expect(report.totalImages).toBeGreaterThanOrEqual(1);
    expect(report.perImage.length).toBe(report.totalImages);
  });

  it('per-image entries have correct shape', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded);
    for (const entry of report.perImage) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.pageIndex).toBe('number');
      expect(typeof entry.originalSize).toBe('number');
      expect(typeof entry.newSize).toBe('number');
      expect(typeof entry.skipped).toBe('boolean');
      if (entry.skipped) {
        expect(typeof entry.reason).toBe('string');
      }
    }
  });

  it('skips images when WASM is not initialized', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Without WASM, all images should be skipped
    const { isJpegWasmReady } = await import(
      '../../../../src/wasm/jpeg/bridge.js'
    );
    if (!isJpegWasmReady()) {
      const report = await optimizeAllImages(loaded);
      expect(report.optimizedImages).toBe(0);
      for (const entry of report.perImage) {
        expect(entry.skipped).toBe(true);
      }
    }
  });

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

    const report = await optimizeAllImages(loaded);
    expect(report.totalImages).toBe(2);
    expect(report.perImage.length).toBe(2);
  });

  it('accepts quality option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Should not throw with various quality values
    const report = await optimizeAllImages(loaded, { quality: 50 });
    expect(report).toBeDefined();
  });

  it('accepts progressive option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded, { progressive: true });
    expect(report).toBeDefined();
  });

  it('accepts chromaSubsampling option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded, {
      chromaSubsampling: '4:4:4',
    });
    expect(report).toBeDefined();
  });

  it('accepts autoGrayscale option', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded, { autoGrayscale: true });
    expect(report).toBeDefined();
  });

  it('accepts skipSmallImages option', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded, {
      skipSmallImages: true,
    });
    // Small test images (sample.png is 4x4) should be skipped
    // Either because of skip threshold or because WASM is not available
    expect(report.totalImages).toBeGreaterThanOrEqual(1);
  });

  it('savings percentage is correctly computed', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded);
    // With no images, savings should be 0
    expect(report.savings).toBe(0);
  });

  it('preserves valid PDF after optimization', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    await optimizeAllImages(loaded);

    // Document should still be saveable
    const output = await loaded.save();
    expect(output).toBeInstanceOf(Uint8Array);
    expect(output.length).toBeGreaterThan(0);

    const text = new TextDecoder().decode(output);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});

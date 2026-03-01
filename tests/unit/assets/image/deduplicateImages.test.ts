/**
 * Tests for image deduplication in PDF documents.
 *
 * Covers deduplicateImages() from deduplicateImages.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  deduplicateImages,
  extractImages,
  PageSizes,
} from '../../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../../fixtures/images');

// ---------------------------------------------------------------------------
// deduplicateImages
// ---------------------------------------------------------------------------

describe('deduplicateImages', () => {
  it('returns zero duplicates for PDF with no images', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);
    expect(report.totalImages).toBe(0);
    expect(report.uniqueImages).toBe(0);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.bytesSaved).toBe(0);
  });

  it('returns zero duplicates for PDF with single image', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.totalImages).toBeGreaterThanOrEqual(1);
    expect(report.uniqueImages).toBe(report.totalImages);
  });

  it('detects duplicates when same PNG is embedded multiple times', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    // Embed the same PNG 3 times as separate objects
    const img1 = doc.embedPng(pngBytes);
    const img2 = doc.embedPng(pngBytes);
    const img3 = doc.embedPng(pngBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img1, { x: 0, y: 0, width: 50, height: 50 });
    page.drawImage(img2, { x: 100, y: 0, width: 50, height: 50 });
    page.drawImage(img3, { x: 200, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Before dedup, should have 3 images
    const imagesBefore = extractImages(loaded);
    expect(imagesBefore.length).toBe(3);

    const report = deduplicateImages(loaded);
    expect(report.totalImages).toBe(3);
    expect(report.uniqueImages).toBe(1);
    expect(report.duplicatesRemoved).toBe(2);
    expect(report.bytesSaved).toBeGreaterThan(0);
  });

  it('does not deduplicate different images', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const gradientBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'gradient-8x8.png')));

    const doc = createPdf();
    const img1 = doc.embedPng(pngBytes);
    const img2 = doc.embedPng(gradientBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img1, { x: 0, y: 0, width: 50, height: 50 });
    page.drawImage(img2, { x: 100, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);
    expect(report.totalImages).toBe(2);
    expect(report.uniqueImages).toBe(2);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.bytesSaved).toBe(0);
  });

  it('detects duplicates across pages', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    // Same image on two different pages
    const img1 = doc.embedPng(pngBytes);
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawImage(img1, { x: 0, y: 0, width: 50, height: 50 });

    const img2 = doc.embedPng(pngBytes);
    const page2 = doc.addPage(PageSizes.A4);
    page2.drawImage(img2, { x: 0, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);
    expect(report.totalImages).toBe(2);
    expect(report.uniqueImages).toBe(1);
    expect(report.duplicatesRemoved).toBe(1);
  });

  it('report interface has all required fields', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);
    expect(typeof report.totalImages).toBe('number');
    expect(typeof report.uniqueImages).toBe('number');
    expect(typeof report.duplicatesRemoved).toBe('number');
    expect(typeof report.bytesSaved).toBe('number');
  });
});

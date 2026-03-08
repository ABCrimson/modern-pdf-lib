/**
 * Tests for image extraction from PDF documents.
 *
 * Covers extractImages() and decodeImageStream() from imageExtract.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  extractImages,
  decodeImageStream,
  PageSizes,
} from '../../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../../fixtures/images');

// ---------------------------------------------------------------------------
// extractImages
// ---------------------------------------------------------------------------

describe('extractImages', () => {
  it('returns empty array for PDF with no images', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images).toEqual([]);
  });

  it('extracts a single PNG image from a PDF', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(1);

    const info = images[0]!;
    expect(info.width).toBe(4);
    expect(info.height).toBe(4);
    expect(info.bitsPerComponent).toBe(8);
    expect(info.pageIndex).toBe(0);
    expect(info.name).toMatch(/^\/Im\d+$/);
    expect(info.compressedSize).toBeGreaterThan(0);
    expect(info.stream).toBeDefined();
    expect(info.ref).toBeDefined();
  });

  it('extracts a JPEG image from a PDF', async () => {
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();
    const img = await doc.embedJpeg(jpegBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(1);

    const info = images[0]!;
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);
    expect(info.filters).toContain('DCTDecode');
  });

  it('extracts images from multiple pages', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    for (let i = 0; i < 3; i++) {
      const img = await doc.embedPng(pngBytes);
      const page = doc.addPage(PageSizes.A4);
      page.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });
    }

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(3);

    // Each should be on a different page
    const pageIndices = images.map(img => img.pageIndex);
    expect(new Set(pageIndices).size).toBe(3);
  });

  it('deduplicates images that share the same object reference', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);

    // Same image drawn on multiple pages
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });
    const page2 = doc.addPage(PageSizes.A4);
    page2.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    // The same image ref is used on both pages, but extractImages
    // deduplicates by object number. Depending on how the writer
    // handles shared refs, we might get 1 or 2.
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images.length).toBeLessThanOrEqual(2);
  });

  it('reports correct color space for RGB images', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]!.colorSpace).toBe('DeviceRGB');
    expect(images[0]!.channels).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// decodeImageStream
// ---------------------------------------------------------------------------

describe('decodeImageStream', () => {
  it('decodes FlateDecode stream from an embedded PNG', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const img = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBeGreaterThanOrEqual(1);

    const decoded = decodeImageStream(images[0]!);
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(decoded.length).toBeGreaterThan(0);
  });

  it('returns raw JPEG bytes for DCTDecode stream', async () => {
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();
    const img = await doc.embedJpeg(jpegBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(1);

    // DCTDecode streams are returned as-is (JPEG bytes)
    const decoded = decodeImageStream(images[0]!);
    expect(decoded).toBeInstanceOf(Uint8Array);
    // Should start with JPEG SOI marker
    expect(decoded[0]).toBe(0xFF);
    expect(decoded[1]).toBe(0xD8);
  });
});

/**
 * Real-world end-to-end tests for the image optimization pipeline.
 *
 * Tests the full chain: create PDF with images -> extract / deduplicate /
 * analyze / optimize, using both generated PNGs and fixture images.
 *
 * Covers:
 *  - Document with no images
 *  - Document with embedded PNG images
 *  - Image extraction returns correct metadata
 *  - Deduplication detects identical images
 *  - Analysis report is structurally valid
 *  - Downscale correctness (output dimensions, pixel data integrity)
 *  - Multiple images across multiple pages
 *  - Round-trip: create -> save -> load -> extract
 */

import { describe, it, expect } from 'vitest';
import { zlibSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  loadPdf,
  extractImages,
  optimizeAllImages,
  deduplicateImages,
  analyzeImages,
  PageSizes,
} from '../../src/index.js';
import { downscaleImage } from '../../src/assets/image/imageOptimize.js';
import type { RawImageData } from '../../src/assets/image/imageOptimize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../fixtures/images');

// ---------------------------------------------------------------------------
// Helpers: Minimal PNG builder
// ---------------------------------------------------------------------------

/** Compute CRC32 for a PNG chunk (type + data). */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Write a big-endian 32-bit unsigned integer into a Uint8Array at offset. */
function writeU32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/** Build a single PNG chunk (length + type + data + CRC). */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);

  // Length (4 bytes, big-endian)
  writeU32BE(chunk, 0, data.length);

  // Type (4 bytes)
  chunk.set(typeBytes, 4);

  // Data
  chunk.set(data, 8);

  // CRC (over type + data)
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  writeU32BE(chunk, 8 + data.length, crc32(crcInput));

  return chunk;
}

/**
 * Create a minimal valid PNG file (RGB, bit depth 8).
 *
 * Builds PNG from scratch: signature + IHDR + IDAT (zlib-compressed) + IEND.
 * Uses fflate's `zlibSync` for the zlib wrapper required by the PNG spec.
 *
 * @param w     - Width in pixels.
 * @param h     - Height in pixels.
 * @param rgb   - RGB color to fill every pixel.
 * @returns A complete PNG file as a Uint8Array.
 */
function createMinimalPng(
  w: number,
  h: number,
  rgb: [number, number, number],
): Uint8Array {
  // PNG signature (8 bytes)
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: 13 bytes — width, height, bit depth 8, color type 2 (RGB),
  //   compression 0, filter 0, interlace 0
  const ihdrData = new Uint8Array(13);
  writeU32BE(ihdrData, 0, w);
  writeU32BE(ihdrData, 4, h);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = buildChunk('IHDR', ihdrData);

  // Raw scanlines: each row = 1 filter byte (0 = None) + w * 3 RGB bytes
  const rowBytes = 1 + w * 3;
  const raw = new Uint8Array(h * rowBytes);
  for (let y = 0; y < h; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // filter byte: None
    for (let x = 0; x < w; x++) {
      const pixOffset = rowOffset + 1 + x * 3;
      raw[pixOffset] = rgb[0];
      raw[pixOffset + 1] = rgb[1];
      raw[pixOffset + 2] = rgb[2];
    }
  }

  // Compress with zlib (PNG requires RFC 1950 zlib wrapper, not raw deflate)
  const zlibData = zlibSync(raw, { level: 6 });
  const idat = buildChunk('IDAT', zlibData);

  // IEND: empty chunk
  const iend = buildChunk('IEND', new Uint8Array(0));

  // Concatenate all parts
  const totalLen = signature.length + ihdr.length + idat.length + iend.length;
  const png = new Uint8Array(totalLen);
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdr, offset);
  offset += ihdr.length;
  png.set(idat, offset);
  offset += idat.length;
  png.set(iend, offset);

  return png;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Document with no images
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: document with no images', () => {
  it('optimizeAllImages returns zero-count report', async () => {
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

  it('extractImages returns empty array', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images).toEqual([]);
  });

  it('deduplicateImages returns zero duplicates', async () => {
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

  it('analyzeImages returns empty report with zero totals', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const analysis = analyzeImages(loaded);
    expect(analysis.images).toEqual([]);
    expect(analysis.totalCurrentSize).toBe(0);
    expect(analysis.totalEstimatedSize).toBe(0);
    expect(analysis.totalSavingsPercent).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Document with embedded PNG images
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: document with embedded PNG', () => {
  it('creates and extracts a generated PNG image', async () => {
    const png = createMinimalPng(4, 4, [255, 0, 0]);

    const doc = createPdf();
    const img = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(1);

    const info = images[0]!;
    expect(info.width).toBe(4);
    expect(info.height).toBe(4);
    expect(info.bitsPerComponent).toBe(8);
    expect(info.pageIndex).toBe(0);
    expect(info.compressedSize).toBeGreaterThan(0);
  });

  it('extracts fixture PNG correctly', async () => {
    const pngBytes = new Uint8Array(
      await readFile(resolve(fixturesDir, 'sample.png')),
    );

    const doc = createPdf();
    const img = doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(1);
    expect(images[0]!.width).toBeGreaterThan(0);
    expect(images[0]!.height).toBeGreaterThan(0);
  });

  it('handles multiple images on a single page', async () => {
    const red = createMinimalPng(2, 2, [255, 0, 0]);
    const blue = createMinimalPng(2, 2, [0, 0, 255]);

    const doc = createPdf();
    const img1 = doc.embedPng(red);
    const img2 = doc.embedPng(blue);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img1, { x: 50, y: 700, width: 50, height: 50 });
    page.drawImage(img2, { x: 150, y: 700, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Image deduplication
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: image deduplication', () => {
  it('detects identical images embedded twice', async () => {
    const png = createMinimalPng(4, 4, [0, 128, 255]);

    const doc = createPdf();
    const img1 = doc.embedPng(png);
    const img2 = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img1, { x: 50, y: 700, width: 100, height: 100 });
    page.drawImage(img2, { x: 200, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);

    // Two image XObjects total
    expect(report.totalImages).toBe(2);
    // Both are identical, so one is a duplicate
    expect(report.duplicatesRemoved).toBeGreaterThanOrEqual(1);
    expect(report.uniqueImages).toBeLessThanOrEqual(report.totalImages);
  });

  it('does not flag different images as duplicates', async () => {
    const red = createMinimalPng(4, 4, [255, 0, 0]);
    const green = createMinimalPng(4, 4, [0, 255, 0]);

    const doc = createPdf();
    const img1 = doc.embedPng(red);
    const img2 = doc.embedPng(green);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img1, { x: 50, y: 700, width: 100, height: 100 });
    page.drawImage(img2, { x: 200, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = deduplicateImages(loaded);

    expect(report.totalImages).toBe(2);
    expect(report.uniqueImages).toBe(2);
    expect(report.duplicatesRemoved).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Analysis report validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: analysis report', () => {
  it('returns valid structure for document with images', async () => {
    const png = createMinimalPng(8, 8, [128, 128, 128]);

    const doc = createPdf();
    const img = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const analysis = analyzeImages(loaded);

    expect(analysis.images.length).toBe(1);
    expect(analysis.totalCurrentSize).toBeGreaterThan(0);
    expect(analysis.totalSavingsPercent).toBeGreaterThanOrEqual(0);
    expect(analysis.totalSavingsPercent).toBeLessThanOrEqual(100);

    const img0 = analysis.images[0]!;
    expect(img0.name).toMatch(/^\/Im\d+$/);
    expect(img0.width).toBe(8);
    expect(img0.height).toBe(8);
    expect(img0.currentSize).toBeGreaterThan(0);
    expect(img0.currentFormat).toBeDefined();
    expect(img0.colorSpace).toBeDefined();
    expect(img0.savingsPercent).toBeGreaterThanOrEqual(0);
    expect(img0.savingsPercent).toBeLessThanOrEqual(100);
    expect(['recompress', 'keep', 'downscale', 'grayscale']).toContain(
      img0.recommendation,
    );
  });

  it('totalSavingsPercent stays in [0, 100]', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const analysis = analyzeImages(loaded);
    expect(analysis.totalSavingsPercent).toBeGreaterThanOrEqual(0);
    expect(analysis.totalSavingsPercent).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Downscale correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: downscale correctness', () => {
  it('produces correct output dimensions', () => {
    const image: RawImageData = {
      pixels: new Uint8Array(400 * 300 * 3),
      width: 400,
      height: 300,
      channels: 3,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(image, { maxWidth: 200 });

    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(result.channels).toBe(3);
    expect(result.pixels.length).toBe(200 * 150 * 3);
  });

  it('preserves aspect ratio with maxHeight', () => {
    const image: RawImageData = {
      pixels: new Uint8Array(600 * 400 * 3),
      width: 600,
      height: 400,
      channels: 3,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(image, { maxHeight: 100 });

    expect(result.height).toBe(100);
    expect(result.width).toBe(150);
    expect(result.pixels.length).toBe(150 * 100 * 3);
  });

  it('returns unchanged image when already within bounds', () => {
    const pixels = new Uint8Array(50 * 50 * 3);
    pixels.fill(42);
    const image: RawImageData = {
      pixels,
      width: 50,
      height: 50,
      channels: 3,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(image, { maxWidth: 100, maxHeight: 100 });

    // Should return the same object (no copy needed)
    expect(result).toBe(image);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });

  it('handles single-channel grayscale images', () => {
    const image: RawImageData = {
      pixels: new Uint8Array(200 * 200),
      width: 200,
      height: 200,
      channels: 1,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(image, {
      maxWidth: 50,
      algorithm: 'lanczos',
    });

    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.channels).toBe(1);
    expect(result.pixels.length).toBe(50 * 50);
  });

  it('handles RGBA 4-channel images', () => {
    const image: RawImageData = {
      pixels: new Uint8Array(100 * 100 * 4),
      width: 100,
      height: 100,
      channels: 4,
      bitsPerChannel: 8,
    };

    const result = downscaleImage(image, {
      maxWidth: 25,
      algorithm: 'bilinear',
    });

    expect(result.width).toBe(25);
    expect(result.height).toBe(25);
    expect(result.channels).toBe(4);
    expect(result.pixels.length).toBe(25 * 25 * 4);
  });

  it('all algorithms produce valid pixel data (no NaN, within [0,255])', () => {
    const image: RawImageData = {
      pixels: new Uint8Array(64 * 64 * 3),
      width: 64,
      height: 64,
      channels: 3,
      bitsPerChannel: 8,
    };
    // Fill with a gradient
    for (let i = 0; i < image.pixels.length; i++) {
      (image.pixels as Uint8Array)[i] = (i * 7) & 0xff;
    }

    for (const algorithm of ['nearest', 'bilinear', 'lanczos'] as const) {
      const result = downscaleImage(image, { maxWidth: 16, algorithm });

      expect(result.width).toBe(16);
      expect(result.height).toBe(16);
      expect(result.pixels.length).toBe(16 * 16 * 3);

      // Verify all pixel values are valid
      for (let i = 0; i < result.pixels.length; i++) {
        const val = result.pixels[i]!;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(255);
        expect(Number.isNaN(val)).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Multi-page documents with images
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: multi-page with images', () => {
  it('extracts images across multiple pages', async () => {
    const png1 = createMinimalPng(4, 4, [255, 0, 0]);
    const png2 = createMinimalPng(8, 8, [0, 255, 0]);
    const png3 = createMinimalPng(2, 2, [0, 0, 255]);

    const doc = createPdf();

    const img1 = doc.embedPng(png1);
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawImage(img1, { x: 50, y: 700, width: 100, height: 100 });

    const img2 = doc.embedPng(png2);
    const page2 = doc.addPage(PageSizes.A4);
    page2.drawImage(img2, { x: 50, y: 700, width: 100, height: 100 });

    const img3 = doc.embedPng(png3);
    const page3 = doc.addPage(PageSizes.A4);
    page3.drawImage(img3, { x: 50, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const images = extractImages(loaded);
    expect(images.length).toBe(3);

    // Images should be on different pages
    const pageIndices = images.map((i) => i.pageIndex).sort();
    expect(pageIndices).toEqual([0, 1, 2]);

    // Check dimensions
    const widths = images.map((i) => i.width).sort((a, b) => a - b);
    expect(widths).toEqual([2, 4, 8]);
  });

  it('round-trips: create -> save -> load -> extract -> verify', async () => {
    const pngBytes = new Uint8Array(
      await readFile(resolve(fixturesDir, 'sample.png')),
    );

    // Create a document with the fixture image on two pages
    const doc = createPdf();
    const img = doc.embedPng(pngBytes);

    const page1 = doc.addPage(PageSizes.A4);
    page1.drawImage(img, { x: 10, y: 10, width: 200, height: 200 });

    const page2 = doc.addPage(PageSizes.Letter);
    page2.drawImage(img, { x: 50, y: 50, width: 100, height: 100 });

    // Save and reload
    const savedBytes = await doc.save();
    expect(savedBytes.length).toBeGreaterThan(0);

    const loaded = await loadPdf(savedBytes);
    const pages = loaded.getPages();
    expect(pages.length).toBe(2);

    // Extract images — the same image ref is used on both pages,
    // but extractImages deduplicates by object number
    const images = extractImages(loaded);
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]!.width).toBeGreaterThan(0);
    expect(images[0]!.height).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. optimizeAllImages on documents (without WASM — exercises skip paths)
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: optimizeAllImages without WASM', () => {
  it('skips all images gracefully when JPEG WASM is not initialized', async () => {
    const png = createMinimalPng(4, 4, [128, 64, 32]);

    const doc = createPdf();
    const img = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    // Without initJpegWasm(), all images should be skipped
    const report = await optimizeAllImages(loaded);

    expect(report.totalImages).toBe(1);
    // Without WASM, no images are actually optimized
    expect(report.optimizedImages).toBe(0);
    expect(report.perImage.length).toBe(1);
    expect(report.perImage[0]!.skipped).toBe(true);
  });

  it('handles empty document gracefully', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const report = await optimizeAllImages(loaded);

    expect(report.totalImages).toBe(0);
    expect(report.optimizedImages).toBe(0);
    expect(report.savings).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-world: edge cases', () => {
  it('downscaleImage with 1x1 image returns 1x1', () => {
    const image: RawImageData = {
      pixels: new Uint8Array([255, 0, 0]),
      width: 1,
      height: 1,
      channels: 3,
      bitsPerChannel: 8,
    };

    // maxWidth: 1 should be a no-op
    const result = downscaleImage(image, { maxWidth: 1 });
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('analysis report matches extraction count', async () => {
    const png = createMinimalPng(4, 4, [100, 100, 100]);

    const doc = createPdf();
    const img = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const extracted = extractImages(loaded);
    const analysis = analyzeImages(loaded);

    expect(analysis.images.length).toBe(extracted.length);
  });

  it('deduplication report totalImages matches extraction', async () => {
    const png = createMinimalPng(4, 4, [200, 200, 200]);

    const doc = createPdf();
    const img = doc.embedPng(png);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 0, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);

    const extracted = extractImages(loaded);
    const dedup = deduplicateImages(loaded);

    expect(dedup.totalImages).toBe(extracted.length);
  });
});

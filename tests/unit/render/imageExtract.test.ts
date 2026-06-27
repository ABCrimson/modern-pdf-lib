/**
 * Tests for page-level image extraction (src/render/imageExtract.ts).
 *
 * Verifies that {@link extractImages} walks a page's `/XObject` resources,
 * decodes each image XObject to interleaved 8-bit pixels, and composites a
 * soft mask (`/SMask`) into an alpha channel when present.
 *
 * The test embeds real PNG fixtures (RGBA + RGB) and a JPEG fixture, then
 * round-trips through save + load so the page exposes parsed
 * `/Resources /XObject` entries.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPdf, PdfDocument } from '../../../src/core/pdfDocument.js';
import { extractImages } from '../../../src/render/imageExtract.js';
import {
  initJpegWasm,
  isJpegWasmReady,
} from '../../../src/wasm/jpeg/bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures/images');

describe('extractImages — page-level image XObject extraction', () => {
  it('extracts an RGBA PNG with a composited soft-mask alpha channel', async () => {
    const png = await readFile(resolve(fixturesDir, 'sample-rgba.png'));

    const doc = createPdf();
    const page = doc.addPage([200, 200]);
    const img = await doc.embedPng(new Uint8Array(png));
    page.drawImage(img, { x: 10, y: 10, width: 100, height: 100 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const loadedPage = loaded.getPage(0);

    const images = extractImages(loadedPage);

    // At least one image XObject was recovered.
    expect(images.length).toBeGreaterThanOrEqual(1);

    const main = images[0]!;
    expect(main.width).toBeGreaterThan(0);
    expect(main.height).toBeGreaterThan(0);

    // The source PNG had alpha → it must be composited to RGBA.
    expect(main.hasAlpha).toBe(true);
    expect(main.channels).toBe(4);
    expect(main.pixels.length).toBe(main.width * main.height * 4);

    // Pixels are real 8-bit data, not an empty placeholder.
    expect(main.pixels.length).toBeGreaterThan(0);
    expect(main.colorSpace).toBe('DeviceRGB');
    expect(main.bitsPerComponent).toBe(8);
  });

  it('extracts an opaque RGB PNG as 3-channel pixels (no alpha)', async () => {
    const png = await readFile(resolve(fixturesDir, 'sample.png'));

    const doc = createPdf();
    const page = doc.addPage([200, 200]);
    const img = await doc.embedPng(new Uint8Array(png));
    page.drawImage(img, { x: 0, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const images = extractImages(loaded.getPage(0));

    expect(images.length).toBeGreaterThanOrEqual(1);
    const rgb = images.find((i) => !i.hasAlpha) ?? images[0]!;
    expect(rgb.hasAlpha).toBe(false);
    expect(rgb.channels).toBe(3);
    expect(rgb.colorSpace).toBe('DeviceRGB');
    expect(rgb.width).toBeGreaterThan(0);
    expect(rgb.height).toBeGreaterThan(0);
    expect(rgb.pixels.length).toBe(rgb.width * rgb.height * 3);
  });

  it('handles a JPEG (DCTDecode) embed path', async () => {
    const jpeg = await readFile(resolve(fixturesDir, 'sample.jpg'));

    const doc = createPdf();
    const page = doc.addPage([200, 200]);
    const img = await doc.embedJpeg(new Uint8Array(jpeg));
    page.drawImage(img, { x: 0, y: 0, width: 50, height: 50 });

    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    const loadedPage = loaded.getPage(0);

    // Try to bring up the JPEG WASM decoder; it may be unavailable in CI.
    await initJpegWasm();

    const images = extractImages(loadedPage);

    if (isJpegWasmReady()) {
      // WASM decoder available → the DCTDecode image decodes to real pixels.
      expect(images.length).toBeGreaterThanOrEqual(1);
      const jp = images[0]!;
      expect(jp.width).toBeGreaterThan(0);
      expect(jp.height).toBeGreaterThan(0);
      expect(jp.channels).toBeGreaterThanOrEqual(1);
      expect(jp.pixels.length).toBe(jp.width * jp.height * jp.channels);
    } else {
      // WASM unavailable → JPEG is skipped gracefully (no throw). Fall back to
      // asserting the FlateDecode/PNG path still works in the same harness.
      const doc2 = createPdf();
      const page2 = doc2.addPage([100, 100]);
      const png = await readFile(resolve(fixturesDir, 'sample-rgba.png'));
      const pimg = await doc2.embedPng(new Uint8Array(png));
      page2.drawImage(pimg, { x: 0, y: 0, width: 40, height: 40 });
      const b2 = await doc2.save();
      const l2 = await PdfDocument.load(b2);
      const imgs2 = extractImages(l2.getPage(0));
      expect(imgs2.length).toBeGreaterThanOrEqual(1);
      expect(imgs2[0]!.pixels.length).toBeGreaterThan(0);
      expect(imgs2[0]!.hasAlpha).toBe(true);
    }
  });

  it('does not throw on a page with no images and returns an empty array', async () => {
    const doc = createPdf();
    doc.addPage([100, 100]);
    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    expect(() => extractImages(loaded.getPage(0))).not.toThrow();
    expect(extractImages(loaded.getPage(0))).toEqual([]);
  });
});

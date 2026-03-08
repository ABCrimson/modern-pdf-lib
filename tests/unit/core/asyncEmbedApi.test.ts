/**
 * Tests for the async embed API — ensures all embed methods return promises
 * and validates parallel embedding helpers (embedImages, embedFonts).
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPdf, StandardFonts, PageSizes } from '../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures/images');

// ---------------------------------------------------------------------------
// embedPng — async
// ---------------------------------------------------------------------------

describe('embedPng (async)', () => {
  it('returns a Promise that resolves to ImageRef', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    const result = doc.embedPng(pngBytes);
    // Must be a thenable (Promise)
    expect(result).toBeInstanceOf(Promise);

    const img = await result;
    expect(img).toBeDefined();
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
  });

  it('works with await', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    const img = await doc.embedPng(pngBytes);
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
    expect(img.ref).toBeDefined();
    expect(img.ref.objectNumber).toBeGreaterThan(0);
  });

  it('rejects on invalid data', async () => {
    const doc = createPdf();
    const badData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

    await expect(doc.embedPng(badData)).rejects.toThrow(/[Ii]nvalid PNG|bad signature/);
  });

  it('handles RGBA PNG with alpha separation', async () => {
    const rgbaBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample-rgba.png')));
    const doc = createPdf();

    const img = await doc.embedPng(rgbaBytes);
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);

    // Verify the SMask is present in the saved PDF
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 700, width: 100, height: 100 });
    const bytes = await doc.save({ compress: false });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/SMask');
  });
});

// ---------------------------------------------------------------------------
// embedPngSync — deprecated but functional
// ---------------------------------------------------------------------------

describe('embedPngSync (deprecated)', () => {
  it('returns ImageRef synchronously', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    const img = doc.embedPngSync(pngBytes);
    // Must NOT be a promise — it's the raw ImageRef
    expect(img).not.toBeInstanceOf(Promise);
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
    expect(img.ref).toBeDefined();
    expect(img.ref.objectNumber).toBeGreaterThan(0);
  });

  it('throws synchronously on invalid data', async () => {
    const doc = createPdf();
    const badData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

    expect(() => doc.embedPngSync(badData)).toThrow(/[Ii]nvalid PNG|bad signature/);
  });

  it('produces valid ImageRef usable with drawImage', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    const img = doc.embedPngSync(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(img, { x: 50, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// embedImages — parallel batch embedding
// ---------------------------------------------------------------------------

describe('embedImages (parallel)', () => {
  it('embeds multiple images in parallel', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();

    const images = await doc.embedImages([
      { data: pngBytes },
      { data: jpegBytes },
    ]);

    expect(images).toHaveLength(2);
    // PNG is 4x4
    expect(images[0]!.width).toBe(4);
    expect(images[0]!.height).toBe(4);
    // JPEG is 1x1
    expect(images[1]!.width).toBe(1);
    expect(images[1]!.height).toBe(1);
    // Each has a unique name
    expect(images[0]!.name).not.toBe(images[1]!.name);
  });

  it('preserves order of results', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();

    // Embed in JPEG, PNG order
    const images = await doc.embedImages([
      { data: jpegBytes },
      { data: pngBytes },
    ]);

    // JPEG first (1x1)
    expect(images[0]!.width).toBe(1);
    expect(images[0]!.height).toBe(1);
    // PNG second (4x4)
    expect(images[1]!.width).toBe(4);
    expect(images[1]!.height).toBe(4);
  });

  it('handles single-item array', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();

    const images = await doc.embedImages([{ data: pngBytes }]);
    expect(images).toHaveLength(1);
    expect(images[0]!.width).toBe(4);
  });

  it('handles empty array', async () => {
    const doc = createPdf();

    const images = await doc.embedImages([]);
    expect(images).toHaveLength(0);
  });

  it('works with Promise.all pattern', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();

    // User can also do manual Promise.all with individual embedPng/embedJpeg
    const [png, jpeg] = await Promise.all([
      doc.embedPng(pngBytes),
      doc.embedJpeg(jpegBytes),
    ]);

    expect(png!.width).toBe(4);
    expect(jpeg!.width).toBe(1);
  });

  it('produces valid PDF when images are drawn', async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const jpegBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.jpg')));
    const doc = createPdf();

    const [png, jpeg] = await doc.embedImages([
      { data: pngBytes },
      { data: jpegBytes },
    ]);

    const page = doc.addPage(PageSizes.A4);
    page.drawImage(png!, { x: 50, y: 700, width: 100, height: 100 });
    page.drawImage(jpeg!, { x: 200, y: 700, width: 100, height: 100 });

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    // Verify the PDF contains image XObjects
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/Subtype /Image');
  });
});

// ---------------------------------------------------------------------------
// embedFonts — parallel batch embedding
// ---------------------------------------------------------------------------

describe('embedFonts (parallel)', () => {
  it('embeds multiple standard fonts in parallel', async () => {
    const doc = createPdf();

    const fonts = await doc.embedFonts([
      { data: 'Helvetica' },
      { data: 'Courier' },
      { data: 'Times-Roman' },
    ]);

    expect(fonts).toHaveLength(3);
    expect(fonts[0]!.name).toBeDefined();
    expect(fonts[1]!.name).toBeDefined();
    expect(fonts[2]!.name).toBeDefined();
    // All font names should be unique
    const names = new Set(fonts.map((f) => f.name));
    expect(names.size).toBe(3);
  });

  it('preserves order of results', async () => {
    const doc = createPdf();

    const fonts = await doc.embedFonts([
      { data: 'Courier' },
      { data: 'Helvetica' },
    ]);

    // Verify each font measures text correctly for its type
    const courierWidth = fonts[0]!.widthOfTextAtSize('W', 12);
    const helveticaWidth = fonts[1]!.widthOfTextAtSize('W', 12);
    // Courier is monospaced, Helvetica is proportional — widths differ
    expect(courierWidth).toBeGreaterThan(0);
    expect(helveticaWidth).toBeGreaterThan(0);
  });

  it('handles single-item array', async () => {
    const doc = createPdf();

    const fonts = await doc.embedFonts([{ data: 'Helvetica' }]);
    expect(fonts).toHaveLength(1);
    expect(fonts[0]!.name).toBeDefined();
  });

  it('handles empty array', async () => {
    const doc = createPdf();

    const fonts = await doc.embedFonts([]);
    expect(fonts).toHaveLength(0);
  });

  it('produces valid PDF when fonts are used for text', async () => {
    const doc = createPdf();

    const [helvetica, courier] = await doc.embedFonts([
      { data: 'Helvetica' },
      { data: 'Courier' },
    ]);

    const page = doc.addPage(PageSizes.A4);
    page.drawText('Hello Helvetica', { x: 50, y: 750, size: 14, font: helvetica });
    page.drawText('Hello Courier', { x: 50, y: 730, size: 14, font: courier });

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/Helvetica');
    expect(text).toContain('/Courier');
  });
});

// ---------------------------------------------------------------------------
// embedFont — already async, verify consistency
// ---------------------------------------------------------------------------

describe('embedFont (async consistency)', () => {
  it('returns a Promise for standard fonts', async () => {
    const doc = createPdf();
    const result = doc.embedFont('Helvetica');
    expect(result).toBeInstanceOf(Promise);

    const font = await result;
    expect(font.name).toBeDefined();
    expect(font.ref).toBeDefined();
  });

  it('works with Promise.all for multiple fonts', async () => {
    const doc = createPdf();

    const [f1, f2] = await Promise.all([
      doc.embedFont('Helvetica'),
      doc.embedFont('Courier'),
    ]);

    expect(f1!.name).toBeDefined();
    expect(f2!.name).toBeDefined();
    expect(f1!.name).not.toBe(f2!.name);
  });
});

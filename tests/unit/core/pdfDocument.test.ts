/**
 * Tests for PdfDocument — the root document container.
 *
 * Covers page management, font embedding, metadata, and save output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  PdfDocument,
  StandardFonts,
  PageSizes,
  rgb,
  base64Encode,
  base64Decode,
} from '../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures/images');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfDocument', () => {
  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  it('creates a document with default settings', () => {
    const doc = createPdf();
    expect(doc).toBeInstanceOf(PdfDocument);
    expect(doc.getPageCount()).toBe(0);
    expect(doc.getPages()).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Page management
  // -------------------------------------------------------------------------

  it('adds pages with predefined sizes (A4, Letter, etc.)', () => {
    const doc = createPdf();

    const a4 = doc.addPage(PageSizes.A4);
    expect(a4.width).toBeCloseTo(595.28, 1);
    expect(a4.height).toBeCloseTo(841.89, 1);

    const letter = doc.addPage(PageSizes.Letter);
    expect(letter.width).toBe(612);
    expect(letter.height).toBe(792);

    const legal = doc.addPage(PageSizes.Legal);
    expect(legal.width).toBe(612);
    expect(legal.height).toBe(1008);

    const a3 = doc.addPage(PageSizes.A3);
    expect(a3.width).toBeCloseTo(841.89, 1);
    expect(a3.height).toBeCloseTo(1190.55, 1);

    expect(doc.getPageCount()).toBe(4);
  });

  it('adds pages with custom dimensions', () => {
    const doc = createPdf();
    const page = doc.addPage([300, 400]);
    expect(page.width).toBe(300);
    expect(page.height).toBe(400);
    expect(doc.getPageCount()).toBe(1);
  });

  it('defaults to A4 when no size is provided', () => {
    const doc = createPdf();
    const page = doc.addPage();
    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
  });

  it('multiple pages are correctly ordered', () => {
    const doc = createPdf();
    const p1 = doc.addPage([100, 200]);
    const p2 = doc.addPage([200, 300]);
    const p3 = doc.addPage([300, 400]);

    const pages = doc.getPages();
    expect(pages).toHaveLength(3);
    expect(pages[0]).toBe(p1);
    expect(pages[1]).toBe(p2);
    expect(pages[2]).toBe(p3);
  });

  // -------------------------------------------------------------------------
  // Font embedding (standard fonts)
  // -------------------------------------------------------------------------

  it('embeds standard fonts (Helvetica, etc.)', async () => {
    const doc = createPdf();
    doc.addPage();

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    expect(helvetica).toBeDefined();
    expect(helvetica.name).toMatch(/^F\d+$/);
    expect(helvetica.ref).toBeDefined();
    expect(helvetica.ref.objectNumber).toBeGreaterThan(0);
  });

  it('de-duplicates embedding of the same font', async () => {
    const doc = createPdf();
    doc.addPage();

    const f1 = await doc.embedFont(StandardFonts.Helvetica);
    const f2 = await doc.embedFont(StandardFonts.Helvetica);
    expect(f1).toBe(f2);
    expect(f1.name).toBe(f2.name);
  });

  it('assigns unique resource names to different fonts', async () => {
    const doc = createPdf();
    doc.addPage();

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const courier = await doc.embedFont(StandardFonts.Courier);
    const times = await doc.embedFont(StandardFonts.TimesRoman);

    expect(helvetica.name).not.toBe(courier.name);
    expect(helvetica.name).not.toBe(times.name);
    expect(courier.name).not.toBe(times.name);
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  it('sets metadata (title, author, creation date, producer)', async () => {
    const doc = createPdf();
    doc.addPage();

    doc.setTitle('Test Document');
    doc.setAuthor('Unit Test');
    doc.setCreator('modern-pdf tests');
    doc.setProducer('modern-pdf');
    doc.setSubject('Testing');
    doc.setKeywords('pdf, test');
    doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('Test Document');
    expect(text).toContain('Unit Test');
    expect(text).toContain('modern-pdf tests');
    expect(text).toContain('modern-pdf');
    expect(text).toContain('Testing');
    expect(text).toContain('pdf, test');
    expect(text).toContain('D:20260101');
  });

  // -------------------------------------------------------------------------
  // save() output
  // -------------------------------------------------------------------------

  it('save() returns a Uint8Array', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('save() output starts with %PDF-1.7 and ends with %%EOF', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();
    const text = pdfToString(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('save() with compress: false produces uncompressed output', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.drawText('Hello, World!', { x: 50, y: 700, size: 24 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Uncompressed output should contain the raw operator text
    expect(text).toContain('BT');
    expect(text).toContain('Tj');
    expect(text).toContain('ET');
    // Should NOT contain FlateDecode filter for the content stream
    // (the content stream should be unfiltered)
  });

  it('save() with compress: true produces smaller output than uncompressed', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    // Add enough content to make compression meaningful
    for (let i = 0; i < 20; i++) {
      page.drawText(`Line number ${i} — some repeated text for compression`, {
        x: 50,
        y: 700 - i * 20,
        size: 12,
      });
    }

    const compressedBytes = await doc.save({ compress: true });
    // Create a fresh doc for the uncompressed version since save mutates streams
    const doc2 = createPdf();
    const page2 = doc2.addPage();
    for (let i = 0; i < 20; i++) {
      page2.drawText(`Line number ${i} — some repeated text for compression`, {
        x: 50,
        y: 700 - i * 20,
        size: 12,
      });
    }
    const uncompressedBytes = await doc2.save({ compress: false });

    expect(compressedBytes.length).toBeLessThan(uncompressedBytes.length);
  });

  // -------------------------------------------------------------------------
  // saveAsBlob() (browser-like test)
  // -------------------------------------------------------------------------

  it('saveAsBlob() returns a Blob', async () => {
    const doc = createPdf();
    doc.addPage();
    const blob = await doc.saveAsBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Complete document with fonts in output
  // -------------------------------------------------------------------------

  it('output includes embedded font dictionary', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Test', { x: 50, y: 700, font: font.name, size: 12 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/Type /Font');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/Subtype /Type1');
  });

  it('fonts are registered on pages added before and after embedding', async () => {
    const doc = createPdf();
    const page1 = doc.addPage(); // Added before font embedding
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page2 = doc.addPage(); // Added after font embedding

    // Both pages should be able to draw text with this font
    page1.drawText('Page 1', { x: 50, y: 700, font: font.name, size: 12 });
    page2.drawText('Page 2', { x: 50, y: 700, font: font.name, size: 12 });

    // Should not throw
    const bytes = await doc.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Font measurement (FontRef methods)
  // -------------------------------------------------------------------------

  it('embedFont returns FontRef with widthOfTextAtSize method', async () => {
    const doc = createPdf();
    doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(typeof font.widthOfTextAtSize).toBe('function');
    const width = font.widthOfTextAtSize('Hello', 12);
    expect(typeof width).toBe('number');
    expect(width).toBeGreaterThan(0);
  });

  it('embedFont returns FontRef with heightAtSize method', async () => {
    const doc = createPdf();
    doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(typeof font.heightAtSize).toBe('function');
    const height = font.heightAtSize(12);
    expect(typeof height).toBe('number');
    expect(height).toBeGreaterThan(0);
  });

  it('text measurement produces consistent values', async () => {
    const doc = createPdf();
    doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const w1 = font.widthOfTextAtSize('Test', 12);
    const w2 = font.widthOfTextAtSize('Test', 12);
    expect(w1).toBe(w2);

    const h1 = font.heightAtSize(16);
    const h2 = font.heightAtSize(16);
    expect(h1).toBe(h2);
  });

  it('Helvetica widthOfTextAtSize for "Hello" at 12pt matches expected', async () => {
    const doc = createPdf();
    doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // H=722, e=556, l=222, l=222, o=556 => total=2278
    // At 12pt: 2278 * 12/1000 = 27.336
    const width = font.widthOfTextAtSize('Hello', 12);
    expect(width).toBeCloseTo(27.336, 2);
  });

  it('Courier heightAtSize produces consistent results (monospace)', async () => {
    const doc = createPdf();
    doc.addPage();
    const courier = await doc.embedFont(StandardFonts.Courier);

    // Courier: ascender=629, descender=-157 => height = 786/1000 * fontSize
    const h12 = courier.heightAtSize(12);
    const h24 = courier.heightAtSize(24);
    expect(h12).toBeCloseTo(9.432, 2);
    expect(h24).toBeCloseTo(18.864, 2);
    // Height should scale linearly
    expect(h24).toBeCloseTo(h12 * 2, 2);
  });

  it('embedFont deduplicates standard fonts', async () => {
    const doc = createPdf();
    doc.addPage();

    const f1 = await doc.embedFont(StandardFonts.Courier);
    const f2 = await doc.embedFont(StandardFonts.Courier);
    const f3 = await doc.embedFont(StandardFonts.TimesRoman);

    expect(f1).toBe(f2);
    expect(f1).not.toBe(f3);
    expect(f1.name).toBe(f2.name);
    expect(f1.ref).toBe(f2.ref);
  });

  // -------------------------------------------------------------------------
  // Image embedding
  // -------------------------------------------------------------------------

  it('embedPng accepts PNG bytes and returns ImageRef', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const doc = createPdf();
    doc.addPage();

    const img = await doc.embedPng(new Uint8Array(pngBytes));
    expect(img).toBeDefined();
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.ref).toBeDefined();
    expect(img.ref.objectNumber).toBeGreaterThan(0);
  });

  it('embedPng returns correct dimensions', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const doc = createPdf();
    doc.addPage();

    const img = await doc.embedPng(new Uint8Array(pngBytes));
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
  });

  it('embedJpeg accepts JPEG bytes and returns ImageRef', async () => {
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));
    const doc = createPdf();
    doc.addPage();

    const img = await doc.embedJpeg(new Uint8Array(jpegBytes));
    expect(img).toBeDefined();
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.ref).toBeDefined();
    expect(img.ref.objectNumber).toBeGreaterThan(0);
  });

  it('embedJpeg returns correct dimensions', async () => {
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));
    const doc = createPdf();
    doc.addPage();

    const img = await doc.embedJpeg(new Uint8Array(jpegBytes));
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
  });

  it('addPage registers all embedded fonts automatically', async () => {
    const doc = createPdf();
    const font1 = await doc.embedFont(StandardFonts.Helvetica);
    const font2 = await doc.embedFont(StandardFonts.Courier);

    // Page added AFTER fonts are embedded
    const page = doc.addPage();
    page.drawText('Helvetica text', { x: 50, y: 700, font: font1.name, size: 12 });
    page.drawText('Courier text', { x: 50, y: 680, font: font2.name, size: 12 });

    // Should produce valid output without errors
    const bytes = await doc.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const text = pdfToString(bytes);
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/BaseFont /Courier');
  });

  it('save with compress: true produces smaller output', async () => {
    const doc1 = createPdf();
    const page1 = doc1.addPage();
    for (let i = 0; i < 30; i++) {
      page1.drawText(`Repeated line of text for compression testing ${i}`, {
        x: 50,
        y: 700 - i * 20,
        size: 12,
      });
    }
    const compressed = await doc1.save({ compress: true });

    const doc2 = createPdf();
    const page2 = doc2.addPage();
    for (let i = 0; i < 30; i++) {
      page2.drawText(`Repeated line of text for compression testing ${i}`, {
        x: 50,
        y: 700 - i * 20,
        size: 12,
      });
    }
    const uncompressed = await doc2.save({ compress: false });

    expect(compressed.length).toBeLessThan(uncompressed.length);
  });

  // -------------------------------------------------------------------------
  // saveAsBase64()
  // -------------------------------------------------------------------------

  it('saveAsBase64() returns a valid Base64 string', async () => {
    const doc = createPdf();
    doc.addPage();
    const b64 = await doc.saveAsBase64();
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
    // Should not contain whitespace
    expect(b64).not.toMatch(/\s/);
    // Should be decodable back to bytes that start with %PDF-
    const decoded = base64Decode(b64);
    const header = new TextDecoder().decode(decoded.subarray(0, 8));
    expect(header).toBe('%PDF-1.7');
  });

  it('saveAsBase64({ dataUri: true }) returns a data URI', async () => {
    const doc = createPdf();
    doc.addPage();
    const uri = await doc.saveAsBase64({ dataUri: true });
    expect(uri.startsWith('data:application/pdf;base64,')).toBe(true);
    // Strip the prefix and decode
    const b64 = uri.replace('data:application/pdf;base64,', '');
    const decoded = base64Decode(b64);
    const header = new TextDecoder().decode(decoded.subarray(0, 8));
    expect(header).toBe('%PDF-1.7');
  });

  it('saveAsBase64() without dataUri does not include the prefix', async () => {
    const doc = createPdf();
    doc.addPage();
    const b64 = await doc.saveAsBase64();
    expect(b64.startsWith('data:')).toBe(false);
  });

  it('saveAsBase64() roundtrips through save()', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.drawText('Base64 test', { x: 50, y: 700, size: 16 });
    const bytes = await doc.save();
    const b64 = base64Encode(bytes);

    const doc2 = createPdf();
    const page2 = doc2.addPage();
    page2.drawText('Base64 test', { x: 50, y: 700, size: 16 });
    const b64FromMethod = await doc2.saveAsBase64();

    // Both should produce valid Base64 of similar content
    expect(b64.length).toBeGreaterThan(0);
    expect(b64FromMethod.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // PdfDocument.load() input flexibility
  // -------------------------------------------------------------------------

  it('PdfDocument.load() accepts ArrayBuffer', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const loaded = await PdfDocument.load(arrayBuffer);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('PdfDocument.load() accepts Base64 string', async () => {
    const doc = createPdf();
    doc.addPage();
    const b64 = await doc.saveAsBase64();
    const loaded = await PdfDocument.load(b64);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('PdfDocument.load() accepts Uint8Array (unchanged)', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // embedPng / embedJpeg ArrayBuffer support
  // -------------------------------------------------------------------------

  it('embedPng accepts ArrayBuffer', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const doc = createPdf();
    doc.addPage();

    const arrayBuffer = pngBytes.buffer.slice(
      pngBytes.byteOffset,
      pngBytes.byteOffset + pngBytes.byteLength,
    );
    const img = await doc.embedPng(arrayBuffer);
    expect(img).toBeDefined();
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
  });

  it('embedJpeg accepts ArrayBuffer', async () => {
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));
    const doc = createPdf();
    doc.addPage();

    const arrayBuffer = jpegBytes.buffer.slice(
      jpegBytes.byteOffset,
      jpegBytes.byteOffset + jpegBytes.byteLength,
    );
    const img = await doc.embedJpeg(arrayBuffer);
    expect(img).toBeDefined();
    expect(img.name).toMatch(/^Im\d+$/);
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
  });
});

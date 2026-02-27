/**
 * End-to-end integration tests — full pipeline from createPdf() to save().
 *
 * Verifies that the complete document creation workflow produces valid
 * PDF output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  PageSizes,
  StandardFonts,
  rgb,
  cmyk,
  grayscale,
  degrees,
} from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../fixtures/images');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Count occurrences of a substring. */
function countOccurrences(text: string, sub: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full pipeline integration', () => {
  // -------------------------------------------------------------------------
  // Basic document creation
  // -------------------------------------------------------------------------

  it('creates a complete PDF with text and saves it', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Hello, World!', {
      x: 50,
      y: 700,
      font: font.name,
      size: 24,
      color: rgb(0, 0, 0),
    });

    const bytes = await doc.save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
  });

  // -------------------------------------------------------------------------
  // PDF validity checks
  // -------------------------------------------------------------------------

  it('output is valid PDF (header + EOF check)', async () => {
    const doc = createPdf();
    doc.addPage();

    const bytes = await doc.save();
    const text = pdfToString(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text).toContain('startxref');
  });

  // -------------------------------------------------------------------------
  // Multi-page
  // -------------------------------------------------------------------------

  it('multi-page document has correct page count in /Pages', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addPage(PageSizes.Letter);
    doc.addPage(PageSizes.A3);
    doc.addPage([400, 600]);
    doc.addPage(PageSizes.Legal);

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The /Pages dictionary should have /Count 5
    expect(text).toContain('/Count 5');

    // Should have 5 /Type /Page entries (not /Pages)
    const pageMatches = countOccurrences(text, '/Type /Page\n');
    // At least 5 page objects
    expect(pageMatches).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  it('document with metadata includes /Info dictionary', async () => {
    const doc = createPdf();
    doc.addPage();

    doc.setTitle('Integration Test PDF');
    doc.setAuthor('Test Suite');
    doc.setSubject('Testing');
    doc.setKeywords('pdf, test, integration');
    doc.setCreator('modern-pdf test suite');
    doc.setProducer('modern-pdf');
    doc.setCreationDate(new Date('2026-01-15T12:00:00Z'));

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Trailer should reference /Info
    expect(text).toMatch(/\/Info \d+ \d+ R/);

    // Info dict should contain metadata strings
    expect(text).toContain('Integration Test PDF');
    expect(text).toContain('Test Suite');
    expect(text).toContain('Testing');
    expect(text).toContain('pdf, test, integration');
    expect(text).toContain('modern-pdf test suite');
    expect(text).toContain('D:20260115');
  });

  // -------------------------------------------------------------------------
  // Standard font in output
  // -------------------------------------------------------------------------

  it('document with standard font embeds font reference', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Font test', { x: 50, y: 700, font: font.name, size: 16 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Should have a font dictionary
    expect(text).toContain('/Type /Font');
    expect(text).toContain('/Subtype /Type1');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/Encoding /WinAnsiEncoding');

    // Page resources should reference the font
    expect(text).toContain('/Font');
  });

  it('document with multiple standard fonts embeds all', async () => {
    const doc = createPdf();
    const page = doc.addPage();

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const courier = await doc.embedFont(StandardFonts.Courier);
    const times = await doc.embedFont(StandardFonts.TimesRoman);

    page.drawText('Helvetica', { x: 50, y: 750, font: helvetica.name, size: 14 });
    page.drawText('Courier', { x: 50, y: 720, font: courier.name, size: 14 });
    page.drawText('Times', { x: 50, y: 690, font: times.name, size: 14 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/BaseFont /Courier');
    expect(text).toContain('/BaseFont /Times-Roman');
  });

  // -------------------------------------------------------------------------
  // Shapes
  // -------------------------------------------------------------------------

  it('document with shapes includes graphics operators', async () => {
    const doc = createPdf();
    const page = doc.addPage();

    page.drawRectangle({
      x: 50,
      y: 600,
      width: 200,
      height: 100,
      color: rgb(0.8, 0.2, 0.2),
    });

    page.drawLine({
      start: { x: 50, y: 580 },
      end: { x: 250, y: 580 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    page.drawCircle({
      x: 150,
      y: 450,
      size: 50,
      borderColor: rgb(0, 0, 0.8),
      borderWidth: 2,
    });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Rectangle
    expect(text).toContain('re');
    // Line
    expect(text).toMatch(/\d+.*\d+.*m/); // moveTo
    expect(text).toMatch(/\d+.*\d+.*l/); // lineTo
    // Circle (Bezier curves)
    expect(text).toContain(' c\n');
    // Color operators
    expect(text).toContain('rg');  // fill color
    expect(text).toContain('RG');  // stroke color
    // Graphics state
    expect(text).toContain('q\n');
    expect(text).toContain('Q\n');
  });

  // -------------------------------------------------------------------------
  // Large document
  // -------------------------------------------------------------------------

  it('large document (100 pages) completes within timeout', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 100; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 18,
      });
      page.drawRectangle({
        x: 50,
        y: 700,
        width: 495,
        height: 2,
        color: rgb(0, 0, 0),
      });
      page.drawText(`This is the body text on page ${i + 1} of the document.`, {
        x: 50,
        y: 680,
        font: font.name,
        size: 12,
      });
    }

    const bytes = await doc.save({ compress: true });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 100');
  }, 30000); // 30 second timeout

  // -------------------------------------------------------------------------
  // Uncompressed readability
  // -------------------------------------------------------------------------

  it('uncompressed PDF contains readable operator streams', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Readable content', { x: 50, y: 700, font: font.name, size: 16 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The content stream should contain the raw text operators
    expect(text).toContain('BT');
    expect(text).toContain('Readable content');
    expect(text).toContain('Tj');
    expect(text).toContain('ET');
    expect(text).toContain('Tf');
  });

  // -------------------------------------------------------------------------
  // Combined features
  // -------------------------------------------------------------------------

  it('complex document with text, shapes, and metadata', async () => {
    const doc = createPdf();

    doc.setTitle('Complex Document');
    doc.setAuthor('Integration Test');
    doc.setCreationDate(new Date('2026-02-01T00:00:00Z'));

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    // Page 1: Title page
    const page1 = doc.addPage(PageSizes.A4);
    page1.drawText('Complex Document', {
      x: 50,
      y: 700,
      font: boldFont.name,
      size: 36,
      color: rgb(0.1, 0.1, 0.1),
    });
    page1.drawRectangle({
      x: 50,
      y: 680,
      width: 400,
      height: 3,
      color: rgb(0.2, 0.2, 0.8),
    });

    // Page 2: Content page
    const page2 = doc.addPage(PageSizes.A4);
    page2.drawText('Chapter 1', {
      x: 50,
      y: 750,
      font: boldFont.name,
      size: 24,
    });
    for (let i = 0; i < 5; i++) {
      page2.drawText(`Paragraph ${i + 1}: Lorem ipsum dolor sit amet.`, {
        x: 50,
        y: 700 - i * 30,
        font: font.name,
        size: 12,
      });
    }
    page2.drawCircle({
      x: 300,
      y: 400,
      size: 60,
      color: rgb(0.9, 0.1, 0.1),
      borderColor: rgb(0, 0, 0),
      borderWidth: 2,
    });

    const bytes = await doc.save({ compress: true });
    const text = pdfToString(bytes);

    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('/Count 2');
    expect(text).toContain('Complex Document');
    expect(text).toContain('Integration Test');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/BaseFont /Helvetica-Bold');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Image embedding integration
  // -------------------------------------------------------------------------

  it('creates PDF with embedded PNG image', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    page.drawImage(img, { x: 50, y: 400, width: 200, height: 200 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('/Type /XObject');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Width 4');
    expect(text).toContain('/Height 4');
    expect(text).toContain('/ColorSpace /DeviceRGB');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('creates PDF with embedded JPEG image', async () => {
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const img = await doc.embedJpeg(new Uint8Array(jpegBytes));

    page.drawImage(img, { x: 50, y: 400, width: 100, height: 100 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('/Type /XObject');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('creates PDF with multiple images on one page', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));

    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    const png = await doc.embedPng(new Uint8Array(pngBytes));
    const jpg = await doc.embedJpeg(new Uint8Array(jpegBytes));

    page.drawImage(png, { x: 50, y: 600, width: 150, height: 150 });
    page.drawImage(jpg, { x: 250, y: 600, width: 100, height: 100 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // Both images should produce XObject entries
    expect(text).toContain('/Im1');
    expect(text).toContain('/Im2');
    // Both image XObject types should be present
    expect(countOccurrences(text, '/Type /XObject')).toBeGreaterThanOrEqual(2);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('PDF with images has /XObject resources', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'gradient-8x8.png'));
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    page.drawImage(img, { x: 100, y: 100, width: 300, height: 300 });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    // The page resources should contain an XObject dictionary
    expect(text).toContain('/XObject');
    expect(text).toContain('/Im1');
    // Image dimensions should be correct
    expect(text).toContain('/Width 8');
    expect(text).toContain('/Height 8');
  });

  it('complete document with text, shapes, and images', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));
    const jpegBytes = await readFile(resolve(fixturesDir, 'sample.jpg'));

    const doc = createPdf();
    doc.setTitle('Complete Document Test');
    doc.setAuthor('Test Suite');

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const png = await doc.embedPng(new Uint8Array(pngBytes));
    const jpg = await doc.embedJpeg(new Uint8Array(jpegBytes));

    const page = doc.addPage(PageSizes.A4);

    // Text
    page.drawText('Document with images', {
      x: 50,
      y: 750,
      font: font.name,
      size: 24,
      color: rgb(0, 0, 0),
    });

    // Rectangle
    page.drawRectangle({
      x: 50,
      y: 730,
      width: 300,
      height: 2,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Images
    page.drawImage(png, { x: 50, y: 500, width: 200, height: 200 });
    page.drawImage(jpg, { x: 300, y: 500, width: 100, height: 100 });

    // Circle
    page.drawCircle({
      x: 400,
      y: 350,
      size: 40,
      color: rgb(0.8, 0.2, 0.2),
    });

    const bytes = await doc.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('Complete Document Test');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/Type /XObject');
    expect(text).toContain('/XObject');
    expect(text).toContain('/Font');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('FontRef measurement matches expected values for known strings', async () => {
    const doc = createPdf();
    doc.addPage();

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const courier = await doc.embedFont(StandardFonts.Courier);

    // "Hello" in Helvetica at 12pt: H(722)+e(556)+l(222)+l(222)+o(556) = 2278
    // width = 2278 * 12/1000 = 27.336
    expect(helvetica.widthOfTextAtSize('Hello', 12)).toBeCloseTo(27.336, 2);

    // Courier is monospace (600 per char for printable chars)
    // "Hello" = 5 chars * 600 * 12/1000 = 36
    expect(courier.widthOfTextAtSize('Hello', 12)).toBeCloseTo(36, 2);

    // Height measurements
    // Helvetica: (718 - (-207)) / 1000 * 12 = 11.1
    expect(helvetica.heightAtSize(12)).toBeCloseTo(11.1, 2);
    // Courier: (629 - (-157)) / 1000 * 12 = 9.432
    expect(courier.heightAtSize(12)).toBeCloseTo(9.432, 2);

    // Scaling: double font size should double measurements
    expect(helvetica.widthOfTextAtSize('Hello', 24)).toBeCloseTo(27.336 * 2, 2);
    expect(helvetica.heightAtSize(24)).toBeCloseTo(11.1 * 2, 2);
  });
});

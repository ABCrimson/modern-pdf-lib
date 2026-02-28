/**
 * Stress / scale tests — verify the library handles large documents,
 * many fields, deep merges, and heavy content without errors.
 *
 * All tests create real PDFs and verify the output structurally.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPdf,
  PageSizes,
  StandardFonts,
  rgb,
  loadPdf,
  mergePdfs,
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

/** Verify that the byte array is a structurally valid PDF. */
function assertValidPdf(bytes: Uint8Array): void {
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.length).toBeGreaterThan(100);
  const text = pdfToString(bytes);
  expect(text.startsWith('%PDF-1.')).toBe(true);
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
}

// ---------------------------------------------------------------------------
// Stress tests
// ---------------------------------------------------------------------------

describe('Stress tests', () => {
  // -------------------------------------------------------------------------
  // 1. 1,000-page document
  // -------------------------------------------------------------------------

  it('creates a 1000-page document', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 1000; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: 750,
        size: 14,
        font: font.name,
        color: rgb(0, 0, 0),
      });
    }

    expect(doc.getPageCount()).toBe(1000);

    const bytes = await doc.save();
    assertValidPdf(bytes);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 1000');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. 10,000 form fields
  // -------------------------------------------------------------------------

  it('creates 10,000 form fields across 100 pages', async () => {
    const doc = createPdf();
    const form = doc.getForm();

    for (let p = 0; p < 100; p++) {
      doc.addPage(PageSizes.A4);
      for (let f = 0; f < 100; f++) {
        const fieldName = `field_p${p}_f${f}`;
        const y = 800 - (f % 50) * 15;
        const col = f < 50 ? 0 : 250;
        form.createTextField(fieldName, p, [col, y, col + 200, y + 12]);
      }
    }

    expect(form.getFields().length).toBe(10_000);

    const bytes = await doc.save();
    assertValidPdf(bytes);
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. Large text content (100KB of text on a single page)
  // -------------------------------------------------------------------------

  it('handles 100KB of text on a single page', async () => {
    const doc = createPdf();
    const page = doc.addPage([612, 100_000]); // very tall page
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Build a ~100KB text string by repeating a paragraph
    const paragraph =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. ';
    const repeats = Math.ceil(100_000 / paragraph.length);

    // Draw the text line by line so the content stream contains the data
    for (let i = 0; i < repeats; i++) {
      page.drawText(paragraph, {
        x: 50,
        y: 99_900 - i * 14,
        size: 10,
        font: font.name,
        color: rgb(0, 0, 0),
      });
    }

    const bytes = await doc.save({ compress: false });
    assertValidPdf(bytes);
    // Uncompressed output with 100KB of text should produce significant output
    expect(bytes.length).toBeGreaterThan(10_000);
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. 1,000 images (same image drawn on 1000 pages)
  // -------------------------------------------------------------------------

  it('draws the same image on 1000 pages', async () => {
    const pngBytes = await readFile(resolve(fixturesDir, 'sample.png'));

    const doc = createPdf();
    const img = await doc.embedPng(new Uint8Array(pngBytes));

    for (let i = 0; i < 1000; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawImage(img, { x: 50, y: 400, width: 100, height: 100 });
    }

    expect(doc.getPageCount()).toBe(1000);

    const bytes = await doc.save();
    assertValidPdf(bytes);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 1000');
    // The image XObject should be present
    expect(text).toContain('/Type /XObject');
    expect(text).toContain('/Subtype /Image');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. Deep merge — 50 separate 10-page documents merged into one
  // -------------------------------------------------------------------------

  it('merges 50 ten-page documents into 500 pages', async () => {
    const documents = [];
    for (let d = 0; d < 50; d++) {
      const doc = createPdf();
      for (let p = 0; p < 10; p++) {
        const page = doc.addPage(PageSizes.A4);
        page.drawText(`Doc ${d + 1} Page ${p + 1}`, { x: 50, y: 750, size: 14 });
      }
      documents.push(doc);
    }

    const merged = await mergePdfs(documents);

    expect(merged.getPageCount()).toBe(500);

    const bytes = await merged.save();
    assertValidPdf(bytes);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 500');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. Save + reload cycle
  // -------------------------------------------------------------------------

  it('round-trips through save and loadPdf', async () => {
    // Step 1: Create and save a doc with text
    const doc1 = createPdf();
    const font1 = await doc1.embedFont(StandardFonts.Helvetica);
    const page1 = doc1.addPage(PageSizes.A4);
    page1.drawText('Original page', {
      x: 50,
      y: 750,
      size: 18,
      font: font1.name,
      color: rgb(0, 0, 0),
    });
    const bytes1 = await doc1.save();
    assertValidPdf(bytes1);

    // Step 2: Reload and add a new page
    const doc2 = await loadPdf(bytes1);
    expect(doc2.getPageCount()).toBe(1);

    const font2 = await doc2.embedFont(StandardFonts.Courier);
    const page2 = doc2.addPage(PageSizes.Letter);
    page2.drawText('New page after reload', {
      x: 50,
      y: 750,
      size: 16,
      font: font2.name,
      color: rgb(0.2, 0, 0),
    });

    // Step 3: Save again and verify
    const bytes2 = await doc2.save();
    assertValidPdf(bytes2);

    // The reloaded doc should have 2 pages
    const doc3 = await loadPdf(bytes2);
    expect(doc3.getPageCount()).toBe(2);
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. 500 annotations on a single page
  // -------------------------------------------------------------------------

  it('creates 500 annotations on a single page', async () => {
    const doc = createPdf();
    const page = doc.addPage([612, 50_000]); // tall page so annotations fit

    for (let i = 0; i < 500; i++) {
      const y = 49_900 - i * 30;
      page.addAnnotation('Text', {
        rect: [50, y, 70, y + 20],
        contents: `Sticky note #${i + 1}`,
        color: { r: 1, g: 1, b: 0 },
      });
    }

    expect(page.getAnnotations().length).toBe(500);

    const bytes = await doc.save({ compress: false });
    assertValidPdf(bytes);

    // The output should contain annotation dictionaries
    const text = pdfToString(bytes);
    expect(text).toContain('/Subtype /Text');
    expect(text).toContain('/Annots');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 8. All 14 standard fonts
  // -------------------------------------------------------------------------

  it('embeds all 14 standard fonts and draws text with each', async () => {
    const doc = createPdf();
    const fontKeys = Object.keys(StandardFonts) as (keyof typeof StandardFonts)[];

    expect(fontKeys.length).toBe(14);

    const fonts: Array<{ name: string; label: string }> = [];
    for (const key of fontKeys) {
      const fontRef = await doc.embedFont(StandardFonts[key]);
      fonts.push({ name: fontRef.name, label: key });
    }

    for (let i = 0; i < fonts.length; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`This text uses ${fonts[i]!.label}`, {
        x: 50,
        y: 750,
        size: 16,
        font: fonts[i]!.name,
        color: rgb(0, 0, 0),
      });
    }

    expect(doc.getPageCount()).toBe(14);

    const bytes = await doc.save({ compress: false });
    assertValidPdf(bytes);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 14');
    // Verify each base font name appears
    expect(text).toContain('/BaseFont /Courier');
    expect(text).toContain('/BaseFont /Courier-Bold');
    expect(text).toContain('/BaseFont /Courier-Oblique');
    expect(text).toContain('/BaseFont /Courier-BoldOblique');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/BaseFont /Helvetica-Bold');
    expect(text).toContain('/BaseFont /Helvetica-Oblique');
    expect(text).toContain('/BaseFont /Helvetica-BoldOblique');
    expect(text).toContain('/BaseFont /Times-Roman');
    expect(text).toContain('/BaseFont /Times-Bold');
    expect(text).toContain('/BaseFont /Times-Italic');
    expect(text).toContain('/BaseFont /Times-BoldItalic');
    expect(text).toContain('/BaseFont /Symbol');
    expect(text).toContain('/BaseFont /ZapfDingbats');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 9. Concurrent-safe state (interleaved drawing on multiple pages)
  // -------------------------------------------------------------------------

  it('handles interleaved drawing on multiple pages', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const page1 = doc.addPage(PageSizes.A4);
    const page2 = doc.addPage(PageSizes.A4);
    const page3 = doc.addPage(PageSizes.A4);

    // Draw on pages in interleaved order
    page1.drawText('Page 1 - First draw', {
      x: 50, y: 750, size: 14, font: font.name, color: rgb(1, 0, 0),
    });
    page2.drawText('Page 2 - First draw', {
      x: 50, y: 750, size: 14, font: font.name, color: rgb(0, 1, 0),
    });
    page1.drawText('Page 1 - Second draw', {
      x: 50, y: 720, size: 14, font: font.name, color: rgb(1, 0, 0),
    });
    page3.drawText('Page 3 - First draw', {
      x: 50, y: 750, size: 14, font: font.name, color: rgb(0, 0, 1),
    });
    page2.drawText('Page 2 - Second draw', {
      x: 50, y: 720, size: 14, font: font.name, color: rgb(0, 1, 0),
    });
    page1.drawText('Page 1 - Third draw', {
      x: 50, y: 690, size: 14, font: font.name, color: rgb(1, 0, 0),
    });
    page3.drawText('Page 3 - Second draw', {
      x: 50, y: 720, size: 14, font: font.name, color: rgb(0, 0, 1),
    });

    // Also add some shapes in interleaved order
    page2.drawRectangle({ x: 50, y: 600, width: 100, height: 50, color: rgb(0, 1, 0) });
    page1.drawRectangle({ x: 50, y: 600, width: 100, height: 50, color: rgb(1, 0, 0) });
    page3.drawCircle({ x: 100, y: 500, size: 40, color: rgb(0, 0, 1) });

    const bytes = await doc.save({ compress: false });
    assertValidPdf(bytes);

    const text = pdfToString(bytes);
    expect(text).toContain('/Count 3');

    // Verify each page has its own content by checking unique text strings
    expect(text).toContain('Page 1 - First draw');
    expect(text).toContain('Page 1 - Second draw');
    expect(text).toContain('Page 1 - Third draw');
    expect(text).toContain('Page 2 - First draw');
    expect(text).toContain('Page 2 - Second draw');
    expect(text).toContain('Page 3 - First draw');
    expect(text).toContain('Page 3 - Second draw');
  }, 30_000);

  // -------------------------------------------------------------------------
  // 10. Large output (>10MB)
  // -------------------------------------------------------------------------

  it('produces output exceeding 10MB', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Each page with many verbose text draws; uncompressed, the PDF
    // operators for each drawText call (~200 bytes of overhead + the
    // string itself) add up. We need enough total content to exceed 10MB.
    const longLine =
      'The quick brown fox jumps over the lazy dog. ' +
      'Pack my box with five dozen liquor jugs. ' +
      'How vexingly quick daft zebras jump. ' +
      'The five boxing wizards jump quickly. ' +
      'Sphinx of black quartz, judge my vow. ' +
      'Two driven jocks help fax my big quiz. ' +
      'Amazingly few discotheques provide jukeboxes. ' +
      'Heavy boxers perform quick waltzes and jigs. ' +
      'Waltz, bad nymph, for quick jigs vex. ' +
      'Glib jocks quiz nymph to vex dwarf. ';

    for (let p = 0; p < 500; p++) {
      const page = doc.addPage(PageSizes.A4);
      for (let line = 0; line < 55; line++) {
        page.drawText(`[${p}:${line}] ${longLine}`, {
          x: 10,
          y: 800 - line * 14,
          size: 6,
          font: font.name,
          color: rgb(0, 0, 0),
        });
      }
    }

    expect(doc.getPageCount()).toBe(500);

    const bytes = await doc.save({ compress: false });
    assertValidPdf(bytes);

    // With compress: false, the raw content streams should push us well over 10MB
    expect(bytes.length).toBeGreaterThan(10 * 1024 * 1024);
  }, 30_000);
});

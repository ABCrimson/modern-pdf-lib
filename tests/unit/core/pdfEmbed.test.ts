/**
 * Tests for PDF page embedding (Form XObjects).
 *
 * Covers: embedPdf, embedPage, drawPage, EmbeddedPdfPage,
 * deep cloning of resources, round-trip embedding.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PdfDocument,
  PageSizes,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
  PdfRef,
} from '../../../src/index.js';
import type { EmbeddedPdfPage } from '../../../src/core/pdfEmbed.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Create a simple PDF document with text on a page and save it as bytes.
 */
async function createSourcePdfBytes(
  text: string = 'Hello from source',
  pageSize: readonly [number, number] = PageSizes.A4,
): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage(pageSize);
  page.drawText(text, { x: 50, y: 750, size: 24 });
  return doc.save();
}

/**
 * Create a multi-page source PDF.
 */
async function createMultiPagePdfBytes(pageCount: number): Promise<Uint8Array> {
  const doc = createPdf();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage(PageSizes.A4);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24 });
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// embedPdf
// ---------------------------------------------------------------------------

describe('embedPdf', () => {
  it('embeds the first page by default', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const result = await doc.embedPdf(sourceBytes);

    expect(result).toHaveLength(1);
    const embedded = result[0]!;
    expect(embedded.name).toBe('XF1');
    expect(embedded.ref).toBeInstanceOf(PdfRef);
    expect(embedded.width).toBeCloseTo(PageSizes.A4[0], 0);
    expect(embedded.height).toBeCloseTo(PageSizes.A4[1], 0);
  });

  it('accepts ArrayBuffer as input', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const result = await doc.embedPdf(sourceBytes.buffer as ArrayBuffer);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('XF1');
  });

  it('embeds specific page indices', async () => {
    const sourceBytes = await createMultiPagePdfBytes(5);
    const doc = createPdf();
    const result = await doc.embedPdf(sourceBytes, [0, 2, 4]);

    expect(result).toHaveLength(3);
    expect(result[0]!.name).toBe('XF1');
    expect(result[1]!.name).toBe('XF2');
    expect(result[2]!.name).toBe('XF3');
  });

  it('throws on invalid page index', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();

    await expect(doc.embedPdf(sourceBytes, [5])).rejects.toThrow(
      /page index 5 out of range/,
    );
  });

  it('throws on negative page index', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();

    await expect(doc.embedPdf(sourceBytes, [-1])).rejects.toThrow(
      /page index -1 out of range/,
    );
  });

  it('creates a form XObject with correct structure', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    // Resolve the form XObject from the registry
    const registry = doc.getRegistry();
    const formObj = registry.resolve(embedded!.ref);
    expect(formObj).toBeDefined();
    expect(formObj!.kind).toBe('stream');

    const formStream = formObj as PdfStream;
    const dict = formStream.dict;

    // Verify Form XObject dictionary entries
    const type = dict.get('/Type');
    expect(type).toBeDefined();
    expect((type as PdfName).value).toBe('/XObject');

    const subtype = dict.get('/Subtype');
    expect(subtype).toBeDefined();
    expect((subtype as PdfName).value).toBe('/Form');

    const bbox = dict.get('/BBox');
    expect(bbox).toBeDefined();
    expect(bbox).toBeInstanceOf(PdfArray);
    const bboxArr = bbox as PdfArray;
    expect(bboxArr.items).toHaveLength(4);
    expect((bboxArr.items[0] as PdfNumber).value).toBeCloseTo(0, 0);
    expect((bboxArr.items[1] as PdfNumber).value).toBeCloseTo(0, 0);
    expect((bboxArr.items[2] as PdfNumber).value).toBeCloseTo(PageSizes.A4[0], 0);
    expect((bboxArr.items[3] as PdfNumber).value).toBeCloseTo(PageSizes.A4[1], 0);

    const resources = dict.get('/Resources');
    expect(resources).toBeDefined();

    const matrix = dict.get('/Matrix');
    expect(matrix).toBeDefined();
    expect(matrix).toBeInstanceOf(PdfArray);

    // Stream data should not be empty (contains the content operators)
    expect(formStream.data.length).toBeGreaterThan(0);
  });

  it('increments form XObject names across multiple calls', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();

    const [first] = await doc.embedPdf(sourceBytes);
    const [second] = await doc.embedPdf(sourceBytes);

    expect(first!.name).toBe('XF1');
    expect(second!.name).toBe('XF2');
  });
});

// ---------------------------------------------------------------------------
// EmbeddedPdfPage helpers
// ---------------------------------------------------------------------------

describe('EmbeddedPdfPage', () => {
  it('scale() returns scaled dimensions', async () => {
    const sourceBytes = await createSourcePdfBytes('test', [200, 400]);
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const scaled = embedded!.scale(0.5);
    expect(scaled.width).toBeCloseTo(100, 0);
    expect(scaled.height).toBeCloseTo(200, 0);
  });

  it('scaleToFit() fits within max bounds preserving aspect ratio', async () => {
    const sourceBytes = await createSourcePdfBytes('test', [200, 400]);
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    // Fit into 100x100 box — height is the constraining dimension
    const fitted = embedded!.scaleToFit(100, 100);
    expect(fitted.width).toBeCloseTo(50, 0);
    expect(fitted.height).toBeCloseTo(100, 0);

    // Fit into 400x200 box — both should be halved
    const fitted2 = embedded!.scaleToFit(400, 200);
    expect(fitted2.width).toBeCloseTo(100, 0);
    expect(fitted2.height).toBeCloseTo(200, 0);
  });
});

// ---------------------------------------------------------------------------
// embedPage
// ---------------------------------------------------------------------------

describe('embedPage', () => {
  it('embeds a page from the same document', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.Letter);
    page.drawText('Original content', { x: 50, y: 700, size: 18 });

    const embedded = doc.embedPage(page);
    expect(embedded.name).toBe('XF1');
    expect(embedded.width).toBeCloseTo(PageSizes.Letter[0], 0);
    expect(embedded.height).toBeCloseTo(PageSizes.Letter[1], 0);
  });

  it('embeds a page from another loaded document', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const sourceDoc = await PdfDocument.load(sourceBytes);
    const sourcePage = sourceDoc.getPage(0);

    const targetDoc = createPdf();
    const embedded = targetDoc.embedPage(sourcePage);

    expect(embedded.ref).toBeInstanceOf(PdfRef);
    expect(embedded.width).toBeCloseTo(PageSizes.A4[0], 0);
    expect(embedded.height).toBeCloseTo(PageSizes.A4[1], 0);
  });
});

// ---------------------------------------------------------------------------
// drawPage
// ---------------------------------------------------------------------------

describe('drawPage', () => {
  it('emits correct operator sequence for basic draw', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, { x: 50, y: 100, width: 300, height: 400 });

    const ops = page.getContentStreamData();
    // Should contain: q, cm, /XF1 Do, Q
    expect(ops).toContain('q\n');
    expect(ops).toContain('cm\n');
    expect(ops).toContain('/XF1 Do\n');
    expect(ops).toContain('Q\n');
  });

  it('uses original dimensions when width/height are omitted', async () => {
    const sourceBytes = await createSourcePdfBytes('test', [200, 300]);
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, { x: 10, y: 20 });

    const ops = page.getContentStreamData();
    // Scale should be 1:1 since width/height match the original
    expect(ops).toContain('1 0 0 1 10 20 cm\n');
    expect(ops).toContain('/XF1 Do\n');
  });

  it('emits correct scaling matrix', async () => {
    const sourceBytes = await createSourcePdfBytes('test', [100, 200]);
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    // Draw at (0,0) with doubled size
    page.drawPage(embedded!, { x: 0, y: 0, width: 200, height: 400 });

    const ops = page.getContentStreamData();
    // Scale factors: 200/100 = 2, 400/200 = 2
    expect(ops).toContain('2 0 0 2 0 0 cm\n');
  });

  it('handles rotation option', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, {
      x: 50,
      y: 50,
      rotate: { type: 'degrees', value: 90 },
    });

    const ops = page.getContentStreamData();
    expect(ops).toContain('q\n');
    expect(ops).toContain('cm\n');
    expect(ops).toContain('/XF1 Do\n');
    expect(ops).toContain('Q\n');
  });

  it('handles opacity option', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, { x: 0, y: 0, opacity: 0.5 });

    const ops = page.getContentStreamData();
    // Should contain ExtGState reference
    expect(ops).toContain('gs\n');
    expect(ops).toContain('/XF1 Do\n');
  });

  it('registers the XObject resource on the page', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, { x: 0, y: 0 });

    // Build resources and check XObject dict
    const resources = page.buildResources();
    const xObjDict = resources.get('/XObject');
    expect(xObjDict).toBeDefined();
    expect(xObjDict!.kind).toBe('dict');

    const xfRef = (xObjDict as PdfDict).get('XF1');
    expect(xfRef).toBeDefined();
    expect(xfRef!.kind).toBe('ref');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: embed -> save -> load -> verify structure
// ---------------------------------------------------------------------------

describe('round-trip embedding', () => {
  it('preserves form XObject in save -> load cycle', async () => {
    // Step 1: Create source PDF
    const sourceBytes = await createSourcePdfBytes('Source text');

    // Step 2: Create target PDF with embedded page
    const targetDoc = createPdf();
    const [embedded] = await targetDoc.embedPdf(sourceBytes);

    const targetPage = targetDoc.addPage(PageSizes.A4);
    targetPage.drawPage(embedded!, { x: 50, y: 50, width: 300, height: 400 });

    // Step 3: Save the target
    const savedBytes = await targetDoc.save();

    // Step 4: Verify the saved PDF is valid
    expect(savedBytes.length).toBeGreaterThan(0);
    const pdfStr = pdfToString(savedBytes);
    expect(pdfStr).toContain('%PDF-');

    // The saved output should contain a Form XObject
    expect(pdfStr).toContain('/Type /XObject');
    expect(pdfStr).toContain('/Subtype /Form');
    expect(pdfStr).toContain('/BBox');

    // Step 5: Reload and verify structure
    const reloaded = await PdfDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('round-trips multiple embedded pages', async () => {
    const sourceBytes = await createMultiPagePdfBytes(3);

    const targetDoc = createPdf();
    const embeddedPages = await targetDoc.embedPdf(sourceBytes, [0, 1, 2]);

    const page = targetDoc.addPage(PageSizes.A4);
    for (let i = 0; i < embeddedPages.length; i++) {
      page.drawPage(embeddedPages[i]!, {
        x: 10,
        y: 10 + i * 200,
        width: 100,
        height: 150,
      });
    }

    const savedBytes = await targetDoc.save();
    expect(savedBytes.length).toBeGreaterThan(0);

    const pdfStr = pdfToString(savedBytes);
    // Should have form XObjects for each embedded page
    expect(pdfStr).toContain('/Subtype /Form');

    // Reload
    const reloaded = await PdfDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('embedded page from loaded PDF preserves content', async () => {
    // Create a source PDF with specific content
    const srcDoc = createPdf();
    const srcPage = srcDoc.addPage([200, 300]);
    srcPage.drawText('Embed me!', { x: 10, y: 250, size: 12 });
    srcPage.drawRectangle({ x: 5, y: 5, width: 190, height: 290, borderColor: { type: 'rgb', r: 1, g: 0, b: 0 } });
    const srcBytes = await srcDoc.save();

    // Embed into a new doc
    const targetDoc = createPdf();
    const [embedded] = await targetDoc.embedPdf(srcBytes);
    expect(embedded!.width).toBeCloseTo(200);
    expect(embedded!.height).toBeCloseTo(300);

    const targetPage = targetDoc.addPage(PageSizes.A4);
    targetPage.drawPage(embedded!, { x: 100, y: 200 });

    // Save and verify
    const targetBytes = await targetDoc.save();
    const reloaded = await PdfDocument.load(targetBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Integration: embed into document with existing content
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('embeds page alongside other content on the same page', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();

    // Add text first
    const page = doc.addPage(PageSizes.A4);
    page.drawText('Header text', { x: 50, y: 800, size: 24 });

    // Then embed
    const [embedded] = await doc.embedPdf(sourceBytes);
    page.drawPage(embedded!, { x: 50, y: 50, width: 400, height: 600 });

    // Then more text
    page.drawText('Footer text', { x: 50, y: 20, size: 12 });

    const savedBytes = await doc.save();
    expect(savedBytes.length).toBeGreaterThan(0);

    // Verify reload
    const reloaded = await PdfDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('draws the same embedded page multiple times', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page = doc.addPage(PageSizes.A4);
    page.drawPage(embedded!, { x: 0, y: 0, width: 200, height: 300 });
    page.drawPage(embedded!, { x: 250, y: 0, width: 200, height: 300 });
    page.drawPage(embedded!, { x: 0, y: 400, width: 200, height: 300 });

    const ops = page.getContentStreamData();
    // Should reference XF1 three times
    const matches = ops.match(/\/XF1 Do/g);
    expect(matches).toHaveLength(3);

    const savedBytes = await doc.save();
    const reloaded = await PdfDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('embeds on multiple pages in the same document', async () => {
    const sourceBytes = await createSourcePdfBytes();
    const doc = createPdf();
    const [embedded] = await doc.embedPdf(sourceBytes);

    const page1 = doc.addPage(PageSizes.A4);
    page1.drawPage(embedded!, { x: 50, y: 50 });

    const page2 = doc.addPage(PageSizes.A4);
    page2.drawPage(embedded!, { x: 100, y: 100 });

    const savedBytes = await doc.save();
    const reloaded = await PdfDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

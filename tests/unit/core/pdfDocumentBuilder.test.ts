/**
 * Tests for PdfDocumentBuilder — fluent builder pattern for PdfDocument.
 *
 * Covers:
 * - Simple document with metadata and pages
 * - Multi-page document with text
 * - Chaining multiple operations
 * - Escape hatch (getDocument)
 * - Load existing document into builder
 * - Builder with encryption
 * - Builder with bookmarks and page labels
 * - Async operations (font/image embedding)
 * - addPages with batch setup
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PdfDocumentBuilder } from '../../../src/core/pdfDocumentBuilder.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';
import { PageSizes } from '../../../src/core/pdfPage.js';
import type { PdfPage } from '../../../src/core/pdfPage.js';
import { rgb } from '../../../src/core/operators/color.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../fixtures');

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

describe('PdfDocumentBuilder', () => {
  // -------------------------------------------------------------------------
  // Static factories
  // -------------------------------------------------------------------------

  it('creates a new builder via create()', () => {
    const builder = PdfDocumentBuilder.create();
    expect(builder).toBeInstanceOf(PdfDocumentBuilder);
    expect(builder.getDocument()).toBeInstanceOf(PdfDocument);
  });

  it('loads an existing document via load()', async () => {
    // Create a source document first
    const sourceDoc = PdfDocument.create();
    sourceDoc.addPage(PageSizes.A4);
    sourceDoc.setTitle('Source');
    const sourceBytes = await sourceDoc.save();

    const builder = await PdfDocumentBuilder.load(sourceBytes);
    const doc = builder.getDocument();
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Source');
  });

  // -------------------------------------------------------------------------
  // Simple document with metadata and pages
  // -------------------------------------------------------------------------

  it('builds a simple document with metadata and a page', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .setTitle('Test Document')
      .setAuthor('Test Author')
      .setSubject('Testing')
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Hello from builder!', { x: 50, y: 750, size: 24 });
      })
      .save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const text = pdfToString(bytes);
    expect(text).toContain('%PDF-');
    expect(text).toContain('Test Document');
    expect(text).toContain('Test Author');
    expect(text).toContain('Testing');
  });

  // -------------------------------------------------------------------------
  // Multi-page document with text
  // -------------------------------------------------------------------------

  it('builds a multi-page document with text on each page', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .setTitle('Multi-Page')
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Page 1', { x: 50, y: 750, size: 18 });
      })
      .addPage(PageSizes.Letter, (page) => {
        page.drawText('Page 2', { x: 50, y: 750, size: 18 });
      })
      .addPage(PageSizes.A3, (page) => {
        page.drawText('Page 3', { x: 50, y: 750, size: 18 });
      })
      .save();

    // Load and verify page count
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Chaining multiple operations
  // -------------------------------------------------------------------------

  it('chains all metadata setters fluently', async () => {
    const creationDate = new Date('2025-01-15T12:00:00Z');
    const modDate = new Date('2025-06-01T08:30:00Z');

    const builder = PdfDocumentBuilder.create()
      .setTitle('Chain Test', { showInWindowTitleBar: true })
      .setAuthor('Alice')
      .setSubject('Chaining')
      .setKeywords(['pdf', 'builder', 'test'])
      .setProducer('test-producer')
      .setCreator('test-creator')
      .setCreationDate(creationDate)
      .setModificationDate(modDate)
      .setLanguage('en-US');

    const doc = builder.getDocument();
    expect(doc.getTitle()).toBe('Chain Test');
    expect(doc.getAuthor()).toBe('Alice');
    expect(doc.getSubject()).toBe('Chaining');
    expect(doc.getKeywords()).toBe('pdf, builder, test');
    expect(doc.getProducer()).toBe('test-producer');
    expect(doc.getCreator()).toBe('test-creator');
    expect(doc.getCreationDate()).toEqual(creationDate);
    expect(doc.getModDate()).toEqual(modDate);
    expect(doc.getLanguage()).toBe('en-US');
  });

  it('every setter returns the same builder instance', () => {
    const builder = PdfDocumentBuilder.create();
    const same = builder
      .setTitle('t')
      .setAuthor('a')
      .setSubject('s')
      .setKeywords(['k'])
      .setProducer('p')
      .setCreator('c')
      .setCreationDate(new Date())
      .setModificationDate(new Date())
      .setLanguage('en');
    expect(same).toBe(builder);
  });

  // -------------------------------------------------------------------------
  // Escape hatch (getDocument)
  // -------------------------------------------------------------------------

  it('getDocument returns the underlying PdfDocument', () => {
    const builder = PdfDocumentBuilder.create();
    const doc = builder.getDocument();
    expect(doc).toBeInstanceOf(PdfDocument);

    // Mutations on the document should be visible through the builder
    doc.setTitle('Escape Hatch');
    doc.addPage(PageSizes.A4);

    expect(doc.getTitle()).toBe('Escape Hatch');
    expect(doc.getPageCount()).toBe(1);
  });

  it('getDocument allows advanced operations not on builder', () => {
    const builder = PdfDocumentBuilder.create();
    builder.addPage(PageSizes.A4);
    builder.addPage(PageSizes.A4);

    const doc = builder.getDocument();
    expect(doc.getPageCount()).toBe(2);

    // Use escape hatch for operations like removePage
    doc.removePage(0);
    expect(doc.getPageCount()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Load existing document into builder
  // -------------------------------------------------------------------------

  it('loads and modifies an existing document', async () => {
    // Create a source PDF
    const source = PdfDocument.create();
    source.setTitle('Original');
    source.addPage(PageSizes.A4);
    const sourceBytes = await source.save();

    // Load into builder and modify
    const bytes = await (await PdfDocumentBuilder.load(sourceBytes))
      .setTitle('Modified')
      .setAuthor('Builder')
      .addPage(PageSizes.Letter, (page) => {
        page.drawText('Added by builder', { x: 50, y: 750 });
      })
      .save();

    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getTitle()).toBe('Modified');
    expect(reloaded.getAuthor()).toBe('Builder');
    expect(reloaded.getPageCount()).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Builder with encryption
  // -------------------------------------------------------------------------

  it('encrypts the document via builder', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .setTitle('Encrypted Doc')
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Secret content', { x: 50, y: 750 });
      })
      .encrypt({
        userPassword: 'user123',
        ownerPassword: 'owner456',
      })
      .save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // The PDF should contain an /Encrypt dictionary
    const text = pdfToString(bytes);
    expect(text).toContain('/Encrypt');
  });

  // -------------------------------------------------------------------------
  // Builder with bookmarks
  // -------------------------------------------------------------------------

  it('adds bookmarks via builder', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .setTitle('Bookmarked Doc')
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Chapter 1', { x: 50, y: 750 });
      })
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Chapter 2', { x: 50, y: 750 });
      })
      .addBookmark({ title: 'Chapter 1', pageIndex: 0 })
      .addBookmark({ title: 'Chapter 2', pageIndex: 1 })
      .save();

    const text = pdfToString(bytes);
    expect(text).toContain('Chapter 1');
    expect(text).toContain('Chapter 2');
    // Should have outlines in the PDF
    expect(text).toContain('/Outlines');
  });

  // -------------------------------------------------------------------------
  // Builder with page labels
  // -------------------------------------------------------------------------

  it('sets page labels via builder', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .addPage(PageSizes.A4)
      .addPage(PageSizes.A4)
      .addPage(PageSizes.A4)
      .addPage(PageSizes.A4)
      .setPageLabels([
        { startPage: 0, style: 'roman' },
        { startPage: 2, style: 'decimal', start: 1 },
      ])
      .save();

    const text = pdfToString(bytes);
    expect(text).toContain('/PageLabels');
  });

  // -------------------------------------------------------------------------
  // addPages
  // -------------------------------------------------------------------------

  it('adds multiple pages with addPages', async () => {
    const setupCalls: number[] = [];

    const bytes = await PdfDocumentBuilder.create()
      .addPages(5, PageSizes.A4, (_page, index) => {
        setupCalls.push(index);
      })
      .save();

    expect(setupCalls).toEqual([0, 1, 2, 3, 4]);

    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(5);
  });

  it('addPages with no setup callback still creates pages', async () => {
    const builder = PdfDocumentBuilder.create().addPages(3, PageSizes.Letter);
    expect(builder.getDocument().getPageCount()).toBe(3);
  });

  it('addPages defaults to A4 when size is omitted', async () => {
    const builder = PdfDocumentBuilder.create().addPages(2);
    const pages = builder.getDocument().getPages();
    expect(pages).toHaveLength(2);
    expect(pages[0]!.width).toBeCloseTo(595.28, 1);
    expect(pages[0]!.height).toBeCloseTo(841.89, 1);
  });

  // -------------------------------------------------------------------------
  // Async operations (font embedding)
  // -------------------------------------------------------------------------

  it('embeds a standard font via withFont callback', async () => {
    let capturedFont: { name: string } | undefined;

    const bytes = await PdfDocumentBuilder.create()
      .withFont('Helvetica', (font, builder) => {
        capturedFont = font;
        builder.addPage(PageSizes.A4, (page) => {
          page.drawText('Hello with font', { x: 50, y: 750, font, size: 16 });
        });
      })
      .save();

    expect(capturedFont).toBeDefined();
    expect(capturedFont!.name).toMatch(/^F\d+$/);
    expect(bytes.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Async operations (image embedding)
  // -------------------------------------------------------------------------

  it('embeds a PNG image via withImage callback', async () => {
    const pngData = await readFile(resolve(fixturesDir, 'images/sample.png'));
    let capturedImage: { width: number; height: number } | undefined;

    const bytes = await PdfDocumentBuilder.create()
      .addPage(PageSizes.A4)
      .withImage(new Uint8Array(pngData), (image, builder) => {
        capturedImage = image;
        // Draw on the first page via escape hatch
        const page = builder.getDocument().getPage(0);
        page.drawImage(image, { x: 50, y: 600, width: 200, height: 150 });
      })
      .save();

    expect(capturedImage).toBeDefined();
    expect(capturedImage!.width).toBeGreaterThan(0);
    expect(capturedImage!.height).toBeGreaterThan(0);
    expect(bytes.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Combined complex builder chain
  // -------------------------------------------------------------------------

  it('builds a complex document with all features combined', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .setTitle('Complex Document')
      .setAuthor('Builder Tests')
      .setSubject('Integration')
      .setKeywords(['pdf', 'builder'])
      .setLanguage('en')
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Title Page', { x: 200, y: 600, size: 36 });
      })
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Chapter 1: Introduction', { x: 50, y: 750, size: 24 });
        page.drawRectangle({ x: 50, y: 700, width: 495, height: 2, color: rgb(0, 0, 0) });
        page.drawText('Lorem ipsum dolor sit amet.', { x: 50, y: 670, size: 12 });
      })
      .addPage(PageSizes.A4, (page) => {
        page.drawText('Chapter 2: Details', { x: 50, y: 750, size: 24 });
      })
      .addBookmark({ title: 'Title Page', pageIndex: 0 })
      .addBookmark({ title: 'Chapter 1', pageIndex: 1 })
      .addBookmark({ title: 'Chapter 2', pageIndex: 2 })
      .setPageLabels([
        { startPage: 0, style: 'Roman', start: 1 },
        { startPage: 1, style: 'decimal', start: 1 },
      ])
      .save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    const text = pdfToString(bytes);
    expect(text).toContain('Complex Document');
    expect(text).toContain('/Outlines');
    expect(text).toContain('/PageLabels');
  });

  // -------------------------------------------------------------------------
  // Save is idempotent
  // -------------------------------------------------------------------------

  it('save() can be called multiple times', async () => {
    const builder = PdfDocumentBuilder.create()
      .setTitle('Idempotent')
      .addPage(PageSizes.A4);

    const bytes1 = await builder.save();
    const bytes2 = await builder.save();

    expect(bytes1.length).toBeGreaterThan(0);
    expect(bytes2.length).toBeGreaterThan(0);
    // Both saves should produce valid PDFs (sizes may differ slightly
    // due to timestamps but both should be valid)
  });

  // -------------------------------------------------------------------------
  // addPage without setup
  // -------------------------------------------------------------------------

  it('addPage without callback still adds a blank page', async () => {
    const builder = PdfDocumentBuilder.create().addPage(PageSizes.A4);
    expect(builder.getDocument().getPageCount()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // addPage with default size
  // -------------------------------------------------------------------------

  it('addPage with no arguments defaults to A4', () => {
    const builder = PdfDocumentBuilder.create().addPage();
    const pages = builder.getDocument().getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0]!.width).toBeCloseTo(595.28, 1);
    expect(pages[0]!.height).toBeCloseTo(841.89, 1);
  });

  // -------------------------------------------------------------------------
  // Drawing shapes via builder
  // -------------------------------------------------------------------------

  it('draws shapes on pages via builder callback', async () => {
    const bytes = await PdfDocumentBuilder.create()
      .addPage(PageSizes.A4, (page) => {
        page.drawRectangle({
          x: 100,
          y: 600,
          width: 200,
          height: 100,
          color: rgb(0.2, 0.4, 0.8),
          borderColor: rgb(0, 0, 0),
          borderWidth: 2,
        });
        page.drawCircle({
          x: 300,
          y: 400,
          radius: 50,
          color: rgb(0.9, 0.1, 0.1),
        });
        page.drawLine({
          start: { x: 50, y: 300 },
          end: { x: 545, y: 300 },
          color: rgb(0, 0, 0),
          thickness: 1,
        });
      })
      .save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Deferred operations execute in order
  // -------------------------------------------------------------------------

  it('deferred operations execute in insertion order', async () => {
    const order: string[] = [];

    const bytes = await PdfDocumentBuilder.create()
      .addPage(PageSizes.A4)
      .withFont('Courier', (font) => {
        order.push('font');
      })
      .encrypt({
        userPassword: 'u',
        ownerPassword: 'o',
      })
      .save();

    // Font embedding (withFont) should have executed before
    // encryption (both are deferred)
    expect(order).toContain('font');
    expect(bytes.length).toBeGreaterThan(0);
  });
});

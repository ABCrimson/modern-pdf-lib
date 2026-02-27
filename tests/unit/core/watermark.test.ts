/**
 * Tests for watermark generation.
 *
 * Covers:
 * - addWatermarkToPage: operator generation with defaults and custom options
 * - addWatermark: applying to all pages in a document
 * - Opacity handling (ExtGState)
 * - Position variants (center, top, bottom)
 * - Rotation
 * - Text escaping
 */

import { describe, it, expect } from 'vitest';
import { addWatermarkToPage, addWatermark } from '../../../src/core/watermark.js';
import type { WatermarkOptions } from '../../../src/core/watermark.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// addWatermarkToPage
// ---------------------------------------------------------------------------

describe('addWatermarkToPage', () => {
  it('should add watermark operators to a page', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'DRAFT' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('q\n');
    expect(content).toContain('Q\n');
    expect(content).toContain('BT\n');
    expect(content).toContain('ET\n');
    expect(content).toContain('(DRAFT) Tj\n');
  });

  it('should use Helvetica font', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'TEST' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('/Helvetica');
    expect(content).toContain('Tf\n');
  });

  it('should apply custom font size', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'BIG', fontSize: 100 }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('/Helvetica 100 Tf\n');
  });

  it('should apply custom colour', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'RED', color: { r: 1, g: 0, b: 0 } }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('1 0 0 rg\n');
  });

  it('should apply default light gray colour', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'GRAY' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('0.7 0.7 0.7 rg\n');
  });

  it('should set opacity via ExtGState', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'FADED', opacity: 0.5 }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('/WM_GS gs\n');
  });

  it('should skip ExtGState when opacity is 1', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'SOLID', opacity: 1 }, registry);

    const content = page.getContentStreamData();
    expect(content).not.toContain('gs\n');
  });

  it('should apply rotation via text matrix (Tm)', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'ROTATED', rotation: 30 }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('Tm\n');
  });

  it('should handle zero rotation', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'FLAT', rotation: 0 }, registry);

    const content = page.getContentStreamData();
    // cos(0) = 1, sin(0) = 0 — the matrix should have 1 and 0 components
    expect(content).toContain('Tm\n');
  });

  it('should escape parentheses in text', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'Test (v1)' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('Test \\(v1\\)');
  });

  it('should escape backslashes in text', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'A\\B' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('A\\\\B');
  });

  it('should handle top position', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'TOP', position: 'top' }, registry);

    const content = page.getContentStreamData();
    // Top position uses cy = h - h/4 = 842 - 210.5 = 631.5
    expect(content).toContain('Tm\n');
    expect(content.length).toBeGreaterThan(0);
  });

  it('should handle bottom position', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    addWatermarkToPage(page, { text: 'BOTTOM', position: 'bottom' }, registry);

    const content = page.getContentStreamData();
    expect(content).toContain('Tm\n');
    expect(content.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// addWatermark (document-level)
// ---------------------------------------------------------------------------

describe('addWatermark', () => {
  it('should apply watermark to all pages', () => {
    const doc = createPdf();
    doc.addPage();
    doc.addPage();

    addWatermark(doc, { text: 'CONFIDENTIAL' });

    const pages = doc.getPages();
    for (const page of pages) {
      const content = page.getContentStreamData();
      expect(content).toContain('(CONFIDENTIAL) Tj\n');
    }
  });

  it('should work with a single page', () => {
    const doc = createPdf();
    doc.addPage();

    addWatermark(doc, { text: 'SAMPLE', fontSize: 80, opacity: 0.2 });

    const pages = doc.getPages();
    const content = pages[0]!.getContentStreamData();
    expect(content).toContain('(SAMPLE) Tj\n');
    expect(content).toContain('/Helvetica 80 Tf\n');
  });
});

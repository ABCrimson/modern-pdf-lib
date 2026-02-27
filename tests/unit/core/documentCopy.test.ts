/**
 * Tests for PdfDocument.copy() — deep cloning via save/load round-trip.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PdfDocument,
  PageSizes,
  rgb,
} from '../../../src/index.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfDocument.copy', () => {
  it('returns a new PdfDocument instance', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);

    const clone = await doc.copy();

    expect(clone).toBeInstanceOf(PdfDocument);
    expect(clone).not.toBe(doc);
  });

  it('preserves the page count', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addPage(PageSizes.Letter);
    doc.addPage(PageSizes.Legal);

    const clone = await doc.copy();

    expect(clone.getPageCount()).toBe(3);
  });

  it('preserves page dimensions', async () => {
    const doc = createPdf();
    doc.addPage([300, 400]);

    const clone = await doc.copy();
    const pages = clone.getPages();

    expect(pages).toHaveLength(1);
    expect(pages[0]!.width).toBeCloseTo(300, 0);
    expect(pages[0]!.height).toBeCloseTo(400, 0);
  });

  it('produces an independent document (mutations do not leak)', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);

    const clone = await doc.copy();
    clone.addPage(PageSizes.Letter);

    // Original should still have only 1 page
    expect(doc.getPageCount()).toBe(1);
    // Clone should have 2 pages
    expect(clone.getPageCount()).toBe(2);
  });

  it('preserves metadata', async () => {
    const doc = createPdf();
    doc.setTitle('Test Title');
    doc.setAuthor('Test Author');
    doc.addPage(PageSizes.A4);

    const clone = await doc.copy();

    expect(clone.getTitle()).toBe('Test Title');
    expect(clone.getAuthor()).toBe('Test Author');
  });

  it('cloned document can be saved independently', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    page.drawText('Original text', { x: 50, y: 750, size: 12 });

    const clone = await doc.copy();
    const cloneBytes = await clone.save();

    expect(cloneBytes).toBeInstanceOf(Uint8Array);
    expect(cloneBytes.length).toBeGreaterThan(0);

    // Verify the bytes form a valid PDF
    const header = new TextDecoder().decode(cloneBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('works with an empty document (no pages)', async () => {
    const doc = createPdf();
    const clone = await doc.copy();

    expect(clone).toBeInstanceOf(PdfDocument);
    expect(clone.getPageCount()).toBe(0);
  });
});

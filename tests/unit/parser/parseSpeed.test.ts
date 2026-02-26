import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('parseSpeed / objectsPerTick', () => {
  it('accepts objectsPerTick option without error', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes, { objectsPerTick: 10 });
    expect(loaded.getPageCount()).toBe(1);
  });

  it('works with Infinity (no throttling)', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes, { objectsPerTick: Infinity });
    expect(loaded.getPageCount()).toBe(1);
  });

  it('defaults to no throttling when not specified', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('produces identical results with throttling enabled', async () => {
    const doc = PdfDocument.create();
    const page = doc.addPage([400, 600]);
    page.drawText('Hello World', { x: 50, y: 550 });
    page.drawRectangle({ x: 100, y: 100, width: 200, height: 150 });
    doc.setTitle('Test Doc');
    const bytes = await doc.save();

    const fast = await PdfDocument.load(bytes);
    const slow = await PdfDocument.load(bytes, { objectsPerTick: 1 });

    expect(slow.getPageCount()).toBe(fast.getPageCount());
    expect(slow.getTitle()).toBe(fast.getTitle());
  });
});

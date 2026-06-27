import { describe, it, expect } from 'vitest';
import { generateThumbnail } from '../../../src/render/thumbnail.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

async function loadPage(w: number, h: number) {
  const doc = PdfDocument.create();
  const page = doc.addPage([w, h]);
  page.drawRectangle({ x: 10, y: 10, width: w - 20, height: h - 20 });
  const bytes = await doc.save();
  return (await PdfDocument.load(bytes)).getPage(0);
}

describe('generateThumbnail', () => {
  it('fits the longest side to maxSize, preserving aspect ratio', async () => {
    const page = await loadPage(800, 400); // 2:1 landscape
    const thumb = await generateThumbnail(page, { maxSize: 200 });
    expect(thumb.width).toBe(200);
    expect(thumb.height).toBe(100);
    expect(Array.from(thumb.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG magic
  });

  it('fits a portrait page by its height', async () => {
    const page = await loadPage(300, 600); // 1:2 portrait
    const thumb = await generateThumbnail(page, { maxSize: 120 });
    expect(thumb.height).toBe(120);
    expect(thumb.width).toBe(60);
  });

  it('defaults to a 256px longest side', async () => {
    const page = await loadPage(1000, 1000);
    const thumb = await generateThumbnail(page);
    expect(Math.max(thumb.width, thumb.height)).toBe(256);
  });
});

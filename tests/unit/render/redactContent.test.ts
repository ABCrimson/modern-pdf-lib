import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { extractText } from '../../../src/parser/textExtractor.js';
import { redactRegions } from '../../../src/render/redactContent.js';
import { StandardFonts } from '../../../src/core/pdfDocument.js';
import { rgb } from '../../../src/core/operators/color.js';

/**
 * Round-trip a document and extract the visible text of its first page.
 */
async function extractFirstPageText(bytes: Uint8Array): Promise<string> {
  const doc = await loadPdf(bytes);
  const page = doc.getPage(0);
  const ops = parseContentStream(page.getContentStream());
  return extractText(ops, page.getOriginalResources());
}

describe('redactRegions — true content removal (0.29.8)', () => {
  it('removes a text-show op whose origin falls inside a redaction rect', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 800]);
    page.drawText('KEEP', { x: 10, y: 700, font, size: 24 });
    page.drawText('SECRET', { x: 10, y: 100, font, size: 24 });

    const result = redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }]);

    expect(result.removedText).toBe(1);
    expect(result.removedImages).toBe(0);

    const bytes = await doc.save();
    const text = await extractFirstPageText(bytes);

    expect(text).toContain('KEEP');
    expect(text).not.toContain('SECRET');
  });

  it('removes every text run inside the rect and keeps everything outside', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 800]);
    page.drawText('TOP', { x: 20, y: 750, font, size: 18 });
    page.drawText('MIDDLE-A', { x: 20, y: 400, font, size: 18 });
    page.drawText('MIDDLE-B', { x: 20, y: 380, font, size: 18 });
    page.drawText('BOTTOM', { x: 20, y: 50, font, size: 18 });

    // Cover the two MIDDLE lines only.
    const result = redactRegions(page, [{ x: 0, y: 370, width: 300, height: 50 }]);
    expect(result.removedText).toBe(2);

    const bytes = await doc.save();
    const text = await extractFirstPageText(bytes);
    expect(text).toContain('TOP');
    expect(text).toContain('BOTTOM');
    expect(text).not.toContain('MIDDLE-A');
    expect(text).not.toContain('MIDDLE-B');
  });

  it('returns zero counts and preserves text when no rect intersects', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 800]);
    page.drawText('ALPHA', { x: 10, y: 700, font, size: 24 });

    const result = redactRegions(page, [{ x: 0, y: 0, width: 5, height: 5 }]);
    expect(result.removedText).toBe(0);
    expect(result.removedImages).toBe(0);

    const text = await extractFirstPageText(await doc.save());
    expect(text).toContain('ALPHA');
  });

  it('preserves non-text graphics operators (rectangles) outside the rect', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 800]);
    page.drawRectangle({ x: 10, y: 600, width: 100, height: 50, color: rgb(1, 0, 0) });
    page.drawText('VISIBLE', { x: 10, y: 700, font, size: 24 });
    page.drawText('HIDDEN', { x: 10, y: 100, font, size: 24 });

    redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }]);

    const bytes = await doc.save();
    const doc2 = await loadPdf(bytes);
    const page2 = doc2.getPage(0);
    const ops = parseContentStream(page2.getContentStream());

    // The rectangle-fill operators must survive.
    const hasRect = ops.some((o) => o.operator === 're');
    const hasFill = ops.some((o) => o.operator === 'f' || o.operator === 'F');
    expect(hasRect).toBe(true);
    expect(hasFill).toBe(true);

    const text = extractText(ops, page2.getOriginalResources());
    expect(text).toContain('VISIBLE');
    expect(text).not.toContain('HIDDEN');
  });

  it('removes an image XObject Do whose placement origin is inside the rect', async () => {
    const doc = createPdf();
    const page = doc.addPage([300, 800]);

    // 1x1 red PNG (smallest valid). embedImage auto-detects PNG.
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const img = await doc.embedImage(pngBytes);
    page.drawImage(img, { x: 10, y: 100, width: 40, height: 40 });

    const result = redactRegions(page, [{ x: 0, y: 90, width: 200, height: 60 }]);
    expect(result.removedImages).toBe(1);

    const bytes = await doc.save();
    const doc2 = await loadPdf(bytes);
    const ops = parseContentStream(doc2.getPage(0).getContentStream());
    const hasDo = ops.some((o) => o.operator === 'Do');
    expect(hasDo).toBe(false);
  });
});

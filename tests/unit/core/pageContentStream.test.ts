import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { extractText } from '../../../src/parser/textExtractor.js';

/**
 * Public text-extraction bridge: `PdfPage.getContentStream()` must return the
 * DECODED content-stream bytes (Uint8Array) of a page — including a LOADED page,
 * whose content lives in compressed original content-stream refs — so the
 * documented extraction pipeline composes end-to-end through the public API:
 *
 *   const ops  = parseContentStream(page.getContentStream());
 *   const text = extractText(ops);
 *
 * Before this method, the only way to reach a loaded page's bytes was the
 * `@internal` `getContentStreamData()` (which returns a *string* of the build
 * buffer, not the decoded loaded bytes), so the README/docs extraction example
 * was not actually achievable with the public API.
 */
describe('PdfPage.getContentStream() — public text-extraction bridge', () => {
  it('returns decoded bytes of a LOADED page, usable by parseContentStream + extractText', async () => {
    const doc = PdfDocument.create();
    const page = doc.addPage([400, 600]);
    page.drawText('Hello World', { x: 50, y: 550 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const lpage = loaded.getPage(0);

    const content = lpage.getContentStream();
    expect(content).toBeInstanceOf(Uint8Array);
    expect(content.length).toBeGreaterThan(0);

    const ops = parseContentStream(content);
    const text = extractText(ops);
    expect(text).toContain('Hello World');
  });

  it('returns bytes for a freshly created (unsaved) page too', () => {
    const doc = PdfDocument.create();
    const page = doc.addPage([200, 200]);
    page.drawText('Inline', { x: 10, y: 100 });

    const content = page.getContentStream();
    expect(content).toBeInstanceOf(Uint8Array);
    const text = extractText(parseContentStream(content));
    expect(text).toContain('Inline');
  });
});

import { describe, it, expect } from 'vitest';
import { createPdf, StandardFonts } from '../../../src/core/pdfDocument.js';
import { RedactionIncompleteError } from '../../../src/errors.js';
import { redactRegions } from '../../../src/render/redactContent.js';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('redactRegions: unavailable in this release', () => {
  it('throws RedactionIncompleteError with reason redaction-unavailable', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 800]);
    page.drawText('SECRET', { x: 10, y: 100, font, size: 24 });

    let caught: unknown;
    try {
      redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RedactionIncompleteError);
    const error = caught as RedactionIncompleteError;
    expect(error.code).toBe('redaction-incomplete');
    expect(error.reason).toBe('redaction-unavailable');
    expect(error.pageIndex).toBeUndefined();
    expect(error.message).toMatch(/not available in this release/);
    expect(error.message).toMatch(/Nothing was changed/);
  });

  it('throws for an empty rect list', () => {
    const doc = createPdf();
    const page = doc.addPage([300, 800]);
    expect(() => redactRegions(page, [])).toThrow(RedactionIncompleteError);
  });

  it('leaves the page content and the saved text unchanged', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 800]);
    page.drawText('KEEP', { x: 10, y: 700, font, size: 24 });
    page.drawText('SECRET', { x: 10, y: 100, font, size: 24 });
    const before = page.getContentStreamData();

    expect(() => redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }])).toThrow(
      RedactionIncompleteError,
    );

    expect(page.getContentStreamData()).toBe(before);
    expect(page.getContentStreamData()).toContain('Tj');
  });

  it('leaves an image placement in place', async () => {
    const doc = createPdf();
    const page = doc.addPage([300, 800]);
    const png = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));
    const img = await doc.embedImage(png);
    page.drawImage(img, { x: 10, y: 100, width: 40, height: 40 });
    const before = page.getContentStreamData();

    expect(() => redactRegions(page, [{ x: 0, y: 90, width: 200, height: 60 }])).toThrow(
      RedactionIncompleteError,
    );

    expect(page.getContentStreamData()).toBe(before);
    expect(page.getContentStreamData()).toContain(' Do');
  });
});

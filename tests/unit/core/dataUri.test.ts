import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';
import { base64Encode } from '../../../src/utils/base64.js';

describe('Data URI input', () => {
  it('loads a PDF from a data:application/pdf;base64, URI', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const b64 = base64Encode(bytes);
    const dataUri = `data:application/pdf;base64,${b64}`;

    const loaded = await PdfDocument.load(dataUri);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('handles data URI with different mime types', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const b64 = base64Encode(bytes);
    const dataUri = `data:application/octet-stream;base64,${b64}`;

    const loaded = await PdfDocument.load(dataUri);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('still loads plain base64 strings', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const b64 = base64Encode(bytes);

    const loaded = await PdfDocument.load(b64);
    expect(loaded.getPageCount()).toBe(1);
  });
});

describe('embedPages', () => {
  it('embeds multiple pages in batch', async () => {
    const source = PdfDocument.create();
    const p1 = source.addPage([200, 300]);
    const p2 = source.addPage([400, 500]);

    const target = PdfDocument.create();
    target.addPage();
    const embedded = await target.embedPages([p1, p2]);

    expect(embedded).toHaveLength(2);
    expect(embedded[0].width).toBe(200);
    expect(embedded[1].width).toBe(400);
  });

  it('returns empty array for empty input', async () => {
    const doc = PdfDocument.create();
    const embedded = await doc.embedPages([]);
    expect(embedded).toHaveLength(0);
  });
});

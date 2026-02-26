import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';
import type { EmbedFontOptions } from '../../../src/core/pdfDocument.js';

describe('EmbedFontOptions', () => {
  it('embedFont accepts options parameter with features', async () => {
    const doc = PdfDocument.create();
    // Standard font — features are ignored but the API accepts them
    const font = await doc.embedFont('Helvetica', { features: { kern: true } });
    expect(font).toBeDefined();
    expect(font.name).toBeTruthy();
  });

  it('embedFont accepts subset option', async () => {
    const doc = PdfDocument.create();
    const font = await doc.embedFont('Helvetica', { subset: false });
    expect(font).toBeDefined();
  });

  it('embedFont accepts empty options', async () => {
    const doc = PdfDocument.create();
    const font = await doc.embedFont('Helvetica', {});
    expect(font).toBeDefined();
  });

  it('embedFont works without options (backward compatible)', async () => {
    const doc = PdfDocument.create();
    const font = await doc.embedFont('Helvetica');
    expect(font).toBeDefined();
  });

  it('EmbedFontOptions type exists and is importable', () => {
    const opts: EmbedFontOptions = {
      subset: true,
      features: { kern: true, liga: true },
    };
    expect(opts.subset).toBe(true);
    expect(opts.features?.kern).toBe(true);
  });
});

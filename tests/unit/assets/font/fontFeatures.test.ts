import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../../src/core/pdfDocument.js';
import type { EmbedFontOptions } from '../../../../src/core/pdfDocument.js';
import { UnsupportedOptionError } from '../../../../src/errors.js';

describe('EmbedFontOptions', () => {
  it('embedFont refuses the features option, removed in 0.41.0', async () => {
    const doc = PdfDocument.create();
    const options = { features: { kern: true } } as EmbedFontOptions;
    await expect(doc.embedFont('Helvetica', options)).rejects.toThrow(UnsupportedOptionError);
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
    const opts: EmbedFontOptions = { subset: false, customName: 'Custom' };
    expect(opts.subset).toBe(false);
    // @ts-expect-error -- `features` was removed from EmbedFontOptions in 0.41.0
    const removed: EmbedFontOptions = { features: { kern: true } };
    expect(removed).toBeDefined();
  });
});

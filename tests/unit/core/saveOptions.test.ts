import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('addDefaultPage on save', () => {
  it('adds a default page when document has 0 pages (default behavior)', async () => {
    const doc = PdfDocument.create();
    expect(doc.getPageCount()).toBe(0);
    const bytes = await doc.save();
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('does not add a default page when addDefaultPage is false', async () => {
    const doc = PdfDocument.create();
    expect(doc.getPageCount()).toBe(0);
    const bytes = await doc.save({ addDefaultPage: false });
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(0);
  });

  it('does not add extra pages when document already has pages', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save({ addDefaultPage: true });
    const reloaded = await PdfDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

describe('updateFieldAppearances on save', () => {
  it('is accepted as a save option without error', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save({ updateFieldAppearances: true });
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('can be disabled', async () => {
    const doc = PdfDocument.create();
    doc.addPage();
    const bytes = await doc.save({ updateFieldAppearances: false });
    expect(bytes.length).toBeGreaterThan(0);
  });
});

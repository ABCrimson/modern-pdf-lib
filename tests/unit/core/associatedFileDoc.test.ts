import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

describe('PdfDocument.addAssociatedFile — PDF 2.0 catalog /AF (§7.11.4)', () => {
  it('attaches a typed associated file to the catalog /AF + /Names/EmbeddedFiles', async () => {
    const doc = PdfDocument.create();
    doc.addPage([100, 100]);
    doc.addAssociatedFile(
      'factur-x.xml',
      new TextEncoder().encode('<invoice/>'),
      'text/xml',
      'Alternative',
      { description: 'Factur-X invoice data' },
    );
    const bytes = await doc.save();
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/AF'); // catalog /AF array (associated, not just embedded)
    expect(text).toContain('/AFRelationship');
    expect(text).toContain('/Alternative'); // typed relationship, not the default Unspecified
    expect(text).toContain('/EmbeddedFiles');
    expect(text).toContain('factur-x.xml');
    expect(text).toContain('<invoice/>');

    const loaded = await PdfDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('supports multiple associated files with different relationships', async () => {
    const doc = PdfDocument.create();
    doc.addPage([100, 100]);
    doc.addAssociatedFile('a.xml', new Uint8Array([1]), 'text/xml', 'Data');
    doc.addAssociatedFile('b.bin', new Uint8Array([2]), 'application/octet-stream', 'Source');
    const text = new TextDecoder('latin1').decode(await doc.save());
    expect(text).toContain('/Data');
    expect(text).toContain('/Source');
    expect(text).toContain('a.xml');
    expect(text).toContain('b.bin');
  });

  it('a plain attachFile does not add a typed relationship to the catalog /AF', async () => {
    const doc = PdfDocument.create();
    doc.addPage([100, 100]);
    doc.attachFile('note.txt', new TextEncoder().encode('hi'), 'text/plain');
    const text = new TextDecoder('latin1').decode(await doc.save());
    expect(text).toContain('/EmbeddedFiles'); // still embedded
    expect(text).toContain('/Unspecified'); // plain attachment keeps the default relationship
  });
});

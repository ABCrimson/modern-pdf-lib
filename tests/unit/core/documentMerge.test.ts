/**
 * Tests for document merge/split/copy operations.
 *
 * Covers: mergePdfs, splitPdf, copyPages, copyPagesToTarget,
 * deep cloning, resource deduplication.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PdfDocument,
  PageSizes,
} from '../../../src/index.js';
import {
  mergePdfs,
  splitPdf,
  copyPages,
} from '../../../src/core/documentMerge.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function createDocWithContent(pageCount: number, prefix = 'Doc'): PdfDocument {
  const doc = createPdf();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage(PageSizes.A4);
    page.drawText(`${prefix} Page ${i + 1}`, { x: 50, y: 750, size: 24 });
  }
  return doc;
}

// ---------------------------------------------------------------------------
// mergePdfs
// ---------------------------------------------------------------------------

describe('mergePdfs', () => {
  it('merges an empty array into an empty document', async () => {
    const result = await mergePdfs([]);
    expect(result.getPageCount()).toBe(0);
  });

  it('merges a single document (creates a copy)', async () => {
    const doc = createDocWithContent(3, 'Single');
    const merged = await mergePdfs([doc]);

    expect(merged.getPageCount()).toBe(3);
    // The merged doc should be independent of the source
    expect(merged).not.toBe(doc);
  });

  it('merges two documents', async () => {
    const doc1 = createDocWithContent(2, 'First');
    const doc2 = createDocWithContent(3, 'Second');

    const merged = await mergePdfs([doc1, doc2]);

    expect(merged.getPageCount()).toBe(5);
  });

  it('merges three documents', async () => {
    const doc1 = createDocWithContent(1);
    const doc2 = createDocWithContent(2);
    const doc3 = createDocWithContent(3);

    const merged = await mergePdfs([doc1, doc2, doc3]);

    expect(merged.getPageCount()).toBe(6);
  });

  it('preserves page dimensions from source documents', async () => {
    const doc1 = createPdf();
    doc1.addPage(PageSizes.A4);

    const doc2 = createPdf();
    doc2.addPage(PageSizes.Letter);

    const merged = await mergePdfs([doc1, doc2]);

    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).width).toBeCloseTo(595.28, 1);
    expect(merged.getPage(0).height).toBeCloseTo(841.89, 1);
    expect(merged.getPage(1).width).toBe(612);
    expect(merged.getPage(1).height).toBe(792);
  });

  it('preserves metadata from first document', async () => {
    const doc1 = createDocWithContent(1);
    doc1.setTitle('First Document');
    doc1.setAuthor('Test Author');

    const doc2 = createDocWithContent(1);
    doc2.setTitle('Second Document');

    const merged = await mergePdfs([doc1, doc2]);

    expect(merged.getTitle()).toBe('First Document');
    expect(merged.getAuthor()).toBe('Test Author');
  });

  it('skips empty documents', async () => {
    const doc1 = createPdf(); // empty
    const doc2 = createDocWithContent(2);
    const doc3 = createPdf(); // empty

    const merged = await mergePdfs([doc1, doc2, doc3]);

    expect(merged.getPageCount()).toBe(2);
  });

  it('produces a valid PDF that can be saved', async () => {
    const doc1 = createDocWithContent(2, 'A');
    const doc2 = createDocWithContent(2, 'B');

    const merged = await mergePdfs([doc1, doc2]);
    const bytes = await merged.save({ compress: false });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const text = pdfToString(bytes);
    expect(text).toContain('%PDF-1.7');
    expect(text.trimEnd()).toMatch(/%%EOF$/);
  });

  it('content from all source documents is present in output', async () => {
    const doc1 = createDocWithContent(1, 'Alpha');
    const doc2 = createDocWithContent(1, 'Beta');

    const merged = await mergePdfs([doc1, doc2]);
    const bytes = await merged.save({ compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('Alpha Page 1');
    expect(text).toContain('Beta Page 1');
  });
});

// ---------------------------------------------------------------------------
// splitPdf
// ---------------------------------------------------------------------------

describe('splitPdf', () => {
  it('splits a document into two parts', async () => {
    const doc = createDocWithContent(4);
    const [part1, part2] = await splitPdf(doc, [[0, 1], [2, 3]]);

    expect(part1!.getPageCount()).toBe(2);
    expect(part2!.getPageCount()).toBe(2);
  });

  it('splits into single pages', async () => {
    const doc = createDocWithContent(3);
    const parts = await splitPdf(doc, [[0, 0], [1, 1], [2, 2]]);

    expect(parts).toHaveLength(3);
    expect(parts[0]!.getPageCount()).toBe(1);
    expect(parts[1]!.getPageCount()).toBe(1);
    expect(parts[2]!.getPageCount()).toBe(1);
  });

  it('allows overlapping ranges', async () => {
    const doc = createDocWithContent(3);
    const parts = await splitPdf(doc, [[0, 2], [1, 2]]);

    expect(parts[0]!.getPageCount()).toBe(3);
    expect(parts[1]!.getPageCount()).toBe(2);
  });

  it('throws on invalid start index', async () => {
    const doc = createDocWithContent(3);
    await expect(splitPdf(doc, [[-1, 1]])).rejects.toThrow(RangeError);
    await expect(splitPdf(doc, [[3, 3]])).rejects.toThrow(RangeError);
  });

  it('throws on invalid end index', async () => {
    const doc = createDocWithContent(3);
    await expect(splitPdf(doc, [[0, 3]])).rejects.toThrow(RangeError);
    await expect(splitPdf(doc, [[2, 1]])).rejects.toThrow(RangeError);
  });

  it('produces valid PDFs that can be saved', async () => {
    const doc = createDocWithContent(4, 'Split');
    const parts = await splitPdf(doc, [[0, 1], [2, 3]]);

    for (const part of parts) {
      const bytes = await part.save();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
    }
  });

  it('preserves content in split parts', async () => {
    const doc = createDocWithContent(2, 'Section');
    const [part1, part2] = await splitPdf(doc, [[0, 0], [1, 1]]);

    const bytes1 = await part1!.save({ compress: false });
    const bytes2 = await part2!.save({ compress: false });

    expect(pdfToString(bytes1)).toContain('Section Page 1');
    expect(pdfToString(bytes2)).toContain('Section Page 2');
  });

  it('preserves metadata in split documents', async () => {
    const doc = createDocWithContent(2);
    doc.setTitle('Original Title');
    doc.setAuthor('Original Author');

    const [part1] = await splitPdf(doc, [[0, 0]]);
    expect(part1!.getTitle()).toBe('Original Title');
    expect(part1!.getAuthor()).toBe('Original Author');
  });
});

// ---------------------------------------------------------------------------
// copyPages (standalone)
// ---------------------------------------------------------------------------

describe('copyPages', () => {
  it('copies specified pages from source to target', () => {
    const source = createDocWithContent(3, 'Source');
    const target = createPdf();

    const newPages = copyPages(source, target, [0, 2]);

    expect(newPages).toHaveLength(2);
    expect(target.getPageCount()).toBe(2);
  });

  it('copies pages with correct dimensions', () => {
    const source = createPdf();
    source.addPage(PageSizes.A4);
    source.addPage(PageSizes.Letter);

    const target = createPdf();
    copyPages(source, target, [0, 1]);

    expect(target.getPageCount()).toBe(2);
    expect(target.getPage(0).width).toBeCloseTo(595.28, 1);
    expect(target.getPage(1).width).toBe(612);
  });

  it('copies content operators', () => {
    const source = createDocWithContent(1, 'Copied');
    const target = createPdf();

    copyPages(source, target, [0]);

    // Verify the content was copied by saving the target
    // The content operator should be present
    const targetPage = target.getPage(0);
    const ops = targetPage.getContentStreamData();
    expect(ops).toContain('Copied Page 1');
  });

  it('throws on invalid page index', () => {
    const source = createDocWithContent(2);
    const target = createPdf();

    expect(() => copyPages(source, target, [0, 5])).toThrow(RangeError);
    expect(() => copyPages(source, target, [-1])).toThrow(RangeError);
  });

  it('copies pages with rotation', () => {
    const source = createPdf();
    const page = source.addPage(PageSizes.A4);
    page.setRotation(90);

    const target = createPdf();
    copyPages(source, target, [0]);

    expect(target.getPage(0).getRotation()).toBe(90);
  });

  it('produces valid PDF when target is saved', async () => {
    const source = createDocWithContent(2, 'Test');
    const target = createPdf();
    copyPages(source, target, [0, 1]);

    const bytes = await target.save({ compress: false });
    expect(bytes).toBeInstanceOf(Uint8Array);
    const text = pdfToString(bytes);
    expect(text).toContain('%PDF-1.7');
    expect(text.trimEnd()).toMatch(/%%EOF$/);
  });
});

// ---------------------------------------------------------------------------
// PdfDocument.copyPages (method)
// ---------------------------------------------------------------------------

describe('PdfDocument.copyPages', () => {
  it('copies pages from source to this document', async () => {
    const source = createDocWithContent(3);
    const target = createPdf();
    target.addPage(); // 1 existing page

    const newPages = await target.copyPages(source, [0, 2]);

    expect(newPages).toHaveLength(2);
    expect(target.getPageCount()).toBe(3); // 1 original + 2 copied
  });
});

// ---------------------------------------------------------------------------
// Resource deduplication
// ---------------------------------------------------------------------------

describe('resource deduplication', () => {
  it('copies pages with embedded fonts and produces valid output', async () => {
    const source = createPdf();
    const font = await source.embedFont('Helvetica');
    const page = source.addPage();
    page.drawText('Hello with Helvetica', { x: 50, y: 700, font, size: 12 });

    const target = createPdf();
    copyPages(source, target, [0]);

    const bytes = await target.save({ compress: false });
    const text = pdfToString(bytes);

    // The target should contain font references
    expect(text).toContain('/Font');
    expect(text).toContain('%PDF-1.7');
  });

  it('does not crash when merging documents with same standard fonts', async () => {
    const doc1 = createPdf();
    const f1 = await doc1.embedFont('Helvetica');
    const p1 = doc1.addPage();
    p1.drawText('Doc 1', { x: 50, y: 700, font: f1, size: 12 });

    const doc2 = createPdf();
    const f2 = await doc2.embedFont('Helvetica');
    const p2 = doc2.addPage();
    p2.drawText('Doc 2', { x: 50, y: 700, font: f2, size: 12 });

    const merged = await mergePdfs([doc1, doc2]);
    const bytes = await merged.save();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(merged.getPageCount()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles an empty source document gracefully', async () => {
    const source = createPdf();
    const target = createPdf();
    target.addPage();

    const newPages = copyPages(source, target, []);
    expect(newPages).toHaveLength(0);
    expect(target.getPageCount()).toBe(1);
  });

  it('merge with a single empty doc returns empty doc', async () => {
    const doc = createPdf();
    const merged = await mergePdfs([doc]);
    expect(merged.getPageCount()).toBe(0);
  });

  it('split with a single full-range returns a copy', async () => {
    const doc = createDocWithContent(3);
    const [copy] = await splitPdf(doc, [[0, 2]]);
    expect(copy!.getPageCount()).toBe(3);
  });
});

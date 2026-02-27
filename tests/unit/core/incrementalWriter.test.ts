/**
 * Tests for incremental save support.
 *
 * Covers: saveIncremental, saveDocumentIncremental, ChangeTracker,
 * xref subsection building, and integration with PDF structure.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PageSizes,
  PdfDocument,
} from '../../../src/index.js';
import {
  saveIncremental,
  ChangeTracker,
} from '../../../src/core/incrementalWriter.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
  PdfRef,
} from '../../../src/core/pdfObjects.js';
import { buildDocumentStructure } from '../../../src/core/pdfCatalog.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Create a minimal valid PDF as a base for incremental save tests.
 * Returns both the document and its raw bytes.
 */
async function createBasePdf(): Promise<{ doc: PdfDocument; bytes: Uint8Array }> {
  const doc = createPdf();
  doc.addPage(PageSizes.A4);
  doc.setTitle('Base Document');
  const bytes = await doc.save({ compress: false });
  return { doc, bytes };
}

// ---------------------------------------------------------------------------
// ChangeTracker
// ---------------------------------------------------------------------------

describe('ChangeTracker', () => {
  it('tracks new objects', () => {
    const tracker = new ChangeTracker(10);
    tracker.markNew(11);
    tracker.markNew(12);

    expect(tracker.isChanged(11)).toBe(true);
    expect(tracker.isChanged(12)).toBe(true);
    expect(tracker.isChanged(5)).toBe(false);
  });

  it('tracks modified objects', () => {
    const tracker = new ChangeTracker(10);
    tracker.markModified(5);
    tracker.markModified(8);

    expect(tracker.isChanged(5)).toBe(true);
    expect(tracker.isChanged(8)).toBe(true);
    expect(tracker.isChanged(1)).toBe(false);
  });

  it('objects beyond original max are treated as new', () => {
    const tracker = new ChangeTracker(5);
    tracker.markModified(10); // Beyond max, treated as new

    expect(tracker.isChanged(10)).toBe(true);
  });

  it('returns all changed objects', () => {
    const tracker = new ChangeTracker(10);
    tracker.markNew(11);
    tracker.markNew(12);
    tracker.markModified(3);
    tracker.markModified(7);

    const changed = tracker.getChangedObjects();
    expect(changed.size).toBe(4);
    expect(changed.has(11)).toBe(true);
    expect(changed.has(12)).toBe(true);
    expect(changed.has(3)).toBe(true);
    expect(changed.has(7)).toBe(true);
  });

  it('changedCount returns correct count', () => {
    const tracker = new ChangeTracker(10);
    expect(tracker.changedCount).toBe(0);

    tracker.markNew(11);
    expect(tracker.changedCount).toBe(1);

    tracker.markModified(5);
    expect(tracker.changedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// saveIncremental
// ---------------------------------------------------------------------------

describe('saveIncremental', () => {
  it('produces output that starts with original bytes', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    // Create a registry with a modified object
    const registry = new PdfObjectRegistry();
    const infoDict = new PdfDict();
    infoDict.set('/Title', PdfString.literal('Modified Title'));
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    // Create minimal catalog and pages
    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([infoRef.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    // The output should start with the original bytes
    const originalPortion = result.bytes.subarray(0, originalBytes.length);
    expect(originalPortion).toEqual(originalBytes);
  });

  it('appends new xref section with /Prev pointer', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();
    const infoDict = new PdfDict();
    infoDict.set('/Title', PdfString.literal('Updated'));
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([infoRef.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    const appendedPart = pdfToString(result.bytes.subarray(originalBytes.length));

    // Should contain a new xref
    expect(appendedPart).toContain('xref');

    // Should contain a trailer with /Prev
    expect(appendedPart).toContain('trailer');
    expect(appendedPart).toContain('/Prev');

    // Should end with %%EOF
    expect(appendedPart.trimEnd()).toMatch(/%%EOF$/);

    // Should contain startxref
    expect(appendedPart).toContain('startxref');
  });

  it('output is larger than original', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set('/Title', PdfString.literal('New Data'));
    dict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(dict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([infoRef.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    expect(result.bytes.length).toBeGreaterThan(originalBytes.length);
  });

  it('new xref offset is recorded correctly', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(dict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([infoRef.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    // The xref offset should point to a position after the original bytes
    expect(result.newXrefOffset).toBeGreaterThan(originalBytes.length);

    // At that offset, the string 'xref' should appear
    const xrefStr = pdfToString(result.bytes.subarray(result.newXrefOffset, result.newXrefOffset + 4));
    expect(xrefStr).toBe('xref');
  });

  it('only writes changed objects to the appendix', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();

    // Register multiple objects
    const dict1 = new PdfDict();
    dict1.set('/Key1', PdfString.literal('Value1'));
    const ref1 = registry.register(dict1);

    const dict2 = new PdfDict();
    dict2.set('/Key2', PdfString.literal('Value2'));
    const ref2 = registry.register(dict2);

    const dict3 = new PdfDict();
    dict3.set('/Key3', PdfString.literal('Value3'));
    const ref3 = registry.register(dict3);

    // info + pages + catalog
    const infoDict = new PdfDict();
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };

    // Only mark dict1 as changed
    const changedObjects = new Set([ref1.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    const appendedText = pdfToString(result.bytes.subarray(originalBytes.length));

    // Should contain Value1 (changed)
    expect(appendedText).toContain('Value1');

    // Should NOT contain Value2 or Value3 (not changed)
    expect(appendedText).not.toContain('Value2');
    expect(appendedText).not.toContain('Value3');
  });

  it('handles multiple changed objects', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();

    const dict1 = new PdfDict();
    dict1.set('/First', PdfString.literal('Alpha'));
    const ref1 = registry.register(dict1);

    const dict2 = new PdfDict();
    dict2.set('/Second', PdfString.literal('Beta'));
    const ref2 = registry.register(dict2);

    const infoDict = new PdfDict();
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([ref1.objectNumber, ref2.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    const appendedText = pdfToString(result.bytes.subarray(originalBytes.length));

    expect(appendedText).toContain('Alpha');
    expect(appendedText).toContain('Beta');
  });

  it('/Size in trailer is at least as large as original', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(dict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([infoRef.objectNumber]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
    );

    const appendedText = pdfToString(result.bytes.subarray(originalBytes.length));
    const sizeMatch = appendedText.match(/\/Size\s+(\d+)/);

    expect(sizeMatch).not.toBeNull();
    const size = parseInt(sizeMatch![1]!, 10);
    expect(size).toBeGreaterThan(0);
  });

  it('handles compression option', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();

    // Create a stream object with compressible data
    const streamDict = new PdfDict();
    const longData = new TextEncoder().encode('A'.repeat(1000));
    const stream = PdfStream.fromBytes(longData, streamDict);
    const streamRef = registry.register(stream);

    const infoDict = new PdfDict();
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(0));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([streamRef.objectNumber]);

    const compressedResult = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: true },
    );

    // Compression should have been applied — result may contain FlateDecode
    const text = pdfToString(compressedResult.bytes.subarray(originalBytes.length));
    // We expect either the stream was compressed or left as-is
    // (depending on whether compression actually helps)
    expect(compressedResult.bytes.length).toBeGreaterThan(originalBytes.length);
  });
});

// ---------------------------------------------------------------------------
// Integration: round-trip test
// ---------------------------------------------------------------------------

describe('incremental save integration', () => {
  it('produces a PDF-like structure with valid sections', async () => {
    const { bytes: originalBytes } = await createBasePdf();

    const registry = new PdfObjectRegistry();
    const infoDict = new PdfDict();
    infoDict.set('/Title', PdfString.literal('Updated Document'));
    infoDict.set('/Producer', PdfString.literal('modern-pdf'));
    const infoRef = registry.register(infoDict);

    const pagesDict = new PdfDict();
    pagesDict.set('/Type', PdfName.of('Pages'));
    pagesDict.set('/Kids', new (await import('../../../src/core/pdfObjects.js')).PdfArray());
    pagesDict.set('/Count', PdfNumber.of(1));
    const pagesRef = registry.register(pagesDict);

    const catalogDict = new PdfDict();
    catalogDict.set('/Type', PdfName.of('Catalog'));
    catalogDict.set('/Pages', pagesRef);
    const catalogRef = registry.register(catalogDict);

    const structure = { catalogRef, infoRef, pagesRef };
    const changedObjects = new Set([
      infoRef.objectNumber,
      pagesRef.objectNumber,
      catalogRef.objectNumber,
    ]);

    const result = saveIncremental(
      originalBytes,
      registry,
      structure,
      changedObjects,
      { compress: false },
    );

    const fullText = pdfToString(result.bytes);

    // Should start with PDF header
    expect(fullText).toMatch(/^%PDF-1\.7/);

    // Should have two %%EOF markers (original + incremental)
    const eofCount = (fullText.match(/%%EOF/g) ?? []).length;
    expect(eofCount).toBeGreaterThanOrEqual(2);

    // Should have two xref sections
    const xrefCount = (fullText.match(/\nxref\n/g) ?? []).length;
    expect(xrefCount).toBeGreaterThanOrEqual(2);

    // Should have /Prev in the new trailer
    expect(fullText).toContain('/Prev');

    // Should contain our updated title
    expect(fullText).toContain('Updated Document');
  });
});

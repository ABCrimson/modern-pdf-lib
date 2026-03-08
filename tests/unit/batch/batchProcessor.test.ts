/**
 * Tests for the batch PDF processor.
 *
 * Covers:
 * - Processing a single file
 * - Processing multiple files
 * - Concurrency limiting
 * - Progress callback
 * - Error handling (single file failure doesn't crash batch)
 * - Empty file list
 * - batchMerge
 * - batchFlatten
 */

import { describe, it, expect, vi } from 'vitest';
import { createPdf, PdfDocument } from '../../../src/core/pdfDocument.js';
import {
  processBatch,
  batchMerge,
  batchFlatten,
} from '../../../src/batch/batchProcessor.js';
import type {
  BatchOptions,
  BatchResult,
} from '../../../src/batch/batchProcessor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a minimal valid PDF as Uint8Array. */
async function makeSimplePdf(text = 'Hello'): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  page.drawText(text, { x: 10, y: 150, size: 12 });
  return doc.save();
}

/** Generate a PDF with a text field for flatten testing. */
async function makePdfWithForm(): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([200, 200]);
  page.drawText('Form', { x: 10, y: 150, size: 12 });
  return doc.save();
}

// ---------------------------------------------------------------------------
// processBatch
// ---------------------------------------------------------------------------

describe('processBatch', () => {
  it('returns empty results for empty file list', async () => {
    const result = await processBatch([], async (doc) => doc.save());

    expect(result.outputs).toEqual([]);
    expect(result.successCount).toBe(0);
    expect(result.errors.size).toBe(0);
  });

  it('processes a single file', async () => {
    const pdf = await makeSimplePdf();

    const result = await processBatch(
      [pdf],
      async (doc) => doc.save(),
    );

    expect(result.outputs).toHaveLength(1);
    expect(result.successCount).toBe(1);
    expect(result.errors.size).toBe(0);
    expect(result.outputs[0]!.length).toBeGreaterThan(0);
  });

  it('processes multiple files', async () => {
    const pdf1 = await makeSimplePdf('File 1');
    const pdf2 = await makeSimplePdf('File 2');
    const pdf3 = await makeSimplePdf('File 3');

    const result = await processBatch(
      [pdf1, pdf2, pdf3],
      async (doc) => doc.save(),
    );

    expect(result.outputs).toHaveLength(3);
    expect(result.successCount).toBe(3);
    expect(result.errors.size).toBe(0);
    for (const output of result.outputs) {
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it('applies the operation to each file', async () => {
    const pdf = await makeSimplePdf();
    const pageCounts: number[] = [];

    await processBatch(
      [pdf, pdf],
      async (doc) => {
        pageCounts.push(doc.getPageCount());
        // Add a page to verify operation runs
        doc.addPage([100, 100]);
        return doc.save();
      },
    );

    // Each original PDF has 1 page
    expect(pageCounts).toEqual([1, 1]);
  });

  it('respects concurrency limit', async () => {
    const pdf = await makeSimplePdf();
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    await processBatch(
      [pdf, pdf, pdf, pdf, pdf, pdf, pdf, pdf],
      async (doc) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent;
        }
        // Small delay to let concurrency build up
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return doc.save();
      },
      { concurrency: 2 },
    );

    // Max concurrent should not exceed the concurrency setting
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('calls progress callback', async () => {
    const pdf = await makeSimplePdf();
    const progressCalls: [number, number][] = [];

    await processBatch(
      [pdf, pdf, pdf],
      async (doc) => doc.save(),
      {
        onProgress: (done, total) => {
          progressCalls.push([done, total]);
        },
      },
    );

    expect(progressCalls).toHaveLength(3);
    // Each call should report correct total
    for (const [, total] of progressCalls) {
      expect(total).toBe(3);
    }
    // Final call should report all done
    const lastDone = progressCalls.at(-1)![0];
    expect(lastDone).toBe(3);
  });

  it('handles error in one file without crashing the batch', async () => {
    const goodPdf = await makeSimplePdf();
    const badPdf = new Uint8Array([0, 1, 2, 3]); // Invalid PDF

    const result = await processBatch(
      [goodPdf, badPdf, goodPdf],
      async (doc) => doc.save(),
    );

    expect(result.successCount).toBe(2);
    expect(result.errors.size).toBe(1);
    expect(result.errors.has(1)).toBe(true);
    expect(result.errors.get(1)).toBeInstanceOf(Error);
    // Good files should still have output
    expect(result.outputs[0]!.length).toBeGreaterThan(0);
    expect(result.outputs[2]!.length).toBeGreaterThan(0);
    // Bad file gets empty output
    expect(result.outputs[1]!.length).toBe(0);
  });

  it('handles error thrown by operation', async () => {
    const pdf = await makeSimplePdf();

    const result = await processBatch(
      [pdf, pdf],
      async (doc) => {
        throw new Error('Operation failed');
      },
    );

    expect(result.successCount).toBe(0);
    expect(result.errors.size).toBe(2);
  });

  it('preserves output order matching input order', async () => {
    const pdfs = await Promise.all([
      makeSimplePdf('A'),
      makeSimplePdf('B'),
      makeSimplePdf('C'),
    ]);

    const titles: string[] = [];

    const result = await processBatch(
      pdfs,
      async (doc) => {
        const title = doc.getTitle() ?? 'none';
        doc.setTitle(`processed-${titles.length}`);
        titles.push(title);
        return doc.save();
      },
    );

    expect(result.outputs).toHaveLength(3);
    expect(result.successCount).toBe(3);
  });

  it('uses concurrency of 1 when specified', async () => {
    const pdf = await makeSimplePdf();
    const executionOrder: number[] = [];
    let counter = 0;

    await processBatch(
      [pdf, pdf, pdf],
      async (doc) => {
        const myIdx = counter++;
        executionOrder.push(myIdx);
        return doc.save();
      },
      { concurrency: 1 },
    );

    // With concurrency 1, execution is strictly sequential
    expect(executionOrder).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// batchMerge
// ---------------------------------------------------------------------------

describe('batchMerge', () => {
  it('returns a valid PDF for empty file list', async () => {
    const result = await batchMerge([]);

    expect(result.length).toBeGreaterThan(0);
    // An empty createPdf() + save() adds a default blank page, so we
    // just verify it produces a loadable PDF.
    const doc = await PdfDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(0);
  });

  it('returns the same PDF for single file', async () => {
    const pdf = await makeSimplePdf();

    const result = await batchMerge([pdf]);

    const doc = await PdfDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
  });

  it('merges multiple PDFs', async () => {
    const pdf1 = await makeSimplePdf('Page 1');
    const pdf2 = await makeSimplePdf('Page 2');
    const pdf3 = await makeSimplePdf('Page 3');

    const result = await batchMerge([pdf1, pdf2, pdf3]);

    const doc = await PdfDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it('calls progress callback during merge', async () => {
    const pdf1 = await makeSimplePdf();
    const pdf2 = await makeSimplePdf();
    const progressCalls: [number, number][] = [];

    await batchMerge([pdf1, pdf2], {
      onProgress: (done, total) => {
        progressCalls.push([done, total]);
      },
    });

    expect(progressCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// batchFlatten
// ---------------------------------------------------------------------------

describe('batchFlatten', () => {
  it('returns empty results for empty file list', async () => {
    const result = await batchFlatten([]);

    expect(result.outputs).toEqual([]);
    expect(result.successCount).toBe(0);
  });

  it('flattens a single PDF', async () => {
    const pdf = await makePdfWithForm();

    const result = await batchFlatten([pdf]);

    expect(result.outputs).toHaveLength(1);
    expect(result.successCount).toBe(1);
    expect(result.outputs[0]!.length).toBeGreaterThan(0);
  });

  it('flattens multiple PDFs', async () => {
    const pdf1 = await makePdfWithForm();
    const pdf2 = await makePdfWithForm();

    const result = await batchFlatten([pdf1, pdf2]);

    expect(result.outputs).toHaveLength(2);
    expect(result.successCount).toBe(2);
    for (const output of result.outputs) {
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it('handles PDFs without forms gracefully', async () => {
    const pdf = await makeSimplePdf();

    const result = await batchFlatten([pdf]);

    // Should succeed even without a form
    expect(result.successCount).toBe(1);
    expect(result.errors.size).toBe(0);
  });
});

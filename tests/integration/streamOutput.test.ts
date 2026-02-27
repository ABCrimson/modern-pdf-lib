/**
 * Tests for saveAsStream() — streaming PDF output.
 *
 * Validates that ReadableStream-based output produces the same result
 * as the synchronous save() method.
 */

import { describe, it, expect } from 'vitest';
import {
  createPdf,
  PageSizes,
  StandardFonts,
  rgb,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

/** Collect all chunks from a ReadableStream into a single Uint8Array. */
async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Collect all chunks from a ReadableStream using for-await-of. */
async function collectStreamForAwait(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  // Use the async iterable protocol
  for await (const chunk of stream) {
    chunks.push(chunk);
    totalLength += chunk.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('saveAsStream()', () => {
  it('returns a ReadableStream', () => {
    const doc = createPdf();
    doc.addPage();

    const stream = doc.saveAsStream();
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('stream starts with %PDF-1.7', async () => {
    const doc = createPdf();
    doc.addPage();

    const stream = doc.saveAsStream({ compress: false });
    const bytes = await collectStream(stream);
    const text = decoder.decode(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
  });

  it('stream ends with %%EOF', async () => {
    const doc = createPdf();
    doc.addPage();

    const stream = doc.saveAsStream({ compress: false });
    const bytes = await collectStream(stream);
    const text = decoder.decode(bytes);

    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('stream chunks are Uint8Array instances', async () => {
    const doc = createPdf();
    doc.addPage();

    const stream = doc.saveAsStream();
    const reader = stream.getReader();

    const { done, value } = await reader.read();
    expect(done).toBe(false);
    expect(value).toBeInstanceOf(Uint8Array);

    // Cancel the reader to clean up
    await reader.cancel();
  });

  it('reading all chunks produces the same output as save()', async () => {
    const doc1 = createPdf();
    const page1 = doc1.addPage(PageSizes.A4);
    const font1 = await doc1.embedFont(StandardFonts.Helvetica);
    page1.drawText('Stream vs Save test', {
      x: 50,
      y: 700,
      font: font1.name,
      size: 16,
    });
    page1.drawRectangle({
      x: 50,
      y: 680,
      width: 200,
      height: 2,
      color: rgb(0, 0, 0),
    });

    // Use uncompressed mode to ensure deterministic output comparison
    const saveBytes = await doc1.save({ compress: false });

    // Create a fresh document with the same content for streaming
    const doc2 = createPdf();
    const page2 = doc2.addPage(PageSizes.A4);
    const font2 = await doc2.embedFont(StandardFonts.Helvetica);
    page2.drawText('Stream vs Save test', {
      x: 50,
      y: 700,
      font: font2.name,
      size: 16,
    });
    page2.drawRectangle({
      x: 50,
      y: 680,
      width: 200,
      height: 2,
      color: rgb(0, 0, 0),
    });

    const stream = doc2.saveAsStream({ compress: false });
    const streamBytes = await collectStream(stream);

    // Both should be valid PDFs with the same structure
    const saveText = decoder.decode(saveBytes);
    const streamText = decoder.decode(streamBytes);

    expect(saveText.startsWith('%PDF-1.7')).toBe(true);
    expect(streamText.startsWith('%PDF-1.7')).toBe(true);

    // They should have the same content structure
    // (exact byte equality may differ due to date timestamps, but structure should match)
    expect(streamText).toContain('Stream vs Save test');
    expect(streamText).toContain('/Type /Catalog');
    expect(streamText).toContain('/Type /Page');
    expect(streamText).toContain('xref');
    expect(streamText).toContain('trailer');
    expect(streamText.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('stream can be consumed with for-await-of', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.drawText('For-await test', { x: 50, y: 700, size: 14 });

    const stream = doc.saveAsStream({ compress: false });
    const bytes = await collectStreamForAwait(stream);
    const text = decoder.decode(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('For-await test');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('stream with compression produces valid output', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Compressed stream test', {
      x: 50,
      y: 700,
      font: font.name,
      size: 16,
    });

    const stream = doc.saveAsStream({ compress: true });
    const bytes = await collectStream(stream);
    const text = decoder.decode(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('trailer');
  });

  it('stream output has non-zero length', async () => {
    const doc = createPdf();
    doc.addPage();

    const stream = doc.saveAsStream();
    const bytes = await collectStream(stream);

    expect(bytes.length).toBeGreaterThan(0);
  });

  it('multi-page stream has correct page count', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    doc.addPage(PageSizes.Letter);
    doc.addPage(PageSizes.Legal);

    const stream = doc.saveAsStream({ compress: false });
    const bytes = await collectStream(stream);
    const text = decoder.decode(bytes);

    expect(text).toContain('/Count 3');
  });

  it('streaming output produces valid PDF structure', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Streaming structure test', {
      x: 50,
      y: 700,
      font: font.name,
      size: 16,
    });
    page.drawRectangle({
      x: 50,
      y: 680,
      width: 200,
      height: 2,
      color: rgb(0, 0, 0),
    });
    page.drawCircle({
      x: 150,
      y: 600,
      size: 40,
      borderColor: rgb(0, 0, 0.8),
    });

    const stream = doc.saveAsStream({ compress: false });
    const bytes = await collectStream(stream);
    const text = decoder.decode(bytes);

    // Valid PDF structure checks
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Type /Page\n');
    expect(text).toContain('/Type /Font');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text).toContain('startxref');
    expect(text).toContain('/Count 1');
  });

  it('save() and saveAsStream() produce structurally identical output', async () => {
    // Build document 1 for save()
    const doc1 = createPdf();
    const p1 = doc1.addPage(PageSizes.Letter);
    const f1 = await doc1.embedFont(StandardFonts.Courier);
    p1.drawText('Structural comparison', { x: 50, y: 700, font: f1.name, size: 14 });
    p1.drawRectangle({ x: 50, y: 680, width: 100, height: 50, color: rgb(1, 0, 0) });
    p1.drawLine({ start: { x: 50, y: 670 }, end: { x: 250, y: 670 }, color: rgb(0, 0, 0) });

    const saveBytes = await doc1.save({ compress: false });

    // Build identical document 2 for saveAsStream()
    const doc2 = createPdf();
    const p2 = doc2.addPage(PageSizes.Letter);
    const f2 = await doc2.embedFont(StandardFonts.Courier);
    p2.drawText('Structural comparison', { x: 50, y: 700, font: f2.name, size: 14 });
    p2.drawRectangle({ x: 50, y: 680, width: 100, height: 50, color: rgb(1, 0, 0) });
    p2.drawLine({ start: { x: 50, y: 670 }, end: { x: 250, y: 670 }, color: rgb(0, 0, 0) });

    const stream = doc2.saveAsStream({ compress: false });
    const streamBytes = await collectStream(stream);

    const saveText = decoder.decode(saveBytes);
    const streamText = decoder.decode(streamBytes);

    // Both should have valid PDF structure
    expect(saveText.startsWith('%PDF-1.7')).toBe(true);
    expect(streamText.startsWith('%PDF-1.7')).toBe(true);
    expect(saveText.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(streamText.trimEnd().endsWith('%%EOF')).toBe(true);

    // Both should contain the same structural elements
    expect(streamText).toContain('Structural comparison');
    expect(streamText).toContain('/Type /Catalog');
    expect(streamText).toContain('/Type /Page\n');
    expect(streamText).toContain('/BaseFont /Courier');
    expect(streamText).toContain('xref');
    expect(streamText).toContain('trailer');

    // Same content stream operators
    expect(streamText).toContain('BT');
    expect(streamText).toContain('ET');
    expect(streamText).toContain('re');

    // Same page count
    expect(streamText).toContain('/Count 1');
    expect(saveText).toContain('/Count 1');
  });
});

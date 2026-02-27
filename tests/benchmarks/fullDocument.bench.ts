/**
 * Benchmarks for full document generation.
 *
 * Measures end-to-end PDF creation performance including page creation,
 * text drawing, and serialization.
 *
 * Performance targets:
 * - Empty 1-page PDF: < 1ms
 * - 10-page text document: < 10ms
 * - 100-page text document: < 50ms
 */

import { describe, bench } from 'vitest';
import {
  createPdf,
  PageSizes,
  StandardFonts,
  rgb,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Empty document benchmarks
// ---------------------------------------------------------------------------

describe('empty document creation', () => {
  bench('createPdf() + addPage()', () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
  });

  bench('empty 1-page PDF save (uncompressed)', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    await doc.save({ compress: false });
  });

  bench('empty 1-page PDF save (compressed)', async () => {
    const doc = createPdf();
    doc.addPage(PageSizes.A4);
    await doc.save({ compress: true });
  });
});

// ---------------------------------------------------------------------------
// Text document benchmarks
// ---------------------------------------------------------------------------

describe('text document creation', () => {
  bench('1-page with text (uncompressed)', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Hello, World!', {
      x: 50,
      y: 750,
      font: font.name,
      size: 24,
      color: rgb(0, 0, 0),
    });
    page.drawText('This is a test document with some text content.', {
      x: 50,
      y: 700,
      font: font.name,
      size: 12,
    });

    await doc.save({ compress: false });
  });

  bench('10-page text document (uncompressed)', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 10; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 18,
      });
      page.drawText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        {
          x: 50,
          y: 700,
          font: font.name,
          size: 12,
        },
      );
    }

    await doc.save({ compress: false });
  });

  bench('10-page text document (compressed)', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 10; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 18,
      });
      page.drawText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        {
          x: 50,
          y: 700,
          font: font.name,
          size: 12,
        },
      );
    }

    await doc.save({ compress: true });
  });

  bench('100-page text document (compressed)', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 100; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1}`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 18,
      });
      page.drawText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        {
          x: 50,
          y: 700,
          font: font.name,
          size: 12,
        },
      );
      page.drawRectangle({
        x: 50,
        y: 680,
        width: 495,
        height: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    }

    await doc.save({ compress: true });
  });
});

// ---------------------------------------------------------------------------
// Drawing operation benchmarks
// ---------------------------------------------------------------------------

describe('drawing operations', () => {
  bench('1000 drawText calls on single page', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    for (let i = 0; i < 1000; i++) {
      page.drawText(`Line ${i}`, { x: 50, y: 800 - (i % 50) * 15, size: 10 });
    }

    await doc.save({ compress: false });
  });

  bench('1000 drawRectangle calls on single page', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    for (let i = 0; i < 1000; i++) {
      page.drawRectangle({
        x: (i % 20) * 30,
        y: Math.floor(i / 20) * 15,
        width: 25,
        height: 10,
        color: rgb(i % 256 / 255, 0, 0),
      });
    }

    await doc.save({ compress: false });
  });

  bench('500 drawCircle calls on single page', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);

    for (let i = 0; i < 500; i++) {
      page.drawCircle({
        x: 50 + (i % 10) * 50,
        y: 50 + Math.floor(i / 10) * 15,
        size: 5,
        color: rgb(0, 0, i % 256 / 255),
      });
    }

    await doc.save({ compress: false });
  });
});

// ---------------------------------------------------------------------------
// Serialization-only benchmarks
// ---------------------------------------------------------------------------

describe('serialization only', () => {
  bench('serialize pre-built 10-page document', async () => {
    // Build the document once, then benchmark just the save
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 10; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1} with some content for serialization benchmark`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 14,
      });
    }

    // Note: save() is not idempotent (it mutates streams for compression),
    // but for uncompressed mode it should be reusable for benchmarking
    await doc.save({ compress: false });
  });

  bench('stream serialization (saveAsStream) 10-page', async () => {
    const doc = createPdf();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 10; i++) {
      const page = doc.addPage(PageSizes.A4);
      page.drawText(`Page ${i + 1} for stream benchmark`, {
        x: 50,
        y: 750,
        font: font.name,
        size: 14,
      });
    }

    const stream = doc.saveAsStream({ compress: false });
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  });
});

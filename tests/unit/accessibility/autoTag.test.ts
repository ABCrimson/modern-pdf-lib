/**
 * Tests for heuristic auto-tagging of untagged pages
 * ({@link module:accessibility/autoTag}).
 *
 * These tests build a real, untagged PDF page with a large "Title" run
 * and smaller "body" runs, round-trip it through save/load, then run the
 * auto-tagger and assert that a structure tree is produced with at least
 * one heading and one paragraph.
 */

import { describe, it, expect } from 'vitest';

import { autoTagPage } from '../../../src/accessibility/autoTag.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// autoTagPage — basic classification
// ---------------------------------------------------------------------------

describe('autoTagPage', () => {
  it('infers a heading and a paragraph from font sizes', async () => {
    const doc = createPdf();
    const page = doc.addPage([400, 400]);
    // Big title run.
    page.drawText('Title', { x: 50, y: 350, size: 28 });
    // Smaller body runs at the most common (body) size.
    page.drawText('body text body text', { x: 50, y: 300, size: 11 });
    page.drawText('more body text here', { x: 50, y: 280, size: 11 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const result = autoTagPage(loaded, 0);

    expect(result.headings).toBeGreaterThanOrEqual(1);
    expect(result.paragraphs).toBeGreaterThanOrEqual(1);
    expect(result.elements).toBeGreaterThanOrEqual(2);

    // A structure tree must now exist on the document.
    const tree = loaded.getStructureTree();
    expect(tree).toBeDefined();

    // The tree must actually contain a heading element and a paragraph.
    const all = tree!.getAllElements();
    const headingTypes = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    expect(all.some((e) => headingTypes.has(e.type))).toBe(true);
    expect(all.some((e) => e.type === 'P')).toBe(true);

    // The largest run ("Title") should map to the top heading level (H1).
    expect(all.some((e) => e.type === 'H1')).toBe(true);
  });

  it('returns all zeros and never throws for an empty page', async () => {
    const doc = createPdf();
    doc.addPage([200, 200]);
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const result = autoTagPage(loaded, 0);

    expect(result.headings).toBe(0);
    expect(result.paragraphs).toBe(0);
    expect(result.elements).toBe(0);
  });

  it('treats everything as body text when there is no larger run', async () => {
    const doc = createPdf();
    const page = doc.addPage([400, 400]);
    page.drawText('line one of body copy', { x: 40, y: 300, size: 12 });
    page.drawText('line two of body copy', { x: 40, y: 280, size: 12 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const result = autoTagPage(loaded, 0);

    expect(result.headings).toBe(0);
    expect(result.paragraphs).toBeGreaterThanOrEqual(1);
  });

  it('honors a custom headingScale threshold', async () => {
    const doc = createPdf();
    const page = doc.addPage([400, 400]);
    // 14pt vs 11pt body = ratio ~1.27.
    page.drawText('Subhead', { x: 50, y: 350, size: 14 });
    page.drawText('body body body body', { x: 50, y: 300, size: 11 });
    page.drawText('body body body more', { x: 50, y: 280, size: 11 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);

    // With a high scale (1.5x), 14pt is NOT a heading -> 0 headings.
    const strict = autoTagPage(loaded, 0, { headingScale: 1.5 });
    expect(strict.headings).toBe(0);

    // With a low scale (1.2x), 14pt IS a heading -> >=1 heading.
    const lenient = autoTagPage(loaded, 0, { headingScale: 1.2 });
    expect(lenient.headings).toBeGreaterThanOrEqual(1);
  });

  it('maps multiple distinct heading sizes to descending levels', async () => {
    const doc = createPdf();
    const page = doc.addPage([500, 500]);
    page.drawText('Biggest Title', { x: 40, y: 440, size: 32 });
    page.drawText('Medium Heading', { x: 40, y: 400, size: 20 });
    page.drawText('body copy line one here', { x: 40, y: 360, size: 11 });
    page.drawText('body copy line two here', { x: 40, y: 340, size: 11 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const result = autoTagPage(loaded, 0);

    expect(result.headings).toBeGreaterThanOrEqual(2);

    const all = loaded.getStructureTree()!.getAllElements();
    // Largest -> H1, next -> H2.
    expect(all.some((e) => e.type === 'H1')).toBe(true);
    expect(all.some((e) => e.type === 'H2')).toBe(true);
  });
});

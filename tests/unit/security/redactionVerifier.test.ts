/**
 * Tests for the redaction verifier (MODULE 0.35).
 *
 * The verifier detects FAILED / fake redactions: text that is still present
 * (and therefore extractable) underneath a redaction region.  A real, secure
 * redaction physically removes the underlying text-showing operators; a fake
 * one merely paints an opaque box over text that is still in the byte stream.
 *
 * Coordinate convention under test (confirmed against
 * `extractTextWithPositions` and `src/render/redactContent.ts`):
 *   - PDF user space, **origin bottom-left, y-up**, units in PDF points.
 *   - A glyph run's box is `[x, y, x + width, y + height]` where `(x, y)` is
 *     the text origin (baseline-left), `width` extends +x and `height`
 *     (= font size) extends +y.
 *   - A `RedactionRegion` is `(x, y)` lower-left corner + `width`/`height`
 *     extending +x / +y — the SAME convention as `RedactRect`.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { redactRegions } from '../../../src/render/redactContent.js';
import {
  verifyRedactions,
  type RedactionRegion,
} from '../../../src/security/redactionVerifier.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Build a one-page PDF with a single line of text drawn at a known origin,
 * and return the saved bytes.  `drawText` emits `BT /F1 <size> Tf <x> <y> Td
 * (<text>) Tj ET`, so the recovered text origin is exactly `(x, y)`.
 */
async function pdfWithTextAt(
  text: string,
  x: number,
  y: number,
  size = 12,
): Promise<Uint8Array> {
  const doc = createPdf();
  const page = doc.addPage([400, 600]);
  page.drawText(text, { x, y, size });
  return doc.save();
}

// ===========================================================================
// Leak detection — fake redaction (text still present under the region)
// ===========================================================================

describe('verifyRedactions() — leak detection', () => {
  it('reports a leak when a region covers still-present text', async () => {
    // "SECRET" at origin (50, 550), size 12 → box ≈ [50, 550, 50+w, 562].
    const bytes = await pdfWithTextAt('SECRET', 50, 550);

    // A region squarely over the text origin.
    const regions: RedactionRegion[] = [
      { page: 0, x: 45, y: 545, width: 120, height: 25 },
    ];

    const report = await verifyRedactions(bytes, regions);

    expect(report.clean).toBe(false);
    expect(report.regionsChecked).toBe(1);
    expect(report.leaks.length).toBeGreaterThanOrEqual(1);
    const leak = report.leaks[0]!;
    expect(leak.page).toBe(0);
    expect(leak.text).toContain('SECRET');
    // Leak coordinates are the offending glyph run's origin (bottom-left, y-up).
    expect(leak.x).toBeCloseTo(50);
    expect(leak.y).toBeCloseTo(550);
  });

  it('reports clean when the region is over empty space', async () => {
    const bytes = await pdfWithTextAt('SECRET', 50, 550);

    // A region far from the text (lower-left corner of the page).
    const regions: RedactionRegion[] = [
      { page: 0, x: 10, y: 10, width: 100, height: 30 },
    ];

    const report = await verifyRedactions(bytes, regions);

    expect(report.clean).toBe(true);
    expect(report.leaks).toEqual([]);
    expect(report.regionsChecked).toBe(1);
  });

  it('reports clean after a real (content-removing) redaction', async () => {
    // Build the doc, then PHYSICALLY remove the text in the region before save.
    const doc = createPdf();
    const page = doc.addPage([400, 600]);
    page.drawText('SECRET', { x: 50, y: 550, size: 12 });

    const region = { x: 45, y: 545, width: 120, height: 25 };
    const result = redactRegions(page, [region]);
    expect(result.removedText).toBeGreaterThanOrEqual(1);

    const bytes = await doc.save();

    // Verifying the SAME region must now be clean — the text is gone.
    const report = await verifyRedactions(bytes, [{ page: 0, ...region }]);
    expect(report.clean).toBe(true);
    expect(report.leaks).toEqual([]);
  });
});

// ===========================================================================
// Region geometry — intersection vs. miss
// ===========================================================================

describe('verifyRedactions() — region geometry', () => {
  it('detects a leak when the region only partially overlaps the glyph box', async () => {
    const bytes = await pdfWithTextAt('CONFIDENTIAL', 100, 300, 14);

    // Region whose right edge clips into the left of the text box.
    const regions: RedactionRegion[] = [
      { page: 0, x: 60, y: 295, width: 50, height: 24 },
    ];
    const report = await verifyRedactions(bytes, regions);
    expect(report.clean).toBe(false);
    expect(report.leaks[0]!.text).toContain('CONFIDENTIAL');
  });

  it('does not report a leak when the region is directly below the text', async () => {
    const bytes = await pdfWithTextAt('VISIBLE', 100, 300, 12);

    // Region below the baseline, not reaching y=300.
    const regions: RedactionRegion[] = [
      { page: 0, x: 100, y: 200, width: 200, height: 50 },
    ];
    const report = await verifyRedactions(bytes, regions);
    expect(report.clean).toBe(true);
  });

  it('counts every region that is checked', async () => {
    const bytes = await pdfWithTextAt('SECRET', 50, 550);
    const regions: RedactionRegion[] = [
      { page: 0, x: 45, y: 545, width: 120, height: 25 }, // hits
      { page: 0, x: 10, y: 10, width: 20, height: 20 }, // misses
      { page: 0, x: 0, y: 0, width: 5, height: 5 }, // misses
    ];
    const report = await verifyRedactions(bytes, regions);
    expect(report.regionsChecked).toBe(3);
    expect(report.clean).toBe(false);
    expect(report.leaks).toHaveLength(1);
  });

  it('only matches text on the named page', async () => {
    const doc = createPdf();
    const p0 = doc.addPage([400, 600]);
    p0.drawText('PAGE0', { x: 50, y: 550, size: 12 });
    const p1 = doc.addPage([400, 600]);
    p1.drawText('PAGE1', { x: 50, y: 550, size: 12 });
    const bytes = await doc.save();

    // Region on page 1 only; identical coords exist on page 0 but must be ignored.
    const report = await verifyRedactions(bytes, [
      { page: 1, x: 45, y: 545, width: 120, height: 25 },
    ]);
    expect(report.clean).toBe(false);
    expect(report.leaks).toHaveLength(1);
    expect(report.leaks[0]!.page).toBe(1);
    expect(report.leaks[0]!.text).toContain('PAGE1');
  });
});

// ===========================================================================
// Input validation — regions are required (no fabricated auto-detection)
// ===========================================================================

describe('verifyRedactions() — required regions', () => {
  it('throws when regions are omitted (auto-detection is not performed)', async () => {
    const bytes = await pdfWithTextAt('SECRET', 50, 550);
    await expect(verifyRedactions(bytes)).rejects.toThrow(/region/i);
  });

  it('throws when regions is an empty array', async () => {
    const bytes = await pdfWithTextAt('SECRET', 50, 550);
    await expect(verifyRedactions(bytes, [])).rejects.toThrow(/region/i);
  });

  it('treats a clean document with valid regions as clean', async () => {
    const doc = createPdf();
    doc.addPage([400, 600]); // page with no text at all
    const bytes = await doc.save();
    const report = await verifyRedactions(bytes, [
      { page: 0, x: 0, y: 0, width: 400, height: 600 },
    ]);
    expect(report.clean).toBe(true);
    expect(report.leaks).toEqual([]);
    expect(report.regionsChecked).toBe(1);
  });
});

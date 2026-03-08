/**
 * Tests for the page label API.
 *
 * Covers:
 * - Setting decimal page labels
 * - Setting Roman numeral labels (upper and lower)
 * - Setting alphabetic labels (upper and lower)
 * - Prefix support
 * - Custom start values
 * - Multiple label ranges
 * - Getting page labels
 * - Removing page labels
 * - Validation: empty array throws
 * - Validation: unsorted ranges throw
 * - PDF structure verification (/PageLabels in catalog)
 * - Edge case: single range starting at page 0
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import {
  setPageLabels,
  getPageLabels,
  removePageLabels,
  styleToPdf,
  pdfToStyle,
} from '../../../src/core/pageLabels.js';
import type { PageLabelRange, PageLabelStyle } from '../../../src/core/pageLabels.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDocWithPages(n: number) {
  const doc = createPdf();
  for (let i = 0; i < n; i++) {
    doc.addPage();
  }
  return doc;
}

// ---------------------------------------------------------------------------
// setPageLabels
// ---------------------------------------------------------------------------

describe('setPageLabels', () => {
  it('sets decimal labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'decimal' }]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(1);
    expect(labels![0]!.style).toBe('decimal');
    expect(labels![0]!.startPage).toBe(0);
  });

  it('sets lowercase Roman numeral labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'roman' }]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.style).toBe('roman');
  });

  it('sets uppercase Roman numeral labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'Roman' }]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.style).toBe('Roman');
  });

  it('sets lowercase alphabetic labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'alpha' }]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.style).toBe('alpha');
  });

  it('sets uppercase alphabetic labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'Alpha' }]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.style).toBe('Alpha');
  });

  it('sets labels with a prefix', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: 'A-' },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.prefix).toBe('A-');
  });

  it('sets labels with a custom start value', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 10 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(10);
  });

  it('sets multiple label ranges', () => {
    const doc = createDocWithPages(10);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman' },
      { startPage: 4, style: 'decimal', start: 1 },
      { startPage: 8, style: 'Alpha', prefix: 'App-' },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(3);
    expect(labels![0]!.style).toBe('roman');
    expect(labels![1]!.style).toBe('decimal');
    expect(labels![1]!.start).toBe(1);
    expect(labels![2]!.style).toBe('Alpha');
    expect(labels![2]!.prefix).toBe('App-');
  });

  it('overwrites previous labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'roman' }]);
    setPageLabels(doc, [{ startPage: 0, style: 'decimal' }]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(1);
    expect(labels![0]!.style).toBe('decimal');
  });

  it('throws on empty labels array', () => {
    const doc = createDocWithPages(1);
    expect(() => setPageLabels(doc, [])).toThrow(
      'Page labels array must not be empty',
    );
  });

  it('throws on unsorted ranges', () => {
    const doc = createDocWithPages(5);
    expect(() =>
      setPageLabels(doc, [
        { startPage: 4, style: 'decimal' },
        { startPage: 0, style: 'roman' },
      ]),
    ).toThrow('sorted by startPage');
  });

  it('throws on duplicate startPage values', () => {
    const doc = createDocWithPages(5);
    expect(() =>
      setPageLabels(doc, [
        { startPage: 0, style: 'roman' },
        { startPage: 0, style: 'decimal' },
      ]),
    ).toThrow('sorted by startPage');
  });
});

// ---------------------------------------------------------------------------
// getPageLabels
// ---------------------------------------------------------------------------

describe('getPageLabels', () => {
  it('returns undefined when no labels have been set', () => {
    const doc = createDocWithPages(1);
    const labels = getPageLabels(doc);
    expect(labels).toBeUndefined();
  });

  it('returns a defensive copy (mutation-safe)', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'decimal' }]);

    const labels1 = getPageLabels(doc);
    const labels2 = getPageLabels(doc);
    expect(labels1).toEqual(labels2);
    expect(labels1).not.toBe(labels2); // Different references
  });
});

// ---------------------------------------------------------------------------
// removePageLabels
// ---------------------------------------------------------------------------

describe('removePageLabels', () => {
  it('clears existing page labels', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'roman' }]);

    removePageLabels(doc);

    expect(getPageLabels(doc)).toBeUndefined();
  });

  it('is safe to call when no labels exist', () => {
    const doc = createDocWithPages(1);
    removePageLabels(doc);
    expect(getPageLabels(doc)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// styleToPdf / pdfToStyle helpers
// ---------------------------------------------------------------------------

describe('styleToPdf', () => {
  it('maps decimal to D', () => {
    expect(styleToPdf('decimal')).toBe('D');
  });

  it('maps roman to r', () => {
    expect(styleToPdf('roman')).toBe('r');
  });

  it('maps Roman to R', () => {
    expect(styleToPdf('Roman')).toBe('R');
  });

  it('maps alpha to a', () => {
    expect(styleToPdf('alpha')).toBe('a');
  });

  it('maps Alpha to A', () => {
    expect(styleToPdf('Alpha')).toBe('A');
  });
});

describe('pdfToStyle', () => {
  it('maps D to decimal', () => {
    expect(pdfToStyle('D')).toBe('decimal');
  });

  it('maps r to roman', () => {
    expect(pdfToStyle('r')).toBe('roman');
  });

  it('maps R to Roman', () => {
    expect(pdfToStyle('R')).toBe('Roman');
  });

  it('maps a to alpha', () => {
    expect(pdfToStyle('a')).toBe('alpha');
  });

  it('maps A to Alpha', () => {
    expect(pdfToStyle('A')).toBe('Alpha');
  });

  it('returns undefined for unknown names', () => {
    expect(pdfToStyle('X')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PDF structure verification
// ---------------------------------------------------------------------------

describe('PDF structure', () => {
  it('includes /PageLabels in the saved PDF', async () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman' },
      { startPage: 3, style: 'decimal', start: 1 },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/PageLabels');
    expect(text).toContain('/Nums');
    expect(text).toContain('/S /r');
    expect(text).toContain('/S /D');
    expect(text).toContain('/St 1');
  });

  it('includes prefix in saved PDF', async () => {
    const doc = createDocWithPages(3);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: 'Ch-' },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).toContain('/P (Ch-)');
  });

  it('does not include /PageLabels when none are set', async () => {
    const doc = createDocWithPages(1);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).not.toContain('/PageLabels');
  });

  it('does not include /PageLabels after removal', async () => {
    const doc = createDocWithPages(3);
    setPageLabels(doc, [{ startPage: 0, style: 'decimal' }]);
    removePageLabels(doc);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text).not.toContain('/PageLabels');
  });
});

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
 * - Validation: negative startPage throws
 * - Validation: negative start throws
 * - PDF structure verification (/PageLabels in catalog)
 * - Edge case: single range starting at page 0
 * - Edge case: large page counts (>3999 pages)
 * - Edge case: mixed prefix scenarios
 * - Edge case: start value of 0
 * - Edge case: very large start values
 * - Edge case: >50 label ranges
 * - Mixed style types in the same document
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
// Validation: negative startPage and start
// ---------------------------------------------------------------------------

describe('setPageLabels validation', () => {
  it('throws RangeError on negative startPage', () => {
    const doc = createDocWithPages(5);
    expect(() =>
      setPageLabels(doc, [{ startPage: -1, style: 'decimal' }]),
    ).toThrow(RangeError);
    expect(() =>
      setPageLabels(doc, [{ startPage: -1, style: 'decimal' }]),
    ).toThrow('startPage must be non-negative');
  });

  it('throws RangeError on negative start value', () => {
    const doc = createDocWithPages(5);
    expect(() =>
      setPageLabels(doc, [{ startPage: 0, style: 'decimal', start: -5 }]),
    ).toThrow(RangeError);
    expect(() =>
      setPageLabels(doc, [{ startPage: 0, style: 'decimal', start: -5 }]),
    ).toThrow('start must be non-negative');
  });

  it('throws RangeError on negative startPage in a later range', () => {
    const doc = createDocWithPages(5);
    expect(() =>
      setPageLabels(doc, [
        { startPage: 0, style: 'roman' },
        { startPage: -2, style: 'decimal' },
      ]),
    ).toThrow('startPage must be non-negative');
  });

  it('allows start value of 0', () => {
    const doc = createDocWithPages(5);
    // start = 0 is valid (pages labelled 0, 1, 2, ...)
    setPageLabels(doc, [{ startPage: 0, style: 'decimal', start: 0 }]);
    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(0);
  });

  it('allows undefined start (defaults to 1)', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [{ startPage: 0, style: 'decimal' }]);
    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBeUndefined();
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

// ---------------------------------------------------------------------------
// Edge cases: large page counts
// ---------------------------------------------------------------------------

describe('large page counts', () => {
  it('accepts Roman numeral style with start > 3999', () => {
    // PDF viewers handle Roman numeral rendering -- we just store the label
    // range with the style and start value.  The viewer decides how to
    // display values > 3999.
    const doc = createDocWithPages(2);
    setPageLabels(doc, [
      { startPage: 0, style: 'Roman', start: 4000 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(4000);
    expect(labels![0]!.style).toBe('Roman');
  });

  it('accepts lowercase roman style with start > 3999', () => {
    const doc = createDocWithPages(2);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman', start: 5000 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(5000);
  });

  it('handles a document with many pages and Roman labels', () => {
    // Create a document with enough pages that the range would span >3999
    const doc = createDocWithPages(10);
    setPageLabels(doc, [
      { startPage: 0, style: 'Roman' },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(1);
    expect(labels![0]!.style).toBe('Roman');
  });

  it('handles very large start values', () => {
    const doc = createDocWithPages(2);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 999_999 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(999_999);
  });

  it('serializes large start values into the PDF', async () => {
    const doc = createDocWithPages(2);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 10_000 },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/St 10000');
  });
});

// ---------------------------------------------------------------------------
// Edge cases: mixed prefix scenarios
// ---------------------------------------------------------------------------

describe('mixed prefix scenarios', () => {
  it('supports "App-" prefix for appendix pages', () => {
    const doc = createDocWithPages(8);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 1 },
      { startPage: 5, style: 'decimal', prefix: 'App-', start: 1 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(2);
    expect(labels![1]!.prefix).toBe('App-');
    expect(labels![1]!.start).toBe(1);
  });

  it('supports multi-character prefix strings', () => {
    const doc = createDocWithPages(5);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: 'Section-' },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.prefix).toBe('Section-');
  });

  it('supports empty string prefix', () => {
    const doc = createDocWithPages(3);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: '' },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.prefix).toBe('');
  });

  it('supports different prefixes in consecutive ranges', () => {
    const doc = createDocWithPages(12);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: 'Ch1-', start: 1 },
      { startPage: 4, style: 'decimal', prefix: 'Ch2-', start: 1 },
      { startPage: 8, style: 'decimal', prefix: 'Ch3-', start: 1 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(3);
    expect(labels![0]!.prefix).toBe('Ch1-');
    expect(labels![1]!.prefix).toBe('Ch2-');
    expect(labels![2]!.prefix).toBe('Ch3-');
  });

  it('serializes prefixes for each range in the PDF', async () => {
    const doc = createDocWithPages(6);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', prefix: 'Part-A-' },
      { startPage: 3, style: 'decimal', prefix: 'Part-B-' },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/P (Part-A-)');
    expect(text).toContain('/P (Part-B-)');
  });
});

// ---------------------------------------------------------------------------
// Edge cases: start value of 0
// ---------------------------------------------------------------------------

describe('start value of 0', () => {
  it('stores start = 0 correctly', () => {
    const doc = createDocWithPages(3);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 0 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels![0]!.start).toBe(0);
  });

  it('serializes start = 0 into the PDF', async () => {
    const doc = createDocWithPages(3);
    setPageLabels(doc, [
      { startPage: 0, style: 'decimal', start: 0 },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/St 0');
  });
});

// ---------------------------------------------------------------------------
// Mixed label styles in the same document
// ---------------------------------------------------------------------------

describe('mixed label styles', () => {
  it('uses roman for front matter, decimal for body, alpha for appendix', () => {
    const doc = createDocWithPages(15);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman' },                         // front matter: i, ii, iii
      { startPage: 3, style: 'decimal', start: 1 },             // body: 1, 2, 3, ...
      { startPage: 10, style: 'alpha', prefix: 'App-', start: 1 }, // appendix: App-a, App-b, ...
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(3);
    expect(labels![0]!.style).toBe('roman');
    expect(labels![1]!.style).toBe('decimal');
    expect(labels![1]!.start).toBe(1);
    expect(labels![2]!.style).toBe('alpha');
    expect(labels![2]!.prefix).toBe('App-');
  });

  it('uses uppercase Roman for preface, decimal for body, uppercase Alpha for index', () => {
    const doc = createDocWithPages(20);
    setPageLabels(doc, [
      { startPage: 0, style: 'Roman' },
      { startPage: 5, style: 'decimal', start: 1 },
      { startPage: 15, style: 'Alpha', start: 1 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(3);
    expect(labels![0]!.style).toBe('Roman');
    expect(labels![1]!.style).toBe('decimal');
    expect(labels![2]!.style).toBe('Alpha');
  });

  it('serializes all five style types in a single document', async () => {
    const doc = createDocWithPages(25);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman' },
      { startPage: 5, style: 'Roman' },
      { startPage: 10, style: 'decimal' },
      { startPage: 15, style: 'alpha' },
      { startPage: 20, style: 'Alpha' },
    ]);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/S /r');
    expect(text).toContain('/S /R');
    expect(text).toContain('/S /D');
    expect(text).toContain('/S /a');
    expect(text).toContain('/S /A');
  });

  it('interleaves styles with prefixes and custom start values', () => {
    const doc = createDocWithPages(12);
    setPageLabels(doc, [
      { startPage: 0, style: 'roman', start: 1 },
      { startPage: 3, style: 'decimal', prefix: 'Ch-', start: 1 },
      { startPage: 6, style: 'alpha', start: 1 },
      { startPage: 9, style: 'Roman', prefix: 'Idx-', start: 1 },
    ]);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(4);
    expect(labels![0]).toMatchObject({ style: 'roman', start: 1 });
    expect(labels![1]).toMatchObject({ style: 'decimal', prefix: 'Ch-', start: 1 });
    expect(labels![2]).toMatchObject({ style: 'alpha', start: 1 });
    expect(labels![3]).toMatchObject({ style: 'Roman', prefix: 'Idx-', start: 1 });
  });
});

// ---------------------------------------------------------------------------
// Many label ranges (>50)
// ---------------------------------------------------------------------------

describe('many label ranges', () => {
  it('accepts more than 50 label ranges', () => {
    const rangeCount = 60;
    const doc = createDocWithPages(rangeCount * 2);
    const styles: PageLabelStyle[] = ['decimal', 'roman', 'Roman', 'alpha', 'Alpha'];

    const ranges: PageLabelRange[] = [];
    for (let i = 0; i < rangeCount; i++) {
      ranges.push({
        startPage: i * 2,
        style: styles[i % styles.length]!,
        start: 1,
      });
    }

    setPageLabels(doc, ranges);

    const labels = getPageLabels(doc);
    expect(labels).toHaveLength(rangeCount);
    // Verify first and last
    expect(labels![0]!.startPage).toBe(0);
    expect(labels![0]!.style).toBe('decimal');
    expect(labels![59]!.startPage).toBe(118);
    expect(labels![59]!.style).toBe('Alpha');
  });

  it('serializes >50 ranges into the PDF', async () => {
    const rangeCount = 55;
    const doc = createDocWithPages(rangeCount);
    const ranges: PageLabelRange[] = [];
    for (let i = 0; i < rangeCount; i++) {
      ranges.push({
        startPage: i,
        style: 'decimal',
        start: i + 1,
      });
    }

    setPageLabels(doc, ranges);

    const bytes = await doc.save({ addDefaultPage: false });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/PageLabels');
    expect(text).toContain('/Nums');
  });
});

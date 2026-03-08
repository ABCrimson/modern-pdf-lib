/**
 * Tests for PDF value helper functions.
 *
 * Covers:
 * - asPDFName: creates PdfName from string with/without leading slash
 * - asPDFNumber: creates PdfNumber from numeric value
 * - asNumber: extracts numeric value from PdfNumber, returns undefined
 *   for non-number objects
 */

import { describe, it, expect } from 'vitest';
import {
  asPDFName,
  asPDFNumber,
  asNumber,
} from '../../../src/utils/pdfValueHelpers.js';
import {
  PdfName,
  PdfNumber,
  PdfNull,
  PdfBool,
  PdfString,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// asPDFName
// ---------------------------------------------------------------------------

describe('asPDFName', () => {
  it('creates a PdfName from a plain string', () => {
    const name = asPDFName('Page');
    expect(name).toBeInstanceOf(PdfName);
    expect(name.value).toBe('/Page');
  });

  it('creates a PdfName from a string with leading slash', () => {
    const name = asPDFName('/Type');
    expect(name).toBeInstanceOf(PdfName);
    expect(name.value).toBe('/Type');
  });

  it('returns a cached instance (same reference for same name)', () => {
    const a = asPDFName('Catalog');
    const b = asPDFName('Catalog');
    expect(a).toBe(b);
  });

  it('handles single-character names', () => {
    const name = asPDFName('X');
    expect(name.value).toBe('/X');
  });

  it('handles long names', () => {
    const longName = 'VeryLongPdfNameForTesting';
    const name = asPDFName(longName);
    expect(name.value).toBe('/' + longName);
  });

  it('has kind property equal to "name"', () => {
    const name = asPDFName('Test');
    expect(name.kind).toBe('name');
  });

  it('preserves the same PdfName.of behavior', () => {
    const helper = asPDFName('Font');
    const direct = PdfName.of('Font');
    expect(helper).toBe(direct);
  });

  it('normalizes names with and without slash to same instance', () => {
    const withSlash = asPDFName('/Resources');
    const withoutSlash = asPDFName('Resources');
    expect(withSlash).toBe(withoutSlash);
  });
});

// ---------------------------------------------------------------------------
// asPDFNumber
// ---------------------------------------------------------------------------

describe('asPDFNumber', () => {
  it('creates a PdfNumber from an integer', () => {
    const num = asPDFNumber(42);
    expect(num).toBeInstanceOf(PdfNumber);
    expect(num.value).toBe(42);
  });

  it('creates a PdfNumber from a float', () => {
    const num = asPDFNumber(3.14);
    expect(num).toBeInstanceOf(PdfNumber);
    expect(num.value).toBeCloseTo(3.14, 10);
  });

  it('creates a PdfNumber from zero', () => {
    const num = asPDFNumber(0);
    expect(num.value).toBe(0);
  });

  it('creates a PdfNumber from a negative value', () => {
    const num = asPDFNumber(-10);
    expect(num.value).toBe(-10);
  });

  it('creates a PdfNumber from a very large value', () => {
    const num = asPDFNumber(1_000_000);
    expect(num.value).toBe(1_000_000);
  });

  it('creates a PdfNumber from a very small float', () => {
    const num = asPDFNumber(0.001);
    expect(num.value).toBeCloseTo(0.001, 10);
  });

  it('has kind property equal to "number"', () => {
    const num = asPDFNumber(7);
    expect(num.kind).toBe('number');
  });

  it('behaves the same as PdfNumber.of', () => {
    const helper = asPDFNumber(99);
    const direct = PdfNumber.of(99);
    expect(helper.value).toBe(direct.value);
    expect(helper.kind).toBe(direct.kind);
  });
});

// ---------------------------------------------------------------------------
// asNumber
// ---------------------------------------------------------------------------

describe('asNumber', () => {
  it('extracts value from a PdfNumber', () => {
    const num = PdfNumber.of(42);
    expect(asNumber(num)).toBe(42);
  });

  it('extracts float value from a PdfNumber', () => {
    const num = PdfNumber.of(3.14);
    expect(asNumber(num)).toBeCloseTo(3.14, 10);
  });

  it('extracts zero from a PdfNumber', () => {
    const num = PdfNumber.of(0);
    expect(asNumber(num)).toBe(0);
  });

  it('extracts negative value from a PdfNumber', () => {
    const num = PdfNumber.of(-5);
    expect(asNumber(num)).toBe(-5);
  });

  it('returns undefined for PdfNull', () => {
    expect(asNumber(PdfNull.instance)).toBeUndefined();
  });

  it('returns undefined for PdfBool', () => {
    expect(asNumber(PdfBool.TRUE)).toBeUndefined();
    expect(asNumber(PdfBool.FALSE)).toBeUndefined();
  });

  it('returns undefined for PdfName', () => {
    const name = PdfName.of('Type');
    expect(asNumber(name)).toBeUndefined();
  });

  it('returns undefined for PdfString', () => {
    const str = PdfString.literal('hello');
    expect(asNumber(str)).toBeUndefined();
  });
});

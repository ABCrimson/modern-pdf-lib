/**
 * Tests for the /PieceInfo private application data builder.
 *
 * Covers:
 * - The appName key exists in the returned /PieceInfo dict
 * - The data dict contains /LastModified (a PdfString) and /Private
 * - /Private is exactly the provided privateData dict
 * - A fixed Date produces a PDF date string starting with 'D:'
 * - Leading-slash normalization of appName
 * - Default lastModified (current time) still yields a valid PDF date
 * - Multiple applications can coexist via merged dicts
 */

import { describe, it, expect } from 'vitest';
import { buildPieceInfo } from '../../../src/core/pieceInfo.js';
import { PdfDict, PdfString, PdfNumber, PdfName } from '../../../src/core/pdfObjects.js';

describe('buildPieceInfo', () => {
  it('creates a /PieceInfo dict keyed by the application name', () => {
    const priv = new PdfDict();
    const pieceInfo = buildPieceInfo('MyApp', priv);

    expect(pieceInfo).toBeInstanceOf(PdfDict);
    // Keys are normalized with a leading slash.
    expect(pieceInfo.has('/MyApp')).toBe(true);
    expect(pieceInfo.has('MyApp')).toBe(true);
    expect(pieceInfo.size).toBe(1);
  });

  it('stores /LastModified and /Private inside the app data dict', () => {
    const priv = new PdfDict();
    priv.set('/Count', PdfNumber.of(42));

    const pieceInfo = buildPieceInfo('MyApp', priv);
    const dataDict = pieceInfo.get('/MyApp');

    expect(dataDict).toBeInstanceOf(PdfDict);
    if (!(dataDict instanceof PdfDict)) throw new Error('expected dict');

    expect(dataDict.has('/LastModified')).toBe(true);
    expect(dataDict.has('/Private')).toBe(true);

    const lastModified = dataDict.get('/LastModified');
    expect(lastModified).toBeInstanceOf(PdfString);

    // /Private is exactly the dict we passed in (identity preserved).
    const stored = dataDict.get('/Private');
    expect(stored).toBe(priv);
    if (!(stored instanceof PdfDict)) throw new Error('expected dict');
    const count = stored.get('/Count');
    expect(count).toBeInstanceOf(PdfNumber);
    expect((count as PdfNumber).value).toBe(42);
  });

  it('formats a fixed Date as a PDF date string starting with D:', () => {
    const fixed = new Date(Date.UTC(2024, 2, 8, 13, 45, 9));
    const pieceInfo = buildPieceInfo('MyApp', new PdfDict(), fixed);

    const dataDict = pieceInfo.get('/MyApp');
    if (!(dataDict instanceof PdfDict)) throw new Error('expected dict');

    const lastModified = dataDict.get('/LastModified');
    if (!(lastModified instanceof PdfString)) throw new Error('expected string');

    expect(lastModified.value.startsWith('D:')).toBe(true);
    // D:YYYYMMDDHHmmSSZ — UTC components from the fixed date.
    expect(lastModified.value).toBe('D:20240308134509Z');
  });

  it('defaults /LastModified to the current time when omitted', () => {
    const before = Date.now();
    const pieceInfo = buildPieceInfo('MyApp', new PdfDict());
    const after = Date.now();

    const dataDict = pieceInfo.get('/MyApp');
    if (!(dataDict instanceof PdfDict)) throw new Error('expected dict');
    const lastModified = dataDict.get('/LastModified');
    if (!(lastModified instanceof PdfString)) throw new Error('expected string');

    expect(lastModified.value.startsWith('D:')).toBe(true);

    // Parse D:YYYYMMDDHHmmSSZ back to a UTC timestamp and verify it falls
    // within the call window (with a 1s slack on each side for rounding).
    const m = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(lastModified.value);
    expect(m).not.toBeNull();
    if (m === null) throw new Error('unexpected date format');
    const [, y, mo, d, h, mi, s] = m;
    const parsed = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    );
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
    expect(parsed).toBeLessThanOrEqual(after + 1000);
  });

  it('normalizes an appName that already includes a leading slash', () => {
    const pieceInfo = buildPieceInfo('/Acme', new PdfDict());
    expect(pieceInfo.has('/Acme')).toBe(true);
    expect(pieceInfo.size).toBe(1);
  });

  it('produces independent dicts that can be merged for multiple apps', () => {
    const appA = buildPieceInfo('AppA', new PdfDict());
    const appB = buildPieceInfo('AppB', new PdfDict());

    const merged = new PdfDict();
    for (const [key, value] of appA) merged.set(key, value);
    for (const [key, value] of appB) merged.set(key, value);

    expect(merged.has('/AppA')).toBe(true);
    expect(merged.has('/AppB')).toBe(true);
    expect(merged.size).toBe(2);
    // Sanity: the keys round-trip through PdfName normalization.
    expect(PdfName.of('AppA').value).toBe('/AppA');
  });
});

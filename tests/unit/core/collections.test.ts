/**
 * @module tests/unit/core/collections
 *
 * Tests for the PDF Portfolios / Collections builder
 * ({@link buildCollection}, ISO 32000-2 §7.11.6).
 */

import { describe, it, expect } from 'vitest';
import {
  buildCollection,
  type CollectionSchemaField,
} from '../../../src/core/collections.ts';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
} from '../../../src/core/pdfObjects.ts';

/** Type guard asserting + narrowing a value to a {@link PdfDict}. */
function asDict(value: unknown): PdfDict {
  expect(value).toBeInstanceOf(PdfDict);
  return value as PdfDict;
}

describe('buildCollection', () => {
  it('produces a minimal collection with defaults (no options)', () => {
    const col = buildCollection();

    const type = col.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/Collection');

    const view = col.get('/View');
    expect(view).toBeInstanceOf(PdfName);
    expect((view as PdfName).value).toBe('/D'); // Details is the default

    // No optional entries.
    expect(col.has('/Schema')).toBe(false);
    expect(col.has('/Sort')).toBe(false);
    expect(col.has('/D')).toBe(false);
  });

  it('honours an explicit Tile view', () => {
    const col = buildCollection({ view: 'T' });
    expect((col.get('/View') as PdfName).value).toBe('/T');
  });

  it('honours the Hidden view', () => {
    const col = buildCollection({ view: 'H' });
    expect((col.get('/View') as PdfName).value).toBe('/H');
  });

  it('builds a 2-field schema + Tile view + single sort key', () => {
    const schema: readonly CollectionSchemaField[] = [
      { key: 'Name', label: 'File Name', fieldType: 'S', order: 0 },
      { key: 'Size', label: 'Size (bytes)', fieldType: 'N', order: 1 },
    ];
    const col = buildCollection({
      view: 'T',
      schema,
      sortKeys: ['Name'],
    });

    // /Type /Collection
    expect((col.get('/Type') as PdfName).value).toBe('/Collection');

    // /View /T
    expect((col.get('/View') as PdfName).value).toBe('/T');

    // /Schema present with both fields.
    const schemaDict = asDict(col.get('/Schema'));
    expect((schemaDict.get('/Type') as PdfName).value).toBe(
      '/CollectionSchema',
    );

    const nameField = asDict(schemaDict.get('/Name'));
    expect((nameField.get('/Type') as PdfName).value).toBe(
      '/CollectionField',
    );
    expect((nameField.get('/Subtype') as PdfName).value).toBe('/S');
    expect((nameField.get('/N') as PdfString).value).toBe('File Name');
    expect((nameField.get('/O') as PdfNumber).value).toBe(0);

    const sizeField = asDict(schemaDict.get('/Size'));
    expect((sizeField.get('/Subtype') as PdfName).value).toBe('/N');
    expect((sizeField.get('/N') as PdfString).value).toBe('Size (bytes)');
    expect((sizeField.get('/O') as PdfNumber).value).toBe(1);

    // /Sort present, single key serialized as a name.
    const sortDict = asDict(col.get('/Sort'));
    expect((sortDict.get('/Type') as PdfName).value).toBe('/CollectionSort');
    expect((sortDict.get('/S') as PdfName).value).toBe('/Name');
  });

  it('serializes /Sort/S as an array for multiple sort keys', () => {
    const col = buildCollection({
      schema: [
        { key: 'Name', label: 'Name', fieldType: 'S' },
        { key: 'Date', label: 'Modified', fieldType: 'D' },
      ],
      sortKeys: ['Date', 'Name'],
    });

    const sortDict = asDict(col.get('/Sort'));
    const s = sortDict.get('/S');
    expect(s).toBeInstanceOf(PdfArray);
    const arr = s as PdfArray;
    expect(arr.length).toBe(2);
    expect((arr.items[0] as PdfName).value).toBe('/Date');
    expect((arr.items[1] as PdfName).value).toBe('/Name');
  });

  it('omits /O when a field has no order', () => {
    const col = buildCollection({
      schema: [{ key: 'Desc', label: 'Description', fieldType: 'S' }],
    });
    const schemaDict = asDict(col.get('/Schema'));
    const descField = asDict(schemaDict.get('/Desc'));
    expect(descField.has('/O')).toBe(false);
    expect((descField.get('/Subtype') as PdfName).value).toBe('/S');
  });

  it('records the initial document name as a literal string', () => {
    const col = buildCollection({ initialDocument: 'report.pdf' });
    const d = col.get('/D');
    expect(d).toBeInstanceOf(PdfString);
    expect((d as PdfString).value).toBe('report.pdf');
    expect((d as PdfString).hex).toBe(false);
  });

  it('omits /Schema and /Sort when given empty arrays', () => {
    const col = buildCollection({ schema: [], sortKeys: [] });
    expect(col.has('/Schema')).toBe(false);
    expect(col.has('/Sort')).toBe(false);
  });

  it('supports all three field subtypes', () => {
    const col = buildCollection({
      schema: [
        { key: 'A', label: 'Str', fieldType: 'S' },
        { key: 'B', label: 'Dat', fieldType: 'D' },
        { key: 'C', label: 'Num', fieldType: 'N' },
      ],
    });
    const schemaDict = asDict(col.get('/Schema'));
    expect((asDict(schemaDict.get('/A')).get('/Subtype') as PdfName).value).toBe(
      '/S',
    );
    expect((asDict(schemaDict.get('/B')).get('/Subtype') as PdfName).value).toBe(
      '/D',
    );
    expect((asDict(schemaDict.get('/C')).get('/Subtype') as PdfName).value).toBe(
      '/N',
    );
  });

  it('produces a serializable dictionary', () => {
    const col = buildCollection({
      view: 'D',
      schema: [{ key: 'Name', label: 'Name', fieldType: 'S', order: 0 }],
      sortKeys: ['Name'],
      initialDocument: 'first.pdf',
    });

    const parts: string[] = [];
    col.serialize({
      write: (data: Uint8Array): void => {
        parts.push(new TextDecoder().decode(data));
      },
      writeString: (str: string): void => {
        parts.push(str);
      },
    });
    const out = parts.join('');
    expect(out).toContain('/Type');
    expect(out).toContain('/Collection');
    expect(out).toContain('/CollectionSchema');
    expect(out).toContain('/CollectionSort');
    expect(out).toContain('(first.pdf)');
  });
});

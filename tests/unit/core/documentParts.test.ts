/**
 * Tests for the PDF 2.0 Document Part hierarchy builder (ISO 32000-2 §14.12).
 *
 * Covers:
 * - Root dictionary shape (/Type /DPartRoot + /DPartRootNode /DPart)
 * - /DParts array length matches the number of parts
 * - Each child node /Type, /Start, /End values
 * - /DPM metadata emitted as name/string pairs when present
 * - /DPM omitted when metadata is absent or empty
 * - Order preservation across multiple parts
 * - Empty parts list → empty /DParts array
 * - Serialization produces spec-shaped PDF syntax
 */

import { describe, it, expect } from 'vitest';
import { buildDPartRoot } from '../../../src/core/documentParts.js';
import type { DocumentPart } from '../../../src/core/documentParts.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  type ByteWriter,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal ByteWriter that accumulates the serialized PDF text. */
class StringWriter implements ByteWriter {
  private out = '';
  private readonly decoder = new TextDecoder();
  write(data: Uint8Array): void {
    this.out += this.decoder.decode(data);
  }
  writeString(str: string): void {
    this.out += str;
  }
  toString(): string {
    return this.out;
  }
}

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  const w = new StringWriter();
  obj.serialize(w);
  return w.toString();
}

/** Assert a value is a PdfDict and return it narrowed. */
function asDict(value: unknown): PdfDict {
  expect(value).toBeInstanceOf(PdfDict);
  return value as PdfDict;
}

/** Assert a value is a PdfArray and return it narrowed. */
function asArray(value: unknown): PdfArray {
  expect(value).toBeInstanceOf(PdfArray);
  return value as PdfArray;
}

/** Read a /Name dictionary entry's value (without leading slash). */
function nameOf(value: unknown): string {
  expect(value).toBeInstanceOf(PdfName);
  return (value as PdfName).value;
}

/** Read a /Number dictionary entry's numeric value. */
function numberOf(value: unknown): number {
  expect(value).toBeInstanceOf(PdfNumber);
  return (value as PdfNumber).value;
}

/** Read a /String dictionary entry's value. */
function stringOf(value: unknown): string {
  expect(value).toBeInstanceOf(PdfString);
  return (value as PdfString).value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildDPartRoot', () => {
  it('builds a /DPartRoot with a /DPart root node from two parts', () => {
    const parts: readonly DocumentPart[] = [
      { startPage: 0, endPage: 2, metadata: { Recipient: 'Alice', Lang: 'en' } },
      { startPage: 3, endPage: 5, metadata: { Recipient: 'Bob' } },
    ];

    const root = buildDPartRoot(parts);

    // Root: /Type /DPartRoot
    expect(nameOf(root.get('/Type'))).toBe('/DPartRoot');

    // Root node: /Type /DPart
    const rootNode = asDict(root.get('/DPartRootNode'));
    expect(nameOf(rootNode.get('/Type'))).toBe('/DPart');

    // /DParts array length === 2
    const dparts = asArray(rootNode.get('/DParts'));
    expect(dparts.length).toBe(2);

    // Child 0
    const child0 = asDict(dparts.items[0]);
    expect(nameOf(child0.get('/Type'))).toBe('/DPart');
    expect(numberOf(child0.get('/Start'))).toBe(0);
    expect(numberOf(child0.get('/End'))).toBe(2);
    const dpm0 = asDict(child0.get('/DPM'));
    expect(stringOf(dpm0.get('/Recipient'))).toBe('Alice');
    expect(stringOf(dpm0.get('/Lang'))).toBe('en');

    // Child 1
    const child1 = asDict(dparts.items[1]);
    expect(numberOf(child1.get('/Start'))).toBe(3);
    expect(numberOf(child1.get('/End'))).toBe(5);
    const dpm1 = asDict(child1.get('/DPM'));
    expect(stringOf(dpm1.get('/Recipient'))).toBe('Bob');
    expect(dpm1.get('/Lang')).toBeUndefined();
  });

  it('omits /DPM when metadata is absent', () => {
    const root = buildDPartRoot([{ startPage: 0, endPage: 0 }]);
    const rootNode = asDict(root.get('/DPartRootNode'));
    const dparts = asArray(rootNode.get('/DParts'));
    const child = asDict(dparts.items[0]);
    expect(child.has('/DPM')).toBe(false);
    expect(numberOf(child.get('/Start'))).toBe(0);
    expect(numberOf(child.get('/End'))).toBe(0);
  });

  it('omits /DPM when metadata is an empty object', () => {
    const root = buildDPartRoot([{ startPage: 1, endPage: 4, metadata: {} }]);
    const child = asDict(
      asArray(asDict(root.get('/DPartRootNode')).get('/DParts')).items[0],
    );
    expect(child.has('/DPM')).toBe(false);
  });

  it('produces an empty /DParts array for an empty parts list', () => {
    const root = buildDPartRoot([]);
    const rootNode = asDict(root.get('/DPartRootNode'));
    const dparts = asArray(rootNode.get('/DParts'));
    expect(dparts.length).toBe(0);
  });

  it('preserves the order of parts', () => {
    const parts: readonly DocumentPart[] = [
      { startPage: 10, endPage: 11 },
      { startPage: 0, endPage: 1 },
      { startPage: 5, endPage: 9 },
    ];
    const dparts = asArray(
      asDict(buildDPartRoot(parts).get('/DPartRootNode')).get('/DParts'),
    );
    expect(dparts.length).toBe(3);
    expect(numberOf(asDict(dparts.items[0]).get('/Start'))).toBe(10);
    expect(numberOf(asDict(dparts.items[1]).get('/Start'))).toBe(0);
    expect(numberOf(asDict(dparts.items[2]).get('/Start'))).toBe(5);
  });

  it('handles a single part spanning a wide page range', () => {
    const root = buildDPartRoot([
      { startPage: 0, endPage: 999, metadata: { Title: 'Whole Doc' } },
    ]);
    const child = asDict(
      asArray(asDict(root.get('/DPartRootNode')).get('/DParts')).items[0],
    );
    expect(numberOf(child.get('/Start'))).toBe(0);
    expect(numberOf(child.get('/End'))).toBe(999);
    expect(stringOf(asDict(child.get('/DPM')).get('/Title'))).toBe('Whole Doc');
  });

  it('serializes to spec-shaped PDF syntax', () => {
    const out = serialize(
      buildDPartRoot([{ startPage: 0, endPage: 1, metadata: { K: 'V' } }]),
    );
    expect(out).toContain('/Type /DPartRoot');
    expect(out).toContain('/DPartRootNode');
    expect(out).toContain('/DParts');
    expect(out).toContain('/Type /DPart');
    expect(out).toContain('/Start 0');
    expect(out).toContain('/End 1');
    expect(out).toContain('/DPM');
    expect(out).toContain('/K (V)');
  });

  it('does not mutate the metadata source object', () => {
    const meta = { A: '1' } as const;
    buildDPartRoot([{ startPage: 0, endPage: 0, metadata: meta }]);
    expect(Object.keys(meta)).toEqual(['A']);
    expect(meta.A).toBe('1');
  });
});

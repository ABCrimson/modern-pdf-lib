/**
 * Tests for PDF/VT variable & transactional printing (ISO 16612-2).
 *
 * Covers:
 * - buildVtDpm emits /Type /DPM, /S /VT, /RecordID and field entries
 * - buildVtDpm omits extra field entries when fields are absent
 * - buildPdfVtDParts over 2 records yields a /DPartRoot with 2 child parts,
 *   each carrying a VT /DPM
 * - Page ranges (/Start, /End) preserved per record
 * - gtsPdfVtVersion maps conformance levels (and defaults) correctly
 * - Serialization produces spec-shaped PDF syntax
 */

import { describe, it, expect } from 'vitest';
import {
  buildVtDpm,
  buildPdfVtDParts,
  gtsPdfVtVersion,
} from '../../../src/compliance/pdfVT.js';
import type { RecordMetadata } from '../../../src/compliance/pdfVT.js';
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

/** Read a /Name dictionary entry's value (with leading slash). */
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

/** Fetch the i-th child /DPart node from a /DPartRoot dictionary. */
function childAt(root: PdfDict, index: number): PdfDict {
  const rootNode = asDict(root.get('/DPartRootNode'));
  const dparts = asArray(rootNode.get('/DParts'));
  return asDict(dparts.items[index]);
}

// ---------------------------------------------------------------------------
// buildVtDpm
// ---------------------------------------------------------------------------

describe('buildVtDpm', () => {
  it('emits /Type /DPM with /S /VT and the record fields', () => {
    const dpm = buildVtDpm({
      startPage: 0,
      endPage: 2,
      recordId: 'REC-001',
      fields: { Recipient: 'Alice', AccountNo: '12345' },
    });

    expect(nameOf(dpm.get('/Type'))).toBe('/DPM');
    expect(nameOf(dpm.get('/S'))).toBe('/VT');
    expect(stringOf(dpm.get('/RecordID'))).toBe('REC-001');
    expect(stringOf(dpm.get('/Recipient'))).toBe('Alice');
    expect(stringOf(dpm.get('/AccountNo'))).toBe('12345');
  });

  it('emits only the required entries when fields are absent', () => {
    const dpm = buildVtDpm({ startPage: 0, endPage: 0, recordId: 'R' });
    expect(nameOf(dpm.get('/Type'))).toBe('/DPM');
    expect(nameOf(dpm.get('/S'))).toBe('/VT');
    expect(stringOf(dpm.get('/RecordID'))).toBe('R');
    expect(dpm.has('/Recipient')).toBe(false);
  });

  it('handles an empty fields object', () => {
    const dpm = buildVtDpm({
      startPage: 0,
      endPage: 0,
      recordId: 'R',
      fields: {},
    });
    expect(stringOf(dpm.get('/RecordID'))).toBe('R');
    // Only /Type, /S, /RecordID
    expect(dpm.size).toBe(3);
  });

  it('serializes to spec-shaped PDF syntax', () => {
    const out = serialize(
      buildVtDpm({
        startPage: 0,
        endPage: 0,
        recordId: 'X1',
        fields: { K: 'V' },
      }),
    );
    expect(out).toContain('/Type /DPM');
    expect(out).toContain('/S /VT');
    expect(out).toContain('/RecordID (X1)');
    expect(out).toContain('/K (V)');
  });
});

// ---------------------------------------------------------------------------
// buildPdfVtDParts
// ---------------------------------------------------------------------------

describe('buildPdfVtDParts', () => {
  it('yields a /DPartRoot with 2 parts over 2 records', () => {
    const records: readonly RecordMetadata[] = [
      {
        startPage: 0,
        endPage: 2,
        recordId: 'REC-A',
        fields: { Recipient: 'Alice' },
      },
      { startPage: 3, endPage: 5, recordId: 'REC-B' },
    ];

    const root = buildPdfVtDParts(records);

    expect(nameOf(root.get('/Type'))).toBe('/DPartRoot');

    const rootNode = asDict(root.get('/DPartRootNode'));
    expect(nameOf(rootNode.get('/Type'))).toBe('/DPart');

    const dparts = asArray(rootNode.get('/DParts'));
    expect(dparts.length).toBe(2);

    // Child 0 — page range + VT /DPM
    const child0 = childAt(root, 0);
    expect(numberOf(child0.get('/Start'))).toBe(0);
    expect(numberOf(child0.get('/End'))).toBe(2);
    const dpm0 = asDict(child0.get('/DPM'));
    expect(nameOf(dpm0.get('/S'))).toBe('/VT');
    expect(stringOf(dpm0.get('/RecordID'))).toBe('REC-A');
    expect(stringOf(dpm0.get('/Recipient'))).toBe('Alice');

    // Child 1
    const child1 = childAt(root, 1);
    expect(numberOf(child1.get('/Start'))).toBe(3);
    expect(numberOf(child1.get('/End'))).toBe(5);
    const dpm1 = asDict(child1.get('/DPM'));
    expect(nameOf(dpm1.get('/S'))).toBe('/VT');
    expect(stringOf(dpm1.get('/RecordID'))).toBe('REC-B');
  });

  it('produces an empty /DParts array for no records', () => {
    const root = buildPdfVtDParts([]);
    const dparts = asArray(asDict(root.get('/DPartRootNode')).get('/DParts'));
    expect(dparts.length).toBe(0);
  });

  it('preserves record order', () => {
    const records: readonly RecordMetadata[] = [
      { startPage: 10, endPage: 11, recordId: 'C' },
      { startPage: 0, endPage: 1, recordId: 'A' },
      { startPage: 5, endPage: 9, recordId: 'B' },
    ];
    const root = buildPdfVtDParts(records);
    expect(stringOf(asDict(childAt(root, 0).get('/DPM')).get('/RecordID'))).toBe(
      'C',
    );
    expect(stringOf(asDict(childAt(root, 1).get('/DPM')).get('/RecordID'))).toBe(
      'A',
    );
    expect(stringOf(asDict(childAt(root, 2).get('/DPM')).get('/RecordID'))).toBe(
      'B',
    );
  });

  it('serializes a record with the VT namespace', () => {
    const out = serialize(
      buildPdfVtDParts([{ startPage: 0, endPage: 1, recordId: 'R9' }]),
    );
    expect(out).toContain('/Type /DPartRoot');
    expect(out).toContain('/Type /DPart');
    expect(out).toContain('/Type /DPM');
    expect(out).toContain('/S /VT');
    expect(out).toContain('/RecordID (R9)');
  });
});

// ---------------------------------------------------------------------------
// gtsPdfVtVersion
// ---------------------------------------------------------------------------

describe('gtsPdfVtVersion', () => {
  it("returns 'PDF/VT-2' for PDF/VT-2", () => {
    expect(gtsPdfVtVersion('PDF/VT-2')).toBe('PDF/VT-2');
  });

  it('maps every conformance level', () => {
    expect(gtsPdfVtVersion('PDF/VT-1')).toBe('PDF/VT-1');
    expect(gtsPdfVtVersion('PDF/VT-3')).toBe('PDF/VT-3');
  });

  it('defaults to PDF/VT-1', () => {
    expect(gtsPdfVtVersion()).toBe('PDF/VT-1');
  });
});

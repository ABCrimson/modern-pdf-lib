/**
 * Tests for the PDF object model — PdfNull, PdfBool, PdfNumber, PdfString,
 * PdfName, PdfArray, PdfDict, PdfStream, PdfRef, and PdfObjectRegistry.
 *
 * Each test serializes the object via a simple ByteWriter that collects
 * strings, then verifies the output matches the PDF 1.7 spec.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfNull,
  PdfBool,
  PdfNumber,
  PdfString,
  PdfName,
  PdfArray,
  PdfDict,
  PdfStream,
  PdfRef,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';
import type { ByteWriter } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ByteWriter that collects output as a string. */
class StringWriter implements ByteWriter {
  private parts: string[] = [];

  write(data: Uint8Array): void {
    // Interpret bytes as Latin-1 / ASCII for test purposes
    let s = '';
    for (const b of data) {
      s += String.fromCharCode(b);
    }
    this.parts.push(s);
  }

  writeString(str: string): void {
    this.parts.push(str);
  }

  toString(): string {
    return this.parts.join('');
  }
}

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  const w = new StringWriter();
  obj.serialize(w);
  return w.toString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfNull', () => {
  it('serializes to "null"', () => {
    expect(serialize(PdfNull.instance)).toBe('null');
  });

  it('is a singleton', () => {
    expect(PdfNull.instance).toBe(PdfNull.instance);
  });
});

describe('PdfBool', () => {
  it('serializes true to "true"', () => {
    expect(serialize(PdfBool.TRUE)).toBe('true');
    expect(serialize(PdfBool.of(true))).toBe('true');
  });

  it('serializes false to "false"', () => {
    expect(serialize(PdfBool.FALSE)).toBe('false');
    expect(serialize(PdfBool.of(false))).toBe('false');
  });
});

describe('PdfNumber', () => {
  it('serializes integers without decimals', () => {
    expect(serialize(PdfNumber.of(42))).toBe('42');
    expect(serialize(PdfNumber.of(0))).toBe('0');
    expect(serialize(PdfNumber.of(-7))).toBe('-7');
    expect(serialize(PdfNumber.of(100000))).toBe('100000');
  });

  it('serializes floats with appropriate precision', () => {
    const result = serialize(PdfNumber.of(3.14));
    expect(result).toContain('3.14');
    // Should not have excessive trailing zeros
    expect(result).not.toMatch(/0{4,}$/);
  });

  it('serializes very small floats without losing precision', () => {
    const result = serialize(PdfNumber.of(0.001));
    expect(parseFloat(result)).toBeCloseTo(0.001, 3);
  });

  it('serializes negative zero as "0"', () => {
    expect(serialize(PdfNumber.of(-0))).toBe('0');
  });
});

describe('PdfString', () => {
  it('literal serializes with parentheses', () => {
    expect(serialize(PdfString.literal('Hello'))).toBe('(Hello)');
  });

  it('literal escapes special characters', () => {
    expect(serialize(PdfString.literal('a(b)c'))).toBe('(a\\(b\\)c)');
    expect(serialize(PdfString.literal('back\\slash'))).toBe('(back\\\\slash)');
  });

  it('literal escapes newlines and carriage returns', () => {
    const result = serialize(PdfString.literal('line\nbreak'));
    expect(result).toBe('(line\\nbreak)');
  });

  it('hex serializes with angle brackets', () => {
    const result = serialize(PdfString.hex('48656C6C6F'));
    expect(result).toBe('<48656C6C6F>');
  });

  it('hexFromBytes produces hex string from Uint8Array', () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    const result = serialize(PdfString.hexFromBytes(bytes));
    expect(result).toBe('<48656c6c6f>');
  });
});

describe('PdfName', () => {
  it('serializes with / prefix', () => {
    expect(serialize(PdfName.of('Type'))).toBe('/Type');
    expect(serialize(PdfName.of('/Type'))).toBe('/Type');
  });

  it('encodes special characters as #XX', () => {
    // Space (0x20 = 32) is below printable range 33-126
    const result = serialize(PdfName.of('/Name With Space'));
    expect(result).toContain('#20');
  });

  it('encodes hash character as #23', () => {
    const result = serialize(PdfName.of('/Name#Hash'));
    expect(result).toContain('#23');
  });

  it('passes through regular printable ASCII unchanged', () => {
    expect(serialize(PdfName.of('/HelloWorld'))).toBe('/HelloWorld');
    expect(serialize(PdfName.of('/Font'))).toBe('/Font');
  });

  it('caches identical names', () => {
    const a = PdfName.of('Type');
    const b = PdfName.of('Type');
    expect(a).toBe(b);
  });
});

describe('PdfArray', () => {
  it('serializes with brackets', () => {
    const arr = PdfArray.of([PdfNumber.of(1), PdfNumber.of(2), PdfNumber.of(3)]);
    expect(serialize(arr)).toBe('[1 2 3]');
  });

  it('serializes empty array', () => {
    const arr = PdfArray.of([]);
    expect(serialize(arr)).toBe('[]');
  });

  it('serializes mixed types', () => {
    const arr = PdfArray.of([
      PdfNumber.of(42),
      PdfString.literal('hello'),
      PdfBool.TRUE,
      PdfName.of('Type'),
    ]);
    const result = serialize(arr);
    expect(result).toBe('[42 (hello) true /Type]');
  });

  it('fromNumbers creates number array', () => {
    const arr = PdfArray.fromNumbers([0, 0, 612, 792]);
    expect(serialize(arr)).toBe('[0 0 612 792]');
  });

  it('reports correct length', () => {
    const arr = PdfArray.of([PdfNumber.of(1), PdfNumber.of(2)]);
    expect(arr.length).toBe(2);
  });
});

describe('PdfDict', () => {
  it('serializes with << >> and /Name keys', () => {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('Page'));

    const result = serialize(dict);
    expect(result).toContain('<<');
    expect(result).toContain('>>');
    expect(result).toContain('/Type');
    expect(result).toContain('/Page');
  });

  it('serializes multiple entries', () => {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('Font'));
    dict.set('/Subtype', PdfName.of('Type1'));
    dict.set('/BaseFont', PdfName.of('Helvetica'));

    const result = serialize(dict);
    expect(result).toContain('/Type /Font');
    expect(result).toContain('/Subtype /Type1');
    expect(result).toContain('/BaseFont /Helvetica');
  });

  it('normalizes key names with leading slash', () => {
    const dict = new PdfDict();
    dict.set('Type', PdfName.of('Catalog'));
    expect(dict.has('/Type')).toBe(true);
    expect(dict.has('Type')).toBe(true);
    expect(dict.get('/Type')).toBe(PdfName.of('Catalog'));
  });

  it('supports iteration', () => {
    const dict = new PdfDict();
    dict.set('/A', PdfNumber.of(1));
    dict.set('/B', PdfNumber.of(2));

    const entries = [...dict];
    expect(entries).toHaveLength(2);
    expect(entries[0]![0]).toBe('/A');
    expect(entries[1]![0]).toBe('/B');
  });

  it('reports correct size', () => {
    const dict = new PdfDict();
    expect(dict.size).toBe(0);
    dict.set('/A', PdfNumber.of(1));
    expect(dict.size).toBe(1);
  });

  it('supports delete', () => {
    const dict = new PdfDict();
    dict.set('/A', PdfNumber.of(1));
    expect(dict.has('/A')).toBe(true);
    dict.delete('/A');
    expect(dict.has('/A')).toBe(false);
  });
});

describe('PdfStream', () => {
  it('serializes with stream/endstream keywords', () => {
    const stream = PdfStream.fromString('BT /F1 12 Tf (Hello) Tj ET');
    const result = serialize(stream);

    expect(result).toContain('stream');
    expect(result).toContain('endstream');
    expect(result).toContain('BT /F1 12 Tf (Hello) Tj ET');
  });

  it('includes /Length in the dictionary', () => {
    const content = 'q 1 0 0 1 50 700 cm Q';
    const stream = PdfStream.fromString(content);
    const result = serialize(stream);

    expect(result).toContain('/Length');
    // The length should match the encoded byte length
    const encoder = new TextEncoder();
    const expectedLength = encoder.encode(content).length;
    expect(result).toContain(`/Length ${expectedLength}`);
  });

  it('fromBytes creates stream from Uint8Array', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = PdfStream.fromBytes(data);

    const dictResult = serialize(stream.dict);
    expect(dictResult).toContain('/Length 5');
  });

  it('syncLength updates /Length after data mutation', () => {
    const stream = PdfStream.fromString('short');
    const origLength = new TextEncoder().encode('short').length;
    expect(serialize(stream.dict)).toContain(`/Length ${origLength}`);

    // Replace data with longer content
    stream.data = new TextEncoder().encode('a much longer string of content here');
    stream.syncLength();
    expect(serialize(stream.dict)).toContain(
      `/Length ${new TextEncoder().encode('a much longer string of content here').length}`,
    );
  });
});

describe('PdfRef', () => {
  it('serializes as "N 0 R"', () => {
    expect(serialize(PdfRef.of(1))).toBe('1 0 R');
    expect(serialize(PdfRef.of(42))).toBe('42 0 R');
    expect(serialize(PdfRef.of(100, 0))).toBe('100 0 R');
  });

  it('supports custom generation numbers', () => {
    expect(serialize(PdfRef.of(5, 2))).toBe('5 2 R');
  });

  it('toObjectHeader produces correct header', () => {
    expect(PdfRef.of(3).toObjectHeader()).toBe('3 0 obj');
    expect(PdfRef.of(10, 1).toObjectHeader()).toBe('10 1 obj');
  });

  it('toObjectFooter returns "endobj"', () => {
    expect(PdfRef.of(1).toObjectFooter()).toBe('endobj');
  });

  it('toString returns "N G R"', () => {
    expect(PdfRef.of(7).toString()).toBe('7 0 R');
  });
});

describe('PdfObjectRegistry', () => {
  it('allocates monotonic object numbers', () => {
    const registry = new PdfObjectRegistry();

    const ref1 = registry.register(PdfNull.instance);
    const ref2 = registry.register(PdfBool.TRUE);
    const ref3 = registry.register(PdfNumber.of(42));

    expect(ref1.objectNumber).toBe(1);
    expect(ref2.objectNumber).toBe(2);
    expect(ref3.objectNumber).toBe(3);
  });

  it('tracks registered object count via size', () => {
    const registry = new PdfObjectRegistry();
    expect(registry.size).toBe(0);

    registry.register(PdfNull.instance);
    expect(registry.size).toBe(1);

    registry.register(PdfBool.TRUE);
    expect(registry.size).toBe(2);
  });

  it('nextNumber returns the next available object number', () => {
    const registry = new PdfObjectRegistry();
    expect(registry.nextNumber).toBe(1);

    registry.register(PdfNull.instance);
    expect(registry.nextNumber).toBe(2);
  });

  it('resolve() finds registered objects', () => {
    const registry = new PdfObjectRegistry();
    const obj = PdfNumber.of(99);
    const ref = registry.register(obj);

    expect(registry.resolve(ref)).toBe(obj);
  });

  it('resolve() returns undefined for unregistered refs', () => {
    const registry = new PdfObjectRegistry();
    expect(registry.resolve(PdfRef.of(999))).toBeUndefined();
  });

  it('allocate() + assign() works for deferred registration', () => {
    const registry = new PdfObjectRegistry();
    const ref = registry.allocate();
    expect(ref.objectNumber).toBeGreaterThan(0);

    const obj = PdfString.literal('deferred');
    registry.assign(ref, obj);

    expect(registry.resolve(ref)).toBe(obj);
  });

  it('registerWithRef registers with a specific ref', () => {
    const registry = new PdfObjectRegistry();
    const ref = PdfRef.of(50);
    const obj = PdfBool.TRUE;

    registry.registerWithRef(ref, obj);
    expect(registry.resolve(ref)).toBe(obj);
    // Next number should be past 50
    expect(registry.nextNumber).toBeGreaterThan(50);
  });

  it('iterates entries in allocation order', () => {
    const registry = new PdfObjectRegistry();
    const obj1 = PdfNumber.of(1);
    const obj2 = PdfNumber.of(2);
    const obj3 = PdfNumber.of(3);

    registry.register(obj1);
    registry.register(obj2);
    registry.register(obj3);

    const entries = [...registry];
    expect(entries).toHaveLength(3);
    expect(entries[0]!.object).toBe(obj1);
    expect(entries[1]!.object).toBe(obj2);
    expect(entries[2]!.object).toBe(obj3);
  });
});

describe('Nested objects', () => {
  it('serialize correctly', () => {
    const inner = new PdfDict();
    inner.set('/Name', PdfString.literal('value'));

    const arr = PdfArray.of([PdfNumber.of(1), inner, PdfBool.TRUE]);
    const result = serialize(arr);

    expect(result).toContain('[');
    expect(result).toContain('<<');
    expect(result).toContain('/Name (value)');
    expect(result).toContain('>>');
    expect(result).toContain('true');
    expect(result).toContain(']');
  });

  it('dict containing array serializes correctly', () => {
    const dict = new PdfDict();
    dict.set('/MediaBox', PdfArray.fromNumbers([0, 0, 612, 792]));
    dict.set('/Type', PdfName.of('Page'));

    const result = serialize(dict);
    expect(result).toContain('[0 0 612 792]');
    expect(result).toContain('/Type /Page');
  });

  it('dict containing ref serializes correctly', () => {
    const dict = new PdfDict();
    dict.set('/Parent', PdfRef.of(5));

    const result = serialize(dict);
    expect(result).toContain('/Parent 5 0 R');
  });
});

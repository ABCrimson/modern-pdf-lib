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
import { InvalidArgumentError, UnencodableTextError } from '../../../src/errors.js';

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
    // The digits are read as bytes and written in lower case (7.3.4.3: either case, same bytes).
    const result = serialize(PdfString.hex('48656C6C6F'));
    expect(result).toBe('<48656c6c6f>');
  });

  it('hexFromBytes produces hex string from Uint8Array', () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const result = serialize(PdfString.hexFromBytes(bytes));
    expect(result).toBe('<48656c6c6f>');
  });
});

describe('PdfString bytes', () => {
  const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
  const byteString = (bytes: Uint8Array): string => String.fromCharCode(...bytes);
  /** The error a call throws, or a failure when it returns. */
  const thrown = (call: () => unknown): unknown => {
    try {
      call();
    } catch (error) {
      return error;
    }
    throw new Error('expected a throw');
  };

  it('hex digits are one byte each only through fromHex and hex', () => {
    expect(PdfString.fromHex('AB').toBytes()).toEqual(new Uint8Array([0xab]));
    expect(PdfString.hex('AB').toBytes()).toEqual(new Uint8Array([0xab]));
    expect(PdfString.fromText('AB').toBytes()).toEqual(new Uint8Array([0x41, 0x42]));
    expect(PdfString.literal('AB').toBytes()).toEqual(new Uint8Array([0x41, 0x42]));
  });

  it('fromHex ignores white space, pads an odd count with 0 and refuses any other character', () => {
    expect(PdfString.fromHex(' 4\t1\r\n4\f').toBytes()).toEqual(new Uint8Array([0x41, 0x40]));
    expect(PdfString.fromHex('').byteLength).toBe(0);
    for (const digits of ['é', '4G', '0x41']) {
      const error = thrown(() => PdfString.fromHex(digits));
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect((error as InvalidArgumentError).argument).toBe('hexDigits');
    }
    expect(thrown(() => PdfString.hex('é'))).toBeInstanceOf(InvalidArgumentError);
    expect(PdfString.fromHex('41').hex).toBe(true);
  });

  it('literal takes one byte per code unit and throws above 0xFF at the index of the text given', () => {
    expect(serialize(PdfString.literal('é'))).toBe('(é)');
    const error = thrown(() => PdfString.literal('Café – € “x” Š'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({ character: '–', index: 5, encoding: 'PDF byte string' });
    expect(thrown(() => PdfString.literal('a😀'))).toMatchObject({ character: '😀', index: 1 });
  });

  it('fromText writes PDFDocEncoding or UTF-16BE and reports an unencodable character at its index', () => {
    expect(PdfString.fromText('Café – €').toBytes().toHex()).toBe('436166e9208520a0');
    expect(PdfString.fromText('日').toBytes().toHex()).toBe('feff65e5');
    expect(PdfString.fromText('é', 'utf-16be').toBytes().toHex()).toBe('feff00e9');
    expect(PdfString.fromText('é', 'utf-8').toBytes().toHex()).toBe('efbbbfc3a9');
    expect(PdfString.fromText('x').hex).toBe(false);
    const error = thrown(() => PdfString.fromText('é – 日', 'pdfdoc'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({ character: '日', index: 4, encoding: 'PDF text string' });
    expect(thrown(() => PdfString.fromText('a😀b', 'pdfdoc'))).toMatchObject({
      character: '😀',
      index: 1,
    });
    expect(thrown(() => PdfString.fromText('a\ud800'))).toMatchObject({ index: 1 });
    const utf16le = thrown(() => PdfString.fromText('x', 'utf-16le' as 'auto'));
    expect(utf16le).toBeInstanceOf(InvalidArgumentError);
    expect((utf16le as InvalidArgumentError).argument).toBe('encoding');
  });

  it('fromAscii takes U+0000 to U+007F and refuses anything above', () => {
    expect(PdfString.fromAscii('D:20261115').toBytes()).toEqual(
      new TextEncoder().encode('D:20261115'),
    );
    const error = thrown(() => PdfString.fromAscii('é'));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect((error as InvalidArgumentError).argument).toBe('text');
  });

  it('fromBytes copies the bytes and toBytes returns a new copy each time', () => {
    const source = new Uint8Array([1, 2, 3]);
    const s = PdfString.fromBytes(source);
    source[0] = 9;
    const first = s.toBytes();
    first[1] = 9;
    expect(s.toBytes()).toEqual(new Uint8Array([1, 2, 3]));
    expect(s.byteLength).toBe(3);
    expect(s.hex).toBe(false);
    expect(PdfString.fromBytes(source, 'hex').hex).toBe(true);
    const error = thrown(() => PdfString.fromBytes(source, 'base64' as 'hex'));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect((error as InvalidArgumentError).argument).toBe('form');
  });

  it('serializes all 256 byte values as bytes in both forms, escaping only \\ ( ) CR LF', () => {
    const escaped = byteString(ALL_BYTES)
      .replace(/[\\()]/g, (c) => `\\${c}`)
      .replace('\r', '\\r')
      .replace('\n', '\\n');
    expect(serialize(PdfString.fromBytes(ALL_BYTES))).toBe(`(${escaped})`);
    expect(serialize(PdfString.literal(byteString(ALL_BYTES)))).toBe(`(${escaped})`);
    expect(serialize(PdfString.fromBytes(ALL_BYTES, 'hex'))).toBe(`<${ALL_BYTES.toHex()}>`);
  });

  it('writes a literal string through write(), so a ByteWriter that encodes writeString as UTF-8 still gets the bytes', () => {
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    PdfString.fromBytes(new Uint8Array([0xe9])).serialize({
      write: (data) => chunks.push(data),
      writeString: (str) => chunks.push(encoder.encode(str)),
    });
    expect(chunks.flatMap((c) => [...c])).toEqual([0x28, 0xe9, 0x29]);
  });

  it('reads text through toText and names the encoding through textEncoding', () => {
    const cases: readonly (readonly [hex: string, encoding: string, text: string])[] = [
      ['436166e9', 'pdfdoc', 'Café'],
      ['feff00430061', 'utf-16be', 'Ca'],
      ['fffe43006100', 'utf-16le', 'Ca'],
      ['efbbbfc3a9', 'utf-8', 'é'],
    ];
    for (const [hex, encoding, text] of cases) {
      const s = PdfString.fromHex(hex);
      expect(s.textEncoding, hex).toBe(encoding);
      expect(s.toText(), hex).toBe(text);
    }
  });

  it('equals compares bytes only and compare orders bytes unsigned', () => {
    expect(PdfString.fromHex('4142').equals(PdfString.fromText('AB'))).toBe(true);
    expect(PdfString.fromHex('4142').equals(PdfString.fromHex('4143'))).toBe(false);
    const sorted = ['80', '7f', '', '7f00', '00'].map((h) => PdfString.fromHex(h));
    sorted.sort(PdfString.compare);
    expect(sorted.map((s) => s.toBytes().toHex())).toEqual(['', '00', '7f', '7f00', '80']);
    expect(PdfString.compare(PdfString.fromHex('41'), PdfString.fromText('A'))).toBe(0);
  });

  it('value is the byte string, also for hex and hexFromBytes strings', () => {
    expect(PdfString.hexFromBytes(new Uint8Array([0x41, 0xe9])).value).toBe('Aé');
    expect(PdfString.hex('41E9').value).toBe('Aé');
    expect(PdfString.fromText('日').value).toBe('þÿeå');
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

  it('escapes each of the 10 delimiters and "#" as #xx in lower case', () => {
    expect(serialize(PdfName.of('a(b)c<d>e[f]g{h}i/j%k#l'))).toBe(
      '/a#28b#29c#3cd#3ee#5bf#5dg#7bh#7di#2fj#25k#23l',
    );
    expect(serialize(PdfName.of('/é\u007fÿ'))).toBe('/#e9#7f#ff');
  });

  it('of refuses NUL and code units above 0xFF', () => {
    for (const name of ['A\u0000B', '日', '/aĀ']) {
      let error: unknown;
      try {
        PdfName.of(name);
      } catch (e) {
        error = e;
      }
      expect(error, name).toBeInstanceOf(InvalidArgumentError);
      expect((error as InvalidArgumentError).argument).toBe('name');
    }
  });

  it('fromBytes builds the interned name of the bytes; toBytes and toText read them', () => {
    const utf8 = new TextEncoder().encode('日本');
    const name = PdfName.fromBytes(utf8);
    expect(name.value).toBe(`/${String.fromCharCode(...utf8)}`);
    expect(name).toBe(PdfName.of(String.fromCharCode(...utf8)));
    expect(serialize(name)).toBe('/#e6#97#a5#e6#9c#ac');
    expect(name.toBytes()).toEqual(utf8);
    expect(name.toText()).toBe('日本');
    expect(PdfName.of('/Café').toText()).toBe('Caf�');
    let error: unknown;
    try {
      PdfName.fromBytes(new Uint8Array([0x41, 0x00]));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect((error as InvalidArgumentError).argument).toBe('bytes');
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

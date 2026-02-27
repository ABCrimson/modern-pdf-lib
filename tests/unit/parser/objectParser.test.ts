/**
 * Tests for the PDF object parser.
 *
 * The parser converts a token stream from `PdfLexer` into PDF object model
 * instances (`PdfNull`, `PdfBool`, `PdfNumber`, `PdfString`, `PdfName`,
 * `PdfArray`, `PdfDict`, `PdfStream`, `PdfRef`).
 *
 * Reference: PDF 1.7 specification, SS 7.3 (Objects).
 */

import { describe, it, expect } from 'vitest';
import { PdfLexer } from '../../../src/parser/lexer.js';
import { PdfObjectParser } from '../../../src/parser/objectParser.js';
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
import type { PdfObject } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a string to Uint8Array for the lexer. */
function bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Create a parser (with a fresh registry) from a plain string. */
function createParser(
  str: string,
): { parser: PdfObjectParser; registry: PdfObjectRegistry } {
  const lexer = new PdfLexer(bytes(str));
  const registry = new PdfObjectRegistry();
  const parser = new PdfObjectParser(lexer, registry);
  return { parser, registry };
}

/** Shorthand: parse a single object from a string. */
function parse(str: string): PdfObject {
  const { parser } = createParser(str);
  return parser.parseObject();
}

// ---------------------------------------------------------------------------
// Null
// ---------------------------------------------------------------------------

describe('PdfObjectParser - null', () => {
  it('parses null keyword', () => {
    const obj = parse('null');
    expect(obj).toBe(PdfNull.instance);
    expect(obj.kind).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// Boolean
// ---------------------------------------------------------------------------

describe('PdfObjectParser - boolean', () => {
  it('parses true', () => {
    const obj = parse('true');
    expect(obj.kind).toBe('bool');
    expect((obj as PdfBool).value).toBe(true);
  });

  it('parses false', () => {
    const obj = parse('false');
    expect(obj.kind).toBe('bool');
    expect((obj as PdfBool).value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

describe('PdfObjectParser - number', () => {
  it('parses a positive integer', () => {
    const obj = parse('42');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(42);
  });

  it('parses zero', () => {
    const obj = parse('0');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(0);
  });

  it('parses a negative integer', () => {
    const obj = parse('-7');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(-7);
  });

  it('parses a real number', () => {
    const obj = parse('3.14');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBeCloseTo(3.14, 5);
  });

  it('parses a negative real number', () => {
    const obj = parse('-0.5');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBeCloseTo(-0.5, 5);
  });

  it('parses a leading-dot real', () => {
    const obj = parse('.75');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBeCloseTo(0.75, 5);
  });

  it('returns PdfNumber for a standalone number (not followed by R)', () => {
    const obj = parse('42 (hello)');
    // Should parse just the 42, not try to combine with the string
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// String (literal)
// ---------------------------------------------------------------------------

describe('PdfObjectParser - literal string', () => {
  it('parses a simple literal string', () => {
    const obj = parse('(Hello)');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('Hello');
    expect((obj as PdfString).hex).toBe(false);
  });

  it('parses an empty literal string', () => {
    const obj = parse('()');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('');
  });

  it('parses a string with escape sequences', () => {
    const obj = parse('(line\\nbreak)');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('line\nbreak');
  });

  it('parses a string with nested parentheses', () => {
    const obj = parse('(outer(inner)text)');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('outer(inner)text');
  });
});

// ---------------------------------------------------------------------------
// String (hex)
// ---------------------------------------------------------------------------

describe('PdfObjectParser - hex string', () => {
  it('parses a hex string', () => {
    const obj = parse('<48656C6C6F>');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('Hello');
    expect((obj as PdfString).hex).toBe(true);
  });

  it('parses an empty hex string', () => {
    const obj = parse('<>');
    expect(obj.kind).toBe('string');
    expect((obj as PdfString).value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

describe('PdfObjectParser - name', () => {
  it('parses a simple name', () => {
    const obj = parse('/Type');
    expect(obj.kind).toBe('name');
    expect((obj as PdfName).value).toBe('/Type');
  });

  it('parses a name with #XX escapes', () => {
    const obj = parse('/Name#20With#20Spaces');
    expect(obj.kind).toBe('name');
    expect((obj as PdfName).value).toBe('/Name With Spaces');
  });
});

// ---------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------

describe('PdfObjectParser - array', () => {
  it('parses an empty array', () => {
    const obj = parse('[]');
    expect(obj.kind).toBe('array');
    expect((obj as PdfArray).length).toBe(0);
  });

  it('parses an array of numbers', () => {
    const obj = parse('[1 2 3]');
    expect(obj.kind).toBe('array');
    const arr = obj as PdfArray;
    expect(arr.length).toBe(3);
    expect((arr.items[0] as PdfNumber).value).toBe(1);
    expect((arr.items[1] as PdfNumber).value).toBe(2);
    expect((arr.items[2] as PdfNumber).value).toBe(3);
  });

  it('parses an array of mixed types', () => {
    const obj = parse('[42 (hello) /Name true null]');
    const arr = obj as PdfArray;
    expect(arr.length).toBe(5);
    expect(arr.items[0]!.kind).toBe('number');
    expect(arr.items[1]!.kind).toBe('string');
    expect(arr.items[2]!.kind).toBe('name');
    expect(arr.items[3]!.kind).toBe('bool');
    expect(arr.items[4]!.kind).toBe('null');
  });

  it('parses nested arrays', () => {
    const obj = parse('[[1 2] [3 4]]');
    const arr = obj as PdfArray;
    expect(arr.length).toBe(2);
    expect(arr.items[0]!.kind).toBe('array');
    expect(arr.items[1]!.kind).toBe('array');
    const inner1 = arr.items[0] as PdfArray;
    expect(inner1.length).toBe(2);
    expect((inner1.items[0] as PdfNumber).value).toBe(1);
    expect((inner1.items[1] as PdfNumber).value).toBe(2);
  });

  it('parses an array containing indirect references', () => {
    const obj = parse('[5 0 R 10 0 R]');
    const arr = obj as PdfArray;
    expect(arr.length).toBe(2);
    expect(arr.items[0]!.kind).toBe('ref');
    expect((arr.items[0] as PdfRef).objectNumber).toBe(5);
    expect(arr.items[1]!.kind).toBe('ref');
    expect((arr.items[1] as PdfRef).objectNumber).toBe(10);
  });

  it('parses an array with dict inside', () => {
    const obj = parse('[<< /Key (value) >>]');
    const arr = obj as PdfArray;
    expect(arr.length).toBe(1);
    expect(arr.items[0]!.kind).toBe('dict');
  });

  it('throws on unterminated array', () => {
    expect(() => parse('[1 2 3')).toThrow(/unterminated array/i);
  });
});

// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------

describe('PdfObjectParser - dictionary', () => {
  it('parses an empty dictionary', () => {
    const obj = parse('<<>>');
    expect(obj.kind).toBe('dict');
    expect((obj as PdfDict).size).toBe(0);
  });

  it('parses a dictionary with one entry', () => {
    const obj = parse('<< /Type /Page >>');
    expect(obj.kind).toBe('dict');
    const dict = obj as PdfDict;
    expect(dict.size).toBe(1);
    expect(dict.get('/Type')).toBeDefined();
    expect((dict.get('/Type') as PdfName).value).toBe('/Page');
  });

  it('parses a dictionary with multiple entries', () => {
    const obj = parse('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const dict = obj as PdfDict;
    expect(dict.size).toBe(3);
    expect((dict.get('/Type') as PdfName).value).toBe('/Font');
    expect((dict.get('/Subtype') as PdfName).value).toBe('/Type1');
    expect((dict.get('/BaseFont') as PdfName).value).toBe('/Helvetica');
  });

  it('parses a dictionary with number values', () => {
    const obj = parse('<< /Width 100 /Height 200 >>');
    const dict = obj as PdfDict;
    expect((dict.get('/Width') as PdfNumber).value).toBe(100);
    expect((dict.get('/Height') as PdfNumber).value).toBe(200);
  });

  it('parses a dictionary with string values', () => {
    const obj = parse('<< /Author (John Doe) /Title (Test) >>');
    const dict = obj as PdfDict;
    expect((dict.get('/Author') as PdfString).value).toBe('John Doe');
    expect((dict.get('/Title') as PdfString).value).toBe('Test');
  });

  it('parses a dictionary with boolean values', () => {
    const obj = parse('<< /Flag true /Other false >>');
    const dict = obj as PdfDict;
    expect((dict.get('/Flag') as PdfBool).value).toBe(true);
    expect((dict.get('/Other') as PdfBool).value).toBe(false);
  });

  it('parses a dictionary with null value', () => {
    const obj = parse('<< /Empty null >>');
    const dict = obj as PdfDict;
    expect(dict.get('/Empty')).toBe(PdfNull.instance);
  });

  it('parses a dictionary with array value', () => {
    const obj = parse('<< /MediaBox [0 0 612 792] >>');
    const dict = obj as PdfDict;
    const mediaBox = dict.get('/MediaBox') as PdfArray;
    expect(mediaBox.kind).toBe('array');
    expect(mediaBox.length).toBe(4);
    expect((mediaBox.items[0] as PdfNumber).value).toBe(0);
    expect((mediaBox.items[2] as PdfNumber).value).toBe(612);
    expect((mediaBox.items[3] as PdfNumber).value).toBe(792);
  });

  it('parses a dictionary with indirect reference value', () => {
    const obj = parse('<< /Parent 5 0 R >>');
    const dict = obj as PdfDict;
    const parent = dict.get('/Parent') as PdfRef;
    expect(parent.kind).toBe('ref');
    expect(parent.objectNumber).toBe(5);
    expect(parent.generationNumber).toBe(0);
  });

  it('parses nested dictionaries', () => {
    const obj = parse('<< /Resources << /Font << /F1 10 0 R >> >> >>');
    const dict = obj as PdfDict;
    const resources = dict.get('/Resources') as PdfDict;
    expect(resources.kind).toBe('dict');
    const font = resources.get('/Font') as PdfDict;
    expect(font.kind).toBe('dict');
    const f1 = font.get('/F1') as PdfRef;
    expect(f1.kind).toBe('ref');
    expect(f1.objectNumber).toBe(10);
  });

  it('throws on unterminated dictionary', () => {
    expect(() => parse('<< /Key (value)')).toThrow(
      /unterminated dictionary/i,
    );
  });

  it('throws on non-name key', () => {
    expect(() => parse('<< 42 (value) >>')).toThrow(/expected name/i);
  });
});

// ---------------------------------------------------------------------------
// Indirect references (N G R)
// ---------------------------------------------------------------------------

describe('PdfObjectParser - indirect references', () => {
  it('parses a simple indirect reference', () => {
    const obj = parse('5 0 R');
    expect(obj.kind).toBe('ref');
    const ref = obj as PdfRef;
    expect(ref.objectNumber).toBe(5);
    expect(ref.generationNumber).toBe(0);
  });

  it('parses a reference with non-zero generation', () => {
    const obj = parse('12 3 R');
    const ref = obj as PdfRef;
    expect(ref.objectNumber).toBe(12);
    expect(ref.generationNumber).toBe(3);
  });

  it('does not confuse two consecutive numbers as a reference', () => {
    // "5 3" followed by something that is not R or obj
    const { parser } = createParser('5 3 (hello)');
    const obj1 = parser.parseObject();
    // Should be number 5 (the 3 is pushed back)
    expect(obj1.kind).toBe('number');
    expect((obj1 as PdfNumber).value).toBe(5);

    const obj2 = parser.parseObject();
    expect(obj2.kind).toBe('number');
    expect((obj2 as PdfNumber).value).toBe(3);
  });

  it('returns PdfNumber for negative numbers (not ref start)', () => {
    const obj = parse('-5');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(-5);
  });

  it('returns PdfNumber for real numbers (not ref start)', () => {
    const obj = parse('3.14');
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBeCloseTo(3.14, 5);
  });
});

// ---------------------------------------------------------------------------
// Indirect object definitions (N G obj ... endobj)
// ---------------------------------------------------------------------------

describe('PdfObjectParser - indirect object definitions', () => {
  it('parses a simple indirect object (number)', () => {
    const { parser, registry } = createParser('5 0 obj 42 endobj');
    const { ref, object } = parser.parseIndirectObject();
    expect(ref.objectNumber).toBe(5);
    expect(ref.generationNumber).toBe(0);
    expect(object.kind).toBe('number');
    expect((object as PdfNumber).value).toBe(42);
  });

  it('parses an indirect object containing a string', () => {
    const { parser } = createParser('1 0 obj (Hello World) endobj');
    const { ref, object } = parser.parseIndirectObject();
    expect(ref.objectNumber).toBe(1);
    expect(object.kind).toBe('string');
    expect((object as PdfString).value).toBe('Hello World');
  });

  it('parses an indirect object containing null', () => {
    const { parser } = createParser('3 0 obj null endobj');
    const { ref, object } = parser.parseIndirectObject();
    expect(ref.objectNumber).toBe(3);
    expect(object).toBe(PdfNull.instance);
  });

  it('parses an indirect object containing a boolean', () => {
    const { parser } = createParser('7 0 obj true endobj');
    const { object } = parser.parseIndirectObject();
    expect(object.kind).toBe('bool');
    expect((object as PdfBool).value).toBe(true);
  });

  it('parses an indirect object containing a name', () => {
    const { parser } = createParser('2 0 obj /SomeValue endobj');
    const { object } = parser.parseIndirectObject();
    expect(object.kind).toBe('name');
    expect((object as PdfName).value).toBe('/SomeValue');
  });

  it('parses an indirect object containing an array', () => {
    const { parser } = createParser('4 0 obj [1 2 3] endobj');
    const { object } = parser.parseIndirectObject();
    expect(object.kind).toBe('array');
    expect((object as PdfArray).length).toBe(3);
  });

  it('parses an indirect object containing a dictionary', () => {
    const { parser } = createParser(
      '6 0 obj << /Type /Page /Count 1 >> endobj',
    );
    const { ref, object } = parser.parseIndirectObject();
    expect(ref.objectNumber).toBe(6);
    expect(object.kind).toBe('dict');
    const dict = object as PdfDict;
    expect((dict.get('/Type') as PdfName).value).toBe('/Page');
    expect((dict.get('/Count') as PdfNumber).value).toBe(1);
  });

  it('registers parsed object in the registry', () => {
    const { parser, registry } = createParser('10 0 obj 99 endobj');
    const { ref } = parser.parseIndirectObject();

    const resolved = registry.resolve(ref);
    expect(resolved).toBeDefined();
    expect(resolved!.kind).toBe('number');
    expect((resolved as PdfNumber).value).toBe(99);
  });

  it('throws on missing obj keyword', () => {
    const { parser } = createParser('5 0 42 endobj');
    expect(() => parser.parseIndirectObject()).toThrow(/expected.*obj/i);
  });

  it('throws on missing endobj keyword', () => {
    const { parser } = createParser('5 0 obj 42');
    expect(() => parser.parseIndirectObject()).toThrow(/expected.*endobj/i);
  });

  it('throws when object number is not an integer', () => {
    const { parser } = createParser('3.5 0 obj 42 endobj');
    expect(() => parser.parseIndirectObject()).toThrow(
      /expected integer object number/i,
    );
  });

  it('throws when generation number is not an integer', () => {
    const { parser } = createParser('3 0.5 obj 42 endobj');
    expect(() => parser.parseIndirectObject()).toThrow(
      /expected integer generation number/i,
    );
  });
});

// ---------------------------------------------------------------------------
// parseObjectAt() and parseIndirectObjectAt()
// ---------------------------------------------------------------------------

describe('PdfObjectParser - parseObjectAt / parseIndirectObjectAt', () => {
  it('parseObjectAt seeks and parses', () => {
    // "    42" — object starts at offset 4
    const { parser } = createParser('    42');
    const obj = parser.parseObjectAt(4);
    expect(obj.kind).toBe('number');
    expect((obj as PdfNumber).value).toBe(42);
  });

  it('parseIndirectObjectAt seeks and parses indirect object', () => {
    const input = '     5 0 obj (Hello) endobj';
    const { parser, registry } = createParser(input);
    const { ref, object } = parser.parseIndirectObjectAt(5);
    expect(ref.objectNumber).toBe(5);
    expect(object.kind).toBe('string');
    expect((object as PdfString).value).toBe('Hello');

    // Also should be registered
    expect(registry.resolve(ref)).toBe(object);
  });
});

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

describe('PdfObjectParser - streams', () => {
  it('parses a stream with direct /Length', () => {
    // The stream data is 5 bytes: "Hello"
    const input = '1 0 obj\n<< /Length 5 >>\nstream\nHello\nendstream\nendobj';
    const { parser, registry } = createParser(input);
    const { ref, object } = parser.parseIndirectObject();

    expect(ref.objectNumber).toBe(1);
    expect(object.kind).toBe('stream');

    const stream = object as PdfStream;
    expect(stream.dict.get('/Length')).toBeDefined();
    expect((stream.dict.get('/Length') as PdfNumber).value).toBe(5);

    // Verify stream data
    const dataStr = new TextDecoder().decode(stream.data);
    expect(dataStr).toBe('Hello');
  });

  it('parses a stream with CRLF after stream keyword', () => {
    // Build the bytes manually to ensure CRLF after "stream"
    const header = '1 0 obj\n<< /Length 5 >>\nstream\r\n';
    const body = 'Hello';
    const footer = '\nendstream\nendobj';
    const input = header + body + footer;
    const { parser } = createParser(input);
    const { object } = parser.parseIndirectObject();

    expect(object.kind).toBe('stream');
    const stream = object as PdfStream;
    const dataStr = new TextDecoder().decode(stream.data);
    expect(dataStr).toBe('Hello');
  });

  it('parses a stream with zero-length data', () => {
    const input = '2 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj';
    const { parser } = createParser(input);
    const { object } = parser.parseIndirectObject();

    expect(object.kind).toBe('stream');
    const stream = object as PdfStream;
    expect(stream.data).toHaveLength(0);
  });

  it('throws when /Length is missing from stream dict', () => {
    const input = '3 0 obj\n<< /Type /XObject >>\nstream\ndata\nendstream\nendobj';
    const { parser } = createParser(input);
    expect(() => parser.parseIndirectObject()).toThrow(
      /missing \/Length/i,
    );
  });

  it('parses stream that appears as value inside parseObject flow', () => {
    // When parseObject reads a number, then another number, then "obj",
    // it delegates to parseIndirectObjectBody which can handle streams.
    const input = '5 0 obj << /Length 3 >> stream\nABC\nendstream endobj';
    const { parser, registry } = createParser(input);
    const obj = parser.parseObject();

    // The indirect object body returns the parsed object itself
    expect(obj.kind).toBe('stream');
    const stream = obj as PdfStream;
    const dataStr = new TextDecoder().decode(stream.data);
    expect(dataStr).toBe('ABC');
  });
});

// ---------------------------------------------------------------------------
// Nested structures
// ---------------------------------------------------------------------------

describe('PdfObjectParser - nested structures', () => {
  it('parses dict containing array containing dict', () => {
    const input = '<< /Kids [<< /Type /Page >>] >>';
    const obj = parse(input);
    const dict = obj as PdfDict;
    const kids = dict.get('/Kids') as PdfArray;
    expect(kids.kind).toBe('array');
    expect(kids.length).toBe(1);
    const page = kids.items[0] as PdfDict;
    expect(page.kind).toBe('dict');
    expect((page.get('/Type') as PdfName).value).toBe('/Page');
  });

  it('parses deeply nested dicts', () => {
    const input = '<< /A << /B << /C 42 >> >> >>';
    const obj = parse(input);
    const a = obj as PdfDict;
    const b = a.get('/A') as PdfDict;
    const c = b.get('/B') as PdfDict;
    expect((c.get('/C') as PdfNumber).value).toBe(42);
  });

  it('parses deeply nested arrays', () => {
    const input = '[[[1]]]';
    const obj = parse(input) as PdfArray;
    const inner1 = obj.items[0] as PdfArray;
    const inner2 = inner1.items[0] as PdfArray;
    expect((inner2.items[0] as PdfNumber).value).toBe(1);
  });

  it('parses array with refs and names mixed', () => {
    const input = '[/Name1 5 0 R /Name2 10 0 R]';
    const arr = parse(input) as PdfArray;
    expect(arr.length).toBe(4);
    expect(arr.items[0]!.kind).toBe('name');
    expect(arr.items[1]!.kind).toBe('ref');
    expect(arr.items[2]!.kind).toBe('name');
    expect(arr.items[3]!.kind).toBe('ref');
  });

  it('parses a typical page dictionary', () => {
    const input = `<< /Type /Page
      /Parent 2 0 R
      /MediaBox [0 0 612 792]
      /Contents 4 0 R
      /Resources << /Font << /F1 5 0 R >> >>
    >>`;
    const dict = parse(input) as PdfDict;
    expect((dict.get('/Type') as PdfName).value).toBe('/Page');
    expect((dict.get('/Parent') as PdfRef).objectNumber).toBe(2);
    const mediaBox = dict.get('/MediaBox') as PdfArray;
    expect(mediaBox.length).toBe(4);
    expect((dict.get('/Contents') as PdfRef).objectNumber).toBe(4);
    const resources = dict.get('/Resources') as PdfDict;
    const font = resources.get('/Font') as PdfDict;
    expect((font.get('/F1') as PdfRef).objectNumber).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

describe('PdfObjectParser - registry integration', () => {
  it('registers indirect objects with correct ref', () => {
    const { parser, registry } = createParser('10 0 obj (test) endobj');
    const { ref } = parser.parseIndirectObject();

    expect(ref.objectNumber).toBe(10);
    expect(ref.generationNumber).toBe(0);

    const resolved = registry.resolve(PdfRef.of(10, 0));
    expect(resolved).toBeDefined();
    expect(resolved!.kind).toBe('string');
    expect((resolved as PdfString).value).toBe('test');
  });

  it('registers multiple indirect objects', () => {
    const input = '1 0 obj 100 endobj 2 0 obj 200 endobj';
    const { parser, registry } = createParser(input);

    parser.parseIndirectObject();
    parser.parseIndirectObject();

    const obj1 = registry.resolve(PdfRef.of(1));
    expect(obj1).toBeDefined();
    expect((obj1 as PdfNumber).value).toBe(100);

    const obj2 = registry.resolve(PdfRef.of(2));
    expect(obj2).toBeDefined();
    expect((obj2 as PdfNumber).value).toBe(200);
  });

  it('registers stream objects correctly', () => {
    const input = '1 0 obj << /Length 4 >> stream\ntest\nendstream endobj';
    const { parser, registry } = createParser(input);
    const { ref } = parser.parseIndirectObject();

    const resolved = registry.resolve(ref);
    expect(resolved).toBeDefined();
    expect(resolved!.kind).toBe('stream');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('PdfObjectParser - error handling', () => {
  it('throws on unexpected EOF', () => {
    expect(() => parse('')).toThrow(/unexpected end of input/i);
  });

  it('throws on unexpected token type', () => {
    // "endobj" as the first thing in parseObject is unexpected
    expect(() => parse('endobj')).toThrow(/unexpected token/i);
  });

  it('throws on unexpected keyword in dict key position', () => {
    // Using a non-name token as dict key
    expect(() => parse('<< true (value) >>')).toThrow(/expected name/i);
  });

  it('throws when /Length is a non-number in stream', () => {
    const input =
      '1 0 obj << /Length (five) >> stream\nHello\nendstream endobj';
    const { parser } = createParser(input);
    expect(() => parser.parseIndirectObject()).toThrow(/\/Length/i);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('PdfObjectParser - edge cases', () => {
  it('parses dict with hex string values', () => {
    const obj = parse('<< /ID <48656C6C6F> >>');
    const dict = obj as PdfDict;
    const id = dict.get('/ID') as PdfString;
    expect(id.hex).toBe(true);
    expect(id.value).toBe('Hello');
  });

  it('parses empty dict (no whitespace between delimiters)', () => {
    const obj = parse('<<>>');
    expect(obj.kind).toBe('dict');
    expect((obj as PdfDict).size).toBe(0);
  });

  it('parses empty array with no whitespace', () => {
    const obj = parse('[]');
    expect(obj.kind).toBe('array');
    expect((obj as PdfArray).length).toBe(0);
  });

  it('parses array with only whitespace inside', () => {
    const obj = parse('[   ]');
    expect(obj.kind).toBe('array');
    expect((obj as PdfArray).length).toBe(0);
  });

  it('parses dict with heavy whitespace', () => {
    const obj = parse('<<   /Key   42   >>');
    const dict = obj as PdfDict;
    expect(dict.size).toBe(1);
    expect((dict.get('/Key') as PdfNumber).value).toBe(42);
  });

  it('handles consecutive indirect objects parsed sequentially', () => {
    const input =
      '1 0 obj /Foo endobj\n' +
      '2 0 obj /Bar endobj\n' +
      '3 0 obj /Baz endobj';
    const { parser, registry } = createParser(input);

    parser.parseIndirectObject();
    parser.parseIndirectObject();
    parser.parseIndirectObject();

    expect((registry.resolve(PdfRef.of(1)) as PdfName).value).toBe('/Foo');
    expect((registry.resolve(PdfRef.of(2)) as PdfName).value).toBe('/Bar');
    expect((registry.resolve(PdfRef.of(3)) as PdfName).value).toBe('/Baz');
  });

  it('parses dict with ref to already-registered /Length for stream', () => {
    // Pre-register object 10 as the length value
    const lexer = new PdfLexer(
      bytes('1 0 obj << /Length 10 0 R >> stream\n12345\nendstream endobj'),
    );
    const registry = new PdfObjectRegistry();
    // Register the length object (obj num 10 = PdfNumber(5))
    registry.registerWithRef(PdfRef.of(10), PdfNumber.of(5));

    const parser = new PdfObjectParser(lexer, registry);
    const { object } = parser.parseIndirectObject();

    expect(object.kind).toBe('stream');
    const stream = object as PdfStream;
    expect(stream.data).toHaveLength(5);
    expect(new TextDecoder().decode(stream.data)).toBe('12345');
  });

  it('throws when /Length ref is not yet resolved', () => {
    // Object 99 is not in the registry
    const input =
      '1 0 obj << /Length 99 0 R >> stream\ndata\nendstream endobj';
    const { parser } = createParser(input);
    expect(() => parser.parseIndirectObject()).toThrow(
      /not yet.*resolved/i,
    );
  });

  it('correctly parses number followed by non-ref context', () => {
    // "5 /Name" — 5 is a number, not part of a ref
    const { parser } = createParser('5 /Name');
    const obj1 = parser.parseObject();
    expect(obj1.kind).toBe('number');
    expect((obj1 as PdfNumber).value).toBe(5);

    const obj2 = parser.parseObject();
    expect(obj2.kind).toBe('name');
  });
});

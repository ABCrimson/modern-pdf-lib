/**
 * encodeTextForFontName: the codes of text for a font known only by the name its resource has.
 * showEncodedText: the operator that shows those codes, ASCII only.
 */
import { describe, expect, test } from 'vitest';
import { UnencodableTextError } from '../../../src/errors.js';
import {
  encodedStringLiteral,
  encodeTextForFontName,
  showEncodedText,
} from '../../../src/internal/standardText.js';

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

describe('encodeTextForFontName', () => {
  test('encodes "Größe €" for a standard font name in WinAnsiEncoding', () => {
    const codes = [0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0x80];
    for (const name of ['Helvetica', 'Times-Roman', 'Courier-BoldOblique']) {
      expect([...encodeTextForFontName(name, 'Größe €')]).toEqual(codes);
    }
  });

  test('encodes in WinAnsiEncoding for a name that is no standard font', () => {
    expect([...encodeTextForFontName('F1', 'Größe €')]).toEqual([
      0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0x80,
    ]);
    expect([...encodeTextForFontName('', 'é')]).toEqual([0xe9]);
  });

  test('encodes Symbol and ZapfDingbats text in their own encodings, by name and by AcroForm alias', () => {
    expect([...encodeTextForFontName('Symbol', 'αβγ')]).toEqual([0x61, 0x62, 0x67]);
    expect([...encodeTextForFontName('Symb', 'αβγ')]).toEqual([0x61, 0x62, 0x67]);
    expect([...encodeTextForFontName('ZapfDingbats', '✓')]).toEqual([0x33]);
    expect([...encodeTextForFontName('ZaDb', '✓')]).toEqual([0x33]);
  });

  test('takes each of the 14 AcroForm aliases to a Latin font except Symb and ZaDb', () => {
    const aliases = [
      'Helv',
      'HeBo',
      'HeOb',
      'HeBO',
      'TiRo',
      'TiBo',
      'TiIt',
      'TiBI',
      'Cour',
      'CoBo',
      'CoOb',
      'CoBO',
    ];
    for (const alias of aliases) {
      expect([...encodeTextForFontName(alias, 'é€')]).toEqual([0xe9, 0x80]);
    }
  });

  test('normalises standard-font text to NFC', () => {
    expect([...encodeTextForFontName('Helvetica', 'cafe\u0301')]).toEqual([0x63, 0x61, 0x66, 0xe9]);
  });

  test('throws UnencodableTextError for a character the encoding lacks', () => {
    const error = caught(() => encodeTextForFontName('Helvetica', 'ab日'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({ character: '日', index: 2, encoding: 'WinAnsiEncoding' });
    expect(caught(() => encodeTextForFontName('F1', '日'))).toBeInstanceOf(UnencodableTextError);
  });
});

describe('encodedStringLiteral', () => {
  test('is the string of showEncodedText without the operator', () => {
    const codes = Uint8Array.of(0x41, 0x28, 0xe9);
    expect(encodedStringLiteral(codes)).toBe('(A\\(\\351)');
    expect(showEncodedText(codes)).toBe(`${encodedStringLiteral(codes)} Tj\n`);
  });
});

describe('showEncodedText', () => {
  test('shows printable ASCII as it is, with ( ) and the backslash escaped', () => {
    expect(showEncodedText(new TextEncoder().encode('Hello'))).toBe('(Hello) Tj\n');
    expect(showEncodedText(new TextEncoder().encode('a(b)c\\d'))).toBe('(a\\(b\\)c\\\\d) Tj\n');
    expect(showEncodedText(new Uint8Array())).toBe('() Tj\n');
  });

  test('shows a byte above 0x7E as a 3-digit octal escape', () => {
    expect(showEncodedText(Uint8Array.of(0xf6, 0xdf, 0x80, 0x7f))).toBe(
      '(\\366\\337\\200\\177) Tj\n',
    );
  });

  test('shows CR, LF, TAB, BS and FF as their two-character escapes and other controls in octal', () => {
    expect(showEncodedText(Uint8Array.of(0x0d, 0x0a, 0x09, 0x08, 0x0c, 0x00, 0x1f))).toBe(
      '(\\r\\n\\t\\b\\f\\000\\037) Tj\n',
    );
  });

  test('writes ASCII only for every byte value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(showEncodedText(all)).toMatch(/^[\x20-\x7e\n]*$/);
  });
});

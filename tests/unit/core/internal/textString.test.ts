/**
 * Tests for the PDF text-string codec (ISO 32000-2 7.9.2.2 and Annex D).
 *
 * The PDFDocEncoding table is checked against a second transcription of Table D.2 held here:
 * the codes whose character differs from the Latin-1 character of the same code, with their glyph
 * names, and the ranges where the code is the code point. Every defined code is decoded and
 * encoded in both directions. The encoder's "auto" choice, the explicit encodings, the errors and
 * the handling of ill-formed input are those the module header of src/core/internal/textString.ts
 * states; the oracle test tests/oracle/text-string.test.ts holds the same decoder against pdf.js
 * and qpdf.
 */
import { describe, expect, test } from 'vitest';
import {
  decodeTextString,
  encodeTextString,
  PDF_DOC_ENCODING,
  textStringEncoding,
} from '../../../../src/core/internal/textString.js';
import type { TextStringWriteEncoding } from '../../../../src/core/internal/textString.js';
import { InvalidArgumentError, UnencodableTextError } from '../../../../src/errors.js';

/** ISO 32000-2 Table D.2: the PDFDocEncoding codes whose character is not U+0000 plus the code. */
const NOT_LATIN1: readonly (readonly [code: number, glyph: string, unicode: number])[] = [
  [0x18, 'breve', 0x02d8],
  [0x19, 'caron', 0x02c7],
  [0x1a, 'circumflex', 0x02c6],
  [0x1b, 'dotaccent', 0x02d9],
  [0x1c, 'hungarumlaut', 0x02dd],
  [0x1d, 'ogonek', 0x02db],
  [0x1e, 'ring', 0x02da],
  [0x1f, 'tilde', 0x02dc],
  [0x80, 'bullet', 0x2022],
  [0x81, 'dagger', 0x2020],
  [0x82, 'daggerdbl', 0x2021],
  [0x83, 'ellipsis', 0x2026],
  [0x84, 'emdash', 0x2014],
  [0x85, 'endash', 0x2013],
  [0x86, 'florin', 0x0192],
  [0x87, 'fraction', 0x2044],
  [0x88, 'guilsinglleft', 0x2039],
  [0x89, 'guilsinglright', 0x203a],
  [0x8a, 'minus', 0x2212],
  [0x8b, 'perthousand', 0x2030],
  [0x8c, 'quotedblbase', 0x201e],
  [0x8d, 'quotedblleft', 0x201c],
  [0x8e, 'quotedblright', 0x201d],
  [0x8f, 'quoteleft', 0x2018],
  [0x90, 'quoteright', 0x2019],
  [0x91, 'quotesinglbase', 0x201a],
  [0x92, 'trademark', 0x2122],
  [0x93, 'fi', 0xfb01],
  [0x94, 'fl', 0xfb02],
  [0x95, 'Lslash', 0x0141],
  [0x96, 'OE', 0x0152],
  [0x97, 'Scaron', 0x0160],
  [0x98, 'Ydieresis', 0x0178],
  [0x99, 'Zcaron', 0x017d],
  [0x9a, 'dotlessi', 0x0131],
  [0x9b, 'lslash', 0x0142],
  [0x9c, 'oe', 0x0153],
  [0x9d, 'scaron', 0x0161],
  [0x9e, 'zcaron', 0x017e],
  [0xa0, 'Euro', 0x20ac],
];

/** Table D.2: the codes whose character is U+0000 plus the code (TAB, LF, CR, ASCII, Latin-1). */
const LATIN1_CODES: readonly number[] = [
  0x09,
  0x0a,
  0x0d,
  ...range(0x20, 0x7e),
  ...range(0xa1, 0xac),
  ...range(0xae, 0xff),
];

/** Every code Table D.2 defines, and the character of each. */
const DEFINED = new Map<number, number>([
  ...LATIN1_CODES.map((c): [number, number] => [c, c]),
  ...NOT_LATIN1.map(([code, , unicode]): [number, number] => [code, unicode]),
]);

/** The codes Table D.2 leaves undefined: C0 controls but TAB, LF, CR; 0x7F; 0x9F; 0xAD. */
const UNDEFINED: readonly number[] = range(0x00, 0xff).filter((c) => !DEFINED.has(c));

/** Every character of Table D.2, in code order. */
const ANNEX_D_TEXT = [...DEFINED]
  .toSorted(([a], [b]) => a - b)
  .map(([, unicode]) => String.fromCodePoint(unicode))
  .join('');

/** 0x1B: Table D.2 makes it dotaccent, but in a text string it opens a language escape. */
const ESCAPE = 0x1b;

/** The defined codes a text string reads and writes as their Table D.2 character: all but 0x1B. */
const PDF_DOC_TEXT_CODES = new Map([...DEFINED].filter(([code]) => code !== ESCAPE));

/** Every character "pdfdoc" writes: Table D.2 but dotaccent, in code order. */
const PDF_DOC_TEXT = ANNEX_D_TEXT.replace('˙', '');

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const hex = (data: Uint8Array): string => data.toHex().toUpperCase();
const fromHex = (digits: string): Uint8Array => Uint8Array.fromHex(digits.replaceAll(' ', ''));

/** The error `fn` throws (the test fails when it returns). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

describe('PDF_DOC_ENCODING (ISO 32000-2 Table D.2)', () => {
  test('defines 232 codes, each the character of the transcription above', () => {
    expect(PDF_DOC_ENCODING).toHaveLength(256);
    expect(DEFINED.size).toBe(232);
    for (let code = 0; code < 256; code++) {
      expect(PDF_DOC_ENCODING[code], `code 0x${code.toString(16)}`).toBe(DEFINED.get(code));
    }
  });

  test('leaves 24 codes undefined: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x17, 0x7F, 0x9F, 0xAD', () => {
    expect(UNDEFINED).toEqual([
      ...range(0x00, 0x08),
      0x0b,
      0x0c,
      ...range(0x0e, 0x17),
      0x7f,
      0x9f,
      0xad,
    ]);
  });

  test('maps no two codes to one character', () => {
    const characters = PDF_DOC_ENCODING.filter((u) => u !== undefined);
    expect(new Set(characters).size).toBe(characters.length);
  });
});

describe('textStringEncoding', () => {
  test.each([
    ['FEFF0041', 'utf-16be'],
    ['FEFF', 'utf-16be'],
    ['FFFE4100', 'utf-16le'],
    ['FFFE', 'utf-16le'],
    ['EFBBBF41', 'utf-8'],
    ['EFBBBF', 'utf-8'],
    ['', 'pdfdoc'],
    ['FE', 'pdfdoc'],
    ['FE41', 'pdfdoc'],
    ['FF', 'pdfdoc'],
    ['EFBB', 'pdfdoc'],
    ['EFBB41', 'pdfdoc'],
    ['00FEFF', 'pdfdoc'],
  ])('%s is %s', (digits, encoding) => {
    expect(textStringEncoding(fromHex(digits))).toBe(encoding);
  });
});

describe('decodeTextString: PDFDocEncoding', () => {
  test('decodes every defined code but 0x1B to its Table D.2 character', () => {
    for (const [code, unicode] of PDF_DOC_TEXT_CODES) {
      expect(decodeTextString(bytes(code)), `code 0x${code.toString(16)}`).toBe(
        String.fromCodePoint(unicode),
      );
    }
  });

  test('decodes an undefined code to U+0000 plus the code, as pdf.js does', () => {
    for (const code of UNDEFINED) {
      expect(decodeTextString(bytes(0x61, code, 0x62))).toBe(`a${String.fromCharCode(code)}b`);
    }
  });

  test('reads 0x1B as a language escape, as pdf.js does', () => {
    expect(decodeTextString(bytes(0x61, 0x1b, 0x65, 0x6e, 0x1b, 0x62))).toBe('ab');
    expect(decodeTextString(bytes(0x61, 0x1b, 0x62))).toBe('a');
    expect(decodeTextString(bytes(0x1b, 0x61, 0x1b, 0x62))).toBe('b');
  });

  test('decodes the empty string and bytes that only begin like a byte order mark', () => {
    expect(decodeTextString(bytes())).toBe('');
    expect(decodeTextString(fromHex('FE'))).toBe('þ');
    expect(decodeTextString(fromHex('FF41'))).toBe('ÿA');
    expect(decodeTextString(fromHex('EFBB41'))).toBe('ï»A');
  });
});

describe('decodeTextString: UTF-16BE, UTF-16LE and UTF-8', () => {
  test('UTF-16BE after FE FF, surrogate pairs whole', () => {
    expect(decodeTextString(fromHex('FEFF 0043 0061 0066 00E9'))).toBe('Café');
    expect(decodeTextString(fromHex('FEFF 65E5 672C 8A9E 0020 20AC'))).toBe('日本語 €');
    expect(decodeTextString(fromHex('FEFF D83D DE00 0021'))).toBe('😀!');
  });

  test('UTF-16LE after FF FE (read only, as pdf.js reads it)', () => {
    expect(decodeTextString(fromHex('FFFE 4300 6100 6600 E900'))).toBe('Café');
    expect(decodeTextString(fromHex('FFFE 3DD8 00DE'))).toBe('😀');
  });

  test('UTF-8 after EF BB BF', () => {
    expect(decodeTextString(fromHex('EFBBBF 436166C3A9 20 E697A5 20 F09F9880'))).toBe('Café 日 😀');
  });

  test('the byte order mark alone is the empty text; a second one stays U+FEFF', () => {
    expect(decodeTextString(fromHex('FEFF'))).toBe('');
    expect(decodeTextString(fromHex('FFFE'))).toBe('');
    expect(decodeTextString(fromHex('EFBBBF'))).toBe('');
    expect(decodeTextString(fromHex('FEFF FEFF 0041'))).toBe('﻿A');
    expect(decodeTextString(fromHex('FFFE FFFE 4100'))).toBe('﻿A');
    expect(decodeTextString(fromHex('EFBBBF EFBBBF 41'))).toBe('﻿A');
  });

  test('an odd trailing byte of a UTF-16 string is dropped', () => {
    expect(decodeTextString(fromHex('FEFF 0043 00'))).toBe('C');
    expect(decodeTextString(fromHex('FEFF 00'))).toBe('');
    expect(decodeTextString(fromHex('FFFE 4300 6100 62'))).toBe('Ca');
  });

  test('an ill-formed sequence decodes to U+FFFD, never switching encoding', () => {
    expect(decodeTextString(fromHex('FEFF D83D 0041'))).toBe('�A');
    expect(decodeTextString(fromHex('FEFF DE00 0041'))).toBe('�A');
    expect(decodeTextString(fromHex('FEFF DE00 D83D'))).toBe('��');
    expect(decodeTextString(fromHex('FEFF 0041 D83D'))).toBe('A�');
    expect(decodeTextString(fromHex('FFFE 3DD8 4100'))).toBe('�A');
    expect(decodeTextString(fromHex('EFBBBF 41 C3'))).toBe('A�');
    expect(decodeTextString(fromHex('EFBBBF C0AF 41'))).toBe('��A');
    expect(decodeTextString(fromHex('EFBBBF EDA080 41'))).toBe('���A');
    expect(decodeTextString(fromHex('EFBBBF F09F98 41'))).toBe('�A');
  });

  test('language escapes (U+001B ... U+001B) are removed; an unclosed one runs to the end', () => {
    expect(decodeTextString(fromHex('FEFF 001B 656E 001B 0043 0061 0066 00E9'))).toBe('Café');
    expect(decodeTextString(fromHex('FEFF 001B 656E 5553 001B 0048 0069'))).toBe('Hi');
    expect(decodeTextString(fromHex('FEFF 0041 001B 656E'))).toBe('A');
    expect(decodeTextString(fromHex('FFFE 1B00 6E65 1B00 4100'))).toBe('A');
    expect(decodeTextString(fromHex('EFBBBF 1B 656E 1B 41'))).toBe('A');
  });

  test('decodes a UTF-16BE string of 1,000,000 code units', () => {
    const units = 1_000_000;
    const data = new Uint8Array(2 + 2 * units);
    data.set([0xfe, 0xff]);
    for (let i = 0; i < units; i++) data.set([0x4e, (i % 26) + 0x41], 2 + 2 * i);
    const text = decodeTextString(data);
    expect(text).toHaveLength(units);
    expect(text.slice(0, 3)).toBe('乁乂乃');
    expect(text.at(-1)).toBe(String.fromCharCode(0x4e00 + ((units - 1) % 26) + 0x41));
  });
});

describe('encodeTextString', () => {
  test('"pdfdoc" writes the Table D.2 code of every defined character but dotaccent', () => {
    for (const [code, unicode] of PDF_DOC_TEXT_CODES) {
      expect(hex(encodeTextString(String.fromCodePoint(unicode), 'pdfdoc'))).toBe(hex(bytes(code)));
    }
  });

  test('every character of Annex D round-trips through each write encoding ("pdfdoc": but dotaccent)', () => {
    const encodings: readonly TextStringWriteEncoding[] = ['auto', 'pdfdoc', 'utf-16be', 'utf-8'];
    for (const encoding of encodings) {
      const table = encoding === 'pdfdoc' ? PDF_DOC_TEXT_CODES : DEFINED;
      for (const unicode of table.values()) {
        const text = `x${String.fromCodePoint(unicode)}y`;
        expect(decodeTextString(encodeTextString(text, encoding)), `${encoding} ${text}`).toBe(
          text,
        );
      }
      const all = encoding === 'pdfdoc' ? PDF_DOC_TEXT : ANNEX_D_TEXT;
      expect(decodeTextString(encodeTextString(all, encoding))).toBe(all);
    }
  });

  test('"auto" writes dotaccent in UTF-16BE, since PDFDocEncoding 0x1B reads as a language escape', () => {
    expect(hex(encodeTextString('˙'))).toBe('FEFF02D9');
    expect(hex(encodeTextString('a˙b'))).toBe('FEFF006102D90062');
  });

  test('"pdfdoc" throws UnencodableTextError at the index of dotaccent', () => {
    const error = thrownBy(() => encodeTextString('Ab˙c', 'pdfdoc'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({
      character: '˙',
      codePoint: 0x02d9,
      index: 2,
      encoding: 'PDF text string',
    });
  });

  test('"auto" (the default) writes PDFDocEncoding when every character is in Table D.2', () => {
    expect(hex(encodeTextString('Café – € “x” Š'))).toBe('436166E9208520A0208D788E2097');
    expect(hex(encodeTextString('Café – € “x” Š'))).toBe(
      hex(encodeTextString('Café – € “x” Š', 'auto')),
    );
    expect(hex(encodeTextString('Plain ASCII (1)'))).toBe(
      hex(new TextEncoder().encode('Plain ASCII (1)')),
    );
    expect(hex(encodeTextString('a\tb\nc\rd'))).toBe('6109620A630D64');
    expect(hex(encodeTextString(''))).toBe('');
    expect(hex(encodeTextString(PDF_DOC_TEXT))).toBe(hex(encodeTextString(PDF_DOC_TEXT, 'pdfdoc')));
  });

  test('"auto" writes UTF-16BE when the PDFDocEncoding bytes would begin with a byte order mark', () => {
    for (const text of ['þÿ', 'þÿab', 'ÿþ', 'ÿþab', 'ï»¿', 'ï»¿x']) {
      const encoded = encodeTextString(text);
      expect(hex(encoded.subarray(0, 2)), text).toBe('FEFF');
      expect(decodeTextString(encoded)).toBe(text);
    }
    expect(hex(encodeTextString('aþÿ'))).toBe('61FEFF');
    expect(hex(encodeTextString('ï»'))).toBe('EFBB');
  });

  test('"auto" writes UTF-16BE for a character outside Table D.2, controls but TAB, LF, CR included', () => {
    expect(hex(encodeTextString('日本語 €'))).toBe('FEFF65E5672C8A9E002020AC');
    expect(hex(encodeTextString('😀 astral'))).toBe('FEFFD83DDE00002000610073007400720061006C');
    for (const code of UNDEFINED) {
      const text = `a${String.fromCharCode(code)}`;
      expect(hex(encodeTextString(text)), `U+${code.toString(16)}`).toBe(
        `FEFF0061${code.toString(16).toUpperCase().padStart(4, '0')}`,
      );
    }
  });

  test('"utf-16be" and "utf-8" write their byte order mark and the whole text', () => {
    expect(hex(encodeTextString('Aé😀', 'utf-16be'))).toBe('FEFF004100E9D83DDE00');
    expect(hex(encodeTextString('', 'utf-16be'))).toBe('FEFF');
    expect(hex(encodeTextString('Aé😀', 'utf-8'))).toBe('EFBBBF41C3A9F09F9880');
    expect(hex(encodeTextString('', 'utf-8'))).toBe('EFBBBF');
    expect(hex(encodeTextString('﻿A', 'utf-8'))).toBe('EFBBBFEFBBBF41');
  });

  test('returns a new array over its own ArrayBuffer', () => {
    const a = encodeTextString('abc');
    const b = encodeTextString('abc');
    expect(a).not.toBe(b);
    expect(a.buffer).toBeInstanceOf(ArrayBuffer);
    expect(a.byteLength).toBe(a.buffer.byteLength);
  });

  test('a lone surrogate throws UnencodableTextError ("PDF text string") in every encoding', () => {
    const encodings: readonly TextStringWriteEncoding[] = ['auto', 'pdfdoc', 'utf-16be', 'utf-8'];
    for (const encoding of encodings) {
      for (const [text, character, index] of [
        ['ab\ud800c', '\ud800', 2],
        ['\udc00', '\udc00', 0],
        ['😀\ud83d', '\ud83d', 2],
      ] as const) {
        const error = thrownBy(() => encodeTextString(text, encoding));
        expect(error, `${encoding} ${index}`).toBeInstanceOf(UnencodableTextError);
        expect(error).toMatchObject({
          code: 'unencodable-text',
          character,
          codePoint: character.charCodeAt(0),
          index,
          fontName: undefined,
          encoding: 'PDF text string',
        });
      }
    }
  });

  test('U+001B throws UnencodableTextError ("PDF text string") in every encoding, since it reads back as a language escape', () => {
    const encodings: readonly TextStringWriteEncoding[] = ['auto', 'pdfdoc', 'utf-16be', 'utf-8'];
    for (const encoding of encodings) {
      for (const [text, character, index] of [
        ['a\u001bb', '\u001b', 1],
        ['\u001b', '\u001b', 0],
        ['日\u001b\ud800', '\u001b', 1],
        ['\ud800\u001b', '\ud800', 0],
      ] as const) {
        const error = thrownBy(() => encodeTextString(text, encoding));
        expect(error, `${encoding} ${index}`).toBeInstanceOf(UnencodableTextError);
        expect(error).toMatchObject({ character, index, encoding: 'PDF text string' });
      }
    }
  });

  test('"pdfdoc" throws InvalidArgumentError when its bytes would begin with a byte order mark', () => {
    for (const text of ['þÿ', 'þÿab', 'ÿþ', 'ï»¿', 'ï»¿x']) {
      const error = thrownBy(() => encodeTextString(text, 'pdfdoc'));
      expect(error, text).toBeInstanceOf(InvalidArgumentError);
      expect(error).toMatchObject({ code: 'invalid-argument', argument: 'encoding' });
      expect((error as Error).message).toContain('byte order mark');
    }
    expect(hex(encodeTextString('aþÿ', 'pdfdoc'))).toBe('61FEFF');
    expect(hex(encodeTextString('ï»', 'pdfdoc'))).toBe('EFBB');
  });

  test('"pdfdoc" throws UnencodableTextError at the first character outside Table D.2', () => {
    for (const [text, character, index] of [
      ['Café 日本', '日', 5],
      ['a😀b', '😀', 1],
      ['\u007f', '\u007f', 0],
      ['x­', '­', 1],
      ['é\u001b', '\u001b', 1],
    ] as const) {
      const error = thrownBy(() => encodeTextString(text, 'pdfdoc'));
      expect(error).toBeInstanceOf(UnencodableTextError);
      expect(error).toMatchObject({
        character,
        codePoint: character.codePointAt(0),
        index,
        encoding: 'PDF text string',
      });
    }
  });

  test('"utf-16le" and an unknown encoding throw InvalidArgumentError (argument "encoding")', () => {
    for (const encoding of ['utf-16le', 'latin1', 'UTF-8', '']) {
      const error = thrownBy(() =>
        encodeTextString('a', encoding as unknown as TextStringWriteEncoding),
      );
      expect(error, encoding).toBeInstanceOf(InvalidArgumentError);
      expect(error).not.toBeInstanceOf(UnencodableTextError);
      expect(error).toMatchObject({ code: 'invalid-argument', argument: 'encoding' });
      expect((error as Error).message).toContain(JSON.stringify(encoding));
    }
  });
});

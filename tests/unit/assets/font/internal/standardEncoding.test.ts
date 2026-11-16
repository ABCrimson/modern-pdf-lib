/**
 * The encodings of the 14 standard fonts against ISO 32000 Annex D
 * (tests/fixtures/encodings/annex-d.json; its README names the sources).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InvalidArgumentError, UnencodableTextError } from '../../../../../src/errors.js';
import {
  STANDARD_CODE_TO_UNICODE,
  encodeStandardText,
  encodeTextForFontName,
  measureStandardCodes,
  standardCharacterSet,
  standardEncodingOf,
  type StandardEncodingName,
} from '../../../../../src/assets/font/internal/standardEncoding.js';
import {
  STANDARD_FONT_NAMES,
  getStandardFont,
  type StandardFontName,
} from '../../../../../src/assets/font/internal/standardFonts.js';

interface CodeRow {
  readonly code: number;
  readonly glyph: string;
  readonly unicode: string;
  readonly alternates?: readonly string[];
  readonly annexD?: boolean;
}
interface AnnexD {
  readonly latinCharacterSet: ReadonlyArray<{
    readonly glyph: string;
    readonly unicode: string;
    readonly std: number | null;
    readonly mac: number | null;
    readonly win: number | null;
    readonly pdf: number | null;
  }>;
  readonly pdfDocEncoding: ReadonlyArray<{
    readonly code: number;
    readonly unicode: string | null;
  }>;
  readonly winAnsiEncoding: readonly CodeRow[];
  readonly symbolEncoding: readonly CodeRow[];
  readonly zapfDingbatsEncoding: readonly CodeRow[];
}

const annexD = JSON.parse(
  readFileSync(new URL('../../../../fixtures/encodings/annex-d.json', import.meta.url), 'utf8'),
) as AnnexD;

const cp = (u: string): number => Number.parseInt(u.slice(2), 16);

const ROWS: Readonly<Record<StandardEncodingName, readonly CodeRow[]>> = {
  WinAnsiEncoding: annexD.winAnsiEncoding,
  SymbolEncoding: annexD.symbolEncoding,
  ZapfDingbatsEncoding: annexD.zapfDingbatsEncoding,
};
const ENCODINGS = Object.keys(ROWS) as StandardEncodingName[];
const LATIN_FONTS = STANDARD_FONT_NAMES.filter((f) => f !== 'Symbol' && f !== 'ZapfDingbats');
const FONT_OF: Readonly<Record<StandardEncodingName, StandardFontName>> = {
  WinAnsiEncoding: 'Helvetica',
  SymbolEncoding: 'Symbol',
  ZapfDingbatsEncoding: 'ZapfDingbats',
};

function unencodable(font: StandardFontName, text: string): UnencodableTextError {
  try {
    encodeStandardText(font, text);
  } catch (error) {
    if (error instanceof UnencodableTextError) return error;
    throw error;
  }
  throw new Error(`expected ${font} to reject ${JSON.stringify(text)}`);
}

describe('the fixture is consistent with itself', () => {
  it('WinAnsiEncoding is the WIN column of the Latin set plus the two duplicates of its notes', () => {
    const fromLatin = annexD.latinCharacterSet
      .filter((r) => r.win !== null)
      .map((r) => ({ code: r.win, glyph: r.glyph, unicode: r.unicode }));
    const duplicates = [
      { code: 0xa0, glyph: 'space', unicode: 'U+00A0' },
      { code: 0xad, glyph: 'hyphen', unicode: 'U+00AD' },
    ];
    const expected = [...fromLatin, ...duplicates].toSorted((a, b) => a.code! - b.code!);
    expect(
      annexD.winAnsiEncoding.map(({ code, glyph, unicode }) => ({ code, glyph, unicode })),
    ).toEqual(expected);
  });

  it('the PDF column of the Latin set agrees with the PDFDocEncoding table', () => {
    const pdfDoc = new Map(annexD.pdfDocEncoding.map((r) => [r.code, r.unicode]));
    for (const r of annexD.latinCharacterSet.filter((l) => l.pdf !== null)) {
      expect(pdfDoc.get(r.pdf!), r.glyph).toBe(r.unicode);
    }
  });

  it('holds the row counts of Annex D', () => {
    expect(annexD.latinCharacterSet).toHaveLength(229);
    expect(annexD.pdfDocEncoding).toHaveLength(256);
    expect(annexD.pdfDocEncoding.filter((r) => r.unicode !== null)).toHaveLength(232);
    expect(annexD.latinCharacterSet.filter((r) => r.std !== null)).toHaveLength(149);
    expect(annexD.latinCharacterSet.filter((r) => r.mac !== null)).toHaveLength(207);
    expect(annexD.zapfDingbatsEncoding.filter((r) => r.annexD)).toHaveLength(188);
  });
});

describe('STANDARD_CODE_TO_UNICODE', () => {
  it.each(ENCODINGS)('%s equals the fixture for every code 0-255', (encoding) => {
    const want = new Map(ROWS[encoding].map((r) => [r.code, cp(r.unicode)]));
    const table = STANDARD_CODE_TO_UNICODE[encoding];
    expect(table).toHaveLength(256);
    for (let code = 0; code < 256; code++) {
      expect(table[code], `code 0x${code.toString(16)}`).toBe(want.get(code));
    }
  });
});

describe('standardEncodingOf', () => {
  it('maps the 12 Latin fonts to WinAnsiEncoding and the two symbol fonts to their own', () => {
    for (const font of LATIN_FONTS) expect(standardEncodingOf(font)).toBe('WinAnsiEncoding');
    expect(standardEncodingOf('Symbol')).toBe('SymbolEncoding');
    expect(standardEncodingOf('ZapfDingbats')).toBe('ZapfDingbatsEncoding');
  });
});

describe('standardCharacterSet', () => {
  it('has 218 code points for each Latin font, 189 for Symbol and 202 for ZapfDingbats', () => {
    expect(LATIN_FONTS).toHaveLength(12);
    for (const font of LATIN_FONTS) expect(standardCharacterSet(font)).toHaveLength(218);
    expect(standardCharacterSet('Symbol')).toHaveLength(189);
    expect(standardCharacterSet('ZapfDingbats')).toHaveLength(202);
  });

  it.each(ENCODINGS)('is the ascending list of the %s code points of the fixture', (encoding) => {
    const want = ROWS[encoding].map((r) => cp(r.unicode)).toSorted((a, b) => a - b);
    expect(standardCharacterSet(FONT_OF[encoding])).toEqual(want);
  });
});

describe('encodeStandardText', () => {
  it.each(ENCODINGS)('round-trips every code of %s', (encoding) => {
    const font = FONT_OF[encoding];
    for (const row of ROWS[encoding]) {
      expect(
        [...encodeStandardText(font, String.fromCodePoint(cp(row.unicode)))],
        row.glyph,
      ).toEqual([row.code]);
      for (const alternate of row.alternates ?? []) {
        expect(
          [...encodeStandardText(font, String.fromCodePoint(cp(alternate)))],
          alternate,
        ).toEqual([row.code]);
      }
    }
  });

  it.each(ENCODINGS)('encodes the whole character set of %s in one call', (encoding) => {
    const font = FONT_OF[encoding];
    const text = String.fromCodePoint(...standardCharacterSet(font));
    const codes = encodeStandardText(font, text);
    expect(codes).toBeInstanceOf(Uint8Array);
    expect([...codes].map((code) => STANDARD_CODE_TO_UNICODE[encoding][code])).toEqual(
      standardCharacterSet(font),
    );
  });

  it('encodes the 27 WinAnsi codes 0x80-0x9F by their Unicode value, not by Latin-1', () => {
    expect([...encodeStandardText('Times-Roman', '€ – — “x” Š')]).toEqual([
      0x80, 0x20, 0x96, 0x20, 0x97, 0x20, 0x93, 0x78, 0x94, 0x20, 0x8a,
    ]);
  });

  it('encodes Symbol and ZapfDingbats from Unicode', () => {
    expect([...encodeStandardText('Symbol', 'αβ∑')]).toEqual([0x61, 0x62, 0xe5]);
    expect([...encodeStandardText('ZapfDingbats', '✓❤')]).toEqual([0x33, 0xa4]);
  });

  it('normalises the text to NFC first', () => {
    expect([...encodeStandardText('Helvetica', 'café')]).toEqual([0x63, 0x61, 0x66, 0xe9]);
  });

  it('encodes the two Symbol angle brackets, the only table values NFC replaces, from either form', () => {
    const replaced = ENCODINGS.flatMap((encoding) =>
      ROWS[encoding]
        .map((r) => cp(r.unicode))
        .filter((u) => String.fromCodePoint(u).normalize('NFC') !== String.fromCodePoint(u))
        .map((u) => [encoding, u]),
    );
    expect(replaced).toEqual([
      ['SymbolEncoding', 0x2329],
      ['SymbolEncoding', 0x232a],
    ]);
    expect([...encodeStandardText('Symbol', '〈〉')]).toEqual([0xe1, 0xf1]);
    expect([...encodeStandardText('Symbol', '〈〉')]).toEqual([0xe1, 0xf1]);
  });

  it('returns no bytes for empty text', () => {
    expect(encodeStandardText('Courier', '')).toHaveLength(0);
  });
});

describe('UnencodableTextError from encodeStandardText', () => {
  it('names the first character, its code point, index, font and encoding', () => {
    const error = unencodable('Helvetica', 'Hello 日本');
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error.code).toBe('unencodable-text');
    expect(error.name).toBe('UnencodableTextError');
    expect(error.character).toBe('日');
    expect(error.codePoint).toBe(0x65e5);
    expect(error.index).toBe(6);
    expect(error.fontName).toBe('Helvetica');
    expect(error.encoding).toBe('WinAnsiEncoding');
    expect(error.message).toBe(
      'Helvetica (WinAnsiEncoding) cannot encode "日" (U+65E5) at index 6; embed a font that has this character: doc.embedFont(fontBytes)',
    );
  });

  it('rejects U+0080, which is not the code 0x80 of WinAnsiEncoding', () => {
    const error = unencodable('Times-Roman', 'a\u0080');
    expect([error.codePoint, error.index, error.fontName]).toEqual([0x80, 1, 'Times-Roman']);
  });

  it('rejects TAB and U+007F, which no standard font has', () => {
    expect(unencodable('Courier', 'a\tb').codePoint).toBe(0x09);
    expect(unencodable('Helvetica-Bold', '\u007f').codePoint).toBe(0x7f);
  });

  it('rejects a Latin letter in Symbol, which takes Unicode', () => {
    const error = unencodable('Symbol', 'a');
    expect([error.character, error.index, error.fontName, error.encoding]).toEqual([
      'a',
      0,
      'Symbol',
      'SymbolEncoding',
    ]);
  });

  it('reports a lone surrogate by its own value', () => {
    const error = unencodable('ZapfDingbats', '✓\ud800');
    expect([error.character, error.codePoint, error.index, error.encoding]).toEqual([
      '\ud800',
      0xd800,
      1,
      'ZapfDingbatsEncoding',
    ]);
  });

  it('keeps an astral character whole and gives its UTF-16 index', () => {
    const error = unencodable('Helvetica', 'ab😀');
    expect([error.character, error.codePoint, error.index]).toEqual(['😀', 0x1f600, 2]);
  });

  it('gives the index in the text given when NFC shortens what comes before', () => {
    const error = unencodable('Helvetica', 'é日');
    expect([error.character, error.index]).toEqual(['日', 2]);
  });

  it('gives the index of the cluster when NFC changes the cluster that holds the character', () => {
    // NFC turns e + U+0301 + U+0302 into U+00E9 + U+0302, and U+0302 has no code.
    const error = unencodable('Times-Roman', 'abé̂');
    expect([error.character, error.codePoint, error.index]).toEqual(['̂', 0x0302, 2]);
  });
});

describe('encodeTextForFontName on a path with no embedded font', () => {
  it.each(['Helvetica', 'Helv', 'F1'])(
    'the error for %s advises a font that has the character, not doc.embedFont',
    (name) => {
      let error: unknown;
      try {
        encodeTextForFontName(name, 'ab日', { embeddedFontRoute: false });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(UnencodableTextError);
      expect(error).toMatchObject({ character: '日', index: 2, encoding: 'WinAnsiEncoding' });
      expect((error as UnencodableTextError).message).toMatch(
        /cannot encode "日" \(U\+65E5\) at index 2; use a font that has this character$/,
      );
    },
  );

  it('keeps the doc.embedFont advice where an embedded font can draw the text', () => {
    expect(() => encodeTextForFontName('Helv', '日')).toThrow(/: doc\.embedFont\(fontBytes\)$/);
  });
});

describe('measureStandardCodes', () => {
  it('sums the widths of the codes at the size', () => {
    const codes = encodeStandardText('Helvetica', 'Hello');
    expect(measureStandardCodes('Helvetica', codes, 12)).toBeCloseTo(
      ((722 + 556 + 222 + 222 + 556) * 12) / 1000,
      10,
    );
  });

  it('measures by code, so "€" has the width of code 0x80', () => {
    const codes = encodeStandardText('Helvetica', '€');
    expect(measureStandardCodes('Helvetica', codes, 1000)).toBe(556);
  });

  it('returns 0 for no codes', () => {
    expect(measureStandardCodes('Times-Roman', new Uint8Array(), 12)).toBe(0);
  });
});

describe('the width tables of the standard fonts', () => {
  it.each(STANDARD_FONT_NAMES)(
    '%s has a width exactly at the codes its encoding defines',
    (font) => {
      const table = STANDARD_CODE_TO_UNICODE[standardEncodingOf(font)];
      const widths = getStandardFont(font)!.widths;
      expect(widths).toHaveLength(256);
      for (let code = 0; code < 256; code++) {
        expect(widths[code]! > 0, `code 0x${code.toString(16)}`).toBe(table[code] !== undefined);
      }
    },
  );

  it('holds the AFM widths of Symbol Euro and of the ZapfDingbats codes 0x80-0x8D', () => {
    expect(getStandardFont('Symbol')!.widths[0xa0]).toBe(750);
    expect(getStandardFont('ZapfDingbats')!.widths.slice(0x80, 0x8f)).toEqual([
      390, 390, 317, 317, 276, 276, 509, 509, 410, 410, 234, 234, 334, 334, 0,
    ]);
  });
});

describe('encodeTextForFontName', () => {
  const caught = (run: () => unknown): unknown => {
    try {
      run();
    } catch (error) {
      return error;
    }
    throw new Error('expected a throw');
  };

  it('encodes "Größe €" for a Latin standard font name in WinAnsiEncoding', () => {
    for (const name of ['Helvetica', 'Times-Roman', 'Courier-BoldOblique']) {
      expect([...encodeTextForFontName(name, 'Größe €')]).toEqual([
        0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0x80,
      ]);
    }
  });

  it('encodes Symbol and ZapfDingbats text in their own encodings, by name and by AcroForm alias', () => {
    expect([...encodeTextForFontName('Symbol', 'αβγ')]).toEqual([0x61, 0x62, 0x67]);
    expect([...encodeTextForFontName('Symb', 'αβγ')]).toEqual([0x61, 0x62, 0x67]);
    expect([...encodeTextForFontName('ZapfDingbats', '✓')]).toEqual([0x33]);
    expect([...encodeTextForFontName('ZaDb', '✓')]).toEqual([0x33]);
  });

  it('takes each of the 12 Latin AcroForm aliases to WinAnsiEncoding', () => {
    const aliases = ['Helv', 'HeBo', 'HeOb', 'HeBO', 'TiRo', 'TiBo', 'TiIt', 'TiBI'];
    for (const alias of [...aliases, 'Cour', 'CoBo', 'CoOb', 'CoBO']) {
      expect([...encodeTextForFontName(alias, 'é€')]).toEqual([0xe9, 0x80]);
    }
  });

  it('normalises the text to NFC', () => {
    expect([...encodeTextForFontName('Helvetica', 'cafe\u0301')]).toEqual([0x63, 0x61, 0x66, 0xe9]);
  });

  it('encodes any other name in WinAnsiEncoding and names it when a character has no code', () => {
    expect([...encodeTextForFontName('F1', 'Größe €')]).toEqual([
      0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0x80,
    ]);
    expect([...encodeTextForFontName('', 'é')]).toEqual([0xe9]);
    const error = caught(() => encodeTextForFontName('F9', 'a日'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({
      character: '日',
      index: 1,
      fontName: 'F9',
      encoding: 'WinAnsiEncoding',
    });
  });

  it('names the standard font when a standard font name or alias cannot encode a character', () => {
    expect(caught(() => encodeTextForFontName('Helvetica', 'ab日'))).toMatchObject({
      character: '日',
      index: 2,
      fontName: 'Helvetica',
      encoding: 'WinAnsiEncoding',
    });
    expect(caught(() => encodeTextForFontName('Symb', 'a'))).toMatchObject({
      fontName: 'Symbol',
      encoding: 'SymbolEncoding',
    });
  });
});

/**
 * @module assets/font/internal/standardEncoding
 *
 * The encodings of the 14 standard fonts on the write side: WinAnsiEncoding
 * for the 12 Latin fonts and the built-in encodings of Symbol and
 * ZapfDingbats (ISO 32000 Annex D: D.2, D.5 and D.6). Text written in a
 * standard font becomes codes here, and the ToUnicode CMaps of
 * `compliance/pdfa/toUnicodeCmap` read the same tables.
 *
 * The tables equal `tests/fixtures/encodings/annex-d.json`, whose README
 * names the sources and the checks against them.
 */

import { UnencodableTextError, type TextEncodingName } from '../../../errors.js';
import { STANDARD_FONTS, isStandardFont, type StandardFontName } from './standardFonts.js';

/** The encoding a standard font writes its text in. */
export type StandardEncodingName = Extract<
  TextEncodingName,
  'WinAnsiEncoding' | 'SymbolEncoding' | 'ZapfDingbatsEncoding'
>;

/**
 * Builds a 256-entry code to Unicode table from the values of codes
 * 0x20 to 0xFF, where 0 marks a code without a glyph.
 */
function fromRows(values: readonly number[]): ReadonlyArray<number | undefined> {
  const table = Array.from<number | undefined>({ length: 256 });
  values.forEach((unicode, i) => {
    if (unicode !== 0) table[0x20 + i] = unicode;
  });
  return table;
}

// WinAnsiEncoding (Windows code page 1252): codes 0x20-0x7E and 0xA0-0xFF are
// their own code points; of 0x80-0x9F, these 27 have a glyph. 0x7F, 0x81, 0x8D,
// 0x8F, 0x90 and 0x9D have none. 0xA0 and 0xAD are the duplicates of space and
// hyphen that Annex D gives the meanings no-break space and soft hyphen.
// One row of 16 codes per line.
// prettier-ignore
const WIN_ANSI_0X80_TO_0X9F: readonly number[] = [
  0x20ac, 0x0000, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x017d, 0x0000, // 0x80
  0x0000, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x0000, 0x017e, 0x0178, // 0x90
];

// The built-in encoding of Symbol (Annex D.5), codes 0x20-0xFF. Unicode values
// are those of Adobe's symbol.txt; of its double mappings the Greek letter is
// taken (Delta, Omega, mu) and fraction is U+2044. 29 codes map to the Private
// Use Area, as Adobe assigns them.
// One row of 16 codes per line.
// prettier-ignore
const SYMBOL_ROWS: readonly number[] = [
  0x0020, 0x0021, 0x2200, 0x0023, 0x2203, 0x0025, 0x0026, 0x220b, 0x0028, 0x0029, 0x2217, 0x002b, 0x002c, 0x2212, 0x002e, 0x002f, // 0x20
  0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036, 0x0037, 0x0038, 0x0039, 0x003a, 0x003b, 0x003c, 0x003d, 0x003e, 0x003f, // 0x30
  0x2245, 0x0391, 0x0392, 0x03a7, 0x0394, 0x0395, 0x03a6, 0x0393, 0x0397, 0x0399, 0x03d1, 0x039a, 0x039b, 0x039c, 0x039d, 0x039f, // 0x40
  0x03a0, 0x0398, 0x03a1, 0x03a3, 0x03a4, 0x03a5, 0x03c2, 0x03a9, 0x039e, 0x03a8, 0x0396, 0x005b, 0x2234, 0x005d, 0x22a5, 0x005f, // 0x50
  0xf8e5, 0x03b1, 0x03b2, 0x03c7, 0x03b4, 0x03b5, 0x03c6, 0x03b3, 0x03b7, 0x03b9, 0x03d5, 0x03ba, 0x03bb, 0x03bc, 0x03bd, 0x03bf, // 0x60
  0x03c0, 0x03b8, 0x03c1, 0x03c3, 0x03c4, 0x03c5, 0x03d6, 0x03c9, 0x03be, 0x03c8, 0x03b6, 0x007b, 0x007c, 0x007d, 0x223c, 0x0000, // 0x70
  0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, // 0x80
  0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, // 0x90
  0x20ac, 0x03d2, 0x2032, 0x2264, 0x2044, 0x221e, 0x0192, 0x2663, 0x2666, 0x2665, 0x2660, 0x2194, 0x2190, 0x2191, 0x2192, 0x2193, // 0xA0
  0x00b0, 0x00b1, 0x2033, 0x2265, 0x00d7, 0x221d, 0x2202, 0x2022, 0x00f7, 0x2260, 0x2261, 0x2248, 0x2026, 0xf8e6, 0xf8e7, 0x21b5, // 0xB0
  0x2135, 0x2111, 0x211c, 0x2118, 0x2297, 0x2295, 0x2205, 0x2229, 0x222a, 0x2283, 0x2287, 0x2284, 0x2282, 0x2286, 0x2208, 0x2209, // 0xC0
  0x2220, 0x2207, 0xf6da, 0xf6d9, 0xf6db, 0x220f, 0x221a, 0x22c5, 0x00ac, 0x2227, 0x2228, 0x21d4, 0x21d0, 0x21d1, 0x21d2, 0x21d3, // 0xD0
  0x25ca, 0x2329, 0xf8e8, 0xf8e9, 0xf8ea, 0x2211, 0xf8eb, 0xf8ec, 0xf8ed, 0xf8ee, 0xf8ef, 0xf8f0, 0xf8f1, 0xf8f2, 0xf8f3, 0xf8f4, // 0xE0
  0x0000, 0x232a, 0x222b, 0x2320, 0xf8f5, 0x2321, 0xf8f6, 0xf8f7, 0xf8f8, 0xf8f9, 0xf8fa, 0xf8fb, 0xf8fc, 0xf8fd, 0xf8fe, 0x0000, // 0xF0
];

// The built-in encoding of ZapfDingbats, codes 0x20-0xFF: the 188 codes of
// Annex D.6 plus 0x80-0x8D (a85 to a96, a205 and a206) of the font's own encoding.
// Unicode values are those of Adobe's zdingbat.txt, which maps those 14 codes
// to the Private Use Area.
// One row of 16 codes per line.
// prettier-ignore
const ZAPF_DINGBATS_ROWS: readonly number[] = [
  0x0020, 0x2701, 0x2702, 0x2703, 0x2704, 0x260e, 0x2706, 0x2707, 0x2708, 0x2709, 0x261b, 0x261e, 0x270c, 0x270d, 0x270e, 0x270f, // 0x20
  0x2710, 0x2711, 0x2712, 0x2713, 0x2714, 0x2715, 0x2716, 0x2717, 0x2718, 0x2719, 0x271a, 0x271b, 0x271c, 0x271d, 0x271e, 0x271f, // 0x30
  0x2720, 0x2721, 0x2722, 0x2723, 0x2724, 0x2725, 0x2726, 0x2727, 0x2605, 0x2729, 0x272a, 0x272b, 0x272c, 0x272d, 0x272e, 0x272f, // 0x40
  0x2730, 0x2731, 0x2732, 0x2733, 0x2734, 0x2735, 0x2736, 0x2737, 0x2738, 0x2739, 0x273a, 0x273b, 0x273c, 0x273d, 0x273e, 0x273f, // 0x50
  0x2740, 0x2741, 0x2742, 0x2743, 0x2744, 0x2745, 0x2746, 0x2747, 0x2748, 0x2749, 0x274a, 0x274b, 0x25cf, 0x274d, 0x25a0, 0x274f, // 0x60
  0x2750, 0x2751, 0x2752, 0x25b2, 0x25bc, 0x25c6, 0x2756, 0x25d7, 0x2758, 0x2759, 0x275a, 0x275b, 0x275c, 0x275d, 0x275e, 0x0000, // 0x70
  0xf8d7, 0xf8d8, 0xf8d9, 0xf8da, 0xf8db, 0xf8dc, 0xf8dd, 0xf8de, 0xf8df, 0xf8e0, 0xf8e1, 0xf8e2, 0xf8e3, 0xf8e4, 0x0000, 0x0000, // 0x80
  0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, // 0x90
  0x0000, 0x2761, 0x2762, 0x2763, 0x2764, 0x2765, 0x2766, 0x2767, 0x2663, 0x2666, 0x2665, 0x2660, 0x2460, 0x2461, 0x2462, 0x2463, // 0xA0
  0x2464, 0x2465, 0x2466, 0x2467, 0x2468, 0x2469, 0x2776, 0x2777, 0x2778, 0x2779, 0x277a, 0x277b, 0x277c, 0x277d, 0x277e, 0x277f, // 0xB0
  0x2780, 0x2781, 0x2782, 0x2783, 0x2784, 0x2785, 0x2786, 0x2787, 0x2788, 0x2789, 0x278a, 0x278b, 0x278c, 0x278d, 0x278e, 0x278f, // 0xC0
  0x2790, 0x2791, 0x2792, 0x2793, 0x2794, 0x2192, 0x2194, 0x2195, 0x2798, 0x2799, 0x279a, 0x279b, 0x279c, 0x279d, 0x279e, 0x279f, // 0xD0
  0x27a0, 0x27a1, 0x27a2, 0x27a3, 0x27a4, 0x27a5, 0x27a6, 0x27a7, 0x27a8, 0x27a9, 0x27aa, 0x27ab, 0x27ac, 0x27ad, 0x27ae, 0x27af, // 0xE0
  0x0000, 0x27b1, 0x27b2, 0x27b3, 0x27b4, 0x27b5, 0x27b6, 0x27b7, 0x27b8, 0x27b9, 0x27ba, 0x27bb, 0x27bc, 0x27bd, 0x27be, 0x0000, // 0xF0
];

/**
 * Code to Unicode for codes 0 to 255 of each standard encoding, `undefined`
 * where the encoding has no glyph: the one table set of the write side.
 */
export const STANDARD_CODE_TO_UNICODE: Readonly<
  Record<StandardEncodingName, ReadonlyArray<number | undefined>>
> = {
  WinAnsiEncoding: /* @__PURE__ */ fromRows(
    Array.from({ length: 0xe0 }, (_, i) => {
      const code = 0x20 + i;
      if (code === 0x7f) return 0;
      return code >= 0x80 && code <= 0x9f ? (WIN_ANSI_0X80_TO_0X9F[code - 0x80] ?? 0) : code;
    }),
  ),
  SymbolEncoding: /* @__PURE__ */ fromRows(SYMBOL_ROWS),
  ZapfDingbatsEncoding: /* @__PURE__ */ fromRows(ZAPF_DINGBATS_ROWS),
};

/**
 * Code points that also encode, besides the value of the table: the other
 * Unicode values Adobe's symbol.txt and zdingbat.txt list for a code, and the
 * values the Adobe Glyph List for ZapfDingbats gives a85 to a96, a205 and a206.
 * U+2126 OHM SIGN (Omega) needs none: NFC turns it into U+03A9.
 */
const ALIASES: Readonly<Record<StandardEncodingName, ReadonlyArray<readonly [number, number]>>> = {
  WinAnsiEncoding: [],
  SymbolEncoding: [
    [0x00a0, 0x20],
    [0x2206, 0x44],
    [0x00b5, 0x6d],
    [0x2215, 0xa4],
  ],
  ZapfDingbatsEncoding: [
    [0x00a0, 0x20],
    ...Array.from({ length: 14 }, (_, i): readonly [number, number] => [0x2768 + i, 0x80 + i]),
  ],
};

/**
 * Unicode to code: the inverse of each table plus its aliases. Text is
 * normalised to NFC before it is encoded, so a table value that NFC replaces
 * (Symbol angleleft U+2329 and angleright U+232A become U+3008 and U+3009)
 * encodes from its NFC form.
 */
const UNICODE_TO_CODE: Readonly<Record<StandardEncodingName, ReadonlyMap<number, number>>> =
  /* @__PURE__ */ (() => {
    const inverse = (encoding: StandardEncodingName): ReadonlyMap<number, number> => {
      const map = new Map<number, number>(ALIASES[encoding]);
      STANDARD_CODE_TO_UNICODE[encoding].forEach((unicode, code) => {
        if (unicode === undefined) return;
        map.set(unicode, code);
        const nfc = String.fromCodePoint(unicode).normalize('NFC').codePointAt(0);
        if (nfc !== undefined && nfc !== unicode) map.set(nfc, code);
      });
      return map;
    };
    return {
      WinAnsiEncoding: inverse('WinAnsiEncoding'),
      SymbolEncoding: inverse('SymbolEncoding'),
      ZapfDingbatsEncoding: inverse('ZapfDingbatsEncoding'),
    };
  })();

/** The encoding a standard font writes: its built-in one for Symbol and ZapfDingbats. */
export function standardEncodingOf(font: StandardFontName): StandardEncodingName {
  if (font === 'Symbol') return 'SymbolEncoding';
  if (font === 'ZapfDingbats') return 'ZapfDingbatsEncoding';
  return 'WinAnsiEncoding';
}

/** Appends the codes of `normal` (NFC text) to `out`; `at` maps an index of `normal` to one of the text given. */
function appendCodes(
  font: StandardFontName,
  encoding: StandardEncodingName,
  normal: string,
  at: (index: number) => number,
  out: number[],
): void {
  const toCode = UNICODE_TO_CODE[encoding];
  for (let i = 0; i < normal.length; i++) {
    // Every code point of the tables is in the BMP, so a surrogate never encodes.
    const codePoint = normal.codePointAt(i) ?? 0;
    const code = toCode.get(codePoint);
    if (code === undefined) {
      throw new UnencodableTextError({
        character: String.fromCodePoint(codePoint),
        index: at(i),
        fontName: font,
        encoding,
      });
    }
    out.push(code);
  }
}

/**
 * Encodes text for a standard font, one byte per character, after normalising
 * it to NFC (so "e" plus U+0301 is written as the one code of "é").
 *
 * @throws {UnencodableTextError} At the first character the encoding has no
 *   code for; its `index` is the UTF-16 index in `text`. Where NFC changes a
 *   grapheme cluster, the index is that of the cluster.
 */
export function encodeStandardText(font: StandardFontName, text: string): Uint8Array {
  const encoding = standardEncodingOf(font);
  const out: number[] = [];
  const nfc = text.normalize('NFC');
  if (nfc === text) {
    appendCodes(font, encoding, text, (i) => i, out);
  } else {
    // Normalising cluster by cluster keeps an index of the text given for the error.
    for (const { segment, index } of new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    }).segment(text)) {
      const normal = segment.normalize('NFC');
      appendCodes(font, encoding, normal, (i) => (normal === segment ? index + i : index), out);
    }
  }
  return Uint8Array.from(out);
}

/**
 * The resource names an AcroForm default appearance gives the 14 standard
 * fonts (`/Helv`, `/ZaDb`, ...; the names Acrobat writes in the /DR of a
 * form), each with the standard font it stands for.
 */
const ACROFORM_FONT_ALIASES: ReadonlyMap<string, StandardFontName> = new Map([
  ['Helv', 'Helvetica'],
  ['HeBo', 'Helvetica-Bold'],
  ['HeOb', 'Helvetica-Oblique'],
  ['HeBO', 'Helvetica-BoldOblique'],
  ['TiRo', 'Times-Roman'],
  ['TiBo', 'Times-Bold'],
  ['TiIt', 'Times-Italic'],
  ['TiBI', 'Times-BoldItalic'],
  ['Cour', 'Courier'],
  ['CoBo', 'Courier-Bold'],
  ['CoOb', 'Courier-Oblique'],
  ['CoBO', 'Courier-BoldOblique'],
  ['Symb', 'Symbol'],
  ['ZaDb', 'ZapfDingbats'],
]);

/**
 * The standard font that `name` stands for: the font of that name, or the
 * font of an AcroForm alias (`Helv`, `ZaDb`, ...); undefined for any other
 * name.
 */
export function standardFontForName(name: string): StandardFontName | undefined {
  return isStandardFont(name) ? name : ACROFORM_FONT_ALIASES.get(name);
}

/** The end of the message of an error on a path that cannot draw text in an embedded font. */
const NO_EMBEDDED_FONT_HINT = '; use a font that has this character';

/**
 * Encodes `text` for a font known only by its name, such as the resource
 * name of a /DA string or of a layout: one of the 14 standard font names or
 * an AcroForm alias (`Helv`, `ZaDb`, ...) in the encoding of that standard
 * font, any other name in WinAnsiEncoding (a font with no font object is
 * written in WinAnsiEncoding). Text is normalised to NFC first.
 *
 * @param name     A standard font name, an AcroForm alias or a font resource name.
 * @param text     The text to encode.
 * @param options  `embeddedFontRoute: false` for a caller that can draw text
 *   only by font name (SVG text, barcode labels, `renderTable`): its error then
 *   advises a font that has the character instead of `doc.embedFont`.
 * @returns        One byte per character.
 * @throws {UnencodableTextError} At the first character the encoding has no
 *   code for; its `fontName` is the standard font for a standard name or
 *   alias, and `name` for any other name.
 */
export function encodeTextForFontName(
  name: string,
  text: string,
  options?: { readonly embeddedFontRoute?: boolean | undefined },
): Uint8Array {
  const standard = standardFontForName(name);
  try {
    // The 12 Latin standard fonts share WinAnsiEncoding.
    return encodeStandardText(standard ?? 'Helvetica', text);
  } catch (error) {
    if (!(error instanceof UnencodableTextError)) throw error;
    const embeddedFontRoute = options?.embeddedFontRoute ?? true;
    if (standard !== undefined && embeddedFontRoute) throw error;
    const { character, index, fontName, encoding } = error;
    throw new UnencodableTextError(
      { character, index, fontName: standard === undefined ? name : fontName, encoding },
      { cause: error, hint: embeddedFontRoute ? undefined : NO_EMBEDDED_FONT_HINT },
    );
  }
}

/** The Unicode code points a standard font encodes, ascending: 218 for each Latin font, 189 for Symbol, 202 for ZapfDingbats. */
export function standardCharacterSet(font: StandardFontName): readonly number[] {
  return STANDARD_CODE_TO_UNICODE[standardEncodingOf(font)]
    .filter((unicode): unicode is number => unicode !== undefined)
    .toSorted((a, b) => a - b);
}

/** The advance width in points of the codes `encodeStandardText` returned, at `size` points. */
export function measureStandardCodes(
  font: StandardFontName,
  codes: Uint8Array,
  size: number,
): number {
  const widths = STANDARD_FONTS.get(font)?.widths ?? [];
  let total = 0;
  for (const code of codes) total += widths[code] ?? 0;
  return total * (size / 1000);
}

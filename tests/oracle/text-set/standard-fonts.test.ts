/**
 * Page text in the 14 standard fonts, read back by pdf.js: each font draws every character it
 * encodes (ISO 32000-2 Annex D, from tests/fixtures/encodings/annex-d.json: 218 characters for
 * each of the 12 Latin fonts in WinAnsiEncoding, 189 for Symbol and 202 for ZapfDingbats, 3,007 in
 * all) on one page, in lines of 16 in code point order, and the text pdf.js reads for each line
 * must equal the line, but for the readings listed in DISAGREEMENTS and the ZapfDingbats rule.
 * pdf.js drops a whitespace glyph at either end of a line, so U+0020 or U+00A0 at the start or
 * end of a line is moved one place inward.
 *
 * The first test writes the codes of the fixture with the `<hex> Tj` operator and so checks the
 * stated readings against pdf.js; the second writes the same lines with `drawText`. pdf.js reads a
 * ZapfDingbats code as the character of the same number, so neither test checks the Unicode
 * column of zapfDingbatsEncoding in annex-d.json; that column is checked against Adobe's glyph list
 * for the font in tests/unit/assets/font/internal/zapfDingbatsGlyphList.test.ts.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  beginText,
  createPdf,
  endText,
  moveTextOp,
  setFontOp,
  showTextHex,
  StandardFonts,
} from '../../../src/index.js';
import type { FontRef, PdfPage, StandardFontName } from '../../../src/index.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

/** The entries of an encoding in annex-d.json that this file reads. */
interface EncodingRow {
  readonly code: number;
  readonly unicode: string;
}
const ANNEX_D = JSON.parse(
  readFileSync(new URL('../../fixtures/encodings/annex-d.json', import.meta.url), 'utf8'),
) as Record<'winAnsiEncoding' | 'symbolEncoding' | 'zapfDingbatsEncoding', EncodingRow[]>;

const FONTS = Object.values(StandardFonts);
const LATIN_FONTS = FONTS.filter((font) => font !== 'Symbol' && font !== 'ZapfDingbats');

/** Each character a font encodes, in code point order, with its code. */
function characterSet(font: StandardFontName): { readonly char: string; readonly code: number }[] {
  const rows =
    font === 'Symbol'
      ? ANNEX_D.symbolEncoding
      : font === 'ZapfDingbats'
        ? ANNEX_D.zapfDingbatsEncoding
        : ANNEX_D.winAnsiEncoding;
  return rows
    .map((row) => ({
      char: String.fromCodePoint(Number.parseInt(row.unicode.slice(2), 16)),
      code: row.code,
    }))
    .toSorted((a, b) => (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0));
}

/**
 * A character pdf.js reads differently from the one written: the fonts, the code point written,
 * the code points pdf.js reads (none when it drops the glyph), and why.
 */
interface Disagreement {
  readonly fonts: readonly StandardFontName[];
  readonly unicode: number;
  readonly theirs: readonly number[];
  readonly reason: string;
}

const DISAGREEMENTS: readonly Disagreement[] = [
  {
    fonts: LATIN_FONTS,
    unicode: 0x00a0,
    theirs: [0x0020],
    reason:
      'WinAnsiEncoding code 0xA0 is the glyph "space" (Annex D.2 note 6), which pdf.js reads as U+0020',
  },
  {
    fonts: LATIN_FONTS,
    unicode: 0x00ad,
    theirs: [0x002d],
    reason:
      'WinAnsiEncoding code 0xAD is the glyph "hyphen" (Annex D.2 note 5), which pdf.js reads as U+002D',
  },
  {
    fonts: ['Symbol'],
    unicode: 0x0394,
    theirs: [0x2206],
    reason:
      'Symbol code 0x44, glyph "Delta": Adobe symbol.txt gives U+0394 and U+2206; the encoding table writes U+0394, pdf.js reads U+2206',
  },
  {
    fonts: ['Symbol'],
    unicode: 0x03a9,
    theirs: [0x2126],
    reason:
      'Symbol code 0x57, glyph "Omega": Adobe symbol.txt gives U+03A9 and U+2126; the encoding table writes U+03A9, pdf.js reads U+2126',
  },
  {
    fonts: ['Symbol'],
    unicode: 0x03bc,
    theirs: [0x00b5],
    reason:
      'Symbol code 0x6D, glyph "mu": Adobe symbol.txt gives U+03BC and U+00B5; the encoding table writes U+03BC, pdf.js reads U+00B5',
  },
  {
    fonts: ['ZapfDingbats'],
    unicode: 0x2461,
    theirs: [],
    reason:
      'ZapfDingbats code 0xAD (a121, circled digit two) reads, by the ZapfDingbats rule, as U+00AD, a soft hyphen, which pdf.js drops',
  },
];

/**
 * What pdf.js reads for `char` (code `code`) in `font`: the stated disagreement, else, by the
 * ZapfDingbats rule, the character of the same number as the code, else `char`.
 *
 * The ZapfDingbats rule: pdf.js 6.5 has no Unicode value for the glyph names a1 to a191 of a
 * ZapfDingbats font that is not embedded and has no /ToUnicode, so it reads each code as the
 * character of the same number (0x80 to 0x8D as U+0080 to U+008D); code 0x20 is the space.
 */
function reading(font: StandardFontName, char: string, code: number): string {
  const stated = DISAGREEMENTS.find(
    (d) => d.unicode === char.codePointAt(0) && d.fonts.includes(font),
  );
  if (stated !== undefined) return String.fromCodePoint(...stated.theirs);
  return font === 'ZapfDingbats' ? String.fromCharCode(code) : char;
}

/** U+0020 and U+00A0. */
const WHITESPACE = new Set([0x0020, 0x00a0]);
const isWhitespace = (char: string): boolean => WHITESPACE.has(char.codePointAt(0) ?? 0);

/** The character set of `font` in lines of 16, no line starting or ending with whitespace. */
function lines(font: StandardFontName): { readonly char: string; readonly code: number }[][] {
  const set = characterSet(font);
  const out = Array.from({ length: Math.ceil(set.length / 16) }, (_, i) =>
    set.slice(i * 16, i * 16 + 16),
  );
  for (const line of out) {
    const [first, second] = line;
    if (first !== undefined && second !== undefined && isWhitespace(first.char)) {
      line.splice(0, 2, second, first);
    }
    const [beforeLast, last] = line.slice(-2);
    if (beforeLast !== undefined && last !== undefined && isWhitespace(last.char)) {
      line.splice(-2, 2, last, beforeLast);
    }
  }
  return out;
}

/** The y coordinate of line `i` on the 1,200-point page. */
const lineY = (i: number): number => 1180 - 20 * i;

/**
 * Draws the character set of each font on a page of its own with `draw`, saves, and asserts that
 * pdf.js reads every line as stated.
 */
async function expectStandardFontLines(
  draw: (page: PdfPage, font: FontRef, i: number, line: string, codes: number[]) => void,
): Promise<void> {
  const doc = createPdf();
  const wanted: string[][] = [];
  for (const name of FONTS) {
    const page = doc.addPage([612, 1200]);
    const font = await doc.embedFont(name);
    const fontLines = lines(name);
    for (const [i, line] of fontLines.entries()) {
      draw(
        page,
        font,
        i,
        line.map((c) => c.char).join(''),
        line.map((c) => c.code),
      );
    }
    wanted.push(fontLines.map((line) => line.map((c) => reading(name, c.char, c.code)).join('')));
  }
  const read = await pdfjsLines(await cleanSave(doc));
  for (const [n, name] of FONTS.entries()) expect(read[n], name).toEqual(wanted[n]);
}

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('standard-font page text read back by pdf.js', () => {
  test('every stated disagreement names a character of the font that reads differently', () => {
    for (const d of DISAGREEMENTS) {
      for (const font of d.fonts) {
        const label = `${font} U+${d.unicode.toString(16).toUpperCase().padStart(4, '0')}`;
        const entry = characterSet(font).find((c) => c.char.codePointAt(0) === d.unicode);
        expect(entry, label).toBeDefined();
        expect(d.theirs, label).not.toEqual([d.unicode]);
        expect(d.reason, label).not.toBe('');
      }
    }
  });

  test(
    'the codes of the Annex D tables, shown with <hex> Tj: pdf.js reads every line as stated',
    { timeout: 120_000 },
    async () => {
      await expectStandardFontLines((page, font, i, _line, codes) => {
        page.pushOperators(
          `${beginText()}${setFontOp(font.name, 10)}${moveTextOp(20, lineY(i))}${showTextHex(Uint8Array.from(codes).toHex())}${endText()}`,
        );
      });
    },
  );

  test(
    'drawText in each standard font: pdf.js reads every encodable character as stated',
    { timeout: 120_000 },
    async () => {
      await expectStandardFontLines((page, font, i, line) => {
        page.drawText(line, { x: 20, y: lineY(i), font, size: 10 });
      });
    },
  );
});

/**
 * Text a standard font cannot encode: each of the 14 fonts draws `a<c>b` for five characters c
 * outside its character set (U+65E5, U+0080, the TAB U+0009, the lone surrogate U+D800 and
 * U+1F600). Each `drawText` call must throw UnencodableTextError naming the character, its code
 * point, its index (1), the font and its encoding, and write nothing: pdf.js reads no text on the
 * saved page.
 */
import { beforeEach, describe, expect } from 'vitest';
import { createPdf, StandardFonts, UnencodableTextError } from '../../../src/index.js';
import type { StandardFontName, TextEncodingName } from '../../../src/index.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, pdfjsLines } from './setup.js';

const FONTS = Object.values(StandardFonts);
const CHARACTERS = [0x65e5, 0x0080, 0x0009, 0xd800, 0x1f600].map((cp) => String.fromCodePoint(cp));

const encodingOf = (font: StandardFontName): TextEncodingName =>
  font === 'Symbol'
    ? 'SymbolEncoding'
    : font === 'ZapfDingbats'
      ? 'ZapfDingbatsEncoding'
      : 'WinAnsiEncoding';

/** What `run` threw, as the fields of an UnencodableTextError, or the value itself otherwise. */
function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    if (!(error instanceof UnencodableTextError)) return error;
    const { name, character, codePoint, index, fontName, encoding } = error;
    return { name, character, codePoint, index, fontName, encoding };
  }
  return undefined;
}

beforeEach((ctx) => {
  requireQpdf(ctx);
});

describe('text a standard font cannot encode', () => {
  knownDefect(
    defectKey('core-page-01', '0.41.0'),
    'drawText throws UnencodableTextError for each of 5 characters in each standard font and writes nothing',
    {
      failsWith: /^AssertionError: Courier U\+65E5: expected undefined to deeply equal/,
      timeout: 120_000,
    },
    async () => {
      const doc = createPdf();
      for (const name of FONTS) {
        const page = doc.addPage();
        const font = await doc.embedFont(name);
        for (const character of CHARACTERS) {
          const codePoint = character.codePointAt(0) ?? Number.NaN;
          const label = `${name} U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
          expect(
            thrownBy(() => page.drawText(`a${character}b`, { x: 50, y: 700, font, size: 12 })),
            label,
          ).toEqual({
            name: 'UnencodableTextError',
            character,
            codePoint,
            index: 1,
            fontName: name,
            encoding: encodingOf(name),
          });
        }
      }
      expect(await pdfjsLines(await cleanSave(doc))).toEqual(FONTS.map(() => []));
    },
  );
});

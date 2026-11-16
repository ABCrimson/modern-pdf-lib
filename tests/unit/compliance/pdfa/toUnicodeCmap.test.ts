/**
 * The ToUnicode CMaps of the standard fonts against ISO 32000 Annex D
 * (tests/fixtures/encodings/annex-d.json) and, for WinAnsiEncoding, against
 * the bytes 0.40.9 wrote.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  generateSymbolToUnicodeCmap,
  generateWinAnsiToUnicodeCmap,
  generateZapfDingbatsToUnicodeCmap,
  getToUnicodeCmap,
} from '../../../../src/compliance/pdfa/toUnicodeCmap.js';
import { STANDARD_FONT_NAMES } from '../../../../src/assets/font/internal/standardFonts.js';

interface CodeRow {
  readonly code: number;
  readonly unicode: string;
}
const annexD = JSON.parse(
  readFileSync(new URL('../../../fixtures/encodings/annex-d.json', import.meta.url), 'utf8'),
) as {
  readonly winAnsiEncoding: readonly CodeRow[];
  readonly symbolEncoding: readonly CodeRow[];
  readonly zapfDingbatsEncoding: readonly CodeRow[];
};

/** The bfchar entries of a CMap, code to Unicode, in the order written. */
function bfchars(cmap: string): Array<[number, number]> {
  return [...cmap.matchAll(/^<([0-9A-F]{2})> <([0-9A-F]{4})>$/gm)].map((m) => [
    Number.parseInt(m[1]!, 16),
    Number.parseInt(m[2]!, 16),
  ]);
}

function expected(rows: readonly CodeRow[]): Array<[number, number]> {
  return rows.map((r): [number, number] => [r.code, Number.parseInt(r.unicode.slice(2), 16)]);
}

describe('generateWinAnsiToUnicodeCmap', () => {
  const cmap = generateWinAnsiToUnicodeCmap();

  it('writes the bytes 0.40.9 wrote', () => {
    expect(createHash('sha256').update(cmap, 'latin1').digest('hex')).toBe(
      'dc8d8a36b6766d8fd17d7c441a9bbdb750cb4dd4a1300fd92404565e8dc5a4ac',
    );
    expect(cmap).toHaveLength(3001);
  });

  it('maps every WinAnsiEncoding code of Annex D, and 0x7F as 0.40.9 did', () => {
    const want = [...expected(annexD.winAnsiEncoding), [0x7f, 0x7f] as [number, number]].toSorted(
      (a, b) => a[0] - b[0],
    );
    expect(bfchars(cmap)).toEqual(want);
  });

  it('is the CMap of each of the 12 Latin standard fonts', () => {
    const latin = STANDARD_FONT_NAMES.filter((f) => f !== 'Symbol' && f !== 'ZapfDingbats');
    expect(latin).toHaveLength(12);
    for (const font of latin) expect(getToUnicodeCmap(font)).toBe(cmap);
  });
});

describe('the built-in encodings', () => {
  it('Symbol maps exactly the 189 codes of Annex D Table D.5', () => {
    expect(bfchars(generateSymbolToUnicodeCmap())).toEqual(expected(annexD.symbolEncoding));
    expect(getToUnicodeCmap('Symbol')).toBe(generateSymbolToUnicodeCmap());
  });

  it('Symbol maps Zeta to U+0396 and Delta to U+0394', () => {
    const map = new Map(bfchars(generateSymbolToUnicodeCmap()));
    expect(map.get(0x5a)).toBe(0x0396);
    expect(map.get(0x44)).toBe(0x0394);
  });

  it('ZapfDingbats maps exactly the 202 codes of its built-in encoding', () => {
    expect(bfchars(generateZapfDingbatsToUnicodeCmap())).toEqual(
      expected(annexD.zapfDingbatsEncoding),
    );
    expect(getToUnicodeCmap('ZapfDingbats')).toBe(generateZapfDingbatsToUnicodeCmap());
  });

  it('ZapfDingbats maps a161, a163 and a164 to the arrows they are', () => {
    const map = new Map(bfchars(generateZapfDingbatsToUnicodeCmap()));
    expect([map.get(0xd5), map.get(0xd6), map.get(0xd7)]).toEqual([0x2192, 0x2194, 0x2195]);
  });
});

/**
 * The Unicode column of the ZapfDingbats table of tests/fixtures/encodings/annex-d.json, and the
 * table of src/assets/font/internal/standardEncoding.ts built from it, against Adobe's own glyph
 * list for the font (tests/fixtures/encodings/zapfdingbats.txt, which the README there describes).
 * pdf.js reads a ZapfDingbats code as the character of the same number, so the text oracle set
 * cannot check this column; this file is the check that does not derive from the fixture itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STANDARD_CODE_TO_UNICODE } from '../../../../../src/assets/font/internal/standardEncoding.js';

interface ZapfRow {
  readonly code: number;
  readonly glyph: string;
  readonly unicode: string;
  readonly alternates?: readonly string[];
  readonly annexD?: boolean;
}

const read = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/encodings/${name}`, import.meta.url), 'utf8');

const rows = (JSON.parse(read('annex-d.json')) as { zapfDingbatsEncoding: readonly ZapfRow[] })
  .zapfDingbatsEncoding;

/** Glyph name to Unicode, as `U+XXXX`, from the lines of the list that are not comments. */
const adobe = new Map<string, string>();
for (const line of read('zapfdingbats.txt').split('\n')) {
  if (line === '' || line.startsWith('#')) continue;
  const { glyph, hex } = /^(?<glyph>[A-Za-z0-9]+);(?<hex>[0-9A-F]{4})$/.exec(line)?.groups ?? {};
  if (glyph === undefined || hex === undefined) {
    throw new Error(`unreadable line in zapfdingbats.txt: ${line}`);
  }
  adobe.set(glyph, `U+${hex}`);
}

describe('Adobe glyph list for ZapfDingbats (zapfdingbats.txt)', () => {
  it('has 201 glyph names, one line each', () => {
    expect(adobe.size).toBe(201);
  });

  it('names exactly the glyphs of the 202 table rows but space', () => {
    expect(rows).toHaveLength(202);
    const named = new Set(rows.map((row) => row.glyph));
    expect(named.size).toBe(202);
    expect([...named].filter((glyph) => !adobe.has(glyph))).toEqual(['space']);
    expect([...adobe.keys()].filter((glyph) => !named.has(glyph))).toEqual([]);
  });

  it('gives each glyph its own Unicode value', () => {
    expect(new Set(adobe.values()).size).toBe(adobe.size);
  });
});

describe('the ZapfDingbats rows of annex-d.json', () => {
  it('give each glyph the Unicode value Adobe lists, as `unicode` or, for the 14 codes 0x80-0x8D that Annex D lacks, as an alternate', () => {
    const wrong: string[] = [];
    for (const row of rows) {
      const want = adobe.get(row.glyph);
      if (want === undefined) continue; // space, checked below
      const ok = row.annexD === false ? row.alternates?.includes(want) : row.unicode === want;
      if (ok !== true) {
        wrong.push(
          `0x${row.code.toString(16)} ${row.glyph}: fixture ${row.unicode}, Adobe ${want}`,
        );
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keep the 14 codes of the font that Annex D lacks at 0x80-0x8D', () => {
    const extra = rows.filter((row) => row.annexD === false).map((row) => row.code);
    expect(extra).toEqual(Array.from({ length: 14 }, (_, index) => 0x80 + index));
  });

  it('read space as U+0020, which the glyph list does not hold', () => {
    expect(rows.find((row) => row.glyph === 'space')?.unicode).toBe('U+0020');
  });
});

describe('ZapfDingbatsEncoding of standardEncoding.ts', () => {
  it('holds the Unicode value Adobe lists for every glyph of Annex D D.6', () => {
    const table = STANDARD_CODE_TO_UNICODE.ZapfDingbatsEncoding;
    const wrong: string[] = [];
    for (const row of rows) {
      const want = adobe.get(row.glyph);
      if (want === undefined || row.annexD === false) continue;
      const have = `U+${(table[row.code] ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
      if (have !== want) {
        wrong.push(`0x${row.code.toString(16)} ${row.glyph}: table ${have}, Adobe ${want}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

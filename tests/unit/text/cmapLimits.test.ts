/**
 * Limits on the mappings a ToUnicode CMap and a font cmap subtable may write: a CMap writes at most
 * INTERNAL_LIMITS.maxCMapMappings mappings, a cmap subtable names at most maxFontCmapMappings
 * codes, and a cmap stores no glyph id at or above the font's numGlyphs. Ordinary CMaps and fonts
 * are unchanged. The hostile-input budget cases are in tests/adversarial/text-limits.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { INTERNAL_LIMITS } from '../../../src/core/limits.js';
import { ResourceLimitError } from '../../../src/errors.js';
import { extractMetrics } from '../../../src/assets/font/fontMetrics.js';
import { PdfDict, PdfName, PdfStream } from '../../../src/core/pdfObjects.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import {
  extractText,
  extractTextWithPositions,
  parseToUnicodeCMap,
} from '../../../src/parser/textExtractor.js';
import { bfcharCMap, bfrangeCMap, buildCmapFont } from '../../adversarial/text-limits.bodies.js';
import type { CmapFontSpec, CmapRange } from '../../adversarial/text-limits.bodies.js';

const MAX_CMAP = INTERNAL_LIMITS.maxCMapMappings;
const MAX_FONT = INTERNAL_LIMITS.maxFontCmapMappings;
const enc = new TextEncoder();

function limitError(run: () => unknown, limit: string): ResourceLimitError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ResourceLimitError);
    expect((error as ResourceLimitError).limit).toBe(limit);
    return error as ResourceLimitError;
  }
  throw new Error('expected a ResourceLimitError');
}

describe('text limits: ToUnicode CMap', () => {
  it('refuses a CMap that writes more than the mapping limit', () => {
    const error = limitError(
      () => parseToUnicodeCMap(bfrangeCMap([[0, MAX_CMAP]])),
      'maxCMapMappings',
    );
    expect(error.max).toBe(MAX_CMAP);
    expect(error.message).toBe(
      `Input exceeds the internal limit maxCMapMappings (${MAX_CMAP} mappings).`,
    );
  });

  it('accepts a CMap that writes exactly the mapping limit', () => {
    const cmap = parseToUnicodeCMap(bfrangeCMap([[0, MAX_CMAP - 1]]));
    expect(cmap.map.size).toBe(MAX_CMAP);
  });

  it('counts the codes of every range together', () => {
    const half = MAX_CMAP / 2;
    limitError(
      () =>
        parseToUnicodeCMap(
          bfrangeCMap([
            [0, half - 1],
            [half, MAX_CMAP - 1],
            [MAX_CMAP, MAX_CMAP],
          ]),
        ),
      'maxCMapMappings',
    );
  });

  it('counts the entries of a bfchar section', () => {
    expect(parseToUnicodeCMap(bfcharCMap(1000)).map.size).toBe(1000);
    limitError(() => parseToUnicodeCMap(bfcharCMap(MAX_CMAP + 1)), 'maxCMapMappings');
  });

  it('counts the entries of a range written as an array', () => {
    const entries = '<0041> '.repeat(MAX_CMAP + 1);
    const cmap = `beginbfrange\n<00000000> <ffffffff> [${entries}]\nendbfrange`;
    limitError(() => parseToUnicodeCMap(enc.encode(cmap)), 'maxCMapMappings');
  });

  it('refuses a range whose code count is not a finite number', () => {
    const big = 'f'.repeat(400);
    limitError(
      () => parseToUnicodeCMap(enc.encode(`beginbfrange\n<00> <${big}> <0041>\nendbfrange`)),
      'maxCMapMappings',
    );
  });

  it('writes nothing for a range whose high code is below its low code', () => {
    const cmap = parseToUnicodeCMap(enc.encode('beginbfrange\n<0010> <0005> <0041>\nendbfrange'));
    expect(cmap.map.size).toBe(0);
  });

  it('maps ordinary ranges, arrays and characters as before', () => {
    const cmap = parseToUnicodeCMap(
      enc.encode(
        [
          'beginbfchar',
          '<0001> <0041>',
          'endbfchar',
          'beginbfrange',
          '<0010> <0012> <0061>',
          '<0020> <0021> [<0058> <0059>]',
          'endbfrange',
        ].join('\n'),
      ),
    );
    expect([...cmap.map]).toEqual([
      [1, 'A'],
      [0x10, 'a'],
      [0x11, 'b'],
      [0x12, 'c'],
      [0x20, 'X'],
      [0x21, 'Y'],
    ]);
  });

  describe('through the text extractor', () => {
    function resourcesWith(cmap: Uint8Array): PdfDict {
      const font = new PdfDict();
      font.set('/Subtype', PdfName.of('/Type1'));
      font.set('/ToUnicode', PdfStream.fromBytes(cmap));
      const fonts = new PdfDict();
      fonts.set('/F1', font);
      const resources = new PdfDict();
      resources.set('/Font', fonts);
      return resources;
    }
    const operators = parseContentStream(enc.encode('BT /F1 12 Tf (A) Tj ET'));

    it('rethrows the limit error from extractText', () => {
      const resources = resourcesWith(bfrangeCMap([[0, MAX_CMAP]]));
      limitError(() => extractText(operators, resources), 'maxCMapMappings');
    });

    it('rethrows the limit error from extractTextWithPositions', () => {
      const resources = resourcesWith(bfrangeCMap([[0, MAX_CMAP]]));
      limitError(() => extractTextWithPositions(operators, resources), 'maxCMapMappings');
    });

    it('still treats an unparsable CMap as no CMap', () => {
      const resources = resourcesWith(enc.encode('beginbfrange\n<00> <01> <110000>\nendbfrange'));
      expect(extractText(operators, resources)).toBe('A');
    });
  });
});

describe('text limits: font cmap', () => {
  const cmapOf = (spec: CmapFontSpec) => extractMetrics(buildCmapFont(spec)).cmapTable;

  it('refuses a cmap subtable that writes more than the entry limit', () => {
    // 18 overlapping groups of 0x10000 codes: 18 x 65,536 = 1,179,648 codes.
    const groups: CmapRange[] = Array.from({ length: 18 }, () => [0, 0xffff, 1]);
    const error = limitError(
      () => cmapOf({ format: 12, numGlyphs: 0xffff, ranges: groups }),
      'maxFontCmapMappings',
    );
    expect(error.message).toBe(
      `Input exceeds the internal limit maxFontCmapMappings (${MAX_FONT} entries).`,
    );
  });

  it('refuses two groups that each run past the code space (each counts 0x110000 codes after clamping)', () => {
    limitError(
      () =>
        cmapOf({
          format: 12,
          numGlyphs: 10,
          ranges: [
            [0, 0xffffffff, 1],
            [0, 0xffffffff, 1],
          ],
        }),
      'maxFontCmapMappings',
    );
  });

  it('accepts one group that runs past the code space (it counts exactly the limit)', () => {
    const map = cmapOf({ format: 12, numGlyphs: 10, ranges: [[0, 0xffffffff, 1]] });
    expect([...map]).toEqual(Array.from({ length: 9 }, (_, code) => [code, code + 1]));
  });

  it('refuses overlapping format 4 segments that name more codes than the limit', () => {
    const segments: CmapRange[] = Array.from({ length: 18 }, () => [1, 0xfffe, 1]);
    limitError(
      () => cmapOf({ format: 4, numGlyphs: 0xffff, ranges: segments }),
      'maxFontCmapMappings',
    );
  });

  it('stores no glyph id at or above numGlyphs (format 12)', () => {
    const map = cmapOf({
      format: 12,
      numGlyphs: 5,
      ranges: [
        [0x41, 0x48, 1],
        [0x1f600, 0x1f601, 9],
      ],
    });
    expect([...map]).toEqual([
      [0x41, 1],
      [0x42, 2],
      [0x43, 3],
      [0x44, 4],
    ]);
  });

  it('stores no glyph id at or above numGlyphs (format 4)', () => {
    const map = cmapOf({
      format: 4,
      numGlyphs: 5,
      ranges: [
        [0x41, 0x48, 1],
        [0x100, 0x101, 9],
      ],
    });
    expect([...map]).toEqual([
      [0x41, 1],
      [0x42, 2],
      [0x43, 3],
      [0x44, 4],
    ]);
  });

  it('clamps a format 12 group to the end of the code space and skips an inverted group', () => {
    const map = cmapOf({
      format: 12,
      numGlyphs: 100,
      ranges: [
        [0x10fffe, 0xffffffff, 1],
        [0x50, 0x40, 3],
      ],
    });
    expect([...map]).toEqual([
      [0x10fffe, 1],
      [0x10ffff, 2],
    ]);
  });

  it('reads only the groups that fit before the end of the cmap table', () => {
    const font = buildCmapFont({ format: 12, numGlyphs: 10, ranges: [[0x41, 0x42, 1]] });
    // The cmap table starts at the first directory entry's offset; numGroups is 12 bytes into
    // the subtable, which starts 12 bytes into the table. Claim 10^9 groups: the table holds one.
    const view = new DataView(font.buffer);
    view.setUint32(view.getUint32(12 + 8) + 12 + 12, 1_000_000_000);
    expect([...extractMetrics(font).cmapTable]).toEqual([
      [0x41, 1],
      [0x42, 2],
    ]);
  });

  it('maps ordinary subtables as before', () => {
    const expected = [
      [0x41, 1],
      [0x42, 2],
      [0x43, 3],
    ];
    expect([...cmapOf({ format: 12, numGlyphs: 10, ranges: [[0x41, 0x43, 1]] })]).toEqual(expected);
    expect([...cmapOf({ format: 4, numGlyphs: 10, ranges: [[0x41, 0x43, 1]] })]).toEqual(expected);
  });

  it('accepts a subtable that names exactly the entry limit of codes', () => {
    const groups: CmapRange[] = [
      [0, 0xffff, 1],
      [0x10000, 0x10ffff, 1],
    ];
    // Each group stores the 65,534 codes whose glyph ids (1 to 65,534) are below numGlyphs.
    expect(cmapOf({ format: 12, numGlyphs: 0xffff, ranges: groups }).size).toBe(2 * 65_534);
  });
});

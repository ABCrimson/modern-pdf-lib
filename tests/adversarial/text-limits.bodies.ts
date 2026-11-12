/**
 * Entries for text-limits.test.ts. The budgeted runner loads this module in a worker and calls one
 * named export with the input bytes and the task's args. Every input is built in code: a CMap is a
 * short string, a font is a few hundred bytes of tables (see {@link buildCmapFont}).
 */
import type { JsonValue } from '../helpers/budget.js';
import { parseToUnicodeCMap } from '../../src/parser/textExtractor.js';
import { extractMetrics } from '../../src/assets/font/fontMetrics.js';

/** One cmap format 12 group, or one format 4 segment (`glyph` is the idDelta-based start glyph). */
export type CmapRange = readonly [start: number, end: number, glyph: number];

/** The cmap subtable of a font built by {@link buildCmapFont}. */
export interface CmapFontSpec {
  /** Subtable format: 4 (BMP segments) or 12 (32-bit groups). */
  readonly format: 4 | 12;
  /** The `maxp` numGlyphs value. */
  readonly numGlyphs: number;
  /** Groups (format 12) or segments (format 4; the terminating 0xFFFF segment is appended). */
  readonly ranges: readonly CmapRange[];
}

const TABLES = ['cmap', 'head', 'hhea', 'hmtx', 'maxp'] as const;

/**
 * Builds the smallest font `extractMetrics` accepts (`head`, `hhea`, `hmtx`, `maxp`) with one
 * `cmap` subtable on platform 3: format 12 on encoding 10, format 4 on encoding 1.
 */
export function buildCmapFont(spec: CmapFontSpec): Uint8Array {
  const ranges = spec.ranges;
  let sub: Uint8Array;
  if (spec.format === 12) {
    sub = new Uint8Array(16 + 12 * ranges.length);
    const v = new DataView(sub.buffer);
    v.setUint16(0, 12);
    v.setUint32(4, sub.length);
    v.setUint32(12, ranges.length);
    ranges.forEach(([start, end, glyph], i) => {
      v.setUint32(16 + i * 12, start);
      v.setUint32(20 + i * 12, end);
      v.setUint32(24 + i * 12, glyph);
    });
  } else {
    const segs = [...ranges, [0xffff, 0xffff, 1] as const];
    const n = segs.length;
    sub = new Uint8Array(16 + 8 * n);
    const v = new DataView(sub.buffer);
    v.setUint16(0, 4);
    v.setUint16(2, sub.length);
    v.setUint16(6, n * 2);
    segs.forEach(([start, end, glyph], i) => {
      v.setUint16(14 + i * 2, end);
      v.setUint16(16 + n * 2 + i * 2, start);
      // idDelta maps `start` to `glyph`; idRangeOffset stays 0.
      v.setInt16(16 + n * 4 + i * 2, glyph - start);
    });
  }
  const cmap = new Uint8Array(12 + sub.length);
  const cv = new DataView(cmap.buffer);
  cv.setUint16(2, 1);
  cv.setUint16(4, 3);
  cv.setUint16(6, spec.format === 12 ? 10 : 1);
  cv.setUint32(8, 12);
  cmap.set(sub, 12);

  const head = new Uint8Array(54);
  new DataView(head.buffer).setUint16(18, 1000);
  const hhea = new Uint8Array(36);
  new DataView(hhea.buffer).setUint16(34, 1);
  const hmtx = new Uint8Array(4);
  new DataView(hmtx.buffer).setUint16(0, 500);
  const maxp = new Uint8Array(6);
  new DataView(maxp.buffer).setUint16(4, spec.numGlyphs);
  const bodies: Record<(typeof TABLES)[number], Uint8Array> = { cmap, head, hhea, hmtx, maxp };

  const dirEnd = 12 + 16 * TABLES.length;
  let total = dirEnd;
  for (const tag of TABLES) total += (bodies[tag].length + 3) & ~3;
  const font = new Uint8Array(total);
  const fv = new DataView(font.buffer);
  fv.setUint32(0, 0x00010000);
  fv.setUint16(4, TABLES.length);
  let at = dirEnd;
  TABLES.forEach((tag, i) => {
    for (let c = 0; c < 4; c++) font[12 + i * 16 + c] = tag.charCodeAt(c);
    fv.setUint32(12 + i * 16 + 8, at);
    fv.setUint32(12 + i * 16 + 12, bodies[tag].length);
    font.set(bodies[tag], at);
    at += (bodies[tag].length + 3) & ~3;
  });
  return font;
}

const hex = (n: number): string => n.toString(16).padStart(8, '0');
const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A CMap with one bfrange line `<low> <high> <0041>` for each `[low, high]` span. */
export function bfrangeCMap(spans: readonly (readonly [number, number])[]): Uint8Array {
  const rows = spans.map(([lo, hi]) => `<${hex(lo)}> <${hex(hi)}> <0041>`).join('\n');
  return ascii(`beginbfrange\n${rows}\nendbfrange\n`);
}

/** A CMap with `count` bfchar entries, one code each. */
export function bfcharCMap(count: number): Uint8Array {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) rows.push(`<${hex(i)}> <0041>`);
  return ascii(`beginbfchar\n${rows.join('\n')}\nendbfchar\n`);
}

/** A CMap whose bfchar section never ends: the marker followed by `spaces` spaces. */
export function unterminatedBfchar(spaces: number): Uint8Array {
  return ascii(`beginbfchar${' '.repeat(spaces)}`);
}

/** A CMap that opens `count` bfrange sections and never closes one. */
export function unterminatedBfranges(count: number): Uint8Array {
  return ascii('beginbfrange '.repeat(count));
}

/** Parses the input as a ToUnicode CMap; returns the number of codes it maps. */
export function toUnicode(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return parseToUnicodeCMap(bytes).map.size;
}

/** Builds a font from `args` (a {@link CmapFontSpec}) and returns the size of its cmap. */
export function fontCmap(_bytes: Uint8Array, args: JsonValue): JsonValue {
  return extractMetrics(buildCmapFont(args as unknown as CmapFontSpec)).cmapTable.size;
}

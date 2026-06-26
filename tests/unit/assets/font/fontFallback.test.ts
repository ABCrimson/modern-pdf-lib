import { describe, it, expect } from 'vitest';
import {
  resolveFallback,
  splitByScript,
} from '../../../../src/assets/font/fontFallback.js';
import type { FallbackFont } from '../../../../src/assets/font/fontFallback.js';

const latin: FallbackFont = {
  name: 'Latin',
  covers: (cp) => (cp >= 0x0041 && cp <= 0x005a) || (cp >= 0x0061 && cp <= 0x007a),
};

const cjk: FallbackFont = {
  name: 'CJK',
  covers: (cp) =>
    (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x4e00 && cp <= 0x9fff),
};

describe('resolveFallback', () => {
  it("routes 'Aあ' to the Latin and CJK fonts as two runs", () => {
    const runs = resolveFallback('Aあ', [latin, cjk]);
    expect(runs).toEqual([
      { font: 'Latin', text: 'A', start: 0 },
      { font: 'CJK', text: 'あ', start: 1 },
    ]);
  });

  it("coalesces 'AB' into a single run", () => {
    const runs = resolveFallback('AB', [latin, cjk]);
    expect(runs).toEqual([{ font: 'Latin', text: 'AB', start: 0 }]);
  });

  it('uses the last font as the ultimate fallback even if it does not cover', () => {
    const runs = resolveFallback('#', [latin, cjk]);
    expect(runs).toEqual([{ font: 'CJK', text: '#', start: 0 }]);
  });

  it('picks the first covering font when multiple cover a code point', () => {
    const latinTwo: FallbackFont = { name: 'Latin2', covers: latin.covers };
    const runs = resolveFallback('A', [latin, latinTwo]);
    expect(runs).toEqual([{ font: 'Latin', text: 'A', start: 0 }]);
  });

  it('iterates by code point so astral characters are one unit', () => {
    // U+20000 (CJK Extension B) is a surrogate pair in UTF-16.
    const astral = String.fromCodePoint(0x20000);
    const han: FallbackFont = {
      name: 'Han',
      covers: (cp) => cp >= 0x20000 && cp <= 0x2a6df,
    };
    const runs = resolveFallback('A' + astral, [latin, han]);
    expect(runs).toEqual([
      { font: 'Latin', text: 'A', start: 0 },
      { font: 'Han', text: astral, start: 1 },
    ]);
  });

  it('returns an empty array for empty text', () => {
    expect(resolveFallback('', [latin, cjk])).toEqual([]);
  });

  it('returns an empty array when no fonts are provided', () => {
    expect(resolveFallback('A', [])).toEqual([]);
  });
});

describe('splitByScript', () => {
  it("splits 'Aあ' into Latin and Hiragana with correct offsets", () => {
    expect(splitByScript('Aあ')).toEqual([
      { script: 'Latin', text: 'A', start: 0 },
      { script: 'Hiragana', text: 'あ', start: 1 },
    ]);
  });

  it('coalesces consecutive same-script code points', () => {
    expect(splitByScript('Hello')).toEqual([
      { script: 'Latin', text: 'Hello', start: 0 },
    ]);
  });

  it('classifies spaces and digits as Common', () => {
    expect(splitByScript('A 1')).toEqual([
      { script: 'Latin', text: 'A', start: 0 },
      { script: 'Common', text: ' 1', start: 1 },
    ]);
  });

  it('detects Greek, Cyrillic, Arabic, Hebrew, Katakana, and Hangul', () => {
    expect(splitByScript('α').map((r) => r.script)).toEqual(['Greek']);
    expect(splitByScript('д').map((r) => r.script)).toEqual(['Cyrillic']);
    expect(splitByScript('ا').map((r) => r.script)).toEqual(['Arabic']);
    expect(splitByScript('א').map((r) => r.script)).toEqual(['Hebrew']);
    expect(splitByScript('カ').map((r) => r.script)).toEqual(['Katakana']);
    expect(splitByScript('한').map((r) => r.script)).toEqual(['Hangul']);
    expect(splitByScript('中').map((r) => r.script)).toEqual(['Han']);
  });

  it('uses code-point offsets across an astral character boundary', () => {
    const astral = String.fromCodePoint(0x20000); // Han Extension B
    const runs = splitByScript('A' + astral + 'B');
    expect(runs).toEqual([
      { script: 'Latin', text: 'A', start: 0 },
      { script: 'Han', text: astral, start: 1 },
      { script: 'Latin', text: 'B', start: 2 },
    ]);
  });

  it('returns an empty array for empty text', () => {
    expect(splitByScript('')).toEqual([]);
  });
});

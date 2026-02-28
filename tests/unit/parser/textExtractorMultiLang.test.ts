/**
 * Multi-language text extraction tests.
 *
 * Validates that extractText() and extractTextWithPositions() correctly
 * handle CID (Type0) fonts with ToUnicode CMaps for Chinese, Japanese,
 * Korean, Arabic, Hebrew, Devanagari, Thai, mixed scripts, combining
 * characters, emoji, and Arabic with embedded numbers.
 *
 * Each test builds synthetic content-stream operators and a resource
 * dictionary with a properly structured ToUnicode CMap, then asserts
 * that the extraction pipeline produces the expected Unicode string.
 */

import { describe, it, expect } from 'vitest';
import {
  extractText,
  extractTextWithPositions,
  parseToUnicodeCMap,
} from '../../../src/parser/textExtractor.js';
import type { ContentStreamOperator } from '../../../src/parser/contentStreamParser.js';
import {
  PdfDict,
  PdfName,
  PdfStream,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Build a minimal ToUnicode CMap string from a mapping of glyph IDs to
 * Unicode codepoints.  Each glyph ID is a 4-hex-digit source code and
 * each codepoint is a 4-hex-digit destination value in a
 * `beginbfchar`/`endbfchar` block.
 */
function makeToUnicodeCMap(mappings: Map<number, number>): string {
  let cmap = '/CIDInit /ProcSet findresource begin\n';
  cmap += '12 dict begin\n';
  cmap += 'begincmap\n';
  cmap += '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n';
  cmap += '/CMapName /Adobe-Identity-UCS def\n';
  cmap += '/CMapType 2 def\n';
  cmap += '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  cmap += `${mappings.size} beginbfchar\n`;
  for (const [gid, cp] of mappings) {
    cmap += `<${gid.toString(16).padStart(4, '0')}> <${cp.toString(16).padStart(4, '0')}>\n`;
  }
  cmap += 'endbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
  return cmap;
}

/**
 * Build a ToUnicode CMap string where destination values are raw hex
 * strings (not limited to 4 hex digits).  This is needed for
 * supplementary-plane characters encoded as UTF-16 surrogate pairs.
 */
function makeToUnicodeCMapRaw(mappings: Map<number, string>): string {
  let cmap = '/CIDInit /ProcSet findresource begin\n';
  cmap += '12 dict begin\n';
  cmap += 'begincmap\n';
  cmap += '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n';
  cmap += '/CMapName /Adobe-Identity-UCS def\n';
  cmap += '/CMapType 2 def\n';
  cmap += '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  cmap += `${mappings.size} beginbfchar\n`;
  for (const [gid, hexDst] of mappings) {
    cmap += `<${gid.toString(16).padStart(4, '0')}> <${hexDst}>\n`;
  }
  cmap += 'endbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
  return cmap;
}

/**
 * Build a font resources PdfDict with a CID (Type0) font that has a
 * ToUnicode CMap.
 */
function makeCIDFontResource(fontName: string, cmap: string): PdfDict {
  const cmapStream = PdfStream.fromBytes(encoder.encode(cmap));

  const fontDict = new PdfDict();
  fontDict.set('/Subtype', PdfName.of('/Type0'));
  fontDict.set('/BaseFont', PdfName.of('/TestFont'));
  fontDict.set('/Encoding', PdfName.of('/Identity-H'));
  fontDict.set('/ToUnicode', cmapStream);

  const fonts = new PdfDict();
  fonts.set(`/${fontName}`, fontDict);

  const resources = new PdfDict();
  resources.set('/Font', fonts);
  return resources;
}

/**
 * Create content stream operators that show hex-encoded CID text.
 *
 * For a CID (Type0) font, the Tj operand is a binary string where
 * each glyph is represented as 2 bytes (big-endian).
 */
function makeCIDTextOps(
  fontName: string,
  fontSize: number,
  gids: number[],
  x: number = 72,
  y: number = 700,
): ContentStreamOperator[] {
  let raw = '';
  for (const gid of gids) {
    raw += String.fromCharCode((gid >> 8) & 0xff);
    raw += String.fromCharCode(gid & 0xff);
  }

  return [
    { operator: 'BT', operands: [] },
    { operator: 'Tf', operands: [`/${fontName}`, fontSize] },
    { operator: 'Td', operands: [x, y] },
    { operator: 'Tj', operands: [raw] },
    { operator: 'ET', operands: [] },
  ];
}

/**
 * Encode an array of CID glyph IDs into a raw 2-byte-per-character
 * binary string (the format the content-stream parser produces from
 * a hex string operand).
 */
function cidRaw(gids: number[]): string {
  let raw = '';
  for (const gid of gids) {
    raw += String.fromCharCode((gid >> 8) & 0xff);
    raw += String.fromCharCode(gid & 0xff);
  }
  return raw;
}

// ===========================================================================
// 1. Chinese (CJK Unified Ideographs U+4E00-U+9FFF)
// ===========================================================================

describe('Multi-lang: Chinese (CJK Unified)', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x4f60], // 你
    [0x0002, 0x597d], // 好
    [0x0003, 0x4e16], // 世
    [0x0004, 0x754c], // 界
    [0x0005, 0xff01], // ！ (full-width exclamation)
  ]);

  it('extracts short Chinese greeting', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u4F60\u597D'); // 你好
  });

  it('extracts longer Chinese phrase with full-width punctuation', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
    const text = extractText(ops, resources);
    expect(text).toBe('你好世界\uFF01');
  });

  it('returns positioned items for Chinese text', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 14, [0x0001, 0x0002], 100, 500);
    const items = extractTextWithPositions(ops, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u4F60\u597D');
    expect(items[0]!.fontSize).toBe(14);
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(500);
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.width).toBeGreaterThan(0);
  });

  it('handles Chinese text across multiple Tj operators', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'Tj', operands: [cidRaw([0x0003, 0x0004])] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toBe('\u4F60\u597D\u4E16\u754C'); // 你好世界
  });
});

// ===========================================================================
// 2. Japanese (Hiragana U+3040-U+309F, Katakana, Kanji mix)
// ===========================================================================

describe('Multi-lang: Japanese', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x3053], // こ (Hiragana)
    [0x0002, 0x3093], // ん
    [0x0003, 0x306b], // に
    [0x0004, 0x3061], // ち
    [0x0005, 0x306f], // は
    [0x0010, 0x30ab], // カ (Katakana)
    [0x0011, 0x30bf], // タ
    [0x0012, 0x30ab], // カ
    [0x0013, 0x30ca], // ナ
    [0x0020, 0x6771], // 東 (Kanji)
    [0x0021, 0x4eac], // 京
  ]);

  it('extracts Hiragana greeting', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u3053\u3093\u306B\u3061\u306F'); // こんにちは
  });

  it('extracts Katakana text', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0010, 0x0011, 0x0012, 0x0013]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u30AB\u30BF\u30AB\u30CA'); // カタカナ
  });

  it('extracts mixed Kanji + Hiragana', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [
      0x0020, 0x0021, // 東京
      0x0001, 0x0002, 0x0003, 0x0004, 0x0005, // こんにちは
    ]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u6771\u4EAC\u3053\u3093\u306B\u3061\u306F'); // 東京こんにちは
  });

  it('extracts Katakana + Kanji + Hiragana interleaved', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0010, 0x0020, 0x0001]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u30AB\u6771\u3053'); // カ東こ
  });

  it('reports positions for Japanese text items', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 18, [0x0001, 0x0002, 0x0003], 50, 600);
    const items = extractTextWithPositions(ops, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u3053\u3093\u306B');
    expect(items[0]!.x).toBeCloseTo(50);
    expect(items[0]!.y).toBeCloseTo(600);
    expect(items[0]!.fontSize).toBe(18);
  });
});

// ===========================================================================
// 3. Korean (Hangul syllables U+AC00-U+D7AF)
// ===========================================================================

describe('Multi-lang: Korean (Hangul)', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0xd55c], // 한
    [0x0002, 0xad6d], // 국
    [0x0003, 0xc5b4], // 어
    [0x0004, 0xc548], // 안
    [0x0005, 0xb155], // 녕
    [0x0006, 0xd558], // 하
    [0x0007, 0xc138], // 세
    [0x0008, 0xc694], // 요
  ]);

  it('extracts Korean word', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003]);
    const text = extractText(ops, resources);
    expect(text).toBe('\uD55C\uAD6D\uC5B4'); // 한국어
  });

  it('extracts Korean greeting', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0004, 0x0005, 0x0006, 0x0007, 0x0008]);
    const text = extractText(ops, resources);
    expect(text).toBe('\uC548\uB155\uD558\uC138\uC694'); // 안녕하세요
  });

  it('extracts Korean in multiple BT/ET blocks', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002, 0x0003])] },
      { operator: 'ET', operands: [] },
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 680] },
      { operator: 'Tj', operands: [cidRaw([0x0004, 0x0005, 0x0006, 0x0007, 0x0008])] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toContain('\uD55C\uAD6D\uC5B4'); // 한국어
    expect(text).toContain('\uC548\uB155\uD558\uC138\uC694'); // 안녕하세요
  });
});

// ===========================================================================
// 4. Arabic (U+0600-U+06FF, RTL)
// ===========================================================================

describe('Multi-lang: Arabic (RTL)', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x0645], // م
    [0x0002, 0x0631], // ر
    [0x0003, 0x062d], // ح
    [0x0004, 0x0628], // ب
    [0x0005, 0x0627], // ا
  ]);

  it('extracts Arabic word (logical order)', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0645\u0631\u062D\u0628\u0627'); // مرحبا
  });

  it('preserves all Arabic code points', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
    const text = extractText(ops, resources);
    expect(text).toContain('\u0645');
    expect(text).toContain('\u0631');
    expect(text).toContain('\u062D');
    expect(text).toContain('\u0628');
    expect(text).toContain('\u0627');
  });

  it('returns positioned item for Arabic text', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 16, [0x0001, 0x0002, 0x0003], 200, 400);
    const items = extractTextWithPositions(ops, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u0645\u0631\u062D');
    expect(items[0]!.fontSize).toBe(16);
    expect(items[0]!.x).toBeCloseTo(200);
    expect(items[0]!.y).toBeCloseTo(400);
  });
});

// ===========================================================================
// 5. Hebrew (U+0590-U+05FF, RTL)
// ===========================================================================

describe('Multi-lang: Hebrew (RTL)', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x05e9], // ש
    [0x0002, 0x05dc], // ל
    [0x0003, 0x05d5], // ו
    [0x0004, 0x05dd], // ם
    [0x0005, 0x05e2], // ע
    [0x0006, 0x05d1], // ב
    [0x0007, 0x05e8], // ר
    [0x0008, 0x05d9], // י
    [0x0009, 0x05ea], // ת
  ]);

  it('extracts Hebrew word "shalom"', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u05E9\u05DC\u05D5\u05DD'); // שלום
  });

  it('extracts Hebrew word "ivrit"', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0005, 0x0006, 0x0007, 0x0008, 0x0009]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u05E2\u05D1\u05E8\u05D9\u05EA'); // עברית
  });

  it('extracts Hebrew with multiple Tj operators in one BT/ET block', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'Tj', operands: [cidRaw([0x0003, 0x0004])] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toBe('\u05E9\u05DC\u05D5\u05DD'); // שלום
  });
});

// ===========================================================================
// 6. Devanagari (U+0900-U+097F, complex script)
// ===========================================================================

describe('Multi-lang: Devanagari', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x0928], // न
    [0x0002, 0x092e], // म
    [0x0003, 0x0938], // स
    [0x0004, 0x094d], // ् (virama)
    [0x0005, 0x0924], // त
    [0x0006, 0x0947], // े (vowel sign e)
    [0x0007, 0x0939], // ह
    [0x0008, 0x093f], // ि (vowel sign i)
    [0x0009, 0x0902], // ं (anusvara)
    [0x000a, 0x0926], // द
    [0x000b, 0x0940], // ी (vowel sign ii)
  ]);

  it('extracts Devanagari "namaste"', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    // नमस्ते
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0928\u092E\u0938\u094D\u0924\u0947'); // नमस्ते
  });

  it('extracts Devanagari with anusvara', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    // हिंदी
    const ops = makeCIDTextOps('F1', 12, [0x0007, 0x0008, 0x0009, 0x000a, 0x000b]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0939\u093F\u0902\u0926\u0940'); // हिंदी
  });

  it('extracts Devanagari base characters alone', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0928\u092E'); // नम
  });
});

// ===========================================================================
// 7. Thai (U+0E00-U+0E7F, no word boundaries)
// ===========================================================================

describe('Multi-lang: Thai', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x0e2a], // ส
    [0x0002, 0x0e27], // ว
    [0x0003, 0x0e31], // ั (sara am)
    [0x0004, 0x0e2a], // ส (same char, different glyph slot)
    [0x0005, 0x0e14], // ด
    [0x0006, 0x0e35], // ี (sara ii)
    [0x0010, 0x0e20], // ภ
    [0x0011, 0x0e32], // า
    [0x0012, 0x0e29], // ษ
  ]);

  it('extracts Thai greeting "sawasdee"', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35'); // สวัสดี
  });

  it('extracts Thai with additional characters', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0010, 0x0011, 0x0012, 0x0011]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0E20\u0E32\u0E29\u0E32'); // ภาษา
  });

  it('reports positions for Thai text', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 20, [0x0001, 0x0002, 0x0003], 72, 700);
    const items = extractTextWithPositions(ops, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u0E2A\u0E27\u0E31');
    expect(items[0]!.x).toBeCloseTo(72);
    expect(items[0]!.y).toBeCloseTo(700);
  });
});

// ===========================================================================
// 8. Mixed scripts (Latin + CJK in same text run)
// ===========================================================================

describe('Multi-lang: Mixed scripts (Latin + CJK)', () => {
  it('extracts mixed Latin + CJK from same CID font', () => {
    const mappings = new Map<number, number>([
      [0x0041, 0x0041], // A
      [0x0042, 0x0042], // B
      [0x0043, 0x0043], // C
      [0x0100, 0x4e16], // 世
      [0x0101, 0x754c], // 界
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0041, 0x0042, 0x0043, 0x0100, 0x0101]);
    const text = extractText(ops, resources);
    expect(text).toBe('ABC\u4E16\u754C'); // ABC世界
  });

  it('extracts CJK then Latin in same run', () => {
    const mappings = new Map<number, number>([
      [0x0041, 0x0041], // A
      [0x0042, 0x0042], // B
      [0x0100, 0x4e16], // 世
      [0x0101, 0x754c], // 界
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0100, 0x0101, 0x0041, 0x0042]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u4E16\u754CAB'); // 世界AB
  });

  it('interleaves Latin and CJK', () => {
    const mappings = new Map<number, number>([
      [0x0041, 0x0041], // A
      [0x0042, 0x0042], // B
      [0x0100, 0x4e16], // 世
      [0x0101, 0x754c], // 界
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0041, 0x0100, 0x0042, 0x0101]);
    const text = extractText(ops, resources);
    expect(text).toBe('A\u4E16B\u754C'); // A世B界
  });

  it('extracts Latin + CJK from separate BT/ET blocks with different fonts', () => {
    // WinAnsi font for Latin
    const winAnsiFont = new PdfDict();
    winAnsiFont.set('/Subtype', PdfName.of('/Type1'));
    winAnsiFont.set('/Encoding', PdfName.of('/WinAnsiEncoding'));

    // CID font for CJK
    const cjkMappings = new Map<number, number>([
      [0x0001, 0x4e16], // 世
      [0x0002, 0x754c], // 界
    ]);
    const cmap = makeToUnicodeCMap(cjkMappings);
    const cmapStream = PdfStream.fromBytes(encoder.encode(cmap));

    const cidFont = new PdfDict();
    cidFont.set('/Subtype', PdfName.of('/Type0'));
    cidFont.set('/BaseFont', PdfName.of('/CJKFont'));
    cidFont.set('/Encoding', PdfName.of('/Identity-H'));
    cidFont.set('/ToUnicode', cmapStream);

    const fonts = new PdfDict();
    fonts.set('/F1', winAnsiFont);
    fonts.set('/F2', cidFont);

    const resources = new PdfDict();
    resources.set('/Font', fonts);

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: ['Hello'] },
      { operator: 'ET', operands: [] },
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F2', 12] },
      { operator: 'Td', operands: [120, 700] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toContain('Hello');
    expect(text).toContain('\u4E16\u754C'); // 世界
  });
});

// ===========================================================================
// 9. Combining characters (diacritics via combining marks)
// ===========================================================================

describe('Multi-lang: Combining characters', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x0065], // e
    [0x0002, 0x0301], // combining acute accent
    [0x0003, 0x006e], // n
    [0x0004, 0x0303], // combining tilde
    [0x0005, 0x0061], // a
    [0x0006, 0x0308], // combining diaeresis
    [0x0007, 0x006f], // o
    [0x0008, 0x0302], // combining circumflex
  ]);

  it('extracts e + combining acute as decomposed form', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002]);
    const text = extractText(ops, resources);
    expect(text).toBe('e\u0301');
    expect(text.normalize('NFC')).toBe('\u00E9'); // e-acute
  });

  it('extracts n + combining tilde', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0003, 0x0004]);
    const text = extractText(ops, resources);
    expect(text).toBe('n\u0303');
    expect(text.normalize('NFC')).toBe('\u00F1'); // n-tilde
  });

  it('extracts a + combining diaeresis (a-umlaut)', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0005, 0x0006]);
    const text = extractText(ops, resources);
    expect(text).toBe('a\u0308');
    expect(text.normalize('NFC')).toBe('\u00E4'); // a-umlaut
  });

  it('extracts o + combining circumflex', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0007, 0x0008]);
    const text = extractText(ops, resources);
    expect(text).toBe('o\u0302');
    expect(text.normalize('NFC')).toBe('\u00F4'); // o-circumflex
  });

  it('extracts multiple combining sequences in one run', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    // e-acute + n-tilde + a-umlaut
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006]);
    const text = extractText(ops, resources);
    expect(text).toBe('e\u0301n\u0303a\u0308');
    expect(text.normalize('NFC')).toBe('\u00E9\u00F1\u00E4');
  });
});

// ===========================================================================
// 10. Emoji (supplementary plane U+1F600+)
// ===========================================================================

describe('Multi-lang: Emoji (supplementary plane)', () => {
  it('extracts grinning face emoji via surrogate pair CMap', () => {
    // U+1F600 -> surrogate pair D83D DE00
    const rawMappings = new Map<number, string>([
      [0x0001, 'D83DDE00'], // U+1F600 grinning face
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMapRaw(rawMappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001]);
    const text = extractText(ops, resources);
    expect(text).toBe('\uD83D\uDE00');
    expect(text.codePointAt(0)).toBe(0x1f600);
  });

  it('extracts multiple emoji in sequence', () => {
    const rawMappings = new Map<number, string>([
      [0x0001, 'D83DDE00'], // U+1F600 grinning face
      [0x0002, 'D83DDE80'], // U+1F680 rocket
      [0x0003, 'D83CDF0D'], // U+1F30D globe
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMapRaw(rawMappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003]);
    const text = extractText(ops, resources);
    const codePoints = [...text].map((ch) => ch.codePointAt(0));
    expect(codePoints).toEqual([0x1f600, 0x1f680, 0x1f30d]);
  });

  it('extracts pile of poo emoji', () => {
    const rawMappings = new Map<number, string>([
      [0x0001, 'D83DDCA9'], // U+1F4A9 pile of poo
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMapRaw(rawMappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001]);
    const text = extractText(ops, resources);
    expect(text.codePointAt(0)).toBe(0x1f4a9);
  });

  it('extracts emoji mixed with BMP characters', () => {
    // Mix of BMP and supplementary plane
    const bmpMappings = new Map<number, number>([
      [0x0002, 0x0041], // A
      [0x0003, 0x0042], // B
    ]);
    const rawMappings = new Map<number, string>([
      [0x0001, 'D83DDE00'], // grinning face
    ]);
    // Build combined CMap manually
    let cmap = '/CIDInit /ProcSet findresource begin\n';
    cmap += '12 dict begin\nbegincmap\n';
    cmap += '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n';
    cmap += '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n';
    cmap += '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    cmap += '3 beginbfchar\n';
    cmap += '<0001> <D83DDE00>\n'; // emoji
    for (const [gid, cp] of bmpMappings) {
      cmap += `<${gid.toString(16).padStart(4, '0')}> <${cp.toString(16).padStart(4, '0')}>\n`;
    }
    cmap += 'endbfchar\nendcmap\nend\nend\n';

    const resources = makeCIDFontResource('F1', cmap);
    const ops = makeCIDTextOps('F1', 12, [0x0002, 0x0001, 0x0003]);
    const text = extractText(ops, resources);
    // A + grinning face + B
    expect(text.startsWith('A')).toBe(true);
    expect(text.endsWith('B')).toBe(true);
    expect([...text].map((c) => c.codePointAt(0))).toEqual([0x41, 0x1f600, 0x42]);
  });
});

// ===========================================================================
// 11. Arabic + numbers (RTL text with embedded LTR digits)
// ===========================================================================

describe('Multi-lang: Arabic + numbers', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x0627], // ا (alef)
    [0x0002, 0x0644], // ل (lam)
    [0x0003, 0x0631], // ر (ra)
    [0x0004, 0x0642], // ق (qaf)
    [0x0005, 0x0645], // م (meem)
    [0x000a, 0x0031], // 1
    [0x000b, 0x0032], // 2
    [0x000c, 0x0033], // 3
  ]);

  it('extracts Arabic word followed by digits', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [
      0x0001, 0x0002, 0x0003, 0x0004, 0x0005, // الرقم
      0x000a, 0x000b, 0x000c, // 123
    ]);
    const text = extractText(ops, resources);
    expect(text).toContain('\u0627\u0644\u0631\u0642\u0645'); // الرقم
    expect(text).toContain('123');
  });

  it('extracts digits surrounded by Arabic text', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [
      0x0001, 0x0002, // ال
      0x000a, 0x000b, // 12
      0x0003, 0x0004, // رق
    ]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0627\u064412\u0631\u0642'); // ال12رق
  });

  it('extracts Arabic + digits in separate Tj operators', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002, 0x0003, 0x0004, 0x0005])] },
      { operator: 'Td', operands: [60, 0] },
      { operator: 'Tj', operands: [cidRaw([0x000a, 0x000b, 0x000c])] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toContain('\u0627'); // ا
    expect(text).toContain('\u0645'); // م
    expect(text).toContain('1');
    expect(text).toContain('2');
    expect(text).toContain('3');
  });

  it('extracts Arabic-Indic digits', () => {
    // Arabic-Indic digits (U+0660-U+0669) often used in Arabic text
    const arabicDigits = new Map<number, number>([
      [0x0001, 0x0627], // ا
      [0x0010, 0x0661], // ١
      [0x0011, 0x0662], // ٢
      [0x0012, 0x0663], // ٣
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(arabicDigits));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0010, 0x0011, 0x0012]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u0627\u0661\u0662\u0663'); // ا١٢٣
  });
});

// ===========================================================================
// TJ array with CID font and ToUnicode
// ===========================================================================

describe('Multi-lang: TJ array with CID font', () => {
  const mappings = new Map<number, number>([
    [0x0001, 0x4f60], // 你
    [0x0002, 0x597d], // 好
    [0x0003, 0x4e16], // 世
    [0x0004, 0x754c], // 界
  ]);

  it('extracts text from TJ array with large negative displacement (space)', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'TJ', operands: [[cidRaw([0x0001, 0x0002]), -200, cidRaw([0x0003, 0x0004])]] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    // Large negative displacement (-200 <= -100) inserts a space
    expect(text).toBe('\u4F60\u597D \u4E16\u754C'); // 你好 世界
  });

  it('extracts TJ array with small kerning (no space)', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'TJ', operands: [[cidRaw([0x0001, 0x0002]), -20, cidRaw([0x0003, 0x0004])]] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources);
    expect(text).toBe('\u4F60\u597D\u4E16\u754C'); // 你好世界
  });

  it('TJ array with positions tracks CID text items', () => {
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 14] },
      { operator: 'Td', operands: [50, 600] },
      { operator: 'TJ', operands: [[cidRaw([0x0001, 0x0002]), -500, cidRaw([0x0003, 0x0004])]] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators, resources);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.text).toBe('\u4F60\u597D');
    expect(items[1]!.text).toBe('\u4E16\u754C');
  });
});

// ===========================================================================
// Multiple CID fonts on the same page
// ===========================================================================

describe('Multi-lang: Multiple CID fonts on same page', () => {
  it('switches between two CID fonts with different CMaps', () => {
    const fonts = new PdfDict();

    // Font 1: Chinese
    const font1 = new PdfDict();
    font1.set('/Subtype', PdfName.of('/Type0'));
    font1.set('/Encoding', PdfName.of('/Identity-H'));
    const cmap1 = makeToUnicodeCMap(
      new Map<number, number>([
        [0x0001, 0x4f60], // 你
        [0x0002, 0x597d], // 好
      ]),
    );
    font1.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmap1)));
    fonts.set('/F1', font1);

    // Font 2: Korean
    const font2 = new PdfDict();
    font2.set('/Subtype', PdfName.of('/Type0'));
    font2.set('/Encoding', PdfName.of('/Identity-H'));
    const cmap2 = makeToUnicodeCMap(
      new Map<number, number>([
        [0x0001, 0xd55c], // 한
        [0x0002, 0xad6d], // 국
      ]),
    );
    font2.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmap2)));
    fonts.set('/F2', font2);

    const resources = new PdfDict();
    resources.set('/Font', fonts);

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F2', 12] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toContain('\u4F60\u597D'); // 你好
    expect(text).toContain('\uD55C\uAD6D'); // 한국
  });
});

// ===========================================================================
// bfrange-based ToUnicode CMap
// ===========================================================================

describe('Multi-lang: bfrange ToUnicode CMap', () => {
  it('extracts text using bfrange sequential mapping', () => {
    const cmapString = [
      '/CIDInit /ProcSet findresource begin',
      '12 dict begin',
      'begincmap',
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
      '/CMapName /Adobe-Identity-UCS def',
      '/CMapType 2 def',
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      '1 beginbfrange',
      '<0001> <0005> <4E00>', // CID 1-5 -> U+4E00-U+4E04
      'endbfrange',
      'endcmap',
    ].join('\n');

    const resources = makeCIDFontResource('F1', cmapString);
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u4E00\u4E01\u4E02\u4E03\u4E04'); // 一丁丂七丄
  });

  it('extracts text using bfrange array mapping', () => {
    const cmapString = [
      '1 beginbfrange',
      '<0001> <0003> [<4F60> <597D> <4E16>]', // 你 好 世
      'endbfrange',
    ].join('\n');

    const cmap = parseToUnicodeCMap(encoder.encode(cmapString));
    expect(cmap.map.get(0x0001)).toBe('\u4F60'); // 你
    expect(cmap.map.get(0x0002)).toBe('\u597D'); // 好
    expect(cmap.map.get(0x0003)).toBe('\u4E16'); // 世
  });

  it('handles mixed bfchar and bfrange in same CMap', () => {
    const cmapString = [
      '/CIDInit /ProcSet findresource begin',
      '12 dict begin',
      'begincmap',
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
      '/CMapName /Adobe-Identity-UCS def',
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      '1 beginbfchar',
      '<0001> <4F60>', // 你
      'endbfchar',
      '1 beginbfrange',
      '<0010> <0012> <597D>', // 好 -> sequential
      'endbfrange',
      'endcmap',
    ].join('\n');

    const resources = makeCIDFontResource('F1', cmapString);
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0010, 0x0011, 0x0012]);
    const text = extractText(ops, resources);
    expect(text).toBe('\u4F60\u597D\u597E\u597F');
  });
});

// ===========================================================================
// parseToUnicodeCMap — supplementary plane
// ===========================================================================

describe('parseToUnicodeCMap() — supplementary plane', () => {
  it('parses surrogate pair mapping in bfchar', () => {
    const cmapString = [
      '1 beginbfchar',
      '<0001> <D83DDE00>', // U+1F600 as surrogate pair
      'endbfchar',
    ].join('\n');
    const cmap = parseToUnicodeCMap(encoder.encode(cmapString));
    const mapped = cmap.map.get(0x0001);
    expect(mapped).toBeDefined();
    expect(mapped!.codePointAt(0)).toBe(0x1f600);
  });

  it('parses multiple surrogate pair mappings', () => {
    const cmapString = [
      '3 beginbfchar',
      '<0001> <D83DDE00>', // U+1F600 grinning face
      '<0002> <D83DDE80>', // U+1F680 rocket
      '<0003> <D83DDCA9>', // U+1F4A9 pile of poo
      'endbfchar',
    ].join('\n');
    const cmap = parseToUnicodeCMap(encoder.encode(cmapString));
    expect(cmap.map.get(0x0001)!.codePointAt(0)).toBe(0x1f600);
    expect(cmap.map.get(0x0002)!.codePointAt(0)).toBe(0x1f680);
    expect(cmap.map.get(0x0003)!.codePointAt(0)).toBe(0x1f4a9);
  });

  it('parses CJK codepoints in standard 4-digit hex format', () => {
    const cmapString = [
      '3 beginbfchar',
      '<0001> <4F60>', // 你
      '<0002> <597D>', // 好
      '<0003> <4E16>', // 世
      'endbfchar',
    ].join('\n');
    const cmap = parseToUnicodeCMap(encoder.encode(cmapString));
    expect(cmap.map.get(0x0001)).toBe('\u4F60');
    expect(cmap.map.get(0x0002)).toBe('\u597D');
    expect(cmap.map.get(0x0003)).toBe('\u4E16');
  });
});

// ===========================================================================
// Single-byte font (non-CID) with ToUnicode
// ===========================================================================

describe('Multi-lang: Single-byte font with ToUnicode', () => {
  it('uses 1-byte character codes with ToUnicode mapping', () => {
    const cmapString = [
      '3 beginbfchar',
      '<01> <00E9>', // 1 -> e-acute
      '<02> <00F1>', // 2 -> n-tilde
      '<03> <00FC>', // 3 -> u-umlaut
      'endbfchar',
    ].join('\n');

    const resources = new PdfDict();
    const fonts = new PdfDict();
    const font = new PdfDict();
    font.set('/Subtype', PdfName.of('/Type1')); // single-byte
    font.set('/Encoding', PdfName.of('/WinAnsiEncoding'));
    font.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmapString)));
    fonts.set('/F1', font);
    resources.set('/Font', fonts);

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tj', operands: [String.fromCharCode(1) + String.fromCharCode(2) + String.fromCharCode(3)] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toBe('\u00E9\u00F1\u00FC');
  });

  it('falls back to WinAnsi for unmapped chars in single-byte font', () => {
    const cmapString = [
      '1 beginbfchar',
      '<01> <0048>', // 1 -> H
      'endbfchar',
    ].join('\n');

    const resources = new PdfDict();
    const fonts = new PdfDict();
    const font = new PdfDict();
    font.set('/Subtype', PdfName.of('/Type1'));
    font.set('/Encoding', PdfName.of('/WinAnsiEncoding'));
    font.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmapString)));
    fonts.set('/F1', font);
    resources.set('/Font', fonts);

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      // char 1 is mapped (H), char 0x65 ('e') falls back to WinAnsi
      { operator: 'Tj', operands: [String.fromCharCode(1) + String.fromCharCode(0x65)] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toBe('He');
  });
});

// ===========================================================================
// Full-width Latin letters (common in CJK documents)
// ===========================================================================

describe('Multi-lang: Full-width Latin', () => {
  it('extracts full-width Latin letters', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0xff21], // A (full-width)
      [0x0002, 0xff22], // B (full-width)
      [0x0003, 0xff23], // C (full-width)
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003]);
    const text = extractText(ops, resources);
    expect(text).toBe('\uFF21\uFF22\uFF23'); // ABC (full-width)
  });

  it('extracts full-width digits', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0xff10], // 0 (full-width)
      [0x0002, 0xff11], // 1 (full-width)
      [0x0003, 0xff12], // 2 (full-width)
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 12, [0x0001, 0x0002, 0x0003]);
    const text = extractText(ops, resources);
    expect(text).toBe('\uFF10\uFF11\uFF12'); // 012 (full-width)
  });
});

// ===========================================================================
// Quote operator (') with CID font
// ===========================================================================

describe("Multi-lang: ' operator with CID font", () => {
  it("extracts CID text from ' (next-line-then-show) operator", () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x4f60], // 你
      [0x0002, 0x597d], // 好
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'TL', operands: [14] },
      { operator: 'Td', operands: [72, 700] },
      { operator: "'", operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toBe('\u4F60\u597D'); // 你好
  });
});

// ===========================================================================
// Double-quote operator (") with CID font
// ===========================================================================

describe('Multi-lang: " operator with CID font', () => {
  it('extracts CID text from " (set-spacing-then-show) operator', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0xd55c], // 한
      [0x0002, 0xad6d], // 국
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'TL', operands: [14] },
      { operator: 'Td', operands: [72, 700] },
      { operator: '"', operands: [0, 0, cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toBe('\uD55C\uAD6D'); // 한국
  });
});

// ===========================================================================
// extractTextWithPositions() — multi-language position tracking
// ===========================================================================

describe('extractTextWithPositions() — multi-language', () => {
  it('reports correct positions for CJK text', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x4f60], // 你
      [0x0002, 0x597d], // 好
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const ops = makeCIDTextOps('F1', 14, [0x0001, 0x0002], 100, 500);
    const items = extractTextWithPositions(ops, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u4F60\u597D');
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(500);
    expect(items[0]!.fontSize).toBe(14);
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.width).toBeGreaterThan(0);
    expect(items[0]!.height).toBe(14);
  });

  it('reports separate positioned items for multi-line CID text', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x4f60], // 你
      [0x0002, 0x597d], // 好
      [0x0003, 0x4e16], // 世
      [0x0004, 0x754c], // 界
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'TL', operands: [14] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'T*', operands: [] },
      { operator: 'Tj', operands: [cidRaw([0x0003, 0x0004])] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators, resources);
    expect(items).toHaveLength(2);
    expect(items[0]!.text).toBe('\u4F60\u597D');
    expect(items[0]!.y).toBeCloseTo(700);
    expect(items[1]!.text).toBe('\u4E16\u754C');
    expect(items[1]!.y).toBeCloseTo(686); // 700 - 14
  });

  it('tracks positions for Arabic text with Td movements', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x0645], // م
      [0x0002, 0x0631], // ر
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [300, 400] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u0645\u0631');
    expect(items[0]!.x).toBeCloseTo(300);
    expect(items[0]!.y).toBeCloseTo(400);
  });

  it('handles Tm matrix with CID font text', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x3053], // こ
      [0x0002, 0x3093], // ん
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Tm', operands: [1, 0, 0, 1, 150, 350] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'ET', operands: [] },
    ];
    const items = extractTextWithPositions(operators, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('\u3053\u3093');
    expect(items[0]!.x).toBeCloseTo(150);
    expect(items[0]!.y).toBeCloseTo(350);
  });
});

// ===========================================================================
// withPositions option for multi-language text
// ===========================================================================

describe('extractText() — withPositions option for multi-language', () => {
  it('returns space-separated CJK text items with withPositions=true', () => {
    const mappings = new Map<number, number>([
      [0x0001, 0x4f60], // 你
      [0x0002, 0x597d], // 好
      [0x0003, 0x4e16], // 世
      [0x0004, 0x754c], // 界
    ]);
    const resources = makeCIDFontResource('F1', makeToUnicodeCMap(mappings));
    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: [cidRaw([0x0001, 0x0002])] },
      { operator: 'Td', operands: [0, -14] },
      { operator: 'Tj', operands: [cidRaw([0x0003, 0x0004])] },
      { operator: 'ET', operands: [] },
    ];
    const text = extractText(operators, resources, { withPositions: true });
    expect(text).toContain('\u4F60\u597D');
    expect(text).toContain('\u4E16\u754C');
  });
});

// ===========================================================================
// Graphics state save/restore with CID font
// ===========================================================================

describe('Multi-lang: q/Q state management with CID font', () => {
  it('restores font state after Q with CID fonts', () => {
    const fonts = new PdfDict();

    const font1 = new PdfDict();
    font1.set('/Subtype', PdfName.of('/Type0'));
    font1.set('/Encoding', PdfName.of('/Identity-H'));
    const cmap1 = makeToUnicodeCMap(new Map([[0x0001, 0x4f60]])); // 你
    font1.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmap1)));
    fonts.set('/F1', font1);

    const font2 = new PdfDict();
    font2.set('/Subtype', PdfName.of('/Type0'));
    font2.set('/Encoding', PdfName.of('/Identity-H'));
    const cmap2 = makeToUnicodeCMap(new Map([[0x0001, 0xd55c]])); // 한
    font2.set('/ToUnicode', PdfStream.fromBytes(encoder.encode(cmap2)));
    fonts.set('/F2', font2);

    const resources = new PdfDict();
    resources.set('/Font', fonts);

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'q', operands: [] },
      { operator: 'Tf', operands: ['/F2', 24] },
      { operator: 'Q', operands: [] },
      // After Q, font should be restored to /F1, 12
      { operator: 'Td', operands: [50, 600] },
      { operator: 'Tj', operands: [cidRaw([0x0001])] },
      { operator: 'ET', operands: [] },
    ];

    const items = extractTextWithPositions(operators, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.fontSize).toBe(12);
    // Since the font was restored to /F1, CID 0x0001 should map to 你
    expect(items[0]!.text).toBe('\u4F60');
  });
});

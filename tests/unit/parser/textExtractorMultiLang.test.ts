/**
 * Multi-language text extraction tests.
 *
 * Validates that extractText() correctly handles CID (Type0) fonts with
 * ToUnicode CMaps for Chinese, Japanese, Korean, Arabic, Hebrew,
 * Devanagari, Thai, mixed scripts, combining characters, and emoji.
 *
 * Each test builds synthetic content-stream operators and a resource
 * dictionary with a properly structured ToUnicode CMap, then asserts
 * that extractText() produces the expected Unicode string.
 */

import { describe, it, expect } from 'vitest';
import {
  extractText,
  extractTextWithPositions,
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
 * Unicode codepoints.  Each glyph ID and codepoint is represented as a
 * 4-hex-digit value in a `beginbfchar`/`endbfchar` block.
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
 * ToUnicode CMap.  The font dict is stored directly (not via a
 * PdfObjectRegistry), which works because `TextState.analyzeFonts`
 * iterates font entries as PdfDict values.
 */
function makeCIDFontResource(fontName: string, cmap: string): PdfDict {
  // Create ToUnicode stream
  const cmapStream = PdfStream.fromBytes(encoder.encode(cmap));

  // Create font dict
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
 * Build a simple WinAnsi font resource (single-byte, no CMap).
 */
function makeWinAnsiFontResource(fontName: string): PdfDict {
  const fontDict = new PdfDict();
  fontDict.set('/Subtype', PdfName.of('/Type1'));
  fontDict.set('/Encoding', PdfName.of('/WinAnsiEncoding'));

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
 * each glyph is represented as 2 bytes (big-endian).  The content
 * stream parser would have already decoded the hex `<...>` into this
 * binary form.
 */
function makeCIDTextOps(
  fontName: string,
  fontSize: number,
  gids: number[],
  x: number,
  y: number,
): ContentStreamOperator[] {
  // Build raw binary string from glyph IDs (2 bytes each, big-endian)
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

// ===========================================================================
// Multi-language text extraction
// ===========================================================================

describe('extractText() — multi-language CID fonts', () => {
  // -------------------------------------------------------------------------
  // 1. Chinese (CJK Unified)
  // -------------------------------------------------------------------------
  it('extracts Chinese (CJK Unified) text', () => {
    const mappings = new Map<number, number>([
      [1, 0x4f60], // 你
      [2, 0x597d], // 好
      [3, 0x4e16], // 世
      [4, 0x754c], // 界
      [5, 0xff01], // ！
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4, 5], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('你好世界！');
  });

  // -------------------------------------------------------------------------
  // 2. Japanese (Hiragana)
  // -------------------------------------------------------------------------
  it('extracts Japanese hiragana text', () => {
    const mappings = new Map<number, number>([
      [1, 0x3053], // こ
      [2, 0x3093], // ん
      [3, 0x306b], // に
      [4, 0x3061], // ち
      [5, 0x306f], // は
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4, 5], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('こんにちは');
  });

  // -------------------------------------------------------------------------
  // 3. Korean (Hangul)
  // -------------------------------------------------------------------------
  it('extracts Korean hangul text', () => {
    const mappings = new Map<number, number>([
      [1, 0xd55c], // 한
      [2, 0xad6d], // 국
      [3, 0xc5b4], // 어
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('한국어');
  });

  // -------------------------------------------------------------------------
  // 4. Arabic
  // -------------------------------------------------------------------------
  it('extracts Arabic text', () => {
    const mappings = new Map<number, number>([
      [1, 0x0645], // م
      [2, 0x0631], // ر
      [3, 0x062d], // ح
      [4, 0x0628], // ب
      [5, 0x0627], // ا
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4, 5], 72, 700);

    const text = extractText(operators, resources);
    // Arabic characters are extracted in logical order (as stored in CMap)
    expect(text).toContain('\u0645'); // م
    expect(text).toContain('\u0631'); // ر
    expect(text).toContain('\u062d'); // ح
    expect(text).toContain('\u0628'); // ب
    expect(text).toContain('\u0627'); // ا
    expect(text).toBe('مرحبا');
  });

  // -------------------------------------------------------------------------
  // 5. Hebrew
  // -------------------------------------------------------------------------
  it('extracts Hebrew text', () => {
    const mappings = new Map<number, number>([
      [1, 0x05e9], // ש
      [2, 0x05dc], // ל
      [3, 0x05d5], // ו
      [4, 0x05dd], // ם
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('שלום');
  });

  // -------------------------------------------------------------------------
  // 6. Devanagari (Hindi "namaste")
  // -------------------------------------------------------------------------
  it('extracts Devanagari text', () => {
    const mappings = new Map<number, number>([
      [1, 0x0928], // न
      [2, 0x092e], // म
      [3, 0x0938], // स
      [4, 0x094d], // ्  (virama)
      [5, 0x0924], // त
      [6, 0x0947], // े  (vowel sign e)
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4, 5, 6], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('नमस्ते');
  });

  // -------------------------------------------------------------------------
  // 7. Thai
  // -------------------------------------------------------------------------
  it('extracts Thai text', () => {
    // "สวัสดี" — note: ส appears twice (glyph IDs 1 and 4)
    const mappings = new Map<number, number>([
      [1, 0x0e2a], // ส
      [2, 0x0e27], // ว
      [3, 0x0e31], // ั  (sara am)
      [4, 0x0e2a], // ส  (same char, different glyph ID slot)
      [5, 0x0e14], // ด
      [6, 0x0e35], // ี  (sara ii)
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2, 3, 4, 5, 6], 72, 700);

    const text = extractText(operators, resources);
    expect(text).toBe('สวัสดี');
  });

  // -------------------------------------------------------------------------
  // 8. Mixed Latin + CJK — two BT/ET blocks, different fonts
  // -------------------------------------------------------------------------
  it('extracts mixed Latin + CJK text from separate BT/ET blocks', () => {
    // WinAnsi font for Latin "Hello"
    const winAnsiFont = new PdfDict();
    winAnsiFont.set('/Subtype', PdfName.of('/Type1'));
    winAnsiFont.set('/Encoding', PdfName.of('/WinAnsiEncoding'));

    // CID font for CJK "世界"
    const cjkMappings = new Map<number, number>([
      [1, 0x4e16], // 世
      [2, 0x754c], // 界
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

    // Build CID binary string for glyph IDs [1, 2]
    let cidRaw = '';
    cidRaw += String.fromCharCode(0x00) + String.fromCharCode(0x01); // gid 1
    cidRaw += String.fromCharCode(0x00) + String.fromCharCode(0x02); // gid 2

    const operators: ContentStreamOperator[] = [
      // First block: Latin text in WinAnsi font
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: ['Hello'] },
      { operator: 'ET', operands: [] },
      // Second block: CJK text in CID font
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F2', 12] },
      { operator: 'Td', operands: [120, 700] },
      { operator: 'Tj', operands: [cidRaw] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    expect(text).toContain('Hello');
    expect(text).toContain('世界');
  });

  // -------------------------------------------------------------------------
  // 9. Combining characters — e + combining acute = e-acute
  // -------------------------------------------------------------------------
  it('extracts combining characters', () => {
    const mappings = new Map<number, number>([
      [1, 0x0065], // e (Latin small letter e)
      [2, 0x0301], // combining acute accent
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1, 2], 72, 700);

    const text = extractText(operators, resources);
    // Both codepoints should be present: e + combining acute
    expect(text).toContain('e');
    expect(text).toContain('\u0301');
    // The combined form should normalize to e-acute
    expect(text.normalize('NFC')).toBe('\u00e9');
  });

  // -------------------------------------------------------------------------
  // 10. Emoji — supplementary plane character (U+1F600 = grinning face)
  //     In a CMap, supplementary plane chars are encoded as UTF-16
  //     surrogate pairs: U+1F600 = D83D DE00.
  // -------------------------------------------------------------------------
  it('extracts emoji (supplementary plane via surrogate pair CMap)', () => {
    // Map glyph ID 1 -> U+1F600 encoded as UTF-16 surrogate pair
    // The hexToUnicode function processes 4 hex chars at a time:
    // D83D -> String.fromCodePoint(0xD83D) (high surrogate)
    // DE00 -> String.fromCodePoint(0xDE00) (low surrogate)
    // When concatenated, JS treats these as a proper surrogate pair.
    const rawMappings = new Map<number, string>([
      [1, 'D83DDE00'], // U+1F600 as UTF-16 surrogate pair
    ]);
    const cmap = makeToUnicodeCMapRaw(rawMappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 12, [1], 72, 700);

    const text = extractText(operators, resources);
    // The extracted text should be the grinning face emoji
    expect(text).toBe('\uD83D\uDE00');
    expect(text.codePointAt(0)).toBe(0x1f600);
  });

  // -------------------------------------------------------------------------
  // 11. Arabic + embedded numbers — both scripts in same content stream
  // -------------------------------------------------------------------------
  it('extracts Arabic text with embedded numbers', () => {
    // Arabic chars + ASCII digits in a single CID font with ToUnicode
    const mappings = new Map<number, number>([
      [1, 0x0627],  // ا
      [2, 0x0644],  // ل
      [3, 0x0631],  // ر
      [4, 0x0642],  // ق
      [5, 0x0645],  // م
      // Digits mapped through the CID font as well
      [10, 0x0031], // 1
      [11, 0x0032], // 2
      [12, 0x0033], // 3
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);

    // Build operators: Arabic word, then "123", then more Arabic
    // All in the same BT/ET block, same CID font
    let arabicRaw = '';
    for (const gid of [1, 2, 3, 4, 5]) {
      arabicRaw += String.fromCharCode((gid >> 8) & 0xff);
      arabicRaw += String.fromCharCode(gid & 0xff);
    }

    let numbersRaw = '';
    for (const gid of [10, 11, 12]) {
      numbersRaw += String.fromCharCode((gid >> 8) & 0xff);
      numbersRaw += String.fromCharCode(gid & 0xff);
    }

    const operators: ContentStreamOperator[] = [
      { operator: 'BT', operands: [] },
      { operator: 'Tf', operands: ['/F1', 12] },
      { operator: 'Td', operands: [72, 700] },
      { operator: 'Tj', operands: [arabicRaw] },
      { operator: 'Td', operands: [60, 0] },
      { operator: 'Tj', operands: [numbersRaw] },
      { operator: 'ET', operands: [] },
    ];

    const text = extractText(operators, resources);
    // Should contain Arabic characters
    expect(text).toContain('\u0627'); // ا
    expect(text).toContain('\u0644'); // ل
    expect(text).toContain('\u0631'); // ر
    expect(text).toContain('\u0642'); // ق
    expect(text).toContain('\u0645'); // م
    // Should contain the digits
    expect(text).toContain('1');
    expect(text).toContain('2');
    expect(text).toContain('3');
    // Full Arabic word followed by space/gap and numbers
    expect(text).toContain('الرقم');
    expect(text).toContain('123');
  });
});

// ===========================================================================
// Position tracking for multi-language text
// ===========================================================================

describe('extractTextWithPositions() — multi-language', () => {
  it('reports correct positions for CJK text items', () => {
    const mappings = new Map<number, number>([
      [1, 0x4f60], // 你
      [2, 0x597d], // 好
    ]);
    const cmap = makeToUnicodeCMap(mappings);
    const resources = makeCIDFontResource('F1', cmap);
    const operators = makeCIDTextOps('F1', 14, [1, 2], 100, 500);

    const items = extractTextWithPositions(operators, resources);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('你好');
    expect(items[0]!.x).toBeCloseTo(100);
    expect(items[0]!.y).toBeCloseTo(500);
    expect(items[0]!.fontSize).toBe(14);
    expect(items[0]!.fontName).toBe('/F1');
    expect(items[0]!.width).toBeGreaterThan(0);
  });
});

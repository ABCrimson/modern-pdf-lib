/**
 * Tests for the PDF content stream parser — parseContentStream().
 *
 * Covers all major operator categories: text, graphics, color, state,
 * operand types, inline images, marked content, empty streams,
 * and nested save/restore.
 */

import { describe, it, expect } from 'vitest';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import type {
  ContentStreamOperator,
  InlineImageData,
  Operand,
} from '../../../src/parser/contentStreamParser.js';
import { PdfName } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Encode an ASCII string into a Uint8Array. */
function stream(str: string): Uint8Array {
  return encoder.encode(str);
}

/** Find an operator by name from parsed results. */
function findOps(
  ops: ContentStreamOperator[],
  name: string,
): ContentStreamOperator[] {
  return ops.filter((op) => op.operator === name);
}

/** Find the first operator by name. */
function findOp(
  ops: ContentStreamOperator[],
  name: string,
): ContentStreamOperator | undefined {
  return ops.find((op) => op.operator === name);
}

// ===========================================================================
// Empty and basic parsing
// ===========================================================================

describe('Empty content stream', () => {
  it('returns empty array for empty data', () => {
    const ops = parseContentStream(new Uint8Array(0));
    expect(ops).toEqual([]);
  });

  it('returns empty array for whitespace-only data', () => {
    const ops = parseContentStream(stream('   \n\t\r  '));
    expect(ops).toEqual([]);
  });

  it('ignores comments', () => {
    const ops = parseContentStream(stream('% this is a comment\n10 20 m'));
    expect(ops).toHaveLength(1);
    expect(ops[0]!.operator).toBe('m');
  });
});

// ===========================================================================
// Text operators
// ===========================================================================

describe('Text operators', () => {
  it('parses BT and ET', () => {
    const ops = parseContentStream(stream('BT ET'));
    expect(ops).toHaveLength(2);
    expect(ops[0]!.operator).toBe('BT');
    expect(ops[1]!.operator).toBe('ET');
  });

  it('parses Tf (set font and size)', () => {
    const ops = parseContentStream(stream('BT /F1 12 Tf ET'));
    const tf = findOp(ops, 'Tf')!;
    expect(tf).toBeDefined();
    expect(tf.operands).toHaveLength(2);
    // First operand is a PdfName
    expect(tf.operands[0]).toBeInstanceOf(PdfName);
    expect((tf.operands[0] as PdfName).value).toBe('/F1');
    // Second operand is a number
    expect(tf.operands[1]).toBe(12);
  });

  it('parses Tj (show string)', () => {
    const ops = parseContentStream(stream('BT (Hello World) Tj ET'));
    const tj = findOp(ops, 'Tj')!;
    expect(tj).toBeDefined();
    expect(tj.operands).toHaveLength(1);
    expect(tj.operands[0]).toBe('Hello World');
  });

  it('parses Tj with hex string', () => {
    const ops = parseContentStream(stream('BT <48656C6C6F> Tj ET'));
    const tj = findOp(ops, 'Tj')!;
    expect(tj).toBeDefined();
    expect(tj.operands[0]).toBe('Hello');
  });

  it('parses TJ (show string array)', () => {
    const ops = parseContentStream(
      stream('BT [(Hello) -100 (World)] TJ ET'),
    );
    const tj = findOp(ops, 'TJ')!;
    expect(tj).toBeDefined();
    expect(tj.operands).toHaveLength(1);
    const arr = tj.operands[0] as Operand[];
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0]).toBe('Hello');
    expect(arr[1]).toBe(-100);
    expect(arr[2]).toBe('World');
  });

  it('parses Td (move text position)', () => {
    const ops = parseContentStream(stream('BT 100 700 Td ET'));
    const td = findOp(ops, 'Td')!;
    expect(td).toBeDefined();
    expect(td.operands).toEqual([100, 700]);
  });

  it('parses TD (move text position and set leading)', () => {
    const ops = parseContentStream(stream('BT 0 -14 TD ET'));
    const td = findOp(ops, 'TD')!;
    expect(td).toBeDefined();
    expect(td.operands).toEqual([0, -14]);
  });

  it('parses Tm (set text matrix)', () => {
    const ops = parseContentStream(stream('BT 1 0 0 1 100 700 Tm ET'));
    const tm = findOp(ops, 'Tm')!;
    expect(tm).toBeDefined();
    expect(tm.operands).toEqual([1, 0, 0, 1, 100, 700]);
  });

  it('parses T* (move to next line)', () => {
    const ops = parseContentStream(stream('BT T* ET'));
    const tStar = findOp(ops, 'T*')!;
    expect(tStar).toBeDefined();
    expect(tStar.operands).toEqual([]);
  });

  it('parses TL (set leading)', () => {
    const ops = parseContentStream(stream('BT 14 TL ET'));
    const tl = findOp(ops, 'TL')!;
    expect(tl).toBeDefined();
    expect(tl.operands).toEqual([14]);
  });

  it('parses Tc (character spacing)', () => {
    const ops = parseContentStream(stream('0.5 Tc'));
    const tc = findOp(ops, 'Tc')!;
    expect(tc).toBeDefined();
    expect(tc.operands).toEqual([0.5]);
  });

  it('parses Tw (word spacing)', () => {
    const ops = parseContentStream(stream('2.5 Tw'));
    const tw = findOp(ops, 'Tw')!;
    expect(tw).toBeDefined();
    expect(tw.operands).toEqual([2.5]);
  });

  it('parses Tz (horizontal scaling)', () => {
    const ops = parseContentStream(stream('150 Tz'));
    const tz = findOp(ops, 'Tz')!;
    expect(tz).toBeDefined();
    expect(tz.operands).toEqual([150]);
  });

  it('parses Ts (text rise)', () => {
    const ops = parseContentStream(stream('5 Ts'));
    const ts = findOp(ops, 'Ts')!;
    expect(ts).toBeDefined();
    expect(ts.operands).toEqual([5]);
  });

  it('parses Tr (text rendering mode)', () => {
    const ops = parseContentStream(stream('0 Tr'));
    const tr = findOp(ops, 'Tr')!;
    expect(tr).toBeDefined();
    expect(tr.operands).toEqual([0]);
  });

  it("parses ' (move to next line and show string)", () => {
    const ops = parseContentStream(stream("BT (Hello) ' ET"));
    const quote = findOp(ops, "'")!;
    expect(quote).toBeDefined();
    expect(quote.operands).toHaveLength(1);
    expect(quote.operands[0]).toBe('Hello');
  });

  it('parses " (set spacing, move to next line, show string)', () => {
    const ops = parseContentStream(stream('BT 1 2 (Hello) " ET'));
    const dquote = findOp(ops, '"')!;
    expect(dquote).toBeDefined();
    expect(dquote.operands).toEqual([1, 2, 'Hello']);
  });
});

// ===========================================================================
// Graphics operators
// ===========================================================================

describe('Graphics operators', () => {
  it('parses m (moveto)', () => {
    const ops = parseContentStream(stream('100 200 m'));
    expect(ops[0]!.operator).toBe('m');
    expect(ops[0]!.operands).toEqual([100, 200]);
  });

  it('parses l (lineto)', () => {
    const ops = parseContentStream(stream('300 400 l'));
    expect(ops[0]!.operator).toBe('l');
    expect(ops[0]!.operands).toEqual([300, 400]);
  });

  it('parses c (curveto)', () => {
    const ops = parseContentStream(stream('10 20 30 40 50 60 c'));
    expect(ops[0]!.operator).toBe('c');
    expect(ops[0]!.operands).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('parses re (rectangle)', () => {
    const ops = parseContentStream(stream('50 50 200 100 re'));
    expect(ops[0]!.operator).toBe('re');
    expect(ops[0]!.operands).toEqual([50, 50, 200, 100]);
  });

  it('parses S (stroke)', () => {
    const ops = parseContentStream(stream('S'));
    expect(ops[0]!.operator).toBe('S');
    expect(ops[0]!.operands).toEqual([]);
  });

  it('parses f (fill)', () => {
    const ops = parseContentStream(stream('f'));
    expect(ops[0]!.operator).toBe('f');
  });

  it('parses f* (fill with even-odd rule)', () => {
    const ops = parseContentStream(stream('f*'));
    expect(ops[0]!.operator).toBe('f*');
  });

  it('parses h (close path)', () => {
    const ops = parseContentStream(stream('h'));
    expect(ops[0]!.operator).toBe('h');
  });

  it('parses W (clip)', () => {
    const ops = parseContentStream(stream('W'));
    expect(ops[0]!.operator).toBe('W');
  });

  it('parses W* (clip with even-odd rule)', () => {
    const ops = parseContentStream(stream('W*'));
    expect(ops[0]!.operator).toBe('W*');
  });

  it('parses n (end path without fill/stroke)', () => {
    const ops = parseContentStream(stream('n'));
    expect(ops[0]!.operator).toBe('n');
  });

  it('parses B (fill then stroke)', () => {
    const ops = parseContentStream(stream('B'));
    expect(ops[0]!.operator).toBe('B');
  });

  it('parses b (close, fill, stroke)', () => {
    const ops = parseContentStream(stream('b'));
    expect(ops[0]!.operator).toBe('b');
  });
});

// ===========================================================================
// Color operators
// ===========================================================================

describe('Color operators', () => {
  it('parses g (set gray for nonstroking)', () => {
    const ops = parseContentStream(stream('0.5 g'));
    expect(ops[0]!.operator).toBe('g');
    expect(ops[0]!.operands).toEqual([0.5]);
  });

  it('parses G (set gray for stroking)', () => {
    const ops = parseContentStream(stream('0.8 G'));
    expect(ops[0]!.operator).toBe('G');
    expect(ops[0]!.operands).toEqual([0.8]);
  });

  it('parses rg (set RGB for nonstroking)', () => {
    const ops = parseContentStream(stream('1 0 0 rg'));
    expect(ops[0]!.operator).toBe('rg');
    expect(ops[0]!.operands).toEqual([1, 0, 0]);
  });

  it('parses RG (set RGB for stroking)', () => {
    const ops = parseContentStream(stream('0 0 1 RG'));
    expect(ops[0]!.operator).toBe('RG');
    expect(ops[0]!.operands).toEqual([0, 0, 1]);
  });

  it('parses k (set CMYK for nonstroking)', () => {
    const ops = parseContentStream(stream('0 0 0 1 k'));
    expect(ops[0]!.operator).toBe('k');
    expect(ops[0]!.operands).toEqual([0, 0, 0, 1]);
  });

  it('parses K (set CMYK for stroking)', () => {
    const ops = parseContentStream(stream('1 0 0 0 K'));
    expect(ops[0]!.operator).toBe('K');
    expect(ops[0]!.operands).toEqual([1, 0, 0, 0]);
  });

  it('parses cs (set color space for nonstroking)', () => {
    const ops = parseContentStream(stream('/DeviceGray cs'));
    expect(ops[0]!.operator).toBe('cs');
    expect(ops[0]!.operands).toHaveLength(1);
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/DeviceGray');
  });

  it('parses CS (set color space for stroking)', () => {
    const ops = parseContentStream(stream('/DeviceRGB CS'));
    expect(ops[0]!.operator).toBe('CS');
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/DeviceRGB');
  });

  it('parses sc (set color for nonstroking)', () => {
    const ops = parseContentStream(stream('0.5 0.3 0.1 sc'));
    expect(ops[0]!.operator).toBe('sc');
    expect(ops[0]!.operands).toEqual([0.5, 0.3, 0.1]);
  });

  it('parses SC (set color for stroking)', () => {
    const ops = parseContentStream(stream('0.9 0.8 0.7 SC'));
    expect(ops[0]!.operator).toBe('SC');
    expect(ops[0]!.operands).toEqual([0.9, 0.8, 0.7]);
  });

  it('parses scn and SCN (extended color)', () => {
    const ops = parseContentStream(stream('0.5 scn'));
    expect(ops[0]!.operator).toBe('scn');
    expect(ops[0]!.operands).toEqual([0.5]);
  });
});

// ===========================================================================
// Graphics state operators
// ===========================================================================

describe('Graphics state operators', () => {
  it('parses q (save) and Q (restore)', () => {
    const ops = parseContentStream(stream('q Q'));
    expect(ops).toHaveLength(2);
    expect(ops[0]!.operator).toBe('q');
    expect(ops[1]!.operator).toBe('Q');
  });

  it('parses cm (concat matrix)', () => {
    const ops = parseContentStream(stream('1 0 0 1 50 100 cm'));
    expect(ops[0]!.operator).toBe('cm');
    expect(ops[0]!.operands).toEqual([1, 0, 0, 1, 50, 100]);
  });

  it('parses w (line width)', () => {
    const ops = parseContentStream(stream('2 w'));
    expect(ops[0]!.operator).toBe('w');
    expect(ops[0]!.operands).toEqual([2]);
  });

  it('parses J (line cap)', () => {
    const ops = parseContentStream(stream('1 J'));
    expect(ops[0]!.operator).toBe('J');
    expect(ops[0]!.operands).toEqual([1]);
  });

  it('parses j (line join)', () => {
    const ops = parseContentStream(stream('2 j'));
    expect(ops[0]!.operator).toBe('j');
    expect(ops[0]!.operands).toEqual([2]);
  });

  it('parses M (miter limit)', () => {
    const ops = parseContentStream(stream('10 M'));
    expect(ops[0]!.operator).toBe('M');
    expect(ops[0]!.operands).toEqual([10]);
  });

  it('parses d (dash pattern)', () => {
    const ops = parseContentStream(stream('[3 5] 0 d'));
    expect(ops[0]!.operator).toBe('d');
    expect(ops[0]!.operands).toHaveLength(2);
    const arr = ops[0]!.operands[0] as Operand[];
    expect(arr).toEqual([3, 5]);
    expect(ops[0]!.operands[1]).toBe(0);
  });

  it('parses ri (rendering intent)', () => {
    const ops = parseContentStream(stream('/RelativeColorimetric ri'));
    expect(ops[0]!.operator).toBe('ri');
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/RelativeColorimetric');
  });

  it('parses i (flatness tolerance)', () => {
    const ops = parseContentStream(stream('1 i'));
    expect(ops[0]!.operator).toBe('i');
    expect(ops[0]!.operands).toEqual([1]);
  });

  it('parses gs (graphics state dictionary)', () => {
    const ops = parseContentStream(stream('/GS1 gs'));
    expect(ops[0]!.operator).toBe('gs');
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/GS1');
  });
});

// ===========================================================================
// Operand types
// ===========================================================================

describe('Operand types', () => {
  it('parses integer numbers', () => {
    const ops = parseContentStream(stream('42 w'));
    expect(ops[0]!.operands[0]).toBe(42);
  });

  it('parses negative numbers', () => {
    const ops = parseContentStream(stream('-15 w'));
    expect(ops[0]!.operands[0]).toBe(-15);
  });

  it('parses floating-point numbers', () => {
    const ops = parseContentStream(stream('3.14 w'));
    expect(ops[0]!.operands[0]).toBeCloseTo(3.14);
  });

  it('parses numbers with leading decimal point', () => {
    const ops = parseContentStream(stream('.5 w'));
    expect(ops[0]!.operands[0]).toBeCloseTo(0.5);
  });

  it('parses positive sign numbers', () => {
    const ops = parseContentStream(stream('+10 w'));
    expect(ops[0]!.operands[0]).toBe(10);
  });

  it('parses literal strings with escape sequences', () => {
    const ops = parseContentStream(stream('(Hello\\nWorld) Tj'));
    expect(ops[0]!.operands[0]).toBe('Hello\nWorld');
  });

  it('parses literal strings with escaped parentheses', () => {
    const ops = parseContentStream(stream('(a\\(b\\)c) Tj'));
    expect(ops[0]!.operands[0]).toBe('a(b)c');
  });

  it('parses literal strings with nested parentheses', () => {
    const ops = parseContentStream(stream('(a(b)c) Tj'));
    expect(ops[0]!.operands[0]).toBe('a(b)c');
  });

  it('parses literal strings with backslash escape', () => {
    const ops = parseContentStream(stream('(back\\\\slash) Tj'));
    expect(ops[0]!.operands[0]).toBe('back\\slash');
  });

  it('parses literal strings with octal escapes', () => {
    // \110 = 72 = 'H', \145 = 101 = 'e'
    const ops = parseContentStream(stream('(\\110\\145llo) Tj'));
    expect(ops[0]!.operands[0]).toBe('Hello');
  });

  it('parses literal strings with tab/backspace/formfeed escapes', () => {
    const ops = parseContentStream(stream('(a\\tb\\bc\\f) Tj'));
    expect(ops[0]!.operands[0]).toBe('a\tb\bc\f');
  });

  it('parses hex strings', () => {
    const ops = parseContentStream(stream('<48656C6C6F> Tj'));
    expect(ops[0]!.operands[0]).toBe('Hello');
  });

  it('parses hex strings with whitespace', () => {
    const ops = parseContentStream(stream('<48 65 6C 6C 6F> Tj'));
    expect(ops[0]!.operands[0]).toBe('Hello');
  });

  it('parses hex strings with odd length (pads with 0)', () => {
    const ops = parseContentStream(stream('<4> Tj'));
    // '4' padded to '40' = 0x40 = '@'
    expect(ops[0]!.operands[0]).toBe('@');
  });

  it('parses PDF names', () => {
    const ops = parseContentStream(stream('/F1 12 Tf'));
    expect(ops[0]!.operands[0]).toBeInstanceOf(PdfName);
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/F1');
  });

  it('parses PDF names with hex-encoded characters (#XX)', () => {
    const ops = parseContentStream(stream('/F#311 12 Tf'));
    // #31 = '1', so name is /F1 + remaining '1' -> depends on parser
    // Actually #31 decodes to character '1', so /F#311 -> '/F' + '1' + '1' = /F11
    const name = ops[0]!.operands[0] as PdfName;
    expect(name).toBeInstanceOf(PdfName);
    expect(name.value).toBe('/F11');
  });

  it('parses boolean true', () => {
    const ops = parseContentStream(stream('[true false] TJ'));
    const arr = ops[0]!.operands[0] as Operand[];
    expect(arr[0]).toBe(true);
    expect(arr[1]).toBe(false);
  });

  it('parses null', () => {
    const ops = parseContentStream(stream('[null] TJ'));
    const arr = ops[0]!.operands[0] as Operand[];
    expect(arr[0]).toBeNull();
  });

  it('parses arrays with mixed types', () => {
    const ops = parseContentStream(stream('[(Hello) -50 (World)] TJ'));
    const arr = ops[0]!.operands[0] as Operand[];
    expect(arr).toHaveLength(3);
    expect(arr[0]).toBe('Hello');
    expect(arr[1]).toBe(-50);
    expect(arr[2]).toBe('World');
  });

  it('parses nested arrays', () => {
    const ops = parseContentStream(stream('[[1 2] [3 4]] TJ'));
    const arr = ops[0]!.operands[0] as Operand[];
    expect(Array.isArray(arr[0])).toBe(true);
    expect(arr[0]).toEqual([1, 2]);
    expect(arr[1]).toEqual([3, 4]);
  });
});

// ===========================================================================
// Inline images
// ===========================================================================

describe('Inline images (BI/ID/EI)', () => {
  it('parses basic inline image', () => {
    // BI /W 10 /H 10 /BPC 8 /CS /G ID <imagedata> EI
    const imgBytes = new Uint8Array([0xaa, 0xbb, 0xcc]);
    // Build the stream manually
    const prefix = encoder.encode('BI /W 10 /H 10 /BPC 8 /CS /G ID ');
    const suffix = encoder.encode(' EI');
    const data = new Uint8Array(prefix.length + imgBytes.length + suffix.length);
    data.set(prefix, 0);
    data.set(imgBytes, prefix.length);
    data.set(suffix, prefix.length + imgBytes.length);

    const ops = parseContentStream(data);
    const bi = findOp(ops, 'BI');
    expect(bi).toBeDefined();

    const imgData = bi!.operands[0] as unknown as InlineImageData;
    expect(imgData.dict).toBeDefined();
    // The dict should contain keys from the inline image header
    // Keys may be stored with leading / depending on how the parser handles them
    expect(imgData.data).toBeInstanceOf(Uint8Array);
    expect(imgData.data.length).toBeGreaterThan(0);
  });

  it('does not interfere with operators before/after inline image', () => {
    const prefix = encoder.encode('q 1 0 0 1 50 700 cm BI /W 1 /H 1 /BPC 8 /CS /G ID ');
    const imgByte = new Uint8Array([0xff]);
    const suffix = encoder.encode(' EI Q');
    const data = new Uint8Array(prefix.length + imgByte.length + suffix.length);
    data.set(prefix, 0);
    data.set(imgByte, prefix.length);
    data.set(suffix, prefix.length + imgByte.length);

    const ops = parseContentStream(data);
    expect(findOp(ops, 'q')).toBeDefined();
    expect(findOp(ops, 'cm')).toBeDefined();
    expect(findOp(ops, 'BI')).toBeDefined();
    expect(findOp(ops, 'Q')).toBeDefined();
  });
});

// ===========================================================================
// Marked content
// ===========================================================================

describe('Marked content operators', () => {
  it('parses BMC (begin marked content)', () => {
    const ops = parseContentStream(stream('/OC BMC'));
    const bmc = findOp(ops, 'BMC')!;
    expect(bmc).toBeDefined();
    expect((bmc.operands[0] as PdfName).value).toBe('/OC');
  });

  it('parses EMC (end marked content)', () => {
    const ops = parseContentStream(stream('EMC'));
    expect(ops[0]!.operator).toBe('EMC');
  });

  it('parses BDC (begin marked content with properties)', () => {
    const ops = parseContentStream(stream('/Span /MCID BDC'));
    const bdc = findOp(ops, 'BDC')!;
    expect(bdc).toBeDefined();
    expect(bdc.operands).toHaveLength(2);
  });

  it('parses MP (marked content point)', () => {
    const ops = parseContentStream(stream('/Tag MP'));
    const mp = findOp(ops, 'MP')!;
    expect(mp).toBeDefined();
  });

  it('parses DP (marked content point with properties)', () => {
    const ops = parseContentStream(stream('/Tag /Props DP'));
    const dp = findOp(ops, 'DP')!;
    expect(dp).toBeDefined();
    expect(dp.operands).toHaveLength(2);
  });
});

// ===========================================================================
// Multiple operators in sequence
// ===========================================================================

describe('Multiple operators in sequence', () => {
  it('parses a complete text block', () => {
    const ops = parseContentStream(
      stream('BT /F1 12 Tf 100 700 Td (Hello World) Tj ET'),
    );
    const operators = ops.map((op) => op.operator);
    expect(operators).toEqual(['BT', 'Tf', 'Td', 'Tj', 'ET']);
  });

  it('parses a drawing sequence', () => {
    const ops = parseContentStream(
      stream('q 1 0 0 RG 2 w 100 100 m 200 200 l S Q'),
    );
    const operators = ops.map((op) => op.operator);
    expect(operators).toEqual(['q', 'RG', 'w', 'm', 'l', 'S', 'Q']);
  });

  it('parses multiple text blocks', () => {
    const ops = parseContentStream(
      stream(
        'BT /F1 12 Tf 72 700 Td (Line 1) Tj ET BT /F1 12 Tf 72 680 Td (Line 2) Tj ET',
      ),
    );
    const btOps = findOps(ops, 'BT');
    const etOps = findOps(ops, 'ET');
    const tjOps = findOps(ops, 'Tj');
    expect(btOps).toHaveLength(2);
    expect(etOps).toHaveLength(2);
    expect(tjOps).toHaveLength(2);
    expect(tjOps[0]!.operands[0]).toBe('Line 1');
    expect(tjOps[1]!.operands[0]).toBe('Line 2');
  });
});

// ===========================================================================
// Nested save/restore (q/Q)
// ===========================================================================

describe('Nested save/restore (q/Q)', () => {
  it('handles nested q/Q correctly', () => {
    const ops = parseContentStream(
      stream('q 0.5 g q 1 0 0 rg 100 100 200 50 re f Q 50 50 100 100 re f Q'),
    );
    const operators = ops.map((op) => op.operator);

    const qCount = operators.filter((o) => o === 'q').length;
    const bigQCount = operators.filter((o) => o === 'Q').length;
    expect(qCount).toBe(2);
    expect(bigQCount).toBe(2);
  });

  it('parses deeply nested q/Q', () => {
    const ops = parseContentStream(stream('q q q 1 w Q Q Q'));
    const operators = ops.map((op) => op.operator);
    expect(operators).toEqual(['q', 'q', 'q', 'w', 'Q', 'Q', 'Q']);
  });
});

// ===========================================================================
// XObject and other operators
// ===========================================================================

describe('XObject and miscellaneous operators', () => {
  it('parses Do (invoke XObject)', () => {
    const ops = parseContentStream(stream('/Im1 Do'));
    expect(ops[0]!.operator).toBe('Do');
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/Im1');
  });

  it('parses sh (shading)', () => {
    const ops = parseContentStream(stream('/Sh1 sh'));
    expect(ops[0]!.operator).toBe('sh');
    expect((ops[0]!.operands[0] as PdfName).value).toBe('/Sh1');
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('Edge cases', () => {
  it('handles stream with only operands and no operator', () => {
    // Malformed stream — operands without any operator should be ignored
    const ops = parseContentStream(stream('1 2 3'));
    expect(ops).toEqual([]);
  });

  it('handles extra whitespace between tokens', () => {
    const ops = parseContentStream(stream('  100   200   m  '));
    expect(ops).toHaveLength(1);
    expect(ops[0]!.operator).toBe('m');
    expect(ops[0]!.operands).toEqual([100, 200]);
  });

  it('handles newlines as token separators', () => {
    const ops = parseContentStream(stream('100\n200\nm'));
    expect(ops[0]!.operator).toBe('m');
    expect(ops[0]!.operands).toEqual([100, 200]);
  });

  it('handles carriage return + line feed', () => {
    const ops = parseContentStream(stream('100\r\n200\r\nm'));
    expect(ops[0]!.operator).toBe('m');
    expect(ops[0]!.operands).toEqual([100, 200]);
  });

  it('handles empty literal string', () => {
    const ops = parseContentStream(stream('() Tj'));
    expect(ops[0]!.operands[0]).toBe('');
  });

  it('handles empty hex string', () => {
    const ops = parseContentStream(stream('<> Tj'));
    expect(ops[0]!.operands[0]).toBe('');
  });

  it('handles empty array', () => {
    const ops = parseContentStream(stream('[] TJ'));
    const arr = ops[0]!.operands[0] as Operand[];
    expect(arr).toEqual([]);
  });
});

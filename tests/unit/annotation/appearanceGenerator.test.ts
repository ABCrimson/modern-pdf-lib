/**
 * Tests for annotation appearance stream generation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateSquareAppearance,
  generateCircleAppearance,
  generateLineAppearance,
  generateHighlightAppearance,
  generateUnderlineAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
  generateInkAppearance,
  generateFreeTextAppearance,
} from '../../../src/annotation/appearanceGenerator.js';
import { createAnnotation } from '../../../src/annotation/pdfAnnotation.js';
import { PdfSquareAnnotation } from '../../../src/annotation/types/shapeAnnotations.js';
import { PdfCircleAnnotation } from '../../../src/annotation/types/shapeAnnotations.js';
import { PdfLineAnnotation } from '../../../src/annotation/types/shapeAnnotations.js';
import { PdfHighlightAnnotation } from '../../../src/annotation/types/markupAnnotations.js';
import { PdfInkAnnotation } from '../../../src/annotation/types/inkAnnotation.js';
import { PdfFreeTextAnnotation } from '../../../src/annotation/types/freeTextAnnotation.js';
import { PdfDict, PdfName, PdfStream } from '../../../src/core/pdfObjects.js';
import { UnencodableTextError } from '../../../src/errors.js';

// Helper to decode stream content
function streamContent(stream: PdfStream): string {
  return new TextDecoder().decode(stream.data);
}

describe('generateSquareAppearance', () => {
  it('generates a Form XObject', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [50, 50, 150, 150],
      color: { r: 1, g: 0, b: 0 },
    });

    const ap = generateSquareAppearance(annot);
    expect(ap.kind).toBe('stream');
    expect((ap.dict.get('/Type') as PdfName).value).toBe('/XObject');
    expect((ap.dict.get('/Subtype') as PdfName).value).toBe('/Form');
    expect(ap.dict.has('/BBox')).toBe(true);
  });

  it('includes stroke color', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [0, 0, 100, 100],
      color: { r: 0, g: 0.5, b: 1 },
    });

    const content = streamContent(generateSquareAppearance(annot));
    expect(content).toContain('0 0.5 1 RG');
    expect(content).toContain('re');
    expect(content).toContain('S');
  });

  it('includes interior color fill', () => {
    const annot = PdfSquareAnnotation.create({
      rect: [0, 0, 100, 100],
      interiorColor: { r: 1, g: 1, b: 0 },
    });

    const content = streamContent(generateSquareAppearance(annot));
    expect(content).toContain('1 1 0 rg');
    expect(content).toContain('f');
  });
});

describe('generateCircleAppearance', () => {
  it('generates bezier curves for an ellipse', () => {
    const annot = PdfCircleAnnotation.create({
      rect: [0, 0, 100, 80],
      color: { r: 0, g: 0, b: 0 },
    });

    const content = streamContent(generateCircleAppearance(annot));
    // Should contain 4 bezier curve commands
    const curveCount = (content.match(/ c\n/g) ?? []).length;
    expect(curveCount).toBe(4);
    expect(content).toContain(' m\n'); // moveTo
  });

  it('fills and strokes when both colors present', () => {
    const annot = PdfCircleAnnotation.create({
      rect: [0, 0, 100, 100],
      color: { r: 0, g: 0, b: 0 },
      interiorColor: { r: 1, g: 0, b: 0 },
    });

    const content = streamContent(generateCircleAppearance(annot));
    expect(content).toContain('B'); // fill and stroke
  });
});

describe('generateLineAppearance', () => {
  it('draws a line using m and l operators', () => {
    const annot = PdfLineAnnotation.create({
      rect: [50, 50, 200, 60],
      linePoints: [50, 55, 200, 55],
      color: { r: 0, g: 0, b: 0 },
    });

    const content = streamContent(generateLineAppearance(annot));
    expect(content).toContain(' m\n');
    expect(content).toContain(' l\n');
    expect(content).toContain('S\n');
  });
});

describe('generateHighlightAppearance', () => {
  it('generates a filled rectangle appearance', () => {
    const annot = PdfHighlightAnnotation.create({
      rect: [50, 700, 200, 720],
      color: { r: 1, g: 1, b: 0 },
    });

    const content = streamContent(generateHighlightAppearance(annot));
    expect(content).toContain('1 1 0 rg');
    expect(content).toContain('f');
  });
});

describe('generateUnderlineAppearance', () => {
  it('draws a line at the bottom', () => {
    const annot = createAnnotation('Underline', {
      rect: [0, 0, 100, 20],
      color: { r: 0, g: 0, b: 1 },
    });

    const content = streamContent(generateUnderlineAppearance(annot));
    expect(content).toContain('0 0 1 RG');
    expect(content).toContain('S\n');
  });
});

describe('generateStrikeOutAppearance', () => {
  it('draws a line through the middle', () => {
    const annot = createAnnotation('StrikeOut', {
      rect: [0, 0, 100, 20],
      color: { r: 1, g: 0, b: 0 },
    });

    const content = streamContent(generateStrikeOutAppearance(annot));
    expect(content).toContain('1 0 0 RG');
    expect(content).toContain(' m\n');
    expect(content).toContain(' l\n');
    expect(content).toContain('S\n');
  });
});

describe('generateSquigglyAppearance', () => {
  it('generates a squiggly line', () => {
    const annot = createAnnotation('Squiggly', {
      rect: [0, 0, 100, 20],
    });

    const ap = generateSquigglyAppearance(annot);
    expect(ap.kind).toBe('stream');
    const content = streamContent(ap);
    // Should have multiple line-to commands for the squiggle
    expect(content).toContain(' l\n');
    expect(content).toContain('S\n');
  });
});

describe('generateInkAppearance', () => {
  it('draws ink paths', () => {
    const annot = PdfInkAnnotation.create({
      rect: [0, 0, 100, 100],
      color: { r: 0, g: 0, b: 0 },
      inkLists: [[10, 10, 50, 50, 90, 10]],
    });

    const content = streamContent(generateInkAppearance(annot));
    expect(content).toContain('0 0 0 RG');
    expect(content).toContain(' m\n');
    expect(content).toContain(' l\n');
    expect(content).toContain('S\n');
  });

  it('handles multiple ink paths', () => {
    const annot = PdfInkAnnotation.create({
      rect: [0, 0, 100, 100],
      inkLists: [
        [10, 10, 50, 50],
        [60, 60, 90, 90],
      ],
    });

    const content = streamContent(generateInkAppearance(annot));
    const moveCount = (content.match(/ m\n/g) ?? []).length;
    expect(moveCount).toBe(2);
  });
});

describe('generateFreeTextAppearance', () => {
  it('generates text content with BT/ET', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [50, 700, 300, 730],
      text: 'Hello World',
      fontSize: 14,
    });

    const content = streamContent(generateFreeTextAppearance(annot));
    expect(content).toContain('BT');
    expect(content).toContain('ET');
    expect(content).toContain('Hello World');
    expect(content).toContain('Tf');
  });

  it('includes resources with Helvetica font', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: 'Test',
    });

    const ap = generateFreeTextAppearance(annot);
    const resources = ap.dict.get('/Resources') as PdfDict;
    expect(resources).toBeDefined();
    const fontDict = resources.get('/Font') as PdfDict;
    expect(fontDict).toBeDefined();
    expect(fontDict.has('/Helv')).toBe(true);
  });

  it('escapes special characters in text', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: 'a (test) with \\ chars',
    });

    const content = streamContent(generateFreeTextAppearance(annot));
    expect(content).toContain('\\(test\\)');
    expect(content).toContain('\\\\');
  });
});

describe('generateFreeTextAppearance text encoding', () => {
  /** The font entry of the appearance stream under `alias`. */
  function fontEntry(ap: PdfStream, alias: string): PdfDict {
    const resources = ap.dict.get('/Resources') as PdfDict;
    return (resources.get('/Font') as PdfDict).get(alias) as PdfDict;
  }

  it('shows text of the Helv font as WinAnsi codes in an ASCII literal string', () => {
    const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 200, 30], text: 'José € (1)' });
    const ap = generateFreeTextAppearance(annot);

    // é is code 0xE9 (octal 351) and the euro sign is code 0x80 (octal 200).
    expect(streamContent(ap)).toContain('(Jos\\351 \\200 \\(1\\)) Tj');
    expect(ap.data.every((byte) => byte < 0x80)).toBe(true);
    const helv = fontEntry(ap, '/Helv');
    expect((helv.get('/BaseFont') as PdfName).value).toBe('/Helvetica');
    expect((helv.get('/Encoding') as PdfName).value).toBe('/WinAnsiEncoding');
  });

  it('encodes through the standard font that the alias of the DA names', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: 'α',
      defaultAppearance: '0 g /Symb 12 Tf',
    });
    const ap = generateFreeTextAppearance(annot);

    // alpha is code 0x61 of the built-in encoding of Symbol.
    expect(streamContent(ap)).toContain('(a) Tj');
    const symb = fontEntry(ap, '/Symb');
    expect((symb.get('/BaseFont') as PdfName).value).toBe('/Symbol');
    expect(symb.has('/Encoding')).toBe(false);
  });

  it('defines the font of a Times alias with WinAnsiEncoding', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: 'Ünal',
      defaultAppearance: '0 g /TiRo 12 Tf',
    });
    const ap = generateFreeTextAppearance(annot);

    expect(streamContent(ap)).toContain('(\\334nal) Tj');
    const tiro = fontEntry(ap, '/TiRo');
    expect((tiro.get('/BaseFont') as PdfName).value).toBe('/Times-Roman');
    expect((tiro.get('/Encoding') as PdfName).value).toBe('/WinAnsiEncoding');
  });

  it('encodes as WinAnsi for a font name that is no alias', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: 'José',
      defaultAppearance: '0 g /F1 12 Tf',
    });

    const ap = generateFreeTextAppearance(annot);
    expect(streamContent(ap)).toContain('(Jos\\351) Tj');
    const f1 = fontEntry(ap, '/F1');
    expect((f1.get('/BaseFont') as PdfName).value).toBe('/Helvetica');
    expect((f1.get('/Encoding') as PdfName).value).toBe('/WinAnsiEncoding');
  });

  it.each([
    ['Helv', 'Helvetica'],
    ['HeBo', 'Helvetica-Bold'],
    ['HeOb', 'Helvetica-Oblique'],
    ['HeBO', 'Helvetica-BoldOblique'],
    ['TiRo', 'Times-Roman'],
    ['TiBo', 'Times-Bold'],
    ['TiIt', 'Times-Italic'],
    ['TiBI', 'Times-BoldItalic'],
    ['Cour', 'Courier'],
    ['CoBo', 'Courier-Bold'],
    ['CoOb', 'Courier-Oblique'],
    ['CoBO', 'Courier-BoldOblique'],
    ['Symb', 'Symbol'],
    ['ZaDb', 'ZapfDingbats'],
    ['Helvetica-Bold', 'Helvetica-Bold'],
  ])('defines /%s as the standard font %s', (name, baseFont) => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 30],
      text: '',
      defaultAppearance: `0 g /${name} 12 Tf`,
    });
    const entry = fontEntry(generateFreeTextAppearance(annot), `/${name}`);
    expect((entry.get('/BaseFont') as PdfName).value).toBe(`/${baseFont}`);
  });

  it('shows each line of the text with its own operator', () => {
    const annot = PdfFreeTextAnnotation.create({
      rect: [0, 0, 200, 60],
      text: 'one\r\ntwo\nthree\rfour',
      fontSize: 10,
    });
    const content = streamContent(generateFreeTextAppearance(annot));

    expect(content.match(/\((one|two|three|four)\) Tj/g)).toEqual([
      '(one) Tj',
      '(two) Tj',
      '(three) Tj',
      '(four) Tj',
    ]);
    expect(content.match(/ Td\n/g)).toHaveLength(4);
  });

  it('throws UnencodableTextError for text the font cannot encode', () => {
    const annot = PdfFreeTextAnnotation.create({ rect: [0, 0, 200, 30], text: '日本語' });

    expect(() => generateFreeTextAppearance(annot)).toThrow(UnencodableTextError);
  });
});

describe('appearance stream structure', () => {
  it('all generated streams have /Type, /Subtype, /BBox', () => {
    const generators = [
      () => {
        const a = PdfSquareAnnotation.create({
          rect: [0, 0, 100, 100],
          color: { r: 0, g: 0, b: 0 },
        });
        return generateSquareAppearance(a);
      },
      () => {
        const a = PdfCircleAnnotation.create({
          rect: [0, 0, 100, 100],
          color: { r: 0, g: 0, b: 0 },
        });
        return generateCircleAppearance(a);
      },
      () => {
        const a = PdfLineAnnotation.create({
          rect: [0, 0, 100, 100],
          linePoints: [0, 0, 100, 100],
        });
        return generateLineAppearance(a);
      },
      () => {
        const a = PdfHighlightAnnotation.create({ rect: [0, 0, 100, 20] });
        return generateHighlightAppearance(a);
      },
    ];

    for (const gen of generators) {
      const stream = gen();
      expect(stream.dict.has('/Type')).toBe(true);
      expect(stream.dict.has('/Subtype')).toBe(true);
      expect(stream.dict.has('/BBox')).toBe(true);
    }
  });
});

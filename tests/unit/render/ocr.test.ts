import { describe, it, expect } from 'vitest';
import { applyOcr } from '../../../src/render/ocr.js';
import type { OcrEngine, OcrWord } from '../../../src/render/ocr.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import type { Operand } from '../../../src/parser/contentStreamParser.js';

/** A deterministic stub engine that always recognizes a single word. */
function stubEngine(words: OcrWord[]): OcrEngine {
  return {
    async recognize(rgba: Uint8Array, width: number, height: number): Promise<OcrWord[]> {
      // Sanity: the harness must hand us a real RGBA buffer of width*height*4.
      expect(rgba.length).toBe(width * height * 4);
      return words;
    },
  };
}

/** Pull the JS-string operand out of every `Tj` operator. */
function tjStrings(ops: { operator: string; operands: Operand[] }[]): string[] {
  const out: string[] = [];
  for (const op of ops) {
    if (op.operator === 'Tj' && typeof op.operands[0] === 'string') {
      out.push(op.operands[0]);
    }
  }
  return out;
}

/** Collect every numeric operand of a `Tr` (text-rendering-mode) operator. */
function trModes(ops: { operator: string; operands: Operand[] }[]): number[] {
  const out: number[] = [];
  for (const op of ops) {
    if (op.operator === 'Tr' && typeof op.operands[0] === 'number') {
      out.push(op.operands[0]);
    }
  }
  return out;
}

describe('applyOcr — invisible OCR text overlay', () => {
  it('appends an invisible (Tr 3) Tj layer for each recognized word and returns the words', async () => {
    const word: OcrWord = { text: 'hello', x: 50, y: 50, width: 40, height: 12 };

    const doc = createPdf();
    const page = doc.addPage([200, 200]);
    // Paint something so the rasterizer has real content to render.
    page.drawRectangle({ x: 10, y: 10, width: 80, height: 80, color: [0, 0, 0] as never });

    const returned = await applyOcr(page, stubEngine([word]));
    expect(returned).toEqual([word]);

    // Round-trip through save/load so we test the persisted content stream.
    const bytes = await doc.save();
    const loaded = await loadPdf(bytes);
    const reloadedPage = loaded.getPage(0);
    const ops = parseContentStream(reloadedPage.getContentStream());

    // The text must be present as a Tj literal string.
    expect(tjStrings(ops)).toContain('hello');

    // Invisible render mode 3 must have been emitted.
    expect(trModes(ops)).toContain(3);
  });

  it('escapes (, ) and \\ in the recognized text', async () => {
    const word: OcrWord = { text: 'a(b)c\\d', x: 10, y: 20, width: 50, height: 10 };

    const doc = createPdf();
    const page = doc.addPage([120, 120]);

    const returned = await applyOcr(page, stubEngine([word]));
    expect(returned).toEqual([word]);

    const ops = parseContentStream(page.getContentStream());
    // The parser decodes escapes back to the original characters.
    expect(tjStrings(ops)).toContain('a(b)c\\d');
    expect(trModes(ops)).toContain(3);
  });

  it('handles multiple words and an empty result without throwing', async () => {
    const words: OcrWord[] = [
      { text: 'foo', x: 5, y: 5, width: 20, height: 8 },
      { text: 'bar', x: 40, y: 60, width: 20, height: 8 },
    ];

    const doc = createPdf();
    const page = doc.addPage([100, 100]);
    const returned = await applyOcr(page, stubEngine(words));
    expect(returned).toEqual(words);

    const ops = parseContentStream(page.getContentStream());
    const strings = tjStrings(ops);
    expect(strings).toContain('foo');
    expect(strings).toContain('bar');
    expect(trModes(ops).filter((m) => m === 3).length).toBeGreaterThanOrEqual(2);

    // An engine that finds nothing must return [] and append no Tj text.
    const doc2 = createPdf();
    const page2 = doc2.addPage([100, 100]);
    const none = await applyOcr(page2, stubEngine([]));
    expect(none).toEqual([]);
  });

  it('honors a custom dpi without crashing the rasterizer', async () => {
    const word: OcrWord = { text: 'zoom', x: 30, y: 30, width: 30, height: 10 };
    const doc = createPdf();
    const page = doc.addPage([150, 150]);

    const returned = await applyOcr(page, stubEngine([word]), { dpi: 144 });
    expect(returned).toEqual([word]);

    const ops = parseContentStream(page.getContentStream());
    expect(tjStrings(ops)).toContain('zoom');
    expect(trModes(ops)).toContain(3);
  });
});

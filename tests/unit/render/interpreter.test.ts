import { describe, it, expect } from 'vitest';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { interpretContentStream, interpretPage } from '../../../src/render/interpreter.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

const ops = (s: string) => parseContentStream(new TextEncoder().encode(s));

describe('interpretContentStream — graphics-state machine → display list', () => {
  it('produces a page-space FillItem for a CTM-transformed rectangle fill', () => {
    const dl = interpretContentStream(
      ops(`0 0 1 rg
           q
           100 0 0 100 50 50 cm
           0 0 1 1 re
           f
           Q`),
      { width: 200, height: 200 },
    );
    expect(dl.items.length).toBe(1);
    const item = dl.items[0]!;
    expect(item.type).toBe('fill');
    if (item.type !== 'fill') throw new Error('expected fill');
    expect(item.rule).toBe('nonzero');
    expect(item.color).toEqual([0, 0, 255, 255]);
    const pts = item.subpaths[0]!.points;
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    // rect (0,0)-(1,1) under scale100 + translate50 → (50,50)-(150,150)
    expect(Math.min(...xs)).toBeCloseTo(50);
    expect(Math.max(...xs)).toBeCloseTo(150);
    expect(Math.min(...ys)).toBeCloseTo(50);
    expect(Math.max(...ys)).toBeCloseTo(150);
  });

  it('honors the q/Q graphics-state stack for fill color', () => {
    const dl = interpretContentStream(
      ops(`1 0 0 rg
           0 0 10 10 re f
           q 0 1 0 rg 20 20 10 10 re f Q
           30 30 10 10 re f`),
      { width: 100, height: 100 },
    );
    const colors = dl.items.map((i) => (i.type === 'fill' ? i.color : null));
    expect(colors).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [255, 0, 0, 255],
    ]);
  });

  it('records strokes with a CTM-scaled line width', () => {
    const dl = interpretContentStream(
      ops(`2 w
           q 3 0 0 3 0 0 cm 0 0 m 10 0 l S Q`),
      { width: 100, height: 100 },
    );
    const s = dl.items[0]!;
    expect(s.type).toBe('stroke');
    if (s.type !== 'stroke') throw new Error('expected stroke');
    expect(s.lineWidth).toBeCloseTo(6); // 2 × scale 3
  });

  it('converts gray and CMYK fill colors to RGBA', () => {
    const dl = interpretContentStream(
      ops(`0.5 g 0 0 1 1 re f
           0 1 1 0 k 2 2 1 1 re f`),
      { width: 10, height: 10 },
    );
    const f0 = dl.items[0]!;
    const f1 = dl.items[1]!;
    if (f0.type !== 'fill' || f1.type !== 'fill') throw new Error('expected fills');
    expect(f0.color).toEqual([128, 128, 128, 255]); // 0.5 gray
    // cmyk(0,1,1,0) → red
    expect(f1.color[0]).toBe(255);
    expect(f1.color[1]).toBe(0);
    expect(f1.color[2]).toBe(0);
  });

  it('flattens Bézier curves into the fill polygon', () => {
    const dl = interpretContentStream(
      ops(`0 0 m 0 100 100 100 100 0 c f`),
      { width: 100, height: 100 },
    );
    const item = dl.items[0]!;
    if (item.type !== 'fill') throw new Error('expected fill');
    // a flattened cubic should yield many points, not just the 2 endpoints
    expect(item.subpaths[0]!.points.length / 2).toBeGreaterThan(8);
  });

  it('captures text shows as TextItems with transform + render mode', () => {
    const dl = interpretContentStream(
      ops(`BT /F1 24 Tf 1 0 0 1 72 700 Tm (Hello) Tj ET`),
      { width: 612, height: 792 },
    );
    const t = dl.items.find((i) => i.type === 'text');
    expect(t).toBeDefined();
    if (!t || t.type !== 'text') throw new Error('expected text');
    expect(t.text).toBe('Hello');
    expect(t.font).toBe('F1');
    expect(t.fontSize).toBe(24);
    expect(t.renderMode).toBe(0);
    // origin at (72, 700)
    expect(t.transform[4]).toBeCloseTo(72);
    expect(t.transform[5]).toBeCloseTo(700);
  });

  it('interpretPage() interprets a real created page end-to-end', async () => {
    const doc = PdfDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 80 });
    page.drawText('Hi', { x: 60, y: 200, size: 20 });
    const bytes = await doc.save();

    const loaded = await PdfDocument.load(bytes);
    const dl = interpretPage(loaded.getPage(0));

    expect(dl.width).toBe(300);
    expect(dl.height).toBe(300);
    expect(dl.items.some((i) => i.type === 'fill' || i.type === 'stroke')).toBe(true);
    expect(dl.items.some((i) => i.type === 'text' && i.text.includes('Hi'))).toBe(true);
  });
});

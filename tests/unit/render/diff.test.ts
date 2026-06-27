import { describe, it, expect } from 'vitest';
import { compareImages, comparePages } from '../../../src/render/diff.js';
import type { RasterImage } from '../../../src/render/rasterizer.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

function solid(w: number, h: number, c: [number, number, number]): RasterImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe('compareImages — pixel diff + SSIM', () => {
  it('reports zero change and SSIM 1 for identical images', () => {
    const a = solid(32, 32, [200, 100, 50]);
    const b = solid(32, 32, [200, 100, 50]);
    const r = compareImages(a, b);
    expect(r.changedPixels).toBe(0);
    expect(r.changedRatio).toBe(0);
    expect(r.ssim).toBeCloseTo(1, 5);
  });

  it('detects changed pixels and lowers SSIM when images differ', () => {
    const a = solid(32, 32, [255, 255, 255]);
    const b = solid(32, 32, [255, 255, 255]);
    // paint a black 8×8 block into b
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (y * 32 + x) * 4;
        b.data[i] = 0;
        b.data[i + 1] = 0;
        b.data[i + 2] = 0;
      }
    }
    const r = compareImages(a, b);
    expect(r.changedPixels).toBe(64);
    expect(r.changedRatio).toBeCloseTo(64 / 1024, 5);
    expect(r.ssim).toBeLessThan(1);
    expect(r.ssim).toBeGreaterThanOrEqual(0);
    // heatmap should mark the changed region red
    expect(r.heatmap[0]).toBeGreaterThan(r.heatmap[1]!); // R > G at (0,0)
  });

  it('comparePages rasterizes two pages and scores their difference', async () => {
    const mk = async (label: string): Promise<PdfDocument> => {
      const doc = PdfDocument.create();
      const page = doc.addPage([100, 100]);
      page.drawRectangle({ x: 10, y: 10, width: 30, height: 30 });
      if (label === 'b') page.drawRectangle({ x: 60, y: 60, width: 20, height: 20 });
      const bytes = await doc.save();
      return PdfDocument.load(bytes);
    };
    const a = (await mk('a')).getPage(0);
    const b = (await mk('b')).getPage(0);
    const r = await comparePages(a, b, { scale: 1 });
    expect(r.width).toBe(100);
    expect(r.changedPixels).toBeGreaterThan(0);
    expect(r.ssim).toBeLessThan(1);
  });
});

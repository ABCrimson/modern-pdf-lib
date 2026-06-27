import { describe, it, expect } from 'vitest';
import { rasterize, renderPageToImage } from '../../../src/render/rasterizer.js';
import type { DisplayList } from '../../../src/render/displayList.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

function px(img: { data: Uint8Array; width: number }, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
}

describe('rasterize — scanline display-list renderer', () => {
  const rectFill: DisplayList = {
    items: [
      {
        type: 'fill',
        subpaths: [{ points: [50, 50, 150, 50, 150, 150, 50, 150], closed: true }],
        rule: 'nonzero',
        color: [255, 0, 0, 255],
        alpha: 1,
      },
    ],
    width: 200,
    height: 200,
    origin: [0, 0],
  };

  it('fills a rectangle in the right pixels (with y-flip) on a white background', () => {
    const img = rasterize(rectFill, { scale: 1 });
    expect(img.width).toBe(200);
    expect(img.height).toBe(200);
    // page (100,100) center → pixel (100,100) → red
    expect(px(img, 100, 100)).toEqual([255, 0, 0, 255]);
    // outside the rect → white background
    expect(px(img, 10, 10)).toEqual([255, 255, 255, 255]);
  });

  it('scales by dpi (72 dpi = 1.0)', () => {
    const img = rasterize(rectFill, { dpi: 144 }); // 2×
    expect(img.width).toBe(400);
    expect(img.height).toBe(400);
    expect(px(img, 200, 200)).toEqual([255, 0, 0, 255]); // center still red
  });

  it('anti-aliases edges (partial coverage at the boundary)', () => {
    // a triangle to force a diagonal edge
    const tri: DisplayList = {
      items: [
        {
          type: 'fill',
          subpaths: [{ points: [10, 10, 90, 10, 10, 90], closed: true }],
          rule: 'nonzero',
          color: [0, 0, 0, 255],
          alpha: 1,
        },
      ],
      width: 100,
      height: 100,
      origin: [0, 0],
    };
    const img = rasterize(tri, { scale: 1 });
    // somewhere along the hypotenuse there should be a gray (partially covered) pixel
    let foundGray = false;
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i]!;
      if (v > 20 && v < 235) {
        foundGray = true;
        break;
      }
    }
    expect(foundGray).toBe(true);
  });

  it('respects the even-odd rule (donut has a hole)', () => {
    const donut: DisplayList = {
      items: [
        {
          type: 'fill',
          subpaths: [
            { points: [10, 10, 90, 10, 90, 90, 10, 90], closed: true },
            { points: [40, 40, 60, 40, 60, 60, 40, 60], closed: true },
          ],
          rule: 'evenodd',
          color: [0, 0, 0, 255],
          alpha: 1,
        },
      ],
      width: 100,
      height: 100,
      origin: [0, 0],
    };
    const img = rasterize(donut, { scale: 1 });
    // center (50,50) is in the inner hole → background white
    expect(px(img, 50, 50)).toEqual([255, 255, 255, 255]);
    // (20,50) is in the ring → black
    expect(px(img, 20, 50)[0]).toBeLessThan(40);
  });

  it('renderPageToImage() produces a valid PNG of a created page', async () => {
    const doc = PdfDocument.create();
    const page = doc.addPage([120, 120]);
    page.drawRectangle({ x: 20, y: 20, width: 80, height: 80, color: { type: 'rgb', r: 0, g: 0, b: 1 } as never });
    const bytes = await doc.save();
    const loaded = await PdfDocument.load(bytes);

    const out = await renderPageToImage(loaded.getPage(0), { scale: 1 });
    expect(out.width).toBe(120);
    expect(out.height).toBe(120);
    // PNG magic number
    expect(Array.from(out.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

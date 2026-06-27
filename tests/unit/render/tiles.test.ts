import { describe, it, expect } from 'vitest';
import { computeTileGrid, renderPageTile, RenderCache } from '../../../src/render/tiles.js';
import { rasterize } from '../../../src/render/rasterizer.js';
import { interpretPage } from '../../../src/render/interpreter.js';
import { PdfDocument } from '../../../src/core/pdfDocument.js';

async function loadPage(w: number, h: number) {
  const doc = PdfDocument.create();
  const page = doc.addPage([w, h]);
  page.drawRectangle({ x: 15, y: 15, width: 50, height: 50, color: { type: 'rgb', r: 1, g: 0, b: 0 } as never });
  const bytes = await doc.save();
  return (await PdfDocument.load(bytes)).getPage(0);
}

describe('tiling + render cache', () => {
  it('computes a tile grid covering the full image', async () => {
    const page = await loadPage(100, 100);
    const grid = computeTileGrid(page, { tileSize: 40, scale: 1 });
    expect(grid.fullWidth).toBe(100);
    expect(grid.fullHeight).toBe(100);
    expect(grid.columns).toBe(3); // 40,40,20
    expect(grid.rows).toBe(3);
  });

  it('tiles stitch back to the same pixels as a full render', async () => {
    const page = await loadPage(100, 100);
    const full = rasterize(interpretPage(page), { scale: 1 });
    const grid = computeTileGrid(page, { tileSize: 40, scale: 1 });

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.columns; col++) {
        const tile = renderPageTile(page, col, row, { tileSize: 40, scale: 1 });
        const ox = col * 40;
        const oy = row * 40;
        // spot-check the tile's top-left pixel against the full image
        const fi = (oy * full.width + ox) * 4;
        expect([tile.data[0], tile.data[1], tile.data[2]]).toEqual([
          full.data[fi],
          full.data[fi + 1],
          full.data[fi + 2],
        ]);
      }
    }
  });

  it('RenderCache evicts least-recently-used entries', () => {
    const c = new RenderCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1); // touch 'a' → 'b' is now LRU
    c.set('c', 3); // evicts 'b'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
    expect(c.has('c')).toBe(true);
    expect(c.size).toBe(2);
  });
});

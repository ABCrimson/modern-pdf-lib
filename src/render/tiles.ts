/**
 * @module render/tiles
 *
 * Tile-based rendering of large pages plus a small LRU cache. A page is
 * interpreted once into a {@link DisplayList}; each tile rasterizes only its
 * pixel sub-window via the rasterizer's `region` option, so arbitrarily large
 * pages render in bounded memory.
 *
 * @packageDocumentation
 */

import { rasterize, type RasterImage, type RenderOptions } from './rasterizer.js';
import { interpretPage } from './interpreter.js';
import type { DisplayList } from './displayList.js';
import type { PdfPage } from '../core/pdfPage.js';

/** Options for tiling. */
export interface TileOptions {
  /** Tile edge length in pixels. Default 512. */
  tileSize?: number | undefined;
  /** Scale (1 = 72 dpi). Overrides `dpi`. */
  scale?: number | undefined;
  /** Target dpi (72 = scale 1). */
  dpi?: number | undefined;
  /** Background fill. */
  background?: RenderOptions['background'];
  /** Render text runs. Default true. */
  renderText?: boolean | undefined;
}

/** Tile grid geometry for a page at a given scale. */
export interface TileGrid {
  readonly columns: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly fullWidth: number;
  readonly fullHeight: number;
  readonly scale: number;
}

function scaleOf(opts: TileOptions): number {
  if (typeof opts.scale === 'number') return opts.scale;
  if (typeof opts.dpi === 'number') return opts.dpi / 72;
  return 1;
}

function gridFromDisplayList(dl: DisplayList, opts: TileOptions): TileGrid {
  const scale = scaleOf(opts);
  const tileSize = opts.tileSize ?? 512;
  const fullWidth = Math.max(1, Math.ceil(dl.width * scale));
  const fullHeight = Math.max(1, Math.ceil(dl.height * scale));
  return {
    columns: Math.max(1, Math.ceil(fullWidth / tileSize)),
    rows: Math.max(1, Math.ceil(fullHeight / tileSize)),
    tileSize,
    fullWidth,
    fullHeight,
    scale,
  };
}

/** Compute the tile grid for a page. */
export function computeTileGrid(page: PdfPage, opts: TileOptions = {}): TileGrid {
  return gridFromDisplayList(interpretPage(page), opts);
}

/** Render a single tile `(column, row)` of a page to an RGBA image. */
export function renderPageTile(page: PdfPage, column: number, row: number, opts: TileOptions = {}): RasterImage {
  const dl = interpretPage(page);
  const grid = gridFromDisplayList(dl, opts);
  const x = column * grid.tileSize;
  const y = row * grid.tileSize;
  const width = Math.min(grid.tileSize, grid.fullWidth - x);
  const height = Math.min(grid.tileSize, grid.fullHeight - y);
  return rasterize(dl, {
    scale: grid.scale,
    background: opts.background,
    renderText: opts.renderText ?? true,
    region: { x, y, width: Math.max(1, width), height: Math.max(1, height) },
  });
}

// ---------------------------------------------------------------------------
// LRU cache
// ---------------------------------------------------------------------------

/**
 * A simple least-recently-used cache (Map-backed). Useful for memoizing
 * interpreted display lists or rasterized tiles across renders.
 */
export class RenderCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly maxEntries: number = 64) {}

  /** Number of cached entries. */
  get size(): number {
    return this.map.size;
  }

  /** Look up a value, marking it most-recently-used. */
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  /** Whether a key is present (without affecting recency). */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Insert/replace a value, evicting the LRU entry when over capacity. */
  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  /** Remove a key. */
  delete(key: string): boolean {
    return this.map.delete(key);
  }

  /** Empty the cache. */
  clear(): void {
    this.map.clear();
  }
}

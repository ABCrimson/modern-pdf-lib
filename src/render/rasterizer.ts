/**
 * @module render/rasterizer
 *
 * A dependency-free scanline rasterizer that turns a {@link DisplayList} into an
 * RGBA8888 pixel buffer, and {@link renderPageToImage} which renders a page to
 * a PNG. Fills use 4× vertical supersampling + fractional horizontal coverage
 * for anti-aliasing, honor the nonzero/even-odd winding rules, and composite
 * with constant alpha. Strokes are expanded to filled quads.
 *
 * Vector paths and strokes render at full fidelity. Text is rendered as
 * positioned glyph boxes (no bundled font engine — use
 * {@link module:render/canvas} for native, high-fidelity text in browsers).
 * Image XObjects are not yet rasterized here (see `extractImages`).
 *
 * @packageDocumentation
 */

import type { DisplayList, Rgba, SubPath } from './displayList.js';
import { applyToPoint } from './matrix.js';
import { interpretPage } from './interpreter.js';
import { encodePngFromPixels } from '../assets/image/webpOptimize.js';
import type { PdfPage } from '../core/pdfPage.js';

/** Options controlling raster output. */
export interface RenderOptions {
  /** Scale factor (1 = 72 dpi / 1 px per user unit). Overrides `dpi`. */
  scale?: number | undefined;
  /** Target resolution in dots per inch (72 dpi = scale 1). */
  dpi?: number | undefined;
  /** Background fill; `'transparent'` for a transparent canvas. Default white. */
  background?: Rgba | 'transparent' | undefined;
  /** Render text runs as positioned glyph boxes. Default `true`. */
  renderText?: boolean | undefined;
  /**
   * Render only a pixel sub-window of the full-scale image (for tiling huge
   * pages). `x`/`y` are the tile's top-left in full-image pixel coordinates;
   * the returned image is `width`×`height`.
   */
  region?: { x: number; y: number; width: number; height: number } | undefined;
}

/** A raw RGBA8888 image. */
export interface RasterImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

function resolveScale(opts: RenderOptions): number {
  if (typeof opts.scale === 'number') return opts.scale;
  if (typeof opts.dpi === 'number') return opts.dpi / 72;
  return 1;
}

/** Rasterize a display list to an RGBA8888 buffer. */
export function rasterize(dl: DisplayList, opts: RenderOptions = {}): RasterImage {
  const scale = resolveScale(opts);
  const fullH = Math.max(1, Math.ceil(dl.height * scale));
  const region = opts.region ?? {
    x: 0,
    y: 0,
    width: Math.max(1, Math.ceil(dl.width * scale)),
    height: fullH,
  };
  const W = Math.max(1, region.width);
  const H = Math.max(1, region.height);
  const data = new Uint8Array(W * H * 4);

  const bg = opts.background ?? [255, 255, 255, 255];
  if (bg !== 'transparent') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = bg[0];
      data[i + 1] = bg[1];
      data[i + 2] = bg[2];
      data[i + 3] = bg[3];
    }
  }

  const [ox, oy] = dl.origin;
  /** page space → region-local pixel space (with y-flip + tile offset). */
  const toPx = (x: number, y: number): [number, number] => [
    (x - ox) * scale - region.x,
    fullH - (y - oy) * scale - region.y,
  ];

  const renderText = opts.renderText ?? true;

  for (const item of dl.items) {
    const clip = item.clip ? toPixelSubpaths(item.clip, toPx) : undefined;
    if (item.type === 'fill') {
      fillSubpaths(data, W, H, toPixelSubpaths(item.subpaths, toPx), item.rule, item.color, item.alpha, clip);
    } else if (item.type === 'stroke') {
      strokeSubpaths(data, W, H, item.subpaths, toPx, item.lineWidth * scale, item.color, item.alpha, clip);
    } else if (item.type === 'text' && renderText && item.renderMode !== 3 && item.renderMode !== 7) {
      fillTextBoxes(data, W, H, item, toPx, clip);
    }
    // image items: not rasterized here (see extractImages); skipped.
  }

  return { data, width: W, height: H };
}

/**
 * Render a {@link PdfPage} to a PNG image.
 * @returns The PNG bytes plus pixel dimensions.
 */
export async function renderPageToImage(
  page: PdfPage,
  opts: RenderOptions = {},
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const img = rasterize(interpretPage(page), opts);
  const png = encodePngFromPixels(img.data, img.width, img.height, 4);
  return { data: png, width: img.width, height: img.height };
}

// ---------------------------------------------------------------------------
// Geometry → pixel space
// ---------------------------------------------------------------------------

function toPixelSubpaths(
  subpaths: readonly SubPath[],
  toPx: (x: number, y: number) => [number, number],
): number[][] {
  return subpaths.map((s) => {
    const out: number[] = [];
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      const [px, py] = toPx(s.points[i]!, s.points[i + 1]!);
      out.push(px, py);
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Scanline AA fill
// ---------------------------------------------------------------------------

interface Edge {
  ymin: number;
  ymax: number;
  xAtYmin: number;
  dxdy: number;
  dir: number; // +1 (upward) / -1 (downward)
}

function buildEdges(subpaths: number[][]): Edge[] {
  const edges: Edge[] = [];
  for (const pts of subpaths) {
    const n = pts.length / 2;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2]!;
      const y0 = pts[i * 2 + 1]!;
      const j = (i + 1) % n;
      const x1 = pts[j * 2]!;
      const y1 = pts[j * 2 + 1]!;
      if (y0 === y1) continue; // horizontal edges contribute nothing
      if (y0 < y1) {
        edges.push({ ymin: y0, ymax: y1, xAtYmin: x0, dxdy: (x1 - x0) / (y1 - y0), dir: 1 });
      } else {
        edges.push({ ymin: y1, ymax: y0, xAtYmin: x1, dxdy: (x0 - x1) / (y0 - y1), dir: -1 });
      }
    }
  }
  return edges;
}

const SUBSAMPLES = 4;

function fillSubpaths(
  data: Uint8Array,
  W: number,
  H: number,
  subpaths: number[][],
  rule: 'nonzero' | 'evenodd',
  color: Rgba,
  alpha: number,
  clip: number[][] | undefined,
): void {
  const edges = buildEdges(subpaths);
  if (!edges.length) return;
  const clipEdges = clip ? buildEdges(clip) : undefined;

  let yTop = H;
  let yBot = 0;
  for (const e of edges) {
    yTop = Math.min(yTop, e.ymin);
    yBot = Math.max(yBot, e.ymax);
  }
  const rowStart = Math.max(0, Math.floor(yTop));
  const rowEnd = Math.min(H, Math.ceil(yBot));

  const coverage = new Float32Array(W);
  const inc = 1 / SUBSAMPLES;

  for (let y = rowStart; y < rowEnd; y++) {
    coverage.fill(0);
    for (let s = 0; s < SUBSAMPLES; s++) {
      const sy = y + (s + 0.5) / SUBSAMPLES;
      accumulateSpans(coverage, W, edges, sy, rule, inc, clipEdges);
    }
    const r = color[0];
    const g = color[1];
    const b = color[2];
    const ca = (color[3] / 255) * alpha;
    const base = y * W * 4;
    for (let x = 0; x < W; x++) {
      const cov = coverage[x]!;
      if (cov <= 0) continue;
      blend(data, base + x * 4, r, g, b, Math.min(1, cov) * ca);
    }
  }
}

/** Build winding spans at sub-scanline `sy`, adding fractional coverage. */
function accumulateSpans(
  coverage: Float32Array,
  W: number,
  edges: Edge[],
  sy: number,
  rule: 'nonzero' | 'evenodd',
  weight: number,
  clipEdges: Edge[] | undefined,
): void {
  const xs = crossings(edges, sy);
  if (xs.length < 2) return;
  const clipSpans = clipEdges ? rowSpans(crossings(clipEdges, sy), 'nonzero') : undefined;

  const spans = rowSpans(xs, rule);
  for (const [x0, x1] of spans) {
    if (clipSpans) {
      for (const [c0, c1] of clipSpans) {
        addSpan(coverage, W, Math.max(x0, c0), Math.min(x1, c1), weight);
      }
    } else {
      addSpan(coverage, W, x0, x1, weight);
    }
  }
}

function crossings(edges: Edge[], sy: number): { x: number; dir: number }[] {
  const xs: { x: number; dir: number }[] = [];
  for (const e of edges) {
    if (sy >= e.ymin && sy < e.ymax) {
      xs.push({ x: e.xAtYmin + (sy - e.ymin) * e.dxdy, dir: e.dir });
    }
  }
  xs.sort((a, b) => a.x - b.x);
  return xs;
}

function rowSpans(xs: { x: number; dir: number }[], rule: 'nonzero' | 'evenodd'): [number, number][] {
  const spans: [number, number][] = [];
  let winding = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    winding += xs[i]!.dir;
    const inside = rule === 'evenodd' ? (i + 1) % 2 === 1 : winding !== 0;
    if (inside) spans.push([xs[i]!.x, xs[i + 1]!.x]);
  }
  return spans;
}

/** Add `weight` coverage over `[x0, x1)` with fractional pixel ends. */
function addSpan(coverage: Float32Array, W: number, x0: number, x1: number, weight: number): void {
  if (x1 <= x0) return;
  const a = Math.max(0, x0);
  const b = Math.min(W, x1);
  if (b <= a) return;
  const ia = Math.floor(a);
  const ib = Math.floor(b - 1e-9);
  if (ia === ib) {
    coverage[ia]! += (b - a) * weight;
    return;
  }
  coverage[ia]! += (ia + 1 - a) * weight;
  for (let x = ia + 1; x < ib; x++) coverage[x]! += weight;
  coverage[ib]! += (b - ib) * weight;
}

function blend(data: Uint8Array, idx: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  const ia = 1 - a;
  data[idx] = Math.round(r * a + data[idx]! * ia);
  data[idx + 1] = Math.round(g * a + data[idx + 1]! * ia);
  data[idx + 2] = Math.round(b * a + data[idx + 2]! * ia);
  data[idx + 3] = Math.round(255 * a + data[idx + 3]! * ia);
}

// ---------------------------------------------------------------------------
// Stroke (expand segments to filled quads)
// ---------------------------------------------------------------------------

function strokeSubpaths(
  data: Uint8Array,
  W: number,
  H: number,
  subpaths: readonly SubPath[],
  toPx: (x: number, y: number) => [number, number],
  widthPx: number,
  color: Rgba,
  alpha: number,
  clip: number[][] | undefined,
): void {
  const hw = Math.max(widthPx / 2, 0.35);
  for (const sp of subpaths) {
    const pts = sp.points;
    const n = pts.length / 2;
    const segCount = sp.closed ? n : n - 1;
    for (let i = 0; i < segCount; i++) {
      const a = toPx(pts[i * 2]!, pts[i * 2 + 1]!);
      const j = (i + 1) % n;
      const b = toPx(pts[j * 2]!, pts[j * 2 + 1]!);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const nx = (-dy / len) * hw;
      const ny = (dx / len) * hw;
      const quad = [
        a[0] + nx,
        a[1] + ny,
        b[0] + nx,
        b[1] + ny,
        b[0] - nx,
        b[1] - ny,
        a[0] - nx,
        a[1] - ny,
      ];
      fillSubpaths(data, W, H, [quad], 'nonzero', color, alpha, clip);
    }
  }
}

// ---------------------------------------------------------------------------
// Text (positioned glyph boxes)
// ---------------------------------------------------------------------------

function fillTextBoxes(
  data: Uint8Array,
  W: number,
  H: number,
  item: { text: string; transform: readonly number[]; color: Rgba; alpha: number },
  toPx: (x: number, y: number) => [number, number],
  clip: number[][] | undefined,
): void {
  const m = item.transform;
  // Each character: a box in text space (~0.5 em wide, baseline 0 → 0.62 em tall).
  const boxes: number[][] = [];
  let i = 0;
  for (const ch of item.text) {
    if (ch !== ' ') {
      const x0 = i * 0.5 + 0.05;
      const x1 = i * 0.5 + 0.45;
      const src: [number, number][] = [
        [x0, 0],
        [x1, 0],
        [x1, 0.62],
        [x0, 0.62],
      ];
      const flat: number[] = [];
      for (const [tx, ty] of src) {
        const [ux, uy] = applyToPoint(m as never, tx, ty);
        const [px, py] = toPx(ux, uy);
        flat.push(px, py);
      }
      boxes.push(flat);
    }
    i++;
  }
  if (boxes.length) {
    fillSubpaths(data, W, H, boxes, 'nonzero', item.color, item.alpha * 0.85, clip);
  }
}

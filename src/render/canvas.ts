/**
 * @module render/canvas
 *
 * Replays a {@link DisplayList} onto a `CanvasRenderingContext2D` /
 * `OffscreenCanvasRenderingContext2D`, so a page renders in browsers and
 * Workers using the platform's native graphics — including **high-fidelity
 * text** via `fillText` (the pure-JS {@link module:render/rasterizer} can only
 * approximate text as boxes).
 *
 * @packageDocumentation
 */

import type { DisplayList, Rgba, SubPath } from './displayList.js';
import { applyToPoint, type Matrix } from './matrix.js';
import { interpretPage } from './interpreter.js';
import type { PdfPage } from '../core/pdfPage.js';

/** The subset of the Canvas 2D context API used by the renderer. */
export interface Canvas2DLike {
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(rule?: 'nonzero' | 'evenodd'): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
}

/** Options for Canvas rendering. */
export interface CanvasRenderOptions {
  /** Scale (1 = 72 dpi). Overrides `dpi`. */
  scale?: number | undefined;
  /** Target dpi (72 = scale 1). */
  dpi?: number | undefined;
  /** `devicePixelRatio` to multiply into the scale (browser HiDPI). Default 1. */
  pixelRatio?: number | undefined;
  /** Font family for text runs. Default `sans-serif`. */
  fontFamily?: string | undefined;
}

function effectiveScale(opts: CanvasRenderOptions): number {
  const base = typeof opts.scale === 'number' ? opts.scale : typeof opts.dpi === 'number' ? opts.dpi / 72 : 1;
  return base * (opts.pixelRatio ?? 1);
}

function rgbaStr(c: Rgba, alpha: number): string {
  const a = (c[3] / 255) * alpha;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Number(a.toFixed(3))})`;
}

/** Replay a display list onto a 2D context. */
export function renderDisplayListToCanvas(
  dl: DisplayList,
  ctx: Canvas2DLike,
  opts: CanvasRenderOptions = {},
): void {
  const scale = effectiveScale(opts);
  const H = dl.height * scale;
  const [ox, oy] = dl.origin;
  const toPx = (x: number, y: number): [number, number] => [(x - ox) * scale, H - (y - oy) * scale];
  const family = opts.fontFamily ?? 'sans-serif';

  for (const item of dl.items) {
    if (item.type === 'fill') {
      ctx.fillStyle = rgbaStr(item.color, item.alpha);
      ctx.beginPath();
      tracePath(ctx, item.subpaths, toPx);
      ctx.fill(item.rule);
    } else if (item.type === 'stroke') {
      ctx.strokeStyle = rgbaStr(item.color, item.alpha);
      ctx.lineWidth = Math.max(item.lineWidth * scale, 0.5);
      ctx.beginPath();
      tracePath(ctx, item.subpaths, toPx);
      ctx.stroke();
    } else if (item.type === 'text' && item.renderMode !== 3 && item.renderMode !== 7) {
      const m = item.transform as Matrix;
      const [px, py] = toPx(...applyToPoint(m, 0, 0));
      // Effective on-screen font size = fontSize × CTM scale × render scale.
      const sizePx = Math.hypot(m[2], m[3]) * scale;
      if (sizePx >= 0.5 && item.text.length) {
        ctx.fillStyle = rgbaStr(item.color, item.alpha);
        ctx.font = `${Number(sizePx.toFixed(2))}px ${family}`;
        ctx.fillText(item.text, px, py);
      }
    }
    // image items: callers can composite via extractImages + drawImage.
  }
}

function tracePath(
  ctx: Canvas2DLike,
  subpaths: readonly SubPath[],
  toPx: (x: number, y: number) => [number, number],
): void {
  for (const sp of subpaths) {
    const pts = sp.points;
    if (pts.length < 4) continue;
    const [x0, y0] = toPx(pts[0]!, pts[1]!);
    ctx.moveTo(x0, y0);
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const [x, y] = toPx(pts[i]!, pts[i + 1]!);
      ctx.lineTo(x, y);
    }
    if (sp.closed) ctx.closePath();
  }
}

/**
 * Render a {@link PdfPage} onto a 2D context. The context's canvas should be
 * sized to `page.width × scale` by `page.height × scale`.
 */
export function renderPageToCanvas(page: PdfPage, ctx: Canvas2DLike, opts: CanvasRenderOptions = {}): void {
  renderDisplayListToCanvas(interpretPage(page), ctx, opts);
}

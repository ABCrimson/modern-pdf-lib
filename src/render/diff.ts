/**
 * @module render/diff
 *
 * Visual regression for PDFs: rasterize two pages (or compare two raster
 * images) and report a per-pixel difference count, a difference heatmap, and a
 * structural-similarity (SSIM) score over 8×8 luminance blocks.
 *
 * @packageDocumentation
 */

import { rasterize, type RasterImage, type RenderOptions } from './rasterizer.js';
import { interpretPage } from './interpreter.js';
import type { PdfPage } from '../core/pdfPage.js';

/** Result of a visual comparison. */
export interface DiffResult {
  readonly width: number;
  readonly height: number;
  /** Number of pixels whose max channel difference exceeds the threshold. */
  readonly changedPixels: number;
  /** `changedPixels / (width·height)`. */
  readonly changedRatio: number;
  /** Mean structural similarity over 8×8 luminance blocks, `0–1` (1 = identical). */
  readonly ssim: number;
  /** RGBA heatmap: changed pixels in red over a dimmed grayscale of image A. */
  readonly heatmap: Uint8Array;
}

/** Options for {@link compareImages}. */
export interface CompareOptions {
  /** Per-channel difference (0–255) above which a pixel counts as changed. Default 16. */
  threshold?: number | undefined;
}

const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

function luma(data: Uint8Array, i: number): number {
  return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
}

/** Compare two equally-sized raster images. */
export function compareImages(a: RasterImage, b: RasterImage, opts: CompareOptions = {}): DiffResult {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `compareImages: size mismatch (${a.width}×${a.height} vs ${b.width}×${b.height}); render both at the same scale`,
    );
  }
  const W = a.width;
  const H = a.height;
  const threshold = opts.threshold ?? 16;
  const heatmap = new Uint8Array(W * H * 4);

  let changed = 0;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const dr = Math.abs(a.data[i]! - b.data[i]!);
    const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!);
    const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!);
    const maxd = Math.max(dr, dg, db);
    if (maxd > threshold) {
      changed++;
      heatmap[i] = 255;
      heatmap[i + 1] = 40;
      heatmap[i + 2] = 40;
      heatmap[i + 3] = 255;
    } else {
      const g = Math.round(luma(a.data, i) * 0.4 + 153); // dimmed background
      heatmap[i] = g;
      heatmap[i + 1] = g;
      heatmap[i + 2] = g;
      heatmap[i + 3] = 255;
    }
  }

  return {
    width: W,
    height: H,
    changedPixels: changed,
    changedRatio: changed / (W * H),
    ssim: meanSsim(a, b, W, H),
    heatmap,
  };
}

/** Mean SSIM over non-overlapping 8×8 luminance blocks. */
function meanSsim(a: RasterImage, b: RasterImage, W: number, H: number): number {
  const block = 8;
  let total = 0;
  let count = 0;
  for (let by = 0; by < H; by += block) {
    for (let bx = 0; bx < W; bx += block) {
      const bw = Math.min(block, W - bx);
      const bh = Math.min(block, H - by);
      const n = bw * bh;
      let sa = 0;
      let sb = 0;
      let saa = 0;
      let sbb = 0;
      let sab = 0;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((by + y) * W + (bx + x)) * 4;
          const la = luma(a.data, i);
          const lb = luma(b.data, i);
          sa += la;
          sb += lb;
          saa += la * la;
          sbb += lb * lb;
          sab += la * lb;
        }
      }
      const ma = sa / n;
      const mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;
      const ssim = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      total += ssim;
      count++;
    }
  }
  return count ? total / count : 1;
}

/** Rasterize two pages at the same scale and compare them. */
export async function comparePages(
  pageA: PdfPage,
  pageB: PdfPage,
  opts: RenderOptions & CompareOptions = {},
): Promise<DiffResult> {
  const a = rasterize(interpretPage(pageA), opts);
  const b = rasterize(interpretPage(pageB), opts);
  return compareImages(a, b, opts);
}

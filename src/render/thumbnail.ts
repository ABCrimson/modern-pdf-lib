/**
 * @module render/thumbnail
 *
 * Generate a small preview PNG of a page by rasterizing it at a scale that fits
 * the longest side to a target size. (Persisting a `/Thumb` image XObject on the
 * page — ISO 32000-2 §12.3.4 — requires page-dictionary write access not yet on
 * the public {@link PdfPage} API; tracked for a later patch.)
 *
 * @packageDocumentation
 */

import { rasterize, type RenderOptions } from './rasterizer.js';
import { interpretPage } from './interpreter.js';
import { encodePngFromPixels } from '../assets/image/webpOptimize.js';
import type { PdfPage } from '../core/pdfPage.js';

/** Options for {@link generateThumbnail}. */
export interface ThumbnailOptions {
  /** Longest-side length in pixels. Default 256. */
  maxSize?: number | undefined;
  /** Background fill (defaults to white via the rasterizer). */
  background?: RenderOptions['background'];
  /** Render text runs (as boxes). Default true. */
  renderText?: boolean | undefined;
}

/**
 * Render `page` to a thumbnail PNG whose longest side is `maxSize` pixels,
 * preserving aspect ratio.
 */
export async function generateThumbnail(
  page: PdfPage,
  opts: ThumbnailOptions = {},
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const maxSize = opts.maxSize ?? 256;
  const dl = interpretPage(page);
  const longest = Math.max(dl.width, dl.height) || 1;
  const scale = maxSize / longest;
  const img = rasterize(dl, {
    scale,
    background: opts.background,
    renderText: opts.renderText ?? true,
  });
  const png = encodePngFromPixels(img.data, img.width, img.height, 4);
  return { data: png, width: img.width, height: img.height };
}

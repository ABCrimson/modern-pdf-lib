/**
 * @module render/ocr
 *
 * Pluggable OCR hook for image-only (scanned) PDFs.
 *
 * {@link applyOcr} rasterizes a page to an RGBA bitmap, hands it to a
 * caller-supplied {@link OcrEngine} (Tesseract, a cloud OCR service, a WASM
 * model, …), and writes the recognized words back onto the page as an
 * **invisible text layer**.  The text is positioned over the corresponding
 * glyphs and rendered with text-rendering mode `3` (neither fill nor stroke),
 * so it is fully selectable and searchable yet never painted — the visual
 * appearance of the scan is untouched.
 *
 * The engine boundary is deliberately tiny so that any OCR backend can be
 * adapted with a thin wrapper:
 *
 * ```ts
 * import { applyOcr, type OcrEngine } from 'modern-pdf-lib';
 *
 * const tesseract: OcrEngine = {
 *   async recognize(rgba, width, height) {
 *     const { words } = await runTesseract(rgba, width, height);
 *     return words.map((w) => ({
 *       text: w.text,
 *       x: w.bbox.x0,
 *       // OCR boxes are usually y-down from the top; convert to PDF y-up:
 *       y: height - w.bbox.y1,
 *       width: w.bbox.x1 - w.bbox.x0,
 *       height: w.bbox.y1 - w.bbox.y0,
 *     }));
 *   },
 * };
 *
 * const doc = await loadPdf(scannedBytes);
 * await applyOcr(doc.getPage(0), tesseract);
 * ```
 *
 * @packageDocumentation
 */

import type { PdfPage } from '../core/pdfPage.js';
import { PdfDict, PdfName } from '../core/pdfObjects.js';
import { rasterize } from './rasterizer.js';
import { interpretPage } from './interpreter.js';

/**
 * A single recognized word with its bounding box in **page space**.
 *
 * Coordinates follow the PDF convention: the origin is the lower-left corner
 * of the page and the y-axis points up.  `x`/`y` are the lower-left corner of
 * the word box; `width`/`height` are its extent in page units (points).
 */
export interface OcrWord {
  /** The recognized text of the word. */
  text: string;
  /** X coordinate of the word box's lower-left corner, in page units. */
  x: number;
  /** Y coordinate of the word box's lower-left corner (y-up), in page units. */
  y: number;
  /** Width of the word box, in page units. */
  width: number;
  /** Height of the word box, in page units. */
  height: number;
}

/**
 * A pluggable OCR backend.
 *
 * Implementations receive an interleaved 8-bit RGBA bitmap of the rasterized
 * page (row-major, top-to-bottom, `width * height * 4` bytes) and return the
 * recognized words with **page-space** bounding boxes (see {@link OcrWord}).
 */
export interface OcrEngine {
  /**
   * Recognize text in a rasterized page.
   *
   * @param rgba    Interleaved RGBA8888 pixels (`width * height * 4` bytes).
   * @param width   Bitmap width in pixels.
   * @param height  Bitmap height in pixels.
   * @returns       The recognized words, with page-space boxes.
   */
  recognize(rgba: Uint8Array, width: number, height: number): Promise<OcrWord[]>;
}

/** Options controlling {@link applyOcr}. */
export interface ApplyOcrOptions {
  /**
   * Rasterization resolution handed to the engine, in dots per inch.
   * Higher values give the OCR engine more detail at the cost of memory.
   * Default: `150`.
   */
  dpi?: number | undefined;
  /**
   * Resource name to use for the invisible overlay font.  A standard
   * Helvetica Type 1 font is embedded under this name if it is not already
   * present.  Default: `'OCRFont'`.
   */
  fontResourceName?: string | undefined;
}

/**
 * Escape a string for use inside a PDF literal string `(…)`.
 * Backslash and both parentheses must be escaped so the content stream
 * remains well-formed.
 */
function escapePdfLiteral(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

/**
 * Format a number for PDF output: at most 4 decimal places, trailing zeros
 * stripped, never `-0`.
 */
function num(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Build a standard Helvetica (Type 1) font dictionary, register it in the
 * page's object registry, and attach it to the page under `resourceName`.
 *
 * This lets {@link applyOcr} guarantee a usable font resource exists for the
 * invisible overlay without needing a reference to the owning document.
 */
function ensureOverlayFont(page: PdfPage, resourceName: string): void {
  const registry = page.getRegistry();
  const fontDict = new PdfDict();
  fontDict.set('/Type', PdfName.of('Font'));
  fontDict.set('/Subtype', PdfName.of('Type1'));
  fontDict.set('/BaseFont', PdfName.of('Helvetica'));
  fontDict.set('/Encoding', PdfName.of('WinAnsiEncoding'));
  const ref = registry.register(fontDict);
  page.registerFont(resourceName, ref);
}

/**
 * Run OCR on a page and append the recognized text as an invisible,
 * selectable/searchable overlay.
 *
 * The page is rasterized to RGBA at `opts.dpi`, passed to `engine.recognize`,
 * and each returned word is written back as a content-stream fragment:
 *
 * ```text
 * BT 3 Tr /<font> <size> Tf <x> <y> Td (<escaped text>) Tj ET
 * ```
 *
 * where `<size> ≈ word.height` and `<x> <y>` is the word's lower-left corner
 * in page space.  Render mode `3` makes the text invisible (no fill, no
 * stroke) while keeping it part of the document's text content.
 *
 * @param page    The page to OCR and annotate.
 * @param engine  The OCR backend.
 * @param opts    Optional DPI and font-resource overrides.
 * @returns       The words returned by the engine (unmodified).
 */
export async function applyOcr(
  page: PdfPage,
  engine: OcrEngine,
  opts?: ApplyOcrOptions,
): Promise<OcrWord[]> {
  const dpi = opts?.dpi ?? 150;
  const fontName = opts?.fontResourceName ?? 'OCRFont';

  // 1. Rasterize the page to an RGBA bitmap for the engine.
  const raster = rasterize(interpretPage(page), { dpi });

  // 2. Hand the pixels to the OCR backend.
  const words = await engine.recognize(raster.data, raster.width, raster.height);

  // Nothing recognized — leave the page untouched.
  if (words.length === 0) return words;

  // 3. Make sure a font resource exists for the invisible overlay.
  ensureOverlayFont(page, fontName);

  // 4. Emit one invisible text run per word.
  let fragment = '';
  for (const word of words) {
    // Font size approximates the word's height so the (invisible) glyph metrics
    // roughly track the underlying scanned text.
    const size = word.height > 0 ? word.height : 1;
    const escaped = escapePdfLiteral(word.text);
    fragment +=
      `BT 3 Tr /${fontName} ${num(size)} Tf ` +
      `${num(word.x)} ${num(word.y)} Td (${escaped}) Tj ET\n`;
  }
  page.pushOperators(fragment);

  return words;
}

/**
 * @module core/watermark
 *
 * Add text watermarks to PDF pages.
 *
 * A watermark is rendered as semi-transparent text drawn at an angle
 * across the page.  It is added to the page's content stream as a
 * regular graphics operation (not as a separate layer, though it
 * could be combined with optional content groups).
 */

import type { PdfDocument } from './pdfDocument.js';
import type { PdfPage } from './pdfPage.js';
import type { PdfObjectRegistry } from './pdfObjects.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
} from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for watermark rendering. */
export interface WatermarkOptions {
  /** The watermark text. */
  text: string;
  /** Font size in points (default: 60). */
  fontSize?: number | undefined;
  /** Text colour as RGB (0-1 range, default: light gray). */
  color?: { r: number; g: number; b: number } | undefined;
  /** Opacity from 0 (invisible) to 1 (opaque), default: 0.3. */
  opacity?: number | undefined;
  /** Rotation angle in degrees (default: 45). */
  rotation?: number | undefined;
  /** Position: `'center'`, `'top'`, or `'bottom'` (default: `'center'`). */
  position?: 'center' | 'top' | 'bottom' | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Add a watermark to a single page.
 *
 * The watermark is drawn using the Helvetica standard font (no
 * embedding required).  The text is rendered with the specified
 * rotation, opacity, and colour.
 *
 * @param page      The page to watermark.
 * @param options   Watermark options.
 * @param registry  The PDF object registry (for ExtGState).
 */
export function addWatermarkToPage(
  page: PdfPage,
  options: WatermarkOptions,
  registry: PdfObjectRegistry,
): void {
  const text = options.text;
  const fontSize = options.fontSize ?? 60;
  const color = options.color ?? { r: 0.7, g: 0.7, b: 0.7 };
  const opacity = options.opacity ?? 0.3;
  const rotationDeg = options.rotation ?? 45;
  const position = options.position ?? 'center';

  const w = page.width;
  const h = page.height;

  // Calculate position
  let cx: number;
  let cy: number;

  switch (position) {
    case 'top':
      cx = w / 2;
      cy = h - h / 4;
      break;
    case 'bottom':
      cx = w / 2;
      cy = h / 4;
      break;
    case 'center':
    default:
      cx = w / 2;
      cy = h / 2;
      break;
  }

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Estimate text width (rough: 0.5 * fontSize per character for Helvetica)
  const textWidth = text.length * fontSize * 0.5;
  const offsetX = -textWidth / 2;
  const offsetY = -fontSize / 3;

  let ops = '';

  // Save graphics state
  ops += 'q\n';

  // Set opacity via ExtGState if less than 1
  if (opacity < 1) {
    const gsDict = new PdfDict();
    gsDict.set('/Type', PdfName.of('ExtGState'));
    gsDict.set('/ca', PdfNumber.of(opacity));
    gsDict.set('/CA', PdfNumber.of(opacity));
    const gsRef = registry.register(gsDict);

    // We need a unique GS name
    const gsName = `WM_GS`;
    page.registerExtGState(gsName, gsRef);
    ops += `/WM_GS gs\n`;
  }

  // Set fill colour
  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} rg\n`;

  // Begin text
  ops += 'BT\n';

  // Font (Helvetica is always available as a standard font)
  ops += `/Helvetica ${n(fontSize)} Tf\n`;

  // Text matrix: rotate around (cx, cy)
  // Tm = translate(cx, cy) * rotate(deg) * translate(offsetX, offsetY)
  const a = cos;
  const b = sin;
  const c = -sin;
  const d = cos;
  const tx = cx + cos * offsetX - sin * offsetY;
  const ty = cy + sin * offsetX + cos * offsetY;

  ops += `${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(tx)} ${n(ty)} Tm\n`;

  // Escape text for PDF string
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  ops += `(${escaped}) Tj\n`;
  ops += 'ET\n';

  // Restore graphics state
  ops += 'Q\n';

  page.pushOperators(ops);
}

/**
 * Add a watermark to all pages in a document.
 *
 * @param doc      The PDF document.
 * @param options  Watermark options.
 */
export function addWatermark(doc: PdfDocument, options: WatermarkOptions): void {
  const registry = doc.getRegistry();
  const pages = doc.getPages();

  // Register Helvetica font in the registry for watermark use
  const fontDict = new PdfDict();
  fontDict.set('/Type', PdfName.of('Font'));
  fontDict.set('/Subtype', PdfName.of('Type1'));
  fontDict.set('/BaseFont', PdfName.of('Helvetica'));
  fontDict.set('/Encoding', PdfName.of('WinAnsiEncoding'));
  const fontRef = registry.register(fontDict);

  for (const page of pages) {
    // Register the watermark font on each page
    page.registerFont('Helvetica', fontRef);
    addWatermarkToPage(page, options, registry);
  }
}

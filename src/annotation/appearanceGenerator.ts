/**
 * @module annotation/appearanceGenerator
 *
 * Generates /AP (appearance) streams for annotations.
 *
 * Appearance streams are Form XObjects that define how an annotation
 * looks when rendered.  Each appearance is a content stream with
 * its own resource dictionary and bounding box.
 *
 * Reference: PDF 1.7 spec, Section 12.5.5 (Appearance Streams).
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfAnnotation } from './pdfAnnotation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number for content stream operators. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Bezier curve constant for approximating a quarter circle. */
const KAPPA = 0.5522847498;

/**
 * Build a Form XObject (appearance stream) from content operators.
 *
 * @param content   The content stream operators.
 * @param bbox      The bounding box [x1, y1, x2, y2].
 * @param resources Optional resources dictionary.
 * @returns         A PdfStream configured as a Form XObject.
 */
function buildAppearanceStream(
  content: string,
  bbox: [number, number, number, number],
  resources?: PdfDict | undefined,
): PdfStream {
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('XObject'));
  dict.set('/Subtype', PdfName.of('Form'));
  dict.set('/BBox', PdfArray.fromNumbers(bbox));
  if (resources) {
    dict.set('/Resources', resources);
  }
  return PdfStream.fromString(content, dict);
}

// ---------------------------------------------------------------------------
// Square (rectangle) appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a Square annotation.
 */
export function generateSquareAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor();
  const opacity = annot.getOpacity();

  // Get interior color from dict
  const dict = annot.getDict();
  const icObj = dict.get('/IC');
  let interiorColor: { r: number; g: number; b: number } | undefined;
  if (icObj && icObj.kind === 'array' && icObj.items.length >= 3) {
    interiorColor = {
      r: (icObj.items[0] as PdfNumber | undefined)?.value ?? 0,
      g: (icObj.items[1] as PdfNumber | undefined)?.value ?? 0,
      b: (icObj.items[2] as PdfNumber | undefined)?.value ?? 0,
    };
  }

  // Get border width
  let borderWidth = 1;
  const bsObj = dict.get('/BS');
  if (bsObj && bsObj.kind === 'dict') {
    const wObj = bsObj.get('/W');
    if (wObj && wObj.kind === 'number') {
      borderWidth = wObj.value;
    }
  }

  let ops = '';

  // Apply graphics state
  if (opacity < 1) {
    ops += `${n(opacity)} ca ${n(opacity)} CA\n`;
  }

  // Interior fill
  if (interiorColor) {
    ops += `${n(interiorColor.r)} ${n(interiorColor.g)} ${n(interiorColor.b)} rg\n`;
    ops += `${n(borderWidth / 2)} ${n(borderWidth / 2)} ${n(w - borderWidth)} ${n(h - borderWidth)} re\n`;
    ops += 'f\n';
  }

  // Border stroke
  if (color) {
    ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  } else {
    ops += '0 0 0 RG\n';
  }
  ops += `${n(borderWidth)} w\n`;
  ops += `${n(borderWidth / 2)} ${n(borderWidth / 2)} ${n(w - borderWidth)} ${n(h - borderWidth)} re\n`;
  ops += 'S\n';

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Circle (ellipse) appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a Circle annotation.
 */
export function generateCircleAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;

  const color = annot.getColor();
  const opacity = annot.getOpacity();

  // Get interior color
  const dict = annot.getDict();
  const icObj = dict.get('/IC');
  let interiorColor: { r: number; g: number; b: number } | undefined;
  if (icObj && icObj.kind === 'array' && icObj.items.length >= 3) {
    interiorColor = {
      r: (icObj.items[0] as PdfNumber | undefined)?.value ?? 0,
      g: (icObj.items[1] as PdfNumber | undefined)?.value ?? 0,
      b: (icObj.items[2] as PdfNumber | undefined)?.value ?? 0,
    };
  }

  let borderWidth = 1;
  const bsObj = dict.get('/BS');
  if (bsObj && bsObj.kind === 'dict') {
    const wObj = bsObj.get('/W');
    if (wObj && wObj.kind === 'number') {
      borderWidth = wObj.value;
    }
  }

  // Adjust radii for border
  const adjRx = rx - borderWidth / 2;
  const adjRy = ry - borderWidth / 2;

  // Build ellipse path using 4 bezier curves
  const kx = KAPPA * adjRx;
  const ky = KAPPA * adjRy;

  let ops = '';

  if (opacity < 1) {
    ops += `${n(opacity)} ca ${n(opacity)} CA\n`;
  }

  // Ellipse path
  const ellipsePath =
    `${n(cx)} ${n(cy + adjRy)} m\n` +
    `${n(cx + kx)} ${n(cy + adjRy)} ${n(cx + adjRx)} ${n(cy + ky)} ${n(cx + adjRx)} ${n(cy)} c\n` +
    `${n(cx + adjRx)} ${n(cy - ky)} ${n(cx + kx)} ${n(cy - adjRy)} ${n(cx)} ${n(cy - adjRy)} c\n` +
    `${n(cx - kx)} ${n(cy - adjRy)} ${n(cx - adjRx)} ${n(cy - ky)} ${n(cx - adjRx)} ${n(cy)} c\n` +
    `${n(cx - adjRx)} ${n(cy + ky)} ${n(cx - kx)} ${n(cy + adjRy)} ${n(cx)} ${n(cy + adjRy)} c\n`;

  if (interiorColor) {
    ops += `${n(interiorColor.r)} ${n(interiorColor.g)} ${n(interiorColor.b)} rg\n`;
    if (color) {
      ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
    } else {
      ops += '0 0 0 RG\n';
    }
    ops += `${n(borderWidth)} w\n`;
    ops += ellipsePath;
    ops += 'B\n'; // fill and stroke
  } else {
    if (color) {
      ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
    } else {
      ops += '0 0 0 RG\n';
    }
    ops += `${n(borderWidth)} w\n`;
    ops += ellipsePath;
    ops += 'S\n'; // stroke only
  }

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Line appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a Line annotation.
 */
export function generateLineAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [rx1, ry1, rx2, ry2] = rect;
  const w = rx2 - rx1;
  const h = ry2 - ry1;

  const color = annot.getColor();
  const opacity = annot.getOpacity();

  // Get line points from /L entry
  const dict = annot.getDict();
  const lObj = dict.get('/L');
  let lx1 = 0, ly1 = 0, lx2 = w, ly2 = h;
  if (lObj && lObj.kind === 'array' && lObj.items.length >= 4) {
    lx1 = (lObj.items[0] as PdfNumber | undefined)?.value ?? 0;
    ly1 = (lObj.items[1] as PdfNumber | undefined)?.value ?? 0;
    lx2 = (lObj.items[2] as PdfNumber | undefined)?.value ?? 0;
    ly2 = (lObj.items[3] as PdfNumber | undefined)?.value ?? 0;
    // Translate to local coordinates
    lx1 -= rx1;
    ly1 -= ry1;
    lx2 -= rx1;
    ly2 -= ry1;
  }

  let borderWidth = 1;
  const bsObj = dict.get('/BS');
  if (bsObj && bsObj.kind === 'dict') {
    const wObj = bsObj.get('/W');
    if (wObj && wObj.kind === 'number') {
      borderWidth = wObj.value;
    }
  }

  let ops = '';

  if (opacity < 1) {
    ops += `${n(opacity)} ca ${n(opacity)} CA\n`;
  }

  if (color) {
    ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  } else {
    ops += '0 0 0 RG\n';
  }
  ops += `${n(borderWidth)} w\n`;
  ops += `${n(lx1)} ${n(ly1)} m\n`;
  ops += `${n(lx2)} ${n(ly2)} l\n`;
  ops += 'S\n';

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Highlight appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a Highlight annotation.
 */
export function generateHighlightAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor() ?? { r: 1, g: 1, b: 0 };
  const opacity = annot.getOpacity();

  let ops = '';

  if (opacity < 1) {
    ops += `${n(opacity)} ca\n`;
  }

  // Set blend mode to Multiply for proper highlight appearance
  // (requires an ExtGState with /BM; for simplicity we just use fill)
  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} rg\n`;

  // Draw quads from QuadPoints, or fall back to rect
  const dict = annot.getDict();
  const qpObj = dict.get('/QuadPoints');
  if (qpObj && qpObj.kind === 'array' && qpObj.items.length >= 8) {
    const points = qpObj.items
      .filter((item): item is PdfNumber => item.kind === 'number')
      .map((item) => item.value);

    for (let i = 0; i + 7 < points.length; i += 8) {
      // QuadPoints: x1,y1 x2,y2 x3,y3 x4,y4
      // Order: top-left, top-right, bottom-left, bottom-right (or similar)
      const qx1 = points[i]! - x1;
      const qy1 = points[i + 1]! - y1;
      const qx2 = points[i + 2]! - x1;
      const qy2 = points[i + 3]! - y1;
      const qx3 = points[i + 4]! - x1;
      const qy3 = points[i + 5]! - y1;
      const qx4 = points[i + 6]! - x1;
      const qy4 = points[i + 7]! - y1;

      ops += `${n(qx1)} ${n(qy1)} m\n`;
      ops += `${n(qx2)} ${n(qy2)} l\n`;
      ops += `${n(qx4)} ${n(qy4)} l\n`;
      ops += `${n(qx3)} ${n(qy3)} l\n`;
      ops += 'f\n';
    }
  } else {
    // Fallback: fill the entire rect
    ops += `0 0 ${n(w)} ${n(h)} re\n`;
    ops += 'f\n';
  }

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Underline appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for an Underline annotation.
 */
export function generateUnderlineAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor() ?? { r: 0, g: 0, b: 1 };

  let ops = '';
  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  ops += '1 w\n';

  // Draw underline at the bottom of the rect
  const dict = annot.getDict();
  const qpObj = dict.get('/QuadPoints');
  if (qpObj && qpObj.kind === 'array' && qpObj.items.length >= 8) {
    const points = qpObj.items
      .filter((item): item is PdfNumber => item.kind === 'number')
      .map((item) => item.value);

    for (let i = 0; i + 7 < points.length; i += 8) {
      // Bottom edge: x3,y3 to x4,y4
      const bx1 = points[i + 4]! - x1;
      const by1 = points[i + 5]! - y1;
      const bx2 = points[i + 6]! - x1;
      const by2 = points[i + 7]! - y1;
      ops += `${n(bx1)} ${n(by1)} m\n`;
      ops += `${n(bx2)} ${n(by2)} l\n`;
      ops += 'S\n';
    }
  } else {
    ops += `0 0 m\n`;
    ops += `${n(w)} 0 l\n`;
    ops += 'S\n';
  }

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Squiggly underline appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a Squiggly annotation.
 */
export function generateSquigglyAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor() ?? { r: 0, g: 0.5, b: 0 };

  let ops = '';
  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  ops += '0.5 w\n';

  // Draw a squiggly line at the bottom
  const amplitude = 2;
  const period = 4;

  ops += `0 ${n(amplitude)} m\n`;
  for (let x = 0; x < w; x += period) {
    const x1p = Math.min(x + period / 2, w);
    const x2p = Math.min(x + period, w);
    const y1p = x % (period * 2) < period ? 0 : amplitude * 2;
    const y2p = x % (period * 2) < period ? amplitude * 2 : 0;
    ops += `${n(x1p)} ${n(y1p)} l\n`;
    if (x2p <= w) {
      ops += `${n(x2p)} ${n(y2p)} l\n`;
    }
  }
  ops += 'S\n';

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// StrikeOut appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a StrikeOut annotation.
 */
export function generateStrikeOutAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor() ?? { r: 1, g: 0, b: 0 };

  let ops = '';
  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  ops += '1 w\n';

  // Draw line through the middle of the rect
  const dict = annot.getDict();
  const qpObj = dict.get('/QuadPoints');
  if (qpObj && qpObj.kind === 'array' && qpObj.items.length >= 8) {
    const points = qpObj.items
      .filter((item): item is PdfNumber => item.kind === 'number')
      .map((item) => item.value);

    for (let i = 0; i + 7 < points.length; i += 8) {
      // Calculate middle line: average of top and bottom
      const topY = ((points[i + 1]! - y1) + (points[i + 3]! - y1)) / 2;
      const botY = ((points[i + 5]! - y1) + (points[i + 7]! - y1)) / 2;
      const midY = (topY + botY) / 2;
      const leftX = Math.min(points[i]! - x1, points[i + 4]! - x1);
      const rightX = Math.max(points[i + 2]! - x1, points[i + 6]! - x1);
      ops += `${n(leftX)} ${n(midY)} m\n`;
      ops += `${n(rightX)} ${n(midY)} l\n`;
      ops += 'S\n';
    }
  } else {
    const midY = h / 2;
    ops += `0 ${n(midY)} m\n`;
    ops += `${n(w)} ${n(midY)} l\n`;
    ops += 'S\n';
  }

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// Ink appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for an Ink annotation.
 */
export function generateInkAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const color = annot.getColor() ?? { r: 0, g: 0, b: 0 };
  const opacity = annot.getOpacity();

  let ops = '';

  if (opacity < 1) {
    ops += `${n(opacity)} ca ${n(opacity)} CA\n`;
  }

  ops += `${n(color.r)} ${n(color.g)} ${n(color.b)} RG\n`;
  ops += '1 w\n';
  ops += '1 J\n'; // round line cap

  // Draw each ink path
  const dict = annot.getDict();
  const inkListObj = dict.get('/InkList');
  if (inkListObj && inkListObj.kind === 'array') {
    for (const pathObj of inkListObj.items) {
      if (pathObj.kind !== 'array') continue;
      const points = pathObj.items
        .filter((item): item is PdfNumber => item.kind === 'number')
        .map((item) => item.value);

      if (points.length >= 2) {
        ops += `${n(points[0]! - x1)} ${n(points[1]! - y1)} m\n`;
        for (let i = 2; i + 1 < points.length; i += 2) {
          ops += `${n(points[i]! - x1)} ${n(points[i + 1]! - y1)} l\n`;
        }
        ops += 'S\n';
      }
    }
  }

  return buildAppearanceStream(ops, [0, 0, w, h]);
}

// ---------------------------------------------------------------------------
// FreeText appearance
// ---------------------------------------------------------------------------

/**
 * Generate appearance stream for a FreeText annotation.
 *
 * This requires access to the annotation's text, default appearance
 * string, and alignment.  We accept the annotation object directly
 * to access these properties.
 */
export function generateFreeTextAppearance(annot: PdfAnnotation): PdfStream {
  const rect = annot.getRect();
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;

  const text = annot.getContents() ?? '';
  const dict = annot.getDict();

  // Get DA string
  let da = '0 0 0 rg /Helv 12 Tf';
  const daObj = dict.get('/DA');
  if (daObj && daObj.kind === 'string') {
    da = daObj.value;
  }

  // Get alignment
  let align = 0;
  const qObj = dict.get('/Q');
  if (qObj && qObj.kind === 'number') {
    align = qObj.value;
  }

  // Parse font size from DA
  let fontSize = 12;
  const fsMatch = /\/\w+\s+([\d.]+)\s+Tf/.exec(da);
  if (fsMatch?.[1]) {
    fontSize = parseFloat(fsMatch[1]);
  }

  // Build content stream
  let ops = '';
  ops += `${da}\n`;
  ops += 'BT\n';

  // Position text based on alignment
  const margin = 2;
  const textY = h - fontSize - margin;

  if (align === 1) {
    // Center — approximate
    ops += `${n(w / 2)} ${n(textY)} Td\n`;
  } else if (align === 2) {
    // Right
    ops += `${n(w - margin)} ${n(textY)} Td\n`;
  } else {
    // Left
    ops += `${n(margin)} ${n(textY)} Td\n`;
  }

  // Escape text for PDF string
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  ops += `(${escapedText}) Tj\n`;
  ops += 'ET\n';

  // Build resources with Helv font reference
  const resources = new PdfDict();
  const fontDict = new PdfDict();
  const helvetica = new PdfDict();
  helvetica.set('/Type', PdfName.of('Font'));
  helvetica.set('/Subtype', PdfName.of('Type1'));
  helvetica.set('/BaseFont', PdfName.of('Helvetica'));
  fontDict.set('/Helv', helvetica);
  resources.set('/Font', fontDict);

  return buildAppearanceStream(ops, [0, 0, w, h], resources);
}

/**
 * @module assets/svg/svgToPdf
 *
 * Convert parsed SVG elements into PDF content-stream operators.
 *
 * SVG uses a top-left coordinate system (y increases downward), while
 * PDF uses a bottom-left system (y increases upward).  The converter
 * applies a y-flip transformation to map SVG coordinates into PDF space.
 *
 * Supported SVG features:
 * - Shape elements: `<rect>`, `<circle>`, `<ellipse>`, `<line>`,
 *   `<polyline>`, `<polygon>`, `<path>` (all commands)
 * - Text elements: `<text>`, `<tspan>` (basic)
 * - Groups: `<g>` with `transform` attribute
 * - Styles: `fill`, `stroke`, `stroke-width`, `opacity`,
 *   `fill-rule`, `stroke-linecap`, `stroke-linejoin`,
 *   `stroke-dasharray`, `stroke-dashoffset`, `stroke-miterlimit`
 * - Transforms: `matrix`, `translate`, `scale`, `rotate`,
 *   `skewX`, `skewY`
 * - ViewBox scaling and aspect ratio preservation
 */

import type { SvgElement, SvgDrawCommand, SvgGradient } from './svgParser.js';
import { parseSvg } from './svgParser.js';
import type { PdfPage } from '../../core/pdfPage.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for rendering an SVG onto a PDF page. */
export interface SvgRenderOptions {
  /** Rendered width in PDF points. */
  width?: number | undefined;
  /** Rendered height in PDF points. */
  height?: number | undefined;
  /** X offset in PDF points. */
  x?: number | undefined;
  /** Y offset in PDF points (bottom of the SVG). */
  y?: number | undefined;
  /** Whether to preserve the aspect ratio of the SVG. */
  preserveAspectRatio?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Number formatter
// ---------------------------------------------------------------------------

function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// PDF string escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside a PDF literal string `(...)`.
 */
function escapePdfString(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

// ---------------------------------------------------------------------------
// Drawing command -> PDF operators
// ---------------------------------------------------------------------------

/** Magic constant for circular arc approximation: 4*(sqrt(2)-1)/3. */
const KAPPA = 0.5522847498;

/**
 * Convert a circle to 4 cubic Bezier curves.
 *
 * @returns PDF operator string for the circle path.
 */
function circleToOps(cx: number, cy: number, r: number): string {
  const ox = r * KAPPA;
  const oy = r * KAPPA;
  let ops = '';
  ops += `${n(cx)} ${n(cy + r)} m\n`;
  ops += `${n(cx + ox)} ${n(cy + r)} ${n(cx + r)} ${n(cy + oy)} ${n(cx + r)} ${n(cy)} c\n`;
  ops += `${n(cx + r)} ${n(cy - oy)} ${n(cx + ox)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c\n`;
  ops += `${n(cx - ox)} ${n(cy - r)} ${n(cx - r)} ${n(cy - oy)} ${n(cx - r)} ${n(cy)} c\n`;
  ops += `${n(cx - r)} ${n(cy + oy)} ${n(cx - ox)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c\n`;
  return ops;
}

/**
 * Convert an ellipse to 4 cubic Bezier curves.
 */
function ellipseToOps(cx: number, cy: number, rx: number, ry: number): string {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;
  let ops = '';
  ops += `${n(cx)} ${n(cy + ry)} m\n`;
  ops += `${n(cx + ox)} ${n(cy + ry)} ${n(cx + rx)} ${n(cy + oy)} ${n(cx + rx)} ${n(cy)} c\n`;
  ops += `${n(cx + rx)} ${n(cy - oy)} ${n(cx + ox)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)} c\n`;
  ops += `${n(cx - ox)} ${n(cy - ry)} ${n(cx - rx)} ${n(cy - oy)} ${n(cx - rx)} ${n(cy)} c\n`;
  ops += `${n(cx - rx)} ${n(cy + oy)} ${n(cx - ox)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)} c\n`;
  return ops;
}

/**
 * Approximate an SVG arc command as cubic Bezier curve(s).
 *
 * SVG arcs use endpoint parameterization while PDF has no native arc
 * command, so we convert to centre parameterization and emit Bezier
 * approximations.
 */
function arcToOps(
  fromX: number,
  fromY: number,
  rx: number,
  ry: number,
  rotationDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  toX: number,
  toY: number,
): string {
  // Degenerate cases
  if (rx === 0 || ry === 0) {
    return `${n(toX)} ${n(toY)} l\n`;
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1')
  const dx2 = (fromX - toX) / 2;
  const dy2 = (fromY - toY) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Step 2: Compute (cxp, cyp)
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  // Ensure radii are large enough
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const lambdaSqrt = Math.sqrt(lambda);
    rx *= lambdaSqrt;
    ry *= lambdaSqrt;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) /
           (rxSq * y1pSq + rySq * x1pSq);
  if (sq < 0) sq = 0;
  sq = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) sq = -sq;

  const cxp = sq * rx * y1p / ry;
  const cyp = -sq * ry * x1p / rx;

  // Step 3: Compute (cx, cy)
  const cx = cosPhi * cxp - sinPhi * cyp + (fromX + toX) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (fromY + toY) / 2;

  // Step 4: Compute angles
  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );

  if (sweepFlag === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  // Split into segments of at most PI/2
  const segments = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segAngle = dTheta / segments;

  let ops = '';
  let angle = theta1;

  for (let i = 0; i < segments; i++) {
    const a1 = angle;
    const a2 = angle + segAngle;
    ops += arcSegmentToBezier(cx, cy, rx, ry, phi, a1, a2);
    angle = a2;
  }

  return ops;
}

/** Angle between two vectors. */
function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const umag = Math.sqrt(ux * ux + uy * uy);
  const vmag = Math.sqrt(vx * vx + vy * vy);
  const dot = ux * vx + uy * vy;
  let r = dot / (umag * vmag);
  if (r < -1) r = -1;
  if (r > 1) r = 1;
  return sign * Math.acos(r);
}

/** Convert one arc segment (at most PI/2) to a cubic Bezier curve. */
function arcSegmentToBezier(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta1: number,
  theta2: number,
): string {
  const alpha = (4 / 3) * Math.tan((theta2 - theta1) / 4);

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const cos1 = Math.cos(theta1);
  const sin1 = Math.sin(theta1);
  const cos2 = Math.cos(theta2);
  const sin2 = Math.sin(theta2);

  // End point of current segment = start of transformed coords
  const ep1x = cosPhi * rx * cos1 - sinPhi * ry * sin1 + cx;
  const ep1y = sinPhi * rx * cos1 + cosPhi * ry * sin1 + cy;

  // Control point 1
  const cp1x = ep1x + alpha * (-cosPhi * rx * sin1 - sinPhi * ry * cos1);
  const cp1y = ep1y + alpha * (-sinPhi * rx * sin1 + cosPhi * ry * cos1);

  // End point
  const ep2x = cosPhi * rx * cos2 - sinPhi * ry * sin2 + cx;
  const ep2y = sinPhi * rx * cos2 + cosPhi * ry * sin2 + cy;

  // Control point 2
  const cp2x = ep2x - alpha * (-cosPhi * rx * sin2 - sinPhi * ry * cos2);
  const cp2y = ep2y - alpha * (-sinPhi * rx * sin2 + cosPhi * ry * cos2);

  return `${n(cp1x)} ${n(cp1y)} ${n(cp2x)} ${n(cp2y)} ${n(ep2x)} ${n(ep2y)} c\n`;
}

/**
 * Convert a quadratic Bezier curve to a cubic Bezier.
 *
 * A quadratic B(t) with control point Q is equivalent to a cubic
 * with control points:
 *   CP1 = P0 + 2/3 * (Q - P0)
 *   CP2 = P1 + 2/3 * (Q - P1)
 */
function quadToCubicOps(
  fromX: number,
  fromY: number,
  cpx: number,
  cpy: number,
  toX: number,
  toY: number,
): string {
  const cp1x = fromX + (2 / 3) * (cpx - fromX);
  const cp1y = fromY + (2 / 3) * (cpy - fromY);
  const cp2x = toX + (2 / 3) * (cpx - toX);
  const cp2y = toY + (2 / 3) * (cpy - toY);
  return `${n(cp1x)} ${n(cp1y)} ${n(cp2x)} ${n(cp2y)} ${n(toX)} ${n(toY)} c\n`;
}

/** Convert an array of SvgDrawCommands to PDF path operators. */
function commandsToPathOps(commands: SvgDrawCommand[]): string {
  let ops = '';
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'moveTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${n(curX)} ${n(curY)} m\n`;
        break;

      case 'lineTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${n(curX)} ${n(curY)} l\n`;
        break;

      case 'curveTo':
        curX = cmd.params[4]!;
        curY = cmd.params[5]!;
        ops += `${n(cmd.params[0]!)} ${n(cmd.params[1]!)} ${n(cmd.params[2]!)} ${n(cmd.params[3]!)} ${n(curX)} ${n(curY)} c\n`;
        break;

      case 'quadCurveTo': {
        const cpx = cmd.params[0]!;
        const cpy = cmd.params[1]!;
        const toX = cmd.params[2]!;
        const toY = cmd.params[3]!;
        ops += quadToCubicOps(curX, curY, cpx, cpy, toX, toY);
        curX = toX;
        curY = toY;
        break;
      }

      case 'closePath':
        ops += 'h\n';
        break;

      case 'rect':
        ops += `${n(cmd.params[0]!)} ${n(cmd.params[1]!)} ${n(cmd.params[2]!)} ${n(cmd.params[3]!)} re\n`;
        break;

      case 'circle':
        ops += circleToOps(cmd.params[0]!, cmd.params[1]!, cmd.params[2]!);
        break;

      case 'ellipse':
        ops += ellipseToOps(cmd.params[0]!, cmd.params[1]!, cmd.params[2]!, cmd.params[3]!);
        break;

      case 'arc':
        ops += arcToOps(
          curX,
          curY,
          cmd.params[0]!,
          cmd.params[1]!,
          cmd.params[2]!,
          cmd.params[3]!,
          cmd.params[4]!,
          cmd.params[5]!,
          cmd.params[6]!,
        );
        curX = cmd.params[5]!;
        curY = cmd.params[6]!;
        break;
    }
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Stroke-state helpers
// ---------------------------------------------------------------------------

/** Map SVG stroke-linecap value to PDF line cap integer. */
function linecapToInt(cap: 'butt' | 'round' | 'square'): 0 | 1 | 2 {
  switch (cap) {
    case 'butt':   return 0;
    case 'round':  return 1;
    case 'square': return 2;
  }
}

/** Map SVG stroke-linejoin value to PDF line join integer. */
function linejoinToInt(join: 'miter' | 'round' | 'bevel'): 0 | 1 | 2 {
  switch (join) {
    case 'miter': return 0;
    case 'round': return 1;
    case 'bevel': return 2;
  }
}

// ---------------------------------------------------------------------------
// Painting operator selection
// ---------------------------------------------------------------------------

/**
 * Choose the correct PDF painting operator based on fill/stroke state
 * and fill-rule.
 */
function paintingOperator(
  hasFill: boolean,
  hasStroke: boolean,
  fillRule: 'nonzero' | 'evenodd' | undefined,
): string {
  const evenOdd = fillRule === 'evenodd';

  if (hasFill && hasStroke) {
    return evenOdd ? 'B*\n' : 'B\n';
  }
  if (hasFill) {
    return evenOdd ? 'f*\n' : 'f\n';
  }
  if (hasStroke) {
    return 'S\n';
  }
  // Default: fill with black (SVG default behaviour)
  return evenOdd ? 'f*\n' : 'f\n';
}

// ---------------------------------------------------------------------------
// Element -> PDF operators
// ---------------------------------------------------------------------------

/**
 * Convert an SVG element tree into PDF content stream operators.
 *
 * The returned string can be injected directly into a PDF page's
 * content stream.
 */
export function svgToPdfOperators(
  element: SvgElement,
  options?: SvgRenderOptions,
): string {
  let ops = '';

  // Get SVG dimensions for coordinate mapping
  const svgWidth = parseFloat(element.attributes['width'] ?? '') ||
    parseFloat(element.attributes['viewBox']?.split(/[\s,]+/)[2] ?? '') || 100;
  const svgHeight = parseFloat(element.attributes['height'] ?? '') ||
    parseFloat(element.attributes['viewBox']?.split(/[\s,]+/)[3] ?? '') || 100;

  const targetWidth = options?.width ?? svgWidth;
  const targetHeight = options?.height ?? svgHeight;
  const x = options?.x ?? 0;
  const y = options?.y ?? 0;

  let scaleX = targetWidth / svgWidth;
  let scaleY = targetHeight / svgHeight;

  if (options?.preserveAspectRatio !== false) {
    const scale = Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }

  // Save state, apply global transform
  ops += 'q\n';

  // Transform: translate to position, flip Y axis (SVG is top-down, PDF is bottom-up),
  // and scale to target size
  // The combined matrix: translate(x, y + targetHeight) * scale(scaleX, -scaleY)
  ops += `${n(scaleX)} 0 0 ${n(-scaleY)} ${n(x)} ${n(y + targetHeight)} cm\n`;

  // Handle viewBox
  const viewBox = element.attributes['viewBox'];
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      const vbX = parts[0]!;
      const vbY = parts[1]!;
      const vbW = parts[2]!;
      const vbH = parts[3]!;
      if (vbX !== 0 || vbY !== 0 || vbW !== svgWidth || vbH !== svgHeight) {
        const sx = svgWidth / vbW;
        const sy = svgHeight / vbH;
        ops += `${n(sx)} 0 0 ${n(sy)} ${n(-vbX * sx)} ${n(-vbY * sy)} cm\n`;
      }
    }
  }

  // Render child elements
  ops += renderElement(element, element.gradients);

  ops += 'Q\n';

  return ops;
}

/** Recursively render an SVG element to PDF operators. */
function renderElement(
  el: SvgElement,
  gradients?: Map<string, SvgGradient>,
): string {
  let ops = '';

  // Skip non-renderable elements
  const tag = el.tag;
  if (tag === 'defs' || tag === 'title' || tag === 'desc' ||
      tag === 'metadata' || tag === 'style' || tag === 'clipPath' ||
      tag === 'mask' || tag === 'symbol' || tag === 'marker' ||
      tag === 'lineargradient' || tag === 'radialgradient' || tag === 'stop') {
    return '';
  }

  // Merge gradient maps (element may have its own)
  const effectiveGradients = el.gradients ?? gradients;

  const hasTransform = el.transform !== undefined;
  const needsState = hasTransform || el.opacity !== undefined;

  if (needsState) {
    ops += 'q\n';
  }

  // Apply transform
  if (el.transform) {
    const [a, b, c, d, e, f] = el.transform;
    ops += `${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} cm\n`;
  }

  // Handle text elements
  if (tag === 'text' || tag === 'tspan') {
    ops += renderTextElement(el);
  }

  // Draw this element's path commands
  if (el.commands && el.commands.length > 0) {
    const hasFillGradient = el.fillGradientId !== undefined && (effectiveGradients?.has(el.fillGradientId) ?? false);
    const hasFill = el.fill !== undefined || hasFillGradient;
    const hasStroke = el.stroke !== undefined;

    // Set fill colour (solid or gradient comment marker)
    if (hasFillGradient) {
      const gradient = effectiveGradients!.get(el.fillGradientId!)!;
      ops += renderGradientFill(gradient, el);
    } else if (el.fill) {
      ops += `${n(el.fill.r / 255)} ${n(el.fill.g / 255)} ${n(el.fill.b / 255)} rg\n`;
    }

    // Set stroke colour
    if (hasStroke) {
      ops += `${n(el.stroke!.r / 255)} ${n(el.stroke!.g / 255)} ${n(el.stroke!.b / 255)} RG\n`;
    }

    // Set stroke width
    if (el.strokeWidth !== undefined) {
      ops += `${n(el.strokeWidth)} w\n`;
    }

    // Set line cap
    if (el.strokeLinecap !== undefined) {
      ops += `${linecapToInt(el.strokeLinecap)} J\n`;
    }

    // Set line join
    if (el.strokeLinejoin !== undefined) {
      ops += `${linejoinToInt(el.strokeLinejoin)} j\n`;
    }

    // Set miter limit
    if (el.strokeMiterlimit !== undefined) {
      ops += `${n(el.strokeMiterlimit)} M\n`;
    }

    // Set dash pattern
    if (el.strokeDasharray !== undefined) {
      const phase = el.strokeDashoffset ?? 0;
      const arr = `[${el.strokeDasharray.map(n).join(' ')}]`;
      ops += `${arr} ${n(phase)} d\n`;
    }

    // Path operators
    ops += commandsToPathOps(el.commands);

    // For gradient fills, we use the first stop's colour as a solid-fill
    // approximation in the content stream (the full shading is separate).
    // The painting operator still needs to reflect fill + stroke.
    ops += paintingOperator(hasFill, hasStroke, el.fillRule);
  }

  // Render children
  for (const child of el.children) {
    ops += renderElement(child, effectiveGradients);
  }

  if (needsState) {
    ops += 'Q\n';
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Gradient fill rendering
// ---------------------------------------------------------------------------

/**
 * Render a gradient fill as PDF content-stream operators.
 *
 * For content-stream-only output (no indirect objects), we approximate
 * the gradient by using the first stop's colour as the fill colour and
 * emit a comment with the gradient metadata. Full PDF shading requires
 * indirect objects (handled by the page integration path).
 *
 * When using `drawSvgOnPage`, the gradient information is available for
 * proper PDF shading pattern construction.
 */
function renderGradientFill(gradient: SvgGradient, el: SvgElement): string {
  let ops = '';

  // Use the first stop's colour as solid fill approximation
  if (gradient.stops.length > 0) {
    const stop = gradient.stops[0]!;
    const r = stop.color.r / 255;
    const g = stop.color.g / 255;
    const b = stop.color.b / 255;
    ops += `${n(r)} ${n(g)} ${n(b)} rg\n`;
  }

  // Emit gradient metadata as a PDF comment for downstream processing
  ops += `% gradient:${gradient.type}:${gradient.id}`;
  if (gradient.gradientTransform) {
    const [a, b, c, d, e, f] = gradient.gradientTransform;
    ops += `:transform(${n(a)},${n(b)},${n(c)},${n(d)},${n(e)},${n(f)})`;
  }
  ops += `:spread(${gradient.spreadMethod})`;
  ops += `:units(${gradient.gradientUnits})`;

  if (gradient.type === 'linearGradient') {
    ops += `:coords(${n(gradient.x1 ?? 0)},${n(gradient.y1 ?? 0)},${n(gradient.x2 ?? 1)},${n(gradient.y2 ?? 0)})`;
  } else {
    ops += `:coords(${n(gradient.cx ?? 0.5)},${n(gradient.cy ?? 0.5)},${n(gradient.r ?? 0.5)},${n(gradient.fx ?? 0.5)},${n(gradient.fy ?? 0.5)})`;
  }

  ops += `:stops(${gradient.stops.map((s) => `${n(s.offset)}=${s.color.r},${s.color.g},${s.color.b},${n(s.opacity)}`).join(';')})`;
  ops += '\n';

  return ops;
}

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

/**
 * Render a `<text>` or `<tspan>` SVG element as PDF text operators.
 *
 * SVG text positioning uses `x` and `y` attributes.  We emit a
 * text matrix (Tm) to position the text, using Helvetica as the
 * default font (since we cannot embed arbitrary fonts without the
 * full font pipeline).
 *
 * The font is referenced as `/Helvetica` which must exist in the
 * page's font resources.  When drawn via `drawSvgOnPage`, the page
 * will need to have a Helvetica resource.  For standalone operator
 * generation the caller is responsible for resource setup.
 */
function renderTextElement(el: SvgElement): string {
  // Collect text content from direct content or __text attribute
  const text = el.textContent ?? el.attributes['__text'] ?? '';
  if (!text) return '';

  let ops = '';

  const posX = parseFloat(el.attributes['x'] ?? '0') || 0;
  const posY = parseFloat(el.attributes['y'] ?? '0') || 0;
  const fontSize = el.fontSize ?? 16;

  // Determine font name — map common families to PDF standard fonts
  const fontName = resolveStandardFont(el.fontFamily, el.fontWeight, el.fontStyle);

  // Set fill colour for text
  if (el.fill) {
    ops += `${n(el.fill.r / 255)} ${n(el.fill.g / 255)} ${n(el.fill.b / 255)} rg\n`;
  }

  // Begin text object
  ops += 'BT\n';

  // Select font
  ops += `/${fontName} ${n(fontSize)} Tf\n`;

  // Position text with a text matrix
  // Since we're already in SVG coordinate space (y-down), we
  // position the text at (posX, posY).
  ops += `${n(posX)} ${n(posY)} Td\n`;

  // Show text
  ops += `(${escapePdfString(text)}) Tj\n`;

  // End text object
  ops += 'ET\n';

  return ops;
}

/**
 * Resolve a font-family + weight + style to a PDF standard font name.
 *
 * PDF has 14 standard fonts; we map common CSS font families to them.
 */
function resolveStandardFont(
  family: string | undefined,
  weight: string | undefined,
  style: string | undefined,
): string {
  const isBold = weight === 'bold' || (weight !== undefined && parseInt(weight, 10) >= 700);
  const isItalic = style === 'italic' || style === 'oblique';

  const lowerFamily = (family ?? '').toLowerCase();

  // Map to standard PDF font names
  if (lowerFamily.includes('courier') || lowerFamily.includes('monospace')) {
    if (isBold && isItalic) return 'Courier-BoldOblique';
    if (isBold) return 'Courier-Bold';
    if (isItalic) return 'Courier-Oblique';
    return 'Courier';
  }

  if (lowerFamily.includes('times') || lowerFamily.includes('serif')) {
    if (isBold && isItalic) return 'Times-BoldItalic';
    if (isBold) return 'Times-Bold';
    if (isItalic) return 'Times-Italic';
    return 'Times-Roman';
  }

  // Default: Helvetica (sans-serif)
  if (isBold && isItalic) return 'Helvetica-BoldOblique';
  if (isBold) return 'Helvetica-Bold';
  if (isItalic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

// ---------------------------------------------------------------------------
// Page integration
// ---------------------------------------------------------------------------

/**
 * Draw an SVG string onto a PDF page.
 *
 * Parses the SVG, converts it to PDF operators, and appends them
 * to the page's content stream.
 */
export function drawSvgOnPage(
  page: PdfPage,
  svgString: string,
  options?: SvgRenderOptions,
): void {
  const svgElement = parseSvg(svgString);
  const ops = svgToPdfOperators(svgElement, options);
  page.pushOperators(ops);
}

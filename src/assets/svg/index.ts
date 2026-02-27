/**
 * @module assets/svg
 *
 * SVG parsing and PDF conversion — barrel export.
 */

export {
  parseSvg,
  parseSvgPath,
  parseSvgColor,
  parseSvgTransform,
} from './svgParser.js';
export type { SvgDrawCommand, SvgElement } from './svgParser.js';

export { svgToPdfOperators, drawSvgOnPage } from './svgToPdf.js';
export type { SvgRenderOptions } from './svgToPdf.js';

/**
 * @module core/operators
 *
 * Barrel export for all PDF content-stream operator functions.
 *
 * Provides 60+ individual operator functions plus the {@link PDFOperator}
 * first-class wrapper for advanced use cases.
 *
 * ```ts
 * import { pushGraphicsState, popGraphicsState, moveTo, lineTo, stroke } from 'modern-pdf-lib/operators';
 * ```
 */

// ---------------------------------------------------------------------------
// Graphics — path construction & painting
// ---------------------------------------------------------------------------

export {
  rectangle,
  moveTo,
  lineTo,
  curveTo,
  curveToInitial,
  curveToFinal,
  closePath,
  stroke,
  closeAndStroke,
  fill,
  fillEvenOdd,
  fillAndStroke,
  fillEvenOddAndStroke,
  closeFillAndStroke,
  closeFillEvenOddAndStroke,
  endPath,
  clip,
  clipEvenOdd,
  setLineWidth,
  setLineCap,
  setLineJoin,
  setMiterLimit,
  setDashPattern,
  setFlatness,
  circlePath,
  ellipsePath,
} from './graphics.js';

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

export {
  rgb,
  cmyk,
  grayscale,
  spotColor,
  deviceNColor,
  rgbToCmyk,
  cmykToRgb,
  colorToHex,
  hexToColor,
  spotResourceName,
  deviceNResourceName,
  setFillColorRgb,
  setFillColorCmyk,
  setFillColorGray,
  setStrokeColorRgb,
  setStrokeColorCmyk,
  setStrokeColorGray,
  setColorSpace,
  setStrokeColorSpace,
  setFillColor,
  setStrokeColor,
  applyFillColor,
  applyStrokeColor,
  componentsToColor,
  colorToComponents,
  setFillingColor,
  setStrokingColor,
} from './color.js';
export type { RgbColor, CmykColor, GrayscaleColor, SpotColor, DeviceNColor, Color } from './color.js';

// ---------------------------------------------------------------------------
// Spot / Separation / DeviceN colour space builders
// ---------------------------------------------------------------------------

export {
  buildSeparationColorSpace,
  buildDeviceNColorSpace,
} from './spotColor.js';

// ---------------------------------------------------------------------------
// Graphics state & transformations
// ---------------------------------------------------------------------------

export {
  saveState,
  restoreState,
  concatMatrix,
  translate,
  scale,
  rotate,
  skew,
  rotationMatrix,
  setGraphicsState,
  degrees,
  radians,
  toRadians,
  toDegrees,
  degreesToRadians,
  radiansToDegrees,
} from './state.js';
export type { Radians, Degrees, Angle } from './state.js';

// Aliases matching pdf-lib naming conventions
export { saveState as pushGraphicsState } from './state.js';
export { restoreState as popGraphicsState } from './state.js';
export { concatMatrix as concatTransformationMatrix } from './state.js';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export {
  beginText,
  endText,
  setFont,
  setFontSize,
  setLeading,
  setCharacterSpacing,
  setWordSpacing,
  setTextRise,
  setTextRenderingMode,
  setTextMatrix,
  moveText,
  moveTextSetLeading,
  nextLine,
  showText,
  showTextHex,
  showTextArray,
  showTextNextLine,
  showTextWithSpacing,
} from './text.js';

// Alias matching pdf-lib naming
export { setFont as setFontAndSize } from './text.js';
export { setLeading as setLineHeight } from './text.js';
export { setWordSpacing as setWordSpacingOp } from './text.js';
export { setCharacterSpacing as setCharacterSqueeze } from './text.js';

// ---------------------------------------------------------------------------
// Image / XObject
// ---------------------------------------------------------------------------

export {
  drawXObject,
  drawImageXObject,
  drawImageWithMatrix,
} from './image.js';

// Alias matching pdf-lib naming
export { drawXObject as drawObject } from './image.js';

// ---------------------------------------------------------------------------
// Marked content (re-exported for convenience)
// ---------------------------------------------------------------------------

export {
  beginMarkedContent,
  endMarkedContent,
} from '../../accessibility/markedContent.js';

// ---------------------------------------------------------------------------
// PDFOperator — first-class operator wrapper
// ---------------------------------------------------------------------------

/**
 * A first-class representation of a single PDF content-stream operator.
 *
 * In pdf-lib, operators are typed objects rather than raw strings. This
 * class provides the same capability while remaining interoperable with
 * the string-based operator functions above.
 *
 * ```ts
 * const op = PDFOperator.of('m', 100, 200);   // moveTo(100, 200)
 * page.pushOperators(op.toString());
 * ```
 */
export class PDFOperator {
  /**
   * Create a new operator.
   *
   * @param name      The PDF operator name (e.g. `'m'`, `'l'`, `'re'`, `'Tj'`).
   * @param operands  Numeric, string, or name operands.
   */
  static of(name: string, ...operands: (number | string)[]): PDFOperator {
    return new PDFOperator(name, operands);
  }

  private constructor(
    /** The PDF operator name. */
    readonly name: string,
    /** The operands for this operator. */
    readonly operands: readonly (number | string)[],
  ) {}

  /**
   * Serialize this operator to its PDF content-stream representation.
   *
   * @returns A string like `"100 200 m\n"`.
   */
  toString(): string {
    if (this.operands.length === 0) return `${this.name}\n`;
    const args = this.operands
      .map((op) => {
        if (typeof op === 'number') {
          if (Number.isInteger(op)) return op.toString();
          const s = op.toFixed(6).replace(/\.?0+$/, '');
          return s === '-0' ? '0' : s;
        }
        return op;
      })
      .join(' ');
    return `${args} ${this.name}\n`;
  }
}

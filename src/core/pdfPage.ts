/**
 * @module core/pdfPage
 *
 * Represents a single page in a PDF document.  Drawing operations are
 * synchronous — they append PDF operators to an internal content-stream
 * buffer.  The final content stream is materialized when the document
 * is saved.
 *
 * Usage:
 * ```ts
 * const page = doc.addPage([595.28, 841.89]); // A4
 * page.drawText('Hello', { x: 50, y: 750, font: myFont, size: 24 });
 * page.drawRectangle({ x: 50, y: 700, width: 200, height: 50 });
 * ```
 */

import type { Color } from './operators/color.js';
import type { Angle } from './operators/state.js';
import type { BlendMode } from './enums.js';
import {
  beginText,
  endText,
  setFont,
  showText,
  showTextHex,
  moveText,
  setLeading,
  nextLine,
  setTextMatrix,
  showTextArray,
} from './operators/text.js';
import {
  rectangle,
  moveTo,
  lineTo,
  curveTo,
  stroke,
  fill,
  fillAndStroke,
  closePath,
  setLineWidth,
  setLineCap,
  setLineJoin,
  setDashPattern,
  circlePath,
  ellipsePath,
} from './operators/graphics.js';
import { drawXObject, drawImageXObject } from './operators/image.js';
import {
  applyFillColor,
  applyStrokeColor,
  setFillColorRgb,
  setStrokeColorRgb,
} from './operators/color.js';
import {
  saveState,
  restoreState,
  concatMatrix,
  toRadians,
  setGraphicsState,
} from './operators/state.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfRef,
  PdfStream,
  PdfString,
  PdfObjectRegistry,
} from './pdfObjects.js';
import type { StructureType } from '../accessibility/structureTree.js';
import {
  wrapInMarkedContent,
  beginMarkedContentSequence,
  endMarkedContent,
} from '../accessibility/markedContent.js';
import { PdfAnnotation, createAnnotation } from '../annotation/pdfAnnotation.js';
import type { AnnotationType, AnnotationOptions } from '../annotation/pdfAnnotation.js';
import type { SvgRenderOptions } from '../assets/svg/svgToPdf.js';
import { drawSvgOnPage } from '../assets/svg/svgToPdf.js';
import { parseSvgPath } from '../assets/svg/svgParser.js';
import type { SvgDrawCommand } from '../assets/svg/svgParser.js';
import type { PdfLayer } from '../layers/optionalContent.js';
import { beginLayerContent, endLayerContent } from '../layers/optionalContent.js';
import type { RedactionOptions } from './redaction.js';
import { markForRedaction } from './redaction.js';
import type { EmbeddedPdfPage, DrawPageOptions } from './pdfEmbed.js';

// ---------------------------------------------------------------------------
// Common page sizes (width × height in points, portrait orientation)
// ---------------------------------------------------------------------------

/** Pre-defined page sizes as `[width, height]` tuples in PDF points. */
export const PageSizes = {
  // ISO A series (all dimensions in PDF points, 72 pts = 1 inch)
  '4A0': [4767.87, 6740.79] as const,
  '2A0': [3370.39, 4767.87] as const,
  A0: [2383.94, 3370.39] as const,
  A1: [1683.78, 2383.94] as const,
  A2: [1190.55, 1683.78] as const,
  A3: [841.89, 1190.55] as const,
  A4: [595.28, 841.89] as const,
  A5: [419.53, 595.28] as const,
  A6: [297.64, 419.53] as const,
  A7: [209.76, 297.64] as const,
  A8: [147.40, 209.76] as const,
  A9: [104.88, 147.40] as const,
  A10: [73.70, 104.88] as const,
  // ISO B series
  B0: [2834.65, 4008.19] as const,
  B1: [2004.09, 2834.65] as const,
  B2: [1417.32, 2004.09] as const,
  B3: [1000.63, 1417.32] as const,
  B4: [708.66, 1000.63] as const,
  B5: [498.90, 708.66] as const,
  B6: [354.33, 498.90] as const,
  B7: [249.45, 354.33] as const,
  B8: [175.75, 249.45] as const,
  B9: [124.72, 175.75] as const,
  B10: [87.87, 124.72] as const,
  // US / North American
  Letter: [612, 792] as const,
  Legal: [612, 1008] as const,
  Tabloid: [792, 1224] as const,
  Ledger: [1224, 792] as const,
  Executive: [521.86, 756] as const,
  Folio: [612, 936] as const,
} as const satisfies Record<string, readonly [number, number]>;

/** Type for a page-size input: a `[width, height]` tuple or `{ width, height }` object. */
export type PageSize =
  | readonly [width: number, height: number]
  | { readonly width: number; readonly height: number };

// ---------------------------------------------------------------------------
// Drawing options
// ---------------------------------------------------------------------------

/** Options for {@link PdfPage.drawText}. */
export interface DrawTextOptions {
  /** X coordinate. */
  x?: number | undefined;
  /** Y coordinate. */
  y?: number | undefined;
  /**
   * Font to use for rendering.
   *
   * Accepts either a {@link FontRef} object (returned by `doc.embedFont()`)
   * or a font resource name string (e.g. `'F1'`).
   *
   * When a `FontRef` is provided, its `name` property is used as the
   * resource name and its CID encoder (if any) is used automatically.
   */
  font?: FontRef | string | undefined;
  /** Font size in points. */
  size?: number | undefined;
  /** Text colour.  Defaults to black. */
  color?: Color | undefined;
  /** Rotation angle. */
  rotate?: Angle | undefined;
  /** Line height for multi-line text. */
  lineHeight?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
  /**
   * Maximum width in points before text is automatically wrapped.
   *
   * When provided with a {@link FontRef} font (which has `widthOfTextAtSize`),
   * the text is broken at word boundaries to fit within this width.
   * If a single word exceeds `maxWidth`, it is broken at character level.
   *
   * When the font is a plain string (no measurement available), this
   * option is ignored.
   */
  maxWidth?: number | undefined;
}

/** Options for {@link PdfPage.drawImage}. */
export interface DrawImageOptions {
  /** X coordinate of the lower-left corner. */
  x?: number | undefined;
  /** Y coordinate of the lower-left corner. */
  y?: number | undefined;
  /** Rendered width. */
  width?: number | undefined;
  /** Rendered height. */
  height?: number | undefined;
  /** Rotation angle. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawRectangle}. */
export interface DrawRectangleOptions {
  /** X coordinate. */
  x?: number | undefined;
  /** Y coordinate. */
  y?: number | undefined;
  /** Rectangle width. */
  width?: number | undefined;
  /** Rectangle height. */
  height?: number | undefined;
  /** Fill colour.  Set to `undefined` for no fill. */
  color?: Color | undefined;
  /** Border (stroke) colour.  Set to `undefined` for no stroke. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Rotation angle. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawLine}. */
export interface DrawLineOptions {
  /** Start point. */
  start: { x: number; y: number };
  /** End point. */
  end: { x: number; y: number };
  /** Line colour. */
  color?: Color | undefined;
  /** Line width. */
  thickness?: number | undefined;
  /** Dash pattern `[dashLength, gapLength]`. */
  dashArray?: number[] | undefined;
  /** Dash phase. */
  dashPhase?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawCircle}. */
export interface DrawCircleOptions {
  /** Centre x. */
  x?: number | undefined;
  /** Centre y. */
  y?: number | undefined;
  /** Radius of the circle. */
  radius?: number | undefined;
  /**
   * Radius of the circle.
   * @deprecated Use `radius` instead.
   */
  size?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Border colour. */
  borderColor?: Color | undefined;
  /** Border width. */
  borderWidth?: number | undefined;
  /** Opacity. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawEllipse}. */
export interface DrawEllipseOptions {
  /** Centre x. */
  x?: number | undefined;
  /** Centre y. */
  y?: number | undefined;
  /** Horizontal radius. */
  xScale?: number | undefined;
  /** Vertical radius. */
  yScale?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Border colour. */
  borderColor?: Color | undefined;
  /** Border width. */
  borderWidth?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawSvgPath}. */
export interface DrawSvgPathOptions {
  /** X translation (PDF coordinates). */
  x?: number | undefined;
  /** Y translation (PDF coordinates). */
  y?: number | undefined;
  /** Uniform scale factor applied to the path. */
  scale?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Border (stroke) colour. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

/** Options for {@link PdfPage.drawSquare}. */
export interface DrawSquareOptions {
  /** X coordinate. */
  x?: number | undefined;
  /** Y coordinate. */
  y?: number | undefined;
  /** Side length of the square.  Defaults to `100`. */
  size?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Border (stroke) colour. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Rotation angle. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Blend mode for compositing. */
  blendMode?: BlendMode | undefined;
}

// ---------------------------------------------------------------------------
// Embedded resource reference (returned by embedFont / embedImage)
// ---------------------------------------------------------------------------

/** Opaque handle for a font that has been embedded in the document. */
export interface FontRef {
  /** Resource name used in content-stream operators (e.g. `F1`). */
  readonly name: string;
  /** Indirect reference to the font dictionary. */
  readonly ref: PdfRef;
  /**
   * Compute the width of a text string at the given font size (in points).
   * Available for both standard and TrueType fonts.
   */
  widthOfTextAtSize(text: string, size: number): number;
  /**
   * Compute the height of the font at the given size (ascender - descender).
   * Available for both standard and TrueType fonts.
   */
  heightAtSize(size: number): number;
  /**
   * Whether this font uses CID (Identity-H) encoding.
   * When true, text must be encoded as hex glyph IDs in content streams.
   * @internal
   */
  readonly _isCIDFont?: boolean;
  /**
   * Encode text as a hex string of CID glyph IDs for content streams.
   * Only present for CID (TrueType) fonts.
   * @internal
   */
  _encodeText?(text: string): string;
}

/** Opaque handle for an image that has been embedded in the document. */
export interface ImageRef {
  /** Resource name used in content-stream operators (e.g. `Im1`). */
  readonly name: string;
  /** Indirect reference to the image XObject. */
  readonly ref: PdfRef;
  /** Intrinsic width in pixels. */
  readonly width: number;
  /** Intrinsic height in pixels. */
  readonly height: number;
  /**
   * Return a new `{ width, height }` scaled by the given factor.
   *
   * @param factor  Scale multiplier (e.g. `0.5` for half size).
   */
  scale(factor: number): { width: number; height: number };
  /**
   * Return a new `{ width, height }` that fits within the given bounds
   * while preserving the aspect ratio.
   *
   * @param maxWidth   Maximum allowed width.
   * @param maxHeight  Maximum allowed height.
   */
  scaleToFit(maxWidth: number, maxHeight: number): { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Text wrapping
// ---------------------------------------------------------------------------

/**
 * Break a single line of text into multiple lines that fit within `maxWidth`.
 *
 * @param text      The input text (a single line, no newlines).
 * @param maxWidth  Maximum width in points.
 * @param font      A FontRef with `widthOfTextAtSize`, or a string name.
 * @param size      Font size in points.
 * @returns         An array of wrapped lines.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: FontRef | string,
  size: number,
): string[] {
  // If font is a string, we have no measurement capability — return as-is
  if (typeof font === 'string') {
    return [text];
  }

  // If text fits on one line, return as-is
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine === '') {
      // Starting a new line.  Check if the word itself fits.
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        currentLine = word;
      } else {
        // Word exceeds maxWidth — break at character level
        const charLines = breakWord(word, maxWidth, font, size);
        // All but the last fragment become full lines
        for (let i = 0; i < charLines.length - 1; i++) {
          lines.push(charLines[i]!);
        }
        currentLine = charLines.at(-1)!;
      }
    } else {
      // Try appending the word to the current line
      const candidate = currentLine + ' ' + word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
      } else {
        // Current line is full — push it and start a new line
        lines.push(currentLine);

        // Check if the word itself fits on a fresh line
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          currentLine = word;
        } else {
          // Word exceeds maxWidth — break at character level
          const charLines = breakWord(word, maxWidth, font, size);
          for (let i = 0; i < charLines.length - 1; i++) {
            lines.push(charLines[i]!);
          }
          currentLine = charLines.at(-1)!;
        }
      }
    }
  }

  // Push the remaining text
  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Break a single word into fragments that fit within `maxWidth`
 * by splitting at the character level.
 *
 * @param word      The word to break.
 * @param maxWidth  Maximum width in points.
 * @param font      A FontRef with measurement capabilities.
 * @param size      Font size in points.
 * @returns         Array of character-level fragments.
 */
function breakWord(
  word: string,
  maxWidth: number,
  font: FontRef,
  size: number,
): string[] {
  const fragments: string[] = [];
  let current = '';

  for (const char of word) {
    const candidate = current + char;
    if (current !== '' && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }

  if (current !== '') {
    fragments.push(current);
  }

  return fragments;
}

// ---------------------------------------------------------------------------
// PdfPage
// ---------------------------------------------------------------------------

/**
 * A single page in a PDF document.
 *
 * Drawing methods are synchronous and append PDF operators to an
 * internal string buffer.  The buffer is converted to a content stream
 * when the document is saved.
 */
export class PdfPage {
  /** Content-stream operators accumulated so far. */
  private ops = '';

  /** Fonts referenced by this page — maps resource name → PdfRef. */
  private readonly fonts = new Map<string, PdfRef>();

  /**
   * CID font text encoders — maps resource name → encode function.
   * Only present for TrueType (CIDFont Type 2) fonts.
   * @internal
   */
  private readonly cidFontEncoders = new Map<string, (text: string) => string>();

  /** XObjects (images) referenced by this page. */
  private readonly xObjects = new Map<string, PdfRef>();

  /**
   * ExtGState dictionaries referenced by this page.
   * Maps a resource name (e.g. `GS1`) to its indirect reference.
   * Used for opacity and other graphics state parameters.
   */
  private readonly extGStates = new Map<string, PdfRef>();

  /**
   * Counter for ExtGState resource names (`GS1`, `GS2`, ...).
   */
  private extGStateCounter = 0;

  /**
   * Cache mapping composite keys (opacity + blend mode) to their ExtGState
   * resource names, so the same combination reuses the same graphics state
   * dictionary.
   */
  private readonly extGStateCache = new Map<string, string>();

  // -----------------------------------------------------------------------
  // Page-level drawing defaults
  // -----------------------------------------------------------------------

  /** Default font used by `drawText()` when no `font` option is provided. */
  private _defaultFont?: FontRef;

  /** Default font size used by `drawText()` when no `size` option is provided. */
  private _defaultFontSize?: number;

  /** Default font colour used by `drawText()` when no `color` option is provided. */
  private _defaultFontColor?: Color;

  /** Default line height used by `drawText()` when no `lineHeight` option is provided. */
  private _defaultLineHeight?: number;

  /** Pre-allocated indirect reference for this page's /Page dictionary. */
  readonly pageRef: PdfRef;

  /** Pre-allocated indirect reference for this page's content stream. */
  readonly contentStreamRef: PdfRef;

  /**
   * Page rotation in degrees (0, 90, 180, or 270).
   * This is written to the /Rotate entry in the page dictionary at save time.
   * @internal
   */
  private rotation = 0;

  /**
   * Optional crop box `[llx, lly, urx, ury]`.
   * When set, written to the /CropBox entry in the page dictionary at save time.
   * @internal
   */
  private cropBox: [number, number, number, number] | undefined;

  /**
   * Optional bleed box `[llx, lly, urx, ury]`.
   * When set, written to the /BleedBox entry in the page dictionary at save time.
   * @internal
   */
  private bleedBox: [number, number, number, number] | undefined;

  /**
   * Optional art box `[llx, lly, urx, ury]`.
   * When set, written to the /ArtBox entry in the page dictionary at save time.
   * @internal
   */
  private artBox: [number, number, number, number] | undefined;

  /**
   * Optional trim box `[llx, lly, urx, ury]`.
   * When set, written to the /TrimBox entry in the page dictionary at save time.
   * @internal
   */
  private trimBox: [number, number, number, number] | undefined;

  /**
   * Mutable media box origin and dimensions. Initially set from constructor.
   * @internal
   */
  private mediaX: number;
  /** @internal */
  private mediaY: number;
  /** @internal */
  private mediaWidth: number;
  /** @internal */
  private mediaHeight: number;

  // -----------------------------------------------------------------------
  // Content preservation for loaded (parsed) PDFs
  // -----------------------------------------------------------------------

  /**
   * @internal Original content stream refs from a loaded PDF.
   * These are indirect references to PdfStream objects already in the registry.
   */
  private _originalContentRefs: PdfRef[] = [];

  /**
   * @internal Original resources dictionary from a loaded PDF.
   * Merged with new resources in `buildResources()`.
   */
  private _originalResources: PdfDict | undefined;

  /**
   * @internal Original annotation refs from a loaded PDF.
   * Combined with new annotations in `finalize()`.
   */
  private _originalAnnotRefs: PdfRef[] = [];

  constructor(
    /** Page width in points. */
    w: number,
    /** Page height in points. */
    h: number,
    /** Object registry for allocating refs. */
    private readonly registry: PdfObjectRegistry,
  ) {
    this.mediaX = 0;
    this.mediaY = 0;
    this.mediaWidth = w;
    this.mediaHeight = h;
    this.pageRef = registry.allocate();
    this.contentStreamRef = registry.allocate();
  }

  /**
   * @internal Create a PdfPage pre-loaded with content from a parsed PDF.
   *
   * Unlike the normal constructor which creates a blank page, this factory
   * preserves the original content streams, resources, annotations, and
   * other page attributes from the parsed PDF.
   */
  static _fromParsed(
    width: number,
    height: number,
    registry: PdfObjectRegistry,
    opts: {
      contentRefs?: PdfRef[] | undefined;
      resources?: PdfDict | undefined;
      rotation?: number | undefined;
      cropBox?: [number, number, number, number] | undefined;
      bleedBox?: [number, number, number, number] | undefined;
      artBox?: [number, number, number, number] | undefined;
      trimBox?: [number, number, number, number] | undefined;
      annotRefs?: PdfRef[] | undefined;
    },
  ): PdfPage {
    const page = new PdfPage(width, height, registry);
    if (opts.contentRefs) page._originalContentRefs = opts.contentRefs;
    if (opts.resources) page._originalResources = opts.resources;
    if (opts.rotation) page.rotation = opts.rotation;
    if (opts.cropBox) page.cropBox = opts.cropBox;
    if (opts.bleedBox) page.bleedBox = opts.bleedBox;
    if (opts.artBox) page.artBox = opts.artBox;
    if (opts.trimBox) page.trimBox = opts.trimBox;
    if (opts.annotRefs) page._originalAnnotRefs = opts.annotRefs;
    return page;
  }

  /** Page width in points. */
  get width(): number {
    return this.mediaWidth;
  }

  /** Page height in points. */
  get height(): number {
    return this.mediaHeight;
  }

  // -----------------------------------------------------------------------
  // Resource registration (called by PdfDocument)
  // -----------------------------------------------------------------------

  /** @internal Register a font resource on this page. */
  registerFont(name: string, ref: PdfRef): void {
    this.fonts.set(name, ref);
  }

  /**
   * @internal Register a CID font encoder for a font resource on this page.
   * When drawText is called with this font, text will be encoded using the
   * provided encoder function (producing hex glyph IDs) instead of literal strings.
   */
  registerCIDFont(name: string, encoder: (text: string) => string): void {
    this.cidFontEncoders.set(name, encoder);
  }

  /** @internal Register an image XObject resource on this page. */
  registerXObject(name: string, ref: PdfRef): void {
    this.xObjects.set(name, ref);
  }

  /** @internal Register an ExtGState resource on this page. */
  registerExtGState(name: string, ref: PdfRef): void {
    this.extGStates.set(name, ref);
  }

  // -----------------------------------------------------------------------
  // Page-level drawing default setters
  // -----------------------------------------------------------------------

  /**
   * Set the default font used by {@link drawText} when the `font` option
   * is not provided.
   *
   * @param font  A {@link FontRef} returned by `doc.embedFont()`.
   */
  setFont(font: FontRef): void {
    this._defaultFont = font;
  }

  /**
   * Set the default font size (in points) used by {@link drawText} when
   * the `size` option is not provided.
   *
   * @param size  Font size in points.
   */
  setFontSize(size: number): void {
    this._defaultFontSize = size;
  }

  /**
   * Set the default font colour used by {@link drawText} when the `color`
   * option is not provided.
   *
   * @param color  A {@link Color} value (e.g. from `rgb()`, `cmyk()`, etc.).
   */
  setFontColor(color: Color): void {
    this._defaultFontColor = color;
  }

  /**
   * Set the default line height used by {@link drawText} when the
   * `lineHeight` option is not provided.
   *
   * @param height  Line height in points.
   */
  setLineHeight(height: number): void {
    this._defaultLineHeight = height;
  }

  // -----------------------------------------------------------------------
  // ExtGState management (opacity)
  // -----------------------------------------------------------------------

  /**
   * Get or create an ExtGState resource for the given opacity and/or
   * blend mode.
   *
   * Creates a PDF ExtGState dictionary with `/ca` + `/CA` (when opacity
   * is less than 1) and `/BM` (when a non-Normal blend mode is specified).
   * The dictionary is registered in the object registry and cached so that
   * the same combination of parameters shares a single resource.
   *
   * @param opacity    Opacity value in the range `[0, 1]` (optional).
   * @param blendMode  A PDF blend mode name (optional).
   * @returns The resource name (e.g. `GS1`) to use in content stream operators.
   * @internal
   */
  private getOrCreateExtGState(opacity?: number, blendMode?: string): string {
    const cacheKey = `${opacity ?? 1}:${blendMode ?? 'Normal'}`;

    // Reuse existing graphics state for this combination
    const existing = this.extGStateCache.get(cacheKey);
    if (existing) return existing;

    this.extGStateCounter++;
    const gsName = `GS${this.extGStateCounter}`;

    // Build the ExtGState dictionary
    const gsDict = new PdfDict();
    gsDict.set('/Type', PdfName.of('ExtGState'));

    if (opacity !== undefined && opacity < 1) {
      gsDict.set('/ca', PdfNumber.of(opacity));  // Fill opacity
      gsDict.set('/CA', PdfNumber.of(opacity));  // Stroke opacity
    }

    if (blendMode !== undefined && blendMode !== 'Normal') {
      gsDict.set('/BM', PdfName.of(blendMode));
    }

    // Register in the object registry and store the reference
    const gsRef = this.registry.register(gsDict);
    this.extGStates.set(gsName, gsRef);
    this.extGStateCache.set(cacheKey, gsName);

    return gsName;
  }

  // -----------------------------------------------------------------------
  // Drawing: Text
  // -----------------------------------------------------------------------

  /**
   * Draw a text string at the specified position.
   *
   * @param text     The text to render.
   * @param options  Position, font, size, colour, rotation.
   */
  drawText(text: string, options: DrawTextOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const size = options.size ?? this._defaultFontSize ?? 12;

    // Resolve the effective font: explicit option -> page default -> fallback 'F1'
    const effectiveFont: FontRef | string | undefined =
      options.font ?? this._defaultFont;

    // Resolve line height: explicit option -> page default -> computed from size
    const lineHeight = options.lineHeight ?? this._defaultLineHeight ?? size * 1.2;

    // Resolve colour: explicit option -> page default -> undefined (no colour op)
    const effectiveColor: Color | undefined = options.color ?? this._defaultFontColor;

    // Resolve font: accept FontRef object or string
    let fontName: string;
    let fontRefEncoder: ((text: string) => string) | undefined;
    if (effectiveFont && typeof effectiveFont === 'object' && 'name' in effectiveFont) {
      // FontRef object
      const fontRef = effectiveFont as FontRef;
      fontName = fontRef.name;
      // Register the font on this page if it has a ref
      if (fontRef.ref) {
        this.registerFont(fontRef.name, fontRef.ref);
      }
      // Use the FontRef's CID encoder if available
      if (fontRef._isCIDFont && fontRef._encodeText) {
        fontRefEncoder = fontRef._encodeText;
      }
    } else {
      fontName = (effectiveFont as string | undefined) ?? 'F1';
    }

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    // Colour
    if (effectiveColor) {
      this.ops += applyFillColor(effectiveColor);
    }

    this.ops += beginText();
    this.ops += setFont(fontName, size);

    if (options.rotate) {
      const rad = toRadians(options.rotate);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      this.ops += setTextMatrix(cos, sin, -sin, cos, x, y);
    } else {
      this.ops += moveText(x, y);
    }

    // Check if this font is CID-encoded (TrueType)
    // Prefer the encoder from the FontRef object, fall back to registered CID encoders
    const cidEncoder = fontRefEncoder ?? this.cidFontEncoders.get(fontName);

    // Split multi-line text (respecting explicit newlines)
    const rawLines = text.split('\n');

    // Apply word-wrapping when maxWidth is specified
    const lines: string[] = [];
    if (options.maxWidth !== undefined && options.maxWidth > 0) {
      const fontForWrapping = (effectiveFont && typeof effectiveFont === 'object' && 'name' in effectiveFont)
        ? effectiveFont as FontRef
        : fontName;
      for (const rawLine of rawLines) {
        const wrapped = wrapText(rawLine, options.maxWidth, fontForWrapping, size);
        lines.push(...wrapped);
      }
    } else {
      lines.push(...rawLines);
    }

    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        this.ops += setLeading(lineHeight);
        this.ops += nextLine();
      }
      if (cidEncoder) {
        this.ops += showTextHex(cidEncoder(lines[i]!));
      } else {
        this.ops += showText(lines[i]!);
      }
    }

    this.ops += endText();
    this.ops += restoreState();
  }

  // -----------------------------------------------------------------------
  // Drawing: Images
  // -----------------------------------------------------------------------

  /**
   * Draw an embedded image on this page.
   *
   * @param image    Image reference returned by `doc.embedPng()` or
   *                 `doc.embedJpeg()`.
   * @param options  Position, dimensions, rotation.
   */
  drawImage(image: ImageRef, options: DrawImageOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const width = options.width ?? image.width;
    const height = options.height ?? image.height;

    // Ensure the image is registered on this page
    this.registerXObject(image.name, image.ref);

    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');

    if (options.rotate) {
      this.ops += saveState();
      // Opacity and/or blend mode (via ExtGState)
      if (needsGS) {
        const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
        this.ops += setGraphicsState(gsName);
      }
      const rad = toRadians(options.rotate);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Translate to position, rotate, then scale
      this.ops += concatMatrix(
        cos * width,
        sin * width,
        -sin * height,
        cos * height,
        x,
        y,
      );
      this.ops += drawXObject(image.name);
      this.ops += restoreState();
    } else if (needsGS) {
      this.ops += saveState();
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
      this.ops += drawImageXObject(image.name, x, y, width, height);
      this.ops += restoreState();
    } else {
      this.ops += drawImageXObject(image.name, x, y, width, height);
    }
  }

  // -----------------------------------------------------------------------
  // Drawing: Embedded pages
  // -----------------------------------------------------------------------

  /**
   * Draw an embedded PDF page (Form XObject) on this page.
   *
   * The embedded page is painted at the given position and scaled to the
   * specified dimensions.  If `width` or `height` is omitted, the
   * original page dimensions are used.
   *
   * @param embeddedPage  An embedded page returned by `doc.embedPdf()` or
   *                      `doc.embedPage()`.
   * @param options       Position, dimensions, rotation, opacity.
   *
   * @example
   * ```ts
   * const [embedded] = await doc.embedPdf(otherPdfBytes, [0]);
   * page.drawPage(embedded, { x: 50, y: 50, width: 300, height: 400 });
   * ```
   */
  drawPage(embeddedPage: EmbeddedPdfPage, options: DrawPageOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const width = options.width ?? embeddedPage.width;
    const height = options.height ?? embeddedPage.height;

    // Ensure the form XObject is registered on this page
    this.registerXObject(embeddedPage.name, embeddedPage.ref);

    // Scale factors: the Form XObject's BBox defines its native size,
    // so we scale from [width, height] to [targetWidth, targetHeight].
    const scaleX = width / embeddedPage.width;
    const scaleY = height / embeddedPage.height;

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    if (options.rotate) {
      const rad = toRadians(options.rotate);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Combined matrix: translate(x,y) * rotate * scale
      this.ops += concatMatrix(
        cos * scaleX,
        sin * scaleX,
        -sin * scaleY,
        cos * scaleY,
        x,
        y,
      );
    } else {
      // Simple translate + scale
      this.ops += concatMatrix(scaleX, 0, 0, scaleY, x, y);
    }

    this.ops += drawXObject(embeddedPage.name);
    this.ops += restoreState();
  }

  // -----------------------------------------------------------------------
  // Drawing: Shapes
  // -----------------------------------------------------------------------

  /**
   * Draw a rectangle.
   *
   * By default the rectangle is filled with black.  Set `color` to
   * `undefined` and provide `borderColor` for stroke-only.
   */
  drawRectangle(options: DrawRectangleOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const w = options.width ?? 150;
    const h = options.height ?? 100;
    const hasFill = options.color !== undefined;
    const hasStroke = options.borderColor !== undefined;

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    if (options.borderWidth !== undefined) {
      this.ops += setLineWidth(options.borderWidth);
    }
    if (hasFill) {
      this.ops += applyFillColor(options.color!);
    }
    if (hasStroke) {
      this.ops += applyStrokeColor(options.borderColor!);
    }

    if (options.rotate) {
      // Rotate about the rectangle's centre
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rad = toRadians(options.rotate);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const tx = cx - cos * cx + sin * cy;
      const ty = cy - sin * cx - cos * cy;
      this.ops += concatMatrix(cos, sin, -sin, cos, tx, ty);
    }

    this.ops += rectangle(x, y, w, h);

    if (hasFill && hasStroke) {
      this.ops += fillAndStroke();
    } else if (hasFill) {
      this.ops += fill();
    } else if (hasStroke) {
      this.ops += stroke();
    } else {
      // Default: fill with current colour
      this.ops += fill();
    }

    this.ops += restoreState();
  }

  /**
   * Draw a square (convenience wrapper around {@link drawRectangle}).
   *
   * @param options  Position, size, colours, rotation, opacity, blend mode.
   */
  drawSquare(options: DrawSquareOptions = {}): void {
    const s = options.size ?? 100;
    this.drawRectangle({
      x: options.x,
      y: options.y,
      width: s,
      height: s,
      color: options.color,
      borderColor: options.borderColor,
      borderWidth: options.borderWidth,
      rotate: options.rotate,
      opacity: options.opacity,
      blendMode: options.blendMode,
    });
  }

  /**
   * Draw a straight line.
   */
  drawLine(options: DrawLineOptions): void {
    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    if (options.color) {
      this.ops += applyStrokeColor(options.color);
    }
    if (options.thickness !== undefined) {
      this.ops += setLineWidth(options.thickness);
    }
    if (options.dashArray) {
      this.ops += setDashPattern(options.dashArray, options.dashPhase ?? 0);
    }

    this.ops += moveTo(options.start.x, options.start.y);
    this.ops += lineTo(options.end.x, options.end.y);
    this.ops += stroke();

    this.ops += restoreState();
  }

  /**
   * Draw a circle.
   */
  drawCircle(options: DrawCircleOptions = {}): void {
    const cx = options.x ?? 0;
    const cy = options.y ?? 0;
    const r = options.radius ?? options.size ?? 50;
    const hasFill = options.color !== undefined;
    const hasStroke = options.borderColor !== undefined;

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    if (options.borderWidth !== undefined) {
      this.ops += setLineWidth(options.borderWidth);
    }
    if (hasFill) {
      this.ops += applyFillColor(options.color!);
    }
    if (hasStroke) {
      this.ops += applyStrokeColor(options.borderColor!);
    }

    this.ops += circlePath(cx, cy, r);

    if (hasFill && hasStroke) {
      this.ops += fillAndStroke();
    } else if (hasFill) {
      this.ops += fill();
    } else if (hasStroke) {
      this.ops += stroke();
    } else {
      this.ops += fill();
    }

    this.ops += restoreState();
  }

  /**
   * Draw an ellipse.
   */
  drawEllipse(options: DrawEllipseOptions = {}): void {
    const cx = options.x ?? 0;
    const cy = options.y ?? 0;
    const rx = options.xScale ?? 100;
    const ry = options.yScale ?? 50;
    const hasFill = options.color !== undefined;
    const hasStroke = options.borderColor !== undefined;

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    if (options.borderWidth !== undefined) {
      this.ops += setLineWidth(options.borderWidth);
    }
    if (hasFill) {
      this.ops += applyFillColor(options.color!);
    }
    if (hasStroke) {
      this.ops += applyStrokeColor(options.borderColor!);
    }

    this.ops += ellipsePath(cx, cy, rx, ry);

    if (hasFill && hasStroke) {
      this.ops += fillAndStroke();
    } else if (hasFill) {
      this.ops += fill();
    } else if (hasStroke) {
      this.ops += stroke();
    } else {
      this.ops += fill();
    }

    this.ops += restoreState();
  }

  // -----------------------------------------------------------------------
  // Graphics state
  // -----------------------------------------------------------------------

  /**
   * Push the current graphics state onto the stack (`q`).
   *
   * Must be balanced with a matching {@link popGraphicsState} call.
   */
  pushGraphicsState(): void {
    this.ops += saveState();
  }

  /**
   * Pop the most recently saved graphics state (`Q`).
   */
  popGraphicsState(): void {
    this.ops += restoreState();
  }

  /**
   * Concatenate an arbitrary transformation matrix with the CTM (`cm`).
   *
   * @param a   Horizontal scaling / rotation.
   * @param b   Rotation / skew.
   * @param c   Rotation / skew.
   * @param d   Vertical scaling / rotation.
   * @param tx  Horizontal translation.
   * @param ty  Vertical translation.
   */
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    tx: number,
    ty: number,
  ): void {
    this.ops += concatMatrix(a, b, c, d, tx, ty);
  }

  // -----------------------------------------------------------------------
  // Low-level: raw operator injection
  // -----------------------------------------------------------------------

  /**
   * Append raw PDF operator string(s) to the content stream.
   *
   * Use with caution — no validation is performed.
   */
  pushOperators(operators: string): void {
    this.ops += operators;
  }

  // -----------------------------------------------------------------------
  // Page geometry
  // -----------------------------------------------------------------------

  /**
   * Get the current page rotation in degrees.
   * @returns The rotation angle (0, 90, 180, or 270).
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set the page rotation in degrees.
   *
   * @param angle  Must be 0, 90, 180, or 270.
   * @internal
   */
  setRotation(angle: number): void {
    this.rotation = angle;
  }

  // -----------------------------------------------------------------------
  // Dimension convenience methods
  // -----------------------------------------------------------------------

  /** Get the page width in points. Alias for the `width` getter. */
  getWidth(): number {
    return this.mediaWidth;
  }

  /** Get the page height in points. Alias for the `height` getter. */
  getHeight(): number {
    return this.mediaHeight;
  }

  /** Set the page width in points. */
  setWidth(w: number): void {
    this.mediaWidth = w;
  }

  /** Set the page height in points. */
  setHeight(h: number): void {
    this.mediaHeight = h;
  }

  /** Set both page width and height in points. */
  setSize(w: number, h: number): void {
    this.mediaWidth = w;
    this.mediaHeight = h;
  }

  /** Get the page width and height as an object. */
  getSize(): { width: number; height: number } {
    return { width: this.mediaWidth, height: this.mediaHeight };
  }

  // -----------------------------------------------------------------------
  // PDF box getters / setters (PDF spec 14.11.2)
  // -----------------------------------------------------------------------

  /** Get the media box for this page. */
  getMediaBox(): { x: number; y: number; width: number; height: number } {
    return { x: this.mediaX, y: this.mediaY, width: this.mediaWidth, height: this.mediaHeight };
  }

  /** Set the media box (page dimensions) for this page. */
  setMediaBox(x: number, y: number, width: number, height: number): void {
    this.mediaX = x;
    this.mediaY = y;
    this.mediaWidth = width;
    this.mediaHeight = height;
  }

  /** Get the crop box if set, or undefined. */
  getCropBox(): { x: number; y: number; width: number; height: number } | undefined {
    if (this.cropBox === undefined) return undefined;
    const [llx, lly, urx, ury] = this.cropBox;
    return { x: llx, y: lly, width: urx - llx, height: ury - lly };
  }

  /** Set the crop box for this page. */
  setCropBox(x: number, y: number, width: number, height: number): void {
    this.cropBox = [x, y, x + width, y + height];
  }

  /** Get the bleed box if set, or undefined. */
  getBleedBox(): { x: number; y: number; width: number; height: number } | undefined {
    if (this.bleedBox === undefined) return undefined;
    const [llx, lly, urx, ury] = this.bleedBox;
    return { x: llx, y: lly, width: urx - llx, height: ury - lly };
  }

  /** Set the bleed box for this page. */
  setBleedBox(x: number, y: number, width: number, height: number): void {
    this.bleedBox = [x, y, x + width, y + height];
  }

  /** Get the trim box if set, or undefined. */
  getTrimBox(): { x: number; y: number; width: number; height: number } | undefined {
    if (this.trimBox === undefined) return undefined;
    const [llx, lly, urx, ury] = this.trimBox;
    return { x: llx, y: lly, width: urx - llx, height: ury - lly };
  }

  /** Set the trim box for this page. */
  setTrimBox(x: number, y: number, width: number, height: number): void {
    this.trimBox = [x, y, x + width, y + height];
  }

  /** Get the art box if set, or undefined. */
  getArtBox(): { x: number; y: number; width: number; height: number } | undefined {
    if (this.artBox === undefined) return undefined;
    const [llx, lly, urx, ury] = this.artBox;
    return { x: llx, y: lly, width: urx - llx, height: ury - lly };
  }

  /** Set the art box for this page. */
  setArtBox(x: number, y: number, width: number, height: number): void {
    this.artBox = [x, y, x + width, y + height];
  }

  // -----------------------------------------------------------------------
  // Accessibility: marked content
  // -----------------------------------------------------------------------

  /**
   * Alt text entries for images, keyed by image resource name.
   * Used during structure tree serialization.
   * @internal
   */
  private readonly imageAltTexts = new Map<string, string>();

  /**
   * Wrap the current content-stream operators in a marked-content
   * sequence.
   *
   * This wraps ALL currently accumulated content in a BDC/EMC pair
   * with the given structure tag and marked-content ID (MCID).  The
   * MCID links the content to a structure element in the document's
   * structure tree.
   *
   * Call this after adding content to the page and before adding
   * more content that belongs to a different structure element.
   *
   * @param tag   The structure type tag (e.g. `"P"`, `"H1"`, `"Span"`).
   * @param mcid  The marked-content ID assigned by the structure tree.
   */
  markContent(tag: StructureType, mcid: number): void {
    // Wrap existing content in marked-content operators
    this.ops = wrapInMarkedContent(this.ops, tag, mcid);
  }

  /**
   * Begin a marked-content sequence in the content stream.
   *
   * Must be paired with a call to {@link endMarkedContentSequence}.
   * Content added between the two calls will be associated with the
   * given structure element.
   *
   * @param tag   The structure type tag.
   * @param mcid  The marked-content ID.
   */
  beginMarkedContent(tag: StructureType, mcid: number): void {
    this.ops += beginMarkedContentSequence(tag, mcid);
  }

  /**
   * End a marked-content sequence in the content stream.
   *
   * Must be preceded by a call to {@link beginMarkedContent}.
   */
  endMarkedContentSequence(): void {
    this.ops += endMarkedContent();
  }

  /**
   * Associate alt text with an image reference on this page.
   *
   * The alt text is stored and used during structure tree serialization
   * to create a Figure structure element with the `/Alt` attribute.
   *
   * @param imageRef  The image reference returned by `doc.embedPng()`
   *                  or `doc.embedJpeg()`.
   * @param altText   The alternative text describing the image.
   */
  addAltText(imageRef: ImageRef, altText: string): void {
    this.imageAltTexts.set(imageRef.name, altText);
  }

  /**
   * Get the alt text for an image, if set.
   *
   * @param imageRef  The image reference.
   * @returns         The alt text, or `undefined`.
   */
  getAltText(imageRef: ImageRef): string | undefined {
    return this.imageAltTexts.get(imageRef.name);
  }

  // -----------------------------------------------------------------------
  // Annotations
  // -----------------------------------------------------------------------

  /**
   * Annotations on this page.
   * @internal
   */
  private readonly annotations: PdfAnnotation[] = [];

  /**
   * Get all annotations on this page.
   *
   * @returns An array of PdfAnnotation instances.
   */
  getAnnotations(): PdfAnnotation[] {
    return [...this.annotations];
  }

  /**
   * Add an annotation to this page.
   *
   * @param type     The annotation subtype.
   * @param options  Annotation options (rect, contents, color, etc.).
   * @returns        The created PdfAnnotation.
   */
  addAnnotation(type: AnnotationType, options: AnnotationOptions): PdfAnnotation {
    const annot = createAnnotation(type, options);
    this.annotations.push(annot);
    return annot;
  }

  /**
   * Add a pre-created annotation to this page.
   *
   * @param annotation The annotation to add.
   * @internal
   */
  addExistingAnnotation(annotation: PdfAnnotation): void {
    this.annotations.push(annotation);
  }

  /**
   * Remove an annotation from this page.
   *
   * @param annotation The annotation to remove.
   */
  removeAnnotation(annotation: PdfAnnotation): void {
    const idx = this.annotations.indexOf(annotation);
    if (idx === -1) {
      throw new Error('Annotation is not on this page');
    }
    this.annotations.splice(idx, 1);
  }

  /**
   * Flatten all annotations into the page content stream.
   *
   * After flattening, annotations are rendered as part of the page
   * content and are no longer interactive.  The annotations are
   * removed from the page's annotation list.
   */
  flattenAnnotations(): void {
    for (const annot of this.annotations) {
      const ap = annot.generateAppearance();
      if (ap) {
        // Get the annotation rect and render the appearance stream content
        // into the page content stream at the annotation's position
        const rect = annot.getRect();
        const [x1, y1, x2, y2] = rect;
        const w = x2 - x1;
        const h = y2 - y1;

        if (w > 0 && h > 0) {
          this.ops += saveState();
          this.ops += concatMatrix(1, 0, 0, 1, x1, y1);
          // Extract content from the appearance stream
          const decoder = new TextDecoder();
          const content = decoder.decode(ap.data);
          this.ops += content;
          this.ops += restoreState();
        }
      }
    }
    // Clear all annotations after flattening
    this.annotations.length = 0;
  }

  /**
   * @internal Get annotation refs for the page dictionary /Annots array.
   */
  getAnnotationRefs(registry: PdfObjectRegistry): PdfRef[] {
    const refs: PdfRef[] = [];
    for (const annot of this.annotations) {
      const dict = annot.toDict(registry);
      // Set page reference on annotation
      dict.set('/P', this.pageRef);
      const ref = registry.register(dict);
      refs.push(ref);
    }
    return refs;
  }

  // -----------------------------------------------------------------------
  // SVG drawing
  // -----------------------------------------------------------------------

  /**
   * Draw an SVG image onto this page.
   *
   * @param svgString  The SVG markup string.
   * @param options    Rendering options (position, size).
   */
  drawSvg(svgString: string, options?: SvgRenderOptions): void {
    drawSvgOnPage(this, svgString, options);
  }

  /**
   * Draw an SVG path data string onto this page.
   *
   * The `pathData` parameter uses the same syntax as the SVG `<path d="...">`
   * attribute (M, L, C, Q, H, V, S, T, A, Z commands).
   *
   * **Important:** SVG path coordinates use a top-down Y axis.  This
   * method applies a Y-axis flip so that the path renders correctly in
   * PDF's bottom-up coordinate system.  The `x` / `y` options position
   * the origin of the path in PDF space.
   *
   * @param pathData  SVG path data string (e.g. `"M 0 0 L 100 0 L 100 100 Z"`).
   * @param options   Drawing options (position, scale, colours).
   */
  drawSvgPath(pathData: string, options: DrawSvgPathOptions = {}): void {
    const commands = parseSvgPath(pathData);
    if (commands.length === 0) return;

    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const scaleFactor = options.scale ?? 1;
    const hasFill = options.color !== undefined;
    const hasStroke = options.borderColor !== undefined;

    this.ops += saveState();

    // Opacity and/or blend mode (via ExtGState)
    const needsGS = (options.opacity !== undefined && options.opacity < 1) ||
                    (options.blendMode !== undefined && options.blendMode !== 'Normal');
    if (needsGS) {
      const gsName = this.getOrCreateExtGState(options.opacity, options.blendMode);
      this.ops += setGraphicsState(gsName);
    }

    // Transform: translate to (x, y), flip Y axis, and scale.
    // SVG Y-axis points down, PDF Y-axis points up.
    // Combined matrix: translate(x, y) * scale(scaleFactor, -scaleFactor)
    // This gives matrix [s, 0, 0, -s, x, y].
    this.ops += concatMatrix(scaleFactor, 0, 0, -scaleFactor, x, y);

    if (options.borderWidth !== undefined) {
      this.ops += setLineWidth(options.borderWidth);
    }
    if (hasFill) {
      this.ops += applyFillColor(options.color!);
    }
    if (hasStroke) {
      this.ops += applyStrokeColor(options.borderColor!);
    }

    // Emit path operators from parsed SVG commands
    this.ops += svgCommandsToPdfOps(commands);

    // Painting operator
    if (hasFill && hasStroke) {
      this.ops += fillAndStroke();
    } else if (hasStroke) {
      this.ops += stroke();
    } else {
      // Default: fill (matches SVG default behaviour)
      this.ops += fill();
    }

    this.ops += restoreState();
  }

  // -----------------------------------------------------------------------
  // Layers (Optional Content)
  // -----------------------------------------------------------------------

  /**
   * Begin layer-specific content.
   *
   * Content drawn after this call and before {@link endLayer} will be
   * associated with the given layer and can be shown/hidden by the
   * viewer.
   *
   * @param layer  The layer to begin.
   */
  beginLayer(layer: PdfLayer): void {
    this.ops += beginLayerContent(layer);
  }

  /**
   * End layer-specific content.
   *
   * Must be preceded by a call to {@link beginLayer}.
   */
  endLayer(): void {
    this.ops += endLayerContent();
  }

  // -----------------------------------------------------------------------
  // Redaction
  // -----------------------------------------------------------------------

  /**
   * Mark a rectangular region on this page for redaction.
   *
   * The mark is stored but not applied until `doc.applyRedactions()`
   * is called.
   *
   * @param rect     The region to redact: [x, y, width, height].
   * @param options  Additional redaction options (overlay text, colour).
   */
  markForRedaction(
    rect: [number, number, number, number],
    options?: Partial<RedactionOptions>,
  ): void {
    markForRedaction(this, {
      rect,
      ...(options?.overlayText !== undefined ? { overlayText: options.overlayText } : {}),
      ...(options?.color !== undefined ? { color: options.color } : {}),
    });
  }

  // -----------------------------------------------------------------------
  // Materialisation (called by PdfDocument.save)
  // -----------------------------------------------------------------------

  /** @internal Return the accumulated operator string. */
  getContentStreamData(): string {
    return this.ops;
  }

  /** @internal Return the original content-stream refs from a loaded PDF. */
  getOriginalContentRefs(): readonly PdfRef[] {
    return this._originalContentRefs;
  }

  /** @internal Return the original resources dict from a loaded PDF. */
  getOriginalResources(): PdfDict | undefined {
    return this._originalResources;
  }

  /** @internal Return the object registry for this page. */
  getRegistry(): PdfObjectRegistry {
    return this.registry;
  }

  /**
   * @internal Build the `/Resources` dictionary for this page.
   */
  buildResources(): PdfDict {
    // If we have original resources from a loaded PDF, use them as the base
    // and merge any newly added resources on top.
    if (this._originalResources) {
      return this._mergeResources();
    }

    // No original resources — build from scratch (new page)
    const resources = new PdfDict();

    // Font resources
    if (this.fonts.size > 0) {
      const fontDict = new PdfDict();
      for (const [name, ref] of this.fonts) {
        fontDict.set(name, ref);
      }
      resources.set('/Font', fontDict);
    }

    // XObject resources (images)
    if (this.xObjects.size > 0) {
      const xObjDict = new PdfDict();
      for (const [name, ref] of this.xObjects) {
        xObjDict.set(name, ref);
      }
      resources.set('/XObject', xObjDict);
    }

    // ExtGState resources (opacity / graphics state)
    if (this.extGStates.size > 0) {
      const gsDict = new PdfDict();
      for (const [name, ref] of this.extGStates) {
        gsDict.set(name, ref);
      }
      resources.set('/ExtGState', gsDict);
    }

    // ProcSet — recommended for compatibility
    resources.set(
      '/ProcSet',
      PdfArray.of([
        PdfName.of('PDF'),
        PdfName.of('Text'),
        PdfName.of('ImageB'),
        PdfName.of('ImageC'),
        PdfName.of('ImageI'),
      ]),
    );

    return resources;
  }

  /**
   * @internal Merge original resources from a loaded PDF with any newly
   * added resources (fonts, images, graphics states).
   *
   * The original resources dict is used as the base. New entries are
   * added into the appropriate sub-dictionaries (e.g. /Font, /XObject).
   */
  private _mergeResources(): PdfDict {
    // The original resources dict is the base — we return it directly
    // with new entries merged in. This preserves all original entries
    // including /ColorSpace, /Pattern, /Shading, /Properties, etc.
    const resources = this._originalResources!;

    // Merge new font resources
    if (this.fonts.size > 0) {
      let fontObj = resources.get('/Font');
      if (fontObj === undefined || fontObj.kind !== 'dict') {
        fontObj = new PdfDict();
        resources.set('/Font', fontObj);
      }
      const fontDict = fontObj as PdfDict;
      for (const [name, ref] of this.fonts) {
        fontDict.set(name, ref);
      }
    }

    // Merge new XObject resources
    if (this.xObjects.size > 0) {
      let xObjObj = resources.get('/XObject');
      if (xObjObj === undefined || xObjObj.kind !== 'dict') {
        xObjObj = new PdfDict();
        resources.set('/XObject', xObjObj);
      }
      const xObjDict = xObjObj as PdfDict;
      for (const [name, ref] of this.xObjects) {
        xObjDict.set(name, ref);
      }
    }

    // Merge new ExtGState resources
    if (this.extGStates.size > 0) {
      let gsObj = resources.get('/ExtGState');
      if (gsObj === undefined || gsObj.kind !== 'dict') {
        gsObj = new PdfDict();
        resources.set('/ExtGState', gsObj);
      }
      const gsDict = gsObj as PdfDict;
      for (const [name, ref] of this.extGStates) {
        gsDict.set(name, ref);
      }
    }

    return resources;
  }

  /**
   * @internal Finalize this page: create the content stream object and
   * register it in the object registry.  Returns a {@link PageEntry}
   * compatible with {@link buildPageTree}.
   */
  finalize(): {
    pageRef: PdfRef;
    mediaBox: readonly [number, number, number, number];
    width: number;
    height: number;
    contentStreamRefs: PdfRef | readonly PdfRef[];
    resources: PdfDict;
    rotation?: number | undefined;
    cropBox?: readonly [number, number, number, number] | undefined;
    bleedBox?: readonly [number, number, number, number] | undefined;
    artBox?: readonly [number, number, number, number] | undefined;
    trimBox?: readonly [number, number, number, number] | undefined;
    annotationRefs?: PdfRef[] | undefined;
  } {
    // Determine content stream reference(s)
    let contentStreamRefs: PdfRef | readonly PdfRef[];

    const hasOriginal = this._originalContentRefs.length > 0;
    const hasNew = this.ops.length > 0;

    if (hasOriginal && hasNew) {
      // Loaded page with new content appended — combine original + new
      const newStream = PdfStream.fromString(this.ops);
      this.registry.assign(this.contentStreamRef, newStream);
      contentStreamRefs = [...this._originalContentRefs, this.contentStreamRef];
    } else if (hasOriginal) {
      // Loaded page with no modifications — use original refs directly
      contentStreamRefs = this._originalContentRefs.length === 1
        ? this._originalContentRefs[0]!
        : this._originalContentRefs;
    } else {
      // New page (or empty) — current behavior
      const stream = PdfStream.fromString(this.ops);
      this.registry.assign(this.contentStreamRef, stream);
      contentStreamRefs = this.contentStreamRef;
    }

    // Combine original annotation refs with newly created ones
    const annotRefs: PdfRef[] = [...this._originalAnnotRefs];
    if (this.annotations.length > 0) {
      annotRefs.push(...this.getAnnotationRefs(this.registry));
    }

    return {
      pageRef: this.pageRef,
      mediaBox: [this.mediaX, this.mediaY, this.mediaX + this.mediaWidth, this.mediaY + this.mediaHeight] as const,
      width: this.width,
      height: this.height,
      contentStreamRefs,
      resources: this.buildResources(),
      rotation: this.rotation !== 0 ? this.rotation : undefined,
      cropBox: this.cropBox,
      bleedBox: this.bleedBox,
      artBox: this.artBox,
      trimBox: this.trimBox,
      annotationRefs: annotRefs.length > 0 ? annotRefs : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// SVG path -> PDF operators helper
// ---------------------------------------------------------------------------

/** Format a number for PDF output. */
function fmtN(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Magic constant for circular arc approximation: 4*(sqrt(2)-1)/3. */
const KAPPA = 0.5522847498;

/**
 * Approximate an SVG arc command as cubic Bezier curve(s) (PDF operators).
 *
 * SVG arcs use endpoint parameterization; PDF has no native arc command.
 */
function svgArcToPdfOps(
  fromX: number, fromY: number,
  rx0: number, ry0: number,
  rotationDeg: number, largeArcFlag: number, sweepFlag: number,
  toX: number, toY: number,
): string {
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (rx === 0 || ry === 0) return `${fmtN(toX)} ${fmtN(toY)} l\n`;

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (fromX - toX) / 2;
  const dy2 = (fromY - toY) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s; rxSq = rx * rx; rySq = ry * ry;
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) /
           (rxSq * y1pSq + rySq * x1pSq);
  if (sq < 0) sq = 0;
  sq = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) sq = -sq;

  const cxp = sq * rx * y1p / ry;
  const cyp = -sq * ry * x1p / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (fromX + toX) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (fromY + toY) / 2;

  function vecAngle(ux: number, uy: number, vx: number, vy: number): number {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    let r = (ux * vx + uy * vy) / (Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy));
    if (r < -1) r = -1; if (r > 1) r = 1;
    return sign * Math.acos(r);
  }

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vecAngle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry,
  );
  if (sweepFlag === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  const segs = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segAngle = dTheta / segs;
  let ops = '';
  let angle = theta1;
  for (let i = 0; i < segs; i++) {
    const a1 = angle;
    const a2 = angle + segAngle;
    const alpha = (4 / 3) * Math.tan((a2 - a1) / 4);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
    const ep1x = cosPhi * rx * cos1 - sinPhi * ry * sin1 + cx;
    const ep1y = sinPhi * rx * cos1 + cosPhi * ry * sin1 + cy;
    const cp1x = ep1x + alpha * (-cosPhi * rx * sin1 - sinPhi * ry * cos1);
    const cp1y = ep1y + alpha * (-sinPhi * rx * sin1 + cosPhi * ry * cos1);
    const ep2x = cosPhi * rx * cos2 - sinPhi * ry * sin2 + cx;
    const ep2y = sinPhi * rx * cos2 + cosPhi * ry * sin2 + cy;
    const cp2x = ep2x - alpha * (-cosPhi * rx * sin2 - sinPhi * ry * cos2);
    const cp2y = ep2y - alpha * (-sinPhi * rx * sin2 + cosPhi * ry * cos2);
    ops += `${fmtN(cp1x)} ${fmtN(cp1y)} ${fmtN(cp2x)} ${fmtN(cp2y)} ${fmtN(ep2x)} ${fmtN(ep2y)} c\n`;
    angle = a2;
  }
  return ops;
}

/**
 * Convert parsed SVG draw commands into PDF path construction operators.
 *
 * Does **not** emit painting operators (fill / stroke) -- the caller
 * is responsible for that.
 */
function svgCommandsToPdfOps(commands: SvgDrawCommand[]): string {
  let ops = '';
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'moveTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${fmtN(curX)} ${fmtN(curY)} m\n`;
        break;

      case 'lineTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${fmtN(curX)} ${fmtN(curY)} l\n`;
        break;

      case 'curveTo':
        ops += `${fmtN(cmd.params[0]!)} ${fmtN(cmd.params[1]!)} ${fmtN(cmd.params[2]!)} ${fmtN(cmd.params[3]!)} ${fmtN(cmd.params[4]!)} ${fmtN(cmd.params[5]!)} c\n`;
        curX = cmd.params[4]!;
        curY = cmd.params[5]!;
        break;

      case 'quadCurveTo': {
        // Convert quadratic Bezier to cubic Bezier
        const cpx = cmd.params[0]!;
        const cpy = cmd.params[1]!;
        const toX = cmd.params[2]!;
        const toY = cmd.params[3]!;
        const cp1x = curX + (2 / 3) * (cpx - curX);
        const cp1y = curY + (2 / 3) * (cpy - curY);
        const cp2x = toX + (2 / 3) * (cpx - toX);
        const cp2y = toY + (2 / 3) * (cpy - toY);
        ops += `${fmtN(cp1x)} ${fmtN(cp1y)} ${fmtN(cp2x)} ${fmtN(cp2y)} ${fmtN(toX)} ${fmtN(toY)} c\n`;
        curX = toX;
        curY = toY;
        break;
      }

      case 'closePath':
        ops += 'h\n';
        break;

      case 'rect':
        ops += `${fmtN(cmd.params[0]!)} ${fmtN(cmd.params[1]!)} ${fmtN(cmd.params[2]!)} ${fmtN(cmd.params[3]!)} re\n`;
        break;

      case 'circle': {
        const ccx = cmd.params[0]!, ccy = cmd.params[1]!, r = cmd.params[2]!;
        const ox = r * KAPPA, oy = r * KAPPA;
        ops += `${fmtN(ccx)} ${fmtN(ccy + r)} m\n`;
        ops += `${fmtN(ccx + ox)} ${fmtN(ccy + r)} ${fmtN(ccx + r)} ${fmtN(ccy + oy)} ${fmtN(ccx + r)} ${fmtN(ccy)} c\n`;
        ops += `${fmtN(ccx + r)} ${fmtN(ccy - oy)} ${fmtN(ccx + ox)} ${fmtN(ccy - r)} ${fmtN(ccx)} ${fmtN(ccy - r)} c\n`;
        ops += `${fmtN(ccx - ox)} ${fmtN(ccy - r)} ${fmtN(ccx - r)} ${fmtN(ccy - oy)} ${fmtN(ccx - r)} ${fmtN(ccy)} c\n`;
        ops += `${fmtN(ccx - r)} ${fmtN(ccy + oy)} ${fmtN(ccx - ox)} ${fmtN(ccy + r)} ${fmtN(ccx)} ${fmtN(ccy + r)} c\n`;
        break;
      }

      case 'ellipse': {
        const ecx = cmd.params[0]!, ecy = cmd.params[1]!;
        const erx = cmd.params[2]!, ery = cmd.params[3]!;
        const eox = erx * KAPPA, eoy = ery * KAPPA;
        ops += `${fmtN(ecx)} ${fmtN(ecy + ery)} m\n`;
        ops += `${fmtN(ecx + eox)} ${fmtN(ecy + ery)} ${fmtN(ecx + erx)} ${fmtN(ecy + eoy)} ${fmtN(ecx + erx)} ${fmtN(ecy)} c\n`;
        ops += `${fmtN(ecx + erx)} ${fmtN(ecy - eoy)} ${fmtN(ecx + eox)} ${fmtN(ecy - ery)} ${fmtN(ecx)} ${fmtN(ecy - ery)} c\n`;
        ops += `${fmtN(ecx - eox)} ${fmtN(ecy - ery)} ${fmtN(ecx - erx)} ${fmtN(ecy - eoy)} ${fmtN(ecx - erx)} ${fmtN(ecy)} c\n`;
        ops += `${fmtN(ecx - erx)} ${fmtN(ecy + eoy)} ${fmtN(ecx - eox)} ${fmtN(ecy + ery)} ${fmtN(ecx)} ${fmtN(ecy + ery)} c\n`;
        break;
      }

      case 'arc':
        ops += svgArcToPdfOps(
          curX, curY,
          cmd.params[0]!, cmd.params[1]!, cmd.params[2]!,
          cmd.params[3]!, cmd.params[4]!,
          cmd.params[5]!, cmd.params[6]!,
        );
        curX = cmd.params[5]!;
        curY = cmd.params[6]!;
        break;
    }
  }

  return ops;
}

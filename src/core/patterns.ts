/**
 * @module core/patterns
 *
 * Gradient fills (linear & radial) and tiling patterns for PDF pages.
 *
 * Implements PDF specification section 8.7 (Patterns) and 8.6.3 (Shading).
 *
 * Usage:
 * ```ts
 * import { createPdf, linearGradient, rgb } from 'modern-pdf-lib';
 *
 * const doc = createPdf();
 * const page = doc.addPage([500, 500]);
 * const grad = linearGradient({
 *   x1: 0, y1: 0, x2: 200, y2: 0,
 *   stops: [rgb(1, 0, 0), rgb(0, 0, 1)],
 * });
 * page.drawGradient(grad, { x: 50, y: 50, width: 200, height: 100 });
 * ```
 *
 * Reference: PDF 1.7 spec, §8.7 (Patterns), §8.6.3 (Shading).
 */

import type { Color } from './operators/color.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
  PdfBool,
  PdfRef,
} from './pdfObjects.js';
import type { PdfObjectRegistry } from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A colour stop in a gradient, specifying the position (0..1) and colour.
 */
export interface ColorStop {
  readonly offset: number; // 0..1
  readonly color: Color;
}

/**
 * Options for creating a linear gradient (axial shading, ShadingType 2).
 */
export interface LinearGradientOptions {
  /** Start X coordinate. */
  readonly x1: number;
  /** Start Y coordinate. */
  readonly y1: number;
  /** End X coordinate. */
  readonly x2: number;
  /** End Y coordinate. */
  readonly y2: number;
  /**
   * Colour stops. Each element is either a bare {@link Color} (positions
   * are distributed evenly) or a {@link ColorStop} with an explicit offset.
   */
  readonly stops: readonly (Color | ColorStop)[];
  /**
   * Whether to extend the gradient beyond the start and end points.
   * Default: `true`.
   */
  readonly extend?: boolean;
}

/**
 * Options for creating a radial gradient (radial shading, ShadingType 3).
 */
export interface RadialGradientOptions {
  /** Centre X of the start circle. */
  readonly x0: number;
  /** Centre Y of the start circle. */
  readonly y0: number;
  /** Radius of the start circle. */
  readonly r0: number;
  /** Centre X of the end circle. */
  readonly x1: number;
  /** Centre Y of the end circle. */
  readonly y1: number;
  /** Radius of the end circle. */
  readonly r1: number;
  /**
   * Colour stops (same semantics as {@link LinearGradientOptions.stops}).
   */
  readonly stops: readonly (Color | ColorStop)[];
  /**
   * Whether to extend the gradient beyond the start and end circles.
   * Default: `true`.
   */
  readonly extend?: boolean;
}

/**
 * Options for creating a tiling pattern (PatternType 1).
 */
export interface TilingPatternOptions {
  /** Width of one tile in user-space units. */
  readonly width: number;
  /** Height of one tile in user-space units. */
  readonly height: number;
  /**
   * Paint type.
   * - `1` (default) — coloured: the pattern's content stream specifies
   *   its own colours.
   * - `2` — uncoloured: colours are supplied when the pattern is painted.
   */
  readonly paintType?: 1 | 2;
  /**
   * Tiling type.
   * - `1` (default) — constant spacing.
   * - `2` — no distortion.
   * - `3` — constant spacing and faster tiling.
   */
  readonly tilingType?: 1 | 2 | 3;
  /** Raw PDF content-stream operators that paint one tile. */
  readonly ops: string;
}

// ---------------------------------------------------------------------------
// Descriptor types (returned by factory functions)
// ---------------------------------------------------------------------------

/**
 * Descriptor for a gradient fill (linear or radial).
 * This is a lightweight value object — actual PDF objects are created
 * when {@link buildGradientObjects} is called.
 */
export interface GradientFill {
  readonly kind: 'gradient';
  readonly shadingType: 2 | 3;
  readonly coords: readonly number[];
  readonly normalizedStops: readonly NormalizedStop[];
  readonly extend: boolean;
}

/**
 * Descriptor for a radial gradient fill.
 * Structurally identical to {@link GradientFill} but with `shadingType: 3`.
 */
export type RadialGradientFill = GradientFill & { readonly shadingType: 3 };

/**
 * Descriptor for a tiling pattern fill.
 * This is a lightweight value object — actual PDF objects are created
 * when {@link buildPatternObjects} is called.
 */
export interface PatternFill {
  readonly kind: 'pattern';
  readonly width: number;
  readonly height: number;
  readonly paintType: 1 | 2;
  readonly tilingType: 1 | 2 | 3;
  readonly ops: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A normalised colour stop with explicit offset and RGB values. */
export interface NormalizedStop {
  readonly offset: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Color to RGB components (0..1). CMYK/gray are converted. */
function colorToRgb(c: Color): { r: number; g: number; b: number } {
  switch (c.type) {
    case 'rgb':
      return { r: c.r, g: c.g, b: c.b };
    case 'grayscale':
      return { r: c.gray, g: c.gray, b: c.gray };
    case 'cmyk': {
      // Standard CMYK → RGB conversion
      const r = (1 - c.c) * (1 - c.k);
      const g = (1 - c.m) * (1 - c.k);
      const b = (1 - c.y) * (1 - c.k);
      return { r, g, b };
    }
    default:
      // SpotColor / DeviceNColor — fall back to black
      return { r: 0, g: 0, b: 0 };
  }
}

/** Check if a stop is a ColorStop (has `offset` property). */
function isColorStop(stop: Color | ColorStop): stop is ColorStop {
  return 'offset' in stop && 'color' in stop;
}

/**
 * Normalise an array of stops into sorted, explicit-offset RGB stops.
 * Bare Color values get evenly-distributed offsets.
 */
function normalizeStops(stops: readonly (Color | ColorStop)[]): NormalizedStop[] {
  if (stops.length < 2) {
    throw new Error('Gradient requires at least 2 colour stops');
  }

  const result: NormalizedStop[] = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!;
    let offset: number;
    let color: Color;

    if (isColorStop(stop)) {
      offset = stop.offset;
      color = stop.color;
    } else {
      // Distribute evenly
      offset = i / (stops.length - 1);
      color = stop;
    }

    const { r, g, b } = colorToRgb(color);
    result.push({ offset, r, g, b });
  }

  // Sort by offset (stable sort)
  result.sort((a, b) => a.offset - b.offset);

  return result;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a linear (axial) gradient descriptor.
 *
 * The gradient runs from `(x1, y1)` to `(x2, y2)` through the given
 * colour stops.  By default the gradient extends beyond its endpoints.
 *
 * @param options  Gradient parameters.
 * @returns A {@link GradientFill} descriptor.
 */
export function linearGradient(options: LinearGradientOptions): GradientFill {
  const normalizedStops = normalizeStops(options.stops);
  return {
    kind: 'gradient',
    shadingType: 2,
    coords: [options.x1, options.y1, options.x2, options.y2],
    normalizedStops,
    extend: options.extend ?? true,
  };
}

/**
 * Create a radial gradient descriptor.
 *
 * The gradient interpolates between two circles: the start circle at
 * `(x0, y0)` with radius `r0` and the end circle at `(x1, y1)` with
 * radius `r1`.
 *
 * @param options  Gradient parameters.
 * @returns A {@link GradientFill} descriptor (with `shadingType: 3`).
 */
export function radialGradient(options: RadialGradientOptions): GradientFill {
  const normalizedStops = normalizeStops(options.stops);
  return {
    kind: 'gradient',
    shadingType: 3,
    coords: [options.x0, options.y0, options.r0, options.x1, options.y1, options.r1],
    normalizedStops,
    extend: options.extend ?? true,
  };
}

/**
 * Create a tiling pattern descriptor.
 *
 * @param options  Pattern parameters including the tile content stream.
 * @returns A {@link PatternFill} descriptor.
 */
export function tilingPattern(options: TilingPatternOptions): PatternFill {
  return {
    kind: 'pattern',
    width: options.width,
    height: options.height,
    paintType: options.paintType ?? 1,
    tilingType: options.tilingType ?? 1,
    ops: options.ops,
  };
}

// ---------------------------------------------------------------------------
// PDF object builders
// ---------------------------------------------------------------------------

/**
 * Build a Type 2 (exponential interpolation) function for a single
 * colour-transition segment between two RGB stops.
 */
function buildType2Function(
  c0: NormalizedStop,
  c1: NormalizedStop,
): PdfDict {
  const fn = new PdfDict();
  fn.set('/FunctionType', PdfNumber.of(2));
  fn.set('/Domain', PdfArray.fromNumbers([0, 1]));
  fn.set('/C0', PdfArray.fromNumbers([c0.r, c0.g, c0.b]));
  fn.set('/C1', PdfArray.fromNumbers([c1.r, c1.g, c1.b]));
  fn.set('/N', PdfNumber.of(1));
  return fn;
}

/**
 * Build the shading function for a gradient.
 *
 * - 2 stops → single Type 2 (exponential interpolation) function.
 * - 3+ stops → Type 3 (stitching) function wrapping one Type 2 per segment.
 */
function buildShadingFunction(
  stops: readonly NormalizedStop[],
  registry: PdfObjectRegistry,
): PdfRef {
  if (stops.length === 2) {
    // Simple 2-stop: single Type 2 function
    const fn = buildType2Function(stops[0]!, stops[1]!);
    return registry.register(fn);
  }

  // Multi-stop: Type 3 stitching function
  const stitchDict = new PdfDict();
  stitchDict.set('/FunctionType', PdfNumber.of(3));
  stitchDict.set('/Domain', PdfArray.fromNumbers([0, 1]));

  const subFunctions: PdfRef[] = [];
  const bounds: number[] = [];
  const encode: number[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const fn = buildType2Function(stops[i]!, stops[i + 1]!);
    subFunctions.push(registry.register(fn));

    // Bounds: the dividing points between segments (excluding first and last offset)
    if (i > 0) {
      bounds.push(stops[i]!.offset);
    }

    // Each sub-function maps its segment to [0, 1]
    encode.push(0, 1);
  }

  stitchDict.set('/Functions', PdfArray.of(subFunctions));
  stitchDict.set('/Bounds', PdfArray.fromNumbers(bounds));
  stitchDict.set('/Encode', PdfArray.fromNumbers(encode));

  return registry.register(stitchDict);
}

/**
 * Materialise a {@link GradientFill} descriptor into actual PDF objects
 * in the given registry.
 *
 * @param gradient  The gradient descriptor.
 * @param registry  The document's object registry.
 * @returns An object with the pattern's indirect reference and a unique
 *          resource name.
 */
export function buildGradientObjects(
  gradient: GradientFill,
  registry: PdfObjectRegistry,
): { patternRef: PdfRef; patternName: string } {
  // 1. Build the function
  const fnRef = buildShadingFunction(gradient.normalizedStops, registry);

  // 2. Build the Shading dictionary
  const shadingDict = new PdfDict();
  shadingDict.set('/ShadingType', PdfNumber.of(gradient.shadingType));
  shadingDict.set('/ColorSpace', PdfName.of('DeviceRGB'));
  shadingDict.set('/Coords', PdfArray.fromNumbers([...gradient.coords]));
  shadingDict.set('/Function', fnRef);
  shadingDict.set(
    '/Extend',
    PdfArray.of([PdfBool.of(gradient.extend), PdfBool.of(gradient.extend)]),
  );

  const shadingRef = registry.register(shadingDict);

  // 3. Build the Pattern dictionary (PatternType 2 = shading pattern)
  const patternDict = new PdfDict();
  patternDict.set('/Type', PdfName.of('Pattern'));
  patternDict.set('/PatternType', PdfNumber.of(2));
  patternDict.set('/Shading', shadingRef);

  const patternRef = registry.register(patternDict);

  // Generate a unique name based on the object number
  const patternName = `Pat${patternRef.objectNumber}`;

  return { patternRef, patternName };
}

/**
 * Materialise a {@link PatternFill} descriptor into actual PDF objects
 * in the given registry.
 *
 * @param pattern   The tiling pattern descriptor.
 * @param registry  The document's object registry.
 * @returns An object with the pattern's indirect reference and a unique
 *          resource name.
 */
export function buildPatternObjects(
  pattern: PatternFill,
  registry: PdfObjectRegistry,
): { patternRef: PdfRef; patternName: string } {
  // Build the pattern stream dict
  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Pattern'));
  dict.set('/PatternType', PdfNumber.of(1));
  dict.set('/PaintType', PdfNumber.of(pattern.paintType));
  dict.set('/TilingType', PdfNumber.of(pattern.tilingType));
  dict.set('/BBox', PdfArray.fromNumbers([0, 0, pattern.width, pattern.height]));
  dict.set('/XStep', PdfNumber.of(pattern.width));
  dict.set('/YStep', PdfNumber.of(pattern.height));

  // Resources dictionary (minimal — empty but required by spec)
  dict.set('/Resources', new PdfDict());

  const stream = PdfStream.fromString(pattern.ops, dict);
  const patternRef = registry.register(stream);

  const patternName = `Pat${patternRef.objectNumber}`;

  return { patternRef, patternName };
}

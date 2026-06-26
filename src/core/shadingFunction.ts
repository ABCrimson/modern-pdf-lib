/**
 * @module core/shadingFunction
 *
 * Function-based (type 1) shadings (ISO 32000-2 §8.7.4.5.2) plus a small
 * unified builder for the underlying `/Shading` dictionary.
 *
 * A function-based shading defines colour as a function of position: the
 * shading's `/Function` maps a 2-D coordinate `(x, y)` in the shading's
 * `/Domain` (after the optional `/Matrix` mapping) to a colour value in the
 * shading's `/ColorSpace`. Unlike axial (type 2) or radial (type 3) shadings,
 * colour varies freely across the plane rather than along a single parameter.
 *
 * This module builds the `/Shading` dictionary from a plain
 * {@link PdfFunctionDef} and can sample the resulting colour at any point by
 * delegating to {@link evaluateFunction}, so callers can both emit the PDF
 * object and preview / rasterise the same definition without re-deriving it.
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  type PdfObject,
} from './pdfObjects.js';
import { evaluateFunction, type PdfFunctionDef } from './pdfFunctions.js';

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

/**
 * Options describing a function-based (type 1) shading.
 */
export interface FunctionShadingOptions {
  /**
   * The rectangular domain `[xmin xmax ymin ymax]` of the shading's
   * coordinate space. Defaults to `[0 1 0 1]` per the spec.
   */
  readonly domain?: readonly [number, number, number, number] | undefined;
  /**
   * The `/Matrix` mapping the domain into the target (pattern/user) space,
   * as `[a b c d e f]`. Defaults to the identity matrix.
   */
  readonly matrix?:
    | readonly [number, number, number, number, number, number]
    | undefined;
  /**
   * The shading colour space name (e.g. `DeviceRGB`, `DeviceGray`,
   * `DeviceCMYK`). Defaults to `DeviceRGB`.
   */
  readonly colorSpace?: string | undefined;
  /**
   * The colour-producing function. Its input is the 2-D domain coordinate and
   * its output is one colour value in {@link FunctionShadingOptions.colorSpace}.
   */
  readonly fn: PdfFunctionDef;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default shading domain `[0 1 0 1]` (ISO 32000-2 §8.7.4.5.2, Table 79). */
const DEFAULT_DOMAIN: readonly [number, number, number, number] = [0, 1, 0, 1];

/** Default `/Matrix` — the identity transform `[1 0 0 1 0 0]`. */
const DEFAULT_MATRIX: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
] = [1, 0, 0, 1, 0, 0];

/** Default shading colour space name. */
const DEFAULT_COLOR_SPACE = 'DeviceRGB';

// ---------------------------------------------------------------------------
// Function-dict materialisation
// ---------------------------------------------------------------------------

/**
 * Build a `/Function` dictionary from a {@link PdfFunctionDef}.
 *
 * Supports the two function types most commonly used by shadings:
 *
 * - Type 2 (exponential) → `{/FunctionType 2 /Domain /C0 /C1 /N}`.
 * - Type 4 (PostScript) → a stream-less placeholder
 *   `{/FunctionType 4 /Domain /Range}` (the calculator source is carried in
 *   the in-memory {@link PdfFunctionDef} and materialised separately).
 *
 * Other function types fall back to a minimal `{/FunctionType n}` dict.
 */
function buildFunctionDict(fn: PdfFunctionDef): PdfDict {
  const dict = new PdfDict();
  dict.set('/FunctionType', PdfNumber.of(fn.functionType));

  switch (fn.functionType) {
    case 2: {
      dict.set('/Domain', PdfArray.fromNumbers([...fn.domain]));
      dict.set('/C0', PdfArray.fromNumbers([...(fn.c0 ?? [0])]));
      dict.set('/C1', PdfArray.fromNumbers([...(fn.c1 ?? [1])]));
      dict.set('/N', PdfNumber.of(fn.n));
      break;
    }
    case 4: {
      dict.set('/Domain', PdfArray.fromNumbers([...fn.domain]));
      dict.set('/Range', PdfArray.fromNumbers([...fn.range]));
      break;
    }
    default: {
      dict.set('/Domain', PdfArray.fromNumbers([...fn.domain]));
      break;
    }
  }

  return dict;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a function-based (type 1) `/Shading` dictionary.
 *
 * The returned dict carries `/ShadingType 1`, the (defaulted) `/Domain`,
 * `/Matrix` and `/ColorSpace`, and an inline `/Function` dictionary built from
 * `options.fn`.
 *
 * @param options - the shading definition.
 * @returns a `PdfDict` ready to be referenced from a pattern or resource dict.
 */
export function buildFunctionShading(options: FunctionShadingOptions): PdfDict {
  const domain = options.domain ?? DEFAULT_DOMAIN;
  const matrix = options.matrix ?? DEFAULT_MATRIX;
  const colorSpace = options.colorSpace ?? DEFAULT_COLOR_SPACE;

  const dict = new PdfDict();
  dict.set('/ShadingType', PdfNumber.of(1));
  dict.set('/ColorSpace', PdfName.of(colorSpace));
  dict.set('/Domain', PdfArray.fromNumbers([...domain]));
  dict.set('/Matrix', PdfArray.fromNumbers([...matrix]));
  dict.set('/Function', buildFunctionDict(options.fn) as PdfObject);

  return dict;
}

/**
 * Sample the shading's colour at domain coordinate `(x, y)`.
 *
 * Evaluates `options.fn` at the 2-D input vector and returns the resulting
 * colour components (clamped to the function's range by
 * {@link evaluateFunction}).
 *
 * @param options - the shading definition.
 * @param x - the first domain coordinate.
 * @param y - the second domain coordinate.
 * @returns the evaluated colour components.
 */
export function sampleShadingColor(
  options: FunctionShadingOptions,
  x: number,
  y: number,
): number[] {
  return evaluateFunction(options.fn, [x, y]);
}

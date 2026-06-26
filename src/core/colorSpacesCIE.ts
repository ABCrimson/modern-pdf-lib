/**
 * @module core/colorSpacesCIE
 *
 * Device-independent CIE-based colour spaces — CalGray, CalRGB and Lab.
 *
 * These colour spaces describe colour in a way that does not depend on a
 * particular output device, by anchoring colour to the CIE 1931 XYZ
 * tristimulus model.  See ISO 32000-2 §8.6.5 ("CIE-based colour spaces") and
 * PDF 1.7 §8.6.5.
 *
 * Each builder produces a two-element {@link PdfArray} of the form
 * `[/SpaceName << …parameters… >>]`, which is the canonical PDF representation
 * for a CIE colour space.  In addition, {@link labToRgb} converts a CIE
 * L*a*b* colour to sRGB for previewing / rasterisation purposes.
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  type PdfObject,
} from './pdfObjects.js';

// ---------------------------------------------------------------------------
// Parameter interfaces
// ---------------------------------------------------------------------------

/** Parameters for a CalGray colour space (ISO 32000-2 §8.6.5.2). */
export interface CalGrayParams {
  /** Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0. */
  readonly whitePoint: readonly [number, number, number];
  /** Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`. */
  readonly blackPoint?: readonly [number, number, number] | undefined;
  /** Gamma exponent for the single grey component; defaults to 1.0. */
  readonly gamma?: number | undefined;
}

/** Parameters for a CalRGB colour space (ISO 32000-2 §8.6.5.3). */
export interface CalRGBParams {
  /** Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0. */
  readonly whitePoint: readonly [number, number, number];
  /** Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`. */
  readonly blackPoint?: readonly [number, number, number] | undefined;
  /** Per-component gamma `[GR GG GB]`; defaults to `[1 1 1]`. */
  readonly gamma?: readonly [number, number, number] | undefined;
  /** 3×3 linear transform (9 numbers, column-major); defaults to identity. */
  readonly matrix?: readonly number[] | undefined;
}

/** Parameters for a Lab colour space (ISO 32000-2 §8.6.5.4). */
export interface LabParams {
  /** Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0. */
  readonly whitePoint: readonly [number, number, number];
  /** Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`. */
  readonly blackPoint?: readonly [number, number, number] | undefined;
  /** `[amin amax bmin bmax]` ranges for the a* and b* components. */
  readonly range?: readonly [number, number, number, number] | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a colour-space array `[/Name << dict >>]`. */
function spaceArray(name: string, dict: PdfDict): PdfArray {
  const array = new PdfArray();
  array.push(PdfName.of(name));
  array.push(dict);
  return array;
}

/** Set a `[number, number, number]` triple entry on a dict. */
function setTriple(
  dict: PdfDict,
  key: string,
  value: readonly [number, number, number],
): void {
  dict.set(key, PdfArray.fromNumbers([value[0], value[1], value[2]]));
}

// ---------------------------------------------------------------------------
// CalGray
// ---------------------------------------------------------------------------

/**
 * Build a CalGray colour-space array.
 *
 * @returns `[/CalGray << /WhitePoint … [/BlackPoint …] [/Gamma …] >>]`.
 */
export function buildCalGray(p: CalGrayParams): PdfArray {
  const dict = new PdfDict();
  setTriple(dict, '/WhitePoint', p.whitePoint);
  if (p.blackPoint !== undefined) {
    setTriple(dict, '/BlackPoint', p.blackPoint);
  }
  if (p.gamma !== undefined) {
    dict.set('/Gamma', PdfNumber.of(p.gamma));
  }
  return spaceArray('/CalGray', dict);
}

// ---------------------------------------------------------------------------
// CalRGB
// ---------------------------------------------------------------------------

/**
 * Build a CalRGB colour-space array.
 *
 * @returns `[/CalRGB << /WhitePoint … [/BlackPoint …] [/Gamma …] [/Matrix …] >>]`.
 */
export function buildCalRGB(p: CalRGBParams): PdfArray {
  const dict = new PdfDict();
  setTriple(dict, '/WhitePoint', p.whitePoint);
  if (p.blackPoint !== undefined) {
    setTriple(dict, '/BlackPoint', p.blackPoint);
  }
  if (p.gamma !== undefined) {
    setTriple(dict, '/Gamma', p.gamma);
  }
  if (p.matrix !== undefined) {
    dict.set('/Matrix', PdfArray.fromNumbers([...p.matrix]));
  }
  return spaceArray('/CalRGB', dict);
}

// ---------------------------------------------------------------------------
// Lab
// ---------------------------------------------------------------------------

/**
 * Build a Lab colour-space array.
 *
 * @returns `[/Lab << /WhitePoint … [/BlackPoint …] [/Range …] >>]`.
 */
export function buildLab(p: LabParams): PdfArray {
  const dict = new PdfDict();
  setTriple(dict, '/WhitePoint', p.whitePoint);
  if (p.blackPoint !== undefined) {
    setTriple(dict, '/BlackPoint', p.blackPoint);
  }
  if (p.range !== undefined) {
    dict.set(
      '/Range',
      PdfArray.fromNumbers([p.range[0], p.range[1], p.range[2], p.range[3]]),
    );
  }
  return spaceArray('/Lab', dict);
}

// ---------------------------------------------------------------------------
// Lab → sRGB conversion
// ---------------------------------------------------------------------------

/**
 * The CIE standard D50 white point (the default for ICC / PDF Lab data),
 * normalised so that `Y = 1`.
 */
const D50_WHITE_POINT: readonly [number, number, number] = [
  0.9642, 1.0, 0.8249,
];

/** CIE constant δ = 6/29; the linear/cubic break is at t ≤ δ. */
const LAB_DELTA = 6 / 29;
/** 3δ² — slope of the inverse linear branch. */
const LAB_3_DELTA_SQUARED = 3 * LAB_DELTA * LAB_DELTA;

/** Inverse of the CIE L*a*b* nonlinearity f(t). */
function labInverseF(t: number): number {
  return t > LAB_DELTA ? t * t * t : LAB_3_DELTA_SQUARED * (t - 4 / 29);
}

/** Apply the sRGB transfer function (linear → companded), input clamped 0..1. */
function linearToSrgb(c: number): number {
  const clamped = c < 0 ? 0 : c > 1 ? 1 : c;
  const v =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Convert a CIE L*a*b* colour to sRGB (0..1 per channel).
 *
 * The pipeline is the standard L*a*b* → XYZ → linear-sRGB → gamma-companded
 * sRGB transform.  XYZ is Bradford-free (a plain scaling by the white point),
 * matching the ICC `Lab` PCS convention.  The default white point is CIE D50,
 * which is the white point used by ICC profile connection space and PDF Lab
 * colour data.
 *
 * @param L          Lightness, 0..100.
 * @param a          Green–red component (typically −128..127).
 * @param b          Blue–yellow component (typically −128..127).
 * @param whitePoint Reference white `[Xn Yn Zn]` (Y = 1); defaults to D50.
 * @returns `[r, g, b]` each in the range 0..1.
 */
export function labToRgb(
  L: number,
  a: number,
  b: number,
  whitePoint: readonly [number, number, number] = D50_WHITE_POINT,
): [number, number, number] {
  // L*a*b* -> XYZ (relative to the supplied white point).
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const xr = labInverseF(fx);
  const yr = labInverseF(fy);
  const zr = labInverseF(fz);

  const X = xr * whitePoint[0];
  const Y = yr * whitePoint[1];
  const Z = zr * whitePoint[2];

  // XYZ (D50) -> linear sRGB.  Matrix from the sRGB spec with a Bradford
  // chromatic adaptation from D50 to D65 folded in (ICC v4 matrix).
  const rLin = 3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z;
  const gLin = -0.9787684 * X + 1.9161415 * Y + 0.033454 * Z;
  const bLin = 0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z;

  return [linearToSrgb(rLin), linearToSrgb(gLin), linearToSrgb(bLin)];
}

// Re-export PdfObject so consumers of the returned arrays can type-narrow
// items without importing the low-level module directly.
export type { PdfObject };

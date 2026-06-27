/**
 * @module color/colorConvert
 *
 * Pure **device** colour-space conversions — no ICC, no chromatic adaptation
 * beyond what each standard formula already bakes in. These are the textbook
 * conversions used for previewing, picking and authoring colour; they are not
 * a substitute for ICC-based colour management.
 *
 * All channels are normalised to `0..1`, with two exceptions that follow the
 * natural ranges of their spaces:
 *  - **Hue** is in degrees `[0, 360)`.
 *  - **CIE L\*a\*b\*** uses its native ranges: `L ∈ [0, 100]`, `a`/`b`
 *    unbounded (typically `[-128, 127]`).
 *
 * ## Verified reference constants
 *
 * **sRGB transfer function** — IEC 61966-2-1:1999 (sRGB). The companded↔linear
 * piecewise curve:
 *  - expand (companded→linear): `c ≤ 0.04045 → c/12.92`,
 *    else `((c + 0.055)/1.055)^2.4`.
 *  - compress (linear→companded): `c ≤ 0.0031308 → 12.92·c`,
 *    else `1.055·c^(1/2.4) − 0.055`.
 *
 * **sRGB ↔ XYZ (D65) matrices** — IEC 61966-2-1, as tabulated by Bruce
 * Lindbloom (sRGB, reference white D65). Forward (linear sRGB → XYZ):
 * ```
 *   X = 0.4124564 R + 0.3575761 G + 0.1804375 B
 *   Y = 0.2126729 R + 0.7151522 G + 0.0721750 B
 *   Z = 0.0193339 R + 0.1191920 G + 0.9503041 B
 * ```
 * Inverse (XYZ → linear sRGB):
 * ```
 *   R =  3.2404542 X − 1.5371385 Y − 0.4985314 Z
 *   G = −0.9692660 X + 1.8760108 Y + 0.0415560 Z
 *   B =  0.0556434 X − 0.2040259 Y + 1.0572252 Z
 * ```
 *
 * **D65 reference white** — CIE 1931 2° observer, normalised to `Y = 1`:
 * `Xn = 0.95047, Yn = 1.00000, Zn = 1.08883`.
 *
 * **CIE L\*a\*b\*** — CIE 15 colorimetry, using the rational `δ = 6/29`
 * formulation (numerically identical to the `0.008856 / 903.3` form but
 * continuous at the join):
 * ```
 *   f(t) = t^(1/3)              if t > δ³
 *        = t/(3δ²) + 4/29       otherwise
 *   L = 116·f(Y/Yn) − 16
 *   a = 500·(f(X/Xn) − f(Y/Yn))
 *   b = 200·(f(Y/Yn) − f(Z/Zn))
 * ```
 * with the inverse `f⁻¹(t) = t³` if `t > δ` else `3δ²·(t − 4/29)`.
 *
 * > **Note on Lab white point.** This module's `rgbToLab` / `labToRgb` use the
 * > **D65** PCS that matches the sRGB→XYZ pipeline, per this module's spec.
 * > That differs from {@link module:core/colorSpacesCIE}'s `labToRgb`, which
 * > targets the **D50** ICC profile-connection-space convention. The two are
 * > intentionally distinct and should not be confused.
 *
 * No `Buffer` — plain `number` arithmetic and tuples only.
 */

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/**
 * CIE 1931 2° D65 reference white, normalised so `Yn = 1`.
 * (IEC 61966-2-1 / CIE 15.)
 */
const D65_WHITE: readonly [number, number, number] = [
  0.95047, 1.0, 1.08883,
];

/** CIE Lab constant `δ = 6/29`. */
const LAB_DELTA = 6 / 29;
/** `δ³` — the linear/cubic break point for the forward nonlinearity `f(t)`. */
const LAB_DELTA_CUBED = LAB_DELTA * LAB_DELTA * LAB_DELTA;
/** `3δ²` — slope of the linear branch. */
const LAB_3_DELTA_SQUARED = 3 * LAB_DELTA * LAB_DELTA;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

/** Clamp `x` to the closed interval `[lo, hi]`. */
function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Normalise a hue in degrees into `[0, 360)`. */
function normalizeHue(h: number): number {
  const m = h % 360;
  return m < 0 ? m + 360 : m;
}

// ---------------------------------------------------------------------------
// CMYK <-> RGB (naive device conversion)
// ---------------------------------------------------------------------------

/**
 * Convert device CMYK to device RGB using the standard naïve model
 * `channel = (1 − ink) · (1 − k)`.
 *
 * @param c - Cyan,    0..1.
 * @param m - Magenta, 0..1.
 * @param y - Yellow,  0..1.
 * @param k - Black,   0..1.
 * @returns `[r, g, b]`, each 0..1.
 */
export function cmykToRgb(
  c: number,
  m: number,
  y: number,
  k: number,
): [number, number, number] {
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  return [r, g, b];
}

/**
 * Convert device RGB to device CMYK using the standard naïve model.
 *
 * `k = 1 − max(r, g, b)`; each ink is `(1 − channel − k)/(1 − k)`. Pure black
 * (`r = g = b = 0`) yields `k = 1` with zero inks.
 *
 * @param r - Red,   0..1.
 * @param g - Green, 0..1.
 * @param b - Blue,  0..1.
 * @returns `[c, m, y, k]`, each 0..1.
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number,
): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) {
    // Pure black: avoid division by zero; no chromatic ink.
    return [0, 0, 0, 1];
  }
  const denom = 1 - k;
  const c = (1 - r - k) / denom;
  const m = (1 - g - k) / denom;
  const y = (1 - b - k) / denom;
  return [c, m, y, k];
}

// ---------------------------------------------------------------------------
// RGB <-> HSL
// ---------------------------------------------------------------------------

/**
 * Convert device RGB to HSL.
 *
 * @param r - Red,   0..1.
 * @param g - Green, 0..1.
 * @param b - Blue,  0..1.
 * @returns `[h, s, l]` with `h` in `[0, 360)`, `s`/`l` in `0..1`.
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return [0, 0, l];
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;

  return [normalizeHue(h), s, l];
}

/**
 * Convert HSL to device RGB.
 *
 * @param h - Hue in degrees (any real; wrapped into `[0, 360)`).
 * @param s - Saturation, 0..1.
 * @param l - Lightness,  0..1.
 * @returns `[r, g, b]`, each 0..1.
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  const hue = normalizeHue(h);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const mAdd = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return [r1 + mAdd, g1 + mAdd, b1 + mAdd];
}

// ---------------------------------------------------------------------------
// RGB <-> HSV
// ---------------------------------------------------------------------------

/**
 * Convert device RGB to HSV.
 *
 * @param r - Red,   0..1.
 * @param g - Green, 0..1.
 * @param b - Blue,  0..1.
 * @returns `[h, s, v]` with `h` in `[0, 360)`, `s`/`v` in `0..1`.
 */
export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const v = max;

  if (delta === 0) {
    return [0, 0, v];
  }

  const s = max === 0 ? 0 : delta / max;

  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;

  return [normalizeHue(h), s, v];
}

/**
 * Convert HSV to device RGB.
 *
 * @param h - Hue in degrees (any real; wrapped into `[0, 360)`).
 * @param s - Saturation, 0..1.
 * @param v - Value,      0..1.
 * @returns `[r, g, b]`, each 0..1.
 */
export function hsvToRgb(
  h: number,
  s: number,
  v: number,
): [number, number, number] {
  const hue = normalizeHue(h);
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const mAdd = v - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return [r1 + mAdd, g1 + mAdd, b1 + mAdd];
}

// ---------------------------------------------------------------------------
// sRGB transfer function
// ---------------------------------------------------------------------------

/** Gamma-expand a companded sRGB channel to linear (IEC 61966-2-1). */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Gamma-compress a linear channel to companded sRGB (IEC 61966-2-1). */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return v;
}

// ---------------------------------------------------------------------------
// RGB <-> XYZ (sRGB, D65)
// ---------------------------------------------------------------------------

/**
 * Convert device (sRGB) RGB to CIE XYZ relative to the D65 white point.
 *
 * Gamma-expands each channel, then applies the IEC 61966-2-1 sRGB→XYZ D65
 * matrix. The returned `Y` is `1.0` for input white `(1, 1, 1)`.
 *
 * @param r - Red,   0..1.
 * @param g - Green, 0..1.
 * @param b - Blue,  0..1.
 * @returns `[X, Y, Z]` (D65, `Y = 1` for white).
 */
export function rgbToXyz(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl;

  return [x, y, z];
}

/**
 * Convert CIE XYZ (D65) to device (sRGB) RGB.
 *
 * Applies the inverse sRGB matrix, then gamma-companding. Results are clamped
 * to `0..1` to keep them in the displayable device gamut.
 *
 * @param x - CIE X (D65).
 * @param y - CIE Y (D65).
 * @param z - CIE Z (D65).
 * @returns `[r, g, b]`, each clamped to 0..1.
 */
export function xyzToRgb(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return [
    clamp(linearToSrgb(rl), 0, 1),
    clamp(linearToSrgb(gl), 0, 1),
    clamp(linearToSrgb(bl), 0, 1),
  ];
}

// ---------------------------------------------------------------------------
// RGB <-> Lab (via XYZ, D65)
// ---------------------------------------------------------------------------

/** Forward CIE Lab nonlinearity `f(t)`. */
function labF(t: number): number {
  return t > LAB_DELTA_CUBED
    ? Math.cbrt(t)
    : t / LAB_3_DELTA_SQUARED + 4 / 29;
}

/** Inverse CIE Lab nonlinearity `f⁻¹(t)`. */
function labInvF(t: number): number {
  return t > LAB_DELTA ? t * t * t : LAB_3_DELTA_SQUARED * (t - 4 / 29);
}

/**
 * Convert device (sRGB) RGB to CIE L\*a\*b\* via XYZ, using the D65 white
 * point.
 *
 * @param r - Red,   0..1.
 * @param g - Green, 0..1.
 * @param b - Blue,  0..1.
 * @returns `[L, a, b]` with `L ∈ [0, 100]`, `a`/`b` in their natural ranges.
 */
export function rgbToLab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);

  const fx = labF(x / D65_WHITE[0]);
  const fy = labF(y / D65_WHITE[1]);
  const fz = labF(z / D65_WHITE[2]);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);

  return [L, a, bb];
}

/**
 * Convert CIE L\*a\*b\* (D65) to device (sRGB) RGB via XYZ.
 *
 * @param L - Lightness, 0..100.
 * @param a - Green–red component (typically −128..127).
 * @param b - Blue–yellow component (typically −128..127).
 * @returns `[r, g, b]`, each clamped to 0..1.
 */
export function labToRgb(
  L: number,
  a: number,
  b: number,
): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const x = labInvF(fx) * D65_WHITE[0];
  const y = labInvF(fy) * D65_WHITE[1];
  const z = labInvF(fz) * D65_WHITE[2];

  return xyzToRgb(x, y, z);
}

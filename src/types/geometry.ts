/**
 * @module types/geometry
 *
 * Core geometric primitives used throughout the modern-pdf engine.
 *
 * All coordinates follow the PDF convention: origin at bottom-left,
 * y-axis pointing up, units in PDF points (1/72 inch).
 *
 * The {@link TransformMatrix} type models the six-element affine
 * transformation matrix used by the PDF `cm` operator.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/** A two-dimensional point. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A width/height pair (always non-negative in well-formed documents). */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * An axis-aligned rectangle defined by its lower-left corner and
 * dimensions.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A 2-D affine transformation matrix stored as the six values that
 * the PDF `cm` operator expects:
 *
 * ```
 * [ a  b  0 ]
 * [ c  d  0 ]
 * [ e  f  1 ]
 * ```
 *
 * Indices: `[a, b, c, d, e, f]`
 */
export type TransformMatrix = [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

// ---------------------------------------------------------------------------
// Angle types (mirrors core/operators/state but with a discriminant)
// ---------------------------------------------------------------------------

/**
 * An angle value with an explicit unit discriminant.
 *
 * Prefer the {@link degreesAngle} / {@link radiansAngle} factory
 * functions over constructing these manually.
 */
export type Angle =
  | { readonly kind: 'degrees'; readonly value: number }
  | { readonly kind: 'radians'; readonly value: number };

/**
 * Create an angle expressed in degrees.
 *
 * @param deg  Angle in degrees (positive = counter-clockwise).
 */
export function degreesAngle(deg: number): Angle {
  return { kind: 'degrees', value: deg };
}

/**
 * Create an angle expressed in radians.
 *
 * @param rad  Angle in radians (positive = counter-clockwise).
 */
export function radiansAngle(rad: number): Angle {
  return { kind: 'radians', value: rad };
}

/**
 * Convert any {@link Angle} to a numeric value in radians.
 */
export function angleToRadians(angle: Angle): number {
  return angle.kind === 'radians'
    ? angle.value
    : (angle.value * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Matrix factories
// ---------------------------------------------------------------------------

/**
 * Return the 2-D identity matrix.
 *
 * @returns `[1, 0, 0, 1, 0, 0]`
 */
export function identityMatrix(): TransformMatrix {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Multiply two affine matrices `a * b` (apply `b` first, then `a`).
 *
 * Given:
 * ```
 * A = [a0, a1, a2, a3, a4, a5]
 * B = [b0, b1, b2, b3, b4, b5]
 * ```
 *
 * The result `C = A * B` is computed by standard 3x3 matrix
 * multiplication with the implicit third row `[0, 0, 1]`.
 */
export function multiplyMatrices(
  a: TransformMatrix,
  b: TransformMatrix,
): TransformMatrix {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;

  return [
    a0 * b0 + a1 * b2,          // a
    a0 * b1 + a1 * b3,          // b
    a2 * b0 + a3 * b2,          // c
    a2 * b1 + a3 * b3,          // d
    a4 * b0 + a5 * b2 + b4,     // e
    a4 * b1 + a5 * b3 + b5,     // f
  ];
}

/**
 * Create a translation matrix.
 *
 * @param tx  Horizontal offset.
 * @param ty  Vertical offset.
 */
export function translationMatrix(tx: number, ty: number): TransformMatrix {
  return [1, 0, 0, 1, tx, ty];
}

/**
 * Create a scaling matrix.
 *
 * @param sx  Horizontal scale factor.
 * @param sy  Vertical scale factor.
 */
export function scalingMatrix(sx: number, sy: number): TransformMatrix {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Create a rotation matrix.
 *
 * @param angleRad  Rotation angle **in radians** (positive =
 *                  counter-clockwise).
 */
export function rotationMatrix(angleRad: number): TransformMatrix {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * @module render/matrix
 *
 * 2-D affine transforms used by the content-stream interpreter and rasterizer.
 * A PDF transformation matrix is the 6-tuple `[a, b, c, d, e, f]` representing
 *
 * ```
 * | a  b  0 |
 * | c  d  0 |
 * | e  f  1 |
 * ```
 *
 * A point `(x, y)` maps to `(a·x + c·y + e, b·x + d·y + f)` (ISO 32000-2 §8.3.4).
 *
 * @packageDocumentation
 */

/** A 2-D affine transform as the PDF `[a, b, c, d, e, f]` 6-tuple. */
export type Matrix = readonly [number, number, number, number, number, number];

/** The identity transform. */
export function identity(): Matrix {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Concatenate two transforms: the result applies `m` **first**, then `n`
 * (i.e. `point · m · n`). This matches the PDF `cm` operator, where the new
 * CTM is `cmMatrix × CTM`.
 */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

/** Apply a transform to a point, returning the transformed `[x, y]`. */
export function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** A pure translation transform. */
export function translation(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

/** A pure scale transform. */
export function scaling(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * The magnitude by which `m` scales lengths — the geometric mean of the
 * x- and y-axis scale factors (`sqrt(|det|)`). Used to map a user-space line
 * width to device space.
 */
export function meanScale(m: Matrix): number {
  const det = m[0] * m[3] - m[1] * m[2];
  return Math.sqrt(Math.abs(det));
}

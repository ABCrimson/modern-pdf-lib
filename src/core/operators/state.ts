/**
 * @module core/operators/state
 *
 * PDF graphics-state operators (`q`, `Q`, `cm`) and rotation helpers.
 *
 * Reference: PDF 1.7 spec, §8.4.2 (Graphics State Operators) and
 *            §8.3.3 (Common Transformations).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number for PDF output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

/** A rotation / angle value in radians. */
export interface Radians {
  readonly type: 'radians';
  readonly value: number;
}

/** A rotation / angle value in degrees. */
export interface Degrees {
  readonly type: 'degrees';
  readonly value: number;
}

/** Union of angle representations. */
export type Angle = Radians | Degrees;

/**
 * Create an angle in degrees.
 *
 * @param deg  Angle in degrees (positive = counter-clockwise).
 */
export function degrees(deg: number): Degrees {
  return { type: 'degrees', value: deg };
}

/**
 * Create an angle in radians.
 *
 * @param rad  Angle in radians (positive = counter-clockwise).
 */
export function radians(rad: number): Radians {
  return { type: 'radians', value: rad };
}

/**
 * Convert any {@link Angle} to radians.
 */
export function toRadians(angle: Angle): number {
  return angle.type === 'radians' ? angle.value : (angle.value * Math.PI) / 180;
}

/**
 * Convert any {@link Angle} to degrees.
 */
export function toDegrees(angle: Angle): number {
  return angle.type === 'degrees' ? angle.value : (angle.value * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Graphics state operators
// ---------------------------------------------------------------------------

/**
 * Save the current graphics state on the graphics state stack (`q`).
 */
export function saveState(): string {
  return 'q\n';
}

/**
 * Restore the most recently saved graphics state (`Q`).
 */
export function restoreState(): string {
  return 'Q\n';
}

/**
 * Concatenate the given matrix with the current transformation matrix
 * (`cm`).
 *
 * The six operands define the matrix:
 *
 * ```
 * [ a  b  0 ]
 * [ c  d  0 ]
 * [ tx ty 1 ]
 * ```
 *
 * @param a   Horizontal scaling / rotation.
 * @param b   Rotation / skew.
 * @param c   Rotation / skew.
 * @param d   Vertical scaling / rotation.
 * @param tx  Horizontal translation.
 * @param ty  Vertical translation.
 */
export function concatMatrix(
  a: number,
  b: number,
  c: number,
  d: number,
  tx: number,
  ty: number,
): string {
  return `${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(tx)} ${n(ty)} cm\n`;
}

// ---------------------------------------------------------------------------
// Convenience matrix builders
// ---------------------------------------------------------------------------

/**
 * Produce a `cm` operator that applies a **translation**.
 *
 * @param tx  Horizontal distance.
 * @param ty  Vertical distance.
 */
export function translate(tx: number, ty: number): string {
  return concatMatrix(1, 0, 0, 1, tx, ty);
}

/**
 * Produce a `cm` operator that applies a **uniform scale** about the
 * origin.
 *
 * @param sx  Horizontal scale factor.
 * @param sy  Vertical scale factor.
 */
export function scale(sx: number, sy: number): string {
  return concatMatrix(sx, 0, 0, sy, 0, 0);
}

/**
 * Produce a `cm` operator that applies a **rotation** about the origin.
 *
 * @param angle  Rotation angle.
 */
export function rotate(angle: Angle): string {
  const rad = toRadians(angle);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return concatMatrix(cos, sin, -sin, cos, 0, 0);
}

/**
 * Produce a `cm` operator that applies a **skew** (shear).
 *
 * @param xAngle  Skew angle for the x axis.
 * @param yAngle  Skew angle for the y axis.
 */
export function skew(xAngle: Angle, yAngle: Angle): string {
  const tanX = Math.tan(toRadians(xAngle));
  const tanY = Math.tan(toRadians(yAngle));
  return concatMatrix(1, tanX, tanY, 1, 0, 0);
}

/**
 * Build the six-component matrix array for a rotation about an
 * arbitrary centre point `(cx, cy)`.
 *
 * Useful when you need to compose this with other transformations
 * before emitting operators.
 *
 * @returns `[a, b, c, d, tx, ty]`
 */
export function rotationMatrix(
  angle: Angle,
  cx: number,
  cy: number,
): [number, number, number, number, number, number] {
  const rad = toRadians(angle);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tx = cx - cos * cx + sin * cy;
  const ty = cy - sin * cx - cos * cy;
  return [cos, sin, -sin, cos, tx, ty];
}

/**
 * Set the graphics state dictionary (`gs`).
 *
 * The `name` must refer to an entry in the page's `/Resources /ExtGState`
 * dictionary.
 *
 * @param name  Graphics-state resource name (e.g. `GS1`).
 */
export function setGraphicsState(name: string): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return `${pdfName} gs\n`;
}

// ---------------------------------------------------------------------------
// Standalone angle conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert degrees to radians.
 *
 * @param deg  Angle in degrees.
 * @returns    Angle in radians.
 */
export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees.
 *
 * @param rad  Angle in radians.
 * @returns    Angle in degrees.
 */
export function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

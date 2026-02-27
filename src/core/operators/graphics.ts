/**
 * @module core/operators/graphics
 *
 * PDF path-construction and painting operators — produces the raw operator
 * strings that appear inside a page content stream.
 *
 * Reference: PDF 1.7 spec, §8.5 (Path Construction & Painting).
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
// Path construction operators
// ---------------------------------------------------------------------------

/**
 * Append a rectangle to the current path (`re`).
 *
 * @param x       Lower-left x coordinate.
 * @param y       Lower-left y coordinate.
 * @param width   Width of the rectangle.
 * @param height  Height of the rectangle.
 */
export function rectangle(x: number, y: number, width: number, height: number): string {
  return `${n(x)} ${n(y)} ${n(width)} ${n(height)} re\n`;
}

/**
 * Begin a new sub-path by moving the current point (`m`).
 *
 * @param x  Target x coordinate.
 * @param y  Target y coordinate.
 */
export function moveTo(x: number, y: number): string {
  return `${n(x)} ${n(y)} m\n`;
}

/**
 * Append a straight line segment from the current point to `(x, y)` (`l`).
 *
 * @param x  Target x coordinate.
 * @param y  Target y coordinate.
 */
export function lineTo(x: number, y: number): string {
  return `${n(x)} ${n(y)} l\n`;
}

/**
 * Append a cubic Bezier curve to the current path (`c`).
 *
 * The curve extends from the current point to `(x3, y3)`, using
 * `(x1, y1)` and `(x2, y2)` as control points.
 */
export function curveTo(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): string {
  return `${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(x3)} ${n(y3)} c\n`;
}

/**
 * Append a cubic Bezier curve where the first control point coincides
 * with the current point (`v`).
 */
export function curveToInitial(
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): string {
  return `${n(x2)} ${n(y2)} ${n(x3)} ${n(y3)} v\n`;
}

/**
 * Append a cubic Bezier curve where the second control point coincides
 * with the final point (`y`).
 */
export function curveToFinal(
  x1: number,
  y1: number,
  x3: number,
  y3: number,
): string {
  return `${n(x1)} ${n(y1)} ${n(x3)} ${n(y3)} y\n`;
}

/**
 * Close the current sub-path by appending a straight line from the
 * current point to the starting point (`h`).
 */
export function closePath(): string {
  return 'h\n';
}

// ---------------------------------------------------------------------------
// Path painting operators
// ---------------------------------------------------------------------------

/**
 * Stroke the path (`S`).
 */
export function stroke(): string {
  return 'S\n';
}

/**
 * Close and stroke the path — equivalent to `h S` (`s`).
 */
export function closeAndStroke(): string {
  return 's\n';
}

/**
 * Fill the path using the non-zero winding rule (`f`).
 */
export function fill(): string {
  return 'f\n';
}

/**
 * Fill the path using the even-odd rule (`f*`).
 */
export function fillEvenOdd(): string {
  return 'f*\n';
}

/**
 * Fill and then stroke the path (non-zero winding) (`B`).
 */
export function fillAndStroke(): string {
  return 'B\n';
}

/**
 * Fill (even-odd) and then stroke the path (`B*`).
 */
export function fillEvenOddAndStroke(): string {
  return 'B*\n';
}

/**
 * Close, fill, and stroke the path (`b`).
 */
export function closeFillAndStroke(): string {
  return 'b\n';
}

/**
 * Close, fill (even-odd), and stroke the path (`b*`).
 */
export function closeFillEvenOddAndStroke(): string {
  return 'b*\n';
}

/**
 * End the path without filling or stroking — a no-op painting operator
 * typically used with clipping (`n`).
 */
export function endPath(): string {
  return 'n\n';
}

// ---------------------------------------------------------------------------
// Clipping operators
// ---------------------------------------------------------------------------

/**
 * Intersect the clipping path with the current path using the non-zero
 * winding rule (`W`).  Must be followed by a painting operator.
 */
export function clip(): string {
  return 'W\n';
}

/**
 * Intersect the clipping path with the current path using the even-odd
 * rule (`W*`).
 */
export function clipEvenOdd(): string {
  return 'W*\n';
}

// ---------------------------------------------------------------------------
// Line / dash state operators
// ---------------------------------------------------------------------------

/**
 * Set the line width (`w`).
 *
 * @param width  Line width in user-space units.
 */
export function setLineWidth(width: number): string {
  return `${n(width)} w\n`;
}

/**
 * Set the line cap style (`J`).
 *
 * | Value | Style       |
 * |-------|-------------|
 * | 0     | Butt cap    |
 * | 1     | Round cap   |
 * | 2     | Square cap  |
 */
export function setLineCap(style: 0 | 1 | 2): string {
  return `${style} J\n`;
}

/**
 * Set the line join style (`j`).
 *
 * | Value | Style        |
 * |-------|--------------|
 * | 0     | Miter join   |
 * | 1     | Round join   |
 * | 2     | Bevel join   |
 */
export function setLineJoin(style: 0 | 1 | 2): string {
  return `${style} j\n`;
}

/**
 * Set the miter limit (`M`).
 *
 * @param limit  Maximum ratio of miter length to line width.
 */
export function setMiterLimit(limit: number): string {
  return `${n(limit)} M\n`;
}

/**
 * Set the line dash pattern (`d`).
 *
 * @param dashArray  Array of dash and gap lengths.
 * @param dashPhase  Offset into the dash pattern.
 */
export function setDashPattern(dashArray: readonly number[], dashPhase: number): string {
  const arr = `[${dashArray.map(n).join(' ')}]`;
  return `${arr} ${n(dashPhase)} d\n`;
}

/**
 * Set the flatness tolerance (`i`).
 *
 * @param flatness  Maximum distance in device pixels between the
 *                  mathematical path and the rendered approximation.
 */
export function setFlatness(flatness: number): string {
  return `${n(flatness)} i\n`;
}

// ---------------------------------------------------------------------------
// Convenience: circle approximation via cubic Bezier
// ---------------------------------------------------------------------------

/** Magic constant for circular arc approximation: 4*(sqrt(2)-1)/3 */
const KAPPA = 0.5522847498;

/**
 * Produce the path operators for an approximate circle (4 cubic Bezier
 * curves).  Does NOT include the painting operator — call {@link stroke},
 * {@link fill}, or {@link fillAndStroke} afterwards.
 *
 * @param cx      Centre x.
 * @param cy      Centre y.
 * @param radius  Radius.
 */
export function circlePath(cx: number, cy: number, radius: number): string {
  const ox = radius * KAPPA; // control-point offset horizontal
  const oy = radius * KAPPA; // control-point offset vertical

  let ops = '';
  // Start at 12 o'clock
  ops += moveTo(cx, cy + radius);
  // 12 → 3
  ops += curveTo(cx + ox, cy + radius, cx + radius, cy + oy, cx + radius, cy);
  // 3 → 6
  ops += curveTo(cx + radius, cy - oy, cx + ox, cy - radius, cx, cy - radius);
  // 6 → 9
  ops += curveTo(cx - ox, cy - radius, cx - radius, cy - oy, cx - radius, cy);
  // 9 → 12
  ops += curveTo(cx - radius, cy + oy, cx - ox, cy + radius, cx, cy + radius);
  return ops;
}

/**
 * Produce the path operators for an approximate ellipse.
 *
 * @param cx  Centre x.
 * @param cy  Centre y.
 * @param rx  Horizontal radius.
 * @param ry  Vertical radius.
 */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;

  let ops = '';
  ops += moveTo(cx, cy + ry);
  ops += curveTo(cx + ox, cy + ry, cx + rx, cy + oy, cx + rx, cy);
  ops += curveTo(cx + rx, cy - oy, cx + ox, cy - ry, cx, cy - ry);
  ops += curveTo(cx - ox, cy - ry, cx - rx, cy - oy, cx - rx, cy);
  ops += curveTo(cx - rx, cy + oy, cx - ox, cy + ry, cx, cy + ry);
  return ops;
}

/**
 * @module core/operators/image
 *
 * PDF XObject invocation operators — places an image (or form) XObject
 * on the page.
 *
 * Reference: PDF 1.7 spec, §8.8 (External Objects).
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
// XObject invocation
// ---------------------------------------------------------------------------

/**
 * Invoke a named XObject (`Do`).
 *
 * The XObject must be listed in the page's `/Resources /XObject` dictionary
 * under `name`.  The leading slash is added automatically if absent.
 *
 * This is the fundamental operator for placing images on a page.  Callers
 * should first set up the transformation matrix (via `cm`) so that the
 * unit square `[0,0]–[1,1]` maps to the desired page rectangle.
 *
 * @param name  Resource name (e.g. `Im1` or `/Im1`).
 */
export function drawXObject(name: string): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return `${pdfName} Do\n`;
}

/**
 * Produce the full operator sequence to draw an image XObject at the
 * given position and dimensions.
 *
 * This emits:
 * 1. `q`  — save graphics state
 * 2. `cm` — transformation matrix that maps the image's unit square
 *    to the rectangle `(x, y, width, height)`
 * 3. `Do` — paint the XObject
 * 4. `Q`  — restore graphics state
 *
 * @param name    Resource name of the XObject (e.g. `Im1`).
 * @param x       Lower-left x coordinate of the image on the page.
 * @param y       Lower-left y coordinate of the image on the page.
 * @param width   Rendered width of the image.
 * @param height  Rendered height of the image.
 */
export function drawImageXObject(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return (
    'q\n' +
    `${n(width)} 0 0 ${n(height)} ${n(x)} ${n(y)} cm\n` +
    `${pdfName} Do\n` +
    'Q\n'
  );
}

/**
 * Produce the full operator sequence to draw an image XObject with an
 * arbitrary 6-component transformation matrix.
 *
 * The matrix maps the unit square to the target parallelogram:
 *
 * ```
 * [ a  b  0 ]
 * [ c  d  0 ]
 * [ tx ty 1 ]
 * ```
 *
 * @param name  Resource name of the XObject.
 * @param a     Horizontal scaling / rotation.
 * @param b     Rotation / skew component.
 * @param c     Rotation / skew component.
 * @param d     Vertical scaling / rotation.
 * @param tx    Horizontal translation.
 * @param ty    Vertical translation.
 */
export function drawImageWithMatrix(
  name: string,
  a: number,
  b: number,
  c: number,
  d: number,
  tx: number,
  ty: number,
): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return (
    'q\n' +
    `${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(tx)} ${n(ty)} cm\n` +
    `${pdfName} Do\n` +
    'Q\n'
  );
}

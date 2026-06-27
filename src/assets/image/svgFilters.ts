/**
 * @module assets/image/svgFilters
 *
 * SVG filter primitive evaluators operating on **8-bit RGBA8888** raster
 * buffers, so an SVG / raster pipeline can apply filter effects without a
 * full SVG engine.
 *
 * ## Colour model / premultiplication contract
 *
 * The public {@link RasterBuffer} carries **straight (non-premultiplied)**
 * RGBA8888 — i.e. the colour channels are the un-multiplied colour and the
 * 4th channel is the alpha, both 0..255. This matches the byte layout
 * produced by the PNG/WebP/TIFF decoders in this package and consumed by the
 * rasteriser.
 *
 * Individual primitives convert to whatever working space the maths require:
 *
 * - {@link feColorMatrix} / {@link feColorMatrixSaturate} operate on
 *   **straight** colour normalised to 0..1, per SVG 1.1 §15.10 (the matrix is
 *   applied to the un-premultiplied `[R G B A 1]` vector).
 * - {@link feGaussianBlur} blurs in **premultiplied** space (the
 *   mathematically correct space for averaging colours with varying alpha,
 *   SVG 1.1 §15.17) and un-premultiplies on the way out.
 * - {@link feComposite} (Porter-Duff) and {@link feBlend} composite in
 *   **premultiplied** space and return straight RGBA.
 *
 * All outputs are rounded and clamped to the [0, 255] integer range.
 *
 * ## Specifications verified
 *
 * - SVG 1.1 (Second Edition) §15.10 `feColorMatrix` — 4×5 (20-value) matrix
 *   applied per pixel over the normalised `[R, G, B, A, 1]` column vector;
 *   `saturate` shorthand coefficients 0.213 / 0.715 / 0.072.
 * - SVG 1.1 §15.17 `feGaussianBlur` — "three successive box-blurs" Gaussian
 *   approximation with box size `d = floor(s · 3 · √(2π) / 4 + 0.5)` and the
 *   odd/even centring rule.
 * - Porter & Duff, *"Compositing Digital Images"* (Computer Graphics 18(3),
 *   SIGGRAPH 1984) / SVG 1.1 §15.13 `feComposite` — over / in / out / atop /
 *   xor with `Fa`, `Fb` coefficients on premultiplied colour.
 *
 * No Buffer — Uint8Array exclusively. No fs. ESM only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A raster image buffer of straight (non-premultiplied) RGBA8888 pixels.
 *
 * `rgba` length MUST equal `width * height * 4`. Channel order is
 * `R, G, B, A` with each value in `0..255`.
 */
export interface RasterBuffer {
  /** Width in pixels (> 0). */
  width: number;
  /** Height in pixels (> 0). */
  height: number;
  /** Pixel data, length = `width * height * 4`, channel order R,G,B,A. */
  rgba: Uint8Array;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a number to the closed interval [0, 255] and round to an integer. */
function clamp8(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

/** Allocate a transparent-black buffer of the given dimensions. */
function allocBuffer(width: number, height: number): RasterBuffer {
  return { width, height, rgba: new Uint8Array(width * height * 4) };
}

/** Throw if two buffers differ in dimensions (an op needs them equal). */
function assertSameSize(a: RasterBuffer, b: RasterBuffer): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `svgFilters: buffer size mismatch (${a.width}x${a.height} vs ${b.width}x${b.height})`,
    );
  }
}

/**
 * Convert a straight RGBA8888 buffer to a premultiplied Float32Array in the
 * 0..1 range, channel order R,G,B,A. Premultiplying = colour × alpha.
 */
function toPremultipliedF32(src: RasterBuffer): Float32Array {
  const n = src.width * src.height;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = src.rgba[i * 4 + 3]! / 255;
    out[i * 4 + 0] = (src.rgba[i * 4 + 0]! / 255) * a;
    out[i * 4 + 1] = (src.rgba[i * 4 + 1]! / 255) * a;
    out[i * 4 + 2] = (src.rgba[i * 4 + 2]! / 255) * a;
    out[i * 4 + 3] = a;
  }
  return out;
}

/**
 * Convert a premultiplied Float32Array (0..1) back to a straight RGBA8888
 * RasterBuffer, un-premultiplying (colour ÷ alpha) and clamping.
 */
function fromPremultipliedF32(buf: Float32Array, width: number, height: number): RasterBuffer {
  const out = allocBuffer(width, height);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const a = buf[i * 4 + 3]!;
    if (a <= 0) {
      // Fully transparent: colour is undefined; emit transparent black.
      out.rgba[i * 4 + 0] = 0;
      out.rgba[i * 4 + 1] = 0;
      out.rgba[i * 4 + 2] = 0;
      out.rgba[i * 4 + 3] = 0;
    } else {
      out.rgba[i * 4 + 0] = clamp8((buf[i * 4 + 0]! / a) * 255);
      out.rgba[i * 4 + 1] = clamp8((buf[i * 4 + 1]! / a) * 255);
      out.rgba[i * 4 + 2] = clamp8((buf[i * 4 + 2]! / a) * 255);
      out.rgba[i * 4 + 3] = clamp8(a * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// feFlood — SVG 1.1 §15.12
// ---------------------------------------------------------------------------

/**
 * Produce a buffer filled with a single constant colour.
 *
 * Implements `feFlood` (SVG 1.1 §15.12): every pixel is set to the given
 * straight RGBA8888 colour.
 *
 * @param width  Output width in pixels (must be > 0).
 * @param height Output height in pixels (must be > 0).
 * @param rgba   The fill colour as `[R, G, B, A]`, each 0..255.
 * @returns      A new buffer of `width × height` filled with `rgba`.
 */
export function feFlood(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): RasterBuffer {
  if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`svgFilters.feFlood: invalid dimensions ${width}x${height}`);
  }
  const out = allocBuffer(width, height);
  const r = clamp8(rgba[0]);
  const g = clamp8(rgba[1]);
  const b = clamp8(rgba[2]);
  const a = clamp8(rgba[3]);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    out.rgba[i * 4 + 0] = r;
    out.rgba[i * 4 + 1] = g;
    out.rgba[i * 4 + 2] = b;
    out.rgba[i * 4 + 3] = a;
  }
  return out;
}

// ---------------------------------------------------------------------------
// feColorMatrix — SVG 1.1 §15.10
// ---------------------------------------------------------------------------

/**
 * Apply a 4×5 colour matrix to every pixel.
 *
 * Implements `feColorMatrix` with `type="matrix"` (SVG 1.1 §15.10). The 20
 * values are row-major:
 *
 * ```
 * | R' |   | m0  m1  m2  m3  m4  |   | R |
 * | G' |   | m5  m6  m7  m8  m9  |   | G |
 * | B' | = | m10 m11 m12 m13 m14 | · | B |
 * | A' |   | m15 m16 m17 m18 m19 |   | A |
 * | 1  |   ( the implicit identity row )    | 1 |
 * ```
 *
 * Channels are normalised to 0..1, the matrix is applied to the **straight**
 * (un-premultiplied) `[R, G, B, A, 1]` vector, then the result is scaled back
 * to 0..255 with clamping.
 *
 * @param src    Source buffer.
 * @param matrix Exactly 20 numbers (4 rows × 5 columns).
 * @returns      A new buffer with the matrix applied.
 * @throws If `matrix` does not contain exactly 20 values.
 */
export function feColorMatrix(src: RasterBuffer, matrix: number[]): RasterBuffer {
  if (matrix.length !== 20) {
    throw new Error(`svgFilters.feColorMatrix: matrix must have 20 values, got ${matrix.length}`);
  }
  const m = matrix;
  const out = allocBuffer(src.width, src.height);
  const n = src.width * src.height;
  for (let i = 0; i < n; i++) {
    const r = src.rgba[i * 4 + 0]! / 255;
    const g = src.rgba[i * 4 + 1]! / 255;
    const b = src.rgba[i * 4 + 2]! / 255;
    const a = src.rgba[i * 4 + 3]! / 255;

    const nr = m[0]! * r + m[1]! * g + m[2]! * b + m[3]! * a + m[4]!;
    const ng = m[5]! * r + m[6]! * g + m[7]! * b + m[8]! * a + m[9]!;
    const nb = m[10]! * r + m[11]! * g + m[12]! * b + m[13]! * a + m[14]!;
    const na = m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * a + m[19]!;

    out.rgba[i * 4 + 0] = clamp8(nr * 255);
    out.rgba[i * 4 + 1] = clamp8(ng * 255);
    out.rgba[i * 4 + 2] = clamp8(nb * 255);
    out.rgba[i * 4 + 3] = clamp8(na * 255);
  }
  return out;
}

/**
 * Apply the `saturate` shorthand colour matrix.
 *
 * Implements `feColorMatrix type="saturate"` (SVG 1.1 §15.10). The luma
 * coefficients are the spec's exact constants 0.213 (R), 0.715 (G),
 * 0.072 (B). `s = 1` is the identity; `s = 0` fully desaturates each pixel to
 * its luma (so R = G = B); `s > 1` over-saturates.
 *
 * The spec saturate matrix (rows R, G, B; alpha untouched):
 * ```
 * | 0.213+0.787s  0.715-0.715s  0.072-0.072s  0  0 |
 * | 0.213-0.213s  0.715+0.285s  0.072-0.072s  0  0 |
 * | 0.213-0.213s  0.715-0.715s  0.072+0.928s  0  0 |
 * | 0            0             0             1  0 |
 * ```
 *
 * @param src Source buffer.
 * @param s   Saturation factor (0 = greyscale, 1 = identity, >1 = boosted).
 * @returns   A new buffer with the saturate matrix applied.
 */
export function feColorMatrixSaturate(src: RasterBuffer, s: number): RasterBuffer {
  const rl = 0.213;
  const gl = 0.715;
  const bl = 0.072;
  const matrix: number[] = [
    rl + 0.787 * s, gl - gl * s, bl - bl * s, 0, 0,
    rl - rl * s, gl + 0.285 * s, bl - bl * s, 0, 0,
    rl - rl * s, gl - gl * s, bl + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
  return feColorMatrix(src, matrix);
}

// ---------------------------------------------------------------------------
// feOffset — SVG 1.1 §15.15
// ---------------------------------------------------------------------------

/**
 * Shift the image by an integer offset, leaving exposed edges transparent.
 *
 * Implements `feOffset` (SVG 1.1 §15.15). Pixels are copied to
 * `(x + dx, y + dy)`; destinations that fall outside the buffer are dropped
 * and exposed areas remain transparent black. `dx` / `dy` are rounded to the
 * nearest integer pixel.
 *
 * @param src Source buffer.
 * @param dx  Horizontal offset in pixels (positive = right).
 * @param dy  Vertical offset in pixels (positive = down).
 * @returns   A new buffer of the same size with the shifted content.
 */
export function feOffset(src: RasterBuffer, dx: number, dy: number): RasterBuffer {
  const out = allocBuffer(src.width, src.height);
  const idx = Math.round(dx);
  const idy = Math.round(dy);
  const { width, height } = src;
  for (let y = 0; y < height; y++) {
    const sy = y + idy;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < width; x++) {
      const sx = x + idx;
      if (sx < 0 || sx >= width) continue;
      const di = (sy * width + sx) * 4;
      const si = (y * width + x) * 4;
      out.rgba[di + 0] = src.rgba[si + 0]!;
      out.rgba[di + 1] = src.rgba[si + 1]!;
      out.rgba[di + 2] = src.rgba[si + 2]!;
      out.rgba[di + 3] = src.rgba[si + 3]!;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// feGaussianBlur — SVG 1.1 §15.17
// ---------------------------------------------------------------------------

/**
 * Compute the box size `d` for the three-box-blur approximation.
 *
 * SVG 1.1 §15.17: `d = floor(s · 3 · √(2π) / 4 + 0.5)`.
 */
function boxBlurD(stdDev: number): number {
  return Math.floor((stdDev * 3 * Math.sqrt(2 * Math.PI)) / 4 + 0.5);
}

/**
 * One horizontal box blur of the given (odd) length, premultiplied float
 * data, with an asymmetric left/right radius to support the even-`d` rule.
 * The window covers offsets `[-leftRadius, +rightRadius]` inclusive. Edge
 * samples are clamped (extend-edge) rather than treated as transparent so a
 * flat region stays flat.
 */
function boxBlurH(
  data: Float32Array,
  width: number,
  height: number,
  leftRadius: number,
  rightRadius: number,
): Float32Array {
  const out = new Float32Array(data.length);
  const windowLen = leftRadius + rightRadius + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      // Prime the running sum for x = 0.
      for (let k = -leftRadius; k <= rightRadius; k++) {
        const cx = k < 0 ? 0 : k >= width ? width - 1 : k;
        sum += data[(row + cx) * 4 + c]!;
      }
      for (let x = 0; x < width; x++) {
        out[(row + x) * 4 + c] = sum / windowLen;
        // Slide window: drop the leftmost, add the next-right.
        const dropX = x - leftRadius;
        const addX = x + rightRadius + 1;
        const dc = dropX < 0 ? 0 : dropX >= width ? width - 1 : dropX;
        const ac = addX < 0 ? 0 : addX >= width ? width - 1 : addX;
        sum += data[(row + ac) * 4 + c]! - data[(row + dc) * 4 + c]!;
      }
    }
  }
  return out;
}

/** One vertical box blur — the transpose of {@link boxBlurH}. */
function boxBlurV(
  data: Float32Array,
  width: number,
  height: number,
  topRadius: number,
  bottomRadius: number,
): Float32Array {
  const out = new Float32Array(data.length);
  const windowLen = topRadius + bottomRadius + 1;
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -topRadius; k <= bottomRadius; k++) {
        const cy = k < 0 ? 0 : k >= height ? height - 1 : k;
        sum += data[(cy * width + x) * 4 + c]!;
      }
      for (let y = 0; y < height; y++) {
        out[(y * width + x) * 4 + c] = sum / windowLen;
        const dropY = y - topRadius;
        const addY = y + bottomRadius + 1;
        const dc = dropY < 0 ? 0 : dropY >= height ? height - 1 : dropY;
        const ac = addY < 0 ? 0 : addY >= height ? height - 1 : addY;
        sum += data[(ac * width + x) * 4 + c]! - data[(dc * width + x) * 4 + c]!;
      }
    }
  }
  return out;
}

/**
 * Apply the three successive box blurs that approximate a Gaussian along one
 * axis, following the SVG 1.1 §15.17 odd/even centring rule for box size `d`.
 *
 * - `d` odd: three box blurs of size `d`, centred on the output pixel
 *   (`radius = (d-1)/2` each side).
 * - `d` even: two box blurs of size `d` (one offset left-of-centre, one
 *   right-of-centre) plus one box blur of size `d + 1` centred.
 * - `d <= 1`: identity (no perceivable blur on this axis).
 */
function threeBoxBlurAxis(
  data: Float32Array,
  width: number,
  height: number,
  d: number,
  horizontal: boolean,
): Float32Array {
  if (d <= 1) return data;
  const blur = horizontal ? boxBlurH : boxBlurV;
  if (d % 2 === 1) {
    const r = (d - 1) / 2;
    let cur = blur(data, width, height, r, r);
    cur = blur(cur, width, height, r, r);
    cur = blur(cur, width, height, r, r);
    return cur;
  }
  // Even d: two passes of size d with opposite half-pixel offsets, then d+1.
  const half = d / 2;
  // Size-d window: total length d => left+right+1 = d.
  // Pass 1 biased left: left = half, right = half - 1.
  let cur = blur(data, width, height, half, half - 1);
  // Pass 2 biased right: left = half - 1, right = half.
  cur = blur(cur, width, height, half - 1, half);
  // Pass 3 size d+1 centred: radius = d/2 each side (length = d+1).
  cur = blur(cur, width, height, half, half);
  return cur;
}

/**
 * Approximate a Gaussian blur via three successive box blurs.
 *
 * Implements `feGaussianBlur` (SVG 1.1 §15.17). The blur is performed in
 * **premultiplied** colour space (the correct space for averaging colours
 * with varying alpha) and un-premultiplied on output. A standard deviation of
 * 0 on an axis is a no-op for that axis.
 *
 * The per-axis box size is `d = floor(s · 3 · √(2π) / 4 + 0.5)` with the
 * spec's odd/even centring rule.
 *
 * @param src     Source buffer.
 * @param stdDevX Standard deviation along X (>= 0).
 * @param stdDevY Standard deviation along Y; defaults to `stdDevX`.
 * @returns       A new, blurred buffer of the same size.
 * @throws If either standard deviation is negative.
 */
export function feGaussianBlur(
  src: RasterBuffer,
  stdDevX: number,
  stdDevY?: number,
): RasterBuffer {
  const sx = stdDevX;
  const sy = stdDevY ?? stdDevX;
  if (sx < 0 || sy < 0 || Number.isNaN(sx) || Number.isNaN(sy)) {
    throw new Error(`svgFilters.feGaussianBlur: standard deviation must be >= 0 (got ${sx}, ${sy})`);
  }
  if (sx === 0 && sy === 0) {
    // No-op: return a copy to preserve the "new buffer" contract.
    return { width: src.width, height: src.height, rgba: src.rgba.slice() };
  }
  let data = toPremultipliedF32(src);
  if (sx > 0) {
    data = threeBoxBlurAxis(data, src.width, src.height, boxBlurD(sx), true);
  }
  if (sy > 0) {
    data = threeBoxBlurAxis(data, src.width, src.height, boxBlurD(sy), false);
  }
  return fromPremultipliedF32(data, src.width, src.height);
}

// ---------------------------------------------------------------------------
// feComposite — Porter-Duff (SVG 1.1 §15.13, Porter & Duff 1984)
// ---------------------------------------------------------------------------

/** Porter-Duff compositing operators supported by {@link feComposite}. */
export type CompositeOp = 'over' | 'in' | 'out' | 'atop' | 'xor';

/**
 * Composite two buffers with a Porter-Duff operator.
 *
 * Implements `feComposite` with operators `over`, `in`, `out`, `atop`, `xor`
 * (SVG 1.1 §15.13; Porter & Duff, SIGGRAPH 1984). The general form on
 * premultiplied colour is:
 *
 * ```
 * cr = ca · Fa + cb · Fb
 * ar = aa · Fa + ab · Fb
 * ```
 *
 * with coefficients (`aa`, `ab` = source/destination alpha):
 *
 * | op   | Fa        | Fb        |
 * | ---- | --------- | --------- |
 * | over | 1         | 1 − aa    |
 * | in   | ab        | 0         |
 * | out  | 1 − ab    | 0         |
 * | atop | ab        | 1 − aa    |
 * | xor  | 1 − ab    | 1 − aa    |
 *
 * Here `a` is the source (foreground) and `b` is the destination
 * (background). Both buffers must be the same size.
 *
 * @param a  Source (foreground) buffer.
 * @param b  Destination (background) buffer.
 * @param op Porter-Duff operator.
 * @returns  A new composited buffer of the same size.
 * @throws If the buffers differ in size.
 */
export function feComposite(a: RasterBuffer, b: RasterBuffer, op: CompositeOp): RasterBuffer {
  assertSameSize(a, b);
  const out = allocBuffer(a.width, a.height);
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const aa = a.rgba[i * 4 + 3]! / 255;
    const ab = b.rgba[i * 4 + 3]! / 255;

    // Premultiplied source / destination colour (0..1).
    const ar = (a.rgba[i * 4 + 0]! / 255) * aa;
    const ag = (a.rgba[i * 4 + 1]! / 255) * aa;
    const abl = (a.rgba[i * 4 + 2]! / 255) * aa;
    const br = (b.rgba[i * 4 + 0]! / 255) * ab;
    const bg = (b.rgba[i * 4 + 1]! / 255) * ab;
    const bb = (b.rgba[i * 4 + 2]! / 255) * ab;

    let fa: number;
    let fb: number;
    switch (op) {
      case 'over':
        fa = 1;
        fb = 1 - aa;
        break;
      case 'in':
        fa = ab;
        fb = 0;
        break;
      case 'out':
        fa = 1 - ab;
        fb = 0;
        break;
      case 'atop':
        fa = ab;
        fb = 1 - aa;
        break;
      case 'xor':
        fa = 1 - ab;
        fb = 1 - aa;
        break;
      default: {
        const never: never = op;
        throw new Error(`svgFilters.feComposite: unknown operator ${String(never)}`);
      }
    }

    const cr = ar * fa + br * fb;
    const cg = ag * fa + bg * fb;
    const cb = abl * fa + bb * fb;
    const car = aa * fa + ab * fb;

    if (car <= 0) {
      out.rgba[i * 4 + 0] = 0;
      out.rgba[i * 4 + 1] = 0;
      out.rgba[i * 4 + 2] = 0;
      out.rgba[i * 4 + 3] = 0;
    } else {
      // Un-premultiply.
      out.rgba[i * 4 + 0] = clamp8((cr / car) * 255);
      out.rgba[i * 4 + 1] = clamp8((cg / car) * 255);
      out.rgba[i * 4 + 2] = clamp8((cb / car) * 255);
      out.rgba[i * 4 + 3] = clamp8(car * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// feBlend — SVG 1.1 §15.11
// ---------------------------------------------------------------------------

/** Blend modes supported by {@link feBlend}. */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'darken' | 'lighten';

/**
 * Blend two buffers with one of the basic SVG 1.1 blend modes.
 *
 * Implements `feBlend` (SVG 1.1 §15.11). The spec defines the result on
 * **premultiplied** colour with `qa` = source alpha, `qb` = destination
 * alpha:
 *
 * - normal:   `cr = (1 − qa)·cb + ca`
 * - multiply: `cr = (1 − qa)·cb + (1 − qb)·ca + ca·cb`
 * - screen:   `cr = cb + ca − ca·cb`
 * - darken:   `cr = min((1 − qa)·cb + ca, (1 − qb)·ca + cb)`
 * - lighten:  `cr = max((1 − qa)·cb + ca, (1 − qb)·ca + cb)`
 *
 * with the common result alpha `ar = 1 − (1 − qa)·(1 − qb)`. Inputs `a`
 * (source) and `b` (destination) must be the same size.
 *
 * @param a    Source (top) buffer.
 * @param b    Destination (bottom) buffer.
 * @param mode Blend mode.
 * @returns    A new blended buffer of the same size.
 * @throws If the buffers differ in size.
 */
export function feBlend(a: RasterBuffer, b: RasterBuffer, mode: BlendMode): RasterBuffer {
  assertSameSize(a, b);
  const out = allocBuffer(a.width, a.height);
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const qa = a.rgba[i * 4 + 3]! / 255;
    const qb = b.rgba[i * 4 + 3]! / 255;
    const ar = 1 - (1 - qa) * (1 - qb);

    out.rgba[i * 4 + 3] = clamp8(ar * 255);

    for (let c = 0; c < 3; c++) {
      // Premultiplied source / destination channel.
      const ca = (a.rgba[i * 4 + c]! / 255) * qa;
      const cb = (b.rgba[i * 4 + c]! / 255) * qb;

      let cr: number;
      switch (mode) {
        case 'normal':
          cr = (1 - qa) * cb + ca;
          break;
        case 'multiply':
          cr = (1 - qa) * cb + (1 - qb) * ca + ca * cb;
          break;
        case 'screen':
          cr = cb + ca - ca * cb;
          break;
        case 'darken':
          cr = Math.min((1 - qa) * cb + ca, (1 - qb) * ca + cb);
          break;
        case 'lighten':
          cr = Math.max((1 - qa) * cb + ca, (1 - qb) * ca + cb);
          break;
        default: {
          const never: never = mode;
          throw new Error(`svgFilters.feBlend: unknown mode ${String(never)}`);
        }
      }

      // Un-premultiply by the result alpha for straight output.
      if (ar <= 0) {
        out.rgba[i * 4 + c] = 0;
      } else {
        out.rgba[i * 4 + c] = clamp8((cr / ar) * 255);
      }
    }
  }
  return out;
}

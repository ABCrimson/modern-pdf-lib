/**
 * @module core/operators/color
 *
 * PDF colour operators and convenience constructors for typed colour
 * values.
 *
 * Reference: PDF 1.7 spec, §8.6 (Colour Spaces).
 */

// ---------------------------------------------------------------------------
// Colour value types
// ---------------------------------------------------------------------------

/** An RGB colour with components in the range `[0, 1]`. */
export interface RgbColor {
  readonly type: 'rgb';
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** A CMYK colour with components in the range `[0, 1]`. */
export interface CmykColor {
  readonly type: 'cmyk';
  readonly c: number;
  readonly m: number;
  readonly y: number;
  readonly k: number;
}

/** A grayscale colour with the component in the range `[0, 1]`. */
export interface GrayscaleColor {
  readonly type: 'grayscale';
  readonly gray: number;
}

/** Union of all supported colour value types. */
export type Color = RgbColor | CmykColor | GrayscaleColor;

// ---------------------------------------------------------------------------
// Colour constructors
// ---------------------------------------------------------------------------

/**
 * Create an RGB colour.
 *
 * @param r  Red component `[0, 1]`.
 * @param g  Green component `[0, 1]`.
 * @param b  Blue component `[0, 1]`.
 */
export function rgb(r: number, g: number, b: number): RgbColor {
  return { type: 'rgb', r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

/**
 * Create a CMYK colour.
 *
 * @param c  Cyan component `[0, 1]`.
 * @param m  Magenta component `[0, 1]`.
 * @param y  Yellow component `[0, 1]`.
 * @param k  Black component `[0, 1]`.
 */
export function cmyk(c: number, m: number, y: number, k: number): CmykColor {
  return {
    type: 'cmyk',
    c: clamp01(c),
    m: clamp01(m),
    y: clamp01(y),
    k: clamp01(k),
  };
}

/**
 * Create a grayscale colour.
 *
 * @param gray  Gray level `[0, 1]` where 0 = black, 1 = white.
 */
export function grayscale(gray: number): GrayscaleColor {
  return { type: 'grayscale', gray: clamp01(gray) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Format a number for PDF output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// Fill colour operators
// ---------------------------------------------------------------------------

/**
 * Set the fill colour in the DeviceRGB colour space (`rg`).
 *
 * @param r  Red `[0, 1]`.
 * @param g  Green `[0, 1]`.
 * @param b  Blue `[0, 1]`.
 */
export function setFillColorRgb(r: number, g: number, b: number): string {
  return `${n(r)} ${n(g)} ${n(b)} rg\n`;
}

/**
 * Set the fill colour in the DeviceCMYK colour space (`k`).
 */
export function setFillColorCmyk(
  c: number,
  m: number,
  y: number,
  k: number,
): string {
  return `${n(c)} ${n(m)} ${n(y)} ${n(k)} k\n`;
}

/**
 * Set the fill colour in the DeviceGray colour space (`g`).
 */
export function setFillColorGray(gray: number): string {
  return `${n(gray)} g\n`;
}

// ---------------------------------------------------------------------------
// Stroke colour operators
// ---------------------------------------------------------------------------

/**
 * Set the stroke colour in the DeviceRGB colour space (`RG`).
 */
export function setStrokeColorRgb(r: number, g: number, b: number): string {
  return `${n(r)} ${n(g)} ${n(b)} RG\n`;
}

/**
 * Set the stroke colour in the DeviceCMYK colour space (`K`).
 */
export function setStrokeColorCmyk(
  c: number,
  m: number,
  y: number,
  k: number,
): string {
  return `${n(c)} ${n(m)} ${n(y)} ${n(k)} K\n`;
}

/**
 * Set the stroke colour in the DeviceGray colour space (`G`).
 */
export function setStrokeColorGray(gray: number): string {
  return `${n(gray)} G\n`;
}

// ---------------------------------------------------------------------------
// Colour space operator
// ---------------------------------------------------------------------------

/**
 * Set the current non-stroking colour space (`cs`).
 *
 * @param name  Colour space name (e.g. `DeviceRGB`, `DeviceCMYK`,
 *              `DeviceGray`, or a named resource).
 */
export function setColorSpace(name: string): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return `${pdfName} cs\n`;
}

/**
 * Set the current stroking colour space (`CS`).
 */
export function setStrokeColorSpace(name: string): string {
  const pdfName = name.startsWith('/') ? name : `/${name}`;
  return `${pdfName} CS\n`;
}

// ---------------------------------------------------------------------------
// Generic set-colour operator (SCN / scn)
// ---------------------------------------------------------------------------

/**
 * Set the non-stroking colour in the current colour space (`scn`).
 *
 * @param components  One or more colour components.
 */
export function setFillColor(...components: number[]): string {
  return `${components.map(n).join(' ')} scn\n`;
}

/**
 * Set the stroking colour in the current colour space (`SCN`).
 *
 * @param components  One or more colour components.
 */
export function setStrokeColor(...components: number[]): string {
  return `${components.map(n).join(' ')} SCN\n`;
}

// ---------------------------------------------------------------------------
// Convenience: apply a Color union to fill / stroke
// ---------------------------------------------------------------------------

/**
 * Emit the appropriate fill-colour operator for a {@link Color} value.
 */
export function applyFillColor(color: Color): string {
  switch (color.type) {
    case 'rgb':
      return setFillColorRgb(color.r, color.g, color.b);
    case 'cmyk':
      return setFillColorCmyk(color.c, color.m, color.y, color.k);
    case 'grayscale':
      return setFillColorGray(color.gray);
  }
}

/**
 * Emit the appropriate stroke-colour operator for a {@link Color} value.
 */
export function applyStrokeColor(color: Color): string {
  switch (color.type) {
    case 'rgb':
      return setStrokeColorRgb(color.r, color.g, color.b);
    case 'cmyk':
      return setStrokeColorCmyk(color.c, color.m, color.y, color.k);
    case 'grayscale':
      return setStrokeColorGray(color.gray);
  }
}

// ---------------------------------------------------------------------------
// Color ↔ component array conversion
// ---------------------------------------------------------------------------

/**
 * Convert a numeric component array to a typed {@link Color}.
 *
 * - 1 component → grayscale
 * - 3 components → RGB
 * - 4 components → CMYK
 *
 * @param components  Array of color component values `[0, 1]`.
 * @throws If the array length is not 1, 3, or 4.
 */
export function componentsToColor(components: number[]): Color {
  switch (components.length) {
    case 1:
      return grayscale(components[0]!);
    case 3:
      return rgb(components[0]!, components[1]!, components[2]!);
    case 4:
      return cmyk(components[0]!, components[1]!, components[2]!, components[3]!);
    default:
      throw new Error(
        `componentsToColor: expected 1, 3, or 4 components, got ${components.length}`,
      );
  }
}

/**
 * Convert a typed {@link Color} to a numeric component array.
 *
 * - Grayscale → `[gray]`
 * - RGB → `[r, g, b]`
 * - CMYK → `[c, m, y, k]`
 */
export function colorToComponents(color: Color): number[] {
  switch (color.type) {
    case 'grayscale':
      return [color.gray];
    case 'rgb':
      return [color.r, color.g, color.b];
    case 'cmyk':
      return [color.c, color.m, color.y, color.k];
  }
}

/**
 * Emit the appropriate fill-colour operator for a {@link Color} value.
 *
 * Alias for {@link applyFillColor} for pdf-lib API compatibility.
 */
export const setFillingColor = applyFillColor;

/**
 * Emit the appropriate stroke-colour operator for a {@link Color} value.
 *
 * Alias for {@link applyStrokeColor} for pdf-lib API compatibility.
 */
export const setStrokingColor = applyStrokeColor;

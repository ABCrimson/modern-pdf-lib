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

/** A spot (Separation) colour with a named colorant and a fallback. */
export interface SpotColor {
  readonly type: 'spot';
  /** Colorant name, e.g. `'PANTONE 185 C'`. */
  readonly name: string;
  /** Fallback colour used when the spot ink is unavailable. */
  readonly alternateColor: RgbColor | CmykColor | GrayscaleColor;
  /** Tint value `[0, 1]` — 0 = no ink, 1 = full ink. */
  readonly tint: number;
}

/** A DeviceN colour for multi-ink printing. */
export interface DeviceNColor {
  readonly type: 'devicen';
  /** Ordered list of colorant names. */
  readonly colorants: string[];
  /** Alternate colour space used for fallback rendering. */
  readonly alternateSpace: 'DeviceCMYK' | 'DeviceRGB';
  /** Tint value for each colorant `[0, 1]`. */
  readonly tints: number[];
}

/** Union of all supported colour value types. */
export type Color = RgbColor | CmykColor | GrayscaleColor | SpotColor | DeviceNColor;

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

/**
 * Create a spot (Separation) colour.
 *
 * Spot colours map to a named ink (e.g. a Pantone shade) with a
 * device-space fallback and a tint value that controls intensity.
 *
 * @param name       Colorant name, e.g. `'PANTONE 185 C'`.
 * @param alternate  Fallback colour (RGB, CMYK, or grayscale).
 * @param tint       Tint intensity `[0, 1]`.  Defaults to `1`.
 */
export function spotColor(
  name: string,
  alternate: RgbColor | CmykColor | GrayscaleColor,
  tint = 1,
): SpotColor {
  return { type: 'spot', name, alternateColor: alternate, tint: clamp01(tint) };
}

/**
 * Create a DeviceN colour for multi-ink printing.
 *
 * @param colorants       Ordered list of colorant names.
 * @param alternateSpace  Alternate colour space (`'DeviceCMYK'` or `'DeviceRGB'`).
 * @param tints           Tint value per colorant `[0, 1]`.
 */
export function deviceNColor(
  colorants: string[],
  alternateSpace: 'DeviceCMYK' | 'DeviceRGB',
  tints: number[],
): DeviceNColor {
  if (colorants.length !== tints.length) {
    throw new Error(
      `deviceNColor: colorants length (${colorants.length}) must match tints length (${tints.length})`,
    );
  }
  return {
    type: 'devicen',
    colorants: [...colorants],
    alternateSpace,
    tints: tints.map(clamp01),
  };
}

// ---------------------------------------------------------------------------
// Colour conversion utilities
// ---------------------------------------------------------------------------

/**
 * Convert RGB components to CMYK.
 *
 * Uses the standard RGB-to-CMYK formula:
 * ```
 * K = 1 - max(R, G, B)
 * C = (1 - R - K) / (1 - K)
 * M = (1 - G - K) / (1 - K)
 * Y = (1 - B - K) / (1 - K)
 * ```
 *
 * @returns A tuple `[C, M, Y, K]` with values in `[0, 1]`.
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number,
): [number, number, number, number] {
  r = clamp01(r);
  g = clamp01(g);
  b = clamp01(b);

  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];

  const inv = 1 / (1 - k);
  return [
    (1 - r - k) * inv,
    (1 - g - k) * inv,
    (1 - b - k) * inv,
    k,
  ];
}

/**
 * Convert CMYK components to RGB.
 *
 * Uses the standard CMYK-to-RGB formula:
 * ```
 * R = (1 - C) * (1 - K)
 * G = (1 - M) * (1 - K)
 * B = (1 - Y) * (1 - K)
 * ```
 *
 * @returns A tuple `[R, G, B]` with values in `[0, 1]`.
 */
export function cmykToRgb(
  c: number,
  m: number,
  y: number,
  k: number,
): [number, number, number] {
  c = clamp01(c);
  m = clamp01(m);
  y = clamp01(y);
  k = clamp01(k);

  const inv = 1 - k;
  return [
    (1 - c) * inv,
    (1 - m) * inv,
    (1 - y) * inv,
  ];
}

/**
 * Convert a base colour (RGB, CMYK, or grayscale) to a hex string.
 *
 * - RGB → `'#rrggbb'`
 * - CMYK → converted to RGB first, then `'#rrggbb'`
 * - Grayscale → `'#gggggg'`
 * - Spot → uses the alternate colour
 * - DeviceN → throws (no single representation)
 *
 * @returns A 7-character hex string like `'#ff0000'`.
 */
export function colorToHex(color: Color): string {
  switch (color.type) {
    case 'rgb':
      return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
    case 'cmyk': {
      const [r, g, b] = cmykToRgb(color.c, color.m, color.y, color.k);
      return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    }
    case 'grayscale':
      return `#${hex2(color.gray)}${hex2(color.gray)}${hex2(color.gray)}`;
    case 'spot':
      return colorToHex(color.alternateColor);
    case 'devicen':
      throw new Error('colorToHex: DeviceN colours have no single hex representation');
  }
}

/**
 * Parse a hex colour string into an {@link RgbColor}.
 *
 * Accepts `'#rgb'`, `'#rrggbb'`, `'rgb'`, or `'rrggbb'` formats.
 */
export function hexToColor(hex: string): RgbColor {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;

  // Expand shorthand (#abc → aabbcc)
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }

  if (h.length !== 6) {
    throw new Error(`hexToColor: invalid hex colour '${hex}'`);
  }

  const ri = Number.parseInt(h.slice(0, 2), 16);
  const gi = Number.parseInt(h.slice(2, 4), 16);
  const bi = Number.parseInt(h.slice(4, 6), 16);

  if (Number.isNaN(ri) || Number.isNaN(gi) || Number.isNaN(bi)) {
    throw new Error(`hexToColor: invalid hex colour '${hex}'`);
  }

  return rgb(ri / 255, gi / 255, bi / 255);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Convert a `[0, 1]` component to a 2-digit hex string. */
function hex2(v: number): string {
  return Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
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
 *
 * For spot colours, emits a `cs` (set colour space) followed by `scn`
 * (set colour in current space) using the spot colour's resource name.
 * The caller must ensure the Separation colour space is registered as
 * a page resource with the matching name.
 *
 * For DeviceN colours, emits `cs` + `scn` with the tint values.
 */
export function applyFillColor(color: Color): string {
  switch (color.type) {
    case 'rgb':
      return setFillColorRgb(color.r, color.g, color.b);
    case 'cmyk':
      return setFillColorCmyk(color.c, color.m, color.y, color.k);
    case 'grayscale':
      return setFillColorGray(color.gray);
    case 'spot':
      return setColorSpace(spotResourceName(color.name)) + setFillColor(color.tint);
    case 'devicen':
      return setColorSpace(deviceNResourceName(color.colorants)) + setFillColor(...color.tints);
  }
}

/**
 * Emit the appropriate stroke-colour operator for a {@link Color} value.
 *
 * For spot colours, emits a `CS` (set stroking colour space) followed
 * by `SCN` (set stroking colour in current space).
 *
 * For DeviceN colours, emits `CS` + `SCN` with the tint values.
 */
export function applyStrokeColor(color: Color): string {
  switch (color.type) {
    case 'rgb':
      return setStrokeColorRgb(color.r, color.g, color.b);
    case 'cmyk':
      return setStrokeColorCmyk(color.c, color.m, color.y, color.k);
    case 'grayscale':
      return setStrokeColorGray(color.gray);
    case 'spot':
      return setStrokeColorSpace(spotResourceName(color.name)) + setStrokeColor(color.tint);
    case 'devicen':
      return setStrokeColorSpace(deviceNResourceName(color.colorants)) + setStrokeColor(...color.tints);
  }
}

/**
 * Derive a PDF resource name from a spot colorant name.
 *
 * Replaces spaces and special characters with underscores to produce
 * a valid PDF name.
 *
 * @example
 * ```ts
 * spotResourceName('PANTONE 185 C') // 'CS_PANTONE_185_C'
 * ```
 */
export function spotResourceName(colorantName: string): string {
  return `CS_${colorantName.replaceAll(/[^A-Za-z0-9]/g, '_')}`;
}

/**
 * Derive a PDF resource name from a DeviceN colorant list.
 */
export function deviceNResourceName(colorants: string[]): string {
  return `CS_DN_${colorants.map((c) => c.replaceAll(/[^A-Za-z0-9]/g, '_')).join('_')}`;
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
 * - Spot → `[tint]`
 * - DeviceN → `[...tints]`
 */
export function colorToComponents(color: Color): number[] {
  switch (color.type) {
    case 'grayscale':
      return [color.gray];
    case 'rgb':
      return [color.r, color.g, color.b];
    case 'cmyk':
      return [color.c, color.m, color.y, color.k];
    case 'spot':
      return [color.tint];
    case 'devicen':
      return [...color.tints];
  }
}

/**
 * Emit the appropriate fill-colour operator for a {@link Color} value.
 *
 * @deprecated Use {@link applyFillColor} instead. This alias exists only
 *             for pdf-lib API compatibility and will be removed in v2.0.
 */
export const setFillingColor = applyFillColor;

/**
 * Emit the appropriate stroke-colour operator for a {@link Color} value.
 *
 * @deprecated Use {@link applyStrokeColor} instead. This alias exists only
 *             for pdf-lib API compatibility and will be removed in v2.0.
 */
export const setStrokingColor = applyStrokeColor;

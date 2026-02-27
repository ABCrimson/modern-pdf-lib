/**
 * PDF blend modes (PDF 1.4+, Table 136).
 * Applied via ExtGState /BM key.
 */
export const BlendMode = {
  Normal: 'Normal',
  Multiply: 'Multiply',
  Screen: 'Screen',
  Overlay: 'Overlay',
  Darken: 'Darken',
  Lighten: 'Lighten',
  ColorDodge: 'ColorDodge',
  ColorBurn: 'ColorBurn',
  HardLight: 'HardLight',
  SoftLight: 'SoftLight',
  Difference: 'Difference',
  Exclusion: 'Exclusion',
} as const;

/** A PDF blend mode name. */
export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];

/**
 * PDF text rendering modes (Table 106).
 * Applied via the Tr operator inside a text object.
 */
export const TextRenderingMode = {
  Fill: 0,
  Outline: 1,
  FillAndOutline: 2,
  Invisible: 3,
  FillAndClip: 4,
  OutlineAndClip: 5,
  FillAndOutlineAndClip: 6,
  Clip: 7,
} as const;

/** A PDF text rendering mode integer (0-7). */
export type TextRenderingMode = (typeof TextRenderingMode)[keyof typeof TextRenderingMode];

/**
 * PDF line cap styles (Table 54).
 * Applied via the J operator.
 */
export const LineCapStyle = {
  Butt: 0,
  Round: 1,
  Projecting: 2,
} as const;
export type LineCapStyle = (typeof LineCapStyle)[keyof typeof LineCapStyle];

/**
 * PDF line join styles (Table 55).
 * Applied via the j operator.
 */
export const LineJoinStyle = {
  Miter: 0,
  Round: 1,
  Bevel: 2,
} as const;
export type LineJoinStyle = (typeof LineJoinStyle)[keyof typeof LineJoinStyle];

/**
 * Text alignment for form fields and layout operations.
 */
export const TextAlignment = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;
export type TextAlignment = (typeof TextAlignment)[keyof typeof TextAlignment];

/**
 * Image alignment for layout operations.
 */
export const ImageAlignment = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;
export type ImageAlignment = (typeof ImageAlignment)[keyof typeof ImageAlignment];

/**
 * Preset parsing speeds — maps to objectsPerTick values in LoadPdfOptions.
 *
 * Lower values keep the main thread more responsive but parse more slowly.
 */
export const ParseSpeeds = {
  Fastest: Infinity,
  Fast: 500,
  Medium: 100,
  Slow: 10,
} as const;
export type ParseSpeeds = (typeof ParseSpeeds)[keyof typeof ParseSpeeds];

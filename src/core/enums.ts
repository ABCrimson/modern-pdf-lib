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

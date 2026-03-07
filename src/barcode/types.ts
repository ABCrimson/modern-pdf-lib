/**
 * @module barcode/types
 *
 * Shared types for barcode encoding and rendering.
 */

import type { Color } from '../core/operators/color.js';

/**
 * Encoded barcode data — a sequence of modules (bars and spaces).
 *
 * Each entry in `modules` is `true` for a dark bar and `false` for a
 * light space.  The `width` property gives the total number of modules.
 */
export interface BarcodeMatrix {
  /** Module pattern: `true` = dark bar, `false` = light space. */
  readonly modules: readonly boolean[];
  /** Total number of modules (= `modules.length`). */
  readonly width: number;
}

/**
 * Common options for rendering a barcode into PDF content-stream operators.
 */
export interface BarcodeOptions {
  /** Height of the bars in user-space units. Default: `50`. */
  readonly height?: number | undefined;
  /** Width of a single module in user-space units. Default: `1`. */
  readonly moduleWidth?: number | undefined;
  /** Quiet-zone width in modules on each side. Default: `10`. */
  readonly quietZone?: number | undefined;
  /** Bar colour. Default: grayscale black. */
  readonly color?: Color | undefined;
  /**
   * Whether to render human-readable text below the barcode.
   * Note: text rendering requires a font to be set in the content stream
   * beforehand.  Default: `false`.
   */
  readonly showText?: boolean | undefined;
  /** Font size for human-readable text. Default: `10`. */
  readonly fontSize?: number | undefined;
}

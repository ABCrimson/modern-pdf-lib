/**
 * @module types/options
 *
 * Public option interfaces for the modern-pdf API.
 *
 * These types are re-exported from the package root so that consumers
 * can import them for annotation purposes:
 *
 * ```ts
 * import type { PdfSaveOptions, DrawTextOptions } from 'modern-pdf';
 * ```
 *
 * Every optional field uses the `T | undefined` union with
 * `exactOptionalPropertyTypes` to be explicit about intent.
 */

import type { Color } from '../core/operators/color.js';
import type { Angle } from '../core/operators/state.js';

// ---------------------------------------------------------------------------
// Document-level options
// ---------------------------------------------------------------------------

/**
 * Options that control how the PDF binary is serialized.
 *
 * Passed to `PdfDocument.save()`.
 */
export interface PdfSaveOptions {
  /** Apply FlateDecode compression to streams. Default: `true`. */
  compress?: boolean | undefined;
  /**
   * Compression level for FlateDecode (1 = fastest, 9 = smallest).
   * Default: `6`.  Ignored when `compress` is `false`.
   */
  compressionLevel?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined;
  /**
   * When `true`, prefer WASM-accelerated compression if the WASM
   * module has been initialized via `initWasm()`.  Default: `false`.
   */
  useWasm?: boolean | undefined;
  /**
   * Minimum number of non-stream indirect objects before object streams
   * are used.  When the count exceeds this threshold, objects are packed
   * into compressed object streams and a cross-reference stream replaces
   * the traditional xref table.
   *
   * Set to `Infinity` to disable object streams (traditional xref).
   * A useful value for size reduction is `100`.
   *
   * Default: `Infinity` (disabled for backward compatibility).
   */
  objectStreamThreshold?: number | undefined;
}

// ---------------------------------------------------------------------------
// Drawing options — text
// ---------------------------------------------------------------------------

/**
 * Options for drawing text on a page.
 */
export interface DrawTextOptions {
  /** X coordinate of the text origin (default: `0`). */
  x?: number | undefined;
  /** Y coordinate of the text origin (default: `0`). */
  y?: number | undefined;
  /** Font resource name or a FontRef. */
  font?: string | undefined;
  /** Font size in points (default: `12`). */
  size?: number | undefined;
  /** Text fill colour (default: black). */
  color?: Color | undefined;
  /** Rotation angle around the text origin. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Line height for multi-line text (default: `size * 1.2`). */
  lineHeight?: number | undefined;
  /**
   * Maximum width in points before text is wrapped.
   * Text is broken at word boundaries; words exceeding `maxWidth` are
   * broken at character level.
   */
  maxWidth?: number | undefined;
}

// ---------------------------------------------------------------------------
// Drawing options — images
// ---------------------------------------------------------------------------

/**
 * Options for drawing an image on a page.
 */
export interface DrawImageOptions {
  /** X coordinate of the lower-left corner (default: `0`). */
  x?: number | undefined;
  /** Y coordinate of the lower-left corner (default: `0`). */
  y?: number | undefined;
  /** Rendered width in points (default: intrinsic image width). */
  width?: number | undefined;
  /** Rendered height in points (default: intrinsic image height). */
  height?: number | undefined;
  /** Rotation angle around the lower-left corner. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
}

// ---------------------------------------------------------------------------
// Drawing options — shapes
// ---------------------------------------------------------------------------

/**
 * Options for drawing a rectangle.
 */
export interface DrawRectangleOptions {
  /** X coordinate of the lower-left corner (default: `0`). */
  x?: number | undefined;
  /** Y coordinate of the lower-left corner (default: `0`). */
  y?: number | undefined;
  /** Rectangle width in points (default: `150`). */
  width?: number | undefined;
  /** Rectangle height in points (default: `100`). */
  height?: number | undefined;
  /** Fill colour. Set to `undefined` for stroke-only. */
  color?: Color | undefined;
  /** Stroke (border) colour. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Rotation angle about the rectangle centre. */
  rotate?: Angle | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
}

/**
 * Options for drawing a straight line.
 */
export interface DrawLineOptions {
  /** Start point of the line. */
  start: { x: number; y: number };
  /** End point of the line. */
  end: { x: number; y: number };
  /** Line thickness in points (default: `1`). */
  thickness?: number | undefined;
  /** Stroke colour (default: black). */
  color?: Color | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
  /** Dash pattern `[dashLen, gapLen, ...]`. */
  dashArray?: number[] | undefined;
  /** Dash phase offset. */
  dashPhase?: number | undefined;
}

/**
 * Options for drawing a circle.
 */
export interface DrawCircleOptions {
  /** Centre x coordinate (default: `0`). */
  x?: number | undefined;
  /** Centre y coordinate (default: `0`). */
  y?: number | undefined;
  /** Circle radius in points (default: `50`). */
  radius?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Stroke colour. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
}

/**
 * Options for drawing an ellipse.
 */
export interface DrawEllipseOptions {
  /** Centre x coordinate (default: `0`). */
  x?: number | undefined;
  /** Centre y coordinate (default: `0`). */
  y?: number | undefined;
  /** Horizontal radius (default: `100`). */
  xScale?: number | undefined;
  /** Vertical radius (default: `50`). */
  yScale?: number | undefined;
  /** Fill colour. */
  color?: Color | undefined;
  /** Stroke colour. */
  borderColor?: Color | undefined;
  /** Border width in points. */
  borderWidth?: number | undefined;
  /** Opacity `[0, 1]`. */
  opacity?: number | undefined;
}

// ---------------------------------------------------------------------------
// WASM initialization
// ---------------------------------------------------------------------------

/**
 * Options for `initWasm()`.
 *
 * Allows the caller to provide custom WASM binary locations or
 * pre-compiled modules for each subsystem.
 */
export interface InitWasmOptions {
  /**
   * URL or path to the deflate WASM binary.
   * When omitted the library attempts auto-detection relative to the
   * package installation.
   */
  deflateWasm?: string | URL | undefined;
  /**
   * URL or path to the PNG decoder WASM binary.
   */
  pngWasm?: string | URL | undefined;
  /**
   * URL or path to the font subsetter WASM binary.
   */
  fontWasm?: string | URL | undefined;
  /**
   * General WASM path prefix.  Individual `*Wasm` options override
   * this prefix for their respective modules.
   */
  wasmPath?: string | URL | undefined;
  /**
   * Pre-compiled `WebAssembly.Module` for deflate.
   * Skips the fetch + compile step.
   */
  deflate?: WebAssembly.Module | undefined;
  /**
   * Pre-compiled `WebAssembly.Module` for the PNG decoder.
   */
  png?: WebAssembly.Module | undefined;
  /**
   * Pre-compiled `WebAssembly.Module` for the font subsetter.
   */
  fonts?: WebAssembly.Module | undefined;
}

// ---------------------------------------------------------------------------
// Page size input
// ---------------------------------------------------------------------------

/** Well-known page size names (matching `PageSizes` keys). */
export type PredefinedPageSize =
  | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  | 'B4' | 'B5'
  | 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10'
  | 'RA0' | 'RA1' | 'RA2' | 'RA3' | 'RA4'
  | 'SRA0' | 'SRA1' | 'SRA2' | 'SRA3' | 'SRA4'
  | 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'Executive';

/**
 * Accepted page-size input types.
 *
 * - A `{ width, height }` object specifies an exact size in points.
 * - A predefined string (e.g. `'A4'`) maps to a well-known size.
 */
export type PageSizeInput =
  | { readonly width: number; readonly height: number }
  | PredefinedPageSize;

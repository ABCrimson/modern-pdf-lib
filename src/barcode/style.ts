/**
 * @module barcode/style
 *
 * Barcode styling utilities for consistent visual rendering.
 *
 * Provides higher-level functions that combine barcode encoding
 * with common styling options like human-readable text, colors,
 * quiet zones, and borders.
 */

import type { Color } from '../core/operators/color.js';
import { applyFillColor, applyStrokeColor } from '../core/operators/color.js';
import { saveState, restoreState } from '../core/operators/state.js';
import { rectangle, fill, stroke, setLineWidth } from '../core/operators/graphics.js';
import { beginText, endText, setFont, moveText, showText } from '../core/operators/text.js';
import type { BarcodeMatrix } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Full styling options for rendering a barcode with background,
 * borders, colours, and human-readable text.
 */
export interface StyledBarcodeOptions {
  /** Bar height in points. Default: 50. */
  readonly height?: number;
  /** Module width in points. Default: 1. */
  readonly moduleWidth?: number;
  /** Quiet zone in modules. Default: 10. */
  readonly quietZone?: number;
  /** Bar color. Default: black. */
  readonly color?: Color;
  /** Background color. Default: white. */
  readonly backgroundColor?: Color;
  /** Show human-readable text below the barcode. Default: false. */
  readonly showText?: boolean;
  /** Font name for human-readable text. Default: 'Helvetica'. */
  readonly fontName?: string;
  /** Font size for text. Default: 10. */
  readonly fontSize?: number;
  /** Text color. Default: same as bar color. */
  readonly textColor?: Color;
  /** Add a border around the barcode. Default: false. */
  readonly border?: boolean;
  /** Border width in points. Default: 0.5. */
  readonly borderWidth?: number;
  /** Border color. Default: black. */
  readonly borderColor?: Color;
  /** Padding inside border in points. Default: 4. */
  readonly padding?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 50;
const DEFAULT_MODULE_WIDTH = 1;
const DEFAULT_QUIET_ZONE = 10;
const DEFAULT_FONT_NAME = 'Helvetica';
const DEFAULT_FONT_SIZE = 10;
const DEFAULT_BORDER_WIDTH = 0.5;
const DEFAULT_PADDING = 4;
const DEFAULT_BAR_COLOR: Color = { type: 'grayscale', gray: 0 };
const DEFAULT_BG_COLOR: Color = { type: 'grayscale', gray: 1 };
const DEFAULT_BORDER_COLOR: Color = { type: 'grayscale', gray: 0 };

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the total dimensions of a styled barcode.
 *
 * Returns the outer bounding box including quiet zones, padding,
 * borders, and optional text area.
 *
 * @param matrix   The encoded barcode matrix.
 * @param options  Styling options.
 * @returns        `{ width, height }` in points.
 */
export function calculateBarcodeDimensions(
  matrix: BarcodeMatrix,
  options?: StyledBarcodeOptions,
): { width: number; height: number } {
  const moduleWidth = options?.moduleWidth ?? DEFAULT_MODULE_WIDTH;
  const quietZone = options?.quietZone ?? DEFAULT_QUIET_ZONE;
  const height = options?.height ?? DEFAULT_HEIGHT;
  const padding = options?.padding ?? (options?.border ? DEFAULT_PADDING : 0);
  const borderW = options?.border ? (options.borderWidth ?? DEFAULT_BORDER_WIDTH) : 0;
  const textHeight = options?.showText ? (options.fontSize ?? DEFAULT_FONT_SIZE) + 4 : 0;

  return {
    width: (matrix.width + quietZone * 2) * moduleWidth + padding * 2 + borderW * 2,
    height: height + textHeight + padding * 2 + borderW * 2,
  };
}

/**
 * Render a barcode matrix with full styling options.
 *
 * This combines the barcode modules with background, text,
 * border, and color options into a single set of PDF operators.
 * The result is wrapped in `q` / `Q` (save / restore graphics state)
 * for clean isolation.
 *
 * @param matrix   The encoded barcode matrix.
 * @param x        X coordinate of the barcode origin (lower-left of outer box).
 * @param y        Y coordinate of the barcode origin (lower-left of outer box).
 * @param text     Human-readable text to show below the bars (used only
 *                 when `options.showText` is `true`).
 * @param options  Styling options.
 * @returns        A string of PDF content-stream operators.
 */
export function renderStyledBarcode(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  text: string,
  options?: StyledBarcodeOptions,
): string {
  const height = options?.height ?? DEFAULT_HEIGHT;
  const moduleWidth = options?.moduleWidth ?? DEFAULT_MODULE_WIDTH;
  const quietZone = options?.quietZone ?? DEFAULT_QUIET_ZONE;
  const barColor = options?.color ?? DEFAULT_BAR_COLOR;
  const bgColor = options?.backgroundColor ?? DEFAULT_BG_COLOR;
  const showTextBelow = options?.showText ?? false;
  const fontName = options?.fontName ?? DEFAULT_FONT_NAME;
  const fontSize = options?.fontSize ?? DEFAULT_FONT_SIZE;
  const textColor = options?.textColor ?? barColor;
  const hasBorder = options?.border ?? false;
  const borderWidth = options?.borderWidth ?? DEFAULT_BORDER_WIDTH;
  const borderColor = options?.borderColor ?? DEFAULT_BORDER_COLOR;
  const padding = options?.padding ?? (hasBorder ? DEFAULT_PADDING : 0);

  const dims = calculateBarcodeDimensions(matrix, options);

  let ops = '';

  // --- Save graphics state ---
  ops += saveState();

  // --- 1. Background rectangle ---
  ops += applyFillColor(bgColor);
  ops += rectangle(x, y, dims.width, dims.height);
  ops += fill();

  // --- 2. Border ---
  if (hasBorder) {
    ops += setLineWidth(borderWidth);
    ops += applyStrokeColor(borderColor);
    // Inset the stroke by half the border width so it sits on the edge
    const halfBW = borderWidth / 2;
    ops += rectangle(
      x + halfBW,
      y + halfBW,
      dims.width - borderWidth,
      dims.height - borderWidth,
    );
    ops += stroke();
  }

  // --- 3. Bar rendering ---
  const borderOffset = hasBorder ? borderWidth : 0;
  const textAreaHeight = showTextBelow ? fontSize + 4 : 0;
  const barsX = x + borderOffset + padding + quietZone * moduleWidth;
  const barsY = y + borderOffset + padding + textAreaHeight;

  ops += applyFillColor(barColor);

  // Walk modules and merge contiguous dark runs into single rectangles
  let runStart = -1;
  for (let i = 0; i <= matrix.modules.length; i++) {
    const dark = i < matrix.modules.length && matrix.modules[i];
    if (dark && runStart < 0) {
      runStart = i;
    } else if (!dark && runStart >= 0) {
      const rx = barsX + runStart * moduleWidth;
      const rw = (i - runStart) * moduleWidth;
      ops += rectangle(rx, barsY, rw, height);
      runStart = -1;
    }
  }
  ops += fill();

  // --- 4. Human-readable text ---
  if (showTextBelow && text.length > 0) {
    const barcodePixelWidth = matrix.width * moduleWidth;
    // Estimate text width: fontSize * 0.5 * text.length (rough Helvetica average)
    const estimatedTextWidth = fontSize * 0.5 * text.length;
    const textX = barsX + (barcodePixelWidth - estimatedTextWidth) / 2;
    const textY = y + borderOffset + padding + 2; // 2pt above bottom padding

    ops += beginText();
    ops += setFont(fontName, fontSize);
    ops += applyFillColor(textColor);
    ops += moveText(textX, textY);
    ops += showText(text);
    ops += endText();
  }

  // --- Restore graphics state ---
  ops += restoreState();

  return ops;
}

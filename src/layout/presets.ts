/**
 * @module layout/presets
 *
 * Factory functions that return partial {@link DrawTableOptions} for
 * common table styles. Use {@link applyPreset} to merge a preset with
 * user-provided table options (user values always win).
 *
 * @packageDocumentation
 */

import type { DrawTableOptions } from './table.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A partial set of table options that can be applied as a style preset.
 * Excludes positional / data fields (`x`, `y`, `width`, `rows`) that
 * must always be supplied by the caller.
 */
export type TablePreset = Partial<Omit<DrawTableOptions, 'x' | 'y' | 'width' | 'rows'>>;

// ---------------------------------------------------------------------------
// Colour helpers (inline to avoid runtime import of color.ts factory fns)
// ---------------------------------------------------------------------------

function gray(value: number): Color {
  return { type: 'grayscale', gray: value } as const;
}

function rgbColor(r: number, g: number, b: number): Color {
  return { type: 'rgb', r, g, b } as const;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/**
 * Clean, minimal style — no cell borders, generous padding, dark-gray
 * header text.
 *
 * Good for reports and dashboards where visual clutter should be low.
 */
export function minimalPreset(): TablePreset {
  return {
    borderWidth: 0,
    padding: 8,
    fontSize: 11,
    headerRows: 1,
    headerTextColor: gray(0.2),
  };
}

/**
 * Alternating row background colours (white / light gray) with a dark
 * header row.
 *
 * A classic "zebra-stripe" look that improves readability for wide
 * tables.
 */
export function stripedPreset(): TablePreset {
  return {
    alternateRowColors: [gray(1), gray(0.95)] as readonly [Color, Color],
    headerRows: 1,
    headerBackgroundColor: gray(0.2),
    headerTextColor: gray(1),
    borderWidth: 0.5,
    borderColor: gray(0.85),
    padding: 6,
    fontSize: 11,
  };
}

/**
 * Full visible borders with a dark header row.
 *
 * Suitable for structured data where every cell boundary should be
 * clearly delineated.
 */
export function borderedPreset(): TablePreset {
  return {
    borderWidth: 1,
    borderColor: gray(0.3),
    headerRows: 1,
    headerBackgroundColor: gray(0.15),
    headerTextColor: gray(1),
    padding: 6,
    fontSize: 11,
  };
}

/**
 * Business / formal style — subtle alternating rows with a dark-blue
 * header.
 *
 * Ideal for invoices, financial reports, and formal documents.
 */
export function professionalPreset(): TablePreset {
  return {
    alternateRowColors: [gray(1), gray(0.97)] as readonly [Color, Color],
    headerRows: 1,
    headerBackgroundColor: rgbColor(0.16, 0.31, 0.52),
    headerTextColor: gray(1),
    borderWidth: 0.5,
    borderColor: gray(0.8),
    padding: 8,
    fontSize: 11,
  };
}

// ---------------------------------------------------------------------------
// Preset application helper
// ---------------------------------------------------------------------------

/**
 * Merge a preset with explicit table options.
 *
 * Values supplied in `options` always override the preset defaults —
 * the preset acts as a fallback layer beneath the caller's choices.
 *
 * @param preset  A partial options object returned by one of the
 *                preset factory functions.
 * @param options The caller's table options (must include `x`, `y`,
 *                `width`, and `rows` at minimum).
 * @returns       A fully-merged {@link DrawTableOptions} object.
 */
export function applyPreset(
  preset: TablePreset,
  options: DrawTableOptions,
): DrawTableOptions {
  return { ...preset, ...options };
}

// ---------------------------------------------------------------------------
// Named preset selector
// ---------------------------------------------------------------------------

/** Preset name for use with {@link applyTablePreset}. */
export type PresetName = 'minimal' | 'striped' | 'bordered' | 'professional';

/** Options to customise a named preset. */
export interface PresetOptions {
  /** Base font size. Default: 11. */
  readonly fontSize?: number;
  /** Primary color (used for headers, accents). */
  readonly primaryColor?: Color;
  /** Whether table has header row(s). Default: true. */
  readonly hasHeader?: boolean;
}

/**
 * Select a preset by name and optionally customise it.
 *
 * Returns a partial {@link DrawTableOptions} that can be spread into
 * the full options object.
 *
 * @param preset   One of 'minimal', 'striped', 'bordered', 'professional'.
 * @param options  Optional overrides for font size and primary color.
 */
export function applyTablePreset(
  preset: PresetName,
  options?: PresetOptions,
): Partial<DrawTableOptions> {
  switch (preset) {
    case 'minimal':
      return {
        borderWidth: 0,
        padding: 6,
        fontSize: options?.fontSize ?? 11,
      };

    case 'striped':
      return {
        borderWidth: 0,
        padding: 8,
        fontSize: options?.fontSize ?? 11,
        alternateRowColors: [
          { type: 'grayscale', gray: 1 },
          { type: 'grayscale', gray: 0.95 },
        ],
        headerBackgroundColor: options?.primaryColor ?? {
          type: 'rgb',
          r: 0.2,
          g: 0.3,
          b: 0.5,
        },
        headerTextColor: { type: 'grayscale', gray: 1 },
      };

    case 'bordered':
      return {
        borderWidth: 1,
        borderColor: { type: 'grayscale', gray: 0.3 },
        padding: 6,
        fontSize: options?.fontSize ?? 11,
        headerBackgroundColor: options?.primaryColor ?? {
          type: 'grayscale',
          gray: 0.85,
        },
      };

    case 'professional':
      return {
        borderWidth: 0.5,
        borderColor: { type: 'grayscale', gray: 0.7 },
        padding: 8,
        fontSize: options?.fontSize ?? 10,
        alternateRowColors: [
          { type: 'grayscale', gray: 1 },
          { type: 'grayscale', gray: 0.97 },
        ],
        headerBackgroundColor: options?.primaryColor ?? {
          type: 'rgb',
          r: 0.15,
          g: 0.25,
          b: 0.4,
        },
        headerTextColor: { type: 'grayscale', gray: 1 },
      };
  }
}

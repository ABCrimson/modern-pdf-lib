/**
 * Tests for table styling presets.
 *
 * Covers minimalPreset, stripedPreset, borderedPreset, professionalPreset,
 * and the applyPreset helper.
 */

import { describe, it, expect } from 'vitest';
import {
  minimalPreset,
  stripedPreset,
  borderedPreset,
  professionalPreset,
  applyPreset,
  applyTablePreset,
} from '../../src/layout/presets.js';
import type { TablePreset } from '../../src/layout/presets.js';
import { renderTable } from '../../src/layout/table.js';
import type { DrawTableOptions } from '../../src/layout/table.js';
import type { Color } from '../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseOptions(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 500,
    rows: [
      { cells: ['Name', 'Age', 'City'] },
      { cells: ['Alice', '30', 'London'] },
      { cells: ['Bob', '25', 'Paris'] },
      { cells: ['Carol', '35', 'Berlin'] },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// minimalPreset
// ---------------------------------------------------------------------------

describe('minimalPreset', () => {
  // 1
  it('returns an object with expected properties', () => {
    const preset = minimalPreset();
    expect(preset.borderWidth).toBe(0);
    expect(preset.padding).toBe(8);
    expect(preset.fontSize).toBe(11);
    expect(preset.headerRows).toBe(1);
  });

  // 2
  it('sets headerTextColor to dark gray', () => {
    const preset = minimalPreset();
    expect(preset.headerTextColor).toEqual({ type: 'grayscale', gray: 0.2 });
  });

  // 3
  it('does not set headerBackgroundColor', () => {
    const preset = minimalPreset();
    expect(preset.headerBackgroundColor).toBeUndefined();
  });

  // 4
  it('produces valid operator output when rendered', () => {
    const opts = applyPreset(minimalPreset(), baseOptions());
    const { ops, result } = renderTable(opts);
    expect(ops.length).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// stripedPreset
// ---------------------------------------------------------------------------

describe('stripedPreset', () => {
  // 5
  it('returns an object with expected properties', () => {
    const preset = stripedPreset();
    expect(preset.borderWidth).toBe(0.5);
    expect(preset.padding).toBe(6);
    expect(preset.fontSize).toBe(11);
    expect(preset.headerRows).toBe(1);
  });

  // 6
  it('uses alternating white / light-gray row colours', () => {
    const preset = stripedPreset();
    expect(preset.alternateRowColors).toBeDefined();
    const [even, odd] = preset.alternateRowColors!;
    expect(even).toEqual({ type: 'grayscale', gray: 1 });
    expect(odd).toEqual({ type: 'grayscale', gray: 0.95 });
  });

  // 7
  it('sets dark header background and white header text', () => {
    const preset = stripedPreset();
    expect(preset.headerBackgroundColor).toEqual({ type: 'grayscale', gray: 0.2 });
    expect(preset.headerTextColor).toEqual({ type: 'grayscale', gray: 1 });
  });

  // 8
  it('renders alternating row background operators', () => {
    const opts = applyPreset(stripedPreset(), baseOptions());
    const { ops } = renderTable(opts);
    // gray 0.2 for header background
    expect(ops).toContain('0.2 g');
    // gray 1 for even data rows
    expect(ops).toContain('1 g');
    // gray 0.95 for odd data rows
    expect(ops).toContain('0.95 g');
  });
});

// ---------------------------------------------------------------------------
// borderedPreset
// ---------------------------------------------------------------------------

describe('borderedPreset', () => {
  // 9
  it('returns an object with expected properties', () => {
    const preset = borderedPreset();
    expect(preset.borderWidth).toBe(1);
    expect(preset.padding).toBe(6);
    expect(preset.fontSize).toBe(11);
    expect(preset.headerRows).toBe(1);
  });

  // 10
  it('uses dark border and header colours', () => {
    const preset = borderedPreset();
    expect(preset.borderColor).toEqual({ type: 'grayscale', gray: 0.3 });
    expect(preset.headerBackgroundColor).toEqual({ type: 'grayscale', gray: 0.15 });
    expect(preset.headerTextColor).toEqual({ type: 'grayscale', gray: 1 });
  });

  // 11
  it('renders border operators with width 1', () => {
    const opts = applyPreset(borderedPreset(), baseOptions());
    const { ops } = renderTable(opts);
    // setLineWidth(1) emits "1 w"
    expect(ops).toContain('1 w');
    // stroke operator
    expect(ops).toContain('S\n');
  });
});

// ---------------------------------------------------------------------------
// professionalPreset
// ---------------------------------------------------------------------------

describe('professionalPreset', () => {
  // 12
  it('returns an object with expected properties', () => {
    const preset = professionalPreset();
    expect(preset.borderWidth).toBe(0.5);
    expect(preset.padding).toBe(8);
    expect(preset.fontSize).toBe(11);
    expect(preset.headerRows).toBe(1);
  });

  // 13
  it('uses dark-blue header background as RGB', () => {
    const preset = professionalPreset();
    const bg = preset.headerBackgroundColor as { type: 'rgb'; r: number; g: number; b: number };
    expect(bg.type).toBe('rgb');
    expect(bg.r).toBeCloseTo(0.16);
    expect(bg.g).toBeCloseTo(0.31);
    expect(bg.b).toBeCloseTo(0.52);
  });

  // 14
  it('renders header background using RGB operator', () => {
    const opts = applyPreset(professionalPreset(), baseOptions());
    const { ops } = renderTable(opts);
    // rgb fill: "0.16 0.31 0.52 rg"
    expect(ops).toContain('0.16 0.31 0.52 rg');
  });
});

// ---------------------------------------------------------------------------
// applyPreset
// ---------------------------------------------------------------------------

describe('applyPreset', () => {
  // 15
  it('user options override preset values', () => {
    const preset = stripedPreset();
    const userOpts = baseOptions({ fontSize: 14, padding: 10 });
    const merged = applyPreset(preset, userOpts);
    expect(merged.fontSize).toBe(14);
    expect(merged.padding).toBe(10);
    // User-provided positional values preserved
    expect(merged.x).toBe(50);
    expect(merged.y).toBe(700);
    expect(merged.width).toBe(500);
  });

  // 16
  it('preset values fill in when user does not specify them', () => {
    const preset = borderedPreset();
    const userOpts = baseOptions();
    const merged = applyPreset(preset, userOpts);
    // borderWidth comes from preset because user did not specify it
    expect(merged.borderWidth).toBe(1);
    expect(merged.headerRows).toBe(1);
    expect(merged.headerBackgroundColor).toEqual({ type: 'grayscale', gray: 0.15 });
  });

  // 17
  it('returns a valid DrawTableOptions that renderTable accepts', () => {
    const opts = applyPreset(professionalPreset(), baseOptions());
    const { ops, result } = renderTable(opts);
    expect(typeof ops).toBe('string');
    expect(result.rowHeights.length).toBe(4);
    expect(result.columnWidths.length).toBe(3);
    expect(result.pagesUsed).toBe(1);
  });

  // 18
  it('does not mutate the original preset or options', () => {
    const preset = minimalPreset();
    const opts = baseOptions();
    const presetCopy = { ...preset };
    const optsCopy = { ...opts };
    applyPreset(preset, opts);
    expect(preset).toEqual(presetCopy);
    expect(opts).toEqual(optsCopy);
  });

  // 19
  it('each preset factory returns a fresh object', () => {
    const a = minimalPreset();
    const b = minimalPreset();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);

    const c = stripedPreset();
    const d = stripedPreset();
    expect(c).not.toBe(d);
    expect(c).toEqual(d);
  });

  // 20
  it('all four presets can be rendered without errors', () => {
    const presets: TablePreset[] = [
      minimalPreset(),
      stripedPreset(),
      borderedPreset(),
      professionalPreset(),
    ];
    for (const preset of presets) {
      const opts = applyPreset(preset, baseOptions());
      expect(() => renderTable(opts)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// applyTablePreset (named-preset API)
// ---------------------------------------------------------------------------

describe('applyTablePreset', () => {
  // 21
  it('returns partial DrawTableOptions for each named preset', () => {
    const result = applyTablePreset('minimal');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  // 22
  it('minimal preset has borderWidth 0', () => {
    const result = applyTablePreset('minimal');
    expect(result.borderWidth).toBe(0);
  });

  // 23
  it('striped preset has alternateRowColors', () => {
    const result = applyTablePreset('striped');
    expect(result.alternateRowColors).toBeDefined();
    expect(result.alternateRowColors).toHaveLength(2);
    expect(result.headerBackgroundColor).toBeDefined();
    expect(result.headerTextColor).toBeDefined();
  });

  // 24
  it('bordered preset has borderWidth 1 and borderColor', () => {
    const result = applyTablePreset('bordered');
    expect(result.borderWidth).toBe(1);
    expect(result.borderColor).toBeDefined();
  });

  // 25
  it('professional preset has header styling and alternating rows', () => {
    const result = applyTablePreset('professional');
    expect(result.headerBackgroundColor).toBeDefined();
    expect(result.headerTextColor).toBeDefined();
    expect(result.alternateRowColors).toBeDefined();
    expect(result.fontSize).toBe(10);
  });

  // 26
  it('custom primaryColor overrides header background', () => {
    const custom: Color = { type: 'rgb', r: 0.9, g: 0.1, b: 0.2 };
    const result = applyTablePreset('striped', { primaryColor: custom });
    expect(result.headerBackgroundColor).toEqual(custom);
  });

  // 27
  it('custom fontSize overrides preset default', () => {
    const result = applyTablePreset('professional', { fontSize: 14 });
    expect(result.fontSize).toBe(14);
  });

  // 28
  it('all 4 named presets return valid options', () => {
    const names = ['minimal', 'striped', 'bordered', 'professional'] as const;
    for (const name of names) {
      const result = applyTablePreset(name);
      expect(result).toBeDefined();
      expect(result.fontSize !== undefined || result.borderWidth !== undefined).toBe(true);
    }
  });

  // 29
  it('presets can be spread into renderTable options', () => {
    const preset = applyTablePreset('bordered');
    const opts: DrawTableOptions = {
      ...preset,
      x: 50,
      y: 700,
      width: 500,
      rows: [{ cells: ['A', 'B'] }],
    };
    expect(() => renderTable(opts)).not.toThrow();
  });
});

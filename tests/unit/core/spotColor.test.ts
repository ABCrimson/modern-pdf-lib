/**
 * Tests for spot colour support, DeviceN colour spaces, colour
 * conversion utilities, and hex colour parsing.
 *
 * Covers:
 * - spotColor() constructor with CMYK, RGB, and grayscale alternates
 * - deviceNColor() constructor and validation
 * - applyFillColor / applyStrokeColor with spot and DeviceN colours
 * - RGB <-> CMYK conversion accuracy
 * - colorToHex / hexToColor round-trips
 * - buildSeparationColorSpace() PDF array structure
 * - buildDeviceNColorSpace() PDF array structure
 * - colorToComponents for new types
 * - spotResourceName / deviceNResourceName
 */

import { describe, it, expect } from 'vitest';
import {
  rgb,
  cmyk,
  grayscale,
  spotColor,
  deviceNColor,
  rgbToCmyk,
  cmykToRgb,
  colorToHex,
  hexToColor,
  applyFillColor,
  applyStrokeColor,
  colorToComponents,
  spotResourceName,
  deviceNResourceName,
} from '../../../src/core/operators/color.js';
import {
  buildSeparationColorSpace,
  buildDeviceNColorSpace,
} from '../../../src/core/operators/spotColor.js';
import {
  PdfName,
  PdfStream,
  PdfArray,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// spotColor() constructor
// ---------------------------------------------------------------------------

describe('spotColor()', () => {
  it('creates a spot colour with a CMYK alternate', () => {
    const alt = cmyk(0, 0.91, 0.76, 0);
    const sc = spotColor('PANTONE 185 C', alt);

    expect(sc.type).toBe('spot');
    expect(sc.name).toBe('PANTONE 185 C');
    expect(sc.alternateColor).toEqual(alt);
    expect(sc.tint).toBe(1);
  });

  it('creates a spot colour with an RGB alternate', () => {
    const alt = rgb(1, 0, 0);
    const sc = spotColor('Red Spot', alt, 0.75);

    expect(sc.type).toBe('spot');
    expect(sc.name).toBe('Red Spot');
    expect(sc.alternateColor).toEqual(alt);
    expect(sc.tint).toBe(0.75);
  });

  it('creates a spot colour with a grayscale alternate', () => {
    const alt = grayscale(0.5);
    const sc = spotColor('Gray Ink', alt, 0.3);

    expect(sc.type).toBe('spot');
    expect(sc.tint).toBeCloseTo(0.3, 10);
  });

  it('clamps tint to [0, 1]', () => {
    const alt = cmyk(1, 0, 0, 0);
    expect(spotColor('Cyan', alt, -0.5).tint).toBe(0);
    expect(spotColor('Cyan', alt, 2.0).tint).toBe(1);
  });

  it('defaults tint to 1 when omitted', () => {
    const alt = cmyk(0, 0, 0, 1);
    expect(spotColor('Black', alt).tint).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deviceNColor() constructor
// ---------------------------------------------------------------------------

describe('deviceNColor()', () => {
  it('creates a DeviceN colour with matching colorants and tints', () => {
    const dn = deviceNColor(
      ['Cyan', 'Magenta', 'Yellow', 'Black'],
      'DeviceCMYK',
      [1, 0.5, 0, 0],
    );

    expect(dn.type).toBe('devicen');
    expect(dn.colorants).toEqual(['Cyan', 'Magenta', 'Yellow', 'Black']);
    expect(dn.alternateSpace).toBe('DeviceCMYK');
    expect(dn.tints).toEqual([1, 0.5, 0, 0]);
  });

  it('clamps tint values to [0, 1]', () => {
    const dn = deviceNColor(['A', 'B'], 'DeviceRGB', [-1, 5]);
    expect(dn.tints).toEqual([0, 1]);
  });

  it('throws when colorant and tint counts mismatch', () => {
    expect(() => deviceNColor(['A', 'B'], 'DeviceCMYK', [1])).toThrow(
      /colorants length.*must match tints length/,
    );
  });

  it('does not expose the original arrays (defensive copy)', () => {
    const colorants = ['A', 'B'];
    const tints = [0.5, 0.5];
    const dn = deviceNColor(colorants, 'DeviceRGB', tints);
    colorants.push('C');
    tints.push(1);
    expect(dn.colorants).toEqual(['A', 'B']);
    expect(dn.tints).toEqual([0.5, 0.5]);
  });
});

// ---------------------------------------------------------------------------
// applyFillColor / applyStrokeColor with spot and DeviceN
// ---------------------------------------------------------------------------

describe('applyFillColor with spot colour', () => {
  it('emits cs + scn operators for spot colour', () => {
    const sc = spotColor('PANTONE 185 C', cmyk(0, 0.91, 0.76, 0), 0.8);
    const ops = applyFillColor(sc);

    // Should set the colour space to the resource name
    expect(ops).toContain('/CS_PANTONE_185_C cs\n');
    // Should set the tint value
    expect(ops).toContain('0.8 scn\n');
  });

  it('emits cs + scn operators for DeviceN colour', () => {
    const dn = deviceNColor(['Cyan', 'Magenta'], 'DeviceCMYK', [1, 0.5]);
    const ops = applyFillColor(dn);

    expect(ops).toContain('/CS_DN_Cyan_Magenta cs\n');
    expect(ops).toContain('1 0.5 scn\n');
  });
});

describe('applyStrokeColor with spot colour', () => {
  it('emits CS + SCN operators for spot colour', () => {
    const sc = spotColor('Varnish', rgb(1, 1, 1), 1);
    const ops = applyStrokeColor(sc);

    expect(ops).toContain('/CS_Varnish CS\n');
    expect(ops).toContain('1 SCN\n');
  });

  it('emits CS + SCN operators for DeviceN colour', () => {
    const dn = deviceNColor(['Red', 'Green', 'Blue'], 'DeviceRGB', [0.2, 0.4, 0.6]);
    const ops = applyStrokeColor(dn);

    expect(ops).toContain('/CS_DN_Red_Green_Blue CS\n');
    expect(ops).toContain('0.2 0.4 0.6 SCN\n');
  });
});

// ---------------------------------------------------------------------------
// RGB <-> CMYK conversion accuracy
// ---------------------------------------------------------------------------

describe('rgbToCmyk()', () => {
  it('converts pure red correctly', () => {
    const [c, m, y, k] = rgbToCmyk(1, 0, 0);
    expect(c).toBeCloseTo(0, 10);
    expect(m).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(k).toBeCloseTo(0, 10);
  });

  it('converts pure green correctly', () => {
    const [c, m, y, k] = rgbToCmyk(0, 1, 0);
    expect(c).toBeCloseTo(1, 10);
    expect(m).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(k).toBeCloseTo(0, 10);
  });

  it('converts pure blue correctly', () => {
    const [c, m, y, k] = rgbToCmyk(0, 0, 1);
    expect(c).toBeCloseTo(1, 10);
    expect(m).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(k).toBeCloseTo(0, 10);
  });

  it('converts white correctly', () => {
    const [c, m, y, k] = rgbToCmyk(1, 1, 1);
    expect(c).toBe(0);
    expect(m).toBe(0);
    expect(y).toBe(0);
    expect(k).toBe(0);
  });

  it('converts black correctly', () => {
    const [c, m, y, k] = rgbToCmyk(0, 0, 0);
    expect(c).toBe(0);
    expect(m).toBe(0);
    expect(y).toBe(0);
    expect(k).toBe(1);
  });

  it('handles a mid-range colour', () => {
    // RGB (0.5, 0.25, 0.75) — purple-ish
    const [c, m, y, k] = rgbToCmyk(0.5, 0.25, 0.75);
    // K = 1 - max(0.5, 0.25, 0.75) = 0.25
    expect(k).toBeCloseTo(0.25, 10);
    // C = (1 - 0.5 - 0.25) / 0.75 = 0.333...
    expect(c).toBeCloseTo(1 / 3, 5);
    // M = (1 - 0.25 - 0.25) / 0.75 = 0.666...
    expect(m).toBeCloseTo(2 / 3, 5);
    // Y = (1 - 0.75 - 0.25) / 0.75 = 0
    expect(y).toBeCloseTo(0, 10);
  });

  it('clamps out-of-range inputs', () => {
    const [c, m, y, k] = rgbToCmyk(2, -1, 0.5);
    // clamped to (1, 0, 0.5) — same as red-ish
    expect(k).toBeCloseTo(0, 10); // max(1, 0, 0.5) = 1
    expect(c).toBeCloseTo(0, 10);
  });
});

describe('cmykToRgb()', () => {
  it('converts pure cyan correctly', () => {
    const [r, g, b] = cmykToRgb(1, 0, 0, 0);
    expect(r).toBeCloseTo(0, 10);
    expect(g).toBeCloseTo(1, 10);
    expect(b).toBeCloseTo(1, 10);
  });

  it('converts pure magenta correctly', () => {
    const [r, g, b] = cmykToRgb(0, 1, 0, 0);
    expect(r).toBeCloseTo(1, 10);
    expect(g).toBeCloseTo(0, 10);
    expect(b).toBeCloseTo(1, 10);
  });

  it('converts pure yellow correctly', () => {
    const [r, g, b] = cmykToRgb(0, 0, 1, 0);
    expect(r).toBeCloseTo(1, 10);
    expect(g).toBeCloseTo(1, 10);
    expect(b).toBeCloseTo(0, 10);
  });

  it('converts pure black correctly', () => {
    const [r, g, b] = cmykToRgb(0, 0, 0, 1);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('converts white correctly', () => {
    const [r, g, b] = cmykToRgb(0, 0, 0, 0);
    expect(r).toBe(1);
    expect(g).toBe(1);
    expect(b).toBe(1);
  });
});

describe('RGB <-> CMYK round-trip', () => {
  it('round-trips through rgbToCmyk and cmykToRgb', () => {
    const cases = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.5, 0.5, 0.5],
      [0.2, 0.8, 0.4],
      [1, 1, 1],
    ] as const;

    for (const [r, g, b] of cases) {
      const [c, m, y, k] = rgbToCmyk(r, g, b);
      const [r2, g2, b2] = cmykToRgb(c, m, y, k);
      expect(r2).toBeCloseTo(r, 10);
      expect(g2).toBeCloseTo(g, 10);
      expect(b2).toBeCloseTo(b, 10);
    }
  });

  // Black (0,0,0) maps to K=1 which maps back to (0,0,0)
  it('round-trips black correctly', () => {
    const [c, m, y, k] = rgbToCmyk(0, 0, 0);
    const [r, g, b] = cmykToRgb(c, m, y, k);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// colorToHex / hexToColor
// ---------------------------------------------------------------------------

describe('colorToHex()', () => {
  it('converts RGB red to #ff0000', () => {
    expect(colorToHex(rgb(1, 0, 0))).toBe('#ff0000');
  });

  it('converts RGB white to #ffffff', () => {
    expect(colorToHex(rgb(1, 1, 1))).toBe('#ffffff');
  });

  it('converts RGB black to #000000', () => {
    expect(colorToHex(rgb(0, 0, 0))).toBe('#000000');
  });

  it('converts grayscale 0.5 to #808080', () => {
    // 0.5 * 255 = 127.5 → 128 → 0x80
    expect(colorToHex(grayscale(0.5))).toBe('#808080');
  });

  it('converts CMYK via cmykToRgb', () => {
    // Pure cyan CMYK (1,0,0,0) → RGB (0,1,1) → #00ffff
    expect(colorToHex(cmyk(1, 0, 0, 0))).toBe('#00ffff');
  });

  it('converts spot colour via its alternate', () => {
    const sc = spotColor('Test', rgb(1, 0, 0));
    expect(colorToHex(sc)).toBe('#ff0000');
  });

  it('throws for DeviceN colours', () => {
    const dn = deviceNColor(['A', 'B'], 'DeviceRGB', [0.5, 0.5]);
    expect(() => colorToHex(dn)).toThrow(/DeviceN/);
  });
});

describe('hexToColor()', () => {
  it('parses #ff0000 to RGB(1, 0, 0)', () => {
    const c = hexToColor('#ff0000');
    expect(c.type).toBe('rgb');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });

  it('parses shorthand #f00 to RGB(1, 0, 0)', () => {
    const c = hexToColor('#f00');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });

  it('parses without hash prefix', () => {
    const c = hexToColor('00ff00');
    expect(c.r).toBe(0);
    expect(c.g).toBeCloseTo(1, 2);
    expect(c.b).toBe(0);
  });

  it('throws on invalid hex', () => {
    expect(() => hexToColor('#gg0000')).toThrow(/invalid hex/);
    expect(() => hexToColor('#1234')).toThrow(/invalid hex/);
    expect(() => hexToColor('')).toThrow(/invalid hex/);
  });
});

describe('hex round-trip', () => {
  it('hexToColor(colorToHex(c)) recovers the original colour', () => {
    const original = rgb(0.2, 0.6, 0.8);
    const hex = colorToHex(original);
    const recovered = hexToColor(hex);

    // Within 1/255 precision
    expect(recovered.r).toBeCloseTo(original.r, 2);
    expect(recovered.g).toBeCloseTo(original.g, 2);
    expect(recovered.b).toBeCloseTo(original.b, 2);
  });
});

// ---------------------------------------------------------------------------
// colorToComponents for new types
// ---------------------------------------------------------------------------

describe('colorToComponents()', () => {
  it('returns [tint] for a spot colour', () => {
    const sc = spotColor('Test', cmyk(0, 0, 0, 1), 0.5);
    expect(colorToComponents(sc)).toEqual([0.5]);
  });

  it('returns tints for a DeviceN colour', () => {
    const dn = deviceNColor(['A', 'B', 'C'], 'DeviceRGB', [0.1, 0.2, 0.3]);
    expect(colorToComponents(dn)).toEqual([0.1, 0.2, 0.3]);
  });
});

// ---------------------------------------------------------------------------
// spotResourceName / deviceNResourceName
// ---------------------------------------------------------------------------

describe('spotResourceName()', () => {
  it('replaces spaces with underscores', () => {
    expect(spotResourceName('PANTONE 185 C')).toBe('CS_PANTONE_185_C');
  });

  it('handles names with no special chars', () => {
    expect(spotResourceName('Varnish')).toBe('CS_Varnish');
  });

  it('replaces dots and hyphens', () => {
    expect(spotResourceName('My.Ink-2')).toBe('CS_My_Ink_2');
  });
});

describe('deviceNResourceName()', () => {
  it('joins colorant names', () => {
    expect(deviceNResourceName(['Cyan', 'Magenta'])).toBe('CS_DN_Cyan_Magenta');
  });

  it('sanitizes special characters in colorant names', () => {
    expect(deviceNResourceName(['Spot 1', 'Spot 2'])).toBe('CS_DN_Spot_1_Spot_2');
  });
});

// ---------------------------------------------------------------------------
// buildSeparationColorSpace() — PDF dictionary structure
// ---------------------------------------------------------------------------

describe('buildSeparationColorSpace()', () => {
  it('builds [/Separation /Name /DeviceCMYK <function>] for CMYK alternate', () => {
    const alt = cmyk(0, 0.91, 0.76, 0);
    const arr = buildSeparationColorSpace('PANTONE 185 C', alt);

    expect(arr.items.length).toBe(4);

    // First item: /Separation
    const first = arr.items[0] as PdfName;
    expect(first.kind).toBe('name');
    expect(first.value).toBe('/Separation');

    // Second item: colorant name
    const second = arr.items[1] as PdfName;
    expect(second.kind).toBe('name');
    expect(second.value).toBe('/PANTONE 185 C');

    // Third item: alternate space
    const third = arr.items[2] as PdfName;
    expect(third.kind).toBe('name');
    expect(third.value).toBe('/DeviceCMYK');

    // Fourth item: tint-transform function (PdfStream)
    const fn = arr.items[3] as PdfStream;
    expect(fn.kind).toBe('stream');
    expect(fn.dict.get('/FunctionType')).toBeDefined();

    // Verify function type is 4 (PostScript calculator)
    const fnType = fn.dict.get('/FunctionType') as { value: number };
    expect(fnType.value).toBe(4);

    // Verify the domain is [0 1]
    const domain = fn.dict.get('/Domain') as PdfArray;
    expect(domain.items.length).toBe(2);

    // Verify the range has 8 entries (4 CMYK components * 2)
    const range = fn.dict.get('/Range') as PdfArray;
    expect(range.items.length).toBe(8);

    // Verify the PostScript code contains 'mul' (tint transform)
    const psCode = new TextDecoder().decode(fn.data);
    expect(psCode).toContain('mul');
    expect(psCode.startsWith('{')).toBe(true);
    expect(psCode.endsWith('}')).toBe(true);
  });

  it('builds with RGB alternate using /DeviceRGB', () => {
    const alt = rgb(1, 0, 0);
    const arr = buildSeparationColorSpace('Red Spot', alt);

    const third = arr.items[2] as PdfName;
    expect(third.value).toBe('/DeviceRGB');

    // Range should be 6 entries (3 RGB * 2)
    const fn = arr.items[3] as PdfStream;
    const range = fn.dict.get('/Range') as PdfArray;
    expect(range.items.length).toBe(6);
  });

  it('builds with grayscale alternate using /DeviceGray', () => {
    const alt = grayscale(0.5);
    const arr = buildSeparationColorSpace('Gray Ink', alt);

    const third = arr.items[2] as PdfName;
    expect(third.value).toBe('/DeviceGray');

    // Range should be 2 entries (1 gray * 2)
    const fn = arr.items[3] as PdfStream;
    const range = fn.dict.get('/Range') as PdfArray;
    expect(range.items.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildDeviceNColorSpace() — PDF dictionary structure
// ---------------------------------------------------------------------------

describe('buildDeviceNColorSpace()', () => {
  it('builds [/DeviceN [names] /DeviceCMYK <function>]', () => {
    const arr = buildDeviceNColorSpace(
      ['Cyan', 'Magenta', 'Yellow', 'Black'],
      'DeviceCMYK',
    );

    expect(arr.items.length).toBe(4);

    // First item: /DeviceN
    const first = arr.items[0] as PdfName;
    expect(first.value).toBe('/DeviceN');

    // Second item: array of colorant names
    const names = arr.items[1] as PdfArray;
    expect(names.items.length).toBe(4);
    expect((names.items[0] as PdfName).value).toBe('/Cyan');
    expect((names.items[1] as PdfName).value).toBe('/Magenta');
    expect((names.items[2] as PdfName).value).toBe('/Yellow');
    expect((names.items[3] as PdfName).value).toBe('/Black');

    // Third item: alternate space
    const third = arr.items[2] as PdfName;
    expect(third.value).toBe('/DeviceCMYK');

    // Fourth item: tint-transform function
    const fn = arr.items[3] as PdfStream;
    expect(fn.kind).toBe('stream');
  });

  it('builds with DeviceRGB alternate', () => {
    const arr = buildDeviceNColorSpace(
      ['Red', 'Green', 'Blue'],
      'DeviceRGB',
    );

    const third = arr.items[2] as PdfName;
    expect(third.value).toBe('/DeviceRGB');

    // Range should be 6 (3 RGB * 2)
    const fn = arr.items[3] as PdfStream;
    const range = fn.dict.get('/Range') as PdfArray;
    expect(range.items.length).toBe(6);
  });

  it('domain has 2 entries per colorant', () => {
    const arr = buildDeviceNColorSpace(
      ['A', 'B', 'C'],
      'DeviceCMYK',
    );

    const fn = arr.items[3] as PdfStream;
    const domain = fn.dict.get('/Domain') as PdfArray;
    expect(domain.items.length).toBe(6); // 3 colorants * 2
  });

  it('handles single colorant (unusual but valid)', () => {
    const arr = buildDeviceNColorSpace(['Special'], 'DeviceCMYK');
    const names = arr.items[1] as PdfArray;
    expect(names.items.length).toBe(1);
    expect((names.items[0] as PdfName).value).toBe('/Special');
  });
});

// ---------------------------------------------------------------------------
// Existing colour types still work with applyFillColor / applyStrokeColor
// ---------------------------------------------------------------------------

describe('applyFillColor/applyStrokeColor backwards compatibility', () => {
  it('still handles RGB', () => {
    expect(applyFillColor(rgb(1, 0, 0))).toBe('1 0 0 rg\n');
    expect(applyStrokeColor(rgb(0, 1, 0))).toBe('0 1 0 RG\n');
  });

  it('still handles CMYK', () => {
    expect(applyFillColor(cmyk(1, 0, 0, 0))).toBe('1 0 0 0 k\n');
    expect(applyStrokeColor(cmyk(0, 1, 0, 0))).toBe('0 1 0 0 K\n');
  });

  it('still handles grayscale', () => {
    expect(applyFillColor(grayscale(0.5))).toBe('0.5 g\n');
    expect(applyStrokeColor(grayscale(0.5))).toBe('0.5 G\n');
  });
});

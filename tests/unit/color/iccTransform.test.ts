/**
 * Tests for the ICC matrix/TRC colour transform (src/color/iccTransform.ts).
 *
 * Verifies, against ICC.1:2010 §7 (header), §7.3 (tag table), §10.6 (curveType),
 * §10.18 (parametricCurveType) and §10.31 (XYZType), plus the CIE L*a*b* formulas
 * (CIE 15 / ICC PCS):
 *
 *  - parseIccTransform reads version / deviceClass / colorSpace / pcs / hasMatrixTrc
 *    from the bundled sRGB profile (SRGB_ICC_PROFILE).
 *  - deviceRgbToXyz([1,1,1]) ~= D50 white point [0.9642, 1.0, 0.8249].
 *  - deviceRgbToXyz([0,0,0]) ~= [0, 0, 0].
 *  - xyzToLab(D50 white) ~= [100, 0, 0].
 *  - Round trip of intermediate channel values is monotone / in range.
 *  - 'curv' (count=1 gamma), 'curv' (count>=2 LUT) and 'para' TRCs all linearize.
 *  - LUT-based (mft1/mft2) profiles are rejected with a clear error.
 *  - Gray (kTRC) profiles report hasMatrixTrc true and parse.
 */

import { describe, it, expect } from 'vitest';
import {
  parseIccTransform,
  deviceRgbToXyz,
  xyzToLab,
} from '../../../src/color/iccTransform.js';
import { SRGB_ICC_PROFILE } from '../../../src/compliance/srgbIccProfile.js';

// ---------------------------------------------------------------------------
// Low-level ICC writer helpers (mirror the on-disk big-endian layout)
// ---------------------------------------------------------------------------

function writeU32(buf: Uint8Array, off: number, v: number): void {
  buf[off] = (v >>> 24) & 0xff;
  buf[off + 1] = (v >>> 16) & 0xff;
  buf[off + 2] = (v >>> 8) & 0xff;
  buf[off + 3] = v & 0xff;
}

function writeU16(buf: Uint8Array, off: number, v: number): void {
  buf[off] = (v >>> 8) & 0xff;
  buf[off + 1] = v & 0xff;
}

function writeAscii(buf: Uint8Array, off: number, s: string): void {
  for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
}

/** s15Fixed16: value * 65536 as a signed 32-bit big-endian integer. */
function writeS15Fixed16(buf: Uint8Array, off: number, v: number): void {
  writeU32(buf, off, (Math.round(v * 65536) | 0) >>> 0);
}

/** Build an 'XYZ ' type tag: sig(4) + reserved(4) + 3 x s15Fixed16. */
function xyzTag(x: number, y: number, z: number): Uint8Array {
  const d = new Uint8Array(20);
  writeAscii(d, 0, 'XYZ ');
  writeS15Fixed16(d, 8, x);
  writeS15Fixed16(d, 12, y);
  writeS15Fixed16(d, 16, z);
  return d;
}

/** Build a 'curv' tag with count=1 (single u8Fixed8 gamma). */
function curvGammaTag(gamma: number): Uint8Array {
  const d = new Uint8Array(14);
  writeAscii(d, 0, 'curv');
  writeU32(d, 8, 1); // count
  writeU16(d, 12, Math.round(gamma * 256)); // u8Fixed8Number
  return d;
}

/** Build a 'curv' tag with an explicit u16 LUT of the given samples. */
function curvLutTag(samples: readonly number[]): Uint8Array {
  const d = new Uint8Array(12 + samples.length * 2);
  writeAscii(d, 0, 'curv');
  writeU32(d, 8, samples.length);
  for (let i = 0; i < samples.length; i++) writeU16(d, 12 + i * 2, samples[i]!);
  return d;
}

/**
 * Build a 'para' parametricCurveType, function type 0 (pure gamma):
 * Y = X^g.  sig(4) + reserved(4) + funcType u16 + reserved u16 + g (s15Fixed16).
 */
function paraGammaTag(gamma: number): Uint8Array {
  const d = new Uint8Array(12 + 4);
  writeAscii(d, 0, 'para');
  writeU16(d, 8, 0); // function type 0
  // bytes 10-11 reserved
  writeS15Fixed16(d, 12, gamma);
  return d;
}

interface TagSpec {
  readonly sig: string;
  readonly data: Uint8Array;
}

/**
 * Assemble a complete ICC profile from a header description and tag list,
 * matching the on-disk layout (128-byte header, u32 tag count, 12-byte tag
 * records, 4-byte-aligned tag data).
 */
function buildProfile(opts: {
  version?: number;
  deviceClass: string;
  colorSpace: string;
  pcs: string;
  tags: readonly TagSpec[];
}): Uint8Array {
  const tags = opts.tags;
  const headerSize = 128;
  const tagTableOffset = headerSize + 4;
  const tagTableSize = tags.length * 12;
  let off = (tagTableOffset + tagTableSize + 3) & ~3;

  const entries: Array<{ sig: string; offset: number; size: number }> = [];
  for (const t of tags) {
    entries.push({ sig: t.sig, offset: off, size: t.data.length });
    off = (off + t.data.length + 3) & ~3;
  }
  const total = off;

  const p = new Uint8Array(total);
  writeU32(p, 0, total);
  writeU32(p, 8, opts.version ?? 0x02400000); // version (default v2.4)
  writeAscii(p, 12, opts.deviceClass);
  writeAscii(p, 16, opts.colorSpace);
  writeAscii(p, 20, opts.pcs);
  writeAscii(p, 36, 'acsp');

  writeU32(p, headerSize, tags.length);
  for (let i = 0; i < tags.length; i++) {
    const e = entries[i]!;
    const rec = tagTableOffset + i * 12;
    writeAscii(p, rec, e.sig);
    writeU32(p, rec + 4, e.offset);
    writeU32(p, rec + 8, e.size);
    p.set(tags[i]!.data, e.offset);
  }
  return p;
}

// ---------------------------------------------------------------------------
// parseIccTransform — bundled sRGB profile
// ---------------------------------------------------------------------------

describe('parseIccTransform (sRGB profile)', () => {
  it('reads version, deviceClass, colorSpace, pcs and hasMatrixTrc', () => {
    const info = parseIccTransform(SRGB_ICC_PROFILE);
    // The bundled profile is ICC v2.1 (byte 8 = 0x02, byte 9 = 0x10).
    expect(info.version).toBe(0x02100000);
    expect(info.deviceClass).toBe('mntr');
    expect(info.colorSpace).toBe('RGB ');
    expect(info.pcs).toBe('XYZ ');
    expect(info.hasMatrixTrc).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deviceRgbToXyz — sRGB profile
// ---------------------------------------------------------------------------

describe('deviceRgbToXyz (sRGB profile)', () => {
  it('maps white [1,1,1] to the D50 PCS white point', () => {
    const [x, y, z] = deviceRgbToXyz(SRGB_ICC_PROFILE, [1, 1, 1]);
    expect(x).toBeCloseTo(0.9642, 2);
    expect(y).toBeCloseTo(1.0, 2);
    expect(z).toBeCloseTo(0.8249, 2);
  });

  it('maps black [0,0,0] to [0,0,0]', () => {
    const [x, y, z] = deviceRgbToXyz(SRGB_ICC_PROFILE, [0, 0, 0]);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('is monotone in luminance (gray ramp Y increases)', () => {
    const y0 = deviceRgbToXyz(SRGB_ICC_PROFILE, [0, 0, 0])[1];
    const y1 = deviceRgbToXyz(SRGB_ICC_PROFILE, [0.5, 0.5, 0.5])[1];
    const y2 = deviceRgbToXyz(SRGB_ICC_PROFILE, [1, 1, 1])[1];
    expect(y0).toBeLessThan(y1);
    expect(y1).toBeLessThan(y2);
    // gamma 2.2: mid-gray luminance is well below 0.5.
    expect(y1).toBeLessThan(0.3);
    expect(y1).toBeGreaterThan(0.15);
  });

  it('a pure-red input only excites the red colorant column', () => {
    const red = deviceRgbToXyz(SRGB_ICC_PROFILE, [1, 0, 0]);
    // sRGB D50-adapted red colorant ~ [0.4361, 0.2225, 0.0139].
    expect(red[0]).toBeCloseTo(0.4361, 2);
    expect(red[1]).toBeCloseTo(0.2225, 2);
    expect(red[2]).toBeCloseTo(0.0139, 2);
  });
});

// ---------------------------------------------------------------------------
// xyzToLab
// ---------------------------------------------------------------------------

describe('xyzToLab', () => {
  it('maps the D50 white point to L*=100, a*=0, b*=0', () => {
    const [l, a, b] = xyzToLab([0.9642, 1.0, 0.8249]);
    expect(l).toBeCloseTo(100, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it('maps black to L*=0', () => {
    const [l, a, b] = xyzToLab([0, 0, 0]);
    expect(l).toBeCloseTo(0, 6);
    expect(a).toBeCloseTo(0, 6);
    expect(b).toBeCloseTo(0, 6);
  });

  it('mid gray (Y=0.18431) gives L* ~= 50 (CIE reference)', () => {
    // L* = 50 <=> f = (50+16)/116; t = f^3 since above the 6/29 threshold.
    const f = (50 + 16) / 116;
    const yn = f * f * f;
    const [l] = xyzToLab([0.9642 * yn, yn, 0.8249 * yn]);
    expect(l).toBeCloseTo(50, 3);
  });

  it('accepts a custom white point (D65)', () => {
    const d65: [number, number, number] = [0.9504, 1.0, 1.0888];
    const [l, a, b] = xyzToLab(d65, d65);
    expect(l).toBeCloseTo(100, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it('a*>0 for a reddish stimulus (X/Xn > Y/Yn)', () => {
    const [, a] = xyzToLab([0.6, 0.5, 0.4]);
    expect(a).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Synthetic RGB matrix/TRC profile variants
// ---------------------------------------------------------------------------

describe('parseIccTransform / deviceRgbToXyz (synthetic RGB)', () => {
  function rgbProfile(trc: (g: number) => Uint8Array): Uint8Array {
    return buildProfile({
      deviceClass: 'mntr',
      colorSpace: 'RGB ',
      pcs: 'XYZ ',
      tags: [
        { sig: 'rXYZ', data: xyzTag(0.4361, 0.2225, 0.0139) },
        { sig: 'gXYZ', data: xyzTag(0.3851, 0.7169, 0.0971) },
        { sig: 'bXYZ', data: xyzTag(0.1432, 0.0606, 0.7141) },
        { sig: 'rTRC', data: trc(2.2) },
        { sig: 'gTRC', data: trc(2.2) },
        { sig: 'bTRC', data: trc(2.2) },
      ],
    });
  }

  it('reads version 0x02400000 from the synthetic header', () => {
    const info = parseIccTransform(rgbProfile(curvGammaTag));
    expect(info.version).toBe(0x02400000);
    expect(info.hasMatrixTrc).toBe(true);
  });

  it('curv count=1 gamma TRC: white -> D50', () => {
    const [x, y, z] = deviceRgbToXyz(rgbProfile(curvGammaTag), [1, 1, 1]);
    expect(x).toBeCloseTo(0.9644, 2);
    expect(y).toBeCloseTo(1.0, 2);
    expect(z).toBeCloseTo(0.8251, 2);
  });

  it('para gamma TRC: white -> D50', () => {
    const [x, y, z] = deviceRgbToXyz(rgbProfile(paraGammaTag), [1, 1, 1]);
    expect(x).toBeCloseTo(0.9644, 2);
    expect(y).toBeCloseTo(1.0, 2);
    expect(z).toBeCloseTo(0.8251, 2);
  });

  it('curv LUT TRC (linear ramp) linearizes correctly', () => {
    // Identity LUT 0..65535 over 256 entries => linear TRC.
    const lut = Array.from({ length: 256 }, (_, i) => Math.round((i / 255) * 65535));
    const p = rgbProfile(() => curvLutTag(lut));
    const [, y] = deviceRgbToXyz(p, [0.5, 0.5, 0.5]);
    // Linear TRC: luminance of mid input ~= 0.5 * Y(white) = 0.5.
    expect(y).toBeCloseTo(0.5, 2);
  });

  it('curv count=0 (identity) treats input as already linear', () => {
    const identity = (): Uint8Array => {
      const d = new Uint8Array(12);
      writeAscii(d, 0, 'curv');
      writeU32(d, 8, 0); // count 0 => identity
      return d;
    };
    const [, y] = deviceRgbToXyz(rgbProfile(identity), [0.5, 0.5, 0.5]);
    expect(y).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Gray (kTRC) profiles
// ---------------------------------------------------------------------------

describe('parseIccTransform (gray profile)', () => {
  it('reports hasMatrixTrc true when kTRC + wtpt present', () => {
    const p = buildProfile({
      deviceClass: 'mntr',
      colorSpace: 'GRAY',
      pcs: 'XYZ ',
      tags: [
        { sig: 'wtpt', data: xyzTag(0.9642, 1.0, 0.8249) },
        { sig: 'kTRC', data: curvGammaTag(2.2) },
      ],
    });
    const info = parseIccTransform(p);
    expect(info.colorSpace).toBe('GRAY');
    expect(info.hasMatrixTrc).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws on too-short data', () => {
    expect(() => parseIccTransform(new Uint8Array(10))).toThrow();
  });

  it('rejects LUT-based (mft2) profiles in deviceRgbToXyz', () => {
    // An A2B0 multiFunctionTable ('mft2') instead of matrix/TRC tags.
    const mft2 = new Uint8Array(52);
    writeAscii(mft2, 0, 'mft2');
    const p = buildProfile({
      deviceClass: 'prtr',
      colorSpace: 'RGB ',
      pcs: 'XYZ ',
      tags: [{ sig: 'A2B0', data: mft2 }],
    });
    const info = parseIccTransform(p);
    expect(info.hasMatrixTrc).toBe(false);
    expect(() => deviceRgbToXyz(p, [1, 1, 1])).toThrow(/matrix\/TRC|LUT/i);
  });

  it('rejects a non-RGB colour space in deviceRgbToXyz', () => {
    const p = buildProfile({
      deviceClass: 'prtr',
      colorSpace: 'CMYK',
      pcs: 'XYZ ',
      tags: [],
    });
    expect(() => deviceRgbToXyz(p, [1, 1, 1])).toThrow();
  });
});

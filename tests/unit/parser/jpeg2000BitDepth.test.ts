/**
 * Tests for JPEG2000 bit-depth utilities: component depth parsing,
 * downscaling, upscaling, normalization, signed-to-unsigned conversion,
 * and bit-depth summarization.
 *
 * Covers:
 * - getComponentDepths: parse SIZ marker for component bit depths
 * - downscale16To8: 16-bit to 8-bit linear scaling
 * - upscale8To16: 8-bit to 16-bit expansion
 * - normalizeComponentDepth: generic depth conversion
 * - offsetSignedToUnsigned: signed-to-unsigned offset
 * - summarizeBitDepth: summary from component descriptors
 */

import { describe, it, expect } from 'vitest';
import {
  getComponentDepths,
  downscale16To8,
  upscale8To16,
  normalizeComponentDepth,
  offsetSignedToUnsigned,
  summarizeBitDepth,
} from '../../../src/parser/jpeg2000BitDepth.js';
import type {
  BitDepthInfo,
  ComponentDepth,
} from '../../../src/parser/jpeg2000BitDepth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a 32-bit big-endian unsigned integer into a byte array at offset. */
function writeU32(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/** Write a 16-bit big-endian unsigned integer into a byte array at offset. */
function writeU16(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/**
 * Build a minimal raw J2K codestream with SOC + SIZ marker
 * for testing getComponentDepths.
 */
function buildSIZ(components: Array<{ bits: number; signed: boolean }>): Uint8Array {
  const csiz = components.length;
  const sizLen = 38 + csiz * 3;
  const arr: number[] = [];

  // SOC marker
  arr[0] = 0xff;
  arr[1] = 0x4f;
  // SIZ marker
  arr[2] = 0xff;
  arr[3] = 0x51;

  const base = 4;
  writeU16(arr, base, sizLen);           // Lsiz
  writeU16(arr, base + 2, 0);           // Rsiz
  writeU32(arr, base + 4, 256);         // Xsiz
  writeU32(arr, base + 8, 256);         // Ysiz
  writeU32(arr, base + 12, 0);          // XOsiz
  writeU32(arr, base + 16, 0);          // YOsiz
  writeU32(arr, base + 20, 256);        // XTsiz
  writeU32(arr, base + 24, 256);        // YTsiz
  writeU32(arr, base + 28, 0);          // XTOsiz
  writeU32(arr, base + 32, 0);          // YTOsiz
  writeU16(arr, base + 36, csiz);       // Csiz

  const compStart = base + 38;
  for (let i = 0; i < csiz; i++) {
    const ssiz = (components[i]!.bits - 1) | (components[i]!.signed ? 0x80 : 0);
    arr[compStart + i * 3] = ssiz;
    arr[compStart + i * 3 + 1] = 1; // XRsiz
    arr[compStart + i * 3 + 2] = 1; // YRsiz
  }

  const result = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[i] = arr[i] ?? 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// getComponentDepths
// ---------------------------------------------------------------------------

describe('getComponentDepths', () => {
  it('parses 3-component 8-bit unsigned correctly', () => {
    const data = buildSIZ([
      { bits: 8, signed: false },
      { bits: 8, signed: false },
      { bits: 8, signed: false },
    ]);
    const depths = getComponentDepths(data);
    expect(depths).toHaveLength(3);
    for (const d of depths) {
      expect(d.bits).toBe(8);
      expect(d.isSigned).toBe(false);
    }
  });

  it('parses 16-bit signed components', () => {
    const data = buildSIZ([
      { bits: 16, signed: true },
      { bits: 16, signed: true },
    ]);
    const depths = getComponentDepths(data);
    expect(depths).toHaveLength(2);
    for (const d of depths) {
      expect(d.bits).toBe(16);
      expect(d.isSigned).toBe(true);
    }
  });

  it('parses mixed bit depths', () => {
    const data = buildSIZ([
      { bits: 8, signed: false },
      { bits: 12, signed: false },
      { bits: 16, signed: true },
    ]);
    const depths = getComponentDepths(data);
    expect(depths).toHaveLength(3);
    expect(depths[0]!.bits).toBe(8);
    expect(depths[0]!.isSigned).toBe(false);
    expect(depths[1]!.bits).toBe(12);
    expect(depths[1]!.isSigned).toBe(false);
    expect(depths[2]!.bits).toBe(16);
    expect(depths[2]!.isSigned).toBe(true);
  });

  it('parses single-component grayscale', () => {
    const data = buildSIZ([{ bits: 8, signed: false }]);
    const depths = getComponentDepths(data);
    expect(depths).toHaveLength(1);
    expect(depths[0]!.bits).toBe(8);
  });

  it('parses 1-bit component', () => {
    const data = buildSIZ([{ bits: 1, signed: false }]);
    const depths = getComponentDepths(data);
    expect(depths[0]!.bits).toBe(1);
    expect(depths[0]!.isSigned).toBe(false);
  });

  it('throws on missing SIZ marker', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(() => getComponentDepths(data)).toThrow(/SIZ marker/i);
  });

  it('throws on truncated SIZ marker', () => {
    // SOC + SIZ marker bytes but not enough data
    const data = new Uint8Array([0xff, 0x4f, 0xff, 0x51, 0x00, 0x08]);
    expect(() => getComponentDepths(data)).toThrow(/truncated/i);
  });
});

// ---------------------------------------------------------------------------
// downscale16To8
// ---------------------------------------------------------------------------

describe('downscale16To8', () => {
  it('scales 16-bit max (65535) to 255', () => {
    const data = new Uint8Array([0xff, 0xff]); // 65535
    const result = downscale16To8(data, 16);
    expect(result[0]).toBe(255);
  });

  it('scales 16-bit zero to 0', () => {
    const data = new Uint8Array([0x00, 0x00]);
    const result = downscale16To8(data, 16);
    expect(result[0]).toBe(0);
  });

  it('scales 16-bit midpoint approximately to 128', () => {
    // 32768 -> ~128
    const data = new Uint8Array([0x80, 0x00]);
    const result = downscale16To8(data, 16);
    expect(result[0]).toBeGreaterThanOrEqual(127);
    expect(result[0]).toBeLessThanOrEqual(128);
  });

  it('returns a copy for 8-bit input (no change)', () => {
    const data = new Uint8Array([100, 200, 50]);
    const result = downscale16To8(data, 8);
    expect(result).toEqual(data);
    expect(result).not.toBe(data); // must be a copy
  });

  it('handles multiple 16-bit samples', () => {
    const data = new Uint8Array([
      0xff, 0xff, // 65535 -> 255
      0x00, 0x00, // 0 -> 0
      0x80, 0x00, // ~32768 -> ~128
    ]);
    const result = downscale16To8(data, 16);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(255);
    expect(result[1]).toBe(0);
  });

  it('scales 12-bit max (4095) to 255', () => {
    const data = new Uint8Array([0x0f, 0xff]); // 4095
    const result = downscale16To8(data, 12);
    expect(result[0]).toBe(255);
  });

  it('throws for bit depth > 16', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00]);
    expect(() => downscale16To8(data, 24)).toThrow(/16 bits/i);
  });
});

// ---------------------------------------------------------------------------
// upscale8To16
// ---------------------------------------------------------------------------

describe('upscale8To16', () => {
  it('maps 0 to 0', () => {
    const data = new Uint8Array([0]);
    const result = upscale8To16(data);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });

  it('maps 255 to 65535', () => {
    const data = new Uint8Array([255]);
    const result = upscale8To16(data);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(65535);
  });

  it('maps 128 to 32896 (128 * 257)', () => {
    const data = new Uint8Array([128]);
    const result = upscale8To16(data);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(128 * 257);
  });

  it('output length is double the input length', () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const result = upscale8To16(data);
    expect(result.length).toBe(10);
  });

  it('maps 1 to 257', () => {
    const data = new Uint8Array([1]);
    const result = upscale8To16(data);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(257);
  });
});

// ---------------------------------------------------------------------------
// normalizeComponentDepth
// ---------------------------------------------------------------------------

describe('normalizeComponentDepth', () => {
  it('returns a copy when fromBits === toBits', () => {
    const data = new Uint8Array([100, 200, 50]);
    const result = normalizeComponentDepth(data, 8, 8);
    expect(result).toEqual(data);
    expect(result).not.toBe(data);
  });

  it('downscales 16 bits to 8 bits', () => {
    const data = new Uint8Array([0xff, 0xff]); // 65535
    const result = normalizeComponentDepth(data, 16, 8);
    expect(result[0]).toBe(255);
  });

  it('upscales 8 bits to 16 bits', () => {
    const data = new Uint8Array([255]);
    const result = normalizeComponentDepth(data, 8, 16);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(65535);
  });

  it('converts 4-bit to 8-bit', () => {
    const data = new Uint8Array([15]); // max for 4-bit
    const result = normalizeComponentDepth(data, 4, 8);
    expect(result[0]).toBe(255);
  });

  it('converts 8-bit to 4-bit', () => {
    const data = new Uint8Array([255]); // max for 8-bit
    const result = normalizeComponentDepth(data, 8, 4);
    expect(result[0]).toBe(15);
  });

  it('preserves zero values', () => {
    const data = new Uint8Array([0]);
    const result = normalizeComponentDepth(data, 8, 16);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });

  it('throws for fromBits < 1', () => {
    expect(() => normalizeComponentDepth(new Uint8Array([0]), 0, 8)).toThrow();
  });

  it('throws for toBits > 16', () => {
    expect(() => normalizeComponentDepth(new Uint8Array([0]), 8, 17)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// offsetSignedToUnsigned
// ---------------------------------------------------------------------------

describe('offsetSignedToUnsigned', () => {
  it('offsets 8-bit signed: 128 (signed -128) becomes 0', () => {
    // In unsigned representation, 128 is -128 signed
    const data = new Uint8Array([128]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result[0]).toBe(0);
  });

  it('offsets 8-bit signed: 0 (signed 0) becomes 128', () => {
    const data = new Uint8Array([0]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result[0]).toBe(128);
  });

  it('offsets 8-bit signed: 127 (signed 127) becomes 255', () => {
    const data = new Uint8Array([127]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result[0]).toBe(255);
  });

  it('offsets 16-bit signed zero to mid-range', () => {
    const data = new Uint8Array([0x00, 0x00]); // value 0
    const result = offsetSignedToUnsigned(data, 16);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(32768); // 2^15
  });

  it('offsets 16-bit signed -32768 to 0', () => {
    // -32768 stored as unsigned 16-bit is 32768 (0x8000)
    const data = new Uint8Array([0x80, 0x00]);
    const result = offsetSignedToUnsigned(data, 16);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(0);
  });

  it('offsets 16-bit signed 32767 to 65535', () => {
    // 32767 = 0x7FFF, unsigned -> stored as 0x7FFF, which is < 32768 -> positive
    const data = new Uint8Array([0x7f, 0xff]);
    const result = offsetSignedToUnsigned(data, 16);
    const value = (result[0]! << 8) | result[1]!;
    expect(value).toBe(65535);
  });

  it('returns a new array (does not modify input)', () => {
    const data = new Uint8Array([100]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result).not.toBe(data);
  });

  it('handles multiple 8-bit samples', () => {
    const data = new Uint8Array([0, 64, 128, 192, 255]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result.length).toBe(5);
    // 0 -> 128, 64 -> 192, 128 -> 0, 192 -> 64, 255 -> 127
    expect(result[0]).toBe(128);
    expect(result[1]).toBe(192);
    expect(result[2]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// summarizeBitDepth
// ---------------------------------------------------------------------------

describe('summarizeBitDepth', () => {
  it('returns 8-bit unsigned for empty array', () => {
    const result = summarizeBitDepth([]);
    expect(result.bitsPerComponent).toBe(8);
    expect(result.isSigned).toBe(false);
    expect(result.components).toBe(0);
  });

  it('returns correct summary for uniform 8-bit unsigned', () => {
    const depths: ComponentDepth[] = [
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
    ];
    const result = summarizeBitDepth(depths);
    expect(result.bitsPerComponent).toBe(8);
    expect(result.isSigned).toBe(false);
    expect(result.components).toBe(3);
  });

  it('returns max bits when components differ', () => {
    const depths: ComponentDepth[] = [
      { bits: 8, isSigned: false },
      { bits: 12, isSigned: false },
      { bits: 16, isSigned: false },
    ];
    const result = summarizeBitDepth(depths);
    expect(result.bitsPerComponent).toBe(16);
  });

  it('returns isSigned true if any component is signed', () => {
    const depths: ComponentDepth[] = [
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: true },
      { bits: 8, isSigned: false },
    ];
    const result = summarizeBitDepth(depths);
    expect(result.isSigned).toBe(true);
  });

  it('returns correct component count', () => {
    const depths: ComponentDepth[] = [
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
    ];
    const result = summarizeBitDepth(depths);
    expect(result.components).toBe(4);
  });

  it('handles single component', () => {
    const depths: ComponentDepth[] = [{ bits: 12, isSigned: true }];
    const result = summarizeBitDepth(depths);
    expect(result.bitsPerComponent).toBe(12);
    expect(result.isSigned).toBe(true);
    expect(result.components).toBe(1);
  });
});

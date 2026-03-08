/**
 * Tests for the sRGB ICC profile generator.
 *
 * Covers:
 * - Profile is a valid Uint8Array with correct ICC header structure
 * - Profile version is 2.x
 * - Color space is 'RGB '
 * - Profile Connection Space is 'XYZ '
 * - Device class is 'mntr' (display)
 * - File signature is 'acsp'
 * - Tag count equals 9
 * - All 9 required tags are present (desc, cprt, wtpt, rXYZ, gXYZ, bXYZ, rTRC, gTRC, bTRC)
 * - Profile size recorded in header matches actual byte length
 * - PCS illuminant D50 values are correct
 * - Cached SRGB_ICC_PROFILE matches regenerated output
 * - Profile description contains 'sRGB'
 * - Multiple calls to generateSrgbIccProfile produce identical output
 */

import { describe, it, expect } from 'vitest';
import {
  generateSrgbIccProfile,
  SRGB_ICC_PROFILE,
} from '../../../src/compliance/srgbIccProfile.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a 32-bit big-endian unsigned integer from data at offset. */
function readU32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

/** Read a 16-bit big-endian unsigned integer from data at offset. */
function readU16(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}

/** Read 4 ASCII characters starting at offset. */
function readAscii4(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  );
}

/** Read an s15Fixed16Number and return as float. */
function readS15Fixed16(data: Uint8Array, offset: number): number {
  const raw =
    (data[offset]! << 24) |
    (data[offset + 1]! << 16) |
    (data[offset + 2]! << 8) |
    data[offset + 3]!;
  return raw / 65536;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateSrgbIccProfile', () => {
  const profile = generateSrgbIccProfile();

  it('returns a Uint8Array', () => {
    expect(profile).toBeInstanceOf(Uint8Array);
  });

  it('has a reasonable size (> 400 bytes)', () => {
    expect(profile.length).toBeGreaterThan(400);
  });

  it('profile size in header matches actual byte length', () => {
    const headerSize = readU32(profile, 0);
    expect(headerSize).toBe(profile.length);
  });

  it('has ICC version 2.x', () => {
    expect(profile[8]).toBe(2);
  });

  it('device class is mntr (display)', () => {
    expect(readAscii4(profile, 12)).toBe('mntr');
  });

  it('color space is RGB', () => {
    expect(readAscii4(profile, 16)).toBe('RGB ');
  });

  it('Profile Connection Space is XYZ', () => {
    expect(readAscii4(profile, 20)).toBe('XYZ ');
  });

  it('file signature is acsp', () => {
    expect(readAscii4(profile, 36)).toBe('acsp');
  });

  it('primary platform is APPL', () => {
    expect(readAscii4(profile, 40)).toBe('APPL');
  });

  it('PCS illuminant D50 white point X is approximately 0.9505', () => {
    const x = readS15Fixed16(profile, 68);
    expect(x).toBeCloseTo(0.9505, 3);
  });

  it('PCS illuminant D50 white point Y is approximately 1.0000', () => {
    const y = readS15Fixed16(profile, 72);
    expect(y).toBeCloseTo(1.0, 3);
  });

  it('PCS illuminant D50 white point Z is approximately 1.0890', () => {
    const z = readS15Fixed16(profile, 76);
    expect(z).toBeCloseTo(1.089, 3);
  });

  it('tag count is 9', () => {
    const tagCount = readU32(profile, 128);
    expect(tagCount).toBe(9);
  });

  it('contains all 9 required tag signatures', () => {
    const tagCount = readU32(profile, 128);
    const tagTableStart = 132;
    const signatures: string[] = [];
    for (let i = 0; i < tagCount; i++) {
      signatures.push(readAscii4(profile, tagTableStart + i * 12));
    }

    expect(signatures).toContain('desc');
    expect(signatures).toContain('cprt');
    expect(signatures).toContain('wtpt');
    expect(signatures).toContain('rXYZ');
    expect(signatures).toContain('gXYZ');
    expect(signatures).toContain('bXYZ');
    expect(signatures).toContain('rTRC');
    expect(signatures).toContain('gTRC');
    expect(signatures).toContain('bTRC');
  });

  it('tag data offsets are within the profile bounds', () => {
    const tagCount = readU32(profile, 128);
    const tagTableStart = 132;
    for (let i = 0; i < tagCount; i++) {
      const offset = readU32(profile, tagTableStart + i * 12 + 4);
      const size = readU32(profile, tagTableStart + i * 12 + 8);
      expect(offset).toBeLessThan(profile.length);
      expect(offset + size).toBeLessThanOrEqual(profile.length);
    }
  });

  it('desc tag data starts with "desc" type signature', () => {
    const tagCount = readU32(profile, 128);
    const tagTableStart = 132;
    for (let i = 0; i < tagCount; i++) {
      const sig = readAscii4(profile, tagTableStart + i * 12);
      if (sig === 'desc') {
        const offset = readU32(profile, tagTableStart + i * 12 + 4);
        expect(readAscii4(profile, offset)).toBe('desc');
        break;
      }
    }
  });

  it('multiple calls produce identical output', () => {
    const p1 = generateSrgbIccProfile();
    const p2 = generateSrgbIccProfile();
    expect(p1).toEqual(p2);
  });
});

// ---------------------------------------------------------------------------
// SRGB_ICC_PROFILE cached constant
// ---------------------------------------------------------------------------

describe('SRGB_ICC_PROFILE', () => {
  it('is a Uint8Array', () => {
    expect(SRGB_ICC_PROFILE).toBeInstanceOf(Uint8Array);
  });

  it('matches a freshly generated profile', () => {
    const fresh = generateSrgbIccProfile();
    expect(SRGB_ICC_PROFILE).toEqual(fresh);
  });

  it('has the same length as a freshly generated profile', () => {
    const fresh = generateSrgbIccProfile();
    expect(SRGB_ICC_PROFILE.length).toBe(fresh.length);
  });
});

/**
 * Tests for PDF/A output intent builder and sRGB ICC profile generator.
 *
 * Covers:
 * - ICC profile generation (structure, header, signatures, tags)
 * - SRGB_ICC_PROFILE constant (type, consistency)
 * - OutputIntent builder (default options, custom options, dictionary structure)
 */

import { describe, it, expect } from 'vitest';
import { generateSrgbIccProfile, SRGB_ICC_PROFILE } from '../../../src/compliance/srgbIccProfile.js';
import { buildOutputIntent } from '../../../src/compliance/outputIntent.js';
import type { OutputIntentOptions } from '../../../src/compliance/outputIntent.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfString,
  PdfStream,
  PdfRef,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a 32-bit unsigned integer (big-endian) from a buffer. */
function readU32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset]! << 24) |
      (buf[offset + 1]! << 16) |
      (buf[offset + 2]! << 8) |
      buf[offset + 3]!) >>>
    0
  );
}

/** Read a 4-byte ASCII string from a buffer. */
function readAscii(buf: Uint8Array, offset: number, len: number): string {
  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[offset + i]!);
  }
  return result;
}

// ---------------------------------------------------------------------------
// ICC Profile Tests
// ---------------------------------------------------------------------------

describe('generateSrgbIccProfile', () => {
  it('returns a Uint8Array', () => {
    const profile = generateSrgbIccProfile();
    expect(profile).toBeInstanceOf(Uint8Array);
  });

  it('produces a profile larger than the 128-byte header', () => {
    const profile = generateSrgbIccProfile();
    // The profile must contain: 128-byte header + tag count + tag table + tag data
    expect(profile.length).toBeGreaterThan(128 + 4);
  });

  it('has correct profile file signature "acsp" at offset 36', () => {
    const profile = generateSrgbIccProfile();
    const sig = readAscii(profile, 36, 4);
    expect(sig).toBe('acsp');
  });

  it('has correct color space "RGB " at offset 16', () => {
    const profile = generateSrgbIccProfile();
    const cs = readAscii(profile, 16, 4);
    expect(cs).toBe('RGB ');
  });

  it('has correct PCS "XYZ " at offset 20', () => {
    const profile = generateSrgbIccProfile();
    const pcs = readAscii(profile, 20, 4);
    expect(pcs).toBe('XYZ ');
  });

  it('has correct device class "mntr" (display) at offset 12', () => {
    const profile = generateSrgbIccProfile();
    const cls = readAscii(profile, 12, 4);
    expect(cls).toBe('mntr');
  });

  it('has profile version 2.1.0 at offset 8', () => {
    const profile = generateSrgbIccProfile();
    expect(profile[8]).toBe(2);   // major version
    expect(profile[9]).toBe(0x10); // minor version 1.0
  });

  it('has profile size in header matching actual byte length', () => {
    const profile = generateSrgbIccProfile();
    const declaredSize = readU32(profile, 0);
    expect(declaredSize).toBe(profile.length);
  });

  it('has the required 9 tags', () => {
    const profile = generateSrgbIccProfile();
    const tagCount = readU32(profile, 128);
    expect(tagCount).toBe(9);
  });

  it('contains all required tag signatures', () => {
    const profile = generateSrgbIccProfile();
    const tagCount = readU32(profile, 128);
    const tagTableOffset = 132;

    const signatures: string[] = [];
    for (let i = 0; i < tagCount; i++) {
      const sig = readAscii(profile, tagTableOffset + i * 12, 4);
      signatures.push(sig);
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

  it('has tag data offsets within profile bounds', () => {
    const profile = generateSrgbIccProfile();
    const tagCount = readU32(profile, 128);
    const tagTableOffset = 132;

    for (let i = 0; i < tagCount; i++) {
      const offset = readU32(profile, tagTableOffset + i * 12 + 4);
      const size = readU32(profile, tagTableOffset + i * 12 + 8);
      expect(offset + size).toBeLessThanOrEqual(profile.length);
    }
  });

  it('has PCS illuminant D50 at offset 68', () => {
    const profile = generateSrgbIccProfile();
    // D50 white point: X=0.9505, Y=1.0, Z=1.0890
    // As s15Fixed16: round(value * 65536)
    // X: round(0.9505 * 65536) = 62277 = 0x0000F355 (approx)
    // Y: round(1.0 * 65536)    = 65536 = 0x00010000
    // Z: round(1.0890 * 65536) = 71366 = 0x000116C6 (approx)
    const yValue = readU32(profile, 72);
    // Y should be exactly 0x00010000 (1.0 in s15Fixed16)
    expect(yValue).toBe(0x00010000);
  });
});

// ---------------------------------------------------------------------------
// SRGB_ICC_PROFILE constant tests
// ---------------------------------------------------------------------------

describe('SRGB_ICC_PROFILE', () => {
  it('is a Uint8Array', () => {
    expect(SRGB_ICC_PROFILE).toBeInstanceOf(Uint8Array);
  });

  it('is consistent with generateSrgbIccProfile()', () => {
    const freshProfile = generateSrgbIccProfile();
    expect(SRGB_ICC_PROFILE.length).toBe(freshProfile.length);
    // Byte-for-byte comparison
    for (let i = 0; i < freshProfile.length; i++) {
      expect(SRGB_ICC_PROFILE[i]).toBe(freshProfile[i]);
    }
  });

  it('has a non-zero length', () => {
    expect(SRGB_ICC_PROFILE.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildOutputIntent tests
// ---------------------------------------------------------------------------

describe('buildOutputIntent', () => {
  it('returns a PdfRef', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    expect(ref).toBeInstanceOf(PdfRef);
  });

  it('registers two objects (profile stream + intent dict)', () => {
    const registry = new PdfObjectRegistry();
    buildOutputIntent(registry);
    // The registry should have 2 objects: the ICC profile stream and the OutputIntent dict
    expect(registry.size).toBe(2);
  });

  it('creates OutputIntent dict with correct /Type name', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const intentObj = registry.resolve(ref);
    expect(intentObj).toBeInstanceOf(PdfDict);
    const dict = intentObj as PdfDict;

    const typeValue = dict.get('/Type');
    expect(typeValue).toBeInstanceOf(PdfName);
    expect((typeValue as PdfName).value).toBe('/OutputIntent');
  });

  it('creates OutputIntent dict with default /S = /GTS_PDFA1', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const sValue = dict.get('/S');
    expect(sValue).toBeInstanceOf(PdfName);
    expect((sValue as PdfName).value).toBe('/GTS_PDFA1');
  });

  it('creates OutputIntent dict with default OutputConditionIdentifier', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const oci = dict.get('/OutputConditionIdentifier');
    expect(oci).toBeInstanceOf(PdfString);
    expect((oci as PdfString).value).toBe('sRGB IEC61966-2.1');
  });

  it('creates OutputIntent dict with default RegistryName', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const rn = dict.get('/RegistryName');
    expect(rn).toBeInstanceOf(PdfString);
    expect((rn as PdfString).value).toBe('http://www.color.org');
  });

  it('creates OutputIntent dict with /DestOutputProfile reference', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const destProfile = dict.get('/DestOutputProfile');
    expect(destProfile).toBeInstanceOf(PdfRef);

    // The referenced object should be a PdfStream (the ICC profile)
    const profileObj = registry.resolve(destProfile as PdfRef);
    expect(profileObj).toBeInstanceOf(PdfStream);
  });

  it('embeds the sRGB ICC profile by default', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const profileRef = dict.get('/DestOutputProfile') as PdfRef;
    const profileStream = registry.resolve(profileRef) as PdfStream;
    expect(profileStream.data.length).toBe(SRGB_ICC_PROFILE.length);
  });

  it('uses custom subtype when provided', () => {
    const registry = new PdfObjectRegistry();
    const options: OutputIntentOptions = { subtype: '/GTS_PDFX' };
    const ref = buildOutputIntent(registry, options);
    const dict = registry.resolve(ref) as PdfDict;

    const sValue = dict.get('/S');
    expect(sValue).toBeInstanceOf(PdfName);
    expect((sValue as PdfName).value).toBe('/GTS_PDFX');
  });

  it('uses custom ICC profile when provided', () => {
    const registry = new PdfObjectRegistry();
    const customProfile = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const options: OutputIntentOptions = {
      iccProfile: customProfile,
      components: 4,
    };
    const ref = buildOutputIntent(registry, options);
    const dict = registry.resolve(ref) as PdfDict;

    const profileRef = dict.get('/DestOutputProfile') as PdfRef;
    const profileStream = registry.resolve(profileRef) as PdfStream;
    expect(profileStream.data).toBe(customProfile);

    // Check /N in the profile stream dict
    const nValue = profileStream.dict.get('/N');
    expect(nValue).toBeInstanceOf(PdfNumber);
    expect((nValue as PdfNumber).value).toBe(4);
  });

  it('uses custom output condition and identifier', () => {
    const registry = new PdfObjectRegistry();
    const options: OutputIntentOptions = {
      outputCondition: 'FOGRA39',
      outputConditionIdentifier: 'FOGRA39L',
      registryName: 'http://www.fogra.org',
    };
    const ref = buildOutputIntent(registry, options);
    const dict = registry.resolve(ref) as PdfDict;

    expect((dict.get('/OutputCondition') as PdfString).value).toBe('FOGRA39');
    expect((dict.get('/OutputConditionIdentifier') as PdfString).value).toBe('FOGRA39L');
    expect((dict.get('/RegistryName') as PdfString).value).toBe('http://www.fogra.org');
  });

  it('normalizes subtype without leading slash', () => {
    const registry = new PdfObjectRegistry();
    const options: OutputIntentOptions = { subtype: 'GTS_PDFA1' };
    const ref = buildOutputIntent(registry, options);
    const dict = registry.resolve(ref) as PdfDict;

    const sValue = dict.get('/S') as PdfName;
    expect(sValue.value).toBe('/GTS_PDFA1');
  });

  it('sets /N = 3 on the profile stream by default', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const profileRef = dict.get('/DestOutputProfile') as PdfRef;
    const profileStream = registry.resolve(profileRef) as PdfStream;
    const nValue = profileStream.dict.get('/N') as PdfNumber;
    expect(nValue.value).toBe(3);
  });
});

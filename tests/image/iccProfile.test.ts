/**
 * Tests for ICC color profile extraction and preservation.
 *
 * Covers:
 *  - parseIccColorSpace with RGB, CMYK, GRAY, and unknown signatures
 *  - parseIccColorSpace with too-short data
 *  - parseIccDescription with synthetic ICC data containing a 'desc' tag
 *  - parseIccDescription with missing/malformed data
 *  - extractIccProfile with undefined / non-array / non-ICCBased inputs
 *  - Full round-trip: create PdfStream with ICCBased color space -> extract -> verify
 *  - embedIccProfile creates a valid stream and reference
 */

import { describe, it, expect } from 'vitest';
import {
  parseIccColorSpace,
  parseIccDescription,
  extractIccProfile,
  embedIccProfile,
} from '../../src/assets/image/iccProfile.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfStream,
  PdfObjectRegistry,
} from '../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers — synthetic ICC profile builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal synthetic ICC profile with the given color space
 * signature and optional description text.
 *
 * The layout follows the ICC v2 spec:
 *  - 128-byte header
 *  - 4-byte tag count
 *  - 12-byte tag table entries
 *  - tag data
 */
function buildSyntheticIccProfile(
  colorSpaceSig: string,
  description?: string,
): Uint8Array {
  // Determine if we need a 'desc' tag
  const hasDesc = description !== undefined && description.length > 0;

  // Header (128 bytes) + tag count (4 bytes)
  const headerSize = 128;
  const tagCountSize = 4;
  const tagEntrySize = 12;
  const numTags = hasDesc ? 1 : 0;
  const tagTableSize = numTags * tagEntrySize;

  // 'desc' tag data: type sig (4) + reserved (4) + length (4) + string + null
  const descDataSize = hasDesc
    ? 4 + 4 + 4 + description!.length + 1
    : 0;

  const totalSize = headerSize + tagCountSize + tagTableSize + descDataSize;
  const data = new Uint8Array(totalSize);
  const view = new DataView(data.buffer);

  // Profile size at offset 0
  view.setUint32(0, totalSize, false);

  // Color space signature at offset 16
  for (let i = 0; i < 4; i++) {
    data[16 + i] = colorSpaceSig.charCodeAt(i);
  }

  // Profile Connection Space at offset 20 (use 'XYZ ' as PCS)
  data[20] = 0x58; // X
  data[21] = 0x59; // Y
  data[22] = 0x5a; // Z
  data[23] = 0x20; // space

  // Tag count at offset 128
  view.setUint32(128, numTags, false);

  if (hasDesc) {
    const tagTableOffset = headerSize + tagCountSize;
    const tagDataOffset = tagTableOffset + tagTableSize;

    // Tag table entry for 'desc'
    // Signature: 'desc' = 0x64657363
    view.setUint32(tagTableOffset, 0x64657363, false);
    // Offset to tag data
    view.setUint32(tagTableOffset + 4, tagDataOffset, false);
    // Size of tag data
    view.setUint32(tagTableOffset + 8, descDataSize, false);

    // Tag data: type signature 'desc' (0x64657363)
    view.setUint32(tagDataOffset, 0x64657363, false);
    // Reserved (4 bytes of zeros already)
    // ASCII description length (including null terminator)
    view.setUint32(tagDataOffset + 8, description!.length + 1, false);
    // ASCII description string
    for (let i = 0; i < description!.length; i++) {
      data[tagDataOffset + 12 + i] = description!.charCodeAt(i);
    }
    // Null terminator (already 0)
  }

  return data;
}

/**
 * Create a PdfStream with an ICCBased color space referencing a profile
 * stream in the given registry.
 */
function createIccBasedImageStream(
  registry: PdfObjectRegistry,
  iccProfileData: Uint8Array,
  components: number,
): { imageStream: PdfStream; imageRef: PdfRef; profileRef: PdfRef } {
  // Create the ICC profile stream
  const profileDict = new PdfDict();
  profileDict.set('/N', PdfNumber.of(components));
  profileDict.set('/Length', PdfNumber.of(iccProfileData.length));
  const profileStream = new PdfStream(profileDict, iccProfileData);
  const profileRef = registry.register(profileStream);

  // Create the image stream with /ColorSpace [/ICCBased <profileRef>]
  const imageDict = new PdfDict();
  imageDict.set('/Type', PdfName.of('/XObject'));
  imageDict.set('/Subtype', PdfName.of('/Image'));
  imageDict.set('/Width', PdfNumber.of(2));
  imageDict.set('/Height', PdfNumber.of(2));
  imageDict.set('/BitsPerComponent', PdfNumber.of(8));
  imageDict.set(
    '/ColorSpace',
    PdfArray.of([PdfName.of('/ICCBased'), profileRef]),
  );

  const pixelData = new Uint8Array(2 * 2 * components);
  imageDict.set('/Length', PdfNumber.of(pixelData.length));
  const imageStream = new PdfStream(imageDict, pixelData);
  const imageRef = registry.register(imageStream);

  return { imageStream, imageRef, profileRef };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseIccColorSpace', () => {
  it('should parse RGB color space signature', () => {
    const data = buildSyntheticIccProfile('RGB ');
    expect(parseIccColorSpace(data)).toBe('RGB');
  });

  it('should parse CMYK color space signature', () => {
    const data = buildSyntheticIccProfile('CMYK');
    expect(parseIccColorSpace(data)).toBe('CMYK');
  });

  it('should parse GRAY color space signature', () => {
    const data = buildSyntheticIccProfile('GRAY');
    expect(parseIccColorSpace(data)).toBe('GRAY');
  });

  it('should parse Lab color space signature', () => {
    const data = buildSyntheticIccProfile('Lab ');
    expect(parseIccColorSpace(data)).toBe('Lab');
  });

  it('should parse XYZ color space signature', () => {
    const data = buildSyntheticIccProfile('XYZ ');
    expect(parseIccColorSpace(data)).toBe('XYZ');
  });

  it('should return "Unknown" for unrecognized signature', () => {
    const data = buildSyntheticIccProfile('????');
    expect(parseIccColorSpace(data)).toBe('Unknown');
  });

  it('should return "Unknown" for data shorter than 20 bytes', () => {
    const data = new Uint8Array(19);
    expect(parseIccColorSpace(data)).toBe('Unknown');
  });

  it('should return "Unknown" for empty data', () => {
    const data = new Uint8Array(0);
    expect(parseIccColorSpace(data)).toBe('Unknown');
  });

  it('should handle exactly 20 bytes', () => {
    const data = new Uint8Array(20);
    // Write 'RGB ' at offset 16
    data[16] = 0x52; // R
    data[17] = 0x47; // G
    data[18] = 0x42; // B
    data[19] = 0x20; // space
    expect(parseIccColorSpace(data)).toBe('RGB');
  });
});

describe('parseIccDescription', () => {
  it('should parse a description from a valid ICC profile', () => {
    const data = buildSyntheticIccProfile('RGB ', 'sRGB IEC61966-2.1');
    const desc = parseIccDescription(data);
    expect(desc).toBe('sRGB IEC61966-2.1');
  });

  it('should parse a short description', () => {
    const data = buildSyntheticIccProfile('RGB ', 'Test');
    const desc = parseIccDescription(data);
    expect(desc).toBe('Test');
  });

  it('should return undefined when no desc tag is present', () => {
    const data = buildSyntheticIccProfile('RGB ');
    const desc = parseIccDescription(data);
    expect(desc).toBeUndefined();
  });

  it('should return undefined for data shorter than 132 bytes', () => {
    const data = new Uint8Array(131);
    const desc = parseIccDescription(data);
    expect(desc).toBeUndefined();
  });

  it('should return undefined for empty data', () => {
    const data = new Uint8Array(0);
    const desc = parseIccDescription(data);
    expect(desc).toBeUndefined();
  });

  it('should handle a description with special ASCII characters', () => {
    const data = buildSyntheticIccProfile('RGB ', 'Profile (v2.0)');
    const desc = parseIccDescription(data);
    expect(desc).toBe('Profile (v2.0)');
  });
});

describe('extractIccProfile', () => {
  it('should return undefined when ColorSpace is not set', () => {
    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    const stream = new PdfStream(dict, new Uint8Array(10));
    registry.register(stream);

    expect(extractIccProfile(stream, registry)).toBeUndefined();
  });

  it('should return undefined when ColorSpace is a simple name (DeviceRGB)', () => {
    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set('/ColorSpace', PdfName.of('/DeviceRGB'));
    const stream = new PdfStream(dict, new Uint8Array(10));
    registry.register(stream);

    expect(extractIccProfile(stream, registry)).toBeUndefined();
  });

  it('should return undefined when ColorSpace array does not start with /ICCBased', () => {
    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set(
      '/ColorSpace',
      PdfArray.of([PdfName.of('/Indexed'), PdfName.of('/DeviceRGB')]),
    );
    const stream = new PdfStream(dict, new Uint8Array(10));
    registry.register(stream);

    expect(extractIccProfile(stream, registry)).toBeUndefined();
  });

  it('should return undefined when ColorSpace array has fewer than 2 items', () => {
    const registry = new PdfObjectRegistry();
    const dict = new PdfDict();
    dict.set('/ColorSpace', PdfArray.of([PdfName.of('/ICCBased')]));
    const stream = new PdfStream(dict, new Uint8Array(10));
    registry.register(stream);

    expect(extractIccProfile(stream, registry)).toBeUndefined();
  });

  it('should return undefined when profile stream reference cannot be resolved', () => {
    const registry = new PdfObjectRegistry();

    // Create an unresolvable ref
    const bogusRef = PdfRef.of(9999);

    const dict = new PdfDict();
    dict.set(
      '/ColorSpace',
      PdfArray.of([PdfName.of('/ICCBased'), bogusRef]),
    );
    const stream = new PdfStream(dict, new Uint8Array(10));
    registry.register(stream);

    expect(extractIccProfile(stream, registry)).toBeUndefined();
  });

  it('should return undefined when /N is out of range', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ');

    const profileDict = new PdfDict();
    profileDict.set('/N', PdfNumber.of(5)); // invalid: > 4
    profileDict.set('/Length', PdfNumber.of(profileData.length));
    const profileStream = new PdfStream(profileDict, profileData);
    const profileRef = registry.register(profileStream);

    const dict = new PdfDict();
    dict.set(
      '/ColorSpace',
      PdfArray.of([PdfName.of('/ICCBased'), profileRef]),
    );
    const imageStream = new PdfStream(dict, new Uint8Array(10));
    registry.register(imageStream);

    expect(extractIccProfile(imageStream, registry)).toBeUndefined();
  });

  it('should extract an RGB ICC profile from an ICCBased color space', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ', 'sRGB Profile');

    const { imageStream } = createIccBasedImageStream(
      registry,
      profileData,
      3,
    );

    const profile = extractIccProfile(imageStream, registry);
    expect(profile).toBeDefined();
    expect(profile!.components).toBe(3);
    expect(profile!.colorSpace).toBe('RGB');
    expect(profile!.description).toBe('sRGB Profile');
    expect(profile!.data).toBe(profileData);
  });

  it('should extract a GRAY ICC profile', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('GRAY', 'Gray Gamma 2.2');

    const { imageStream } = createIccBasedImageStream(
      registry,
      profileData,
      1,
    );

    const profile = extractIccProfile(imageStream, registry);
    expect(profile).toBeDefined();
    expect(profile!.components).toBe(1);
    expect(profile!.colorSpace).toBe('GRAY');
    expect(profile!.description).toBe('Gray Gamma 2.2');
  });

  it('should extract a CMYK ICC profile', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('CMYK', 'FOGRA39');

    const { imageStream } = createIccBasedImageStream(
      registry,
      profileData,
      4,
    );

    const profile = extractIccProfile(imageStream, registry);
    expect(profile).toBeDefined();
    expect(profile!.components).toBe(4);
    expect(profile!.colorSpace).toBe('CMYK');
    expect(profile!.description).toBe('FOGRA39');
  });

  it('should resolve indirect reference on /ColorSpace itself', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ');

    // Create the ICC profile stream
    const profileDict = new PdfDict();
    profileDict.set('/N', PdfNumber.of(3));
    profileDict.set('/Length', PdfNumber.of(profileData.length));
    const profileStream = new PdfStream(profileDict, profileData);
    const profileRef = registry.register(profileStream);

    // Create the color space array and register it as an indirect object
    const csArray = PdfArray.of([PdfName.of('/ICCBased'), profileRef]);
    const csRef = registry.register(csArray);

    // Create image stream with /ColorSpace as an indirect ref
    const imageDict = new PdfDict();
    imageDict.set('/ColorSpace', csRef);
    const imageStream = new PdfStream(imageDict, new Uint8Array(10));
    registry.register(imageStream);

    const profile = extractIccProfile(imageStream, registry);
    expect(profile).toBeDefined();
    expect(profile!.components).toBe(3);
    expect(profile!.colorSpace).toBe('RGB');
  });
});

describe('embedIccProfile', () => {
  it('should create a stream and return a valid PdfRef', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ', 'Test Profile');
    const profile = {
      data: profileData,
      components: 3,
      colorSpace: 'RGB',
      description: 'Test Profile',
    };

    const ref = embedIccProfile(profile, registry);

    expect(ref).toBeInstanceOf(PdfRef);
    expect(ref.objectNumber).toBeGreaterThan(0);

    // Resolve the reference and check the stream
    const resolved = registry.resolve(ref);
    expect(resolved).toBeDefined();
    expect(resolved!.kind).toBe('stream');

    const stream = resolved as PdfStream;
    expect(stream.data).toBe(profileData);

    // Check /N
    const n = stream.dict.get('/N');
    expect(n).toBeDefined();
    expect((n as PdfNumber).value).toBe(3);

    // Check /Alternate
    const alt = stream.dict.get('/Alternate');
    expect(alt).toBeDefined();
    expect((alt as PdfName).value).toBe('/DeviceRGB');
  });

  it('should set /Alternate to /DeviceGray for 1-component profile', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('GRAY');
    const profile = {
      data: profileData,
      components: 1,
      colorSpace: 'GRAY',
      description: undefined,
    };

    const ref = embedIccProfile(profile, registry);
    const stream = registry.resolve(ref) as PdfStream;
    const alt = stream.dict.get('/Alternate');
    expect(alt).toBeDefined();
    expect((alt as PdfName).value).toBe('/DeviceGray');
  });

  it('should set /Alternate to /DeviceCMYK for 4-component profile', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('CMYK');
    const profile = {
      data: profileData,
      components: 4,
      colorSpace: 'CMYK',
      description: undefined,
    };

    const ref = embedIccProfile(profile, registry);
    const stream = registry.resolve(ref) as PdfStream;
    const alt = stream.dict.get('/Alternate');
    expect(alt).toBeDefined();
    expect((alt as PdfName).value).toBe('/DeviceCMYK');
  });

  it('should set /Length correctly', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ');
    const profile = {
      data: profileData,
      components: 3,
      colorSpace: 'RGB',
      description: undefined,
    };

    const ref = embedIccProfile(profile, registry);
    const stream = registry.resolve(ref) as PdfStream;
    const len = stream.dict.get('/Length');
    expect(len).toBeDefined();
    expect((len as PdfNumber).value).toBe(profileData.length);
  });
});

describe('round-trip: extract -> embed -> extract', () => {
  it('should preserve ICC profile data through extract and re-embed', () => {
    const registry = new PdfObjectRegistry();
    const profileData = buildSyntheticIccProfile('RGB ', 'Round Trip Test');

    // Step 1: Create image with ICC profile
    const { imageStream } = createIccBasedImageStream(
      registry,
      profileData,
      3,
    );

    // Step 2: Extract the profile
    const extracted = extractIccProfile(imageStream, registry);
    expect(extracted).toBeDefined();
    expect(extracted!.components).toBe(3);
    expect(extracted!.colorSpace).toBe('RGB');
    expect(extracted!.description).toBe('Round Trip Test');

    // Step 3: Re-embed the profile
    const newProfileRef = embedIccProfile(extracted!, registry);

    // Step 4: Update the image's color space to point to the new profile
    imageStream.dict.set(
      '/ColorSpace',
      PdfArray.of([PdfName.of('/ICCBased'), newProfileRef]),
    );

    // Step 5: Extract again and verify
    const reExtracted = extractIccProfile(imageStream, registry);
    expect(reExtracted).toBeDefined();
    expect(reExtracted!.components).toBe(3);
    expect(reExtracted!.colorSpace).toBe('RGB');
    expect(reExtracted!.description).toBe('Round Trip Test');
    expect(reExtracted!.data.length).toBe(profileData.length);

    // Verify byte-for-byte equality
    for (let i = 0; i < profileData.length; i++) {
      expect(reExtracted!.data[i]).toBe(profileData[i]);
    }
  });
});

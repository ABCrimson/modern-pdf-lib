/**
 * Tests for next-generation image format detection (AVIF / HEIC / HEIF / JPEG XL).
 *
 * These tests cover DETECTION and metadata PROBING only — the module never
 * decodes pixels (no pure-JS AV1 / HEVC / JPEG XL decoder is bundled).
 *
 * Hand-built ISOBMFF fixture
 * --------------------------
 * `buildIsobmff(majorBrand, width, height, bitDepth?)` synthesizes a minimal but
 * spec-faithful ISO Base Media File Format byte stream (ISO/IEC 14496-12):
 *
 *   [ftyp box]                         (ISO/IEC 14496-12 §4.3 FileTypeBox)
 *     size u32 | 'ftyp' | major_brand[4] | minor_version u32 | compatible_brand[4]
 *   [meta box]                         (ISO/IEC 14496-12 §8.11.1 — a FullBox)
 *     size u32 | 'meta' | version+flags u32
 *     [iprp box]                       (ISO/IEC 23008-12 §9.3.1 ItemPropertiesBox)
 *       [ipco box]                     (ISO/IEC 23008-12 §9.3.1 ItemPropertyContainerBox)
 *         [ispe box]                   (ISO/IEC 23008-12 §6.5.3 ImageSpatialExtents — FullBox)
 *           size u32 | 'ispe' | version+flags u32 | width u32 | height u32
 *         [pixi box]  (optional)       (ISO/IEC 23008-12 §6.5.6 PixelInformation — FullBox)
 *           size u32 | 'pixi' | version+flags u32 | num_channels u8 | bits[ ]
 *
 * Every box uses the standard 32-bit `size` form (size counts the whole box,
 * header included), so the box-walker exercises the common path.
 */

import { describe, it, expect } from 'vitest';
import {
  detectNextGenFormat,
  probeNextGenImage,
  type NextGenFormat,
} from '../../../../src/assets/image/nextGenImageDetect.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Encode a 4-char ASCII box type / brand. */
function fourcc(s: string): number[] {
  return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];
}

/** Encode a u32 big-endian. */
function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

/** Build a plain ISOBMFF box: size(u32) + type(4) + payload. */
function box(type: string, payload: number[]): number[] {
  const size = 8 + payload.length;
  return [...u32(size), ...fourcc(type), ...payload];
}

/**
 * Build a minimal ISOBMFF stream with an `ftyp` and a
 * meta>iprp>ipco>ispe(+pixi) property chain.
 */
function buildIsobmff(
  majorBrand: string,
  width: number,
  height: number,
  bitDepth?: number,
): Uint8Array {
  // ftyp box: type is the literal 'ftyp'; the payload carries
  // major_brand(4) + minor_version(u32) + compatible_brands[].
  const ftyp = box('ftyp', [
    ...fourcc(majorBrand), // major_brand
    ...u32(0), // minor_version
    ...fourcc(majorBrand), // compatible_brands[0]
  ]);

  // ispe FullBox: version+flags(0) + width + height
  const ispe = box('ispe', [...u32(0), ...u32(width), ...u32(height)]);

  // optional pixi FullBox: version+flags(0) + num_channels(3) + 3 x bitDepth
  const pixi =
    bitDepth === undefined
      ? []
      : box('pixi', [...u32(0), 3, bitDepth, bitDepth, bitDepth]);

  const ipco = box('ipco', [...ispe, ...pixi]);
  const iprp = box('iprp', ipco);
  // meta is a FullBox: version+flags(0) precede the child boxes.
  const meta = box('meta', [...u32(0), ...iprp]);

  return new Uint8Array([...ftyp, ...meta]);
}

// ---------------------------------------------------------------------------
// detectNextGenFormat
// ---------------------------------------------------------------------------

describe('detectNextGenFormat', () => {
  it('detects AVIF from the "avif" major brand', () => {
    const bytes = buildIsobmff('avif', 64, 48);
    expect(detectNextGenFormat(bytes)).toBe<NextGenFormat>('avif');
  });

  it('detects AVIF from the "avis" (image sequence) major brand', () => {
    const bytes = buildIsobmff('avis', 16, 16);
    expect(detectNextGenFormat(bytes)).toBe('avif');
  });

  it('detects AVIF when "avif" is only a compatible brand', () => {
    // major brand 'mif1', compatible brand 'avif' → AVIF wins.
    const ftyp = box('ftyp', [
      ...fourcc('mif1'),
      ...u32(0),
      ...fourcc('avif'),
    ]);
    expect(detectNextGenFormat(new Uint8Array(ftyp))).toBe('avif');
  });

  it('detects HEIC from the "heic" major brand', () => {
    const bytes = buildIsobmff('heic', 100, 200);
    expect(detectNextGenFormat(bytes)).toBe('heic');
  });

  it('detects HEIC from "heix" and "hevc" brands', () => {
    expect(detectNextGenFormat(buildIsobmff('heix', 8, 8))).toBe('heic');
    expect(detectNextGenFormat(buildIsobmff('hevc', 8, 8))).toBe('heic');
  });

  it('detects HEIF from the generic "mif1" brand', () => {
    expect(detectNextGenFormat(buildIsobmff('mif1', 8, 8))).toBe('heif');
  });

  it('detects HEIF from the "msf1" sequence brand', () => {
    expect(detectNextGenFormat(buildIsobmff('msf1', 8, 8))).toBe('heif');
  });

  it('detects JPEG XL from the raw codestream signature 0xFF 0x0A', () => {
    const bytes = new Uint8Array([0xff, 0x0a, 0x00, 0x00, 0x00]);
    expect(detectNextGenFormat(bytes)).toBe('jpegxl');
  });

  it('detects JPEG XL from the ISOBMFF container signature', () => {
    // 00 00 00 0C 'JXL ' 0D 0A 87 0A
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
    ]);
    expect(detectNextGenFormat(bytes)).toBe('jpegxl');
  });

  it('returns null for a PNG header', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectNextGenFormat(png)).toBeNull();
  });

  it('returns null for a JPEG header', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectNextGenFormat(jpeg)).toBeNull();
  });

  it('returns null for an ISOBMFF file with an unrelated brand (mp4)', () => {
    const bytes = buildIsobmff('mp42', 8, 8);
    expect(detectNextGenFormat(bytes)).toBeNull();
  });

  it('returns null for empty / too-short data', () => {
    expect(detectNextGenFormat(new Uint8Array(0))).toBeNull();
    expect(detectNextGenFormat(new Uint8Array([0x00]))).toBeNull();
    expect(detectNextGenFormat(new Uint8Array([0xff]))).toBeNull();
  });

  it('does not misfire when bytes 4..8 are not "ftyp"', () => {
    const notFtyp = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x6d, 0x6f, 0x6f, 0x76, // 'moov'
    ]);
    expect(detectNextGenFormat(notFtyp)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// probeNextGenImage
// ---------------------------------------------------------------------------

describe('probeNextGenImage', () => {
  it('probes AVIF dimensions from the meta>iprp>ipco>ispe chain', () => {
    const bytes = buildIsobmff('avif', 64, 48);
    const info = probeNextGenImage(bytes);
    expect(info).not.toBeNull();
    expect(info?.format).toBe('avif');
    expect(info?.width).toBe(64);
    expect(info?.height).toBe(48);
    expect(info?.decodable).toBe(false);
    expect(typeof info?.reason).toBe('string');
    expect(info?.reason.length).toBeGreaterThan(0);
  });

  it('probes AVIF bit depth from the optional pixi box', () => {
    const bytes = buildIsobmff('avif', 64, 48, 10);
    const info = probeNextGenImage(bytes);
    expect(info?.width).toBe(64);
    expect(info?.height).toBe(48);
    expect(info?.bitDepth).toBe(10);
  });

  it('leaves bitDepth undefined when no pixi box is present', () => {
    const bytes = buildIsobmff('avif', 64, 48);
    const info = probeNextGenImage(bytes);
    expect(info?.bitDepth).toBeUndefined();
  });

  it('probes HEIC dimensions', () => {
    const bytes = buildIsobmff('heic', 100, 200);
    const info = probeNextGenImage(bytes);
    expect(info?.format).toBe('heic');
    expect(info?.width).toBe(100);
    expect(info?.height).toBe(200);
    expect(info?.decodable).toBe(false);
  });

  it('probes HEIF (mif1) dimensions', () => {
    const bytes = buildIsobmff('mif1', 32, 24);
    const info = probeNextGenImage(bytes);
    expect(info?.format).toBe('heif');
    expect(info?.width).toBe(32);
    expect(info?.height).toBe(24);
  });

  it('returns the format with no dimensions for raw JPEG XL codestream', () => {
    const bytes = new Uint8Array([0xff, 0x0a, 0x00, 0x00]);
    const info = probeNextGenImage(bytes);
    expect(info?.format).toBe('jpegxl');
    expect(info?.decodable).toBe(false);
    expect(info?.reason.length).toBeGreaterThan(0);
  });

  it('returns the format for the JPEG XL container signature', () => {
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
    ]);
    const info = probeNextGenImage(bytes);
    expect(info?.format).toBe('jpegxl');
    expect(info?.decodable).toBe(false);
  });

  it('returns format but undefined dimensions when the ispe box is absent', () => {
    // ftyp with major brand 'avif' only — no meta chain.
    const ftyp = box('ftyp', [...fourcc('avif'), ...u32(0), ...fourcc('avif')]);
    const info = probeNextGenImage(new Uint8Array(ftyp));
    expect(info?.format).toBe('avif');
    expect(info?.width).toBeUndefined();
    expect(info?.height).toBeUndefined();
    expect(info?.decodable).toBe(false);
  });

  it('never reports decodable:true', () => {
    const samples: Uint8Array[] = [
      buildIsobmff('avif', 64, 48),
      buildIsobmff('heic', 64, 48),
      buildIsobmff('mif1', 64, 48),
      new Uint8Array([0xff, 0x0a]),
    ];
    for (const s of samples) {
      const info = probeNextGenImage(s);
      expect(info?.decodable).toBe(false);
    }
  });

  it('returns null for non next-gen input (PNG)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(probeNextGenImage(png)).toBeNull();
  });

  it('returns null for empty data', () => {
    expect(probeNextGenImage(new Uint8Array(0))).toBeNull();
  });

  it('tolerates a 64-bit largesize box header', () => {
    // Build an ftyp normally, but wrap the meta in a largesize (size==1) box
    // to exercise the 64-bit branch of the walker.
    const ispe = box('ispe', [...u32(0), ...u32(70), ...u32(50)]);
    const ipco = box('ipco', ispe);
    const iprp = box('iprp', ipco);
    const metaPayload = [...u32(0), ...iprp];

    // largesize box: size32==1, type, largesize64, payload
    const metaSize = 16 + metaPayload.length; // 8 (size+type) + 8 (largesize) + payload
    const metaLarge = [
      ...u32(1),
      ...fourcc('meta'),
      ...u32(0),
      ...u32(metaSize),
      ...metaPayload,
    ];
    const ftyp = box('ftyp', [...fourcc('avif'), ...u32(0), ...fourcc('avif')]);
    const bytes = new Uint8Array([...ftyp, ...metaLarge]);

    const info = probeNextGenImage(bytes);
    expect(info?.format).toBe('avif');
    expect(info?.width).toBe(70);
    expect(info?.height).toBe(50);
  });
});

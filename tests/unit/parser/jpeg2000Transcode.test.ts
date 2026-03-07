/**
 * Tests for JPEG2000-to-JPEG transcoding and size estimation.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTranscodedSize,
} from '../../../src/parser/jpeg2000Transcode.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a JP2 signature box. */
function buildSignatureBox(): Uint8Array {
  return new Uint8Array([
    0x00, 0x00, 0x00, 0x0C,
    0x6A, 0x50, 0x20, 0x20,
    0x0D, 0x0A, 0x87, 0x0A,
  ]);
}

/** Build a JP2 box with the given type and payload. */
function buildBox(type: string, payload: Uint8Array): Uint8Array {
  const totalLength = 8 + payload.length;
  const box = new Uint8Array(totalLength);
  box[0] = (totalLength >>> 24) & 0xFF;
  box[1] = (totalLength >>> 16) & 0xFF;
  box[2] = (totalLength >>> 8) & 0xFF;
  box[3] = totalLength & 0xFF;
  for (let i = 0; i < 4; i++) {
    box[4 + i] = type.charCodeAt(i);
  }
  box.set(payload, 8);
  return box;
}

/** Build a minimal JP2 header superbox containing an ihdr box. */
function buildJp2hBox(
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const ihdrPayload = new Uint8Array(14);
  const view = new DataView(ihdrPayload.buffer);
  view.setUint32(0, height, false);
  view.setUint32(4, width, false);
  view.setUint16(8, components, false);
  ihdrPayload[10] = 7; // bpc = 8 (stored as 7 = bpc - 1)
  ihdrPayload[11] = 7;
  ihdrPayload[12] = 0;
  ihdrPayload[13] = 0;

  const ihdr = buildBox('ihdr', ihdrPayload);
  return buildBox('jp2h', ihdr);
}

/**
 * Build a minimal JP2 with known dimensions for size estimation testing.
 */
function buildJp2WithDimensions(
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const sig = buildSignatureBox();
  const ftyp = buildBox('ftyp', new Uint8Array(8));
  const jp2h = buildJp2hBox(width, height, components);
  const jp2c = buildBox('jp2c', new Uint8Array([0xFF, 0x4F, 0xFF, 0xD9]));

  const total = sig.length + ftyp.length + jp2h.length + jp2c.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const part of [sig, ftyp, jp2h, jp2c]) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

/**
 * Build a raw J2K codestream with SIZ marker containing known dimensions.
 *
 * SIZ marker structure:
 * - FF 4F (SOC)
 * - FF 51 (SIZ marker)
 * - Lsiz (2 bytes)
 * - Rsiz (2 bytes, capabilities)
 * - Xsiz (4 bytes, reference grid width)
 * - Ysiz (4 bytes, reference grid height)
 * - XOsiz (4 bytes, horizontal offset)
 * - YOsiz (4 bytes, vertical offset)
 * - XTsiz (4 bytes, tile width)
 * - YTsiz (4 bytes, tile height)
 * - XTOsiz (4 bytes, tile horizontal offset)
 * - YTOsiz (4 bytes, tile vertical offset)
 * - Csiz (2 bytes, number of components)
 */
function buildRawCodestreamWithSiz(
  width: number,
  height: number,
  components: number,
): Uint8Array {
  const siz = new Uint8Array(2 + 2 + 2 + 38 + components * 3);
  const view = new DataView(siz.buffer);

  // SOC marker
  siz[0] = 0xFF; siz[1] = 0x4F;

  // SIZ marker
  siz[2] = 0xFF; siz[3] = 0x51;

  const sizLen = 38 + components * 3;
  view.setUint16(4, sizLen, false);  // Lsiz
  view.setUint16(6, 0, false);       // Rsiz (capabilities)
  view.setUint32(8, width, false);    // Xsiz
  view.setUint32(12, height, false);  // Ysiz
  view.setUint32(16, 0, false);       // XOsiz
  view.setUint32(20, 0, false);       // YOsiz
  view.setUint32(24, width, false);   // XTsiz (single tile)
  view.setUint32(28, height, false);  // YTsiz (single tile)
  view.setUint32(32, 0, false);       // XTOsiz
  view.setUint32(36, 0, false);       // YTOsiz
  view.setUint16(40, components, false); // Csiz

  // Component info: Ssiz(1), XRsiz(1), YRsiz(1) for each
  for (let i = 0; i < components; i++) {
    const off = 42 + i * 3;
    siz[off] = 7;  // Ssiz: 8 bits (stored as 7 = bpc-1)
    siz[off + 1] = 1; // XRsiz
    siz[off + 2] = 1; // YRsiz
  }

  return siz;
}

// ---------------------------------------------------------------------------
// estimateTranscodedSize
// ---------------------------------------------------------------------------

describe('estimateTranscodedSize', () => {
  it('estimates size for JP2 container with known dimensions', () => {
    const jp2 = buildJp2WithDimensions(640, 480, 3);
    const estimate = estimateTranscodedSize(jp2, 85);

    // Should be a positive number proportional to pixel count
    expect(estimate).toBeGreaterThan(0);

    // At quality 85, ~0.47 bytes/pixel/channel
    // 640 * 480 * 3 * 0.47 = ~433,152
    expect(estimate).toBeLessThan(640 * 480 * 3); // Less than uncompressed
    expect(estimate).toBeGreaterThan(640 * 480 * 3 * 0.05); // More than minimum
  });

  it('estimates larger size for higher quality', () => {
    const jp2 = buildJp2WithDimensions(100, 100, 3);
    const low = estimateTranscodedSize(jp2, 20);
    const high = estimateTranscodedSize(jp2, 95);

    expect(high).toBeGreaterThan(low);
  });

  it('estimates size for raw J2K codestream', () => {
    const cs = buildRawCodestreamWithSiz(800, 600, 3);
    const estimate = estimateTranscodedSize(cs, 85);

    expect(estimate).toBeGreaterThan(0);
  });

  it('returns fallback for unknown format', () => {
    const unknown = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const estimate = estimateTranscodedSize(unknown, 85);

    // Should fall back to jp2Data.length * 0.8
    expect(estimate).toBe(8);
  });

  it('clamps quality to valid range', () => {
    const jp2 = buildJp2WithDimensions(100, 100, 3);

    // Quality = 0 -> clamped to 1
    const lowEst = estimateTranscodedSize(jp2, 0);
    expect(lowEst).toBeGreaterThan(0);

    // Quality = 200 -> clamped to 100
    const highEst = estimateTranscodedSize(jp2, 200);
    expect(highEst).toBeGreaterThan(0);
  });

  it('strips alpha from estimation (uses min 3 components)', () => {
    const jp2_rgba = buildJp2WithDimensions(100, 100, 4);
    const jp2_rgb = buildJp2WithDimensions(100, 100, 3);

    const est_rgba = estimateTranscodedSize(jp2_rgba, 85);
    const est_rgb = estimateTranscodedSize(jp2_rgb, 85);

    // RGBA should produce same estimate as RGB (alpha is stripped)
    expect(est_rgba).toBe(est_rgb);
  });

  it('handles grayscale correctly', () => {
    const jp2 = buildJp2WithDimensions(100, 100, 1);
    const est = estimateTranscodedSize(jp2, 85);

    // Grayscale: 1 component
    const jp2_rgb = buildJp2WithDimensions(100, 100, 3);
    const est_rgb = estimateTranscodedSize(jp2_rgb, 85);

    // Grayscale should be roughly 1/3 of RGB
    expect(est).toBeLessThan(est_rgb);
  });

  it('uses default quality 85 when not specified', () => {
    const jp2 = buildJp2WithDimensions(100, 100, 3);
    const est1 = estimateTranscodedSize(jp2);
    const est2 = estimateTranscodedSize(jp2, 85);

    expect(est1).toBe(est2);
  });
});

// ---------------------------------------------------------------------------
// TranscodeOptions type checks
// ---------------------------------------------------------------------------

describe('TranscodeOptions', () => {
  it('exports transcodeJp2ToJpeg function', async () => {
    const mod = await import('../../../src/parser/jpeg2000Transcode.js');
    expect(typeof mod.transcodeJp2ToJpeg).toBe('function');
  });

  it('exports estimateTranscodedSize function', async () => {
    const mod = await import('../../../src/parser/jpeg2000Transcode.js');
    expect(typeof mod.estimateTranscodedSize).toBe('function');
  });
});

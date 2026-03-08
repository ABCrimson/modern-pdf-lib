/**
 * Tests for JPEG embedding — SOF parsing, color space detection,
 * Adobe APP14 marker handling, JFIF detection, and error handling.
 *
 * Uses inline minimal JPEG fixtures (no external files needed for
 * basic structural tests).
 */

import { describe, it, expect } from 'vitest';
import {
  embedJpeg,
  isJpeg,
  getJpegInfo,
} from '../../../src/assets/image/jpegEmbed.js';
import type { JpegEmbedResult } from '../../../src/assets/image/jpegEmbed.js';

// ---------------------------------------------------------------------------
// Helpers — JPEG builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid JPEG with a SOF0 marker.
 *
 * @param width      Image width in pixels.
 * @param height     Image height in pixels.
 * @param components Number of color components (1, 3, or 4).
 * @param precision  Bits per component (default: 8).
 */
function buildMinimalJpeg(
  width: number,
  height: number,
  components = 3,
  precision = 8,
): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // SOF0 marker
  parts.push(0xFF, 0xC0);
  const sofLength = 8 + components * 3;
  parts.push((sofLength >> 8) & 0xFF, sofLength & 0xFF);
  parts.push(precision);
  parts.push((height >> 8) & 0xFF, height & 0xFF);
  parts.push((width >> 8) & 0xFF, width & 0xFF);
  parts.push(components);

  for (let i = 0; i < components; i++) {
    parts.push(i + 1); // component ID
    parts.push(0x11);  // sampling factors (1x1)
    parts.push(0);     // quantization table ID
  }

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

/**
 * Build a JPEG with a specific SOF marker type (e.g., SOF2 for progressive).
 */
function buildJpegWithSofType(
  sofMarker: number,
  width: number,
  height: number,
  components = 3,
): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // SOFn marker
  parts.push(0xFF, sofMarker);
  const sofLength = 8 + components * 3;
  parts.push((sofLength >> 8) & 0xFF, sofLength & 0xFF);
  parts.push(8); // precision
  parts.push((height >> 8) & 0xFF, height & 0xFF);
  parts.push((width >> 8) & 0xFF, width & 0xFF);
  parts.push(components);

  for (let i = 0; i < components; i++) {
    parts.push(i + 1);
    parts.push(0x11);
    parts.push(0);
  }

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

/**
 * Build a JPEG with a JFIF APP0 marker.
 */
function buildJpegWithJfif(width: number, height: number): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // APP0 (JFIF) marker
  parts.push(0xFF, 0xE0);
  // Length = 2 (length field itself) + 5 (JFIF\0) + 2 (version) + 1 (units)
  //        + 2 (Xdensity) + 2 (Ydensity) + 1 (Xthumbnail) + 1 (Ythumbnail) = 16
  const app0Length = 16;
  parts.push((app0Length >> 8) & 0xFF, app0Length & 0xFF);
  // "JFIF\0"
  parts.push(0x4A, 0x46, 0x49, 0x46, 0x00);
  // Version 1.01
  parts.push(0x01, 0x01);
  // Units: 0 = no units
  parts.push(0x00);
  // Xdensity (2 bytes), Ydensity (2 bytes)
  parts.push(0x00, 0x48, 0x00, 0x48);
  // Xthumbnail, Ythumbnail (both 0 — no thumbnail)
  parts.push(0x00, 0x00);

  // SOF0 marker
  parts.push(0xFF, 0xC0);
  const sofLength = 8 + 3 * 3;
  parts.push((sofLength >> 8) & 0xFF, sofLength & 0xFF);
  parts.push(8); // precision
  parts.push((height >> 8) & 0xFF, height & 0xFF);
  parts.push((width >> 8) & 0xFF, width & 0xFF);
  parts.push(3); // components

  for (let i = 0; i < 3; i++) {
    parts.push(i + 1, 0x11, 0);
  }

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

/**
 * Build a JPEG with an Adobe APP14 marker.
 *
 * @param colorTransform 0=no transform, 1=YCbCr, 2=YCCK
 */
function buildJpegWithAdobe(
  width: number,
  height: number,
  components: number,
  colorTransform: number,
): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // APP14 (Adobe) marker — 0xFFEE
  parts.push(0xFF, 0xEE);
  const app14Length = 14; // 2 + 5 ("Adobe") + 2 (version) + 2 (flags0) + 2 (flags1) + 1 (color transform)
  parts.push((app14Length >> 8) & 0xFF, app14Length & 0xFF);
  // "Adobe"
  parts.push(0x41, 0x64, 0x6F, 0x62, 0x65);
  // Version (2 bytes)
  parts.push(0x00, 0x64);
  // Flags0 (2 bytes)
  parts.push(0x00, 0x00);
  // Flags1 (2 bytes)
  parts.push(0x00, 0x00);
  // Color transform
  parts.push(colorTransform);

  // SOF0 marker
  parts.push(0xFF, 0xC0);
  const sofLength = 8 + components * 3;
  parts.push((sofLength >> 8) & 0xFF, sofLength & 0xFF);
  parts.push(8); // precision
  parts.push((height >> 8) & 0xFF, height & 0xFF);
  parts.push((width >> 8) & 0xFF, width & 0xFF);
  parts.push(components);

  for (let i = 0; i < components; i++) {
    parts.push(i + 1, 0x11, 0);
  }

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

/**
 * Build a JPEG with an arbitrary marker before the SOF marker
 * (e.g., DQT, DHT) to test that the parser skips non-SOF markers.
 */
function buildJpegWithExtraMarkers(width: number, height: number): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xFF, 0xD8);

  // DQT marker (0xFFDB) with dummy data
  parts.push(0xFF, 0xDB);
  const dqtLength = 5; // just 3 bytes of dummy data + 2 for length
  parts.push((dqtLength >> 8) & 0xFF, dqtLength & 0xFF);
  parts.push(0x00, 0x10, 0x20); // dummy quantization data

  // DHT marker (0xFFC4) with dummy data
  parts.push(0xFF, 0xC4);
  const dhtLength = 4;
  parts.push((dhtLength >> 8) & 0xFF, dhtLength & 0xFF);
  parts.push(0x00, 0x00); // dummy Huffman data

  // SOF0 marker
  parts.push(0xFF, 0xC0);
  const sofLength = 8 + 3 * 3;
  parts.push((sofLength >> 8) & 0xFF, sofLength & 0xFF);
  parts.push(8);
  parts.push((height >> 8) & 0xFF, height & 0xFF);
  parts.push((width >> 8) & 0xFF, width & 0xFF);
  parts.push(3);

  for (let i = 0; i < 3; i++) {
    parts.push(i + 1, 0x11, 0);
  }

  // EOI
  parts.push(0xFF, 0xD9);

  return new Uint8Array(parts);
}

// ---------------------------------------------------------------------------
// Tests: isJpeg
// ---------------------------------------------------------------------------

describe('isJpeg', () => {
  it('returns true for valid JPEG data', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    expect(isJpeg(jpeg)).toBe(true);
  });

  it('returns true for data starting with 0xFFD8', () => {
    const data = new Uint8Array([0xFF, 0xD8, 0x00, 0x00]);
    expect(isJpeg(data)).toBe(true);
  });

  it('returns false for PNG signature', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    expect(isJpeg(png)).toBe(false);
  });

  it('returns false for empty data', () => {
    expect(isJpeg(new Uint8Array(0))).toBe(false);
  });

  it('returns false for single byte', () => {
    expect(isJpeg(new Uint8Array([0xFF]))).toBe(false);
  });

  it('returns false for 0xFF followed by non-D8', () => {
    expect(isJpeg(new Uint8Array([0xFF, 0xD9]))).toBe(false);
    expect(isJpeg(new Uint8Array([0xFF, 0x00]))).toBe(false);
  });

  it('returns false for random bytes', () => {
    expect(isJpeg(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — SOF parsing and dimensions
// ---------------------------------------------------------------------------

describe('embedJpeg — SOF parsing', () => {
  it('parses SOF0 (baseline) correctly', () => {
    const jpeg = buildMinimalJpeg(640, 480);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.bitsPerComponent).toBe(8);
  });

  it('parses SOF2 (progressive) correctly', () => {
    const jpeg = buildJpegWithSofType(0xC2, 1920, 1080);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('parses SOF1 (extended sequential) correctly', () => {
    const jpeg = buildJpegWithSofType(0xC1, 800, 600);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('parses SOF3 (lossless) correctly', () => {
    const jpeg = buildJpegWithSofType(0xC3, 256, 256);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('handles 1x1 pixel image', () => {
    const jpeg = buildMinimalJpeg(1, 1);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('handles large dimensions', () => {
    const jpeg = buildMinimalJpeg(4000, 3000);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(4000);
    expect(result.height).toBe(3000);
  });

  it('handles maximum JPEG dimensions (65535)', () => {
    const jpeg = buildMinimalJpeg(65535, 65535);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(65535);
    expect(result.height).toBe(65535);
  });

  it('skips non-SOF markers to find the SOF marker', () => {
    const jpeg = buildJpegWithExtraMarkers(320, 240);
    const result = embedJpeg(jpeg);
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
  });

  it('reports correct bits per component', () => {
    // 8-bit precision
    const jpeg8 = buildMinimalJpeg(100, 100, 3, 8);
    expect(embedJpeg(jpeg8).bitsPerComponent).toBe(8);

    // 12-bit precision
    const jpeg12 = buildMinimalJpeg(100, 100, 3, 12);
    expect(embedJpeg(jpeg12).bitsPerComponent).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — color space detection
// ---------------------------------------------------------------------------

describe('embedJpeg — color space detection', () => {
  it('detects DeviceGray for 1-component JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100, 1);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceGray');
    expect(result.componentCount).toBe(1);
    expect(result.isCmyk).toBe(false);
  });

  it('detects DeviceRGB for 3-component JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100, 3);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceRGB');
    expect(result.componentCount).toBe(3);
    expect(result.isCmyk).toBe(false);
  });

  it('detects DeviceCMYK for 4-component JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100, 4);
    const result = embedJpeg(jpeg);
    expect(result.colorSpace).toBe('DeviceCMYK');
    expect(result.componentCount).toBe(4);
    expect(result.isCmyk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — Adobe APP14 marker detection
// ---------------------------------------------------------------------------

describe('embedJpeg — Adobe APP14 marker', () => {
  it('detects Adobe marker with transform 0 (no transform)', () => {
    const jpeg = buildJpegWithAdobe(100, 100, 3, 0);
    const result = embedJpeg(jpeg);
    expect(result.hasAdobeMarker).toBe(true);
  });

  it('detects Adobe marker with transform 1 (YCbCr)', () => {
    const jpeg = buildJpegWithAdobe(100, 100, 3, 1);
    const result = embedJpeg(jpeg);
    expect(result.hasAdobeMarker).toBe(true);
  });

  it('detects Adobe marker with transform 2 (YCCK) on 4-component JPEG', () => {
    const jpeg = buildJpegWithAdobe(100, 100, 4, 2);
    const result = embedJpeg(jpeg);
    expect(result.hasAdobeMarker).toBe(true);
    expect(result.isCmyk).toBe(true);
  });

  it('reports no Adobe marker for plain JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const result = embedJpeg(jpeg);
    expect(result.hasAdobeMarker).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — passthrough and filter
// ---------------------------------------------------------------------------

describe('embedJpeg — passthrough and filter', () => {
  it('always uses DCTDecode filter', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const result = embedJpeg(jpeg);
    expect(result.filter).toBe('DCTDecode');
  });

  it('passes through the original JPEG data without modification', () => {
    const jpeg = buildMinimalJpeg(200, 150);
    const result = embedJpeg(jpeg);
    // The imageData should be the exact same Uint8Array reference
    expect(result.imageData).toBe(jpeg);
    expect(result.imageData.length).toBe(jpeg.length);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — error handling
// ---------------------------------------------------------------------------

describe('embedJpeg — error handling', () => {
  it('throws for empty data', () => {
    expect(() => embedJpeg(new Uint8Array(0))).toThrow(/Invalid JPEG|SOI/);
  });

  it('throws for single byte', () => {
    expect(() => embedJpeg(new Uint8Array([0xFF]))).toThrow(/Invalid JPEG|SOI/);
  });

  it('throws for data with wrong SOI marker', () => {
    const bad = new Uint8Array([0xFF, 0xD9]); // EOI, not SOI
    expect(() => embedJpeg(bad)).toThrow(/Invalid JPEG|SOI/);
  });

  it('throws for non-JPEG data (PNG header)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(() => embedJpeg(png)).toThrow(/Invalid JPEG|SOI/);
  });

  it('throws for JPEG with SOI but no SOF marker', () => {
    // SOI + EOI only — no SOF in between
    const soiEoi = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
    expect(() => embedJpeg(soiEoi)).toThrow(/no SOF|Invalid JPEG/);
  });

  it('throws for truncated data after SOI', () => {
    // SOI marker only, no markers after
    const truncated = new Uint8Array([0xFF, 0xD8]);
    expect(() => embedJpeg(truncated)).toThrow(/no SOF|Invalid JPEG/);
  });
});

// ---------------------------------------------------------------------------
// Tests: getJpegInfo
// ---------------------------------------------------------------------------

describe('getJpegInfo', () => {
  it('extracts width, height, and component count', () => {
    const jpeg = buildMinimalJpeg(800, 600, 3);
    const info = getJpegInfo(jpeg);
    expect(info.width).toBe(800);
    expect(info.height).toBe(600);
    expect(info.componentCount).toBe(3);
    expect(info.precision).toBe(8);
  });

  it('reports hasJfif for JFIF-tagged JPEG', () => {
    const jpeg = buildJpegWithJfif(100, 100);
    const info = getJpegInfo(jpeg);
    expect(info.hasJfif).toBe(true);
  });

  it('reports no JFIF for plain JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const info = getJpegInfo(jpeg);
    expect(info.hasJfif).toBe(false);
  });

  it('reports hasAdobe for Adobe-tagged JPEG', () => {
    const jpeg = buildJpegWithAdobe(100, 100, 3, 1);
    const info = getJpegInfo(jpeg);
    expect(info.hasAdobe).toBe(true);
  });

  it('reports no Adobe for plain JPEG', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const info = getJpegInfo(jpeg);
    expect(info.hasAdobe).toBe(false);
  });

  it('handles grayscale JPEG metadata', () => {
    const jpeg = buildMinimalJpeg(256, 256, 1);
    const info = getJpegInfo(jpeg);
    expect(info.componentCount).toBe(1);
    expect(info.width).toBe(256);
    expect(info.height).toBe(256);
  });

  it('handles CMYK JPEG metadata', () => {
    const jpeg = buildMinimalJpeg(300, 200, 4);
    const info = getJpegInfo(jpeg);
    expect(info.componentCount).toBe(4);
  });

  it('throws for invalid data', () => {
    expect(() => getJpegInfo(new Uint8Array([0x00, 0x00]))).toThrow();
  });

  it('reports 12-bit precision', () => {
    const jpeg = buildMinimalJpeg(100, 100, 3, 12);
    const info = getJpegInfo(jpeg);
    expect(info.precision).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedJpeg — JpegEmbedResult interface completeness
// ---------------------------------------------------------------------------

describe('JpegEmbedResult interface', () => {
  it('has all required properties', () => {
    const jpeg = buildMinimalJpeg(100, 100);
    const result = embedJpeg(jpeg);

    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
    expect(typeof result.bitsPerComponent).toBe('number');
    expect(typeof result.colorSpace).toBe('string');
    expect(typeof result.componentCount).toBe('number');
    expect(result.imageData).toBeInstanceOf(Uint8Array);
    expect(typeof result.filter).toBe('string');
    expect(typeof result.isCmyk).toBe('boolean');
    expect(typeof result.hasAdobeMarker).toBe('boolean');
  });

  it('colorSpace is one of the three valid values', () => {
    const validColorSpaces = ['DeviceGray', 'DeviceRGB', 'DeviceCMYK'];

    for (const comps of [1, 3, 4]) {
      const jpeg = buildMinimalJpeg(100, 100, comps);
      const result = embedJpeg(jpeg);
      expect(validColorSpaces).toContain(result.colorSpace);
    }
  });
});

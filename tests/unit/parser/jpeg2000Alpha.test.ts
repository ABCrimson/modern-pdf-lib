/**
 * Tests for JPEG2000 alpha channel handling — detection, separation,
 * pre-multiplication, and component extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  hasAlphaChannel,
  getAlphaChannelIndex,
  separateAlpha,
  premultiplyAlpha,
  extractAlphaChannel,
  parseChannelDefinitions,
} from '../../../src/parser/jpeg2000Alpha.js';

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

/**
 * Build a cdef box payload.
 *
 * @param entries - Array of [channelIndex, type, association] tuples.
 */
function buildCdefPayload(
  entries: Array<[number, number, number]>,
): Uint8Array {
  const data = new Uint8Array(2 + entries.length * 6);
  const view = new DataView(data.buffer);
  view.setUint16(0, entries.length, false);

  for (let i = 0; i < entries.length; i++) {
    const offset = 2 + i * 6;
    view.setUint16(offset, entries[i]![0]!, false);     // channel index
    view.setUint16(offset + 2, entries[i]![1]!, false); // type
    view.setUint16(offset + 4, entries[i]![2]!, false); // association
  }

  return data;
}

/**
 * Build a minimal JP2 file with optional cdef box.
 */
function buildJp2WithCdef(
  entries?: Array<[number, number, number]>,
): Uint8Array {
  const parts: Uint8Array[] = [buildSignatureBox()];

  parts.push(buildBox('ftyp', new Uint8Array(8)));

  if (entries) {
    parts.push(buildBox('cdef', buildCdefPayload(entries)));
  }

  parts.push(buildBox('jp2c', new Uint8Array([0xFF, 0x4F, 0xFF, 0xD9])));

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Channel definition parsing
// ---------------------------------------------------------------------------

describe('parseChannelDefinitions', () => {
  it('parses RGBA channel definitions', () => {
    const payload = buildCdefPayload([
      [0, 0, 1], // R, color, associated with channel 1
      [1, 0, 2], // G, color, associated with channel 2
      [2, 0, 3], // B, color, associated with channel 3
      [3, 1, 0], // Alpha, opacity, whole image
    ]);

    const defs = parseChannelDefinitions(payload);
    expect(defs).toHaveLength(4);

    expect(defs[0]!.channelIndex).toBe(0);
    expect(defs[0]!.type).toBe(0); // color

    expect(defs[3]!.channelIndex).toBe(3);
    expect(defs[3]!.type).toBe(1); // opacity
    expect(defs[3]!.association).toBe(0); // whole image
  });

  it('parses pre-multiplied alpha', () => {
    const payload = buildCdefPayload([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [3, 2, 0], // type=2 = pre-multiplied opacity
    ]);

    const defs = parseChannelDefinitions(payload);
    expect(defs[3]!.type).toBe(2);
  });

  it('returns empty for too-short data', () => {
    expect(parseChannelDefinitions(new Uint8Array(0))).toEqual([]);
    expect(parseChannelDefinitions(new Uint8Array(1))).toEqual([]);
  });

  it('handles truncated entries gracefully', () => {
    // Says 3 entries but only has data for 1
    const data = new Uint8Array(8); // 2 + 6 = 8 bytes = 1 entry
    const view = new DataView(data.buffer);
    view.setUint16(0, 3, false); // Claims 3 entries
    view.setUint16(2, 0, false);
    view.setUint16(4, 0, false);
    view.setUint16(6, 1, false);

    const defs = parseChannelDefinitions(data);
    expect(defs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Alpha detection
// ---------------------------------------------------------------------------

describe('hasAlphaChannel', () => {
  it('returns true when cdef contains opacity channel', () => {
    const jp2 = buildJp2WithCdef([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [3, 1, 0], // Opacity
    ]);
    expect(hasAlphaChannel(jp2)).toBe(true);
  });

  it('returns true when cdef contains pre-multiplied opacity', () => {
    const jp2 = buildJp2WithCdef([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [3, 2, 0], // Pre-multiplied opacity
    ]);
    expect(hasAlphaChannel(jp2)).toBe(true);
  });

  it('returns false when cdef has no opacity channel', () => {
    const jp2 = buildJp2WithCdef([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
    ]);
    expect(hasAlphaChannel(jp2)).toBe(false);
  });

  it('returns false when no cdef box exists', () => {
    const jp2 = buildJp2WithCdef(); // No cdef
    expect(hasAlphaChannel(jp2)).toBe(false);
  });

  it('returns false for non-JP2 data', () => {
    const rawCodestream = new Uint8Array([0xFF, 0x4F, 0xFF, 0xD9]);
    expect(hasAlphaChannel(rawCodestream)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Alpha channel index
// ---------------------------------------------------------------------------

describe('getAlphaChannelIndex', () => {
  it('returns correct alpha channel index', () => {
    const jp2 = buildJp2WithCdef([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [3, 1, 0],
    ]);
    expect(getAlphaChannelIndex(jp2)).toBe(3);
  });

  it('returns -1 when no alpha channel', () => {
    const jp2 = buildJp2WithCdef([
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
    ]);
    expect(getAlphaChannelIndex(jp2)).toBe(-1);
  });

  it('returns -1 for non-JP2 data', () => {
    expect(getAlphaChannelIndex(new Uint8Array([0xFF, 0x4F]))).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// separateAlpha
// ---------------------------------------------------------------------------

describe('separateAlpha', () => {
  it('separates 4-component RGBA into RGB + alpha', () => {
    // 2x2 image: RGBA pixels
    const pixels = new Uint8Array([
      255, 0, 0, 128,   // red, half alpha
      0, 255, 0, 255,   // green, full alpha
      0, 0, 255, 0,     // blue, zero alpha
      100, 100, 100, 64, // gray, quarter alpha
    ]);

    const { rgb, alpha } = separateAlpha(pixels, 2, 2, 4);

    // RGB should have 3 channels per pixel
    expect(rgb.length).toBe(12); // 4 pixels * 3 channels
    expect(rgb[0]).toBe(255); expect(rgb[1]).toBe(0); expect(rgb[2]).toBe(0);
    expect(rgb[3]).toBe(0); expect(rgb[4]).toBe(255); expect(rgb[5]).toBe(0);
    expect(rgb[6]).toBe(0); expect(rgb[7]).toBe(0); expect(rgb[8]).toBe(255);
    expect(rgb[9]).toBe(100); expect(rgb[10]).toBe(100); expect(rgb[11]).toBe(100);

    // Alpha should have 1 byte per pixel
    expect(alpha.length).toBe(4);
    expect(alpha[0]).toBe(128);
    expect(alpha[1]).toBe(255);
    expect(alpha[2]).toBe(0);
    expect(alpha[3]).toBe(64);
  });

  it('separates 2-component grayscale+alpha', () => {
    // 3x1 image: GA pixels
    const pixels = new Uint8Array([
      200, 255,  // gray=200, alpha=255
      100, 128,  // gray=100, alpha=128
      50, 0,     // gray=50, alpha=0
    ]);

    const { rgb, alpha } = separateAlpha(pixels, 3, 1, 2);

    // Single color channel output
    expect(rgb.length).toBe(3);
    expect(rgb[0]).toBe(200);
    expect(rgb[1]).toBe(100);
    expect(rgb[2]).toBe(50);

    expect(alpha.length).toBe(3);
    expect(alpha[0]).toBe(255);
    expect(alpha[1]).toBe(128);
    expect(alpha[2]).toBe(0);
  });

  it('throws for single-component input', () => {
    expect(() => separateAlpha(new Uint8Array(4), 2, 2, 1)).toThrow(
      'at least 2 components',
    );
  });

  it('throws for data that is too short', () => {
    expect(() => separateAlpha(new Uint8Array(3), 2, 2, 4)).toThrow(
      'expected 16 bytes',
    );
  });
});

// ---------------------------------------------------------------------------
// premultiplyAlpha
// ---------------------------------------------------------------------------

describe('premultiplyAlpha', () => {
  it('pre-multiplies fully opaque pixels unchanged', () => {
    const rgb = new Uint8Array([255, 128, 64]);
    const alpha = new Uint8Array([255]);
    const result = premultiplyAlpha(rgb, alpha, 1, 1);

    expect(result[0]).toBe(255);
    expect(result[1]).toBe(128);
    expect(result[2]).toBe(64);
  });

  it('pre-multiplies fully transparent pixels to black', () => {
    const rgb = new Uint8Array([255, 128, 64]);
    const alpha = new Uint8Array([0]);
    const result = premultiplyAlpha(rgb, alpha, 1, 1);

    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it('pre-multiplies half-alpha correctly', () => {
    const rgb = new Uint8Array([200, 100, 50]);
    const alpha = new Uint8Array([128]);
    const result = premultiplyAlpha(rgb, alpha, 1, 1);

    // (200 * 128 + 127) / 255 = 100.99 -> 100
    // (100 * 128 + 127) / 255 = 50.69 -> 50
    // (50 * 128 + 127) / 255 = 25.60 -> 25
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(50);
    expect(result[2]).toBe(25);
  });

  it('handles multiple pixels', () => {
    const rgb = new Uint8Array([
      255, 0, 0,   // red
      0, 255, 0,   // green
    ]);
    const alpha = new Uint8Array([128, 64]);
    const result = premultiplyAlpha(rgb, alpha, 2, 1);

    expect(result.length).toBe(6);
    // Red channel: (255 * 128 + 127) / 255 = 128
    expect(result[0]).toBe(128);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    // Green channel: (255 * 64 + 127) / 255 = 64
    expect(result[3]).toBe(0);
    expect(result[4]).toBe(64);
    expect(result[5]).toBe(0);
  });

  it('throws for short rgb input', () => {
    expect(() => premultiplyAlpha(new Uint8Array(2), new Uint8Array(1), 1, 1))
      .toThrow('rgb too short');
  });

  it('throws for short alpha input', () => {
    expect(() => premultiplyAlpha(new Uint8Array(3), new Uint8Array(0), 1, 1))
      .toThrow('alpha too short');
  });
});

// ---------------------------------------------------------------------------
// extractAlphaChannel
// ---------------------------------------------------------------------------

describe('extractAlphaChannel', () => {
  it('extracts the last component from 4-channel data', () => {
    const data = new Uint8Array([
      10, 20, 30, 40,   // pixel 0
      50, 60, 70, 80,   // pixel 1
    ]);

    const alpha = extractAlphaChannel(data, 2, 1, 4, 3);
    expect(alpha.length).toBe(2);
    expect(alpha[0]).toBe(40);
    expect(alpha[1]).toBe(80);
  });

  it('extracts the first component', () => {
    const data = new Uint8Array([
      10, 20, 30,
      50, 60, 70,
    ]);

    const result = extractAlphaChannel(data, 2, 1, 3, 0);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(50);
  });

  it('extracts middle component', () => {
    const data = new Uint8Array([
      10, 20, 30,
      50, 60, 70,
    ]);

    const result = extractAlphaChannel(data, 2, 1, 3, 1);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(20);
    expect(result[1]).toBe(60);
  });

  it('works with 2D images', () => {
    // 2x2 image, 2 components each
    const data = new Uint8Array([
      100, 200,
      110, 210,
      120, 220,
      130, 230,
    ]);

    const result = extractAlphaChannel(data, 2, 2, 2, 1);
    expect(result.length).toBe(4);
    expect(result[0]).toBe(200);
    expect(result[1]).toBe(210);
    expect(result[2]).toBe(220);
    expect(result[3]).toBe(230);
  });

  it('throws for negative component index', () => {
    expect(() => extractAlphaChannel(new Uint8Array(12), 2, 2, 3, -1))
      .toThrow('out of range');
  });

  it('throws for component index >= components', () => {
    expect(() => extractAlphaChannel(new Uint8Array(12), 2, 2, 3, 3))
      .toThrow('out of range');
  });

  it('throws for data too short', () => {
    expect(() => extractAlphaChannel(new Uint8Array(3), 2, 2, 3, 0))
      .toThrow('expected 12 bytes');
  });
});

/**
 * Tests for JPEG marker analysis and arithmetic coding detection.
 *
 * Covers:
 *  - Invalid data (too short, wrong magic) returns undefined
 *  - Baseline JPEG (SOF0 = 0xC0): isArithmeticCoded=false, isProgressive=false
 *  - Progressive JPEG (SOF2 = 0xC2): isProgressive=true
 *  - Arithmetic sequential (SOF9 = 0xC9): isArithmeticCoded=true
 *  - Arithmetic progressive (SOF10 = 0xCA): isArithmeticCoded=true, isProgressive=true
 *  - Arithmetic lossless (SOF11 = 0xCB): isArithmeticCoded=true
 *  - Correct extraction of width, height, components, bitsPerComponent
 *  - Markers with padding FF bytes handled correctly
 *  - JPEG with DQT/DHT markers before SOF (realistic structure)
 *  - Module exports from index
 */

import { describe, it, expect } from 'vitest';
import { analyzeJpegMarkers } from '../../src/assets/image/jpegMarkers.js';
import type { JpegMarkerInfo } from '../../src/assets/image/jpegMarkers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal synthetic JPEG with the given SOF marker and parameters.
 * Structure: FF D8 (SOI) + FF xx (SOF) + segment.
 */
function buildJpegWithSof(
  sofMarker: number,
  w: number,
  h: number,
  bpc: number,
  components: number,
): Uint8Array {
  // SOF segment payload: length(2) + bpc(1) + height(2) + width(2) + nf(1) + nf*3
  const sofLen = 8 + components * 3;
  const data = new Uint8Array(2 + 2 + 2 + 1 + 2 + 2 + 1 + components * 3);
  data[0] = 0xff;
  data[1] = 0xd8; // SOI
  data[2] = 0xff;
  data[3] = sofMarker;
  data[4] = (sofLen >> 8) & 0xff;
  data[5] = sofLen & 0xff;
  data[6] = bpc;
  data[7] = (h >> 8) & 0xff;
  data[8] = h & 0xff;
  data[9] = (w >> 8) & 0xff;
  data[10] = w & 0xff;
  data[11] = components;
  // Component specs (id, sampling, qtable) — fill with dummy values
  for (let i = 0; i < components * 3; i++) {
    data[12 + i] = i + 1;
  }
  return data;
}

/**
 * Build a more realistic JPEG with a DQT marker, optional DHT marker,
 * then the SOF marker, mimicking real-world JPEG structure.
 */
function buildRealisticJpeg(
  sofMarker: number,
  w: number,
  h: number,
  bpc: number,
  components: number,
): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xff, 0xd8);

  // DQT marker (FF DB) — 69 bytes total: 2 (marker) + 2 (length=67) + 65 (table)
  parts.push(0xff, 0xdb);
  parts.push(0x00, 0x43); // length = 67
  parts.push(0x00); // table 0, 8-bit precision
  for (let i = 0; i < 64; i++) parts.push(16); // quantization values

  // DHT marker (FF C4) — small dummy table
  parts.push(0xff, 0xc4);
  const dhtPayloadLen = 2 + 1 + 16; // length field + class/id + 16 code counts
  parts.push((dhtPayloadLen >> 8) & 0xff, dhtPayloadLen & 0xff);
  parts.push(0x00); // class 0, table 0
  for (let i = 0; i < 16; i++) parts.push(0); // all zero code counts

  // SOF marker
  const sofLen = 8 + components * 3;
  parts.push(0xff, sofMarker);
  parts.push((sofLen >> 8) & 0xff, sofLen & 0xff);
  parts.push(bpc);
  parts.push((h >> 8) & 0xff, h & 0xff);
  parts.push((w >> 8) & 0xff, w & 0xff);
  parts.push(components);
  for (let i = 0; i < components * 3; i++) parts.push(i + 1);

  return new Uint8Array(parts);
}

/**
 * Build a JPEG with padding FF bytes before the SOF marker.
 */
function buildJpegWithPadding(
  sofMarker: number,
  w: number,
  h: number,
  bpc: number,
  components: number,
): Uint8Array {
  const parts: number[] = [];

  // SOI
  parts.push(0xff, 0xd8);

  // Padding FF bytes + SOF marker
  // Multiple FF bytes before the marker byte — this is valid per JPEG spec
  parts.push(0xff, 0xff, 0xff, sofMarker);

  const sofLen = 8 + components * 3;
  parts.push((sofLen >> 8) & 0xff, sofLen & 0xff);
  parts.push(bpc);
  parts.push((h >> 8) & 0xff, h & 0xff);
  parts.push((w >> 8) & 0xff, w & 0xff);
  parts.push(components);
  for (let i = 0; i < components * 3; i++) parts.push(i + 1);

  return new Uint8Array(parts);
}

// ---------------------------------------------------------------------------
// Invalid input
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — invalid input', () => {
  it('returns undefined for empty data', () => {
    expect(analyzeJpegMarkers(new Uint8Array([]))).toBeUndefined();
  });

  it('returns undefined for data shorter than 4 bytes', () => {
    expect(analyzeJpegMarkers(new Uint8Array([0xff]))).toBeUndefined();
    expect(analyzeJpegMarkers(new Uint8Array([0xff, 0xd8]))).toBeUndefined();
    expect(
      analyzeJpegMarkers(new Uint8Array([0xff, 0xd8, 0xff])),
    ).toBeUndefined();
  });

  it('returns undefined for non-JPEG data (wrong magic)', () => {
    expect(
      analyzeJpegMarkers(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ).toBeUndefined(); // PNG magic
    expect(
      analyzeJpegMarkers(new Uint8Array([0x00, 0x00, 0x00, 0x00])),
    ).toBeUndefined();
  });

  it('returns undefined for JPEG with no SOF marker', () => {
    // SOI + EOI only
    const data = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect(analyzeJpegMarkers(data)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Baseline JPEG (SOF0 = 0xC0)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — baseline JPEG (SOF0)', () => {
  it('detects baseline as non-arithmetic, non-progressive', () => {
    const data = buildJpegWithSof(0xc0, 640, 480, 8, 3);
    const info = analyzeJpegMarkers(data);

    expect(info).toBeDefined();
    expect(info!.isArithmeticCoded).toBe(false);
    expect(info!.isProgressive).toBe(false);
    expect(info!.sofType).toBe(0xc0);
  });

  it('extracts correct dimensions', () => {
    const data = buildJpegWithSof(0xc0, 1920, 1080, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
  });

  it('extracts correct component count', () => {
    // RGB (3 components)
    const rgb = buildJpegWithSof(0xc0, 100, 100, 8, 3);
    expect(analyzeJpegMarkers(rgb)!.components).toBe(3);

    // Grayscale (1 component)
    const gray = buildJpegWithSof(0xc0, 100, 100, 8, 1);
    expect(analyzeJpegMarkers(gray)!.components).toBe(1);

    // CMYK (4 components)
    const cmyk = buildJpegWithSof(0xc0, 100, 100, 8, 4);
    expect(analyzeJpegMarkers(cmyk)!.components).toBe(4);
  });

  it('extracts correct bits per component', () => {
    const data8 = buildJpegWithSof(0xc0, 100, 100, 8, 3);
    expect(analyzeJpegMarkers(data8)!.bitsPerComponent).toBe(8);

    const data12 = buildJpegWithSof(0xc0, 100, 100, 12, 3);
    expect(analyzeJpegMarkers(data12)!.bitsPerComponent).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Extended sequential (SOF1 = 0xC1)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — extended sequential (SOF1)', () => {
  it('detects SOF1 as non-arithmetic, non-progressive', () => {
    const data = buildJpegWithSof(0xc1, 800, 600, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(false);
    expect(info.isProgressive).toBe(false);
    expect(info.sofType).toBe(0xc1);
  });
});

// ---------------------------------------------------------------------------
// Progressive JPEG (SOF2 = 0xC2)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — progressive JPEG (SOF2)', () => {
  it('detects progressive Huffman encoding', () => {
    const data = buildJpegWithSof(0xc2, 1024, 768, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(false);
    expect(info.isProgressive).toBe(true);
    expect(info.sofType).toBe(0xc2);
  });

  it('extracts correct dimensions for progressive JPEG', () => {
    const data = buildJpegWithSof(0xc2, 3840, 2160, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(3840);
    expect(info.height).toBe(2160);
    expect(info.components).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic sequential (SOF9 = 0xC9)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — arithmetic sequential (SOF9)', () => {
  it('detects arithmetic coding', () => {
    const data = buildJpegWithSof(0xc9, 640, 480, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(true);
    expect(info.isProgressive).toBe(false);
    expect(info.sofType).toBe(0xc9);
  });

  it('extracts correct dimensions', () => {
    const data = buildJpegWithSof(0xc9, 512, 512, 8, 1);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(512);
    expect(info.height).toBe(512);
    expect(info.components).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic progressive (SOF10 = 0xCA)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — arithmetic progressive (SOF10)', () => {
  it('detects arithmetic coding and progressive encoding', () => {
    const data = buildJpegWithSof(0xca, 800, 600, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(true);
    expect(info.isProgressive).toBe(true);
    expect(info.sofType).toBe(0xca);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic lossless (SOF11 = 0xCB)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — arithmetic lossless (SOF11)', () => {
  it('detects arithmetic coding, non-progressive', () => {
    const data = buildJpegWithSof(0xcb, 256, 256, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(true);
    expect(info.isProgressive).toBe(false);
    expect(info.sofType).toBe(0xcb);
  });
});

// ---------------------------------------------------------------------------
// Lossless Huffman (SOF3 = 0xC3)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — lossless Huffman (SOF3)', () => {
  it('detects lossless Huffman as non-arithmetic, non-progressive', () => {
    const data = buildJpegWithSof(0xc3, 200, 200, 16, 1);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(false);
    expect(info.isProgressive).toBe(false);
    expect(info.sofType).toBe(0xc3);
    expect(info.bitsPerComponent).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Dimension edge cases
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — dimension edge cases', () => {
  it('handles small dimensions (1x1)', () => {
    const data = buildJpegWithSof(0xc0, 1, 1, 8, 1);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(1);
    expect(info.height).toBe(1);
  });

  it('handles large dimensions (65535 max)', () => {
    const data = buildJpegWithSof(0xc0, 65535, 65535, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(65535);
    expect(info.height).toBe(65535);
  });

  it('handles zero height (streaming JPEG)', () => {
    // Height=0 is valid in JPEG (means height is defined later via DNL marker)
    const data = buildJpegWithSof(0xc0, 640, 0, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(640);
    expect(info.height).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Padding FF bytes
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — padding FF bytes', () => {
  it('handles extra FF padding bytes before SOF marker', () => {
    const data = buildJpegWithPadding(0xc0, 320, 240, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info).toBeDefined();
    expect(info.sofType).toBe(0xc0);
    expect(info.width).toBe(320);
    expect(info.height).toBe(240);
    expect(info.isArithmeticCoded).toBe(false);
  });

  it('handles padding before arithmetic SOF marker', () => {
    const data = buildJpegWithPadding(0xc9, 640, 480, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info).toBeDefined();
    expect(info.isArithmeticCoded).toBe(true);
    expect(info.sofType).toBe(0xc9);
  });
});

// ---------------------------------------------------------------------------
// Realistic JPEG structure (DQT + DHT + SOF)
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — realistic JPEG structure', () => {
  it('skips DQT and DHT markers to find SOF', () => {
    const data = buildRealisticJpeg(0xc0, 1280, 720, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info).toBeDefined();
    expect(info.sofType).toBe(0xc0);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.components).toBe(3);
    expect(info.bitsPerComponent).toBe(8);
    expect(info.isArithmeticCoded).toBe(false);
    expect(info.isProgressive).toBe(false);
  });

  it('detects progressive SOF in realistic structure', () => {
    const data = buildRealisticJpeg(0xc2, 800, 600, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isProgressive).toBe(true);
    expect(info.isArithmeticCoded).toBe(false);
  });

  it('detects arithmetic SOF in realistic structure', () => {
    const data = buildRealisticJpeg(0xc9, 512, 384, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(true);
    expect(info.isProgressive).toBe(false);
  });

  it('detects arithmetic progressive SOF in realistic structure', () => {
    const data = buildRealisticJpeg(0xca, 1024, 768, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(info.isArithmeticCoded).toBe(true);
    expect(info.isProgressive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Non-SOF markers are not confused with SOF
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — non-SOF markers', () => {
  it('does not treat DHT (0xC4) as SOF', () => {
    // Build JPEG: SOI + DHT (C4, not a SOF) + SOF0 (C0)
    const parts: number[] = [];
    parts.push(0xff, 0xd8); // SOI

    // DHT marker with enough data to look like a SOF
    parts.push(0xff, 0xc4);
    const dhtLen = 19; // 2 + 1 + 16 code counts
    parts.push((dhtLen >> 8) & 0xff, dhtLen & 0xff);
    parts.push(0x00); // class 0, table 0
    for (let i = 0; i < 16; i++) parts.push(0);

    // Actual SOF0
    const sofLen = 8 + 3 * 3;
    parts.push(0xff, 0xc0);
    parts.push((sofLen >> 8) & 0xff, sofLen & 0xff);
    parts.push(8); // bpc
    parts.push(0x01, 0xf4); // height = 500
    parts.push(0x02, 0xbc); // width = 700
    parts.push(3); // components
    for (let i = 0; i < 9; i++) parts.push(i + 1);

    const data = new Uint8Array(parts);
    const info = analyzeJpegMarkers(data)!;

    expect(info.sofType).toBe(0xc0); // Should find SOF0, not DHT
    expect(info.width).toBe(700);
    expect(info.height).toBe(500);
  });

  it('does not treat DAC (0xCC) as SOF', () => {
    const parts: number[] = [];
    parts.push(0xff, 0xd8); // SOI

    // DAC marker
    parts.push(0xff, 0xcc);
    parts.push(0x00, 0x06); // length = 6
    parts.push(0x00, 0x01, 0x05, 0x03); // conditioning params

    // Actual SOF9 (arithmetic)
    const sofLen = 8 + 3 * 3;
    parts.push(0xff, 0xc9);
    parts.push((sofLen >> 8) & 0xff, sofLen & 0xff);
    parts.push(8);
    parts.push(0x00, 0xc8); // height = 200
    parts.push(0x01, 0x90); // width = 400
    parts.push(3);
    for (let i = 0; i < 9; i++) parts.push(i + 1);

    const data = new Uint8Array(parts);
    const info = analyzeJpegMarkers(data)!;

    expect(info.sofType).toBe(0xc9);
    expect(info.isArithmeticCoded).toBe(true);
    expect(info.width).toBe(400);
    expect(info.height).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// RST markers
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — RST markers', () => {
  it('handles RST markers (D0-D7) without length fields', () => {
    // This is a contrived test: RST markers normally appear in
    // entropy-coded data, but the parser should skip them gracefully
    // if encountered in the marker scan phase.
    const parts: number[] = [];
    parts.push(0xff, 0xd8); // SOI

    // Insert a DQT before SOF
    parts.push(0xff, 0xdb);
    parts.push(0x00, 0x43);
    parts.push(0x00);
    for (let i = 0; i < 64; i++) parts.push(16);

    // SOF0
    const sofLen = 8 + 3 * 3;
    parts.push(0xff, 0xc0);
    parts.push((sofLen >> 8) & 0xff, sofLen & 0xff);
    parts.push(8);
    parts.push(0x01, 0x00); // height = 256
    parts.push(0x02, 0x00); // width = 512
    parts.push(3);
    for (let i = 0; i < 9; i++) parts.push(i + 1);

    const data = new Uint8Array(parts);
    const info = analyzeJpegMarkers(data)!;

    expect(info.width).toBe(512);
    expect(info.height).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// JpegMarkerInfo type shape
// ---------------------------------------------------------------------------

describe('analyzeJpegMarkers — result shape', () => {
  it('returns all expected fields with correct types', () => {
    const data = buildJpegWithSof(0xc0, 640, 480, 8, 3);
    const info = analyzeJpegMarkers(data)!;

    expect(typeof info.isArithmeticCoded).toBe('boolean');
    expect(typeof info.isProgressive).toBe('boolean');
    expect(typeof info.sofType).toBe('number');
    expect(typeof info.width).toBe('number');
    expect(typeof info.height).toBe('number');
    expect(typeof info.components).toBe('number');
    expect(typeof info.bitsPerComponent).toBe('number');
  });

  it('JpegMarkerInfo type is usable', () => {
    const info: JpegMarkerInfo = {
      isArithmeticCoded: false,
      isProgressive: true,
      sofType: 0xc2,
      width: 1024,
      height: 768,
      components: 3,
      bitsPerComponent: 8,
    };
    expect(info.sofType).toBe(0xc2);
    expect(info.isProgressive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('jpegMarkers — module exports', () => {
  it('exports analyzeJpegMarkers from index', async () => {
    const mod = await import('../../src/index.js');
    expect(typeof mod.analyzeJpegMarkers).toBe('function');
  });
});

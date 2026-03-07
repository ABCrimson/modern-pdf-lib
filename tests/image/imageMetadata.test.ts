/**
 * Tests for JPEG EXIF metadata extraction and re-injection.
 *
 * Covers:
 *  - Extract from empty/invalid JPEG returns default metadata
 *  - Extract JFIF DPI (72, 96, 300)
 *  - Extract EXIF orientation (1, 6, 8)
 *  - Extract EXIF DPI
 *  - Extract EXIF copyright
 *  - Inject markers into stripped JPEG preserves metadata
 *  - Round-trip: extract -> inject -> extract produces same values
 *  - APP2 (ICC) markers are NOT collected (excluded)
 */

import { describe, it, expect } from 'vitest';
import {
  extractJpegMetadata,
  injectJpegMetadata,
} from '../../src/assets/image/imageMetadata.js';
import type { JpegMetadata } from '../../src/assets/image/imageMetadata.js';

// ---------------------------------------------------------------------------
// Helpers — synthetic JPEG segment builders
// ---------------------------------------------------------------------------

/**
 * Build a JFIF APP0 marker segment with the given DPI.
 *
 * Full segment: FF E0 + length(2) + "JFIF\0" + version(2) + units(1) + Xdpi(2) + Ydpi(2) + thumb(2)
 */
function buildJfifSegment(dpiX: number, dpiY: number, units: number = 1): Uint8Array {
  const identifier = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF\0"
  const version = [0x01, 0x01]; // v1.1
  const xDpi = [(dpiX >> 8) & 0xff, dpiX & 0xff];
  const yDpi = [(dpiY >> 8) & 0xff, dpiY & 0xff];
  const thumbnail = [0x00, 0x00]; // no thumbnail

  const data = [...identifier, ...version, units, ...xDpi, ...yDpi, ...thumbnail];
  const length = data.length + 2; // +2 for the length field itself

  return new Uint8Array([
    0xff,
    0xe0, // APP0 marker
    (length >> 8) & 0xff,
    length & 0xff,
    ...data,
  ]);
}

/**
 * Build a minimal EXIF APP1 marker segment with the given tags.
 *
 * Uses big-endian (Motorola) byte order for simplicity.
 */
function buildExifSegment(opts: {
  orientation?: number;
  dpiX?: number;
  dpiY?: number;
  copyright?: string;
  littleEndian?: boolean;
}): Uint8Array {
  const le = opts.littleEndian ?? false;

  // Count how many IFD entries we need
  const tags: Array<{
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
    isOffset: boolean;
  }> = [];

  // Offset for values that don't fit in 4 bytes
  // IFD starts at TIFF offset 8 (after TIFF header)
  // IFD: 2 bytes (entry count) + entries * 12 + 4 bytes (next IFD offset)
  let entryCount = 0;

  if (opts.orientation !== undefined) entryCount++;
  if (opts.dpiX !== undefined) entryCount++;
  if (opts.dpiY !== undefined) entryCount++;
  if (opts.copyright !== undefined) entryCount++;

  const ifdStart = 8; // TIFF header is 8 bytes
  const ifdHeaderSize = 2 + entryCount * 12 + 4; // count + entries + next IFD ptr
  let dataOffset = ifdStart + ifdHeaderSize;

  // Build tags
  if (opts.orientation !== undefined) {
    // SHORT type, fits in 4 bytes inline
    const val = new Uint8Array(4);
    const v = new DataView(val.buffer);
    v.setUint16(0, opts.orientation, le);
    tags.push({ tag: 0x0112, type: 3, count: 1, value: val, isOffset: false });
  }

  if (opts.dpiX !== undefined) {
    // RATIONAL type (8 bytes) — needs offset
    const val = new Uint8Array(8);
    const v = new DataView(val.buffer);
    v.setUint32(0, opts.dpiX, le);
    v.setUint32(4, 1, le); // denominator = 1
    tags.push({ tag: 0x011a, type: 5, count: 1, value: val, isOffset: true });
  }

  if (opts.dpiY !== undefined) {
    const val = new Uint8Array(8);
    const v = new DataView(val.buffer);
    v.setUint32(0, opts.dpiY, le);
    v.setUint32(4, 1, le);
    tags.push({ tag: 0x011b, type: 5, count: 1, value: val, isOffset: true });
  }

  if (opts.copyright !== undefined) {
    // ASCII type — may need offset if > 4 bytes
    const str = opts.copyright + '\0';
    const val = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      val[i] = str.charCodeAt(i);
    }
    tags.push({
      tag: 0x8298,
      type: 2,
      count: str.length,
      value: val,
      isOffset: str.length > 4,
    });
  }

  // Calculate total TIFF data size
  let totalExtraData = 0;
  for (const t of tags) {
    if (t.isOffset) totalExtraData += t.value.length;
  }

  // TIFF data: header (8) + IFD header (2) + entries (n*12) + next IFD (4) + extra data
  const tiffSize = ifdStart + ifdHeaderSize + totalExtraData;

  // EXIF segment data: "Exif\0\0" (6) + TIFF data
  const exifData = new Uint8Array(6 + tiffSize);

  // "Exif\0\0"
  exifData[0] = 0x45; // E
  exifData[1] = 0x78; // x
  exifData[2] = 0x69; // i
  exifData[3] = 0x66; // f
  exifData[4] = 0x00;
  exifData[5] = 0x00;

  // TIFF header at offset 6
  const tiffBase = 6;
  const tiffView = new DataView(
    exifData.buffer,
    exifData.byteOffset + tiffBase,
    tiffSize,
  );

  // Byte order
  if (le) {
    exifData[tiffBase] = 0x49; // I
    exifData[tiffBase + 1] = 0x49; // I
  } else {
    exifData[tiffBase] = 0x4d; // M
    exifData[tiffBase + 1] = 0x4d; // M
  }

  // Magic number 42
  tiffView.setUint16(2, 42, le);

  // Offset to first IFD (from TIFF start)
  tiffView.setUint32(4, ifdStart, le);

  // IFD entry count
  tiffView.setUint16(ifdStart, tags.length, le);

  // Write IFD entries
  let currentDataOffset = dataOffset;
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]!;
    const entryOff = ifdStart + 2 + i * 12;

    tiffView.setUint16(entryOff, t.tag, le);
    tiffView.setUint16(entryOff + 2, t.type, le);
    tiffView.setUint32(entryOff + 4, t.count, le);

    if (t.isOffset) {
      // Write offset to external data
      tiffView.setUint32(entryOff + 8, currentDataOffset, le);
      // Write the actual data at the offset
      exifData.set(t.value, tiffBase + currentDataOffset);
      currentDataOffset += t.value.length;
    } else {
      // Write value inline (up to 4 bytes)
      for (let j = 0; j < Math.min(t.value.length, 4); j++) {
        exifData[tiffBase + entryOff + 8 + j] = t.value[j]!;
      }
    }
  }

  // Next IFD offset = 0 (no more IFDs)
  tiffView.setUint32(ifdStart + 2 + tags.length * 12, 0, le);

  // Build the full APP1 segment: FF E1 + length + data
  const segLength = exifData.length + 2; // +2 for length field
  const segment = new Uint8Array(2 + 2 + exifData.length);
  segment[0] = 0xff;
  segment[1] = 0xe1; // APP1
  segment[2] = (segLength >> 8) & 0xff;
  segment[3] = segLength & 0xff;
  segment.set(exifData, 4);

  return segment;
}

/**
 * Build an APP2 (ICC profile) marker segment (dummy).
 */
function buildIccSegment(): Uint8Array {
  const data = new Uint8Array([
    0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46,
    0x49, 0x4c, 0x45, 0x00, // "ICC_PROFILE\0"
    0x01, 0x01, // chunk number, total chunks
    0x00, 0x00, 0x00, 0x00, // dummy profile data
  ]);
  const length = data.length + 2;
  return new Uint8Array([
    0xff, 0xe2, // APP2
    (length >> 8) & 0xff, length & 0xff,
    ...data,
  ]);
}

/**
 * Build a minimal JPEG file from segments.
 * SOI + segments + DQT stub + SOF stub + SOS stub + EOI
 */
function buildJpeg(...segments: Uint8Array[]): Uint8Array {
  // Minimal DQT marker (needed for valid JPEG structure)
  const dqt = new Uint8Array([
    0xff, 0xdb, // DQT marker
    0x00, 0x43, // length = 67
    0x00, // 8-bit precision, table 0
    // 64 quantization values (all 1s for testing)
    ...new Array(64).fill(1),
  ]);

  // Minimal SOF0 marker
  const sof = new Uint8Array([
    0xff, 0xc0, // SOF0
    0x00, 0x0b, // length = 11
    0x08, // 8-bit precision
    0x00, 0x01, // height = 1
    0x00, 0x01, // width = 1
    0x01, // 1 component
    0x01, 0x11, 0x00, // component 1: ID=1, sampling=1x1, quant table 0
  ]);

  // Minimal SOS + data + EOI
  const sos = new Uint8Array([
    0xff, 0xda, // SOS
    0x00, 0x08, // length = 8
    0x01, // 1 component
    0x01, 0x00, // component 1, DC/AC tables 0/0
    0x00, 0x3f, 0x00, // spectral selection
    0x00, // dummy scan data
    0xff, 0xd9, // EOI
  ]);

  // Calculate total size
  let totalSize = 2; // SOI
  for (const seg of segments) totalSize += seg.length;
  totalSize += dqt.length + sof.length + sos.length;

  const result = new Uint8Array(totalSize);
  let pos = 0;

  // SOI
  result[0] = 0xff;
  result[1] = 0xd8;
  pos = 2;

  // APP segments
  for (const seg of segments) {
    result.set(seg, pos);
    pos += seg.length;
  }

  // DQT + SOF + SOS
  result.set(dqt, pos);
  pos += dqt.length;
  result.set(sof, pos);
  pos += sof.length;
  result.set(sos, pos);

  return result;
}

/**
 * Build a "stripped" JPEG (no APP markers) — simulates encoder output.
 */
function buildStrippedJpeg(): Uint8Array {
  return buildJpeg();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractJpegMetadata', () => {
  describe('edge cases', () => {
    it('should return default metadata for empty input', () => {
      const result = extractJpegMetadata(new Uint8Array(0));
      expect(result.orientation).toBeUndefined();
      expect(result.dpiX).toBeUndefined();
      expect(result.dpiY).toBeUndefined();
      expect(result.copyright).toBeUndefined();
      expect(result.appMarkers).toHaveLength(0);
    });

    it('should return default metadata for non-JPEG input', () => {
      const result = extractJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      expect(result.orientation).toBeUndefined();
      expect(result.appMarkers).toHaveLength(0);
    });

    it('should return default metadata for too-short JPEG', () => {
      const result = extractJpegMetadata(new Uint8Array([0xff, 0xd8]));
      expect(result.appMarkers).toHaveLength(0);
    });

    it('should return default metadata for JPEG with only DQT (no APP markers)', () => {
      const jpeg = buildStrippedJpeg();
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBeUndefined();
      expect(result.dpiX).toBeUndefined();
      expect(result.dpiY).toBeUndefined();
      expect(result.copyright).toBeUndefined();
      expect(result.appMarkers).toHaveLength(0);
    });
  });

  describe('JFIF DPI extraction', () => {
    it('should extract 72 DPI from JFIF', () => {
      const jfif = buildJfifSegment(72, 72);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(72);
      expect(result.dpiY).toBe(72);
    });

    it('should extract 96 DPI from JFIF', () => {
      const jfif = buildJfifSegment(96, 96);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(96);
      expect(result.dpiY).toBe(96);
    });

    it('should extract 300 DPI from JFIF', () => {
      const jfif = buildJfifSegment(300, 300);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(300);
    });

    it('should handle asymmetric DPI from JFIF', () => {
      const jfif = buildJfifSegment(300, 600);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(600);
    });

    it('should convert dots per centimeter to DPI', () => {
      // 118 dpcm ~ 300 dpi (118 * 2.54 = 299.72 ~ 300)
      const jfif = buildJfifSegment(118, 118, 2);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(300);
    });

    it('should not extract DPI when JFIF units is 0 (aspect ratio)', () => {
      const jfif = buildJfifSegment(1, 1, 0);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBeUndefined();
      expect(result.dpiY).toBeUndefined();
    });
  });

  describe('EXIF orientation extraction', () => {
    it('should extract orientation 1 (normal)', () => {
      const exif = buildExifSegment({ orientation: 1 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(1);
    });

    it('should extract orientation 6 (rotated 90 CW)', () => {
      const exif = buildExifSegment({ orientation: 6 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(6);
    });

    it('should extract orientation 8 (rotated 90 CCW)', () => {
      const exif = buildExifSegment({ orientation: 8 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(8);
    });

    it('should extract orientation 3 (rotated 180)', () => {
      const exif = buildExifSegment({ orientation: 3 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(3);
    });

    it('should extract orientation with little-endian byte order', () => {
      const exif = buildExifSegment({ orientation: 6, littleEndian: true });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(6);
    });
  });

  describe('EXIF DPI extraction', () => {
    it('should extract 72 DPI from EXIF', () => {
      const exif = buildExifSegment({ dpiX: 72, dpiY: 72 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(72);
      expect(result.dpiY).toBe(72);
    });

    it('should extract 300 DPI from EXIF', () => {
      const exif = buildExifSegment({ dpiX: 300, dpiY: 300 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(300);
    });

    it('should extract DPI with little-endian byte order', () => {
      const exif = buildExifSegment({ dpiX: 150, dpiY: 150, littleEndian: true });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.dpiX).toBe(150);
      expect(result.dpiY).toBe(150);
    });

    it('should prefer EXIF DPI over JFIF DPI', () => {
      const jfif = buildJfifSegment(72, 72);
      const exif = buildExifSegment({ dpiX: 300, dpiY: 300 });
      const jpeg = buildJpeg(jfif, exif);
      const result = extractJpegMetadata(jpeg);
      // EXIF overrides JFIF
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(300);
    });
  });

  describe('EXIF copyright extraction', () => {
    it('should extract a simple copyright string', () => {
      const exif = buildExifSegment({ copyright: 'John Doe 2024' });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.copyright).toBe('John Doe 2024');
    });

    it('should extract a copyright with special characters', () => {
      const exif = buildExifSegment({ copyright: '(c) Acme Corp.' });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.copyright).toBe('(c) Acme Corp.');
    });

    it('should extract copyright with little-endian byte order', () => {
      const exif = buildExifSegment({ copyright: 'Test', littleEndian: true });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.copyright).toBe('Test');
    });
  });

  describe('combined EXIF fields', () => {
    it('should extract all fields from a single EXIF segment', () => {
      const exif = buildExifSegment({
        orientation: 6,
        dpiX: 300,
        dpiY: 300,
        copyright: 'Test Author',
      });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(6);
      expect(result.dpiX).toBe(300);
      expect(result.dpiY).toBe(300);
      expect(result.copyright).toBe('Test Author');
    });

    it('should extract from JFIF + EXIF combined', () => {
      const jfif = buildJfifSegment(72, 72);
      const exif = buildExifSegment({ orientation: 3, copyright: 'Combined' });
      const jpeg = buildJpeg(jfif, exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.orientation).toBe(3);
      expect(result.dpiX).toBe(72); // From JFIF (EXIF has no DPI in this case)
      expect(result.dpiY).toBe(72);
      expect(result.copyright).toBe('Combined');
    });
  });

  describe('APP marker collection', () => {
    it('should collect APP0 (JFIF) marker', () => {
      const jfif = buildJfifSegment(72, 72);
      const jpeg = buildJpeg(jfif);
      const result = extractJpegMetadata(jpeg);
      expect(result.appMarkers).toHaveLength(1);
      expect(result.appMarkers[0]![0]).toBe(0xff);
      expect(result.appMarkers[0]![1]).toBe(0xe0);
    });

    it('should collect APP1 (EXIF) marker', () => {
      const exif = buildExifSegment({ orientation: 1 });
      const jpeg = buildJpeg(exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.appMarkers).toHaveLength(1);
      expect(result.appMarkers[0]![0]).toBe(0xff);
      expect(result.appMarkers[0]![1]).toBe(0xe1);
    });

    it('should collect both APP0 and APP1', () => {
      const jfif = buildJfifSegment(96, 96);
      const exif = buildExifSegment({ orientation: 1 });
      const jpeg = buildJpeg(jfif, exif);
      const result = extractJpegMetadata(jpeg);
      expect(result.appMarkers).toHaveLength(2);
      expect(result.appMarkers[0]![1]).toBe(0xe0); // APP0
      expect(result.appMarkers[1]![1]).toBe(0xe1); // APP1
    });

    it('should NOT collect APP2 (ICC) markers', () => {
      const jfif = buildJfifSegment(72, 72);
      const icc = buildIccSegment();
      const jpeg = buildJpeg(jfif, icc);
      const result = extractJpegMetadata(jpeg);

      // Should only have APP0 (JFIF), not APP2 (ICC)
      expect(result.appMarkers).toHaveLength(1);
      expect(result.appMarkers[0]![1]).toBe(0xe0);
    });

    it('should NOT collect APP2 even when between APP0 and APP1', () => {
      const jfif = buildJfifSegment(72, 72);
      const icc = buildIccSegment();
      const exif = buildExifSegment({ orientation: 6 });
      const jpeg = buildJpeg(jfif, icc, exif);
      const result = extractJpegMetadata(jpeg);

      // Should have APP0 and APP1, but NOT APP2
      expect(result.appMarkers).toHaveLength(2);
      expect(result.appMarkers[0]![1]).toBe(0xe0); // APP0
      expect(result.appMarkers[1]![1]).toBe(0xe1); // APP1
      expect(result.orientation).toBe(6);
    });
  });
});

describe('injectJpegMetadata', () => {
  it('should return original bytes when no markers to inject', () => {
    const jpeg = buildStrippedJpeg();
    const metadata: JpegMetadata = { appMarkers: [] };
    const result = injectJpegMetadata(jpeg, metadata);
    expect(result).toBe(jpeg); // Same reference
  });

  it('should return original bytes for invalid input', () => {
    const notJpeg = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const metadata: JpegMetadata = {
      appMarkers: [new Uint8Array([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00])],
    };
    const result = injectJpegMetadata(notJpeg, metadata);
    expect(result).toBe(notJpeg);
  });

  it('should inject JFIF marker after SOI', () => {
    const stripped = buildStrippedJpeg();
    const jfifSeg = buildJfifSegment(300, 300);
    const metadata: JpegMetadata = {
      dpiX: 300,
      dpiY: 300,
      appMarkers: [jfifSeg],
    };

    const result = injectJpegMetadata(stripped, metadata);

    // Result should be larger
    expect(result.length).toBe(stripped.length + jfifSeg.length);

    // SOI should still be at the beginning
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);

    // JFIF marker should follow SOI
    expect(result[2]).toBe(0xff);
    expect(result[3]).toBe(0xe0);
  });

  it('should inject multiple APP markers', () => {
    const stripped = buildStrippedJpeg();
    const jfifSeg = buildJfifSegment(300, 300);
    const exifSeg = buildExifSegment({ orientation: 6 });

    const metadata: JpegMetadata = {
      dpiX: 300,
      dpiY: 300,
      orientation: 6,
      appMarkers: [jfifSeg, exifSeg],
    };

    const result = injectJpegMetadata(stripped, metadata);

    // Size should include both markers
    expect(result.length).toBe(stripped.length + jfifSeg.length + exifSeg.length);

    // SOI
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);

    // APP0 after SOI
    expect(result[2]).toBe(0xff);
    expect(result[3]).toBe(0xe0);

    // APP1 after APP0
    const app1Offset = 2 + jfifSeg.length;
    expect(result[app1Offset]).toBe(0xff);
    expect(result[app1Offset + 1]).toBe(0xe1);
  });

  it('should preserve the original JPEG data after injected markers', () => {
    const stripped = buildStrippedJpeg();
    const jfifSeg = buildJfifSegment(72, 72);

    const metadata: JpegMetadata = {
      dpiX: 72,
      dpiY: 72,
      appMarkers: [jfifSeg],
    };

    const result = injectJpegMetadata(stripped, metadata);

    // Original data (after SOI) should appear after injected markers
    const originalAfterSoi = stripped.subarray(2);
    const resultAfterMarkers = result.subarray(2 + jfifSeg.length);

    expect(resultAfterMarkers.length).toBe(originalAfterSoi.length);
    for (let i = 0; i < originalAfterSoi.length; i++) {
      expect(resultAfterMarkers[i]).toBe(originalAfterSoi[i]);
    }
  });
});

describe('round-trip: extract -> inject -> extract', () => {
  it('should preserve JFIF DPI through round-trip', () => {
    // Create original JPEG with JFIF DPI
    const jfif = buildJfifSegment(300, 300);
    const original = buildJpeg(jfif);

    // Step 1: Extract metadata
    const metadata = extractJpegMetadata(original);
    expect(metadata.dpiX).toBe(300);
    expect(metadata.dpiY).toBe(300);

    // Step 2: Simulate recompression (stripped JPEG)
    const stripped = buildStrippedJpeg();

    // Step 3: Inject metadata
    const restored = injectJpegMetadata(stripped, metadata);

    // Step 4: Extract again
    const reExtracted = extractJpegMetadata(restored);
    expect(reExtracted.dpiX).toBe(300);
    expect(reExtracted.dpiY).toBe(300);
  });

  it('should preserve EXIF orientation through round-trip', () => {
    const exif = buildExifSegment({ orientation: 6 });
    const original = buildJpeg(exif);

    const metadata = extractJpegMetadata(original);
    expect(metadata.orientation).toBe(6);

    const stripped = buildStrippedJpeg();
    const restored = injectJpegMetadata(stripped, metadata);

    const reExtracted = extractJpegMetadata(restored);
    expect(reExtracted.orientation).toBe(6);
  });

  it('should preserve EXIF copyright through round-trip', () => {
    const exif = buildExifSegment({ copyright: 'Test Author 2024' });
    const original = buildJpeg(exif);

    const metadata = extractJpegMetadata(original);
    expect(metadata.copyright).toBe('Test Author 2024');

    const stripped = buildStrippedJpeg();
    const restored = injectJpegMetadata(stripped, metadata);

    const reExtracted = extractJpegMetadata(restored);
    expect(reExtracted.copyright).toBe('Test Author 2024');
  });

  it('should preserve all fields through round-trip', () => {
    const jfif = buildJfifSegment(96, 96);
    const exif = buildExifSegment({
      orientation: 8,
      dpiX: 300,
      dpiY: 300,
      copyright: 'Full Round Trip',
    });
    const original = buildJpeg(jfif, exif);

    const metadata = extractJpegMetadata(original);
    expect(metadata.orientation).toBe(8);
    expect(metadata.dpiX).toBe(300); // EXIF overrides JFIF
    expect(metadata.dpiY).toBe(300);
    expect(metadata.copyright).toBe('Full Round Trip');
    expect(metadata.appMarkers).toHaveLength(2);

    const stripped = buildStrippedJpeg();
    const restored = injectJpegMetadata(stripped, metadata);

    const reExtracted = extractJpegMetadata(restored);
    expect(reExtracted.orientation).toBe(8);
    expect(reExtracted.dpiX).toBe(300);
    expect(reExtracted.dpiY).toBe(300);
    expect(reExtracted.copyright).toBe('Full Round Trip');
    expect(reExtracted.appMarkers).toHaveLength(2);
  });

  it('should not include APP2 markers in round-trip', () => {
    const jfif = buildJfifSegment(72, 72);
    const icc = buildIccSegment();
    const exif = buildExifSegment({ orientation: 1 });
    const original = buildJpeg(jfif, icc, exif);

    const metadata = extractJpegMetadata(original);
    // APP2 should be excluded
    expect(metadata.appMarkers).toHaveLength(2); // APP0 + APP1 only

    const stripped = buildStrippedJpeg();
    const restored = injectJpegMetadata(stripped, metadata);

    // Verify no APP2 in restored
    const reExtracted = extractJpegMetadata(restored);
    expect(reExtracted.appMarkers).toHaveLength(2);
    for (const marker of reExtracted.appMarkers) {
      expect(marker[1]).not.toBe(0xe2); // No APP2
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildToUnicodeCmap,
  validatePngSignature,
  parsePngDimensions,
  extractPngChunks,
  validateJpegSignature,
  parseJpegDimensions,
} from '../../../src/core/pdfDocumentEmbed.js';

describe('pdfDocumentEmbed', () => {
  // -----------------------------------------------------------------------
  // buildToUnicodeCmap
  // -----------------------------------------------------------------------

  describe('buildToUnicodeCmap', () => {
    it('produces a valid CMap for a small mapping', () => {
      const cmap = new Map<number, number>();
      // Unicode codepoint -> glyph ID
      cmap.set(0x0041, 1);  // 'A' -> GID 1
      cmap.set(0x0042, 2);  // 'B' -> GID 2
      cmap.set(0x0043, 3);  // 'C' -> GID 3

      const result = buildToUnicodeCmap(cmap);

      // Should contain standard CMap boilerplate
      expect(result).toContain('/CIDInit /ProcSet findresource begin');
      expect(result).toContain('begincmap');
      expect(result).toContain('endcmap');
      expect(result).toContain('<0000> <FFFF>');

      // Should contain beginbfchar / endbfchar section
      expect(result).toContain('beginbfchar');
      expect(result).toContain('endbfchar');

      // Should contain mappings: GID -> Unicode
      expect(result).toContain('<0001> <0041>');  // GID 1 -> U+0041
      expect(result).toContain('<0002> <0042>');  // GID 2 -> U+0042
      expect(result).toContain('<0003> <0043>');  // GID 3 -> U+0043
    });

    it('handles an empty mapping', () => {
      const cmap = new Map<number, number>();
      const result = buildToUnicodeCmap(cmap);

      // Should still produce valid CMap structure
      expect(result).toContain('begincmap');
      expect(result).toContain('endcmap');

      // Should NOT have any beginbfchar blocks
      expect(result).not.toContain('beginbfchar');
    });

    it('prefers lower codepoints for duplicate glyph IDs', () => {
      const cmap = new Map<number, number>();
      // Two codepoints map to the same GID
      cmap.set(0x0041, 5);  // 'A' -> GID 5  (first)
      cmap.set(0x0061, 5);  // 'a' -> GID 5  (second, should be ignored)

      const result = buildToUnicodeCmap(cmap);

      // Should have GID 5 mapped to 0041 (the first one found)
      expect(result).toContain('<0005> <0041>');
    });
  });

  // -----------------------------------------------------------------------
  // PNG validation
  // -----------------------------------------------------------------------

  describe('validatePngSignature', () => {
    it('does not throw for a valid PNG signature', () => {
      // Minimal PNG: signature + IHDR chunk (13 bytes data) + CRC
      const sig = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length = 13
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x00, 0x01, // width = 1
        0x00, 0x00, 0x00, 0x01, // height = 1
        0x08, 0x02, 0x00, 0x00, 0x00, // bitdepth=8, colortype=2, etc.
      ]);
      expect(() => validatePngSignature(sig)).not.toThrow();
    });

    it('throws for data that is too short', () => {
      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(() => validatePngSignature(data)).toThrow('Invalid PNG: file too short');
    });

    it('throws for invalid signature bytes', () => {
      const data = new Uint8Array(24).fill(0);
      expect(() => validatePngSignature(data)).toThrow('Invalid PNG: bad signature');
    });
  });

  describe('parsePngDimensions', () => {
    it('parses width and height from IHDR', () => {
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length = 13
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x01, 0x00, // width = 256
        0x00, 0x00, 0x00, 0x80, // height = 128
        0x08, 0x02, 0x00, 0x00, 0x00, // bitdepth=8, colortype=2
      ]);
      const { width, height } = parsePngDimensions(png);
      expect(width).toBe(256);
      expect(height).toBe(128);
    });
  });

  describe('extractPngChunks', () => {
    it('extracts chunks from a minimal PNG', () => {
      // Build a minimal PNG with IHDR + IEND
      const png = new Uint8Array([
        // Signature
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        // IHDR chunk: length=13, type="IHDR", data=13 bytes, CRC=4 bytes
        0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, // width
        0x00, 0x00, 0x00, 0x01, // height
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, // CRC (dummy)
        // IEND chunk: length=0, type="IEND", CRC=4 bytes
        0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44,
        0x00, 0x00, 0x00, 0x00, // CRC (dummy)
      ]);

      const chunks = extractPngChunks(png);
      expect(chunks.length).toBe(2);
      expect(chunks[0]!.type).toBe('IHDR');
      expect(chunks[0]!.data.length).toBe(13);
      expect(chunks[1]!.type).toBe('IEND');
      expect(chunks[1]!.data.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // JPEG validation
  // -----------------------------------------------------------------------

  describe('validateJpegSignature', () => {
    it('does not throw for a valid JPEG SOI marker', () => {
      const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(() => validateJpegSignature(data)).not.toThrow();
    });

    it('throws for data that is too short', () => {
      const data = new Uint8Array([0xff]);
      expect(() => validateJpegSignature(data)).toThrow('Invalid JPEG: bad SOI marker');
    });

    it('throws for invalid SOI marker', () => {
      const data = new Uint8Array([0x00, 0x00]);
      expect(() => validateJpegSignature(data)).toThrow('Invalid JPEG: bad SOI marker');
    });
  });

  describe('parseJpegDimensions', () => {
    it('parses width, height, and components from SOF0', () => {
      // Minimal JPEG: SOI + APP0 (JFIF) + SOF0
      const jpeg = new Uint8Array([
        // SOI
        0xff, 0xd8,
        // SOF0 marker (0xFFC0)
        0xff, 0xc0,
        // Length of SOF0 segment (11 bytes: 2 length + 1 precision + 2 height + 2 width + 1 components + 3 component data)
        0x00, 0x0b,
        // Precision: 8 bits
        0x08,
        // Height: 480
        0x01, 0xe0,
        // Width: 640
        0x02, 0x80,
        // Number of components: 3 (RGB)
        0x03,
        // Component data (3 bytes per component, 3 components = 9 bytes, but we only need to read up to components)
      ]);

      const result = parseJpegDimensions(jpeg);
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
      expect(result.components).toBe(3);
    });

    it('throws for invalid JPEG data', () => {
      const data = new Uint8Array([0x00, 0x00]);
      expect(() => parseJpegDimensions(data)).toThrow('Invalid JPEG');
    });
  });
});

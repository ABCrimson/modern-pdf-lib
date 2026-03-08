/**
 * Tests for image format detection from magic bytes.
 *
 * Covers detectImageFormat(), getImageFormatName(), and getSupportedFormats()
 * from the formatDetect module.
 */

import { describe, it, expect } from 'vitest';
import {
  detectImageFormat,
  getImageFormatName,
  getSupportedFormats,
} from '../../../../src/assets/image/formatDetect.js';

// ---------------------------------------------------------------------------
// detectImageFormat
// ---------------------------------------------------------------------------

describe('detectImageFormat', () => {
  it('detects PNG format', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(detectImageFormat(png)).toBe('png');
  });

  it('detects PNG from minimal 4-byte header', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    expect(detectImageFormat(png)).toBe('png');
  });

  it('detects JPEG format', () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    expect(detectImageFormat(jpeg)).toBe('jpeg');
  });

  it('detects JPEG with EXIF marker', () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1]);
    expect(detectImageFormat(jpeg)).toBe('jpeg');
  });

  it('detects WebP format', () => {
    // RIFF....WEBP
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (placeholder)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectImageFormat(webp)).toBe('webp');
  });

  it('detects TIFF little-endian', () => {
    const tiffLE = new Uint8Array([0x49, 0x49, 0x2A, 0x00]);
    expect(detectImageFormat(tiffLE)).toBe('tiff');
  });

  it('detects TIFF big-endian', () => {
    const tiffBE = new Uint8Array([0x4D, 0x4D, 0x00, 0x2A]);
    expect(detectImageFormat(tiffBE)).toBe('tiff');
  });

  it('returns unknown for empty data', () => {
    expect(detectImageFormat(new Uint8Array(0))).toBe('unknown');
  });

  it('returns unknown for too-short data', () => {
    expect(detectImageFormat(new Uint8Array([0x89, 0x50]))).toBe('unknown');
    expect(detectImageFormat(new Uint8Array([0xFF]))).toBe('unknown');
  });

  it('returns unknown for unrecognized bytes', () => {
    const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(detectImageFormat(unknown)).toBe('unknown');
  });

  it('returns unknown for RIFF without WEBP', () => {
    // RIFF....WAVE (audio, not WebP)
    const wave = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // WAVE, not WEBP
    ]);
    expect(detectImageFormat(wave)).toBe('unknown');
  });

  it('returns unknown for RIFF shorter than 12 bytes', () => {
    // Has RIFF header but not enough bytes for WEBP check
    const shortRiff = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00]);
    expect(detectImageFormat(shortRiff)).toBe('unknown');
  });

  it('does not confuse II (TIFF LE) with other data', () => {
    // Starts with II but wrong magic number
    const notTiff = new Uint8Array([0x49, 0x49, 0x00, 0x00]);
    expect(detectImageFormat(notTiff)).toBe('unknown');
  });

  it('does not confuse MM (TIFF BE) with other data', () => {
    // Starts with MM but wrong magic number
    const notTiff = new Uint8Array([0x4D, 0x4D, 0x00, 0x00]);
    expect(detectImageFormat(notTiff)).toBe('unknown');
  });

  it('handles larger PNG file', () => {
    const png = new Uint8Array(1024);
    png[0] = 0x89;
    png[1] = 0x50;
    png[2] = 0x4E;
    png[3] = 0x47;
    expect(detectImageFormat(png)).toBe('png');
  });
});

// ---------------------------------------------------------------------------
// getImageFormatName
// ---------------------------------------------------------------------------

describe('getImageFormatName', () => {
  it('returns correct name for png', () => {
    expect(getImageFormatName('png')).toBe('PNG (Portable Network Graphics)');
  });

  it('returns correct name for jpeg', () => {
    expect(getImageFormatName('jpeg')).toBe('JPEG (Joint Photographic Experts Group)');
  });

  it('returns correct name for webp', () => {
    expect(getImageFormatName('webp')).toBe('WebP');
  });

  it('returns correct name for tiff', () => {
    expect(getImageFormatName('tiff')).toBe('TIFF (Tagged Image File Format)');
  });

  it('returns Unknown for unknown format', () => {
    expect(getImageFormatName('unknown')).toBe('Unknown');
  });

  it('returns descriptive string for unrecognized format', () => {
    expect(getImageFormatName('bmp')).toBe('Unknown (bmp)');
    expect(getImageFormatName('gif')).toBe('Unknown (gif)');
  });
});

// ---------------------------------------------------------------------------
// getSupportedFormats
// ---------------------------------------------------------------------------

describe('getSupportedFormats', () => {
  it('returns all four supported formats', () => {
    const formats = getSupportedFormats();
    expect(formats).toEqual(['png', 'jpeg', 'webp', 'tiff']);
  });

  it('returns an array of length 4', () => {
    expect(getSupportedFormats().length).toBe(4);
  });

  it('includes png', () => {
    expect(getSupportedFormats()).toContain('png');
  });

  it('includes jpeg', () => {
    expect(getSupportedFormats()).toContain('jpeg');
  });

  it('includes webp', () => {
    expect(getSupportedFormats()).toContain('webp');
  });

  it('includes tiff', () => {
    expect(getSupportedFormats()).toContain('tiff');
  });
});

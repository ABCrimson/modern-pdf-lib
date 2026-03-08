/**
 * Tests for JPEG2000 tile grid parsing, single-tile decoding,
 * region decoding, and tile assembly.
 *
 * Covers:
 * - parseTileInfo: extracts correct tile grid geometry from SIZ marker
 * - parseTileInfo: single-tile image (tile size = image size)
 * - parseTileInfo: multi-tile layout calculations
 * - parseTileInfo: bits-per-component extraction
 * - parseTileInfo: throws on missing SIZ marker
 * - parseTileInfo: throws on truncated SIZ marker
 * - decodeTile: correct tile rectangle for grid position
 * - decodeTile: out-of-range index throws
 * - decodeTileRegion: region-of-interest returns correct size
 * - decodeTileRegion: out-of-bounds region throws
 * - assembleTiles: assembles tiles into full image buffer
 */

import { describe, it, expect } from 'vitest';
import {
  parseTileInfo,
  decodeTile,
  decodeTileRegion,
  assembleTiles,
} from '../../../src/parser/jpeg2000Tiles.js';
import type {
  TileGridInfo,
  TileData,
} from '../../../src/parser/jpeg2000Tiles.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a 32-bit big-endian unsigned integer into a byte array at offset. */
function writeU32(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/** Write a 16-bit big-endian unsigned integer into a byte array at offset. */
function writeU16(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/**
 * Build a minimal raw J2K codestream with SOC + SIZ marker.
 *
 * SIZ marker structure (after marker bytes FF 51):
 *   [0-1]   Lsiz   = marker segment length
 *   [2-3]   Rsiz   = capabilities
 *   [4-7]   Xsiz   = image width (reference grid)
 *   [8-11]  Ysiz   = image height
 *   [12-15] XOsiz  = image origin X
 *   [16-19] YOsiz  = image origin Y
 *   [20-23] XTsiz  = tile width
 *   [24-27] YTsiz  = tile height
 *   [28-31] XTOsiz = tile origin X
 *   [32-35] YTOsiz = tile origin Y
 *   [36-37] Csiz   = number of components
 *   [38+]   component entries: Ssiz(1) + XRsiz(1) + YRsiz(1) each
 */
function buildJ2K(options: {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  components?: number;
  bitsPerComponent?: number;
  originX?: number;
  originY?: number;
  tileOriginX?: number;
  tileOriginY?: number;
  addSOT?: boolean;
}): Uint8Array {
  const comps = options.components ?? 3;
  const bpc = options.bitsPerComponent ?? 8;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const tileOriginX = options.tileOriginX ?? 0;
  const tileOriginY = options.tileOriginY ?? 0;

  // SIZ marker segment length = 38 + 3 * Csiz + 2 (for Lsiz field itself)
  const sizLen = 38 + comps * 3;

  const arr: number[] = [];

  // SOC marker
  arr[0] = 0xff;
  arr[1] = 0x4f;

  // SIZ marker
  arr[2] = 0xff;
  arr[3] = 0x51;

  const base = 4; // after marker bytes
  writeU16(arr, base, sizLen);         // Lsiz
  writeU16(arr, base + 2, 0);         // Rsiz
  writeU32(arr, base + 4, options.width + originX);  // Xsiz
  writeU32(arr, base + 8, options.height + originY); // Ysiz
  writeU32(arr, base + 12, originX);   // XOsiz
  writeU32(arr, base + 16, originY);   // YOsiz
  writeU32(arr, base + 20, options.tileWidth);  // XTsiz
  writeU32(arr, base + 24, options.tileHeight); // YTsiz
  writeU32(arr, base + 28, tileOriginX); // XTOsiz
  writeU32(arr, base + 32, tileOriginY); // YTOsiz
  writeU16(arr, base + 36, comps);     // Csiz

  // Component entries
  const compStart = base + 38;
  for (let i = 0; i < comps; i++) {
    arr[compStart + i * 3] = (bpc - 1) & 0x7f; // Ssiz (unsigned, depth-1)
    arr[compStart + i * 3 + 1] = 1; // XRsiz
    arr[compStart + i * 3 + 2] = 1; // YRsiz
  }

  // Optional: add SOT markers for each tile
  if (options.addSOT) {
    const tilesX = Math.ceil(options.width / options.tileWidth);
    const tilesY = Math.ceil(options.height / options.tileHeight);
    let offset = 4 + sizLen;

    for (let t = 0; t < tilesX * tilesY; t++) {
      // SOT marker
      arr[offset] = 0xff;
      arr[offset + 1] = 0x90;
      // Lsot = 10
      writeU16(arr, offset + 2, 10);
      // Isot = tile index
      writeU16(arr, offset + 4, t);
      // Psot = 14 (SOT header + SOD marker + empty tile data)
      writeU32(arr, offset + 6, 14);
      // TPsot = 0
      arr[offset + 10] = 0;
      // TNsot = 1
      arr[offset + 11] = 1;
      // SOD marker
      arr[offset + 12] = 0xff;
      arr[offset + 13] = 0x93;
      offset += 14;
    }

    // EOC marker
    arr[offset] = 0xff;
    arr[offset + 1] = 0xd9;
  }

  // Fill any undefined slots with 0
  const result = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[i] = arr[i] ?? 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// parseTileInfo
// ---------------------------------------------------------------------------

describe('parseTileInfo', () => {
  it('extracts correct image dimensions', () => {
    const data = buildJ2K({ width: 256, height: 128, tileWidth: 64, tileHeight: 64 });
    const info = parseTileInfo(data);
    expect(info.imageWidth).toBe(256);
    expect(info.imageHeight).toBe(128);
  });

  it('calculates correct tile counts', () => {
    const data = buildJ2K({ width: 256, height: 128, tileWidth: 64, tileHeight: 64 });
    const info = parseTileInfo(data);
    expect(info.tilesX).toBe(4);  // 256 / 64 = 4
    expect(info.tilesY).toBe(2);  // 128 / 64 = 2
  });

  it('handles non-evenly-divisible tile grid', () => {
    const data = buildJ2K({ width: 300, height: 200, tileWidth: 128, tileHeight: 128 });
    const info = parseTileInfo(data);
    expect(info.tilesX).toBe(3);  // ceil(300/128) = 3
    expect(info.tilesY).toBe(2);  // ceil(200/128) = 2
  });

  it('handles single tile image (tile = image)', () => {
    const data = buildJ2K({ width: 100, height: 100, tileWidth: 100, tileHeight: 100 });
    const info = parseTileInfo(data);
    expect(info.tilesX).toBe(1);
    expect(info.tilesY).toBe(1);
  });

  it('extracts correct tile dimensions', () => {
    const data = buildJ2K({ width: 256, height: 256, tileWidth: 64, tileHeight: 32 });
    const info = parseTileInfo(data);
    expect(info.tileWidth).toBe(64);
    expect(info.tileHeight).toBe(32);
  });

  it('extracts tile grid origin', () => {
    const data = buildJ2K({
      width: 256, height: 256, tileWidth: 64, tileHeight: 64,
      tileOriginX: 10, tileOriginY: 20,
    });
    const info = parseTileInfo(data);
    expect(info.originX).toBe(10);
    expect(info.originY).toBe(20);
  });

  it('extracts component count', () => {
    const data = buildJ2K({ width: 100, height: 100, tileWidth: 100, tileHeight: 100, components: 4 });
    const info = parseTileInfo(data);
    expect(info.components).toBe(4);
  });

  it('extracts bits per component', () => {
    const data = buildJ2K({
      width: 100, height: 100, tileWidth: 100, tileHeight: 100,
      bitsPerComponent: 16,
    });
    const info = parseTileInfo(data);
    expect(info.bitsPerComponent).toBe(16);
  });

  it('extracts 8-bit depth by default', () => {
    const data = buildJ2K({ width: 100, height: 100, tileWidth: 100, tileHeight: 100 });
    const info = parseTileInfo(data);
    expect(info.bitsPerComponent).toBe(8);
  });

  it('throws on missing SIZ marker', () => {
    const data = new Uint8Array([0xff, 0x4f, 0x00, 0x00]); // SOC + garbage
    expect(() => parseTileInfo(data)).toThrow(/SIZ marker/i);
  });

  it('throws on truncated SIZ marker', () => {
    // SOC + SIZ marker but with only 10 bytes of content (need 38+)
    const data = new Uint8Array([
      0xff, 0x4f, // SOC
      0xff, 0x51, // SIZ
      0x00, 0x0a, // Lsiz = 10 (way too short)
      0x00, 0x00, // Rsiz
    ]);
    expect(() => parseTileInfo(data)).toThrow(/truncated/i);
  });
});

// ---------------------------------------------------------------------------
// decodeTile
// ---------------------------------------------------------------------------

describe('decodeTile', () => {
  it('returns tile data with correct index and position for tile 0', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    const tile = decodeTile(data, 0);
    expect(tile.index).toBe(0);
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
    expect(tile.width).toBe(64);
    expect(tile.height).toBe(64);
    expect(tile.components).toBe(3);
  });

  it('returns correct position for tile at col=1, row=0', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    const tile = decodeTile(data, 1);
    expect(tile.index).toBe(1);
    expect(tile.x).toBe(64);
    expect(tile.y).toBe(0);
  });

  it('returns correct position for tile at row=1', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    // Tile 2 = row 1, col 0
    const tile = decodeTile(data, 2);
    expect(tile.index).toBe(2);
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(64);
  });

  it('returns tile data as a Uint8Array', () => {
    const data = buildJ2K({
      width: 64, height: 64, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    const tile = decodeTile(data, 0);
    expect(tile.data).toBeInstanceOf(Uint8Array);
  });

  it('throws for negative tile index', () => {
    const data = buildJ2K({
      width: 64, height: 64, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTile(data, -1)).toThrow(/out of range/i);
  });

  it('throws for tile index beyond total tiles', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    // Total tiles = 4 (2x2), so index 4 is out of range
    expect(() => decodeTile(data, 4)).toThrow(/out of range/i);
  });

  it('handles edge tile with reduced width', () => {
    const data = buildJ2K({
      width: 100, height: 64, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    // Tile 1 at col=1 should have width 36 (100-64)
    const tile = decodeTile(data, 1);
    expect(tile.width).toBe(36);
    expect(tile.height).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// decodeTileRegion
// ---------------------------------------------------------------------------

describe('decodeTileRegion', () => {
  it('returns pixel data for the requested region', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    const result = decodeTileRegion(data, { x: 0, y: 0, width: 32, height: 32 });
    expect(result).toBeInstanceOf(Uint8Array);
    // For 8-bit, 3 components: 32 * 32 * 3 = 3072 bytes
    expect(result.length).toBe(32 * 32 * 3);
  });

  it('returns data matching clamped region size', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    // Region extends beyond image: should be clamped
    const result = decodeTileRegion(data, { x: 100, y: 100, width: 100, height: 100 });
    // Clamped: x=100, y=100, width=28, height=28
    expect(result.length).toBe(28 * 28 * 3);
  });

  it('throws when region is entirely outside image bounds', () => {
    const data = buildJ2K({
      width: 128, height: 128, tileWidth: 64, tileHeight: 64,
      addSOT: true,
    });
    expect(() =>
      decodeTileRegion(data, { x: 200, y: 200, width: 50, height: 50 }),
    ).toThrow(/outside image bounds/i);
  });
});

// ---------------------------------------------------------------------------
// assembleTiles
// ---------------------------------------------------------------------------

describe('assembleTiles', () => {
  it('produces output matching full image dimensions', () => {
    const gridInfo: TileGridInfo = {
      imageWidth: 128,
      imageHeight: 64,
      tileWidth: 64,
      tileHeight: 64,
      tilesX: 2,
      tilesY: 1,
      originX: 0,
      originY: 0,
      components: 3,
      bitsPerComponent: 8,
    };

    const tile0: TileData = {
      index: 0, x: 0, y: 0, width: 64, height: 64,
      data: new Uint8Array(64 * 64 * 3).fill(100),
      components: 3,
    };
    const tile1: TileData = {
      index: 1, x: 64, y: 0, width: 64, height: 64,
      data: new Uint8Array(64 * 64 * 3).fill(200),
      components: 3,
    };

    const result = assembleTiles([tile0, tile1], gridInfo);
    expect(result.length).toBe(128 * 64 * 3);
  });

  it('places tile data at correct positions', () => {
    const gridInfo: TileGridInfo = {
      imageWidth: 4,
      imageHeight: 2,
      tileWidth: 2,
      tileHeight: 2,
      tilesX: 2,
      tilesY: 1,
      originX: 0,
      originY: 0,
      components: 1,
      bitsPerComponent: 8,
    };

    const tile0: TileData = {
      index: 0, x: 0, y: 0, width: 2, height: 2,
      data: new Uint8Array([10, 20, 30, 40]),
      components: 1,
    };
    const tile1: TileData = {
      index: 1, x: 2, y: 0, width: 2, height: 2,
      data: new Uint8Array([50, 60, 70, 80]),
      components: 1,
    };

    const result = assembleTiles([tile0, tile1], gridInfo);
    // Row 0: [10, 20, 50, 60]
    // Row 1: [30, 40, 70, 80]
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(20);
    expect(result[2]).toBe(50);
    expect(result[3]).toBe(60);
    expect(result[4]).toBe(30);
    expect(result[5]).toBe(40);
    expect(result[6]).toBe(70);
    expect(result[7]).toBe(80);
  });

  it('handles empty tile array (all zeros)', () => {
    const gridInfo: TileGridInfo = {
      imageWidth: 64,
      imageHeight: 64,
      tileWidth: 64,
      tileHeight: 64,
      tilesX: 1,
      tilesY: 1,
      originX: 0,
      originY: 0,
      components: 3,
      bitsPerComponent: 8,
    };

    const result = assembleTiles([], gridInfo);
    expect(result.length).toBe(64 * 64 * 3);
    // All zeros since no tiles were provided
    expect(result.every(b => b === 0)).toBe(true);
  });

  it('handles 16-bit depth (2 bytes per sample)', () => {
    const gridInfo: TileGridInfo = {
      imageWidth: 2,
      imageHeight: 1,
      tileWidth: 2,
      tileHeight: 1,
      tilesX: 1,
      tilesY: 1,
      originX: 0,
      originY: 0,
      components: 1,
      bitsPerComponent: 16,
    };

    const tile: TileData = {
      index: 0, x: 0, y: 0, width: 2, height: 1,
      data: new Uint8Array([0x01, 0x00, 0x02, 0x00]),
      components: 1,
    };

    const result = assembleTiles([tile], gridInfo);
    // 2 pixels * 1 component * 2 bytes = 4 bytes
    expect(result.length).toBe(4);
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(0x00);
    expect(result[2]).toBe(0x02);
    expect(result[3]).toBe(0x00);
  });
});

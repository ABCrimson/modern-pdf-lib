/**
 * Tests for JPEG2000 tile grid parsing. The single-tile, region and assembly
 * entry points throw UnsupportedFilterError (each rewritten test keeps its
 * input and asserts the refusal).
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
import type { TileGridInfo, TileData } from '../../../src/parser/jpeg2000Tiles.js';
import { UnsupportedFilterError } from '../../../src/errors.js';

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
  writeU16(arr, base, sizLen); // Lsiz
  writeU16(arr, base + 2, 0); // Rsiz
  writeU32(arr, base + 4, options.width + originX); // Xsiz
  writeU32(arr, base + 8, options.height + originY); // Ysiz
  writeU32(arr, base + 12, originX); // XOsiz
  writeU32(arr, base + 16, originY); // YOsiz
  writeU32(arr, base + 20, options.tileWidth); // XTsiz
  writeU32(arr, base + 24, options.tileHeight); // YTsiz
  writeU32(arr, base + 28, tileOriginX); // XTOsiz
  writeU32(arr, base + 32, tileOriginY); // YTOsiz
  writeU16(arr, base + 36, comps); // Csiz

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
    expect(info.tilesX).toBe(4); // 256 / 64 = 4
    expect(info.tilesY).toBe(2); // 128 / 64 = 2
  });

  it('handles non-evenly-divisible tile grid', () => {
    const data = buildJ2K({ width: 300, height: 200, tileWidth: 128, tileHeight: 128 });
    const info = parseTileInfo(data);
    expect(info.tilesX).toBe(3); // ceil(300/128) = 3
    expect(info.tilesY).toBe(2); // ceil(200/128) = 2
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
      width: 256,
      height: 256,
      tileWidth: 64,
      tileHeight: 64,
      tileOriginX: 10,
      tileOriginY: 20,
    });
    const info = parseTileInfo(data);
    expect(info.originX).toBe(10);
    expect(info.originY).toBe(20);
  });

  it('extracts component count', () => {
    const data = buildJ2K({
      width: 100,
      height: 100,
      tileWidth: 100,
      tileHeight: 100,
      components: 4,
    });
    const info = parseTileInfo(data);
    expect(info.components).toBe(4);
  });

  it('extracts bits per component', () => {
    const data = buildJ2K({
      width: 100,
      height: 100,
      tileWidth: 100,
      tileHeight: 100,
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
      0xff,
      0x4f, // SOC
      0xff,
      0x51, // SIZ
      0x00,
      0x0a, // Lsiz = 10 (way too short)
      0x00,
      0x00, // Rsiz
    ]);
    expect(() => parseTileInfo(data)).toThrow(/truncated/i);
  });
});

// ---------------------------------------------------------------------------
// decodeTile
// ---------------------------------------------------------------------------

describe('decodeTile', () => {
  it('input of "returns tile data with correct index and position for tile 0" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTile(data, 0)).toThrow(UnsupportedFilterError);
  });

  it('input of "returns correct position for tile at col=1, row=0" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTile(data, 1)).toThrow(UnsupportedFilterError);
  });

  it('input of "returns correct position for tile at row=1" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    // Tile 2 = row 1, col 0
    expect(() => decodeTile(data, 2)).toThrow(UnsupportedFilterError);
  });

  it('input of "returns tile data as a Uint8Array" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 64,
      height: 64,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTile(data, 0)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for negative tile index" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 64,
      height: 64,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTile(data, -1)).toThrow(UnsupportedFilterError);
  });

  it('input of "throws for tile index beyond total tiles" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    // Total tiles = 4 (2x2), so index 4 is out of range
    expect(() => decodeTile(data, 4)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles edge tile with reduced width" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 100,
      height: 64,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    // Tile 1 at col=1 should have width 36 (100-64)
    expect(() => decodeTile(data, 1)).toThrow(UnsupportedFilterError);
  });
});

// ---------------------------------------------------------------------------
// decodeTileRegion
// ---------------------------------------------------------------------------

describe('decodeTileRegion', () => {
  it('input of "returns pixel data for the requested region" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTileRegion(data, { x: 0, y: 0, width: 32, height: 32 })).toThrow(
      UnsupportedFilterError,
    );
  });

  it('input of "returns data matching clamped region size" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    // Region extends beyond image: should be clamped
    expect(() => decodeTileRegion(data, { x: 100, y: 100, width: 100, height: 100 })).toThrow(
      UnsupportedFilterError,
    );
  });

  it('input of "throws when region is entirely outside image bounds" is refused with UnsupportedFilterError', () => {
    const data = buildJ2K({
      width: 128,
      height: 128,
      tileWidth: 64,
      tileHeight: 64,
      addSOT: true,
    });
    expect(() => decodeTileRegion(data, { x: 200, y: 200, width: 50, height: 50 })).toThrow(
      UnsupportedFilterError,
    );
  });
});

// ---------------------------------------------------------------------------
// assembleTiles
// ---------------------------------------------------------------------------

describe('assembleTiles', () => {
  it('input of "produces output matching full image dimensions" is refused with UnsupportedFilterError', () => {
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
      index: 0,
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      data: new Uint8Array(64 * 64 * 3).fill(100),
      components: 3,
    };
    const tile1: TileData = {
      index: 1,
      x: 64,
      y: 0,
      width: 64,
      height: 64,
      data: new Uint8Array(64 * 64 * 3).fill(200),
      components: 3,
    };

    expect(() => assembleTiles([tile0, tile1], gridInfo)).toThrow(UnsupportedFilterError);
  });

  it('input of "places tile data at correct positions" is refused with UnsupportedFilterError', () => {
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
      index: 0,
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      data: new Uint8Array([10, 20, 30, 40]),
      components: 1,
    };
    const tile1: TileData = {
      index: 1,
      x: 2,
      y: 0,
      width: 2,
      height: 2,
      data: new Uint8Array([50, 60, 70, 80]),
      components: 1,
    };

    expect(() => assembleTiles([tile0, tile1], gridInfo)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles empty tile array (all zeros)" is refused with UnsupportedFilterError', () => {
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

    expect(() => assembleTiles([], gridInfo)).toThrow(UnsupportedFilterError);
  });

  it('input of "handles 16-bit depth (2 bytes per sample)" is refused with UnsupportedFilterError', () => {
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
      index: 0,
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      data: new Uint8Array([0x01, 0x00, 0x02, 0x00]),
      components: 1,
    };

    expect(() => assembleTiles([tile], gridInfo)).toThrow(UnsupportedFilterError);
  });
});

describe('JPEG2000 tile entries: the error carries its class, code and filter', () => {
  it('decodeTile throws UnsupportedFilterError with its code and filter', () => {
    expect(() => decodeTile(new Uint8Array(0), 0)).toThrow(
      expect.objectContaining({
        name: 'UnsupportedFilterError',
        code: 'unsupported-filter',
        filter: 'JPXDecode',
      }),
    );
  });

  it('decodeTileRegion throws UnsupportedFilterError with its code and filter', () => {
    expect(() => decodeTileRegion(new Uint8Array(0), { x: 0, y: 0, width: 1, height: 1 })).toThrow(
      expect.objectContaining({
        name: 'UnsupportedFilterError',
        code: 'unsupported-filter',
        filter: 'JPXDecode',
      }),
    );
  });

  it('assembleTiles throws UnsupportedFilterError with its code and filter', () => {
    expect(() =>
      assembleTiles([], {
        imageWidth: 8,
        imageHeight: 8,
        tileWidth: 8,
        tileHeight: 8,
        tilesX: 1,
        tilesY: 1,
        originX: 0,
        originY: 0,
        components: 1,
        bitsPerComponent: 8,
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'UnsupportedFilterError',
        code: 'unsupported-filter',
        filter: 'JPXDecode',
      }),
    );
  });
});

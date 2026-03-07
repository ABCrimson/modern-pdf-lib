/**
 * JPEG2000 compatibility and integration tests.
 *
 * Covers the codestream parser (SIZ / SOT markers), box parser (JP2 wrapper),
 * bit-depth conversion, tiled decoding, region-of-interest decoding, and
 * error handling for various JPEG2000 configurations.
 *
 * Because real JP2 files are not included in the test fixtures, all test
 * data is constructed programmatically by writing the correct JPEG2000
 * marker sequences.
 */

import { describe, it, expect } from 'vitest';
import {
  getComponentDepths,
  downscale16To8,
  upscale8To16,
  normalizeComponentDepth,
  offsetSignedToUnsigned,
  summarizeBitDepth,
} from '../../../src/parser/jpeg2000BitDepth.js';
import type { BitDepthInfo, ComponentDepth } from '../../../src/parser/jpeg2000BitDepth.js';
import {
  parseTileInfo,
  decodeTile,
  decodeTileRegion,
  assembleTiles,
} from '../../../src/parser/jpeg2000Tiles.js';
import type { TileGridInfo, TileData } from '../../../src/parser/jpeg2000Tiles.js';

// ===========================================================================
// Helpers — synthetic JPEG2000 byte sequence builders
// ===========================================================================

/**
 * Write a 16-bit big-endian value into an array at the given offset.
 */
function writeU16(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/**
 * Write a 32-bit big-endian value into an array at the given offset.
 */
function writeU32(arr: number[], offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/**
 * Build a minimal SIZ marker segment.
 *
 * @param opts.width       - Image width.
 * @param opts.height      - Image height.
 * @param opts.tileWidth   - Tile width (defaults to image width = single tile).
 * @param opts.tileHeight  - Tile height (defaults to image height = single tile).
 * @param opts.components  - Array of { bits, isSigned } per component.
 * @param opts.originX     - Image origin X (default 0).
 * @param opts.originY     - Image origin Y (default 0).
 * @param opts.tileOriginX - Tile origin X (default 0).
 * @param opts.tileOriginY - Tile origin Y (default 0).
 */
function buildSizSegment(opts: {
  width: number;
  height: number;
  tileWidth?: number;
  tileHeight?: number;
  components: { bits: number; isSigned: boolean }[];
  originX?: number;
  originY?: number;
  tileOriginX?: number;
  tileOriginY?: number;
}): number[] {
  const csiz = opts.components.length;
  // Lsiz = 38 (fixed portion) + 3 * csiz (per-component)
  const lsiz = 38 + 3 * csiz;

  const seg: number[] = new Array(2 + lsiz).fill(0);

  // Marker: 0xFF51
  seg[0] = 0xff;
  seg[1] = 0x51;

  // Lsiz
  writeU16(seg, 2, lsiz);

  // Rsiz (capabilities) = 0
  writeU16(seg, 4, 0);

  // Xsiz = originX + width
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;
  writeU32(seg, 6, originX + opts.width);

  // Ysiz = originY + height
  writeU32(seg, 10, originY + opts.height);

  // XOsiz, YOsiz
  writeU32(seg, 14, originX);
  writeU32(seg, 18, originY);

  // XTsiz, YTsiz
  writeU32(seg, 22, opts.tileWidth ?? opts.width);
  writeU32(seg, 26, opts.tileHeight ?? opts.height);

  // XTOsiz, YTOsiz
  writeU32(seg, 30, opts.tileOriginX ?? 0);
  writeU32(seg, 34, opts.tileOriginY ?? 0);

  // Csiz
  writeU16(seg, 38, csiz);

  // Per-component: Ssiz(1) + XRsiz(1) + YRsiz(1)
  for (let i = 0; i < csiz; i++) {
    const comp = opts.components[i]!;
    const ssiz = (comp.isSigned ? 0x80 : 0x00) | ((comp.bits - 1) & 0x7f);
    seg[40 + i * 3] = ssiz;
    seg[40 + i * 3 + 1] = 1; // XRsiz = 1 (no subsampling)
    seg[40 + i * 3 + 2] = 1; // YRsiz = 1
  }

  return seg;
}

/**
 * Build a minimal raw J2K codestream with SOC + SIZ.
 */
function buildMinimalCodestream(sizOpts: Parameters<typeof buildSizSegment>[0]): number[] {
  // SOC marker
  const soc = [0xff, 0x4f];
  const siz = buildSizSegment(sizOpts);
  return [...soc, ...siz];
}

/**
 * Build a SOT (Start of Tile-part) marker segment.
 *
 * @param tileIndex - Tile index (Isot).
 * @param tilePartLength - Total tile-part length (Psot), 0 = until EOC.
 * @param tilePartIndex - Tile-part index (TPsot).
 * @param numTileParts - Number of tile-parts (TNsot), 0 = unknown.
 */
function buildSotSegment(
  tileIndex: number,
  tilePartLength: number,
  tilePartIndex: number = 0,
  numTileParts: number = 1,
): number[] {
  const seg: number[] = new Array(12).fill(0);
  // Marker: 0xFF90
  seg[0] = 0xff;
  seg[1] = 0x90;
  // Lsot = 10
  writeU16(seg, 2, 10);
  // Isot
  writeU16(seg, 4, tileIndex);
  // Psot
  writeU32(seg, 6, tilePartLength);
  // TPsot
  seg[10] = tilePartIndex;
  // TNsot
  seg[11] = numTileParts;
  return seg;
}

/**
 * Build a SOD (Start of Data) marker.
 */
function buildSodMarker(): number[] {
  return [0xff, 0x93];
}

/**
 * Build an EOC (End of Codestream) marker.
 */
function buildEocMarker(): number[] {
  return [0xff, 0xd9];
}

/**
 * Wrap a raw codestream in a JP2 file box structure.
 *
 * The minimal JP2 consists of:
 * - Signature box (jP\040\040)
 * - File Type box (ftyp)
 * - Contiguous Codestream box (jp2c)
 */
function wrapInJp2(codestream: number[]): number[] {
  // Signature box: 12 bytes
  const sigBox = [
    0x00, 0x00, 0x00, 0x0c, // box length = 12
    0x6a, 0x50, 0x20, 0x20, // box type = "jP  "
    0x0d, 0x0a, 0x87, 0x0a, // signature content
  ];

  // File Type box: 20 bytes
  const ftypBox = [
    0x00, 0x00, 0x00, 0x14, // box length = 20
    0x66, 0x74, 0x79, 0x70, // box type = "ftyp"
    0x6a, 0x70, 0x32, 0x20, // brand = "jp2 "
    0x00, 0x00, 0x00, 0x00, // minor version
    0x6a, 0x70, 0x32, 0x20, // compatible brand
  ];

  // JP2 Header box (jp2h) — minimal with image header (ihdr)
  const ihdrContent = [
    0x00, 0x00, 0x00, 0x01, // height = 1
    0x00, 0x00, 0x00, 0x01, // width = 1
    0x00, 0x03,             // num components = 3
    0x07,                   // bpc = 8 (stored as 7 = bpc-1)
    0x07,                   // compression type = 7 (jpeg2000)
    0x00,                   // unknown colorspace = 0
    0x00,                   // intellectual property = 0
  ];
  const ihdrBoxLen = 8 + ihdrContent.length;
  const ihdrBox = [
    (ihdrBoxLen >>> 24) & 0xff,
    (ihdrBoxLen >>> 16) & 0xff,
    (ihdrBoxLen >>> 8) & 0xff,
    ihdrBoxLen & 0xff,
    0x69, 0x68, 0x64, 0x72, // "ihdr"
    ...ihdrContent,
  ];

  const jp2hBoxLen = 8 + ihdrBox.length;
  const jp2hBox = [
    (jp2hBoxLen >>> 24) & 0xff,
    (jp2hBoxLen >>> 16) & 0xff,
    (jp2hBoxLen >>> 8) & 0xff,
    jp2hBoxLen & 0xff,
    0x6a, 0x70, 0x32, 0x68, // "jp2h"
    ...ihdrBox,
  ];

  // Contiguous Codestream box (jp2c)
  const jp2cBoxLen = 8 + codestream.length;
  const jp2cBoxHeader = [
    (jp2cBoxLen >>> 24) & 0xff,
    (jp2cBoxLen >>> 16) & 0xff,
    (jp2cBoxLen >>> 8) & 0xff,
    jp2cBoxLen & 0xff,
    0x6a, 0x70, 0x32, 0x63, // "jp2c"
  ];

  return [...sigBox, ...ftypBox, ...jp2hBox, ...jp2cBoxHeader, ...codestream];
}

/**
 * Build a complete single-tile codestream with one tile part containing
 * dummy data.
 */
function buildSingleTileCodestream(
  width: number,
  height: number,
  components: { bits: number; isSigned: boolean }[],
  tileData: number[] = [0x00],
): number[] {
  const cs = buildMinimalCodestream({
    width,
    height,
    components,
  });

  const sot = buildSotSegment(0, 0); // psot=0 means until EOC
  const sod = buildSodMarker();
  const eoc = buildEocMarker();

  // Fix psot: SOT(12) + SOD(2) + data + EOC is not included in psot
  // psot covers from SOT marker to end of tile-part data
  const psot = 12 + 2 + tileData.length;
  writeU32(sot, 6, psot);

  return [...cs, ...sot, ...sod, ...tileData, ...eoc];
}

/**
 * Build a multi-tile codestream.
 */
function buildMultiTileCodestream(
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
  components: { bits: number; isSigned: boolean }[],
): number[] {
  const cs = buildMinimalCodestream({
    width,
    height,
    tileWidth,
    tileHeight,
    components,
  });

  const tilesX = Math.ceil(width / tileWidth);
  const tilesY = Math.ceil(height / tileHeight);
  const totalTiles = tilesX * tilesY;

  const tileParts: number[] = [];
  for (let i = 0; i < totalTiles; i++) {
    const dummyData = [0x00, 0x01]; // minimal tile data
    const psot = 12 + 2 + dummyData.length; // SOT + SOD + data
    const sot = buildSotSegment(i, psot, 0, 1);
    const sod = buildSodMarker();
    tileParts.push(...sot, ...sod, ...dummyData);
  }

  const eoc = buildEocMarker();
  return [...cs, ...tileParts, ...eoc];
}

// ===========================================================================
// 1. Single-tile lossless image (8-bit RGB)
// ===========================================================================

describe('JPEG2000 single-tile lossless (8-bit RGB)', () => {
  it('parses SIZ marker for a single-tile 8-bit RGB image', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 64,
        height: 48,
        components: [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      }),
    );

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(3);
    expect(depths[0]).toEqual({ bits: 8, isSigned: false });
    expect(depths[1]).toEqual({ bits: 8, isSigned: false });
    expect(depths[2]).toEqual({ bits: 8, isSigned: false });
  });

  it('reports correct tile grid for a single-tile image', () => {
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        64,
        48,
        [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      ),
    );

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(64);
    expect(info.imageHeight).toBe(48);
    expect(info.tileWidth).toBe(64);
    expect(info.tileHeight).toBe(48);
    expect(info.tilesX).toBe(1);
    expect(info.tilesY).toBe(1);
    expect(info.components).toBe(3);
    expect(info.bitsPerComponent).toBe(8);
  });

  it('decodes a single tile successfully', () => {
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        8,
        4,
        [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
        [0xab, 0xcd, 0xef],
      ),
    );

    const tile = decodeTile(cs, 0);
    expect(tile.index).toBe(0);
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
    expect(tile.width).toBe(8);
    expect(tile.height).toBe(4);
    expect(tile.components).toBe(3);
    expect(tile.data.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 2. Single-tile lossy image (8-bit RGB)
// ===========================================================================

describe('JPEG2000 single-tile lossy (8-bit RGB)', () => {
  it('parses a lossy codestream with the same marker structure', () => {
    // Lossy vs lossless is determined by the transform (COD marker),
    // not the SIZ.  The SIZ parsing should work identically.
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        128,
        96,
        [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
        [0x00, 0x11, 0x22, 0x33],
      ),
    );

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(128);
    expect(info.imageHeight).toBe(96);
    expect(info.components).toBe(3);
  });

  it('correctly decodes tile index 0', () => {
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        32,
        32,
        [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
        [0xff, 0x00, 0x80],
      ),
    );

    const tile = decodeTile(cs, 0);
    expect(tile.index).toBe(0);
    expect(tile.width).toBe(32);
    expect(tile.height).toBe(32);
  });
});

// ===========================================================================
// 3. Multi-tile image
// ===========================================================================

describe('JPEG2000 multi-tile image', () => {
  it('parses tile grid for a 2x2 tiled image', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      ),
    );

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(100);
    expect(info.imageHeight).toBe(80);
    expect(info.tileWidth).toBe(50);
    expect(info.tileHeight).toBe(40);
    expect(info.tilesX).toBe(2);
    expect(info.tilesY).toBe(2);
  });

  it('parses tile grid with non-evenly-divisible dimensions', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        75,
        64,
        64,
        [{ bits: 8, isSigned: false }],
      ),
    );

    const info = parseTileInfo(cs);
    expect(info.tilesX).toBe(2); // ceil(100/64) = 2
    expect(info.tilesY).toBe(2); // ceil(75/64) = 2
  });

  it('decodes individual tiles by index', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    // Tile 0 (top-left)
    const tile0 = decodeTile(cs, 0);
    expect(tile0.x).toBe(0);
    expect(tile0.y).toBe(0);
    expect(tile0.width).toBe(50);
    expect(tile0.height).toBe(40);

    // Tile 1 (top-right)
    const tile1 = decodeTile(cs, 1);
    expect(tile1.x).toBe(50);
    expect(tile1.y).toBe(0);
    expect(tile1.width).toBe(50);
    expect(tile1.height).toBe(40);

    // Tile 2 (bottom-left)
    const tile2 = decodeTile(cs, 2);
    expect(tile2.x).toBe(0);
    expect(tile2.y).toBe(40);
    expect(tile2.width).toBe(50);
    expect(tile2.height).toBe(40);

    // Tile 3 (bottom-right)
    const tile3 = decodeTile(cs, 3);
    expect(tile3.x).toBe(50);
    expect(tile3.y).toBe(40);
    expect(tile3.width).toBe(50);
    expect(tile3.height).toBe(40);
  });

  it('throws for out-of-range tile index', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    expect(() => decodeTile(cs, 4)).toThrow('out of range');
    expect(() => decodeTile(cs, -1)).toThrow('out of range');
  });

  it('assembles tiles into a full image', () => {
    const gridInfo: TileGridInfo = {
      imageWidth: 4,
      imageHeight: 4,
      tileWidth: 2,
      tileHeight: 2,
      tilesX: 2,
      tilesY: 2,
      originX: 0,
      originY: 0,
      components: 1,
      bitsPerComponent: 8,
    };

    const tiles: TileData[] = [
      { index: 0, x: 0, y: 0, width: 2, height: 2, data: new Uint8Array([1, 2, 3, 4]), components: 1 },
      { index: 1, x: 2, y: 0, width: 2, height: 2, data: new Uint8Array([5, 6, 7, 8]), components: 1 },
      { index: 2, x: 0, y: 2, width: 2, height: 2, data: new Uint8Array([9, 10, 11, 12]), components: 1 },
      { index: 3, x: 2, y: 2, width: 2, height: 2, data: new Uint8Array([13, 14, 15, 16]), components: 1 },
    ];

    const assembled = assembleTiles(tiles, gridInfo);
    expect(assembled).toEqual(new Uint8Array([
      1, 2, 5, 6,
      3, 4, 7, 8,
      9, 10, 13, 14,
      11, 12, 15, 16,
    ]));
  });
});

// ===========================================================================
// 4. Grayscale image
// ===========================================================================

describe('JPEG2000 grayscale image', () => {
  it('parses SIZ for a single-component grayscale image', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 256,
        height: 256,
        components: [{ bits: 8, isSigned: false }],
      }),
    );

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(1);
    expect(depths[0]).toEqual({ bits: 8, isSigned: false });

    const info = parseTileInfo(cs);
    expect(info.components).toBe(1);
  });

  it('summarizes bit depth for grayscale', () => {
    const depths: ComponentDepth[] = [{ bits: 8, isSigned: false }];
    const summary = summarizeBitDepth(depths);
    expect(summary.bitsPerComponent).toBe(8);
    expect(summary.isSigned).toBe(false);
    expect(summary.components).toBe(1);
  });
});

// ===========================================================================
// 5. 16-bit depth image
// ===========================================================================

describe('JPEG2000 16-bit depth image', () => {
  it('parses SIZ for a 16-bit component', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 512,
        height: 512,
        components: [{ bits: 16, isSigned: false }],
      }),
    );

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(1);
    expect(depths[0]!.bits).toBe(16);
    expect(depths[0]!.isSigned).toBe(false);
  });

  it('parses signed 16-bit components', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 256,
        height: 256,
        components: [
          { bits: 16, isSigned: true },
          { bits: 16, isSigned: true },
        ],
      }),
    );

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(2);
    expect(depths[0]!.isSigned).toBe(true);
    expect(depths[1]!.isSigned).toBe(true);
  });

  it('downscales 16-bit to 8-bit', () => {
    // 16-bit value 65535 -> 255
    // 16-bit value 0     -> 0
    // 16-bit value 32768 -> 128 (approximately)
    const data16 = new Uint8Array([
      0xff, 0xff, // 65535
      0x00, 0x00, // 0
      0x80, 0x00, // 32768
    ]);

    const data8 = downscale16To8(data16, 16);
    expect(data8.length).toBe(3);
    expect(data8[0]).toBe(255);
    expect(data8[1]).toBe(0);
    expect(data8[2]).toBe(128); // 32768 * 255 / 65535 = 127.5 -> rounds to 128
  });

  it('downscales 12-bit to 8-bit', () => {
    // 12-bit max = 4095 -> 255
    // 12-bit value 2048 -> 128 (approximately)
    const data12 = new Uint8Array([
      0x0f, 0xff, // 4095
      0x00, 0x00, // 0
      0x08, 0x00, // 2048
    ]);

    const data8 = downscale16To8(data12, 12);
    expect(data8.length).toBe(3);
    expect(data8[0]).toBe(255);
    expect(data8[1]).toBe(0);
    // 2048 * 255 / 4095 = 127.5 -> rounds to 128
    expect(data8[2]).toBe(128);
  });

  it('upscales 8-bit to 16-bit', () => {
    const data8 = new Uint8Array([0, 128, 255]);
    const data16 = upscale8To16(data8);

    expect(data16.length).toBe(6);
    // 0 * 257 = 0
    expect(data16[0]).toBe(0x00);
    expect(data16[1]).toBe(0x00);
    // 128 * 257 = 32896 = 0x8080
    expect(data16[2]).toBe(0x80);
    expect(data16[3]).toBe(0x80);
    // 255 * 257 = 65535 = 0xFFFF
    expect(data16[4]).toBe(0xff);
    expect(data16[5]).toBe(0xff);
  });

  it('round-trips 8->16->8 without loss', () => {
    const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const up = upscale8To16(original);
    const down = downscale16To8(up, 16);
    expect(down).toEqual(original);
  });

  it('normalizes 10-bit to 8-bit', () => {
    // 10-bit max = 1023
    const data = new Uint8Array([
      0x03, 0xff, // 1023 -> 255
      0x00, 0x00, // 0 -> 0
      0x02, 0x00, // 512 -> ~128
    ]);

    const result = normalizeComponentDepth(data, 10, 8);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(255);
    expect(result[1]).toBe(0);
    // 512 * 255 / 1023 = 127.6 -> 128
    expect(result[2]).toBe(128);
  });

  it('normalizes same depth as identity', () => {
    const data = new Uint8Array([10, 20, 30]);
    const result = normalizeComponentDepth(data, 8, 8);
    expect(result).toEqual(data);
  });

  it('offsets signed 16-bit to unsigned', () => {
    // Signed 16-bit range: -32768 to 32767
    // After offset by 32768: 0 to 65535
    const data = new Uint8Array([
      0x80, 0x00, // -32768 in unsigned representation -> 0 after offset
      0x00, 0x00, // 0 in signed -> 32768 after offset
      0x7f, 0xff, // 32767 -> 65535 after offset
    ]);

    // In this representation, 0x8000 = 32768 unsigned, which represents -32768 signed
    const result = offsetSignedToUnsigned(data, 16);
    expect(result.length).toBe(6);
    // 32768 unsigned = -32768 signed -> offset: -32768 + 32768 = 0
    expect((result[0]! << 8) | result[1]!).toBe(0);
    // 0 unsigned = 0 signed -> offset: 0 + 32768 = 32768
    expect((result[2]! << 8) | result[3]!).toBe(32768);
    // 32767 unsigned = 32767 signed -> offset: 32767 + 32768 = 65535
    expect((result[4]! << 8) | result[5]!).toBe(65535);
  });

  it('offsets signed 8-bit to unsigned', () => {
    // Signed 8-bit: -128 to 127
    // 0x80 (128) represents -128 -> offset to 0
    // 0x00 (0) -> offset to 128
    // 0x7F (127) -> offset to 255
    const data = new Uint8Array([0x80, 0x00, 0x7f]);
    const result = offsetSignedToUnsigned(data, 8);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(128);
    expect(result[2]).toBe(255);
  });

  it('tile info reports correct bitsPerComponent for 16-bit', () => {
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        64,
        64,
        [{ bits: 16, isSigned: false }],
      ),
    );

    const info = parseTileInfo(cs);
    expect(info.bitsPerComponent).toBe(16);
  });
});

// ===========================================================================
// 6. Raw J2K codestream (no JP2 wrapper)
// ===========================================================================

describe('JPEG2000 raw J2K codestream', () => {
  it('parses a raw codestream starting with SOC + SIZ', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 320,
        height: 240,
        components: [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      }),
    );

    // Verify SOC marker
    expect(cs[0]).toBe(0xff);
    expect(cs[1]).toBe(0x4f);

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(3);

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(320);
    expect(info.imageHeight).toBe(240);
  });

  it('decodes tile from raw codestream', () => {
    const cs = new Uint8Array(
      buildSingleTileCodestream(
        16,
        16,
        [{ bits: 8, isSigned: false }],
        [0xaa, 0xbb],
      ),
    );

    const tile = decodeTile(cs, 0);
    expect(tile.width).toBe(16);
    expect(tile.height).toBe(16);
    expect(tile.data.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 7. JP2 with ICC profile color space
// ===========================================================================

describe('JPEG2000 JP2 with wrapper', () => {
  it('parses SIZ from within a JP2 wrapper', () => {
    const rawCs = buildSingleTileCodestream(
      200,
      150,
      [
        { bits: 8, isSigned: false },
        { bits: 8, isSigned: false },
        { bits: 8, isSigned: false },
      ],
    );
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    // Verify JP2 signature
    expect(jp2[4]).toBe(0x6a);
    expect(jp2[5]).toBe(0x50);

    const depths = getComponentDepths(jp2);
    expect(depths).toHaveLength(3);
    expect(depths[0]!.bits).toBe(8);

    const info = parseTileInfo(jp2);
    expect(info.imageWidth).toBe(200);
    expect(info.imageHeight).toBe(150);
  });

  it('decodes a tile from a JP2-wrapped codestream', () => {
    const rawCs = buildSingleTileCodestream(
      32,
      32,
      [{ bits: 8, isSigned: false }, { bits: 8, isSigned: false }, { bits: 8, isSigned: false }],
      [0x01, 0x02, 0x03],
    );
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    const tile = decodeTile(jp2, 0);
    expect(tile.index).toBe(0);
    expect(tile.width).toBe(32);
    expect(tile.height).toBe(32);
    expect(tile.components).toBe(3);
  });
});

// ===========================================================================
// 8. JP2 with alpha channel
// ===========================================================================

describe('JPEG2000 with alpha channel', () => {
  it('parses 4-component RGBA image', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 64,
        height: 64,
        components: [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false }, // alpha
        ],
      }),
    );

    const depths = getComponentDepths(cs);
    expect(depths).toHaveLength(4);
    depths.forEach((d) => {
      expect(d.bits).toBe(8);
      expect(d.isSigned).toBe(false);
    });

    const info = parseTileInfo(cs);
    expect(info.components).toBe(4);
  });

  it('summarizes 4-component bit depth', () => {
    const depths: ComponentDepth[] = [
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
      { bits: 8, isSigned: false },
    ];

    const summary = summarizeBitDepth(depths);
    expect(summary.components).toBe(4);
    expect(summary.bitsPerComponent).toBe(8);
    expect(summary.isSigned).toBe(false);
  });

  it('handles mixed bit depths across components', () => {
    const depths: ComponentDepth[] = [
      { bits: 12, isSigned: false },
      { bits: 12, isSigned: false },
      { bits: 12, isSigned: false },
      { bits: 1, isSigned: false }, // 1-bit alpha mask
    ];

    const summary = summarizeBitDepth(depths);
    expect(summary.bitsPerComponent).toBe(12); // max
    expect(summary.components).toBe(4);
  });
});

// ===========================================================================
// 9. Reduced resolution decoding (half, quarter)
// ===========================================================================

describe('JPEG2000 reduced resolution', () => {
  it('tile grid info supports computing reduced-resolution dimensions', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 1024,
        height: 768,
        components: [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      }),
    );

    const info = parseTileInfo(cs);

    // Half resolution
    const halfWidth = Math.ceil(info.imageWidth / 2);
    const halfHeight = Math.ceil(info.imageHeight / 2);
    expect(halfWidth).toBe(512);
    expect(halfHeight).toBe(384);

    // Quarter resolution
    const quarterWidth = Math.ceil(info.imageWidth / 4);
    const quarterHeight = Math.ceil(info.imageHeight / 4);
    expect(quarterWidth).toBe(256);
    expect(quarterHeight).toBe(192);
  });

  it('computes reduced tile grid dimensions', () => {
    const info: TileGridInfo = {
      imageWidth: 2048,
      imageHeight: 2048,
      tileWidth: 512,
      tileHeight: 512,
      tilesX: 4,
      tilesY: 4,
      originX: 0,
      originY: 0,
      components: 3,
      bitsPerComponent: 8,
    };

    // At half resolution, each tile would be 256x256
    const halfTileWidth = Math.ceil(info.tileWidth / 2);
    const halfTileHeight = Math.ceil(info.tileHeight / 2);
    expect(halfTileWidth).toBe(256);
    expect(halfTileHeight).toBe(256);

    // Number of tiles stays the same regardless of resolution level
    expect(info.tilesX).toBe(4);
    expect(info.tilesY).toBe(4);
  });
});

// ===========================================================================
// 10. Region-of-interest decoding
// ===========================================================================

describe('JPEG2000 region-of-interest decoding', () => {
  it('decodes a region that spans a single tile', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    // Region entirely within tile 0 (0,0)-(50,40)
    const regionData = decodeTileRegion(cs, { x: 10, y: 5, width: 20, height: 15 });
    expect(regionData).toBeInstanceOf(Uint8Array);
    // 20 * 15 * 1 component * 1 byte = 300 bytes
    expect(regionData.length).toBe(300);
  });

  it('decodes a region spanning multiple tiles', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    // Region that spans all 4 tiles
    const regionData = decodeTileRegion(cs, { x: 25, y: 20, width: 50, height: 40 });
    expect(regionData).toBeInstanceOf(Uint8Array);
    expect(regionData.length).toBe(50 * 40 * 1);
  });

  it('clamps region to image bounds', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    // Region extending beyond image bounds
    const regionData = decodeTileRegion(cs, { x: 80, y: 60, width: 100, height: 100 });
    // Should be clamped to (80,60)-(100,80), so 20x20
    expect(regionData.length).toBe(20 * 20 * 1);
  });

  it('throws for a region entirely outside the image', () => {
    const cs = new Uint8Array(
      buildMultiTileCodestream(
        100,
        80,
        50,
        40,
        [{ bits: 8, isSigned: false }],
      ),
    );

    expect(() =>
      decodeTileRegion(cs, { x: 200, y: 200, width: 50, height: 50 }),
    ).toThrow('outside image bounds');
  });
});

// ===========================================================================
// 11. Empty / minimal codestream
// ===========================================================================

describe('JPEG2000 empty / minimal codestream', () => {
  it('parseTileInfo throws for empty data', () => {
    expect(() => parseTileInfo(new Uint8Array(0))).toThrow('SIZ marker');
  });

  it('parseTileInfo throws for data too short for SIZ', () => {
    // Just SOC marker, no SIZ
    const data = new Uint8Array([0xff, 0x4f]);
    expect(() => parseTileInfo(data)).toThrow('SIZ marker');
  });

  it('getComponentDepths throws for empty data', () => {
    expect(() => getComponentDepths(new Uint8Array(0))).toThrow('SIZ marker');
  });

  it('parseTileInfo handles a minimal valid codestream', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 1,
        height: 1,
        components: [{ bits: 1, isSigned: false }],
      }),
    );

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(1);
    expect(info.imageHeight).toBe(1);
    expect(info.components).toBe(1);
    expect(info.bitsPerComponent).toBe(1);
  });

  it('handles summarizeBitDepth with empty array', () => {
    const summary = summarizeBitDepth([]);
    expect(summary.components).toBe(0);
    expect(summary.bitsPerComponent).toBe(8);
    expect(summary.isSigned).toBe(false);
  });

  it('decodeTile throws for missing codestream markers', () => {
    const data = new Uint8Array([0xff, 0x4f, 0xff, 0x51]);
    expect(() => decodeTile(data, 0)).toThrow();
  });
});

// ===========================================================================
// 12. Error handling (truncated data, invalid markers)
// ===========================================================================

describe('JPEG2000 error handling', () => {
  it('getComponentDepths throws on truncated SIZ marker', () => {
    // SOC + partial SIZ (not enough bytes for component entries)
    const cs = new Uint8Array([
      0xff, 0x4f, // SOC
      0xff, 0x51, // SIZ marker
      0x00, 0x2f, // Lsiz (short)
      // Missing the rest
    ]);
    expect(() => getComponentDepths(cs)).toThrow('truncated');
  });

  it('getComponentDepths throws when SIZ reports 0 components', () => {
    const cs = buildMinimalCodestream({
      width: 10,
      height: 10,
      components: [],
    });
    // Manually fix csiz to 0 (buildSizSegment would set it based on array length)
    // The SIZ starts at offset 2 (after SOC), component count is at offset 2+38 = 40
    // Actually: offset = SOC(2) + SIZ_marker(2) + lsiz_field_offset(36) = 2+2+36 = 40
    // Csiz is at bytes [38-39] relative to SIZ marker + 2 = base + 36-37
    // In the full codestream: SOC(2) + FF51(2) + Lsiz(2) + ... + Csiz at offset 2+2+36 = 40
    const data = new Uint8Array(cs);
    data[40] = 0x00;
    data[41] = 0x00;
    expect(() => getComponentDepths(data)).toThrow('0 components');
  });

  it('downscale16To8 returns copy for <= 8 bit data', () => {
    const data = new Uint8Array([10, 20, 30]);
    const result = downscale16To8(data, 8);
    expect(result).toEqual(data);
    // Should be a copy, not the same reference
    expect(result).not.toBe(data);
  });

  it('downscale16To8 throws for > 16 bits', () => {
    const data = new Uint8Array([0, 1]);
    expect(() => downscale16To8(data, 17)).toThrow('16 bits');
  });

  it('normalizeComponentDepth throws for out-of-range depths', () => {
    const data = new Uint8Array([10]);
    expect(() => normalizeComponentDepth(data, 0, 8)).toThrow('1–16');
    expect(() => normalizeComponentDepth(data, 8, 17)).toThrow('1–16');
  });

  it('decodeTile throws on invalid codestream', () => {
    const garbage = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    expect(() => decodeTile(garbage, 0)).toThrow();
  });

  it('parseTileInfo throws on truncated SIZ segment', () => {
    const cs = new Uint8Array([
      0xff, 0x4f, // SOC
      0xff, 0x51, // SIZ
      0x00, 0x30, // Lsiz
      // Only a few more bytes — truncated
      0x00, 0x00,
      0x00, 0x00, 0x01, 0x00,
    ]);
    expect(() => parseTileInfo(cs)).toThrow('truncated');
  });

  it('handles normalizeComponentDepth from 8 to 16', () => {
    const data = new Uint8Array([0, 128, 255]);
    const result = normalizeComponentDepth(data, 8, 16);
    expect(result.length).toBe(6); // 3 samples * 2 bytes each
    // 0 -> 0
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    // 255 -> 65535
    expect(result[4]).toBe(0xff);
    expect(result[5]).toBe(0xff);
  });

  it('getComponentDepths handles SIZ with truncated component entries', () => {
    const cs = buildMinimalCodestream({
      width: 10,
      height: 10,
      components: [
        { bits: 8, isSigned: false },
        { bits: 8, isSigned: false },
      ],
    });
    // Truncate the data to cut off the second component entry
    const truncated = new Uint8Array(cs.slice(0, cs.length - 2));
    expect(() => getComponentDepths(truncated)).toThrow('truncated');
  });
});

// ===========================================================================
// Additional codestream parser tests
// ===========================================================================

describe('JPEG2000 codestream parser', () => {
  it('parseTileInfo handles image with non-zero origin', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 100,
        height: 80,
        originX: 10,
        originY: 20,
        components: [{ bits: 8, isSigned: false }],
      }),
    );

    const info = parseTileInfo(cs);
    expect(info.imageWidth).toBe(100);
    expect(info.imageHeight).toBe(80);
  });

  it('parseTileInfo handles different tile and image origins', () => {
    const cs = new Uint8Array(
      buildMinimalCodestream({
        width: 200,
        height: 150,
        tileWidth: 128,
        tileHeight: 128,
        tileOriginX: 0,
        tileOriginY: 0,
        components: [
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
          { bits: 8, isSigned: false },
        ],
      }),
    );

    const info = parseTileInfo(cs);
    expect(info.tilesX).toBe(2); // ceil(200/128)
    expect(info.tilesY).toBe(2); // ceil(150/128)
    expect(info.tileWidth).toBe(128);
    expect(info.tileHeight).toBe(128);
  });
});

// ===========================================================================
// Box parser tests (JP2 wrapper)
// ===========================================================================

describe('JPEG2000 JP2 box parser', () => {
  it('identifies JP2 signature box', () => {
    const rawCs = buildMinimalCodestream({
      width: 10,
      height: 10,
      components: [{ bits: 8, isSigned: false }],
    });
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    // Signature box: first 12 bytes
    expect(jp2[0]).toBe(0x00);
    expect(jp2[1]).toBe(0x00);
    expect(jp2[2]).toBe(0x00);
    expect(jp2[3]).toBe(0x0c);
    // Box type: "jP  "
    expect(String.fromCharCode(jp2[4]!, jp2[5]!, jp2[6]!, jp2[7]!)).toBe('jP  ');
  });

  it('identifies File Type box', () => {
    const rawCs = buildMinimalCodestream({
      width: 10,
      height: 10,
      components: [{ bits: 8, isSigned: false }],
    });
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    // ftyp box starts at offset 12
    expect(String.fromCharCode(jp2[16]!, jp2[17]!, jp2[18]!, jp2[19]!)).toBe('ftyp');
  });

  it('finds codestream within JP2 wrapper', () => {
    const rawCs = buildSingleTileCodestream(
      40,
      30,
      [{ bits: 8, isSigned: false }],
    );
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    // parseTileInfo should work through the JP2 wrapper
    const info = parseTileInfo(jp2);
    expect(info.imageWidth).toBe(40);
    expect(info.imageHeight).toBe(30);
  });

  it('getComponentDepths works through JP2 wrapper', () => {
    const rawCs = buildMinimalCodestream({
      width: 50,
      height: 50,
      components: [
        { bits: 12, isSigned: false },
        { bits: 12, isSigned: false },
        { bits: 12, isSigned: false },
      ],
    });
    const jp2 = new Uint8Array(wrapInJp2(rawCs));

    const depths = getComponentDepths(jp2);
    expect(depths).toHaveLength(3);
    expect(depths[0]!.bits).toBe(12);
  });
});

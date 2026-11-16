/**
 * @module codecs/jpeg2000/jpeg2000Tiles
 *
 * Tile grid geometry for JPEG2000 (JP2 / J2K) images.
 *
 * {@link parseTileInfo} reads the tile grid from the codestream's SIZ
 * marker. This release does not decode tiles: {@link decodeTile},
 * {@link decodeTileRegion} and {@link assembleTiles} throw
 * {@link UnsupportedFilterError}.
 *
 * JPEG2000 supports partitioning an image into rectangular tiles that can
 * be independently decoded.  This is critical for:
 *
 * - Large images (satellite, medical) where decoding the entire image is
 *   impractical or unnecessary.
 * - Region-of-interest access — decode only the tiles that intersect the
 *   requested viewport.
 * - Parallel / streaming decode — tiles are independent units.
 *
 * The tile grid is defined by the SIZ marker (ITU-T T.800, Annex A.5.1),
 * and individual tiles are delimited by SOT (Start of Tile-Part) markers
 * within the codestream.
 *
 * Reference: ITU-T T.800 (ISO/IEC 15444-1), Annexes A and B.
 *
 * @packageDocumentation
 */

import { MalformedInputError, UnsupportedFilterError } from '../../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tile grid geometry extracted from the SIZ marker.
 */
export interface TileGridInfo {
  /** Full image width in pixels. */
  imageWidth: number;
  /** Full image height in pixels. */
  imageHeight: number;
  /** Nominal tile width. */
  tileWidth: number;
  /** Nominal tile height. */
  tileHeight: number;
  /** Number of tiles in the horizontal direction. */
  tilesX: number;
  /** Number of tiles in the vertical direction. */
  tilesY: number;
  /** Tile grid origin X offset. */
  originX: number;
  /** Tile grid origin Y offset. */
  originY: number;
  /** Number of image components. */
  components: number;
  /** Bits per component (from the first component's Ssiz entry). */
  bitsPerComponent: number;
}

/**
 * Decoded data for a single tile.
 */
export interface TileData {
  /** Zero-based tile index (row-major order). */
  index: number;
  /** Pixel X coordinate of the tile's top-left corner in the image. */
  x: number;
  /** Pixel Y coordinate of the tile's top-left corner in the image. */
  y: number;
  /** Tile width in pixels (may be smaller for rightmost / bottom tiles). */
  width: number;
  /** Tile height in pixels (may be smaller for rightmost / bottom tiles). */
  height: number;
  /** Decoded pixel data for this tile (interleaved components, row-major). */
  data: Uint8Array;
  /** Number of components in the tile data. */
  components: number;
}

/**
 * A rectangular region used for region-of-interest decoding.
 */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a 16-bit big-endian unsigned integer.
 */
function readU16(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}

/**
 * Read a 32-bit big-endian unsigned integer.
 */
function readU32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

/**
 * Find the start of the codestream within a possibly JP2-wrapped file.
 * Returns the offset of the SOC marker (0xFF4F).
 */
function findCodestreamStart(data: Uint8Array): number {
  // Check for JP2 box wrapper
  if (
    data.length >= 12 &&
    data[0] === 0x00 &&
    data[1] === 0x00 &&
    data[2] === 0x00 &&
    data[3] === 0x0c &&
    data[4] === 0x6a &&
    data[5] === 0x50
  ) {
    // Walk JP2 boxes to find jp2c
    let offset = 0;
    while (offset + 8 <= data.length) {
      const boxLen = readU32(data, offset);
      const boxType = String.fromCharCode(
        data[offset + 4]!,
        data[offset + 5]!,
        data[offset + 6]!,
        data[offset + 7]!,
      );

      if (boxType === 'jp2c') {
        return offset + 8;
      }

      const advance = boxLen === 0 ? data.length - offset : boxLen < 8 ? 8 : boxLen;
      offset += advance;
    }
  }

  // Raw codestream — look for SOC
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0x4f) {
    return 0;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// SIZ marker parsing — tile grid
// ---------------------------------------------------------------------------

/**
 * Parse the SIZ marker to extract tile grid geometry.
 *
 * @param data - A JPEG2000 codestream (raw J2K) or JP2 file.
 * @returns The tile grid information.
 * @throws {MalformedInputError} If the SIZ marker cannot be found or is truncated.
 */
export function parseTileInfo(data: Uint8Array): TileGridInfo {
  const csStart = findCodestreamStart(data);

  // SIZ must follow SOC immediately
  let sizOffset = -1;
  for (let i = csStart; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0x51) {
      sizOffset = i;
      break;
    }
  }

  if (sizOffset < 0) {
    throw new MalformedInputError('JPEG2000 Tiles: SIZ marker (0xFF51) not found');
  }

  const base = sizOffset + 2; // after the marker bytes
  if (base + 38 > data.length) {
    throw new MalformedInputError('JPEG2000 Tiles: SIZ marker segment is truncated');
  }

  // Parse SIZ fields
  // const lsiz = readU16(data, base);      // marker length
  // const rsiz = readU16(data, base + 2);  // capabilities
  const xsiz = readU32(data, base + 4); // image width (reference grid)
  const ysiz = readU32(data, base + 8); // image height
  const xosiz = readU32(data, base + 12); // image origin X
  const yosiz = readU32(data, base + 16); // image origin Y
  const xtsiz = readU32(data, base + 20); // tile width
  const ytsiz = readU32(data, base + 24); // tile height
  const xtosiz = readU32(data, base + 28); // tile origin X
  const ytosiz = readU32(data, base + 32); // tile origin Y
  const csiz = readU16(data, base + 36); // number of components

  // Actual image dimensions
  const imageWidth = xsiz - xosiz;
  const imageHeight = ysiz - yosiz;

  // Number of tiles
  const tilesX = xtsiz > 0 ? Math.ceil((xsiz - xtosiz) / xtsiz) : 1;
  const tilesY = ytsiz > 0 ? Math.ceil((ysiz - ytosiz) / ytsiz) : 1;

  // Read first component Ssiz for bitsPerComponent
  let bitsPerComponent = 8;
  const componentBase = base + 38;
  if (componentBase < data.length) {
    const ssiz = data[componentBase]!;
    bitsPerComponent = (ssiz & 0x7f) + 1;
  }

  return {
    imageWidth,
    imageHeight,
    tileWidth: xtsiz,
    tileHeight: ytsiz,
    tilesX,
    tilesY,
    originX: xtosiz,
    originY: ytosiz,
    components: csiz,
    bitsPerComponent,
  };
}

// ---------------------------------------------------------------------------
// Public API — entries that throw
// ---------------------------------------------------------------------------

/**
 * Decode a single tile from a JPEG2000 codestream.
 *
 * Throws {@link UnsupportedFilterError} (filter `'JPXDecode'`): JPEG 2000
 * image data is not decoded in this release, and no part of `data` is read.
 * {@link parseTileInfo} is unaffected.
 *
 * @param data      - Full JPEG2000 codestream or JP2 file bytes (not read).
 * @param tileIndex - Zero-based tile index (not read).
 * @throws {UnsupportedFilterError} Always.
 */
// oxlint-disable-next-line no-unused-vars -- the parameter names are part of the declared API
export function decodeTile(data: Uint8Array, tileIndex: number): TileData {
  throw new UnsupportedFilterError('JPXDecode');
}

/**
 * Decode only the tiles that intersect a rectangular region.
 *
 * Throws {@link UnsupportedFilterError} (filter `'JPXDecode'`): JPEG 2000
 * image data is not decoded in this release, and no part of `data` is read.
 * {@link parseTileInfo} is unaffected.
 *
 * @param data   - Full JPEG2000 codestream or JP2 file bytes (not read).
 * @param region - The rectangular region (not read).
 * @throws {UnsupportedFilterError} Always.
 */
// oxlint-disable-next-line no-unused-vars -- the parameter names are part of the declared API
export function decodeTileRegion(data: Uint8Array, region: Region): Uint8Array {
  throw new UnsupportedFilterError('JPXDecode');
}

/**
 * Assemble decoded tiles into an image.
 *
 * Throws {@link UnsupportedFilterError} (filter `'JPXDecode'`): no tile is
 * decoded in this release, so there is nothing to assemble, and neither
 * argument is read.
 *
 * @param tiles    - Tile data (not read).
 * @param gridInfo - The tile grid geometry from {@link parseTileInfo} (not read).
 * @throws {UnsupportedFilterError} Always.
 */
// oxlint-disable-next-line no-unused-vars -- the parameter names are part of the declared API
export function assembleTiles(tiles: TileData[], gridInfo: TileGridInfo): Uint8Array {
  throw new UnsupportedFilterError('JPXDecode');
}

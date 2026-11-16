/**
 * @module assets/image/tiff/tiffDirectEmbed
 *
 * Direct TIFF-to-PDF strip/tile mapping for efficient embedding.
 *
 * For certain TIFF compression types, the image data can be mapped
 * directly into a PDF image XObject without a full decode-re-encode
 * cycle:
 *
 * - **Uncompressed TIFF**: Raw pixel data is used directly with no filter.
 * - **Deflate-compressed TIFF**: Strips/tiles can be passed through as
 *   FlateDecode streams.
 * - **JPEG-in-TIFF**: The embedded JPEG data is extracted and used
 *   directly as a DCTDecode stream.
 *
 * This avoids the overhead of decompressing and recompressing image data,
 * resulting in faster processing and no quality loss.
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

import { assertWithinLimit } from '../../../internal/limits.js';
import {
  InvalidArgumentError,
  MalformedInputError,
  UnsupportedFeatureError,
} from '../../../errors.js';

// ---------------------------------------------------------------------------
// TIFF tag and compression constants
// ---------------------------------------------------------------------------

/** Tag 256: ImageWidth. */
const TAG_IMAGE_WIDTH = 256;

/** Tag 257: ImageLength (height). */
const TAG_IMAGE_LENGTH = 257;

/** Tag 258: BitsPerSample. */
const TAG_BITS_PER_SAMPLE = 258;

/** Tag 259: Compression. */
const TAG_COMPRESSION = 259;

/** Tag 262: PhotometricInterpretation. */
const TAG_PHOTOMETRIC = 262;

/** Tag 273: StripOffsets. */
const TAG_STRIP_OFFSETS = 273;

/** Tag 277: SamplesPerPixel. */
const TAG_SAMPLES_PER_PIXEL = 277;

/** Tag 279: StripByteCounts. */
const TAG_STRIP_BYTE_COUNTS = 279;

/** Tag 513: JPEGInterchangeFormat (for old-style JPEG). */
const TAG_JPEG_OFFSET = 513;

/** Tag 514: JPEGInterchangeFormatLength. */
const TAG_JPEG_LENGTH = 514;

/** Tag 324: TileOffsets. */
const TAG_TILE_OFFSETS = 324;

/** Tag 325: TileByteCounts. */
const TAG_TILE_BYTE_COUNTS = 325;

/** Tag 322: TileWidth. */
const TAG_TILE_WIDTH = 322;

/** Tag 323: TileLength. */
const TAG_TILE_LENGTH = 323;

/** Compression 1: No compression. */
const COMPRESSION_NONE = 1;

/** Compression 7: JPEG (new-style). */
const COMPRESSION_JPEG = 7;

/** Compression 8: Deflate (Adobe). */
const COMPRESSION_DEFLATE = 8;

/** Compression 32946: Deflate (PKZIP). */
const COMPRESSION_DEFLATE_PKZIP = 32946;

/** Compression 6: Old-style JPEG. */
const COMPRESSION_OLD_JPEG = 6;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Options for direct TIFF embedding.
 */
export interface DirectEmbedOptions {
  /** Page index for multi-page TIFFs (0-based). Default: 0. */
  page?: number | undefined;
}

/**
 * Result of a direct TIFF embedding operation.
 */
export interface DirectEmbedResult {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** The image data for the PDF stream. */
  readonly data: Uint8Array;
  /** PDF color space name (e.g. 'DeviceRGB', 'DeviceGray', 'DeviceCMYK'). */
  readonly colorSpace: string;
  /** Bits per component (1, 2, 4, 8, or 16). */
  readonly bitsPerComponent: number;
  /** PDF filter to use, if any (e.g. 'FlateDecode', 'DCTDecode'). */
  readonly filter?: string | undefined;
}

// ---------------------------------------------------------------------------
// Internal: IFD parsing
// ---------------------------------------------------------------------------

/**
 * Parsed IFD entry.
 * @internal
 */
interface IfdEntry {
  readonly tag: number;
  readonly type: number;
  readonly count: number;
  readonly valueOrOffset: number;
}

/**
 * Determine if the TIFF is little-endian.
 * @internal
 */
function isLittleEndian(data: Uint8Array): boolean {
  return data[0] === 0x49 && data[1] === 0x49;
}

/**
 * Shared DataView instance, created lazily per data buffer.
 * @internal
 */
let _cachedView: DataView | undefined;
let _cachedBuffer: ArrayBufferLike | undefined;

function getView(data: Uint8Array): DataView {
  if (_cachedBuffer !== data.buffer) {
    _cachedView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    _cachedBuffer = data.buffer;
  }
  return _cachedView!;
}

/**
 * Read a 16-bit unsigned integer.
 * @internal
 */
function readU16(data: Uint8Array, offset: number, le: boolean): number {
  return getView(data).getUint16(offset, le);
}

/**
 * Read a 32-bit unsigned integer.
 * @internal
 */
function readU32(data: Uint8Array, offset: number, le: boolean): number {
  return getView(data).getUint32(offset, le);
}

/**
 * Parse IFD entries at the given offset.
 * @internal
 */
function parseIfd(data: Uint8Array, offset: number, le: boolean): IfdEntry[] {
  const count = readU16(data, offset, le);
  const entries: IfdEntry[] = [];

  for (let i = 0; i < count; i++) {
    const entryOffset = offset + 2 + i * 12;
    if (entryOffset + 12 > data.length) break;

    const tag = readU16(data, entryOffset, le);
    const type = readU16(data, entryOffset + 2, le);
    const cnt = readU32(data, entryOffset + 4, le);
    const valueOrOffset = readU32(data, entryOffset + 8, le);

    entries.push({ tag, type, count: cnt, valueOrOffset });
  }

  return entries;
}

/**
 * Read tag value (short or long) from an IFD entry.
 * @internal
 */
function readTagValue(data: Uint8Array, entry: IfdEntry, _le: boolean): number {
  // SHORT (type 3): 2 bytes, LONG (type 4): 4 bytes
  if (entry.count === 1) {
    if (entry.type === 3) {
      // SHORT value is stored in the first 2 bytes of the value field
      return entry.valueOrOffset & 0xffff;
    }
    return entry.valueOrOffset;
  }
  return entry.valueOrOffset;
}

/**
 * Read an array of offset values (LONG or SHORT) from a tag.
 *
 * @throws {MalformedInputError} `TIFF: tag data out of bounds` when a tag with more than
 *   one value stores them past the end of the file.
 * @internal
 */
function readOffsetArray(data: Uint8Array, entry: IfdEntry, le: boolean): number[] {
  const values: number[] = [];

  if (entry.count === 1) {
    if (entry.type === 3) {
      values.push(entry.valueOrOffset & 0xffff);
    } else {
      values.push(entry.valueOrOffset);
    }
    return values;
  }

  // For count > 1, the value field is an offset to the data
  const offset = entry.valueOrOffset;
  const elementSize = entry.type === 3 ? 2 : 4;

  // The whole array must lie inside the file; its length is read before the values are.
  if (offset + entry.count * elementSize > data.length) {
    throw new MalformedInputError('TIFF: tag data out of bounds', { format: 'tiff' });
  }

  for (let i = 0; i < entry.count; i++) {
    const pos = offset + i * elementSize;
    if (entry.type === 3) {
      values.push(readU16(data, pos, le));
    } else {
      values.push(readU32(data, pos, le));
    }
  }

  return values;
}

/**
 * Navigate to the Nth IFD (for multi-page TIFFs).
 * @internal
 */
function findIfdOffset(data: Uint8Array, le: boolean, page: number): number {
  let ifdOffset = readU32(data, 4, le);

  for (let i = 0; i < page; i++) {
    if (ifdOffset === 0 || ifdOffset + 2 > data.length) {
      throw new InvalidArgumentError(`TIFF page ${page} not found (only ${i} pages available)`, {
        argument: 'options.page',
      });
    }
    const entryCount = readU16(data, ifdOffset, le);
    const nextIfdOffset = ifdOffset + 2 + entryCount * 12;
    if (nextIfdOffset + 4 > data.length) {
      throw new InvalidArgumentError(
        `TIFF page ${page} not found (only ${i + 1} pages available)`,
        { argument: 'options.page' },
      );
    }
    ifdOffset = readU32(data, nextIfdOffset, le);
    if (ifdOffset === 0) {
      throw new InvalidArgumentError(
        `TIFF page ${page} not found (only ${i + 1} pages available)`,
        { argument: 'options.page' },
      );
    }
  }

  return ifdOffset;
}

/**
 * Get tag value from entries by tag number.
 * @internal
 */
function getTag(
  entries: IfdEntry[],
  tag: number,
  data: Uint8Array,
  le: boolean,
): number | undefined {
  const entry = entries.find((e) => e.tag === tag);
  if (!entry) return undefined;
  return readTagValue(data, entry, le);
}

/**
 * Get tag entry by tag number.
 * @internal
 */
function getTagEntry(entries: IfdEntry[], tag: number): IfdEntry | undefined {
  return entries.find((e) => e.tag === tag);
}

/**
 * Determine the PDF color space from TIFF tags.
 * @internal
 */
function getColorSpace(photometric: number, samplesPerPixel: number): string {
  switch (photometric) {
    case 0: // WhiteIsZero (grayscale)
    case 1: // BlackIsZero (grayscale)
      return 'DeviceGray';
    case 2: // RGB
      return 'DeviceRGB';
    case 5: // Separated (CMYK)
      return 'DeviceCMYK';
    default:
      if (samplesPerPixel === 1) return 'DeviceGray';
      if (samplesPerPixel === 3) return 'DeviceRGB';
      if (samplesPerPixel === 4) return 'DeviceCMYK';
      return 'DeviceRGB';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a TIFF file can be directly embedded in PDF without
 * a full decode-re-encode cycle.
 *
 * Direct embedding is supported for:
 * - Uncompressed TIFFs (compression = 1)
 * - Deflate-compressed TIFFs (compression = 8 or 32946)
 * - JPEG-in-TIFF (compression = 7 or 6)
 *
 * @param data  Raw TIFF file bytes.
 * @returns     `true` if the TIFF can be directly embedded.
 */
export function canDirectEmbed(data: Uint8Array): boolean {
  if (data.length < 8) return false;

  // Validate TIFF header
  const isLE = data[0] === 0x49 && data[1] === 0x49;
  const isBE = data[0] === 0x4d && data[1] === 0x4d;
  if (!isLE && !isBE) return false;

  const le = isLE;
  const magic = readU16(data, 2, le);
  if (magic !== 42) return false;

  const ifdOffset = readU32(data, 4, le);
  if (ifdOffset === 0 || ifdOffset + 2 > data.length) return false;

  const entries = parseIfd(data, ifdOffset, le);
  const compression = getTag(entries, TAG_COMPRESSION, data, le) ?? 1;

  return (
    compression === COMPRESSION_NONE ||
    compression === COMPRESSION_DEFLATE ||
    compression === COMPRESSION_DEFLATE_PKZIP ||
    compression === COMPRESSION_JPEG ||
    compression === COMPRESSION_OLD_JPEG
  );
}

/**
 * Directly embed a TIFF image in a PDF image XObject.
 *
 * For supported compression types, this avoids the decode-re-encode
 * cycle by mapping TIFF strips/tiles directly to PDF stream data:
 *
 * - **Uncompressed**: Raw pixel data used with no filter.
 * - **Deflate**: Compressed data passed through as FlateDecode.
 * - **JPEG-in-TIFF**: JPEG data extracted and used as DCTDecode.
 *
 * @param data     Raw TIFF file bytes.
 * @param options  Optional settings (page index for multi-page TIFFs).
 * @returns        The embedding result with all data needed for a PDF image XObject.
 * @throws {UnsupportedFeatureError} If the TIFF format does not support direct embedding.
 * @throws {ResourceLimitError} `maxImageDimension` when the width or height is above 65,536;
 *   `maxImagePixels` when width times height is above 2^28; `maxImageBytes` when the strips or
 *   tiles together are above 256 MiB.
 * @throws {MalformedInputError} `TIFF: tile width and length must be positive multiples of 16` for a tiled
 *   image whose tile sides are not.
 */
export function embedTiffDirect(data: Uint8Array, options?: DirectEmbedOptions): DirectEmbedResult {
  if (data.length < 8) {
    throw new MalformedInputError('TIFF data too short', { format: 'tiff' });
  }

  // Validate header
  const le = isLittleEndian(data);
  const magic = readU16(data, 2, le);
  if (magic !== 42) {
    throw new MalformedInputError('Invalid TIFF: bad magic number', { format: 'tiff' });
  }

  const page = options?.page ?? 0;
  const ifdOffset = findIfdOffset(data, le, page);
  const entries = parseIfd(data, ifdOffset, le);

  // Read essential tags
  const width = getTag(entries, TAG_IMAGE_WIDTH, data, le);
  const height = getTag(entries, TAG_IMAGE_LENGTH, data, le);
  const bitsPerSample = getTag(entries, TAG_BITS_PER_SAMPLE, data, le) ?? 8;
  const compression = getTag(entries, TAG_COMPRESSION, data, le) ?? 1;
  const photometric = getTag(entries, TAG_PHOTOMETRIC, data, le) ?? 2;
  const samplesPerPixel = getTag(entries, TAG_SAMPLES_PER_PIXEL, data, le) ?? 1;

  if (width === undefined || height === undefined) {
    throw new MalformedInputError('Invalid TIFF: missing width or height tags', { format: 'tiff' });
  }

  // The sizes the tags state are checked before anything is allocated or looped over from them.
  assertWithinLimit('maxImageDimension', width);
  assertWithinLimit('maxImageDimension', height);
  assertWithinLimit('maxImagePixels', width * height);

  const colorSpace = getColorSpace(photometric, samplesPerPixel);

  // Handle JPEG-in-TIFF
  if (compression === COMPRESSION_JPEG || compression === COMPRESSION_OLD_JPEG) {
    return embedJpegInTiff(data, entries, le, width, height, bitsPerSample, colorSpace);
  }

  // Handle strip-based or tile-based images
  const tileWidthEntry = getTagEntry(entries, TAG_TILE_WIDTH);
  const isTiled = tileWidthEntry !== undefined;

  let imageData: Uint8Array;

  if (isTiled) {
    imageData = extractTiles(data, entries, le, width, height, samplesPerPixel, bitsPerSample);
  } else {
    imageData = extractStrips(data, entries, le, width, height, samplesPerPixel, bitsPerSample);
  }

  // Determine filter
  let filter: string | undefined;
  if (compression === COMPRESSION_DEFLATE || compression === COMPRESSION_DEFLATE_PKZIP) {
    filter = 'FlateDecode';
  }

  return {
    width,
    height,
    data: imageData,
    colorSpace,
    bitsPerComponent: bitsPerSample,
    filter,
  };
}

// ---------------------------------------------------------------------------
// Internal: strip extraction
// ---------------------------------------------------------------------------

/**
 * Extract and concatenate strip data.
 * @internal
 */
function extractStrips(
  data: Uint8Array,
  entries: IfdEntry[],
  le: boolean,
  _width: number,
  _height: number,
  _samplesPerPixel: number,
  _bitsPerSample: number,
): Uint8Array {
  const offsetEntry = getTagEntry(entries, TAG_STRIP_OFFSETS);
  const countEntry = getTagEntry(entries, TAG_STRIP_BYTE_COUNTS);

  if (!offsetEntry || !countEntry) {
    throw new MalformedInputError('Invalid TIFF: missing StripOffsets or StripByteCounts tags', {
      format: 'tiff',
    });
  }

  const offsets = readOffsetArray(data, offsetEntry, le);
  const counts = readOffsetArray(data, countEntry, le);

  if (offsets.length !== counts.length) {
    throw new MalformedInputError('TIFF strip offset/count mismatch', { format: 'tiff' });
  }

  const result = new Uint8Array(sumStripBytes(data, offsets, counts));
  let pos = 0;

  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i]!;
    const count = counts[i]!;
    result.set(data.subarray(offset, offset + count), pos);
    pos += count;
  }

  return result;
}

/**
 * Checks every strip or tile against the file and returns the total bytes.
 * Called before the output buffer exists.
 *
 * @throws {MalformedInputError} `TIFF: strip data out of bounds` when a strip or tile
 *   extends past the end of the file.
 * @throws {ResourceLimitError} `maxImageBytes` when the total is above 256 MiB.
 * @internal
 */
function sumStripBytes(data: Uint8Array, offsets: number[], counts: number[]): number {
  let total = 0;
  for (let i = 0; i < offsets.length; i++) {
    const count = counts[i] ?? 0;
    if ((offsets[i] ?? 0) + count > data.length) {
      throw new MalformedInputError('TIFF: strip data out of bounds', { format: 'tiff' });
    }
    total += count;
    assertWithinLimit('maxImageBytes', total);
  }
  return total;
}

/**
 * Extract and reassemble tile data into a contiguous image buffer.
 * @internal
 */
function extractTiles(
  data: Uint8Array,
  entries: IfdEntry[],
  le: boolean,
  width: number,
  height: number,
  samplesPerPixel: number,
  bitsPerSample: number,
): Uint8Array {
  const offsetEntry = getTagEntry(entries, TAG_TILE_OFFSETS);
  const countEntry = getTagEntry(entries, TAG_TILE_BYTE_COUNTS);
  const tileWidth = getTag(entries, TAG_TILE_WIDTH, data, le);
  const tileHeight = getTag(entries, TAG_TILE_LENGTH, data, le);

  if (!offsetEntry || !countEntry || tileWidth === undefined || tileHeight === undefined) {
    throw new MalformedInputError('Invalid TIFF: missing tile tags', { format: 'tiff' });
  }

  // TIFF 6.0 requires the tile sides to be multiples of 16; a side of 0 or a small one would make
  // the tile loop below copy the image a row, or a pixel, at a time.
  if (!(tileWidth >= 16 && tileHeight >= 16 && tileWidth % 16 === 0 && tileHeight % 16 === 0)) {
    throw new MalformedInputError('TIFF: tile width and length must be positive multiples of 16', {
      format: 'tiff',
    });
  }

  const offsets = readOffsetArray(data, offsetEntry, le);
  const counts = readOffsetArray(data, countEntry, le);

  // For direct embedding with Deflate tiles, just concatenate
  // (the PDF reader handles decompression per the filter setting).
  // For uncompressed tiles, we need to reassemble into scanline order.
  const compression = getTag(entries, TAG_COMPRESSION, data, le) ?? 1;

  if (compression === COMPRESSION_DEFLATE || compression === COMPRESSION_DEFLATE_PKZIP) {
    // Concatenate compressed tiles
    if (offsets.length !== counts.length) {
      throw new MalformedInputError('TIFF tile offset/count mismatch', { format: 'tiff' });
    }
    const result = new Uint8Array(sumStripBytes(data, offsets, counts));
    let pos = 0;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i]!;
      const count = counts[i]!;
      result.set(data.subarray(offset, offset + count), pos);
      pos += count;
    }
    return result;
  }

  // Uncompressed tiles: reassemble into scanline order
  const bytesPerPixel = Math.ceil((samplesPerPixel * bitsPerSample) / 8);
  const rowBytes = width * bytesPerPixel;
  assertWithinLimit('maxImageBytes', height * rowBytes);
  const result = new Uint8Array(height * rowBytes);

  const tilesAcross = Math.ceil(width / tileWidth);

  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i]!;
    const tileX = (i % tilesAcross) * tileWidth;
    const tileY = Math.floor(i / tilesAcross) * tileHeight;

    const actualTileW = Math.min(tileWidth, width - tileX);
    const actualTileH = Math.min(tileHeight, height - tileY);

    for (let row = 0; row < actualTileH; row++) {
      const srcOffset = offset + row * tileWidth * bytesPerPixel;
      const dstOffset = (tileY + row) * rowBytes + tileX * bytesPerPixel;
      const copyBytes = actualTileW * bytesPerPixel;

      if (srcOffset + copyBytes <= data.length) {
        result.set(data.subarray(srcOffset, srcOffset + copyBytes), dstOffset);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: JPEG-in-TIFF extraction
// ---------------------------------------------------------------------------

/**
 * Extract JPEG data from a JPEG-in-TIFF file.
 * @internal
 */
function embedJpegInTiff(
  data: Uint8Array,
  entries: IfdEntry[],
  le: boolean,
  width: number,
  height: number,
  bitsPerSample: number,
  colorSpace: string,
): DirectEmbedResult {
  // Try old-style JPEG (tags 513/514)
  const jpegOffset = getTag(entries, TAG_JPEG_OFFSET, data, le);
  const jpegLength = getTag(entries, TAG_JPEG_LENGTH, data, le);

  if (jpegOffset !== undefined && jpegLength !== undefined && jpegLength > 0) {
    if (jpegOffset + jpegLength > data.length) {
      throw new MalformedInputError('TIFF JPEG data extends beyond file', { format: 'tiff' });
    }

    const jpegData = data.subarray(jpegOffset, jpegOffset + jpegLength);

    return {
      width,
      height,
      data: jpegData,
      colorSpace,
      bitsPerComponent: bitsPerSample,
      filter: 'DCTDecode',
    };
  }

  // New-style JPEG: extract from strips
  const offsetEntry = getTagEntry(entries, TAG_STRIP_OFFSETS);
  const countEntry = getTagEntry(entries, TAG_STRIP_BYTE_COUNTS);

  if (!offsetEntry || !countEntry) {
    // Try tile-based JPEG
    const tileOffsetEntry = getTagEntry(entries, TAG_TILE_OFFSETS);
    const tileCountEntry = getTagEntry(entries, TAG_TILE_BYTE_COUNTS);

    if (!tileOffsetEntry || !tileCountEntry) {
      throw new MalformedInputError('TIFF JPEG: cannot find strip or tile data', {
        format: 'tiff',
      });
    }

    const offsets = readOffsetArray(data, tileOffsetEntry, le);
    const counts = readOffsetArray(data, tileCountEntry, le);

    if (offsets.length === 1) {
      const offset = offsets[0]!;
      const count = counts[0]!;
      if (offset + count > data.length) {
        throw new MalformedInputError('TIFF JPEG tile data extends beyond file', {
          format: 'tiff',
        });
      }
      return {
        width,
        height,
        data: data.subarray(offset, offset + count),
        colorSpace,
        bitsPerComponent: bitsPerSample,
        filter: 'DCTDecode',
      };
    }

    throw new UnsupportedFeatureError(
      'TIFF JPEG with multiple tiles is not supported for direct embedding',
    );
  }

  const offsets = readOffsetArray(data, offsetEntry, le);
  const counts = readOffsetArray(data, countEntry, le);

  // If there's a single strip, extract the JPEG data directly
  if (offsets.length === 1) {
    const offset = offsets[0]!;
    const count = counts[0]!;
    if (offset + count > data.length) {
      throw new MalformedInputError('TIFF JPEG strip data extends beyond file', { format: 'tiff' });
    }

    return {
      width,
      height,
      data: data.subarray(offset, offset + count),
      colorSpace,
      bitsPerComponent: bitsPerSample,
      filter: 'DCTDecode',
    };
  }

  // Multiple JPEG strips — concatenate (each strip should be a complete JPEG scan)
  if (offsets.length !== counts.length) {
    throw new MalformedInputError('TIFF strip offset/count mismatch', { format: 'tiff' });
  }
  const jpegData = new Uint8Array(sumStripBytes(data, offsets, counts));
  let pos = 0;
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i]!;
    const count = counts[i]!;
    jpegData.set(data.subarray(offset, offset + count), pos);
    pos += count;
  }

  return {
    width,
    height,
    data: jpegData,
    colorSpace,
    bitsPerComponent: bitsPerSample,
    filter: 'DCTDecode',
  };
}

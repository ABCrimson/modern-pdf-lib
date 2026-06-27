/**
 * @module assets/image/nextGenImageDetect
 *
 * DETECT and probe next-generation image formats: AVIF, HEIC/HEIF, and JPEG XL.
 *
 * This module does **NOT** decode pixels. Pure-JS AV1 (AVIF), HEVC (HEIC), and
 * JPEG XL decoders are intentionally not bundled, so {@link probeNextGenImage}
 * always reports `decodable: false`. It only reads container metadata
 * (dimensions, bit depth) so callers can make a decision (reject, convert
 * upstream to PNG/JPEG, or register an external WASM decoder).
 *
 * Spec references (verified against the cited sections):
 *
 *  - **ISO Base Media File Format** — ISO/IEC 14496-12.
 *      - §4.2 Object Structure: every box starts with `size` (u32, big-endian)
 *        then `type` (4 bytes / FourCC). If `size == 1`, an 8-byte
 *        `largesize` (u64) follows `type`; if `size == 0`, the box runs to EOF.
 *      - §4.3 FileTypeBox ('ftyp'): `major_brand` (4) + `minor_version` (u32) +
 *        an array of `compatible_brands` (4 bytes each) filling the box.
 *      - §4.2 FullBox: `version` (u8) + `flags` (u24) precede the body.
 *      - §8.11.1 MetaBox ('meta') is a FullBox; its child boxes follow the
 *        version+flags word.
 *  - **HEIF** — ISO/IEC 23008-12.
 *      - §9.3.1 ItemPropertiesBox ('iprp') containing ItemPropertyContainerBox
 *        ('ipco').
 *      - §6.5.3 ImageSpatialExtentsProperty ('ispe') — a FullBox:
 *        version+flags (u32) + `image_width` (u32) + `image_height` (u32).
 *      - §6.5.6 PixelInformationProperty ('pixi') — a FullBox:
 *        version+flags (u32) + `num_channels` (u8) + `bits_per_channel` (u8)
 *        repeated `num_channels` times.
 *      - Annex B brands: 'mif1' (image), 'msf1' (sequence) generic; 'heic',
 *        'heix', 'heim', 'heis', 'hevc', 'hevx' for HEVC-coded HEIF.
 *  - **AVIF** — AV1 Image File Format (Alliance for Open Media).
 *      - §4 File-level brands: 'avif' (still image), 'avis' (image sequence).
 *  - **JPEG XL** — ISO/IEC 18181-1.
 *      - The bare codestream begins with the signature `FF 0A`.
 *      - The ISOBMFF-style container begins with the 12-byte signature box
 *        `00 00 00 0C 'JXL ' 0D 0A 87 0A`.
 *
 * No Buffer — uses Uint8Array / DataView exclusively. No fs. ESM only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifier for a recognized next-generation image format, or `null`. */
export type NextGenFormat = 'avif' | 'heic' | 'heif' | 'jpegxl' | null;

/**
 * Metadata probed from a next-generation image container.
 *
 * `decodable` is always `false`: this library probes but never decodes these
 * formats' pixels. Dimensions / bit depth are best-effort and may be
 * `undefined` when the relevant property box is absent or unparseable.
 */
export interface NextGenImageInfo {
  /** The detected format. */
  format: NextGenFormat;
  /** Image width in pixels, if discoverable from an 'ispe' box. */
  width?: number | undefined;
  /** Image height in pixels, if discoverable from an 'ispe' box. */
  height?: number | undefined;
  /** Bits per channel, if a 'pixi' box is present. */
  bitDepth?: number | undefined;
  /** Whether this library has alpha; reserved — currently always `undefined`. */
  hasAlpha?: boolean | undefined;
  /** Always `false`: pixel decoding for these formats is not bundled. */
  decodable: false;
  /** Human-readable explanation of why the image is not decodable here. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Brand tables (ISO/IEC 14496-12 §4.3, ISO/IEC 23008-12 Annex B, AVIF §4)
// ---------------------------------------------------------------------------

/** AVIF file-level brands (AV1 Image File Format §4). */
const AVIF_BRANDS: ReadonlySet<string> = new Set(['avif', 'avis']);

/** HEVC-coded HEIF brands (ISO/IEC 23008-12 Annex B). */
const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
]);

/** Generic (codec-agnostic) HEIF brands (ISO/IEC 23008-12 Annex B). */
const HEIF_BRANDS: ReadonlySet<string> = new Set(['mif1', 'msf1']);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read a 4-byte big-endian unsigned integer at `offset`. */
function readU32(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  // Use multiplication for the top byte to stay within safe-integer range
  // (>>> would coerce to 32-bit signed first).
  return b0 * 0x1000000 + ((b1 << 16) | (b2 << 8) | b3);
}

/** Decode a 4-byte FourCC at `offset` as an ASCII string. */
function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

/** A parsed ISOBMFF box header. */
interface BoxHeader {
  /** FourCC box type. */
  type: string;
  /** Offset of the box's content (payload), just past the header. */
  contentStart: number;
  /** Offset of the byte just past the end of the whole box. */
  boxEnd: number;
}

/**
 * Parse an ISOBMFF box header starting at `offset` (ISO/IEC 14496-12 §4.2).
 *
 * Handles the standard 32-bit `size`, the 64-bit `largesize` (`size == 1`),
 * and the to-EOF form (`size == 0`). Returns `null` on a malformed / truncated
 * header.
 */
function parseBoxHeader(
  bytes: Uint8Array,
  offset: number,
  end: number,
): BoxHeader | null {
  if (offset + 8 > end) {
    return null;
  }
  let size = readU32(bytes, offset);
  const type = readFourCC(bytes, offset + 4);
  let headerLen = 8;

  if (size === 1) {
    // 64-bit largesize follows the type.
    if (offset + 16 > end) {
      return null;
    }
    const high = readU32(bytes, offset + 8);
    const low = readU32(bytes, offset + 12);
    size = high * 0x100000000 + low;
    headerLen = 16;
  } else if (size === 0) {
    // Box extends to end of file.
    size = end - offset;
  }

  const boxEnd = offset + size;
  if (size < headerLen || boxEnd > end) {
    return null;
  }
  return { type, contentStart: offset + headerLen, boxEnd };
}

/**
 * Find a direct child box of a given `type` within [start, end).
 * Returns the matching {@link BoxHeader} or `null`.
 */
function findChildBox(
  bytes: Uint8Array,
  start: number,
  end: number,
  type: string,
): BoxHeader | null {
  let cursor = start;
  while (cursor + 8 <= end) {
    const header = parseBoxHeader(bytes, cursor, end);
    if (header === null) {
      return null;
    }
    if (header.type === type) {
      return header;
    }
    if (header.boxEnd <= cursor) {
      // Defensive: zero-progress guard against malformed sizes.
      return null;
    }
    cursor = header.boxEnd;
  }
  return null;
}

/** Verify a buffer begins with the given byte sequence. */
function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
  if (bytes.length < sig.length) {
    return false;
  }
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) {
      return false;
    }
  }
  return true;
}

/** JPEG XL bare-codestream signature `FF 0A` (ISO/IEC 18181-1). */
const JXL_CODESTREAM_SIG: readonly number[] = [0xff, 0x0a];

/**
 * JPEG XL ISOBMFF container signature box:
 * `00 00 00 0C 'JXL ' 0D 0A 87 0A` (ISO/IEC 18181-1 / 18181-2).
 */
const JXL_CONTAINER_SIG: readonly number[] = [
  0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
];

/**
 * Inspect an ISOBMFF `ftyp` box and classify its brand set into a next-gen
 * format. Precedence: AVIF > HEIC > HEIF. Returns `null` if no brand matches.
 */
function classifyFtypBrands(
  bytes: Uint8Array,
  ftyp: BoxHeader,
): Exclude<NextGenFormat, null> | null {
  // FileTypeBox body: major_brand(4) + minor_version(4) + compatible_brands[].
  const brands: string[] = [];
  if (ftyp.contentStart + 4 <= ftyp.boxEnd) {
    brands.push(readFourCC(bytes, ftyp.contentStart));
  }
  // compatible_brands start at contentStart + 8, each 4 bytes.
  for (
    let off = ftyp.contentStart + 8;
    off + 4 <= ftyp.boxEnd;
    off += 4
  ) {
    brands.push(readFourCC(bytes, off));
  }

  // AVIF takes precedence (an AVIF file commonly lists 'mif1' as compatible).
  if (brands.some((b) => AVIF_BRANDS.has(b))) {
    return 'avif';
  }
  if (brands.some((b) => HEIC_BRANDS.has(b))) {
    return 'heic';
  }
  if (brands.some((b) => HEIF_BRANDS.has(b))) {
    return 'heif';
  }
  return null;
}

/** Locate the top-level `ftyp` box (it must be the first box). */
function findFtyp(bytes: Uint8Array): BoxHeader | null {
  // ISOBMFF requires 'ftyp' as the first box; its type sits at bytes 4..8.
  if (bytes.length < 8 || readFourCC(bytes, 4) !== 'ftyp') {
    return null;
  }
  return parseBoxHeader(bytes, 0, bytes.length);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect a next-generation image format from raw bytes.
 *
 * Recognizes AVIF / HEIC / HEIF via the ISOBMFF `ftyp` brand set, and JPEG XL
 * via either the bare codestream signature (`FF 0A`) or the container
 * signature box (`00 00 00 0C 'JXL ' 0D 0A 87 0A`).
 *
 * @param bytes  Raw image file bytes.
 * @returns      The detected {@link NextGenFormat}, or `null` if unrecognized.
 */
export function detectNextGenFormat(bytes: Uint8Array): NextGenFormat {
  // JPEG XL: cheapest, most specific signatures first.
  if (startsWith(bytes, JXL_CODESTREAM_SIG)) {
    return 'jpegxl';
  }
  if (startsWith(bytes, JXL_CONTAINER_SIG)) {
    return 'jpegxl';
  }

  // ISOBMFF (AVIF / HEIC / HEIF): require 'ftyp' as the first box.
  const ftyp = findFtyp(bytes);
  if (ftyp === null) {
    return null;
  }
  return classifyFtypBrands(bytes, ftyp);
}

/**
 * Walk an ISOBMFF box tree to `meta` > `iprp` > `ipco` and read the first
 * `ispe` (dimensions) and `pixi` (bit depth) property boxes.
 */
function probeIsobmffDimensions(
  bytes: Uint8Array,
): { width?: number; height?: number; bitDepth?: number } {
  const result: { width?: number; height?: number; bitDepth?: number } = {};

  const ftyp = findFtyp(bytes);
  if (ftyp === null) {
    return result;
  }

  // 'meta' is a top-level box following 'ftyp'.
  const meta = findChildBox(bytes, ftyp.boxEnd, bytes.length, 'meta');
  if (meta === null) {
    return result;
  }
  // 'meta' is a FullBox: skip its version(1) + flags(3) = 4 bytes.
  const metaChildren = meta.contentStart + 4;
  if (metaChildren > meta.boxEnd) {
    return result;
  }

  const iprp = findChildBox(bytes, metaChildren, meta.boxEnd, 'iprp');
  if (iprp === null) {
    return result;
  }
  const ipco = findChildBox(bytes, iprp.contentStart, iprp.boxEnd, 'ipco');
  if (ipco === null) {
    return result;
  }

  // ispe: FullBox → version+flags(4) + width(4) + height(4).
  const ispe = findChildBox(bytes, ipco.contentStart, ipco.boxEnd, 'ispe');
  if (ispe !== null && ispe.contentStart + 12 <= ispe.boxEnd) {
    result.width = readU32(bytes, ispe.contentStart + 4);
    result.height = readU32(bytes, ispe.contentStart + 8);
  }

  // pixi: FullBox → version+flags(4) + num_channels(1) + bits[num_channels].
  const pixi = findChildBox(bytes, ipco.contentStart, ipco.boxEnd, 'pixi');
  if (pixi !== null && pixi.contentStart + 5 <= pixi.boxEnd) {
    const numChannels = bytes[pixi.contentStart + 4] ?? 0;
    if (numChannels > 0 && pixi.contentStart + 5 + numChannels <= pixi.boxEnd) {
      // Report the first channel's bit depth (all channels typically equal).
      result.bitDepth = bytes[pixi.contentStart + 5] ?? 0;
    }
  }

  return result;
}

const REASON_AVIF =
  'AVIF detected; pure-JS AV1 decoding is not bundled — decode/convert to ' +
  'PNG or JPEG, or register a WASM decoder.';
const REASON_HEIC =
  'HEIC detected; pure-JS HEVC decoding is not bundled — decode/convert to ' +
  'PNG or JPEG, or register a WASM decoder.';
const REASON_HEIF =
  'HEIF detected; pure-JS HEVC/AV1 decoding is not bundled — decode/convert ' +
  'to PNG or JPEG, or register a WASM decoder.';
const REASON_JXL =
  'JPEG XL detected; pure-JS JPEG XL decoding is not bundled — decode/convert ' +
  'to PNG or JPEG, or register a WASM decoder.';

/** Map a detected format to its non-decodable explanation. */
function reasonFor(format: Exclude<NextGenFormat, null>): string {
  switch (format) {
    case 'avif':
      return REASON_AVIF;
    case 'heic':
      return REASON_HEIC;
    case 'heif':
      return REASON_HEIF;
    case 'jpegxl':
      return REASON_JXL;
  }
}

/**
 * Probe a next-generation image for container metadata WITHOUT decoding pixels.
 *
 * For AVIF / HEIC / HEIF, walks the ISOBMFF box tree
 * (`meta` > `iprp` > `ipco` > `ispe`/`pixi`) to recover width, height, and
 * bit depth when present. For JPEG XL, the format is identified but dimensions
 * are not parsed (the `SizeHeader` is a packed-bit codestream field and is
 * intentionally scoped out here); only `format` is returned.
 *
 * The returned {@link NextGenImageInfo} **always** has `decodable: false`.
 * No pixel data is ever produced.
 *
 * @param bytes  Raw image file bytes.
 * @returns      A {@link NextGenImageInfo}, or `null` if not a next-gen image.
 */
export function probeNextGenImage(bytes: Uint8Array): NextGenImageInfo | null {
  const format = detectNextGenFormat(bytes);
  if (format === null) {
    return null;
  }

  const info: NextGenImageInfo = {
    format,
    decodable: false,
    reason: reasonFor(format),
  };

  // JPEG XL: dimensions are intentionally not parsed (scoped out — see docs).
  if (format === 'jpegxl') {
    return info;
  }

  // AVIF / HEIC / HEIF: best-effort ISOBMFF metadata probe.
  const dims = probeIsobmffDimensions(bytes);
  if (dims.width !== undefined) {
    info.width = dims.width;
  }
  if (dims.height !== undefined) {
    info.height = dims.height;
  }
  if (dims.bitDepth !== undefined) {
    info.bitDepth = dims.bitDepth;
  }

  return info;
}

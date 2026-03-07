/**
 * @module parser/jpeg2000Codestream
 *
 * Utilities for detecting and parsing JPEG2000 file formats: JP2 container
 * format (ISO 15444-1) and raw J2K codestream.
 *
 * A JP2 file wraps the actual JPEG2000 codestream inside a box-based
 * container.  This module provides functions to detect the format,
 * parse JP2 boxes, and extract the raw codestream for decoding.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single JP2 box (as defined in ISO 15444-1 Annex I).
 *
 * JP2 files are structured as a sequence of boxes, each with a 4-char
 * type identifier, a length, and payload data.
 */
export interface Jp2Box {
  /** Four-character box type (e.g. `'jp2c'`, `'ihdr'`, `'colr'`). */
  readonly type: string;
  /** Byte offset of the box start (including the header) in the file. */
  readonly offset: number;
  /** Total box length in bytes (header + data).  0 means box extends to EOF. */
  readonly length: number;
  /** Box payload data (excluding the 8- or 16-byte header). */
  readonly data: Uint8Array;
}

/**
 * Known JP2 box type identifiers.
 *
 * @see ISO 15444-1 Annex I
 */
export const JP2_BOX_TYPES = {
  /** JP2 signature box (must be first box). */
  SIGNATURE: 'jP  ',
  /** File type box (second box). */
  FILE_TYPE: 'ftyp',
  /** JP2 header superbox (contains ihdr, colr, etc.). */
  JP2_HEADER: 'jp2h',
  /** Contiguous codestream box (contains the actual J2K data). */
  CODESTREAM: 'jp2c',
  /** Colour specification box. */
  COLOR: 'colr',
  /** Image header box. */
  IMAGE_HEADER: 'ihdr',
  /** Bits per component box. */
  BITS_PER_COMPONENT: 'bpcc',
  /** Palette box. */
  PALETTE: 'pclr',
  /** Component mapping box. */
  COMPONENT_MAPPING: 'cmap',
  /** Channel definition box. */
  CHANNEL_DEFINITION: 'cdef',
  /** Resolution box. */
  RESOLUTION: 'res ',
  /** UUID box. */
  UUID: 'uuid',
  /** UUID info box. */
  UUID_INFO: 'uinf',
} as const;

// ---------------------------------------------------------------------------
// JP2 signature bytes
// ---------------------------------------------------------------------------

/**
 * JP2 file format signature (first 12 bytes).
 *
 * A JP2 file starts with a signature box:
 * ```
 * 00 00 00 0C  — box length (12 bytes)
 * 6A 50 20 20  — box type 'jP  '
 * 0D 0A 87 0A  — box contents (JP2 magic)
 * ```
 */
const JP2_SIGNATURE = new Uint8Array([
  0x00, 0x00, 0x00, 0x0C, // length = 12
  0x6A, 0x50, 0x20, 0x20, // type = 'jP  '
  0x0D, 0x0A, 0x87, 0x0A, // JP2 magic number
]);

/**
 * JPEG2000 codestream SOC (Start Of Codestream) marker: `FF 4F`.
 */
const SOC_MARKER = 0xFF4F;

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Detect whether the given data is a raw JPEG2000 codestream (J2K).
 *
 * A raw codestream starts with the SOC marker `FF 4F`, as opposed to
 * the JP2 container format which starts with the JP2 signature box.
 *
 * @param data - The bytes to check.
 * @returns `true` if the data starts with the SOC marker.
 *
 * @example
 * ```ts
 * if (isJpeg2000Codestream(bytes)) {
 *   // Raw J2K codestream — decode directly
 * }
 * ```
 */
export function isJpeg2000Codestream(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  return data[0] === 0xFF && data[1] === 0x4F;
}

/**
 * Detect whether the given data is a JP2 container file.
 *
 * Checks for the JP2 signature box at the start of the file:
 * `00 00 00 0C 6A 50 20 20 0D 0A 87 0A`.
 *
 * @param data - The bytes to check.
 * @returns `true` if the data starts with the JP2 signature.
 *
 * @example
 * ```ts
 * if (isJp2Container(bytes)) {
 *   const codestream = extractCodestream(bytes);
 *   // Decode the extracted codestream
 * }
 * ```
 */
export function isJp2Container(data: Uint8Array): boolean {
  if (data.length < JP2_SIGNATURE.length) return false;
  for (let i = 0; i < JP2_SIGNATURE.length; i++) {
    if (data[i] !== JP2_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Detect whether the given data is any form of JPEG2000 (JP2 or J2K).
 *
 * @param data - The bytes to check.
 * @returns `true` if the data is either a JP2 container or raw J2K codestream.
 */
export function isJpeg2000(data: Uint8Array): boolean {
  return isJp2Container(data) || isJpeg2000Codestream(data);
}

// ---------------------------------------------------------------------------
// Box parsing
// ---------------------------------------------------------------------------

/**
 * Parse all top-level JP2 boxes from the given data.
 *
 * Each box has an 8-byte header: 4 bytes for the length (big-endian)
 * and 4 bytes for the type.  If the length is 1, the actual length is
 * stored in bytes 8-15 as a 64-bit value (XL box).  If the length is 0,
 * the box extends to the end of the file.
 *
 * @param data - JP2 file bytes.
 * @returns An array of parsed `Jp2Box` objects.
 *
 * @example
 * ```ts
 * const boxes = parseJp2Boxes(jp2Bytes);
 * for (const box of boxes) {
 *   console.log(`Box: ${box.type}, offset: ${box.offset}, length: ${box.length}`);
 * }
 * ```
 */
export function parseJp2Boxes(data: Uint8Array): Jp2Box[] {
  const boxes: Jp2Box[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Need at least 8 bytes for the box header
    if (offset + 8 > data.length) break;

    const view = new DataView(data.buffer, data.byteOffset + offset);

    // Read box length (4 bytes, big-endian)
    let boxLength = view.getUint32(0, false);

    // Read box type (4 ASCII characters)
    const type = String.fromCharCode(
      data[offset + 4]!,
      data[offset + 5]!,
      data[offset + 6]!,
      data[offset + 7]!,
    );

    let headerSize = 8;

    if (boxLength === 1) {
      // Extended length: 8-byte length field follows the type
      if (offset + 16 > data.length) break;
      // Read as two 32-bit values (JS doesn't have native 64-bit int)
      const high = view.getUint32(8, false);
      const low = view.getUint32(12, false);
      // For practical purposes, we limit to 32-bit addressable sizes
      if (high > 0) {
        // Box too large to handle — skip to end
        boxLength = data.length - offset;
      } else {
        boxLength = low;
      }
      headerSize = 16;
    } else if (boxLength === 0) {
      // Box extends to the end of the file
      boxLength = data.length - offset;
    }

    // Sanity check: box must not extend past data
    const effectiveLength = Math.min(boxLength, data.length - offset);
    const dataStart = offset + headerSize;
    const dataLength = Math.max(0, effectiveLength - headerSize);

    boxes.push({
      type,
      offset,
      length: effectiveLength,
      data: data.subarray(dataStart, dataStart + dataLength),
    });

    // Advance to the next box
    if (effectiveLength === 0) break; // Prevent infinite loop
    offset += effectiveLength;
  }

  return boxes;
}

// ---------------------------------------------------------------------------
// Codestream extraction
// ---------------------------------------------------------------------------

/**
 * Extract the raw JPEG2000 codestream from a JP2 container.
 *
 * Searches for the `jp2c` (contiguous codestream) box and returns its
 * contents.  If the input is already a raw codestream (starts with SOC
 * marker `FF 4F`), it is returned as-is.
 *
 * @param data - JP2 file bytes or raw J2K codestream.
 * @returns The raw JPEG2000 codestream bytes.
 * @throws If no codestream box is found in a JP2 container.
 *
 * @example
 * ```ts
 * const codestream = extractCodestream(jp2Bytes);
 * // codestream starts with FF 4F (SOC marker)
 * ```
 */
export function extractCodestream(data: Uint8Array): Uint8Array {
  // If it's already a raw codestream, return as-is
  if (isJpeg2000Codestream(data)) {
    return data;
  }

  // Parse JP2 boxes and find the codestream box
  const boxes = parseJp2Boxes(data);

  for (const box of boxes) {
    if (box.type === JP2_BOX_TYPES.CODESTREAM) {
      return box.data;
    }
  }

  throw new Error(
    'JPEG2000: no codestream box (jp2c) found in JP2 container',
  );
}

/**
 * Find a specific box by type within parsed JP2 boxes.
 *
 * @param boxes - Array of parsed JP2 boxes.
 * @param type  - The 4-character box type to search for.
 * @returns The first matching box, or `undefined` if not found.
 */
export function findBox(boxes: Jp2Box[], type: string): Jp2Box | undefined {
  return boxes.find((b) => b.type === type);
}

/**
 * Find all boxes of a given type.
 *
 * @param boxes - Array of parsed JP2 boxes.
 * @param type  - The 4-character box type to search for.
 * @returns All matching boxes.
 */
export function findAllBoxes(boxes: Jp2Box[], type: string): Jp2Box[] {
  return boxes.filter((b) => b.type === type);
}

/**
 * Parse the image header (ihdr) box to extract basic image dimensions.
 *
 * The ihdr box structure (14 bytes):
 * - Bytes 0-3:  Height (uint32)
 * - Bytes 4-7:  Width (uint32)
 * - Bytes 8-9:  Number of components (uint16)
 * - Byte 10:    Bits per component (uint8, value + 1 = actual bpc)
 * - Byte 11:    Compression type (always 7 for JP2)
 * - Byte 12:    Colorspace unknown flag (uint8)
 * - Byte 13:    Intellectual property flag (uint8)
 *
 * @param ihdrData - The raw data from an ihdr box.
 * @returns Parsed image header fields.
 */
export function parseImageHeader(ihdrData: Uint8Array): {
  width: number;
  height: number;
  components: number;
  bitsPerComponent: number;
  compressionType: number;
  colorspaceUnknown: boolean;
  intellectualProperty: boolean;
} {
  if (ihdrData.length < 14) {
    throw new Error('JPEG2000: ihdr box is too short (need 14 bytes)');
  }

  const view = new DataView(
    ihdrData.buffer,
    ihdrData.byteOffset,
    ihdrData.byteLength,
  );

  return {
    height: view.getUint32(0, false),
    width: view.getUint32(4, false),
    components: view.getUint16(8, false),
    bitsPerComponent: (ihdrData[10]! & 0x7F) + 1,
    compressionType: ihdrData[11]!,
    colorspaceUnknown: ihdrData[12]! !== 0,
    intellectualProperty: ihdrData[13]! !== 0,
  };
}

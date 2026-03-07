/**
 * @module parser/jpeg2000Alpha
 *
 * Alpha channel handling for JPEG2000 images.
 *
 * JP2 files can contain alpha (opacity) channels alongside color data.
 * The channel definition box (`cdef`) specifies which components are
 * color channels (type=0) and which are alpha/opacity (type=1).
 *
 * This module provides utilities to detect, extract, separate, and
 * pre-multiply alpha channels in decoded JPEG2000 image data.
 *
 * @packageDocumentation
 */

import {
  isJp2Container,
  parseJp2Boxes,
  findBox,
  JP2_BOX_TYPES,
} from './jpeg2000Codestream.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A parsed channel definition entry from the `cdef` box.
 */
export interface ChannelDefinition {
  /** Channel index (0-based component index). */
  readonly channelIndex: number;
  /**
   * Channel type:
   * - `0` — Color channel
   * - `1` — Opacity (alpha) channel
   * - `2` — Pre-multiplied opacity channel
   * - `65535` (0xFFFF) — Unspecified / not defined
   */
  readonly type: number;
  /**
   * Association:
   * - `0` — Whole image
   * - `1..N` — Associated with color channel N (1-based)
   * - `65535` (0xFFFF) — Not associated
   */
  readonly association: number;
}

/**
 * Result of separating an image into color and alpha components.
 */
export interface SeparatedImage {
  /** RGB pixel data (3 bytes per pixel, row-major). */
  readonly rgb: Uint8Array;
  /** Alpha channel data (1 byte per pixel, row-major). */
  readonly alpha: Uint8Array;
}

// ---------------------------------------------------------------------------
// Channel definition parsing
// ---------------------------------------------------------------------------

/**
 * Parse the channel definition box (`cdef`) from JP2 data.
 *
 * The `cdef` box structure:
 * - Bytes 0-1:  Number of channel definitions (uint16, big-endian)
 * - For each definition (6 bytes each):
 *   - Bytes 0-1: Channel index (uint16)
 *   - Bytes 2-3: Channel type (uint16)
 *   - Bytes 4-5: Channel association (uint16)
 *
 * @param cdefData - Raw data from a `cdef` box.
 * @returns Array of channel definitions.
 */
export function parseChannelDefinitions(
  cdefData: Uint8Array,
): ChannelDefinition[] {
  if (cdefData.length < 2) return [];

  const view = new DataView(
    cdefData.buffer,
    cdefData.byteOffset,
    cdefData.byteLength,
  );
  const count = view.getUint16(0, false);
  const defs: ChannelDefinition[] = [];

  for (let i = 0; i < count; i++) {
    const entryOffset = 2 + i * 6;
    if (entryOffset + 6 > cdefData.length) break;

    defs.push({
      channelIndex: view.getUint16(entryOffset, false),
      type: view.getUint16(entryOffset + 2, false),
      association: view.getUint16(entryOffset + 4, false),
    });
  }

  return defs;
}

/**
 * Find the `cdef` box inside a JP2 container and parse its channel
 * definitions.
 *
 * The `cdef` box can appear either as a top-level box or inside the
 * JP2 header superbox (`jp2h`).  This function searches both locations.
 *
 * @param data - JP2 file bytes.
 * @returns Parsed channel definitions, or an empty array if no `cdef` box
 *          is found or the input is not a JP2 container.
 */
function findChannelDefinitions(data: Uint8Array): ChannelDefinition[] {
  if (!isJp2Container(data)) return [];

  const boxes = parseJp2Boxes(data);

  // Check top-level first
  const cdefBox = findBox(boxes, JP2_BOX_TYPES.CHANNEL_DEFINITION);
  if (cdefBox) {
    return parseChannelDefinitions(cdefBox.data);
  }

  // Check inside the JP2 header superbox
  const jp2hBox = findBox(boxes, JP2_BOX_TYPES.JP2_HEADER);
  if (jp2hBox) {
    const subBoxes = parseJp2Boxes(jp2hBox.data);
    const subCdef = findBox(subBoxes, JP2_BOX_TYPES.CHANNEL_DEFINITION);
    if (subCdef) {
      return parseChannelDefinitions(subCdef.data);
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Alpha detection
// ---------------------------------------------------------------------------

/**
 * Check whether a JP2 file contains an alpha (opacity) channel.
 *
 * Detection is based on:
 * 1. The channel definition box (`cdef`) — looks for type=1 (opacity)
 *    or type=2 (pre-multiplied opacity).
 * 2. If no `cdef` box is present and the data has been decoded,
 *    the caller can check component count (4 components often means
 *    RGBA, but could also be CMYK).
 *
 * @param data - JP2 file bytes (container format, not raw codestream).
 * @returns `true` if an alpha channel is detected via the `cdef` box.
 *
 * @example
 * ```ts
 * if (hasAlphaChannel(jp2Bytes)) {
 *   const { rgb, alpha } = separateAlpha(decoded, width, height, 4);
 * }
 * ```
 */
export function hasAlphaChannel(data: Uint8Array): boolean {
  const defs = findChannelDefinitions(data);
  if (defs.length === 0) return false;

  // Type 1 = opacity, type 2 = pre-multiplied opacity
  return defs.some((d) => d.type === 1 || d.type === 2);
}

/**
 * Find the component index of the alpha channel from channel definitions.
 *
 * @param data - JP2 file bytes.
 * @returns The 0-based component index of the alpha channel, or `-1` if
 *          no alpha channel is defined.
 */
export function getAlphaChannelIndex(data: Uint8Array): number {
  const defs = findChannelDefinitions(data);
  const alphaDef = defs.find((d) => d.type === 1 || d.type === 2);
  return alphaDef ? alphaDef.channelIndex : -1;
}

// ---------------------------------------------------------------------------
// Alpha separation
// ---------------------------------------------------------------------------

/**
 * Separate decoded pixel data into RGB and alpha components.
 *
 * Assumes the pixel data is interleaved (e.g., RGBA or GRAYA) with the
 * alpha channel as the last component.
 *
 * @param imageData  - Decoded pixel data (row-major, channel-interleaved).
 * @param width      - Image width in pixels.
 * @param height     - Image height in pixels.
 * @param components - Total number of components (must be >= 2).
 * @returns An object with separate `rgb` and `alpha` arrays.
 * @throws If the component count is less than 2 or data length is wrong.
 *
 * @example
 * ```ts
 * // 4-component RGBA image
 * const { rgb, alpha } = separateAlpha(pixels, 100, 100, 4);
 * // rgb.length === 100 * 100 * 3
 * // alpha.length === 100 * 100
 * ```
 */
export function separateAlpha(
  imageData: Uint8Array,
  width: number,
  height: number,
  components: number,
): SeparatedImage {
  if (components < 2) {
    throw new Error(
      `separateAlpha: need at least 2 components, got ${components}`,
    );
  }

  const pixelCount = width * height;
  const expectedLength = pixelCount * components;

  if (imageData.length < expectedLength) {
    throw new Error(
      `separateAlpha: expected ${expectedLength} bytes, got ${imageData.length}`,
    );
  }

  const colorChannels = components - 1;
  // If colorChannels is 1 or 2, output is grayscale; if 3, output is RGB.
  // We always output 3-channel RGB for consistency.
  const outChannels = colorChannels >= 3 ? 3 : colorChannels;
  const rgb = new Uint8Array(pixelCount * outChannels);
  const alpha = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const srcOffset = i * components;
    const dstOffset = i * outChannels;

    // Copy color channels
    for (let c = 0; c < outChannels; c++) {
      rgb[dstOffset + c] = imageData[srcOffset + c]!;
    }

    // Alpha is the last component
    alpha[i] = imageData[srcOffset + components - 1]!;
  }

  return { rgb, alpha };
}

// ---------------------------------------------------------------------------
// Alpha pre-multiplication
// ---------------------------------------------------------------------------

/**
 * Pre-multiply RGB pixel data by the alpha channel.
 *
 * Pre-multiplication computes:
 * ```
 * R' = R * A / 255
 * G' = G * A / 255
 * B' = B * A / 255
 * ```
 *
 * This is useful for compositing operations where the alpha has not
 * yet been applied to the color values.
 *
 * @param rgb    - RGB pixel data (3 bytes per pixel, row-major).
 * @param alpha  - Alpha channel data (1 byte per pixel, row-major).
 * @param width  - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns New RGB array with pre-multiplied alpha.
 * @throws If the array lengths are inconsistent.
 *
 * @example
 * ```ts
 * const premultiplied = premultiplyAlpha(rgb, alpha, 100, 100);
 * ```
 */
export function premultiplyAlpha(
  rgb: Uint8Array,
  alpha: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixelCount = width * height;

  if (rgb.length < pixelCount * 3) {
    throw new Error(
      `premultiplyAlpha: rgb too short — expected ${pixelCount * 3}, got ${rgb.length}`,
    );
  }
  if (alpha.length < pixelCount) {
    throw new Error(
      `premultiplyAlpha: alpha too short — expected ${pixelCount}, got ${alpha.length}`,
    );
  }

  const result = new Uint8Array(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    const a = alpha[i]!;
    const rgbOffset = i * 3;

    if (a === 255) {
      // Fully opaque — copy as-is
      result[rgbOffset] = rgb[rgbOffset]!;
      result[rgbOffset + 1] = rgb[rgbOffset + 1]!;
      result[rgbOffset + 2] = rgb[rgbOffset + 2]!;
    } else if (a === 0) {
      // Fully transparent — black
      result[rgbOffset] = 0;
      result[rgbOffset + 1] = 0;
      result[rgbOffset + 2] = 0;
    } else {
      // Pre-multiply: C' = C * A / 255
      // Use (C * A + 127) / 255 for correct rounding
      result[rgbOffset] = ((rgb[rgbOffset]! * a + 127) / 255) | 0;
      result[rgbOffset + 1] = ((rgb[rgbOffset + 1]! * a + 127) / 255) | 0;
      result[rgbOffset + 2] = ((rgb[rgbOffset + 2]! * a + 127) / 255) | 0;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component extraction
// ---------------------------------------------------------------------------

/**
 * Extract a specific component from decoded pixel data as a single-channel
 * (alpha-like) plane.
 *
 * @param data           - Decoded pixel data (row-major, channel-interleaved).
 * @param width          - Image width in pixels.
 * @param height         - Image height in pixels.
 * @param components     - Total number of interleaved components.
 * @param componentIndex - The 0-based index of the component to extract.
 * @returns A single-channel `Uint8Array` (1 byte per pixel).
 * @throws If the component index is out of range or data is too short.
 *
 * @example
 * ```ts
 * // Extract the 4th component (index 3) as alpha from a 4-component image
 * const alpha = extractAlphaChannel(pixels, 100, 100, 4, 3);
 * ```
 */
export function extractAlphaChannel(
  data: Uint8Array,
  width: number,
  height: number,
  components: number,
  componentIndex: number,
): Uint8Array {
  if (componentIndex < 0 || componentIndex >= components) {
    throw new Error(
      `extractAlphaChannel: componentIndex ${componentIndex} out of range [0, ${components - 1}]`,
    );
  }

  const pixelCount = width * height;
  const expectedLength = pixelCount * components;

  if (data.length < expectedLength) {
    throw new Error(
      `extractAlphaChannel: expected ${expectedLength} bytes, got ${data.length}`,
    );
  }

  const result = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    result[i] = data[i * components + componentIndex]!;
  }

  return result;
}

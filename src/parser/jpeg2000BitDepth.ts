/**
 * @module parser/jpeg2000BitDepth
 *
 * 16-bit and variable bit depth support for JPEG2000 (JP2 / J2K) images.
 *
 * JPEG2000 supports per-component bit depths from 1 to 38 bits, with both
 * signed and unsigned representations.  Medical imaging (DICOM), satellite
 * imagery, and scientific data frequently use 12-bit or 16-bit components.
 *
 * This module provides utilities to:
 * - Parse the SIZ marker to extract per-component bit depth information
 * - Convert between different bit depths (e.g. 16-bit to 8-bit)
 * - Handle signed components by offsetting to unsigned range
 *
 * Reference: ITU-T T.800 (ISO/IEC 15444-1), Annex A — SIZ marker segment.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-component bit depth information extracted from a JPEG2000 SIZ marker.
 */
export interface BitDepthInfo {
  /** Number of bits per component sample. */
  bitsPerComponent: number;
  /** Whether the component values are signed (two's complement). */
  isSigned: boolean;
  /** Total number of image components. */
  components: number;
}

/**
 * Detailed per-component depth descriptor returned by
 * {@link getComponentDepths}.
 */
export interface ComponentDepth {
  /** Bit depth for this component (1–38). */
  bits: number;
  /** Whether the component is signed. */
  isSigned: boolean;
}

// ---------------------------------------------------------------------------
// JPEG2000 marker constants
// ---------------------------------------------------------------------------

/** Start-of-codestream marker. */
const SOC = 0xff4f;

/** Image and tile size marker (SIZ). */
const SIZ_MARKER = 0xff51;

// ---------------------------------------------------------------------------
// SIZ marker parsing
// ---------------------------------------------------------------------------

/**
 * Locate the SIZ marker within a JPEG2000 codestream and return its offset
 * (pointing to the 0xFF51 bytes).  Returns -1 if not found.
 *
 * The SIZ marker must appear immediately after the SOC marker in a raw
 * codestream, or after the contiguous codestream box in a JP2 wrapper.
 *
 * @param data - Raw bytes that may be a J2K codestream or JP2 file.
 * @returns Byte offset of the SIZ marker, or -1.
 */
function findSizMarker(data: Uint8Array): number {
  if (data.length < 4) return -1;

  // Check for JP2 box header (signature box starts with 0x0000000C 6A502020)
  // If this is a JP2 file, search for the contiguous codestream box (jp2c)
  // and then find SIZ within it.
  const isJp2 =
    data.length >= 12 &&
    data[0] === 0x00 &&
    data[1] === 0x00 &&
    data[2] === 0x00 &&
    data[3] === 0x0c &&
    data[4] === 0x6a &&
    data[5] === 0x50;

  let searchStart = 0;

  if (isJp2) {
    // Walk JP2 boxes to find jp2c (contiguous codestream)
    let offset = 0;
    while (offset + 8 <= data.length) {
      const boxLen =
        ((data[offset]! << 24) |
          (data[offset + 1]! << 16) |
          (data[offset + 2]! << 8) |
          data[offset + 3]!) >>>
        0;
      const boxType =
        String.fromCharCode(
          data[offset + 4]!,
          data[offset + 5]!,
          data[offset + 6]!,
          data[offset + 7]!,
        );

      if (boxType === 'jp2c') {
        // Codestream starts at offset + 8 (after box header)
        searchStart = offset + 8;
        break;
      }

      // Advance to next box
      const advance = boxLen === 0 ? data.length - offset : boxLen < 8 ? 8 : boxLen;
      offset += advance;
    }
  }

  // Now search for SIZ marker (0xFF51) starting at searchStart
  // In a valid codestream, SOC (0xFF4F) is first, then SIZ immediately follows
  if (
    searchStart + 4 <= data.length &&
    data[searchStart] === 0xff &&
    data[searchStart + 1] === 0x4f &&
    data[searchStart + 2] === 0xff &&
    data[searchStart + 3] === 0x51
  ) {
    return searchStart + 2;
  }

  // Fallback: scan for the marker
  for (let i = searchStart; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0x51) {
      return i;
    }
  }

  return -1;
}

/**
 * Parse the SIZ marker to extract per-component bit depth information.
 *
 * The SIZ marker segment stores the component count followed by one byte
 * per component describing its bit depth and signedness:
 *
 * - Bits 0–6: depth minus one (i.e. value 7 means 8 bits)
 * - Bit 7: 1 = signed, 0 = unsigned
 *
 * @param sizMarker - A `Uint8Array` containing at least the SIZ marker
 *   segment.  May be a full JP2/J2K codestream — the SIZ is located
 *   automatically.
 * @returns An array of per-component depth descriptors.
 * @throws If the SIZ marker cannot be found or is truncated.
 */
export function getComponentDepths(sizMarker: Uint8Array): ComponentDepth[] {
  const sizOffset = findSizMarker(sizMarker);
  if (sizOffset < 0) {
    throw new Error('JPEG2000 BitDepth: SIZ marker (0xFF51) not found');
  }

  // SIZ marker structure (after the 2-byte marker code):
  // [0-1]  Lsiz  — marker segment length
  // [2-3]  Rsiz  — capabilities
  // [4-7]  Xsiz  — image width
  // [8-11] Ysiz  — image height
  // [12-15] XOsiz — horizontal origin
  // [16-19] YOsiz — vertical origin
  // [20-23] XTsiz — tile width
  // [24-27] YTsiz — tile height
  // [28-31] XTOsiz — tile origin X
  // [32-35] YTOsiz — tile origin Y
  // [36-37] Csiz  — number of components
  // [38+]  Ssiz_i (1 byte per component) + XRsiz_i (1) + YRsiz_i (1)

  const base = sizOffset + 2; // skip the 0xFF51 marker bytes
  if (base + 38 > sizMarker.length) {
    throw new Error('JPEG2000 BitDepth: SIZ marker segment is truncated');
  }

  const csiz = (sizMarker[base + 36]! << 8) | sizMarker[base + 37]!;
  if (csiz === 0) {
    throw new Error('JPEG2000 BitDepth: SIZ reports 0 components');
  }

  // Each component entry is 3 bytes: Ssiz(1) + XRsiz(1) + YRsiz(1)
  const componentStart = base + 38;
  if (componentStart + csiz * 3 > sizMarker.length) {
    throw new Error(
      `JPEG2000 BitDepth: SIZ marker truncated — expected ${csiz} component entries`,
    );
  }

  const depths: ComponentDepth[] = [];
  for (let i = 0; i < csiz; i++) {
    const ssiz = sizMarker[componentStart + i * 3]!;
    const isSigned = (ssiz & 0x80) !== 0;
    const bits = (ssiz & 0x7f) + 1; // stored as depth-1
    depths.push({ bits, isSigned });
  }

  return depths;
}

// ---------------------------------------------------------------------------
// Bit-depth conversion
// ---------------------------------------------------------------------------

/**
 * Downscale component data from a higher bit depth (>8) to 8-bit.
 *
 * Uses linear scaling: `out = round(value * 255 / maxValue)`.
 * For signed components, the values are first offset by `2^(bits-1)` to
 * produce unsigned values in the range `[0, 2^bits - 1]`.
 *
 * @param data - Source samples.  For depths <= 8, each sample occupies
 *   one byte.  For depths 9–16, each sample occupies two bytes (big-endian).
 * @param bitsPerComponent - The source bit depth (must be > 8, up to 16).
 * @returns A new `Uint8Array` with one byte per sample, scaled to [0, 255].
 */
export function downscale16To8(
  data: Uint8Array,
  bitsPerComponent: number,
): Uint8Array {
  if (bitsPerComponent <= 8) {
    // Already 8-bit or less — return a copy
    return new Uint8Array(data);
  }

  if (bitsPerComponent > 16) {
    throw new Error(
      `JPEG2000 BitDepth: downscale16To8 supports up to 16 bits, got ${bitsPerComponent}`,
    );
  }

  const sampleCount = data.length >>> 1; // 2 bytes per sample
  const out = new Uint8Array(sampleCount);
  const maxValue = (1 << bitsPerComponent) - 1;

  for (let i = 0; i < sampleCount; i++) {
    const hi = data[i * 2]!;
    const lo = data[i * 2 + 1]!;
    const value = (hi << 8) | lo;
    // Linear scaling with rounding
    out[i] = ((value * 255 + (maxValue >>> 1)) / maxValue) | 0;
  }

  return out;
}

/**
 * Upscale 8-bit component data to 16-bit.
 *
 * Each 8-bit sample is expanded to a 16-bit value using the formula
 * `out = value * 257` (which maps 0→0 and 255→65535 exactly) and
 * stored as big-endian two-byte pairs.
 *
 * @param data - Source 8-bit samples.
 * @returns A new `Uint8Array` of length `data.length * 2`, big-endian 16-bit.
 */
export function upscale8To16(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length * 2);

  for (let i = 0; i < data.length; i++) {
    const v16 = data[i]! * 257; // 0→0, 128→32896, 255→65535
    out[i * 2] = (v16 >>> 8) & 0xff;
    out[i * 2 + 1] = v16 & 0xff;
  }

  return out;
}

/**
 * Generic bit-depth normalizer.  Converts component sample data from an
 * arbitrary source depth to an arbitrary target depth.
 *
 * Handles signed source data by offsetting before scaling.  The output is
 * always unsigned.
 *
 * Supports depths from 1 to 16.  Source data is expected in big-endian
 * byte order when the depth exceeds 8 bits (2 bytes per sample).  Output
 * follows the same convention.
 *
 * @param data     - Source sample bytes.
 * @param fromBits - Source bit depth (1–16).
 * @param toBits   - Target bit depth (1–16).
 * @returns A new `Uint8Array` with samples at the target depth.
 */
export function normalizeComponentDepth(
  data: Uint8Array,
  fromBits: number,
  toBits: number,
): Uint8Array {
  if (fromBits < 1 || fromBits > 16 || toBits < 1 || toBits > 16) {
    throw new Error(
      `JPEG2000 BitDepth: normalizeComponentDepth supports 1–16 bits, got from=${fromBits} to=${toBits}`,
    );
  }

  if (fromBits === toBits) {
    return new Uint8Array(data);
  }

  const fromMax = (1 << fromBits) - 1;
  const toMax = (1 << toBits) - 1;

  const fromBytesPerSample = fromBits > 8 ? 2 : 1;
  const toBytesPerSample = toBits > 8 ? 2 : 1;

  const sampleCount = Math.floor(data.length / fromBytesPerSample);
  const out = new Uint8Array(sampleCount * toBytesPerSample);

  for (let i = 0; i < sampleCount; i++) {
    let value: number;
    if (fromBytesPerSample === 2) {
      value = (data[i * 2]! << 8) | data[i * 2 + 1]!;
    } else {
      value = data[i]!;
    }

    // Clamp to source range
    if (value > fromMax) value = fromMax;

    // Scale: out = round(value * toMax / fromMax)
    const scaled = ((value * toMax + (fromMax >>> 1)) / fromMax) | 0;

    if (toBytesPerSample === 2) {
      out[i * 2] = (scaled >>> 8) & 0xff;
      out[i * 2 + 1] = scaled & 0xff;
    } else {
      out[i] = scaled & 0xff;
    }
  }

  return out;
}

/**
 * Offset signed component samples to unsigned range.
 *
 * For signed data with `N` bits, the offset is `2^(N-1)`.  For example,
 * a signed 16-bit value of −32768 becomes 0 and +32767 becomes 65535.
 *
 * @param data - Source sample bytes (big-endian for >8 bits).
 * @param bitsPerComponent - Component bit depth.
 * @returns A new `Uint8Array` with the offset applied.
 */
export function offsetSignedToUnsigned(
  data: Uint8Array,
  bitsPerComponent: number,
): Uint8Array {
  const offset = 1 << (bitsPerComponent - 1);
  const maxUnsigned = (1 << bitsPerComponent) - 1;

  if (bitsPerComponent > 8) {
    const sampleCount = data.length >>> 1;
    const out = new Uint8Array(data.length);

    for (let i = 0; i < sampleCount; i++) {
      const hi = data[i * 2]!;
      const lo = data[i * 2 + 1]!;
      // Interpret as signed
      let value = (hi << 8) | lo;
      if (value >= offset) {
        value = value - (1 << bitsPerComponent);
      }
      // Offset to unsigned
      const unsigned = Math.max(0, Math.min(maxUnsigned, value + offset));
      out[i * 2] = (unsigned >>> 8) & 0xff;
      out[i * 2 + 1] = unsigned & 0xff;
    }

    return out;
  }

  // 8-bit or less
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let value = data[i]!;
    if (value >= offset) {
      value = value - (1 << bitsPerComponent);
    }
    out[i] = Math.max(0, Math.min(maxUnsigned, value + offset));
  }

  return out;
}

/**
 * Create a {@link BitDepthInfo} summary from component depth descriptors.
 *
 * If all components share the same bit depth and signedness, the result
 * uses those values.  Otherwise, the maximum bit depth and the logical
 * OR of all signed flags are used.
 *
 * @param depths - Per-component depth descriptors from
 *   {@link getComponentDepths}.
 * @returns A summary object.
 */
export function summarizeBitDepth(depths: ComponentDepth[]): BitDepthInfo {
  if (depths.length === 0) {
    return { bitsPerComponent: 8, isSigned: false, components: 0 };
  }

  let maxBits = 0;
  let anySigned = false;

  for (const d of depths) {
    if (d.bits > maxBits) maxBits = d.bits;
    if (d.isSigned) anySigned = true;
  }

  return {
    bitsPerComponent: maxBits,
    isSigned: anySigned,
    components: depths.length,
  };
}

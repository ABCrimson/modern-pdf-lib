/**
 * @module compliance/srgbIccProfile
 *
 * Minimal sRGB ICC profile for PDF/A output intents.
 *
 * This generates a valid ICC v2 profile (~3KB) that satisfies
 * PDF/A validators. It uses the standard sRGB primaries and
 * the sRGB tone response curve (gamma ~ 2.2).
 *
 * The sRGB color space is defined by IEC 61966-2.1 and its ICC
 * profile encodes the D65 white point, the three primary
 * colorants (red, green, blue), and the tone response curve
 * (TRC) for each channel.
 *
 * Reference: ICC.1:2001-04 (ICC Profile Format Specification).
 */

// ---------------------------------------------------------------------------
// ICC profile helpers
// ---------------------------------------------------------------------------

/** Write a 32-bit unsigned integer (big-endian) into a buffer. */
function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/** Write a 16-bit unsigned integer (big-endian) into a buffer. */
function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

/** Write an ASCII string (up to `len` bytes, zero-padded) into a buffer. */
function writeAscii(buf: Uint8Array, offset: number, str: string, len: number): void {
  for (let i = 0; i < len; i++) {
    buf[offset + i] = i < str.length ? str.charCodeAt(i) : 0;
  }
}

/**
 * Encode a floating-point value as an ICC s15Fixed16Number.
 *
 * s15Fixed16: 16-bit signed integer part + 16-bit fractional part.
 * Range: roughly -32768.0 to +32767.99998.
 */
function s15Fixed16(value: number): number {
  return Math.round(value * 65536) | 0;
}

/**
 * Write an s15Fixed16Number (4 bytes, big-endian) into a buffer.
 */
function writeS15Fixed16(buf: Uint8Array, offset: number, value: number): void {
  const fixed = s15Fixed16(value);
  // Write as signed 32-bit big-endian
  buf[offset] = (fixed >>> 24) & 0xff;
  buf[offset + 1] = (fixed >>> 16) & 0xff;
  buf[offset + 2] = (fixed >>> 8) & 0xff;
  buf[offset + 3] = fixed & 0xff;
}

// ---------------------------------------------------------------------------
// Tag data builders
// ---------------------------------------------------------------------------

/**
 * Build an XYZ type tag (20 bytes).
 *
 * Structure:
 *   - 4 bytes: type signature 'XYZ '
 *   - 4 bytes: reserved (0)
 *   - 12 bytes: 3 x s15Fixed16Number (X, Y, Z)
 */
function buildXyzTag(x: number, y: number, z: number): Uint8Array {
  const data = new Uint8Array(20);
  writeAscii(data, 0, 'XYZ ', 4);
  // bytes 4-7 reserved (already 0)
  writeS15Fixed16(data, 8, x);
  writeS15Fixed16(data, 12, y);
  writeS15Fixed16(data, 16, z);
  return data;
}

/**
 * Build a curveType tag for a single gamma value (12 bytes).
 *
 * Structure:
 *   - 4 bytes: type signature 'curv'
 *   - 4 bytes: reserved (0)
 *   - 4 bytes: count = 1 (meaning a single u16 gamma value)
 *   - 2 bytes: u8Fixed8Number gamma value
 *   - 2 bytes: padding to 4-byte alignment
 *
 * A count of 0 means identity (gamma 1.0).
 * A count of 1 means a single u8Fixed8Number encoding the gamma exponent.
 */
function buildCurveTag(gamma: number): Uint8Array {
  const data = new Uint8Array(14);
  writeAscii(data, 0, 'curv', 4);
  // bytes 4-7 reserved (already 0)
  writeU32(data, 8, 1); // count = 1
  // u8Fixed8Number: 8-bit integer + 8-bit fraction
  const u8f8 = Math.round(gamma * 256);
  writeU16(data, 12, u8f8);
  return data;
}

/**
 * Build a textDescriptionType tag ('desc').
 *
 * Structure:
 *   - 4 bytes: type signature 'desc'
 *   - 4 bytes: reserved (0)
 *   - 4 bytes: ASCII description length (including null terminator)
 *   - N bytes: ASCII description (null-terminated)
 *   - 4 bytes: Unicode language code (0)
 *   - 4 bytes: Unicode description length (0 = none)
 *   - 2 bytes: ScriptCode code (0)
 *   - 1 byte:  ScriptCode description length (0)
 *   - 67 bytes: ScriptCode description (zeroed)
 */
function buildDescTag(description: string): Uint8Array {
  const asciiLen = description.length + 1; // include null terminator
  // desc header (12) + ASCII string + null + unicode placeholder (8) + scriptcode placeholder (70)
  const size = 12 + asciiLen + 4 + 4 + 2 + 1 + 67;
  const data = new Uint8Array(size);
  writeAscii(data, 0, 'desc', 4);
  // bytes 4-7 reserved (already 0)
  writeU32(data, 8, asciiLen);
  writeAscii(data, 12, description, asciiLen); // writes description + null terminator
  // Unicode: language code (0) and count (0)
  const unicodeOffset = 12 + asciiLen;
  writeU32(data, unicodeOffset, 0); // language code
  writeU32(data, unicodeOffset + 4, 0); // unicode count
  // ScriptCode: code (0), count (0), 67 bytes padding — all already 0
  return data;
}

/**
 * Build a textType tag ('text') for the copyright string.
 *
 * Structure:
 *   - 4 bytes: type signature 'text'
 *   - 4 bytes: reserved (0)
 *   - N bytes: null-terminated ASCII text
 */
function buildTextTag(text: string): Uint8Array {
  const size = 8 + text.length + 1; // signature + reserved + text + null
  const data = new Uint8Array(size);
  writeAscii(data, 0, 'text', 4);
  // bytes 4-7 reserved (already 0)
  writeAscii(data, 8, text, text.length + 1);
  return data;
}

// ---------------------------------------------------------------------------
// sRGB color space constants (IEC 61966-2.1)
// ---------------------------------------------------------------------------

/**
 * D65 illuminant in ICC XYZ (adapted to D50 PCS using Bradford transform).
 *
 * The ICC PCS uses D50 as the reference illuminant, so all XYZ values
 * in an ICC profile are relative to D50 = (0.9505, 1.0000, 1.0890).
 */
const D50_WHITE_X = 0.9505;
const D50_WHITE_Y = 1.0000;
const D50_WHITE_Z = 1.0890;

/**
 * sRGB primaries in XYZ, adapted to D50 PCS via Bradford chromatic
 * adaptation from D65.
 *
 * These are the standard values used in ICC profiles for sRGB.
 */
const SRGB_RED_X = 0.4361;
const SRGB_RED_Y = 0.2225;
const SRGB_RED_Z = 0.0139;

const SRGB_GREEN_X = 0.3851;
const SRGB_GREEN_Y = 0.7169;
const SRGB_GREEN_Z = 0.0971;

const SRGB_BLUE_X = 0.1432;
const SRGB_BLUE_Y = 0.0606;
const SRGB_BLUE_Z = 0.7141;

/**
 * sRGB gamma approximation.
 *
 * The true sRGB transfer function is a piecewise curve (linear near
 * black, then a power curve with exponent ~2.4). For a minimal ICC
 * profile a single gamma value of 2.2 is a standard approximation
 * that PDF/A validators accept.
 */
const SRGB_GAMMA = 2.2;

// ---------------------------------------------------------------------------
// ICC tag signatures (4-byte ASCII codes)
// ---------------------------------------------------------------------------

const TAG_DESC = 'desc';
const TAG_CPRT = 'cprt';
const TAG_WTPT = 'wtpt';
const TAG_RXYZ = 'rXYZ';
const TAG_GXYZ = 'gXYZ';
const TAG_BXYZ = 'bXYZ';
const TAG_RTRC = 'rTRC';
const TAG_GTRC = 'gTRC';
const TAG_BTRC = 'bTRC';

/** Number of required tags. */
const TAG_COUNT = 9;

// ---------------------------------------------------------------------------
// Profile generator
// ---------------------------------------------------------------------------

/**
 * Generate a minimal sRGB ICC v2 profile.
 *
 * The resulting profile is a valid ICC v2.1.0 profile containing the
 * minimum set of tags required for a Display profile with 'RGB ' color
 * space and 'XYZ ' PCS:
 *
 * - `desc` — profile description ("sRGB IEC61966-2.1")
 * - `cprt` — copyright notice
 * - `wtpt` — media white point (D50)
 * - `rXYZ`, `gXYZ`, `bXYZ` — red/green/blue colorant XYZ values
 * - `rTRC`, `gTRC`, `bTRC` — red/green/blue tone response curves (gamma 2.2)
 *
 * @returns Raw ICC profile bytes (Uint8Array).
 */
export function generateSrgbIccProfile(): Uint8Array {
  // --- Build all tag data ---
  const descData = buildDescTag('sRGB IEC61966-2.1');
  const cprtData = buildTextTag('No copyright, use freely');
  const wtptData = buildXyzTag(D50_WHITE_X, D50_WHITE_Y, D50_WHITE_Z);
  const rXYZData = buildXyzTag(SRGB_RED_X, SRGB_RED_Y, SRGB_RED_Z);
  const gXYZData = buildXyzTag(SRGB_GREEN_X, SRGB_GREEN_Y, SRGB_GREEN_Z);
  const bXYZData = buildXyzTag(SRGB_BLUE_X, SRGB_BLUE_Y, SRGB_BLUE_Z);
  const rTRCData = buildCurveTag(SRGB_GAMMA);
  const gTRCData = buildCurveTag(SRGB_GAMMA);
  const bTRCData = buildCurveTag(SRGB_GAMMA);

  const tagDataList = [
    { sig: TAG_DESC, data: descData },
    { sig: TAG_CPRT, data: cprtData },
    { sig: TAG_WTPT, data: wtptData },
    { sig: TAG_RXYZ, data: rXYZData },
    { sig: TAG_GXYZ, data: gXYZData },
    { sig: TAG_BXYZ, data: bXYZData },
    { sig: TAG_RTRC, data: rTRCData },
    { sig: TAG_GTRC, data: gTRCData },
    { sig: TAG_BTRC, data: bTRCData },
  ];

  // --- Compute layout ---

  // Header: 128 bytes
  // Tag count: 4 bytes
  // Tag table: TAG_COUNT * 12 bytes
  const headerSize = 128;
  const tagTableOffset = headerSize + 4;
  const tagTableSize = TAG_COUNT * 12;
  let dataOffset = tagTableOffset + tagTableSize;

  // Align data offset to 4-byte boundary
  dataOffset = (dataOffset + 3) & ~3;

  // Calculate tag offsets and the total profile size
  const tagEntries: Array<{ sig: string; offset: number; size: number }> = [];
  let currentOffset = dataOffset;

  for (const { sig, data } of tagDataList) {
    tagEntries.push({ sig, offset: currentOffset, size: data.length });
    // Advance offset, aligning each tag to 4-byte boundary
    currentOffset += data.length;
    currentOffset = (currentOffset + 3) & ~3;
  }

  const profileSize = currentOffset;

  // --- Assemble the profile ---

  const profile = new Uint8Array(profileSize);

  // --- Header (128 bytes) ---

  // Offset 0-3: Profile size
  writeU32(profile, 0, profileSize);

  // Offset 4-7: Preferred CMM type (0 = no preference)
  // already 0

  // Offset 8-11: Profile version (2.1.0)
  //   major.minor.bugfix encoded as: major(8bit) . minor-hi(4bit) minor-lo(4bit) . 0 0
  profile[8] = 2; // major version 2
  profile[9] = 0x10; // minor version 1.0

  // Offset 12-15: Device class: 'mntr' (display)
  writeAscii(profile, 12, 'mntr', 4);

  // Offset 16-19: Color space: 'RGB '
  writeAscii(profile, 16, 'RGB ', 4);

  // Offset 20-23: Profile Connection Space: 'XYZ '
  writeAscii(profile, 20, 'XYZ ', 4);

  // Offset 24-35: Date/time (12 bytes): 2025-01-01 00:00:00 UTC
  writeU16(profile, 24, 2025); // year
  writeU16(profile, 26, 1);    // month
  writeU16(profile, 28, 1);    // day
  writeU16(profile, 30, 0);    // hour
  writeU16(profile, 32, 0);    // minute
  writeU16(profile, 34, 0);    // second

  // Offset 36-39: Profile file signature: 'acsp'
  writeAscii(profile, 36, 'acsp', 4);

  // Offset 40-43: Primary platform: 'APPL' (Apple) — widely compatible
  writeAscii(profile, 40, 'APPL', 4);

  // Offset 44-47: Profile flags (0 = not embedded, not independent)
  // already 0

  // Offset 48-51: Device manufacturer (0 = none)
  // already 0

  // Offset 52-55: Device model (0 = none)
  // already 0

  // Offset 56-63: Device attributes (8 bytes, 0 = reflective, glossy, positive, color)
  // already 0

  // Offset 64-67: Rendering intent (0 = perceptual)
  // already 0

  // Offset 68-79: PCS illuminant (D50 in s15Fixed16)
  writeS15Fixed16(profile, 68, D50_WHITE_X);
  writeS15Fixed16(profile, 72, D50_WHITE_Y);
  writeS15Fixed16(profile, 76, D50_WHITE_Z);

  // Offset 80-83: Profile creator (0 = none)
  // already 0

  // Offset 84-99: Profile ID / MD5 (16 bytes, 0 = not computed)
  // already 0

  // Offset 100-127: Reserved (28 bytes, 0)
  // already 0

  // --- Tag count (4 bytes at offset 128) ---
  writeU32(profile, headerSize, TAG_COUNT);

  // --- Tag table ---
  for (let i = 0; i < tagEntries.length; i++) {
    const entry = tagEntries[i]!;
    const tableOffset = tagTableOffset + i * 12;
    writeAscii(profile, tableOffset, entry.sig, 4);
    writeU32(profile, tableOffset + 4, entry.offset);
    writeU32(profile, tableOffset + 8, entry.size);
  }

  // --- Tag data ---
  for (let i = 0; i < tagDataList.length; i++) {
    const { data } = tagDataList[i]!;
    const { offset } = tagEntries[i]!;
    profile.set(data, offset);
  }

  return profile;
}

/**
 * Pre-generated sRGB ICC profile (cached).
 *
 * This is computed once at module load time. The profile is a minimal
 * valid ICC v2.1.0 sRGB profile suitable for embedding in PDF/A
 * OutputIntent dictionaries.
 */
export const SRGB_ICC_PROFILE: Uint8Array = generateSrgbIccProfile();

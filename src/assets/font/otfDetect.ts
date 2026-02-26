/**
 * @module assets/font/otfDetect
 *
 * Detection helpers for distinguishing CFF-based OpenType fonts from
 * TrueType-based fonts based on their magic bytes.
 *
 * CFF-based OpenType fonts (OTF) start with the ASCII bytes "OTTO".
 * TrueType fonts start with 0x00010000 or the ASCII bytes "true".
 */

/**
 * Detect whether font data is an OpenType font with CFF outlines.
 * CFF-based OpenType fonts start with the ASCII bytes "OTTO".
 * TrueType-based OpenType fonts start with 0x00010000 or "true".
 *
 * @param data - Raw font file bytes.
 * @returns `true` if the font is a CFF-based OpenType font.
 */
export function isOpenTypeCFF(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return (
    data[0] === 0x4F && // O
    data[1] === 0x54 && // T
    data[2] === 0x54 && // T
    data[3] === 0x4F    // O
  );
}

/**
 * Detect whether font data is a TrueType font.
 *
 * @param data - Raw font file bytes.
 * @returns `true` if the font is a TrueType font.
 */
export function isTrueType(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  // 0x00010000 — standard TrueType
  if (data[0] === 0x00 && data[1] === 0x01 && data[2] === 0x00 && data[3] === 0x00) return true;
  // "true" — alternate TrueType magic
  if (data[0] === 0x74 && data[1] === 0x72 && data[2] === 0x75 && data[3] === 0x65) return true;
  return false;
}

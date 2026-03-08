/**
 * @module utils/encoding
 *
 * PDF string encoding and decoding utilities.
 *
 * PDF supports two primary text encodings:
 *
 * 1. **PDFDocEncoding** — a single-byte superset of Latin-1 (ISO 8859-1)
 *    used for text strings in annotations, bookmarks, etc.
 * 2. **UTF-16BE** — preceded by the BOM `0xFEFF`; used when characters
 *    outside PDFDocEncoding are needed.
 *
 * This module also provides helpers for PDF name encoding (`#XX`),
 * hex-string encoding, literal-string escaping, and the D: date
 * format.
 *
 * **No Buffer.**  All byte operations use `Uint8Array`.
 */

// ---------------------------------------------------------------------------
// Shared encoder/decoder
// ---------------------------------------------------------------------------

let _enc: TextEncoder | undefined;
function enc(): TextEncoder {
  return (_enc ??= new TextEncoder());
}

// ---------------------------------------------------------------------------
// PDFDocEncoding (Latin-1 approximation)
// ---------------------------------------------------------------------------

/**
 * Encode a JavaScript string to PDFDocEncoding (Latin-1 compatible).
 *
 * Characters outside the range U+0000..U+00FF are replaced with `?`
 * (0x3F).  For full Unicode support, use {@link encodeToUtf16BE}.
 *
 * @param str  Input string.
 * @returns    Single-byte encoded bytes.
 */
export function encodeToLatin1(str: string): Uint8Array {
  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // PDFDocEncoding is a superset of Latin-1 for 0x00-0xFF.
    // Characters above U+00FF are not representable.
    result[i] = code <= 0xff ? code : 0x3f; // '?'
  }
  return result;
}

/**
 * Decode a PDFDocEncoding (Latin-1) byte array to a JavaScript string.
 *
 * @param data  Single-byte encoded bytes.
 * @returns     Decoded string.
 */
export function decodeLatin1(data: Uint8Array): string {
  return new TextDecoder('latin1').decode(data);
}

// ---------------------------------------------------------------------------
// UTF-16BE
// ---------------------------------------------------------------------------

/** UTF-16BE byte-order mark. */
const UTF16BE_BOM = new Uint8Array([0xfe, 0xff]);

/**
 * Encode a JavaScript string to UTF-16BE with a BOM prefix.
 *
 * The BOM (`0xFEFF`) tells PDF readers that the string is UTF-16BE
 * rather than PDFDocEncoding.
 *
 * @param str  Input string.
 * @returns    UTF-16BE bytes, BOM-prefixed.
 */
export function encodeToUtf16BE(str: string): Uint8Array {
  // Each JS char is a UTF-16 code unit.  Surrogate pairs are already
  // two code units, so iterating by charCodeAt naturally gives us the
  // UTF-16 representation.
  const byteLength = 2 + str.length * 2; // BOM + 2 bytes per code unit
  const result = new Uint8Array(byteLength);

  // Write BOM
  result[0] = UTF16BE_BOM[0]!;
  result[1] = UTF16BE_BOM[1]!;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const offset = 2 + i * 2;
    result[offset] = (code >> 8) & 0xff;     // high byte
    result[offset + 1] = code & 0xff;        // low byte
  }

  return result;
}

/**
 * Decode a UTF-16BE byte array (with or without BOM) to a JavaScript
 * string.
 *
 * @param data  UTF-16BE encoded bytes.
 * @returns     Decoded string.
 */
export function decodeUtf16BE(data: Uint8Array): string {
  let offset = 0;

  // Skip BOM if present
  if (
    data.length >= 2 &&
    data[0] === 0xfe &&
    data[1] === 0xff
  ) {
    offset = 2;
  }

  return new TextDecoder('utf-16be').decode(data.subarray(offset));
}

// ---------------------------------------------------------------------------
// PDF literal string escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside a PDF literal string `(...)`.
 *
 * The following characters are escaped with a backslash:
 * - `\` -> `\\`
 * - `(` -> `\(`
 * - `)` -> `\)`
 * - `\n` -> `\\n`
 * - `\r` -> `\\r`
 * - `\t` -> `\\t`
 * - `\b` -> `\\b`
 * - `\f` -> `\\f`
 *
 * @param str  Raw string.
 * @returns    Escaped string (without surrounding parentheses).
 */
export function escapePdfString(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!;
    switch (ch) {
      case '\\': result += '\\\\'; break;
      case '(':  result += '\\(';  break;
      case ')':  result += '\\)';  break;
      case '\n': result += '\\n';  break;
      case '\r': result += '\\r';  break;
      case '\t': result += '\\t';  break;
      case '\b': result += '\\b';  break;
      case '\f': result += '\\f';  break;
      default:   result += ch;     break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hex string encoding
// ---------------------------------------------------------------------------

/**
 * Encode raw bytes as a PDF hex string, including the angle brackets.
 *
 * Example: `<48656C6C6F>` for the bytes of "Hello".
 *
 * @param data  Raw bytes.
 * @returns     Hex string with `<` and `>` delimiters.
 */
export function encodeHexString(data: Uint8Array): string {
  return `<${data.toHex().toUpperCase()}>`;
}

// ---------------------------------------------------------------------------
// PDF name encoding
// ---------------------------------------------------------------------------

/**
 * Encode a string as a PDF name token.
 *
 * Characters outside the printable ASCII range (0x21..0x7E) and the
 * special characters `#`, `(`, `)`, `<`, `>`, `[`, `]`, `{`, `}`,
 * `/`, `%` are encoded as `#XX` where XX is the two-digit uppercase
 * hex of the byte value.
 *
 * The leading `/` is **not** included; callers should prepend it.
 *
 * @param name  The raw name string.
 * @returns     The encoded name (without leading `/`).
 */
export function encodePdfName(name: string): string {
  const bytes = enc().encode(name);
  let result = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (isRegularNameByte(b)) {
      result += String.fromCharCode(b);
    } else {
      result += '#' + b.toString(16).padStart(2, '0').toUpperCase();
    }
  }

  return result;
}

/**
 * Returns `true` if the byte can appear unescaped in a PDF name token.
 *
 * Allowed: printable ASCII excluding the "delimiter" and "special"
 * characters defined in PDF 1.7 section 7.2.
 */
function isRegularNameByte(b: number): boolean {
  // Must be printable ASCII: 0x21..0x7E
  if (b < 0x21 || b > 0x7e) return false;
  // Disallowed: # ( ) < > [ ] { } / %
  switch (b) {
    case 0x23: // #
    case 0x28: // (
    case 0x29: // )
    case 0x3c: // <
    case 0x3e: // >
    case 0x5b: // [
    case 0x5d: // ]
    case 0x7b: // {
    case 0x7d: // }
    case 0x2f: // /
    case 0x25: // %
      return false;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// PDF date formatting
// ---------------------------------------------------------------------------

/**
 * Format a `Date` as a PDF date string.
 *
 * PDF date format: `D:YYYYMMDDHHmmSSOHH'mm`
 *
 * - `O` is the UTC offset sign (`+`, `-`, or `Z`).
 * - The trailing `HH'mm` is the UTC offset hours and minutes.
 *
 * Example: `D:20240115143052+05'30`
 *
 * @param date  The date to format.
 * @returns     A PDF date string.
 */
export function formatPdfDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  // Timezone offset
  const tzOffset = date.getTimezoneOffset(); // in minutes, positive = west of UTC
  if (tzOffset === 0) {
    return `D:${year}${month}${day}${hours}${minutes}${seconds}Z`;
  }

  const sign = tzOffset > 0 ? '-' : '+';
  const absOffset = Math.abs(tzOffset);
  const tzHours = Math.floor(absOffset / 60).toString().padStart(2, '0');
  const tzMinutes = (absOffset % 60).toString().padStart(2, '0');

  return `D:${year}${month}${day}${hours}${minutes}${seconds}${sign}${tzHours}'${tzMinutes}`;
}

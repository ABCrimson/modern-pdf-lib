/**
 * @module internal/latin1
 *
 * PDF byte strings as bytes. A PDF byte string holds one code unit per byte,
 * U+0000 to U+00FF (ISO 8859-1, Latin-1): the form in which the library's
 * writers take the strings an object's `serialize()` hands them. No package
 * entry exports this module.
 */

import { UnencodableTextError } from '../errors.js';

/**
 * The bytes of a PDF byte string: each code unit 0x00-0xFF of `str` is one
 * byte of the same value, so `latin1Bytes('é')` is `[0xE9]`.
 *
 * @param str - The byte string.
 * @returns     A new array of `str.length` bytes.
 * @throws {UnencodableTextError} For the first code unit above 0xFF, with the
 *   encoding `PDF byte string`; a surrogate pair is reported as one character.
 */
export function latin1Bytes(str: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const unit = str.charCodeAt(i);
    if (unit > 0xff) {
      // codePointAt is defined at an index inside str; `?? unit` only narrows its type.
      const character = String.fromCodePoint(str.codePointAt(i) ?? unit);
      throw new UnencodableTextError({
        character,
        index: i,
        fontName: undefined,
        encoding: 'PDF byte string',
      });
    }
    bytes[i] = unit;
  }
  return bytes;
}

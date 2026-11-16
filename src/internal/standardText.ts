/**
 * @module internal/standardText
 *
 * Text that a writer shows in a font it knows only by name: the resource name
 * of `/Font` for a layout, a barcode label, an SVG `<text>` or an OCR word.
 * {@link encodeTextForFontName} turns the text into the codes of the font's
 * encoding, and {@link showEncodedText} writes them as a `Tj` operator in
 * ASCII, so the content stream holds the same bytes whatever encoding the page
 * applies to the text of its operators. No package entry exports this module.
 */

import { encodeStandardText } from '../assets/font/internal/standardEncoding.js';
import { isStandardFont, type StandardFontName } from '../assets/font/internal/standardFonts.js';

/**
 * The names an AcroForm default appearance gives the 14 standard fonts
 * (`/Helv`, `/ZaDb`, ...), each with the standard font it stands for.
 */
const ACROFORM_ALIASES: ReadonlyMap<string, StandardFontName> = new Map([
  ['Helv', 'Helvetica'],
  ['HeBo', 'Helvetica-Bold'],
  ['HeOb', 'Helvetica-Oblique'],
  ['HeBO', 'Helvetica-BoldOblique'],
  ['TiRo', 'Times-Roman'],
  ['TiBo', 'Times-Bold'],
  ['TiIt', 'Times-Italic'],
  ['TiBI', 'Times-BoldItalic'],
  ['Cour', 'Courier'],
  ['CoBo', 'Courier-Bold'],
  ['CoOb', 'Courier-Oblique'],
  ['CoBO', 'Courier-BoldOblique'],
  ['Symb', 'Symbol'],
  ['ZaDb', 'ZapfDingbats'],
]);

/**
 * The codes of `text` for the font that `fontName` names: the encoding of a
 * standard font name or AcroForm alias, WinAnsiEncoding for any other name (a
 * font with no registered font object is written in WinAnsiEncoding). Text is
 * normalised to NFC first.
 *
 * @param fontName - The name of the font resource, or a standard font name.
 * @param text     - The text to show.
 * @returns          One code per character.
 * @throws {UnencodableTextError} At the first character the encoding has no
 *   code for; its `fontName` is the standard font whose encoding was used.
 */
export function encodeTextForFontName(fontName: string, text: string): Uint8Array {
  const alias = ACROFORM_ALIASES.get(fontName);
  const font = alias ?? (isStandardFont(fontName) ? fontName : 'Helvetica');
  return encodeStandardText(font, text);
}

/** Two-character escapes of a literal string for the control characters that have one. */
const CONTROL_ESCAPES: ReadonlyMap<number, string> = new Map([
  [0x0d, '\\r'],
  [0x0a, '\\n'],
  [0x09, '\\t'],
  [0x08, '\\b'],
  [0x0c, '\\f'],
]);

/**
 * `codes` as a literal string, in parentheses: the bytes 0x20-0x7E as
 * themselves but for `(`, `)` and the backslash, which are escaped, CR, LF,
 * TAB, BS and FF as their two-character escapes, and every other byte as a
 * 3-digit octal escape.
 */
export function encodedStringLiteral(codes: Uint8Array): string {
  let body = '';
  for (const code of codes) {
    if (code === 0x28 || code === 0x29 || code === 0x5c) body += `\\${String.fromCharCode(code)}`;
    else if (code >= 0x20 && code <= 0x7e) body += String.fromCharCode(code);
    else body += CONTROL_ESCAPES.get(code) ?? `\\${code.toString(8).padStart(3, '0')}`;
  }
  return `(${body})`;
}

/** The `Tj` operator, with its line end, that shows `codes` as {@link encodedStringLiteral} writes them. */
export function showEncodedText(codes: Uint8Array): string {
  return `${encodedStringLiteral(codes)} Tj\n`;
}

/**
 * @module form/internal/appearanceText
 *
 * Text shown in the appearance stream of a form field. The stream names its
 * font only by a resource name, such as the one of the /DA string, so the
 * name decides the encoding of the text: a standard font name, or one of the
 * resource names Acrobat gives the standard fonts in the /DR of a form
 * (Helv, ZaDb and the others below), encodes through that font; any other
 * name encodes WinAnsiEncoding, the encoding of the standard fonts the
 * library writes.
 */

import { encodeStandardText } from '../../assets/font/internal/standardEncoding.js';
import { isStandardFont, type StandardFontName } from '../../assets/font/internal/standardFonts.js';

/** The resource names of the standard fonts in the /DR of a form Acrobat writes. */
const ACROFORM_FONT_NAMES: ReadonlyMap<string, StandardFontName> = new Map([
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

/** The standard font whose encoding text shown under the resource name `fontName` takes. */
function standardFontOf(fontName: string): StandardFontName {
  if (isStandardFont(fontName)) return fontName;
  return ACROFORM_FONT_NAMES.get(fontName) ?? 'Helvetica';
}

/**
 * The body of a literal string holding `codes`: ( ) and the backslash
 * escaped, the other codes 0x20-0x7E as they are, every other code as a
 * 3-digit octal escape, so the stream holds ASCII only.
 */
function literalBody(codes: Uint8Array): string {
  let body = '';
  for (const code of codes) {
    if (code === 0x28 || code === 0x29 || code === 0x5c) body += `\\${String.fromCharCode(code)}`;
    else if (code >= 0x20 && code <= 0x7e) body += String.fromCharCode(code);
    else body += `\\${code.toString(8).padStart(3, '0')}`;
  }
  return body;
}

/**
 * A `Tj` operator that shows `text` in the font with the resource name
 * `fontName`, its codes in a literal string.
 *
 * @throws {UnencodableTextError} At the first character the encoding of the
 *   font has no code for.
 */
export function showTextInFont(fontName: string, text: string): string {
  return `(${literalBody(encodeStandardText(standardFontOf(fontName), text))}) Tj\n`;
}

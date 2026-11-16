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

import { showText } from '../../core/operators/text.js';
import {
  encodeStandardText,
  standardFontForName,
} from '../../assets/font/internal/standardEncoding.js';

/**
 * A `Tj` operator that shows `text` in the font with the resource name
 * `fontName`, its codes in a literal string in ASCII.
 *
 * @throws {UnencodableTextError} At the first character the encoding of the
 *   font has no code for.
 */
export function showTextInFont(fontName: string, text: string): string {
  return showText(encodeStandardText(standardFontForName(fontName) ?? 'Helvetica', text));
}

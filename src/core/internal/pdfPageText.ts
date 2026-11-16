/**
 * @module core/internal/pdfPageText
 *
 * Pure functions for text wrapping, word breaking and the encoding of text
 * for a font known by name.  Extracted from {@link pdfPage} to keep the
 * PdfPage class focused on drawing logic.
 */

import { UnencodableTextError } from '../../errors.js';
import { encodeStandardText } from '../../assets/font/internal/standardEncoding.js';
import { isStandardFont } from '../../assets/font/internal/standardFonts.js';
import type { StandardFontName } from '../../assets/font/internal/standardFonts.js';
import type { FontRef } from '../pdfPage.js';

// ---------------------------------------------------------------------------
// Text encoding by font name
// ---------------------------------------------------------------------------

/** The standard font of each AcroForm default-appearance font name (the Acrobat set). */
const FORM_FONT_ALIASES: ReadonlyMap<string, StandardFontName> = new Map([
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
 * Encodes `text` for a font known only by its name: one of the 14 standard
 * font names or an AcroForm alias (`Helv`, `ZaDb`, ...) in the encoding of
 * that standard font, any other name in WinAnsiEncoding.
 *
 * @param name  A standard font name or a font resource name.
 * @param text  The text to encode.
 * @returns     One byte per character, after NFC normalisation.
 * @throws {UnencodableTextError} At the first character the encoding has no
 *   code for; for a name that is no standard font, the error names `name`.
 */
export function encodeTextForFontName(name: string, text: string): Uint8Array {
  const standard = isStandardFont(name) ? name : FORM_FONT_ALIASES.get(name);
  if (standard !== undefined) return encodeStandardText(standard, text);
  try {
    // The 12 Latin standard fonts share WinAnsiEncoding.
    return encodeStandardText('Helvetica', text);
  } catch (error) {
    if (!(error instanceof UnencodableTextError)) throw error;
    const { character, index, encoding } = error;
    throw new UnencodableTextError(
      { character, index, fontName: name, encoding },
      { cause: error },
    );
  }
}

/**
 * Splits `text` into lines at CRLF, CR and LF and encodes each line.
 *
 * @param text    The text, possibly of several lines.
 * @param encode  Encodes one line, such as `FontRef.encodeText`.
 * @returns       The lines and their bytes, in order.
 * @throws {UnencodableTextError} From `encode`, with `index` counted in `text`.
 */
export function encodeLines(
  text: string,
  encode: (line: string) => Uint8Array,
): { readonly lines: string[]; readonly encoded: Uint8Array[] } {
  const lines = text.split(/\r\n|\r|\n/);
  const encoded: Uint8Array[] = [];
  let offset = 0;
  for (const line of lines) {
    try {
      encoded.push(encode(line));
    } catch (error) {
      if (!(error instanceof UnencodableTextError) || offset === 0) throw error;
      const { character, index, fontName, encoding } = error;
      throw new UnencodableTextError(
        { character, index: offset + index, fontName, encoding },
        { cause: error },
      );
    }
    offset += line.length + (text.startsWith('\r\n', offset + line.length) ? 2 : 1);
  }
  return { lines, encoded };
}

// ---------------------------------------------------------------------------
// Text wrapping
// ---------------------------------------------------------------------------

/**
 * Break a single line of text into multiple lines that fit within `maxWidth`.
 *
 * @param text      The input text (a single line, no newlines).
 * @param maxWidth  Maximum width in points.
 * @param font      A FontRef with `widthOfTextAtSize`, or a string name.
 * @param size      Font size in points.
 * @returns         An array of wrapped lines.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: FontRef | string,
  size: number,
  wordBreaks?: string[],
): string[] {
  // If font is a string, we have no measurement capability — return as-is
  if (typeof font === 'string') {
    return [text];
  }

  // If text fits on one line, return as-is
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return [text];
  }

  const breaks = wordBreaks ?? [' '];

  // Build a regex that splits text into segments (word + trailing break char).
  // Using a capturing group in split keeps the separators in the result array.
  const escaped = breaks.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`);
  const parts = text.split(pattern);

  // Reassemble into "tokens" where each token is a word plus its trailing
  // separator (if any).  For space breaks the separator is consumed (not
  // appended to the token), matching the traditional behaviour.
  const tokens: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const segment = parts[i]!;
    const sep = i + 1 < parts.length ? parts[i + 1]! : '';
    if (sep === ' ') {
      // Space separator: token is just the word (space is consumed)
      tokens.push(segment);
      i += 2;
    } else if (sep !== '' && breaks.includes(sep)) {
      // Non-space separator: attach it to the end of the token
      tokens.push(segment + sep);
      i += 2;
    } else {
      // No separator (last segment)
      tokens.push(segment);
      i += 1;
    }
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const token of tokens) {
    // Skip empty tokens that can result from consecutive separators
    if (token === '') continue;

    if (currentLine === '') {
      // Starting a new line.  Check if the token itself fits.
      if (font.widthOfTextAtSize(token, size) <= maxWidth) {
        currentLine = token;
      } else {
        // Token exceeds maxWidth — break at character level
        const charLines = breakWord(token, maxWidth, font, size);
        for (let j = 0; j < charLines.length - 1; j++) {
          lines.push(charLines[j]!);
        }
        currentLine = charLines.at(-1)!;
      }
    } else {
      // Determine the glue between the current line and the next token.
      // If the current line already ends with a non-space break character,
      // no extra space is needed.  Otherwise join with a space (when space
      // is a break character) or directly concatenate.
      const lastChar = currentLine.at(-1)!;
      const glue =
        breaks.includes(' ') && !breaks.some((b) => b !== ' ' && lastChar === b) ? ' ' : '';
      const candidate = currentLine + glue + token;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
      } else {
        // Current line is full — push it and start a new line
        lines.push(currentLine);

        // Check if the token itself fits on a fresh line
        if (font.widthOfTextAtSize(token, size) <= maxWidth) {
          currentLine = token;
        } else {
          // Token exceeds maxWidth — break at character level
          const charLines = breakWord(token, maxWidth, font, size);
          for (let j = 0; j < charLines.length - 1; j++) {
            lines.push(charLines[j]!);
          }
          currentLine = charLines.at(-1)!;
        }
      }
    }
  }

  // Push the remaining text
  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Word breaking
// ---------------------------------------------------------------------------

/**
 * Break a single word into fragments that fit within `maxWidth`
 * by splitting at the character level.
 *
 * @param word      The word to break.
 * @param maxWidth  Maximum width in points.
 * @param font      A FontRef with measurement capabilities.
 * @param size      Font size in points.
 * @returns         Array of character-level fragments.
 */
export function breakWord(word: string, maxWidth: number, font: FontRef, size: number): string[] {
  const fragments: string[] = [];
  let current = '';

  for (const char of word) {
    const candidate = current + char;
    if (current !== '' && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }

  if (current !== '') {
    fragments.push(current);
  }

  return fragments;
}

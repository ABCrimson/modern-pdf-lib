/**
 * @module core/pdfPageText
 *
 * Pure functions for text wrapping and word breaking.  Extracted from
 * {@link pdfPage} to keep the PdfPage class focused on drawing logic.
 */

import type { FontRef } from './pdfPage.js';

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
  const escaped = breaks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
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
      const glue = breaks.includes(' ') && !breaks.some(b => b !== ' ' && lastChar === b)
        ? ' '
        : '';
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
export function breakWord(
  word: string,
  maxWidth: number,
  font: FontRef,
  size: number,
): string[] {
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

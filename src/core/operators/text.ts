/**
 * @module core/operators/text
 *
 * PDF text operators — generates the raw operator strings that appear
 * inside a page content stream.  Every function returns a plain string
 * (one or more PDF operators terminated by '\n').
 *
 * Reference: PDF 1.7 spec, §9.4 (Text Objects) & §9.3 (Text State).
 *
 * The text-showing operators take bytes (a {@link PdfTextOperand}) and write
 * ASCII only, so a content stream holds the bytes the font encoding gave.
 */

import { InvalidArgumentError } from '../../errors.js';
import { latin1Bytes } from '../../internal/latin1.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The operand of a text-showing operator: the bytes of a PDF string, as a
 * `Uint8Array` or as a PDF byte string (each code unit U+0000 to U+00FF is
 * one byte). Text becomes these bytes through its font: `FontRef.encodeText`.
 */
export type PdfTextOperand = string | Uint8Array;

/** The two-character escapes of a literal string body (ISO 32000-2 Table 3). */
const NAMED_ESCAPES: ReadonlyMap<number, string> = new Map([
  [0x08, '\\b'],
  [0x09, '\\t'],
  [0x0a, '\\n'],
  [0x0c, '\\f'],
  [0x0d, '\\r'],
  [0x28, '\\('],
  [0x29, '\\)'],
  [0x5c, '\\\\'],
]);

/**
 * The body of a literal string `(…)` for the bytes of `operand`, in ASCII:
 * bytes 0x20 to 0x7E stay but for `(`, `)` and the backslash, which are
 * escaped; CR, LF, TAB, BS and FF take their two-character escapes; every
 * other byte is a 3-digit octal escape.
 *
 * @throws {UnencodableTextError} For a string operand with a code unit above
 *   0xFF (encoding `PDF byte string`).
 */
function literalBody(operand: PdfTextOperand): string {
  const bytes = typeof operand === 'string' ? latin1Bytes(operand) : operand;
  let body = '';
  for (const byte of bytes) {
    body +=
      NAMED_ESCAPES.get(byte) ??
      (byte >= 0x20 && byte <= 0x7e
        ? String.fromCharCode(byte)
        : `\\${byte.toString(8).padStart(3, '0')}`);
  }
  return body;
}

/**
 * Format a number for PDF output — at most 6 decimal places, no trailing
 * zeros, no unnecessary decimal point.
 */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  // Limit precision and strip trailing zeros
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// Text object operators
// ---------------------------------------------------------------------------

/**
 * Begin a text object (`BT`).
 *
 * All text-showing operators must appear between a `BT` / `ET` pair.
 */
export function beginText(): string {
  return 'BT\n';
}

/**
 * End the current text object (`ET`).
 */
export function endText(): string {
  return 'ET\n';
}

// ---------------------------------------------------------------------------
// Text state operators
// ---------------------------------------------------------------------------

/**
 * Select font and size (`Tf`).
 *
 * @param fontName  Resource name of the font (e.g. `/F1`).  The leading
 *                  slash is added automatically if absent.
 * @param size      Font size in user-space units.
 */
export function setFont(fontName: string, size: number): string {
  const name = fontName.startsWith('/') ? fontName : `/${fontName}`;
  return `${name} ${n(size)} Tf\n`;
}

/**
 * Set the font size only — alias for `setFont` when the font has already
 * been selected.
 *
 * @param fontName  Resource name of the font.
 * @param size      Font size in user-space units.
 */
export function setFontSize(fontName: string, size: number): string {
  return setFont(fontName, size);
}

/**
 * Set the text leading — the vertical distance between baselines of
 * consecutive lines (`TL`).
 *
 * @param leading  Leading value in user-space units.
 */
export function setLeading(leading: number): string {
  return `${n(leading)} TL\n`;
}

/**
 * Set the character spacing (`Tc`).
 *
 * @param spacing  Extra space (in unscaled text-space units) to add
 *                 between each pair of characters.
 */
export function setCharacterSpacing(spacing: number): string {
  return `${n(spacing)} Tc\n`;
}

/**
 * Set the word spacing (`Tw`).
 *
 * @param spacing  Extra space (in unscaled text-space units) to add
 *                 when a space character (0x20) is encountered.
 */
export function setWordSpacing(spacing: number): string {
  return `${n(spacing)} Tw\n`;
}

/**
 * Set the text rise (super / subscript offset) (`Ts`).
 *
 * @param rise  Distance, in unscaled text-space units, to move the
 *              baseline up (positive) or down (negative).
 */
export function setTextRise(rise: number): string {
  return `${n(rise)} Ts\n`;
}

/**
 * Set the text rendering mode (`Tr`).
 *
 * | Value | Meaning            |
 * |-------|--------------------|
 * | 0     | Fill               |
 * | 1     | Stroke             |
 * | 2     | Fill then stroke   |
 * | 3     | Invisible          |
 * | 4     | Fill and clip      |
 * | 5     | Stroke and clip    |
 * | 6     | Fill, stroke, clip |
 * | 7     | Clip               |
 */
export function setTextRenderingMode(mode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7): string {
  return `${mode} Tr\n`;
}

// ---------------------------------------------------------------------------
// Text positioning operators
// ---------------------------------------------------------------------------

/**
 * Set the text matrix and text line matrix (`Tm`).
 *
 * The six operands form a standard 3 × 3 transformation matrix:
 *
 * ```
 * [ a  b  0 ]
 * [ c  d  0 ]
 * [ tx ty 1 ]
 * ```
 *
 * @param a   Horizontal scaling.
 * @param b   Rotation component (sin).
 * @param c   Rotation component (−sin).
 * @param d   Vertical scaling.
 * @param tx  Horizontal translation.
 * @param ty  Vertical translation.
 */
export function setTextMatrix(
  a: number,
  b: number,
  c: number,
  d: number,
  tx: number,
  ty: number,
): string {
  return `${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(tx)} ${n(ty)} Tm\n`;
}

/**
 * Move to the start of the next line, offset by `(tx, ty)` (`Td`).
 *
 * @param tx  Horizontal offset from the start of the current line.
 * @param ty  Vertical offset from the start of the current line.
 */
export function moveText(tx: number, ty: number): string {
  return `${n(tx)} ${n(ty)} Td\n`;
}

/**
 * Move to the start of the next line, offset by `(tx, ty)`, and set the
 * leading to `-ty` (`TD`).
 *
 * Equivalent to: `-ty TL` followed by `tx ty Td`.
 */
export function moveTextSetLeading(tx: number, ty: number): string {
  return `${n(tx)} ${n(ty)} TD\n`;
}

/**
 * Move to the start of the next line (`T*`).
 *
 * Equivalent to `0 -TL Td` where TL is the current leading.
 */
export function nextLine(): string {
  return 'T*\n';
}

// ---------------------------------------------------------------------------
// Text showing operators
// ---------------------------------------------------------------------------

/**
 * Show a string (`Tj`), written as a literal string in ASCII.
 *
 * @param text  The bytes to show; for text, the bytes of `font.encodeText(text)`.
 * @throws {UnencodableTextError} For a string with a code unit above U+00FF
 *   (encoding `PDF byte string`).
 */
export function showText(text: PdfTextOperand): string {
  return `(${literalBody(text)}) Tj\n`;
}

/**
 * Show a string written as a hex string (`<…> Tj`), as for the 2-byte glyph
 * ids of an Identity-H font.
 *
 * @param hex  The bytes to show, or hex digits (e.g. `"00480065006C"`),
 *             written as given.
 * @throws {InvalidArgumentError} For a string that holds anything but the hex
 *   digits 0-9, A-F and a-f (argument `hex`).
 */
export function showTextHex(hex: string | Uint8Array): string {
  if (typeof hex !== 'string') return `<${hex.toHex()}> Tj\n`;
  if (!/^[\da-fA-F]*$/.test(hex)) {
    throw new InvalidArgumentError(
      'showTextHex takes bytes or the hex digits 0-9, A-F and a-f; for text write showTextHex(font.encodeText(text))',
      { argument: 'hex' },
    );
  }
  return `<${hex}> Tj\n`;
}

/**
 * Show one or more strings with individual glyph positioning (`TJ`).
 *
 * Each element of `items` is either:
 * - a {@link PdfTextOperand}: the bytes of a string to show, or
 * - a `number`: a horizontal adjustment in thousandths of a unit of text
 *   space (negative = move right, positive = move left).
 *
 * @param items  Array of strings and numeric adjustments.
 * @throws {UnencodableTextError} For a string with a code unit above U+00FF
 *   (encoding `PDF byte string`).
 */
export function showTextArray(items: ReadonlyArray<PdfTextOperand | number>): string {
  const inner = items
    .map((item) => (typeof item === 'number' ? n(item) : `(${literalBody(item)})`))
    .join(' ');
  return `[${inner}] TJ\n`;
}

/**
 * Show a string and move to the next line (`'`).
 *
 * Equivalent to `T*` followed by `string Tj`.
 *
 * @param text  The bytes to show.
 * @throws {UnencodableTextError} For a string with a code unit above U+00FF
 *   (encoding `PDF byte string`).
 */
export function showTextNextLine(text: PdfTextOperand): string {
  return `(${literalBody(text)}) '\n`;
}

/**
 * Show a string, set word and character spacing, and move to the next line
 * (`"`).
 *
 * @param wordSpacing  Word spacing.
 * @param charSpacing  Character spacing.
 * @param text         The bytes to show.
 * @throws {UnencodableTextError} For a string with a code unit above U+00FF
 *   (encoding `PDF byte string`).
 */
export function showTextWithSpacing(
  wordSpacing: number,
  charSpacing: number,
  text: PdfTextOperand,
): string {
  return `${n(wordSpacing)} ${n(charSpacing)} (${literalBody(text)}) "\n`;
}

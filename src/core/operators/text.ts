/**
 * @module core/operators/text
 *
 * PDF text operators — generates the raw operator strings that appear
 * inside a page content stream.  Every function returns a plain string
 * (one or more PDF operators terminated by '\n').
 *
 * Reference: PDF 1.7 spec, §9.4 (Text Objects) & §9.3 (Text State).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside a PDF literal string `(…)`.
 * Backslash, open-paren and close-paren must be escaped.
 */
function escapePdfString(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
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
 * Show a text string (`Tj`).
 *
 * @param text  The text to display.  Special characters are escaped.
 */
export function showText(text: string): string {
  return `(${escapePdfString(text)}) Tj\n`;
}

/**
 * Show a text string using a hex-encoded string (`<…> Tj`).
 *
 * Used for CIDFont Type 2 (TrueType) fonts where each character is
 * encoded as a 2-byte glyph ID in hexadecimal.
 *
 * @param hex  The hex-encoded glyph IDs (e.g. `"00480065006C006C006F"`).
 */
export function showTextHex(hex: string): string {
  return `<${hex}> Tj\n`;
}

/**
 * Show one or more text strings with individual glyph positioning (`TJ`).
 *
 * Each element of `items` is either:
 * - a `string` — literal text to show, or
 * - a `number` — a horizontal adjustment in thousandths of a unit of text
 *   space (negative = move right, positive = move left).
 *
 * @param items  Array of strings and numeric adjustments.
 */
export function showTextArray(items: ReadonlyArray<string | number>): string {
  const inner = items
    .map((item) => {
      if (typeof item === 'string') {
        return `(${escapePdfString(item)})`;
      }
      return n(item);
    })
    .join(' ');
  return `[${inner}] TJ\n`;
}

/**
 * Show a text string and move to the next line (`'`).
 *
 * Equivalent to `T*` followed by `string Tj`.
 */
export function showTextNextLine(text: string): string {
  return `(${escapePdfString(text)}) '\n`;
}

/**
 * Show a text string, set word and character spacing, and move to the
 * next line (`"`).
 *
 * @param wordSpacing  Word spacing.
 * @param charSpacing  Character spacing.
 * @param text         Text to show.
 */
export function showTextWithSpacing(
  wordSpacing: number,
  charSpacing: number,
  text: string,
): string {
  return `${n(wordSpacing)} ${n(charSpacing)} (${escapePdfString(text)}) "\n`;
}

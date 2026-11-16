/**
 * @module core/internal/textString
 *
 * The PDF text-string codec (ISO 32000-2 7.9.2.2): the bytes of a text string to its text, and
 * text to the bytes of a text string.
 *
 * - {@link textStringEncoding} names the encoding of the bytes: FE FF is UTF-16BE, FF FE is
 *   UTF-16LE (outside the standard; read only, as pdf.js reads it), EF BB BF is UTF-8, anything
 *   else is PDFDocEncoding.
 * - {@link decodeTextString} decodes the bytes in that encoding and never switches encoding after
 *   a byte order mark: an odd trailing byte of a UTF-16 string is dropped, an ill-formed UTF-16
 *   or UTF-8 sequence decodes to U+FFFD, and language escapes (U+001B, language code, U+001B;
 *   an unclosed one runs to the end) are removed. PDFDocEncoding has no code for U+001B (0x1B is
 *   dotaccent), so its text holds none to remove. A code that Table D.2 leaves undefined decodes
 *   to U+0000 plus the code, as pdf.js reads it.
 * - {@link encodeTextString} writes PDFDocEncoding, UTF-16BE or UTF-8, each of the last two with
 *   its byte order mark. `"auto"` writes PDFDocEncoding when every character is in Table D.2 and
 *   the bytes do not begin with FE FF, FF FE or EF BB BF (they would read back as a byte order
 *   mark), else UTF-16BE; it never writes UTF-8, which needs PDF 2.0.
 * - {@link PDF_DOC_ENCODING} is ISO 32000-2 Annex D Table D.2 for PDFDocEncoding.
 */

import { InvalidArgumentError, UnencodableTextError } from '../../errors.js';

/** Encoding of a text string as read; `"utf-16le"` is read only. */
export type TextStringEncoding = 'pdfdoc' | 'utf-16be' | 'utf-16le' | 'utf-8';

/** Encodings {@link encodeTextString} may write; `"auto"` never picks `"utf-8"`. */
export type TextStringWriteEncoding = 'auto' | 'pdfdoc' | 'utf-16be' | 'utf-8';

/**
 * The PDFDocEncoding codes of Table D.2 whose character is not U+0000 plus the code, with the
 * glyph name of each.
 */
const NOT_LATIN1: readonly (readonly [code: number, unicode: number])[] = [
  [0x18, 0x02d8], // breve
  [0x19, 0x02c7], // caron
  [0x1a, 0x02c6], // circumflex
  [0x1b, 0x02d9], // dotaccent
  [0x1c, 0x02dd], // hungarumlaut
  [0x1d, 0x02db], // ogonek
  [0x1e, 0x02da], // ring
  [0x1f, 0x02dc], // tilde
  [0x80, 0x2022], // bullet
  [0x81, 0x2020], // dagger
  [0x82, 0x2021], // daggerdbl
  [0x83, 0x2026], // ellipsis
  [0x84, 0x2014], // emdash
  [0x85, 0x2013], // endash
  [0x86, 0x0192], // florin
  [0x87, 0x2044], // fraction
  [0x88, 0x2039], // guilsinglleft
  [0x89, 0x203a], // guilsinglright
  [0x8a, 0x2212], // minus
  [0x8b, 0x2030], // perthousand
  [0x8c, 0x201e], // quotedblbase
  [0x8d, 0x201c], // quotedblleft
  [0x8e, 0x201d], // quotedblright
  [0x8f, 0x2018], // quoteleft
  [0x90, 0x2019], // quoteright
  [0x91, 0x201a], // quotesinglbase
  [0x92, 0x2122], // trademark
  [0x93, 0xfb01], // fi
  [0x94, 0xfb02], // fl
  [0x95, 0x0141], // Lslash
  [0x96, 0x0152], // OE
  [0x97, 0x0160], // Scaron
  [0x98, 0x0178], // Ydieresis
  [0x99, 0x017d], // Zcaron
  [0x9a, 0x0131], // dotlessi
  [0x9b, 0x0142], // lslash
  [0x9c, 0x0153], // oe
  [0x9d, 0x0161], // scaron
  [0x9e, 0x017e], // zcaron
  [0xa0, 0x20ac], // Euro
];

/**
 * True for the codes whose character is U+0000 plus the code: TAB, LF, CR, 0x20-0x7E and
 * 0xA1-0xFF but 0xAD.
 */
const isLatin1Code = (code: number): boolean =>
  code === 0x09 ||
  code === 0x0a ||
  code === 0x0d ||
  (code >= 0x20 && code <= 0x7e) ||
  (code >= 0xa1 && code <= 0xff && code !== 0xad);

/**
 * ISO 32000-2 Table D.2, PDFDocEncoding: code (0-255) to Unicode code point, `undefined` for the
 * 24 codes it leaves undefined (0x00-0x08, 0x0B, 0x0C, 0x0E-0x17, 0x7F, 0x9F, 0xAD).
 */
export const PDF_DOC_ENCODING: readonly (number | undefined)[] = Object.freeze(
  Array.from({ length: 256 }, (_, code) =>
    isLatin1Code(code) ? code : NOT_LATIN1.find(([c]) => c === code)?.[1],
  ),
);

/** Code to the text it decodes to: its Table D.2 character, else U+0000 plus the code. */
const PDF_DOC_DECODE: readonly string[] = PDF_DOC_ENCODING.map((unicode, code) =>
  String.fromCodePoint(unicode ?? code),
);

/** Unicode code point to its PDFDocEncoding code. */
const PDF_DOC_ENCODE: ReadonlyMap<number, number> = new Map(
  PDF_DOC_ENCODING.flatMap((unicode, code) => (unicode === undefined ? [] : [[unicode, code]])),
);

const WRITE_ENCODINGS: ReadonlySet<string> = new Set<TextStringWriteEncoding>([
  'auto',
  'pdfdoc',
  'utf-16be',
  'utf-8',
]);

/** Non-fatal: an ill-formed sequence decodes to U+FFFD; a leading byte order mark is removed. */
const UTF8_DECODER = new TextDecoder();

/** Code units per String.fromCharCode call, well below every engine's argument limit. */
const UTF16_CHUNK = 0x2000;

/** The encoding of a text string's bytes, named by its byte order mark. */
export function textStringEncoding(bytes: Uint8Array): TextStringEncoding {
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  return 'pdfdoc';
}

/** The text of a text string's bytes (see the module header for ill-formed input). */
export function decodeTextString(bytes: Uint8Array): string {
  switch (textStringEncoding(bytes)) {
    case 'utf-16be':
      return removeLanguageEscapes(decodeUtf16(bytes, false));
    case 'utf-16le':
      return removeLanguageEscapes(decodeUtf16(bytes, true));
    case 'utf-8':
      return removeLanguageEscapes(UTF8_DECODER.decode(bytes));
    case 'pdfdoc': {
      let text = '';
      for (const code of bytes) text += PDF_DOC_DECODE[code];
      return text;
    }
  }
}

/** The code units after the byte order mark, a trailing odd byte dropped, lone surrogates U+FFFD. */
function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = (bytes.length - 2) >> 1;
  const units = new Uint16Array(Math.min(count, UTF16_CHUNK));
  let text = '';
  for (let start = 0; start < count; start += UTF16_CHUNK) {
    const n = Math.min(UTF16_CHUNK, count - start);
    for (let i = 0; i < n; i++) units[i] = view.getUint16(2 + 2 * (start + i), littleEndian);
    text += String.fromCharCode(...units.subarray(0, n));
  }
  // After the chunks are joined, so a surrogate pair split by a chunk boundary stays whole.
  return text.toWellFormed();
}

/** Removes each U+001B ... U+001B sequence; an unclosed one runs to the end of the text. */
function removeLanguageEscapes(text: string): string {
  let open = text.indexOf('\u001b');
  if (open < 0) return text;
  let kept = '';
  let from = 0;
  while (open >= 0) {
    kept += text.slice(from, open);
    const close = text.indexOf('\u001b', open + 1);
    if (close < 0) return kept;
    from = close + 1;
    open = text.indexOf('\u001b', from);
  }
  return kept + text.slice(from);
}

/**
 * The bytes of a text string holding `text` (see the module header for `"auto"`). A lone
 * surrogate, or with `"pdfdoc"` a character Table D.2 lacks, throws UnencodableTextError
 * (encoding `"PDF text string"`; a lone surrogate is reported first); `"utf-16le"` (read only) or
 * an unknown encoding throws InvalidArgumentError (argument `"encoding"`). With `"pdfdoc"` the
 * bytes are written as asked even when they begin like a byte order mark.
 */
export function encodeTextString(
  text: string,
  encoding: TextStringWriteEncoding = 'auto',
): Uint8Array<ArrayBuffer> {
  if (!WRITE_ENCODINGS.has(encoding)) {
    const name = String(encoding);
    throw new InvalidArgumentError(
      name === 'utf-16le'
        ? 'The text-string encoding "utf-16le" is read only; write "auto", "pdfdoc", "utf-16be" or "utf-8"'
        : `Unknown text-string encoding "${name}"; write "auto", "pdfdoc", "utf-16be" or "utf-8"`,
      { argument: 'encoding' },
    );
  }
  assertWellFormed(text);
  if (encoding === 'pdfdoc' || encoding === 'auto') {
    const pdfDoc = encodePdfDoc(text, encoding === 'pdfdoc');
    if (pdfDoc !== undefined && (encoding === 'pdfdoc' || textStringEncoding(pdfDoc) === 'pdfdoc'))
      return pdfDoc;
  }
  return encoding === 'utf-8' ? encodeUtf8(text) : encodeUtf16be(text);
}

/** Throws UnencodableTextError at the first lone surrogate of `text`. */
function assertWellFormed(text: string): void {
  if (text.isWellFormed()) return;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0xd800 || unit > 0xdfff) continue;
    const next = text.charCodeAt(i + 1);
    if (unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) i++;
    else {
      throw new UnencodableTextError({
        character: text.charAt(i),
        index: i,
        fontName: undefined,
        encoding: 'PDF text string',
      });
    }
  }
}

/**
 * The PDFDocEncoding bytes of `text`; at a character Table D.2 lacks, UnencodableTextError when
 * `strict`, else `undefined`.
 */
function encodePdfDoc(text: string, strict: boolean): Uint8Array<ArrayBuffer> | undefined {
  // Every Table D.2 character is one UTF-16 code unit, so the bytes are as many as the units.
  const bytes = new Uint8Array(text.length);
  let index = 0;
  for (const character of text) {
    const code = PDF_DOC_ENCODE.get(character.codePointAt(0) ?? -1);
    if (code === undefined) {
      if (!strict) return undefined;
      throw new UnencodableTextError({
        character,
        index,
        fontName: undefined,
        encoding: 'PDF text string',
      });
    }
    bytes[index] = code;
    index += character.length;
  }
  return bytes;
}

function encodeUtf16be(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(2 + 2 * text.length);
  bytes[0] = 0xfe;
  bytes[1] = 0xff;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    bytes[2 + 2 * i] = unit >> 8;
    bytes[3 + 2 * i] = unit & 0xff;
  }
  return bytes;
}

function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(3 + body.length);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(body, 3);
  return bytes;
}

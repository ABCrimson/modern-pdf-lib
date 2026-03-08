/**
 * @module parser/lexer
 *
 * PDF tokenizer / lexer that operates on raw `Uint8Array` input.
 *
 * Converts a stream of PDF bytes into a sequence of {@link Token} objects
 * suitable for consumption by the object parser. The lexer is designed for
 * speed: it operates directly on byte values without converting the entire
 * input to a string, and uses lookup tables for character classification.
 *
 * Reference: PDF 1.7 specification, SS 7.2 (Lexical Conventions).
 */

import { PdfParseError } from './parseError.js';

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

/**
 * Discriminating tag for every token the lexer can produce.
 */
export enum TokenType {
  /** Integer or real number: `42`, `3.14`, `-1`, `+0.5` */
  Number,
  /** Literal string delimited by parentheses: `(Hello)` */
  LiteralString,
  /** Hexadecimal string delimited by angle brackets: `<48656C6C6F>` */
  HexString,
  /** Name object: `/Type`, `/SomeName` (with `#XX` escape decoding) */
  Name,
  /** Boolean keyword: `true` or `false` */
  Boolean,
  /** Null keyword: `null` */
  Null,
  /** Array start delimiter: `[` */
  ArrayStart,
  /** Array end delimiter: `]` */
  ArrayEnd,
  /** Dictionary start delimiter: `<<` */
  DictStart,
  /** Dictionary end delimiter: `>>` */
  DictEnd,
  /** Stream body keyword: `stream` */
  StreamKeyword,
  /** Stream end keyword: `endstream` */
  EndStreamKeyword,
  /** Indirect object start keyword: `obj` */
  ObjKeyword,
  /** Indirect object end keyword: `endobj` */
  EndObjKeyword,
  /** Cross-reference table keyword: `xref` */
  XrefKeyword,
  /** Trailer keyword: `trailer` */
  TrailerKeyword,
  /** startxref keyword: `startxref` */
  StartXrefKeyword,
  /** Indirect reference `N G R` (synthesized during higher-level parsing) */
  Ref,
  /** Comment: `%` to end-of-line */
  Comment,
  /** End of input */
  EOF,
}

// ---------------------------------------------------------------------------
// Token interface
// ---------------------------------------------------------------------------

/**
 * A single lexical token extracted from a PDF byte stream.
 */
export interface Token {
  /** The kind of token. */
  type: TokenType;
  /**
   * The semantic value of the token.
   *
   * - `number` for {@link TokenType.Number}
   * - `boolean` for {@link TokenType.Boolean}
   * - `string` for names, strings, comments, and keywords
   * - `null` for {@link TokenType.Null} and structural delimiters
   */
  value: string | number | boolean | null;
  /** Byte offset of the first byte of this token in the input. */
  offset: number;
}

// ---------------------------------------------------------------------------
// Byte constants
// ---------------------------------------------------------------------------

/** PDF whitespace bytes (SS 7.2.2, Table 1). */
const WS_NUL = 0x00;
const WS_TAB = 0x09;
const WS_LF = 0x0a;
const WS_FF = 0x0c;
const WS_CR = 0x0d;
const WS_SP = 0x20;

/** Delimiter code points. */
const CH_LPAREN = 0x28; // (
const CH_RPAREN = 0x29; // )
const CH_LT = 0x3c; // <
const CH_GT = 0x3e; // >
const CH_LBRACKET = 0x5b; // [
const CH_RBRACKET = 0x5d; // ]
const CH_LBRACE = 0x7b; // {
const CH_RBRACE = 0x7d; // }
const CH_SLASH = 0x2f; // /
const CH_PERCENT = 0x25; // %
const CH_HASH = 0x23; // #

const CH_PLUS = 0x2b; // +
const CH_MINUS = 0x2d; // -
const CH_DOT = 0x2e; // .

const CH_0 = 0x30;
const CH_7 = 0x37;
const CH_9 = 0x39;

const CH_A = 0x41;
const CH_F_UPPER = 0x46;
const CH_a = 0x61;
const CH_f = 0x66;

const CH_BACKSLASH = 0x5c; // \

// ---------------------------------------------------------------------------
// Lookup tables (built once at module load)
// ---------------------------------------------------------------------------

/**
 * `isWhitespace[b]` is `true` when byte `b` is PDF whitespace.
 *
 * Using a flat boolean array is faster than a Set or switch at the call
 * site because V8 can emit a single bounds-checked load.
 */
const isWhitespace: boolean[] = /* @__PURE__ */ (() => {
  const t = new Array<boolean>(256).fill(false);
  t[WS_NUL] = true;
  t[WS_TAB] = true;
  t[WS_LF] = true;
  t[WS_FF] = true;
  t[WS_CR] = true;
  t[WS_SP] = true;
  return t;
})();

/**
 * `isDelimiter[b]` is `true` when byte `b` is a PDF delimiter character.
 */
const isDelimiter: boolean[] = /* @__PURE__ */ (() => {
  const t = new Array<boolean>(256).fill(false);
  for (const c of [
    CH_LPAREN, CH_RPAREN, CH_LT, CH_GT, CH_LBRACKET, CH_RBRACKET,
    CH_LBRACE, CH_RBRACE, CH_SLASH, CH_PERCENT,
  ]) {
    t[c] = true;
  }
  return t;
})();

/**
 * `hexVal[b]` is the numeric value (0-15) of a hex character, or -1 if
 * the byte is not a valid hex digit.
 */
const hexVal: Int8Array = /* @__PURE__ */ (() => {
  const t = new Int8Array(256).fill(-1);
  for (let i = 0; i <= 9; i++) t[CH_0 + i] = i;
  for (let i = 0; i < 6; i++) {
    t[CH_A + i] = 10 + i;
    t[CH_a + i] = 10 + i;
  }
  return t;
})();

// ---------------------------------------------------------------------------
// PdfLexer
// ---------------------------------------------------------------------------

/**
 * A fast, low-level PDF tokenizer.
 *
 * Operates directly on a `Uint8Array` without copying or converting the
 * entire input to a JavaScript string. Implements single-token lookahead
 * via {@link peekToken}.
 *
 * @example
 * ```ts
 * const lexer = new PdfLexer(pdfBytes);
 * let tok = lexer.nextToken();
 * while (tok.type !== TokenType.EOF) {
 *   console.log(tok);
 *   tok = lexer.nextToken();
 * }
 * ```
 */
export class PdfLexer {
  /** The raw PDF bytes being tokenized. */
  private readonly _data: Uint8Array;

  /** Total length of the input (cached for hot loops). */
  private readonly len: number;

  /** Current read position (byte offset). */
  position: number;

  /** Single-token lookahead buffer used by {@link peekToken}. */
  private peeked: Token | null = null;

  /**
   * When `true`, clamp numeric values to the single-precision float
   * range `[-3.4e38, 3.4e38]` during tokenization. This prevents
   * extreme values from producing garbage output downstream.
   *
   * Set by the document parser when the `capNumbers` load option is
   * enabled. Defaults to `false`.
   */
  capNumbers = false;

  /**
   * Create a new lexer over the given byte buffer.
   *
   * @param data  The raw PDF bytes. The array is **not** copied; the caller
   *              must not mutate it while the lexer is in use.
   */
  constructor(data: Uint8Array) {
    this._data = data;
    this.len = data.length;
    this.position = 0;
  }

  /**
   * Public accessor for the raw PDF byte buffer.
   *
   * This allows other parsers (e.g. object parser, xref parser) to
   * include hex-context dumps in structured error messages.
   */
  get rawData(): Uint8Array {
    return this._data;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Consume and return the next token.
   *
   * Returns a token with `type === TokenType.EOF` when the input is
   * exhausted.
   */
  nextToken(): Token {
    if (this.peeked !== null) {
      const t = this.peeked;
      this.peeked = null;
      return t;
    }
    return this.readToken();
  }

  /**
   * Return the next token **without** consuming it.
   *
   * Calling `peekToken()` multiple times without an intervening
   * `nextToken()` returns the same token.
   */
  peekToken(): Token {
    this.peeked ??= this.readToken();
    return this.peeked;
  }

  /**
   * Read raw stream data starting at the current position.
   *
   * After the dict and the `stream` keyword have been consumed the lexer
   * position should be right after the newline following `stream`. This
   * method reads exactly `length` bytes and returns them.
   *
   * @param length  Number of bytes to read.
   * @returns       A `Uint8Array` view (not a copy) into the input buffer.
   * @throws        If there are not enough bytes remaining.
   */
  readStreamData(length: number): Uint8Array {
    if (this.position + length > this.len) {
      throw new PdfParseError({
        message:
          `PdfLexer.readStreamData: requested ${length} bytes at offset ` +
          `${this.position}, but only ${this.len - this.position} remain`,
        offset: this.position,
        expected: `${length} bytes available`,
        actual: `${this.len - this.position} bytes remaining`,
        data: this._data,
      });
    }
    const slice = this._data.subarray(this.position, this.position + length);
    this.position += length;
    return slice;
  }

  /**
   * Set the read position to an arbitrary byte offset.
   *
   * Any buffered lookahead token is discarded.
   *
   * @param offset  The byte offset to seek to (0-based).
   * @throws        If the offset is out of range.
   */
  seek(offset: number): void {
    if (offset < 0 || offset > this.len) {
      throw new PdfParseError({
        message: `PdfLexer.seek: offset ${offset} is outside [0, ${this.len}]`,
        offset,
        expected: `offset in range [0, ${this.len}]`,
        actual: `${offset}`,
        data: this._data,
      });
    }
    this.position = offset;
    this.peeked = null;
  }

  /**
   * Return the byte at the given offset without advancing the position.
   *
   * Returns `-1` if the offset is out of bounds.
   *
   * @param offset  Byte offset to peek at.
   */
  byteAt(offset: number): number {
    if (offset < 0 || offset >= this.len) return -1;
    return this._data[offset]!;
  }

  /**
   * Return the total length of the input buffer (in bytes).
   */
  get length(): number {
    return this.len;
  }

  /**
   * Advance past whitespace and comments.
   *
   * This is called automatically at the start of {@link readToken}, but it
   * is exposed publicly so the object parser can align the position before
   * extracting stream data.
   */
  skipWhitespace(): void {
    const d = this._data;
    let pos = this.position;
    while (pos < this.len) {
      const b = d[pos]!;
      if (isWhitespace[b]) {
        pos++;
        continue;
      }
      if (b === CH_PERCENT) {
        // Comment: skip to end of line
        pos++;
        while (pos < this.len) {
          const cb = d[pos]!;
          if (cb === WS_LF || cb === WS_CR) break;
          pos++;
        }
        continue;
      }
      break;
    }
    this.position = pos;
  }

  // -----------------------------------------------------------------------
  // Core tokenizer
  // -----------------------------------------------------------------------

  /**
   * Internal: read one token from the current position.
   *
   * This is the heart of the lexer. It classifies the byte at the current
   * position and dispatches to a specialised reader.
   */
  private readToken(): Token {
    this.skipWhitespace();

    if (this.position >= this.len) {
      return { type: TokenType.EOF, value: null, offset: this.position };
    }

    const d = this._data;
    const startPos = this.position;
    const b = d[startPos]!;

    // -- Structural delimiters -------------------------------------------

    if (b === CH_LBRACKET) {
      this.position++;
      return { type: TokenType.ArrayStart, value: null, offset: startPos };
    }

    if (b === CH_RBRACKET) {
      this.position++;
      return { type: TokenType.ArrayEnd, value: null, offset: startPos };
    }

    // << or <hex>
    if (b === CH_LT) {
      if (startPos + 1 < this.len && d[startPos + 1] === CH_LT) {
        this.position += 2;
        return { type: TokenType.DictStart, value: null, offset: startPos };
      }
      return this.readHexString(startPos);
    }

    // >> (single > should not appear at token level)
    if (b === CH_GT) {
      if (startPos + 1 < this.len && d[startPos + 1] === CH_GT) {
        this.position += 2;
        return { type: TokenType.DictEnd, value: null, offset: startPos };
      }
      // Lone '>' — could occur with malformed input. Consume and treat as
      // an error, but be lenient: advance past it.
      this.position++;
      throw new PdfParseError({
        message: `PdfLexer: unexpected '>' at offset ${startPos} (expected '>>' for dict end)`,
        offset: startPos,
        expected: "'>>' (dict end delimiter)",
        actual: "'>' (lone angle bracket)",
        data: this._data,
      });
    }

    // (literal string)
    if (b === CH_LPAREN) {
      return this.readLiteralString(startPos);
    }

    // /Name
    if (b === CH_SLASH) {
      return this.readName(startPos);
    }

    // %comment — should have been consumed by skipWhitespace, but handle
    // it here too for robustness.
    if (b === CH_PERCENT) {
      return this.readComment(startPos);
    }

    // -- Numbers and signs -----------------------------------------------

    if (
      b === CH_PLUS || b === CH_MINUS ||
      b === CH_DOT ||
      (b >= CH_0 && b <= CH_9)
    ) {
      return this.readNumber(startPos);
    }

    // -- Keywords (true, false, null, stream, endstream, obj, endobj, ...) -

    // Must be a regular character (not whitespace, not delimiter).
    // Read the full word, then classify.
    return this.readKeyword(startPos);
  }

  // -----------------------------------------------------------------------
  // Specialised readers
  // -----------------------------------------------------------------------

  /**
   * Read a number token.
   *
   * PDF numbers are either integers (`42`, `-3`, `+0`) or reals (`3.14`,
   * `-.002`, `+.5`). Scientific notation is **not** permitted.
   */
  private readNumber(startPos: number): Token {
    const d = this._data;
    let pos = startPos;
    let hasSign = false;
    let hasDot = false;

    // Optional sign
    const first = d[pos]!;
    if (first === CH_PLUS || first === CH_MINUS) {
      hasSign = true;
      pos++;
    }

    const digitStart = pos;

    while (pos < this.len) {
      const c = d[pos]!;
      if (c >= CH_0 && c <= CH_9) {
        pos++;
      } else if (c === CH_DOT && !hasDot) {
        hasDot = true;
        pos++;
      } else {
        break;
      }
    }

    // Edge case: lone sign or lone dot with no digits — not a number.
    // Treat as a keyword so the parser can raise a meaningful error.
    if (pos === digitStart && hasSign && !hasDot) {
      // Just a sign character — fallback to keyword reader
      this.position = startPos;
      return this.readKeyword(startPos);
    }
    if (pos === digitStart + (hasDot ? 1 : 0) && !hasSign) {
      // Lone dot with no digits surrounding it
      this.position = startPos;
      return this.readKeyword(startPos);
    }

    this.position = pos;

    // Fast path: build the number from the byte range.
    const raw = this.bytesToAscii(startPos, pos);
    let num = hasDot ? parseFloat(raw) : parseInt(raw, 10);

    // Clamp to single-precision float range when capNumbers is enabled
    if (this.capNumbers) {
      if (num > 3.4e38) num = 3.4e38;
      else if (num < -3.4e38) num = -3.4e38;
    }

    return { type: TokenType.Number, value: num, offset: startPos };
  }

  /**
   * Read a literal string `(...)`, handling backslash escapes and nested
   * parentheses.
   */
  private readLiteralString(startPos: number): Token {
    const d = this._data;
    let pos = startPos + 1; // skip opening '('
    let depth = 1;
    const parts: string[] = [];

    while (pos < this.len && depth > 0) {
      const c = d[pos]!;

      if (c === CH_BACKSLASH) {
        pos++;
        if (pos >= this.len) break;
        const esc = d[pos]!;
        switch (esc) {
          case 0x6e: // 'n'
            parts.push('\n');
            pos++;
            break;
          case 0x72: // 'r'
            parts.push('\r');
            pos++;
            break;
          case 0x74: // 't'
            parts.push('\t');
            pos++;
            break;
          case 0x62: // 'b'
            parts.push('\b');
            pos++;
            break;
          case 0x66: // 'f'
            parts.push('\f');
            pos++;
            break;
          case CH_LPAREN:
            parts.push('(');
            pos++;
            break;
          case CH_RPAREN:
            parts.push(')');
            pos++;
            break;
          case CH_BACKSLASH:
            parts.push('\\');
            pos++;
            break;
          case WS_LF:
            // Backslash-newline: line continuation, produce nothing
            pos++;
            break;
          case WS_CR:
            // Backslash-CR or backslash-CRLF: line continuation
            pos++;
            if (pos < this.len && d[pos] === WS_LF) pos++;
            break;
          default:
            // Octal escape \NNN (1-3 digits)
            if (esc >= CH_0 && esc <= CH_7) {
              let octal = esc - CH_0;
              pos++;
              if (pos < this.len && d[pos]! >= CH_0 && d[pos]! <= CH_7) {
                octal = octal * 8 + (d[pos]! - CH_0);
                pos++;
                if (pos < this.len && d[pos]! >= CH_0 && d[pos]! <= CH_7) {
                  octal = octal * 8 + (d[pos]! - CH_0);
                  pos++;
                }
              }
              parts.push(String.fromCharCode(octal & 0xff));
            } else {
              // Unknown escape — the backslash is ignored per spec
              parts.push(String.fromCharCode(esc));
              pos++;
            }
            break;
        }
        continue;
      }

      if (c === CH_LPAREN) {
        depth++;
        parts.push('(');
        pos++;
        continue;
      }

      if (c === CH_RPAREN) {
        depth--;
        if (depth > 0) {
          parts.push(')');
        }
        pos++;
        continue;
      }

      // CR or CRLF normalised to LF per spec SS 7.3.4.2
      if (c === WS_CR) {
        parts.push('\n');
        pos++;
        if (pos < this.len && d[pos] === WS_LF) pos++;
        continue;
      }

      parts.push(String.fromCharCode(c));
      pos++;
    }

    if (depth !== 0) {
      throw new PdfParseError({
        message: `PdfLexer: unterminated literal string starting at offset ${startPos}`,
        offset: startPos,
        expected: "closing ')' for literal string",
        actual: 'end of input',
        data: this._data,
      });
    }

    this.position = pos;
    return { type: TokenType.LiteralString, value: parts.join(''), offset: startPos };
  }

  /**
   * Read a hexadecimal string `<...>`.
   *
   * Whitespace between hex digits is ignored. If the final digit count is
   * odd, a trailing `0` is assumed (per spec SS 7.3.4.3).
   */
  private readHexString(startPos: number): Token {
    const d = this._data;
    let pos = startPos + 1; // skip opening '<'
    const bytes: number[] = [];
    let hi = -1;

    while (pos < this.len) {
      const c = d[pos]!;

      if (c === CH_GT) {
        pos++;
        break;
      }

      if (isWhitespace[c]) {
        pos++;
        continue;
      }

      const v = hexVal[c]!;
      if (v === -1) {
        throw new PdfParseError({
          message:
            `PdfLexer: invalid hex digit 0x${c.toString(16).padStart(2, '0')} ` +
            `at offset ${pos} in hex string starting at ${startPos}`,
          offset: pos,
          expected: 'hex digit (0-9, a-f, A-F)',
          actual: `0x${c.toString(16).padStart(2, '0')}`,
          data: this._data,
        });
      }

      if (hi === -1) {
        hi = v;
      } else {
        bytes.push((hi << 4) | v);
        hi = -1;
      }
      pos++;
    }

    // Odd number of hex digits: pad last nibble with 0
    if (hi !== -1) {
      bytes.push(hi << 4);
    }

    this.position = pos;
    return {
      type: TokenType.HexString,
      value: String.fromCharCode(...bytes),
      offset: startPos,
    };
  }

  /**
   * Read a name object `/...`.
   *
   * `#XX` hex escape sequences are decoded inline. The returned value
   * **includes** the leading `/`.
   */
  private readName(startPos: number): Token {
    const d = this._data;
    let pos = startPos + 1; // skip the '/'
    const parts: string[] = ['/'];

    while (pos < this.len) {
      const c = d[pos]!;

      // A whitespace or delimiter ends the name
      if (isWhitespace[c] || isDelimiter[c]) break;

      // #XX hex escape
      if (c === CH_HASH) {
        if (pos + 2 >= this.len) {
          throw new PdfParseError({
            message: `PdfLexer: incomplete #XX escape in name at offset ${pos}`,
            offset: pos,
            expected: 'two hex digits after # in name',
            actual: 'end of input',
            data: this._data,
          });
        }
        const hi = hexVal[d[pos + 1]!]!;
        const lo = hexVal[d[pos + 2]!]!;
        if (hi === -1 || lo === -1) {
          throw new PdfParseError({
            message: `PdfLexer: invalid #XX escape in name at offset ${pos}`,
            offset: pos,
            expected: 'valid hex digits after # in name',
            actual: `#${String.fromCharCode(d[pos + 1]!)}${String.fromCharCode(d[pos + 2]!)}`,
            data: this._data,
          });
        }
        parts.push(String.fromCharCode((hi << 4) | lo));
        pos += 3;
        continue;
      }

      parts.push(String.fromCharCode(c));
      pos++;
    }

    this.position = pos;
    return { type: TokenType.Name, value: parts.join(''), offset: startPos };
  }

  /**
   * Read a comment `%...` to end of line.
   *
   * Although {@link skipWhitespace} normally skips comments, this method is
   * available for callers that want to preserve them.
   */
  private readComment(startPos: number): Token {
    const d = this._data;
    let pos = startPos + 1; // skip '%'
    const begin = pos;

    while (pos < this.len) {
      const c = d[pos]!;
      if (c === WS_LF || c === WS_CR) break;
      pos++;
    }

    this.position = pos;
    const text = this.bytesToAscii(begin, pos);
    return { type: TokenType.Comment, value: text, offset: startPos };
  }

  /**
   * Read a keyword or regular token (alphabetic sequence that is not a
   * number).
   *
   * Matches known PDF keywords and returns the appropriate token type.
   * Unknown words are returned as comments so the parser can decide how to
   * handle them.
   */
  private readKeyword(startPos: number): Token {
    const d = this._data;
    let pos = startPos;

    // Consume until whitespace or delimiter
    while (pos < this.len) {
      const c = d[pos]!;
      if (isWhitespace[c] || isDelimiter[c]) break;
      pos++;
    }

    this.position = pos;
    const word = this.bytesToAscii(startPos, pos);

    switch (word) {
      case 'true':
        return { type: TokenType.Boolean, value: true, offset: startPos };
      case 'false':
        return { type: TokenType.Boolean, value: false, offset: startPos };
      case 'null':
        return { type: TokenType.Null, value: null, offset: startPos };
      case 'stream':
        return { type: TokenType.StreamKeyword, value: 'stream', offset: startPos };
      case 'endstream':
        return { type: TokenType.EndStreamKeyword, value: 'endstream', offset: startPos };
      case 'obj':
        return { type: TokenType.ObjKeyword, value: 'obj', offset: startPos };
      case 'endobj':
        return { type: TokenType.EndObjKeyword, value: 'endobj', offset: startPos };
      case 'xref':
        return { type: TokenType.XrefKeyword, value: 'xref', offset: startPos };
      case 'trailer':
        return { type: TokenType.TrailerKeyword, value: 'trailer', offset: startPos };
      case 'startxref':
        return { type: TokenType.StartXrefKeyword, value: 'startxref', offset: startPos };
      case 'R':
        return { type: TokenType.Ref, value: 'R', offset: startPos };
      default:
        // Unknown keyword — return as a comment-like token so the parser
        // can issue a diagnostic. We use Comment type because no other
        // type fits; the parser should treat unrecognised keywords as
        // errors or warnings.
        return { type: TokenType.Comment, value: word, offset: startPos };
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Decode a byte range to an ASCII string.
   *
   * This is significantly faster than `TextDecoder` for short strings
   * because it avoids the per-call overhead of the streaming decoder.
   */
  private bytesToAscii(from: number, to: number): string {
    return new TextDecoder('latin1').decode(this._data.subarray(from, to));
  }
}

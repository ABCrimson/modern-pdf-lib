/**
 * @module parser/contentStreamParser
 *
 * Parse PDF content streams (the operator/operand sequences that describe
 * page appearance) into a structured AST.
 *
 * A PDF content stream consists of a flat sequence of *operands* followed
 * by an *operator*.  Operands are PDF objects (numbers, strings, names,
 * booleans, arrays, `null`); operators are unquoted letter sequences.
 *
 * Special handling is required for inline images (`BI … ID data EI`).
 *
 * Reference: PDF 1.7 spec, §7.8.2 (Content Streams).
 *
 * @packageDocumentation
 */

import { PdfName } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single operand value in a content stream.
 *
 * - `number` — integer or real
 * - `string` — literal `(…)` or hex `<…>` string (decoded to a JS string)
 * - `boolean` — `true` / `false`
 * - `null` — the PDF `null` keyword
 * - `PdfName` — a `/Name`
 * - `Operand[]` — a PDF array `[…]`
 */
export type Operand = number | string | boolean | null | PdfName | Operand[];

/**
 * A parsed content-stream operator with its preceding operands.
 */
export interface ContentStreamOperator {
  /** The operator keyword, e.g. `"BT"`, `"Tf"`, `"Tj"`, `"re"`, `"cm"`. */
  operator: string;
  /** The operand values that preceded this operator. */
  operands: Operand[];
}

/**
 * Data for an inline image (`BI … ID data EI` sequence).
 *
 * Stored as the single operand of a synthetic `"BI"` operator entry.
 */
export interface InlineImageData {
  /** The key-value dictionary between `BI` and `ID`. */
  dict: Record<string, Operand>;
  /** The raw binary image data between `ID` and `EI`. */
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a PDF content stream into an ordered list of operators.
 *
 * @param data - The raw content-stream bytes (already decompressed).
 * @returns An array of operators in document order.
 */
export function parseContentStream(data: Uint8Array): ContentStreamOperator[] {
  const parser = new ContentStreamLexer(data);
  return parser.parse();
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

const enum TokenType {
  Number,
  String,
  HexString,
  Name,
  Bool,
  Null,
  ArrayStart,
  ArrayEnd,
  Operator,
  InlineImage,
  EOF,
}

interface Token {
  type: TokenType;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Lookup tables (built once at module load)
// ---------------------------------------------------------------------------

/**
 * `hexVal[b]` is the numeric value (0-15) of a hex character, or -1 if
 * the byte is not a valid hex digit.
 */
const hexVal: Int8Array = /* @__PURE__ */ (() => {
  const t = new Int8Array(256).fill(-1);
  for (let i = 0; i <= 9; i++) t[0x30 + i] = i;
  for (let i = 0; i < 6; i++) {
    t[0x41 + i] = 10 + i;
    t[0x61 + i] = 10 + i;
  }
  return t;
})();

// ---------------------------------------------------------------------------
// Lexer / parser
// ---------------------------------------------------------------------------

/**
 * Combined lexer + parser for PDF content streams.
 *
 * Content streams are simpler than full PDF object syntax — there are no
 * dictionaries (except inside inline images), no indirect references, and
 * no comments outside of string literals.
 */
class ContentStreamLexer {
  private readonly data: Uint8Array;
  private pos: number = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  // -----------------------------------------------------------------------
  // Top-level parse
  // -----------------------------------------------------------------------

  /**
   * Parse the entire stream and return all operators.
   */
  parse(): ContentStreamOperator[] {
    const result: ContentStreamOperator[] = [];
    const operandStack: Operand[] = [];

    while (true) {
      const token = this.nextToken();
      if (token.type === TokenType.EOF) break;

      switch (token.type) {
        case TokenType.Number:
        case TokenType.String:
        case TokenType.HexString:
        case TokenType.Bool:
        case TokenType.Null:
        case TokenType.Name:
          operandStack.push(token.value as Operand);
          break;

        case TokenType.ArrayStart: {
          const arr = this.parseArray();
          operandStack.push(arr);
          break;
        }

        case TokenType.ArrayEnd:
          // Unexpected ']' — ignore gracefully
          break;

        case TokenType.Operator: {
          const op = token.value as string;
          if (op === 'BI') {
            // Inline image — parse dict + binary data
            const inlineImg = this.parseInlineImage();
            result.push({
              operator: 'BI',
              operands: [inlineImg as unknown as Operand],
            });
          } else {
            result.push({
              operator: op,
              operands: operandStack.splice(0, operandStack.length),
            });
          }
          break;
        }

        case TokenType.InlineImage:
          // Should not reach here — handled inside Operator case
          break;
      }
    }

    // Any remaining operands without an operator (malformed stream) — ignore
    return result;
  }

  // -----------------------------------------------------------------------
  // Array parsing
  // -----------------------------------------------------------------------

  /**
   * Parse a PDF array `[…]`.  Called after the `[` token has been consumed.
   */
  private parseArray(): Operand[] {
    const items: Operand[] = [];

    while (true) {
      const token = this.nextToken();
      if (token.type === TokenType.EOF) break;
      if (token.type === TokenType.ArrayEnd) break;

      switch (token.type) {
        case TokenType.Number:
        case TokenType.String:
        case TokenType.HexString:
        case TokenType.Bool:
        case TokenType.Null:
        case TokenType.Name:
          items.push(token.value as Operand);
          break;
        case TokenType.ArrayStart:
          items.push(this.parseArray());
          break;
        default:
          // Operators should not appear inside arrays — skip
          break;
      }
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Inline image parsing
  // -----------------------------------------------------------------------

  /**
   * Parse an inline image.
   *
   * After `BI` has been read, we expect key-value pairs (name + value)
   * until `ID`, then raw binary data until we find `EI` preceded by
   * whitespace.
   */
  private parseInlineImage(): InlineImageData {
    const dict: Record<string, Operand> = {};

    // Read key-value pairs until ID
    while (true) {
      this.skipWhitespace();
      if (this.pos >= this.data.length) break;

      // Peek to see if next token is 'ID'
      if (this.peekKeyword('ID')) {
        // Consume 'ID'
        this.pos += 2;
        break;
      }

      // Read a name key
      const keyToken = this.nextToken();
      if (keyToken.type === TokenType.Operator) {
        const kw = keyToken.value as string;
        if (kw === 'ID') break;
        // Treat it as a name key (some encoders omit the /)
        const valToken = this.nextToken();
        dict[kw] = valToken.value as Operand;
        continue;
      }
      if (keyToken.type === TokenType.Name) {
        const name = (keyToken.value as PdfName).value;
        const valToken = this.nextToken();
        dict[name] = valToken.value as Operand;
      } else if (keyToken.type === TokenType.EOF) {
        break;
      }
    }

    // After ID there must be exactly one whitespace byte before the data
    if (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (ch === 0x20 || ch === 0x0a || ch === 0x0d || ch === 0x09) {
        this.pos++;
        // Handle \r\n
        if (ch === 0x0d && this.pos < this.data.length && this.data[this.pos] === 0x0a) {
          this.pos++;
        }
      }
    }

    // Read binary data until EI preceded by whitespace.
    // Use indexOf to jump to 'E' candidates instead of scanning every byte.
    const dataStart = this.pos;
    let dataEnd = this.pos;
    let searchFrom = this.pos;

    while (searchFrom < this.data.length) {
      const eIdx = this.data.indexOf(0x45 /* E */, searchFrom);
      if (eIdx === -1 || eIdx + 1 >= this.data.length) {
        this.pos = this.data.length;
        break;
      }

      // Check pattern: whitespace before E, 'I' after E, whitespace/EOF after EI
      if (eIdx > dataStart && this.isWhitespace(this.data[eIdx - 1]!) &&
          this.data[eIdx + 1] === 0x49 /* I */) {
        const afterEI = eIdx + 2;
        if (afterEI >= this.data.length || this.isWhitespace(this.data[afterEI]!)) {
          dataEnd = eIdx - 1;
          this.pos = afterEI;
          break;
        }
      }

      searchFrom = eIdx + 1;
    }

    const imgData = this.data.slice(dataStart, dataEnd);
    return { dict, data: imgData };
  }

  /**
   * Peek ahead to see if the next characters form a given keyword
   * followed by whitespace.
   */
  private peekKeyword(keyword: string): boolean {
    for (let i = 0; i < keyword.length; i++) {
      if (this.pos + i >= this.data.length) return false;
      if (this.data[this.pos + i] !== keyword.charCodeAt(i)) return false;
    }
    // Must be followed by whitespace or delimiter or EOF
    const afterPos = this.pos + keyword.length;
    if (afterPos >= this.data.length) return true;
    const after = this.data[afterPos]!;
    return this.isWhitespace(after) || this.isDelimiter(after);
  }

  // -----------------------------------------------------------------------
  // Tokenizer
  // -----------------------------------------------------------------------

  /**
   * Read and return the next token from the stream.
   */
  private nextToken(): Token {
    this.skipWhitespaceAndComments();

    if (this.pos >= this.data.length) {
      return { type: TokenType.EOF, value: null };
    }

    const ch = this.data[this.pos]!;

    // Literal string
    if (ch === 0x28 /* ( */) {
      return this.readLiteralString();
    }

    // Hex string or dictionary start (but dicts shouldn't appear in
    // content streams — except inline-image key-value syntax)
    if (ch === 0x3c /* < */) {
      if (this.pos + 1 < this.data.length && this.data[this.pos + 1] === 0x3c) {
        // '<<' — should not appear normally in content streams.
        // Skip it.
        this.pos += 2;
        return this.nextToken();
      }
      return this.readHexString();
    }

    // '>>' — dict close (shouldn't appear normally)
    if (ch === 0x3e /* > */ && this.pos + 1 < this.data.length && this.data[this.pos + 1] === 0x3e) {
      this.pos += 2;
      return this.nextToken();
    }

    // Array start
    if (ch === 0x5b /* [ */) {
      this.pos++;
      return { type: TokenType.ArrayStart, value: null };
    }

    // Array end
    if (ch === 0x5d /* ] */) {
      this.pos++;
      return { type: TokenType.ArrayEnd, value: null };
    }

    // Name
    if (ch === 0x2f /* / */) {
      return this.readName();
    }

    // Number (digit, sign, or decimal point)
    if (this.isNumberStart(ch)) {
      return this.readNumber();
    }

    // Keyword (operator, true, false, null)
    if (this.isRegularChar(ch)) {
      return this.readKeyword();
    }

    // Unknown byte — skip
    this.pos++;
    return this.nextToken();
  }

  // -----------------------------------------------------------------------
  // Token readers
  // -----------------------------------------------------------------------

  /**
   * Read a literal string `(…)`, handling nested parentheses and escapes.
   */
  private readLiteralString(): Token {
    this.pos++; // skip opening '('
    const parts: string[] = [];
    let depth = 1;

    while (this.pos < this.data.length && depth > 0) {
      const ch = this.data[this.pos]!;

      if (ch === 0x5c /* \ */) {
        // Escape sequence
        this.pos++;
        if (this.pos >= this.data.length) break;
        const esc = this.data[this.pos]!;

        switch (esc) {
          case 0x6e: parts.push('\n'); this.pos++; break; // \n
          case 0x72: parts.push('\r'); this.pos++; break; // \r
          case 0x74: parts.push('\t'); this.pos++; break; // \t
          case 0x62: parts.push('\b'); this.pos++; break; // \b
          case 0x66: parts.push('\f'); this.pos++; break; // \f
          case 0x28: parts.push('('); this.pos++; break;  // \(
          case 0x29: parts.push(')'); this.pos++; break;  // \)
          case 0x5c: parts.push('\\'); this.pos++; break; // \\
          case 0x0a: // \<LF> — line continuation
            this.pos++;
            break;
          case 0x0d: // \<CR> or \<CR><LF> — line continuation
            this.pos++;
            if (this.pos < this.data.length && this.data[this.pos] === 0x0a) {
              this.pos++;
            }
            break;
          default:
            // Octal escape: 1-3 octal digits
            if (esc >= 0x30 && esc <= 0x37) {
              let octal = esc - 0x30;
              this.pos++;
              if (this.pos < this.data.length) {
                const d2 = this.data[this.pos]!;
                if (d2 >= 0x30 && d2 <= 0x37) {
                  octal = octal * 8 + (d2 - 0x30);
                  this.pos++;
                  if (this.pos < this.data.length) {
                    const d3 = this.data[this.pos]!;
                    if (d3 >= 0x30 && d3 <= 0x37) {
                      octal = octal * 8 + (d3 - 0x30);
                      this.pos++;
                    }
                  }
                }
              }
              parts.push(String.fromCharCode(octal & 0xff));
            } else {
              // Unknown escape — treat as literal
              parts.push(String.fromCharCode(esc));
              this.pos++;
            }
            break;
        }
      } else if (ch === 0x28 /* ( */) {
        depth++;
        parts.push('(');
        this.pos++;
      } else if (ch === 0x29 /* ) */) {
        depth--;
        if (depth > 0) {
          parts.push(')');
        }
        this.pos++;
      } else {
        parts.push(String.fromCharCode(ch));
        this.pos++;
      }
    }

    return { type: TokenType.String, value: parts.join('') };
  }

  /**
   * Read a hex string `<…>`.
   */
  private readHexString(): Token {
    this.pos++; // skip opening '<'
    const bytes: number[] = [];
    let hi = -1;

    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (ch === 0x3e /* > */) {
        this.pos++;
        break;
      }
      // Skip whitespace
      if (this.isWhitespace(ch)) {
        this.pos++;
        continue;
      }
      const v = hexVal[ch]!;
      if (v === -1) {
        // Invalid hex digit — skip
        this.pos++;
        continue;
      }
      if (hi === -1) {
        hi = v;
      } else {
        bytes.push((hi << 4) | v);
        hi = -1;
      }
      this.pos++;
    }

    // Odd number of hex digits: pad last nibble with 0
    if (hi !== -1) {
      bytes.push(hi << 4);
    }

    return {
      type: TokenType.HexString,
      value: String.fromCharCode.apply(null, bytes),
    };
  }

  /**
   * Read a PDF name `/…`.
   */
  private readName(): Token {
    this.pos++; // skip '/'
    const parts: string[] = ['/'];

    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (this.isWhitespace(ch) || this.isDelimiter(ch)) break;

      if (ch === 0x23 /* # */ && this.pos + 2 < this.data.length) {
        // Hex-encoded character #XX
        const hi = hexVal[this.data[this.pos + 1]!]!;
        const lo = hexVal[this.data[this.pos + 2]!]!;
        if (hi !== -1 && lo !== -1) {
          parts.push(String.fromCharCode((hi << 4) | lo));
          this.pos += 3;
          continue;
        }
      }

      parts.push(String.fromCharCode(ch));
      this.pos++;
    }

    return { type: TokenType.Name, value: PdfName.of(parts.join('')) };
  }

  /**
   * Read a numeric value (integer or real).
   */
  private readNumber(): Token {
    const start = this.pos;
    let hasDecimal = false;

    // Optional sign
    if (this.data[this.pos] === 0x2b || this.data[this.pos] === 0x2d) {
      this.pos++;
    }

    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (ch === 0x2e /* . */) {
        if (hasDecimal) break; // Second decimal point — stop
        hasDecimal = true;
        this.pos++;
      } else if (ch >= 0x30 && ch <= 0x39) {
        this.pos++;
      } else {
        break;
      }
    }

    const str = this.decodeAscii(start, this.pos);
    const value = parseFloat(str);

    return { type: TokenType.Number, value: isNaN(value) ? 0 : value };
  }

  /**
   * Read a keyword — an operator name or one of the special keywords
   * `true`, `false`, `null`.
   */
  private readKeyword(): Token {
    const start = this.pos;

    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (this.isWhitespace(ch) || this.isDelimiter(ch)) break;
      this.pos++;
    }

    const word = this.decodeAscii(start, this.pos);

    if (word === 'true') return { type: TokenType.Bool, value: true };
    if (word === 'false') return { type: TokenType.Bool, value: false };
    if (word === 'null') return { type: TokenType.Null, value: null };

    return { type: TokenType.Operator, value: word };
  }

  // -----------------------------------------------------------------------
  // Character classification
  // -----------------------------------------------------------------------

  /** PDF whitespace characters. */
  private isWhitespace(ch: number): boolean {
    return (
      ch === 0x00 || // NUL
      ch === 0x09 || // TAB
      ch === 0x0a || // LF
      ch === 0x0c || // FF
      ch === 0x0d || // CR
      ch === 0x20    // SPACE
    );
  }

  /** PDF delimiter characters. */
  private isDelimiter(ch: number): boolean {
    return (
      ch === 0x28 || // (
      ch === 0x29 || // )
      ch === 0x3c || // <
      ch === 0x3e || // >
      ch === 0x5b || // [
      ch === 0x5d || // ]
      ch === 0x7b || // {
      ch === 0x7d || // }
      ch === 0x2f || // /
      ch === 0x25    // %
    );
  }

  /** Whether a character can begin a number. */
  private isNumberStart(ch: number): boolean {
    return (
      (ch >= 0x30 && ch <= 0x39) || // 0-9
      ch === 0x2b || // +
      ch === 0x2d || // -
      ch === 0x2e    // .
    );
  }

  /** Whether a character is a regular (non-whitespace, non-delimiter) character. */
  private isRegularChar(ch: number): boolean {
    return !this.isWhitespace(ch) && !this.isDelimiter(ch);
  }

  // -----------------------------------------------------------------------
  // Whitespace / comment skipping
  // -----------------------------------------------------------------------

  /** Skip whitespace. */
  private skipWhitespace(): void {
    while (this.pos < this.data.length && this.isWhitespace(this.data[this.pos]!)) {
      this.pos++;
    }
  }

  /** Skip whitespace and `%` comments. */
  private skipWhitespaceAndComments(): void {
    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]!;
      if (this.isWhitespace(ch)) {
        this.pos++;
      } else if (ch === 0x25 /* % */) {
        // Skip until end of line
        this.pos++;
        while (this.pos < this.data.length) {
          const c = this.data[this.pos]!;
          if (c === 0x0a || c === 0x0d) break;
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /**
   * Decode a slice of the data as ASCII text.
   */
  private decodeAscii(start: number, end: number): string {
    return String.fromCharCode.apply(
      null,
      this.data.subarray(start, end) as unknown as number[],
    );
  }
}

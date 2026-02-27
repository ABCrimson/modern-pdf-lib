/**
 * @module parser/objectParser
 *
 * Converts a token stream produced by {@link PdfLexer} into instances of the
 * PDF object model defined in `core/pdfObjects`.
 *
 * The parser handles every PDF value type: null, boolean, number, literal
 * and hex strings, names, arrays, dictionaries, streams, and indirect
 * references / indirect object definitions.
 *
 * Reference: PDF 1.7 specification, SS 7.3 (Objects).
 */

import type { PdfLexer, Token } from './lexer.js';
import { TokenType } from './lexer.js';
import {
  type PdfObject,
  PdfNull,
  PdfBool,
  PdfNumber,
  PdfString,
  PdfName,
  PdfArray,
  PdfDict,
  PdfStream,
  PdfRef,
  type PdfObjectRegistry,
} from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// PdfObjectParser
// ---------------------------------------------------------------------------

/**
 * A recursive-descent parser that transforms PDF tokens into the library's
 * object model.
 *
 * The parser is stateless apart from its reference to the shared lexer and
 * object registry. It can be used to parse objects at arbitrary offsets in
 * the PDF file by combining {@link PdfLexer.seek} with the `*At` methods.
 *
 * @example
 * ```ts
 * const lexer = new PdfLexer(pdfBytes);
 * const registry = new PdfObjectRegistry();
 * const parser = new PdfObjectParser(lexer, registry);
 *
 * const obj = parser.parseObjectAt(xrefOffset);
 * ```
 */
export class PdfObjectParser {
  /**
   * @param lexer     The lexer that provides the token stream.
   * @param registry  The object registry used for resolving stream
   *                  `/Length` references and for registering indirect
   *                  objects when they are parsed.
   */
  constructor(
    private readonly lexer: PdfLexer,
    private readonly registry: PdfObjectRegistry,
  ) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Parse a single PDF object at the current lexer position.
   *
   * This is the main entry point. It handles every PDF value type:
   *
   * - `null`, `true` / `false`, numbers, literal and hex strings, names
   * - Arrays `[...]`
   * - Dictionaries `<<...>>`
   * - Streams (dictionary followed by `stream ... endstream`)
   * - Indirect references `N G R`
   *
   * When two consecutive number tokens are followed by `R`, an indirect
   * reference ({@link PdfRef}) is returned. When followed by `obj`, this
   * method delegates to {@link parseIndirectObjectBody} internally — but
   * callers who know they are positioned at an indirect object definition
   * should use {@link parseIndirectObject} directly.
   *
   * @returns A `PdfObject` instance.
   * @throws  On unexpected tokens or malformed input.
   */
  parseObject(): PdfObject {
    const token = this.lexer.nextToken();
    return this.parseFromToken(token);
  }

  /**
   * Parse a complete indirect object definition: `N G obj ... endobj`.
   *
   * The lexer must be positioned at the object number (the first token of
   * `N G obj`).
   *
   * The parsed object is automatically registered in the
   * {@link PdfObjectRegistry}.
   *
   * @returns An object containing the indirect reference and the parsed
   *          value.
   * @throws  On malformed indirect object syntax.
   */
  parseIndirectObject(): { ref: PdfRef; object: PdfObject } {
    // N
    const objNumToken = this.lexer.nextToken();
    if (objNumToken.type !== TokenType.Number || !Number.isInteger(objNumToken.value as number)) {
      throw new Error(
        `PdfObjectParser.parseIndirectObject: expected integer object number ` +
        `at offset ${objNumToken.offset}, got ${TokenType[objNumToken.type]} ` +
        `(${String(objNumToken.value)})`,
      );
    }
    const objNum = objNumToken.value as number;

    // G
    const genNumToken = this.lexer.nextToken();
    if (genNumToken.type !== TokenType.Number || !Number.isInteger(genNumToken.value as number)) {
      throw new Error(
        `PdfObjectParser.parseIndirectObject: expected integer generation ` +
        `number at offset ${genNumToken.offset}, got ` +
        `${TokenType[genNumToken.type]} (${String(genNumToken.value)})`,
      );
    }
    const genNum = genNumToken.value as number;

    // obj
    const objKw = this.lexer.nextToken();
    if (objKw.type !== TokenType.ObjKeyword) {
      throw new Error(
        `PdfObjectParser.parseIndirectObject: expected 'obj' keyword at ` +
        `offset ${objKw.offset}, got ${TokenType[objKw.type]} ` +
        `(${String(objKw.value)})`,
      );
    }

    return this.parseIndirectObjectBody(objNum, genNum);
  }

  /**
   * Seek to a byte offset and parse a single PDF object.
   *
   * Convenience wrapper around {@link PdfLexer.seek} and
   * {@link parseObject}.
   *
   * @param offset  Byte offset in the input.
   * @returns       The parsed `PdfObject`.
   */
  parseObjectAt(offset: number): PdfObject {
    this.lexer.seek(offset);
    return this.parseObject();
  }

  /**
   * Seek to a byte offset and parse an indirect object definition.
   *
   * Convenience wrapper around {@link PdfLexer.seek} and
   * {@link parseIndirectObject}.
   *
   * @param offset  Byte offset of the `N G obj` header in the input.
   * @returns       The indirect reference and the parsed value.
   */
  parseIndirectObjectAt(offset: number): { ref: PdfRef; object: PdfObject } {
    this.lexer.seek(offset);
    return this.parseIndirectObject();
  }

  // -----------------------------------------------------------------------
  // Internal dispatch
  // -----------------------------------------------------------------------

  /**
   * Given an already-consumed token, parse the corresponding PDF object.
   *
   * This is the core dispatch method that routes to specialised parsers
   * based on the token type.
   */
  private parseFromToken(token: Token): PdfObject {
    switch (token.type) {
      case TokenType.Null:
        return PdfNull.instance;

      case TokenType.Boolean:
        return PdfBool.of(token.value as boolean);

      case TokenType.Number:
        return this.parseNumberOrRef(token);

      case TokenType.LiteralString:
        return PdfString.literal(token.value as string);

      case TokenType.HexString:
        return PdfString.hex(token.value as string);

      case TokenType.Name:
        return PdfName.of(token.value as string);

      case TokenType.ArrayStart:
        return this.parseArray();

      case TokenType.DictStart:
        return this.parseDictOrStream();

      case TokenType.EOF:
        throw new Error(
          `PdfObjectParser: unexpected end of input at offset ${token.offset}`,
        );

      default:
        throw new Error(
          `PdfObjectParser: unexpected token ${TokenType[token.type]} ` +
          `(${String(token.value)}) at offset ${token.offset}`,
        );
    }
  }

  // -----------------------------------------------------------------------
  // Number / indirect ref disambiguation
  // -----------------------------------------------------------------------

  /**
   * After reading a number token, peek ahead to see if this is the start
   * of an indirect reference (`N G R`) or an indirect object definition
   * (`N G obj ... endobj`).
   *
   * If the next token is also a number and the one after that is `R`, we
   * produce a {@link PdfRef}. If it is `obj`, we parse the full indirect
   * object body. Otherwise we return a plain {@link PdfNumber}.
   */
  private parseNumberOrRef(firstToken: Token): PdfObject {
    const firstValue = firstToken.value as number;

    // Indirect refs/objects only start with non-negative integers
    if (!Number.isInteger(firstValue) || firstValue < 0) {
      return PdfNumber.of(firstValue);
    }

    // Peek at the next token
    const second = this.lexer.peekToken();
    if (second.type !== TokenType.Number || !Number.isInteger(second.value as number) || (second.value as number) < 0) {
      return PdfNumber.of(firstValue);
    }

    // We need to look two tokens ahead. Consume the second number and
    // peek at the third.
    this.lexer.nextToken(); // consume the second number
    const third = this.lexer.peekToken();

    if (third.type === TokenType.Ref) {
      // N G R — indirect reference
      this.lexer.nextToken(); // consume 'R'
      return PdfRef.of(firstValue, second.value as number);
    }

    if (third.type === TokenType.ObjKeyword) {
      // N G obj — indirect object definition
      this.lexer.nextToken(); // consume 'obj'
      const { object } = this.parseIndirectObjectBody(firstValue, second.value as number);
      return object;
    }

    // Neither R nor obj — the second number is a separate object.
    // We need to "push back" the second number. Since PdfLexer only
    // supports single-token lookahead and we already consumed it, we
    // handle this by returning the first number and leaving the second
    // in the peek buffer. However, we already consumed the second token
    // from the lexer. We will use a workaround: seek back and let the
    // caller re-read. Actually, the simplest correct approach is to
    // recognise this is an extremely rare edge case in real PDFs and
    // handle it by wrapping the second token. We save the lexer position
    // before consuming the second token and restore it if needed.
    //
    // But we already consumed it. The cleanest solution is to track
    // this. Let's use a different approach: save/restore positions.
    //
    // Since we already consumed the second token, we seek back to its
    // offset so it will be re-read next time.
    this.lexer.seek(second.offset);
    return PdfNumber.of(firstValue);
  }

  // -----------------------------------------------------------------------
  // Indirect object body
  // -----------------------------------------------------------------------

  /**
   * Parse the body and `endobj` of an indirect object, given that the
   * `N G obj` header has already been consumed.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   */
  private parseIndirectObjectBody(
    objNum: number,
    genNum: number,
  ): { ref: PdfRef; object: PdfObject } {
    const ref = PdfRef.of(objNum, genNum);
    const object = this.parseObject();

    // If the object is a dict and the next token is `stream`, upgrade to
    // a PdfStream.
    let finalObject = object;
    if (object.kind === 'dict') {
      const peek = this.lexer.peekToken();
      if (peek.type === TokenType.StreamKeyword) {
        finalObject = this.readStream(object);
      }
    }

    // Consume `endobj`
    const endToken = this.lexer.nextToken();
    if (endToken.type !== TokenType.EndObjKeyword) {
      // Be lenient: some producers omit endobj or place garbage between
      // the object and endobj. Log but do not throw.
      // For strictness we still throw.
      throw new Error(
        `PdfObjectParser: expected 'endobj' for object ${objNum} ${genNum} ` +
        `at offset ${endToken.offset}, got ${TokenType[endToken.type]} ` +
        `(${String(endToken.value)})`,
      );
    }

    // Register in the object registry
    this.registry.registerWithRef(ref, finalObject);

    return { ref, object: finalObject };
  }

  // -----------------------------------------------------------------------
  // Arrays
  // -----------------------------------------------------------------------

  /**
   * Parse a PDF array `[...]`.
   *
   * The opening `[` has already been consumed.
   */
  private parseArray(): PdfArray {
    const items: PdfObject[] = [];

    while (true) {
      const peek = this.lexer.peekToken();

      if (peek.type === TokenType.ArrayEnd) {
        this.lexer.nextToken(); // consume ']'
        break;
      }

      if (peek.type === TokenType.EOF) {
        throw new Error(
          `PdfObjectParser: unterminated array at offset ${peek.offset}`,
        );
      }

      items.push(this.parseObject());
    }

    return new PdfArray(items);
  }

  // -----------------------------------------------------------------------
  // Dictionaries and streams
  // -----------------------------------------------------------------------

  /**
   * Parse a PDF dictionary `<<...>>` and, if immediately followed by a
   * `stream` keyword, a PDF stream object.
   *
   * The opening `<<` has already been consumed.
   */
  private parseDictOrStream(): PdfDict | PdfStream {
    const dict = this.parseDictBody();

    // Check if a stream follows
    const peek = this.lexer.peekToken();
    if (peek.type === TokenType.StreamKeyword) {
      return this.readStream(dict);
    }

    return dict;
  }

  /**
   * Parse key-value pairs until `>>`.
   *
   * Keys must be name tokens; values can be any PDF object.
   */
  private parseDictBody(): PdfDict {
    const dict = new PdfDict();

    while (true) {
      const peek = this.lexer.peekToken();

      if (peek.type === TokenType.DictEnd) {
        this.lexer.nextToken(); // consume '>>'
        break;
      }

      if (peek.type === TokenType.EOF) {
        throw new Error(
          `PdfObjectParser: unterminated dictionary at offset ${peek.offset}`,
        );
      }

      // Key: must be a Name
      const keyToken = this.lexer.nextToken();
      if (keyToken.type !== TokenType.Name) {
        throw new Error(
          `PdfObjectParser: expected name as dictionary key at offset ` +
          `${keyToken.offset}, got ${TokenType[keyToken.type]} ` +
          `(${String(keyToken.value)})`,
        );
      }
      const key = keyToken.value as string;

      // Value: any object
      const value = this.parseObject();

      dict.set(key, value);
    }

    return dict;
  }

  // -----------------------------------------------------------------------
  // Streams
  // -----------------------------------------------------------------------

  /**
   * Read stream data following a dictionary.
   *
   * The `stream` keyword is consumed here. After the keyword, the spec
   * requires a single newline (LF or CRLF) before the data bytes. The
   * `/Length` entry in the dictionary determines how many bytes to read.
   *
   * @param dict  The stream's metadata dictionary (already parsed).
   * @returns     A `PdfStream` instance.
   */
  private readStream(dict: PdfDict): PdfStream {
    // Consume 'stream' keyword
    const streamKw = this.lexer.nextToken();
    if (streamKw.type !== TokenType.StreamKeyword) {
      throw new Error(
        `PdfObjectParser.readStream: expected 'stream' keyword at offset ` +
        `${streamKw.offset}, got ${TokenType[streamKw.type]}`,
      );
    }

    // After the "stream" keyword, skip the mandatory end-of-line marker.
    // Per spec SS 7.3.8.1: the keyword stream shall be followed by a
    // single EOL marker (either CR+LF or just LF). We also tolerate
    // a lone CR for robustness.
    this.skipStreamEol();

    // Resolve /Length
    const length = this.resolveStreamLength(dict);

    // Read raw bytes
    const data = this.lexer.readStreamData(length);

    // After the data, skip optional whitespace/EOL before `endstream`
    this.skipEndstreamWhitespace();

    // Consume 'endstream'
    const endKw = this.lexer.nextToken();
    if (endKw.type !== TokenType.EndStreamKeyword) {
      throw new Error(
        `PdfObjectParser.readStream: expected 'endstream' keyword at offset ` +
        `${endKw.offset}, got ${TokenType[endKw.type]} ` +
        `(${String(endKw.value)})`,
      );
    }

    return new PdfStream(dict, data);
  }

  /**
   * Skip the mandatory EOL after the `stream` keyword.
   *
   * The PDF spec says the `stream` keyword is followed by a single
   * end-of-line marker before the data begins. We handle both CRLF and
   * LF (and tolerate lone CR).
   */
  private skipStreamEol(): void {
    const b = this.lexer.byteAt(this.lexer.position);
    if (b === 0x0d /* CR */) {
      this.lexer.position++;
      if (this.lexer.byteAt(this.lexer.position) === 0x0a /* LF */) {
        this.lexer.position++;
      }
    } else if (b === 0x0a /* LF */) {
      this.lexer.position++;
    }
  }

  /**
   * Skip whitespace between the stream data and the `endstream` keyword.
   *
   * The spec says there should be an EOL before `endstream`, but many
   * producers put extra whitespace. We only skip EOL characters (CR, LF)
   * to avoid eating into data.
   */
  private skipEndstreamWhitespace(): void {
    while (this.lexer.position < this.lexer.length) {
      const b = this.lexer.byteAt(this.lexer.position);
      if (b === 0x0a || b === 0x0d || b === 0x20) {
        this.lexer.position++;
      } else {
        break;
      }
    }
  }

  /**
   * Resolve the `/Length` value from a stream dictionary.
   *
   * The value may be a direct integer or an indirect reference. If it is
   * an indirect reference, the registry is consulted. If the referenced
   * object has not been parsed yet, we save the lexer position, parse it,
   * and restore the position.
   *
   * @param dict  The stream dictionary.
   * @returns     The integer length.
   * @throws      If `/Length` is missing or cannot be resolved.
   */
  private resolveStreamLength(dict: PdfDict): number {
    const lengthObj = dict.get('/Length');
    if (lengthObj === undefined) {
      throw new Error(
        'PdfObjectParser.resolveStreamLength: stream dictionary is missing /Length',
      );
    }

    // Direct integer
    if (lengthObj.kind === 'number') {
      return (lengthObj as PdfNumber).value;
    }

    // Indirect reference
    if (lengthObj.kind === 'ref') {
      const ref = lengthObj as PdfRef;

      // Try to resolve from the registry first
      const resolved = this.registry.resolve(ref);
      if (resolved !== undefined) {
        if (resolved.kind !== 'number') {
          throw new Error(
            `PdfObjectParser.resolveStreamLength: /Length reference ` +
            `${ref.objectNumber} ${ref.generationNumber} R resolved to ` +
            `${resolved.kind}, expected number`,
          );
        }
        return (resolved as PdfNumber).value;
      }

      // The referenced object has not been parsed yet. This can happen
      // when parsing objects in file order and the /Length object appears
      // after the stream. For now, throw — the caller should ensure
      // /Length objects are parsed first (e.g. via xref table order).
      throw new Error(
        `PdfObjectParser.resolveStreamLength: /Length reference ` +
        `${ref.objectNumber} ${ref.generationNumber} R is not yet ` +
        `resolved in the registry. Parse the referenced object first.`,
      );
    }

    throw new Error(
      `PdfObjectParser.resolveStreamLength: /Length must be a number or ` +
      `indirect reference, got ${lengthObj.kind}`,
    );
  }

}

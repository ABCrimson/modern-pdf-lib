/**
 * @module parser/internal/objectParser
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
import { PdfParseError } from '../parseError.js';
import { KeywordIndex, frameStreamData } from './streamFraming.js';
import { ResourceLimitError } from '../../errors.js';
import {
  type PdfObject,
  PdfNull,
  PdfBool,
  PdfNumber,
  PdfArray,
  PdfDict,
  PdfStream,
  PdfRef,
  pdfNameFromByteString,
  pdfStringFromByteString,
  type PdfObjectRegistry,
} from '../../core/pdfObjects.js';

/** Most `/Length` targets that are resolved inside one another before the next one is refused. */
const MAX_LENGTH_DEPTH = 8;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** A stream whose data was found by searching for its end instead of by its `/Length`. */
export interface StreamRecovery {
  /** The number of the indirect object that holds the stream, when the parser is inside one. */
  readonly objectNumber: number | undefined;
  /** The generation number of that object. */
  readonly generationNumber: number | undefined;
  /** Offset of the first data byte. */
  readonly offset: number;
  /** The usable declared `/Length`, or `undefined` when there was none. */
  readonly declared: number | undefined;
  /** The length of the data that the search gave. */
  readonly length: number;
}

/** Options of {@link PdfObjectParser}. */
export interface ObjectParserOptions {
  /**
   * Resolves the target of an indirect `/Length`. It returns the object, or `undefined` when
   * there is none. A {@link ResourceLimitError} it throws propagates; any other error means that
   * the `/Length` has no usable value. It is not called again for a target that is already being
   * resolved or whose resolution failed before, nor more than eight levels deep (a chain of
   * `/Length` values that sit in streams whose own `/Length` is indirect); a cycle through the
   * stream objects themselves is closed by the resolver. Without a resolver,
   * the registry is consulted. May also be set later through {@link PdfObjectParser.resolveLength}.
   */
  readonly resolveLength?: ((ref: PdfRef) => PdfObject | undefined) | undefined;
  /**
   * When `true` (the default), a stream whose `/Length` is missing, unusable or wrong gets the
   * data that ends at its `endstream` (or `endobj`). When `false`, such a stream throws a
   * {@link PdfParseError}.
   */
  readonly recover?: boolean | undefined;
  /** Called for every stream that was recovered. */
  readonly onRecovered?: ((info: StreamRecovery) => void) | undefined;
}

// ---------------------------------------------------------------------------
// PdfObjectParser
// ---------------------------------------------------------------------------

/**
 * A recursive-descent parser that transforms PDF tokens into the library's
 * object model.
 *
 * The parser holds the shared lexer, the object registry and, for stream
 * framing, the resolver of indirect `/Length` values. It can be used to parse objects at arbitrary offsets in
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
   * Resolves the target of an indirect stream `/Length` (see {@link ObjectParserOptions}).
   * Assigned by the document parser once the cross-reference data is read.
   */
  resolveLength: ((ref: PdfRef) => PdfObject | undefined) | undefined;

  private readonly recover: boolean;
  private readonly onRecovered: ((info: StreamRecovery) => void) | undefined;
  /** The keyword index of the input, scanned on the first recovery. */
  private keywords: KeywordIndex | undefined;
  /** Numbers of the `/Length` targets being resolved, outermost first. */
  private readonly lengthsInProgress = new Set<number>();
  /** Numbers of the `/Length` targets whose resolution failed; they are not resolved again. */
  private readonly failedLengths = new Set<number>();
  /** The indirect object being parsed, innermost first. */
  private current: PdfRef | undefined;

  /**
   * @param lexer     The lexer that provides the token stream.
   * @param registry  The object registry used for resolving stream
   *                  `/Length` references when there is no resolver and for
   *                  registering indirect objects when they are parsed.
   * @param options   Resolver, recovery and reporting of stream framing.
   */
  constructor(
    private readonly lexer: PdfLexer,
    private readonly registry: PdfObjectRegistry,
    options?: ObjectParserOptions,
  ) {
    this.resolveLength = options?.resolveLength;
    this.recover = options?.recover !== false;
    this.onRecovered = options?.onRecovered;
  }

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
      throw new PdfParseError({
        message:
          `PdfObjectParser.parseIndirectObject: expected integer object number ` +
          `at offset ${objNumToken.offset}, got ${TokenType[objNumToken.type]} ` +
          `(${String(objNumToken.value)})`,
        offset: objNumToken.offset,
        expected: 'integer object number',
        actual: `${TokenType[objNumToken.type]} (${String(objNumToken.value)})`,
        data: this.lexer.rawData,
      });
    }
    const objNum = objNumToken.value as number;

    // G
    const genNumToken = this.lexer.nextToken();
    if (genNumToken.type !== TokenType.Number || !Number.isInteger(genNumToken.value as number)) {
      throw new PdfParseError({
        message:
          `PdfObjectParser.parseIndirectObject: expected integer generation ` +
          `number at offset ${genNumToken.offset}, got ` +
          `${TokenType[genNumToken.type]} (${String(genNumToken.value)})`,
        offset: genNumToken.offset,
        expected: 'integer generation number',
        actual: `${TokenType[genNumToken.type]} (${String(genNumToken.value)})`,
        data: this.lexer.rawData,
      });
    }
    const genNum = genNumToken.value as number;

    // obj
    const objKw = this.lexer.nextToken();
    if (objKw.type !== TokenType.ObjKeyword) {
      throw new PdfParseError({
        message:
          `PdfObjectParser.parseIndirectObject: expected 'obj' keyword at ` +
          `offset ${objKw.offset}, got ${TokenType[objKw.type]} ` +
          `(${String(objKw.value)})`,
        offset: objKw.offset,
        expected: "'obj' keyword",
        actual: `${TokenType[objKw.type]} (${String(objKw.value)})`,
        data: this.lexer.rawData,
      });
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
        return pdfStringFromByteString(token.value as string, false);

      case TokenType.HexString:
        return pdfStringFromByteString(token.value as string, true);

      case TokenType.Name:
        return pdfNameFromByteString(token.value as string);

      case TokenType.ArrayStart:
        return this.parseArray();

      case TokenType.DictStart:
        return this.parseDictOrStream();

      case TokenType.EOF:
        throw new PdfParseError({
          message: `PdfObjectParser: unexpected end of input at offset ${token.offset}`,
          offset: token.offset,
          expected: 'a PDF object (number, string, name, array, dict, etc.)',
          actual: 'end of input',
          data: this.lexer.rawData,
        });

      default:
        throw new PdfParseError({
          message:
            `PdfObjectParser: unexpected token ${TokenType[token.type]} ` +
            `(${String(token.value)}) at offset ${token.offset}`,
          offset: token.offset,
          expected: 'a PDF object (number, string, name, array, dict, etc.)',
          actual: `${TokenType[token.type]} (${String(token.value)})`,
          data: this.lexer.rawData,
        });
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
    if (
      second.type !== TokenType.Number ||
      !Number.isInteger(second.value as number) ||
      (second.value as number) < 0
    ) {
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
    const outer = this.current;
    this.current = ref;
    let finalObject: PdfObject;
    try {
      const object = this.parseObject();

      // If the object is a dict and the next token is `stream`, upgrade to
      // a PdfStream.
      finalObject = object;
      if (object.kind === 'dict') {
        const peek = this.lexer.peekToken();
        if (peek.type === TokenType.StreamKeyword) {
          finalObject = this.readStream(object);
        }
      }
    } finally {
      this.current = outer;
    }

    // Consume `endobj`
    const endToken = this.lexer.nextToken();
    if (endToken.type !== TokenType.EndObjKeyword) {
      // Be lenient: some producers omit endobj or place garbage between
      // the object and endobj. Log but do not throw.
      // For strictness we still throw.
      throw new PdfParseError({
        message:
          `PdfObjectParser: expected 'endobj' for object ${objNum} ${genNum} ` +
          `at offset ${endToken.offset}, got ${TokenType[endToken.type]} ` +
          `(${String(endToken.value)})`,
        offset: endToken.offset,
        expected: `'endobj' keyword for object ${objNum} ${genNum}`,
        actual: `${TokenType[endToken.type]} (${String(endToken.value)})`,
        data: this.lexer.rawData,
      });
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
        throw new PdfParseError({
          message: `PdfObjectParser: unterminated array at offset ${peek.offset}`,
          offset: peek.offset,
          expected: "']' to close array",
          actual: 'end of input',
          data: this.lexer.rawData,
        });
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
        throw new PdfParseError({
          message: `PdfObjectParser: unterminated dictionary at offset ${peek.offset}`,
          offset: peek.offset,
          expected: "'>>' to close dictionary",
          actual: 'end of input',
          data: this.lexer.rawData,
        });
      }

      // Key: must be a Name
      const keyToken = this.lexer.nextToken();
      if (keyToken.type !== TokenType.Name) {
        throw new PdfParseError({
          message:
            `PdfObjectParser: expected name as dictionary key at offset ` +
            `${keyToken.offset}, got ${TokenType[keyToken.type]} ` +
            `(${String(keyToken.value)})`,
          offset: keyToken.offset,
          expected: 'name token as dictionary key',
          actual: `${TokenType[keyToken.type]} (${String(keyToken.value)})`,
          data: this.lexer.rawData,
        });
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
   * requires a single newline (LF or CRLF) before the data bytes. Where the
   * data ends is decided by {@link frameStreamData}: the declared `/Length`
   * when `endstream` follows it, else the first `endstream` (or `endobj`)
   * minus one EOL. With `recover: false` a stream that needs the search
   * throws instead.
   *
   * @param dict  The stream's metadata dictionary (already parsed).
   * @returns     A `PdfStream` instance.
   */
  private readStream(dict: PdfDict): PdfStream {
    // Consume 'stream' keyword
    const streamKw = this.lexer.nextToken();
    if (streamKw.type !== TokenType.StreamKeyword) {
      throw new PdfParseError({
        message:
          `PdfObjectParser.readStream: expected 'stream' keyword at offset ` +
          `${streamKw.offset}, got ${TokenType[streamKw.type]}`,
        offset: streamKw.offset,
        expected: "'stream' keyword",
        actual: `${TokenType[streamKw.type]}`,
        data: this.lexer.rawData,
      });
    }

    // After the "stream" keyword, skip the mandatory end-of-line marker.
    // Per spec SS 7.3.8.1: the keyword stream shall be followed by a
    // single EOL marker (either CR+LF or just LF). We also tolerate
    // a lone CR for robustness.
    this.skipStreamEol();
    const dataStart = this.lexer.position;

    const declared = this.resolveStreamLength(dict);
    const bytes = this.lexer.rawData;
    this.keywords ??= new KeywordIndex(bytes);
    const frame = frameStreamData(bytes, dataStart, declared, this.keywords);
    if (frame === undefined) {
      throw new PdfParseError({
        message:
          `PdfObjectParser.readStream: no endstream or endobj after the stream data at ` +
          `offset ${dataStart}`,
        offset: dataStart,
        expected: "'endstream' keyword",
        actual: 'end of input',
        data: bytes,
      });
    }

    if (frame.recovered) {
      const length = frame.end - frame.start;
      if (!this.recover) {
        const owner =
          this.current === undefined
            ? `the stream at offset ${dataStart}`
            : `the stream of object ${this.current.objectNumber} ${this.current.generationNumber}`;
        const why =
          declared === undefined
            ? `no usable /Length (${this.describeLength(dict)})`
            : `/Length ${declared}, which endstream does not follow`;
        throw new PdfParseError({
          message:
            `PdfObjectParser.readStream: ${owner} has ${why}; the data would end after ` +
            `${length} bytes, and repairing it is off`,
          offset: dataStart,
          expected: 'a /Length that ends at endstream',
          actual: declared === undefined ? 'no usable /Length' : `/Length ${declared}`,
          data: bytes,
        });
      }
      this.onRecovered?.({
        objectNumber: this.current?.objectNumber,
        generationNumber: this.current?.generationNumber,
        offset: dataStart,
        declared,
        length,
      });
    }

    this.lexer.seek(frame.resumeAt);
    return new PdfStream(dict, bytes.subarray(frame.start, frame.end));
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
   * The declared length of a stream: the `/Length` entry when it is a safe
   * integer `>= 0`, one hop through the resolver (or the registry) when it is
   * an indirect reference. A missing, negative, fractional, oversized or
   * non-numeric value, a reference that resolves to anything but such a
   * number (a second reference included), a reference to a target that is
   * already being resolved, a reference to an object whose
   * resolution failed before (it is not tried again, so many streams that
   * name one broken object cost one attempt), and a reference met more than
   * {@link MAX_LENGTH_DEPTH} levels down all give `undefined`.
   *
   * @param dict  The stream dictionary.
   * @returns     The declared length, or `undefined` when there is none.
   * @throws      {@link ResourceLimitError} raised while resolving the reference.
   */
  private resolveStreamLength(dict: PdfDict): number | undefined {
    let value: PdfObject | undefined = dict.get('/Length');
    if (value?.kind === 'ref') {
      value = this.resolveLengthRef(value as PdfRef);
    }
    if (value?.kind !== 'number') return undefined;
    const length = (value as PdfNumber).value;
    return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
  }

  /**
   * Resolve the target of an indirect `/Length`. The lexer position is saved
   * and restored, because resolving parses another object with the lexer the
   * stream is being read with.
   */
  private resolveLengthRef(ref: PdfRef): PdfObject | undefined {
    if (this.resolveLength === undefined) return this.registry.resolve(ref);
    const { objectNumber } = ref;
    if (this.lengthsInProgress.has(objectNumber) || this.failedLengths.has(objectNumber)) {
      return undefined;
    }
    if (this.lengthsInProgress.size >= MAX_LENGTH_DEPTH) return undefined;
    const position = this.lexer.position;
    this.lengthsInProgress.add(objectNumber);
    try {
      return this.resolveLength(ref);
    } catch (err) {
      if (err instanceof ResourceLimitError) throw err;
      this.failedLengths.add(objectNumber);
      return undefined;
    } finally {
      this.lengthsInProgress.delete(objectNumber);
      this.lexer.seek(position);
    }
  }

  /** Why a stream dictionary has no usable `/Length`, for the strict-mode message. */
  private describeLength(dict: PdfDict): string {
    const value = dict.get('/Length');
    if (value === undefined) return 'the entry is missing';
    if (value.kind === 'ref') {
      const ref = value as PdfRef;
      return `${ref.objectNumber} ${ref.generationNumber} R is not resolved to a non-negative integer`;
    }
    if (value.kind === 'number')
      return `${(value as PdfNumber).value} is not a non-negative integer`;
    return `the entry is ${value.kind}, not a number`;
  }
}

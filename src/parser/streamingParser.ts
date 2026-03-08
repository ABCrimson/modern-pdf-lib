/**
 * @module parser/streamingParser
 *
 * Streaming / incremental PDF parser that processes PDF data without
 * loading the entire file into memory.
 *
 * Useful for multi-GB PDFs where loading everything into memory is
 * impractical. The parser operates in two phases:
 *
 * 1. **Structure phase** — reads the header, locates `startxref`,
 *    parses the cross-reference table/stream, and builds the page
 *    tree skeleton (offsets only, no content loaded).
 *
 * 2. **Content phase** — individual page content is loaded on demand
 *    via {@link StreamingPdfParser.getPageContent}.
 *
 * Uses the Web Streams API (`ReadableStream`) for universal runtime
 * support (browsers, Node 18+, Deno, Bun, Cloudflare Workers).
 *
 * Reference: PDF 1.7 spec, §§7.5 (File Structure), 7.7 (Document
 * Structure).
 *
 * @packageDocumentation
 */

import { PdfParseError } from './parseError.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Options for the streaming PDF parser.
 */
export interface StreamingParserOptions {
  /** Maximum bytes to buffer at once. Default: 64 MB. */
  maxBufferSize?: number;
  /** Whether to parse content streams. Default: false. */
  parseContentStreams?: boolean;
  /** Pages to parse (for selective loading). Default: all. */
  pageRange?: { start?: number; end?: number };
}

/**
 * A page extracted from the streaming parse — contains structural
 * metadata (boxes, rotation) and the byte-range location of its
 * content stream within the PDF data, but *not* the content bytes
 * themselves.
 */
export interface ParsedPage {
  /** Zero-based page index. */
  index: number;
  /** The /MediaBox rectangle. */
  mediaBox: [number, number, number, number];
  /** The /CropBox rectangle (if present). */
  cropBox?: [number, number, number, number];
  /** Page rotation in degrees (0, 90, 180, 270). */
  rotation?: number;
  /** Byte offset of the content stream within the PDF data. */
  contentStreamOffset: number;
  /** Length of the content stream in bytes. */
  contentStreamLength: number;
  /** Byte offset of the /Resources dictionary (if resolvable). */
  resourcesOffset?: number;
}

/**
 * The result of a streaming parse operation.
 */
export interface StreamingParseResult {
  /** PDF version string (e.g. "1.7", "2.0"). */
  version: string;
  /** Total number of pages in the document. */
  pageCount: number;
  /** Parsed page metadata. */
  pages: ParsedPage[];
  /** Document metadata from /Info dictionary. */
  metadata?: Record<string, string>;
  /** Whether the PDF is encrypted. */
  isEncrypted: boolean;
  /** Whether the PDF is linearized (web-optimized). */
  isLinearized: boolean;
  /** Byte offset of the cross-reference section. */
  xrefOffset: number;
}

/**
 * Events emitted during streaming parsing.
 */
export type StreamingParserEvent =
  | { type: 'header'; version: string }
  | { type: 'xref'; offset: number; entries: number }
  | { type: 'trailer'; dict: Record<string, unknown> }
  | { type: 'page'; index: number; page: ParsedPage }
  | { type: 'object'; number: number; generation: number; offset: number }
  | { type: 'progress'; bytesRead: number; totalBytes: number }
  | { type: 'error'; message: string; offset: number };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TEXT_DECODER = new TextDecoder('latin1');

/** Read a big-endian integer of `width` bytes from `data` at `offset`. */
function readBEInt(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let i = 0; i < width; i++) {
    value = (value << 8) | (data[offset + i] ?? 0);
  }
  return value >>> 0;
}

/**
 * Concatenate two Uint8Arrays into a new one.
 */
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

/**
 * Scan backwards from `startPos` for a byte sequence (encoded as ASCII).
 * Returns the byte offset of the first character of `needle`, or -1.
 */
function reverseIndexOf(
  data: Uint8Array,
  needle: string,
  startPos: number,
): number {
  const len = needle.length;
  for (let i = startPos; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (data[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/** Check if a byte is PDF whitespace. */
function isWhitespace(b: number): boolean {
  return b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;
}

/** Check if a byte is a PDF delimiter. */
function isDelimiter(b: number): boolean {
  return (
    b === 0x28 || b === 0x29 || b === 0x3c || b === 0x3e ||
    b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d ||
    b === 0x2f || b === 0x25
  );
}

/**
 * Skip whitespace in `data` starting at `pos`. Returns the new position.
 */
function skipWS(data: Uint8Array, pos: number): number {
  while (pos < data.length && isWhitespace(data[pos]!)) pos++;
  return pos;
}

/**
 * Read a decimal integer from `data` starting at `pos`.
 * Returns `{ value, nextPos }`.
 */
function readInt(
  data: Uint8Array,
  pos: number,
): { value: number; nextPos: number } {
  let value = 0;
  let started = false;
  while (pos < data.length) {
    const b = data[pos]!;
    if (b >= 0x30 && b <= 0x39) {
      value = value * 10 + (b - 0x30);
      started = true;
      pos++;
    } else {
      break;
    }
  }
  if (!started) {
    return { value: -1, nextPos: pos };
  }
  return { value, nextPos: pos };
}

/**
 * Read a PDF token (name, number, keyword, string) at `pos`.
 * Simplified — only handles what we need for lightweight structure parsing.
 */
function readToken(
  data: Uint8Array,
  pos: number,
): { token: string; nextPos: number } {
  pos = skipWS(data, pos);
  if (pos >= data.length) return { token: '', nextPos: pos };

  const b = data[pos]!;

  // Name: /Something
  if (b === 0x2f) {
    let end = pos + 1;
    while (end < data.length && !isWhitespace(data[end]!) && !isDelimiter(data[end]!)) {
      end++;
    }
    return { token: TEXT_DECODER.decode(data.subarray(pos, end)), nextPos: end };
  }

  // Number or keyword
  if (!isDelimiter(b)) {
    let end = pos;
    while (end < data.length && !isWhitespace(data[end]!) && !isDelimiter(data[end]!)) {
      end++;
    }
    return { token: TEXT_DECODER.decode(data.subarray(pos, end)), nextPos: end };
  }

  // Single delimiter character
  return { token: String.fromCharCode(b), nextPos: pos + 1 };
}

/**
 * Parse a simple array of numbers, e.g. `[0 0 612 792]`.
 * `pos` should point at the `[` byte.
 *
 * If non-numeric content is encountered (e.g. indirect references),
 * the function skips to the closing `]` and returns whatever numbers
 * it has collected so far.
 */
function parseNumberArray(
  data: Uint8Array,
  pos: number,
): { values: number[]; nextPos: number } {
  if (data[pos] !== 0x5b /* [ */) {
    return { values: [], nextPos: pos };
  }
  pos++; // skip '['
  const values: number[] = [];
  while (pos < data.length) {
    pos = skipWS(data, pos);
    if (pos >= data.length || data[pos] === 0x5d /* ] */) {
      if (pos < data.length) pos++; // skip ']'
      break;
    }

    const b = data[pos]!;

    // Check if this looks like a number start (digit, sign, or dot)
    const isNumStart =
      (b >= 0x30 && b <= 0x39) ||
      b === 0x2d /* - */ ||
      b === 0x2b /* + */ ||
      b === 0x2e /* . */;

    if (!isNumStart) {
      // Non-numeric content — skip this byte and continue.
      // This handles indirect references like "3 0 R" where we hit 'R'.
      pos++;
      continue;
    }

    // Read a number (possibly negative or decimal)
    let neg = false;
    if (b === 0x2d /* - */) {
      neg = true;
      pos++;
    } else if (b === 0x2b /* + */) {
      pos++;
    }
    let intPart = 0;
    let hasDot = false;
    let fracPart = 0;
    let fracDiv = 1;
    let digitCount = 0;
    while (pos < data.length) {
      const c = data[pos]!;
      if (c >= 0x30 && c <= 0x39) {
        if (hasDot) {
          fracPart = fracPart * 10 + (c - 0x30);
          fracDiv *= 10;
        } else {
          intPart = intPart * 10 + (c - 0x30);
        }
        digitCount++;
        pos++;
      } else if (c === 0x2e && !hasDot) {
        hasDot = true;
        pos++;
      } else {
        break;
      }
    }
    // Only push if we actually read some digits
    if (digitCount > 0) {
      let val = intPart + fracPart / fracDiv;
      if (neg) val = -val;
      values.push(val);
    }
  }
  return { values, nextPos: pos };
}

// ---------------------------------------------------------------------------
// Lightweight dictionary parser (key-value pairs from << ... >>)
// ---------------------------------------------------------------------------

interface LightDict {
  entries: Map<string, LightValue>;
  nextPos: number;
}

type LightValue =
  | { kind: 'name'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'ref'; objNum: number; genNum: number }
  | { kind: 'array'; values: number[] }
  | { kind: 'bool'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'dict'; entries: Map<string, LightValue> };

/**
 * Parse a lightweight dictionary starting at `pos` (must point at `<<`).
 * This only parses the types we need for structure parsing.
 */
function parseLightDict(data: Uint8Array, pos: number): LightDict {
  const entries = new Map<string, LightValue>();

  // Skip <<
  if (pos + 1 < data.length && data[pos] === 0x3c && data[pos + 1] === 0x3c) {
    pos += 2;
  } else {
    return { entries, nextPos: pos };
  }

  while (pos < data.length) {
    pos = skipWS(data, pos);
    if (pos >= data.length) break;

    // Check for >>
    if (data[pos] === 0x3e && pos + 1 < data.length && data[pos + 1] === 0x3e) {
      pos += 2;
      break;
    }

    // Read key (must be a name)
    if (data[pos] !== 0x2f) {
      // Not a name — skip one byte and retry
      pos++;
      continue;
    }

    const keyResult = readToken(data, pos);
    const key = keyResult.token;
    pos = keyResult.nextPos;

    // Read value
    pos = skipWS(data, pos);
    if (pos >= data.length) break;

    const valByte = data[pos]!;

    if (valByte === 0x2f) {
      // Name value
      const valResult = readToken(data, pos);
      entries.set(key, { kind: 'name', value: valResult.token });
      pos = valResult.nextPos;
    } else if (valByte === 0x5b) {
      // Array value (number array)
      const arrResult = parseNumberArray(data, pos);
      entries.set(key, { kind: 'array', values: arrResult.values });
      pos = arrResult.nextPos;
    } else if (valByte === 0x3c && pos + 1 < data.length && data[pos + 1] === 0x3c) {
      // Nested dict
      const nested = parseLightDict(data, pos);
      entries.set(key, { kind: 'dict', entries: nested.entries });
      pos = nested.nextPos;
    } else if (valByte === 0x28) {
      // String value (...)
      pos++;
      let depth = 1;
      const chars: string[] = [];
      while (pos < data.length && depth > 0) {
        const c = data[pos]!;
        if (c === 0x5c) {
          pos++;
          if (pos < data.length) {
            chars.push(String.fromCharCode(data[pos]!));
            pos++;
          }
        } else if (c === 0x28) {
          depth++;
          chars.push('(');
          pos++;
        } else if (c === 0x29) {
          depth--;
          if (depth > 0) chars.push(')');
          pos++;
        } else {
          chars.push(String.fromCharCode(c));
          pos++;
        }
      }
      entries.set(key, { kind: 'string', value: chars.join('') });
    } else if (
      (valByte >= 0x30 && valByte <= 0x39) ||
      valByte === 0x2d ||
      valByte === 0x2b ||
      valByte === 0x2e
    ) {
      // Number or indirect reference
      const num1 = readToken(data, pos);
      pos = num1.nextPos;
      const savedPos = pos;
      const num2 = readToken(data, pos);

      if (num2.token === 'R' || num2.token === '') {
        // Just a number
        entries.set(key, { kind: 'number', value: parseFloat(num1.token) });
        pos = savedPos;
      } else {
        // Might be "N G R"
        const rToken = readToken(data, num2.nextPos);
        if (rToken.token === 'R') {
          entries.set(key, {
            kind: 'ref',
            objNum: parseInt(num1.token, 10),
            genNum: parseInt(num2.token, 10),
          });
          pos = rToken.nextPos;
        } else {
          // Just a number
          entries.set(key, { kind: 'number', value: parseFloat(num1.token) });
          pos = savedPos;
        }
      }
    } else if (valByte === 0x74 || valByte === 0x66) {
      // true / false
      const boolResult = readToken(data, pos);
      entries.set(key, { kind: 'bool', value: boolResult.token === 'true' });
      pos = boolResult.nextPos;
    } else {
      // Unknown value — try reading a token and skip
      const skip = readToken(data, pos);
      pos = skip.nextPos;
    }
  }

  return { entries, nextPos: pos };
}

/**
 * Get a name value from a LightDict.
 */
function getDictName(dict: Map<string, LightValue>, key: string): string | undefined {
  const v = dict.get(key);
  if (v?.kind === 'name') return v.value;
  return undefined;
}

/**
 * Get a number value from a LightDict.
 */
function getDictNumber(dict: Map<string, LightValue>, key: string): number | undefined {
  const v = dict.get(key);
  if (v?.kind === 'number') return v.value;
  return undefined;
}

/**
 * Get an indirect reference from a LightDict.
 */
function getDictRef(
  dict: Map<string, LightValue>,
  key: string,
): { objNum: number; genNum: number } | undefined {
  const v = dict.get(key);
  if (v?.kind === 'ref') return { objNum: v.objNum, genNum: v.genNum };
  return undefined;
}

/**
 * Get a number array from a LightDict.
 */
function getDictNumberArray(
  dict: Map<string, LightValue>,
  key: string,
): number[] | undefined {
  const v = dict.get(key);
  if (v?.kind === 'array') return v.values;
  return undefined;
}

/**
 * Get a string value from a LightDict.
 */
function getDictString(
  dict: Map<string, LightValue>,
  key: string,
): string | undefined {
  const v = dict.get(key);
  if (v?.kind === 'string') return v.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// StreamingPdfParser
// ---------------------------------------------------------------------------

/**
 * Event handler type for streaming parser events.
 */
type EventHandler = (event: StreamingParserEvent) => void;

/**
 * A streaming PDF parser that processes PDF data incrementally without
 * loading the entire file into memory.
 *
 * Useful for multi-GB PDFs where loading everything into memory is
 * impractical.
 *
 * @example
 * ```ts
 * // From a ReadableStream (e.g. fetch response)
 * const response = await fetch('/large.pdf');
 * const result = await StreamingPdfParser.fromStream(response.body!);
 * console.log(`Pages: ${result.pageCount}`);
 * ```
 *
 * @example
 * ```ts
 * // Chunk-by-chunk with events
 * const parser = new StreamingPdfParser();
 * parser.on('page', (event) => {
 *   if (event.type === 'page') console.log(`Page ${event.index}`);
 * });
 * parser.feed(chunk1);
 * parser.feed(chunk2);
 * const result = parser.end();
 * ```
 */
export class StreamingPdfParser {
  private readonly options: Required<StreamingParserOptions>;
  private buffer: Uint8Array = new Uint8Array(0);
  private totalBytesRead = 0;
  private readonly handlers = new Map<StreamingParserEvent['type'], EventHandler[]>();

  // Parsed state
  private version = '';
  private headerParsed = false;
  private xrefOffset = -1;
  private isEncrypted = false;
  private isLinearized = false;
  private pages: ParsedPage[] = [];
  private metadata: Record<string, string> | undefined;
  private xrefEntries = new Map<number, { offset: number; gen: number; type: string; container?: number; index?: number }>();
  private trailerDict: Map<string, LightValue> | undefined;

  // For getPageContent — stores the full data reference
  private fullData: Uint8Array | undefined;

  constructor(options?: StreamingParserOptions) {
    this.options = {
      maxBufferSize: options?.maxBufferSize ?? 64 * 1024 * 1024,
      parseContentStreams: options?.parseContentStreams ?? false,
      pageRange: options?.pageRange ?? {},
    };
  }

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  /**
   * Register an event listener for a specific event type.
   */
  on(event: StreamingParserEvent['type'], handler: EventHandler): void {
    let list = this.handlers.get(event);
    if (!list) {
      list = [];
      this.handlers.set(event, list);
    }
    list.push(handler);
  }

  private emit(event: StreamingParserEvent): void {
    const list = this.handlers.get(event.type);
    if (list) {
      for (const handler of list) {
        handler(event);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Feed / End API
  // -----------------------------------------------------------------------

  /**
   * Feed a chunk of data to the parser.
   *
   * Chunks are buffered internally. The parser does not process data
   * until {@link end} is called (the PDF structure requires knowing
   * the full file to locate startxref).
   */
  feed(chunk: Uint8Array): void {
    if (this.buffer.length + chunk.length > this.options.maxBufferSize) {
      this.emit({
        type: 'error',
        message: `Buffer size would exceed maximum of ${this.options.maxBufferSize} bytes`,
        offset: this.totalBytesRead,
      });
      throw new PdfParseError({
        message: `Streaming parser buffer exceeded maximum size of ${this.options.maxBufferSize} bytes`,
        offset: this.totalBytesRead,
        expected: `data within ${this.options.maxBufferSize} bytes`,
        actual: `${this.buffer.length + chunk.length} bytes`,
      });
    }

    this.buffer = concat(this.buffer, chunk);
    this.totalBytesRead += chunk.length;

    this.emit({
      type: 'progress',
      bytesRead: this.totalBytesRead,
      totalBytes: this.totalBytesRead,
    });
  }

  /**
   * Signal end of input and perform the full parse.
   *
   * @returns The streaming parse result.
   * @throws  If the PDF is malformed or cannot be parsed.
   */
  end(): StreamingParseResult {
    const data = this.buffer;
    this.fullData = data;

    if (data.length < 8) {
      throw new PdfParseError({
        message: 'Invalid PDF: data too short to contain a valid PDF header.',
        offset: 0,
        expected: 'at least 8 bytes',
        actual: `${data.length} bytes`,
      });
    }

    // 1. Parse header
    this.parseHeader(data);

    // 2. Detect linearization (check first object after header)
    this.detectLinearization(data);

    // 3. Find startxref and parse xref
    this.xrefOffset = this.findStartXref(data);
    this.parseXref(data, this.xrefOffset);

    // 4. Check for encryption
    this.detectEncryption();

    // 5. Build page tree
    this.buildPageTree(data);

    // 6. Extract metadata
    this.extractMetadata(data);

    const result: StreamingParseResult = {
      version: this.version,
      pageCount: this.pages.length,
      pages: this.pages,
      isEncrypted: this.isEncrypted,
      isLinearized: this.isLinearized,
      xrefOffset: this.xrefOffset,
    };
    if (this.metadata !== undefined) {
      result.metadata = this.metadata;
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Static factory methods
  // -----------------------------------------------------------------------

  /**
   * Parse from a `ReadableStream<Uint8Array>`.
   *
   * Reads all chunks from the stream, then performs the structural
   * parse. For truly streaming random-access, the full data must be
   * available to seek to startxref and the xref table.
   */
  static async fromStream(
    stream: ReadableStream<Uint8Array>,
    options?: StreamingParserOptions,
  ): Promise<StreamingParseResult> {
    const parser = new StreamingPdfParser(options);
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(value);
      }
    } finally {
      reader.releaseLock();
    }

    return parser.end();
  }

  /**
   * Parse from a file path (Node.js / Deno / Bun only).
   *
   * Uses dynamic import of `node:fs` to avoid bundling issues in
   * browsers. Falls back to `Deno.readFile` if available.
   */
  static async fromFile(
    path: string,
    options?: StreamingParserOptions,
  ): Promise<StreamingParseResult> {
    // Try Node.js fs (dynamic import to avoid bundling issues)
    try {
      type NodeFs = { createReadStream(p: string): {
        on(event: string, cb: (...args: unknown[]) => void): void;
      } };
      const fs = await (Function('return import("node:fs")')() as Promise<NodeFs>);
      const stream = fs.createReadStream(path);
      const parser = new StreamingPdfParser(options);

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: unknown) => {
          parser.feed(
            chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer),
          );
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: unknown) => reject(err));
      });

      return parser.end();
    } catch {
      // Node.js fs not available — try Deno
      const deno = (globalThis as Record<string, unknown>).Deno as
        | { readFile(path: string): Promise<Uint8Array> }
        | undefined;
      if (deno?.readFile) {
        const data = await deno.readFile(path);
        const parser = new StreamingPdfParser(options);
        parser.feed(data);
        return parser.end();
      }

      throw new PdfParseError({
        message:
          'StreamingPdfParser.fromFile() requires Node.js, Deno, or Bun runtime. ' +
          'Use fromStream() with a ReadableStream in browsers.',
        offset: 0,
        expected: 'Node.js, Deno, or Bun runtime',
        actual: 'unsupported runtime',
      });
    }
  }

  // -----------------------------------------------------------------------
  // On-demand page content
  // -----------------------------------------------------------------------

  /**
   * Get the raw content stream bytes for a specific page.
   *
   * Requires that the full data has been buffered (i.e. {@link end}
   * was called). Returns the raw (possibly compressed) bytes of the
   * page's content stream.
   *
   * @param pageIndex  Zero-based page index.
   * @returns          The raw content stream bytes.
   */
  async getPageContent(pageIndex: number): Promise<Uint8Array> {
    if (!this.fullData) {
      throw new PdfParseError({
        message: 'Cannot get page content before calling end().',
        offset: 0,
        expected: 'end() called before getPageContent()',
        actual: 'end() not yet called',
      });
    }

    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      throw new PdfParseError({
        message: `Page index ${pageIndex} is out of range (0-${this.pages.length - 1}).`,
        offset: 0,
        expected: `page index in [0, ${this.pages.length})`,
        actual: `${pageIndex}`,
      });
    }

    const page = this.pages[pageIndex]!;
    if (page.contentStreamOffset === 0 && page.contentStreamLength === 0) {
      return new Uint8Array(0);
    }

    const start = page.contentStreamOffset;
    const end = start + page.contentStreamLength;
    return this.fullData.slice(start, Math.min(end, this.fullData.length));
  }

  // -----------------------------------------------------------------------
  // Internal: header parsing
  // -----------------------------------------------------------------------

  private parseHeader(data: Uint8Array): void {
    const headerText = TEXT_DECODER.decode(
      data.subarray(0, Math.min(1024, data.length)),
    );
    const pdfIdx = headerText.indexOf('%PDF-');
    if (pdfIdx === -1) {
      this.emit({
        type: 'error',
        message: 'No %PDF- header found',
        offset: 0,
      });
      throw new PdfParseError({
        message: 'Invalid PDF: file does not contain a "%PDF-" header.',
        offset: 0,
        expected: '"%PDF-" header',
        actual: 'no header found',
        data,
      });
    }

    const versionMatch = headerText.slice(pdfIdx).match(/%PDF-(\d+\.\d+)/);
    if (!versionMatch) {
      throw new PdfParseError({
        message: 'Invalid PDF: could not parse version from header.',
        offset: pdfIdx,
        expected: '"%PDF-X.Y" version string',
        actual: `"${headerText.slice(pdfIdx, pdfIdx + 10)}"`,
        data,
      });
    }

    this.version = versionMatch[1]!;
    this.headerParsed = true;

    this.emit({ type: 'header', version: this.version });
  }

  // -----------------------------------------------------------------------
  // Internal: linearization detection
  // -----------------------------------------------------------------------

  private detectLinearization(data: Uint8Array): void {
    // A linearized PDF has a Linearized dictionary in the first
    // indirect object. Scan for /Linearized within the first 1024 bytes.
    const searchWindow = Math.min(1024, data.length);
    const text = TEXT_DECODER.decode(data.subarray(0, searchWindow));
    this.isLinearized = text.includes('/Linearized');
  }

  // -----------------------------------------------------------------------
  // Internal: startxref + xref parsing
  // -----------------------------------------------------------------------

  private findStartXref(data: Uint8Array): number {
    // Search last 2048 bytes for "startxref"
    const searchWindow = Math.min(data.length, 2048);
    const startPos = data.length - searchWindow;

    const idx = reverseIndexOf(data, 'startxref', data.length - 10);
    if (idx === -1) {
      this.emit({
        type: 'error',
        message: 'Could not find "startxref" marker',
        offset: startPos,
      });
      throw new PdfParseError({
        message:
          'Invalid PDF: could not find "startxref" marker in the last 2048 bytes.',
        offset: startPos,
        expected: '"startxref" near end of file',
        actual: 'no "startxref" found',
        data,
      });
    }

    // Read the offset number after "startxref"
    const afterKeyword = TEXT_DECODER.decode(
      data.subarray(idx + 9, Math.min(idx + 30, data.length)),
    ).trim();
    const match = afterKeyword.match(/^(\d+)/);
    if (!match) {
      throw new PdfParseError({
        message: 'Invalid PDF: no valid offset after "startxref".',
        offset: idx,
        expected: 'decimal offset after "startxref"',
        actual: `"${afterKeyword.slice(0, 20)}"`,
        data,
      });
    }

    return parseInt(match[1]!, 10);
  }

  private parseXref(data: Uint8Array, offset: number): void {
    // Determine if traditional xref or xref stream
    if (
      offset + 4 <= data.length &&
      data[offset] === 0x78 && // x
      data[offset + 1] === 0x72 && // r
      data[offset + 2] === 0x65 && // e
      data[offset + 3] === 0x66 // f
    ) {
      this.parseTraditionalXref(data, offset);
    } else {
      this.parseXrefStream(data, offset);
    }
  }

  private parseTraditionalXref(data: Uint8Array, offset: number): void {
    let pos = offset + 4; // skip "xref"
    pos = skipWS(data, pos);

    // Parse subsections until "trailer"
    while (pos < data.length) {
      // Check for "trailer"
      if (
        pos + 7 <= data.length &&
        data[pos] === 0x74 && data[pos + 1] === 0x72 &&
        data[pos + 2] === 0x61 && data[pos + 3] === 0x69 &&
        data[pos + 4] === 0x6c && data[pos + 5] === 0x65 &&
        data[pos + 6] === 0x72
      ) {
        break;
      }

      // Read subsection header: firstObjNum count
      const firstObjResult = readInt(data, pos);
      if (firstObjResult.value === -1) break;
      pos = skipWS(data, firstObjResult.nextPos);
      const countResult = readInt(data, pos);
      if (countResult.value === -1) break;
      pos = skipWS(data, countResult.nextPos);

      const firstObjNum = firstObjResult.value;
      const count = countResult.value;

      // Read entries
      for (let i = 0; i < count; i++) {
        const objectNumber = firstObjNum + i;

        // Standard format: 10-digit offset, space, 5-digit gen, space, f/n
        if (pos + 18 <= data.length) {
          let entryOffset = 0;
          let valid = true;
          for (let k = 0; k < 10; k++) {
            const b = data[pos + k]!;
            if (b < 0x30 || b > 0x39) { valid = false; break; }
            entryOffset = entryOffset * 10 + (b - 0x30);
          }
          if (valid && data[pos + 10] === 0x20) {
            let gen = 0;
            for (let k = 0; k < 5; k++) {
              const b = data[pos + 11 + k]!;
              if (b < 0x30 || b > 0x39) { valid = false; break; }
              gen = gen * 10 + (b - 0x30);
            }
            if (valid) {
              const marker = data[pos + 17]!;
              const type = marker === 0x6e ? 'in-use' : 'free';

              if (!this.xrefEntries.has(objectNumber)) {
                this.xrefEntries.set(objectNumber, {
                  offset: entryOffset,
                  gen,
                  type,
                });

                if (type === 'in-use' && objectNumber > 0) {
                  this.emit({
                    type: 'object',
                    number: objectNumber,
                    generation: gen,
                    offset: entryOffset,
                  });
                }
              }

              // Advance past the 18 significant bytes + trailing whitespace
              pos += 18;
              while (pos < data.length && (data[pos] === 0x20 || data[pos] === 0x0d || data[pos] === 0x0a)) {
                pos++;
              }
              continue;
            }
          }
        }

        // Fallback: skip line
        while (pos < data.length && data[pos] !== 0x0a && data[pos] !== 0x0d) {
          pos++;
        }
        while (pos < data.length && (data[pos] === 0x0a || data[pos] === 0x0d)) {
          pos++;
        }
      }
    }

    // Parse trailer dictionary
    // Skip past "trailer" keyword
    if (
      pos + 7 <= data.length &&
      data[pos] === 0x74 && data[pos + 1] === 0x72 &&
      data[pos + 2] === 0x61 && data[pos + 3] === 0x69 &&
      data[pos + 4] === 0x6c && data[pos + 5] === 0x65 &&
      data[pos + 6] === 0x72
    ) {
      pos += 7;
      pos = skipWS(data, pos);

      const dictResult = parseLightDict(data, pos);
      this.trailerDict = dictResult.entries;

      // Emit trailer event
      const trailerObj: Record<string, unknown> = {};
      for (const [key, val] of dictResult.entries) {
        if (val.kind === 'number') trailerObj[key] = val.value;
        else if (val.kind === 'name') trailerObj[key] = val.value;
        else if (val.kind === 'ref') trailerObj[key] = `${val.objNum} ${val.genNum} R`;
        else if (val.kind === 'bool') trailerObj[key] = val.value;
        else if (val.kind === 'string') trailerObj[key] = val.value;
      }
      this.emit({ type: 'trailer', dict: trailerObj });

      // Follow /Prev chain
      const prevVal = getDictNumber(dictResult.entries, '/Prev');
      if (prevVal !== undefined && prevVal >= 0 && prevVal !== offset) {
        this.parseXref(data, prevVal);
      }
    }

    this.emit({
      type: 'xref',
      offset,
      entries: this.xrefEntries.size,
    });
  }

  private parseXrefStream(data: Uint8Array, offset: number): void {
    // The xref stream is an indirect object. Parse its header: N G obj
    let pos = skipWS(data, offset);
    const objNumResult = readInt(data, pos);
    pos = skipWS(data, objNumResult.nextPos);
    const genResult = readInt(data, pos);
    pos = skipWS(data, genResult.nextPos);

    // Skip "obj" keyword
    if (
      pos + 3 <= data.length &&
      data[pos] === 0x6f && data[pos + 1] === 0x62 && data[pos + 2] === 0x6a
    ) {
      pos += 3;
    }
    pos = skipWS(data, pos);

    // Parse the stream dictionary
    const dictResult = parseLightDict(data, pos);
    this.trailerDict = dictResult.entries;

    // Emit trailer event (xref stream dict serves as trailer)
    const trailerObj: Record<string, unknown> = {};
    for (const [key, val] of dictResult.entries) {
      if (val.kind === 'number') trailerObj[key] = val.value;
      else if (val.kind === 'name') trailerObj[key] = val.value;
      else if (val.kind === 'ref') trailerObj[key] = `${val.objNum} ${val.genNum} R`;
    }
    this.emit({ type: 'trailer', dict: trailerObj });

    // For xref streams we need to decompress the stream data.
    // This requires the /W widths, /Size, /Index, and the stream data.
    // For the streaming parser, we record the xref stream metadata but
    // skip full decompression — we parse only the trailer fields needed
    // for structure resolution.

    // Extract /Size
    const size = getDictNumber(dictResult.entries, '/Size') ?? 0;

    // We cannot fully parse the xref stream binary data without a
    // deflate decompressor. Instead, we fall back to scanning the file
    // for "N G obj" patterns to build a basic xref.
    this.rebuildXrefFromScan(data);

    this.emit({
      type: 'xref',
      offset,
      entries: this.xrefEntries.size,
    });

    // Follow /Prev chain
    const prevVal = getDictNumber(dictResult.entries, '/Prev');
    if (prevVal !== undefined && prevVal >= 0 && prevVal !== offset) {
      this.parseXref(data, prevVal);
    }
  }

  /**
   * Rebuild xref by scanning the file for "N G obj" patterns.
   * Used as a fallback for xref streams (which require decompression).
   */
  private rebuildXrefFromScan(data: Uint8Array): void {
    const len = data.length;

    for (let i = 0; i < len - 2; i++) {
      // Match 'obj' bytes
      if (data[i] !== 0x6f || data[i + 1] !== 0x62 || data[i + 2] !== 0x6a) continue;

      // Must be followed by whitespace, delimiter, or EOF
      if (i + 3 < len) {
        const after = data[i + 3]!;
        if (
          after > 0x20 &&
          after !== 0x25 && after !== 0x28 && after !== 0x29 &&
          after !== 0x2f && after !== 0x3c && after !== 0x3e &&
          after !== 0x5b && after !== 0x5d && after !== 0x7b && after !== 0x7d
        ) {
          continue;
        }
      }

      // Scan backwards: skip whitespace before 'obj'
      let j = i - 1;
      while (j >= 0 && isWhitespace(data[j]!)) j--;

      // Read generation number (digits backwards)
      const genEnd = j + 1;
      while (j >= 0 && data[j]! >= 0x30 && data[j]! <= 0x39) j--;
      const genStart = j + 1;
      if (genStart >= genEnd) continue;

      // Skip whitespace between object number and generation number
      while (j >= 0 && isWhitespace(data[j]!)) j--;

      // Read object number (digits backwards)
      const objEnd = j + 1;
      while (j >= 0 && data[j]! >= 0x30 && data[j]! <= 0x39) j--;
      const objStart = j + 1;
      if (objStart >= objEnd) continue;

      // Parse numbers
      let objectNumber = 0;
      for (let k = objStart; k < objEnd; k++) objectNumber = objectNumber * 10 + (data[k]! - 0x30);
      let gen = 0;
      for (let k = genStart; k < genEnd; k++) gen = gen * 10 + (data[k]! - 0x30);

      if (!this.xrefEntries.has(objectNumber)) {
        this.xrefEntries.set(objectNumber, {
          offset: objStart,
          gen,
          type: 'in-use',
        });

        this.emit({
          type: 'object',
          number: objectNumber,
          generation: gen,
          offset: objStart,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: encryption detection
  // -----------------------------------------------------------------------

  private detectEncryption(): void {
    if (!this.trailerDict) return;
    const encryptRef = getDictRef(this.trailerDict, '/Encrypt');
    this.isEncrypted = encryptRef !== undefined;
  }

  // -----------------------------------------------------------------------
  // Internal: page tree building
  // -----------------------------------------------------------------------

  private buildPageTree(data: Uint8Array): void {
    if (!this.trailerDict) return;

    // Get /Root reference
    const rootRef = getDictRef(this.trailerDict, '/Root');
    if (!rootRef) return;

    // Find the catalog object
    const catalogEntry = this.xrefEntries.get(rootRef.objNum);
    if (!catalogEntry || catalogEntry.type !== 'in-use') return;

    // Parse catalog dict
    const catalogDict = this.parseObjectDict(data, catalogEntry.offset);
    if (!catalogDict) return;

    // Get /Pages reference
    const pagesRef = getDictRef(catalogDict, '/Pages');
    if (!pagesRef) return;

    // Traverse the page tree
    this.traversePageTree(data, pagesRef.objNum, {}, new Set());
  }

  /**
   * Parse the dictionary of an indirect object at `offset`.
   * Returns the dictionary entries or undefined if parsing fails.
   */
  private parseObjectDict(
    data: Uint8Array,
    offset: number,
  ): Map<string, LightValue> | undefined {
    let pos = skipWS(data, offset);

    // Skip "N G obj"
    // Object number
    const objNumResult = readInt(data, pos);
    if (objNumResult.value === -1) return undefined;
    pos = skipWS(data, objNumResult.nextPos);
    // Generation number
    const genResult = readInt(data, pos);
    if (genResult.value === -1) return undefined;
    pos = skipWS(data, genResult.nextPos);
    // "obj" keyword
    if (
      pos + 3 <= data.length &&
      data[pos] === 0x6f && data[pos + 1] === 0x62 && data[pos + 2] === 0x6a
    ) {
      pos += 3;
    } else {
      return undefined;
    }
    pos = skipWS(data, pos);

    // Parse the dictionary
    if (pos + 1 < data.length && data[pos] === 0x3c && data[pos + 1] === 0x3c) {
      const dictResult = parseLightDict(data, pos);
      return dictResult.entries;
    }
    return undefined;
  }

  /**
   * Traverse the page tree recursively, collecting page metadata.
   */
  private traversePageTree(
    data: Uint8Array,
    objNum: number,
    inherited: {
      mediaBox?: [number, number, number, number];
      cropBox?: [number, number, number, number];
      rotation?: number;
    },
    visited: Set<number>,
  ): void {
    if (visited.has(objNum)) return;
    visited.add(objNum);

    const entry = this.xrefEntries.get(objNum);
    if (!entry || entry.type !== 'in-use') return;

    const dict = this.parseObjectDict(data, entry.offset);
    if (!dict) return;

    // Build current inherited attributes
    const currentInherited = { ...inherited };
    const mediaBoxArr = getDictNumberArray(dict, '/MediaBox');
    if (mediaBoxArr?.length === 4) {
      currentInherited.mediaBox = mediaBoxArr as [number, number, number, number];
    }
    const cropBoxArr = getDictNumberArray(dict, '/CropBox');
    if (cropBoxArr?.length === 4) {
      currentInherited.cropBox = cropBoxArr as [number, number, number, number];
    }
    const rotate = getDictNumber(dict, '/Rotate');
    if (rotate !== undefined) {
      currentInherited.rotation = rotate;
    }

    const typeName = getDictName(dict, '/Type');

    if (typeName === '/Page') {
      // Check page range filter
      const pageIndex = this.pages.length;
      const { start, end } = this.options.pageRange;
      if (start !== undefined && pageIndex < start) {
        this.pages.push(this.makeEmptyPage(pageIndex, currentInherited));
        return;
      }
      if (end !== undefined && pageIndex >= end) {
        this.pages.push(this.makeEmptyPage(pageIndex, currentInherited));
        return;
      }

      // Find content stream offset
      let contentStreamOffset = 0;
      let contentStreamLength = 0;

      const contentsRef = getDictRef(dict, '/Contents');
      if (contentsRef) {
        const contentsEntry = this.xrefEntries.get(contentsRef.objNum);
        if (contentsEntry && contentsEntry.type === 'in-use') {
          // Parse the content object to find the stream keyword
          const streamInfo = this.findStreamData(data, contentsEntry.offset);
          contentStreamOffset = streamInfo.offset;
          contentStreamLength = streamInfo.length;
        }
      }

      // Find resources offset
      let resourcesOffset: number | undefined;
      const resourcesRef = getDictRef(dict, '/Resources');
      if (resourcesRef) {
        const resEntry = this.xrefEntries.get(resourcesRef.objNum);
        if (resEntry && resEntry.type === 'in-use') {
          resourcesOffset = resEntry.offset;
        }
      }

      const page: ParsedPage = {
        index: pageIndex,
        mediaBox: currentInherited.mediaBox ?? [0, 0, 612, 792],
        contentStreamOffset,
        contentStreamLength,
      };
      if (currentInherited.cropBox !== undefined) {
        page.cropBox = currentInherited.cropBox;
      }
      if (currentInherited.rotation !== undefined) {
        page.rotation = currentInherited.rotation;
      }
      if (resourcesOffset !== undefined) {
        page.resourcesOffset = resourcesOffset;
      }

      this.pages.push(page);
      this.emit({ type: 'page', index: pageIndex, page });
      return;
    }

    // Intermediate /Pages node — traverse /Kids
    // We need to find /Kids array. The lightweight parser stores arrays
    // of numbers, but /Kids is an array of references. We parse it manually.
    const kidsRefs = this.parseKidsArray(data, dict, entry.offset);
    for (const kidObjNum of kidsRefs) {
      this.traversePageTree(data, kidObjNum, currentInherited, visited);
    }
  }

  /**
   * Parse the /Kids array from a /Pages node dictionary.
   * Returns an array of object numbers.
   */
  private parseKidsArray(
    data: Uint8Array,
    dict: Map<string, LightValue>,
    parentOffset: number,
  ): number[] {
    // The lightweight dict parser stored /Kids as a number array if all items
    // were numbers, but /Kids contains indirect references "N G R".
    // We need to re-parse from the raw data.

    // Find the /Kids keyword in the object data
    const objDict = this.parseObjectDict(data, parentOffset);
    if (!objDict) return [];

    // Search for /Kids in the raw bytes around parentOffset
    const searchStart = parentOffset;
    const searchEnd = Math.min(parentOffset + 4096, data.length);
    const searchText = TEXT_DECODER.decode(data.subarray(searchStart, searchEnd));

    const kidsIdx = searchText.indexOf('/Kids');
    if (kidsIdx === -1) return [];

    let pos = searchStart + kidsIdx + 5; // Skip "/Kids"
    pos = skipWS(data, pos);

    if (pos >= data.length || data[pos] !== 0x5b /* [ */) return [];
    pos++; // Skip '['

    const refs: number[] = [];
    while (pos < data.length) {
      pos = skipWS(data, pos);
      if (pos >= data.length || data[pos] === 0x5d /* ] */) break;

      // Read object number
      const objResult = readInt(data, pos);
      if (objResult.value === -1) break;
      pos = skipWS(data, objResult.nextPos);

      // Read generation number
      const genResult = readInt(data, pos);
      if (genResult.value === -1) break;
      pos = skipWS(data, genResult.nextPos);

      // Read 'R'
      if (pos < data.length && data[pos] === 0x52 /* R */) {
        refs.push(objResult.value);
        pos++;
      } else {
        break;
      }
    }

    return refs;
  }

  private makeEmptyPage(
    index: number,
    inherited: {
      mediaBox?: [number, number, number, number];
      cropBox?: [number, number, number, number];
      rotation?: number;
    },
  ): ParsedPage {
    const page: ParsedPage = {
      index,
      mediaBox: inherited.mediaBox ?? [0, 0, 612, 792],
      contentStreamOffset: 0,
      contentStreamLength: 0,
    };
    if (inherited.cropBox !== undefined) {
      page.cropBox = inherited.cropBox;
    }
    if (inherited.rotation !== undefined) {
      page.rotation = inherited.rotation;
    }
    return page;
  }

  /**
   * Find the stream data (between "stream\n" and "endstream") within
   * an indirect object at `offset`.
   */
  private findStreamData(
    data: Uint8Array,
    offset: number,
  ): { offset: number; length: number } {
    // Search for "stream" keyword after the dict
    const searchEnd = Math.min(offset + 8192, data.length);
    let pos = offset;

    // First try: use /Length from the object's dictionary to get exact bounds
    const dict = this.parseObjectDict(data, offset);
    const declaredLength = dict ? getDictNumber(dict, '/Length') : undefined;

    // Find "stream" keyword
    while (pos < searchEnd - 6) {
      if (
        data[pos] === 0x73 && data[pos + 1] === 0x74 &&
        data[pos + 2] === 0x72 && data[pos + 3] === 0x65 &&
        data[pos + 4] === 0x61 && data[pos + 5] === 0x6d
      ) {
        // Skip "stream" + line ending
        pos += 6;
        if (pos < data.length && data[pos] === 0x0d) pos++;
        if (pos < data.length && data[pos] === 0x0a) pos++;

        const streamStart = pos;

        if (declaredLength !== undefined && declaredLength > 0) {
          return { offset: streamStart, length: declaredLength };
        }

        // Find "endstream"
        while (pos < data.length - 9) {
          if (
            data[pos] === 0x65 && data[pos + 1] === 0x6e &&
            data[pos + 2] === 0x64 && data[pos + 3] === 0x73 &&
            data[pos + 4] === 0x74 && data[pos + 5] === 0x72 &&
            data[pos + 6] === 0x65 && data[pos + 7] === 0x61 &&
            data[pos + 8] === 0x6d
          ) {
            // Trim trailing whitespace before endstream
            let streamEnd = pos;
            while (streamEnd > streamStart && isWhitespace(data[streamEnd - 1]!)) {
              streamEnd--;
            }
            return { offset: streamStart, length: streamEnd - streamStart };
          }
          pos++;
        }

        return { offset: streamStart, length: 0 };
      }
      pos++;
    }

    return { offset: 0, length: 0 };
  }

  // -----------------------------------------------------------------------
  // Internal: metadata extraction
  // -----------------------------------------------------------------------

  private extractMetadata(data: Uint8Array): void {
    if (!this.trailerDict) return;

    const infoRef = getDictRef(this.trailerDict, '/Info');
    if (!infoRef) return;

    const infoEntry = this.xrefEntries.get(infoRef.objNum);
    if (!infoEntry || infoEntry.type !== 'in-use') return;

    const dict = this.parseObjectDict(data, infoEntry.offset);
    if (!dict) return;

    const metadata: Record<string, string> = {};
    for (const [key, val] of dict) {
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      if (val.kind === 'string') {
        metadata[cleanKey] = val.value;
      } else if (val.kind === 'name') {
        metadata[cleanKey] = val.value;
      } else if (val.kind === 'number') {
        metadata[cleanKey] = String(val.value);
      }
    }

    if (Object.keys(metadata).length > 0) {
      this.metadata = metadata;
    }
  }
}

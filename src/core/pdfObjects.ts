/**
 * @module core/pdfObjects
 *
 * Low-level PDF object model.  Every PDF value type has a class with a
 * `serialize(writer)` method that appends valid PDF syntax to a
 * {@link ByteWriter}.  The module also provides `PdfObjectRegistry` for
 * allocating indirect-object numbers.
 *
 * Reference: PDF 1.7 spec, §7.3 (Objects).
 */

import { InvalidArgumentError, UnencodableTextError } from '../errors.js';
import { latin1Bytes, latin1String } from '../internal/latin1.js';
import { DEFAULT_LIMITS, type ResolvedLimits } from '../limits.js';
import { decodeTextString, encodeTextString, textStringEncoding } from './internal/textString.js';

// ---------------------------------------------------------------------------
// Byte writer interface
// ---------------------------------------------------------------------------

/**
 * Minimal interface consumed by every `serialize()` method.
 * Implementations may write to a growing `Uint8Array`, a `WritableStream`,
 * etc.
 */
export interface ByteWriter {
  /** Append raw bytes. */
  write(data: Uint8Array): void;
  /**
   * Append a PDF byte string: code units 0x00-0xFF, one byte each. The library's writers throw
   * UnencodableTextError (encoding `PDF byte string`) above 0xFF; a custom ByteWriter keeps its
   * own rule.
   */
  writeString(str: string): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** PDF white space (ISO 32000-2 Table 1): NUL, TAB, LF, FF, CR and SPACE. */
const PDF_WHITE_SPACE = /[\0\t\n\f\r ]/g;

/** Format a number for PDF output (no trailing zeros). */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(10);
  // Trim trailing zeros and optional decimal point manually
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 0x30 /* '0' */) end--;
  if (end > 0 && s.charCodeAt(end - 1) === 0x2e /* '.' */) end--;
  const trimmed = end === s.length ? s : s.slice(0, end);
  return trimmed === '-0' ? '0' : trimmed;
}

/** Escape bytes for a PDF literal string `(…)`. */
function escapeLiteralString(str: string): string {
  const parts: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 0x5c) parts.push('\\\\');
    else if (c === 0x28) parts.push('\\(');
    else if (c === 0x29) parts.push('\\)');
    else if (c === 0x0d) parts.push('\\r');
    else if (c === 0x0a) parts.push('\\n');
    else parts.push(str[i]!);
  }
  return parts.join('');
}

/** Convert bytes to hex pairs (delegates to Uint8Array.prototype.toHex). */
function bytesToHex(data: Uint8Array): string {
  return data.toHex();
}

// ---------------------------------------------------------------------------
// PdfNull
// ---------------------------------------------------------------------------

/** The PDF `null` object. */
export class PdfNull {
  static readonly instance: PdfNull = new PdfNull();

  /** @internal */
  readonly kind = 'null' as const;

  private constructor() {}

  /** Serialize as `null`. */
  serialize(writer: ByteWriter): void {
    writer.writeString('null');
  }
}

// ---------------------------------------------------------------------------
// PdfBool
// ---------------------------------------------------------------------------

/** A PDF boolean — `true` or `false`. */
export class PdfBool {
  static readonly TRUE: PdfBool = new PdfBool(true);
  static readonly FALSE: PdfBool = new PdfBool(false);

  /** @internal */
  readonly kind = 'bool' as const;

  private constructor(public readonly value: boolean) {}

  static of(value: boolean): PdfBool {
    return value ? PdfBool.TRUE : PdfBool.FALSE;
  }

  serialize(writer: ByteWriter): void {
    writer.writeString(this.value ? 'true' : 'false');
  }
}

// ---------------------------------------------------------------------------
// PdfNumber
// ---------------------------------------------------------------------------

/** A PDF numeric object (integer or real). */
export class PdfNumber {
  /** @internal */
  readonly kind = 'number' as const;

  constructor(public readonly value: number) {}

  static of(value: number): PdfNumber {
    return new PdfNumber(value);
  }

  serialize(writer: ByteWriter): void {
    writer.writeString(formatNumber(this.value));
  }
}

// ---------------------------------------------------------------------------
// PdfString
// ---------------------------------------------------------------------------

/** Encoding of a text string as read (ISO 32000-2 7.9.2.2). `"utf-16le"` is read only (pdf.js reads it). */
export type PdfTextEncoding = 'pdfdoc' | 'utf-16be' | 'utf-16le' | 'utf-8';

/** Encodings {@link PdfString.fromText} may write. `"auto"` never picks `"utf-8"` (the output is PDF 1.7). */
export type PdfTextWriteEncoding = 'auto' | 'pdfdoc' | 'utf-16be' | 'utf-8';

/** The written form of a PDF string: `"literal"` for `(…)`, `"hex"` for `<…>`. */
export type PdfStringForm = 'literal' | 'hex';

/** Builds a PdfString from a byte string without a check; bound in PdfString's static block. */
let makePdfString: (byteString: string, hex: boolean) => PdfString;

/** Builds an interned PdfName from its value without a check; bound in PdfName's static block. */
let makePdfName: (value: string) => PdfName;

/**
 * A PdfString of a byte string (one code unit per byte, 0x00-0xFF), unchecked: for the parser,
 * whose tokens are such byte strings, and for the copiers of loaded strings.
 *
 * @internal Exported from no package entry.
 */
export function pdfStringFromByteString(byteString: string, hex: boolean): PdfString {
  return makePdfString(byteString, hex);
}

/**
 * The interned PdfName of a value ("/" + the name bytes, one code unit per byte), unchecked: for
 * the parser and for PdfDict keys, so a name holding NUL (`/A#00B`) loads and saves.
 *
 * @internal Exported from no package entry.
 */
export function pdfNameFromByteString(value: string): PdfName {
  return makePdfName(value);
}

/**
 * A PDF string (ISO 32000-2 7.3.4): a sequence of bytes, plus the form it is written in,
 * literal `(…)` or hexadecimal `<…>`. Text is a view of the bytes ({@link toText}); the form
 * never changes the bytes.
 *
 * - {@link fromText} for a text string, {@link fromAscii} for an ASCII string,
 *   {@link fromBytes} and {@link fromHex} for a byte string.
 * - {@link toBytes} and {@link toText} read it.
 */
export class PdfString {
  /** @internal */
  readonly kind = 'string' as const;

  static {
    makePdfString = (byteString, hex) => new PdfString(byteString, hex);
  }

  private constructor(
    /** The bytes, one code unit per byte (0x00-0xFF). */
    private readonly byteString: string,
    /** The written form: `true` for `<…>`. Kept from the file on load; never guessed. */
    public readonly hex: boolean,
  ) {}

  /**
   * A text string (ISO 32000-2 7.9.2.2), in literal form. `"auto"` (the default) writes
   * PDFDocEncoding when every character is encodable there and the bytes do not begin with
   * FE FF, FF FE or EF BB BF, else UTF-16BE with FE FF.
   *
   * @throws {UnencodableTextError} For a lone surrogate or U+001B, or a character the requested
   *   encoding lacks (encoding `PDF text string`; `index` is its UTF-16 index in `text`).
   * @throws {InvalidArgumentError} For `"utf-16le"` (read only), an unknown encoding, or
   *   `"pdfdoc"` text whose bytes would begin with FE FF, FF FE or EF BB BF (argument `encoding`).
   */
  static fromText(text: string, encoding: PdfTextWriteEncoding = 'auto'): PdfString {
    return new PdfString(latin1String(encodeTextString(text, encoding)), false);
  }

  /**
   * An ASCII string (dates, /Registry, /Ordering, a percent-encoded /URI), in literal form.
   *
   * @throws {InvalidArgumentError} For a character above U+007F (argument `text`).
   */
  static fromAscii(text: string): PdfString {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0x7f) {
        throw new InvalidArgumentError(
          `An ASCII string holds only U+0000 to U+007F; found "${text.charAt(i)}" at index ${i}`,
          { argument: 'text' },
        );
      }
    }
    return new PdfString(text, false);
  }

  /**
   * A byte string; the bytes are copied.
   *
   * @throws {InvalidArgumentError} For a form other than `"literal"` or `"hex"` (argument `form`).
   */
  static fromBytes(bytes: Uint8Array, form: PdfStringForm = 'literal'): PdfString {
    if (form !== 'literal' && form !== 'hex') {
      throw new InvalidArgumentError(
        `Unknown PDF string form "${String(form)}"; write "literal" or "hex"`,
        { argument: 'form' },
      );
    }
    return new PdfString(latin1String(bytes), form === 'hex');
  }

  /**
   * A byte string from hex digits, in hex form: white space is ignored and an odd count is
   * padded with 0 (ISO 32000-2 7.3.4.3).
   *
   * @throws {InvalidArgumentError} For any other character (argument `hexDigits`).
   */
  static fromHex(digits: string): PdfString {
    const compact = digits.replace(PDF_WHITE_SPACE, '');
    if (!/^[\da-fA-F]*$/.test(compact)) {
      throw new InvalidArgumentError(
        'Hex digits hold only 0-9, A-F, a-f and white space; for text use PdfString.fromText',
        { argument: 'hexDigits' },
      );
    }
    const even = compact.length % 2 === 0 ? compact : `${compact}0`;
    return new PdfString(latin1String(Uint8Array.fromHex(even)), true);
  }

  /** The unsigned byte order of the two byte sequences, as name-tree keys sort (7.9.6). */
  static compare(a: PdfString, b: PdfString): number {
    // Code units 0x00-0xFF compare as the unsigned bytes they stand for.
    return a.byteString < b.byteString ? -1 : a.byteString > b.byteString ? 1 : 0;
  }

  /**
   * A byte string, one byte per code unit, in literal form.
   *
   * @deprecated Since 0.41.0, removed in 0.50.0. Use {@link fromText} for text or
   *   {@link fromBytes} for bytes.
   * @throws {UnencodableTextError} For the first code unit above 0xFF (encoding
   *   `PDF byte string`; `index` is its index in `byteString`).
   */
  static literal(byteString: string): PdfString {
    latin1Bytes(byteString); // throws at the first code unit above 0xFF
    return new PdfString(byteString, false);
  }

  /**
   * Same as {@link fromHex}.
   *
   * @deprecated Since 0.41.0, removed in 0.50.0. Use {@link fromHex}.
   */
  static hex(hexDigits: string): PdfString {
    return PdfString.fromHex(hexDigits);
  }

  /**
   * Same as `fromBytes(bytes, "hex")`.
   *
   * @deprecated Since 0.41.0, removed in 0.50.0. Use {@link fromBytes} with `"hex"`.
   */
  static hexFromBytes(bytes: Uint8Array): PdfString {
    return PdfString.fromBytes(bytes, 'hex');
  }

  /** The number of bytes. */
  get byteLength(): number {
    return this.byteString.length;
  }

  /** A new array holding the bytes; changing it leaves the string unchanged. */
  toBytes(): Uint8Array<ArrayBuffer> {
    return latin1Bytes(this.byteString);
  }

  /** The encoding the bytes name: FE FF utf-16be, FF FE utf-16le, EF BB BF utf-8, else pdfdoc. */
  get textEncoding(): PdfTextEncoding {
    return textStringEncoding(this.toBytes());
  }

  /**
   * The bytes decoded as a text string (ISO 32000-2 7.9.2.2). After a byte order mark the
   * decoder never switches encoding; an odd trailing byte of a UTF-16 string is dropped; an
   * ill-formed sequence decodes to U+FFFD; language escapes (U+001B … U+001B) are removed.
   */
  toText(): string {
    return decodeTextString(this.toBytes());
  }

  /** True when both hold the same bytes; the form is not compared. */
  equals(other: PdfString): boolean {
    return this.byteString === other.byteString;
  }

  /**
   * The bytes, one code unit per byte: what 0.40.x returned for every loaded string.
   *
   * @deprecated Since 0.41.0, removed in 0.50.0. Use {@link toText} for text or
   *   {@link toBytes} for bytes.
   */
  get value(): string {
    return this.byteString;
  }

  /** Writes `(…)` with `\\`, `\(`, `\)`, `\r` and `\n` escaped, or `<…>` in lower-case hex. */
  serialize(writer: ByteWriter): void {
    if (this.hex) {
      writer.writeString(`<${bytesToHex(this.toBytes())}>`);
    } else {
      // write(), not writeString(): a custom ByteWriter may encode writeString differently.
      writer.write(latin1Bytes(`(${escapeLiteralString(this.byteString)})`));
    }
  }
}

// ---------------------------------------------------------------------------
// PdfName
// ---------------------------------------------------------------------------

/**
 * True for the bytes a name holds as is: 0x21-0x7E but `#` and the delimiters
 * `( ) < > [ ] { } / %` (ISO 32000-2 7.3.5).
 */
const NAME_REGULAR: Uint8Array = /* @__PURE__ */ (() => {
  const regular = new Uint8Array(256);
  regular.fill(1, 0x21, 0x7f);
  for (const c of '#()<>[]{}/%') regular[c.charCodeAt(0)] = 0;
  return regular;
})();

/**
 * A PDF name object (ISO 32000-2 7.3.5), such as `/Type`: a sequence of bytes other than NUL,
 * written with `#xx` escapes. Names are interned: one object per name.
 */
export class PdfName {
  /** @internal */
  readonly kind = 'name' as const;

  /** One object per value. */
  private static readonly cache = new Map<string, PdfName>();

  static {
    makePdfName = (value) => {
      let cached = PdfName.cache.get(value);
      if (cached === undefined) {
        cached = new PdfName(value);
        PdfName.cache.set(value, cached);
      }
      return cached;
    };
  }

  private constructor(
    /** "/" + the name bytes, one code unit per byte, # escapes resolved: the PdfDict key form. */
    public readonly value: string,
  ) {}

  /**
   * The name of a byte string (one code unit per byte), the leading "/" optional.
   *
   * @throws {InvalidArgumentError} For NUL or a code unit above 0xFF (argument `name`).
   */
  static of(name: string): PdfName {
    const value = name.startsWith('/') ? name : `/${name}`;
    for (let i = 1; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit === 0 || unit > 0xff) {
        throw new InvalidArgumentError(
          `A PDF name holds bytes 0x01-0xFF, one code unit each; found U+${unit.toString(16).toUpperCase().padStart(4, '0')} in "${name}". For text, use PdfName.fromBytes(new TextEncoder().encode(text))`,
          { argument: 'name' },
        );
      }
    }
    return makePdfName(value);
  }

  /**
   * The name of the bytes, without the leading "/".
   *
   * @throws {InvalidArgumentError} For a NUL byte (argument `bytes`).
   */
  static fromBytes(bytes: Uint8Array): PdfName {
    if (bytes.includes(0)) {
      throw new InvalidArgumentError('A PDF name cannot hold the byte 0x00', {
        argument: 'bytes',
      });
    }
    return makePdfName(`/${latin1String(bytes)}`);
  }

  /** A new array holding the name bytes, without the leading "/". */
  toBytes(): Uint8Array<ArrayBuffer> {
    return latin1Bytes(this.value.slice(1));
  }

  /** The name bytes decoded as UTF-8, U+FFFD for a malformed sequence. */
  toText(): string {
    return new TextDecoder().decode(this.toBytes());
  }

  /**
   * Writes "/" and then each byte as is when it is 0x21-0x7E and not one of
   * `# ( ) < > [ ] { } / %`, else as `#xx` in lower case (the form qpdf 12.4.2 writes); NUL is
   * written `#00`.
   *
   * @throws {UnencodableTextError} For a code unit above 0xFF, which only a PdfDict key set from
   *   code can hold (encoding `PDF byte string`; `index` is its index in {@link value}).
   */
  serialize(writer: ByteWriter): void {
    let out = '/';
    for (let i = 1; i < this.value.length; i++) {
      const unit = this.value.charCodeAt(i);
      if (unit > 0xff) {
        throw new UnencodableTextError({
          // codePointAt is defined at an index inside value; `?? unit` only narrows its type.
          character: String.fromCodePoint(this.value.codePointAt(i) ?? unit),
          index: i,
          fontName: undefined,
          encoding: 'PDF byte string',
        });
      }
      out +=
        NAME_REGULAR[unit] === 1 ? this.value.charAt(i) : `#${unit.toString(16).padStart(2, '0')}`;
    }
    writer.writeString(out);
  }
}

// ---------------------------------------------------------------------------
// PdfArray
// ---------------------------------------------------------------------------

/** A PDF array `[…]`. */
export class PdfArray {
  /** @internal */
  readonly kind = 'array' as const;

  constructor(public readonly items: PdfObject[] = []) {}

  static of(items: PdfObject[]): PdfArray {
    return new PdfArray([...items]);
  }

  /** Convenience: create an array of PdfNumbers. */
  static fromNumbers(values: number[]): PdfArray {
    return new PdfArray(values.map((v) => PdfNumber.of(v)));
  }

  /** Add an item. */
  push(item: PdfObject): void {
    this.items.push(item);
  }

  /** Number of items. */
  get length(): number {
    return this.items.length;
  }

  serialize(writer: ByteWriter): void {
    writer.writeString('[');
    for (let i = 0; i < this.items.length; i++) {
      if (i > 0) writer.writeString(' ');
      this.items[i]!.serialize(writer);
    }
    writer.writeString(']');
  }
}

// ---------------------------------------------------------------------------
// PdfDict
// ---------------------------------------------------------------------------

/** A PDF dictionary `<< … >>`. */
export class PdfDict {
  /** @internal */
  readonly kind = 'dict' as const;

  private readonly entries = new Map<string, PdfObject>();

  constructor(entries?: Iterable<readonly [string, PdfObject]>) {
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  /**
   * Set a key-value pair.  Keys are always stored / looked up *with*
   * the leading `/`.
   */
  set(key: string, value: PdfObject): this {
    const normalizedKey = key.startsWith('/') ? key : `/${key}`;
    this.entries.set(normalizedKey, value);
    return this;
  }

  /** Get a value by key. */
  get(key: string): PdfObject | undefined {
    const normalizedKey = key.startsWith('/') ? key : `/${key}`;
    return this.entries.get(normalizedKey);
  }

  /** Check if a key exists. */
  has(key: string): boolean {
    const normalizedKey = key.startsWith('/') ? key : `/${key}`;
    return this.entries.has(normalizedKey);
  }

  /** Delete a key. */
  delete(key: string): boolean {
    const normalizedKey = key.startsWith('/') ? key : `/${key}`;
    return this.entries.delete(normalizedKey);
  }

  /** Number of entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Iterate over entries as `[key, value]` pairs. */
  [Symbol.iterator](): IterableIterator<[string, PdfObject]> {
    return this.entries[Symbol.iterator]();
  }

  serialize(writer: ByteWriter): void {
    writer.writeString('<<');
    for (const [key, value] of this.entries) {
      writer.writeString('\n');
      pdfNameFromByteString(key).serialize(writer);
      writer.writeString(' ');
      value.serialize(writer);
    }
    writer.writeString('\n>>');
  }
}

// ---------------------------------------------------------------------------
// PdfStream
// ---------------------------------------------------------------------------

/**
 * A PDF stream object — a dictionary followed by `stream … endstream`.
 *
 * The `data` field holds the (possibly compressed) payload.  The caller
 * is responsible for setting `/Length` in the dict before serialization.
 */
export class PdfStream {
  /** @internal */
  readonly kind = 'stream' as const;

  constructor(
    /** Stream metadata dictionary. */
    public readonly dict: PdfDict,
    /** Raw stream data (already encoded / compressed). */
    public data: Uint8Array,
  ) {}

  /**
   * Create a stream from a PDF byte string (e.g. content-stream operators):
   * each code unit U+0000 to U+00FF is one byte.  Sets `/Length`
   * automatically.
   *
   * @throws {UnencodableTextError} For a code unit above U+00FF (encoding
   *   `PDF byte string`).
   */
  static fromString(content: string, extraEntries?: PdfDict): PdfStream {
    const data = latin1Bytes(content);
    const dict = extraEntries ?? new PdfDict();
    dict.set('/Length', PdfNumber.of(data.length));
    return new PdfStream(dict, data);
  }

  /**
   * Create a stream from raw bytes.  Sets `/Length` automatically.
   */
  static fromBytes(data: Uint8Array, extraEntries?: PdfDict): PdfStream {
    const dict = extraEntries ?? new PdfDict();
    dict.set('/Length', PdfNumber.of(data.length));
    return new PdfStream(dict, data);
  }

  /** Update `/Length` to reflect the current data size. */
  syncLength(): void {
    this.dict.set('/Length', PdfNumber.of(this.data.length));
  }

  serialize(writer: ByteWriter): void {
    // Ensure length is correct
    this.syncLength();

    this.dict.serialize(writer);
    writer.writeString('\nstream\n');
    writer.write(this.data);
    writer.writeString('\nendstream');
  }
}

// ---------------------------------------------------------------------------
// PdfRef — indirect reference
// ---------------------------------------------------------------------------

/** An indirect reference `N G R`. */
export class PdfRef {
  /** @internal */
  readonly kind = 'ref' as const;

  constructor(
    /** Object number (≥ 1). */
    public readonly objectNumber: number,
    /** Generation number (usually 0). */
    public readonly generationNumber: number = 0,
  ) {}

  static of(objectNumber: number, generationNumber: number = 0): PdfRef {
    return new PdfRef(objectNumber, generationNumber);
  }

  /** The string form used inside PDF bodies: `N G R`. */
  serialize(writer: ByteWriter): void {
    writer.writeString(`${this.objectNumber} ${this.generationNumber} R`);
  }

  /** Return the `N G obj` header for an indirect-object definition. */
  toObjectHeader(): string {
    return `${this.objectNumber} ${this.generationNumber} obj`;
  }

  /** Return `endobj`. */
  toObjectFooter(): string {
    return 'endobj';
  }

  toString(): string {
    return `${this.objectNumber} ${this.generationNumber} R`;
  }
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

/**
 * Union of all PDF object types.  Every member has a `serialize()` method
 * and a discriminating `kind` literal.
 */
export type PdfObject =
  | PdfNull
  | PdfBool
  | PdfNumber
  | PdfString
  | PdfName
  | PdfArray
  | PdfDict
  | PdfStream
  | PdfRef;

// ---------------------------------------------------------------------------
// Object registry
// ---------------------------------------------------------------------------

/** Entry stored in the registry. */
export interface RegistryEntry {
  /** Indirect reference (object number + generation). */
  readonly ref: PdfRef;
  /** The object itself. */
  object: PdfObject;
}

/**
 * Allocates monotonically increasing object numbers and stores the
 * mapping from `PdfRef` → object value.
 */
export class PdfObjectRegistry {
  private nextObjectNumber = 1;
  private readonly entries: RegistryEntry[] = [];
  private readonly refMap = new Map<number, RegistryEntry>();

  /**
   * @param limits - The limits of the document that owns this registry, from
   *   the `limits` option of `loadPdf` or `createPdf`. The calls that decode or
   *   walk the document's objects (getContentStream, interpretPage, image and
   *   font extraction, embedPage of one of its pages into another document)
   *   run under them. The defaults when left out. The value is not checked;
   *   set limits through the `limits` option of `loadPdf` or `createPdf`.
   */
  constructor(readonly limits: ResolvedLimits = DEFAULT_LIMITS) {}

  /**
   * Register a new object, allocate an object number, and return its
   * indirect reference.
   */
  register(object: PdfObject): PdfRef {
    const ref = PdfRef.of(this.nextObjectNumber++);
    const entry: RegistryEntry = { ref, object };
    this.entries.push(entry);
    this.refMap.set(ref.objectNumber, entry);
    return ref;
  }

  /**
   * Register a pre-built `PdfRef` with an object.
   * Useful when the ref must be known before the object is fully built
   * (e.g. the catalog references the page tree, and vice-versa).
   */
  registerWithRef(ref: PdfRef, object: PdfObject): void {
    // Advance the counter past this number if necessary
    if (ref.objectNumber >= this.nextObjectNumber) {
      this.nextObjectNumber = ref.objectNumber + 1;
    }
    const entry: RegistryEntry = { ref, object };
    this.entries.push(entry);
    this.refMap.set(ref.objectNumber, entry);
  }

  /**
   * Pre-allocate an object number and return the reference.
   * Call {@link assign} later to attach the actual object.
   */
  allocate(): PdfRef {
    return PdfRef.of(this.nextObjectNumber++);
  }

  /**
   * Assign an object to a previously allocated (or registered) reference.
   */
  assign(ref: PdfRef, object: PdfObject): void {
    const existing = this.refMap.get(ref.objectNumber);
    if (existing) {
      existing.object = object;
    } else {
      const entry: RegistryEntry = { ref, object };
      this.entries.push(entry);
      this.refMap.set(ref.objectNumber, entry);
    }
  }

  /** Look up the object for a given reference. */
  resolve(ref: PdfRef): PdfObject | undefined {
    return this.refMap.get(ref.objectNumber)?.object;
  }

  /** Iterate all entries in allocation order. */
  [Symbol.iterator](): IterableIterator<RegistryEntry> {
    return this.entries[Symbol.iterator]();
  }

  /** Total number of registered objects (≥ 1 in a valid PDF because of
   * the free entry at object 0). */
  get size(): number {
    return this.entries.length;
  }

  /** The next object number that *would* be assigned. */
  get nextNumber(): number {
    return this.nextObjectNumber;
  }

  /**
   * Remove all registry entries that are not reachable from the given
   * root references.  This is used after rebuilding the document
   * structure so that orphaned objects from the original (loaded) PDF
   * don't bloat the output.
   *
   * The walk follows every `PdfRef` found inside `PdfDict`, `PdfArray`,
   * and `PdfStream` objects, handling cycles via a visited set.
   */
  filterReachable(rootRefs: PdfRef[]): void {
    const reachable = new Set<number>();

    const visit = (obj: PdfObject | undefined): void => {
      if (obj === undefined) return;

      if (obj instanceof PdfRef) {
        if (reachable.has(obj.objectNumber)) return; // cycle guard
        reachable.add(obj.objectNumber);
        // Resolve the ref and walk its contents
        const resolved = this.refMap.get(obj.objectNumber)?.object;
        if (resolved) visit(resolved);
        return;
      }

      if (obj instanceof PdfDict) {
        for (const [, value] of obj) {
          visit(value);
        }
        return;
      }

      if (obj instanceof PdfArray) {
        for (const item of obj.items) {
          visit(item);
        }
        return;
      }

      if (obj instanceof PdfStream) {
        // Walk the stream's dictionary entries
        visit(obj.dict);
        return;
      }

      // PdfNull, PdfBool, PdfNumber, PdfString, PdfName — leaf types, nothing to follow
    };

    // Start the walk from each root ref
    for (const rootRef of rootRefs) {
      visit(rootRef);
    }

    // Filter the entries array and refMap to only keep reachable objects
    const keptEntries: RegistryEntry[] = [];
    for (const entry of this.entries) {
      if (reachable.has(entry.ref.objectNumber)) {
        keptEntries.push(entry);
      } else {
        this.refMap.delete(entry.ref.objectNumber);
      }
    }
    this.entries.length = 0;
    for (const entry of keptEntries) {
      this.entries.push(entry);
    }
  }
}

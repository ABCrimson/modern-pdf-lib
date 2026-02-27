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
  /** Append an ASCII / Latin-1 string — callers guarantee all chars < 0x100. */
  writeString(str: string): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Format a number for PDF output (no trailing zeros). */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(10).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Escape bytes for a PDF literal string `(…)`. */
function escapeLiteralString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
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
  static readonly instance = new PdfNull();

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
  static readonly TRUE = new PdfBool(true);
  static readonly FALSE = new PdfBool(false);

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

/**
 * A PDF string — either literal `(…)` or hexadecimal `<…>`.
 *
 * By default the constructor produces a literal string.  Use the static
 * helpers for explicit control.
 */
export class PdfString {
  /** @internal */
  readonly kind = 'string' as const;

  private constructor(
    /** The raw string content (unescaped). */
    public readonly value: string,
    /** When `true` the string is serialized in hexadecimal form `<…>`. */
    public readonly hex: boolean,
  ) {}

  /** Create a literal string `(…)`. */
  static literal(value: string): PdfString {
    return new PdfString(value, false);
  }

  /** Create a hexadecimal string `<…>` from a plain string. */
  static hex(value: string): PdfString {
    return new PdfString(value, true);
  }

  /** Create a hexadecimal string from raw bytes. */
  static hexFromBytes(data: Uint8Array): PdfString {
    return new PdfString(bytesToHex(data), true);
  }

  serialize(writer: ByteWriter): void {
    if (this.hex) {
      // If value is already hex digits (from hexFromBytes), use directly;
      // otherwise encode the string bytes to hex.
      if (/^[\da-fA-F]*$/.test(this.value)) {
        writer.writeString(`<${this.value}>`);
      } else {
        const bytes = encoder.encode(this.value);
        writer.writeString(`<${bytesToHex(bytes)}>`);
      }
    } else {
      writer.writeString(`(${escapeLiteralString(this.value)})`);
    }
  }
}

// ---------------------------------------------------------------------------
// PdfName
// ---------------------------------------------------------------------------

/**
 * A PDF name object — e.g. `/Type`, `/Page`.
 *
 * The leading `/` is stored and serialized.  Characters outside the
 * printable ASCII range (33–126) and `#` are encoded as `#XX`.
 */
export class PdfName {
  /** @internal */
  readonly kind = 'name' as const;

  /** Cache for frequently used names. */
  private static readonly cache = new Map<string, PdfName>();

  private constructor(
    /** The name value *including* the leading `/`. */
    public readonly value: string,
  ) {}

  /** Create or retrieve a cached `PdfName`. */
  static of(name: string): PdfName {
    // Ensure the leading slash
    const normalized = name.startsWith('/') ? name : `/${name}`;
    let cached = PdfName.cache.get(normalized);
    if (!cached) {
      cached = new PdfName(normalized);
      PdfName.cache.set(normalized, cached);
    }
    return cached;
  }

  serialize(writer: ByteWriter): void {
    // Encode the name: the leading '/' is literal, then each character
    // is either passed through (printable ASCII except '#') or encoded.
    let encoded = '/';
    for (let i = 1; i < this.value.length; i++) {
      const code = this.value.charCodeAt(i);
      if (code !== undefined && code >= 33 && code <= 126 && code !== 0x23 /* # */) {
        encoded += this.value.at(i);
      } else {
        encoded += '#' + (code ?? 0).toString(16).padStart(2, '0');
      }
    }
    writer.writeString(encoded);
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
      PdfName.of(key).serialize(writer);
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
   * Create a stream from a plain UTF-8 string (e.g. content-stream
   * operators).  Sets `/Length` automatically.
   */
  static fromString(content: string, extraEntries?: PdfDict): PdfStream {
    const data = encoder.encode(content);
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

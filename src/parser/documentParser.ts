/**
 * @module parser/documentParser
 *
 * High-level PDF document parser that reads raw bytes and produces a
 * fully populated {@link PdfDocument}.
 *
 * Pipeline:
 * 1. Validate PDF header (%PDF-1.x or %PDF-2.0)
 * 2. Parse cross-reference table (via {@link XrefParser})
 * 3. Build lazy object resolver with caching
 * 4. Resolve catalog -> page tree -> individual pages
 * 5. Extract metadata from /Info dictionary
 * 6. Construct and return a PdfDocument
 *
 * Reference: PDF 1.7 spec, SS7.5 (File Structure),
 *            SS7.7 (Document Structure).
 *
 * @packageDocumentation
 */

import type { PdfObject } from '../core/pdfObjects.js';
import {
  PdfRef,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfStream,
  PdfString,
  PdfNull,
  PdfObjectRegistry,
} from '../core/pdfObjects.js';
import { PdfDocument } from '../core/pdfDocument.js';
import {
  markDecryptedFromEncryptedFile,
  markLoadedFromEncryptedFile,
  recordDecryptedContent,
  recordDecryptedObject,
} from '../core/flateStream.js';
import { PdfPage } from '../core/pdfPage.js';
import { PdfLexer } from './internal/lexer.js';
import { PdfObjectParser } from './internal/objectParser.js';
import { XrefParser } from './internal/xrefParser.js';
import type { XrefEntry, ParsedTrailer } from './internal/xrefParser.js';
import { decodeFlateOnly } from '../codecs/streamDecode.js';
import { base64Decode } from '../utils/base64.js';
import {
  PdfEncryptionHandler,
  decryptStreamBytes,
  decryptStringBytes,
  embeddedFileFilterName,
} from '../crypto/encryptionHandler.js';
import { contentsLeftAsStored } from '../crypto/signatureContents.js';
import { PdfParseError } from './parseError.js';
import { ResourceLimitError, UnsupportedEncryptionError } from '../errors.js';
import { assertWithinLimit } from '../internal/limits.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Options for loading a PDF document from bytes.
 */
export interface LoadPdfOptions {
  /** Password for encrypted PDFs (Phase 5). */
  password?: string;
  /** When true, skip decryption even if the PDF is encrypted. */
  ignoreEncryption?: boolean;
  /**
   * When true, update the /ModDate in the /Info dictionary to the
   * current time when saving. Defaults to true.
   */
  updateMetadata?: boolean;
  /**
   * Number of objects to process per event-loop tick during parsing.
   * Lower values keep the main thread more responsive in browsers.
   * Defaults to `Infinity` (no throttling).
   */
  objectsPerTick?: number;
  /**
   * When `true`, throw an error if a malformed or invalid PDF object
   * is encountered during parsing. When `false` (default), malformed
   * objects are silently skipped.
   */
  throwOnInvalidObject?: boolean | undefined;
  /**
   * When `true`, clamp extreme floating-point values (very large or
   * very small numbers) to safe ranges during parsing. This prevents
   * numeric overflows from producing garbage output.
   *
   * Default: `false`.
   */
  capNumbers?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Internal: text decoder for header parsing
// ---------------------------------------------------------------------------

const TEXT_DECODER = new TextDecoder('latin1');

// ---------------------------------------------------------------------------
// Internal: page tree node types
// ---------------------------------------------------------------------------

/**
 * Inherited attributes that flow down from /Pages nodes to /Page leaves.
 * Per PDF spec SS7.7.3.4, these attributes are inheritable.
 */
interface InheritedPageAttrs {
  mediaBox?: PdfArray;
  cropBox?: PdfArray;
  resources?: PdfObject;
  rotate?: number;
}

/**
 * A flattened page entry extracted from the page tree traversal.
 */
interface FlattenedPage {
  /** The resolved /Page dictionary. */
  dict: PdfDict;
  /** The effective /MediaBox (inherited or local). */
  mediaBox: PdfArray;
  /** The effective /Resources (inherited or local). */
  resources?: PdfObject | undefined;
  /** The effective /Rotate value (inherited or local). */
  rotate: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract a numeric value from a PdfObject.
 */
function numVal(obj: PdfObject | undefined): number | undefined {
  if (obj !== undefined && obj.kind === 'number') {
    return (obj as PdfNumber).value;
  }
  return undefined;
}

/** Bytes as a string of one code unit per byte (the form the lexer gives string values). */
function latin1String(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return out;
}

/** How many strings of one object the decryption pass decrypts at a time. */
const STRINGS_AT_ONCE = 4096;

/** Whether `obj` is a stream with `/Type /Metadata`. */
function isMetadataStream(obj: PdfObject): boolean {
  if (obj.kind !== 'stream') return false;
  const type = (obj as PdfStream).dict.get('/Type');
  return type?.kind === 'name' && (type as PdfName).value === '/Metadata';
}

/**
 * Remove a leading `/Crypt` entry from a stream's `/Filter` (and its `/DecodeParms` entry) and
 * return the crypt filter name it selects: its decode parameters' `/Name`, else `/Identity`
 * (ISO 32000-2, 7.4.10). Returns undefined when the stream has no `/Crypt` filter.
 */
function takeCryptFilter(dict: PdfDict): string | undefined {
  const filter = dict.get('/Filter');
  const parms = dict.get('/DecodeParms');
  const isCrypt = (f: PdfObject | undefined): boolean =>
    f?.kind === 'name' && (f as PdfName).value === '/Crypt';
  let cryptParms: PdfObject | undefined;
  if (isCrypt(filter)) {
    cryptParms = parms?.kind === 'array' ? (parms as PdfArray).items[0] : parms;
    dict.delete('/Filter');
    dict.delete('/DecodeParms');
  } else if (filter?.kind === 'array' && isCrypt((filter as PdfArray).items[0])) {
    const filters = (filter as PdfArray).items;
    filters.shift();
    if (parms?.kind === 'array') cryptParms = (parms as PdfArray).items.shift();
    if (filters.length === 0) {
      dict.delete('/Filter');
      dict.delete('/DecodeParms');
    }
  } else {
    return undefined;
  }
  const name = cryptParms?.kind === 'dict' ? (cryptParms as PdfDict).get('/Name') : undefined;
  return name?.kind === 'name' ? (name as PdfName).value : '/Identity';
}

// ---------------------------------------------------------------------------
// PdfDocumentParser
// ---------------------------------------------------------------------------

/**
 * Parse a PDF file from raw bytes into a structured representation.
 *
 * This parser handles the complete PDF file structure:
 * - File header validation
 * - Cross-reference table/stream parsing
 * - Lazy indirect object resolution with caching
 * - Object stream (ObjStm) decompression for compressed objects
 * - Catalog and page tree traversal
 * - Metadata extraction
 *
 * @example
 * ```ts
 * const parser = new PdfDocumentParser(pdfBytes);
 * const doc = await parser.parse();
 * console.log(`Pages: ${doc.getPageCount()}`);
 * ```
 */
export class PdfDocumentParser {
  /** The raw PDF file bytes. */
  private readonly data: Uint8Array;

  /** PDF version string extracted from the header (e.g. "1.7", "2.0"). */
  private pdfVersion: string = '';

  /** The lexer for tokenizing the PDF data. */
  private lexer!: PdfLexer;

  /** The low-level object parser. */
  private objectParser!: PdfObjectParser;

  /** The cross-reference parser. */
  private xrefParser!: XrefParser;

  /** Parsed xref entries, keyed by object number. */
  private xrefEntries: Map<number, XrefEntry> = new Map();

  /** The parsed trailer dictionary fields. */
  private trailer!: ParsedTrailer;

  /** Cache for resolved indirect objects. Keyed by object number. */
  private readonly objectCache = new Map<number, PdfObject>();

  /**
   * Cache for decompressed object streams.
   * Keyed by the container object number, value is a map of
   * index-in-stream -> parsed object.
   */
  private readonly objStreamCache = new Map<number, Map<number, PdfObject>>();

  /** Flattened page dictionaries from the page tree. */
  private flattenedPages: FlattenedPage[] = [];

  /** The object registry populated during parsing. */
  private readonly registry = new PdfObjectRegistry();

  /** Encryption handler for decrypting objects (set if the PDF is encrypted). */
  private encryptionHandler?: PdfEncryptionHandler | undefined;

  /** Object number of the /Encrypt dictionary (excluded from decryption). */
  private encryptDictObjNum?: number | undefined;

  /** Numbers of the in-use objects the decryption pass has decrypted. */
  private readonly decryptedObjects = new Set<number>();

  /** When true, throw on malformed objects instead of silently skipping. */
  private throwOnInvalidObject = false;

  /** When true, clamp extreme numbers to single-precision float range. */
  private capNumbers = false;

  /** Numbers of the objects whose parse is in progress (see {@link resolveLengthRef}). */
  private readonly inProgress = new Set<number>();

  /**
   * Create a new PdfDocumentParser.
   *
   * @param data  The raw PDF file bytes as a Uint8Array.
   */
  constructor(data: Uint8Array) {
    if (data.length < 8) {
      throw new PdfParseError({
        message: 'Invalid PDF: file is too short to contain a valid PDF header.',
        offset: 0,
        expected: 'at least 8 bytes for a valid PDF header',
        actual: `${data.length} bytes`,
        data,
      });
    }
    this.data = data;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Parse the PDF file and return a fully populated PdfDocument.
   *
   * @param options  Optional loading options.
   * @returns        A PdfDocument representing the parsed file.
   * @throws         If the PDF is malformed or cannot be parsed.
   */
  async parse(options?: LoadPdfOptions): Promise<PdfDocument> {
    // Store load options for use in downstream methods
    this.throwOnInvalidObject = options?.throwOnInvalidObject === true;
    this.capNumbers = options?.capNumbers === true;

    // Step 1: Validate PDF header
    this.validateHeader();

    // Step 2: Initialize lexer and object parser
    this.lexer = new PdfLexer(this.data);
    if (this.capNumbers) {
      this.lexer.capNumbers = true;
    }
    this.objectParser = new PdfObjectParser(this.lexer, this.registry, {
      recover: !this.throwOnInvalidObject,
    });
    this.xrefParser = new XrefParser(this.data, this.objectParser);

    // Step 3: Parse the cross-reference structure
    const xrefResult = await this.xrefParser.parseXref();
    this.xrefEntries = xrefResult.entries;
    this.trailer = xrefResult.trailer;
    // From here on an indirect stream /Length resolves through the document, in any order.
    this.objectParser.resolveLength = (ref) => this.resolveLengthRef(ref);

    // Step 4: Encryption. An indirect /Encrypt is decrypted: the handler is set up and every
    // object is decrypted once, before anything is read from the document, and the registry is
    // marked as decrypted from an encrypted file (its save refuses until encrypt() is called).
    // An /Encrypt that is not an indirect reference of the trailer (a direct dictionary, or a
    // trailer rebuilt by the recovery scan) cannot be decrypted and is refused. With
    // ignoreEncryption the objects stay as stored, and the registry is marked as loaded from an
    // encrypted file, so the writers copy its /FlateDecode data as loaded.
    const hasEncrypt = this.trailer.encryptRef !== undefined || this.trailer.hasEncrypt === true;
    if (hasEncrypt && options?.ignoreEncryption === true) {
      markLoadedFromEncryptedFile(this.registry);
    } else if (this.trailer.encryptRef !== undefined) {
      const handler = await this.setupDecryption(options?.password);
      await this.decryptEveryObject(handler, options);
      markDecryptedFromEncryptedFile(this.registry);
    } else if (hasEncrypt) {
      throw new UnsupportedEncryptionError(
        'This PDF has an /Encrypt entry that is not an indirect reference in the trailer of its ' +
          'cross-reference section (a direct dictionary, or a trailer rebuilt by the recovery ' +
          'scan), so it cannot be decrypted. Pass ignoreEncryption: true to load its objects ' +
          'as stored.',
      );
    }

    // Step 5: Resolve the catalog and page tree
    const catalogDict = this.resolveCatalog();
    this.flattenedPages = this.resolvePageTree(catalogDict);

    // Step 6: Build the PdfDocument
    const doc = await this.buildDocument(options);

    return doc;
  }

  /**
   * Resolve an indirect reference to its underlying object.
   *
   * If the reference points to a compressed object (stored in an object
   * stream), the containing stream is decompressed and all objects within
   * it are cached.
   *
   * Results are cached so repeated lookups are O(1).
   *
   * @param ref  The indirect reference to resolve.
   * @returns    The resolved PDF object, or PdfNull if not found.
   */
  resolveRef(ref: PdfRef): PdfObject {
    const objNum = ref.objectNumber;

    // Check cache first
    const cached = this.objectCache.get(objNum);
    if (cached !== undefined) {
      return cached;
    }

    // Look up the xref entry
    const entry = this.xrefEntries.get(objNum);
    if (entry === undefined || entry.type === 'free') {
      return PdfNull.instance;
    }

    let resolved: PdfObject;

    this.inProgress.add(objNum);
    try {
      if (entry.type === 'compressed') {
        // Object is inside an object stream
        resolved = this.resolveCompressedObject(entry);
      } else {
        // Standard in-use object -- parse at the byte offset
        try {
          const { object } = this.objectParser.parseIndirectObjectAt(entry.offset);
          resolved = object;
        } catch (err) {
          if (err instanceof ResourceLimitError) throw err;
          throw new PdfParseError({
            message:
              `Failed to parse indirect object ${objNum} ${entry.generationNumber} at ` +
              `offset ${entry.offset}`,
            offset: entry.offset,
            expected: `valid indirect object ${objNum} ${entry.generationNumber}`,
            actual: 'parse failure',
            data: this.data,
            cause: err instanceof Error ? err : undefined,
          });
        }
      }
    } finally {
      this.inProgress.delete(objNum);
    }

    // Cache the result
    this.objectCache.set(objNum, resolved);
    return resolved;
  }

  /**
   * Resolve the target of an indirect stream `/Length` for the object parser.
   *
   * An object whose parse is in progress, and a compressed object whose
   * object stream is being parsed, give `undefined`: their value cannot be
   * known before the stream they are the length of has been framed.
   */
  private resolveLengthRef(ref: PdfRef): PdfObject | undefined {
    const objNum = ref.objectNumber;
    if (this.inProgress.has(objNum)) return undefined;
    const entry = this.xrefEntries.get(objNum);
    if (
      entry?.type === 'compressed' &&
      (this.inProgress.has(entry.containerObjectNumber ?? -1) ||
        !this.containerReadable(entry.containerObjectNumber ?? -1))
    ) {
      return undefined;
    }
    return this.resolveRef(ref);
  }

  /**
   * Resolve a PdfObject that may be an indirect reference.
   * If it is a PdfRef, resolve it; otherwise return as-is.
   */
  private resolveObject(obj: PdfObject): PdfObject {
    if (obj.kind === 'ref') {
      return this.resolveRef(obj as PdfRef);
    }
    return obj;
  }

  // -----------------------------------------------------------------------
  // Internal: encryption setup and decryption
  // -----------------------------------------------------------------------

  /**
   * Set up the encryption handler by resolving the /Encrypt dictionary
   * and authenticating with the provided password (or empty password).
   *
   * @param password  Optional user/owner password.
   * @throws {UnsupportedEncryptionError} When the handler or a crypt filter is not supported
   *         (before any password is tried).
   * @throws {ResourceLimitError} When an internal limit is exceeded.
   * @throws          PdfParseError when no password opens the file.
   * @returns         The handler, also kept as the parser's encryption handler.
   */
  private async setupDecryption(password?: string): Promise<PdfEncryptionHandler> {
    const encryptRef = this.trailer.encryptRef!;
    this.encryptDictObjNum = encryptRef.objectNumber;

    // Parse the /Encrypt dictionary outside the document's registry: it is not an object of the
    // decrypted document.
    const encryptEntry = this.xrefEntries.get(encryptRef.objectNumber);
    const encryptObj =
      encryptEntry?.type === 'in-use'
        ? this.parseOutsideRegistry(encryptRef, encryptEntry)
        : this.resolveRef(encryptRef);
    if (encryptObj.kind !== 'dict') {
      throw new PdfParseError({
        message: 'Invalid PDF: /Encrypt entry is not a dictionary.',
        offset: 0,
        expected: 'dictionary for /Encrypt entry',
        actual: `${encryptObj.kind}`,
        data: this.data,
      });
    }
    const encryptDict = encryptObj as PdfDict;

    // Extract file ID (first element of /ID array in trailer)
    const fileId = this.trailer.id?.[0] ?? new Uint8Array(0);

    // Try the empty password first (most PDFs use owner-only encryption
    // with an empty user password, allowing open access)
    const passwordsToTry: string[] = [];
    if (password !== undefined) {
      // If a password was provided, try it first, then empty
      passwordsToTry.push(password);
      if (password !== '') {
        passwordsToTry.push('');
      }
    } else {
      // No password provided -- only try empty
      passwordsToTry.push('');
    }

    let lastError: Error | undefined;
    for (const pwd of passwordsToTry) {
      try {
        this.encryptionHandler = await PdfEncryptionHandler.fromEncryptDict(
          encryptDict,
          fileId,
          pwd,
        );
        return this.encryptionHandler; // Authentication succeeded
      } catch (err) {
        if (err instanceof UnsupportedEncryptionError || err instanceof ResourceLimitError) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // All password attempts failed
    if (password !== undefined) {
      throw new PdfParseError({
        message: `Failed to decrypt PDF: the provided password is incorrect. ${lastError?.message ?? ''}`,
        offset: 0,
        expected: 'valid decryption password',
        actual: 'incorrect password',
        data: this.data,
        cause: lastError,
      });
    } else {
      throw new PdfParseError({
        message:
          'This PDF is encrypted and requires a password. ' +
          'Pass { password: "..." } in the options to decrypt it.',
        offset: 0,
        expected: 'unencrypted PDF or password option',
        actual: 'encrypted PDF without password',
        data: this.data,
      });
    }
  }

  /** Parse the in-use object `ref` with a parser whose registry is not the document's. */
  private parseOutsideRegistry(ref: PdfRef, entry: XrefEntry): PdfObject {
    const parser = new PdfObjectParser(this.lexer, new PdfObjectRegistry(), {
      recover: !this.throwOnInvalidObject,
    });
    try {
      return parser.parseIndirectObjectAt(entry.offset).object;
    } catch (err) {
      if (err instanceof ResourceLimitError) throw err;
      throw new PdfParseError({
        message:
          `Failed to parse indirect object ${ref.objectNumber} ${entry.generationNumber} at ` +
          `offset ${entry.offset}`,
        offset: entry.offset,
        expected: `valid indirect object ${ref.objectNumber} ${entry.generationNumber}`,
        actual: 'parse failure',
        data: this.data,
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Whether the members of object stream `containerNum` can be read: always for a file that is
   * not decrypted, and after the decryption pass has decrypted the container otherwise.
   */
  private containerReadable(containerNum: number): boolean {
    return this.encryptionHandler === undefined || this.decryptedObjects.has(containerNum);
  }

  /**
   * Decrypt every in-use object once, right after the handler is set up.
   *
   * Each in-use object is parsed and decrypted in place with its own object number and the
   * generation number of its xref entry; object streams are among them, so their members are
   * read later (by {@link resolveCompressedObject}) from decrypted data and are not decrypted
   * themselves. The object streams that hold compressed objects are decrypted first, before
   * every other object, so a stream whose /Length is an integer in one of them is framed by that
   * /Length (an object stream's own /Length is never in an object stream, ISO 32000-2 7.5.7).
   * Every string and stream the pass decrypts is recorded ({@link recordDecryptedObject}). Exempt: the /Encrypt dictionary, cross-reference streams, the data of the
   * document-level metadata stream (the one the catalog's /Metadata names) of a file with
   * /EncryptMetadata false, and the /Contents of signature dictionaries (see
   * {@link decryptStrings}). An object that does not parse is skipped as {@link buildDocument}
   * skips it (thrown with `throwOnInvalidObject`); a `ResourceLimitError` and data that cannot be
   * decrypted (`UnsupportedEncryptionError`) propagate.
   */
  private async decryptEveryObject(
    handler: PdfEncryptionHandler,
    options?: LoadPdfOptions,
  ): Promise<void> {
    const objectsPerTick = options?.objectsPerTick ?? Infinity;
    let objectsThisTick = 0;
    // With /EncryptMetadata false, the /Type /Metadata streams whose data waits until the catalog
    // can be read (it may be in an object stream not decrypted yet).
    const metadataStreams: { stream: PdfStream; objNum: number; genNum: number }[] = [];
    // The object-stream containers come first: a stream /Length may be an integer stored in one.
    const containers = new Set<number>();
    for (const e of this.xrefEntries.values()) {
      if (e.type === 'compressed' && e.containerObjectNumber !== undefined) {
        containers.add(e.containerObjectNumber);
      }
    }
    const ordered = [
      ...Iterator.from(this.xrefEntries).filter(([n]) => containers.has(n)),
      ...Iterator.from(this.xrefEntries).filter(([n]) => !containers.has(n)),
    ];

    for (const [objNum, entry] of ordered) {
      if (entry.type !== 'in-use' || objNum === this.encryptDictObjNum) continue;
      let obj: PdfObject;
      try {
        obj = this.resolveRef(PdfRef.of(objNum, entry.generationNumber));
      } catch (err) {
        if (this.throwOnInvalidObject || err instanceof ResourceLimitError) throw err;
        continue;
      }
      if (!this.decryptedObjects.has(objNum)) {
        this.decryptedObjects.add(objNum);
        const genNum = entry.generationNumber;
        if (!handler.isMetadataEncrypted() && isMetadataStream(obj)) {
          metadataStreams.push({ stream: obj as PdfStream, objNum, genNum });
          await this.decryptStrings(handler, (obj as PdfStream).dict, objNum, genNum);
        } else {
          await this.decryptIndirectObject(handler, obj, objNum, genNum);
        }
      }

      objectsThisTick++;
      if (objectsThisTick >= objectsPerTick) {
        await new Promise<void>((r) => setTimeout(r, 0));
        objectsThisTick = 0;
      }
    }

    if (metadataStreams.length > 0) {
      const documentLevel = this.catalogMetadataNumber();
      for (const { stream, objNum, genNum } of metadataStreams) {
        if (objNum !== documentLevel) {
          await this.decryptStreamData(handler, stream, objNum, genNum, '/Metadata');
        }
      }
    }
  }

  /**
   * The object number of the stream the catalog's /Metadata names, or `undefined` when the
   * catalog cannot be read or names none (a catalog that does not parse is reported later, by
   * {@link resolveCatalog}).
   */
  private catalogMetadataNumber(): number | undefined {
    let catalog: PdfObject;
    try {
      catalog = this.resolveRef(this.trailer.rootRef);
    } catch (err) {
      if (err instanceof ResourceLimitError || err instanceof UnsupportedEncryptionError) {
        throw err;
      }
      return undefined;
    }
    if (catalog.kind !== 'dict') return undefined;
    const metadata = (catalog as PdfDict).get('/Metadata');
    return metadata?.kind === 'ref' ? (metadata as PdfRef).objectNumber : undefined;
  }

  /**
   * Decrypt one indirect object in place: a stream's data (with the stream filter, the
   * embedded-file filter, or its own /Crypt filter) and every string it holds.
   */
  private async decryptIndirectObject(
    handler: PdfEncryptionHandler,
    obj: PdfObject,
    objNum: number,
    genNum: number,
  ): Promise<void> {
    if (obj.kind === 'stream') {
      const stream = obj as PdfStream;
      const type = stream.dict.get('/Type');
      const typeName = type?.kind === 'name' ? (type as PdfName).value : undefined;
      if (typeName === '/XRef') return;
      await this.decryptStreamData(handler, stream, objNum, genNum, typeName);
      await this.decryptStrings(handler, stream.dict, objNum, genNum);
    } else if (obj.kind === 'dict' || obj.kind === 'array') {
      await this.decryptStrings(handler, obj as PdfDict | PdfArray, objNum, genNum);
    } else if (obj.kind === 'string') {
      // A string as the whole indirect object is immutable: the decrypted string replaces it in
      // the cache and in the registry entry the object parser made.
      const decrypted = await this.decryptString(handler, obj as PdfString, objNum, genNum);
      this.objectCache.set(objNum, decrypted);
      this.registry.assign(PdfRef.of(objNum, genNum), decrypted);
    }
  }

  /**
   * Decrypt the data of `stream` in place, with its own /Crypt filter, else the embedded-file
   * filter for a stream of `/Type` `typeName` /EmbeddedFile, else the stream filter.
   */
  private async decryptStreamData(
    handler: PdfEncryptionHandler,
    stream: PdfStream,
    objNum: number,
    genNum: number,
    typeName: string | undefined,
  ): Promise<void> {
    const filterName =
      takeCryptFilter(stream.dict) ??
      (typeName === '/EmbeddedFile' ? embeddedFileFilterName(handler) : undefined);
    if (stream.data.length > 0) {
      stream.data = await decryptStreamBytes(handler, objNum, genNum, stream.data, filterName);
      recordDecryptedObject(stream);
    }
  }

  /**
   * Decrypt in place every string `root` holds, in its own entries and in the dictionaries and
   * arrays nested in it. The /Contents of a signature dictionary (see
   * {@link contentsLeftAsStored}) is not encrypted and is left as it is.
   *
   * The strings are decrypted concurrently, {@link STRINGS_AT_ONCE} at a time. The results are
   * those of decrypting them one after another, and so is the error when one cannot be
   * decrypted: the first such string in the order of the entries.
   */
  private async decryptStrings(
    handler: PdfEncryptionHandler,
    root: PdfDict | PdfArray,
    objNum: number,
    genNum: number,
  ): Promise<void> {
    const slots: { holder: PdfDict | PdfArray; at: string | number; str: PdfString }[] = [];
    const visit = (container: PdfDict | PdfArray): void => {
      if (container.kind === 'dict') {
        const dict = container as PdfDict;
        const signature = contentsLeftAsStored(dict);
        for (const [key, value] of dict) {
          if (value.kind === 'string') {
            if (!(signature && key === '/Contents')) {
              slots.push({ holder: dict, at: key, str: value as PdfString });
            }
          } else if (value.kind === 'dict' || value.kind === 'array') {
            visit(value as PdfDict | PdfArray);
          }
        }
        return;
      }
      const arr = container as PdfArray;
      for (const [index, item] of arr.items.entries()) {
        if (item.kind === 'string') {
          slots.push({ holder: arr, at: index, str: item as PdfString });
        } else if (item.kind === 'dict' || item.kind === 'array') {
          visit(item as PdfDict | PdfArray);
        }
      }
    };
    visit(root);

    for (let start = 0; start < slots.length; start += STRINGS_AT_ONCE) {
      const chunk = slots.slice(start, start + STRINGS_AT_ONCE);
      const settled = await Promise.allSettled(
        chunk.map(async (slot) => ({
          slot,
          plain: await this.decryptString(handler, slot.str, objNum, genNum),
        })),
      );
      for (const outcome of settled) {
        if (outcome.status === 'rejected') throw outcome.reason;
        const { slot, plain } = outcome.value;
        if (slot.holder.kind === 'dict') (slot.holder as PdfDict).set(slot.at as string, plain);
        else (slot.holder as PdfArray).items[slot.at as number] = plain;
      }
    }
  }

  /**
   * Decrypt a PdfString with the string filter and return a new PdfString of the same form.
   *
   * The lexer stores a string's bytes as one code unit per byte, for hex and literal strings
   * alike, so the bytes are the code units; the plaintext is rebuilt the same way, byte for
   * byte.
   */
  private async decryptString(
    handler: PdfEncryptionHandler,
    str: PdfString,
    objNum: number,
    genNum: number,
  ): Promise<PdfString> {
    if (str.value.length === 0) return str;
    const encrypted = Uint8Array.from(str.value, (c) => c.charCodeAt(0) & 0xff);
    const plain = latin1String(await decryptStringBytes(handler, objNum, genNum, encrypted));
    const decrypted = str.hex ? PdfString.hex(plain) : PdfString.literal(plain);
    recordDecryptedObject(decrypted);
    return decrypted;
  }

  /**
   * Get the page dictionary for a specific page index (zero-based).
   *
   * @param pageIndex  Zero-based page index.
   * @returns          The page's PdfDict.
   * @throws           If the page index is out of range.
   */
  getPageDict(pageIndex: number): PdfDict {
    if (pageIndex < 0 || pageIndex >= this.flattenedPages.length) {
      throw new PdfParseError({
        message:
          `Page index ${pageIndex} is out of range. ` +
          `The document has ${this.flattenedPages.length} page(s).`,
        offset: 0,
        expected: `page index in range [0, ${this.flattenedPages.length})`,
        actual: `${pageIndex}`,
      });
    }
    return this.flattenedPages[pageIndex]!.dict;
  }

  /**
   * Get the total number of pages in the document.
   *
   * @returns The page count.
   */
  getPageCount(): number {
    return this.flattenedPages.length;
  }

  // -----------------------------------------------------------------------
  // Internal: header validation
  // -----------------------------------------------------------------------

  /**
   * Validate the PDF file header.
   *
   * The first line must be `%PDF-X.Y` where X.Y is the PDF version
   * (e.g. 1.0 through 1.7, or 2.0).
   */
  private validateHeader(): void {
    // Read the first 10 bytes and check for %PDF-
    const header = TEXT_DECODER.decode(this.data.subarray(0, Math.min(1024, this.data.length)));

    // The %PDF- marker might not be at byte 0 in some files (e.g. prepended BOM)
    // but it must appear very early.
    const pdfIdx = header.indexOf('%PDF-');
    if (pdfIdx === -1 || pdfIdx > 1024) {
      throw new PdfParseError({
        message:
          'Invalid PDF: file does not start with "%PDF-" header. ' + 'This may not be a PDF file.',
        offset: 0,
        expected: '"%PDF-" header near start of file',
        actual: 'no "%PDF-" marker found',
        data: this.data,
      });
    }

    // Extract version string
    const versionMatch = header.slice(pdfIdx).match(/%PDF-(\d+\.\d+)/);
    if (!versionMatch) {
      throw new PdfParseError({
        message: 'Invalid PDF: could not parse version from header.',
        offset: pdfIdx,
        expected: '"%PDF-X.Y" version string',
        actual: `"${header.slice(pdfIdx, pdfIdx + 10)}"`,
        data: this.data,
      });
    }

    this.pdfVersion = versionMatch[1]!;

    // Validate version range
    const majorMinor = this.pdfVersion.split('.');
    const major = parseInt(majorMinor[0]!, 10);
    const minor = parseInt(majorMinor[1]!, 10);

    if (major === 1 && minor >= 0 && minor <= 9) {
      return; // PDF 1.0 through 1.9
    }
    if (major === 2 && minor >= 0) {
      return; // PDF 2.0+
    }

    throw new PdfParseError({
      message: `Unsupported PDF version: ${this.pdfVersion}. ` + 'Expected PDF 1.0-1.9 or 2.0+.',
      offset: 0,
      expected: 'PDF version 1.0-1.9 or 2.0+',
      actual: `PDF version ${this.pdfVersion}`,
      data: this.data,
    });
  }

  // -----------------------------------------------------------------------
  // Internal: catalog resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the document catalog dictionary from the trailer's /Root
   * reference.
   */
  private resolveCatalog(): PdfDict {
    const rootObj = this.resolveRef(this.trailer.rootRef);

    if (rootObj.kind !== 'dict') {
      throw new PdfParseError({
        message:
          `Invalid PDF: /Root (catalog) at object ${this.trailer.rootRef.objectNumber} ` +
          `is not a dictionary (got ${rootObj.kind}).`,
        offset: 0,
        expected: 'dictionary for /Root (catalog)',
        actual: `${rootObj.kind}`,
        data: this.data,
      });
    }

    const catalog = rootObj as PdfDict;

    // Verify /Type /Catalog
    const typeObj = catalog.get('/Type');
    if (typeObj !== undefined && typeObj.kind === 'name') {
      const typeName = (typeObj as PdfName).value;
      if (typeName !== '/Catalog') {
        throw new PdfParseError({
          message: `Invalid PDF: /Root dictionary has /Type "${typeName}", expected "/Catalog".`,
          offset: 0,
          expected: '/Type /Catalog in /Root dictionary',
          actual: `/Type "${typeName}"`,
          data: this.data,
        });
      }
    }

    return catalog;
  }

  // -----------------------------------------------------------------------
  // Internal: page tree traversal
  // -----------------------------------------------------------------------

  /**
   * Resolve the page tree from the catalog and return a flat list of
   * page dictionaries in document order.
   *
   * The page tree is a tree of /Pages (intermediate) and /Page (leaf)
   * nodes. Attributes like /MediaBox, /Resources, and /Rotate can be
   * inherited from ancestor /Pages nodes.
   */
  private resolvePageTree(catalog: PdfDict): FlattenedPage[] {
    const pagesRef = catalog.get('/Pages');
    if (pagesRef === undefined) {
      throw new PdfParseError({
        message: 'Invalid PDF: catalog dictionary missing /Pages entry.',
        offset: 0,
        expected: '/Pages entry in catalog dictionary',
        actual: 'no /Pages entry',
        data: this.data,
      });
    }

    const pagesObj = this.resolveObject(pagesRef);
    if (pagesObj.kind !== 'dict') {
      throw new PdfParseError({
        message: `Invalid PDF: /Pages entry is not a dictionary (got ${pagesObj.kind}).`,
        offset: 0,
        expected: 'dictionary for /Pages entry',
        actual: `${pagesObj.kind}`,
        data: this.data,
      });
    }

    const pages: FlattenedPage[] = [];
    this.traversePageTree(pagesObj as PdfDict, {}, pages, new Set(), 1);
    return pages;
  }

  /**
   * Recursively traverse the page tree, collecting leaf /Page nodes.
   *
   * @param node       Current tree node (/Pages or /Page dict).
   * @param inherited  Attributes inherited from parent nodes.
   * @param result     Accumulator for flattened page entries.
   * @param visited    Set of visited object numbers to prevent cycles; a kid
   *                   already in it is not entered again.
   * @param depth      Level of `node` in the tree (the root is level 1); a
   *                   node deeper than `maxTreeDepth` throws
   *                   {@link ResourceLimitError}.
   */
  private traversePageTree(
    node: PdfDict,
    inherited: InheritedPageAttrs,
    result: FlattenedPage[],
    visited: Set<number>,
    depth: number,
  ): void {
    assertWithinLimit('maxTreeDepth', depth);

    // Determine if this is a /Pages (intermediate) or /Page (leaf) node
    const typeObj = node.get('/Type');
    let typeName = '';
    if (typeObj !== undefined && typeObj.kind === 'name') {
      typeName = (typeObj as PdfName).value;
    }

    // Build inherited attributes for this level
    const currentInherited: InheritedPageAttrs = { ...inherited };

    // /MediaBox -- inheritable
    const mediaBoxObj = node.get('/MediaBox');
    if (mediaBoxObj !== undefined) {
      const resolved = this.resolveObject(mediaBoxObj);
      if (resolved.kind === 'array') {
        currentInherited.mediaBox = resolved as PdfArray;
      }
    }

    // /CropBox -- inheritable
    const cropBoxObj = node.get('/CropBox');
    if (cropBoxObj !== undefined) {
      const resolved = this.resolveObject(cropBoxObj);
      if (resolved.kind === 'array') {
        currentInherited.cropBox = resolved as PdfArray;
      }
    }

    // /Resources -- inheritable
    const resourcesObj = node.get('/Resources');
    if (resourcesObj !== undefined) {
      currentInherited.resources = this.resolveObject(resourcesObj);
    }

    // /Rotate -- inheritable
    const rotateObj = node.get('/Rotate');
    if (rotateObj !== undefined) {
      const rotateVal = numVal(this.resolveObject(rotateObj));
      if (rotateVal !== undefined) {
        currentInherited.rotate = rotateVal;
      }
    }

    if (typeName === '/Page') {
      // Leaf node -- this is an actual page
      const mediaBox = currentInherited.mediaBox;
      if (mediaBox === undefined) {
        throw new PdfParseError({
          message: 'Invalid PDF: /Page node has no /MediaBox (not even inherited).',
          offset: 0,
          expected: '/MediaBox on page node or inherited from parent',
          actual: 'no /MediaBox found',
          data: this.data,
        });
      }

      result.push({
        dict: node,
        mediaBox,
        resources: currentInherited.resources,
        rotate: currentInherited.rotate ?? 0,
      });
      return;
    }

    // Intermediate /Pages node -- traverse /Kids
    const kidsObj = node.get('/Kids');
    if (kidsObj === undefined) {
      // No /Kids and not a /Page -- might be an empty /Pages node
      return;
    }

    const kids = this.resolveObject(kidsObj);
    if (kids.kind !== 'array') {
      throw new PdfParseError({
        message: `Invalid PDF: /Pages /Kids is not an array (got ${kids.kind}).`,
        offset: 0,
        expected: 'array for /Pages /Kids',
        actual: `${kids.kind}`,
        data: this.data,
      });
    }

    const kidsArr = kids as PdfArray;
    for (let i = 0; i < kidsArr.length; i++) {
      const kidRef = kidsArr.items[i];
      if (kidRef === undefined) continue;

      // Track visited nodes to prevent infinite loops in malformed PDFs
      let kidObjNum: number | undefined;
      if (kidRef.kind === 'ref') {
        kidObjNum = (kidRef as PdfRef).objectNumber;
        if (visited.has(kidObjNum)) {
          continue; // Skip circular references
        }
        visited.add(kidObjNum);
      }

      const kidObj = this.resolveObject(kidRef);
      if (kidObj.kind !== 'dict') {
        continue; // Skip invalid kids
      }

      this.traversePageTree(kidObj as PdfDict, currentInherited, result, visited, depth + 1);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: compressed object resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve an object stored in a compressed object stream (ObjStm).
   *
   * Object streams (PDF 1.5+) pack multiple objects into a single
   * FlateDecode stream. The stream has a header section listing
   * (objNumber, byteOffset) pairs, followed by the objects themselves.
   * The container is taken through {@link resolveRef}, so in an encrypted
   * file it is the container the decryption pass decrypted; its members are
   * not decrypted again. Before that pass has decrypted the container, its
   * members resolve to null.
   *
   * @param entry  The xref entry for the compressed object.
   * @returns      The resolved PDF object.
   */
  private resolveCompressedObject(entry: XrefEntry): PdfObject {
    const containerNum = entry.containerObjectNumber!;
    const indexInStream = entry.indexInStream!;

    // Check if this object stream has already been decompressed
    let streamObjects = this.objStreamCache.get(containerNum);
    if (streamObjects !== undefined) {
      const cached = streamObjects.get(indexInStream);
      if (cached !== undefined) return cached;
      // Index not found in cached stream -- unexpected but recoverable
      return PdfNull.instance;
    }

    // Parse the container object stream
    const containerEntry = this.xrefEntries.get(containerNum);
    if (containerEntry === undefined || containerEntry.type !== 'in-use') {
      throw new PdfParseError({
        message:
          `Invalid PDF: object stream ${containerNum} referenced by ` +
          `compressed object ${entry.objectNumber} not found in xref table.`,
        offset: 0,
        expected: `in-use xref entry for object stream ${containerNum}`,
        actual: containerEntry ? `${containerEntry.type} entry` : 'no entry',
        data: this.data,
      });
    }

    if (!this.containerReadable(containerNum)) return PdfNull.instance;

    let containerObj: PdfObject;
    this.inProgress.add(containerNum);
    try {
      containerObj = this.resolveRef(PdfRef.of(containerNum, containerEntry.generationNumber));
    } catch (err) {
      if (err instanceof ResourceLimitError) throw err;
      throw new PdfParseError({
        message:
          `Failed to parse object stream ${containerNum} at offset ` + `${containerEntry.offset}`,
        offset: containerEntry.offset,
        expected: `valid object stream ${containerNum}`,
        actual: 'parse failure',
        data: this.data,
        cause: err instanceof Error ? err : undefined,
      });
    } finally {
      this.inProgress.delete(containerNum);
    }

    if (containerObj.kind !== 'stream') {
      throw new PdfParseError({
        message:
          `Invalid PDF: object ${containerNum} expected to be an object stream ` +
          `but is ${containerObj.kind}.`,
        offset: containerEntry.offset,
        expected: 'stream object for object stream',
        actual: `${containerObj.kind}`,
        data: this.data,
      });
    }

    const containerStream = containerObj as PdfStream;
    const containerDict = containerStream.dict;

    // Verify /Type /ObjStm
    const typeObj = containerDict.get('/Type');
    if (
      typeObj === undefined ||
      typeObj.kind !== 'name' ||
      (typeObj as PdfName).value !== '/ObjStm'
    ) {
      throw new PdfParseError({
        message: `Invalid PDF: object ${containerNum} is not an object stream (/Type /ObjStm).`,
        offset: containerEntry.offset,
        expected: '/Type /ObjStm in object stream dictionary',
        actual: typeObj ? `${typeObj.kind}` : 'no /Type entry',
        data: this.data,
      });
    }

    // Get /N (number of objects) and /First (byte offset to first object data)
    const n = numVal(containerDict.get('/N'));
    const first = numVal(containerDict.get('/First'));

    if (n === undefined || first === undefined) {
      throw new PdfParseError({
        message: `Invalid PDF: object stream ${containerNum} missing /N or /First entries.`,
        offset: containerEntry.offset,
        expected: '/N and /First entries in object stream',
        actual: `${n === undefined ? 'no /N' : '/N present'}, ${first === undefined ? 'no /First' : '/First present'}`,
        data: this.data,
      });
    }

    // Decode the object stream's data (/FlateDecode and its predictor only)
    const decompressedData = this.decompressStreamSync(containerStream);

    // Parse the header: N pairs of (objNumber byteOffset). The tokens are read one
    // pair at a time and the scan stops after N pairs, so the cost follows /N,
    // not the length of the header.
    const headerText = TEXT_DECODER.decode(decompressedData.subarray(0, first));
    const token = /\S+/g;

    const objEntries: Array<{ objNum: number; offset: number }> = [];
    while (objEntries.length < n) {
      const objToken = token.exec(headerText);
      const offsetToken = token.exec(headerText);
      if (objToken === null || offsetToken === null) break;
      const objNum = parseInt(objToken[0], 10);
      const offset = parseInt(offsetToken[0], 10);
      if (!Number.isNaN(objNum) && !Number.isNaN(offset)) {
        objEntries.push({ objNum, offset });
      }
    }

    // Parse each object from the data section
    streamObjects = new Map<number, PdfObject>();

    for (let i = 0; i < objEntries.length; i++) {
      const objEntry = objEntries[i]!;
      const dataStart = first + objEntry.offset;

      // Determine the end of this object's data
      const dataEnd =
        i + 1 < objEntries.length ? first + objEntries[i + 1]!.offset : decompressedData.length;

      try {
        // Create a sub-lexer for this object's data
        const subData = decompressedData.subarray(dataStart, dataEnd);
        const subLexer = new PdfLexer(subData);
        if (this.capNumbers) {
          subLexer.capNumbers = true;
        }
        const subParser = new PdfObjectParser(subLexer, this.registry);
        const parsedObj = subParser.parseObject();
        // The members of a decrypted object stream hold its plaintext: their strings are recorded.
        if (this.encryptionHandler !== undefined) recordDecryptedContent(parsedObj);

        streamObjects.set(i, parsedObj);

        // Also cache by object number for direct lookup
        this.objectCache.set(objEntry.objNum, parsedObj);
      } catch (err) {
        if (this.throwOnInvalidObject) {
          throw err instanceof Error ? err : new Error(String(err));
        }
        // Skip unparseable objects within the stream
        streamObjects.set(i, PdfNull.instance);
      }
    }

    // Cache the entire object stream
    this.objStreamCache.set(containerNum, streamObjects);

    // Return the requested object
    const result = streamObjects.get(indexInStream);
    return result ?? PdfNull.instance;
  }

  /**
   * Decode an object stream's data synchronously.
   *
   * Reads no filter, or `/FlateDecode` (zlib or raw DEFLATE) and its
   * predictor (`decodeFlateOnly`): `/Filter` is `/FlateDecode` or an array
   * whose first entry is `/FlateDecode`, and no other filter is applied.
   * An array of more than one entry that starts with `/FlateDecode` is
   * inflated as raw DEFLATE only, with `/DecodeParms` read only as a
   * dictionary, and the later entries are not applied.
   * Returns the data unchanged when the stream has no filter, when
   * `/Filter` is anything else, and when the data does not inflate.
   * A stream that decodes to more than the decoded-stream limit throws
   * `ResourceLimitError`; it is not returned undecoded.
   */
  private decompressStreamSync(stream: PdfStream): Uint8Array {
    try {
      return decodeFlateOnly(stream) ?? stream.data;
    } catch (err) {
      if (err instanceof ResourceLimitError) throw err;
      // If synchronous decompression fails, return raw data
      // The caller will handle the error
      return stream.data;
    }
  }

  // -----------------------------------------------------------------------
  // Internal: metadata extraction
  // -----------------------------------------------------------------------

  /**
   * Extract document metadata from the /Info dictionary.
   */
  private extractMetadata(): {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modDate?: Date;
  } {
    const metadata: {
      title?: string;
      author?: string;
      subject?: string;
      keywords?: string;
      creator?: string;
      producer?: string;
      creationDate?: Date;
      modDate?: Date;
    } = {};

    if (this.trailer.infoRef === undefined) {
      return metadata;
    }

    let infoObj: PdfObject;
    try {
      infoObj = this.resolveRef(this.trailer.infoRef);
    } catch (err) {
      if (this.throwOnInvalidObject || err instanceof ResourceLimitError) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      return metadata; // Info dict not parseable
    }

    if (infoObj.kind !== 'dict') {
      return metadata;
    }

    const info = infoObj as PdfDict;

    const getString = (key: string): string | undefined => {
      const obj = info.get(key);
      if (obj === undefined) return undefined;
      const resolved = this.resolveObject(obj);
      if (resolved.kind === 'string') {
        return (resolved as PdfString).value;
      }
      return undefined;
    };

    const title = getString('/Title');
    if (title !== undefined) metadata.title = title;
    const author = getString('/Author');
    if (author !== undefined) metadata.author = author;
    const subject = getString('/Subject');
    if (subject !== undefined) metadata.subject = subject;
    const keywords = getString('/Keywords');
    if (keywords !== undefined) metadata.keywords = keywords;
    const creator = getString('/Creator');
    if (creator !== undefined) metadata.creator = creator;
    const producer = getString('/Producer');
    if (producer !== undefined) metadata.producer = producer;

    // Parse PDF dates: D:YYYYMMDDHHmmSSOHH'mm
    const creationDateStr = getString('/CreationDate');
    if (creationDateStr !== undefined) {
      const d = parsePdfDate(creationDateStr);
      if (d !== undefined) metadata.creationDate = d;
    }

    const modDateStr = getString('/ModDate');
    if (modDateStr !== undefined) {
      const d = parsePdfDate(modDateStr);
      if (d !== undefined) metadata.modDate = d;
    }

    return metadata;
  }

  // -----------------------------------------------------------------------
  // Internal: document construction
  // -----------------------------------------------------------------------

  /**
   * Build a PdfDocument from the parsed PDF structure.
   *
   * This creates a new PdfDocument and populates it with the parsed
   * pages and metadata. The resulting document can be modified and
   * saved back to bytes.
   */
  private async buildDocument(options?: LoadPdfOptions): Promise<PdfDocument> {
    // Register all resolved objects in the parser's registry so they
    // can be serialized when the document is saved.
    const objectsPerTick = options?.objectsPerTick ?? Infinity;
    let objectsThisTick = 0;

    for (const [objNum, entry] of this.xrefEntries) {
      // The /Encrypt dictionary of a decrypted file is not an object of the document.
      if (this.encryptionHandler !== undefined && objNum === this.encryptDictObjNum) continue;
      if (entry.type === 'in-use' || entry.type === 'compressed') {
        try {
          const obj = this.resolveRef(PdfRef.of(objNum, entry.generationNumber));
          if (obj.kind !== 'null') {
            const ref = PdfRef.of(objNum, entry.generationNumber);
            this.registry.registerWithRef(ref, obj);
          }
        } catch (err) {
          if (this.throwOnInvalidObject || err instanceof ResourceLimitError) {
            throw err instanceof Error ? err : new Error(String(err));
          }
          // Skip objects that fail to resolve
        }

        objectsThisTick++;
        if (objectsThisTick >= objectsPerTick) {
          await new Promise<void>((r) => setTimeout(r, 0));
          objectsThisTick = 0;
        }
      }
    }

    // Create the document with the parser's registry so all parsed
    // objects (fonts, images, content streams, etc.) are available.
    const doc = new PdfDocument(this.registry);

    // Apply metadata
    const metadata = this.extractMetadata();
    if (metadata.title !== undefined) doc.setTitle(metadata.title);
    if (metadata.author !== undefined) doc.setAuthor(metadata.author);
    if (metadata.subject !== undefined) doc.setSubject(metadata.subject);
    if (metadata.keywords !== undefined) doc.setKeywords(metadata.keywords);
    if (metadata.creator !== undefined) doc.setCreator(metadata.creator);
    if (metadata.producer !== undefined) doc.setProducer(metadata.producer);
    if (metadata.creationDate !== undefined) doc.setCreationDate(metadata.creationDate);
    if (metadata.modDate !== undefined && options?.updateMetadata !== true) {
      doc.setModDate(metadata.modDate);
    }

    // Track highest resource name indices so new names don't collide
    let maxFontIdx = 0;
    let maxImageIdx = 0;

    // Add pages — preserving content, resources, and annotations
    for (const flatPage of this.flattenedPages) {
      const mediaBox = flatPage.mediaBox;
      const width = this.getMediaBoxDimension(mediaBox, 2) - this.getMediaBoxDimension(mediaBox, 0);
      const height =
        this.getMediaBoxDimension(mediaBox, 3) - this.getMediaBoxDimension(mediaBox, 1);

      // Extract content stream references
      const contentRefs = this.extractContentRefs(flatPage.dict);

      // Extract resources dictionary
      const resources = this.extractResourcesDict(flatPage);

      // Scan resource names to prevent future collisions
      if (resources) {
        maxFontIdx = Math.max(maxFontIdx, this.scanMaxResourceIndex(resources, '/Font', 'F'));
        maxImageIdx = Math.max(maxImageIdx, this.scanMaxResourceIndex(resources, '/XObject', 'Im'));
      }

      // Extract crop box if present
      let cropBox: [number, number, number, number] | undefined;
      const cropBoxObj = flatPage.dict.get('/CropBox');
      if (cropBoxObj !== undefined) {
        const resolved = this.resolveObject(cropBoxObj);
        if (resolved.kind === 'array') {
          const arr = resolved as PdfArray;
          if (arr.length >= 4) {
            cropBox = [
              numVal(this.resolveObject(arr.items[0]!)) ?? 0,
              numVal(this.resolveObject(arr.items[1]!)) ?? 0,
              numVal(this.resolveObject(arr.items[2]!)) ?? 0,
              numVal(this.resolveObject(arr.items[3]!)) ?? 0,
            ];
          }
        }
      }

      // Extract bleed box if present
      let bleedBox: [number, number, number, number] | undefined;
      const bleedBoxObj = flatPage.dict.get('/BleedBox');
      if (bleedBoxObj !== undefined) {
        const resolved = this.resolveObject(bleedBoxObj);
        if (resolved.kind === 'array') {
          const arr = resolved as PdfArray;
          if (arr.length >= 4) {
            bleedBox = [
              numVal(this.resolveObject(arr.items[0]!)) ?? 0,
              numVal(this.resolveObject(arr.items[1]!)) ?? 0,
              numVal(this.resolveObject(arr.items[2]!)) ?? 0,
              numVal(this.resolveObject(arr.items[3]!)) ?? 0,
            ];
          }
        }
      }

      // Extract art box if present
      let artBox: [number, number, number, number] | undefined;
      const artBoxObj = flatPage.dict.get('/ArtBox');
      if (artBoxObj !== undefined) {
        const resolved = this.resolveObject(artBoxObj);
        if (resolved.kind === 'array') {
          const arr = resolved as PdfArray;
          if (arr.length >= 4) {
            artBox = [
              numVal(this.resolveObject(arr.items[0]!)) ?? 0,
              numVal(this.resolveObject(arr.items[1]!)) ?? 0,
              numVal(this.resolveObject(arr.items[2]!)) ?? 0,
              numVal(this.resolveObject(arr.items[3]!)) ?? 0,
            ];
          }
        }
      }

      // Extract trim box if present
      let trimBox: [number, number, number, number] | undefined;
      const trimBoxObj = flatPage.dict.get('/TrimBox');
      if (trimBoxObj !== undefined) {
        const resolved = this.resolveObject(trimBoxObj);
        if (resolved.kind === 'array') {
          const arr = resolved as PdfArray;
          if (arr.length >= 4) {
            trimBox = [
              numVal(this.resolveObject(arr.items[0]!)) ?? 0,
              numVal(this.resolveObject(arr.items[1]!)) ?? 0,
              numVal(this.resolveObject(arr.items[2]!)) ?? 0,
              numVal(this.resolveObject(arr.items[3]!)) ?? 0,
            ];
          }
        }
      }

      // Extract annotation references
      const annotRefs = this.extractAnnotRefs(flatPage.dict);

      // Create a PdfPage that preserves the original content
      const page = PdfPage._fromParsed(width, height, this.registry, {
        contentRefs: contentRefs.length > 0 ? contentRefs : undefined,
        resources,
        rotation: flatPage.rotate !== 0 ? flatPage.rotate : undefined,
        cropBox,
        bleedBox,
        artBox,
        trimBox,
        annotRefs: annotRefs.length > 0 ? annotRefs : undefined,
      });

      doc._addLoadedPage(page);
    }

    // Advance counters so newly embedded fonts/images get unique names
    doc._advanceCounters(maxFontIdx, maxImageIdx, 0);

    return doc;
  }

  /**
   * Extract /Contents references from a page dictionary.
   *
   * Returns an array of PdfRef pointing to content stream objects.
   * The /Contents entry can be a single indirect reference or an array.
   */
  private extractContentRefs(pageDict: PdfDict): PdfRef[] {
    const contentsObj = pageDict.get('/Contents');
    if (contentsObj === undefined) return [];

    if (contentsObj.kind === 'ref') {
      return [contentsObj as PdfRef];
    }

    // Might be an array of refs
    const resolved = this.resolveObject(contentsObj);
    if (resolved.kind === 'array') {
      const arr = resolved as PdfArray;
      const refs: PdfRef[] = [];
      for (const item of arr.items) {
        if (item.kind === 'ref') {
          refs.push(item as PdfRef);
        }
      }
      return refs;
    }

    return [];
  }

  /**
   * Extract the effective /Resources dictionary for a page.
   *
   * Uses the FlattenedPage's `resources` (which accounts for inheritance)
   * and resolves it to a PdfDict if necessary.
   */
  private extractResourcesDict(flatPage: FlattenedPage): PdfDict | undefined {
    const res = flatPage.resources;
    if (res === undefined) return undefined;

    if (res.kind === 'dict') return res as PdfDict;

    // Might be an indirect reference
    if (res.kind === 'ref') {
      const resolved = this.resolveObject(res);
      if (resolved.kind === 'dict') return resolved as PdfDict;
    }

    return undefined;
  }

  /**
   * Extract /Annots references from a page dictionary.
   */
  private extractAnnotRefs(pageDict: PdfDict): PdfRef[] {
    const annotsObj = pageDict.get('/Annots');
    if (annotsObj === undefined) return [];

    const resolved = this.resolveObject(annotsObj);
    if (resolved.kind === 'array') {
      const arr = resolved as PdfArray;
      const refs: PdfRef[] = [];
      for (const item of arr.items) {
        if (item.kind === 'ref') {
          refs.push(item as PdfRef);
        }
      }
      return refs;
    }

    return [];
  }

  /**
   * Scan a resource sub-dictionary for the highest numeric index.
   *
   * E.g. for /Font with keys /F1, /F3, /F7 and prefix 'F', returns 7.
   * This ensures newly allocated names (F8, F9, …) don't collide.
   */
  private scanMaxResourceIndex(resources: PdfDict, subKey: string, prefix: string): number {
    const subObj = resources.get(subKey);
    if (subObj === undefined || subObj.kind !== 'dict') return 0;

    const subDict = subObj as PdfDict;
    // Use iterator helpers to find the max resource index
    return Iterator.from(subDict)
      .map(([key]) => {
        // Keys are stored with '/' prefix: "/F1", "/Im2", etc.
        const name = key.startsWith('/') ? key.slice(1) : key;
        if (name.startsWith(prefix)) {
          const num = parseInt(name.slice(prefix.length), 10);
          return Number.isNaN(num) ? 0 : num;
        }
        return 0;
      })
      .reduce((max, n) => Math.max(max, n), 0);
  }

  /**
   * Extract a numeric dimension from a /MediaBox array.
   */
  private getMediaBoxDimension(mediaBox: PdfArray, index: number): number {
    const item = mediaBox.items[index];
    if (item === undefined) return 0;
    const resolved = this.resolveObject(item);
    return numVal(resolved) ?? 0;
  }
}

// ---------------------------------------------------------------------------
// PDF date parser
// ---------------------------------------------------------------------------

/**
 * Parse a PDF date string into a JavaScript Date.
 *
 * PDF dates follow the form: `D:YYYYMMDDHHmmSSOHH'mm`
 * where O is `+`, `-`, or `Z`.
 *
 * @param dateStr  The PDF date string.
 * @returns        A Date object, or undefined if parsing fails.
 */
function parsePdfDate(dateStr: string): Date | undefined {
  // Strip the "D:" prefix if present
  let s = dateStr;
  if (s.startsWith('D:')) {
    s = s.slice(2);
  }

  // Match the components:
  // YYYY (required), MM, DD, HH, mm, SS, timezone
  const match = s.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(\d{2})?'?(\d{2})?/,
  );

  if (!match) return undefined;

  const year = parseInt(match[1]!, 10);
  const month = match[2] !== undefined ? parseInt(match[2], 10) - 1 : 0;
  const day = match[3] !== undefined ? parseInt(match[3], 10) : 1;
  const hours = match[4] !== undefined ? parseInt(match[4], 10) : 0;
  const minutes = match[5] !== undefined ? parseInt(match[5], 10) : 0;
  const seconds = match[6] !== undefined ? parseInt(match[6], 10) : 0;
  const tzSign = match[7];
  const tzHours = match[8] !== undefined ? parseInt(match[8], 10) : 0;
  const tzMinutes = match[9] !== undefined ? parseInt(match[9], 10) : 0;

  // Build the date in UTC
  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

  // Apply timezone offset
  if (tzSign === '+') {
    date.setTime(date.getTime() - (tzHours * 60 + tzMinutes) * 60000);
  } else if (tzSign === '-') {
    date.setTime(date.getTime() + (tzHours * 60 + tzMinutes) * 60000);
  }
  // 'Z' or undefined means UTC -- no adjustment needed

  return date;
}

// ---------------------------------------------------------------------------
// Static load helper (standalone, to be integrated into PdfDocument later)
// ---------------------------------------------------------------------------

/**
 * Load a PDF document from raw bytes, an ArrayBuffer, or a Base64-encoded
 * string.
 *
 * This is the primary entry point for parsing existing PDFs. It creates
 * a `PdfDocumentParser`, runs the full parse pipeline, and returns
 * a populated {@link PdfDocument}.
 *
 * @param data     The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
 *                 Base64-encoded string.
 * @param options  Optional loading options.
 * @returns        A fully parsed PdfDocument.
 *
 * @example
 * ```ts
 * import { loadPdf } from 'modern-pdf-lib';
 *
 * // From fetch (ArrayBuffer)
 * const pdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer());
 * const doc = await loadPdf(pdfBytes);
 *
 * // From a Base64 string
 * const doc2 = await loadPdf(base64String);
 * ```
 */
export async function loadPdf(
  data: Uint8Array | ArrayBuffer | string,
  options?: LoadPdfOptions,
): Promise<PdfDocument> {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    // Strip data: URI prefix if present (e.g. "data:application/pdf;base64,...")
    const match = data.match(/^data:[^;]*;base64,/);
    if (match) {
      data = data.slice(match[0].length);
    }
    bytes = base64Decode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  const parser = new PdfDocumentParser(bytes);
  return parser.parse(options);
}

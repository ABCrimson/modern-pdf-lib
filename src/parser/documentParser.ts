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
import { PdfPage } from '../core/pdfPage.js';
import { PdfLexer } from './lexer.js';
import { PdfObjectParser } from './objectParser.js';
import { XrefParser } from './xrefParser.js';
import type { XrefEntry, ParsedTrailer } from './xrefParser.js';
import { decompressSync as inflateSync } from '../compression/fflateAdapter.js';
import { base64Decode } from '../utils/base64.js';
import { PdfEncryptionHandler } from '../crypto/encryptionHandler.js';

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

  /**
   * Create a new PdfDocumentParser.
   *
   * @param data  The raw PDF file bytes as a Uint8Array.
   */
  constructor(data: Uint8Array) {
    if (data.length < 8) {
      throw new Error(
        'Invalid PDF: file is too short to contain a valid PDF header.',
      );
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
    // Step 1: Validate PDF header
    this.validateHeader();

    // Step 2: Initialize lexer and object parser
    this.lexer = new PdfLexer(this.data);
    this.objectParser = new PdfObjectParser(this.lexer, this.registry);
    this.xrefParser = new XrefParser(this.data, this.objectParser);

    // Step 3: Parse the cross-reference structure
    const xrefResult = await this.xrefParser.parseXref();
    this.xrefEntries = xrefResult.entries;
    this.trailer = xrefResult.trailer;

    // Step 4: Check for encryption and set up decryption handler
    if (this.trailer.encryptRef !== undefined && options?.ignoreEncryption !== true) {
      await this.setupDecryption(options?.password);
    }

    // Step 5: Resolve the catalog and page tree
    const catalogDict = this.resolveCatalog();
    this.flattenedPages = this.resolvePageTree(catalogDict);

    // Step 6: Decrypt all resolved objects if encrypted
    if (this.encryptionHandler !== undefined) {
      await this.decryptAllObjects();
    }

    // Step 7: Build the PdfDocument
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

    if (entry.type === 'compressed') {
      // Object is inside an object stream
      resolved = this.resolveCompressedObject(entry);
    } else {
      // Standard in-use object -- parse at the byte offset
      try {
        const { object } = this.objectParser.parseIndirectObjectAt(entry.offset);
        resolved = object;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to parse indirect object ${objNum} ${entry.generationNumber} at ` +
          `offset ${entry.offset}: ${msg}`,
        );
      }
    }

    // Cache the result
    this.objectCache.set(objNum, resolved);
    return resolved;
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
   * @throws          If authentication fails.
   */
  private async setupDecryption(password?: string): Promise<void> {
    const encryptRef = this.trailer.encryptRef!;
    this.encryptDictObjNum = encryptRef.objectNumber;

    // Resolve the /Encrypt dictionary
    const encryptObj = this.resolveRef(encryptRef);
    if (encryptObj.kind !== 'dict') {
      throw new Error(
        'Invalid PDF: /Encrypt entry is not a dictionary.',
      );
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
        return; // Authentication succeeded
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // All password attempts failed
    if (password !== undefined) {
      throw new Error(
        `Failed to decrypt PDF: the provided password is incorrect. ${lastError?.message ?? ''}`,
      );
    } else {
      throw new Error(
        'This PDF is encrypted and requires a password. ' +
        'Pass { password: "..." } in the options to decrypt it.',
      );
    }
  }

  /**
   * Decrypt all resolved objects in the object cache.
   *
   * Walks every cached object and decrypts PdfString values and
   * PdfStream data in place. The /Encrypt dictionary itself and its
   * sub-objects are excluded from decryption per the PDF spec.
   */
  private async decryptAllObjects(): Promise<void> {
    const handler = this.encryptionHandler!;

    for (const [objNum, obj] of this.objectCache) {
      // Skip the /Encrypt dictionary -- it is never encrypted
      if (objNum === this.encryptDictObjNum) continue;

      const entry = this.xrefEntries.get(objNum);
      const genNum = entry?.generationNumber ?? 0;

      await this.decryptObject(handler, obj, objNum, genNum);
    }
  }

  /**
   * Recursively decrypt a parsed PDF object in place.
   *
   * - PdfString: decrypted via the handler and replaced in the parent
   * - PdfStream: stream data is decrypted in place
   * - PdfDict: recursively decrypt all values
   * - PdfArray: recursively decrypt all items
   *
   * @param handler  The encryption handler.
   * @param obj      The PDF object to decrypt.
   * @param objNum   The object number (for key derivation).
   * @param genNum   The generation number (for key derivation).
   */
  private async decryptObject(
    handler: PdfEncryptionHandler,
    obj: PdfObject,
    objNum: number,
    genNum: number,
  ): Promise<void> {
    if (obj.kind === 'stream') {
      const stream = obj as PdfStream;

      // Decrypt the stream data
      if (stream.data.length > 0) {
        stream.data = await handler.decryptStream(objNum, genNum, stream.data);
      }

      // Also decrypt any string values in the stream's dictionary
      await this.decryptDict(handler, stream.dict, objNum, genNum);
    } else if (obj.kind === 'dict') {
      await this.decryptDict(handler, obj as PdfDict, objNum, genNum);
    } else if (obj.kind === 'array') {
      await this.decryptArray(handler, obj as PdfArray, objNum, genNum);
    }
    // PdfString values are handled at the dict/array level where they can
    // be replaced, since PdfString is immutable.
  }

  /**
   * Decrypt all string values in a PdfDict (in place).
   */
  private async decryptDict(
    handler: PdfEncryptionHandler,
    dict: PdfDict,
    objNum: number,
    genNum: number,
  ): Promise<void> {
    // Snapshot keys to avoid mutation during iteration
    const keys = Iterator.from(dict).map(([key]) => key).toArray();

    for (const key of keys) {
      const val = dict.get(key);
      if (val === undefined) continue;

      if (val.kind === 'string') {
        const decrypted = await this.decryptString(handler, val as PdfString, objNum, genNum);
        dict.set(key, decrypted);
      } else if (val.kind === 'dict') {
        await this.decryptDict(handler, val as PdfDict, objNum, genNum);
      } else if (val.kind === 'array') {
        await this.decryptArray(handler, val as PdfArray, objNum, genNum);
      } else if (val.kind === 'stream') {
        await this.decryptObject(handler, val, objNum, genNum);
      }
    }
  }

  /**
   * Decrypt all string values in a PdfArray (in place).
   */
  private async decryptArray(
    handler: PdfEncryptionHandler,
    arr: PdfArray,
    objNum: number,
    genNum: number,
  ): Promise<void> {
    for (let i = 0; i < arr.length; i++) {
      const item = arr.items[i];
      if (item === undefined) continue;

      if (item.kind === 'string') {
        const decrypted = await this.decryptString(handler, item as PdfString, objNum, genNum);
        arr.items[i] = decrypted;
      } else if (item.kind === 'dict') {
        await this.decryptDict(handler, item as PdfDict, objNum, genNum);
      } else if (item.kind === 'array') {
        await this.decryptArray(handler, item as PdfArray, objNum, genNum);
      } else if (item.kind === 'stream') {
        await this.decryptObject(handler, item, objNum, genNum);
      }
    }
  }

  /**
   * Decrypt a PdfString value and return a new PdfString with decrypted
   * content.
   */
  private async decryptString(
    handler: PdfEncryptionHandler,
    str: PdfString,
    objNum: number,
    genNum: number,
  ): Promise<PdfString> {
    // Convert the string value to bytes for decryption
    let encrypted: Uint8Array;
    if (str.hex) {
      // Hex string: decode hex pairs to bytes
      const clean = str.value.replace(/\s/g, '');
      encrypted = new Uint8Array(Math.ceil(clean.length / 2));
      for (let i = 0; i < encrypted.length; i++) {
        encrypted[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
      }
    } else {
      // Literal string: character codes as bytes (Latin-1)
      encrypted = new Uint8Array(str.value.length);
      for (let i = 0; i < str.value.length; i++) {
        encrypted[i] = str.value.charCodeAt(i) & 0xff;
      }
    }

    if (encrypted.length === 0) return str;

    const decrypted = await handler.decryptObject(objNum, genNum, encrypted);

    // Reconstruct as a literal string from the decrypted bytes (Latin-1)
    let result = '';
    for (let i = 0; i < decrypted.length; i++) {
      result += String.fromCharCode(decrypted[i]!);
    }
    return PdfString.literal(result);
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
      throw new Error(
        `Page index ${pageIndex} is out of range. ` +
        `The document has ${this.flattenedPages.length} page(s).`,
      );
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
      throw new Error(
        'Invalid PDF: file does not start with "%PDF-" header. ' +
        'This may not be a PDF file.',
      );
    }

    // Extract version string
    const versionMatch = header.substring(pdfIdx).match(/%PDF-(\d+\.\d+)/);
    if (!versionMatch) {
      throw new Error(
        'Invalid PDF: could not parse version from header.',
      );
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

    throw new Error(
      `Unsupported PDF version: ${this.pdfVersion}. ` +
      'Expected PDF 1.0-1.9 or 2.0+.',
    );
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
      throw new Error(
        `Invalid PDF: /Root (catalog) at object ${this.trailer.rootRef.objectNumber} ` +
        `is not a dictionary (got ${rootObj.kind}).`,
      );
    }

    const catalog = rootObj as PdfDict;

    // Verify /Type /Catalog
    const typeObj = catalog.get('/Type');
    if (typeObj !== undefined && typeObj.kind === 'name') {
      const typeName = (typeObj as PdfName).value;
      if (typeName !== '/Catalog') {
        throw new Error(
          `Invalid PDF: /Root dictionary has /Type "${typeName}", expected "/Catalog".`,
        );
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
      throw new Error(
        'Invalid PDF: catalog dictionary missing /Pages entry.',
      );
    }

    const pagesObj = this.resolveObject(pagesRef);
    if (pagesObj.kind !== 'dict') {
      throw new Error(
        `Invalid PDF: /Pages entry is not a dictionary (got ${pagesObj.kind}).`,
      );
    }

    const pages: FlattenedPage[] = [];
    this.traversePageTree(pagesObj as PdfDict, {}, pages, new Set());
    return pages;
  }

  /**
   * Recursively traverse the page tree, collecting leaf /Page nodes.
   *
   * @param node       Current tree node (/Pages or /Page dict).
   * @param inherited  Attributes inherited from parent nodes.
   * @param result     Accumulator for flattened page entries.
   * @param visited    Set of visited object numbers to prevent cycles.
   */
  private traversePageTree(
    node: PdfDict,
    inherited: InheritedPageAttrs,
    result: FlattenedPage[],
    visited: Set<number>,
  ): void {
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
        throw new Error(
          'Invalid PDF: /Page node has no /MediaBox (not even inherited).',
        );
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
      throw new Error(
        `Invalid PDF: /Pages /Kids is not an array (got ${kids.kind}).`,
      );
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

      this.traversePageTree(kidObj as PdfDict, currentInherited, result, visited);
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
      throw new Error(
        `Invalid PDF: object stream ${containerNum} referenced by ` +
        `compressed object ${entry.objectNumber} not found in xref table.`,
      );
    }

    let containerObj: PdfObject;
    try {
      const { object } = this.objectParser.parseIndirectObjectAt(containerEntry.offset);
      containerObj = object;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse object stream ${containerNum} at offset ` +
        `${containerEntry.offset}: ${msg}`,
      );
    }

    if (containerObj.kind !== 'stream') {
      throw new Error(
        `Invalid PDF: object ${containerNum} expected to be an object stream ` +
        `but is ${containerObj.kind}.`,
      );
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
      throw new Error(
        `Invalid PDF: object ${containerNum} is not an object stream (/Type /ObjStm).`,
      );
    }

    // Get /N (number of objects) and /First (byte offset to first object data)
    const n = numVal(containerDict.get('/N'));
    const first = numVal(containerDict.get('/First'));

    if (n === undefined || first === undefined) {
      throw new Error(
        `Invalid PDF: object stream ${containerNum} missing /N or /First entries.`,
      );
    }

    // Decompress the stream data
    // Note: We perform synchronous resolution here but the data is already
    // decompressed during the async parse() flow. For simplicity, we do a
    // synchronous inflate via fflate if available.
    const decompressedData = this.decompressStreamSync(containerStream);

    // Parse the header: N pairs of (objNumber byteOffset)
    const headerText = TEXT_DECODER.decode(decompressedData.subarray(0, first));
    const headerTokens = headerText.trim().split(/\s+/);

    const objEntries: Array<{ objNum: number; offset: number }> = [];
    for (let i = 0; i + 1 < headerTokens.length && objEntries.length < n; i += 2) {
      const objNum = parseInt(headerTokens[i]!, 10);
      const offset = parseInt(headerTokens[i + 1]!, 10);
      if (!isNaN(objNum) && !isNaN(offset)) {
        objEntries.push({ objNum, offset });
      }
    }

    // Parse each object from the data section
    streamObjects = new Map<number, PdfObject>();

    for (let i = 0; i < objEntries.length; i++) {
      const objEntry = objEntries[i]!;
      const dataStart = first + objEntry.offset;

      // Determine the end of this object's data
      const dataEnd = i + 1 < objEntries.length
        ? first + objEntries[i + 1]!.offset
        : decompressedData.length;

      try {
        // Create a sub-lexer for this object's data
        const subData = decompressedData.subarray(dataStart, dataEnd);
        const subLexer = new PdfLexer(subData);
        const subParser = new PdfObjectParser(subLexer, this.registry);
        const parsedObj = subParser.parseObject();

        streamObjects.set(i, parsedObj);

        // Also cache by object number for direct lookup
        this.objectCache.set(objEntry.objNum, parsedObj);
      } catch {
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
   * Decompress a PdfStream synchronously.
   *
   * Checks the /Filter and applies FlateDecode decompression.
   * Falls back to returning raw data if no filter is specified.
   */
  private decompressStreamSync(stream: PdfStream): Uint8Array {
    const filter = stream.dict.get('/Filter');
    if (filter === undefined) {
      return stream.data;
    }

    let filterName: string | undefined;
    if (filter.kind === 'name') {
      filterName = (filter as PdfName).value;
    } else if (filter.kind === 'array') {
      const arr = filter as PdfArray;
      if (arr.length > 0 && arr.items[0]!.kind === 'name') {
        filterName = (arr.items[0] as PdfName).value;
      }
    }

    if (filterName !== '/FlateDecode') {
      // For non-FlateDecode filters, return raw data
      // (ASCIIHexDecode, ASCII85Decode, etc. would need additional handlers)
      return stream.data;
    }

    // Use synchronous fflate decompression (imported at module level)
    try {
      let decompressed = inflateSync(stream.data);

      // Handle predictor
      const decodeParms = stream.dict.get('/DecodeParms');
      if (decodeParms !== undefined && decodeParms.kind === 'dict') {
        const parms = decodeParms as PdfDict;
        const predictor = numVal(parms.get('/Predictor')) ?? 1;
        const columns = numVal(parms.get('/Columns')) ?? 1;

        if (predictor >= 10) {
          decompressed = undoPngPredictorSync(decompressed, columns);
        }
      }

      return decompressed;
    } catch {
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
    } catch {
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
      if (entry.type === 'in-use' || entry.type === 'compressed') {
        try {
          const obj = this.resolveRef(PdfRef.of(objNum, entry.generationNumber));
          if (obj.kind !== 'null') {
            const ref = PdfRef.of(objNum, entry.generationNumber);
            this.registry.registerWithRef(ref, obj);
          }
        } catch {
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
      const height = this.getMediaBoxDimension(mediaBox, 3) - this.getMediaBoxDimension(mediaBox, 1);

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
  private scanMaxResourceIndex(
    resources: PdfDict,
    subKey: string,
    prefix: string,
  ): number {
    const subObj = resources.get(subKey);
    if (subObj === undefined || subObj.kind !== 'dict') return 0;

    const subDict = subObj as PdfDict;
    // Use iterator helpers to find the max resource index
    return Iterator.from(subDict)
      .map(([key]) => {
        // Keys are stored with '/' prefix: "/F1", "/Im2", etc.
        const name = key.startsWith('/') ? key.substring(1) : key;
        if (name.startsWith(prefix)) {
          const num = parseInt(name.substring(prefix.length), 10);
          return isNaN(num) ? 0 : num;
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
    s = s.substring(2);
  }

  // Match the components:
  // YYYY (required), MM, DD, HH, mm, SS, timezone
  const match = s.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+\-])?(\d{2})?'?(\d{2})?/,
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
// Synchronous PNG predictor (used in object stream decompression)
// ---------------------------------------------------------------------------

/**
 * Undo PNG-style row prediction synchronously.
 * Same logic as in xrefParser but duplicated here to avoid async dependency.
 */
function undoPngPredictorSync(data: Uint8Array, columns: number): Uint8Array {
  const rowBytes = columns;
  const srcRowLen = rowBytes + 1;
  const rows = Math.floor(data.length / srcRowLen);
  const result = new Uint8Array(rows * rowBytes);
  const prevRow = new Uint8Array(rowBytes);

  for (let r = 0; r < rows; r++) {
    const srcOff = r * srcRowLen;
    const dstOff = r * rowBytes;
    const filterType = data[srcOff] ?? 0;

    switch (filterType) {
      case 0: // None
        for (let i = 0; i < rowBytes; i++) {
          result[dstOff + i] = data[srcOff + 1 + i] ?? 0;
        }
        break;

      case 1: // Sub
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const left = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0;
          result[dstOff + i] = (raw + left) & 0xff;
        }
        break;

      case 2: // Up
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const up = prevRow[i] ?? 0;
          result[dstOff + i] = (raw + up) & 0xff;
        }
        break;

      case 3: // Average
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const left = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0;
          const up = prevRow[i] ?? 0;
          result[dstOff + i] = (raw + Math.floor((left + up) / 2)) & 0xff;
        }
        break;

      case 4: // Paeth
        for (let i = 0; i < rowBytes; i++) {
          const raw = data[srcOff + 1 + i] ?? 0;
          const a = i > 0 ? (result[dstOff + i - 1] ?? 0) : 0;
          const b = prevRow[i] ?? 0;
          const c = i > 0 ? (prevRow[i - 1] ?? 0) : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          result[dstOff + i] = (raw + pr) & 0xff;
        }
        break;

      default:
        for (let i = 0; i < rowBytes; i++) {
          result[dstOff + i] = data[srcOff + 1 + i] ?? 0;
        }
        break;
    }

    for (let i = 0; i < rowBytes; i++) {
      prevRow[i] = result[dstOff + i] ?? 0;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Static load helper (standalone, to be integrated into PdfDocument later)
// ---------------------------------------------------------------------------

/**
 * Load a PDF document from raw bytes, an ArrayBuffer, or a Base64-encoded
 * string.
 *
 * This is the primary entry point for parsing existing PDFs. It creates
 * a {@link PdfDocumentParser}, runs the full parse pipeline, and returns
 * a populated {@link PdfDocument}.
 *
 * @param data     The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
 *                 Base64-encoded string.
 * @param options  Optional loading options.
 * @returns        A fully parsed PdfDocument.
 *
 * @example
 * ```ts
 * import { loadPdf } from 'modern-pdf';
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

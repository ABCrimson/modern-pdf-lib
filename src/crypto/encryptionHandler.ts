/**
 * @module crypto/encryptionHandler
 *
 * Standard PDF security handler — encrypts and decrypts individual
 * PDF objects per the standard security handler specification.
 *
 * Supports all four encryption levels:
 * - V=1 R=2: 40-bit RC4
 * - V=2 R=3: 128-bit RC4
 * - V=4 R=4: 128-bit AES-CBC
 * - V=5 R=6: 256-bit AES-CBC (ISO 32000-2); revision 5 files are read, never written
 *
 * The handler manages:
 * - Per-object key derivation (V=1-4)
 * - Object encryption/decryption
 * - Crypt filters on the read side (V=4-5): `/StmF`, `/StrF` and `/EFF` name a `/CF` entry
 *   (`/CFM` `/None`, `/V2`, `/AESV2` or `/AESV3`) or `/Identity`, and a stream's own `/Crypt`
 *   filter names one the same way
 * - Building the /Encrypt dictionary for the PDF trailer
 * - Password verification and file key computation
 *
 * Reference: PDF 1.7 spec SS7.6, ISO 32000-1 SS7.6, ISO 32000-2 SS7.6.
 */

import { PdfDict, PdfName, PdfNumber, PdfString, PdfBool } from '../core/pdfObjects.js';
import { md5 } from './md5.js';
import { rc4 } from './rc4.js';
import { aesEncryptCBC, aesDecryptCBC } from './aes.js';
import { encodePermissions, decodePermissions } from './permissions.js';
import type { PdfPermissionFlags } from './permissions.js';
import {
  computeEncryptionKeyR2R4,
  computeOwnerPasswordValue,
  computeUserPasswordHash,
  deriveFileEncryptionKey,
  generateUserKeyV5,
  generateOwnerKeyV5,
  generatePermsV5,
} from './keyDerivation.js';
import type { EncryptDictValues } from './keyDerivation.js';
import { warnOnce } from '../internal/warnings.js';
import { MalformedInputError, UnsupportedEncryptionError } from '../errors.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Algorithm selection for new encryption.
 */
export type EncryptAlgorithm = 'rc4-40' | 'rc4-128' | 'aes-128' | 'aes-256';

/**
 * Options for encrypting a PDF document.
 */
export interface EncryptOptions {
  /**
   * The user password (may be empty string for open access).
   *
   * With `algorithm: 'aes-256'` the password is prepared with SASLprep (ISO 32000-2) and cut
   * to 127 UTF-8 bytes. A password that SASLprep changes (compatibility characters such as
   * ligatures or fullwidth letters, a soft hyphen, non-ASCII spaces, text not in NFC) opens in
   * qpdf only in its prepared form (pdf.js accepts most such passwords as typed too, but not one
   * with a zero-width space); NFC text without such characters opens as typed everywhere.
   */
  userPassword: string;
  /**
   * The owner password (restricts editing). Prepared like {@link EncryptOptions.userPassword}
   * for `algorithm: 'aes-256'`.
   */
  ownerPassword: string;
  /** Permission flags. */
  permissions?: PdfPermissionFlags | undefined;
  /** Encryption algorithm. Default: `'aes-128'`. */
  algorithm?: EncryptAlgorithm | undefined;
}

/**
 * The warning a document opened through the legacy AES-256 key derivation emits, once per realm.
 */
const LEGACY_R6_WARNING =
  'The AES-256 key of this document was derived the way modern-pdf-lib 0.26.0 to 0.40.8 wrote it, ' +
  'which other PDF software does not accept. Call encrypt() and save to write it with the ' +
  'standard derivation.';

// ---------------------------------------------------------------------------
// Crypt filters
// ---------------------------------------------------------------------------

/** What a crypt filter does to the data: nothing, RC4, or AES-CBC with a leading IV. */
type CryptMethod = 'none' | 'rc4' | 'aes';

/** The crypt filters of a handler: the methods by filter name and the default filter names. */
interface CryptFilters {
  /** Methods keyed by filter name with its slash (`/StdCF`); `/Identity` is not listed. */
  readonly methods: ReadonlyMap<string, CryptMethod>;
  /** The filter of streams (`/StmF`). */
  readonly stream: string;
  /** The filter of strings (`/StrF`). */
  readonly string: string;
  /** The filter of embedded file streams (`/EFF`, else `/StmF`). */
  readonly embeddedFile: string;
}

/** The one filter of a handler that applies the same method to everything (V=1-2, and writing). */
function singleFilter(useAes: boolean): CryptFilters {
  return {
    methods: new Map([['/StdCF', useAes ? 'aes' : 'rc4']]),
    stream: '/StdCF',
    string: '/StdCF',
    embeddedFile: '/StdCF',
  };
}

/**
 * Read `/CF`, `/StmF`, `/StrF` and `/EFF` of a V=4 or V=5 dictionary.
 *
 * An absent `/StmF` or `/StrF` is `/Identity`, and an absent `/EFF` is the `/StmF` filter
 * (ISO 32000-2, 7.6.6). An absent `/CFM` is `/None`.
 *
 * @throws {UnsupportedEncryptionError} For a `/CFM` other than `/None`, `/V2`, `/AESV2` and
 *         `/AESV3`, and for a filter name that names no `/CF` entry and is not `/Identity`.
 */
function readCryptFilters(dict: PdfDict): CryptFilters {
  const methods = new Map<string, CryptMethod>();
  const cf = dict.get('/CF');
  if (cf?.kind === 'dict') {
    for (const [name, entry] of cf as PdfDict) {
      if (entry.kind !== 'dict') continue;
      const cfm = (entry as PdfDict).get('/CFM');
      const method = cfm?.kind === 'name' ? (cfm as PdfName).value : '/None';
      switch (method) {
        case '/None':
          methods.set(name, 'none');
          break;
        case '/V2':
          methods.set(name, 'rc4');
          break;
        case '/AESV2':
        case '/AESV3':
          methods.set(name, 'aes');
          break;
        default:
          throw new UnsupportedEncryptionError(
            `The crypt filter ${name} uses the method ${method}, which is not supported; ` +
              'the supported methods are /None, /V2, /AESV2 and /AESV3.',
          );
      }
    }
  }
  const nameOf = (key: string): string | undefined => {
    const value = dict.get(key);
    return value?.kind === 'name' ? (value as PdfName).value : undefined;
  };
  const stream = nameOf('/StmF') ?? '/Identity';
  const filters: CryptFilters = {
    methods,
    stream,
    string: nameOf('/StrF') ?? '/Identity',
    embeddedFile: nameOf('/EFF') ?? stream,
  };
  for (const [key, name] of [
    ['/StmF', filters.stream],
    ['/StrF', filters.string],
    ['/EFF', filters.embeddedFile],
  ] as const) {
    if (name !== '/Identity' && !methods.has(name)) {
      throw new UnsupportedEncryptionError(
        `The ${key} crypt filter ${name} is not defined in /CF of the /Encrypt dictionary.`,
      );
    }
  }
  return filters;
}

// ---------------------------------------------------------------------------
// Algorithm parameters
// ---------------------------------------------------------------------------

interface AlgorithmParams {
  version: number; // /V
  revision: number; // /R
  keyLength: number; // in bits
  useAes: boolean;
}

function getAlgorithmParams(algorithm: EncryptAlgorithm): AlgorithmParams {
  switch (algorithm) {
    case 'rc4-40':
      return { version: 1, revision: 2, keyLength: 40, useAes: false };
    case 'rc4-128':
      return { version: 2, revision: 3, keyLength: 128, useAes: false };
    case 'aes-128':
      return { version: 4, revision: 4, keyLength: 128, useAes: true };
    case 'aes-256':
      return { version: 5, revision: 6, keyLength: 256, useAes: true };
  }
}

// ---------------------------------------------------------------------------
// PdfEncryptionHandler
// ---------------------------------------------------------------------------

/**
 * The crypt filters of each handler. Kept outside the class, with
 * {@link otherObjectKeyCaches}, so that the class declares the same members it declared before
 * crypt filters were read.
 */
const handlerFilters = new WeakMap<PdfEncryptionHandler, CryptFilters>();

/**
 * Per handler, the per-object key cache of the method the handler's own method is not (keys
 * with "sAlT" when the handler uses RC4, without it when it uses AES), for crypt filters that
 * mix RC4 and AES. Keyed like the handler's own cache.
 */
const otherObjectKeyCaches = new WeakMap<PdfEncryptionHandler, Map<number, Uint8Array>>();

/** The crypt filters of `handler` (set by its constructor). */
function filtersOf(handler: PdfEncryptionHandler): CryptFilters {
  return handlerFilters.get(handler) ?? singleFilter(handler.isAes());
}

/** The other-method key cache of `handler`, made on first use. */
function otherObjectKeyCache(handler: PdfEncryptionHandler): Map<number, Uint8Array> {
  let cache = otherObjectKeyCaches.get(handler);
  if (cache === undefined) {
    cache = new Map();
    otherObjectKeyCaches.set(handler, cache);
  }
  return cache;
}

/**
 * Handles encryption and decryption of PDF objects according to the
 * standard security handler.
 *
 * Create via:
 * - `PdfEncryptionHandler.create(options)` for new encryption
 * - `PdfEncryptionHandler.fromEncryptDict(dict, fileId, password)` for existing
 */
export class PdfEncryptionHandler {
  /** The file-level encryption key. */
  private readonly fileKey: Uint8Array;

  /** Algorithm version (/V). */
  private readonly version: number;

  /** Security handler revision (/R). */
  private readonly revision: number;

  /** Key length in bits. */
  private readonly keyLengthBits: number;

  /** Whether to use AES (true) or RC4 (false). */
  private readonly useAes: boolean;

  /** Whether to encrypt the /Metadata stream. */
  private readonly encryptMetadata: boolean;

  /** Permission flags as a 32-bit integer. */
  private readonly permissionsValue: number;

  /** Owner key (/O). */
  private readonly ownerKey: Uint8Array;

  /** User key (/U). */
  private readonly userKey: Uint8Array;

  /** Owner encryption key (/OE, V=5 only). */
  private readonly ownerEncryptionKey?: Uint8Array | undefined;

  /** User encryption key (/UE, V=5 only). */
  private readonly userEncryptionKey?: Uint8Array | undefined;

  /** Encrypted permissions (/Perms, V=5 only). */
  private readonly perms?: Uint8Array | undefined;

  /** The file ID (first element of /ID array). */
  private readonly fileId: Uint8Array;

  /**
   * Cache for per-object derived keys (V=1-4 only).
   * Key: `(objNum & 0xffffff) * 0x10000 + (genNum & 0xffff)`, the exact integer of the
   * 3-byte object number and 2-byte generation number that the key derivation hashes.
   * Value: the derived encryption key.
   *
   * Avoids recomputing MD5(fileKey + objNum + genNum [+ sAlT]) for
   * every string and stream in the same object.
   */
  private readonly objectKeyCache = new Map<number, Uint8Array>();

  private constructor(params: {
    fileKey: Uint8Array;
    version: number;
    revision: number;
    keyLengthBits: number;
    useAes: boolean;
    encryptMetadata: boolean;
    permissionsValue: number;
    ownerKey: Uint8Array;
    userKey: Uint8Array;
    ownerEncryptionKey?: Uint8Array | undefined;
    userEncryptionKey?: Uint8Array | undefined;
    perms?: Uint8Array | undefined;
    fileId: Uint8Array;
    filters?: CryptFilters | undefined;
  }) {
    this.fileKey = params.fileKey;
    this.version = params.version;
    this.revision = params.revision;
    this.keyLengthBits = params.keyLengthBits;
    this.useAes = params.useAes;
    this.encryptMetadata = params.encryptMetadata;
    this.permissionsValue = params.permissionsValue;
    this.ownerKey = params.ownerKey;
    this.userKey = params.userKey;
    this.ownerEncryptionKey = params.ownerEncryptionKey;
    this.userEncryptionKey = params.userEncryptionKey;
    this.perms = params.perms;
    this.fileId = params.fileId;
    handlerFilters.set(this, params.filters ?? singleFilter(params.useAes));
  }

  // -----------------------------------------------------------------------
  // Factory: create new encryption
  // -----------------------------------------------------------------------

  /**
   * Create a new encryption handler for encrypting a document.
   *
   * Generates all necessary keys and values for the /Encrypt dictionary.
   *
   * @param options  Encryption options.
   * @param fileId   Optional file ID. If omitted, a random one is generated.
   * @returns        A configured PdfEncryptionHandler.
   */
  static async create(options: EncryptOptions, fileId?: Uint8Array): Promise<PdfEncryptionHandler> {
    const algorithm = options.algorithm ?? 'aes-128';
    const params = getAlgorithmParams(algorithm);
    const permFlags = options.permissions ?? {};
    const permissionsValue = encodePermissions(permFlags);
    const encryptMetadata = true;

    // Generate or use provided file ID
    const fid = fileId ?? generateFileId();

    if (params.version === 5) {
      // AES-256 (V=5, R=6)
      // Generate random 32-byte file encryption key
      const fileKey = new Uint8Array(32);
      globalThis.crypto.getRandomValues(fileKey);

      // Generate /U, /UE
      const { userKey, userEncryptionKey } = await generateUserKeyV5(
        options.userPassword,
        fileKey,
        params.revision,
      );

      // Generate /O, /OE
      const { ownerKey, ownerEncryptionKey } = await generateOwnerKeyV5(
        options.ownerPassword,
        fileKey,
        userKey,
        params.revision,
      );

      // Generate /Perms
      const perms = await generatePermsV5(fileKey, permissionsValue, encryptMetadata);

      return new PdfEncryptionHandler({
        fileKey,
        version: params.version,
        revision: params.revision,
        keyLengthBits: params.keyLength,
        useAes: params.useAes,
        encryptMetadata,
        permissionsValue,
        ownerKey,
        userKey,
        ownerEncryptionKey,
        userEncryptionKey,
        perms,
        fileId: fid,
      });
    }

    // V=1-4 (RC4 or AES-128)
    // Compute /O value
    const ownerKey = computeOwnerPasswordValue(
      options.ownerPassword,
      options.userPassword,
      params.revision,
      params.keyLength,
    );

    // Build temporary dict values for key derivation
    const dictValues: EncryptDictValues = {
      version: params.version,
      revision: params.revision,
      keyLength: params.keyLength,
      ownerKey,
      userKey: new Uint8Array(32), // placeholder
      permissions: permissionsValue,
      encryptMetadata,
    };

    // Compute file encryption key
    const fileKey = computeEncryptionKeyR2R4(options.userPassword, dictValues, fid);

    // Compute /U value
    const userKey = computeUserPasswordHash(options.userPassword, dictValues, fid);

    return new PdfEncryptionHandler({
      fileKey,
      version: params.version,
      revision: params.revision,
      keyLengthBits: params.keyLength,
      useAes: params.useAes,
      encryptMetadata,
      permissionsValue,
      ownerKey,
      userKey,
      fileId: fid,
    });
  }

  // -----------------------------------------------------------------------
  // Factory: load from existing encryption dictionary
  // -----------------------------------------------------------------------

  /**
   * Create an encryption handler from an existing /Encrypt dictionary.
   *
   * @param dict      The /Encrypt dictionary from the PDF trailer.
   * @param fileId    The first element of the /ID array.
   * @param password  The password to try (user or owner).
   * @returns         A configured PdfEncryptionHandler.
   * @throws {UnsupportedEncryptionError} Before any password is tried, when `/Filter` is not
   *         `/Standard`, `/V` is not 1, 2, 4 or 5, a `/CF` entry has a `/CFM` other than
   *         `/None`, `/V2`, `/AESV2` and `/AESV3`, or `/StmF`, `/StrF` or `/EFF` names no `/CF`
   *         entry and is not `/Identity`.
   * @throws {MalformedInputError} Before any password is tried, when `/O` or `/U` is missing.
   * @throws {EncryptedPdfError} With reason `'incorrect-password'` when the password opens
   *         neither the user nor the owner entry.
   */
  static async fromEncryptDict(
    dict: PdfDict,
    fileId: Uint8Array,
    password: string,
  ): Promise<PdfEncryptionHandler> {
    const handlerName = dict.get('/Filter');
    if (handlerName?.kind !== 'name' || (handlerName as PdfName).value !== '/Standard') {
      throw new UnsupportedEncryptionError(
        `The security handler ${handlerName?.kind === 'name' ? (handlerName as PdfName).value : '(none)'} ` +
          'is not supported; only the standard security handler (/Standard) is.',
      );
    }

    // Extract values from the dictionary
    const version = getNumber(dict, '/V') ?? 0;
    if (version !== 1 && version !== 2 && version !== 4 && version !== 5) {
      throw new UnsupportedEncryptionError(
        `The encryption algorithm /V ${version} is not supported; /V 1, 2, 4 and 5 are.`,
      );
    }
    const filters = version >= 4 ? readCryptFilters(dict) : singleFilter(false);
    const revision = getNumber(dict, '/R') ?? 0;
    const keyLength = getNumber(dict, '/Length') ?? 40;
    const permissions = getNumber(dict, '/P') ?? 0;

    const ownerKey = getStringBytes(dict, '/O');
    const userKey = getStringBytes(dict, '/U');

    if (!ownerKey || !userKey) {
      throw new MalformedInputError('Invalid /Encrypt dictionary: missing /O or /U values', {
        format: 'pdf',
      });
    }

    const encryptMetadata = getBool(dict, '/EncryptMetadata') ?? true;

    // AES for V=5, and for V=4 when the stream or string filter is AES. The crypt filters
    // choose the method of each string and stream; this flag is the method of decryptObject.
    const useAes =
      version === 5 ||
      (version === 4 &&
        (filters.methods.get(filters.stream) === 'aes' ||
          filters.methods.get(filters.string) === 'aes'));

    // V=5 specific values
    let ownerEncryptionKey: Uint8Array | undefined;
    let userEncryptionKey: Uint8Array | undefined;
    let perms: Uint8Array | undefined;

    if (version === 5) {
      ownerEncryptionKey = getStringBytes(dict, '/OE');
      userEncryptionKey = getStringBytes(dict, '/UE');
      perms = getStringBytes(dict, '/Perms');
    }

    const dictValues: EncryptDictValues = {
      version,
      revision,
      keyLength,
      ownerKey,
      userKey,
      permissions,
      ownerEncryptionKey,
      userEncryptionKey,
      perms,
      encryptMetadata,
    };

    // Compute the file encryption key. An R=6 file whose password matches only the legacy
    // derivation opens, with one warning per realm; the handler writes nothing back.
    const { fileKey, derivation } = await deriveFileEncryptionKey(password, dictValues, fileId);
    if (derivation === 'legacy') {
      warnOnce('legacy-r6-key', 'MPL_LEGACY_R6_KEY', LEGACY_R6_WARNING);
    }

    return new PdfEncryptionHandler({
      fileKey,
      version,
      revision,
      keyLengthBits: keyLength,
      useAes,
      encryptMetadata,
      permissionsValue: permissions,
      ownerKey,
      userKey,
      ownerEncryptionKey,
      userEncryptionKey,
      perms,
      fileId,
      filters,
    });
  }

  // -----------------------------------------------------------------------
  // Per-object key derivation (V=1-4)
  // -----------------------------------------------------------------------

  /**
   * Derive the per-object encryption key for V=1-4.
   *
   * Per the spec: MD5(fileKey + objNum(3LE) + genNum(2LE) [+ "sAlT" for AES])
   * Truncated to min(keyLength/8 + 5, 16) bytes.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param aes     Derive the AES key ("sAlT" appended); defaults to the handler's method.
   * @returns       The per-object key.
   */
  private deriveObjectKey(objNum: number, genNum: number, aes = this.useAes): Uint8Array {
    if (this.version === 5) {
      // V=5: no per-object key derivation; use file key directly
      return this.fileKey;
    }

    // Check cache first. The key is the exact integer of the bytes Algorithm 1 hashes (3 bytes
    // of objNum, 2 of genNum), below 2^40, so two pairs share an entry only when they share a key.
    const cache = aes === this.useAes ? this.objectKeyCache : otherObjectKeyCache(this);
    const cacheKey = (objNum & 0xffffff) * 0x10000 + (genNum & 0xffff);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Build input: fileKey + objNum(3 bytes LE) + genNum(2 bytes LE)
    const extra = aes ? 4 : 0; // "sAlT" for AES
    const input = new Uint8Array(this.fileKey.length + 5 + extra);
    input.set(this.fileKey, 0);

    let offset = this.fileKey.length;
    input[offset++] = objNum & 0xff;
    input[offset++] = (objNum >> 8) & 0xff;
    input[offset++] = (objNum >> 16) & 0xff;
    input[offset++] = genNum & 0xff;
    input[offset++] = (genNum >> 8) & 0xff;

    // Append "sAlT" for AES (V=4)
    if (aes) {
      input[offset++] = 0x73; // 's'
      input[offset++] = 0x41; // 'A'
      input[offset++] = 0x6c; // 'l'
      input[offset++] = 0x54; // 'T'
    }

    const hash = md5(input);

    // Truncate to min(keyLength/8 + 5, 16)
    const keyLen = Math.min(this.keyLengthBits / 8 + 5, 16);
    const key = hash.subarray(0, keyLen);

    // Cache for subsequent calls with the same object
    cache.set(cacheKey, key);
    return key;
  }

  // -----------------------------------------------------------------------
  // Encrypt / decrypt objects
  // -----------------------------------------------------------------------

  /**
   * Encrypt raw data for a specific object.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param data    Plaintext data.
   * @returns       Encrypted data.
   */
  async encryptObject(objNum: number, genNum: number, data: Uint8Array): Promise<Uint8Array> {
    const key = this.deriveObjectKey(objNum, genNum);

    if (this.useAes) {
      return aesEncryptCBC(key, data);
    }
    return rc4(key, data);
  }

  /**
   * Decrypt raw data for a specific object with the handler's method (AES when
   * {@link isAes}, else RC4), whatever the crypt filters say.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param data    Encrypted data.
   * @returns       Decrypted data.
   * @throws {UnsupportedEncryptionError} For AES data that is not a 16-byte IV followed by
   *         whole 16-byte blocks with valid padding.
   */
  async decryptObject(objNum: number, genNum: number, data: Uint8Array): Promise<Uint8Array> {
    return decryptWith(this, this.useAes ? 'aes' : 'rc4', objNum, genNum, data);
  }

  /**
   * Encrypt the bytes of a PdfString.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param str     The string to encrypt.
   * @returns       A PdfString of the encrypted bytes, in hex form.
   */
  async encryptString(objNum: number, genNum: number, str: PdfString): Promise<PdfString> {
    const encrypted = await this.encryptObject(objNum, genNum, str.toBytes());
    return PdfString.fromBytes(encrypted, 'hex');
  }

  /**
   * Decrypt a stream's data with the stream filter (`/StmF`); see {@link decryptStreamBytes}.
   *
   * @param objNum      Object number.
   * @param genNum      Generation number.
   * @param streamData  Encrypted stream bytes.
   * @returns           Decrypted stream bytes.
   */
  async decryptStream(objNum: number, genNum: number, streamData: Uint8Array): Promise<Uint8Array> {
    return decryptStreamBytes(this, objNum, genNum, streamData);
  }

  // -----------------------------------------------------------------------
  // Build /Encrypt dictionary
  // -----------------------------------------------------------------------

  /**
   * Build the /Encrypt dictionary for the PDF trailer.
   *
   * @returns  A PdfDict suitable for use as the /Encrypt entry.
   */
  buildEncryptDict(): PdfDict {
    const dict = new PdfDict();
    dict.set('/Filter', PdfName.of('Standard'));
    dict.set('/V', PdfNumber.of(this.version));
    dict.set('/R', PdfNumber.of(this.revision));
    dict.set('/P', PdfNumber.of(this.permissionsValue));

    // Key length (in bits)
    if (this.version >= 2) {
      dict.set('/Length', PdfNumber.of(this.keyLengthBits));
    }

    // /O and /U values
    dict.set('/O', PdfString.fromBytes(this.ownerKey, 'hex'));
    dict.set('/U', PdfString.fromBytes(this.userKey, 'hex'));

    if (this.version === 4) {
      // V=4: requires /CF, /StmF, /StrF
      const cfmName = this.useAes ? 'AESV2' : 'V2';

      const stdCF = new PdfDict();
      stdCF.set('/Type', PdfName.of('CryptFilter'));
      stdCF.set('/CFM', PdfName.of(cfmName));
      stdCF.set('/AuthEvent', PdfName.of('DocOpen'));
      stdCF.set('/Length', PdfNumber.of(this.keyLengthBits / 8));

      const cf = new PdfDict();
      cf.set('/StdCF', stdCF);

      dict.set('/CF', cf);
      dict.set('/StmF', PdfName.of('StdCF'));
      dict.set('/StrF', PdfName.of('StdCF'));

      if (!this.encryptMetadata) {
        dict.set('/EncryptMetadata', PdfBool.FALSE);
      }
    }

    if (this.version === 5) {
      // V=5: requires /CF, /StmF, /StrF, /OE, /UE, /Perms
      const stdCF = new PdfDict();
      stdCF.set('/Type', PdfName.of('CryptFilter'));
      stdCF.set('/CFM', PdfName.of('AESV3'));
      stdCF.set('/AuthEvent', PdfName.of('DocOpen'));
      stdCF.set('/Length', PdfNumber.of(32));

      const cf = new PdfDict();
      cf.set('/StdCF', stdCF);

      dict.set('/CF', cf);
      dict.set('/StmF', PdfName.of('StdCF'));
      dict.set('/StrF', PdfName.of('StdCF'));

      if (this.ownerEncryptionKey) {
        dict.set('/OE', PdfString.fromBytes(this.ownerEncryptionKey, 'hex'));
      }
      if (this.userEncryptionKey) {
        dict.set('/UE', PdfString.fromBytes(this.userEncryptionKey, 'hex'));
      }
      if (this.perms) {
        dict.set('/Perms', PdfString.fromBytes(this.perms, 'hex'));
      }

      if (!this.encryptMetadata) {
        dict.set('/EncryptMetadata', PdfBool.FALSE);
      }
    }

    return dict;
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** Get the permission flags. */
  getPermissions(): PdfPermissionFlags {
    return decodePermissions(this.permissionsValue);
  }

  /** Get the raw permissions value. */
  getPermissionsValue(): number {
    return this.permissionsValue;
  }

  /** Whether this handler uses AES (vs RC4). */
  isAes(): boolean {
    return this.useAes;
  }

  /** The algorithm version (/V). */
  getVersion(): number {
    return this.version;
  }

  /** The security handler revision (/R). */
  getRevision(): number {
    return this.revision;
  }

  /** The file encryption key (for testing/debugging). */
  getFileKey(): Uint8Array {
    return this.fileKey;
  }

  /** The file ID used for key derivation. */
  getFileId(): Uint8Array {
    return this.fileId;
  }

  /** Whether metadata streams are encrypted. */
  isMetadataEncrypted(): boolean {
    return this.encryptMetadata;
  }
}

// ---------------------------------------------------------------------------
// Decryption by crypt filter (the load path; no package entry exports these)
// ---------------------------------------------------------------------------

/**
 * Decrypt the bytes of a string of an object with the string filter (`/StrF`) of `handler`.
 *
 * @param handler  The handler of the document.
 * @param objNum   Object number.
 * @param genNum   Generation number.
 * @param data     The string's bytes as stored in the file.
 * @returns        The plaintext bytes; the input itself for the `/Identity` and `/None` filters.
 * @throws {UnsupportedEncryptionError} For AES data that cannot be decrypted (see
 *         {@link PdfEncryptionHandler.decryptObject}).
 */
export async function decryptStringBytes(
  handler: PdfEncryptionHandler,
  objNum: number,
  genNum: number,
  data: Uint8Array,
): Promise<Uint8Array> {
  const method = methodOf(handler, filtersOf(handler).string);
  return decryptWith(handler, method, objNum, genNum, data);
}

/**
 * Decrypt the data of a stream object with the stream filter (`/StmF`) of `handler`, or with
 * the crypt filter `filterName` names (a stream's own `/Crypt` filter, or
 * {@link embeddedFileFilterName} for an embedded file stream).
 *
 * @param handler     The handler of the document.
 * @param objNum      Object number.
 * @param genNum      Generation number.
 * @param data        The stream data as stored in the file.
 * @param filterName  A crypt filter name with its slash (`/Identity`, `/StdCF`).
 * @returns           The plaintext data; the input itself for `/Identity` and `/None`.
 * @throws {UnsupportedEncryptionError} When `filterName` names no `/CF` entry and is not
 *         `/Identity`, and for AES data that cannot be decrypted.
 */
export async function decryptStreamBytes(
  handler: PdfEncryptionHandler,
  objNum: number,
  genNum: number,
  data: Uint8Array,
  filterName?: string,
): Promise<Uint8Array> {
  const method = methodOf(handler, filterName ?? filtersOf(handler).stream);
  return decryptWith(handler, method, objNum, genNum, data);
}

/** The crypt filter name of embedded file streams (`/EFF`, else `/StmF`) of `handler`, with its slash. */
export function embeddedFileFilterName(handler: PdfEncryptionHandler): string {
  return filtersOf(handler).embeddedFile;
}

/** The method of the crypt filter `name` of `handler`; `/Identity` is no decryption. */
function methodOf(handler: PdfEncryptionHandler, name: string): CryptMethod {
  if (name === '/Identity') return 'none';
  const method = filtersOf(handler).methods.get(name);
  if (method === undefined) {
    throw new UnsupportedEncryptionError(
      `The crypt filter ${name} is not defined in /CF of the /Encrypt dictionary.`,
    );
  }
  return method;
}

/**
 * Decrypt `data` of object `objNum` `genNum` with `method`, with the per-object key of
 * `handler`.
 *
 * AES data is a 16-byte IV followed by whole blocks with padding: the IV alone is the empty
 * string, and any other length, or wrong padding, cannot be decrypted.
 */
async function decryptWith(
  handler: PdfEncryptionHandler,
  method: CryptMethod,
  objNum: number,
  genNum: number,
  data: Uint8Array,
): Promise<Uint8Array> {
  if (method === 'none') return data;
  // The per-object key derivation is a private method of the class; element access reaches it
  // without adding a member to the class's declared surface.
  const objectKey = (aes: boolean): Uint8Array => handler['deriveObjectKey'](objNum, genNum, aes);
  if (method === 'rc4') return rc4(objectKey(false), data);
  if (data.length === 16) return new Uint8Array(0);
  if (data.length < 32 || data.length % 16 !== 0) {
    throw new UnsupportedEncryptionError(
      `The AES data of object ${objNum} ${genNum} cannot be decrypted: ${data.length} bytes ` +
        'is not a 16-byte IV followed by whole 16-byte blocks.',
    );
  }
  try {
    return await aesDecryptCBC(objectKey(true), data);
  } catch (err) {
    throw new UnsupportedEncryptionError(
      `The AES data of object ${objNum} ${genNum} cannot be decrypted (wrong padding).`,
      { cause: err },
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random 16-byte file ID.
 */
function generateFileId(): Uint8Array {
  const id = new Uint8Array(16);
  globalThis.crypto.getRandomValues(id);
  return id;
}

/**
 * Extract a number from a PdfDict entry.
 */
function getNumber(dict: PdfDict, key: string): number | undefined {
  const obj = dict.get(key);
  if (obj?.kind === 'number') {
    return (obj as PdfNumber).value;
  }
  return undefined;
}

/**
 * Extract a boolean from a PdfDict entry.
 */
function getBool(dict: PdfDict, key: string): boolean | undefined {
  const obj = dict.get(key);
  if (obj?.kind === 'bool') {
    return (obj as PdfBool).value;
  }
  return undefined;
}

/**
 * The bytes of a PdfString entry in a dict, whatever its written form.
 */
function getStringBytes(dict: PdfDict, key: string): Uint8Array | undefined {
  const obj = dict.get(key);
  return obj?.kind === 'string' ? obj.toBytes() : undefined;
}

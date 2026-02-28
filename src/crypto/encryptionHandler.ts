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
 * - V=5 R=6: 256-bit AES-CBC (ISO 32000-2)
 *
 * The handler manages:
 * - Per-object key derivation (V=1-4)
 * - Object encryption/decryption
 * - Building the /Encrypt dictionary for the PDF trailer
 * - Password verification and file key computation
 *
 * Reference: PDF 1.7 spec SS7.6, ISO 32000-1 SS7.6, ISO 32000-2 SS7.6.
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfBool,
} from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';
import { md5 } from './md5.js';
import { rc4 } from './rc4.js';
import { aesEncryptCBC, aesDecryptCBC } from './aes.js';
import { encodePermissions, decodePermissions } from './permissions.js';
import type { PdfPermissionFlags } from './permissions.js';
import {
  computeEncryptionKeyR2R4,
  computeOwnerPasswordValue,
  computeUserPasswordHash,
  computeFileEncryptionKey,
  generateUserKeyV5,
  generateOwnerKeyV5,
  generatePermsV5,
  concat,
  int32LE,
} from './keyDerivation.js';
import type { EncryptDictValues } from './keyDerivation.js';

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
  /** The user password (may be empty string for open access). */
  userPassword: string;
  /** The owner password (restricts editing). */
  ownerPassword: string;
  /** Permission flags. */
  permissions?: PdfPermissionFlags | undefined;
  /** Encryption algorithm. Default: `'aes-128'`. */
  algorithm?: EncryptAlgorithm | undefined;
}

// ---------------------------------------------------------------------------
// Algorithm parameters
// ---------------------------------------------------------------------------

interface AlgorithmParams {
  version: number;   // /V
  revision: number;  // /R
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
   * Key: `(objNum << 16) | genNum` — unique integer per object.
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
  static async create(
    options: EncryptOptions,
    fileId?: Uint8Array | undefined,
  ): Promise<PdfEncryptionHandler> {
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
    const fileKey = computeEncryptionKeyR2R4(
      options.userPassword,
      dictValues,
      fid,
    );

    // Compute /U value
    const userKey = computeUserPasswordHash(
      options.userPassword,
      dictValues,
      fid,
    );

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
   * @throws          If the password is incorrect or the dict is invalid.
   */
  static async fromEncryptDict(
    dict: PdfDict,
    fileId: Uint8Array,
    password: string,
  ): Promise<PdfEncryptionHandler> {
    // Extract values from the dictionary
    const version = getNumber(dict, '/V') ?? 0;
    const revision = getNumber(dict, '/R') ?? 0;
    const keyLength = getNumber(dict, '/Length') ?? 40;
    const permissions = getNumber(dict, '/P') ?? 0;

    const ownerKey = getStringBytes(dict, '/O');
    const userKey = getStringBytes(dict, '/U');

    if (!ownerKey || !userKey) {
      throw new Error('Invalid /Encrypt dictionary: missing /O or /U values');
    }

    const encryptMetadata = getBool(dict, '/EncryptMetadata') ?? true;

    // Determine if AES is used
    let useAes = false;
    if (version === 4) {
      // Check /CF -> /StdCF -> /CFM for AESV2
      const cf = dict.get('/CF');
      if (cf?.kind === 'dict') {
        const stdCF = (cf as PdfDict).get('/StdCF');
        if (stdCF?.kind === 'dict') {
          const cfm = (stdCF as PdfDict).get('/CFM');
          if (cfm?.kind === 'name' && (cfm as PdfName).value === '/AESV2') {
            useAes = true;
          }
        }
      }
    } else if (version === 5) {
      useAes = true;
    }

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

    // Compute the file encryption key
    const fileKey = await computeFileEncryptionKey(password, dictValues, fileId);

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
   * @returns       The per-object key.
   */
  private deriveObjectKey(objNum: number, genNum: number): Uint8Array {
    if (this.version === 5) {
      // V=5: no per-object key derivation; use file key directly
      return this.fileKey;
    }

    // Check cache first — same (objNum, genNum) always yields the same key
    const cacheKey = (objNum << 16) | genNum;
    const cached = this.objectKeyCache.get(cacheKey);
    if (cached) return cached;

    // Build input: fileKey + objNum(3 bytes LE) + genNum(2 bytes LE)
    const extra = this.useAes ? 4 : 0; // "sAlT" for AES
    const input = new Uint8Array(this.fileKey.length + 5 + extra);
    input.set(this.fileKey, 0);

    let offset = this.fileKey.length;
    input[offset++] = objNum & 0xff;
    input[offset++] = (objNum >> 8) & 0xff;
    input[offset++] = (objNum >> 16) & 0xff;
    input[offset++] = genNum & 0xff;
    input[offset++] = (genNum >> 8) & 0xff;

    // Append "sAlT" for AES (V=4)
    if (this.useAes) {
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
    this.objectKeyCache.set(cacheKey, key);
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
  async encryptObject(
    objNum: number,
    genNum: number,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    const key = this.deriveObjectKey(objNum, genNum);

    if (this.useAes) {
      return aesEncryptCBC(key, data);
    }
    return rc4(key, data);
  }

  /**
   * Decrypt raw data for a specific object.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param data    Encrypted data.
   * @returns       Decrypted data.
   */
  async decryptObject(
    objNum: number,
    genNum: number,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    const key = this.deriveObjectKey(objNum, genNum);

    if (this.useAes) {
      // For AES, data must be at least 32 bytes (IV + one block)
      if (data.length < 32) return data; // Not encrypted or corrupted
      return aesDecryptCBC(key, data);
    }
    return rc4(key, data);
  }

  /**
   * Encrypt a PdfString value.
   *
   * Converts the string value to bytes, encrypts, and returns a new
   * hex-encoded PdfString.
   *
   * @param objNum  Object number.
   * @param genNum  Generation number.
   * @param str     The string to encrypt.
   * @returns       An encrypted PdfString (hex-encoded).
   */
  async encryptString(
    objNum: number,
    genNum: number,
    str: PdfString,
  ): Promise<PdfString> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(str.value);
    const encrypted = await this.encryptObject(objNum, genNum, plaintext);
    return PdfString.hexFromBytes(encrypted);
  }

  /**
   * Decrypt a stream's data.
   *
   * @param objNum      Object number.
   * @param genNum      Generation number.
   * @param streamData  Encrypted stream bytes.
   * @returns           Decrypted stream bytes.
   */
  async decryptStream(
    objNum: number,
    genNum: number,
    streamData: Uint8Array,
  ): Promise<Uint8Array> {
    return this.decryptObject(objNum, genNum, streamData);
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
    dict.set('/O', PdfString.hexFromBytes(this.ownerKey));
    dict.set('/U', PdfString.hexFromBytes(this.userKey));

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
        dict.set('/OE', PdfString.hexFromBytes(this.ownerEncryptionKey));
      }
      if (this.userEncryptionKey) {
        dict.set('/UE', PdfString.hexFromBytes(this.userEncryptionKey));
      }
      if (this.perms) {
        dict.set('/Perms', PdfString.hexFromBytes(this.perms));
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
 * Extract bytes from a PdfString entry in a dict.
 *
 * For hex strings, decodes the hex pairs to bytes.
 * For literal strings, encodes the character codes as bytes.
 */
function getStringBytes(dict: PdfDict, key: string): Uint8Array | undefined {
  const obj = dict.get(key);
  if (!obj || obj.kind !== 'string') return undefined;

  const str = obj as PdfString;
  if (str.hex && /^[\da-fA-F\s]*$/.test(str.value)) {
    // Hex string whose value is still raw hex digits (e.g. from
    // PdfString.hexFromBytes). Decode hex pairs to bytes.
    return hexToBytes(str.value);
  }

  // Literal string or a hex string whose value has already been decoded
  // by the parser (character codes represent raw bytes in Latin-1).
  const bytes = new Uint8Array(str.value.length);
  for (let i = 0; i < str.value.length; i++) {
    bytes[i] = str.value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Convert a hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  return Uint8Array.fromHex(clean.length % 2 === 0 ? clean : clean + '0');
}

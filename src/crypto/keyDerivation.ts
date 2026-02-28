/**
 * @module crypto/keyDerivation
 *
 * PDF encryption key derivation algorithms.
 *
 * Implements the standard security handler algorithms from the PDF spec:
 *
 * - **Algorithm 2** (V=1-4, R=2-4): MD5-based file encryption key
 * - **Algorithm 2.A** (V=5, R=5): SHA-256-based key for AES-256
 * - **Algorithm 2.B** (V=5, R=6): Extended SHA-256/384/512 round-based
 *   key derivation (ISO 32000-2)
 * - **Algorithms 3-13**: User/owner password computation and verification
 *
 * Reference: PDF 1.7 spec SS7.6.3, ISO 32000-1:2008 SS7.6.3,
 *            ISO 32000-2:2020 SS7.6.3.
 */

import { md5 } from './md5.js';
import { rc4 } from './rc4.js';
// Note: aesDecryptCBC is NOT used here -- V=5 key unwrapping uses
// aesDecryptCBCNoPad (without PKCS#7) because the wrapped keys are
// exactly 32 bytes with no padding.
import { sha256, sha384, sha512 } from './sha256.js';
import { encodePermissions } from './permissions.js';
import type { PdfPermissionFlags } from './permissions.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Padding string used in password-based key derivation (Algorithm 2).
 * This is defined in the PDF spec, Table 20.
 */
const PASSWORD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

// ---------------------------------------------------------------------------
// Helper: pad/truncate password to 32 bytes
// ---------------------------------------------------------------------------

/**
 * Pad or truncate a password to exactly 32 bytes per the PDF spec.
 *
 * If the password is shorter than 32 bytes, it is padded with bytes
 * from the standard padding string.  If longer, it is truncated.
 */
function padPassword(password: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(password);
  const result = new Uint8Array(32);

  const copyLen = Math.min(encoded.length, 32);
  result.set(encoded.subarray(0, copyLen));

  if (copyLen < 32) {
    result.set(PASSWORD_PADDING.subarray(0, 32 - copyLen), copyLen);
  }

  return result;
}

/**
 * Truncate a UTF-8 password to 127 bytes for R=5/R=6 (SASLprep would
 * be ideal but we approximate with simple truncation as most PDF
 * libraries do).
 */
function preparePasswordV5(password: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(password);
  return encoded.length > 127 ? encoded.subarray(0, 127) : encoded;
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const arr of arrays) totalLen += arr.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode a 32-bit integer as 4 little-endian bytes.
 */
function int32LE(value: number): Uint8Array {
  const result = new Uint8Array(4);
  result[0] = value & 0xff;
  result[1] = (value >>> 8) & 0xff;
  result[2] = (value >>> 16) & 0xff;
  result[3] = (value >>> 24) & 0xff;
  return result;
}

// ---------------------------------------------------------------------------
// Encrypt dictionary interface
// ---------------------------------------------------------------------------

/**
 * The subset of encryption dictionary values needed by key derivation.
 */
export interface EncryptDictValues {
  /** /V value: algorithm version (1, 2, 4, or 5). */
  version: number;
  /** /R value: revision number (2, 3, 4, 5, or 6). */
  revision: number;
  /** /Length value in bits (40-256, default 40). */
  keyLength: number;
  /** /O value: owner key (32 bytes for R<=4, 48 bytes for R>=5). */
  ownerKey: Uint8Array;
  /** /U value: user key (32 bytes for R<=4, 48 bytes for R>=5). */
  userKey: Uint8Array;
  /** /P value: permissions integer. */
  permissions: number;
  /** /OE value: owner encryption key (32 bytes, R>=5 only). */
  ownerEncryptionKey?: Uint8Array | undefined;
  /** /UE value: user encryption key (32 bytes, R>=5 only). */
  userEncryptionKey?: Uint8Array | undefined;
  /** /Perms value: encrypted permissions (16 bytes, R>=5 only). */
  perms?: Uint8Array | undefined;
  /** /EncryptMetadata: whether to encrypt the /Metadata stream. */
  encryptMetadata: boolean;
}

// ---------------------------------------------------------------------------
// Algorithm 2: Computing an encryption key (V=1-4, R=2-4)
// ---------------------------------------------------------------------------

/**
 * Compute the file encryption key for V=1-4 (R=2-4).
 *
 * This is Algorithm 2 from the PDF spec:
 * 1. Pad the password to 32 bytes
 * 2. MD5(password + O + P + fileId + [encryptMetadata flag for R>=4])
 * 3. If R >= 3, iterate MD5 50 times on the first `keyLength` bytes
 * 4. Return first `keyLength / 8` bytes
 *
 * @param password     User or owner password.
 * @param dict         Encryption dictionary values.
 * @param fileId       The first element of the /ID array.
 * @returns            The file encryption key.
 */
export function computeEncryptionKeyR2R4(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Uint8Array {
  const paddedPassword = padPassword(password);
  const keyByteLength = dict.keyLength / 8;

  // Step a-d: Concatenate password + O + P + fileId
  const pBytes = int32LE(dict.permissions);
  let input = concat(paddedPassword, dict.ownerKey, pBytes, fileId);

  // Step e: If R >= 4 and metadata is not encrypted, append 0xFFFFFFFF
  if (dict.revision >= 4 && !dict.encryptMetadata) {
    input = concat(input, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  }

  // Step f: MD5 hash
  let hash = md5(input);

  // Step g: If R >= 3, iterate MD5 50 times
  if (dict.revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, keyByteLength));
    }
  }

  // Step h: Return first keyByteLength bytes
  return hash.subarray(0, keyByteLength);
}

// ---------------------------------------------------------------------------
// Algorithm 3: Computing the /O (owner) value
// ---------------------------------------------------------------------------

/**
 * Compute the owner key (/O) value.
 *
 * Algorithm 3 from the PDF spec:
 * 1. MD5(padded owner password)
 * 2. If R >= 3, iterate MD5 50 times
 * 3. Use the hash (or first keyLength bytes) as an RC4 key
 * 4. RC4-encrypt the padded user password
 * 5. If R >= 3, do 19 additional RC4 passes with modified keys
 *
 * @param ownerPassword  The owner password.
 * @param userPassword   The user password.
 * @param revision       Revision number (2, 3, or 4).
 * @param keyLength      Key length in bits.
 * @returns              The 32-byte /O value.
 */
export function computeOwnerPasswordValue(
  ownerPassword: string,
  userPassword: string,
  revision: number,
  keyLength: number,
): Uint8Array {
  const keyByteLength = keyLength / 8;

  // Step a-c: MD5 of padded owner password
  let hash = md5(padPassword(ownerPassword));

  // Step d: If R >= 3, iterate MD5 50 times
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, keyByteLength));
    }
  }

  const rc4Key = hash.subarray(0, keyByteLength);

  // Step e: RC4-encrypt the padded user password
  let encrypted = rc4(rc4Key, padPassword(userPassword));

  // Step f: If R >= 3, do 19 additional RC4 passes
  if (revision >= 3) {
    const modKey = new Uint8Array(rc4Key.length);
    for (let i = 1; i <= 19; i++) {
      for (let j = 0; j < rc4Key.length; j++) {
        modKey[j] = (rc4Key[j]! ^ i) & 0xff;
      }
      encrypted = rc4(modKey, encrypted);
    }
  }

  return encrypted;
}

// ---------------------------------------------------------------------------
// Algorithm 4/5: Computing the /U (user) value
// ---------------------------------------------------------------------------

/**
 * Compute the user password hash (/U value) for R=2.
 *
 * Algorithm 4: RC4-encrypt the padding string with the file key.
 *
 * @param fileKey  The file encryption key (from Algorithm 2).
 * @returns        The 32-byte /U value.
 */
export function computeUserPasswordR2(fileKey: Uint8Array): Uint8Array {
  return rc4(fileKey, PASSWORD_PADDING);
}

/**
 * Compute the user password hash (/U value) for R=3/R=4.
 *
 * Algorithm 5:
 * 1. MD5(padding + fileId)
 * 2. RC4-encrypt the 16-byte hash with the file key
 * 3. Do 19 additional RC4 passes with modified keys
 * 4. Append 16 arbitrary bytes (we use zeros) to make 32 bytes
 *
 * @param fileKey  The file encryption key.
 * @param fileId   The first element of the /ID array.
 * @returns        The 32-byte /U value.
 */
export function computeUserPasswordR3R4(
  fileKey: Uint8Array,
  fileId: Uint8Array,
): Uint8Array {
  // Step a-b: MD5(padding + fileId)
  const hash = md5(concat(PASSWORD_PADDING, fileId));

  // Step c: RC4-encrypt the hash
  let encrypted = rc4(fileKey, hash);

  // Step d: 19 additional RC4 passes
  {
    const modKey = new Uint8Array(fileKey.length);
    for (let i = 1; i <= 19; i++) {
      for (let j = 0; j < fileKey.length; j++) {
        modKey[j] = (fileKey[j]! ^ i) & 0xff;
      }
      encrypted = rc4(modKey, encrypted);
    }
  }

  // Step e: The result is 16 bytes. Pad to 32 bytes with zeros.
  const result = new Uint8Array(32);
  result.set(encrypted.subarray(0, 16));
  return result;
}

/**
 * Compute the user password hash for any revision (2, 3, or 4).
 */
export function computeUserPasswordHash(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Uint8Array {
  const fileKey = computeEncryptionKeyR2R4(password, dict, fileId);
  if (dict.revision === 2) {
    return computeUserPasswordR2(fileKey);
  }
  return computeUserPasswordR3R4(fileKey, fileId);
}

// ---------------------------------------------------------------------------
// Algorithm 2.A: Computing the encryption key for R=5 (AES-256)
// ---------------------------------------------------------------------------

/**
 * Compute the file encryption key for V=5 R=5 (ISO 32000-1 extension).
 *
 * Algorithm 2.A:
 * 1. Compute SHA-256(password + validation salt + [owner key if owner])
 * 2. If hash matches /U or /O (first 32 bytes), this is the right password
 * 3. Compute SHA-256(password + key salt + [owner key if owner])
 * 4. Use that hash as AES-256 key to unwrap the /UE or /OE value
 *
 * @param password     The password to try.
 * @param dict         Encryption dictionary values.
 * @param isOwner      Whether to use the owner password path.
 * @returns            The 32-byte file encryption key, or null if password fails.
 */
export async function computeEncryptionKeyR5(
  password: string,
  dict: EncryptDictValues,
  isOwner: boolean,
): Promise<Uint8Array | null> {
  const pwd = preparePasswordV5(password);

  if (isOwner) {
    // Owner path: /O has 48 bytes: hash(32) + validationSalt(8) + keySalt(8)
    const oHash = dict.ownerKey.subarray(0, 32);
    const oValSalt = dict.ownerKey.subarray(32, 40);
    const oKeySalt = dict.ownerKey.subarray(40, 48);

    // Validate
    const testHash = await sha256(concat(pwd, oValSalt, dict.userKey));
    if (!arraysEqual(testHash, oHash)) return null;

    // Derive key
    const keyHash = await sha256(concat(pwd, oKeySalt, dict.userKey));
    const iv = new Uint8Array(16); // all zeros
    if (!dict.ownerEncryptionKey) return null;
    // AES-256-CBC decrypt /OE with zero IV (no PKCS#7 padding)
    return aesDecryptCBCNoPad(keyHash, iv, dict.ownerEncryptionKey);
  } else {
    // User path: /U has 48 bytes: hash(32) + validationSalt(8) + keySalt(8)
    const uHash = dict.userKey.subarray(0, 32);
    const uValSalt = dict.userKey.subarray(32, 40);
    const uKeySalt = dict.userKey.subarray(40, 48);

    // Validate
    const testHash = await sha256(concat(pwd, uValSalt));
    if (!arraysEqual(testHash, uHash)) return null;

    // Derive key
    const keyHash = await sha256(concat(pwd, uKeySalt));
    const iv = new Uint8Array(16);
    if (!dict.userEncryptionKey) return null;
    // AES-256-CBC decrypt /UE with zero IV (no PKCS#7 padding)
    return aesDecryptCBCNoPad(keyHash, iv, dict.userEncryptionKey);
  }
}

// ---------------------------------------------------------------------------
// Algorithm 2.B: Computing hash for R=6 (ISO 32000-2)
// ---------------------------------------------------------------------------

/**
 * Algorithm 2.B: compute hash for R=6 (extended key derivation).
 *
 * This is the iterative hash algorithm from ISO 32000-2 SS7.6.3.3.3.
 * It uses SHA-256, SHA-384, and SHA-512 in a round-based scheme with
 * AES-128-CBC encryption.
 *
 * @param password  The password bytes (max 127).
 * @param salt      8-byte salt (validation or key salt).
 * @param uKey      The /U value (48 bytes). Only needed for owner path.
 * @returns         A 32-byte hash.
 */
export async function algorithm2B(
  password: Uint8Array,
  salt: Uint8Array,
  uKey?: Uint8Array | undefined,
): Promise<Uint8Array> {
  // Step a: SHA-256(password + salt + uKey)
  const input = uKey ? concat(password, salt, uKey) : concat(password, salt);
  let K = await sha256(input);

  let round = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Step b.i: Build K1 = password + K + uKey, repeated 64 times
    const pLen = password.length;
    const kLen = K.length;
    const uLen = uKey ? uKey.length : 0;
    const blockLen = pLen + kLen + uLen;
    const K1 = new Uint8Array(blockLen * 64);
    for (let i = 0; i < 64; i++) {
      const base = i * blockLen;
      K1.set(password, base);
      K1.set(K, base + pLen);
      if (uKey) K1.set(uKey, base + pLen + kLen);
    }

    // Step b.ii: AES-128-CBC encrypt K1 with key=K[0..15], iv=K[16..31]
    const aesKey = K.subarray(0, 16);
    const aesIv = K.subarray(16, 32);
    const E = await aesEncryptCBCNoPad(aesKey, aesIv, K1);

    // Step b.iii: Determine hash based on first 16 bytes mod 3
    let bigModVal = 0;
    for (let i = 0; i < 16; i++) {
      bigModVal = (bigModVal * 256 + E[i]!) % 3;
    }

    let hashResult: Uint8Array;
    if (bigModVal === 0) {
      hashResult = await sha256(E);
    } else if (bigModVal === 1) {
      hashResult = await sha384(E);
    } else {
      hashResult = await sha512(E);
    }

    K = hashResult.subarray(0, 32);

    // Step b.iv: Check termination. After round 63, if the last byte
    // of E is <= round - 32, stop.
    if (round >= 63 && E.at(-1)! <= round - 32) {
      break;
    }
    round++;
  }

  return K.subarray(0, 32);
}

/**
 * AES-128-CBC encrypt without PKCS#7 padding (for Algorithm 2.B).
 * The data length must be a multiple of 16.
 */
async function aesEncryptCBCNoPad(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API not available');
  }

  // Ensure plain ArrayBuffer for Web Crypto API compatibility
  const keyBuf = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const dataBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

  // Import key
  const cryptoKey = await subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['encrypt']);

  // We need to avoid PKCS#7 padding added by Web Crypto.
  // Strategy: encrypt data that is already block-aligned, then strip the
  // final padding block that Web Crypto adds.
  const encrypted = await subtle.encrypt(
    { name: 'AES-CBC', iv: ivBuf },
    cryptoKey,
    dataBuf,
  );

  // Web Crypto adds one extra 16-byte block of PKCS#7 padding.
  // Remove it to get the raw CBC ciphertext.
  return new Uint8Array(encrypted, 0, data.length);
}

/**
 * AES-CBC decrypt without expecting PKCS#7 padding (for V=5 key unwrapping).
 * The data length must be a multiple of 16.  Used to decrypt the /UE and /OE
 * values which are exactly 32 bytes (no padding).
 */
async function aesDecryptCBCNoPad(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API not available');
  }

  const keyBuf = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;

  // Need both encrypt and decrypt: encrypt to create the padding block,
  // decrypt for the actual decryption.
  const cryptoKey = await subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['encrypt', 'decrypt']);

  // To avoid PKCS#7 unpadding issues, we add a fake padding block:
  // Append a 16-byte block that, when decrypted, will produce valid PKCS#7.
  // The simplest approach: encrypt a block of 0x10 (16 bytes of value 16)
  // using the last ciphertext block as IV, then append it.
  // But that's circular. Instead, just handle it manually:

  // Strategy: use a dummy padding block. We encrypt 16 bytes of PKCS#7
  // padding (0x10 repeated 16 times) in CBC mode using the last ciphertext
  // block as the IV. This creates a valid padded ciphertext.
  const lastBlock = data.subarray(data.length - 16);
  const paddingPlaintext = new Uint8Array(16).fill(16);
  // Encrypt padding block: CBC with IV = last ciphertext block
  const lastBlockBuf = lastBlock.buffer.slice(
    lastBlock.byteOffset,
    lastBlock.byteOffset + lastBlock.byteLength,
  ) as ArrayBuffer;
  const paddingEncrypted = await subtle.encrypt(
    { name: 'AES-CBC', iv: lastBlockBuf },
    cryptoKey,
    paddingPlaintext.buffer.slice(0) as ArrayBuffer,
  );
  // The result has the encrypted padding block (16 bytes) + another PKCS#7 block (16 bytes)
  const paddingBlock = new Uint8Array(paddingEncrypted, 0, 16);

  // Build combined ciphertext: original + padding block
  const combined = new Uint8Array(data.length + 16);
  combined.set(data, 0);
  combined.set(paddingBlock, data.length);

  const dataBuf = combined.buffer.slice(
    combined.byteOffset,
    combined.byteOffset + combined.byteLength,
  ) as ArrayBuffer;

  const decrypted = await subtle.decrypt(
    { name: 'AES-CBC', iv: ivBuf },
    cryptoKey,
    dataBuf,
  );

  // Return only the original data length (strip the decrypted padding block)
  return new Uint8Array(decrypted).subarray(0, data.length);
}

/**
 * Compute the file encryption key for V=5 R=6 (ISO 32000-2).
 *
 * @param password  The password to try.
 * @param dict      Encryption dictionary values.
 * @param isOwner   Whether to use the owner password path.
 * @returns         The 32-byte file encryption key, or null if password fails.
 */
export async function computeEncryptionKeyR6(
  password: string,
  dict: EncryptDictValues,
  isOwner: boolean,
): Promise<Uint8Array | null> {
  const pwd = preparePasswordV5(password);

  if (isOwner) {
    const oValSalt = dict.ownerKey.subarray(32, 40);
    const oKeySalt = dict.ownerKey.subarray(40, 48);

    // Validate using Algorithm 2.B
    const validationHash = await algorithm2B(pwd, oValSalt, dict.userKey);
    if (!arraysEqual(validationHash, dict.ownerKey.subarray(0, 32))) return null;

    // Derive file key using Algorithm 2.B with key salt
    const keyHash = await algorithm2B(pwd, oKeySalt, dict.userKey);
    if (!dict.ownerEncryptionKey) return null;
    const iv = new Uint8Array(16);
    return aesDecryptCBCNoPad(keyHash, iv, dict.ownerEncryptionKey);
  } else {
    const uValSalt = dict.userKey.subarray(32, 40);
    const uKeySalt = dict.userKey.subarray(40, 48);

    // Validate using Algorithm 2.B
    const validationHash = await algorithm2B(pwd, uValSalt);
    if (!arraysEqual(validationHash, dict.userKey.subarray(0, 32))) return null;

    // Derive file key using Algorithm 2.B with key salt
    const keyHash = await algorithm2B(pwd, uKeySalt);
    if (!dict.userEncryptionKey) return null;
    const iv = new Uint8Array(16);
    return aesDecryptCBCNoPad(keyHash, iv, dict.userEncryptionKey);
  }
}

// ---------------------------------------------------------------------------
// Unified key computation
// ---------------------------------------------------------------------------

/**
 * Compute the file encryption key from a password and encryption dict.
 *
 * Tries the password as both user and owner password. Returns the key
 * on the first successful match, or throws if neither works.
 *
 * @param password  The password to try.
 * @param dict      Encryption dictionary values.
 * @param fileId    The first element of the /ID array (unused for R>=5).
 * @returns         The file encryption key.
 * @throws          If the password is incorrect.
 */
export async function computeFileEncryptionKey(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Promise<Uint8Array> {
  if (dict.revision >= 6) {
    // R=6: Try user first, then owner
    const userKey = await computeEncryptionKeyR6(password, dict, false);
    if (userKey) return userKey;
    const ownerKey = await computeEncryptionKeyR6(password, dict, true);
    if (ownerKey) return ownerKey;
    throw new Error('Incorrect password for R=6 encryption');
  }

  if (dict.revision === 5) {
    // R=5: Try user first, then owner
    const userKey = await computeEncryptionKeyR5(password, dict, false);
    if (userKey) return userKey;
    const ownerKey = await computeEncryptionKeyR5(password, dict, true);
    if (ownerKey) return ownerKey;
    throw new Error('Incorrect password for R=5 encryption');
  }

  // R=2, 3, 4: Verify user password first
  if (await verifyUserPassword(password, dict, fileId)) {
    return computeEncryptionKeyR2R4(password, dict, fileId);
  }

  // Try as owner password
  if (await verifyOwnerPassword(password, dict, fileId)) {
    // Recover the user password from the /O value and use that
    const recoveredKey = recoverUserKeyFromOwner(password, dict);
    return computeEncryptionKeyR2R4Bytes(recoveredKey, dict, fileId);
  }

  throw new Error('Incorrect password');
}

/**
 * Compute encryption key from raw password bytes (already padded/recovered).
 * Same as Algorithm 2, but takes raw bytes instead of a string.
 */
function computeEncryptionKeyR2R4Bytes(
  paddedPassword: Uint8Array,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Uint8Array {
  const keyByteLength = dict.keyLength / 8;
  const pBytes = int32LE(dict.permissions);
  let input = concat(paddedPassword, dict.ownerKey, pBytes, fileId);

  if (dict.revision >= 4 && !dict.encryptMetadata) {
    input = concat(input, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  }

  let hash = md5(input);

  if (dict.revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, keyByteLength));
    }
  }

  return hash.subarray(0, keyByteLength);
}

/**
 * Recover the padded user password from the /O value using the owner password.
 * (Reverse of Algorithm 3.)
 */
function recoverUserKeyFromOwner(
  ownerPassword: string,
  dict: EncryptDictValues,
): Uint8Array {
  const keyByteLength = dict.keyLength / 8;
  let hash = md5(padPassword(ownerPassword));

  if (dict.revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, keyByteLength));
    }
  }

  const rc4Key = hash.subarray(0, keyByteLength);

  if (dict.revision === 2) {
    // Simple RC4 decrypt
    return rc4(rc4Key, dict.ownerKey);
  }

  // R >= 3: reverse the 19 RC4 passes
  let result: Uint8Array = new Uint8Array(dict.ownerKey);
  for (let i = 19; i >= 0; i--) {
    const modKey = new Uint8Array(rc4Key.length);
    for (let j = 0; j < rc4Key.length; j++) {
      modKey[j] = (rc4Key[j]! ^ i) & 0xff;
    }
    result = new Uint8Array(rc4(modKey, result));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Password verification (R=2-4)
// ---------------------------------------------------------------------------

/**
 * Verify a user password against the /U value in the encryption dict.
 *
 * For R=2: Compare the entire 32 bytes.
 * For R=3/4: Compare only the first 16 bytes (the rest is arbitrary).
 *
 * @param password  The password to verify.
 * @param dict      Encryption dictionary values.
 * @param fileId    The first element of the /ID array.
 * @returns         True if the password is correct.
 */
export async function verifyUserPassword(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Promise<boolean> {
  if (dict.revision >= 5) {
    return verifyUserPasswordV5(password, dict);
  }

  const computedU = computeUserPasswordHash(password, dict, fileId);

  if (dict.revision === 2) {
    return arraysEqual(computedU, dict.userKey);
  }

  // R=3/4: Compare first 16 bytes only
  return arraysEqual(
    computedU.subarray(0, 16),
    dict.userKey.subarray(0, 16),
  );
}

/**
 * Verify a user password for V=5 (R=5 or R=6).
 */
async function verifyUserPasswordV5(
  password: string,
  dict: EncryptDictValues,
): Promise<boolean> {
  const pwd = preparePasswordV5(password);
  const uValSalt = dict.userKey.subarray(32, 40);

  if (dict.revision === 6) {
    const hash = await algorithm2B(pwd, uValSalt);
    return arraysEqual(hash, dict.userKey.subarray(0, 32));
  }

  // R=5
  const hash = await sha256(concat(pwd, uValSalt));
  return arraysEqual(hash, dict.userKey.subarray(0, 32));
}

/**
 * Verify an owner password against the /O value in the encryption dict.
 *
 * For R=2-4: Recover the user password from /O using the owner password,
 * then verify it can produce the correct /U.
 *
 * @param password  The owner password to verify.
 * @param dict      Encryption dictionary values.
 * @param fileId    The first element of the /ID array.
 * @returns         True if the password is the correct owner password.
 */
export async function verifyOwnerPassword(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Promise<boolean> {
  if (dict.revision >= 5) {
    return verifyOwnerPasswordV5(password, dict);
  }

  // Recover padded user password from /O
  const recovered = recoverUserKeyFromOwner(password, dict);

  // Build the encryption key from the recovered user password
  const fileKey = computeEncryptionKeyR2R4Bytes(recovered, dict, fileId);

  // Compute expected /U value
  let computedU: Uint8Array;
  if (dict.revision === 2) {
    computedU = computeUserPasswordR2(fileKey);
  } else {
    computedU = computeUserPasswordR3R4(fileKey, fileId);
  }

  if (dict.revision === 2) {
    return arraysEqual(computedU, dict.userKey);
  }

  return arraysEqual(
    computedU.subarray(0, 16),
    dict.userKey.subarray(0, 16),
  );
}

/**
 * Verify an owner password for V=5 (R=5 or R=6).
 */
async function verifyOwnerPasswordV5(
  password: string,
  dict: EncryptDictValues,
): Promise<boolean> {
  const pwd = preparePasswordV5(password);
  const oValSalt = dict.ownerKey.subarray(32, 40);

  if (dict.revision === 6) {
    const hash = await algorithm2B(pwd, oValSalt, dict.userKey);
    return arraysEqual(hash, dict.ownerKey.subarray(0, 32));
  }

  // R=5
  const hash = await sha256(concat(pwd, oValSalt, dict.userKey));
  return arraysEqual(hash, dict.ownerKey.subarray(0, 32));
}

// ---------------------------------------------------------------------------
// Helpers for creating new encryption dictionaries (V=5, R=5/6)
// ---------------------------------------------------------------------------

/**
 * Generate the /U, /UE values for a new V=5 encryption dictionary.
 */
export async function generateUserKeyV5(
  password: string,
  fileKey: Uint8Array,
  revision: number,
): Promise<{ userKey: Uint8Array; userEncryptionKey: Uint8Array }> {
  const pwd = preparePasswordV5(password);
  const validationSalt = new Uint8Array(8);
  const keySalt = new Uint8Array(8);
  globalThis.crypto.getRandomValues(validationSalt);
  globalThis.crypto.getRandomValues(keySalt);

  let hashVal: Uint8Array;
  let keyHashVal: Uint8Array;

  if (revision === 6) {
    hashVal = await algorithm2B(pwd, validationSalt);
    keyHashVal = await algorithm2B(pwd, keySalt);
  } else {
    hashVal = await sha256(concat(pwd, validationSalt));
    keyHashVal = await sha256(concat(pwd, keySalt));
  }

  // /U = hash(32) + validationSalt(8) + keySalt(8)
  const userKey = concat(hashVal, validationSalt, keySalt);

  // /UE = AES-256-CBC encrypt the file key with keyHash and zero IV
  const iv = new Uint8Array(16);
  const encryptedFileKey = await aesEncryptCBCNoPad(keyHashVal, iv, fileKey);

  return { userKey, userEncryptionKey: encryptedFileKey };
}

/**
 * Generate the /O, /OE values for a new V=5 encryption dictionary.
 */
export async function generateOwnerKeyV5(
  password: string,
  fileKey: Uint8Array,
  userKey: Uint8Array,
  revision: number,
): Promise<{ ownerKey: Uint8Array; ownerEncryptionKey: Uint8Array }> {
  const pwd = preparePasswordV5(password);
  const validationSalt = new Uint8Array(8);
  const keySalt = new Uint8Array(8);
  globalThis.crypto.getRandomValues(validationSalt);
  globalThis.crypto.getRandomValues(keySalt);

  let hashVal: Uint8Array;
  let keyHashVal: Uint8Array;

  if (revision === 6) {
    hashVal = await algorithm2B(pwd, validationSalt, userKey);
    keyHashVal = await algorithm2B(pwd, keySalt, userKey);
  } else {
    hashVal = await sha256(concat(pwd, validationSalt, userKey));
    keyHashVal = await sha256(concat(pwd, keySalt, userKey));
  }

  const ownerKey = concat(hashVal, validationSalt, keySalt);

  const iv = new Uint8Array(16);
  const encryptedFileKey = await aesEncryptCBCNoPad(keyHashVal, iv, fileKey);

  return { ownerKey, ownerEncryptionKey: encryptedFileKey };
}

/**
 * Generate the /Perms value for R=5/R=6.
 *
 * The /Perms value is a 16-byte AES-256-ECB encryption of a specific
 * data block that encodes the permissions and a magic number.
 */
export async function generatePermsV5(
  fileKey: Uint8Array,
  permissions: number,
  encryptMetadata: boolean,
): Promise<Uint8Array> {
  // Build the 16-byte plaintext block
  const block = new Uint8Array(16);
  // Bytes 0-3: permissions as little-endian 32-bit
  block[0] = permissions & 0xff;
  block[1] = (permissions >>> 8) & 0xff;
  block[2] = (permissions >>> 16) & 0xff;
  block[3] = (permissions >>> 24) & 0xff;
  // Bytes 4-7: 0xFFFFFFFF
  block[4] = 0xff;
  block[5] = 0xff;
  block[6] = 0xff;
  block[7] = 0xff;
  // Byte 8: 'T' or 'F' for metadata encryption
  block[8] = encryptMetadata ? 0x54 : 0x46; // 'T' or 'F'
  // Bytes 9-11: 'adb'
  block[9] = 0x61;  // 'a'
  block[10] = 0x64; // 'd'
  block[11] = 0x62; // 'b'
  // Bytes 12-15: random
  const random = new Uint8Array(4);
  globalThis.crypto.getRandomValues(random);
  block.set(random, 12);

  // AES-256-ECB encrypt (one block = use CBC with zero IV, no padding)
  const iv = new Uint8Array(16);
  return aesEncryptCBCNoPad(fileKey, iv, block);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison of two byte arrays.
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

// Re-export for use by encryptionHandler
export { padPassword, preparePasswordV5, concat, int32LE, PASSWORD_PADDING, arraysEqual };

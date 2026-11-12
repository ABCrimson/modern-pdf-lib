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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Padding string used in password-based key derivation (Algorithm 2).
 * This is defined in the PDF spec, Table 20.
 */
const PASSWORD_PADDING: Uint8Array = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
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
 * Prepare a password for R=5/R=6 (AES-256) using SASLprep (RFC 4013).
 *
 * ISO 32000-2 SS7.6.3.1 requires SASLprep normalization for passwords
 * used with encryption revision 5 and 6.  The steps are:
 *
 * 1. Map: Convert non-ASCII space characters to U+0020, remove
 *    "commonly mapped to nothing" characters (RFC 3454 B.1).
 * 2. Normalize: Apply Unicode NFKC normalization.
 * 3. Prohibit: Reject characters from RFC 3454 prohibited tables.
 * The bidirectional check of RFC 3454 is not run (see {@link saslprep}).
 *
 * The result is truncated to 127 UTF-8 bytes per the PDF spec. Writing uses
 * this form only and throws on a prohibited code point; reading also tries the
 * raw UTF-8 bytes (see {@link readPasswordForms}).
 */
function preparePasswordV5(password: string): Uint8Array {
  const prepared = saslprep(password);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(prepared);
  return encoded.length > 127 ? encoded.subarray(0, 127) : encoded;
}

/**
 * Simplified SASLprep (RFC 4013) profile of stringprep (RFC 3454).
 *
 * Covers the mapping, normalization, and prohibited-character steps
 * needed for PDF password preparation.  Bidi checking is omitted
 * since PDF passwords are typically LTR and the spec allows
 * implementations to skip it.
 *
 * @internal
 */
function saslprep(input: string): string {
  const normalized = saslprepMapAndNormalize(input);
  // Step 3: Prohibited characters -- reject if any are present
  const cp = firstProhibited(normalized);
  if (cp !== undefined) {
    throw new Error(
      `Password contains prohibited character U+${cp.toString(16).toUpperCase().padStart(4, '0')} (SASLprep)`,
    );
  }
  return normalized;
}

/** SASLprep steps 1 and 2: the mapping and NFKC normalization. */
function saslprepMapAndNormalize(input: string): string {
  // Step 1: Mapping
  // B.1 — "Commonly mapped to nothing" (zero-width joiners, soft hyphen, etc.)
  // C.1.2 — Non-ASCII space characters → U+0020
  let mapped = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;

    // B.1: Map to nothing (RFC 3454 Table B.1 — commonly mapped to nothing)
    if (isMappedToNothing(cp)) continue;

    // C.1.2: Non-ASCII space characters → ASCII space
    if (isNonAsciiSpace(cp)) {
      mapped += ' ';
      continue;
    }

    mapped += ch;
  }

  // Step 2: NFKC normalization
  return mapped.normalize('NFKC');
}

/** The first code point of `text` that SASLprep prohibits, or undefined. */
function firstProhibited(text: string): number | undefined {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (isProhibited(cp)) return cp;
  }
  return undefined;
}

/** RFC 3454 Table B.1 — Commonly mapped to nothing. */
function isMappedToNothing(cp: number): boolean {
  return (
    cp === 0x00ad || // SOFT HYPHEN
    cp === 0x1806 || // MONGOLIAN TODO SOFT HYPHEN
    cp === 0x200b || // ZERO WIDTH SPACE
    cp === 0x2060 || // WORD JOINER
    cp === 0xfeff || // ZERO WIDTH NO-BREAK SPACE (BOM)
    cp === 0x034f || // COMBINING GRAPHEME JOINER
    cp === 0x180b || // MONGOLIAN FREE VARIATION SELECTOR ONE
    cp === 0x180c || // MONGOLIAN FREE VARIATION SELECTOR TWO
    cp === 0x180d || // MONGOLIAN FREE VARIATION SELECTOR THREE
    cp === 0x200c || // ZERO WIDTH NON-JOINER
    cp === 0x200d || // ZERO WIDTH JOINER
    (cp >= 0xfe00 && cp <= 0xfe0f) // VARIATION SELECTORS 1-16
  );
}

/** RFC 3454 Table C.1.2 — Non-ASCII space characters. */
function isNonAsciiSpace(cp: number): boolean {
  return (
    cp === 0x00a0 || // NO-BREAK SPACE
    cp === 0x1680 || // OGHAM SPACE MARK
    cp === 0x2000 || // EN QUAD
    cp === 0x2001 || // EM QUAD
    cp === 0x2002 || // EN SPACE
    cp === 0x2003 || // EM SPACE
    cp === 0x2004 || // THREE-PER-EM SPACE
    cp === 0x2005 || // FOUR-PER-EM SPACE
    cp === 0x2006 || // SIX-PER-EM SPACE
    cp === 0x2007 || // FIGURE SPACE
    cp === 0x2008 || // PUNCTUATION SPACE
    cp === 0x2009 || // THIN SPACE
    cp === 0x200a || // HAIR SPACE
    cp === 0x202f || // NARROW NO-BREAK SPACE
    cp === 0x205f || // MEDIUM MATHEMATICAL SPACE
    cp === 0x3000 // IDEOGRAPHIC SPACE
  );
}

/**
 * RFC 3454 prohibited tables (C.2.1, C.2.2, C.3, C.4, C.5, C.6, C.7, C.8, C.9).
 * Simplified to the ranges most likely to appear in passwords.
 */
function isProhibited(cp: number): boolean {
  // C.2.1: ASCII control characters
  if (cp <= 0x001f || cp === 0x007f) return true;

  // C.2.2: Non-ASCII control characters
  if (
    (cp >= 0x0080 && cp <= 0x009f) ||
    cp === 0x06dd ||
    cp === 0x070f ||
    cp === 0x180e ||
    (cp >= 0x200c && cp <= 0x200d) ||
    (cp >= 0x2028 && cp <= 0x2029) ||
    (cp >= 0x2060 && cp <= 0x2063) ||
    (cp >= 0x206a && cp <= 0x206f) ||
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffc) ||
    (cp >= 0x1d173 && cp <= 0x1d17a)
  )
    return true;

  // C.3: Private use
  if (
    (cp >= 0xe000 && cp <= 0xf8ff) ||
    (cp >= 0xf0000 && cp <= 0xffffd) ||
    (cp >= 0x100000 && cp <= 0x10fffd)
  )
    return true;

  // C.4: Non-character code points
  if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xffff) === 0xfffe || (cp & 0xffff) === 0xffff)
    return true;

  // C.5: Surrogate codes (shouldn't appear after normalize but check anyway)
  if (cp >= 0xd800 && cp <= 0xdfff) return true;

  // C.6: Inappropriate for plain text
  if (cp === 0xfff9 || cp === 0xfffa || cp === 0xfffb || cp === 0xfffc) return true;

  // C.7: Inappropriate for canonical representation
  if (cp >= 0x2ff0 && cp <= 0x2ffb) return true;

  // C.8: Change display properties / deprecated
  if (
    cp === 0x0340 ||
    cp === 0x0341 ||
    cp === 0x200e ||
    cp === 0x200f ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x206a && cp <= 0x206f)
  )
    return true;

  // C.9: Tagging characters
  if (cp === 0xe0001 || (cp >= 0xe0020 && cp <= 0xe007f)) return true;

  return false;
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
export function computeUserPasswordR3R4(fileKey: Uint8Array, fileId: Uint8Array): Uint8Array {
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
// AES-256 (V=5): password hashes of revisions 5 and 6
// ---------------------------------------------------------------------------

/**
 * Which hash a V=5 password matched. `'iso'` is the standard one (Algorithm 2.A for R=5,
 * ISO 32000-2 Algorithm 2.B for R=6; R=2-4 keys, which have one derivation, report it too).
 * `'legacy'` is the R=6 variant of Algorithm 2.B that modern-pdf-lib 0.26.0 to 0.40.8 wrote.
 *
 * @internal
 */
export type KeyDerivation = 'iso' | 'legacy';

/**
 * A file encryption key and the derivation that the password matched.
 *
 * @internal
 */
export interface DerivedFileKey {
  readonly fileKey: Uint8Array;
  readonly derivation: KeyDerivation;
}

/** The most bytes of a prepared V=5 password that the hashes take (ISO 32000-2 7.6.4.3.2). */
const MAX_V5_PASSWORD_BYTES = 127;

/** The UTF-8 bytes of `text`, cut to 127 bytes. */
function utf8V5(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  return encoded.length > MAX_V5_PASSWORD_BYTES
    ? encoded.subarray(0, MAX_V5_PASSWORD_BYTES)
    : encoded;
}

/**
 * The byte forms of `password` that reading tries, in order: the SASLprep form (ISO 32000-2),
 * then the raw UTF-8 bytes when they differ (what qpdf hashes; pdf.js tries both). When SASLprep finds a
 * prohibited code point, only the raw bytes are tried; nothing is thrown.
 */
function readPasswordForms(password: string): Uint8Array[] {
  const raw = utf8V5(password);
  const mapped = saslprepMapAndNormalize(password);
  if (firstProhibited(mapped) !== undefined) return [raw];
  const prepared = utf8V5(mapped);
  return arraysEqual(prepared, raw) ? [prepared] : [prepared, raw];
}

/** The password hash family of a V=5 dictionary: R=5 uses Algorithm 2.A, R>=6 Algorithm 2.B. */
type V5Scheme = 'r5' | 'r6';

const schemeOf = (dict: EncryptDictValues): V5Scheme => (dict.revision === 5 ? 'r5' : 'r6');

/** The user or owner half of a V=5 dictionary. */
type V5Role = 'user' | 'owner';

/** One password attempt: which half, which byte form, which derivation. */
interface V5Attempt {
  readonly role: V5Role;
  readonly password: Uint8Array;
  readonly derivation: KeyDerivation;
}

/**
 * Every attempt for `password` against `roles`, in the order reading tries them:
 * 1. the standard hash for each role (user before owner), SASLprep form then raw UTF-8;
 * 2. R=6 only, the legacy hash: for each byte form (SASLprep, then raw), user then owner.
 * So the legacy hash is tried only after every standard attempt has failed.
 */
function v5Attempts(password: string, scheme: V5Scheme, roles: readonly V5Role[]): V5Attempt[] {
  const forms = readPasswordForms(password);
  const attempts: V5Attempt[] = [];
  for (const role of roles) {
    for (const form of forms) attempts.push({ role, password: form, derivation: 'iso' });
  }
  if (scheme === 'r6') {
    for (const form of forms) {
      for (const role of roles) attempts.push({ role, password: form, derivation: 'legacy' });
    }
  }
  return attempts;
}

/** The pieces of /U or /O that a role hashes with; null when /U or the role's string is short. */
function v5Parts(
  dict: EncryptDictValues,
  role: V5Role,
): {
  hash: Uint8Array;
  validationSalt: Uint8Array;
  keySalt: Uint8Array;
  udata: Uint8Array | undefined;
  wrappedKey: Uint8Array | undefined;
} | null {
  const own = role === 'user' ? dict.userKey : dict.ownerKey;
  if (own.length < 48 || dict.userKey.length < 48) return null;
  return {
    hash: own.subarray(0, 32),
    validationSalt: own.subarray(32, 40),
    keySalt: own.subarray(40, 48),
    // The owner hashes take the 48-byte /U, also when the file stores a longer string.
    udata: role === 'owner' ? dict.userKey.subarray(0, 48) : undefined,
    wrappedKey: role === 'user' ? dict.userEncryptionKey : dict.ownerEncryptionKey,
  };
}

/** The 32-byte V=5 hash of `password` with `salt` (and `udata` for the owner). */
async function v5Hash(
  scheme: V5Scheme,
  derivation: KeyDerivation,
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array | undefined,
): Promise<Uint8Array> {
  if (scheme === 'r5') {
    return sha256(udata ? concat(password, salt, udata) : concat(password, salt));
  }
  return hashAlgorithm2B(password, salt, udata, derivation === 'legacy');
}

/** Whether `attempt` reproduces the /U or /O hash of `dict`. */
async function v5Validates(
  dict: EncryptDictValues,
  scheme: V5Scheme,
  attempt: V5Attempt,
): Promise<boolean> {
  const parts = v5Parts(dict, attempt.role);
  if (parts === null) return false;
  const hash = await v5Hash(
    scheme,
    attempt.derivation,
    attempt.password,
    parts.validationSalt,
    parts.udata,
  );
  return arraysEqual(hash, parts.hash);
}

/** The file key /UE or /OE wraps for a validated `attempt`; null when that string is unusable. */
async function v5Unwrap(
  dict: EncryptDictValues,
  scheme: V5Scheme,
  attempt: V5Attempt,
): Promise<Uint8Array | null> {
  const parts = v5Parts(dict, attempt.role);
  if (parts?.wrappedKey?.length !== 32) return null;
  const keyHash = await v5Hash(
    scheme,
    attempt.derivation,
    attempt.password,
    parts.keySalt,
    parts.udata,
  );
  // AES-256-CBC with a zero IV and no padding.
  return aesDecryptCBCNoPad(keyHash, new Uint8Array(16), parts.wrappedKey);
}

/** The first attempt of `roles` that validates and unwraps a key, or null. */
async function v5FileKey(
  password: string,
  dict: EncryptDictValues,
  scheme: V5Scheme,
  roles: readonly V5Role[],
): Promise<DerivedFileKey | null> {
  for (const attempt of v5Attempts(password, scheme, roles)) {
    if (!(await v5Validates(dict, scheme, attempt))) continue;
    const fileKey = await v5Unwrap(dict, scheme, attempt);
    if (fileKey !== null) return { fileKey, derivation: attempt.derivation };
  }
  return null;
}

/** Whether some attempt for `role` reproduces its /U or /O hash. */
async function v5PasswordMatches(
  password: string,
  dict: EncryptDictValues,
  role: V5Role,
): Promise<boolean> {
  const scheme = schemeOf(dict);
  for (const attempt of v5Attempts(password, scheme, [role])) {
    if (await v5Validates(dict, scheme, attempt)) return true;
  }
  return false;
}

/**
 * The file encryption key of a V=5 (R=5 or R=6) document for `password`, and the derivation
 * that matched; null when no attempt matches.
 *
 * Tries, in order, stopping at the first /U or /O hash that matches, and only then computes the
 * key hash and unwraps /UE or /OE:
 * 1. the user password with the standard hash, its SASLprep form, then its raw UTF-8 bytes
 *    (only when they differ);
 * 2. the owner password the same way, with the first 48 bytes of /U as udata;
 * 3. R=6 only: the legacy hash (as modern-pdf-lib 0.26.0 to 0.40.8 wrote it), SASLprep form
 *    as user then owner, then the raw UTF-8 bytes as user then owner.
 *
 * R=5 uses Algorithm 2.A and has no legacy attempts. A password with a code point SASLprep
 * prohibits is tried in its raw form only. Nothing here throws for a wrong password.
 *
 * @internal
 */
export async function deriveFileKeyV5(
  password: string,
  dict: EncryptDictValues,
): Promise<DerivedFileKey | null> {
  return v5FileKey(password, dict, schemeOf(dict), ['user', 'owner']);
}

/**
 * Compute the file encryption key for V=5 R=5 (Adobe extension level 3).
 *
 * Algorithm 2.A: SHA-256(password || validation salt [|| /U for the owner]) must equal the
 * first 32 bytes of /U (or /O); SHA-256(password || key salt [|| /U]) then unwraps /UE (or
 * /OE) with AES-256-CBC, a zero IV and no padding. The owner hashes take the first 48 bytes of
 * /U. The password is tried in its SASLprep form, then as raw UTF-8 bytes.
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
  const found = await v5FileKey(password, dict, 'r5', [isOwner ? 'owner' : 'user']);
  return found?.fileKey ?? null;
}

// ---------------------------------------------------------------------------
// Algorithm 2.B: Computing hash for R=6 (ISO 32000-2)
// ---------------------------------------------------------------------------

/**
 * ISO 32000-2 Algorithm 2.B (7.6.4.3.4): the 32-byte hash of revision 6.
 *
 * 1. K = SHA-256(password || salt || udata); udata is the 48-byte /U for the owner hashes and
 *    empty otherwise.
 * 2. Each round: K1 = (password || K || udata) repeated 64 times; E = AES-128-CBC of K1 with
 *    key K[0..16), IV K[16..32) and no padding; the first 16 bytes of E as a big-endian number
 *    modulo 3 pick SHA-256 (0), SHA-384 (1) or SHA-512 (2), and the new K is that hash of E,
 *    kept whole (32, 48 or 64 bytes).
 * 3. After round n, counted from 1: when n >= 64 and the last byte of E is at most n - 32,
 *    stop; otherwise run another round.
 * 4. The result is K[0..32).
 *
 * Writing uses only this function.
 *
 * @param password  The prepared password bytes (at most 127).
 * @param salt      8-byte salt (validation or key salt).
 * @param uKey      The 48-byte /U value for the owner hashes; omitted for the user hashes.
 * @returns         A 32-byte hash.
 */
export async function algorithm2B(
  password: Uint8Array,
  salt: Uint8Array,
  uKey?: Uint8Array,
): Promise<Uint8Array> {
  return hashAlgorithm2B(password, salt, uKey, false);
}

/**
 * Algorithm 2.B, or with `legacy` the variant that modern-pdf-lib 0.26.0 to 0.40.8 wrote: it
 * cuts K to 32 bytes after every round and stops when the last byte of E is at most n - 33.
 * Reading reaches the variant only through {@link deriveFileKeyV5},
 * {@link computeEncryptionKeyR6} and the password checks,
 * after every standard attempt failed; nothing that writes calls it.
 */
async function hashAlgorithm2B(
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array | undefined,
  legacy: boolean,
): Promise<Uint8Array> {
  // Step 1: SHA-256(password || salt || udata)
  let K = await sha256(udata ? concat(password, salt, udata) : concat(password, salt));
  const uLen = udata?.length ?? 0;

  for (let round = 1; ; round++) {
    // Step 2: K1 = (password || K || udata) repeated 64 times
    const pLen = password.length;
    const blockLen = pLen + K.length + uLen;
    const K1 = new Uint8Array(blockLen * 64);
    for (let i = 0; i < 64; i++) {
      const base = i * blockLen;
      K1.set(password, base);
      K1.set(K, base + pLen);
      if (udata) K1.set(udata, base + pLen + K.length);
    }

    // AES-128-CBC of K1 with key K[0..16) and IV K[16..32), no padding
    const E = await aesEncryptCBCNoPad(K.subarray(0, 16), K.subarray(16, 32), K1);

    // The first 16 bytes of E as a big-endian number, modulo 3, pick the hash
    let pick = 0;
    for (let i = 0; i < 16; i++) {
      pick = (pick * 256 + E[i]!) % 3;
    }
    const next = await (pick === 0 ? sha256(E) : pick === 1 ? sha384(E) : sha512(E));
    K = legacy ? next.subarray(0, 32) : next;

    // Step 3: after round n >= 64, stop when the last byte of E <= n - 32 (legacy: n - 33)
    if (round >= 64 && E.at(-1)! <= round - (legacy ? 33 : 32)) break;
  }

  // Step 4
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
  const dataBuf = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;

  // Import key
  const cryptoKey = await subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['encrypt']);

  // We need to avoid PKCS#7 padding added by Web Crypto.
  // Strategy: encrypt data that is already block-aligned, then strip the
  // final padding block that Web Crypto adds.
  const encrypted = await subtle.encrypt({ name: 'AES-CBC', iv: ivBuf }, cryptoKey, dataBuf);

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

  const decrypted = await subtle.decrypt({ name: 'AES-CBC', iv: ivBuf }, cryptoKey, dataBuf);

  // Return only the original data length (strip the decrypted padding block)
  return new Uint8Array(decrypted).subarray(0, data.length);
}

/**
 * Compute the file encryption key for V=5 R=6 (ISO 32000-2).
 *
 * Tries the standard Algorithm 2.B first and the legacy variant (as modern-pdf-lib 0.26.0 to
 * 0.40.8 wrote it) only after it, each with the SASLprep form of the password and then its raw
 * UTF-8 bytes; the owner hashes take the first 48 bytes of /U.
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
  const found = await v5FileKey(password, dict, 'r6', [isOwner ? 'owner' : 'user']);
  return found?.fileKey ?? null;
}

// ---------------------------------------------------------------------------
// Unified key computation
// ---------------------------------------------------------------------------

/**
 * First-in, first-out cache of file encryption keys (at most 32), so that re-opening a document
 * with the same password skips the key derivation (R=6 runs 64 or more rounds of AES and SHA-2).
 *
 * The key is a SHA-256 digest of everything the file key depends on (the password and every
 * value of the dictionary and the file ID that a derivation reads), never the password itself.
 * The value keeps the derivation beside the key.
 */
const fileKeyCache = new Map<string, DerivedFileKey>();
const FILE_KEY_CACHE_MAX = 32;

/** The cache key: SHA-256 over every input of the derivation, each with its length. */
async function buildCacheKey(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Promise<string> {
  const fields: (Uint8Array | undefined)[] = [
    new TextEncoder().encode(password),
    int32LE(dict.version),
    int32LE(dict.revision),
    int32LE(dict.keyLength),
    int32LE(dict.permissions),
    new Uint8Array([dict.encryptMetadata ? 1 : 0]),
    dict.ownerKey,
    dict.userKey,
    dict.ownerEncryptionKey,
    dict.userEncryptionKey,
    dict.perms,
    fileId,
  ];
  const parts: Uint8Array[] = [];
  for (const field of fields) {
    // An absent field and an empty one differ: absent is the flag 0 alone.
    if (field === undefined) {
      parts.push(new Uint8Array([0]));
    } else {
      parts.push(new Uint8Array([1]), int32LE(field.length), field);
    }
  }
  return (await sha256(concat(...parts))).toHex();
}

/**
 * Compute the file encryption key from a password and encryption dict, and report which
 * derivation the password matched.
 *
 * R=5 and R=6 run {@link deriveFileKeyV5} (standard first, the legacy R=6 hash last); R=2-4
 * try the user password, then the owner password, and always report `'iso'`.
 *
 * @param password  The password to try.
 * @param dict      Encryption dictionary values.
 * @param fileId    The first element of the /ID array (unused for R>=5).
 * @returns         The file encryption key and its derivation.
 * @throws          If the password is incorrect.
 * @internal
 */
export async function deriveFileEncryptionKey(
  password: string,
  dict: EncryptDictValues,
  fileId: Uint8Array,
): Promise<DerivedFileKey> {
  const ck = await buildCacheKey(password, dict, fileId);
  const cached = fileKeyCache.get(ck);
  // Return a copy so that the caller cannot change the cached key.
  if (cached) return { fileKey: cached.fileKey.slice(), derivation: cached.derivation };

  let result: DerivedFileKey;

  if (dict.revision >= 5) {
    const found = await deriveFileKeyV5(password, dict);
    if (found === null) {
      throw new Error(`Incorrect password for R=${dict.revision === 5 ? 5 : 6} encryption`);
    }
    result = found;
  } else {
    // R=2, 3, 4: Verify user password first
    if (await verifyUserPassword(password, dict, fileId)) {
      result = { fileKey: computeEncryptionKeyR2R4(password, dict, fileId), derivation: 'iso' };
    } else if (await verifyOwnerPassword(password, dict, fileId)) {
      // Recover the user password from the /O value and use that
      const recoveredKey = recoverUserKeyFromOwner(password, dict);
      result = {
        fileKey: computeEncryptionKeyR2R4Bytes(recoveredKey, dict, fileId),
        derivation: 'iso',
      };
    } else {
      throw new Error('Incorrect password');
    }
  }

  // Store in cache; evict the oldest entry when full
  if (fileKeyCache.size >= FILE_KEY_CACHE_MAX) {
    const firstKey = fileKeyCache.keys().next().value;
    if (firstKey !== undefined) fileKeyCache.delete(firstKey);
  }
  fileKeyCache.set(ck, { fileKey: result.fileKey.slice(), derivation: result.derivation });

  return result;
}

/**
 * Compute the file encryption key from a password and encryption dict.
 *
 * Tries the password as both user and owner password. Returns the key
 * on the first successful match, or throws if neither works. For R=6 it
 * accepts the standard Algorithm 2.B and, after it, the legacy variant
 * that modern-pdf-lib 0.26.0 to 0.40.8 wrote; it emits no warning.
 *
 * Results are cached so that re-opening the same PDF with the same
 * password skips the expensive key derivation.
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
  return (await deriveFileEncryptionKey(password, dict, fileId)).fileKey;
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
function recoverUserKeyFromOwner(ownerPassword: string, dict: EncryptDictValues): Uint8Array {
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
// Password verification
// ---------------------------------------------------------------------------

/**
 * Verify a user password against the /U value in the encryption dict.
 *
 * For R=2: Compare the entire 32 bytes.
 * For R=3/4: Compare only the first 16 bytes (the rest is arbitrary).
 * For R=5/6: Compare the first 32 bytes with the password hash. For R=6 it
 * accepts the standard Algorithm 2.B and, after it, the legacy variant that
 * modern-pdf-lib 0.26.0 to 0.40.8 wrote; it emits no warning.
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
  return arraysEqual(computedU.subarray(0, 16), dict.userKey.subarray(0, 16));
}

/**
 * Verify a user password for V=5 (R=5 or R=6): the standard hash first, for R=6 the legacy
 * one after it; SASLprep form, then raw UTF-8 bytes.
 */
async function verifyUserPasswordV5(password: string, dict: EncryptDictValues): Promise<boolean> {
  return v5PasswordMatches(password, dict, 'user');
}

/**
 * Verify an owner password against the /O value in the encryption dict.
 *
 * For R=2-4: Recover the user password from /O using the owner password,
 * then verify it can produce the correct /U.
 * For R=5/6: Compare the first 32 bytes of /O with the password hash, which
 * takes the first 48 bytes of /U. For R=6 it accepts the standard Algorithm
 * 2.B and, after it, the legacy variant that modern-pdf-lib 0.26.0 to 0.40.8
 * wrote; it emits no warning.
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

  return arraysEqual(computedU.subarray(0, 16), dict.userKey.subarray(0, 16));
}

/**
 * Verify an owner password for V=5 (R=5 or R=6), with the first 48 bytes of /U as udata: the
 * standard hash first, for R=6 the legacy one after it; SASLprep form, then raw UTF-8 bytes.
 */
async function verifyOwnerPasswordV5(password: string, dict: EncryptDictValues): Promise<boolean> {
  return v5PasswordMatches(password, dict, 'owner');
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
  block[9] = 0x61; // 'a'
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
export { padPassword, preparePasswordV5, saslprep, concat, int32LE, PASSWORD_PADDING, arraysEqual };

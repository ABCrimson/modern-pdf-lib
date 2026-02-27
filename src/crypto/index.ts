/**
 * @module crypto
 *
 * Public API surface for the PDF encryption/decryption subsystem.
 *
 * Re-exports the high-level encryption handler, permission utilities,
 * and low-level crypto primitives.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Encryption handler (primary public API)
// ---------------------------------------------------------------------------

export {
  PdfEncryptionHandler,
} from './encryptionHandler.js';
export type {
  EncryptOptions,
  EncryptAlgorithm,
} from './encryptionHandler.js';

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export {
  encodePermissions,
  decodePermissions,
} from './permissions.js';
export type { PdfPermissionFlags } from './permissions.js';

// ---------------------------------------------------------------------------
// Key derivation (advanced / testing)
// ---------------------------------------------------------------------------

export type { EncryptDictValues } from './keyDerivation.js';
export {
  computeFileEncryptionKey,
  computeEncryptionKeyR2R4,
  computeOwnerPasswordValue,
  computeUserPasswordHash,
  verifyUserPassword,
  verifyOwnerPassword,
} from './keyDerivation.js';

// ---------------------------------------------------------------------------
// Low-level crypto primitives
// ---------------------------------------------------------------------------

export { md5 } from './md5.js';
export { rc4 } from './rc4.js';
export { aesEncryptCBC, aesDecryptCBC } from './aes.js';
export { sha256, sha384, sha512 } from './sha256.js';

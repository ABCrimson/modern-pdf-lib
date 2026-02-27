/**
 * @module signature
 *
 * Public API surface for the PDF digital signature subsystem.
 *
 * Re-exports the high-level signing/verification functions,
 * ByteRange utilities, PKCS#7 builder, and timestamp client.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Signature handler (primary public API)
// ---------------------------------------------------------------------------

export {
  signPdf,
  getSignatures,
} from './signatureHandler.js';
export type {
  SignOptions,
  PdfSignatureInfo,
} from './signatureHandler.js';

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export {
  verifySignatures,
  verifySignature,
} from './signatureVerifier.js';
export type {
  SignatureVerificationResult,
} from './signatureVerifier.js';

// ---------------------------------------------------------------------------
// ByteRange utilities
// ---------------------------------------------------------------------------

export {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  findSignatures,
} from './byteRange.js';
export type {
  ByteRangeResult,
} from './byteRange.js';

// ---------------------------------------------------------------------------
// PKCS#7 / CMS builder
// ---------------------------------------------------------------------------

export {
  buildPkcs7Signature,
  encodeLength,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeUtf8String,
  encodePrintableString,
  encodeUTCTime,
  encodeContextTag,
} from './pkcs7.js';
export type {
  SignerInfo,
  SignatureOptions,
} from './pkcs7.js';

// ---------------------------------------------------------------------------
// Timestamp (RFC 3161)
// ---------------------------------------------------------------------------

export {
  requestTimestamp,
  buildTimestampRequest,
  parseTimestampResponse,
} from './timestamp.js';
export type {
  TimestampResult,
} from './timestamp.js';

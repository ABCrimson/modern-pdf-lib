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
  VisibleSignatureOptions,
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
  PrepareAppearanceOptions,
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

// ---------------------------------------------------------------------------
// OCSP (RFC 6960)
// ---------------------------------------------------------------------------

export {
  buildOcspRequest,
  parseOcspResponse,
  checkCertificateStatus,
  extractOcspUrl,
} from './ocsp.js';
export type {
  OcspResponse,
  OcspSingleResponse,
  OcspResult,
} from './ocsp.js';

// ---------------------------------------------------------------------------
// CRL (X.509 v2)
// ---------------------------------------------------------------------------

export {
  parseCrl,
  downloadCrl,
  isCertificateRevoked,
  extractCrlUrls,
} from './crl.js';
export type {
  CrlData,
  CrlEntry,
} from './crl.js';

// ---------------------------------------------------------------------------
// Certificate chain validation
// ---------------------------------------------------------------------------

export {
  buildCertificateChain,
  validateCertificateChain,
} from './chainValidator.js';
export type {
  CertificateChainResult,
  ChainValidationResult,
  ChainValidationOptions,
  CertificateStatus,
} from './chainValidator.js';

// ---------------------------------------------------------------------------
// Offline revocation checking
// ---------------------------------------------------------------------------

export {
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
} from './offlineRevocation.js';
export type {
  EmbeddedRevocationData,
  OfflineRevocationResult,
} from './offlineRevocation.js';

// ---------------------------------------------------------------------------
// Custom trust store
// ---------------------------------------------------------------------------

export {
  TrustStore,
} from './trustStore.js';
export type {
  TrustStoreOptions,
} from './trustStore.js';

// ---------------------------------------------------------------------------
// Certificate policy validation
// ---------------------------------------------------------------------------

export {
  validateKeyUsage,
  validateExtendedKeyUsage,
  validateCertificatePolicy,
  EKU_OIDS,
} from './certPolicy.js';
export type {
  KeyUsageFlag,
  KeyUsageValidationResult,
  EkuValidationResult,
  PolicyValidationOptions,
  PolicyValidationResult,
} from './certPolicy.js';

// ---------------------------------------------------------------------------
// Revocation cache
// ---------------------------------------------------------------------------

export {
  RevocationCache,
  deriveCacheKey,
} from './revocationCache.js';
export type {
  OcspCacheEntry,
  CrlCacheEntry,
  RevocationCacheOptions,
} from './revocationCache.js';

// Re-export cache-specific types under qualified names to avoid conflict
// with the OCSP/CRL module types that share the same base names.
export type {
  OcspResult as CachedOcspResult,
  CrlData as CachedCrlData,
} from './revocationCache.js';

// ---------------------------------------------------------------------------
// OCSP stapling
// ---------------------------------------------------------------------------

export {
  embedOcspResponse,
  extractStapledOcsp,
} from './ocspStaple.js';

// ---------------------------------------------------------------------------
// Delta CRL
// ---------------------------------------------------------------------------

export {
  parseDeltaCrl,
  mergeCrls,
  isDeltaCrl,
} from './deltaCrl.js';
export type {
  DeltaCrlData,
} from './deltaCrl.js';

// ---------------------------------------------------------------------------
// Detailed verification
// ---------------------------------------------------------------------------

export {
  verifySignatureDetailed,
} from './detailedVerifier.js';
export type {
  DetailedVerificationResult,
  DetailedVerifyOptions,
  CertificateInfo,
} from './detailedVerifier.js';

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

// ---------------------------------------------------------------------------
// Incremental save with signature preservation
// ---------------------------------------------------------------------------

export {
  saveIncrementalWithSignaturePreservation,
  appendIncrementalUpdate,
  findExistingSignatures,
  validateByteRangeIntegrity,
  parseExistingTrailer,
} from './incrementalSave.js';
export type {
  SignatureByteRange,
  IncrementalSaveOptions,
  AppendOptions,
  IncrementalObject,
  TrailerInfo,
} from './incrementalSave.js';

// ---------------------------------------------------------------------------
// Multi-signature chain validation
// ---------------------------------------------------------------------------

export {
  validateSignatureChain,
} from './multiSignatureValidator.js';
export type {
  SignatureChainEntry,
  SignatureChainResult,
} from './multiSignatureValidator.js';

// ---------------------------------------------------------------------------
// MDP (DocMDP) certification policy
// ---------------------------------------------------------------------------

export {
  MdpPermission,
  setCertificationLevel,
  getCertificationLevel,
  buildDocMdpReference,
} from './mdpPolicy.js';

// ---------------------------------------------------------------------------
// Modification detection
// ---------------------------------------------------------------------------

export {
  detectModifications,
} from './modificationDetector.js';
export type {
  ModificationViolationType,
  ModificationViolation,
  ModificationReport,
} from './modificationDetector.js';

// ---------------------------------------------------------------------------
// Signature field lock
// ---------------------------------------------------------------------------

export {
  addFieldLock,
  getFieldLocks,
  buildFieldLockDict,
} from './fieldLock.js';
export type {
  FieldLockOptions,
  FieldLockInfo,
} from './fieldLock.js';

// ---------------------------------------------------------------------------
// Document diff (signed vs current content)
// ---------------------------------------------------------------------------

export {
  diffSignedContent,
} from './documentDiff.js';
export type {
  DocumentDiff,
  DiffEntry,
} from './documentDiff.js';

// ---------------------------------------------------------------------------
// Counter-signatures
// ---------------------------------------------------------------------------

export {
  addCounterSignature,
  getCounterSignatures,
} from './counterSignature.js';
export type {
  CounterSignatureInfo,
} from './counterSignature.js';

// ---------------------------------------------------------------------------
// LTV (Long-Term Validation) embedding
// ---------------------------------------------------------------------------

export {
  embedLtvData,
  buildDssDictionary,
  hasLtvData,
} from './ltvEmbed.js';
export type {
  LtvOptions,
  DssData,
} from './ltvEmbed.js';

// ---------------------------------------------------------------------------
// Incremental save optimization
// ---------------------------------------------------------------------------

export {
  optimizeIncrementalSave,
  computeObjectHash,
  findChangedObjects,
} from './incrementalOptimizer.js';
export type {
  IncrementalChange,
} from './incrementalOptimizer.js';

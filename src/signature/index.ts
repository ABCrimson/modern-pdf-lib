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

export { signPdf, getSignatures } from './pades/signatureHandler.js';
export type {
  SignOptions,
  VisibleSignatureOptions,
  PdfSignatureInfo,
} from './pades/signatureHandler.js';

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export { verifySignatures, verifySignature } from './pades/signatureVerifier.js';
export type { SignatureVerificationResult } from './pades/signatureVerifier.js';

// ---------------------------------------------------------------------------
// ByteRange utilities
// ---------------------------------------------------------------------------

export {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  findSignatures,
} from './pades/byteRange.js';
export type { ByteRangeResult, PrepareAppearanceOptions } from './pades/byteRange.js';

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
} from './cms/pkcs7.js';
export type { SignerInfo, SignatureOptions } from './cms/pkcs7.js';

// ---------------------------------------------------------------------------
// Timestamp (RFC 3161)
// ---------------------------------------------------------------------------

export {
  requestTimestamp,
  buildTimestampRequest,
  parseTimestampResponse,
} from './cms/timestamp.js';
export type { TimestampResult } from './cms/timestamp.js';

// ---------------------------------------------------------------------------
// OCSP (RFC 6960)
// ---------------------------------------------------------------------------

export {
  buildOcspRequest,
  parseOcspResponse,
  checkCertificateStatus,
  extractOcspUrl,
} from './pki/ocsp.js';
export type { OcspResponse, OcspSingleResponse, OcspResult } from './pki/ocsp.js';

// ---------------------------------------------------------------------------
// CRL (X.509 v2)
// ---------------------------------------------------------------------------

export { parseCrl, downloadCrl, isCertificateRevoked, extractCrlUrls } from './pki/crl.js';
export type { CrlData, CrlEntry } from './pki/crl.js';

// ---------------------------------------------------------------------------
// Certificate chain validation
// ---------------------------------------------------------------------------

export { buildCertificateChain, validateCertificateChain } from './pki/chainValidator.js';
export type {
  CertificateChainResult,
  ChainValidationResult,
  ChainValidationOptions,
  CertificateStatus,
} from './pki/chainValidator.js';

// ---------------------------------------------------------------------------
// Offline revocation checking
// ---------------------------------------------------------------------------

export { extractEmbeddedRevocationData, verifyOfflineRevocation } from './pki/offlineRevocation.js';
export type { EmbeddedRevocationData, OfflineRevocationResult } from './pki/offlineRevocation.js';

// ---------------------------------------------------------------------------
// Custom trust store
// ---------------------------------------------------------------------------

export { TrustStore } from './pki/trustStore.js';
export type { TrustStoreOptions } from './pki/trustStore.js';

// ---------------------------------------------------------------------------
// Certificate policy validation
// ---------------------------------------------------------------------------

export {
  validateKeyUsage,
  validateExtendedKeyUsage,
  validateCertificatePolicy,
  EKU_OIDS,
} from './pki/certPolicy.js';
export type {
  KeyUsageFlag,
  KeyUsageValidationResult,
  EkuValidationResult,
  PolicyValidationOptions,
  PolicyValidationResult,
} from './pki/certPolicy.js';

// ---------------------------------------------------------------------------
// Revocation cache
// ---------------------------------------------------------------------------

export { RevocationCache, deriveCacheKey } from './internal/revocationCache.js';
export type {
  OcspCacheEntry,
  CrlCacheEntry,
  RevocationCacheOptions,
} from './internal/revocationCache.js';

// Re-export cache-specific types under qualified names to avoid conflict
// with the OCSP/CRL module types that share the same base names.
export type {
  OcspResult as CachedOcspResult,
  CrlData as CachedCrlData,
} from './internal/revocationCache.js';

// ---------------------------------------------------------------------------
// OCSP stapling
// ---------------------------------------------------------------------------

export { embedOcspResponse, extractStapledOcsp } from './internal/ocspStaple.js';

// ---------------------------------------------------------------------------
// Delta CRL
// ---------------------------------------------------------------------------

export { parseDeltaCrl, mergeCrls, isDeltaCrl } from './internal/deltaCrl.js';
export type { DeltaCrlData } from './internal/deltaCrl.js';

// ---------------------------------------------------------------------------
// Detailed verification
// ---------------------------------------------------------------------------

export { verifySignatureDetailed } from './pades/detailedVerifier.js';
export type {
  DetailedVerificationResult,
  DetailedVerifyOptions,
  CertificateInfo,
} from './pades/detailedVerifier.js';

// ---------------------------------------------------------------------------
// Incremental save with signature preservation
// ---------------------------------------------------------------------------

export {
  saveIncrementalWithSignaturePreservation,
  appendIncrementalUpdate,
  findExistingSignatures,
  validateByteRangeIntegrity,
  parseExistingTrailer,
} from './pades/incrementalSave.js';
export type {
  SignatureByteRange,
  IncrementalSaveOptions,
  AppendOptions,
  IncrementalObject,
  TrailerInfo,
} from './pades/incrementalSave.js';

// ---------------------------------------------------------------------------
// Multi-signature chain validation
// ---------------------------------------------------------------------------

export { validateSignatureChain } from './pades/multiSignatureValidator.js';
export type { SignatureChainEntry, SignatureChainResult } from './pades/multiSignatureValidator.js';

// ---------------------------------------------------------------------------
// MDP (DocMDP) certification policy
// ---------------------------------------------------------------------------

export {
  MdpPermission,
  setCertificationLevel,
  getCertificationLevel,
  buildDocMdpReference,
} from './pades/mdpPolicy.js';

// ---------------------------------------------------------------------------
// Modification detection
// ---------------------------------------------------------------------------

export { detectModifications } from './pades/modificationDetector.js';
export type {
  ModificationViolationType,
  ModificationViolation,
  ModificationReport,
} from './pades/modificationDetector.js';

// ---------------------------------------------------------------------------
// Signature field lock
// ---------------------------------------------------------------------------

export { addFieldLock, getFieldLocks, buildFieldLockDict } from './pades/fieldLock.js';
export type { FieldLockOptions, FieldLockInfo } from './pades/fieldLock.js';

// ---------------------------------------------------------------------------
// Document diff (signed vs current content)
// ---------------------------------------------------------------------------

export { diffSignedContent } from './pades/documentDiff.js';
export type { DocumentDiff, DiffEntry } from './pades/documentDiff.js';

// ---------------------------------------------------------------------------
// Counter-signatures
// ---------------------------------------------------------------------------

export { addCounterSignature, getCounterSignatures } from './cms/counterSignature.js';
export type { CounterSignatureInfo } from './cms/counterSignature.js';

// ---------------------------------------------------------------------------
// LTV (Long-Term Validation) embedding
// ---------------------------------------------------------------------------

export { embedLtvData, buildDssDictionary, hasLtvData } from './ltv/ltvEmbed.js';
export type { LtvOptions, DssData } from './ltv/ltvEmbed.js';

// ---------------------------------------------------------------------------
// Incremental save optimization
// ---------------------------------------------------------------------------

export {
  optimizeIncrementalSave,
  computeObjectHash,
  findChangedObjects,
} from './pades/incrementalOptimizer.js';
export type { IncrementalChange } from './pades/incrementalOptimizer.js';

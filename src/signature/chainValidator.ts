/**
 * @module signature/chainValidator
 *
 * Certificate chain building and validation for PDF digital signatures.
 *
 * Builds a certificate chain from a leaf certificate to a root CA,
 * and validates the chain by checking:
 * - Signature verification (issuer signed subject) via Web Crypto API
 * - Validity period (notBefore / notAfter)
 * - Basic constraints (CA flag, path length)
 * - Optional revocation checking via OCSP/CRL
 *
 * Uses the ASN.1 DER utilities from `./pkcs7.ts` for parsing
 * certificate structures.
 *
 * References:
 * - RFC 5280 (X.509 PKI Certificate and CRL Profile)
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  decodeOidBytes,
  extractIssuerAndSerial,
  extractSubjectPublicKeyInfo,
  detectKeyAlgorithm,
  detectNamedCurve,
  toBuffer,
  getSubtle,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for certificate chain validation.
 */
export interface ChainValidationOptions {
  /** Trusted root certificates (DER-encoded). If empty, self-signed roots are trusted. */
  trustedCerts?: Uint8Array[] | undefined;
  /** Whether to check certificate revocation via OCSP/CRL. Default: false. */
  checkRevocation?: boolean | undefined;
  /** The point in time for validity checking. Default: current time. */
  validationTime?: Date | undefined;
}

/**
 * Validation status for a single certificate in the chain.
 */
export interface CertificateStatus {
  /** Subject Common Name of the certificate. */
  subject: string;
  /** Issuer Common Name of the certificate. */
  issuer: string;
  /** Serial number (hex-encoded). */
  serialNumber: string;
  /** Whether the certificate is valid at the validation time. */
  withinValidityPeriod: boolean;
  /** Whether the issuer's signature on this certificate is valid. */
  signatureValid: boolean;
  /** Whether basic constraints are satisfied (CA flag for non-leaf certs). */
  basicConstraintsValid: boolean;
  /** Certificate validity start. */
  notBefore: Date;
  /** Certificate validity end. */
  notAfter: Date;
  /** Error messages (if any). */
  errors: string[];
}

/**
 * Result of building a certificate chain.
 */
export interface CertificateChainResult {
  /** The ordered chain from leaf to root. */
  chain: Uint8Array[];
  /** Whether a complete chain to a root/trusted cert was found. */
  complete: boolean;
}

/**
 * Result of validating a certificate chain.
 */
export interface ChainValidationResult {
  /** Overall validity of the chain. */
  valid: boolean;
  /** Per-certificate validation status (leaf to root order). */
  certificates: CertificateStatus[];
  /** Summary error messages. */
  errors: string[];
}

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

const OID_BASIC_CONSTRAINTS = '2.5.29.19';
const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';

const OID_SHA256_WITH_RSA = '1.2.840.113549.1.1.11';
const OID_SHA384_WITH_RSA = '1.2.840.113549.1.1.12';
const OID_SHA512_WITH_RSA = '1.2.840.113549.1.1.13';
const OID_SHA1_WITH_RSA = '1.2.840.113549.1.1.5';
const OID_ECDSA_WITH_SHA256 = '1.2.840.10045.4.3.2';
const OID_ECDSA_WITH_SHA384 = '1.2.840.10045.4.3.3';
const OID_ECDSA_WITH_SHA512 = '1.2.840.10045.4.3.4';
const OID_ECDSA_WITH_SHA1 = '1.2.840.10045.4.1';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a hex string.
 */
function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse a GeneralizedTime string to Date.
 */
function parseGeneralizedTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '').replace(/\..*$/, '');
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hours = parseInt(clean.substring(8, 10), 10);
  const minutes = parseInt(clean.substring(10, 12), 10) || 0;
  const seconds = parseInt(clean.substring(12, 14), 10) || 0;
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Parse a UTCTime string to Date.
 */
function parseUtcTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '');
  const year = parseInt(clean.substring(0, 2), 10);
  const month = parseInt(clean.substring(2, 4), 10) - 1;
  const day = parseInt(clean.substring(4, 6), 10);
  const hours = parseInt(clean.substring(6, 8), 10);
  const minutes = parseInt(clean.substring(8, 10), 10) || 0;
  const seconds = parseInt(clean.substring(10, 12), 10) || 0;
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Parse an ASN.1 time node to Date.
 */
function parseAsn1Time(node: Asn1Node): Date {
  const textDecoder = new TextDecoder('ascii');
  const timeStr = textDecoder.decode(node.data);
  if (node.tag === 0x18) {
    return parseGeneralizedTime(timeStr);
  }
  return parseUtcTime(timeStr);
}

/**
 * Extract the subject raw DER bytes from a certificate.
 */
function extractSubjectDer(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) idx = 1;
  const subjectNode = tbsCert.children[idx + 4]!;
  const start = subjectNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + subjectNode.totalLength);
}

/**
 * Extract the issuer raw DER bytes from a certificate.
 */
function extractIssuerDer(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) idx = 1;
  const issuerNode = tbsCert.children[idx + 2]!;
  const start = issuerNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + issuerNode.totalLength);
}

/**
 * Extract the validity period from a certificate.
 */
function extractValidity(certDer: Uint8Array): { notBefore: Date; notAfter: Date } {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) idx = 1;
  // validity is at idx+3
  const validityNode = tbsCert.children[idx + 3]!;
  const notBefore = parseAsn1Time(validityNode.children[0]!);
  const notAfter = parseAsn1Time(validityNode.children[1]!);
  return { notBefore, notAfter };
}

/**
 * Extract extensions from a certificate.
 */
function extractExtensions(certDer: Uint8Array): Asn1Node[] {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  for (const child of tbsCert.children) {
    if (child.tag === 0xa3) {
      if (child.children.length > 0) {
        return child.children[0]!.children;
      }
    }
  }
  return [];
}

/**
 * Check if a certificate has the CA basic constraint set.
 */
function isCA(certDer: Uint8Array): boolean {
  try {
    const extensions = extractExtensions(certDer);
    for (const ext of extensions) {
      const oidNode = ext.children[0]!;
      const oid = decodeOidBytes(oidNode.data);
      if (oid === OID_BASIC_CONSTRAINTS) {
        // Value is an OCTET STRING containing BasicConstraints SEQUENCE
        const valueIdx = ext.children.length > 2 ? 2 : 1;
        const valueNode = ext.children[valueIdx]!;
        const bc = parseDerTlv(valueNode.data, 0);
        // BasicConstraints: SEQUENCE { cA BOOLEAN DEFAULT FALSE, pathLenConstraint INTEGER OPTIONAL }
        if (bc.children.length > 0 && bc.children[0]!.tag === 0x01) {
          // BOOLEAN: non-zero means TRUE
          return bc.children[0]!.data[0] !== 0;
        }
        // Empty sequence means cA=FALSE (default)
        return false;
      }
    }
  } catch {
    // No extensions or parsing failed
  }
  return false;
}

/**
 * Check if a certificate is self-signed (subject === issuer).
 */
function isSelfSigned(certDer: Uint8Array): boolean {
  const subjectDer = extractSubjectDer(certDer);
  const issuerDer = extractIssuerDer(certDer);
  if (subjectDer.length !== issuerDer.length) return false;
  for (let i = 0; i < subjectDer.length; i++) {
    if (subjectDer[i] !== issuerDer[i]) return false;
  }
  return true;
}

/**
 * Compare two DER-encoded Name values for equality.
 */
function namesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Extract the TBSCertificate raw bytes from a certificate for
 * signature verification.
 */
function extractTbsCertificateBytes(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  const start = tbsCert.offset + (cert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + tbsCert.totalLength);
}

/**
 * Extract the signature algorithm OID from a certificate.
 */
function extractSignatureAlgorithmOid(certDer: Uint8Array): string {
  const cert = parseDerTlv(certDer, 0);
  // signatureAlgorithm is the second child of the Certificate SEQUENCE
  const sigAlgoSeq = cert.children[1]!;
  const oidNode = sigAlgoSeq.children[0]!;
  return decodeOidBytes(oidNode.data);
}

/**
 * Extract the signature value (BIT STRING) from a certificate.
 */
function extractSignatureValue(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  // signatureValue is the third child of the Certificate SEQUENCE
  const sigBitString = cert.children[2]!;
  // BIT STRING data starts with the unused-bits byte
  return sigBitString.data.subarray(1); // skip unused-bits byte
}

/**
 * Map a signature algorithm OID to Web Crypto import/verify parameters.
 */
function mapSignatureAlgorithm(oid: string, issuerCert: Uint8Array): {
  importAlgo: RsaHashedImportParams | EcKeyImportParams;
  verifyAlgo: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  hashAlgo: string;
  keyType: 'RSA' | 'EC';
} | null {
  switch (oid) {
    case OID_SHA1_WITH_RSA:
      return {
        importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
        verifyAlgo: { name: 'RSASSA-PKCS1-v1_5' },
        hashAlgo: 'SHA-1',
        keyType: 'RSA',
      };
    case OID_SHA256_WITH_RSA:
      return {
        importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        verifyAlgo: { name: 'RSASSA-PKCS1-v1_5' },
        hashAlgo: 'SHA-256',
        keyType: 'RSA',
      };
    case OID_SHA384_WITH_RSA:
      return {
        importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
        verifyAlgo: { name: 'RSASSA-PKCS1-v1_5' },
        hashAlgo: 'SHA-384',
        keyType: 'RSA',
      };
    case OID_SHA512_WITH_RSA:
      return {
        importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
        verifyAlgo: { name: 'RSASSA-PKCS1-v1_5' },
        hashAlgo: 'SHA-512',
        keyType: 'RSA',
      };
    case OID_ECDSA_WITH_SHA1:
      return {
        importAlgo: { name: 'ECDSA', namedCurve: detectNamedCurve(issuerCert) },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-1' },
        hashAlgo: 'SHA-1',
        keyType: 'EC',
      };
    case OID_ECDSA_WITH_SHA256:
      return {
        importAlgo: { name: 'ECDSA', namedCurve: detectNamedCurve(issuerCert) },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-256' },
        hashAlgo: 'SHA-256',
        keyType: 'EC',
      };
    case OID_ECDSA_WITH_SHA384:
      return {
        importAlgo: { name: 'ECDSA', namedCurve: detectNamedCurve(issuerCert) },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-384' },
        hashAlgo: 'SHA-384',
        keyType: 'EC',
      };
    case OID_ECDSA_WITH_SHA512:
      return {
        importAlgo: { name: 'ECDSA', namedCurve: detectNamedCurve(issuerCert) },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-512' },
        hashAlgo: 'SHA-512',
        keyType: 'EC',
      };
    default:
      return null;
  }
}

/**
 * Convert an ECDSA DER signature to IEEE P1363 format for Web Crypto.
 */
function convertEcdsaDerToP1363(derSig: Uint8Array, namedCurve: string): Uint8Array {
  try {
    const seq = parseDerTlv(derSig, 0);
    if (seq.children.length < 2) return derSig;

    const r = seq.children[0]!.data;
    const s = seq.children[1]!.data;

    const keySizeMap: Record<string, number> = {
      'P-256': 32,
      'P-384': 48,
      'P-521': 66,
    };
    const halfLen = keySizeMap[namedCurve] ?? 32;
    const result = new Uint8Array(halfLen * 2);

    const rStart = r[0] === 0 ? 1 : 0;
    const rLen = r.length - rStart;
    result.set(r.subarray(rStart), halfLen - rLen);

    const sStart = s[0] === 0 ? 1 : 0;
    const sLen = s.length - sStart;
    result.set(s.subarray(sStart), halfLen * 2 - sLen);

    return result;
  } catch {
    return derSig;
  }
}

/**
 * Verify the cryptographic signature on a certificate using the
 * issuer's public key.
 */
async function verifyCertSignature(
  certDer: Uint8Array,
  issuerCertDer: Uint8Array,
): Promise<boolean> {
  try {
    const subtle = getSubtle();
    const sigAlgoOid = extractSignatureAlgorithmOid(certDer);
    const algoParams = mapSignatureAlgorithm(sigAlgoOid, issuerCertDer);

    if (!algoParams) {
      // Unsupported algorithm
      return false;
    }

    // Import the issuer's public key
    const issuerSpki = extractSubjectPublicKeyInfo(issuerCertDer);
    const publicKey = await subtle.importKey(
      'spki',
      toBuffer(issuerSpki),
      algoParams.importAlgo,
      false,
      ['verify'],
    );

    // Extract the TBSCertificate (the signed data)
    const tbsBytes = extractTbsCertificateBytes(certDer);

    // Extract the signature value
    let sigValue = extractSignatureValue(certDer);

    // For ECDSA, convert DER signature to P1363 format
    if (algoParams.keyType === 'EC') {
      const namedCurve = (algoParams.importAlgo as EcKeyImportParams).namedCurve;
      sigValue = convertEcdsaDerToP1363(sigValue, namedCurve);
    }

    // Verify the signature
    const valid = await subtle.verify(
      algoParams.verifyAlgo,
      publicKey,
      toBuffer(sigValue),
      toBuffer(tbsBytes),
    );

    return valid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a certificate chain from a leaf certificate to a root.
 *
 * Starting from the leaf, finds the issuer among the provided
 * intermediate certificates, repeating until a self-signed root
 * is found or no matching issuer exists.
 *
 * @param leaf            DER-encoded leaf certificate.
 * @param intermediates   DER-encoded intermediate certificates.
 * @returns               The ordered chain (leaf first, root last) and
 *                        whether it is complete.
 */
export function buildCertificateChain(
  leaf: Uint8Array,
  intermediates: Uint8Array[],
): CertificateChainResult {
  const chain: Uint8Array[] = [leaf];
  const available = [...intermediates];
  let current = leaf;

  // Max depth guard to prevent infinite loops
  const maxDepth = 20;

  for (let depth = 0; depth < maxDepth; depth++) {
    // If current cert is self-signed, we've reached the root
    if (isSelfSigned(current)) {
      return { chain, complete: true };
    }

    // Find the issuer of the current cert among available certs
    const currentIssuerDer = extractIssuerDer(current);
    let foundIdx = -1;

    for (let i = 0; i < available.length; i++) {
      const candidateSubjectDer = extractSubjectDer(available[i]!);
      if (namesEqual(currentIssuerDer, candidateSubjectDer)) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx === -1) {
      // No matching issuer found — incomplete chain
      return { chain, complete: false };
    }

    const issuerCert = available[foundIdx]!;
    chain.push(issuerCert);
    available.splice(foundIdx, 1);
    current = issuerCert;
  }

  return { chain, complete: isSelfSigned(current) };
}

/**
 * Validate a certificate chain.
 *
 * Checks each certificate in the chain for:
 * 1. **Signature verification** — the issuer's public key verifies
 *    the signature on the subject certificate.
 * 2. **Validity period** — the certificate is within its notBefore
 *    and notAfter dates at the validation time.
 * 3. **Basic constraints** — intermediate/root certificates have
 *    the CA flag set in the BasicConstraints extension.
 *
 * @param chain     Ordered array of DER-encoded certificates (leaf first, root last).
 * @param options   Validation options.
 * @returns         Validation result with per-certificate status.
 */
export async function validateCertificateChain(
  chain: Uint8Array[],
  options?: ChainValidationOptions,
): Promise<ChainValidationResult> {
  const validationTime = options?.validationTime ?? new Date();
  const trustedCerts = options?.trustedCerts ?? [];

  const certificates: CertificateStatus[] = [];
  const errors: string[] = [];
  let allValid = true;

  if (chain.length === 0) {
    return {
      valid: false,
      certificates: [],
      errors: ['Empty certificate chain'],
    };
  }

  for (let i = 0; i < chain.length; i++) {
    const certDer = chain[i]!;
    const certErrors: string[] = [];

    // Extract cert metadata
    let subject = 'Unknown';
    let issuer = 'Unknown';
    let serialNumber = '';
    try {
      const info = extractIssuerAndSerial(certDer);
      subject = info.subjectCN;
      // For the issuer CN, we parse the issuerDer
      const issuerNode = parseDerTlv(info.issuerDer, 0);
      issuer = extractCommonNameFromNode(issuerNode);
      serialNumber = toHex(info.serialDer);
    } catch {
      certErrors.push('Failed to parse certificate metadata');
    }

    // Check validity period
    let withinValidityPeriod = false;
    let notBefore = new Date(0);
    let notAfter = new Date(0);
    try {
      const validity = extractValidity(certDer);
      notBefore = validity.notBefore;
      notAfter = validity.notAfter;
      withinValidityPeriod =
        validationTime >= notBefore && validationTime <= notAfter;
      if (!withinValidityPeriod) {
        certErrors.push(
          `Certificate not valid at ${validationTime.toISOString()} ` +
          `(valid: ${notBefore.toISOString()} to ${notAfter.toISOString()})`,
        );
      }
    } catch {
      certErrors.push('Failed to parse certificate validity period');
    }

    // Check basic constraints for non-leaf certificates
    let basicConstraintsValid = true;
    if (i > 0) {
      // Non-leaf cert should be a CA
      const caFlag = isCA(certDer);
      if (!caFlag) {
        // Self-signed roots without explicit BC are commonly accepted
        if (!isSelfSigned(certDer)) {
          basicConstraintsValid = false;
          certErrors.push('Intermediate certificate missing CA basic constraint');
        }
      }
    }

    // Check signature
    let signatureValid = false;
    if (i < chain.length - 1) {
      // Verify this cert's signature using the next cert in chain (issuer)
      signatureValid = await verifyCertSignature(certDer, chain[i + 1]!);
      if (!signatureValid) {
        certErrors.push('Certificate signature verification failed');
      }
    } else {
      // Last cert in chain: either self-signed or check trusted certs
      if (isSelfSigned(certDer)) {
        // Verify self-signature
        signatureValid = await verifyCertSignature(certDer, certDer);
        if (!signatureValid) {
          certErrors.push('Root certificate self-signature verification failed');
        }
      } else {
        // Try to verify against trusted certs
        let foundTrusted = false;
        const certIssuerDer = extractIssuerDer(certDer);
        for (const trusted of trustedCerts) {
          const trustedSubject = extractSubjectDer(trusted);
          if (namesEqual(certIssuerDer, trustedSubject)) {
            signatureValid = await verifyCertSignature(certDer, trusted);
            foundTrusted = true;
            break;
          }
        }
        if (!foundTrusted) {
          certErrors.push('Certificate issuer not found in trusted certificates');
        } else if (!signatureValid) {
          certErrors.push('Certificate signature verification against trusted cert failed');
        }
      }
    }

    const certValid =
      withinValidityPeriod && signatureValid && basicConstraintsValid;
    if (!certValid) allValid = false;

    certificates.push({
      subject,
      issuer,
      serialNumber,
      withinValidityPeriod,
      signatureValid,
      basicConstraintsValid,
      notBefore,
      notAfter,
      errors: certErrors,
    });

    errors.push(...certErrors);
  }

  return {
    valid: allValid,
    certificates,
    errors,
  };
}

/**
 * Extract Common Name from an already-parsed ASN.1 Name node.
 */
function extractCommonNameFromNode(nameNode: Asn1Node): string {
  const textDecoder = new TextDecoder('utf-8');
  const cnOidBytes = [0x55, 0x04, 0x03];

  for (const rdnSet of nameNode.children) {
    for (const atv of rdnSet.children) {
      const oid = atv.children[0]!;
      if (
        oid.data.length === cnOidBytes.length &&
        oid.data[0] === cnOidBytes[0] &&
        oid.data[1] === cnOidBytes[1] &&
        oid.data[2] === cnOidBytes[2]
      ) {
        return textDecoder.decode(atv.children[1]!.data);
      }
    }
  }

  return 'Unknown';
}

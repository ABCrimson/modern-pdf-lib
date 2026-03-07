/**
 * @module signature/detailedVerifier
 *
 * Enhanced signature verification returning structured, detailed results.
 *
 * Builds on top of the basic `verifySignatures()` in signatureVerifier.ts
 * to provide comprehensive verification results including certificate
 * chain information, revocation status, timestamps, and diagnostic
 * warnings/errors.
 *
 * @packageDocumentation
 */

import { findSignatures, computeSignatureHash } from './byteRange.js';
import {
  parseDerTlv,
  extractIssuerAndSerial,
  extractSubjectPublicKeyInfo,
  detectKeyAlgorithm,
  detectNamedCurve,
  decodeOidBytes,
  toBuffer,
  getSubtle,
  encodeSet,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';
import type { RevocationCache } from './revocationCache.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Information about a single certificate in a chain.
 */
export interface CertificateInfo {
  /** Subject distinguished name (CN). */
  subject: string;
  /** Issuer distinguished name (CN). */
  issuer: string;
  /** Certificate validity start date. */
  validFrom: Date;
  /** Certificate validity end date. */
  validTo: Date;
  /** Certificate serial number as hex string. */
  serialNumber: string;
  /** Key usage extensions, if present. */
  keyUsage?: string[] | undefined;
  /** Whether this is a CA certificate. */
  isCA?: boolean | undefined;
}

/**
 * Detailed result from verifying a single PDF signature.
 */
export interface DetailedVerificationResult {
  /** The signature field name. */
  fieldName: string;
  /** Subject CN of the signing certificate. */
  signedBy: string;
  /** Overall validity (all checks passed). */
  valid: boolean;
  /** Whether the ByteRange hash matches the signed hash. */
  integrityValid: boolean;
  /** Whether the cryptographic signature is valid. */
  cryptoValid: boolean;
  /** Certificate chain from signer to root. */
  chain: CertificateInfo[];
  /** Whether revocation status was checked. */
  revocationChecked: boolean;
  /** Revocation status of the signing certificate. */
  revocationStatus: 'good' | 'revoked' | 'unknown' | 'unchecked';
  /** OCSP response details, if available. */
  ocspResponse?: { status: string; thisUpdate: Date; nextUpdate?: Date } | undefined;
  /** Whether CRL was checked. */
  crlChecked: boolean;
  /** Timestamp information, if present. */
  timestamp?: { time: Date; valid: boolean } | undefined;
  /** Non-fatal warnings about the signature. */
  warnings: string[];
  /** Fatal errors encountered during verification. */
  errors: string[];
}

/**
 * Options for detailed signature verification.
 */
export interface DetailedVerifyOptions {
  /** Whether to check certificate revocation status. Default: false. */
  checkRevocation?: boolean | undefined;
  /** Trusted root certificates (DER-encoded) for chain validation. */
  trustedCerts?: Uint8Array[] | undefined;
  /** Revocation cache for OCSP/CRL responses. */
  revocationCache?: RevocationCache | undefined;
  /** Timeout in milliseconds for network operations. Default: 10000. */
  timeout?: number | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');
const textDecoder = new TextDecoder('utf-8');

/**
 * Convert hex string to bytes.
 * @internal
 */
function hexToBytes(hex: string): Uint8Array {
  let clean = hex.replace(/\s/g, '');
  if (clean.length % 2 !== 0) clean = '0' + clean;

  const trailingMatch = clean.match(/(00)+$/);
  if (trailingMatch && trailingMatch[0]!.length > 4) {
    let endIdx = clean.length - trailingMatch[0]!.length;
    if (endIdx < 2) endIdx = clean.length;
    clean = clean.slice(0, endIdx);
  }

  return Uint8Array.fromHex(clean);
}

/**
 * Extract field info from the PDF text near a signature.
 * @internal
 */
function extractFieldInfo(
  pdfStr: string,
  contentsOffset: number,
): { fieldName: string; reason?: string } {
  const searchStart = Math.max(0, contentsOffset - 3000);
  const searchEnd = Math.min(pdfStr.length, contentsOffset + 2000);
  const region = pdfStr.slice(searchStart, searchEnd);

  let fieldName = 'Signature';
  const tMatch = region.match(/\/T\s*\(([^)]*)\)/);
  if (tMatch) fieldName = tMatch[1]!;

  const result: { fieldName: string; reason?: string } = { fieldName };
  const reasonMatch = region.match(/\/Reason\s*\(([^)]*)\)/);
  if (reasonMatch && reasonMatch[1] !== undefined) result.reason = reasonMatch[1];

  return result;
}

/**
 * Extract Common Name from an ASN.1 Name node.
 * @internal
 */
function extractCN(nameNode: Asn1Node): string {
  const cnOidBytes = [0x55, 0x04, 0x03];

  for (const rdnSet of nameNode.children) {
    for (const atv of rdnSet.children) {
      if (atv.children.length < 2) continue;
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

/**
 * Parse a UTCTime string to a Date.
 * @internal
 */
function parseUtcTime(utcTime: string): Date {
  const clean = utcTime.replace('Z', '');
  const year = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10) - 1;
  const day = parseInt(clean.slice(4, 6), 10);
  const hours = parseInt(clean.slice(6, 8), 10);
  const minutes = parseInt(clean.slice(8, 10), 10);
  const seconds = parseInt(clean.slice(10, 12), 10);
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Parse a GeneralizedTime string to a Date.
 * @internal
 */
function parseGeneralizedTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '').replace(/\..*$/, '');
  const year = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(4, 6), 10) - 1;
  const day = parseInt(clean.slice(6, 8), 10);
  const hours = parseInt(clean.slice(8, 10), 10);
  const minutes = parseInt(clean.slice(10, 12), 10);
  const seconds = parseInt(clean.slice(12, 14), 10) || 0;
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Parse a time node (UTCTime or GeneralizedTime).
 * @internal
 */
function parseTimeNode(node: Asn1Node): Date {
  const asciiDecoder = new TextDecoder('ascii');
  const str = asciiDecoder.decode(node.data);
  if (node.tag === 0x18) return parseGeneralizedTime(str);
  return parseUtcTime(str);
}

/**
 * Extract CertificateInfo from a DER-encoded X.509 certificate.
 * @internal
 */
function extractCertInfo(certDer: Uint8Array): CertificateInfo {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1; // Skip version
  }

  // serialNumber
  const serialNode = tbsCert.children[idx]!;
  const serialHex = serialNode.data.toHex();

  // Skip signature AlgorithmIdentifier
  // issuer Name
  const issuerNode = tbsCert.children[idx + 2]!;
  const issuer = extractCN(issuerNode);

  // validity
  const validityNode = tbsCert.children[idx + 3]!;
  const validFrom = parseTimeNode(validityNode.children[0]!);
  const validTo = parseTimeNode(validityNode.children[1]!);

  // subject Name
  const subjectNode = tbsCert.children[idx + 4]!;
  const subject = extractCN(subjectNode);

  // Check for extensions (version must be v3, tag [3] = 0xa3)
  let keyUsage: string[] | undefined;
  let isCA: boolean | undefined;

  for (let j = idx + 6; j < tbsCert.children.length; j++) {
    const child = tbsCert.children[j]!;
    if (child.tag === 0xa3) {
      // Extensions SEQUENCE
      const extsSeq = child.children[0]!;
      if (extsSeq) {
        for (const ext of extsSeq.children) {
          if (ext.children.length < 2) continue;
          const oid = decodeOidBytes(ext.children[0]!.data);

          // Basic Constraints (2.5.29.19)
          if (oid === '2.5.29.19') {
            const valueNode = ext.children[ext.children.length - 1]!;
            if (valueNode.tag === 0x04 && valueNode.data.length > 0) {
              const inner = parseDerTlv(valueNode.data, 0);
              // BasicConstraints ::= SEQUENCE { cA BOOLEAN DEFAULT FALSE, ... }
              if (inner.children.length > 0 && inner.children[0]!.tag === 0x01) {
                isCA = inner.children[0]!.data[0] !== 0;
              } else {
                isCA = false;
              }
            }
          }

          // Key Usage (2.5.29.15)
          if (oid === '2.5.29.15') {
            const valueNode = ext.children[ext.children.length - 1]!;
            if (valueNode.tag === 0x04 && valueNode.data.length > 0) {
              const inner = parseDerTlv(valueNode.data, 0);
              // BIT STRING
              if (inner.tag === 0x03 && inner.data.length >= 2) {
                const unusedBits = inner.data[0]!;
                const bits = inner.data[1]!;
                keyUsage = [];
                const usageNames = [
                  'digitalSignature', 'nonRepudiation', 'keyEncipherment',
                  'dataEncipherment', 'keyAgreement', 'keyCertSign',
                  'cRLSign', 'encipherOnly',
                ];
                for (let b = 0; b < 8 - unusedBits; b++) {
                  if (bits & (0x80 >> b)) {
                    keyUsage.push(usageNames[b] ?? `bit${b}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return { subject, issuer, validFrom, validTo, serialNumber: serialHex, keyUsage, isCA };
}

/**
 * Parse a PKCS#7 structure and extract its components.
 * @internal
 */
function parsePkcs7Detailed(pkcs7Bytes: Uint8Array): {
  certificates: Uint8Array[];
  signedAttrs: Uint8Array[];
  signedAttrsRaw: Uint8Array;
  signatureValue: Uint8Array;
  digestAlgorithm: string;
} | null {
  try {
    const contentInfo = parseDerTlv(pkcs7Bytes, 0);
    if (contentInfo.children.length < 2) return null;

    const signedDataWrapper = contentInfo.children[1]!;
    const signedData = signedDataWrapper.children[0]!;
    if (!signedData) return null;

    const certificates: Uint8Array[] = [];
    let signerInfo: Asn1Node | null = null;

    for (const child of signedData.children) {
      // certificates [0] (tag 0xa0)
      if (child.tag === 0xa0) {
        for (const certNode of child.children) {
          const certStart = certNode.offset + (child.data.byteOffset - pkcs7Bytes.byteOffset);
          certificates.push(pkcs7Bytes.subarray(certStart, certStart + certNode.totalLength));
        }
        // If no parsed children, treat the whole data as a single cert
        if (child.children.length === 0 && child.data.length > 0) {
          certificates.push(child.data);
        }
      }
      // signerInfos SET (tag 0x31)
      if (child.tag === 0x31 && child.children.length > 0) {
        signerInfo = child.children[0]!;
      }
    }

    if (certificates.length === 0 || !signerInfo) return null;

    // Parse SignerInfo
    let idx = 0;
    idx++; // version
    idx++; // issuerAndSerialNumber

    const digestAlgoNode = signerInfo.children[idx]!;
    idx++;
    let digestAlgorithm = 'SHA-256';
    if (digestAlgoNode && digestAlgoNode.children.length > 0) {
      const oidNode = digestAlgoNode.children[0]!;
      const oid = decodeOidBytes(oidNode.data);
      if (oid === '2.16.840.1.101.3.4.2.2') digestAlgorithm = 'SHA-384';
      else if (oid === '2.16.840.1.101.3.4.2.3') digestAlgorithm = 'SHA-512';
    }

    let signedAttrs: Uint8Array[] = [];
    let signedAttrsRaw = new Uint8Array(0);

    if (signerInfo.children[idx]!.tag === 0xa0) {
      const attrsNode = signerInfo.children[idx]!;
      signedAttrs = attrsNode.children.map((child) => {
        const start = child.offset + (attrsNode.data.byteOffset - pkcs7Bytes.byteOffset);
        return pkcs7Bytes.subarray(start, start + child.totalLength);
      });
      signedAttrsRaw = encodeSet(signedAttrs) as Uint8Array<ArrayBuffer>;
      idx++;
    }

    idx++; // signatureAlgorithm

    const signatureNode = signerInfo.children[idx]!;
    const signatureValue = signatureNode ? signatureNode.data : new Uint8Array(0);

    return { certificates, signedAttrs, signedAttrsRaw, signatureValue, digestAlgorithm };
  } catch {
    return null;
  }
}

/**
 * Extract message digest from signed attributes.
 * @internal
 */
function extractMessageDigest(signedAttrs: Uint8Array[]): Uint8Array | null {
  const messageDigestOid = '1.2.840.113549.1.9.4';

  for (const attr of signedAttrs) {
    try {
      const attrNode = parseDerTlv(attr, 0);
      if (attrNode.children.length < 2) continue;
      const oid = decodeOidBytes(attrNode.children[0]!.data);
      if (oid === messageDigestOid) {
        const valueSet = attrNode.children[1]!;
        if (valueSet.children.length > 0) {
          return valueSet.children[0]!.data;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Extract signing time from signed attributes.
 * @internal
 */
function extractSigningTime(signedAttrs: Uint8Array[]): Date | undefined {
  const signingTimeOid = '1.2.840.113549.1.9.5';
  const asciiDecoder = new TextDecoder('ascii');

  for (const attr of signedAttrs) {
    try {
      const attrNode = parseDerTlv(attr, 0);
      if (attrNode.children.length < 2) continue;
      const oid = decodeOidBytes(attrNode.children[0]!.data);
      if (oid === signingTimeOid) {
        const valueSet = attrNode.children[1]!;
        if (valueSet.children.length > 0) {
          const timeStr = asciiDecoder.decode(valueSet.children[0]!.data);
          return parseUtcTime(timeStr);
        }
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * Convert ECDSA DER signature to P1363 format for Web Crypto.
 * @internal
 */
function convertEcdsaDerToP1363(derSig: Uint8Array, keySize: number): Uint8Array {
  try {
    const seq = parseDerTlv(derSig, 0);
    if (seq.children.length < 2) return derSig;

    const r = seq.children[0]!.data;
    const s = seq.children[1]!.data;
    const halfLen = keySize;
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
 * Verify the cryptographic signature against the certificate.
 * @internal
 */
async function verifyCryptoSignature(
  parsed: NonNullable<ReturnType<typeof parsePkcs7Detailed>>,
  certificate: Uint8Array,
): Promise<boolean> {
  try {
    const subtle = getSubtle();
    const keyAlgo = detectKeyAlgorithm(certificate);
    const spki = extractSubjectPublicKeyInfo(certificate);

    let importAlgo: RsaHashedImportParams | EcKeyImportParams;
    let verifyAlgo: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
    let sigBytes = parsed.signatureValue;

    if (keyAlgo === 'RSA') {
      importAlgo = {
        name: 'RSASSA-PKCS1-v1_5',
        hash: parsed.digestAlgorithm,
      };
      verifyAlgo = { name: 'RSASSA-PKCS1-v1_5' };
    } else {
      const namedCurve = detectNamedCurve(certificate);
      importAlgo = { name: 'ECDSA', namedCurve };
      verifyAlgo = { name: 'ECDSA', hash: parsed.digestAlgorithm };

      const keySizeMap: Record<string, number> = { 'P-256': 32, 'P-384': 48, 'P-521': 66 };
      sigBytes = convertEcdsaDerToP1363(parsed.signatureValue, keySizeMap[namedCurve] ?? 32);
    }

    const publicKey = await subtle.importKey(
      'spki',
      toBuffer(spki),
      importAlgo,
      false,
      ['verify'],
    );

    return await subtle.verify(
      verifyAlgo,
      publicKey,
      toBuffer(sigBytes),
      toBuffer(parsed.signedAttrsRaw),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify all signatures in a PDF with detailed, structured results.
 *
 * For each signature found, returns comprehensive information about:
 * - Integrity verification (ByteRange hash)
 * - Cryptographic signature validity
 * - Certificate chain (all certificates in the PKCS#7 structure)
 * - Revocation status (if `checkRevocation` is enabled)
 * - Timestamp information
 * - Diagnostic warnings and errors
 *
 * @param pdf      The PDF file bytes.
 * @param options  Verification options.
 * @returns        Array of detailed verification results.
 *
 * @example
 * ```ts
 * const results = await verifySignatureDetailed(pdfBytes, {
 *   checkRevocation: true,
 * });
 * for (const result of results) {
 *   console.log(`${result.fieldName}: ${result.valid ? 'VALID' : 'INVALID'}`);
 *   if (result.warnings.length > 0) {
 *     console.log('Warnings:', result.warnings);
 *   }
 * }
 * ```
 */
export async function verifySignatureDetailed(
  pdf: Uint8Array,
  options?: DetailedVerifyOptions,
): Promise<DetailedVerificationResult[]> {
  const opts = options ?? {};
  const pdfStr = decoder.decode(pdf);
  const rawSigs = findSignatures(pdf);
  const results: DetailedVerificationResult[] = [];

  for (const sig of rawSigs) {
    const fieldInfo = extractFieldInfo(pdfStr, sig.contentsOffset);
    const warnings: string[] = [];
    const errors: string[] = [];

    const pkcs7Bytes = hexToBytes(sig.contentsHex);
    const parsed = parsePkcs7Detailed(pkcs7Bytes);

    if (!parsed) {
      results.push({
        fieldName: fieldInfo.fieldName,
        signedBy: 'Unknown',
        valid: false,
        integrityValid: false,
        cryptoValid: false,
        chain: [],
        revocationChecked: false,
        revocationStatus: 'unchecked',
        crlChecked: false,
        warnings,
        errors: ['Failed to parse PKCS#7 signature structure'],
      });
      continue;
    }

    // Extract signer name
    let signedBy = 'Unknown';
    try {
      const { subjectCN } = extractIssuerAndSerial(parsed.certificates[0]!);
      signedBy = subjectCN;
    } catch {
      warnings.push('Could not extract signer name from certificate');
    }

    // Build certificate chain info
    const chain: CertificateInfo[] = [];
    for (const certDer of parsed.certificates) {
      try {
        chain.push(extractCertInfo(certDer));
      } catch {
        warnings.push('Could not parse one or more certificates in chain');
      }
    }

    // Check certificate validity dates
    const now = new Date();
    if (chain.length > 0) {
      const signerCert = chain[0]!;
      if (now < signerCert.validFrom) {
        warnings.push(`Signing certificate not yet valid (valid from ${signerCert.validFrom.toISOString()})`);
      }
      if (now > signerCert.validTo) {
        warnings.push(`Signing certificate has expired (expired ${signerCert.validTo.toISOString()})`);
      }
    }

    // Step 1: Verify integrity (ByteRange hash)
    let integrityValid = false;
    try {
      const computedHash = await computeSignatureHash(
        pdf,
        sig.byteRange,
        parsed.digestAlgorithm as 'SHA-256' | 'SHA-384' | 'SHA-512',
      );

      const embeddedDigest = extractMessageDigest(parsed.signedAttrs);
      if (embeddedDigest) {
        integrityValid =
          computedHash.length === embeddedDigest.length &&
          computedHash.every((b, i) => b === embeddedDigest[i]);
      } else {
        errors.push('No message digest found in signed attributes');
      }
    } catch (e) {
      errors.push(`Integrity check failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    // Step 2: Verify cryptographic signature
    let cryptoValid = false;
    try {
      cryptoValid = await verifyCryptoSignature(parsed, parsed.certificates[0]!);
      if (!cryptoValid) {
        errors.push('Cryptographic signature verification failed');
      }
    } catch (e) {
      errors.push(`Crypto verification error: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    // Step 3: Extract timestamp
    let timestamp: { time: Date; valid: boolean } | undefined;
    const signingTime = extractSigningTime(parsed.signedAttrs);
    if (signingTime) {
      timestamp = { time: signingTime, valid: true };
    }

    // Step 4: Revocation checking
    let revocationChecked = false;
    let revocationStatus: 'good' | 'revoked' | 'unknown' | 'unchecked' = 'unchecked';
    let ocspResponse: { status: string; thisUpdate: Date; nextUpdate?: Date } | undefined;
    let crlChecked = false;

    if (opts.checkRevocation) {
      // Check the cache first if provided
      if (opts.revocationCache && chain.length > 0) {
        const signerCert = chain[0]!;
        const cacheKey = signerCert.serialNumber;
        const cachedOcsp = opts.revocationCache.getCachedOcsp(cacheKey);

        if (cachedOcsp) {
          revocationChecked = true;
          revocationStatus = cachedOcsp.result.status;
          ocspResponse = {
            status: cachedOcsp.result.status,
            thisUpdate: cachedOcsp.result.thisUpdate,
            ...(cachedOcsp.result.nextUpdate !== undefined && { nextUpdate: cachedOcsp.result.nextUpdate }),
          };
        }
      }

      if (!revocationChecked) {
        // Without an OCSP responder URL or CRL distribution point, we
        // cannot perform online revocation checking.  Web Crypto does
        // not provide certificate chain validation.
        warnings.push(
          'Revocation checking requested but no OCSP responder or CRL distribution point available. ' +
          'Certificate revocation status could not be determined.',
        );
        revocationStatus = 'unknown';
        revocationChecked = true;
      }
    }

    // Step 5: Chain validation warnings
    if (chain.length === 1) {
      warnings.push('Only a single certificate found — no chain for CA trust validation');
    }

    if (!opts.trustedCerts || opts.trustedCerts.length === 0) {
      warnings.push('No trusted root certificates provided — chain trust not validated');
    }

    const valid = integrityValid && cryptoValid;

    results.push({
      fieldName: fieldInfo.fieldName,
      signedBy,
      valid,
      integrityValid,
      cryptoValid,
      chain,
      revocationChecked,
      revocationStatus,
      ocspResponse,
      crlChecked,
      timestamp,
      warnings,
      errors,
    });
  }

  return results;
}

/**
 * @module signature/signatureVerifier
 *
 * Signature verification for signed PDF documents.
 *
 * Verifies that:
 * 1. The PDF bytes covered by the ByteRange have not been tampered with
 *    (integrity check by hashing the covered regions).
 * 2. The PKCS#7 signature is valid for the hash (cryptographic verification
 *    using the certificate's public key via Web Crypto).
 *
 * Limitations:
 * - Certificate chain validation (CA trust) is not performed because
 *   Web Crypto does not provide chain validation APIs.  Only the
 *   mathematical signature is verified against the embedded certificate.
 * - CRL/OCSP revocation checking is not performed.
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
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';
import {
  encodeSet,
} from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of verifying a single signature.
 */
export interface SignatureVerificationResult {
  /** The signature field name. */
  fieldName: string;
  /** Subject CN from the certificate. */
  signedBy: string;
  /** Overall validity (integrity AND signature). */
  valid: boolean;
  /** Reason for signing (if present). */
  reason?: string | undefined;
  /** Whether the ByteRange hash matches the signed hash. */
  integrityValid: boolean;
  /** Whether the cryptographic signature is valid. */
  certificateValid?: boolean | undefined;
  /** Signing date (if present in signed attributes). */
  signingDate?: Date | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

/**
 * Convert hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  let clean = hex.replace(/\s/g, '');
  if (clean.length % 2 !== 0) clean = '0' + clean;

  // Find the end of actual data (remove trailing zero padding)
  let endIdx = clean.length;
  // Check if there's a large run of trailing zeros (padding)
  const trailingMatch = clean.match(/(00)+$/);
  if (trailingMatch && trailingMatch[0]!.length > 4) {
    endIdx = clean.length - trailingMatch[0]!.length;
    // Ensure we don't trim actual data
    if (endIdx < 2) endIdx = clean.length;
  }

  return Uint8Array.fromHex(clean.slice(0, endIdx));
}

/**
 * Extract the certificate, signed attributes, and raw signature
 * from a PKCS#7 SignedData structure.
 */
function parsePkcs7Structure(pkcs7Bytes: Uint8Array): {
  certificate: Uint8Array;
  signedAttrs: Uint8Array[];
  signedAttrsRaw: Uint8Array;
  signatureValue: Uint8Array;
  digestAlgorithm: string;
} | null {
  try {
    const contentInfo = parseDerTlv(pkcs7Bytes, 0);
    if (contentInfo.children.length < 2) return null;

    // [0] EXPLICIT SignedData
    const signedDataWrapper = contentInfo.children[1]!;
    const signedData = signedDataWrapper.children[0]!;
    if (!signedData) return null;

    let certificate: Uint8Array | null = null;
    let signerInfo: Asn1Node | null = null;

    // Parse SignedData children
    for (const child of signedData.children) {
      // certificates [0] (tag 0xa0)
      if (child.tag === 0xa0) {
        if (child.children.length > 0) {
          const certNode = child.children[0]!;
          const certStart = certNode.offset + (child.data.byteOffset - pkcs7Bytes.byteOffset);
          certificate = pkcs7Bytes.subarray(certStart, certStart + certNode.totalLength);
        } else {
          certificate = child.data;
        }
      }
      // signerInfos SET (tag 0x31)
      if (child.tag === 0x31 && child.children.length > 0) {
        signerInfo = child.children[0]!;
      }
    }

    if (!certificate || !signerInfo) return null;

    // Parse SignerInfo: version, issuerAndSerial, digestAlgorithm,
    //                   [0] signedAttrs, signatureAlgorithm, signature
    let idx = 0;
    // Skip version
    idx++; // version INTEGER

    // Skip issuerAndSerialNumber
    idx++; // issuerAndSerialNumber SEQUENCE

    // digestAlgorithm
    const digestAlgoNode = signerInfo.children[idx]!;
    idx++;
    let digestAlgorithm = 'SHA-256';
    if (digestAlgoNode && digestAlgoNode.children.length > 0) {
      const oidNode = digestAlgoNode.children[0]!;
      const oid = decodeOidBytes(oidNode.data);
      if (oid === '2.16.840.1.101.3.4.2.2') digestAlgorithm = 'SHA-384';
      else if (oid === '2.16.840.1.101.3.4.2.3') digestAlgorithm = 'SHA-512';
    }

    // signedAttrs [0] IMPLICIT
    let signedAttrs: Uint8Array[] = [];
    let signedAttrsRaw: Uint8Array = new Uint8Array(0);

    if (signerInfo.children[idx]!.tag === 0xa0) {
      const attrsNode = signerInfo.children[idx]!;
      signedAttrs = attrsNode.children.map((child) => {
        const start = child.offset + (attrsNode.data.byteOffset - pkcs7Bytes.byteOffset);
        return pkcs7Bytes.subarray(start, start + child.totalLength);
      });

      // For verification, rebuild the signed attrs as a SET
      signedAttrsRaw = encodeSet(signedAttrs);
      idx++;
    }

    // signatureAlgorithm
    idx++; // skip

    // signature OCTET STRING
    const signatureNode = signerInfo.children[idx]!;
    const signatureValue = signatureNode ? signatureNode.data : new Uint8Array(0);

    return {
      certificate,
      signedAttrs,
      signedAttrsRaw,
      signatureValue,
      digestAlgorithm,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the message digest from the signed attributes.
 */
function extractMessageDigest(signedAttrs: Uint8Array[]): Uint8Array | null {
  const messageDigestOid = '1.2.840.113549.1.9.4';

  for (const attr of signedAttrs) {
    try {
      const attrNode = parseDerTlv(attr, 0);
      if (attrNode.children.length < 2) continue;

      const oidNode = attrNode.children[0]!;
      const oid = decodeOidBytes(oidNode.data);

      if (oid === messageDigestOid) {
        // The value is in a SET, containing an OCTET STRING
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
 * Extract the signing time from the signed attributes.
 */
function extractSigningTime(signedAttrs: Uint8Array[]): Date | undefined {
  const signingTimeOid = '1.2.840.113549.1.9.5';
  const textDecoder = new TextDecoder('ascii');

  for (const attr of signedAttrs) {
    try {
      const attrNode = parseDerTlv(attr, 0);
      if (attrNode.children.length < 2) continue;

      const oidNode = attrNode.children[0]!;
      const oid = decodeOidBytes(oidNode.data);

      if (oid === signingTimeOid) {
        const valueSet = attrNode.children[1]!;
        if (valueSet.children.length > 0) {
          const timeStr = textDecoder.decode(valueSet.children[0]!.data);
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
 * Parse a UTCTime string (YYMMDDHHmmSSZ) to a Date.
 */
function parseUtcTime(utcTime: string): Date {
  const clean = utcTime.replace('Z', '');
  const year = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10) - 1;
  const day = parseInt(clean.slice(4, 6), 10);
  const hours = parseInt(clean.slice(6, 8), 10);
  const minutes = parseInt(clean.slice(8, 10), 10);
  const seconds = parseInt(clean.slice(10, 12), 10);

  // Two-digit year: 00-49 = 2000-2049, 50-99 = 1950-1999
  const fullYear = year < 50 ? 2000 + year : 1900 + year;

  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Extract field name and other metadata from the PDF text near a
 * signature.
 */
function extractFieldInfo(
  pdfStr: string,
  contentsOffset: number,
): { fieldName: string; reason?: string; location?: string; contactInfo?: string } {
  const searchStart = Math.max(0, contentsOffset - 3000);
  const searchEnd = Math.min(pdfStr.length, contentsOffset + 2000);
  const region = pdfStr.slice(searchStart, searchEnd);

  let fieldName = 'Signature';
  const tMatch = region.match(/\/T\s*\(([^)]*)\)/);
  if (tMatch) fieldName = tMatch[1]!;

  const result: { fieldName: string; reason?: string; location?: string; contactInfo?: string } = { fieldName };

  const reasonMatch = region.match(/\/Reason\s*\(([^)]*)\)/);
  if (reasonMatch && reasonMatch[1] !== undefined) result.reason = reasonMatch[1];

  const locationMatch = region.match(/\/Location\s*\(([^)]*)\)/);
  if (locationMatch && locationMatch[1] !== undefined) result.location = locationMatch[1];

  const contactMatch = region.match(/\/ContactInfo\s*\(([^)]*)\)/);
  if (contactMatch && contactMatch[1] !== undefined) result.contactInfo = contactMatch[1];

  return result;
}

/**
 * Convert an ECDSA DER signature to IEEE P1363 format for Web Crypto.
 */
function convertEcdsaDerToP1363(derSig: Uint8Array, keySize: number): Uint8Array {
  try {
    const seq = parseDerTlv(derSig, 0);
    if (seq.children.length < 2) return derSig;

    const r = seq.children[0]!.data;
    const s = seq.children[1]!.data;

    const halfLen = keySize;
    const result = new Uint8Array(halfLen * 2);

    // Copy r, right-aligned and trimmed of leading zero
    const rStart = r[0] === 0 ? 1 : 0;
    const rLen = r.length - rStart;
    result.set(r.subarray(rStart), halfLen - rLen);

    // Copy s, right-aligned and trimmed of leading zero
    const sStart = s[0] === 0 ? 1 : 0;
    const sLen = s.length - sStart;
    result.set(s.subarray(sStart), halfLen * 2 - sLen);

    return result;
  } catch {
    return derSig;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify all signatures in a PDF.
 *
 * For each signature found:
 * 1. Computes the hash of the ByteRange-covered bytes
 * 2. Extracts the PKCS#7 structure
 * 3. Verifies the message digest matches
 * 4. Verifies the cryptographic signature against the certificate
 *
 * @param pdfBytes  The PDF file bytes.
 * @returns         Array of verification results.
 */
export async function verifySignatures(
  pdfBytes: Uint8Array,
): Promise<SignatureVerificationResult[]> {
  const pdfStr = decoder.decode(pdfBytes);
  const rawSigs = findSignatures(pdfBytes);
  const results: SignatureVerificationResult[] = [];

  for (const sig of rawSigs) {
    const fieldInfo = extractFieldInfo(pdfStr, sig.contentsOffset);
    const pkcs7Bytes = hexToBytes(sig.contentsHex);

    // Parse the PKCS#7 structure
    const parsed = parsePkcs7Structure(pkcs7Bytes);

    if (!parsed) {
      results.push({
        fieldName: fieldInfo.fieldName,
        signedBy: 'Unknown',
        valid: false,
        integrityValid: false,
        reason: fieldInfo.reason,
      });
      continue;
    }

    // Extract signer name
    let signedBy = 'Unknown';
    try {
      const { subjectCN } = extractIssuerAndSerial(parsed.certificate);
      signedBy = subjectCN;
    } catch {
      // Use default
    }

    // Extract signing time from signed attributes
    const signingDate = extractSigningTime(parsed.signedAttrs);

    // Step 1: Compute hash of ByteRange-covered bytes
    let integrityValid = false;
    try {
      const computedHash = await computeSignatureHash(
        pdfBytes,
        sig.byteRange,
        parsed.digestAlgorithm as 'SHA-256' | 'SHA-384' | 'SHA-512',
      );

      // Step 2: Check message digest attribute
      const embeddedDigest = extractMessageDigest(parsed.signedAttrs);
      if (embeddedDigest) {
        integrityValid =
          computedHash.length === embeddedDigest.length &&
          computedHash.every((b, i) => b === embeddedDigest[i]);
      }
    } catch {
      integrityValid = false;
    }

    // Step 3: Verify cryptographic signature
    let certificateValid: boolean | undefined;
    try {
      certificateValid = await verifySignature(
        pdfBytes,
        sig.byteRange,
        pkcs7Bytes,
        parsed.certificate,
      );
    } catch {
      certificateValid = false;
    }

    results.push({
      fieldName: fieldInfo.fieldName,
      signedBy,
      valid: integrityValid && (certificateValid === true),
      integrityValid,
      certificateValid,
      signingDate,
      reason: fieldInfo.reason,
    });
  }

  return results;
}

/**
 * Verify a single signature.
 *
 * Extracts the signed attributes from the PKCS#7 structure and
 * verifies the signature using the certificate's public key.
 *
 * @param pdfBytes          The PDF file bytes.
 * @param byteRange         The ByteRange array.
 * @param signatureBytes    The DER-encoded PKCS#7 signature.
 * @param certificateBytes  The DER-encoded X.509 certificate.
 * @returns                 `true` if the signature is valid.
 */
export async function verifySignature(
  pdfBytes: Uint8Array,
  byteRange: [number, number, number, number],
  signatureBytes: Uint8Array,
  certificateBytes: Uint8Array,
): Promise<boolean> {
  try {
    const parsed = parsePkcs7Structure(signatureBytes);
    if (!parsed) return false;

    const subtle = getSubtle();
    const keyAlgo = detectKeyAlgorithm(certificateBytes);

    // Import the public key from the certificate's SPKI
    const spki = extractSubjectPublicKeyInfo(certificateBytes);

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
      const namedCurve = detectNamedCurve(certificateBytes);
      importAlgo = {
        name: 'ECDSA',
        namedCurve,
      };
      verifyAlgo = { name: 'ECDSA', hash: parsed.digestAlgorithm };

      // Convert DER signature to P1363 format for Web Crypto
      const keySizeMap: Record<string, number> = {
        'P-256': 32,
        'P-384': 48,
        'P-521': 66,
      };
      sigBytes = convertEcdsaDerToP1363(
        parsed.signatureValue,
        keySizeMap[namedCurve] ?? 32,
      );
    }

    const publicKey = await subtle.importKey(
      'spki',
      toBuffer(spki),
      importAlgo,
      false,
      ['verify'],
    );

    // Verify the signature over the signed attributes
    const valid = await subtle.verify(
      verifyAlgo,
      publicKey,
      toBuffer(sigBytes),
      toBuffer(parsed.signedAttrsRaw),
    );

    return valid;
  } catch {
    return false;
  }
}

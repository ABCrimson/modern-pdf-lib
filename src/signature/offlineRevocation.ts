/**
 * @module signature/offlineRevocation
 *
 * Offline revocation checking for PDF digital signatures.
 *
 * Extracts CRL and OCSP response data embedded within PKCS#7/CMS
 * signatures (from the adbe-revocationInfoArchival signed attribute
 * or CMS unsigned attributes) and verifies certificate revocation
 * status without any network access.
 *
 * This is essential for air-gapped environments and Long-Term
 * Validation (LTV) workflows where all revocation data is
 * pre-embedded in the PDF signature.
 *
 * References:
 * - RFC 5652 (CMS SignedData)
 * - RFC 6960 (OCSP)
 * - RFC 5280 (X.509 CRLs)
 * - Adobe PDF Reference: adbe-revocationInfoArchival attribute
 *   OID 1.2.840.113583.1.1.8
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  decodeOidBytes,
  extractIssuerAndSerial,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Embedded revocation data extracted from a PKCS#7 signature.
 *
 * Contains arrays of raw DER-encoded OCSP responses and CRLs
 * that were embedded in the signature's signed or unsigned attributes.
 */
export interface EmbeddedRevocationData {
  /** DER-encoded OCSP responses. */
  ocsps: Uint8Array[];
  /** DER-encoded CRLs. */
  crls: Uint8Array[];
}

/**
 * Result of an offline revocation check.
 */
export interface OfflineRevocationResult {
  /** Whether a revocation check was actually performed. */
  checked: boolean;
  /** Certificate status: good, revoked, unknown, or no-data. */
  status: 'good' | 'revoked' | 'unknown' | 'no-data';
  /** Source of the revocation information used. */
  source: 'ocsp' | 'crl' | 'none';
  /** Human-readable details about the check. */
  details?: string | undefined;
}

// ---------------------------------------------------------------------------
// Well-known OIDs
// ---------------------------------------------------------------------------

/** OID for adbe-revocationInfoArchival (Adobe PDF signature attribute). */
const OID_ADBE_REVOCATION_INFO = '1.2.840.113583.1.1.8';

/** OID for id-smime-aa-ets-revocationRefs (CMS revocation refs). */
const OID_REVOCATION_REFS = '1.2.840.113549.1.9.16.2.22';

/** OID for id-smime-aa-ets-CertValues (certificate values). */
const OID_REVOCATION_VALUES = '1.2.840.113549.1.9.16.2.24';

/** OID for OCSP response type id-pkix-ocsp-basic. */
const OID_OCSP_BASIC = '1.3.6.1.5.5.7.48.1.1';

/** OID for PKCS#7 signedData content type. */
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract DER bytes for an ASN.1 node relative to the full buffer.
 */
function extractNodeBytes(
  fullBuffer: Uint8Array,
  parentData: Uint8Array,
  node: Asn1Node,
): Uint8Array {
  const parentOffset = parentData.byteOffset - fullBuffer.byteOffset;
  const start = parentOffset + node.offset;
  return fullBuffer.subarray(start, start + node.totalLength);
}

/**
 * Search an array of ASN.1 attribute SEQUENCEs for a specific OID.
 * Returns all matching attribute value nodes.
 */
function findAttributesByOid(
  attrs: Asn1Node[],
  parentData: Uint8Array,
  targetOid: string,
): Asn1Node[] {
  const matches: Asn1Node[] = [];

  for (const attr of attrs) {
    if (attr.children.length < 2) continue;

    const oidNode = attr.children[0]!;
    if (oidNode.tag !== 0x06) continue;

    const oid = decodeOidBytes(oidNode.data);
    if (oid === targetOid) {
      matches.push(attr.children[1]!);
    }
  }

  return matches;
}

/**
 * Walk an ASN.1 tree and collect all nodes with the given tag.
 */
function collectNodesByTag(node: Asn1Node, tag: number): Asn1Node[] {
  const results: Asn1Node[] = [];
  if (node.tag === tag) {
    results.push(node);
  }
  for (const child of node.children) {
    results.push(...collectNodesByTag(child, tag));
  }
  return results;
}

/**
 * Extract OCSP responses and CRLs from the adbe-revocationInfoArchival
 * attribute value.
 *
 * RevocationInfoArchival ::= SEQUENCE {
 *   crl   [0] EXPLICIT SEQUENCE OF CRLs OPTIONAL,
 *   ocsp  [1] EXPLICIT SEQUENCE OF OCSPResponse OPTIONAL,
 *   otherRevInfo [2] EXPLICIT SEQUENCE OF OtherRevInfo OPTIONAL
 * }
 */
function parseAdobeRevocationInfo(
  valueNode: Asn1Node,
  fullBuffer: Uint8Array,
  parentData: Uint8Array,
): EmbeddedRevocationData {
  const result: EmbeddedRevocationData = { ocsps: [], crls: [] };

  // The value is typically a SET containing a SEQUENCE
  let seqNode: Asn1Node | null = null;
  if (valueNode.tag === 0x31 && valueNode.children.length > 0) {
    // SET containing the SEQUENCE
    seqNode = valueNode.children[0]!;
  } else if (valueNode.tag === 0x30) {
    seqNode = valueNode;
  }

  if (!seqNode) return result;

  for (const child of seqNode.children) {
    if (child.tag === 0xa0) {
      // [0] CRLs — SEQUENCE OF CRL
      for (const crlNode of child.children) {
        result.crls.push(
          extractNodeBytes(fullBuffer, parentData, crlNode),
        );
      }
    } else if (child.tag === 0xa1) {
      // [1] OCSP responses — SEQUENCE OF OCSPResponse
      for (const ocspNode of child.children) {
        result.ocsps.push(
          extractNodeBytes(fullBuffer, parentData, ocspNode),
        );
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract embedded revocation data (CRLs and OCSP responses) from
 * a DER-encoded PKCS#7/CMS signature.
 *
 * Searches both signed and unsigned attributes for:
 * - adbe-revocationInfoArchival (OID 1.2.840.113583.1.1.8)
 * - id-smime-aa-ets-revocationRefs / revocationValues
 *
 * @param signatureBytes  DER-encoded PKCS#7 signature bytes.
 * @returns               Extracted CRLs and OCSP responses.
 */
export function extractEmbeddedRevocationData(
  signatureBytes: Uint8Array,
): EmbeddedRevocationData {
  const result: EmbeddedRevocationData = { ocsps: [], crls: [] };

  try {
    const contentInfo = parseDerTlv(signatureBytes, 0);
    if (contentInfo.children.length < 2) return result;

    // ContentInfo -> [0] EXPLICIT SignedData
    const signedDataWrapper = contentInfo.children[1]!;
    if (!signedDataWrapper.children.length) return result;
    const signedData = signedDataWrapper.children[0]!;

    // Find the signerInfos SET
    let signerInfosNode: Asn1Node | null = null;
    for (const child of signedData.children) {
      // signerInfos is the last SET (tag 0x31) in SignedData
      if (child.tag === 0x31) {
        signerInfosNode = child;
      }
    }

    if (!signerInfosNode || signerInfosNode.children.length === 0) {
      return result;
    }

    const signerInfo = signerInfosNode.children[0]!;

    // Iterate through signer info children to find attributes
    for (const child of signerInfo.children) {
      // [0] = signedAttrs, [1] = unsignedAttrs
      if (child.tag === 0xa0 || child.tag === 0xa1) {
        // Search for revocation info attributes
        const adobeRevAttrs = findAttributesByOid(
          child.children,
          signatureBytes,
          OID_ADBE_REVOCATION_INFO,
        );

        for (const valueNode of adobeRevAttrs) {
          const revData = parseAdobeRevocationInfo(
            valueNode,
            signatureBytes,
            signatureBytes,
          );
          result.ocsps.push(...revData.ocsps);
          result.crls.push(...revData.crls);
        }

        // Also check for CMS revocation values attribute
        const revValueAttrs = findAttributesByOid(
          child.children,
          signatureBytes,
          OID_REVOCATION_VALUES,
        );

        for (const valueNode of revValueAttrs) {
          // RevocationValues ::= SEQUENCE {
          //   crlVals [0] SEQUENCE OF CRL OPTIONAL,
          //   ocspVals [1] SEQUENCE OF BasicOCSPResponse OPTIONAL
          // }
          const parsed = parseAdobeRevocationInfo(
            valueNode,
            signatureBytes,
            signatureBytes,
          );
          result.ocsps.push(...parsed.ocsps);
          result.crls.push(...parsed.crls);
        }
      }
    }
  } catch {
    // Return whatever we've collected so far
  }

  return result;
}

/**
 * Verify the revocation status of a certificate using only
 * embedded revocation data (no network access).
 *
 * Checks OCSP responses first (preferred), then falls back to CRLs.
 * If no embedded revocation data covers the certificate, returns
 * status 'no-data'.
 *
 * @param cert            DER-encoded X.509 certificate to check.
 * @param revocationData  Embedded revocation data from `extractEmbeddedRevocationData`.
 * @returns               Revocation check result.
 */
export function verifyOfflineRevocation(
  cert: Uint8Array,
  revocationData: EmbeddedRevocationData,
): OfflineRevocationResult {
  // If no revocation data is available at all
  if (revocationData.ocsps.length === 0 && revocationData.crls.length === 0) {
    return {
      checked: false,
      status: 'no-data',
      source: 'none',
      details: 'No embedded revocation data available',
    };
  }

  // Extract the serial number and issuer from the certificate
  let serialDer: Uint8Array;
  let issuerDer: Uint8Array;
  try {
    const certInfo = extractIssuerAndSerial(cert);
    serialDer = certInfo.serialDer;
    issuerDer = certInfo.issuerDer;
  } catch {
    return {
      checked: false,
      status: 'unknown',
      source: 'none',
      details: 'Failed to parse certificate subject/serial',
    };
  }

  // Extract raw serial bytes (strip the INTEGER tag+length wrapper)
  const serialNode = parseDerTlv(serialDer, 0);
  const serialBytes = serialNode.data;

  // Try OCSP responses first
  if (revocationData.ocsps.length > 0) {
    const ocspResult = checkOcspResponses(
      serialBytes,
      issuerDer,
      revocationData.ocsps,
    );
    if (ocspResult.checked) return ocspResult;
  }

  // Fall back to CRLs
  if (revocationData.crls.length > 0) {
    const crlResult = checkCrls(serialBytes, issuerDer, revocationData.crls);
    if (crlResult.checked) return crlResult;
  }

  return {
    checked: false,
    status: 'unknown',
    source: 'none',
    details:
      'Embedded revocation data does not cover this certificate',
  };
}

// ---------------------------------------------------------------------------
// OCSP response checking
// ---------------------------------------------------------------------------

/**
 * Check OCSP responses for the certificate's serial number.
 *
 * OCSP BasicOCSPResponse structure (simplified):
 * ```
 * BasicOCSPResponse ::= SEQUENCE {
 *   tbsResponseData SEQUENCE {
 *     ...
 *     responses SEQUENCE OF SingleResponse {
 *       certID SEQUENCE { hashAlgo, issuerNameHash, issuerKeyHash, serialNumber }
 *       certStatus [0]=good | [1]=revoked | [2]=unknown
 *       thisUpdate GeneralizedTime
 *       nextUpdate [0] GeneralizedTime OPTIONAL
 *     }
 *   }
 *   signatureAlgorithm ...
 *   signature ...
 * }
 * ```
 */
function checkOcspResponses(
  serialBytes: Uint8Array,
  _issuerDer: Uint8Array,
  ocsps: Uint8Array[],
): OfflineRevocationResult {
  for (const ocspBytes of ocsps) {
    try {
      const ocspResponse = parseDerTlv(ocspBytes, 0);

      // OCSPResponse ::= SEQUENCE { responseStatus, [0] responseBytes }
      // responseBytes ::= SEQUENCE { responseType OID, response OCTET STRING }
      // We need to dig into the BasicOCSPResponse
      let basicResponse: Asn1Node | null = null;

      if (ocspResponse.tag === 0x30) {
        // Could be OCSPResponse wrapper or direct BasicOCSPResponse
        // Check if first child is an ENUMERATED (responseStatus) or SEQUENCE
        if (
          ocspResponse.children.length >= 1 &&
          ocspResponse.children[0]!.tag === 0x0a
        ) {
          // This is an OCSPResponse; look for [0] responseBytes
          for (const child of ocspResponse.children) {
            if (child.tag === 0xa0 && child.children.length > 0) {
              const respBytes = child.children[0]!;
              // responseBytes = SEQUENCE { responseType, response }
              if (
                respBytes.children.length >= 2 &&
                respBytes.children[1]!.tag === 0x04
              ) {
                // OCTET STRING containing BasicOCSPResponse
                const innerBytes = respBytes.children[1]!.data;
                basicResponse = parseDerTlv(innerBytes, 0);
              }
            }
          }
        } else {
          // Might be a direct BasicOCSPResponse
          basicResponse = ocspResponse;
        }
      }

      if (!basicResponse) continue;

      // BasicOCSPResponse -> tbsResponseData (first child SEQUENCE)
      const tbsResponseData = basicResponse.children[0];
      if (!tbsResponseData || tbsResponseData.tag !== 0x30) continue;

      // tbsResponseData children:
      // [0] version (OPTIONAL, context tag 0xa0)
      // responderID (choice)
      // producedAt GeneralizedTime
      // responses SEQUENCE OF SingleResponse
      let responsesNode: Asn1Node | null = null;
      for (const child of tbsResponseData.children) {
        if (child.tag === 0x30 && child.children.length > 0) {
          // Check if this looks like a SEQUENCE OF SingleResponse
          const firstChild = child.children[0]!;
          if (firstChild.tag === 0x30 && firstChild.children.length >= 3) {
            // Likely the responses SEQUENCE
            responsesNode = child;
          }
        }
      }

      if (!responsesNode) continue;

      // Check each SingleResponse
      for (const singleResponse of responsesNode.children) {
        if (singleResponse.tag !== 0x30 || singleResponse.children.length < 3)
          continue;

        // certID is the first SEQUENCE
        const certId = singleResponse.children[0]!;
        if (certId.tag !== 0x30 || certId.children.length < 4) continue;

        // serialNumber is the 4th element in certID (INTEGER)
        const ocspSerial = certId.children[3]!;
        if (ocspSerial.tag !== 0x02) continue;

        // Compare serial numbers
        if (!compareBytes(ocspSerial.data, serialBytes)) continue;

        // Found a matching serial — check certStatus
        const certStatus = singleResponse.children[1]!;

        if (certStatus.tag === 0x80) {
          // [0] IMPLICIT NULL = good
          return {
            checked: true,
            status: 'good',
            source: 'ocsp',
            details: 'OCSP response indicates certificate is good',
          };
        }

        if (certStatus.tag === 0xa1) {
          // [1] EXPLICIT RevokedInfo
          return {
            checked: true,
            status: 'revoked',
            source: 'ocsp',
            details: 'OCSP response indicates certificate is revoked',
          };
        }

        if (certStatus.tag === 0x82) {
          // [2] IMPLICIT NULL = unknown
          return {
            checked: true,
            status: 'unknown',
            source: 'ocsp',
            details: 'OCSP response indicates certificate status is unknown',
          };
        }
      }
    } catch {
      continue;
    }
  }

  return {
    checked: false,
    status: 'unknown',
    source: 'none',
    details: 'No matching OCSP response found for this certificate',
  };
}

// ---------------------------------------------------------------------------
// CRL checking
// ---------------------------------------------------------------------------

/**
 * Check CRLs for the certificate's serial number.
 *
 * CertificateList (CRL) structure (simplified):
 * ```
 * CertificateList ::= SEQUENCE {
 *   tbsCertList SEQUENCE {
 *     version INTEGER OPTIONAL,
 *     signature AlgorithmIdentifier,
 *     issuer Name,
 *     thisUpdate Time,
 *     nextUpdate Time OPTIONAL,
 *     revokedCertificates SEQUENCE OF SEQUENCE {
 *       userCertificate INTEGER (serial number),
 *       revocationDate Time,
 *       crlEntryExtensions Extensions OPTIONAL
 *     } OPTIONAL,
 *     crlExtensions [0] Extensions OPTIONAL
 *   }
 *   signatureAlgorithm ...
 *   signatureValue BIT STRING
 * }
 * ```
 */
function checkCrls(
  serialBytes: Uint8Array,
  issuerDer: Uint8Array,
  crls: Uint8Array[],
): OfflineRevocationResult {
  for (const crlBytes of crls) {
    try {
      const crl = parseDerTlv(crlBytes, 0);
      if (crl.tag !== 0x30 || crl.children.length < 2) continue;

      const tbsCertList = crl.children[0]!;
      if (tbsCertList.tag !== 0x30) continue;

      // Parse tbsCertList to find issuer and revokedCertificates
      let idx = 0;

      // version INTEGER (OPTIONAL — present if v2 CRL)
      // If the first child is an INTEGER (0x02), it's the version field.
      // Without version, the first child is sigAlgo (SEQUENCE 0x30).
      if (tbsCertList.children[idx]!.tag === 0x02) {
        idx++; // skip version
      }

      // signature AlgorithmIdentifier
      idx++;

      // issuer Name
      const crlIssuerNode = tbsCertList.children[idx]!;
      idx++;

      // Check if the CRL issuer matches the certificate's issuer
      const crlIssuerBytes = extractNodeBytesFromParent(
        crlBytes,
        tbsCertList,
        crlIssuerNode,
      );
      if (!compareBytes(crlIssuerBytes, issuerDer)) continue;

      // thisUpdate Time
      idx++;

      // nextUpdate Time (OPTIONAL)
      if (
        idx < tbsCertList.children.length &&
        (tbsCertList.children[idx]!.tag === 0x17 ||
          tbsCertList.children[idx]!.tag === 0x18)
      ) {
        idx++;
      }

      // revokedCertificates SEQUENCE OF SEQUENCE (OPTIONAL)
      if (idx >= tbsCertList.children.length) {
        // No revoked certificates — cert is not revoked by this CRL
        return {
          checked: true,
          status: 'good',
          source: 'crl',
          details: 'CRL contains no revoked certificates; certificate is good',
        };
      }

      const revokedCerts = tbsCertList.children[idx]!;
      if (revokedCerts.tag !== 0x30) {
        // Might be extensions [0] — no revoked certs
        return {
          checked: true,
          status: 'good',
          source: 'crl',
          details: 'CRL contains no revoked certificates; certificate is good',
        };
      }

      // Search each revoked certificate entry
      let found = false;
      for (const entry of revokedCerts.children) {
        if (entry.tag !== 0x30 || entry.children.length < 2) continue;

        const revokedSerial = entry.children[0]!;
        if (revokedSerial.tag !== 0x02) continue;

        if (compareBytes(revokedSerial.data, serialBytes)) {
          found = true;
          break;
        }
      }

      if (found) {
        return {
          checked: true,
          status: 'revoked',
          source: 'crl',
          details: 'Certificate serial number found in CRL revoked list',
        };
      }

      // Certificate not found in CRL's revoked list — it's good
      return {
        checked: true,
        status: 'good',
        source: 'crl',
        details:
          'Certificate serial number not found in CRL; certificate is good',
      };
    } catch {
      continue;
    }
  }

  return {
    checked: false,
    status: 'unknown',
    source: 'none',
    details: 'No matching CRL found for this certificate issuer',
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Compare two byte arrays for equality.
 */
function compareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Extract DER bytes for a child node relative to its parent.
 */
function extractNodeBytesFromParent(
  fullBuffer: Uint8Array,
  parent: Asn1Node,
  child: Asn1Node,
): Uint8Array {
  const parentDataOffset = parent.data.byteOffset - fullBuffer.byteOffset;
  const start = parentDataOffset + child.offset;
  return fullBuffer.subarray(start, start + child.totalLength);
}

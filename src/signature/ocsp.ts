/**
 * @module signature/ocsp
 *
 * OCSP (Online Certificate Status Protocol) request/response handling
 * for certificate revocation checking.
 *
 * Implements RFC 6960 OCSP request building, response parsing, and
 * certificate status checking via HTTP POST using `fetch()`.
 *
 * Uses the ASN.1 DER utilities from `./pkcs7.ts` for encoding and
 * the `parseDerTlv` parser for decoding.
 *
 * References:
 * - RFC 6960 (Online Certificate Status Protocol - OCSP)
 * - RFC 5280 (X.509 PKI Certificate and CRL Profile)
 *
 * @packageDocumentation
 */

import {
  encodeSequence,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeContextTag,
  encodeLength,
  parseDerTlv,
  decodeOidBytes,
  extractIssuerAndSerial,
  extractSubjectPublicKeyInfo,
  toBuffer,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed OCSP response data.
 */
export interface OcspResponse {
  /** Response status: 0=successful, 1=malformedRequest, etc. */
  responseStatus: number;
  /** Responder ID (key hash or name), hex-encoded. */
  responderId: string;
  /** When this response was produced. */
  producedAt: Date;
  /** Individual certificate status responses. */
  responses: OcspSingleResponse[];
}

/**
 * Status for a single certificate in an OCSP response.
 */
export interface OcspSingleResponse {
  /** Serial number of the certificate (hex-encoded). */
  serialNumber: string;
  /** Certificate status. */
  status: 'good' | 'revoked' | 'unknown';
  /** Beginning of validity interval for this response. */
  thisUpdate: Date;
  /** End of validity interval for this response (if present). */
  nextUpdate?: Date | undefined;
  /** When the certificate was revoked (if revoked). */
  revokedAt?: Date | undefined;
  /** CRL reason code (if revoked). */
  revocationReason?: string | undefined;
}

/**
 * Result of an OCSP certificate status check.
 */
export interface OcspResult {
  /** Certificate status. */
  status: 'good' | 'revoked' | 'unknown';
  /** Beginning of validity interval. */
  thisUpdate: Date;
  /** End of validity interval (if present). */
  nextUpdate?: Date | undefined;
  /** When the certificate was revoked (if revoked). */
  revokedAt?: Date | undefined;
  /** Revocation reason string (if revoked). */
  revocationReason?: string | undefined;
}

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_SHA1 = '1.3.14.3.2.26';
const OID_OCSP_BASIC = '1.3.6.1.5.5.7.48.1.1';
const OID_OCSP_NONCE = '1.3.6.1.5.5.7.48.1.2';
const OID_ID_AD_OCSP = '1.3.6.1.5.5.7.48.1';
const OID_AIA = '1.3.6.1.5.5.7.1.1';

/** CRL reason code names (RFC 5280 SS5.3.1). */
const CRL_REASONS: Record<number, string> = {
  0: 'unspecified',
  1: 'keyCompromise',
  2: 'cACompromise',
  3: 'affiliationChanged',
  4: 'superseded',
  5: 'cessationOfOperation',
  6: 'certificateHold',
  8: 'removeFromCRL',
  9: 'privilegeWithdrawn',
  10: 'aACompromise',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Encode a NULL value in DER.
 */
function encodeNull(): Uint8Array {
  return new Uint8Array([0x05, 0x00]);
}

/**
 * Concatenate multiple Uint8Arrays.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode an explicit context-specific primitive tag (non-constructed).
 */
function encodePrimitiveContextTag(tag: number, contents: Uint8Array): Uint8Array {
  const tagByte = 0x80 | tag;
  const len = encodeLength(contents.length);
  const result = new Uint8Array(1 + len.length + contents.length);
  result[0] = tagByte;
  result.set(len, 1);
  result.set(contents, 1 + len.length);
  return result;
}

/**
 * Compute SHA-1 hash using Web Crypto.
 * OCSP uses SHA-1 for issuer name/key hashes by default (RFC 6960).
 */
async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-1', toBuffer(data));
  return new Uint8Array(digest);
}

/**
 * Compute SHA-256 hash using Web Crypto.
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toBuffer(data));
  return new Uint8Array(digest);
}

/**
 * Parse a GeneralizedTime string (YYYYMMDDHHmmSS[.fff]Z) to Date.
 */
function parseGeneralizedTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '').replace(/\..*$/, '');
  const year = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(4, 6), 10) - 1;
  const day = parseInt(clean.slice(6, 8), 10);
  const hours = parseInt(clean.slice(8, 10), 10);
  const minutes = parseInt(clean.slice(10, 12), 10) || 0;
  const seconds = parseInt(clean.slice(12, 14), 10) || 0;
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Parse a UTCTime string (YYMMDDHHmmSSZ) to Date.
 */
function parseUtcTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '');
  const year = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10) - 1;
  const day = parseInt(clean.slice(4, 6), 10);
  const hours = parseInt(clean.slice(6, 8), 10);
  const minutes = parseInt(clean.slice(8, 10), 10) || 0;
  const seconds = parseInt(clean.slice(10, 12), 10) || 0;
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Parse an ASN.1 time value (UTCTime or GeneralizedTime).
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
 * Convert a Uint8Array to a hex string.
 */
function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Extract the raw issuer Name bytes from a DER-encoded certificate's
 * TBSCertificate.
 */
function extractIssuerRawBytes(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }
  // issuer is at idx+2
  const issuerNode = tbsCert.children[idx + 2]!;
  const issuerStart = issuerNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(issuerStart, issuerStart + issuerNode.totalLength);
}

/**
 * Extract the subject Name bytes from a DER-encoded certificate's
 * TBSCertificate.
 */
function extractSubjectRawBytes(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }
  // subject is at idx+4
  const subjectNode = tbsCert.children[idx + 4]!;
  const subjectStart = subjectNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(subjectStart, subjectStart + subjectNode.totalLength);
}

/**
 * Extract the raw public key BIT STRING data from a certificate's
 * SubjectPublicKeyInfo (the actual key bytes, not the SPKI wrapper).
 */
function extractPublicKeyBitString(certDer: Uint8Array): Uint8Array {
  const spki = extractSubjectPublicKeyInfo(certDer);
  const spkiNode = parseDerTlv(spki, 0);
  // SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier, BIT STRING }
  const bitStringNode = spkiNode.children[1]!;
  // BIT STRING data includes the unused-bits byte at position 0
  return bitStringNode.data;
}

/**
 * Extract the serial number from a DER-encoded certificate as a Uint8Array.
 */
function extractSerialNumber(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }
  const serialNode = tbsCert.children[idx]!;
  return serialNode.data;
}

/**
 * Extract extensions from TBSCertificate.
 * Extensions are at [3] EXPLICIT SEQUENCE OF Extension (v3 certs).
 */
function extractExtensions(certDer: Uint8Array): Asn1Node[] {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  // Look for tag 0xa3 (context [3] explicit, constructed) among TBS children
  for (const child of tbsCert.children) {
    if (child.tag === 0xa3) {
      // [3] wraps a SEQUENCE of extensions
      if (child.children.length > 0) {
        const extSeq = child.children[0]!;
        return extSeq.children;
      }
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a DER-encoded OCSP request for a certificate (RFC 6960).
 *
 * ```
 * OCSPRequest ::= SEQUENCE {
 *   tbsRequest TBSRequest
 * }
 * TBSRequest ::= SEQUENCE {
 *   version     [0] EXPLICIT INTEGER DEFAULT v1,
 *   requestList SEQUENCE OF Request
 * }
 * Request ::= SEQUENCE {
 *   reqCert CertID
 * }
 * CertID ::= SEQUENCE {
 *   hashAlgorithm AlgorithmIdentifier,
 *   issuerNameHash OCTET STRING,
 *   issuerKeyHash  OCTET STRING,
 *   serialNumber   INTEGER
 * }
 * ```
 *
 * @param cert        DER-encoded certificate to check.
 * @param issuerCert  DER-encoded issuer certificate.
 * @returns           DER-encoded OCSP request.
 */
export async function buildOcspRequest(
  cert: Uint8Array,
  issuerCert: Uint8Array,
): Promise<Uint8Array> {
  // Hash the issuer's distinguished name (the subject of the issuer cert)
  const issuerNameDer = extractSubjectRawBytes(issuerCert);
  const issuerNameHash = await sha1(issuerNameDer);

  // Hash the issuer's public key (BIT STRING content, skip unused-bits byte)
  const issuerKeyBitString = extractPublicKeyBitString(issuerCert);
  // Skip the first byte (unused bits count)
  const issuerKeyBytes = issuerKeyBitString.subarray(1);
  const issuerKeyHash = await sha1(issuerKeyBytes);

  // Get the serial number of the certificate to check
  const serialNumber = extractSerialNumber(cert);

  // Build CertID
  const hashAlgorithm = encodeSequence([
    encodeOID(OID_SHA1),
    encodeNull(),
  ]);

  const certId = encodeSequence([
    hashAlgorithm,
    encodeOctetString(issuerNameHash),
    encodeOctetString(issuerKeyHash),
    encodeInteger(serialNumber),
  ]);

  // Build Request (just wraps CertID)
  const request = encodeSequence([certId]);

  // Build requestList (SEQUENCE OF Request)
  const requestList = encodeSequence([request]);

  // Build TBSRequest (version is DEFAULT v1, so we omit it)
  const tbsRequest = encodeSequence([requestList]);

  // Build OCSPRequest
  return encodeSequence([tbsRequest]);
}

/**
 * Parse a DER-encoded OCSP response (RFC 6960).
 *
 * ```
 * OCSPResponse ::= SEQUENCE {
 *   responseStatus ENUMERATED,
 *   responseBytes  [0] EXPLICIT ResponseBytes OPTIONAL
 * }
 * ResponseBytes ::= SEQUENCE {
 *   responseType OID,
 *   response     OCTET STRING (contains BasicOCSPResponse DER)
 * }
 * BasicOCSPResponse ::= SEQUENCE {
 *   tbsResponseData ResponseData,
 *   signatureAlgorithm AlgorithmIdentifier,
 *   signature BIT STRING,
 *   certs [0] EXPLICIT SEQUENCE OF Certificate OPTIONAL
 * }
 * ResponseData ::= SEQUENCE {
 *   version          [0] EXPLICIT INTEGER DEFAULT v1,
 *   responderID      ResponderID,
 *   producedAt       GeneralizedTime,
 *   responses        SEQUENCE OF SingleResponse
 * }
 * ```
 *
 * @param response  DER-encoded OCSP response bytes.
 * @returns         Parsed OCSP response.
 */
export function parseOcspResponse(response: Uint8Array): OcspResponse {
  const root = parseDerTlv(response, 0);

  if (root.children.length < 1) {
    throw new Error('Invalid OCSP response: empty SEQUENCE');
  }

  // responseStatus ENUMERATED
  const statusNode = root.children[0]!;
  const responseStatus = statusNode.data[0] ?? 0;

  if (responseStatus !== 0) {
    const statusNames: Record<number, string> = {
      0: 'successful',
      1: 'malformedRequest',
      2: 'internalError',
      3: 'tryLater',
      5: 'sigRequired',
      6: 'unauthorized',
    };
    throw new Error(
      `OCSP response error: ${statusNames[responseStatus] ?? `status ${responseStatus}`}`,
    );
  }

  if (root.children.length < 2) {
    throw new Error('OCSP response contains no responseBytes');
  }

  // responseBytes [0] EXPLICIT
  const responseBytesWrapper = root.children[1]!;
  const responseBytes = responseBytesWrapper.children[0]!;

  // ResponseBytes: SEQUENCE { responseType OID, response OCTET STRING }
  const responseTypeNode = responseBytes.children[0]!;
  const responseOctet = responseBytes.children[1]!;

  // Parse the BasicOCSPResponse from the OCTET STRING
  const basicResp = parseDerTlv(responseOctet.data, 0);
  const tbsResponseData = basicResp.children[0]!;

  // Parse ResponseData
  let rdIdx = 0;

  // Check for optional version [0]
  if (tbsResponseData.children[rdIdx]!.tag === 0xa0) {
    rdIdx++;
  }

  // responderID: either [1] byName or [2] byKey
  const responderIdNode = tbsResponseData.children[rdIdx]!;
  let responderId: string;
  if (responderIdNode.tag === 0xa1) {
    // byName — contains a Name SEQUENCE
    responderId = 'name:' + toHex(responderIdNode.data);
  } else if (responderIdNode.tag === 0xa2) {
    // byKey — contains an OCTET STRING with key hash
    const keyHashNode = responderIdNode.children[0];
    responderId = 'keyHash:' + (keyHashNode ? toHex(keyHashNode.data) : toHex(responderIdNode.data));
  } else {
    responderId = 'unknown';
  }
  rdIdx++;

  // producedAt GeneralizedTime
  const producedAtNode = tbsResponseData.children[rdIdx]!;
  const producedAt = parseAsn1Time(producedAtNode);
  rdIdx++;

  // responses SEQUENCE OF SingleResponse
  const responsesSeq = tbsResponseData.children[rdIdx]!;
  const responses: OcspSingleResponse[] = [];

  for (const singleResp of responsesSeq.children) {
    responses.push(parseSingleResponse(singleResp));
  }

  return {
    responseStatus,
    responderId,
    producedAt,
    responses,
  };
}

/**
 * Parse a SingleResponse from an OCSP BasicOCSPResponse.
 *
 * ```
 * SingleResponse ::= SEQUENCE {
 *   certID       CertID,
 *   certStatus   CertStatus,
 *   thisUpdate   GeneralizedTime,
 *   nextUpdate   [0] EXPLICIT GeneralizedTime OPTIONAL
 * }
 * CertStatus ::= CHOICE {
 *   good    [0] IMPLICIT NULL,
 *   revoked [1] IMPLICIT RevokedInfo,
 *   unknown [2] IMPLICIT NULL
 * }
 * RevokedInfo ::= SEQUENCE {
 *   revocationTime GeneralizedTime,
 *   revocationReason [0] EXPLICIT CRLReason OPTIONAL
 * }
 * ```
 */
function parseSingleResponse(node: Asn1Node): OcspSingleResponse {
  // certID
  const certIdNode = node.children[0]!;
  // Serial number is the last child of CertID
  const serialNode = certIdNode.children[3]!;
  const serialNumber = toHex(serialNode.data);

  // certStatus
  const certStatusNode = node.children[1]!;
  let status: 'good' | 'revoked' | 'unknown';
  let revokedAt: Date | undefined;
  let revocationReason: string | undefined;

  if (certStatusNode.tag === 0x80) {
    // good [0] IMPLICIT NULL
    status = 'good';
  } else if (certStatusNode.tag === 0xa1) {
    // revoked [1] IMPLICIT RevokedInfo
    status = 'revoked';
    // RevokedInfo: revocationTime GeneralizedTime, [0] revocationReason
    if (certStatusNode.children.length > 0) {
      revokedAt = parseAsn1Time(certStatusNode.children[0]!);
      if (certStatusNode.children.length > 1) {
        const reasonNode = certStatusNode.children[1]!;
        const reasonChildren = reasonNode.children;
        if (reasonChildren.length > 0) {
          const reasonCode = reasonChildren[0]!.data[0] ?? 0;
          revocationReason = CRL_REASONS[reasonCode] ?? `reason(${reasonCode})`;
        }
      }
    }
  } else {
    // unknown [2] IMPLICIT NULL
    status = 'unknown';
  }

  // thisUpdate
  const thisUpdateNode = node.children[2]!;
  const thisUpdate = parseAsn1Time(thisUpdateNode);

  // nextUpdate [0] EXPLICIT GeneralizedTime OPTIONAL
  let nextUpdate: Date | undefined;
  if (node.children.length > 3 && node.children[3]!.tag === 0xa0) {
    const nextUpdateWrapper = node.children[3]!;
    if (nextUpdateWrapper.children.length > 0) {
      nextUpdate = parseAsn1Time(nextUpdateWrapper.children[0]!);
    }
  }

  return {
    serialNumber,
    status,
    thisUpdate,
    nextUpdate,
    revokedAt,
    revocationReason,
  };
}

/**
 * Extract the OCSP responder URL from a certificate's Authority
 * Information Access (AIA) extension.
 *
 * The AIA extension (OID 1.3.6.1.5.5.7.1.1) contains:
 * ```
 * AuthorityInfoAccessSyntax ::= SEQUENCE OF AccessDescription
 * AccessDescription ::= SEQUENCE {
 *   accessMethod    OID,
 *   accessLocation  GeneralName
 * }
 * ```
 *
 * We look for accessMethod = id-ad-ocsp (1.3.6.1.5.5.7.48.1) and
 * extract the URI from the GeneralName (tag [6] uniformResourceIdentifier).
 *
 * @param cert  DER-encoded X.509 certificate.
 * @returns     The OCSP responder URL, or `null` if not found.
 */
export function extractOcspUrl(cert: Uint8Array): string | null {
  try {
    const extensions = extractExtensions(cert);

    for (const ext of extensions) {
      // Extension: SEQUENCE { OID, [BOOLEAN critical,] OCTET STRING value }
      const oidNode = ext.children[0]!;
      const oid = decodeOidBytes(oidNode.data);

      if (oid === OID_AIA) {
        // The value is an OCTET STRING containing the AIA extension
        const valueIdx = ext.children.length > 2 ? 2 : 1;
        const valueNode = ext.children[valueIdx]!;

        // Parse the OCTET STRING contents as a SEQUENCE OF AccessDescription
        const aiaSeq = parseDerTlv(valueNode.data, 0);

        for (const accessDesc of aiaSeq.children) {
          const methodNode = accessDesc.children[0]!;
          const methodOid = decodeOidBytes(methodNode.data);

          if (methodOid === OID_ID_AD_OCSP) {
            // accessLocation is a GeneralName
            const locationNode = accessDesc.children[1]!;
            // [6] = uniformResourceIdentifier (IA5String)
            if ((locationNode.tag & 0x1f) === 6) {
              const textDecoder = new TextDecoder('ascii');
              return textDecoder.decode(locationNode.data);
            }
          }
        }
      }
    }
  } catch {
    // Extension parsing failed
  }

  return null;
}

/**
 * Check the revocation status of a certificate using OCSP.
 *
 * Builds an OCSP request, sends it to the specified OCSP responder
 * URL via HTTP POST (using `fetch()`), and parses the response.
 *
 * @param cert        DER-encoded certificate to check.
 * @param issuerCert  DER-encoded issuer certificate.
 * @param ocspUrl     URL of the OCSP responder.
 * @returns           The OCSP status result.
 */
export async function checkCertificateStatus(
  cert: Uint8Array,
  issuerCert: Uint8Array,
  ocspUrl: string,
): Promise<OcspResult> {
  // Build the OCSP request
  const ocspReq = await buildOcspRequest(cert, issuerCert);

  // Send via fetch
  const bodyBuffer = toBuffer(ocspReq);
  const response = await fetch(ocspUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ocsp-request',
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    throw new Error(
      `OCSP request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const respBytes = new Uint8Array(await response.arrayBuffer());
  const parsed = parseOcspResponse(respBytes);

  // Return the first response (we only sent one cert in the request)
  if (parsed.responses.length === 0) {
    return {
      status: 'unknown',
      thisUpdate: parsed.producedAt,
    };
  }

  const single = parsed.responses[0]!;
  return {
    status: single.status,
    thisUpdate: single.thisUpdate,
    nextUpdate: single.nextUpdate,
    revokedAt: single.revokedAt,
    revocationReason: single.revocationReason,
  };
}

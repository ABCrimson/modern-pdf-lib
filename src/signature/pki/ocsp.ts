/**
 * @module signature/pki/ocsp
 *
 * OCSP (Online Certificate Status Protocol) request/response handling
 * for certificate revocation checking.
 *
 * Implements RFC 6960 OCSP request building, response parsing, and
 * certificate status checking via HTTP POST using `fetch()`.
 * `checkCertificateStatus` reports `good` or `revoked` only for an
 * answer that is signed by the issuer (or by a delegated responder the
 * issuer certified for id-kp-OCSPSigning), matches the request CertID and
 * is fresh; every other answer is reported as `unknown`.
 *
 * Uses the ASN.1 DER utilities from `../cms/pkcs7.ts` for encoding and
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
  parseDerTlv,
  decodeOidBytes,
  extractSubjectPublicKeyInfo,
  toBuffer,
} from '../cms/pkcs7.js';
import type { Asn1Node } from '../cms/pkcs7.js';
import { EnvironmentError, MalformedInputError } from '../../errors.js';
import { validateExtendedKeyUsage } from './certPolicy.js';
import { verifySignedDer } from './chainValidator.js';

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
  /**
   * Certificate status. `good` and `revoked` come only from an
   * authenticated, matching and fresh answer; anything else is `unknown`
   * (see `unauthenticatedReason`).
   */
  status: 'good' | 'revoked' | 'unknown';
  /**
   * Why the answer was not accepted (it is not a well-formed
   * id-pkix-ocsp-basic response, is not signed by the issuer or an
   * authorized delegated responder, matches no request CertID, or lies
   * outside thisUpdate/nextUpdate), followed by the status the matching
   * SingleResponse claims when one matched. Absent when the answer was
   * accepted.
   */
  unauthenticatedReason?: string | undefined;
  /** Beginning of validity interval (the response's producedAt when no answer matched). */
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

const OID_SHA1 = '1.3.14.3.2.26';
const OID_PKIX_OCSP_BASIC = '1.3.6.1.5.5.7.48.1.1';
const OID_KP_OCSP_SIGNING = '1.3.6.1.5.5.7.3.9';

/** Clock skew tolerated around thisUpdate / nextUpdate (5 minutes). */
const FRESHNESS_SKEW_MS = 5 * 60 * 1000;
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
 * Compute SHA-1 hash using Web Crypto.
 * OCSP uses SHA-1 for issuer name/key hashes by default (RFC 6960).
 */
async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-1', toBuffer(data));
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
  return encodeOcspRequest(await computeCertId(cert, issuerCert));
}

/**
 * The CertID fields of an OCSP request (SHA-1 hashes, RFC 6960 4.1.1).
 */
interface CertIdFields {
  /** SHA-1 of the issuer's subject Name DER. */
  issuerNameHash: Uint8Array;
  /** SHA-1 of the issuer's public key (BIT STRING content without the unused-bits byte). */
  issuerKeyHash: Uint8Array;
  /** Serial number content bytes of the certificate to check. */
  serialNumber: Uint8Array;
}

/**
 * Compute the CertID fields for `cert`, issued by `issuerCert`.
 */
async function computeCertId(cert: Uint8Array, issuerCert: Uint8Array): Promise<CertIdFields> {
  // Hash the issuer's distinguished name (the subject of the issuer cert)
  const issuerNameHash = await sha1(extractSubjectRawBytes(issuerCert));

  // Hash the issuer's public key (BIT STRING content, skip the unused-bits byte)
  const issuerKeyHash = await sha1(extractPublicKeyBitString(issuerCert).subarray(1));

  // The serial number of the certificate to check
  const serialNumber = extractSerialNumber(cert);

  return { issuerNameHash, issuerKeyHash, serialNumber };
}

/**
 * Encode an OCSPRequest holding one Request for `certId`.
 */
function encodeOcspRequest(certIdFields: CertIdFields): Uint8Array {
  const hashAlgorithm = encodeSequence([encodeOID(OID_SHA1), encodeNull()]);

  const certId = encodeSequence([
    hashAlgorithm,
    encodeOctetString(certIdFields.issuerNameHash),
    encodeOctetString(certIdFields.issuerKeyHash),
    encodeInteger(certIdFields.serialNumber),
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
 * Parse only: the BasicOCSPResponse signature, the CertID hashes and the
 * thisUpdate/nextUpdate window are not checked, so the statuses returned
 * here are what the response claims. `checkCertificateStatus` performs
 * those checks.
 *
 * @param response  DER-encoded OCSP response bytes.
 * @returns         Parsed OCSP response.
 */
export function parseOcspResponse(response: Uint8Array): OcspResponse {
  const root = parseDerTlv(response, 0);

  if (root.children.length < 1) {
    throw new MalformedInputError('Invalid OCSP response: empty SEQUENCE', { format: 'der' });
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
    throw new MalformedInputError(
      `OCSP response error: ${statusNames[responseStatus] ?? `status ${responseStatus}`}`,
      { format: 'der' },
    );
  }

  if (root.children.length < 2) {
    throw new MalformedInputError('OCSP response contains no responseBytes', { format: 'der' });
  }

  // responseBytes [0] EXPLICIT
  const responseBytesWrapper = root.children[1]!;
  const responseBytes = responseBytesWrapper.children[0]!;

  // ResponseBytes: SEQUENCE { responseType OID, response OCTET STRING }
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
    responderId = 'name:' + responderIdNode.data.toHex();
  } else if (responderIdNode.tag === 0xa2) {
    // byKey — contains an OCTET STRING with key hash
    const keyHashNode = responderIdNode.children[0];
    responderId =
      'keyHash:' + (keyHashNode ? keyHashNode.data.toHex() : responderIdNode.data.toHex());
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
  const serialNumber = serialNode.data.toHex();

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

// ---------------------------------------------------------------------------
// Response authentication (used by checkCertificateStatus)
// ---------------------------------------------------------------------------

/**
 * The parts of a successful OCSPResponse that authentication needs.
 */
interface BasicResponseParts {
  /** The BasicOCSPResponse DER (the content of responseBytes.response). */
  der: Uint8Array;
  /** The parsed BasicOCSPResponse. */
  node: Asn1Node;
  /** The `responses` SEQUENCE OF SingleResponse of tbsResponseData. */
  responses: Asn1Node;
}

/**
 * Locate the BasicOCSPResponse in an OCSPResponse. Returns `undefined`
 * when the responseType is not id-pkix-ocsp-basic or the structure is
 * not the expected one.
 */
function extractBasicResponse(response: Uint8Array): BasicResponseParts | undefined {
  const root = parseDerTlv(response, 0);
  const responseBytes = root.children[1]?.children[0];
  const responseType = responseBytes?.children[0];
  const responseOctet = responseBytes?.children[1];
  if (responseType?.tag !== 0x06 || responseOctet?.tag !== 0x04) return undefined;
  if (decodeOidBytes(responseType.data) !== OID_PKIX_OCSP_BASIC) return undefined;

  const der = responseOctet.data;
  const node = parseDerTlv(der, 0);
  if (node.totalLength !== der.length) return undefined;

  const tbsResponseData = node.children[0];
  if (tbsResponseData === undefined) return undefined;
  // version [0] is optional; then responderID, producedAt, responses
  const base = tbsResponseData.children[0]?.tag === 0xa0 ? 1 : 0;
  const responses = tbsResponseData.children[base + 2];
  if (responses?.tag !== 0x30) return undefined;

  return { der, node, responses };
}

/**
 * Whether `certDer` is within its notBefore/notAfter window at `now`.
 */
function isCertCurrent(certDer: Uint8Array, now: number): boolean {
  const tbsCert = parseDerTlv(certDer, 0).children[0];
  if (tbsCert === undefined) return false;
  const base = tbsCert.children[0]?.tag === 0xa0 ? 1 : 0;
  const validity = tbsCert.children[base + 3];
  const notBeforeNode = validity?.children[0];
  const notAfterNode = validity?.children[1];
  if (notBeforeNode === undefined || notAfterNode === undefined) return false;
  const notBefore = parseAsn1Time(notBeforeNode).getTime();
  const notAfter = parseAsn1Time(notAfterNode).getTime();
  // NaN (an unparseable time) fails both comparisons
  return notBefore <= now && now <= notAfter;
}

/**
 * Whether `certDer` carries id-kp-OCSPSigning explicitly in its
 * extendedKeyUsage extension (absence of the extension and
 * anyExtendedKeyUsage do not count, RFC 6960 4.2.2.2).
 */
function hasOcspSigningEku(certDer: Uint8Array): boolean {
  try {
    return validateExtendedKeyUsage(certDer, []).presentOids.includes(OID_KP_OCSP_SIGNING);
  } catch {
    return false;
  }
}

/**
 * Whether the BasicOCSPResponse is signed by `issuerCert` itself, or by a
 * delegated responder certificate in `certs [0]` that `issuerCert`
 * signed, that carries id-kp-OCSPSigning and that is valid at `now`.
 */
async function authenticateOcspResponse(
  basic: BasicResponseParts,
  issuerCert: Uint8Array,
  now: number,
): Promise<boolean> {
  if (await verifySignedDer(basic.der, issuerCert)) return true;

  // certs [0] EXPLICIT SEQUENCE OF Certificate OPTIONAL (4th child)
  const certsWrapper = basic.node.children[3];
  const certsSeq = certsWrapper?.tag === 0xa0 ? certsWrapper.children[0] : undefined;
  if (certsSeq === undefined) return false;

  for (const certNode of certsSeq.children) {
    const responderCert = certsSeq.data.subarray(
      certNode.offset,
      certNode.offset + certNode.totalLength,
    );
    try {
      if (!(await verifySignedDer(responderCert, issuerCert))) continue;
      if (!hasOcspSigningEku(responderCert)) continue;
      if (!isCertCurrent(responderCert, now)) continue;
      if (await verifySignedDer(basic.der, responderCert)) return true;
    } catch {
      // A malformed certificate authorizes nothing
    }
  }
  return false;
}

/**
 * Compare two INTEGER contents by value (leading 0x00 bytes ignored).
 */
function integerContentsEqual(a: Uint8Array, b: Uint8Array): boolean {
  let i = 0;
  while (i < a.length - 1 && a[i] === 0) i++;
  let j = 0;
  while (j < b.length - 1 && b[j] === 0) j++;
  return bytesEqual(a.subarray(i), b.subarray(j));
}

/**
 * Compare two byte arrays (length and content).
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Index of the SingleResponse whose CertID issuerNameHash, issuerKeyHash
 * and serialNumber equal those of the request, or -1.
 */
function findMatchingSingleResponse(responses: Asn1Node, certId: CertIdFields): number {
  return responses.children.findIndex((single) => {
    const fields = single.children[0]?.children;
    const nameHash = fields?.[1];
    const keyHash = fields?.[2];
    const serial = fields?.[3];
    if (nameHash?.tag !== 0x04 || keyHash?.tag !== 0x04 || serial?.tag !== 0x02) return false;
    return (
      bytesEqual(nameHash.data, certId.issuerNameHash) &&
      bytesEqual(keyHash.data, certId.issuerKeyHash) &&
      integerContentsEqual(serial.data, certId.serialNumber)
    );
  });
}

/**
 * Check the revocation status of a certificate using OCSP.
 *
 * Builds an OCSP request, sends it to the specified OCSP responder
 * URL via HTTP POST (using `fetch()`), parses the response and accepts
 * its answer only when all of these hold:
 *
 * 1. The BasicOCSPResponse signature verifies with `issuerCert`, or with
 *    a delegated responder certificate from its `certs` field that
 *    `issuerCert` signed, that lists id-kp-OCSPSigning in its
 *    extendedKeyUsage and that is within its validity period now.
 * 2. A SingleResponse's CertID (issuerNameHash, issuerKeyHash,
 *    serialNumber) equals the request CertID; that SingleResponse is the
 *    answer.
 * 3. Its thisUpdate is at most 5 minutes in the future and, when present,
 *    its nextUpdate at most 5 minutes in the past. A response without
 *    nextUpdate is accepted (RFC 6960 allows it).
 *
 * Otherwise the result is `{ status: 'unknown', unauthenticatedReason }`,
 * also when the response claims `revoked`; when a SingleResponse matched,
 * its claimed status is quoted in `unauthenticatedReason`. The responder
 * certificate's own revocation status is not checked, and no trust anchor
 * beyond `issuerCert` is consulted.
 *
 * @param cert        DER-encoded certificate to check.
 * @param issuerCert  DER-encoded issuer certificate.
 * @param ocspUrl     URL of the OCSP responder.
 * @returns           The OCSP status result.
 * @throws {EnvironmentError} When the HTTP request fails (reason `'network'`).
 * @throws {MalformedInputError} When the responder returns an error status or the
 *                    response is not a well-formed OCSPResponse (format `'der'`).
 */
export async function checkCertificateStatus(
  cert: Uint8Array,
  issuerCert: Uint8Array,
  ocspUrl: string,
): Promise<OcspResult> {
  // Build the OCSP request
  const certId = await computeCertId(cert, issuerCert);
  const ocspReq = encodeOcspRequest(certId);

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
    throw new EnvironmentError(
      `OCSP request failed: HTTP ${response.status} ${response.statusText}`,
      { reason: 'network' },
    );
  }

  const respBytes = new Uint8Array(await response.arrayBuffer());
  const parsed = parseOcspResponse(respBytes);
  const now = Date.now();

  const basic = extractBasicResponse(respBytes);
  const matchIndex = basic === undefined ? -1 : findMatchingSingleResponse(basic.responses, certId);
  const single = parsed.responses[matchIndex];

  const unknown = (reason: string): OcspResult => ({
    status: 'unknown',
    thisUpdate: single?.thisUpdate ?? parsed.producedAt,
    unauthenticatedReason:
      single === undefined ? reason : `${reason}; the response claims ${single.status}`,
  });

  if (basic === undefined) {
    return unknown('the response is not a well-formed id-pkix-ocsp-basic response');
  }
  if (!(await authenticateOcspResponse(basic, issuerCert, now))) {
    return unknown(
      'the response signature does not verify with the issuer certificate or an ' +
        'issuer-certified delegated responder (id-kp-OCSPSigning)',
    );
  }
  if (single === undefined) {
    return unknown('no SingleResponse matches the request CertID');
  }

  const thisUpdate = single.thisUpdate.getTime();
  const nextUpdate = single.nextUpdate?.getTime();
  // NaN (an unparseable time) fails these comparisons, so it is not fresh
  if (!(thisUpdate <= now + FRESHNESS_SKEW_MS)) {
    return unknown('thisUpdate lies in the future');
  }
  if (nextUpdate !== undefined && !(nextUpdate >= now - FRESHNESS_SKEW_MS)) {
    return unknown('nextUpdate has passed; the response is stale');
  }

  return {
    status: single.status,
    thisUpdate: single.thisUpdate,
    nextUpdate: single.nextUpdate,
    revokedAt: single.revokedAt,
    revocationReason: single.revocationReason,
  };
}

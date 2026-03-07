/**
 * @module signature/crl
 *
 * CRL (Certificate Revocation List) download and parsing for
 * certificate revocation checking.
 *
 * Parses X.509 v2 CRL structures (RFC 5280) in DER format and
 * provides functions to download CRLs and check if a certificate
 * serial number has been revoked.
 *
 * Uses the ASN.1 DER utilities from `./pkcs7.ts` for decoding.
 *
 * References:
 * - RFC 5280 (X.509 PKI Certificate and CRL Profile)
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  decodeOidBytes,
  toBuffer,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single revoked certificate entry in a CRL.
 */
export interface CrlEntry {
  /** Serial number of the revoked certificate (hex-encoded). */
  serialNumber: string;
  /** Date when the certificate was revoked. */
  revocationDate: Date;
  /** CRL reason code string (if present). */
  reason?: string | undefined;
}

/**
 * Parsed CRL data.
 */
export interface CrlData {
  /** Issuer distinguished name (hex-encoded DER bytes). */
  issuer: string;
  /** Date this CRL was issued. */
  thisUpdate: Date;
  /** Date the next CRL will be issued (if present). */
  nextUpdate?: Date | undefined;
  /** List of revoked certificate entries. */
  entries: CrlEntry[];
}

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

const OID_CRL_DISTRIBUTION_POINTS = '2.5.29.31';
const OID_CRL_REASON = '2.5.29.21';

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
 * Convert a Uint8Array to a hex string.
 */
function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse a GeneralizedTime string (YYYYMMDDHHmmSS[.fff]Z) to Date.
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
 * Parse a UTCTime string (YYMMDDHHmmSSZ) to Date.
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
 * Extract extensions from TBSCertificate.
 * Extensions are at [3] EXPLICIT SEQUENCE OF Extension (v3 certs).
 */
function extractCertExtensions(certDer: Uint8Array): Asn1Node[] {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  for (const child of tbsCert.children) {
    if (child.tag === 0xa3) {
      if (child.children.length > 0) {
        const extSeq = child.children[0]!;
        return extSeq.children;
      }
    }
  }

  return [];
}

/**
 * Extract the CRL reason from a revoked certificate entry's extensions.
 */
function extractEntryReason(entryNode: Asn1Node): string | undefined {
  // RevokedCertificate: SEQUENCE { serialNumber, revocationDate, [extensions] }
  if (entryNode.children.length < 3) return undefined;

  const extensionsNode = entryNode.children[2]!;
  // Extensions is a SEQUENCE OF Extension
  for (const ext of extensionsNode.children) {
    const oidNode = ext.children[0]!;
    const oid = decodeOidBytes(oidNode.data);

    if (oid === OID_CRL_REASON) {
      // CRLReason extension value is an OCTET STRING containing ENUMERATED
      const valueIdx = ext.children.length > 2 ? 2 : 1;
      const valueNode = ext.children[valueIdx]!;
      // Parse the OCTET STRING content
      const enumNode = parseDerTlv(valueNode.data, 0);
      const reasonCode = enumNode.data[0] ?? 0;
      return CRL_REASONS[reasonCode] ?? `reason(${reasonCode})`;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a DER-encoded CRL (X.509 v2 Certificate Revocation List).
 *
 * ```
 * CertificateList ::= SEQUENCE {
 *   tbsCertList TBSCertList,
 *   signatureAlgorithm AlgorithmIdentifier,
 *   signatureValue BIT STRING
 * }
 * TBSCertList ::= SEQUENCE {
 *   version          INTEGER OPTIONAL (v2 only),
 *   signature        AlgorithmIdentifier,
 *   issuer           Name,
 *   thisUpdate       Time,
 *   nextUpdate       Time OPTIONAL,
 *   revokedCertificates SEQUENCE OF RevokedCertificate OPTIONAL,
 *   crlExtensions    [0] EXPLICIT Extensions OPTIONAL
 * }
 * RevokedCertificate ::= SEQUENCE {
 *   userCertificate    CertificateSerialNumber (INTEGER),
 *   revocationDate     Time,
 *   crlEntryExtensions Extensions OPTIONAL
 * }
 * ```
 *
 * @param data  DER-encoded CRL bytes.
 * @returns     Parsed CRL data.
 */
export function parseCrl(data: Uint8Array): CrlData {
  const root = parseDerTlv(data, 0);

  if (root.children.length < 1) {
    throw new Error('Invalid CRL: empty SEQUENCE');
  }

  // TBSCertList
  const tbsCertList = root.children[0]!;
  let idx = 0;

  // version INTEGER OPTIONAL — present for v2 CRLs
  // If the first child is an INTEGER with value 1 (v2), skip it
  if (
    tbsCertList.children[idx]!.tag === 0x02 &&
    tbsCertList.children[idx]!.data.length === 1 &&
    tbsCertList.children[idx]!.data[0] === 1
  ) {
    idx++; // skip version
  }

  // signature AlgorithmIdentifier
  idx++; // skip

  // issuer Name
  const issuerNode = tbsCertList.children[idx]!;
  const issuer = toHex(issuerNode.data);
  idx++;

  // thisUpdate Time
  const thisUpdateNode = tbsCertList.children[idx]!;
  const thisUpdate = parseAsn1Time(thisUpdateNode);
  idx++;

  // nextUpdate Time OPTIONAL
  let nextUpdate: Date | undefined;
  if (
    idx < tbsCertList.children.length &&
    (tbsCertList.children[idx]!.tag === 0x17 || tbsCertList.children[idx]!.tag === 0x18)
  ) {
    nextUpdate = parseAsn1Time(tbsCertList.children[idx]!);
    idx++;
  }

  // revokedCertificates SEQUENCE OF OPTIONAL
  const entries: CrlEntry[] = [];
  if (
    idx < tbsCertList.children.length &&
    tbsCertList.children[idx]!.tag === 0x30
  ) {
    const revokedSeq = tbsCertList.children[idx]!;

    for (const revokedCert of revokedSeq.children) {
      // userCertificate INTEGER
      const serialNode = revokedCert.children[0]!;
      const serialNumber = toHex(serialNode.data);

      // revocationDate Time
      const revDateNode = revokedCert.children[1]!;
      const revocationDate = parseAsn1Time(revDateNode);

      // CRL entry extensions (optional)
      const reason = extractEntryReason(revokedCert);

      entries.push({
        serialNumber,
        revocationDate,
        reason,
      });
    }
  }

  return {
    issuer,
    thisUpdate,
    nextUpdate,
    entries,
  };
}

/**
 * Download and parse a CRL from a URL.
 *
 * Uses `fetch()` to retrieve the CRL and then parses it as DER.
 * If the response is PEM-encoded, it is automatically converted to DER.
 *
 * @param url  URL of the CRL (typically an HTTP URL from CRL Distribution Points).
 * @returns    Parsed CRL data.
 */
export async function downloadCrl(url: string): Promise<CrlData> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/pkix-crl, application/x-pkcs7-crl',
    },
  });

  if (!response.ok) {
    throw new Error(
      `CRL download failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  let crlBytes = new Uint8Array(await response.arrayBuffer());

  // Check if this is PEM-encoded (starts with "-----BEGIN")
  if (crlBytes[0] === 0x2d) { // '-'
    const textDecoder = new TextDecoder('ascii');
    const pem = textDecoder.decode(crlBytes);
    const base64 = pem
      .replace(/-----BEGIN[^-]+-----/, '')
      .replace(/-----END[^-]+-----/, '')
      .replace(/\s/g, '');
    const binaryStr = atob(base64);
    crlBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      crlBytes[i] = binaryStr.charCodeAt(i);
    }
  }

  return parseCrl(crlBytes);
}

/**
 * Check if a certificate's serial number appears in a CRL.
 *
 * Compares the certificate's serial number against all entries
 * in the CRL's revoked certificates list.
 *
 * @param cert  DER-encoded X.509 certificate to check.
 * @param crl   Parsed CRL data.
 * @returns     `true` if the certificate is listed as revoked.
 */
export function isCertificateRevoked(cert: Uint8Array, crl: CrlData): boolean {
  // Extract serial number from the certificate
  const certRoot = parseDerTlv(cert, 0);
  const tbsCert = certRoot.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }
  const serialNode = tbsCert.children[idx]!;
  const certSerial = toHex(serialNode.data);

  // Check if this serial appears in the CRL entries
  return crl.entries.some((entry) => entry.serialNumber === certSerial);
}

/**
 * Extract CRL Distribution Points URLs from a certificate.
 *
 * Looks for the CRL Distribution Points extension (OID 2.5.29.31)
 * and extracts HTTP/LDAP URIs from the DistributionPoint structures.
 *
 * ```
 * CRLDistributionPoints ::= SEQUENCE OF DistributionPoint
 * DistributionPoint ::= SEQUENCE {
 *   distributionPoint [0] DistributionPointName OPTIONAL,
 *   reasons           [1] ReasonFlags OPTIONAL,
 *   cRLIssuer         [2] GeneralNames OPTIONAL
 * }
 * DistributionPointName ::= CHOICE {
 *   fullName    [0] GeneralNames,
 *   nameRelativeToCRLIssuer [1] RelativeDistinguishedName
 * }
 * ```
 *
 * @param cert  DER-encoded X.509 certificate.
 * @returns     Array of CRL URLs found in the certificate.
 */
export function extractCrlUrls(cert: Uint8Array): string[] {
  const urls: string[] = [];
  const textDecoder = new TextDecoder('ascii');

  try {
    const extensions = extractCertExtensions(cert);

    for (const ext of extensions) {
      const oidNode = ext.children[0]!;
      const oid = decodeOidBytes(oidNode.data);

      if (oid === OID_CRL_DISTRIBUTION_POINTS) {
        // The value is an OCTET STRING containing the extension data
        const valueIdx = ext.children.length > 2 ? 2 : 1;
        const valueNode = ext.children[valueIdx]!;

        // Parse the extension value as SEQUENCE OF DistributionPoint
        const dpSeq = parseDerTlv(valueNode.data, 0);

        for (const dp of dpSeq.children) {
          // DistributionPoint: SEQUENCE { [0] DistributionPointName, ... }
          if (dp.children.length < 1) continue;

          const dpName = dp.children[0]!;
          // [0] = distributionPoint
          if ((dpName.tag & 0x1f) !== 0) continue;

          // DistributionPointName: fullName [0] GeneralNames
          for (const gnWrapper of dpName.children) {
            // Check if this is fullName [0]
            if ((gnWrapper.tag & 0x1f) === 0) {
              // GeneralNames: could be the name directly or wrapped
              // Try to extract URI (tag [6])
              if (gnWrapper.children.length > 0) {
                for (const gn of gnWrapper.children) {
                  if ((gn.tag & 0x1f) === 6) {
                    urls.push(textDecoder.decode(gn.data));
                  }
                }
              } else {
                // Direct GeneralName
                if ((gnWrapper.tag & 0x1f) === 6) {
                  urls.push(textDecoder.decode(gnWrapper.data));
                }
              }
            } else if ((gnWrapper.tag & 0x1f) === 6) {
              // Direct URI GeneralName
              urls.push(textDecoder.decode(gnWrapper.data));
            }
          }
        }
      }
    }
  } catch {
    // Extension parsing failed
  }

  return urls;
}

/**
 * @module signature/deltaCrl
 *
 * Delta CRL support for certificate revocation checking.
 *
 * A delta CRL contains only the changes since the last base CRL was
 * issued.  This module parses delta CRLs, detects the Delta CRL
 * Indicator extension, and merges delta CRLs with their base CRL.
 *
 * References:
 * - RFC 5280 SS5.2.4 (Delta CRL Indicator)
 * - RFC 5280 SS5.1 (CRL structure)
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  decodeOidBytes,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';
import type { CrlData } from './revocationCache.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Delta CRL data, extending the base CRL data with delta-specific fields.
 */
export interface DeltaCrlData extends CrlData {
  /** The CRL number of this delta CRL. */
  deltaNumber: number;
  /** The CRL number of the base CRL this delta applies to. */
  baseIndicator: number;
}

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

/**
 * OID for the Delta CRL Indicator extension (2.5.29.27).
 * @internal
 */
const OID_DELTA_CRL_INDICATOR = '2.5.29.27';

/**
 * OID for the CRL Number extension (2.5.29.20).
 * @internal
 */
const OID_CRL_NUMBER = '2.5.29.20';

/**
 * OID for the CRL Reason Code extension (2.5.29.21).
 * @internal
 */
const OID_REASON_CODE = '2.5.29.21';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const textDecoder = new TextDecoder('ascii');

/**
 * CRL reason code names as defined in RFC 5280 SS5.3.1.
 * @internal
 */
const REASON_CODES: Record<number, string> = {
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

/**
 * Parse a GeneralizedTime or UTCTime ASN.1 value to a Date.
 * @internal
 */
function parseTime(node: Asn1Node): Date {
  const timeStr = textDecoder.decode(node.data);

  if (node.tag === 0x18) {
    // GeneralizedTime: YYYYMMDDHHmmSS[.fff]Z
    const clean = timeStr.replace('Z', '').replace(/\..*$/, '');
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10) - 1;
    const day = parseInt(clean.substring(6, 8), 10);
    const hours = parseInt(clean.substring(8, 10), 10);
    const minutes = parseInt(clean.substring(10, 12), 10);
    const seconds = parseInt(clean.substring(12, 14), 10) || 0;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // UTCTime: YYMMDDHHmmSSZ
  const clean = timeStr.replace('Z', '');
  const year = parseInt(clean.substring(0, 2), 10);
  const month = parseInt(clean.substring(2, 4), 10) - 1;
  const day = parseInt(clean.substring(4, 6), 10);
  const hours = parseInt(clean.substring(6, 8), 10);
  const minutes = parseInt(clean.substring(8, 10), 10);
  const seconds = parseInt(clean.substring(10, 12), 10) || 0;
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Extract the issuer Common Name from an ASN.1 Name node.
 * @internal
 */
function extractIssuerName(nameNode: Asn1Node): string {
  const cnOidBytes = [0x55, 0x04, 0x03]; // OID for CN: 2.5.4.3
  const utf8Decoder = new TextDecoder('utf-8');

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
        return utf8Decoder.decode(atv.children[1]!.data);
      }
    }
  }

  return 'Unknown';
}

/**
 * Parse an INTEGER ASN.1 node into a number.
 *
 * Only handles non-negative integers that fit in a JavaScript number.
 * @internal
 */
function parseIntegerValue(data: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < data.length; i++) {
    value = (value * 256) + data[i]!;
  }
  return value;
}

/**
 * Parse the TBSCertList from a CRL.
 *
 * TBSCertList ::= SEQUENCE {
 *   version               Version OPTIONAL,
 *   signature             AlgorithmIdentifier,
 *   issuer                Name,
 *   thisUpdate            Time,
 *   nextUpdate            Time OPTIONAL,
 *   revokedCertificates   SEQUENCE OF SEQUENCE { ... } OPTIONAL,
 *   extensions        [0] EXPLICIT Extensions OPTIONAL
 * }
 *
 * @internal
 */
function parseTbsCertList(data: Uint8Array): {
  issuer: string;
  thisUpdate: Date;
  nextUpdate?: Date;
  entries: Array<{ serialNumber: Uint8Array; revocationDate: Date; reason?: string }>;
  extensions: Asn1Node[];
} {
  const tbs = parseDerTlv(data, 0);
  const children = tbs.children;
  let idx = 0;

  // version (OPTIONAL, INTEGER) — if present, must be v2(1)
  if (children[idx]!.tag === 0x02) {
    idx++; // skip version
  }

  // signature AlgorithmIdentifier
  idx++; // skip

  // issuer Name
  const issuerNode = children[idx]!;
  const issuer = extractIssuerName(issuerNode);
  idx++;

  // thisUpdate Time
  const thisUpdate = parseTime(children[idx]!);
  idx++;

  // nextUpdate Time (OPTIONAL)
  let nextUpdate: Date | undefined;
  if (idx < children.length && (children[idx]!.tag === 0x17 || children[idx]!.tag === 0x18)) {
    nextUpdate = parseTime(children[idx]!);
    idx++;
  }

  // revokedCertificates (OPTIONAL, SEQUENCE OF)
  const entries: Array<{ serialNumber: Uint8Array; revocationDate: Date; reason?: string }> = [];
  if (idx < children.length && children[idx]!.tag === 0x30) {
    const revokedSeq = children[idx]!;
    for (const revokedEntry of revokedSeq.children) {
      if (revokedEntry.children.length < 2) continue;

      const serialNode = revokedEntry.children[0]!;
      const serialNumber = new Uint8Array(serialNode.data);

      const revDateNode = revokedEntry.children[1]!;
      const revocationDate = parseTime(revDateNode);

      // Check for reason code extension (optional, child at index 2)
      let reason: string | undefined;
      if (revokedEntry.children.length > 2) {
        const extsNode = revokedEntry.children[2]!;
        if (extsNode.tag === 0x30) {
          for (const ext of extsNode.children) {
            if (ext.children.length >= 2) {
              const extOid = decodeOidBytes(ext.children[0]!.data);
              if (extOid === OID_REASON_CODE) {
                // Value is an OCTET STRING wrapping an ENUMERATED
                const valueNode = ext.children[ext.children.length - 1]!;
                const innerData = valueNode.tag === 0x04 ? valueNode.data : valueNode.data;
                // Parse the ENUMERATED inside the OCTET STRING
                if (innerData.length >= 3 && innerData[0] === 0x0a) {
                  const reasonCode = innerData[2]!;
                  reason = REASON_CODES[reasonCode] ?? `unknown(${reasonCode})`;
                }
              }
            }
          }
        }
      }

      entries.push({ serialNumber, revocationDate, ...(reason !== undefined && { reason }) });
    }
    idx++;
  }

  // extensions [0] EXPLICIT (OPTIONAL)
  const extensions: Asn1Node[] = [];
  if (idx < children.length && children[idx]!.tag === 0xa0) {
    const extsWrapper = children[idx]!;
    if (extsWrapper.children.length > 0) {
      const extsSeq = extsWrapper.children[0]!;
      extensions.push(...extsSeq.children);
    }
  }

  return { issuer, thisUpdate, ...(nextUpdate !== undefined && { nextUpdate }), entries, extensions };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a DER-encoded CRL is a delta CRL.
 *
 * A delta CRL contains a Delta CRL Indicator extension
 * (OID 2.5.29.27) that identifies it as a delta and points to
 * the base CRL number.
 *
 * @param data  DER-encoded CRL bytes.
 * @returns     `true` if the CRL is a delta CRL.
 */
export function isDeltaCrl(data: Uint8Array): boolean {
  try {
    // CertificateList ::= SEQUENCE { tbsCertList, ... }
    const certList = parseDerTlv(data, 0);
    const tbsData = certList.children[0]!;
    const tbsStart = tbsData.offset + (certList.data.byteOffset - data.byteOffset);
    const tbsBytes = data.subarray(tbsStart, tbsStart + tbsData.totalLength);

    const { extensions } = parseTbsCertList(tbsBytes);

    for (const ext of extensions) {
      if (ext.children.length >= 2) {
        const oid = decodeOidBytes(ext.children[0]!.data);
        if (oid === OID_DELTA_CRL_INDICATOR) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Parse a DER-encoded delta CRL into a structured object.
 *
 * Extracts the CRL entries, delta CRL number, and the base CRL
 * indicator (the CRL number of the base CRL this delta applies to).
 *
 * @param data  DER-encoded delta CRL bytes.
 * @returns     Parsed delta CRL data.
 * @throws      Error if the data is not a valid delta CRL.
 */
export function parseDeltaCrl(data: Uint8Array): DeltaCrlData {
  const certList = parseDerTlv(data, 0);
  if (certList.children.length === 0) {
    throw new Error('Invalid CRL: empty SEQUENCE');
  }

  const tbsData = certList.children[0]!;
  const tbsStart = tbsData.offset + (certList.data.byteOffset - data.byteOffset);
  const tbsBytes = data.subarray(tbsStart, tbsStart + tbsData.totalLength);

  const { issuer, thisUpdate, nextUpdate, entries, extensions } = parseTbsCertList(tbsBytes);

  let deltaNumber = -1;
  let baseIndicator = -1;

  for (const ext of extensions) {
    if (ext.children.length < 2) continue;

    const oid = decodeOidBytes(ext.children[0]!.data);

    // The extension value is the last child (may have a critical BOOLEAN in between)
    const valueNode = ext.children[ext.children.length - 1]!;

    if (oid === OID_CRL_NUMBER) {
      // CRL Number: OCTET STRING wrapping an INTEGER
      if (valueNode.tag === 0x04) {
        const inner = parseDerTlv(valueNode.data, 0);
        deltaNumber = parseIntegerValue(inner.data);
      }
    }

    if (oid === OID_DELTA_CRL_INDICATOR) {
      // Delta CRL Indicator: OCTET STRING wrapping an INTEGER
      if (valueNode.tag === 0x04) {
        const inner = parseDerTlv(valueNode.data, 0);
        baseIndicator = parseIntegerValue(inner.data);
      }
    }
  }

  if (baseIndicator === -1) {
    throw new Error('Not a delta CRL: missing Delta CRL Indicator extension');
  }

  if (deltaNumber === -1) {
    // If no CRL Number extension, default to baseIndicator + 1
    deltaNumber = baseIndicator + 1;
  }

  return {
    issuer,
    thisUpdate,
    nextUpdate,
    entries,
    deltaNumber,
    baseIndicator,
  };
}

/**
 * Merge a base CRL with a delta CRL.
 *
 * Creates a new CRL dataset that combines the base CRL entries with
 * the delta CRL entries.  If a serial number appears in both the base
 * and delta CRL, the delta entry takes precedence.  Entries with
 * reason `removeFromCRL` are removed from the merged result.
 *
 * @param baseCrl   The base CRL data.
 * @param deltaCrl  The delta CRL data to merge.
 * @returns         A new merged CRL data object.
 */
export function mergeCrls(baseCrl: CrlData, deltaCrl: DeltaCrlData): CrlData {
  // Build a map of serial number -> entry from the base CRL
  // Use hex string of serial as map key for reliable comparison
  const entryMap = new Map<string, { serialNumber: Uint8Array; revocationDate: Date; reason?: string | undefined }>();

  const copyEntry = (e: { serialNumber: Uint8Array; revocationDate: Date; reason?: string | undefined }): { serialNumber: Uint8Array; revocationDate: Date; reason?: string | undefined } => ({
    serialNumber: e.serialNumber,
    revocationDate: e.revocationDate,
    ...(e.reason !== undefined && { reason: e.reason }),
  });

  for (const entry of baseCrl.entries) {
    const key = serialToHex(entry.serialNumber);
    entryMap.set(key, copyEntry(entry));
  }

  // Apply delta CRL entries
  for (const deltaEntry of deltaCrl.entries) {
    const key = serialToHex(deltaEntry.serialNumber);

    if (deltaEntry.reason === 'removeFromCRL') {
      entryMap.delete(key);
    } else {
      entryMap.set(key, copyEntry(deltaEntry));
    }
  }

  return {
    issuer: deltaCrl.issuer || baseCrl.issuer,
    thisUpdate: deltaCrl.thisUpdate,
    nextUpdate: deltaCrl.nextUpdate ?? baseCrl.nextUpdate,
    entries: Array.from(entryMap.values()),
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Convert a serial number Uint8Array to a hex string for map keys.
 * @internal
 */
function serialToHex(serial: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < serial.length; i++) {
    hex += serial[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

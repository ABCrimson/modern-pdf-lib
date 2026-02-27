/**
 * @module signature/timestamp
 *
 * RFC 3161 Timestamp Authority (TSA) client for timestamped signatures.
 *
 * Timestamps provide proof that a document was signed at a specific time,
 * independent of the signer's system clock.  A TSA is a trusted third
 * party that cryptographically binds a hash to a specific moment in time.
 *
 * This module builds TimeStampReq messages, sends them to a TSA via
 * HTTP POST (using `fetch()`), and parses TimeStampResp messages.
 *
 * References:
 * - RFC 3161 (Internet X.509 PKI Time-Stamp Protocol)
 * - RFC 5816 (ESSCertIDv2 Update for RFC 3161)
 *
 * @packageDocumentation
 */

import {
  encodeSequence,
  encodeOID,
  encodeOctetString,
  encodeContextTag,
  encodeLength,
  parseDerTlv,
  decodeOidBytes,
} from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result from a timestamp request.
 */
export interface TimestampResult {
  /** The DER-encoded TimeStampToken (a CMS SignedData). */
  timestampToken: Uint8Array;
  /** The signing time reported by the TSA. */
  signingTime: Date;
}

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

const HASH_OID_MAP: Record<string, string> = {
  'SHA-256': '2.16.840.1.101.3.4.2.1',
  'SHA-384': '2.16.840.1.101.3.4.2.2',
  'SHA-512': '2.16.840.1.101.3.4.2.3',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Encode a BOOLEAN TRUE value in DER.
 */
function encodeBooleanTrue(): Uint8Array {
  return new Uint8Array([0x01, 0x01, 0xff]);
}

/**
 * Encode an INTEGER value in DER.
 */
function encodeIntegerValue(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([0x02, 0x01, value]);
  }
  if (value < 0x8000) {
    return new Uint8Array([0x02, 0x02, (value >> 8) & 0xff, value & 0xff]);
  }
  return new Uint8Array([
    0x02, 0x03,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
}

/**
 * Parse a GeneralizedTime string (YYYYMMDDHHmmSS[.fff]Z) to a Date.
 */
function parseGeneralizedTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '').replace(/\..*$/, '');
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hours = parseInt(clean.substring(8, 10), 10);
  const minutes = parseInt(clean.substring(10, 12), 10);
  const seconds = parseInt(clean.substring(12, 14), 10) || 0;

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Parse a UTCTime string (YYMMDDHHmmSSZ) to a Date.
 */
function parseUtcTime(timeStr: string): Date {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a DER-encoded TimeStampReq (RFC 3161 SS2.4.1).
 *
 * ```
 * TimeStampReq ::= SEQUENCE {
 *   version         INTEGER { v1(1) },
 *   messageImprint  MessageImprint,
 *   reqPolicy       TSAPolicyId OPTIONAL,
 *   nonce           INTEGER OPTIONAL,
 *   certReq         BOOLEAN DEFAULT FALSE,
 *   extensions      [0] IMPLICIT Extensions OPTIONAL
 * }
 *
 * MessageImprint ::= SEQUENCE {
 *   hashAlgorithm   AlgorithmIdentifier,
 *   hashedMessage    OCTET STRING
 * }
 * ```
 *
 * @param dataHash       The hash of the data to timestamp.
 * @param hashAlgorithm  The hash algorithm used.
 * @returns              DER-encoded TimeStampReq.
 */
export function buildTimestampRequest(
  dataHash: Uint8Array,
  hashAlgorithm: string,
): Uint8Array {
  const hashOid = HASH_OID_MAP[hashAlgorithm];
  if (!hashOid) {
    throw new Error(`Unsupported hash algorithm for timestamp: ${hashAlgorithm}`);
  }

  // version: 1
  const version = encodeIntegerValue(1);

  // messageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING }
  const algorithmId = encodeSequence([
    encodeOID(hashOid),
    new Uint8Array([0x05, 0x00]), // NULL parameters
  ]);
  const messageImprint = encodeSequence([
    algorithmId,
    encodeOctetString(dataHash),
  ]);

  // Generate a random nonce (8 bytes)
  const nonceBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(nonceBytes);
  // Ensure positive by clearing the high bit
  nonceBytes[0] = nonceBytes[0]! & 0x7f;
  // Encode as INTEGER
  const nonce = new Uint8Array(2 + nonceBytes.length);
  nonce[0] = 0x02; // INTEGER tag
  nonce[1] = nonceBytes.length;
  nonce.set(nonceBytes, 2);

  // certReq: TRUE (request the TSA to include its certificate)
  const certReq = encodeBooleanTrue();

  return encodeSequence([version, messageImprint, nonce, certReq]);
}

/**
 * Parse a DER-encoded TimeStampResp (RFC 3161 SS2.4.2).
 *
 * ```
 * TimeStampResp ::= SEQUENCE {
 *   status          PKIStatusInfo,
 *   timeStampToken  ContentInfo OPTIONAL
 * }
 *
 * PKIStatusInfo ::= SEQUENCE {
 *   status        PKIStatus (INTEGER),
 *   statusString  PKIFreeText OPTIONAL,
 *   failInfo      PKIFailureInfo OPTIONAL
 * }
 * ```
 *
 * @param response  DER-encoded TimeStampResp.
 * @returns         The parsed timestamp result.
 * @throws          Error if the TSA reported an error status.
 */
export function parseTimestampResponse(response: Uint8Array): TimestampResult {
  const resp = parseDerTlv(response, 0);

  if (resp.children.length < 1) {
    throw new Error('Invalid TimeStampResp: empty SEQUENCE');
  }

  // Parse PKIStatusInfo
  const statusInfo = resp.children[0]!;
  const statusValue = statusInfo.children[0]!;
  const status = statusValue.data[0]!;

  // Status: 0 = granted, 1 = grantedWithMods
  if (status !== 0 && status !== 1) {
    let errorMsg = `TSA returned error status ${status}`;
    if (statusInfo.children.length > 1) {
      // Try to extract statusString
      const statusString = statusInfo.children[1]!;
      try {
        const textDecoder = new TextDecoder('utf-8');
        errorMsg += `: ${textDecoder.decode(statusString.data)}`;
      } catch {
        // Ignore decoding error
      }
    }
    throw new Error(errorMsg);
  }

  // Extract the TimeStampToken (ContentInfo)
  if (resp.children.length < 2) {
    throw new Error('TimeStampResp contains no TimeStampToken');
  }

  const tokenNode = resp.children[1]!;
  const tokenStart = tokenNode.offset;
  const timestampToken = response.subarray(
    tokenStart,
    tokenStart + tokenNode.totalLength,
  );

  // Extract the signing time from the TSTInfo inside the token
  const signingTime = extractTstInfoTime(tokenNode);

  return { timestampToken, signingTime };
}

/**
 * Extract the genTime from a TimeStampToken's TSTInfo.
 *
 * The token is a ContentInfo containing SignedData, which in turn
 * contains the TSTInfo as the encapsulated content.
 */
function extractTstInfoTime(contentInfo: ReturnType<typeof parseDerTlv>): Date {
  try {
    // ContentInfo > [0] SignedData > encapContentInfo > [0] TSTInfo
    const signedDataWrapper = contentInfo.children[1]!;
    const signedData = signedDataWrapper.children[0]!;

    // Find encapContentInfo (the SEQUENCE with data OID)
    for (const child of signedData.children) {
      if (child.tag === 0x30 && child.children.length >= 1) {
        // Check if this is the encapContentInfo with eContent
        const oidNode = child.children[0]!;
        if (oidNode.tag === 0x06) {
          const oid = decodeOidBytes(oidNode.data);
          // OID for id-ct-TSTInfo: 1.2.840.113549.1.9.16.1.4
          if (oid === '1.2.840.113549.1.9.16.1.4' && child.children.length >= 2) {
            const eContentWrapper = child.children[1]!;
            // [0] EXPLICIT OCTET STRING containing TSTInfo
            const eContent = eContentWrapper.children[0]!;
            const tstInfo = parseDerTlv(eContent.data, 0);

            // TSTInfo: version, policy, messageImprint, serialNumber, genTime, ...
            // genTime is at index 4
            if (tstInfo.children.length >= 5) {
              const genTimeNode = tstInfo.children[4]!;
              const textDecoder = new TextDecoder('ascii');
              const timeStr = textDecoder.decode(genTimeNode.data);
              if (genTimeNode.tag === 0x18) {
                return parseGeneralizedTime(timeStr);
              }
              return parseUtcTime(timeStr);
            }
          }
        }
      }
    }
  } catch {
    // Fall through
  }

  // Default: return current time if parsing fails
  return new Date();
}

/**
 * Request a timestamp from an RFC 3161 TSA.
 *
 * Sends a TimeStampReq via HTTP POST and parses the TimeStampResp.
 * Uses `fetch()` for universal runtime compatibility (Node.js 18+,
 * browsers, Deno, Bun, Cloudflare Workers).
 *
 * @param dataHash       The hash of the data to timestamp.
 * @param tsaUrl         The URL of the TSA service.
 * @param hashAlgorithm  The hash algorithm. Default 'SHA-256'.
 * @returns              The timestamp result.
 * @throws               Error if the request fails or the TSA returns
 *                       an error status.
 *
 * @example
 * ```ts
 * const hash = await computeSignatureHash(pdfBytes, byteRange);
 * const timestamp = await requestTimestamp(
 *   hash,
 *   'http://timestamp.digicert.com',
 * );
 * ```
 */
export async function requestTimestamp(
  dataHash: Uint8Array,
  tsaUrl: string,
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
): Promise<TimestampResult> {
  // Build the request
  const tsReq = buildTimestampRequest(dataHash, hashAlgorithm);

  // Send via fetch — convert to ArrayBuffer for universal BodyInit compatibility
  const bodyBuffer = tsReq.buffer.slice(
    tsReq.byteOffset,
    tsReq.byteOffset + tsReq.byteLength,
  ) as ArrayBuffer;
  const response = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    throw new Error(
      `TSA request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType && !contentType.includes('timestamp-reply')) {
    // Some TSAs use different content types; only warn, don't fail
  }

  const respBytes = new Uint8Array(await response.arrayBuffer());

  // Parse the response
  return parseTimestampResponse(respBytes);
}

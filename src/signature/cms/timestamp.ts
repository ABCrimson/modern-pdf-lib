/**
 * @module signature/cms/timestamp
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
  encodeInteger,
  parseDerTlv,
  decodeOidBytes,
} from './pkcs7.js';
import {
  EnvironmentError,
  InvalidArgumentError,
  MalformedInputError,
  TimestampVerificationError,
  UnsupportedFeatureError,
} from '../../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result from a timestamp request.
 *
 * The token's CMS signature and the TSA certificate are not verified:
 * the fields below are read from the TSTInfo, whose messageImprint and
 * nonce are checked only against what the caller supplied.
 */
export interface TimestampResult {
  /** The DER-encoded TimeStampToken (a CMS SignedData). */
  timestampToken: Uint8Array;
  /** The signing time reported by the TSA (the TSTInfo genTime). */
  signingTime: Date;
  /** The hash the TSTInfo messageImprint carries. */
  hashedMessage: Uint8Array;
  /** The nonce the TSTInfo carries (INTEGER content bytes), when it has one. */
  nonce?: Uint8Array | undefined;
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
  return new Uint8Array([0x02, 0x03, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
}

/**
 * Parse a GeneralizedTime string (YYYYMMDDHHmmSS[.fff]Z) to a Date.
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
 * Parse a UTCTime string (YYMMDDHHmmSSZ) to a Date.
 */
function parseUtcTime(timeStr: string): Date {
  const clean = timeStr.replace('Z', '');
  const year = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10) - 1;
  const day = parseInt(clean.slice(4, 6), 10);
  const hours = parseInt(clean.slice(6, 8), 10);
  const minutes = parseInt(clean.slice(8, 10), 10);
  const seconds = parseInt(clean.slice(10, 12), 10) || 0;

  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate 8 random nonce bytes that encode as a minimal, positive DER
 * INTEGER: the top bit is cleared and the first byte is nonzero.
 */
function generateNonce(): Uint8Array {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  bytes[0] = (bytes[0] ?? 1) & 0x7f || 1;
  return bytes;
}

/**
 * Remove leading 0x00 bytes so two INTEGER encodings compare by value.
 */
function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  return bytes.subarray(start);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
 * @param nonce          The nonce to send, as unsigned big-endian bytes
 *                       (encoded as a positive DER INTEGER; must not be
 *                       empty). When omitted, a random 8-byte nonce is
 *                       generated.
 * @returns              DER-encoded TimeStampReq.
 * @throws               {@link InvalidArgumentError} if `nonce` is empty.
 */
export function buildTimestampRequest(
  dataHash: Uint8Array,
  hashAlgorithm: string,
  nonce?: Uint8Array,
): Uint8Array {
  const hashOid = HASH_OID_MAP[hashAlgorithm];
  if (!hashOid) {
    throw new UnsupportedFeatureError(`Unsupported hash algorithm for timestamp: ${hashAlgorithm}`);
  }

  // version: 1
  const version = encodeIntegerValue(1);

  // messageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING }
  const algorithmId = encodeSequence([
    encodeOID(hashOid),
    new Uint8Array([0x05, 0x00]), // NULL parameters
  ]);
  const messageImprint = encodeSequence([algorithmId, encodeOctetString(dataHash)]);

  // Use the caller's nonce, or generate a random one (8 bytes)
  if (nonce !== undefined && nonce.length === 0) {
    throw new InvalidArgumentError('Timestamp nonce must not be empty', { argument: 'nonce' });
  }
  const nonceInteger = encodeInteger(nonce ?? generateNonce());

  // certReq: TRUE (request the TSA to include its certificate)
  const certReq = encodeBooleanTrue();

  return encodeSequence([version, messageImprint, nonceInteger, certReq]);
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
 * The token's CMS signature and the TSA certificate are not verified in
 * this release; `signingTime` is the TSTInfo genTime. Without
 * `expected` the token is parsed but not bound to any request.
 *
 * @param response  DER-encoded TimeStampResp.
 * @param expected  What the request sent: `dataHash` is compared with the
 *                  TSTInfo messageImprint hashedMessage, `hashAlgorithm`
 *                  with its hashAlgorithm OID, and `nonce` (INTEGER content
 *                  bytes) with the TSTInfo nonce; each only when supplied.
 * @returns         The parsed timestamp result.
 * @throws          {@link EnvironmentError} (reason `'network'`) if the TSA
 *                  reported an error status.
 * @throws          {@link MalformedInputError} (format `'der'`) if the bytes
 *                  break DER or hold no status or no TimeStampToken.
 * @throws          {@link TimestampVerificationError} if the TSTInfo cannot
 *                  be parsed, or its messageImprint or nonce differs from
 *                  `expected`.
 */
export function parseTimestampResponse(
  response: Uint8Array,
  expected?: {
    dataHash?: Uint8Array;
    hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
    nonce?: Uint8Array;
  },
): TimestampResult {
  const resp = parseDerTlv(response, 0);

  if (resp.children.length < 1) {
    throw new MalformedInputError('Invalid TimeStampResp: empty SEQUENCE', { format: 'der' });
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
    throw new EnvironmentError(errorMsg, { reason: 'network' });
  }

  // Extract the TimeStampToken (ContentInfo)
  if (resp.children.length < 2) {
    throw new MalformedInputError('TimeStampResp contains no TimeStampToken', { format: 'der' });
  }

  const tokenNode = resp.children[1]!;
  const tokenStart = tokenNode.offset;
  const timestampToken = response.subarray(tokenStart, tokenStart + tokenNode.totalLength);

  const tst = parseTstInfo(tokenNode);

  if (
    expected?.hashAlgorithm !== undefined &&
    tst.hashAlgorithmOid !== HASH_OID_MAP[expected.hashAlgorithm]
  ) {
    throw new TimestampVerificationError(
      'TSTInfo messageImprint does not match the requested hash',
    );
  }
  if (expected?.dataHash && !bytesEqual(expected.dataHash, tst.hashedMessage)) {
    throw new TimestampVerificationError(
      'TSTInfo messageImprint does not match the requested hash',
    );
  }
  if (
    expected?.nonce &&
    (!tst.nonce || !bytesEqual(stripLeadingZeros(expected.nonce), stripLeadingZeros(tst.nonce)))
  ) {
    throw new TimestampVerificationError('TSTInfo nonce does not match the request nonce');
  }

  return {
    timestampToken,
    signingTime: tst.genTime,
    hashedMessage: tst.hashedMessage,
    nonce: tst.nonce,
  };
}

/**
 * Read genTime, the messageImprint hash and the nonce from a
 * TimeStampToken's TSTInfo.
 *
 * The token is a ContentInfo containing SignedData, which in turn
 * contains the TSTInfo as the encapsulated content.
 *
 * @throws TimestampVerificationError if the TSTInfo is absent or malformed.
 */
function parseTstInfo(contentInfo: ReturnType<typeof parseDerTlv>): {
  genTime: Date;
  hashAlgorithmOid: string;
  hashedMessage: Uint8Array;
  nonce?: Uint8Array;
} {
  const fail = (reason: string, cause?: unknown): never => {
    throw new TimestampVerificationError(`TSTInfo cannot be parsed: ${reason}`, { cause });
  };

  try {
    // ContentInfo > [0] SignedData > encapContentInfo > [0] TSTInfo
    const signedData = contentInfo.children[1]?.children[0];
    for (const child of signedData?.children ?? []) {
      if (child.tag !== 0x30) continue;
      const oidNode = child.children[0];
      // OID for id-ct-TSTInfo: 1.2.840.113549.1.9.16.1.4
      if (oidNode?.tag !== 0x06 || decodeOidBytes(oidNode.data) !== '1.2.840.113549.1.9.16.1.4') {
        continue;
      }
      // [0] EXPLICIT OCTET STRING containing TSTInfo
      const eContent = child.children[1]?.children[0];
      if (!eContent) return fail('encapContentInfo has no eContent');
      const tstInfo = parseDerTlv(eContent.data, 0);

      // TSTInfo: version, policy, messageImprint, serialNumber, genTime,
      // accuracy?, ordering?, nonce?, ...
      const [, , imprint, , genTimeNode, ...rest] = tstInfo.children;
      if (!imprint || !genTimeNode) return fail('fewer than 5 fields');
      const hashedMessageNode = imprint.children[1];
      if (
        imprint.tag !== 0x30 ||
        imprint.children.length !== 2 ||
        imprint.children[0]?.tag !== 0x30 ||
        hashedMessageNode?.tag !== 0x04
      ) {
        return fail('messageImprint is not SEQUENCE { AlgorithmIdentifier, OCTET STRING }');
      }
      const hashAlgorithmNode = imprint.children[0]?.children[0];
      if (hashAlgorithmNode?.tag !== 0x06) {
        return fail('messageImprint hashAlgorithm has no OID');
      }
      const hashAlgorithmOid = decodeOidBytes(hashAlgorithmNode.data);
      if (genTimeNode.tag !== 0x18 && genTimeNode.tag !== 0x17) {
        return fail('genTime is not a GeneralizedTime or UTCTime');
      }
      const timeStr = new TextDecoder('ascii').decode(genTimeNode.data);
      const genTime =
        genTimeNode.tag === 0x18 ? parseGeneralizedTime(timeStr) : parseUtcTime(timeStr);
      if (Number.isNaN(genTime.getTime())) return fail('genTime is not a valid time');

      const nonceNode = rest.find((n) => n.tag === 0x02);
      return {
        genTime,
        hashAlgorithmOid,
        hashedMessage: hashedMessageNode.data,
        ...(nonceNode ? { nonce: nonceNode.data } : {}),
      };
    }
  } catch (err) {
    if (err instanceof TimestampVerificationError) throw err;
    return fail(err instanceof Error ? err.message : 'malformed DER', err);
  }
  return fail('no id-ct-TSTInfo encapsulated content found');
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
 * @returns              The timestamp result. Its messageImprint equals
 *                       `dataHash` and its nonce equals the nonce sent.
 *                       The token's CMS signature and the TSA certificate
 *                       are not verified in this release.
 * @throws               {@link EnvironmentError} (reason `'network'`) if
 *                       the HTTP request fails or the TSA returns an
 *                       error status.
 * @throws               {@link TimestampVerificationError} if the TSTInfo
 *                       cannot be parsed, or its messageImprint or nonce
 *                       differs from the request.
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
  const nonce = generateNonce();
  const tsReq = buildTimestampRequest(dataHash, hashAlgorithm, nonce);

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
    throw new EnvironmentError(
      `TSA request failed: HTTP ${response.status} ${response.statusText}`,
      { reason: 'network' },
    );
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType && !contentType.includes('timestamp-reply')) {
    // Some TSAs use different content types; only warn, don't fail
  }

  const respBytes = new Uint8Array(await response.arrayBuffer());

  // Parse the response and bind it to the request
  return parseTimestampResponse(respBytes, { dataHash, hashAlgorithm, nonce });
}

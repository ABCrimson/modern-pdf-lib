/**
 * Tests for the RFC 3161 timestamp request/response building and parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTimestampRequest,
  parseTimestampResponse,
} from '../../../src/signature/timestamp.js';
import {
  encodeSequence,
  encodeOID,
  encodeOctetString,
  encodeContextTag,
  encodeInteger,
  encodeLength,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal (mock) TimeStampResp for testing parsing.
 *
 * TimeStampResp ::= SEQUENCE {
 *   status PKIStatusInfo SEQUENCE { status INTEGER },
 *   timeStampToken ContentInfo SEQUENCE { ... }
 * }
 */
function buildMockTimestampResponse(signingTime: Date): Uint8Array {
  // PKIStatusInfo: status = 0 (granted)
  const statusInfo = encodeSequence([
    new Uint8Array([0x02, 0x01, 0x00]), // INTEGER 0
  ]);

  // Build a minimal ContentInfo (mock TimeStampToken)
  // ContentInfo { OID, [0] EXPLICIT SignedData }
  const tstInfoOid = encodeOID('1.2.840.113549.1.9.16.1.4');

  // Build a minimal TSTInfo with genTime
  const tstVersion = new Uint8Array([0x02, 0x01, 0x01]); // version 1
  const tstPolicy = encodeOID('1.2.3.4.5.6.7'); // dummy policy
  const msgImprintAlgo = encodeSequence([
    encodeOID('2.16.840.1.101.3.4.2.1'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const msgImprint = encodeSequence([
    msgImprintAlgo,
    encodeOctetString(new Uint8Array(32)), // dummy hash
  ]);
  const serialNum = new Uint8Array([0x02, 0x01, 0x01]); // serial 1

  // GeneralizedTime: YYYYMMDDHHmmSSZ
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const genTimeStr =
    `${pad(signingTime.getUTCFullYear(), 4)}${pad(signingTime.getUTCMonth() + 1)}` +
    `${pad(signingTime.getUTCDate())}${pad(signingTime.getUTCHours())}` +
    `${pad(signingTime.getUTCMinutes())}${pad(signingTime.getUTCSeconds())}Z`;
  const encoder = new TextEncoder();
  const genTimeBytes = encoder.encode(genTimeStr);
  const genTimeLen = encodeLength(genTimeBytes.length);
  const genTime = new Uint8Array(1 + genTimeLen.length + genTimeBytes.length);
  genTime[0] = 0x18; // GENERALIZED_TIME tag
  genTime.set(genTimeLen, 1);
  genTime.set(genTimeBytes, 1 + genTimeLen.length);

  const tstInfo = encodeSequence([
    tstVersion,
    tstPolicy,
    msgImprint,
    serialNum,
    genTime,
  ]);

  // Wrap TSTInfo as encapContentInfo
  const tstInfoOctet = encodeOctetString(tstInfo);
  const eContent = encodeContextTag(0, tstInfoOctet);
  const encapContentInfo = encodeSequence([tstInfoOid, eContent]);

  // Build a minimal SignedData
  const sdVersion = new Uint8Array([0x02, 0x01, 0x01]); // version 1
  const digestAlgos = new Uint8Array([0x31, 0x00]); // empty SET
  const signerInfos = new Uint8Array([0x31, 0x00]); // empty SET

  const signedData = encodeSequence([
    sdVersion,
    digestAlgos,
    encapContentInfo,
    signerInfos,
  ]);

  // ContentInfo wrapping SignedData
  const signedDataOid = encodeOID('1.2.840.113549.1.7.2');
  const contentWrapper = encodeContextTag(0, signedData);
  const contentInfo = encodeSequence([signedDataOid, contentWrapper]);

  // TimeStampResp
  return encodeSequence([statusInfo, contentInfo]);
}

/**
 * Build a TimeStampResp with an error status.
 */
function buildErrorTimestampResponse(status: number): Uint8Array {
  const statusInfo = encodeSequence([
    new Uint8Array([0x02, 0x01, status]),
  ]);
  return encodeSequence([statusInfo]);
}

// ---------------------------------------------------------------------------
// Tests: buildTimestampRequest
// ---------------------------------------------------------------------------

describe('buildTimestampRequest', () => {
  it('should build a valid DER-encoded TimeStampReq', () => {
    const hash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(hash);

    const req = buildTimestampRequest(hash, 'SHA-256');

    expect(req).toBeInstanceOf(Uint8Array);
    expect(req[0]).toBe(0x30); // SEQUENCE tag
    expect(req.length).toBeGreaterThan(50);
  });

  it('should include the hash in the request', () => {
    const hash = new Uint8Array(32);
    hash.fill(0xab);

    const req = buildTimestampRequest(hash, 'SHA-256');

    // The hash should appear as an OCTET STRING within the request
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const hashHex = 'ab'.repeat(32);
    expect(hex).toContain(hashHex);
  });

  it('should include the SHA-256 OID', () => {
    const hash = new Uint8Array(32);
    const req = buildTimestampRequest(hash, 'SHA-256');

    // SHA-256 OID: 2.16.840.1.101.3.4.2.1
    // Encoded: 60 86 48 01 65 03 04 02 01
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('608648016503040201');
  });

  it('should support SHA-384', () => {
    const hash = new Uint8Array(48);
    const req = buildTimestampRequest(hash, 'SHA-384');

    // SHA-384 OID: encoded as 60 86 48 01 65 03 04 02 02
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('608648016503040202');
  });

  it('should support SHA-512', () => {
    const hash = new Uint8Array(64);
    const req = buildTimestampRequest(hash, 'SHA-512');

    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // SHA-512 OID encoded: 60 86 48 01 65 03 04 02 03
    expect(hex).toContain('608648016503040203');
  });

  it('should throw for unsupported hash algorithm', () => {
    const hash = new Uint8Array(32);
    expect(() => buildTimestampRequest(hash, 'MD5')).toThrow('Unsupported');
  });

  it('should include version 1', () => {
    const hash = new Uint8Array(32);
    const req = buildTimestampRequest(hash, 'SHA-256');

    // After the SEQUENCE tag and length, version INTEGER 1 = 02 01 01
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // The version should be near the start
    expect(hex).toContain('020101');
  });

  it('should include certReq TRUE', () => {
    const hash = new Uint8Array(32);
    const req = buildTimestampRequest(hash, 'SHA-256');

    // BOOLEAN TRUE = 01 01 ff
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('0101ff');
  });
});

// ---------------------------------------------------------------------------
// Tests: parseTimestampResponse
// ---------------------------------------------------------------------------

describe('parseTimestampResponse', () => {
  it('should parse a successful timestamp response', () => {
    const signingTime = new Date(Date.UTC(2026, 1, 25, 12, 30, 0));
    const resp = buildMockTimestampResponse(signingTime);

    const result = parseTimestampResponse(resp);

    expect(result.timestampToken).toBeInstanceOf(Uint8Array);
    expect(result.timestampToken.length).toBeGreaterThan(0);
    expect(result.signingTime).toBeInstanceOf(Date);

    // The signing time should match (within reasonable tolerance)
    const timeDiff = Math.abs(result.signingTime.getTime() - signingTime.getTime());
    expect(timeDiff).toBeLessThan(1000); // within 1 second
  });

  it('should throw for error status', () => {
    const resp = buildErrorTimestampResponse(2); // rejection

    expect(() => parseTimestampResponse(resp)).toThrow('error status 2');
  });

  it('should throw for status 3 (waiting)', () => {
    const resp = buildErrorTimestampResponse(3);
    expect(() => parseTimestampResponse(resp)).toThrow('error status 3');
  });

  it('should accept status 1 (grantedWithMods)', () => {
    // Status 1 is grantedWithMods — should not throw
    const signingTime = new Date(Date.UTC(2026, 1, 25, 14, 0, 0));
    const resp = buildMockTimestampResponse(signingTime);

    // Patch the status byte to 1
    // Find the first INTEGER 0 in the response and change it to 1
    const idx = findByteSequence(resp, [0x02, 0x01, 0x00]);
    if (idx >= 0) {
      const patched = new Uint8Array(resp);
      patched[idx + 2] = 0x01;
      const result = parseTimestampResponse(patched);
      expect(result.timestampToken).toBeInstanceOf(Uint8Array);
    }
  });
});

// ---------------------------------------------------------------------------
// Helper: find byte sequence
// ---------------------------------------------------------------------------

function findByteSequence(data: Uint8Array, needle: number[]): number {
  outer:
  for (let i = 0; i <= data.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

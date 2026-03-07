/**
 * Tests for CRL (Certificate Revocation List) parsing and revocation checking.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCrl,
  isCertificateRevoked,
  extractCrlUrls,
} from '../../../src/signature/crl.js';
import {
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeContextTag,
  encodeLength,
  encodeUtf8String,
  encodeUTCTime,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encode a small non-negative integer.
 */
function encodeSmallInteger(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([0x02, 0x01, value]);
  }
  return new Uint8Array([0x02, 0x02, (value >> 8) & 0xff, value & 0xff]);
}

/**
 * Encode a BIT STRING.
 */
function encodeBitString(data: Uint8Array): Uint8Array {
  const len = encodeLength(data.length + 1);
  const result = new Uint8Array(1 + len.length + 1 + data.length);
  result[0] = 0x03;
  result.set(len, 1);
  result[1 + len.length] = 0x00;
  result.set(data, 1 + len.length + 1);
  return result;
}

/**
 * Build a Name with only CN.
 */
function buildName(commonName: string): Uint8Array {
  const cnOid = encodeOID('2.5.4.3');
  const cnValue = encodeUtf8String(commonName);
  const atv = encodeSequence([cnOid, cnValue]);
  const rdn = encodeSet([atv]);
  return encodeSequence([rdn]);
}

/**
 * Encode a context-specific implicit primitive tag.
 */
function encodeImplicitTag(tagNum: number, data: Uint8Array): Uint8Array {
  const tagByte = 0x80 | tagNum;
  const len = encodeLength(data.length);
  const result = new Uint8Array(1 + len.length + data.length);
  result[0] = tagByte;
  result.set(len, 1);
  result.set(data, 1 + len.length);
  return result;
}

/**
 * Build a mock DER-encoded CRL.
 *
 * CertificateList ::= SEQUENCE {
 *   tbsCertList TBSCertList,
 *   signatureAlgorithm AlgorithmIdentifier,
 *   signatureValue BIT STRING
 * }
 */
function buildMockCrl(options: {
  issuerName: string;
  thisUpdate: Date;
  nextUpdate?: Date;
  revokedCerts?: Array<{
    serial: Uint8Array;
    revocationDate: Date;
    reason?: number;
  }>;
  version?: number;
}): Uint8Array {
  const tbsChildren: Uint8Array[] = [];

  // version INTEGER OPTIONAL (v2 = 1)
  if (options.version !== undefined) {
    tbsChildren.push(encodeSmallInteger(options.version));
  }

  // signature AlgorithmIdentifier
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'), // sha256WithRSA
    new Uint8Array([0x05, 0x00]),
  ]);
  tbsChildren.push(sigAlgo);

  // issuer Name
  tbsChildren.push(buildName(options.issuerName));

  // thisUpdate Time
  tbsChildren.push(encodeUTCTime(options.thisUpdate));

  // nextUpdate Time OPTIONAL
  if (options.nextUpdate) {
    tbsChildren.push(encodeUTCTime(options.nextUpdate));
  }

  // revokedCertificates SEQUENCE OF OPTIONAL
  if (options.revokedCerts && options.revokedCerts.length > 0) {
    const revokedEntries = options.revokedCerts.map((rc) => {
      const entryChildren: Uint8Array[] = [
        encodeInteger(rc.serial),
        encodeUTCTime(rc.revocationDate),
      ];

      // CRL entry extensions (optional reason)
      if (rc.reason !== undefined) {
        const reasonOid = encodeOID('2.5.29.21');
        // CRLReason is an ENUMERATED value wrapped in OCTET STRING
        const reasonEnum = new Uint8Array([0x0a, 0x01, rc.reason]);
        const reasonExt = encodeSequence([
          reasonOid,
          encodeOctetString(reasonEnum),
        ]);
        const entryExts = encodeSequence([reasonExt]);
        entryChildren.push(entryExts);
      }

      return encodeSequence(entryChildren);
    });

    tbsChildren.push(encodeSequence(revokedEntries));
  }

  const tbsCertList = encodeSequence(tbsChildren);

  // signatureAlgorithm
  const outerSigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  // signatureValue (dummy)
  const dummySig = encodeBitString(new Uint8Array(256));

  return encodeSequence([tbsCertList, outerSigAlgo, dummySig]);
}

/**
 * Generate a test certificate with given serial number and optional
 * CRL Distribution Points extension.
 */
async function generateTestCertWithSerial(
  serial: Uint8Array,
  crlUrls?: string[],
): Promise<Uint8Array> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialNumber = encodeInteger(serial);
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName('Test Issuer');
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([encodeUTCTime(now), encodeUTCTime(later)]);
  const subject = buildName('Test Subject');

  const tbsChildren: Uint8Array[] = [
    version, serialNumber, sigAlgo, issuer, validity, subject, spkiDer,
  ];

  // Add CRL Distribution Points extension if provided
  if (crlUrls && crlUrls.length > 0) {
    const encoder = new TextEncoder();
    const distributionPoints = crlUrls.map((url) => {
      // GeneralName [6] uniformResourceIdentifier
      const urlBytes = encoder.encode(url);
      const generalName = encodeImplicitTag(6, urlBytes);
      // fullName [0]
      const fullName = encodeContextTag(0, generalName);
      // distributionPoint [0]
      const dpName = encodeContextTag(0, fullName);
      // DistributionPoint SEQUENCE
      return encodeSequence([dpName]);
    });

    const crlDpSeq = encodeSequence(distributionPoints);
    const crlDpOid = encodeOID('2.5.29.31');
    const crlDpExt = encodeSequence([crlDpOid, encodeOctetString(crlDpSeq)]);
    const extSeq = encodeSequence([crlDpExt]);
    const extensionsWrapper = encodeContextTag(3, extSeq);
    tbsChildren.push(extensionsWrapper);
  }

  const tbsCert = encodeSequence(tbsChildren);

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      keyPair.privateKey,
      tbsCert.buffer.slice(
        tbsCert.byteOffset,
        tbsCert.byteOffset + tbsCert.byteLength,
      ) as ArrayBuffer,
    ),
  );

  return encodeSequence([tbsCert, sigAlgo, encodeBitString(signature)]);
}

// ---------------------------------------------------------------------------
// Tests: parseCrl
// ---------------------------------------------------------------------------

describe('parseCrl', () => {
  it('should parse a CRL with no revoked certificates', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
    });

    const parsed = parseCrl(crl);

    expect(parsed.thisUpdate).toBeInstanceOf(Date);
    expect(parsed.entries).toHaveLength(0);
    expect(parsed.issuer).toBeTruthy();
  });

  it('should parse a CRL with revoked certificates', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate1 = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));
    const revDate2 = new Date(Date.UTC(2026, 1, 20, 14, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x0a, 0x0b, 0x0c]), revocationDate: revDate1 },
        { serial: new Uint8Array([0x0d, 0x0e, 0x0f]), revocationDate: revDate2 },
      ],
    });

    const parsed = parseCrl(crl);

    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]!.serialNumber).toContain('0a0b0c');
    expect(parsed.entries[1]!.serialNumber).toContain('0d0e0f');
  });

  it('should extract nextUpdate when present', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const nextUpdate = new Date(Date.UTC(2026, 3, 1, 12, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      nextUpdate,
      version: 1,
    });

    const parsed = parseCrl(crl);

    expect(parsed.nextUpdate).toBeInstanceOf(Date);
    const diff = Math.abs(parsed.nextUpdate!.getTime() - nextUpdate.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('should handle missing nextUpdate', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
    });

    const parsed = parseCrl(crl);
    expect(parsed.nextUpdate).toBeUndefined();
  });

  it('should extract CRL reason from entry extensions', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x01]), revocationDate: revDate, reason: 1 },
      ],
    });

    const parsed = parseCrl(crl);

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]!.reason).toBe('keyCompromise');
  });

  it('should parse cessationOfOperation reason', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x01]), revocationDate: revDate, reason: 5 },
      ],
    });

    const parsed = parseCrl(crl);
    expect(parsed.entries[0]!.reason).toBe('cessationOfOperation');
  });

  it('should handle entries without reason extensions', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x42]), revocationDate: revDate },
      ],
    });

    const parsed = parseCrl(crl);
    expect(parsed.entries[0]!.reason).toBeUndefined();
  });

  it('should parse a CRL without version field', () => {
    // A v1 CRL omits the version field
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      // No version field
    });

    const parsed = parseCrl(crl);
    expect(parsed.entries).toHaveLength(0);
    expect(parsed.thisUpdate).toBeInstanceOf(Date);
  });

  it('should parse large serial numbers', () => {
    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));
    const bigSerial = new Uint8Array([0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: bigSerial, revocationDate: revDate },
      ],
    });

    const parsed = parseCrl(crl);
    expect(parsed.entries[0]!.serialNumber).toBe('7fffffffffffffff');
  });
});

// ---------------------------------------------------------------------------
// Tests: isCertificateRevoked
// ---------------------------------------------------------------------------

describe('isCertificateRevoked', () => {
  it('should detect a revoked certificate', async () => {
    const serial = new Uint8Array([0x0a, 0x0b, 0x0c]);
    const cert = await generateTestCertWithSerial(serial);

    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x0a, 0x0b, 0x0c]), revocationDate: revDate },
      ],
    });

    const crlData = parseCrl(crl);
    expect(isCertificateRevoked(cert, crlData)).toBe(true);
  });

  it('should return false for a non-revoked certificate', async () => {
    const serial = new Uint8Array([0x42, 0x43]);
    const cert = await generateTestCertWithSerial(serial);

    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x0a, 0x0b, 0x0c]), revocationDate: revDate },
      ],
    });

    const crlData = parseCrl(crl);
    expect(isCertificateRevoked(cert, crlData)).toBe(false);
  });

  it('should return false when CRL has no entries', async () => {
    const serial = new Uint8Array([0x01]);
    const cert = await generateTestCertWithSerial(serial);

    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
    });

    const crlData = parseCrl(crl);
    expect(isCertificateRevoked(cert, crlData)).toBe(false);
  });

  it('should match among multiple revoked entries', async () => {
    const serial = new Uint8Array([0x03]);
    const cert = await generateTestCertWithSerial(serial);

    const thisUpdate = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revDate = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const crl = buildMockCrl({
      issuerName: 'Test CA',
      thisUpdate,
      version: 1,
      revokedCerts: [
        { serial: new Uint8Array([0x01]), revocationDate: revDate },
        { serial: new Uint8Array([0x02]), revocationDate: revDate },
        { serial: new Uint8Array([0x03]), revocationDate: revDate },
        { serial: new Uint8Array([0x04]), revocationDate: revDate },
      ],
    });

    const crlData = parseCrl(crl);
    expect(isCertificateRevoked(cert, crlData)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: extractCrlUrls
// ---------------------------------------------------------------------------

describe('extractCrlUrls', () => {
  it('should extract CRL URLs from certificate', async () => {
    const cert = await generateTestCertWithSerial(
      new Uint8Array([0x01]),
      ['http://crl.example.com/ca.crl'],
    );

    const urls = extractCrlUrls(cert);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('http://crl.example.com/ca.crl');
  });

  it('should extract multiple CRL URLs', async () => {
    const cert = await generateTestCertWithSerial(
      new Uint8Array([0x01]),
      [
        'http://crl1.example.com/ca.crl',
        'http://crl2.example.com/ca.crl',
      ],
    );

    const urls = extractCrlUrls(cert);
    expect(urls).toHaveLength(2);
    expect(urls).toContain('http://crl1.example.com/ca.crl');
    expect(urls).toContain('http://crl2.example.com/ca.crl');
  });

  it('should return empty array when no CRL DP extension exists', async () => {
    const cert = await generateTestCertWithSerial(
      new Uint8Array([0x01]),
    );

    const urls = extractCrlUrls(cert);
    expect(urls).toHaveLength(0);
  });

  it('should handle HTTPS CRL URLs', async () => {
    const cert = await generateTestCertWithSerial(
      new Uint8Array([0x01]),
      ['https://crl.secure.example.com/revocations.crl'],
    );

    const urls = extractCrlUrls(cert);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('https://crl.secure.example.com/revocations.crl');
  });
});

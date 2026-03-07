/**
 * Tests for OCSP request building, response parsing, and certificate
 * status checking (RFC 6960).
 */

import { describe, it, expect } from 'vitest';
import {
  buildOcspRequest,
  parseOcspResponse,
  extractOcspUrl,
} from '../../../src/signature/ocsp.js';
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
  parseDerTlv,
  decodeOidBytes,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers: build a self-signed test certificate
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
 * Encode a BOOLEAN value.
 */
function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, value ? 0xff : 0x00]);
}

/**
 * Build a Name (SEQUENCE of SET of AttributeTypeAndValue) with only CN.
 */
function buildName(commonName: string): Uint8Array {
  const cnOid = encodeOID('2.5.4.3');
  const cnValue = encodeUtf8String(commonName);
  const atv = encodeSequence([cnOid, cnValue]);
  const rdn = encodeSet([atv]);
  return encodeSequence([rdn]);
}

/**
 * Build an IA5String tagged value (for GeneralName URI).
 */
function encodeIA5String(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const len = encodeLength(bytes.length);
  const result = new Uint8Array(1 + len.length + bytes.length);
  result[0] = 0x16; // IA5String tag
  result.set(len, 1);
  result.set(bytes, 1 + len.length);
  return result;
}

/**
 * Encode a context-specific implicit primitive tag with given tag number.
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
 * Generate a self-signed test certificate with an AIA extension
 * containing an OCSP responder URL.
 */
async function generateTestCertWithOcsp(ocspUrl?: string): Promise<{
  certificate: Uint8Array;
  privateKey: Uint8Array;
  publicKey: CryptoKey;
  keyPair: CryptoKeyPair;
}> {
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

  const privateKeyDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );

  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  // Build TBSCertificate
  const version = encodeContextTag(0, encodeSmallInteger(2));

  const serialBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const serialNumber = encodeInteger(serialBytes);

  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  const issuer = buildName('Test CA');

  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);

  const subject = buildName('Test Subject');

  // Build extensions
  const extensions: Uint8Array[] = [];

  // Add AIA extension with OCSP URL if provided
  if (ocspUrl) {
    const ocspOid = encodeOID('1.3.6.1.5.5.7.48.1');
    const encoder = new TextEncoder();
    const urlBytes = encoder.encode(ocspUrl);
    // GeneralName [6] uniformResourceIdentifier (implicit tag)
    const generalName = encodeImplicitTag(6, urlBytes);
    const accessDesc = encodeSequence([ocspOid, generalName]);
    const aiaValue = encodeSequence([accessDesc]);
    const aiaOid = encodeOID('1.3.6.1.5.5.7.1.1');
    const aiaExtension = encodeSequence([aiaOid, encodeOctetString(aiaValue)]);
    extensions.push(aiaExtension);
  }

  // Build the extensions wrapper
  let extensionsWrapper: Uint8Array | undefined;
  if (extensions.length > 0) {
    const extSeq = encodeSequence(extensions);
    extensionsWrapper = encodeContextTag(3, extSeq);
  }

  // Build TBSCertificate
  const tbsChildren = [version, serialNumber, sigAlgo, issuer, validity, subject, spkiDer];
  if (extensionsWrapper) {
    tbsChildren.push(extensionsWrapper);
  }
  const tbsCert = encodeSequence(tbsChildren);

  // Sign the TBSCertificate
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

  const certificate = encodeSequence([
    tbsCert,
    sigAlgo,
    encodeBitString(signature),
  ]);

  return { certificate, privateKey: privateKeyDer, publicKey: keyPair.publicKey, keyPair };
}

/**
 * Generate a certificate signed by an issuer (non-self-signed).
 */
async function generateIssuedCert(
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
  subjectName: string,
  serialBytes: Uint8Array,
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

  // Extract issuer's subject as the new cert's issuer
  const issuerRoot = parseDerTlv(issuerCert, 0);
  const issuerTbs = issuerRoot.children[0]!;
  let iIdx = 0;
  if (issuerTbs.children[0]!.tag === 0xa0) iIdx = 1;
  const issuerSubjectNode = issuerTbs.children[iIdx + 4]!;
  const issuerSubjectStart = issuerSubjectNode.offset + (issuerTbs.data.byteOffset - issuerCert.byteOffset);
  const issuerName = issuerCert.subarray(issuerSubjectStart, issuerSubjectStart + issuerSubjectNode.totalLength);

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialNumber = encodeInteger(serialBytes);
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);

  const subject = buildName(subjectName);

  const tbsCert = encodeSequence([
    version, serialNumber, sigAlgo,
    issuerName, validity, subject, spkiDer,
  ]);

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      issuerKeyPair.privateKey,
      tbsCert.buffer.slice(
        tbsCert.byteOffset,
        tbsCert.byteOffset + tbsCert.byteLength,
      ) as ArrayBuffer,
    ),
  );

  return encodeSequence([
    tbsCert,
    sigAlgo,
    encodeBitString(signature),
  ]);
}

// ---------------------------------------------------------------------------
// Helpers: build mock OCSP response
// ---------------------------------------------------------------------------

/**
 * Encode an ENUMERATED value.
 */
function encodeEnumerated(value: number): Uint8Array {
  return new Uint8Array([0x0a, 0x01, value]);
}

/**
 * Encode a GeneralizedTime.
 */
function encodeGeneralizedTime(date: Date): Uint8Array {
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const str =
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const len = encodeLength(bytes.length);
  const result = new Uint8Array(1 + len.length + bytes.length);
  result[0] = 0x18;
  result.set(len, 1);
  result.set(bytes, 1 + len.length);
  return result;
}

/**
 * Build a mock BasicOCSPResponse.
 */
function buildMockBasicOcspResponse(options: {
  status: 'good' | 'revoked' | 'unknown';
  serialNumber: Uint8Array;
  thisUpdate: Date;
  nextUpdate?: Date;
  producedAt: Date;
  revokedAt?: Date;
}): Uint8Array {
  // CertID
  const hashAlgo = encodeSequence([
    encodeOID('1.3.14.3.2.26'), // SHA-1
    new Uint8Array([0x05, 0x00]),
  ]);
  const certId = encodeSequence([
    hashAlgo,
    encodeOctetString(new Uint8Array(20)), // dummy issuerNameHash
    encodeOctetString(new Uint8Array(20)), // dummy issuerKeyHash
    encodeInteger(options.serialNumber),
  ]);

  // CertStatus
  let certStatus: Uint8Array;
  if (options.status === 'good') {
    // [0] IMPLICIT NULL
    certStatus = new Uint8Array([0x80, 0x00]);
  } else if (options.status === 'revoked') {
    // [1] IMPLICIT RevokedInfo SEQUENCE { revocationTime }
    const revokedTime = encodeGeneralizedTime(options.revokedAt ?? new Date());
    certStatus = encodeContextTag(1, revokedTime);
  } else {
    // [2] IMPLICIT NULL
    certStatus = new Uint8Array([0x82, 0x00]);
  }

  // SingleResponse
  const singleRespChildren: Uint8Array[] = [
    certId,
    certStatus,
    encodeGeneralizedTime(options.thisUpdate),
  ];
  if (options.nextUpdate) {
    singleRespChildren.push(
      encodeContextTag(0, encodeGeneralizedTime(options.nextUpdate)),
    );
  }
  const singleResponse = encodeSequence(singleRespChildren);

  // ResponseData
  // responderID: byKey [2]
  const responderKeyHash = encodeOctetString(new Uint8Array(20));
  const responderId = encodeContextTag(2, responderKeyHash);

  const responseData = encodeSequence([
    responderId,
    encodeGeneralizedTime(options.producedAt),
    encodeSequence([singleResponse]),
  ]);

  // BasicOCSPResponse (without real signature)
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const dummySig = encodeBitString(new Uint8Array(256));

  const basicResp = encodeSequence([
    responseData,
    sigAlgo,
    dummySig,
  ]);

  return basicResp;
}

/**
 * Build a mock OCSPResponse (the outer wrapper).
 */
function buildMockOcspResponse(
  responseStatus: number,
  basicResp?: Uint8Array,
): Uint8Array {
  const statusEnum = encodeEnumerated(responseStatus);

  if (!basicResp || responseStatus !== 0) {
    return encodeSequence([statusEnum]);
  }

  // ResponseBytes
  const responseBytes = encodeSequence([
    encodeOID('1.3.6.1.5.5.7.48.1.1'), // id-pkix-ocsp-basic
    encodeOctetString(basicResp),
  ]);

  return encodeSequence([
    statusEnum,
    encodeContextTag(0, responseBytes),
  ]);
}

// ---------------------------------------------------------------------------
// Tests: buildOcspRequest
// ---------------------------------------------------------------------------

describe('buildOcspRequest', () => {
  it('should build a valid DER-encoded OCSP request', async () => {
    const issuer = await generateTestCertWithOcsp();
    const cert = await generateIssuedCert(
      issuer.certificate,
      issuer.keyPair,
      'Test End Entity',
      new Uint8Array([0x0a, 0x0b, 0x0c]),
    );

    const req = await buildOcspRequest(cert, issuer.certificate);

    expect(req).toBeInstanceOf(Uint8Array);
    expect(req[0]).toBe(0x30); // SEQUENCE
    expect(req.length).toBeGreaterThan(50);
  });

  it('should include SHA-1 hash algorithm OID in the request', async () => {
    const issuer = await generateTestCertWithOcsp();
    const cert = await generateIssuedCert(
      issuer.certificate,
      issuer.keyPair,
      'Test Entity',
      new Uint8Array([0x42]),
    );

    const req = await buildOcspRequest(cert, issuer.certificate);

    // SHA-1 OID: 1.3.14.3.2.26 = 06 05 2b 0e 03 02 1a
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('2b0e03021a');
  });

  it('should include the certificate serial number', async () => {
    const issuer = await generateTestCertWithOcsp();
    const serial = new Uint8Array([0x42, 0x43, 0x44]);
    const cert = await generateIssuedCert(
      issuer.certificate,
      issuer.keyPair,
      'Test Entity',
      serial,
    );

    const req = await buildOcspRequest(cert, issuer.certificate);

    // The serial should be in the request somewhere (as INTEGER)
    const hex = Array.from(req)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('424344');
  });

  it('should produce different requests for different certificates', async () => {
    const issuer = await generateTestCertWithOcsp();

    const cert1 = await generateIssuedCert(
      issuer.certificate,
      issuer.keyPair,
      'Entity 1',
      new Uint8Array([0x01]),
    );
    const cert2 = await generateIssuedCert(
      issuer.certificate,
      issuer.keyPair,
      'Entity 2',
      new Uint8Array([0x02]),
    );

    const req1 = await buildOcspRequest(cert1, issuer.certificate);
    const req2 = await buildOcspRequest(cert2, issuer.certificate);

    const hex1 = new Uint8Array(req1).toHex();
    const hex2 = new Uint8Array(req2).toHex();
    expect(hex1).not.toBe(hex2);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseOcspResponse
// ---------------------------------------------------------------------------

describe('parseOcspResponse', () => {
  it('should parse a successful "good" OCSP response', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const nextUpdate = new Date(Date.UTC(2026, 2, 8, 12, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: new Uint8Array([0x01, 0x02, 0x03]),
      thisUpdate: now,
      nextUpdate,
      producedAt: now,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responseStatus).toBe(0);
    expect(parsed.responses).toHaveLength(1);
    expect(parsed.responses[0]!.status).toBe('good');
    expect(parsed.responses[0]!.serialNumber).toContain('010203');
  });

  it('should parse a "revoked" OCSP response', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const revokedAt = new Date(Date.UTC(2026, 1, 15, 10, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'revoked',
      serialNumber: new Uint8Array([0x0a, 0x0b]),
      thisUpdate: now,
      producedAt: now,
      revokedAt,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responses[0]!.status).toBe('revoked');
    expect(parsed.responses[0]!.revokedAt).toBeInstanceOf(Date);
  });

  it('should parse an "unknown" OCSP response', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'unknown',
      serialNumber: new Uint8Array([0xff]),
      thisUpdate: now,
      producedAt: now,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responses[0]!.status).toBe('unknown');
  });

  it('should throw for malformedRequest status', () => {
    const resp = buildMockOcspResponse(1);
    expect(() => parseOcspResponse(resp)).toThrow('malformedRequest');
  });

  it('should throw for internalError status', () => {
    const resp = buildMockOcspResponse(2);
    expect(() => parseOcspResponse(resp)).toThrow('internalError');
  });

  it('should throw for tryLater status', () => {
    const resp = buildMockOcspResponse(3);
    expect(() => parseOcspResponse(resp)).toThrow('tryLater');
  });

  it('should throw for unauthorized status', () => {
    const resp = buildMockOcspResponse(6);
    expect(() => parseOcspResponse(resp)).toThrow('unauthorized');
  });

  it('should extract producedAt date', () => {
    const producedAt = new Date(Date.UTC(2026, 2, 5, 14, 30, 0));
    const basicResp = buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: new Uint8Array([0x01]),
      thisUpdate: producedAt,
      producedAt,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    const timeDiff = Math.abs(parsed.producedAt.getTime() - producedAt.getTime());
    expect(timeDiff).toBeLessThan(1000);
  });

  it('should extract nextUpdate when present', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));
    const nextUpdate = new Date(Date.UTC(2026, 2, 15, 12, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: new Uint8Array([0x01]),
      thisUpdate: now,
      nextUpdate,
      producedAt: now,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responses[0]!.nextUpdate).toBeInstanceOf(Date);
    const diff = Math.abs(parsed.responses[0]!.nextUpdate!.getTime() - nextUpdate.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('should handle missing nextUpdate', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: new Uint8Array([0x01]),
      thisUpdate: now,
      producedAt: now,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responses[0]!.nextUpdate).toBeUndefined();
  });

  it('should extract responder ID', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

    const basicResp = buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: new Uint8Array([0x01]),
      thisUpdate: now,
      producedAt: now,
    });

    const resp = buildMockOcspResponse(0, basicResp);
    const parsed = parseOcspResponse(resp);

    expect(parsed.responderId).toBeTruthy();
    expect(parsed.responderId.startsWith('keyHash:')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: extractOcspUrl
// ---------------------------------------------------------------------------

describe('extractOcspUrl', () => {
  it('should extract OCSP URL from certificate AIA extension', async () => {
    const { certificate } = await generateTestCertWithOcsp(
      'http://ocsp.example.com',
    );

    const url = extractOcspUrl(certificate);
    expect(url).toBe('http://ocsp.example.com');
  });

  it('should return null when no AIA extension exists', async () => {
    const { certificate } = await generateTestCertWithOcsp();
    const url = extractOcspUrl(certificate);
    expect(url).toBeNull();
  });

  it('should extract HTTPS OCSP URL', async () => {
    const { certificate } = await generateTestCertWithOcsp(
      'https://ocsp.secure.example.com/check',
    );

    const url = extractOcspUrl(certificate);
    expect(url).toBe('https://ocsp.secure.example.com/check');
  });

  it('should handle certificate with AIA but no OCSP entry', async () => {
    // Build a cert with an AIA extension containing only caIssuers, not OCSP
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

    // caIssuers OID: 1.3.6.1.5.5.7.48.2 (not OCSP)
    const caIssuersOid = encodeOID('1.3.6.1.5.5.7.48.2');
    const encoder = new TextEncoder();
    const urlBytes = encoder.encode('http://ca.example.com/cert');
    const generalName = encodeImplicitTag(6, urlBytes);
    const accessDesc = encodeSequence([caIssuersOid, generalName]);
    const aiaValue = encodeSequence([accessDesc]);
    const aiaOid = encodeOID('1.3.6.1.5.5.7.1.1');
    const aiaExtension = encodeSequence([aiaOid, encodeOctetString(aiaValue)]);
    const extSeq = encodeSequence([aiaExtension]);
    const extensionsWrapper = encodeContextTag(3, extSeq);

    const version = encodeContextTag(0, encodeSmallInteger(2));
    const serialNumber = encodeInteger(new Uint8Array([0x01]));
    const sigAlgo = encodeSequence([
      encodeOID('1.2.840.113549.1.1.11'),
      new Uint8Array([0x05, 0x00]),
    ]);
    const now = new Date();
    const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const validity = encodeSequence([encodeUTCTime(now), encodeUTCTime(later)]);

    const tbsCert = encodeSequence([
      version, serialNumber, sigAlgo,
      buildName('Issuer'), validity, buildName('Subject'),
      spkiDer, extensionsWrapper,
    ]);

    const signature = new Uint8Array(
      await globalThis.crypto.subtle.sign(
        { name: 'RSASSA-PKCS1-v1_5' },
        keyPair.privateKey,
        tbsCert.buffer.slice(tbsCert.byteOffset, tbsCert.byteOffset + tbsCert.byteLength) as ArrayBuffer,
      ),
    );

    const certificate = encodeSequence([tbsCert, sigAlgo, encodeBitString(signature)]);

    const url = extractOcspUrl(certificate);
    expect(url).toBeNull();
  });
});

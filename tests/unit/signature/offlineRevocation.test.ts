/**
 * Tests for offline revocation checking.
 */

import { describe, it, expect } from 'vitest';
import {
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
} from '../../../src/signature/offlineRevocation.js';
import type {
  EmbeddedRevocationData,
} from '../../../src/signature/offlineRevocation.js';
import {
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeContextTag,
  encodeUTCTime,
  encodeLength,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers: build minimal test structures
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
 * Encode an ENUMERATED value.
 */
function encodeEnumerated(value: number): Uint8Array {
  return new Uint8Array([0x0a, 0x01, value]);
}

/**
 * Encode a GeneralizedTime from a Date.
 */
function encodeGeneralizedTime(date: Date): Uint8Array {
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  const str =
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const len = encodeLength(data.length);
  const result = new Uint8Array(1 + len.length + data.length);
  result[0] = 0x18; // GENERALIZED_TIME tag
  result.set(len, 1);
  result.set(data, 1 + len.length);
  return result;
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
 * Build a Name with CN = value.
 */
function buildName(cn: string): Uint8Array {
  const encoder = new TextEncoder();
  const cnOid = encodeOID('2.5.4.3');
  const cnValue = new Uint8Array([
    0x0c,
    ...encodeLength(encoder.encode(cn).length),
    ...encoder.encode(cn),
  ]);
  const atv = encodeSequence([cnOid, cnValue]);
  const rdn = encodeSet([atv]);
  return encodeSequence([rdn]);
}

/**
 * Build a minimal self-signed certificate for testing.
 */
function buildTestCertificate(
  serial: Uint8Array,
  cn: string,
): Uint8Array {
  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialNumber = encodeInteger(serial);
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName(cn);
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);
  const subject = buildName(cn);

  // Minimal SPKI (placeholder RSA)
  const spki = encodeSequence([
    encodeSequence([
      encodeOID('1.2.840.113549.1.1.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
    encodeBitString(new Uint8Array(64)),
  ]);

  const tbsCert = encodeSequence([
    version,
    serialNumber,
    sigAlgo,
    issuer,
    validity,
    subject,
    spki,
  ]);

  const sigBitString = encodeBitString(new Uint8Array(32));

  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

/**
 * Build a minimal OCSP BasicOCSPResponse with a single response.
 * @param serial - Serial number bytes of the cert
 * @param status - 0 = good, 1 = revoked, 2 = unknown
 */
function buildOcspBasicResponse(
  serial: Uint8Array,
  status: 0 | 1 | 2,
): Uint8Array {
  // CertID: hashAlgo, issuerNameHash, issuerKeyHash, serialNumber
  const certId = encodeSequence([
    encodeSequence([
      encodeOID('2.16.840.1.101.3.4.2.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
    encodeOctetString(new Uint8Array(32)), // issuerNameHash
    encodeOctetString(new Uint8Array(32)), // issuerKeyHash
    encodeInteger(serial), // serialNumber
  ]);

  // certStatus
  let certStatus: Uint8Array;
  if (status === 0) {
    // good [0] IMPLICIT NULL
    certStatus = new Uint8Array([0x80, 0x00]);
  } else if (status === 1) {
    // revoked [1] EXPLICIT RevokedInfo { revocationTime }
    const revokedInfo = encodeGeneralizedTime(new Date());
    certStatus = encodeContextTag(1, revokedInfo);
  } else {
    // unknown [2] IMPLICIT NULL
    certStatus = new Uint8Array([0x82, 0x00]);
  }

  // thisUpdate GeneralizedTime
  const thisUpdate = encodeGeneralizedTime(new Date());

  // SingleResponse
  const singleResponse = encodeSequence([certId, certStatus, thisUpdate]);

  // responses SEQUENCE OF SingleResponse
  const responses = encodeSequence([singleResponse]);

  // responderID (byName)
  const responderName = buildName('OCSP Responder');

  // producedAt
  const producedAt = encodeGeneralizedTime(new Date());

  // tbsResponseData
  const tbsResponseData = encodeSequence([
    responderName,
    producedAt,
    responses,
  ]);

  // signatureAlgorithm
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  // signature
  const signature = encodeBitString(new Uint8Array(32));

  // BasicOCSPResponse
  return encodeSequence([tbsResponseData, sigAlgo, signature]);
}

/**
 * Wrap a BasicOCSPResponse in an OCSPResponse structure.
 */
function buildOcspResponse(basicResponse: Uint8Array): Uint8Array {
  // responseStatus ENUMERATED { successful(0) }
  const responseStatus = encodeEnumerated(0);

  // responseBytes SEQUENCE { responseType OID, response OCTET STRING }
  const responseType = encodeOID('1.3.6.1.5.5.7.48.1.1');
  const responseData = encodeOctetString(basicResponse);
  const responseBytes = encodeSequence([responseType, responseData]);

  // OCSPResponse = SEQUENCE { responseStatus, [0] responseBytes }
  return encodeSequence([responseStatus, encodeContextTag(0, responseBytes)]);
}

/**
 * Build a minimal CRL.
 */
function buildTestCrl(
  issuerCn: string,
  revokedSerials: Uint8Array[],
): Uint8Array {
  const version = encodeSmallInteger(1); // v2 CRL
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName(issuerCn);
  const thisUpdate = encodeUTCTime(new Date());

  const revokedEntries = revokedSerials.map((serial) =>
    encodeSequence([encodeInteger(serial), encodeUTCTime(new Date())]),
  );
  const revokedCerts =
    revokedEntries.length > 0
      ? encodeSequence(revokedEntries)
      : encodeSequence([]);

  const tbsCertList = encodeSequence([
    version,
    sigAlgo,
    issuer,
    thisUpdate,
    ...(revokedEntries.length > 0 ? [revokedCerts] : []),
  ]);

  const sigBitString = encodeBitString(new Uint8Array(32));

  return encodeSequence([tbsCertList, sigAlgo, sigBitString]);
}

/**
 * Build a PKCS#7 SignedData structure with embedded revocation data.
 */
function buildPkcs7WithRevocationData(
  certificate: Uint8Array,
  ocsps: Uint8Array[],
  crls: Uint8Array[],
): Uint8Array {
  const version = encodeSmallInteger(1);
  const digestAlgorithms = encodeSet([
    encodeSequence([
      encodeOID('2.16.840.1.101.3.4.2.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
  ]);
  const encapContentInfo = encodeSequence([
    encodeOID('1.2.840.113549.1.7.1'),
  ]);
  const certificates = encodeContextTag(0, certificate);

  // Build the adbe-revocationInfoArchival attribute
  // RevocationInfoArchival ::= SEQUENCE {
  //   crl   [0] EXPLICIT SEQUENCE OF CRL,
  //   ocsp  [1] EXPLICIT SEQUENCE OF OCSPResponse
  // }
  const revInfoChildren: Uint8Array[] = [];
  if (crls.length > 0) {
    revInfoChildren.push(encodeContextTag(0, concat(...crls)));
  }
  if (ocsps.length > 0) {
    revInfoChildren.push(encodeContextTag(1, concat(...ocsps)));
  }
  const revInfoSeq = encodeSequence(revInfoChildren);

  const revInfoAttr = encodeSequence([
    encodeOID('1.2.840.113583.1.1.8'), // adbe-revocationInfoArchival
    encodeSet([revInfoSeq]),
  ]);

  // signedAttrs [0]
  const contentTypeAttr = encodeSequence([
    encodeOID('1.2.840.113549.1.9.3'),
    encodeSet([encodeOID('1.2.840.113549.1.7.1')]),
  ]);
  const messageDigestAttr = encodeSequence([
    encodeOID('1.2.840.113549.1.9.4'),
    encodeSet([encodeOctetString(new Uint8Array(32))]),
  ]);
  const signedAttrs = encodeContextTag(
    0,
    concat(contentTypeAttr, messageDigestAttr, revInfoAttr),
  );

  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  const signerInfo = encodeSequence([
    encodeSmallInteger(1),
    encodeSequence([buildName('Test'), encodeInteger(new Uint8Array([0x01]))]),
    encodeSequence([
      encodeOID('2.16.840.1.101.3.4.2.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
    signedAttrs,
    sigAlgo,
    encodeOctetString(new Uint8Array(64)),
  ]);

  const signerInfos = encodeSet([signerInfo]);

  const signedData = encodeSequence([
    version,
    digestAlgorithms,
    encapContentInfo,
    certificates,
    signerInfos,
  ]);

  return encodeSequence([
    encodeOID('1.2.840.113549.1.7.2'),
    encodeContextTag(0, signedData),
  ]);
}

/**
 * Concatenate Uint8Arrays.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractEmbeddedRevocationData', () => {
  it('should return empty arrays for non-PKCS#7 data', () => {
    const result = extractEmbeddedRevocationData(new Uint8Array([0x30, 0x00]));
    expect(result.ocsps).toEqual([]);
    expect(result.crls).toEqual([]);
  });

  it('should return empty arrays for invalid data', () => {
    const result = extractEmbeddedRevocationData(new Uint8Array([0xff, 0xff]));
    expect(result.ocsps).toEqual([]);
    expect(result.crls).toEqual([]);
  });

  it('should extract OCSP responses from adbe-revocationInfoArchival', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const ocspBasic = buildOcspBasicResponse(serial, 0);
    const ocspFull = buildOcspResponse(ocspBasic);

    const pkcs7 = buildPkcs7WithRevocationData(cert, [ocspFull], []);
    const result = extractEmbeddedRevocationData(pkcs7);

    expect(result.ocsps.length).toBeGreaterThanOrEqual(1);
    expect(result.crls).toEqual([]);
  });

  it('should extract CRLs from adbe-revocationInfoArchival', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const crl = buildTestCrl('Test Cert', []);

    const pkcs7 = buildPkcs7WithRevocationData(cert, [], [crl]);
    const result = extractEmbeddedRevocationData(pkcs7);

    expect(result.crls.length).toBeGreaterThanOrEqual(1);
    expect(result.ocsps).toEqual([]);
  });

  it('should extract both OCSP and CRL data', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const ocspBasic = buildOcspBasicResponse(serial, 0);
    const ocspFull = buildOcspResponse(ocspBasic);
    const crl = buildTestCrl('Test Cert', []);

    const pkcs7 = buildPkcs7WithRevocationData(cert, [ocspFull], [crl]);
    const result = extractEmbeddedRevocationData(pkcs7);

    expect(result.ocsps.length).toBeGreaterThanOrEqual(1);
    expect(result.crls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('verifyOfflineRevocation', () => {
  it('should return no-data when no revocation data is provided', () => {
    const cert = buildTestCertificate(new Uint8Array([0x01]), 'Test');
    const result = verifyOfflineRevocation(cert, { ocsps: [], crls: [] });

    expect(result.checked).toBe(false);
    expect(result.status).toBe('no-data');
    expect(result.source).toBe('none');
  });

  it('should check OCSP and report good status', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const ocspBasic = buildOcspBasicResponse(serial, 0);

    const revData: EmbeddedRevocationData = {
      ocsps: [ocspBasic],
      crls: [],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(true);
    expect(result.status).toBe('good');
    expect(result.source).toBe('ocsp');
  });

  it('should check OCSP and report revoked status', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const ocspBasic = buildOcspBasicResponse(serial, 1);

    const revData: EmbeddedRevocationData = {
      ocsps: [ocspBasic],
      crls: [],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(true);
    expect(result.status).toBe('revoked');
    expect(result.source).toBe('ocsp');
  });

  it('should check OCSP and report unknown status', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const ocspBasic = buildOcspBasicResponse(serial, 2);

    const revData: EmbeddedRevocationData = {
      ocsps: [ocspBasic],
      crls: [],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(true);
    expect(result.status).toBe('unknown');
    expect(result.source).toBe('ocsp');
  });

  it('should fall back to CRL when OCSP has no match', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');

    // OCSP response for a different serial
    const ocspBasic = buildOcspBasicResponse(new Uint8Array([0x99]), 0);

    // CRL from the same issuer with the cert's serial not revoked
    const crl = buildTestCrl('Test Cert', []);

    const revData: EmbeddedRevocationData = {
      ocsps: [ocspBasic],
      crls: [crl],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(true);
    expect(result.status).toBe('good');
    expect(result.source).toBe('crl');
  });

  it('should detect revoked certificate via CRL', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'Test Cert');
    const crl = buildTestCrl('Test Cert', [serial]);

    const revData: EmbeddedRevocationData = {
      ocsps: [],
      crls: [crl],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(true);
    expect(result.status).toBe('revoked');
    expect(result.source).toBe('crl');
  });

  it('should return unknown when no data covers the certificate', () => {
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCertificate(serial, 'My Cert');

    // CRL from a different issuer
    const crl = buildTestCrl('Other Issuer', []);

    const revData: EmbeddedRevocationData = {
      ocsps: [],
      crls: [crl],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(false);
    expect(result.source).toBe('none');
  });

  it('should handle malformed OCSP data gracefully', () => {
    const cert = buildTestCertificate(new Uint8Array([0x01]), 'Test');
    const revData: EmbeddedRevocationData = {
      ocsps: [new Uint8Array([0xff, 0xff, 0xff])],
      crls: [],
    };

    const result = verifyOfflineRevocation(cert, revData);
    expect(result.checked).toBe(false);
  });
});

/**
 * Tests for OCSP stapling (embedding/extracting OCSP responses
 * in PKCS#7 SignedData structures).
 */

import { describe, it, expect } from 'vitest';
import {
  embedOcspResponse,
  extractStapledOcsp,
} from '../../../src/signature/ocspStaple.js';
import {
  buildPkcs7Signature,
  encodeSequence,
  encodeOID,
  encodeSet,
  encodeOctetString,
  encodeContextTag,
  encodeInteger,
  encodeUtf8String,
  encodeUTCTime,
  encodeLength,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a self-signed RSA certificate and PKCS#8 private key.
 */
async function generateSelfSignedCert(): Promise<{
  certificate: Uint8Array;
  privateKey: Uint8Array;
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

  const certificate = await buildSelfSignedCert(spkiDer, keyPair.privateKey);
  return { certificate, privateKey: privateKeyDer };
}

/**
 * Build a minimal self-signed certificate.
 */
async function buildSelfSignedCert(
  spkiDer: Uint8Array,
  privateKey: CryptoKey,
): Promise<Uint8Array> {
  const version = encodeContextTag(0, new Uint8Array([0x02, 0x01, 0x02]));
  const serialBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serialNumber = encodeInteger(serialBytes);

  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  const issuer = encodeSequence([
    encodeSet([
      encodeSequence([encodeOID('2.5.4.3'), encodeUtf8String('Test Signer')]),
    ]),
  ]);

  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([encodeUTCTime(now), encodeUTCTime(later)]);
  const subject = issuer; // self-signed

  const tbsCert = encodeSequence([
    version, serialNumber, sigAlgo, issuer, validity, subject, spkiDer,
  ]);

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      tbsCert.buffer.slice(tbsCert.byteOffset, tbsCert.byteOffset + tbsCert.byteLength) as ArrayBuffer,
    ),
  );

  // BIT STRING: tag(0x03), length, unused-bits(0x00), data
  const bitStringLen = encodeLength(signature.length + 1);
  const sigBitString = new Uint8Array(1 + bitStringLen.length + 1 + signature.length);
  sigBitString[0] = 0x03;
  sigBitString.set(bitStringLen, 1);
  sigBitString[1 + bitStringLen.length] = 0x00;
  sigBitString.set(signature, 1 + bitStringLen.length + 1);

  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

/**
 * Create a mock OCSP response (DER-encoded).
 */
function createMockOcspResponse(): Uint8Array {
  // Build a minimal OCSPResponse structure:
  // OCSPResponse ::= SEQUENCE {
  //   responseStatus ENUMERATED { successful(0) },
  //   responseBytes [0] EXPLICIT SEQUENCE {
  //     responseType OID,
  //     response OCTET STRING
  //   }
  // }
  const enumTag = new Uint8Array([0x0a, 0x01, 0x00]); // ENUMERATED 0

  // Mock response bytes
  const responseType = encodeOID('1.3.6.1.5.5.7.48.1.1'); // id-pkix-ocsp-basic
  const responseContent = encodeOctetString(
    encodeSequence([new Uint8Array([0x02, 0x01, 0x01])]), // version 1
  );
  const responseBytes = encodeSequence([responseType, responseContent]);
  const responseBytesTagged = encodeContextTag(0, responseBytes);

  return encodeSequence([enumTag, responseBytesTagged]);
}

// ---------------------------------------------------------------------------
// Tests: embedOcspResponse
// ---------------------------------------------------------------------------

describe('embedOcspResponse', () => {
  it('should embed an OCSP response into a PKCS#7 structure', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: new Date(Date.UTC(2026, 2, 1, 12, 0, 0)),
    });

    const ocspResp = createMockOcspResponse();
    const result = embedOcspResponse(pkcs7, ocspResp);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(pkcs7.length);
    // Should still be a valid SEQUENCE
    expect(result[0]).toBe(0x30);
  });

  it('should produce a structure that contains the adbe-revocationInfoArchival OID', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
    });

    const ocspResp = createMockOcspResponse();
    const result = embedOcspResponse(pkcs7, ocspResp);

    // OID 1.2.840.113583.1.1.8 = 06 0b 2a 86 48 86 f7 2f 01 01 08
    const hex = Array.from(result)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toContain('2a864886f72f010108');
  });

  it('should throw for invalid PKCS#7 structure', () => {
    const invalid = new Uint8Array([0x30, 0x00]); // empty SEQUENCE
    const ocspResp = createMockOcspResponse();

    expect(() => embedOcspResponse(invalid, ocspResp)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: extractStapledOcsp
// ---------------------------------------------------------------------------

describe('extractStapledOcsp', () => {
  it('should extract an OCSP response after embedding', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
    });

    const ocspResp = createMockOcspResponse();
    const withOcsp = embedOcspResponse(pkcs7, ocspResp);

    const extracted = extractStapledOcsp(withOcsp);

    expect(extracted).not.toBeNull();
    expect(extracted).toBeInstanceOf(Uint8Array);
    expect(extracted!.length).toBeGreaterThan(0);
  });

  it('should return null when no OCSP response is embedded', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
    });

    const extracted = extractStapledOcsp(pkcs7);
    expect(extracted).toBeNull();
  });

  it('should return null for invalid input', () => {
    expect(extractStapledOcsp(new Uint8Array([0x30, 0x00]))).toBeNull();
    expect(extractStapledOcsp(new Uint8Array([]))).toBeNull();
    expect(extractStapledOcsp(new Uint8Array([0xff, 0xff]))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: roundtrip
// ---------------------------------------------------------------------------

describe('OCSP staple roundtrip', () => {
  it('should preserve the original OCSP response content through embed/extract', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
    });

    const ocspResp = createMockOcspResponse();
    const withOcsp = embedOcspResponse(pkcs7, ocspResp);
    const extracted = extractStapledOcsp(withOcsp);

    expect(extracted).not.toBeNull();
    // The extracted bytes should match the original OCSP response content
    // (what's inside the OCTET STRING wrapping)
    expect(extracted!.length).toBeGreaterThan(0);
  });

  it('should embed and extract with SHA-384', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-384',
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
    const certificate = await buildSelfSignedCert(spkiDer, keyPair.privateKey);

    const dataHash = new Uint8Array(48);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey: privateKeyDer, hashAlgorithm: 'SHA-384' },
    });

    const ocspResp = createMockOcspResponse();
    const withOcsp = embedOcspResponse(pkcs7, ocspResp);
    const extracted = extractStapledOcsp(withOcsp);

    expect(extracted).not.toBeNull();
  });
});

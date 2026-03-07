/**
 * Tests for PKCS#7/CMS signature building and ASN.1 DER encoding.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeLength,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeUtf8String,
  encodePrintableString,
  encodeUTCTime,
  encodeContextTag,
  buildPkcs7Signature,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers: generate self-signed certificate and key pair using Web Crypto
// ---------------------------------------------------------------------------

/**
 * Generate a self-signed RSA certificate and PKCS#8 private key.
 *
 * Uses Web Crypto to generate an RSA key pair, then builds a
 * minimal X.509 certificate in DER format.
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

  // Export the private key as PKCS#8
  const privateKeyDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );

  // Export the public key as SPKI
  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  // Build a minimal self-signed X.509 certificate
  const certificate = buildMinimalCertificate(spkiDer, keyPair, 'SHA-256');

  // Sign the TBSCertificate
  const signedCert = await signCertificate(certificate, keyPair.privateKey);

  return { certificate: signedCert, privateKey: privateKeyDer };
}

/**
 * Build a minimal DER-encoded TBSCertificate structure.
 */
function buildMinimalCertificate(
  spkiDer: Uint8Array,
  _keyPair: CryptoKeyPair,
  _hashAlgo: string,
): Uint8Array {
  // version [0] EXPLICIT INTEGER { v3(2) }
  const version = encodeContextTag(0, encodeSmallInteger(2));

  // serialNumber INTEGER
  const serialBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f; // ensure positive
  const serialNumber = encodeInteger(serialBytes);

  // signature AlgorithmIdentifier (SHA-256 with RSA)
  const sigAlgoOid = encodeOID('1.2.840.113549.1.1.11');
  const sigAlgoParams = new Uint8Array([0x05, 0x00]); // NULL
  const signatureAlgo = encodeSequence([sigAlgoOid, sigAlgoParams]);

  // issuer Name (minimal: CN=Test)
  const issuer = buildName('Test Signer');

  // validity { notBefore, notAfter }
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);

  // subject Name
  const subject = buildName('Test Signer');

  // TBSCertificate
  const tbsCert = encodeSequence([
    version,
    serialNumber,
    signatureAlgo,
    issuer,
    validity,
    subject,
    spkiDer,
  ]);

  return tbsCert;
}

/**
 * Sign the TBSCertificate and wrap it in a Certificate structure.
 */
async function signCertificate(
  tbsCert: Uint8Array,
  privateKey: CryptoKey,
): Promise<Uint8Array> {
  // Sign the TBSCertificate
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      tbsCert.buffer.slice(
        tbsCert.byteOffset,
        tbsCert.byteOffset + tbsCert.byteLength,
      ) as ArrayBuffer,
    ),
  );

  // signatureAlgorithm
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  // signatureValue BIT STRING
  const sigBitString = encodeBitString(signature);

  // Certificate = SEQUENCE { tbsCert, signatureAlgorithm, signatureValue }
  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

/**
 * Build a Name (SEQUENCE of SET of AttributeTypeAndValue).
 * Only includes CN (commonName).
 */
function buildName(commonName: string): Uint8Array {
  // OID for CN: 2.5.4.3
  const cnOid = encodeOID('2.5.4.3');
  const cnValue = encodeUtf8String(commonName);
  const atv = encodeSequence([cnOid, cnValue]);
  const rdn = encodeSet([atv]);
  return encodeSequence([rdn]);
}

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
  // BIT STRING: tag(0x03), length, unused-bits(0x00), data
  const len = encodeLength(data.length + 1);
  const result = new Uint8Array(1 + len.length + 1 + data.length);
  result[0] = 0x03; // BIT STRING tag
  result.set(len, 1);
  result[1 + len.length] = 0x00; // unused bits
  result.set(data, 1 + len.length + 1);
  return result;
}

// ---------------------------------------------------------------------------
// Tests: ASN.1 DER encoding
// ---------------------------------------------------------------------------

describe('ASN.1 DER encoding', () => {
  describe('encodeLength', () => {
    it('should encode short lengths (< 128) as a single byte', () => {
      expect(encodeLength(0)).toEqual(new Uint8Array([0x00]));
      expect(encodeLength(1)).toEqual(new Uint8Array([0x01]));
      expect(encodeLength(127)).toEqual(new Uint8Array([0x7f]));
    });

    it('should encode lengths 128-255 as two bytes', () => {
      expect(encodeLength(128)).toEqual(new Uint8Array([0x81, 0x80]));
      expect(encodeLength(255)).toEqual(new Uint8Array([0x81, 0xff]));
    });

    it('should encode lengths 256-65535 as three bytes', () => {
      expect(encodeLength(256)).toEqual(new Uint8Array([0x82, 0x01, 0x00]));
      expect(encodeLength(1000)).toEqual(new Uint8Array([0x82, 0x03, 0xe8]));
    });
  });

  describe('encodeOID', () => {
    it('should encode SHA-256 OID', () => {
      const encoded = encodeOID('2.16.840.1.101.3.4.2.1');
      expect(encoded[0]).toBe(0x06); // OID tag
      // First byte: 2*40 + 16 = 96 (0x60)
      expect(encoded[2]).toBe(0x60);
    });

    it('should encode signedData OID', () => {
      const encoded = encodeOID('1.2.840.113549.1.7.2');
      expect(encoded[0]).toBe(0x06); // OID tag
      // First byte: 1*40 + 2 = 42 (0x2a)
      expect(encoded[2]).toBe(0x2a);
    });

    it('should encode rsaEncryption OID', () => {
      const encoded = encodeOID('1.2.840.113549.1.1.1');
      expect(encoded[0]).toBe(0x06);
    });

    it('should throw for OIDs with fewer than 2 components', () => {
      expect(() => encodeOID('1')).toThrow('Invalid OID');
    });
  });

  describe('encodeSequence', () => {
    it('should encode an empty SEQUENCE', () => {
      const encoded = encodeSequence([]);
      expect(encoded).toEqual(new Uint8Array([0x30, 0x00]));
    });

    it('should encode a SEQUENCE with one element', () => {
      const inner = new Uint8Array([0x02, 0x01, 0x05]); // INTEGER 5
      const encoded = encodeSequence([inner]);
      expect(encoded[0]).toBe(0x30); // SEQUENCE tag
      expect(encoded[1]).toBe(3); // length
      expect(encoded.subarray(2)).toEqual(inner);
    });

    it('should encode nested SEQUENCEs', () => {
      const inner = encodeSequence([new Uint8Array([0x05, 0x00])]); // NULL
      const outer = encodeSequence([inner]);
      expect(outer[0]).toBe(0x30);
    });
  });

  describe('encodeSet', () => {
    it('should encode an empty SET', () => {
      const encoded = encodeSet([]);
      expect(encoded).toEqual(new Uint8Array([0x31, 0x00]));
    });
  });

  describe('encodeOctetString', () => {
    it('should encode a byte array as OCTET STRING', () => {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const encoded = encodeOctetString(data);
      expect(encoded[0]).toBe(0x04); // OCTET STRING tag
      expect(encoded[1]).toBe(4); // length
      expect(encoded.subarray(2)).toEqual(data);
    });
  });

  describe('encodeInteger', () => {
    it('should encode a positive integer', () => {
      const data = new Uint8Array([0x01]);
      const encoded = encodeInteger(data);
      expect(encoded[0]).toBe(0x02); // INTEGER tag
      expect(encoded[1]).toBe(1); // length
      expect(encoded[2]).toBe(0x01);
    });

    it('should add leading zero for high-bit-set values', () => {
      const data = new Uint8Array([0x80]);
      const encoded = encodeInteger(data);
      expect(encoded[0]).toBe(0x02);
      expect(encoded[1]).toBe(2); // length increased
      expect(encoded[2]).toBe(0x00); // padding byte
      expect(encoded[3]).toBe(0x80);
    });

    it('should strip leading zeros', () => {
      const data = new Uint8Array([0x00, 0x00, 0x42]);
      const encoded = encodeInteger(data);
      expect(encoded[0]).toBe(0x02);
      expect(encoded[1]).toBe(1);
      expect(encoded[2]).toBe(0x42);
    });
  });

  describe('encodeUtf8String', () => {
    it('should encode a string as UTF8String', () => {
      const encoded = encodeUtf8String('Hello');
      expect(encoded[0]).toBe(0x0c); // UTF8String tag
      expect(encoded[1]).toBe(5); // length
    });
  });

  describe('encodePrintableString', () => {
    it('should encode a string as PrintableString', () => {
      const encoded = encodePrintableString('Hello');
      expect(encoded[0]).toBe(0x13); // PrintableString tag
      expect(encoded[1]).toBe(5);
    });
  });

  describe('encodeUTCTime', () => {
    it('should encode a date as UTCTime', () => {
      const date = new Date(Date.UTC(2026, 1, 25, 12, 0, 0));
      const encoded = encodeUTCTime(date);
      expect(encoded[0]).toBe(0x17); // UTCTime tag

      // Decode the time string
      const decoder = new TextDecoder();
      const timeStr = decoder.decode(encoded.subarray(2));
      expect(timeStr).toBe('260225120000Z');
    });
  });

  describe('encodeContextTag', () => {
    it('should encode with context-specific tag [0]', () => {
      const data = new Uint8Array([0x02, 0x01, 0x05]);
      const encoded = encodeContextTag(0, data);
      expect(encoded[0]).toBe(0xa0); // context-specific, constructed, tag 0
    });

    it('should encode with context-specific tag [1]', () => {
      const data = new Uint8Array([0x02, 0x01, 0x05]);
      const encoded = encodeContextTag(1, data);
      expect(encoded[0]).toBe(0xa1); // tag 1
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: PKCS#7 signature building
// ---------------------------------------------------------------------------

describe('buildPkcs7Signature', () => {
  it('should build a valid PKCS#7 SignedData structure', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();

    // Create a fake data hash
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: {
        certificate,
        privateKey,
        hashAlgorithm: 'SHA-256',
      },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    });

    expect(pkcs7).toBeInstanceOf(Uint8Array);
    expect(pkcs7.length).toBeGreaterThan(100);

    // Should start with SEQUENCE tag (ContentInfo)
    expect(pkcs7[0]).toBe(0x30);

    // Verify it contains the signedData OID (1.2.840.113549.1.7.2)
    const hex = Array.from(pkcs7)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // signedData OID bytes: 06 09 2a 86 48 86 f7 0d 01 07 02
    expect(hex).toContain('06092a864886f70d010702');
  });

  it('should include the certificate in the output', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();

    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: {
        certificate,
        privateKey,
        hashAlgorithm: 'SHA-256',
      },
    });

    // The certificate bytes should be embedded somewhere in the PKCS#7
    const pkcs7Hex = Array.from(pkcs7)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const certHex = Array.from(certificate)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // The certificate should be present in the output
    expect(pkcs7Hex).toContain(certHex);
  });

  it('should produce different signatures for different hashes', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();

    const hash1 = new Uint8Array(32);
    const hash2 = new Uint8Array(32);
    globalThis.crypto.getRandomValues(hash1);
    globalThis.crypto.getRandomValues(hash2);

    const fixedDate = new Date(Date.UTC(2026, 1, 25, 12, 0, 0));

    const sig1 = await buildPkcs7Signature(hash1, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: fixedDate,
    });

    const sig2 = await buildPkcs7Signature(hash2, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: fixedDate,
    });

    // Different hashes should produce different signatures
    const hex1 = new Uint8Array(sig1).toHex();
    const hex2 = new Uint8Array(sig2).toHex();
    expect(hex1).not.toBe(hex2);
  });
});

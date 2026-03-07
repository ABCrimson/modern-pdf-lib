/**
 * Tests for the detailed signature verifier.
 */

import { describe, it, expect } from 'vitest';
import {
  verifySignatureDetailed,
} from '../../../src/signature/detailedVerifier.js';
import type {
  DetailedVerificationResult,
} from '../../../src/signature/detailedVerifier.js';
import {
  RevocationCache,
} from '../../../src/signature/revocationCache.js';
import type {
  OcspResult,
} from '../../../src/signature/revocationCache.js';
import {
  signPdf,
} from '../../../src/signature/signatureHandler.js';
import {
  encodeSequence,
  encodeOID,
  encodeOctetString,
  encodeContextTag,
  encodeInteger,
  encodeUtf8String,
  encodeUTCTime,
  encodeLength,
  encodeSet,
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
  const subject = issuer;

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

  const bitStringLen = encodeLength(signature.length + 1);
  const sigBitString = new Uint8Array(1 + bitStringLen.length + 1 + signature.length);
  sigBitString[0] = 0x03;
  sigBitString.set(bitStringLen, 1);
  sigBitString[1 + bitStringLen.length] = 0x00;
  sigBitString.set(signature, 1 + bitStringLen.length + 1);

  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

/**
 * Build a minimal valid PDF.
 */
function buildMinimalPdf(): Uint8Array {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f \r
0000000009 00000 n \r
0000000058 00000 n \r
0000000115 00000 n \r
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`;
  return new TextEncoder().encode(pdfContent);
}

// ---------------------------------------------------------------------------
// Tests: verifySignatureDetailed — basic
// ---------------------------------------------------------------------------

describe('verifySignatureDetailed', () => {
  it('should return an empty array for unsigned PDFs', async () => {
    const pdf = buildMinimalPdf();
    const results = await verifySignatureDetailed(pdf);

    expect(results).toEqual([]);
  });

  it('should return detailed results for a signed PDF', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();

    const signedPdf = await signPdf(pdf, 'Sig1', {
      certificate,
      privateKey,
      reason: 'Test signing',
      hashAlgorithm: 'SHA-256',
    });

    const results = await verifySignatureDetailed(signedPdf);

    expect(results).toHaveLength(1);
    const result = results[0]!;

    expect(typeof result.fieldName).toBe('string');
    expect(result.signedBy).toBe('Test Signer');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.integrityValid).toBe('boolean');
    expect(typeof result.cryptoValid).toBe('boolean');
    expect(Array.isArray(result.chain)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should set revocationStatus to unchecked when not requested', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    expect(result.revocationChecked).toBe(false);
    expect(result.revocationStatus).toBe('unchecked');
  });

  it('should include certificate chain info', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    expect(result.chain.length).toBeGreaterThanOrEqual(1);
    const cert = result.chain[0]!;
    expect(cert.subject).toBe('Test Signer');
    expect(cert.issuer).toBe('Test Signer');
    expect(cert.validFrom).toBeInstanceOf(Date);
    expect(cert.validTo).toBeInstanceOf(Date);
    expect(typeof cert.serialNumber).toBe('string');
  });

  it('should verify integrity and crypto validity for valid signatures', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'ValidSig', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    expect(result.integrityValid).toBe(true);
    expect(result.cryptoValid).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect tampered PDFs', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'TamperedSig', { certificate, privateKey });

    // Tamper with a byte in the signed region (near the start)
    const tampered = new Uint8Array(signedPdf);
    tampered[5] = tampered[5]! ^ 0xff;

    const results = await verifySignatureDetailed(tampered);
    const result = results[0]!;

    expect(result.valid).toBe(false);
    // Either integrity or crypto should fail
    expect(result.integrityValid && result.cryptoValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatureDetailed — revocation
// ---------------------------------------------------------------------------

describe('verifySignatureDetailed — revocation checking', () => {
  it('should check revocation when requested', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf, {
      checkRevocation: true,
    });

    const result = results[0]!;
    expect(result.revocationChecked).toBe(true);
    // Without OCSP/CRL endpoints, status should be 'unknown'
    expect(result.revocationStatus).toBe('unknown');
  });

  it('should use cached OCSP response', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    // First verify to get the cert serial
    const firstResults = await verifySignatureDetailed(signedPdf);
    const certSerial = firstResults[0]!.chain[0]!.serialNumber;

    // Set up cache with a response for this serial
    const cache = new RevocationCache();
    const ocspResult: OcspResult = {
      status: 'good',
      thisUpdate: new Date(),
      nextUpdate: new Date(Date.now() + 86400_000),
    };
    cache.cacheOcsp(certSerial, {
      result: ocspResult,
      cachedAt: Date.now(),
      expiresAt: Date.now() + 300_000,
    });

    const results = await verifySignatureDetailed(signedPdf, {
      checkRevocation: true,
      revocationCache: cache,
    });

    const result = results[0]!;
    expect(result.revocationChecked).toBe(true);
    expect(result.revocationStatus).toBe('good');
    expect(result.ocspResponse).toBeDefined();
    expect(result.ocspResponse!.status).toBe('good');
  });

  it('should report revoked status from cache', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const firstResults = await verifySignatureDetailed(signedPdf);
    const certSerial = firstResults[0]!.chain[0]!.serialNumber;

    const cache = new RevocationCache();
    cache.cacheOcsp(certSerial, {
      result: {
        status: 'revoked',
        thisUpdate: new Date(),
        revokedAt: new Date(),
        revocationReason: 'keyCompromise',
      },
      cachedAt: Date.now(),
      expiresAt: Date.now() + 300_000,
    });

    const results = await verifySignatureDetailed(signedPdf, {
      checkRevocation: true,
      revocationCache: cache,
    });

    expect(results[0]!.revocationStatus).toBe('revoked');
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatureDetailed — warnings
// ---------------------------------------------------------------------------

describe('verifySignatureDetailed — warnings', () => {
  it('should warn about single certificate (no chain)', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    const chainWarning = result.warnings.find((w) => w.includes('single certificate'));
    expect(chainWarning).toBeDefined();
  });

  it('should warn about no trusted root certificates', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    const trustWarning = result.warnings.find((w) => w.includes('trusted root'));
    expect(trustWarning).toBeDefined();
  });

  it('should not warn about trusted roots when they are provided', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf, {
      trustedCerts: [certificate],
    });
    const result = results[0]!;

    const trustWarning = result.warnings.find((w) => w.includes('trusted root'));
    expect(trustWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatureDetailed — timestamp
// ---------------------------------------------------------------------------

describe('verifySignatureDetailed — timestamp', () => {
  it('should extract signing time as timestamp', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    // signPdf sets a signing time in signed attributes
    expect(result.timestamp).toBeDefined();
    expect(result.timestamp!.time).toBeInstanceOf(Date);
    expect(result.timestamp!.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatureDetailed — result structure
// ---------------------------------------------------------------------------

describe('verifySignatureDetailed — result structure', () => {
  it('should have all expected fields', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    const result = results[0]!;

    // Check all fields exist
    expect('fieldName' in result).toBe(true);
    expect('signedBy' in result).toBe(true);
    expect('valid' in result).toBe(true);
    expect('integrityValid' in result).toBe(true);
    expect('cryptoValid' in result).toBe(true);
    expect('chain' in result).toBe(true);
    expect('revocationChecked' in result).toBe(true);
    expect('revocationStatus' in result).toBe(true);
    expect('crlChecked' in result).toBe(true);
    expect('warnings' in result).toBe(true);
    expect('errors' in result).toBe(true);
  });

  it('should have crlChecked as false by default', async () => {
    const { certificate, privateKey } = await generateSelfSignedCert();
    const pdf = buildMinimalPdf();
    const signedPdf = await signPdf(pdf, 'Sig1', { certificate, privateKey });

    const results = await verifySignatureDetailed(signedPdf);
    expect(results[0]!.crlChecked).toBe(false);
  });
});

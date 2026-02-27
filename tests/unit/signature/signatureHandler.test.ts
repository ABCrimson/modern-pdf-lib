/**
 * Tests for the high-level sign/verify workflow.
 */

import { describe, it, expect } from 'vitest';
import { signPdf, getSignatures } from '../../../src/signature/signatureHandler.js';
import { verifySignatures } from '../../../src/signature/signatureVerifier.js';
import {
  encodeSequence,
  encodeOID,
  encodeContextTag,
  encodeInteger,
  encodeUtf8String,
  encodeSet,
  encodeUTCTime,
  encodeLength,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers: generate self-signed certificate
// ---------------------------------------------------------------------------

async function generateTestCert(): Promise<{
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

  const certificate = await buildSelfSignedCert(spkiDer, keyPair);

  return { certificate, privateKey: privateKeyDer };
}

async function buildSelfSignedCert(
  spkiDer: Uint8Array,
  keyPair: CryptoKeyPair,
): Promise<Uint8Array> {
  // Version [0] EXPLICIT v3
  const version = encodeContextTag(0, new Uint8Array([0x02, 0x01, 0x02]));

  // Serial number
  const serialBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serial = encodeInteger(serialBytes);

  // Signature algorithm (SHA-256 with RSA)
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  // Issuer and subject: CN=Test Signer
  const name = buildName('Test Signer');

  // Validity
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([encodeUTCTime(now), encodeUTCTime(later)]);

  // TBSCertificate
  const tbsCert = encodeSequence([
    version, serial, sigAlgo, name, validity, name, spkiDer,
  ]);

  // Sign TBSCertificate
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      keyPair.privateKey,
      tbsCert.buffer.slice(
        tbsCert.byteOffset, tbsCert.byteOffset + tbsCert.byteLength,
      ) as ArrayBuffer,
    ),
  );

  // Build Certificate
  const sigBitString = encodeBitString(signature);
  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

function buildName(cn: string): Uint8Array {
  const cnOid = encodeOID('2.5.4.3');
  const cnValue = encodeUtf8String(cn);
  return encodeSequence([encodeSet([encodeSequence([cnOid, cnValue])])]);
}

function encodeBitString(data: Uint8Array): Uint8Array {
  const len = encodeLength(data.length + 1);
  const result = new Uint8Array(1 + len.length + 1 + data.length);
  result[0] = 0x03;
  result.set(len, 1);
  result[1 + len.length] = 0x00;
  result.set(data, 1 + len.length + 1);
  return result;
}

function createMinimalPdf(): Uint8Array {
  const encoder = new TextEncoder();
  const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< /Producer (modern-pdf) /CreationDate (D:20260225120000Z) >>
endobj
xref
0 5
0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000198 00000 n \ntrailer
<< /Size 5 /Root 1 0 R /Info 4 0 R >>
startxref
283
%%EOF
`;
  return encoder.encode(pdf);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('signPdf', () => {
  it('should sign a PDF and return signed bytes', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Signature1', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
      reason: 'Document approval',
      location: 'New York, NY',
    });

    expect(signedPdf).toBeInstanceOf(Uint8Array);
    expect(signedPdf.length).toBeGreaterThan(pdfBytes.length);

    // Should still be a valid PDF structure
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(signedPdf);
    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('/adbe.pkcs7.detached');
  });

  it('should preserve the original PDF content', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Sig1', {
      certificate,
      privateKey,
    });

    // The original bytes should be preserved at the beginning
    const originalPortion = signedPdf.subarray(0, pdfBytes.length);
    expect(originalPortion).toEqual(pdfBytes);
  });

  it('should use SHA-256 by default', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Sig1', {
      certificate,
      privateKey,
    });

    expect(signedPdf.length).toBeGreaterThan(0);
  });
});

describe('getSignatures', () => {
  it('should return empty array for unsigned PDF', () => {
    const pdfBytes = createMinimalPdf();
    const sigs = getSignatures(pdfBytes);
    expect(sigs).toEqual([]);
  });

  it('should find signatures in a signed PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'TestSig', {
      certificate,
      privateKey,
      reason: 'Testing',
    });

    const sigs = getSignatures(signedPdf);
    expect(sigs.length).toBeGreaterThanOrEqual(1);

    const sig = sigs[0]!;
    expect(sig.byteRange).toHaveLength(4);
  });
});

describe('verifySignatures', () => {
  it('should verify a freshly signed PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Sig1', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const results = await verifySignatures(signedPdf);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0]!;
    // Integrity should be valid (we just signed it)
    expect(result.integrityValid).toBe(true);
  });

  it('should detect tampered PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Sig1', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    // Tamper with a byte in the first part (before the signature)
    const tampered = new Uint8Array(signedPdf);
    // Modify a byte in the original content area
    if (tampered[10] !== undefined) {
      tampered[10] = (tampered[10]! + 1) % 256;
    }

    const results = await verifySignatures(tampered);
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Integrity should fail because we tampered with the content
    const result = results[0]!;
    expect(result.integrityValid).toBe(false);
  });

  it('should return empty array for unsigned PDF', async () => {
    const pdfBytes = createMinimalPdf();
    const results = await verifySignatures(pdfBytes);
    expect(results).toEqual([]);
  });
});

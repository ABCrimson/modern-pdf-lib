/**
 * Tests for the signature verification module.
 *
 * Covers:
 * - verifySignatures() — full PDF verification
 * - verifySignature() — single-signature verification
 * - Edge cases: empty input, malformed data, tampered content
 */

import { describe, it, expect } from 'vitest';
import {
  verifySignatures,
  verifySignature,
} from '../../../src/signature/signatureVerifier.js';

import { signPdf } from '../../../src/signature/signatureHandler.js';
import {
  encodeSequence,
  encodeOID,
  encodeContextTag,
  encodeInteger,
  encodeUtf8String,
  encodeSet,
  encodeUTCTime,
  encodeLength,
  encodeOctetString,
  extractIssuerAndSerial,
} from '../../../src/signature/pkcs7.js';
import {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
} from '../../../src/signature/byteRange.js';

// ---------------------------------------------------------------------------
// Helpers: certificate generation (mirrors existing test patterns)
// ---------------------------------------------------------------------------

async function generateTestCert(cn = 'Test Signer'): Promise<{
  certificate: Uint8Array;
  privateKey: Uint8Array;
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

  const certificate = await buildSelfSignedCert(spkiDer, keyPair.privateKey, cn);

  return { certificate, privateKey: privateKeyDer, keyPair };
}

async function generateExpiredCert(cn = 'Expired Signer'): Promise<{
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

  // Build cert with expired validity (notBefore: 2020-01-01, notAfter: 2021-01-01)
  const notBefore = new Date(Date.UTC(2020, 0, 1));
  const notAfter = new Date(Date.UTC(2021, 0, 1));
  const certificate = await buildSelfSignedCert(spkiDer, keyPair.privateKey, cn, notBefore, notAfter);

  return { certificate, privateKey: privateKeyDer };
}

async function buildSelfSignedCert(
  spkiDer: Uint8Array,
  privateKey: CryptoKey,
  cn: string,
  notBefore?: Date,
  notAfter?: Date,
): Promise<Uint8Array> {
  const version = encodeContextTag(0, new Uint8Array([0x02, 0x01, 0x02]));

  const serialBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serial = encodeInteger(serialBytes);

  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  const name = encodeSequence([
    encodeSet([encodeSequence([encodeOID('2.5.4.3'), encodeUtf8String(cn)])]),
  ]);

  const now = notBefore ?? new Date();
  const later = notAfter ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([encodeUTCTime(now), encodeUTCTime(later)]);

  const tbsCert = encodeSequence([
    version, serial, sigAlgo, name, validity, name, spkiDer,
  ]);

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      tbsCert.buffer.slice(
        tbsCert.byteOffset, tbsCert.byteOffset + tbsCert.byteLength,
      ) as ArrayBuffer,
    ),
  );

  const sigBitString = encodeBitString(signature);
  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
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
// Tests: verifySignatures — basic scenarios
// ---------------------------------------------------------------------------

describe('verifySignatures', () => {
  it('should return empty array for unsigned PDF', async () => {
    const pdfBytes = createMinimalPdf();
    const results = await verifySignatures(pdfBytes);
    expect(results).toEqual([]);
  });

  it('should verify a freshly signed PDF with integrity valid', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'Signature1', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const results = await verifySignatures(signedPdf);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0]!;
    expect(result.integrityValid).toBe(true);
    expect(result.signedBy).toBe('Test Signer');
  });

  it('should verify crypto validity for a valid signature', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'CryptoSig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;

    expect(result.certificateValid).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('should extract the signer common name', async () => {
    const { certificate, privateKey } = await generateTestCert('Alice Smith');
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'AliceSig', {
      certificate,
      privateKey,
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.signedBy).toBe('Alice Smith');
  });

  it('should extract the signing date', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'DateSig', {
      certificate,
      privateKey,
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;

    // signPdf sets a signing date in signed attributes
    expect(result.signingDate).toBeInstanceOf(Date);
  });

  it('should return reason as undefined when not in PDF signature dict', async () => {
    // The verifier extracts /Reason from the PDF signature dictionary text.
    // prepareForSigning does not write /Reason into the PDF dict, so the
    // verifier correctly returns undefined for reason even if it was passed
    // to signPdf (it goes into PKCS#7 signed attributes instead).
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'ReasonSig', {
      certificate,
      privateKey,
      reason: 'Document approval',
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;

    // Reason is not written to the PDF signature dictionary by prepareForSigning,
    // so extractFieldInfo will not find it in the PDF text.
    expect(result.reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — tampered PDF detection
// ---------------------------------------------------------------------------

describe('verifySignatures — tampered PDF', () => {
  it('should detect content tampered before the signature', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'TamperSig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const tampered = new Uint8Array(signedPdf);
    // Modify a byte early in the document
    tampered[10] = (tampered[10]! + 1) % 256;

    const results = await verifySignatures(tampered);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0]!;
    expect(result.integrityValid).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('should detect content tampered after the signature', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'PostTamperSig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const tampered = new Uint8Array(signedPdf);
    // Modify a byte near the end (after the signature contents)
    const lastIdx = tampered.length - 5;
    tampered[lastIdx] = (tampered[lastIdx]! + 1) % 256;

    const results = await verifySignatures(tampered);
    const result = results[0]!;

    // Tampering any byte in the ByteRange should invalidate
    expect(result.valid).toBe(false);
  });

  it('should detect single-bit flip', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'BitFlipSig', {
      certificate,
      privateKey,
    });

    const tampered = new Uint8Array(signedPdf);
    // Flip the least significant bit of a content byte
    tampered[20] = tampered[20]! ^ 0x01;

    const results = await verifySignatures(tampered);
    expect(results[0]!.integrityValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — edge cases
// ---------------------------------------------------------------------------

describe('verifySignatures — edge cases', () => {
  it('should handle empty Uint8Array gracefully', async () => {
    const results = await verifySignatures(new Uint8Array(0));
    expect(results).toEqual([]);
  });

  it('should handle minimal non-PDF data gracefully', async () => {
    const garbage = new TextEncoder().encode('not a pdf at all');
    const results = await verifySignatures(garbage);
    expect(results).toEqual([]);
  });

  it('should handle a valid PDF header but no signatures', async () => {
    const pdfLike = new TextEncoder().encode('%PDF-1.4\n%%EOF\n');
    const results = await verifySignatures(pdfLike);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — SignatureVerificationResult structure
// ---------------------------------------------------------------------------

describe('verifySignatures — result structure', () => {
  it('should have all expected fields on a valid result', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'StructSig', {
      certificate,
      privateKey,
      reason: 'Testing structure',
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;

    // Required fields
    expect('fieldName' in result).toBe(true);
    expect('signedBy' in result).toBe(true);
    expect('valid' in result).toBe(true);
    expect('integrityValid' in result).toBe(true);

    expect(typeof result.fieldName).toBe('string');
    expect(typeof result.signedBy).toBe('string');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.integrityValid).toBe('boolean');
  });

  it('should set valid = integrityValid AND certificateValid', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'ValidBothSig', {
      certificate,
      privateKey,
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;

    expect(result.valid).toBe(result.integrityValid && result.certificateValid === true);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignature — single signature verification
// ---------------------------------------------------------------------------

describe('verifySignature', () => {
  it('should return false for empty signatureBytes', async () => {
    const pdfBytes = createMinimalPdf();
    const byteRange: [number, number, number, number] = [0, 100, 200, 100];

    const result = await verifySignature(
      pdfBytes,
      byteRange,
      new Uint8Array(0),
      new Uint8Array(0),
    );

    expect(result).toBe(false);
  });

  it('should return false for random garbage as signature', async () => {
    const pdfBytes = createMinimalPdf();
    const byteRange: [number, number, number, number] = [0, 50, 100, 50];

    const garbage = new Uint8Array(128);
    globalThis.crypto.getRandomValues(garbage);

    const result = await verifySignature(
      pdfBytes,
      byteRange,
      garbage,
      garbage,
    );

    expect(result).toBe(false);
  });

  it('should return false for malformed DER data', async () => {
    const pdfBytes = createMinimalPdf();
    const byteRange: [number, number, number, number] = [0, 50, 100, 50];

    // Craft bytes that look like DER but are invalid
    const malformedSig = new Uint8Array([0x30, 0x82, 0x00, 0x10, 0x00]);
    const malformedCert = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x00]);

    const result = await verifySignature(
      pdfBytes,
      byteRange,
      malformedSig,
      malformedCert,
    );

    expect(result).toBe(false);
  });

  it('should return false when certificate does not match signature', async () => {
    const { certificate: cert1 } = await generateTestCert('Signer A');
    const { certificate: cert2, privateKey: key2 } = await generateTestCert('Signer B');

    const pdfBytes = createMinimalPdf();

    // Sign with cert2/key2
    const signedPdf = await signPdf(pdfBytes, 'MismatchSig', {
      certificate: cert2,
      privateKey: key2,
    });

    // Extract the PKCS#7 signature bytes from the signed PDF
    const { findSignatures } = await import('../../../src/signature/byteRange.js');
    const sigs = findSignatures(signedPdf);
    expect(sigs.length).toBeGreaterThanOrEqual(1);

    const sig = sigs[0]!;
    // Convert hex to bytes
    const sigBytes = Uint8Array.fromHex(sig.contentsHex.replace(/\s/g, ''));

    // Try to verify using cert1 (wrong certificate)
    const result = await verifySignature(
      signedPdf,
      sig.byteRange,
      sigBytes,
      cert1,
    );

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — expired certificate
// ---------------------------------------------------------------------------

describe('verifySignatures — expired certificate', () => {
  it('should still verify cryptographic validity even with expired cert', async () => {
    // The verifier checks mathematical validity, not certificate expiry.
    // Expired certs still produce valid cryptographic signatures.
    const { certificate, privateKey } = await generateExpiredCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'ExpiredSig', {
      certificate,
      privateKey,
    });

    const results = await verifySignatures(signedPdf);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0]!;
    // Integrity should still be valid because the signature is mathematically correct
    expect(result.integrityValid).toBe(true);
    // The signatureVerifier only checks mathematical validity, not cert expiry
    expect(result.signedBy).toBe('Expired Signer');
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — multiple signatures
// ---------------------------------------------------------------------------

describe('verifySignatures — multiple signatures', () => {
  it('should verify multiple signatures independently', async () => {
    const { certificate: cert1, privateKey: key1 } = await generateTestCert('First Signer');
    const { certificate: cert2, privateKey: key2 } = await generateTestCert('Second Signer');

    const pdfBytes = createMinimalPdf();

    // Sign once
    const firstSigned = await signPdf(pdfBytes, 'FirstSig', {
      certificate: cert1,
      privateKey: key1,
    });

    // Sign again (incremental update)
    const doubleSigned = await signPdf(firstSigned, 'SecondSig', {
      certificate: cert2,
      privateKey: key2,
    });

    const results = await verifySignatures(doubleSigned);
    expect(results.length).toBeGreaterThanOrEqual(2);

    // Both signatures should have named signers
    const signers = results.map((r) => r.signedBy);
    expect(signers).toContain('First Signer');
    expect(signers).toContain('Second Signer');
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — hash algorithm variants
// ---------------------------------------------------------------------------

describe('verifySignatures — hash algorithms', () => {
  it('should verify SHA-256 signed PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'SHA256Sig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.integrityValid).toBe(true);
    expect(results[0]!.valid).toBe(true);
  });

  it('should verify SHA-384 signed PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'SHA384Sig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-384',
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.integrityValid).toBe(true);
    expect(results[0]!.valid).toBe(true);
  });

  it('should verify SHA-512 signed PDF', async () => {
    const { certificate, privateKey } = await generateTestCert();
    const pdfBytes = createMinimalPdf();

    const signedPdf = await signPdf(pdfBytes, 'SHA512Sig', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-512',
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.integrityValid).toBe(true);
    expect(results[0]!.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures — RSASSA-PSS with explicit RFC 4055 params (BUG 3)
// ---------------------------------------------------------------------------

// Hash OID map for building PSS params by hand.
const HASH_OID: Record<string, string> = {
  'SHA-256': '2.16.840.1.101.3.4.2.1',
  'SHA-384': '2.16.840.1.101.3.4.2.2',
  'SHA-512': '2.16.840.1.101.3.4.2.3',
};
const RSASSA_PSS_OID = '1.2.840.113549.1.1.10';
const MGF1_OID = '1.2.840.113549.1.1.8';

/**
 * Build an RSASSA-PSS-params SEQUENCE (RFC 4055) with explicit hash, MGF1
 * inner hash, and salt length.
 *
 * Allows overriding the MGF OID and the MGF1 inner hash to exercise the
 * verifier's conservative-rejection paths.
 */
function buildPssParams(opts: {
  hashName: string;
  mgfHashName?: string;
  saltLength: number;
  mgfOid?: string;
}): Uint8Array {
  const NULL = new Uint8Array([0x05, 0x00]);
  const hashOid = HASH_OID[opts.hashName]!;
  const mgfHashOid = HASH_OID[opts.mgfHashName ?? opts.hashName]!;
  const mgfOid = opts.mgfOid ?? MGF1_OID;

  const hashAlgId = encodeSequence([encodeOID(hashOid), NULL]);
  const mgfInnerHashAlgId = encodeSequence([encodeOID(mgfHashOid), NULL]);
  const mgfAlgId = encodeSequence([encodeOID(mgfOid), mgfInnerHashAlgId]);
  const saltInt = encodeInteger(new Uint8Array([opts.saltLength]));

  return encodeSequence([
    encodeContextTag(0, hashAlgId),
    encodeContextTag(1, mgfAlgId),
    encodeContextTag(2, saltInt),
  ]);
}

/**
 * Build a complete PSS-signed PDF by hand so the SignerInfo carries an
 * explicit RSASSA-PSS-params with the requested salt length / hash.
 *
 * Returns the signed PDF bytes.
 */
async function buildPssSignedPdf(opts: {
  cn?: string;
  hashName: string;
  saltLength: number;
  mgfHashName?: string;
  mgfOid?: string;
  fieldName: string;
}): Promise<Uint8Array> {
  const { certificate, keyPair } = await generateTestCert(opts.cn ?? 'PSS Signer');

  // Re-import the RSA private key for RSA-PSS signing (PKCS#8 key material
  // is scheme-agnostic; the test cert SPKI is generic rsaEncryption).
  const pkcs8 = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );
  const pssKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer.slice(pkcs8.byteOffset, pkcs8.byteOffset + pkcs8.byteLength) as ArrayBuffer,
    { name: 'RSA-PSS', hash: opts.hashName },
    false,
    ['sign'],
  );

  const pdfBytes = createMinimalPdf();
  const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, opts.fieldName, 8192);
  const dataHash = await computeSignatureHash(
    preparedPdf,
    byteRange.byteRange,
    opts.hashName as 'SHA-256' | 'SHA-384' | 'SHA-512',
  );

  // Signed attributes: contentType (data) + messageDigest.
  const contentTypeAttr = encodeSequence([
    encodeOID('1.2.840.113549.1.9.3'),
    encodeSet([encodeOID('1.2.840.113549.1.7.1')]),
  ]);
  const messageDigestAttr = encodeSequence([
    encodeOID('1.2.840.113549.1.9.4'),
    encodeSet([encodeOctetString(dataHash)]),
  ]);
  const signedAttrs = [contentTypeAttr, messageDigestAttr];
  const signedAttrsForHash = encodeSet(signedAttrs);

  // Sign the SET-encoded signed attributes with RSA-PSS at the chosen salt.
  const sigBuf = await globalThis.crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: opts.saltLength },
    pssKey,
    signedAttrsForHash.buffer.slice(
      signedAttrsForHash.byteOffset,
      signedAttrsForHash.byteOffset + signedAttrsForHash.byteLength,
    ) as ArrayBuffer,
  );
  const signatureValue = new Uint8Array(sigBuf);

  // Build the SignerInfo with an explicit id-RSASSA-PSS signatureAlgorithm.
  const { issuerDer, serialDer } = extractIssuerAndSerial(certificate);
  const version = new Uint8Array([0x02, 0x01, 0x01]);
  const issuerAndSerial = encodeSequence([issuerDer, serialDer]);
  const digestAlgo = encodeSequence([
    encodeOID(HASH_OID[opts.hashName]!),
    new Uint8Array([0x05, 0x00]),
  ]);
  const signedAttrsTagged = encodeContextTag(0, concatArrays(signedAttrs));
  const pssParams = buildPssParams({
    hashName: opts.hashName,
    saltLength: opts.saltLength,
    mgfHashName: opts.mgfHashName,
    mgfOid: opts.mgfOid,
  });
  const sigAlgo = encodeSequence([encodeOID(RSASSA_PSS_OID), pssParams]);
  const sigOctet = encodeOctetString(signatureValue);
  const signerInfo = encodeSequence([
    version,
    issuerAndSerial,
    digestAlgo,
    signedAttrsTagged,
    sigAlgo,
    sigOctet,
  ]);

  // Build SignedData + ContentInfo.
  const sdVersion = new Uint8Array([0x02, 0x01, 0x01]);
  const digestAlgorithms = encodeSet([digestAlgo]);
  const encapContentInfo = encodeSequence([encodeOID('1.2.840.113549.1.7.1')]);
  const certificates = encodeContextTag(0, certificate);
  const signerInfos = encodeSet([signerInfo]);
  const signedData = encodeSequence([
    sdVersion,
    digestAlgorithms,
    encapContentInfo,
    certificates,
    signerInfos,
  ]);
  const contentInfo = encodeSequence([
    encodeOID('1.2.840.113549.1.7.2'),
    encodeContextTag(0, signedData),
  ]);

  return embedSignature(preparedPdf, contentInfo, byteRange);
}

function concatArrays(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

describe('verifySignatures — RSASSA-PSS explicit params (RFC 4055)', () => {
  it('verifies a PSS signature with a non-default salt length (salt 48, SHA-256)', async () => {
    // The default PSS profile uses salt = digest length (32 for SHA-256).
    // Here the salt is 48: the verifier MUST read saltLength from the
    // RSASSA-PSS-params, not assume the digest length.
    const signedPdf = await buildPssSignedPdf({
      cn: 'PSS Salt48',
      hashName: 'SHA-256',
      saltLength: 48,
      fieldName: 'PssSalt48',
    });

    const results = await verifySignatures(signedPdf);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0]!;
    expect(result.integrityValid).toBe(true);
    expect(result.certificateValid).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('verifies a PSS signature using SHA-384 with its default salt (48)', async () => {
    const signedPdf = await buildPssSignedPdf({
      cn: 'PSS Sha384',
      hashName: 'SHA-384',
      saltLength: 48,
      fieldName: 'PssSha384',
    });

    const results = await verifySignatures(signedPdf);
    const result = results[0]!;
    expect(result.certificateValid).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('fails when the PSS params declare a salt length that does not match the signature', async () => {
    // Sign with salt 32 but advertise salt 48 in the params — verification
    // must fail because the verifier uses the declared (wrong) salt length.
    const { certificate, keyPair } = await generateTestCert('PSS Mismatch');
    const pkcs8 = new Uint8Array(
      await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
    );
    const pssKey = await globalThis.crypto.subtle.importKey(
      'pkcs8',
      pkcs8.buffer.slice(pkcs8.byteOffset, pkcs8.byteOffset + pkcs8.byteLength) as ArrayBuffer,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const pdfBytes = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'PssBadParams', 8192);
    const dataHash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-256');

    const contentTypeAttr = encodeSequence([
      encodeOID('1.2.840.113549.1.9.3'),
      encodeSet([encodeOID('1.2.840.113549.1.7.1')]),
    ]);
    const messageDigestAttr = encodeSequence([
      encodeOID('1.2.840.113549.1.9.4'),
      encodeSet([encodeOctetString(dataHash)]),
    ]);
    const signedAttrs = [contentTypeAttr, messageDigestAttr];
    const signedAttrsForHash = encodeSet(signedAttrs);

    // Sign with salt 32.
    const sigBuf = await globalThis.crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      pssKey,
      signedAttrsForHash.buffer.slice(
        signedAttrsForHash.byteOffset,
        signedAttrsForHash.byteOffset + signedAttrsForHash.byteLength,
      ) as ArrayBuffer,
    );
    const signatureValue = new Uint8Array(sigBuf);

    const { issuerDer, serialDer } = extractIssuerAndSerial(certificate);
    const digestAlgo = encodeSequence([
      encodeOID(HASH_OID['SHA-256']!),
      new Uint8Array([0x05, 0x00]),
    ]);
    // Advertise salt 48 (mismatch).
    const pssParams = buildPssParams({ hashName: 'SHA-256', saltLength: 48 });
    const signerInfo = encodeSequence([
      new Uint8Array([0x02, 0x01, 0x01]),
      encodeSequence([issuerDer, serialDer]),
      digestAlgo,
      encodeContextTag(0, concatArrays(signedAttrs)),
      encodeSequence([encodeOID(RSASSA_PSS_OID), pssParams]),
      encodeOctetString(signatureValue),
    ]);
    const signedData = encodeSequence([
      new Uint8Array([0x02, 0x01, 0x01]),
      encodeSet([digestAlgo]),
      encodeSequence([encodeOID('1.2.840.113549.1.7.1')]),
      encodeContextTag(0, certificate),
      encodeSet([signerInfo]),
    ]);
    const contentInfo = encodeSequence([
      encodeOID('1.2.840.113549.1.7.2'),
      encodeContextTag(0, signedData),
    ]);
    const signedPdf = embedSignature(preparedPdf, contentInfo, byteRange);

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.certificateValid).toBe(false);
    expect(results[0]!.valid).toBe(false);
  });

  it('conservatively rejects when the MGF is not id-mgf1', async () => {
    // A non-MGF1 mask generation function cannot be modelled by WebCrypto;
    // the verifier must reject rather than silently verify with MGF1.
    const signedPdf = await buildPssSignedPdf({
      cn: 'PSS BadMgf',
      hashName: 'SHA-256',
      saltLength: 32,
      // Use a bogus OID in the MGF slot (id-RSASSA-PSS itself, not id-mgf1).
      mgfOid: RSASSA_PSS_OID,
      fieldName: 'PssBadMgf',
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.certificateValid).toBe(false);
    expect(results[0]!.valid).toBe(false);
  });

  it('conservatively rejects when the MGF1 inner hash differs from the PSS hash', async () => {
    // WebCrypto cannot model a divergent MGF hash (it always uses the same
    // hash for both). Verifier must reject rather than verify with the
    // wrong (single) hash.
    const signedPdf = await buildPssSignedPdf({
      cn: 'PSS DivergentHash',
      hashName: 'SHA-256',
      saltLength: 32,
      mgfHashName: 'SHA-384',
      fieldName: 'PssDivergent',
    });

    const results = await verifySignatures(signedPdf);
    expect(results[0]!.certificateValid).toBe(false);
    expect(results[0]!.valid).toBe(false);
  });
});

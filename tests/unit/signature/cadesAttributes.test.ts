/**
 * Tests for CAdES / PAdES baseline attributes (RFC 5035 ESS
 * signing-certificate-v2) and RSASSA-PSS (RFC 4055) signatures.
 *
 * Covers:
 * - buildSigningCertificateV2Attribute() — correct OID, certHash, and
 *   conditional inclusion/omission of the hashAlgorithm AlgorithmIdentifier.
 * - extractSigningCertificateV2() — best-effort DER scan.
 * - pkcs7 `cades: true` wiring — the ESS attribute is present and the
 *   signature round-trips through the verifier.
 * - pkcs7 `signatureScheme: 'pss'` wiring — id-RSASSA-PSS is emitted and
 *   the signature verifies.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSigningCertificateV2Attribute,
  extractSigningCertificateV2,
} from '../../../src/signature/cadesAttributes.js';
import {
  buildPkcs7Signature,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeInteger,
  encodeUtf8String,
  encodeUTCTime,
  encodeContextTag,
  encodeLength,
  parseDerTlv,
  decodeOidBytes,
} from '../../../src/signature/pkcs7.js';
import { verifySignature, verifySignatures } from '../../../src/signature/signatureVerifier.js';
import {
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
} from '../../../src/signature/byteRange.js';

// ---------------------------------------------------------------------------
// Helpers: generate a self-signed cert + key pair (RSA, mirrors existing tests)
// ---------------------------------------------------------------------------

async function generateRsaCert(cn = 'CAdES Signer'): Promise<{
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
  const certificate = await buildSelfSignedCert(spkiDer, keyPair.privateKey, cn);
  return { certificate, privateKey: privateKeyDer };
}

async function buildSelfSignedCert(
  spkiDer: Uint8Array,
  privateKey: CryptoKey,
  cn: string,
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

  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
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

const ID_AA_SIGNING_CERT_V2 = '1.2.840.113549.1.9.16.2.47';
const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_SHA384 = '2.16.840.1.101.3.4.2.2';
const OID_RSASSA_PSS = '1.2.840.113549.1.1.10';
const OID_MGF1 = '1.2.840.113549.1.1.8';

/** Hex helper for substring assertions. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Walk a CMS ContentInfo to the SignerInfo and return the OID of its
 * `signatureAlgorithm` AlgorithmIdentifier.
 *
 * ContentInfo -> [1] [0] SignedData -> signerInfos SET -> SignerInfo
 * SEQUENCE { version, issuerAndSerial, digestAlgo, [0] signedAttrs,
 *            signatureAlgorithm, signature }.
 */
function extractSignerInfoSignatureAlgorithmOid(pkcs7: Uint8Array): string {
  const contentInfo = parseDerTlv(pkcs7, 0);
  const signedData = contentInfo.children[1]!.children[0]!;
  // signerInfos is the LAST SET (tag 0x31) in SignedData. Note that
  // digestAlgorithms is ALSO a SET, so take the last one.
  const sets = signedData.children.filter((c) => c.tag === 0x31);
  const signerInfosSet = sets[sets.length - 1]!;
  const signerInfo = signerInfosSet.children[0]!;
  // signatureAlgorithm is the child immediately after the [0] signedAttrs.
  let idx = 0;
  idx++; // version
  idx++; // issuerAndSerialNumber
  idx++; // digestAlgorithm
  if (signerInfo.children[idx]!.tag === 0xa0) idx++; // [0] signedAttrs
  const sigAlgo = signerInfo.children[idx]!;
  return decodeOidBytes(sigAlgo.children[0]!.data);
}

// ---------------------------------------------------------------------------
// Tests: buildSigningCertificateV2Attribute (RFC 5035)
// ---------------------------------------------------------------------------

describe('buildSigningCertificateV2Attribute', () => {
  it('produces an Attribute SEQUENCE with the id-aa-signingCertificateV2 OID', async () => {
    const { certificate } = await generateRsaCert();
    const attr = await buildSigningCertificateV2Attribute(certificate, 'SHA-256');

    // Outer node is an Attribute SEQUENCE.
    const node = parseDerTlv(attr, 0);
    expect(node.tag).toBe(0x30);
    expect(node.children.length).toBe(2);

    // First child is the attrType OID.
    const oidNode = node.children[0]!;
    expect(oidNode.tag).toBe(0x06);
    expect(decodeOidBytes(oidNode.data)).toBe(ID_AA_SIGNING_CERT_V2);

    // Second child is the attrValues SET.
    expect(node.children[1]!.tag).toBe(0x31);
  });

  it('uses a 32-byte SHA-256 certHash and OMITS the hashAlgorithm for SHA-256', async () => {
    const { certificate } = await generateRsaCert();
    const attr = await buildSigningCertificateV2Attribute(certificate, 'SHA-256');

    // Compute the expected certHash directly.
    const digest = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-256', certificate.buffer.slice(
        certificate.byteOffset, certificate.byteOffset + certificate.byteLength,
      ) as ArrayBuffer),
    );
    expect(digest.length).toBe(32);

    // Walk: Attribute -> SET -> SigningCertificateV2 -> certs(SEQ OF) -> ESSCertIDv2
    const attrNode = parseDerTlv(attr, 0);
    const set = attrNode.children[1]!;
    const signingCertV2 = set.children[0]!; // SEQUENCE
    expect(signingCertV2.tag).toBe(0x30);
    const certsSeq = signingCertV2.children[0]!; // SEQUENCE OF
    expect(certsSeq.tag).toBe(0x30);
    const essCertId = certsSeq.children[0]!; // ESSCertIDv2 SEQUENCE
    expect(essCertId.tag).toBe(0x30);

    // For SHA-256 the hashAlgorithm DEFAULT is omitted, so the first
    // (and only required) child is the certHash OCTET STRING.
    const first = essCertId.children[0]!;
    expect(first.tag).toBe(0x04); // OCTET STRING (certHash) — NOT a SEQUENCE
    expect(first.data.length).toBe(32);
    expect(toHex(first.data)).toBe(toHex(digest));
  });

  it('INCLUDES the hashAlgorithm AlgorithmIdentifier for SHA-384', async () => {
    const { certificate } = await generateRsaCert();
    const attr = await buildSigningCertificateV2Attribute(certificate, 'SHA-384');

    const attrNode = parseDerTlv(attr, 0);
    const set = attrNode.children[1]!;
    const signingCertV2 = set.children[0]!;
    const certsSeq = signingCertV2.children[0]!;
    const essCertId = certsSeq.children[0]!;

    // For SHA-384 the first child is the hashAlgorithm AlgorithmIdentifier SEQUENCE.
    const algId = essCertId.children[0]!;
    expect(algId.tag).toBe(0x30); // SEQUENCE (AlgorithmIdentifier)
    const algOid = algId.children[0]!;
    expect(decodeOidBytes(algOid.data)).toBe(OID_SHA384);

    // Second child is the 48-byte certHash OCTET STRING.
    const certHash = essCertId.children[1]!;
    expect(certHash.tag).toBe(0x04);
    expect(certHash.data.length).toBe(48);
  });

  it('hashes the WHOLE DER certificate (changing the cert changes the hash)', async () => {
    const { certificate: certA } = await generateRsaCert('Signer A');
    const { certificate: certB } = await generateRsaCert('Signer B');
    const attrA = await buildSigningCertificateV2Attribute(certA, 'SHA-256');
    const attrB = await buildSigningCertificateV2Attribute(certB, 'SHA-256');
    expect(toHex(attrA)).not.toBe(toHex(attrB));
  });
});

// ---------------------------------------------------------------------------
// Tests: extractSigningCertificateV2
// ---------------------------------------------------------------------------

describe('extractSigningCertificateV2', () => {
  it('reports present:false when the attribute is absent', () => {
    const signedAttrs = encodeSet([
      encodeSequence([encodeOID('1.2.840.113549.1.9.3'), encodeSet([encodeOID('1.2.840.113549.1.7.1')])]),
    ]);
    const res = extractSigningCertificateV2(signedAttrs);
    expect(res.present).toBe(false);
    expect(res.certHash).toBeUndefined();
  });

  it('reports present:true and returns the 32-byte certHash when found', async () => {
    const { certificate } = await generateRsaCert();
    const attr = await buildSigningCertificateV2Attribute(certificate, 'SHA-256');

    // Embed inside a SignedAttributes SET alongside an unrelated attribute.
    const other = encodeSequence([
      encodeOID('1.2.840.113549.1.9.3'),
      encodeSet([encodeOID('1.2.840.113549.1.7.1')]),
    ]);
    const signedAttrs = encodeSet([other, attr]);

    const res = extractSigningCertificateV2(signedAttrs);
    expect(res.present).toBe(true);
    expect(res.certHash).toBeInstanceOf(Uint8Array);
    expect(res.certHash!.length).toBe(32);

    const digest = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-256', certificate.buffer.slice(
        certificate.byteOffset, certificate.byteOffset + certificate.byteLength,
      ) as ArrayBuffer),
    );
    expect(toHex(res.certHash!)).toBe(toHex(digest));
  });
});

// ---------------------------------------------------------------------------
// Tests: pkcs7 `cades: true` wiring
// ---------------------------------------------------------------------------

describe('buildPkcs7Signature with cades: true', () => {
  it('is byte-identical to the default when cades is false/absent', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);
    const signingDate = new Date(Date.UTC(2026, 1, 25, 12, 0, 0));

    const a = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate,
    });
    const b = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate,
      cades: false,
    });
    expect(toHex(a)).toBe(toHex(b));
  });

  it('embeds the signing-certificate-v2 OID when cades is true', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
      cades: true,
    });

    // id-aa-signingCertificateV2 OID bytes:
    // 06 0b 2a 86 48 86 f7 0d 01 09 10 02 2f
    expect(toHex(pkcs7)).toContain('060b2a864886f70d010910022f');
  });

  it('round-trips through the verifier with the ESS attribute detected', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
      cades: true,
    });

    // Verify the signature mathematically using the verifier helper.
    const ok = await verifySignature(
      new Uint8Array(0),
      [0, 0, 0, 0],
      pkcs7,
      certificate,
    );
    expect(ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: pkcs7 RSASSA-PSS wiring (RFC 4055)
// ---------------------------------------------------------------------------

describe('buildPkcs7Signature with signatureScheme: pss', () => {
  it('emits the id-RSASSA-PSS signatureAlgorithm with mgf1 params', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: {
        certificate,
        privateKey,
        hashAlgorithm: 'SHA-256',
        signatureScheme: 'pss',
      },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    });

    const hex = toHex(pkcs7);
    // id-RSASSA-PSS OID bytes: 06 09 2a 86 48 86 f7 0d 01 01 0a
    expect(hex).toContain('06092a864886f70d01010a');
    // id-mgf1 OID bytes: 06 09 2a 86 48 86 f7 0d 01 01 08
    expect(hex).toContain('06092a864886f70d010108');

    // Precisely confirm the SignerInfo signatureAlgorithm is id-RSASSA-PSS
    // (the embedded self-signed cert legitimately also carries
    //  sha256WithRSAEncryption, so a global substring check is not enough).
    const sigAlgoOid = extractSignerInfoSignatureAlgorithmOid(pkcs7);
    expect(sigAlgoOid).toBe(OID_RSASSA_PSS);

    // The PSS params must carry saltLength = 32 for SHA-256:
    // ...a2 03 02 01 20 (context [2] -> INTEGER 0x20).
    expect(hex).toContain('a203020120');
  });

  it('produces a PSS signature that verifies', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: {
        certificate,
        privateKey,
        hashAlgorithm: 'SHA-256',
        signatureScheme: 'pss',
      },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    });

    const ok = await verifySignature(
      new Uint8Array(0),
      [0, 0, 0, 0],
      pkcs7,
      certificate,
    );
    expect(ok).toBe(true);
  });

  it('combines cades + pss correctly (both present, verifies)', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: {
        certificate,
        privateKey,
        hashAlgorithm: 'SHA-384',
        signatureScheme: 'pss',
      },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
      cades: true,
    });

    const hex = toHex(pkcs7);
    expect(hex).toContain('06092a864886f70d01010a'); // id-RSASSA-PSS
    expect(hex).toContain('060b2a864886f70d010910022f'); // signing-cert-v2

    const ok = await verifySignature(
      new Uint8Array(0),
      [0, 0, 0, 0],
      pkcs7,
      certificate,
    );
    expect(ok).toBe(true);
  });

  it('defaults to pkcs1v15 (sha256WithRSAEncryption) when scheme is absent', async () => {
    const { certificate, privateKey } = await generateRsaCert();
    const dataHash = new Uint8Array(32);
    globalThis.crypto.getRandomValues(dataHash);

    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    });

    const hex = toHex(pkcs7);
    // sha256WithRSAEncryption present, id-RSASSA-PSS absent.
    expect(hex).toContain('06092a864886f70d01010b');
    expect(hex).not.toContain('06092a864886f70d01010a');
  });
});

// ---------------------------------------------------------------------------
// Tests: verifySignatures reports CAdES fields end-to-end
// ---------------------------------------------------------------------------

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

/** Sign a PDF embedding a CAdES (ESS signing-certificate-v2) signature. */
async function signPdfCades(
  pdfBytes: Uint8Array,
  certificate: Uint8Array,
  privateKey: Uint8Array,
  pss: boolean,
): Promise<Uint8Array> {
  const { preparedPdf, byteRange } = prepareForSigning(pdfBytes, 'CAdESField', 8192);
  const dataHash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-256');
  const pkcs7 = await buildPkcs7Signature(dataHash, {
    signerInfo: {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
      ...(pss ? { signatureScheme: 'pss' as const } : {}),
    },
    signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    cades: true,
  });
  return embedSignature(preparedPdf, pkcs7, byteRange);
}

describe('verifySignatures — CAdES reporting', () => {
  it('reports cadesSigningCertPresent + cadesSigningCertHashValid for a CAdES signature', async () => {
    const { certificate, privateKey } = await generateRsaCert('CAdES E2E');
    const signed = await signPdfCades(createMinimalPdf(), certificate, privateKey, false);

    const results = await verifySignatures(signed);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const r = results[0]!;

    expect(r.integrityValid).toBe(true);
    expect(r.certificateValid).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.cadesSigningCertPresent).toBe(true);
    expect(r.cadesSigningCertHashValid).toBe(true);
  });

  it('reports valid CAdES + PSS signature end-to-end', async () => {
    const { certificate, privateKey } = await generateRsaCert('CAdES PSS');
    const signed = await signPdfCades(createMinimalPdf(), certificate, privateKey, true);

    const results = await verifySignatures(signed);
    const r = results[0]!;

    expect(r.valid).toBe(true);
    expect(r.cadesSigningCertPresent).toBe(true);
    expect(r.cadesSigningCertHashValid).toBe(true);
  });

  it('reports cadesSigningCertPresent:false for a non-CAdES signature', async () => {
    const { certificate, privateKey } = await generateRsaCert('Plain');
    const { preparedPdf, byteRange } = prepareForSigning(createMinimalPdf(), 'PlainField', 8192);
    const dataHash = await computeSignatureHash(preparedPdf, byteRange.byteRange, 'SHA-256');
    const pkcs7 = await buildPkcs7Signature(dataHash, {
      signerInfo: { certificate, privateKey, hashAlgorithm: 'SHA-256' },
      signingDate: new Date(Date.UTC(2026, 1, 25, 12, 0, 0)),
    });
    const signed = embedSignature(preparedPdf, pkcs7, byteRange);

    const results = await verifySignatures(signed);
    const r = results[0]!;
    expect(r.valid).toBe(true);
    expect(r.cadesSigningCertPresent).toBe(false);
    expect(r.cadesSigningCertHashValid).toBeUndefined();
  });
});

// Keep referenced constants used for documentation/clarity.
void OID_SHA256;
void OID_RSASSA_PSS;
void OID_MGF1;

/**
 * Tests for certificate chain building and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCertificateChain,
  validateCertificateChain,
} from '../../../src/signature/chainValidator.js';
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
 * Encode a BOOLEAN value.
 */
function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, value ? 0xff : 0x00]);
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

const SHA256_RSA_ALGO = encodeSequence([
  encodeOID('1.2.840.113549.1.1.11'),
  new Uint8Array([0x05, 0x00]),
]);

/**
 * Generate a self-signed root CA certificate.
 */
async function generateRootCA(
  name: string,
  options?: { notBefore?: Date; notAfter?: Date },
): Promise<{
  certificate: Uint8Array;
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

  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialBytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serialNumber = encodeInteger(serialBytes);

  const issuer = buildName(name);
  const subject = buildName(name);

  const notBefore = options?.notBefore ?? new Date();
  const notAfter = options?.notAfter ?? new Date(notBefore.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(notBefore),
    encodeUTCTime(notAfter),
  ]);

  // Basic Constraints: cA=TRUE
  const basicConstraints = encodeSequence([encodeBoolean(true)]);
  const bcExt = encodeSequence([
    encodeOID('2.5.29.19'),
    encodeBoolean(true), // critical
    encodeOctetString(basicConstraints),
  ]);
  const extSeq = encodeSequence([bcExt]);
  const extensionsWrapper = encodeContextTag(3, extSeq);

  const tbsCert = encodeSequence([
    version, serialNumber, SHA256_RSA_ALGO,
    issuer, validity, subject, spkiDer,
    extensionsWrapper,
  ]);

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
    SHA256_RSA_ALGO,
    encodeBitString(signature),
  ]);

  return { certificate, keyPair };
}

/**
 * Generate an intermediate CA certificate signed by a parent.
 */
async function generateIntermediateCA(
  name: string,
  issuerName: string,
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
  options?: { notBefore?: Date; notAfter?: Date },
): Promise<{
  certificate: Uint8Array;
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

  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  // Extract the issuer's subject Name for use as this cert's issuer
  const issuerSubject = extractSubjectName(issuerCert);

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialBytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serialNumber = encodeInteger(serialBytes);

  const subject = buildName(name);

  const notBefore = options?.notBefore ?? new Date();
  const notAfter = options?.notAfter ?? new Date(notBefore.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(notBefore),
    encodeUTCTime(notAfter),
  ]);

  // Basic Constraints: cA=TRUE
  const basicConstraints = encodeSequence([encodeBoolean(true)]);
  const bcExt = encodeSequence([
    encodeOID('2.5.29.19'),
    encodeBoolean(true),
    encodeOctetString(basicConstraints),
  ]);
  const extSeq = encodeSequence([bcExt]);
  const extensionsWrapper = encodeContextTag(3, extSeq);

  const tbsCert = encodeSequence([
    version, serialNumber, SHA256_RSA_ALGO,
    issuerSubject, validity, subject, spkiDer,
    extensionsWrapper,
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

  const certificate = encodeSequence([
    tbsCert,
    SHA256_RSA_ALGO,
    encodeBitString(signature),
  ]);

  return { certificate, keyPair };
}

/**
 * Generate a leaf (end-entity) certificate signed by a CA.
 */
async function generateLeafCert(
  name: string,
  issuerCert: Uint8Array,
  issuerKeyPair: CryptoKeyPair,
  options?: { notBefore?: Date; notAfter?: Date },
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

  const issuerSubject = extractSubjectName(issuerCert);

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialBytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serialNumber = encodeInteger(serialBytes);

  const subject = buildName(name);

  const notBefore = options?.notBefore ?? new Date();
  const notAfter = options?.notAfter ?? new Date(notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(notBefore),
    encodeUTCTime(notAfter),
  ]);

  // No Basic Constraints (leaf cert)
  const tbsCert = encodeSequence([
    version, serialNumber, SHA256_RSA_ALGO,
    issuerSubject, validity, subject, spkiDer,
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
    SHA256_RSA_ALGO,
    encodeBitString(signature),
  ]);
}

/**
 * Extract the subject Name bytes from a certificate.
 */
function extractSubjectName(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) idx = 1;
  const subjectNode = tbsCert.children[idx + 4]!;
  const start = subjectNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + subjectNode.totalLength);
}

// ---------------------------------------------------------------------------
// Tests: buildCertificateChain
// ---------------------------------------------------------------------------

describe('buildCertificateChain', () => {
  it('should build a simple chain: leaf -> root', async () => {
    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('End Entity', root.certificate, root.keyPair);

    const result = buildCertificateChain(leaf, [root.certificate]);

    expect(result.chain).toHaveLength(2);
    expect(result.complete).toBe(true);
  });

  it('should build a three-level chain: leaf -> intermediate -> root', async () => {
    const root = await generateRootCA('Root CA');
    const intermediate = await generateIntermediateCA(
      'Intermediate CA',
      'Root CA',
      root.certificate,
      root.keyPair,
    );
    const leaf = await generateLeafCert(
      'End Entity',
      intermediate.certificate,
      intermediate.keyPair,
    );

    const result = buildCertificateChain(leaf, [
      intermediate.certificate,
      root.certificate,
    ]);

    expect(result.chain).toHaveLength(3);
    expect(result.complete).toBe(true);
  });

  it('should report incomplete chain when root is missing', async () => {
    const root = await generateRootCA('Root CA');
    const intermediate = await generateIntermediateCA(
      'Intermediate CA',
      'Root CA',
      root.certificate,
      root.keyPair,
    );
    const leaf = await generateLeafCert(
      'End Entity',
      intermediate.certificate,
      intermediate.keyPair,
    );

    // Only provide intermediate, not root
    const result = buildCertificateChain(leaf, [intermediate.certificate]);

    expect(result.chain).toHaveLength(2);
    expect(result.complete).toBe(false);
  });

  it('should handle a self-signed leaf (no intermediates needed)', async () => {
    const root = await generateRootCA('Self-Signed');

    const result = buildCertificateChain(root.certificate, []);

    expect(result.chain).toHaveLength(1);
    expect(result.complete).toBe(true);
  });

  it('should handle out-of-order intermediates', async () => {
    const root = await generateRootCA('Root CA');
    const intermediate1 = await generateIntermediateCA(
      'Intermediate 1',
      'Root CA',
      root.certificate,
      root.keyPair,
    );
    const intermediate2 = await generateIntermediateCA(
      'Intermediate 2',
      'Intermediate 1',
      intermediate1.certificate,
      intermediate1.keyPair,
    );
    const leaf = await generateLeafCert(
      'End Entity',
      intermediate2.certificate,
      intermediate2.keyPair,
    );

    // Provide intermediates in reverse order
    const result = buildCertificateChain(leaf, [
      root.certificate,
      intermediate1.certificate,
      intermediate2.certificate,
    ]);

    expect(result.chain).toHaveLength(4);
    expect(result.complete).toBe(true);
  });

  it('should report incomplete when no matching issuer found', async () => {
    const root = await generateRootCA('Root CA');
    const unrelatedRoot = await generateRootCA('Unrelated CA');

    const leaf = await generateLeafCert('Entity', root.certificate, root.keyPair);

    // Provide only an unrelated cert
    const result = buildCertificateChain(leaf, [unrelatedRoot.certificate]);

    expect(result.complete).toBe(false);
    expect(result.chain).toHaveLength(1); // just the leaf
  });
});

// ---------------------------------------------------------------------------
// Tests: validateCertificateChain
// ---------------------------------------------------------------------------

describe('validateCertificateChain', () => {
  it('should validate a correct two-level chain', async () => {
    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('End Entity', root.certificate, root.keyPair);

    const result = await validateCertificateChain(
      [leaf, root.certificate],
    );

    expect(result.valid).toBe(true);
    expect(result.certificates).toHaveLength(2);
    expect(result.certificates[0]!.signatureValid).toBe(true);
    expect(result.certificates[0]!.withinValidityPeriod).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate a correct three-level chain', async () => {
    const root = await generateRootCA('Root CA');
    const intermediate = await generateIntermediateCA(
      'Intermediate CA',
      'Root CA',
      root.certificate,
      root.keyPair,
    );
    const leaf = await generateLeafCert(
      'End Entity',
      intermediate.certificate,
      intermediate.keyPair,
    );

    const result = await validateCertificateChain(
      [leaf, intermediate.certificate, root.certificate],
    );

    expect(result.valid).toBe(true);
    expect(result.certificates).toHaveLength(3);
    expect(result.certificates[0]!.subject).toBe('End Entity');
    expect(result.certificates[1]!.subject).toBe('Intermediate CA');
    expect(result.certificates[2]!.subject).toBe('Root CA');
  });

  it('should detect an expired certificate', async () => {
    const pastDate = new Date(Date.UTC(2020, 0, 1));
    const expiredDate = new Date(Date.UTC(2021, 0, 1));

    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('Expired Entity', root.certificate, root.keyPair, {
      notBefore: pastDate,
      notAfter: expiredDate,
    });

    const result = await validateCertificateChain(
      [leaf, root.certificate],
    );

    expect(result.valid).toBe(false);
    expect(result.certificates[0]!.withinValidityPeriod).toBe(false);
    expect(result.certificates[0]!.errors.length).toBeGreaterThan(0);
  });

  it('should detect a not-yet-valid certificate', async () => {
    const futureDate = new Date(Date.UTC(2030, 0, 1));
    const farFuture = new Date(Date.UTC(2031, 0, 1));

    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('Future Entity', root.certificate, root.keyPair, {
      notBefore: futureDate,
      notAfter: farFuture,
    });

    const result = await validateCertificateChain(
      [leaf, root.certificate],
    );

    expect(result.valid).toBe(false);
    expect(result.certificates[0]!.withinValidityPeriod).toBe(false);
  });

  it('should use custom validationTime', async () => {
    const pastDate = new Date(Date.UTC(2020, 0, 1));
    const expiredDate = new Date(Date.UTC(2021, 0, 1));

    const root = await generateRootCA('Root CA', {
      notBefore: pastDate,
      notAfter: new Date(Date.UTC(2030, 0, 1)),
    });
    const leaf = await generateLeafCert('Past Entity', root.certificate, root.keyPair, {
      notBefore: pastDate,
      notAfter: expiredDate,
    });

    // Validate at a time within the cert's validity period
    const validTime = new Date(Date.UTC(2020, 6, 1));
    const result = await validateCertificateChain(
      [leaf, root.certificate],
      { validationTime: validTime },
    );

    expect(result.certificates[0]!.withinValidityPeriod).toBe(true);
  });

  it('should verify self-signed root signature', async () => {
    const root = await generateRootCA('Root CA');

    const result = await validateCertificateChain([root.certificate]);

    expect(result.valid).toBe(true);
    expect(result.certificates[0]!.signatureValid).toBe(true);
  });

  it('should report errors for an empty chain', async () => {
    const result = await validateCertificateChain([]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Empty certificate chain');
  });

  it('should detect tampered certificate signature', async () => {
    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('Entity', root.certificate, root.keyPair);

    // Tamper with the leaf by flipping a byte in the signature area
    const tampered = new Uint8Array(leaf);
    tampered[tampered.length - 10] ^= 0xff;

    const result = await validateCertificateChain(
      [tampered, root.certificate],
    );

    expect(result.certificates[0]!.signatureValid).toBe(false);
  });

  it('should validate with trusted certificates', async () => {
    const root = await generateRootCA('Trusted Root');
    const leaf = await generateLeafCert('Entity', root.certificate, root.keyPair);

    // Provide the root as a trusted cert, but not in the chain
    const result = await validateCertificateChain(
      [leaf],
      { trustedCerts: [root.certificate] },
    );

    // The leaf's issuer should be found in trustedCerts
    expect(result.certificates[0]!.signatureValid).toBe(true);
  });

  it('should check basic constraints on intermediate certs', async () => {
    const root = await generateRootCA('Root CA');
    const intermediate = await generateIntermediateCA(
      'Intermediate CA',
      'Root CA',
      root.certificate,
      root.keyPair,
    );
    const leaf = await generateLeafCert(
      'Entity',
      intermediate.certificate,
      intermediate.keyPair,
    );

    const result = await validateCertificateChain(
      [leaf, intermediate.certificate, root.certificate],
    );

    // Intermediate should have valid basic constraints (cA=TRUE)
    expect(result.certificates[1]!.basicConstraintsValid).toBe(true);
  });

  it('should extract subject and issuer names', async () => {
    const root = await generateRootCA('My Root CA');
    const leaf = await generateLeafCert('My Leaf Cert', root.certificate, root.keyPair);

    const result = await validateCertificateChain(
      [leaf, root.certificate],
    );

    expect(result.certificates[0]!.subject).toBe('My Leaf Cert');
    expect(result.certificates[1]!.subject).toBe('My Root CA');
  });

  it('should report notBefore and notAfter dates', async () => {
    const root = await generateRootCA('Root CA');
    const leaf = await generateLeafCert('Entity', root.certificate, root.keyPair);

    const result = await validateCertificateChain(
      [leaf, root.certificate],
    );

    expect(result.certificates[0]!.notBefore).toBeInstanceOf(Date);
    expect(result.certificates[0]!.notAfter).toBeInstanceOf(Date);
    expect(result.certificates[0]!.notAfter.getTime()).toBeGreaterThan(
      result.certificates[0]!.notBefore.getTime(),
    );
  });

  it('should detect wrong issuer signature', async () => {
    const root1 = await generateRootCA('Root CA 1');
    const root2 = await generateRootCA('Root CA 2');
    const leaf = await generateLeafCert('Entity', root1.certificate, root1.keyPair);

    // Present root2 as the issuer (wrong key)
    const result = await validateCertificateChain(
      [leaf, root2.certificate],
    );

    // Signature should fail because root2 didn't sign the leaf
    expect(result.certificates[0]!.signatureValid).toBe(false);
  });
});

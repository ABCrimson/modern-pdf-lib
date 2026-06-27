/**
 * Tests for certificate path (trust-chain) building per RFC 5280 §6.1.
 *
 * Builds X.509 hierarchies with WebCrypto (RSASSA-PKCS1-v1_5 / SHA-256),
 * optionally carrying Subject Key Identifier (2.5.29.14) and Authority
 * Key Identifier (2.5.29.35) extensions, and exercises `buildCertPath`.
 *
 * Cert-generation helpers follow the established pattern in
 * `chainValidator.test.ts` (no shared fixture module exists), extended
 * here to emit SKI/AKI so the key-identifier matching path is covered.
 */

import { describe, it, expect } from 'vitest';
import { buildCertPath } from '../../../src/signature/certPathBuilder.js';
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
// DER encoding helpers (mirrors chainValidator.test.ts)
// ---------------------------------------------------------------------------

function encodeSmallInteger(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([0x02, 0x01, value]);
  }
  return new Uint8Array([0x02, 0x02, (value >> 8) & 0xff, value & 0xff]);
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

function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, value ? 0xff : 0x00]);
}

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

/** BasicConstraints cA=TRUE extension. */
function basicConstraintsCa(): Uint8Array {
  const bc = encodeSequence([encodeBoolean(true)]);
  return encodeSequence([
    encodeOID('2.5.29.19'),
    encodeBoolean(true), // critical
    encodeOctetString(bc),
  ]);
}

/** Subject Key Identifier (2.5.29.14): OCTET STRING wrapping a KeyIdentifier OCTET STRING. */
function subjectKeyIdentifier(keyId: Uint8Array): Uint8Array {
  return encodeSequence([
    encodeOID('2.5.29.14'),
    encodeOctetString(encodeOctetString(keyId)),
  ]);
}

/**
 * Authority Key Identifier (2.5.29.35): OCTET STRING wrapping
 * SEQUENCE { keyIdentifier [0] IMPLICIT OCTET STRING }.
 */
function authorityKeyIdentifier(keyId: Uint8Array): Uint8Array {
  // keyIdentifier is [0] IMPLICIT — a context-tagged primitive (0x80).
  const ctxLen = encodeLength(keyId.length);
  const keyIdTagged = new Uint8Array(1 + ctxLen.length + keyId.length);
  keyIdTagged[0] = 0x80;
  keyIdTagged.set(ctxLen, 1);
  keyIdTagged.set(keyId, 1 + ctxLen.length);
  const akiSeq = encodeSequence([keyIdTagged]);
  return encodeSequence([
    encodeOID('2.5.29.35'),
    encodeOctetString(akiSeq),
  ]);
}

interface GenOptions {
  /** Subject Key Identifier to embed (also used as the cert's identity for AKI linkage). */
  ski?: Uint8Array;
  /** Authority Key Identifier to embed (issuer's SKI). */
  aki?: Uint8Array;
  /** Whether to mark as a CA (BasicConstraints cA=TRUE). */
  ca?: boolean;
}

interface GenResult {
  certificate: Uint8Array;
  keyPair: CryptoKeyPair;
}

async function newKeyPair(): Promise<CryptoKeyPair> {
  return globalThis.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
}

/**
 * Generate a certificate. If `issuer` is omitted the cert is self-signed
 * (subject === issuer, signed by its own key).
 */
async function generateCert(
  name: string,
  options: GenOptions = {},
  issuer?: { name: string; subjectName: Uint8Array; keyPair: CryptoKeyPair },
): Promise<GenResult> {
  const keyPair = await newKeyPair();
  const spkiDer = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey),
  );

  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialBytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(serialBytes);
  serialBytes[0] = serialBytes[0]! & 0x7f;
  const serialNumber = encodeInteger(serialBytes);

  const subject = buildName(name);
  const issuerName = issuer ? issuer.subjectName : subject;
  const signingKey = issuer ? issuer.keyPair.privateKey : keyPair.privateKey;

  const notBefore = new Date(Date.UTC(2020, 0, 1));
  const notAfter = new Date(Date.UTC(2035, 0, 1));
  const validity = encodeSequence([
    encodeUTCTime(notBefore),
    encodeUTCTime(notAfter),
  ]);

  const exts: Uint8Array[] = [];
  if (options.ca) exts.push(basicConstraintsCa());
  if (options.ski) exts.push(subjectKeyIdentifier(options.ski));
  if (options.aki) exts.push(authorityKeyIdentifier(options.aki));

  const tbsParts: Uint8Array[] = [
    version, serialNumber, SHA256_RSA_ALGO,
    issuerName, validity, subject, spkiDer,
  ];
  if (exts.length > 0) {
    tbsParts.push(encodeContextTag(3, encodeSequence(exts)));
  }
  const tbsCert = encodeSequence(tbsParts);

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      signingKey,
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

/** Extract the raw subject Name DER from a cert (for use as a child's issuer). */
function subjectNameOf(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;
  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) idx = 1;
  const subjectNode = tbsCert.children[idx + 4]!;
  const start = subjectNode.offset + (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + subjectNode.totalLength);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCertPath', () => {
  it('builds an ordered 3-cert path leaf -> intermediate -> root (DN only)', async () => {
    const root = await generateCert('Root CA', { ca: true });
    const inter = await generateCert(
      'Intermediate CA',
      { ca: true },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const leaf = await generateCert(
      'Leaf',
      {},
      { name: 'Intermediate CA', subjectName: subjectNameOf(inter.certificate), keyPair: inter.keyPair },
    );

    const result = buildCertPath(
      leaf.certificate,
      [inter.certificate],
      [root.certificate],
    );

    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(2);
    expect(bytesEqual(result.path[0]!, leaf.certificate)).toBe(true);
    expect(bytesEqual(result.path[1]!, inter.certificate)).toBe(true);
    expect(result.anchor).toBeDefined();
    expect(bytesEqual(result.anchor!, root.certificate)).toBe(true);
  });

  it('matches via AKI->SKI when both extensions are present', async () => {
    const rootSki = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55]);
    const interSki = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee]);

    const root = await generateCert('Root CA', { ca: true, ski: rootSki });
    const inter = await generateCert(
      'Intermediate CA',
      { ca: true, ski: interSki, aki: rootSki },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const leaf = await generateCert(
      'Leaf',
      { aki: interSki },
      { name: 'Intermediate CA', subjectName: subjectNameOf(inter.certificate), keyPair: inter.keyPair },
    );

    const result = buildCertPath(
      leaf.certificate,
      [inter.certificate],
      [root.certificate],
    );

    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(2);
    expect(bytesEqual(result.path[1]!, inter.certificate)).toBe(true);
    expect(bytesEqual(result.anchor!, root.certificate)).toBe(true);
  });

  it('reports incomplete when the intermediate is missing', async () => {
    const root = await generateCert('Root CA', { ca: true });
    const inter = await generateCert(
      'Intermediate CA',
      { ca: true },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const leaf = await generateCert(
      'Leaf',
      {},
      { name: 'Intermediate CA', subjectName: subjectNameOf(inter.certificate), keyPair: inter.keyPair },
    );

    // intermediates omitted entirely
    const result = buildCertPath(leaf.certificate, [], [root.certificate]);

    expect(result.complete).toBe(false);
    expect(result.path).toHaveLength(1);
    expect(bytesEqual(result.path[0]!, leaf.certificate)).toBe(true);
    expect(result.anchor).toBeUndefined();
  });

  it('reports incomplete when no anchor matches (partial path through intermediate)', async () => {
    const root = await generateCert('Root CA', { ca: true });
    const inter = await generateCert(
      'Intermediate CA',
      { ca: true },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const leaf = await generateCert(
      'Leaf',
      {},
      { name: 'Intermediate CA', subjectName: subjectNameOf(inter.certificate), keyPair: inter.keyPair },
    );

    // intermediate available but root not a trust anchor
    const result = buildCertPath(leaf.certificate, [inter.certificate], []);

    expect(result.complete).toBe(false);
    // path includes leaf + intermediate, but no anchor found above it
    expect(result.path).toHaveLength(2);
    expect(bytesEqual(result.path[1]!, inter.certificate)).toBe(true);
    expect(result.anchor).toBeUndefined();
  });

  it('handles a self-signed leaf that is its own anchor', async () => {
    const selfSigned = await generateCert('Self-Signed Root', { ca: true });

    const result = buildCertPath(
      selfSigned.certificate,
      [],
      [selfSigned.certificate],
    );

    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(1);
    expect(bytesEqual(result.path[0]!, selfSigned.certificate)).toBe(true);
    expect(bytesEqual(result.anchor!, selfSigned.certificate)).toBe(true);
  });

  it('handles out-of-order and unrelated intermediates', async () => {
    const root = await generateCert('Root CA', { ca: true });
    const inter1 = await generateCert(
      'Intermediate 1',
      { ca: true },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const inter2 = await generateCert(
      'Intermediate 2',
      { ca: true },
      { name: 'Intermediate 1', subjectName: subjectNameOf(inter1.certificate), keyPair: inter1.keyPair },
    );
    const unrelated = await generateCert('Unrelated CA', { ca: true });
    const leaf = await generateCert(
      'Leaf',
      {},
      { name: 'Intermediate 2', subjectName: subjectNameOf(inter2.certificate), keyPair: inter2.keyPair },
    );

    const result = buildCertPath(
      leaf.certificate,
      [unrelated.certificate, inter2.certificate, inter1.certificate],
      [root.certificate],
    );

    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(3);
    expect(bytesEqual(result.path[0]!, leaf.certificate)).toBe(true);
    expect(bytesEqual(result.path[1]!, inter2.certificate)).toBe(true);
    expect(bytesEqual(result.path[2]!, inter1.certificate)).toBe(true);
    expect(bytesEqual(result.anchor!, root.certificate)).toBe(true);
  });

  it('stops at the first anchor even if intermediates could extend further', async () => {
    // anchor is the intermediate itself (cross-signed scenario):
    // trusting the intermediate directly should stop there.
    const root = await generateCert('Root CA', { ca: true });
    const inter = await generateCert(
      'Intermediate CA',
      { ca: true },
      { name: 'Root CA', subjectName: subjectNameOf(root.certificate), keyPair: root.keyPair },
    );
    const leaf = await generateCert(
      'Leaf',
      {},
      { name: 'Intermediate CA', subjectName: subjectNameOf(inter.certificate), keyPair: inter.keyPair },
    );

    const result = buildCertPath(
      leaf.certificate,
      [inter.certificate, root.certificate],
      [inter.certificate], // trust the intermediate directly
    );

    expect(result.complete).toBe(true);
    expect(result.path).toHaveLength(1); // just the leaf; intermediate is the anchor
    expect(bytesEqual(result.path[0]!, leaf.certificate)).toBe(true);
    expect(bytesEqual(result.anchor!, inter.certificate)).toBe(true);
  });

  it('guards against loops (cross-signed cert pair with no anchor)', async () => {
    // Two certs that each name the other as issuer by DN would loop;
    // ensure the builder terminates and reports incomplete.
    const a = await generateCert('A', { ca: true });
    const bSubject = buildName('B');
    void bSubject;
    // Build B issued by A, and a second A' issued by B (same DN 'A'),
    // so following issuer DNs A -> B -> A could cycle.
    const b = await generateCert(
      'B',
      { ca: true },
      { name: 'A', subjectName: subjectNameOf(a.certificate), keyPair: a.keyPair },
    );
    const aPrime = await generateCert(
      'A',
      { ca: true },
      { name: 'B', subjectName: subjectNameOf(b.certificate), keyPair: b.keyPair },
    );

    // No anchors; supply both so issuer-DN matching could revisit DN 'A'.
    const result = buildCertPath(
      b.certificate,
      [aPrime.certificate, a.certificate],
      [],
    );

    // Must terminate (no infinite loop) and not be complete.
    expect(result.complete).toBe(false);
    expect(result.path.length).toBeGreaterThanOrEqual(1);
  });
});

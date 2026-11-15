/**
 * Trust-anchor gate for the signature module: every check that decides
 * whether a signature, chain, revocation answer or timestamp is trusted fails
 * closed. Each group pairs its negative fixtures with a positive control, so a
 * broken fixture cannot pass vacuously.
 *
 * Fixtures are built in memory from fixed inputs (tests/helpers/
 * signature-trust-fixtures.ts); only the RSA-2048 keys are generated per run.
 * Network access is replaced by a stubbed `fetch`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimestampVerificationError } from '../../../src/errors.js';
import { prepareForSigning } from '../../../src/signature/pades/byteRange.js';
import { validateCertificateChain } from '../../../src/signature/pki/chainValidator.js';
import { verifySignatureDetailed } from '../../../src/signature/pades/detailedVerifier.js';
import { appendIncrementalUpdate } from '../../../src/signature/pades/incrementalSave.js';
import { detectModifications } from '../../../src/signature/pades/modificationDetector.js';
import { validateSignatureChain } from '../../../src/signature/pades/multiSignatureValidator.js';
import { checkCertificateStatus } from '../../../src/signature/pki/ocsp.js';
import { verifyOfflineRevocation } from '../../../src/signature/pki/offlineRevocation.js';
import { encodeInteger, encodeOID, encodeSequence } from '../../../src/signature/cms/pkcs7.js';
import { signPdf } from '../../../src/signature/pades/signatureHandler.js';
import { verifySignatures } from '../../../src/signature/pades/signatureVerifier.js';
import { parseTimestampResponse, requestTimestamp } from '../../../src/signature/cms/timestamp.js';
import {
  ascii,
  bodyBytes,
  buildMockBasicOcspResponse,
  buildMockOcspResponse,
  buildMockTimestampResponse,
  buildOcspBasicResponse,
  buildOcspResponse,
  buildTestCertificate,
  buildTestCrl,
  computeCertIdHashes,
  concatBytes,
  createMinimalPdf,
  generateIssuedCert,
  generateLeafCert,
  generateRootCA,
  generateTestCert,
  generateTestCertWithOcsp,
  indexOfBytes,
  readRequestNonce,
  toArrayBuffer,
} from '../../helpers/signature-trust-fixtures.js';
import type { MockBasicOcspOptions } from '../../helpers/signature-trust-fixtures.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

/** The first element of a result list; throws when the list is empty. */
function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('expected at least one result');
  return item;
}

/** Run `fn` and return what it throws (undefined when it returns). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

/** Stub `fetch` to answer every request with `body` (HTTP 200). */
function stubFetchWith(body: Uint8Array): void {
  vi.stubGlobal('fetch', async () => new Response(toArrayBuffer(body), { status: 200 }));
}

/** A PDF signed once by "Alice" (SHA-256), built once per run. */
let signedOnce: Promise<Uint8Array> | undefined;
function signedPdf(): Promise<Uint8Array> {
  signedOnce ??= (async () => {
    const { certificate, privateKey } = await generateTestCert('Alice');
    return signPdf(createMinimalPdf(), 'Sig1', {
      certificate,
      privateKey,
      hashAlgorithm: 'SHA-256',
    });
  })();
  return signedOnce;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1-2. A chain is valid only when anchored in trustedCerts
// ---------------------------------------------------------------------------

describe('chain anchoring', () => {
  it('1. rejects a chain that ends in an unlisted self-signed root with a trusted name', async () => {
    const real = await generateRootCA('Anchor Root');
    const evil = await generateRootCA('Anchor Root');
    const leaf = await generateLeafCert('Leaf', evil.certificate, evil.keyPair);

    const result = await validateCertificateChain([leaf, evil.certificate], {
      trustedCerts: [real.certificate],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Root certificate is not in trustedCerts');
    // The self-signature itself still verifies and is reported truthfully.
    expect(result.certificates[1]?.signatureValid).toBe(true);
  });

  it('2. rejects every chain ending in a self-signed root when no trustedCerts are given', async () => {
    const evil = await generateRootCA('Anchor Root');
    const leaf = await generateLeafCert('Leaf', evil.certificate, evil.keyPair);

    const result = await validateCertificateChain([leaf, evil.certificate]);

    expect(result.valid).toBe(false);
  });

  it('control: accepts a chain whose root is byte-equal to a trustedCerts entry', async () => {
    const real = await generateRootCA('Anchor Root');
    const goodLeaf = await generateLeafCert('Leaf', real.certificate, real.keyPair);

    const result = await validateCertificateChain([goodLeaf, real.certificate], {
      trustedCerts: [real.certificate],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3-4. An OCSP answer counts only when authenticated,
// matching the request CertID and fresh
// ---------------------------------------------------------------------------

describe('checkCertificateStatus authenticates the responder', () => {
  const ocspUrl = 'http://ocsp.invalid/';
  const victimSerial = Uint8Array.of(0x0a, 0x0b, 0x0c);

  async function setup(): Promise<{
    ca: { certificate: Uint8Array; keyPair: CryptoKeyPair };
    leaf: Uint8Array;
    hashes: { issuerNameHash: Uint8Array; issuerKeyHash: Uint8Array };
  }> {
    const ca = await generateTestCertWithOcsp(ocspUrl);
    const leaf = await generateIssuedCert(ca.certificate, ca.keyPair, 'Victim', victimSerial);
    return { ca, leaf, hashes: await computeCertIdHashes(ca.certificate) };
  }

  function freshWindow(): Pick<MockBasicOcspOptions, 'thisUpdate' | 'nextUpdate' | 'producedAt'> {
    const now = Date.now();
    return {
      thisUpdate: new Date(now - HOUR_MS),
      nextUpdate: new Date(now + HOUR_MS),
      producedAt: new Date(now - HOUR_MS),
    };
  }

  it('3. reports unknown for an unsigned answer with a correct CertID', async () => {
    const { ca, leaf, hashes } = await setup();
    const basic = await buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: victimSerial,
      ...freshWindow(),
      ...hashes,
    });
    stubFetchWith(buildMockOcspResponse(0, basic));

    const result = await checkCertificateStatus(leaf, ca.certificate, ocspUrl);

    expect(result.status).toBe('unknown');
    expect(result.unauthenticatedReason).toBeDefined();
  });

  it('4a. reports unknown for an issuer-signed answer outside thisUpdate/nextUpdate', async () => {
    const { ca, leaf, hashes } = await setup();
    const basic = await buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: victimSerial,
      thisUpdate: new Date(Date.UTC(2001, 0, 1)),
      nextUpdate: new Date(Date.UTC(2001, 0, 8)),
      producedAt: new Date(Date.UTC(2001, 0, 1)),
      ...hashes,
      sign: ca.keyPair.privateKey,
    });
    stubFetchWith(buildMockOcspResponse(0, basic));

    const result = await checkCertificateStatus(leaf, ca.certificate, ocspUrl);

    expect(result.status).toBe('unknown');
  });

  it('4b. reports unknown for an issuer-signed fresh answer about another serial', async () => {
    const { ca, leaf, hashes } = await setup();
    const basic = await buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: Uint8Array.of(0x0a, 0x0b, 0x0d),
      ...freshWindow(),
      ...hashes,
      sign: ca.keyPair.privateKey,
    });
    stubFetchWith(buildMockOcspResponse(0, basic));

    const result = await checkCertificateStatus(leaf, ca.certificate, ocspUrl);

    expect(result.status).toBe('unknown');
  });

  it('control: reports good for an issuer-signed, fresh, matching answer', async () => {
    const { ca, leaf, hashes } = await setup();
    const basic = await buildMockBasicOcspResponse({
      status: 'good',
      serialNumber: victimSerial,
      ...freshWindow(),
      ...hashes,
      sign: ca.keyPair.privateKey,
    });
    stubFetchWith(buildMockOcspResponse(0, basic));

    const result = await checkCertificateStatus(leaf, ca.certificate, ocspUrl);

    expect(result.status).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// 5-6. Embedded revocation data
// cannot be authenticated offline, so it never yields good or revoked
// ---------------------------------------------------------------------------

describe('verifyOfflineRevocation', () => {
  const serial = Uint8Array.of(0x01, 0x23, 0x45);
  const cert = buildTestCertificate(serial, 'Victim');

  it('5a. reports an embedded unsigned OCSP "good" as unknown', () => {
    const result = verifyOfflineRevocation(cert, {
      ocsps: [buildOcspResponse(buildOcspBasicResponse(serial, 0))],
      crls: [],
    });

    expect(result).toMatchObject({ checked: true, status: 'unknown', source: 'ocsp' });
    expect(result.details).toMatch(/not verified/);
  });

  it('5b. reports an embedded unsigned OCSP "revoked" as unknown', () => {
    const result = verifyOfflineRevocation(cert, {
      ocsps: [buildOcspResponse(buildOcspBasicResponse(serial, 1))],
      crls: [],
    });

    expect(result).toMatchObject({ checked: true, status: 'unknown', source: 'ocsp' });
    expect(result.details).toMatch(/not verified/);
  });

  it('6a. reports an embedded unsigned empty CRL as unknown', () => {
    const result = verifyOfflineRevocation(cert, { ocsps: [], crls: [buildTestCrl('Victim', [])] });

    expect(result).toMatchObject({ checked: true, status: 'unknown', source: 'crl' });
  });

  it('6b. reports an embedded unsigned CRL listing the serial as unknown', () => {
    const result = verifyOfflineRevocation(cert, {
      ocsps: [],
      crls: [buildTestCrl('Victim', [serial])],
    });

    expect(result).toMatchObject({ checked: true, status: 'unknown', source: 'crl' });
  });

  it('control: reports no-data when nothing is embedded', () => {
    const result = verifyOfflineRevocation(cert, { ocsps: [], crls: [] });

    expect(result).toMatchObject({ checked: false, status: 'no-data', source: 'none' });
  });
});

// ---------------------------------------------------------------------------
// 7. valid requires the
// ByteRange to cover the whole file except /Contents
// ---------------------------------------------------------------------------

describe('bytes after the signed range', () => {
  const appendedObject = ascii('\n5 0 obj\n<< /Evil true >>\nendobj\n');

  it('7a. verifySignatures marks a signature with appended bytes invalid', async () => {
    const appended = concatBytes(await signedPdf(), appendedObject);

    const result = first(await verifySignatures(appended));

    expect(result.integrityValid).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.coversWholeDocument).toBe(false);
  });

  it('7b. verifySignatureDetailed marks a signature with appended bytes invalid', async () => {
    const appended = concatBytes(await signedPdf(), appendedObject);

    const result = first(await verifySignatureDetailed(appended));

    expect(result.valid).toBe(false);
    expect(result.coversWholeDocument).toBe(false);
    expect(result.errors.some((e) => /does not cover the whole file/.test(e))).toBe(true);
  });

  it('control: a freshly signed file verifies as valid', async () => {
    const result = first(await verifySignatures(await signedPdf()));

    expect(result.valid).toBe(true);
  });

  it('control (new field): a freshly signed file covers the whole document', async () => {
    const result = first(await verifySignatures(await signedPdf()));

    expect(result.coversWholeDocument).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. The signer's own signingTime is not a verified timestamp
// ---------------------------------------------------------------------------

describe('signer-claimed signing time', () => {
  it('8. reports the signingTime attribute as an unverified timestamp', async () => {
    const result = first(await verifySignatureDetailed(await signedPdf()));

    expect(result.timestamp?.valid).toBe(false);
    expect(result.signingTime).toBeInstanceOf(Date);
    expect(result.signingTime?.getTime()).toBe(result.timestamp?.time.getTime());
    expect(result.warnings.some((w) => /claimed by the signer/.test(w))).toBe(true);
  });

  it('control: a signer-claimed time is present on a fresh signature', async () => {
    const result = first(await verifySignatureDetailed(await signedPdf()));

    expect(result.timestamp?.time).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// 9. A change carrying a signature key is not skipped
// ---------------------------------------------------------------------------

describe('changes behind a signature key', () => {
  const pageBody = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10]';

  it('9a. reports an unknown violation for a changed page that mentions /FT /Sig', async () => {
    const changed = concatBytes(
      await signedPdf(),
      ascii(`\n3 0 obj\n${pageBody} % /FT /Sig\n>>\nendobj\n`),
    );

    const report = await detectModifications(changed);

    expect(report.violations).toContainEqual(
      expect.objectContaining({ type: 'unknown', affectedSignatureIndex: 0 }),
    );
  });

  it('9b. a certified (P=1) document with such a change is not compliant', async () => {
    const { preparedPdf } = prepareForSigning(createMinimalPdf(), 'CertSig', 8192, undefined, 1);
    const changed = appendIncrementalUpdate(preparedPdf, [
      { objectNumber: 3, generationNumber: 0, data: ascii(`${pageBody} /Note (/FT /Sig) >>`) },
    ]);

    const report = await detectModifications(changed);

    expect(report.certificationLevel).toBe(1);
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toContainEqual(expect.objectContaining({ type: 'unknown' }));
  });

  it('control: the same page change without the key is content_changed', async () => {
    const changed = concatBytes(await signedPdf(), ascii(`\n3 0 obj\n${pageBody}\n>>\nendobj\n`));

    const report = await detectModifications(changed);

    expect(report.violations).toContainEqual(
      expect.objectContaining({ type: 'content_changed', affectedSignatureIndex: 0 }),
    );
  });

  it('control: the certified change without the key is content_changed and not compliant', async () => {
    const { preparedPdf } = prepareForSigning(createMinimalPdf(), 'CertSig', 8192, undefined, 1);
    const changed = appendIncrementalUpdate(preparedPdf, [
      { objectNumber: 3, generationNumber: 0, data: ascii(`${pageBody} >>`) },
    ]);

    const report = await detectModifications(changed);

    expect(report.certificationLevel).toBe(1);
    expect(report.isCompliant).toBe(false);
    expect(report.violations).toContainEqual(expect.objectContaining({ type: 'content_changed' }));
  });
});

// ---------------------------------------------------------------------------
// 10. The chain is valid only when every digest and CMS
// signature verifies
// ---------------------------------------------------------------------------

describe('validateSignatureChain checks the covered bytes', () => {
  it('10. reports a changed covered byte as an invalid chain', async () => {
    const tampered = (await signedPdf()).slice();
    const at = indexOfBytes(tampered, ascii('modern-pdf'));
    expect(at).toBeGreaterThan(0);
    tampered[at] = 0x4d; // 'm' -> 'M' inside the signed /Producer string

    const result = await validateSignatureChain(tampered);

    expect(result.isChainValid).toBe(false);
    expect(result.signatures[0]?.status).toBe('invalid');
    expect(result.errors.some((e) => /does not verify/.test(e))).toBe(true);
  });

  it('control: two real signatures form a valid chain', async () => {
    const k1 = await generateTestCert('First Signer');
    const k2 = await generateTestCert('Second Signer');
    const once = await signPdf(createMinimalPdf(), 'FirstSig', {
      certificate: k1.certificate,
      privateKey: k1.privateKey,
      hashAlgorithm: 'SHA-256',
    });
    const twice = await signPdf(once, 'SecondSig', {
      certificate: k2.certificate,
      privateKey: k2.privateKey,
      hashAlgorithm: 'SHA-256',
    });

    const result = await validateSignatureChain(twice);

    expect(result.isChainValid).toBe(true);
    expect(result.signatures.map((s) => s.status)).toEqual(['valid', 'valid']);
  });
});

// ---------------------------------------------------------------------------
// 11. An unparseable TSTInfo is an error, not "now"
// ---------------------------------------------------------------------------

describe('unparseable TSTInfo', () => {
  it('11. parseTimestampResponse throws TimestampVerificationError', () => {
    const tokenWithoutTstInfo = encodeSequence([
      encodeSequence([encodeInteger(Uint8Array.of(0))]),
      encodeSequence([encodeOID('1.2.840.113549.1.7.2')]),
    ]);

    const error = thrownBy(() => parseTimestampResponse(tokenWithoutTstInfo));

    expect(error).toBeInstanceOf(TimestampVerificationError);
    expect(error).toMatchObject({
      name: 'TimestampVerificationError',
      code: 'timestamp-unverified',
    });
    expect(error).toHaveProperty('message', expect.stringMatching(/^TSTInfo cannot be parsed: /));
  });

  it('control: a well-formed token parses to its genTime', () => {
    const genTime = new Date(Date.UTC(2020, 0, 1));

    const result = parseTimestampResponse(buildMockTimestampResponse(genTime));

    expect(result.signingTime.getTime()).toBe(genTime.getTime());
  });
});

// ---------------------------------------------------------------------------
// 12. The TSTInfo is bound to the requested hash and nonce
// ---------------------------------------------------------------------------

describe('messageImprint and nonce binding', () => {
  const genTime = new Date(Date.UTC(2020, 0, 1));
  const requestedHash = new Uint8Array(32).fill(0xab);
  const tsaUrl = 'http://tsa.invalid/';

  it('12a. parseTimestampResponse rejects a messageImprint that differs from the hash', () => {
    const resp = buildMockTimestampResponse(genTime); // imprint: 32 zero bytes

    const error = thrownBy(() => parseTimestampResponse(resp, { dataHash: requestedHash }));

    expect(error).toBeInstanceOf(TimestampVerificationError);
    expect(error).toHaveProperty('message', expect.stringMatching(/messageImprint/));
  });

  it('12b. parseTimestampResponse rejects a missing nonce when one is expected', () => {
    const resp = buildMockTimestampResponse(genTime); // no nonce

    const error = thrownBy(() =>
      parseTimestampResponse(resp, { nonce: Uint8Array.of(0x11, 0x22) }),
    );

    expect(error).toBeInstanceOf(TimestampVerificationError);
    expect(error).toHaveProperty('message', expect.stringMatching(/nonce/));
  });

  it('12c. parseTimestampResponse rejects a nonce that differs from the expected one', () => {
    const resp = buildMockTimestampResponse(genTime, { nonce: Uint8Array.of(0x11, 0x23) });

    const error = thrownBy(() =>
      parseTimestampResponse(resp, { nonce: Uint8Array.of(0x11, 0x22) }),
    );

    expect(error).toBeInstanceOf(TimestampVerificationError);
    expect(error).toHaveProperty('message', expect.stringMatching(/nonce/));
  });

  it('12d. requestTimestamp rejects an answer bound to another hash and no nonce', async () => {
    stubFetchWith(buildMockTimestampResponse(genTime));

    await expect(requestTimestamp(requestedHash, tsaUrl)).rejects.toBeInstanceOf(
      TimestampVerificationError,
    );
  });

  it('12e. parseTimestampResponse rejects the requested bytes under another hash algorithm', () => {
    const resp = buildMockTimestampResponse(genTime, {
      hashedMessage: requestedHash,
      hashAlgorithmOid: '1.3.14.3.2.26', // SHA-1
    });

    const error = thrownBy(() =>
      parseTimestampResponse(resp, { dataHash: requestedHash, hashAlgorithm: 'SHA-256' }),
    );

    expect(error).toBeInstanceOf(TimestampVerificationError);
    expect(error).toHaveProperty('message', expect.stringMatching(/messageImprint/));
  });

  it('12f. requestTimestamp rejects an echo of the hash and nonce under another algorithm', async () => {
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      const answer = buildMockTimestampResponse(genTime, {
        hashedMessage: requestedHash,
        nonce: readRequestNonce(bodyBytes(init?.body)),
        hashAlgorithmOid: '1.3.14.3.2.26', // SHA-1
      });
      return new Response(toArrayBuffer(answer), { status: 200 });
    });

    await expect(requestTimestamp(requestedHash, tsaUrl)).rejects.toBeInstanceOf(
      TimestampVerificationError,
    );
  });

  it('control: a matching hash and nonce parse to the genTime', () => {
    const nonce = Uint8Array.of(0x11, 0x22);
    const resp = buildMockTimestampResponse(genTime, { hashedMessage: requestedHash, nonce });

    const result = parseTimestampResponse(resp, { dataHash: requestedHash, nonce });

    expect(result.signingTime.getTime()).toBe(genTime.getTime());
  });

  it('control (new fields): a matching answer reports its hashedMessage and nonce', () => {
    const nonce = Uint8Array.of(0x11, 0x22);
    const resp = buildMockTimestampResponse(genTime, { hashedMessage: requestedHash, nonce });

    const result = parseTimestampResponse(resp, { dataHash: requestedHash, nonce });

    expect(result.hashedMessage).toEqual(requestedHash);
    expect(result.nonce).toEqual(nonce);
  });

  it('control: requestTimestamp resolves when the TSA echoes the hash and the sent nonce', async () => {
    let sentNonce: Uint8Array | undefined;
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentNonce = readRequestNonce(bodyBytes(init?.body));
      const answer = buildMockTimestampResponse(genTime, {
        hashedMessage: requestedHash,
        nonce: sentNonce,
      });
      return new Response(toArrayBuffer(answer), { status: 200 });
    });

    const result = await requestTimestamp(requestedHash, tsaUrl);

    expect(sentNonce).toBeDefined();
    expect(result.signingTime.getTime()).toBe(genTime.getTime());
  });
});

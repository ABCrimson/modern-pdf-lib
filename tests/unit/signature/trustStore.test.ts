/**
 * Tests for TrustStore.
 */

import { describe, it, expect } from 'vitest';
import { TrustStore } from '../../../src/signature/trustStore.js';
import type { TrustStoreOptions } from '../../../src/signature/trustStore.js';
import {
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeInteger,
  encodeUTCTime,
  encodeContextTag,
  encodeLength,
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
 * Build a Name with CN = value.
 */
function buildName(cn: string): Uint8Array {
  const encoder = new TextEncoder();
  const cnOid = encodeOID('2.5.4.3');
  const encoded = encoder.encode(cn);
  const cnValue = new Uint8Array([0x0c, ...encodeLength(encoded.length), ...encoded]);
  const atv = encodeSequence([cnOid, cnValue]);
  const rdn = encodeSet([atv]);
  return encodeSequence([rdn]);
}

/**
 * Build a minimal test certificate with a given serial and CN.
 */
function buildTestCert(
  serial: Uint8Array,
  subjectCn: string,
  issuerCn?: string,
): Uint8Array {
  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serialNumber = encodeInteger(serial);
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName(issuerCn ?? subjectCn);
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);
  const subject = buildName(subjectCn);

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrustStore', () => {
  it('should start empty', () => {
    const store = new TrustStore();
    expect(store.size).toBe(0);
  });

  it('should accept initial certificates via constructor', async () => {
    const cert = buildTestCert(new Uint8Array([0x01]), 'Root CA');
    const store = new TrustStore({ certificates: [cert] });

    // Wait for async init to complete
    const trusted = await store.isTrusted(cert);
    expect(trusted).toBe(true);
    expect(store.size).toBe(1);
  });

  it('should add a certificate', async () => {
    const store = new TrustStore();
    const cert = buildTestCert(new Uint8Array([0x01]), 'Test CA');

    await store.addCertificate(cert);
    expect(store.size).toBe(1);

    const trusted = await store.isTrusted(cert);
    expect(trusted).toBe(true);
  });

  it('should add multiple certificates', async () => {
    const store = new TrustStore();
    const cert1 = buildTestCert(new Uint8Array([0x01]), 'CA One');
    const cert2 = buildTestCert(new Uint8Array([0x02]), 'CA Two');

    await store.addCertificates([cert1, cert2]);
    expect(store.size).toBe(2);
  });

  it('should not add duplicate certificates', async () => {
    const store = new TrustStore();
    const cert = buildTestCert(new Uint8Array([0x01]), 'Test CA');

    await store.addCertificate(cert);
    await store.addCertificate(cert);
    expect(store.size).toBe(1);
  });

  it('should report untrusted certificates', async () => {
    const store = new TrustStore();
    const trustedCert = buildTestCert(new Uint8Array([0x01]), 'Trusted CA');
    const untrustedCert = buildTestCert(new Uint8Array([0x02]), 'Unknown CA');

    await store.addCertificate(trustedCert);

    expect(await store.isTrusted(trustedCert)).toBe(true);
    expect(await store.isTrusted(untrustedCert)).toBe(false);
  });

  it('should remove a certificate by serial number', async () => {
    const store = new TrustStore();
    const serial = new Uint8Array([0x42]);
    const cert = buildTestCert(serial, 'Test CA');

    await store.addCertificate(cert);
    expect(store.size).toBe(1);

    const removed = await store.removeCertificate(serial);
    expect(removed).toBe(true);
    expect(store.size).toBe(0);
    expect(await store.isTrusted(cert)).toBe(false);
  });

  it('should return false when removing a nonexistent certificate', async () => {
    const store = new TrustStore();
    const removed = await store.removeCertificate(new Uint8Array([0xff]));
    expect(removed).toBe(false);
  });

  it('should find the issuer certificate', async () => {
    const store = new TrustStore();
    const rootSerial = new Uint8Array([0x01]);
    const rootCert = buildTestCert(rootSerial, 'Root CA');
    await store.addCertificate(rootCert);

    // Build a leaf cert issued by "Root CA"
    const leafCert = buildTestCert(new Uint8Array([0x10]), 'Leaf Cert', 'Root CA');

    const issuer = await store.findIssuer(leafCert);
    expect(issuer).not.toBeNull();
    expect(issuer).toEqual(rootCert);
  });

  it('should return null when issuer is not in store', async () => {
    const store = new TrustStore();
    const cert = buildTestCert(new Uint8Array([0x01]), 'Leaf', 'Unknown CA');

    const issuer = await store.findIssuer(cert);
    expect(issuer).toBeNull();
  });

  it('should return all certificates', async () => {
    const store = new TrustStore();
    const cert1 = buildTestCert(new Uint8Array([0x01]), 'CA One');
    const cert2 = buildTestCert(new Uint8Array([0x02]), 'CA Two');

    await store.addCertificates([cert1, cert2]);

    const all = await store.getAllCertificates();
    expect(all.length).toBe(2);
  });

  it('should clear all certificates', async () => {
    const store = new TrustStore();
    const cert1 = buildTestCert(new Uint8Array([0x01]), 'CA One');
    const cert2 = buildTestCert(new Uint8Array([0x02]), 'CA Two');

    await store.addCertificates([cert1, cert2]);
    expect(store.size).toBe(2);

    await store.clear();
    expect(store.size).toBe(0);

    const all = await store.getAllCertificates();
    expect(all.length).toBe(0);
  });

  it('should handle certificates with same subject but different serials', async () => {
    const store = new TrustStore();
    const cert1 = buildTestCert(new Uint8Array([0x01]), 'Same CA');
    const cert2 = buildTestCert(new Uint8Array([0x02]), 'Same CA');

    await store.addCertificates([cert1, cert2]);
    expect(store.size).toBe(2);

    expect(await store.isTrusted(cert1)).toBe(true);
    expect(await store.isTrusted(cert2)).toBe(true);
  });
});

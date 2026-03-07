/**
 * Tests for delta CRL support (parsing, merging, detection).
 */

import { describe, it, expect } from 'vitest';
import {
  parseDeltaCrl,
  mergeCrls,
  isDeltaCrl,
} from '../../../src/signature/deltaCrl.js';
import type { DeltaCrlData } from '../../../src/signature/deltaCrl.js';
import type { CrlData } from '../../../src/signature/revocationCache.js';
import {
  encodeSequence,
  encodeOID,
  encodeOctetString,
  encodeContextTag,
  encodeInteger,
  encodeLength,
  encodeUTCTime,
  encodeSet,
} from '../../../src/signature/pkcs7.js';

// ---------------------------------------------------------------------------
// Helpers: build mock CRL structures
// ---------------------------------------------------------------------------

/**
 * Encode an ENUMERATED value.
 */
function encodeEnumerated(value: number): Uint8Array {
  return new Uint8Array([0x0a, 0x01, value]);
}

/**
 * Encode a small INTEGER value with tag.
 */
function encodeSmallInteger(value: number): Uint8Array {
  if (value < 0x80) {
    return new Uint8Array([0x02, 0x01, value]);
  }
  if (value < 0x8000) {
    return new Uint8Array([0x02, 0x02, (value >> 8) & 0xff, value & 0xff]);
  }
  return new Uint8Array([0x02, 0x03, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
}

/**
 * Encode a BIT STRING (for signature value).
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
 * Build a mock CRL extension.
 *
 * Extension ::= SEQUENCE {
 *   extnID OID,
 *   critical BOOLEAN DEFAULT FALSE,
 *   extnValue OCTET STRING
 * }
 */
function buildExtension(oid: string, value: Uint8Array, critical?: boolean): Uint8Array {
  const parts: Uint8Array[] = [encodeOID(oid)];
  if (critical) {
    parts.push(new Uint8Array([0x01, 0x01, 0xff])); // BOOLEAN TRUE
  }
  parts.push(encodeOctetString(value));
  return encodeSequence(parts);
}

/**
 * Build a mock TBSCertList.
 *
 * TBSCertList ::= SEQUENCE {
 *   version            INTEGER OPTIONAL,
 *   signature          AlgorithmIdentifier,
 *   issuer             Name,
 *   thisUpdate         Time,
 *   nextUpdate         Time OPTIONAL,
 *   revokedCerts       SEQUENCE OF SEQUENCE OPTIONAL,
 *   extensions     [0] EXPLICIT Extensions OPTIONAL
 * }
 */
function buildMockTbsCertList(options: {
  version?: number;
  issuerCN: string;
  thisUpdate: Date;
  nextUpdate?: Date;
  revokedSerials?: Array<{ serial: Uint8Array; date: Date; reason?: number }>;
  crlNumber?: number;
  deltaCrlIndicator?: number;
}): Uint8Array {
  const parts: Uint8Array[] = [];

  // version (v2 = 1)
  if (options.version !== undefined) {
    parts.push(encodeSmallInteger(options.version));
  }

  // signature AlgorithmIdentifier
  parts.push(encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'), // sha256WithRSA
    new Uint8Array([0x05, 0x00]),
  ]));

  // issuer Name
  parts.push(encodeSequence([
    encodeSet([
      encodeSequence([
        encodeOID('2.5.4.3'), // CN
        new Uint8Array([0x0c, options.issuerCN.length, ...new TextEncoder().encode(options.issuerCN)]),
      ]),
    ]),
  ]));

  // thisUpdate
  parts.push(encodeUTCTime(options.thisUpdate));

  // nextUpdate (optional)
  if (options.nextUpdate) {
    parts.push(encodeUTCTime(options.nextUpdate));
  }

  // revokedCertificates (optional)
  if (options.revokedSerials && options.revokedSerials.length > 0) {
    const entries = options.revokedSerials.map((entry) => {
      const entryParts: Uint8Array[] = [
        encodeInteger(entry.serial),
        encodeUTCTime(entry.date),
      ];

      if (entry.reason !== undefined) {
        // Extensions with CRL reason code
        const reasonExt = buildExtension(
          '2.5.29.21', // reasonCode OID
          encodeEnumerated(entry.reason),
        );
        entryParts.push(encodeSequence([reasonExt]));
      }

      return encodeSequence(entryParts);
    });
    parts.push(encodeSequence(entries));
  }

  // extensions [0] EXPLICIT
  const extensions: Uint8Array[] = [];
  if (options.crlNumber !== undefined) {
    extensions.push(
      buildExtension('2.5.29.20', encodeSmallInteger(options.crlNumber)),
    );
  }
  if (options.deltaCrlIndicator !== undefined) {
    extensions.push(
      buildExtension('2.5.29.27', encodeSmallInteger(options.deltaCrlIndicator), true),
    );
  }

  if (extensions.length > 0) {
    parts.push(encodeContextTag(0, encodeSequence(extensions)));
  }

  return encodeSequence(parts);
}

/**
 * Build a complete mock CRL.
 *
 * CertificateList ::= SEQUENCE {
 *   tbsCertList     TBSCertList,
 *   signatureAlgorithm  AlgorithmIdentifier,
 *   signatureValue  BIT STRING
 * }
 */
function buildMockCrl(tbsCertList: Uint8Array): Uint8Array {
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);

  // Fake signature (32 bytes of zeros)
  const fakeSignature = encodeBitString(new Uint8Array(32));

  return encodeSequence([tbsCertList, sigAlgo, fakeSignature]);
}

// ---------------------------------------------------------------------------
// Tests: isDeltaCrl
// ---------------------------------------------------------------------------

describe('isDeltaCrl', () => {
  it('should return true for a CRL with Delta CRL Indicator extension', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Test CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      crlNumber: 5,
      deltaCrlIndicator: 3,
    });
    const crl = buildMockCrl(tbs);

    expect(isDeltaCrl(crl)).toBe(true);
  });

  it('should return false for a base CRL (no Delta CRL Indicator)', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Test CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      crlNumber: 3,
    });
    const crl = buildMockCrl(tbs);

    expect(isDeltaCrl(crl)).toBe(false);
  });

  it('should return false for invalid/empty data', () => {
    expect(isDeltaCrl(new Uint8Array([]))).toBe(false);
    expect(isDeltaCrl(new Uint8Array([0xff, 0xff]))).toBe(false);
    expect(isDeltaCrl(new Uint8Array([0x30, 0x00]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseDeltaCrl
// ---------------------------------------------------------------------------

describe('parseDeltaCrl', () => {
  it('should parse a delta CRL with entries', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Delta CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 5)),
      nextUpdate: new Date(Date.UTC(2026, 2, 10)),
      revokedSerials: [
        { serial: new Uint8Array([0x01, 0x02]), date: new Date(Date.UTC(2026, 2, 4)) },
        { serial: new Uint8Array([0x03, 0x04]), date: new Date(Date.UTC(2026, 2, 5)), reason: 1 },
      ],
      crlNumber: 7,
      deltaCrlIndicator: 5,
    });
    const crl = buildMockCrl(tbs);
    const result = parseDeltaCrl(crl);

    expect(result.issuer).toBe('Delta CA');
    expect(result.deltaNumber).toBe(7);
    expect(result.baseIndicator).toBe(5);
    expect(result.entries).toHaveLength(2);
    expect(result.thisUpdate).toEqual(new Date(Date.UTC(2026, 2, 5)));
    expect(result.nextUpdate).toEqual(new Date(Date.UTC(2026, 2, 10)));
  });

  it('should parse a delta CRL with no entries', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Empty Delta',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      crlNumber: 10,
      deltaCrlIndicator: 9,
    });
    const crl = buildMockCrl(tbs);
    const result = parseDeltaCrl(crl);

    expect(result.entries).toHaveLength(0);
    expect(result.deltaNumber).toBe(10);
    expect(result.baseIndicator).toBe(9);
  });

  it('should throw for a non-delta CRL', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Base CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      crlNumber: 3,
    });
    const crl = buildMockCrl(tbs);

    expect(() => parseDeltaCrl(crl)).toThrow('Not a delta CRL');
  });

  it('should throw for invalid data', () => {
    expect(() => parseDeltaCrl(new Uint8Array([0x30, 0x00]))).toThrow();
  });

  it('should default deltaNumber to baseIndicator + 1 when no CRL Number', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'No CRL Num',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      deltaCrlIndicator: 42,
    });
    const crl = buildMockCrl(tbs);
    const result = parseDeltaCrl(crl);

    expect(result.baseIndicator).toBe(42);
    expect(result.deltaNumber).toBe(43);
  });

  it('should parse reason codes from revoked entries', () => {
    const tbs = buildMockTbsCertList({
      version: 1,
      issuerCN: 'Reason CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      revokedSerials: [
        { serial: new Uint8Array([0xab]), date: new Date(Date.UTC(2026, 1, 1)), reason: 1 },
      ],
      crlNumber: 2,
      deltaCrlIndicator: 1,
    });
    const crl = buildMockCrl(tbs);
    const result = parseDeltaCrl(crl);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.reason).toBe('keyCompromise');
  });
});

// ---------------------------------------------------------------------------
// Tests: mergeCrls
// ---------------------------------------------------------------------------

describe('mergeCrls', () => {
  function makeBaseCrl(): CrlData {
    return {
      issuer: 'Test CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      nextUpdate: new Date(Date.UTC(2026, 3, 1)),
      entries: [
        {
          serialNumber: new Uint8Array([0x01]),
          revocationDate: new Date(Date.UTC(2026, 1, 1)),
          reason: 'keyCompromise',
        },
        {
          serialNumber: new Uint8Array([0x02]),
          revocationDate: new Date(Date.UTC(2026, 1, 15)),
        },
      ],
    };
  }

  function makeDeltaCrl(overrides?: Partial<DeltaCrlData>): DeltaCrlData {
    return {
      issuer: 'Test CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 5)),
      nextUpdate: new Date(Date.UTC(2026, 3, 5)),
      entries: [],
      deltaNumber: 5,
      baseIndicator: 3,
      ...overrides,
    };
  }

  it('should merge with an empty delta (no changes)', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({ entries: [] });
    const merged = mergeCrls(base, delta);

    expect(merged.entries).toHaveLength(2);
    expect(merged.thisUpdate).toEqual(delta.thisUpdate);
  });

  it('should add new entries from the delta CRL', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({
      entries: [
        {
          serialNumber: new Uint8Array([0x03]),
          revocationDate: new Date(Date.UTC(2026, 2, 3)),
          reason: 'superseded',
        },
      ],
    });

    const merged = mergeCrls(base, delta);

    expect(merged.entries).toHaveLength(3);
    const newEntry = merged.entries.find(
      (e) => e.serialNumber.length === 1 && e.serialNumber[0] === 0x03,
    );
    expect(newEntry).toBeDefined();
    expect(newEntry!.reason).toBe('superseded');
  });

  it('should replace existing entries with delta entries', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({
      entries: [
        {
          serialNumber: new Uint8Array([0x01]),
          revocationDate: new Date(Date.UTC(2026, 2, 5)),
          reason: 'affiliationChanged',
        },
      ],
    });

    const merged = mergeCrls(base, delta);

    expect(merged.entries).toHaveLength(2);
    const updated = merged.entries.find(
      (e) => e.serialNumber.length === 1 && e.serialNumber[0] === 0x01,
    );
    expect(updated!.reason).toBe('affiliationChanged');
  });

  it('should remove entries with reason removeFromCRL', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({
      entries: [
        {
          serialNumber: new Uint8Array([0x01]),
          revocationDate: new Date(Date.UTC(2026, 2, 5)),
          reason: 'removeFromCRL',
        },
      ],
    });

    const merged = mergeCrls(base, delta);

    expect(merged.entries).toHaveLength(1);
    const removed = merged.entries.find(
      (e) => e.serialNumber.length === 1 && e.serialNumber[0] === 0x01,
    );
    expect(removed).toBeUndefined();
  });

  it('should use delta issuer and dates', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({
      issuer: 'Updated CA',
      thisUpdate: new Date(Date.UTC(2026, 4, 1)),
      nextUpdate: new Date(Date.UTC(2026, 5, 1)),
    });

    const merged = mergeCrls(base, delta);

    expect(merged.issuer).toBe('Updated CA');
    expect(merged.thisUpdate).toEqual(new Date(Date.UTC(2026, 4, 1)));
    expect(merged.nextUpdate).toEqual(new Date(Date.UTC(2026, 5, 1)));
  });

  it('should fall back to base nextUpdate if delta has none', () => {
    const base = makeBaseCrl();
    const delta = makeDeltaCrl({ nextUpdate: undefined });

    const merged = mergeCrls(base, delta);

    expect(merged.nextUpdate).toEqual(base.nextUpdate);
  });

  it('should handle multi-byte serial numbers correctly', () => {
    const base: CrlData = {
      issuer: 'CA',
      thisUpdate: new Date(Date.UTC(2026, 2, 1)),
      entries: [
        {
          serialNumber: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
          revocationDate: new Date(Date.UTC(2026, 1, 1)),
        },
      ],
    };

    const delta = makeDeltaCrl({
      entries: [
        {
          serialNumber: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
          revocationDate: new Date(Date.UTC(2026, 2, 5)),
          reason: 'removeFromCRL',
        },
      ],
    });

    const merged = mergeCrls(base, delta);
    expect(merged.entries).toHaveLength(0);
  });
});

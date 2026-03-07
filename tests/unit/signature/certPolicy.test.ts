/**
 * Tests for certificate policy validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateKeyUsage,
  validateExtendedKeyUsage,
  validateCertificatePolicy,
  EKU_OIDS,
} from '../../../src/signature/certPolicy.js';
import type {
  KeyUsageFlag,
} from '../../../src/signature/certPolicy.js';
import {
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
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
 * Encode a BIT STRING from raw data.
 */
function encodeBitString(data: Uint8Array): Uint8Array {
  const len = encodeLength(data.length + 1);
  const result = new Uint8Array(1 + len.length + 1 + data.length);
  result[0] = 0x03;
  result.set(len, 1);
  result[1 + len.length] = 0x00; // unused bits
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
 * Encode a BOOLEAN value.
 */
function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([0x01, 0x01, value ? 0xff : 0x00]);
}

/**
 * Build a Key Usage BIT STRING.
 * Bits: 0=digitalSignature, 1=nonRepudiation, 2=keyEncipherment,
 *       3=dataEncipherment, 4=keyAgreement, 5=keyCertSign, 6=crlSign
 */
function buildKeyUsageBitString(flags: KeyUsageFlag[]): Uint8Array {
  const bitMap: Record<KeyUsageFlag, number> = {
    digitalSignature: 0,
    nonRepudiation: 1,
    keyEncipherment: 2,
    dataEncipherment: 3,
    keyAgreement: 4,
    keyCertSign: 5,
    crlSign: 6,
  };

  let byte0 = 0;
  for (const flag of flags) {
    const bit = bitMap[flag];
    byte0 |= 0x80 >> bit;
  }

  // Count unused bits in the last byte
  let unusedBits = 0;
  if (byte0 === 0) {
    unusedBits = 8;
  } else {
    let mask = 1;
    while ((byte0 & mask) === 0) {
      unusedBits++;
      mask <<= 1;
    }
  }

  // BIT STRING: tag(03), length(02), unused-bits, data-byte
  return new Uint8Array([0x03, 0x02, unusedBits, byte0]);
}

/**
 * Build an Extended Key Usage extension value (SEQUENCE OF OID).
 */
function buildEkuValue(oids: string[]): Uint8Array {
  const encodedOids = oids.map((oid) => encodeOID(oid));
  return encodeSequence(encodedOids);
}

/**
 * Build a Basic Constraints extension value.
 */
function buildBasicConstraints(isCA: boolean, pathLen?: number): Uint8Array {
  const children: Uint8Array[] = [];
  if (isCA) {
    children.push(encodeBoolean(true));
  }
  if (pathLen !== undefined) {
    children.push(encodeSmallInteger(pathLen));
  }
  return encodeSequence(children);
}

/**
 * Build a single Extension SEQUENCE.
 * Extension ::= SEQUENCE { extnID OID, critical BOOLEAN OPTIONAL, extnValue OCTET STRING }
 */
function buildExtension(
  oid: string,
  value: Uint8Array,
  critical = false,
): Uint8Array {
  const children: Uint8Array[] = [encodeOID(oid)];
  if (critical) {
    children.push(encodeBoolean(true));
  }
  children.push(encodeOctetString(value));
  return encodeSequence(children);
}

/**
 * Build a test certificate with optional extensions.
 */
function buildCertWithExtensions(
  cn: string,
  extensions: Uint8Array[],
  options?: {
    notBefore?: Date;
    notAfter?: Date;
  },
): Uint8Array {
  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serial = encodeInteger(new Uint8Array([0x42]));
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName(cn);
  const notBefore = options?.notBefore ?? new Date();
  const notAfter =
    options?.notAfter ??
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(notBefore),
    encodeUTCTime(notAfter),
  ]);
  const subject = buildName(cn);
  const spki = encodeSequence([
    encodeSequence([
      encodeOID('1.2.840.113549.1.1.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
    encodeBitString(new Uint8Array(64)),
  ]);

  // Extensions [3] EXPLICIT SEQUENCE OF Extension
  const extSeq = encodeSequence(extensions);
  const extTag = encodeContextTag(3, extSeq);

  const tbsCert = encodeSequence([
    version,
    serial,
    sigAlgo,
    issuer,
    validity,
    subject,
    spki,
    extTag,
  ]);

  const sigBitString = encodeBitString(new Uint8Array(32));
  return encodeSequence([tbsCert, sigAlgo, sigBitString]);
}

/**
 * Build a test certificate without extensions.
 */
function buildCertWithoutExtensions(cn: string): Uint8Array {
  const version = encodeContextTag(0, encodeSmallInteger(2));
  const serial = encodeInteger(new Uint8Array([0x42]));
  const sigAlgo = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([0x05, 0x00]),
  ]);
  const issuer = buildName(cn);
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const validity = encodeSequence([
    encodeUTCTime(now),
    encodeUTCTime(later),
  ]);
  const subject = buildName(cn);
  const spki = encodeSequence([
    encodeSequence([
      encodeOID('1.2.840.113549.1.1.1'),
      new Uint8Array([0x05, 0x00]),
    ]),
    encodeBitString(new Uint8Array(64)),
  ]);

  const tbsCert = encodeSequence([
    version,
    serial,
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
// Tests: validateKeyUsage
// ---------------------------------------------------------------------------

describe('validateKeyUsage', () => {
  it('should return valid when no Key Usage extension is present', () => {
    const cert = buildCertWithoutExtensions('Test');
    const result = validateKeyUsage(cert, ['digitalSignature']);
    expect(result.valid).toBe(true);
    expect(result.presentFlags).toEqual([]);
    expect(result.missingFlags).toEqual([]);
  });

  it('should validate present key usage flags', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature', 'nonRepudiation']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Test', [kuExt]);

    const result = validateKeyUsage(cert, ['digitalSignature']);
    expect(result.valid).toBe(true);
    expect(result.presentFlags).toContain('digitalSignature');
    expect(result.presentFlags).toContain('nonRepudiation');
    expect(result.missingFlags).toEqual([]);
  });

  it('should detect missing key usage flags', () => {
    const kuBits = buildKeyUsageBitString(['keyEncipherment']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Test', [kuExt]);

    const result = validateKeyUsage(cert, ['digitalSignature']);
    expect(result.valid).toBe(false);
    expect(result.missingFlags).toContain('digitalSignature');
  });

  it('should validate multiple required flags', () => {
    const kuBits = buildKeyUsageBitString([
      'digitalSignature',
      'nonRepudiation',
      'keyCertSign',
    ]);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Test', [kuExt]);

    const result = validateKeyUsage(cert, [
      'digitalSignature',
      'nonRepudiation',
      'keyCertSign',
    ]);
    expect(result.valid).toBe(true);
    expect(result.missingFlags).toEqual([]);
  });

  it('should return empty required flags as valid', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Test', [kuExt]);

    const result = validateKeyUsage(cert, []);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateExtendedKeyUsage
// ---------------------------------------------------------------------------

describe('validateExtendedKeyUsage', () => {
  it('should return valid when no EKU extension is present', () => {
    const cert = buildCertWithoutExtensions('Test');
    const result = validateExtendedKeyUsage(cert, [EKU_OIDS.codeSigning]);
    expect(result.valid).toBe(true);
    expect(result.presentOids).toEqual([]);
  });

  it('should validate present EKU OIDs', () => {
    const ekuValue = buildEkuValue([EKU_OIDS.codeSigning, EKU_OIDS.emailProtection]);
    const ekuExt = buildExtension('2.5.29.37', ekuValue);
    const cert = buildCertWithExtensions('Test', [ekuExt]);

    const result = validateExtendedKeyUsage(cert, [EKU_OIDS.codeSigning]);
    expect(result.valid).toBe(true);
    expect(result.presentOids).toContain(EKU_OIDS.codeSigning);
    expect(result.missingOids).toEqual([]);
  });

  it('should detect missing EKU OIDs', () => {
    const ekuValue = buildEkuValue([EKU_OIDS.serverAuth]);
    const ekuExt = buildExtension('2.5.29.37', ekuValue);
    const cert = buildCertWithExtensions('Test', [ekuExt]);

    const result = validateExtendedKeyUsage(cert, [EKU_OIDS.codeSigning]);
    expect(result.valid).toBe(false);
    expect(result.missingOids).toContain(EKU_OIDS.codeSigning);
  });

  it('should accept anyExtendedKeyUsage as satisfying all requirements', () => {
    const ekuValue = buildEkuValue([EKU_OIDS.anyExtendedKeyUsage]);
    const ekuExt = buildExtension('2.5.29.37', ekuValue);
    const cert = buildCertWithExtensions('Test', [ekuExt]);

    const result = validateExtendedKeyUsage(cert, [
      EKU_OIDS.codeSigning,
      EKU_OIDS.emailProtection,
      EKU_OIDS.timeStamping,
    ]);
    expect(result.valid).toBe(true);
    expect(result.missingOids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateCertificatePolicy
// ---------------------------------------------------------------------------

describe('validateCertificatePolicy', () => {
  it('should pass for a valid signing certificate', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature', 'nonRepudiation']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Signer', [kuExt]);

    const result = validateCertificatePolicy(cert);
    expect(result.valid).toBe(true);
    expect(result.keyUsage.valid).toBe(true);
    expect(result.validityPeriod.valid).toBe(true);
    expect(result.isCA).toBe(false);
  });

  it('should fail for a certificate without digitalSignature', () => {
    const kuBits = buildKeyUsageBitString(['keyEncipherment']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Signer', [kuExt]);

    const result = validateCertificatePolicy(cert);
    expect(result.valid).toBe(false);
    expect(result.keyUsage.valid).toBe(false);
    expect(result.keyUsage.missingFlags).toContain('digitalSignature');
  });

  it('should require nonRepudiation when option is set', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const cert = buildCertWithExtensions('Signer', [kuExt]);

    const result = validateCertificatePolicy(cert, {
      requireNonRepudiation: true,
    });
    expect(result.valid).toBe(false);
    expect(result.keyUsage.missingFlags).toContain('nonRepudiation');
  });

  it('should detect expired certificates', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const pastDate = new Date(2020, 0, 1);
    const expiredDate = new Date(2021, 0, 1);
    const cert = buildCertWithExtensions('Signer', [kuExt], {
      notBefore: pastDate,
      notAfter: expiredDate,
    });

    const result = validateCertificatePolicy(cert);
    expect(result.valid).toBe(false);
    expect(result.validityPeriod.valid).toBe(false);
  });

  it('should allow expired certificates when allowExpired is set', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const pastDate = new Date(2020, 0, 1);
    const expiredDate = new Date(2021, 0, 1);
    const cert = buildCertWithExtensions('Signer', [kuExt], {
      notBefore: pastDate,
      notAfter: expiredDate,
    });

    const result = validateCertificatePolicy(cert, { allowExpired: true });
    expect(result.valid).toBe(true);
    expect(result.validityPeriod.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should detect CA certificates via Basic Constraints', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature', 'keyCertSign']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const bcValue = buildBasicConstraints(true, 0);
    const bcExt = buildExtension('2.5.29.19', bcValue, true);
    const cert = buildCertWithExtensions('Root CA', [kuExt, bcExt]);

    const result = validateCertificatePolicy(cert);
    expect(result.isCA).toBe(true);
    expect(result.warnings).toContain(
      'Certificate is a CA certificate; it should not be used directly for signing',
    );
  });

  it('should handle certificates without extensions', () => {
    const cert = buildCertWithoutExtensions('Simple');
    const result = validateCertificatePolicy(cert);
    expect(result.valid).toBe(true);
    expect(result.keyUsage.valid).toBe(true);
    expect(result.isCA).toBe(false);
  });

  it('should include EKU info when extension is present', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const ekuValue = buildEkuValue([EKU_OIDS.emailProtection]);
    const ekuExt = buildExtension('2.5.29.37', ekuValue);
    const cert = buildCertWithExtensions('Signer', [kuExt, ekuExt]);

    const result = validateCertificatePolicy(cert);
    expect(result.extendedKeyUsage).toBeDefined();
    expect(result.extendedKeyUsage!.presentOids).toContain(
      EKU_OIDS.emailProtection,
    );
  });

  it('should warn when no signing EKU is present', () => {
    const kuBits = buildKeyUsageBitString(['digitalSignature']);
    const kuExt = buildExtension('2.5.29.15', kuBits, true);
    const ekuValue = buildEkuValue([EKU_OIDS.serverAuth]);
    const ekuExt = buildExtension('2.5.29.37', ekuValue);
    const cert = buildCertWithExtensions('Signer', [kuExt, ekuExt]);

    const result = validateCertificatePolicy(cert);
    expect(result.warnings.some((w) => w.includes('document-signing EKU'))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: EKU_OIDS constants
// ---------------------------------------------------------------------------

describe('EKU_OIDS', () => {
  it('should contain well-known OIDs', () => {
    expect(EKU_OIDS.serverAuth).toBe('1.3.6.1.5.5.7.3.1');
    expect(EKU_OIDS.clientAuth).toBe('1.3.6.1.5.5.7.3.2');
    expect(EKU_OIDS.codeSigning).toBe('1.3.6.1.5.5.7.3.3');
    expect(EKU_OIDS.emailProtection).toBe('1.3.6.1.5.5.7.3.4');
    expect(EKU_OIDS.timeStamping).toBe('1.3.6.1.5.5.7.3.8');
    expect(EKU_OIDS.ocspSigning).toBe('1.3.6.1.5.5.7.3.9');
    expect(EKU_OIDS.anyExtendedKeyUsage).toBe('2.5.29.37.0');
  });
});

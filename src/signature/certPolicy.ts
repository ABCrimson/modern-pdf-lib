/**
 * @module signature/certPolicy
 *
 * Certificate policy validation for X.509 certificates.
 *
 * Validates key usage flags, extended key usage OIDs, validity periods,
 * and Basic Constraints. Uses the ASN.1 parsing utilities from pkcs7.ts
 * for DER decoding.
 *
 * References:
 * - RFC 5280 (Internet X.509 PKI Certificate and CRL Profile)
 * - RFC 5280 Section 4.2.1.3 (Key Usage)
 * - RFC 5280 Section 4.2.1.12 (Extended Key Usage)
 * - RFC 5280 Section 4.2.1.9 (Basic Constraints)
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  decodeOidBytes,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Key usage flags defined in RFC 5280 Section 4.2.1.3.
 *
 * The KeyUsage extension is a BIT STRING where each bit
 * corresponds to a specific usage:
 * - bit 0: digitalSignature
 * - bit 1: nonRepudiation (contentCommitment)
 * - bit 2: keyEncipherment
 * - bit 3: dataEncipherment
 * - bit 4: keyAgreement
 * - bit 5: keyCertSign
 * - bit 6: cRLSign
 */
export type KeyUsageFlag =
  | 'digitalSignature'
  | 'nonRepudiation'
  | 'keyEncipherment'
  | 'dataEncipherment'
  | 'keyAgreement'
  | 'keyCertSign'
  | 'crlSign';

/**
 * Result of validating key usage flags.
 */
export interface KeyUsageValidationResult {
  /** Whether all required key usage flags are present. */
  valid: boolean;
  /** Key usage flags that are present in the certificate. */
  presentFlags: KeyUsageFlag[];
  /** Required key usage flags that are missing. */
  missingFlags: KeyUsageFlag[];
}

/**
 * Result of validating extended key usage.
 */
export interface EkuValidationResult {
  /** Whether all required EKU OIDs are present. */
  valid: boolean;
  /** EKU OIDs present in the certificate. */
  presentOids: string[];
  /** Required EKU OIDs that are missing. */
  missingOids: string[];
}

/**
 * Options for comprehensive policy validation.
 */
export interface PolicyValidationOptions {
  /** Require the digitalSignature key usage flag. Default: true. */
  requireDigitalSignature?: boolean | undefined;
  /** Require the nonRepudiation key usage flag. Default: false. */
  requireNonRepudiation?: boolean | undefined;
  /** Allow expired certificates. Default: false. */
  allowExpired?: boolean | undefined;
}

/**
 * Comprehensive certificate policy validation result.
 */
export interface PolicyValidationResult {
  /** Whether the certificate passes all policy checks. */
  valid: boolean;
  /** Key usage validation result. */
  keyUsage: KeyUsageValidationResult;
  /** Extended key usage validation result (if EKU extension present). */
  extendedKeyUsage?: EkuValidationResult | undefined;
  /** Validity period check. */
  validityPeriod: {
    /** Whether the current time is within the certificate's validity period. */
    valid: boolean;
    /** Certificate validity start date. */
    notBefore: Date;
    /** Certificate validity end date. */
    notAfter: Date;
  };
  /** Whether the certificate is a CA (from Basic Constraints). */
  isCA: boolean;
  /** Non-fatal warnings. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Well-known EKU OIDs
// ---------------------------------------------------------------------------

/**
 * Well-known Extended Key Usage OIDs.
 */
export const EKU_OIDS = {
  /** id-kp-serverAuth (TLS server) */
  serverAuth: '1.3.6.1.5.5.7.3.1',
  /** id-kp-clientAuth (TLS client) */
  clientAuth: '1.3.6.1.5.5.7.3.2',
  /** id-kp-codeSigning */
  codeSigning: '1.3.6.1.5.5.7.3.3',
  /** id-kp-emailProtection (S/MIME) */
  emailProtection: '1.3.6.1.5.5.7.3.4',
  /** id-kp-timeStamping (RFC 3161 TSA) */
  timeStamping: '1.3.6.1.5.5.7.3.8',
  /** id-kp-OCSPSigning (OCSP responder) */
  ocspSigning: '1.3.6.1.5.5.7.3.9',
  /** Adobe authentic document (PDF signing) */
  adobeAuthenticDocument: '1.2.840.113583.1.1.5',
  /** Microsoft document signing */
  msDocumentSigning: '1.3.6.1.4.1.311.10.3.12',
  /** anyExtendedKeyUsage */
  anyExtendedKeyUsage: '2.5.29.37.0',
} as const;

// ---------------------------------------------------------------------------
// Extension OIDs
// ---------------------------------------------------------------------------

/** OID for Key Usage extension (2.5.29.15). */
const OID_KEY_USAGE = '2.5.29.15';

/** OID for Extended Key Usage extension (2.5.29.37). */
const OID_EXT_KEY_USAGE = '2.5.29.37';

/** OID for Basic Constraints extension (2.5.29.19). */
const OID_BASIC_CONSTRAINTS = '2.5.29.19';

// ---------------------------------------------------------------------------
// Key Usage bit positions
// ---------------------------------------------------------------------------

const KEY_USAGE_BITS: Record<KeyUsageFlag, number> = {
  digitalSignature: 0,
  nonRepudiation: 1,
  keyEncipherment: 2,
  dataEncipherment: 3,
  keyAgreement: 4,
  keyCertSign: 5,
  crlSign: 6,
};

const ALL_KEY_USAGE_FLAGS: KeyUsageFlag[] = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'crlSign',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the extensions from a DER-encoded X.509 certificate.
 *
 * Extensions are in tbsCertificate at position [3] EXPLICIT
 * (context tag 0xa3), containing a SEQUENCE OF Extension.
 */
function extractExtensions(certDer: Uint8Array): Asn1Node[] {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  // Extensions are the last element, tagged [3] (0xa3)
  for (const child of tbsCert.children) {
    if (child.tag === 0xa3) {
      // [3] EXPLICIT SEQUENCE OF Extension
      if (child.children.length > 0 && child.children[0]!.tag === 0x30) {
        return child.children[0]!.children;
      }
    }
  }

  return [];
}

/**
 * Find an extension by its OID in the list of extensions.
 *
 * Extension ::= SEQUENCE {
 *   extnID OID,
 *   critical BOOLEAN DEFAULT FALSE,
 *   extnValue OCTET STRING
 * }
 */
function findExtension(
  extensions: Asn1Node[],
  oid: string,
): Asn1Node | null {
  for (const ext of extensions) {
    if (ext.tag !== 0x30 || ext.children.length < 2) continue;

    const oidNode = ext.children[0]!;
    if (oidNode.tag !== 0x06) continue;

    if (decodeOidBytes(oidNode.data) === oid) {
      return ext;
    }
  }

  return null;
}

/**
 * Get the extnValue (OCTET STRING content) from an Extension node.
 * Handles both critical=TRUE and critical omitted (DEFAULT FALSE).
 */
function getExtensionValue(ext: Asn1Node): Uint8Array | null {
  // Extension ::= SEQUENCE { extnID, [critical], extnValue }
  // If critical is present (BOOLEAN), extnValue is at index 2
  // If critical is absent, extnValue is at index 1
  for (let i = 1; i < ext.children.length; i++) {
    const child = ext.children[i]!;
    if (child.tag === 0x04) {
      // OCTET STRING
      return child.data;
    }
  }
  return null;
}

/**
 * Parse the Key Usage BIT STRING value.
 *
 * KeyUsage ::= BIT STRING {
 *   digitalSignature (0),
 *   nonRepudiation   (1),
 *   keyEncipherment  (2),
 *   dataEncipherment (3),
 *   keyAgreement     (4),
 *   keyCertSign      (5),
 *   cRLSign          (6),
 *   encipherOnly     (7),
 *   decipherOnly     (8)
 * }
 */
function parseKeyUsageBits(bitStringData: Uint8Array): KeyUsageFlag[] {
  // BIT STRING: first byte is the unused-bits count
  const bitString = parseDerTlv(bitStringData, 0);
  if (bitString.tag !== 0x03 || bitString.data.length < 2) return [];

  const unusedBits = bitString.data[0]!;
  const flags: KeyUsageFlag[] = [];

  // Key usage bits are in the first (and possibly second) byte after unused-bits
  for (const [flag, bitPos] of Object.entries(KEY_USAGE_BITS)) {
    const byteIdx = Math.floor(bitPos / 8) + 1; // +1 for unused-bits byte
    if (byteIdx >= bitString.data.length) continue;

    const byte = bitString.data[byteIdx]!;
    // Bits are numbered from MSB: bit 0 = 0x80, bit 1 = 0x40, etc.
    const mask = 0x80 >> (bitPos % 8);

    if (byte & mask) {
      flags.push(flag as KeyUsageFlag);
    }
  }

  return flags;
}

/**
 * Parse Extended Key Usage OIDs.
 *
 * ExtKeyUsageSyntax ::= SEQUENCE SIZE (1..MAX) OF KeyPurposeId
 * KeyPurposeId ::= OID
 */
function parseExtendedKeyUsage(ekuData: Uint8Array): string[] {
  const seq = parseDerTlv(ekuData, 0);
  if (seq.tag !== 0x30) return [];

  const oids: string[] = [];
  for (const child of seq.children) {
    if (child.tag === 0x06) {
      oids.push(decodeOidBytes(child.data));
    }
  }

  return oids;
}

/**
 * Parse the Basic Constraints extension.
 *
 * BasicConstraints ::= SEQUENCE {
 *   cA BOOLEAN DEFAULT FALSE,
 *   pathLenConstraint INTEGER (0..MAX) OPTIONAL
 * }
 */
function parseBasicConstraints(bcData: Uint8Array): {
  isCA: boolean;
  pathLen?: number;
} {
  const seq = parseDerTlv(bcData, 0);
  if (seq.tag !== 0x30) return { isCA: false };

  let isCA = false;
  let pathLen: number | undefined;

  for (const child of seq.children) {
    if (child.tag === 0x01) {
      // BOOLEAN
      isCA = child.data.length > 0 && child.data[0] !== 0;
    } else if (child.tag === 0x02) {
      // INTEGER
      pathLen = 0;
      for (const byte of child.data) {
        pathLen = (pathLen << 8) | byte;
      }
    }
  }

  return { isCA, ...(pathLen !== undefined && { pathLen }) };
}

/**
 * Extract the validity period from a certificate.
 *
 * Validity ::= SEQUENCE {
 *   notBefore Time,
 *   notAfter  Time
 * }
 *
 * Time ::= CHOICE { utcTime UTCTime, generalTime GeneralizedTime }
 */
function extractValidityPeriod(certDer: Uint8Array): {
  notBefore: Date;
  notAfter: Date;
} {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1; // Skip version
  }

  // serialNumber (idx), signature (idx+1), issuer (idx+2), validity (idx+3)
  const validity = tbsCert.children[idx + 3]!;
  if (validity.tag !== 0x30 || validity.children.length < 2) {
    return { notBefore: new Date(0), notAfter: new Date(0) };
  }

  const notBefore = parseTime(validity.children[0]!);
  const notAfter = parseTime(validity.children[1]!);

  return { notBefore, notAfter };
}

/**
 * Parse an ASN.1 Time (UTCTime or GeneralizedTime) to a Date.
 */
function parseTime(node: Asn1Node): Date {
  const decoder = new TextDecoder('ascii');
  const timeStr = decoder.decode(node.data);

  if (node.tag === 0x17) {
    // UTCTime: YYMMDDHHmmSSZ
    return parseUtcTime(timeStr);
  }

  if (node.tag === 0x18) {
    // GeneralizedTime: YYYYMMDDHHmmSSZ
    return parseGeneralizedTime(timeStr);
  }

  return new Date(0);
}

/**
 * Parse a UTCTime string to a Date.
 */
function parseUtcTime(utcTime: string): Date {
  const clean = utcTime.replace('Z', '');
  const year = parseInt(clean.substring(0, 2), 10);
  const month = parseInt(clean.substring(2, 4), 10) - 1;
  const day = parseInt(clean.substring(4, 6), 10);
  const hours = parseInt(clean.substring(6, 8), 10);
  const minutes = parseInt(clean.substring(8, 10), 10);
  const seconds = parseInt(clean.substring(10, 12), 10);

  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Parse a GeneralizedTime string to a Date.
 */
function parseGeneralizedTime(genTime: string): Date {
  const clean = genTime.replace('Z', '');
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hours = parseInt(clean.substring(8, 10), 10);
  const minutes = parseInt(clean.substring(10, 12), 10);
  const seconds = parseInt(clean.substring(12, 14), 10);

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate that a certificate has the required key usage flags.
 *
 * Parses the Key Usage extension (OID 2.5.29.15) from the certificate
 * and checks that all required flags are present.
 *
 * If the certificate has no Key Usage extension, the result is
 * `valid: true` with empty presentFlags (per RFC 5280, the absence
 * of the extension means all usages are permitted).
 *
 * @param cert           DER-encoded X.509 certificate.
 * @param requiredUsage  Array of required key usage flags.
 * @returns              Validation result.
 */
export function validateKeyUsage(
  cert: Uint8Array,
  requiredUsage: KeyUsageFlag[],
): KeyUsageValidationResult {
  const extensions = extractExtensions(cert);
  const kuExt = findExtension(extensions, OID_KEY_USAGE);

  if (!kuExt) {
    // No Key Usage extension — all usages are implicitly allowed
    return {
      valid: true,
      presentFlags: [],
      missingFlags: [],
    };
  }

  const kuValue = getExtensionValue(kuExt);
  if (!kuValue) {
    return {
      valid: true,
      presentFlags: [],
      missingFlags: [],
    };
  }

  const presentFlags = parseKeyUsageBits(kuValue);
  const missingFlags = requiredUsage.filter(
    (flag) => !presentFlags.includes(flag),
  );

  return {
    valid: missingFlags.length === 0,
    presentFlags,
    missingFlags,
  };
}

/**
 * Validate that a certificate has the required extended key usage OIDs.
 *
 * Parses the Extended Key Usage extension (OID 2.5.29.37) and checks
 * that all required EKU OIDs are present.
 *
 * If the certificate has no EKU extension, the result is `valid: true`
 * (per RFC 5280, absence means all extended usages are permitted).
 *
 * The anyExtendedKeyUsage OID (2.5.29.37.0) satisfies all requirements.
 *
 * @param cert         DER-encoded X.509 certificate.
 * @param requiredEku  Array of required EKU OIDs (dotted-decimal).
 * @returns            Validation result.
 */
export function validateExtendedKeyUsage(
  cert: Uint8Array,
  requiredEku: string[],
): EkuValidationResult {
  const extensions = extractExtensions(cert);
  const ekuExt = findExtension(extensions, OID_EXT_KEY_USAGE);

  if (!ekuExt) {
    return {
      valid: true,
      presentOids: [],
      missingOids: [],
    };
  }

  const ekuValue = getExtensionValue(ekuExt);
  if (!ekuValue) {
    return {
      valid: true,
      presentOids: [],
      missingOids: [],
    };
  }

  const presentOids = parseExtendedKeyUsage(ekuValue);

  // anyExtendedKeyUsage satisfies all requirements
  if (presentOids.includes(EKU_OIDS.anyExtendedKeyUsage)) {
    return {
      valid: true,
      presentOids,
      missingOids: [],
    };
  }

  const missingOids = requiredEku.filter(
    (oid) => !presentOids.includes(oid),
  );

  return {
    valid: missingOids.length === 0,
    presentOids,
    missingOids,
  };
}

/**
 * Perform comprehensive certificate policy validation.
 *
 * Checks:
 * 1. Key usage flags (digitalSignature and/or nonRepudiation)
 * 2. Extended key usage (if present)
 * 3. Validity period (notBefore/notAfter)
 * 4. Basic Constraints (CA flag)
 *
 * @param cert     DER-encoded X.509 certificate.
 * @param options  Validation options.
 * @returns        Comprehensive validation result.
 */
export function validateCertificatePolicy(
  cert: Uint8Array,
  options?: PolicyValidationOptions,
): PolicyValidationResult {
  const opts: Required<PolicyValidationOptions> = {
    requireDigitalSignature: options?.requireDigitalSignature ?? true,
    requireNonRepudiation: options?.requireNonRepudiation ?? false,
    allowExpired: options?.allowExpired ?? false,
  };

  const warnings: string[] = [];
  let overallValid = true;

  // 1. Key Usage validation
  const requiredFlags: KeyUsageFlag[] = [];
  if (opts.requireDigitalSignature) requiredFlags.push('digitalSignature');
  if (opts.requireNonRepudiation) requiredFlags.push('nonRepudiation');

  const keyUsage = validateKeyUsage(cert, requiredFlags);
  if (!keyUsage.valid) {
    overallValid = false;
  }

  // 2. Extended Key Usage (check if present, report but don't fail)
  const extensions = extractExtensions(cert);
  const ekuExt = findExtension(extensions, OID_EXT_KEY_USAGE);
  let extendedKeyUsage: EkuValidationResult | undefined;

  if (ekuExt) {
    const ekuValue = getExtensionValue(ekuExt);
    if (ekuValue) {
      const presentOids = parseExtendedKeyUsage(ekuValue);
      extendedKeyUsage = {
        valid: true,
        presentOids,
        missingOids: [],
      };

      // Warn if no signing-related EKU is present
      const signingEkus = [
        EKU_OIDS.codeSigning,
        EKU_OIDS.emailProtection,
        EKU_OIDS.adobeAuthenticDocument,
        EKU_OIDS.msDocumentSigning,
        EKU_OIDS.anyExtendedKeyUsage,
      ];
      const hasSigningEku = presentOids.some((oid) =>
        (signingEkus as string[]).includes(oid),
      );
      if (!hasSigningEku) {
        warnings.push(
          'Certificate does not have a document-signing EKU; ' +
          'it may not be intended for PDF signing',
        );
      }
    }
  }

  // 3. Validity period
  const { notBefore, notAfter } = extractValidityPeriod(cert);
  const now = new Date();
  const periodValid = now >= notBefore && now <= notAfter;

  if (!periodValid && !opts.allowExpired) {
    overallValid = false;
  }
  if (!periodValid && opts.allowExpired) {
    warnings.push(
      'Certificate has expired or is not yet valid, but allowExpired is set',
    );
  }

  // 4. Basic Constraints
  let isCA = false;
  const bcExt = findExtension(extensions, OID_BASIC_CONSTRAINTS);
  if (bcExt) {
    const bcValue = getExtensionValue(bcExt);
    if (bcValue) {
      const bc = parseBasicConstraints(bcValue);
      isCA = bc.isCA;
    }
  }

  if (isCA) {
    warnings.push(
      'Certificate is a CA certificate; it should not be used directly for signing',
    );
  }

  return {
    valid: overallValid,
    keyUsage,
    extendedKeyUsage,
    validityPeriod: {
      valid: periodValid,
      notBefore,
      notAfter,
    },
    isCA,
    warnings,
  };
}

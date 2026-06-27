/**
 * @module signature/cadesAttributes
 *
 * CAdES-BES / PAdES-B-B baseline signed attributes.
 *
 * Implements the ESS `signing-certificate-v2` attribute that binds a
 * signature to the exact signer certificate that produced it, defeating
 * certificate-substitution attacks.  This is the mandatory signed
 * attribute for the CAdES-BES and PAdES-B-B (a.k.a. PAdES Baseline)
 * conformance levels.
 *
 * Structure (RFC 5035 §3, "ESS Update: Adding CertID Algorithm Agility"):
 * ```
 * id-aa-signingCertificateV2 OBJECT IDENTIFIER ::= { iso(1)
 *     member-body(2) us(840) rsadsi(113549) pkcs(1) pkcs9(9)
 *     smime(16) id-aa(2) 47 }                       -- 1.2.840.113549.1.9.16.2.47
 *
 * Attribute ::= SEQUENCE {
 *   attrType   OBJECT IDENTIFIER,                   -- id-aa-signingCertificateV2
 *   attrValues SET OF SigningCertificateV2 }
 *
 * SigningCertificateV2 ::= SEQUENCE {
 *   certs    SEQUENCE OF ESSCertIDv2,
 *   policies SEQUENCE OF PolicyInformation OPTIONAL }  -- omitted here
 *
 * ESSCertIDv2 ::= SEQUENCE {
 *   hashAlgorithm AlgorithmIdentifier DEFAULT {algorithm id-sha256},
 *   certHash      Hash,                              -- OCTET STRING
 *   issuerSerial  IssuerSerial OPTIONAL }            -- omitted here
 *
 * Hash ::= OCTET STRING
 * ```
 *
 * Because `hashAlgorithm` carries `DEFAULT {algorithm id-sha256}`, DER
 * (X.690 §11.5) requires the field to be **omitted** when the hash is
 * SHA-256, and **present** for any other algorithm (e.g. SHA-384,
 * SHA-512).  `certHash` is the digest of the WHOLE DER certificate.
 *
 * References:
 * - RFC 5035 (Enhanced Security Services (ESS) Update — signing-certificate-v2)
 * - ETSI EN 319 122-1 (CAdES baseline) — requires id-aa-signingCertificateV2
 * - ETSI EN 319 142-1 (PAdES baseline) — PAdES-B-B uses the same attribute
 *
 * Every OID and ASN.1 element here was verified against RFC 5035.
 *
 * @packageDocumentation
 */

import {
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  parseDerTlv,
  decodeOidBytes,
  getSubtle,
  toBuffer,
} from './pkcs7.js';

// ---------------------------------------------------------------------------
// OIDs (verified against RFC 5035 and NIST CSOR)
// ---------------------------------------------------------------------------

/** id-aa-signingCertificateV2 — RFC 5035 §3. */
const ID_AA_SIGNING_CERTIFICATE_V2 = '1.2.840.113549.1.9.16.2.47';

/** Hash algorithm OIDs (NIST CSOR; same values used throughout pkcs7.ts). */
const SHA256_OID = '2.16.840.1.101.3.4.2.1';
const SHA384_OID = '2.16.840.1.101.3.4.2.2';
const SHA512_OID = '2.16.840.1.101.3.4.2.3';

/** DER literal for an explicit NULL value (tag 0x05, length 0). */
const DER_NULL = new Uint8Array([0x05, 0x00]);

// ---------------------------------------------------------------------------
// Internal encoding helpers
// ---------------------------------------------------------------------------

/**
 * Encode an AlgorithmIdentifier SEQUENCE for a SHA-2 hash with NULL
 * parameters: `SEQUENCE { OID, NULL }`.
 *
 * RFC 5035's ESSCertIDv2 uses the same AlgorithmIdentifier as the rest
 * of the CMS structure; SHA-2 digest algorithms carry NULL parameters
 * (RFC 5754 permits either NULL or absent — we emit NULL to match the
 * digestAlgorithm encoding already used by pkcs7.ts).
 */
function encodeHashAlgorithmIdentifier(hashOid: string): Uint8Array {
  return encodeSequence([encodeOID(hashOid), DER_NULL]);
}

/** Map a Web Crypto hash name to its OID. */
function hashNameToOid(hash: 'SHA-256' | 'SHA-384' | 'SHA-512'): string {
  switch (hash) {
    case 'SHA-256': return SHA256_OID;
    case 'SHA-384': return SHA384_OID;
    case 'SHA-512': return SHA512_OID;
    default: {
      // Exhaustiveness guard — unreachable given the parameter type.
      const never: never = hash;
      throw new Error(`Unsupported hash algorithm: ${String(never)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the ESS `signing-certificate-v2` signed attribute (RFC 5035).
 *
 * The returned bytes are a complete DER-encoded `Attribute` SEQUENCE
 * suitable for insertion into the CMS `SignedAttributes` SET.
 *
 * Encoding rules applied (verified against RFC 5035):
 * - `hashAlgorithm` is OMITTED when `hashAlgorithm === 'SHA-256'` (the
 *   `DEFAULT {algorithm id-sha256}`), and INCLUDED for SHA-384/SHA-512.
 * - `certHash` is `subtle.digest(hashAlgorithm, <whole DER cert>)`.
 * - `issuerSerial` and `policies` are OPTIONAL and omitted.
 *
 * @param certDer        The DER-encoded X.509 signer certificate.
 * @param hashAlgorithm  The digest used for `certHash`.
 * @returns              DER-encoded `Attribute` SEQUENCE.
 */
export async function buildSigningCertificateV2Attribute(
  certDer: Uint8Array,
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512',
): Promise<Uint8Array> {
  const subtle = getSubtle();

  // certHash = digest over the COMPLETE DER certificate.
  const digestBuffer = await subtle.digest(hashAlgorithm, toBuffer(certDer));
  const certHash = new Uint8Array(digestBuffer);

  // ESSCertIDv2 ::= SEQUENCE { [hashAlgorithm] , certHash, [issuerSerial] }
  const essCertIdParts: Uint8Array[] = [];
  if (hashAlgorithm !== 'SHA-256') {
    // Non-default algorithm: include the AlgorithmIdentifier.
    essCertIdParts.push(encodeHashAlgorithmIdentifier(hashNameToOid(hashAlgorithm)));
  }
  essCertIdParts.push(encodeOctetString(certHash));
  const essCertIdV2 = encodeSequence(essCertIdParts);

  // SigningCertificateV2 ::= SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }
  const certsSeqOf = encodeSequence([essCertIdV2]);
  const signingCertificateV2 = encodeSequence([certsSeqOf]);

  // Attribute ::= SEQUENCE { attrType OID, attrValues SET OF SigningCertificateV2 }
  return encodeSequence([
    encodeOID(ID_AA_SIGNING_CERTIFICATE_V2),
    encodeSet([signingCertificateV2]),
  ]);
}

/**
 * Best-effort DER scan for the `signing-certificate-v2` attribute inside
 * an encoded `SignedAttributes` SET (or any SET/SEQUENCE OF Attribute).
 *
 * When found, the embedded `certHash` OCTET STRING is returned so callers
 * can compare it against the signer certificate's digest.
 *
 * This walks: SET -> Attribute SEQUENCE { OID, SET { SigningCertificateV2
 * SEQUENCE { certs SEQUENCE OF { ESSCertIDv2 SEQUENCE { [algId], certHash } } } } }.
 *
 * @param signedAttrsDer  DER bytes of a SET (or constructed container) of Attributes.
 * @returns               `{ present, certHash? }`.
 */
export function extractSigningCertificateV2(
  signedAttrsDer: Uint8Array,
): { present: boolean; certHash?: Uint8Array | undefined } {
  try {
    const container = parseDerTlv(signedAttrsDer, 0);

    for (const attr of container.children) {
      // Each Attribute is a SEQUENCE { OID, SET OF value }.
      if (attr.tag !== 0x30 || attr.children.length < 2) continue;

      const oidNode = attr.children[0]!;
      if (oidNode.tag !== 0x06) continue;
      if (decodeOidBytes(oidNode.data) !== ID_AA_SIGNING_CERTIFICATE_V2) continue;

      // attrValues SET OF SigningCertificateV2
      const valueSet = attr.children[1]!;
      const signingCertV2 = valueSet.children[0];
      if (!signingCertV2) return { present: true, certHash: undefined };

      // SigningCertificateV2 SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }
      const certsSeqOf = signingCertV2.children[0];
      if (!certsSeqOf) return { present: true, certHash: undefined };

      const essCertId = certsSeqOf.children[0];
      if (!essCertId) return { present: true, certHash: undefined };

      // ESSCertIDv2 SEQUENCE { [hashAlgorithm], certHash, [issuerSerial] }.
      // The certHash is the first OCTET STRING child (after an optional
      // AlgorithmIdentifier SEQUENCE when the hash is non-default).
      for (const child of essCertId.children) {
        if (child.tag === 0x04) {
          return { present: true, certHash: child.data };
        }
      }
      return { present: true, certHash: undefined };
    }
  } catch {
    // Fall through to "not present" on any parse error.
  }

  return { present: false, certHash: undefined };
}

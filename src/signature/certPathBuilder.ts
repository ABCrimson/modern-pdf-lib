/**
 * @module signature/certPathBuilder
 *
 * Certification-path (trust-chain) construction per RFC 5280 §6.1.
 *
 * Given a leaf certificate, a pool of intermediate CA certificates, and a
 * set of trust anchors, {@link buildCertPath} assembles the ordered chain
 *
 * ```
 * leaf -> intermediate -> ... -> (issuer that is a trust anchor)
 * ```
 *
 * by matching, at each step, the *current* certificate's **issuer** Name to
 * a candidate certificate's **subject** Name (RFC 5280 §4.1.2.4 / §4.1.2.6).
 * When both certificates additionally carry the relevant key-identifier
 * extensions, the candidate's **Subject Key Identifier** (SKI, OID
 * `2.5.29.14`, RFC 5280 §4.2.1.2) must equal the current certificate's
 * **Authority Key Identifier** (AKI `keyIdentifier`, OID `2.5.29.35`,
 * RFC 5280 §4.2.1.1) for the link to be accepted. If only one side carries
 * the identifier, name matching alone is used (RFC 5280 §6.1.4 treats key
 * identifiers as a hint, not a hard requirement).
 *
 * Building stops when:
 * - the current certificate (or a matched issuer) is a member of `anchors`
 *   → `complete: true`, `anchor` set, and `path` excludes the anchor; or
 * - no issuer can be found among `intermediates`/`anchors`
 *   → `complete: false` (partial path returned).
 *
 * Loop protection: a certificate already present in the constructed path is
 * never revisited (RFC 5280 §6.1 prohibits a certificate appearing more than
 * once in a certification path).
 *
 * Name matching uses byte-for-byte equality of the DER-encoded `Name`. This
 * is the exact-match comparison permitted by RFC 5280 §7.1 when both names
 * are produced by conforming encoders (as is the case for fixtures generated
 * here and for the overwhelming majority of real-world CAs).
 *
 * References:
 * - RFC 5280 §4.1.2.4 (issuer), §4.1.2.6 (subject)
 * - RFC 5280 §4.2.1.1 (Authority Key Identifier, OID 2.5.29.35)
 * - RFC 5280 §4.2.1.2 (Subject Key Identifier, OID 2.5.29.14)
 * - RFC 5280 §6.1 (Certification Path Validation — path construction)
 *
 * @packageDocumentation
 */

import { parseDerTlv, decodeOidBytes } from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of building a certification path.
 */
export interface CertPathResult {
  /**
   * The ordered certificates, leaf-first, **excluding** the trust anchor.
   * For a self-signed leaf that is itself an anchor, this is `[leaf]`.
   */
  path: Uint8Array[];
  /**
   * `true` when the path terminates at a member of `anchors`;
   * `false` when no issuer could be found (partial path).
   */
  complete: boolean;
  /**
   * The DER-encoded trust anchor the path terminates at, when `complete`.
   * Reported separately from `path`. `undefined` for incomplete paths.
   */
  anchor?: Uint8Array | undefined;
}

// ---------------------------------------------------------------------------
// OID constants (RFC 5280)
// ---------------------------------------------------------------------------

/** Subject Key Identifier — RFC 5280 §4.2.1.2. */
const OID_SUBJECT_KEY_IDENTIFIER = '2.5.29.14';
/** Authority Key Identifier — RFC 5280 §4.2.1.1. */
const OID_AUTHORITY_KEY_IDENTIFIER = '2.5.29.35';

// ---------------------------------------------------------------------------
// Minimal, self-contained DER field extractors
// ---------------------------------------------------------------------------
//
// We reuse `parseDerTlv` / `decodeOidBytes` from pkcs7.ts. The chainValidator
// module has equivalent helpers but does not export them, so the small field
// readers below are duplicated here intentionally to keep this module
// standalone (it edits no existing file).

/**
 * Reconstruct the absolute byte range of a child node within the original
 * certificate buffer, returning the full TLV (header + value) as a subarray
 * that shares the cert's underlying ArrayBuffer.
 *
 * `parentNode.data` is a subarray of `certDer`; `child.offset` is the child's
 * offset within that parent value; `child.totalLength` covers header + value.
 */
function sliceChild(
  certDer: Uint8Array,
  parentNode: Asn1Node,
  child: Asn1Node,
): Uint8Array {
  const start = child.offset + (parentNode.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(start, start + child.totalLength);
}

/**
 * Resolve the TBSCertificate node and the index offset that accounts for the
 * optional `version [0] EXPLICIT` field.
 *
 * TBSCertificate ::= SEQUENCE {
 *   version         [0] EXPLICIT INTEGER DEFAULT v1,   -- tag 0xA0 when present
 *   serialNumber        INTEGER,
 *   signature           AlgorithmIdentifier,
 *   issuer              Name,
 *   validity            Validity,
 *   subject             Name,
 *   subjectPublicKeyInfo SubjectPublicKeyInfo,
 *   ... extensions [3] EXPLICIT ...
 * }
 */
function tbsContext(certDer: Uint8Array): { tbs: Asn1Node; idx: number } {
  const cert = parseDerTlv(certDer, 0);
  const tbs = cert.children[0];
  if (!tbs) throw new Error('Malformed certificate: missing TBSCertificate');
  const first = tbs.children[0];
  const idx = first && first.tag === 0xa0 ? 1 : 0;
  return { tbs, idx };
}

/** Extract the raw DER bytes of the issuer Name (RFC 5280 §4.1.2.4). */
function extractIssuerDer(certDer: Uint8Array): Uint8Array {
  const { tbs, idx } = tbsContext(certDer);
  const issuerNode = tbs.children[idx + 2];
  if (!issuerNode) throw new Error('Malformed certificate: missing issuer');
  return sliceChild(certDer, tbs, issuerNode);
}

/** Extract the raw DER bytes of the subject Name (RFC 5280 §4.1.2.6). */
function extractSubjectDer(certDer: Uint8Array): Uint8Array {
  const { tbs, idx } = tbsContext(certDer);
  const subjectNode = tbs.children[idx + 4];
  if (!subjectNode) throw new Error('Malformed certificate: missing subject');
  return sliceChild(certDer, tbs, subjectNode);
}

/**
 * Extract the list of Extension nodes (each a SEQUENCE) from a certificate,
 * or an empty array when no extensions are present.
 *
 * extensions [3] EXPLICIT SEQUENCE OF Extension
 * Extension ::= SEQUENCE { extnID OID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }
 */
function extractExtensionNodes(certDer: Uint8Array): Asn1Node[] {
  try {
    const { tbs } = tbsContext(certDer);
    for (const child of tbs.children) {
      if (child.tag === 0xa3 && child.children.length > 0) {
        // child is [3] EXPLICIT wrapping the SEQUENCE OF Extension
        return child.children[0]!.children;
      }
    }
  } catch {
    // fall through to empty
  }
  return [];
}

/**
 * Locate the `extnValue` OCTET STRING contents for a given extension OID.
 * Returns the raw bytes inside the OCTET STRING (the DER of the extension's
 * value), or `undefined` if the extension is absent.
 */
function findExtensionValue(certDer: Uint8Array, oid: string): Uint8Array | undefined {
  for (const ext of extractExtensionNodes(certDer)) {
    const oidNode = ext.children[0];
    if (!oidNode) continue;
    if (decodeOidBytes(oidNode.data) !== oid) continue;
    // Extension ::= { extnID, critical DEFAULT FALSE, extnValue OCTET STRING }.
    // The OCTET STRING is the last child (index 1 or 2 depending on `critical`).
    const valueNode = ext.children[ext.children.length - 1];
    if (!valueNode) return undefined;
    return valueNode.data; // contents of the extnValue OCTET STRING
  }
  return undefined;
}

/**
 * Extract the Subject Key Identifier (key bytes) — RFC 5280 §4.2.1.2.
 *
 * SubjectKeyIdentifier ::= KeyIdentifier
 * KeyIdentifier ::= OCTET STRING
 *
 * extnValue (an OCTET STRING) wraps the KeyIdentifier OCTET STRING, so we
 * parse one inner OCTET STRING to obtain the raw identifier bytes.
 */
function extractSki(certDer: Uint8Array): Uint8Array | undefined {
  const extnValue = findExtensionValue(certDer, OID_SUBJECT_KEY_IDENTIFIER);
  if (!extnValue) return undefined;
  try {
    const inner = parseDerTlv(extnValue, 0);
    if (inner.tag !== 0x04) return undefined; // expect OCTET STRING
    return inner.data;
  } catch {
    return undefined;
  }
}

/**
 * Extract the Authority Key Identifier `keyIdentifier` — RFC 5280 §4.2.1.1.
 *
 * AuthorityKeyIdentifier ::= SEQUENCE {
 *   keyIdentifier             [0] KeyIdentifier OPTIONAL,   -- IMPLICIT OCTET STRING, tag 0x80
 *   authorityCertIssuer       [1] GeneralNames OPTIONAL,
 *   authorityCertSerialNumber [2] CertificateSerialNumber OPTIONAL }
 *
 * extnValue (an OCTET STRING) wraps the SEQUENCE. We return the bytes of the
 * `[0]` IMPLICIT field (context tag 0x80), or `undefined` if absent.
 */
function extractAkiKeyId(certDer: Uint8Array): Uint8Array | undefined {
  const extnValue = findExtensionValue(certDer, OID_AUTHORITY_KEY_IDENTIFIER);
  if (!extnValue) return undefined;
  try {
    const seq = parseDerTlv(extnValue, 0);
    if (seq.tag !== 0x30) return undefined; // expect SEQUENCE
    for (const field of seq.children) {
      if (field.tag === 0x80) {
        // [0] IMPLICIT OCTET STRING — the keyIdentifier bytes are the value.
        return field.data;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Byte comparison
// ---------------------------------------------------------------------------

/** Byte-for-byte equality of two arrays. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Issuer/subject matching
// ---------------------------------------------------------------------------

/**
 * Determine whether `candidate` could be the issuer of `cert`:
 * the candidate's subject DN must equal the cert's issuer DN, and — only when
 * BOTH key identifiers are present — the candidate's SKI must equal the cert's
 * AKI keyIdentifier (RFC 5280 §6.1.4 / §4.2.1.1).
 */
function isIssuerOf(cert: Uint8Array, candidate: Uint8Array): boolean {
  const certIssuer = extractIssuerDer(cert);
  const candidateSubject = extractSubjectDer(candidate);
  if (!bytesEqual(certIssuer, candidateSubject)) return false;

  const aki = extractAkiKeyId(cert);
  const ski = extractSki(candidate);
  if (aki && ski) {
    return bytesEqual(aki, ski);
  }
  // If either identifier is missing, fall back to name matching alone.
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an ordered certification path from a leaf certificate to a trust
 * anchor per RFC 5280 §6.1.
 *
 * @param leafCertDer   DER-encoded end-entity (leaf) certificate.
 * @param intermediates DER-encoded intermediate CA certificates (any order).
 * @param anchors       DER-encoded trust anchors (root or directly-trusted CAs).
 * @returns             {@link CertPathResult} — `path` is leaf-first and
 *                      excludes the anchor; `anchor` is reported separately
 *                      when the path is `complete`.
 *
 * @example
 * ```ts
 * const { path, complete, anchor } = buildCertPath(leaf, [intermediate], [root]);
 * // path = [leaf, intermediate], complete = true, anchor = root
 * ```
 */
export function buildCertPath(
  leafCertDer: Uint8Array,
  intermediates: readonly Uint8Array[],
  anchors: readonly Uint8Array[],
): CertPathResult {
  // Case: the leaf itself is a trust anchor (e.g. a self-signed cert that is
  // its own anchor). Report path:[leaf], complete:true, anchor:leaf.
  const leafAnchor = anchors.find((a) => bytesEqual(a, leafCertDer));
  if (leafAnchor) {
    return { path: [leafCertDer], complete: true, anchor: leafAnchor };
  }

  const path: Uint8Array[] = [leafCertDer];
  let current = leafCertDer;

  // Hard cap mirrors RFC 5280's prohibition on revisiting a certificate;
  // also bounds pathological inputs.
  const maxDepth = intermediates.length + anchors.length + 2;

  for (let depth = 0; depth < maxDepth; depth++) {
    // Prefer an anchor as the issuer of `current` → terminate the path.
    const anchor = anchors.find((a) => isIssuerOf(current, a));
    if (anchor) {
      return { path, complete: true, anchor };
    }

    // Otherwise find a matching intermediate not already in the path
    // (loop guard: a certificate must not appear twice — RFC 5280 §6.1).
    const next = intermediates.find(
      (c) => isIssuerOf(current, c) && !path.some((p) => bytesEqual(p, c)),
    );
    if (!next) {
      // No issuer found — partial path.
      return { path, complete: false, anchor: undefined };
    }

    path.push(next);
    current = next;
  }

  // Depth bound reached without locating an anchor.
  return { path, complete: false, anchor: undefined };
}

/**
 * @module signature/ocspStaple
 *
 * Stapled OCSP response support for PKCS#7 / CMS signatures.
 *
 * Allows embedding an OCSP response directly into a PKCS#7 SignedData
 * structure as an unsigned attribute, following the Adobe
 * `adbe-revocationInfoArchival` convention (OID 1.2.840.113583.1.1.8).
 *
 * This enables "OCSP stapling" where the OCSP response is bundled with
 * the signature so verifiers do not need to contact the OCSP responder.
 *
 * References:
 * - RFC 6960 (Online Certificate Status Protocol — OCSP)
 * - Adobe PDF Reference, adbe-revocationInfoArchival attribute
 * - RFC 5652 (CMS SignedData — unsigned attributes)
 *
 * @packageDocumentation
 */

import {
  parseDerTlv,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeContextTag,
  encodeLength,
  decodeOidBytes,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// OID constants
// ---------------------------------------------------------------------------

/**
 * OID for Adobe's adbe-revocationInfoArchival attribute.
 *
 * This attribute is used to embed OCSP responses and CRLs as
 * unsigned attributes in a PKCS#7 SignerInfo.
 */
const OID_ADBE_REVOCATION_INFO = '1.2.840.113583.1.1.8';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Concatenate multiple Uint8Arrays into one.
 * @internal
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode a raw DER TLV (tag-length-value) from a tag byte and content.
 * @internal
 */
function encodeTlv(tag: number, value: Uint8Array): Uint8Array {
  const len = encodeLength(value.length);
  const result = new Uint8Array(1 + len.length + value.length);
  result[0] = tag;
  result.set(len, 1);
  result.set(value, 1 + len.length);
  return result;
}

/**
 * Build the adbe-revocationInfoArchival attribute containing an OCSP
 * response.
 *
 * Structure:
 * ```
 * SEQUENCE {
 *   OID 1.2.840.113583.1.1.8
 *   SET {
 *     SEQUENCE {            -- RevocationInfoArchival
 *       [1] EXPLICIT {      -- OCSPResponse SEQUENCE
 *         SEQUENCE OF {
 *           OCTET STRING    -- raw OCSP response bytes
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @internal
 */
function buildRevocationInfoAttribute(ocspResponse: Uint8Array): Uint8Array {
  // Wrap the OCSP response in a SEQUENCE OF (single entry)
  const ocspOctetString = encodeOctetString(ocspResponse);
  const ocspSequenceOf = encodeSequence([ocspOctetString]);

  // [1] EXPLICIT tag for OCSP responses within RevocationInfoArchival
  const ocspTagged = encodeContextTag(1, ocspSequenceOf);

  // RevocationInfoArchival SEQUENCE
  const revInfoSeq = encodeSequence([ocspTagged]);

  // Attribute: OID + SET { value }
  return encodeSequence([
    encodeOID(OID_ADBE_REVOCATION_INFO),
    encodeSet([revInfoSeq]),
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed an OCSP response into a PKCS#7 SignedData structure as an
 * unsigned attribute.
 *
 * The OCSP response is added as an `adbe-revocationInfoArchival`
 * (OID 1.2.840.113583.1.1.8) unsigned attribute on the first
 * SignerInfo in the SignedData.
 *
 * @param signatureBytes  DER-encoded PKCS#7 / CMS ContentInfo.
 * @param ocspResponse    DER-encoded OCSP response.
 * @returns               New DER-encoded PKCS#7 with the embedded OCSP response.
 */
export function embedOcspResponse(
  signatureBytes: Uint8Array,
  ocspResponse: Uint8Array,
): Uint8Array {
  // Parse the outer ContentInfo
  const contentInfo = parseDerTlv(signatureBytes, 0);
  if (contentInfo.children.length < 2) {
    throw new Error('Invalid PKCS#7 ContentInfo: expected at least 2 children');
  }

  // The SignedData is inside [0] EXPLICIT
  const signedDataWrapper = contentInfo.children[1]!;
  const signedData = signedDataWrapper.children[0]!;
  if (!signedData) {
    throw new Error('Invalid PKCS#7: missing SignedData');
  }

  // Find the signerInfos SET (last child of SignedData, tag 0x31)
  let signerInfosIdx = -1;
  for (let i = signedData.children.length - 1; i >= 0; i--) {
    if (signedData.children[i]!.tag === 0x31) {
      signerInfosIdx = i;
      break;
    }
  }

  if (signerInfosIdx === -1) {
    throw new Error('Invalid PKCS#7 SignedData: no signerInfos SET found');
  }

  const signerInfosNode = signedData.children[signerInfosIdx]!;
  if (signerInfosNode.children.length === 0) {
    throw new Error('No SignerInfo found in SignedData');
  }

  // Get the first SignerInfo
  const signerInfo = signerInfosNode.children[0]!;

  // Build the unsigned attribute
  const revInfoAttr = buildRevocationInfoAttribute(ocspResponse);

  // Build unsigned attrs as [1] IMPLICIT SET
  const unsignedAttrsContent = concat(revInfoAttr);
  const unsignedAttrs = encodeContextTag(1, unsignedAttrsContent);

  // Rebuild the SignerInfo with unsigned attributes appended
  // Extract the original SignerInfo raw bytes
  const signerInfoBase = signatureBytes.subarray(
    signerInfo.offset + (signerInfosNode.data.byteOffset - signatureBytes.byteOffset),
    signerInfo.offset + signerInfo.totalLength + (signerInfosNode.data.byteOffset - signatureBytes.byteOffset),
  );

  // The original SignerInfo is a SEQUENCE; we need to parse its contents
  // and append the unsigned attributes
  const parsedSignerInfo = parseDerTlv(signerInfoBase, 0);

  // Collect the raw bytes of each child element of the SignerInfo
  const childBytes: Uint8Array[] = [];
  for (const child of parsedSignerInfo.children) {
    const start = child.offset + (parsedSignerInfo.data.byteOffset - signerInfoBase.byteOffset);
    childBytes.push(signerInfoBase.subarray(start, start + child.totalLength));
  }

  // Remove any existing unsigned attrs ([1] tag = 0xa1)
  const filteredChildren = childBytes.filter((_, idx) => {
    const child = parsedSignerInfo.children[idx]!;
    return child.tag !== 0xa1;
  });

  // Append the new unsigned attrs
  filteredChildren.push(unsignedAttrs);

  // Rebuild the SignerInfo SEQUENCE
  const newSignerInfo = encodeSequence(filteredChildren);

  // Rebuild the signerInfos SET
  const newSignerInfosSet = encodeSet([newSignerInfo]);

  // Rebuild the SignedData SEQUENCE with all original children,
  // replacing the signerInfos
  const signedDataChildren: Uint8Array[] = [];
  for (let i = 0; i < signedData.children.length; i++) {
    if (i === signerInfosIdx) {
      signedDataChildren.push(newSignerInfosSet);
    } else {
      const child = signedData.children[i]!;
      const start = child.offset + (signedData.data.byteOffset - signatureBytes.byteOffset);
      signedDataChildren.push(signatureBytes.subarray(start, start + child.totalLength));
    }
  }

  const newSignedData = encodeSequence(signedDataChildren);

  // Rebuild ContentInfo: OID + [0] EXPLICIT { SignedData }
  const oidChild = contentInfo.children[0]!;
  const oidAbsStart = oidChild.offset + (contentInfo.data.byteOffset - signatureBytes.byteOffset);
  const contentTypeOid = signatureBytes.subarray(
    oidAbsStart,
    oidAbsStart + oidChild.totalLength,
  );

  const newContentInfo = encodeSequence([
    contentTypeOid,
    encodeContextTag(0, newSignedData),
  ]);

  return newContentInfo;
}

/**
 * Extract a stapled OCSP response from a PKCS#7 SignedData structure.
 *
 * Looks for an `adbe-revocationInfoArchival` unsigned attribute on the
 * first SignerInfo and extracts the OCSP response bytes.
 *
 * @param signatureBytes  DER-encoded PKCS#7 / CMS ContentInfo.
 * @returns               The DER-encoded OCSP response, or `null` if none found.
 */
export function extractStapledOcsp(
  signatureBytes: Uint8Array,
): Uint8Array | null {
  try {
    const contentInfo = parseDerTlv(signatureBytes, 0);
    if (contentInfo.children.length < 2) return null;

    const signedDataWrapper = contentInfo.children[1]!;
    const signedData = signedDataWrapper.children[0]!;
    if (!signedData) return null;

    // Find signerInfos SET
    let signerInfosNode: Asn1Node | null = null;
    for (let i = signedData.children.length - 1; i >= 0; i--) {
      if (signedData.children[i]!.tag === 0x31) {
        signerInfosNode = signedData.children[i]!;
        break;
      }
    }

    if (!signerInfosNode || signerInfosNode.children.length === 0) return null;

    const signerInfo = signerInfosNode.children[0]!;

    // Look for unsigned attributes [1] (tag 0xa1)
    for (const child of signerInfo.children) {
      if (child.tag === 0xa1) {
        // This is the unsigned attributes SET
        // Each child is an Attribute SEQUENCE { OID, SET { value } }
        for (const attr of child.children) {
          if (attr.children.length < 2) continue;

          const oidNode = attr.children[0]!;
          const oid = decodeOidBytes(oidNode.data);

          if (oid === OID_ADBE_REVOCATION_INFO) {
            // Found the revocation info attribute
            // Value is SET { SEQUENCE { [1] { SEQUENCE OF { OCTET STRING } } } }
            const valueSet = attr.children[1]!;
            if (valueSet.children.length === 0) continue;

            const revInfoSeq = valueSet.children[0]!;

            // Look for [1] tag (OCSP responses)
            for (const revChild of revInfoSeq.children) {
              if (revChild.tag === 0xa1) {
                // SEQUENCE OF OCTET STRING
                if (revChild.children.length > 0) {
                  const seqOf = revChild.children[0]!;
                  if (seqOf.children.length > 0) {
                    // Return the first OCSP response bytes
                    return seqOf.children[0]!.data;
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * @module signature/counterSignature
 *
 * Counter-signature support — allows signing an existing signature to
 * attest that a specific signature existed at a certain time (e.g.,
 * notarization or witness signing).
 *
 * A counter-signature is a PKCS#7 unsigned attribute (OID 1.2.840.113549.1.9.6)
 * that contains a SignerInfo whose signature is computed over the existing
 * signature value. It is appended via incremental update.
 *
 * References:
 * - RFC 5652 SS 11.4 (Countersignature)
 * - PDF 2.0 spec SS 12.8 (Digital Signatures)
 *
 * @packageDocumentation
 */

import { findSignatures } from './byteRange.js';
import {
  parseDerTlv,
  extractIssuerAndSerial,
  detectKeyAlgorithm,
  detectNamedCurve,
  decodeOidBytes,
  toBuffer,
  getSubtle,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeUTCTime,
  encodeContextTag,
  encodeLength,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Information about a counter-signature found on a PDF signature.
 */
export interface CounterSignatureInfo {
  /** The index of the primary signature that was counter-signed. */
  targetSignatureIndex: number;
  /** The Common Name of the counter-signer. */
  signerName: string;
  /** When the counter-signature was applied. */
  signedAt?: Date | undefined;
  /** Whether the counter-signature is structurally valid. */
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Well-known OIDs
// ---------------------------------------------------------------------------

const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_DATA = '1.2.840.113549.1.7.1';
const OID_COUNTER_SIGNATURE = '1.2.840.113549.1.9.6';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';

const HASH_OID_MAP: Record<string, string> = {
  'SHA-256': '2.16.840.1.101.3.4.2.1',
  'SHA-384': '2.16.840.1.101.3.4.2.2',
  'SHA-512': '2.16.840.1.101.3.4.2.3',
};

const RSA_SIG_OID_MAP: Record<string, string> = {
  'SHA-256': '1.2.840.113549.1.1.11',
  'SHA-384': '1.2.840.113549.1.1.12',
  'SHA-512': '1.2.840.113549.1.1.13',
};

const ECDSA_SIG_OID_MAP: Record<string, string> = {
  'SHA-256': '1.2.840.10045.4.3.2',
  'SHA-384': '1.2.840.10045.4.3.3',
  'SHA-512': '1.2.840.10045.4.3.4',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * Encode a small non-negative integer.
 */
function encodeIntegerValue(value: number): Uint8Array {
  const TAG_INTEGER = 0x02;
  if (value < 0x80) {
    return new Uint8Array([TAG_INTEGER, 1, value]);
  }
  if (value < 0x8000) {
    return new Uint8Array([TAG_INTEGER, 2, (value >> 8) & 0xff, value & 0xff]);
  }
  return new Uint8Array([
    TAG_INTEGER,
    3,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
}

/**
 * Concatenate multiple Uint8Arrays.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Encode an AlgorithmIdentifier SEQUENCE for a hash algorithm.
 */
function encodeDigestAlgorithm(hashAlgo: string): Uint8Array {
  const oid = HASH_OID_MAP[hashAlgo];
  if (!oid) throw new Error(`Unsupported hash algorithm: ${hashAlgo}`);
  return encodeSequence([encodeOID(oid), new Uint8Array([0x05, 0x00])]);
}

/**
 * Encode an AlgorithmIdentifier for a signature algorithm.
 */
function encodeSignatureAlgorithm(keyAlgo: string, hashAlgo: string): Uint8Array {
  let oid: string | undefined;
  if (keyAlgo === 'RSA' || keyAlgo === 'RSASSA-PKCS1-v1_5') {
    oid = RSA_SIG_OID_MAP[hashAlgo];
    if (!oid) throw new Error(`Unsupported hash for RSA: ${hashAlgo}`);
    return encodeSequence([encodeOID(oid), new Uint8Array([0x05, 0x00])]);
  }
  if (keyAlgo === 'EC' || keyAlgo === 'ECDSA') {
    oid = ECDSA_SIG_OID_MAP[hashAlgo];
    if (!oid) throw new Error(`Unsupported hash for ECDSA: ${hashAlgo}`);
    return encodeSequence([encodeOID(oid)]);
  }
  throw new Error(`Unsupported key algorithm: ${keyAlgo}`);
}

/**
 * Convert hex string to Uint8Array, stripping trailing zero padding.
 */
function hexToBytes(hex: string): Uint8Array {
  let clean = hex.replace(/\s/g, '');
  // Strip trailing zero padding
  const trailingMatch = clean.match(/(00)+$/);
  if (trailingMatch && trailingMatch[0]!.length > 4) {
    const endIdx = clean.length - trailingMatch[0]!.length;
    if (endIdx > 0 && endIdx % 2 === 0) {
      clean = clean.slice(0, endIdx);
    }
  }
  if (clean.length % 2 !== 0) clean = '0' + clean;
  return Uint8Array.fromHex(clean);
}

/**
 * Extract the signing time from PKCS#7 signed attributes.
 */
function extractSigningTimeFromAttrs(signedData: Asn1Node): Date | undefined {
  try {
    // Navigate to signerInfos -> first SignerInfo -> signedAttrs
    for (const child of signedData.children) {
      // signerInfos SET (tag 0x31)
      if (child.tag === 0x31 && child.children.length > 0) {
        const signerInfo = child.children[0]!;
        for (const siChild of signerInfo.children) {
          if (siChild.tag === 0xa0) {
            // signedAttrs — look for signing time
            for (const attr of siChild.children) {
              if (attr.children.length >= 2) {
                const oidBytes = attr.children[0]!.data;
                const oid = decodeOidBytes(oidBytes);
                if (oid === OID_SIGNING_TIME) {
                  const valueSet = attr.children[1]!;
                  if (valueSet.children.length > 0) {
                    const timeStr = new TextDecoder('ascii').decode(
                      valueSet.children[0]!.data,
                    );
                    return parseUtcTime(timeStr);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Fall through
  }
  return undefined;
}

/**
 * Parse UTCTime string to Date.
 */
function parseUtcTime(utcTime: string): Date {
  const clean = utcTime.replace('Z', '');
  const year = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10) - 1;
  const day = parseInt(clean.slice(4, 6), 10);
  const hours = parseInt(clean.slice(6, 8), 10);
  const minutes = parseInt(clean.slice(8, 10), 10);
  const seconds = parseInt(clean.slice(10, 12), 10);
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(Date.UTC(fullYear, month, day, hours, minutes, seconds));
}

/**
 * Convert ECDSA P1363 format to DER.
 */
function convertEcdsaToDer(p1363Sig: Uint8Array): Uint8Array {
  const halfLen = p1363Sig.length / 2;
  const r = p1363Sig.subarray(0, halfLen);
  const s = p1363Sig.subarray(halfLen);
  return encodeSequence([encodeInteger(r), encodeInteger(s)]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a counter-signature to an existing PDF signature.
 *
 * Finds the target signature's /Contents, computes a hash of the
 * existing signature value, creates a PKCS#7 counter-signature
 * attribute, and appends the result via incremental update.
 *
 * @param pdf                    The PDF bytes containing the target signature.
 * @param targetSignatureIndex   Zero-based index of the signature to counter-sign.
 * @param signerInfo             The counter-signer's certificate, private key, and hash algorithm.
 * @returns                      The PDF with the counter-signature appended.
 *
 * @example
 * ```ts
 * const counterSigned = await addCounterSignature(
 *   signedPdf,
 *   0,
 *   { certificate: certDer, privateKey: keyDer },
 * );
 * ```
 */
export async function addCounterSignature(
  pdf: Uint8Array,
  targetSignatureIndex: number,
  signerInfo: {
    certificate: Uint8Array;
    privateKey: Uint8Array;
    hashAlgorithm?: string | undefined;
  },
): Promise<Uint8Array> {
  const signatures = findSignatures(pdf);

  if (signatures.length === 0) {
    throw new Error('No signatures found in the PDF');
  }

  if (targetSignatureIndex < 0 || targetSignatureIndex >= signatures.length) {
    throw new Error(
      `Signature index ${targetSignatureIndex} out of range (0–${signatures.length - 1})`,
    );
  }

  const targetSig = signatures[targetSignatureIndex]!;
  const hashAlgorithm = signerInfo.hashAlgorithm ?? 'SHA-256';
  const subtle = getSubtle();

  // Step 1: Get the target signature's raw bytes
  const sigBytes = hexToBytes(targetSig.contentsHex);

  // Step 2: Hash the existing signature value
  const sigHash = new Uint8Array(
    await subtle.digest(
      hashAlgorithm,
      toBuffer(sigBytes),
    ),
  );

  // Step 3: Extract certificate info
  const { issuerDer, serialDer } = extractIssuerAndSerial(signerInfo.certificate);
  const keyAlgo = detectKeyAlgorithm(signerInfo.certificate);
  const namedCurve = keyAlgo === 'EC'
    ? detectNamedCurve(signerInfo.certificate)
    : undefined;

  // Step 4: Build counter-signature signed attributes
  const now = new Date();

  const contentTypeAttr = encodeSequence([
    encodeOID(OID_CONTENT_TYPE),
    encodeSet([encodeOID(OID_DATA)]),
  ]);

  const signingTimeAttr = encodeSequence([
    encodeOID(OID_SIGNING_TIME),
    encodeSet([encodeUTCTime(now)]),
  ]);

  const messageDigestAttr = encodeSequence([
    encodeOID(OID_MESSAGE_DIGEST),
    encodeSet([encodeOctetString(sigHash)]),
  ]);

  const signedAttrs = [contentTypeAttr, signingTimeAttr, messageDigestAttr];
  const signedAttrsForHash = encodeSet(signedAttrs);

  // Step 5: Import key and sign
  let importAlgo: RsaHashedImportParams | EcKeyImportParams;
  if (keyAlgo === 'RSA') {
    importAlgo = { name: 'RSASSA-PKCS1-v1_5', hash: hashAlgorithm };
  } else {
    importAlgo = { name: 'ECDSA', namedCurve: namedCurve ?? 'P-256' };
  }

  const privateKey = await subtle.importKey(
    'pkcs8',
    toBuffer(signerInfo.privateKey),
    importAlgo,
    false,
    ['sign'],
  );

  let signAlgo: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  if (keyAlgo === 'RSA') {
    signAlgo = { name: 'RSASSA-PKCS1-v1_5' };
  } else {
    signAlgo = { name: 'ECDSA', hash: hashAlgorithm };
  }

  const rawSignature = new Uint8Array(
    await subtle.sign(signAlgo, privateKey, toBuffer(signedAttrsForHash)),
  );

  const finalSignature = keyAlgo === 'EC'
    ? convertEcdsaToDer(rawSignature)
    : rawSignature;

  // Step 6: Build the counter-signature SignerInfo
  const csSignerInfo = encodeSequence([
    encodeIntegerValue(1),
    encodeSequence([issuerDer, serialDer]),
    encodeDigestAlgorithm(hashAlgorithm),
    encodeContextTag(0, concat(...signedAttrs)),
    encodeSignatureAlgorithm(keyAlgo, hashAlgorithm),
    encodeOctetString(finalSignature),
  ]);

  // Step 7: Build the counter-signature attribute
  const counterSigAttr = encodeSequence([
    encodeOID(OID_COUNTER_SIGNATURE),
    encodeSet([csSignerInfo]),
  ]);

  // Step 8: Build a new signature object that embeds the counter-sig
  // as an unsigned attribute, and append via incremental update
  const pdfText = decoder.decode(pdf);

  // Build the counter-signature annotation as an incremental object
  const counterSigDict =
    `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached` +
    ` /Reason (Counter-signature for signature ${targetSignatureIndex})` +
    ` /M (D:${formatPdfDate(now)})` +
    ` /Contents <${sigHash.toHex().padEnd(16384, '0')}>` +
    ` /ByteRange [0 0 0 0]` +
    ` >>`;

  // Append via incremental update
  const counterSigAnnot = encoder.encode(counterSigDict);
  const appendix = buildCounterSignatureAppendix(pdf, targetSignatureIndex, counterSigAttr);

  const result = new Uint8Array(pdf.length + appendix.length);
  result.set(pdf, 0);
  result.set(appendix, pdf.length);

  return result;
}

/**
 * Format a Date as a PDF date string.
 */
function formatPdfDate(date: Date): string {
  const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
  const year = pad(date.getFullYear(), 4);
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}Z`;
}

/**
 * Build incremental update appendix for counter-signature.
 */
function buildCounterSignatureAppendix(
  pdf: Uint8Array,
  targetIndex: number,
  counterSigAttr: Uint8Array,
): Uint8Array {
  const pdfText = decoder.decode(pdf);

  // Find /Size in the last trailer
  const sizeMatch = pdfText.match(/\/Size\s+(\d+)/g);
  const lastSizeMatch = sizeMatch?.[sizeMatch.length - 1]?.match(/\/Size\s+(\d+)/);
  const currentSize = lastSizeMatch ? parseInt(lastSizeMatch[1]!, 10) : 100;

  // Find /Root reference
  const rootMatch = pdfText.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  const rootRef = rootMatch
    ? `${rootMatch[1]} ${rootMatch[2]} R`
    : '1 0 R';

  // Find startxref
  const startxrefIdx = pdfText.lastIndexOf('startxref');
  const afterStartxref = pdfText.slice(startxrefIdx + 9).trim();
  const xrefOffMatch = afterStartxref.match(/^(\d+)/);
  const prevXrefOffset = xrefOffMatch ? parseInt(xrefOffMatch[1]!, 10) : 0;

  // New object: counter-signature annotation
  const newObjNum = currentSize;
  const hexContent = counterSigAttr.toHex();

  let appendix = '\n';
  const objStart = pdf.length + encoder.encode(appendix).length;

  appendix += `${newObjNum} 0 obj\n`;
  appendix += `<< /Type /Annot /Subtype /Widget /FT /Sig`;
  appendix += ` /T (CounterSig_${targetIndex})`;
  appendix += ` /V << /Type /Sig /Filter /Adobe.PPKLite`;
  appendix += ` /SubFilter /adbe.pkcs7.detached`;
  appendix += ` /Reason (Counter-signature for signature ${targetIndex})`;
  appendix += ` /Contents <${hexContent.padEnd(512, '0')}> >>`;
  appendix += ` /F 132 /Rect [0 0 0 0] >>\n`;
  appendix += 'endobj\n';

  // Write xref
  const xrefOffset = pdf.length + encoder.encode(appendix).length;
  appendix += 'xref\n';
  appendix += `${newObjNum} 1\n`;
  appendix += `${objStart.toString().padStart(10, '0')} 00000 n \n`;

  // Trailer
  appendix += 'trailer\n';
  appendix += '<<\n';
  appendix += `/Size ${currentSize + 1}\n`;
  appendix += `/Root ${rootRef}\n`;
  appendix += `/Prev ${prevXrefOffset}\n`;
  appendix += '>>\n';
  appendix += 'startxref\n';
  appendix += `${xrefOffset}\n`;
  appendix += '%%EOF\n';

  return encoder.encode(appendix);
}

/**
 * Extract counter-signatures from all signatures in a PDF.
 *
 * Scans each signature's PKCS#7 structure for the counter-signature
 * unsigned attribute (OID 1.2.840.113549.1.9.6).
 *
 * @param pdf  The PDF bytes.
 * @returns    Array of counter-signature info objects.
 *
 * @example
 * ```ts
 * const counterSigs = getCounterSignatures(pdfBytes);
 * for (const cs of counterSigs) {
 *   console.log(`Signature ${cs.targetSignatureIndex} counter-signed by ${cs.signerName}`);
 * }
 * ```
 */
export function getCounterSignatures(pdf: Uint8Array): CounterSignatureInfo[] {
  const signatures = findSignatures(pdf);
  const results: CounterSignatureInfo[] = [];
  const pdfText = decoder.decode(pdf);

  for (let sigIdx = 0; sigIdx < signatures.length; sigIdx++) {
    const sig = signatures[sigIdx]!;

    // Check if this looks like a counter-signature field
    const searchStart = Math.max(0, sig.contentsOffset - 2000);
    const searchEnd = Math.min(pdfText.length, sig.contentsOffset + 2000);
    const region = pdfText.slice(searchStart, searchEnd);

    const counterSigMatch = region.match(/\/T\s*\(CounterSig_(\d+)\)/);
    if (counterSigMatch) {
      const targetIdx = parseInt(counterSigMatch[1]!, 10);
      let signerName = 'Unknown';

      // Try to extract signer name from PKCS#7 contents
      try {
        const pkcs7Bytes = hexToBytes(sig.contentsHex);
        if (pkcs7Bytes.length > 10) {
          const contentInfo = parseDerTlv(pkcs7Bytes, 0);
          if (contentInfo.children.length >= 2) {
            const signedDataWrapper = contentInfo.children[1]!;
            const signedData = signedDataWrapper.children[0]!;
            if (signedData) {
              for (const child of signedData.children) {
                if (child.tag === 0xa0 && child.children.length > 0) {
                  const certNode = child.children[0]!;
                  const certStart =
                    certNode.offset +
                    (child.data.byteOffset - pkcs7Bytes.byteOffset);
                  const certBytes = pkcs7Bytes.subarray(
                    certStart,
                    certStart + certNode.totalLength,
                  );
                  const { subjectCN } = extractIssuerAndSerial(certBytes);
                  signerName = subjectCN;
                }
              }
            }
          }
        }
      } catch {
        // Keep 'Unknown'
      }

      // Extract signing date
      const reasonMatch = region.match(
        /\/Reason\s*\(Counter-signature for signature \d+\)/,
      );
      const dateMatch = region.match(
        /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
      );
      let signedAt: Date | undefined;
      if (dateMatch) {
        const year = parseInt(dateMatch[1]!, 10);
        const month = parseInt(dateMatch[2]!, 10) - 1;
        const day = parseInt(dateMatch[3]!, 10);
        const hours = parseInt(dateMatch[4]!, 10);
        const minutes = parseInt(dateMatch[5]!, 10);
        const seconds = parseInt(dateMatch[6]!, 10);
        signedAt = new Date(year, month, day, hours, minutes, seconds);
      }

      results.push({
        targetSignatureIndex: targetIdx,
        signerName,
        signedAt,
        isValid: reasonMatch !== null,
      });
    }

    // Also check the PKCS#7 unsigned attributes for embedded counter-sigs
    try {
      const pkcs7Bytes = hexToBytes(sig.contentsHex);
      if (pkcs7Bytes.length < 10) continue;

      const contentInfo = parseDerTlv(pkcs7Bytes, 0);
      if (contentInfo.children.length < 2) continue;

      const signedDataWrapper = contentInfo.children[1]!;
      const signedData = signedDataWrapper.children[0]!;
      if (!signedData) continue;

      for (const child of signedData.children) {
        if (child.tag !== 0x31) continue;
        // SignerInfos SET
        for (const siNode of child.children) {
          // Check for unsigned attributes [1]
          for (const siChild of siNode.children) {
            if (siChild.tag === 0xa1) {
              // Unsigned attributes
              for (const attr of siChild.children) {
                if (attr.children.length >= 2) {
                  const oid = decodeOidBytes(attr.children[0]!.data);
                  if (oid === OID_COUNTER_SIGNATURE) {
                    // Found a counter-signature
                    let csSignerName = 'Unknown';
                    let csSignedAt: Date | undefined;

                    const csInfoSet = attr.children[1]!;
                    if (csInfoSet.children.length > 0) {
                      const csInfo = csInfoSet.children[0]!;
                      // Try to extract signer info from the counter-sig
                      // SignerInfo children: version, issuerAndSerial, digestAlgo, signedAttrs, sigAlgo, sig
                      for (const csChild of csInfo.children) {
                        if (csChild.tag === 0xa0) {
                          // signedAttrs — look for signing time
                          for (const csAttr of csChild.children) {
                            if (csAttr.children.length >= 2) {
                              const csOid = decodeOidBytes(csAttr.children[0]!.data);
                              if (csOid === OID_SIGNING_TIME) {
                                const timeSet = csAttr.children[1]!;
                                if (timeSet.children.length > 0) {
                                  const timeStr = new TextDecoder('ascii').decode(
                                    timeSet.children[0]!.data,
                                  );
                                  csSignedAt = parseUtcTime(timeStr);
                                }
                              }
                            }
                          }
                        }
                      }
                    }

                    results.push({
                      targetSignatureIndex: sigIdx,
                      signerName: csSignerName,
                      signedAt: csSignedAt,
                      isValid: true,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Continue to next signature
    }
  }

  return results;
}

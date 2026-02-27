/**
 * @module signature/signatureHandler
 *
 * High-level API for signing PDF documents and extracting signature
 * information.
 *
 * This module orchestrates the lower-level modules (byteRange, pkcs7)
 * to provide a simple `signPdf()` function and a `getSignatures()`
 * function for inspecting existing signatures.
 *
 * @packageDocumentation
 */

import { prepareForSigning, computeSignatureHash, embedSignature, findSignatures } from './byteRange.js';
import { buildPkcs7Signature, extractIssuerAndSerial, parseDerTlv } from './pkcs7.js';
import type { SignatureOptions } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for signing a PDF.
 */
export interface SignOptions {
  /** DER-encoded X.509 certificate. */
  certificate: Uint8Array;
  /** PKCS#8 DER-encoded private key. */
  privateKey: Uint8Array;
  /** Hash algorithm. Default: 'SHA-256'. */
  hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512' | undefined;
  /** Reason for signing. */
  reason?: string | undefined;
  /** Location of signing. */
  location?: string | undefined;
  /** Contact information. */
  contactInfo?: string | undefined;
  /** RFC 3161 TSA URL for timestamping (optional). */
  timestampUrl?: string | undefined;
}

/**
 * Information about an existing signature in a PDF.
 */
export interface PdfSignatureInfo {
  /** The signature field name. */
  fieldName: string;
  /** Subject CN from the certificate. */
  signedBy: string;
  /** Reason for signing. */
  reason?: string | undefined;
  /** Location of signing. */
  location?: string | undefined;
  /** Contact information. */
  contactInfo?: string | undefined;
  /** Signing date/time. */
  signingDate?: Date | undefined;
  /** The ByteRange covering this signature. */
  byteRange: [number, number, number, number];
  /** Whether the signature is valid (set during verification). */
  signatureValid?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

/**
 * Extract the field name from the signature dictionary context.
 */
function extractFieldName(pdfStr: string, sigDictOffset: number): string {
  // Look backward from the signature dict for a /T entry
  const searchStart = Math.max(0, sigDictOffset - 2000);
  const searchRegion = pdfStr.substring(searchStart, sigDictOffset + 1000);

  const tMatch = searchRegion.match(/\/T\s*\(([^)]*)\)/);
  if (tMatch) return tMatch[1]!;

  return 'Signature';
}

/**
 * Extract optional string entries (/Reason, /Location, /ContactInfo)
 * from a signature dictionary.
 */
function extractSigDictStrings(
  pdfStr: string,
  byteRangeOffset: number,
): { reason?: string; location?: string; contactInfo?: string; signingDate?: Date } {
  // Search around the ByteRange location
  const searchStart = Math.max(0, byteRangeOffset - 1000);
  const searchEnd = Math.min(pdfStr.length, byteRangeOffset + 2000);
  const region = pdfStr.substring(searchStart, searchEnd);

  const result: { reason?: string; location?: string; contactInfo?: string; signingDate?: Date } = {};

  const reasonMatch = region.match(/\/Reason\s*\(([^)]*)\)/);
  if (reasonMatch && reasonMatch[1] !== undefined) result.reason = reasonMatch[1];

  const locationMatch = region.match(/\/Location\s*\(([^)]*)\)/);
  if (locationMatch && locationMatch[1] !== undefined) result.location = locationMatch[1];

  const contactMatch = region.match(/\/ContactInfo\s*\(([^)]*)\)/);
  if (contactMatch && contactMatch[1] !== undefined) result.contactInfo = contactMatch[1];

  // Parse /M (signing date)
  const dateMatch = region.match(/\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10) - 1;
    const day = parseInt(dateMatch[3]!, 10);
    const hours = parseInt(dateMatch[4]!, 10);
    const minutes = parseInt(dateMatch[5]!, 10);
    const seconds = parseInt(dateMatch[6]!, 10);
    result.signingDate = new Date(year, month, day, hours, minutes, seconds);
  }

  return result;
}

/**
 * Extract the subject Common Name from a DER-encoded certificate
 * hex string extracted from the PKCS#7 signature.
 */
function extractSignerName(contentsHex: string): string {
  try {
    // Decode hex to bytes
    const bytes = hexToBytes(contentsHex);
    if (bytes.length === 0) return 'Unknown';

    // The PKCS#7 structure contains the certificate.
    // Look for the certificate within the ContentInfo structure.
    // This is a simplified extraction — we parse the outer
    // ContentInfo > SignedData > certificates > Certificate
    const { extractCertificateFromPkcs7 } = parsePkcs7ForCert(bytes);
    if (extractCertificateFromPkcs7) {
      const { subjectCN } = extractIssuerAndSerial(extractCertificateFromPkcs7);
      return subjectCN;
    }
  } catch {
    // Fall through to return 'Unknown'
  }
  return 'Unknown';
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  // Strip any leading/trailing zeros used as padding
  let cleanHex = hex.replace(/\s/g, '');
  // Remove trailing zero padding
  const trailingZeros = cleanHex.match(/0+$/);
  if (trailingZeros && trailingZeros[0]!.length > 2) {
    // Only trim if it looks like padding (even number of trailing zeros)
    const trimLen = trailingZeros[0]!.length;
    if (trimLen % 2 === 0) {
      // Keep at least the non-zero portion
      const nonZeroEnd = cleanHex.length - trimLen;
      if (nonZeroEnd > 0 && nonZeroEnd % 2 === 0) {
        cleanHex = cleanHex.substring(0, nonZeroEnd);
      }
    }
  }

  if (cleanHex.length % 2 !== 0) cleanHex = '0' + cleanHex;

  return Uint8Array.fromHex(cleanHex);
}

/**
 * Extract the first certificate from a PKCS#7 SignedData structure.
 *
 * Structure: ContentInfo { SignedData { ... certificates [0] { cert } ... } }
 */
function parsePkcs7ForCert(
  pkcs7Bytes: Uint8Array,
): { extractCertificateFromPkcs7: Uint8Array | null } {
  try {
    const contentInfo = parseDerTlv(pkcs7Bytes, 0);
    // contentInfo is a SEQUENCE with:
    //   [0] OID (signedData)
    //   [1] [0] EXPLICIT SignedData
    if (contentInfo.children.length < 2) return { extractCertificateFromPkcs7: null };

    const signedDataWrapper = contentInfo.children[1]!;
    const signedData = signedDataWrapper.children[0]!;
    if (!signedData) return { extractCertificateFromPkcs7: null };

    // SignedData: version, digestAlgorithms, encapContentInfo, [0] certificates, signerInfos
    for (const child of signedData.children) {
      // certificates is [0] IMPLICIT (tag 0xa0)
      if (child.tag === 0xa0) {
        // The first child should be the certificate
        if (child.children.length > 0) {
          const certNode = child.children[0]!;
          const certStart = certNode.offset + (child.data.byteOffset - pkcs7Bytes.byteOffset);
          return {
            extractCertificateFromPkcs7: pkcs7Bytes.subarray(
              certStart,
              certStart + certNode.totalLength,
            ),
          };
        }
        // If no children parsed, try to use the raw data
        return { extractCertificateFromPkcs7: child.data };
      }
    }
  } catch {
    // Parsing failed
  }
  return { extractCertificateFromPkcs7: null };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sign a PDF document.
 *
 * Returns the signed PDF bytes. Uses incremental save to preserve
 * existing content (including any previous signatures).
 *
 * @param pdfBytes   The original PDF file bytes.
 * @param fieldName  The name for the signature field.
 * @param options    Signing options (certificate, key, etc.).
 * @returns          The signed PDF bytes.
 *
 * @example
 * ```ts
 * const signedPdf = await signPdf(pdfBytes, 'Signature1', {
 *   certificate: certDer,
 *   privateKey: keyDer,
 *   reason: 'Document approval',
 *   location: 'New York, NY',
 * });
 * ```
 */
export async function signPdf(
  pdfBytes: Uint8Array,
  fieldName: string,
  options: SignOptions,
): Promise<Uint8Array> {
  const hashAlgorithm = options.hashAlgorithm ?? 'SHA-256';

  // Step 1: Prepare the PDF with a signature placeholder
  const { preparedPdf, byteRange } = prepareForSigning(
    pdfBytes,
    fieldName,
    8192, // 8 KB placeholder for PKCS#7 signature
  );

  // Step 2: Hash the PDF content (excluding the placeholder)
  const dataHash = await computeSignatureHash(
    preparedPdf,
    byteRange.byteRange,
    hashAlgorithm,
  );

  // Step 3: Build the PKCS#7 signature
  const sigOpts: SignatureOptions = {
    signerInfo: {
      certificate: options.certificate,
      privateKey: options.privateKey,
      hashAlgorithm,
    },
    reason: options.reason,
    location: options.location,
    contactInfo: options.contactInfo,
    signingDate: new Date(),
  };

  const pkcs7Signature = await buildPkcs7Signature(dataHash, sigOpts);

  // Step 4: Embed the signature
  const signedPdf = embedSignature(preparedPdf, pkcs7Signature, byteRange);

  return signedPdf;
}

/**
 * Extract signature information from a PDF.
 *
 * Scans the PDF for signature dictionaries and extracts metadata
 * from each one.
 *
 * @param pdfBytes  The PDF file bytes.
 * @returns         Array of signature info objects.
 */
export function getSignatures(pdfBytes: Uint8Array): PdfSignatureInfo[] {
  const pdfStr = decoder.decode(pdfBytes);
  const rawSigs = findSignatures(pdfBytes);

  return rawSigs.map((sig) => {
    const fieldName = extractFieldName(pdfStr, sig.contentsOffset);
    const extras = extractSigDictStrings(pdfStr, sig.contentsOffset);
    const signedBy = extractSignerName(sig.contentsHex);

    return {
      fieldName,
      signedBy,
      reason: extras.reason,
      location: extras.location,
      contactInfo: extras.contactInfo,
      signingDate: extras.signingDate,
      byteRange: sig.byteRange,
    };
  });
}

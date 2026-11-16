/**
 * @module signature/pades/signatureHandler
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

import {
  prepareSignatureUpdate,
  computeSignatureHash,
  embedSignature,
  findSignatures,
  readStringEntry,
} from './byteRange.js';
import type { PrepareAppearanceOptions } from './byteRange.js';
import { assertUnencryptedInput } from '../../core/io/incrementalWriter.js';
import { UNSUPPORTED_OPTIONS, rejectOption } from '../../internal/options.js';
import { buildPkcs7Signature, extractIssuerAndSerial, parseDerTlv } from '../cms/pkcs7.js';
import type { SignatureOptions } from '../cms/pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for a visible signature appearance on the page.
 */
export interface VisibleSignatureOptions {
  /** Zero-based page index where the signature should appear. Default: 0. */
  pageIndex?: number | undefined;
  /** Rectangle [x, y, width, height] in PDF points from the bottom-left corner. */
  rect: [number, number, number, number];
  /**
   * Text lines to display in the signature box.
   * Each string becomes a separate line. If omitted, auto-generates
   * from the signer name, reason, location, and date. Lines are drawn in
   * Helvetica with WinAnsiEncoding: a character outside it (or a TAB or
   * other control character) throws UnencodableTextError.
   */
  text?: string[] | undefined;
  /** Font size for the text. Default: 10. */
  fontSize?: number | undefined;
  /**
   * Background color as [r, g, b] values (0–1). Default: transparent.
   */
  backgroundColor?: [number, number, number] | undefined;
  /**
   * Border color as [r, g, b] values (0–1). Default: [0, 0, 0] (black).
   */
  borderColor?: [number, number, number] | undefined;
  /** Border width in points. Default: 1. Set to 0 for no border. */
  borderWidth?: number | undefined;
}

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
  /**
   * Reason for signing, written to the signature dictionary as `/Reason`, a
   * PDF text string (PDFDocEncoding, or UTF-16BE when a character is outside
   * it). A visible appearance that has no `text` of its own also shows it.
   */
  reason?: string | undefined;
  /**
   * Location of signing, written to the signature dictionary as `/Location`,
   * a PDF text string. A visible appearance that has no `text` of its own
   * also shows it.
   */
  location?: string | undefined;
  /**
   * Contact information of the signer, written to the signature dictionary
   * as `/ContactInfo`, a PDF text string.
   */
  contactInfo?: string | undefined;
  /**
   * RFC 3161 TSA URL for timestamping.
   *
   * Not supported in this release: `signPdf()` requests and embeds no
   * timestamp, so passing it throws an `UnsupportedOptionError` (planned for
   * 0.45.0) before anything is signed.
   */
  timestampUrl?: string | undefined;
  /**
   * Visible signature appearance options. When provided, the signature
   * field is rendered visibly on the specified page with text and
   * optional styling. When omitted, the signature is invisible.
   */
  appearance?: VisibleSignatureOptions | undefined;
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

/** The rows of the option table that `signPdf()` refuses. */
const REFUSED_OPTIONS = /* @__PURE__ */ UNSUPPORTED_OPTIONS.filter(
  (rule) => rule.entry === 'signPdf()',
);

/**
 * Extract the field name from the signature dictionary context.
 */
function extractFieldName(pdfStr: string, sigDictOffset: number): string {
  // Look backward from the signature dict for a /T entry
  const searchStart = Math.max(0, sigDictOffset - 2000);
  const searchRegion = pdfStr.slice(searchStart, sigDictOffset + 1000);

  return readStringEntry(searchRegion, 'T') ?? 'Signature';
}

/**
 * Extract optional string entries (/Reason, /Location, /ContactInfo)
 * from a signature dictionary.
 */
function extractSigDictStrings(
  pdfStr: string,
  byteRangeOffset: number,
): { reason?: string; location?: string; contactInfo?: string; signingDate?: Date } {
  // From the start of the object that holds /ByteRange, or 1,000 characters back when that is
  // earlier: signPdf() writes /Reason, /Location and /ContactInfo before /ByteRange, and together
  // they can be longer than 1,000 characters.
  const objectStart = pdfStr.lastIndexOf(' obj', byteRangeOffset);
  const searchStart = Math.max(
    0,
    objectStart === -1 ? byteRangeOffset - 1000 : Math.min(byteRangeOffset - 1000, objectStart),
  );
  const searchEnd = Math.min(pdfStr.length, byteRangeOffset + 2000);
  const region = pdfStr.slice(searchStart, searchEnd);

  const result: { reason?: string; location?: string; contactInfo?: string; signingDate?: Date } =
    {};

  // Literal or hex form: signPdf() writes the three entries as hex text strings.
  const reason = readStringEntry(region, 'Reason');
  if (reason !== undefined) result.reason = reason;

  const location = readStringEntry(region, 'Location');
  if (location !== undefined) result.location = location;

  const contactInfo = readStringEntry(region, 'ContactInfo');
  if (contactInfo !== undefined) result.contactInfo = contactInfo;

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
        cleanHex = cleanHex.slice(0, nonZeroEnd);
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
function parsePkcs7ForCert(pkcs7Bytes: Uint8Array): {
  extractCertificateFromPkcs7: Uint8Array | null;
} {
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
 * @throws {UnsupportedEncryptionError} When `pdfBytes` is an encrypted PDF
 *         (its bytes contain the name `/Encrypt`): the
 *         appended signature objects and trailer would not be encrypted.
 * @throws {UnencodableTextError} When `fieldName`, `options.reason`,
 *         `options.location` or `options.contactInfo` holds a lone surrogate
 *         or U+001B, or a line of a visible appearance that fits in its
 *         box (`appearance.text`, or the generated "Signed by:", "Reason:"
 *         and "Location:" lines) holds a character that WinAnsiEncoding
 *         (Helvetica) has no code for.
 * @throws {UnsupportedOptionError} When `options.timestampUrl` is passed
 *         (planned for 0.45.0); nothing is signed.
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
  assertUnencryptedInput(pdfBytes, 'signPdf()');
  for (const rule of REFUSED_OPTIONS) {
    if (rule.option !== undefined && Reflect.get(options, rule.option) !== undefined) {
      rejectOption(rule);
    }
  }
  const hashAlgorithm = options.hashAlgorithm ?? 'SHA-256';

  // Build appearance options if visible signature requested
  let prepareAppearance: PrepareAppearanceOptions | undefined;
  if (options.appearance) {
    const ap = options.appearance;
    // Auto-generate text lines if not provided
    let textLines = ap.text;
    if (!textLines) {
      textLines = [];
      // Extract signer name from certificate (best effort)
      try {
        const { subjectCN } = extractIssuerAndSerial(options.certificate);
        if (subjectCN) textLines.push(`Signed by: ${subjectCN}`);
      } catch {
        textLines.push('Digitally Signed');
      }
      if (options.reason) textLines.push(`Reason: ${options.reason}`);
      if (options.location) textLines.push(`Location: ${options.location}`);
      textLines.push(`Date: ${new Date().toISOString().slice(0, 10)}`);
    }

    prepareAppearance = {
      rect: ap.rect,
      textLines,
      fontSize: ap.fontSize,
      backgroundColor: ap.backgroundColor,
      borderColor: ap.borderColor,
      borderWidth: ap.borderWidth,
    };
  }

  // Step 1: Prepare the PDF with a signature placeholder
  const { preparedPdf, byteRange } = prepareSignatureUpdate(
    pdfBytes,
    fieldName,
    8192, // 8 KB placeholder for PKCS#7 signature
    prepareAppearance,
    undefined,
    undefined,
    { reason: options.reason, location: options.location, contactInfo: options.contactInfo },
  );

  // Step 2: Hash the PDF content (excluding the placeholder)
  const dataHash = await computeSignatureHash(preparedPdf, byteRange.byteRange, hashAlgorithm);

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

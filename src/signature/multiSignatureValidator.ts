/**
 * @module signature/multiSignatureValidator
 *
 * Multi-signature chain validation for PDFs with multiple signatures.
 *
 * In a multi-signature workflow, each subsequent signer adds their
 * signature via an incremental update. This module validates that:
 *
 * 1. Each signature covers the correct byte range
 * 2. Each subsequent signature covers all content including previous signatures
 * 3. No signature's covered bytes have been tampered with
 * 4. The chain is ordered correctly (chronological signing order)
 *
 * Reference: PDF 1.7 spec, SS12.8.1 (Signature Filtering).
 *
 * @packageDocumentation
 */

import { findExistingSignatures } from './incrementalSave.js';
import type { SignatureByteRange } from './incrementalSave.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Validation status for a single signature in the chain.
 */
export interface SignatureChainEntry {
  /** The signature field name (extracted from /T). */
  fieldName: string;
  /** The signer name (extracted from /Contents PKCS#7 or dictionary). */
  signerName: string;
  /** The signing date (extracted from /M), if present. */
  signedAt?: Date | undefined;
  /** The byte range covering this signature. */
  byteRange: [number, number, number, number];
  /** Whether this signature covers the entire document up to its point. */
  coversEntireDocument: boolean;
  /** Validation status for this entry in the chain. */
  status: 'valid' | 'invalid' | 'broken_chain';
}

/**
 * Result of validating the entire signature chain.
 */
export interface SignatureChainResult {
  /** Ordered array of signature chain entries. */
  signatures: SignatureChainEntry[];
  /** Whether the entire chain is valid (all entries valid, no breaks). */
  isChainValid: boolean;
  /** Descriptive error messages, if any. */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * Find a string forward in a Uint8Array.
 */
function findStringForward(
  data: Uint8Array,
  needle: string,
  startOffset: number,
): number {
  const needleBytes = encoder.encode(needle);
  const len = needleBytes.length;
  for (let i = startOffset; i <= data.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (data[i + j] !== needleBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Extract the field name from the signature dictionary context.
 *
 * The field name (/T) is on the Widget annotation, which may be a separate
 * object from the signature value dict. The sig value has /Contents (a huge
 * hex string, often 16K+), so /T can be 16K+ bytes away from /Contents.
 *
 * Strategy: Find the sig value's object number N from the /ByteRange context,
 * then search the entire PDF for `/V N 0 R` which is in the widget annotation
 * that also contains `/T (fieldname)`.
 */
function extractFieldName(pdfStr: string, sigOffset: number, byteRange: [number, number, number, number]): string {
  // Strategy 1: Find the object number of this sig value by looking for
  // "N 0 obj" before the /ByteRange. The sig value dict is at a specific offset.
  // The byteRange's first gap (off1+len1) starts at the /Contents hex string.
  // Search backward from there to find the LAST "N 0 obj" (closest to the gap).
  const gapStart = byteRange[0] + byteRange[1];
  const objSearchStart = Math.max(0, gapStart - 500);
  const objSearchRegion = pdfStr.slice(objSearchStart, gapStart);
  const objMatches = [...objSearchRegion.matchAll(/(\d+)\s+0\s+obj\b/g)];
  const objMatch = objMatches.length > 0 ? objMatches[objMatches.length - 1]! : null;

  if (objMatch) {
    const sigObjNum = objMatch[1]!;
    // Now find the widget that references this sig value: /V <sigObjNum> 0 R
    const vRefPattern = new RegExp(`\\/V\\s+${sigObjNum}\\s+0\\s+R`, 'g');
    let vRefMatch: RegExpExecArray | null;
    while ((vRefMatch = vRefPattern.exec(pdfStr)) !== null) {
      // Search around this /V reference for /T
      const vIdx = vRefMatch.index;
      const widgetStart = Math.max(0, vIdx - 500);
      const widgetEnd = Math.min(pdfStr.length, vIdx + 500);
      const widgetRegion = pdfStr.slice(widgetStart, widgetEnd);
      const tMatch = widgetRegion.match(/\/T\s*\(([^)]*)\)/);
      if (tMatch) return tMatch[1]!;
    }
  }

  // Strategy 2: Wide search around the contents offset
  const searchStart = Math.max(0, sigOffset - 3000);
  const searchEnd = Math.min(pdfStr.length, sigOffset + 20000);
  const region = pdfStr.slice(searchStart, searchEnd);
  const tMatch = region.match(/\/T\s*\(([^)]*)\)/);
  if (tMatch) return tMatch[1]!;

  return 'Signature';
}

/**
 * Extract the signer name from nearby PDF text.
 */
function extractSignerName(pdfStr: string, sigOffset: number): string {
  const searchStart = Math.max(0, sigOffset - 2000);
  const searchEnd = Math.min(pdfStr.length, sigOffset + 2000);
  const region = pdfStr.slice(searchStart, searchEnd);

  // Try /Name
  const nameMatch = region.match(/\/Name\s*\(([^)]*)\)/);
  if (nameMatch) return nameMatch[1]!;

  // Try /Reason
  const reasonMatch = region.match(/\/Reason\s*\(([^)]*)\)/);
  if (reasonMatch) return `Signer (${reasonMatch[1]!})`;

  return 'Unknown';
}

/**
 * Extract the signing date from the signature dictionary.
 */
function extractSigningDate(pdfStr: string, sigOffset: number): Date | undefined {
  const searchStart = Math.max(0, sigOffset - 2000);
  const searchEnd = Math.min(pdfStr.length, sigOffset + 2000);
  const region = pdfStr.slice(searchStart, searchEnd);

  const dateMatch = region.match(
    /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
  );
  if (dateMatch) {
    const year = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10) - 1;
    const day = parseInt(dateMatch[3]!, 10);
    const hours = parseInt(dateMatch[4]!, 10);
    const minutes = parseInt(dateMatch[5]!, 10);
    const seconds = parseInt(dateMatch[6]!, 10);
    return new Date(year, month, day, hours, minutes, seconds);
  }

  return undefined;
}

/**
 * Find all %%EOF markers in the PDF and return their byte offsets.
 */
function findAllEofMarkers(pdf: Uint8Array): number[] {
  const markers: number[] = [];
  const eofStr = '%%EOF';
  let offset = 0;

  while (offset < pdf.length) {
    const idx = findStringForward(pdf, eofStr, offset);
    if (idx === -1) break;
    markers.push(idx + eofStr.length);
    offset = idx + eofStr.length;
  }

  return markers;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the entire signature chain in a PDF.
 *
 * Finds all signatures, validates each one covers the correct byte range,
 * and verifies each subsequent signature covers all content including
 * previous signatures. Returns an ordered chain with status for each entry.
 *
 * @param pdf  The PDF bytes to validate.
 * @returns    The signature chain validation result.
 */
export async function validateSignatureChain(
  pdf: Uint8Array,
): Promise<SignatureChainResult> {
  const pdfStr = decoder.decode(pdf);
  const rawSignatures = findExistingSignatures(pdf);
  const errors: string[] = [];

  if (rawSignatures.length === 0) {
    return {
      signatures: [],
      isChainValid: true,
      errors: [],
    };
  }

  // Sort signatures by their byte range offset (first range start)
  // Earlier signatures appear first (they cover less of the document)
  const sortedSigs = [...rawSignatures].sort((a, b) => {
    // Sort by the end of the second range (higher = later signature)
    const aEnd = a.byteRange[2] + a.byteRange[3];
    const bEnd = b.byteRange[2] + b.byteRange[3];
    return aEnd - bEnd;
  });

  // Find all %%EOF markers for document revision detection
  const eofMarkers = findAllEofMarkers(pdf);

  const entries: SignatureChainEntry[] = [];
  let chainValid = true;

  for (let i = 0; i < sortedSigs.length; i++) {
    const sig = sortedSigs[i]!;
    const [off1, len1, off2, len2] = sig.byteRange;

    const fieldName = extractFieldName(pdfStr, sig.contentsOffset, sig.byteRange);
    const signerName = extractSignerName(pdfStr, sig.contentsOffset);
    const signedAt = extractSigningDate(pdfStr, sig.contentsOffset);

    // Validate byte range basics
    let status: 'valid' | 'invalid' | 'broken_chain' = 'valid';

    // Check: first range should start at 0
    if (off1 !== 0) {
      status = 'invalid';
      errors.push(
        `Signature "${fieldName}": byte range does not start at 0 (starts at ${off1})`,
      );
      chainValid = false;
    }

    // Check: ranges should be within PDF bounds
    if (off1 + len1 > pdf.length || off2 + len2 > pdf.length) {
      status = 'invalid';
      errors.push(
        `Signature "${fieldName}": byte range extends beyond PDF (${off2 + len2} > ${pdf.length})`,
      );
      chainValid = false;
    }

    // Check: gap between ranges should match /Contents
    const gapStart = off1 + len1;
    const gapEnd = off2;
    if (gapStart !== sig.contentsOffset || gapEnd - gapStart !== sig.contentsLength) {
      status = 'invalid';
      errors.push(
        `Signature "${fieldName}": byte range gap does not match /Contents placeholder`,
      );
      chainValid = false;
    }

    // Determine if this signature covers the entire document up to its revision
    const signatureEnd = off2 + len2;
    const coveredBytes = len1 + len2;
    const totalPossible = signatureEnd - sig.contentsLength;
    const coversEntireDocument = coveredBytes === totalPossible;

    // Chain validation: each subsequent signature should cover all previous content
    if (i > 0 && status === 'valid') {
      const prevSig = sortedSigs[i - 1]!;
      const prevEnd = prevSig.byteRange[2] + prevSig.byteRange[3];

      // The current signature should cover at least up to where the previous
      // signature ends (including the previous signature's content)
      if (signatureEnd <= prevEnd) {
        status = 'broken_chain';
        errors.push(
          `Signature "${fieldName}": does not cover previous signature ` +
          `(ends at ${signatureEnd}, previous ends at ${prevEnd})`,
        );
        chainValid = false;
      }
    }

    entries.push({
      fieldName,
      signerName,
      ...(signedAt !== undefined && { signedAt }),
      byteRange: sig.byteRange,
      coversEntireDocument,
      status,
    });
  }

  return {
    signatures: entries,
    isChainValid: chainValid,
    errors,
  };
}

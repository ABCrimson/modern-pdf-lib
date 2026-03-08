/**
 * @module signature/documentDiff
 *
 * Document modification detection — compares the signed version of a PDF
 * against the current version to identify what changed after signing.
 *
 * Uses the ByteRange to extract the signed content (the bytes that were
 * hashed when the signature was created), parses both versions, and
 * compares page counts, page content hashes, form field values,
 * annotation counts, and metadata.
 *
 * @packageDocumentation
 */

import { findSignatures } from './byteRange.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single difference found between signed and current content.
 */
export interface DiffEntry {
  /** The category of change detected. */
  type:
    | 'page_added'
    | 'page_removed'
    | 'page_modified'
    | 'form_field_changed'
    | 'annotation_changed'
    | 'metadata_changed';
  /** Zero-based page index (for page-related changes). */
  pageIndex?: number | undefined;
  /** Form field name (for form field changes). */
  fieldName?: string | undefined;
  /** Human-readable description of the change. */
  description: string;
}

/**
 * Result of comparing signed content against the current PDF.
 */
export interface DocumentDiff {
  /** Which signature was used as the baseline (zero-based). */
  signatureIndex: number;
  /** The signing date from the signature dictionary, if available. */
  signedAt?: Date | undefined;
  /** All detected changes between the signed and current version. */
  changes: DiffEntry[];
  /** Whether any changes were detected at all. */
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * FNV-1a 32-bit hash for fast content comparison.
 */
function fnv1a(data: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Extract the signed portion of the PDF using ByteRange.
 *
 * The ByteRange specifies two regions: before and after the /Contents
 * placeholder. The "signed version" is the PDF bytes composed of those
 * two regions concatenated.
 */
function extractSignedContent(
  pdf: Uint8Array,
  byteRange: [number, number, number, number],
): Uint8Array {
  const [off1, len1, off2, len2] = byteRange;
  const result = new Uint8Array(len1 + len2);
  result.set(pdf.subarray(off1, off1 + len1), 0);
  result.set(pdf.subarray(off2, off2 + len2), len1);
  return result;
}

/**
 * Count Pages objects in PDF text (by scanning for /Type /Page entries
 * that are NOT /Type /Pages).
 */
function countPages(pdfText: string): number {
  let count = 0;
  const pageRegex = /\/Type\s*\/Page\b(?!\s*s)/g;
  while (pageRegex.exec(pdfText) !== null) {
    count++;
  }
  return count;
}

/**
 * Extract raw page content hashes.
 *
 * Scans for page objects and hashes the surrounding dictionary content
 * to detect modifications. Returns an array of hashes indexed by page order.
 */
function extractPageHashes(pdfBytes: Uint8Array): number[] {
  const text = decoder.decode(pdfBytes);
  const hashes: number[] = [];
  const pageRegex = /\/Type\s*\/Page\b(?!\s*s)/g;
  let match: RegExpExecArray | null;

  while ((match = pageRegex.exec(text)) !== null) {
    // Extract a window around the page dictionary
    const start = Math.max(0, match.index - 500);
    const end = Math.min(pdfBytes.length, match.index + 2000);
    const pageChunk = pdfBytes.subarray(start, end);
    hashes.push(fnv1a(pageChunk));
  }

  return hashes;
}

/**
 * Extract form field names and their values.
 *
 * Scans for /T (field name) and /V (field value) pairs in the PDF text.
 */
function extractFormFields(pdfText: string): Map<string, string> {
  const fields = new Map<string, string>();
  // Match field dictionaries containing /T and optionally /V
  const fieldRegex = /\/T\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(pdfText)) !== null) {
    const name = match[1]!;
    // Search nearby for /V value
    const searchRegion = pdfText.slice(
      Math.max(0, match.index - 500),
      Math.min(pdfText.length, match.index + 500),
    );

    const valueMatch = searchRegion.match(/\/V\s*(?:\(([^)]*)\)|\/(\S+))/);
    const value = valueMatch
      ? (valueMatch[1] ?? valueMatch[2] ?? '')
      : '';
    fields.set(name, value);
  }

  return fields;
}

/**
 * Count annotations per page.
 *
 * Returns an array of annotation counts. Each entry corresponds to
 * the number of /Annots entries found near each page dictionary.
 */
function countAnnotations(pdfText: string): number[] {
  const counts: number[] = [];
  const pageRegex = /\/Type\s*\/Page\b(?!\s*s)/g;
  let match: RegExpExecArray | null;

  while ((match = pageRegex.exec(pdfText)) !== null) {
    const searchEnd = Math.min(pdfText.length, match.index + 2000);
    const region = pdfText.slice(match.index, searchEnd);

    const annotsMatch = region.match(/\/Annots\s*\[([^\]]*)\]/);
    if (annotsMatch) {
      // Count references (N N R patterns)
      const refs = annotsMatch[1]!.match(/\d+\s+\d+\s+R/g);
      counts.push(refs ? refs.length : 0);
    } else {
      counts.push(0);
    }
  }

  return counts;
}

/**
 * Extract key metadata entries from PDF text.
 */
function extractMetadata(pdfText: string): Map<string, string> {
  const meta = new Map<string, string>();
  const keys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'];

  for (const key of keys) {
    const regex = new RegExp(`/${key}\\s*\\(([^)]*)\\)`);
    const match = pdfText.match(regex);
    if (match) {
      meta.set(key, match[1]!);
    }
  }

  return meta;
}

/**
 * Extract the /M (signing date) from a signature dictionary near the
 * given ByteRange match.
 */
function extractSigningDate(
  pdfText: string,
  byteRangeOffset: number,
): Date | undefined {
  const searchStart = Math.max(0, byteRangeOffset - 1000);
  const searchEnd = Math.min(pdfText.length, byteRangeOffset + 2000);
  const region = pdfText.slice(searchStart, searchEnd);

  const dateMatch = region.match(
    /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
  );
  if (!dateMatch) return undefined;

  const year = parseInt(dateMatch[1]!, 10);
  const month = parseInt(dateMatch[2]!, 10) - 1;
  const day = parseInt(dateMatch[3]!, 10);
  const hours = parseInt(dateMatch[4]!, 10);
  const minutes = parseInt(dateMatch[5]!, 10);
  const seconds = parseInt(dateMatch[6]!, 10);

  return new Date(year, month, day, hours, minutes, seconds);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Diff the signed content of a PDF against its current state.
 *
 * Extracts the signed bytes using the ByteRange of a specific signature
 * (or the latest signature by default), parses both versions, and
 * compares page count, page content hashes, form field values,
 * annotation counts, and metadata.
 *
 * @param pdf              The current PDF bytes.
 * @param signatureIndex   Zero-based index of the signature to diff against.
 *                         If not provided, uses the last (most recent) signature.
 * @returns                A DocumentDiff describing all detected changes.
 *
 * @example
 * ```ts
 * import { diffSignedContent } from 'modern-pdf-lib/signature';
 *
 * const diff = await diffSignedContent(pdfBytes);
 * if (diff.hasChanges) {
 *   for (const entry of diff.changes) {
 *     console.log(`${entry.type}: ${entry.description}`);
 *   }
 * }
 * ```
 */
export async function diffSignedContent(
  pdf: Uint8Array,
  signatureIndex?: number | undefined,
): Promise<DocumentDiff> {
  const signatures = findSignatures(pdf);

  if (signatures.length === 0) {
    return {
      signatureIndex: 0,
      changes: [],
      hasChanges: false,
    };
  }

  // Resolve the target signature index
  const targetIdx = signatureIndex ?? signatures.length - 1;

  if (targetIdx < 0 || targetIdx >= signatures.length) {
    throw new Error(
      `Signature index ${targetIdx} out of range (0–${signatures.length - 1})`,
    );
  }

  const sig = signatures[targetIdx]!;
  const changes: DiffEntry[] = [];

  // Extract the signed portion of the PDF
  const signedContent = extractSignedContent(pdf, sig.byteRange);

  // Decode both versions as text for analysis
  const currentText = decoder.decode(pdf);
  const signedText = decoder.decode(signedContent);

  // Extract signing date
  const pdfFullText = decoder.decode(pdf);
  const byteRangeStr = `/ByteRange`;
  let searchOffset = 0;
  let dateOffset = 0;
  for (let i = 0; i <= targetIdx; i++) {
    const idx = pdfFullText.indexOf(byteRangeStr, searchOffset);
    if (idx !== -1) {
      dateOffset = idx;
      searchOffset = idx + byteRangeStr.length;
    }
  }
  const signedAt = extractSigningDate(pdfFullText, dateOffset);

  // -----------------------------------------------------------------------
  // Compare page counts
  // -----------------------------------------------------------------------
  const signedPageCount = countPages(signedText);
  const currentPageCount = countPages(currentText);

  if (currentPageCount > signedPageCount) {
    const added = currentPageCount - signedPageCount;
    for (let i = 0; i < added; i++) {
      changes.push({
        type: 'page_added',
        pageIndex: signedPageCount + i,
        description: `Page ${signedPageCount + i + 1} was added after signing`,
      });
    }
  } else if (currentPageCount < signedPageCount) {
    const removed = signedPageCount - currentPageCount;
    for (let i = 0; i < removed; i++) {
      changes.push({
        type: 'page_removed',
        pageIndex: currentPageCount + i,
        description: `Page ${currentPageCount + i + 1} was removed after signing`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Compare page content hashes
  // -----------------------------------------------------------------------
  const signedPageHashes = extractPageHashes(signedContent);
  const currentPageHashes = extractPageHashes(pdf);

  const compareCount = Math.min(signedPageHashes.length, currentPageHashes.length);
  for (let i = 0; i < compareCount; i++) {
    if (signedPageHashes[i] !== currentPageHashes[i]) {
      changes.push({
        type: 'page_modified',
        pageIndex: i,
        description: `Page ${i + 1} content was modified after signing`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Compare form field values
  // -----------------------------------------------------------------------
  const signedFields = extractFormFields(signedText);
  const currentFields = extractFormFields(currentText);

  // Check for changed or new fields
  for (const [name, currentValue] of currentFields) {
    const signedValue = signedFields.get(name);
    if (signedValue === undefined) {
      changes.push({
        type: 'form_field_changed',
        fieldName: name,
        description: `Form field "${name}" was added after signing`,
      });
    } else if (signedValue !== currentValue) {
      changes.push({
        type: 'form_field_changed',
        fieldName: name,
        description: `Form field "${name}" value was changed after signing`,
      });
    }
  }

  // Check for removed fields
  for (const [name] of signedFields) {
    if (!currentFields.has(name)) {
      changes.push({
        type: 'form_field_changed',
        fieldName: name,
        description: `Form field "${name}" was removed after signing`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Compare annotation counts
  // -----------------------------------------------------------------------
  const signedAnnotCounts = countAnnotations(signedText);
  const currentAnnotCounts = countAnnotations(currentText);

  const annotCompareCount = Math.min(
    signedAnnotCounts.length,
    currentAnnotCounts.length,
  );
  for (let i = 0; i < annotCompareCount; i++) {
    if (signedAnnotCounts[i] !== currentAnnotCounts[i]) {
      changes.push({
        type: 'annotation_changed',
        pageIndex: i,
        description: `Annotations on page ${i + 1} changed (${signedAnnotCounts[i]} -> ${currentAnnotCounts[i]})`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Compare metadata
  // -----------------------------------------------------------------------
  const signedMeta = extractMetadata(signedText);
  const currentMeta = extractMetadata(currentText);

  for (const [key, currentValue] of currentMeta) {
    const signedValue = signedMeta.get(key);
    if (signedValue !== currentValue) {
      changes.push({
        type: 'metadata_changed',
        description: `Metadata "${key}" was changed after signing`,
      });
    }
  }

  for (const [key] of signedMeta) {
    if (!currentMeta.has(key)) {
      changes.push({
        type: 'metadata_changed',
        description: `Metadata "${key}" was removed after signing`,
      });
    }
  }

  return {
    signatureIndex: targetIdx,
    signedAt,
    changes,
    hasChanges: changes.length > 0,
  };
}

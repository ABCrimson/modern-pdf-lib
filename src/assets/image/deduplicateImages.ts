/**
 * @module assets/image/deduplicateImages
 *
 * Image deduplication for PDF documents.
 *
 * Detects identical image XObjects by hashing their stream data and
 * replaces duplicates with references to a single canonical copy.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import type { PdfDocument } from '../../core/pdfDocument.js';
import {
  PdfDict,
  PdfName,
  PdfRef,
  PdfStream,
} from '../../core/pdfObjects.js';
import { extractImages } from './imageExtract.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Report from image deduplication.
 */
export interface DeduplicationReport {
  /** Total number of image XObjects found. */
  readonly totalImages: number;
  /** Number of unique images (after deduplication). */
  readonly uniqueImages: number;
  /** Number of duplicate references replaced. */
  readonly duplicatesRemoved: number;
  /** Estimated bytes saved by deduplication. */
  readonly bytesSaved: number;
}

// ---------------------------------------------------------------------------
// Internal: FNV-1a hash
// ---------------------------------------------------------------------------

/**
 * Compute a fast FNV-1a hash of a byte array.
 *
 * This is used instead of SHA-256 because:
 * 1. It's synchronous (no need for crypto.subtle)
 * 2. It's fast for large buffers
 * 3. We only need collision resistance within a single document
 *
 * Returns a 64-char hex string (two 32-bit hashes concatenated).
 * @internal
 */
function hashBytes(data: Uint8Array): string {
  // First pass: standard FNV-1a
  let h1 = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h1 ^= data[i]!;
    h1 = Math.imul(h1, 0x01000193);
  }

  // Second pass: FNV-1a with different offset basis for more bits
  let h2 = 0x01000193;
  for (let i = data.length - 1; i >= 0; i--) {
    h2 ^= data[i]!;
    h2 = Math.imul(h2, 0x811c9dc5);
  }

  // Combine with length for extra discrimination
  const h3 = (data.length * 0x9e3779b9) | 0;

  return (
    ((h1 >>> 0).toString(16).padStart(8, '0')) +
    ((h2 >>> 0).toString(16).padStart(8, '0')) +
    ((h3 >>> 0).toString(16).padStart(8, '0'))
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deduplicate identical images in a PDF document.
 *
 * Scans all image XObjects, hashes their compressed stream data (plus
 * dimensions and filter), and replaces duplicate references in page
 * resource dictionaries with the canonical (first-seen) copy.
 *
 * This operation modifies the document in-place. Duplicate streams
 * are not removed from the object registry (they become unreferenced
 * and will be omitted on save if the writer supports garbage collection).
 *
 * @param doc - A parsed `PdfDocument` (from `loadPdf()`).
 * @returns A report summarizing deduplication results.
 *
 * @example
 * ```ts
 * import { loadPdf, deduplicateImages } from 'modern-pdf-lib';
 *
 * const doc = await loadPdf(pdfBytes);
 * const report = await deduplicateImages(doc);
 *
 * console.log(`Removed ${report.duplicatesRemoved} duplicate images`);
 * console.log(`Saved ~${(report.bytesSaved / 1024).toFixed(0)} KB`);
 *
 * const optimizedBytes = await doc.save();
 * ```
 */
export function deduplicateImages(doc: PdfDocument): DeduplicationReport {
  const images = extractImages(doc);

  // Build hash → canonical ref mapping
  // Hash includes dimensions, filter, and stream data for accuracy
  const hashToCanonical = new Map<string, { ref: PdfRef; size: number }>();
  const duplicates: { image: typeof images[0]; canonicalRef: PdfRef }[] = [];

  for (const img of images) {
    // Build a composite hash key: dimensions + filter + data
    const key =
      `${img.width}x${img.height}:${img.filters.join(',')}:` +
      hashBytes(img.stream.data);

    const existing = hashToCanonical.get(key);
    if (existing) {
      // This is a duplicate
      duplicates.push({ image: img, canonicalRef: existing.ref });
    } else {
      // First occurrence — this is the canonical copy
      hashToCanonical.set(key, { ref: img.ref, size: img.compressedSize });
    }
  }

  // Replace duplicate references in page resource dictionaries
  let bytesSaved = 0;

  for (const { image, canonicalRef } of duplicates) {
    const pages = doc.getPages();
    const page = pages[image.pageIndex];
    if (!page) continue;

    const resources = page.getOriginalResources();
    if (!resources) continue;

    const xObjEntry = resources.get('/XObject');
    if (!xObjEntry) continue;

    let xObjDict: PdfDict | undefined;
    if (xObjEntry.kind === 'dict') {
      xObjDict = xObjEntry as PdfDict;
    } else if (xObjEntry.kind === 'ref') {
      const resolved = page.getRegistry().resolve(xObjEntry as PdfRef);
      if (resolved && resolved.kind === 'dict') {
        xObjDict = resolved as PdfDict;
      }
    }

    if (!xObjDict) continue;

    // Replace the reference for this image name with the canonical ref
    xObjDict.set(image.name, canonicalRef);
    bytesSaved += image.compressedSize;
  }

  return {
    totalImages: images.length,
    uniqueImages: hashToCanonical.size,
    duplicatesRemoved: duplicates.length,
    bytesSaved,
  };
}

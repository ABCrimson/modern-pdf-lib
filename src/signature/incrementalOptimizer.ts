/**
 * @module signature/incrementalOptimizer
 *
 * Incremental save size optimization.
 *
 * When performing incremental updates on a PDF, naive implementations
 * re-emit every modified object even if the content is identical to
 * the original. This module provides object-level diffing using FNV-1a
 * hashing to detect truly-changed objects and deduplicates identical
 * updates, producing minimal incremental appendices.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single object change for an incremental update.
 */
export interface IncrementalChange {
  /** The PDF object number. */
  objectNumber: number;
  /** The generation number. */
  generationNumber: number;
  /** The new content for this object (raw bytes). */
  newContent: Uint8Array;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * FNV-1a 32-bit hash.
 *
 * A fast, non-cryptographic hash with good distribution properties.
 * Used for content comparison and deduplication.
 *
 * @param data  The bytes to hash.
 * @returns     A 32-bit unsigned hash as a hex string.
 */
export function computeObjectHash(data: Uint8Array): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Extract object boundaries from PDF bytes.
 *
 * Scans for `N G obj ... endobj` patterns and returns a map of
 * object number to the raw content bytes.
 */
function extractObjectContents(
  pdf: Uint8Array,
): Map<number, { gen: number; content: Uint8Array }> {
  const text = decoder.decode(pdf);
  const objects = new Map<number, { gen: number; content: Uint8Array }>();

  const objRegex = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objRegex.exec(text)) !== null) {
    const objNum = parseInt(match[1]!, 10);
    const genNum = parseInt(match[2]!, 10);
    const objStart = match.index;

    // Find the corresponding endobj
    const endObjIdx = text.indexOf('endobj', objStart + match[0].length);
    if (endObjIdx === -1) continue;

    const endObjEnd = endObjIdx + 6; // 'endobj'.length
    const content = pdf.subarray(objStart, endObjEnd);

    objects.set(objNum, { gen: genNum, content });
  }

  return objects;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the list of object numbers whose content actually changed
 * between two versions of a PDF.
 *
 * Extracts all objects from both versions, hashes their content
 * using FNV-1a, and returns the object numbers where the hashes
 * differ.
 *
 * @param original  The original PDF bytes.
 * @param modified  The modified PDF bytes.
 * @returns         Array of object numbers that have different content.
 *
 * @example
 * ```ts
 * const changed = findChangedObjects(originalPdf, modifiedPdf);
 * console.log(`${changed.length} objects actually changed`);
 * ```
 */
export function findChangedObjects(
  original: Uint8Array,
  modified: Uint8Array,
): number[] {
  const originalObjs = extractObjectContents(original);
  const modifiedObjs = extractObjectContents(modified);

  const changedObjNums: number[] = [];

  // Check objects in the modified version
  for (const [objNum, modObj] of modifiedObjs) {
    const origObj = originalObjs.get(objNum);

    if (!origObj) {
      // New object — counts as changed
      changedObjNums.push(objNum);
      continue;
    }

    // Compare hashes
    const origHash = computeObjectHash(origObj.content);
    const modHash = computeObjectHash(modObj.content);

    if (origHash !== modHash) {
      // Also verify byte-level to eliminate hash collisions
      if (!bytesEqual(origObj.content, modObj.content)) {
        changedObjNums.push(objNum);
      }
    }
  }

  return changedObjNums.sort((a, b) => a - b);
}

/**
 * Compare two Uint8Arrays for equality.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Optimize an incremental save by removing unchanged objects and
 * deduplicating identical updates.
 *
 * This function:
 * 1. Computes FNV-1a hashes of each change's content
 * 2. Compares against the original PDF objects to skip unchanged ones
 * 3. Deduplicates identical change entries (same content for same object)
 * 4. Builds a minimal incremental update containing only truly changed objects
 *
 * @param originalPdf  The original PDF bytes.
 * @param changes      The list of proposed changes.
 * @returns            The optimized PDF bytes with minimal incremental update.
 *
 * @example
 * ```ts
 * import { optimizeIncrementalSave } from 'modern-pdf-lib/signature';
 *
 * const optimizedPdf = optimizeIncrementalSave(originalPdf, [
 *   { objectNumber: 5, generationNumber: 0, newContent: newObj5 },
 *   { objectNumber: 7, generationNumber: 0, newContent: newObj7 },
 * ]);
 * ```
 */
export function optimizeIncrementalSave(
  originalPdf: Uint8Array,
  changes: IncrementalChange[],
): Uint8Array {
  if (changes.length === 0) {
    return originalPdf;
  }

  const originalObjs = extractObjectContents(originalPdf);

  // Step 1: Filter out unchanged objects
  const actualChanges: IncrementalChange[] = [];
  const seenHashes = new Set<string>();

  for (const change of changes) {
    const changeHash = computeObjectHash(change.newContent);

    // Check if this object exists in the original with the same content
    const origObj = originalObjs.get(change.objectNumber);
    if (origObj) {
      const origHash = computeObjectHash(origObj.content);
      if (origHash === changeHash && bytesEqual(origObj.content, change.newContent)) {
        // Content is identical — skip this change
        continue;
      }
    }

    // Deduplicate: skip if we've already seen this exact change
    const dedupeKey = `${change.objectNumber}:${change.generationNumber}:${changeHash}`;
    if (seenHashes.has(dedupeKey)) {
      continue;
    }
    seenHashes.add(dedupeKey);

    actualChanges.push(change);
  }

  // If no changes remain after optimization, return the original
  if (actualChanges.length === 0) {
    return originalPdf;
  }

  // Step 2: Build the minimal incremental update
  const appendix = buildOptimizedAppendix(originalPdf, actualChanges);

  const result = new Uint8Array(originalPdf.length + appendix.length);
  result.set(originalPdf, 0);
  result.set(appendix, originalPdf.length);

  return result;
}

/**
 * Build the incremental update appendix for the given changes.
 */
function buildOptimizedAppendix(
  originalPdf: Uint8Array,
  changes: IncrementalChange[],
): Uint8Array {
  const pdfText = decoder.decode(originalPdf);

  // Find /Size in the last trailer
  const sizeMatches = pdfText.match(/\/Size\s+(\d+)/g);
  const lastSizeMatch = sizeMatches?.[sizeMatches.length - 1]?.match(
    /\/Size\s+(\d+)/,
  );
  const currentSize = lastSizeMatch ? parseInt(lastSizeMatch[1]!, 10) : 100;

  // Find /Root reference
  const rootMatch = pdfText.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  const rootRef = rootMatch
    ? `${rootMatch[1]} ${rootMatch[2]} R`
    : '1 0 R';

  // Find /Info reference
  const infoMatch = pdfText.match(/\/Info\s+(\d+)\s+(\d+)\s+R/);

  // Find previous xref offset
  const startxrefIdx = pdfText.lastIndexOf('startxref');
  const afterStartxref = pdfText.slice(startxrefIdx + 9).trim();
  const xrefOffMatch = afterStartxref.match(/^(\d+)/);
  const prevXrefOffset = xrefOffMatch ? parseInt(xrefOffMatch[1]!, 10) : 0;

  // Determine the max object number in changes to compute new /Size
  let maxObjNum = currentSize - 1;
  for (const change of changes) {
    if (change.objectNumber > maxObjNum) {
      maxObjNum = change.objectNumber;
    }
  }
  const newSize = Math.max(currentSize, maxObjNum + 1);

  // Sort changes by object number for organized xref
  const sortedChanges = [...changes].sort(
    (a, b) => a.objectNumber - b.objectNumber,
  );

  // Build the appendix
  let appendix = '\n';
  const objOffsets = new Map<number, number>();

  for (const change of sortedChanges) {
    const offset = originalPdf.length + encoder.encode(appendix).length;
    objOffsets.set(change.objectNumber, offset);

    appendix += `${change.objectNumber} ${change.generationNumber} obj\n`;
    // Decode the content and append it
    const contentStr = decoder.decode(change.newContent);
    appendix += contentStr;
    if (!contentStr.endsWith('\n')) appendix += '\n';
    appendix += `endobj\n`;
  }

  // Build xref entries
  // Group consecutive object numbers into subsections
  const xrefOffset = originalPdf.length + encoder.encode(appendix).length;
  appendix += `xref\n`;

  const objNums = sortedChanges.map((c) => c.objectNumber).sort((a, b) => a - b);
  const groups = groupConsecutive(objNums);

  for (const group of groups) {
    appendix += `${group[0]} ${group.length}\n`;
    for (const objNum of group) {
      const off = objOffsets.get(objNum) ?? 0;
      appendix += `${off.toString().padStart(10, '0')} 00000 n \n`;
    }
  }

  // Trailer
  appendix += `trailer\n`;
  appendix += `<<\n`;
  appendix += `/Size ${newSize}\n`;
  appendix += `/Root ${rootRef}\n`;
  if (infoMatch) {
    appendix += `/Info ${infoMatch[1]} ${infoMatch[2]} R\n`;
  }
  appendix += `/Prev ${prevXrefOffset}\n`;
  appendix += `>>\n`;
  appendix += `startxref\n`;
  appendix += `${xrefOffset}\n`;
  appendix += `%%EOF\n`;

  return encoder.encode(appendix);
}

/**
 * Group an array of sorted numbers into arrays of consecutive sequences.
 */
function groupConsecutive(nums: number[]): number[][] {
  if (nums.length === 0) return [];

  const groups: number[][] = [];
  let current: number[] = [nums[0]!];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1]! + 1) {
      current.push(nums[i]!);
    } else {
      groups.push(current);
      current = [nums[i]!];
    }
  }
  groups.push(current);

  return groups;
}

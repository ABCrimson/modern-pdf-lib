/**
 * @module signature/incrementalSave
 *
 * Incremental save with signature preservation.
 *
 * Provides the ability to perform append-only incremental updates
 * to a PDF while preserving all existing digital signatures.
 * This is essential for multi-signature workflows where each signer
 * adds their signature without invalidating previous signatures.
 *
 * Key guarantees:
 * - Original bytes are never modified (pure append)
 * - All existing signature byte ranges remain intact
 * - Each update appends objects + xref + trailer with /Prev pointer
 *
 * Reference: PDF 1.7 spec, SS7.5.6 (Incremental Updates),
 *            SS12.8 (Digital Signatures).
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Byte range for an existing signature.
 */
export interface SignatureByteRange {
  /** The four-element byte range array [offset1, length1, offset2, length2]. */
  byteRange: [number, number, number, number];
  /** Offset of the /Contents hex string placeholder. */
  contentsOffset: number;
  /** Length of the /Contents hex string (including angle brackets). */
  contentsLength: number;
}

/**
 * Options for incremental save with signature preservation.
 */
export interface IncrementalSaveOptions {
  /** Apply FlateDecode compression to new stream objects. Default: true. */
  compress?: boolean | undefined;
  /** Preserve existing signatures by verifying byte ranges. Default: true. */
  preserveSignatures?: boolean | undefined;
}

/**
 * Options for pure append-only incremental updates.
 */
export interface AppendOptions {
  /** Apply FlateDecode compression. Default: false. */
  compress?: boolean | undefined;
}

/**
 * An object to be appended in an incremental update.
 */
export interface IncrementalObject {
  /** The PDF object number. */
  objectNumber: number;
  /** The generation number (usually 0). */
  generationNumber: number;
  /** The serialized object data (everything between `N G obj\n` and `\nendobj`). */
  data: Uint8Array;
}

/**
 * Information extracted from an existing PDF trailer.
 */
export interface TrailerInfo {
  /** The /Size value (total number of objects). */
  size: number;
  /** The /Root reference string (e.g., "1 0 R"). */
  rootRef: string;
  /** The /Info reference string (e.g., "4 0 R"), if present. */
  infoRef?: string | undefined;
  /** The byte offset of the previous cross-reference section. */
  prevXrefOffset: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

/**
 * Find a string in a Uint8Array searching forward from startOffset.
 */
function findForward(
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
 * Simple FNV-1a hash for change detection.
 */
function fnv1aHash(data: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Growable byte buffer for incremental appendix construction.
 */
class ByteBuffer {
  private chunks: Uint8Array[] = [];
  private _offset = 0;

  get offset(): number {
    return this._offset;
  }

  write(data: Uint8Array): void {
    this.chunks.push(data);
    this._offset += data.length;
  }

  writeString(str: string): void {
    this.write(encoder.encode(str));
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this._offset);
    let pos = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Public API: findExistingSignatures
// ---------------------------------------------------------------------------

/**
 * Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.
 *
 * @param pdf  The PDF bytes to scan.
 * @returns    Array of signature byte range descriptors.
 */
export function findExistingSignatures(pdf: Uint8Array): SignatureByteRange[] {
  const text = decoder.decode(pdf);
  const results: SignatureByteRange[] = [];

  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let match: RegExpExecArray | null;

  while ((match = byteRangeRegex.exec(text)) !== null) {
    const br: [number, number, number, number] = [
      parseInt(match[1]!, 10),
      parseInt(match[2]!, 10),
      parseInt(match[3]!, 10),
      parseInt(match[4]!, 10),
    ];

    // Find the /Contents hex string near this ByteRange
    const searchStart = Math.max(0, match.index - 2000);
    const searchEnd = Math.min(text.length, match.index + 2000);
    const searchRegion = text.slice(searchStart, searchEnd);

    const contentsKeyIdx = searchRegion.indexOf('/Contents <');
    if (contentsKeyIdx !== -1) {
      const hexStart = contentsKeyIdx + '/Contents '.length;
      const absoluteHexStart = searchStart + hexStart;

      const closingBracket = text.indexOf('>', absoluteHexStart + 1);
      if (closingBracket !== -1) {
        const contentsLen = closingBracket - absoluteHexStart + 1;

        results.push({
          byteRange: br,
          contentsOffset: absoluteHexStart,
          contentsLength: contentsLen,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: validateByteRangeIntegrity
// ---------------------------------------------------------------------------

/**
 * Verify that no existing signature's covered bytes would overlap
 * with content appended after the current end of file.
 *
 * For a valid incremental update, all existing signature byte ranges
 * must reference bytes within the original file. Any overlap with
 * new content appended after the last %%EOF would break signatures.
 *
 * @param pdf         The current PDF bytes.
 * @param signatures  The signature byte ranges to validate.
 * @returns           `true` if all byte ranges are valid and non-overlapping with appended content.
 */
export function validateByteRangeIntegrity(
  pdf: Uint8Array,
  signatures: SignatureByteRange[],
): boolean {
  const pdfLength = pdf.length;

  for (const sig of signatures) {
    const [off1, len1, off2, len2] = sig.byteRange;

    // Check that byte ranges are within the PDF
    if (off1 < 0 || len1 < 0 || off2 < 0 || len2 < 0) return false;
    if (off1 + len1 > pdfLength) return false;
    if (off2 + len2 > pdfLength) return false;

    // Check that the gap between the two ranges corresponds to the /Contents
    const gapStart = off1 + len1;
    const gapEnd = off2;
    if (gapEnd < gapStart) return false;

    // The gap should correspond to the /Contents hex string
    if (sig.contentsOffset !== gapStart) return false;
    if (sig.contentsLength !== gapEnd - gapStart) return false;

    // Check that the ranges don't overlap each other
    if (off2 < off1 + len1) return false;
  }

  // Check no signatures overlap with each other
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const a = signatures[i]!;
      const b = signatures[j]!;

      // The /Contents regions should not overlap
      const aGapStart = a.byteRange[0] + a.byteRange[1];
      const aGapEnd = a.byteRange[2];
      const bGapStart = b.byteRange[0] + b.byteRange[1];
      const bGapEnd = b.byteRange[2];

      if (aGapStart < bGapEnd && bGapStart < aGapEnd) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Public API: parseExistingTrailer
// ---------------------------------------------------------------------------

/**
 * Parse the existing trailer from a PDF to extract /Size, /Root, /Info,
 * and the previous xref offset.
 *
 * Scans backward from the end of the file for `startxref` and the
 * trailer dictionary.
 *
 * @param pdf  The PDF bytes.
 * @returns    Parsed trailer information.
 */
export function parseExistingTrailer(pdf: Uint8Array): TrailerInfo {
  const text = decoder.decode(pdf);

  // Find startxref
  const startxrefIdx = text.lastIndexOf('startxref');
  if (startxrefIdx === -1) {
    throw new Error('Cannot find startxref in PDF — file may be corrupted');
  }

  const afterStartxref = text.slice(startxrefIdx + 9).trim();
  const xrefOffsetMatch = afterStartxref.match(/^(\d+)/);
  if (!xrefOffsetMatch) {
    throw new Error('Cannot parse xref offset from startxref');
  }
  const prevXrefOffset = parseInt(xrefOffsetMatch[1]!, 10);

  // Find the LAST /Size (in the most recent trailer)
  const sizeMatches = [...text.matchAll(/\/Size\s+(\d+)/g)];
  if (sizeMatches.length === 0) {
    throw new Error('Cannot find /Size in PDF trailer');
  }
  const lastSizeMatch = sizeMatches[sizeMatches.length - 1]!;
  const size = parseInt(lastSizeMatch[1]!, 10);

  // Find /Root
  const rootMatch = text.match(/\/Root\s+(\d+\s+\d+\s+R)/);
  if (!rootMatch) {
    throw new Error('Cannot find /Root in PDF trailer');
  }
  const rootRef = rootMatch[1]!;

  // Find /Info (optional)
  let infoRef: string | undefined;
  const infoMatch = text.match(/\/Info\s+(\d+\s+\d+\s+R)/);
  if (infoMatch) {
    infoRef = infoMatch[1]!;
  }

  return {
    size,
    rootRef,
    ...(infoRef !== undefined && { infoRef }),
    prevXrefOffset,
  };
}

// ---------------------------------------------------------------------------
// Public API: saveIncremental (with signature preservation)
// ---------------------------------------------------------------------------

/**
 * Perform an incremental save that preserves ALL existing signatures.
 *
 * Takes the original PDF bytes and a modified version, detects which
 * objects changed by comparing object hashes, and appends only the
 * changed/new objects after the original %%EOF. This ensures all
 * existing signature byte ranges remain intact.
 *
 * @param originalPdf  The original (possibly signed) PDF bytes.
 * @param modifiedPdf  The modified PDF bytes with changes.
 * @param options      Options for the incremental save.
 * @returns            The incrementally saved PDF bytes.
 */
export function saveIncrementalWithSignaturePreservation(
  originalPdf: Uint8Array,
  modifiedPdf: Uint8Array,
  options?: IncrementalSaveOptions,
): Uint8Array {
  const preserveSignatures = options?.preserveSignatures ?? true;

  // Step 1: Find existing signatures in the original PDF
  if (preserveSignatures) {
    const existingSignatures = findExistingSignatures(originalPdf);
    if (existingSignatures.length > 0) {
      const valid = validateByteRangeIntegrity(originalPdf, existingSignatures);
      if (!valid) {
        throw new Error(
          'Existing signature byte ranges are invalid — cannot perform incremental save',
        );
      }
    }
  }

  // Step 2: Parse objects from both PDFs to detect changes
  const originalObjects = parseObjectBodies(originalPdf);
  const modifiedObjects = parseObjectBodies(modifiedPdf);

  // Step 3: Detect changed objects by comparing hashes
  const changedObjects: Map<number, { gen: number; data: Uint8Array }> = new Map();

  for (const [objNum, modObj] of modifiedObjects) {
    const origObj = originalObjects.get(objNum);
    if (!origObj || fnv1aHash(origObj.data) !== fnv1aHash(modObj.data)) {
      changedObjects.set(objNum, modObj);
    }
  }

  // Step 4: Detect new objects (in modified but not in original)
  for (const [objNum, modObj] of modifiedObjects) {
    if (!originalObjects.has(objNum)) {
      changedObjects.set(objNum, modObj);
    }
  }

  if (changedObjects.size === 0) {
    // No changes — return original
    return originalPdf;
  }

  // Step 5: Build the incremental objects list
  const incrementalObjects: IncrementalObject[] = [];
  for (const [objNum, obj] of changedObjects) {
    incrementalObjects.push({
      objectNumber: objNum,
      generationNumber: obj.gen,
      data: obj.data,
    });
  }

  // Step 6: Append the incremental update
  return appendIncrementalUpdate(originalPdf, incrementalObjects, {
    compress: options?.compress,
  });
}

/**
 * Parse object bodies from a PDF for comparison.
 * Returns a map of objectNumber -> { gen, data }.
 */
function parseObjectBodies(
  pdf: Uint8Array,
): Map<number, { gen: number; data: Uint8Array }> {
  const text = decoder.decode(pdf);
  const objects = new Map<number, { gen: number; data: Uint8Array }>();

  const objRegex = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objRegex.exec(text)) !== null) {
    const objNum = parseInt(match[1]!, 10);
    const genNum = parseInt(match[2]!, 10);
    const bodyStart = match.index + match[0].length;

    // Find the corresponding endobj
    const endIdx = text.indexOf('endobj', bodyStart);
    if (endIdx === -1) continue;

    const bodyBytes = pdf.subarray(bodyStart, endIdx);
    objects.set(objNum, { gen: genNum, data: bodyBytes });
  }

  return objects;
}

// ---------------------------------------------------------------------------
// Public API: appendIncrementalUpdate
// ---------------------------------------------------------------------------

/**
 * Append a pure incremental update to a PDF.
 *
 * This function NEVER modifies bytes before the last %%EOF.
 * It appends new/modified objects, a new xref subsection, and a
 * new trailer with a /Prev pointer to the previous xref.
 *
 * @param originalPdf  The original PDF bytes.
 * @param newObjects   Objects to append (new or modified).
 * @param options      Options for the append operation.
 * @returns            The updated PDF bytes.
 */
export function appendIncrementalUpdate(
  originalPdf: Uint8Array,
  newObjects: IncrementalObject[],
  options?: AppendOptions,
): Uint8Array {
  if (newObjects.length === 0) {
    return originalPdf;
  }

  // Parse existing trailer
  const trailer = parseExistingTrailer(originalPdf);

  // Build the appendix
  const buf = new ByteBuffer();

  // Start with a newline separator
  buf.writeString('\n');

  // Track xref offsets for new objects
  const xrefOffsets = new Map<number, number>();

  // Write each object
  for (const obj of newObjects) {
    const offset = originalPdf.length + buf.offset;
    xrefOffsets.set(obj.objectNumber, offset);

    buf.writeString(`${obj.objectNumber} ${obj.generationNumber} obj\n`);
    buf.write(obj.data);
    buf.writeString('\nendobj\n');
  }

  // Compute new /Size
  let newSize = trailer.size;
  for (const obj of newObjects) {
    if (obj.objectNumber + 1 > newSize) {
      newSize = obj.objectNumber + 1;
    }
  }

  // Write xref subsections
  const xrefOffset = originalPdf.length + buf.offset;

  const sortedObjNums = xrefOffsets.keys().toArray().sort((a, b) => a - b);
  const subsections = buildSubsections(sortedObjNums, xrefOffsets);

  buf.writeString('xref\n');

  for (const sub of subsections) {
    buf.writeString(`${sub.start} ${sub.entries.length}\n`);
    for (const entry of sub.entries) {
      buf.writeString(
        `${entry.offset.toString().padStart(10, '0')} ${entry.gen.toString().padStart(5, '0')} n \n`,
      );
    }
  }

  // Write trailer
  buf.writeString('trailer\n');
  buf.writeString('<<\n');
  buf.writeString(`/Size ${newSize}\n`);
  buf.writeString(`/Root ${trailer.rootRef}\n`);
  if (trailer.infoRef !== undefined) {
    buf.writeString(`/Info ${trailer.infoRef}\n`);
  }
  buf.writeString(`/Prev ${trailer.prevXrefOffset}\n`);
  buf.writeString('>>\n');
  buf.writeString('startxref\n');
  buf.writeString(`${xrefOffset}\n`);
  buf.writeString('%%EOF\n');

  // Combine original + appendix
  const appendix = buf.toUint8Array();
  const result = new Uint8Array(originalPdf.length + appendix.length);
  result.set(originalPdf, 0);
  result.set(appendix, originalPdf.length);

  return result;
}

// ---------------------------------------------------------------------------
// Internal: xref subsection builder
// ---------------------------------------------------------------------------

interface SubsectionEntry {
  offset: number;
  gen: number;
}

interface Subsection {
  start: number;
  entries: SubsectionEntry[];
}

/**
 * Group consecutive object numbers into xref subsections.
 */
function buildSubsections(
  sortedObjNums: number[],
  offsets: Map<number, number>,
): Subsection[] {
  if (sortedObjNums.length === 0) return [];

  const subsections: Subsection[] = [];
  let currentStart = sortedObjNums[0]!;
  let currentEntries: SubsectionEntry[] = [
    { offset: offsets.get(currentStart)!, gen: 0 },
  ];

  for (let i = 1; i < sortedObjNums.length; i++) {
    const objNum = sortedObjNums[i]!;
    const prev = sortedObjNums[i - 1]!;

    if (objNum === prev + 1) {
      currentEntries.push({ offset: offsets.get(objNum)!, gen: 0 });
    } else {
      subsections.push({ start: currentStart, entries: currentEntries });
      currentStart = objNum;
      currentEntries = [{ offset: offsets.get(objNum)!, gen: 0 }];
    }
  }

  subsections.push({ start: currentStart, entries: currentEntries });

  return subsections;
}

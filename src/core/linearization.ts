/**
 * @module core/linearization
 *
 * Linearization support for PDF documents (PDF spec Appendix F).
 *
 * A linearized PDF is organized so that the first page can be displayed
 * before the entire file is downloaded.  This is sometimes called
 * "fast web view" or "optimized for the web".
 *
 * **Structure of a linearized PDF (per §F.2):**
 *
 * 1. Header (%PDF-1.x + binary comment)
 * 2. Linearization parameter dictionary (first indirect object)
 * 3. First-page cross-reference table and trailer
 * 4. Document catalog, first-page objects
 * 5. Primary hint stream
 * 6. Remaining pages' objects (part 6..11 per spec)
 * 7. Main (overflow) cross-reference table and trailer
 * 8. %%EOF
 *
 * This implementation provides:
 * - Detection of linearized PDFs (`isLinearized`)
 * - Extraction of linearization info (`getLinearizationInfo`)
 * - Full linearization pass (`linearizePdf`) that reorganizes objects
 *   so the first page's objects come first, with a linearization
 *   parameter dict, page-offset hint table, shared object hint table,
 *   and cross-reference streams.
 * - Delinearization (`delinearizePdf`) that strips linearization
 *   artifacts and produces a normal (non-linearized) PDF.
 *
 * Two-pass serialization ensures all byte offsets in hint tables,
 * cross-reference streams, and the linearization parameter dictionary
 * are exact — not placeholders or approximations.
 *
 * Reference: PDF 1.7 spec, Appendix F (Linearized PDF).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for the linearization process. */
export interface LinearizationOptions {
  /** First page to optimize for (default: 0). */
  firstPage?: number | undefined;
}

/**
 * Information extracted from a linearization parameter dictionary.
 * Maps to the entries defined in PDF spec §F.2.
 */
export interface LinearizationInfo {
  /** Linearization version (e.g. 1.0). */
  version: number;
  /** File length (/L). */
  length: number;
  /** Object number of the first page's page object (/O). */
  primaryPage: number;
  /** Total page count (/N). */
  pageCount: number;
  /** Byte offset of the end of the first page section (/E). */
  firstPageOffset: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Check if a PDF is linearized.
 *
 * A linearized PDF has a linearization parameter dictionary as the
 * very first indirect object after the header.  This dictionary
 * contains `/Linearized` as a key.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         `true` if the PDF appears to be linearized.
 */
export function isLinearized(pdfBytes: Uint8Array): boolean {
  // Quick check: look for /Linearized within the first 1024 bytes
  const searchWindow = Math.min(pdfBytes.length, 1024);
  const header = decoder.decode(pdfBytes.subarray(0, searchWindow));
  return /\/Linearized\s+[\d.]+/.test(header);
}

/**
 * Extract linearization information from a linearized PDF.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         The linearization info, or `null` if not linearized.
 */
export function getLinearizationInfo(pdfBytes: Uint8Array): LinearizationInfo | null {
  if (!isLinearized(pdfBytes)) return null;

  const searchWindow = Math.min(pdfBytes.length, 2048);
  const header = decoder.decode(pdfBytes.subarray(0, searchWindow));

  const versionMatch = /\/Linearized\s+([\d.]+)/.exec(header);
  const lengthMatch = /\/L\s+(\d+)/.exec(header);
  const primaryMatch = /\/O\s+(\d+)/.exec(header);
  const pageCountMatch = /\/N\s+(\d+)/.exec(header);
  const endFirstMatch = /\/E\s+(\d+)/.exec(header);

  return {
    version: versionMatch ? parseFloat(versionMatch[1]!) : 1.0,
    length: lengthMatch ? parseInt(lengthMatch[1]!, 10) : pdfBytes.length,
    primaryPage: primaryMatch ? parseInt(primaryMatch[1]!, 10) : 0,
    pageCount: pageCountMatch ? parseInt(pageCountMatch[1]!, 10) : 0,
    firstPageOffset: endFirstMatch ? parseInt(endFirstMatch[1]!, 10) : 0,
  };
}

// ---------------------------------------------------------------------------
// Minimal parser helpers (for linearization)
// ---------------------------------------------------------------------------

/** Find a string in the byte array, starting from `start`. */
function findString(data: Uint8Array, str: string, start: number = 0): number {
  const bytes = encoder.encode(str);
  outer:
  for (let i = start; i <= data.length - bytes.length; i++) {
    for (let j = 0; j < bytes.length; j++) {
      if (data[i + j] !== bytes[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Read an ASCII line starting at offset (until \n or \r\n). */
function readLine(data: Uint8Array, offset: number): { line: string; nextOffset: number } {
  let end = offset;
  while (end < data.length && data[end] !== 0x0a && data[end] !== 0x0d) {
    end++;
  }
  const line = decoder.decode(data.subarray(offset, end));
  let next = end;
  if (next < data.length && data[next] === 0x0d) next++;
  if (next < data.length && data[next] === 0x0a) next++;
  return { line, nextOffset: next };
}

/** Parse the startxref offset from the end of the file. */
function findStartXref(data: Uint8Array): number {
  // Search backwards for "startxref"
  const tail = decoder.decode(data.subarray(Math.max(0, data.length - 256)));
  const idx = tail.lastIndexOf('startxref');
  if (idx < 0) return -1;
  const afterKeyword = tail.slice(idx + 9).trim();
  const lines = afterKeyword.split(/[\r\n]+/);
  const xrefOffset = parseInt(lines[0]!, 10);
  return Number.isNaN(xrefOffset) ? -1 : xrefOffset;
}

// ---------------------------------------------------------------------------
// Simple xref table parser
// ---------------------------------------------------------------------------

interface XrefEntry {
  offset: number;
  generation: number;
  inUse: boolean;
}

interface TrailerInfo {
  size: number;
  rootRef: string;
  rootObjNum: number;
  rootGenNum: number;
  infoRef: string | undefined;
  infoObjNum: number;
  infoGenNum: number;
}

function parseXrefTable(data: Uint8Array, xrefOffset: number): {
  entries: Map<number, XrefEntry>;
  trailer: TrailerInfo;
} {
  const entries = new Map<number, XrefEntry>();
  let pos = xrefOffset;

  // Skip "xref\n"
  const xrefLine = readLine(data, pos);
  pos = xrefLine.nextOffset;

  // Parse subsections
  while (pos < data.length) {
    const line = readLine(data, pos);
    if (line.line.startsWith('trailer')) break;

    const parts = line.line.trim().split(/\s+/);
    if (parts.length === 2 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
      // Subsection header: startObj count
      const startObj = parseInt(parts[0]!, 10);
      const count = parseInt(parts[1]!, 10);
      pos = line.nextOffset;

      for (let i = 0; i < count; i++) {
        const entryLine = readLine(data, pos);
        pos = entryLine.nextOffset;
        const ep = entryLine.line.trim().split(/\s+/);
        if (ep.length >= 3) {
          entries.set(startObj + i, {
            offset: parseInt(ep[0]!, 10),
            generation: parseInt(ep[1]!, 10),
            inUse: ep[2] === 'n',
          });
        }
      }
    } else {
      pos = line.nextOffset;
    }
  }

  // Parse trailer dict (simplified)
  const trailerStart = findString(data, 'trailer', xrefOffset);
  const trailerEnd = findString(data, '>>', trailerStart) + 2;
  const trailerStr = decoder.decode(data.subarray(trailerStart, trailerEnd));

  const sizeMatch = /\/Size\s+(\d+)/.exec(trailerStr);
  const rootMatch = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailerStr);
  const infoMatch = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(trailerStr);

  return {
    entries,
    trailer: {
      size: sizeMatch ? parseInt(sizeMatch[1]!, 10) : 0,
      rootRef: rootMatch ? `${rootMatch[1]} ${rootMatch[2]} R` : '1 0 R',
      rootObjNum: rootMatch ? parseInt(rootMatch[1]!, 10) : 1,
      rootGenNum: rootMatch ? parseInt(rootMatch[2]!, 10) : 0,
      infoRef: infoMatch ? `${infoMatch[1]} ${infoMatch[2]} R` : undefined,
      infoObjNum: infoMatch ? parseInt(infoMatch[1]!, 10) : 0,
      infoGenNum: infoMatch ? parseInt(infoMatch[2]!, 10) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Object extractor
// ---------------------------------------------------------------------------

/** Extract the raw bytes of an indirect object from the PDF. */
function extractObject(data: Uint8Array, offset: number): Uint8Array {
  // Find "endobj" after this offset
  const endIdx = findString(data, 'endobj', offset);
  if (endIdx < 0) return data.subarray(offset);
  return data.subarray(offset, endIdx + 6);
}

/** Check if an object is a stream (contains "stream" keyword). */
function isStreamObject(objBytes: Uint8Array): boolean {
  const str = decoder.decode(objBytes);
  return /\bstream\s/.test(str);
}

// ---------------------------------------------------------------------------
// Reference walking — find all objects referenced by a given object
// ---------------------------------------------------------------------------

/**
 * Recursively walk references from a set of root object numbers.
 * Returns all transitively referenced object numbers.
 */
function walkReferences(
  rootObjNums: number[],
  objects: Map<number, Uint8Array>,
  maxDepth: number = 20,
): Set<number> {
  const visited = new Set<number>();

  function walk(objNum: number, depth: number): void {
    if (depth > maxDepth) return;
    if (visited.has(objNum)) return;
    visited.add(objNum);

    const objBytes = objects.get(objNum);
    if (!objBytes) return;

    const str = decoder.decode(objBytes);
    const refMatches = str.matchAll(/(\d+)\s+\d+\s+R/g);
    for (const rm of refMatches) {
      const refNum = parseInt(rm[1]!, 10);
      if (objects.has(refNum)) {
        walk(refNum, depth + 1);
      }
    }
  }

  for (const root of rootObjNums) {
    walk(root, 0);
  }

  return visited;
}

// ---------------------------------------------------------------------------
// Page classification — determine which objects belong to which page
// ---------------------------------------------------------------------------

interface PageInfo {
  pageObjNum: number;
  referencedObjects: Set<number>;
}

/**
 * Find all page object numbers from the /Pages tree.
 */
function findPageObjectNumbers(
  pagesObjNum: number,
  objects: Map<number, Uint8Array>,
): number[] {
  const pageNums: number[] = [];

  function walkPages(objNum: number): void {
    const objBytes = objects.get(objNum);
    if (!objBytes) return;
    const str = decoder.decode(objBytes);

    // Check if this is a /Page or /Pages node
    const typeMatch = /\/Type\s*\/(\w+)/.exec(str);
    if (!typeMatch) return;

    if (typeMatch[1] === 'Page') {
      pageNums.push(objNum);
      return;
    }

    if (typeMatch[1] === 'Pages') {
      const kidsMatch = /\/Kids\s*\[([\s\S]*?)\]/.exec(str);
      if (kidsMatch) {
        const refs = kidsMatch[1]!.match(/(\d+)\s+\d+\s+R/g);
        if (refs) {
          for (const ref of refs) {
            const kidObjNum = parseInt(ref.split(' ')[0]!, 10);
            walkPages(kidObjNum);
          }
        }
      }
    }
  }

  walkPages(pagesObjNum);
  return pageNums;
}

/**
 * Classify objects into per-page sets.
 * Shared objects (referenced by multiple pages) are tracked separately.
 */
function classifyObjects(
  pageObjNums: number[],
  catalogObjNum: number,
  pagesObjNum: number,
  objects: Map<number, Uint8Array>,
): {
  pages: PageInfo[];
  sharedObjects: Set<number>;
  catalogObjects: Set<number>;
} {
  const pages: PageInfo[] = [];

  // Walk references for each page
  for (const pageObjNum of pageObjNums) {
    const referencedObjects = walkReferences([pageObjNum], objects);
    pages.push({ pageObjNum, referencedObjects });
  }

  // Catalog and pages tree are "shared" structural objects
  const catalogObjects = new Set<number>();
  catalogObjects.add(catalogObjNum);
  catalogObjects.add(pagesObjNum);

  // Find shared objects (referenced by 2+ pages)
  const refCount = new Map<number, number>();
  for (const page of pages) {
    for (const objNum of page.referencedObjects) {
      refCount.set(objNum, (refCount.get(objNum) ?? 0) + 1);
    }
  }

  const sharedObjects = new Set<number>();
  for (const [objNum, count] of refCount) {
    if (count > 1 || catalogObjects.has(objNum)) {
      sharedObjects.add(objNum);
    }
  }

  // Remove shared objects from individual page sets
  for (const page of pages) {
    for (const objNum of sharedObjects) {
      page.referencedObjects.delete(objNum);
    }
  }

  return { pages, sharedObjects, catalogObjects };
}

// ---------------------------------------------------------------------------
// Hint table builders (PDF spec §F.4) — exact byte offsets
// ---------------------------------------------------------------------------

/**
 * Per-page statistics used by both hint table construction and verification.
 */
interface PageStats {
  /** Number of objects exclusively belonging to this page. */
  objCount: number;
  /** Total byte length of this page's exclusive objects in the output. */
  totalBytes: number;
  /** Object number of the first object for this page. */
  firstObjNum: number;
  /** Byte offset of the first object for this page. */
  firstObjOffset: number;
  /** Byte offset of the content stream for this page (0 if none). */
  contentStreamOffset: number;
  /** Byte length of the content stream for this page (0 if none). */
  contentStreamLength: number;
  /** Number of shared object references for this page. */
  sharedObjRefCount: number;
}

/**
 * Compute exact per-page statistics from final byte offsets.
 */
function computePageStats(
  pages: PageInfo[],
  offsets: Map<number, number>,
  serializedSizes: Map<number, number>,
  objects: Map<number, Uint8Array>,
): PageStats[] {
  const stats: PageStats[] = [];

  for (const page of pages) {
    const allObjs = [page.pageObjNum, ...page.referencedObjects];
    let totalBytes = 0;
    let firstObj = page.pageObjNum;
    let firstObjOffset = offsets.get(page.pageObjNum) ?? 0;
    let contentStreamOffset = 0;
    let contentStreamLength = 0;

    for (const objNum of allObjs) {
      const size = serializedSizes.get(objNum) ?? 0;
      totalBytes += size;

      const off = offsets.get(objNum) ?? 0;
      if (off < firstObjOffset || (off === firstObjOffset && objNum < firstObj)) {
        firstObj = objNum;
        firstObjOffset = off;
      }

      // Detect content streams
      const objBytes = objects.get(objNum);
      if (objBytes && isStreamObject(objBytes)) {
        const objStr = decoder.decode(objBytes);
        if (!/\/Type\s*\//.test(objStr) || /\/Type\s*\/XObject/.test(objStr)) {
          // This is likely a content stream or XObject stream
          if (contentStreamOffset === 0) {
            contentStreamOffset = off;
            contentStreamLength = size;
          }
        }
      }
    }

    // Count shared object references for this page
    // (This is the number of shared objects this page references, stored
    //  so we can write it in per-page hint entries)
    let sharedObjRefCount = 0;
    const objBytes = objects.get(page.pageObjNum);
    if (objBytes) {
      const objStr = decoder.decode(objBytes);
      const refs = objStr.matchAll(/(\d+)\s+\d+\s+R/g);
      for (const _ref of refs) {
        sharedObjRefCount++;
      }
    }

    stats.push({
      objCount: allObjs.length,
      totalBytes,
      firstObjNum: firstObj,
      firstObjOffset,
      contentStreamOffset,
      contentStreamLength,
      sharedObjRefCount,
    });
  }

  return stats;
}

/**
 * Build a page offset hint table (§F.4.1) with exact byte offsets.
 *
 * The table is a binary header (13 4-byte fields = 52 bytes) followed
 * by per-page entries encoding deltas from the minimums.
 *
 * Header fields (per Table F.3):
 *  1.  Least number of objects in a page
 *  2.  Location of first page's page object (byte offset)
 *  3.  Bits needed for difference from least objects per page
 *  4.  Least page length (bytes)
 *  5.  Bits for difference from least page length
 *  6.  Least offset to start of content stream
 *  7.  Bits for difference in content stream offsets
 *  8.  Least content stream length
 *  9.  Bits for difference in content stream lengths
 * 10.  Bits needed for number of shared object references
 * 11.  Bits needed for shared object reference identifier
 * 12.  Bits needed for numerator of fractional position
 * 13.  Shared object denominator
 */
function buildPageOffsetHintTable(
  pages: PageInfo[],
  offsets: Map<number, number>,
  serializedSizes: Map<number, number>,
  objects: Map<number, Uint8Array>,
): Uint8Array {
  const nPages = pages.length;
  if (nPages === 0) return new Uint8Array(0);

  const pageStats = computePageStats(pages, offsets, serializedSizes, objects);

  // Header values
  const leastObjCount = Math.min(...pageStats.map(p => p.objCount));
  const maxObjDiff = Math.max(...pageStats.map(p => p.objCount - leastObjCount));
  const bitsForObjDiff = maxObjDiff > 0 ? Math.ceil(Math.log2(maxObjDiff + 1)) : 0;

  const leastPageLen = Math.min(...pageStats.map(p => p.totalBytes));
  const maxLenDiff = Math.max(...pageStats.map(p => p.totalBytes - leastPageLen));
  const bitsForLenDiff = maxLenDiff > 0 ? Math.ceil(Math.log2(maxLenDiff + 1)) : 0;

  const contentOffsets = pageStats.map(p => p.contentStreamOffset);
  const leastContentOffset = Math.min(...contentOffsets);
  const maxContentOffDiff = Math.max(...contentOffsets) - leastContentOffset;
  const bitsForContentOffDiff = maxContentOffDiff > 0
    ? Math.ceil(Math.log2(maxContentOffDiff + 1)) : 0;

  const contentLengths = pageStats.map(p => p.contentStreamLength);
  const leastContentLen = Math.min(...contentLengths);
  const maxContentLenDiff = Math.max(...contentLengths) - leastContentLen;
  const bitsForContentLenDiff = maxContentLenDiff > 0
    ? Math.ceil(Math.log2(maxContentLenDiff + 1)) : 0;

  const sharedRefCounts = pageStats.map(p => p.sharedObjRefCount);
  const maxSharedRefs = Math.max(...sharedRefCounts);
  const bitsForSharedRefs = maxSharedRefs > 0
    ? Math.ceil(Math.log2(maxSharedRefs + 1)) : 0;

  const firstPageObjOffset = offsets.get(pages[0]!.pageObjNum) ?? 0;

  // 13-field header (52 bytes) + per-page entries (8 bytes each for deltas)
  const headerSize = 52;
  const perPageSize = 8; // objCountDelta(4) + pageLenDelta(4)
  const totalSize = headerSize + nPages * perPageSize;

  const data = new Uint8Array(totalSize);
  let pos = 0;

  // Write 13 header fields
  writeU32BE(data, pos, leastObjCount); pos += 4;           // 1
  writeU32BE(data, pos, firstPageObjOffset); pos += 4;       // 2
  writeU32BE(data, pos, bitsForObjDiff); pos += 4;           // 3
  writeU32BE(data, pos, leastPageLen); pos += 4;             // 4
  writeU32BE(data, pos, bitsForLenDiff); pos += 4;           // 5
  writeU32BE(data, pos, leastContentOffset); pos += 4;       // 6
  writeU32BE(data, pos, bitsForContentOffDiff); pos += 4;    // 7
  writeU32BE(data, pos, leastContentLen); pos += 4;          // 8
  writeU32BE(data, pos, bitsForContentLenDiff); pos += 4;    // 9
  writeU32BE(data, pos, bitsForSharedRefs); pos += 4;        // 10
  writeU32BE(data, pos, bitsForSharedRefs); pos += 4;        // 11
  writeU32BE(data, pos, 0); pos += 4;                        // 12 numerator bits
  writeU32BE(data, pos, 1); pos += 4;                        // 13 denominator

  // Write per-page entries with exact deltas
  for (const stat of pageStats) {
    writeU32BE(data, pos, stat.objCount - leastObjCount); pos += 4;
    writeU32BE(data, pos, stat.totalBytes - leastPageLen); pos += 4;
  }

  return data;
}

/**
 * Build a shared object hint table (§F.4.2) with exact byte offsets.
 *
 * Header fields (per Table F.5, 7 fields):
 *  1.  Object number of first shared object
 *  2.  Byte offset of first shared object in file
 *  3.  Number of shared object entries
 *  4.  Least object length (bytes)
 *  5.  Bits for difference from least object length
 *  6.  Flag: 1 if first shared object is the first page's page object
 *  7.  Number of shared object entries for first page
 */
function buildSharedObjectHintTable(
  sharedObjectNums: number[],
  offsets: Map<number, number>,
  serializedSizes: Map<number, number>,
  firstPageObjNum: number,
): Uint8Array {
  const nShared = sharedObjectNums.length;
  if (nShared === 0) return new Uint8Array(0);

  // 7-field header (28 bytes) + per-object entries (8 bytes each)
  const headerSize = 28;
  const perObjectSize = 8;
  const totalSize = headerSize + nShared * perObjectSize;

  const data = new Uint8Array(totalSize);
  let pos = 0;

  // Compute sizes using exact serialized sizes
  const sizes = sharedObjectNums.map(n => serializedSizes.get(n) ?? 0);
  const leastLen = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxLenDiff = sizes.length > 0 ? Math.max(...sizes) - leastLen : 0;
  const bitsForLenDiff = maxLenDiff > 0 ? Math.ceil(Math.log2(maxLenDiff + 1)) : 0;
  const firstObjNum = sharedObjectNums.length > 0 ? Math.min(...sharedObjectNums) : 0;
  const firstObjOffset = offsets.get(firstObjNum) ?? 0;
  const firstIsPageObj = sharedObjectNums.includes(firstPageObjNum) ? 1 : 0;

  // 7 header fields
  writeU32BE(data, pos, firstObjNum); pos += 4;          // 1
  writeU32BE(data, pos, firstObjOffset); pos += 4;       // 2
  writeU32BE(data, pos, nShared); pos += 4;              // 3
  writeU32BE(data, pos, leastLen); pos += 4;             // 4
  writeU32BE(data, pos, bitsForLenDiff); pos += 4;       // 5
  writeU32BE(data, pos, firstIsPageObj); pos += 4;       // 6
  writeU32BE(data, pos, nShared); pos += 4;              // 7

  // Per-object entries with exact offsets and sizes
  for (let i = 0; i < nShared; i++) {
    const off = offsets.get(sharedObjectNums[i]!) ?? 0;
    const size = serializedSizes.get(sharedObjectNums[i]!) ?? 0;
    writeU32BE(data, pos, off); pos += 4;
    writeU32BE(data, pos, size); pos += 4;
  }

  return data;
}

/** Write a 4-byte big-endian unsigned integer. */
function writeU32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/** Read a 4-byte big-endian unsigned integer. */
export function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset]! << 24) |
      (buf[offset + 1]! << 16) |
      (buf[offset + 2]! << 8) |
      buf[offset + 3]!) >>> 0
  );
}

/** Compute minimum bytes to represent a value in big-endian. */
function bytesNeeded(value: number): number {
  if (value <= 0xff) return 1;
  if (value <= 0xffff) return 2;
  if (value <= 0xffffff) return 3;
  return 4;
}

/** Write big-endian integer of given byte width. */
function writeIntBE(buf: Uint8Array, offset: number, width: number, value: number): void {
  for (let i = width - 1; i >= 0; i--) {
    buf[offset + i] = value & 0xff;
    value = value >>> 8;
  }
}

// ---------------------------------------------------------------------------
// Cross-reference stream builder
// ---------------------------------------------------------------------------

/**
 * Build a cross-reference stream (PDF 1.5+, §7.5.8).
 *
 * Returns the complete indirect object bytes including the `N G obj`
 * header and `endobj`.
 */
function buildXrefStream(
  xrefObjNum: number,
  totalSize: number,
  entries: Map<number, { type: number; field2: number; field3: number }>,
  rootRef: string,
  infoRef: string | undefined,
  prevXrefOffset?: number,
): Uint8Array {
  // Determine field widths
  let maxField2 = 0;
  let maxField3 = 65535; // free entry gen
  for (const e of entries.values()) {
    if (e.field2 > maxField2) maxField2 = e.field2;
    if (e.field3 > maxField3) maxField3 = e.field3;
  }

  const w0 = 1;
  const w1 = bytesNeeded(maxField2);
  const w2 = bytesNeeded(maxField3);
  const entryWidth = w0 + w1 + w2;

  // Build binary data
  const streamData = new Uint8Array(totalSize * entryWidth);
  let pos = 0;

  // Object 0: free entry
  writeIntBE(streamData, pos, w0, 0); pos += w0;
  writeIntBE(streamData, pos, w1, 0); pos += w1;
  writeIntBE(streamData, pos, w2, 65535); pos += w2;

  for (let i = 1; i < totalSize; i++) {
    const entry = entries.get(i);
    if (entry) {
      writeIntBE(streamData, pos, w0, entry.type); pos += w0;
      writeIntBE(streamData, pos, w1, entry.field2); pos += w1;
      writeIntBE(streamData, pos, w2, entry.field3); pos += w2;
    } else {
      writeIntBE(streamData, pos, w0, 0); pos += w0;
      writeIntBE(streamData, pos, w1, 0); pos += w1;
      writeIntBE(streamData, pos, w2, 0); pos += w2;
    }
  }

  // Build the xref stream dictionary
  let dictStr = `<< /Type /XRef /Size ${totalSize}`;
  dictStr += ` /W [${w0} ${w1} ${w2}]`;
  dictStr += ` /Root ${rootRef}`;
  if (infoRef) dictStr += ` /Info ${infoRef}`;
  if (prevXrefOffset !== undefined) dictStr += ` /Prev ${prevXrefOffset}`;
  dictStr += ` /Length ${streamData.length}`;
  dictStr += ' >>';

  const objStr = `${xrefObjNum} 0 obj\n${dictStr}\nstream\n`;
  const objEnd = '\nendstream\nendobj\n';

  const headerBytes = encoder.encode(objStr);
  const footerBytes = encoder.encode(objEnd);

  const result = new Uint8Array(headerBytes.length + streamData.length + footerBytes.length);
  result.set(headerBytes, 0);
  result.set(streamData, headerBytes.length);
  result.set(footerBytes, headerBytes.length + streamData.length);
  return result;
}

// ---------------------------------------------------------------------------
// Two-pass serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialization state collected during a layout pass.
 * Captures exact byte offsets and sizes for every component.
 */
interface LayoutResult {
  /** Total file length. */
  fileLength: number;
  /** Byte offsets of each object in the output. */
  offsets: Map<number, number>;
  /** Serialized byte sizes of each object (including trailing newline). */
  serializedSizes: Map<number, number>;
  /** Byte offset where first-page objects end. */
  endOfFirstPage: number;
  /** Byte offset of the hint stream object. */
  hintStreamStart: number;
  /** Byte length of the hint stream object (from obj header to endobj). */
  hintStreamLength: number;
  /** Byte offset of the main (overflow) xref stream. */
  mainXrefOffset: number;
  /** The assembled file bytes (only valid on pass 2). */
  bytes: Uint8Array;
}

/**
 * Execute one serialization pass, producing a LayoutResult.
 *
 * On pass 1, hint table offsets passed in may be 0 (placeholders).
 * On pass 2, they reflect the exact values from pass 1 so every
 * offset in the output is self-consistent.
 */
function serializationPass(
  objects: Map<number, Uint8Array>,
  firstPageObjNumsSorted: number[],
  remainingObjNums: number[],
  classification: { pages: PageInfo[]; sharedObjects: Set<number> },
  linObjNum: number,
  hintObjNum: number,
  firstPageObjNum: number,
  pageCount: number,
  trailer: TrailerInfo,
  /** Values from previous pass (or placeholders on pass 1). */
  prev: {
    fileLength: number;
    endOfFirstPage: number;
    mainXrefOffset: number;
    hintStreamStart: number;
    hintStreamLength: number;
  },
  /** Object offsets from a previous pass, used for hint table construction. */
  prevOffsets?: Map<number, number>,
  /** Serialized sizes from a previous pass, used for hint table construction. */
  prevSizes?: Map<number, number>,
): LayoutResult {
  const chunks: Uint8Array[] = [];
  const newOffsets = new Map<number, number>();
  const serializedSizes = new Map<number, number>();
  let currentOffset = 0;

  function writeStr(s: string): void {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function writeBytes(data: Uint8Array): void {
    chunks.push(data);
    currentOffset += data.length;
  }

  // ----- Part 1: Header -----
  writeStr('%PDF-1.7\n');
  writeStr('%\xe2\xe3\xcf\xd3\n');

  // ----- Part 2: Linearization parameter dictionary -----
  // Use padded 10-digit placeholders so the dict is always the same size
  const linDictOffset = currentOffset;
  writeStr(`${linObjNum} 0 obj\n`);
  writeStr('<< /Linearized 1.0\n');
  writeStr(`   /L ${prev.fileLength.toString().padStart(10, '0')}\n`);
  writeStr(`   /O ${firstPageObjNum}\n`);
  writeStr(`   /E ${prev.endOfFirstPage.toString().padStart(10, '0')}\n`);
  writeStr(`   /N ${pageCount}\n`);
  writeStr(`   /T ${prev.mainXrefOffset.toString().padStart(10, '0')}\n`);
  writeStr(`   /H [${prev.hintStreamStart.toString().padStart(10, '0')} ${prev.hintStreamLength.toString().padStart(10, '0')}]\n`);
  writeStr('>>\n');
  writeStr('endobj\n');
  newOffsets.set(linObjNum, linDictOffset);
  serializedSizes.set(linObjNum, currentOffset - linDictOffset);

  // ----- Part 4: First-page objects -----
  for (const objNum of firstPageObjNumsSorted) {
    const objBytes = objects.get(objNum);
    if (objBytes) {
      const start = currentOffset;
      newOffsets.set(objNum, start);
      writeBytes(objBytes);
      writeStr('\n');
      serializedSizes.set(objNum, currentOffset - start);
    }
  }

  const endOfFirstPage = currentOffset;

  // ----- Part 5: Primary hint stream -----
  const hintStreamStart = currentOffset;

  // Build hint tables using offsets from the previous pass when available.
  // This is essential because at this point in the file layout, only
  // first-page objects have been written — remaining-page objects haven't
  // been placed yet. The previous pass provides complete offset data.
  const hintOffsets = prevOffsets ?? newOffsets;
  const hintSizes = prevSizes ?? serializedSizes;

  const pageOffsetHints = buildPageOffsetHintTable(
    classification.pages,
    hintOffsets,
    hintSizes,
    objects,
  );
  const sharedObjNums = [...classification.sharedObjects].sort((a, b) => a - b);
  const sharedObjectHints = buildSharedObjectHintTable(
    sharedObjNums,
    hintOffsets,
    hintSizes,
    firstPageObjNum,
  );

  // The hint stream contains both tables concatenated.
  // /S marks the offset of the shared object hint table within the stream.
  const hintStreamData = new Uint8Array(pageOffsetHints.length + sharedObjectHints.length);
  hintStreamData.set(pageOffsetHints, 0);
  hintStreamData.set(sharedObjectHints, pageOffsetHints.length);

  const sharedHintOffset = pageOffsetHints.length;

  writeStr(`${hintObjNum} 0 obj\n`);
  writeStr(`<< /Length ${hintStreamData.length} /S ${sharedHintOffset} >>\n`);
  writeStr('stream\n');
  writeBytes(hintStreamData);
  writeStr('\nendstream\n');
  writeStr('endobj\n');
  newOffsets.set(hintObjNum, hintStreamStart);
  serializedSizes.set(hintObjNum, currentOffset - hintStreamStart);

  const hintStreamLength = currentOffset - hintStreamStart;

  // ----- Part 6: Remaining pages' objects -----
  for (const objNum of remainingObjNums) {
    const objBytes = objects.get(objNum);
    if (objBytes) {
      const start = currentOffset;
      newOffsets.set(objNum, start);
      writeBytes(objBytes);
      writeStr('\n');
      serializedSizes.set(objNum, currentOffset - start);
    }
  }

  // ----- Part 7: Main cross-reference stream -----
  // Build xref entries for ALL objects (including itself)
  const xrefEntries = new Map<number, { type: number; field2: number; field3: number }>();
  for (const [objNum, offset] of newOffsets) {
    xrefEntries.set(objNum, { type: 1, field2: offset, field3: 0 });
  }

  const maxObjNumInFile = Math.max(...newOffsets.keys(), 0);
  const mainXrefObjNum = maxObjNumInFile + 1;

  // The xref stream object is also an entry pointing to itself
  const mainXrefOffset = currentOffset;
  xrefEntries.set(mainXrefObjNum, { type: 1, field2: mainXrefOffset, field3: 0 });

  const xrefStreamBytes = buildXrefStream(
    mainXrefObjNum,
    mainXrefObjNum + 1,
    xrefEntries,
    trailer.rootRef,
    trailer.infoRef,
  );
  writeBytes(xrefStreamBytes);

  // ----- Part 8: startxref + %%EOF -----
  writeStr('startxref\n');
  writeStr(`${mainXrefOffset}\n`);
  writeStr('%%EOF\n');

  const fileLength = currentOffset;

  // Assemble all chunks
  const result = new Uint8Array(fileLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return {
    fileLength,
    offsets: newOffsets,
    serializedSizes,
    endOfFirstPage,
    hintStreamStart,
    hintStreamLength,
    mainXrefOffset,
    bytes: result,
  };
}

// ---------------------------------------------------------------------------
// Linearization
// ---------------------------------------------------------------------------

/**
 * Linearize a PDF document for fast web viewing.
 *
 * This reorganizes the PDF so that:
 * 1. A linearization parameter dictionary appears first (§F.2)
 * 2. Objects needed for the first page appear early in the file
 * 3. A primary hint stream describes page offsets and shared objects (§F.4)
 * 4. Cross-reference streams are used for all xref data (§7.5.8)
 *
 * Uses two-pass serialization:
 * - Pass 1 produces a trial layout to determine exact byte sizes.
 * - Pass 2 re-serializes with the correct values, so all offsets
 *   (/L, /O, /E, /T, /H, hint table entries, xref entries) are exact.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param options   Linearization options.
 * @returns         The linearized PDF bytes.
 */
export async function linearizePdf(
  pdfBytes: Uint8Array,
  options?: LinearizationOptions,
): Promise<Uint8Array> {
  const _firstPage = options?.firstPage ?? 0;

  // If already linearized, return as-is
  if (isLinearized(pdfBytes)) {
    return pdfBytes;
  }

  // Parse the existing xref to understand the document structure
  const startXref = findStartXref(pdfBytes);
  if (startXref < 0) {
    throw new Error('Cannot linearize: no startxref found');
  }

  let xrefResult: ReturnType<typeof parseXrefTable>;
  try {
    xrefResult = parseXrefTable(pdfBytes, startXref);
  } catch {
    throw new Error('Cannot linearize: failed to parse xref table');
  }

  const { entries, trailer } = xrefResult;

  // Collect all in-use objects
  const objects = new Map<number, Uint8Array>();
  for (const [objNum, entry] of entries) {
    if (entry.inUse && objNum > 0) {
      objects.set(objNum, extractObject(pdfBytes, entry.offset));
    }
  }

  if (objects.size === 0) {
    throw new Error('Cannot linearize: no objects found');
  }

  // Find catalog and pages tree
  const rootObjNum = trailer.rootObjNum;
  const catalogBytes = objects.get(rootObjNum);
  if (!catalogBytes) {
    throw new Error('Cannot linearize: catalog object not found');
  }

  // Find the /Pages reference in the catalog
  const catalogStr = decoder.decode(catalogBytes);
  const pagesMatch = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(catalogStr);
  const pagesObjNum = pagesMatch ? parseInt(pagesMatch[1]!, 10) : 0;

  if (pagesObjNum === 0) {
    throw new Error('Cannot linearize: /Pages not found in catalog');
  }

  // Find all page object numbers
  const pageObjNums = findPageObjectNumbers(pagesObjNum, objects);
  const pageCount = pageObjNums.length;

  if (pageCount === 0) {
    throw new Error('Cannot linearize: no pages found');
  }

  // Validate firstPage index
  const firstPageIdx = Math.min(_firstPage, pageCount - 1);
  const firstPageObjNum = pageObjNums[firstPageIdx]!;

  // Classify objects by page ownership
  const classification = classifyObjects(
    pageObjNums,
    rootObjNum,
    pagesObjNum,
    objects,
  );

  // Get first-page exclusive objects
  const firstPageInfo = classification.pages[firstPageIdx]!;
  const firstPageExclusiveObjects = firstPageInfo.referencedObjects;

  // Build ordered lists
  const firstPageObjNums = new Set<number>();
  firstPageObjNums.add(rootObjNum);
  firstPageObjNums.add(pagesObjNum);
  firstPageObjNums.add(firstPageObjNum);
  for (const objNum of firstPageExclusiveObjects) {
    firstPageObjNums.add(objNum);
  }
  // Include shared objects in the first-page section (needed for rendering)
  for (const objNum of classification.sharedObjects) {
    firstPageObjNums.add(objNum);
  }

  // Info dict goes with first-page section too
  if (trailer.infoObjNum > 0 && objects.has(trailer.infoObjNum)) {
    firstPageObjNums.add(trailer.infoObjNum);
  }

  // Remaining pages' objects (not in first-page set)
  const remainingObjNums: number[] = [];
  for (const objNum of objects.keys()) {
    if (!firstPageObjNums.has(objNum)) {
      remainingObjNums.push(objNum);
    }
  }
  remainingObjNums.sort((a, b) => a - b);

  // Allocate new object numbers for linearization dict + hint stream
  const maxOrigObjNum = Math.max(...objects.keys(), 0);
  const linObjNum = maxOrigObjNum + 1;
  const hintObjNum = maxOrigObjNum + 2;

  const firstPageObjNumsSorted = [...firstPageObjNums].sort((a, b) => a - b);

  // ===================================================================
  // Two-pass serialization
  // ===================================================================

  // Pass 1: Trial layout with placeholder values (all zeros)
  const pass1 = serializationPass(
    objects,
    firstPageObjNumsSorted,
    remainingObjNums,
    classification,
    linObjNum,
    hintObjNum,
    firstPageObjNum,
    pageCount,
    trailer,
    {
      fileLength: 0,
      endOfFirstPage: 0,
      mainXrefOffset: 0,
      hintStreamStart: 0,
      hintStreamLength: 0,
    },
  );

  // Pass 2: Re-serialize with exact values from pass 1.
  // Because the linearization dict uses fixed-width 10-digit fields,
  // the total file size does not change between passes — only the
  // numeric values inside placeholders change.
  // We also pass pass1's complete offsets/sizes so hint tables can
  // reference ALL objects (including remaining-page objects that
  // haven't been written yet at hint table construction time).
  const pass2 = serializationPass(
    objects,
    firstPageObjNumsSorted,
    remainingObjNums,
    classification,
    linObjNum,
    hintObjNum,
    firstPageObjNum,
    pageCount,
    trailer,
    {
      fileLength: pass1.fileLength,
      endOfFirstPage: pass1.endOfFirstPage,
      mainXrefOffset: pass1.mainXrefOffset,
      hintStreamStart: pass1.hintStreamStart,
      hintStreamLength: pass1.hintStreamLength,
    },
    pass1.offsets,
    pass1.serializedSizes,
  );

  // The second pass should produce identical layout sizes.
  // If not (defensive check), run a third pass to converge.
  if (
    pass2.fileLength !== pass1.fileLength ||
    pass2.endOfFirstPage !== pass1.endOfFirstPage ||
    pass2.mainXrefOffset !== pass1.mainXrefOffset ||
    pass2.hintStreamStart !== pass1.hintStreamStart
  ) {
    const pass3 = serializationPass(
      objects,
      firstPageObjNumsSorted,
      remainingObjNums,
      classification,
      linObjNum,
      hintObjNum,
      firstPageObjNum,
      pageCount,
      trailer,
      {
        fileLength: pass2.fileLength,
        endOfFirstPage: pass2.endOfFirstPage,
        mainXrefOffset: pass2.mainXrefOffset,
        hintStreamStart: pass2.hintStreamStart,
        hintStreamLength: pass2.hintStreamLength,
      },
      pass2.offsets,
      pass2.serializedSizes,
    );
    return pass3.bytes;
  }

  return pass2.bytes;
}

// ---------------------------------------------------------------------------
// Delinearization
// ---------------------------------------------------------------------------

/**
 * Remove linearization artifacts from a PDF, producing a normal
 * (non-linearized) PDF.
 *
 * This:
 * 1. Strips the linearization parameter dictionary
 * 2. Removes hint streams
 * 3. Rebuilds the xref table without linearization ordering constraints
 * 4. Removes any /Linearized key from the output
 *
 * If the input PDF is not linearized, it is returned unchanged.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         A non-linearized PDF.
 */
export async function delinearizePdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  if (!isLinearized(pdfBytes)) {
    return pdfBytes;
  }

  // Find all xref sections (there may be multiple in a linearized PDF)
  const startXref = findStartXref(pdfBytes);
  if (startXref < 0) {
    return pdfBytes;
  }

  // Check if the startxref points to a cross-reference stream
  // (not a classic xref table). Cross-reference streams start with
  // "N G obj" instead of "xref".
  const xrefCheckStr = decoder.decode(
    pdfBytes.subarray(startXref, Math.min(startXref + 40, pdfBytes.length)),
  );
  if (!xrefCheckStr.startsWith('xref')) {
    // Cross-reference stream — fall back to scanning
    return delinearizeByScanning(pdfBytes);
  }

  // Try to parse the classic xref
  let xrefResult: ReturnType<typeof parseXrefTable>;
  try {
    xrefResult = parseXrefTable(pdfBytes, startXref);
  } catch {
    // If parsing fails, fall back to scanning
    return delinearizeByScanning(pdfBytes);
  }

  const { entries, trailer } = xrefResult;

  // If the xref table is empty (parsing failed silently), fall back
  if (entries.size === 0 || (entries.size === 1 && entries.has(0))) {
    return delinearizeByScanning(pdfBytes);
  }

  // Also check for a /Prev xref (linearized files often have two xref sections)
  const trailerStart = findString(pdfBytes, 'trailer', startXref);
  if (trailerStart >= 0) {
    const trailerEnd = findString(pdfBytes, '>>', trailerStart) + 2;
    const trailerStr = decoder.decode(pdfBytes.subarray(trailerStart, trailerEnd));
    const prevMatch = /\/Prev\s+(\d+)/.exec(trailerStr);
    if (prevMatch) {
      const prevOffset = parseInt(prevMatch[1]!, 10);
      try {
        const prevXref = parseXrefTable(pdfBytes, prevOffset);
        // Merge entries (earlier entries take precedence for updates)
        for (const [objNum, entry] of prevXref.entries) {
          if (!entries.has(objNum)) {
            entries.set(objNum, entry);
          }
        }
      } catch {
        // Skip if prev xref can't be parsed
      }
    }
  }

  // Collect all objects, skipping the linearization dict and hint streams
  const objects = new Map<number, Uint8Array>();
  const linDictObjNums = new Set<number>();

  for (const [objNum, entry] of entries) {
    if (entry.inUse && objNum > 0) {
      const objBytes = extractObject(pdfBytes, entry.offset);
      const objStr = decoder.decode(objBytes);

      // Skip linearization dictionary
      if (/\/Linearized\s+[\d.]+/.test(objStr)) {
        linDictObjNums.add(objNum);
        continue;
      }

      // Skip hint streams (associated with linearization)
      // Hint streams are detected by checking if they are referenced
      // from the linearization dict's /H entry, or by checking for
      // streams that are at the hint offset
      if (linDictObjNums.size > 0 && isHintStream(objStr)) {
        continue;
      }

      objects.set(objNum, objBytes);
    }
  }

  // Rebuild as a normal PDF
  return rebuildNormalPdf(objects, trailer);
}

/**
 * Check if an object string looks like a hint stream.
 * Hint streams are streams with specific characteristics:
 * they contain /S entries and /Length but no /Type.
 */
function isHintStream(objStr: string): boolean {
  // Hint streams are bare stream objects with /S and /Length
  // but no /Type. They follow immediately after first-page objects.
  return /<<[^>]*\/S\s+\d+[^>]*>>[\s\S]*\bstream\b/.test(objStr) &&
         !/\/Type\s*\//.test(objStr) &&
         !/\/Subtype\s*\//.test(objStr) &&
         !/\/Filter\s*\//.test(objStr);
}

/**
 * Fallback delinearization that scans for indirect objects
 * instead of relying on xref parsing (handles xref streams).
 *
 * Uses byte-level scanning with `findString` to locate object
 * markers, which avoids problems with binary stream content being
 * misinterpreted as text by regex.
 */
function delinearizeByScanning(pdfBytes: Uint8Array): Uint8Array {
  const objects = new Map<number, Uint8Array>();
  const str = decoder.decode(pdfBytes);

  // Find trailer info from the xref stream or trailer dict.
  const rootMatch = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(str);
  const infoMatch = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(str);

  const trailer: TrailerInfo = {
    size: 0,
    rootRef: rootMatch ? `${rootMatch[1]} ${rootMatch[2]} R` : '1 0 R',
    rootObjNum: rootMatch ? parseInt(rootMatch[1]!, 10) : 1,
    rootGenNum: rootMatch ? parseInt(rootMatch[2]!, 10) : 0,
    infoRef: infoMatch ? `${infoMatch[1]} ${infoMatch[2]} R` : undefined,
    infoObjNum: infoMatch ? parseInt(infoMatch[1]!, 10) : 0,
    infoGenNum: infoMatch ? parseInt(infoMatch[2]!, 10) : 0,
  };

  // Scan for object markers by searching for " 0 obj" byte sequences.
  // This avoids regex issues with binary stream content.
  let searchPos = 0;
  while (searchPos < pdfBytes.length) {
    const markerPos = findString(pdfBytes, ' 0 obj', searchPos);
    if (markerPos < 0) break;

    // Walk backwards from markerPos to find the start of the object
    // number (sequence of ASCII digits preceding the space).
    let numStart = markerPos - 1;
    while (numStart >= 0 && pdfBytes[numStart]! >= 0x30 && pdfBytes[numStart]! <= 0x39) {
      numStart--;
    }
    numStart++; // first digit

    // Validate: the character before the digits should be a newline,
    // space, or start of file to avoid matches inside binary data.
    if (numStart > 0) {
      const prevByte = pdfBytes[numStart - 1]!;
      if (prevByte !== 0x0a && prevByte !== 0x0d && prevByte !== 0x20) {
        searchPos = markerPos + 6;
        continue;
      }
    }

    // Make sure we actually found digits
    if (numStart >= markerPos) {
      searchPos = markerPos + 6;
      continue;
    }

    const objNumStr = decoder.decode(pdfBytes.subarray(numStart, markerPos));
    const objNum = parseInt(objNumStr, 10);
    if (Number.isNaN(objNum)) {
      searchPos = markerPos + 6;
      continue;
    }

    // Extract the object from the start of "N 0 obj"
    const objStart = numStart;
    const objBytes = extractObject(pdfBytes, objStart);
    const objStr = decoder.decode(objBytes);

    // Find endobj to skip past binary stream content
    const endObjPos = findString(pdfBytes, 'endobj', objStart);
    if (endObjPos < 0) {
      searchPos = markerPos + 6;
      continue;
    }
    searchPos = endObjPos + 6;

    // Skip linearization dict
    if (/\/Linearized\s+[\d.]+/.test(objStr)) continue;

    // Skip xref streams
    if (/\/Type\s*\/XRef/.test(objStr)) continue;

    // Skip hint streams
    if (isHintStream(objStr)) continue;

    objects.set(objNum, objBytes);
  }

  trailer.size = objects.size > 0 ? Math.max(...objects.keys(), 0) + 1 : 1;
  return rebuildNormalPdf(objects, trailer);
}

/**
 * Rebuild a normal (non-linearized) PDF from collected objects.
 */
function rebuildNormalPdf(
  objects: Map<number, Uint8Array>,
  trailer: TrailerInfo,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const newOffsets = new Map<number, number>();
  let currentOffset = 0;

  function writeStr(s: string): void {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function writeBytes(data: Uint8Array): void {
    chunks.push(data);
    currentOffset += data.length;
  }

  // Header
  writeStr('%PDF-1.7\n');
  writeStr('%\xe2\xe3\xcf\xd3\n');

  // Write all objects in order
  const sortedObjNums = [...objects.keys()].sort((a, b) => a - b);
  for (const objNum of sortedObjNums) {
    const objBytes = objects.get(objNum)!;
    newOffsets.set(objNum, currentOffset);
    writeBytes(objBytes);
    writeStr('\n');
  }

  // Write xref table
  const maxObjNum = sortedObjNums.length > 0 ? Math.max(...sortedObjNums) : 0;
  const xrefSize = maxObjNum + 1;
  const xrefOffset = currentOffset;

  writeStr('xref\n');
  writeStr(`0 ${xrefSize}\n`);
  writeStr('0000000000 65535 f \n');

  for (let i = 1; i < xrefSize; i++) {
    const off = newOffsets.get(i);
    if (off !== undefined) {
      writeStr(`${off.toString().padStart(10, '0')} 00000 n \n`);
    } else {
      writeStr('0000000000 00000 f \n');
    }
  }

  // Trailer
  writeStr('trailer\n');
  writeStr('<<\n');
  writeStr(`/Size ${xrefSize}\n`);
  writeStr(`/Root ${trailer.rootRef}\n`);
  if (trailer.infoRef) {
    writeStr(`/Info ${trailer.infoRef}\n`);
  }
  writeStr('>>\n');
  writeStr('startxref\n');
  writeStr(`${xrefOffset}\n`);
  writeStr('%%EOF\n');

  // Assemble result
  const fileLength = currentOffset;
  const result = new Uint8Array(fileLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

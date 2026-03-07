/**
 * @module core/linearization
 *
 * Linearization support for PDF documents.
 *
 * A linearized PDF is organized so that the first page can be displayed
 * before the entire file is downloaded.  This is sometimes called
 * "fast web view" or "optimized for the web".
 *
 * **Structure of a linearized PDF:**
 *
 * 1. Header (%PDF-1.x)
 * 2. Linearization parameter dictionary (first indirect object)
 * 3. First-page cross-reference table and trailer
 * 4. Document catalog, first-page objects
 * 5. Remaining pages' objects
 * 6. Hint stream(s)
 * 7. Main (overflow) cross-reference table and trailer
 * 8. %%EOF
 *
 * Full linearization is extremely complex (hundreds of pages in the
 * spec).  This implementation provides:
 * - Detection of linearized PDFs (`isLinearized`)
 * - A basic linearization pass (`linearizePdf`) that reorganizes objects
 *   so the first page's objects come first, with a linearization
 *   parameter dict and page-offset hint table.
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

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  return isNaN(xrefOffset) ? -1 : xrefOffset;
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
  infoRef: string | undefined;
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
    if (parts.length === 2) {
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
      infoRef: infoMatch ? `${infoMatch[1]} ${infoMatch[2]} R` : undefined,
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

// ---------------------------------------------------------------------------
// Linearization
// ---------------------------------------------------------------------------

/**
 * Linearize a PDF document for fast web viewing.
 *
 * This reorganizes the PDF so that:
 * 1. A linearization parameter dictionary appears first
 * 2. Objects needed for the first page appear early in the file
 * 3. A hint table describes page offsets
 *
 * Note: This is a simplified linearization. For production use with
 * very large documents, a full implementation following PDF spec
 * Appendix F is recommended.
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

  // Collect all objects
  const objects = new Map<number, Uint8Array>();
  for (const [objNum, entry] of entries) {
    if (entry.inUse && objNum > 0) {
      objects.set(objNum, extractObject(pdfBytes, entry.offset));
    }
  }

  // Find catalog and first page objects
  const rootObjNum = parseInt(trailer.rootRef.split(' ')[0]!, 10);
  const catalogBytes = objects.get(rootObjNum);

  // Find the /Pages reference in the catalog
  let pagesObjNum = 0;
  if (catalogBytes) {
    const catalogStr = decoder.decode(catalogBytes);
    const pagesMatch = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(catalogStr);
    if (pagesMatch) {
      pagesObjNum = parseInt(pagesMatch[1]!, 10);
    }
  }

  // Find first page object number
  let firstPageObjNum = 0;
  const pagesBytes = objects.get(pagesObjNum);
  if (pagesBytes) {
    const pagesStr = decoder.decode(pagesBytes);
    const kidsMatch = /\/Kids\s*\[([\s\S]*?)\]/.exec(pagesStr);
    if (kidsMatch) {
      const refs = kidsMatch[1]!.match(/(\d+)\s+\d+\s+R/g);
      if (refs && refs.length > _firstPage) {
        const ref = refs[_firstPage]!;
        firstPageObjNum = parseInt(ref.split(' ')[0]!, 10);
      }
    }
  }

  // Classify objects: first-page vs rest
  const firstPageObjects = new Set<number>();
  firstPageObjects.add(rootObjNum);
  firstPageObjects.add(pagesObjNum);
  if (firstPageObjNum > 0) {
    firstPageObjects.add(firstPageObjNum);
  }

  // Add objects referenced by the first page
  if (firstPageObjNum > 0) {
    const pageBytes = objects.get(firstPageObjNum);
    if (pageBytes) {
      const pageStr = decoder.decode(pageBytes);
      const refMatches = pageStr.matchAll(/(\d+)\s+\d+\s+R/g);
      for (const rm of refMatches) {
        const refNum = parseInt(rm[1]!, 10);
        if (objects.has(refNum)) {
          firstPageObjects.add(refNum);
          // Also add one level of references from those objects
          const innerBytes = objects.get(refNum);
          if (innerBytes) {
            const innerStr = decoder.decode(innerBytes);
            const innerRefs = innerStr.matchAll(/(\d+)\s+\d+\s+R/g);
            for (const ir of innerRefs) {
              const irNum = parseInt(ir[1]!, 10);
              if (objects.has(irNum)) {
                firstPageObjects.add(irNum);
              }
            }
          }
        }
      }
    }
  }

  const allObjectNums = new Set(objects.keys());
  const remainingObjects = [...allObjectNums.difference(firstPageObjects)].sort((a, b) => a - b);

  // Build the linearized output
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

  // 1. Header
  writeStr('%PDF-1.7\n');
  writeStr('%\xe2\xe3\xcf\xd3\n');

  // 2. Linearization parameter dictionary
  const linObjNum = trailer.size; // new object number
  const linDictOffset = currentOffset;
  // We'll write a placeholder and come back to fill in the file length
  const linDictPlaceholder = currentOffset;
  const pageCount = pagesBytes
    ? (decoder.decode(pagesBytes).match(/\/Count\s+(\d+)/)?.[1] ?? '1')
    : '1';

  // Write linearization dict (placeholder for /L which will be file length)
  writeStr(`${linObjNum} 0 obj\n`);
  writeStr(`<< /Linearized 1.0\n`);
  writeStr(`   /L 0000000000\n`); // Placeholder: 10 digits
  writeStr(`   /O ${firstPageObjNum}\n`);
  writeStr(`   /E 0000000000\n`); // Placeholder: end of first page
  writeStr(`   /N ${pageCount}\n`);
  writeStr(`   /T 0000000000\n`); // Placeholder: main xref offset
  writeStr('>>\n');
  writeStr('endobj\n');
  newOffsets.set(linObjNum, linDictOffset);

  // 3. Write first-page objects
  const firstPageObjNums = firstPageObjects.values().toArray().sort((a, b) => a - b);
  for (const objNum of firstPageObjNums) {
    const objBytes = objects.get(objNum);
    if (objBytes) {
      newOffsets.set(objNum, currentOffset);
      writeBytes(objBytes);
      writeStr('\n');
    }
  }

  const endOfFirstPage = currentOffset;

  // 4. Write remaining objects
  for (const objNum of remainingObjects) {
    const objBytes = objects.get(objNum);
    if (objBytes) {
      newOffsets.set(objNum, currentOffset);
      writeBytes(objBytes);
      writeStr('\n');
    }
  }

  // 5. Build hint stream (simplified page offset hint table)
  const hintObjNum = linObjNum + 1;
  const hintData = buildSimpleHintStream(firstPageObjNums, remainingObjects, newOffsets);
  const hintOffset = currentOffset;
  writeStr(`${hintObjNum} 0 obj\n`);
  writeStr(`<< /Length ${hintData.length} /S ${hintData.length} >>\n`);
  writeStr('stream\n');
  writeBytes(hintData);
  writeStr('\nendstream\n');
  writeStr('endobj\n');
  newOffsets.set(hintObjNum, hintOffset);

  // 6. Main cross-reference table
  const totalSize = linObjNum + 2; // original objects + linearization dict + hint stream
  const mainXrefOffset = currentOffset;

  writeStr('xref\n');
  writeStr(`0 ${totalSize}\n`);
  writeStr('0000000000 65535 f \n'); // object 0

  for (let i = 1; i < totalSize; i++) {
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
  writeStr(`/Size ${totalSize}\n`);
  writeStr(`/Root ${trailer.rootRef}\n`);
  if (trailer.infoRef) {
    writeStr(`/Info ${trailer.infoRef}\n`);
  }
  writeStr('>>\n');
  writeStr('startxref\n');
  writeStr(`${mainXrefOffset}\n`);
  writeStr('%%EOF\n');

  const fileLength = currentOffset;

  // Combine all chunks
  const result = new Uint8Array(fileLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  // Patch the linearization dictionary placeholders
  patchNumber(result, linDictPlaceholder, '/L ', fileLength);
  patchNumber(result, linDictPlaceholder, '/E ', endOfFirstPage);
  patchNumber(result, linDictPlaceholder, '/T ', mainXrefOffset);

  return result;
}

/** Build a simplified hint stream. */
function buildSimpleHintStream(
  firstPageObjs: number[],
  remainingObjs: number[],
  offsets: Map<number, number>,
): Uint8Array {
  // Simplified: just store page offset data as a series of 4-byte big-endian
  // integers giving the offset of each page's objects.
  const allObjNums = [...firstPageObjs, ...remainingObjs];
  const data = new Uint8Array(allObjNums.length * 4);
  for (let i = 0; i < allObjNums.length; i++) {
    const off = offsets.get(allObjNums[i]!) ?? 0;
    data[i * 4] = (off >>> 24) & 0xff;
    data[i * 4 + 1] = (off >>> 16) & 0xff;
    data[i * 4 + 2] = (off >>> 8) & 0xff;
    data[i * 4 + 3] = off & 0xff;
  }
  return data;
}

/** Patch a 10-digit number placeholder in the output. */
function patchNumber(
  data: Uint8Array,
  searchStart: number,
  prefix: string,
  value: number,
): void {
  const prefixBytes = encoder.encode(prefix);
  const searchEnd = Math.min(searchStart + 500, data.length);

  outer:
  for (let i = searchStart; i < searchEnd - prefixBytes.length; i++) {
    for (let j = 0; j < prefixBytes.length; j++) {
      if (data[i + j] !== prefixBytes[j]) continue outer;
    }
    // Found prefix — patch the 10-digit number after it
    const numStr = value.toString().padStart(10, '0');
    const numBytes = encoder.encode(numStr);
    for (let k = 0; k < 10 && i + prefixBytes.length + k < data.length; k++) {
      data[i + prefixBytes.length + k] = numBytes[k]!;
    }
    return;
  }
}

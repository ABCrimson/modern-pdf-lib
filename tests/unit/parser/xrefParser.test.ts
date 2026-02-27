/**
 * Tests for XrefParser -- cross-reference table and stream parser.
 *
 * Tests cover:
 * - findStartXref(): locating startxref offset
 * - parseTraditionalXref(): traditional text-based xref tables
 * - Xref subsections (non-contiguous object numbering)
 * - Trailer dictionary parsing (/Size, /Root, /Info, /Prev)
 * - parseXref() with /Prev chains for incremental updates
 * - Loop detection in /Prev chains
 * - rebuildXrefFromScan() for corrupt files
 * - Edge cases: empty xref, single entry, missing trailer
 * - XrefEntry type and XrefTable structure
 */

import { describe, it, expect } from 'vitest';
import {
  XrefParser,
} from '../../../src/parser/xrefParser.js';
import type { XrefEntry, ParsedTrailer } from '../../../src/parser/xrefParser.js';
import { PdfLexer } from '../../../src/parser/lexer.js';
import { PdfObjectParser } from '../../../src/parser/objectParser.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a plain string to Uint8Array (Latin-1 / ASCII). */
function toBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/** Create an XrefParser from a string (convenience). */
function makeParser(str: string): XrefParser {
  const data = toBytes(str);
  const lexer = new PdfLexer(data);
  const registry = new PdfObjectRegistry();
  const objectParser = new PdfObjectParser(lexer, registry);
  return new XrefParser(data, objectParser);
}

/**
 * Build a minimal valid PDF string with precise byte offsets.
 * Returns the complete PDF string so tests can modify or inspect it.
 */
function buildMinimalPdf(opts?: {
  info?: boolean;
  pages?: number;
  mediaBox?: number[];
}): string {
  const pageCount = opts?.pages ?? 1;
  const mediaBox = opts?.mediaBox ?? [0, 0, 612, 792];
  const mediaBoxStr = `[${mediaBox.join(' ')}]`;

  // Build objects, tracking their positions
  const lines: string[] = [];
  const offsets: number[] = [];

  lines.push('%PDF-1.4\n');

  let pos = lines[0]!.length;

  // Object 1: Catalog
  offsets.push(pos);
  const catalogObj = `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n`;
  lines.push(catalogObj);
  pos += catalogObj.length;

  // Object 2: Pages node
  offsets.push(pos);
  const kidsRefs = [];
  for (let i = 0; i < pageCount; i++) {
    kidsRefs.push(`${3 + i} 0 R`);
  }
  const pagesObj = `2 0 obj<</Type/Pages/Kids[${kidsRefs.join(' ')}]/Count ${pageCount}>>endobj\n`;
  lines.push(pagesObj);
  pos += pagesObj.length;

  // Page objects
  for (let i = 0; i < pageCount; i++) {
    const objNum = 3 + i;
    offsets.push(pos);
    const pageObj = `${objNum} 0 obj<</Type/Page/Parent 2 0 R/MediaBox${mediaBoxStr}>>endobj\n`;
    lines.push(pageObj);
    pos += pageObj.length;
  }

  // Info dict (optional)
  let infoObjNum: number | undefined;
  if (opts?.info) {
    infoObjNum = 3 + pageCount;
    offsets.push(pos);
    const infoObj = `${infoObjNum} 0 obj<</Title(Test PDF)/Author(Tester)>>endobj\n`;
    lines.push(infoObj);
    pos += infoObj.length;
  }

  const totalObjects = offsets.length + 1; // +1 for free entry 0

  // xref table
  const xrefPos = pos;
  let xrefSection = 'xref\n';
  xrefSection += `0 ${totalObjects}\n`;
  xrefSection += '0000000000 65535 f \r\n';
  for (const offset of offsets) {
    xrefSection += `${String(offset).padStart(10, '0')} 00000 n \r\n`;
  }
  lines.push(xrefSection);

  // Trailer
  let trailerStr = `trailer<</Size ${totalObjects}/Root 1 0 R`;
  if (infoObjNum !== undefined) {
    trailerStr += `/Info ${infoObjNum} 0 R`;
  }
  trailerStr += '>>\n';
  lines.push(trailerStr);

  // startxref
  lines.push(`startxref\n${xrefPos}\n%%EOF\n`);

  return lines.join('');
}

// ---------------------------------------------------------------------------
// findStartXref
// ---------------------------------------------------------------------------

describe('XrefParser.findStartXref', () => {
  it('finds the startxref offset in a minimal PDF', () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const offset = parser.findStartXref();
    expect(offset).toBeGreaterThan(0);
    // The offset should point to where "xref" begins in the string
    expect(pdfStr.substring(offset, offset + 4)).toBe('xref');
  });

  it('handles startxref with extra whitespace', () => {
    const pdfStr = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
      + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n'
      + 'xref\n0 3\n'
      + '0000000000 65535 f \r\n'
      + '0000000009 00000 n \r\n'
      + '0000000052 00000 n \r\n'
      + 'trailer<</Size 3/Root 1 0 R>>\n'
      + 'startxref\n  100  \n%%EOF\n';
    const parser = makeParser(pdfStr);
    const offset = parser.findStartXref();
    expect(offset).toBe(100);
  });

  it('throws if startxref is missing', () => {
    const data = '%PDF-1.4\nSome content without startxref at all\n%%EOF\n';
    const parser = makeParser(data);
    expect(() => parser.findStartXref()).toThrow(/startxref/);
  });

  it('throws if startxref has no valid number after it', () => {
    const data = '%PDF-1.4\nstartxref\nnotanumber\n%%EOF\n';
    const parser = makeParser(data);
    expect(() => parser.findStartXref()).toThrow(/startxref/);
  });

  it('throws if startxref offset is out of range', () => {
    // The offset is larger than the file
    const data = '%PDF-1.4\nstartxref\n999999\n%%EOF\n';
    const parser = makeParser(data);
    expect(() => parser.findStartXref()).toThrow(/out of range/);
  });

  it('finds startxref when it appears in the last 2048 bytes', () => {
    // Pad the file with whitespace so startxref is near the end
    const padding = ' '.repeat(1500);
    const pdfStr = buildMinimalPdf();
    // Insert padding before the xref section
    const xrefIdx = pdfStr.indexOf('xref\n');
    const beforeXref = pdfStr.substring(0, xrefIdx);
    const afterXref = pdfStr.substring(xrefIdx);
    // Recalculate xref offset
    const newXrefPos = beforeXref.length + padding.length;
    const modifiedAfter = afterXref.replace(
      /startxref\n\d+/,
      `startxref\n${newXrefPos}`,
    );
    const paddedPdf = beforeXref + padding + modifiedAfter;
    const parser = makeParser(paddedPdf);
    const offset = parser.findStartXref();
    expect(offset).toBe(newXrefPos);
  });
});

// ---------------------------------------------------------------------------
// parseTraditionalXref
// ---------------------------------------------------------------------------

describe('XrefParser.parseTraditionalXref', () => {
  it('parses a basic xref table with standard 20-byte entries', () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const xrefOffset = parser.findStartXref();
    const { entries, trailerDict } = parser.parseTraditionalXref(xrefOffset);

    // Should have 4 entries: 0 (free) + catalog + pages + page
    expect(entries.length).toBe(4);

    // Entry 0 is free
    expect(entries[0]!.objectNumber).toBe(0);
    expect(entries[0]!.type).toBe('free');
    expect(entries[0]!.generationNumber).toBe(65535);

    // Entry 1 is in-use (Catalog)
    expect(entries[1]!.objectNumber).toBe(1);
    expect(entries[1]!.type).toBe('in-use');
    expect(entries[1]!.generationNumber).toBe(0);
    expect(entries[1]!.offset).toBeGreaterThan(0);

    // Trailer dict should have /Size and /Root
    expect(trailerDict.has('/Size')).toBe(true);
    expect(trailerDict.has('/Root')).toBe(true);
  });

  it('parses xref with multiple subsections', () => {
    // Build a PDF with a non-contiguous xref
    // Subsection 1: objects 0-1
    // Subsection 2: objects 5-6
    const pdfBody =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 5 0 R>>endobj\n' +
      '5 0 obj<</Type/Pages/Kids[6 0 R]/Count 1>>endobj\n' +
      '6 0 obj<</Type/Page/Parent 5 0 R/MediaBox[0 0 612 792]>>endobj\n';

    const catalogOffset = 9;   // '%PDF-1.4\n' is 9 bytes
    const pagesOffset = 52;    // after catalog obj
    const pageOffset = 101;    // after pages obj
    const xrefPos = pdfBody.length; // 164

    const xrefSection =
      'xref\n' +
      '0 2\n' +
      '0000000000 65535 f \r\n' +
      `${String(catalogOffset).padStart(10, '0')} 00000 n \r\n` +
      '5 2\n' +
      `${String(pagesOffset).padStart(10, '0')} 00000 n \r\n` +
      `${String(pageOffset).padStart(10, '0')} 00000 n \r\n`;

    const trailer = `trailer<</Size 7/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const fullPdf = pdfBody + xrefSection + trailer;
    const parser = makeParser(fullPdf);
    const xrefOffset = parser.findStartXref();
    const result = parser.parseTraditionalXref(xrefOffset);

    // Should have 4 entries: 0, 1, 5, 6
    expect(result.entries.length).toBe(4);

    const objNums = result.entries.map(e => e.objectNumber);
    expect(objNums).toContain(0);
    expect(objNums).toContain(1);
    expect(objNums).toContain(5);
    expect(objNums).toContain(6);

    // Verify object 5 is in-use
    const entry5 = result.entries.find(e => e.objectNumber === 5);
    expect(entry5).toBeDefined();
    expect(entry5!.type).toBe('in-use');
  });

  it('throws on missing xref keyword', () => {
    const pdfStr = '%PDF-1.4\nnotxref\n';
    const parser = makeParser(pdfStr);
    expect(() => parser.parseTraditionalXref(9)).toThrow(/expected "xref"/);
  });

  it('throws on malformed subsection header', () => {
    const data = '%PDF-1.4\nxref\nBAD HEADER\n';
    const parser = makeParser(data);
    expect(() => parser.parseTraditionalXref(9)).toThrow(/malformed xref subsection/);
  });

  it('parses single-entry xref (just free entry)', () => {
    // A degenerate xref with only the free entry
    // We still need a valid trailer for the parser.
    const pdfStr =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n';

    const xrefPos = pdfStr.length;
    const xrefSection =
      'xref\n' +
      '0 1\n' +
      '0000000000 65535 f \r\n';
    const trailer = `trailer<</Size 3/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const fullPdf = pdfStr + xrefSection + trailer;
    const parser = makeParser(fullPdf);
    const result = parser.parseTraditionalXref(xrefPos);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.objectNumber).toBe(0);
    expect(result.entries[0]!.type).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// Trailer parsing
// ---------------------------------------------------------------------------

describe('XrefParser trailer parsing (via parseXref)', () => {
  it('extracts /Size and /Root from trailer', async () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const { trailer } = await parser.parseXref();

    expect(trailer.size).toBeGreaterThanOrEqual(4);
    expect(trailer.rootRef).toBeDefined();
    expect(trailer.rootRef.objectNumber).toBe(1);
    expect(trailer.rootRef.generationNumber).toBe(0);
  });

  it('extracts /Info ref from trailer when present', async () => {
    const pdfStr = buildMinimalPdf({ info: true });
    const parser = makeParser(pdfStr);
    const { trailer } = await parser.parseXref();

    expect(trailer.infoRef).toBeDefined();
    expect(trailer.infoRef!.objectNumber).toBeGreaterThan(0);
  });

  it('omits /Info when not present', async () => {
    const pdfStr = buildMinimalPdf({ info: false });
    const parser = makeParser(pdfStr);
    const { trailer } = await parser.parseXref();

    expect(trailer.infoRef).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseXref: full pipeline
// ---------------------------------------------------------------------------

describe('XrefParser.parseXref', () => {
  it('parses a valid xref and returns entries map + trailer', async () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const { entries, trailer } = await parser.parseXref();

    // entries should be a Map<number, XrefEntry>
    expect(entries).toBeInstanceOf(Map);
    expect(entries.size).toBeGreaterThanOrEqual(3); // at least 0, 1, 2, 3

    // Free entry (object 0)
    const entry0 = entries.get(0);
    expect(entry0).toBeDefined();
    expect(entry0!.type).toBe('free');

    // Object 1 (Catalog)
    const entry1 = entries.get(1);
    expect(entry1).toBeDefined();
    expect(entry1!.type).toBe('in-use');

    // Trailer
    expect(trailer.size).toBeGreaterThan(0);
    expect(trailer.rootRef.objectNumber).toBe(1);
  });

  it('follows /Prev chain for incremental updates (newest wins)', async () => {
    // Build a PDF with two xref sections:
    // 1. Original xref at offset A with object 1 pointing to offset X
    // 2. Updated xref at offset B with object 1 pointing to offset Y
    //    The newer section's trailer has /Prev pointing to A

    // Object definitions
    const obj1v1 = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n';
    const obj2 = '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n';
    const obj3 = '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n';
    // Updated version of object 1 (different content)
    const obj1v2 = '1 0 obj<</Type/Catalog/Pages 2 0 R/MarkInfo<</Marked true>>>>endobj\n';

    const header = '%PDF-1.4\n';
    const obj1v1Offset = header.length;
    const obj2Offset = obj1v1Offset + obj1v1.length;
    const obj3Offset = obj2Offset + obj2.length;
    const xref1Pos = obj3Offset + obj3.length;

    // First xref table
    let xref1 = 'xref\n0 4\n';
    xref1 += '0000000000 65535 f \r\n';
    xref1 += `${String(obj1v1Offset).padStart(10, '0')} 00000 n \r\n`;
    xref1 += `${String(obj2Offset).padStart(10, '0')} 00000 n \r\n`;
    xref1 += `${String(obj3Offset).padStart(10, '0')} 00000 n \r\n`;
    const trailer1 = `trailer<</Size 4/Root 1 0 R>>\n`;

    const afterXref1 = header + obj1v1 + obj2 + obj3 + xref1 + trailer1;

    // Now the incremental update
    const obj1v2Offset = afterXref1.length;
    const xref2Pos = obj1v2Offset + obj1v2.length;

    let xref2 = 'xref\n1 1\n';
    xref2 += `${String(obj1v2Offset).padStart(10, '0')} 00000 n \r\n`;
    const trailer2 = `trailer<</Size 4/Root 1 0 R/Prev ${xref1Pos}>>\n`;

    const fullPdf = afterXref1 + obj1v2 + xref2 + trailer2
      + `startxref\n${xref2Pos}\n%%EOF\n`;

    const parser = makeParser(fullPdf);
    const { entries, trailer } = await parser.parseXref();

    // Object 1 should point to the NEWER offset (obj1v2Offset)
    const entry1 = entries.get(1);
    expect(entry1).toBeDefined();
    expect(entry1!.offset).toBe(obj1v2Offset);

    // Objects 2 and 3 should still point to original offsets
    const entry2 = entries.get(2);
    expect(entry2).toBeDefined();
    expect(entry2!.offset).toBe(obj2Offset);

    const entry3 = entries.get(3);
    expect(entry3).toBeDefined();
    expect(entry3!.offset).toBe(obj3Offset);
  });

  it('detects and breaks infinite /Prev loops', async () => {
    // Build a PDF where /Prev loops back to itself
    const header = '%PDF-1.4\n';
    const obj1 = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n';
    const obj2 = '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n';

    const obj1Offset = header.length;
    const obj2Offset = obj1Offset + obj1.length;
    const xrefPos = obj2Offset + obj2.length;

    let xref = 'xref\n0 3\n';
    xref += '0000000000 65535 f \r\n';
    xref += `${String(obj1Offset).padStart(10, '0')} 00000 n \r\n`;
    xref += `${String(obj2Offset).padStart(10, '0')} 00000 n \r\n`;
    // /Prev points back to the same xref section (loop!)
    const trailer = `trailer<</Size 3/Root 1 0 R/Prev ${xrefPos}>>\n`;

    const fullPdf = header + obj1 + obj2 + xref + trailer
      + `startxref\n${xrefPos}\n%%EOF\n`;

    const parser = makeParser(fullPdf);
    // Should not hang; should complete and return valid data
    const { entries, trailer: parsedTrailer } = await parser.parseXref();
    expect(entries.size).toBeGreaterThanOrEqual(2);
    expect(parsedTrailer.rootRef.objectNumber).toBe(1);
  });

  it('falls back to rebuildXrefFromScan when startxref is missing', async () => {
    // A PDF-like file with objects but no startxref
    const data =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n' +
      '%%EOF\n';

    const parser = makeParser(data);
    // parseXref should use recovery scan since there's no startxref
    const { entries, trailer } = await parser.parseXref();

    // Should find objects 1 and 2
    expect(entries.has(1)).toBe(true);
    expect(entries.has(2)).toBe(true);

    // Should find /Root by scanning for /Type /Catalog
    expect(trailer.rootRef.objectNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// XrefEntry type checks
// ---------------------------------------------------------------------------

describe('XrefEntry structure', () => {
  it('has correct fields for in-use entries', async () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const { entries } = await parser.parseXref();

    const entry1 = entries.get(1)!;
    expect(entry1.objectNumber).toBe(1);
    expect(entry1.generationNumber).toBe(0);
    expect(entry1.offset).toBeGreaterThan(0);
    expect(entry1.type).toBe('in-use');
    expect(entry1.containerObjectNumber).toBeUndefined();
    expect(entry1.indexInStream).toBeUndefined();
  });

  it('has correct fields for free entries', async () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const { entries } = await parser.parseXref();

    const entry0 = entries.get(0)!;
    expect(entry0.objectNumber).toBe(0);
    expect(entry0.generationNumber).toBe(65535);
    expect(entry0.type).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// Xref with multiple pages
// ---------------------------------------------------------------------------

describe('XrefParser with multi-page PDFs', () => {
  it('parses xref for a PDF with 3 pages', async () => {
    const pdfStr = buildMinimalPdf({ pages: 3 });
    const parser = makeParser(pdfStr);
    const { entries, trailer } = await parser.parseXref();

    // 0 (free) + 1 (catalog) + 2 (pages) + 3,4,5 (three page objects)
    expect(entries.size).toBe(6);
    expect(trailer.size).toBe(6);

    // All page objects should be in-use
    for (let i = 3; i <= 5; i++) {
      const entry = entries.get(i);
      expect(entry).toBeDefined();
      expect(entry!.type).toBe('in-use');
    }
  });
});

// ---------------------------------------------------------------------------
// Xref with Info dictionary
// ---------------------------------------------------------------------------

describe('XrefParser with /Info', () => {
  it('includes Info object in xref entries', async () => {
    const pdfStr = buildMinimalPdf({ info: true, pages: 1 });
    const parser = makeParser(pdfStr);
    const { entries, trailer } = await parser.parseXref();

    // Should have entry for the info dict
    const infoObjNum = trailer.infoRef!.objectNumber;
    const infoEntry = entries.get(infoObjNum);
    expect(infoEntry).toBeDefined();
    expect(infoEntry!.type).toBe('in-use');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('XrefParser edge cases', () => {
  it('handles xref with zero in-use entries', async () => {
    // Only the free entry exists
    const pdfStr =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n';

    const xrefPos = pdfStr.length;
    const xref =
      'xref\n0 1\n' +
      '0000000000 65535 f \r\n' +
      `trailer<</Size 3/Root 1 0 R>>\n` +
      `startxref\n${xrefPos}\n%%EOF\n`;

    const fullPdf = pdfStr + xref;
    const parser = makeParser(fullPdf);
    const { entries } = await parser.parseXref();

    // Only the free entry from the xref table, but objects 1 and 2 exist
    // The parser will still return what was in the xref
    expect(entries.get(0)!.type).toBe('free');
  });

  it('handles LF-only line endings in xref entries', () => {
    // Some PDF producers use just LF instead of CR+LF for xref entries
    const header = '%PDF-1.4\n';
    const obj1 = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n';
    const obj2 = '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n';

    const obj1Offset = header.length;
    const obj2Offset = obj1Offset + obj1.length;
    const xrefPos = obj2Offset + obj2.length;

    // Use LF-only endings (not spec-compliant but common)
    const xrefSection =
      'xref\n' +
      '0 3\n' +
      '0000000000 65535 f \n' +
      `${String(obj1Offset).padStart(10, '0')} 00000 n \n` +
      `${String(obj2Offset).padStart(10, '0')} 00000 n \n`;

    const fullPdf = header + obj1 + obj2 + xrefSection
      + `trailer<</Size 3/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const parser = makeParser(fullPdf);
    const result = parser.parseTraditionalXref(xrefPos);
    expect(result.entries.length).toBe(3);
    expect(result.entries[1]!.offset).toBe(obj1Offset);
    expect(result.entries[2]!.offset).toBe(obj2Offset);
  });

  it('handles xref entry with offset 0000000000 for free object', () => {
    const pdfStr = buildMinimalPdf();
    const parser = makeParser(pdfStr);
    const xrefOffset = parser.findStartXref();
    const { entries } = parser.parseTraditionalXref(xrefOffset);

    const freeEntry = entries.find(e => e.type === 'free');
    expect(freeEntry).toBeDefined();
    expect(freeEntry!.offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rebuildXrefFromScan (via parseXref fallback)
// ---------------------------------------------------------------------------

describe('XrefParser recovery scan', () => {
  it('recovers by scanning for "N G obj" patterns', async () => {
    // A file with no valid xref table or startxref, but has objects
    const data =
      '%PDF-1.4\n' +
      '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n' +
      '2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n' +
      '3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>\nendobj\n' +
      '%%EOF\n';

    const parser = makeParser(data);
    const { entries, trailer } = await parser.parseXref();

    expect(entries.size).toBeGreaterThanOrEqual(3);
    expect(entries.has(1)).toBe(true);
    expect(entries.has(2)).toBe(true);
    expect(entries.has(3)).toBe(true);

    expect(trailer.rootRef.objectNumber).toBe(1);
    expect(trailer.size).toBeGreaterThanOrEqual(4);
  });

  it('recovers with a corrupt xref that cannot be parsed', async () => {
    // Build a PDF with a startxref that points to garbage
    const data =
      '%PDF-1.4\n' +
      '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n' +
      '2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj\n' +
      'GARBAGE_DATA_HERE\n' +
      'startxref\n9\n%%EOF\n';

    const parser = makeParser(data);
    // The startxref points to offset 9 which is inside "1 0 obj", not "xref"
    // parseXref should recover via scan
    const { entries, trailer } = await parser.parseXref();

    expect(entries.has(1)).toBe(true);
    expect(trailer.rootRef.objectNumber).toBe(1);
  });

  it('throws when recovery finds no objects at all', async () => {
    // A file with %PDF header but no objects
    const data = '%PDF-1.4\n%%EOF\n';
    const parser = makeParser(data);
    // This should throw because no indirect objects can be found
    await expect(parser.parseXref()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// XrefParser: traditional xref table generation number checks
// ---------------------------------------------------------------------------

describe('XrefParser generation numbers', () => {
  it('preserves non-zero generation numbers from xref entries', () => {
    // Create an xref with a non-zero generation number
    const header = '%PDF-1.4\n';
    const obj = '5 2 obj<</Type/Catalog/Pages 6 0 R>>endobj\n';
    const objOffset = header.length;
    const xrefPos = objOffset + obj.length;

    const xrefSection =
      'xref\n' +
      '0 1\n' +
      '0000000000 65535 f \r\n' +
      '5 1\n' +
      `${String(objOffset).padStart(10, '0')} 00002 n \r\n`;

    const fullPdf = header + obj + xrefSection
      + `trailer<</Size 6/Root 5 2 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const parser = makeParser(fullPdf);
    const result = parser.parseTraditionalXref(xrefPos);

    const entry5 = result.entries.find(e => e.objectNumber === 5);
    expect(entry5).toBeDefined();
    expect(entry5!.generationNumber).toBe(2);
    expect(entry5!.type).toBe('in-use');
  });
});

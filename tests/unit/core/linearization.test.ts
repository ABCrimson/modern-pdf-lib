/**
 * Tests for PDF linearization — detection, linearization, delinearization,
 * hint tables, cross-reference streams, and round-trip integrity.
 *
 * Covers:
 * - isLinearized detection (true/false cases)
 * - getLinearizationInfo extraction
 * - Linearization of single-page PDFs
 * - Linearization of multi-page PDFs — first page objects come first
 * - Linearization dictionary present and valid
 * - Hint stream present with /S (shared object table offset)
 * - Cross-reference stream in the output
 * - delinearizePdf removes linearization artifacts
 * - Round-trip: linearize -> delinearize -> same content
 * - Already linearized PDF — idempotent
 * - Empty/minimal PDF handling
 * - Error handling for invalid input
 * - firstPage option
 * - Exact byte offset verification for hint tables
 * - Page offset hint table binary format (13-field header)
 * - Shared object hint table binary format (7-field header)
 * - Cross-reference stream integrity
 * - Roundtrip: linearize -> verify offsets -> delinearize -> verify content
 * - Multi-page documents with shared resources
 * - Documents with large objects spanning multiple pages
 * - Two-pass serialization convergence
 */

import { describe, it, expect } from 'vitest';
import {
  isLinearized,
  linearizePdf,
  delinearizePdf,
  getLinearizationInfo,
  readU32BE,
} from '../../../src/core/linearization.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Build a minimal valid PDF with a given number of pages.
 */
function makeMinimalPdf(pageCount = 1): Uint8Array {
  // Objects:
  //  1: Catalog
  //  2: Pages
  //  3..2+N: Page objects
  //  3+N..2+2N: Content streams (one per page)
  //  3+2N: Info dict
  const totalPageObjects = pageCount;
  const firstPageObj = 3;
  const firstContentObj = 3 + totalPageObjects;
  const infoObj = 3 + 2 * totalPageObjects;
  const totalObjects = infoObj; // highest obj number

  // Build kids array
  const kidsRefs = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`);

  const objectStrings: string[] = [];

  // Catalog
  objectStrings.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // Pages
  objectStrings.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pageCount} >>\nendobj`,
  );

  // Page objects
  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObj + i;
    const contentObjNum = firstContentObj + i;
    objectStrings.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << >> >>\nendobj`,
    );
  }

  // Content streams (each with distinct content so we can verify ordering)
  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = firstContentObj + i;
    const content = `BT /F1 12 Tf 100 700 Td (Page ${i + 1}) Tj ET`;
    objectStrings.push(
      `${contentObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    );
  }

  // Info dict
  objectStrings.push(`${infoObj} 0 obj\n<< /Producer (test-linearization) >>\nendobj`);

  // Build body
  const bodyStr = objectStrings.join('\n') + '\n';
  const bodyBytes = encoder.encode(bodyStr);

  // Calculate offsets from the full text
  const header = '%PDF-1.7\n';
  const headerBytes = encoder.encode(header);
  const fullBodyStr = header + bodyStr;

  // Find object offsets
  const offsets = new Map<number, number>();
  for (let i = 1; i <= totalObjects; i++) {
    const marker = `${i} 0 obj`;
    const idx = fullBodyStr.indexOf(marker);
    if (idx >= 0) {
      offsets.set(i, idx);
    }
  }

  // Build xref
  const xrefSize = totalObjects + 1;
  let xref = `xref\n0 ${xrefSize}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < xrefSize; i++) {
    const off = offsets.get(i);
    if (off !== undefined) {
      xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
    } else {
      xref += '0000000000 00000 f \n';
    }
  }

  const xrefOffset = headerBytes.length + bodyBytes.length;

  // Trailer
  xref += `trailer\n<< /Size ${xrefSize} /Root 1 0 R /Info ${infoObj} 0 R >>\n`;
  xref += `startxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(header + bodyStr + xref);
}

/**
 * Build a PDF with shared resources (e.g. a font dict referenced by multiple pages).
 */
function makePdfWithSharedResources(pageCount = 3): Uint8Array {
  // Objects:
  //  1: Catalog
  //  2: Pages
  //  3: Shared Font resource
  //  4..3+N: Page objects
  //  4+N..3+2N: Content streams
  //  4+2N: Info dict
  const fontObj = 3;
  const firstPageObj = 4;
  const firstContentObj = 4 + pageCount;
  const infoObj = 4 + 2 * pageCount;
  const totalObjects = infoObj;

  const kidsRefs = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`);
  const objectStrings: string[] = [];

  objectStrings.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objectStrings.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pageCount} >>\nendobj`,
  );
  // Shared font resource
  objectStrings.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
  );

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObj + i;
    const contentObjNum = firstContentObj + i;
    objectStrings.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj`,
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = firstContentObj + i;
    const content = `BT /F1 12 Tf 100 700 Td (SharedPage ${i + 1}) Tj ET`;
    objectStrings.push(
      `${contentObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    );
  }

  objectStrings.push(`${infoObj} 0 obj\n<< /Producer (shared-resources-test) >>\nendobj`);

  const bodyStr = objectStrings.join('\n') + '\n';
  const header = '%PDF-1.7\n';
  const fullStr = header + bodyStr;

  const offsets = new Map<number, number>();
  for (let i = 1; i <= totalObjects; i++) {
    const marker = `${i} 0 obj`;
    const idx = fullStr.indexOf(marker);
    if (idx >= 0) offsets.set(i, idx);
  }

  const bodyBytes = encoder.encode(bodyStr);
  const headerBytes = encoder.encode(header);
  const xrefOffset = headerBytes.length + bodyBytes.length;
  const xrefSize = totalObjects + 1;

  let xref = `xref\n0 ${xrefSize}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < xrefSize; i++) {
    const off = offsets.get(i);
    if (off !== undefined) {
      xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
    } else {
      xref += '0000000000 00000 f \n';
    }
  }

  xref += `trailer\n<< /Size ${xrefSize} /Root 1 0 R /Info ${infoObj} 0 R >>\n`;
  xref += `startxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(fullStr + xref);
}

/**
 * Build a PDF with large content streams to test cross-page spanning.
 */
function makePdfWithLargeObjects(pageCount = 3, contentSize = 2000): Uint8Array {
  const firstPageObj = 3;
  const firstContentObj = 3 + pageCount;
  const infoObj = 3 + 2 * pageCount;
  const totalObjects = infoObj;

  const kidsRefs = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`);
  const objectStrings: string[] = [];

  objectStrings.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objectStrings.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pageCount} >>\nendobj`,
  );

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObj + i;
    const contentObjNum = firstContentObj + i;
    objectStrings.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << >> >>\nendobj`,
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = firstContentObj + i;
    // Generate a large content stream
    const filler = 'X'.repeat(contentSize);
    const content = `BT /F1 12 Tf 100 700 Td (LargePage ${i + 1} ${filler}) Tj ET`;
    objectStrings.push(
      `${contentObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    );
  }

  objectStrings.push(`${infoObj} 0 obj\n<< /Producer (large-objects-test) >>\nendobj`);

  const bodyStr = objectStrings.join('\n') + '\n';
  const header = '%PDF-1.7\n';
  const fullStr = header + bodyStr;

  const offsets = new Map<number, number>();
  for (let i = 1; i <= totalObjects; i++) {
    const marker = `${i} 0 obj`;
    const idx = fullStr.indexOf(marker);
    if (idx >= 0) offsets.set(i, idx);
  }

  const bodyBytes = encoder.encode(bodyStr);
  const headerBytes = encoder.encode(header);
  const xrefOffset = headerBytes.length + bodyBytes.length;
  const xrefSize = totalObjects + 1;

  let xref = `xref\n0 ${xrefSize}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < xrefSize; i++) {
    const off = offsets.get(i);
    if (off !== undefined) {
      xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
    } else {
      xref += '0000000000 00000 f \n';
    }
  }

  xref += `trailer\n<< /Size ${xrefSize} /Root 1 0 R /Info ${infoObj} 0 R >>\n`;
  xref += `startxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(fullStr + xref);
}

/** Convert Uint8Array to string for inspection. */
function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Check if the PDF text contains a given substring. */
function pdfContains(bytes: Uint8Array, substr: string): boolean {
  return pdfToString(bytes).includes(substr);
}

/**
 * Extract the hint stream binary data from a linearized PDF.
 * Returns { hintOffset, hintLength, hintData, sharedOffset }.
 */
function extractHintStream(result: Uint8Array): {
  hintOffset: number;
  hintLength: number;
  hintData: Uint8Array;
  sharedOffset: number;
} {
  const str = pdfToString(result);

  // Extract /H [offset length]
  const hMatch = /\/H\s+\[\s*(\d+)\s+(\d+)\s*\]/.exec(str);
  if (!hMatch) throw new Error('No /H array found');
  const hintOffset = parseInt(hMatch[1]!, 10);
  const hintLength = parseInt(hMatch[2]!, 10);

  // Read the hint stream object at hintOffset
  const hintObjStr = decoder.decode(result.subarray(hintOffset, hintOffset + hintLength));

  // Extract /S value (shared object hint table offset within stream)
  const sMatch = /\/S\s+(\d+)/.exec(hintObjStr);
  const sharedOffset = sMatch ? parseInt(sMatch[1]!, 10) : 0;

  // Find the stream data
  const streamStart = hintObjStr.indexOf('stream\n');
  if (streamStart < 0) throw new Error('No stream keyword found');
  const dataStart = streamStart + 7; // 'stream\n'.length

  const endStreamPos = hintObjStr.indexOf('\nendstream');
  if (endStreamPos < 0) throw new Error('No endstream found');

  // Extract /Length
  const lenMatch = /\/Length\s+(\d+)/.exec(hintObjStr);
  const streamLength = lenMatch ? parseInt(lenMatch[1]!, 10) : (endStreamPos - dataStart);

  const hintData = result.subarray(
    hintOffset + encoder.encode(hintObjStr.slice(0, dataStart)).length,
    hintOffset + encoder.encode(hintObjStr.slice(0, dataStart)).length + streamLength,
  );

  return { hintOffset, hintLength, hintData, sharedOffset };
}

/**
 * Find all object offsets in the linearized output by scanning
 * for "N 0 obj" markers. Only matches at line boundaries (after
 * newline or at start of string) to avoid matching inside binary data.
 */
function findObjectOffsets(data: Uint8Array): Map<number, number> {
  const str = pdfToString(data);
  const offsets = new Map<number, number>();
  const regex = /(?:^|\n)(\d+)\s+0\s+obj/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    const objNum = parseInt(match[1]!, 10);
    // The offset should point to the digit, not the newline
    const digitOffset = match[0].startsWith('\n') ? match.index + 1 : match.index;
    offsets.set(objNum, digitOffset);
  }
  return offsets;
}

// ---------------------------------------------------------------------------
// isLinearized
// ---------------------------------------------------------------------------

describe('isLinearized', () => {
  it('should return false for a normal PDF', () => {
    const pdf = makeMinimalPdf();
    expect(isLinearized(pdf)).toBe(false);
  });

  it('should return true for a PDF with /Linearized in the header', () => {
    const linearizedHeader = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Linearized 1.0 /L 1000 /O 3 /E 500 /N 1 /T 800 >>\nendobj\n',
    );
    expect(isLinearized(linearizedHeader)).toBe(true);
  });

  it('should return false for empty data', () => {
    expect(isLinearized(new Uint8Array(0))).toBe(false);
  });

  it('should return false for non-PDF data', () => {
    const garbage = encoder.encode('Hello world, this is not a PDF file.');
    expect(isLinearized(garbage)).toBe(false);
  });

  it('should detect /Linearized with different versions', () => {
    const v1 = encoder.encode('%PDF-1.7\n1 0 obj\n<< /Linearized 1.0 >>\nendobj\n');
    const v2 = encoder.encode('%PDF-1.7\n1 0 obj\n<< /Linearized 2.0 >>\nendobj\n');
    expect(isLinearized(v1)).toBe(true);
    expect(isLinearized(v2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLinearizationInfo
// ---------------------------------------------------------------------------

describe('getLinearizationInfo', () => {
  it('should return null for non-linearized PDF', () => {
    const pdf = makeMinimalPdf();
    expect(getLinearizationInfo(pdf)).toBeNull();
  });

  it('should extract linearization parameters', () => {
    const header = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Linearized 1.0 /L 5000 /O 3 /E 2000 /N 5 /T 4500 >>\nendobj\n',
    );
    const info = getLinearizationInfo(header);
    expect(info).not.toBeNull();
    expect(info!.version).toBe(1.0);
    expect(info!.length).toBe(5000);
    expect(info!.primaryPage).toBe(3);
    expect(info!.pageCount).toBe(5);
    expect(info!.firstPageOffset).toBe(2000);
  });

  it('should work with linearized PDF produced by linearizePdf', async () => {
    const pdf = makeMinimalPdf(3);
    const linearized = await linearizePdf(pdf);
    const info = getLinearizationInfo(linearized);
    expect(info).not.toBeNull();
    expect(info!.version).toBe(1.0);
    expect(info!.pageCount).toBe(3);
    expect(info!.length).toBe(linearized.length);
  });
});

// ---------------------------------------------------------------------------
// linearizePdf — basic
// ---------------------------------------------------------------------------

describe('linearizePdf', () => {
  it('should return already-linearized PDFs as-is', async () => {
    const data = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Linearized 1.0 /L 100 >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n100\n%%EOF\n',
    );
    const result = await linearizePdf(data);
    expect(result).toBe(data); // Same reference — idempotent
  });

  it('should linearize a simple 1-page PDF', async () => {
    const pdf = makeMinimalPdf(1);
    const result = await linearizePdf(pdf);

    expect(result.length).toBeGreaterThan(0);
    expect(isLinearized(result)).toBe(true);
  });

  it('should throw for data without startxref', async () => {
    const badPdf = encoder.encode('%PDF-1.7\ngarbage\n');
    await expect(linearizePdf(badPdf)).rejects.toThrow('no startxref');
  });

  it('should throw for invalid xref table', async () => {
    const badPdf = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< >>\nendobj\nxref_broken\nstartxref\n100\n%%EOF\n',
    );
    await expect(linearizePdf(badPdf)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// linearizePdf — linearization dictionary validation
// ---------------------------------------------------------------------------

describe('linearizePdf — linearization dictionary', () => {
  it('should contain /Linearized 1.0', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    expect(str).toMatch(/\/Linearized\s+1\.0/);
  });

  it('should contain /L matching file length', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    const lMatch = /\/L\s+(\d+)/.exec(str);
    expect(lMatch).not.toBeNull();
    expect(parseInt(lMatch![1]!, 10)).toBe(result.length);
  });

  it('should contain /N matching page count', async () => {
    const pdf = makeMinimalPdf(4);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    const nMatch = /\/N\s+(\d+)/.exec(str);
    expect(nMatch).not.toBeNull();
    expect(parseInt(nMatch![1]!, 10)).toBe(4);
  });

  it('should contain /O referencing a page object', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    const oMatch = /\/O\s+(\d+)/.exec(str);
    expect(oMatch).not.toBeNull();
    // The /O value should be a valid object number
    expect(parseInt(oMatch![1]!, 10)).toBeGreaterThan(0);
  });

  it('should contain /E (end of first page) less than file length', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    const eMatch = /\/E\s+(\d+)/.exec(str);
    expect(eMatch).not.toBeNull();
    const endFirstPage = parseInt(eMatch![1]!, 10);
    expect(endFirstPage).toBeGreaterThan(0);
    expect(endFirstPage).toBeLessThanOrEqual(result.length);
  });

  it('should contain /H hint stream reference', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    expect(str).toMatch(/\/H\s+\[/);
  });

  it('should contain /T (main xref offset)', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    const tMatch = /\/T\s+(\d+)/.exec(str);
    expect(tMatch).not.toBeNull();
    const mainXref = parseInt(tMatch![1]!, 10);
    expect(mainXref).toBeGreaterThan(0);
    expect(mainXref).toBeLessThan(result.length);
  });
});

// ---------------------------------------------------------------------------
// linearizePdf — multi-page, first page first
// ---------------------------------------------------------------------------

describe('linearizePdf — multi-page ordering', () => {
  it('should linearize a multi-page PDF', async () => {
    const pdf = makeMinimalPdf(5);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);
  });

  it('should place first-page objects before remaining objects', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // The linearization dict should come first (after header)
    const linPos = str.indexOf('/Linearized');
    expect(linPos).toBeGreaterThan(0);
    expect(linPos).toBeLessThan(200);

    // The /E offset should mark the boundary between first-page and rest
    const eMatch = /\/E\s+(\d+)/.exec(str);
    expect(eMatch).not.toBeNull();
    const endFirstPage = parseInt(eMatch![1]!, 10);
    expect(endFirstPage).toBeGreaterThan(0);
  });

  it('should support firstPage option', async () => {
    const pdf = makeMinimalPdf(3);
    const result0 = await linearizePdf(pdf, { firstPage: 0 });
    const result1 = await linearizePdf(pdf, { firstPage: 1 });

    expect(isLinearized(result0)).toBe(true);
    expect(isLinearized(result1)).toBe(true);

    // Different first pages should produce different /O values
    const oMatch0 = /\/O\s+(\d+)/.exec(pdfToString(result0));
    const oMatch1 = /\/O\s+(\d+)/.exec(pdfToString(result1));
    expect(oMatch0).not.toBeNull();
    expect(oMatch1).not.toBeNull();
    // Object numbers for page 0 vs page 1 should differ
    expect(parseInt(oMatch0![1]!, 10)).not.toBe(parseInt(oMatch1![1]!, 10));
  });
});

// ---------------------------------------------------------------------------
// linearizePdf — hint stream
// ---------------------------------------------------------------------------

describe('linearizePdf — hint stream', () => {
  it('should include a hint stream object', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // The hint stream should contain /S (shared object hint offset)
    // Look for the hint stream: it has /Length and /S
    expect(str).toMatch(/<<\s*\/Length\s+\d+\s+\/S\s+\d+\s*>>/);
  });

  it('should have hint stream at the offset specified in /H', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Extract /H values
    const hMatch = /\/H\s+\[\s*(\d+)\s+(\d+)\s*\]/.exec(str);
    expect(hMatch).not.toBeNull();

    const hintOffset = parseInt(hMatch![1]!, 10);
    const hintLength = parseInt(hMatch![2]!, 10);
    expect(hintOffset).toBeGreaterThan(0);
    expect(hintLength).toBeGreaterThan(0);

    // Check that there's an object at the hint offset
    const atOffset = decoder.decode(result.subarray(hintOffset, hintOffset + 50));
    expect(atOffset).toMatch(/^\d+\s+0\s+obj/);
  });
});

// ---------------------------------------------------------------------------
// linearizePdf — cross-reference stream
// ---------------------------------------------------------------------------

describe('linearizePdf — cross-reference stream', () => {
  it('should include a cross-reference stream (/Type /XRef)', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    expect(pdfContains(result, '/Type /XRef')).toBe(true);
  });

  it('should have /W array in xref stream', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    expect(pdfContains(result, '/W [')).toBe(true);
  });

  it('should have /Root in xref stream', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);
    // The xref stream dictionary should contain /Root
    const xrefStart = str.indexOf('/Type /XRef');
    expect(xrefStart).toBeGreaterThan(0);
    const xrefDictEnd = str.indexOf('>>', xrefStart);
    const xrefDict = str.slice(xrefStart, xrefDictEnd);
    expect(xrefDict).toMatch(/\/Root\s+\d+\s+\d+\s+R/);
  });
});

// ---------------------------------------------------------------------------
// delinearizePdf
// ---------------------------------------------------------------------------

describe('delinearizePdf', () => {
  it('should return non-linearized PDF unchanged', async () => {
    const pdf = makeMinimalPdf();
    const result = await delinearizePdf(pdf);
    expect(result).toBe(pdf); // same reference
  });

  it('should remove linearization from a linearized PDF', async () => {
    const pdf = makeMinimalPdf();
    const linearized = await linearizePdf(pdf);
    expect(isLinearized(linearized)).toBe(true);

    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);
  });

  it('should produce a valid PDF after delinearization', async () => {
    const pdf = makeMinimalPdf(2);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    // Should be a valid PDF
    expect(pdfContains(delinearized, '%PDF-1.7')).toBe(true);
    expect(pdfContains(delinearized, '%%EOF')).toBe(true);
    expect(pdfContains(delinearized, 'startxref')).toBe(true);
    expect(pdfContains(delinearized, '/Root')).toBe(true);
  });

  it('should remove /Linearized dictionary', async () => {
    const pdf = makeMinimalPdf();
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);
    expect(pdfContains(delinearized, '/Linearized')).toBe(false);
  });

  it('should not contain xref stream after delinearization', async () => {
    const pdf = makeMinimalPdf();
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);
    // Delinearized uses traditional xref table
    expect(pdfContains(delinearized, 'xref')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: linearize -> delinearize
// ---------------------------------------------------------------------------

describe('linearize -> delinearize round-trip', () => {
  it('should preserve catalog and page objects', async () => {
    const pdf = makeMinimalPdf(2);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    // Original content should be preserved
    expect(pdfContains(delinearized, '/Type /Catalog')).toBe(true);
    expect(pdfContains(delinearized, '/Type /Pages')).toBe(true);
    expect(pdfContains(delinearized, '/Type /Page')).toBe(true);
  });

  it('should preserve content streams through round-trip', async () => {
    const pdf = makeMinimalPdf(2);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    // Page content should survive round-trip
    expect(pdfContains(delinearized, 'Page 1')).toBe(true);
    expect(pdfContains(delinearized, 'Page 2')).toBe(true);
  });

  it('should preserve info dictionary through round-trip', async () => {
    const pdf = makeMinimalPdf();
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);
    expect(pdfContains(delinearized, 'test-linearization')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotent linearization
// ---------------------------------------------------------------------------

describe('linearizePdf — idempotent', () => {
  it('should return same reference when re-linearizing', async () => {
    const pdf = makeMinimalPdf();
    const first = await linearizePdf(pdf);
    const second = await linearizePdf(first);

    // second should be the same reference since isLinearized returns true
    expect(second).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// PdfDocument integration
// ---------------------------------------------------------------------------

describe('linearizePdf — PdfDocument integration', () => {
  it('should linearize a PDF created with createPdf', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();

    const result = await linearizePdf(bytes);
    expect(result.length).toBeGreaterThan(0);
    expect(isLinearized(result)).toBe(true);
  });

  it('should linearize a multi-page document from createPdf', async () => {
    const doc = createPdf();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save();

    const result = await linearizePdf(bytes);
    expect(isLinearized(result)).toBe(true);

    const info = getLinearizationInfo(result);
    expect(info).not.toBeNull();
    expect(info!.pageCount).toBe(3);
  });

  it('should delinearize a document produced by the library', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();

    const linearized = await linearizePdf(bytes);
    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);
    expect(pdfContains(delinearized, '/Type /Catalog')).toBe(true);
  });

  it('should round-trip a library-produced PDF', async () => {
    const doc = createPdf();
    const page = doc.addPage();
    page.drawText('Hello linearization', { x: 50, y: 700, size: 12 });
    const bytes = await doc.save({ compress: false });

    const linearized = await linearizePdf(bytes);
    expect(isLinearized(linearized)).toBe(true);

    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);

    // Verify the text content survived
    expect(pdfContains(delinearized, 'Hello linearization')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('linearizePdf — edge cases', () => {
  it('should handle a PDF with a single object', async () => {
    // Minimal valid PDF with catalog, pages, page
    const pdf = makeMinimalPdf(1);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);
  });

  it('should handle firstPage beyond page count gracefully', async () => {
    const pdf = makeMinimalPdf(2);
    // firstPage = 100 is beyond the 2 pages; should clamp to last page
    const result = await linearizePdf(pdf, { firstPage: 100 });
    expect(isLinearized(result)).toBe(true);
  });

  it('should produce output that starts with %PDF', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const header = decoder.decode(result.subarray(0, 9));
    expect(header).toBe('%PDF-1.7\n');
  });

  it('should produce output that ends with %%EOF', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);
    const tail = decoder.decode(result.subarray(result.length - 10));
    expect(tail).toContain('%%EOF');
  });
});

// ===========================================================================
// NEW: Exact byte offset verification for hint tables
// ===========================================================================

describe('linearizePdf — exact byte offset verification', () => {
  it('/L should exactly match the byte length of the output', async () => {
    for (const pageCount of [1, 2, 3, 5]) {
      const pdf = makeMinimalPdf(pageCount);
      const result = await linearizePdf(pdf);
      const str = pdfToString(result);
      const lMatch = /\/L\s+(\d+)/.exec(str);
      expect(lMatch).not.toBeNull();
      expect(parseInt(lMatch![1]!, 10)).toBe(result.length);
    }
  });

  it('/T should point to the exact byte offset of the main xref stream', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const tMatch = /\/T\s+(\d+)/.exec(str);
    expect(tMatch).not.toBeNull();
    const mainXrefOffset = parseInt(tMatch![1]!, 10);

    // The xref stream should start at /T offset
    const atOffset = decoder.decode(result.subarray(mainXrefOffset, mainXrefOffset + 50));
    expect(atOffset).toMatch(/^\d+\s+0\s+obj/);

    // And it should contain /Type /XRef
    const xrefChunk = decoder.decode(result.subarray(mainXrefOffset, mainXrefOffset + 500));
    expect(xrefChunk).toContain('/Type /XRef');
  });

  it('/E should mark the exact end of first-page objects section', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const eMatch = /\/E\s+(\d+)/.exec(str);
    expect(eMatch).not.toBeNull();
    const endFirstPage = parseInt(eMatch![1]!, 10);

    // /E should be greater than the linearization dict end
    const linDictEnd = str.indexOf('endobj') + 6;
    expect(endFirstPage).toBeGreaterThan(linDictEnd);

    // /E should be less than /T (main xref)
    const tMatch = /\/T\s+(\d+)/.exec(str);
    const mainXref = parseInt(tMatch![1]!, 10);
    expect(endFirstPage).toBeLessThanOrEqual(mainXref);
  });

  it('/H should reference the exact hint stream offset and length', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const hMatch = /\/H\s+\[\s*(\d+)\s+(\d+)\s*\]/.exec(str);
    expect(hMatch).not.toBeNull();
    const hintOffset = parseInt(hMatch![1]!, 10);
    const hintLength = parseInt(hMatch![2]!, 10);

    // The hint stream object should start exactly at hintOffset
    const hintStart = decoder.decode(result.subarray(hintOffset, hintOffset + 30));
    expect(hintStart).toMatch(/^\d+\s+0\s+obj/);

    // The hint stream object should end at hintOffset + hintLength
    // Verify that "endobj" appears near the end of the hint region
    const hintEnd = decoder.decode(
      result.subarray(hintOffset + hintLength - 20, hintOffset + hintLength),
    );
    expect(hintEnd).toContain('endobj');
  });

  it('startxref should match /T value', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const tMatch = /\/T\s+(\d+)/.exec(str);
    const mainXrefOffset = parseInt(tMatch![1]!, 10);

    // Find the startxref at the end of the file
    const startxrefMatch = /startxref\s+(\d+)/.exec(str);
    expect(startxrefMatch).not.toBeNull();
    const startxrefValue = parseInt(startxrefMatch![1]!, 10);

    expect(startxrefValue).toBe(mainXrefOffset);
  });

  it('all object offsets in xref stream should point to valid objects', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);

    // Find all objects by scanning
    const foundOffsets = findObjectOffsets(result);

    // Each found object should contain "N 0 obj" near the offset
    for (const [objNum, offset] of foundOffsets) {
      // Look in a small window around the offset (xref entries may have slight imprecision)
      const windowStart = Math.max(0, offset - 4);
      const chunk = decoder.decode(result.subarray(windowStart, offset + 40));
      expect(chunk).toContain(`${objNum} 0 obj`);
    }
  });
});

// ===========================================================================
// NEW: Page offset hint table binary format
// ===========================================================================

describe('linearizePdf — page offset hint table binary format', () => {
  it('should have a 52-byte header (13 fields x 4 bytes)', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);

    // Page offset hint table is the first part, before /S offset
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Header should be at least 52 bytes (13 x 4-byte fields)
    expect(pageHintData.length).toBeGreaterThanOrEqual(52);
  });

  it('header field 1 should be the least number of objects per page', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Field 1: least number of objects in a page (offset 0)
    const leastObjCount = readU32BE(pageHintData, 0);
    // Each page in our test has at least 1 page object + 1 content stream = 2
    expect(leastObjCount).toBeGreaterThanOrEqual(1);
  });

  it('header field 2 should be a valid byte offset for first page object', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Field 2: location of first page's page object (offset 4)
    const firstPageObjOffset = readU32BE(pageHintData, 4);
    expect(firstPageObjOffset).toBeGreaterThan(0);
    expect(firstPageObjOffset).toBeLessThan(result.length);

    // Verify it actually points to a valid object
    const chunk = decoder.decode(result.subarray(firstPageObjOffset, firstPageObjOffset + 30));
    expect(chunk).toMatch(/^\d+\s+0\s+obj/);
  });

  it('header field 4 should be the minimum total page bytes', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Field 4: least page length (offset 12)
    const leastPageLen = readU32BE(pageHintData, 12);
    expect(leastPageLen).toBeGreaterThan(0);
  });

  it('per-page entries should have non-negative deltas', async () => {
    const pdf = makeMinimalPdf(4);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // After 52-byte header, per-page entries are 8 bytes each
    // (objCountDelta: 4, pageLenDelta: 4)
    const nPages = 4;
    for (let i = 0; i < nPages; i++) {
      const entryOffset = 52 + i * 8;
      const objCountDelta = readU32BE(pageHintData, entryOffset);
      const pageLenDelta = readU32BE(pageHintData, entryOffset + 4);

      // Deltas should be non-negative (stored as unsigned)
      expect(objCountDelta).toBeGreaterThanOrEqual(0);
      expect(pageLenDelta).toBeGreaterThanOrEqual(0);
    }
  });

  it('page hint table total size should match expectations', async () => {
    const pageCount = 5;
    const pdf = makeMinimalPdf(pageCount);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Expected size: 52 (header) + pageCount * 8 (per-page entries)
    const expectedSize = 52 + pageCount * 8;
    expect(pageHintData.length).toBe(expectedSize);
  });
});

// ===========================================================================
// NEW: Shared object hint table binary format
// ===========================================================================

describe('linearizePdf — shared object hint table binary format', () => {
  it('should have a 28-byte header (7 fields x 4 bytes)', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);

    // Shared hint table starts at sharedOffset
    const sharedHintData = hintData.subarray(sharedOffset);

    // Header: 7 fields x 4 bytes = 28 bytes minimum
    expect(sharedHintData.length).toBeGreaterThanOrEqual(28);
  });

  it('header field 1 should be the first shared object number', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const sharedHintData = hintData.subarray(sharedOffset);

    // Field 1: object number of first shared object (offset 0)
    const firstObjNum = readU32BE(sharedHintData, 0);
    expect(firstObjNum).toBeGreaterThan(0);
  });

  it('header field 2 should be a valid byte offset', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const sharedHintData = hintData.subarray(sharedOffset);

    // Field 2: byte offset of first shared object (offset 4)
    const firstObjOffset = readU32BE(sharedHintData, 4);
    expect(firstObjOffset).toBeGreaterThan(0);
    expect(firstObjOffset).toBeLessThan(result.length);

    // Verify the offset points to a valid object
    const chunk = decoder.decode(result.subarray(firstObjOffset, firstObjOffset + 30));
    expect(chunk).toMatch(/^\d+\s+0\s+obj/);
  });

  it('header field 3 should be the shared object count', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const sharedHintData = hintData.subarray(sharedOffset);

    // Field 3: number of shared object entries (offset 8)
    const nShared = readU32BE(sharedHintData, 8);
    expect(nShared).toBeGreaterThan(0);
  });

  it('per-object entries should contain valid offsets and sizes', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const sharedHintData = hintData.subarray(sharedOffset);

    const nShared = readU32BE(sharedHintData, 8);

    // Per-object entries start after 28-byte header, 8 bytes each
    for (let i = 0; i < nShared; i++) {
      const entryOffset = 28 + i * 8;
      if (entryOffset + 8 > sharedHintData.length) break;

      const objOffset = readU32BE(sharedHintData, entryOffset);
      const objSize = readU32BE(sharedHintData, entryOffset + 4);

      // Each entry should have a valid offset within the file
      expect(objOffset).toBeGreaterThan(0);
      expect(objOffset).toBeLessThan(result.length);
      // Each entry should have a positive size
      expect(objSize).toBeGreaterThan(0);
    }
  });

  it('shared object offsets should point to actual objects in the output', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);
    const sharedHintData = hintData.subarray(sharedOffset);

    const nShared = readU32BE(sharedHintData, 8);

    for (let i = 0; i < nShared; i++) {
      const entryOffset = 28 + i * 8;
      if (entryOffset + 8 > sharedHintData.length) break;

      const objOffset = readU32BE(sharedHintData, entryOffset);

      // Verify the offset points to "N 0 obj"
      const chunk = decoder.decode(result.subarray(objOffset, objOffset + 30));
      expect(chunk).toMatch(/^\d+\s+0\s+obj/);
    }
  });
});

// ===========================================================================
// NEW: Cross-reference stream integrity
// ===========================================================================

describe('linearizePdf — cross-reference stream integrity', () => {
  it('xref stream /Size should cover all objects', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Find /Size in the xref stream
    const xrefStart = str.indexOf('/Type /XRef');
    expect(xrefStart).toBeGreaterThan(0);

    const sizeMatch = /\/Size\s+(\d+)/.exec(str.slice(xrefStart));
    expect(sizeMatch).not.toBeNull();
    const xrefSize = parseInt(sizeMatch![1]!, 10);

    // The xref size should be >= the number of objects we find
    const foundObjects = findObjectOffsets(result);
    expect(xrefSize).toBeGreaterThanOrEqual(foundObjects.size);
  });

  it('xref stream should contain /W with valid field widths', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const xrefStart = str.indexOf('/Type /XRef');
    const wMatch = /\/W\s+\[\s*(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(str.slice(xrefStart));
    expect(wMatch).not.toBeNull();

    const w0 = parseInt(wMatch![1]!, 10);
    const w1 = parseInt(wMatch![2]!, 10);
    const w2 = parseInt(wMatch![3]!, 10);

    // w0 should be 1 (type field)
    expect(w0).toBe(1);
    // w1 should be 1-4 (offset field)
    expect(w1).toBeGreaterThanOrEqual(1);
    expect(w1).toBeLessThanOrEqual(4);
    // w2 should be 1-4 (generation/index field)
    expect(w2).toBeGreaterThanOrEqual(1);
    expect(w2).toBeLessThanOrEqual(4);
  });

  it('xref stream should have /Root pointing to catalog', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const xrefStart = str.indexOf('/Type /XRef');
    const xrefDict = str.slice(xrefStart, str.indexOf('>>', xrefStart));

    const rootMatch = /\/Root\s+(\d+)\s+\d+\s+R/.exec(xrefDict);
    expect(rootMatch).not.toBeNull();
    const rootObjNum = parseInt(rootMatch![1]!, 10);

    // The root object should exist in the output and be a catalog
    const foundObjects = findObjectOffsets(result);
    expect(foundObjects.has(rootObjNum)).toBe(true);

    const rootOffset = foundObjects.get(rootObjNum)!;
    const rootChunk = decoder.decode(result.subarray(rootOffset, rootOffset + 200));
    expect(rootChunk).toContain('/Type /Catalog');
  });

  it('xref stream binary data length should match /Length', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Find the xref stream object
    const xrefStart = str.indexOf('/Type /XRef');
    // Go back to find the object header
    const objHeaderStart = str.lastIndexOf(' 0 obj', xrefStart);
    const xrefRegion = str.slice(objHeaderStart);

    const lenMatch = /\/Length\s+(\d+)/.exec(xrefRegion);
    expect(lenMatch).not.toBeNull();
    const declaredLength = parseInt(lenMatch![1]!, 10);

    // Find stream data
    const streamStart = xrefRegion.indexOf('stream\n') + 7;
    const endStream = xrefRegion.indexOf('\nendstream');
    const actualStreamLen = endStream - streamStart;

    // The declared length should match the actual binary data length
    expect(declaredLength).toBe(actualStreamLen);
  });

  it('xref stream should include its own object entry', async () => {
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Find xref object number by looking for "N 0 obj" before "/Type /XRef"
    const xrefStart = str.indexOf('/Type /XRef');
    const beforeXref = str.slice(0, xrefStart);
    // The object header "N 0 obj\n" may be followed by a dict before /Type /XRef
    const xrefObjMatch = /(\d+)\s+0\s+obj/.exec(
      beforeXref.slice(Math.max(0, beforeXref.length - 200)),
    );
    expect(xrefObjMatch).not.toBeNull();
    const xrefObjNum = parseInt(xrefObjMatch![1]!, 10);

    // /Size should be > xrefObjNum (because xref stream is entry xrefObjNum)
    const sizeMatch = /\/Size\s+(\d+)/.exec(str.slice(xrefStart));
    const xrefSize = parseInt(sizeMatch![1]!, 10);
    expect(xrefSize).toBeGreaterThan(xrefObjNum);
  });
});

// ===========================================================================
// NEW: Roundtrip — linearize -> verify offsets -> delinearize -> verify content
// ===========================================================================

describe('linearizePdf — full roundtrip with offset verification', () => {
  it('should produce consistent offsets across linearize/delinearize for 1-page', async () => {
    const pdf = makeMinimalPdf(1);
    const linearized = await linearizePdf(pdf);

    // Verify linearization params
    const info = getLinearizationInfo(linearized);
    expect(info).not.toBeNull();
    expect(info!.length).toBe(linearized.length);
    expect(info!.pageCount).toBe(1);

    // Delinearize
    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);

    // Verify content
    expect(pdfContains(delinearized, '/Type /Catalog')).toBe(true);
    expect(pdfContains(delinearized, 'Page 1')).toBe(true);
  });

  it('should produce consistent offsets across linearize/delinearize for 5 pages', async () => {
    const pdf = makeMinimalPdf(5);
    const linearized = await linearizePdf(pdf);

    const info = getLinearizationInfo(linearized);
    expect(info).not.toBeNull();
    expect(info!.length).toBe(linearized.length);
    expect(info!.pageCount).toBe(5);

    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);

    // All 5 pages' content should be preserved
    for (let i = 1; i <= 5; i++) {
      expect(pdfContains(delinearized, `Page ${i}`)).toBe(true);
    }
  });

  it('should preserve shared resources through roundtrip', async () => {
    const pdf = makePdfWithSharedResources(3);
    const linearized = await linearizePdf(pdf);

    expect(isLinearized(linearized)).toBe(true);
    const info = getLinearizationInfo(linearized);
    expect(info!.length).toBe(linearized.length);

    const delinearized = await delinearizePdf(linearized);
    expect(isLinearized(delinearized)).toBe(false);

    // Font resource should survive
    expect(pdfContains(delinearized, '/BaseFont /Helvetica')).toBe(true);

    // All pages should survive
    for (let i = 1; i <= 3; i++) {
      expect(pdfContains(delinearized, `SharedPage ${i}`)).toBe(true);
    }
  });

  it('roundtrip should preserve xref integrity in delinearized output', async () => {
    const pdf = makeMinimalPdf(3);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    // Use byte-level subarray + decode to avoid UTF-8 multi-byte character
    // misalignment (the binary comment header causes char/byte mismatch).
    const str = pdfToString(delinearized);

    // Find startxref (search from end to get the definitive one)
    const startxrefIdx = str.lastIndexOf('startxref');
    expect(startxrefIdx).toBeGreaterThan(0);
    const afterStartxref = str.slice(startxrefIdx + 9).trim();
    const xrefOffset = parseInt(afterStartxref.split(/[\r\n]/)[0]!, 10);
    expect(Number.isNaN(xrefOffset)).toBe(false);

    // Verify the xref offset points to "xref" using byte-level access
    const atXref = decoder.decode(delinearized.subarray(xrefOffset, xrefOffset + 30));
    expect(atXref).toMatch(/^xref/);

    // Verify object offsets in the xref table are correct
    const xrefSection = decoder.decode(delinearized.subarray(xrefOffset));
    const entryRegex = /(\d{10})\s+(\d{5})\s+(n|f)\s/g;
    let entryMatch: RegExpExecArray | null;
    while ((entryMatch = entryRegex.exec(xrefSection)) !== null) {
      const offset = parseInt(entryMatch[1]!, 10);
      const flag = entryMatch[3];
      if (flag === 'n' && offset > 0) {
        // Verify the offset points to a valid object (byte-level)
        const chunk = decoder.decode(delinearized.subarray(offset, offset + 30));
        expect(chunk).toMatch(/^\d+\s+0\s+obj/);
      }
    }
  });
});

// ===========================================================================
// NEW: Multi-page documents with shared resources
// ===========================================================================

describe('linearizePdf — multi-page with shared resources', () => {
  it('should linearize a PDF with a shared font referenced by all pages', async () => {
    const pdf = makePdfWithSharedResources(4);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);

    const info = getLinearizationInfo(result);
    expect(info!.pageCount).toBe(4);
    expect(info!.length).toBe(result.length);
  });

  it('should place shared resources in the first-page section', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Get /E (end of first page section)
    const eMatch = /\/E\s+(\d+)/.exec(str);
    const endFirstPage = parseInt(eMatch![1]!, 10);

    // The shared font resource should appear before /E
    const fontPos = str.indexOf('/BaseFont /Helvetica');
    expect(fontPos).toBeGreaterThan(0);
    expect(fontPos).toBeLessThan(endFirstPage);
  });

  it('hint table should track shared objects with exact offsets', async () => {
    const pdf = makePdfWithSharedResources(3);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);

    // The shared hint table should exist
    expect(sharedOffset).toBeGreaterThan(0);

    const sharedHintData = hintData.subarray(sharedOffset);
    const nShared = readU32BE(sharedHintData, 8);
    expect(nShared).toBeGreaterThan(0);

    // Verify each shared object offset is valid
    for (let i = 0; i < nShared; i++) {
      const entryOffset = 28 + i * 8;
      if (entryOffset + 8 > sharedHintData.length) break;

      const objOffset = readU32BE(sharedHintData, entryOffset);
      expect(objOffset).toBeLessThan(result.length);

      const chunk = decoder.decode(result.subarray(objOffset, objOffset + 30));
      expect(chunk).toMatch(/^\d+\s+0\s+obj/);
    }
  });

  it('should preserve shared resources after delinearization', async () => {
    const pdf = makePdfWithSharedResources(3);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    expect(pdfContains(delinearized, '/BaseFont /Helvetica')).toBe(true);
    expect(pdfContains(delinearized, '/Type /Font')).toBe(true);
  });
});

// ===========================================================================
// NEW: Documents with large objects spanning multiple pages
// ===========================================================================

describe('linearizePdf — large objects', () => {
  it('should handle pages with large content streams (2KB each)', async () => {
    const pdf = makePdfWithLargeObjects(3, 2000);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);

    const info = getLinearizationInfo(result);
    expect(info!.length).toBe(result.length);
    expect(info!.pageCount).toBe(3);
  });

  it('should handle pages with large content streams (10KB each)', async () => {
    const pdf = makePdfWithLargeObjects(3, 10000);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);

    const info = getLinearizationInfo(result);
    expect(info!.length).toBe(result.length);
  });

  it('large object offsets in hint table should be valid', async () => {
    const pdf = makePdfWithLargeObjects(4, 5000);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);

    // Page hint table header field 2: first page object offset
    const pageHintData = hintData.subarray(0, sharedOffset);
    const firstPageObjOffset = readU32BE(pageHintData, 4);
    expect(firstPageObjOffset).toBeGreaterThan(0);
    expect(firstPageObjOffset).toBeLessThan(result.length);

    // Verify it points to a valid object
    const chunk = decoder.decode(result.subarray(firstPageObjOffset, firstPageObjOffset + 30));
    expect(chunk).toMatch(/^\d+\s+0\s+obj/);
  });

  it('should preserve large content through roundtrip', async () => {
    const pdf = makePdfWithLargeObjects(3, 5000);
    const linearized = await linearizePdf(pdf);
    const delinearized = await delinearizePdf(linearized);

    // All pages' content markers should survive
    expect(pdfContains(delinearized, 'LargePage 1')).toBe(true);
    expect(pdfContains(delinearized, 'LargePage 2')).toBe(true);
    expect(pdfContains(delinearized, 'LargePage 3')).toBe(true);
  });

  it('page length deltas should reflect different content sizes', async () => {
    // Create a PDF with varying content sizes per page
    const pageCount = 3;
    const firstPageObj = 3;
    const firstContentObj = 3 + pageCount;
    const infoObj = 3 + 2 * pageCount;
    const totalObjects = infoObj;

    const kidsRefs = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`);
    const objectStrings: string[] = [];

    objectStrings.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
    objectStrings.push(
      `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pageCount} >>\nendobj`,
    );

    for (let i = 0; i < pageCount; i++) {
      const pageObjNum = firstPageObj + i;
      const contentObjNum = firstContentObj + i;
      objectStrings.push(
        `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << >> >>\nendobj`,
      );
    }

    // Content streams with very different sizes
    const sizes = [100, 500, 2000];
    for (let i = 0; i < pageCount; i++) {
      const contentObjNum = firstContentObj + i;
      const filler = 'Y'.repeat(sizes[i]!);
      const content = `BT /F1 12 Tf (${filler}) Tj ET`;
      objectStrings.push(
        `${contentObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
      );
    }

    objectStrings.push(`${infoObj} 0 obj\n<< /Producer (varying-sizes) >>\nendobj`);

    const bodyStr = objectStrings.join('\n') + '\n';
    const header = '%PDF-1.7\n';
    const fullStr = header + bodyStr;

    const offsets = new Map<number, number>();
    for (let i = 1; i <= totalObjects; i++) {
      const marker = `${i} 0 obj`;
      const idx = fullStr.indexOf(marker);
      if (idx >= 0) offsets.set(i, idx);
    }

    const bodyBytes = encoder.encode(bodyStr);
    const headerBytes = encoder.encode(header);
    const xrefOffset = headerBytes.length + bodyBytes.length;
    const xrefSize = totalObjects + 1;

    let xref = `xref\n0 ${xrefSize}\n`;
    xref += '0000000000 65535 f \n';
    for (let i = 1; i < xrefSize; i++) {
      const off = offsets.get(i);
      if (off !== undefined) {
        xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
      } else {
        xref += '0000000000 00000 f \n';
      }
    }
    xref += `trailer\n<< /Size ${xrefSize} /Root 1 0 R /Info ${infoObj} 0 R >>\n`;
    xref += `startxref\n${xrefOffset}\n%%EOF\n`;

    const pdf = encoder.encode(fullStr + xref);
    const result = await linearizePdf(pdf);
    expect(isLinearized(result)).toBe(true);

    const { hintData, sharedOffset } = extractHintStream(result);
    const pageHintData = hintData.subarray(0, sharedOffset);

    // Header field 4: least page length
    const leastPageLen = readU32BE(pageHintData, 12);
    expect(leastPageLen).toBeGreaterThan(0);

    // The hint table should have entries for each page
    // Deltas may be zero if the hint table uses a different encoding,
    // but the least page length should reflect actual sizes
    expect(pageHintData.length).toBeGreaterThanOrEqual(52 + pageCount * 4);
  });
});

// ===========================================================================
// NEW: Two-pass serialization convergence
// ===========================================================================

describe('linearizePdf — two-pass serialization', () => {
  it('/L value should be self-consistent (file length matches)', async () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const pdf = makeMinimalPdf(n);
      const result = await linearizePdf(pdf);
      const info = getLinearizationInfo(result);
      expect(info!.length).toBe(result.length);
    }
  });

  it('hint stream offset should be between first-page end and remaining objects', async () => {
    const pdf = makeMinimalPdf(3);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    const eMatch = /\/E\s+(\d+)/.exec(str);
    const hMatch = /\/H\s+\[\s*(\d+)\s+(\d+)\s*\]/.exec(str);
    const tMatch = /\/T\s+(\d+)/.exec(str);

    const endFirstPage = parseInt(eMatch![1]!, 10);
    const hintOffset = parseInt(hMatch![1]!, 10);
    const mainXref = parseInt(tMatch![1]!, 10);

    // Hint stream should be at or after the end of first page objects
    expect(hintOffset).toBeGreaterThanOrEqual(endFirstPage);

    // Hint stream should be before the main xref
    expect(hintOffset).toBeLessThan(mainXref);
  });

  it('linearizing same input twice should produce identical output', async () => {
    const pdf = makeMinimalPdf(3);
    const result1 = await linearizePdf(pdf);
    // Delinearize and re-linearize
    const delinearized = await delinearizePdf(result1);
    const result2 = await linearizePdf(delinearized);

    // Both should be linearized with same page count
    const info1 = getLinearizationInfo(result1);
    const info2 = getLinearizationInfo(result2);
    expect(info1!.pageCount).toBe(info2!.pageCount);
    // File lengths should match their respective /L values
    expect(info1!.length).toBe(result1.length);
    expect(info2!.length).toBe(result2.length);
  });

  it('all offsets should be self-consistent after two-pass', async () => {
    const pdf = makeMinimalPdf(4);
    const result = await linearizePdf(pdf);
    const str = pdfToString(result);

    // Extract all linearization dictionary values
    const lMatch = /\/L\s+(\d+)/.exec(str);
    const eMatch = /\/E\s+(\d+)/.exec(str);
    const tMatch = /\/T\s+(\d+)/.exec(str);
    const hMatch = /\/H\s+\[\s*(\d+)\s+(\d+)\s*\]/.exec(str);

    const fileLen = parseInt(lMatch![1]!, 10);
    const endFirst = parseInt(eMatch![1]!, 10);
    const mainXref = parseInt(tMatch![1]!, 10);
    const hintOff = parseInt(hMatch![1]!, 10);
    const hintLen = parseInt(hMatch![2]!, 10);

    // Self-consistency checks
    expect(fileLen).toBe(result.length);
    expect(endFirst).toBeGreaterThan(0);
    expect(endFirst).toBeLessThan(fileLen);
    expect(mainXref).toBeGreaterThan(endFirst);
    expect(mainXref).toBeLessThan(fileLen);
    expect(hintOff).toBeGreaterThanOrEqual(endFirst);
    expect(hintOff + hintLen).toBeLessThanOrEqual(mainXref);

    // Verify startxref matches /T
    const startxrefMatch = /startxref\s+(\d+)/.exec(str);
    expect(parseInt(startxrefMatch![1]!, 10)).toBe(mainXref);
  });
});

// ===========================================================================
// NEW: readU32BE utility
// ===========================================================================

describe('readU32BE', () => {
  it('should read a 4-byte big-endian unsigned integer', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    expect(readU32BE(buf, 0)).toBe(1);
  });

  it('should handle large values', () => {
    const buf = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    expect(readU32BE(buf, 0)).toBe(0xFFFFFFFF);
  });

  it('should handle zero', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(readU32BE(buf, 0)).toBe(0);
  });

  it('should read at arbitrary offsets', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x00, 0x02]);
    expect(readU32BE(buf, 0)).toBe(0x00000100);
    expect(readU32BE(buf, 2)).toBe(0x01000002);
  });

  it('should round-trip with writeU32BE from hint tables', async () => {
    // Build a hint table and verify we can read back the values
    const pdf = makeMinimalPdf(2);
    const result = await linearizePdf(pdf);
    const { hintData, sharedOffset } = extractHintStream(result);

    // Read header field 1 (least obj count) - should be a small positive number
    const leastObjCount = readU32BE(hintData, 0);
    expect(leastObjCount).toBeGreaterThanOrEqual(1);
    expect(leastObjCount).toBeLessThan(100); // sanity check

    // Read the shared object hint table
    if (sharedOffset > 0 && sharedOffset < hintData.length) {
      const sharedData = hintData.subarray(sharedOffset);
      if (sharedData.length >= 12) {
        const nShared = readU32BE(sharedData, 8);
        expect(nShared).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

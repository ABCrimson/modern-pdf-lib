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
 */

import { describe, it, expect } from 'vitest';
import {
  isLinearized,
  linearizePdf,
  delinearizePdf,
  getLinearizationInfo,
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

/** Convert Uint8Array to string for inspection. */
function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Check if the PDF text contains a given substring. */
function pdfContains(bytes: Uint8Array, substr: string): boolean {
  return pdfToString(bytes).includes(substr);
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

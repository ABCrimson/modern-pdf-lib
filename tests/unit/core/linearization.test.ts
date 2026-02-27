/**
 * Tests for PDF linearization detection and basic validation.
 *
 * Covers:
 * - Detection of linearized PDFs
 * - Detection of non-linearized PDFs
 * - Basic linearization of a simple PDF
 * - Error handling for invalid input
 */

import { describe, it, expect } from 'vitest';
import { isLinearized, linearizePdf } from '../../../src/core/linearization.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function makeMinimalPdf(): Uint8Array {
  // Build a minimal valid PDF for testing
  const lines = [
    '%PDF-1.7',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>',
    'endobj',
    '4 0 obj',
    '<< /Length 0 >>',
    'stream',
    '',
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Producer (test) >>',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
  ];

  // Calculate offsets for xref
  const fullText = lines.join('\n') + '\n';
  const bytes = encoder.encode(fullText);
  const text = new TextDecoder().decode(bytes);

  // Find object offsets
  const offsets: number[] = [0]; // obj 0 is free
  for (let i = 1; i <= 5; i++) {
    const marker = `${i} 0 obj`;
    const idx = text.indexOf(marker);
    offsets.push(idx);
  }

  const xrefLines: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (i === 0) {
      xrefLines.push('0000000000 65535 f ');
    } else {
      xrefLines.push(`${offsets[i]!.toString().padStart(10, '0')} 00000 n `);
    }
  }

  const finalPdf = [
    '%PDF-1.7',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>',
    'endobj',
    '4 0 obj',
    '<< /Length 0 >>',
    'stream',
    '',
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Producer (test) >>',
    'endobj',
  ].join('\n') + '\n';

  const xrefOffset = finalPdf.length;
  const xrefStr = `xref\n0 6\n${xrefLines.join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(finalPdf + xrefStr);
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
});

// ---------------------------------------------------------------------------
// linearizePdf
// ---------------------------------------------------------------------------

describe('linearizePdf', () => {
  it('should return already-linearized PDFs as-is', async () => {
    const data = encoder.encode(
      '%PDF-1.7\n1 0 obj\n<< /Linearized 1.0 /L 100 >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n100\n%%EOF\n',
    );
    const result = await linearizePdf(data);
    expect(result).toBe(data); // Same reference
  });

  it('should linearize a simple PDF', async () => {
    const pdf = makeMinimalPdf();
    const result = await linearizePdf(pdf);

    // Result should be larger (has linearization dict + hint stream)
    expect(result.length).toBeGreaterThan(0);

    // Result should be marked as linearized
    expect(isLinearized(result)).toBe(true);
  });

  it('should throw for data without startxref', async () => {
    const badPdf = encoder.encode('%PDF-1.7\ngarbage\n');
    await expect(linearizePdf(badPdf)).rejects.toThrow('no startxref');
  });

  it('should create a PDF from the library and linearize it', async () => {
    const doc = createPdf();
    doc.addPage();
    const bytes = await doc.save();

    const result = await linearizePdf(bytes);
    expect(result.length).toBeGreaterThan(0);
    expect(isLinearized(result)).toBe(true);
  });
});

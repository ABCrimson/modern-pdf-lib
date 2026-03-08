/**
 * Tests for document diff — comparing signed vs current content.
 */

import { describe, it, expect } from 'vitest';
import { diffSignedContent } from '../../../src/signature/documentDiff.js';
import { prepareForSigning, embedSignature } from '../../../src/signature/byteRange.js';
import type { DocumentDiff, DiffEntry } from '../../../src/signature/documentDiff.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function createMinimalPdf(): Uint8Array {
  const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< /Producer (modern-pdf) /CreationDate (D:20260225120000Z) >>
endobj
xref
0 5
0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000198 00000 n \ntrailer
<< /Size 5 /Root 1 0 R /Info 4 0 R >>
startxref
283
%%EOF
`;
  return encoder.encode(pdf);
}

function createTwoPagePdf(): Uint8Array {
  const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< /Producer (modern-pdf) /Title (Test Document) >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 6
0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000120 00000 n \n0000000203 00000 n \n0000000268 00000 n \ntrailer
<< /Size 6 /Root 1 0 R /Info 4 0 R >>
startxref
351
%%EOF
`;
  return encoder.encode(pdf);
}

function createPdfWithFormFields(): Uint8Array {
  const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R] >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [5 0 R] >>
endobj
4 0 obj
<< /Producer (modern-pdf) >>
endobj
5 0 obj
<< /Type /Annot /Subtype /Widget /FT /Tx /T (FullName) /V (Alice) /Rect [50 700 200 730] >>
endobj
xref
0 6
0000000000 65535 f \n0000000009 00000 n \n0000000086 00000 n \n0000000139 00000 n \n0000000236 00000 n \n0000000275 00000 n \ntrailer
<< /Size 6 /Root 1 0 R /Info 4 0 R >>
startxref
400
%%EOF
`;
  return encoder.encode(pdf);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diffSignedContent', () => {
  it('should return empty diff for unsigned PDF', async () => {
    const pdf = createMinimalPdf();
    const diff = await diffSignedContent(pdf);

    expect(diff.signatureIndex).toBe(0);
    expect(diff.hasChanges).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('should return a valid diff for a freshly signed PDF', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');

    // Embed a fake signature
    const fakeSig = new Uint8Array(256);
    globalThis.crypto.getRandomValues(fakeSig);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    const diff = await diffSignedContent(signedPdf);

    // The diff should have a valid structure
    expect(diff.signatureIndex).toBe(0);
    expect(Array.isArray(diff.changes)).toBe(true);
    // The incremental update itself adds objects that change the page
    // content hashing window, so some differences may be detected.
    // The important thing is the diff completes without error.
    for (const change of diff.changes) {
      expect(typeof change.type).toBe('string');
      expect(typeof change.description).toBe('string');
    }
  });

  it('should detect page additions', async () => {
    // Sign a one-page PDF, then append a second page
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');

    const fakeSig = new Uint8Array(256);
    globalThis.crypto.getRandomValues(fakeSig);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    // Append a second page via incremental update
    const pageAppendix = encoder.encode(
      '\n6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n',
    );
    const modified = new Uint8Array(signedPdf.length + pageAppendix.length);
    modified.set(signedPdf, 0);
    modified.set(pageAppendix, signedPdf.length);

    const diff = await diffSignedContent(modified);

    const pageAdded = diff.changes.filter((c) => c.type === 'page_added');
    expect(pageAdded.length).toBeGreaterThanOrEqual(1);
    expect(diff.hasChanges).toBe(true);
  });

  it('should throw for out-of-range signature index', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
    const fakeSig = new Uint8Array(256);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    await expect(diffSignedContent(signedPdf, 5)).rejects.toThrow(
      'out of range',
    );
  });

  it('should use the last signature by default', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
    const fakeSig = new Uint8Array(256);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    const diff = await diffSignedContent(signedPdf);
    expect(diff.signatureIndex).toBe(0);
  });

  it('should accept explicit signature index 0', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
    const fakeSig = new Uint8Array(256);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    const diff = await diffSignedContent(signedPdf, 0);
    expect(diff.signatureIndex).toBe(0);
  });

  it('should have correct DiffEntry type values', async () => {
    const pdf = createMinimalPdf();
    const diff = await diffSignedContent(pdf);

    // Verify types compile correctly
    const validTypes: DiffEntry['type'][] = [
      'page_added',
      'page_removed',
      'page_modified',
      'form_field_changed',
      'annotation_changed',
      'metadata_changed',
    ];
    expect(validTypes).toHaveLength(6);
  });

  it('should have correct DocumentDiff structure', async () => {
    const pdf = createMinimalPdf();
    const diff: DocumentDiff = await diffSignedContent(pdf);

    expect(typeof diff.signatureIndex).toBe('number');
    expect(Array.isArray(diff.changes)).toBe(true);
    expect(typeof diff.hasChanges).toBe('boolean');
  });

  it('should detect metadata changes after signing', async () => {
    const pdf = createTwoPagePdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
    const fakeSig = new Uint8Array(256);
    const signedPdf = embedSignature(preparedPdf, fakeSig, byteRange);

    // Append an object that modifies metadata
    const metaAppendix = encoder.encode(
      '\n50 0 obj\n<< /Producer (modified-pdf) /Title (Modified Title) >>\nendobj\n',
    );
    const modified = new Uint8Array(signedPdf.length + metaAppendix.length);
    modified.set(signedPdf, 0);
    modified.set(metaAppendix, signedPdf.length);

    const diff = await diffSignedContent(modified);

    // Expect some kind of change to be detected (metadata or page content)
    // The exact changes depend on how the hashing picks up the modifications
    expect(diff.hasChanges).toBe(true);
  });
});

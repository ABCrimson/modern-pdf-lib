/**
 * Tests for incremental save with signature preservation.
 */

import { describe, it, expect } from 'vitest';
import {
  findExistingSignatures,
  validateByteRangeIntegrity,
  parseExistingTrailer,
  appendIncrementalUpdate,
  saveIncrementalWithSignaturePreservation,
} from '../../../src/signature/incrementalSave.js';
import { prepareForSigning } from '../../../src/signature/byteRange.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder('latin1');

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

// ---------------------------------------------------------------------------
// Tests: findExistingSignatures
// ---------------------------------------------------------------------------

describe('findExistingSignatures', () => {
  it('should find no signatures in an unsigned PDF', () => {
    const pdf = createMinimalPdf();
    const sigs = findExistingSignatures(pdf);
    expect(sigs).toHaveLength(0);
  });

  it('should find a signature in a prepared PDF', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Signature1');
    const sigs = findExistingSignatures(preparedPdf);
    expect(sigs.length).toBeGreaterThanOrEqual(1);

    const sig = sigs[0]!;
    expect(sig.byteRange).toHaveLength(4);
    expect(sig.contentsOffset).toBeGreaterThan(0);
    expect(sig.contentsLength).toBeGreaterThan(0);
  });

  it('should find multiple signatures in a multi-signed PDF', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf: pdf1 } = prepareForSigning(pdf, 'Sig1');
    const { preparedPdf: pdf2 } = prepareForSigning(pdf1, 'Sig2');

    const sigs = findExistingSignatures(pdf2);
    expect(sigs.length).toBe(2);
  });

  it('should return correct contentsOffset and contentsLength', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');

    const sigs = findExistingSignatures(preparedPdf);
    expect(sigs.length).toBeGreaterThanOrEqual(1);

    const sig = sigs[0]!;
    expect(sig.contentsOffset).toBe(byteRange.contentsOffset);
    expect(sig.contentsLength).toBe(byteRange.contentsLength);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateByteRangeIntegrity
// ---------------------------------------------------------------------------

describe('validateByteRangeIntegrity', () => {
  it('should validate a correctly prepared signature', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    const sigs = findExistingSignatures(preparedPdf);
    const valid = validateByteRangeIntegrity(preparedPdf, sigs);
    expect(valid).toBe(true);
  });

  it('should return true for empty signatures array', () => {
    const pdf = createMinimalPdf();
    const valid = validateByteRangeIntegrity(pdf, []);
    expect(valid).toBe(true);
  });

  it('should reject byte ranges that extend beyond PDF length', () => {
    const pdf = createMinimalPdf();
    const valid = validateByteRangeIntegrity(pdf, [
      {
        byteRange: [0, 100, 200, pdf.length + 1000],
        contentsOffset: 100,
        contentsLength: 100,
      },
    ]);
    expect(valid).toBe(false);
  });

  it('should reject negative byte ranges', () => {
    const pdf = createMinimalPdf();
    const valid = validateByteRangeIntegrity(pdf, [
      {
        byteRange: [-1, 100, 200, 50],
        contentsOffset: 99,
        contentsLength: 101,
      },
    ]);
    expect(valid).toBe(false);
  });

  it('should reject overlapping gaps in two signatures', () => {
    const pdf = createMinimalPdf();
    // Two signatures with overlapping /Contents regions
    const valid = validateByteRangeIntegrity(pdf, [
      {
        byteRange: [0, 50, 100, 50],
        contentsOffset: 50,
        contentsLength: 50,
      },
      {
        byteRange: [0, 70, 120, 30],
        contentsOffset: 70,
        contentsLength: 50,
      },
    ]);
    expect(valid).toBe(false);
  });

  it('should reject mismatched contentsOffset and byteRange gap', () => {
    const pdf = createMinimalPdf();
    const valid = validateByteRangeIntegrity(pdf, [
      {
        byteRange: [0, 50, 100, 50],
        contentsOffset: 60, // Wrong — gap starts at 50
        contentsLength: 50,
      },
    ]);
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseExistingTrailer
// ---------------------------------------------------------------------------

describe('parseExistingTrailer', () => {
  it('should parse trailer from a minimal PDF', () => {
    const pdf = createMinimalPdf();
    const trailer = parseExistingTrailer(pdf);

    expect(trailer.size).toBe(5);
    expect(trailer.rootRef).toBe('1 0 R');
    expect(trailer.infoRef).toBe('4 0 R');
    expect(trailer.prevXrefOffset).toBe(283);
  });

  it('should parse trailer from a prepared PDF (with /Prev)', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');
    const trailer = parseExistingTrailer(preparedPdf);

    expect(trailer.size).toBeGreaterThan(5);
    expect(trailer.rootRef).toBe('1 0 R');
    expect(trailer.prevXrefOffset).toBeGreaterThan(0);
  });

  it('should throw for invalid PDF without startxref', () => {
    const badPdf = encoder.encode('%PDF-1.7\nsome garbage\n');
    expect(() => parseExistingTrailer(badPdf)).toThrow('startxref');
  });

  it('should throw for PDF without /Size', () => {
    const badPdf = encoder.encode(
      '%PDF-1.7\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n',
    );
    expect(() => parseExistingTrailer(badPdf)).toThrow('/Size');
  });

  it('should throw for PDF without /Root', () => {
    const badPdf = encoder.encode(
      '%PDF-1.7\ntrailer\n<< /Size 5 >>\nstartxref\n0\n%%EOF\n',
    );
    expect(() => parseExistingTrailer(badPdf)).toThrow('/Root');
  });
});

// ---------------------------------------------------------------------------
// Tests: appendIncrementalUpdate
// ---------------------------------------------------------------------------

describe('appendIncrementalUpdate', () => {
  it('should return original PDF when no objects provided', () => {
    const pdf = createMinimalPdf();
    const result = appendIncrementalUpdate(pdf, []);
    expect(result).toBe(pdf);
  });

  it('should append a new object with xref and trailer', () => {
    const pdf = createMinimalPdf();
    const newObj = {
      objectNumber: 5,
      generationNumber: 0,
      data: encoder.encode('<< /Type /SomeNewObj >>'),
    };
    const result = appendIncrementalUpdate(pdf, [newObj]);

    expect(result.length).toBeGreaterThan(pdf.length);

    const text = decoder.decode(result);
    // Original bytes should be preserved
    expect(text.slice(0, pdf.length)).toBe(decoder.decode(pdf));

    // Should contain the new object
    expect(text).toContain('5 0 obj');
    expect(text).toContain('/Type /SomeNewObj');

    // Should have new xref and trailer
    expect(text).toContain('/Prev ');
    // Should have two %%EOF markers
    const eofCount = text.split('%%EOF').length - 1;
    expect(eofCount).toBe(2);
  });

  it('should preserve original bytes exactly', () => {
    const pdf = createMinimalPdf();
    const newObj = {
      objectNumber: 5,
      generationNumber: 0,
      data: encoder.encode('<< /Key /Value >>'),
    };
    const result = appendIncrementalUpdate(pdf, [newObj]);

    // First N bytes should be identical
    for (let i = 0; i < pdf.length; i++) {
      expect(result[i]).toBe(pdf[i]);
    }
  });

  it('should append multiple objects', () => {
    const pdf = createMinimalPdf();
    const objects = [
      {
        objectNumber: 5,
        generationNumber: 0,
        data: encoder.encode('<< /Type /ObjA >>'),
      },
      {
        objectNumber: 6,
        generationNumber: 0,
        data: encoder.encode('<< /Type /ObjB >>'),
      },
    ];
    const result = appendIncrementalUpdate(pdf, objects);

    const text = decoder.decode(result);
    expect(text).toContain('5 0 obj');
    expect(text).toContain('6 0 obj');
    expect(text).toContain('/Size 7');
  });

  it('should update /Size correctly for non-sequential objects', () => {
    const pdf = createMinimalPdf();
    const newObj = {
      objectNumber: 10,
      generationNumber: 0,
      data: encoder.encode('<< /Type /Far >>'),
    };
    const result = appendIncrementalUpdate(pdf, [newObj]);

    const text = decoder.decode(result);
    expect(text).toContain('/Size 11');
  });

  it('should include /Prev pointing to original xref', () => {
    const pdf = createMinimalPdf();
    const newObj = {
      objectNumber: 5,
      generationNumber: 0,
      data: encoder.encode('<< /Test true >>'),
    };
    const result = appendIncrementalUpdate(pdf, [newObj]);

    const text = decoder.decode(result);
    expect(text).toContain('/Prev 283');
  });

  it('should handle /Info reference in trailer', () => {
    const pdf = createMinimalPdf();
    const newObj = {
      objectNumber: 5,
      generationNumber: 0,
      data: encoder.encode('<< /Test true >>'),
    };
    const result = appendIncrementalUpdate(pdf, [newObj]);

    const text = decoder.decode(result);
    expect(text).toContain('/Info 4 0 R');
  });
});

// ---------------------------------------------------------------------------
// Tests: saveIncrementalWithSignaturePreservation
// ---------------------------------------------------------------------------

describe('saveIncrementalWithSignaturePreservation', () => {
  it('should return original when no changes detected', () => {
    const pdf = createMinimalPdf();
    const result = saveIncrementalWithSignaturePreservation(pdf, pdf);
    expect(result).toBe(pdf);
  });

  it('should detect and append changed objects', () => {
    const pdf = createMinimalPdf();
    // Create a modified version by adding an object
    const modifiedPdfStr = decoder.decode(pdf).replace(
      '4 0 obj',
      '4 0 obj\n% modified\n',
    );
    const modifiedPdf = encoder.encode(modifiedPdfStr);

    // Need a valid xref — just use a different /Producer value
    const modifiedText = decoder.decode(pdf).replace(
      '/Producer (modern-pdf)',
      '/Producer (modified-pdf)',
    );
    const modifiedPdf2 = encoder.encode(modifiedText);

    const result = saveIncrementalWithSignaturePreservation(pdf, modifiedPdf2);

    // Should be larger than original (appended data)
    expect(result.length).toBeGreaterThan(pdf.length);

    // Original bytes should be preserved
    for (let i = 0; i < pdf.length; i++) {
      expect(result[i]).toBe(pdf[i]);
    }
  });

  it('should preserve existing signatures during incremental save', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    // Find existing signatures
    const sigsBefore = findExistingSignatures(preparedPdf);
    expect(sigsBefore.length).toBeGreaterThanOrEqual(1);

    // Create a modification
    const modifiedText = decoder.decode(preparedPdf).replace(
      '/Producer (modern-pdf)',
      '/Producer (modified-pdf)',
    );
    const modifiedPdf = encoder.encode(modifiedText);

    const result = saveIncrementalWithSignaturePreservation(
      preparedPdf,
      modifiedPdf,
      { preserveSignatures: true },
    );

    // Existing signature bytes should still be preserved
    for (let i = 0; i < preparedPdf.length; i++) {
      expect(result[i]).toBe(preparedPdf[i]);
    }
  });

  it('should respect preserveSignatures: false', () => {
    const pdf = createMinimalPdf();
    const modifiedText = decoder.decode(pdf).replace(
      '/Producer (modern-pdf)',
      '/Producer (modified-pdf)',
    );
    const modifiedPdf = encoder.encode(modifiedText);

    // Should still work without signature preservation
    const result = saveIncrementalWithSignaturePreservation(
      pdf,
      modifiedPdf,
      { preserveSignatures: false },
    );

    expect(result.length).toBeGreaterThan(pdf.length);
  });
});

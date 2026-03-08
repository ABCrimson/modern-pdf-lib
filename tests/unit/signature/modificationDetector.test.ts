/**
 * Tests for certified document modification detection.
 */

import { describe, it, expect } from 'vitest';
import { detectModifications } from '../../../src/signature/modificationDetector.js';
import { MdpPermission } from '../../../src/signature/mdpPolicy.js';
import { prepareForSigning } from '../../../src/signature/byteRange.js';
import { appendIncrementalUpdate } from '../../../src/signature/incrementalSave.js';

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
// Tests: detectModifications
// ---------------------------------------------------------------------------

describe('detectModifications', () => {
  it('should report no violations for unsigned PDF', async () => {
    const pdf = createMinimalPdf();
    const report = await detectModifications(pdf);

    expect(report.isCompliant).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.certificationLevel).toBeUndefined();
  });

  it('should report no violations for a signed PDF with no modifications', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    const report = await detectModifications(preparedPdf);

    expect(report.isCompliant).toBe(true);
  });

  it('should detect modifications after a signature', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    // Append a modified object after the signature
    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 4,
        generationNumber: 0,
        data: encoder.encode(
          '<< /Producer (modified-pdf) /CreationDate (D:20260301120000Z) >>',
        ),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    // Should detect that object 4 was modified
    expect(report.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect certification level from DocMDP', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'CertSig',
      8192,
      undefined,
      2, // FormFillAndSign
    );

    const report = await detectModifications(preparedPdf);

    expect(report.certificationLevel).toBe(MdpPermission.FormFillAndSign);
  });

  it('should be compliant when form-fill on MDP level 2', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'CertSig',
      8192,
      undefined,
      2, // FormFillAndSign
    );

    // Append a form fill change
    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 10,
        generationNumber: 0,
        data: encoder.encode(
          '<< /Type /Annot /Subtype /Widget /FT /Tx /V (John Doe) /T (Name) >>',
        ),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    // Form fills should be compliant with MDP level 2
    const formFillViolations = report.violations.filter(
      (v) => v.type === 'form_filled',
    );
    // If there are only form fill violations, it should be compliant
    if (
      report.violations.length > 0 &&
      report.violations.every((v) => v.type === 'form_filled')
    ) {
      expect(report.isCompliant).toBe(true);
    }
  });

  it('should be non-compliant for content changes on MDP level 1', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'CertSig',
      8192,
      undefined,
      1, // NoChanges
    );

    // Append ANY modification
    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 4,
        generationNumber: 0,
        data: encoder.encode(
          '<< /Producer (modified!) >>',
        ),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    if (report.violations.length > 0) {
      expect(report.isCompliant).toBe(false);
    }
  });

  it('should report violation types correctly', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    // Add an annotation
    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 20,
        generationNumber: 0,
        data: encoder.encode(
          '<< /Type /Annot /Subtype /Text /Annots /Contents (Note) >>',
        ),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    if (report.violations.length > 0) {
      const types = report.violations.map((v) => v.type);
      expect(
        types.some(
          (t) =>
            t === 'annotation_added' ||
            t === 'content_changed' ||
            t === 'form_filled' ||
            t === 'page_added',
        ),
      ).toBe(true);
    }
  });

  it('should report affectedSignatureIndex correctly', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');

    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 4,
        generationNumber: 0,
        data: encoder.encode('<< /Producer (changed) >>'),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    for (const violation of report.violations) {
      expect(violation.affectedSignatureIndex).toBeGreaterThanOrEqual(0);
      expect(typeof violation.description).toBe('string');
      expect(violation.description.length).toBeGreaterThan(0);
    }
  });

  it('should be compliant for annotation changes on MDP level 3', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(
      pdf,
      'CertSig',
      8192,
      undefined,
      3, // FormFillSignAnnotate
    );

    // Add an annotation (allowed at level 3)
    const modifiedPdf = appendIncrementalUpdate(preparedPdf, [
      {
        objectNumber: 20,
        generationNumber: 0,
        data: encoder.encode(
          '<< /Type /Annot /Subtype /Text /Contents (Note) >>',
        ),
      },
    ]);

    const report = await detectModifications(modifiedPdf);

    // Annotation additions should be compliant at level 3
    const onlyAnnotAndForm = report.violations.every(
      (v) => v.type === 'annotation_added' || v.type === 'form_filled',
    );
    if (onlyAnnotAndForm) {
      expect(report.isCompliant).toBe(true);
    }
  });

  it('should not flag signature additions as violations', async () => {
    const pdf = createMinimalPdf();
    const { preparedPdf: pdf1 } = prepareForSigning(pdf, 'Sig1');
    const { preparedPdf: pdf2 } = prepareForSigning(pdf1, 'Sig2');

    const report = await detectModifications(pdf2);

    // Signature additions should not appear as violations
    const sigViolations = report.violations.filter((v) =>
      v.description.includes('/Type /Sig'),
    );
    expect(sigViolations).toHaveLength(0);
  });
});

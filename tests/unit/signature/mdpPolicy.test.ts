/**
 * Tests for MDP (DocMDP) certification policy support.
 */

import { describe, it, expect } from 'vitest';
import {
  MdpPermission,
  setCertificationLevel,
  getCertificationLevel,
  buildDocMdpReference,
} from '../../../src/signature/mdpPolicy.js';
import { prepareForSigning } from '../../../src/signature/byteRange.js';
import type { SignOptions } from '../../../src/signature/signatureHandler.js';

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

function createMockSignOptions(): SignOptions {
  return {
    certificate: new Uint8Array([0x30, 0x82, 0x01, 0x00]),
    privateKey: new Uint8Array([0x30, 0x82, 0x01, 0x00]),
  };
}

// ---------------------------------------------------------------------------
// Tests: MdpPermission enum
// ---------------------------------------------------------------------------

describe('MdpPermission', () => {
  it('should have NoChanges = 1', () => {
    expect(MdpPermission.NoChanges).toBe(1);
  });

  it('should have FormFillAndSign = 2', () => {
    expect(MdpPermission.FormFillAndSign).toBe(2);
  });

  it('should have FormFillSignAnnotate = 3', () => {
    expect(MdpPermission.FormFillSignAnnotate).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: setCertificationLevel
// ---------------------------------------------------------------------------

describe('setCertificationLevel', () => {
  it('should set MDP permission on sign options', () => {
    const options = createMockSignOptions();
    setCertificationLevel(options, MdpPermission.NoChanges);

    const extended = options as SignOptions & { mdpPermission: MdpPermission };
    expect(extended.mdpPermission).toBe(MdpPermission.NoChanges);
  });

  it('should set FormFillAndSign level', () => {
    const options = createMockSignOptions();
    setCertificationLevel(options, MdpPermission.FormFillAndSign);

    const extended = options as SignOptions & { mdpPermission: MdpPermission };
    expect(extended.mdpPermission).toBe(2);
  });

  it('should set FormFillSignAnnotate level', () => {
    const options = createMockSignOptions();
    setCertificationLevel(options, MdpPermission.FormFillSignAnnotate);

    const extended = options as SignOptions & { mdpPermission: MdpPermission };
    expect(extended.mdpPermission).toBe(3);
  });

  it('should overwrite previous MDP setting', () => {
    const options = createMockSignOptions();
    setCertificationLevel(options, MdpPermission.NoChanges);
    setCertificationLevel(options, MdpPermission.FormFillSignAnnotate);

    const extended = options as SignOptions & { mdpPermission: MdpPermission };
    expect(extended.mdpPermission).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: getCertificationLevel
// ---------------------------------------------------------------------------

describe('getCertificationLevel', () => {
  it('should return undefined for unsigned PDF', () => {
    const pdf = createMinimalPdf();
    const level = getCertificationLevel(pdf);
    expect(level).toBeUndefined();
  });

  it('should return undefined for signed PDF without DocMDP', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1');
    const level = getCertificationLevel(preparedPdf);
    expect(level).toBeUndefined();
  });

  it('should detect DocMDP with P=1 (NoChanges)', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1', 8192, undefined, 1);
    const level = getCertificationLevel(preparedPdf);
    expect(level).toBe(MdpPermission.NoChanges);
  });

  it('should detect DocMDP with P=2 (FormFillAndSign)', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1', 8192, undefined, 2);
    const level = getCertificationLevel(preparedPdf);
    expect(level).toBe(MdpPermission.FormFillAndSign);
  });

  it('should detect DocMDP with P=3 (FormFillSignAnnotate)', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'Sig1', 8192, undefined, 3);
    const level = getCertificationLevel(preparedPdf);
    expect(level).toBe(MdpPermission.FormFillSignAnnotate);
  });

  it('should return undefined for invalid /P values', () => {
    const pdfStr = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
3 0 obj
<< /Type /Sig /TransformMethod /DocMDP /TransformParams << /Type /TransformParams /P 5 /V /1.2 >> >>
endobj
xref
0 4
0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000107 00000 n \ntrailer
<< /Size 4 /Root 1 0 R >>
startxref
350
%%EOF
`;
    const pdf = encoder.encode(pdfStr);
    const level = getCertificationLevel(pdf);
    expect(level).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: buildDocMdpReference
// ---------------------------------------------------------------------------

describe('buildDocMdpReference', () => {
  it('should build a valid DocMDP reference string', () => {
    const ref = buildDocMdpReference(5, MdpPermission.FormFillAndSign);

    expect(ref).toContain('/TransformMethod /DocMDP');
    expect(ref).toContain('/P 2');
    expect(ref).toContain('/V /1.2');
    expect(ref).toContain('/Type /SigRef');
    expect(ref).toContain('/Type /TransformParams');
  });

  it('should include the correct P value for each level', () => {
    const ref1 = buildDocMdpReference(1, MdpPermission.NoChanges);
    expect(ref1).toContain('/P 1');

    const ref2 = buildDocMdpReference(1, MdpPermission.FormFillAndSign);
    expect(ref2).toContain('/P 2');

    const ref3 = buildDocMdpReference(1, MdpPermission.FormFillSignAnnotate);
    expect(ref3).toContain('/P 3');
  });

  it('should produce valid PDF syntax (balanced angle brackets)', () => {
    const ref = buildDocMdpReference(5, MdpPermission.NoChanges);

    // Count << and >> — they should match
    const openCount = (ref.match(/<</g) ?? []).length;
    const closeCount = (ref.match(/>>/g) ?? []).length;
    expect(openCount).toBe(closeCount);
  });
});

// ---------------------------------------------------------------------------
// Tests: prepareForSigning with mdpPermission parameter
// ---------------------------------------------------------------------------

describe('prepareForSigning with MDP', () => {
  it('should include DocMDP reference when mdpPermission is set', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'CertSig', 8192, undefined, 2);

    const text = decoder.decode(preparedPdf);
    expect(text).toContain('/DocMDP');
    expect(text).toContain('/TransformParams');
    expect(text).toContain('/P 2');
  });

  it('should not include DocMDP when mdpPermission is undefined', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf } = prepareForSigning(pdf, 'ApprovalSig');

    const text = decoder.decode(preparedPdf);
    expect(text).not.toContain('/DocMDP');
  });

  it('should still produce valid ByteRange with MDP', () => {
    const pdf = createMinimalPdf();
    const { preparedPdf, byteRange } = prepareForSigning(
      pdf,
      'CertSig',
      8192,
      undefined,
      1,
    );

    const [off1, len1, off2, len2] = byteRange.byteRange;
    expect(off1).toBe(0);
    expect(len1).toBeGreaterThan(0);
    expect(off2).toBeGreaterThan(off1 + len1);
    expect(len1 + len2 + byteRange.contentsLength).toBe(preparedPdf.length);
  });
});

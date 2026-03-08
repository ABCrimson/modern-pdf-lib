/**
 * Tests for counter-signature functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  getCounterSignatures,
} from '../../../src/signature/counterSignature.js';
import type { CounterSignatureInfo } from '../../../src/signature/counterSignature.js';
import { prepareForSigning, embedSignature } from '../../../src/signature/byteRange.js';

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

function createSignedPdf(): Uint8Array {
  const pdf = createMinimalPdf();
  const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
  const fakeSig = new Uint8Array(256);
  globalThis.crypto.getRandomValues(fakeSig);
  return embedSignature(preparedPdf, fakeSig, byteRange);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCounterSignatures', () => {
  it('should return empty array for unsigned PDF', () => {
    const pdf = createMinimalPdf();
    const counterSigs = getCounterSignatures(pdf);
    expect(counterSigs).toHaveLength(0);
  });

  it('should return empty array for signed PDF with no counter-signatures', () => {
    const signedPdf = createSignedPdf();
    const counterSigs = getCounterSignatures(signedPdf);
    expect(counterSigs).toHaveLength(0);
  });

  it('should detect counter-signature annotation fields', () => {
    const signedPdf = createSignedPdf();

    // Append a counter-signature annotation manually
    const counterSigAppendix = encoder.encode(
      '\n20 0 obj\n' +
      '<< /Type /Annot /Subtype /Widget /FT /Sig' +
      ' /T (CounterSig_0)' +
      ' /V << /Type /Sig /Filter /Adobe.PPKLite' +
      ' /SubFilter /adbe.pkcs7.detached' +
      ' /Reason (Counter-signature for signature 0)' +
      ' /M (D:20260301120000Z)' +
      ' /Contents <deadbeef>' +
      ' /ByteRange [0 100 200 300] >>' +
      ' /F 132 /Rect [0 0 0 0] >>\n' +
      'endobj\n',
    );

    const modified = new Uint8Array(signedPdf.length + counterSigAppendix.length);
    modified.set(signedPdf, 0);
    modified.set(counterSigAppendix, signedPdf.length);

    const counterSigs = getCounterSignatures(modified);

    expect(counterSigs.length).toBeGreaterThanOrEqual(1);
    const cs = counterSigs.find((c) => c.targetSignatureIndex === 0);
    expect(cs).toBeDefined();
    expect(cs!.isValid).toBe(true);
  });

  it('should have correct CounterSignatureInfo structure', () => {
    const info: CounterSignatureInfo = {
      targetSignatureIndex: 0,
      signerName: 'Test Signer',
      signedAt: new Date(),
      isValid: true,
    };

    expect(typeof info.targetSignatureIndex).toBe('number');
    expect(typeof info.signerName).toBe('string');
    expect(info.signedAt).toBeInstanceOf(Date);
    expect(typeof info.isValid).toBe('boolean');
  });

  it('should handle CounterSignatureInfo with undefined optional fields', () => {
    const info: CounterSignatureInfo = {
      targetSignatureIndex: 1,
      signerName: 'Unknown',
      isValid: false,
    };

    expect(info.signedAt).toBeUndefined();
  });
});

describe('addCounterSignature', () => {
  it('should require a valid signature index', async () => {
    // We test the import works and the function signature is correct
    const { addCounterSignature } = await import(
      '../../../src/signature/counterSignature.js'
    );

    const pdf = createMinimalPdf();

    // No signatures exist, so any index should fail
    await expect(
      addCounterSignature(pdf, 0, {
        certificate: new Uint8Array(100),
        privateKey: new Uint8Array(100),
      }),
    ).rejects.toThrow('No signatures found');
  });

  it('should reject out-of-range signature index', async () => {
    const { addCounterSignature } = await import(
      '../../../src/signature/counterSignature.js'
    );

    const signedPdf = createSignedPdf();

    await expect(
      addCounterSignature(signedPdf, 5, {
        certificate: new Uint8Array(100),
        privateKey: new Uint8Array(100),
      }),
    ).rejects.toThrow('out of range');
  });
});

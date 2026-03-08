/**
 * Tests for LTV (Long-Term Validation) data embedding.
 */

import { describe, it, expect } from 'vitest';
import {
  embedLtvData,
  buildDssDictionary,
  hasLtvData,
} from '../../../src/signature/ltvEmbed.js';
import type { LtvOptions, DssData } from '../../../src/signature/ltvEmbed.js';
import { prepareForSigning, embedSignature } from '../../../src/signature/byteRange.js';

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

function createSignedPdf(): Uint8Array {
  const pdf = createMinimalPdf();
  const { preparedPdf, byteRange } = prepareForSigning(pdf, 'Sig1');
  const fakeSig = new Uint8Array(256);
  globalThis.crypto.getRandomValues(fakeSig);
  return embedSignature(preparedPdf, fakeSig, byteRange);
}

// ---------------------------------------------------------------------------
// Tests: buildDssDictionary
// ---------------------------------------------------------------------------

describe('buildDssDictionary', () => {
  it('should build DSS dict with certs only', () => {
    const data: DssData = {
      certs: [new Uint8Array([1, 2, 3])],
      ocsps: [],
      crls: [],
    };
    const result = buildDssDictionary(data);

    expect(result).toContain('/Type /DSS');
    expect(result).toContain('/Certs');
    expect(result).not.toContain('/OCSPs');
    expect(result).not.toContain('/CRLs');
  });

  it('should build DSS dict with OCSPs only', () => {
    const data: DssData = {
      certs: [],
      ocsps: [new Uint8Array([4, 5, 6])],
      crls: [],
    };
    const result = buildDssDictionary(data);

    expect(result).toContain('/Type /DSS');
    expect(result).not.toContain('/Certs');
    expect(result).toContain('/OCSPs');
    expect(result).not.toContain('/CRLs');
  });

  it('should build DSS dict with CRLs only', () => {
    const data: DssData = {
      certs: [],
      ocsps: [],
      crls: [new Uint8Array([7, 8, 9])],
    };
    const result = buildDssDictionary(data);

    expect(result).toContain('/Type /DSS');
    expect(result).not.toContain('/Certs');
    expect(result).not.toContain('/OCSPs');
    expect(result).toContain('/CRLs');
  });

  it('should build DSS dict with all data types', () => {
    const data: DssData = {
      certs: [new Uint8Array([1, 2]), new Uint8Array([3, 4])],
      ocsps: [new Uint8Array([5, 6])],
      crls: [new Uint8Array([7, 8])],
    };
    const result = buildDssDictionary(data);

    expect(result).toContain('/Type /DSS');
    expect(result).toContain('/Certs');
    expect(result).toContain('/OCSPs');
    expect(result).toContain('/CRLs');
  });

  it('should handle empty data', () => {
    const data: DssData = {
      certs: [],
      ocsps: [],
      crls: [],
    };
    const result = buildDssDictionary(data);

    expect(result).toContain('/Type /DSS');
    expect(result).not.toContain('/Certs');
    expect(result).not.toContain('/OCSPs');
    expect(result).not.toContain('/CRLs');
  });
});

// ---------------------------------------------------------------------------
// Tests: hasLtvData
// ---------------------------------------------------------------------------

describe('hasLtvData', () => {
  it('should return false for PDF without DSS', () => {
    const pdf = createMinimalPdf();
    expect(hasLtvData(pdf)).toBe(false);
  });

  it('should return true for PDF with DSS type marker', () => {
    const pdf = createMinimalPdf();
    const dssAppendix = encoder.encode(
      '\n10 0 obj\n<< /Type /DSS /Certs [] >>\nendobj\n',
    );
    const modified = new Uint8Array(pdf.length + dssAppendix.length);
    modified.set(pdf, 0);
    modified.set(dssAppendix, pdf.length);

    expect(hasLtvData(modified)).toBe(true);
  });

  it('should return true for PDF with DSS reference', () => {
    const pdfStr = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /DSS 10 0 R >>
endobj
xref
0 2
0000000000 65535 f \n0000000009 00000 n \ntrailer
<< /Size 2 /Root 1 0 R >>
startxref
80
%%EOF
`;
    const pdf = encoder.encode(pdfStr);
    expect(hasLtvData(pdf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: embedLtvData
// ---------------------------------------------------------------------------

describe('embedLtvData', () => {
  it('should return original PDF when no validation data is available', async () => {
    const pdf = createMinimalPdf();
    const result = await embedLtvData(pdf);

    // No signatures = no certs to extract, so returns the original
    expect(result.length).toBe(pdf.length);
  });

  it('should embed extra certificates via incremental update', async () => {
    const pdf = createMinimalPdf();
    const fakeCert = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA, 0xBB]);

    const result = await embedLtvData(pdf, {
      extraCertificates: [fakeCert],
    });

    expect(result.length).toBeGreaterThan(pdf.length);

    const text = decoder.decode(result);
    expect(text).toContain('/Type /DSS');
    expect(text).toContain('/Certs');
  });

  it('should embed CRLs when provided', async () => {
    const pdf = createMinimalPdf();
    const fakeCrl = new Uint8Array([0x30, 0x82, 0x02, 0x00, 0xCC, 0xDD]);

    const result = await embedLtvData(pdf, {
      crls: [fakeCrl],
      includeCrl: true,
    });

    expect(result.length).toBeGreaterThan(pdf.length);

    const text = decoder.decode(result);
    expect(text).toContain('/Type /DSS');
    expect(text).toContain('/CRLs');
  });

  it('should embed OCSP responses when provided', async () => {
    const pdf = createMinimalPdf();
    const fakeOcsp = new Uint8Array([0x30, 0x82, 0x03, 0x00, 0xEE, 0xFF]);

    const result = await embedLtvData(pdf, {
      ocspResponses: [fakeOcsp],
      includeOcsp: true,
    });

    expect(result.length).toBeGreaterThan(pdf.length);

    const text = decoder.decode(result);
    expect(text).toContain('/Type /DSS');
    expect(text).toContain('/OCSPs');
  });

  it('should exclude certs when includeCerts is false', async () => {
    const pdf = createMinimalPdf();
    const fakeCert = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA]);
    const fakeCrl = new Uint8Array([0x30, 0x82, 0x02, 0x00, 0xBB]);

    const result = await embedLtvData(pdf, {
      extraCertificates: [fakeCert],
      crls: [fakeCrl],
      includeCerts: false,
    });

    const text = decoder.decode(result);
    // Should have CRLs but not Certs
    expect(text).toContain('/CRLs');
    expect(text).not.toContain('/Certs');
  });

  it('should exclude OCSPs when includeOcsp is false', async () => {
    const pdf = createMinimalPdf();
    const fakeCert = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA]);
    const fakeOcsp = new Uint8Array([0x30, 0x82, 0x03, 0x00, 0xEE]);

    const result = await embedLtvData(pdf, {
      extraCertificates: [fakeCert],
      ocspResponses: [fakeOcsp],
      includeOcsp: false,
    });

    const text = decoder.decode(result);
    expect(text).toContain('/Certs');
    expect(text).not.toContain('/OCSPs');
  });

  it('should exclude CRLs when includeCrl is false', async () => {
    const pdf = createMinimalPdf();
    const fakeCert = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA]);
    const fakeCrl = new Uint8Array([0x30, 0x82, 0x02, 0x00, 0xBB]);

    const result = await embedLtvData(pdf, {
      extraCertificates: [fakeCert],
      crls: [fakeCrl],
      includeCrl: false,
    });

    const text = decoder.decode(result);
    expect(text).toContain('/Certs');
    expect(text).not.toContain('/CRLs');
  });

  it('should deduplicate certificates', async () => {
    const pdf = createMinimalPdf();
    const cert1 = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA]);
    const cert2 = new Uint8Array([0x30, 0x82, 0x01, 0x00, 0xAA]); // same

    const result = await embedLtvData(pdf, {
      extraCertificates: [cert1, cert2],
    });

    const text = decoder.decode(result);
    // Should have /Certs with only one reference
    const certRefMatch = text.match(/\/Certs\s*\[([^\]]*)\]/);
    expect(certRefMatch).toBeTruthy();
    const refs = certRefMatch![1]!.match(/\d+\s+0\s+R/g);
    expect(refs).toHaveLength(1);
  });

  it('should produce valid PDF structure', async () => {
    const pdf = createMinimalPdf();
    const result = await embedLtvData(pdf, {
      extraCertificates: [new Uint8Array([0x30, 0x02, 0xAA, 0xBB])],
      crls: [new Uint8Array([0x30, 0x02, 0xCC, 0xDD])],
      ocspResponses: [new Uint8Array([0x30, 0x02, 0xEE, 0xFF])],
    });

    const text = decoder.decode(result);
    // Should have proper xref/trailer/startxref/%%EOF
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text).toContain('startxref');
    expect(text).toContain('%%EOF');
    // Should have /Prev pointing back to original xref
    expect(text).toContain('/Prev');
  });

  it('should have correct LtvOptions type', () => {
    const opts: LtvOptions = {
      includeOcsp: true,
      includeCrl: false,
      includeCerts: true,
    };

    expect(opts.includeOcsp).toBe(true);
    expect(opts.includeCrl).toBe(false);
  });
});

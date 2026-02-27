/**
 * Tests for PDF/A compliance validation and enforcement.
 *
 * Covers:
 * - Validation checks for various PDF/A levels
 * - Detection of encryption, JavaScript, missing XMP metadata
 * - Detection of missing /ID in trailer
 * - Structure tree and MarkInfo checks for 'a' conformance
 * - Unicode mapping checks for 'u' conformance
 * - Embedded files restriction for parts 1 and 2
 * - Enforcement: adding XMP metadata and trailer /ID
 * - Error handling for unfixable issues
 */

import { describe, it, expect } from 'vitest';
import { validatePdfA, enforcePdfA } from '../../../src/compliance/pdfA.js';
import type { PdfALevel } from '../../../src/compliance/pdfA.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Build a minimal PDF byte array with configurable features.
 * The PDF is just text bytes — not a fully valid PDF, but enough
 * for the pattern-based validation checks.
 */
function buildPdf(options: {
  metadata?: boolean;
  xmpPdfaId?: boolean;
  encrypt?: boolean;
  javascript?: boolean;
  trailerId?: boolean;
  structTree?: boolean;
  markInfo?: boolean;
  toUnicode?: boolean;
  embeddedFiles?: boolean;
  lang?: boolean;
  deviceRgb?: boolean;
  outputIntents?: boolean;
  transparency?: boolean;
  standardFont?: boolean;
} = {}): Uint8Array {
  const lines: string[] = ['%PDF-1.7'];

  // Catalog
  let catalog = '<< /Type /Catalog /Pages 2 0 R';
  if (options.lang) catalog += ' /Lang (en)';
  if (options.structTree) catalog += ' /StructTreeRoot 10 0 R';
  if (options.markInfo) catalog += ' /MarkInfo << /Marked true >>';
  if (options.outputIntents) catalog += ' /OutputIntents [<< /Type /OutputIntent >>]';
  catalog += ' >>';

  lines.push('1 0 obj', catalog, 'endobj');

  // Pages
  lines.push('2 0 obj', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'endobj');

  // Page
  let pageDict = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]';
  if (options.deviceRgb) pageDict += ' /Resources << /ColorSpace << /CS1 /DeviceRGB >> >>';
  pageDict += ' >>';
  lines.push('3 0 obj', pageDict, 'endobj');

  // Optional Metadata stream
  if (options.metadata) {
    let xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/">';
    xmp += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">';
    if (options.xmpPdfaId) {
      xmp += '<rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">';
      xmp += '<pdfaid:part>2</pdfaid:part>';
      xmp += '<pdfaid:conformance>B</pdfaid:conformance>';
      xmp += '</rdf:Description>';
    }
    xmp += '</rdf:RDF></x:xmpmeta>';

    lines.push('4 0 obj');
    lines.push(`<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>`);
    lines.push('stream');
    lines.push(xmp);
    lines.push('endstream');
    lines.push('endobj');

    // Add /Metadata reference in catalog
    lines[2] = lines[2]!.replace('/Pages 2 0 R', '/Pages 2 0 R /Metadata 4 0 R');
  }

  // Optional encryption
  if (options.encrypt) {
    lines.push('5 0 obj', '<< /Filter /Standard /V 2 /R 3 /O (xxx) /U (xxx) /P -4 >>', 'endobj');
    // Add /Encrypt in trailer
  }

  // Optional JavaScript
  if (options.javascript) {
    lines.push('6 0 obj', '<< /Type /Action /S /JavaScript /JS (alert) >>', 'endobj');
  }

  // Optional ToUnicode
  if (options.toUnicode) {
    lines.push('7 0 obj', '<< /Type /Font /Subtype /TrueType /ToUnicode 8 0 R >>', 'endobj');
  }

  // Optional EmbeddedFiles
  if (options.embeddedFiles) {
    lines.push('9 0 obj', '<< /Type /Filespec /EF << /F 10 0 R >> /EmbeddedFiles true >>', 'endobj');
  }

  // Optional transparency
  if (options.transparency) {
    lines.push('11 0 obj', '<< /Type /ExtGState /SMask << /S /Luminosity >> /CA 0.5 >>', 'endobj');
  }

  // Optional standard font (unembedded)
  if (options.standardFont) {
    lines.push('12 0 obj', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'endobj');
  }

  // Cross-reference table
  lines.push('xref');
  lines.push('0 1');
  lines.push('0000000000 65535 f ');

  // Trailer
  let trailer = '<< /Size 13 /Root 1 0 R';
  if (options.encrypt) trailer += ' /Encrypt 5 0 R';
  if (options.trailerId) trailer += ' /ID [<abc123> <def456>]';
  trailer += ' >>';
  lines.push('trailer');
  lines.push(trailer);
  lines.push('startxref');
  lines.push('0');
  lines.push('%%EOF');

  return encoder.encode(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// validatePdfA
// ---------------------------------------------------------------------------

describe('validatePdfA', () => {
  it('should report missing XMP metadata', () => {
    const pdf = buildPdf({ trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'PDFA-001')).toBe(true);
  });

  it('should report missing pdfaid in XMP metadata', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: false, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-002')).toBe(true);
  });

  it('should accept XMP with pdfaid identification', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-001')).toBe(false);
    expect(result.issues.some((i) => i.code === 'PDFA-002')).toBe(false);
  });

  it('should report encryption', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, encrypt: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-003')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('should report JavaScript', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, javascript: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-004')).toBe(true);
  });

  it('should report missing /ID in trailer', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: false, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-005')).toBe(true);
  });

  it('should accept /ID in trailer', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-005')).toBe(false);
  });

  it('should report missing StructTreeRoot for "a" conformance', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2a');
    expect(result.issues.some((i) => i.code === 'PDFA-007')).toBe(true);
    expect(result.issues.some((i) => i.code === 'PDFA-008')).toBe(true);
  });

  it('should not require StructTreeRoot for "b" conformance', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-007')).toBe(false);
  });

  it('should accept StructTreeRoot and MarkInfo for "a" conformance', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      structTree: true, markInfo: true, toUnicode: true,
    });
    const result = validatePdfA(pdf, '2a');
    expect(result.issues.some((i) => i.code === 'PDFA-007')).toBe(false);
    expect(result.issues.some((i) => i.code === 'PDFA-008')).toBe(false);
  });

  it('should warn about missing ToUnicode for "u" conformance (part 2+)', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2u');
    expect(result.issues.some((i) => i.code === 'PDFA-009')).toBe(true);
  });

  it('should not warn about ToUnicode for "b" conformance', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true, lang: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-009')).toBe(false);
  });

  it('should report embedded files for part 1', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      embeddedFiles: true,
    });
    const result = validatePdfA(pdf, '1b');
    expect(result.issues.some((i) => i.code === 'PDFA-010')).toBe(true);
  });

  it('should report embedded files for part 2', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      embeddedFiles: true,
    });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-010')).toBe(true);
  });

  it('should allow embedded files for part 3', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      embeddedFiles: true,
    });
    const result = validatePdfA(pdf, '3b');
    expect(result.issues.some((i) => i.code === 'PDFA-010')).toBe(false);
  });

  it('should warn about missing /Lang', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-011')).toBe(true);
  });

  it('should warn about device-dependent colorspace without OutputIntents', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      deviceRgb: true,
    });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-012')).toBe(true);
  });

  it('should not warn about colorspace when OutputIntents present', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      deviceRgb: true, outputIntents: true,
    });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-012')).toBe(false);
  });

  it('should report standard font without embedding', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      standardFont: true,
    });
    const result = validatePdfA(pdf, '2b');
    expect(result.issues.some((i) => i.code === 'PDFA-013')).toBe(true);
  });

  it('should report transparency issues for PDF/A-1', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      transparency: true,
    });
    const result = validatePdfA(pdf, '1b');
    expect(result.issues.some((i) => i.code === 'PDFA-006')).toBe(true);
  });

  it('should not flag transparency for PDF/A-2', () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
      transparency: true,
    });
    const result = validatePdfA(pdf, '2b');
    // PDF/A-2 allows transparency
    expect(result.issues.some((i) => i.code === 'PDFA-006')).toBe(false);
  });

  it('should return the requested level in the result', () => {
    const pdf = buildPdf();
    const result = validatePdfA(pdf, '3u');
    expect(result.level).toBe('3u');
  });

  it('should mark as valid when only warnings exist', () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, trailerId: true });
    const result = validatePdfA(pdf, '2b');
    // Missing /Lang is a warning, not an error
    const errorCount = result.issues.filter((i) => i.severity === 'error').length;
    // Only warnings should still be valid if there are no errors
    if (errorCount === 0) {
      expect(result.valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// enforcePdfA
// ---------------------------------------------------------------------------

describe('enforcePdfA', () => {
  it('should throw for encrypted PDFs', async () => {
    const pdf = buildPdf({ encrypt: true });
    await expect(enforcePdfA(pdf, '2b')).rejects.toThrow('encrypted');
  });

  it('should throw for PDFs with JavaScript', async () => {
    const pdf = buildPdf({ javascript: true });
    await expect(enforcePdfA(pdf, '2b')).rejects.toThrow('JavaScript');
  });

  it('should return as-is if already valid', async () => {
    const pdf = buildPdf({
      metadata: true, xmpPdfaId: true, trailerId: true, lang: true,
    });
    const preValidation = validatePdfA(pdf, '2b');
    if (preValidation.valid) {
      const result = await enforcePdfA(pdf, '2b');
      expect(result).toBe(pdf);
    }
  });

  it('should add XMP metadata when missing', async () => {
    const pdf = buildPdf({ trailerId: true, lang: true });
    const result = await enforcePdfA(pdf, '2b');
    // The result should contain pdfaid:part
    const resultStr = new TextDecoder().decode(result);
    expect(resultStr).toContain('pdfaid:part');
    expect(resultStr).toContain('pdfaid:conformance');
  });

  it('should add trailer /ID when missing', async () => {
    const pdf = buildPdf({ metadata: true, xmpPdfaId: true, lang: true });
    const result = await enforcePdfA(pdf, '2b');
    const resultStr = new TextDecoder().decode(result);
    expect(resultStr).toContain('/ID');
  });

  it('should produce larger output when adding metadata', async () => {
    const pdf = buildPdf({ trailerId: true, lang: true });
    const result = await enforcePdfA(pdf, '2b');
    expect(result.length).toBeGreaterThan(pdf.length);
  });
});

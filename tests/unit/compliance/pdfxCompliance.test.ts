/**
 * Tests for PDF/X compliance validation and enforcement.
 *
 * Covers:
 * - X-1a:2003 validation (strict CMYK, no transparency)
 * - X-3:2003 validation (allows RGB with ICC, no transparency)
 * - X-4 validation (allows transparency, requires PDF 1.6+)
 * - Missing output intent detection
 * - Missing TrimBox detection
 * - Transparency detection for X-1a and X-3
 * - Font embedding requirements
 * - No encryption
 * - No JavaScript / multimedia
 * - Page box nesting validation
 * - Auto-enforcement (set trapped, add output intent, add TrimBox)
 */

import { describe, it, expect } from 'vitest';
import { validatePdfX, enforcePdfX } from '../../../src/compliance/pdfxCompliance.js';
import type { PdfXLevel, PdfXOptions } from '../../../src/compliance/pdfxCompliance.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Build a minimal PDF byte array with configurable features for PDF/X testing.
 * The PDF is just text bytes — not a fully valid PDF, but enough
 * for the pattern-based validation checks.
 */
function buildPdf(options: {
  version?: string;
  outputIntents?: boolean;
  gtsPdfx?: boolean;
  trapped?: 'True' | 'False' | 'Unknown' | false;
  trimBox?: boolean;
  bleedBox?: boolean;
  artBox?: boolean;
  mediaBox?: [number, number, number, number];
  trimBoxValues?: [number, number, number, number];
  bleedBoxValues?: [number, number, number, number];
  artBoxValues?: [number, number, number, number];
  transparency?: boolean;
  deviceRgb?: boolean;
  iccBasedRgb?: boolean;
  deviceCmyk?: boolean;
  encrypt?: boolean;
  javascript?: boolean;
  multimedia?: boolean;
  standardFont?: boolean;
  infoDict?: boolean;
} = {}): Uint8Array {
  const version = options.version ?? '1.7';
  const lines: string[] = [`%PDF-${version}`];

  // Catalog
  let catalog = '<< /Type /Catalog /Pages 2 0 R';
  if (options.outputIntents) {
    catalog += ' /OutputIntents [3 0 R]';
  }
  catalog += ' >>';
  lines.push('1 0 obj', catalog, 'endobj');

  // Pages
  lines.push('2 0 obj', '<< /Type /Pages /Kids [4 0 R] /Count 1 >>', 'endobj');

  // Output intent
  if (options.outputIntents) {
    let intent = '<< /Type /OutputIntent';
    if (options.gtsPdfx !== false) {
      intent += ' /S /GTS_PDFX';
    }
    intent += ' /OutputConditionIdentifier (CGATS TR 001)';
    intent += ' >>';
    lines.push('3 0 obj', intent, 'endobj');
  }

  // Page
  const mb = options.mediaBox ?? [0, 0, 612, 792];
  let pageDict = `<< /Type /Page /Parent 2 0 R /MediaBox [${mb.join(' ')}]`;

  if (options.trimBox) {
    const tb = options.trimBoxValues ?? [0, 0, 612, 792];
    pageDict += ` /TrimBox [${tb.join(' ')}]`;
  }
  if (options.bleedBox) {
    const bb = options.bleedBoxValues ?? [0, 0, 612, 792];
    pageDict += ` /BleedBox [${bb.join(' ')}]`;
  }
  if (options.artBox) {
    const ab = options.artBoxValues ?? [0, 0, 612, 792];
    pageDict += ` /ArtBox [${ab.join(' ')}]`;
  }
  if (options.deviceRgb) {
    pageDict += ' /Resources << /ColorSpace << /CS1 /DeviceRGB >> >>';
  } else if (options.deviceCmyk) {
    pageDict += ' /Resources << /ColorSpace << /CS1 /DeviceCMYK >> >>';
  }
  pageDict += ' >>';
  lines.push('4 0 obj', pageDict, 'endobj');

  // Info dictionary with /Trapped
  if (options.infoDict !== false) {
    let infoDict = '<< /Producer (modern-pdf-lib)';
    if (options.trapped !== false) {
      const trappedVal = options.trapped ?? 'False';
      infoDict += ` /Trapped /${trappedVal}`;
    }
    infoDict += ' >>';
    lines.push('5 0 obj', infoDict, 'endobj');
  }

  // Optional ICC-based RGB
  if (options.iccBasedRgb) {
    lines.push('6 0 obj', '<< /Type /ColorSpace /ICCBased 7 0 R >>', 'endobj');
    lines.push('7 0 obj', '<< /N 3 /Length 100 >>', 'endobj');
  }

  // Optional transparency
  if (options.transparency) {
    lines.push('8 0 obj', '<< /Type /ExtGState /SMask << /S /Luminosity >> /CA 0.5 >>', 'endobj');
  }

  // Optional encryption
  if (options.encrypt) {
    lines.push('9 0 obj', '<< /Filter /Standard /V 2 /R 3 /O (xxx) /U (xxx) /P -4 >>', 'endobj');
  }

  // Optional JavaScript
  if (options.javascript) {
    lines.push('10 0 obj', '<< /Type /Action /S /JavaScript /JS (alert) >>', 'endobj');
  }

  // Optional multimedia
  if (options.multimedia) {
    lines.push('11 0 obj', '<< /Type /Annot /Subtype /RichMedia >>', 'endobj');
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
  let trailer = '<< /Size 20 /Root 1 0 R';
  if (options.infoDict !== false) {
    trailer += ' /Info 5 0 R';
  }
  if (options.encrypt) trailer += ' /Encrypt 9 0 R';
  trailer += ' >>';
  lines.push('trailer');
  lines.push(trailer);
  lines.push('startxref');
  lines.push('0');
  lines.push('%%EOF');

  return encoder.encode(lines.join('\n'));
}

/** Build a compliant PDF for a given level. */
function buildCompliantPdf(level: PdfXLevel): Uint8Array {
  const base: Parameters<typeof buildPdf>[0] = {
    outputIntents: true,
    gtsPdfx: true,
    trapped: 'False',
    trimBox: true,
  };

  if (level === 'X-1a:2003') {
    return buildPdf({ ...base, deviceCmyk: true });
  } else if (level === 'X-3:2003') {
    return buildPdf({ ...base, iccBasedRgb: true });
  } else {
    // X-4 — requires PDF 1.6+
    return buildPdf({ ...base, version: '1.6' });
  }
}

// ---------------------------------------------------------------------------
// validatePdfX — Output Intent
// ---------------------------------------------------------------------------

describe('validatePdfX — output intent', () => {
  it('should report missing /OutputIntents', () => {
    const pdf = buildPdf({ trimBox: true, trapped: 'False' });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PDFX-001')).toBe(true);
  });

  it('should report missing /GTS_PDFX subtype', () => {
    const pdf = buildPdf({ outputIntents: true, gtsPdfx: false, trimBox: true, trapped: 'False' });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-002')).toBe(true);
  });

  it('should accept valid output intent', () => {
    const pdf = buildPdf({ outputIntents: true, gtsPdfx: true, trimBox: true, trapped: 'False' });
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.errors.some(e => e.code === 'PDFX-001')).toBe(false);
    expect(result.errors.some(e => e.code === 'PDFX-002')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — /Trapped
// ---------------------------------------------------------------------------

describe('validatePdfX — trapped key', () => {
  it('should report missing /Trapped', () => {
    const pdf = buildPdf({ outputIntents: true, trimBox: true, trapped: false });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-003')).toBe(true);
  });

  it('should accept /Trapped /True', () => {
    const pdf = buildPdf({ outputIntents: true, trimBox: true, trapped: 'True' });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-003')).toBe(false);
  });

  it('should accept /Trapped /False', () => {
    const pdf = buildPdf({ outputIntents: true, trimBox: true, trapped: 'False' });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-003')).toBe(false);
  });

  it('should accept /Trapped /Unknown', () => {
    const pdf = buildPdf({ outputIntents: true, trimBox: true, trapped: 'Unknown' });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-003')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Transparency
// ---------------------------------------------------------------------------

describe('validatePdfX — transparency', () => {
  it('should report transparency for X-1a:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      transparency: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-004')).toBe(true);
  });

  it('should report transparency for X-3:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      transparency: true,
    });
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.errors.some(e => e.code === 'PDFX-004')).toBe(true);
  });

  it('should allow transparency for X-4', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      transparency: true, version: '1.6',
    });
    const result = validatePdfX(pdf, 'X-4');
    expect(result.errors.some(e => e.code === 'PDFX-004')).toBe(false);
  });

  it('should not report transparency when none present', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-004')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Color spaces (X-1a strict CMYK)
// ---------------------------------------------------------------------------

describe('validatePdfX — color spaces (X-1a)', () => {
  it('should reject DeviceRGB for X-1a:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      deviceRgb: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-005')).toBe(true);
  });

  it('should reject ICC-based RGB (/N 3) for X-1a:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      iccBasedRgb: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-005')).toBe(true);
  });

  it('should accept DeviceCMYK for X-1a:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      deviceCmyk: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-005')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Color spaces (X-3 allows RGB with ICC)
// ---------------------------------------------------------------------------

describe('validatePdfX — color spaces (X-3)', () => {
  it('should warn about DeviceRGB without ICC for X-3:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      deviceRgb: true,
    });
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-005W')).toBe(true);
    // Not an error — just a warning
    expect(result.errors.some(e => e.code === 'PDFX-005')).toBe(false);
  });

  it('should not warn about RGB when ICC profile is present for X-3:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      deviceRgb: true, iccBasedRgb: true,
    });
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-005W')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Font embedding
// ---------------------------------------------------------------------------

describe('validatePdfX — font embedding', () => {
  it('should report unembedded standard font', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      standardFont: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-006')).toBe(true);
  });

  it('should not report font issues when no standard fonts used', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-006')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Encryption
// ---------------------------------------------------------------------------

describe('validatePdfX — encryption', () => {
  it('should reject encrypted PDFs', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      encrypt: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-007')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — TrimBox / BleedBox
// ---------------------------------------------------------------------------

describe('validatePdfX — page boxes', () => {
  it('should report missing TrimBox and BleedBox', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-008')).toBe(true);
  });

  it('should accept TrimBox', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      trimBox: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-008')).toBe(false);
  });

  it('should accept BleedBox (without TrimBox)', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      bleedBox: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-008')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Page box nesting
// ---------------------------------------------------------------------------

describe('validatePdfX — page box nesting', () => {
  it('should warn when BleedBox exceeds MediaBox', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
      bleedBox: true,
      bleedBoxValues: [-10, -10, 622, 802], // larger than MediaBox
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-012')).toBe(true);
  });

  it('should warn when TrimBox exceeds BleedBox', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
      bleedBox: true,
      bleedBoxValues: [10, 10, 602, 782],
      trimBox: true,
      trimBoxValues: [5, 5, 607, 787], // larger than BleedBox
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-013')).toBe(true);
  });

  it('should warn when TrimBox exceeds MediaBox (no BleedBox)', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
      trimBox: true,
      trimBoxValues: [-5, -5, 617, 797], // larger than MediaBox
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-014')).toBe(true);
  });

  it('should warn when ArtBox exceeds TrimBox', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
      trimBox: true,
      trimBoxValues: [10, 10, 602, 782],
      artBox: true,
      artBoxValues: [5, 5, 607, 787], // larger than TrimBox
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.warnings.some(w => w.code === 'PDFX-015')).toBe(true);
  });

  it('should not warn when boxes are properly nested', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
      bleedBox: true,
      bleedBoxValues: [5, 5, 607, 787],
      trimBox: true,
      trimBoxValues: [10, 10, 602, 782],
      artBox: true,
      artBoxValues: [15, 15, 597, 777],
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.warnings.some(w =>
      w.code === 'PDFX-012' || w.code === 'PDFX-013' ||
      w.code === 'PDFX-014' || w.code === 'PDFX-015'
    )).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — JavaScript / Multimedia
// ---------------------------------------------------------------------------

describe('validatePdfX — prohibited features', () => {
  it('should reject JavaScript', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      javascript: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-009')).toBe(true);
  });

  it('should reject multimedia content', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      multimedia: true,
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-010')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — PDF version requirements
// ---------------------------------------------------------------------------

describe('validatePdfX — PDF version', () => {
  it('should reject PDF 1.4 for X-4', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      version: '1.4',
    });
    const result = validatePdfX(pdf, 'X-4');
    expect(result.errors.some(e => e.code === 'PDFX-011')).toBe(true);
  });

  it('should accept PDF 1.6 for X-4', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      version: '1.6',
    });
    const result = validatePdfX(pdf, 'X-4');
    expect(result.errors.some(e => e.code === 'PDFX-011')).toBe(false);
  });

  it('should accept PDF 1.7 for X-4', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      version: '1.7',
    });
    const result = validatePdfX(pdf, 'X-4');
    expect(result.errors.some(e => e.code === 'PDFX-011')).toBe(false);
  });

  it('should not check version for X-1a:2003', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      version: '1.3',
    });
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.errors.some(e => e.code === 'PDFX-011')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfX — Full compliance
// ---------------------------------------------------------------------------

describe('validatePdfX — full compliance', () => {
  it('should validate a compliant X-1a:2003 document', () => {
    const pdf = buildCompliantPdf('X-1a:2003');
    const result = validatePdfX(pdf, 'X-1a:2003');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.level).toBe('X-1a:2003');
  });

  it('should validate a compliant X-3:2003 document', () => {
    const pdf = buildCompliantPdf('X-3:2003');
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.level).toBe('X-3:2003');
  });

  it('should validate a compliant X-4 document', () => {
    const pdf = buildCompliantPdf('X-4');
    const result = validatePdfX(pdf, 'X-4');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.level).toBe('X-4');
  });

  it('should return the requested level in the result', () => {
    const pdf = buildPdf();
    const result = validatePdfX(pdf, 'X-3:2003');
    expect(result.level).toBe('X-3:2003');
  });
});

// ---------------------------------------------------------------------------
// enforcePdfX — Auto-enforcement
// ---------------------------------------------------------------------------

describe('enforcePdfX — auto-enforcement', () => {
  const defaultOptions: PdfXOptions = {
    level: 'X-1a:2003',
    outputIntent: {
      condition: 'CGATS TR 001',
      registryName: 'http://www.color.org',
      info: 'CMYK output',
    },
    trapped: 'False',
  };

  it('should add output intent when missing', () => {
    const pdf = buildPdf({ trimBox: true, trapped: 'False' });
    const result = enforcePdfX(pdf, defaultOptions);
    const resultStr = decoder.decode(result);
    expect(resultStr).toContain('/OutputIntents');
    expect(resultStr).toContain('/GTS_PDFX');
    expect(resultStr).toContain('CGATS TR 001');
  });

  it('should set /Trapped when missing', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: false, infoDict: true,
    });
    const result = enforcePdfX(pdf, defaultOptions);
    const resultStr = decoder.decode(result);
    expect(resultStr).toContain('/Trapped /False');
  });

  it('should add TrimBox when missing', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      mediaBox: [0, 0, 612, 792],
    });
    const result = enforcePdfX(pdf, defaultOptions);
    const resultStr = decoder.decode(result);
    expect(resultStr).toContain('/TrimBox');
    expect(resultStr).toContain('0 0 612 792');
  });

  it('should not duplicate TrimBox if already present', () => {
    const pdf = buildPdf({
      outputIntents: true, trapped: 'False',
      trimBox: true,
      trimBoxValues: [10, 10, 602, 782],
    });
    const result = enforcePdfX(pdf, defaultOptions);
    const resultStr = decoder.decode(result);
    // Count TrimBox occurrences — should be exactly 1
    const matches = resultStr.match(/\/TrimBox/g);
    expect(matches).toHaveLength(1);
  });

  it('should flatten transparency for X-1a enforcement', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      transparency: true,
    });
    const result = enforcePdfX(pdf, { ...defaultOptions, level: 'X-1a:2003' });
    const resultStr = decoder.decode(result);
    // Transparency should be flattened — CA should be 1
    expect(resultStr).not.toContain('/CA 0.5');
  });

  it('should not flatten transparency for X-4 enforcement', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: 'False',
      transparency: true, version: '1.6',
    });
    const result = enforcePdfX(pdf, { ...defaultOptions, level: 'X-4' });
    const resultStr = decoder.decode(result);
    // Transparency should be preserved
    expect(resultStr).toContain('/CA 0.5');
  });

  it('should throw for encrypted PDFs', () => {
    const pdf = buildPdf({ encrypt: true, trimBox: true, trapped: 'False' });
    expect(() => enforcePdfX(pdf, defaultOptions)).toThrow('encrypted');
  });

  it('should throw for PDFs with JavaScript', () => {
    const pdf = buildPdf({ javascript: true, trimBox: true, trapped: 'False' });
    expect(() => enforcePdfX(pdf, defaultOptions)).toThrow('JavaScript');
  });

  it('should set /Trapped /True when specified', () => {
    const pdf = buildPdf({
      outputIntents: true, trimBox: true, trapped: false, infoDict: true,
    });
    const result = enforcePdfX(pdf, { ...defaultOptions, trapped: 'True' });
    const resultStr = decoder.decode(result);
    expect(resultStr).toContain('/Trapped /True');
  });

  it('should produce a larger output when adding output intent', () => {
    const pdf = buildPdf({ trimBox: true, trapped: 'False' });
    const result = enforcePdfX(pdf, defaultOptions);
    expect(result.length).toBeGreaterThan(pdf.length);
  });

  it('should produce a document that passes more validation checks after enforcement', () => {
    const pdf = buildPdf({
      trapped: false,
      mediaBox: [0, 0, 612, 792],
    });

    // Before enforcement — multiple errors expected
    const beforeResult = validatePdfX(pdf, 'X-3:2003');
    const errorCountBefore = beforeResult.errors.length;

    const enforced = enforcePdfX(pdf, {
      level: 'X-3:2003',
      outputIntent: { condition: 'sRGB' },
      trapped: 'False',
    });

    // After enforcement — fewer errors
    const afterResult = validatePdfX(enforced, 'X-3:2003');
    expect(afterResult.errors.length).toBeLessThan(errorCountBefore);
  });
});

// ---------------------------------------------------------------------------
// Exports from compliance/index.ts
// ---------------------------------------------------------------------------

describe('compliance/index.ts re-exports', () => {
  it('should export validatePdfX from compliance barrel', async () => {
    const mod = await import('../../../src/compliance/index.js');
    expect(typeof mod.validatePdfX).toBe('function');
  });

  it('should export enforcePdfX from compliance barrel', async () => {
    const mod = await import('../../../src/compliance/index.js');
    expect(typeof mod.enforcePdfX).toBe('function');
  });

  it('should export buildPdfXOutputIntent from compliance barrel', async () => {
    const mod = await import('../../../src/compliance/index.js');
    expect(typeof mod.buildPdfXOutputIntent).toBe('function');
  });
});

/**
 * Tests for the enhanced PDF/A enforcement pipeline (enforcePdfAFull).
 *
 * Covers:
 * - XMP metadata injection with pdfaid part/conformance
 * - File ID addition to trailer
 * - Stripping prohibited features (JavaScript, Launch)
 * - Transparency flattening for PDF/A-1 levels
 * - Option flags to disable individual pipeline steps
 * - Encrypted document rejection
 * - Result shape: bytes, validation, actions, fullyCompliant, remainingIssues
 * - Title and author injection into XMP
 * - Skipping XMP if already present
 * - Skipping /ID if already present
 */

import { describe, it, expect } from 'vitest';
import { enforcePdfAFull } from '../../../src/compliance/enforcePdfAv2.js';
import type {
  EnforcePdfAOptions,
  EnforcePdfAResult,
  EnforcementAction,
} from '../../../src/compliance/enforcePdfAv2.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Build a minimal PDF with configurable features for testing the pipeline. */
function buildPdf(options: {
  javascript?: boolean;
  transparency?: boolean;
  xmp?: boolean;
  trailerId?: boolean;
  encrypt?: boolean;
} = {}): Uint8Array {
  const lines: string[] = ['%PDF-1.4'];

  // Catalog
  let catalog = '<< /Type /Catalog /Pages 2 0 R';
  catalog += ' >>';
  lines.push('1 0 obj', catalog, 'endobj');

  // Pages
  lines.push('2 0 obj', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'endobj');

  // Page
  lines.push(
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    'endobj',
  );

  if (options.javascript) {
    lines.push(
      '4 0 obj',
      '<< /S /JavaScript /JS (app.alert("hi")) >>',
      'endobj',
    );
  }

  if (options.transparency) {
    lines.push(
      '5 0 obj',
      '<< /Type /ExtGState /CA 0.5 /ca 0.3 /BM /Multiply >>',
      'endobj',
    );
  }

  if (options.xmp) {
    const xmpBlock =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">' +
      '<pdfaid:part>2</pdfaid:part>' +
      '<pdfaid:conformance>B</pdfaid:conformance>' +
      '</rdf:Description>' +
      '</rdf:RDF></x:xmpmeta>';
    lines.push(
      '6 0 obj',
      `<< /Type /Metadata /Subtype /XML /Length ${xmpBlock.length} >>`,
      'stream',
      xmpBlock,
      'endstream',
      'endobj',
    );
  }

  if (options.encrypt) {
    lines.push(
      '7 0 obj',
      '<< /Filter /Standard /V 2 /Length 128 >>',
      'endobj',
    );
  }

  // Trailer
  let trailer = '<< /Root 1 0 R';
  if (options.encrypt) trailer += ' /Encrypt 7 0 R';
  if (options.trailerId) trailer += ' /ID [<abc123> <def456>]';
  trailer += ' >>';

  lines.push('trailer', trailer, '%%EOF');
  return encoder.encode(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// enforcePdfAFull — basic behavior
// ---------------------------------------------------------------------------

describe('enforcePdfAFull', () => {
  it('returns a result with all expected fields', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    expect(result).toHaveProperty('bytes');
    expect(result).toHaveProperty('validation');
    expect(result).toHaveProperty('actions');
    expect(result).toHaveProperty('fullyCompliant');
    expect(result).toHaveProperty('remainingIssues');
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.isArray(result.actions)).toBe(true);
    expect(typeof result.fullyCompliant).toBe('boolean');
    expect(typeof result.remainingIssues).toBe('number');
  });

  it('adds XMP metadata when none is present', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    const text = decoder.decode(result.bytes);
    expect(text).toContain('pdfaid:part');
    expect(text).toContain('pdfaid:conformance');
    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(true);
  });

  it('injects correct part and conformance for level 1b', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '1b');
    const text = decoder.decode(result.bytes);
    expect(text).toContain('<pdfaid:part>1</pdfaid:part>');
    expect(text).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
  });

  it('injects correct part and conformance for level 3a', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '3a');
    const text = decoder.decode(result.bytes);
    expect(text).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(text).toContain('<pdfaid:conformance>A</pdfaid:conformance>');
  });

  it('adds file ID to trailer when missing', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    const text = decoder.decode(result.bytes);
    expect(text).toContain('/ID [');
    expect(result.actions.some(a => a.action === 'add-file-id')).toBe(true);
  });

  it('does not add file ID when already present', async () => {
    const pdf = buildPdf({ trailerId: true });
    const result = await enforcePdfAFull(pdf, '2b');
    expect(result.actions.some(a => a.action === 'add-file-id')).toBe(false);
  });

  it('does not add XMP when already present with pdfaid', async () => {
    const pdf = buildPdf({ xmp: true });
    const result = await enforcePdfAFull(pdf, '2b');
    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(false);
  });

  it('throws for encrypted documents', async () => {
    const pdf = buildPdf({ encrypt: true });
    await expect(enforcePdfAFull(pdf, '2b')).rejects.toThrow(
      /encrypted/i,
    );
  });
});

// ---------------------------------------------------------------------------
// enforcePdfAFull — pipeline steps
// ---------------------------------------------------------------------------

describe('enforcePdfAFull — pipeline steps', () => {
  it('strips JavaScript actions', async () => {
    const pdf = buildPdf({ javascript: true });
    const result = await enforcePdfAFull(pdf, '2b');
    const hasStripAction = result.actions.some(
      a => a.action === 'strip' && a.description.toLowerCase().includes('javascript'),
    );
    expect(hasStripAction).toBe(true);
  });

  it('flattens transparency for PDF/A-1 levels', async () => {
    const pdf = buildPdf({ transparency: true });
    const result = await enforcePdfAFull(pdf, '1b');
    const text = decoder.decode(result.bytes);
    // Transparency should be flattened for PDF/A-1
    const hasFlattenAction = result.actions.some(
      a => a.action === 'flatten-transparency',
    );
    expect(hasFlattenAction).toBe(true);
    // After flattening, CA and ca should be 1
    expect(text).not.toContain('/CA 0.5');
    expect(text).not.toContain('/ca 0.3');
  });

  it('does NOT flatten transparency for PDF/A-2 levels', async () => {
    const pdf = buildPdf({ transparency: true });
    const result = await enforcePdfAFull(pdf, '2b');
    const hasFlattenAction = result.actions.some(
      a => a.action === 'flatten-transparency',
    );
    expect(hasFlattenAction).toBe(false);
  });

  it('does NOT flatten transparency for PDF/A-3 levels', async () => {
    const pdf = buildPdf({ transparency: true });
    const result = await enforcePdfAFull(pdf, '3b');
    const hasFlattenAction = result.actions.some(
      a => a.action === 'flatten-transparency',
    );
    expect(hasFlattenAction).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enforcePdfAFull — options to disable steps
// ---------------------------------------------------------------------------

describe('enforcePdfAFull — option flags', () => {
  it('skips stripping when stripProhibited is false', async () => {
    const pdf = buildPdf({ javascript: true });
    const result = await enforcePdfAFull(pdf, '2b', {
      stripProhibited: false,
    });
    expect(result.actions.some(a => a.action === 'strip')).toBe(false);
  });

  it('skips transparency flattening when flattenTransparency is false', async () => {
    const pdf = buildPdf({ transparency: true });
    const result = await enforcePdfAFull(pdf, '1b', {
      flattenTransparency: false,
    });
    expect(result.actions.some(a => a.action === 'flatten-transparency')).toBe(false);
  });

  it('skips XMP when addXmpMetadata is false', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      addXmpMetadata: false,
    });
    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(false);
  });

  it('skips file ID when addFileId is false', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      addFileId: false,
    });
    expect(result.actions.some(a => a.action === 'add-file-id')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enforcePdfAFull — title and author
// ---------------------------------------------------------------------------

describe('enforcePdfAFull — metadata options', () => {
  it('includes title in XMP when specified', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      title: 'My Test Document',
    });
    const text = decoder.decode(result.bytes);
    expect(text).toContain('My Test Document');
    expect(text).toContain('dc:title');
  });

  it('includes author in XMP when specified', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      author: 'Jane Doe',
    });
    const text = decoder.decode(result.bytes);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('dc:creator');
  });

  it('uses custom language for title lang attribute', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      title: 'Mon Document',
      language: 'fr',
    });
    const text = decoder.decode(result.bytes);
    expect(text).toContain('xml:lang="fr"');
  });

  it('uses "en" as default language', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      title: 'My Doc',
    });
    const text = decoder.decode(result.bytes);
    expect(text).toContain('xml:lang="en"');
  });
});

// ---------------------------------------------------------------------------
// enforcePdfAFull — result shape
// ---------------------------------------------------------------------------

describe('enforcePdfAFull — result validation', () => {
  it('validation result contains issues array', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    expect(Array.isArray(result.validation.issues)).toBe(true);
    expect(result.validation).toHaveProperty('valid');
    expect(result.validation).toHaveProperty('level');
    expect(result.validation.level).toBe('2b');
  });

  it('remainingIssues counts only errors, not warnings', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    const errorCount = result.validation.issues.filter(
      i => i.severity === 'error',
    ).length;
    expect(result.remainingIssues).toBe(errorCount);
  });

  it('fullyCompliant is true when no error-level issues remain', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    if (result.remainingIssues === 0) {
      expect(result.fullyCompliant).toBe(true);
    } else {
      expect(result.fullyCompliant).toBe(false);
    }
  });

  it('actions have action and description strings', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');
    for (const action of result.actions) {
      expect(typeof action.action).toBe('string');
      expect(typeof action.description).toBe('string');
      expect(action.action.length).toBeGreaterThan(0);
      expect(action.description.length).toBeGreaterThan(0);
    }
  });
});

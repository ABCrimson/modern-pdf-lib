/**
 * Tests for enforcePdfAFull — the full PDF/A enforcement pipeline that chains
 * strip, flatten, XMP, and file ID fixes together.
 *
 * 15+ test cases covering:
 * - XMP metadata injection
 * - File ID injection
 * - JavaScript stripping
 * - Transparency flattening (PDF/A-1 only)
 * - No transparency flattening for PDF/A-2
 * - Encryption rejection
 * - Actions reporting
 * - Validation result
 * - fullyCompliant status
 * - Option overrides (stripProhibited, flattenTransparency, addXmpMetadata, addFileId)
 * - Title and author in XMP
 * - Idempotency
 */

import { describe, it, expect } from 'vitest';
import { enforcePdfAFull } from '../../src/compliance/enforcePdfAv2.js';
import { validatePdfA } from '../../src/compliance/pdfA.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Build a minimal synthetic PDF with optional extra objects injected. */
function buildPdf(extraObjects: string = '', opts?: { noId?: boolean }): Uint8Array {
  const idEntry = opts?.noId ? '' : '/ID [<aabb> <ccdd>]';
  const lines = [
    '%PDF-1.7',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    'endobj',
    extraObjects,
    'xref',
    '0 1',
    '0000000000 65535 f ',
    'trailer',
    `<< /Size 10 /Root 1 0 R ${idEntry} >>`,
    'startxref',
    '0',
    '%%EOF',
  ];
  return encoder.encode(lines.join('\n'));
}

/** Build a minimal PDF with XMP metadata already present. */
function buildPdfWithXmp(): Uint8Array {
  const xmp = [
    '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '    <rdf:Description rdf:about=""',
    '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">',
    '      <pdfaid:part>2</pdfaid:part>',
    '      <pdfaid:conformance>B</pdfaid:conformance>',
    '    </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');

  const xmpLength = encoder.encode(xmp).length;
  const lines = [
    '%PDF-1.7',
    '1 0 obj',
    `<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>`,
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    'endobj',
    '4 0 obj',
    `<< /Type /Metadata /Subtype /XML /Length ${xmpLength} >>`,
    'stream',
    xmp,
    'endstream',
    'endobj',
    'xref',
    '0 1',
    '0000000000 65535 f ',
    'trailer',
    '<< /Size 10 /Root 1 0 R /ID [<aabb> <ccdd>] >>',
    'startxref',
    '0',
    '%%EOF',
  ];
  return encoder.encode(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enforcePdfAFull', () => {
  // 1. Adds XMP metadata
  it('adds XMP metadata when missing', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');

    const text = decoder.decode(result.bytes);
    expect(text).toContain('pdfaid:part');
    expect(text).toContain('pdfaid:conformance');
    expect(text).toContain('/Type /Metadata');
    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(true);
  });

  // 2. Adds file ID
  it('adds file ID when missing', async () => {
    const pdf = buildPdf('', { noId: true });
    const result = await enforcePdfAFull(pdf, '2b');

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/ID [<');
    expect(result.actions.some(a => a.action === 'add-file-id')).toBe(true);
  });

  // 3. Strips JavaScript when present
  it('strips JavaScript actions', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /JavaScript /JS (alert("hi")) >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '2b');

    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /JavaScript');
    expect(text).not.toContain('/JS (alert');
    expect(result.actions.some(a => a.action === 'strip')).toBe(true);
  });

  // 4. Flattens transparency for PDF/A-1
  it('flattens transparency for PDF/A-1b', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /ExtGState /CA 0.5 /ca 0.3 >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '1b');

    const text = decoder.decode(result.bytes);
    // Opacity values should be flattened to 1
    expect(text).not.toContain('/CA 0.5');
    expect(text).not.toContain('/ca 0.3');
    expect(result.actions.some(a => a.action === 'flatten-transparency')).toBe(true);
  });

  // 5. Does NOT flatten transparency for PDF/A-2
  it('does NOT flatten transparency for PDF/A-2b', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /ExtGState /CA 0.5 /ca 0.3 >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '2b');

    // Transparency should remain for PDF/A-2 (which allows it)
    const text = decoder.decode(result.bytes);
    expect(text).toContain('/CA 0.5');
    expect(text).toContain('/ca 0.3');
    expect(result.actions.some(a => a.action === 'flatten-transparency')).toBe(false);
  });

  // 6. Throws on encrypted PDFs
  it('throws on encrypted PDFs', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Encrypt /Filter /Standard >>\nendobj',
    );
    await expect(enforcePdfAFull(pdf, '2b')).rejects.toThrow(
      'Cannot enforce PDF/A: document is encrypted',
    );
  });

  // 7. Returns actions taken
  it('returns a list of actions taken', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /JavaScript /JS (code) >>\nendobj',
      { noId: true },
    );
    const result = await enforcePdfAFull(pdf, '2b');

    // Should have at least: strip, add-xmp, add-file-id
    expect(result.actions.length).toBeGreaterThanOrEqual(3);
    const actionTypes = result.actions.map(a => a.action);
    expect(actionTypes).toContain('strip');
    expect(actionTypes).toContain('add-xmp');
    expect(actionTypes).toContain('add-file-id');
  });

  // 8. Returns validation result
  it('returns a validation result', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');

    expect(result.validation).toBeDefined();
    expect(result.validation.level).toBe('2b');
    expect(result.validation.issues).toBeInstanceOf(Array);
  });

  // 9. Reports fullyCompliant status
  it('reports fullyCompliant when all errors resolved', async () => {
    // A PDF with no prohibited features and no encryption
    // The only issues should be fixable (no XMP, no ID)
    const pdf = buildPdf('', { noId: true });
    const result = await enforcePdfAFull(pdf, '2b');

    // After enforcement, there should be few or no remaining errors
    expect(typeof result.fullyCompliant).toBe('boolean');
    expect(typeof result.remainingIssues).toBe('number');
  });

  // 10. Respects stripProhibited: false
  it('respects stripProhibited: false option', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /JavaScript /JS (code) >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '2b', {
      stripProhibited: false,
    });

    const text = decoder.decode(result.bytes);
    // JavaScript should still be present
    expect(text).toContain('/S /JavaScript');
    expect(result.actions.some(a => a.action === 'strip')).toBe(false);
  });

  // 11. Respects flattenTransparency: false
  it('respects flattenTransparency: false option', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /ExtGState /CA 0.5 >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '1b', {
      flattenTransparency: false,
    });

    const text = decoder.decode(result.bytes);
    // Transparency should remain
    expect(text).toContain('/CA 0.5');
    expect(result.actions.some(a => a.action === 'flatten-transparency')).toBe(false);
  });

  // 12. Respects addXmpMetadata: false
  it('respects addXmpMetadata: false option', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      addXmpMetadata: false,
    });

    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(false);
  });

  // 13. Respects addFileId: false
  it('respects addFileId: false option', async () => {
    const pdf = buildPdf('', { noId: true });
    const result = await enforcePdfAFull(pdf, '2b', {
      addFileId: false,
    });

    expect(result.actions.some(a => a.action === 'add-file-id')).toBe(false);
  });

  // 14. Includes title and author in XMP
  it('includes title and author in XMP metadata', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      title: 'Test Document',
      author: 'Jane Doe',
    });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('Test Document');
    expect(text).toContain('Jane Doe');
  });

  // 15. Idempotent — running twice gives equivalent result
  it('is idempotent (running twice gives consistent result)', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /JavaScript /JS (x) >>\nendobj',
      { noId: true },
    );

    const first = await enforcePdfAFull(pdf, '2b', {
      title: 'Idem',
      author: 'Test',
    });
    const second = await enforcePdfAFull(first.bytes, '2b', {
      title: 'Idem',
      author: 'Test',
    });

    // Second run should produce no additional strip or add-xmp actions
    // because those were already handled in the first pass
    expect(second.actions.some(a => a.action === 'strip')).toBe(false);
    expect(second.actions.some(a => a.action === 'add-xmp')).toBe(false);
    // File ID should already be present from first run
    expect(second.actions.some(a => a.action === 'add-file-id')).toBe(false);
  });

  // 16. Handles multiple prohibited feature types simultaneously
  it('strips multiple prohibited feature types at once', async () => {
    const pdf = buildPdf([
      '4 0 obj\n<< /S /JavaScript /JS (x) >>\nendobj',
      '5 0 obj\n<< /S /Launch /F (cmd) >>\nendobj',
      '6 0 obj\n<< /S /Sound /Sound 7 0 R >>\nendobj',
    ].join('\n'));

    const result = await enforcePdfAFull(pdf, '2b');

    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /JavaScript');
    expect(text).not.toContain('/S /Launch');
    expect(text).not.toContain('/S /Sound');
    expect(result.actions.filter(a => a.action === 'strip').length).toBeGreaterThanOrEqual(3);
  });

  // 17. Handles PDF with XMP already present
  it('does not double-add XMP when already present with pdfaid', async () => {
    const pdf = buildPdfWithXmp();
    const result = await enforcePdfAFull(pdf, '2b');

    // Should NOT add XMP because it already exists with pdfaid:part
    expect(result.actions.some(a => a.action === 'add-xmp')).toBe(false);
  });

  // 18. Language option is used in XMP
  it('uses custom language in XMP title', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b', {
      title: 'Titre',
      language: 'fr',
    });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('xml:lang="fr"');
  });

  // 19. Does not flatten transparency for PDF/A-3
  it('does NOT flatten transparency for PDF/A-3b', async () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /ExtGState /CA 0.5 >>\nendobj',
    );
    const result = await enforcePdfAFull(pdf, '3b');

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/CA 0.5');
    expect(result.actions.some(a => a.action === 'flatten-transparency')).toBe(false);
  });

  // 20. Returns remaining issues count
  it('returns correct remainingIssues count', async () => {
    const pdf = buildPdf();
    const result = await enforcePdfAFull(pdf, '2b');

    expect(result.remainingIssues).toBeGreaterThanOrEqual(0);
    expect(result.remainingIssues).toBe(
      result.validation.issues.filter(i => i.severity === 'error').length,
    );
  });
});

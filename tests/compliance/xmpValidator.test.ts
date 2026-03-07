/**
 * Tests for XMP metadata validation for PDF/A compliance.
 *
 * Covers:
 * - extractXmpMetadata: extraction from PDF bytes and missing XMP
 * - parseXmpMetadata: parsing individual fields and graceful missing-field handling
 * - validateXmpMetadata: error/warning detection for mandatory and recommended fields
 * - Integration with enforcePdfA: enforced PDFs pass XMP validation
 */

import { describe, it, expect } from 'vitest';
import {
  extractXmpMetadata,
  parseXmpMetadata,
  validateXmpMetadata,
} from '../../src/compliance/xmpValidator.js';
import { enforcePdfA } from '../../src/compliance/pdfA.js';
import { createPdf, PageSizes, rgb } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Build a full valid XMP block with PDF/A identification. */
function buildXmpBlock(options: {
  part?: number;
  conformance?: string;
  creatorTool?: string;
  createDate?: string;
  modifyDate?: string;
  producer?: string;
  title?: string;
  includeNamespace?: boolean;
} = {}): string {
  const {
    part,
    conformance,
    creatorTool,
    createDate,
    modifyDate,
    producer,
    title,
    includeNamespace = true,
  } = options;

  const namespaces = [
    'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    includeNamespace ? 'xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"' : '',
    'xmlns:dc="http://purl.org/dc/elements/1.1/"',
    'xmlns:xmp="http://ns.adobe.com/xap/1.0/"',
    'xmlns:pdf="http://ns.adobe.com/pdf/1.3/"',
  ].filter(Boolean).join('\n      ');

  const fields: string[] = [];
  if (part !== undefined) fields.push(`      <pdfaid:part>${part}</pdfaid:part>`);
  if (conformance !== undefined) fields.push(`      <pdfaid:conformance>${conformance}</pdfaid:conformance>`);
  if (creatorTool !== undefined) fields.push(`      <xmp:CreatorTool>${creatorTool}</xmp:CreatorTool>`);
  if (createDate !== undefined) fields.push(`      <xmp:CreateDate>${createDate}</xmp:CreateDate>`);
  if (modifyDate !== undefined) fields.push(`      <xmp:ModifyDate>${modifyDate}</xmp:ModifyDate>`);
  if (producer !== undefined) fields.push(`      <pdf:Producer>${producer}</pdf:Producer>`);
  if (title !== undefined) {
    fields.push(`      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>`);
  }

  return [
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    `  <rdf:RDF ${namespaces}>`,
    '    <rdf:Description rdf:about="">',
    ...fields,
    '    </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
  ].join('\n');
}

/** Wrap an XMP block in synthetic PDF bytes. */
function buildPdfWithXmp(xmpBlock: string): Uint8Array {
  const lines = [
    '%PDF-1.7',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    'endobj',
    '4 0 obj',
    `<< /Type /Metadata /Subtype /XML /Length ${xmpBlock.length} >>`,
    'stream',
    xmpBlock,
    'endstream',
    'endobj',
    'xref',
    '0 1',
    '0000000000 65535 f ',
    'trailer',
    '<< /Size 5 /Root 1 0 R /ID [<abc123> <def456>] >>',
    'startxref',
    '0',
    '%%EOF',
  ];
  return encoder.encode(lines.join('\n'));
}

/** Build a minimal PDF without XMP metadata. */
function buildPdfWithoutXmp(): Uint8Array {
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
    'xref',
    '0 1',
    '0000000000 65535 f ',
    'trailer',
    '<< /Size 4 /Root 1 0 R >>',
    'startxref',
    '0',
    '%%EOF',
  ];
  return encoder.encode(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// extractXmpMetadata
// ---------------------------------------------------------------------------

describe('extractXmpMetadata', () => {
  it('returns undefined when no XMP is present', () => {
    const pdf = buildPdfWithoutXmp();
    const result = extractXmpMetadata(pdf);
    expect(result).toBeUndefined();
  });

  it('extracts XMP from PDF bytes', () => {
    const xmp = buildXmpBlock({ part: 2, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = extractXmpMetadata(pdf);
    expect(result).toBeDefined();
    expect(result).toContain('<x:xmpmeta');
    expect(result).toContain('</x:xmpmeta>');
    expect(result).toContain('pdfaid:part');
  });

  it('returns undefined for truncated XMP (missing closing tag)', () => {
    const partial = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF>';
    const pdf = encoder.encode(`%PDF-1.7\n${partial}\n%%EOF`);
    const result = extractXmpMetadata(pdf);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseXmpMetadata
// ---------------------------------------------------------------------------

describe('parseXmpMetadata', () => {
  it('extracts pdfaid:part', () => {
    const xmp = buildXmpBlock({ part: 1 });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.pdfaidPart).toBe(1);
  });

  it('extracts pdfaid:conformance', () => {
    const xmp = buildXmpBlock({ conformance: 'A' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.pdfaidConformance).toBe('A');
  });

  it('extracts xmp:CreatorTool', () => {
    const xmp = buildXmpBlock({ creatorTool: 'modern-pdf-lib' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.xmpCreatorTool).toBe('modern-pdf-lib');
  });

  it('extracts xmp:CreateDate', () => {
    const xmp = buildXmpBlock({ createDate: '2026-03-07T12:00:00Z' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.xmpCreateDate).toBe('2026-03-07T12:00:00Z');
  });

  it('extracts xmp:ModifyDate', () => {
    const xmp = buildXmpBlock({ modifyDate: '2026-03-07T13:00:00Z' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.xmpModifyDate).toBe('2026-03-07T13:00:00Z');
  });

  it('extracts pdf:Producer', () => {
    const xmp = buildXmpBlock({ producer: 'TestProducer' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.pdfProducer).toBe('TestProducer');
  });

  it('extracts dc:title', () => {
    const xmp = buildXmpBlock({ title: 'My Document' });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.dcTitle).toBe('My Document');
  });

  it('handles missing fields gracefully', () => {
    const xmp = buildXmpBlock({});
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.pdfaidPart).toBeUndefined();
    expect(metadata.pdfaidConformance).toBeUndefined();
    expect(metadata.xmpCreatorTool).toBeUndefined();
    expect(metadata.xmpCreateDate).toBeUndefined();
    expect(metadata.xmpModifyDate).toBeUndefined();
    expect(metadata.pdfProducer).toBeUndefined();
    expect(metadata.dcTitle).toBeUndefined();
    expect(metadata.raw).toBe(xmp);
  });

  it('extracts all fields simultaneously', () => {
    const xmp = buildXmpBlock({
      part: 3,
      conformance: 'U',
      creatorTool: 'TestTool',
      createDate: '2026-01-01T00:00:00Z',
      modifyDate: '2026-02-01T00:00:00Z',
      producer: 'TestProducer',
      title: 'Full Metadata',
    });
    const metadata = parseXmpMetadata(xmp);
    expect(metadata.pdfaidPart).toBe(3);
    expect(metadata.pdfaidConformance).toBe('U');
    expect(metadata.xmpCreatorTool).toBe('TestTool');
    expect(metadata.xmpCreateDate).toBe('2026-01-01T00:00:00Z');
    expect(metadata.xmpModifyDate).toBe('2026-02-01T00:00:00Z');
    expect(metadata.pdfProducer).toBe('TestProducer');
    expect(metadata.dcTitle).toBe('Full Metadata');
  });
});

// ---------------------------------------------------------------------------
// validateXmpMetadata
// ---------------------------------------------------------------------------

describe('validateXmpMetadata', () => {
  it('reports error when no XMP is present', () => {
    const pdf = buildPdfWithoutXmp();
    const result = validateXmpMetadata(pdf, '1b');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'XMP-001')).toBe(true);
  });

  it('reports error for missing pdfaid:part', () => {
    const xmp = buildXmpBlock({ conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'XMP-002')).toBe(true);
  });

  it('reports error for wrong pdfaid:part', () => {
    const xmp = buildXmpBlock({ part: 1, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'XMP-003');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('1');
    expect(issue!.message).toContain('2');
  });

  it('reports error for missing pdfaid:conformance', () => {
    const xmp = buildXmpBlock({ part: 2 });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'XMP-004')).toBe(true);
  });

  it('reports error for wrong pdfaid:conformance', () => {
    const xmp = buildXmpBlock({ part: 2, conformance: 'A' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'XMP-005');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('"A"');
    expect(issue!.message).toContain('"B"');
  });

  it('reports error for missing pdfaid namespace declaration', () => {
    const xmp = buildXmpBlock({ part: 2, conformance: 'B', includeNamespace: false });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    const issue = result.issues.find((i) => i.code === 'XMP-006');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
  });

  it('reports warning for missing CreatorTool', () => {
    const xmp = buildXmpBlock({ part: 2, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    const issue = result.issues.find((i) => i.code === 'XMP-007');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('reports warning for missing CreateDate', () => {
    const xmp = buildXmpBlock({ part: 2, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    const issue = result.issues.find((i) => i.code === 'XMP-008');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('reports warning for missing ModifyDate', () => {
    const xmp = buildXmpBlock({ part: 1, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '1b');
    const issue = result.issues.find((i) => i.code === 'XMP-009');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('reports warning for missing Producer', () => {
    const xmp = buildXmpBlock({ part: 1, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '1b');
    const issue = result.issues.find((i) => i.code === 'XMP-010');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('reports warning for missing dc:title', () => {
    const xmp = buildXmpBlock({ part: 1, conformance: 'B' });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '1b');
    const issue = result.issues.find((i) => i.code === 'XMP-011');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('passes for fully valid XMP metadata', () => {
    const xmp = buildXmpBlock({
      part: 2,
      conformance: 'B',
      creatorTool: 'modern-pdf-lib',
      createDate: '2026-03-07T12:00:00Z',
      modifyDate: '2026-03-07T12:00:00Z',
      producer: 'modern-pdf-lib',
      title: 'Test Document',
    });
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(result.metadata.pdfaidPart).toBe(2);
    expect(result.metadata.pdfaidConformance).toBe('B');
  });

  it('issues include correct namespace and property fields', () => {
    const xmp = buildXmpBlock({});
    const pdf = buildPdfWithXmp(xmp);
    const result = validateXmpMetadata(pdf, '1b');

    const partIssue = result.issues.find((i) => i.code === 'XMP-002');
    expect(partIssue).toBeDefined();
    expect(partIssue!.namespace).toBe('pdfaid');
    expect(partIssue!.property).toBe('part');

    const creatorIssue = result.issues.find((i) => i.code === 'XMP-007');
    expect(creatorIssue).toBeDefined();
    expect(creatorIssue!.namespace).toBe('xmp');
    expect(creatorIssue!.property).toBe('CreatorTool');
  });

  it('validates different conformance levels correctly', () => {
    const xmp = buildXmpBlock({ part: 3, conformance: 'U' });
    const pdf = buildPdfWithXmp(xmp);

    const result3u = validateXmpMetadata(pdf, '3u');
    const partIssues = result3u.issues.filter((i) => i.code === 'XMP-002' || i.code === 'XMP-003');
    const confIssues = result3u.issues.filter((i) => i.code === 'XMP-004' || i.code === 'XMP-005');
    expect(partIssues).toHaveLength(0);
    expect(confIssues).toHaveLength(0);

    // Same XMP validated as 1a should fail
    const result1a = validateXmpMetadata(pdf, '1a');
    expect(result1a.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: enforcePdfA + XMP validation
// ---------------------------------------------------------------------------

describe('enforcePdfA + XMP validation integration', () => {
  it('enforced PDF passes XMP validation', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    page.drawText('XMP Validation Test', { x: 50, y: 750, size: 18, color: rgb(0, 0, 0) });
    const bytes = await doc.save();

    const enforced = await enforcePdfA(bytes, '1b');
    const result = validateXmpMetadata(enforced, '1b');

    // Should have no errors (pdfaid:part and pdfaid:conformance are set)
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(result.valid).toBe(true);
    expect(result.metadata.pdfaidPart).toBe(1);
    expect(result.metadata.pdfaidConformance).toBe('B');
    expect(result.metadata.xmpCreatorTool).toBe('modern-pdf-lib');
  });
});

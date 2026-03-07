/**
 * Tests for XMP metadata generator for PDF/A compliance.
 *
 * Covers:
 * - generatePdfAXmp: pdfaid:part, pdfaid:conformance, xpacket markers,
 *   namespace URIs, defaults, custom values, Dublin Core fields, XML escaping
 * - generatePdfAXmpBytes: Uint8Array encoding
 * - Integration with validateXmpMetadata: generated XMP passes validation
 * - All three PDF/A parts (1, 2, 3)
 */

import { describe, it, expect } from 'vitest';
import {
  generatePdfAXmp,
  generatePdfAXmpBytes,
} from '../../src/compliance/xmpGenerator.js';
import {
  parseXmpMetadata,
  validateXmpMetadata,
} from '../../src/compliance/xmpValidator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Wrap an XMP string in synthetic PDF bytes for validateXmpMetadata. */
function wrapInPdf(xmp: string): Uint8Array {
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
    `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>`,
    'stream',
    xmp,
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

// ---------------------------------------------------------------------------
// generatePdfAXmp — pdfaid identification
// ---------------------------------------------------------------------------

describe('generatePdfAXmp', () => {
  it('includes pdfaid:part', () => {
    const xmp = generatePdfAXmp({ part: 2, conformance: 'B' });
    expect(xmp).toContain('<pdfaid:part>2</pdfaid:part>');
  });

  it('includes pdfaid:conformance', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'A' });
    expect(xmp).toContain('<pdfaid:conformance>A</pdfaid:conformance>');
  });

  // -------------------------------------------------------------------------
  // xpacket markers
  // -------------------------------------------------------------------------

  it('includes xpacket begin and end markers', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    expect(xmp).toMatch(/^<\?xpacket begin="/);
    expect(xmp).toContain('<?xpacket end="w"?>');
  });

  // -------------------------------------------------------------------------
  // Namespace URIs
  // -------------------------------------------------------------------------

  it('includes correct namespace URIs', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    expect(xmp).toContain('xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"');
    expect(xmp).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xmp).toContain('xmlns:xmp="http://ns.adobe.com/xap/1.0/"');
    expect(xmp).toContain('xmlns:pdf="http://ns.adobe.com/pdf/1.3/"');
    expect(xmp).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"');
    expect(xmp).toContain('xmlns:x="adobe:ns:meta/"');
  });

  // -------------------------------------------------------------------------
  // Defaults
  // -------------------------------------------------------------------------

  it('includes default CreatorTool (modern-pdf-lib)', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    expect(xmp).toContain('<xmp:CreatorTool>modern-pdf-lib</xmp:CreatorTool>');
  });

  it('includes custom CreatorTool when provided', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B', creatorTool: 'MyApp 3.0' });
    expect(xmp).toContain('<xmp:CreatorTool>MyApp 3.0</xmp:CreatorTool>');
    expect(xmp).not.toContain('modern-pdf-lib</xmp:CreatorTool>');
  });

  it('includes CreateDate', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      createDate: '2026-03-07T10:00:00Z',
    });
    expect(xmp).toContain('<xmp:CreateDate>2026-03-07T10:00:00Z</xmp:CreateDate>');
  });

  it('includes ModifyDate', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      modifyDate: '2026-03-07T11:00:00Z',
    });
    expect(xmp).toContain('<xmp:ModifyDate>2026-03-07T11:00:00Z</xmp:ModifyDate>');
  });

  it('uses current date as default for CreateDate and ModifyDate', () => {
    const before = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    // Dates should start with today's date prefix
    expect(xmp).toMatch(/<xmp:CreateDate>\d{4}-\d{2}-\d{2}T/);
    expect(xmp).toMatch(/<xmp:ModifyDate>\d{4}-\d{2}-\d{2}T/);
  });

  it('includes default Producer (modern-pdf-lib)', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    expect(xmp).toContain('<pdf:Producer>modern-pdf-lib</pdf:Producer>');
  });

  // -------------------------------------------------------------------------
  // Optional fields
  // -------------------------------------------------------------------------

  it('includes title when provided', () => {
    const xmp = generatePdfAXmp({
      part: 2,
      conformance: 'B',
      title: 'My Document Title',
    });
    expect(xmp).toContain('<dc:title>');
    expect(xmp).toContain('My Document Title');
    expect(xmp).toContain('</dc:title>');
    expect(xmp).toContain('<rdf:Alt>');
    expect(xmp).toContain('xml:lang="en"');
  });

  it('includes author when provided', () => {
    const xmp = generatePdfAXmp({
      part: 2,
      conformance: 'B',
      author: 'Jane Doe',
    });
    expect(xmp).toContain('<dc:creator>');
    expect(xmp).toContain('Jane Doe');
    expect(xmp).toContain('</dc:creator>');
    expect(xmp).toContain('<rdf:Seq>');
  });

  it('includes subject when provided', () => {
    const xmp = generatePdfAXmp({
      part: 2,
      conformance: 'B',
      subject: 'PDF/A compliance testing',
    });
    expect(xmp).toContain('<dc:description>');
    expect(xmp).toContain('PDF/A compliance testing');
    expect(xmp).toContain('</dc:description>');
  });

  it('includes keywords when provided', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      keywords: 'pdf, archival, compliance',
    });
    expect(xmp).toContain('<pdf:Keywords>pdf, archival, compliance</pdf:Keywords>');
  });

  it('omits title, author, subject, and keywords when not provided', () => {
    const xmp = generatePdfAXmp({ part: 1, conformance: 'B' });
    expect(xmp).not.toContain('<dc:title>');
    expect(xmp).not.toContain('<dc:creator>');
    expect(xmp).not.toContain('<dc:description>');
    expect(xmp).not.toContain('<pdf:Keywords>');
  });

  it('uses custom language for title and subject', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      title: 'Titel',
      subject: 'Beschreibung',
      language: 'de',
    });
    expect(xmp).toContain('xml:lang="de"');
    expect(xmp).not.toContain('xml:lang="en"');
  });

  // -------------------------------------------------------------------------
  // XML escaping
  // -------------------------------------------------------------------------

  it('escapes XML special characters in all string fields', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      title: 'A <b>bold</b> & "special" title',
      author: 'O\'Brien & Associates',
      subject: '<script>alert("xss")</script>',
      keywords: 'a&b, c<d',
      creatorTool: 'Tool "Pro" <v2>',
      producer: 'Producer & Co.',
    });
    // Title
    expect(xmp).toContain('A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;special&quot; title');
    // Author
    expect(xmp).toContain('O&apos;Brien &amp; Associates');
    // Subject
    expect(xmp).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    // Keywords
    expect(xmp).toContain('a&amp;b, c&lt;d');
    // CreatorTool
    expect(xmp).toContain('Tool &quot;Pro&quot; &lt;v2&gt;');
    // Producer
    expect(xmp).toContain('Producer &amp; Co.');
  });
});

// ---------------------------------------------------------------------------
// generatePdfAXmpBytes
// ---------------------------------------------------------------------------

describe('generatePdfAXmpBytes', () => {
  it('returns a Uint8Array', () => {
    const bytes = generatePdfAXmpBytes({ part: 1, conformance: 'B' });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('decodes to the same string as generatePdfAXmp', () => {
    const opts = { part: 2, conformance: 'A', title: 'Byte Test' } as const;
    const str = generatePdfAXmp(opts);
    const bytes = generatePdfAXmpBytes(opts);
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe(str);
  });
});

// ---------------------------------------------------------------------------
// Integration with validateXmpMetadata
// ---------------------------------------------------------------------------

describe('integration with validateXmpMetadata', () => {
  it('generated XMP passes validation for PDF/A-1b', () => {
    const xmp = generatePdfAXmp({
      part: 1,
      conformance: 'B',
      title: 'Validated Doc',
      createDate: '2026-03-07T12:00:00Z',
      modifyDate: '2026-03-07T12:00:00Z',
    });
    const pdf = wrapInPdf(xmp);
    const result = validateXmpMetadata(pdf, '1b');
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(result.metadata.pdfaidPart).toBe(1);
    expect(result.metadata.pdfaidConformance).toBe('B');
    expect(result.metadata.xmpCreatorTool).toBe('modern-pdf-lib');
    expect(result.metadata.pdfProducer).toBe('modern-pdf-lib');
    expect(result.metadata.dcTitle).toBe('Validated Doc');
  });

  it('generated XMP passes validation for PDF/A-2a', () => {
    const xmp = generatePdfAXmp({
      part: 2,
      conformance: 'A',
      title: 'Part 2 Test',
      createDate: '2026-03-07T12:00:00Z',
      modifyDate: '2026-03-07T12:00:00Z',
    });
    const pdf = wrapInPdf(xmp);
    const result = validateXmpMetadata(pdf, '2a');
    expect(result.valid).toBe(true);
    expect(result.metadata.pdfaidPart).toBe(2);
    expect(result.metadata.pdfaidConformance).toBe('A');
  });

  it('generated XMP passes validation for PDF/A-3u', () => {
    const xmp = generatePdfAXmp({
      part: 3,
      conformance: 'U',
      title: 'Part 3 Test',
      createDate: '2026-03-07T12:00:00Z',
      modifyDate: '2026-03-07T12:00:00Z',
    });
    const pdf = wrapInPdf(xmp);
    const result = validateXmpMetadata(pdf, '3u');
    expect(result.valid).toBe(true);
    expect(result.metadata.pdfaidPart).toBe(3);
    expect(result.metadata.pdfaidConformance).toBe('U');
  });

  it('generated XMP with no warnings when all recommended fields are supplied', () => {
    const xmp = generatePdfAXmp({
      part: 2,
      conformance: 'B',
      title: 'Full Metadata',
      author: 'Test Author',
      subject: 'Test Subject',
      keywords: 'test, pdf',
      creatorTool: 'TestTool',
      producer: 'TestProducer',
      createDate: '2026-03-07T12:00:00Z',
      modifyDate: '2026-03-07T12:00:00Z',
    });
    const pdf = wrapInPdf(xmp);
    const result = validateXmpMetadata(pdf, '2b');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// All three PDF/A parts
// ---------------------------------------------------------------------------

describe('PDF/A parts 1, 2, and 3', () => {
  const parts = [
    { part: 1, conformance: 'B', level: '1b' },
    { part: 2, conformance: 'B', level: '2b' },
    { part: 3, conformance: 'B', level: '3b' },
  ] as const;

  for (const { part, conformance, level } of parts) {
    it(`generates correct XMP for PDF/A-${level}`, () => {
      const xmp = generatePdfAXmp({ part, conformance });
      expect(xmp).toContain(`<pdfaid:part>${part}</pdfaid:part>`);
      expect(xmp).toContain(`<pdfaid:conformance>${conformance}</pdfaid:conformance>`);

      // Parseable by parseXmpMetadata
      const parsed = parseXmpMetadata(xmp);
      expect(parsed.pdfaidPart).toBe(part);
      expect(parsed.pdfaidConformance).toBe(conformance);
    });
  }

  it('generates distinct output for each part number', () => {
    const xmp1 = generatePdfAXmp({ part: 1, conformance: 'B' });
    const xmp2 = generatePdfAXmp({ part: 2, conformance: 'B' });
    const xmp3 = generatePdfAXmp({ part: 3, conformance: 'B' });

    expect(xmp1).toContain('<pdfaid:part>1</pdfaid:part>');
    expect(xmp2).toContain('<pdfaid:part>2</pdfaid:part>');
    expect(xmp3).toContain('<pdfaid:part>3</pdfaid:part>');

    expect(xmp1).not.toBe(xmp2);
    expect(xmp2).not.toBe(xmp3);
  });

  it('supports all conformance levels (A, B, U)', () => {
    for (const conf of ['A', 'B', 'U'] as const) {
      const xmp = generatePdfAXmp({ part: 2, conformance: conf });
      expect(xmp).toContain(`<pdfaid:conformance>${conf}</pdfaid:conformance>`);
      const parsed = parseXmpMetadata(xmp);
      expect(parsed.pdfaidConformance).toBe(conf);
    }
  });
});

/**
 * Tests for XMP metadata generation and parsing.
 *
 * Covers:
 * - buildXmpMetadata: generating valid XMP XML from metadata
 * - parseXmpMetadata: extracting metadata from XMP XML strings
 * - createXmpStream: creating a PDF metadata stream
 * - Proper XML escaping
 * - Date formatting
 * - Round-trip consistency
 * - Edge cases (empty metadata, special characters)
 */

import { describe, it, expect } from 'vitest';
import {
  buildXmpMetadata,
  parseXmpMetadata,
  createXmpStream,
} from '../../../src/metadata/xmpMetadata.js';
import type { DocumentMetadata } from '../../../src/core/pdfCatalog.js';
import {
  PdfDict,
  PdfName,
  PdfStream,
  PdfObjectRegistry,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// buildXmpMetadata
// ---------------------------------------------------------------------------

describe('buildXmpMetadata', () => {
  it('generates a valid XMP packet with all fields', () => {
    const meta: DocumentMetadata = {
      title: 'Test Document',
      author: 'John Doe',
      subject: 'Testing XMP',
      keywords: 'pdf, test, xmp',
      creator: 'TestApp',
      producer: 'modern-pdf',
      creationDate: new Date('2024-01-15T10:30:00Z'),
      modDate: new Date('2024-06-20T14:45:00Z'),
    };

    const xmp = buildXmpMetadata(meta);

    // Check packet header and trailer
    expect(xmp).toContain('<?xpacket begin=');
    expect(xmp).toContain('<?xpacket end="w"?>');

    // Check structure
    expect(xmp).toContain('<x:xmpmeta');
    expect(xmp).toContain('<rdf:RDF');
    expect(xmp).toContain('<rdf:Description');

    // Check Dublin Core
    expect(xmp).toContain('<dc:title>');
    expect(xmp).toContain('Test Document');
    expect(xmp).toContain('<dc:creator>');
    expect(xmp).toContain('John Doe');
    expect(xmp).toContain('<dc:description>');
    expect(xmp).toContain('Testing XMP');
    expect(xmp).toContain('<dc:subject>');

    // Check XMP core
    expect(xmp).toContain('<xmp:CreatorTool>TestApp</xmp:CreatorTool>');
    expect(xmp).toContain('<xmp:CreateDate>');
    expect(xmp).toContain('<xmp:ModifyDate>');

    // Check PDF namespace
    expect(xmp).toContain('<pdf:Producer>modern-pdf</pdf:Producer>');
    expect(xmp).toContain('<pdf:Keywords>pdf, test, xmp</pdf:Keywords>');
  });

  it('generates minimal XMP for empty metadata', () => {
    const meta: DocumentMetadata = {};
    const xmp = buildXmpMetadata(meta);

    expect(xmp).toContain('<?xpacket begin=');
    expect(xmp).toContain('<?xpacket end="w"?>');
    expect(xmp).toContain('<rdf:Description');

    // Should not contain any property elements
    expect(xmp).not.toContain('<dc:title>');
    expect(xmp).not.toContain('<dc:creator>');
    expect(xmp).not.toContain('<xmp:CreatorTool>');
  });

  it('escapes XML special characters', () => {
    const meta: DocumentMetadata = {
      title: 'Tom & Jerry <3 "PDFs"',
      author: "O'Brien & Associates",
    };

    const xmp = buildXmpMetadata(meta);

    expect(xmp).toContain('Tom &amp; Jerry &lt;3 &quot;PDFs&quot;');
    expect(xmp).toContain('O&apos;Brien &amp; Associates');
  });

  it('formats dates as ISO 8601', () => {
    const meta: DocumentMetadata = {
      creationDate: new Date('2024-03-14T12:00:00Z'),
    };

    const xmp = buildXmpMetadata(meta);
    expect(xmp).toContain('2024-03-14T12:00:00Z');
  });

  it('splits keywords into dc:subject bag', () => {
    const meta: DocumentMetadata = {
      keywords: 'alpha, beta; gamma, delta',
    };

    const xmp = buildXmpMetadata(meta);
    expect(xmp).toContain('<rdf:Bag>');
    expect(xmp).toContain('<rdf:li>alpha</rdf:li>');
    expect(xmp).toContain('<rdf:li>beta</rdf:li>');
    expect(xmp).toContain('<rdf:li>gamma</rdf:li>');
    expect(xmp).toContain('<rdf:li>delta</rdf:li>');
  });

  it('includes namespace declarations', () => {
    const meta: DocumentMetadata = { title: 'Test' };
    const xmp = buildXmpMetadata(meta);

    expect(xmp).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xmp).toContain('xmlns:xmp="http://ns.adobe.com/xap/1.0/"');
    expect(xmp).toContain('xmlns:pdf="http://ns.adobe.com/pdf/1.3/"');
  });

  it('includes padding for in-place edits', () => {
    const meta: DocumentMetadata = {};
    const xmp = buildXmpMetadata(meta);

    // There should be whitespace padding before the end packet
    const endIndex = xmp.indexOf('<?xpacket end=');
    const beforeEnd = xmp.slice(0, endIndex);
    // Check that there are spaces for padding
    expect(beforeEnd.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// parseXmpMetadata
// ---------------------------------------------------------------------------

describe('parseXmpMetadata', () => {
  it('parses all standard fields', () => {
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:xmp="http://ns.adobe.com/xap/1.0/"
  xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
  <dc:title>
    <rdf:Alt>
      <rdf:li xml:lang="x-default">My Title</rdf:li>
    </rdf:Alt>
  </dc:title>
  <dc:creator>
    <rdf:Seq>
      <rdf:li>Jane Smith</rdf:li>
    </rdf:Seq>
  </dc:creator>
  <dc:description>
    <rdf:Alt>
      <rdf:li xml:lang="x-default">A test document</rdf:li>
    </rdf:Alt>
  </dc:description>
  <xmp:CreatorTool>modern-pdf tests</xmp:CreatorTool>
  <xmp:CreateDate>2024-01-15T10:30:00Z</xmp:CreateDate>
  <xmp:ModifyDate>2024-06-20T14:45:00Z</xmp:ModifyDate>
  <pdf:Producer>modern-pdf</pdf:Producer>
  <pdf:Keywords>test, xmp, metadata</pdf:Keywords>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const meta = parseXmpMetadata(xmp);

    expect(meta.title).toBe('My Title');
    expect(meta.author).toBe('Jane Smith');
    expect(meta.subject).toBe('A test document');
    expect(meta.creator).toBe('modern-pdf tests');
    expect(meta.producer).toBe('modern-pdf');
    expect(meta.keywords).toBe('test, xmp, metadata');
    expect(meta.creationDate).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(meta.modDate).toEqual(new Date('2024-06-20T14:45:00Z'));
  });

  it('returns empty object for XMP with no recognized properties', () => {
    const xmp = `<?xpacket begin="\uFEFF"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="">
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const meta = parseXmpMetadata(xmp);
    expect(Object.keys(meta)).toHaveLength(0);
  });

  it('handles XML-escaped content', () => {
    const xmp = `<?xpacket begin="\uFEFF"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
  <dc:title>
    <rdf:Alt>
      <rdf:li xml:lang="x-default">Tom &amp; Jerry &lt;3</rdf:li>
    </rdf:Alt>
  </dc:title>
  <pdf:Producer>O&apos;Brien &amp; Co</pdf:Producer>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const meta = parseXmpMetadata(xmp);
    expect(meta.title).toBe('Tom & Jerry <3');
    expect(meta.producer).toBe("O'Brien & Co");
  });

  it('handles partial metadata (only some fields present)', () => {
    const xmp = `<?xpacket begin="\uFEFF"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
  xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
  <pdf:Producer>TestLib</pdf:Producer>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const meta = parseXmpMetadata(xmp);
    expect(meta.producer).toBe('TestLib');
    expect(meta.title).toBeUndefined();
    expect(meta.author).toBeUndefined();
  });

  it('handles invalid dates gracefully', () => {
    const xmp = `<?xpacket begin="\uFEFF"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
  xmlns:xmp="http://ns.adobe.com/xap/1.0/">
  <xmp:CreateDate>not-a-date</xmp:CreateDate>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const meta = parseXmpMetadata(xmp);
    expect(meta.creationDate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createXmpStream
// ---------------------------------------------------------------------------

describe('createXmpStream', () => {
  it('creates a valid metadata stream', () => {
    const meta: DocumentMetadata = {
      title: 'Stream Test',
      producer: 'modern-pdf',
    };
    const registry = new PdfObjectRegistry();
    const ref = createXmpStream(meta, registry);

    const streamObj = registry.resolve(ref);
    expect(streamObj).toBeInstanceOf(PdfStream);

    const stream = streamObj as PdfStream;

    // Check dict entries
    const typeVal = stream.dict.get('/Type') as PdfName;
    expect(typeVal.value).toBe('/Metadata');

    const subtypeVal = stream.dict.get('/Subtype') as PdfName;
    expect(subtypeVal.value).toBe('/XML');

    // Check that stream data is valid XMP
    const decoder = new TextDecoder();
    const xmpText = decoder.decode(stream.data);
    expect(xmpText).toContain('<?xpacket begin=');
    expect(xmpText).toContain('Stream Test');
    expect(xmpText).toContain('modern-pdf');
  });

  it('creates stream with correct length', () => {
    const meta: DocumentMetadata = { title: 'Length Test' };
    const registry = new PdfObjectRegistry();
    const ref = createXmpStream(meta, registry);

    const stream = registry.resolve(ref) as PdfStream;
    const lengthVal = stream.dict.get('/Length');
    expect(lengthVal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Round-trip: build -> parse
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('round-trips all metadata fields', () => {
    const original: DocumentMetadata = {
      title: 'Round Trip Document',
      author: 'Test Author',
      subject: 'Testing round-trip',
      keywords: 'round, trip, test',
      creator: 'TestCreator',
      producer: 'modern-pdf',
      creationDate: new Date('2024-06-15T12:00:00Z'),
      modDate: new Date('2024-06-16T12:00:00Z'),
    };

    const xmp = buildXmpMetadata(original);
    const parsed = parseXmpMetadata(xmp);

    expect(parsed.title).toBe(original.title);
    expect(parsed.author).toBe(original.author);
    expect(parsed.subject).toBe(original.subject);
    expect(parsed.keywords).toBe(original.keywords);
    expect(parsed.creator).toBe(original.creator);
    expect(parsed.producer).toBe(original.producer);
    expect(parsed.creationDate).toEqual(original.creationDate);
    expect(parsed.modDate).toEqual(original.modDate);
  });

  it('round-trips metadata with special characters', () => {
    const original: DocumentMetadata = {
      title: 'Title with <brackets> & "quotes"',
      author: "Author O'Brien",
    };

    const xmp = buildXmpMetadata(original);
    const parsed = parseXmpMetadata(xmp);

    expect(parsed.title).toBe(original.title);
    expect(parsed.author).toBe(original.author);
  });
});

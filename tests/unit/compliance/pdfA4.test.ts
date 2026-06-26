/**
 * @module tests/unit/compliance/pdfA4
 *
 * Unit tests for PDF/A-4 conformance metadata generation (ISO 19005-4).
 */

import { describe, it, expect } from 'vitest';

import {
  buildPdfA4Xmp,
  pdfA4Rules,
  type PdfA4ExtensionSchema,
} from '../../../src/compliance/pdfA4.js';

describe('buildPdfA4Xmp', () => {
  it('declares the pdfaid namespace, part 4, and rev 2020', () => {
    const xmp = buildPdfA4Xmp();
    expect(xmp).toContain('xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"');
    expect(xmp).toContain('<pdfaid:part>4</pdfaid:part>');
    expect(xmp).toContain('<pdfaid:rev>2020</pdfaid:rev>');
  });

  it('omits pdfaid:conformance for the base PDF/A-4 level', () => {
    const xmp = buildPdfA4Xmp({ level: 'PDF/A-4' });
    expect(xmp).not.toContain('pdfaid:conformance');
  });

  it('sets conformance E for PDF/A-4e', () => {
    const xmp = buildPdfA4Xmp({ level: 'PDF/A-4e' });
    expect(xmp).toContain('<pdfaid:conformance>E</pdfaid:conformance>');
  });

  it('sets conformance F for PDF/A-4f', () => {
    const xmp = buildPdfA4Xmp({ level: 'PDF/A-4f' });
    expect(xmp).toContain('<pdfaid:conformance>F</pdfaid:conformance>');
  });

  it('renders a dc:title when provided', () => {
    const xmp = buildPdfA4Xmp({ title: 'My Report' });
    expect(xmp).toContain('<dc:title>');
    expect(xmp).toContain('<rdf:li xml:lang="x-default">My Report</rdf:li>');
  });

  it('XML-escapes a title containing special characters', () => {
    const xmp = buildPdfA4Xmp({ title: 'A & B <c> "d" \'e\'' });
    expect(xmp).toContain('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
    expect(xmp).not.toContain('A & B <c>');
  });

  it('renders pdfaExtension:schemas with the supplied property', () => {
    const schema: PdfA4ExtensionSchema = {
      namespaceUri: 'http://example.com/ns/custom/',
      prefix: 'custom',
      schema: 'Custom Schema',
      properties: [
        {
          name: 'reviewer',
          valueType: 'Text',
          category: 'external',
          description: 'Name of the document reviewer',
        },
      ],
    };
    const xmp = buildPdfA4Xmp({ extensionSchemas: [schema] });

    expect(xmp).toContain('<pdfaExtension:schemas>');
    expect(xmp).toContain(
      'xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"',
    );
    expect(xmp).toContain('<pdfaSchema:schema>Custom Schema</pdfaSchema:schema>');
    expect(xmp).toContain(
      '<pdfaSchema:namespaceURI>http://example.com/ns/custom/</pdfaSchema:namespaceURI>',
    );
    expect(xmp).toContain('<pdfaSchema:prefix>custom</pdfaSchema:prefix>');
    expect(xmp).toContain('<pdfaProperty:name>reviewer</pdfaProperty:name>');
    expect(xmp).toContain('<pdfaProperty:valueType>Text</pdfaProperty:valueType>');
    expect(xmp).toContain('<pdfaProperty:category>external</pdfaProperty:category>');
    expect(xmp).toContain(
      '<pdfaProperty:description>Name of the document reviewer</pdfaProperty:description>',
    );
  });

  it('escapes special characters inside extension schema fields', () => {
    const schema: PdfA4ExtensionSchema = {
      namespaceUri: 'http://example.com/ns/?a=1&b=2',
      prefix: 'x',
      schema: 'S<&>',
      properties: [
        {
          name: 'p<&>',
          valueType: 'Text',
          category: 'internal',
          description: 'd & <e>',
        },
      ],
    };
    const xmp = buildPdfA4Xmp({ extensionSchemas: [schema] });
    expect(xmp).toContain('http://example.com/ns/?a=1&amp;b=2');
    expect(xmp).toContain('<pdfaSchema:schema>S&lt;&amp;&gt;</pdfaSchema:schema>');
    expect(xmp).toContain('<pdfaProperty:name>p&lt;&amp;&gt;</pdfaProperty:name>');
  });

  it('omits the extension block when no schemas are supplied', () => {
    const xmp = buildPdfA4Xmp();
    expect(xmp).not.toContain('pdfaExtension:schemas');
  });

  it('produces a well-formed xpacket envelope', () => {
    const xmp = buildPdfA4Xmp();
    expect(xmp.startsWith('<?xpacket begin=')).toBe(true);
    expect(xmp.endsWith('<?xpacket end="w"?>')).toBe(true);
    expect(xmp).toContain('<x:xmpmeta');
    expect(xmp).toContain('</x:xmpmeta>');
  });
});

describe('pdfA4Rules', () => {
  it('lists core PDF/A-4 conformance requirements', () => {
    const rules = pdfA4Rules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.includes('XMP'))).toBe(true);
    expect(rules.some((r) => r.toLowerCase().includes('font'))).toBe(true);
    expect(rules.some((r) => r.toLowerCase().includes('encrypt'))).toBe(true);
    expect(rules.some((r) => r.includes('OutputIntent'))).toBe(true);
  });

  it('mentions embedded files are allowed for PDF/A-4f', () => {
    const rules = pdfA4Rules('PDF/A-4f');
    expect(
      rules.some(
        (r) =>
          r.toLowerCase().includes('embedded file') &&
          r.toLowerCase().includes('allowed'),
      ),
    ).toBe(true);
  });

  it('mentions 3D / RichMedia for PDF/A-4e', () => {
    const rules = pdfA4Rules('PDF/A-4e');
    expect(rules.some((r) => r.includes('3D') || r.includes('RichMedia'))).toBe(
      true,
    );
  });

  it('defaults to base level when no argument is given', () => {
    expect(pdfA4Rules()).toEqual(pdfA4Rules('PDF/A-4'));
  });
});

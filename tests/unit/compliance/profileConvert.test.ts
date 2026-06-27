/**
 * @module tests/unit/compliance/profileConvert
 *
 * Unit tests for PDF/A profile conversion (pdfaid remap) and the
 * pre-save PDF/A preflight reporter.
 */

import { describe, it, expect } from 'vitest';

import {
  convertPdfAConformanceXmp,
  preflightPdfA,
  type PreflightIssue,
} from '../../../src/compliance/profileConvert.js';
import { createPdf } from '../../../src/core/pdfDocument.js';

// ---------------------------------------------------------------------------
// convertPdfAConformanceXmp
// ---------------------------------------------------------------------------

describe('convertPdfAConformanceXmp', () => {
  const attrXmp =
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '    <rdf:Description rdf:about=""\n' +
    '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"\n' +
    '      pdfaid:part="3"\n' +
    '      pdfaid:conformance="B"/>\n' +
    '  </rdf:RDF>\n' +
    '</x:xmpmeta>\n' +
    '<?xpacket end="w"?>';

  const elemXmp =
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '    <rdf:Description rdf:about=""\n' +
    '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">\n' +
    '      <pdfaid:part>3</pdfaid:part>\n' +
    '      <pdfaid:conformance>B</pdfaid:conformance>\n' +
    '    </rdf:Description>\n' +
    '  </rdf:RDF>\n' +
    '</x:xmpmeta>\n' +
    '<?xpacket end="w"?>';

  it('remaps an attribute-form pdfaid:part from 3 to 4', () => {
    const out = convertPdfAConformanceXmp(attrXmp, 4);
    expect(out).toContain('pdfaid:part="4"');
    expect(out).not.toContain('pdfaid:part="3"');
  });

  it('remaps an element-form pdfaid:part from 3 to 4', () => {
    const out = convertPdfAConformanceXmp(elemXmp, 4);
    expect(out).toContain('<pdfaid:part>4</pdfaid:part>');
    expect(out).not.toContain('<pdfaid:part>3</pdfaid:part>');
  });

  it('remaps the conformance (attribute form) when provided', () => {
    const out = convertPdfAConformanceXmp(attrXmp, 2, 'u');
    expect(out).toContain('pdfaid:part="2"');
    expect(out).toContain('pdfaid:conformance="U"');
    expect(out).not.toContain('pdfaid:conformance="B"');
  });

  it('remaps the conformance (element form) when provided', () => {
    const out = convertPdfAConformanceXmp(elemXmp, 2, 'a');
    expect(out).toContain('<pdfaid:part>2</pdfaid:part>');
    expect(out).toContain('<pdfaid:conformance>A</pdfaid:conformance>');
    expect(out).not.toContain('<pdfaid:conformance>B</pdfaid:conformance>');
  });

  it('leaves an existing conformance untouched when none is requested', () => {
    const out = convertPdfAConformanceXmp(attrXmp, 4);
    // part changes, conformance preserved
    expect(out).toContain('pdfaid:conformance="B"');
  });

  it('preserves unrelated content in the packet', () => {
    const out = convertPdfAConformanceXmp(attrXmp, 4);
    expect(out).toContain('xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"');
    expect(out).toContain('<?xpacket end="w"?>');
  });

  it('injects a pdfaid:part when none is present', () => {
    const noId =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
      '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      '    <rdf:Description rdf:about=""\n' +
      '      xmlns:dc="http://purl.org/dc/elements/1.1/"/>\n' +
      '  </rdf:RDF>\n' +
      '</x:xmpmeta>';
    const out = convertPdfAConformanceXmp(noId, 4);
    // a part value of 4 must now be present in some form
    const hasPart =
      out.includes('pdfaid:part="4"') || out.includes('<pdfaid:part>4</pdfaid:part>');
    expect(hasPart).toBe(true);
    // the pdfaid namespace must have been declared
    expect(out).toContain('http://www.aiim.org/pdfa/ns/id/');
  });

  it('injects part and conformance together when both are absent', () => {
    const noId =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
      '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      '    <rdf:Description rdf:about=""/>\n' +
      '  </rdf:RDF>\n' +
      '</x:xmpmeta>';
    const out = convertPdfAConformanceXmp(noId, 2, 'b');
    const hasPart =
      out.includes('pdfaid:part="2"') || out.includes('<pdfaid:part>2</pdfaid:part>');
    const hasConf =
      out.includes('pdfaid:conformance="B"') ||
      out.includes('<pdfaid:conformance>B</pdfaid:conformance>');
    expect(hasPart).toBe(true);
    expect(hasConf).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// preflightPdfA
// ---------------------------------------------------------------------------

describe('preflightPdfA', () => {
  function shapeOk(issue: PreflightIssue): boolean {
    return (
      typeof issue.code === 'string' &&
      issue.code.length > 0 &&
      typeof issue.message === 'string' &&
      issue.message.length > 0 &&
      (issue.severity === 'error' || issue.severity === 'warning') &&
      typeof issue.fixable === 'boolean' &&
      (issue.clause === undefined || typeof issue.clause === 'string')
    );
  }

  it('returns issues for a bare created document', () => {
    const issues = preflightPdfA(createPdf());
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('produces issues with the correct shape', () => {
    const issues = preflightPdfA(createPdf());
    for (const issue of issues) {
      expect(shapeOk(issue)).toBe(true);
    }
  });

  it('flags a missing document title as a fixable issue', () => {
    const issues = preflightPdfA(createPdf());
    const titleIssue = issues.find((i) =>
      i.message.toLowerCase().includes('title'),
    );
    expect(titleIssue).toBeDefined();
    expect(titleIssue?.fixable).toBe(true);
  });

  it('flags a missing output intent as a fixable issue', () => {
    const issues = preflightPdfA(createPdf());
    const oiIssue = issues.find((i) =>
      i.message.toLowerCase().includes('output intent'),
    );
    expect(oiIssue).toBeDefined();
    expect(oiIssue?.fixable).toBe(true);
  });

  it('returns fewer issues for a more complete document', () => {
    const bare = preflightPdfA(createPdf());

    const complete = createPdf();
    complete.setTitle('A Complete Archival Document');
    complete.setLanguage('en-US');
    complete.setXmpMetadata(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
        '<rdf:Description rdf:about="" ' +
        'xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" ' +
        'pdfaid:part="4"/>' +
        '</rdf:RDF></x:xmpmeta>',
    );

    const completeIssues = preflightPdfA(complete);
    expect(completeIssues.length).toBeLessThan(bare.length);
  });

  it('never throws and accepts an explicit level argument', () => {
    expect(() => preflightPdfA(createPdf(), 'PDF/A-4')).not.toThrow();
    expect(() => preflightPdfA(createPdf(), '2b')).not.toThrow();
  });
});

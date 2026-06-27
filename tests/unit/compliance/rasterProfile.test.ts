/**
 * @module tests/unit/compliance/rasterProfile
 *
 * Unit tests for WTPDF (Well-Tagged PDF) and PDF/R (ISO 23504)
 * identification XMP packet builders.
 *
 * These tests assert the *structure* of the produced XMP packets —
 * a wrapped xpacket, an rdf:Description, and the requested part value —
 * rather than exact namespace URIs whose precise form (trailing `/` vs
 * `#`) is acknowledged as inconsistent / unstandardised in the source
 * specifications (see PDF Association pdf-issues #395). The builders are
 * identification markers only; they do NOT assert full conformance.
 */

import { describe, it, expect } from 'vitest';

import {
  buildWtpdfIdentificationXmp,
  buildPdfRIdentificationXmp,
  type ProfileXmpOptions,
} from '../../../src/compliance/rasterProfile.js';

// ---------------------------------------------------------------------------
// Required-by-prompt structural assertions
// ---------------------------------------------------------------------------

describe('buildWtpdfIdentificationXmp', () => {
  it('returns a non-empty xpacket-wrapped string with an rdf:Description and the part value', () => {
    const xmp = buildWtpdfIdentificationXmp({ part: 1 });
    expect(typeof xmp).toBe('string');
    expect(xmp.length).toBeGreaterThan(0);
    expect(xmp).toContain('<?xpacket');
    expect(xmp).toContain('rdf:Description');
    // The requested part value must appear.
    expect(xmp).toContain('1');
    // Part must be rendered as a part property (regardless of exact prefix).
    expect(xmp).toMatch(/:part>1</);
  });

  it('is a well-formed packet: opens and closes xpacket and xmpmeta', () => {
    const xmp = buildWtpdfIdentificationXmp({ part: 1 });
    expect(xmp.startsWith('<?xpacket begin=')).toBe(true);
    expect(xmp).toContain('<x:xmpmeta');
    expect(xmp).toContain('</x:xmpmeta>');
    expect(xmp).toContain('<?xpacket end=');
    expect(xmp).toContain('rdf:RDF');
  });

  it('defaults the part to 1 (WTPDF 1.0) when none is supplied', () => {
    const xmp = buildWtpdfIdentificationXmp();
    expect(xmp).toMatch(/:part>1</);
  });

  it('renders the conformance value when supplied', () => {
    const xmp = buildWtpdfIdentificationXmp({ conformance: 'accessibility' });
    expect(xmp).toContain('accessibility');
  });

  it('uses the PDF Declarations (pdfd) mechanism with a conformsTo declaration', () => {
    const xmp = buildWtpdfIdentificationXmp({ part: 1 });
    // The PDF Association "PDF Declarations" namespace (verified).
    expect(xmp).toContain('pdfd');
    expect(xmp).toContain('conformsTo');
    // The WTPDF declaration target appears (string form is provisional).
    expect(xmp.toLowerCase()).toContain('wtpdf');
  });

  it('XML-escapes a conformance value containing special characters', () => {
    const xmp = buildWtpdfIdentificationXmp({ conformance: 'a & b <c>' });
    expect(xmp).toContain('a &amp; b &lt;c&gt;');
    expect(xmp).not.toContain('a & b <c>');
  });

  it('honours exactOptionalPropertyTypes-friendly undefined options', () => {
    const opts: ProfileXmpOptions = { part: undefined, conformance: undefined };
    const xmp = buildWtpdfIdentificationXmp(opts);
    expect(xmp).toContain('<?xpacket');
    expect(xmp).toMatch(/:part>1</);
  });
});

describe('buildPdfRIdentificationXmp', () => {
  it('returns a non-empty xpacket-wrapped string with an rdf:Description and the part value', () => {
    const xmp = buildPdfRIdentificationXmp();
    expect(typeof xmp).toBe('string');
    expect(xmp.length).toBeGreaterThan(0);
    expect(xmp).toContain('<?xpacket');
    expect(xmp).toContain('rdf:Description');
    // Default part is 1 (ISO 23504-1 / PDF/R-1).
    expect(xmp).toContain('1');
    expect(xmp).toMatch(/:part>1</);
  });

  it('is a well-formed packet: opens and closes xpacket and xmpmeta', () => {
    const xmp = buildPdfRIdentificationXmp();
    expect(xmp.startsWith('<?xpacket begin=')).toBe(true);
    expect(xmp).toContain('<x:xmpmeta');
    expect(xmp).toContain('</x:xmpmeta>');
    expect(xmp).toContain('<?xpacket end=');
    expect(xmp).toContain('rdf:RDF');
  });

  it('renders a supplied part value', () => {
    const xmp = buildPdfRIdentificationXmp({ part: 2 });
    expect(xmp).toMatch(/:part>2</);
  });

  it('renders the conformance value when supplied', () => {
    const xmp = buildPdfRIdentificationXmp({ conformance: 'R' });
    expect(xmp).toContain('R');
  });

  it('uses the PDF Declarations (pdfd) mechanism with a conformsTo declaration', () => {
    const xmp = buildPdfRIdentificationXmp();
    expect(xmp).toContain('pdfd');
    expect(xmp).toContain('conformsTo');
  });

  it('references ISO 23504 / PDF/R as the declared profile', () => {
    const xmp = buildPdfRIdentificationXmp().toLowerCase();
    // Either the ISO number or the profile short-name should be present.
    const mentionsProfile =
      xmp.includes('23504') || xmp.includes('pdf/r') || xmp.includes('pdfr');
    expect(mentionsProfile).toBe(true);
  });

  it('XML-escapes a conformance value containing special characters', () => {
    const xmp = buildPdfRIdentificationXmp({ conformance: 'x & y' });
    expect(xmp).toContain('x &amp; y');
    expect(xmp).not.toContain('x & y');
  });
});

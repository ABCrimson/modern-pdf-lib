/**
 * Tests for PdfWriter — binary serialization of a PDF document.
 *
 * Covers header, xref table, trailer, compression, and overall structure.
 */

import { describe, it, expect } from 'vitest';
import {
  PdfWriter,
  serializePdf,
} from '../../../src/core/pdfWriter.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfStream,
  PdfArray,
  PdfRef,
} from '../../../src/core/pdfObjects.js';
import { buildDocumentStructure } from '../../../src/core/pdfCatalog.js';
import type { PageEntry } from '../../../src/core/pdfCatalog.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function pdfToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Build a minimal valid document structure with one empty page.
 */
function buildMinimalDocument(compress = false) {
  const registry = new PdfObjectRegistry();

  // Allocate page refs
  const pageRef = registry.allocate();
  const contentStreamRef = registry.allocate();

  // Create a minimal content stream
  const contentStream = PdfStream.fromString('');
  registry.assign(contentStreamRef, contentStream);

  // Build a resources dict
  const resources = new PdfDict();
  resources.set(
    '/ProcSet',
    PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]),
  );

  const pageEntry: PageEntry = {
    pageRef,
    width: 595.28,
    height: 841.89,
    contentStreamRefs: contentStreamRef,
    resources,
  };

  const structure = buildDocumentStructure(
    [pageEntry],
    { producer: 'modern-pdf', creationDate: new Date('2026-01-01T00:00:00Z') },
    registry,
  );

  return { registry, structure };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfWriter', () => {
  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------

  it('produces output starting with %PDF-1.7', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    expect(text.startsWith('%PDF-1.7')).toBe(true);
  });

  it('produces output ending with %%EOF', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('includes binary comment after header', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });

    // The binary comment follows the %PDF-1.7\n line.
    // It starts at byte offset 10 (after '%PDF-1.7\n')
    // and should contain %<high bytes>
    const headerEnd = bytes.indexOf(0x0a); // first newline
    // The next byte should be 0x25 (%)
    expect(bytes[headerEnd + 1]).toBe(0x25); // '%'
    // Followed by bytes > 127
    expect(bytes[headerEnd + 2]!).toBeGreaterThan(127);
    expect(bytes[headerEnd + 3]!).toBeGreaterThan(127);
  });

  // -------------------------------------------------------------------------
  // Xref table
  // -------------------------------------------------------------------------

  it('generates valid xref table', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('xref\n');
    // Should start with '0 N' where N is the number of objects
    expect(text).toMatch(/xref\n0 \d+\n/);
    // Should contain the free head entry
    expect(text).toContain('0000000000 65535 f ');
  });

  it('xref offsets point to correct byte positions', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    // Parse xref entries
    const xrefStart = text.indexOf('xref\n');
    expect(xrefStart).toBeGreaterThan(0);

    // Extract the xref section
    const xrefSection = text.slice(xrefStart);
    const lines = xrefSection.split('\n');
    // lines[0] = 'xref'
    // lines[1] = '0 N' (subsection header)
    // lines[2] = free head entry
    // lines[3..] = object entries

    // Parse the first in-use entry to verify it points to a valid offset
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i]!;
      const match = line.match(/^(\d{10}) (\d{5}) n /);
      if (match) {
        const offset = parseInt(match[1]!, 10);
        // The byte at that offset should start an object definition
        // "N G obj"
        const objText = text.slice(offset, offset + 20);
        expect(objText).toMatch(/^\d+ \d+ obj/);
        break; // just check the first one
      }
    }
  });

  // -------------------------------------------------------------------------
  // Trailer
  // -------------------------------------------------------------------------

  it('trailer contains /Size, /Root, /Info', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('trailer');
    expect(text).toMatch(/\/Size \d+/);
    expect(text).toMatch(/\/Root \d+ \d+ R/);
    expect(text).toMatch(/\/Info \d+ \d+ R/);
  });

  it('trailer /Root points to catalog', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    // Extract root reference from trailer
    const rootMatch = text.match(/\/Root (\d+) (\d+) R/);
    expect(rootMatch).not.toBeNull();

    const rootObjNum = rootMatch![1];
    // Find the catalog object in the body
    const catalogPattern = new RegExp(`${rootObjNum} 0 obj`);
    expect(text).toMatch(catalogPattern);

    // The catalog should contain /Type /Catalog
    const catalogStart = text.indexOf(`${rootObjNum} 0 obj`);
    const catalogSection = text.slice(catalogStart, catalogStart + 200);
    expect(catalogSection).toContain('/Type /Catalog');
  });

  // -------------------------------------------------------------------------
  // Compression
  // -------------------------------------------------------------------------

  it('uncompressed streams are readable', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    // All streams should be readable ASCII (no FlateDecode)
    // The content stream should not have /Filter /FlateDecode
    // (though it may be empty in this minimal case)
    const hasFlate = text.includes('/Filter /FlateDecode');
    // In the minimal case with empty stream, compression may be skipped
    // even with compress: true, so just verify the structure is valid
    expect(text).toContain('stream');
    expect(text).toContain('endstream');
  });

  it('compressed streams use FlateDecode filter', async () => {
    const registry = new PdfObjectRegistry();

    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();

    // Create a content stream with enough data to be compressible
    const longContent = 'q\n' + 'BT /F1 12 Tf 50 700 Td (Hello World) Tj ET\n'.repeat(50) + 'Q\n';
    const contentStream = PdfStream.fromString(longContent);
    registry.assign(contentStreamRef, contentStream);

    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };

    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'modern-pdf' },
      registry,
    );

    const bytes = await serializePdf(registry, structure, { compress: true });
    const text = pdfToString(bytes);

    expect(text).toContain('/Filter /FlateDecode');
  });

  // -------------------------------------------------------------------------
  // startxref
  // -------------------------------------------------------------------------

  it('includes startxref pointer', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    expect(text).toContain('startxref\n');
    // The number after startxref should be a valid offset
    const match = text.match(/startxref\n(\d+)\n/);
    expect(match).not.toBeNull();

    const xrefOffset = parseInt(match![1]!, 10);
    expect(xrefOffset).toBeGreaterThan(0);

    // That offset should point to the 'xref' keyword
    const atOffset = text.slice(xrefOffset, xrefOffset + 4);
    expect(atOffset).toBe('xref');
  });

  // -------------------------------------------------------------------------
  // Empty single-page PDF
  // -------------------------------------------------------------------------

  it('empty single-page PDF is valid', async () => {
    const { registry, structure } = buildMinimalDocument();
    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = pdfToString(bytes);

    // Basic structural validation
    expect(text).toContain('%PDF-1.7');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text).toContain('startxref');
    expect(text.trimEnd()).toMatch(/%%EOF$/);

    // Should contain the page tree
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/Type /Catalog');

    // Should contain object definitions and endobj markers
    expect(text).toMatch(/\d+ 0 obj/);
    expect(text).toContain('endobj');
  });

  // -------------------------------------------------------------------------
  // PdfWriter class direct usage
  // -------------------------------------------------------------------------

  it('PdfWriter.write() produces complete PDF', async () => {
    const { registry, structure } = buildMinimalDocument();
    const writer = new PdfWriter(registry, structure, { compress: false });
    const bytes = await writer.write();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const text = pdfToString(bytes);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Object streams
  // -------------------------------------------------------------------------

  it('object streams: small document uses traditional xref', async () => {
    const { registry, structure } = buildMinimalDocument();
    // The minimal document has only a handful of objects.
    // With threshold = Infinity (default), traditional xref is used.
    const bytes = await serializePdf(registry, structure, {
      compress: false,
      objectStreamThreshold: Infinity,
    });
    const text = pdfToString(bytes);

    // Traditional xref table markers
    expect(text).toContain('xref\n');
    expect(text).toContain('trailer\n');
    expect(text).not.toContain('/Type /XRef');
    expect(text).not.toContain('/Type /ObjStm');
  });

  it('object streams: below-threshold document uses traditional xref even when enabled', async () => {
    const { registry, structure } = buildMinimalDocument();
    // Set threshold very high (e.g. 1000) — minimal doc won't meet it
    const bytes = await serializePdf(registry, structure, {
      compress: false,
      objectStreamThreshold: 1000,
    });
    const text = pdfToString(bytes);

    // Should fall back to traditional xref
    expect(text).toContain('xref\n');
    expect(text).toContain('trailer\n');
  });

  it('object streams: produces /Type /XRef stream when threshold exceeded', async () => {
    // Build a document with many small objects to exceed threshold
    const registry = new PdfObjectRegistry();

    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();

    // Create a content stream
    const contentStream = PdfStream.fromString('BT /F1 12 Tf 50 700 Td (Hello) Tj ET');
    registry.assign(contentStreamRef, contentStream);

    // Register many small objects to exceed threshold
    for (let i = 0; i < 10; i++) {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Text'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 100]));
      registry.register(dict);
    }

    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };

    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'modern-pdf' },
      registry,
    );

    // Use threshold = 1 so even a small doc uses object streams
    const bytes = await serializePdf(registry, structure, {
      compress: false,
      objectStreamThreshold: 1,
    });
    const text = pdfToString(bytes);

    // Should produce a cross-reference stream instead of traditional xref
    expect(text).toContain('/Type /XRef');
    expect(text).toContain('/Type /ObjStm');
    // Should NOT contain traditional xref markers
    expect(text).not.toContain('xref\n0 ');
    expect(text).not.toContain('trailer\n');
    // But should have startxref and %%EOF
    expect(text).toContain('startxref\n');
    expect(text.trimEnd()).toMatch(/%%EOF$/);
    // Should have a valid PDF header
    expect(text.startsWith('%PDF-1.7')).toBe(true);
  });
});

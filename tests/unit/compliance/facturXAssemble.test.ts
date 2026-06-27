/**
 * Tests for the high-level Factur-X assembler.
 *
 * Covers:
 * - buildFacturXXmp: produces the Factur-X PDF/A-3 XMP extension metadata in
 *   the `fx:` namespace (DocumentType=INVOICE, DocumentFileName, Version, and
 *   the ConformanceLevel derived from the profile), plus the mandatory
 *   pdfaExtension schema description.
 * - assembleFacturX: generates the CII XML for an Invoice and attaches it to a
 *   PdfDocument as a PDF/A-3 associated file (/AF, /Alternative, factur-x.xml).
 *
 * References verified against the official Factur-X 1.0 / ZUGFeRD 2.x reference
 * XMP (PDFlib GmbH sample, akretion/factur-x):
 * - namespace URI: urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#
 * - prefix: fx; properties: DocumentType, DocumentFileName, Version, ConformanceLevel
 */

import { describe, it, expect } from 'vitest';

import {
  assembleFacturX,
  buildFacturXXmp,
} from '../../../src/compliance/facturXAssemble.js';
import type { FacturXAssembleOptions } from '../../../src/compliance/facturXAssemble.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type {
  Invoice,
  InvoiceLine,
  InvoiceParty,
  FacturXProfile,
} from '../../../src/compliance/facturX.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const seller: InvoiceParty = {
  name: 'Muster GmbH',
  countryCode: 'DE',
  vatId: 'DE123456789',
};

const buyer: InvoiceParty = {
  name: 'Acme Buyer SARL',
  countryCode: 'FR',
  vatId: 'FR987654321',
};

const lines: readonly InvoiceLine[] = [
  { description: 'Widget A', quantity: 2, unitPrice: 10, taxPercent: 19 },
  { description: 'Service B', quantity: 1, unitPrice: 100, taxPercent: 19 },
];

const sampleInvoice: Invoice = {
  invoiceNumber: 'INV-2026-0042',
  issueDate: '2026-06-25',
  currency: 'EUR',
  seller,
  buyer,
  lines,
};

function bytesToLatin1(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

// ---------------------------------------------------------------------------
// buildFacturXXmp
// ---------------------------------------------------------------------------

describe('buildFacturXXmp', () => {
  it('uses the official Factur-X fx: namespace URI', () => {
    const xmp = buildFacturXXmp('EN16931');
    expect(xmp).toContain(
      'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
    );
    expect(xmp).toContain('xmlns:fx=');
  });

  it('declares DocumentType INVOICE and a Version', () => {
    const xmp = buildFacturXXmp('EN16931');
    expect(xmp).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xmp).toContain('<fx:Version>1.0</fx:Version>');
  });

  it('embeds the default document file name', () => {
    const xmp = buildFacturXXmp('EN16931');
    expect(xmp).toContain(
      '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>',
    );
  });

  it('uses a custom document file name when provided', () => {
    const xmp = buildFacturXXmp('EN16931', 'my-invoice.xml');
    expect(xmp).toContain(
      '<fx:DocumentFileName>my-invoice.xml</fx:DocumentFileName>',
    );
  });

  it('derives the spec ConformanceLevel string from the profile', () => {
    const cases: ReadonlyArray<readonly [FacturXProfile, string]> = [
      ['MINIMUM', 'MINIMUM'],
      ['BASIC-WL', 'BASIC WL'],
      ['BASIC', 'BASIC'],
      ['EN16931', 'EN 16931'],
      ['EXTENDED', 'EXTENDED'],
    ];
    for (const [profile, level] of cases) {
      const xmp = buildFacturXXmp(profile);
      expect(xmp).toContain(
        `<fx:ConformanceLevel>${level}</fx:ConformanceLevel>`,
      );
    }
  });

  it('includes the mandatory PDF/A extension schema description', () => {
    const xmp = buildFacturXXmp('EN16931');
    expect(xmp).toContain('http://www.aiim.org/pdfa/ns/extension/');
    expect(xmp).toContain('<pdfaSchema:prefix>fx</pdfaSchema:prefix>');
    expect(xmp).toContain('<pdfaProperty:name>ConformanceLevel</pdfaProperty:name>');
  });
});

// ---------------------------------------------------------------------------
// assembleFacturX
// ---------------------------------------------------------------------------

describe('assembleFacturX', () => {
  it('returns the CII XML for the invoice', () => {
    const doc = createPdf();
    doc.addPage([595, 842]);
    const xml = assembleFacturX(doc, sampleInvoice);
    expect(xml).toContain('CrossIndustryInvoice');
    expect(xml).toContain('INV-2026-0042');
  });

  it('attaches the XML as a PDF/A-3 associated file (/AF, /Alternative)', async () => {
    const doc = createPdf();
    doc.addPage([595, 842]);
    assembleFacturX(doc, sampleInvoice);
    const bytes = await doc.save();
    const text = bytesToLatin1(bytes);
    expect(text).toContain('/AF');
    expect(text).toContain('/Alternative');
    expect(text).toContain('factur-x.xml');
  });

  it('uses the requested profile guideline URN in the CII XML', () => {
    const doc = createPdf();
    doc.addPage([595, 842]);
    const opts: FacturXAssembleOptions = { profile: 'MINIMUM' };
    const xml = assembleFacturX(doc, sampleInvoice, opts);
    expect(xml).toContain('urn:factur-x.eu:1p0:minimum');
  });

  it('honours a custom embedded filename', async () => {
    const doc = createPdf();
    doc.addPage([595, 842]);
    assembleFacturX(doc, sampleInvoice, { filename: 'custom-invoice.xml' });
    const bytes = await doc.save();
    const text = bytesToLatin1(bytes);
    expect(text).toContain('custom-invoice.xml');
  });

  it('defaults to the EN16931 profile', () => {
    const doc = createPdf();
    doc.addPage([595, 842]);
    const xml = assembleFacturX(doc, sampleInvoice);
    // EN16931 guideline URN.
    expect(xml).toContain('urn:cen.eu:en16931:2017');
  });
});

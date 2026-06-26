/**
 * Tests for the Factur-X / ZUGFeRD CrossIndustryInvoice (CII) XML generator.
 */

import { describe, expect, it } from 'vitest';

import {
  generateCiiXml,
  type FacturXProfile,
  type Invoice,
  type InvoiceLine,
  type InvoiceParty,
} from '../../../src/compliance/facturX.js';

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

const baseLines: readonly InvoiceLine[] = [
  { description: 'Widget A', quantity: 2, unitPrice: 10, taxPercent: 19 },
  { description: 'Service B', quantity: 1, unitPrice: 100, taxPercent: 19 },
];

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceNumber: 'INV-2026-0042',
    issueDate: '2026-06-25',
    currency: 'EUR',
    seller,
    buyer,
    lines: baseLines,
    ...overrides,
  };
}

describe('generateCiiXml', () => {
  it('produces a well-formed CrossIndustryInvoice root', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rsm:CrossIndustryInvoice');
    expect(xml).toContain('</rsm:CrossIndustryInvoice>');
  });

  it('declares the rsm, ram and udt namespaces', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain(
      'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
    );
    expect(xml).toContain(
      'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
    );
    expect(xml).toContain(
      'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"',
    );
  });

  it('uses the EN16931 guideline URN by default', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain(
      '<ram:ID>urn:cen.eu:en16931:2017</ram:ID>',
    );
  });

  it('selects the correct guideline URN per profile', () => {
    const cases: ReadonlyArray<readonly [FacturXProfile, string]> = [
      ['MINIMUM', 'urn:factur-x.eu:1p0:minimum'],
      ['BASIC-WL', 'urn:factur-x.eu:1p0:basicwl'],
      [
        'BASIC',
        'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
      ],
      ['EN16931', 'urn:cen.eu:en16931:2017'],
      [
        'EXTENDED',
        'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
      ],
    ];
    for (const [profile, urn] of cases) {
      const xml = generateCiiXml(makeInvoice(), profile);
      expect(xml).toContain(`<ram:ID>${urn}</ram:ID>`);
    }
  });

  it('includes the invoice number and document type code', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain('<ram:ID>INV-2026-0042</ram:ID>');
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
  });

  it('emits the issue date as DateTimeString format 102 (YYYYMMDD)', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain(
      '<udt:DateTimeString format="102">20260625</udt:DateTimeString>',
    );
  });

  it('includes both party names and VAT ids', () => {
    const xml = generateCiiXml(makeInvoice());
    expect(xml).toContain('<ram:Name>Muster GmbH</ram:Name>');
    expect(xml).toContain('<ram:Name>Acme Buyer SARL</ram:Name>');
    expect(xml).toContain('<ram:CountryID>DE</ram:CountryID>');
    expect(xml).toContain('<ram:CountryID>FR</ram:CountryID>');
    expect(xml).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="VA">FR987654321</ram:ID>');
  });

  it('omits the tax registration block when no VAT id is given', () => {
    const xml = generateCiiXml(
      makeInvoice({
        seller: { name: 'No VAT Co', countryCode: 'DE' },
        buyer: { name: 'Plain Buyer', countryCode: 'FR' },
      }),
    );
    expect(xml).toContain('<ram:Name>No VAT Co</ram:Name>');
    expect(xml).toContain('<ram:Name>Plain Buyer</ram:Name>');
    expect(xml).not.toContain('<ram:SpecifiedTaxRegistration>');
    expect(xml).not.toContain('schemeID="VA"');
  });

  it('renders one line item per invoice line with net amounts', () => {
    const xml = generateCiiXml(makeInvoice());
    const lineCount = (
      xml.match(/<ram:IncludedSupplyChainTradeLineItem>/g) ?? []
    ).length;
    expect(lineCount).toBe(2);
    expect(xml).toContain('<ram:Name>Widget A</ram:Name>');
    expect(xml).toContain('<ram:Name>Service B</ram:Name>');
    // Widget A: 2 * 10 = 20.00 net
    expect(xml).toContain(
      '<ram:LineTotalAmount currencyID="EUR">20.00</ram:LineTotalAmount>',
    );
    // Service B: 1 * 100 = 100.00 net
    expect(xml).toContain(
      '<ram:LineTotalAmount currencyID="EUR">100.00</ram:LineTotalAmount>',
    );
  });

  it('computes a correct grand total (line net sum plus tax)', () => {
    const xml = generateCiiXml(makeInvoice());
    // Net total: 20 + 100 = 120.00
    expect(xml).toContain(
      '<ram:TaxBasisTotalAmount currencyID="EUR">120.00</ram:TaxBasisTotalAmount>',
    );
    // Tax: 120 * 19% = 22.80
    expect(xml).toContain(
      '<ram:TaxTotalAmount currencyID="EUR">22.80</ram:TaxTotalAmount>',
    );
    // Grand total: 120 + 22.80 = 142.80
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="EUR">142.80</ram:GrandTotalAmount>',
    );
    expect(xml).toContain(
      '<ram:DuePayableAmount currencyID="EUR">142.80</ram:DuePayableAmount>',
    );
  });

  it('groups tax subtotals by rate', () => {
    const xml = generateCiiXml(
      makeInvoice({
        lines: [
          { description: 'Std', quantity: 1, unitPrice: 100, taxPercent: 19 },
          { description: 'Red', quantity: 1, unitPrice: 50, taxPercent: 7 },
          { description: 'Std2', quantity: 2, unitPrice: 10, taxPercent: 19 },
        ],
      }),
    );
    // 19% basis: 100 + 20 = 120.00, tax 22.80
    expect(xml).toContain(
      '<ram:BasisAmount currencyID="EUR">120.00</ram:BasisAmount>',
    );
    // 7% basis: 50.00, tax 3.50
    expect(xml).toContain(
      '<ram:BasisAmount currencyID="EUR">50.00</ram:BasisAmount>',
    );
    expect(xml).toContain(
      '<ram:CalculatedAmount currencyID="EUR">22.80</ram:CalculatedAmount>',
    );
    expect(xml).toContain(
      '<ram:CalculatedAmount currencyID="EUR">3.50</ram:CalculatedAmount>',
    );
    // grand total = 170 + 26.30 = 196.30
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="EUR">196.30</ram:GrandTotalAmount>',
    );
  });

  it('XML-escapes special characters in text values', () => {
    const xml = generateCiiXml(
      makeInvoice({
        seller: {
          name: 'Smith & Sons <Trading>',
          countryCode: 'DE',
          vatId: 'DE000',
        },
        invoiceNumber: 'A&B-"1"',
      }),
    );
    expect(xml).toContain(
      '<ram:Name>Smith &amp; Sons &lt;Trading&gt;</ram:Name>',
    );
    expect(xml).not.toContain('Smith & Sons');
    expect(xml).toContain('<ram:ID>A&amp;B-&quot;1&quot;</ram:ID>');
  });

  it('respects a non-EUR currency code throughout', () => {
    const xml = generateCiiXml(makeInvoice({ currency: 'USD' }));
    expect(xml).toContain(
      '<ram:InvoiceCurrencyCode>USD</ram:InvoiceCurrencyCode>',
    );
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="USD">142.80</ram:GrandTotalAmount>',
    );
  });

  it('handles an empty line list with zero totals', () => {
    const xml = generateCiiXml(makeInvoice({ lines: [] }));
    expect(xml).toContain(
      '<ram:LineTotalAmount currencyID="EUR">0.00</ram:LineTotalAmount>',
    );
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="EUR">0.00</ram:GrandTotalAmount>',
    );
    expect(xml).not.toContain('<ram:IncludedSupplyChainTradeLineItem>');
  });
});

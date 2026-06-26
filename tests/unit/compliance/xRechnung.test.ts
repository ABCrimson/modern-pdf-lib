/**
 * Tests for the XRechnung and Order-X e-document profile generators.
 */

import { describe, expect, it } from 'vitest';

import type {
  Invoice,
  InvoiceLine,
  InvoiceParty,
} from '../../../src/compliance/facturX.js';
import {
  generateOrderX,
  generateXRechnungCii,
  type OrderXType,
  type XRechnungOptions,
} from '../../../src/compliance/xRechnung.js';

const seller: InvoiceParty = {
  name: 'Muster GmbH',
  countryCode: 'DE',
  vatId: 'DE123456789',
};

const buyer: InvoiceParty = {
  name: 'Behörde & Co <Berlin>',
  countryCode: 'DE',
  vatId: 'DE987654321',
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

describe('generateXRechnungCii', () => {
  it('emits a well-formed CII document', () => {
    const xml = generateXRechnungCii(makeInvoice());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rsm:CrossIndustryInvoice');
    expect(xml).toContain('</rsm:CrossIndustryInvoice>');
  });

  it('contains the XRechnung 3.0 guideline URN', () => {
    const xml = generateXRechnungCii(makeInvoice());
    expect(xml).toContain(
      'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
    );
  });

  it('includes the Leitweg-ID as BuyerReference when provided', () => {
    const options: XRechnungOptions = {
      leitwegId: '04011000-1234512345-06',
    };
    const xml = generateXRechnungCii(makeInvoice(), options);
    expect(xml).toContain(
      '<ram:BuyerReference>04011000-1234512345-06</ram:BuyerReference>',
    );
  });

  it('omits BuyerReference when neither id is provided', () => {
    const xml = generateXRechnungCii(makeInvoice());
    expect(xml).not.toContain('<ram:BuyerReference>');
  });

  it('prefers an explicit buyerReference over the Leitweg-ID', () => {
    const options: XRechnungOptions = {
      leitwegId: 'LEITWEG-1',
      buyerReference: 'BR-OVERRIDE',
    };
    const xml = generateXRechnungCii(makeInvoice(), options);
    expect(xml).toContain('<ram:BuyerReference>BR-OVERRIDE</ram:BuyerReference>');
    expect(xml).not.toContain('LEITWEG-1');
  });

  it('computes totals from the invoice lines', () => {
    const xml = generateXRechnungCii(makeInvoice());
    // line total: 2*10 + 1*100 = 120.00
    expect(xml).toContain(
      '<ram:LineTotalAmount currencyID="EUR">120.00</ram:LineTotalAmount>',
    );
    // tax at 19%: 120 * 0.19 = 22.80
    expect(xml).toContain(
      '<ram:TaxTotalAmount currencyID="EUR">22.80</ram:TaxTotalAmount>',
    );
    // grand total: 142.80
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="EUR">142.80</ram:GrandTotalAmount>',
    );
    expect(xml).toContain(
      '<ram:DuePayableAmount currencyID="EUR">142.80</ram:DuePayableAmount>',
    );
  });

  it('XML-escapes party text', () => {
    const xml = generateXRechnungCii(makeInvoice());
    expect(xml).toContain('Behörde &amp; Co &lt;Berlin&gt;');
    expect(xml).not.toContain('Co <Berlin>');
  });

  it('emits the issue date in UN/CEFACT format 102', () => {
    const xml = generateXRechnungCii(makeInvoice());
    expect(xml).toContain(
      '<udt:DateTimeString format="102">20260625</udt:DateTimeString>',
    );
  });

  it('emits one tax group per distinct rate', () => {
    const xml = generateXRechnungCii(
      makeInvoice({
        lines: [
          { description: 'A', quantity: 1, unitPrice: 100, taxPercent: 19 },
          { description: 'B', quantity: 1, unitPrice: 50, taxPercent: 7 },
        ],
      }),
    );
    expect(xml).toContain(
      '<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>',
    );
    expect(xml).toContain(
      '<ram:RateApplicablePercent>7.00</ram:RateApplicablePercent>',
    );
  });
});

describe('generateOrderX', () => {
  it('emits a Cross Industry Order message structure', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rsm:SCRDMCCBDACIOMessageStructure');
    expect(xml).toContain('</rsm:SCRDMCCBDACIOMessageStructure>');
  });

  it('contains the Order-X guideline URN', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml).toContain('urn:order-x.eu:1p0:basic');
  });

  it('uses order type code 220 for an Order', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml).toContain('<ram:TypeCode>220</ram:TypeCode>');
  });

  it('uses type code 230 for an OrderChange', () => {
    const xml = generateOrderX(makeInvoice(), 'OrderChange');
    expect(xml).toContain('<ram:TypeCode>230</ram:TypeCode>');
  });

  it('uses response type code 231 for an OrderResponse', () => {
    const orderType: OrderXType = 'OrderResponse';
    const xml = generateOrderX(makeInvoice(), orderType);
    expect(xml).toContain('<ram:TypeCode>231</ram:TypeCode>');
  });

  it('computes totals from the order lines', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml).toContain(
      '<ram:LineTotalAmount currencyID="EUR">120.00</ram:LineTotalAmount>',
    );
    expect(xml).toContain(
      '<ram:GrandTotalAmount currencyID="EUR">142.80</ram:GrandTotalAmount>',
    );
  });

  it('emits an order currency code', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml).toContain(
      '<ram:OrderCurrencyCode>EUR</ram:OrderCurrencyCode>',
    );
  });

  it('includes both buyer and seller parties', () => {
    const xml = generateOrderX(makeInvoice(), 'Order');
    expect(xml).toContain('<ram:BuyerTradeParty>');
    expect(xml).toContain('<ram:SellerTradeParty>');
    expect(xml).toContain('<ram:Name>Muster GmbH</ram:Name>');
  });
});

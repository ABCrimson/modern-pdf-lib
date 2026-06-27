/**
 * Tests for the inbound UN/CEFACT CrossIndustryInvoice (CII) reader.
 *
 * The reader is the inverse of {@link generateCiiXml}: it parses a CII
 * XML string back into the typed {@link Invoice} model and detects the
 * Factur-X / ZUGFeRD profile from the guideline URN.
 */

import { describe, expect, it } from 'vitest';

import {
  generateCiiXml,
  type FacturXProfile,
  type Invoice,
  type InvoiceLine,
  type InvoiceParty,
} from '../../../src/compliance/facturX.js';
import {
  detectFacturXProfile,
  parseCiiXml,
} from '../../../src/compliance/ciiReader.js';

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

describe('parseCiiXml', () => {
  it('round-trips the invoice id, currency and issue date', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    const parsed = parseCiiXml(xml);
    expect(parsed.invoiceNumber).toBe('INV-2026-0042');
    expect(parsed.currency).toBe('EUR');
    expect(parsed.issueDate).toBe('2026-06-25');
  });

  it('recovers the seller and buyer names', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    const parsed = parseCiiXml(xml);
    expect(parsed.seller.name).toBe('Muster GmbH');
    expect(parsed.buyer.name).toBe('Acme Buyer SARL');
  });

  it('recovers seller and buyer country codes and VAT ids', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    const parsed = parseCiiXml(xml);
    expect(parsed.seller.countryCode).toBe('DE');
    expect(parsed.buyer.countryCode).toBe('FR');
    expect(parsed.seller.vatId).toBe('DE123456789');
    expect(parsed.buyer.vatId).toBe('FR987654321');
  });

  it('recovers the line count', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    const parsed = parseCiiXml(xml);
    expect(parsed.lines).toHaveLength(2);
  });

  it('recovers line descriptions, quantities, prices and tax rates', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    const parsed = parseCiiXml(xml);
    const [first, second] = parsed.lines;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.description).toBe('Widget A');
    expect(first?.quantity).toBe(2);
    expect(first?.unitPrice).toBe(10);
    expect(first?.taxPercent).toBe(19);
    expect(second?.description).toBe('Service B');
    expect(second?.quantity).toBe(1);
    expect(second?.unitPrice).toBe(100);
    expect(second?.taxPercent).toBe(19);
  });

  it('is tolerant of namespace prefixes (matches local element names)', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931')
      .replaceAll('ram:', 'a:')
      .replaceAll('rsm:', 'b:')
      .replaceAll('udt:', 'c:');
    const parsed = parseCiiXml(xml);
    expect(parsed.invoiceNumber).toBe('INV-2026-0042');
    expect(parsed.seller.name).toBe('Muster GmbH');
    expect(parsed.buyer.name).toBe('Acme Buyer SARL');
    expect(parsed.lines).toHaveLength(2);
  });

  it('is tolerant of no namespace prefixes at all', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931')
      .replaceAll('ram:', '')
      .replaceAll('rsm:', '')
      .replaceAll('udt:', '');
    const parsed = parseCiiXml(xml);
    expect(parsed.invoiceNumber).toBe('INV-2026-0042');
    expect(parsed.seller.name).toBe('Muster GmbH');
    expect(parsed.lines).toHaveLength(2);
  });

  it('unescapes XML entities in text values', () => {
    const xml = generateCiiXml(
      makeInvoice({
        seller: { name: 'A & B <Co> "Ltd"', countryCode: 'DE' },
      }),
      'EN16931',
    );
    const parsed = parseCiiXml(xml);
    expect(parsed.seller.name).toBe('A & B <Co> "Ltd"');
  });

  it('omits vatId when no tax registration is present', () => {
    const xml = generateCiiXml(
      makeInvoice({
        seller: { name: 'No VAT GmbH', countryCode: 'DE' },
      }),
      'EN16931',
    );
    const parsed = parseCiiXml(xml);
    expect(parsed.seller.vatId).toBeUndefined();
  });

  it('throws on input without a CrossIndustryInvoice root', () => {
    expect(() => parseCiiXml('<not-an-invoice/>')).toThrow();
  });
});

describe('detectFacturXProfile', () => {
  it('detects EN16931 from the guideline URN', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931');
    expect(detectFacturXProfile(xml)).toBe('EN16931');
  });

  it('detects each profile round-tripped from the generator', () => {
    const profiles: readonly FacturXProfile[] = [
      'MINIMUM',
      'BASIC-WL',
      'BASIC',
      'EN16931',
      'EXTENDED',
    ];
    for (const profile of profiles) {
      const xml = generateCiiXml(makeInvoice(), profile);
      expect(detectFacturXProfile(xml)).toBe(profile);
    }
  });

  it('returns undefined when no guideline URN is present', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931').replace(
      /<ram:GuidelineSpecifiedDocumentContextParameter>[\s\S]*?<\/ram:GuidelineSpecifiedDocumentContextParameter>/,
      '',
    );
    expect(detectFacturXProfile(xml)).toBeUndefined();
  });

  it('returns undefined for an unrecognised URN', () => {
    const xml = generateCiiXml(makeInvoice(), 'EN16931').replace(
      'urn:cen.eu:en16931:2017',
      'urn:example:not-a-real-profile',
    );
    expect(detectFacturXProfile(xml)).toBeUndefined();
  });
});

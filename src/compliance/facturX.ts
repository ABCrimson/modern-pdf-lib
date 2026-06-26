/**
 * @module compliance/facturX
 *
 * Factur-X / ZUGFeRD CrossIndustryInvoice (CII) XML generator.
 *
 * Produces a well-formed UN/CEFACT Cross Industry Invoice (CII) XML
 * document that can be embedded into a PDF/A-3 file to create a
 * hybrid Factur-X / ZUGFeRD electronic invoice.
 *
 * The generator is pure TypeScript string generation — it does not
 * rely on a DOM implementation, so it runs identically across Node,
 * Deno, Bun, Cloudflare Workers and browsers.
 *
 * Supported profiles (conformance levels) and their
 * `GuidelineSpecifiedDocumentContextParameter` URNs:
 * - MINIMUM   — urn:factur-x.eu:1p0:minimum
 * - BASIC-WL  — urn:factur-x.eu:1p0:basicwl
 * - BASIC     — urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic
 * - EN16931   — urn:cen.eu:en16931:2017
 * - EXTENDED  — urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended
 *
 * References:
 * - UN/CEFACT Cross Industry Invoice (CII) D16B
 * - EN 16931-1:2017 (European semantic invoice standard)
 * - Factur-X 1.0 / ZUGFeRD 2.x specification
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Factur-X / ZUGFeRD conformance profile. */
export type FacturXProfile =
  | 'MINIMUM'
  | 'BASIC-WL'
  | 'BASIC'
  | 'EN16931'
  | 'EXTENDED';

/** A trading party (seller or buyer) on the invoice. */
export interface InvoiceParty {
  /** Legal/trading name of the party. */
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code (e.g. 'DE', 'FR'). */
  readonly countryCode: string;
  /** VAT registration identifier, if any (e.g. 'DE123456789'). */
  readonly vatId?: string | undefined;
}

/** A single invoice line item. */
export interface InvoiceLine {
  /** Free-text description of the goods or services. */
  readonly description: string;
  /** Billed quantity. */
  readonly quantity: number;
  /** Net unit price (excluding tax) in the invoice currency. */
  readonly unitPrice: number;
  /** VAT rate applied to this line, in percent (e.g. 19 for 19%). */
  readonly taxPercent: number;
}

/** A complete invoice ready to be rendered as CII XML. */
export interface Invoice {
  /** Invoice document number (BT-1). */
  readonly invoiceNumber: string;
  /** Issue date as an ISO date string ('YYYY-MM-DD'). */
  readonly issueDate: string;
  /** ISO 4217 currency code (e.g. 'EUR'). */
  readonly currency: string;
  /** Seller trade party. */
  readonly seller: InvoiceParty;
  /** Buyer trade party. */
  readonly buyer: InvoiceParty;
  /** Invoice line items. */
  readonly lines: readonly InvoiceLine[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Guideline URNs keyed by profile. */
const GUIDELINE_URNS: Readonly<Record<FacturXProfile, string>> = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  'BASIC-WL': 'urn:factur-x.eu:1p0:basicwl',
  BASIC: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
  EN16931: 'urn:cen.eu:en16931:2017',
  EXTENDED:
    'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
};

/** Invoice type code 380 = "Commercial invoice" (UNTDID 1001). */
const COMMERCIAL_INVOICE_TYPE_CODE = '380';

/** VAT category code S = "Standard rate" (UNTDID 5305). */
const VAT_CATEGORY_STANDARD = 'S';

/** Unit code C62 = "one" (unitless piece, UN/ECE Rec 20). */
const UNIT_CODE_ONE = 'C62';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape XML special characters in a text value. */
function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Format a numeric monetary/quantity value with two decimal places. */
function formatAmount(value: number): string {
  return value.toFixed(2);
}

/** Format a percentage value, trimming an unnecessary trailing decimal. */
function formatPercent(value: number): string {
  return value.toFixed(2);
}

/**
 * Convert an ISO date ('YYYY-MM-DD') to UN/CEFACT date format 102
 * ('YYYYMMDD'). Any non-digit characters are stripped, so already
 * compact dates are passed through unchanged.
 */
function toDateString102(isoDate: string): string {
  return isoDate.replaceAll(/[^0-9]/g, '').slice(0, 8);
}

/** A tax subtotal grouped by rate. */
interface TaxGroup {
  readonly taxPercent: number;
  readonly basisAmount: number;
  readonly taxAmount: number;
}

/** Computed monetary totals for an invoice. */
interface InvoiceTotals {
  /** Sum of line net amounts (BT-106). */
  readonly lineTotal: number;
  /** Total VAT amount (BT-110). */
  readonly taxTotal: number;
  /** Grand total including tax (BT-112). */
  readonly grandTotal: number;
  /** Net amount payable, equal to grand total (BT-115). */
  readonly duePayable: number;
  /** VAT subtotals grouped by rate. */
  readonly taxGroups: readonly TaxGroup[];
}

/** Compute line totals, per-rate tax subtotals and grand totals. */
function computeTotals(lines: readonly InvoiceLine[]): InvoiceTotals {
  let lineTotal = 0;
  const groupsByRate = new Map<number, { basis: number; tax: number }>();

  for (const line of lines) {
    const net = line.quantity * line.unitPrice;
    lineTotal += net;
    const taxForLine = net * (line.taxPercent / 100);
    const existing = groupsByRate.get(line.taxPercent);
    if (existing) {
      existing.basis += net;
      existing.tax += taxForLine;
    } else {
      groupsByRate.set(line.taxPercent, { basis: net, tax: taxForLine });
    }
  }

  const taxGroups: TaxGroup[] = [];
  let taxTotal = 0;
  for (const [taxPercent, value] of groupsByRate) {
    taxTotal += value.tax;
    taxGroups.push({
      taxPercent,
      basisAmount: value.basis,
      taxAmount: value.tax,
    });
  }

  const grandTotal = lineTotal + taxTotal;
  return {
    lineTotal,
    taxTotal,
    grandTotal,
    duePayable: grandTotal,
    taxGroups,
  };
}

/** Render a single trade party block (Seller or Buyer). */
function renderParty(party: InvoiceParty, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}<ram:Name>${escapeXml(party.name)}</ram:Name>`);
  lines.push(`${indent}<ram:PostalTradeAddress>`);
  lines.push(
    `${indent}  <ram:CountryID>${escapeXml(party.countryCode)}</ram:CountryID>`,
  );
  lines.push(`${indent}</ram:PostalTradeAddress>`);
  if (party.vatId !== undefined && party.vatId !== '') {
    lines.push(`${indent}<ram:SpecifiedTaxRegistration>`);
    lines.push(
      `${indent}  <ram:ID schemeID="VA">${escapeXml(party.vatId)}</ram:ID>`,
    );
    lines.push(`${indent}</ram:SpecifiedTaxRegistration>`);
  }
  return lines.join('\n');
}

/** Render a single line item block. */
function renderLine(
  line: InvoiceLine,
  index: number,
  currency: string,
): string {
  const net = line.quantity * line.unitPrice;
  const out: string[] = [];
  out.push('    <ram:IncludedSupplyChainTradeLineItem>');
  out.push('      <ram:AssociatedDocumentLineDocument>');
  out.push(`        <ram:LineID>${index}</ram:LineID>`);
  out.push('      </ram:AssociatedDocumentLineDocument>');
  out.push('      <ram:SpecifiedTradeProduct>');
  out.push(
    `        <ram:Name>${escapeXml(line.description)}</ram:Name>`,
  );
  out.push('      </ram:SpecifiedTradeProduct>');
  out.push('      <ram:SpecifiedLineTradeAgreement>');
  out.push('        <ram:NetPriceProductTradePrice>');
  out.push(
    `          <ram:ChargeAmount>${formatAmount(line.unitPrice)}</ram:ChargeAmount>`,
  );
  out.push('        </ram:NetPriceProductTradePrice>');
  out.push('      </ram:SpecifiedLineTradeAgreement>');
  out.push('      <ram:SpecifiedLineTradeDelivery>');
  out.push(
    `        <ram:BilledQuantity unitCode="${UNIT_CODE_ONE}">${formatAmount(line.quantity)}</ram:BilledQuantity>`,
  );
  out.push('      </ram:SpecifiedLineTradeDelivery>');
  out.push('      <ram:SpecifiedLineTradeSettlement>');
  out.push('        <ram:ApplicableTradeTax>');
  out.push('          <ram:TypeCode>VAT</ram:TypeCode>');
  out.push(
    `          <ram:CategoryCode>${VAT_CATEGORY_STANDARD}</ram:CategoryCode>`,
  );
  out.push(
    `          <ram:RateApplicablePercent>${formatPercent(line.taxPercent)}</ram:RateApplicablePercent>`,
  );
  out.push('        </ram:ApplicableTradeTax>');
  out.push('        <ram:SpecifiedTradeSettlementLineMonetarySummation>');
  out.push(
    `          <ram:LineTotalAmount currencyID="${escapeXml(currency)}">${formatAmount(net)}</ram:LineTotalAmount>`,
  );
  out.push('        </ram:SpecifiedTradeSettlementLineMonetarySummation>');
  out.push('      </ram:SpecifiedLineTradeSettlement>');
  out.push('    </ram:IncludedSupplyChainTradeLineItem>');
  return out.join('\n');
}

/** Render one ApplicableTradeTax document-level group. */
function renderTaxGroup(group: TaxGroup, currency: string): string {
  const out: string[] = [];
  out.push('      <ram:ApplicableTradeTax>');
  out.push(
    `        <ram:CalculatedAmount currencyID="${escapeXml(currency)}">${formatAmount(group.taxAmount)}</ram:CalculatedAmount>`,
  );
  out.push('        <ram:TypeCode>VAT</ram:TypeCode>');
  out.push(
    `        <ram:BasisAmount currencyID="${escapeXml(currency)}">${formatAmount(group.basisAmount)}</ram:BasisAmount>`,
  );
  out.push(
    `        <ram:CategoryCode>${VAT_CATEGORY_STANDARD}</ram:CategoryCode>`,
  );
  out.push(
    `        <ram:RateApplicablePercent>${formatPercent(group.taxPercent)}</ram:RateApplicablePercent>`,
  );
  out.push('      </ram:ApplicableTradeTax>');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a UN/CEFACT Cross Industry Invoice (CII) XML document for
 * the given invoice and Factur-X / ZUGFeRD profile.
 *
 * The returned string is a well-formed XML document beginning with an
 * XML declaration and a `<rsm:CrossIndustryInvoice>` root element using
 * the standard `rsm`, `ram` and `udt` namespaces. All text values are
 * XML-escaped.
 *
 * @param invoice - The invoice data.
 * @param profile - The Factur-X / ZUGFeRD profile. Default: 'EN16931'.
 * @returns The CII XML document as a string.
 */
export function generateCiiXml(
  invoice: Invoice,
  profile: FacturXProfile = 'EN16931',
): string {
  const totals = computeTotals(invoice.lines);
  const currency = invoice.currency;
  const guidelineUrn = GUIDELINE_URNS[profile];

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<rsm:CrossIndustryInvoice' +
      ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
      ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
      ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  );

  // Document context (profile / guideline).
  out.push('  <rsm:ExchangedDocumentContext>');
  out.push('    <ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push(`      <ram:ID>${escapeXml(guidelineUrn)}</ram:ID>`);
  out.push('    </ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push('  </rsm:ExchangedDocumentContext>');

  // Exchanged document header.
  out.push('  <rsm:ExchangedDocument>');
  out.push(`    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>`);
  out.push(
    `    <ram:TypeCode>${COMMERCIAL_INVOICE_TYPE_CODE}</ram:TypeCode>`,
  );
  out.push('    <ram:IssueDateTime>');
  out.push(
    `      <udt:DateTimeString format="102">${toDateString102(invoice.issueDate)}</udt:DateTimeString>`,
  );
  out.push('    </ram:IssueDateTime>');
  out.push('  </rsm:ExchangedDocument>');

  // Supply chain trade transaction.
  out.push('  <rsm:SupplyChainTradeTransaction>');

  // Line items.
  for (const [i, line] of invoice.lines.entries()) {
    out.push(renderLine(line, i + 1, currency));
  }

  // Header trade agreement (seller / buyer).
  out.push('    <ram:ApplicableHeaderTradeAgreement>');
  out.push('      <ram:SellerTradeParty>');
  out.push(renderParty(invoice.seller, '        '));
  out.push('      </ram:SellerTradeParty>');
  out.push('      <ram:BuyerTradeParty>');
  out.push(renderParty(invoice.buyer, '        '));
  out.push('      </ram:BuyerTradeParty>');
  out.push('    </ram:ApplicableHeaderTradeAgreement>');

  // Header trade delivery (empty but required structurally).
  out.push('    <ram:ApplicableHeaderTradeDelivery/>');

  // Header trade settlement (tax + totals).
  out.push('    <ram:ApplicableHeaderTradeSettlement>');
  out.push(
    `      <ram:InvoiceCurrencyCode>${escapeXml(currency)}</ram:InvoiceCurrencyCode>`,
  );
  for (const group of totals.taxGroups) {
    out.push(renderTaxGroup(group, currency));
  }
  out.push('      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  out.push(
    `        <ram:LineTotalAmount currencyID="${escapeXml(currency)}">${formatAmount(totals.lineTotal)}</ram:LineTotalAmount>`,
  );
  out.push(
    `        <ram:TaxBasisTotalAmount currencyID="${escapeXml(currency)}">${formatAmount(totals.lineTotal)}</ram:TaxBasisTotalAmount>`,
  );
  out.push(
    `        <ram:TaxTotalAmount currencyID="${escapeXml(currency)}">${formatAmount(totals.taxTotal)}</ram:TaxTotalAmount>`,
  );
  out.push(
    `        <ram:GrandTotalAmount currencyID="${escapeXml(currency)}">${formatAmount(totals.grandTotal)}</ram:GrandTotalAmount>`,
  );
  out.push(
    `        <ram:DuePayableAmount currencyID="${escapeXml(currency)}">${formatAmount(totals.duePayable)}</ram:DuePayableAmount>`,
  );
  out.push('      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  out.push('    </ram:ApplicableHeaderTradeSettlement>');

  out.push('  </rsm:SupplyChainTradeTransaction>');
  out.push('</rsm:CrossIndustryInvoice>');

  return out.join('\n');
}

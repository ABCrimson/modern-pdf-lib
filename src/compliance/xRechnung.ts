/**
 * @module compliance/xRechnung
 *
 * XRechnung and Order-X electronic document profile generators.
 *
 * XRechnung is the German national CIUS (Core Invoice Usage Specification)
 * of EN 16931, mandated for invoicing German public-sector buyers. This
 * module emits the UN/CEFACT Cross Industry Invoice (CII) syntax variant
 * of XRechnung 3.x, carrying the KoSIT guideline URN and the mandatory
 * BT-DE-15 BuyerReference (Leitweg-ID).
 *
 * Order-X is the cross-industry electronic ordering counterpart to
 * Factur-X, built on the UN/CEFACT SCRDMCCBDACIOMessageStructure (Cross
 * Industry Order) schema. This module emits Order, OrderChange and
 * OrderResponse documents with the appropriate UNTDID 1001 document type
 * codes.
 *
 * Both generators are pure TypeScript string generation — no DOM is
 * required, so they run identically across Node, Deno, Bun, Cloudflare
 * Workers and browsers. They reuse the shared {@link Invoice} data model
 * from the Factur-X generator.
 *
 * References:
 * - XRechnung 3.0 specification (KoSIT)
 * - Order-X 1.0 specification (FNFE-MPE / FeRD)
 * - UN/CEFACT Cross Industry Invoice (CII) D16B
 * - EN 16931-1:2017 (European semantic invoice standard)
 */

import type { Invoice, InvoiceLine, InvoiceParty } from './facturX.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Additional XRechnung-specific options layered on top of {@link Invoice}. */
export interface XRechnungOptions {
  /**
   * Leitweg-ID (BT-DE-15 BuyerReference): the German routing identifier
   * addressing the public-sector buyer. Mandatory for XRechnung in
   * practice; emitted as the CII BuyerReference when provided.
   */
  readonly leitwegId?: string | undefined;
  /**
   * Buyer reference (BT-10). Falls back to {@link XRechnungOptions.leitwegId}
   * when omitted, since XRechnung carries the Leitweg-ID as BuyerReference.
   */
  readonly buyerReference?: string | undefined;
}

/** Order-X document kind, mapped to a UNTDID 1001 document type code. */
export type OrderXType = 'Order' | 'OrderChange' | 'OrderResponse';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * XRechnung 3.x guideline URN (CII / EN 16931 compliant CIUS).
 *
 * Carried in `GuidelineSpecifiedDocumentContextParameter/ID`.
 */
const XRECHNUNG_GUIDELINE_URN =
  'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';

/** Order-X EN 16931 guideline URN (Cross Industry Order, BASIC profile). */
const ORDER_X_GUIDELINE_URN =
  'urn:order-x.eu:1p0:basic';

/** Invoice type code 380 = "Commercial invoice" (UNTDID 1001). */
const COMMERCIAL_INVOICE_TYPE_CODE = '380';

/** Order document type code 220 = "Order" (UNTDID 1001). */
const ORDER_TYPE_CODE = '220';

/** Order document type code 230 = "Purchase order change request". */
const ORDER_CHANGE_TYPE_CODE = '230';

/** Order document type code 231 = "Purchase order response". */
const ORDER_RESPONSE_TYPE_CODE = '231';

/** VAT category code S = "Standard rate" (UNTDID 5305). */
const VAT_CATEGORY_STANDARD = 'S';

/** Unit code C62 = "one" (unitless piece, UN/ECE Rec 20). */
const UNIT_CODE_ONE = 'C62';

/** Document type codes keyed by Order-X document kind. */
const ORDER_X_TYPE_CODES: Readonly<Record<OrderXType, string>> = {
  Order: ORDER_TYPE_CODE,
  OrderChange: ORDER_CHANGE_TYPE_CODE,
  OrderResponse: ORDER_RESPONSE_TYPE_CODE,
};

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

/** Format a percentage value with two decimal places. */
function formatPercent(value: number): string {
  return value.toFixed(2);
}

/**
 * Convert an ISO date ('YYYY-MM-DD') to UN/CEFACT date format 102
 * ('YYYYMMDD'). Non-digit characters are stripped.
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

/** Computed monetary totals for an invoice/order. */
interface DocumentTotals {
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
function computeTotals(lines: readonly InvoiceLine[]): DocumentTotals {
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
  const out: string[] = [];
  out.push(`${indent}<ram:Name>${escapeXml(party.name)}</ram:Name>`);
  out.push(`${indent}<ram:PostalTradeAddress>`);
  out.push(
    `${indent}  <ram:CountryID>${escapeXml(party.countryCode)}</ram:CountryID>`,
  );
  out.push(`${indent}</ram:PostalTradeAddress>`);
  if (party.vatId !== undefined && party.vatId !== '') {
    out.push(`${indent}<ram:SpecifiedTaxRegistration>`);
    out.push(
      `${indent}  <ram:ID schemeID="VA">${escapeXml(party.vatId)}</ram:ID>`,
    );
    out.push(`${indent}</ram:SpecifiedTaxRegistration>`);
  }
  return out.join('\n');
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
  out.push(`        <ram:Name>${escapeXml(line.description)}</ram:Name>`);
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

/** Render one document-level ApplicableTradeTax group. */
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

/** Render the monetary summation block for the header settlement. */
function renderMonetarySummation(
  totals: DocumentTotals,
  currency: string,
): string {
  const out: string[] = [];
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
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// XRechnung generator
// ---------------------------------------------------------------------------

/**
 * Generate an XRechnung 3.x CII (Cross Industry Invoice) XML document.
 *
 * The document carries the KoSIT XRechnung guideline URN
 * (`urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`)
 * and, when a Leitweg-ID is supplied, the mandatory BT-DE-15 BuyerReference.
 *
 * @param invoice - The invoice data (shared {@link Invoice} model).
 * @param options - XRechnung-specific options (Leitweg-ID, buyer reference).
 * @returns A well-formed CII XML document string.
 */
export function generateXRechnungCii(
  invoice: Invoice,
  options: XRechnungOptions = {},
): string {
  const totals = computeTotals(invoice.lines);
  const currency = invoice.currency;
  const buyerReference = options.buyerReference ?? options.leitwegId;

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<rsm:CrossIndustryInvoice' +
      ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
      ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
      ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  );

  // Document context (XRechnung guideline).
  out.push('  <rsm:ExchangedDocumentContext>');
  out.push('    <ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push(`      <ram:ID>${escapeXml(XRECHNUNG_GUIDELINE_URN)}</ram:ID>`);
  out.push('    </ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push('  </rsm:ExchangedDocumentContext>');

  // Exchanged document header.
  out.push('  <rsm:ExchangedDocument>');
  out.push(`    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>`);
  out.push(`    <ram:TypeCode>${COMMERCIAL_INVOICE_TYPE_CODE}</ram:TypeCode>`);
  out.push('    <ram:IssueDateTime>');
  out.push(
    `      <udt:DateTimeString format="102">${toDateString102(invoice.issueDate)}</udt:DateTimeString>`,
  );
  out.push('    </ram:IssueDateTime>');
  out.push('  </rsm:ExchangedDocument>');

  // Supply chain trade transaction.
  out.push('  <rsm:SupplyChainTradeTransaction>');

  for (const [i, line] of invoice.lines.entries()) {
    out.push(renderLine(line, i + 1, currency));
  }

  // Header trade agreement (BuyerReference / Leitweg-ID + parties).
  out.push('    <ram:ApplicableHeaderTradeAgreement>');
  if (buyerReference !== undefined && buyerReference !== '') {
    out.push(
      `      <ram:BuyerReference>${escapeXml(buyerReference)}</ram:BuyerReference>`,
    );
  }
  out.push('      <ram:SellerTradeParty>');
  out.push(renderParty(invoice.seller, '        '));
  out.push('      </ram:SellerTradeParty>');
  out.push('      <ram:BuyerTradeParty>');
  out.push(renderParty(invoice.buyer, '        '));
  out.push('      </ram:BuyerTradeParty>');
  out.push('    </ram:ApplicableHeaderTradeAgreement>');

  out.push('    <ram:ApplicableHeaderTradeDelivery/>');

  // Header trade settlement (tax + totals).
  out.push('    <ram:ApplicableHeaderTradeSettlement>');
  out.push(
    `      <ram:InvoiceCurrencyCode>${escapeXml(currency)}</ram:InvoiceCurrencyCode>`,
  );
  for (const group of totals.taxGroups) {
    out.push(renderTaxGroup(group, currency));
  }
  out.push(renderMonetarySummation(totals, currency));
  out.push('    </ram:ApplicableHeaderTradeSettlement>');

  out.push('  </rsm:SupplyChainTradeTransaction>');
  out.push('</rsm:CrossIndustryInvoice>');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Order-X generator
// ---------------------------------------------------------------------------

/**
 * Generate an Order-X CII order document (Order, OrderChange or
 * OrderResponse) from the shared {@link Invoice} data model.
 *
 * The document is built on the UN/CEFACT SCRDMCCBDACIOMessageStructure
 * (Cross Industry Order) schema, carries the Order-X guideline URN
 * (`urn:order-x.eu:1p0:basic`) and the UNTDID 1001 document type code
 * appropriate for the requested {@link OrderXType} (220 Order / 230
 * OrderChange / 231 OrderResponse).
 *
 * @param invoice - The order data (reusing the shared {@link Invoice} model).
 * @param orderType - The kind of Order-X document to produce.
 * @returns A well-formed Order-X CII XML document string.
 */
export function generateOrderX(
  invoice: Invoice,
  orderType: OrderXType,
): string {
  const totals = computeTotals(invoice.lines);
  const currency = invoice.currency;
  const typeCode = ORDER_X_TYPE_CODES[orderType];

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<rsm:SCRDMCCBDACIOMessageStructure' +
      ' xmlns:rsm="urn:un:unece:uncefact:data:standard:SCRDMCCBDACIOMessageStructure:100"' +
      ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:128"' +
      ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:128">',
  );

  // Document context (Order-X guideline).
  out.push('  <rsm:ExchangedDocumentContext>');
  out.push('    <ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push(`      <ram:ID>${escapeXml(ORDER_X_GUIDELINE_URN)}</ram:ID>`);
  out.push('    </ram:GuidelineSpecifiedDocumentContextParameter>');
  out.push('  </rsm:ExchangedDocumentContext>');

  // Exchanged document header (order id + type code + issue date).
  out.push('  <rsm:ExchangedDocument>');
  out.push(`    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>`);
  out.push(`    <ram:TypeCode>${typeCode}</ram:TypeCode>`);
  out.push('    <ram:IssueDateTime>');
  out.push(
    `      <udt:DateTimeString format="102">${toDateString102(invoice.issueDate)}</udt:DateTimeString>`,
  );
  out.push('    </ram:IssueDateTime>');
  out.push('  </rsm:ExchangedDocument>');

  // Supply chain trade transaction.
  out.push('  <rsm:SupplyChainTradeTransaction>');

  for (const [i, line] of invoice.lines.entries()) {
    out.push(renderLine(line, i + 1, currency));
  }

  // Header trade agreement (buyer issues the order -> buyer + seller).
  out.push('    <ram:ApplicableHeaderTradeAgreement>');
  out.push('      <ram:BuyerTradeParty>');
  out.push(renderParty(invoice.buyer, '        '));
  out.push('      </ram:BuyerTradeParty>');
  out.push('      <ram:SellerTradeParty>');
  out.push(renderParty(invoice.seller, '        '));
  out.push('      </ram:SellerTradeParty>');
  out.push('    </ram:ApplicableHeaderTradeAgreement>');

  out.push('    <ram:ApplicableHeaderTradeDelivery/>');

  // Header trade settlement (currency + tax + totals).
  out.push('    <ram:ApplicableHeaderTradeSettlement>');
  out.push(
    `      <ram:OrderCurrencyCode>${escapeXml(currency)}</ram:OrderCurrencyCode>`,
  );
  for (const group of totals.taxGroups) {
    out.push(renderTaxGroup(group, currency));
  }
  out.push(renderMonetarySummation(totals, currency));
  out.push('    </ram:ApplicableHeaderTradeSettlement>');

  out.push('  </rsm:SupplyChainTradeTransaction>');
  out.push('</rsm:SCRDMCCBDACIOMessageStructure>');

  return out.join('\n');
}

/**
 * @module compliance/ciiReader
 *
 * Inbound UN/CEFACT Cross Industry Invoice (CII) reader.
 *
 * This is the inverse of {@link generateCiiXml} in
 * {@link module:compliance/facturX}: it parses a CII XML string
 * (a Factur-X / ZUGFeRD invoice payload) back into the typed
 * {@link Invoice} model.
 *
 * The parser is deliberately lightweight — it uses tag extraction with
 * regular expressions rather than a full DOM/XML library, so it runs
 * identically across Node, Deno, Bun, Cloudflare Workers and browsers
 * with no external dependency. It is tolerant of namespace prefixes by
 * matching on the *local* element name (the part after any `prefix:`),
 * so documents using `ram:` / `rsm:` / `udt:`, alternative prefixes, or
 * no prefixes at all are all handled.
 *
 * Mapped CII paths (local element names):
 * - `ExchangedDocument/ID` ............ → {@link Invoice.invoiceNumber}
 * - `ExchangedDocument/IssueDateTime/DateTimeString` (format 102)
 *                                       → {@link Invoice.issueDate}
 * - `SellerTradeParty/Name` ........... → {@link Invoice.seller}.name
 * - `BuyerTradeParty/Name` ............ → {@link Invoice.buyer}.name
 * - `…TradeParty/PostalTradeAddress/CountryID`
 *                                       → party countryCode
 * - `…TradeParty/SpecifiedTaxRegistration/ID` → party vatId
 * - `IncludedSupplyChainTradeLineItem` entries → {@link Invoice.lines}
 * - `InvoiceCurrencyCode` ............. → {@link Invoice.currency}
 * - `GuidelineSpecifiedDocumentContextParameter/ID`
 *                                       → {@link FacturXProfile}
 *
 * References:
 * - UN/CEFACT Cross Industry Invoice (CII) D16B
 * - EN 16931-1:2017 (European semantic invoice standard)
 * - Factur-X 1.0 / ZUGFeRD 2.x specification
 */

import type {
  FacturXProfile,
  Invoice,
  InvoiceLine,
  InvoiceParty,
} from './facturX.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Guideline URNs keyed by profile.
 *
 * This mirrors the (non-exported) table in {@link module:compliance/facturX}
 * and is used to reverse-map a `GuidelineSpecifiedDocumentContextParameter/ID`
 * value back to a {@link FacturXProfile}.
 */
const GUIDELINE_URNS: Readonly<Record<FacturXProfile, string>> = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  'BASIC-WL': 'urn:factur-x.eu:1p0:basicwl',
  BASIC: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
  EN16931: 'urn:cen.eu:en16931:2017',
  EXTENDED:
    'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
};

// ---------------------------------------------------------------------------
// Low-level XML helpers (namespace-prefix tolerant)
// ---------------------------------------------------------------------------

/** Reverse of the generator's XML escaping. */
function unescapeXml(str: string): string {
  return str
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** Escape a string for safe inclusion in a RegExp. */
function escapeRegExp(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a RegExp that matches `<[prefix:]name …>content</[prefix:]name>`
 * for the given local element name, ignoring any namespace prefix and
 * any attributes on the opening tag. The first capture group is the
 * (raw, still-escaped) inner content.
 */
function elementRegExp(localName: string): RegExp {
  const n = escapeRegExp(localName);
  // (?:[\w.-]+:)?  optional namespace prefix
  // [^>]*          any attributes on the open tag
  // ([\s\S]*?)     inner content (non-greedy, may span lines)
  return new RegExp(
    `<(?:[\\w.-]+:)?${n}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${n}>`,
  );
}

/**
 * Extract the inner text of the first matching element (by local name)
 * within the given XML fragment, unescaped. Returns `undefined` if the
 * element is absent.
 */
function firstText(xml: string, localName: string): string | undefined {
  const match = elementRegExp(localName).exec(xml);
  if (match === null) return undefined;
  const inner = match[1];
  if (inner === undefined) return undefined;
  return unescapeXml(inner.trim());
}

/**
 * Extract the inner XML fragment (still containing child markup) of the
 * first matching element by local name. Returns `undefined` if absent.
 */
function firstFragment(xml: string, localName: string): string | undefined {
  const match = elementRegExp(localName).exec(xml);
  if (match === null) return undefined;
  return match[1] ?? undefined;
}

/**
 * Extract every non-overlapping block matching the given local element
 * name, returning each block's inner XML fragment.
 */
function allFragments(xml: string, localName: string): string[] {
  const n = escapeRegExp(localName);
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${n}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${n}>`,
    'g',
  );
  const out: string[] = [];
  let match: RegExpExecArray | null = re.exec(xml);
  while (match !== null) {
    const inner = match[1];
    if (inner !== undefined) out.push(inner);
    match = re.exec(xml);
  }
  return out;
}

/**
 * Parse a numeric text value, returning `0` when the value is missing or
 * not a finite number.
 */
function parseNumber(text: string | undefined): number {
  if (text === undefined) return 0;
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Convert a UN/CEFACT date-format-102 string (`YYYYMMDD`) to an ISO date
 * string (`YYYY-MM-DD`). Inputs that are not 8 digits are returned
 * unchanged (best effort).
 */
function fromDateString102(value: string): string {
  const digits = value.replaceAll(/[^0-9]/g, '');
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// ---------------------------------------------------------------------------
// Party / line parsing
// ---------------------------------------------------------------------------

/** Parse a single trade-party fragment into an {@link InvoiceParty}. */
function parseParty(fragment: string): InvoiceParty {
  const name = firstText(fragment, 'Name') ?? '';
  const countryCode = firstText(fragment, 'CountryID') ?? '';

  // The VAT registration is `<SpecifiedTaxRegistration><ID …>…</ID>`.
  // Restrict the ID lookup to the tax-registration sub-fragment so we do
  // not accidentally pick up an unrelated ID elsewhere in the party.
  const taxReg = firstFragment(fragment, 'SpecifiedTaxRegistration');
  const vatId =
    taxReg !== undefined ? firstText(taxReg, 'ID') : undefined;

  // Honour exactOptionalPropertyTypes: only include vatId when present.
  return vatId !== undefined && vatId !== ''
    ? { name, countryCode, vatId }
    : { name, countryCode };
}

/** Parse a single line-item fragment into an {@link InvoiceLine}. */
function parseLine(fragment: string): InvoiceLine {
  // Product name lives in SpecifiedTradeProduct/Name; scope to that block
  // so we never collide with other Name elements.
  const productFragment = firstFragment(fragment, 'SpecifiedTradeProduct');
  const description =
    (productFragment !== undefined
      ? firstText(productFragment, 'Name')
      : firstText(fragment, 'Name')) ?? '';

  // Unit price: NetPriceProductTradePrice/ChargeAmount.
  const priceFragment = firstFragment(
    fragment,
    'NetPriceProductTradePrice',
  );
  const unitPrice = parseNumber(
    priceFragment !== undefined
      ? firstText(priceFragment, 'ChargeAmount')
      : firstText(fragment, 'ChargeAmount'),
  );

  // Quantity: BilledQuantity (unitCode attribute is ignored).
  const quantity = parseNumber(firstText(fragment, 'BilledQuantity'));

  // Tax rate: ApplicableTradeTax/RateApplicablePercent.
  const taxPercent = parseNumber(
    firstText(fragment, 'RateApplicablePercent'),
  );

  return { description, quantity, unitPrice, taxPercent };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a UN/CEFACT Cross Industry Invoice (CII) XML string into the
 * typed {@link Invoice} model.
 *
 * The parser is namespace-prefix tolerant (it matches on local element
 * names) and recovers the invoice number, issue date, currency, the
 * seller and buyer parties (name, country, VAT id) and every line item
 * (description, quantity, unit price, tax rate).
 *
 * @param xml - The CII XML document.
 * @returns The parsed {@link Invoice}.
 * @throws If the input does not contain a `CrossIndustryInvoice` root.
 */
export function parseCiiXml(xml: string): Invoice {
  const root = firstFragment(xml, 'CrossIndustryInvoice');
  if (root === undefined) {
    throw new Error(
      'ciiReader: not a CrossIndustryInvoice document ' +
        '(no <CrossIndustryInvoice> root element found).',
    );
  }

  // Header document: ID, type code, issue date.
  const docFragment = firstFragment(root, 'ExchangedDocument') ?? root;
  const invoiceNumber = firstText(docFragment, 'ID') ?? '';
  const issueRaw = firstText(docFragment, 'DateTimeString') ?? '';
  const issueDate =
    issueRaw === '' ? '' : fromDateString102(issueRaw);

  // Currency.
  const currency = firstText(root, 'InvoiceCurrencyCode') ?? '';

  // Parties — scope name/country/VAT lookups to each party block.
  const sellerFragment = firstFragment(root, 'SellerTradeParty');
  const buyerFragment = firstFragment(root, 'BuyerTradeParty');
  const seller: InvoiceParty =
    sellerFragment !== undefined
      ? parseParty(sellerFragment)
      : { name: '', countryCode: '' };
  const buyer: InvoiceParty =
    buyerFragment !== undefined
      ? parseParty(buyerFragment)
      : { name: '', countryCode: '' };

  // Line items.
  const lineFragments = allFragments(
    root,
    'IncludedSupplyChainTradeLineItem',
  );
  const lines: readonly InvoiceLine[] = lineFragments.map(parseLine);

  return {
    invoiceNumber,
    issueDate,
    currency,
    seller,
    buyer,
    lines,
  };
}

/**
 * Detect the Factur-X / ZUGFeRD profile of a CII XML document by reading
 * its `GuidelineSpecifiedDocumentContextParameter/ID` (the profile URN)
 * and mapping it back to a {@link FacturXProfile}.
 *
 * @param xml - The CII XML document.
 * @returns The matching {@link FacturXProfile}, or `undefined` if no
 *   guideline URN is present or it does not match a known profile.
 */
export function detectFacturXProfile(
  xml: string,
): FacturXProfile | undefined {
  const contextFragment = firstFragment(
    xml,
    'GuidelineSpecifiedDocumentContextParameter',
  );
  if (contextFragment === undefined) return undefined;

  const urn = firstText(contextFragment, 'ID');
  if (urn === undefined || urn === '') return undefined;

  for (const profile of Object.keys(GUIDELINE_URNS) as FacturXProfile[]) {
    if (GUIDELINE_URNS[profile] === urn) return profile;
  }
  return undefined;
}

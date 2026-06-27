/**
 * @module compliance/facturXAssemble
 *
 * High-level Factur-X / ZUGFeRD assembler.
 *
 * Turns a typed {@link Invoice} plus a {@link PdfDocument} into a hybrid
 * Factur-X PDF/A-3 electronic invoice:
 *
 * 1. Generate the UN/CEFACT Cross Industry Invoice (CII) XML for the invoice
 *    and profile via {@link generateCiiXml}.
 * 2. Attach that XML to the document as a PDF/A-3 *associated file* with the
 *    `/Alternative` relationship — the relationship mandated by the Factur-X /
 *    ZUGFeRD specification (the XML is an alternative, machine-readable
 *    representation of the human-readable PDF page content).
 *
 * In a fully conformant Factur-X file the PDF/A-3 XMP metadata must additionally
 * carry the Factur-X extension schema (the `fx:` namespace, declaring
 * `DocumentType`, `DocumentFileName`, `Version` and `ConformanceLevel`). That
 * XMP is produced by {@link buildFacturXXmp} and is intended to be merged into
 * the document's overall metadata by the caller — this module does not mutate
 * the document's metadata stream, keeping the assembler side-effect-scoped to
 * the `/AF` attachment.
 *
 * Verified references (against the official Factur-X 1.0 / ZUGFeRD 2.x
 * reference XMP — PDFlib GmbH sample shipped in akretion/factur-x):
 * - Schema namespace URI: `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#`
 * - Preferred prefix: `fx`
 * - Properties: `DocumentType` (always `INVOICE`), `DocumentFileName` (must match
 *   the embedded XML file name), `Version` (the Factur-X XML schema version,
 *   `1.0`), `ConformanceLevel` (the profile name).
 * - The PDF/A extension-schema description (`pdfaExtension:schemas`) is mandatory
 *   for PDF/A-3 conformance and is included verbatim per the reference sample.
 *
 * References:
 * - Factur-X 1.0 / ZUGFeRD 2.x specification (FNFE-MPE / FeRD)
 * - ISO 19005-3:2012 (PDF/A-3) §6.6, §6.8 (XMP + associated files)
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import type { Invoice, FacturXProfile } from './facturX.js';
import { generateCiiXml } from './facturX.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for {@link assembleFacturX}. */
export interface FacturXAssembleOptions {
  /** Factur-X / ZUGFeRD profile (conformance level). Default: `'EN16931'`. */
  readonly profile?: FacturXProfile | undefined;
  /** Embedded XML file name. Default: `'factur-x.xml'`. */
  readonly filename?: string | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default profile when none is supplied. */
const DEFAULT_PROFILE: FacturXProfile = 'EN16931';

/** Default embedded XML file name mandated by the Factur-X specification. */
const DEFAULT_FILENAME = 'factur-x.xml';

/** Factur-X XMP extension-schema namespace URI (verified). */
const FX_NAMESPACE_URI =
  'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

/** Factur-X XML schema version carried in `fx:Version` (verified: `1.0`). */
const FX_VERSION = '1.0';

/**
 * `fx:ConformanceLevel` strings keyed by profile.
 *
 * These are the human-readable profile names defined by the Factur-X
 * specification (note the embedded spaces in `BASIC WL` and `EN 16931`),
 * which differ from this library's internal {@link FacturXProfile} enum
 * tokens (`'BASIC-WL'`, `'EN16931'`). Verified against the Factur-X 1.0
 * specification.
 */
const CONFORMANCE_LEVELS: Readonly<Record<FacturXProfile, string>> = {
  MINIMUM: 'MINIMUM',
  'BASIC-WL': 'BASIC WL',
  BASIC: 'BASIC',
  EN16931: 'EN 16931',
  EXTENDED: 'EXTENDED',
};

const encoder = new TextEncoder();

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

// ---------------------------------------------------------------------------
// XMP
// ---------------------------------------------------------------------------

/**
 * Build the Factur-X PDF/A-3 XMP extension metadata.
 *
 * Returns an XMP RDF fragment containing two `rdf:Description` blocks:
 *
 * 1. The **actual Factur-X values** in the `fx:` namespace —
 *    `fx:DocumentType` (`INVOICE`), `fx:DocumentFileName`, `fx:Version`
 *    (`1.0`) and `fx:ConformanceLevel` (derived from `profile`).
 * 2. The **PDF/A extension-schema description** (`pdfaExtension:schemas`),
 *    which is required for PDF/A-3 conformance so that validators can resolve
 *    the custom `fx:` properties.
 *
 * The fragment is rooted at `<rdf:RDF>` so it can be merged into a larger XMP
 * packet (e.g. alongside the `pdfaid`, `dc`, `xmp` and `pdf` descriptions
 * produced by the PDF/A XMP generator).
 *
 * @param profile          The Factur-X / ZUGFeRD profile.
 * @param documentFileName The embedded XML file name. Must match the name under
 *                         which the XML is attached. Default: `'factur-x.xml'`.
 * @returns                The XMP RDF string.
 */
export function buildFacturXXmp(
  profile: FacturXProfile,
  documentFileName: string = DEFAULT_FILENAME,
): string {
  const conformanceLevel = CONFORMANCE_LEVELS[profile];
  const fileName = escapeXml(documentFileName);

  const out: string[] = [];
  out.push(
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
  );

  // 1. The actual Factur-X properties.
  out.push(
    `  <rdf:Description rdf:about="" xmlns:fx="${FX_NAMESPACE_URI}">`,
  );
  out.push(
    `    <fx:ConformanceLevel>${escapeXml(conformanceLevel)}</fx:ConformanceLevel>`,
  );
  out.push(`    <fx:DocumentFileName>${fileName}</fx:DocumentFileName>`);
  out.push('    <fx:DocumentType>INVOICE</fx:DocumentType>');
  out.push(`    <fx:Version>${FX_VERSION}</fx:Version>`);
  out.push('  </rdf:Description>');

  // 2. The PDF/A extension-schema description (mandatory for PDF/A-3).
  out.push('  <rdf:Description rdf:about=""');
  out.push(
    '    xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"',
  );
  out.push('    xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"');
  out.push(
    '    xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">',
  );
  out.push('    <pdfaExtension:schemas>');
  out.push('      <rdf:Bag>');
  out.push('        <rdf:li rdf:parseType="Resource">');
  out.push(
    '          <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>',
  );
  out.push(
    `          <pdfaSchema:namespaceURI>${FX_NAMESPACE_URI}</pdfaSchema:namespaceURI>`,
  );
  out.push('          <pdfaSchema:prefix>fx</pdfaSchema:prefix>');
  out.push('          <pdfaSchema:property>');
  out.push('            <rdf:Seq>');
  for (const [name, description] of [
    ['DocumentFileName', 'name of the embedded XML invoice file'],
    ['DocumentType', 'INVOICE'],
    ['Version', 'The actual version of the Factur-X XML schema'],
    [
      'ConformanceLevel',
      'The conformance level of the embedded Factur-X data',
    ],
  ] as const) {
    out.push('              <rdf:li rdf:parseType="Resource">');
    out.push(`                <pdfaProperty:name>${name}</pdfaProperty:name>`);
    out.push('                <pdfaProperty:valueType>Text</pdfaProperty:valueType>');
    out.push('                <pdfaProperty:category>external</pdfaProperty:category>');
    out.push(
      `                <pdfaProperty:description>${escapeXml(description)}</pdfaProperty:description>`,
    );
    out.push('              </rdf:li>');
  }
  out.push('            </rdf:Seq>');
  out.push('          </pdfaSchema:property>');
  out.push('        </rdf:li>');
  out.push('      </rdf:Bag>');
  out.push('    </pdfaExtension:schemas>');
  out.push('  </rdf:Description>');

  out.push('</rdf:RDF>');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Assembler
// ---------------------------------------------------------------------------

/**
 * Assemble a hybrid Factur-X PDF/A-3 invoice.
 *
 * Generates the CII XML for `invoice` under the requested profile, encodes it
 * as UTF-8 bytes and attaches it to `doc` as a PDF/A-3 associated file with the
 * `/Alternative` relationship (referenced from the catalog `/AF` array).
 *
 * The XMP from {@link buildFacturXXmp} can be merged into the document's
 * metadata by the caller to complete PDF/A-3 / Factur-X conformance.
 *
 * @param doc      The target PDF document (should already be PDF/A-3 shaped).
 * @param invoice  The invoice data.
 * @param options  Optional profile and embedded file name.
 * @returns        The generated CII XML string.
 */
export function assembleFacturX(
  doc: PdfDocument,
  invoice: Invoice,
  options?: FacturXAssembleOptions,
): string {
  const profile = options?.profile ?? DEFAULT_PROFILE;
  const filename = options?.filename ?? DEFAULT_FILENAME;

  const xml = generateCiiXml(invoice, profile);
  const bytes = encoder.encode(xml);

  doc.addAssociatedFile(filename, bytes, 'text/xml', 'Alternative', {
    description: 'Factur-X invoice data',
  });

  return xml;
}

/**
 * @module compliance/pdfA4
 *
 * PDF/A-4 conformance metadata generator (ISO 19005-4:2020).
 *
 * PDF/A-4 is the fourth part of the PDF/A standard, based on PDF 2.0
 * (ISO 32000-2). Unlike earlier parts, PDF/A-4 drops the A/B/U
 * conformance levels of its core profile and instead introduces two
 * named conformance variants:
 *
 * - **PDF/A-4**  — the base conformance level (no `pdfaid:conformance`).
 * - **PDF/A-4e** — engineering variant, permits embedded 3D/RichMedia
 *   content (`pdfaid:conformance = 'E'`).
 * - **PDF/A-4f** — variant that explicitly permits embedded files of
 *   arbitrary type (`pdfaid:conformance = 'F'`).
 *
 * All PDF/A-4 documents declare `pdfaid:part = 4` and the revision year
 * `pdfaid:rev = 2020`.
 *
 * This module performs pure string / XMP packet generation — it does not
 * mutate any PDF document object.
 *
 * Reference: ISO 19005-4:2020 §5 (file format), §6.1 (metadata).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Supported PDF/A-4 conformance variants. */
export type PdfA4Level = 'PDF/A-4' | 'PDF/A-4e' | 'PDF/A-4f';

/** A single property within a PDF/A extension schema. */
export interface PdfA4ExtensionProperty {
  /** Property name. */
  readonly name: string;
  /** XMP value type (e.g. 'Text', 'Integer', 'Boolean'). */
  readonly valueType: string;
  /** Whether the property is internally or externally derived. */
  readonly category: 'internal' | 'external';
  /** Human-readable description of the property. */
  readonly description: string;
}

/** Describes a PDF/A extension schema for non-standard XMP namespaces. */
export interface PdfA4ExtensionSchema {
  /** Namespace URI of the extended schema. */
  readonly namespaceUri: string;
  /** Preferred namespace prefix. */
  readonly prefix: string;
  /** Human-readable schema name. */
  readonly schema: string;
  /** Properties defined by this schema. */
  readonly properties: readonly PdfA4ExtensionProperty[];
}

/** Options for generating PDF/A-4 XMP metadata. */
export interface PdfA4Options {
  /** Conformance variant. Default: `'PDF/A-4'`. */
  readonly level?: PdfA4Level | undefined;
  /** Document title (Dublin Core `dc:title`). */
  readonly title?: string | undefined;
  /** Extension schemas to declare under `pdfaExtension:schemas`. */
  readonly extensionSchemas?: readonly PdfA4ExtensionSchema[] | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PDF/A part number for every PDF/A-4 document. */
const PDFA4_PART = 4;

/** PDF/A-4 revision year (`pdfaid:rev`). */
const PDFA4_REV = '2020';

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

/** Escape XML special characters in a string. */
function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Map a conformance variant to its `pdfaid:conformance` value, or
 * `undefined` for the base `'PDF/A-4'` level which has none.
 */
function conformanceFor(level: PdfA4Level): string | undefined {
  switch (level) {
    case 'PDF/A-4e':
      return 'E';
    case 'PDF/A-4f':
      return 'F';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Extension schema rendering
// ---------------------------------------------------------------------------

/** Render a single extension schema as a `pdfaSchema` `rdf:li` block. */
function renderExtensionSchema(s: PdfA4ExtensionSchema): string {
  let out = '';
  out += '          <rdf:li rdf:parseType="Resource">\n';
  out += `            <pdfaSchema:schema>${escapeXml(s.schema)}</pdfaSchema:schema>\n`;
  out += `            <pdfaSchema:namespaceURI>${escapeXml(s.namespaceUri)}</pdfaSchema:namespaceURI>\n`;
  out += `            <pdfaSchema:prefix>${escapeXml(s.prefix)}</pdfaSchema:prefix>\n`;
  out += '            <pdfaSchema:property>\n';
  out += '              <rdf:Seq>\n';
  for (const p of s.properties) {
    out += '                <rdf:li rdf:parseType="Resource">\n';
    out += `                  <pdfaProperty:name>${escapeXml(p.name)}</pdfaProperty:name>\n`;
    out += `                  <pdfaProperty:valueType>${escapeXml(p.valueType)}</pdfaProperty:valueType>\n`;
    out += `                  <pdfaProperty:category>${p.category}</pdfaProperty:category>\n`;
    out += `                  <pdfaProperty:description>${escapeXml(p.description)}</pdfaProperty:description>\n`;
    out += '                </rdf:li>\n';
  }
  out += '              </rdf:Seq>\n';
  out += '            </pdfaSchema:property>\n';
  out += '          </rdf:li>\n';
  return out;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Build a complete XMP metadata packet for a PDF/A-4 document.
 *
 * The packet declares the mandatory PDF/A identification fields
 * (`pdfaid:part = 4`, `pdfaid:rev = 2020`, and `pdfaid:conformance`
 * for the `e`/`f` variants), an optional `dc:title`, and a
 * `pdfaExtension:schemas` bag describing any supplied extension schemas.
 *
 * @param options - PDF/A-4 metadata options.
 * @returns A well-formed XMP packet as a string.
 */
export function buildPdfA4Xmp(options?: PdfA4Options): string {
  const level: PdfA4Level = options?.level ?? 'PDF/A-4';
  const conformance = conformanceFor(level);
  const title = options?.title;
  const schemas = options?.extensionSchemas ?? [];

  let xmp = '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>\n';
  xmp += '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n';
  xmp += '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n';

  // PDF/A identification (mandatory).
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">\n';
  xmp += `      <pdfaid:part>${PDFA4_PART}</pdfaid:part>\n`;
  xmp += `      <pdfaid:rev>${PDFA4_REV}</pdfaid:rev>\n`;
  if (conformance !== undefined) {
    xmp += `      <pdfaid:conformance>${conformance}</pdfaid:conformance>\n`;
  }
  xmp += '    </rdf:Description>\n';

  // Dublin Core metadata.
  if (title !== undefined) {
    xmp += '    <rdf:Description rdf:about=""\n';
    xmp += '      xmlns:dc="http://purl.org/dc/elements/1.1/">\n';
    xmp += '      <dc:title>\n';
    xmp += '        <rdf:Alt>\n';
    xmp += `          <rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li>\n`;
    xmp += '        </rdf:Alt>\n';
    xmp += '      </dc:title>\n';
    xmp += '    </rdf:Description>\n';
  }

  // PDF/A extension schemas.
  if (schemas.length > 0) {
    xmp += '    <rdf:Description rdf:about=""\n';
    xmp += '      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"\n';
    xmp += '      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"\n';
    xmp += '      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">\n';
    xmp += '      <pdfaExtension:schemas>\n';
    xmp += '        <rdf:Bag>\n';
    for (const s of schemas) {
      xmp += renderExtensionSchema(s);
    }
    xmp += '        </rdf:Bag>\n';
    xmp += '      </pdfaExtension:schemas>\n';
    xmp += '    </rdf:Description>\n';
  }

  xmp += '  </rdf:RDF>\n';
  xmp += '</x:xmpmeta>\n';
  xmp += '<?xpacket end="w"?>';

  return xmp;
}

/**
 * Return the human-readable conformance requirements for a PDF/A-4
 * variant.
 *
 * @param level - Conformance variant. Default: `'PDF/A-4'`.
 * @returns An ordered list of requirement strings.
 */
export function pdfA4Rules(level?: PdfA4Level): readonly string[] {
  const resolved: PdfA4Level = level ?? 'PDF/A-4';

  const rules: string[] = [
    'XMP metadata is required and must declare pdfaid:part = 4 and pdfaid:rev = 2020.',
    'All fonts must be embedded, including standard 14 fonts.',
    'Encryption is not permitted; the document must not be encrypted.',
    'A PDF/A OutputIntent with a valid ICC destination profile is required for device-dependent color.',
    'All annotations and form fields must use legal, embedded appearance streams.',
    'Non-standard XMP namespaces must be declared via a pdfaExtension extension schema.',
    'The document must conform to PDF 2.0 (ISO 32000-2) syntax.',
  ];

  if (resolved === 'PDF/A-4f') {
    rules.push(
      'Embedded files of any type are allowed (PDF/A-4f), and may be associated via AFRelationship.',
    );
  } else if (resolved === 'PDF/A-4e') {
    rules.push(
      'Embedded 3D and RichMedia content is allowed (PDF/A-4e) when accompanied by conforming metadata.',
    );
  } else {
    rules.push(
      'Embedded files must themselves be PDF/A compliant (base PDF/A-4); arbitrary embedded files require PDF/A-4f.',
    );
  }

  return rules;
}

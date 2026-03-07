/**
 * @module compliance/xmpGenerator
 *
 * XMP metadata generator for PDF/A documents.
 *
 * Generates well-formed XMP metadata packets that include all
 * mandatory and recommended PDF/A fields. Uses the correct
 * namespace URIs and element structures.
 *
 * Mandatory fields (per ISO 19005):
 * - pdfaid:part — PDF/A part number (1, 2, or 3)
 * - pdfaid:conformance — Conformance level (A, B, or U)
 *
 * Recommended fields:
 * - dc:title — Document title (Dublin Core)
 * - dc:creator — Document author (Dublin Core)
 * - dc:description — Document subject/description (Dublin Core)
 * - xmp:CreatorTool — Creator application name
 * - xmp:CreateDate — Creation date in ISO 8601
 * - xmp:ModifyDate — Modification date in ISO 8601
 * - pdf:Producer — PDF producer application
 * - pdf:Keywords — Document keywords
 *
 * Reference: ISO 19005-1:2005 §6.6, ISO 19005-2:2011 §6.6, ISO 19005-3:2012 §6.6.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for generating PDF/A XMP metadata. */
export interface PdfAXmpOptions {
  /** PDF/A part number (1, 2, or 3). */
  readonly part: number;
  /** PDF/A conformance level ('A', 'B', or 'U'). */
  readonly conformance: string;
  /** Document title. */
  readonly title?: string;
  /** Document author. */
  readonly author?: string;
  /** Document subject/description. */
  readonly subject?: string;
  /** Keywords. */
  readonly keywords?: string;
  /** Creator tool name. Default: 'modern-pdf-lib'. */
  readonly creatorTool?: string;
  /** PDF producer name. Default: 'modern-pdf-lib'. */
  readonly producer?: string;
  /** Creation date (ISO 8601). Default: current date. */
  readonly createDate?: string;
  /** Modification date (ISO 8601). Default: current date. */
  readonly modifyDate?: string;
  /** Document language (BCP 47). Default: 'en'. */
  readonly language?: string;
}

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

/** Escape XML special characters in a string. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a complete XMP metadata packet for PDF/A.
 *
 * The returned string is a well-formed XMP packet wrapped in
 * `<?xpacket ...?>` processing instructions and containing separate
 * `rdf:Description` blocks for each namespace.
 *
 * @param options - Metadata options including the mandatory `part`
 *                  and `conformance` fields.
 * @returns XMP metadata as a string.
 */
export function generatePdfAXmp(options: PdfAXmpOptions): string {
  const now = new Date().toISOString();
  const createDate = options.createDate ?? now;
  const modifyDate = options.modifyDate ?? now;
  const creatorTool = options.creatorTool ?? 'modern-pdf-lib';
  const producer = options.producer ?? 'modern-pdf-lib';
  const lang = options.language ?? 'en';

  let xmp = '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>\n';
  xmp += '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n';
  xmp += '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n';

  // PDF/A identification (mandatory)
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">\n';
  xmp += `      <pdfaid:part>${options.part}</pdfaid:part>\n`;
  xmp += `      <pdfaid:conformance>${options.conformance}</pdfaid:conformance>\n`;
  xmp += '    </rdf:Description>\n';

  // Dublin Core metadata
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:dc="http://purl.org/dc/elements/1.1/">\n';
  if (options.title) {
    xmp += '      <dc:title>\n';
    xmp += '        <rdf:Alt>\n';
    xmp += `          <rdf:li xml:lang="${lang}">${escapeXml(options.title)}</rdf:li>\n`;
    xmp += '        </rdf:Alt>\n';
    xmp += '      </dc:title>\n';
  }
  if (options.author) {
    xmp += '      <dc:creator>\n';
    xmp += '        <rdf:Seq>\n';
    xmp += `          <rdf:li>${escapeXml(options.author)}</rdf:li>\n`;
    xmp += '        </rdf:Seq>\n';
    xmp += '      </dc:creator>\n';
  }
  if (options.subject) {
    xmp += '      <dc:description>\n';
    xmp += '        <rdf:Alt>\n';
    xmp += `          <rdf:li xml:lang="${lang}">${escapeXml(options.subject)}</rdf:li>\n`;
    xmp += '        </rdf:Alt>\n';
    xmp += '      </dc:description>\n';
  }
  xmp += '    </rdf:Description>\n';

  // XMP basic metadata
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:xmp="http://ns.adobe.com/xap/1.0/">\n';
  xmp += `      <xmp:CreatorTool>${escapeXml(creatorTool)}</xmp:CreatorTool>\n`;
  xmp += `      <xmp:CreateDate>${createDate}</xmp:CreateDate>\n`;
  xmp += `      <xmp:ModifyDate>${modifyDate}</xmp:ModifyDate>\n`;
  xmp += '    </rdf:Description>\n';

  // PDF metadata
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">\n';
  xmp += `      <pdf:Producer>${escapeXml(producer)}</pdf:Producer>\n`;
  if (options.keywords) {
    xmp += `      <pdf:Keywords>${escapeXml(options.keywords)}</pdf:Keywords>\n`;
  }
  xmp += '    </rdf:Description>\n';

  xmp += '  </rdf:RDF>\n';
  xmp += '</x:xmpmeta>\n';
  xmp += '<?xpacket end="w"?>';

  return xmp;
}

/**
 * Generate XMP metadata bytes for embedding in a PDF stream.
 *
 * This is a convenience wrapper around {@link generatePdfAXmp} that
 * encodes the resulting string as UTF-8 bytes suitable for use in a
 * PDF metadata stream object.
 *
 * @param options - Metadata options.
 * @returns XMP metadata as a `Uint8Array`.
 */
export function generatePdfAXmpBytes(options: PdfAXmpOptions): Uint8Array {
  return new TextEncoder().encode(generatePdfAXmp(options));
}

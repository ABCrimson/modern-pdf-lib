/**
 * @module metadata/xmpMetadata
 *
 * XMP (Extensible Metadata Platform) metadata generation and parsing.
 *
 * XMP metadata is embedded in PDF files as an XML stream using RDF
 * (Resource Description Framework) with standard namespaces:
 *
 * - **Dublin Core** (`dc:`) — title, creator, subject, description
 * - **XMP** (`xmp:`) — create date, modify date, creator tool
 * - **PDF** (`pdf:`) — producer, keywords
 * - **xmpMM** (`xmpMM:`) — document ID, instance ID
 *
 * The XMP packet is wrapped in `<?xpacket?>` processing instructions
 * and stored as a metadata stream referenced from the catalog's
 * `/Metadata` entry.
 *
 * Reference: PDF 1.7 spec SS 14.3.2, XMP specification (ISO 16684-1).
 */

import type { DocumentMetadata } from '../core/pdfCatalog.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// XMP namespace URIs
// ---------------------------------------------------------------------------

const NS_RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const NS_DC = 'http://purl.org/dc/elements/1.1/';
const NS_XMP = 'http://ns.adobe.com/xap/1.0/';
const NS_PDF = 'http://ns.adobe.com/pdf/1.3/';
const NS_XMPMM = 'http://ns.adobe.com/xap/1.0/mm/';
const NS_PDFAID = 'http://www.aiim.org/pdfa/ns/id/';

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

/**
 * Escape special characters for XML text content.
 * @internal
 */
function escapeXml(str: string): string {
  const parts: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 0x26) parts.push('&amp;');
    else if (c === 0x3C) parts.push('&lt;');
    else if (c === 0x3E) parts.push('&gt;');
    else if (c === 0x22) parts.push('&quot;');
    else if (c === 0x27) parts.push('&apos;');
    else parts.push(str[i]!);
  }
  return parts.join('');
}

/**
 * Format a Date as an ISO 8601 string for XMP.
 *
 * XMP uses the format: `YYYY-MM-DDThh:mm:ssZ` (UTC).
 * @internal
 */
function formatXmpDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// XMP generation
// ---------------------------------------------------------------------------

/**
 * Build an XMP metadata XML string from document metadata.
 *
 * The output is a complete XMP packet including:
 * - `<?xpacket begin="..." id="..."?>` header
 * - `<x:xmpmeta>` root element
 * - RDF description with Dublin Core, XMP, and PDF properties
 * - `<?xpacket end="w"?>` trailer
 *
 * @param meta  Document metadata fields.
 * @returns     The complete XMP XML string.
 */
export function buildXmpMetadata(meta: DocumentMetadata): string {
  const lines: string[] = [];

  // XMP packet header with BOM
  lines.push('<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>');
  lines.push('<x:xmpmeta xmlns:x="adobe:ns:meta/">');
  lines.push(`<rdf:RDF xmlns:rdf="${NS_RDF}">`);

  // Open the description with all namespace declarations
  lines.push(`<rdf:Description rdf:about=""`);
  lines.push(`  xmlns:dc="${NS_DC}"`);
  lines.push(`  xmlns:xmp="${NS_XMP}"`);
  lines.push(`  xmlns:pdf="${NS_PDF}"`);
  lines.push(`  xmlns:xmpMM="${NS_XMPMM}"`);
  lines.push(`  xmlns:pdfaid="${NS_PDFAID}">`);

  // Dublin Core: title
  if (meta.title !== undefined) {
    lines.push('  <dc:title>');
    lines.push('    <rdf:Alt>');
    lines.push(`      <rdf:li xml:lang="x-default">${escapeXml(meta.title)}</rdf:li>`);
    lines.push('    </rdf:Alt>');
    lines.push('  </dc:title>');
  }

  // Dublin Core: creator (author)
  if (meta.author !== undefined) {
    lines.push('  <dc:creator>');
    lines.push('    <rdf:Seq>');
    lines.push(`      <rdf:li>${escapeXml(meta.author)}</rdf:li>`);
    lines.push('    </rdf:Seq>');
    lines.push('  </dc:creator>');
  }

  // Dublin Core: subject (as keywords list)
  if (meta.keywords !== undefined) {
    const keywords = meta.keywords.split(/[,;]\s*/);
    lines.push('  <dc:subject>');
    lines.push('    <rdf:Bag>');
    for (const kw of keywords) {
      const trimmed = kw.trim();
      if (trimmed.length > 0) {
        lines.push(`      <rdf:li>${escapeXml(trimmed)}</rdf:li>`);
      }
    }
    lines.push('    </rdf:Bag>');
    lines.push('  </dc:subject>');
  }

  // Dublin Core: description (subject field)
  if (meta.subject !== undefined) {
    lines.push('  <dc:description>');
    lines.push('    <rdf:Alt>');
    lines.push(`      <rdf:li xml:lang="x-default">${escapeXml(meta.subject)}</rdf:li>`);
    lines.push('    </rdf:Alt>');
    lines.push('  </dc:description>');
  }

  // XMP: CreatorTool
  if (meta.creator !== undefined) {
    lines.push(`  <xmp:CreatorTool>${escapeXml(meta.creator)}</xmp:CreatorTool>`);
  }

  // XMP: CreateDate
  if (meta.creationDate !== undefined) {
    lines.push(`  <xmp:CreateDate>${formatXmpDate(meta.creationDate)}</xmp:CreateDate>`);
  }

  // XMP: ModifyDate
  if (meta.modDate !== undefined) {
    lines.push(`  <xmp:ModifyDate>${formatXmpDate(meta.modDate)}</xmp:ModifyDate>`);
  }

  // PDF: Producer
  if (meta.producer !== undefined) {
    lines.push(`  <pdf:Producer>${escapeXml(meta.producer)}</pdf:Producer>`);
  }

  // PDF: Keywords (as a single string)
  if (meta.keywords !== undefined) {
    lines.push(`  <pdf:Keywords>${escapeXml(meta.keywords)}</pdf:Keywords>`);
  }

  // Close the description and RDF
  lines.push('</rdf:Description>');
  lines.push('</rdf:RDF>');
  lines.push('</x:xmpmeta>');

  // Padding — XMP spec recommends padding to allow in-place edits
  // Add ~2KB of whitespace padding
  for (let i = 0; i < 20; i++) {
    lines.push(''.padEnd(100, ' '));
  }

  // XMP packet trailer
  lines.push('<?xpacket end="w"?>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// XMP parsing
// ---------------------------------------------------------------------------

/**
 * Parse XMP metadata XML string into document metadata fields.
 *
 * This is a lightweight regex-based parser that handles the standard
 * XMP properties used in PDF files.  It does not require a full XML
 * parser, keeping the library dependency-free.
 *
 * @param xmpString  The raw XMP XML string.
 * @returns          Partial document metadata extracted from the XMP.
 */
export function parseXmpMetadata(xmpString: string): Partial<DocumentMetadata> {
  const result: Partial<DocumentMetadata> = {};

  // dc:title — look for the rdf:li inside dc:title
  const title = extractAltValue(xmpString, 'dc:title');
  if (title !== undefined) {
    result.title = title;
  }

  // dc:creator — look for rdf:li inside dc:creator (first one)
  const creator = extractSeqValue(xmpString, 'dc:creator');
  if (creator !== undefined) {
    result.author = creator;
  }

  // dc:description — alt value
  const description = extractAltValue(xmpString, 'dc:description');
  if (description !== undefined) {
    result.subject = description;
  }

  // xmp:CreatorTool — simple element
  const creatorTool = extractSimpleValue(xmpString, 'xmp:CreatorTool');
  if (creatorTool !== undefined) {
    result.creator = creatorTool;
  }

  // pdf:Producer — simple element
  const producer = extractSimpleValue(xmpString, 'pdf:Producer');
  if (producer !== undefined) {
    result.producer = producer;
  }

  // pdf:Keywords — simple element
  const keywords = extractSimpleValue(xmpString, 'pdf:Keywords');
  if (keywords !== undefined) {
    result.keywords = keywords;
  }

  // xmp:CreateDate — date element
  const createDate = extractSimpleValue(xmpString, 'xmp:CreateDate');
  if (createDate !== undefined) {
    const parsed = new Date(createDate);
    if (!Number.isNaN(parsed.getTime())) {
      result.creationDate = parsed;
    }
  }

  // xmp:ModifyDate — date element
  const modifyDate = extractSimpleValue(xmpString, 'xmp:ModifyDate');
  if (modifyDate !== undefined) {
    const parsed = new Date(modifyDate);
    if (!Number.isNaN(parsed.getTime())) {
      result.modDate = parsed;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// XMP stream creation
// ---------------------------------------------------------------------------

/**
 * Create an XMP metadata stream suitable for embedding in a PDF
 * catalog's `/Metadata` entry.
 *
 * The stream is created with:
 * - `/Type /Metadata`
 * - `/Subtype /XML`
 * - The XMP XML as uncompressed stream data
 *
 * @param meta      Document metadata.
 * @param registry  Object registry for allocating a reference.
 * @returns         The indirect reference to the metadata stream.
 */
export function createXmpStream(
  meta: DocumentMetadata,
  registry: PdfObjectRegistry,
): PdfRef {
  const xmpString = buildXmpMetadata(meta);
  const encoder = new TextEncoder();
  const data = encoder.encode(xmpString);

  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('Metadata'));
  dict.set('/Subtype', PdfName.of('XML'));
  dict.set('/Length', PdfNumber.of(data.length));

  const stream = new PdfStream(dict, data);
  return registry.register(stream);
}

// ---------------------------------------------------------------------------
// Internal parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract a value from an rdf:Alt container (used for dc:title, dc:description).
 * Returns the content of the first rdf:li element.
 *
 * @internal
 */
function extractAltValue(xmp: string, tagName: string): string | undefined {
  // Match <tagName>...<rdf:Alt><rdf:li ...>VALUE</rdf:li>...</rdf:Alt>...</tagName>
  const tagPattern = new RegExp(
    `<${escapeRegex(tagName)}[^>]*>[\\s\\S]*?<rdf:Alt>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)</rdf:li>`,
    'i',
  );
  const match = tagPattern.exec(xmp);
  if (match?.[1] !== undefined) {
    return unescapeXml(match[1].trim());
  }
  return undefined;
}

/**
 * Extract the first value from an rdf:Seq container (used for dc:creator).
 *
 * @internal
 */
function extractSeqValue(xmp: string, tagName: string): string | undefined {
  const tagPattern = new RegExp(
    `<${escapeRegex(tagName)}[^>]*>[\\s\\S]*?<rdf:Seq>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)</rdf:li>`,
    'i',
  );
  const match = tagPattern.exec(xmp);
  if (match?.[1] !== undefined) {
    return unescapeXml(match[1].trim());
  }
  return undefined;
}

/**
 * Extract a simple element value like `<pdf:Producer>VALUE</pdf:Producer>`.
 *
 * @internal
 */
function extractSimpleValue(xmp: string, tagName: string): string | undefined {
  const pattern = new RegExp(
    `<${escapeRegex(tagName)}[^>]*>([\\s\\S]*?)</${escapeRegex(tagName)}>`,
    'i',
  );
  const match = pattern.exec(xmp);
  if (match?.[1] !== undefined) {
    return unescapeXml(match[1].trim());
  }

  // Also check for attribute form: tagName="value"
  const attrPattern = new RegExp(
    `${escapeRegex(tagName)}="([^"]*)"`,
    'i',
  );
  const attrMatch = attrPattern.exec(xmp);
  if (attrMatch?.[1] !== undefined) {
    return unescapeXml(attrMatch[1]);
  }

  return undefined;
}

/**
 * Unescape XML entities.
 * @internal
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Escape a string for use in a regular expression.
 * @internal
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

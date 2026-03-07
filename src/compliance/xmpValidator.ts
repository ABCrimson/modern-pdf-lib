/**
 * @module compliance/xmpValidator
 *
 * XMP metadata validator for PDF/A compliance.
 *
 * PDF/A requires specific XMP metadata properties:
 * - pdfaid:part — PDF/A part number (1, 2, or 3)
 * - pdfaid:conformance — Conformance level (A, B, or U)
 * - dc:title — Document title (recommended)
 * - xmp:CreateDate — Creation date in ISO 8601
 * - xmp:ModifyDate — Modification date in ISO 8601
 * - xmp:CreatorTool — Creator application name
 * - pdf:Producer — PDF producer application
 *
 * Reference: ISO 19005-1:2005 §6.6, ISO 19005-2:2011 §6.6.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Result of XMP metadata validation for PDF/A. */
export interface XmpValidationResult {
  readonly valid: boolean;
  readonly issues: XmpIssue[];
  readonly metadata: ParsedXmpMetadata;
}

/** A single XMP validation issue. */
export interface XmpIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly namespace?: string;
  readonly property?: string;
}

/** Structured XMP metadata extracted from a PDF. */
export interface ParsedXmpMetadata {
  readonly pdfaidPart?: number;
  readonly pdfaidConformance?: string;
  readonly dcTitle?: string;
  readonly xmpCreateDate?: string;
  readonly xmpModifyDate?: string;
  readonly xmpCreatorTool?: string;
  readonly pdfProducer?: string;
  readonly raw?: string;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extract XMP metadata from raw PDF bytes.
 *
 * Searches for the `<x:xmpmeta ... </x:xmpmeta>` envelope in the
 * decoded text of the PDF and returns the full XMP XML string, or
 * `undefined` if no XMP metadata is present.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @returns         The XMP XML string, or `undefined`.
 */
export function extractXmpMetadata(pdfBytes: Uint8Array): string | undefined {
  const text = new TextDecoder().decode(pdfBytes);
  const start = text.indexOf('<x:xmpmeta');
  if (start < 0) return undefined;
  const end = text.indexOf('</x:xmpmeta>', start);
  if (end < 0) return undefined;
  return text.substring(start, end + '</x:xmpmeta>'.length);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an XMP metadata string into structured data.
 *
 * Uses lightweight regex-based extraction (no XML parser needed).
 * Missing properties are returned as `undefined`.
 *
 * @param xmp  The raw XMP XML string.
 * @returns    Parsed metadata fields.
 */
export function parseXmpMetadata(xmp: string): ParsedXmpMetadata {
  const result: Record<string, unknown> = { raw: xmp };

  // Extract pdfaid:part
  const partMatch = xmp.match(/<pdfaid:part>(\d+)<\/pdfaid:part>/);
  if (partMatch) result.pdfaidPart = parseInt(partMatch[1]!, 10);

  // Extract pdfaid:conformance
  const confMatch = xmp.match(/<pdfaid:conformance>([A-Z])<\/pdfaid:conformance>/);
  if (confMatch) result.pdfaidConformance = confMatch[1];

  // Extract dc:title (inside rdf:Alt / rdf:li)
  const titleMatch = xmp.match(
    /<dc:title>[\s\S]*?<rdf:li[^>]*>([^<]*)<\/rdf:li>[\s\S]*?<\/dc:title>/,
  );
  if (titleMatch) result.dcTitle = titleMatch[1];

  // Extract xmp:CreateDate
  const createMatch = xmp.match(/<xmp:CreateDate>([^<]+)<\/xmp:CreateDate>/);
  if (createMatch) result.xmpCreateDate = createMatch[1];

  // Extract xmp:ModifyDate
  const modifyMatch = xmp.match(/<xmp:ModifyDate>([^<]+)<\/xmp:ModifyDate>/);
  if (modifyMatch) result.xmpModifyDate = modifyMatch[1];

  // Extract xmp:CreatorTool
  const creatorMatch = xmp.match(/<xmp:CreatorTool>([^<]+)<\/xmp:CreatorTool>/);
  if (creatorMatch) result.xmpCreatorTool = creatorMatch[1];

  // Extract pdf:Producer
  const producerMatch = xmp.match(/<pdf:Producer>([^<]+)<\/pdf:Producer>/);
  if (producerMatch) result.pdfProducer = producerMatch[1];

  return result as ParsedXmpMetadata;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate XMP metadata in a PDF against PDF/A requirements.
 *
 * Checks that the mandatory PDF/A identification properties exist and
 * match the expected conformance level.  Also reports warnings for
 * recommended-but-optional fields (CreatorTool, CreateDate, etc.).
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param level     The target PDF/A conformance level string (e.g. "1b", "2a").
 * @returns         Validation result with issues and parsed metadata.
 */
export function validateXmpMetadata(
  pdfBytes: Uint8Array,
  level: string,
): XmpValidationResult {
  const issues: XmpIssue[] = [];
  const xmp = extractXmpMetadata(pdfBytes);

  if (!xmp) {
    issues.push({
      code: 'XMP-001',
      message: 'No XMP metadata found. PDF/A requires XMP metadata.',
      severity: 'error',
    });
    return { valid: false, issues, metadata: {} as ParsedXmpMetadata };
  }

  const metadata = parseXmpMetadata(xmp);
  const part = parseInt(level[0]!, 10);
  const conformance = level[1]!.toUpperCase();

  // --- Mandatory: pdfaid:part ---
  if (metadata.pdfaidPart === undefined) {
    issues.push({
      code: 'XMP-002',
      message: 'Missing pdfaid:part in XMP metadata.',
      severity: 'error',
      namespace: 'pdfaid',
      property: 'part',
    });
  } else if (metadata.pdfaidPart !== part) {
    issues.push({
      code: 'XMP-003',
      message: `pdfaid:part is ${metadata.pdfaidPart} but expected ${part}.`,
      severity: 'error',
      namespace: 'pdfaid',
      property: 'part',
    });
  }

  // --- Mandatory: pdfaid:conformance ---
  if (metadata.pdfaidConformance === undefined) {
    issues.push({
      code: 'XMP-004',
      message: 'Missing pdfaid:conformance in XMP metadata.',
      severity: 'error',
      namespace: 'pdfaid',
      property: 'conformance',
    });
  } else if (metadata.pdfaidConformance !== conformance) {
    issues.push({
      code: 'XMP-005',
      message: `pdfaid:conformance is "${metadata.pdfaidConformance}" but expected "${conformance}".`,
      severity: 'error',
      namespace: 'pdfaid',
      property: 'conformance',
    });
  }

  // --- Mandatory: pdfaid namespace declaration ---
  if (!xmp.includes('xmlns:pdfaid=')) {
    issues.push({
      code: 'XMP-006',
      message: 'Missing pdfaid namespace declaration.',
      severity: 'error',
      namespace: 'pdfaid',
    });
  }

  // --- Recommended: xmp:CreatorTool ---
  if (!metadata.xmpCreatorTool) {
    issues.push({
      code: 'XMP-007',
      message: 'Missing xmp:CreatorTool (recommended for PDF/A).',
      severity: 'warning',
      namespace: 'xmp',
      property: 'CreatorTool',
    });
  }

  // --- Recommended: xmp:CreateDate ---
  if (!metadata.xmpCreateDate) {
    issues.push({
      code: 'XMP-008',
      message: 'Missing xmp:CreateDate (recommended for PDF/A).',
      severity: 'warning',
      namespace: 'xmp',
      property: 'CreateDate',
    });
  }

  // --- Recommended: xmp:ModifyDate ---
  if (!metadata.xmpModifyDate) {
    issues.push({
      code: 'XMP-009',
      message: 'Missing xmp:ModifyDate (recommended for PDF/A).',
      severity: 'warning',
      namespace: 'xmp',
      property: 'ModifyDate',
    });
  }

  // --- Recommended: pdf:Producer ---
  if (!metadata.pdfProducer) {
    issues.push({
      code: 'XMP-010',
      message: 'Missing pdf:Producer (recommended for PDF/A).',
      severity: 'warning',
      namespace: 'pdf',
      property: 'Producer',
    });
  }

  // --- Recommended: dc:title ---
  if (!metadata.dcTitle) {
    issues.push({
      code: 'XMP-011',
      message: 'Missing dc:title (recommended for PDF/A).',
      severity: 'warning',
      namespace: 'dc',
      property: 'title',
    });
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    metadata,
  };
}

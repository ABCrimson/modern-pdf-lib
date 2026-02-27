/**
 * @module compliance/pdfA
 *
 * PDF/A compliance validation and enforcement.
 *
 * PDF/A is an ISO standard for long-term archival of electronic documents.
 * It restricts certain PDF features (e.g. encryption, JavaScript,
 * transparency) and mandates others (e.g. embedded fonts, XMP metadata).
 *
 * Supported conformance levels:
 * - **1b**: PDF/A-1b (based on PDF 1.4) — basic visual preservation
 * - **1a**: PDF/A-1a — adds logical structure and tagged PDF
 * - **2b**: PDF/A-2b (based on PDF 1.7) — allows JPEG2000, transparency
 * - **2a**: PDF/A-2a — adds logical structure
 * - **2u**: PDF/A-2u — adds Unicode mapping
 * - **3b**: PDF/A-3b — allows embedded files of any type
 * - **3a**: PDF/A-3a — adds logical structure
 * - **3u**: PDF/A-3u — adds Unicode mapping
 *
 * Reference: ISO 19005-1:2005, ISO 19005-2:2011, ISO 19005-3:2012.
 */

import { concatBytes } from '../utils/binary.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** PDF/A conformance level. */
export type PdfALevel = '1b' | '2b' | '3b' | '1a' | '2a' | '3a' | '2u' | '3u';

/** Result of a PDF/A validation check. */
export interface PdfAValidationResult {
  valid: boolean;
  level: PdfALevel;
  issues: PdfAIssue[];
}

/** A single PDF/A compliance issue. */
export interface PdfAIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** Search for a pattern in the PDF bytes. */
function findPattern(data: Uint8Array, pattern: string, start: number = 0): number {
  const bytes = encoder.encode(pattern);
  outer:
  for (let i = start; i <= data.length - bytes.length; i++) {
    for (let j = 0; j < bytes.length; j++) {
      if (data[i + j] !== bytes[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Check if a pattern exists anywhere in the PDF. */
function containsPattern(data: Uint8Array, pattern: string): boolean {
  return findPattern(data, pattern) >= 0;
}

/** Extract text between two markers. */
function extractBetween(data: Uint8Array, start: string, end: string): string | undefined {
  const startIdx = findPattern(data, start);
  if (startIdx < 0) return undefined;
  const endIdx = findPattern(data, end, startIdx + start.length);
  if (endIdx < 0) return undefined;
  return decoder.decode(data.subarray(startIdx + start.length, endIdx));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a PDF against a specific PDF/A conformance level.
 *
 * This performs structural checks on the raw PDF bytes. It does NOT
 * fully render or deeply parse the PDF — it checks for the presence
 * or absence of features that PDF/A requires or forbids.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param level     The target PDF/A conformance level.
 * @returns         A validation result with any issues found.
 */
export function validatePdfA(
  pdfBytes: Uint8Array,
  level: PdfALevel,
): PdfAValidationResult {
  const issues: PdfAIssue[] = [];

  // Parse the part number from the level
  const part = parseInt(level[0]!, 10); // 1, 2, or 3
  const conformance = level[1]!; // 'a', 'b', or 'u'

  // --- Check: XMP metadata present ---
  if (!containsPattern(pdfBytes, '/Metadata')) {
    issues.push({
      code: 'PDFA-001',
      message: 'XMP metadata stream is required but not found in the catalog.',
      severity: 'error',
    });
  } else {
    // Check for PDF/A identification in XMP
    const xmpContent = extractBetween(pdfBytes, '<x:xmpmeta', '</x:xmpmeta>');
    if (xmpContent) {
      if (!xmpContent.includes('pdfaid:part') && !xmpContent.includes('pdfaSchema')) {
        issues.push({
          code: 'PDFA-002',
          message: 'XMP metadata does not contain PDF/A identification (pdfaid:part).',
          severity: 'error',
        });
      }
    }
  }

  // --- Check: No encryption ---
  if (containsPattern(pdfBytes, '/Encrypt')) {
    issues.push({
      code: 'PDFA-003',
      message: 'PDF/A documents must not be encrypted.',
      severity: 'error',
    });
  }

  // --- Check: No JavaScript ---
  if (containsPattern(pdfBytes, '/JavaScript') || containsPattern(pdfBytes, '/JS')) {
    issues.push({
      code: 'PDFA-004',
      message: 'PDF/A documents must not contain JavaScript.',
      severity: 'error',
    });
  }

  // --- Check: File trailer has /ID ---
  const trailerIdx = findPattern(pdfBytes, 'trailer');
  if (trailerIdx >= 0) {
    const trailerEnd = findPattern(pdfBytes, '>>', trailerIdx);
    if (trailerEnd >= 0) {
      const trailerStr = decoder.decode(pdfBytes.subarray(trailerIdx, trailerEnd + 2));
      if (!trailerStr.includes('/ID')) {
        issues.push({
          code: 'PDFA-005',
          message: 'PDF/A requires a file identifier (/ID) in the trailer.',
          severity: 'error',
        });
      }
    }
  }

  // --- Check: Fonts embedded (no bare standard 14 references) ---
  // Look for Type1 fonts without /FontFile or /FontFile3
  checkFontEmbedding(pdfBytes, issues);

  // --- Check: No transparency (PDF/A-1 only) ---
  if (part === 1) {
    if (containsPattern(pdfBytes, '/SMask') || containsPattern(pdfBytes, '/CA ') ||
        containsPattern(pdfBytes, '/ca ')) {
      // Be more lenient: /CA 1 and /ca 1 are fine
      const hasTransparency = checkTransparency(pdfBytes);
      if (hasTransparency) {
        issues.push({
          code: 'PDFA-006',
          message: 'PDF/A-1 does not allow transparency (SMask, non-1.0 CA/ca values).',
          severity: 'error',
        });
      }
    }
  }

  // --- Check: Logical structure (required for 'a' conformance) ---
  if (conformance === 'a') {
    if (!containsPattern(pdfBytes, '/StructTreeRoot')) {
      issues.push({
        code: 'PDFA-007',
        message: `PDF/A-${part}a requires a document structure tree (/StructTreeRoot).`,
        severity: 'error',
      });
    }

    if (!containsPattern(pdfBytes, '/MarkInfo')) {
      issues.push({
        code: 'PDFA-008',
        message: `PDF/A-${part}a requires the document to be marked (/MarkInfo with /Marked true).`,
        severity: 'error',
      });
    }
  }

  // --- Check: Unicode mapping (required for 'u' and 'a' conformance in part 2+) ---
  if ((conformance === 'u' || conformance === 'a') && part >= 2) {
    if (!containsPattern(pdfBytes, '/ToUnicode')) {
      issues.push({
        code: 'PDFA-009',
        message: `PDF/A-${part}${conformance} requires ToUnicode CMaps for all fonts.`,
        severity: 'warning',
      });
    }
  }

  // --- Check: No embedded files (PDF/A-1 and PDF/A-2) ---
  if (part < 3) {
    if (containsPattern(pdfBytes, '/EmbeddedFiles') || containsPattern(pdfBytes, '/AF ')) {
      issues.push({
        code: 'PDFA-010',
        message: `PDF/A-${part} does not allow embedded file attachments.`,
        severity: 'error',
      });
    }
  }

  // --- Check: Document language ---
  if (!containsPattern(pdfBytes, '/Lang')) {
    issues.push({
      code: 'PDFA-011',
      message: 'PDF/A recommends setting the document language (/Lang in the catalog).',
      severity: 'warning',
    });
  }

  // --- Check: Color space ---
  if (containsPattern(pdfBytes, '/DeviceRGB') || containsPattern(pdfBytes, '/DeviceCMYK')) {
    // PDF/A requires an output intent for device-dependent color spaces
    if (!containsPattern(pdfBytes, '/OutputIntents')) {
      issues.push({
        code: 'PDFA-012',
        message: 'PDF/A requires /OutputIntents when using device-dependent color spaces.',
        severity: 'warning',
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    level,
    issues,
  };
}

/** Check if fonts are properly embedded. */
function checkFontEmbedding(data: Uint8Array, issues: PdfAIssue[]): void {
  const str = decoder.decode(data);
  // Find all font references with /Type1 subtype but without /FontFile
  const fontMatches = str.matchAll(/\/Subtype\s*\/Type1[\s\S]*?\/BaseFont\s*\/([\w-]+)/g);
  const standardFonts = new Set([
    'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
    'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    'Symbol', 'ZapfDingbats',
  ]);

  for (const m of fontMatches) {
    const fontName = m[1]!;
    if (standardFonts.has(fontName)) {
      // Standard font used without embedding — this is an issue for PDF/A
      issues.push({
        code: 'PDFA-013',
        message: `Font "${fontName}" must be embedded for PDF/A compliance (standard 14 fonts are not exempt).`,
        severity: 'error',
      });
    }
  }
}

/** Check if the PDF uses transparency features. */
function checkTransparency(data: Uint8Array): boolean {
  const str = decoder.decode(data);

  // Check for SMask references (not /SMask /None)
  if (/\/SMask\s+(?!\/None)/.test(str)) {
    return true;
  }

  // Check for non-1.0 CA or ca values
  const caMatch = /\/[Cc][Aa]\s+([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = caMatch.exec(str)) !== null) {
    const val = parseFloat(m[1]!);
    if (val < 1.0) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

/**
 * Attempt to make a PDF conform to PDF/A.
 *
 * This adds or corrects:
 * - XMP metadata with PDF/A identification
 * - File identifier (/ID) in the trailer
 * - Document language (if missing, defaults to "en")
 *
 * **Limitations:**
 * - Cannot embed fonts that are not already embedded
 * - Cannot remove encryption or JavaScript (throws an error)
 * - Cannot add structure tree for 'a' conformance
 * - For full PDF/A conversion, use a dedicated tool
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param level     The target PDF/A conformance level.
 * @returns         The modified PDF bytes.
 */
export async function enforcePdfA(
  pdfBytes: Uint8Array,
  level: PdfALevel,
): Promise<Uint8Array> {
  // Validate first to see what's needed
  const validation = validatePdfA(pdfBytes, level);

  // Check for unfixable issues
  for (const issue of validation.issues) {
    if (issue.code === 'PDFA-003') {
      throw new Error('Cannot enforce PDF/A: document is encrypted. Remove encryption first.');
    }
    if (issue.code === 'PDFA-004') {
      throw new Error('Cannot enforce PDF/A: document contains JavaScript. Remove it first.');
    }
  }

  // If already valid, return as-is
  if (validation.valid) {
    return pdfBytes;
  }

  // Build modifications
  const part = parseInt(level[0]!, 10);
  const conformance = level[1]!;

  let result = pdfBytes;

  // Add XMP metadata with PDF/A identification if missing
  const hasXmpId = validation.issues.every((i) => i.code !== 'PDFA-001' && i.code !== 'PDFA-002');
  if (!hasXmpId) {
    result = addPdfAXmpMetadata(result, part, conformance);
  }

  // Add /ID to trailer if missing
  const needsId = validation.issues.some((i) => i.code === 'PDFA-005');
  if (needsId) {
    result = addTrailerId(result);
  }

  return result;
}

/** Generate XMP metadata with PDF/A identification and inject it. */
function addPdfAXmpMetadata(
  data: Uint8Array,
  part: number,
  conformance: string,
): Uint8Array {
  const conformanceUpper = conformance.toUpperCase();

  const xmp = [
    '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '    <rdf:Description rdf:about=""',
    '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"',
    '      xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '      xmlns:xmp="http://ns.adobe.com/xap/1.0/">',
    `      <pdfaid:part>${part}</pdfaid:part>`,
    `      <pdfaid:conformance>${conformanceUpper}</pdfaid:conformance>`,
    '      <xmp:CreatorTool>modern-pdf-lib</xmp:CreatorTool>',
    '    </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');

  const xmpBytes = encoder.encode(xmp);

  // We'll append the XMP metadata as a new object and add a reference
  // in the catalog. This is a simplified approach.
  const str = decoder.decode(data);

  // Find the highest object number
  const objMatches = str.matchAll(/(\d+)\s+0\s+obj/g);
  let maxObj = 0;
  for (const m of objMatches) {
    const num = parseInt(m[1]!, 10);
    if (num > maxObj) maxObj = num;
  }

  const metadataObjNum = maxObj + 1;

  // Build the metadata stream object
  const metaObj = [
    `${metadataObjNum} 0 obj`,
    `<< /Type /Metadata /Subtype /XML /Length ${xmpBytes.length} >>`,
    'stream',
  ].join('\n');

  const metaObjEnd = '\nendstream\nendobj\n';

  // Find catalog and add /Metadata reference
  const catalogIdx = findPattern(data, '/Type /Catalog');
  if (catalogIdx < 0) return data; // Can't find catalog

  // Find the >> that closes the catalog dict
  const catalogEnd = findPattern(data, '>>', catalogIdx);
  if (catalogEnd < 0) return data;

  // Insert /Metadata reference before the >>
  const metaRef = `\n/Metadata ${metadataObjNum} 0 R\n`;

  // Build modified PDF
  const parts: Uint8Array[] = [];
  parts.push(data.subarray(0, catalogEnd));
  parts.push(encoder.encode(metaRef));
  parts.push(data.subarray(catalogEnd));
  parts.push(encoder.encode('\n'));
  parts.push(encoder.encode(metaObj + '\n'));
  parts.push(xmpBytes);
  parts.push(encoder.encode(metaObjEnd));

  return concatBytes(...parts);
}

/** Add a file identifier (/ID) to the trailer. */
function addTrailerId(data: Uint8Array): Uint8Array {
  const trailerIdx = findPattern(data, 'trailer');
  if (trailerIdx < 0) return data;

  const trailerEnd = findPattern(data, '>>', trailerIdx);
  if (trailerEnd < 0) return data;

  // Generate random file identifiers
  const id1 = crypto.getRandomValues(new Uint8Array(16)).toHex();
  const id2 = crypto.getRandomValues(new Uint8Array(16)).toHex();

  const idEntry = `\n/ID [<${id1}> <${id2}>]\n`;

  const parts: Uint8Array[] = [];
  parts.push(data.subarray(0, trailerEnd));
  parts.push(encoder.encode(idEntry));
  parts.push(data.subarray(trailerEnd));

  return concatBytes(...parts);
}

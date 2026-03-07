/**
 * @module compliance/enforcePdfAv2
 *
 * Enhanced PDF/A enforcement that chains all available fixes into a
 * single pipeline:
 *
 * 1. Strip prohibited features (JavaScript, Launch, Sound, Movie, RichMedia)
 * 2. Flatten transparency (for PDF/A-1 only)
 * 3. Add/fix XMP metadata with PDF/A identification
 * 4. Add file ID to trailer
 * 5. Validate result and return
 *
 * Unlike the basic {@link enforcePdfA} in `pdfA.ts` (which only adds XMP
 * and /ID, and throws on JS/encryption), this function actively strips
 * prohibited features and flattens transparency before validation.
 *
 * Reference: ISO 19005-1:2005, ISO 19005-2:2011, ISO 19005-3:2012.
 */

import type { PdfALevel, PdfAValidationResult } from './pdfA.js';
import { validatePdfA } from './pdfA.js';
import { stripProhibitedFeatures } from './stripProhibited.js';
import { flattenTransparency as flattenTransparencyFn, detectTransparency } from './transparencyFlattener.js';
import { concatBytes } from '../utils/binary.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for the enhanced PDF/A enforcement pipeline. */
export interface EnforcePdfAOptions {
  /** Whether to strip JavaScript and other prohibited actions. Default: true. */
  readonly stripProhibited?: boolean;
  /** Whether to flatten transparency for PDF/A-1. Default: true. */
  readonly flattenTransparency?: boolean;
  /** Whether to add XMP metadata. Default: true. */
  readonly addXmpMetadata?: boolean;
  /** Whether to add file ID. Default: true. */
  readonly addFileId?: boolean;
  /** Document title for XMP metadata. */
  readonly title?: string;
  /** Document author for XMP metadata. */
  readonly author?: string;
  /** Document language. Default: 'en'. */
  readonly language?: string;
}

/** Result of the enhanced PDF/A enforcement. */
export interface EnforcePdfAResult {
  /** Modified PDF bytes. */
  readonly bytes: Uint8Array;
  /** Validation result after enforcement. */
  readonly validation: PdfAValidationResult;
  /** Actions taken during enforcement. */
  readonly actions: EnforcementAction[];
  /** Whether all errors were resolved. */
  readonly fullyCompliant: boolean;
  /** Remaining error-level issues (if any). */
  readonly remainingIssues: number;
}

/** A single action taken during enforcement. */
export interface EnforcementAction {
  readonly action: string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Search for a byte pattern starting at `start`. */
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

/** Generate XMP metadata with PDF/A identification and inject it. */
function addXmpMetadata(
  data: Uint8Array,
  part: number,
  conformance: string,
  options: EnforcePdfAOptions,
): Uint8Array {
  const conformanceUpper = conformance.toUpperCase();
  const now = new Date().toISOString();

  const xmp: string[] = [
    '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '    <rdf:Description rdf:about=""',
    '      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"',
    '      xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '      xmlns:xmp="http://ns.adobe.com/xap/1.0/"',
    '      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">',
    `      <pdfaid:part>${part}</pdfaid:part>`,
    `      <pdfaid:conformance>${conformanceUpper}</pdfaid:conformance>`,
    '      <xmp:CreatorTool>modern-pdf-lib</xmp:CreatorTool>',
    `      <xmp:CreateDate>${now}</xmp:CreateDate>`,
    `      <xmp:ModifyDate>${now}</xmp:ModifyDate>`,
    '      <pdf:Producer>modern-pdf-lib</pdf:Producer>',
  ];

  if (options.title) {
    xmp.push(`      <dc:title><rdf:Alt><rdf:li xml:lang="${options.language ?? 'en'}">${options.title}</rdf:li></rdf:Alt></dc:title>`);
  }
  if (options.author) {
    xmp.push(`      <dc:creator><rdf:Seq><rdf:li>${options.author}</rdf:li></rdf:Seq></dc:creator>`);
  }

  xmp.push('    </rdf:Description>');
  xmp.push('  </rdf:RDF>');
  xmp.push('</x:xmpmeta>');
  xmp.push('<?xpacket end="w"?>');

  const xmpStr = xmp.join('\n');
  const xmpBytes = encoder.encode(xmpStr);

  const str = decoder.decode(data);

  // Find highest object number
  let maxObj = 0;
  for (const m of str.matchAll(/(\d+)\s+0\s+obj/g)) {
    const num = parseInt(m[1]!, 10);
    if (num > maxObj) maxObj = num;
  }

  const metadataObjNum = maxObj + 1;
  const metaObj = `${metadataObjNum} 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${xmpBytes.length} >>\nstream\n`;
  const metaObjEnd = '\nendstream\nendobj\n';

  // Find catalog and add /Metadata reference
  const catalogIdx = findPattern(data, '/Type /Catalog');
  if (catalogIdx < 0) return data;
  const catalogEnd = findPattern(data, '>>', catalogIdx);
  if (catalogEnd < 0) return data;

  const metaRef = `\n/Metadata ${metadataObjNum} 0 R\n`;

  const before = data.subarray(0, catalogEnd);
  const ref = encoder.encode(metaRef);
  const after = data.subarray(catalogEnd);
  const stream = encoder.encode(metaObj);
  const end = encoder.encode(metaObjEnd);

  return concatBytes(before, ref, after, encoder.encode('\n'), stream, xmpBytes, end);
}

/** Add a file identifier (/ID) to the trailer. */
function addTrailerId(data: Uint8Array): Uint8Array {
  const trailerIdx = findPattern(data, 'trailer');
  if (trailerIdx < 0) return data;

  const trailerEnd = findPattern(data, '>>', trailerIdx);
  if (trailerEnd < 0) return data;

  const id1 = crypto.getRandomValues(new Uint8Array(16)).toHex();
  const id2 = crypto.getRandomValues(new Uint8Array(16)).toHex();
  const idEntry = `\n/ID [<${id1}> <${id2}>]\n`;

  return concatBytes(
    data.subarray(0, trailerEnd),
    encoder.encode(idEntry),
    data.subarray(trailerEnd),
  );
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Enforce PDF/A compliance with a full pipeline.
 *
 * Unlike the basic `enforcePdfA()` which only adds XMP metadata and /ID
 * (and throws on JavaScript), this function actively:
 *
 * 1. **Strips** prohibited features (JavaScript, Launch, Sound, Movie,
 *    RichMedia) so they no longer cause validation failures.
 * 2. **Flattens** transparency features for PDF/A-1 (sets opacity to 1.0,
 *    replaces SMask with /None, normalizes blend modes to /Normal).
 * 3. **Adds** XMP metadata with correct `pdfaid:part` and
 *    `pdfaid:conformance` values.
 * 4. **Adds** a file identifier (`/ID`) to the trailer when missing.
 * 5. **Validates** the result and reports remaining issues.
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param level     The target PDF/A conformance level (e.g. '1b', '2b').
 * @param options   Fine-grained control over which steps to execute.
 * @returns         The enforcement result including modified bytes,
 *                  validation report, and actions taken.
 *
 * @throws {Error}  If the PDF is encrypted (cannot be fixed automatically).
 *
 * @example
 * ```ts
 * import { enforcePdfAFull } from 'modern-pdf-lib';
 *
 * const result = await enforcePdfAFull(pdfBytes, '1b', {
 *   title: 'My Document',
 *   author: 'Jane Doe',
 * });
 *
 * if (result.fullyCompliant) {
 *   console.log('PDF/A-1b compliant!');
 * }
 * ```
 */
export async function enforcePdfAFull(
  pdfBytes: Uint8Array,
  level: PdfALevel,
  options: EnforcePdfAOptions = {},
): Promise<EnforcePdfAResult> {
  const actions: EnforcementAction[] = [];
  let bytes = pdfBytes;
  const part = parseInt(level[0]!, 10);
  const conformance = level[1]!;

  // Check for encryption (cannot fix automatically)
  const initialValidation = validatePdfA(bytes, level);
  const hasEncryption = initialValidation.issues.some(i => i.code === 'PDFA-003');
  if (hasEncryption) {
    throw new Error('Cannot enforce PDF/A: document is encrypted. Remove encryption first.');
  }

  // Step 1: Strip prohibited features
  if (options.stripProhibited !== false) {
    const result = stripProhibitedFeatures(bytes);
    if (result.modified) {
      bytes = result.bytes;
      for (const s of result.stripped) {
        actions.push({
          action: 'strip',
          description: `Stripped ${s.count} ${s.type} action(s)`,
        });
      }
    }
  }

  // Step 2: Flatten transparency (PDF/A-1 only)
  if (options.flattenTransparency !== false && part === 1) {
    const info = detectTransparency(bytes);
    if (info.hasTransparency) {
      bytes = flattenTransparencyFn(bytes);
      actions.push({
        action: 'flatten-transparency',
        description: `Flattened ${info.findings.length} transparency feature(s)`,
      });
    }
  }

  // Step 3: Add XMP metadata
  if (options.addXmpMetadata !== false) {
    const text = decoder.decode(bytes);

    // Check if XMP with pdfaid already exists
    if (!text.includes('<x:xmpmeta') || !text.includes('pdfaid:part')) {
      bytes = addXmpMetadata(bytes, part, conformance, options);
      actions.push({
        action: 'add-xmp',
        description: `Added XMP metadata with pdfaid:part=${part} pdfaid:conformance=${conformance.toUpperCase()}`,
      });
    }
  }

  // Step 4: Add file ID
  if (options.addFileId !== false) {
    const text = decoder.decode(bytes);
    if (text.includes('trailer') && !text.includes('/ID [')) {
      bytes = addTrailerId(bytes);
      actions.push({
        action: 'add-file-id',
        description: 'Added file identifier (/ID) to trailer',
      });
    }
  }

  // Validate final result
  const validation = validatePdfA(bytes, level);
  const errorCount = validation.issues.filter(i => i.severity === 'error').length;

  return {
    bytes,
    validation,
    actions,
    fullyCompliant: errorCount === 0,
    remainingIssues: errorCount,
  };
}

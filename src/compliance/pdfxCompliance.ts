/**
 * @module compliance/pdfxCompliance
 *
 * PDF/X compliance validation and enforcement for print production.
 *
 * PDF/X is an ISO standard (ISO 15930) for reliable exchange of
 * print-ready PDF files. It restricts certain PDF features and mandates
 * others to ensure predictable reproduction.
 *
 * Supported conformance levels:
 * - **X-1a:2003** (ISO 15930-4): CMYK/Gray only, no transparency,
 *   requires output intent with ICC, PDF 1.3 base
 * - **X-3:2003** (ISO 15930-6): Allows ICC-based RGB in addition to
 *   CMYK/Gray, no transparency, PDF 1.3 base
 * - **X-4** (ISO 15930-7): Allows transparency, requires PDF 1.6+,
 *   ICC-based color management
 *
 * Reference: ISO 15930-4:2003, ISO 15930-6:2005, ISO 15930-7:2010.
 */

import { concatBytes } from '../utils/binary.js';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfNumber,
  PdfStream,
  PdfArray,
} from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfRef } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** PDF/X conformance level. */
export type PdfXLevel = 'X-1a:2003' | 'X-3:2003' | 'X-4';

/** Result of a PDF/X validation check. */
export interface PdfXValidationResult {
  valid: boolean;
  level: PdfXLevel;
  errors: PdfXIssue[];
  warnings: PdfXIssue[];
}

/** A single PDF/X compliance issue. */
export interface PdfXIssue {
  code: string;
  message: string;
  clause?: string;
}

/** Options for PDF/X enforcement. */
export interface PdfXOptions {
  level: PdfXLevel;
  outputIntent: OutputIntentConfig;
  trapped?: 'True' | 'False' | 'Unknown';
}

/** Configuration for an output intent. */
export interface OutputIntentConfig {
  /** Output condition identifier, e.g. "CGATS TR 001". */
  condition: string;
  /** Registry URL, e.g. "http://www.color.org". */
  registryName?: string;
  /** ICC profile bytes. */
  iccProfile?: Uint8Array;
  /** Human-readable description. */
  info?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
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

/**
 * Parse a box array `[llx lly urx ury]` from a PDF dictionary text.
 * Returns the four numbers, or undefined if not found.
 */
function parseBox(text: string, boxName: string): [number, number, number, number] | undefined {
  const regex = new RegExp(`/${boxName}\\s*\\[([^\\]]+)\\]`);
  const match = regex.exec(text);
  if (!match) return undefined;
  const nums = match[1]!.trim().split(/\s+/).map(Number);
  if (nums.length !== 4 || nums.some(n => Number.isNaN(n))) return undefined;
  return nums as unknown as [number, number, number, number];
}

/**
 * Check whether box `inner` is contained within box `outer`.
 * Each box is [llx, lly, urx, ury].
 */
function boxContains(
  outer: [number, number, number, number],
  inner: [number, number, number, number],
): boolean {
  // inner lower-left must be >= outer lower-left
  // inner upper-right must be <= outer upper-right
  return (
    inner[0] >= outer[0] - 0.01 &&
    inner[1] >= outer[1] - 0.01 &&
    inner[2] <= outer[2] + 0.01 &&
    inner[3] <= outer[3] + 0.01
  );
}

/** Check if the PDF uses non-1.0 transparency features. */
function hasTransparency(data: Uint8Array): boolean {
  const text = decoder.decode(data);

  // Check for SMask references (not /SMask /None)
  if (/\/SMask\s+(?!\/None)/.test(text)) return true;

  // Check for non-1.0 CA or ca values
  for (const m of text.matchAll(/\/CA\s+([\d.]+)/g)) {
    if (parseFloat(m[1]!) < 1.0) return true;
  }
  for (const m of text.matchAll(/\/ca\s+([\d.]+)/g)) {
    if (parseFloat(m[1]!) < 1.0) return true;
  }

  // Check for non-Normal blend modes
  for (const m of text.matchAll(/\/BM\s+\/([\w]+)/g)) {
    if (m[1] !== 'Normal') return true;
  }

  return false;
}

/** Extract the PDF header version (e.g. "1.7", "2.0"). */
function getPdfVersion(data: Uint8Array): string {
  const header = decoder.decode(data.subarray(0, 20));
  const match = /^%PDF-(\d+\.\d+)/.exec(header);
  return match?.[1] ?? '1.4';
}

/** Parse a version string like "1.7" into a comparable number (1.7). */
function versionNumber(version: string): number {
  return parseFloat(version);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a PDF against a specific PDF/X conformance level.
 *
 * Performs structural checks on the raw PDF bytes for:
 * - Output intent presence and subtype
 * - /Trapped key in Info dictionary
 * - Transparency restrictions (X-1a, X-3)
 * - Color space restrictions (X-1a: CMYK/Gray only)
 * - Font embedding
 * - No encryption
 * - TrimBox or BleedBox on every page
 * - No JavaScript or multimedia
 * - Page box nesting (MediaBox >= BleedBox >= TrimBox >= ArtBox)
 * - PDF version requirements (X-4 requires 1.6+)
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param level     The target PDF/X conformance level.
 * @returns         A validation result with errors and warnings.
 */
export function validatePdfX(
  pdfBytes: Uint8Array,
  level: PdfXLevel,
): PdfXValidationResult {
  const errors: PdfXIssue[] = [];
  const warnings: PdfXIssue[] = [];
  const text = decoder.decode(pdfBytes);

  // --- Check: Output intent ---
  if (!containsPattern(pdfBytes, '/OutputIntents')) {
    errors.push({
      code: 'PDFX-001',
      message: 'PDF/X requires an /OutputIntents array in the document catalog.',
      clause: 'ISO 15930, §6.2',
    });
  } else {
    // Check for GTS_PDFX subtype
    if (!containsPattern(pdfBytes, '/GTS_PDFX')) {
      errors.push({
        code: 'PDFX-002',
        message: 'Output intent must use /S /GTS_PDFX subtype for PDF/X compliance.',
        clause: 'ISO 15930, §6.2.2',
      });
    }
  }

  // --- Check: /Trapped key in Info dictionary ---
  if (!containsPattern(pdfBytes, '/Trapped')) {
    errors.push({
      code: 'PDFX-003',
      message: 'PDF/X requires /Trapped key in the document Info dictionary.',
      clause: 'ISO 15930, §6.1.3',
    });
  } else {
    // Validate that /Trapped value is valid (True, False, or Unknown)
    if (!/\/Trapped\s*\/(?:True|False|Unknown)/.test(text)) {
      warnings.push({
        code: 'PDFX-003W',
        message: '/Trapped must be /True, /False, or /Unknown.',
        clause: 'ISO 15930, §6.1.3',
      });
    }
  }

  // --- Check: No transparency (X-1a and X-3 only) ---
  if (level !== 'X-4') {
    if (hasTransparency(pdfBytes)) {
      errors.push({
        code: 'PDFX-004',
        message: `PDF/${level} does not allow transparency (SMask, non-1.0 CA/ca, non-Normal BM).`,
        clause: 'ISO 15930, §6.3',
      });
    }
  }

  // --- Check: Color spaces ---
  if (level === 'X-1a:2003') {
    // X-1a: only CMYK, Gray, and Spot colors allowed; no RGB
    if (containsPattern(pdfBytes, '/DeviceRGB')) {
      errors.push({
        code: 'PDFX-005',
        message: 'PDF/X-1a does not allow DeviceRGB color space. Only CMYK, Gray, and Spot colors are permitted.',
        clause: 'ISO 15930-4, §6.2.3',
      });
    }
    if (containsPattern(pdfBytes, '/ICCBased')) {
      // Check if any ICCBased profile is RGB (3 components)
      // A simplified check — look for /N 3 near /ICCBased references
      const iccMatches = text.matchAll(/\/ICCBased\b[\s\S]*?\/N\s+(\d+)/g);
      for (const m of iccMatches) {
        if (m[1] === '3') {
          errors.push({
            code: 'PDFX-005',
            message: 'PDF/X-1a does not allow RGB ICC profiles. Only CMYK and Gray ICC profiles are permitted.',
            clause: 'ISO 15930-4, §6.2.3',
          });
          break;
        }
      }
    }
  } else if (level === 'X-3:2003') {
    // X-3: allows ICC-based RGB, but bare DeviceRGB without ICC requires a warning
    if (containsPattern(pdfBytes, '/DeviceRGB') && !containsPattern(pdfBytes, '/ICCBased')) {
      warnings.push({
        code: 'PDFX-005W',
        message: 'PDF/X-3 allows RGB but recommends ICC-based color management. DeviceRGB found without ICCBased profile.',
        clause: 'ISO 15930-6, §6.2.3',
      });
    }
  }

  // --- Check: All fonts embedded ---
  checkFontEmbedding(text, errors);

  // --- Check: No encryption ---
  if (containsPattern(pdfBytes, '/Encrypt')) {
    errors.push({
      code: 'PDFX-007',
      message: 'PDF/X documents must not be encrypted.',
      clause: 'ISO 15930, §6.1.4',
    });
  }

  // --- Check: TrimBox or BleedBox present ---
  checkPageBoxes(text, errors, warnings);

  // --- Check: No JavaScript ---
  if (containsPattern(pdfBytes, '/JavaScript') || containsPattern(pdfBytes, '/JS')) {
    errors.push({
      code: 'PDFX-009',
      message: 'PDF/X documents must not contain JavaScript.',
      clause: 'ISO 15930, §6.4',
    });
  }

  // --- Check: No multimedia ---
  if (containsPattern(pdfBytes, '/RichMedia') || containsPattern(pdfBytes, '/Movie') ||
      containsPattern(pdfBytes, '/Sound')) {
    errors.push({
      code: 'PDFX-010',
      message: 'PDF/X documents must not contain multimedia content (RichMedia, Movie, Sound).',
      clause: 'ISO 15930, §6.4',
    });
  }

  // --- Check: PDF version requirements ---
  if (level === 'X-4') {
    const version = getPdfVersion(pdfBytes);
    if (versionNumber(version) < 1.6) {
      errors.push({
        code: 'PDFX-011',
        message: `PDF/X-4 requires PDF version 1.6 or higher. Found: ${version}.`,
        clause: 'ISO 15930-7, §4',
      });
    }
  }

  return {
    valid: errors.length === 0,
    level,
    errors,
    warnings,
  };
}

/** Check if fonts are properly embedded. */
function checkFontEmbedding(text: string, errors: PdfXIssue[]): void {
  const fontMatches = text.matchAll(/\/Subtype\s*\/Type1[\s\S]*?\/BaseFont\s*\/([\w-]+)/g);
  const standardFonts = new Set([
    'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
    'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    'Symbol', 'ZapfDingbats',
  ]);

  for (const m of fontMatches) {
    const fontName = m[1]!;
    if (standardFonts.has(fontName)) {
      errors.push({
        code: 'PDFX-006',
        message: `Font "${fontName}" must be embedded for PDF/X compliance.`,
        clause: 'ISO 15930, §6.3.5',
      });
    }
  }
}

/**
 * Check page boxes:
 * - TrimBox or BleedBox must be present on every page
 * - Page box nesting: MediaBox >= BleedBox >= TrimBox >= ArtBox
 */
function checkPageBoxes(text: string, errors: PdfXIssue[], warnings: PdfXIssue[]): void {
  // Find all page dictionaries
  const pageMatches = text.matchAll(/\/Type\s*\/Page\b(?!\s*s)([\s\S]*?)(?=\bendobj\b)/g);
  let pageIndex = 0;

  for (const pm of pageMatches) {
    pageIndex++;
    const pageStr = pm[0]!;

    const hasTrimBox = pageStr.includes('/TrimBox');
    const hasBleedBox = pageStr.includes('/BleedBox');

    if (!hasTrimBox && !hasBleedBox) {
      errors.push({
        code: 'PDFX-008',
        message: `Page ${pageIndex}: PDF/X requires a /TrimBox or /BleedBox on every page.`,
        clause: 'ISO 15930, §6.1.2',
      });
    }

    // Validate box nesting: MediaBox >= BleedBox >= TrimBox >= ArtBox
    const mediaBox = parseBox(pageStr, 'MediaBox');
    const bleedBox = parseBox(pageStr, 'BleedBox');
    const trimBox = parseBox(pageStr, 'TrimBox');
    const artBox = parseBox(pageStr, 'ArtBox');

    if (mediaBox && bleedBox && !boxContains(mediaBox, bleedBox)) {
      warnings.push({
        code: 'PDFX-012',
        message: `Page ${pageIndex}: BleedBox must be contained within MediaBox.`,
        clause: 'ISO 15930, §6.1.2',
      });
    }

    if (bleedBox && trimBox && !boxContains(bleedBox, trimBox)) {
      warnings.push({
        code: 'PDFX-013',
        message: `Page ${pageIndex}: TrimBox must be contained within BleedBox.`,
        clause: 'ISO 15930, §6.1.2',
      });
    } else if (mediaBox && trimBox && !boxContains(mediaBox, trimBox)) {
      warnings.push({
        code: 'PDFX-014',
        message: `Page ${pageIndex}: TrimBox must be contained within MediaBox.`,
        clause: 'ISO 15930, §6.1.2',
      });
    }

    if (trimBox && artBox && !boxContains(trimBox, artBox)) {
      warnings.push({
        code: 'PDFX-015',
        message: `Page ${pageIndex}: ArtBox must be contained within TrimBox.`,
        clause: 'ISO 15930, §6.1.2',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

/**
 * Attempt to make a PDF conform to a PDF/X level.
 *
 * This adds or corrects:
 * - Output intent with the specified configuration
 * - /Trapped key in the Info dictionary
 * - TrimBox = CropBox (or MediaBox) if missing
 * - Flattens transparency for X-1a and X-3
 *
 * **Limitations:**
 * - Cannot convert RGB to CMYK (for X-1a — validation will still fail)
 * - Cannot embed fonts that are not already embedded
 * - Cannot remove encryption (throws an error)
 * - Cannot remove JavaScript (throws an error)
 *
 * @param pdfBytes  The raw PDF bytes.
 * @param options   PDF/X enforcement options.
 * @returns         The modified PDF bytes.
 */
export function enforcePdfX(
  pdfBytes: Uint8Array,
  options: PdfXOptions,
): Uint8Array {
  const text = decoder.decode(pdfBytes);

  // Check for unfixable issues
  if (text.includes('/Encrypt')) {
    throw new Error('Cannot enforce PDF/X: document is encrypted. Remove encryption first.');
  }
  if (text.includes('/JavaScript') || text.includes('/JS')) {
    throw new Error('Cannot enforce PDF/X: document contains JavaScript. Remove it first.');
  }

  let result = pdfBytes;

  // Step 1: Add output intent if missing
  if (!containsPattern(result, '/OutputIntents')) {
    result = addOutputIntent(result, options.outputIntent);
  }

  // Step 2: Set /Trapped in Info dictionary
  const trapped = options.trapped ?? 'False';
  result = setTrapped(result, trapped);

  // Step 3: Add TrimBox where missing
  result = addMissingTrimBoxes(result);

  // Step 4: Flatten transparency for X-1a and X-3
  if (options.level !== 'X-4') {
    result = flattenTransparencyForPdfX(result);
  }

  return result;
}

/**
 * Build a PDF/X output intent dictionary.
 *
 * Creates the /OutputIntent dictionary and ICC profile stream
 * for use in the catalog's /OutputIntents array.
 *
 * @param registry  The PDF object registry to register objects into.
 * @param config    The output intent configuration.
 * @returns         An indirect reference to the OutputIntent dictionary.
 */
export function buildPdfXOutputIntent(
  registry: PdfObjectRegistry,
  config: OutputIntentConfig,
): PdfRef {
  // Build the OutputIntent dictionary
  const intentDict = new PdfDict();
  intentDict.set('/Type', PdfName.of('/OutputIntent'));
  intentDict.set('/S', PdfName.of('/GTS_PDFX'));
  intentDict.set('/OutputConditionIdentifier', PdfString.literal(config.condition));

  if (config.registryName !== undefined) {
    intentDict.set('/RegistryName', PdfString.literal(config.registryName));
  }

  if (config.info !== undefined) {
    intentDict.set('/Info', PdfString.literal(config.info));
  }

  if (config.iccProfile !== undefined) {
    // Build ICC profile stream
    const profileDict = new PdfDict(new Map<string, PdfNumber | PdfName>([
      ['/N', new PdfNumber(4)], // CMYK by default
    ]));
    const profileStream = new PdfStream(profileDict, config.iccProfile);
    const profileRef = registry.register(profileStream);
    intentDict.set('/DestOutputProfile', profileRef);
  }

  return registry.register(intentDict);
}

// ---------------------------------------------------------------------------
// Enforcement helpers
// ---------------------------------------------------------------------------

/** Add an output intent dictionary to the catalog. */
function addOutputIntent(data: Uint8Array, config: OutputIntentConfig): Uint8Array {
  const text = decoder.decode(data);

  // Find the highest object number
  let maxObj = 0;
  for (const m of text.matchAll(/(\d+)\s+0\s+obj/g)) {
    const num = parseInt(m[1]!, 10);
    if (num > maxObj) maxObj = num;
  }

  const intentObjNum = maxObj + 1;

  // Build the output intent dictionary object
  const parts: string[] = [
    `${intentObjNum} 0 obj`,
    '<< /Type /OutputIntent',
    '   /S /GTS_PDFX',
    `   /OutputConditionIdentifier (${config.condition})`,
  ];

  if (config.registryName !== undefined) {
    parts.push(`   /RegistryName (${config.registryName})`);
  }
  if (config.info !== undefined) {
    parts.push(`   /Info (${config.info})`);
  }

  parts.push('>>');
  parts.push('endobj');
  const intentObj = parts.join('\n');

  // Add /OutputIntents reference in catalog
  const catalogIdx = findPattern(data, '/Type /Catalog');
  if (catalogIdx < 0) return data;
  const catalogEnd = findPattern(data, '>>', catalogIdx);
  if (catalogEnd < 0) return data;

  const intentRef = `\n/OutputIntents [${intentObjNum} 0 R]\n`;

  return concatBytes(
    data.subarray(0, catalogEnd),
    encoder.encode(intentRef),
    data.subarray(catalogEnd),
    encoder.encode('\n' + intentObj + '\n'),
  );
}

/** Set /Trapped in the Info dictionary (or add to trailer area). */
function setTrapped(data: Uint8Array, value: 'True' | 'False' | 'Unknown'): Uint8Array {
  const text = decoder.decode(data);

  // If /Trapped already exists, replace it
  if (text.includes('/Trapped')) {
    const updated = text.replace(
      /\/Trapped\s*\/\w+/,
      `/Trapped /${value}`,
    );
    return encoder.encode(updated);
  }

  // Find the /Info dictionary object
  // Look for /Info N G R in the trailer, then find that object
  const infoMatch = /\/Info\s+(\d+)\s+\d+\s+R/.exec(text);
  if (infoMatch) {
    const infoObjNum = infoMatch[1]!;
    const infoObjPattern = `${infoObjNum} 0 obj`;
    const infoIdx = findPattern(data, infoObjPattern);
    if (infoIdx >= 0) {
      const infoDictEnd = findPattern(data, '>>', infoIdx);
      if (infoDictEnd >= 0) {
        const trappedEntry = ` /Trapped /${value}`;
        return concatBytes(
          data.subarray(0, infoDictEnd),
          encoder.encode(trappedEntry),
          data.subarray(infoDictEnd),
        );
      }
    }
  }

  // If no /Info dict exists, add /Trapped as a new object and reference
  // from the trailer. For simplicity, add it near the trailer.
  const maxObj = findMaxObjNumber(text);
  const infoObjNum = maxObj + 1;

  const infoObj = `${infoObjNum} 0 obj\n<< /Trapped /${value} >>\nendobj\n`;

  // Add /Info reference to trailer
  const trailerIdx = findPattern(data, 'trailer');
  if (trailerIdx < 0) return data;
  const trailerEnd = findPattern(data, '>>', trailerIdx);
  if (trailerEnd < 0) return data;

  const infoRef = `\n/Info ${infoObjNum} 0 R\n`;

  return concatBytes(
    data.subarray(0, trailerEnd),
    encoder.encode(infoRef),
    data.subarray(trailerEnd),
    encoder.encode('\n' + infoObj),
  );
}

/** Find the highest object number in the PDF text. */
function findMaxObjNumber(text: string): number {
  let maxObj = 0;
  for (const m of text.matchAll(/(\d+)\s+0\s+obj/g)) {
    const num = parseInt(m[1]!, 10);
    if (num > maxObj) maxObj = num;
  }
  return maxObj;
}

/** Add TrimBox = CropBox (or MediaBox) on pages that lack TrimBox and BleedBox. */
function addMissingTrimBoxes(data: Uint8Array): Uint8Array {
  let text = decoder.decode(data);

  // Process each page dictionary
  text = text.replace(
    /(\/Type\s*\/Page\b(?!\s*s)[\s\S]*?)(?=\bendobj\b)/g,
    (match) => {
      // Skip if already has TrimBox or BleedBox
      if (match.includes('/TrimBox') || match.includes('/BleedBox')) {
        return match;
      }

      // Try to use CropBox as TrimBox, otherwise use MediaBox
      const cropBox = parseBox(match, 'CropBox');
      const mediaBox = parseBox(match, 'MediaBox');
      const box = cropBox ?? mediaBox;

      if (box) {
        const trimBoxStr = `/TrimBox [${box.join(' ')}]`;
        // Insert before the closing >> of the page dict
        const lastClose = match.lastIndexOf('>>');
        if (lastClose >= 0) {
          return match.slice(0, lastClose) + ' ' + trimBoxStr + ' ' + match.slice(lastClose);
        }
      }

      return match;
    },
  );

  return encoder.encode(text);
}

/** Flatten transparency for PDF/X-1a and X-3 compliance. */
function flattenTransparencyForPdfX(data: Uint8Array): Uint8Array {
  let text = decoder.decode(data);

  // Replace non-1.0 CA with /CA 1
  text = text.replace(/\/CA\s+[\d.]+/g, (match) => {
    const val = parseFloat(match.split(/\s+/)[1]!);
    return val < 1.0 ? '/CA 1' : match;
  });

  // Replace non-1.0 ca with /ca 1
  text = text.replace(/\/ca\s+[\d.]+/g, (match) => {
    const val = parseFloat(match.split(/\s+/)[1]!);
    return val < 1.0 ? '/ca 1' : match;
  });

  // Replace SMask references with /SMask /None
  text = text.replace(/\/SMask\s+(?!\/None)\S+/g, '/SMask /None');

  // Replace non-Normal blend modes with /BM /Normal
  text = text.replace(/\/BM\s+\/(?!Normal)\w+/g, '/BM /Normal');

  return encoder.encode(text);
}

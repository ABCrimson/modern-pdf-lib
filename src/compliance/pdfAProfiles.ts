/**
 * PDF/A profile definitions.
 *
 * Each PDF/A part has different rules:
 * - PDF/A-1 (ISO 19005-1:2005): Based on PDF 1.4. No transparency, no JPEG2000.
 * - PDF/A-2 (ISO 19005-2:2011): Based on PDF 1.7. Allows transparency, JPEG2000, layers.
 * - PDF/A-3 (ISO 19005-3:2012): Same as PDF/A-2 but allows embedded files of any type.
 */

import type { PdfALevel } from './pdfA.js';

export interface PdfAProfile {
  readonly part: 1 | 2 | 3;
  readonly conformance: 'a' | 'b' | 'u';
  readonly pdfVersion: string;
  readonly allowsTransparency: boolean;
  readonly allowsJpeg2000: boolean;
  readonly allowsLayers: boolean;
  readonly allowsEmbeddedFiles: boolean;
  readonly requiresStructureTree: boolean;
  readonly requiresToUnicode: boolean;
  readonly outputIntentSubtype: string;
}

const PROFILES: Record<PdfALevel, PdfAProfile> = {
  '1a': { part: 1, conformance: 'a', pdfVersion: '1.4', allowsTransparency: false, allowsJpeg2000: false, allowsLayers: false, allowsEmbeddedFiles: false, requiresStructureTree: true, requiresToUnicode: false, outputIntentSubtype: '/GTS_PDFA1' },
  '1b': { part: 1, conformance: 'b', pdfVersion: '1.4', allowsTransparency: false, allowsJpeg2000: false, allowsLayers: false, allowsEmbeddedFiles: false, requiresStructureTree: false, requiresToUnicode: false, outputIntentSubtype: '/GTS_PDFA1' },
  '2a': { part: 2, conformance: 'a', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: false, requiresStructureTree: true, requiresToUnicode: true, outputIntentSubtype: '/GTS_PDFA1' },
  '2b': { part: 2, conformance: 'b', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: false, requiresStructureTree: false, requiresToUnicode: false, outputIntentSubtype: '/GTS_PDFA1' },
  '2u': { part: 2, conformance: 'u', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: false, requiresStructureTree: false, requiresToUnicode: true, outputIntentSubtype: '/GTS_PDFA1' },
  '3a': { part: 3, conformance: 'a', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: true, requiresStructureTree: true, requiresToUnicode: true, outputIntentSubtype: '/GTS_PDFA1' },
  '3b': { part: 3, conformance: 'b', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: true, requiresStructureTree: false, requiresToUnicode: false, outputIntentSubtype: '/GTS_PDFA1' },
  '3u': { part: 3, conformance: 'u', pdfVersion: '1.7', allowsTransparency: true, allowsJpeg2000: true, allowsLayers: true, allowsEmbeddedFiles: true, requiresStructureTree: false, requiresToUnicode: true, outputIntentSubtype: '/GTS_PDFA1' },
};

/**
 * Get the profile definition for a PDF/A level.
 */
export function getProfile(level: PdfALevel): PdfAProfile {
  return PROFILES[level];
}

/**
 * Get all supported PDF/A levels.
 */
export function getSupportedLevels(): PdfALevel[] {
  return Object.keys(PROFILES) as PdfALevel[];
}

/**
 * Check if a PDF/A level is supported.
 */
export function isValidLevel(level: string): level is PdfALevel {
  return level in PROFILES;
}

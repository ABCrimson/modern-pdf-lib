/**
 * @module compliance
 *
 * PDF/A and PDF/X compliance validation and enforcement — barrel export.
 */

export { validatePdfA, enforcePdfA } from './pdfa/pdfA.js';
export type { PdfALevel, PdfAValidationResult, PdfAIssue } from './pdfa/pdfA.js';

export { detectTransparency, flattenTransparency } from './pdfa/transparencyFlattener.js';
export type { TransparencyInfo, TransparencyFinding } from './pdfa/transparencyFlattener.js';

export { generateSrgbIccProfile, SRGB_ICC_PROFILE } from './srgbIccProfile.js';
export { buildOutputIntent } from './outputIntent.js';
export type { OutputIntentOptions } from './outputIntent.js';

export {
  generateWinAnsiToUnicodeCmap,
  generateSymbolToUnicodeCmap,
  generateZapfDingbatsToUnicodeCmap,
  getToUnicodeCmap,
} from './pdfa/toUnicodeCmap.js';

export { getProfile, getSupportedLevels, isValidLevel } from './pdfa/pdfAProfiles.js';
export type { PdfAProfile } from './pdfa/pdfAProfiles.js';

export {
  extractXmpMetadata,
  parseXmpMetadata as parseXmpPdfAMetadata,
  validateXmpMetadata,
} from './xmp/xmpValidator.js';
export type { XmpValidationResult, XmpIssue, ParsedXmpMetadata } from './xmp/xmpValidator.js';

export { createAssociatedFile, buildAfArray } from './associatedFiles.js';
export type {
  AFRelationship,
  AssociatedFileOptions,
  AssociatedFileResult,
} from './associatedFiles.js';

export { stripProhibitedFeatures, countOccurrences } from './pdfa/stripProhibited.js';
export type { StripResult, StrippedFeature, StripOptions } from './pdfa/stripProhibited.js';

export { generatePdfAXmp, generatePdfAXmpBytes } from './xmp/xmpGenerator.js';
export type { PdfAXmpOptions } from './xmp/xmpGenerator.js';

export { enforcePdfAFull } from './pdfa/enforcePdfAv2.js';
export type {
  EnforcePdfAOptions,
  EnforcePdfAResult,
  EnforcementAction,
} from './pdfa/enforcePdfAv2.js';

export { validatePdfX, enforcePdfX, buildPdfXOutputIntent } from './pdfx/pdfxCompliance.js';
export type {
  PdfXLevel,
  PdfXValidationResult,
  PdfXIssue,
  PdfXOptions,
  OutputIntentConfig,
} from './pdfx/pdfxCompliance.js';

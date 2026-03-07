/**
 * @module compliance
 *
 * PDF/A compliance validation and enforcement — barrel export.
 */

export { validatePdfA, enforcePdfA } from './pdfA.js';
export type { PdfALevel, PdfAValidationResult, PdfAIssue } from './pdfA.js';

export { detectTransparency, flattenTransparency } from './transparencyFlattener.js';
export type { TransparencyInfo, TransparencyFinding } from './transparencyFlattener.js';

export { generateSrgbIccProfile, SRGB_ICC_PROFILE } from './srgbIccProfile.js';
export { buildOutputIntent } from './outputIntent.js';
export type { OutputIntentOptions } from './outputIntent.js';

export {
  generateWinAnsiToUnicodeCmap,
  generateSymbolToUnicodeCmap,
  generateZapfDingbatsToUnicodeCmap,
  getToUnicodeCmap,
} from './toUnicodeCmap.js';

export { getProfile, getSupportedLevels, isValidLevel } from './pdfAProfiles.js';
export type { PdfAProfile } from './pdfAProfiles.js';

export {
  extractXmpMetadata,
  parseXmpMetadata as parseXmpPdfAMetadata,
  validateXmpMetadata,
} from './xmpValidator.js';
export type {
  XmpValidationResult,
  XmpIssue,
  ParsedXmpMetadata,
} from './xmpValidator.js';

export { createAssociatedFile, buildAfArray } from './associatedFiles.js';
export type {
  AFRelationship,
  AssociatedFileOptions,
  AssociatedFileResult,
} from './associatedFiles.js';

export { stripProhibitedFeatures, countOccurrences } from './stripProhibited.js';
export type { StripResult, StrippedFeature, StripOptions } from './stripProhibited.js';

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

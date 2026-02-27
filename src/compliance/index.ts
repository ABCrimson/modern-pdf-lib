/**
 * @module compliance
 *
 * PDF/A compliance validation and enforcement — barrel export.
 */

export { validatePdfA, enforcePdfA } from './pdfA.js';
export type { PdfALevel, PdfAValidationResult, PdfAIssue } from './pdfA.js';

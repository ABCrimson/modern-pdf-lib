/**
 * @module accessibility
 *
 * Tagged PDF / accessibility module for `modern-pdf`.
 *
 * Provides structure tree management, marked-content operators, and
 * PDF/UA accessibility validation.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Structure tree
// ---------------------------------------------------------------------------

export {
  PdfStructureElement,
  PdfStructureTree,
} from './structureTree.js';
export type {
  StructureType,
  StructureElementOptions,
  AccessibilityIssue,
} from './structureTree.js';

// ---------------------------------------------------------------------------
// Marked content operators
// ---------------------------------------------------------------------------

export {
  beginMarkedContent,
  beginMarkedContentWithProperties,
  endMarkedContent,
  beginMarkedContentSequence,
  wrapInMarkedContent,
  createMarkedContentScope,
  beginArtifact,
  beginArtifactWithType,
  endArtifact,
} from './markedContent.js';
export type { MarkedContentScope } from './markedContent.js';

// ---------------------------------------------------------------------------
// Accessibility checker
// ---------------------------------------------------------------------------

export {
  checkAccessibility,
  summarizeIssues,
  isAccessible,
} from './accessibilityChecker.js';

// ---------------------------------------------------------------------------
// PDF/UA validator
// ---------------------------------------------------------------------------

export {
  validatePdfUa,
  enforcePdfUa,
} from './pdfUaValidator.js';
export type {
  PdfUaLevel,
  PdfUaError,
  PdfUaWarning,
  PdfUaValidationResult,
  PdfUaEnforcementResult,
} from './pdfUaValidator.js';

/**
 * @module annotation
 *
 * Barrel export for the annotation module.
 */

// Base annotation
export {
  PdfAnnotation,
  AnnotationFlags,
  createAnnotation,
  annotationFromDict,
  buildAnnotationDict,
} from './pdfAnnotation.js';
export type {
  AnnotationType,
  AnnotationOptions,
} from './pdfAnnotation.js';

// Text (sticky note)
export { PdfTextAnnotation } from './types/textAnnotation.js';
export type { TextAnnotationIcon } from './types/textAnnotation.js';

// Link
export { PdfLinkAnnotation } from './types/linkAnnotation.js';
export type { LinkHighlightMode } from './types/linkAnnotation.js';

// FreeText
export { PdfFreeTextAnnotation } from './types/freeTextAnnotation.js';
export type { FreeTextAlignment } from './types/freeTextAnnotation.js';

// Text markup
export {
  PdfHighlightAnnotation,
  PdfUnderlineAnnotation,
  PdfSquigglyAnnotation,
  PdfStrikeOutAnnotation,
} from './types/markupAnnotations.js';

// Shapes
export {
  PdfLineAnnotation,
  PdfSquareAnnotation,
  PdfCircleAnnotation,
  PdfPolygonAnnotation,
  PdfPolyLineAnnotation,
} from './types/shapeAnnotations.js';
export type { LineEndingStyle } from './types/shapeAnnotations.js';

// Stamp
export { PdfStampAnnotation } from './types/stampAnnotation.js';
export type { StandardStampName } from './types/stampAnnotation.js';

// Ink
export { PdfInkAnnotation } from './types/inkAnnotation.js';

// Redact
export { PdfRedactAnnotation } from './types/redactAnnotation.js';

// Appearance generator
export {
  generateSquareAppearance,
  generateCircleAppearance,
  generateLineAppearance,
  generateHighlightAppearance,
  generateUnderlineAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
  generateInkAppearance,
  generateFreeTextAppearance,
} from './appearanceGenerator.js';

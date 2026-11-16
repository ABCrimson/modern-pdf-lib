/**
 * Lightweight entry point for PDF creation only.
 *
 * Import from `modern-pdf-lib/create` when you only need to create PDFs.
 * This excludes the parser, forms, encryption, and signature modules
 * for smaller bundle size.
 *
 * @module modern-pdf-lib/create
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Document creation
// ---------------------------------------------------------------------------

export { createPdf, PdfDocument, StandardFonts } from './core/pdfDocument.js';
export type {
  StandardFontName,
  EmbedFontOptions,
  SetTitleOptions,
  CreatePdfOptions,
} from './core/pdfDocument.js';

// ---------------------------------------------------------------------------
// Page API
// ---------------------------------------------------------------------------

export { PdfPage, PageSizes } from './core/pdfPage.js';
export type {
  PageSize,
  FontRef,
  ImageRef,
  DrawTextOptions,
  DrawImageOptions,
  DrawRectangleOptions,
  DrawSquareOptions,
  DrawLineOptions,
  DrawCircleOptions,
  DrawEllipseOptions,
  DrawSvgPathOptions,
  DrawQrCodeOptions,
  TransparencyGroupOptions,
  SoftMaskBuilder,
  SoftMaskRef,
} from './core/pdfPage.js';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export {
  rgb,
  cmyk,
  grayscale,
  componentsToColor,
  colorToComponents,
  setFillingColor,
  setStrokingColor,
} from './core/operators/color.js';
export type { RgbColor, CmykColor, GrayscaleColor, Color } from './core/operators/color.js';

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

export { degrees, radians, degreesToRadians, radiansToDegrees } from './core/operators/state.js';
export type { Degrees, Radians, Angle } from './core/operators/state.js';

// ---------------------------------------------------------------------------
// Text layout helpers
// ---------------------------------------------------------------------------

export {
  layoutMultilineText,
  layoutCombedText,
  computeFontSize,
  layoutSinglelineText,
} from './core/layout.js';
export type {
  LayoutMultilineOptions,
  LayoutMultilineResult,
  LayoutCombedOptions,
  ComputeFontSizeOptions,
  LayoutSinglelineOptions,
  LayoutSinglelineResult,
} from './core/layout.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export {
  BlendMode,
  TextRenderingMode,
  LineCapStyle,
  LineJoinStyle,
  TextAlignment,
  ImageAlignment,
} from './core/enums.js';

// ---------------------------------------------------------------------------
// Save options
// ---------------------------------------------------------------------------

export type { PdfSaveOptions } from './core/io/pdfWriter.js';

// ---------------------------------------------------------------------------
// Page manipulation
// ---------------------------------------------------------------------------

export {
  insertPage,
  removePage,
  movePage,
  rotatePage,
  cropPage,
  getPageSize,
  resizePage,
  reversePages,
  removePages,
  rotateAllPages,
} from './core/pageManipulation.js';
export type { CropBox } from './core/pageManipulation.js';

// ---------------------------------------------------------------------------
// Merge / Split
// ---------------------------------------------------------------------------

export { mergePdfs, splitPdf, copyPages } from './core/documentMerge.js';
export type { PageRange } from './core/documentMerge.js';

// ---------------------------------------------------------------------------
// Font embedding (TrueType / OpenType)
// ---------------------------------------------------------------------------

export { EmbeddedFont } from './assets/font/fontEmbed.js';

// ---------------------------------------------------------------------------
// PDF embedding (Form XObjects)
// ---------------------------------------------------------------------------

export { embedPageAsFormXObject } from './core/pdfEmbed.js';
export type { EmbeddedPdfPage, DrawPageOptions, EmbedPageOptions } from './core/pdfEmbed.js';

// ---------------------------------------------------------------------------
// Gradients & Patterns
// ---------------------------------------------------------------------------

export {
  linearGradient,
  radialGradient,
  tilingPattern,
  buildGradientObjects,
  buildPatternObjects,
} from './graphics/patterns.js';
export type {
  ColorStop,
  LinearGradientOptions,
  RadialGradientOptions,
  TilingPatternOptions,
  GradientFill,
  PatternFill,
  RadialGradientFill,
  NormalizedStop,
} from './graphics/patterns.js';

// ---------------------------------------------------------------------------
// Document metadata types
// ---------------------------------------------------------------------------

export type { DocumentMetadata, CatalogOptions } from './core/pdfCatalog.js';

// ---------------------------------------------------------------------------
// PDF value helpers
// ---------------------------------------------------------------------------

export { asPDFName, asPDFNumber, asNumber } from './utils/pdfValueHelpers.js';

// ---------------------------------------------------------------------------
// Errors that the calls above can throw
// ---------------------------------------------------------------------------

export {
  PdfError,
  InvalidArgumentError,
  InvalidStateError,
  MalformedInputError,
  UnsupportedFeatureError,
  UnsupportedOptionError,
  UnencodableTextError,
  ResourceLimitError,
  InvalidPageSizeError,
  InvalidColorError,
  RemovePageFromEmptyDocumentError,
  FontNotEmbeddedError,
  EnvironmentError,
  PdfParseError,
  EncryptedPdfError,
  UnsupportedFilterError,
  UnsupportedEncryptionError,
  RedactionIncompleteError,
  PluginError,
  NoSuchFieldError,
  UnexpectedFieldTypeError,
  MissingOnValueCheckError,
  FieldAlreadyExistsError,
  InvalidFieldNamePartError,
  CombedTextLayoutError,
  ExceededMaxLengthError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Input limits
// ---------------------------------------------------------------------------

export { DEFAULT_LIMITS } from './limits.js';
export type { LimitName, PdfLimits, ResolvedLimits } from './limits.js';

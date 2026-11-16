/**
 * Lightweight entry point for PDF parsing and text extraction.
 *
 * Import from `modern-pdf-lib/parse` when you only need to load and
 * inspect existing PDFs. This excludes the creation API, forms,
 * encryption, and signature modules for smaller bundle size.
 *
 * @module modern-pdf-lib/parse
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export {
  loadPdf,
  extractText,
  extractTextWithPositions,
  parseContentStream,
  decodeStream,
  PdfParseError,
  formatHexContext,
} from './parser/index.js';

// ---------------------------------------------------------------------------
// Errors that the calls above can throw
// ---------------------------------------------------------------------------

export {
  PdfError,
  MalformedInputError,
  EncryptedPdfError,
  ResourceLimitError,
  UnsupportedFeatureError,
  UnsupportedOptionError,
  UnsupportedFilterError,
  UnsupportedEncryptionError,
  InvalidArgumentError,
  InvalidStateError,
  UnencodableTextError,
  InvalidPageSizeError,
  InvalidColorError,
  RemovePageFromEmptyDocumentError,
  FontNotEmbeddedError,
  EnvironmentError,
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
export type {
  LoadPdfOptions,
  TextItem,
  TextExtractionOptions,
  ContentStreamOperator,
  Operand,
} from './parser/index.js';

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

export { extractImages, decodeImageStream } from './assets/image/imageExtract.js';
export type { ImageInfo } from './assets/image/imageExtract.js';

// ---------------------------------------------------------------------------
// Image analysis
// ---------------------------------------------------------------------------

export { analyzeImages } from './assets/image/optimize/compressionAnalysis.js';
export type {
  ImageAnalysis,
  AnalysisReport,
  AnalyzeImagesOptions,
} from './assets/image/optimize/compressionAnalysis.js';

// ---------------------------------------------------------------------------
// Low-level objects (needed to inspect parsed PDFs)
// ---------------------------------------------------------------------------

export {
  PdfNull,
  PdfBool,
  PdfNumber,
  PdfString,
  PdfName,
  PdfArray,
  PdfDict,
  PdfStream,
  PdfRef,
} from './core/pdfObjects.js';
export type {
  PdfObject,
  PdfStringForm,
  PdfTextEncoding,
  PdfTextWriteEncoding,
} from './core/pdfObjects.js';

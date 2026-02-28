/**
 * @module modern-pdf-lib
 *
 * Public API for the `modern-pdf-lib` library — a modern, ESM-only PDF
 * creation engine that runs in every JavaScript runtime (Node, Deno,
 * Bun, Cloudflare Workers, browsers).
 *
 * ```ts
 * import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
 *
 * const doc = createPdf();
 * const page = doc.addPage(PageSizes.A4);
 * page.drawText('Hello, world!', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
 * const bytes = await doc.save();
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Core document API
// ---------------------------------------------------------------------------

export { createPdf, PdfDocument, StandardFonts } from './core/pdfDocument.js';
export type { StandardFontName, EmbedFontOptions, SetTitleOptions } from './core/pdfDocument.js';

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
} from './core/pdfPage.js';

// ---------------------------------------------------------------------------
// PDF embedding (Form XObjects)
// ---------------------------------------------------------------------------

export { embedPageAsFormXObject } from './core/pdfEmbed.js';
export type { EmbeddedPdfPage, DrawPageOptions, EmbedPageOptions } from './core/pdfEmbed.js';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export { rgb, cmyk, grayscale, componentsToColor, colorToComponents, setFillingColor, setStrokingColor } from './core/operators/color.js';
export type { RgbColor, CmykColor, GrayscaleColor, Color } from './core/operators/color.js';

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

export { degrees, radians, degreesToRadians, radiansToDegrees } from './core/operators/state.js';
export type { Degrees, Radians, Angle } from './core/operators/state.js';

// ---------------------------------------------------------------------------
// PDF value helpers
// ---------------------------------------------------------------------------

export { asPDFName, asPDFNumber, asNumber } from './utils/pdfValueHelpers.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export { BlendMode, TextRenderingMode, LineCapStyle, LineJoinStyle, TextAlignment, ImageAlignment, ParseSpeeds } from './core/enums.js';

// ---------------------------------------------------------------------------
// Save options
// ---------------------------------------------------------------------------

export type { PdfSaveOptions } from './core/pdfWriter.js';

// ---------------------------------------------------------------------------
// Page manipulation + Merge/Split
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

export {
  mergePdfs,
  splitPdf,
  copyPages,
} from './core/documentMerge.js';
export type { PageRange } from './core/documentMerge.js';

// ---------------------------------------------------------------------------
// Text layout helpers
// ---------------------------------------------------------------------------

export { layoutMultilineText, layoutCombedText, computeFontSize, layoutSinglelineText } from './core/layout.js';
export type {
  LayoutMultilineOptions,
  LayoutMultilineResult,
  LayoutCombedOptions,
  ComputeFontSizeOptions,
  LayoutSinglelineOptions,
  LayoutSinglelineResult,
} from './core/layout.js';

// ---------------------------------------------------------------------------
// Incremental save
// ---------------------------------------------------------------------------

export {
  saveIncremental,
  saveDocumentIncremental,
  ChangeTracker,
} from './core/incrementalWriter.js';
export type { IncrementalSaveResult } from './core/incrementalWriter.js';

// ---------------------------------------------------------------------------
// WASM initialisation
// ---------------------------------------------------------------------------

/** Whether initWasm has already completed successfully. */
let wasmInitialized = false;

/**
 * Options for WASM module initialization.
 */
export interface InitWasmOptions {
  /** Initialize the deflate/inflate WASM module. Default: `false`. */
  deflate?: boolean | undefined;
  /** Initialize the PNG decoding WASM module. Default: `false`. */
  png?: boolean | undefined;
  /** Initialize the font subsetting WASM module. Default: `false`. */
  fonts?: boolean | undefined;
  /**
   * Pre-loaded WASM bytes for the deflate module.
   * When provided, the module is instantiated directly from these bytes.
   */
  deflateWasm?: Uint8Array | undefined;
  /**
   * Pre-loaded WASM bytes for the PNG decoding module.
   */
  pngWasm?: Uint8Array | undefined;
  /**
   * Pre-loaded WASM bytes for the font subsetting module.
   */
  fontWasm?: Uint8Array | undefined;
}

/**
 * Initialize the optional WASM acceleration modules.
 *
 * Call this once before `save()` if you want WASM-accelerated
 * compression, PNG decoding, or font subsetting.  It is safe to call
 * multiple times -- subsequent calls are no-ops.
 *
 * If not called, the library falls back to pure-JS implementations
 * (fflate for compression, JS for PNG decoding).
 *
 * @param options  Configuration for which WASM modules to load,
 *                 and optionally pre-loaded WASM binary bytes.
 *                 When a string or URL is passed, it is treated as
 *                 a legacy `wasmUrl` parameter (ignored for backward
 *                 compatibility).
 * @returns        A promise that resolves when all requested modules
 *                 are ready.
 */
export async function initWasm(options?: string | URL | InitWasmOptions): Promise<void> {
  // Handle legacy signature: initWasm(wasmUrl)
  if (options === undefined || typeof options === 'string' || options instanceof URL) {
    // Legacy call or no-op call -- nothing to initialize without
    // explicit module selection.
    return;
  }

  // Idempotent: skip if already initialized
  if (wasmInitialized) return;

  const inits: Promise<void>[] = [];

  // Deflate WASM
  if (options.deflate || options.deflateWasm) {
    inits.push(
      import('./compression/libdeflateWasm.js').then(async ({ initDeflateWasm }) => {
        await initDeflateWasm(options.deflateWasm);
      }),
    );
  }

  // PNG WASM
  if (options.png || options.pngWasm) {
    inits.push(
      import('./assets/image/pngEmbed.js').then(async ({ initPngWasm }) => {
        await initPngWasm(options.pngWasm);
      }),
    );
  }

  // Font WASM (subsetting)
  if (options.fonts || options.fontWasm) {
    inits.push(
      import('./assets/font/fontSubset.js').then(async ({ initSubsetWasm }) => {
        await initSubsetWasm(options.fontWasm);
      }),
    );
  }

  // Wait for all requested modules to initialize
  await Promise.all(inits);

  wasmInitialized = true;
}

// ---------------------------------------------------------------------------
// Font embedding (TrueType / OpenType)
// ---------------------------------------------------------------------------

export { EmbeddedFont } from './assets/font/fontEmbed.js';
export type {
  FontEmbeddingResult,
  CIDFontData,
  CIDSystemInfoData,
  FontDescriptorData,
  Type0FontData,
  WidthEntry,
} from './assets/font/fontEmbed.js';
export type { SubsetResult, SubsetCmap } from './assets/font/fontSubset.js';
export { extractMetrics } from './assets/font/fontMetrics.js';
export type { FontMetrics } from './assets/font/fontMetrics.js';
export { isOpenTypeCFF, isTrueType } from './assets/font/otfDetect.js';

// ---------------------------------------------------------------------------
// Low-level operator API (60+ functions + PDFOperator class)
// ---------------------------------------------------------------------------

export {
  // Graphics — path construction & painting
  rectangle as rectangleOp,
  moveTo as moveToOp,
  lineTo as lineToOp,
  curveTo as curveToOp,
  curveToInitial,
  curveToFinal,
  closePath as closePathOp,
  stroke as strokeOp,
  closeAndStroke,
  fill as fillOp,
  fillEvenOdd,
  fillAndStroke as fillAndStrokeOp,
  fillEvenOddAndStroke,
  closeFillAndStroke,
  closeFillEvenOddAndStroke,
  endPath as endPathOp,
  clip as clipOp,
  clipEvenOdd,
  setLineWidth as setLineWidthOp,
  setLineCap as setLineCapOp,
  setLineJoin as setLineJoinOp,
  setMiterLimit,
  setDashPattern as setDashPatternOp,
  setFlatness,
  circlePath,
  ellipsePath,
  // Color
  setFillColorRgb,
  setFillColorCmyk,
  setFillColorGray,
  setStrokeColorRgb,
  setStrokeColorCmyk,
  setStrokeColorGray,
  setColorSpace,
  setStrokeColorSpace,
  setFillColor,
  setStrokeColor,
  applyFillColor,
  applyStrokeColor,
  // State & transforms
  saveState,
  restoreState,
  concatMatrix,
  translate as translateOp,
  scale as scaleOp,
  rotate as rotateOp,
  skew as skewOp,
  rotationMatrix,
  setGraphicsState as setGraphicsStateOp,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  // Text
  beginText,
  endText,
  setFont as setFontOp,
  setFontAndSize,
  setLeading as setLeadingOp,
  setCharacterSpacing as setCharacterSpacingOp,
  setWordSpacing as setWordSpacingOp,
  setTextRise as setTextRiseOp,
  setTextRenderingMode as setTextRenderingModeOp,
  setTextMatrix as setTextMatrixOp,
  moveText as moveTextOp,
  moveTextSetLeading,
  nextLine as nextLineOp,
  showText as showTextOp,
  showTextHex,
  showTextArray,
  showTextNextLine,
  showTextWithSpacing,
  setFontSize as setFontSizeOp,
  setLineHeight,
  setCharacterSqueeze,
  // XObject
  drawXObject,
  drawImageXObject,
  drawImageWithMatrix,
  drawObject,
  // First-class operator wrapper
  PDFOperator,
} from './core/operators/index.js';

// ---------------------------------------------------------------------------
// Low-level re-exports (for advanced users / plugins)
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
  PdfObjectRegistry,
} from './core/pdfObjects.js';
export type { ByteWriter, PdfObject, RegistryEntry } from './core/pdfObjects.js';

export { PdfWriter, serializePdf } from './core/pdfWriter.js';
export { PdfStreamWriter } from './core/pdfStream.js';

export {
  buildCatalog,
  buildPageTree,
  buildInfoDict,
  buildDocumentStructure,
  formatPdfDate,
} from './core/pdfCatalog.js';
export type {
  DocumentMetadata,
  PageEntry,
  CatalogOptions,
  DocumentStructure,
} from './core/pdfCatalog.js';

// ---------------------------------------------------------------------------
// Outlines (bookmarks)
// ---------------------------------------------------------------------------

export { PdfOutlineItem, PdfOutlineTree } from './outline/index.js';
export type { OutlineDestination, OutlineItemOptions } from './outline/index.js';

// ---------------------------------------------------------------------------
// Metadata (XMP + Viewer Preferences)
// ---------------------------------------------------------------------------

export {
  buildXmpMetadata,
  parseXmpMetadata,
  createXmpStream,
  buildViewerPreferencesDict,
  parseViewerPreferences,
  PdfViewerPreferences,
} from './metadata/index.js';
export type { ViewerPreferences } from './metadata/index.js';

// ---------------------------------------------------------------------------
// Accessibility (tagged PDF)
// ---------------------------------------------------------------------------

export {
  PdfStructureElement,
  PdfStructureTree,
  beginMarkedContent,
  beginMarkedContentWithProperties,
  endMarkedContent,
  beginMarkedContentSequence,
  wrapInMarkedContent,
  createMarkedContentScope,
  beginArtifact,
  beginArtifactWithType,
  endArtifact,
  checkAccessibility,
  summarizeIssues,
  isAccessible,
} from './accessibility/index.js';
export type {
  StructureType,
  StructureElementOptions,
  AccessibilityIssue,
  MarkedContentScope,
} from './accessibility/index.js';

// ---------------------------------------------------------------------------
// Encryption + Decryption
// ---------------------------------------------------------------------------

export {
  PdfEncryptionHandler,
  md5,
  rc4,
  aesEncryptCBC,
  aesDecryptCBC,
  sha256,
  sha384,
  sha512,
  encodePermissions,
  decodePermissions,
  computeFileEncryptionKey,
  verifyUserPassword,
  verifyOwnerPassword,
} from './crypto/index.js';
export type {
  EncryptOptions,
  EncryptAlgorithm,
  PdfPermissionFlags,
  EncryptDictValues,
} from './crypto/index.js';

// ---------------------------------------------------------------------------
// Forms (AcroForm)
// ---------------------------------------------------------------------------

export {
  PdfForm,
  PdfField,
  FieldFlags,
  PdfTextField,
  PdfCheckboxField,
  PdfRadioGroup,
  PdfDropdownField,
  PdfListboxField,
  PdfButtonField,
  PdfSignatureField,
  generateTextAppearance,
  generateCheckboxAppearance,
  generateRadioAppearance,
  generateDropdownAppearance,
  generateListboxAppearance,
  generateButtonAppearance,
  generateSignatureAppearance,
} from './form/index.js';
export type {
  FieldType,
  WidgetAnnotationHost,
  RefResolver,
  AppearanceProviderFor,
  TextAppearanceOptions,
  CheckboxAppearanceOptions,
  RadioAppearanceOptions,
  DropdownAppearanceOptions,
  ListboxAppearanceOptions,
  ButtonAppearanceOptions,
  SignatureAppearanceOptions,
} from './form/index.js';

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

export {
  PdfAnnotation,
  AnnotationFlags,
  createAnnotation,
  annotationFromDict,
  buildAnnotationDict,
  PdfTextAnnotation,
  PdfLinkAnnotation,
  PdfFreeTextAnnotation,
  PdfHighlightAnnotation,
  PdfUnderlineAnnotation,
  PdfSquigglyAnnotation,
  PdfStrikeOutAnnotation,
  PdfLineAnnotation,
  PdfSquareAnnotation,
  PdfCircleAnnotation,
  PdfPolygonAnnotation,
  PdfPolyLineAnnotation,
  PdfStampAnnotation,
  PdfInkAnnotation,
  PdfRedactAnnotation,
  generateSquareAppearance,
  generateCircleAppearance,
  generateLineAppearance,
  generateHighlightAppearance,
  generateUnderlineAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
  generateInkAppearance,
  generateFreeTextAppearance,
} from './annotation/index.js';
export type {
  AnnotationType,
  AnnotationOptions,
  TextAnnotationIcon,
  LinkHighlightMode,
  FreeTextAlignment,
  LineEndingStyle,
  StandardStampName,
} from './annotation/index.js';

// ---------------------------------------------------------------------------
// Parser — loading, text extraction, content-stream parsing
// ---------------------------------------------------------------------------

export {
  loadPdf,
  extractText,
  extractTextWithPositions,
  parseContentStream,
  decodeStream,
} from './parser/index.js';
export type {
  LoadPdfOptions,
  TextItem,
  TextExtractionOptions,
  ContentStreamOperator,
  Operand,
} from './parser/index.js';

// ---------------------------------------------------------------------------
// Digital Signatures
// ---------------------------------------------------------------------------

export {
  signPdf,
  getSignatures,
  verifySignatures,
  verifySignature,
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  findSignatures,
  buildPkcs7Signature,
  encodeLength,
  encodeSequence,
  encodeSet,
  encodeOID,
  encodeOctetString,
  encodeInteger,
  encodeUtf8String,
  encodePrintableString,
  encodeUTCTime,
  encodeContextTag,
  requestTimestamp,
  buildTimestampRequest,
  parseTimestampResponse,
} from './signature/index.js';
export type {
  SignOptions,
  PdfSignatureInfo,
  SignatureVerificationResult,
  ByteRangeResult,
  SignerInfo,
  SignatureOptions,
  TimestampResult,
} from './signature/index.js';

// ---------------------------------------------------------------------------
// SVG parsing and rendering
// ---------------------------------------------------------------------------

export {
  parseSvg,
  parseSvgPath,
  parseSvgColor,
  parseSvgTransform,
  svgToPdfOperators,
  drawSvgOnPage,
} from './assets/svg/index.js';
export type { SvgDrawCommand, SvgElement, SvgRenderOptions } from './assets/svg/index.js';

// ---------------------------------------------------------------------------
// Linearization
// ---------------------------------------------------------------------------

export { linearizePdf, isLinearized } from './core/linearization.js';
export type { LinearizationOptions } from './core/linearization.js';

// ---------------------------------------------------------------------------
// PDF/A compliance
// ---------------------------------------------------------------------------

export { validatePdfA, enforcePdfA } from './compliance/index.js';
export type { PdfALevel, PdfAValidationResult, PdfAIssue } from './compliance/index.js';

// ---------------------------------------------------------------------------
// Layers (Optional Content Groups)
// ---------------------------------------------------------------------------

export {
  PdfLayer,
  PdfLayerManager,
  beginLayerContent,
  endLayerContent,
} from './layers/index.js';

// ---------------------------------------------------------------------------
// Embedded files (attachments)
// ---------------------------------------------------------------------------

export {
  attachFile,
  getAttachments,
  buildEmbeddedFilesNameTree,
} from './core/embeddedFiles.js';
export type { EmbeddedFile } from './core/embeddedFiles.js';

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

export { addWatermark, addWatermarkToPage } from './core/watermark.js';
export type { WatermarkOptions } from './core/watermark.js';

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export { markForRedaction, applyRedactions, getRedactionMarks } from './core/redaction.js';
export type { RedactionOptions, RedactionMark } from './core/redaction.js';

// ---------------------------------------------------------------------------
// Base64 utilities
// ---------------------------------------------------------------------------

export { base64Encode, base64Decode } from './utils/base64.js';

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export {
  EncryptedPdfError,
  FontNotEmbeddedError,
  ForeignPageError,
  RemovePageFromEmptyDocumentError,
  NoSuchFieldError,
  UnexpectedFieldTypeError,
  MissingOnValueCheckError,
  FieldAlreadyExistsError,
  InvalidFieldNamePartError,
  FieldExistsAsNonTerminalError,
  RichTextFieldReadError,
  CombedTextLayoutError,
  ExceededMaxLengthError,
} from './errors.js';

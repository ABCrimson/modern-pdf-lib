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
  DrawQrCodeOptions,
  TransparencyGroupOptions,
  SoftMaskBuilder,
  SoftMaskRef,
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
// Gradients & Patterns
// ---------------------------------------------------------------------------

export { linearGradient, radialGradient, tilingPattern, buildGradientObjects, buildPatternObjects } from './core/patterns.js';
export type { ColorStop, LinearGradientOptions, RadialGradientOptions, TilingPatternOptions, GradientFill, PatternFill, RadialGradientFill, NormalizedStop } from './core/patterns.js';

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
  /** Initialize the JPEG encoding/decoding WASM module. Default: `false`. */
  jpeg?: boolean | undefined;
  /**
   * Pre-loaded WASM bytes for the JPEG encoding/decoding module.
   */
  jpegWasm?: Uint8Array | undefined;
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
      (async () => {
        const { initDeflateWasm } = await import('./compression/libdeflateWasm.js');
        await initDeflateWasm(options.deflateWasm);
      })(),
    );
  }

  // PNG WASM
  if (options.png || options.pngWasm) {
    inits.push(
      (async () => {
        const { initPngWasm } = await import('./assets/image/pngEmbed.js');
        await initPngWasm(options.pngWasm);
      })(),
    );
  }

  // Font WASM (subsetting)
  if (options.fonts || options.fontWasm) {
    inits.push(
      (async () => {
        const { initSubsetWasm } = await import('./assets/font/fontSubset.js');
        await initSubsetWasm(options.fontWasm);
      })(),
    );
  }

  // JPEG WASM (encoding/decoding)
  if (options.jpeg || options.jpegWasm) {
    inits.push(
      (async () => {
        const { initJpegWasm } = await import('./wasm/jpeg/bridge.js');
        await initJpegWasm(options.jpegWasm);
      })(),
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
  PdfPopupAnnotation,
  PdfCaretAnnotation,
  PdfFileAttachmentAnnotation,
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
  CaretSymbol,
  FileAttachmentIcon,
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
  PdfParseError,
  formatHexContext,
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
  // Incremental save with signature preservation
  saveIncrementalWithSignaturePreservation,
  appendIncrementalUpdate,
  findExistingSignatures,
  validateByteRangeIntegrity,
  parseExistingTrailer,
  // Multi-signature chain validation
  validateSignatureChain,
  // MDP (DocMDP) certification policy
  MdpPermission,
  setCertificationLevel,
  getCertificationLevel,
  buildDocMdpReference,
  // Modification detection
  detectModifications,
  // Signature field lock
  addFieldLock,
  getFieldLocks,
  buildFieldLockDict,
  // Document diff
  diffSignedContent,
  // Counter-signatures
  addCounterSignature,
  getCounterSignatures,
  // LTV embedding
  embedLtvData,
  buildDssDictionary,
  hasLtvData,
  // Incremental save optimization
  optimizeIncrementalSave,
  computeObjectHash,
  findChangedObjects,
} from './signature/index.js';
export type {
  SignOptions,
  VisibleSignatureOptions,
  PdfSignatureInfo,
  SignatureVerificationResult,
  ByteRangeResult,
  SignerInfo,
  SignatureOptions,
  TimestampResult,
  PrepareAppearanceOptions,
  // Incremental save types
  SignatureByteRange,
  IncrementalSaveOptions,
  AppendOptions,
  IncrementalObject,
  TrailerInfo,
  // Multi-signature chain types
  SignatureChainEntry,
  SignatureChainResult,
  // Modification detection types
  ModificationViolationType,
  ModificationViolation,
  ModificationReport,
  // Field lock types
  FieldLockOptions,
  FieldLockInfo,
  // Document diff types
  DocumentDiff,
  DiffEntry,
  // Counter-signature types
  CounterSignatureInfo,
  // LTV types
  LtvOptions,
  DssData,
  // Incremental optimizer types
  IncrementalChange,
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

export { linearizePdf, isLinearized, delinearizePdf, getLinearizationInfo } from './core/linearization.js';
export type { LinearizationOptions, LinearizationInfo } from './core/linearization.js';

// ---------------------------------------------------------------------------
// PDF/A compliance
// ---------------------------------------------------------------------------

export { validatePdfA, enforcePdfA, enforcePdfAFull, detectTransparency, flattenTransparency, generateSrgbIccProfile, SRGB_ICC_PROFILE, buildOutputIntent, generateWinAnsiToUnicodeCmap, generateSymbolToUnicodeCmap, generateZapfDingbatsToUnicodeCmap, getToUnicodeCmap, getProfile, getSupportedLevels, isValidLevel, extractXmpMetadata, parseXmpPdfAMetadata, validateXmpMetadata, createAssociatedFile, buildAfArray, stripProhibitedFeatures, countOccurrences, generatePdfAXmp, generatePdfAXmpBytes } from './compliance/index.js';
export type { PdfALevel, PdfAValidationResult, PdfAIssue, TransparencyInfo, TransparencyFinding, OutputIntentOptions, PdfAProfile, XmpValidationResult, XmpIssue, ParsedXmpMetadata, AFRelationship, AssociatedFileOptions, AssociatedFileResult, StripResult, StrippedFeature, StripOptions, PdfAXmpOptions, EnforcePdfAOptions, EnforcePdfAResult, EnforcementAction } from './compliance/index.js';

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

export { applyRedaction } from './annotation/applyRedactions.js';
export type { RedactionResult } from './annotation/applyRedactions.js';

// ---------------------------------------------------------------------------
// Image optimization
// ---------------------------------------------------------------------------

export {
  downscaleImage,
  recompressImage,
  optimizeImage,
  estimateJpegQuality,
} from './assets/image/imageOptimize.js';
export type {
  DownscaleOptions,
  RecompressOptions,
  ImageOptimizeOptions,
  RawImageData,
  OptimizeResult,
} from './assets/image/imageOptimize.js';

export {
  initJpegWasm,
  isJpegWasmReady,
  encodeJpegWasm,
  decodeJpegWasm,
} from './wasm/jpeg/bridge.js';
export type {
  ChromaSubsampling,
  JpegDecodeResult,
  JpegWasmModule,
} from './wasm/jpeg/bridge.js';

export { extractImages, decodeImageStream } from './assets/image/imageExtract.js';
export type { ImageInfo } from './assets/image/imageExtract.js';

export { optimizeAllImages } from './assets/image/batchOptimize.js';
export type {
  BatchOptimizeOptions,
  ImageOptimizeEntry,
  OptimizationReport,
  ProgressInfo,
} from './assets/image/batchOptimize.js';

export { deduplicateImages } from './assets/image/deduplicateImages.js';
export type { DeduplicationReport } from './assets/image/deduplicateImages.js';

export {
  isGrayscaleImage,
  convertToGrayscale,
} from './assets/image/grayscaleDetect.js';

export { extractIccProfile, embedIccProfile, parseIccColorSpace, parseIccDescription } from './assets/image/iccProfile.js';
export type { IccProfile } from './assets/image/iccProfile.js';

export {
  computeImageDpi,
  computeTargetDimensions,
} from './assets/image/dpiAnalyze.js';
export type { ImageDpi } from './assets/image/dpiAnalyze.js';

export { analyzeImages } from './assets/image/compressionAnalysis.js';
export type { ImageAnalysis, AnalysisReport, AnalyzeImagesOptions } from './assets/image/compressionAnalysis.js';

export { analyzeJpegMarkers } from './assets/image/jpegMarkers.js';
export type { JpegMarkerInfo } from './assets/image/jpegMarkers.js';

export { extractJpegMetadata, injectJpegMetadata } from './assets/image/imageMetadata.js';
export type { JpegMetadata } from './assets/image/imageMetadata.js';

// ---------------------------------------------------------------------------
// TIFF CMYK support
// ---------------------------------------------------------------------------

export {
  convertTiffCmykToRgb,
  embedTiffCmyk,
  isCmykTiff,
} from './assets/image/tiffCmyk.js';
export type { TiffIfdEntry, TiffCmykEmbedResult } from './assets/image/tiffCmyk.js';

// ---------------------------------------------------------------------------
// Image format detection
// ---------------------------------------------------------------------------

export {
  detectImageFormat,
  getImageFormatName,
  getSupportedFormats,
} from './assets/image/formatDetect.js';
export type { ImageFormat } from './assets/image/formatDetect.js';

// ---------------------------------------------------------------------------
// WebP optimization (decode → JPEG/PNG re-encode)
// ---------------------------------------------------------------------------

export {
  recompressWebP,
  webpToJpeg,
  webpToPng,
  encodePngFromPixels,
} from './assets/image/webpOptimize.js';

// ---------------------------------------------------------------------------
// TIFF direct embedding
// ---------------------------------------------------------------------------

export {
  embedTiffDirect,
  canDirectEmbed,
} from './assets/image/tiffDirectEmbed.js';
export type {
  DirectEmbedOptions,
  DirectEmbedResult,
} from './assets/image/tiffDirectEmbed.js';

// ---------------------------------------------------------------------------
// WebP decoding
// ---------------------------------------------------------------------------

export {
  decodeWebP,
  isWebP,
  isWebPLossless,
} from './assets/image/webpDecode.js';
export type { WebPImage } from './assets/image/webpDecode.js';

// ---------------------------------------------------------------------------
// TIFF decoding
// ---------------------------------------------------------------------------

export {
  decodeTiff,
  decodeTiffPage,
  decodeTiffAll,
  getTiffPageCount,
  parseTiffIfd,
  isTiff,
} from './assets/image/tiffDecode.js';
export type {
  TiffImage,
  TiffDecodeOptions,
  IfdEntry,
} from './assets/image/tiffDecode.js';

// ---------------------------------------------------------------------------
// WASM loader (streaming compilation, runtime detection, configuration)
// ---------------------------------------------------------------------------

export {
  loadWasmModule,
  loadWasmModuleStreaming,
  instantiateWasmModuleStreaming,
  configureWasmLoader,
  provideWasmBytes,
  isWasmModuleCached,
  clearWasmCache,
  resetWasmLoader,
  detectRuntime,
  isWasmDisabled,
} from './wasm/loader.js';
export type { RuntimeKind, WasmLoaderConfig } from './wasm/loader.js';

// ---------------------------------------------------------------------------
// Browser utilities (Web Worker API)
// ---------------------------------------------------------------------------

export { PdfWorker } from './browser/worker.js';
export type { PdfWorkerOptions } from './browser/worker.js';

// ---------------------------------------------------------------------------
// Base64 utilities
// ---------------------------------------------------------------------------

export { base64Encode, base64Decode } from './utils/base64.js';

// ---------------------------------------------------------------------------
// Barcode encoding
// ---------------------------------------------------------------------------

export {
  encodeCode128,
  encodeCode128Values,
  valuesToModules,
  code128ToOperators,
  encodeCode39,
  computeCode39CheckDigit,
  code39ToOperators,
  encodeItf,
  itfToOperators,
  encodeEan13,
  encodeEan8,
  calculateEanCheckDigit,
  ean13ToOperators,
  ean8ToOperators,
  encodeUpcA,
  calculateUpcCheckDigit,
  upcAToOperators,
  encodeQrCode,
  qrCodeToOperators,
  encodeDataMatrix,
  dataMatrixToOperators,
  encodePdf417,
  pdf417ToOperators,
  renderStyledBarcode,
  calculateBarcodeDimensions,
  readCode128,
  readEan13,
  readEan8,
  readCode39,
  readBarcode,
} from './barcode/index.js';
export type { Code128Options, Code39Options, ItfOptions, BarcodeMatrix, BarcodeOptions, EanOptions, UpcOptions, QrCodeOptions, QrCodeMatrix, ErrorCorrectionLevel, DataMatrixOptions, DataMatrixResult, Pdf417Options, Pdf417Matrix, StyledBarcodeOptions, BarcodeReadResult } from './barcode/index.js';

// ---------------------------------------------------------------------------
// Table layout
// ---------------------------------------------------------------------------

export { renderTable, renderMultiPageTable } from './layout/index.js';
export type {
  TextRun,
  CellContent,
  NestedTableContent,
  TableCell,
  TableRow,
  TableColumn,
  DrawTableOptions,
  TableRenderResult,
  PageContent,
  MultiPageTableResult,
} from './layout/index.js';

export {
  minimalPreset,
  stripedPreset,
  borderedPreset,
  professionalPreset,
  applyPreset,
  applyTablePreset,
} from './layout/index.js';
export type { TablePreset, PresetName, PresetOptions } from './layout/index.js';

export { estimateTextWidth, applyOverflow, wrapText, truncateText, ellipsisText, shrinkFontSize } from './layout/index.js';
export type { OverflowMode, OverflowResult } from './layout/index.js';

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

// ---------------------------------------------------------------------------
// Form flattening
// ---------------------------------------------------------------------------

export { flattenForm, flattenField, flattenFields } from './form/formFlatten.js';
export type { FlattenOptions, FlattenFormResult } from './form/formFlatten.js';

// ---------------------------------------------------------------------------
// Bookmarks / Outlines
// ---------------------------------------------------------------------------

export { addBookmark, getBookmarks, removeBookmark, removeAllBookmarks } from './core/outlines.js';
export type { BookmarkRef, BookmarkNode, AddBookmarkOptions } from './core/outlines.js';

// ---------------------------------------------------------------------------
// Page labels
// ---------------------------------------------------------------------------

export { setPageLabels, getPageLabels, removePageLabels } from './core/pageLabels.js';
export type { PageLabelRange, PageLabelStyle } from './core/pageLabels.js';

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

export { processBatch, batchMerge, batchFlatten } from './batch/batchProcessor.js';
export type { BatchOptions, BatchResult, BatchProgressCallback } from './batch/batchProcessor.js';

// ---------------------------------------------------------------------------
// PDF/UA validation
// ---------------------------------------------------------------------------

export { validatePdfUa, enforcePdfUa } from './accessibility/pdfUaValidator.js';
export type { PdfUaValidationResult, PdfUaError, PdfUaWarning, PdfUaLevel, PdfUaEnforcementResult } from './accessibility/pdfUaValidator.js';

// ---------------------------------------------------------------------------
// Inline WASM
// ---------------------------------------------------------------------------

export { getInlineWasmBytes, hasInlineWasmData, isValidModuleName } from './wasm/inlineWasm.js';
export type { WasmModuleName } from './wasm/inlineWasm.js';

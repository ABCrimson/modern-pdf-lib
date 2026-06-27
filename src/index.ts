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

export { rgb, cmyk, grayscale, componentsToColor, colorToComponents, setFillingColor, setStrokingColor, spotColor, deviceNColor, rgbToCmyk, cmykToRgb, colorToHex, hexToColor, spotResourceName, deviceNResourceName } from './core/operators/color.js';
export type { RgbColor, CmykColor, GrayscaleColor, SpotColor, DeviceNColor, Color } from './core/operators/color.js';

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

export { asPDFName, asPDFNumber, asPdfName, asPdfNumber, asNumber } from './utils/pdfValueHelpers.js';

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
  // Spot / Separation / DeviceN colour space builders
  buildSeparationColorSpace,
  buildDeviceNColorSpace,
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
  searchTextItems,
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
  interpolateLinearRgb,
  applySpreadMethod,
} from './assets/svg/index.js';
export type { SvgDrawCommand, SvgElement, SvgRenderOptions, SvgGradient, SvgGradientStop } from './assets/svg/index.js';

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
export type { RedactionResult, OverlayAlignment, RedactionOperatorOptions } from './annotation/applyRedactions.js';

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

export {
  applyHeaderFooter,
  applyHeaderFooterToPage,
  toRoman,
  toAlpha,
  formatDate,
  replaceTemplateVariables,
} from './layout/index.js';
export type {
  HeaderFooterPosition,
  HeaderFooterContent,
  HeaderFooterOptions,
} from './layout/index.js';

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
  InvalidPageSizeError,
  InvalidColorError,
  PluginError,
  StreamingParseError,
  BatchProcessingError,
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
export type { BatchOptions, BatchResult, BatchProgressCallback, BatchErrorStrategy } from './batch/batchProcessor.js';

// ---------------------------------------------------------------------------
// PDF/UA validation
// ---------------------------------------------------------------------------

export { validatePdfUa, enforcePdfUa } from './accessibility/pdfUaValidator.js';
export type { PdfUaValidationResult, PdfUaError, PdfUaWarning, PdfUaLevel, PdfUaEnforcementResult } from './accessibility/pdfUaValidator.js';

// ---------------------------------------------------------------------------
// Inline WASM
// ---------------------------------------------------------------------------

export { getInlineWasmBytes, hasInlineWasmData, isValidModuleName, getInlineWasmSize, preloadInlineWasm } from './wasm/inlineWasm.js';
export type { WasmModuleName } from './wasm/inlineWasm.js';

// ---------------------------------------------------------------------------
// Builder pattern
// ---------------------------------------------------------------------------

export { PdfDocumentBuilder } from './core/pdfDocumentBuilder.js';

// ---------------------------------------------------------------------------
// Streaming parser
// ---------------------------------------------------------------------------

export { StreamingPdfParser } from './parser/streamingParser.js';
export type { StreamingParserOptions, ParsedPage, StreamingParseResult, StreamingParserEvent } from './parser/streamingParser.js';

// ---------------------------------------------------------------------------
// Plugin system
// ---------------------------------------------------------------------------

export { PdfPluginManager } from './plugins/index.js';
export type { PdfPlugin, PluginDocument, PluginPage } from './plugins/index.js';
export { timestampPlugin } from './plugins/index.js';
export type { TimestampPluginOptions } from './plugins/index.js';
export { metadataPlugin } from './plugins/index.js';
export type { MetadataPluginOptions } from './plugins/index.js';
export { accessibilityPlugin } from './plugins/index.js';
export type { AccessibilityPluginOptions } from './plugins/index.js';

// ---------------------------------------------------------------------------
// Reading & extraction (0.28.6) — table extraction
// ---------------------------------------------------------------------------
export { extractTables, tableToCsv, tableToJson } from './parser/tableExtract.js';
export type { ExtractedTable, TableExtractOptions } from './parser/tableExtract.js';

// ---------------------------------------------------------------------------
// PDF 2.0 core (0.30.0 / 0.30.5 / 0.30.9)
// ---------------------------------------------------------------------------
export { buildDPartRoot } from './core/documentParts.js';
export type { DocumentPart } from './core/documentParts.js';
export { buildRequirement, buildRequirements } from './core/requirements.js';
export type { RequirementType } from './core/requirements.js';
export { buildPieceInfo } from './core/pieceInfo.js';

// ---------------------------------------------------------------------------
// Tagged-PDF structure namespaces (0.30.4)
// ---------------------------------------------------------------------------
export {
  buildNamespace,
  buildNamespacesArray,
  PDF2_NAMESPACE,
  MATHML_NAMESPACE,
} from './accessibility/namespaces.js';
export type { NamespaceDef } from './accessibility/namespaces.js';

// ---------------------------------------------------------------------------
// Structured validation report — JSON + SARIF 2.1.0 (0.32.7)
// ---------------------------------------------------------------------------
export {
  toJsonReport,
  toSarif,
  SARIF_SCHEMA_URI,
  DEFAULT_SARIF_TOOL_NAME,
} from './compliance/validationReport.js';
export type {
  ValidationLevel,
  ValidationFinding,
  JsonReport,
  SarifLog,
  SarifRun,
  SarifResult,
} from './compliance/validationReport.js';

// ---------------------------------------------------------------------------
// CIE device-independent color spaces (0.37.1)
// ---------------------------------------------------------------------------
export { buildCalGray, buildCalRGB, buildLab, labToRgb } from './core/colorSpacesCIE.js';
export type { CalGrayParams, CalRGBParams, LabParams } from './core/colorSpacesCIE.js';

// ---------------------------------------------------------------------------
// Standalone document timestamp (0.34.6)
// ---------------------------------------------------------------------------
export {
  buildDocTimeStampDict,
  DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE,
} from './signature/docTimeStamp.js';
export type { DocTimeStampOptions } from './signature/docTimeStamp.js';

// ---------------------------------------------------------------------------
// Word/line/paragraph reconstruction (0.28.3)
// ---------------------------------------------------------------------------
export { reconstructLines, reconstructParagraphs } from './parser/textReconstruct.js';
export type {
  Line as TextLine,
  Paragraph as TextParagraph,
  ReconstructOptions,
} from './parser/textReconstruct.js';

// ---------------------------------------------------------------------------
// PDF Portfolios / Collections (0.33.7)
// ---------------------------------------------------------------------------
export { buildCollection } from './core/collections.js';
export type {
  CollectionView,
  CollectionSchemaField,
  CollectionOptions,
} from './core/collections.js';

// ---------------------------------------------------------------------------
// Markdown-to-PDF (0.40.4)
// ---------------------------------------------------------------------------
export { markdownToPdf } from './assets/markdown/markdownToPdf.js';
export type { MarkdownToPdfOptions } from './assets/markdown/markdownToPdf.js';

// ---------------------------------------------------------------------------
// PDF function objects + evaluator (0.37.0)
// ---------------------------------------------------------------------------
export { evaluateFunction } from './core/pdfFunctions.js';
export type {
  SampledFunction,
  ExponentialFunction,
  StitchingFunction,
  PostScriptFunction,
  PdfFunctionDef,
} from './core/pdfFunctions.js';

// ---------------------------------------------------------------------------
// Halftone dictionaries + transfer functions (0.38.7)
// ---------------------------------------------------------------------------
export {
  buildType1Halftone,
  buildThresholdHalftone,
  buildType5Halftone,
  identityTransferFunction,
  buildSampledTransferFunction,
  nameHalftone,
  STANDARD_SPOT_FUNCTIONS,
} from './core/halftone.js';
export type { Type1Halftone } from './core/halftone.js';

// ---------------------------------------------------------------------------
// PDF/X-6 print-production conformance (0.32.4)
// ---------------------------------------------------------------------------
export {
  buildPdfX6OutputIntent,
  buildGtsPdfxVersion,
  validateBoxGeometry,
  buildBoxDict,
} from './compliance/pdfX6.js';
export type { PdfX6Variant, PdfX6Options, PdfRect, BoxGeometry } from './compliance/pdfX6.js';

// ---------------------------------------------------------------------------
// Factur-X / ZUGFeRD CII e-invoice XML (0.33.2)
// ---------------------------------------------------------------------------
export { generateCiiXml } from './compliance/facturX.js';
export type { FacturXProfile, Invoice, InvoiceParty, InvoiceLine } from './compliance/facturX.js';

// ---------------------------------------------------------------------------
// Developer-experience helpers — code frames + did-you-mean (0.40.7)
// ---------------------------------------------------------------------------
export { renderCodeFrame, levenshtein, didYouMean } from './utils/codeframe.js';
export type { CodeFrameOptions } from './utils/codeframe.js';

// ---------------------------------------------------------------------------
// Function-based shading (0.37.3)
// ---------------------------------------------------------------------------
export { buildFunctionShading, sampleShadingColor } from './core/shadingFunction.js';
export type { FunctionShadingOptions } from './core/shadingFunction.js';

// ---------------------------------------------------------------------------
// PDF/A-4 conformance metadata (0.32.1 / 0.32.2)
// ---------------------------------------------------------------------------
export { buildPdfA4Xmp, pdfA4Rules } from './compliance/pdfA4.js';
export type {
  PdfA4Level,
  PdfA4Options,
  PdfA4ExtensionSchema,
  PdfA4ExtensionProperty,
} from './compliance/pdfA4.js';

// ---------------------------------------------------------------------------
// XRechnung / Order-X e-document profiles (0.33.4)
// ---------------------------------------------------------------------------
export { generateXRechnungCii, generateOrderX } from './compliance/xRechnung.js';
export type { XRechnungOptions, OrderXType } from './compliance/xRechnung.js';

// ---------------------------------------------------------------------------
// Font fallback chains (0.36.7)
// ---------------------------------------------------------------------------
export { resolveFallback, splitByScript } from './assets/font/fontFallback.js';
export type { FallbackFont, FallbackRun, ScriptRun } from './assets/font/fontFallback.js';

// ---------------------------------------------------------------------------
// HTTP Range-request lazy fetch (0.39.6)
// ---------------------------------------------------------------------------
export { createRangeFetcher } from './runtime/rangeFetch.js';
export type {
  FetchLike,
  FetchLikeResponse,
  RangeFetcher,
  RangeFetchOptions,
} from './runtime/rangeFetch.js';

// ---------------------------------------------------------------------------
// Declarative VDOM-to-PDF (0.40.0)
// ---------------------------------------------------------------------------
export { h as createVNode, renderToPdf } from './assets/vdom/reconciler.js';
export type { VNode, RenderOptions as VdomRenderOptions } from './assets/vdom/reconciler.js';

// ---------------------------------------------------------------------------
// PDF/VT variable & transactional printing (0.32.5)
// ---------------------------------------------------------------------------
export { buildVtDpm, buildPdfVtDParts, gtsPdfVtVersion } from './compliance/pdfVT.js';
export type { PdfVtConformance, RecordMetadata as VtRecordMetadata } from './compliance/pdfVT.js';

// ---------------------------------------------------------------------------
// Worker-pool task orchestrator (0.39.0)
// ---------------------------------------------------------------------------
export { createWorkerPool } from './runtime/workerPool.js';
export type { TaskRunner, WorkerPool, WorkerPoolOptions } from './runtime/workerPool.js';

// ---------------------------------------------------------------------------
// External (HSM/KMS) deferred-hash signer (0.34.4)
// ---------------------------------------------------------------------------
export { signDeferred } from './signature/externalSigner.js';
export type {
  SignatureAlgorithm,
  ExternalSigner,
  DeferredSignOptions,
  DeferredSignResult,
} from './signature/externalSigner.js';

// ---------------------------------------------------------------------------
// WOFF / WOFF2 font input (0.36.3)
// ---------------------------------------------------------------------------
export { isWoff, isWoff2, readWoffHeader, decodeWoff } from './assets/font/woff.js';
export type { WoffInfo } from './assets/font/woff.js';

// ---------------------------------------------------------------------------
// Acrobat-compatible form scripting (docs/guide/form-scripts.md)
// ---------------------------------------------------------------------------
export { AFNumber_Format, formatNumber } from './form/acrobatBuiltins.js';
export {
  AFDate_FormatEx,
  parseAcrobatDate,
  // Re-exported as `formatAcrobatDate` to disambiguate from the header/footer
  // engine's `formatDate` (same name, different format-token vocabulary).
  formatDate as formatAcrobatDate,
} from './form/acrobatDateBuiltins.js';
export { AFSpecial_Format } from './form/acrobatSpecialBuiltins.js';
export { validateFieldValue } from './form/fieldValidation.js';
export { resolveFieldReference, getFieldValue, setFieldValue } from './form/fieldReferences.js';
export { setFieldVisibility, addVisibilityAction } from './form/fieldVisibility.js';
export { createSandbox } from './form/scriptSandbox.js';

// ---------------------------------------------------------------------------
// Signature verification, revocation & trust (docs/guide/verification.md)
// ---------------------------------------------------------------------------
export { checkCertificateStatus, extractOcspUrl } from './signature/ocsp.js';
export { downloadCrl, isCertificateRevoked, extractCrlUrls } from './signature/crl.js';
export { TrustStore } from './signature/trustStore.js';
export { verifySignatureDetailed } from './signature/detailedVerifier.js';

// ---------------------------------------------------------------------------
// JPEG 2000 decoding internals (docs/guide/jpeg2000.md)
// ---------------------------------------------------------------------------
export { decodeJpeg2000 } from './parser/jpeg2000Decode.js';
export {
  parseTileInfo,
  decodeTile,
  decodeTileRegion,
  assembleTiles,
} from './parser/jpeg2000Tiles.js';
export {
  getComponentDepths,
  summarizeBitDepth,
  normalizeComponentDepth,
  downscale16To8,
  upscale8To16,
  offsetSignedToUnsigned,
} from './parser/jpeg2000BitDepth.js';

// ---------------------------------------------------------------------------
// PDF/X validation & enforcement (docs/guide/pdfx.md)
// ---------------------------------------------------------------------------
export { validatePdfX, enforcePdfX, buildPdfXOutputIntent } from './compliance/pdfxCompliance.js';

// ---------------------------------------------------------------------------
// Advanced text-layout primitives (docs/guide/text-layout.md)
// ---------------------------------------------------------------------------
export {
  layoutParagraph,
  layoutColumns,
  layoutTextFlow,
  findHyphenationPoints,
} from './layout/textLayout.js';

// ---------------------------------------------------------------------------
// Certificate chain / policy / offline revocation (docs/guide/verification.md)
// ---------------------------------------------------------------------------
export { buildCertificateChain, validateCertificateChain } from './signature/chainValidator.js';
export {
  validateCertificatePolicy,
  validateKeyUsage,
  validateExtendedKeyUsage,
  EKU_OIDS,
} from './signature/certPolicy.js';
export {
  extractEmbeddedRevocationData,
  verifyOfflineRevocation,
} from './signature/offlineRevocation.js';

// ---------------------------------------------------------------------------
// Rendering & rasterization (0.29.x): content-stream interpreter, pure-JS
// rasterizer, Canvas adapter, thumbnails, image/font extraction, visual diff,
// OCR overlay, redaction-by-removal, and tiling/cache.
// ---------------------------------------------------------------------------
export { interpretContentStream, interpretPage } from './render/interpreter.js';
export type { InterpretOptions } from './render/interpreter.js';
export type { Matrix } from './render/matrix.js';
export type {
  DisplayList,
  DisplayItem,
  FillItem,
  StrokeItem,
  ImageItem,
  SubPath,
  Rgba,
  TextItem as TextDisplayItem,
} from './render/displayList.js';
export { rasterize, renderPageToImage } from './render/rasterizer.js';
export type { RenderOptions, RasterImage } from './render/rasterizer.js';
export { renderPageToCanvas, renderDisplayListToCanvas } from './render/canvas.js';
export type { CanvasRenderOptions, Canvas2DLike } from './render/canvas.js';
export { generateThumbnail } from './render/thumbnail.js';
export type { ThumbnailOptions } from './render/thumbnail.js';
export { extractImages as extractPageImages } from './render/imageExtract.js';
export type { ExtractedImage } from './render/imageExtract.js';
export { extractFonts } from './render/fontExtract.js';
export type { ExtractedFont, FontFileFormat } from './render/fontExtract.js';
export { compareImages, comparePages } from './render/diff.js';
export type { DiffResult, CompareOptions } from './render/diff.js';
export { applyOcr } from './render/ocr.js';
export type { OcrEngine, OcrWord, ApplyOcrOptions } from './render/ocr.js';
export { redactRegions } from './render/redactContent.js';
export type { RedactRect, RedactResult } from './render/redactContent.js';
export { computeTileGrid, renderPageTile, RenderCache } from './render/tiles.js';
export type { TileOptions, TileGrid } from './render/tiles.js';

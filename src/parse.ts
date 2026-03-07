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

export { loadPdf, extractText, extractTextWithPositions, parseContentStream, decodeStream } from './parser/index.js';
export type { LoadPdfOptions, TextItem, TextExtractionOptions, ContentStreamOperator } from './parser/index.js';

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

export { extractImages, decodeImageStream } from './assets/image/imageExtract.js';
export type { ImageInfo } from './assets/image/imageExtract.js';

// ---------------------------------------------------------------------------
// Image analysis
// ---------------------------------------------------------------------------

export { analyzeImages } from './assets/image/compressionAnalysis.js';
export type { ImageAnalysis, AnalysisReport } from './assets/image/compressionAnalysis.js';

// ---------------------------------------------------------------------------
// Low-level objects (needed to inspect parsed PDFs)
// ---------------------------------------------------------------------------

export { PdfNull, PdfBool, PdfNumber, PdfString, PdfName, PdfArray, PdfDict, PdfStream, PdfRef } from './core/pdfObjects.js';
export type { PdfObject } from './core/pdfObjects.js';

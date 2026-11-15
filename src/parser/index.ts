/**
 * @module parser
 *
 * Public API surface for the PDF parser subsystem.
 *
 * Re-exports the high-level parsing functions, text extraction utilities,
 * content-stream parsing, and stream decoding.  Internal implementation
 * details (lexer, object parser, xref parser) are intentionally kept
 * private.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Document loading
// ---------------------------------------------------------------------------

export { loadPdf } from './documentParser.js';
export type { LoadPdfOptions } from './documentParser.js';

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

export { extractText, extractTextWithPositions } from './text/textExtractor.js';
export type { TextItem, TextExtractionOptions } from './text/textExtractor.js';
export { searchTextItems } from './text/textSearch.js';
export type { TextMatch, SearchRect, SearchOptions } from './text/textSearch.js';

// ---------------------------------------------------------------------------
// Content stream parsing
// ---------------------------------------------------------------------------

export { parseContentStream } from './contentStreamParser.js';
export type { ContentStreamOperator, Operand } from './contentStreamParser.js';

// ---------------------------------------------------------------------------
// Stream decoding
// ---------------------------------------------------------------------------

export { decodeStream } from '../codecs/streamDecode.js';

// ---------------------------------------------------------------------------
// JBIG2 WASM acceleration
// ---------------------------------------------------------------------------

export { decodeJBIG2Async } from '../codecs/jbig2/jbig2Decode.js';
export { initJBIG2Wasm, isJBIG2WasmAvailable, disposeJBIG2Wasm } from './jbig2WasmBridge.js';

// ---------------------------------------------------------------------------
// JPEG2000 (JPXDecode) decoding
// ---------------------------------------------------------------------------

export { decodeJpeg2000, getJpeg2000Info } from '../codecs/jpeg2000/jpeg2000Decode.js';
export type {
  Jpeg2000Image,
  Jpeg2000DecodeParams,
  Jpeg2000ColorSpace,
  Jpeg2000Info,
} from '../codecs/jpeg2000/jpeg2000Decode.js';

// ---------------------------------------------------------------------------
// JPEG2000 to JPEG transcoding
// ---------------------------------------------------------------------------

export {
  transcodeJp2ToJpeg,
  estimateTranscodedSize,
} from '../codecs/internal/jpeg2000Transcode.js';
export type { TranscodeOptions } from '../codecs/internal/jpeg2000Transcode.js';

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

export { PdfParseError, formatHexContext } from './parseError.js';

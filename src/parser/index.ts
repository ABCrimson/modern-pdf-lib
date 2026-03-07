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

export { extractText, extractTextWithPositions } from './textExtractor.js';
export type { TextItem, TextExtractionOptions } from './textExtractor.js';

// ---------------------------------------------------------------------------
// Content stream parsing
// ---------------------------------------------------------------------------

export { parseContentStream } from './contentStreamParser.js';
export type { ContentStreamOperator, Operand } from './contentStreamParser.js';

// ---------------------------------------------------------------------------
// Stream decoding
// ---------------------------------------------------------------------------

export { decodeStream } from './streamDecode.js';

// ---------------------------------------------------------------------------
// JBIG2 WASM acceleration
// ---------------------------------------------------------------------------

export { decodeJBIG2Async } from './jbig2Decode.js';
export {
  initJBIG2Wasm,
  isJBIG2WasmAvailable,
  disposeJBIG2Wasm,
} from './jbig2WasmBridge.js';

// ---------------------------------------------------------------------------
// JPEG2000 (JPXDecode) decoding
// ---------------------------------------------------------------------------

export { decodeJpeg2000, getJpeg2000Info } from './jpeg2000Decode.js';
export type {
  Jpeg2000Image,
  Jpeg2000DecodeParams,
  Jpeg2000ColorSpace,
  Jpeg2000Info,
} from './jpeg2000Decode.js';

// ---------------------------------------------------------------------------
// JPEG2000 WASM acceleration
// ---------------------------------------------------------------------------

export {
  initJpeg2000Wasm,
  isJpeg2000WasmReady,
  decodeJpeg2000Wasm,
  decodeJpeg2000WithFallback,
  disposeJpeg2000Wasm,
} from './jpeg2000WasmBridge.js';
export type {
  Jpeg2000WasmExports,
  Jpeg2000DecodeResult,
} from './jpeg2000WasmBridge.js';

// ---------------------------------------------------------------------------
// JPEG2000 codestream / JP2 container parsing
// ---------------------------------------------------------------------------

export {
  isJpeg2000Codestream,
  isJp2Container,
  isJpeg2000,
  extractCodestream,
  parseJp2Boxes,
  findBox,
  findAllBoxes,
  parseImageHeader,
  JP2_BOX_TYPES,
} from './jpeg2000Codestream.js';
export type { Jp2Box } from './jpeg2000Codestream.js';

// ---------------------------------------------------------------------------
// JPEG2000 alpha channel handling
// ---------------------------------------------------------------------------

export {
  hasAlphaChannel,
  getAlphaChannelIndex,
  separateAlpha,
  premultiplyAlpha,
  extractAlphaChannel,
  parseChannelDefinitions,
} from './jpeg2000Alpha.js';
export type {
  ChannelDefinition,
  SeparatedImage,
} from './jpeg2000Alpha.js';

// ---------------------------------------------------------------------------
// JPEG2000 to JPEG transcoding
// ---------------------------------------------------------------------------

export {
  transcodeJp2ToJpeg,
  estimateTranscodedSize,
} from './jpeg2000Transcode.js';
export type { TranscodeOptions } from './jpeg2000Transcode.js';

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

export { PdfParseError, formatHexContext } from './parseError.js';

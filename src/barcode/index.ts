/**
 * @module barcode
 *
 * Barcode encoding and PDF rendering for Code 128, Code 39, ITF,
 * EAN-13, EAN-8, UPC-A, QR Code, Data Matrix, and PDF417.
 *
 * @packageDocumentation
 */

// Shared types
export type { BarcodeMatrix, BarcodeOptions } from './types.js';

// Code 128
export {
  encodeCode128,
  encodeCode128Values,
  valuesToModules,
  code128ToOperators,
} from './code128.js';
export type { Code128Options } from './code128.js';

// Code 39
export {
  encodeCode39,
  computeCode39CheckDigit,
  code39ToOperators,
} from './code39.js';
export type { Code39Options } from './code39.js';

// ITF (Interleaved 2 of 5)
export {
  encodeItf,
  itfToOperators,
} from './itf.js';
export type { ItfOptions } from './itf.js';

// EAN-13 / EAN-8
export {
  encodeEan13,
  encodeEan8,
  calculateEanCheckDigit,
  ean13ToOperators,
  ean8ToOperators,
} from './ean.js';
export type { EanOptions } from './ean.js';

// UPC-A
export {
  encodeUpcA,
  calculateUpcCheckDigit,
  upcAToOperators,
} from './upc.js';
export type { UpcOptions } from './upc.js';

// QR Code (ISO 18004)
export {
  encodeQrCode,
  qrCodeToOperators,
} from './qr.js';
export type {
  QrCodeOptions,
  QrCodeMatrix,
  ErrorCorrectionLevel,
} from './qr.js';

// Data Matrix (ISO/IEC 16022 ECC200)
export {
  encodeDataMatrix,
  dataMatrixToOperators,
} from './dataMatrix.js';
export type {
  DataMatrixOptions,
  DataMatrixResult,
} from './dataMatrix.js';

// PDF417 (ISO/IEC 15438)
export {
  encodePdf417,
  pdf417ToOperators,
} from './pdf417.js';
export type {
  Pdf417Options,
  Pdf417Matrix,
} from './pdf417.js';

// Barcode styling
export {
  renderStyledBarcode,
  calculateBarcodeDimensions,
} from './style.js';
export type { StyledBarcodeOptions } from './style.js';

// Barcode reader (round-trip verification)
export {
  readCode128,
  readEan13,
  readEan8,
  readCode39,
  readBarcode,
} from './reader.js';
export type { BarcodeReadResult } from './reader.js';

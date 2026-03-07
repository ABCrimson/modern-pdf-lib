/**
 * @module barcode
 *
 * Barcode encoding and PDF rendering for Code 128, Code 39, ITF,
 * EAN-13, EAN-8, UPC-A, and QR Code.
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

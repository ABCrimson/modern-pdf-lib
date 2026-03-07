/**
 * @module barcode
 *
 * Barcode encoding and PDF rendering for Code 128, EAN-13, EAN-8,
 * and UPC-A.
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

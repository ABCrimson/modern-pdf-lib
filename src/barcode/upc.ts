/**
 * @module barcode/upc
 *
 * UPC-A barcode encoding and PDF operator generation.
 *
 * UPC-A is a subset of EAN-13 where the first (number-system) digit is
 * always `0`.  The encoding is therefore identical to EAN-13 with a
 * leading zero.
 *
 * Reference: GS1 General Specifications, Section 5.2.
 */

import { encodeEan13, calculateEanCheckDigit, matrixToOperators } from './ean.js';
import type { BarcodeMatrix, BarcodeOptions } from './types.js';

// Re-export the options type under a UPC-specific alias.
export type { BarcodeOptions as UpcOptions } from './types.js';

// ---------------------------------------------------------------------------
// Check-digit calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the UPC-A check digit (Modulo-10 algorithm).
 *
 * @param data  11-digit numeric string (without check digit).
 * @returns     The single check digit (0-9).
 */
export function calculateUpcCheckDigit(data: string): number {
  if (!/^\d+$/.test(data)) {
    throw new Error(`UPC-A data must contain only digits: "${data}"`);
  }
  if (data.length !== 11) {
    throw new Error(
      `UPC-A check digit calculation requires 11 digits, got ${data.length}`,
    );
  }
  // UPC-A is EAN-13 with a leading 0, so the check digit is the same
  // as for the 12-digit EAN-13 prefix "0" + data.
  return calculateEanCheckDigit('0' + data);
}

// ---------------------------------------------------------------------------
// UPC-A encoding
// ---------------------------------------------------------------------------

/**
 * Encode a UPC-A barcode.
 *
 * UPC-A is encoded as an EAN-13 barcode with a leading `0`.  The
 * resulting {@link BarcodeMatrix} has 95 modules (identical to EAN-13).
 *
 * @param data  11- or 12-digit numeric string.  If 11 digits are given
 *              the check digit is calculated and appended.  If 12 digits
 *              are given the last digit is validated.
 * @returns     A {@link BarcodeMatrix} with 95 modules.
 * @throws      If the input is not 11 or 12 numeric digits, or if a
 *              provided check digit does not match.
 */
export function encodeUpcA(data: string): BarcodeMatrix {
  if (!/^\d+$/.test(data)) {
    throw new Error(`UPC-A data must contain only digits: "${data}"`);
  }

  if (data.length === 11) {
    // Prepend '0' to get 12-digit EAN-13 prefix, let encodeEan13 compute check
    return encodeEan13('0' + data);
  } else if (data.length === 12) {
    // Prepend '0' to get 13-digit EAN-13, let encodeEan13 validate check
    return encodeEan13('0' + data);
  } else {
    throw new Error(
      `UPC-A data must be 11 or 12 digits, got ${data.length}`,
    );
  }
}

// ---------------------------------------------------------------------------
// PDF operator generation
// ---------------------------------------------------------------------------

/**
 * Generate PDF content-stream operators for a UPC-A barcode.
 *
 * @param matrix   Encoded barcode from {@link encodeUpcA}.
 * @param x        Lower-left x coordinate (including quiet zone).
 * @param y        Lower-left y coordinate.
 * @param options  Rendering options.
 * @returns        A string of PDF operators.
 */
export function upcAToOperators(
  matrix: BarcodeMatrix,
  x: number,
  y: number,
  options?: BarcodeOptions,
): string {
  return matrixToOperators(matrix, x, y, options);
}

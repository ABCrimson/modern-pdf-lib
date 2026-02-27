/**
 * @module utils/validation
 *
 * Input validation helpers and a structured error type for modern-pdf.
 *
 * Every public API entry point should validate its arguments with
 * these functions so that callers receive clear, actionable error
 * messages instead of cryptic failures deep in the serializer.
 *
 * ```ts
 * import { validateUint8Array, ModernPdfError, PdfErrorCode } from '../utils/validation.js';
 *
 * function loadFont(data: unknown) {
 *   validateUint8Array(data, 'data');
 *   // `data` is now narrowed to Uint8Array
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Exhaustive enumeration of error codes emitted by modern-pdf.
 *
 * Each member maps to a specific failure category, making it possible
 * to programmatically match and handle errors.
 */
export const PdfErrorCode = {
  /** A function received an argument of the wrong type or value. */
  INVALID_INPUT: 'INVALID_INPUT',
  /** WASM module has not been initialized but a WASM path was taken. */
  WASM_NOT_INITIALIZED: 'WASM_NOT_INITIALIZED',
  /** Font binary could not be parsed or is unsupported. */
  FONT_PARSE_ERROR: 'FONT_PARSE_ERROR',
  /** Image binary could not be decoded. */
  IMAGE_DECODE_ERROR: 'IMAGE_DECODE_ERROR',
  /** Stream compression or decompression failed. */
  COMPRESSION_ERROR: 'COMPRESSION_ERROR',
  /** PDF object serialization encountered an internal error. */
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
} as const;

/** Union of all error code string values. */
export type PdfErrorCode = (typeof PdfErrorCode)[keyof typeof PdfErrorCode];

// ---------------------------------------------------------------------------
// ModernPdfError
// ---------------------------------------------------------------------------

/**
 * Structured error class thrown by modern-pdf.
 *
 * Extends the built-in `Error` with a machine-readable {@link code}
 * field and optional {@link details}.
 *
 * ```ts
 * try {
 *   doc.save();
 * } catch (err) {
 *   if (err instanceof ModernPdfError) {
 *     switch (err.code) {
 *       case PdfErrorCode.COMPRESSION_ERROR:
 *         // handle compression failure
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export class ModernPdfError extends Error {
  /** Machine-readable error code. */
  readonly code: PdfErrorCode;
  /** Optional additional context (e.g. the offending value). */
  readonly details?: unknown;

  /**
   * @param code     The error code.
   * @param message  Human-readable description.
   * @param details  Optional additional context.
   */
  constructor(code: PdfErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ModernPdfError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace in V8 environments
    const ErrorWithCapture = Error as { captureStackTrace?: (target: object, ctor: Function) => void };
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, ModernPdfError);
    }
  }
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `value` is a `Uint8Array`.
 *
 * @param value  The value to check.
 * @param name   Parameter name for the error message.
 * @throws {ModernPdfError}  If the assertion fails.
 */
export function validateUint8Array(
  value: unknown,
  name: string,
): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Expected \`${name}\` to be a Uint8Array, but received ${typeLabel(value)}.`,
      { received: value },
    );
  }
}

/**
 * Assert that `value` is a finite positive number (> 0).
 *
 * @param value  The value to check.
 * @param name   Parameter name for the error message.
 * @throws {ModernPdfError}  If the assertion fails.
 */
export function validatePositiveNumber(
  value: unknown,
  name: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Expected \`${name}\` to be a positive number, but received ${String(value)}.`,
      { received: value },
    );
  }
}

/**
 * Assert that `value` falls within `[min, max]` (inclusive).
 *
 * @param value  The numeric value.
 * @param min    Lower bound (inclusive).
 * @param max    Upper bound (inclusive).
 * @param name   Parameter name for the error message.
 * @throws {ModernPdfError}  If the value is out of range.
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Expected \`${name}\` to be in [${min}, ${max}], but received ${value}.`,
      { received: value, min, max },
    );
  }
}

/**
 * Assert that `color` is a valid colour value (RGB, CMYK, or
 * Grayscale).
 *
 * Valid shapes:
 * - `{ type: 'rgb', r, g, b }` with components in `[0, 1]`.
 * - `{ type: 'cmyk', c, m, y, k }` with components in `[0, 1]`.
 * - `{ type: 'grayscale', gray }` with `gray` in `[0, 1]`.
 *
 * @param color  The value to validate.
 * @throws {ModernPdfError}  If the colour is malformed.
 */
export function validateColor(color: unknown): void {
  if (color === null || typeof color !== 'object') {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Expected a colour object ({ type, ... }), but received ${typeLabel(color)}.`,
      { received: color },
    );
  }

  const obj = color as Record<string, unknown>;
  const type = obj['type'];

  switch (type) {
    case 'rgb': {
      validateComponent(obj['r'], 'r');
      validateComponent(obj['g'], 'g');
      validateComponent(obj['b'], 'b');
      break;
    }
    case 'cmyk': {
      validateComponent(obj['c'], 'c');
      validateComponent(obj['m'], 'm');
      validateComponent(obj['y'], 'y');
      validateComponent(obj['k'], 'k');
      break;
    }
    case 'grayscale': {
      validateComponent(obj['gray'], 'gray');
      break;
    }
    default:
      throw new ModernPdfError(
        PdfErrorCode.INVALID_INPUT,
        `Unknown colour type: ${String(type)}. Expected 'rgb', 'cmyk', or 'grayscale'.`,
        { received: color },
      );
  }
}

/**
 * Validate that a single colour component is a number in `[0, 1]`.
 */
function validateComponent(value: unknown, name: string): void {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Colour component \`${name}\` must be a number in [0, 1], but received ${String(value)}.`,
      { received: value },
    );
  }
}

/**
 * Assert that `size` is a valid page-size specification.
 *
 * Accepted forms:
 * - An object `{ width: number, height: number }` with positive
 *   dimensions.
 * - A predefined name string (e.g. `'A4'`, `'Letter'`).
 *
 * @param size  The value to validate.
 * @throws {ModernPdfError}  If the page size is invalid.
 */
export function validatePageSize(size: unknown): void {
  if (typeof size === 'string') {
    if (!KNOWN_PAGE_SIZES.has(size)) {
      throw new ModernPdfError(
        PdfErrorCode.INVALID_INPUT,
        `Unknown predefined page size: "${size}". Valid names: ${KNOWN_PAGE_SIZES.values().toArray().join(', ')}.`,
        { received: size },
      );
    }
    return;
  }

  if (size === null || typeof size !== 'object') {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Expected a page size object { width, height } or a predefined name string, but received ${typeLabel(size)}.`,
      { received: size },
    );
  }

  const obj = size as Record<string, unknown>;
  const w = obj['width'];
  const h = obj['height'];

  if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Page size \`width\` must be a positive number, but received ${String(w)}.`,
      { received: w },
    );
  }
  if (typeof h !== 'number' || !Number.isFinite(h) || h <= 0) {
    throw new ModernPdfError(
      PdfErrorCode.INVALID_INPUT,
      `Page size \`height\` must be a positive number, but received ${String(h)}.`,
      { received: h },
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Known predefined page-size names. */
const KNOWN_PAGE_SIZES = new Set([
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'B4', 'B5',
  'Letter', 'Legal', 'Tabloid', 'Ledger', 'Executive',
]);

/**
 * Produce a human-readable type label for an unknown value.
 */
function typeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'Array';
  return typeof value;
}

/**
 * @module parser/parseError
 * Structured error class for PDF parsing failures.  The class and its hex
 * dump live in src/errors.ts with the other error classes; this module
 * re-exports them for the parser and for existing imports.
 * @packageDocumentation
 */

export { PdfParseError, formatHexContext } from '../errors.js';

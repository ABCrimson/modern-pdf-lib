/**
 * Tests for validation utilities and ModernPdfError.
 *
 * Covers:
 * - ModernPdfError: construction, fields, code, message, details, instanceof
 * - PdfErrorCode: all error code values exist
 * - validateUint8Array: passes for Uint8Array, throws for others
 * - validatePositiveNumber: passes for positive numbers, throws otherwise
 * - validateRange: passes for in-range values, throws for out-of-range
 * - validateColor: accepts valid rgb/cmyk/grayscale, rejects invalid
 * - validatePageSize: accepts valid object sizes and predefined names, rejects invalid
 */

import { describe, it, expect } from 'vitest';
import {
  ModernPdfError,
  PdfErrorCode,
  validateUint8Array,
  validatePositiveNumber,
  validateRange,
  validateColor,
  validatePageSize,
} from '../../../src/utils/validation.js';

// ---------------------------------------------------------------------------
// ModernPdfError
// ---------------------------------------------------------------------------

describe('ModernPdfError', () => {
  it('is an instance of Error', () => {
    const err = new ModernPdfError(PdfErrorCode.INVALID_INPUT, 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ModernPdfError);
  });

  it('has name "ModernPdfError"', () => {
    const err = new ModernPdfError(PdfErrorCode.INVALID_INPUT, 'test');
    expect(err.name).toBe('ModernPdfError');
  });

  it('stores code and message', () => {
    const err = new ModernPdfError(PdfErrorCode.FONT_PARSE_ERROR, 'bad font');
    expect(err.code).toBe('FONT_PARSE_ERROR');
    expect(err.message).toBe('bad font');
  });

  it('stores optional details', () => {
    const details = { file: 'test.ttf', offset: 42 };
    const err = new ModernPdfError(PdfErrorCode.FONT_PARSE_ERROR, 'bad font', details);
    expect(err.details).toBe(details);
  });

  it('details is undefined when not provided', () => {
    const err = new ModernPdfError(PdfErrorCode.INVALID_INPUT, 'test');
    expect(err.details).toBeUndefined();
  });

  it('has a stack trace', () => {
    const err = new ModernPdfError(PdfErrorCode.INVALID_INPUT, 'test');
    expect(typeof err.stack).toBe('string');
    expect(err.stack!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PdfErrorCode
// ---------------------------------------------------------------------------

describe('PdfErrorCode', () => {
  it('has INVALID_INPUT', () => {
    expect(PdfErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
  });

  it('has WASM_NOT_INITIALIZED', () => {
    expect(PdfErrorCode.WASM_NOT_INITIALIZED).toBe('WASM_NOT_INITIALIZED');
  });

  it('has FONT_PARSE_ERROR', () => {
    expect(PdfErrorCode.FONT_PARSE_ERROR).toBe('FONT_PARSE_ERROR');
  });

  it('has IMAGE_DECODE_ERROR', () => {
    expect(PdfErrorCode.IMAGE_DECODE_ERROR).toBe('IMAGE_DECODE_ERROR');
  });

  it('has COMPRESSION_ERROR', () => {
    expect(PdfErrorCode.COMPRESSION_ERROR).toBe('COMPRESSION_ERROR');
  });

  it('has SERIALIZATION_ERROR', () => {
    expect(PdfErrorCode.SERIALIZATION_ERROR).toBe('SERIALIZATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// validateUint8Array
// ---------------------------------------------------------------------------

describe('validateUint8Array', () => {
  it('passes for a Uint8Array', () => {
    expect(() => validateUint8Array(new Uint8Array(10), 'data')).not.toThrow();
  });

  it('passes for an empty Uint8Array', () => {
    expect(() => validateUint8Array(new Uint8Array(0), 'data')).not.toThrow();
  });

  it('throws ModernPdfError for a regular array', () => {
    expect(() => validateUint8Array([1, 2, 3], 'data')).toThrow(ModernPdfError);
  });

  it('throws for null', () => {
    expect(() => validateUint8Array(null, 'data')).toThrow(ModernPdfError);
  });

  it('throws for undefined', () => {
    expect(() => validateUint8Array(undefined, 'data')).toThrow(ModernPdfError);
  });

  it('throws for a string', () => {
    expect(() => validateUint8Array('hello', 'data')).toThrow(ModernPdfError);
  });

  it('throws for a number', () => {
    expect(() => validateUint8Array(42, 'data')).toThrow(ModernPdfError);
  });

  it('error message contains the parameter name', () => {
    try {
      validateUint8Array('nope', 'myParam');
    } catch (err) {
      expect((err as ModernPdfError).message).toContain('myParam');
    }
  });

  it('error has INVALID_INPUT code', () => {
    try {
      validateUint8Array(123, 'x');
    } catch (err) {
      expect((err as ModernPdfError).code).toBe('INVALID_INPUT');
    }
  });
});

// ---------------------------------------------------------------------------
// validatePositiveNumber
// ---------------------------------------------------------------------------

describe('validatePositiveNumber', () => {
  it('passes for a positive integer', () => {
    expect(() => validatePositiveNumber(10, 'size')).not.toThrow();
  });

  it('passes for a positive float', () => {
    expect(() => validatePositiveNumber(0.5, 'size')).not.toThrow();
  });

  it('throws for zero', () => {
    expect(() => validatePositiveNumber(0, 'size')).toThrow(ModernPdfError);
  });

  it('throws for negative number', () => {
    expect(() => validatePositiveNumber(-5, 'size')).toThrow(ModernPdfError);
  });

  it('throws for NaN', () => {
    expect(() => validatePositiveNumber(NaN, 'size')).toThrow(ModernPdfError);
  });

  it('throws for Infinity', () => {
    expect(() => validatePositiveNumber(Infinity, 'size')).toThrow(ModernPdfError);
  });

  it('throws for string', () => {
    expect(() => validatePositiveNumber('10' as any, 'size')).toThrow(ModernPdfError);
  });

  it('throws for null', () => {
    expect(() => validatePositiveNumber(null, 'size')).toThrow(ModernPdfError);
  });
});

// ---------------------------------------------------------------------------
// validateRange
// ---------------------------------------------------------------------------

describe('validateRange', () => {
  it('passes for value at lower bound', () => {
    expect(() => validateRange(0, 0, 100, 'val')).not.toThrow();
  });

  it('passes for value at upper bound', () => {
    expect(() => validateRange(100, 0, 100, 'val')).not.toThrow();
  });

  it('passes for value in the middle', () => {
    expect(() => validateRange(50, 0, 100, 'val')).not.toThrow();
  });

  it('throws for value below lower bound', () => {
    expect(() => validateRange(-1, 0, 100, 'val')).toThrow(ModernPdfError);
  });

  it('throws for value above upper bound', () => {
    expect(() => validateRange(101, 0, 100, 'val')).toThrow(ModernPdfError);
  });

  it('throws for NaN', () => {
    expect(() => validateRange(NaN, 0, 100, 'val')).toThrow(ModernPdfError);
  });

  it('throws for Infinity', () => {
    expect(() => validateRange(Infinity, 0, 100, 'val')).toThrow(ModernPdfError);
  });

  it('error message contains parameter name and bounds', () => {
    try {
      validateRange(200, 0, 100, 'myVal');
    } catch (err) {
      const msg = (err as ModernPdfError).message;
      expect(msg).toContain('myVal');
      expect(msg).toContain('0');
      expect(msg).toContain('100');
    }
  });
});

// ---------------------------------------------------------------------------
// validateColor
// ---------------------------------------------------------------------------

describe('validateColor', () => {
  it('accepts valid RGB color', () => {
    expect(() => validateColor({ type: 'rgb', r: 0.5, g: 0.3, b: 1.0 })).not.toThrow();
  });

  it('accepts RGB with all zeros', () => {
    expect(() => validateColor({ type: 'rgb', r: 0, g: 0, b: 0 })).not.toThrow();
  });

  it('accepts valid CMYK color', () => {
    expect(() => validateColor({ type: 'cmyk', c: 0.1, m: 0.2, y: 0.3, k: 0.4 })).not.toThrow();
  });

  it('accepts valid grayscale color', () => {
    expect(() => validateColor({ type: 'grayscale', gray: 0.5 })).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => validateColor(null)).toThrow(ModernPdfError);
  });

  it('throws for string', () => {
    expect(() => validateColor('red')).toThrow(ModernPdfError);
  });

  it('throws for unknown color type', () => {
    expect(() => validateColor({ type: 'hsl', h: 0.5, s: 0.5, l: 0.5 })).toThrow(ModernPdfError);
  });

  it('throws for RGB with r > 1', () => {
    expect(() => validateColor({ type: 'rgb', r: 1.5, g: 0, b: 0 })).toThrow(ModernPdfError);
  });

  it('throws for RGB with negative component', () => {
    expect(() => validateColor({ type: 'rgb', r: -0.1, g: 0, b: 0 })).toThrow(ModernPdfError);
  });

  it('throws for CMYK with missing component', () => {
    expect(() => validateColor({ type: 'cmyk', c: 0.1, m: 0.2, y: 0.3 })).toThrow(ModernPdfError);
  });

  it('throws for grayscale with gray > 1', () => {
    expect(() => validateColor({ type: 'grayscale', gray: 2 })).toThrow(ModernPdfError);
  });

  it('throws for grayscale with non-number gray', () => {
    expect(() => validateColor({ type: 'grayscale', gray: '0.5' })).toThrow(ModernPdfError);
  });
});

// ---------------------------------------------------------------------------
// validatePageSize
// ---------------------------------------------------------------------------

describe('validatePageSize', () => {
  it('accepts predefined name "A4"', () => {
    expect(() => validatePageSize('A4')).not.toThrow();
  });

  it('accepts predefined name "Letter"', () => {
    expect(() => validatePageSize('Letter')).not.toThrow();
  });

  it('accepts predefined name "Legal"', () => {
    expect(() => validatePageSize('Legal')).not.toThrow();
  });

  it('accepts predefined name "A0"', () => {
    expect(() => validatePageSize('A0')).not.toThrow();
  });

  it('throws for unknown predefined name', () => {
    expect(() => validatePageSize('FooBar')).toThrow(ModernPdfError);
  });

  it('accepts valid object size', () => {
    expect(() => validatePageSize({ width: 612, height: 792 })).not.toThrow();
  });

  it('throws for zero width', () => {
    expect(() => validatePageSize({ width: 0, height: 792 })).toThrow(ModernPdfError);
  });

  it('throws for negative height', () => {
    expect(() => validatePageSize({ width: 612, height: -100 })).toThrow(ModernPdfError);
  });

  it('throws for null', () => {
    expect(() => validatePageSize(null)).toThrow(ModernPdfError);
  });

  it('throws for number', () => {
    expect(() => validatePageSize(42)).toThrow(ModernPdfError);
  });

  it('throws for object with non-numeric width', () => {
    expect(() => validatePageSize({ width: '612', height: 792 })).toThrow(ModernPdfError);
  });
});

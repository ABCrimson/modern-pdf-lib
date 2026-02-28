/**
 * Tests for PdfParseError and formatHexContext.
 *
 * Verifies the structured error class used throughout the parser subsystem
 * for rich, debuggable error messages with hex context dumps.
 */

import { describe, it, expect } from 'vitest';
import { PdfParseError, formatHexContext } from '../../../src/parser/parseError.js';

// ---------------------------------------------------------------------------
// PdfParseError construction
// ---------------------------------------------------------------------------

describe('PdfParseError', () => {
  it('constructs with all fields', () => {
    const data = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const error = new PdfParseError({
      message: 'Test error',
      offset: 2,
      expected: 'something',
      actual: 'something else',
      data,
    });

    expect(error.offset).toBe(2);
    expect(error.expected).toBe('something');
    expect(error.actual).toBe('something else');
    expect(error.hexContext).not.toBe('');
    expect(error.message).toContain('Test error');
    expect(error.message).toContain('Expected: something');
    expect(error.message).toContain('Got: something else');
    expect(error.message).toContain('Context:');
  });

  it('has name === "PdfParseError"', () => {
    const error = new PdfParseError({
      message: 'name test',
      offset: 0,
    });
    expect(error.name).toBe('PdfParseError');
  });

  it('is instanceof Error', () => {
    const error = new PdfParseError({
      message: 'instanceof test',
      offset: 0,
    });
    expect(error).toBeInstanceOf(Error);
  });

  it('is instanceof PdfParseError', () => {
    const error = new PdfParseError({
      message: 'instanceof test',
      offset: 0,
    });
    expect(error).toBeInstanceOf(PdfParseError);
  });

  it('includes expected and actual in error message', () => {
    const error = new PdfParseError({
      message: 'base message',
      offset: 10,
      expected: 'a number',
      actual: 'a string',
    });
    expect(error.message).toContain('Expected: a number');
    expect(error.message).toContain('Got: a string');
  });

  it('constructs without data (no hex context in message)', () => {
    const error = new PdfParseError({
      message: 'no data error',
      offset: 5,
      expected: 'foo',
      actual: 'bar',
    });
    expect(error.hexContext).toBe('');
    expect(error.message).not.toContain('Context:');
    expect(error.message).toContain('no data error');
    expect(error.message).toContain('Expected: foo');
  });

  it('constructs without expected or actual', () => {
    const error = new PdfParseError({
      message: 'minimal error',
      offset: 0,
    });
    expect(error.expected).toBe('');
    expect(error.actual).toBe('');
    expect(error.message).toBe('minimal error');
  });

  it('preserves cause when provided', () => {
    const cause = new Error('root cause');
    const error = new PdfParseError({
      message: 'wrapper',
      offset: 0,
      cause,
    });
    expect(error.cause).toBe(cause);
  });

  it('has no cause when not provided', () => {
    const error = new PdfParseError({
      message: 'no cause',
      offset: 0,
    });
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatHexContext
// ---------------------------------------------------------------------------

describe('formatHexContext', () => {
  it('formats data in the middle of a buffer', () => {
    // Create a buffer with some recognizable content
    const data = new Uint8Array(64);
    for (let i = 0; i < 64; i++) data[i] = i + 0x30; // '0', '1', '2', ...

    const result = formatHexContext(data, 32, 8);

    expect(result).toContain('Offset 24:');
    expect(result).toContain('Hex:');
    expect(result).toContain('ASCII:');
    expect(result).toContain('Error at offset 32 (marked with [])');
    // The error byte should be marked with brackets
    expect(result).toMatch(/\[/);
    expect(result).toMatch(/\]/);
  });

  it('handles offset 0 (start of buffer)', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const result = formatHexContext(data, 0, 16);

    expect(result).toContain('Offset 0:');
    expect(result).toContain('Error at offset 0 (marked with [])');
    // The first byte should be marked
    expect(result).toContain('[48]');
    // ASCII should show 'H'
    expect(result).toContain('H');
  });

  it('handles offset at end of buffer', () => {
    const data = new Uint8Array([0x41, 0x42, 0x43]); // "ABC"
    const result = formatHexContext(data, 2, 16);

    expect(result).toContain('Offset 0:');
    expect(result).toContain('Error at offset 2 (marked with [])');
    // The last byte should be marked
    expect(result).toContain('[43]');
  });

  it('uses custom window size', () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;

    const smallWindow = formatHexContext(data, 50, 4);
    const largeWindow = formatHexContext(data, 50, 20);

    // Larger window should produce more hex digits
    expect(largeWindow.length).toBeGreaterThan(smallWindow.length);
  });

  it('handles single-byte buffer', () => {
    const data = new Uint8Array([0xff]);
    const result = formatHexContext(data, 0, 16);

    expect(result).toContain('[ff]');
    expect(result).toContain('.');  // 0xff is not printable ASCII
  });

  it('displays printable ASCII and dots for non-printable', () => {
    const data = new Uint8Array([0x41, 0x00, 0x42, 0x7f, 0x43]); // A, NUL, B, DEL, C
    const result = formatHexContext(data, 2, 16);

    expect(result).toContain('ASCII:');
    // 'A' is printable, NUL is not, 'B' is printable, DEL is not, 'C' is printable
    expect(result).toMatch(/A/);
    expect(result).toMatch(/B/);
    expect(result).toMatch(/C/);
  });
});

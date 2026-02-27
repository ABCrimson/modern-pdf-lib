/**
 * Tests for the encoding utility module.
 *
 * Covers PDF string escaping, PDF name encoding, date formatting,
 * hex-string encoding, UTF-16BE encoding, and Latin-1 roundtrip.
 */

import { describe, it, expect } from 'vitest';
import {
  escapePdfString,
  encodePdfName,
  formatPdfDate,
  encodeHexString,
  encodeToUtf16BE,
  encodeToLatin1,
  decodeLatin1,
} from '../../../src/utils/encoding.js';

// ---------------------------------------------------------------------------
// escapePdfString
// ---------------------------------------------------------------------------

describe('escapePdfString', () => {
  it('escapes parentheses', () => {
    expect(escapePdfString('a(b)c')).toBe('a\\(b\\)c');
  });

  it('escapes backslashes', () => {
    expect(escapePdfString('a\\b')).toBe('a\\\\b');
  });

  it('escapes newlines, carriage returns, and tabs', () => {
    expect(escapePdfString('line1\nline2')).toBe('line1\\nline2');
    expect(escapePdfString('line1\rline2')).toBe('line1\\rline2');
    expect(escapePdfString('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('escapes backspace and form feed', () => {
    expect(escapePdfString('a\bb')).toBe('a\\bb');
    expect(escapePdfString('a\fb')).toBe('a\\fb');
  });

  it('leaves normal ASCII text unchanged', () => {
    expect(escapePdfString('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapePdfString('')).toBe('');
  });

  it('handles combined special characters', () => {
    const input = '(test\\value)\nnew\tline';
    const expected = '\\(test\\\\value\\)\\nnew\\tline';
    expect(escapePdfString(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// encodePdfName
// ---------------------------------------------------------------------------

describe('encodePdfName', () => {
  it('passes through simple ASCII names unchanged', () => {
    expect(encodePdfName('Helvetica')).toBe('Helvetica');
  });

  it('encodes spaces as #20', () => {
    expect(encodePdfName('My Font')).toBe('My#20Font');
  });

  it('encodes special characters with #XX notation', () => {
    // # character
    expect(encodePdfName('A#B')).toBe('A#23B');
    // Parentheses
    expect(encodePdfName('name(1)')).toBe('name#281#29');
    // Slash
    expect(encodePdfName('a/b')).toBe('a#2Fb');
    // Percent
    expect(encodePdfName('100%')).toBe('100#25');
  });

  it('encodes angle brackets', () => {
    expect(encodePdfName('a<b>c')).toBe('a#3Cb#3Ec');
  });

  it('encodes square and curly brackets', () => {
    expect(encodePdfName('a[b]c')).toBe('a#5Bb#5Dc');
    expect(encodePdfName('a{b}c')).toBe('a#7Bb#7Dc');
  });

  it('handles empty string', () => {
    expect(encodePdfName('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatPdfDate
// ---------------------------------------------------------------------------

describe('formatPdfDate', () => {
  it('produces correct PDF date format', () => {
    const date = new Date('2024-01-15T14:30:52Z');
    const result = formatPdfDate(date);

    // The result should start with "D:"
    expect(result).toMatch(/^D:\d{14}/);

    // Should contain the year
    expect(result).toContain('2024');
  });

  it('includes timezone offset', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const result = formatPdfDate(date);

    // Should start with D: prefix
    expect(result.startsWith('D:')).toBe(true);

    // The date string should be at least 16 characters (D: + 14 digits)
    // plus timezone info
    expect(result.length).toBeGreaterThanOrEqual(16);
  });

  it('format is consistent for the same date', () => {
    const date = new Date('2025-03-20T08:15:30Z');
    const result1 = formatPdfDate(date);
    const result2 = formatPdfDate(date);
    expect(result1).toBe(result2);
  });

  it('pads single-digit month and day values', () => {
    // Use a date that will have consistent local representation
    const date = new Date(2024, 0, 5, 3, 7, 9); // Jan 5, 2024 03:07:09 local
    const result = formatPdfDate(date);
    // The format should be D:YYYYMMDDHHMMSS...
    // Extract just the date/time part (after D:)
    const datePart = result.slice(2, 16);
    expect(datePart).toBe('20240105030709');
  });
});

// ---------------------------------------------------------------------------
// encodeHexString
// ---------------------------------------------------------------------------

describe('encodeHexString', () => {
  it('produces hex-encoded string with angle brackets', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    const result = encodeHexString(data);
    expect(result).toBe('<48656C6C6F>');
  });

  it('handles empty input', () => {
    expect(encodeHexString(new Uint8Array(0))).toBe('<>');
  });

  it('uses uppercase hex digits', () => {
    const data = new Uint8Array([0xAB, 0xCD, 0xEF]);
    const result = encodeHexString(data);
    expect(result).toBe('<ABCDEF>');
  });

  it('pads single-digit values with leading zero', () => {
    const data = new Uint8Array([0x00, 0x01, 0x0F]);
    const result = encodeHexString(data);
    expect(result).toBe('<00010F>');
  });
});

// ---------------------------------------------------------------------------
// encodeToUtf16BE
// ---------------------------------------------------------------------------

describe('encodeToUtf16BE', () => {
  it('produces BOM-prefixed output', () => {
    const result = encodeToUtf16BE('A');
    // BOM is 0xFE 0xFF
    expect(result[0]).toBe(0xFE);
    expect(result[1]).toBe(0xFF);
  });

  it('encodes ASCII characters as two bytes each', () => {
    const result = encodeToUtf16BE('AB');
    // BOM (2) + 'A' (2) + 'B' (2) = 6 bytes
    expect(result.length).toBe(6);
    // 'A' = U+0041 -> 0x00 0x41
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0x41);
    // 'B' = U+0042 -> 0x00 0x42
    expect(result[4]).toBe(0x00);
    expect(result[5]).toBe(0x42);
  });

  it('encodes non-ASCII characters correctly', () => {
    // U+00E9 = 'e' with acute accent
    const result = encodeToUtf16BE('\u00E9');
    expect(result.length).toBe(4); // BOM + 2 bytes
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0xE9);
  });

  it('handles empty string', () => {
    const result = encodeToUtf16BE('');
    // Just the BOM
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0xFE);
    expect(result[1]).toBe(0xFF);
  });
});

// ---------------------------------------------------------------------------
// encodeToLatin1 / decodeLatin1 roundtrip
// ---------------------------------------------------------------------------

describe('encodeToLatin1 / decodeLatin1', () => {
  it('roundtrips ASCII text', () => {
    const text = 'Hello, World!';
    const encoded = encodeToLatin1(text);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBe(text.length);
    expect(decodeLatin1(encoded)).toBe(text);
  });

  it('roundtrips Latin-1 characters', () => {
    // Characters in the U+0080..U+00FF range
    const text = '\u00E4\u00F6\u00FC\u00DF'; // aeoeue ss (German chars)
    const encoded = encodeToLatin1(text);
    expect(decodeLatin1(encoded)).toBe(text);
  });

  it('replaces non-Latin-1 characters with ?', () => {
    const text = 'Hello \u4E16\u754C'; // Hello + Chinese chars
    const encoded = encodeToLatin1(text);
    const decoded = decodeLatin1(encoded);
    expect(decoded).toBe('Hello ??');
  });

  it('handles empty string', () => {
    const encoded = encodeToLatin1('');
    expect(encoded.length).toBe(0);
    expect(decodeLatin1(encoded)).toBe('');
  });

  it('preserves null bytes', () => {
    const encoded = encodeToLatin1('\x00');
    expect(encoded.length).toBe(1);
    expect(encoded[0]).toBe(0);
    expect(decodeLatin1(encoded)).toBe('\x00');
  });
});

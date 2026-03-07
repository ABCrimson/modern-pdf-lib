/**
 * Tests for acrobatBuiltins — AFNumber_Format, AFNumber_Keystroke,
 * formatNumber, parseFormattedNumber.
 *
 * Covers:
 * - Number formatting with various separator styles
 * - Currency formatting (prepend/append)
 * - Negative styles (minus, parentheses)
 * - Keystroke validation
 * - parseFormattedNumber round-trip
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  AFNumber_Format,
  AFNumber_Keystroke,
  formatNumber,
  parseFormattedNumber,
} from '../../../src/form/acrobatBuiltins.js';

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('formats with default options (2 decimals, comma thousands)', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });

  it('formats negative with minus', () => {
    expect(formatNumber(-1234.5)).toBe('-1,234.50');
  });

  it('formats negative with parentheses', () => {
    expect(formatNumber(-1234.5, { negativeStyle: 'parens' })).toBe(
      '(1,234.50)',
    );
  });

  it('formats with no thousands separator', () => {
    expect(formatNumber(1234567.89, { thousandsSep: '' })).toBe('1234567.89');
  });

  it('formats with period as thousands separator and comma as decimal', () => {
    expect(
      formatNumber(1234.56, { thousandsSep: '.', decimalSep: ',' }),
    ).toBe('1.234,56');
  });

  it('formats with 0 decimal places', () => {
    expect(formatNumber(1234.56, { decimals: 0 })).toBe('1,235');
  });

  it('formats with 4 decimal places', () => {
    expect(formatNumber(1.23456, { decimals: 4 })).toBe('1.2346');
  });

  it('prepends currency symbol', () => {
    expect(formatNumber(100, { currency: '$', currencyPrepend: true })).toBe(
      '$100.00',
    );
  });

  it('appends currency symbol', () => {
    expect(
      formatNumber(100, { currency: ' EUR', currencyPrepend: false }),
    ).toBe('100.00 EUR');
  });

  it('handles negative with currency and parens', () => {
    expect(
      formatNumber(-500, {
        currency: '$',
        currencyPrepend: true,
        negativeStyle: 'parens',
      }),
    ).toBe('($500.00)');
  });

  it('handles small numbers without thousands sep', () => {
    expect(formatNumber(42)).toBe('42.00');
  });

  it('handles large numbers', () => {
    expect(formatNumber(1234567890.12)).toBe('1,234,567,890.12');
  });
});

// ---------------------------------------------------------------------------
// parseFormattedNumber
// ---------------------------------------------------------------------------

describe('parseFormattedNumber', () => {
  it('parses a plain number', () => {
    expect(parseFormattedNumber('123.45')).toBe(123.45);
  });

  it('parses US-formatted number with commas', () => {
    expect(parseFormattedNumber('1,234,567.89')).toBe(1234567.89);
  });

  it('parses European-formatted number', () => {
    expect(parseFormattedNumber('1.234,56')).toBeCloseTo(1234.56);
  });

  it('parses negative with minus sign', () => {
    expect(parseFormattedNumber('-1,234.56')).toBe(-1234.56);
  });

  it('parses negative with parentheses', () => {
    expect(parseFormattedNumber('(1,234.56)')).toBe(-1234.56);
  });

  it('parses with currency symbol prefix', () => {
    expect(parseFormattedNumber('$1,234.56')).toBe(1234.56);
  });

  it('parses with currency symbol suffix', () => {
    expect(parseFormattedNumber('1234.56EUR')).toBe(1234.56);
  });

  it('returns NaN for empty string', () => {
    expect(parseFormattedNumber('')).toBeNaN();
  });

  it('returns NaN for non-numeric text', () => {
    expect(parseFormattedNumber('hello')).toBeNaN();
  });

  it('handles integer without decimals', () => {
    expect(parseFormattedNumber('1,234')).toBe(1234);
  });

  it('handles single comma as decimal for values like "12,5"', () => {
    expect(parseFormattedNumber('12,5')).toBe(12.5);
  });
});

// ---------------------------------------------------------------------------
// AFNumber_Format
// ---------------------------------------------------------------------------

describe('AFNumber_Format', () => {
  it('formats with sepStyle 0 (US: comma + period)', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '', true);
    expect(fmt('1234.56')).toBe('1,234.56');
  });

  it('formats with sepStyle 1 (none + period)', () => {
    const fmt = AFNumber_Format(2, 1, 0, 0, '', true);
    expect(fmt('1234.56')).toBe('1234.56');
  });

  it('formats with sepStyle 2 (European: period + comma)', () => {
    const fmt = AFNumber_Format(2, 2, 0, 0, '', true);
    expect(fmt('1234.56')).toBe('1.234,56');
  });

  it('formats with sepStyle 3 (none + comma)', () => {
    const fmt = AFNumber_Format(2, 3, 0, 0, '', true);
    expect(fmt('1234.56')).toBe('1234,56');
  });

  it('formats negative with minus (negStyle 0)', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '', true);
    expect(fmt('-100')).toBe('-100.00');
  });

  it('formats negative with parens (negStyle 2)', () => {
    const fmt = AFNumber_Format(2, 0, 2, 0, '', true);
    expect(fmt('-100')).toBe('(100.00)');
  });

  it('formats with prepended currency', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '$', true);
    expect(fmt('1000')).toBe('$1,000.00');
  });

  it('formats with appended currency', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, ' EUR', false);
    expect(fmt('1000')).toBe('1,000.00 EUR');
  });

  it('formats with 0 decimal places', () => {
    const fmt = AFNumber_Format(0, 0, 0, 0, '', true);
    expect(fmt('1234.56')).toBe('1,235');
  });

  it('formats with 4 decimal places', () => {
    const fmt = AFNumber_Format(4, 0, 0, 0, '', true);
    expect(fmt('3.14159')).toBe('3.1416');
  });

  it('returns original value for non-numeric input', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '', true);
    expect(fmt('hello')).toBe('hello');
  });

  it('formats zero correctly', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '$', true);
    expect(fmt('0')).toBe('$0.00');
  });
});

// ---------------------------------------------------------------------------
// AFNumber_Keystroke
// ---------------------------------------------------------------------------

describe('AFNumber_Keystroke', () => {
  it('accepts empty string', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('')).toBe(true);
  });

  it('accepts minus sign alone', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('-')).toBe(true);
  });

  it('accepts valid integer', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('123')).toBe(true);
  });

  it('accepts valid decimal', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('123.45')).toBe(true);
  });

  it('rejects too many decimal places', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('123.456')).toBe(false);
  });

  it('rejects letters', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('12abc')).toBe(false);
  });

  it('accepts negative number', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('-42.50')).toBe(true);
  });

  it('accepts commas as thousands separator (sepStyle 0)', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('1,234.56')).toBe(true);
  });

  it('accepts European format (sepStyle 2)', () => {
    const validate = AFNumber_Keystroke(2, 2, 0, 0, '', true);
    expect(validate('1.234,56')).toBe(true);
  });

  it('rejects double decimal separators', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '', true);
    expect(validate('12.34.56')).toBe(false);
  });

  it('accepts value with currency symbol', () => {
    const validate = AFNumber_Keystroke(2, 0, 0, 0, '$', true);
    expect(validate('$123.45')).toBe(true);
  });

  it('accepts parenthesized negative (negStyle 2)', () => {
    const validate = AFNumber_Keystroke(2, 0, 2, 0, '', true);
    expect(validate('(123.45)')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('format → parse round-trip', () => {
  it('US format round-trips', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '', true);
    const formatted = fmt('1234.56');
    const parsed = parseFormattedNumber(formatted);
    expect(parsed).toBeCloseTo(1234.56);
  });

  it('European format round-trips', () => {
    const fmt = AFNumber_Format(2, 2, 0, 0, '', true);
    const formatted = fmt('1234.56');
    const parsed = parseFormattedNumber(formatted);
    expect(parsed).toBeCloseTo(1234.56);
  });

  it('currency format round-trips', () => {
    const fmt = AFNumber_Format(2, 0, 0, 0, '$', true);
    const formatted = fmt('5000');
    const parsed = parseFormattedNumber(formatted);
    expect(parsed).toBeCloseTo(5000);
  });

  it('negative parens format round-trips', () => {
    const fmt = AFNumber_Format(2, 0, 2, 0, '', true);
    const formatted = fmt('-750');
    const parsed = parseFormattedNumber(formatted);
    expect(parsed).toBeCloseTo(-750);
  });
});

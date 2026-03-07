/**
 * @module form/acrobatBuiltins
 *
 * Acrobat-compatible number formatting and validation built-ins.
 *
 * Implements:
 * - `AFNumber_Format`     — format a number string for display
 * - `AFNumber_Keystroke`  — validate a keystroke for number input
 * - `formatNumber`        — general-purpose number formatter
 * - `parseFormattedNumber` — parse a formatted number back to numeric
 *
 * These are pure string transformers — they do not require PDF access.
 *
 * Reference: Acrobat JavaScript Scripting Reference,
 *            AFNumber_Format / AFNumber_Keystroke.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for the general-purpose number formatter.
 */
export interface NumberFormatOptions {
  /** Number of decimal places (default: 2). */
  decimals?: number;
  /** Thousands separator character (default: ','). */
  thousandsSep?: string;
  /** Decimal separator character (default: '.'). */
  decimalSep?: string;
  /** How to display negative numbers (default: 'minus'). */
  negativeStyle?: 'minus' | 'parens';
  /** Currency symbol (default: none). */
  currency?: string;
  /** Whether the currency symbol is prepended (default: true). */
  currencyPrepend?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the thousands and decimal separator characters for a given
 * Acrobat `sepStyle` value.
 *
 * | sepStyle | Thousands | Decimal |
 * |----------|-----------|---------|
 * |    0     |   ','     |   '.'   |
 * |    1     |   ''      |   '.'   |
 * |    2     |   '.'     |   ','   |
 * |    3     |   ''      |   ','   |
 *
 * @internal
 */
function getSeparators(sepStyle: number): { thousands: string; decimal: string } {
  switch (sepStyle) {
    case 0:
      return { thousands: ',', decimal: '.' };
    case 1:
      return { thousands: '', decimal: '.' };
    case 2:
      return { thousands: '.', decimal: ',' };
    case 3:
      return { thousands: '', decimal: ',' };
    default:
      return { thousands: ',', decimal: '.' };
  }
}

/**
 * Insert thousands separators into the integer part of a number string.
 * @internal
 */
function insertThousandsSep(intPart: string, sep: string): string {
  if (sep === '' || intPart.length <= 3) return intPart;

  const parts: string[] = [];
  let remaining = intPart;

  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  parts.unshift(remaining);

  return parts.join(sep);
}

// ---------------------------------------------------------------------------
// parseFormattedNumber
// ---------------------------------------------------------------------------

/**
 * Parse a formatted number string back to a JavaScript number.
 *
 * Handles:
 * - Currency symbols (any non-digit, non-separator prefix/suffix)
 * - Thousands separators (comma or period)
 * - Decimal separators (period or comma)
 * - Parenthesized negatives: `(1,234.56)` → `-1234.56`
 * - Minus sign negatives: `-1,234.56` → `-1234.56`
 *
 * @param text  The formatted number string.
 * @returns     The parsed number. Returns `NaN` if parsing fails.
 */
export function parseFormattedNumber(text: string): number {
  if (typeof text !== 'string') return NaN;

  let s = text.trim();
  if (s === '') return NaN;

  // Detect parenthesized negative
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // Strip currency symbols and other non-numeric characters at the edges
  s = s.replace(/^[^\d\-+.,]+/, '').replace(/[^\d.,]+$/, '');

  if (s === '') return NaN;

  // Handle minus sign
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  // Determine separator roles
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // European: 1.234,56 → comma is decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56 → dot is decimal
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Only commas — check if it's a decimal or thousands
    const afterComma = s.slice(lastComma + 1);
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount === 1 && afterComma.length <= 2) {
      // Single comma with <=2 trailing digits → decimal
      s = s.replace(',', '.');
    } else {
      // Multiple commas or 3+ trailing digits → thousands
      s = s.replace(/,/g, '');
    }
  }
  // else: only dots or nothing — standard parseFloat

  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

/**
 * Format a number according to the given options.
 *
 * @param value    The number to format.
 * @param options  Formatting options.
 * @returns        The formatted string.
 */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const {
    decimals = 2,
    thousandsSep = ',',
    decimalSep = '.',
    negativeStyle = 'minus',
    currency = '',
    currencyPrepend = true,
  } = options;

  const isNeg = value < 0;
  const absVal = Math.abs(value);

  // Format with fixed decimals
  const fixed = absVal.toFixed(decimals);

  // Split into integer and decimal parts
  const dotIdx = fixed.indexOf('.');
  const intPart = dotIdx > -1 ? fixed.slice(0, dotIdx) : fixed;
  const decPart = dotIdx > -1 ? fixed.slice(dotIdx + 1) : '';

  // Insert thousands separators
  const formattedInt = insertThousandsSep(intPart, thousandsSep);

  // Assemble the number
  let result = decimals > 0
    ? formattedInt + decimalSep + decPart
    : formattedInt;

  // Apply currency
  if (currency) {
    result = currencyPrepend ? currency + result : result + currency;
  }

  // Apply negative style
  if (isNeg) {
    if (negativeStyle === 'parens') {
      result = `(${result})`;
    } else {
      result = `-${result}`;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// AFNumber_Format
// ---------------------------------------------------------------------------

/**
 * Create an Acrobat-compatible number formatting function.
 *
 * Returns a function that takes a raw value string and returns the
 * formatted display string.
 *
 * @param nDec              Number of decimal places.
 * @param sepStyle          Separator style (0–3). See table above.
 * @param negStyle          Negative style: 0=minus, 1=red (treated as minus),
 *                          2=parens, 3=red+parens (treated as parens).
 * @param currStyle         Currency style (legacy, not used).
 * @param strCurrency       Currency symbol string.
 * @param bCurrencyPrepend  `true` to prepend the currency symbol.
 * @returns                 A formatting function `(value: string) => string`.
 */
export function AFNumber_Format(
  nDec: number,
  sepStyle: number,
  negStyle: number,
  currStyle: number,
  strCurrency: string,
  bCurrencyPrepend: boolean,
): (value: string) => string {
  const seps = getSeparators(sepStyle);
  const useParens = negStyle === 2 || negStyle === 3;

  return (value: string): string => {
    const num = parseFormattedNumber(value);
    if (Number.isNaN(num)) return value;

    return formatNumber(num, {
      decimals: nDec,
      thousandsSep: seps.thousands,
      decimalSep: seps.decimal,
      negativeStyle: useParens ? 'parens' : 'minus',
      currency: strCurrency,
      currencyPrepend: bCurrencyPrepend,
    });
  };
}

// ---------------------------------------------------------------------------
// AFNumber_Keystroke
// ---------------------------------------------------------------------------

/**
 * Create an Acrobat-compatible number keystroke validation function.
 *
 * Returns a function that validates whether the current input string
 * is a valid partial or complete number entry.
 *
 * @param nDec              Number of decimal places.
 * @param sepStyle          Separator style (0–3).
 * @param negStyle          Negative style (0–3).
 * @param currStyle         Currency style (legacy, not used).
 * @param strCurrency       Currency symbol string.
 * @param bCurrencyPrepend  `true` to prepend the currency symbol.
 * @returns                 A validation function `(value: string) => boolean`.
 */
export function AFNumber_Keystroke(
  nDec: number,
  sepStyle: number,
  negStyle: number,
  currStyle: number,
  strCurrency: string,
  bCurrencyPrepend: boolean,
): (value: string) => boolean {
  const seps = getSeparators(sepStyle);

  return (value: string): boolean => {
    if (value === '' || value === '-' || value === '+') return true;

    let s = value.trim();

    // Strip currency symbol if present
    if (strCurrency) {
      s = s.replace(new RegExp(escapeRegex(strCurrency), 'g'), '').trim();
    }

    // Allow parenthesized input for negative styles that use parens
    const useParens = negStyle === 2 || negStyle === 3;
    if (useParens) {
      if (s.startsWith('(')) s = s.slice(1);
      if (s.endsWith(')')) s = s.slice(0, -1);
      s = s.trim();
    }

    // Allow leading minus or plus
    if (s.startsWith('-') || s.startsWith('+')) {
      s = s.slice(1);
    }

    if (s === '') return true;

    // Check each character
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!;
      if (c >= '0' && c <= '9') continue;
      if (c === seps.decimal) continue;
      if (c === seps.thousands) continue;
      return false;
    }

    // Check decimal places
    const decIdx = s.indexOf(seps.decimal);
    if (decIdx > -1) {
      // Only one decimal separator allowed
      if (s.includes(seps.decimal, decIdx + 1)) return false;

      // Check max decimal places
      const afterDec = s.slice(decIdx + 1);
      // Remove any thousands separators from the check
      const cleanAfter = seps.thousands
        ? afterDec.replace(new RegExp(escapeRegex(seps.thousands), 'g'), '')
        : afterDec;
      if (cleanAfter.length > nDec && nDec >= 0) return false;
    }

    return true;
  };
}

// ---------------------------------------------------------------------------
// Regex helper
// ---------------------------------------------------------------------------

/**
 * Escape special regex characters in a string.
 * @internal
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

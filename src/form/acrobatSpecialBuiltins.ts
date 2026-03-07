/**
 * @module form/acrobatSpecialBuiltins
 *
 * Acrobat-compatible AFPercent and AFSpecial format/keystroke functions.
 *
 * These replicate the behaviour of the built-in Acrobat JavaScript
 * functions used in PDF form field actions:
 *
 * - `AFPercent_Format(nDec, sepStyle)` — format a value as a percentage
 * - `AFPercent_Keystroke(nDec, sepStyle)` — validate percentage input
 * - `AFSpecial_Format(psf)` — format special fields (ZIP, phone, SSN)
 * - `AFSpecial_Keystroke(psf)` — validate special field input
 * - `formatSpecial(value, mask)` — apply a mask pattern to a value
 * - `validateSpecial(value, mask)` — validate a value against a mask
 *
 * Reference: Acrobat JavaScript Scripting Reference, Appendix B.
 */

// ---------------------------------------------------------------------------
// Separator styles
// ---------------------------------------------------------------------------

/**
 * Separator style for numeric formatting.
 *
 * | sepStyle | Thousands | Decimal |
 * | -------- | --------- | ------- |
 * | 0        | comma     | period  |
 * | 1        | none      | period  |
 * | 2        | period    | comma   |
 * | 3        | none      | comma   |
 */
interface SepConfig {
  thousands: string;
  decimal: string;
}

function getSepConfig(sepStyle: number): SepConfig {
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
 * Add thousands separators to an integer string.
 */
function addThousands(intPart: string, sep: string): string {
  if (sep === '' || intPart.length <= 3) return intPart;

  const isNeg = intPart.startsWith('-');
  const digits = isNeg ? intPart.slice(1) : intPart;
  const parts: string[] = [];
  let i = digits.length;
  while (i > 0) {
    const start = Math.max(0, i - 3);
    parts.unshift(digits.slice(start, i));
    i = start;
  }
  const result = parts.join(sep);
  return isNeg ? `-${result}` : result;
}

// ---------------------------------------------------------------------------
// AFPercent_Format
// ---------------------------------------------------------------------------

/**
 * Create a percentage formatter matching Acrobat's `AFPercent_Format`.
 *
 * Multiplies the numeric value by 100, formats with the given number
 * of decimal places and separator style, and appends `%`.
 *
 * @param nDec     - Number of decimal places (0+).
 * @param sepStyle - Separator style (0–3).
 * @returns A function that formats a numeric string as a percentage.
 */
export function AFPercent_Format(
  nDec: number,
  sepStyle: number,
): (value: string) => string {
  const sep = getSepConfig(sepStyle);

  return (value: string): string => {
    const stripped = value.replace(/[^0-9.\-]/g, '');
    if (stripped === '' || stripped === '-') return '';

    const num = parseFloat(stripped) * 100;
    if (Number.isNaN(num)) return '';

    const fixed = num.toFixed(nDec);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = addThousands(intPart!, sep.thousands);

    if (nDec === 0 || decPart === undefined) {
      return `${formattedInt}%`;
    }
    return `${formattedInt}${sep.decimal}${decPart}%`;
  };
}

// ---------------------------------------------------------------------------
// AFPercent_Keystroke
// ---------------------------------------------------------------------------

/**
 * Create a percentage keystroke validator matching Acrobat's
 * `AFPercent_Keystroke`.
 *
 * Returns `true` if the value could be a valid (partial) numeric input
 * for a percentage field.
 *
 * @param _nDec     - Number of decimal places (used for context).
 * @param _sepStyle - Separator style (used for context).
 * @returns A function that validates keystroke input.
 */
export function AFPercent_Keystroke(
  _nDec: number,
  _sepStyle: number,
): (value: string) => boolean {
  return (value: string): boolean => {
    if (value === '' || value === '-' || value === '.') return true;
    // Allow partial numeric input: optional minus, digits, optional decimal+digits, optional %
    return /^-?\d*\.?\d*%?$/.test(value);
  };
}

// ---------------------------------------------------------------------------
// AFSpecial_Format
// ---------------------------------------------------------------------------

/** Predefined special format masks. */
const SPECIAL_MASKS: Record<number, string> = {
  0: '99999',           // ZIP Code (5 digits)
  1: '99999-9999',      // ZIP+4 (9 digits)
  2: '(999) 999-9999',  // Phone
  3: '999-99-9999',     // SSN
};

/**
 * Create a special field formatter matching Acrobat's `AFSpecial_Format`.
 *
 * | psf | Format             | Example       |
 * | --- | ------------------ | ------------- |
 * | 0   | ZIP Code           | 12345         |
 * | 1   | ZIP+4              | 12345-6789    |
 * | 2   | Phone              | (123) 456-7890 |
 * | 3   | SSN                | 123-45-6789   |
 *
 * @param psf - The predefined special format type (0–3).
 * @returns A function that formats a digit string using the special mask.
 */
export function AFSpecial_Format(
  psf: number,
): (value: string) => string {
  const mask = SPECIAL_MASKS[psf];
  if (mask === undefined) {
    return (value: string) => value;
  }

  return (value: string): string => {
    return formatSpecial(value, mask);
  };
}

// ---------------------------------------------------------------------------
// AFSpecial_Keystroke
// ---------------------------------------------------------------------------

/**
 * Create a special field keystroke validator matching Acrobat's
 * `AFSpecial_Keystroke`.
 *
 * Validates that the input contains only digits and has the correct
 * number of digits for the selected special format.
 *
 * @param psf - The predefined special format type (0–3).
 * @returns A function that validates keystroke input.
 */
export function AFSpecial_Keystroke(
  psf: number,
): (value: string) => boolean {
  const mask = SPECIAL_MASKS[psf];
  if (mask === undefined) {
    return () => true;
  }

  return (value: string): boolean => {
    return validateSpecial(value, mask);
  };
}

// ---------------------------------------------------------------------------
// Generic mask formatting / validation
// ---------------------------------------------------------------------------

/**
 * Apply a mask pattern to a value.
 *
 * Mask characters:
 * - `9` — digit (0–9)
 * - `a` — letter (a–z, A–Z)
 * - `*` — any character
 * - Any other character is a literal (e.g. `-`, `(`, `)`, ` `)
 *
 * The value's characters are consumed left-to-right; literal mask
 * characters are inserted as-is. If the value runs out of characters
 * before the mask is complete, the result is truncated.
 *
 * @param value - The raw input value (often digits only).
 * @param mask  - The mask pattern string.
 * @returns The formatted string.
 */
export function formatSpecial(value: string, mask: string): string {
  // Strip all non-alphanumeric characters from the value to get raw input
  const raw = value.replace(/[^a-zA-Z0-9]/g, '');
  let rawIdx = 0;
  const result: string[] = [];

  for (let i = 0; i < mask.length; i++) {
    if (rawIdx >= raw.length) break;

    const mc = mask[i]!;

    if (mc === '9') {
      // Expect a digit
      const ch = raw[rawIdx];
      if (ch !== undefined && /\d/.test(ch)) {
        result.push(ch);
        rawIdx++;
      } else {
        // Skip non-digit characters in raw input
        rawIdx++;
        i--; // retry same mask position
      }
    } else if (mc === 'a') {
      // Expect a letter
      const ch = raw[rawIdx];
      if (ch !== undefined && /[a-zA-Z]/.test(ch)) {
        result.push(ch);
        rawIdx++;
      } else {
        rawIdx++;
        i--;
      }
    } else if (mc === '*') {
      // Accept any character
      result.push(raw[rawIdx]!);
      rawIdx++;
    } else {
      // Literal character — insert from mask
      result.push(mc);
    }
  }

  return result.join('');
}

/**
 * Validate a value against a mask pattern.
 *
 * Strips non-alphanumeric characters from the value, then checks that
 * the remaining characters match the mask's digit/letter/any slots
 * and that the total character count is correct.
 *
 * @param value - The raw input value to validate.
 * @param mask  - The mask pattern string.
 * @returns `true` if the value matches the mask.
 */
export function validateSpecial(value: string, mask: string): boolean {
  const raw = value.replace(/[^a-zA-Z0-9]/g, '');

  // Count how many input slots the mask expects
  let expectedSlots = 0;
  for (const ch of mask) {
    if (ch === '9' || ch === 'a' || ch === '*') {
      expectedSlots++;
    }
  }

  // Allow partial input (fewer chars than slots)
  if (raw.length > expectedSlots) {
    return false;
  }

  // Validate each character against its mask slot
  let rawIdx = 0;
  for (const mc of mask) {
    if (rawIdx >= raw.length) break;

    if (mc === '9') {
      if (!/\d/.test(raw[rawIdx]!)) return false;
      rawIdx++;
    } else if (mc === 'a') {
      if (!/[a-zA-Z]/.test(raw[rawIdx]!)) return false;
      rawIdx++;
    } else if (mc === '*') {
      rawIdx++;
    }
    // Literals are skipped (not consumed from raw)
  }

  return true;
}

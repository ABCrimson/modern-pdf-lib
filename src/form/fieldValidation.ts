/**
 * @module form/fieldValidation
 *
 * Field-level validation for PDF form fields.
 *
 * Provides built-in validation patterns (email, phone, range, required,
 * regex, length) and the ability to parse Acrobat validation scripts
 * into structured validation types.
 *
 * Reference: Acrobat JavaScript Scripting Reference, Chapter 7 (Field).
 */

import type { PdfField } from './pdfField.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a field validation check.
 *
 * @property valid   - Whether the value passed validation.
 * @property message - Optional human-readable error message when invalid.
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Structured representation of a validation rule.
 *
 * @property type   - The kind of validation to apply.
 * @property params - Optional parameters for the validation rule.
 */
export interface ValidationType {
  type: 'email' | 'phone' | 'range' | 'required' | 'regex' | 'length' | 'custom';
  params?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Built-in validation patterns
// ---------------------------------------------------------------------------

/** Validates that a value is a plausible email address. */
function validateEmail(value: string): ValidationResult {
  if (value.length === 0) {
    return { valid: true };
  }
  // Must contain @, have text before and after, and domain must have a dot
  const atIndex = value.indexOf('@');
  if (atIndex < 1) {
    return { valid: false, message: 'Invalid email: missing or misplaced @' };
  }
  const domain = value.slice(atIndex + 1);
  if (domain.length === 0 || !domain.includes('.')) {
    return { valid: false, message: 'Invalid email: domain must contain a dot' };
  }
  const localPart = value.slice(0, atIndex);
  if (localPart.length === 0) {
    return { valid: false, message: 'Invalid email: empty local part' };
  }
  return { valid: true };
}

/** Validates that a value is a plausible phone number (10+ digits). */
function validatePhone(value: string): ValidationResult {
  if (value.length === 0) {
    return { valid: true };
  }
  // Extract digits only
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return { valid: false, message: `Invalid phone: expected at least 10 digits, got ${digits.length}` };
  }
  return { valid: true };
}

/** Validates that a numeric value falls within min/max bounds. */
function validateRange(
  value: string,
  params: Record<string, string | number>,
): ValidationResult {
  if (value.length === 0) {
    return { valid: true };
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return { valid: false, message: 'Invalid range: value is not a number' };
  }
  const min = params['min'] !== undefined ? Number(params['min']) : -Infinity;
  const max = params['max'] !== undefined ? Number(params['max']) : Infinity;
  if (num < min) {
    return { valid: false, message: `Value ${num} is below minimum ${min}` };
  }
  if (num > max) {
    return { valid: false, message: `Value ${num} is above maximum ${max}` };
  }
  return { valid: true };
}

/** Validates that a value is non-empty. */
function validateRequired(value: string): ValidationResult {
  if (value.trim().length === 0) {
    return { valid: false, message: 'This field is required' };
  }
  return { valid: true };
}

/** Validates a value against a regex pattern. */
function validateRegex(
  value: string,
  params: Record<string, string | number>,
): ValidationResult {
  if (value.length === 0) {
    return { valid: true };
  }
  const pattern = params['pattern'];
  if (pattern === undefined) {
    return { valid: false, message: 'No regex pattern specified' };
  }
  const flags = typeof params['flags'] === 'string' ? params['flags'] : '';
  const re = new RegExp(String(pattern), flags);
  if (!re.test(value)) {
    return { valid: false, message: `Value does not match pattern ${String(pattern)}` };
  }
  return { valid: true };
}

/** Validates that a value's length falls within min/max bounds. */
function validateLength(
  value: string,
  params: Record<string, string | number>,
): ValidationResult {
  const min = params['min'] !== undefined ? Number(params['min']) : 0;
  const max = params['max'] !== undefined ? Number(params['max']) : Infinity;
  if (value.length < min) {
    return { valid: false, message: `Value must be at least ${min} characters` };
  }
  if (value.length > max) {
    return { valid: false, message: `Value must be at most ${max} characters` };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Validation dispatcher
// ---------------------------------------------------------------------------

/**
 * Run a built-in validation check based on a `ValidationType`.
 */
function runBuiltInValidation(
  value: string,
  validation: ValidationType,
): ValidationResult {
  const params = validation.params ?? {};

  switch (validation.type) {
    case 'email':
      return validateEmail(value);
    case 'phone':
      return validatePhone(value);
    case 'range':
      return validateRange(value, params);
    case 'required':
      return validateRequired(value);
    case 'regex':
      return validateRegex(value, params);
    case 'length':
      return validateLength(value, params);
    case 'custom':
      // Custom validation scripts are not executed — always pass
      return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a field's value using a validation script string.
 *
 * The script is parsed to determine the validation type. If the script
 * matches a known Acrobat validation pattern (email, phone, range, etc.),
 * the corresponding built-in validation is applied. Otherwise, the value
 * is considered valid (custom scripts are not executed).
 *
 * @param field  - The PdfField being validated.
 * @param value  - The string value to validate.
 * @param script - The validation script (Acrobat JavaScript).
 * @returns A {@link ValidationResult} indicating whether the value is valid.
 */
export function validateFieldValue(
  field: PdfField,
  value: string,
  script: string,
): ValidationResult {
  const validation = parseValidationScript(script);
  if (validation === null) {
    return { valid: true };
  }
  return runBuiltInValidation(value, validation);
}

/**
 * Parse a validation script string to extract the validation type.
 *
 * Recognizes common Acrobat JavaScript validation patterns:
 *
 * - `AFRange_Validate(true, min, true, max)` — range validation
 * - Email patterns (contains "email" or "mail" keywords)
 * - Phone patterns (contains "phone" or "tel" keywords)
 * - Required patterns (contains "required" keyword or checks for empty)
 * - Regex patterns (contains `RegExp` or `.test(`)
 * - Length patterns (contains "length" keyword with numeric bounds)
 *
 * @param script - The validation script to parse.
 * @returns A {@link ValidationType} if recognized, or `null` for unknown scripts.
 */
export function parseValidationScript(script: string): ValidationType | null {
  if (typeof script !== 'string' || script.trim().length === 0) {
    return null;
  }

  const trimmed = script.trim();

  // AFRange_Validate(bGtMin, min, bLtMax, max)
  const rangeMatch = trimmed.match(
    /AFRange_Validate\s*\(\s*(true|false)\s*,\s*(-?[\d.]+)\s*,\s*(true|false)\s*,\s*(-?[\d.]+)\s*\)/i,
  );
  if (rangeMatch) {
    const params: Record<string, string | number> = {};
    if (rangeMatch[1] === 'true') {
      params['min'] = parseFloat(rangeMatch[2]!);
    }
    if (rangeMatch[3] === 'true') {
      params['max'] = parseFloat(rangeMatch[4]!);
    }
    return { type: 'range', params };
  }

  // RegExp / .test( patterns
  const regexTestMatch = trimmed.match(
    /new\s+RegExp\s*\(\s*(['"])(.*?)\1\s*(?:,\s*(['"])(.*?)\3)?\s*\)/,
  );
  if (regexTestMatch) {
    const params: Record<string, string | number> = {
      pattern: regexTestMatch[2]!,
    };
    if (regexTestMatch[4] !== undefined) {
      params['flags'] = regexTestMatch[4];
    }
    return { type: 'regex', params };
  }

  // Inline regex: /pattern/.test(
  const inlineRegexMatch = trimmed.match(/\/(.+?)\/([gimsuy]*)\s*\.test\s*\(/);
  if (inlineRegexMatch) {
    const params: Record<string, string | number> = {
      pattern: inlineRegexMatch[1]!,
    };
    if (inlineRegexMatch[2]) {
      params['flags'] = inlineRegexMatch[2];
    }
    return { type: 'regex', params };
  }

  // Email patterns
  if (/email|e-mail|mail/i.test(trimmed) && /@/.test(trimmed)) {
    return { type: 'email' };
  }

  // Phone patterns
  if (/phone|tel(?:ephone)?/i.test(trimmed) && /\d/.test(trimmed)) {
    return { type: 'phone' };
  }

  // Required patterns
  if (
    /required/i.test(trimmed) ||
    /==\s*["']?\s*["']?/.test(trimmed) && /event\.rc\s*=\s*false/i.test(trimmed)
  ) {
    return { type: 'required' };
  }

  // Length patterns: e.g. "if (event.value.length < 5 || event.value.length > 20)"
  const lengthMatch = trimmed.match(
    /\.length\s*(?:[<>]=?|[!=]==?)\s*(\d+)/g,
  );
  if (lengthMatch && lengthMatch.length > 0) {
    const params: Record<string, string | number> = {};
    for (const m of lengthMatch) {
      const parts = m.match(/\.length\s*([<>!=]=?)\s*(\d+)/);
      if (parts) {
        const op = parts[1]!;
        const val = parseInt(parts[2]!, 10);
        if (op === '<' || op === '<=' || op === '>=') {
          if (op === '>=' || op === '<') {
            // .length >= N → min=N; .length < N → max=N-1
            if (op === '>=') params['min'] = val;
            else params['max'] = val - 1;
          } else {
            // .length <= N → max=N
            params['max'] = val;
          }
        }
        if (op === '>') {
          params['min'] = val + 1;
        }
      }
    }
    return { type: 'length', params };
  }

  return null;
}

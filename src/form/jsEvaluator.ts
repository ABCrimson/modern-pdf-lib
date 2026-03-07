/**
 * @module form/jsEvaluator
 *
 * Purpose-built evaluator for PDF form calculation scripts.
 *
 * This is NOT a full JavaScript engine. It handles:
 * - Arithmetic expressions with +, -, *, /, %, parentheses
 * - Field references resolved from a field-value map
 * - The `AFSimple_Calculate` built-in (SUM, AVG, PRD, MIN, MAX)
 *
 * Reference: Acrobat JavaScript Scripting Reference —
 * "Calculation" field actions and AFSimple_Calculate.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed representation of a PDF calculation script.
 *
 * - `operation`: one of the five AFSimple_Calculate operations, or `'custom'`
 *   for an arbitrary arithmetic expression.
 * - `fieldNames`: the field names referenced by the calculation.
 * - `customExpression`: the raw expression string (only for `'custom'`).
 */
export interface CalculationInfo {
  operation: 'SUM' | 'AVG' | 'PRD' | 'MIN' | 'MAX' | 'custom';
  fieldNames: string[];
  customExpression?: string;
}

// ---------------------------------------------------------------------------
// Token types for the expression lexer
// ---------------------------------------------------------------------------

type TokenKind = 'number' | 'op' | 'lparen' | 'rparen' | 'field';

interface Token {
  kind: TokenKind;
  value: string;
  numericValue?: number;
}

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

/**
 * Strip currency symbols, commas, whitespace, and other non-numeric
 * decorations from a string so it can be parsed as a number.
 *
 * Handles:
 * - Leading/trailing whitespace
 * - Currency symbols: $, EUR, GBP, JPY, etc.
 * - Thousands separators (commas when period is decimal sep, or vice versa)
 * - Parenthesized negatives: (123.45) → -123.45
 *
 * @internal
 */
export function cleanNumber(raw: string): number {
  let s = raw.trim();
  if (s === '' || s === '-') return 0;

  // Handle parenthesized negative: (1,234.56) → -1234.56
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // Strip leading/trailing non-numeric characters (currency symbols, letters)
  s = s.replace(/^[^\d\-+.,]+/, '').replace(/[^\d.,]+$/, '');

  if (s === '' || s === '-') return 0;

  // Detect decimal separator heuristic:
  // If both ',' and '.' are present, the last one is the decimal separator.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Comma is decimal separator (European style): 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is decimal separator (US style): 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Only commas — could be thousands or decimal.
    // If exactly one comma and <=2 digits after it, treat as decimal.
    const parts = s.split(',');
    if (parts.length === 2 && (parts[1]!.length <= 2)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  // else: only dots (or neither) — standard parseFloat

  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return negative ? -n : n;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize an arithmetic expression string.
 *
 * Recognizes:
 * - Numbers (integer and decimal)
 * - Operators: +, -, *, /, %
 * - Parentheses
 * - Field references enclosed in `getField("name").value`
 *   or bare identifiers that will be looked up in fieldValues
 *
 * @internal
 */
function tokenize(expression: string, fieldNames: Set<string>): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expression.length;

  while (i < len) {
    const ch = expression[i]!;

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Number literal
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && expression[i + 1]! >= '0' && expression[i + 1]! <= '9')) {
      let numStr = '';
      while (i < len && ((expression[i]! >= '0' && expression[i]! <= '9') || expression[i] === '.')) {
        numStr += expression[i]!;
        i++;
      }
      // Handle scientific notation
      if (i < len && (expression[i] === 'e' || expression[i] === 'E')) {
        numStr += expression[i]!;
        i++;
        if (i < len && (expression[i] === '+' || expression[i] === '-')) {
          numStr += expression[i]!;
          i++;
        }
        while (i < len && expression[i]! >= '0' && expression[i]! <= '9') {
          numStr += expression[i]!;
          i++;
        }
      }
      tokens.push({ kind: 'number', value: numStr, numericValue: parseFloat(numStr) });
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ kind: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen', value: ')' });
      i++;
      continue;
    }

    // getField("name").value  pattern
    if (expression.slice(i).startsWith('getField')) {
      const pattern = /^getField\s*\(\s*["']([^"']+)["']\s*\)\s*\.\s*value/;
      const match = expression.slice(i).match(pattern);
      if (match) {
        tokens.push({ kind: 'field', value: match[1]! });
        i += match[0].length;
        continue;
      }
    }

    // Identifier — could be a field name
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (
        i < len &&
        ((expression[i]! >= 'a' && expression[i]! <= 'z') ||
          (expression[i]! >= 'A' && expression[i]! <= 'Z') ||
          (expression[i]! >= '0' && expression[i]! <= '9') ||
          expression[i] === '_' || expression[i] === '.')
      ) {
        ident += expression[i]!;
        i++;
      }

      // Check if this identifier is a known field name
      if (fieldNames.has(ident)) {
        tokens.push({ kind: 'field', value: ident });
      } else {
        // Could be a number literal like "NaN" or "Infinity"
        const numVal = parseFloat(ident);
        if (!Number.isNaN(numVal)) {
          tokens.push({ kind: 'number', value: ident, numericValue: numVal });
        }
        // Otherwise skip unknown identifiers
      }
      continue;
    }

    // Skip unknown characters (quotes, semicolons, etc.)
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Recursive descent parser / evaluator
// ---------------------------------------------------------------------------

/**
 * Parse and evaluate tokens as an arithmetic expression.
 *
 * Grammar:
 *   expr       → term (('+' | '-') term)*
 *   term       → unary (('*' | '/' | '%') unary)*
 *   unary      → ('-' | '+') unary | primary
 *   primary    → NUMBER | FIELD | '(' expr ')'
 *
 * @internal
 */
function evalTokens(tokens: Token[], fieldValues: Map<string, string>): number {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++]!;
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length) {
      const t = peek();
      if (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const right = parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (pos < tokens.length) {
      const t = peek();
      if (t?.kind === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        consume();
        const right = parseUnary();
        if (t.value === '*') left = left * right;
        else if (t.value === '/') left = right === 0 ? 0 : left / right;
        else left = right === 0 ? 0 : left % right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): number {
    const t = peek();
    if (t?.kind === 'op' && (t.value === '-' || t.value === '+')) {
      consume();
      const val = parseUnary();
      return t.value === '-' ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = peek();
    if (t === undefined) return 0;

    if (t.kind === 'number') {
      consume();
      return t.numericValue!;
    }

    if (t.kind === 'field') {
      consume();
      const rawValue = fieldValues.get(t.value) ?? '0';
      return cleanNumber(rawValue);
    }

    if (t.kind === 'lparen') {
      consume();
      const val = parseExpr();
      // consume closing paren if present
      if (peek()?.kind === 'rparen') consume();
      return val;
    }

    // Skip unexpected tokens
    consume();
    return 0;
  }

  return parseExpr();
}

// ---------------------------------------------------------------------------
// AFSimple_Calculate
// ---------------------------------------------------------------------------

/**
 * Execute an AFSimple_Calculate operation on a set of field values.
 *
 * @param op          One of 'SUM', 'AVG', 'PRD', 'MIN', 'MAX'.
 * @param fieldNames  The field names to aggregate.
 * @param fieldValues Map of all field name → string value.
 * @returns           The computed numeric result.
 *
 * @internal
 */
function afSimpleCalculate(
  op: 'SUM' | 'AVG' | 'PRD' | 'MIN' | 'MAX',
  fieldNames: string[],
  fieldValues: Map<string, string>,
): number {
  const values = fieldNames.map((name) => {
    const raw = fieldValues.get(name) ?? '0';
    return cleanNumber(raw);
  });

  if (values.length === 0) return 0;

  switch (op) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'AVG': {
      const sum = values.reduce((a, b) => a + b, 0);
      return sum / values.length;
    }
    case 'PRD':
      return values.reduce((a, b) => a * b, 1);
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
  }
}

// ---------------------------------------------------------------------------
// Script parsing
// ---------------------------------------------------------------------------

/**
 * Parse an Acrobat calculation script to extract the operation and
 * field names.
 *
 * Recognizes two patterns:
 *
 * 1. `AFSimple_Calculate("SUM", ["field1", "field2"])`
 * 2. Arbitrary arithmetic expressions with `getField("name").value`
 *    references or bare field-name identifiers.
 *
 * @param script  The raw JavaScript string from the calculation action.
 * @returns       A {@link CalculationInfo} object, or `null` if the script
 *                cannot be parsed.
 */
export function parseCalculationScript(script: string): CalculationInfo | null {
  if (typeof script !== 'string' || script.trim() === '') return null;

  // Pattern 1: AFSimple_Calculate("OP", ["f1", "f2", ...])
  const afPattern =
    /AFSimple_Calculate\s*\(\s*["'](\w+)["']\s*,\s*\[([^\]]*)\]\s*\)/;
  const afMatch = script.match(afPattern);
  if (afMatch) {
    const opStr = afMatch[1]!.toUpperCase();
    const validOps = ['SUM', 'AVG', 'PRD', 'MIN', 'MAX'] as const;
    const op = validOps.find((o) => o === opStr);
    if (!op) return null;

    // Parse the field name list
    const fieldListStr = afMatch[2]!;
    const fieldNames: string[] = [];
    const fieldPattern = /["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = fieldPattern.exec(fieldListStr)) !== null) {
      fieldNames.push(m[1]!);
    }

    return { operation: op, fieldNames };
  }

  // Pattern 2: Custom expression with getField("name").value references
  const getFieldPattern = /getField\s*\(\s*["']([^"']+)["']\s*\)\s*\.\s*value/g;
  const fieldNames: string[] = [];
  let gfm: RegExpExecArray | null;
  while ((gfm = getFieldPattern.exec(script)) !== null) {
    if (!fieldNames.includes(gfm[1]!)) {
      fieldNames.push(gfm[1]!);
    }
  }

  // Extract the expression part (look for event.value = ...)
  const assignPattern = /event\s*\.\s*value\s*=\s*(.+?)(?:;|$)/s;
  const assignMatch = script.match(assignPattern);
  const expression = assignMatch ? assignMatch[1]!.trim() : script.trim();

  if (fieldNames.length > 0) {
    return {
      operation: 'custom',
      fieldNames,
      customExpression: expression,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a calculation expression in the context of PDF form field values.
 *
 * Supports:
 * - Arithmetic operators: `+`, `-`, `*`, `/`, `%`
 * - Parenthesized sub-expressions
 * - `AFSimple_Calculate("OP", ["field1", "field2"])` calls
 * - `getField("name").value` field references
 * - Bare field-name identifiers
 * - String-to-number conversion (strips currency, commas, whitespace)
 *
 * @param expression   The calculation expression or script to evaluate.
 * @param fieldValues  Map of field name to current string value.
 * @param decimals     Number of decimal places in the result (default 2).
 * @returns            The result formatted as a string.
 */
export function evaluateExpression(
  expression: string,
  fieldValues: Map<string, string>,
  decimals: number = 2,
): string {
  if (typeof expression !== 'string' || expression.trim() === '') return '0';

  // First try to parse as an AFSimple_Calculate call
  const info = parseCalculationScript(expression);
  if (info && info.operation !== 'custom') {
    const result = afSimpleCalculate(info.operation, info.fieldNames, fieldValues);
    return formatResult(result, decimals);
  }

  // Custom expression: resolve the actual expression to evaluate
  const exprStr = info?.customExpression ?? expression;

  // Tokenize and evaluate
  const fieldNameSet = new Set(fieldValues.keys());
  const tokens = tokenize(exprStr, fieldNameSet);
  const result = evalTokens(tokens, fieldValues);

  return formatResult(result, decimals);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a numeric result to a fixed number of decimal places.
 * @internal
 */
function formatResult(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(decimals);
}

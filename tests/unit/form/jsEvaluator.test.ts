/**
 * Tests for jsEvaluator — arithmetic expression evaluator for PDF forms.
 *
 * Covers:
 * - Basic arithmetic (+, -, *, /, %)
 * - Operator precedence and parentheses
 * - Field value resolution
 * - AFSimple_Calculate (SUM, AVG, PRD, MIN, MAX)
 * - parseCalculationScript
 * - String-to-number cleaning (currency, commas, etc.)
 * - Edge cases (empty, NaN, division by zero)
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateExpression,
  parseCalculationScript,
  cleanNumber,
} from '../../../src/form/jsEvaluator.js';

// ---------------------------------------------------------------------------
// cleanNumber
// ---------------------------------------------------------------------------

describe('cleanNumber', () => {
  it('parses plain numbers', () => {
    expect(cleanNumber('123')).toBe(123);
    expect(cleanNumber('45.67')).toBe(45.67);
    expect(cleanNumber('-10')).toBe(-10);
  });

  it('strips currency symbols', () => {
    expect(cleanNumber('$1,234.56')).toBe(1234.56);
    expect(cleanNumber('EUR1234')).toBe(1234);
    expect(cleanNumber('1234GBP')).toBe(1234);
  });

  it('handles comma as thousands separator (US)', () => {
    expect(cleanNumber('1,234,567.89')).toBe(1234567.89);
  });

  it('handles comma as decimal separator (European)', () => {
    expect(cleanNumber('1.234,56')).toBe(1234.56);
  });

  it('handles parenthesized negatives', () => {
    expect(cleanNumber('(100.50)')).toBe(-100.50);
    expect(cleanNumber('($1,200.00)')).toBe(-1200);
  });

  it('returns 0 for empty or invalid strings', () => {
    expect(cleanNumber('')).toBe(0);
    expect(cleanNumber('-')).toBe(0);
    expect(cleanNumber('abc')).toBe(0);
  });

  it('handles single comma with few digits after as decimal', () => {
    expect(cleanNumber('12,5')).toBe(12.5);
    expect(cleanNumber('12,50')).toBe(12.50);
  });

  it('handles multiple commas as thousands', () => {
    expect(cleanNumber('1,234,567')).toBe(1234567);
  });
});

// ---------------------------------------------------------------------------
// evaluateExpression — basic arithmetic
// ---------------------------------------------------------------------------

describe('evaluateExpression — basic arithmetic', () => {
  const empty = new Map<string, string>();

  it('evaluates simple addition', () => {
    expect(evaluateExpression('3 + 4', empty)).toBe('7.00');
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('10 - 3', empty)).toBe('7.00');
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('6 * 7', empty)).toBe('42.00');
  });

  it('evaluates division', () => {
    expect(evaluateExpression('20 / 4', empty)).toBe('5.00');
  });

  it('evaluates modulo', () => {
    expect(evaluateExpression('10 % 3', empty)).toBe('1.00');
  });

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4', empty)).toBe('14.00');
    expect(evaluateExpression('10 - 2 * 3', empty)).toBe('4.00');
  });

  it('respects parentheses', () => {
    expect(evaluateExpression('(2 + 3) * 4', empty)).toBe('20.00');
    expect(evaluateExpression('(10 - 2) * (3 + 1)', empty)).toBe('32.00');
  });

  it('handles unary minus', () => {
    expect(evaluateExpression('-5 + 3', empty)).toBe('-2.00');
    expect(evaluateExpression('-(2 + 3)', empty)).toBe('-5.00');
  });

  it('handles division by zero as 0', () => {
    expect(evaluateExpression('10 / 0', empty)).toBe('0.00');
  });

  it('handles nested parentheses', () => {
    expect(evaluateExpression('((2 + 3) * (4 - 1)) / 5', empty)).toBe('3.00');
  });

  it('supports custom decimal places', () => {
    expect(evaluateExpression('1 / 3', empty, 4)).toBe('0.3333');
    expect(evaluateExpression('10 / 3', empty, 0)).toBe('3');
  });

  it('returns "0" for empty expression', () => {
    expect(evaluateExpression('', empty)).toBe('0');
  });

  it('handles decimal numbers', () => {
    expect(evaluateExpression('1.5 + 2.5', empty)).toBe('4.00');
  });
});

// ---------------------------------------------------------------------------
// evaluateExpression — field references
// ---------------------------------------------------------------------------

describe('evaluateExpression — field references', () => {
  it('resolves field values by name', () => {
    const fields = new Map([
      ['price', '100'],
      ['quantity', '5'],
    ]);
    expect(evaluateExpression('price * quantity', fields)).toBe('500.00');
  });

  it('resolves getField("name").value syntax', () => {
    const fields = new Map([
      ['Total', '200'],
      ['Tax', '16'],
    ]);
    expect(
      evaluateExpression(
        'getField("Total").value + getField("Tax").value',
        fields,
      ),
    ).toBe('216.00');
  });

  it('resolves getField with single quotes', () => {
    const fields = new Map([['Amount', '50']]);
    expect(
      evaluateExpression("getField('Amount').value * 2", fields),
    ).toBe('100.00');
  });

  it('treats missing fields as 0', () => {
    const fields = new Map([['a', '10']]);
    expect(evaluateExpression('a + b', fields)).toBe('10.00');
  });

  it('cleans field values with currency symbols', () => {
    const fields = new Map([
      ['price', '$1,500.00'],
      ['tax', '$120.00'],
    ]);
    expect(evaluateExpression('price + tax', fields)).toBe('1620.00');
  });
});

// ---------------------------------------------------------------------------
// evaluateExpression — AFSimple_Calculate
// ---------------------------------------------------------------------------

describe('evaluateExpression — AFSimple_Calculate', () => {
  const fields = new Map([
    ['a', '10'],
    ['b', '20'],
    ['c', '30'],
  ]);

  it('computes SUM', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("SUM", ["a", "b", "c"])', fields),
    ).toBe('60.00');
  });

  it('computes AVG', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("AVG", ["a", "b", "c"])', fields),
    ).toBe('20.00');
  });

  it('computes PRD (product)', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("PRD", ["a", "b", "c"])', fields),
    ).toBe('6000.00');
  });

  it('computes MIN', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("MIN", ["a", "b", "c"])', fields),
    ).toBe('10.00');
  });

  it('computes MAX', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("MAX", ["a", "b", "c"])', fields),
    ).toBe('30.00');
  });

  it('handles single field', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("SUM", ["a"])', fields),
    ).toBe('10.00');
  });

  it('handles missing fields in SUM (treated as 0)', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("SUM", ["a", "missing"])', fields),
    ).toBe('10.00');
  });

  it('is case-insensitive for operation name', () => {
    expect(
      evaluateExpression('AFSimple_Calculate("sum", ["a", "b"])', fields),
    ).toBe('30.00');
  });
});

// ---------------------------------------------------------------------------
// parseCalculationScript
// ---------------------------------------------------------------------------

describe('parseCalculationScript', () => {
  it('parses AFSimple_Calculate with SUM', () => {
    const result = parseCalculationScript(
      'AFSimple_Calculate("SUM", ["field1", "field2"])',
    );
    expect(result).toEqual({
      operation: 'SUM',
      fieldNames: ['field1', 'field2'],
    });
  });

  it('parses AFSimple_Calculate with AVG', () => {
    const result = parseCalculationScript(
      "AFSimple_Calculate('AVG', ['price', 'cost', 'fee'])",
    );
    expect(result).toEqual({
      operation: 'AVG',
      fieldNames: ['price', 'cost', 'fee'],
    });
  });

  it('parses custom expression with getField references', () => {
    const result = parseCalculationScript(
      'event.value = getField("price").value * getField("qty").value',
    );
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('custom');
    expect(result!.fieldNames).toEqual(['price', 'qty']);
    expect(result!.customExpression).toBe(
      'getField("price").value * getField("qty").value',
    );
  });

  it('returns null for empty script', () => {
    expect(parseCalculationScript('')).toBeNull();
    expect(parseCalculationScript('   ')).toBeNull();
  });

  it('returns null for unrecognized scripts', () => {
    expect(parseCalculationScript('console.log("hello")')).toBeNull();
  });

  it('parses PRD operation', () => {
    const result = parseCalculationScript(
      'AFSimple_Calculate("PRD", ["x", "y"])',
    );
    expect(result).toEqual({
      operation: 'PRD',
      fieldNames: ['x', 'y'],
    });
  });

  it('deduplicates field names in custom expressions', () => {
    const result = parseCalculationScript(
      'event.value = getField("a").value + getField("a").value',
    );
    expect(result).not.toBeNull();
    expect(result!.fieldNames).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('evaluateExpression — edge cases', () => {
  const empty = new Map<string, string>();

  it('handles chained operations', () => {
    expect(evaluateExpression('1 + 2 + 3 + 4', empty)).toBe('10.00');
  });

  it('handles multiple multiplications', () => {
    expect(evaluateExpression('2 * 3 * 4', empty)).toBe('24.00');
  });

  it('handles mixed operations with correct precedence', () => {
    expect(evaluateExpression('2 + 3 * 4 - 1', empty)).toBe('13.00');
  });

  it('event.value = expression syntax', () => {
    const fields = new Map([
      ['price', '10'],
      ['qty', '5'],
    ]);
    expect(
      evaluateExpression(
        'event.value = getField("price").value * getField("qty").value',
        fields,
      ),
    ).toBe('50.00');
  });
});

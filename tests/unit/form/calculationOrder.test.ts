/**
 * Tests for calculationOrder — field calculation order and execution.
 *
 * Covers:
 * - getCalculationOrder
 * - setCalculationOrder
 * - executeCalculations
 * - buildDependencyGraph
 * - topologicalSort
 */

import { describe, it, expect } from 'vitest';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfArray,
  PdfNumber,
} from '../../../src/core/pdfObjects.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { PdfTextField } from '../../../src/form/fields/textField.js';
import {
  getCalculationOrder,
  setCalculationOrder,
  executeCalculations,
  buildDependencyGraph,
  topologicalSort,
} from '../../../src/form/calculationOrder.js';
import { FieldFlags } from '../../../src/form/pdfField.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a text field dict with an optional calculation script. */
function makeTextField(
  name: string,
  value: string,
  calcScript?: string,
): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of('Tx'));
  dict.set('/T', PdfString.literal(name));
  dict.set('/V', PdfString.literal(value));
  dict.set('/Rect', PdfArray.fromNumbers([0, 0, 200, 30]));
  dict.set('/DA', PdfString.literal('/Helv 0 Tf 0 g'));

  if (calcScript !== undefined) {
    const jsDict = new PdfDict();
    jsDict.set('/S', PdfName.of('JavaScript'));
    jsDict.set('/JS', PdfString.literal(calcScript));

    const aaDict = new PdfDict();
    aaDict.set('/C', jsDict);

    dict.set('/AA', aaDict);
  }

  return dict;
}

/** Build a PdfForm from field dicts using the static factory. */
function buildForm(fieldDicts: PdfDict[]): PdfForm {
  const acroFormDict = new PdfDict();
  const fieldsArr = new PdfArray(fieldDicts);
  acroFormDict.set('/Fields', fieldsArr);

  const resolver = (ref: any) => ref; // no refs in our test
  return PdfForm.fromDict(acroFormDict, resolver);
}

// ---------------------------------------------------------------------------
// getCalculationOrder
// ---------------------------------------------------------------------------

describe('getCalculationOrder', () => {
  it('returns empty array when no fields have calculations', () => {
    const form = buildForm([
      makeTextField('name', 'Alice'),
      makeTextField('age', '30'),
    ]);
    expect(getCalculationOrder(form)).toEqual([]);
  });

  it('returns field names with calculation scripts', () => {
    const form = buildForm([
      makeTextField('a', '10'),
      makeTextField('b', '20'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["a", "b"])'),
    ]);
    const order = getCalculationOrder(form);
    expect(order).toContain('total');
    expect(order).toHaveLength(1);
  });

  it('returns multiple calculated fields in order', () => {
    const form = buildForm([
      makeTextField('price', '100'),
      makeTextField('tax', '0', 'event.value = getField("price").value * 0.1'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["price", "tax"])'),
    ]);
    const order = getCalculationOrder(form);
    expect(order).toHaveLength(2);
    expect(order[0]).toBe('tax');
    expect(order[1]).toBe('total');
  });
});

// ---------------------------------------------------------------------------
// setCalculationOrder
// ---------------------------------------------------------------------------

describe('setCalculationOrder', () => {
  it('throws for unknown field names', () => {
    const form = buildForm([makeTextField('a', '10')]);
    expect(() => setCalculationOrder(form, ['nonexistent'])).toThrow(
      'field "nonexistent" not found',
    );
  });

  it('accepts valid field names without error', () => {
    const form = buildForm([
      makeTextField('a', '10'),
      makeTextField('b', '20'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["a", "b"])'),
    ]);
    expect(() => setCalculationOrder(form, ['total'])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// executeCalculations
// ---------------------------------------------------------------------------

describe('executeCalculations', () => {
  it('executes SUM calculation on fields', () => {
    const form = buildForm([
      makeTextField('a', '10'),
      makeTextField('b', '20'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["a", "b"])'),
    ]);

    executeCalculations(form);

    const totalField = form.getTextField('total');
    expect(totalField.getText()).toBe('30.00');
  });

  it('executes chained calculations in order', () => {
    const form = buildForm([
      makeTextField('price', '100'),
      makeTextField('tax', '0', 'event.value = getField("price").value * 0.08'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["price", "tax"])'),
    ]);

    executeCalculations(form);

    const taxField = form.getTextField('tax');
    expect(taxField.getText()).toBe('8.00');

    const totalField = form.getTextField('total');
    expect(totalField.getText()).toBe('108.00');
  });

  it('handles no calculated fields gracefully', () => {
    const form = buildForm([
      makeTextField('name', 'Alice'),
      makeTextField('age', '30'),
    ]);

    // Should not throw
    executeCalculations(form);

    expect(form.getTextField('name').getText()).toBe('Alice');
    expect(form.getTextField('age').getText()).toBe('30');
  });

  it('executes AVG calculation', () => {
    const form = buildForm([
      makeTextField('s1', '80'),
      makeTextField('s2', '90'),
      makeTextField('s3', '70'),
      makeTextField('avg', '0', 'AFSimple_Calculate("AVG", ["s1", "s2", "s3"])'),
    ]);

    executeCalculations(form);

    expect(form.getTextField('avg').getText()).toBe('80.00');
  });

  it('executes PRD (product) calculation', () => {
    const form = buildForm([
      makeTextField('x', '5'),
      makeTextField('y', '4'),
      makeTextField('product', '0', 'AFSimple_Calculate("PRD", ["x", "y"])'),
    ]);

    executeCalculations(form);

    expect(form.getTextField('product').getText()).toBe('20.00');
  });
});

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph', () => {
  it('returns empty map when no calculations exist', () => {
    const form = buildForm([
      makeTextField('name', 'Alice'),
    ]);
    const graph = buildDependencyGraph(form);
    expect(graph.size).toBe(0);
  });

  it('builds graph from AFSimple_Calculate', () => {
    const form = buildForm([
      makeTextField('a', '10'),
      makeTextField('b', '20'),
      makeTextField('total', '0', 'AFSimple_Calculate("SUM", ["a", "b"])'),
    ]);

    const graph = buildDependencyGraph(form);
    expect(graph.has('total')).toBe(true);
    expect(graph.get('total')).toEqual(['a', 'b']);
  });

  it('builds graph from getField references', () => {
    const form = buildForm([
      makeTextField('price', '100'),
      makeTextField('tax', '0', 'event.value = getField("price").value * 0.1'),
    ]);

    const graph = buildDependencyGraph(form);
    expect(graph.has('tax')).toBe(true);
    expect(graph.get('tax')).toEqual(['price']);
  });
});

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe('topologicalSort', () => {
  it('sorts independent fields', () => {
    const deps = new Map<string, string[]>();
    deps.set('a', []);
    deps.set('b', []);
    const sorted = topologicalSort(deps);
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
  });

  it('puts dependencies before dependents', () => {
    const deps = new Map<string, string[]>();
    deps.set('total', ['subtotal', 'tax']);
    deps.set('tax', ['subtotal']);

    const sorted = topologicalSort(deps);

    const subtotalIdx = sorted.indexOf('subtotal');
    const taxIdx = sorted.indexOf('tax');
    const totalIdx = sorted.indexOf('total');

    expect(subtotalIdx).toBeLessThan(taxIdx);
    expect(taxIdx).toBeLessThan(totalIdx);
  });

  it('handles diamond dependencies', () => {
    // A depends on B and C; B depends on D; C depends on D
    const deps = new Map<string, string[]>();
    deps.set('A', ['B', 'C']);
    deps.set('B', ['D']);
    deps.set('C', ['D']);

    const sorted = topologicalSort(deps);

    const dIdx = sorted.indexOf('D');
    const bIdx = sorted.indexOf('B');
    const cIdx = sorted.indexOf('C');
    const aIdx = sorted.indexOf('A');

    expect(dIdx).toBeLessThan(bIdx);
    expect(dIdx).toBeLessThan(cIdx);
    expect(bIdx).toBeLessThan(aIdx);
    expect(cIdx).toBeLessThan(aIdx);
  });

  it('handles cycles gracefully', () => {
    const deps = new Map<string, string[]>();
    deps.set('a', ['b']);
    deps.set('b', ['a']);

    // Should not throw — cycles are handled gracefully
    const sorted = topologicalSort(deps);
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
  });

  it('handles empty graph', () => {
    const deps = new Map<string, string[]>();
    const sorted = topologicalSort(deps);
    expect(sorted).toEqual([]);
  });
});

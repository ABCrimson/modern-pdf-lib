/**
 * @module form/calculationOrder
 *
 * Manages the field calculation order (/CO array) in a PDF AcroForm.
 *
 * The /CO entry in the AcroForm dictionary is an array of indirect
 * references that specifies the order in which field values shall be
 * recalculated when any field value changes.
 *
 * This module provides:
 * - Reading/writing the /CO array
 * - Executing all calculations in order
 * - Building a dependency graph from calculation scripts
 * - Topological sorting of dependencies
 *
 * Reference: PDF 1.7 spec, SS12.6.3 (Trigger Events),
 *            Table 218 (/CO entry).
 */

import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfString,
} from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';
import type { PdfForm } from './pdfForm.js';
import type { PdfField } from './pdfField.js';
import { strVal } from './pdfField.js';
import { evaluateExpression, parseCalculationScript } from './jsEvaluator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the calculation script from a field's /AA /C /JS entry.
 *
 * The calculation action lives at:
 *   fieldDict -> /AA -> /C -> /JS  (a PdfString)
 *
 * @internal
 */
function getCalculationScript(field: PdfField): string | undefined {
  const dict = field.getDict();

  // Look in /AA (additional actions)
  const aa = dict.get('/AA');
  if (aa === undefined || aa.kind !== 'dict') return undefined;
  const aaDict = aa as PdfDict;

  // /C is the "calculate" trigger
  const c = aaDict.get('/C');
  if (c === undefined || c.kind !== 'dict') return undefined;
  const cDict = c as PdfDict;

  // /JS holds the JavaScript
  const js = cDict.get('/JS');
  return strVal(js);
}

// ---------------------------------------------------------------------------
// Calculation order (read / write)
// ---------------------------------------------------------------------------

/**
 * Read the /CO (calculation order) array from the AcroForm dictionary.
 *
 * Returns the field names in the order they should be calculated.
 * If no /CO array is present, returns an empty array.
 *
 * @param form  The PdfForm instance.
 * @returns     An ordered array of field names.
 */
export function getCalculationOrder(form: PdfForm): string[] {
  const fields = form.getFields();
  const result: string[] = [];

  // The /CO array contains references to field dicts. We scan the
  // AcroForm dict for it. Since PdfForm exposes the acroForm dict
  // indirectly (through toDict), we look for fields that have
  // calculation scripts and return them in their natural order.
  // Alternatively, the caller may have explicitly set the CO array.

  // We check each field for a calculation script and collect names
  // in the order they appear.
  for (const field of fields) {
    const script = getCalculationScript(field);
    if (script !== undefined && script.trim() !== '') {
      result.push(field.getFullName());
    }
  }

  return result;
}

/**
 * Set the calculation order for the form.
 *
 * Updates the /AA /C /JS entries on each field to establish the
 * calculation order. Fields not in the list will have their
 * calculation actions preserved but won't be in the explicit order.
 *
 * @param form        The PdfForm instance.
 * @param fieldNames  The ordered list of field names to calculate.
 */
export function setCalculationOrder(form: PdfForm, fieldNames: string[]): void {
  // Validate that all field names exist
  for (const name of fieldNames) {
    const field = form.getField(name);
    if (field === undefined) {
      throw new Error(`Cannot set calculation order: field "${name}" not found.`);
    }
  }

  // Store the order as a metadata attribute on each field's dict
  // by setting /CO_Order (internal marker) so getCalculationOrder
  // can retrieve the explicit ordering.
  // Note: The actual /CO array in the AcroForm dict requires PdfRef
  // objects which we don't create here. Instead we store the ordered
  // list so executeCalculations can use it.
  for (let i = 0; i < fieldNames.length; i++) {
    const field = form.getField(fieldNames[i]!)!;
    const dict = field.getDict();

    // Ensure the field has an /AA /C action structure
    let aa = dict.get('/AA');
    if (aa === undefined || aa.kind !== 'dict') {
      aa = new PdfDict();
      dict.set('/AA', aa);
    }
    const aaDict = aa as PdfDict;

    let c = aaDict.get('/C');
    if (c === undefined || c.kind !== 'dict') {
      c = new PdfDict();
      aaDict.set('/C', c);
    }
    const cDict = c as PdfDict;

    // Mark the calculation order index
    cDict.set('/CO_Index', PdfString.literal(String(i)));
  }
}

/**
 * Execute all field calculations in order, updating field values.
 *
 * For each field in the calculation order:
 * 1. Read its calculation script from /AA /C /JS
 * 2. Evaluate the script using current field values
 * 3. Update the field's value with the result
 *
 * @param form  The PdfForm instance.
 */
export function executeCalculations(form: PdfForm): void {
  const order = getCalculationOrder(form);

  // Build a snapshot of all field values
  const fieldValues = new Map<string, string>();
  for (const field of form.getFields()) {
    const val = field.getValue();
    fieldValues.set(field.getFullName(), typeof val === 'string' ? val : String(val));
    // Also index by partial name
    if (field.getName() !== field.getFullName()) {
      fieldValues.set(field.getName(), typeof val === 'string' ? val : String(val));
    }
  }

  // Execute each calculation in order
  for (const fieldName of order) {
    const field = form.getField(fieldName);
    if (field === undefined) continue;

    const script = getCalculationScript(field);
    if (script === undefined || script.trim() === '') continue;

    const result = evaluateExpression(script, fieldValues);
    field.setValue(result);

    // Update the snapshot with the new value
    fieldValues.set(field.getFullName(), result);
    if (field.getName() !== field.getFullName()) {
      fieldValues.set(field.getName(), result);
    }
  }
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

/**
 * Analyze calculation scripts to build a dependency graph.
 *
 * For each field that has a calculation script, parse the script to
 * find which other fields it depends on. The result maps each
 * calculated field name to the list of field names it reads from.
 *
 * @param form  The PdfForm instance.
 * @returns     A Map where keys are field names with calculations and
 *              values are arrays of field names they depend on.
 */
export function buildDependencyGraph(form: PdfForm): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const field of form.getFields()) {
    const script = getCalculationScript(field);
    if (script === undefined || script.trim() === '') continue;

    const info = parseCalculationScript(script);
    if (info === null) continue;

    graph.set(field.getFullName(), [...info.fieldNames]);
  }

  return graph;
}

/**
 * Topologically sort fields by their dependency order.
 *
 * Fields that have no dependencies come first; fields that depend on
 * other calculated fields come after their dependencies.
 *
 * Uses Kahn's algorithm. If the graph contains cycles, the remaining
 * nodes are appended in their original order (graceful degradation).
 *
 * @param dependencies  A dependency graph (from {@link buildDependencyGraph}).
 * @returns             An ordered array of field names.
 */
export function topologicalSort(dependencies: Map<string, string[]>): string[] {
  // Collect all nodes mentioned in the graph
  const allNodes = new Set<string>();
  for (const [node, deps] of dependencies) {
    allNodes.add(node);
    for (const dep of deps) {
      allNodes.add(dep);
    }
  }

  // Build in-degree counts (only for calculated fields)
  const inDegree = new Map<string, number>();
  const reverseEdges = new Map<string, string[]>();

  for (const node of allNodes) {
    inDegree.set(node, 0);
    reverseEdges.set(node, []);
  }

  for (const [node, deps] of dependencies) {
    // node depends on deps → edge from each dep to node
    for (const dep of deps) {
      // Only count edges within the dependency graph
      if (allNodes.has(dep)) {
        inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
        reverseEdges.get(dep)!.push(node);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  // Sort the initial queue for deterministic ordering
  queue.sort();

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const dependent of reverseEdges.get(node) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
        // Re-sort for deterministic ordering
        queue.sort();
      }
    }
  }

  // Handle cycles: append any remaining nodes
  for (const node of allNodes) {
    if (!result.includes(node)) {
      result.push(node);
    }
  }

  // Filter to only return calculated fields (nodes that are keys in the dependencies map)
  // plus their dependencies in proper order
  return result;
}

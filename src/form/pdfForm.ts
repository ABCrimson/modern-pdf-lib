/**
 * @module form/pdfForm
 *
 * The main AcroForm class — manages the field tree, provides typed
 * field accessors, and implements fill/flatten operations.
 *
 * Reference: PDF 1.7 spec, SS12.7 (Interactive Forms).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfBool,
  PdfStream,
  PdfRef,
  PdfObjectRegistry,
} from '../core/pdfObjects.js';
import type { PdfObject } from '../core/pdfObjects.js';
import { PdfField, FieldFlags, nameVal, strVal, numVal, resolveIfRef } from './pdfField.js';
import type { FieldType } from './pdfField.js';
import { PdfTextField } from './fields/textField.js';
import { PdfCheckboxField } from './fields/checkboxField.js';
import { PdfRadioGroup } from './fields/radioGroup.js';
import { PdfDropdownField } from './fields/dropdownField.js';
import { PdfListboxField } from './fields/listboxField.js';
import { PdfButtonField } from './fields/buttonField.js';
import { PdfSignatureField } from './fields/signatureField.js';

// ---------------------------------------------------------------------------
// Resolver type
// ---------------------------------------------------------------------------

/**
 * Function that resolves a PdfRef to its underlying PdfObject.
 * Used when traversing the field tree from parsed PDF data.
 */
export type RefResolver = (ref: PdfRef) => PdfObject;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine the field type from a field dictionary.
 *
 * Uses /FT (field type) and /Ff (field flags) to distinguish
 * between the various field subtypes.
 */
function classifyField(
  dict: PdfDict,
  resolver: RefResolver,
): FieldType | undefined {
  const ftObj = resolveIfRef(dict.get('/FT'), resolver);
  const ft = nameVal(ftObj);

  if (ft === undefined) return undefined;

  switch (ft) {
    case 'Tx':
      return 'text';

    case 'Btn': {
      const ff = numVal(resolveIfRef(dict.get('/Ff'), resolver)) ?? 0;
      if (ff & FieldFlags.Pushbutton) return 'button';
      if (ff & FieldFlags.Radio) return 'radio';
      return 'checkbox';
    }

    case 'Ch': {
      const ff = numVal(resolveIfRef(dict.get('/Ff'), resolver)) ?? 0;
      if (ff & FieldFlags.Combo) return 'dropdown';
      return 'listbox';
    }

    case 'Sig':
      return 'signature';

    default:
      return undefined;
  }
}

/**
 * Resolve a PdfObject if it is a PdfRef using the resolver.
 */
function resolveObj(obj: PdfObject, resolver: RefResolver): PdfObject {
  if (obj.kind === 'ref') return resolver(obj as PdfRef);
  return obj;
}

/**
 * Create the appropriate PdfField subclass for a given field dictionary.
 */
function createFieldInstance(
  type: FieldType,
  name: string,
  dict: PdfDict,
  widgetDict: PdfDict,
  parentNames: string[],
  widgets: PdfDict[],
): PdfField {
  switch (type) {
    case 'text':
      return new PdfTextField(name, dict, widgetDict, parentNames);
    case 'checkbox':
      return new PdfCheckboxField(name, dict, widgetDict, parentNames);
    case 'radio':
      return new PdfRadioGroup(name, dict, widgetDict, parentNames, widgets);
    case 'dropdown':
      return new PdfDropdownField(name, dict, widgetDict, parentNames);
    case 'listbox':
      return new PdfListboxField(name, dict, widgetDict, parentNames);
    case 'button':
      return new PdfButtonField(name, dict, widgetDict, parentNames);
    case 'signature':
      return new PdfSignatureField(name, dict, widgetDict, parentNames);
  }
}

// ---------------------------------------------------------------------------
// PdfForm
// ---------------------------------------------------------------------------

/**
 * Represents a PDF document's interactive form (AcroForm).
 *
 * Provides access to all form fields, bulk fill, and flatten operations.
 */
export class PdfForm {
  /** All fields in the form (flat list). */
  private readonly fields: PdfField[];

  /** The underlying /AcroForm dictionary. */
  private readonly acroFormDict: PdfDict;

  /** Map from field name to field for fast lookup. */
  private readonly fieldsByName: Map<string, PdfField>;

  constructor(fields: PdfField[], acroFormDict: PdfDict) {
    this.fields = fields;
    this.acroFormDict = acroFormDict;
    this.fieldsByName = new Map();
    for (const field of fields) {
      this.fieldsByName.set(field.getFullName(), field);
      // Also index by partial name for convenience
      if (field.getName() !== field.getFullName()) {
        this.fieldsByName.set(field.getName(), field);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Static factory: build from an AcroForm dictionary
  // -----------------------------------------------------------------------

  /**
   * Build a PdfForm from a parsed /AcroForm dictionary.
   *
   * Traverses the /Fields array and resolves indirect references to
   * construct the field tree, then flattens it into a list of concrete
   * field instances.
   *
   * @param acroFormDict  The /AcroForm dictionary from the document catalog.
   * @param resolver      Function to resolve PdfRef to PdfObject.
   */
  static fromDict(acroFormDict: PdfDict, resolver: RefResolver): PdfForm {
    const fieldsObj = resolveIfRef(acroFormDict.get('/Fields'), resolver);
    if (fieldsObj === undefined || fieldsObj.kind !== 'array') {
      return new PdfForm([], acroFormDict);
    }

    const fieldsArray = fieldsObj as PdfArray;
    const fields: PdfField[] = [];

    for (const item of fieldsArray.items) {
      const fieldDict = resolveObj(item, resolver);
      if (fieldDict.kind !== 'dict') continue;
      PdfForm.traverseFieldTree(fieldDict as PdfDict, resolver, [], fields);
    }

    return new PdfForm(fields, acroFormDict);
  }

  /**
   * Recursively traverse the field tree rooted at `dict`.
   *
   * The AcroForm field tree uses /Kids for both child fields and
   * widget annotations. A node is a field if it has /FT; it is a
   * widget annotation if it has /Subtype /Widget.
   */
  private static traverseFieldTree(
    dict: PdfDict,
    resolver: RefResolver,
    parentNames: string[],
    result: PdfField[],
  ): void {
    const name = strVal(dict.get('/T')) ?? '';

    // Try to classify this node as a field
    const type = classifyField(dict, resolver);

    // Check for /Kids
    const kidsObj = resolveIfRef(dict.get('/Kids'), resolver);

    if (type !== undefined) {
      // This is a field node
      if (kidsObj !== undefined && kidsObj.kind === 'array') {
        // Field with widget children (e.g. radio group)
        const kidsArr = kidsObj as PdfArray;
        const widgets: PdfDict[] = [];

        for (const kid of kidsArr.items) {
          const kidDict = resolveObj(kid, resolver);
          if (kidDict.kind === 'dict') {
            const kidPdfDict = kidDict as PdfDict;
            // If kid has /Subtype /Widget, it's a widget annotation
            const subtype = nameVal(kidPdfDict.get('/Subtype'));
            if (subtype === 'Widget') {
              widgets.push(kidPdfDict);
            } else if (classifyField(kidPdfDict, resolver) !== undefined) {
              // It's a child field — recurse
              PdfForm.traverseFieldTree(
                kidPdfDict,
                resolver,
                [...parentNames, name],
                result,
              );
              continue;
            } else {
              widgets.push(kidPdfDict);
            }
          }
        }

        const widgetDict = widgets[0] ?? dict;
        const field = createFieldInstance(type, name, dict, widgetDict, parentNames, widgets);
        result.push(field);
      } else {
        // Field + widget merged into one dictionary
        const field = createFieldInstance(type, name, dict, dict, parentNames, []);
        result.push(field);
      }
    } else if (kidsObj !== undefined && kidsObj.kind === 'array') {
      // Intermediate node (no /FT) — recurse into children
      const kidsArr = kidsObj as PdfArray;
      for (const kid of kidsArr.items) {
        const kidDict = resolveObj(kid, resolver);
        if (kidDict.kind === 'dict') {
          PdfForm.traverseFieldTree(
            kidDict as PdfDict,
            resolver,
            name !== '' ? [...parentNames, name] : parentNames,
            result,
          );
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Field access
  // -----------------------------------------------------------------------

  /** Get all fields in the form. */
  getFields(): PdfField[] {
    return [...this.fields];
  }

  /**
   * Get a field by name (partial or fully-qualified).
   * Returns undefined if not found.
   */
  getField(name: string): PdfField | undefined {
    return this.fieldsByName.get(name);
  }

  /**
   * Get a text field by name.
   * Throws if the field is not found or is not a text field.
   */
  getTextField(name: string): PdfTextField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'text') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a text field.`,
      );
    }
    return field as PdfTextField;
  }

  /**
   * Get a checkbox field by name.
   * Throws if the field is not found or is not a checkbox.
   */
  getCheckbox(name: string): PdfCheckboxField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'checkbox') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a checkbox.`,
      );
    }
    return field as PdfCheckboxField;
  }

  /**
   * Get a radio group by name.
   * Throws if the field is not found or is not a radio group.
   */
  getRadioGroup(name: string): PdfRadioGroup {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'radio') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a radio group.`,
      );
    }
    return field as PdfRadioGroup;
  }

  /**
   * Get a dropdown field by name.
   * Throws if the field is not found or is not a dropdown.
   */
  getDropdown(name: string): PdfDropdownField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'dropdown') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a dropdown.`,
      );
    }
    return field as PdfDropdownField;
  }

  /**
   * Get a listbox field by name.
   * Throws if the field is not found or is not a listbox.
   */
  getListbox(name: string): PdfListboxField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'listbox') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a listbox.`,
      );
    }
    return field as PdfListboxField;
  }

  /**
   * Get a button field by name.
   * Throws if the field is not found or is not a button.
   */
  getButton(name: string): PdfButtonField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'button') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a button.`,
      );
    }
    return field as PdfButtonField;
  }

  /**
   * Get a signature field by name.
   * Throws if the field is not found or is not a signature field.
   */
  getSignatureField(name: string): PdfSignatureField {
    const field = this.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    if (field.fieldType !== 'signature') {
      throw new Error(
        `Form field "${name}" is a ${field.fieldType} field, not a signature field.`,
      );
    }
    return field as PdfSignatureField;
  }

  // -----------------------------------------------------------------------
  // Bulk fill
  // -----------------------------------------------------------------------

  /**
   * Fill multiple fields at once.
   *
   * Accepts a record where keys are field names and values are the
   * field values to set.  Strings map to text/dropdown/listbox values;
   * booleans map to checkbox checked states.
   *
   * @param values  A mapping of field name to value.
   * @throws        If a field name is not found.
   */
  fill(values: Record<string, string | boolean>): void {
    for (const [name, value] of Object.entries(values)) {
      const field = this.getField(name);
      if (field === undefined) {
        throw new Error(`Form field "${name}" not found.`);
      }
      field.setValue(value);
    }
  }

  // -----------------------------------------------------------------------
  // Flatten
  // -----------------------------------------------------------------------

  /**
   * Flatten the form: burn field values into the page content streams
   * and remove the interactive form structure.
   *
   * After flattening, the document is no longer interactive — field
   * values become static page content. This is done by:
   *
   * 1. Generating appearance streams for all fields that lack them
   * 2. Removing the /AcroForm entry from the catalog
   * 3. Removing /Widget annotations from page /Annots arrays
   *
   * Note: In this implementation, we mark the form as flattened by
   * setting a flag and clearing the /Fields array. The appearance
   * streams remain as page annotations will reference them.
   */
  flatten(): void {
    // Generate appearances for all fields
    for (const field of this.fields) {
      field.generateAppearance();
    }

    // Clear the fields array to remove interactive form
    this.acroFormDict.set('/Fields', new PdfArray());

    // Set NeedAppearances to false (appearances are now generated)
    this.acroFormDict.delete('/NeedAppearances');
  }

  // -----------------------------------------------------------------------
  // XFA
  // -----------------------------------------------------------------------

  /**
   * Check whether the AcroForm dictionary contains XFA data.
   *
   * XFA (XML Forms Architecture) data causes PDF viewers to use the
   * XFA renderer instead of the standard AcroForm renderer. Use
   * {@link deleteXFA} to remove it.
   *
   * @returns `true` if the form has an /XFA entry.
   */
  hasXFA(): boolean {
    return this.acroFormDict.has('/XFA');
  }

  /**
   * Remove the /XFA entry from the AcroForm dictionary, if present.
   *
   * XFA (XML Forms Architecture) data can cause PDF viewers to use the
   * XFA renderer instead of the standard AcroForm renderer, which is
   * often undesirable.  Removing /XFA forces viewers to fall back to
   * the AcroForm fields.
   *
   * After removing /XFA, `/NeedAppearances` is set to `true` so that
   * the viewer knows it must generate appearances for the AcroForm
   * fields (since XFA appearances are no longer available).
   *
   * This method is a no-op if the AcroForm dictionary does not contain
   * an /XFA entry.
   */
  deleteXFA(): void {
    if (!this.acroFormDict.has('/XFA')) {
      return;
    }
    this.acroFormDict.delete('/XFA');
    this.acroFormDict.set('/NeedAppearances', PdfBool.TRUE);
  }

  // -----------------------------------------------------------------------
  // Field creation
  // -----------------------------------------------------------------------

  /**
   * Create a new text field and add it to the form.
   *
   * @param name  Field name.
   * @param page  Page index (zero-based) where the widget appears.
   * @param rect  Widget rectangle [x1, y1, x2, y2].
   * @returns     The newly created text field.
   */
  createTextField(
    name: string,
    page: number,
    rect: [number, number, number, number],
  ): PdfTextField {
    const dict = this.createFieldDict(name, 'Tx', rect);
    dict.set('/DA', PdfString.literal('/Helv 0 Tf 0 g'));

    const field = new PdfTextField(name, dict, dict);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(dict);
    return field;
  }

  /**
   * Create a new checkbox and add it to the form.
   *
   * @param name  Field name.
   * @param page  Page index (zero-based).
   * @param rect  Widget rectangle [x1, y1, x2, y2].
   * @returns     The newly created checkbox field.
   */
  createCheckbox(
    name: string,
    page: number,
    rect: [number, number, number, number],
  ): PdfCheckboxField {
    const dict = this.createFieldDict(name, 'Btn', rect);
    dict.set('/V', PdfName.of('Off'));
    dict.set('/AS', PdfName.of('Off'));

    const field = new PdfCheckboxField(name, dict, dict);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(dict);
    return field;
  }

  /**
   * Create a new dropdown and add it to the form.
   *
   * @param name     Field name.
   * @param page     Page index (zero-based).
   * @param rect     Widget rectangle [x1, y1, x2, y2].
   * @param options  The list of option strings.
   * @returns        The newly created dropdown field.
   */
  createDropdown(
    name: string,
    page: number,
    rect: [number, number, number, number],
    options: string[],
  ): PdfDropdownField {
    const dict = this.createFieldDict(name, 'Ch', rect);
    dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
    dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
    dict.set('/DA', PdfString.literal('/Helv 0 Tf 0 g'));

    const field = new PdfDropdownField(name, dict, dict);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(dict);
    return field;
  }

  /**
   * Create a new radio button group and add it to the form.
   *
   * A radio group is a single field with multiple widget annotations,
   * one per rectangle in `rects`.  Each widget corresponds to an
   * option; if `options` is supplied the n-th option labels the n-th
   * widget, otherwise options default to `"Option0"`, `"Option1"`, etc.
   *
   * @param name     Field name.
   * @param page     The PdfPage where the widgets appear (unused for
   *                 positioning in the low-level dict, but reserved
   *                 for future page-level annotation linking).
   * @param rects    Array of widget rectangles `{x, y, width, height}`.
   * @param options  Optional option labels (one per rect).
   * @returns        The newly created radio group.
   */
  createRadioGroup(
    name: string,
    page: unknown,
    rects: Array<{ x: number; y: number; width: number; height: number }>,
    options?: string[],
  ): PdfRadioGroup {
    // Build the parent field dictionary (no widget merged in)
    const fieldDict = new PdfDict();
    fieldDict.set('/FT', PdfName.of('Btn'));
    fieldDict.set('/Ff', PdfNumber.of(FieldFlags.Radio | FieldFlags.NoToggleToOff));
    fieldDict.set('/T', PdfString.literal(name));
    fieldDict.set('/V', PdfName.of('Off'));

    const widgets: PdfDict[] = [];
    const kidsArr = new PdfArray();

    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]!;
      const optName = options?.[i] ?? `Option${i}`;
      const rect: [number, number, number, number] = [r.x, r.y, r.x + r.width, r.y + r.height];

      const widgetDict = new PdfDict();
      widgetDict.set('/Type', PdfName.of('Annot'));
      widgetDict.set('/Subtype', PdfName.of('Widget'));
      widgetDict.set('/Rect', PdfArray.fromNumbers(rect));
      widgetDict.set('/AS', PdfName.of('Off'));
      widgetDict.set('/Parent', fieldDict);

      // Build /AP /N with the option name as key
      const nDict = new PdfDict();
      nDict.set(`/${optName}`, new PdfStream(new PdfDict(), new Uint8Array(0)));
      nDict.set('/Off', new PdfStream(new PdfDict(), new Uint8Array(0)));
      const apDict = new PdfDict();
      apDict.set('/N', nDict);
      widgetDict.set('/AP', apDict);

      widgets.push(widgetDict);
      kidsArr.push(widgetDict);
    }

    fieldDict.set('/Kids', kidsArr);

    const firstWidget = widgets[0] ?? fieldDict;
    const field = new PdfRadioGroup(name, fieldDict, firstWidget, [], widgets);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(fieldDict);
    return field;
  }

  /**
   * Create a new push button and add it to the form.
   *
   * @param name   Field name.
   * @param page   The PdfPage where the widget appears.
   * @param rect   Widget rectangle `{x, y, width, height}`.
   * @param label  Optional button caption.
   * @returns      The newly created button field.
   */
  createButton(
    name: string,
    page: unknown,
    rect: { x: number; y: number; width: number; height: number },
    label?: string,
  ): PdfButtonField {
    const pdfRect: [number, number, number, number] = [
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
    ];
    const dict = this.createFieldDict(name, 'Btn', pdfRect);
    dict.set('/Ff', PdfNumber.of(FieldFlags.Pushbutton));

    if (label !== undefined) {
      const mk = new PdfDict();
      mk.set('/CA', PdfString.literal(label));
      dict.set('/MK', mk);
    }

    const field = new PdfButtonField(name, dict, dict);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(dict);
    return field;
  }

  /**
   * Create a new listbox and add it to the form.
   *
   * A listbox is a choice field (/FT /Ch) without the Combo flag,
   * displaying a scrollable list of options.
   *
   * @param name     Field name.
   * @param page     The PdfPage where the widget appears.
   * @param rect     Widget rectangle `{x, y, width, height}`.
   * @param options  The list of option strings.
   * @returns        The newly created listbox field.
   */
  createListbox(
    name: string,
    page: unknown,
    rect: { x: number; y: number; width: number; height: number },
    options: string[],
  ): PdfListboxField {
    const pdfRect: [number, number, number, number] = [
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
    ];
    const dict = this.createFieldDict(name, 'Ch', pdfRect);
    // No Combo flag → listbox (not dropdown)
    dict.set('/Opt', PdfArray.of(options.map((o) => PdfString.literal(o))));
    dict.set('/DA', PdfString.literal('/Helv 0 Tf 0 g'));

    const field = new PdfListboxField(name, dict, dict);
    this.fields.push(field);
    this.fieldsByName.set(name, field);
    this.addFieldToAcroForm(dict);
    return field;
  }

  /**
   * Remove a field from the form by name.
   *
   * Removes the field from the internal field list, the name index,
   * and the /Fields array in the AcroForm dictionary.
   *
   * @param name  The field name (partial or fully-qualified).
   * @throws      If no field with the given name exists.
   */
  removeField(name: string): void {
    const field = this.fieldsByName.get(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }

    // Remove from internal fields array
    const idx = this.fields.indexOf(field);
    if (idx !== -1) {
      this.fields.splice(idx, 1);
    }

    // Remove from name index (both partial and full name)
    this.fieldsByName.delete(field.getFullName());
    if (field.getName() !== field.getFullName()) {
      this.fieldsByName.delete(field.getName());
    }

    // Remove from the /Fields array in the AcroForm dictionary
    const fieldsObj = this.acroFormDict.get('/Fields');
    if (fieldsObj !== undefined && fieldsObj.kind === 'array') {
      const fieldsArr = fieldsObj as PdfArray;
      // Remove items that match the field's underlying dict
      const fieldDict = (field as any).dict as PdfDict;
      const newItems = fieldsArr.items.filter((item) => item !== fieldDict);
      // Rebuild the array
      const newArr = new PdfArray(newItems);
      this.acroFormDict.set('/Fields', newArr);
    }
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /**
   * Serialize the form back to a PdfDict.
   *
   * Updates /NeedAppearances if appearances need to be generated
   * by the viewer.
   */
  toDict(registry: PdfObjectRegistry): PdfDict {
    // Register default fonts if not already present
    const dr = this.acroFormDict.get('/DR');
    if (dr === undefined) {
      const resources = new PdfDict();
      const fontDict = new PdfDict();
      const helvetica = new PdfDict();
      helvetica.set('/Type', PdfName.of('Font'));
      helvetica.set('/Subtype', PdfName.of('Type1'));
      helvetica.set('/BaseFont', PdfName.of('Helvetica'));
      fontDict.set('/Helv', helvetica);
      resources.set('/Font', fontDict);
      this.acroFormDict.set('/DR', resources);
    }

    return this.acroFormDict;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Create a basic field dictionary with common entries.
   */
  private createFieldDict(
    name: string,
    fieldType: string,
    rect: [number, number, number, number],
  ): PdfDict {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('Annot'));
    dict.set('/Subtype', PdfName.of('Widget'));
    dict.set('/FT', PdfName.of(fieldType));
    dict.set('/T', PdfString.literal(name));
    dict.set('/Rect', PdfArray.fromNumbers(rect));
    return dict;
  }

  /**
   * Add a field dictionary to the /Fields array in the AcroForm.
   */
  private addFieldToAcroForm(fieldDict: PdfDict): void {
    let fieldsObj = this.acroFormDict.get('/Fields');
    if (fieldsObj === undefined || fieldsObj.kind !== 'array') {
      fieldsObj = new PdfArray();
      this.acroFormDict.set('/Fields', fieldsObj);
    }
    (fieldsObj as PdfArray).push(fieldDict);
  }
}

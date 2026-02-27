/**
 * @module form/fields/dropdownField
 *
 * PDF dropdown (combo box) form field (/FT /Ch with Combo flag).
 *
 * Reference: PDF 1.7 spec, SS12.7.4.4 (Choice Fields).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
} from '../../core/pdfObjects.js';
import { PdfField, FieldFlags, strVal } from '../pdfField.js';
import type { FieldType } from '../pdfField.js';
import { generateDropdownAppearance } from '../fieldAppearance.js';

// ---------------------------------------------------------------------------
// PdfDropdownField
// ---------------------------------------------------------------------------

/**
 * A PDF dropdown (combo box) field (/FT /Ch with Combo flag).
 *
 * Options are stored in the /Opt array. The selected value is in /V.
 * Optionally editable (bit 18 of /Ff).
 */
export class PdfDropdownField extends PdfField {
  readonly fieldType: FieldType = 'dropdown';

  // -----------------------------------------------------------------------
  // Value access
  // -----------------------------------------------------------------------

  /** Get the currently selected value. */
  getSelected(): string {
    return strVal(this.dict.get('/V')) ?? '';
  }

  /** Select a value from the options. */
  select(value: string): void {
    this.dict.set('/V', PdfString.literal(value));
    this.widgetDict.delete('/AP');
  }

  /** Alias for getSelected(). */
  getValue(): string {
    return this.getSelected();
  }

  /** Alias for select(). */
  setValue(value: string | boolean | string[]): void {
    this.select(typeof value === 'string' ? value : String(value));
  }

  // -----------------------------------------------------------------------
  // Options
  // -----------------------------------------------------------------------

  /**
   * Get the list of options.
   *
   * /Opt may be an array of strings, or an array of two-element arrays
   * where element [0] is the export value and element [1] is the display
   * value. We return the display values (or export values if no display).
   */
  getOptions(): string[] {
    const optObj = this.dict.get('/Opt');
    if (optObj === undefined || optObj.kind !== 'array') return [];

    const arr = optObj as PdfArray;
    const options: string[] = [];

    for (const item of arr.items) {
      if (item.kind === 'string') {
        options.push((item as PdfString).value);
      } else if (item.kind === 'array') {
        // Two-element array: [exportValue, displayValue]
        const subArr = item as PdfArray;
        const display = subArr.items[1] ?? subArr.items[0];
        if (display !== undefined && display.kind === 'string') {
          options.push((display as PdfString).value);
        }
      }
    }

    return options;
  }

  /** Set the list of options. */
  setOptions(options: string[]): void {
    const arr = PdfArray.of(options.map((o) => PdfString.literal(o)));
    this.dict.set('/Opt', arr);
    this.widgetDict.delete('/AP');
  }

  // -----------------------------------------------------------------------
  // Editable
  // -----------------------------------------------------------------------

  /** Whether the dropdown allows manual text entry. */
  isEditable(): boolean {
    return this.hasFlag(FieldFlags.Edit);
  }

  /** Set whether the dropdown allows manual text entry. */
  setEditable(editable: boolean): void {
    this.setFlag(FieldFlags.Edit, editable);
  }

  // -----------------------------------------------------------------------
  // Appearance generation
  // -----------------------------------------------------------------------

  /** Generate the appearance stream for this dropdown. */
  generateAppearance(): PdfStream {
    return generateDropdownAppearance({
      value: this.getSelected(),
      rect: this.getRect(),
    });
  }
}
